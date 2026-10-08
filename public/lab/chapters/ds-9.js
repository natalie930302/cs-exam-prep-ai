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
      + '<tr><th>根最少</th><td>2 個子節點（只有根一個節點時可以只有 1 個 key）</td></tr>'
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
    const opts = [...p.opts].sort(() => Math.random() - 0.5);
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
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, showL, anim, line, arrow, ghostBox, GOLD, GREEN, RED, GRAY } = K;
// 共用：用本章的 B-tree 引擎（BT / renderTree）畫出講者自己的樹
function btShow(m, root, mode) { BT.m = m; enterBTree(mode || 'ins'); BT.root = root; btRender(); }
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
// B+ tree（Ramakrishnan 的 order d）畫法：葉子串 link、索引 key 灰色、葉子下面的 * 是 data pointer
function bpTree(root) {
  const leaves = []; (function w(n) { if (isLeaf(n)) leaves.push(n); else n.kids.forEach(w); })(root);
  leaves.forEach((l, i) => { l.next = leaves[i + 1] || null; });
  return leaves;
}
function bpView(root, d, hl, extra) {
  const v = extra || { bodies: new Map(), statics: [], ring: null };
  if (!v.ring) v.ring = makeRing();
  const leaves = bpTree(root);
  const pos = renderTree(v, root, { m: 2 * d + 1, plus: true, minLeaf: d, ids: (n, k) => (isLeaf(n) ? 'L' : 'I') + k, leafColor: (k) => colorFor(k) });
  for (const [id, b] of v.bodies) { if (id[0] === 'I') b.obj.material.color.set('#b9a582'); b.obj.material.emissive = new THREE.Color(hl && hl.has(id) ? '#1d5a2c' : '#000000'); }
  const { s } = layoutTree(root);
  v.pos = pos; v.s = s; v.leaves = leaves;
  return v;
}
function bpStars(v, back) {
  const out = [];
  v.leaves.forEach((l, j) => {
    const p = v.pos.get(l);
    l.keys.forEach((k, i) => out.push(tag(k + '*', 'idx', keyX(p, i, l.keys.length, v.s), p.y - 0.75, 0.3)));
    if (back && l.next) { const q = v.pos.get(l.next); out.push(arrow(V3(q.x - (l.next.keys.length * KW * v.s) / 2 - 0.04, q.y - 0.5, 0.55), V3(p.x + (l.keys.length * KW * v.s) / 2 + 0.04, p.y - 0.5, 0.55), 0x4b9ee2)); }
  });
  return out;
}
const bpRing = (v, n) => ringAt(v, v.pos, n, v.s);
const RK1 = () => T([40], T([20, 33], T([10, 15]), T([20, 27]), T([33, 37])), T([51, 63], T([40, 46]), T([51, 55]), T([63, 97])));
const RK2 = () => T([13, 17, 24, 30], T([2, 3, 5, 7]), T([14, 16]), T([19, 20, 22]), T([24, 27, 29]), T([33, 34, 38, 39]));
function bpDescend(root, k) {
  const path = []; let n = root;
  while (!isLeaf(n)) { path.push(n); let i = 0; while (i < n.keys.length && k >= n.keys[i]) i++; n = n.kids[i]; }
  path.push(n); return path;
}
async function bpWalk(tok, v, root, k) {
  for (const n of bpDescend(root, k)) {
    bpRing(v, n);
    if (isLeaf(n)) { say('到葉節點 [' + n.keys.join(', ') + ']', n.keys.includes(k) ? '<span class="ok">有 ' + k + ' → hit，跟著 ' + k + '* 去拿 record</span>' : '<span class="no">沒有 ' + k + ' → 找不到</span>'); }
    else { let i = 0; while (i < n.keys.length && k >= n.keys[i]) i++; say('比較 ' + k + ' 和 [' + n.keys.join(', ') + ']', i === 0 ? k + ' < ' + n.keys[0] + ' → 最左邊 pointer' : i === n.keys.length ? k + ' ≥ ' + n.keys[i - 1] + ' → 最右邊 pointer' : n.keys[i - 1] + ' ≤ ' + k + ' < ' + n.keys[i] + ' → 第 ' + (i + 1) + ' 個 pointer'); }
    await beat(tok, 1500);
  }
  return bpDescend(root, k).pop();
}

// ─── IilVRpUsAiQ：B-Tree Insertion（order 4，keys 5 3 21 9 1 13 2 7 10 12 4）───
const HI = [5, 3, 21, 9, 1, 13, 2, 7, 10, 12, 4];
function hiPre(n) { BT.m = 4; BT.root = null; for (const k of HI.slice(0, n)) for (const _ of btInsert(k)) { /* silent */ } return BT.root; }
FRAG.push(['btree-hi-rules', 'order 4 的 B-tree：最多 3 個 key、至少 1 個', async (tok) => {
  fresh([0, 5, 12], [0, 1.6, 0]);
  const ptrs = [], keys = [];
  for (let i = 0; i < 4; i++) ptrs.push(cube('', '#d8c29b', [0.4, 0.7, 1], -3.15 + i * 2.1, 2, 0));
  for (let i = 0; i < 3; i++) keys.push(cube('', GRAY, [1.5, 0.7, 1], -2.1 + i * 2.1, 2, 0));
  tag('m = 4：4-way search tree', 'ptr', 0, 3.6);
  say('order m = 4：最多 4 個 child', '4-way search tree');
  await beat(tok, 2400);
  keys.forEach((k, i) => { tint(k, '#4b9ee2'); tag('key ' + (i + 1), 'idx', -2.1 + i * 2.1, 1.1); });
  say('每個 node 最多 m − 1 = 3 個 key', '第 4 個 key 進來 → 要 split');
  await beat(tok, 3000);
  ptrs.forEach((p) => glow(p, GOLD));
  say('internal node 至少 ⌈m/2⌉ 個 child', '⌈4/2⌉ = 2 個 child');
  await beat(tok, 2800);
  ptrs.forEach((p, i) => { if (i > 1) tint(p, GRAY); glow(p, null); });
  keys.forEach((k, i) => { if (i > 0) tint(k, GRAY); });
  glow(keys[0], GOLD);
  say('2 個 child → 至少 1 個 key', 'order 4：每個 node 1 ～ 3 個 key');
  await beat(tok, 3000);
  say('插入跟 BST 一樣先找位置', '只是 node 裡的 key 要排好序');
  await beat(tok, 2600);
}]);
FRAG.push(['btree-hi-split5', '插入 5 3 21，再插 9 第一次分裂', async (tok) => {
  fresh([0, 5.2, 14.5], [0, 2.6, 0]);
  btShow(4, null);
  say('order 4：一個 node 放 3 個 key', '依序插入 5, 3, 21, 9');
  await beat(tok, 2000);
  for (const k of [5, 3, 21]) await btDoInsert(k, tok);
  say('3, 5, 21 照大小排好，node 滿了', '下一個 9 沒有位置');
  await beat(tok, 2200);
  await btDoInsert(9, tok);
  say('偶數 order：中間有兩個可選', '老師選 5 往上（左邊少一個）');
  await beat(tok, 2600);
  say('3 在 5 的左邊，9, 21 在右邊', '選 9 往上也可以，只是另一棵樹');
  await beat(tok, 2600);
}]);
FRAG.push(['btree-hi-split9', '插入 1 13 2 7：9 往上', async (tok) => {
  fresh([0, 5.2, 14.5], [0, 2.6, 0]);
  btShow(4, hiPre(4));
  say('目前：根 5，左 [3]，右 [9, 21]', '接著插入 1, 13, 2, 7');
  await beat(tok, 2200);
  for (const k of [1, 13, 2, 7]) await btDoInsert(k, tok);
  say('7, 9, 13, 21 → 9 往上', '根變成 [5, 9]：三個 child');
  await beat(tok, 3000);
}]);
FRAG.push(['btree-hi-split12', '插入 10 12：12 往上', async (tok) => {
  fresh([0, 5.2, 14.5], [0, 2.6, 0]);
  btShow(4, hiPre(8));
  say('9 < 10 < 13：10 放進 [13, 21]', '接著插入 10, 12');
  await beat(tok, 2200);
  for (const k of [10, 12]) await btDoInsert(k, tok);
  say('10, 12, 13, 21 → 12 往上', '根 [5, 9, 12] 也滿了');
  await beat(tok, 3000);
}]);
FRAG.push(['btree-hi-cascade', '插入 4：連續分裂，5 成為新根', async (tok) => {
  fresh([0, 5.2, 14.5], [0, 2.6, 0]);
  btShow(4, hiPre(10));
  say('3 < 4 < 5：4 進 [1, 2, 3]', '葉子滿 → 2 往上 → 根也滿');
  await beat(tok, 2400);
  await btDoInsert(4, tok);
  say('根 [2, 5, 9, 12] 再分裂：5 往上', '左 [2]：1 | 3,4　右 [9,12]：7 | 10 | 13,21');
  await beat(tok, 3400);
  say('order 4 的 B-tree 完成', '所有葉子在同一層');
  await beat(tok, 2600);
}]);

// ─── aZjYr87r1b8：Abdul Bari B Trees and B+ Trees ───
function circle(r, y, color, seg = 64) {
  const pts = []; for (let i = 0; i <= seg; i++) { const a = (i / seg) * Math.PI * 2; pts.push(V3(Math.cos(a) * r, y, Math.sin(a) * r)); }
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color })); lab.world.add(l); return l;
}
function seg3(a, b, color) { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color })); lab.world.add(l); return l; }
FRAG.push(['btree-ab-disk', 'Disk：track、sector、block、offset', async (tok) => {
  fresh([0, 10, 7.5], [0, 0, 0.4]);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 0.1, 48), new THREE.MeshStandardMaterial({ color: '#e8dcc4' }));
  plate.position.y = -0.06; lab.world.add(plate);
  const R = [1.2, 1.9, 2.6, 3.3];
  say('disk 像一張 platter', '同心圓 = track，扇形 = sector');
  await beat(tok, 2000);
  R.forEach((r, i) => { circle(r + 0.35, 0.01, '#8a7a60'); tag('track ' + i, 'idx', r, 0.1, 0.25); });
  circle(0.85, 0.01, '#8a7a60');
  await beat(tok, 1600);
  for (let s = 0; s < 6; s++) { const a = (s / 6) * Math.PI * 2; seg3(V3(Math.cos(a) * 0.85, 0.01, Math.sin(a) * 0.85), V3(Math.cos(a) * 3.65, 0.01, Math.sin(a) * 3.65), '#8a7a60'); const b = a + Math.PI / 6; tag('sector ' + s, 'idx', Math.cos(b) * 4.2, 0.1, Math.sin(b) * 4.2); }
  say('切成 track 0–3、sector 0–5', '');
  await beat(tok, 2000);
  const a0 = Math.PI / 6, r1 = 1.9;
  const blk = cube('', '#f0a030', [0.7, 0.18, 0.5], Math.cos(a0) * r1, 0.1, Math.sin(a0) * r1, 3);
  say('track 和 sector 交會的一格 = block', 'block 位址 = (track 1, sector 0)');
  await beat(tok, 2600);
  say('block 大小通常假設 512 bytes', '讀寫 disk 一律以 block 為單位');
  await beat(tok, 2400);
  const cells = []; for (let i = 0; i < 8; i++) cells.push(cube('', '#f6deb0', [0.5, 0.2, 0.5], -1.75 + i * 0.5, 1.6, 2.8));
  tag('0', 'idx', -1.75, 1.6, 3.4); tag('511', 'idx', 1.75, 1.6, 3.4);
  glow(cells[2], RED); tag('offset', 'ptr alt', -0.75, 2.3, 2.8);
  say('block 內每個 byte 有 offset 0–511', '找一個 byte = track + sector + offset');
  await beat(tok, 2800);
  const head = cube('head', '#6e5f49', [2.4, 0.15, 0.3], 4.6, 0.5, 0.9);
  move(head, 3.0, 0.5, 0.9);
  say('轉 platter 換 sector，移 head 換 track', '');
  await beat(tok, 2600);
  glow(blk, GOLD);
  await beat(tok, 2000);
}]);
FRAG.push(['btree-ab-ram', 'Disk 的資料要先搬進 RAM', async (tok) => {
  fresh([0, 6, 12], [0, 1.4, 0]);
  ghostBox('#8a7a60', 4.4, 2.2, 3).position.set(-3.6, 1.1, 0); tag('Disk', 'ptr', -3.6, 2.8);
  ghostBox('#4b9ee2', 4.4, 2.2, 3).position.set(3.6, 1.1, 0); tag('Main memory (RAM)', 'ptr alt', 3.6, 2.8);
  const blocks = []; for (let i = 0; i < 6; i++) blocks.push(cube('', '#f0a030', [0.9, 0.5, 0.9], -4.8 + (i % 3) * 1.2, 0.4 + Math.floor(i / 3) * 0.7, 0));
  const prog = cube('程式', '#9b7ef4', [1.4, 0.6, 1], 4.4, 0.4, 0);
  say('程式在 main memory 裡執行', '不能直接在 disk 上處理資料');
  await beat(tok, 2600);
  glow(blocks[4], GOLD); move(blocks[4], 2.6, 0.4, 0);
  say('要用 disk 的資料：先把 block 讀進 RAM', 'disk → RAM');
  await beat(tok, 2600);
  glow(blocks[4], GREEN); glow(prog, GOLD);
  say('在 RAM 裡處理完', '');
  await beat(tok, 1600);
  move(blocks[4], -3.6, 1.1, 0); glow(prog, null);
  say('結果再寫回 disk', 'RAM → disk');
  await beat(tok, 2200);
  tag('Data Structures', 'ptr alt', 3.6, -0.6); tag('DBMS', 'ptr', -3.6, -0.6);
  say('RAM 裡怎麼放 = data structure', 'disk 上怎麼放 = DBMS');
  await beat(tok, 3000);
}]);
function blockGrid(n, cols, x0, z0, dx, dz, color, y = 0.25) {
  const bs = []; for (let i = 0; i < n; i++) bs.push(cube('', color, [dx * 0.8, 0.35, dz * 0.7], x0 + (i % cols) * dx, y, z0 + Math.floor(i / cols) * dz));
  return bs;
}
FRAG.push(['btree-ab-table', '100 筆 record 要 25 個 block', async (tok) => {
  fresh([0, 9, 9], [0, 0, 0.5]);
  const cols = ['eid 10', 'name 50', 'dept 10', 'section 8', 'add 50'];
  cols.forEach((c, i) => cube(c, '#e2d3b6', [1.7, 0.4, 0.7], -4.4 + i * 2.2, 2.6, -3.2));
  say('employee table：5 個欄位', '10 + 50 + 10 + 8 + 50 = 128 bytes / record');
  await beat(tok, 2800);
  say('block 512 bytes', '512 / 128 = 4 個 record / block');
  const one = []; for (let r = 0; r < 4; r++) one.push(cube('', '#4b9ee2', [3.0, 0.22, 0.4], -4.2, 0.2 + r * 0.26, -1.4, 3));
  tag('1 block = 4 rows', 'idx', -4.2, 1.5, -1.4);
  await beat(tok, 2600);
  const bs = blockGrid(25, 5, -1.0, -1.4, 1.3, 0.95, '#f0a030');
  say('100 rows / 4 = 25 個 block', '整張表佔 25 個 block');
  await beat(tok, 2600);
  say('找 eid = 5 的 record？不知道在哪', '只能一個 block 一個 block 讀');
  await beat(tok, 2000);
  await anim(tok, 3200, (t) => { const k = Math.min(24, Math.floor(t * 25)); bs.forEach((b, i) => glow(b, i <= k ? GOLD : null)); });
  say('最壞要讀 25 個 block', '時間 ∝ 存取的 block 數');
  await beat(tok, 2600);
}]);
FRAG.push(['btree-ab-index', 'Dense index：4 + 1 = 5 次 block 存取', async (tok) => {
  fresh([0, 9, 9.5], [0, 0, 0.4]);
  const tb = blockGrid(25, 5, 0.6, -1.6, 1.3, 0.95, '#f0a030'); tag('table：25 blocks', 'ptr', 3.2, 1.2, -2.6);
  say('建 index：每筆 record 一個 entry', 'entry = key（eid）+ record pointer');
  await beat(tok, 2600);
  const ent = []; for (let i = 0; i < 5; i++) ent.push(cube('eid ' + (i + 1), '#9b7ef4', [1.4, 0.3, 0.45], -4.8, 0.2, -2.6 + i * 0.55));
  const ar = arrow(V3(-4.1, 0.25, -2.6), V3(0.3, 0.3, -1.6), 0x6e5f49);
  say('每筆都有 entry → dense index', 'index 也存在 disk 上');
  await beat(tok, 2600);
  ent.forEach(kill); kill(ar);
  say('entry 大小 10 + 6 = 16 bytes', '512 / 16 = 32 個 entry / block');
  await beat(tok, 2600);
  const ib = blockGrid(4, 1, -4.6, -1.8, 1.6, 1.0, '#9b7ef4'); tag('index：4 blocks', 'ptr alt', -4.6, 1.2, -2.6);
  say('100 / 32 ≈ 3.x → 4 個 block', 'index 只要 4 個 block');
  await beat(tok, 2600);
  for (const b of ib) { glow(b, GOLD); say('先在 index 裡找', '最多讀 4 個 index block'); await beat(tok, 600); }
  const a2 = arrow(V3(-3.8, 0.4, 1.2), V3(1.9, 0.4, 0.3), 0x2fc092); glow(tb[12], GREEN);
  say('拿到 pointer，直接讀那 1 個 block', '4 + 1 = 5 次，不是 25 次');
  await beat(tok, 3200);
  kill(a2);
}]);
FRAG.push(['btree-ab-multilevel', 'Multi-level index：再蓋一層 sparse index', async (tok) => {
  fresh([0, 6.5, 12], [0, 2.2, 0]);
  const tb = []; for (let i = 0; i < 25; i++) tb.push(cube('', '#f0a030', [0.42, 0.4, 0.8], -6 + i * 0.5, 0.2, 0));
  tag('table：1000 rows → 250 blocks', 'ptr', 0, 1.0, 1.2);
  say('record 變 1000 筆', 'table 250 blocks，index 變 40 blocks');
  await beat(tok, 2600);
  const ix = []; for (let i = 0; i < 20; i++) ix.push(cube('', '#9b7ef4', [0.42, 0.4, 0.8], -4.75 + i * 0.5, 2.4, 0, 3));
  tag('index：1000 entries → 40 blocks', 'ptr alt', 0, 3.2, 1.2);
  say('index 自己也太大，搜尋變慢', '能不能幫 index 再做 index？');
  await beat(tok, 2600);
  const hi = [cube('1', '#2fc092', [0.9, 0.5, 0.8], -1, 4.6, 0, 3), cube('33…', '#2fc092', [0.9, 0.5, 0.8], 1, 4.6, 0, 3)];
  tag('high-level index：2 blocks', 'ptr alt', 0, 5.5, 1.2);
  const a1 = arrow(V3(-1, 4.3, 0), V3(-4.75, 2.7, 0)), a2 = arrow(V3(1, 4.3, 0), V3(1.2, 2.7, 0));
  say('每個 index block 只放一個 entry', '一個 entry 管 32 個 entry → sparse index');
  await beat(tok, 3000);
  say('40 個 entry / 32 → 2 個 block', '');
  await beat(tok, 2000);
  glow(hi[0], GOLD); say('讀 high-level index', '最多 2 個 block'); await beat(tok, 1400);
  glow(ix[3], GOLD); say('讀 1 個 index block', '+ 1'); await beat(tok, 1300);
  glow(tb[7], GOLD); say('讀 1 個 table block', '+ 1'); await beat(tok, 1300);
  say('多一層 index，存取 block 數更少', '2 + 1 + 1 = 4 次');
  await beat(tok, 3000);
  kill(a1); kill(a2);
}]);
FRAG.push(['btree-ab-index-tree', '多層 index 轉過來就是一棵樹', async (tok) => {
  fresh([0, 5.5, 13], [0, 1.6, 0]);
  const g = new THREE.Group(); lab.world.add(g);
  const add = (color, w, x, y) => { const m = lab.box(color, [w, 0.4, 0.8]); m.position.set(x, y, 0); g.add(m); return m; };
  const lv = [[1, '#2fc092'], [3, '#9b7ef4'], [9, '#f0a030']];
  lv.forEach(([n, c], d) => { for (let i = 0; i < n; i++) add(c, 0.9, -4 + d * 3, (i - (n - 1) / 2) * 0.52 + 1.8); });
  const tl = [tag('table', 'idx', 2, 4.5), tag('index', 'idx', -1, 4.5), tag('high-level', 'idx', -4, 4.5)];
  say('index 一層一層往上加', '每層 entry 指向下一層的一組 entry');
  await beat(tok, 2800);
  tl.forEach(kill);
  await anim(tok, 2600, (t) => { g.rotation.z = -t * Math.PI / 2; g.position.set(0, 2.0 * t, 0); });
  tag('root（high-level index）', 'ptr alt', 1.8, 6.6); tag('最下層指向 table', 'idx', 4.2, 0.0);
  say('把它轉過來看：就像一棵樹', 'root = 最上層 index');
  await beat(tok, 3000);
  say('table 變大要自動加一層 index', '刪資料時也要自動拿掉一層');
  await beat(tok, 2800);
  say('self-managed multi-level index', '→ B-tree、B+ tree 的由來');
  await beat(tok, 3000);
}]);
FRAG.push(['btree-ab-mway', 'm-way search tree：3-way 例子', async (tok) => {
  fresh([0, 5.2, 14.5], [0, 2.6, 0]);
  btShow(3, T([20, 50], T([10, 15]), T([30, 35]), T([60, 90])));
  say('BST：每個 node 1 個 key、2 個 child', '多放 key 呢？');
  await beat(tok, 2400);
  say('[20, 50]：< 20 | 20～50 | > 50', '10,15 | 30,35 | 60,90');
  await beat(tok, 2800);
  await drive(findKey(30), btRender, tok);
  say('每個 node 最多 3 個 child → 3-way', 'm-way：最多 m 個 child、m − 1 個 key');
  await beat(tok, 3000);
  say('BST = degree 2 的 m-way search tree', 'm 可以是 3、5、100、1000');
  await beat(tok, 2600);
}]);
FRAG.push(['btree-ab-node', '4-way 節點：child pointer + key + record pointer', async (tok) => {
  fresh([0, 5, 11], [0, 1.2, 0]);
  const parts = [];
  for (let i = 0; i < 7; i++) {
    const isP = i % 2 === 0, x = -4.5 + i * 1.5;
    parts.push(cube(isP ? 'cp' : 'K' + (i + 1) / 2, isP ? '#d8c29b' : '#4b9ee2', [isP ? 0.7 : 1.2, 0.7, 1], x, 2, 0, 3));
  }
  say('4-way node：4 個 child pointer、3 個 key', 'cp K1 cp K2 cp K3 cp');
  await beat(tok, 2800);
  const kids = []; for (let i = 0; i < 4; i++) { const x = -4.5 + i * 3; kids.push(arrow(V3(x, 1.6, 0), V3(x * 1.1, 0.2, 0))); }
  say('cp 指向下一層的 node（block）', '');
  await beat(tok, 2200);
  const rs = [];
  for (let i = 0; i < 3; i++) { const x = -3 + i * 3; rs.push(arrow(V3(x, 1.6, 0.3), V3(x, 0.5, 2.6), 0x2fc092)); cube('rec', '#2fc092', [0.8, 0.4, 0.5], x, 0.25, 2.9); }
  say('當 index 用：每個 key 多一個 record pointer', '指向 disk 上那筆資料');
  await beat(tok, 3000);
  say('這就是 B-tree 的 node 結構', 'key + child pointer + record pointer');
  await beat(tok, 2800);
}]);
FRAG.push(['btree-ab-skew', 'm-way search tree 的問題：沒規則可能長成一條線', async (tok) => {
  fresh([0, 5, 13], [0, 2.4, 0]);
  say('10-way search tree：一個 node 可放 9 個 key', '插入 10, 20, 30');
  await beat(tok, 2400);
  const ns = [];
  for (let i = 0; i < 3; i++) {
    const x = -3 + i * 2.6, y = 4.2 - i * 1.6;
    const slot = cube('', GRAY, [3.0, 0.5, 0.9], x + 1.5, y, 0);
    ns.push(cube(String((i + 1) * 10), '#4b9ee2', [0.7, 0.6, 0.8], x - 0.4, y + 0.05, 0, 3));
    if (i) line(x - 3.0, y + 1.3, x - 0.4, y + 0.35);
    say(i ? '不塞進同一個 node，另開一個 child' : '10 放進新 node（還有 8 格空）', i ? (i * 10 + 10) + ' 變成下一層' : '');
    await beat(tok, 1700);
    void slot;
  }
  ns.forEach((n) => glow(n, RED));
  say('沒有規則：n 個 key 高度可能是 n', '搜尋退化成 linear search');
  await beat(tok, 3000);
  say('應該先把 node 填滿再開新 node', '這些規則 = B-tree');
  await beat(tok, 2800);
}]);
FRAG.push(['btree-ab-rules', 'B-tree 的四條規則', async (tok) => {
  fresh([0, 5.2, 14.5], [0, 2.6, 0]);
  btShow(4, T([30, 40, 70], T([10, 20]), T([35]), T([50, 60]), T([80])));
  say('B-tree = 有規則的 m-way search tree', '');
  await beat(tok, 2200);
  say('① 每個 node 至少 ⌈m/2⌉ 個 child', 'm = 10 → 至少 5 個 child 才開新 node');
  await beat(tok, 3000);
  say('② root 至少 2 個 child', 'root 可以只有 1 個 key');
  await beat(tok, 2600);
  const lv = line(-6, 0.15, 6, 0.15, 0.6, '#2fc092');
  say('③ 所有 leaf 在同一層', '');
  await beat(tok, 2400);
  say('④ 建立過程是 bottom-up', '往上分裂，樹從 root 長高');
  await beat(tok, 3000);
  kill(lv);
}]);
const AB = [10, 20, 40, 50, 60, 70, 80, 30, 35, 5, 15];
function abPre(n) { BT.m = 4; BT.root = null; for (const k of AB.slice(0, n)) for (const _ of midInsert(k, 2)) { /* silent */ } return BT.root; }
async function abIns(tok, ks) { for (const k of ks) await drive(midInsert(k, 2), btRender, tok); }
FRAG.push(['btree-ab-ins1', 'degree 4 插入 10 20 40 50：40 往上', async (tok) => {
  fresh([0, 5.2, 14.5], [0, 2.6, 0]);
  btShow(4, null);
  say('degree 4：最多 4 個 child、3 個 key', '插入 10, 20, 40, 50');
  await beat(tok, 2200);
  await abIns(tok, [10, 20, 40, 50]);
  say('10, 20 留左邊，50 去右邊，40 往上', '樹往上長：bottom-up');
  await beat(tok, 3000);
  say('上層就是自動長出來的第二層 index', '');
  await beat(tok, 2400);
}]);
FRAG.push(['btree-ab-ins2', '插入 60 70 80、30 35', async (tok) => {
  fresh([0, 5.2, 14.5], [0, 2.6, 0]);
  btShow(4, abPre(4));
  say('繼續插入 60, 70, 80', '');
  await beat(tok, 1800);
  await abIns(tok, [60, 70, 80]);
  say('50, 60 | 70 往上 | 80', '根變 [40, 70]');
  await beat(tok, 2200);
  await abIns(tok, [30, 35]);
  say('10, 20 | 30 往上 | 35', '根 [30, 40, 70]：滿了就 split');
  await beat(tok, 3000);
}]);
FRAG.push(['btree-ab-ins3', '插入 5 15：連續分裂，40 成為新根', async (tok) => {
  fresh([0, 5.2, 14.5], [0, 2.6, 0]);
  btShow(4, abPre(9));
  say('插入 5, 15', '');
  await beat(tok, 1600);
  await abIns(tok, [5, 15]);
  say('這裡送第 3 個 key 上去（left biased）', '送第 2 個也行，左右偏都可以');
  await beat(tok, 3000);
  say('三層 index：所有 leaf 在同一層', '樹高是 bottom-up 長出來的');
  await beat(tok, 3000);
}]);
FRAG.push(['btree-ab-recptr', 'B-tree：每個 key 都有 record pointer', async (tok) => {
  fresh([0, 5.4, 14.5], [0, 2.4, 0.6]);
  btShow(4, abPre(11));
  say('完成的 B-tree（degree 4）', '');
  await beat(tok, 2200);
  const ars = []; let k = 0;
  const { pos, s } = layoutTree(BT.root);
  pos.forEach((p, n) => { n.keys.forEach((key, i) => { const x = keyX(p, i, n.keys.length, s); ars.push(arrow(V3(x, p.y - 0.2, 0.45), V3(x, p.y - 0.65, 1.7), 0x2fc092)); k++; }); });
  say('每個 key 都有一個 record pointer', '指向 database 裡那筆 record');
  await beat(tok, 3000);
  say('B-tree 的 node 有三樣東西', 'key + child pointer + record pointer');
  await beat(tok, 3000);
  ars.forEach(kill);
}]);
FRAG.push(['btree-ab-bplus', 'B+ tree：key 全部複製到 leaf，leaf 串成 list', async (tok) => {
  fresh([0, 5.4, 14.5], [0, 2.4, 0.4]);
  btShow(4, abPre(11));
  say('從剛才的 B-tree 改成 B+ tree', '');
  await beat(tok, 2200);
  lab.clear();
  lab.frameCamera([0, 5.4, 14.5], [0, 2.4, 0.4]);
  const root = T([40], T([15, 30], T([5, 10]), T([15, 20]), T([30, 35])), T([70], T([40, 50, 60]), T([70, 80])));
  const v = bpView(root, 1);
  say('非 leaf 的 key 在 leaf 也有一份副本', '15、30、40、70 都下到 leaf');
  await beat(tok, 3000);
  const ars = [];
  v.leaves.forEach((l) => { const p = v.pos.get(l); l.keys.forEach((key, i) => { const x = keyX(p, i, l.keys.length, v.s); ars.push(arrow(V3(x, p.y - 0.2, 0.45), V3(x, p.y - 0.65, 1.7), 0x2fc092)); }); });
  say('record pointer 只從 leaf 出來', '上層沒有 record pointer');
  await beat(tok, 3000);
  say('leaf 在同一層，串成 linked list', 'leaf 層 = dense index');
  await beat(tok, 2800);
  say('上面幾層 = sparse index', 'B+ tree 更像 multi-level index');
  await beat(tok, 3000);
}]);

// ─── ucL0BLz2OGk：交大彭文志 Lec26（2-3 tree、B+ tree、R-tree）───
FRAG.push(['btree-p-23tree', '2-3 tree 就是 order 3 的 B-tree', async (tok) => {
  fresh([0, 5.2, 13], [0, 2.4, 0]);
  btShow(3, T([40], T([10, 20]), T([80])));
  say('2-3 tree = order 3 的 B-tree', '2-3-4 tree = order 4');
  await beat(tok, 2600);
  const t1 = tag('B：3 個 pointer', 'ptr', -2.4, -0.4), t2 = tag('C：2 個 pointer', 'ptr alt', 2.4, -0.4);
  say('非 root 至少 ⌈3/2⌉ = 2 個 child', '所以每個 node 有 2 或 3 個 pointer');
  await beat(tok, 3200);
  say('root 至少要 2 個 pointer', '');
  await beat(tok, 2400);
  kill(t1); kill(t2);
  say('2 個 child 或 3 個 child → 2-3 tree', '');
  await beat(tok, 2400);
}]);
const P23 = () => T([20, 40], T([10]), T([30]), T([70, 80]));
FRAG.push(['btree-p-search', '2-3 tree 搜尋的四種情況', async (tok) => {
  fresh([0, 5.2, 13], [0, 2.4, 0]);
  btShow(3, P23());
  say('跟 binary search tree 一樣比大小', 'node 裡有 first key、second key');
  await beat(tok, 2400);
  for (const k of [10, 30, 80, 40]) await drive(findKey(k), btRender, tok);
  say('x < first、介於中間、x > second、equal', '四種 case');
  await beat(tok, 3000);
}]);
FRAG.push(['btree-p-insert60', '2-3 tree 插入 60：連鎖 split', async (tok) => {
  fresh([0, 5.2, 13], [0, 2.4, 0]);
  btShow(3, P23());
  say('插入：先找到要放的 leaf node u', 'u 有空位 → 直接放');
  await beat(tok, 2400);
  say('u 滿了 → split', '最大的放新 node、中間的送 parent、最小的留在 u');
  await beat(tok, 3000);
  await btDoInsert(60, tok);
  say('C 和 A 連續 split：連鎖反應', '新 root 40，樹高 +1');
  await beat(tok, 3000);
  say('60 還是存在 leaf node 裡', '');
  await beat(tok, 2200);
}]);
const PD = () => T([50, 80], T([10, 20]), T([60, 70]), T([90, 95]));
FRAG.push(['btree-p-del-leaf', '2-3 tree 刪除 70、90', async (tok) => {
  fresh([0, 5.2, 13], [0, 2.4, 0]);
  btShow(3, PD(), 'del');
  say('原本的 2-3 tree（a）', 'insert 會 split，delete 會牽涉 merge');
  await beat(tok, 2600);
  await btDoDelete(70, tok);
  say('（b）70 在 leaf C：直接刪', 'C 還剩 60');
  await beat(tok, 2200);
  await btDoDelete(90, tok);
  say('（c）90 刪掉，D 還剩 95', '都還有 key，不用調整');
  await beat(tok, 2800);
}]);
FRAG.push(['btree-p-del-rotate', '刪 60 要 rotate、刪 95 要 combine', async (tok) => {
  fresh([0, 5.2, 13], [0, 2.4, 0]);
  btShow(3, T([50, 80], T([10, 20]), T([60]), T([95])), 'del');
  say('刪 60：C 會變空', '');
  await beat(tok, 1800);
  await btDoDelete(60, tok);
  say('rotate：50 往下推，20 往上送', '兄弟 B 有 2 個 key，借得起');
  await beat(tok, 3000);
  say('再刪 95：D 會變空', '兄弟 C 只有 50，不能 rotate');
  await beat(tok, 2200);
  await btDoDelete(95, tok);
  say('combine：80 往下 merge 到 C', 'C = [50, 80]，D 被刪掉');
  await beat(tok, 3200);
}]);
FRAG.push(['btree-p-rotate-cases', 'Rotate 的三種情況', async (tok) => {
  fresh([0, 5, 12], [0, 1.6, 0]);
  const XS = [-4, 0, 4], C = '#4b9ee2';
  const cases = [
    { p: 0, q: 1, down: 'x', up: 'y', r: ['x', 'z'], kids: [[], ['y', 'w'], ['v']], cap: 'p 是 r 的 left child', f: 'x 往下推到 p，y 往上提到 r', after: ['y', 'z'], pk: 'x' },
    { p: 1, q: 2, down: 'z', up: 'y', r: ['x', 'z'], kids: [['u'], [], ['y', 'w']], cap: 'p 是 r 的 middle child', f: 'z 往下推，y 往上提', after: ['x', 'y'], pk: 'z' },
    { p: 2, q: 1, down: 'z', up: 'y', r: ['x', 'z'], kids: [['u'], ['w', 'y'], []], cap: 'p 是 r 的 right child', f: 'z 往下推，y 往上提，x 不動', after: ['x', 'y'], pk: 'z' },
  ];
  for (const cs of cases) {
    const rk = cs.r.map((t, i) => cube(t, C, [0.8, 0.6, 0.8], -0.45 + i * 0.9, 3.4, 0));
    tag('r', 'ptr', -1.6, 3.4);
    const kk = cs.kids.map((ks, j) => ks.map((t, i) => cube(t, j === cs.q ? '#2fc092' : C, [0.8, 0.6, 0.8], XS[j] - (ks.length - 1) * 0.45 + i * 0.9, 1.2, 0)));
    XS.forEach((x) => line(x * 0.25, 3.0, x, 1.6));
    cube('', '#f0a8a8', [0.9, 0.15, 0.9], XS[cs.p], 0.82, 0);
    tag('p（空）', 'ptr', XS[cs.p], 0.3); tag('q', 'ptr alt', XS[cs.q], 0.3);
    say(cs.cap, '兄弟 q 有 2 個 key，可以 rotate');
    await beat(tok, 2200);
    const dm = rk[cs.r.indexOf(cs.down)], um = kk[cs.q][cs.kids[cs.q].indexOf(cs.up)];
    const ox = dm.position.x;
    glow(dm, GOLD); glow(um, GOLD);
    move(dm, XS[cs.p], 1.2, 0);
    move(um, ox, 3.4, 0);
    say(cs.f, '');
    await beat(tok, 2600);
    say('下面的 subtree pointer 也要跟著搬', '子樹 a b c d 的順序要對');
    await beat(tok, 2000);
    lab.clear(); lab.frameCamera([0, 5, 12], [0, 1.6, 0]);
  }
  say('merge（combine）的細節請看課本', '');
  await beat(tok, 2400);
}]);
FRAG.push(['btree-p-234', '2-3-4 tree 與 red-black tree', async (tok) => {
  fresh([0, 5, 12], [0, 2, 0]);
  const n4 = [10, 20, 30].map((k, i) => cube(k, '#4b9ee2', [0.9, 0.7, 0.9], -4.4 + i * 1.0, 2.6, 0, 3));
  tag('2-3-4 tree：order 4', 'ptr', -3.4, 3.8);
  say('2-3-4 tree：每個 node 2～4 個 pointer', '高度在 log₄(n+1) 和 log₂(n+1) 之間');
  await beat(tok, 3200);
  say('insert / delete 只要調整一次', '不會像 2-3 tree 連鎖反應');
  await beat(tok, 2600);
  const b = cube('20', '#333333', [0.9, 0.7, 0.9], 3, 3.4, 0, 3), r1 = cube('10', '#d64545', [0.9, 0.7, 0.9], 1.8, 1.6, 0, 3), r2 = cube('30', '#d64545', [0.9, 0.7, 0.9], 4.2, 1.6, 0, 3);
  line(3, 3.0, 1.8, 2.0); line(3, 3.0, 4.2, 2.0);
  arrow(V3(-2.6, 2.6, 0), V3(1.0, 2.6, 0));
  say('可以表示成 binary 的 red-black tree', '中間 key 黑色，兩旁紅色');
  await beat(tok, 3200);
  glow(b, GOLD);
  say('演算法課會再講 red-black tree', '資結至少要懂 2-3 tree');
  await beat(tok, 2600);
  void n4; void r1; void r2;
}]);
FRAG.push(['btree-p-range-naive', 'Range search：為什麼要 B+ tree', async (tok) => {
  fresh([0, 6, 12], [0, 1.4, 0]);
  say('列出學期平均 ≥ 80 分的學生', 'range search');
  await beat(tok, 2400);
  const cells = []; for (let i = 0; i < 21; i++) { cells.push(cube(String(80 + i), '#e2d3b6', [0.55, 0.45, 0.6], -6 + i * 0.6, 3.2, 0)); }
  say('笨方法：80、81、82 … 各 search 一次', '80～100 要下二十幾次 search');
  await beat(tok, 1600);
  await anim(tok, 3000, (t) => { const k = Math.floor(t * 20.99); cells.forEach((c, i) => glow(c, i <= k ? RED : null)); });
  await beat(tok, 1200);
  const lv = []; for (let i = 0; i < 4; i++) { lv.push(cube(String(80 + i * 6), '#2fc092', [1.6, 0.5, 0.8], -4.5 + i * 3, 0.6, 0, 3)); if (i) arrow(V3(-6.7 + i * 3, 0.6, 0.5), V3(-5.3 + i * 3, 0.6, 0.5), 0x2fc092); }
  say('B+ tree：leaf node 用 linked list 串起來', '找到 80 之後往右走就好');
  await beat(tok, 3000);
  for (const l of lv) { glow(l, GOLD); await beat(tok, 500); }
  say('在 database 裡叫 index', 'key → pointer → disk page 裡的 record');
  await beat(tok, 3000);
}]);
FRAG.push(['btree-p-bp-d1', 'B+ tree（order d = 1）例子', async (tok) => {
  fresh([0, 5.2, 14.5], [0, 2.4, 0.3]);
  const root = RK1(); const v = bpView(root, 1);
  say('order d = 1：每個 node 1 ～ 2 個 entry', 'root 40；[20, 33]、[51, 63]');
  await beat(tok, 3000);
  bpStars(v, true);
  say('leaf 裡的 k* 是 pointer，指到 disk 上的 record', '上面的 key 只拿來比較');
  await beat(tok, 3200);
  say('leaf 用 doubly linked list 串起來', '前後都可以走');
  await beat(tok, 2600);
  bpRing(v, root.kids[0]);
  say('< 40 的值都在左邊 subtree', '≥ 40 在右邊');
  await beat(tok, 2600);
  bpRing(v, root.kids[0].kids[1]);
  say('遞迴下去：20 ～ 33 之間在中間那個 subtree', '');
  await beat(tok, 2800);
}]);
FRAG.push(['btree-p-bp-find27', 'B+ tree 找 key 27', async (tok) => {
  fresh([0, 5.2, 14.5], [0, 2.4, 0.3]);
  const root = RK1(); const v = bpView(root, 1); bpStars(v, true);
  say('找年紀 27 的資料在哪', '從 root 開始比大小');
  await beat(tok, 2200);
  const leaf = await bpWalk(tok, v, root, 27);
  v.bodies.get('L27').obj.material.emissive = new THREE.Color('#1d5a2c');
  say('跟 B-tree 的 search 一樣', '27 < 40 走左，20 ≤ 27 < 33 走中間');
  await beat(tok, 3000);
  void leaf;
}]);
FRAG.push(['btree-p-bp-format', 'B+ tree 節點格式與 d ≤ n ≤ 2d', async (tok) => {
  fresh([0, 5, 12], [0, 1.6, 0]);
  const parts = [];
  const lbl = ['P0', 'K1', 'P1', 'K2', 'P2', '…', 'Kn', 'Pn'];
  lbl.forEach((t, i) => parts.push(cube(t, t[0] === 'P' ? '#d8c29b' : t === '…' ? GRAY : '#4b9ee2', [t[0] === 'P' ? 0.75 : 1.0, 0.7, 1], -4.9 + i * 1.4, 2.4, 0, 3)));
  say('node：P0 K1 P1 K2 … Kn Pn', 'P = pointer，K = key');
  await beat(tok, 2800);
  [1, 3, 6].forEach((i) => glow(parts[i], GOLD));
  say('K1 < K2 < … < Kn：排好序', '');
  await beat(tok, 2400);
  [1, 3, 6].forEach((i) => glow(parts[i], null));
  tag('非 root：d ≤ n ≤ 2d', 'ptr', -2.5, 0.8);
  say('非 root：key 數 n 在 d ～ 2d', 'd 就是 B+ tree 的 order');
  await beat(tok, 3000);
  tag('root：1 ≤ n ≤ 2d', 'ptr alt', 2.8, 0.8);
  say('root：1 ～ 2d 個 key', 'd = 1 → 1～2；d = 2 → 2～4');
  await beat(tok, 3000);
  say('搜尋：跟著 pointer 比大小往下', '和 B-tree 一樣');
  await beat(tok, 2400);
}]);
FRAG.push(['btree-p-bp-d2-search', 'order 2 的 B+ tree：找 5、找 15', async (tok) => {
  fresh([0, 4.6, 13.5], [0, 1.6, 0.3]);
  const root = RK2(); const v = bpView(root, 2); bpStars(v, false);
  say('order d = 2：root [13, 17, 24, 30]', '下面 5 個 leaf，用 link 串起來');
  await beat(tok, 2600);
  await bpWalk(tok, v, root, 5);
  say('5 在第一個 leaf（2, 3, 5, 7）', '');
  await beat(tok, 2000);
  await bpWalk(tok, v, root, 15);
  say('13 ≤ 15 < 17，leaf 只有 14、16', 'no return：沒有這筆');
  await beat(tok, 3000);
}]);
FRAG.push(['btree-p-bp-d2-range', 'Range query：≥ 24、< 24、15 ～ 24', async (tok) => {
  fresh([0, 4.6, 13.5], [0, 1.6, 0.3]);
  const root = RK2(); let v = bpView(root, 2); bpStars(v, false);
  const hl = new Set();
  const paint = () => { for (const [id, b] of v.bodies) if (id[0] === 'L') b.obj.material.emissive = new THREE.Color(hl.has(id) ? '#1d5a2c' : '#000000'); };
  say('找 ≥ 24 的所有資料', '先 search 24');
  await beat(tok, 2000);
  let leaf = await bpWalk(tok, v, root, 24);
  for (let n = leaf; n; n = n.next) { bpRing(v, n); n.keys.filter((k) => k >= 24).forEach((k) => hl.add('L' + k)); paint(); say(n === leaf ? '從 24 開始往右' : '沿著 link 到下一個 leaf', n.next ? '' : '後面是 null → 停'); await beat(tok, 1400); }
  say('一下子就拿到 24, 27, 29, 33 … 39', '');
  await beat(tok, 2200);
  hl.clear(); paint();
  bpRing(v, leaf);
  for (let n = v.leaves.indexOf(leaf) - 1; n >= 0; n--) { v.leaves[n].keys.forEach((k) => hl.add('L' + k)); paint(); say('< 24：找到 24 往左走', ''); await beat(tok, 700); }
  await beat(tok, 1200);
  hl.clear(); paint();
  say('15 ～ 24：search 兩次', '先找 15 的位置，再找 24');
  await beat(tok, 2000);
  leaf = bpDescend(root, 15).pop();
  for (let n = leaf; n; n = n.next) { bpRing(v, n); let stop = false; for (const k of n.keys) { if (k > 24) { stop = true; break; } if (k >= 15) hl.add('L' + k); } paint(); say('夾在中間的 leaf 都符合', [...hl].map((s) => s.slice(1)).join(', ')); await beat(tok, 1300); if (stop || n.keys.includes(24)) break; }
  say('B+ tree 做 range query 很快', '比 B-tree 多了 leaf 的 linked list');
  await beat(tok, 3000);
}]);
FRAG.push(['btree-p-rtree', '預告：2D 空間查詢與 R-tree', async (tok) => {
  fresh([0, 9, 8], [0, 0, 0.5]);
  const plane = new THREE.Mesh(new THREE.BoxGeometry(11, 0.06, 7.5), new THREE.MeshStandardMaterial({ color: '#efe6d2' })); plane.position.y = -0.05; lab.world.add(plane);
  tag('經度 →', 'idx', 4.8, 0.1, 3.9); tag('緯度', 'idx', -5.8, 0.1, -3.4);
  const P = [[-4, -2.5], [-3, 1.5], [-1.2, -0.8], [-0.4, 0.7], [0.6, -0.2], [1.1, 1.2], [2.5, -2.2], [3.6, 1.8], [4.3, -0.6], [-2.2, 2.6], [0.2, -2.6], [2.0, 0.4]];
  const pts = P.map(([x, z]) => cube('', '#4b9ee2', [0.35, 0.35, 0.35], x, 0.2, z, 3));
  say('B+ tree 處理的是一維（年紀）', '景點有經度、緯度：二維');
  await beat(tok, 2800);
  const c = circle(1.8, 0.03, '#d64545'); c.position.set(0.2, 0, 0.2);
  tag('交大', 'ptr', 0.2, 0.4, 0.2);
  say('找交大半徑 5 公里內的景點', '');
  await beat(tok, 2400);
  const s1 = ghostBox('#f0a030', 3.6, 0.1, 7.4); s1.position.set(0.2, 0.05, 0);
  const s2 = ghostBox('#9b7ef4', 10.9, 0.1, 3.6); s2.position.set(0, 0.07, 0.2);
  say('笨方法：經度、緯度各建一棵 B+ tree', '兩個結果交集');
  await beat(tok, 3000);
  P.forEach(([x, z], i) => glow(pts[i], Math.hypot(x - 0.2, z - 0.2) <= 1.8 ? GREEN : null));
  await beat(tok, 1600);
  kill(s1); kill(s2);
  const rect = (x1, z1, x2, z2, col) => { const pts2 = [V3(x1, 0.04, z1), V3(x2, 0.04, z1), V3(x2, 0.04, z2), V3(x1, 0.04, z2), V3(x1, 0.04, z1)]; const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts2), new THREE.LineBasicMaterial({ color: col })); lab.world.add(l); return l; };
  rect(-4.4, -3.0, -0.8, -0.4, '#2fc092'); rect(-3.4, 1.1, 0.0, 3.0, '#2fc092'); rect(0.2, -2.9, 2.9, 1.6, '#2fc092'); rect(3.2, -1.0, 4.7, 2.2, '#2fc092');
  say('R-tree（1984）：用矩形把點分組', '專門做空間 / 多維度查詢');
  await beat(tok, 3200);
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
