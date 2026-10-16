// 資料結構 第9章：進階樹（B-Tree、B+ Tree、Trie）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
//
// 慣例（洪逸／Horowitz）：order m 的 B-tree，每個節點最多 m 個子節點、m−1 個 key；
// 非根節點至少 ⌈m/2⌉ 個子節點（⌈m/2⌉−1 個 key），根至少 2 個子節點（除非它是葉子）。
// 插入 overflow（m 個 key）時，第 ⌈m/2⌉ 個 key 往上，左右各自成為一個節點。
// 刪除：key 在內部節點時用「左子樹最大值」(predecessor) 取代；underflow 時先向右兄弟借、
// 再向左兄弟借；兩邊都只剩最少 key 就和兄弟合併（父節點的分隔 key 一起下來）。
// B+ tree：葉節點分裂時左邊留 ⌊m/2⌋ 個，右半第一個 key「複製」到父節點（葉子裡還留著）；
// 內部節點分裂和 B-tree 一樣是「移」上去。
import kit from './_kit.js';

export default function (ctx) {
  const { THREE, lab, colorFor, sleep, $, log, clearLog, setState, controls, on, say, beat } = ctx;
  let timer = null;
  let busy = false;
  let epoch = 0; // bumps on every mode switch so a running animation stops touching old objects
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // ───────────────────────── 共用小工具 ─────────────────────────
  async function wait(tok, ms) {
    const e = epoch;
    if (tok !== undefined) await beat(tok, ms); else await sleep(ms);
    if (e !== epoch) throw new Error('mode changed');
  }
  async function run(fn) {
    if (busy) { log('動畫還在跑，等它做完再按。', true); return; }
    busy = true;
    try { await fn(); } catch (e) { if (!/changed/.test(e.message)) console.error(e); } finally { busy = false; }
  }
  function drop(o) {
    if (!o) return;
    lab.world.remove(o);
    o.traverse((c) => { if (c.element) c.element.remove(); });
  }
  function rod(a, b, color = '#8a7a60', r = 0.035) {
    const d = b.clone().sub(a);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, Math.max(0.001, d.length()), 8), new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
    lab.world.add(m);
    return m;
  }
  function txt(text, cls, pos) { const l = lab.label(text, cls); l.position.copy(pos); lab.world.add(l); return l; }
  function glow(obj, color) {
    obj.traverse((o) => { if (o.material && o.material.emissive) o.material.emissive.set(color || '#000000'); });
  }
  function makeRing() {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 10, 40), new THREE.MeshBasicMaterial({ color: '#c08a1f' }));
    r.rotation.x = Math.PI / 2;
    r.visible = false;
    lab.world.add(r);
    return r;
  }
  function parseKeys(s) { return (String(s).match(/-?\d+/g) || []).map(Number).filter((x) => x >= 1 && x <= 99); }
  function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // ───────────────────────── B-Tree / B+ Tree 共用：節點與排版 ─────────────────────────
  const KW = 0.74, DY = 1.75, MAXW = 13.4;
  const isLeaf = (n) => n.kids.length === 0;
  const minKeys = (m) => Math.ceil(m / 2) - 1;
  function height(n) { let h = 0; while (n) { h++; n = n.kids[0]; } return h; }
  function countKeys(n) { return n ? n.keys.length + n.kids.reduce((s, c) => s + countKeys(c), 0) : 0; }
  // tidy layout: each subtree gets max(own width, children's widths); node centred over its region
  function layoutTree(root) {
    const pos = new Map();
    if (!root) return { pos, s: 1, h: 0 };
    const h = height(root);
    const GAP = 0.5;
    const nodeW = (n) => Math.max(1, n.keys.length) * KW;
    const sw = new Map();
    (function measure(n) {
      const kidsW = n.kids.reduce((s, c) => s + measure(c), 0) + GAP * Math.max(0, n.kids.length - 1);
      const w = Math.max(nodeW(n), kidsW);
      sw.set(n, w);
      return w;
    })(root);
    const W = sw.get(root);
    const s = Math.min(1, MAXW / W);
    (function place(n, left, d) {
      const w = sw.get(n);
      pos.set(n, { x: (left + w / 2 - W / 2) * s, y: 0.55 + (h - 1 - d) * DY, d });
      const kidsW = n.kids.reduce((a, c) => a + sw.get(c), 0) + GAP * Math.max(0, n.kids.length - 1);
      let x = left + (w - kidsW) / 2;
      n.kids.forEach((c) => { place(c, x, d + 1); x += sw.get(c) + GAP; });
    })(root, 0, 0);
    return { pos, s, h };
  }
  function keyX(p, i, k, s) { return p.x + (i - (k - 1) / 2) * KW * s; }

  // A "tree view" owns key bodies (by id), node trays, edges and leaf links.
  function makeView() {
    return { bodies: new Map(), statics: [], ring: null };
  }
  // render(view, root, opts): ids(n, i) gives a body id for key i of node n.
  function renderTree(view, root, opts = {}) {
    const m = opts.m || 3;
    view.statics.forEach(drop);
    view.statics = [];
    const { pos, s } = layoutTree(root);
    const seen = new Set();
    const leaves = [];
    pos.forEach((p, n) => {
      const k = n.keys.length;
      // tray under the keys: red = overflow, amber = underflow
      let col = '#e2d3b6';
      if (k > m - 1) col = '#f0a8a8';
      else if (n !== root && k < (opts.minLeaf && isLeaf(n) ? opts.minLeaf : minKeys(m))) col = '#f4d58d';
      if (opts.hot === n) col = opts.hotColor || col;
      const tray = new THREE.Mesh(new THREE.BoxGeometry(Math.max(1, k) * KW * s + 0.18, 0.14, 1.05), new THREE.MeshStandardMaterial({ color: col, roughness: 1 }));
      tray.position.set(p.x, p.y - 0.37, 0);
      tray.receiveShadow = true;
      lab.world.add(tray);
      view.statics.push(tray);
      if (k > m - 1) view.statics.push(txt('overflow', 'ptr', V(p.x + (k * KW * s) / 2 + 0.6, p.y, 0)));
      n.keys.forEach((key, i) => {
        const id = opts.ids ? opts.ids(n, key) : String(key);
        seen.add(id);
        const target = V(keyX(p, i, k, s), p.y, 0);
        let b = view.bodies.get(id);
        if (!b) {
          const mesh = lab.box(opts.leafColor && isLeaf(n) && opts.plus ? opts.leafColor(key) : colorFor(key), [KW - 0.08, 0.6, 0.8]);
          mesh.add(lab.label(String(key), 'val'));
          const from = opts.spawnFrom && opts.spawnFrom(id);
          if (from) mesh.position.copy(from); else mesh.position.copy(target).add(V(0, 5, 0));
          b = lab.addBody(mesh);
          b.id = id;
          view.bodies.set(id, b);
          if (from) lab.springTo(b, target); else lab.dropTo(b, target);
        } else {
          lab.springTo(b, target);
        }
        b.obj.scale.x = s;
        if (opts.plus && !isLeaf(n)) b.obj.scale.y = 0.75;
      });
      // edges: from the gap between keys (child slot i) down to the child's tray
      n.kids.forEach((c, i) => {
        const cp = pos.get(c);
        const ax = p.x + (i - k / 2) * KW * s;
        view.statics.push(rod(V(ax, p.y - 0.44, 0), V(cp.x, cp.y + 0.32, 0)));
      });
      if (isLeaf(n)) leaves.push(n);
    });
    // leaf links (B+ tree): arrow from each leaf to its next
    if (opts.plus) {
      leaves.forEach((n) => {
        if (!n.next) return;
        const a = pos.get(n), b = pos.get(n.next);
        if (!a || !b) return;
        const from = V(a.x + (n.keys.length * KW * s) / 2 + 0.04, a.y - 0.37, 0.35);
        const to = V(b.x - (n.next.keys.length * KW * s) / 2 - 0.04, b.y - 0.37, 0.35);
        const dir = to.clone().sub(from);
        const ar = new THREE.ArrowHelper(dir.clone().normalize(), from, dir.length(), 0x2fc092, 0.22, 0.16);
        lab.world.add(ar);
        view.statics.push(ar);
      });
    }
    // keys that disappeared fly away
    for (const [id, b] of [...view.bodies]) {
      if (!seen.has(id)) { view.bodies.delete(id); lab.flyAway(b, V(0, 8, 5)); }
    }
    return pos;
  }
  function ringAt(view, pos, n, s) {
    if (!view.ring) return;
    const p = pos.get(n);
    if (!p) { view.ring.visible = false; return; }
    view.ring.visible = true;
    view.ring.position.set(p.x, p.y - 0.28, 0);
    const w = Math.max(1, n.keys.length) * KW * (s || 1);
    view.ring.scale.set(w / 1.0 + 0.3, 1.25, 1);
  }

  // ───────────────────────── B-Tree 演算法（generator：每一步 yield 一次） ─────────────────────────
  const BT = { m: 3, root: null, view: null, mode: 'ins', last: '' };
  function* btInsert(k) {
    const m = BT.m;
    if (!BT.root) {
      BT.root = { keys: [k], kids: [] };
      yield { cap: '空樹：' + k + ' 成為根', f: '根可以只有 1 個 key', newKey: k };
      return;
    }
    let n = BT.root;
    const path = [];
    for (;;) {
      path.push(n);
      if (n.keys.includes(k)) { yield { warn: k + ' 已經在樹裡了，B-tree 的 key 不重複。' }; return; }
      yield { cap: '比較 ' + k + ' 和 [' + n.keys.join(', ') + ']', f: isLeaf(n) ? '到葉節點了' : '往第 ' + (n.keys.filter((x) => x < k).length + 1) + ' 個子樹走', ring: n, ms: 650 };
      if (isLeaf(n)) break;
      let i = 0;
      while (i < n.keys.length && k > n.keys[i]) i++;
      n = n.kids[i];
    }
    let i = 0;
    while (i < n.keys.length && k > n.keys[i]) i++;
    n.keys.splice(i, 0, k);
    const over = n.keys.length > m - 1;
    yield { cap: '把 ' + k + ' 放進葉節點', f: over ? '<span class="no">key 數 = ' + n.keys.length + ' = m → overflow</span>' : 'key 數 ' + n.keys.length + ' ≤ m − 1 = ' + (m - 1) + '，不用分裂', newKey: k, ring: n };
    while (n.keys.length > m - 1) {
      const mid = Math.ceil(m / 2) - 1; // k_{⌈m/2⌉}
      const up = n.keys[mid];
      const left = { keys: n.keys.slice(0, mid), kids: n.kids.slice(0, mid + 1) };
      const right = { keys: n.keys.slice(mid + 1), kids: n.kids.slice(mid + 1) };
      path.pop();
      const parent = path[path.length - 1];
      if (!parent) {
        BT.root = { keys: [up], kids: [left, right] };
        yield { cap: '根分裂：' + up + ' 往上成為新根', f: '第 ⌈' + m + '/2⌉ = ' + (mid + 1) + ' 個 key 往上，樹高 +1', up, ring: BT.root, ms: 1300 };
        break;
      }
      const ci = parent.kids.indexOf(n);
      parent.kids.splice(ci, 1, left, right);
      parent.keys.splice(ci, 0, up);
      const po = parent.keys.length > m - 1;
      yield { cap: '分裂：中間的 ' + up + ' 往上', f: '[' + left.keys.join(',') + '] ← ' + up + ' → [' + right.keys.join(',') + ']' + (po ? '，<span class="no">父節點也 overflow</span>' : ''), up, ring: parent, ms: 1300 };
      n = parent;
    }
  }
  function* btDelete(k) {
    const m = BT.m, mk = minKeys(m);
    if (!BT.root) { yield { warn: '樹是空的。' }; return; }
    let n = BT.root;
    const path = [];
    for (;;) {
      path.push(n);
      yield { cap: '找 ' + k + '：比較 [' + n.keys.join(', ') + ']', f: '', ring: n, ms: 600 };
      if (n.keys.includes(k)) break;
      if (isLeaf(n)) { yield { warn: '找不到 ' + k + '，沒有東西可以刪。' }; return; }
      let i = 0;
      while (i < n.keys.length && k > n.keys[i]) i++;
      n = n.kids[i];
    }
    const idx = n.keys.indexOf(k);
    if (!isLeaf(n)) {
      let p = n.kids[idx];
      path.push(p);
      while (!isLeaf(p)) { p = p.kids[p.kids.length - 1]; path.push(p); }
      const pred = p.keys[p.keys.length - 1];
      n.keys[idx] = pred;
      p.keys.pop();
      yield { cap: k + ' 在內部節點：用左子樹最大值 ' + pred + ' 取代', f: '問題轉成「從葉節點刪掉 ' + pred + '」', ring: p, ms: 1500 };
      n = p;
    } else {
      n.keys.splice(idx, 1);
      yield { cap: '從葉節點刪掉 ' + k, f: n === BT.root || n.keys.length >= mk ? '剩 ' + n.keys.length + ' 個 ≥ ⌈m/2⌉ − 1 = ' + mk + '，沒事' : '<span class="no">剩 ' + n.keys.length + ' 個 &lt; ⌈m/2⌉ − 1 = ' + mk + ' → underflow</span>', ring: n, ms: 1200 };
    }
    while (n !== BT.root && n.keys.length < mk) {
      const parent = path[path.indexOf(n) - 1];
      const ci = parent.kids.indexOf(n);
      const R = parent.kids[ci + 1], L = parent.kids[ci - 1];
      if (R && R.keys.length > mk) {
        const down = parent.keys[ci], upk = R.keys[0];
        n.keys.push(down);
        parent.keys[ci] = R.keys.shift();
        if (!isLeaf(R)) n.kids.push(R.kids.shift());
        yield { cap: '向右兄弟借：父節點的 ' + down + ' 下來，兄弟的 ' + upk + ' 上去', f: '右兄弟有 ' + (R.keys.length + 1) + ' 個 &gt; ' + mk + '，借得起（rotation）', ring: parent, ms: 1600 };
        return;
      }
      if (L && L.keys.length > mk) {
        const down = parent.keys[ci - 1], upk = L.keys[L.keys.length - 1];
        n.keys.unshift(down);
        parent.keys[ci - 1] = L.keys.pop();
        if (!isLeaf(L)) n.kids.unshift(L.kids.pop());
        yield { cap: '向左兄弟借：父節點的 ' + down + ' 下來，兄弟的 ' + upk + ' 上去', f: '右邊借不到，改看左兄弟（有 ' + (L.keys.length + 1) + ' 個）', ring: parent, ms: 1600 };
        return;
      }
      if (R) {
        const sep = parent.keys[ci];
        n.keys.push(sep, ...R.keys);
        n.kids.push(...R.kids);
        parent.keys.splice(ci, 1);
        parent.kids.splice(ci + 1, 1);
        yield { cap: '兄弟也只有最少 key → 合併：' + sep + ' 下來黏住兩邊', f: '[' + n.keys.join(',') + ']，父節點少 1 個 key', ring: n, ms: 1600 };
      } else {
        const sep = parent.keys[ci - 1];
        L.keys.push(sep, ...n.keys);
        L.kids.push(...n.kids);
        parent.keys.splice(ci - 1, 1);
        parent.kids.splice(ci, 1);
        yield { cap: '和左兄弟合併：' + sep + ' 下來', f: '[' + L.keys.join(',') + ']，父節點少 1 個 key', ring: L, ms: 1600 };
      }
      n = parent;
      if (n !== BT.root && n.keys.length < mk) yield { cap: '父節點也 underflow，往上繼續處理', f: '剩 ' + n.keys.length + ' 個 &lt; ' + mk, ring: n, ms: 1100 };
    }
    if (BT.root.keys.length === 0) {
      BT.root = BT.root.kids[0] || null;
      yield { cap: '根的 key 被拿光了：刪掉根，樹高 −1', f: 'B-tree 只會從根長高、也只會從根變矮', ms: 1500 };
    }
  }
  function btBuild(m, seq) {
    BT.m = m; BT.root = null;
    for (const k of seq) for (const _ of btInsert(k)) { /* run silently */ }
  }
  function btRender(st = {}) {
    const pos = renderTree(BT.view, BT.root, { m: BT.m });
    const { s } = layoutTree(BT.root);
    if (st.ring) ringAt(BT.view, pos, st.ring, s); else if (BT.view.ring) BT.view.ring.visible = false;
    if (st.newKey !== undefined) { const b = BT.view.bodies.get(String(st.newKey)); if (b) { glow(b.obj, '#4a3a00'); setTimeout(() => glow(b.obj), 900); } }
    if (st.up !== undefined) { const b = BT.view.bodies.get(String(st.up)); if (b) { glow(b.obj, '#5a1a00'); setTimeout(() => glow(b.obj), 1200); } }
    btState();
  }
  function btState() {
    const m = BT.m;
    setState('B-Tree（order m = ' + m + '）', [
      ['每個節點 key 數', '⌈m/2⌉−1 ～ m−1 = ' + minKeys(m) + ' ～ ' + (m - 1)],
      ['子節點數', '⌈m/2⌉ ～ m = ' + Math.ceil(m / 2) + ' ～ ' + m + '（根 2 ～ m）'],
      ['樹高', String(height(BT.root))],
      ['key 總數', String(countKeys(BT.root))],
    ], BT.mode === 'ins'
      ? 'overflow（key 數 = m）→ 分裂：第 ⌈m/2⌉ 個 key 往上<br>所有葉節點永遠在同一層'
      : 'underflow（key 數 &lt; ⌈m/2⌉−1）→ 先借（右 → 左），借不到就合併<br>' + (BT.last ? '剛才：' + BT.last : ''));
  }
  async function drive(gen, render, tok, ms = 1000) {
    for (const st of gen) {
      if (st.warn) { log(st.warn, true); say(st.warn, ''); return false; }
      render(st);
      log(st.cap.replace(/<[^>]+>/g, '') + (st.f ? '（' + st.f.replace(/<[^>]+>/g, '') + '）' : ''));
      say(st.cap, st.f || '');
      BT.last = st.cap;
      await wait(tok, st.ms || ms);
    }
    return true;
  }
  // 刪除示範用的樹（直接建好，讓「借」「合併」「內部 key」三種情況都碰得到）
  const T = (keys, ...kids) => ({ keys, kids });
  const DEL_DEMO = {
    3: () => T([40], T([20], T([10]), T([30])), T([60], T([50]), T([70, 80]))),
    4: () => T([30, 60], T([10, 20]), T([40]), T([70, 80, 90])),
    5: () => T([30, 60], T([10, 20]), T([40, 50]), T([70, 80, 90])),
  };
  const BT_DEMO = { 3: [10, 20, 30, 40, 50, 60, 70, 80, 90], 4: [5, 15, 25, 35, 45, 55, 65, 75, 85, 95], 5: [3, 7, 12, 18, 25, 31, 38, 44, 50, 57, 62, 70] };
  function enterBTree(kind) {
    epoch++; busy = false;
    clearInterval(timer);
    lab.clear();
    BT.mode = kind;
    BT.view = makeView();
    BT.view.ring = makeRing();
    BT.last = '';
    lab.frameCamera([0, 5.2, 14.5], [0, 2.6, 0]);
    const mSel = '<label>m = <select id="btM"><option>3</option><option>4</option><option>5</option></select></label>';
    if (kind === 'ins') {
      controls(mSel + '<input id="btK" type="number" min="1" max="99" value="35" style="width:70px">'
        + '<button class="primary" id="btIns">插入</button><button id="btRnd">隨機插入</button><button id="btSeq">依序插入 10,20,…</button><button id="btReset">清空</button>');
      BT.root = null;
      on('btIns', () => run(() => btDoInsert(Number($('btK').value))));
      on('btRnd', () => run(() => { let k; let guard = 0; do { k = randInt(1, 99); } while (hasKey(BT.root, k) && ++guard < 200); return btDoInsert(k); }));
      on('btSeq', () => run(async () => { BT.root = null; btRender(); for (const k of BT_DEMO[BT.m].slice(0, 9)) await btDoInsert(k); }));
      on('btReset', () => { BT.root = null; clearLog(); enterBTree('ins'); });
      log('order m 的 B-tree：每個節點最多 m−1 個 key。插入一律先放進葉節點，滿了（m 個）才分裂。');
    } else {
      controls(mSel + '<input id="btK" type="number" min="1" max="99" value="50" style="width:70px">'
        + '<button class="primary" id="btDel">刪除</button><button id="btReset">重建範例樹</button>');
      BT.root = DEL_DEMO[BT.m]();
      on('btDel', () => run(() => btDoDelete(Number($('btK').value))));
      on('btReset', () => { clearLog(); enterBTree('del'); });
      log('刪除：key 在內部節點就先用左子樹最大值換下來，最後一定變成「從葉節點刪」。');
      log('葉節點太少（underflow）：先向右兄弟借，再向左兄弟借，都借不到就合併。');
    }
    $('btM').value = String(BT.m);
    $('btM').onchange = (e) => { BT.m = Number(e.target.value); clearLog(); enterBTree(kind); };
    btRender();
  }
  function hasKey(n, k) { return !!n && (n.keys.includes(k) || n.kids.some((c) => hasKey(c, k))); }
  async function btDoInsert(k, tok) {
    if (!Number.isFinite(k) || k < 1 || k > 99) { log('請輸入 1～99 的整數。', true); return; }
    if (countKeys(BT.root) >= 18) { log('畫面放不下更多 key 了（上限 18 個），先按「清空」。', true); return; }
    log('── 插入 ' + k + ' ──');
    await drive(btInsert(k), btRender, tok);
  }
  async function btDoDelete(k, tok) {
    if (!Number.isFinite(k)) { log('請輸入要刪的 key。', true); return; }
    log('── 刪除 ' + k + ' ──');
    await drive(btDelete(k), btRender, tok);
  }

  // ───────────────────────── B+ Tree ─────────────────────────
  const BP = { m: 3, root: null, view: null, hl: new Set() };
  const bpId = (n, k) => (isLeaf(n) ? 'L' : 'I') + k;
  function bpLeaves() { let n = BP.root; if (!n) return []; while (!isLeaf(n)) n = n.kids[0]; const out = []; while (n) { out.push(n); n = n.next; } return out; }
  function* bpInsert(k) {
    const m = BP.m;
    if (!BP.root) { BP.root = { keys: [k], kids: [], next: null }; yield { cap: '空樹：' + k + ' 放進唯一的葉節點', f: '' }; return; }
    let n = BP.root;
    const path = [];
    while (!isLeaf(n)) {
      path.push(n);
      let i = 0;
      while (i < n.keys.length && k >= n.keys[i]) i++;
      yield { cap: '索引層：比較 [' + n.keys.join(', ') + ']', f: '≥ 分隔值往右走', ring: n, ms: 600 };
      n = n.kids[i];
    }
    if (n.keys.includes(k)) { yield { warn: k + ' 已經在葉節點裡了。' }; return; }
    let i = 0;
    while (i < n.keys.length && k > n.keys[i]) i++;
    n.keys.splice(i, 0, k);
    yield { cap: '把 ' + k + ' 放進葉節點', f: n.keys.length > m - 1 ? '<span class="no">overflow</span>' : '所有資料都在葉節點', ring: n };
    if (n.keys.length <= m - 1) return;
    // leaf split: copy up
    const half = Math.floor(m / 2);
    const right = { keys: n.keys.slice(half), kids: [], next: n.next };
    n.keys = n.keys.slice(0, half);
    n.next = right;
    let up = right.keys[0];
    let parent = path.pop();
    if (!parent) { BP.root = { keys: [up], kids: [n, right] }; parent = BP.root; }
    else { const ci = parent.kids.indexOf(n); parent.kids.splice(ci + 1, 0, right); parent.keys.splice(ci, 0, up); }
    yield { cap: '葉節點分裂：' + up + ' 複製一份到上層', f: '葉子裡還留著 ' + up + '，葉節點用 link 串起來', copy: up, ring: parent, ms: 1500 };
    n = parent;
    while (n.keys.length > m - 1) {
      const mid = Math.ceil(m / 2) - 1;
      up = n.keys[mid];
      const r2 = { keys: n.keys.slice(mid + 1), kids: n.kids.slice(mid + 1) };
      n.keys = n.keys.slice(0, mid);
      n.kids = n.kids.slice(0, mid + 1);
      const p2 = path.pop();
      if (!p2) { BP.root = { keys: [up], kids: [n, r2] }; }
      else { const ci = p2.kids.indexOf(n); p2.kids.splice(ci + 1, 0, r2); p2.keys.splice(ci, 0, up); }
      yield { cap: '索引節點分裂：' + up + ' 是「移」上去', f: '內部節點分裂跟 B-tree 一樣，不留副本', ring: p2 || BP.root, ms: 1500 };
      if (!p2) break;
      n = p2;
    }
  }
  function* bpRange(lo, hi) {
    if (!BP.root) { yield { warn: '樹是空的。' }; return; }
    BP.hl.clear();
    let n = BP.root, steps = 0;
    while (!isLeaf(n)) {
      let i = 0;
      while (i < n.keys.length && lo >= n.keys[i]) i++;
      yield { cap: '從根往下找 ' + lo + '：比較 [' + n.keys.join(', ') + ']', f: '只走一條路到葉子', ring: n, ms: 900 };
      n = n.kids[i];
    }
    const found = [];
    let leaves = 0;
    while (n) {
      leaves++;
      yield { cap: leaves === 1 ? '到達起點葉節點' : '沿著 link 走到下一個葉子', f: '已找到：' + (found.join(', ') || '—'), ring: n, ms: 800 };
      for (const k of n.keys) {
        steps++;
        if (k > hi) { yield { cap: k + ' > ' + hi + '：超出範圍，停', f: '範圍 [' + lo + ', ' + hi + '] 共 ' + found.length + ' 個：' + (found.join(', ') || '無') + '，走了 ' + leaves + ' 個葉子', ring: n, done: true, ms: 2200 }; return; }
        if (k >= lo) { found.push(k); BP.hl.add('L' + k); yield { cap: k + ' 在範圍內', f: '已找到：' + found.join(', '), ring: n, ms: 550 }; }
      }
      n = n.next;
    }
    yield { cap: '走到最後一個葉子', f: '範圍 [' + lo + ', ' + hi + '] 共 ' + found.length + ' 個：' + (found.join(', ') || '無'), done: true, ms: 2200 };
  }
  function bpRender(st = {}) {
    const leafSet = new Set(bpLeaves());
    const pos = renderTree(BP.view, BP.root, {
      m: BP.m, plus: true, minLeaf: Math.floor(BP.m / 2),
      ids: (n, k) => (leafSet.has(n) ? 'L' : 'I') + k,
      leafColor: (k) => colorFor(k),
      spawnFrom: (id) => { if (id[0] !== 'I') return null; const b = BP.view.bodies.get('L' + id.slice(1)); return b ? b.obj.position.clone() : null; },
    });
    // internal (index) keys look different: muted
    for (const [id, b] of BP.view.bodies) {
      if (id[0] === 'I') b.obj.traverse((o) => { if (o.material && o.material.color) o.material.color.set('#b9a582'); });
      glow(b.obj, BP.hl.has(id) ? '#1d5a2c' : null);
    }
    const { s } = layoutTree(BP.root);
    if (st.ring) ringAt(BP.view, pos, st.ring, s); else if (BP.view.ring) BP.view.ring.visible = false;
    const leaves = bpLeaves();
    setState('B+ Tree（order m = ' + BP.m + '）', [
      ['葉節點（資料層）', leaves.map((l) => '[' + l.keys.join(',') + ']').join(' → ') || '—'],
      ['樹高', String(height(BP.root))],
      ['索引 key（灰色）', '只負責導航，資料都在葉子'],
    ], '葉子分裂：右半第一個 key <b>複製</b>上去<br>索引分裂：中間 key <b>移</b>上去<br>範圍查詢：找到起點後沿 link 往右走');
  }
  function enterBPlus(seq = [10, 20, 30, 40, 50, 60, 70]) {
    epoch++; busy = false;
    clearInterval(timer);
    lab.clear();
    BP.view = makeView();
    BP.view.ring = makeRing();
    BP.hl = new Set();
    lab.frameCamera([0, 5, 14.5], [0, 2.4, 0]);
    controls('<label>m = <select id="bpM"><option>3</option><option>4</option><option>5</option></select></label>'
      + '<input id="bpK" type="number" min="1" max="99" value="42" style="width:64px"><button class="primary" id="bpIns">插入</button><button id="bpRnd">隨機</button>'
      + '<label>範圍 <input id="bpLo" type="number" value="25" style="width:56px">～<input id="bpHi" type="number" value="60" style="width:56px"></label><button id="bpRange">範圍查詢</button><button id="bpReset">重建</button>');
    $('bpM').value = String(BP.m);
    $('bpM').onchange = (e) => { BP.m = Number(e.target.value); clearLog(); enterBPlus(); };
    on('bpIns', () => run(() => bpDoInsert(Number($('bpK').value))));
    on('bpRnd', () => run(() => { let k; let g = 0; do { k = randInt(1, 99); } while (bpLeaves().some((l) => l.keys.includes(k)) && ++g < 200); return bpDoInsert(k); }));
    on('bpRange', () => run(() => bpDoRange(Number($('bpLo').value), Number($('bpHi').value))));
    on('bpReset', () => { clearLog(); enterBPlus(); });
    bpBuild(seq);
    log('B+ tree：所有資料都在葉節點，上面幾層只是索引；葉節點由左到右用 link 串成一條 list。');
    bpRender();
  }
  function bpBuild(seq) { BP.root = null; for (const k of seq) for (const _ of bpInsert(k)) { /* silent */ } }
  async function bpDoInsert(k, tok) {
    if (!Number.isFinite(k) || k < 1 || k > 99) { log('請輸入 1～99 的整數。', true); return; }
    if (bpLeaves().reduce((s, l) => s + l.keys.length, 0) >= 14) { log('畫面放不下了（上限 14 筆資料），先按「重建」。', true); return; }
    BP.hl.clear();
    log('── 插入 ' + k + ' ──');
    await drive(bpInsert(k), bpRender, tok);
  }
  async function bpDoRange(lo, hi, tok) {
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo > hi) { log('範圍要寫成 小 ～ 大。', true); return; }
    log('── 範圍查詢 [' + lo + ', ' + hi + '] ──');
    await drive(bpRange(lo, hi), bpRender, tok, 800);
  }

  // ───────────────────────── Trie ─────────────────────────
  const TR = { root: null, bodies: new Map(), statics: [], ring: null };
  function trNew(ch, path) { return { ch, path, kids: new Map(), end: false }; }
  function trKids(n) { return [...n.kids.values()].sort((a, b) => (a.ch < b.ch ? -1 : 1)); }
  function trLayout() {
    const pos = new Map();
    const leaves = [];
    (function walk(n, d) { const ks = trKids(n); if (!ks.length) leaves.push(n); ks.forEach((c) => walk(c, d + 1)); })(TR.root, 0);
    const L = leaves.length;
    const sp = L > 1 ? Math.min(1.5, 13 / (L - 1)) : 0;
    let li = 0;
    (function place(n, d) {
      const ks = trKids(n);
      let x;
      if (!ks.length) x = (li++ - (L - 1) / 2) * sp;
      else { ks.forEach((c) => place(c, d + 1)); x = (pos.get(ks[0]).x + pos.get(ks[ks.length - 1]).x) / 2; }
      pos.set(n, V(x, 6.1 - d * 0.82, -1.2 + d * 0.38));
    })(TR.root, 0);
    return pos;
  }
  function trRender(hot = new Set(), cur = null) {
    TR.statics.forEach(drop);
    TR.statics = [];
    const pos = trLayout();
    const alive = new Set();
    pos.forEach((p, n) => {
      alive.add(n.path);
      let b = TR.bodies.get(n.path);
      if (!b) {
        const mesh = lab.box(n.path ? '#4b9ee2' : '#6e5f49', n.path ? [0.6, 0.6, 0.6] : [0.9, 0.45, 0.6]);
        mesh.add(lab.label(n.path ? n.ch : 'root', n.path ? 'val' : 'idx'));
        mesh.position.copy(p).add(V(0, 3, 0));
        b = lab.addBody(mesh);
        TR.bodies.set(n.path, b);
        lab.dropTo(b, p);
      } else lab.springTo(b, p);
      b.obj.traverse((o) => { if (o.material && o.material.color && n.path) o.material.color.set(n.end ? '#c08a1f' : '#4b9ee2'); });
      glow(b.obj, hot.has(n.path) ? '#1d5a2c' : null);
      trKids(n).forEach((c) => TR.statics.push(rod(p.clone().add(V(0, -0.3, 0)), pos.get(c).clone().add(V(0, 0.3, 0)))));
    });
    for (const [k, b] of [...TR.bodies]) if (!alive.has(k)) { TR.bodies.delete(k); lab.flyAway(b); }
    if (cur && pos.get(cur)) { TR.ring.visible = true; TR.ring.position.copy(pos.get(cur)).add(V(0, -0.33, 0)); TR.ring.scale.set(1, 1, 1); }
    else TR.ring.visible = false;
    trState();
  }
  function trWords(n = TR.root, out = []) { if (n.end) out.push(n.path); trKids(n).forEach((c) => trWords(c, out)); return out; }
  function trCount(n = TR.root) { return 1 + trKids(n).reduce((s, c) => s + trCount(c), 0); }
  function trState(extra) {
    const w = trWords();
    setState('Trie（字首樹）', [
      ['單字', w.join(', ') || '—'],
      ['節點數（含 root）', String(trCount())],
      ['金色', '某個單字在這裡結束'],
    ], extra || '搜尋長度 L 的字串：O(L)，跟單字總數無關<br>共同前綴只存一次 → 適合字典、自動完成、前綴查詢');
  }
  function* trInsert(word) {
    let n = TR.root;
    for (let i = 0; i < word.length; i++) {
      const ch = word[i];
      if (n.kids.has(ch)) {
        n = n.kids.get(ch);
        yield { cap: '「' + n.path + '」已經有了：共用前綴', f: '沿著舊節點往下走', cur: n, hot: [n.path], ms: 650 };
      } else {
        const c = trNew(ch, n.path + ch);
        n.kids.set(ch, c);
        n = c;
        yield { cap: '沒有「' + n.path + '」：長出新節點 ' + ch, f: '', cur: n, hot: [n.path], ms: 700 };
      }
    }
    if (n.end) { yield { cap: '「' + word + '」本來就在 Trie 裡', f: '', cur: n }; return; }
    n.end = true;
    yield { cap: '在最後一個字母標記「單字結束」', f: '「' + word + '」插入完成', cur: n, hot: [n.path], ms: 1100 };
  }
  function* trSearch(word, prefix) {
    let n = TR.root;
    const hot = [];
    for (let i = 0; i < word.length; i++) {
      const ch = word[i];
      if (!n.kids.has(ch)) { yield { cap: '「' + n.path + ch + '」不存在 → 找不到', f: '<span class="no">只比了 ' + (i + 1) + ' 個字元就知道答案</span>', cur: n, hot, done: true, ms: 2000 }; return; }
      n = n.kids.get(ch);
      hot.push(n.path);
      yield { cap: '往下走：' + n.path, f: '', cur: n, hot: [...hot], ms: 600 };
    }
    if (prefix) {
      const ws = trWords(n);
      const all = [];
      (function g(x) { all.push(x.path); trKids(x).forEach(g); })(n);
      yield { cap: '前綴「' + word + '」底下的整棵子樹', f: '<span class="ok">' + ws.length + ' 個單字：' + ws.join(', ') + '</span>', cur: n, hot: all, done: true, ms: 2400 };
      return;
    }
    yield n.end
      ? { cap: '走到底而且有結束標記 → 找到「' + word + '」', f: '<span class="ok">比較 ' + word.length + ' 次 = O(L)</span>', cur: n, hot, done: true, ms: 2000 }
      : { cap: '路徑存在，但沒有結束標記', f: '<span class="no">「' + word + '」只是前綴，不是單字</span>', cur: n, hot, done: true, ms: 2200 };
  }
  async function trDrive(gen, tok) {
    for (const st of gen) {
      trRender(new Set(st.hot || []), st.cur);
      log(st.cap + (st.f ? '（' + st.f.replace(/<[^>]+>/g, '') + '）' : ''));
      say(st.cap, st.f || '');
      if (st.done) trState(st.f);
      await wait(tok, st.ms || 900);
    }
  }
  const TRIE_DEMO = ['to', 'tea', 'ted', 'ten', 'i', 'in', 'inn'];
  function cleanWord(s) { return String(s || '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 7); }
  function enterTrie(empty) {
    epoch++; busy = false;
    clearInterval(timer);
    lab.clear();
    TR.bodies = new Map(); TR.statics = []; TR.ring = makeRing();
    TR.root = trNew('', '');
    lab.frameCamera([0, 5.5, 13.5], [0, 3.4, 0]);
    controls('<input id="trW" value="tent" style="width:110px" maxlength="7"><button class="primary" id="trIns">插入</button>'
      + '<button id="trFind">搜尋單字</button><button id="trPre">前綴查詢</button><button id="trReset">重建</button><button id="trEmpty">清空</button>');
    on('trIns', () => run(() => trDoInsert(cleanWord($('trW').value))));
    on('trFind', () => run(() => trDoSearch(cleanWord($('trW').value), false)));
    on('trPre', () => run(() => trDoSearch(cleanWord($('trW').value), true)));
    on('trReset', () => { clearLog(); enterTrie(); });
    on('trEmpty', () => { clearLog(); enterTrie(true); });
    if (!empty) for (const w of TRIE_DEMO) for (const _ of trInsert(w)) { /* silent */ }
    log('Trie：每條邊是一個字母，從 root 走下來的路徑就是字串；金色節點表示「有單字在這裡結束」。');
    trRender();
  }
  async function trDoInsert(w, tok) {
    if (!w) { log('請輸入英文小寫單字（最多 7 個字母）。', true); return; }
    if (trCount() + w.length > 36) { log('畫面放不下更多節點了，先按「清空」或「重建」。', true); return; }
    log('── 插入「' + w + '」──');
    await trDrive(trInsert(w), tok);
  }
  async function trDoSearch(w, prefix, tok) {
    if (!w) { log('請輸入要找的字串。', true); return; }
    log('── ' + (prefix ? '前綴查詢' : '搜尋') + '「' + w + '」──');
    await trDrive(trSearch(w, prefix), tok);
  }

  // ───────────────────────── 文字頁 ─────────────────────────
  function renderCmp(el) {
    el.innerHTML = '<h2>B-Tree、B+ Tree、Trie 對照</h2>'
      + '<p>B-tree 家族是為了<b>磁碟</b>設計的：一個節點 = 一個磁碟區塊，m 越大樹越矮，讀磁碟的次數 ≈ 樹高。</p>'
      + '<table class="lab-table"><thead><tr><th></th><th>B-Tree（order m）</th><th>B+ Tree</th></tr></thead><tbody>'
      + '<tr><th>資料放哪</th><td>每個節點都放資料</td><td>只有葉節點放資料，內部節點只是索引</td></tr>'
      + '<tr><th>重複 key</th><td>每個 key 只出現一次</td><td>索引 key 是葉子裡 key 的副本</td></tr>'
      + '<tr><th>葉節點</th><td>彼此沒連起來</td><td>用 link 串成 linked list</td></tr>'
      + '<tr><th>範圍查詢</th><td>要做 inorder 走訪，上上下下</td><td>找到起點後沿葉子往右走</td></tr>'
      + '<tr><th>分裂</th><td>中間 key「移」上去</td><td>葉子：右半第一個 key「複製」上去；索引：「移」上去</td></tr>'
      + '<tr><th>搜尋</th><td>可能在內部節點就找到</td><td>一定走到葉子（每次成本一樣）</td></tr>'
      + '</tbody></table>'
      + '<h3>order m 的 B-tree 數量關係</h3>'
      + '<table class="lab-table"><tbody>'
      + '<tr><th>每個節點最多</th><td>m 個子節點、m−1 個 key</td></tr>'
      + '<tr><th>非根節點最少</th><td>⌈m/2⌉ 個子節點、⌈m/2⌉−1 個 key</td></tr>'
      + '<tr><th>根最少</th><td>1 個 key；不是葉子時至少 2 個子節點</td></tr>'
      + '<tr><th>高度 h 最多幾個 key</th><td>m<sup>h</sup> − 1</td></tr>'
      + '<tr><th>高度 h 最少幾個 key</th><td>2⌈m/2⌉<sup>h−1</sup> − 1</td></tr>'
      + '</tbody></table>'
      + '<p>2-3 tree = order 3 的 B-tree；2-3-4 tree = order 4 的 B-tree。</p>'
      + '<h3>容易搞混的地方</h3>'
      + '<div class="lab-trap">偶數 m 分裂時「中間」有兩個選擇。本實驗依洪逸／Horowitz：第 ⌈m/2⌉ 個 key 往上（m = 4 時是第 2 個）。考試題目若有指定別的寫法，以題目為準。</div>'
      + '<div class="lab-trap">刪除內部節點的 key，可以用 predecessor（左子樹最大）或 successor（右子樹最小）取代，兩種都對，只是樹形可能不同。本實驗用 predecessor，借的時候先看右兄弟。</div>'
      + '<div class="lab-trap">Trie 的搜尋時間是 O(L)（L = 字串長度），跟存了幾個單字無關；代價是節點多、指標多、很耗空間。</div>';
  }

  // 小測驗：隨機出題
  let qs = { score: 0, total: 0 };
  function rootAfter(seq, m) { const save = [BT.m, BT.root]; btBuild(m, seq); const r = BT.root ? '[' + BT.root.keys.join(', ') + ']' : '[]'; const h = height(BT.root); BT.m = save[0]; BT.root = save[1]; return { r, h }; }
  function uniqueSeq(n) { const s = new Set(); while (s.size < n) s.add(randInt(1, 60)); return [...s]; }
  function genQ() {
    const t = Math.floor(Math.random() * 5);
    if (t === 0 || t === 1) {
      const m = Math.random() < 0.5 ? 3 : 4;
      const seq = uniqueSeq(m === 3 ? 7 : 8);
      const ans = rootAfter(seq, m).r;
      const pool = [rootAfter(seq, m === 3 ? 4 : 3).r, rootAfter(seq.slice(0, -1), m).r, rootAfter(seq.slice(0, -2), m).r, rootAfter([...seq].sort((a, b) => a - b), m).r, '[' + [...seq].sort((a, b) => a - b)[Math.floor(seq.length / 2)] + ']'];
      const opts = [ans];
      for (const p of pool) if (!opts.includes(p) && opts.length < 4) opts.push(p);
      return { q: '依序插入 ' + seq.join(', ') + ' 到空的 order ' + m + ' B-tree（overflow 時第 ⌈m/2⌉ 個 key 往上）。最後根節點的 key 是？', opts, ans,
        why: 'order ' + m + '：節點最多 ' + (m - 1) + ' 個 key，第 ' + m + ' 個進來就分裂，第 ' + Math.ceil(m / 2) + ' 個往上。照順序模擬，根是 ' + ans + '，樹高 ' + rootAfter(seq, m).h + '。可以到「B-Tree 插入」用同一串數字驗證。' };
    }
    if (t === 2) {
      const m = randInt(3, 9);
      const kinds = [
        ['非根節點最少要有幾個 key', Math.ceil(m / 2) - 1, [Math.ceil(m / 2), Math.floor(m / 2), m - 1]],
        ['每個節點最多有幾個 key', m - 1, [m, Math.ceil(m / 2), m + 1]],
        ['非根內部節點最少有幾個子節點', Math.ceil(m / 2), [Math.ceil(m / 2) - 1, 2, m]],
      ];
      const [q, a, ds] = kinds[randInt(0, 2)];
      const opts = [...new Set([a, ...ds])].map(String);
      return { q: 'order m = ' + m + ' 的 B-tree，' + q + '？', opts, ans: String(a), why: '子節點數 ⌈m/2⌉ ～ m，key 數永遠比子節點少 1：⌈' + m + '/2⌉−1 = ' + (Math.ceil(m / 2) - 1) + ' ～ ' + (m - 1) + '。' };
    }
    if (t === 3) {
      const m = randInt(3, 5), h = randInt(2, 3);
      const a = Math.pow(m, h) - 1;
      const opts = [...new Set([a, Math.pow(m, h), Math.pow(m, h + 1) - 1, 2 * Math.pow(Math.ceil(m / 2), h - 1) - 1])].map(String);
      return { q: '高度 ' + h + ' 的 order ' + m + ' B-tree，最多能存幾個 key？', opts, ans: String(a), why: '每個節點都塞滿 m−1 個 key、m 個子節點：(m−1)(1 + m + … + m^(h−1)) = m^h − 1 = ' + a + '。' };
    }
    const bank = ['cat', 'car', 'cart', 'care', 'dog', 'do', 'dot', 'tea', 'ten', 'to', 'in', 'inn'];
    const words = shuffle([...bank]).slice(0, randInt(4, 5));
    const pre = new Set(['']);
    words.forEach((w) => { for (let i = 1; i <= w.length; i++) pre.add(w.slice(0, i)); });
    const a = pre.size;
    const letters = words.reduce((s, w) => s + w.length, 0) + 1;
    const opts = [...new Set([a, letters, a - 1, a + 1])].map(String);
    return { q: '把 ' + words.join('、') + ' 插入空的 Trie，總共有幾個節點（含 root）？', opts, ans: String(a),
      why: '節點數 = 不同前綴的個數 + 1（root）。共同前綴只存一次，所以比字母總數 + 1 = ' + letters + ' 少。' };
  }
  function renderQuiz(el) {
    const p = genQ();
    const opts = [...p.opts].map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
    el.innerHTML = '<h2>小測驗</h2><div class="lab-quiz-score">答對 ' + qs.score + ' / ' + qs.total + '</div>'
      + '<div class="lab-quiz-q" style="white-space:pre-wrap">' + p.q + '</div><div class="lab-quiz-opts">'
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

  // ───────────────────────── 舞台場景 ─────────────────────────
  const scenes = {
    'btree-split': { title: 'B-Tree 插入：滿了就分裂，中間往上', play: async (tok) => {
      BT.m = 3; enterBTree('ins');
      say('order 3 的 B-tree：每個節點最多 2 個 key', '依序插入 10, 20, 30, 40, 50, 60, 70');
      await beat(tok, 2200);
      for (const k of [10, 20, 30, 40, 50, 60, 70]) await btDoInsert(k, tok);
      say('7 個 key、樹高 3：所有葉子都在同一層', 'B-tree 從根長高，不是從葉子往下長');
      await beat(tok, 3000);
    } },
    'btree-order5': { title: 'order 5：塞滿 4 個才分裂', play: async (tok) => {
      BT.m = 5; enterBTree('ins');
      say('m = 5：每個節點最多 4 個 key', '第 5 個進來 → 第 ⌈5/2⌉ = 3 個往上');
      await beat(tok, 2200);
      for (const k of [20, 40, 10, 30, 15, 35, 7, 26, 18, 12]) await btDoInsert(k, tok);
      say('m 越大，節點越胖、樹越矮', '磁碟讀取次數 ≈ 樹高');
      await beat(tok, 3000);
    } },
    'btree-borrow': { title: 'B-Tree 刪除：向兄弟借', play: async (tok) => {
      BT.m = 3; enterBTree('del');
      say('order 3：每個非根節點至少 1 個 key', '刪 50：葉子變空 → underflow');
      await beat(tok, 2200);
      await btDoDelete(50, tok);
      say('兄弟有多的 key，就經過父節點「轉」一個過來', '父節點的 key 下來，兄弟的 key 上去');
      await beat(tok, 3000);
    } },
    'btree-merge': { title: 'B-Tree 刪除：借不到就合併', play: async (tok) => {
      BT.m = 3; enterBTree('del');
      say('刪 10：兄弟只有 1 個 key，借不起', '');
      await beat(tok, 2000);
      await btDoDelete(10, tok);
      say('合併一路往上傳，最後根被拿光、樹高 −1', 'B-tree 只會從根變矮');
      await beat(tok, 3200);
    } },
    'btree-internal-delete': { title: 'B-Tree 刪除內部 key：用 predecessor 取代', play: async (tok) => {
      BT.m = 3; enterBTree('del');
      say('刪 60：它在內部節點', '先換成左子樹最大值 50，再從葉子刪');
      await beat(tok, 2200);
      await btDoDelete(60, tok);
      await beat(tok, 2800);
    } },
    'bplus-copy-up': { title: 'B+ Tree 插入：葉子分裂是「複製」上去', play: async (tok) => {
      BP.m = 3; enterBPlus([]);
      say('B+ tree：資料全部放在葉節點', '依序插入 10, 20, 30, 40, 50');
      await beat(tok, 2000);
      for (const k of [10, 20, 30, 40, 50]) await bpDoInsert(k, tok);
      say('灰色索引 key 是副本；綠色箭頭把葉子串起來', '葉子分裂：複製上去　索引分裂：移上去');
      await beat(tok, 3200);
    } },
    'bplus-range': { title: 'B+ Tree 範圍查詢：沿著葉子走', play: async (tok) => {
      BP.m = 3; enterBPlus();
      say('找 25 ～ 60 之間的所有資料', '');
      await beat(tok, 1800);
      await bpDoRange(25, 60, tok);
      say('只往下走一次，之後沿 link 往右掃', '<span class="ok">B-tree 做不到：資料散在各層</span>');
      await beat(tok, 3000);
    } },
    'trie-prefix': { title: 'Trie：共用前綴與搜尋', play: async (tok) => {
      enterTrie(true);
      say('Trie：一條邊一個字母', '插入 tea, ten, to, inn, in');
      await beat(tok, 1800);
      for (const w of ['tea', 'ten', 'to', 'inn', 'in']) await trDoInsert(w, tok);
      say('「te」只存一次：共用前綴', '');
      await beat(tok, 1800);
      await trDoSearch('ten', false, tok);
      await trDoSearch('te', false, tok);
      await trDoSearch('te', true, tok);
      await beat(tok, 1500);
    } },
  };


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ btree.js ═══
  {
const { V3, fresh, tag, cube, move, kill, glow, tint, txt, anim, line, arrow, ghostBox, GOLD, GREEN, RED, GRAY, step, buddy, prop, bob, travel, remove } = K;
// ─── cued scenes: every `await step(tok)` waits until the lecturer says that sentence ───
// motion between steps is short (≤ ~2.5 s); the picture then holds until the next sentence.
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const bubble = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const pkt = (t, x, y, z = 0) => tag(t, 'pkt', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const setCls = (l, cls) => { l.element.className = 'lab-label ' + cls; };
// 共用：用本章的 B-tree 引擎（BT / renderTree）畫出講者自己的樹
function btShow(m, root, mode) { KB = null; NAMES = []; BT.m = m; enterBTree(mode || 'ins'); BT.root = root; btRender(); }
// 指定「第幾個 key 往上」的插入（講者用的 split 規則不一定是 ⌈m/2⌉）
function* midInsert(k, mid) {
  const m = BT.m;
  if (!BT.root) { BT.root = T([k]); yield { cap: '空樹：' + k + ' 成為根', f: '', newKey: k }; return; }
  let n = BT.root; const path = [];
  for (;;) {
    path.push(n);
    yield { cap: '比較 ' + k + ' 和 [' + n.keys.join(', ') + ']', f: isLeaf(n) ? '到葉節點了' : '往下找位置', ring: n, ms: 600 };
    if (isLeaf(n)) break;
    let i = 0; while (i < n.keys.length && k > n.keys[i]) i++;
    n = n.kids[i];
  }
  let i = 0; while (i < n.keys.length && k > n.keys[i]) i++;
  n.keys.splice(i, 0, k);
  yield { cap: '把 ' + k + ' 放進葉節點', f: n.keys.length > m - 1 ? '<span class="no">' + n.keys.length + ' 個 key → overflow</span>' : 'key 數 ' + n.keys.length + ' ≤ ' + (m - 1), newKey: k, ring: n };
  while (n.keys.length > m - 1) {
    const up = n.keys[mid];
    const left = { keys: n.keys.slice(0, mid), kids: n.kids.slice(0, mid + 1) };
    const right = { keys: n.keys.slice(mid + 1), kids: n.kids.slice(mid + 1) };
    path.pop();
    const parent = path[path.length - 1];
    if (!parent) {
      BT.root = { keys: [up], kids: [left, right] };
      yield { cap: '分裂：' + up + ' 往上成為新根', f: '[' + left.keys.join(',') + '] ← ' + up + ' → [' + right.keys.join(',') + ']，樹高 +1', up, ring: BT.root, ms: 1500 };
      break;
    }
    const ci = parent.kids.indexOf(n);
    parent.kids.splice(ci, 1, left, right);
    parent.keys.splice(ci, 0, up);
    yield { cap: '分裂：' + up + ' 往上送到 parent', f: '[' + left.keys.join(',') + '] ← ' + up + ' → [' + right.keys.join(',') + ']' + (parent.keys.length > m - 1 ? '，<span class="no">parent 也滿了</span>' : ''), up, ring: parent, ms: 1500 };
    n = parent;
  }
}
// ring one node of the current BT tree
function ringN(n) { const { pos, s } = layoutTree(BT.root); ringAt(BT.view, pos, n, s); }
function nodePos(n) { const { pos, s } = layoutTree(BT.root); const p = pos.get(n); return { x: p.x, y: p.y, w: Math.max(1, n.keys.length) * KW * s }; }
// a little helper character that carries the key being inserted
let KB = null;
function courier(x = -5.9, z = 2.6) { KB = buddy('新 key', '', '#f3d36b', x, 0, z, 0.7); return KB; }
// cued insert: one step when the lecturer names the key (walk down + place);
// o.place / o.split: true → that moment waits for its own sentence, a function → custom steps first
async function cIns(tok, k, o = {}) {
  if (o.step !== false) await step(tok);
  if (KB) { KB.set(k); KB.mood('calm'); }
  const gen = o.mid !== undefined ? midInsert(k, o.mid) : btInsert(k);
  for (const st of gen) {
    if (st.warn) { say(st.warn, ''); return; }
    if (st.newKey !== undefined && o.place) await (o.place === true ? step(tok) : o.place(st));
    if (st.up !== undefined && o.split) await (o.split === true ? step(tok) : o.split(st));
    btRender(st); say(st.cap, st.f || '');
    if (st.newKey !== undefined && KB) {
      const over = /overflow/.test(st.f || '');
      KB.mood(over ? 'wow' : 'happy'); if (!over) KB.set('');
      await KB.hop(tok);
    } else if (st.up !== undefined && KB) { KB.mood('happy'); KB.set(''); }
    await beat(tok, st.up !== undefined ? 1100 : st.newKey !== undefined ? 450 : 380);
  }
}
// cued delete: one step to start; o.fix waits before the borrow / merge
async function cDel(tok, k, o = {}) {
  if (o.step !== false) await step(tok);
  for (const st of btDelete(k)) {
    if (st.warn) { say(st.warn, ''); return; }
    const fix = /借|合併/.test(st.cap);
    if (fix && o.fix) await (o.fix === true ? step(tok) : o.fix(st));
    btRender(st); say(st.cap, st.f || ''); BT.last = st.cap;
    await beat(tok, fix ? 1200 : 420);
  }
}
// cued search: one step, then walk down
async function cFind(tok, k) {
  await step(tok);
  for (const st of findKey(k)) { btRender(st); say(st.cap, st.f || ''); await beat(tok, 650); }
}
// 一般搜尋（只亮出走過的節點）
function* findKey(k) {
  let n = BT.root;
  while (n) {
    if (n.keys.includes(k)) { yield { cap: '[' + n.keys.join(', ') + '] 裡有 ' + k, f: '<span class="ok">x 等於某個 key → 找到</span>', ring: n, ms: 1600 }; return; }
    let i = 0; while (i < n.keys.length && k > n.keys[i]) i++;
    const why = i === 0 ? k + ' < ' + n.keys[0] + ' → 最左邊 pointer' : i === n.keys.length ? k + ' > ' + n.keys[i - 1] + ' → 最右邊 pointer' : n.keys[i - 1] + ' < ' + k + ' < ' + n.keys[i] + ' → 中間 pointer';
    yield { cap: '比較 ' + k + ' 和 [' + n.keys.join(', ') + ']', f: isLeaf(n) ? '<span class="no">葉節點也沒有 → 找不到</span>' : why, ring: n, ms: 1300 };
    n = isLeaf(n) ? null : n.kids[i];
  }
}
// name tags beside nodes (A, B, C …); call again after the tree changes
let NAMES = [];
function nameNodes(pairs) {
  NAMES.forEach(kill); NAMES = [];
  for (const [n, name] of pairs) { if (!n) continue; const p = nodePos(n); NAMES.push(tag(name, 'ptr', p.x - p.w / 2 - 0.45, p.y + 0.1)); }
}
// B+ tree（Ramakrishnan 的 order d）畫法：葉子串 link、索引 key 灰色、葉子下面的 * 是 data pointer
function bpTree(root) {
  const leaves = []; (function w(n) { if (isLeaf(n)) leaves.push(n); else n.kids.forEach(w); })(root);
  leaves.forEach((l, i) => { l.next = leaves[i + 1] || null; });
  return leaves;
}
function bpView(root, d, m) {
  const v = { bodies: new Map(), statics: [], ring: null };
  v.ring = makeRing();
  const leaves = bpTree(root);
  const pos = renderTree(v, root, { m: m || 2 * d + 1, plus: true, minLeaf: m ? 1 : d, ids: (n, k) => (isLeaf(n) ? 'L' : 'I') + k, leafColor: (k) => colorFor(k) });
  for (const [id, b] of v.bodies) if (id[0] === 'I') b.obj.material.color.set('#b9a582');
  const { s } = layoutTree(root);
  v.pos = pos; v.s = s; v.leaves = leaves;
  v.links = v.statics.filter((o) => o.isObject3D && o.type === 'ArrowHelper');
  return v;
}
function bpStars(v, back) {
  const out = [];
  v.leaves.forEach((l) => {
    const p = v.pos.get(l);
    l.keys.forEach((k, i) => out.push(tag(k + '*', 'idx', keyX(p, i, l.keys.length, v.s), p.y - 0.75, 0.3)));
    if (back && l.next) { const q = v.pos.get(l.next); out.push(arrow(V3(q.x - (l.next.keys.length * KW * v.s) / 2 - 0.04, q.y - 0.5, 0.55), V3(p.x + (l.keys.length * KW * v.s) / 2 + 0.04, p.y - 0.5, 0.55), 0x4b9ee2)); }
  });
  return out;
}
const bpRing = (v, n) => ringAt(v, v.pos, n, v.s);
const bpLit = (v, ids) => { for (const [id, b] of v.bodies) if (id[0] === 'L') b.obj.material.emissive = new THREE.Color(ids.has(id) ? '#1d5a2c' : '#000000'); };
const RK1 = () => T([40], T([20, 33], T([10, 15]), T([20, 27]), T([33, 37])), T([51, 63], T([40, 46]), T([51, 55]), T([63, 97])));
const RK2 = () => T([13, 17, 24, 30], T([2, 3, 5, 7]), T([14, 16]), T([19, 20, 22]), T([24, 27, 29]), T([33, 34, 38, 39]));
function bpDescend(root, k) {
  const path = []; let n = root;
  while (!isLeaf(n)) { path.push(n); let i = 0; while (i < n.keys.length && k >= n.keys[i]) i++; n = n.kids[i]; }
  path.push(n); return path;
}
// show one node of a B+ tree walk (ring + caption)
function bpAt(v, n, k) {
  bpRing(v, n);
  if (isLeaf(n)) { say('到葉節點 [' + n.keys.join(', ') + ']', n.keys.includes(k) ? '<span class="ok">有 ' + k + ' → hit，跟著 ' + k + '* 去拿 record</span>' : '<span class="no">沒有 ' + k + ' → 找不到</span>'); return; }
  let i = 0; while (i < n.keys.length && k >= n.keys[i]) i++;
  say('比較 ' + k + ' 和 [' + n.keys.join(', ') + ']', i === 0 ? k + ' < ' + n.keys[0] + ' → 最左邊 pointer' : i === n.keys.length ? k + ' ≥ ' + n.keys[i - 1] + ' → 最右邊 pointer' : n.keys[i - 1] + ' ≤ ' + k + ' < ' + n.keys[i] + ' → 第 ' + (i + 1) + ' 個 pointer');
}
async function bpWalk(tok, v, root, k, ms = 650) {
  const path = bpDescend(root, k);
  for (const n of path) { bpAt(v, n, k); await beat(tok, ms); }
  return path[path.length - 1];
}

// ─── IilVRpUsAiQ：B-Tree Insertion（order 4，keys 5 3 21 9 1 13 2 7 10 12 4）───
const HI = [5, 3, 21, 9, 1, 13, 2, 7, 10, 12, 4];
function hiPre(n) { BT.m = 4; BT.root = null; for (const k of HI.slice(0, n)) for (const _ of btInsert(k)) { /* silent */ } return BT.root; }
// the lecturer's key list across the top; keys already inserted turn blue
function hiRow(done, y = 5.6) { return HI.map((k, i) => tag(String(k), i < done ? 'idx' : 'note', -4.5 + i * 0.9, y)); }
FRAG.push(['btree-hi-rules', 'order 4 的 B-tree：最多 3 個 key、至少 1 個', async (tok) => {
  fresh([0, 5, 12], [0, 1.6, 0]);
  await step(tok);                                   // 0:05 要把這些 key 插進 B-tree
  hiRow(0, 4.7);
  const kb = buddy('新 key', '?', '#f3d36b', -5.4, 0, 2.2, 0.75);
  say('要把這串 key 依序插進 B-tree', '先看 B-tree 的規則');
  await step(tok);                                   // 0:13 先給 order
  const om = pkt('order m = ?', 0, 3.6);
  say('題目會先給 order m', 'm-way search tree：一個 node 最多 m 個 child');
  await step(tok);                                   // 0:23 m = 4
  txt(om, 'm = 4：4-way search tree');
  const ptrs = [], keys = [];
  for (let i = 0; i < 4; i++) ptrs.push(cube('', '#d8c29b', [0.4, 0.7, 1], -3.15 + i * 2.1, 2, 0));
  for (let i = 0; i < 3; i++) keys.push(cube('', GRAY, [1.5, 0.7, 1], -2.1 + i * 2.1, 2, 0));
  say('m = 4：一個 node 最多 4 個 child', '4 個 pointer（米色）夾著 key 的位置（灰色）');
  await step(tok);                                   // 0:28 最多 m − 1 個 key
  keys.forEach((k, i) => { tint(k, '#4b9ee2'); tag('key ' + (i + 1), 'idx', -2.1 + i * 2.1, 1.1); });
  say('每個 node 最多 m − 1 = 3 個 key', '');
  await step(tok);                                   // 0:45 多出來就 split
  const extra = cube('第 4 個', '#f0a8a8', [1.3, 0.7, 1], 5.3, 3.4, 0);
  await anim(tok, 900, (t) => extra.position.set(5.3 - t * 0.6, 3.4 - t * 0.7, 0));
  kb.mood('wow');
  const sp = bad('塞不下 → split', 4.6, 1.2);
  say('第 4 個 key 進來就放不下', '多出來就要把 node 拆開（split）');
  await step(tok);                                   // 1:01 至少 ⌈m/2⌉ 個 child
  kill(extra); kill(sp); kb.mood('calm');
  ptrs.forEach((p, i) => glow(p, i < 2 ? GOLD : null));
  say('internal node 至少 ⌈m/2⌉ 個 child', '⌈4/2⌉ = 2 個 child');
  await step(tok);                                   // 1:24 至少 1 個 key
  ptrs.forEach((p, i) => { if (i > 1) tint(p, GRAY); glow(p, null); });
  keys.forEach((k, i) => { if (i > 0) tint(k, GRAY); });
  glow(keys[0], GOLD);
  good('每個 node：1 ～ 3 個 key', 0, 0.3);
  say('2 個 child 中間要夾 1 個 key', 'order 4：每個 node 1 ～ 3 個 key');
  await step(tok);                                   // 1:50 插入跟 BST 很像
  kb.mood('happy'); await kb.hop(tok);
  say('插入跟 binary search tree 一樣：比大小找位置', '只是 node 裡的 key 要保持排好序');
}]);
FRAG.push(['btree-hi-split5', '插入 5 3 21，再插 9 第一次分裂', async (tok) => {
  fresh([0, 5.2, 14.5], [0, 2.6, 0]);
  btShow(4, null); courier();
  await step(tok);                                   // 1:56 例子
  const row = hiRow(0);
  say('例子：order 4，依序插入這 11 個 key', '一個 node 最多放 3 個 key');
  await cIns(tok, 5); setCls(row[0], 'idx');         // 2:11 第一個是 5
  await cIns(tok, 3); setCls(row[1], 'idx');         // 2:19 3 放到 5 前面
  await cIns(tok, 21); setCls(row[2], 'idx');        // 2:35 21，node 滿了
  let ch = [];
  await cIns(tok, 9, { split: async () => {          // 2:43 9 沒位置
    await step(tok);                                 // 2:49 兩個中間值可選
    ch = [bubble('5 往上？', -2.2, 3.6), bubble('9 往上？', 2.2, 3.6)];
    say('3, 5, 9, 21：偶數個，中間有兩個', '選 5 或 9 往上都可以 → left / right biased');
    await step(tok);                                 // 3:19 老師讓 5 往上
    ch.forEach(kill); setCls(row[3], 'idx');
  } });
  await step(tok);                                   // 3:33 右邊是 9, 21
  ringN(BT.root.kids[1]);
  say('5 的左邊 [3]、右邊 [9, 21]', '送第 2 個 key 上去：左半 1 個 key，右半 2 個');
}]);
FRAG.push(['btree-hi-split9', '插入 1 13 2 7：9 往上', async (tok) => {
  fresh([0, 5.2, 14.5], [0, 2.6, 0]);
  btShow(4, hiPre(4)); courier();
  const row = hiRow(4);
  await step(tok);                                   // 3:41 下一個要插入的是…
  ringN(BT.root);
  say('目前：root 5，左 [3]，右 [9, 21]', '接著插入 1, 13, 2, 7');
  await cIns(tok, 1); setCls(row[4], 'idx');         // 3:46
  await cIns(tok, 13); setCls(row[5], 'idx');        // 3:50
  await cIns(tok, 2); setCls(row[6], 'idx');         // 4:00
  await cIns(tok, 7, { split: true });               // 4:11 7 比 5 大 → 右邊，overflow；4:30 9 往上
  setCls(row[7], 'idx');
  await step(tok);                                   // 4:45 重畫
  ringN(BT.root);
  say('重畫：root [5, 9]，三個 child', 'leaf：[1, 2, 3]、[7]、[13, 21]');
}]);
FRAG.push(['btree-hi-split12', '插入 10 12：12 往上', async (tok) => {
  fresh([0, 5.2, 14.5], [0, 2.6, 0]);
  btShow(4, hiPre(8)); courier();
  const row = hiRow(8);
  await step(tok);                                   // 4:50 接著是 10
  KB.set(10);
  say('下一個是 10', '10 要插在哪？');
  await cIns(tok, 10); setCls(row[8], 'idx');        // 4:55 9 < 10 < 13
  await step(tok);                                   // 5:00 這個 node 滿了
  const leaf = BT.root.kids[2]; ringN(leaf);
  const p = nodePos(leaf); const full = bad('滿了', p.x, p.y + 0.9);
  say('[10, 13, 21]：這個 node 已經滿了', '再來一個就要 split');
  await cIns(tok, 12, { split: true });              // 5:04 12 也插進來 → overflow；5:10 12 送到 root
  kill(full); setCls(row[9], 'idx');
  await step(tok);                                   // 5:16 左 10、右 13, 21
  ringN(BT.root);
  say('12 的左邊 [10]、右邊 [13, 21]', 'root 變成 [5, 9, 12]：又滿了');
}]);
FRAG.push(['btree-hi-cascade', '插入 4：連續分裂，5 成為新根', async (tok) => {
  fresh([0, 5.2, 14.5], [0, 2.6, 0]);
  btShow(4, hiPre(10)); courier();
  const row = hiRow(10);
  let warn = null;
  await cIns(tok, 4, {                               // 5:20 4 < 5、4 > 3
    place: true,                                     // 5:30 1, 2, 3, 4 → 又要 split
    split: async (st) => {
      if (st.up === 5) {
        await step(tok);                             // 5:43 parent 也滿了
        warn = bad('parent 也滿了', 3.6, 4.6);
        say('[2, 5, 9, 12]：parent 有 4 個 key', '還要再 split 一次');
        await step(tok);                             // 5:52 5 往上送
        kill(warn);
      } else await step(tok);                        // 5:36 2 上去 parent
    },
  });
  setCls(row[10], 'idx');
  await step(tok);                                   // 5:56 重畫：5 上到 parent
  ringN(BT.root);
  say('5 成為新的 root', '分裂兩次，樹高 +1');
  await step(tok);                                   // 6:04 5 的左邊是 2
  ringN(BT.root.kids[0]);
  say('5 的左邊 [2]：2 的左 [1]、右 [3, 4]', '');
  await step(tok);                                   // 6:14 5 的右邊 9, 12
  ringN(BT.root.kids[1]);
  say('5 的右邊 [9, 12]', '原本的 child 跟著接上去');
  await step(tok);                                   // 6:18 9 的左 7、右 10
  ringN(BT.root.kids[1].kids[1]);
  say('[9, 12] 底下：[7] | [10] | [13, 21]', '[10] 夾在 9 和 12 之間');
  await step(tok);                                   // 6:22 完成
  if (BT.view.ring) BT.view.ring.visible = false;
  KB.mood('happy'); await KB.hop(tok);
  good('所有 leaf 在同一層', 4.2, 0.0, 1.0);
  say('order 4 的 B-tree 完成', '下一堂課：deletion');
}]);

// ─── aZjYr87r1b8：Abdul Bari B Trees and B+ Trees ───
function circle(r, y, color, parent, seg = 64) {
  const pts = []; for (let i = 0; i <= seg; i++) { const a = (i / seg) * Math.PI * 2; pts.push(V3(Math.cos(a) * r, y, Math.sin(a) * r)); }
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color })); (parent || lab.world).add(l); return l;
}
function seg3(a, b, color, parent) { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color })); (parent || lab.world).add(l); return l; }
FRAG.push(['btree-ab-disk', 'Disk：track、sector、block、offset', async (tok) => {
  fresh([0, 10, 7.5], [0, 0, 0.4]);
  await step(tok);                                   // 1:22 先看 disk 結構
  const hd = prop('disk', -5.6, 0, -2.6, 1.3, '硬碟'); bob(hd, 0.05);
  const pg = new THREE.Group(); lab.world.add(pg);   // the platter and everything drawn on it (turns together)
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 0.1, 48), new THREE.MeshStandardMaterial({ color: '#e8dcc4' }));
  plate.position.y = -0.06; pg.add(plate);
  say('先看 disk 的結構', '它像一張圓盤（platter）');
  await step(tok);                                   // 1:31 同心圓
  const R = [1.2, 1.9, 2.6, 3.3];
  R.forEach((r) => circle(r + 0.35, 0.01, '#8a7a60', pg)); circle(0.85, 0.01, '#8a7a60', pg);
  say('盤面上劃出一圈圈同心圓', '這些圓是邏輯上的，不是真的刻上去');
  await step(tok);                                   // 1:37 這些圓叫 track
  R.forEach((r, i) => pg.add(tag('track ' + i, 'idx', r, 0.1, 0.25)));
  say('每一圈叫 track（磁軌）', 'track 0、1、2、3');
  await step(tok);                                   // 1:43 扇形叫 sector
  for (let s = 0; s < 6; s++) { const a = (s / 6) * Math.PI * 2; seg3(V3(Math.cos(a) * 0.85, 0.01, Math.sin(a) * 0.85), V3(Math.cos(a) * 3.65, 0.01, Math.sin(a) * 3.65), '#8a7a60', pg); }
  say('再切成一塊塊扇形：sector（磁區）', '');
  await step(tok);                                   // 1:51 sector 0 ～ 5
  for (let s = 0; s < 6; s++) { const b = (s / 6) * Math.PI * 2 + Math.PI / 6; pg.add(tag('sector ' + s, 'idx', Math.cos(b) * 4.2, 0.1, Math.sin(b) * 4.2)); }
  say('sector 0 ～ 5', '整張 disk 被切成 track × sector 的格子');
  await step(tok);                                   // 2:08 交會的一格 = block
  const a0 = Math.PI / 6, r1 = 1.9;
  const blk = cube('', '#f0a030', [0.7, 0.18, 0.5], Math.cos(a0) * r1, 0.1, Math.sin(a0) * r1); pg.add(blk);
  glow(blk, GOLD);
  say('track 和 sector 交會的一格 = block', '');
  await step(tok);                                   // 2:30 block 位址 = (track, sector)
  glow(blk, null);
  pg.add(note('(track 1, sector 0)', Math.cos(a0) * r1 + 0.4, 0.5, Math.sin(a0) * r1 + 0.6));
  say('block 位址 = (track 編號, sector 編號)', '');
  await step(tok);                                   // 2:46 另一個 block：track 2 sector 1
  const a1 = Math.PI / 2, r2 = 2.6;
  const blk2 = cube('', '#4b9ee2', [0.7, 0.18, 0.5], Math.cos(a1) * r2, 0.1, Math.sin(a1) * r2); pg.add(blk2);
  pg.add(note('(track 2, sector 1)', Math.cos(a1) * r2, 0.5, Math.sin(a1) * r2 + 0.55));
  say('這個 block 是 track 2、sector 1', '每個 block 都用這兩個號碼定位');
  await step(tok);                                   // 2:55 block 512 bytes
  const sz = pkt('1 block = 512 bytes', 4.6, 0.6, -3.2);
  say('block 大小通常假設 512 bytes', '實際大小看廠商，這裡為了好算取 512');
  await step(tok);                                   // 3:14 讀寫一律以 block 為單位
  const car = pkt('整個 block', Math.cos(a0) * r1, 0.6, Math.sin(a0) * r1);
  await travel(tok, car, V3(Math.cos(a0) * r1, 0.6, Math.sin(a0) * r1), V3(-5.6, 1.5, -2.6), 1200);
  remove(car);
  say('從 disk 讀或寫，一次就是一整個 block', '不會只讀 1 個 byte');
  await step(tok);                                   // 3:22 block 裡 byte 0 ～ 511
  const cells = []; for (let i = 0; i < 8; i++) cells.push(cube('', '#f6deb0', [0.5, 0.2, 0.5], -1.75 + i * 0.5, 1.6, 2.8));
  tag('0', 'idx', -1.75, 1.6, 3.4); tag('511', 'idx', 1.75, 1.6, 3.4);
  say('把一個 block 攤開：byte 0 ～ 511', '');
  await step(tok);                                   // 3:32 每個 byte 的位址 = offset
  glow(cells[2], RED); pkt('offset', -0.75, 2.3, 2.8);
  say('block 裡每個 byte 的位置叫 offset', '');
  await step(tok);                                   // 4:09 要知道三樣東西
  note('track + sector + offset', 0, 2.9, 2.8);
  say('找到 disk 上某個 byte', '= track 編號 + sector 編號 + offset');
  await step(tok);                                   // 4:30 主軸和磁頭臂
  const head = cube('head', '#6e5f49', [2.4, 0.15, 0.3], 4.6, 0.5, 0.9);
  kill(sz);
  say('disk 裝在主軸上，旁邊有一支磁頭臂（head）', 'head 負責讀、寫資料');
  await step(tok);                                   // 4:36 轉動盤面 → 換 sector
  await anim(tok, 1800, (t) => { pg.rotation.y = -t * Math.PI / 3; });
  say('轉動盤面 → 換 sector', '');
  await step(tok);                                   // 4:45 移動磁頭臂 → 換 track
  await anim(tok, 1200, (t) => { head.position.x = 4.6 - t * 1.4; });
  say('移動磁頭臂 → 換 track', '轉盤 + 移臂，就能對準任何一個 block');
  await step(tok);                                   // 5:07 資料以 block 為單位存放
  glow(blk, GOLD); glow(blk2, GOLD);
  say('disk 上的資料永遠以 block 為單位存放', '');
}]);
FRAG.push(['btree-ab-ram', 'Disk 的資料要先搬進 RAM', async (tok) => {
  fresh([0, 6, 12], [0, 1.4, 0]);
  await step(tok);                                   // 5:14 main memory（RAM）
  ghostBox('#8a7a60', 4.4, 2.2, 3).position.set(-3.6, 1.1, 0); tag('Disk', 'ptr', -3.6, 2.8);
  const hd = prop('disk', -5.3, 0, 1.0, 0.8); bob(hd, 0.04);
  ghostBox('#4b9ee2', 4.4, 2.2, 3).position.set(3.6, 1.1, 0); tag('Main memory（RAM）', 'ptr alt', 3.6, 2.8);
  const blocks = []; for (let i = 0; i < 6; i++) blocks.push(cube('', '#f0a030', [0.9, 0.5, 0.9], -4.6 + (i % 3) * 1.2, 0.4 + Math.floor(i / 3) * 0.7, -0.6));
  say('這是 main memory，通常叫 RAM', '左邊是 disk，資料放在 block 裡');
  await step(tok);                                   // 5:26 程式在 main memory 執行
  const prog = buddy('程式', '', '#9b7ef4', 4.6, 0, 0.3, 0.8);
  say('程式在 main memory 裡執行', '');
  await step(tok);                                   // 5:33 資料要先搬進 main memory
  glow(blocks[4], GOLD); move(blocks[4], 2.4, 0.4, 0.3); prog.look(-1);
  const t1 = pkt('disk → RAM', -1.6, 2.0);
  await travel(tok, t1, V3(-1.6, 2.0, 0), V3(1.6, 2.0, 0), 1100);
  prog.mood('happy');
  say('要用 disk 上的資料：先把 block 搬進 RAM', '');
  await step(tok);                                   // 5:43 結果再寫回 disk
  remove(t1);
  move(blocks[4], -3.4, 1.1, -0.6); glow(blocks[4], GREEN);
  const t2 = pkt('RAM → disk', 1.6, 2.0);
  await travel(tok, t2, V3(1.6, 2.0, 0), V3(-1.6, 2.0, 0), 1100);
  say('處理完的結果再寫回 disk', '');
  await step(tok);                                   // 5:50 不能直接在 disk 上處理
  remove(t2);
  bad('不能直接在 disk 上處理', -3.6, -0.5, 1.4);
  say('資料不能直接在 disk 上處理', '一定要先搬進 main memory');
  await step(tok);                                   // 6:01 main memory 裡的組織 = data structures
  good('Data Structures', 3.6, -0.5, 1.4); prog.mood('happy');
  say('main memory 裡給程式直接用的資料怎麼組織', '= data structures（資料結構）');
  await step(tok);                                   // 6:17 disk 上有效率地存 = DBMS
  good('DBMS', -1.4, -0.5, 1.4);
  say('disk 上的資料怎麼有效率地存', '= DBMS（資料庫系統）在研究的事');
}]);
function blockGrid(n, cols, x0, z0, dx, dz, color, y = 0.25) {
  const bs = []; for (let i = 0; i < n; i++) bs.push(cube('', color, [dx * 0.8, 0.35, dz * 0.7], x0 + (i % cols) * dx, y, z0 + Math.floor(i / cols) * dz));
  return bs;
}
FRAG.push(['btree-ab-table', '100 筆 record 要 25 個 block', async (tok) => {
  fresh([0, 9, 9], [0, 0, 0.5]);
  await step(tok);                                   // 6:39 範例資料表，100 列
  const tb = cube('employee table（100 rows）', '#e2d3b6', [4.2, 0.3, 1.4], -3.6, 0.15, 2.4);
  say('例子：一張 employee table', '有 100 列（100 筆 record）');
  await step(tok);                                   // 7:08 五個欄位
  const cols = ['eid 10', 'name 50', 'dept 10', 'section 8', 'add 50'];
  cols.forEach((c, i) => cube(c, '#e2d3b6', [1.7, 0.4, 0.7], -4.4 + i * 2.2, 2.6, -3.2));
  say('5 個欄位，數字是各欄位佔幾 bytes', 'eid 10、name 50、dept 10 …');
  await step(tok);                                   // 7:15 一列 128 bytes
  note('一列 = 10 + 50 + 10 + 8 + 50 = 128 bytes', 0, 3.3, -3.2);
  say('每一列（一筆 record）= 128 bytes', '');
  await step(tok);                                   // 7:37 一個 block 能放幾列？
  const q = pkt('512 ÷ 128 = ?', -4.2, 1.6, -1.4);
  say('一個 block 512 bytes，能放幾筆 record？', '');
  await step(tok);                                   // 7:44 = 4
  txt(q, '512 ÷ 128 = 4');
  for (let r = 0; r < 4; r++) cube('', '#4b9ee2', [3.0, 0.22, 0.4], -4.2, 0.2 + r * 0.26, -1.4, 3);
  say('512 / 128 = 4', '一個 block 放 4 筆 record');
  await step(tok);                                   // 8:09 每 4 列放進一個 block
  const bs = blockGrid(25, 5, -1.0, -1.4, 1.3, 0.95, '#f0a030');
  bs.forEach((b, i) => { b.visible = i < 2; });
  say('每 4 列放進一個 block，下一個 4 列放下一個', '');
  await step(tok);                                   // 8:39 100 / 4 = 25
  await anim(tok, 1500, (t) => { const k = Math.floor(t * 25); bs.forEach((b, i) => { b.visible = i <= k; }); });
  note('100 ÷ 4 = 25 blocks', 1.6, 1.0, -2.4);
  say('100 筆 / 4 = 25', '整張表佔 25 個 block');
  await step(tok);                                   // 8:56 找 employee ID = 5
  const who = buddy('查詢', 'eid=5?', '#f3d36b', -5.6, 0, 1.0, 0.75);
  kill(tb);
  say('寫一個 query：找 employee ID = 5 那筆', '它在哪個 block？不知道');
  await step(tok);                                   // 9:09 時間取決於存取幾個 block
  who.mood('wow');
  say('要花多少時間？', '看你要存取幾個 block');
  await step(tok);                                   // 9:22 最多 25 個 block
  await anim(tok, 2400, (t) => { const k = Math.min(24, Math.floor(t * 25)); bs.forEach((b, i) => glow(b, i <= k ? GOLD : null)); });
  who.mood('sad');
  say('record 可能在任何地方：一個 block 一個 block 讀', '最壞要讀 25 個 block');
}]);
FRAG.push(['btree-ab-index', 'Dense index：4 + 1 = 5 次 block 存取', async (tok) => {
  fresh([0, 9, 9.5], [0, 0, 0.4]);
  const tb = blockGrid(25, 5, 0.6, -1.6, 1.3, 0.95, '#f0a030'); tag('table：25 blocks', 'ptr', 3.2, 1.2, -2.6);
  await step(tok);                                   // 9:46 index 存 key 和 pointer
  const ent = []; for (let i = 0; i < 5; i++) ent.push(cube('eid ' + (i + 1), '#9b7ef4', [1.4, 0.3, 0.45], -4.8, 0.2, -2.6 + i * 0.75));
  say('幫這張表建 index', '每個 entry = key（employee ID）+ pointer');
  await step(tok);                                   // 9:55 eid 1 在這、eid 2 在這…
  const ars = [0, 1, 2].map((i) => arrow(V3(-4.1, 0.3, -2.6 + i * 0.75), V3(0.6 + i * 1.3, 0.35, -1.6), 0x6e5f49));
  say('eid 1 在這個 block、eid 2 在那裡…', '每個 entry 都有一根指標指過去');
  await step(tok);                                   // 10:19 record pointer
  ars.forEach((a) => a.setColor(new THREE.Color(0x2fc092)));
  pkt('record pointer', -2.0, 1.2, -1.8);
  say('指向 record 的指標叫 record pointer', '指到 disk 上某個 block 裡那筆 record');
  await step(tok);                                   // 10:26 每筆都有 entry → dense index
  good('每筆 record 一個 entry → dense index', -3.6, 0.7, 1.5);
  say('每一筆 record 在 index 裡都有一個 entry', '這種 index 叫 dense index');
  await step(tok);                                   // 10:34 index 也存在 disk 上
  ent.forEach(kill); ars.forEach(kill);
  const ib = blockGrid(4, 1, -4.6, -1.8, 1.6, 1.0, '#9b7ef4'); ib.forEach((b, i) => { b.visible = i === 0; });
  tag('index 也放在 disk 的 block 裡', 'ptr alt', -4.6, 1.2, -2.6);
  say('index 也存在 disk 上', '一樣佔 block');
  await step(tok);                                   // 10:56 entry 多大？eid 10 bytes
  const sz = note('entry = 10（eid）', -1.6, 1.8, 2.6);
  say('index 要佔多少空間？', 'employee ID 是 10 bytes');
  await step(tok);                                   // 11:11 pointer 6 bytes → 16
  txt(sz, 'entry = 10 + 6 = 16 bytes');
  say('record pointer 假設 6 bytes', '一個 entry = 16 bytes，共 100 個 entry');
  await step(tok);                                   // 11:34 512 / 16 = 32
  const per = note('512 ÷ 16 = 32 entries / block', -1.6, 1.8, 3.4);
  say('512 / 16 = 32', '一個 block 放 32 個 entry');
  await step(tok);                                   // 11:55 100 / 32 = 3.x
  txt(per, '100 ÷ 32 = 3.125');
  say('100 個 entry / 32 = 3.125（老師說約 3.2）', '三個多 block');
  await step(tok);                                   // 12:15 → 4 個 block
  ib.forEach((b) => { b.visible = true; });
  txt(per, '3.x → 進位成 4 blocks');
  say('index 要 4 個 block', '比表的 25 個小很多');
  await step(tok);                                   // 12:24 在 index 裡找：最多 4 個 block
  await anim(tok, 1600, (t) => { const k = Math.floor(t * 4.99); ib.forEach((b, i) => glow(b, i <= k ? GOLD : null)); });
  say('先在 index 裡找', '最多讀 4 個 index block');
  await step(tok);                                   // 12:31 拿位址去讀那 1 個 block
  const a2 = arrow(V3(-3.8, 0.4, 1.2), V3(1.9, 0.4, 0.3), 0x2fc092); glow(tb[12], GREEN);
  say('找到 entry，用它的 pointer 直接讀那 1 個 block', '+ 1');
  await step(tok);                                   // 12:59 4 + 1 = 5
  kill(a2);
  good('4 + 1 = 5 次（不是 25 次）', 1.6, 1.6, 2.2);
  say('存取任何一筆 record：4 + 1 = 5 個 block', '不用看整張表 → 這就是 index 的好處');
}]);
FRAG.push(['btree-ab-multilevel', 'Multi-level index：再蓋一層 sparse index', async (tok) => {
  fresh([0, 6.5, 12], [0, 2.2, 0]);
  await step(tok);                                   // 13:19 index 也一直變大呢？
  const ix0 = []; for (let i = 0; i < 4; i++) ix0.push(cube('', '#9b7ef4', [0.42, 0.4, 0.8], -0.75 + i * 0.5, 2.4, 0));
  say('如果 index 自己也一直變大呢？', '接著講 multi-level index');
  await step(tok);                                   // 13:27 1000 筆 → 250 blocks
  const tb = []; for (let i = 0; i < 25; i++) tb.push(cube('', '#f0a030', [0.42, 0.4, 0.8], -6 + i * 0.5, 0.2, 0, 3));
  tag('table：1000 rows → 250 blocks', 'ptr', 0, 1.0, 1.2);
  say('record 變成 1000 筆', 'table 要 250 個 block');
  await step(tok);                                   // 13:33 index 40 blocks
  ix0.forEach(kill);
  const ix = []; for (let i = 0; i < 20; i++) ix.push(cube('', '#9b7ef4', [0.42, 0.4, 0.8], -4.75 + i * 0.5, 2.4, 0, 3));
  tag('index：1000 entries → 40 blocks', 'ptr alt', 0, 3.2, 1.2);
  say('index 也從 4 個 block 變成 40 個', '（老師直接補一個 0，沒細算）');
  await step(tok);                                   // 13:50 在 index 上再建 index？
  const qq = bubble('index 也太大了…再幫 index 建一個 index？', 0, 5.6);
  say('光在 index 裡找就要很久', '能不能幫 index 再做一層 index？可以');
  await step(tok);                                   // 14:04 不是每個 entry 一筆，是每個 block 一筆
  kill(qq);
  const hi = [cube('1', '#2fc092', [0.9, 0.5, 0.8], -1, 4.6, 0, 3)];
  const a1 = arrow(V3(-1, 4.3, 0), V3(-4.75, 2.7, 0));
  tag('high-level index', 'ptr alt', 0, 5.5, 1.2);
  say('上層不是每個 entry 都放一筆', '而是 index 的每個 block 放一筆');
  await step(tok);                                   // 14:15 一筆管 32 個 entry
  ix.slice(0, 4).forEach((b) => glow(b, GOLD));
  say('一個 index block 有 32 個 entry', '上層一個 entry 就指向這 32 個');
  await step(tok);                                   // 14:22 起始 key 1，下一個 33
  hi.push(cube('33', '#2fc092', [0.9, 0.5, 0.8], 1, 4.6, 0, 3));
  const a2 = arrow(V3(1, 4.3, 0), V3(-2.75, 2.7, 0));
  ix.slice(0, 4).forEach((b) => glow(b, null)); ix.slice(4, 8).forEach((b) => glow(b, GOLD));
  say('第一筆 key 1 → 第一個 block', '下一筆 key 33 → 下一個 block');
  await step(tok);                                   // 14:27 sparse index
  good('不是每筆都有 entry → sparse index', 3.8, 5.0, 0);
  say('這種 index 叫 sparse index', '每個 block 一個 entry，不是每筆 record 一個');
  await step(tok);                                   // 14:53 上層只要 2 個 block
  ix.slice(4, 8).forEach((b) => glow(b, null));
  note('40 ÷ 32 ≈ 1.x → 2 blocks', -4.0, 5.3, 0);
  say('上層有 40 個 entry，一個 block 放 32 個', '→ 只要 2 個 block');
  await step(tok);                                   // 15:12 2 + 1 + 1
  glow(hi[0], GOLD); await beat(tok, 500);
  glow(ix[3], GOLD); await beat(tok, 500);
  glow(tb[7], GOLD);
  say('查詢：上層 2 個 block + index 1 個 + table 1 個', '2 + 1 + 1 = 4 次');
  await step(tok);                                   // 15:31 多加一層，block 存取變少
  kill(a1); kill(a2);
  good('多一層 index → 存取更少 block', 0, 6.0, 0);
  say('多加一層 index，就減少了 block 存取次數', '這就是 B-tree、B+ tree 的出發點');
}]);
FRAG.push(['btree-ab-index-tree', '多層 index 轉過來就是一棵樹', async (tok) => {
  fresh([0, 5.5, 13], [0, 1.6, 0]);
  const g = new THREE.Group(); lab.world.add(g);
  const add = (color, w, x, y) => { const m = lab.box(color, [w, 0.4, 0.8]); m.position.set(x, y, 0); g.add(m); return m; };
  const col = (n, c, x) => { const out = []; for (let i = 0; i < n; i++) out.push(add(c, 0.9, x, (i - (n - 1) / 2) * 0.52 + 1.8)); return out; };
  const links = (from, to, color) => from.forEach((f, i) => {
    const lo = Math.floor((i * to.length) / from.length), hi = Math.max(lo, Math.floor(((i + 1) * to.length) / from.length) - 1);
    for (let j = lo; j <= hi; j++) { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([f.position.clone().add(V3(0.45, 0, 0)), to[j].position.clone().add(V3(-0.45, 0, 0))]), new THREE.LineBasicMaterial({ color })); g.add(l); }
  });
  const tl = [];
  await step(tok);                                   // 15:42 主 index
  const tbl = col(9, '#f0a030', 2), idx = col(3, '#9b7ef4', -1);
  links(idx, tbl, '#6e5f49');
  tl.push(tag('table', 'idx', 2, 4.5), tag('index', 'idx', -1, 4.5));
  say('畫出多層 index：這是主 index', '每個 entry 指向 table 裡的一組 record');
  await step(tok);                                   // 16:02 上面再一層，指向一組 entry
  const top = col(1, '#2fc092', -4);
  links(top, idx, '#2fc092');
  tl.push(tag('high-level', 'idx', -4, 4.5));
  say('index 太大 → 上面再加一層', '每個 entry 指向下一層的一組 entry');
  await step(tok);                                   // 16:19 再加一層
  const top2 = col(1, '#4b9ee2', -6.2);
  links(top2, top, '#4b9ee2');
  say('如果這層也很大，可以再加一層', '');
  await step(tok);                                   // 16:34 table 變大就一層層加
  tbl.forEach((b) => glow(b, GOLD));
  say('table 一直變大，index 就一層一層往上加', '多層 index → block 存取變少');
  await step(tok);                                   // 16:45 轉過來看
  tbl.forEach((b) => glow(b, null)); tl.forEach(kill);
  await anim(tok, 2200, (t) => { g.rotation.z = -t * Math.PI / 2; g.position.set(0, 2.6 * t, 0); });
  tag('root（最上層 index）', 'ptr alt', 1.8, 7.0); tag('最下層指向 table', 'idx', 4.2, -0.4);
  say('把它轉過來看', '就像一棵樹：root 在最上面');
  await step(tok);                                   // 17:20 要手動加 index 嗎？
  const hand = bubble('要一直盯著 table 大小、手動加 index？', -4.2, 6.2);
  say('那多層 index 要手動加嗎？', '');
  await step(tok);                                   // 17:32 自動加、自動刪
  txt(hand, '不要！表變大自動加一層、變小自動拿掉');
  say('希望 high-level index 能自動加入', '也能自動刪除');
  await step(tok);                                   // 17:46 self-managed
  kill(hand);
  good('self-managed multi-level index', -3.6, 6.2);
  say('我們要的是能自我管理的多層 index', 'self-managed multi-level index');
  await step(tok);                                   // 18:01 B-tree、B+ tree 的由來
  pkt('→ B-tree、B+ tree', -3.6, 5.4);
  say('這就是 B-tree、B+ tree 的想法來源', '多層 index 看起來就是一棵樹');
  await step(tok);                                   // 18:14 來自 m-way search tree
  note('它們來自 m-way search tree', 3.6, 5.4);
  say('B-tree、B+ tree 是從 m-way search tree 來的', '接下來先講 m-way search tree');
}]);
FRAG.push(['btree-ab-mway', 'm-way search tree：3-way 例子', async (tok) => {
  fresh([0, 5.2, 14.5], [0, 2.6, 0]);
  await step(tok);                                   // 18:25 回想 BST
  btShow(2, T([10], T([5], T([2]), T([7])), T([20], T([15]), T([30]))));
  say('先回想 binary search tree（BST）', '用來搜尋');
  await step(tok);                                   // 18:31 小往左、大往右
  ringN(BT.root);
  say('從 root 開始：比較小往左', '比較大往右');
  await cFind(tok, 15);                              // 18:45 找 15
  await step(tok);                                   // 18:59 每個 node 1 個 key
  if (BT.view.ring) BT.view.ring.visible = false;
  note('1 個 key', -4.6, 4.8);
  say('BST 每個 node 只有 1 個 key', '');
  await step(tok);                                   // 19:13 最多 2 個 child → binary
  note('最多 2 個 child → binary', -4.6, 4.1);
  say('每個 node 最多 2 個 child', '所以叫 binary');
  await step(tok);                                   // 19:28 能不能放更多 key？[20, 50]
  btShow(3, T([20, 50]));
  say('能不能一個 node 放兩個 key？', '[20, 50]');
  await step(tok);                                   // 19:35 < 20：10, 15
  BT.root.kids.push(T([10, 15])); btRender();
  say('比 20 小的放左邊', '10, 15');
  await step(tok);                                   // 19:42 中間：30, 35
  BT.root.kids.push(T([30, 35])); btRender();
  say('介於 20 和 50 之間的放中間', '30, 35');
  await step(tok);                                   // 19:49 > 50：60, 90
  BT.root.kids.push(T([60, 90])); btRender();
  say('比 50 大的放右邊', '60, 90：這也是一棵 search tree');
  await cFind(tok, 30);                              // 20:11 找 30
  await step(tok);                                   // 20:32 m 是什麼？兩個 key
  if (BT.view.ring) BT.view.ring.visible = false;
  note('2 個 key', 3.6, 4.8);
  say('這個例子：一個 node 2 個 key', '');
  await step(tok);                                   // 20:38 3 個 child → 3-way
  note('最多 3 個 child → 3-way search tree', 3.0, 4.1);
  say('每個 node 最多 3 個 child', '叫 3-way search tree');
  await step(tok);                                   // 20:53 m-way：最多 m 個 child
  bubble('m-way：最多 m 個 child', 0, 5.6);
  say('m-way search tree：每個 node 最多 m 個 child', '');
  await step(tok);                                   // 21:02 m − 1 個 key
  bubble('最多 m − 1 個 key', 0, 5.0);
  say('有 m 個 child，就有 m − 1 個 key', 'm 指的是 degree（child 數）');
  await step(tok);                                   // 21:19 BST = degree 2
  good('BST = degree 2 的 m-way search tree', -3.6, 0.0, 1.2);
  say('BST 就是 degree 2 的 m-way search tree', '');
  await step(tok);                                   // 21:25 degree 100、1000
  note('degree 100 → 99 個 key、100 個 child', 3.6, 0.0, 1.2);
  say('degree 可以是 3、5、100、1000', 'm 越大，一個 node 放越多 key');
}]);
FRAG.push(['btree-ab-node', '4-way 節點：child pointer + key + record pointer', async (tok) => {
  fresh([0, 5, 11], [0, 1.2, 0]);
  await step(tok);                                   // 21:46 BST 的 node：資料 + 2 個 child
  const bn = [cube('', '#d8c29b', [0.6, 0.7, 1], -1.0, 2, 0), cube('data', '#4b9ee2', [1.2, 0.7, 1], 0, 2, 0), cube('', '#d8c29b', [0.6, 0.7, 1], 1.0, 2, 0)];
  const tb = tag('BST 的 node', 'ptr', 0, 3.0);
  say('BST 的 node：中間放資料，兩邊各一個 child pointer', '');
  await step(tok);                                   // 21:59 4-way 的 node
  bn.forEach(kill); kill(tb);
  const t4 = tag('4-way node：4 個 child、3 個 key', 'ptr', 0, 3.2);
  say('m-way 需要更多 child：畫一個 4-way 的 node', '');
  const mk = (i) => { const isP = i % 2 === 0, x = -4.5 + i * 1.5; cube(isP ? 'cp' : 'K' + (i + 1) / 2, isP ? '#d8c29b' : '#4b9ee2', [isP ? 0.7 : 1.2, 0.7, 1], x, 2, 0, 2); };
  await step(tok);                                   // 22:14 child pointer、key 1
  mk(0); mk(1);
  say('cp = child pointer（指向 child）', 'K1 = key 1');
  await step(tok);                                   // 22:23 cp、key 2
  mk(2); mk(3);
  say('再一個 child pointer、key 2', '');
  await step(tok);                                   // 22:29 cp、key 3、cp
  mk(4); mk(5); mk(6);
  say('cp K1 cp K2 cp K3 cp', '4 個 child pointer、3 個 key');
  await step(tok);                                   // 22:40 m − 1 個 key
  for (let i = 0; i < 4; i++) { const x = -4.5 + i * 3; arrow(V3(x, 1.6, 0), V3(x * 1.1, 0.2, 0)); }
  say('m 個 child pointer → 要留 m − 1 個 key 的空間', 'cp 指向下一層的 node');
  await step(tok);                                   // 23:05 能拿來做 index 嗎？
  const q = bubble('拿它來做 index？', 4.4, 3.8);
  say('能不能用這種 node 來建 index？', '');
  await step(tok);                                   // 23:40 每個 key 後面多一個 pointer
  kill(q);
  for (let i = 0; i < 3; i++) { const x = -3 + i * 3; cube('rp', '#2fc092', [0.5, 0.5, 0.6], x + 0.55, 2.5, 0.4, 2); }
  say('每個 key 後面再加一個 pointer', '這是什麼？');
  await step(tok);                                   // 24:01 record pointer
  for (let i = 0; i < 3; i++) { const x = -3 + i * 3; arrow(V3(x + 0.55, 2.3, 0.6), V3(x, 0.5, 2.6), 0x2fc092); cube('record', '#2fc092', [0.9, 0.4, 0.5], x, 0.25, 2.9); }
  say('當 index 用，還要指向 record 的 pointer', '= record pointer（rp）');
  await step(tok);                                   // 24:19 m-way 可以做多層 index
  txt(t4, '4-way node + record pointer');
  say('樹本身就有很多層', '所以 m-way search tree 可以拿來做多層 index');
  await step(tok);                                   // 24:32 記住這個 node 結構
  good('key + child pointer + record pointer', 0, 4.0);
  say('記住這個 node 結構', '4 個 child pointer、3 個 key、3 個 record pointer');
}]);
FRAG.push(['btree-ab-skew', 'm-way search tree 的問題：沒規則可能長成一條線', async (tok) => {
  fresh([0, 5, 13], [0, 2.4, 0]);
  await step(tok);                                   // 24:46 直接用 m-way 會有什麼問題？
  const q = bubble('直接用 m-way search tree 會怎樣？', 0, 5.6);
  say('單純用 m-way search tree 有什麼問題？', '問題的答案 → B-tree');
  await step(tok);                                   // 25:33 10-way
  kill(q);
  note('10-way：10 個 child、9 個 key', 0, 5.6);
  say('拿一棵 10-way search tree', '每個 node 10 個 child、9 個 key');
  const ns = [];
  const put = (i) => {
    const x = -3 + i * 2.6, y = 4.2 - i * 1.6;
    cube('', GRAY, [3.0, 0.5, 0.9], x + 1.5, y, 0);
    ns.push(cube(String((i + 1) * 10), '#4b9ee2', [0.7, 0.6, 0.8], x - 0.4, y + 0.05, 0, 3));
    if (i) line(x - 3.0, y + 1.3, x - 0.4, y + 0.35);
  };
  await step(tok);                                   // 25:41 插入 10
  put(0);
  say('插入 10：建一個 node', '這個 node 還能再放 8 個 key');
  await step(tok);                                   // 25:55 插入 20：另開一個 child
  put(1);
  say('插入 20：不放同一個 node', '卻另開一個新 child');
  await step(tok);                                   // 26:02 插入 30
  put(2);
  say('插入 30：比 10 大往右，比 20 大再往右', '又開一個新 node');
  await step(tok);                                   // 26:16 這樣是錯的
  ns.forEach((n) => glow(n, RED));
  bad('應該先把 node 填滿！', 4.4, 4.4);
  say('這樣不對：應該先把 node 填滿', '再考慮開新的 node');
  await step(tok);                                   // 26:24 m-way 沒有控制
  say('但 m-way search tree 沒有任何規定', '想怎麼插就怎麼插');
  await step(tok);                                   // 26:34 高度 n → linear search
  bad('n 個 key → 高度 n', 4.4, 3.6);
  say('n 個 key 時高度可能是 n', '搜尋退化成 linear search');
  await step(tok);                                   // 26:46 建立過程沒有規範
  say('問題出在：建立過程沒有規範', '');
  await step(tok);                                   // 27:06 規範 = B-tree
  good('建立規則 → B-tree', 4.4, 2.8);
  say('建立時需要一些規則', '這些規則就是 B-tree');
}]);
FRAG.push(['btree-ab-rules', 'B-tree 的四條規則', async (tok) => {
  fresh([0, 5.2, 14.5], [0, 2.6, 0]);
  btShow(4, T([30, 40, 70], T([10, 20]), T([35]), T([50, 60]), T([80])));
  await step(tok);                                   // 27:26 B-tree = 有規則的 m-way
  say('B-tree = 有規則的 m-way search tree', '規則是什麼？');
  await step(tok);                                   // 27:32 規則一：至少 ⌈m/2⌉ 個 child
  note('① 非 root 的內部 node ≥ ⌈m/2⌉ 個 child', -3.9, 5.4);
  say('① 每個 node 至少填一半', 'degree m → 非 root 的 internal node 至少 ⌈m/2⌉ 個 child');
  await step(tok);                                   // 27:43 取 ceiling
  say('m/2 取 ceiling（上取整），不是 floor', '⌈4/2⌉ = 2、⌈5/2⌉ = 3');
  await step(tok);                                   // 27:51 degree 10 → 5 個 child
  say('例如 degree 10：每個這種 node 至少 5 個 child', '是隨時都要滿足的下限（不是建立順序）→ 控制樹高');
  await step(tok);                                   // 28:11 root 呢？
  ringN(BT.root);
  say('② 這條規則能套用在 root 嗎？', '不行，否則連第一個值都插不進去');
  await step(tok);                                   // 28:25 root 至少 2 個 child
  note('② root 至少 2 個 child（可只有 1 個 key）', 3.4, 6.7);
  say('root 至少 2 個 child 就好', 'root 可以只有 1 個 key');
  await step(tok);                                   // 28:53 所有 leaf 在同一層
  if (BT.view.ring) BT.view.ring.visible = false;
  line(-6, 0.15, 6, 0.15, 0.6, '#2fc092');
  note('③ 所有 leaf 在同一層', -3.4, 4.8);
  say('③ 所有 leaf node 都在同一層', '');
  await step(tok);                                   // 29:02 遵守這些 = B-tree
  say('建 m-way search tree 時遵守這些規則', '其實就是在建 B-tree');
  await step(tok);                                   // 29:17 bottom-up
  note('④ 建立過程是 bottom-up', 3.0, 4.8);
  say('④ 建立過程是由下往上（bottom-up）', '樹從 leaf 分裂、往上長');
}]);
const AB = [10, 20, 40, 50, 60, 70, 80, 30, 35, 5, 15];
function abPre(n) { BT.m = 4; BT.root = null; for (const k of AB.slice(0, n)) for (const _ of midInsert(k, 2)) { /* silent */ } return BT.root; }
FRAG.push(['btree-ab-ins1', 'degree 4 插入 10 20 40 50：40 往上', async (tok) => {
  fresh([0, 5.2, 14.5], [0, 2.6, 0]);
  btShow(4, null); courier();
  await step(tok);                                   // 29:50 degree 4：4 個 child、3 個 key
  say('degree 4 的 B-tree：4 個 child、3 個 key', '依序插入 10, 20, 40, 50 …');
  await cIns(tok, 10, { mid: 2 });                   // 30:04 10
  await step(tok);                                   // 30:11 可以有 record pointer
  const rpA = arrow(V3(0, 0.25, 0.45), V3(0, -0.3, 1.8), 0x2fc092), rpT = tag('record pointer', 'idx', 1.4, -0.3, 1.8);
  say('10 底下可以有兩個 child', '當 index 用時，10 還會有一個 record pointer');
  await cIns(tok, 20, { mid: 2 });                   // 30:16 20
  kill(rpA); kill(rpT);
  await cIns(tok, 40, { mid: 2 });                   // 30:20 40
  await cIns(tok, 50, { mid: 2, place: true, split: true }); // 30:24 50；30:30 沒空間；30:36 分裂，40 上去
  await step(tok);                                   // 30:54 左 child、右 child
  ringN(BT.root);
  say('10, 20 是左 child，50 是右 child', '40 送到 root');
  await step(tok);                                   // 31:16 往上長：bottom-up
  KB.mood('happy');
  note('樹往上長 → bottom-up', -4.2, 4.4);
  say('樹是往上長的', '建立過程由下往上');
  await step(tok);                                   // 31:29 第二層 index 自動長出來
  if (BT.view.ring) BT.view.ring.visible = false;
  good('上層 = 自動長出來的第二層 index', 3.8, 4.4);
  say('如果 leaf 是第一層 index', '上面這層就是自動長出來的第二層 index');
}]);
FRAG.push(['btree-ab-ins2', '插入 60 70 80、30 35', async (tok) => {
  fresh([0, 5.2, 14.5], [0, 2.6, 0]);
  btShow(4, abPre(4)); courier();
  await cIns(tok, 60, { mid: 2 });                   // 31:46 60
  await cIns(tok, 70, { mid: 2 });                   // 31:51 70
  await cIns(tok, 80, { mid: 2, split: true });      // 31:54 80 沒空間；31:59 分裂，70 上去
  await cIns(tok, 30, { mid: 2 });                   // 32:19 30
  await cIns(tok, 35, { mid: 2, split: true });      // 32:25 35 沒空間；32:34 分裂
  await step(tok);                                   // 32:52 誰到 root？30
  ringN(BT.root);
  say('30 到 root：root 變 [30, 40, 70]', '下面四個 child');
  await step(tok);                                   // 33:10 node 滿了就 split
  if (BT.view.ring) BT.view.ring.visible = false;
  note('node 滿了 → split，送一個 key 到 parent', 0, 5.4);
  say('每當 node 滿了就分裂', '把其中一個 key 送到 parent');
}]);
FRAG.push(['btree-ab-ins3', '插入 5 15：連續分裂，40 成為新根', async (tok) => {
  fresh([0, 5.2, 14.5], [0, 2.6, 0]);
  btShow(4, abPre(9)); courier();
  await cIns(tok, 5, { mid: 2 });                    // 33:20 5
  await cIns(tok, 15, { mid: 2, split: async (st) => { // 33:31 15 沒空間
    if (st.up === 15) { await step(tok); return; }     // 33:44 5, 10 | 15 上去 | 20
    await step(tok);                                   // 34:00 為什麼送第 3 個 key？
    const bias = bubble('送第 2 個或第 3 個都可以：偏左 / 偏右', 0, 5.6);
    say('老師送第 3 個 key（左邊多一個 → left biased）', '要送第 2 個也行，兩種都可以');
    await step(tok);                                   // 34:20 這裡也沒空間了
    kill(bias);
    bad('root 也滿了：15, 30, 40, 70', 3.8, 5.4);
    say('[15, 30, 40, 70]：root 也沒空間了', '也要分裂');
    await step(tok);                                   // 34:28 15, 30 | 40 上去 | 70
  } });
  await step(tok);                                   // 34:41 連結也要跟著改
  ringN(BT.root.kids[1]);
  say('分裂後，原本的 child 連結也跟著搬', '70 的左邊 [50, 60]、右邊 [80]');
  await step(tok);                                   // 34:55 三層
  if (BT.view.ring) BT.view.ring.visible = false;
  KB.mood('happy');
  note('三層', -5.2, 4.4);
  say('現在有三層：一、二、三', '插入 key 就這樣長出三層 index');
  await step(tok);                                   // 35:12 高度增加，跟多層 index 一樣
  say('B-tree 的高度一層層增加', '跟 multi-level index 一樣');
  await step(tok);                                   // 35:20 所有 leaf 同一層
  line(-6, -0.05, 6, -0.05, 0.6, '#2fc092');
  good('所有 leaf 在同一層', 4.2, -0.3, 1.0);
  say('建立過程在控制之下，所有 leaf 在同一層', '看起來就像一層層的 index');
}]);
FRAG.push(['btree-ab-recptr', 'B-tree：每個 key 都有 record pointer', async (tok) => {
  fresh([0, 5.4, 14.5], [0, 2.4, 0.6]);
  btShow(4, abPre(11));
  await step(tok);                                   // 35:43 回到 database：細節很重要
  say('這棵 B-tree 怎麼拿來當 database 的 index？', '有些小細節很重要');
  await step(tok);                                   // 35:48 child pointer + record pointer
  note('每個 node：child pointer + record pointer', 0, 6.0);
  say('每個 node 有指向 child 的 pointer', '也有 record pointer');
  await step(tok);                                   // 35:54 20、5、10、15、30 都有 record pointer
  const { pos, s } = layoutTree(BT.root);
  pos.forEach((p, n) => { n.keys.forEach((key, i) => { const x = keyX(p, i, n.keys.length, s); arrow(V3(x, p.y - 0.2, 0.45), V3(x, p.y - 0.65, 1.7), 0x2fc092); }); });
  say('20、5、10、15、30 … 每個 key 都有 record pointer', '');
  await step(tok);                                   // 36:05 指向 database
  const db = prop('disk', 5.6, 0, 2.2, 1.0, 'database'); bob(db, 0.04);
  say('record pointer 指向 database 裡的那筆 record', '所以 B-tree 很適合做多層 index');
  await step(tok);                                   // 36:12 node = key + child pointer + record pointer
  good('B-tree node = key + child（block）pointer + record pointer', 0, -0.6, 1.6);
  say('B-tree 的 node 有三樣東西', 'key、child pointer（block pointer）、record pointer');
}]);
FRAG.push(['btree-ab-bplus', 'B+ tree：key 全部複製到 leaf，leaf 串成 list', async (tok) => {
  fresh([0, 5.4, 14.5], [0, 2.4, 0.4]);
  await step(tok);                                   // 37:08 B+ tree：改一下就好
  btShow(4, abPre(11));
  say('什麼是 B+ tree？', '把剛才的 B-tree 改一下');
  await step(tok);                                   // 37:15 只有 leaf 有 record pointer
  lab.clear(); lab.frameCamera([0, 5.4, 14.5], [0, 2.4, 0.4]);
  const root = T([40], T([15, 30], T([5, 10]), T([15, 20]), T([30, 35])), T([70], T([40, 50, 60]), T([70, 80])));
  const v = bpView(root, 1, 4);
  v.links.forEach((a) => { a.visible = false; });
  ['L15', 'L30', 'L40', 'L70'].forEach((id) => { v.bodies.get(id).obj.visible = false; });
  const rp = (ids) => v.leaves.forEach((l) => { const p = v.pos.get(l); l.keys.forEach((key, i) => { if (!ids.includes(key)) return; const x = keyX(p, i, l.keys.length, v.s); arrow(V3(x, p.y - 0.2, 0.45), V3(x, p.y - 0.65, 1.7), 0x2fc092); }); });
  rp([5, 10, 20, 35, 50, 60, 80]);
  bad('上層：沒有 record pointer', -4.6, 5.2);
  say('不是每個 node 都有 record pointer', '只有 leaf node 才有');
  const lit = new Set();
  const show = (ids) => { ids.forEach((id) => { v.bodies.get(id).obj.visible = true; lit.add(id); }); bpLit(v, lit); };
  await step(tok);                                   // 37:30 每個 key 在 leaf 都有副本：15
  show(['L15']); rp([15]);
  say('上層的 key 在 leaf 也要有一份副本', '15 下到 leaf，也有 record pointer');
  await step(tok);                                   // 37:44 30
  show(['L30']); rp([30]);
  say('30 也在 leaf 有一份副本', '和 35 放在一起');
  await step(tok);                                   // 37:56 40
  show(['L40']); rp([40]);
  say('40 在 leaf 也有副本', '40、50、60：三個 record pointer');
  await step(tok);                                   // 38:03 70；每個 key 都在 leaf
  show(['L70']); rp([70]);
  say('70 也下到 leaf', '樹裡每個 key 一定都出現在 leaf');
  await step(tok);                                   // 38:10 leaf 串成 linked list
  v.links.forEach((a) => { a.visible = true; });
  say('leaf node 像 linked list 一樣串起來', 'leaf 層就是一個 dense index');
  await step(tok);                                   // 38:25 所有 key 都在 leaf
  lit.clear(); bpLit(v, lit);
  note('① 所有 key 都在 leaf，上層只是副本', 3.6, 5.6);
  say('B-tree 和 B+ tree 的差別', '① 所有 key 都在 leaf；非 leaf 只放副本');
  await step(tok);                                   // 38:37 record pointer 只從 leaf 出來
  note('② record pointer 只從 leaf 出來；leaf 串成 list', 3.6, 5.0);
  say('② 非 leaf 沒有 record pointer', '③ leaf 在同一層，串成 linked list');
  await step(tok);                                   // 38:50 dense / sparse
  tag('dense index', 'ptr alt', 5.8, 0.6); tag('sparse index', 'ptr', 4.4, 2.3); tag('sparse index', 'ptr', 2.6, 4.1);
  say('leaf 層 = dense index', '上面幾層 = sparse index');
  await step(tok);                                   // 38:56 更像多層 index
  good('B+ tree 更像 multi-level index', -3.6, 0.0, 1.6);
  say('比起 B-tree，B+ tree 更像 multi-level index', '這就是「plus」多出來的東西');
}]);

// ─── ucL0BLz2OGk：交大彭文志 Lec26（2-3 tree、B+ tree、R-tree）───
FRAG.push(['btree-p-23tree', '2-3 tree 就是 order 3 的 B-tree', async (tok) => {
  fresh([0, 5.2, 13], [0, 2.4, 0]);
  await step(tok);                                   // 0:00 回顧：2-3-4 tree、2-3 tree 都是 B-tree
  note('B-tree order 4 → 2-3-4 tree', -3.2, 5.6); note('B-tree order 3 → 2-3 tree', 3.2, 5.6);
  say('上次講的 2-3-4 tree 是 B-tree 的一種', 'order 4 → 2-3-4 tree；order 3 → 2-3 tree');
  await step(tok);                                   // 0:40 2-3 tree 的例子
  btShow(3, T([50], T([20, 40], T([10]), T([30]), T([45])), T([70], T([60]), T([80]))));
  note('order 3 的 B-tree', 0, 5.6);
  say('一棵 2-3 tree 的例子', '這裡的 order 是 B-tree 的 order');
  await step(tok);                                   // 0:51 root 至少 2 個 pointer
  ringN(BT.root);
  say('root 至少要有 2 個 pointer', '往下指到兩個 child');
  await step(tok);                                   // 1:01 非 root：⌈3/2⌉ = 2
  ringN(BT.root.kids[0]);
  say('不是 root 的 node：child 數至少 ⌈m/2⌉', '⌈3/2⌉ = 2');
  await step(tok);                                   // 1:15 看 B 和 C
  nameNodes([[BT.root, 'A'], [BT.root.kids[0], 'B'], [BT.root.kids[1], 'C']]);
  if (BT.view.ring) BT.view.ring.visible = false;
  say('看 node B 和 C 的 pointer 個數', '至少 2 個 child');
  await step(tok);                                   // 1:24 B 有 3 個、C 有 2 個
  const pB = nodePos(BT.root.kids[0]), pC = nodePos(BT.root.kids[1]);
  pkt('3 個 pointer', pB.x, pB.y + 0.9); pkt('2 個 pointer', pC.x, pC.y + 0.9);
  say('B 有 3 個 pointer 往外指', 'C 有 2 個');
  await step(tok);                                   // 1:33 所以 2-3 tree 就是 B-tree
  good('每個 node 2 或 3 個 child → 2-3 tree', 0, -0.6, 1.4);
  say('每個 node 有 2 或 3 個 child：2-3 tree', '它就是 B-tree；後面還會講 B+ tree');
}]);
const P23 = () => T([20, 40], T([10]), T([30]), T([70, 80]));
FRAG.push(['btree-p-search', '2-3 tree 搜尋的四種情況', async (tok) => {
  fresh([0, 5.2, 13], [0, 2.4, 0]);
  btShow(3, P23());
  await step(tok);                                   // 1:52 跟 binary search tree 一樣比大小
  say('search 跟 binary search tree 一樣', '比大小往下走');
  await step(tok);                                   // 1:58 node 裡可能有兩個 key
  ringN(BT.root);
  say('2-3 tree 的 node 裡可能有兩個 key', '');
  await step(tok);                                   // 2:03 first key、second key
  const p = nodePos(BT.root);
  note('first key', p.x - 0.4, p.y + 1.0); note('second key', p.x + 0.9, p.y + 1.5);
  say('第一個叫 first key，第二個叫 second key', '');
  await step(tok);                                   // 2:09 有幾種情況
  if (BT.view.ring) BT.view.ring.visible = false;
  say('要找的值 x 和兩個 key 比', '有四種情況');
  await cFind(tok, 10);                              // 2:17 x < first → left
  await cFind(tok, 30);                              // 2:25 介於中間 → middle
  await cFind(tok, 80);                              // 2:31 > second → right
  await cFind(tok, 40);                              // 2:37 equal
}]);
FRAG.push(['btree-p-insert60', '2-3 tree 插入 60：連鎖 split', async (tok) => {
  fresh([0, 5.2, 13], [0, 2.4, 0]);
  btShow(3, P23());
  const rules = [];
  const rule = (t) => rules.push(note(t, -4.4, 5.8 - rules.length * 0.55));
  await step(tok);                                   // 2:46 insert：先找到 node
  ringN(BT.root.kids[2]);
  say('insert：先找到要放的 node u', 'u 一定是 leaf');
  await step(tok);                                   // 2:53 有兩種情況
  say('放進 u 時有兩種情況', '');
  await step(tok);                                   // 2:59 u 有空間 → 直接放
  ringN(BT.root.kids[1]);
  rule('① u 只有 1 個 element → 直接放');
  say('① u 只有 1 個 element', '有空位，直接塞進去');
  await step(tok);                                   // 3:15 u 已經滿了
  ringN(BT.root.kids[2]);
  rule('② u 已有 2 個 element → ?');
  say('② u 已經有 2 個 element 了', '怎麼辦？');
  await step(tok);                                   // 3:24 split
  txt(rules[1], '② u 已有 2 個 element → split');
  say('split：把它拆開', '注意三個準則');
  await step(tok);                                   // 3:31 新 node 放最大的
  rule('　新 node ← 三個數字中最大的');
  say('新開一個 node，放三個數字中最大的', '原本 2 個 + 新來 1 個 = 3 個');
  await step(tok);                                   // 3:44 中間的 → parent
  rule('　中間的 → insert 到 u 的 parent');
  say('中間那個 insert 到 u 的 parent', '');
  await step(tok);                                   // 3:54 最小的留在 u
  rule('　最小的 → 留在 u');
  say('最小的留在原本的 node u', '');
  await step(tok);                                   // 4:08 例子：連鎖反應
  nameNodes([[BT.root, 'A'], [BT.root.kids[2], 'C']]);
  if (BT.view.ring) BT.view.ring.visible = false;
  say('例子：連鎖反應', 'C = [70, 80]、A = [20, 40]');
  courier(5.6, 2.4);
  let warn = null;
  await cIns(tok, 60, { split: async (st) => {       // 4:18 60 落在 C
    if (st.up === 70) {
      await step(tok);                               // 4:27 C 要 split
      warn = bad('60, 70, 80：3 個 → split', 4.2, 1.0);
      say('C 變成 60, 70, 80', '很明顯要 split');
      await step(tok);                               // 4:45 中間 70 往 parent 走
      kill(warn); NAMES.forEach(kill); NAMES = [];
    } else {
      await step(tok);                               // 4:52 C 的 parent 是 A
      ringN(BT.root);
      warn = bad('A = [20, 40, 70]：也滿了', 3.8, 5.4);
      say('C 的 parent 是 A', '70 放進 A → A 也有 3 個數字');
      await step(tok);                               // 5:01 A 也 split
      kill(warn);
    }
  } });
  await step(tok);                                   // 5:11 連鎖反應
  pkt('連鎖反應：C split → A split', 0, 5.8);
  say('下面的 node insert → split', '送上去又讓 parent split：連鎖反應');
  await step(tok);                                   // 5:30 A split → 新 root
  ringN(BT.root);
  KB.mood('happy');
  say('20, 40, 70 中間的 40 往上', '產生新的 root，樹高 +1');
}]);
FRAG.push(['btree-p-leaf60', '學生提問：60 存在哪裡', async (tok) => {
  fresh([0, 5.2, 13], [0, 2.4, 0]);
  btShow(3, P23());
  for (const _ of btInsert(60)) { /* silent */ }
  btRender();
  await step(tok);                                   // 6:07 投影片少畫一個 pointer
  const { pos, s } = layoutTree(BT.root);
  say('插完 60 的樹', '每個 internal node 都有 2 個 pointer（投影片少畫一根）');
  pos.forEach((p, n) => { if (!isLeaf(n)) glow(BT.view.bodies.get(String(n.keys[0])).obj, '#4a3a00'); });
  await step(tok);                                   // 6:21 數一數 node
  let i = 0; pos.forEach((p) => { tag(String(++i), 'pkt', p.x, p.y + 0.75); });
  say('數一數 node：1, 2, 3 … 7', '原本 4 個 node，split 兩次多了 2 個，再加新 root');
  await step(tok);                                   // 6:46 60 會到 leaf
  const leaf60 = BT.root.kids[1].kids[0]; ringN(leaf60);
  say('60 不是只放在上層', 'insert 一律從 leaf 開始，60 就在 leaf 裡');
  await step(tok);                                   // 7:07 B-tree 的中間數字
  note('B-tree：上層 key 也是資料本身', 0, 5.8);
  say('2-3-4 tree / 2-3 tree 都是 B-tree', '上層 key 也是資料；「全部存在 leaf」是 B+ tree 的特性');
}]);
const PD = () => T([50, 80], T([10, 20]), T([60, 70]), T([90, 95]));
const pdNames = () => nameNodes([[BT.root, 'A'], ...BT.root.kids.map((k, i) => [k, 'BCD'[i]])]);
FRAG.push(['btree-p-del-leaf', '2-3 tree 刪除 70、90', async (tok) => {
  fresh([0, 5.2, 13], [0, 2.4, 0]);
  btShow(3, PD(), 'del');
  await step(tok);                                   // 7:34 delete 也有很多情況
  say('接著看 delete', '一樣有很多種情況');
  await step(tok);                                   // 7:45 insert 會 split，delete 牽涉 merge
  note('insert → split　delete → merge', 0, 5.6);
  say('insert 會 split', 'delete 會牽涉到 merge（node 空了要收回）');
  await step(tok);                                   // 8:00 (a) 原本的樹
  pdNames();
  say('(a) 原本的 2-3 tree', 'A = [50, 80]，B、C、D 是 leaf');
  await cDel(tok, 70);                               // 8:08 delete 70
  await step(tok);                                   // 8:25 長成 (b)
  pdNames();
  say('(b) 70 在 C，直接刪掉', 'C 還剩 60，仍然合法');
  await cDel(tok, 90);                               // 8:35 delete 90
  await step(tok);                                   // 8:46 長成 (c)
  pdNames();
  say('(c) D 還剩 95', '每個 node 都還有 key，不用調整');
}]);
FRAG.push(['btree-p-del-rotate', '刪 60 要 rotate、刪 95 要 combine', async (tok) => {
  fresh([0, 5.2, 13], [0, 2.4, 0]);
  btShow(3, T([50, 80], T([10, 20]), T([60]), T([95])), 'del');
  await step(tok);                                   // 9:06 delete 60（投影片寫 50）
  pdNames();
  bubble('投影片寫 delete 50，應該是 60', 3.8, 5.6);
  say('接著 delete 60', '老師更正：投影片寫成 50');
  await cDel(tok, 60, { fix: async () => {           // 9:15 60 刪掉，C 空了
    await step(tok);                                 // 9:33 回收是大工程
    say('C 空了：要調整', '直接把 node 回收，要動很多地方');
    await step(tok);                                 // 9:48 rotate
    ringN(BT.root.kids[0]);
    say('左邊兄弟 B 有 10、20 兩個數字', '可以做 rotate（旋轉）');
    await step(tok);                                 // 10:04 50 往下推、20 往上送
  } });
  pdNames();
  await step(tok);                                   // 10:16 delete 95
  say('再 delete 95', '');
  await cDel(tok, 95, { step: false, fix: async () => {
    await step(tok);                                 // 10:26 combine
    say('D 空了', '這次要做 combine（merge 到別的 node）');
    await step(tok);                                 // 10:41 不夠 rotate
    ringN(BT.root.kids[1]);
    say('兄弟 C 只有 1 個數字（50）', '不夠借，不能 rotate');
    await step(tok);                                 // 10:49 80 往下推
  } });
  await step(tok);                                   // 10:58 結果
  pdNames();
  say('80 往下 merge 到 C：C = [50, 80]', 'D 被刪掉，A 剩 [20]');
}]);
FRAG.push(['btree-p-rotate-cases', 'Rotate 的三種情況', async (tok) => {
  fresh([0, 5, 12], [0, 1.6, 0]);
  const XS = [-4, 0, 4], C = '#4b9ee2';
  const cases = [
    { p: 0, q: 1, down: 'x', up: 'y', r: ['x', 'z'], kids: [[], ['y', 'w'], ['v']], cap: 'case 1：p 是 r 的 left child', f: 'x 往下推到 p，y 往上提到 r' },
    { p: 1, q: 2, down: 'z', up: 'y', r: ['x', 'z'], kids: [['u'], [], ['y', 'w']], cap: 'case 2：p 是 r 的 middle child', f: 'z 往下推，y 往上提' },
    { p: 2, q: 1, down: 'z', up: 'y', r: ['x', 'z'], kids: [['u'], ['w', 'y'], []], cap: 'case 3：p 是 r 的 right child', f: 'z 往下推，y 往上提，x 不動' },
  ];
  let cur = null;
  const build = (cs) => {
    lab.clear(); lab.frameCamera([0, 5, 12], [0, 1.6, 0]);
    const rk = cs.r.map((t, i) => cube(t, C, [0.8, 0.6, 0.8], -0.45 + i * 0.9, 3.4, 0));
    tag('r', 'ptr', -1.6, 3.4);
    const kk = cs.kids.map((ks, j) => ks.map((t, i) => cube(t, j === cs.q ? '#2fc092' : C, [0.8, 0.6, 0.8], XS[j] - (ks.length - 1) * 0.45 + i * 0.9, 1.2, 0)));
    XS.forEach((x) => line(x * 0.25, 3.0, x, 1.6));
    cube('', '#f0a8a8', [0.9, 0.15, 0.9], XS[cs.p], 0.82, 0);
    tag('p（空了）', 'ptr', XS[cs.p], 0.3); tag('q', 'ptr alt', XS[cs.q], 0.3);
    say(cs.cap, '兄弟 q 有 2 個 key，可以 rotate');
    cur = { cs, rk, kk };
  };
  const rot = () => {
    const { cs, rk, kk } = cur;
    const dm = rk[cs.r.indexOf(cs.down)], um = kk[cs.q][cs.kids[cs.q].indexOf(cs.up)];
    const ox = dm.position.x;
    glow(dm, GOLD); glow(um, GOLD);
    move(dm, XS[cs.p], 1.2, 0); move(um, ox, 3.4, 0);
    say(cs.f, '');
  };
  await step(tok);                                   // 11:19 rotate 有三種 case
  ['left', 'middle', 'right'].forEach((t, i) => note('p 在 r 的 ' + t, XS[i], 4.6));
  say('rotate 有三種 case', '看空掉的 node p 是 parent r 的哪一個 child');
  await step(tok);                                   // 11:25 case 1：p 在 left
  build(cases[0]);
  await step(tok);                                   // 11:51 x 往下推、y 往上提
  rot();
  await step(tok);                                   // 12:03 下面 a b c d 也要調整
  ['a', 'b', 'c', 'd'].forEach((t, i) => tag(t, 'idx', -5 + i * 1.6, -0.3));
  say('下面的 subtree（a, b, c, d）也要跟著調整', '順序要對：a b c d 由左到右');
  await step(tok);                                   // 12:33 pointer 指到調整後的 node
  say('pointer 要指到調整過後的 node', '這是 case 1');
  await step(tok);                                   // 12:43 case 2：p 在 middle
  build(cases[1]);
  await step(tok);                                   // 12:56 z 往下推、y 往上提
  rot();
  await step(tok);                                   // 13:07 夠多數字才能 rotate
  say('兄弟要有夠多的數字（2 個）才能 rotate', '只動三個數字');
  await step(tok);                                   // 13:25 case 3：p 在 right
  build(cases[2]);
  await step(tok);                                   // 13:35 z 往下推、y 往上提，x 不動
  rot();
  await step(tok);                                   // 13:46 三種位置
  say('被刪的數字可能在 parent 的 left / middle / right', '三種都要調整');
  await step(tok);                                   // 14:03 leaf 也跟著調整
  say('調整完，下面的 leaf node 也要跟著接好', '');
  await step(tok);                                   // 14:13 merge 看課本
  note('merge（combine）→ 請看課本', 0, 4.8);
  say('merge（combine）課堂不講', '請參考課本');
}]);
FRAG.push(['btree-p-234', '2-3-4 tree 與 red-black tree', async (tok) => {
  fresh([0, 5, 12], [0, 2, 0]);
  await step(tok);                                   // 14:22 2-3 order 3、2-3-4 order 4
  [10, 20, 30].forEach((k, i) => cube(k, '#4b9ee2', [0.9, 0.7, 0.9], -4.4 + i * 1.0, 2.6, 0, 3));
  for (let i = 0; i < 4; i++) line(-4.9 + i * 1.0, 2.2, -5.6 + i * 1.5, 1.0);
  tag('2-3-4 tree：order 4（最多 4 個 pointer）', 'ptr', -3.4, 3.8);
  say('2-3 tree 的 order 是 3', '2-3-4 tree 的 order 是 4');
  await step(tok);                                   // 14:39 高度 log₄(n+1) ～ log₂(n+1)
  note('高度：log₄(n+1) ～ log₂(n+1)', -3.4, 0.2);
  say('2-3-4 tree 的高度', '介於 log₄(n+1) 和 log₂(n+1) 之間');
  await step(tok);                                   // 14:48 有些優點
  say('2-3-4 tree 比 2-3 tree 好的地方', '老師說：這段聽聽就好');
  await step(tok);                                   // 15:08 只調整一次
  good('insert / delete 只調整一次，不連鎖', 3.4, 4.6);
  say('insert / delete 時只要調整一次', '不會像 2-3 tree 連鎖反應');
  await step(tok);                                   // 15:21 表示法有效率：red-black tree
  const b = cube('20', '#333333', [0.9, 0.7, 0.9], 3, 3.4, 0, 3), r1 = cube('10', '#d64545', [0.9, 0.7, 0.9], 1.8, 1.6, 0, 3), r2 = cube('30', '#d64545', [0.9, 0.7, 0.9], 4.2, 1.6, 0, 3);
  line(3, 3.0, 1.8, 2.0); line(3, 3.0, 4.2, 2.0);
  arrow(V3(-2.6, 2.6, 0), V3(1.0, 2.6, 0));
  say('表示方法很有效率', '演算法會讀到 red-black tree（紅黑樹）');
  await step(tok);                                   // 15:41 資結至少懂 2-3 tree
  note('資結：至少要懂 2-3 tree', 0, 5.4);
  say('資料結構這段至少要懂 2-3 tree', '2-3-4 tree 有時間再看');
  await step(tok);                                   // 16:00 2-3-4 tree 例子：pointer 變多
  say('2-3-4 tree 的例子', '每個 node 的 pointer 個數變多了');
  await step(tok);                                   // 16:34 表示成 red-black tree
  glow(b, GOLD);
  say('2-3-4 tree 可以表示成 red-black tree', '它還是一棵 binary tree：中間 key 黑，兩旁紅');
  await step(tok);                                   // 16:39 演算法會再講
  glow(r1, GOLD); glow(r2, GOLD);
  say('red-black tree 演算法課會再講', '可以接到演算法');
}]);
FRAG.push(['btree-p-range-naive', 'Range search：為什麼要 B+ tree', async (tok) => {
  fresh([0, 6, 12], [0, 1.4, 0]);
  await step(tok);                                   // 16:50 什麼是 B+ tree
  const t0 = bubble('什麼是 B+ tree？', 0, 5.0);
  say('什麼叫 B+ tree？', '');
  await step(tok);                                   // 16:58 目前的 search 都找一個值
  txt(t0, '目前的 search：找一個值');
  const one = buddy('search', '27', '#f3d36b', -5.4, 0, 1.6, 0.75);
  say('到目前為止的 search', '都是找「一個值」');
  await step(tok);                                   // 17:06 有時候要找一堆值
  one.set('一堆'); one.mood('wow');
  say('有些時候不是找一個值', '而是找一堆值');
  await step(tok);                                   // 17:20 例子：平均 ≥ 80 分的學生
  const cells = []; for (let i = 0; i < 21; i++) cells.push(cube(String(80 + i), '#e2d3b6', [0.55, 0.45, 0.6], -6 + i * 0.6, 3.2, 0));
  txt(t0, '學期平均 ≥ 80 分的學生');
  say('例子：學期平均 80 分以上的學生全部列出來', '這也是一種 search');
  await step(tok);                                   // 17:40 range search
  pkt('range search', 0, 4.2);
  say('牽涉到一個範圍（range）', '叫 range search');
  await step(tok);                                   // 17:52 笨方法：每個值 search 一次
  await anim(tok, 2400, (t) => { const k = Math.floor(t * 20.99); cells.forEach((c, i) => glow(c, i <= k ? RED : null)); });
  one.mood('sad');
  say('最笨的方法：80、81、82 … 各 search 一次', '80～100 要下二十幾次 search');
  await step(tok);                                   // 18:16 為什麼要介紹 B+ tree
  cells.forEach((c) => glow(c, null)); one.mood('calm');
  say('所以要介紹 B+ tree', '它跟 B-tree 很像');
  await step(tok);                                   // 18:27 差別：leaf 用 linked list 串起來
  const lv = []; for (let i = 0; i < 4; i++) { lv.push(cube(String(80 + i * 6), '#2fc092', [1.6, 0.5, 0.8], -4.5 + i * 3, 0.6, 0, 3)); if (i) arrow(V3(-6.7 + i * 3, 0.6, 0.5), V3(-5.3 + i * 3, 0.6, 0.5), 0x2fc092); }
  tag('leaf node', 'idx', -4.5, 1.5);
  await anim(tok, 1600, (t) => { const k = Math.floor(t * 3.99); lv.forEach((l, i) => glow(l, i <= k ? GOLD : null)); });
  one.mood('happy');
  say('差別：最下面的 leaf node 用 linked list 串起來', '找到 80 之後往右走就好');
  await step(tok);                                   // 18:35 database 裡叫 index
  note('database：B+ tree = index（索引）', 0, -0.5, 1.2);
  say('在 database 裡，B+ tree 就叫 index', '索引的結構');
  await step(tok);                                   // 19:19 key K1 … Kn
  say('index 裡藍色的是 key：K1、K2 … Kn', '就是拿來比較的數值');
  await step(tok);                                   // 19:38 pointer 指到 disk page
  const pg = prop('file', 5.6, 0, 2.2, 1.0, 'disk page'); bob(pg, 0.04);
  arrow(V3(4.5, 0.6, 0.6), V3(5.4, 0.9, 2.0), 0x2fc092);
  say('每個 K 都有一個 pointer', '指到 disk 上的一個 page');
  await step(tok);                                   // 19:46 page 裡放 record
  say('page 裡放的是 record', '例如學生的資料');
}]);
FRAG.push(['btree-p-bp-d1', 'B+ tree（order d = 1）例子', async (tok) => {
  fresh([0, 5.2, 14.5], [0, 2.4, 0.3]);
  await step(tok);                                   // 21:14 database 用 B+ tree
  const db = prop('disk', -5.6, 0, 2.4, 1.0, 'database'); bob(db, 0.04);
  say('database 都用 B+ tree 存放 index', '');
  await step(tok);                                   // 21:26 node 的 pointer 超過兩個
  const root = RK1(); const v = bpView(root, 1);
  say('B+ tree 跟 B-tree 很像', '一個 node 的 pointer 可以超過兩個');
  await step(tok);                                   // 21:32 balanced
  line(-6.5, -0.15, 6.5, -0.15, 0.6, '#2fc092');
  say('而且是一棵 balanced tree', 'leaf 都在同一層');
  await step(tok);                                   // 21:38 看一個例子
  say('看一個例子', '');
  await step(tok);                                   // 21:44 order 定義跟 B-tree 不一樣
  const od = bad('order d = 1', -4.8, 5.2);
  say('紅字是 order', 'B+ tree 的 order 和 B-tree 的 order 定義不太一樣');
  await step(tok);                                   // 21:51 order 1
  say('這個例子 order d = 1', '');
  await step(tok);                                   // 22:01 至少 1 個 entry
  note('每個 node：1 ～ 2 個 entry（key）', -3.6, 6.0);
  say('每個 node 至少包含 1 個 entry', 'entry 就是 key 的數值');
  await step(tok);                                   // 22:11 root 40 一個 entry
  bpRing(v, root);
  say('root 40：只有一個 entry', '');
  await step(tok);                                   // 22:22 [20, 33]、[51, 63] 最多 2 個
  bpRing(v, root.kids[1]);
  say('下面 [20, 33]、[51, 63]', '最多就是 2 個 entry');
  await step(tok);                                   // 22:49 * 是 pointer
  v.ring.visible = false;
  bpStars(v, false);
  say('leaf 裡 k* 的 * 代表 pointer', '');
  await step(tok);                                   // 23:09 例如用年紀建 index
  kill(od);
  note('key = 年紀', -4.8, 5.2);
  say('假設 key 是每個人的年紀', '用年紀這個欄位建 index structure');
  await step(tok);                                   // 23:25 63*：資料在 pointer 指的地方
  const l63 = v.pos.get(root.kids[1].kids[2]);
  const hand = pkt('63*', keyX(l63, 0, 2, v.s), l63.y - 0.9, 0.6);
  await travel(tok, hand, V3(keyX(l63, 0, 2, v.s), l63.y - 0.9, 0.6), V3(-5.6, 1.4, 2.4), 1300);
  say('年紀 63 的人，資料在哪？', '跟著 63* 這個 pointer 去 disk 拿 record');
  await step(tok);                                   // 23:43 上面的 63 只拿來比較
  remove(hand);
  v.bodies.get('I63').obj.material.emissive = new THREE.Color('#4a3a00');
  say('上面那個 63 只是比較用的鍵值', '真正的資料不在那裡');
  await step(tok);                                   // 24:16 leaf：doubly linked list
  v.bodies.get('I63').obj.material.emissive = new THREE.Color('#000000');
  bpStars(v, true);
  say('最下面一層是 leaf node', 'leaf 用 doubly linked list 串起來，前後都能走');
  await step(tok);                                   // 24:40 < 40 都在左邊 subtree
  bpRing(v, root.kids[0]);
  say('年紀 < 40 的都在左邊這棵 subtree', '搜尋範圍一下就被限定住');
  await step(tok);                                   // 25:18 ≥ 40 在右邊
  bpRing(v, root.kids[1]);
  say('≥ 40 的都在右邊', '');
  await step(tok);                                   // 25:28 遞迴：20 ～ 33
  bpRing(v, root.kids[0].kids[1]);
  say('遞迴下去：20 ～ 33 之間的值', '都在中間這棵小 subtree');
}]);
FRAG.push(['btree-p-bp-find27', 'B+ tree 找 key 27', async (tok) => {
  fresh([0, 5.2, 14.5], [0, 2.4, 0.3]);
  const root = RK1(); const v = bpView(root, 1); bpStars(v, true);
  const path = bpDescend(root, 27);
  await step(tok);                                   // 25:48 找 27
  const kb = buddy('找', '27', '#f3d36b', -5.8, 0, 2.4, 0.7);
  say('找 key 27：年紀 27 的資料在哪？', '');
  await step(tok);                                   // 25:59 從 root 比較
  bpRing(v, root);
  say('從 root 開始比較', '跟以前 search 一個 key 很像');
  await step(tok);                                   // 26:05 27 < 40 → 左
  bpAt(v, path[0], 27); await beat(tok, 500); bpRing(v, path[1]);
  say('27 < 40', '往左半邊走');
  await step(tok);                                   // 26:14 20 ≤ 27 < 33 → 中間
  bpAt(v, path[1], 27); await beat(tok, 500); bpRing(v, path[2]);
  say('20 ≤ 27 < 33', '走中間那個 pointer');
  await step(tok);                                   // 26:21 hit
  bpAt(v, path[2], 27);
  v.bodies.get('L27').obj.material.emissive = new THREE.Color('#1d5a2c');
  kb.mood('happy'); await kb.hop(tok);
  await step(tok);                                   // 26:32 B+ tree 一樣能 search 一個值
  say('B+ tree 一樣能找單一的值', '');
  await step(tok);                                   // 26:40 等一下：range query
  pkt('等一下：range query 為什麼快？', 0, 6.0);
  say('等一下看它為什麼能很快做 range query', '');
}]);
FRAG.push(['btree-p-bp-format', 'B+ tree 節點格式與 d ≤ n ≤ 2d', async (tok) => {
  fresh([0, 5, 12], [0, 1.6, 0]);
  const lbl = ['P0', 'K1', 'P1', 'K2', 'P2', '…', 'Kn', 'Pn'];
  const parts = [];
  const mk = (i) => { const t = lbl[i]; parts[i] = cube(t, t[0] === 'P' ? '#d8c29b' : t === '…' ? GRAY : '#4b9ee2', [t[0] === 'P' ? 0.75 : 1.0, 0.7, 1], -4.9 + i * 1.4, 2.4, 0, 2); };
  await step(tok);                                   // 26:57 每個 node 有 K1 … Kn
  [1, 3, 5, 6].forEach(mk);
  say('B+ tree 的每個 node 裡有 K1、K2 … Kn', 'K = key（鍵值）');
  await step(tok);                                   // 27:12 P 是 pointer
  [0, 2, 4, 7].forEach(mk);
  say('P0、P1 … Pn 是 pointer', 'node：P0 K1 P1 K2 … Kn Pn');
  await step(tok);                                   // 27:21 key 排好序
  [1, 3, 6].forEach((i) => glow(parts[i], GOLD));
  say('K1 < K2 < … < Kn：排好序', '跟 B-tree 一樣');
  await step(tok);                                   // 27:31 不是 root 的 node
  [1, 3, 6].forEach((i) => glow(parts[i], null));
  say('第二個特性：不是 root 的 node', 'key 的個數有限制');
  await step(tok);                                   // 27:46 d ≤ n ≤ 2d
  note('非 root：d ≤ n ≤ 2d', -2.5, 0.8);
  say('key 的個數 n 落在 d ≤ n ≤ 2d', '');
  await step(tok);                                   // 27:53 d = order
  pkt('d = B+ tree 的 order', -2.5, 0.1);
  say('d 就叫做 B+ tree 的 order', 'd = 1 → 1～2 個；d = 2 → 2～4 個');
  await step(tok);                                   // 28:00 root：1 ～ 2d
  note('root：1 ≤ n ≤ 2d', 2.8, 0.8);
  say('第三個特性：root 的 key 個數', '至少 1 個，最多 2d 個');
  await step(tok);                                   // 28:17 搜尋跟 B-tree 一樣
  say('搜尋：跟著 pointer 比大小往下', '和 B-tree 一樣');
  await step(tok);                                   // 28:41 leaf 裡的 * 是 pointer
  tag('k*：leaf 裡的 * = 指向 record 的 pointer', 'idx', 0, -0.6);
  say('走到 leaf 都找得到 k*', '* 代表一個 pointer');
}]);
FRAG.push(['btree-p-bp-d2-search', 'order 2 的 B+ tree：找 5、找 15', async (tok) => {
  fresh([0, 4.6, 13.5], [0, 1.6, 0.3]);
  await step(tok);                                   // 28:58 order 2 的 B+ tree
  const root = RK2(); const v = bpView(root, 2); bpStars(v, false);
  say('一棵 order d = 2 的 B+ tree', 'root [13, 17, 24, 30]，下面 5 個 leaf');
  await step(tok);                                   // 29:09 三個 query
  note('Q1：年紀 5', -4.4, 5.0); note('Q2：年紀 15', 0, 5.0); note('Q3：年紀 ≥ 24', 4.4, 5.0);
  say('三個查詢', '年紀 5、年紀 15、年紀 ≥ 24 的全部資料');
  const kb = buddy('找', '5', '#f3d36b', -6.0, 0, 2.6, 0.65);
  await step(tok);                                   // 29:27 找 5：從 root 下來
  bpRing(v, root);
  say('找 5：從 root 下來', '');
  await step(tok);                                   // 29:35 和 13, 17, 24, 30 比大小
  bpAt(v, root, 5);
  await step(tok);                                   // 29:45 5 < 13 → 最左邊 pointer
  bpRing(v, root.kids[0]);
  say('5 比 13 小', '走最左邊的 pointer，往下到 leaf');
  await step(tok);                                   // 29:53 leaf 有 4 筆，其中一筆是 5
  bpAt(v, root.kids[0], 5); bpLit(v, new Set(['L5']));
  kb.mood('happy');
  await step(tok);                                   // 30:01 找 15
  bpLit(v, new Set()); kb.set('15'); kb.mood('calm');
  bpRing(v, root);
  say('找 15', '');
  await step(tok);                                   // 30:09 介於 13 和 17 之間
  bpAt(v, root, 15); await beat(tok, 600); bpRing(v, root.kids[1]);
  await step(tok);                                   // 30:15 leaf 只有 14、16 → no return
  bpAt(v, root.kids[1], 15);
  kb.mood('sad');
  say('leaf 裡只有 14、16，沒有 15', 'no return：找不到');
}]);
FRAG.push(['btree-p-bp-d2-range', 'Range query：≥ 24、< 24、15 ～ 24', async (tok) => {
  fresh([0, 4.6, 13.5], [0, 1.6, 0.3]);
  const root = RK2(); const v = bpView(root, 2); bpStars(v, false);
  const hl = new Set();
  const leaf24 = root.kids[3];
  await step(tok);                                   // 30:28 ≥ 24：先 search 24
  bpAt(v, root, 24);
  say('找 ≥ 24 的所有資料', '先 search 24 在哪');
  await step(tok);                                   // 30:39 24 在這邊
  bpRing(v, leaf24);
  say('24 ≥ 24 → 往這個 pointer 走', '');
  await step(tok);                                   // 30:51 到 leaf，找到 24
  hl.add('L24'); bpLit(v, hl);
  say('到達 leaf node，找到 24', '');
  await step(tok);                                   // 31:01 右邊 linked list 的值都 ≥ 24
  v.links.forEach((a) => a.setColor(new THREE.Color(0xc08a1f)));
  say('從這個 node 往右，linked list 串出來的值', '一定都 ≥ 24');
  await step(tok);                                   // 31:09 往右走
  for (let n = leaf24; n; n = n.next) { bpRing(v, n); n.keys.filter((k) => k >= 24).forEach((k) => hl.add('L' + k)); bpLit(v, hl); await beat(tok, 700); }
  say('沿著 linked list 往右走', '');
  await step(tok);                                   // 31:19 null → 停
  const nullT = bad('null → 停', 6.0, 0.4);
  const allT = good('24, 27, 29, 33, 34, 38, 39', 2.6, 3.6);
  say('後面是 null：停止', '一下子就拿到所有 ≥ 24 的資料');
  await step(tok);                                   // 31:26 < 24 呢？
  hl.clear(); bpLit(v, hl); v.links.forEach((a) => a.setColor(new THREE.Color(0x2fc092)));
  kill(nullT); kill(allT);
  bpRing(v, leaf24);
  say('那 < 24 的呢？', '一樣先找到 24');
  await step(tok);                                   // 31:37 往左走
  for (let i = v.leaves.indexOf(leaf24) - 1; i >= 0; i--) { bpRing(v, v.leaves[i]); v.leaves[i].keys.forEach((k) => hl.add('L' + k)); bpLit(v, hl); await beat(tok, 600); }
  say('從 24 透過 linked list 往左走', '左邊的都 < 24');
  await step(tok);                                   // 31:47 15 ～ 24
  hl.clear(); bpLit(v, hl); v.ring.visible = false;
  say('那 15 ≤ x ≤ 24 呢？', '');
  await step(tok);                                   // 32:03 search 兩次
  const l15 = bpDescend(root, 15).pop();
  bpRing(v, l15);
  pkt('search 15', v.pos.get(l15).x, v.pos.get(l15).y + 0.8);
  say('其實只要 search 一次：找 15 所在的 leaf', '老師說要 search 兩次（還口誤說成 5），找 24 那次可以省掉');
  await step(tok);                                   // 32:25 從 15 走到 24
  for (let n = l15; n; n = n.next) { bpRing(v, n); let stop = false; for (const k of n.keys) { if (k > 24) { stop = true; break; } if (k >= 15) hl.add('L' + k); } bpLit(v, hl); await beat(tok, 700); if (stop || n.keys.includes(24)) break; }
  say('從 15 的位置沿 link 往右走', '看到 27 > 24 就停');
  await step(tok);                                   // 32:40 夾在中間的都符合
  good('16, 19, 20, 22, 24', -2.4, 3.6);
  say('夾在中間的 leaf 都符合條件', '16, 19, 20, 22, 24');
  await step(tok);                                   // 32:49 range query
  say('這就是 B+ tree 很容易做到的 range query', '有範圍的查詢');
  await step(tok);                                   // 32:59 ≥、≤、介於中間
  note('≥ x、≤ x、x ～ y 都一樣快', 0, 5.0);
  say('範圍可以是 ≥、≤ 或介於中間', '都沒問題');
}]);
FRAG.push(['btree-p-rtree', '預告：2D 空間查詢與 R-tree', async (tok) => {
  fresh([0, 9, 8], [0, 0, 0.5]);
  await step(tok);                                   // 33:21 B+ tree 多了 range search
  const plane = new THREE.Mesh(new THREE.BoxGeometry(11, 0.06, 7.5), new THREE.MeshStandardMaterial({ color: '#efe6d2' })); plane.position.y = -0.05; lab.world.add(plane);
  note('B+ tree = B-tree + range search', 0, 0.3, -3.2);
  say('B+ tree 比 B-tree 更強', '多了 range search');
  await step(tok);                                   // 33:28 R-tree
  pkt('R-tree？', 4.2, 0.3, -3.2);
  say('有興趣可以查 R-tree', 'Wikipedia 一定有');
  await step(tok);                                   // 33:53 年紀是一維
  const ages = [20, 27, 33, 40, 51].map((a, i) => cube(String(a), '#4b9ee2', [0.6, 0.4, 0.5], -4 + i * 2, 0.2, -1.6));
  tag('一維：年紀 →', 'idx', -4.8, 0.3, -2.4);
  say('剛才的 key 是年紀', '只有一個數字 → 一維');
  await step(tok);                                   // 34:12 二維：經度、緯度
  ages.forEach(kill);
  tag('經度 →', 'idx', 4.8, 0.1, 3.9); tag('緯度', 'idx', -5.8, 0.1, -3.4);
  const P = [[-4, -2.5], [-3, 1.5], [-1.2, -0.8], [-0.4, 0.7], [0.6, -0.2], [1.1, 1.2], [2.5, -2.2], [3.6, 1.8], [4.3, -0.6], [-2.2, 2.6], [0.2, -2.6], [2.0, 0.4]];
  const pts = P.map(([x, z]) => cube('', '#4b9ee2', [0.35, 0.35, 0.35], x, 0.2, z, 3));
  say('二維：路上的景點', '用經度、緯度兩個數字表示位置');
  await step(tok);                                   // 34:37 交大半徑 5 公里
  const c = circle(1.8, 0.03, '#d64545'); c.position.set(0.2, 0, 0.2);
  const me = buddy('交大', '', '#f3d36b', 0.2, 0, 0.2, 0.5);
  say('查詢：以交大為中心', '半徑 5 公里內的所有景點');
  await step(tok);                                   // 34:58 笨方法：兩棵 B+ tree 取交集
  const s1 = ghostBox('#f0a030', 3.6, 0.1, 7.4); s1.position.set(0.2, 0.05, 0);
  const s2 = ghostBox('#9b7ef4', 10.9, 0.1, 3.6); s2.position.set(0, 0.07, 0.2);
  P.forEach(([x, z], i) => glow(pts[i], Math.hypot(x - 0.2, z - 0.2) <= 1.8 ? GREEN : null));
  say('笨方法：經度、緯度各建一棵 B+ tree', '兩個結果取交集（老師說 union，應是交集）');
  await step(tok);                                   // 35:10 R-tree 1984
  kill(s1); kill(s2);
  const rect = (x1, z1, x2, z2, col) => { const pts2 = [V3(x1, 0.04, z1), V3(x2, 0.04, z1), V3(x2, 0.04, z2), V3(x1, 0.04, z2), V3(x1, 0.04, z1)]; const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts2), new THREE.LineBasicMaterial({ color: col })); lab.world.add(l); return l; };
  rect(-4.4, -3.0, -0.8, -0.4, '#2fc092'); rect(-3.4, 1.1, 0.0, 3.0, '#2fc092'); rect(0.2, -2.9, 2.9, 1.6, '#2fc092'); rect(3.2, -1.0, 4.7, 2.2, '#2fc092');
  me.mood('happy');
  say('厲害的方法：R-tree（1984 年提出）', '用矩形把附近的點分組');
  await step(tok);                                   // 35:34 專門處理空間查詢
  say('R-tree 專門處理空間資料的查詢', '');
  await step(tok);                                   // 35:48 多維度
  note('multidimensional space', 0, 0.3, 3.4);
  say('R-tree 也能推廣到多維度空間', 'multidimensional space');
}]);
  }
  // ═══ trie-hackerrank.js（HackerRank：Tries 短片） ═══
  {
const { V3, fresh, tag, cube, kill, glow, txt, arrow, step, GOLD, GREEN } = K;
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const bubble = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const pkt = (t, x, y, z = 0) => tag(t, 'pkt', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const setCls = (l, cls) => { l.element.className = 'lab-label ' + cls; };
// 小字典：car 既是單字也是 card / care 的前綴；cal 是 call / calm 的前綴
const HR_DICT = ['car', 'card', 'care', 'cat', 'call', 'calm', 'do', 'dog'];
function hrBuild(words) {
  enterTrie(true);
  for (const w of words) for (const _ of trInsert(w)) { /* silent */ }
  lab.frameCamera([0, 4.6, 10.5], [0, 3.2, 0]);
  trRender();
}
function hrNode(path) { let n = TR.root; for (const ch of path) { n = n && n.kids.get(ch); } return n || null; }
const hrPre = (w) => { const out = []; for (let i = 1; i <= w.length; i++) out.push(w.slice(0, i)); return out; };
function hrSub(path) { const out = []; (function g(x) { out.push(x.path); trKids(x).forEach(g); })(hrNode(path)); return out; }
// 從 root 一個字元一個字元往下走（游標跟著動）
async function hrWalk(tok, w, ms = 600, keep = []) {
  const hot = [...keep];
  for (const p of hrPre(w)) {
    const n = hrNode(p); if (!n) return false;
    hot.push(p); trRender(new Set(hot), n);
    await beat(tok, ms);
  }
  return true;
}

FRAG.push(['trie-hr-what', 'Trie：每個節點存一個字元，路徑就是單字', async (tok) => {
  hrBuild(HR_DICT);
  await step(tok);                                   // 0:10 trie 是一種 tree
  say('trie 是一種資料結構，其實就是一棵 tree', '面試很常考，學校卻不太教');
  await step(tok);                                   // 0:15 每個節點存一個字元
  trRender(new Set(hrSub('')), null);
  note('每個節點的資料：1 個字元', 0, 1.6);
  say('每個節點只存一個字元', '');
  await step(tok);                                   // 0:24 root 到節點的路徑 = 單字（的一部分）
  trRender(new Set(['c', 'ca']), hrNode('ca'));
  const l1 = pkt('root → c → a ＝ "ca"：單字的一部分', 0, 0.9);
  say('從 root 走到某個節點的路徑', '就代表一個單字或單字的一部分');
  await beat(tok, 2200);
  trRender(new Set(['c', 'ca', 'car']), hrNode('car'));
  txt(l1, 'root → c → a → r ＝ "car"：完整單字（金色）');
  await step(tok);                                   // 0:34 某一類非常快的查詢
  good('查「某個字串在不在」只要沿路往下走', 0, 0.2);
  say('所以能做某一類非常快速的查詢', '長度 L 的字串只走 L 步');
}]);

FRAG.push(['trie-hr-car', '前綴查詢：有沒有以 C-A-R 開頭的單字？', async (tok) => {
  hrBuild(HR_DICT);
  await step(tok);                                   // 0:38 存一個小字典
  note('小字典：' + HR_DICT.join(', '), 0, 1.6);
  say('把一個很小的英文字典存進 trie', '金色節點：有單字在這裡結束');
  await step(tok);                                   // 0:46 有沒有 C-A-R 開頭的？
  const q = pkt('查詢：C-A-R 開頭？', -4.6, 6.0);
  say('問：有沒有以 C-A-R 開頭的單字？', '從 root 走 c → a → r');
  await hrWalk(tok, 'car', 700);
  await step(tok);                                   // 0:52 car 本身是完整單字
  good('car：完整單字', 0, 0.9);
  say('有！car 本身就是一個完整單字', 'r 節點是金色的');
  await step(tok);                                   // 0:56 還有 card → car 也是前綴
  trRender(new Set(['c', 'ca', ...hrSub('car')]), hrNode('car'));
  note('car 底下還有 card、care → car 也是前綴', 0, 0.2);
  say('底下還有 card：car 同時也是前綴', '整棵 car 子樹就是答案');
  await step(tok);                                   // 0:59 非常快
  txt(q, '只走 3 步就知道');
  say('查詢非常快', '<span class="ok">只看字串長度，跟字典有多少字無關</span>');
}]);

FRAG.push(['trie-hr-node', '實作：Node 裡放 children 表和 isCompleteWord', async (tok) => {
  fresh([0, 4.2, 12], [0, 2.6, 0]);
  await step(tok);                                   // 1:06 class Node，不像 BST
  cube('Node', '#4b9ee2', [1.6, 0.8, 0.8], 0, 4.4, 0, 2);
  const L = cube('', '#d8cfc0', [0.8, 0.8, 0.8], -2.6, 2.2, 0), R = cube('', '#d8cfc0', [0.8, 0.8, 0.8], 2.6, 2.2, 0);
  const aL = arrow(V3(-0.6, 4.0, 0), V3(-2.3, 2.6, 0)), aR = arrow(V3(0.6, 4.0, 0), V3(2.3, 2.6, 0));
  const tL = tag('left', 'idx', -1.9, 3.5), tR = tag('right', 'idx', 1.9, 3.5);
  const b1 = bad('BST 的 node：只有 left / right 兩個指標', 0, 1.0);
  say('寫一個 class Node', '但不像 BST 只有 left、right 兩個指標');
  await step(tok);                                   // 1:14 children 陣列
  [L, R, aL, aR, tL, tR, b1].forEach(kill);
  const cells = [];
  for (let i = 0; i < 26; i++) cells.push(cube(String.fromCharCode(97 + i), '#f6deb0', [0.38, 0.38, 0.38], -5.25 + i * 0.42, 2.6, 0));
  const ta = tag('children[26]：每個字母一格（大多是空的）', 'ptr', 0, 1.6);
  say('做法一：children 陣列，每個字母一格', '用 children[ch − \'a\'] 直接找到');
  await step(tok);                                   // 1:21 更常用 lookup table
  cells.forEach(kill); kill(ta);
  const rows = ['a', 'o', 'r'].map((ch, i) => cube(ch + ' → ', '#f6deb0', [1.3, 0.5, 0.6], -1.2, 3.0 - i * 0.75, 0));
  const kids = ['a', 'o', 'r'].map((ch, i) => cube(ch, '#4b9ee2', [0.55, 0.55, 0.55], 2.4, 3.0 - i * 0.75, 0));
  rows.forEach((r, i) => arrow(V3(-0.45, 3.0 - i * 0.75, 0), V3(2.05, 3.0 - i * 0.75, 0)));
  tag('lookup table：字元 → 子節點', 'ptr', -1.2, 0.9);
  say('更常用 lookup table（例如 hash map）', '把字元對應到子節點，只存真的有的 child');
  await step(tok);                                   // 1:26 有沒有 A？馬上拿到
  const ask = pkt('有 A 這個 child 嗎？', -4.6, 3.0);
  glow(rows[0], GREEN); glow(kids[0], GREEN);
  say('可以馬上問：有沒有 A 這個 child？', '有的話直接拿到那個節點');
  await step(tok);                                   // 1:39 還要知道是不是完整單字
  glow(rows[0], null); glow(kids[0], null); kill(ask);
  glow(rows[2], GOLD); glow(kids[2], GOLD);
  const qq = bubble('走到 r：是完整單字？還是只是前綴？', 0, 5.5);
  say('光知道有 R 這個 child 還不夠', '還要知道走到這裡是不是一個完整單字');
  await step(tok);                                   // 1:53 isCompleteWord flag
  kill(qq);
  cube('true', '#c08a1f', [0.9, 0.5, 0.6], 2.0, 4.4, 0, 2);
  tag('isCompleteWord', 'ptr alt', 2.0, 5.2);
  good('每個節點多一個 flag：區分完整單字和前綴', 0, 0.2);
  say('每個節點再加一個 flag，例如 isCompleteWord', 'true：這裡是單字結尾　false：只是前綴');
}]);

FRAG.push(['trie-hr-uses', '什麼題目會用到 trie：單字驗證', async (tok) => {
  fresh([0, 4.2, 12.5], [0, 2.6, 0]);
  await step(tok);                                   // 2:05 跟單字驗證有關的題目
  const hd = note('面試題只要跟「驗證單字」有關 → 可能用到 trie', 0, 5.4);
  say('面試時拿到跟「單字驗證」有關的題目', 'trie 很可能派上用場');
  await step(tok);                                   // 2:14 拼字遊戲盤面找所有單字
  const G = ['CATS', 'ORED', 'DOGX', 'EARN'];
  const gc = [];
  G.forEach((row, j) => [...row].forEach((ch, i) => gc.push(cube(ch, '#f6deb0', [0.62, 0.62, 0.3], -5.0 + i * 0.75, 3.8 - j * 0.75, 0))));
  tag('拼字遊戲盤面', 'ptr', -3.9, 4.6);
  for (const k of [0, 1, 2]) glow(gc[k], GREEN);
  for (const k of [8, 9, 10]) glow(gc[k], GREEN);
  tag('CAT、DOG…', 'good', -3.9, 0.6);
  say('例：在拼字遊戲盤面上找出所有單字', '邊走邊用 trie 檢查「還是不是有效前綴」');
  await step(tok);                                   // 2:20 字串清單找名人名字
  const names = [['taylor swift', 1], ['qwzx', 0], ['tom hanks', 1], ['abcde', 0]];
  tag('字串清單', 'ptr', 3.6, 4.6);
  names.forEach(([s, ok], i) => tag(s, ok ? 'good' : 'idx', 3.6, 3.8 - i * 0.75));
  say('例：給一串字串，找出所有名人的名字', '名人名字先存進 trie，再逐一比對');
  await step(tok);                                   // 2:27 看到就想 trie
  txt(hd, 'word list validation → 想想 trie！');
  say('看到「單字清單驗證」類的題目', '就想想 trie 有沒有用');
}]);

FRAG.push(['trie-hr-incr', '最佳化：記住上次查到的節點', async (tok) => {
  hrBuild(HR_DICT);
  await step(tok);                                   // 2:38 使用者邊打字邊檢查
  const typed = pkt('輸入：', 0, 1.6);
  const st = tag('', 'idx', 0, 0.9);
  say('使用者邊打字，我們邊檢查', '一確定不可能成為單字，就畫底線');
  const show = async (w) => {
    txt(typed, '輸入：' + w.toUpperCase());
    const n = hrNode(w);
    if (n) { trRender(new Set(hrPre(w)), n); setCls(st, 'good'); txt(st, '✓ ' + w.toUpperCase() + ' 是有效前綴'); }
    else { setCls(st, 'bad'); txt(st, '✗ ' + w.slice(0, -1).toUpperCase() + ' 底下沒有 ' + w.slice(-1).toUpperCase() + ' → 畫底線'); }
  };
  await step(tok);                                   // 2:50 打 C
  await show('c'); say('打了 C：有可能變成單字', '');
  await step(tok);                                   // 2:55 CA
  await show('ca'); say('CA：還是有效前綴', '');
  await step(tok);                                   // 2:58 CAL
  await show('cal'); say('CAL：有 call、calm', '以 CAL 開頭的單字存在');
  await step(tok);                                   // 3:04 CALP → 錯
  await show('calp'); say('CALP：糟糕，沒有這種單字', '標成錯字');
  await step(tok);                                   // 3:09 天真做法：每次從 root 重查
  setCls(st, 'idx'); txt(st, '');
  const cnt = note('從 root 重查：0 步', -4.6, 6.2);
  let total = 0;
  for (const w of ['c', 'ca', 'cal']) {
    txt(typed, '查 ' + w.toUpperCase() + '：又從 root 開始');
    trRender(new Set(), TR.root); await beat(tok, 400);
    for (const p of hrPre(w)) { total++; txt(cnt, '從 root 重查：' + total + ' 步'); trRender(new Set(hrPre(p)), hrNode(p)); await beat(tok, 420); }
  }
  txt(typed, '1 + 2 + 3 + … ：一直重走同一段路');
  say('天真做法：每次都從 root 重查整個前綴', '前面走過的路一直重走');
  await step(tok);                                   // 3:26 記住上次的節點
  txt(cnt, '記住位置：每打一個字只要 1 步');
  for (const w of ['c', 'ca', 'cal']) {
    txt(typed, '打 ' + w.slice(-1).toUpperCase() + '：只問「是不是上一個節點的 child？」');
    trRender(new Set(hrPre(w)), hrNode(w)); await beat(tok, 900);
  }
  txt(typed, '打 P：cal 沒有 p 這個 child → 錯');
  say('更好：記住上次查到的節點', '下一個字元只要檢查是不是它的 child');
  await step(tok);                                   // 3:53 兩種實作
  kill(typed);
  good('做法一：trie 自己保存「目前位置」', 0, 1.7);
  good('做法二：把 node 回傳給呼叫者', 0, 0.9);
  setCls(st, 'idx'); txt(st, '下次直接從那個 node 往下問');
  st.position.set(0, 0.1, 0);
  say('實作方式有兩種', '在 trie 內保存狀態，或把節點回傳給呼叫者');
}]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

  return {
    kicker: '資料結構・第 9 章',
    title: '進階樹：B-Tree、B+ Tree、Trie',
    color: 'var(--ds)',
    modes: [
      { id: 'bins', name: 'B-Tree 插入', enter: () => enterBTree('ins') },
      { id: 'bdel', name: 'B-Tree 刪除', enter: () => enterBTree('del') },
      { id: 'bplus', name: 'B+ Tree', enter: () => enterBPlus() },
      { id: 'trie', name: 'Trie', enter: () => enterTrie() },
    ],
    pages: [
      { id: 'cmp', name: 'B / B+ / Trie 對照', render: renderCmp },
      { id: 'quiz', name: '小測驗', render: renderQuiz },
    ],
    scenes,
    sceneOrder: ['btree-split', 'btree-order5', 'btree-borrow', 'btree-merge', 'btree-internal-delete', 'bplus-copy-up', 'bplus-range', 'trie-prefix'].concat(FRAG.map((f) => f[0])),
    stop() { clearInterval(timer); epoch++; busy = false; },
  };
}
