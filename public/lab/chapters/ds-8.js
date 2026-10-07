// 資料結構 第8章：排序演算法（Insertion / Selection / Bubble / Merge / Quick / Heap / Counting / Radix）。
// Chapter module for lab-shell.js — see public/lab/README-labs.md.
//
// 慣例與來源：
// - Quick Sort 預設用 Abdul Bari 影片的 partition：pivot = 第一個，i 往右找「> pivot」、j 往左找「≤ pivot」，
//   陣列尾端放 ∞ 當 i 的哨兵；i、j 交錯後 pivot 與 a[j] 交換。可切換成洪逸課本版（i 找「≥ pivot」）。
//   影片的例子：10 16 8 12 15 6 3 9 5（第一次 partition 後 → 6 5 8 9 3 10 15 12 16）。
// - Counting Sort 用 MIT 6.006 Rec7 的寫法：count → pos[v] =「比 v 小的有幾個」→ 由左往右放、pos[v]++（穩定）。
//   影片例子：4 1 3 2 3（k = 6）；兩個 3 標成 3A、3B 看穩定性。
// - Radix Sort 用 LSD（從最低位開始），每回合用穩定的分配（bucket 先進先出）。影片例子：2341 1432 2413 1243 2143 1234。
// - Heap Sort 依洪逸課本：陣列看成 1-based 完整二元樹，先由下往上 adjust 建 max heap，再反覆把根換到尾端。
// - Merge Sort 用遞迴（top-down）版；合併時相等取左邊，所以穩定。
export default function (ctx) {
  const { THREE, lab, colorFor, sleep, $, log, clearLog, setState, controls, on, say, beat } = ctx;
  let timer = null;
  const stopTimer = () => { clearInterval(timer); timer = null; };
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const rnd = (n) => Math.floor(Math.random() * n);
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const UP = V3(0, 1, 0);
  const drop = (o) => { lab.world.remove(o); o.traverse((c) => { if (c.element) c.element.remove(); }); };

  const ALGOS = {
    insertion: { name: 'Insertion Sort', view: 'row', stable: true, cmp: true, f: '最佳 O(n)（已排好）；平均／最差 O(n²)；穩定', intro: '把 a[i] 拿出來當 key，前面比 key 大的都往右挪一格，再把 key 放進空位。' },
    selection: { name: 'Selection Sort', view: 'row', stable: false, cmp: true, f: '一律 O(n²) 次比較，但交換只有 O(n) 次；不穩定', intro: '每回合在未排序區找最小值，跟未排序區的第一個交換。' },
    bubble: { name: 'Bubble Sort', view: 'row', stable: true, cmp: true, f: '相鄰比較、大的往右浮；有 flag 時最佳 O(n)；穩定', intro: '每回合從左到右比較相鄰兩個，左邊大就交換；最大的一路浮到最右邊。' },
    merge: { name: 'Merge Sort', view: 'aux', stable: true, cmp: true, f: '一律 O(n log n)；需要 O(n) 暫存陣列；穩定', intro: '先一路對半切到只剩一個，再把兩段排好的合併：每次比較兩段開頭，小的先放進暫存陣列。' },
    quick: { name: 'Quick Sort', view: 'row', stable: false, cmp: true, f: '平均 O(n log n)、最差 O(n²)；不穩定', intro: 'partition：讓 pivot 左邊都 ≤ 它、右邊都 > 它，pivot 就站到最終位置；再對左右兩段遞迴。' },
    heap: { name: 'Heap Sort', view: 'heap', stable: false, cmp: true, f: '建 heap O(n)＋n 次刪除 O(log n) → O(n log n)；O(1) 空間；不穩定', intro: '陣列直接看成完整二元樹；先建 max heap，再反覆把根（最大）換到最後面。' },
    counting: { name: 'Counting Sort', view: 'aux', stable: true, cmp: false, f: 'O(n + k)，不用比較；穩定', intro: '鍵值是 0..k−1 的整數：先數每個值有幾個，再算出每個值該從哪一格開始放。' },
    radix: { name: 'Radix Sort（LSD）', view: 'radix', stable: true, cmp: false, f: 'd 回合 × O(n + r)；每回合都要穩定', intro: '從最低位開始，每回合依「這一位」分配到 10 個 bucket，再依 0→9、先進先出收回來。' },
  };
  const VIDEO = { quick: [10, 16, 8, 12, 15, 6, 3, 9, 5], counting: [4, 1, 3, 2, 3], radix: [2341, 1432, 2413, 1243, 2143, 1234] };
  const INPUTS = { random: '隨機', sorted: '已排序', reversed: '反序', nearly: '幾乎排好', dup: '很多重複', video: '影片的例子' };
  const LETTERS = 'ABCDEFGH';
  function makeTags(vals) {
    const cnt = {}, seen = {};
    vals.forEach((v) => { cnt[v] = (cnt[v] || 0) + 1; });
    return vals.map((v) => { if (cnt[v] < 2) return ''; seen[v] = (seen[v] || 0) + 1; return LETTERS[seen[v] - 1] || '*'; });
  }

  // ───────────────────────── 演算法 → 每一步的快照 ─────────────────────────
  // 快照 = 每根長條在哪（loc）＋哪些在發亮＋指標＋計數器；畫面只負責把長條彈到快照的位置。
  function record(algo, V, opt = {}) {
    const n = V.length, tags = opt.tags || V.map(() => '');
    const a = V.map((_, i) => i);
    const loc = V.map((_, k) => ({ r: 'm', k }));
    const done = new Set(), steps = [];
    let cmp = 0, mv = 0, heapSize = n, cuts = [], bk = null, bkName = '', range = null;
    const T = (id) => String(V[id]) + tags[id];
    const snap = (msg, ex = {}) => steps.push({
      msg, f: ex.f || '', cmp, mv, loc: loc.map((o) => ({ ...o })), glow: ex.glow || [], hot: ex.hot || [], done: [...done],
      ptr: ex.ptr || [], range: ex.range === undefined ? range : ex.range, heapSize, cuts: cuts.slice(), bk: bk ? bk.slice() : null, bkName, bkHi: ex.bkHi ?? -1,
    });
    const setM = (k, id) => { a[k] = id; loc[id] = { r: 'm', k }; };
    const swap = (i, j, msg, ex = {}) => { const x = a[i], y = a[j]; setM(i, y); setM(j, x); mv++; snap(msg, { ...ex, hot: [x, y] }); };
    snap('初始陣列', {});

    if (algo === 'insertion') {
      for (let i = 1; i < n; i++) {
        const key = a[i];
        loc[key] = { r: 'up', k: i };
        snap('取出 key = ' + T(key), { hot: [key], ptr: [['i', i]] });
        let j = i - 1;
        while (j >= 0) {
          cmp++;
          const big = V[a[j]] > V[key];
          snap(T(a[j]) + (big ? ' > ' : ' ≤ ') + T(key) + (big ? '：往右挪' : '：停'), { glow: [a[j], key], ptr: [['i', i], ['j', j]] });
          if (!big) break;
          setM(j + 1, a[j]); mv++;
          loc[key] = { r: 'up', k: j };
          snap(T(a[j + 1]) + ' 右移到 a[' + (j + 1) + ']', { hot: [a[j + 1]], ptr: [['i', i], ['j', j]] });
          j--;
        }
        setM(j + 1, key); mv++;
        snap('key 放進 a[' + (j + 1) + ']', { hot: [key], ptr: [['i', i]] });
      }
    } else if (algo === 'selection') {
      for (let i = 0; i < n - 1; i++) {
        let m = i;
        snap('第 ' + (i + 1) + ' 回合：在 a[' + i + '..' + (n - 1) + '] 找最小值', { ptr: [['i', i], ['min', m]], range: [i, n - 1] });
        for (let j = i + 1; j < n; j++) {
          cmp++;
          const less = V[a[j]] < V[a[m]];
          snap(T(a[j]) + (less ? ' < ' : ' ≥ ') + T(a[m]) + (less ? '：更新 min' : ''), { glow: [a[j], a[m]], ptr: [['i', i], ['j', j], ['min', less ? j : m]], range: [i, n - 1] });
          if (less) m = j;
        }
        if (m !== i) swap(i, m, '最小值 ' + T(a[m]) + ' 與 a[' + i + '] = ' + T(a[i]) + ' 交換', { ptr: [['i', i], ['min', m]], range: [i, n - 1] });
        else snap('a[' + i + '] 已經是最小，不用換', { ptr: [['i', i]], range: [i, n - 1] });
        done.add(a[i]);
      }
    } else if (algo === 'bubble') {
      for (let p = 0; p < n - 1; p++) {
        let sw = false;
        for (let j = 0; j < n - 1 - p; j++) {
          cmp++;
          const gt = V[a[j]] > V[a[j + 1]];
          snap(T(a[j]) + (gt ? ' > ' : ' ≤ ') + T(a[j + 1]) + (gt ? '：交換' : ''), { glow: [a[j], a[j + 1]], ptr: [['j', j]], range: [0, n - 1 - p] });
          if (gt) { swap(j, j + 1, '交換 a[' + j + ']、a[' + (j + 1) + ']', { ptr: [['j', j]], range: [0, n - 1 - p] }); sw = true; }
        }
        done.add(a[n - 1 - p]);
        snap('第 ' + (p + 1) + ' 回合結束：最大的浮到 a[' + (n - 1 - p) + ']', { range: null });
        if (!sw) { snap('這回合完全沒有交換 → 已排好，提早結束', { f: '有 flag 的 Bubble Sort：已排序時只跑一回合 O(n)' }); break; }
      }
    } else if (algo === 'merge') {
      const ms = (l, r) => {
        if (l >= r) return;
        const m = (l + r) >> 1;
        cuts.push(m + 1);
        snap('切開 [' + l + '..' + r + '] → [' + l + '..' + m + '] ＋ [' + (m + 1) + '..' + r + ']', { range: [l, r] });
        ms(l, m); ms(m + 1, r);
        const out = [];
        let i = l, j = m + 1;
        snap('合併 [' + l + '..' + m + '] 與 [' + (m + 1) + '..' + r + ']', { range: [l, r], ptr: [['i', i], ['j', j]] });
        while (i <= m && j <= r) {
          cmp++;
          const takeL = V[a[i]] <= V[a[j]];
          const eq = V[a[i]] === V[a[j]];
          snap(T(a[i]) + (takeL ? ' ≤ ' : ' > ') + T(a[j]), { glow: [a[i], a[j]], ptr: [['i', i], ['j', j]], range: [l, r] });
          const id = takeL ? a[i++] : a[j++];
          loc[id] = { r: 'aux', k: l + out.length }; out.push(id); mv++;
          snap(T(id) + ' 放進暫存陣列' + (eq ? '（相等取左邊 → 穩定）' : ''), { hot: [id], ptr: [['i', i], ['j', j]], range: [l, r] });
        }
        const rest = [];
        while (i <= m) { const id = a[i++]; loc[id] = { r: 'aux', k: l + out.length }; out.push(id); rest.push(id); mv++; }
        while (j <= r) { const id = a[j++]; loc[id] = { r: 'aux', k: l + out.length }; out.push(id); rest.push(id); mv++; }
        if (rest.length) snap('另一段用完了：剩下的直接搬過去', { hot: rest, range: [l, r] });
        cuts.splice(cuts.indexOf(m + 1), 1);
        out.forEach((id, t) => setM(l + t, id)); mv += out.length;
        if (l === 0 && r === n - 1) out.forEach((id) => done.add(id));
        snap('[' + l + '..' + r + '] 複製回原陣列', { hot: out, range: [l, r] });
      };
      ms(0, n - 1);
    } else if (algo === 'quick') {
      const bari = opt.rule !== 'horowitz';
      const qs = (l, r) => {
        if (l > r) return;
        if (l === r) { done.add(a[l]); snap(T(a[l]) + ' 只剩一個 → 已在正確位置', { range: [l, r] }); return; }
        if (opt.pivot === 'median3') {
          const m = (l + r) >> 1;
          const three = [l, m, r].sort((x, y) => V[a[x]] - V[a[y]]);
          cmp += 3;
          snap('三數取中：' + T(a[l]) + '、' + T(a[m]) + '、' + T(a[r]) + ' 的中位數是 ' + T(a[three[1]]), { glow: [a[l], a[m], a[r]], range: [l, r] });
          if (three[1] !== l) swap(l, three[1], '把中位數換到最左邊當 pivot', { range: [l, r] });
        } else if (opt.pivot === 'random') {
          const p = l + rnd(r - l + 1);
          if (p !== l) swap(l, p, '隨機挑到 ' + T(a[p]) + '，換到最左邊當 pivot', { range: [l, r] });
        }
        const pid = a[l], pv = V[pid];
        let i = l, j = r + 1;
        const P = () => [['pivot', l], ['i', i], ['j', j]];
        snap('pivot = ' + T(pid) + '：i 從 low、j 從 high+1（∞）出發', { glow: [pid], ptr: P(), range: [l, r] });
        do {
          for (;;) {
            i++;
            if (i > r) { snap('i 走到 ∞（右邊界）停下', { glow: [pid], ptr: P(), range: [l, r] }); break; }
            cmp++;
            const go = bari ? V[a[i]] <= pv : V[a[i]] < pv;
            snap('i →：' + T(a[i]) + (go ? (bari ? ' ≤ ' : ' < ') : (bari ? ' > ' : ' ≥ ')) + 'pivot' + (go ? '，繼續' : '，停'), { glow: [a[i], pid], ptr: P(), range: [l, r] });
            if (!go) break;
          }
          for (;;) {
            j--;
            cmp++;
            const go = V[a[j]] > pv;
            snap('j ←：' + T(a[j]) + (go ? ' > ' : ' ≤ ') + 'pivot' + (go ? '，繼續' : '，停'), { glow: [a[j], pid], ptr: P(), range: [l, r] });
            if (!go) break;
          }
          if (i < j) swap(i, j, 'i < j：交換 ' + T(a[i]) + '、' + T(a[j]), { ptr: P(), range: [l, r] });
        } while (i < j);
        if (j !== l) swap(l, j, 'i、j 交錯：pivot 與 a[' + j + '] 交換 → pivot 歸位', { ptr: P(), range: [l, r] });
        else snap('j 停在 pivot 自己：pivot 已在正確位置', { ptr: P(), range: [l, r] });
        done.add(pid);
        snap(T(pid) + ' 就定位：左邊都 ≤ 它、右邊都 > 它', { hot: [pid], range: [l, r], f: '對左右兩段遞迴；已就位的 pivot 就是左段的 ∞' });
        qs(l, j - 1); qs(j + 1, r);
      };
      qs(0, n - 1);
    } else if (algo === 'heap') {
      const adjust = (k, size) => {
        while (2 * k + 1 < size) {
          let c = 2 * k + 1;
          if (c + 1 < size) {
            cmp++;
            snap('兩個孩子比大小：[' + (c + 1) + '] ' + T(a[c]) + '、[' + (c + 2) + '] ' + T(a[c + 1]), { glow: [a[c], a[c + 1]] });
            if (V[a[c + 1]] > V[a[c]]) c++;
          }
          cmp++;
          const down = V[a[c]] > V[a[k]];
          snap('較大的孩子 ' + T(a[c]) + (down ? ' > ' : ' ≤ ') + '父節點 ' + T(a[k]) + (down ? '：交換' : '：停'), { glow: [a[c], a[k]] });
          if (!down) break;
          swap(k, c, T(a[k]) + ' 往下沉');
          k = c;
        }
      };
      snap('陣列直接看成完整二元樹：[i] 的孩子是 [2i]、[2i+1]', { f: '索引採課本的 1-based' });
      for (let k = (n >> 1) - 1; k >= 0; k--) { snap('adjust([' + (k + 1) + '])：從最後一個非葉節點往回做', { glow: [a[k]] }); adjust(k, n); }
      snap('Max heap 建好：根最大', { f: '由下往上建 heap 只要 O(n)' });
      for (let s = n - 1; s >= 1; s--) {
        swap(0, s, '根 ' + T(a[0]) + ' 與最後一個 [' + (s + 1) + '] 交換');
        heapSize = s; done.add(a[s]);
        snap(T(a[s]) + ' 離開 heap，進入排好區', { hot: [a[s]] });
        adjust(0, s);
      }
    } else if (algo === 'counting') {
      const K = opt.K || 10;
      bk = new Array(K).fill(0); bkName = 'count';
      snap('count[0..' + (K - 1) + '] 全部設 0（k = ' + K + '）', { f: '鍵值必須是 0..k−1 的整數' });
      for (let i = 0; i < n; i++) { bk[V[a[i]]]++; snap('A[' + i + '] = ' + T(a[i]) + ' → count[' + V[a[i]] + ']++', { hot: [a[i]], ptr: [['i', i]], bkHi: V[a[i]] }); }
      bkName = 'pos';
      let sum = 0;
      for (let v = 0; v < K; v++) {
        const c = bk[v]; bk[v] = sum; sum += c;
        snap('pos[' + v + '] = 比 ' + v + ' 小的有 ' + bk[v] + ' 個', { bkHi: v, f: 'pos[v] = count[0] + … + count[v−1]（累加）' });
      }
      const out = new Array(n);
      for (let i = 0; i < n; i++) {
        const id = a[i], v = V[id], k = bk[v]++;
        out[k] = id; loc[id] = { r: 'aux', k }; mv++;
        snap('A[' + i + '] = ' + T(id) + ' → output[' + k + ']，pos[' + v + ']++', { hot: [id], ptr: [['i', i]], bkHi: v, f: '同樣的值依原順序往後放 → 穩定' });
      }
      out.forEach((id, k) => setM(k, id)); mv += n;
      snap('output 複製回 A', { hot: out });
    } else if (algo === 'radix') {
      const D = opt.D || 2;
      const names = ['個位', '十位', '百位', '千位', '萬位'];
      for (let r = 0, d = 1; r < D; r++, d *= 10) {
        const Q = Array.from({ length: 10 }, () => []);
        snap('第 ' + (r + 1) + ' 回合：看「' + names[r] + '」分配到 bucket', { f: 'LSD：由最低位做到最高位' });
        for (let i = 0; i < n; i++) {
          const id = a[i], b = Math.floor(V[id] / d) % 10;
          loc[id] = { r: 'b', b, d: Q[b].length }; Q[b].push(id); mv++;
          snap(T(id) + ' 的' + names[r] + '是 ' + b + ' → bucket ' + b + ' 尾端', { hot: [id], bkHi: b });
        }
        let k = 0;
        for (let b = 0; b < 10; b++) {
          if (!Q[b].length) continue;
          Q[b].forEach((id) => { setM(k++, id); mv++; });
          snap('收回 bucket ' + b + '（先進先出，保持穩定）', { hot: Q[b].slice(), bkHi: b });
        }
        snap('第 ' + (r + 1) + ' 回合後：已依最後 ' + (r + 1) + ' 位排好', { f: '因為每回合都穩定，前幾回合的順序會保留下來' });
      }
    }
    heapSize = 0;
    V.forEach((_, id) => done.add(id));
    snap('排序完成', { range: null });
    return steps;
  }

  // ───────────────────────── 3D 長條播放器 ─────────────────────────
  const Z_MAIN = 0, Z_UP = 1.3, Z_AUX = 2.8, Z_BK = -1.7, Z_SORT = 3.0;
  const S = { algo: 'insertion', vals: [], tags: [], bars: [], steps: [], i: -1, view: 'row', sp: 0.9, gapW: 0, K: 10, D: 2, stab: false,
    ptrs: {}, idxL: [], auxT: [], strip: null, bkL: [], bkT: null, inf: null, delay: 450 };
  const n0 = () => S.vals.length;
  function xOf(k, cuts) {
    const c = cuts || [];
    let g = 0;
    for (const x of c) if (x <= k) g++;
    const total = (n0() - 1) * S.sp + c.length * S.gapW;
    return -total / 2 + k * S.sp + g * S.gapW;
  }
  const xRow = (k) => (k - (n0() - 1) / 2) * S.sp;
  function treeXZ(k) {
    const lv = Math.floor(Math.log2(k + 1)), pos = k - (Math.pow(2, lv) - 1), w = Math.pow(2, lv);
    return { x: ((pos + 0.5) / w - 0.5) * 10, z: -3.2 + lv * 1.45 };
  }
  const bucketX = (b, K) => (b - (K - 1) / 2) * (K > 6 ? 1.15 : 1.5);
  function hOf(v) {
    if (S.stab) return 0.6 + v * 0.75;
    if (S.algo === 'counting') return 0.35 + v * 4.5 / Math.max(1, S.K - 1);
    if (S.algo === 'radix') return 0.4 + v / Math.max(1, S.maxV) * 4.8;
    return 0.4 + v * 0.26;
  }
  function posOf(id, L, st) {
    const h = S.bars[id].h, y = h / 2;
    if (S.view === 'heap') {
      if (L.k < st.heapSize) { const p = treeXZ(L.k); return V3(p.x, y, p.z); }
      return V3(xRow(L.k), y, Z_SORT);
    }
    if (L.r === 'up') return V3(xOf(L.k, st.cuts), y + 0.25, Z_UP);
    if (L.r === 'aux') return V3(xOf(L.k, st.cuts), y, Z_AUX);
    if (L.r === 'b') return V3(bucketX(L.b, 10), y, Z_BK - L.d * 0.62);
    return V3(xOf(L.k, st.cuts), y, Z_MAIN);
  }
  function rod(a, b, color, r = 0.03) {
    const d = b.clone().sub(a), L = d.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 6), new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
    m.position.copy(a).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(UP, d.normalize());
    lab.world.add(m);
    return m;
  }

  function buildSort(cfg) {
    stopTimer(); lab.clear();
    const algo = cfg.algo, vals = cfg.vals, n = vals.length;
    Object.assign(S, { algo, vals, tags: cfg.tags || makeTags(vals), view: ALGOS[algo].view, stab: !!cfg.stab, ptrs: {}, idxL: [], auxT: [], bkL: [], bkT: null, strip: null, inf: null, i: 0 });
    const maxV = Math.max(...vals);
    S.K = maxV < 6 ? 6 : 10;
    S.maxV = maxV;
    S.D = Math.max(1, String(maxV).length);
    S.sp = Math.min(0.95, (S.view === 'heap' || S.view === 'radix' ? 10 : 11) / n);
    S.gapW = algo === 'merge' ? Math.min(0.32, 3.2 / n) : 0;
    const hk = S.view === 'heap' ? 0.6 : 1;
    const bw = Math.min(0.62, S.sp * 0.72);
    S.steps = record(algo, vals, { tags: S.tags, pivot: cfg.pivot, rule: cfg.rule, K: S.K, D: S.D });
    const st0 = S.steps[0];
    // 舞台骨架
    if (S.view === 'heap') {
      lab.frameCamera([0, 10.5, 11], [0, 1, 0]);
      for (let k = 0; k < n; k++) {
        const p = treeXZ(k);
        if (k > 0) { const q = treeXZ((k - 1) >> 1); rod(V3(q.x, 0.03, q.z), V3(p.x, 0.03, p.z), '#c9b48e'); }
        const t = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 20), new THREE.MeshStandardMaterial({ color: '#e9dcc4' }));
        t.position.set(p.x, 0.03, p.z); t.receiveShadow = true; lab.world.add(t);
        const l = lab.label('[' + (k + 1) + ']', 'idx'); l.position.set(p.x + 0.55, 0.05, p.z + 0.35); lab.world.add(l);
        const s = lab.label('[' + (k + 1) + ']', 'idx'); s.position.set(xRow(k), 0.05, Z_SORT + 0.6); lab.world.add(s);
      }
      const t1 = lab.label('heap（樹）', 'ptr'); t1.position.set(-5.6, 0.1, -3.2); lab.world.add(t1);
      const t2 = lab.label('排好區', 'ptr'); t2.position.set(xRow(0) - 1.3, 0.1, Z_SORT); lab.world.add(t2);
    } else {
      if (S.view === 'radix') lab.frameCamera([0, 10, 11], [0, 1, -1.8]);
      else if (S.view === 'aux') lab.frameCamera([0, 8, 12.5], [0, 1.6, 0.8]);
      else lab.frameCamera([0, 6, 13], [0, 2.2, 0.6]);
      for (let k = 0; k < n; k++) {
        const l = lab.label(String(k), 'idx'); l.position.set(xOf(k, []), 0.03, Z_MAIN + 0.6); lab.world.add(l); S.idxL.push(l);
      }
      S.strip = new THREE.Mesh(new THREE.BoxGeometry(1, 0.04, 1.1), new THREE.MeshStandardMaterial({ color: '#ecd9ae', roughness: 1 }));
      S.strip.position.set(0, 0.02, Z_MAIN); S.strip.visible = false; lab.world.add(S.strip);
      if (S.view === 'aux') {
        for (let k = 0; k < n; k++) {
          const t = new THREE.Mesh(new THREE.BoxGeometry(S.sp * 0.9, 0.04, 0.9), new THREE.MeshStandardMaterial({ color: '#e9dcc4', roughness: 1 }));
          t.position.set(xOf(k, []), 0.02, Z_AUX); t.receiveShadow = true; lab.world.add(t); S.auxT.push(t);
        }
        const al = lab.label(algo === 'counting' ? 'output' : '暫存陣列', 'ptr'); al.position.set(xOf(0, []) - 1.4, 0.1, Z_AUX); lab.world.add(al);
      }
      if (algo === 'counting' || algo === 'radix') {
        const K = algo === 'counting' ? S.K : 10;
        for (let b = 0; b < K; b++) {
          const x = bucketX(b, K);
          const t = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.05, algo === 'radix' ? 2.4 : 0.9), new THREE.MeshStandardMaterial({ color: '#e3d3b6', roughness: 1 }));
          t.position.set(x, 0.02, algo === 'radix' ? Z_BK - 0.9 : Z_BK); t.receiveShadow = true; lab.world.add(t);
          const d = lab.label(String(b), 'idx'); d.position.set(x, 0.05, Z_BK + 0.6); lab.world.add(d);
          const c = lab.label(algo === 'counting' ? '0' : '', 'ptr'); c.position.set(x, 0.3, Z_BK); lab.world.add(c);
          if (algo === 'radix') c.element.style.display = 'none';
          S.bkL.push(c);
        }
        if (algo === 'counting') { S.bkT = lab.label('count', 'ptr alt'); S.bkT.position.set(bucketX(0, K) - 1.4, 0.3, Z_BK); lab.world.add(S.bkT); }
      }
      if (algo === 'quick') {
        S.inf = lab.label('∞', 'ptr'); S.inf.position.set(xOf(n, []), 0.4, Z_MAIN); lab.world.add(S.inf);
      }
    }
    // 長條
    S.bars = vals.map((v, id) => {
      const h = hOf(v) * hk;
      const m = lab.box(colorFor(v), [bw, h, bw]);
      const l = lab.label(String(v) + S.tags[id], n > 10 || S.D > 2 ? 'idx' : 'val'); l.position.set(0, h / 2 + 0.28, 0); m.add(l);
      return { h, mesh: m, body: null };
    });
    S.bars.forEach((b, id) => {
      const p = posOf(id, st0.loc[id], st0);
      b.mesh.position.copy(p).add(V3(0, 5 + id * 0.25, 0));
      b.body = lab.addBody(b.mesh);
      lab.dropTo(b.body, p);
    });
    showStep(st0);
  }
  function showStep(st) {
    S.bars.forEach((b, id) => {
      const p = posOf(id, st.loc[id], st);
      if (b.body.target.distanceTo(p) > 1e-3) lab.springTo(b.body, p);
      const e = st.hot.includes(id) ? '#7a1616' : st.glow.includes(id) ? '#8a6400' : st.done.includes(id) ? '#0f3d26' : '#000000';
      b.mesh.material.emissive.set(e);
    });
    if (S.view !== 'heap') {
      S.idxL.forEach((L, k) => { L.position.x = xOf(k, st.cuts); });
      S.auxT.forEach((t, k) => { t.position.x = xOf(k, st.cuts); });
      if (st.range && S.strip) {
        const [l, r] = st.range;
        const x1 = xOf(l, st.cuts) - S.sp / 2, x2 = xOf(r, st.cuts) + S.sp / 2;
        S.strip.visible = true; S.strip.scale.x = x2 - x1; S.strip.position.x = (x1 + x2) / 2;
      } else if (S.strip) S.strip.visible = false;
      const used = {}, cnt = {};
      for (const [name, k] of st.ptr) {
        let L = S.ptrs[name];
        if (!L) { L = S.ptrs[name] = lab.label(name, name === 'pivot' || name === 'min' ? 'ptr alt' : 'ptr'); lab.world.add(L); }
        cnt[k] = (cnt[k] || 0) + 1;
        L.position.set(xOf(k, st.cuts), 0.05, Z_MAIN + 0.6 + cnt[k] * 0.42);
        L.element.style.display = ''; used[name] = 1;
      }
      for (const name in S.ptrs) if (!used[name]) S.ptrs[name].element.style.display = 'none';
      S.bkL.forEach((L, b) => {
        if (st.bk) L.element.textContent = String(st.bk[b]);
        L.element.className = 'lab-label ptr' + (st.bkHi === b ? ' alt' : '');
        if (S.algo === 'radix') { L.element.style.display = st.bkHi === b ? '' : 'none'; L.element.textContent = '◆'; }
      });
      if (S.bkT && st.bkName) S.bkT.element.textContent = st.bkName;
    }
    renderSortState(st);
  }
  function arrNow(st) {
    const arr = new Array(n0()).fill('·');
    st.loc.forEach((L, id) => { if (L.r === 'm') arr[L.k] = S.vals[id] + S.tags[id]; });
    return arr;
  }
  function stableVerdict(st) {
    if (!S.tags.some((t) => t)) return '';
    const ord = []; st.loc.forEach((L, id) => { ord[L.k] = id; });
    const last = {};
    for (const id of ord) {
      const v = S.vals[id];
      if (S.tags[id] && last[v] !== undefined && last[v] > id) return '<span class="no">不穩定：' + S.vals[id] + S.tags[id] + ' 跑到 ' + S.vals[last[v]] + S.tags[last[v]] + ' 前面</span>';
      last[v] = id;
    }
    return '<span class="ok">穩定：相同的值 A 仍在 B 前面</span>';
  }
  function renderSortState(st) {
    const A = ALGOS[S.algo], n = n0();
    const end = S.i === S.steps.length - 1;
    const lg = n * Math.log2(n);
    let f = st.f || A.f;
    if (end) {
      f = '比較 ' + st.cmp + ' 次（n(n−1)/2 = ' + n * (n - 1) / 2 + '，n log₂ n ≈ ' + Math.round(lg) + '）';
      const sv = stableVerdict(st);
      if (sv) f += '<br>' + sv;
    }
    setState(A.name + '（n = ' + n + '）', [
      ['步驟', (S.i + 1) + ' / ' + S.steps.length],
      ['比較次數', String(st.cmp)],
      [A.cmp ? '交換／搬移' : '搬移次數', String(st.mv)],
      ['陣列', esc(arrNow(st).join(' '))],
    ], f);
  }
  function sortStep() {
    if (S.i >= S.steps.length - 1) return false;
    S.i++;
    const st = S.steps[S.i];
    showStep(st); log(st.msg);
    return S.i < S.steps.length - 1;
  }
  function sortEnd() {
    stopTimer();
    if (S.i >= S.steps.length - 1) return;
    S.i = S.steps.length - 1;
    const st = S.steps[S.i];
    showStep(st); log('（略過中間步驟）' + st.msg);
  }
  async function playSteps(tok, ms, sayIt = true) {
    while (S.i < S.steps.length - 1) {
      sortStep();
      const st = S.steps[S.i];
      if (sayIt) say(st.msg, '比較 ' + st.cmp + ' 次　' + (ALGOS[S.algo].cmp ? '交換／搬移 ' : '搬移 ') + st.mv + ' 次');
      await beat(tok, ms);
    }
  }

  // ───────────────────────── 排序模式（四種分類共用） ─────────────────────────
  function makeInput(algo, n, kind) {
    if (kind === 'video' && VIDEO[algo]) return VIDEO[algo].slice();
    let v;
    if (algo === 'counting') v = Array.from({ length: n }, () => rnd(10));
    else if (algo === 'radix') v = Array.from({ length: n }, () => rnd(100));
    else if (kind === 'dup') v = Array.from({ length: n }, () => 4 * (1 + rnd(5)));
    else v = shuffle([...Array(20).keys()].map((x) => x + 1)).slice(0, n);
    if (kind === 'sorted' || kind === 'nearly') v.sort((x, y) => x - y);
    if (kind === 'reversed') v.sort((x, y) => y - x);
    if (kind === 'nearly' && n > 2) { const k = rnd(n - 1); [v[k], v[k + 1]] = [v[k + 1], v[k]]; }
    return v;
  }
  const rangeClass = (a) => (a === 'counting' ? 'c' : a === 'radix' ? 'r' : 'n');
  const CFG = {
    basic: { algos: ['insertion', 'selection', 'bubble'], algo: 'insertion', n: 8, input: 'random', nMax: 16 },
    dc: { algos: ['quick', 'merge'], algo: 'quick', n: 9, input: 'video', pivot: 'first', rule: 'bari', nMax: 16 },
    heap: { algos: ['heap'], algo: 'heap', n: 7, input: 'random', nMax: 15 },
    dist: { algos: ['counting', 'radix'], algo: 'counting', n: 5, input: 'video', nMax: 12 },
  };
  function sortMode(key) {
    const enter = (regen) => {
      stopTimer(); clearLog();
      const c = CFG[key];
      const hasVideo = (a) => !!VIDEO[a];
      if (c.input === 'video' && !hasVideo(c.algo)) c.input = 'random';
      controls(
        (c.algos.length > 1 ? '<select id="sA">' + c.algos.map((a) => '<option value="' + a + '">' + ALGOS[a].name + '</option>').join('') + '</select>' : '')
        + '<select id="sIn">' + Object.keys(INPUTS).filter((k) => k !== 'video' || hasVideo(c.algo)).map((k) => '<option value="' + k + '">' + INPUTS[k] + '</option>').join('') + '</select>'
        + '<label>n = <input id="sN" type="number" min="4" max="' + c.nMax + '" value="' + c.n + '"></label>'
        + (key === 'dc' ? '<select id="sPv"><option value="first">pivot：第一個</option><option value="median3">pivot：三數取中</option><option value="random">pivot：隨機</option></select>'
          + '<select id="sRule"><option value="bari">i 找 &gt; pivot（影片）</option><option value="horowitz">i 找 ≥ pivot（課本）</option></select>' : '')
        + '<button class="primary" id="sStep">下一步</button><button id="sAuto">自動播放</button><button id="sEnd">直接看結果</button><button id="sNew">換一組</button>'
        + '<select id="sSpd"><option value="900">慢</option><option value="450">中</option><option value="150">快</option></select>'
      );
      if ($('sA')) $('sA').value = c.algo;
      $('sIn').value = c.input;
      $('sSpd').value = String(S.delay);
      if (key === 'dc') {
        $('sPv').value = c.pivot; $('sRule').value = c.rule;
        const showQ = c.algo === 'quick';
        $('sPv').style.display = $('sRule').style.display = showQ ? '' : 'none';
        $('sPv').onchange = (e) => { c.pivot = e.target.value; enter(false); };
        $('sRule').onchange = (e) => { c.rule = e.target.value; enter(false); };
      }
      if ($('sA')) $('sA').onchange = (e) => {
        const old = c.algo; c.algo = e.target.value;
        const keep = rangeClass(old) === rangeClass(c.algo) && c.input !== 'video';
        if (c.input === 'video') c.input = hasVideo(c.algo) ? 'video' : 'random';
        enter(!keep);
      };
      $('sIn').onchange = (e) => { c.input = e.target.value; enter(true); };
      $('sN').onchange = (e) => {
        let v = Number(e.target.value);
        if (!Number.isInteger(v) || v < 4 || v > c.nMax) { log('n 要在 4 到 ' + c.nMax + ' 之間（舞台放不下更多長條）。', true); v = Math.max(4, Math.min(c.nMax, v || 8)); }
        c.n = v; if (c.input === 'video') c.input = 'random';
        enter(true);
      };
      $('sSpd').onchange = (e) => { S.delay = Number(e.target.value); };
      on('sStep', () => { if (!sortStep() && S.i >= S.steps.length - 1) log('已經排好了，按「換一組」再來一次。'); });
      on('sAuto', () => { stopTimer(); timer = setInterval(() => { if (!sortStep()) stopTimer(); }, S.delay); });
      on('sEnd', sortEnd);
      on('sNew', () => enter(true));
      if (regen !== false || !c.vals || (c.input !== 'video' && c.vals.length !== c.n)) c.vals = makeInput(c.algo, c.n, c.input);
      c.n = c.vals.length; $('sN').value = c.n;
      buildSort({ algo: c.algo, vals: c.vals, pivot: c.pivot, rule: c.rule });
      log(ALGOS[c.algo].name + '：' + ALGOS[c.algo].intro);
      if (c.input === 'video') {
        if (c.algo === 'quick') log('這是 Abdul Bari 影片的例子：10 16 8 12 15 6 3 9 5，尾端放 ∞。第一次 partition 後應該是 6 5 8 9 3 10 15 12 16。');
        if (c.algo === 'counting') log('這是 MIT 6.006 Rec7 的例子：4 1 3 2 3，鍵值 0..5（k = 6）；兩個 3 標成 3A、3B。');
        if (c.algo === 'radix') log('這是 MIT 6.006 Rec7 的例子：四位數，每位只有 1–4。從最後一位（個位）開始。');
      }
      if (c.algo === 'quick' && c.rule === 'bari') log('影片版 partition：i 往右找 > pivot、j 往左找 ≤ pivot；i < j 就交換，交錯後 pivot 與 a[j] 交換。');
      if (c.algo === 'quick' && c.rule === 'horowitz') log('課本版 partition：i 往右找 ≥ pivot、j 往左找 ≤ pivot（遇到等於 pivot 也會停下交換）。');
    };
    return enter;
  }
  const enterBasic = sortMode('basic'), enterDC = sortMode('dc'), enterHeap = sortMode('heap'), enterDist = sortMode('dist');

  // ───────────────────────── 穩定性 ─────────────────────────
  const STAB_ALGOS = ['insertion', 'bubble', 'merge', 'counting', 'selection', 'quick', 'heap'];
  const stab = { algo: 'selection', vals: null };
  function finalOrder(algo, vals, tags) {
    const st = record(algo, vals, { tags, pivot: 'first', rule: 'bari', K: 6 });
    const last = st[st.length - 1], ord = [];
    last.loc.forEach((L, id) => { ord[L.k] = id; });
    return ord;
  }
  function isStableRun(algo, vals) {
    const ord = finalOrder(algo, vals, makeTags(vals)), last = {};
    for (const id of ord) { const v = vals[id]; if (last[v] !== undefined && last[v] > id) return false; last[v] = id; }
    return true;
  }
  function stabInput(algo, n = 6) {
    let v = null;
    for (let t = 0; t < 500; t++) {
      v = Array.from({ length: n }, () => 1 + rnd(4));
      if (ALGOS[algo].stable || !isStableRun(algo, v)) return v;
    }
    return v;
  }
  function enterStab(regen = true) {
    stopTimer(); clearLog();
    controls(
      '<select id="bA">' + STAB_ALGOS.map((a) => '<option value="' + a + '">' + ALGOS[a].name + '</option>').join('') + '</select>'
      + '<button class="primary" id="bStep">下一步</button><button id="bAuto">自動播放</button><button id="bEnd">直接看結果</button><button id="bNew">換一組</button>'
    );
    $('bA').value = stab.algo;
    $('bA').onchange = (e) => { stab.algo = e.target.value; enterStab(!(stab.vals && (ALGOS[stab.algo].stable || !isStableRun(stab.algo, stab.vals)))); };
    on('bStep', sortStep);
    on('bAuto', () => { stopTimer(); timer = setInterval(() => { if (!sortStep()) stopTimer(); }, 300); });
    on('bEnd', sortEnd);
    on('bNew', () => enterStab(true));
    if (regen || !stab.vals) stab.vals = stabInput(stab.algo);
    buildSort({ algo: stab.algo, vals: stab.vals, stab: true, pivot: 'first', rule: 'bari' });
    log('穩定（stable）：值相同的元素，排序後仍維持原本的先後（A 在 B 前面）。');
    log(ALGOS[stab.algo].stable ? ALGOS[stab.algo].name + ' 是穩定的：隨便換幾組，A 永遠在 B 前面。'
      : ALGOS[stab.algo].name + ' 不穩定：這組輸入是特地挑出會把 A、B 弄反的例子。');
  }

  // ───────────────────────── 下界：決策樹 ─────────────────────────
  // n = 3 的 insertion sort 決策樹（CLRS 圖 8.1）：內部節點 aᵢ:aⱼ，左 ≤、右 >；6 片葉子 = 3! 種排列。
  const SUB = ['₁', '₂', '₃'];
  const DT = [
    { c: [0, 1], kids: [1, 2], p: [0, 6.2] },
    { c: [1, 2], kids: [3, 4], p: [-3.2, 4.6] },
    { c: [0, 2], kids: [5, 6], p: [3.2, 4.6] },
    { leaf: [0, 1, 2], p: [-4.9, 3.0] },
    { c: [0, 2], kids: [7, 8], p: [-1.6, 3.0] },
    { leaf: [1, 0, 2], p: [1.6, 3.0] },
    { c: [1, 2], kids: [9, 10], p: [4.9, 3.0] },
    { leaf: [0, 2, 1], p: [-2.7, 1.4] },
    { leaf: [2, 0, 1], p: [-0.5, 1.4] },
    { leaf: [1, 2, 0], p: [3.8, 1.4] },
    { leaf: [2, 1, 0], p: [6.0, 1.4] },
  ];
  const PERMS = ['2,5,8', '2,8,5', '5,2,8', '5,8,2', '8,2,5', '8,5,2'];
  const dt = { vals: [5, 2, 8], cur: 0, depth: 0, nodes: [], rods: {}, bars: [], n: 3, done: false };
  const dtPos = (i) => V3(DT[i].p[0] - 0.5, DT[i].p[1], -0.8);
  const dtBarX = (k) => (k - 1) * 1.5;
  function enterTree() {
    stopTimer(); lab.clear(); clearLog();
    lab.frameCamera([0, 4.6, 13.5], [0, 3.1, 0]);
    dt.nodes = []; dt.rods = {}; dt.bars = []; dt.cur = 0; dt.depth = 0; dt.done = false;
    DT.forEach((d, i) => {
      const m = d.leaf ? lab.box('#e9dcc4', [1.75, 0.42, 0.45]) : lab.box('#9b7ef4', [1.25, 0.55, 0.45]);
      m.position.copy(dtPos(i));
      m.add(lab.label(d.leaf ? '⟨' + d.leaf.map((k) => 'a' + SUB[k]).join(',') + '⟩' : 'a' + SUB[d.c[0]] + ':a' + SUB[d.c[1]], d.leaf ? 'idx' : 'val'));
      lab.world.add(m); dt.nodes.push(m);
      if (d.kids) d.kids.forEach((k, s) => {
        const a = dtPos(i).add(V3(0, -0.3, 0)), b = dtPos(k).add(V3(0, 0.25, 0));
        dt.rods[i + '-' + k] = rod(a, b, '#b8a586', 0.035);
        const l = lab.label(s ? '>' : '≤', 'idx'); l.position.copy(a).lerp(b, 0.5).add(V3(s ? 0.35 : -0.35, 0, 0)); lab.world.add(l);
      });
    });
    dt.vals.forEach((v, k) => {
      const h = 0.4 + v * 0.3;
      const m = lab.box(colorFor(v), [0.8, h, 0.8]);
      const l = lab.label('a' + SUB[k] + ' = ' + v, 'val'); l.position.set(0, h / 2 + 0.3, 0); m.add(l);
      m.position.set(dtBarX(k), h / 2 + 4, 2.6);
      const b = lab.addBody(m); b.h = h;
      lab.dropTo(b, V3(dtBarX(k), h / 2, 2.6));
      dt.bars.push(b);
    });
    controls(
      '<label>a₁, a₂, a₃ = <select id="dIn">' + PERMS.map((p) => '<option value="' + p + '">' + p + '</option>').join('') + '</select></label>'
      + '<button class="primary" id="dStep">比較一次</button><button id="dAuto">自動走到葉子</button><button id="dReset">重來</button>'
      + '<label>算算看 n = <input id="dN" type="number" min="2" max="20" value="' + dt.n + '"></label>'
    );
    $('dIn').value = dt.vals.join(',');
    $('dIn').onchange = (e) => { dt.vals = e.target.value.split(',').map(Number); enterTree(); };
    $('dN').onchange = (e) => {
      const v = Number(e.target.value);
      if (!Number.isInteger(v) || v < 2 || v > 20) { log('n 請填 2 到 20。', true); e.target.value = dt.n; return; }
      dt.n = v; dtState();
    };
    on('dStep', dtStep);
    on('dAuto', () => { stopTimer(); timer = setInterval(() => { if (!dtStep()) stopTimer(); }, 900); });
    on('dReset', enterTree);
    glowNode(0);
    log('比較模型（comparison model）：演算法只能問「aᵢ ≤ aⱼ 嗎？」。每個比較排序都對應一棵決策樹。');
    log('n 個元素有 n! 種排列，每一種都要走到不同的葉子 → 至少 n! 片葉子。');
    dtState();
  }
  function glowNode(i) { dt.nodes.forEach((m, k) => m.material.emissive.set(k === i ? '#6a4a00' : '#000000')); }
  function dtStep() {
    if (dt.done) return false;
    const d = DT[dt.cur];
    if (d.leaf) {
      dt.done = true;
      d.leaf.forEach((k, rank) => lab.springTo(dt.bars[k], V3(dtBarX(rank), dt.bars[k].h / 2, 2.6)));
      dt.bars.forEach((b) => b.obj.material.emissive.set('#0f3d26'));
      log('到葉子 ⟨' + d.leaf.map((k) => 'a' + SUB[k]).join(',') + '⟩：比較了 ' + dt.depth + ' 次就知道排列。');
      dtState();
      return false;
    }
    const [i, j] = d.c, le = dt.vals[i] <= dt.vals[j];
    dt.bars.forEach((b, k) => b.obj.material.emissive.set(k === i || k === j ? '#8a6400' : '#000000'));
    const next = d.kids[le ? 0 : 1];
    const r = dt.rods[dt.cur + '-' + next];
    r.material.color.set('#c08a1f'); r.scale.set(2.2, 1, 2.2);
    log('a' + SUB[i] + ' = ' + dt.vals[i] + (le ? ' ≤ ' : ' > ') + 'a' + SUB[j] + ' = ' + dt.vals[j] + ' → 走' + (le ? '左' : '右') + '邊');
    dt.cur = next; dt.depth++;
    glowNode(next);
    dtState();
    return true;
  }
  function lgFact(n) { let s = 0; for (let k = 2; k <= n; k++) s += Math.log2(k); return s; }
  function dtState() {
    const n = dt.n, fact = (() => { let f = 1; for (let k = 2; k <= n; k++) f *= k; return f; })();
    setState('比較排序的下界', [
      ['這次走了', dt.depth + ' 次比較' + (dt.done ? '（到葉子）' : '')],
      ['n = 3', '3! = 6 片葉子，樹高 ≥ ⌈log₂ 6⌉ = 3'],
      ['n = ' + n, n + '! = ' + (fact > 1e9 ? fact.toExponential(2) : fact) + ' 片葉子'],
      ['最少比較次數', '⌈log₂ ' + n + '!⌉ = ' + Math.ceil(lgFact(n) - 1e-9) + '　（n log₂ n ≈ ' + Math.round(n * Math.log2(n)) + '）'],
    ], '高度 h 的二元樹最多 2ʰ 片葉子：2ʰ ≥ n! → h ≥ log₂ n!<br>log₂ n! ≥ (n/2)·log₂(n/2) → <span class="ok">Ω(n log n)</span>');
  }

  // ───────────────────────── 文字頁 ─────────────────────────
  function renderCmp(el) {
    const rows = [
      ['Insertion', 'O(n)', 'O(n²)', 'O(n²)', 'O(1)', '穩定'],
      ['Selection', 'O(n²)', 'O(n²)', 'O(n²)', 'O(1)', '不穩定'],
      ['Bubble', 'O(n)＊', 'O(n²)', 'O(n²)', 'O(1)', '穩定'],
      ['Merge', 'O(n log n)', 'O(n log n)', 'O(n log n)', 'O(n)', '穩定'],
      ['Quick', 'O(n log n)', 'O(n log n)', 'O(n²)', 'O(log n)～O(n)（遞迴堆疊）', '不穩定'],
      ['Heap', 'O(n log n)', 'O(n log n)', 'O(n log n)', 'O(1)', '不穩定'],
      ['Counting', 'O(n + k)', 'O(n + k)', 'O(n + k)', 'O(n + k)', '穩定'],
      ['Radix（LSD）', 'O(d(n + r))', 'O(d(n + r))', 'O(d(n + r))', 'O(n + r)', '穩定'],
    ];
    const cls = (t) => (t === '穩定' || /n log n\)$/.test(t) || t === 'O(1)' ? 'o1' : t === '不穩定' || t === 'O(n²)' ? 'on' : '');
    el.innerHTML = '<h2>排序比較表</h2>'
      + '<p>比較排序（前六種）最好也只能 Ω(n log n)；Counting／Radix 不靠比較，鍵值範圍夠小時可以做到線性。</p>'
      + '<table class="lab-table"><thead><tr><th>演算法</th><th>最佳</th><th>平均</th><th>最差</th><th>額外空間</th><th>穩定</th></tr></thead><tbody>'
      + rows.map((r) => '<tr>' + r.map((c, i) => (i ? '<td class="' + cls(c) + '">' + esc(c) + '</td>' : '<th>' + esc(c) + '</th>')).join('') + '</tr>').join('')
      + '</tbody></table><p class="src">k = 鍵值範圍；d = 位數；r = 基底（bucket 數）。＊Bubble 要有「這回合沒交換就停」的 flag 才是 O(n)。</p>'
      + '<h3>容易搞混的地方</h3>'
      + '<div class="lab-trap">Quick Sort 最差 O(n²)：已排序或反序的輸入、又固定取第一個當 pivot，每次只切掉一個。改用三數取中或隨機 pivot 可以避開。</div>'
      + '<div class="lab-trap">Insertion Sort 在「幾乎排好」時很快（接近 O(n)），所以常用來處理小陣列或收尾。</div>'
      + '<div class="lab-trap">Selection Sort 不管輸入如何都比較 n(n−1)/2 次，但交換最多 n−1 次，適合搬資料很貴的情況。它不穩定（遠距離交換會跳過相同的值）。</div>'
      + '<div class="lab-trap">Merge Sort 合併時「相等取左邊」才穩定；它需要 O(n) 暫存空間，不是 in-place。Heap Sort 是 in-place，但不穩定。</div>'
      + '<div class="lab-trap">Radix Sort 從最低位（LSD）開始，而且每回合的排序必須穩定（例如 Counting Sort）。若每回合改用 Merge Sort，總時間就變成 d · n log n，失去線性的好處。</div>'
      + '<div class="lab-trap">決策樹下界：n! 片葉子的二元樹高度至少 ⌈log₂ n!⌉ = Θ(n log n)，所以任何比較排序最差都要 Ω(n log n) 次比較；Merge／Heap 在這個模型裡是最佳的。</div>';
  }

  // quiz helpers
  const J = (a) => a.join(', ');
  function bubblePass(a) { a = a.slice(); for (let j = 0; j + 1 < a.length; j++) if (a[j] > a[j + 1]) [a[j], a[j + 1]] = [a[j + 1], a[j]]; return a; }
  function selectionPass(a) { a = a.slice(); let m = 0; for (let j = 1; j < a.length; j++) if (a[j] < a[m]) m = j; [a[0], a[m]] = [a[m], a[0]]; return a; }
  function insertionPasses(a, k) { a = a.slice(); for (let i = 1; i <= k && i < a.length; i++) { const key = a[i]; let j = i - 1; while (j >= 0 && a[j] > key) { a[j + 1] = a[j]; j--; } a[j + 1] = key; } return a; }
  function partitionBari(a) {
    a = a.slice(); const p = a[0], h = a.length; let i = 0, j = h;
    do { do i++; while (i < h && a[i] <= p); do j--; while (a[j] > p); if (i < j) [a[i], a[j]] = [a[j], a[i]]; } while (i < j);
    [a[0], a[j]] = [a[j], a[0]]; return a;
  }
  function partitionLomuto(a) {
    a = a.slice(); const h = a.length - 1, p = a[h]; let i = -1;
    for (let j = 0; j < h; j++) if (a[j] <= p) { i++; [a[i], a[j]] = [a[j], a[i]]; }
    [a[i + 1], a[h]] = [a[h], a[i + 1]]; return a;
  }
  function heapBottomUp(a) {
    a = a.slice(); const n = a.length;
    const adj = (k) => { for (;;) { let c = 2 * k + 1; if (c >= n) return; if (c + 1 < n && a[c + 1] > a[c]) c++; if (a[k] >= a[c]) return; [a[k], a[c]] = [a[c], a[k]]; k = c; } };
    for (let k = (n >> 1) - 1; k >= 0; k--) adj(k);
    return a;
  }
  function heapInsertions(a) {
    const h = [];
    a.forEach((x) => { h.push(x); let k = h.length - 1; while (k > 0 && h[(k - 1) >> 1] < h[k]) { [h[k], h[(k - 1) >> 1]] = [h[(k - 1) >> 1], h[k]]; k = (k - 1) >> 1; } });
    return h;
  }
  function digitPass(a, d) { const Q = Array.from({ length: 10 }, () => []); a.forEach((x) => Q[Math.floor(x / d) % 10].push(x)); return [].concat(...Q); }
  function fill(set, maker) { let t = 0; while (set.size < 4 && t++ < 80) set.add(maker()); return [...set]; }
  const distinct = (n, hi = 30) => shuffle([...Array(hi).keys()].map((x) => x + 1)).slice(0, n);
  const GENS = [
    () => { // 第一回合後
      const a = distinct(6), kind = ['bubble', 'selection', 'insertion'][rnd(3)];
      const res = { bubble: J(bubblePass(a)), selection: J(selectionPass(a)), insertion: J(insertionPasses(a, 2)) };
      const name = { bubble: 'Bubble Sort 第一回合', selection: 'Selection Sort 第一回合', insertion: 'Insertion Sort 做完 i = 1、2 兩次插入' }[kind];
      const opts = fill(new Set([res[kind], res.bubble, res.selection, res.insertion]), () => J(shuffle(a.slice())));
      return { q: '陣列 ' + J(a) + '，由小排到大。' + name + '之後陣列是？', opts, ans: res[kind],
        why: { bubble: '相鄰比較、大的往右換，一回合後最大值 ' + Math.max(...a) + ' 一定在最右邊。', selection: '找出最小值 ' + Math.min(...a) + '，跟第一個交換；其他不動。', insertion: '前三個排好、後面不動。' }[kind] + '答案：' + res[kind] };
    },
    () => { // partition（Abdul Bari 版）
      const a = distinct(7), ans = J(partitionBari(a));
      const sorted = J(a.slice().sort((x, y) => x - y));
      const opts = fill(new Set([ans, J(partitionLomuto(a)), sorted]), () => { const b = partitionBari(a); const k = rnd(b.length - 1); [b[k], b[k + 1]] = [b[k + 1], b[k]]; return J(b); });
      return { q: 'Quick Sort 對 ' + J(a) + ' 做第一次 partition：pivot = 第一個 ' + a[0] + '，i 往右找 > pivot、j 往左找 ≤ pivot，i < j 就交換，交錯後 pivot 與 a[j] 交換。結果是？',
        opts, ans, why: 'pivot ' + a[0] + ' 最後站到自己的排序位置：左邊都比它小、右邊都比它大，但兩邊內部還沒排好。答案：' + ans };
    },
    () => { // 複雜度表
      const tbl = { Insertion: ['O(n)', 'O(n²)', 'O(n²)'], Selection: ['O(n²)', 'O(n²)', 'O(n²)'], Merge: ['O(n log n)', 'O(n log n)', 'O(n log n)'], Quick: ['O(n log n)', 'O(n log n)', 'O(n²)'], Heap: ['O(n log n)', 'O(n log n)', 'O(n log n)'] };
      const names = Object.keys(tbl), al = names[rnd(names.length)], c = rnd(3), cn = ['最佳', '平均', '最差'][c];
      return { q: al + ' Sort 的' + cn + '時間複雜度？', opts: ['O(n)', 'O(n log n)', 'O(n²)', 'O(log n)'], ans: tbl[al][c],
        why: al + '：最佳 ' + tbl[al][0] + '、平均 ' + tbl[al][1] + '、最差 ' + tbl[al][2] + '。' };
    },
    () => { // 穩定性
      const list = ['insertion', 'selection', 'bubble', 'merge', 'quick', 'heap', 'counting', 'radix'], al = list[rnd(list.length)];
      const ans = ALGOS[al].stable ? '穩定' : '不穩定';
      const why = { insertion: '只把「比 key 大」的往右挪，相等的不會越過去。', selection: '最小值和前面的元素遠距離交換，可能把相同值的順序換掉。', bubble: '只在「左 > 右」時交換，相等的不換。', merge: '合併時相等取左邊那段，原本在前面的還是在前面。', quick: 'partition 的遠距離交換會打亂相同值的順序。', heap: '把根換到尾端的動作會打亂相同值的順序。', counting: '由左往右放（或由右往左配合 pos 遞減），相同值維持原順序。', radix: '每回合都用穩定的分配，才能保留前一回合的結果。' }[al];
      return { q: ALGOS[al].name + ' 是穩定排序嗎？', opts: ['穩定', '不穩定'], ans, why };
    },
    () => { // 決策樹下界
      const n = 3 + rnd(5); let f = 1; for (let k = 2; k <= n; k++) f *= k;
      const ans = String(Math.ceil(lgFact(n) - 1e-9));
      const opts = fill(new Set([ans, String(n - 1), String(Math.round(n * Math.log2(n))), String(n * (n - 1) / 2)]), () => String(2 + rnd(20)));
      return { q: '用比較來排序 ' + n + ' 個相異元素，最差情況「至少」要比較幾次？', opts, ans,
        why: '決策樹至少要有 ' + n + '! = ' + f + ' 片葉子；高度 h 的二元樹最多 2ʰ 片葉子，所以 h ≥ ⌈log₂ ' + f + '⌉ = ' + ans + '。' };
    },
    () => { // Radix LSD 第一回合
      const a = Array.from({ length: 6 }, () => 10 + rnd(90));
      const ans = J(digitPass(a, 1));
      const opts = fill(new Set([ans, J(digitPass(a, 10)), J(a.slice().sort((x, y) => x - y))]), () => J(shuffle(a.slice())));
      return { q: 'Radix Sort（LSD，基底 10）對 ' + J(a) + ' 做完第一回合後是？', opts, ans,
        why: 'LSD 第一回合看「個位數」，依 bucket 0→9、同一個 bucket 先進先出收回來。答案：' + ans };
    },
    () => { // 建 heap
      const a = distinct(7), ans = J(heapBottomUp(a));
      const opts = fill(new Set([ans, J(heapInsertions(a)), J(a.slice().sort((x, y) => y - x))]), () => J(shuffle(heapBottomUp(a))));
      return { q: '把 ' + J(a) + ' 用課本的方法（從最後一個非葉節點往回 adjust）建成 max heap，陣列變成？', opts, ans,
        why: '由下往上：從第 ' + (a.length >> 1) + ' 個（最後一個非葉節點）往回，每個節點往下沉到比孩子都大。答案：' + ans + '（一個一個 insert 建出來的可能不一樣）' };
    },
    () => { // Counting Sort 的 pos（MIT Rec7）
      const a = Array.from({ length: 6 }, () => rnd(6)), v = a[rnd(a.length)];
      const less = a.filter((x) => x < v).length, cnt = a.filter((x) => x === v).length;
      const ans = String(less);
      const opts = fill(new Set([ans, String(less + cnt), String(cnt), String(Math.max(0, less - 1))]), () => String(rnd(7)));
      return { q: 'Counting Sort（MIT 寫法）A = ' + J(a) + '，鍵值 0..5。pos[' + v + ']（第一個 ' + v + ' 要放的位置，0-based）是多少？', opts, ans,
        why: 'pos[v] = 比 v 小的元素個數 = count[0] + … + count[v−1] = ' + less + '；放一個之後 pos[v]++。' };
    },
  ];
  const qz = { score: 0, total: 0 };
  function renderQuiz(el) {
    const p = GENS[rnd(GENS.length)]();
    let opts = [...new Set(p.opts)];
    if (!opts.includes(p.ans)) opts[0] = p.ans;
    opts = shuffle(opts);
    el.innerHTML = '<h2>小測驗</h2><div class="lab-quiz-score">答對 ' + qz.score + ' / ' + qz.total + '</div>'
      + '<div class="lab-quiz-q" style="white-space:pre-wrap">' + esc(p.q) + '</div><div class="lab-quiz-opts">'
      + opts.map((o) => '<button data-o="' + encodeURIComponent(o) + '">' + esc(o) + '</button>').join('') + '</div><div id="qx"></div>';
    el.querySelectorAll('.lab-quiz-opts button').forEach((btn) => {
      btn.onclick = () => {
        if (el.querySelector('.right')) return;
        const pick = decodeURIComponent(btn.dataset.o);
        qz.total++; if (pick === p.ans) qz.score++;
        el.querySelectorAll('.lab-quiz-opts button').forEach((b) => {
          const o = decodeURIComponent(b.dataset.o);
          if (o === p.ans) b.classList.add('right'); else if (b === btn) b.classList.add('wrong');
        });
        $('qx').innerHTML = '<div class="lab-quiz-explain">' + (pick === p.ans ? '答對了。' : '答錯了。') + esc(p.why) + '</div><button class="lab-next" id="qNext">下一題</button>';
        $('qNext').onclick = () => renderQuiz(el);
      };
    });
  }

  // ───────────────────────── 舞台場景 ─────────────────────────
  const scenes = {
    // Abdul Bari〈Quick Sort〉：先講「排序位置」（4 6 7 10 16 12 13 14 的 10），再用 10 16 8 12 15 6 3 9 5 做 partition
    'quick-partition': { title: 'Quick Sort：pivot 找到自己的位置', play: async (tok) => {
      buildSort({ algo: 'insertion', vals: [4, 6, 7, 10, 16, 12, 13, 14] });
      S.bars[3].mesh.material.emissive.set('#8a6400');
      say('10 已經在「排序位置」：左邊都比它小、右邊都比它大', '其他的還沒排好也沒關係');
      await beat(tok, 4200);
      Object.assign(CFG.dc, { algo: 'quick', input: 'video', pivot: 'first', rule: 'bari' });
      enterDC(true);
      say('Quick Sort：讓 pivot 自己找到排序位置', 'pivot = 第一個 = 10，尾端放 ∞');
      await beat(tok, 2600);
      let first = true;
      while (S.i < S.steps.length - 1) {
        sortStep();
        const st = S.steps[S.i];
        say(st.msg, 'i 找 > pivot、j 找 ≤ pivot；i < j 就交換');
        await beat(tok, first ? 900 : 220);
        if (first && /就定位/.test(st.msg)) {
          say('10 歸位：6 5 8 9 3 ｜10｜ 15 12 16', '<span class="ok">左邊 ≤ 10 ＜ 右邊</span>，兩邊遞迴');
          await beat(tok, 3400);
          first = false;
        }
      }
      say('每個 pivot 都歸位 → 排好了', '平均 O(n log n)');
      await beat(tok, 2600);
    } },
    'quick-worst-case': { title: 'Quick Sort 最差情況與 pivot 選擇', play: async (tok) => {
      const v = [3, 5, 7, 9, 11, 13, 15];
      Object.assign(CFG.dc, { algo: 'quick', input: 'sorted', pivot: 'first', rule: 'bari', vals: v.slice(), n: 7 });
      enterDC(false);
      say('已排序的輸入 + 取第一個當 pivot', '每次 partition 只切掉 pivot 自己');
      await beat(tok, 2400);
      await playSteps(tok, 160, false);
      const worst = S.steps[S.steps.length - 1].cmp;
      say('切得一邊 0 個、一邊 n−1 個 → O(n²)', '比較 ' + worst + ' 次');
      await beat(tok, 3000);
      Object.assign(CFG.dc, { pivot: 'median3', vals: v.slice() });
      enterDC(false);
      say('改成三數取中（median-of-three）', '取 a[low]、a[mid]、a[high] 的中位數當 pivot');
      await beat(tok, 2400);
      await playSteps(tok, 160, false);
      say('每次都切在中間附近 → O(n log n)', '比較 ' + S.steps[S.steps.length - 1].cmp + ' 次（原本 ' + worst + ' 次）');
      await beat(tok, 3200);
      Object.assign(CFG.dc, { pivot: 'first', input: 'video', vals: null, n: 9 });
    } },
    'merge-sort': { title: 'Merge Sort：切開再合併', play: async (tok) => {
      Object.assign(CFG.dc, { algo: 'merge', input: 'random', n: 8 });
      enterDC(true);
      say('先一路對半切，切到只剩一個', '');
      await beat(tok, 1800);
      await playSteps(tok, 380);
      say('每層合併 O(n)、共 log n 層', '<span class="ok">一律 O(n log n)</span>，暫存陣列 O(n)');
      await beat(tok, 3000);
      Object.assign(CFG.dc, { algo: 'quick', input: 'video', vals: null, n: 9 });
    } },
    'heap-sort': { title: 'Heap Sort：陣列就是一棵樹', play: async (tok) => {
      Object.assign(CFG.heap, { input: 'random', n: 7 });
      enterHeap(true);
      say('陣列直接看成完整二元樹', '[i] 的孩子是 [2i]、[2i+1]');
      await beat(tok, 2200);
      await playSteps(tok, 430);
      say('建 heap O(n)，再刪 n 次根，每次 O(log n)', '<span class="ok">O(n log n)，in-place</span>');
      await beat(tok, 3000);
    } },
    // MIT 6.006 Rec7：比較模型 → n log n 下界
    'comparison-lower-bound': { title: '比較模型的下界：決策樹', play: async (tok) => {
      dt.vals = [5, 2, 8]; enterTree();
      say('比較排序只能問：aᵢ ≤ aⱼ 嗎？', '每種演算法 = 一棵決策樹');
      await beat(tok, 2600);
      while (dtStep()) { say('每問一次，往左或往右走一層', ''); await beat(tok, 1500); }
      dtStep();
      say('走到葉子 = 知道排列', '走了 ' + dt.depth + ' 次比較');
      await beat(tok, 2600);
      dt.vals = [8, 5, 2]; enterTree();
      say('換一組輸入，走到另一片葉子', '');
      await beat(tok, 1400);
      while (dtStep()) await beat(tok, 1200);
      dtStep();
      say('3 個元素有 3! = 6 種排列 → 6 片葉子', '樹高 ≥ ⌈log₂ 6⌉ = 3');
      await beat(tok, 3000);
      say('n! 片葉子 → 高度 ≥ log₂ n!', '<span class="ok">任何比較排序最差 Ω(n log n)</span>');
      await beat(tok, 3200);
    } },
    // MIT 6.006 Rec7：Counting Sort 的例子 4 1 3 2 3（k = 6），pos = 比 v 小的個數
    'counting-sort': { title: 'Counting Sort：數一數、算位置', play: async (tok) => {
      Object.assign(CFG.dist, { algo: 'counting', input: 'video' });
      enterDist(true);
      say('鍵值是 0..k−1 的整數：不用比較', 'A = 4 1 3 2 3，k = 6');
      await beat(tok, 2600);
      while (S.i < S.steps.length - 1) {
        sortStep();
        const st = S.steps[S.i];
        say(st.msg, st.bkName === 'pos' ? 'pos[v] = 比 v 小的個數' : 'count[v] = v 出現幾次');
        await beat(tok, 1100);
      }
      say('3A 仍在 3B 前面：Counting Sort 穩定', '<span class="ok">O(n + k)</span>');
      await beat(tok, 3000);
    } },
    // MIT 6.006 Rec7：Radix Sort，從最低位開始，每回合穩定
    'radix-lsd': { title: 'Radix Sort：從最低位開始', play: async (tok) => {
      Object.assign(CFG.dist, { algo: 'radix', input: 'video' });
      enterDist(true);
      say('Radix Sort：每回合只看一位數', '直覺想從最高位開始？反過來：從最低位');
      await beat(tok, 2600);
      while (S.i < S.steps.length - 1) {
        sortStep();
        const st = S.steps[S.i];
        say(st.msg, st.f || '同一個 bucket 先進先出 → 穩定');
        await beat(tok, /收回/.test(st.msg) ? 700 : 420);
      }
      say('4 回合後完全排好', '<span class="ok">d 回合 × O(n + k)</span>；每回合必須穩定');
      await beat(tok, 3000);
    } },
    // MIT 6.006 Rec7：insertion 穩定、heap 不穩定（Q&A 段）
    'stability': { title: '穩定性：相同的值保持原順序', play: async (tok) => {
      stab.algo = 'heap'; enterStab(true);
      say('相同的值標成 A、B：排完 A 還在 B 前面嗎？', 'Heap Sort');
      await beat(tok, 2200);
      await playSteps(tok, 170, false);
      say('Heap Sort 把 A、B 弄反了', '<span class="no">不穩定</span>');
      await beat(tok, 3000);
      const v = stab.vals.slice();
      stab.algo = 'insertion'; stab.vals = v; enterStab(false);
      say('同一組資料換 Insertion Sort', '相等時不往前挪');
      await beat(tok, 1800);
      await playSteps(tok, 170, false);
      say('A 仍在 B 前面', '<span class="ok">穩定</span>：Insertion、Bubble、Merge、Counting、Radix');
      await beat(tok, 3200);
    } },
  };

  return {
    kicker: '資料結構・第 8 章',
    title: '排序演算法',
    color: 'var(--ds)',
    modes: [
      { id: 'basic', name: '簡單排序 O(n²)', enter: () => enterBasic(false) },
      { id: 'dc', name: 'Quick／Merge', enter: () => enterDC(false) },
      { id: 'heap', name: 'Heap Sort', enter: () => enterHeap(false) },
      { id: 'dist', name: 'Counting／Radix', enter: () => enterDist(false) },
      { id: 'stable', name: '穩定性', enter: () => enterStab(false) },
      { id: 'lower', name: '下界：決策樹', enter: enterTree },
    ],
    pages: [
      { id: 'cmp', name: '比較表', render: renderCmp },
      { id: 'quiz', name: '小測驗', render: renderQuiz },
    ],
    scenes,
    sceneOrder: ['quick-partition', 'quick-worst-case', 'merge-sort', 'heap-sort', 'comparison-lower-bound', 'counting-sort', 'radix-lsd', 'stability'],
    stop() { stopTimer(); },
  };
}
