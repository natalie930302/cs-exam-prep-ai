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
import kit from './_kit.js';

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


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ heaphq.js ═══
  {
// ─── HqPJF2L5h9U：Abdul Bari「Heap」（陣列表示、complete binary tree、insert／delete、heap sort、heapify、priority queue） ───
// Cued scenes: every `await step(tok)` waits for the sentence it shows; beats are motion only.
// 只用 K 與 ctx。陣列一律 1-based。左下角的小幫手會跟著反應（違規時驚訝、修好時開心）。
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, line, arrow, code, travel, buddy, icon, step, GOLD, GREEN, RED, GRAY } = K;
const say = ctx.say, beat = ctx.beat, colorFor = ctx.colorFor;
const BLUE = '#1f3a6e', SORTED = '#2fc092';
const QLY = [6.2, 4.7, 3.2, 1.7];
const QCAM = [0, 6, 15.5], QLOOK = [0, 3.3, 1];
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const bubble = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const pkt = (t, x, y, z = 0) => tag(t, 'pkt', x, y, z);
// 小幫手：站在左下角，用表情陪你看每一步
const guide = (x = -6.3, z = 1.8) => buddy('', '', '#ffc56b', x, 0, z, 0.72);
// 一棵 heap：上面是樹、下面是陣列格（同一份資料兩種畫法）
function qTree(vals, o = {}) {
  const W = o.w || 11, X0 = o.x0 || 0, cap = o.cap || vals.length, arr = o.arr !== false;
  const cz = o.cz === undefined ? 3.4 : o.cz, dx = o.dx || 0.9, sz = o.sz || 0.9, min = !!o.min;
  const better = (x, y) => (min ? x < y : x > y);
  const GT = min ? '<' : '>', GE = min ? '≤' : '≥', BIG = min ? '小' : '大';
  const col = (v) => (o.color ? o.color(v) : colorFor(v));
  const S = { a: [null], nd: [null], cl: [null], ed: [null], size: 0, cap, better };
  S.p = (i) => { const d = Math.floor(Math.log2(i)), c = 1 << d; return V3(X0 + ((i - c + 0.5) / c - 0.5) * W, QLY[d], 0); };
  S.c = (i) => V3(X0 + (i - (cap + 1) / 2) * dx, 0.3, cz);
  if (arr) for (let i = 1; i <= cap; i++) { const c = S.c(i); ctx.tile(V3(c.x, 0.02, c.z), dx * 0.92, 0.9); tag('[' + i + ']', 'idx', c.x, 0.05, c.z + 0.75); }
  S.node = (i, v, drop = 0) => {
    S.a[i] = v; const p = S.p(i);
    if (i > 1 && !S.ed[i]) { const q = S.p(i >> 1); S.ed[i] = line(q.x, q.y, p.x, p.y); }
    S.nd[i] = cube(v, col(v), [sz, sz, sz], p.x, p.y, 0, drop);
  };
  S.cell = (i, v, drop = 0) => { S.a[i] = v; if (!arr) return; const c = S.c(i); S.cl[i] = cube(v, col(v), [dx * 0.72, 0.42, 0.7], c.x, c.y, c.z, drop ? 2 : 0); };
  S.put = (i, v, drop = 0) => { S.node(i, v, drop); S.cell(i, v, drop); S.size = Math.max(S.size, i); };
  S.drop = (i) => { if (S.nd[i]) { kill(S.nd[i]); S.nd[i] = null; } if (S.cl[i]) { kill(S.cl[i]); S.cl[i] = null; } if (S.ed[i]) { kill(S.ed[i]); S.ed[i] = null; } S.a[i] = null; };
  vals.forEach((v, k) => { if (v === null || v === undefined) return; if (o.cellsOnly) S.cell(k + 1, v); else S.put(k + 1, v); });
  if (o.cellsOnly) S.size = 0;
  const szl = o.sizeTag && arr ? tag('', 'ptr', 0, 1.15, cz) : null;
  S.setSize = (k) => { S.size = k; if (!szl) return; const c = S.c(Math.max(1, k)); txt(szl, 'heap size = ' + k); szl.position.set(c.x, 1.15, cz); };
  if (szl) S.setSize(S.size);
  S.hl = (list, c) => list.forEach((i) => { if (S.nd[i]) glow(S.nd[i], c); if (S.cl[i]) glow(S.cl[i], c); });
  S.off = () => { for (let i = 1; i <= cap; i++) { if (S.nd[i]) glow(S.nd[i], null); if (S.cl[i]) glow(S.cl[i], null); } };
  S.sw = async (tok, i, j, ms = 800) => {
    const pi = S.p(i), pj = S.p(j);
    if (S.nd[i]) move(S.nd[i], pj.x, pj.y, 0); if (S.nd[j]) move(S.nd[j], pi.x, pi.y, 0);
    if (S.cl[i] && S.cl[j]) { const ci = S.c(i), cj = S.c(j); move(S.cl[i], cj.x, cj.y, cj.z); move(S.cl[j], ci.x, ci.y, ci.z); }
    [S.nd[i], S.nd[j]] = [S.nd[j], S.nd[i]]; [S.cl[i], S.cl[j]] = [S.cl[j], S.cl[i]]; [S.a[i], S.a[j]] = [S.a[j], S.a[i]];
    await beat(tok, ms);
  };
  // 把位置 i 的元素搬到空位 j（樹與陣列一起搬）
  S.mv = (i, j) => {
    const p = S.p(j);
    if (S.nd[i]) move(S.nd[i], p.x, p.y, 0);
    if (S.cl[i]) { const c = S.c(j); move(S.cl[i], c.x, c.y, c.z); }
    S.nd[j] = S.nd[i]; S.cl[j] = S.cl[i]; S.a[j] = S.a[i]; S.nd[i] = null; S.cl[i] = null; S.a[i] = null;
    if (S.ed[i]) { kill(S.ed[i]); S.ed[i] = null; }
    if (j > 1 && !S.ed[j]) { const q = S.p(j >> 1); S.ed[j] = line(q.x, q.y, p.x, p.y); }
  };
  // insert 的調整：由葉子往根（向上），整段在同一步裡快速播完
  S.up = async (tok, i, ms = 600) => {
    while (i > 1) {
      const p = i >> 1; S.off(); S.hl([i], GOLD); S.hl([p], BLUE);
      if (!better(S.a[i], S.a[p])) { await beat(tok, ms * 0.5); break; }
      await S.sw(tok, i, p, ms); i = p;
    }
    S.off(); return i;
  };
  // delete／heapify 的調整：由 i 往葉子（向下），和較大（min-heap 是較小）的孩子換
  S.down = async (tok, i, size, ms = 600) => {
    while (2 * i <= size) {
      const l = 2 * i, r = l + 1; let c = l; if (r <= size && better(S.a[r], S.a[l])) c = r;
      S.off(); S.hl([i], GOLD); S.hl(r <= size ? [l, r] : [l], BLUE);
      await beat(tok, ms * 0.5);
      if (!better(S.a[c], S.a[i])) break;
      await S.sw(tok, i, c, ms); i = c;
    }
    S.off(); return i;
  };
  // 刪根：根飛走、最後一個補到根（不往下調）。mode：'keep' 放進 [n]、'park' 先停在 [n] 上方、'fly' 丟掉
  S.popStart = async (tok, mode = 'fly', ms = 700) => {
    const n = S.size, top = S.a[1];
    S.off();
    fly(S.nd[1]); S.nd[1] = null;
    const cell = S.cl[1]; S.cl[1] = null;
    if (n > 1) S.mv(n, 1);
    if (S.ed[n]) { kill(S.ed[n]); S.ed[n] = null; }
    if (cell) {
      glow(cell, null); tint(cell, GRAY);
      const cn = S.c(n);
      if (mode === 'keep') { move(cell, cn.x, cn.y, cn.z); S.cl[n] = cell; }
      else if (mode === 'park') { move(cell, cn.x, 1.3, cn.z + 0.2); S.parked = cell; }
      else fly(cell, V3(0, 6, 5));
    }
    S.a[n] = mode === 'fly' ? null : top;
    S.setSize(n - 1);
    await beat(tok, ms);
    return top;
  };
  // 停在上方的值放進 [i]
  S.store = (i) => { if (!S.parked) return; const c = S.c(i); move(S.parked, c.x, c.y, c.z); S.cl[i] = S.parked; S.parked = null; };
  S.pop = async (tok, mode = 'keep', ms = 500) => { const n = S.size, top = await S.popStart(tok, mode, ms); await S.down(tok, 1, n - 1, ms); return top; };
  S.gaps = (list) => list.map((i) => { const c = S.c(i); return tag('空', 'ptr', c.x, 0.95, c.z); });
  S.lvTags = (k) => { const out = []; for (let d = 0; d < k; d++) out.push(tag('h = ' + d, 'idx', X0 - W / 2 - 0.9, QLY[d], 0)); return out; };
  return S;
}
const HQ_MAX = [50, 30, 20, 15, 10, 8, 16];
const ABC = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const LETTER = () => '#4b9ee2';

// 02:29 陣列表示（11 步）
FRAG.push(['heaphq-array-rep', '用陣列存 Binary Tree：A–G 與三個公式', async (tok) => {
  fresh(QCAM, QLOOK);
  const pal = guide();
  await step(tok);                                   // 2:32 這是一棵 binary tree，要存進陣列
  const S = qTree([], { cap: 7, color: LETTER });
  ABC.forEach((v, k) => S.node(k + 1, v, 2));
  say('一棵 binary tree，要把它存進陣列', '節點用字母 A–G，比較好讀');
  await beat(tok, 900);
  await step(tok);                                   // 2:50 程式從 0 開始，這裡從 1 開始
  const n1 = note('從 [1] 開始', S.c(1).x, 1.25, S.c(1).z);
  say('寫程式陣列從 [0] 開始；課本習慣從 [1] 開始', '[0] 不用，第一個元素放在 [1]');
  await step(tok);                                   // 3:18 要存兩件事
  kill(n1);
  const b1 = bubble('① 所有元素', 5.0, 6.7, 0), b2 = bubble('② 誰是 parent／child', 5.0, 6.0, 0);
  pal.mood('wow');
  say('要存兩件事：元素本身，和彼此的關係', '誰是 parent、誰是 left child、right child');
  await step(tok);                                   // 3:36 一層一層填
  pal.mood('calm');
  for (const [k, v] of ABC.entries()) { S.cell(k + 1, v, 1); S.hl([k + 1], GOLD); await beat(tok, 260); S.off(); }
  S.size = 7;
  say('一層一層、由左到右放進陣列', 'A B C D E F G');
  await step(tok);                                   // 3:51 關係靠公式
  kill(b1); kill(b2);
  const F = code(['left(i)   = 2i    ', 'right(i)  = 2i + 1', 'parent(i) = ⌊i/2⌋ '], 4.9, 6.9, 0.5);
  say('關係靠三個公式維持', '節點在 index i 時：');
  await step(tok);                                   // 4:10 B 在 2，左孩子 D 在 4
  F.hl(0); S.hl([2], GOLD); S.hl([4], GREEN);
  say('B 在 i = 2：左孩子在 2i = 4', 'A[4] = D ✓');
  await step(tok);                                   // 4:24 右孩子 2i+1 = 5
  F.hl(1); S.off(); S.hl([2], GOLD); S.hl([5], GREEN);
  say('右孩子在 2i + 1 = 5', 'A[5] = E ✓');
  await step(tok);                                   // 4:30 C 在 3，孩子 6、7
  S.off(); S.hl([3], GOLD); S.hl([6, 7], GREEN);
  say('C 在 i = 3：孩子在 6 和 7', 'A[6] = F、A[7] = G ✓');
  await step(tok);                                   // 4:49 F 的 parent
  F.hl(2); S.off(); S.hl([6], GOLD); S.hl([3], GREEN);
  say('F 在 6：parent = 6 / 2 = 3', 'A[3] = C ✓');
  await step(tok);                                   // 4:58 G 的 parent：7/2 = 3.5 取 floor
  S.off(); S.hl([7], GOLD); S.hl([3], GREEN);
  const fl = note('7 / 2 = 3.5 → ⌊3.5⌋ = 3', S.p(7).x, S.p(7).y + 1.0, 0);
  say('G 在 7：7 / 2 = 3.5，取 floor 得 3', 'A[3] = C ✓');
  await step(tok);                                   // 5:18 照層序填，公式自動成立
  kill(fl); S.off(); F.hl(-1);
  pal.mood('happy'); await pal.hop(tok);
  say('不用每次套公式：照層序填就自動成立', 'left = 2i、right = 2i + 1、parent = ⌊i/2⌋');
}]);

// 05:38 缺節點要留空格（8 步）
FRAG.push(['heaphq-array-gaps', '缺少的節點要在陣列留空格', async (tok) => {
  fresh(QCAM, QLOOK);
  const pal = guide();
  await step(tok);                                   // 5:39 另一棵：A B C D E
  let S = qTree([], { cap: 7, color: LETTER });
  for (const [k, v] of ['A', 'B', 'C', 'D', 'E'].entries()) { S.put(k + 1, v, 2); await beat(tok, 220); }
  say('少了幾個節點：A B C D E 一樣層序填', '陣列：A B C D E');
  await step(tok);                                   // 5:48 公式照樣成立
  const ok1 = good('公式照樣成立 ✓', 5.0, 6.6, 0);
  S.hl([2], GOLD); S.hl([4, 5], GREEN);
  say('檢查 B：孩子在 4、5，正確', '最後一層不滿沒關係');
  await step(tok);                                   // 5:57 這棵：A B C，D 是 C 的孩子
  fresh(QCAM, QLOOK);
  const pal2 = guide();
  S = qTree([], { cap: 7, color: LETTER });
  for (const [k, v] of ['A', 'B', 'C'].entries()) S.put(k + 1, v);
  S.node(6, 'D', 2);
  say('這棵：D 是 C 的左孩子', 'B 沒有孩子');
  await step(tok);                                   // 6:12 有缺就要留空格
  const ghosts = [4, 5].map((i) => { const p = S.p(i); return tag('（沒有）', 'idx', p.x, p.y, 0); });
  pal2.mood('wow');
  say('層序填時，缺的節點也要佔一格', 'B 的兩個孩子位置：空的');
  await step(tok);                                   // 6:22 A B C _ _ D
  const g = S.gaps([4, 5]);
  S.cell(6, 'D', 1); S.size = 6;
  say('陣列：A B C _ _ D', 'D 放在 [6]');
  await step(tok);                                   // 6:36 D 的 parent：6/2 = 3
  S.hl([6], GOLD); S.hl([3], GREEN);
  pal2.mood('happy');
  say('D 的 parent：⌊6/2⌋ = 3 → C', '關係正確 ✓');
  await step(tok);                                   // 6:45 如果把 D 放在 [4]
  S.off();
  const wrong = cube('D', '#e8a0a0', [0.65, 0.42, 0.7], S.c(4).x, 1.6, S.c(4).z);
  await travel(tok, wrong, V3(S.c(6).x, 1.6, S.c(4).z), V3(S.c(4).x, 0.3, S.c(4).z), 700);
  const ar = arrow(V3(S.p(2).x, S.p(2).y - 0.5, 0), V3(S.p(4).x, S.p(4).y + 0.4, 0), 0xa01010);
  const nb = bad('[4] = 2·2 → 變成 B 的左孩子 ✗', S.p(4).x + 0.4, S.p(4).y - 0.2, 0);
  pal2.mood('sad');
  say('若 D 直接接在 [4]：它就變成 B 的孩子', '<span class="no">關係錯了</span>');
  await step(tok);                                   // 7:01 結論：有缺就留空
  fly(wrong); kill(ar); kill(nb); ghosts.forEach(kill);
  pal2.mood('happy'); await pal2.hop(tok);
  say('不用公式時：缺的節點留空格，公式才會對', '公式管關係，元素照原樣存');
}]);

// 07:22 full vs complete（13 步）
FRAG.push(['heaphq-full-complete', 'Full Binary Tree 與 Complete Binary Tree', async (tok) => {
  fresh(QCAM, QLOOK);
  const pal = guide();
  let S, lv, gp = [], ex = [];
  await step(tok);                                   // 7:32 這棵是 full binary tree
  S = qTree([], { cap: 9, color: LETTER });
  ABC.forEach((v, k) => S.node(k + 1, v, 2));
  say('先看 full binary tree', '就是之前那棵 A–G');
  await step(tok);                                   // 7:42 高度 2，節點數最多
  lv = S.lvTags(3);
  say('高度 h = 2：這個高度能放的節點全放滿了', '0、1、2 三層：1 + 2 + 4 = 7 個');
  await step(tok);                                   // 7:53 再加就會長高
  const gh = S.p(8), ghost = cube('?', '#e4dccb', [0.8, 0.8, 0.8], gh.x, gh.y, 0, 2);
  const gn = note('再加一個 → 高度變 3', gh.x + 0.4, gh.y - 0.9, 0);
  pal.mood('wow');
  say('想再加一個節點，只能放到新的一層', '高度就會增加 → 沒有空位了');
  await step(tok);                                   // 8:13 2^(h+1) − 1
  fly(ghost); kill(gn); pal.mood('calm');
  const fm = bubble('full：2^(h+1) − 1 = 2³ − 1 = 7', 4.6, 6.8, 0);
  say('高度 h 的 full tree：2^(h+1) − 1 個節點', 'h = 2 → 7 個');
  await step(tok);                                   // 8:28 complete：陣列中間沒空格
  kill(fm);
  ABC.forEach((v, k) => S.cell(k + 1, v, 1)); S.size = 7;
  say('complete binary tree：用陣列表示', '第一個到最後一個元素之間，沒有空格');
  await step(tok);                                   // 8:49 有缺的就不是
  S.hl([5], RED);
  await beat(tok, 300);
  S.drop(5); gp = S.gaps([5]);
  pal.mood('sad');
  say('拿掉 E：[5] 變成空格', '<span class="no">中間有空 → 不是 complete</span>');
  await step(tok);                                   // 9:05 定義：中間不能有空
  gp.forEach(kill); S.put(5, 'E', 2);
  pal.mood('happy');
  say('我的定義：陣列從頭到尾中間不能有空格', '<span class="ok">A B C D E F G：complete</span>');
  await step(tok);                                   // 9:22 最後一個之後有空沒關係
  ex = [8, 9].map((i) => good('空 OK', S.c(i).x, 0.95, S.c(i).z));
  say('最後一個元素「之後」有空位沒關係', '重點是「中間」不能有');
  await step(tok);                                   // 9:41 full 也是 complete
  ex.forEach(kill);
  const fc = good('full ⇒ complete', 4.6, 6.8, 0);
  say('這棵既是 full 也是 complete', '每個 full binary tree 都是 complete');
  await step(tok);                                   // 9:46 再加兩個：還是 complete
  kill(fc);
  lv.push(tag('h = 3', 'idx', -6.4, QLY[3], 0));
  S.put(8, 'H', 2); S.put(9, 'I', 2);
  say('最後一層從左邊開始放 H、I', '<span class="ok">一層層看沒有缺：complete</span>');
  await step(tok);                                   // 9:59 拿掉一個就不是
  S.hl([8], RED); await beat(tok, 300);
  S.drop(8); gp = S.gaps([8]);
  pal.mood('sad');
  say('拿掉 H：左邊缺了一個', '<span class="no">中間有空 → 不是 complete</span>');
  await step(tok);                                   // 10:31 課本定義
  gp.forEach(kill); S.put(8, 'H', 2);
  S.hl([1, 2, 3, 4, 5, 6, 7], GREEN); S.hl([8, 9], GOLD);
  pal.mood('happy');
  say('課本定義：h − 1 層以上是 full', '最後一層由左往右填');
  await step(tok);                                   // 11:19 almost complete
  S.off();
  bubble('有人叫它 almost complete', 4.6, 6.8, 0);
  say('有些作者叫它 almost complete binary tree', '多數課本叫 complete（這裡也是）');
}]);

// 11:42 判斷 complete 的例子（11 步）
FRAG.push(['heaphq-complete-check', '判斷是不是 Complete：看陣列有沒有空格', async (tok) => {
  const col = () => '#9b7ef4';
  let S, pal, verdict;
  const show = (vals, cap = 10) => { fresh(QCAM, QLOOK); pal = guide(); S = qTree(vals, { cap, color: col }); };
  const yes = (t = 'complete') => { pal.mood('happy'); return good(t + ' ✓', 4.6, 6.8, 0); };
  const no = (t = '不是 complete') => { pal.mood('sad'); return bad(t + ' ✗', 4.6, 6.8, 0); };
  await step(tok);                                   // 11:42 一層一層檢查
  show([1, 2, 3, 4, 5]);
  say('一層一層看：1 個、2 個，最後一層從左邊開始', '陣列：1 2 3 4 5');
  await step(tok);                                   // 11:56 沒缺 → complete
  verdict = yes();
  say('左邊沒有缺：是 complete', '陣列中間沒有空格');
  await step(tok);                                   // 12:02 再一棵
  show([1, 2, 3, 4, 5, 6]);
  verdict = yes();
  say('最後一層靠左連續：還是 complete', '陣列：1 2 3 4 5 6');
  await step(tok);                                   // 12:10 缺了左邊兩個
  show([1, 2, 3, null, null, 6]);
  S.gaps([4, 5]); verdict = no();
  say('最後一層：前兩個位置沒有，卻有第三個', '應該先有左邊的才能有右邊的');
  await step(tok);                                   // 12:27 缺三個
  show([1, 2, 3, null, null, null, 4]);
  verdict = no();
  say('只有最右邊一個：前面缺了三個', '節點要由左到右排');
  await step(tok);                                   // 12:45 陣列：1 2 3 _ _ _ 4
  S.gaps([4, 5, 6]);
  say('寫成陣列：1 2 3 _ _ _ 4', '<span class="no">中間 3 個空格</span>');
  await step(tok);                                   // 13:00 第三層沒滿就往下長
  show([1, 2, 3, 4, 5, 6, null, 8]);
  S.gaps([7]); verdict = no();
  say('第三層還沒滿，就長到第四層', '[7] 空著 → 不是 complete');
  await step(tok);                                   // 13:12 第二層就缺
  show([1, 2, null, 4, 5]);
  S.gaps([3]); verdict = no();
  say('第二層就缺了右邊那個', '[3] 空著 → 不是 complete');
  await step(tok);                                   // 13:17 前面全滿、最後一層靠左
  show([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  verdict = yes();
  say('上面三層全滿，最後一層從左邊連續', '之後沒有節點不要緊');
  await step(tok);                                   // 13:37 高度最小 log n
  S.lvTags(4);
  bubble('h = ⌊log₂ 10⌋ = 3', 4.6, 6.0, 0);
  say('complete binary tree 的高度一定最小', 'h ≈ log n');
  await step(tok);                                   // 13:54 沒填滿不會往下一層
  S.hl([8, 9, 10], GOLD);
  await pal.hop(tok);
  say('上一層沒填滿，就不會往下一層長', '所以不會多長出無謂的高度');
}]);

// 14:35 max heap／min heap（9 步）
FRAG.push(['heaphq-max-min', 'Max Heap 與 Min Heap', async (tok) => {
  fresh(QCAM, QLOOK);
  const pal = guide(-6.4, 2.6);
  let A, B;
  await step(tok);                                   // 14:34 heap 先是 complete binary tree
  A = qTree(HQ_MAX, { arr: false, w: 6, x0: -3.4, sz: 0.75 });
  say('Heap 首先必須是 complete binary tree', '50；30、20；15、10、8、16');
  await step(tok);                                   // 14:39 30、20 比 50 小
  A.hl([1], GOLD); A.hl([2, 3], BLUE);
  say('30 和 20 都比 50 小', '');
  await step(tok);                                   // 14:47 15、10 < 30；8、16 < 20
  A.off(); A.hl([2, 3], GOLD); A.hl([4, 5, 6, 7], BLUE);
  say('15、10 比 30 小；8、16 比 20 小', '');
  await step(tok);                                   // 14:53 每個節點大於所有子孫
  A.off(); A.hl([1], GREEN);
  pal.mood('wow');
  say('每個節點都比它所有子孫大', '所以根 50 是最大值');
  await step(tok);                                   // 15:01 這叫 max heap
  tag('Max Heap', 'ptr alt', -3.4, 7.4, 0);
  pal.mood('happy');
  say('這樣排的 heap 叫 max heap', '根 = 最大值');
  await step(tok);                                   // 15:17 大於或等於：可重複
  A.off();
  note('≥：可以相等', -3.4, 1.0, 0);
  say('條件是「大於或等於」', '所以允許重複的值');
  await step(tok);                                   // 15:25 另一棵：10；30、20；…
  B = qTree([10, 30, 20, 35, 40, 32, 25], { arr: false, w: 6, x0: 3.4, sz: 0.75 });
  B.hl([2], GOLD); B.hl([4, 5], BLUE);
  pal.mood('calm');
  say('另一棵：35、40 比 30 大，也比 10 大', '32、25 比 20 大');
  await step(tok);                                   // 15:40 根最小 → min heap
  B.off(); B.hl([1], GREEN);
  tag('Min Heap', 'ptr', 3.4, 7.4, 0);
  say('每個節點 ≤ 所有子孫：根是最小值', '這叫 min heap');
  await step(tok);                                   // 16:05 之後用 max heap 講
  B.off(); A.hl([1], GOLD);
  pal.mood('happy'); await pal.hop(tok);
  say('之後都用 max heap 講', 'min heap 做法一樣，只是方向相反');
}]);

// 16:21 錯誤的 insert：塞進根（7 步）
FRAG.push(['heaphq-insert-wrong', '常見錯誤：把 60 直接塞到根', async (tok) => {
  fresh(QCAM, QLOOK);
  const pal = guide(-6.4, 2.2);
  let S, n60;
  await step(tok);                                   // 16:21 在 max heap 裡 insert
  S = qTree(HQ_MAX, { cap: 15, dx: 0.74 });
  say('在 max heap 裡 insert 一個新元素', 'A = 50, 30, 20, 15, 10, 8, 16');
  await step(tok);                                   // 16:32 樹和陣列是同一份資料
  S.hl([1, 2, 3, 4, 5, 6, 7], GOLD);
  await beat(tok, 700); S.off();
  say('上面是樹的畫法，下面是陣列', '中間沒有空格：complete');
  await step(tok);                                   // 16:54 要插入 60
  n60 = pkt('60', 4.6, 7.0, 0);
  pal.mood('wow');
  say('要插入 60', '');
  await step(tok);                                   // 17:07 60 最大，最後在根
  await travel(tok, n60, V3(4.6, 7.0, 0), V3(1.3, 7.0, 0), 800);
  say('60 比誰都大，最後一定在根', '根放最大值');
  await step(tok);                                   // 17:19 錯誤想法：塞進根，其他往下推
  S.mv(7, 15); await beat(tok, 350);
  S.mv(3, 7); await beat(tok, 350);
  S.mv(1, 3); await beat(tok, 350);
  kill(n60);
  const p1 = S.p(1); S.node(1, 60, 1.5); S.cell(1, 60, 1); S.hl([1], RED);
  say('錯誤想法：60 塞進根，其他一路往下推', '50 → 20 的位置 → 16 被擠到最底');
  await step(tok);                                   // 17:40 還是 complete 嗎？
  S.gaps([8, 9, 10, 11, 12, 13, 14]);
  pal.mood('sad');
  say('樹往右下長出一條：[8]～[14] 全空', '<span class="no">不是 complete binary tree</span>');
  await step(tok);                                   // 17:51 不要從根插入
  bad('✗ 不能從根插入', 4.6, 6.9, 0);
  say('所以不能從根插入', '接下來看正確做法');
}]);

// 18:06 正確的 insert（12 步）
FRAG.push(['heaphq-insert-60', 'insert 60：放最後一格，再往上比', async (tok) => {
  fresh(QCAM, QLOOK);
  const pal = guide(-6.4, 2.2);
  const S = qTree(HQ_MAX, { cap: 8 });
  const swaps = tag('交換 0 次', 'ptr', 4.8, 7.2, 0);
  let k = 0, dir;
  const swapOnce = async (i, p) => { await S.sw(tok, i, p, 750); k++; txt(swaps, '交換 ' + k + ' 次'); };
  await step(tok);                                   // 18:06 放在陣列下一個空位
  const n60 = pkt('60', 4.2, 1.4, S.c(8).z);
  await travel(tok, n60, V3(4.2, 1.4, S.c(8).z), V3(S.c(8).x, 0.95, S.c(8).z), 700);
  kill(n60); S.cell(8, 60, 1); S.size = 8;
  say('正確：60 放在陣列下一個空位 [8]', 'heap 原本到 [7] 為止');
  await step(tok);                                   // 18:18 在樹上是 15 的左孩子
  S.node(8, 60, 2);
  S.hl([4], BLUE); S.hl([8], GOLD);
  say('[8] 在樹上是誰的孩子？8 = 2·4', '→ 15 的左孩子');
  await step(tok);                                   // 18:44 違反 max heap
  S.off(); S.hl([8], RED);
  pal.mood('wow');
  say('還是 complete，但 60 是 15 的孩子', '<span class="no">違反 max heap：parent 要 ≥ 孩子</span>');
  await step(tok);                                   // 19:01 和 parent 比：60 > 15
  S.off(); S.hl([4], BLUE);
  await swapOnce(8, 4);
  say('和 parent 比：60 > 15，往上換', 'parent = ⌊8/2⌋ = 4');
  await step(tok);                                   // 19:10 60 > 30
  S.off(); S.hl([2], BLUE);
  await swapOnce(4, 2);
  say('再和 parent 比：60 > 30，再換', 'parent = ⌊4/2⌋ = 2');
  await step(tok);                                   // 19:12 60 > 50
  S.off(); S.hl([1], BLUE);
  await swapOnce(2, 1);
  say('60 > 50，換到根', 'parent = ⌊2/2⌋ = 1');
  await step(tok);                                   // 19:20 陣列裡的路徑 8 → 4 → 2 → 1
  S.off(); S.hl([1, 2, 4, 8], GOLD);
  const path = [8, 4, 2, 1].map((i) => note(String(i), S.c(i).x, 1.05, S.c(i).z));
  say('在陣列裡看：位置 8 → 4 → 2 → 1', '每次除以 2，就是 parent');
  await step(tok);                                   // 20:05 到根了
  path.forEach(kill); S.off(); S.hl([1], GREEN);
  pal.mood('happy'); await pal.hop(tok);
  say('60 是最大的，一路爬到根', 'A = 60, 50, 20, 30, 10, 8, 16, 15');
  await step(tok);                                   // 20:39 時間 = 交換次數
  S.off(); glow(S.nd[1], null);
  say('花多少時間？就看交換幾次：3 次', '');
  await step(tok);                                   // 20:50 取決於高度 log n
  S.lvTags(4);
  say('最多換到根：次數 ≤ 樹高 = log n', '<span class="ok">insert：O(log n)</span>');
  await step(tok);                                   // 21:12 若插入 6 就不用換
  const n6 = note('若插入的是 6：6 ≤ 15，0 次', S.p(8).x + 1.5, S.p(8).y - 0.9, 0);
  say('如果插入的是 6：比 parent 小，不用換', '最少 O(1)、最多 O(log n)');
  await step(tok);                                   // 21:51 方向：由葉子往根
  kill(n6);
  dir = arrow(V3(5.6, 1.9, 0), V3(5.6, 6.4, 0), 0x0f5a3a);
  tag('insert：向上調整', 'good', 5.6, 7.0, 0);
  say('insert：新元素先當葉子，再往根調整', '方向：向上（leaf → root）');
}]);

// 22:22 delete：只能刪根（14 步）
FRAG.push(['heaphq-delete-50', 'Delete：刪根、最後一個補上、往下調', async (tok) => {
  fresh(QCAM, QLOOK);
  const pal = guide(-6.4, 2.2);
  let S, apples = [];
  await step(tok);                                   // 22:22 7 個元素的 max heap
  S = qTree(HQ_MAX, { cap: 7, sizeTag: true });
  say('max heap，7 個元素', 'A = 50, 30, 20, 15, 10, 8, 16');
  await step(tok);                                   // 22:35 只能刪根
  S.hl([1], GOLD);
  say('只能刪根，不能刪其他元素', '不給選擇：一定刪 A[1]');
  await step(tok);                                   // 22:55 水果攤的蘋果堆
  [[0, 0], [-0.55, -0.9], [0.55, -0.9], [-1.1, -1.8], [0, -1.8], [1.1, -1.8]].forEach(([dx, dy], k) => apples.push(icon('🍎', k ? '' : '最好的', 5.4 + dx, 6.6 + dy, 0, 'sm')));
  pal.mood('happy');
  say('像水果攤堆成金字塔的蘋果', '最上面的那顆是最好的');
  await step(tok);                                   // 23:32 只拿最上面那顆
  await travel(tok, apples[0], V3(5.4, 6.6, 0), V3(6.4, 7.4, 0), 700);
  say('要拿就拿最上面那顆', 'max heap 的「最好」= 最大值 50');
  await step(tok);                                   // 24:00 50 刪掉
  apples.forEach(kill);
  fly(S.nd[1]); S.nd[1] = null; fly(S.cl[1], V3(0, 6, 5)); S.cl[1] = null; S.a[1] = null;
  pal.mood('wow');
  say('刪掉根 50', '根空出來了，誰來補？');
  await step(tok);                                   // 24:07 錯誤：30 上去、15 上去
  S.mv(2, 1); await beat(tok, 450);
  S.mv(4, 2); await beat(tok, 450);
  S.hl([1, 2], RED);
  say('常見錯誤：較大的 30 補上，15 再補上 30 的位置', '');
  await step(tok);                                   // 24:17 不是 complete
  const g = S.gaps([4]);
  pal.mood('sad');
  say('[4] 空掉了', '<span class="no">中間有空 → 不是 complete</span>');
  await step(tok);                                   // 24:25 正確：最後一個 16 補到根
  g.forEach(kill); S.off();
  S.mv(2, 4); S.mv(1, 2); await beat(tok, 500);
  S.mv(7, 1); S.setSize(6);
  pal.mood('calm');
  say('正確：陣列最後一個 16 補到根', '[7] 空出來，仍是 complete');
  await step(tok);                                   // 25:08 complete 但不是 max heap
  S.hl([1], RED);
  say('是 complete，但不是 max heap', '要調整：由根往葉子');
  await step(tok);                                   // 25:33 比較孩子 30、20，30 上來
  S.off(); S.hl([1], GOLD); S.hl([2, 3], BLUE);
  await beat(tok, 500);
  await S.sw(tok, 1, 2, 750);
  say('16 的孩子 30、20：較大的 30 上來', 'children = 2·1、2·1 + 1 = 2、3');
  await step(tok);                                   // 26:26 15、10 都比 16 小
  S.off(); S.hl([2], GOLD); S.hl([4, 5], BLUE);
  say('16 的孩子 15、10：較大的 15 也比 16 小', '不用換：停');
  await step(tok);                                   // 26:56 delete 的步驟
  S.off(); S.hl([1], GREEN);
  pal.mood('happy'); await pal.hop(tok);
  say('刪根 → 最後一個補上 → 往下調', 'A = 30, 16, 20, 15, 10, 8');
  await step(tok);                                   // 27:17 insert 向上、delete 向下
  S.off();
  arrow(V3(5.6, 6.4, 0), V3(5.6, 1.9, 0), 0x7a1010);
  tag('delete：向下調整', 'bad', 5.6, 7.0, 0);
  say('insert 往上調；delete 往下調', '都要調整，只是方向不同');
  await step(tok);                                   // 27:37 時間取決於高度
  say('最多從根走到葉子：樹高 log n', '<span class="ok">delete：O(log n)</span>');
}]);

// 27:56 刪掉的值放進空格（12 步）
FRAG.push(['heaphq-delete-store', '刪除的值放進空出來的格子 → 排好序', async (tok) => {
  fresh(QCAM, QLOOK);
  const pal = guide(-6.4, 2.2);
  let S, n50;
  await step(tok);                                   // 27:56 每刪一次都拿到最大
  S = qTree([30, 16, 20, 15, 10, 8], { cap: 7, sizeTag: true });
  n50 = pkt('50', 5.6, 6.6, 0);
  say('剛才刪掉的 50：當時最大的', '從 max heap 每刪一次，就拿到剩下最大的');
  await step(tok);                                   // 28:07 下一個是 30、再來 20
  S.hl([1], GOLD); S.hl([3], BLUE);
  say('再刪會拿到 30，接著是 20……', 'max heap：由大到小一個個出來');
  await step(tok);                                   // 28:46 heap size = 6
  S.off();
  pal.mood('wow');
  say('陣列大小是 7，但 heap 只剩 6 個', 'heap size = 6');
  await step(tok);                                   // 28:52 [7] 空著，不屬於 heap
  const nn = note('[7] 空著，不屬於 heap', S.c(7).x - 0.6, 1.2, S.c(7).z);
  say('[7] 已經不是 heap 的一部分', '空著也沒關係');
  await step(tok);                                   // 29:06 把 50 放進 [7]
  kill(nn);
  await travel(tok, n50, V3(5.6, 6.6, 0), V3(S.c(7).x, 0.9, S.c(7).z), 800);
  kill(n50); S.cell(7, 50); tint(S.cl[7], GRAY);
  pal.mood('happy');
  say('剛刪的 50 就放進空出來的 [7]', '它在 heap 外面，只是借放');
  await step(tok);                                   // 29:32 再刪：30 刪掉、8 補上
  pal.mood('calm');
  await S.popStart(tok, 'park', 700);
  S.hl([1], RED);
  say('從 6 個裡再刪：30 出去，最後的 8 補到根', 'heap size = 5');
  await step(tok);                                   // 29:41 20 上來、8 下去
  S.off(); S.hl([1], GOLD); S.hl([2, 3], BLUE);
  await beat(tok, 400);
  await S.sw(tok, 1, 3, 750);
  say('孩子 16、20：較大的 20 上來，8 下去', '');
  await step(tok);                                   // 29:48 8 在 [3] 沒有孩子
  S.off(); S.hl([3], GOLD);
  note('2·3 = 6 > 5：沒有孩子', S.p(3).x, S.p(3).y - 1.0, 0);
  say('8 在 [3]：2·3 = 6 > heap size 5，沒有孩子', '停（影片說和 10 換，其實不用）');
  await step(tok);                                   // 29:56 30 放進 [6]
  S.off(); S.store(6);
  say('30 放進下一個空位 [6]', 'A = 20, 16, 8, 15, 10 ｜ 30, 50');
  await step(tok);                                   // 30:08 一直刪下去
  for (let r = 0; r < 4; r++) { const n = S.size; await S.popStart(tok, 'keep', 180); await S.down(tok, 1, n - 1, 170); }
  say('一直刪：20、16、15、10 依序放到尾端', '每次都放進剛空出來的格子');
  await step(tok);                                   // 30:28 從左讀就排好
  for (let i = 1; i <= 7; i++) if (S.cl[i]) { tint(S.cl[i], SORTED); glow(S.cl[i], null); }
  pal.mood('wow');
  say('從左邊讀：由小到大排好了', 'A = 8, 10, 15, 16, 20, 30, 50');
  await step(tok);                                   // 30:37 這就是 heap sort 的想法
  pal.mood('happy'); await pal.hop(tok);
  say('這就是 heap sort 的想法', '建 heap，再一直刪、放到尾端');
}]);

// 31:08 heap sort 第一步：逐一 insert（14 步）
FRAG.push(['heaphq-sort-build', 'Heap Sort 第一步：10 20 15 30 40 逐一 insert', async (tok) => {
  fresh(QCAM, QLOOK);
  const pal = guide(-6.4, 2.2);
  const C = code(['① 建 heap：一個一個 insert', '② 全部 delete'], 4.4, 7.2, 0.5);
  let S;
  const add = (k) => { S.node(k, S.a[k], 2); S.setSize(k); S.off(); S.hl([k], GOLD); };
  await step(tok);                                   // 31:08 兩步驟
  C.hl(0);
  say('Heap sort 有兩步', '第一步：把元素一個一個 insert，建成 heap');
  await step(tok);                                   // 31:15 再全部 delete
  C.hl(1);
  say('第二步：把 heap 裡的元素一個一個刪掉', '刪完就排好了');
  await step(tok);                                   // 31:32 要排的陣列
  C.hl(0);
  S = qTree([10, 20, 15, 30, 40], { cap: 5, cellsOnly: true, sizeTag: true });
  say('要排序的陣列：10, 20, 15, 30, 40', '還沒排好');
  await step(tok);                                   // 32:00 第一個自己就是 heap
  add(1);
  say('第一個元素 10：自己就是 heap', '只有一個，算 max 也算 min');
  await step(tok);                                   // 32:14 insert 20
  add(2);
  say('insert 20：放在下一個空位 [2]', 'heap size = 2');
  await step(tok);                                   // 32:37 20 > 10，往上換
  S.hl([1], BLUE); await S.sw(tok, 2, 1, 750); S.off();
  say('和 parent 比：20 > 10，往上換', 'parent = ⌊2/2⌋ = 1');
  await step(tok);                                   // 33:09 insert 15
  add(3);
  say('insert 15：放在 [3]', 'heap size = 3');
  await step(tok);                                   // 33:30 15 < 20 不用動
  S.hl([1], BLUE);
  say('parent = ⌊3/2⌋ = 1：15 < 20', '不用動');
  await step(tok);                                   // 33:41 insert 30
  add(4);
  say('insert 30：放在 [4]', 'heap size = 4');
  await step(tok);                                   // 34:01 30 > 10、30 > 20
  await S.up(tok, 4, 650);
  pal.mood('wow');
  say('30 > 10、再 > 20：一路換到根', '4 → 2 → 1');
  await step(tok);                                   // 34:30 insert 40
  pal.mood('calm');
  add(5);
  say('最後 insert 40：放在 [5]', 'heap size = 5');
  await step(tok);                                   // 34:52 40 > 20、40 > 30
  await S.up(tok, 5, 650);
  say('40 > 20、再 > 30：換到根', '5 → 2 → 1');
  await step(tok);                                   // 35:20 max heap 完成
  S.hl([1], GREEN);
  pal.mood('happy'); await pal.hop(tok);
  say('max heap 建好了', 'A = 40, 30, 15, 10, 20');
  await step(tok);                                   // 35:39 n log n
  S.off();
  say('n 個元素，每個最多爬 log n', '建 heap：<span class="ok">O(n log n)</span>');
}]);

// 36:23 heap sort 第二步：全部 delete（16 步）
FRAG.push(['heaphq-sort-delete', 'Heap Sort 第二步：一直 delete，放到空出的位置', async (tok) => {
  fresh(QCAM, QLOOK);
  const pal = guide(-6.4, 2.2);
  let S;
  const done = () => { for (let i = 1; i <= 5; i++) if (S.cl[i] && i > S.size) tint(S.cl[i], SORTED); };
  await step(tok);                                   // 36:23 從剛建好的 heap
  S = qTree([40, 30, 15, 10, 20], { cap: 5, sizeTag: true });
  say('第二步：從剛建好的 max heap 開始刪', 'A = 40, 30, 15, 10, 20');
  await step(tok);                                   // 36:32 刪 40、20 補到根
  await S.popStart(tok, 'park', 700); S.hl([1], RED);
  say('刪 40：最後的 20 補到根', 'heap size = 4');
  await step(tok);                                   // 36:57 30 較大，換上去
  S.off(); S.hl([1], GOLD); S.hl([2, 3], BLUE); await beat(tok, 400);
  await S.sw(tok, 1, 2, 750);
  say('往下調：孩子 30、15，較大的 30 上來', '');
  await step(tok);                                   // 37:15 和 10 比：不用換
  S.off(); S.hl([2], GOLD); S.hl([4], BLUE);
  say('20 再和孩子 10 比：20 較大', '不用換：又是 max heap');
  await step(tok);                                   // 37:35 40 放到空格
  S.off(); S.store(5); done();
  say('40 放進空出來的最後一格 [5]', 'heap：30, 20, 15, 10');
  await step(tok);                                   // 37:47 刪 30、10 補到根
  await S.popStart(tok, 'park', 700); S.hl([1], RED);
  say('刪 30：最後的 10 補到根', 'heap size = 3');
  await step(tok);                                   // 38:03 20 上來
  S.off(); S.hl([1], GOLD); S.hl([2, 3], BLUE); await beat(tok, 400);
  await S.sw(tok, 1, 2, 750); S.off();
  say('孩子 20、15：20 較大，20 上來', '10 下去');
  await step(tok);                                   // 38:26 30 放進 [4]
  S.store(4); done();
  say('30 放進空出來的 [4]', 'heap：20, 10, 15');
  await step(tok);                                   // 38:46 刪 20、15 補上
  await S.popStart(tok, 'park', 700); S.hl([1], RED);
  say('刪 20：最後的 15 補到根', 'heap size = 2');
  await step(tok);                                   // 39:04 15 已最大
  S.off(); S.hl([1], GOLD); S.hl([2], BLUE);
  say('15 和孩子 10 比：15 較大', '不用換');
  await step(tok);                                   // 39:25 20 放進 [3]
  S.off(); S.store(3); done();
  say('20 放進 [3]', '已經有 40、30、20 在後面');
  await step(tok);                                   // 39:44 刪 15、10 補上
  await S.popStart(tok, 'park', 700);
  say('刪 15：10 補到根', '只剩一個：不用調');
  await step(tok);                                   // 40:04 15 放進 [2]，排好了
  S.store(2); S.setSize(1); tint(S.cl[1], SORTED); done();
  pal.mood('happy'); await pal.hop(tok);
  say('15 放進 [2]：排好了！', 'A = 10, 15, 20, 30, 40');
  await step(tok);                                   // 40:53 建 heap n log n
  bubble('建 heap：n log n', 4.6, 7.0, 0);
  say('分析：建 heap 是 n log n', 'n 次 insert，每次 log n');
  await step(tok);                                   // 41:03 刪除 n log n
  bubble('全部刪除：n log n', 4.6, 6.3, 0);
  say('刪除也是：n 次，每次 log n', 'n log n');
  await step(tok);                                   // 41:12 總共 2n log n
  good('2n log n = O(n log n)', 4.6, 5.6, 0);
  say('加起來 2n log n', 'heap sort：<span class="ok">O(n log n)</span>');
}]);

// 41:43 heapify（16 步）
FRAG.push(['heaphq-heapify', 'Heapify：由右往左掃，往下調整', async (tok) => {
  fresh(QCAM, QLOOK);
  const pal = guide(-6.4, 2.2);
  let S, hint, ar;
  const sc = (i) => S.c(i);
  await step(tok);                                   // 41:43 heapify 也是建 heap
  hint = bubble('Heapify：另一種建 heap 的方法', 0, 7.2, 0);
  say('Heapify：也是建 heap 的方法', '和剛才哪裡不同？');
  await step(tok);                                   // 41:50 剛才：葉子往根
  ar = arrow(V3(5.6, 1.9, 0), V3(5.6, 6.4, 0), 0x0f5a3a);
  const up = tag('剛才：insert 往上調', 'good', 5.6, 7.0, 0);
  say('剛才建 heap：每次插在葉子，往根調整', '方向：向上');
  await step(tok);                                   // 42:34 這個陣列
  kill(hint); kill(ar); kill(up);
  S = qTree([10, 20, 15, 12, 40, 25, 18], { cap: 7 });
  pal.mood('wow');
  say('這個陣列：是 complete，但不是 max heap', 'A = 10, 20, 15, 12, 40, 25, 18');
  await step(tok);                                   // 42:50 剛才是由左往右 insert
  pal.mood('calm');
  ar = arrow(V3(sc(1).x, 1.2, sc(1).z), V3(sc(7).x, 1.2, sc(7).z), 0x5c4a33);
  say('剛才的做法：由左往右，一個一個 insert', '');
  await step(tok);                                   // 43:16 改成由右往左
  kill(ar);
  ar = arrow(V3(sc(7).x, 1.2, sc(7).z), V3(sc(1).x, 1.2, sc(1).z), 0xa8730f);
  say('換個方向：由右往左掃', '');
  await step(tok);                                   // 43:25 往下調（像 delete）
  const dn = tag('每個元素往下調（像 delete）', 'bad', 0, 7.2, 0);
  say('每個元素往「下」調整', '用的是 delete 時的方法');
  await step(tok);                                   // 43:40 18：沒有孩子
  kill(ar); kill(dn);
  S.hl([7], GREEN);
  say('從最後一個 18 開始：往下看，沒有孩子', '自己就是 heap');
  await step(tok);                                   // 43:55 25、40：也是
  S.hl([6, 5], GREEN);
  say('25、40：也沒有孩子', '都是 heap');
  await step(tok);                                   // 44:09 12
  S.hl([4], GREEN);
  say('12：沒有孩子', '葉子都不用動');
  await step(tok);                                   // 44:17 15：25 較大，25 上去
  S.off(); S.hl([3], GOLD); S.hl([6, 7], BLUE); await beat(tok, 400);
  await S.sw(tok, 3, 6, 750); S.off();
  say('15：孩子 25、18，較大的 25 上去，15 下來', '這一小塊 25, 15, 18 是 heap');
  await step(tok);                                   // 44:53 20：40 較大
  S.hl([2], GOLD); S.hl([4, 5], BLUE); await beat(tok, 400);
  await S.sw(tok, 2, 5, 750); S.off();
  say('20：孩子 12、40，較大的 40 上去', '20 下來');
  await step(tok);                                   // 45:18 10：和 40 換
  S.hl([1], GOLD); S.hl([2, 3], BLUE); await beat(tok, 400);
  await S.sw(tok, 1, 2, 750); S.off();
  say('最後是 10：孩子 40、25，40 上去', '10 到了 [2]');
  await step(tok);                                   // 45:29 再和 20 換
  S.hl([2], GOLD); S.hl([4, 5], BLUE); await beat(tok, 400);
  await S.sw(tok, 2, 5, 750); S.off();
  say('10 再看孩子 12、20：20 上去', '10 到了 [5]');
  await step(tok);                                   // 45:44 完成
  S.hl([1], GREEN);
  pal.mood('happy'); await pal.hop(tok);
  say('完成：由右往左、每個往下調', 'A = 40, 20, 25, 12, 10, 15, 18');
  await step(tok);                                   // 46:11 heapify O(n)
  S.off();
  good('heapify：O(n)', 4.6, 7.0, 0);
  say('heapify 的時間：O(n)', '');
  await step(tok);                                   // 46:28 比 n log n 快
  bubble('逐一 insert：O(n log n)', 4.6, 6.3, 0);
  say('逐一 insert 建 heap 要 O(n log n)', 'heapify 比較快');
}]);

// 47:02 priority queue（8 步）
const HQ_PQ = [8, 6, 3, 10, 9];
const pqX = (i) => (i - 2) * 1.9;
FRAG.push(['heaphq-pq-priority', 'Priority Queue：數字本身就是 priority', async (tok) => {
  fresh([0, 6, 12], [0, 0.8, 0]);
  let bs = [], tags = [];
  await step(tok);                                   // 47:02 queue 是 FIFO
  bs = HQ_PQ.map((v, i) => buddy('', v, colorFor(v), pqX(i), 0, 0, 0.9));
  const door = tag('出口 →', 'ptr', 5.6, 0.6, 0);
  say('一般 queue：先來先出（FIFO）', '排隊：排在最前面的先出去');
  await step(tok);                                   // 47:07 priority queue 不是
  kill(door);
  bs.forEach((b) => b.mood('wow'));
  say('priority queue 不照先來後到', '依 priority 插入、刪除');
  await step(tok);                                   // 47:19 刪 priority 最高的
  bs.forEach((b) => b.mood('calm'));
  say('刪除時，一定拿 priority 最高的', '');
  await step(tok);                                   // 47:36 數字本身就是 priority
  tags = HQ_PQ.map((v, i) => tag('priority ' + v, 'idx', pqX(i), 1.6, 0));
  say('這裡：數字本身就是 priority', '8 的 priority 是 8，3 的是 3');
  await step(tok);                                   // 47:47 和 OS 的不同
  const os = note('（和作業系統的 priority queue 不同）', 0, 3.0, 0);
  say('作業系統也有 priority queue，但概念不同', '這裡的用在演算法');
  await step(tok);                                   // 48:09 小的優先
  kill(os); tags.forEach(kill); tags = [];
  const ord = [...HQ_PQ.keys()].sort((a, b) => HQ_PQ[a] - HQ_PQ[b]);
  ord.slice(0, 3).forEach((i, k) => tags.push(tag('#' + (k + 1), 'pkt', pqX(i), 1.9, 0)));
  bs[ord[0]].mood('happy'); await bs[ord[0]].hop(tok);
  say('規則一：數字越小，priority 越高', '先刪 3，再 6，再 8');
  await step(tok);                                   // 48:28 大的優先
  tags.forEach(kill); tags = []; bs[ord[0]].mood('calm');
  ord.slice(2).reverse().forEach((i, k) => tags.push(tag('#' + (k + 1), 'pkt', pqX(i), 1.9, 0)));
  bs[ord[4]].mood('happy'); await bs[ord[4]].hop(tok);
  say('規則二：數字越大，priority 越高', '先刪 10，再 9，再 8');
  await step(tok);                                   // 48:42 兩種都可以
  tags.forEach(kill);
  bubble('小的優先 或 大的優先：先說好', 0, 3.0, 0);
  say('兩種給 priority 的方法', '小的優先、或大的優先');
}]);

// 48:56 用陣列 vs heap（8 步）
FRAG.push(['heaphq-pq-array-vs-heap', 'Priority Queue：用陣列 vs 用 Heap', async (tok) => {
  fresh([0, 6, 12], [0, 0.8, 0]);
  const xs = (i) => (i - 2.5) * 1.7;
  let bs, nx, S;
  await step(tok);                                   // 48:56 陣列 insert 放尾端
  bs = HQ_PQ.map((v, i) => cube(v, colorFor(v), [1.2, 0.9, 1.2], xs(i), 0.45, 0));
  nx = cube(7, colorFor(7), [1.2, 0.9, 1.2], xs(5), 0.45, 0, 4);
  say('用一般陣列：insert 直接放尾端', '<span class="ok">很快</span>');
  await step(tok);                                   // 49:01 要刪 3
  glow(bs[2], RED);
  say('delete（小的優先）：要拿 3', '先找到它');
  await step(tok);                                   // 49:11 後面都要往前移
  fly(bs[2]);
  [bs[3], bs[4], nx].forEach((b, k) => move(b, xs(2 + k), 0.45, 0));
  await beat(tok, 600);
  say('刪掉 3 之後，後面全部往前移', '<span class="no">O(n)</span>');
  await step(tok);                                   // 49:29 保持排序也一樣
  bad('保持排序？insert 就要 O(n)', 0, 2.6, 0);
  say('改成一直保持排序？換 insert 要 O(n)', '總有一個操作是 O(n)');
  await step(tok);                                   // 49:41 用 heap：log n
  fresh([0, 6, 15.5], [0, 3.3, 1]);
  S = qTree([3, 6, 8, 10, 9], { cap: 6, min: true, sizeTag: true });
  say('更好的方法：heap', 'insert、delete 都是 <span class="ok">O(log n)</span>');
  await step(tok);                                   // 49:52 小的優先用 min heap
  tag('Min Heap', 'ptr', 0, 7.2, 0);
  S.hl([1], GREEN);
  say('小的優先 → min heap；大的優先 → max heap', '同一組數字建成 min heap');
  await step(tok);                                   // 50:07 insert／delete 都 log n
  S.off();
  await S.pop(tok, 'fly', 450);
  say('刪 3：只沿一條路往下調', 'insert 也只走一條路：O(log n)');
  await step(tok);                                   // 50:30 heap 最適合
  S.hl([1], GREEN);
  good('heap：實作 priority queue 最好的資料結構', 0, 7.2, 1.2);
  say('陣列總有一個操作 O(n)；heap 兩個都 log n', '最適合實作 priority queue');
}]);
  }

  // ═══ sortbari.js ═══
  {
const { V3, fresh, tag, cube, move, kill, glow, tint, txt, code, ghostBox, travel, remove, buddy, anim, step, GOLD, GREEN, GRAY } = K;
// ─── mB5HXBb_HY8：Abdul Bari〈Merge Sort〉、7h1s2SojIRw：Abdul Bari〈Quick Sort〉 ───
// Cued scenes: every `await step(tok)` waits for the sentence it shows; beats are motion only.
// Merge sort 的例子：索引 1..8 = 9 3 7 5 6 4 8 2（mid = ⌊(l+h)/2⌋，7 次 merge 依 post-order 編號）。
// Quick sort 的例子：10 16 8 12 15 6 3 9 5，尾端放 ∞；pivot = A[l]，i 找 > pivot、j 找 ≤ pivot，
// 交錯後 A[l] ↔ A[j]（第一次 partition → 6 5 8 9 3 10 15 12 16），之後 QuickSort(l, j)、QuickSort(j+1, h)。
// 左下角的小幫手跟著反應：切開時好奇、合併好了開心。
const SB_M = [9, 3, 7, 5, 6, 4, 8, 2];
const SB_Q = [10, 16, 8, 12, 15, 6, 3, 9, 5, Infinity];
const sbS = (v) => (v === Infinity ? '∞' : String(v));
const bubble = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const pkt = (t, x, y, z = 0) => tag(t, 'pkt', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const guide = (x = -6.2, z = 1.6, s = 0.7) => buddy('', '', '#ffc56b', x, 0, z, s);
// merge-sort tree (upright, z = 0): a node of size g sits at height SB_Y[g]; groups are separated by a gap
const SB_Y = { 1: 1.4, 2: 3.0, 4: 4.6, 8: 6.2 }, SB_GAP = { 1: 0.5, 2: 0.7, 4: 0.9, 8: 0 };
const sbX = (k, g) => (k - 3.5) * 0.62 + (Math.floor(k / g) - (8 / g - 1) / 2) * SB_GAP[g];
function sbCube(v, k, g, drop = 0) { const m = cube(v, colorFor(v), [0.52, 0.52, 0.52], sbX(k, g), SB_Y[g], 0, drop); m.userData.v = v; return m; }
// merge two sorted runs of meshes into slots lo.. of size-g level (ties take the left run → stable)
async function sbMerge(tok, A, B, lo, g, ms) {
  const out = []; let i = 0, j = 0;
  while (i < A.length || j < B.length) {
    let m;
    if (i < A.length && j < B.length) {
      glow(A[i], GOLD); glow(B[j], GOLD); await beat(tok, ms * 0.3);
      glow(A[i], null); glow(B[j], null);
      m = A[i].userData.v <= B[j].userData.v ? A[i++] : B[j++];
    } else m = i < A.length ? A[i++] : B[j++];
    move(m, sbX(lo + out.length, g), SB_Y[g], 0); out.push(m);
    await beat(tok, ms * 0.3);
  }
  return out;
}
// the top-down recursion on [0..7] as a list of events:
//   L = make the left half, R = make the right half, leaf = one element, M = merge
function sbEvents() {
  const E = [];
  (function rec(l, h) {
    if (l === h) { E.push({ t: 'leaf', l, h }); return; }
    const m = (l + h) >> 1;
    E.push({ t: 'L', l, m, h }); rec(l, m);
    E.push({ t: 'R', l, m, h }); rec(m + 1, h);
    E.push({ t: 'M', l, m, h });
  })(0, 7);
  return E;
}
// a merge-sort trace that the scene advances one event (or a few) per sentence
function sbTracer(mode) {
  const idx = mode === 'idx', vals = SB_M.slice(), E = sbEvents();
  const nodes = {}, res = {}; let e = 0, merges = 0;
  const rng = (l, h, g) => { if (idx) tag('(' + (l + 1) + ',' + (h + 1) + ')', 'idx', (sbX(l, g) + sbX(h, g)) / 2, SB_Y[g] - 0.55, 0); };
  const make = (l, h, g) => { const a = []; for (let k = l; k <= h; k++) a.push(sbCube(vals[k], k, g, 0.8)); nodes[l + ',' + h] = a; rng(l, h, g); return a; };
  const T = {
    root() { nodes['0,7'] = vals.map((v, k) => sbCube(v, k, 8, 1.2)); rng(0, 7, 8); },
    // play events until event index `upto` (exclusive)
    async to(tok, upto, ms = 500) {
      while (e < upto) {
        const ev = E[e++], g = ev.h - ev.l + 1;
        if (ev.t === 'L') {
          (nodes[ev.l + ',' + ev.h] || []).forEach((n) => tint(n, GRAY));
          make(ev.l, ev.m, g / 2);
          say(idx ? 'MergeSort(' + (ev.l + 1) + ', ' + (ev.m + 1) + ')：先做左半' : '左半：' + vals.slice(ev.l, ev.m + 1).join(' '),
            idx ? 'mid = (' + (ev.l + 1) + ' + ' + (ev.h + 1) + ') / 2 = ' + (ev.m + 1) : '右半等一下再做');
          await beat(tok, ms * 0.6);
        } else if (ev.t === 'R') {
          make(ev.m + 1, ev.h, g / 2);
          say(idx ? 'MergeSort(' + (ev.m + 2) + ', ' + (ev.h + 1) + ')：換右半' : '右半：' + vals.slice(ev.m + 1, ev.h + 1).join(' '), '左半已經排好了');
          await beat(tok, ms * 0.6);
        } else if (ev.t === 'leaf') {
          const n = nodes[ev.l + ',' + ev.l][0]; glow(n, GREEN); res[ev.l + ',' + ev.l] = [n];
          say(idx ? '(' + (ev.l + 1) + ',' + (ev.l + 1) + ')：l = h，只有一個元素' : vals[ev.l] + '：只剩一個元素', '一個元素本身就是排好的');
          await beat(tok, ms * 0.4); glow(n, null);
        } else {
          merges++;
          (nodes[ev.l + ',' + ev.h] || []).forEach(kill);
          const Ls = res[ev.l + ',' + ev.m], Rs = res[(ev.m + 1) + ',' + ev.h];
          const sorted = Ls.concat(Rs).map((x) => x.userData.v).sort((a, b) => a - b);
          say('第 ' + merges + ' 次 merge → ' + sorted.join(' '), idx ? 'Merge(' + (ev.l + 1) + ', ' + (ev.m + 1) + ', ' + (ev.h + 1) + ')' : '左、右都排好了，才合併');
          res[ev.l + ',' + ev.h] = await sbMerge(tok, Ls, Rs, ev.l, g, ms);
          tag('#' + merges, 'ptr alt', (sbX(ev.l, g) + sbX(ev.h, g)) / 2, SB_Y[g] + 0.55, 0);
          await beat(tok, ms * 0.3);
        }
      }
    },
    final: () => res['0,7'] || [],
  };
  return T;
}

// ── Merge Sort ──
// 0:00 divide and conquer：大問題拆開，一個元素就是「小問題」
FRAG.push(['sortbari-merge-dc', 'Divide and Conquer：拆到只剩一個元素', async (tok) => {
  fresh([0, 4, 13], [0, 3.4, 0]);
  const gd = guide();
  await step(tok);                                   // 0:00 we have seen merging (two-way, m-way)
  const a = note('3 9', -2.4, 5.6, 0), b = note('5 7', 2.4, 5.6, 0);
  say('上一集：merging', '兩個排好的串列合併成一個');
  await Promise.all([travel(tok, a, V3(-2.4, 5.6, 0), V3(-0.5, 5.6, 0), 900), travel(tok, b, V3(2.4, 5.6, 0), V3(0.5, 5.6, 0), 900)]);
  remove(a); remove(b); note('3 5 7 9', 0, 5.6, 0);
  await step(tok);                                   // 0:20 merge sort: recursive, divide and conquer
  bubble('Merge sort：recursive、divide and conquer', 0, 4.6, 0);
  gd.mood('wow');
  say('Merge sort：遞迴 + divide and conquer');
  await step(tok);                                   // 0:30 large → subproblems, small → solve, combine
  bubble('問題大 → 拆成子問題', -3.6, 3.6, 0); await beat(tok, 300);
  bubble('問題小 → 直接解', 0, 3.6, 0); await beat(tok, 300);
  bubble('把小解合併成大解', 3.6, 3.6, 0);
  say('divide and conquer 三步', '拆開 → 解小的 → 合併');
  await step(tok);                                   // 0:47 the problem is to sort these elements
  const ms = SB_M.map((v, k) => sbCube(v, k, 8, 1.2));
  gd.mood('calm'); gd.look(1);
  say('問題：把這 8 個元素排好', '8 個元素 → 大問題');
  await step(tok);                                   // 0:55 small = a single element
  glow(ms[0], GOLD);
  const n1 = note('只有 1 個 → 不用排', sbX(0, 8), 7.0, 0);
  say('什麼叫「小問題」？', '只有一個元素：不用排序');
  await step(tok);                                   // 1:07 even two elements is a large problem → split
  glow(ms[0], null); remove(n1);
  for (const g of [4, 2, 1]) { ms.forEach((m, k) => move(m, sbX(k, g), SB_Y[g], 0)); await beat(tok, 700); }
  say('兩個元素也算大問題 → 再拆', '一直拆到每段只剩一個元素');
  await step(tok);                                   // 1:17 single element = small problem
  ms.forEach((m) => glow(m, GREEN));
  gd.mood('happy'); await gd.hop(tok);
  say('一個元素 = 小問題，本身就排好了', '<span class="ok">接下來只要合併</span>');
}]);

// 1:25 演算法 MergeSort(l, h)
FRAG.push(['sortbari-merge-code', 'MergeSort(l, h) 演算法', async (tok) => {
  fresh([0, 4, 13], [0, 3.4, 0]);
  const gd = guide();
  const X = (k) => 0.9 + k * 0.72;
  await step(tok);                                   // 1:25 let me write the algorithm
  const C = code(['Algorithm MergeSort(l, h)', '{', '  if (l < h)', '  {', '    mid = (l + h) / 2;', '    MergeSort(l, mid);', '    MergeSort(mid + 1, h);', '    Merge(l, mid, h);', '  }', '}'], -3.4, 6.0, 0.5);
  const row = SB_M.map((v, k) => cube(v, colorFor(v), [0.55, 0.55, 0.55], X(k), 3.0, 0, 1.2));
  SB_M.forEach((v, k) => tag(String(k + 1), 'idx', X(k), 2.4, 0));
  C.hl(0);
  say('先寫出演算法，再來追蹤');
  await step(tok);                                   // 1:46 two parameters: low and high
  const lt = tag('l', 'ptr', X(0), 3.8, 0), ht = tag('h', 'ptr', X(7), 3.8, 0);
  say('參數：串列的開頭 l、結尾 h', 'l = low　h = high');
  await step(tok);                                   // 2:09 if (l < h): at least two elements
  C.hl(2); gd.mood('wow');
  say('l < h：至少兩個元素 → 大問題', 'l = h 表示只有一個元素，不用做');
  await step(tok);                                   // 2:21 mid = (l + h) / 2 = 4
  C.hl(4); gd.mood('calm');
  const md = tag('mid', 'ptr alt', X(3), 4.4, 0); glow(row[3], GOLD);
  say('mid = (1 + 8) / 2 = 9 / 2 = 4', '整數除法，小數捨去');
  await step(tok);                                   // 2:49 merge sort the left half recursively
  C.hl(5);
  const z = ghostBox('#4b9ee2', 4 * 0.72, 0.9, 0.9); z.position.set((X(0) + X(3)) / 2, 3.0, 0);
  say('左半 1～4：遞迴做 merge sort', 'MergeSort(l, mid) = MergeSort(1, 4)');
  await step(tok);                                   // 3:07 and from mid + 1 to high
  C.hl(6);
  const z2 = ghostBox('#dd8238', 4 * 0.72, 0.9, 0.9); z2.position.set((X(4) + X(7)) / 2, 3.0, 0);
  say('右半 5～8：遞迴做 merge sort', 'MergeSort(mid + 1, h) = MergeSort(5, 8)');
  await step(tok);                                   // 3:26 when both are sorted, merge them
  C.hl(7); glow(row[3], null);
  gd.mood('happy'); await gd.hop(tok);
  say('兩半都排好 → 合併', 'Merge(l, mid, h) = Merge(1, 4, 8)');
  await step(tok);                                   // 3:52 a single array is broken into two lists
  C.hl(-1); kill(lt); kill(ht); kill(md);
  bubble('串列 1：[l..mid]', (X(0) + X(3)) / 2, 4.2, 0); bubble('串列 2：[mid+1..h]', (X(4) + X(7)) / 2, 4.2, 0);
  say('一個陣列裡放著兩個串列', '[l..mid] 與 [mid+1..h]');
  await step(tok);                                   // 4:07 a single array can have many lists
  for (let k = 0; k < 8; k += 2) { const q = ghostBox('#9b7ef4', 2 * 0.72 - 0.08, 1.0, 1.0); q.position.set((X(k) + X(k + 1)) / 2, 3.0, 0); }
  say('一個陣列也可以放很多個串列', '只要記住每段的開頭與結尾');
}]);

// 4:19 追蹤（索引版）：7 次 merge
FRAG.push(['sortbari-merge-trace-idx', '追蹤 MergeSort(1, 8)：遞迴樹與 7 次 merge', async (tok) => {
  fresh([0, 4, 13], [0, 3.4, 0]);
  const gd = guide(), T = sbTracer('idx');
  await step(tok);                                   // 4:19 initially low = 1, high = 8
  T.root();
  say('MergeSort(1, 8)：9 3 7 5 6 4 8 2', 'low = 1、high = 8');
  const plan = [[1, 'wow'], [2], [6, 'wow'], [7, 'happy'], [12], [13, 'happy'], [14], [16, 'wow'], [20], [21, 'happy'], [26], [27], [28], [29, 'happy']];
  for (const [upto, mood] of plan) {
    await step(tok);                                 // 4:30 (1,4) · 5:13 (1,2) · 5:28 (1,1)(2,2) · 6:25 #1 · 6:40 (3,3)(4,4) · 6:57 #2 · 7:14 #3 · 7:41 (5,8)(5,6) · 7:57 (5,5)(6,6) · 8:04 #4 · 8:10 (7,7)(8,8) · 8:24 #5 · 8:33 #6 · 8:42 #7
    if (mood) gd.mood(mood);
    await T.to(tok, upto);
  }
  await step(tok);                                   // 9:00 split until one element, then merge
  T.final().forEach((m) => glow(m, GREEN));
  gd.mood('happy'); await gd.hop(tok);
  say('一路切到一個元素，再一路 merge 回來', '<span class="ok">2 3 4 5 6 7 8 9</span>　共 7 次 merge');
}]);

// 9:25 和 two-way merge sort 比較
FRAG.push(['sortbari-merge-twoway', 'Two-way merge sort vs merge sort', async (tok) => {
  fresh([0, 4, 13], [0, 3.4, 0]);
  const gd = guide();
  let cur = SB_M.map((v, k) => sbCube(v, k, 1, 1.0));
  await step(tok);                                   // 9:25 two-way: first two, next two, next two…
  tag('two-way（迭代）', 'ptr', -5.6, 6.6, 0);
  for (const g of [2, 4, 8]) {
    const next = [];
    for (let lo = 0; lo < 8; lo += g) next.push(...await sbMerge(tok, cur.slice(lo, lo + g / 2), cur.slice(lo + g / 2, lo + g), lo, g, 180));
    cur = next;
  }
  say('two-way merge sort：一輪一輪合併', '前兩個、下兩個、再下兩個……');
  await step(tok);                                   // 9:31 merge sort: divide and divide, then merge
  bubble('merge sort：遞迴，先切到 1 個再合併', 1.0, 7.2, 0);
  gd.mood('wow');
  say('merge sort：divide and conquer、遞迴', '一直切到一個元素才開始合併');
  await step(tok);                                   // 9:46 only the pattern changes, result is sorted
  cur.forEach((m) => glow(m, GREEN));
  gd.mood('happy');
  say('不同的只有切法（pattern）', '<span class="ok">結果一樣是排好的</span>');
  await step(tok);                                   // 9:54 also merging two lists at a time
  good('一次合併兩個串列 → 也是 two-way', 0, 0.4, 0);
  say('一樣一次合併兩個串列', '因為是遞迴版，另外叫它 merge sort');
}]);

// 10:06 時間：每層 n 個、共 log n 層
FRAG.push(['sortbari-merge-levels', 'Merge sort 的時間：n × log n', async (tok) => {
  fresh([0, 4, 13], [0, 3.4, 0]);
  const gd = guide();
  const rows = { 1: SB_M, 2: [3, 9, 5, 7, 4, 6, 2, 8], 4: [3, 5, 7, 9, 2, 4, 6, 8], 8: [2, 3, 4, 5, 6, 7, 8, 9] };
  await step(tok);                                   // 10:06 from the recursion tree
  rows[1].forEach((v, k) => sbCube(v, k, 1, 0.8));
  say('從追蹤畫出的遞迴樹看時間', '最下面：一個一個的元素');
  let lv = 0;
  for (const g of [2, 4, 8]) {
    await step(tok);                                 // 10:24 two, two… eight merged · 10:41 again eight · 10:46 again eight: n each time
    lv++;
    rows[g].forEach((v, k) => sbCube(v, k, g, 1.0));
    tag('8 個 = n', 'ptr alt', 5.6, SB_Y[g], 0);
    say(lv === 1 ? '這一層：2 個、2 個……共 8 個被 merge' : '這一層又 merge 了 8 個', '每一層 merge 的總量 = n');
  }
  await step(tok);                                   // 10:53 total levels: one, two, three
  for (const g of [2, 4, 8]) { tag('第 ' + Math.log2(g) + ' 層', 'idx', -5.6, SB_Y[g], 0); await beat(tok, 300); }
  say('數一數：一共 3 層');
  await step(tok);                                   // 11:00 three = log 8 (1, 2, 4, 8)
  bubble('1 → 2 → 4 → 8：每層加倍', 0, 7.4, 0);
  gd.mood('wow');
  say('8 個元素 → 3 層 = log₂ 8', '每層的串列長度加倍');
  await step(tok);                                   // 11:23 not passes: recursive, left first
  note('不是一輪一輪的 pass：先做完左邊再做右邊', 0, 0.5, 1.2);
  say('嚴格說不是 pass（遞迴先左後右）', '但層數一樣是 log n');
  await step(tok);                                   // 11:41 n, log n times
  say('每層 n，共 log n 層', 'n × log n');
  gd.mood('calm');
  await step(tok);                                   // 11:48 Θ(n log n)
  good('Θ(n log n)', 5.6, 7.2, 0);
  gd.mood('happy'); await gd.hop(tok);
  say('Merge sort 的時間', '<span class="ok">Θ(n log n)</span>');
}]);

// 11:59 追蹤（數字版）：merge 在 post-order
FRAG.push(['sortbari-merge-trace-num', '用數字追蹤：merge 發生在 post-order', async (tok) => {
  fresh([0, 4, 13], [0, 3.4, 0]);
  const gd = guide(), T = sbTracer('num');
  await step(tok);                                   // 11:59 taking these numbers: low 1, high 8
  T.root();
  say('用數字再追一次：low 1、high 8', '9 3 7 5 6 4 8 2');
  const plan = [[1, 'wow'], [2], [6], [7, 'happy'], [12], [13], [14, 'happy'], [15], [16], [20], [21, 'happy'], [22], [26], [27, 'happy'], [28], [29, 'happy']];
  for (const [upto, mood] of plan) {
    await step(tok);                                 // 12:18 9 3 7 5 · 12:48 9 3 · 13:04 9 | 3 · 13:22 3 9 · 13:36 7 | 5 · 13:46 5 7 · 13:59 3 5 7 9 · 14:20 6 4 8 2 · 14:37 6 4 · 14:50 6 | 4 · 15:11 4 6 · 15:29 8 2 · 15:38 8 | 2 · 15:51 2 8 · 16:09 2 4 6 8 · 16:19 2…9
    if (mood) gd.mood(mood);
    await T.to(tok, upto);
  }
  await step(tok);                                   // 16:52 calls itself twice → like a binary tree
  T.final().forEach((m) => glow(m, GREEN));
  bubble('每次呼叫自己兩次 → 追蹤樹像 binary tree', 0, 7.4, 0);
  gd.mood('wow');
  say('呼叫自己兩次 → 追蹤樹是 binary tree');
  await step(tok);                                   // 17:04 merging is done in post-order
  good('左 → 右 → 根（merge）＝ post-order', 0, 0.4, 1.0);
  gd.mood('happy'); await gd.hop(tok);
  say('merge 的順序 = post-order', '先左、再右，最後才在根 merge');
}]);

// 17:28 遞迴式與 master theorem
FRAG.push(['sortbari-merge-recurrence', 'T(n) = 2T(n/2) + n → Θ(n log n)', async (tok) => {
  fresh([0, 4, 13], [0, 3.4, 0]);
  const gd = guide();
  const full = ['MergeSort(l, h)          T(n)', '{ if (l < h)', '  { mid = (l + h) / 2;     1', '    MergeSort(l, mid);     T(n/2)', '    MergeSort(mid + 1, h); T(n/2)', '    Merge(l, mid, h);      n', '  }', '}'];
  const w = Math.max(...full.map((s) => s.length));
  const bare = full.map((s) => s.replace(/\s{2,}(T\(n\)|1|T\(n\/2\)|n)$/, '').padEnd(w, ' '));
  await step(tok);                                   // 17:28 time complexity by recurrence relation
  const C = code(full, -3.0, 5.8, 0.55);
  C.ls.forEach((l, i) => txt(l, bare[i]));
  say('用 recurrence relation 求時間', '遞迴演算法的老方法');
  const show = (i) => txt(C.ls[i], full[i].padEnd(w, ' '));
  await step(tok);                                   // 17:45 the algorithm takes T(n); mid is a constant
  C.hl(0); show(0); show(2);
  say('假設整個演算法花 T(n)', '算 mid 只是常數，可以忽略');
  await step(tok);                                   // 17:59 calls itself on half the list, twice
  C.hl(3); show(3); await beat(tok, 500); C.hl(4); show(4);
  gd.mood('wow');
  say('左右各處理一半：T(n/2) + T(n/2)');
  await step(tok);                                   // 18:07 merging two lists, n elements in all
  C.hl(5); show(5);
  say('merge 兩個串列：一共 n 個元素', 'Merge 花 n');
  await step(tok);                                   // 18:21 T(n) = 2T(n/2) + n
  C.hl(-1);
  const f = tag('T(n) = 2T(n/2) + n', 'ptr alt', 3.6, 6.2, 0);
  gd.mood('calm');
  say('全部加起來：T(n) = 2T(n/2) + n');
  await step(tok);                                   // 18:39 when n > 1; when n = 1 write 1
  txt(f, 'T(n) = 2T(n/2) + n（n > 1）');
  note('n = 1：什麼都不做 → 寫 1', 3.6, 5.3, 0);
  say('n > 1 才遞迴', 'n = 1 時寫一個常數 1');
  await step(tok);                                   // 19:06 master theorem: a = 2, b = 2, f(n) = n
  bubble('a = 2、b = 2、f(n) = n', 3.6, 4.3, 0);
  say('Master theorem：a = 2、b = 2', 'f(n) = n = nᵏ，k = 1');
  await step(tok);                                   // 19:27 log₂ 2 = 1 = k → case 2
  bubble('log_b a = log₂ 2 = 1 = k', 3.6, 3.5, 0);
  gd.mood('wow');
  say('log₂ 2 = 1，和 k 相等 → case 2');
  await step(tok);                                   // 19:38 case 2: f(n) times log n
  bubble('case 2：f(n) × log n', 3.6, 2.7, 0);
  say('case 2：f(n) 原樣寫下，再乘 log n', 'n × log n');
  await step(tok);                                   // 20:16 Θ(n log n)
  good('Θ(n log n)', 3.6, 1.8, 0);
  gd.mood('happy'); await gd.hop(tok);
  say('Merge sort 的時間', '<span class="ok">Θ(n log n)</span>');
}]);

// ── Quick Sort ──
// a floor row of value cubes with i / j / l / h pointers
function sbRow(vals, o = {}) {
  const dx = o.dx || 1.1, z = o.z || 0, y = 0.5, n = vals.length, x0 = -(n - 1) * dx / 2;
  const R = { v: vals.slice(), m: [], dx, z, y };
  R.x = (i) => x0 + i * dx;
  for (let i = 0; i < n; i++) ctx.tile(V3(R.x(i), 0.02, z), dx * 0.9, 1.0);
  vals.forEach((v, i) => { R.m[i] = v === null ? null : cube(sbS(v), v === Infinity ? '#d8cfc0' : colorFor(v), [0.8, 0.8, 0.8], R.x(i), y, z, o.drop ? 2.2 : 0); });
  R.ptr = (text, cls, i, dy) => tag(text, cls, R.x(i), y + dy, z);
  R.at = (l, i, dy) => l.position.set(R.x(i), y + dy, z);
  R.swap = async (tok, i, j, ms = 800) => {
    const a = R.m[i], b = R.m[j], h = y + 1.1;
    if (i !== j) {
      move(a, R.x(i), h, z); move(b, R.x(j), h + 0.9, z); await beat(tok, ms * 0.3);
      move(a, R.x(j), h, z); move(b, R.x(i), h + 0.9, z); await beat(tok, ms * 0.4);
      move(a, R.x(j), y, z); move(b, R.x(i), y, z); await beat(tok, ms * 0.3);
    } else await beat(tok, ms * 0.4);
    [R.m[i], R.m[j]] = [R.m[j], R.m[i]]; [R.v[i], R.v[j]] = [R.v[j], R.v[i]];
  };
  R.str = () => R.v.map(sbS).join(' ');
  return R;
}
// Bari's partition(l, h) as a list of events the scene plays one sentence at a time
// (h is the sentinel slot: ∞ or an earlier pivot). Events: init, i, j, swap, cross, final, done.
function sbPartition(R, l, h, o = {}) {
  const p = R.v[l], v = R.v.slice(), E = [['init']];
  {
    let i = l, j = h;
    while (i < j) {
      do i++; while (v[i] <= p); E.push(['i', i]);
      do j--; while (v[j] > p); E.push(['j', j]);
      if (i < j) { E.push(['swap', i, j]); [v[i], v[j]] = [v[j], v[i]]; } else E.push(['cross', i, j]);
    }
    E.push(['final', j]); E.push(['done', j]);
  }
  const ms = o.ms || 800, hl = (k) => { if (o.code) o.code.hl(k); };
  let it = null, jt = null, pt = null, ci = l, cj = h, e = 0, xt = null;
  return {
    E, p,
    async to(tok, upto) {
      while (e < upto) {
        const ev = E[e++];
        if (ev[0] === 'init') {
          hl(1); glow(R.m[l], GOLD);
          pt = R.ptr('pivot', 'ptr alt', l, 2.6); it = R.ptr('i', 'ptr', l, 1.3); jt = R.ptr('j', 'ptr', h, 1.9);
          say('pivot = ' + p + '；i 從 pivot、j 從尾端出發', R.str());
          await beat(tok, ms * 0.4);
        } else if (ev[0] === 'i') {
          hl(3);
          while (ci < ev[1]) { ci++; R.at(it, ci, 1.3); glow(R.m[ci], '#1f3a6e'); await beat(tok, ms * 0.3); if (ci < ev[1]) glow(R.m[ci], null); }
          say('i 停在 ' + sbS(R.v[ci]) + '（> ' + p + '）', 'i 找比 pivot 大的');
          await beat(tok, ms * 0.2);
        } else if (ev[0] === 'j') {
          hl(4);
          while (cj > ev[1]) { cj--; R.at(jt, cj, 1.9); if (cj !== l) glow(R.m[cj], '#8a1f5a'); await beat(tok, ms * 0.3); if (cj > ev[1] && cj !== l) glow(R.m[cj], null); }
          say('j 停在 ' + sbS(R.v[cj]) + '（≤ ' + p + '）', 'j 找比 pivot 小（或相等）的');
          await beat(tok, ms * 0.2);
        } else if (ev[0] === 'swap') {
          hl(5);
          say('i < j：交換 ' + sbS(R.v[ev[1]]) + ' 和 ' + sbS(R.v[ev[2]]));
          glow(R.m[ev[1]], null); glow(R.m[ev[2]], null);
          await R.swap(tok, ev[1], ev[2], ms);
          say('交換後', R.str());
        } else if (ev[0] === 'cross') {
          hl(2); glow(R.m[ev[1]], null); if (ev[2] !== l) glow(R.m[ev[2]], null);
          xt = tag('i > j：交錯了', 'bad', (R.x(ev[1]) + R.x(ev[2])) / 2, R.y + 3.4, R.z);
          say('i 跑到 j 的右邊 → 不交換', '迴圈結束');
          await beat(tok, ms * 0.3);
        } else if (ev[0] === 'final') {
          hl(7); if (xt) { kill(xt); xt = null; }
          say('A[l] 和 A[j] 交換：' + p + ' ↔ ' + sbS(R.v[ev[1]]));
          await R.swap(tok, l, ev[1], ms);
          say(p + ' 換到 j 的位置', R.str());
        } else {
          hl(8); glow(R.m[ev[1]], null); tint(R.m[ev[1]], GREEN);
          kill(pt); kill(it); kill(jt);
          say(p + ' 歸位：return j', R.str());
          await beat(tok, ms * 0.3);
        }
      }
    },
  };
}
// a student walks (a little character whose size is their height)
async function sbWalk(tok, b, x, z, ms = 900) {
  const a = b.g.position.clone(), t = V3(x, a.y, z);
  await anim(tok, ms, (u) => b.g.position.lerpVectors(a, t, u));
}

// 0:00 想法：學生依身高自己找位置
FRAG.push(['sortbari-quick-students', 'Quick sort 的想法：學生自己找位置', async (tok) => {
  fresh([0, 4, 11], [0, 1.2, 0]);
  const H = [0.85, 1.15, 0.6, 1.0, 1.35, 0.7, 0.95], C = ['#4b9ee2', '#e55a9b', '#2fc092', '#dd8238', '#9b7ef4', '#31aab0', '#c08a1f'];
  const X = (i) => -4.8 + i * 1.6;
  await step(tok);                                   // 0:00 the idea behind quick sort
  bubble('Quick sort 的想法是什麼？', 0, 3.6, 0);
  say('先看 quick sort 背後的想法');
  await step(tok);                                   // 0:12 students arrange by increasing height
  let line = H.map((h, i) => { const b = buddy('', '', C[i], X(i), 0, 0, h); b.h = h; return b; });
  say('一班學生要依身高排成一排', '由矮到高');
  await step(tok);                                   // 0:23 option 1: the teacher shows each place
  const t = buddy('老師', '', '#f3d36b', 0, 0, -2.6, 1.3);
  const n1 = note('做法一：老師一個一個指定位置', -2.6, 2.6, -2.6);
  t.look(-1); line.forEach((b) => b.mood('wow'));
  say('做法一：老師指定每個人的位置');
  await step(tok);                                   // 0:37 option 2: students arrange themselves
  note('做法二：學生自己找位置', 2.6, 2.6, -2.6); t.look(0);
  say('做法二：讓學生自己找位置');
  await step(tok);                                   // 0:41 finding their own place is quicker
  line.forEach((b) => b.mood('happy')); remove(n1);
  good('自己找位置比較快 → quick sort', 0, 3.6, 1.0);
  say('每個人自己找到排序後的位置 → 比較快', '這就是 quick sort 的想法');
  const place = async (moving) => {
    await Promise.all(moving.map((b) => sbWalk(tok, b, b.g.position.x, 1.8, 500)));
    await Promise.all(line.map((b) => sbWalk(tok, b, X(line.indexOf(b)), moving.includes(b) ? 1.8 : 0, 900)));
    await Promise.all(moving.map((b) => sbWalk(tok, b, X(line.indexOf(b)), 0, 500)));
  };
  await step(tok);                                   // 0:56 the shortest goes to the beginning
  const short = line[2]; short.glow(GOLD); short.mood('happy');
  line = [short].concat(line.filter((b) => b !== short)); await place([short]);
  short.glow(null);
  say('最矮的：自己走到最前面', '不需要別人幫忙');
  await step(tok);                                   // 1:17 the tallest goes to the back
  const tall = line.find((b) => b.h === 1.35); tall.glow(GOLD);
  line = line.filter((b) => b !== tall).concat([tall]); await place([tall]);
  tall.glow(null);
  say('最高的：自己走到最後面');
  await step(tok);                                   // 1:39 "taller: go back; shorter: come front"
  const me = line.find((b) => b.h === 0.95); me.glow(GOLD); me.mood('wow');
  const lo = line.filter((b) => b !== me && b.h < 0.95), hi = line.filter((b) => b !== me && b.h > 0.95);
  const movers = line.filter((b, i) => b !== me && (b.h < 0.95) !== (i < line.indexOf(me)));
  line = lo.concat([me], hi); await place(movers);
  bubble('比我高的往後、比我矮的往前', me.g.position.x, 2.2, 0);
  say('其他人：比我高的往後站、比我矮的往前站');
  await step(tok);                                   // 2:04 and I find my place
  me.glow(GREEN); me.mood('happy'); await me.hop(tok);
  say('我就站在自己的排序位置了', '前面都比我矮、後面都比我高');
}]);

// 2:14 什麼叫「在排序位置」
FRAG.push(['sortbari-quick-sorted-pos', '在排序位置：左邊都小、右邊都大', async (tok) => {
  fresh([0, 7, 10.5], [0, 0.4, 0]);
  const gd = guide(-6.2, 2.2, 0.6);
  await step(tok);                                   // 2:14 10 80 90 60 30 20: which one is sorted?
  const A = sbRow([10, 80, 90, 60, 30, 20], { z: -2.4, dx: 1.05, drop: true });
  gd.mood('wow');
  say('10 80 90 60 30 20', '哪一個一眼就知道已經排好了？');
  await step(tok);                                   // 2:27 this one (10: smallest, in front)
  glow(A.m[0], GOLD); good('最小又在最前面', A.x(0), 1.6, -2.4);
  gd.mood('happy');
  say('10：最小、又在最前面', '<span class="ok">10 已經在排序位置</span>');
  await step(tok);                                   // 2:37 another list: the largest is at the back
  const Bq = sbRow([null, null, null, null, null, null, null], { z: -0.2, dx: 1.05 });
  for (let i = 0; i < 7; i++) Bq.m[i] = cube(i === 6 ? '最大' : '?', i === 6 ? '#e8c770' : '#cfc6b6', [0.8, 0.8, 0.8], Bq.x(i), 0.5, -0.2, 1.5);
  glow(Bq.m[6], GOLD);
  say('另一串：最大的在最後面', '它也在排序位置，其他的還不知道');
  await step(tok);                                   // 2:53 4 6 7 10 16 12 13 14
  const B = sbRow([4, 6, 7, 10, 16, 12, 13, 14], { z: 2.0, dx: 1.05, drop: true });
  gd.mood('wow');
  say('4 6 7 10 16 12 13 14', '哪一個在自己的排序位置？');
  await step(tok);                                   // 3:06 this element (10)
  glow(B.m[3], GOLD); gd.mood('calm');
  say('看 10');
  await step(tok);                                   // 3:13 everything before it is smaller
  const gl = ghostBox('#2fc092', 3 * 1.05, 1.0, 1.1); gl.position.set(B.x(1), 0.5, 2.0);
  say('10 前面的 4 6 7 都比 10 小');
  await step(tok);                                   // 3:18 everything after it is greater
  const gr = ghostBox('#dd8238', 4 * 1.05, 1.0, 1.1); gr.position.set((B.x(4) + B.x(7)) / 2, 0.5, 2.0);
  tint(B.m[3], GREEN); gd.mood('happy');
  say('10 後面的 16 12 13 14 都比 10 大', '<span class="ok">10 在排序位置</span>');
  await step(tok);                                   // 3:22 quick sort works on this idea
  bubble('左邊都比它小、右邊都比它大 → 它在排序位置', 0, 2.6, 0);
  say('quick sort 的根據', '左小右大的元素，就站在排序後的位置');
  await step(tok);                                   // 3:39 the rest may or may not be sorted
  note('16 12 13 14 自己還沒排好', B.x(5.5), 1.6, 2.0);
  say('其他元素可能還沒排好');
  await step(tok);                                   // 3:45 that's how the name "quick" comes
  say('名字叫 quick：像學生自己很快排好');
  await step(tok);                                   // 3:53 but not the fastest method
  bad('名字叫 quick，但不是最快的排序', 0, 3.4, 0);
  gd.mood('wow');
  say('但它不是最快的排序法', '只是名字叫 quick');
}]);

// 4:02 初始設定：l、h、∞、pivot、i、j
FRAG.push(['sortbari-quick-setup', 'Partition 的準備：∞、pivot、i、j', async (tok) => {
  fresh([0, 6, 12], [0, 1.2, 0]);
  const gd = guide(-6.0, 2.4, 0.6);
  await step(tok);                                   // 4:02 quick sort: divide and conquer
  bubble('Quick sort：divide and conquer', 0, 3.8, 0);
  say('quick sort 也是 divide and conquer', '把問題拆成子問題再解');
  await step(tok);                                   // 4:19 initial setup: nine elements
  const R = sbRow(SB_Q.slice(0, 9).concat([null]), { drop: true });
  say('初始設定：9 個元素', '10 16 8 12 15 6 3 9 5');
  await step(tok);                                   // 4:25 l = low, h = high
  R.ptr('l', 'idx', 0, -0.6); R.ptr('h', 'idx', 9, -0.6);
  say('l = low 開頭，h = high 尾端', '尾端多留一格');
  await step(tok);                                   // 4:31 add infinity at the empty place
  R.m[9] = cube('∞', '#d8cfc0', [0.8, 0.8, 0.8], R.x(9), 0.5, 0, 2.2);
  gd.mood('wow');
  say('空格放 ∞', '比所有數都大');
  await step(tok);                                   // 4:42 a maximum integer: end-of-list marker
  note('像字串結尾的 \\0', R.x(9), 1.6, 0);
  say('電腦沒有 ∞：用最大整數', '當作 end-of-list 標記');
  await step(tok);                                   // 5:04 the first element is the pivot: 10
  glow(R.m[0], GOLD); R.ptr('pivot', 'ptr alt', 0, 2.6);
  gd.mood('calm');
  say('第一個元素當 pivot = 10', '目標：找到 10 的排序位置');
  await step(tok);                                   // 5:25 smaller to the left, greater to the right
  const gl = ghostBox('#2fc092', 4.4, 1.0, 1.1); gl.position.set(R.x(1.5), 0.5, 0);
  const gr = ghostBox('#dd8238', 4.4, 1.0, 1.1); gr.position.set(R.x(6.5), 0.5, 0);
  say('比 10 小的都到左邊', '比 10 大的都到右邊');
  await step(tok);                                   // 5:35 greater here → send there; smaller there → bring here
  kill(gl); kill(gr);
  const p1 = pkt('大的 →', R.x(2), 1.6, 0), p2 = pkt('← 小的', R.x(7), 1.6, 0);
  await Promise.all([travel(tok, p1, V3(R.x(2), 1.6, 0), V3(R.x(6), 1.6, 0), 900), travel(tok, p2, V3(R.x(7), 1.6, 0), V3(R.x(3), 1.6, 0), 900)]);
  remove(p1); remove(p2);
  say('左邊的大數送到右邊，右邊的小數帶到左邊');
  await step(tok);                                   // 5:44 i starts at the pivot, j at infinity
  R.ptr('i', 'ptr', 0, 1.3); R.ptr('j', 'ptr', 9, 1.9);
  say('i 從 pivot 出發，j 從 ∞ 出發');
  await step(tok);                                   // 5:57 i looks for > pivot, j for ≤ pivot → exchange
  bubble('i 找 > 10、j 找 ≤ 10 → 交換', 0, 3.4, 0);
  say('i 找比 pivot 大的、j 找比 pivot 小的', '找到就交換');
  await step(tok);                                   // 6:08 i stops at ∞ at most, j at the pivot
  glow(R.m[9], GOLD);
  gd.mood('happy');
  say('i 最遠停在 ∞，j 最遠停在 pivot', '所以不會跑出陣列');
}]);

// 6:30 partition 過程：16↔5、12↔9、15↔3，10↔6
FRAG.push(['sortbari-quick-partition', 'Partition：10 16 8 12 15 6 3 9 5', async (tok) => {
  fresh([0, 6, 12], [0, 1.2, 0]);
  const gd = guide(-6.0, 2.4, 0.6);
  const R = sbRow(SB_Q), P = sbPartition(R, 0, 9, { ms: 900 });
  // 6:30 partitioning · 6:41 i → 16 · 6:48 j → 5 · 6:53 swap · 7:00 i → 12 · 7:17 j → 9 · 7:24 swap
  // 7:36 i → 15, j → 3 · 7:44 swap · 7:52 i → 15, j → 6 · 7:57 crossed
  const plan = [[1, 'calm'], [2], [3], [4, 'happy'], [5], [6], [7, 'happy'], [9], [10, 'happy'], [12], [13, 'wow']];
  for (const [upto, mood] of plan) {
    await step(tok);
    if (mood) gd.mood(mood);
    await P.to(tok, upto);
    if (upto === 1) say('partitioning procedure', '先手做一次，再寫成演算法');
  }
  await step(tok);                                   // 8:09 wherever j points is the pivot's position
  const jp = tag('pivot 的位置', 'good', R.x(5), 3.2, 0);
  say('j 指著的地方，就是 pivot 的位置');
  await step(tok);                                   // 8:14 send that element here, take 10 there
  kill(jp);
  await P.to(tok, P.E.length);
  gd.mood('happy'); await gd.hop(tok);
  await step(tok);                                   // 8:24 these lists are not yet sorted
  const gl = ghostBox('#2fc092', 5 * R.dx, 1.0, 1.1); gl.position.set((R.x(0) + R.x(4)) / 2, 0.5, 0);
  const gr = ghostBox('#dd8238', 3 * R.dx, 1.0, 1.1); gr.position.set((R.x(6) + R.x(8)) / 2, 0.5, 0);
  note('還沒排好', R.x(2), 1.7, 0); note('還沒排好', R.x(7), 1.7, 0);
  gd.mood('calm');
  say('左右兩邊都還沒排好');
  await step(tok);                                   // 8:32 left side < 10, right side > 10
  say('但左邊都 < 10、右邊都 > 10', '6 5 8 9 3 │ 10 │ 15 12 16');
  await step(tok);                                   // 8:44 10 is sorted: the partitioning position
  good('10 已排好：partitioning position', R.x(5), 2.6, 0);
  gd.mood('happy');
  say('pivot 10 已經排好了', '這個位置叫 partitioning position');
  await step(tok);                                   // 9:04 perform quick sort recursively on either side
  bubble('左右兩邊再各自 quick sort', 0, 3.6, 0);
  say('接著對兩邊遞迴做 quick sort');
}]);

// 9:19 partition 的程式碼
FRAG.push(['sortbari-quick-code', 'partition(l, h) 演算法', async (tok) => {
  fresh([0, 6, 12], [0, 2.4, 0]);
  const gd = guide(-6.0, 2.8, 0.6);
  await step(tok);                                   // 9:19 partition takes low and high
  const C = code(['partition(l, h)', '{ pivot = A[l]; i = l; j = h;', '  while (i < j)', '  { do { i++; } while (A[i] <= pivot);', '    do { j--; } while (A[j] > pivot);', '    if (i < j) swap(A[i], A[j]);', '  }', '  swap(A[l], A[j]);', '  return j;', '}'], 0, 6.4, 0.46, -2.5);
  const R = sbRow(SB_Q, { z: 1.8 }), P = sbPartition(R, 0, 9, { ms: 700, code: C });
  C.hl(0);
  say('把剛才的步驟寫成 partition(l, h)', '參數：low、high');
  await step(tok);                                   // 9:32 pivot = A[low]
  C.hl(1); glow(R.m[0], GOLD);
  say('第一個元素當 pivot：pivot = A[l]');
  await step(tok);                                   // 9:39 i at low, j at high
  await P.to(tok, 1);
  say('i = l、j = h');
  // 9:52 do i++ while A[i] ≤ pivot · 10:09 do j-- while A[j] > pivot · 10:46 if (i < j) swap
  // 11:08 repeat: increment i, decrement j, swap · 11:20 put it all in while (i < j) · 11:31 i > j → stop
  // 11:41 swap A[l] with A[j] · 11:50 return j
  const plan = [[2, 'wow'], [3], [4, 'happy'], [7], [10], [13, 'wow'], [14], [15, 'happy']];
  for (const [upto, mood] of plan) {
    await step(tok);
    if (mood) gd.mood(mood);
    await P.to(tok, upto);
    if (upto === 7) say('同樣的事再做一次：i 往右、j 往左、交換');
    if (upto === 10) { C.hl(2); say('整段放進 while (i < j) 迴圈', '一直重複到 i、j 交錯'); }
  }
  say('return j：pivot 的位置', 'partitioning position　' + R.str());
}]);

// 12:04 QuickSort(l, h)：遞迴，pivot 當左半邊的 ∞
FRAG.push(['sortbari-quick-recursive', 'QuickSort(l, h)：左邊用 pivot 當 ∞', async (tok) => {
  fresh([0, 6, 12], [0, 2.4, 0]);
  const gd = guide(-6.0, 2.8, 0.6);
  await step(tok);                                   // 12:04 QuickSort takes low and high
  const C = code(['QuickSort(l, h)', '{ if (l < h)', '  { j = partition(l, h);', '    QuickSort(l, j);', '    QuickSort(j + 1, h);', '  }', '}'], 0, 6.2, 0.5, -2.5);
  const R = sbRow(SB_Q, { z: 1.8 });
  C.hl(0);
  say('QuickSort(l, h)', '一樣傳 low、high');
  await step(tok);                                   // 12:12 if l < h: at least two elements
  C.hl(1);
  say('l < h：至少兩個元素', '才需要排序');
  await step(tok);                                   // 12:19 call partition with low and high
  C.hl(2);
  const P = sbPartition(R, 0, 9, { ms: 150 });
  await P.to(tok, P.E.length);
  say('呼叫 partition(l, h)', R.str());
  await step(tok);                                   // 12:27 it returns j, where partitioning is done
  const jt = R.ptr('j', 'ptr alt', 5, 1.4);
  gd.mood('happy');
  say('partition 回傳 j：10 歸位的位置', R.str());
  await step(tok);                                   // 12:39 quick sort on the left: low to j
  C.hl(3);
  const zl = ghostBox('#2fc092', 6 * R.dx, 1.0, 1.1); zl.position.set((R.x(0) + R.x(5)) / 2, 0.5, 1.8);
  gd.mood('calm');
  say('左邊：QuickSort(l, j)', '從 low 到 j');
  await step(tok);                                   // 12:46 and on the right: j + 1 to high
  C.hl(4);
  const zr = ghostBox('#dd8238', 4 * R.dx, 1.0, 1.1); zr.position.set((R.x(6) + R.x(9)) / 2, 0.5, 1.8);
  say('右邊：QuickSort(j + 1, h)', '從 j + 1 到 high');
  await step(tok);                                   // 13:07 this is already sorted — why include j?
  C.hl(3); glow(R.m[5], GOLD);
  gd.mood('wow');
  say('10 已經排好了，左邊為什麼還包含 j？');
  await step(tok);                                   // 13:13 the right list has ∞; where is ∞ for the left?
  glow(R.m[9], GOLD);
  note('右邊的 ∞', R.x(9), 1.6, 1.8);
  say('右邊的串列尾端有 ∞', '左邊的 ∞ 在哪裡？');
  await step(tok);                                   // 13:18 the sorted element acts as ∞ for the first list
  glow(R.m[9], null); kill(jt);
  note('左邊的 ∞ = 10', R.x(5), 1.6, 1.8);
  gd.mood('happy'); await gd.hop(tok);
  say('排好的 10 就當左邊串列的 ∞', '所以左邊寫 QuickSort(l, j)');
}]);
  }

  // ═══ sortlin.js ═══
  {
// ─── cxbabnqtWsk：台大林軒田 DSA「Sorting / Summary」（selection → heap → bubble → insertion → shell → merge → tree → quick） ───
// Cued scenes: every `await step(tok)` waits for the sentence it shows; beats are motion only (≤ ~3 s per step).
// 只用 K 與 ctx（加上本模組的 sort 引擎：S、sortStep、enterStab／enterHeap／enterDist／enterDC 給內建場景的 cued 版本用）。
// 老師的例子：merge 用 6 5 4 7 8 3 1 2；quick 用 pivot 6，左堆 1 4 3 2 5、右堆 9 7 8 10，掃描交換 9↔5、7↔2、8↔3，
// 最後 6↔3（陣列 6 1 4 9 7 8 3 10 2 5 由逐字稿重建）；insertion 的 adaptive 用 2 3 4 5 6；shell 的間隔 10 → 5 → 2 → 1；
// 壞資料 1..10 永遠挑第一個。其他小陣列是示意資料（老師板書沒有念出數字）。
// 人／小朋友用 buddy（會呼吸、眨眼、有表情）；對話泡泡用 tag 'say'、便條 'note'、移動的小標籤 'pkt'。
const { V3, fresh, tag, cube, move, glow, tint, txt, code, arrow, ghostBox, line, kill, anim, travel, buddy, prop, bob, lnode, step, GOLD, GREEN, RED } = K;
const beat = ctx.beat, colorFor = ctx.colorFor, lab = ctx.lab;
const say = (a, b = '') => ctx.say(a, b);
const BLUE = '#1f3a6e', PINK = '#8a1f5a', SUN = '#f4c27a';
const LCAM = [0, 7.5, 12.5], LLOOK = [0, 2, 0];
const nOf = (v) => parseInt(String(v), 10) || 0;
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const pkt = (t, x, y, z = 0) => tag(t, 'pkt', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
// glow / mood that work for both cubes and buddies (a buddy's group carries userData.bud)
const gl = (m, c) => { if (!m) return; if (m.userData && m.userData.bud) m.userData.bud.glow(c); else glow(m, c); };
const mood = (m, s) => { if (m && m.userData && m.userData.bud) m.userData.bud.mood(s); };
const killAll = (list) => list.forEach((o) => kill(o));
// a little helper character in a corner that reacts to what happens
const helper = (x, z, name = '小幫手', s = 0.75) => buddy(name, '', SUN, x, 0, z, s);
// a row of value cubes (or kids = buddies sized by value); R.v = values, R.m = meshes/groups, slot i at x = R.x(i)
function lRow(vals, o = {}) {
  const dx = o.dx || 1.05, kid = !!o.kids, y = o.y === undefined ? (kid ? 0.05 : 0.5) : o.y, z = o.z || 0, sz = o.sz || 0.78;
  const n = o.n || vals.length;
  const x0 = o.x0 === undefined ? -(n - 1) * dx / 2 : o.x0;
  const R = { v: vals.slice(), m: [], dx, y, z, n, h: y + (kid ? 1.9 : 1.1), zy: kid ? 0.6 : y, all: [] };
  R.x = (i) => x0 + i * dx;
  if (o.tiles !== false) for (let i = 0; i < n; i++) R.all.push(ctx.tile(V3(R.x(i), 0.02, z), dx * 0.9, 1.0));
  if (o.idx) for (let i = 0; i < n; i++) R.all.push(tag(String(i), 'idx', R.x(i), o.tiles === false ? y - 0.75 : 0.05, z + (o.tiles === false ? 0 : 0.75)));
  vals.forEach((v, i) => {
    if (v === null) { R.m[i] = null; return; }
    if (kid) { const b = buddy('', v, colorFor(nOf(v)), R.x(i), y, z, 0.55 + 0.05 * Math.min(9, nOf(v))); b.g.userData.bud = b; R.m[i] = b.g; }
    else R.m[i] = cube(v, colorFor(nOf(v)), [sz, sz, sz], R.x(i), y, z, o.drop ? 2.4 : 0);
  });
  R.hl = (list, c) => list.forEach((i) => gl(R.m[i], c));
  R.off = () => R.m.forEach((m) => gl(m, null));
  R.at = (l, i, dy = 1.3) => { l.position.set(R.x(i), R.y + dy + (kid ? 0.9 : 0), R.z); };
  R.kill = () => { R.m.forEach((m) => kill(m)); R.all.forEach((m) => kill(m)); };
  // swap two slots: one hops over the other
  R.swap = async (tok, i, j, ms = 800) => {
    const a = R.m[i], b = R.m[j];
    if (a) move(a, R.x(i), R.h, R.z); await beat(tok, ms * 0.3);
    if (a) move(a, R.x(j), R.h, R.z); if (b) move(b, R.x(i), R.y, R.z); await beat(tok, ms * 0.4);
    if (a) move(a, R.x(j), R.y, R.z); await beat(tok, ms * 0.3);
    [R.m[i], R.m[j]] = [R.m[j], R.m[i]]; [R.v[i], R.v[j]] = [R.v[j], R.v[i]];
  };
  // take slot `from` out and put it at slot `to` (< from); the ones in between shift right by one
  R.rot = async (tok, from, to, ms = 1000) => {
    const a = R.m[from], av = R.v[from];
    move(a, R.x(from), R.h, R.z); await beat(tok, ms * 0.25);
    for (let k = from - 1; k >= to; k--) { move(R.m[k], R.x(k + 1), R.y, R.z); R.m[k + 1] = R.m[k]; R.v[k + 1] = R.v[k]; await beat(tok, (ms * 0.45) / Math.max(1, from - to)); }
    R.m[to] = a; R.v[to] = av;
    move(a, R.x(to), R.h, R.z); await beat(tok, ms * 0.15);
    move(a, R.x(to), R.y, R.z); await beat(tok, ms * 0.15);
  };
  // rearrange slots lo.. into the given value order (values must be a permutation of that range)
  R.arrange = async (tok, lo, order, ms = 900) => {
    const pool = []; for (let k = lo; k < lo + order.length; k++) pool.push([R.v[k], R.m[k]]);
    pool.forEach(([, m], k) => move(m, R.x(lo + k), R.h, R.z)); await beat(tok, ms * 0.3);
    order.forEach((v, k) => { const p = pool.findIndex((e) => e && e[0] === v); const [, m] = pool[p]; pool[p] = null; R.v[lo + k] = v; R.m[lo + k] = m; move(m, R.x(lo + k), R.h, R.z); });
    await beat(tok, ms * 0.4);
    for (let k = lo; k < lo + order.length; k++) move(R.m[k], R.x(k), R.y, R.z);
    await beat(tok, ms * 0.3);
  };
  // a translucent box over slots i..j
  R.zone = (old, c, i, j, hgt = 1.2) => { if (old) kill(old); if (j < i) return null; const g = ghostBox(c, (j - i + 1) * dx, hgt, 1.2); g.position.set((R.x(i) + R.x(j)) / 2, R.zy, R.z); return g; };
  return R;
}
// one selection round: scan slots i+1.. for the minimum (strict <, so the smallest index wins), then swap or rotate it to slot i
async function selRound(tok, R, i, o = {}) {
  const ms = o.ms || 260, n = R.v.length; let m = i;
  for (let j = i + 1; j < n; j++) {
    R.off(); gl(R.m[i], GREEN); if (m !== i) gl(R.m[m], PINK); gl(R.m[j], GOLD);
    if (o.cnt) o.cnt.c++; if (o.onCmp) o.onCmp();
    await beat(tok, ms);
    if (nOf(R.v[j]) < nOf(R.v[m])) m = j;
  }
  R.off(); gl(R.m[i], GREEN); gl(R.m[m], PINK);
  await beat(tok, ms * 1.4);
  if (m !== i) { if (o.rot) await R.rot(tok, m, i, o.sw || 1000); else await R.swap(tok, i, m, o.sw || 800); }
  R.off(); return m;
}
// backward insertion of slot i into the sorted part (step = gap): shift bigger ones by `gap`, stop at ≤ key
async function insRound(tok, R, i, o = {}) {
  const ms = o.ms || 300, g = o.gap || 1, lo = o.lo || 0, hk = o.hk || (() => {});
  const km = R.m[i], kv = R.v[i];
  gl(km, GOLD); move(km, R.x(i), R.h, R.z); hk('key', kv); await beat(tok, ms);
  let j = i - g;
  while (j >= lo) {
    gl(R.m[j], BLUE); if (o.cnt) o.cnt.c++; hk('cmp', R.v[j], kv); await beat(tok, ms);
    if (nOf(R.v[j]) <= nOf(kv)) { gl(R.m[j], null); break; }
    gl(R.m[j], null); move(R.m[j], R.x(j + g), R.y, R.z); R.m[j + g] = R.m[j]; R.v[j + g] = R.v[j];
    if (o.mv) o.mv.c++; hk('shift', R.v[j + g]);
    j -= g; move(km, R.x(j + g), R.h, R.z); await beat(tok, ms);
  }
  R.m[j + g] = km; R.v[j + g] = kv; move(km, R.x(j + g), R.y, R.z); gl(km, null); hk('place', kv, j + g); await beat(tok, ms);
  return j + g;
}
// one bubble pass over pairs (k, k+1), k = lo..hi-1 (dir 1) or hi-1..lo (dir -1)
async function bubblePass(tok, R, lo, hi, dir = 1, o = {}) {
  const ms = o.ms || 380; let sw = 0;
  for (let t = 0; t < hi - lo; t++) {
    const k = dir > 0 ? lo + t : hi - 1 - t;
    R.off(); R.hl([k, k + 1], GOLD); if (o.cnt) o.cnt.c++;
    await beat(tok, ms);
    const a = nOf(R.v[k]), b = nOf(R.v[k + 1]);
    if (a > b) { R.hl([k, k + 1], RED); sw++; if (o.onSwap) o.onSwap(k); await R.swap(tok, k, k + 1, ms * 1.6); }
    else if (a === b && o.onEq) await o.onEq(k);
  }
  R.off(); return sw;
}
// play the module's recorded sort steps up to index `until`, spread over `ms`
async function runTo(tok, until, ms) {
  until = Math.min(until, S.steps.length - 1);
  const n = until - S.i; if (n <= 0) return;
  const per = Math.max(30, ms / n);
  while (S.i < until) { sortStep(); await beat(tok, per); }
}
const lastStep = () => S.steps.length - 1;
// a deterministic input that Heap Sort sorts unstably (so a replay shows the same picture)
function heapUnstableVals() {
  let s = 7; const r = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  for (let t = 0; t < 500; t++) { const v = Array.from({ length: 6 }, () => 1 + Math.floor(r() * 4)); if (!isStableRun('heap', v)) return v; }
  return [2, 1, 2, 3, 1, 3];
}

// 17:26 今天的主題：Sorting 是 algorithm，但跟學過的 data structure 都有關
FRAG.push(['sortlin-intro', '今天的主題：用 Sorting 串起資料結構', async (tok) => {
  fresh([0, 6, 12.5], [0, 2.2, 0]);
  await step(tok);                                   // 17:26 今天的課程叫做 Sorting
  const host = buddy('Sorting', '排序', SUN, 0, 0, 0.6, 1.1);
  say('今天的主題：Sorting（排序）', '刻意擺在最後一堂');
  await step(tok);                                   // 17:42 Sorting 其實是 algorithm
  const b1 = bub('我是一個 algorithm', 1.9, 1.9, 0.6);
  say('Sorting 本身是一個 algorithm', '把資料照大小排好的步驟');
  await step(tok);                                   // 17:56 跟學過的 data structure 很有關係
  kill(b1);
  const DS = [['Array', -4.6, 4.4], ['Linked list', -4.6, 1.8], ['Heap', 4.6, 4.4], ['BST', 4.6, 1.8], ['Sparse array', 0, 5.4]];
  const ms = DS.map(([n, x, y]) => cube(n, '#2fc092', [2.5, 0.7, 0.7], x, y, 0, 1.2));
  host.mood('wow'); host.look(0);
  say('跟學過的 data structure 很有關係', '看懂它們的 behavior、用在哪裡');
  await step(tok);                                   // 18:07 data structure 之間有關聯
  [[0, 2], [2, 3], [0, 1], [4, 0], [4, 2]].forEach(([a, b]) => line(DS[a][1], DS[a][2], DS[b][1], DS[b][2], -0.3, '#a8730f'));
  ms.forEach((m) => glow(m, GOLD)); await beat(tok, 900); ms.forEach((m) => glow(m, null));
  say('這些 data structure 之間也有關聯', '用 sorting 把它們串起來');
  await step(tok);                                   // 18:14 也當做半個 summary
  host.mood('happy'); await host.hop(tok);
  note('最後一堂課：sorting 也是半個 summary', 0, -0.3, 1.8);
  say('Sorting 也當作半個 summary', '');
}]);

// 19:58 Selection Sort 的想法：一群人還沒排好，叫最小的出來排隊
FRAG.push(['sortlin-selection-swap', 'Selection Sort：叫最小的出來排隊', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 1.4, 0.4]);
  await step(tok);                                   // 19:58 用一連串 sorting algorithm 複習
  const names = ['Selection', 'Heap', 'Bubble', 'Insertion', 'Shell', 'Merge', 'Tree', 'Quick'];
  const chips = names.map((n, k) => pkt(n, -5.6 + k * 1.6, 4.4, 0));
  say('用一連串 sorting algorithm 複習', '順便換幾個角度看它們');
  await step(tok);                                   // 20:30 第一個：selection sort
  chips.forEach((c, k) => { if (k) c.element.style.opacity = '0.3'; });
  say('課裡教的第一個：Selection Sort', '');
  await step(tok);                                   // 20:37 一群人還沒排好隊
  const vals = [5, 3, 8, 1, 6, 2], CX = [2.0, 3.6, 5.2, 2.6, 4.3, 5.8], CZ = [-1.2, -1.0, -1.3, 0.5, 0.4, 0.6];
  const ppl = vals.map((v, k) => ({ v, b: buddy('', v, colorFor(v), CX[k], 0, CZ[k], 0.55 + 0.05 * v) }));
  note('還沒排好（unsorted）', 3.9, 0.05, 1.8); note('排好的隊伍', -4.0, 0.05, 2.9);
  for (let k = 0; k < 6; k++) ctx.tile(V3(-5.6 + k * 1.2, 0.02, 1.9), 1.05, 1.0);
  say('一群人還沒排好隊', '想要從小排到大');
  await step(tok);                                   // 20:42 叫最小的出來去排隊
  const order = ppl.slice().sort((a, b) => a.v - b.v);
  order[0].b.glow(PINK); order[0].b.mood('happy');
  const call = bub('最小的出來！', -2.5, 2.6, 1.9);
  move(order[0].b.g, -5.6, 0, 1.9); await beat(tok, 1200); order[0].b.glow(null);
  say('叫最小的出來排隊', '1 站到隊伍第一個');
  await step(tok);                                   // 20:47 第二小、三小……一個一個出來
  txt(call, '下一個最小的！');
  for (let k = 1; k < 6; k++) { order[k].b.glow(PINK); move(order[k].b.g, -5.6 + k * 1.2, 0, 1.9); await beat(tok, 450); order[k].b.glow(null); order[k].b.mood('happy'); }
  say('再叫第二小、第三小……', '一個一個出來排隊');
  await step(tok);                                   // 20:56 從 unsorted 裡找最極端的
  kill(call);
  note('每輪：從 unsorted 裡選「最極端」的', -2.6, 2.7, 1.9);
  say('每次從 unsorted 裡找最極端的那個', '最小（或最大）');
}]);

// 21:12 Array 實作：前面排好、後面還沒；swap、rotate、linked list 的 insertion
FRAG.push(['sortlin-selection-rotate', 'Selection 的實作：swap、rotate、linked list', async (tok) => {
  fresh(LCAM, LLOOK);
  await step(tok);                                   // 21:12 array：前面幾格排好、後面幾格還沒
  let R = lRow([1, 2, 8, 9, 3, 6], { idx: true, dx: 1.3 });
  let zs = R.zone(null, GREEN, 0, 1), zu = R.zone(null, BLUE, 2, 5);
  const ls = note('排好的', (R.x(0) + R.x(1)) / 2, 1.8), lu = note('還沒排好', (R.x(2) + R.x(5)) / 2, 1.8);
  say('Array 裡：前面幾格當排好的', '後面幾格是還沒排好的');
  await step(tok);                                   // 21:30 從沒排好的裡面選一個
  for (let j = 2; j < 6; j++) { R.off(); R.hl([j], GOLD); await beat(tok, 420); }
  R.off(); R.hl([4], PINK);
  say('從還沒排好的裡選出最小的', '找到 3（桃紅）');
  await step(tok);                                   // 21:46 要換到排好隊的最後位置
  R.hl([2], GREEN); const dst = tag('目的地', 'ptr', 0, 0, 0); R.at(dst, 2, 1.0);
  say('它該去：排好區後面那一格', '綠 = 目的地');
  await step(tok);                                   // 21:52 跟那個位置交換
  await R.swap(tok, 2, 4, 1000); R.off();
  zs = R.zone(zs, GREEN, 0, 2); zu = R.zone(zu, BLUE, 3, 5); ls.position.x = R.x(1); lu.position.x = R.x(4);
  say('交換：3 換到正確位置', '原本的 8 被丟到後面');
  await step(tok);                                   // 21:59 一輪一輪過去
  R.at(dst, 3, 1.0);
  await selRound(tok, R, 3, { ms: 220, sw: 700 });
  zs = R.zone(zs, GREEN, 0, 3); zu = R.zone(zu, BLUE, 4, 5); ls.position.x = (R.x(0) + R.x(3)) / 2; lu.position.x = (R.x(4) + R.x(5)) / 2;
  say('一輪一輪做下去', 'sorted 區每輪多一格');
  await step(tok);                                   // 22:07 綠色 destination、桃紅色最小
  fresh(LCAM, LLOOK);
  const A = lRow([3, 8, 6, 1, 9], { y: 3.6, tiles: false, dx: 1.3 });
  const B = lRow([3, 8, 6, 1, 9], { y: 0.6, dx: 1.3 });
  const tA = tag('swap', 'ptr', -4.7, 3.6, 0); tag('rotate', 'ptr', -4.7, 0.6, 0);
  A.hl([0], GREEN); A.hl([3], PINK); B.hl([0], GREEN); B.hl([3], PINK);
  say('綠 = destination、桃紅 = 找到的最小', '兩種方式把 1 換到前面');
  await step(tok);                                   // 22:14 兩個做交換
  await A.swap(tok, 0, 3, 1100); A.off();
  const nA = note('[1, 8, 6, 3, 9]', 4.9, 3.6);
  say('Swap：兩個直接交換', '3 一下子跳到後面');
  await step(tok);                                   // 22:20 也可以用 rotate
  await B.rot(tok, 3, 0, 2400); B.off();
  const nB = note('[1, 3, 8, 6, 9]', 4.9, 0.6);
  say('Rotate：從後面一步一步換到前面', '3 8 6 各往後一格');
  await step(tok);                                   // 22:38 rotate 多花幾步，做的事差不多
  const h = helper(5.8, 2.2, '小幫手', 0.6); h.mood('calm');
  bub('多幾步而已', 5.8, 1.7, 2.2);
  say('Rotate 多花幾個交換', '大體上做的事情一樣');
  await step(tok);                                   // 22:52 linked list：用 insertion 取代 swap
  A.kill(); kill(tA); kill(nA);
  const L = [3, 8, 6, 1, 9].map((v, k) => ({ v, g: lnode(v, -3.9 + k * 1.95, 3.4, 0) }));
  const tL = tag('linked list', 'ptr', -6.0, 3.4, 0);
  glow(L[0].g.userData.data, GREEN); glow(L[3].g.userData.data, PINK);
  say('Linked list：用 insertion 取代 swap', '');
  await step(tok);                                   // 23:10 把粉紅色 insert 到綠色前面
  move(L[3].g, L[3].g.position.x, 4.9, 0); await beat(tok, 500);
  move(L[3].g, -3.9, 4.9, 0); [0, 1, 2].forEach((k) => move(L[k].g, -3.9 + (k + 1) * 1.95, 3.4, 0)); await beat(tok, 900);
  move(L[3].g, -3.9, 3.4, 0); await beat(tok, 500);
  say('把粉紅色（1）插到綠色（3）前面', '只要改指標');
  await step(tok);                                   // 23:21 等於把 unsorted 往後擠
  [0, 1, 2].forEach((k) => glow(L[k].g.userData.data, BLUE));
  note('3 8 6 順序沒變，只是往後擠', 0, 5.1, 0); kill(tL); h.mood('happy');
  say('等於把 unsorted 往後擠', '跟交換不一樣：其他人的順序不變');
}]);

// 23:41 Stable：先用 final project 排、再用總成績排，同分保持原順序
FRAG.push(['sortlin-stable-twokeys', 'Stable：總成績同分，保留 final project 的順序', async (tok) => {
  fresh([0, 6, 12], [0, 1.4, 0]);
  await step(tok);                                   // 23:41 有一個 additional 性質：stable
  const ttl = tag('Stable（穩定）', 'ptr', 0, 4.4, 0);
  say('插隊、往後擠的做法有個額外性質', '叫做 stable');
  await step(tok);                                   // 23:49 要排序的東西裡有很多一樣的值
  const recs = [{ n: 'A', t: 90, f: 80, c: '#4b9ee2' }, { n: 'B', t: 85, f: 95, c: '#2fc092' }, { n: 'C', t: 90, f: 88, c: '#e2a04b' }, { n: 'D', t: 85, f: 70, c: '#b07ad0' }];
  const X = (k) => -3.9 + k * 2.6;
  recs.forEach((r, k) => { r.b = buddy(r.n, r.t, r.c, X(k), 0, 0, 1.0); r.fp = tag('FP ' + r.f, 'idx', X(k), 0.05, 0.9); });
  const place = (order) => order.forEach((n, k) => { const r = recs.find((q) => q.n === n); move(r.b.g, X(k), 0, 0); r.fp.position.x = X(k); });
  say('要排序的東西裡，有好幾個一樣的 key', '肚子上的數字 = 總成績');
  await step(tok);                                   // 23:59 key 一樣，其他 data 不一定一樣
  recs[0].b.glow(GOLD); recs[2].b.glow(GOLD); recs[0].b.mood('wow'); recs[2].b.mood('wow');
  say('Key 一樣，其他資料不一定一樣', 'A、C 都 90 分，FP 不同');
  await step(tok);                                   // 24:08 相對關係不要有所變動
  recs[0].b.glow(null); recs[2].b.glow(null); recs[0].b.mood('calm'); recs[2].b.mood('calm');
  const n1 = note('同 key：相對順序不要變', 0, 2.9, 0);
  say('Key 一樣時，相對順序不要變', '');
  await step(tok);                                   // 24:21 兩個 key：總成績
  kill(n1);
  recs.forEach((r) => r.b.glow(BLUE));
  say('例：每筆資料有兩個 key', '第一個：總成績');
  await step(tok);                                   // 24:31 還有 final project 成績
  recs.forEach((r) => { r.b.glow(null); r.fp.element.className = 'lab-label pkt'; });
  say('第二個：final project（FP）成績', '');
  await step(tok);                                   // 24:41 先比總成績，同分再用 FP 分高下
  const goal = note('名次：總成績高的前面；同分 → FP 高的前面', 0, 3.0, 0);
  say('想要：先比總成績，同分再比 FP', '');
  await step(tok);                                   // 25:05 第一輪先用 FP 排
  recs.forEach((r) => { r.fp.element.className = 'lab-label ptr alt'; });
  place(['B', 'C', 'A', 'D']); await beat(tok, 1200);
  txt(goal, '第一輪：FP 95 > 88 > 80 > 70');
  say('第一輪：先用 FP 排', 'B、C、A、D');
  await step(tok);                                   // 25:14 第二輪用總成績排，同分順序不要變
  recs.forEach((r) => { r.fp.element.className = 'lab-label idx'; });
  place(['C', 'A', 'B', 'D']); await beat(tok, 1200);
  txt(goal, '第二輪：總成績 90、90、85、85（stable）');
  say('第二輪：用總成績排（stable）', 'C、A、B、D');
  await step(tok);                                   // 25:22 不擾亂第一輪排好的高下
  recs[2].b.glow(GOLD); recs[0].b.glow(GOLD); recs[1].b.glow(GREEN); recs[3].b.glow(GREEN);
  recs.forEach((r) => r.b.mood('happy'));
  txt(goal, 'C 仍在 A 前、B 仍在 D 前：FP 的高下保住了');
  say('同分的人保持第一輪的順序', 'stable = same-valued elements 不換位');
}]);

// 25:38 swap 版 selection 會把同值的順序弄亂；最小取 smallest index ＋ 用插入 → stable
FRAG.push(['sortlin-selection-unstable', 'Swap 版 Selection 不 stable，插入版 stable', async (tok) => {
  fresh(LCAM, LLOOK);
  await step(tok);                                   // 25:38 粉紅色跟綠色剛好 same valued
  const A = lRow(['2A', 3, '2B', 1], { y: 3.6, tiles: false, dx: 1.6 });
  const B = lRow(['2A', 3, '2B', 1], { y: 0.6, dx: 1.6 });
  tag('swap', 'ptr', -4.6, 3.6, 0); tag('插入', 'ptr', -4.6, 0.6, 0);
  A.hl([0, 2], GOLD); B.hl([0, 2], GOLD);
  say('2A、2B 是 same valued', '兩個 2，A 先來、B 後來');
  await step(tok);                                   // 25:44 找出最小的
  A.off(); B.off();
  for (let j = 1; j < 4; j++) { A.off(); A.hl([0], GREEN); A.hl([j], GOLD); await beat(tok, 380); }
  A.off(); A.hl([0], GREEN); A.hl([3], PINK);
  say('找到最小的 1（桃紅）', '目的地是 2A 的位置（綠）');
  await step(tok);                                   // 25:50 交換可能把順序打亂
  await A.swap(tok, 0, 3, 1200); A.off(); A.hl([2, 3], RED);
  const w = bad('2A 跳到 2B 後面了！', 4.9, 3.6);
  say('交換讓 2A 一下跳到 2B 後面', '順序被打亂');
  await step(tok);                                   // 25:56 要做 careful 的 implementation
  A.off(); kill(w);
  for (let i = 1; i < 3; i++) await selRound(tok, A, i, { ms: 150, sw: 600 });
  A.hl([1, 2], RED);
  const nA = note('結果：1 2B 2A 3', 4.9, 3.6);
  say('一路 swap 到底：2B 在 2A 前面', '要 stable 得小心實作');
  await step(tok);                                   // 26:15 同值時取 smallest index
  for (let j = 1; j < 4; j++) { B.off(); B.hl([0], GREEN); B.hl([j], GOLD); await beat(tok, 380); }
  B.off(); B.hl([3], PINK);
  say('改法一：找最小時，同值取 index 小的', '');
  await step(tok);                                   // 26:20 不要交換，用插入
  await B.rot(tok, 3, 0, 1800); B.off();
  say('改法二：不交換，用插入', '1 插到最前面，其他往後擠');
  await step(tok);                                   // 26:28 維持 stable
  await selRound(tok, B, 1, { ms: 130, rot: true, sw: 700 }); await selRound(tok, B, 2, { ms: 130, rot: true, sw: 700 });
  B.hl([1, 2], GREEN);
  good('結果：1 2A 2B 3', 4.9, 0.6);
  say('2A 仍在 2B 前面', '<span class="ok">stable</span>');
  await step(tok);                                   // 26:43 有些地方需要同值保持原順序
  B.off();
  note('有些需求：same value 要維持原順序', 0, 2.2, 0);
  say('以前沒講 stable：同值排哪都行', '但有些需求要維持原順序');
  await step(tok);                                   // 26:57 rotate 其實就是 insertion
  pkt('rotate ＝ insertion 的做法', 0, -0.4, 1.2);
  say('Rotate 其實就是 insertion', '不做 swap → 保留 stable');
  await step(tok);                                   // 27:10 一般 swap 的實作 → unstable
  txt(nA, 'swap 版：unstable');
  nA.element.className = 'lab-label bad';
  say('一般 swap 的 selection 不是 stable', '叫做 <span class="no">unstable</span>');
}]);

// 27:25 雙層 for loop → O(n²)；不用額外空間 → in-place
FRAG.push(['sortlin-selection-cost', 'Selection Sort：O(n²) 時間、in-place', async (tok) => {
  fresh([0, 7.5, 12.5], [0, 2.4, 0]);
  await step(tok);                                   // 27:25 時間複雜度
  const cd = code(['for i = 0 .. n-2:          // 外層：每個位置', '  m = i', '  for j = i+1 .. n-1:      // 內層：找最小', '    if a[j] < a[m]: m = j', '  swap(a[i], a[m])'], 0, 7.0, 0.5, -2.6);
  const R = lRow([4, 2, 5, 1, 3], { dx: 1.3, z: 1.4, idx: true });
  const cnt = { c: 0 };
  const cl = tag('比較 0 次', 'ptr alt', 4.9, 2.0, 1.4);
  say('先看時間複雜度', '大家已經很熟了');
  await step(tok);                                   // 27:32 雙層 for loop
  cd.hl(0); await beat(tok, 700); cd.hl(2);
  say('Selection sort 就是雙層 for loop', '');
  await step(tok);                                   // 27:38 內層找 minimum、外層掃每個 element
  cd.hl(2);
  await selRound(tok, R, 0, { ms: 300, sw: 700, cnt, onCmp: () => txt(cl, '比較 ' + cnt.c + ' 次') });
  say('內層找最小、外層掃過每個位置', 'i = 0：比較 4 次');
  await step(tok);                                   // 27:44 n 筆資料 → n²
  for (let i = 1; i < 4; i++) await selRound(tok, R, i, { ms: 110, sw: 450, cnt, onCmp: () => txt(cl, '比較 ' + cnt.c + ' 次') });
  cd.hl(-1); R.hl([0, 1, 2, 3, 4], GREEN);
  say('4 + 3 + 2 + 1 = 10 次', 'n(n−1)/2 → <span class="ok">O(n²)</span>');
  await step(tok);                                   // 27:54 空間複雜度：不需要額外空間
  R.off();
  const h = helper(-5.4, 1.4, '小幫手', 0.65);
  bub('要借額外的格子嗎？不用！', -4.6, 2.4, 1.4);
  say('再看空間複雜度', '排序的資料之外，不需要額外空間');
  await step(tok);                                   // 28:08 用原來的空間做操作
  for (let k = 0; k < 5; k++) { R.hl([k], GOLD); await beat(tok, 220); }
  say('就在原本的格子裡換來換去', 'Array 或 linked list 都一樣');
  await step(tok);                                   // 28:13 這叫 in-place
  R.off(); h.mood('happy');
  good('in-place：不需要額外空間', 0, 2.6, 1.4);
  say('不需要額外空間的演算法', '叫做 <span class="ok">in-place</span>');
  await step(tok);                                   // 28:24 in-place、stable、實作變化
  ['in-place', 'stable', '實作的變化'].forEach((t, k) => pkt(t, -3 + k * 3, 0.0, 2.9));
  say('今天多了幾個面向', 'in-place、stable、實作的變化');
}]);

// 29:04 Heap Sort：unsorted pile 換成 heap（max heap 放在原本的 array）
FRAG.push(['sortlin-heap-select', 'Heap Sort：unsorted pile 換成 Heap', async (tok) => {
  fresh([0, 7.5, 13], [0, 2.8, 0]);
  await step(tok);                                   // 29:04 第一次講到很快的 sorting
  const h = helper(-6.0, 1.6, '小幫手', 0.65);
  const ttl = tag('第一個很快的 sorting', 'ptr', 0, 6.6, 0);
  say('課裡第一次講到很快的 sorting', '');
  await step(tok);                                   // 29:11 selection 從 unsorted pile 選一個
  const PV = [3, 9, 1, 7, 5, 8, 6], PX = [-2.4, -0.6, 1.4, 3.0, -1.6, 0.5, 2.2], PZ = [-1.0, -1.4, -0.9, -1.2, 0.6, 0.9, 0.5];
  const M = {}; PV.forEach((v, k) => { M[v] = cube(v, colorFor(v), [0.8, 0.8, 0.8], PX[k], 0.5, PZ[k], 1.5); });
  const lp = note('unsorted pile', 0.3, 0.05, 2.0);
  say('Selection：從 unsorted pile 選一個出來', '');
  await step(tok);                                   // 29:23 要在裡面看半天才找到
  for (const v of PV) { glow(M[v], GOLD); await beat(tok, 260); glow(M[v], null); }
  glow(M[9], PINK); h.mood('sad');
  say('沒排好：每個都要看過才找得到', '看半天，有夠煩');
  await step(tok);                                   // 29:29 如果 pile 裡有一些結構
  glow(M[9], null); h.mood('calm');
  bub('如果 pile 有一點結構呢？', -5.2, 2.6, 1.6);
  say('還是 unsorted，但加上一些結構', '');
  await step(tok);                                   // 29:39 那個 pile 其實是一個 Heap
  const HV = [9, 7, 8, 3, 5, 6, 1], HP = [[0, 5.6], [-2.4, 4.3], [2.4, 4.3], [-3.6, 3.0], [-1.2, 3.0], [1.2, 3.0], [3.6, 3.0]];
  HV.forEach((v, k) => move(M[v], HP[k][0], HP[k][1], 0));
  for (let k = 1; k < 7; k++) { const p = (k - 1) >> 1; line(HP[p][0], HP[p][1], HP[k][0], HP[k][1], -0.1); }
  kill(lp); txt(ttl, 'unsorted pile → max Heap');
  say('Pile 換成一個 Heap', '');
  await step(tok);                                   // 29:56 資料結構的威力
  h.mood('wow');
  note('資料結構的威力', -5.2, 5.6, 0);
  say('這就是「資料結構的威力」', '');
  await step(tok);                                   // 30:05 老大壓在上面，比下面都大
  glow(M[9], RED);
  bub('老大在上面：比下面都大', 2.4, 6.4, 0);
  say('只加一點規則：上面比下面大', '每個 subtree 都這樣');
  await step(tok);                                   // 30:18 找最大就快很多
  move(M[9], 0, 6.5, 0); await beat(tok, 600); move(M[9], 0, 5.6, 0); await beat(tok, 500);
  h.mood('happy');
  say('找最大：看最上面就好', '不用看半天');
  await step(tok);                                   // 30:25 像有階層的團隊，找負責人很快
  bub('有階層的團隊：負責人一找就到', -4.4, 3.8, 0);
  say('像階層分明的團隊', '要找最主要的負責人很容易');
  await step(tok);                                   // 30:56 Heap 可以放在 array 裡：max Heap
  fresh([0, 7.5, 12.5], [0, 2, 0]);
  const R = lRow(HV, { idx: true, dx: 1.25 });
  const n = R.v.length;
  let zh = R.zone(null, BLUE, 0, n - 1), zs = null;
  const lh = note('Heap 區', 0, 1.8, 0), ls = note('sorted', 0, 1.8, 0); ls.element.style.visibility = 'hidden';
  const lbl = (k) => { lh.position.x = (R.x(0) + R.x(Math.max(0, k))) / 2; if (k < n - 1) { ls.element.style.visibility = ''; ls.position.x = (R.x(k + 1) + R.x(n - 1)) / 2; } };
  note('a[i] 的孩子：a[2i+1]、a[2i+2]', 0, 3.6, 0);
  say('Heap 可以直接放在 array 裡', '用 max Heap：a[0] 最大');
  const round = async (k, ms) => {
    R.off(); R.hl([0], RED); await beat(tok, ms * 0.4);
    await R.swap(tok, 0, k, ms);
    zh = R.zone(zh, BLUE, 0, k - 1); zs = R.zone(zs, GREEN, k, n - 1); lbl(k - 1);
    let i = 0;
    while (2 * i + 1 < k) {
      const l = 2 * i + 1, r = l + 1; let c = l; if (r < k && R.v[r] > R.v[l]) c = r;
      R.off(); R.hl([i], GOLD); R.hl(r < k ? [l, r] : [l], BLUE); await beat(tok, ms * 0.35);
      if (R.v[c] <= R.v[i]) break;
      await R.swap(tok, i, c, ms * 0.8); i = c;
    }
    R.off();
  };
  await step(tok);                                   // 31:07 最大的一路往 array 後面塞
  await round(6, 700);
  say('最大的換到 array 最後面', '換上來的往下沉，Heap 修好');
  await step(tok);                                   // 31:13 前面是 Heap 區，後面是 sorted
  await round(5, 550);
  say('前面是 Heap 區（還沒排好）', '後面是 sorted 區');
  await step(tok);                                   // 31:33 後面放好最大、第二大、第三大……
  await round(4, 420); await round(3, 420);
  say('後面依序是最大、第二大、第三大……', '');
  await step(tok);                                   // 31:41 Heap 放在原本的 array：不用額外空間
  await round(2, 420); await round(1, 420);
  zh = R.zone(zh, BLUE, 0, -1); zs = R.zone(zs, GREEN, 0, n - 1); lh.element.style.visibility = 'hidden'; ls.position.x = 0;
  good('in-place：不用額外空間', -3.8, 3.0, 0);
  say('Heap 就放在原本的 array', '不需要額外空間');
  await step(tok);                                   // 31:52 每次找最大 log n → n log n
  good('每次 O(log n) × n 次 = O(n log n)', 3.2, 3.0, 0);
  say('找最大只要 O(log n)', '總共 <span class="ok">O(n log n)</span>，比 n² 好');
}]);

// 32:13 Heap Sort 的缺點：不 stable、難寫（模組內建「stability」的 cued 版本）
FRAG.push(['sortlin-heap-unstable', 'Heap Sort 的缺點：不 stable、難寫', async (tok) => {
  await step(tok);                                   // 32:13 上浮、下沉時很難顧到原本的位置
  stab.algo = 'heap'; stab.vals = heapUnstableVals(); enterStab(false); controls('');
  say('同值標成 A、B：Heap Sort 會不會弄反？', '上浮、下沉一直在換位置');
  await runTo(tok, Math.floor(lastStep() * 0.55), 2600);
  await step(tok);                                   // 32:23 key 相同時尊重原本的位置關係？
  await runTo(tok, lastStep(), 2600);
  const w = bad('同值的 A、B 被弄反了', -3.2, 3.6, 1.2);
  say('Key 一樣的 A、B 被弄反了', '很難顧到原本的位置關係');
  await step(tok);                                   // 32:40 把原本的位置當 secondary key
  kill(w);
  const n1 = note('(值, 原本位置) 一起比：secondary key', -3.0, 3.6, 1.2);
  say('把原本的位置當 secondary key', '這樣可以做到 stable');
  await step(tok);                                   // 32:53 但要花額外空間
  const n2 = bad('每筆多存一個位置 → 額外空間', 3.0, 3.6, 1.2);
  say('但要多存原本位置', '得花額外空間');
  await step(tok);                                   // 33:01 通常不被看成 stable
  kill(n1); kill(n2);
  const n3 = bad('Heap Sort：通常算 unstable', 0, 4.2, 1.2);
  say('所以 Heap Sort 通常不算 stable', '');
  await step(tok);                                   // 33:26 比 selection sort 快
  kill(n3);
  good('比 Selection 快：O(n log n) vs O(n²)', 0, 4.2, 1.2);
  say('優點：比 Selection Sort 快', '');
  await step(tok);                                   // 33:32 但比較難寫
  const h = helper(-5.0, 1.8, '寫程式的人', 0.7);
  const b1 = bub('白板寫 Selection：3～5 分鐘 ✓', -3.4, 3.2, 1.8);
  say('缺點：比較難寫', 'Selection 白板 3～5 分鐘寫得完');
  await step(tok);                                   // 33:43 Heap Sort 5 分鐘寫出來不容易
  kill(b1); h.mood('sad');
  bub('Heap Sort 5 分鐘寫完？不容易…', -3.4, 3.2, 1.8);
  say('白板 5 分鐘寫出 Heap Sort', '不是那麼容易');
  await step(tok);                                   // 33:57 有沒有 library 可用
  h.mood('happy');
  note('有 library 可以用 → 平常好用', 3.4, 2.6, 1.8);
  say('有沒有 library 可用', '決定它平常好不好用');
}]);

// 36:21 Bubble Sort：只跟隔壁比高矮（小朋友排隊）
FRAG.push(['sortlin-bubble-pass', 'Bubble Sort：只跟隔壁比高矮', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 1.4, 0]);
  await step(tok);                                   // 36:21 sorting 界有名的 bubble sort
  const R = lRow([5, 1, 4, 2, 8], { kids: true, idx: true, dx: 1.5 });
  const n = R.v.length; let zone = null;
  tag('Bubble Sort', 'ptr', 0, 4.2, 0);
  say('Sorting 界非常有名的 bubble sort', '');
  await step(tok);                                   // 36:43 用迴圈一直跑過所有資料
  const sw = pkt('掃過去 →', 0, 0, 0);
  await travel(tok, sw, V3(R.x(0), 3.2, 0), V3(R.x(n - 1), 3.2, 0), 1800);
  kill(sw);
  say('用迴圈一直跑過所有資料', '每次只看旁邊的兩筆');
  await step(tok);                                   // 37:03 先看第一筆跟第二筆
  R.hl([0, 1], GOLD); await beat(tok, 500);
  R.hl([0, 1], RED); mood(R.m[0], 'wow'); await R.swap(tok, 0, 1, 900); R.off(); mood(R.m[1], 'calm');
  say('先看第 1、2 筆：大小對不對？', '5 > 1 → 換');
  await step(tok);                                   // 37:09 再看第二筆跟第三筆……
  for (let k = 1; k < n - 1; k++) {
    R.off(); R.hl([k, k + 1], GOLD); await beat(tok, 380);
    if (R.v[k] > R.v[k + 1]) { R.hl([k, k + 1], RED); await R.swap(tok, k, k + 1, 600); }
  }
  R.off(); zone = R.zone(zone, GREEN, n - 1, n - 1);
  say('再看第 2、3 筆，第 3、4 筆……', '');
  await step(tok);                                   // 37:17 整個掃過去叫一輪，再掃第二輪
  const pl = pkt('第 1 輪做完', R.x(n - 1), 2.9, 0);
  await bubblePass(tok, R, 0, n - 2, 1, { ms: 330 });
  zone = R.zone(zone, GREEN, n - 2, n - 1); txt(pl, '第 2 輪'); pl.position.x = R.x(n - 2);
  say('整個掃過去叫一輪', '再掃一次：第二輪');
  await step(tok);                                   // 37:27 三輪、四輪……n 輪之後排好
  await bubblePass(tok, R, 0, n - 3, 1, { ms: 260 }); await bubblePass(tok, R, 0, n - 4, 1, { ms: 260 });
  zone = R.zone(zone, GREEN, 0, n - 1); kill(pl);
  say('三輪、四輪……', '最多掃 n − 1 輪就排好了');
  await step(tok);                                   // 37:36 沒有 disordered pair
  R.m.forEach((m) => mood(m, 'happy'));
  good('沒有大的在前、小的在後', 0, 3.4, 0);
  say('排好 = 沒有 disordered pair', '大的在前、小的在後的那種');
  await step(tok);                                   // 37:45 每次都做 local 的微調
  note('只跟隔壁比：local 的微調', 0, -0.5, 1.6);
  say('每次只做 local 的微調', '很人性的演算法');
  await step(tok);                                   // 38:02 小學生排隊時老師會用這方法
  const t = helper(-6.0, 1.6, '老師', 0.8);
  bub('你比較高，跟他換一下！', -4.6, 2.9, 1.6);
  say('像小學生第一次排隊', '老師：你比較高一點，換過來');
  await step(tok);                                   // 38:21 抓兩個人出來比很難，跟隔壁比容易
  arrow(V3(R.x(0), 2.6, 0.4), V3(R.x(4), 2.6, 0.4), 0x7a1010);
  bad('抓兩個人出來比：難', 3.0, 3.3, 0.4);
  good('跟隔壁比高矮：容易', 3.0, -0.2, 1.6);
  t.mood('happy');
  say('抓兩個人出來比大小很難', '跟隔壁比高矮很容易');
}]);

// 38:39 Bubble：in-place、最多 n 輪；一樣高就不換 → stable；selection 的 swap 跳很遠所以難 stable
FRAG.push(['sortlin-bubble-stable', 'Bubble Sort：一樣高就不換 → stable', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 1.4, 0]);
  await step(tok);                                   // 38:39 空間：不需要額外空間
  const R = lRow(['3A', 1, '3B', 2], { kids: true, idx: true, dx: 1.7 });
  const h = helper(-5.8, 1.6, '小幫手', 0.6);
  good('只跟旁邊換位置：不用額外空間', 0, 3.6, 0);
  say('空間：不需要額外空間', '只是跟旁邊的人換位置');
  await step(tok);                                   // 38:45 時間：最多掃 n 輪
  note('時間：最多掃 n − 1 輪 → O(n²)', 0, -0.5, 1.6);
  say('時間：最多掃 n − 1 輪（老師說 n 輪）', '每輪讓一個最大的歸位 → O(n²)');
  await step(tok);                                   // 39:04 很容易做到 stable
  R.hl([0, 1], GOLD); await beat(tok, 450); R.hl([0, 1], RED); await R.swap(tok, 0, 1, 900); R.off();
  say('它很容易做到 stable', '先看 3A 和 1：換');
  await step(tok);                                   // 39:12 一樣高就不要換
  R.hl([1, 2], GOLD); mood(R.m[1], 'wow'); mood(R.m[2], 'wow');
  const eq = bub('一樣高：不換！', R.x(1.5), 3.4, 0);
  await beat(tok, 1300); R.off(); mood(R.m[1], 'happy'); mood(R.m[2], 'happy');
  R.hl([2, 3], GOLD); await beat(tok, 300); R.hl([2, 3], RED); await R.swap(tok, 2, 3, 800); R.off();
  say('3A、3B 一樣高就不要換', '維持原來的位置關係');
  await step(tok);                                   // 39:17 neighbor 交換都很容易 stable
  kill(eq);
  await bubblePass(tok, R, 0, 2, 1, { ms: 300 }); await bubblePass(tok, R, 0, 1, 1, { ms: 300 });
  R.hl([2, 3], GREEN); h.mood('happy');
  good('3A 仍在 3B 前面：stable', 0, 4.4, 0);
  say('Neighbor 交換的方法都很容易 stable', '只要沒跟很遠的人換');
  await step(tok);                                   // 39:40 selection 為什麼做不到：跳很遠
  R.off();
  const S2 = lRow(['2A', 3, '2B', 1], { y: 0.5, z: -2.6, tiles: false, dx: 1.7 });
  tag('Selection 的 swap', 'ptr', -4.9, 0.5, -2.6);
  S2.hl([0], GREEN); S2.hl([3], PINK);
  say('Selection 為什麼做不到 stable？', '它的 swap 要跳很遠');
  await step(tok);                                   // 39:53 換到六步以外的地方
  await S2.swap(tok, 0, 3, 1400); S2.off(); S2.hl([2, 3], RED);
  h.mood('sad');
  say('一跳好幾格，中間的同值被跨過', '2A 跑到 2B 後面');
  await step(tok);                                   // 40:07 要 stable 要做 neighbor 附近的檢查
  h.mood('calm');
  note('要 stable：檢查 neighbor 附近', 0, 2.4, -2.6);
  say('要做到 stable', '得做 neighbor 附近的檢查');
}]);

// 40:25 Adaptive：差不多排好時花很少力氣；一輪沒交換就 early stop
FRAG.push(['sortlin-bubble-adaptive', 'Bubble Sort 的 adaptive：沒交換就提早停', async (tok) => {
  fresh(LCAM, LLOOK);
  await step(tok);                                   // 40:25 新特性：adaptive
  const R = lRow([1, 3, 2, 4, 5, 7, 6, 8], { idx: true, dx: 1.1 });
  const n = R.v.length; const cnt = { c: 0 }; let swaps = 0;
  const h = helper(-6.0, 1.6, '小幫手', 0.6);
  tag('Adaptive', 'ptr', 0, 4.4, 0);
  say('新特性：adaptive', '已經差不多排好的 array');
  await step(tok);                                   // 40:35 只需要花很少很少的力氣
  note('原本排得越好 → 花的力氣越少', 0, 3.4, 0);
  say('差不多排好時', '只要花很少很少的力氣');
  await step(tok);                                   // 40:52 Heap Sort 不管怎樣都先重做一個 Heap
  const hb = bad('Heap Sort：不管好壞，先重做一個 Heap', 0, -0.4, 1.6);
  h.mood('sad');
  say('對照 Heap Sort', '不管原本好不好，都先重做一個 Heap');
  await step(tok);                                   // 41:04 bubble：鄰居反了的很少
  kill(hb); h.mood('calm');
  R.hl([1, 2, 5, 6], RED);
  say('Bubble：差不多排好 → 反了的鄰居很少', '只要少數交換');
  await step(tok);                                   // 41:35 一輪都沒違反 → 下一輪不用掃
  R.off();
  const rule = pkt('一輪都沒換 → 停！', 0, 2.6, 0);
  say('某一輪掃過去都沒發現違反', '下一輪就不用掃');
  await step(tok);                                   // 41:58 只有兩組鄰居反了，第一輪修好
  const cl = tag('比較 0、交換 0', 'ptr alt', 4.8, 2.2, 0);
  const upd = () => txt(cl, '比較 ' + cnt.c + '、交換 ' + swaps);
  await bubblePass(tok, R, 0, n - 1, 1, { ms: 200, cnt, onSwap: () => { swaps++; upd(); } }); upd();
  say('第一輪：把那兩組換回來', '3,2 和 7,6');
  await step(tok);                                   // 42:02 第二輪沒換 → 第三輪不用做（early stop）
  await bubblePass(tok, R, 0, n - 2, 1, { ms: 180, cnt }); upd();
  R.hl([0, 1, 2, 3, 4, 5, 6, 7], GREEN); h.mood('happy');
  txt(rule, '第 2 輪沒換 → early stop');
  say('第二輪沒交換：第三輪起不用做', 'early stop ＝ <span class="ok">adaptive</span>');
}]);

// 42:11 磁帶：讀取頭捲一點就能換鄰居；跟 10 格外的換要捲很遠
FRAG.push(['sortlin-tape', '磁帶上的排序：鄰居交換便宜', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 1.4, 0]);
  await step(tok);                                   // 42:11 磁帶
  const R = lRow([4, 9, 2, 7, 5, 6, 1, 8, 3, 10, 12, 11], { dx: 0.95, sz: 0.68 });
  const strip = ghostBox('#6e5f49', 11.6, 0.1, 1.1); strip.position.set(0, 0.05, 0);
  tag('磁帶', 'ptr', 0, 3.6, 0);
  say('磁帶：存資料用的一長條帶子', '長得有點像錄音帶');
  await step(tok);                                   // 42:27 想成捲筒衛生紙
  const roll = (x) => { const m = new ctx.THREE.Mesh(new ctx.THREE.CylinderGeometry(0.7, 0.7, 1.3, 24), new ctx.THREE.MeshStandardMaterial({ color: '#f4f0e6', roughness: 0.9 })); m.rotation.x = Math.PI / 2; m.position.set(x, 0.75, 0); lab.world.add(m); return m; };
  roll(-6.4); roll(6.4);
  bub('像捲筒衛生紙，只是用來存資料', 0, 2.9, 0);
  say('想成捲筒衛生紙', '一捲一捲的');
  await step(tok);                                   // 42:41 讀取頭：捲到那裡才能讀
  const head = ghostBox('#c08a20', 0.9, 1.4, 1.3); const hl = tag('讀取頭', 'ptr alt', 0, 1.9, 0);
  const put = (x) => { head.position.set(x, 0.6, 0); hl.position.set(x, 1.9, 0); };
  let pos = 4, roll2 = 0; put(R.x(pos));
  const rl = tag('捲動 0 格', 'note', 4.4, 3.6, 0);
  const goTo = async (k, ms) => { const a = R.x(pos), b = R.x(k), d = Math.abs(k - pos); await anim(tok, ms, (t) => put(a + (b - a) * t)); roll2 += d; pos = k; txt(rl, '捲動 ' + roll2 + ' 格'); };
  say('有一個讀取頭', '紙捲到讀取頭那邊才讀得到');
  await step(tok);                                   // 42:57 附近的資料做交換很容易
  R.hl([4, 5], GOLD); await goTo(5, 500); await R.swap(tok, 4, 5, 900); R.off();
  say('換鄰居：5 和 6', '捲 1 格就讀到兩筆，很便宜');
  await step(tok);                                   // 43:14 跟 10 步以外的交換：捲 10 步
  roll2 = 0; txt(rl, '捲動 0 格');
  R.hl([1, 10], GOLD); await goTo(1, 700); await goTo(10, 1500);
  say('換 9 和 12：差了 9 格', '要捲過去才讀得到');
  await step(tok);                                   // 43:21 再捲回來：移動距離很大
  await R.swap(tok, 1, 10, 900); await goTo(1, 1400); R.off();
  say('換完還要捲回來', '一次遠距交換捲了 ' + roll2 + ' 格');
  await step(tok);                                   // 43:31 這種情境下 bubble sort 比較好用
  good('鄰居交換便宜 → Bubble Sort 好用', 0, 4.4, 0);
  say('在這種媒體上', 'Bubble 這種鄰居交換比較好用');
  await step(tok);                                   // 43:57 「bubble sort 沒人在用」
  const h = helper(-5.8, 2.4, '小幫手', 0.6);
  const b1 = bub('Bubble Sort 沒人在用？', -4.4, 3.6, 2.4); h.mood('wow');
  say('有人說 bubble sort 沒人在用', '在現在的架構下，確實大多不適用');
  await step(tok);                                   // 44:13 曾經有用；未來也許會有新媒體
  txt(b1, '曾經有用；未來也許又有用');
  h.mood('happy');
  say('它曾經有用', '未來也許會有新的儲存媒體');
  await step(tok);                                   // 45:02 特性：neighbor swapping → adaptive
  pkt('neighbor swapping → adaptive', 0, -0.4, 1.4);
  say('重點是知道它的特性', 'neighbor swapping 帶來 adaptive');
  await step(tok);                                   // 45:20 差不多排好的 linked list、鄰居運算便宜的媒體
  note('適用：差不多排好的 linked list、鄰居便宜的媒體', 0, -1.3, 2.2);
  say('適用：差不多排好的 linked list', '或鄰居運算比較便宜的儲存媒體');
}]);

// 45:46 Insertion Sort：玩撲克牌——手上一疊排好的，摸一張插到對的位置
FRAG.push(['sortlin-insert-cards', 'Insertion Sort：摸一張牌，插到對的位置', async (tok) => {
  fresh([0, 6, 12], [0, 1.6, 0]);
  await step(tok);                                   // 45:46 insertion sort
  const p = helper(-6.0, 1.8, '玩家', 0.8);
  tag('Insertion Sort', 'ptr', 0, 4.4, 0);
  say('另一個要深化了解的：insertion sort', '');
  await step(tok);                                   // 45:53 對應的現實情境：玩撲克牌
  const CW = [0.8, 1.2, 0.25], X = (k) => -4.4 + k * 1.15, HY = 0.8;
  const hand = [3, 7].map((v, k) => ({ v, m: cube(v, '#fffaf0', CW, X(k), HY, 0, 1.2) }));
  const pile = [5, 9, 2].map((v, k) => ({ v, m: cube(v, '#fffaf0', CW, 2.6 + k * 1.15, HY, 0, 1.2) }));
  say('現實的情境：玩撲克牌', '');
  await step(tok);                                   // 46:17 大老二：手上的牌由小排到大
  hand.concat(pile).forEach((c) => tint(c.m, colorFor(c.v)));
  say('像玩大老二', '要把手上的牌由小排到大');
  await step(tok);                                   // 46:23 也可以做 selection：用眼睛找最小的
  glow(pile[2].m, PINK); const b1 = bub('先找最小的？那是 selection', 3.75, 2.7, 0);
  say('可以做 selection：看哪張最小', '再看第二小、第三小……');
  await step(tok);                                   // 46:35 另一種人：手上已經排好
  glow(pile[2].m, null); kill(b1);
  const lh = note('手上：sorted pile', -3.85, 2.3, 0);
  hand.forEach((c) => glow(c.m, GREEN)); await beat(tok, 900); hand.forEach((c) => glow(c.m, null));
  say('另一種人：手上已經拿好排好的牌', '');
  const ins = async (c) => {
    glow(c.m, GOLD); move(c.m, c.m.position.x, 3.0, 0); await beat(tok, 700);
    let k = hand.length; while (k > 0 && hand[k - 1].v > c.v) k--;
    if (k > 0) glow(hand[k - 1].m, BLUE); if (k < hand.length) glow(hand[k].m, BLUE);
    move(c.m, X(k), 3.0, 0); await beat(tok, 700);
    for (let q = hand.length - 1; q >= k; q--) move(hand[q].m, X(q + 1), HY, 0);
    await beat(tok, 400);
    move(c.m, X(k), HY, 0); hand.splice(k, 0, c); await beat(tok, 500);
    hand.forEach((h) => glow(h.m, null));
    return k;
  };
  await step(tok);                                   // 46:41 摸一張起來插到正確的地方
  await ins(pile.shift()); p.mood('happy');
  say('摸一張 5 起來', '插到 3 和 7 之間');
  await step(tok);                                   // 46:47 手上維持 sorted pile，從 unsorted pile 拿
  note('桌上：unsorted pile', 3.75, 2.3, 0);
  say('手上一直維持 sorted pile', '從 unsorted pile 拿牌');
  await step(tok);                                   // 46:54 隨便選一張，不是選最小的
  await ins(pile.shift());
  say('隨便拿一張：9', '不用挑最小的');
  await step(tok);                                   // 47:05 放到正確的位置
  await ins(pile.shift()); p.mood('happy'); await p.hop(tok);
  txt(lh, '手上：2 3 5 7 9');
  say('拿到的 2 放到最前面', '每張都放到正確的位置');
}]);

// 47:13 Insertion 的各種實作：sequential / binary search；skip list；linked list O(1)、array 要往後擠
FRAG.push(['sortlin-insert-search', 'Insertion 的實作：怎麼找位置、怎麼插', async (tok) => {
  fresh(LCAM, LLOOK);
  await step(tok);                                   // 47:13 各式各樣不同的 implementation
  const R = lRow([2, 4, 5, 7, 9, 11, null], { idx: true, dx: 1.2 });
  const key = cube(8, colorFor(8), [0.78, 0.78, 0.78], 5.6, 3.4, 0);
  const cl = tag('', 'ptr alt', 0, 3.6, 0);
  say('要把 8 放進排好的 2 4 5 7 9 11', '各種不同的實作');
  await step(tok);                                   // 47:24 sequential search 找插入位置
  for (let j = 0; j < 5; j++) { R.off(); R.hl([j], j === 4 ? RED : GOLD); txt(cl, '比較 ' + (j + 1) + ' 次'); await beat(tok, 450); }
  say('最簡單：sequential search', '一個一個看，9 > 8：位置在 a[4]');
  await step(tok);                                   // 47:35 sorted pile 是 array → binary search
  R.off(); txt(cl, '');
  const lo = tag('lo', 'ptr', 0, 0, 0), hi = tag('hi', 'ptr', 0, 0, 0), md = tag('mid', 'ptr alt', 0, 0, 0);
  let L = 0, H = 5, c = 0;
  while (L <= H) {
    const M = (L + H) >> 1; c++;
    R.at(lo, L, 1.3); R.at(hi, H, 1.9); R.at(md, M, 2.5); R.off(); R.hl([M], GOLD); txt(cl, '比較 ' + c + ' 次');
    await beat(tok, 700);
    if (R.v[M] < 8) L = M + 1; else H = M - 1;
  }
  [lo, hi, md].forEach(kill); R.off();
  say('Array 可以做 binary search', '只比 ' + c + ' 次就找到 a[4]');
  await step(tok);                                   // 47:51 skip list：找快插也快，但 overkill
  const exp = ghostBox('#c08a20', 7.4, 0.1, 0.5); exp.position.set(-0.6, 1.6, -1.0);
  [0, 2, 4].forEach((k) => cube(R.v[k], colorFor(R.v[k]), [0.5, 0.5, 0.5], R.x(k), 1.9, -1.0));
  tag('skip list：快車道', 'ptr', -5.0, 1.9, -1.0);
  bad('要額外空間 → overkill', 3.6, 2.6, -1.0);
  say('也可以用 skip list：找、插都快', '但要額外空間，有點 overkill');
  await step(tok);                                   // 48:14 linked list：插入 constant time
  const n1 = note('Linked list：找到位置後，改一下指標 O(1)', 0, 4.6, 0);
  say('Linked list：插入只要 constant time', '只是小紙條（指標）改一下');
  await step(tok);                                   // 48:28 array：插入要花 n，把其他人往後擠
  for (let k = 5; k >= 4; k--) { move(R.m[k], R.x(k + 1), R.y, 0); R.m[k + 1] = R.m[k]; R.v[k + 1] = R.v[k]; await beat(tok, 600); }
  move(key, R.x(4), 0.5, 0); R.m[4] = key; R.v[4] = 8; await beat(tok, 900);
  txt(n1, 'Array：後面的人往後擠 → O(n)');
  say('Array：插入要把後面往後擠', '11、9 各往後一格 → 花 n 的時間');
}]);

// 48:36 從前面找 vs 從後面找：遇到同值時，backward 自然 stable
FRAG.push(['sortlin-insert-forward-backward', 'Insertion：從前找 vs 從後找（stable）', async (tok) => {
  fresh(LCAM, LLOOK);
  await step(tok);                                   // 48:36 從前面找插入位置
  const A = lRow([1, '3A', 5, '3B'], { y: 3.6, tiles: false, dx: 1.6 });
  const B = lRow([1, '3A', 5, '3B'], { y: 0.6, dx: 1.6 });
  tag('從前面找', 'ptr', -4.8, 3.6, 0); tag('從後面找', 'ptr', -4.8, 0.6, 0);
  A.hl([3], GOLD);
  for (let j = 0; j < 2; j++) { gl(A.m[j], BLUE); await beat(tok, 600); gl(A.m[j], null); }
  A.hl([1], RED);
  say('要插入 3B（前三張已排好）', '一種從前面找：碰到 ≥ 3 就停');
  await step(tok);                                   // 48:43 從後面開始找
  B.hl([3], GOLD);
  for (const j of [2, 1]) { gl(B.m[j], BLUE); await beat(tok, 600); gl(B.m[j], null); }
  B.hl([1], GREEN);
  say('一種從後面找：比 3B 大的才讓位', '碰到 3A 就停');
  await step(tok);                                   // 48:50 兩個在 stable 上不太一樣
  note('同一個演算法，stable 不一樣', 0, 2.2, 0);
  say('兩種做法在 stable 上不一樣', '');
  await step(tok);                                   // 48:59 從後面找到的位置比較 stable
  B.off(); await insRound(tok, B, 3, { ms: 500 }); B.hl([1, 2], GREEN);
  good('[1, 3A, 3B, 5]', 5.0, 0.6);
  say('從後面找：3B 排在 3A 後面', '<span class="ok">stable</span>');
  await step(tok);                                   // 49:08 從前面找：碰到同值就跳到它前面
  A.off(); await A.rot(tok, 3, 1, 1700); A.hl([1, 2], RED);
  bad('[1, 3B, 3A, 5]', 5.0, 3.6);
  say('從前面找：3B 跳到 3A 前面', '<span class="no">不見得 stable</span>');
}]);

// 49:18 Gnome Sort（小精靈排序）：用鄰居交換把一個元素滾到正確位置
async function gnomeRoll(tok, R, gm, i, ms) {
  let pos = i;
  gm.g.position.x = R.x(pos);
  while (pos > 0 && nOf(R.v[pos - 1]) > nOf(R.v[pos])) {
    R.off(); R.hl([pos - 1, pos], RED); move(gm.g, R.x(pos), 0, 1.7);
    await R.swap(tok, pos - 1, pos, ms); pos--;
  }
  R.off(); if (pos > 0) R.hl([pos - 1, pos], GREEN); move(gm.g, R.x(pos), 0, 1.7);
  await beat(tok, 300); R.off();
}
FRAG.push(['sortlin-gnome', 'Gnome Sort：小精靈把牌一路滾回去', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 1.4, 0.4]);
  await step(tok);                                   // 49:18 selection、bubble 都講到鄰居交換
  const R = lRow([3, 6, 8, 4, 2], { idx: true, dx: 1.4 });
  let z = R.zone(null, GREEN, 0, 2);
  note('Bubble：neighbor swap', -3, 3.2, 0);
  say('Bubble sort 講到 neighbor swap', 'Insertion 也可以嗎？');
  await step(tok);                                   // 49:26 insertion 可以用鄰居交換來做
  R.hl([3], GOLD);
  say('Insertion 也可以用鄰居交換來做', '只要放到正確位置就好');
  await step(tok);                                   // 49:36 Gnome sort（小精靈排序）
  const gm = buddy('小精靈', '', '#9fd18b', R.x(3), 0, 1.7, 0.55);
  say('可愛的名字：Gnome sort', '小精靈排序');
  await step(tok);                                   // 49:43 咚咚咚，把它滾到正確的位置
  await gnomeRoll(tok, R, gm, 3, 650); z = R.zone(z, GREEN, 0, 3); gm.mood('happy');
  say('咚咚咚：跟左邊鄰居換，一路滾回去', '4 滾到 3 和 6 之間');
  await step(tok);                                   // 49:50 滾到 sorted pile 裡正確的位置
  await gnomeRoll(tok, R, gm, 4, 520); z = R.zone(z, GREEN, 0, 4); await gm.hop(tok);
  say('不一定是最小的', '但會滾到 sorted pile 裡正確的位置');
}]);

// 49:59 Selection 把力氣花在「選」，Insertion 把力氣花在「放」
FRAG.push(['sortlin-select-vs-insert', 'Selection vs Insertion：力氣花在選還是放', async (tok) => {
  fresh(LCAM, LLOOK);
  await step(tok);                                   // 49:59 跟 bubble、selection 有類似的 flavor
  const A = lRow([4, 1, 3, 5, 2], { y: 3.6, tiles: false, dx: 1.3 });
  const B = lRow([4, 1, 3, 5, 2], { y: 0.6, dx: 1.3 });
  tag('Selection', 'ptr', -4.9, 3.6, 0); tag('Insertion', 'ptr', -4.9, 0.6, 0);
  const ca = { c: 0 }, cb = { c: 0 };
  const la = tag('選：比較 0 次', 'ptr alt', 4.9, 4.6, 0), lb = tag('放：比較 0 次', 'ptr alt', 4.9, 1.6, 0);
  say('Insertion 跟 selection 有類似的 flavor', '但做的事不一樣');
  await step(tok);                                   // 50:11 隨便選出來，然後找要放到哪裡
  for (let i = 1; i < 3; i++) await insRound(tok, B, i, { ms: 240, cnt: cb, hk: () => txt(lb, '放：比較 ' + cb.c + ' 次') });
  say('Insertion：拿下一張就好', '然後找它要放哪裡');
  await step(tok);                                   // 50:21 力氣都花在「放到哪裡」
  for (let i = 3; i < 5; i++) await insRound(tok, B, i, { ms: 200, cnt: cb, hk: () => txt(lb, '放：比較 ' + cb.c + ' 次') });
  B.hl([0, 1, 2, 3, 4], GREEN);
  say('力氣都花在：放到哪裡', '找位置 + 往後挪');
  await step(tok);                                   // 50:28 selection：選最小的，選的時候多花時間
  for (let i = 0; i < 2; i++) await selRound(tok, A, i, { ms: 150, sw: 550, cnt: ca, onCmp: () => txt(la, '選：比較 ' + ca.c + ' 次') });
  say('Selection：選最小的那個', '選的時候要多花時間');
  await step(tok);                                   // 50:33 要放到哪裡很確定
  for (let i = 2; i < 4; i++) await selRound(tok, A, i, { ms: 150, sw: 550, cnt: ca, onCmp: () => txt(la, '選：比較 ' + ca.c + ' 次') });
  A.hl([0, 1, 2, 3, 4], GREEN);
  say('放到哪裡很確定', '就是 sorted 區的下一格');
  await step(tok);                                   // 50:41 力氣花在選最極端的，還是幫它找位置
  A.off(); B.off();
  note('選最極端的？還是隨便選、幫它找位置？', 0, 2.3, 0);
  say('力氣要花在選最極端的', '還是隨便選、但幫它找位置');
  await step(tok);                                   // 50:48 一樣可以 reuse 原本的空間
  good('都 reuse 原本的空間（in-place）', -2.6, -0.4, 1.4);
  say('跟 bubble、selection 一樣', '可以 reuse 原本的空間');
  await step(tok);                                   // 50:55 for loop × n → n²
  good('for loop × n → O(n²)', 3.2, -0.4, 1.4);
  say('一個 for loop，每張牌花 n 的力氣', '總共 <span class="ok">O(n²)</span>');
}]);

// 51:21 Backward insertion：stable 比較容易；而且是 adaptive（2 3 4 5 6 每張只看前一張）
FRAG.push(['sortlin-insert-adaptive', 'Backward Insertion：stable 又 adaptive', async (tok) => {
  fresh(LCAM, LLOOK);
  await step(tok);                                   // 51:21 forward、backward 在 stable 上有差別
  let A = lRow([1, '3A', 5, '3B'], { y: 3.6, tiles: false, dx: 1.5 });
  let B = lRow([1, '3A', 5, '3B'], { y: 0.6, dx: 1.5 });
  const tA = tag('forward', 'ptr', -4.6, 3.6, 0), tB = tag('backward', 'ptr', -4.6, 0.6, 0);
  A.hl([3], GOLD); B.hl([3], GOLD);
  say('Forward 和 backward 的實作', '在 stable 上有差別');
  await step(tok);                                   // 51:28 從前面找：要記得跨過同 value 的
  const jp = pkt('跨過 3A', A.x(1), 4.8, 0);
  for (let j = 0; j < 3; j++) { gl(A.m[j], j === 1 ? GOLD : BLUE); await beat(tok, 450); gl(A.m[j], null); }
  await A.rot(tok, 3, 2, 1000); A.hl([1, 2], GREEN);
  say('從前面找：要記得跨過同值的', '才會 stable');
  await step(tok);                                   // 51:43 從後面找：看到同樣或比較小的就插進去
  kill(jp); B.off();
  await insRound(tok, B, 3, { ms: 420 }); B.hl([1, 2], GREEN);
  say('從後面找：看到同樣或較小的就停', '直接插進去，容易 stable');
  await step(tok);                                   // 51:50 backward 版還是 adaptive
  A.kill(); B.kill(); kill(tA); kill(tB);
  A = lRow([2, 3, 4, 5, 6], { y: 3.6, tiles: false, dx: 1.4 });
  B = lRow([2, 3, 4, 5, 6], { y: 0.6, dx: 1.4 });
  tag('backward', 'ptr', -5.0, 3.6, 0); tag('naive（從前）', 'ptr', -5.0, 0.6, 0);
  const ca = { c: 0 };
  const la = tag('比較 0 次', 'ptr alt', 5.0, 4.6, 0), lb = tag('比較 0 次', 'ptr alt', 5.0, 1.6, 0);
  say('Backward 版另一個特性', 'adaptive');
  await step(tok);                                   // 52:04 大部分只要檢查前一個人
  await insRound(tok, A, 1, { ms: 450, cnt: ca, hk: () => txt(la, '比較 ' + ca.c + ' 次') });
  say('差不多排好時', '大多只要看前一個人有沒有比你小');
  await step(tok);                                   // 52:20 掀牌 2、3、4、5、6
  for (let i = 2; i < 5; i++) await insRound(tok, A, i, { ms: 280, cnt: ca, hk: () => txt(la, '比較 ' + ca.c + ' 次') });
  A.hl([0, 1, 2, 3, 4], GREEN);
  say('掀牌 2、3、4、5、6', '每張看一眼就放後面：共 4 次');
  let c = 0;
  const naive = async (i, ms) => { B.off(); B.hl([i], GOLD); for (let j = 0; j < i; j++) { gl(B.m[j], BLUE); c++; txt(lb, '比較 ' + c + ' 次'); await beat(tok, ms); } B.off(); };
  await step(tok);                                   // 52:49 naive：從前面開始找，4 要看了 3
  await naive(1, 350); await naive(2, 350);
  say('Naive：從最前面開始找', '3 看 2；4 看 2、3');
  await step(tok);                                   // 52:54 5 要看了 3、看了 4 才放後面
  await naive(3, 260); await naive(4, 230);
  say('5 要看 2、3、4 才放後面', '1 + 2 + 3 + 4 = 10 次');
  await step(tok);                                   // 53:00 naive 不 adaptive，backward 才是
  bad('naive：排好了還是 O(n²)', 3.4, -0.4, 1.4); good('backward：接近 O(n)', 3.4, 2.4, 0);
  say('Naive 版不 adaptive', 'Backward 版才是 <span class="ok">adaptive</span>');
}]);

// 53:08 三個 O(n²) 怎麼選：Insertion 通常最好（stable、adaptive 都容易），但 selection 對初學者最直覺
FRAG.push(['sortlin-n2-compare', '三個 O(n²) 排序怎麼選', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 2.6, 0]);
  const cols = ['Selection', 'Bubble', 'Insertion'], X = [-2.6, 0.6, 3.8];
  const CC = { 容易: '#3e9e6e', 較快: '#3e9e6e', 最直覺: '#3e9e6e', 直覺: '#3e9e6e', 要小心: '#d8b25a', 乍看難寫: '#d8b25a', 慢: '#d8b25a', 不容易: '#c0504d', 最慢: '#c0504d' };
  const cells = [];
  const row = (r, name, vals) => { const y = 4.3 - r * 1.2; tag(name, 'idx', -5.4, y, 0); vals.forEach((t, k) => cells.push(cube(t, CC[t], [2.4, 0.8, 0.6], X[k], y, 0, 1.6))); };
  await step(tok);                                   // 53:08 跟剛才兩個 n² 演算法比
  cols.forEach((c, k) => tag(c, 'ptr', X[k], 5.6, 0));
  const h = helper(-6.0, 1.0, '小幫手', 0.6);
  say('三個 O(n²) 的演算法放在一起比', '');
  await step(tok);                                   // 53:16 insertion 通常比 bubble 快
  row(0, '實務速度', ['慢', '最慢', '較快']);
  say('Insertion 通常比 bubble 快', '位置找得精準，不耗額外力氣');
  await step(tok);                                   // 53:35 selection 要 adaptive 不容易
  row(1, 'adaptive', ['不容易', '容易', '容易']);
  say('Selection 要做到 adaptive 不容易', '');
  await step(tok);                                   // 53:49 insertion 要 adaptive、要 stable 都容易
  row(2, 'stable', ['要小心', '容易', '容易']);
  say('Insertion 要 adaptive、stable 都相對容易', '');
  await step(tok);                                   // 53:54 在 n² 裡選 insertion
  cells.forEach((m, i) => { if (i % 3 === 2) glow(m, GOLD); }); h.mood('happy');
  say('在 n² 裡面選', 'insertion 應該是比較好的選擇');
  await step(tok);                                   // 54:10 初學者覺得 selection 比較直覺
  cells.forEach((m) => glow(m, null));
  row(3, '直覺', ['最直覺', '直覺', '乍看難寫']);
  glow(cells[9], GOLD); h.mood('wow');
  say('但初學者覺得 selection 最直覺', '先選最小、再選第二小……');
  await step(tok);                                   // 54:26 insertion 乍看好難寫
  bub('指標變來變去、往後擠……好難寫？', 3.8, -0.4, 0.8);
  say('乍看 insertion 好像很難寫', 'linked list 指標、往後擠');
  await step(tok);                                   // 54:44 真的寫出來，效率、簡潔度都比較好
  glow(cells[9], null); cells.forEach((m, i) => { if (i % 3 === 2) glow(m, GOLD); }); h.mood('happy');
  good('寫出來：效率、簡潔度常比 selection 好', 0, 6.5, 0);
  say('但真的寫出來', 'insertion 的效率、簡潔度常比較好');
}]);

// 56:17 Backward insertion = 「借過、借過」：一個 loop 同時找位置＋往後擠
FRAG.push(['sortlin-insert-shift', 'Backward Insertion：借過、借過', async (tok) => {
  fresh([0, 7.5, 12.5], [0, 2.4, 0]);
  await step(tok);                                   // 56:17 同一個演算法，不同的實作
  const cd = code(['key = a[i];  j = i - 1', 'while j >= 0 and a[j] > key:', '    a[j+1] = a[j];  j--     // 借過', 'a[j+1] = key'], 0, 6.8, 0.52, -2.6);
  const R = lRow([2, 4, 6, 8, 5], { kids: true, dx: 1.5, z: 1.4, idx: true });
  say('同一個演算法', '一點點不同的實作，結果就不同');
  await step(tok);                                   // 56:42 naive 跟 backward implementation
  pkt('naive：從前面找', -3.2, 4.2, 0); pkt('backward：從後面找', 3.2, 4.2, 0);
  say('Insertion 有 naive、backward 兩種實作', 'Backward 其實一點也不難');
  await step(tok);                                   // 57:04 你是被選出來的人，要排進排好的隊伍
  const km = R.m[4]; gl(km, GOLD); mood(km, 'wow'); move(km, R.x(4), R.h, R.z); cd.hl(0);
  say('5 是被選出來的人', '要排進已經排好的 2 4 6 8');
  await step(tok);                                   // 57:10 從後面開始：借過、借過
  let j = 3; const bb = bub('借過！', R.x(3), 3.6, 1.4);
  while (j >= 0 && R.v[j] > 5) {
    cd.hl(1); gl(R.m[j], BLUE); await beat(tok, 350);
    cd.hl(2); gl(R.m[j], null); move(R.m[j], R.x(j + 1), R.y, R.z); R.m[j + 1] = R.m[j]; R.v[j + 1] = R.v[j];
    j--; move(km, R.x(j + 1), R.h, R.z); bb.position.x = R.x(j + 1); await beat(tok, 500);
  }
  cd.hl(1); gl(R.m[j], BLUE); await beat(tok, 350); gl(R.m[j], null);
  cd.hl(3); R.m[j + 1] = km; R.v[j + 1] = 5; move(km, R.x(j + 1), R.y, R.z); gl(km, null); mood(km, 'happy'); txt(bb, '到了！');
  say('從隊伍後面：借過、借過', '8、6 往後挪，碰到 4 就停');
  await step(tok);                                   // 57:23 大部分人的直覺：從前面找再插隊
  const f = pkt('從前面找起…', R.x(0), 3.0, 1.4);
  await travel(tok, f, V3(R.x(0), 3.0, 1.4), V3(R.x(2), 3.0, 1.4), 1400);
  say('多數人第一直覺：從隊伍前面找', '找到再插隊，後面的人再讓開');
  await step(tok);                                   // 57:45 一個 for loop 搞定兩件事
  kill(f); cd.hl(-1); R.hl([0, 1, 2, 3, 4], GREEN);
  good('一個 loop：找到位置 ＋ 把人往後擠', 0, 4.4, 1.4);
  say('Backward：一個 for loop', '同時找到位置、把人往後擠');
}]);

// 1:09:26 影片：Selection 每次選一個放好；Insertion 每次拿一個插進 sorted 的正確位置
FRAG.push(['sortlin-video-sel-ins', '影片：Selection 與 Insertion 的行為', async (tok) => {
  fresh(LCAM, LLOOK);
  await step(tok);                                   // 1:09:26 來看 sorting 的視覺化影片
  const mon = prop('monitor', -5.6, 0, -0.6, 1.3, 'sorting 影片'); bob(mon, 0.04);
  const A = lRow([5, 2, 6, 1, 4, 3], { y: 3.6, tiles: false, dx: 1.2, x0: -2.0 });
  const B = lRow([5, 2, 6, 1, 4, 3], { y: 0.6, dx: 1.2, x0: -2.0 });
  tag('Selection', 'ptr', 5.6, 3.6, 0); tag('Insertion', 'ptr', 5.6, 0.6, 0);
  say('看看不同 sorting 的 behavior', '網路上很容易找到這種影片');
  await step(tok);                                   // 1:10:19 selection：每次選一個出來放好
  for (let i = 0; i < 5; i++) await selRound(tok, A, i, { ms: 55, sw: 330 });
  A.hl([0, 1, 2, 3, 4, 5], GREEN);
  say('Selection：每次選一個出來', '放到它該放的地方');
  await step(tok);                                   // 1:10:52 insertion：每次拿一個插進正確位置
  for (let i = 1; i < 6; i++) await insRound(tok, B, i, { ms: 75 });
  B.hl([0, 1, 2, 3, 4, 5], GREEN);
  say('Insertion：每次拿一個', '插入 sorted 裡的正確位置');
  await step(tok);                                   // 1:11:48 差在「找」和「插」哪個花力氣
  A.off(); B.off();
  note('力氣花在「找」', 1.0, 4.9, 0); note('力氣花在「插」', 1.0, 1.9, 0);
  say('兩個很像', '差在找和插，哪個花比較多力氣');
}]);

// 1:12:38 影片：Quick Sort 把東西分成一小堆一小堆，再分頭排好
FRAG.push(['sortlin-video-quick', '影片：Quick Sort 分成小堆', async (tok) => {
  fresh(LCAM, LLOOK);
  await step(tok);                                   // 1:12:38 quick sort 比 n² 的快
  const R = lRow([7, 2, 9, 4, 1, 8, 3, 6, 10, 5], { dx: 1.05, sz: 0.72 });
  prop('monitor', -6.0, 0, -1.6, 1.0, '影片');
  say('Quick Sort', '比 insertion、selection 這些 n² 的快');
  await step(tok);                                   // 1:12:53 堆成一小堆一小堆，大小相近
  await R.arrange(tok, 0, [2, 4, 1, 3, 5, 7, 9, 8, 6, 10], 1300);
  let z1 = R.zone(null, BLUE, 0, 4), z2 = R.zone(null, GOLD, 5, 9);
  say('把東西堆成一小堆一小堆', '同一堆的大小比較相近');
  await step(tok);                                   // 1:13:01 再分頭把每一小堆擺好
  await Promise.all([R.arrange(tok, 0, [1, 2, 3, 4, 5], 1200), R.arrange(tok, 5, [6, 7, 8, 9, 10], 1200)]);
  kill(z1); kill(z2); R.hl([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], GREEN);
  note('divide and conquer', 0, 2.2, 0);
  say('再分頭把每一小堆擺好', '這叫 divide and conquer');
}]);

// 1:13:40 影片：Merge Sort 先排小堆，再合併成中堆、大堆
FRAG.push(['sortlin-video-merge', '影片：Merge Sort 合併小堆', async (tok) => {
  fresh(LCAM, LLOOK);
  await step(tok);                                   // 1:13:40 merge sort
  const R = lRow([6, 5, 4, 7, 8, 3, 1, 2], { dx: 1.2 });
  prop('monitor', -6.0, 0, -1.6, 1.0, '影片');
  say('Merge Sort', '視覺上很容易看懂');
  await step(tok);                                   // 1:13:45 先把一些堆排好
  await Promise.all([0, 2, 4, 6].map((s) => R.arrange(tok, s, R.v.slice(s, s + 2).sort((a, b) => a - b), 1100)));
  const zs = [0, 2, 4, 6].map((s) => R.zone(null, BLUE, s, s + 1));
  say('先把一些小堆排好', '');
  await step(tok);                                   // 1:13:55 小堆合併起來變中堆
  zs.forEach(kill);
  await Promise.all([0, 4].map((s) => R.arrange(tok, s, R.v.slice(s, s + 4).sort((a, b) => a - b), 1300)));
  const zm = [0, 4].map((s) => R.zone(null, GOLD, s, s + 3));
  say('小堆合併 → 排好的中堆', '');
  await step(tok);                                   // 1:14:01 中堆合併起來變大堆
  zm.forEach(kill);
  await R.arrange(tok, 0, [1, 2, 3, 4, 5, 6, 7, 8], 1400); R.hl([0, 1, 2, 3, 4, 5, 6, 7], GREEN);
  say('中堆合併 → 排好的大堆', '一堆一堆合起來：Merge Sort');
}]);

// 1:14:38 影片：Heap Sort（模組內建「heap-sort」的 cued 版本）
FRAG.push(['sortlin-heap-video', '影片：Heap Sort', async (tok) => {
  await step(tok);                                   // 1:14:38 Heap Sort，大家應該很熟
  Object.assign(CFG.heap, { input: 'random', n: 7, vals: [4, 9, 2, 7, 1, 8, 5] }); enterHeap(false); controls('');
  say('Heap Sort', '看影片才發現：好像也沒特別快');
  await step(tok);                                   // 1:14:48 前面花很長時間把 Heap 做出來
  let built = S.steps.findIndex((st) => st.heapSize < S.vals.length); if (built < 0) built = Math.floor(lastStep() / 3);
  await runTo(tok, built, 2600);
  say('前面花不少時間把 Heap 做出來', '影片裡五顏六色的那段');
  await step(tok);                                   // 1:14:55 然後才做 selection
  await runTo(tok, built + Math.floor((lastStep() - built) / 2), 2600);
  say('做好之後，每次拿最大的出來', '比 selection 快一些');
  await step(tok);                                   // 1:15:00 每一步都還要花力氣調整 Heap
  await runTo(tok, lastStep(), 2600);
  say('但每一步都還要花力氣調整 Heap', '');
  await step(tok);                                   // 1:15:06 漂亮、理想，但實務上沒那麼好用
  tag('漂亮、理想的演算法', 'good', -3.2, 3.2, 1.0); tag('實務上通常沒那麼好用', 'bad', 3.2, 3.2, 1.0);
  say('漂亮但很理想化', '實務上通常沒有那麼好用');
}]);

// 1:15:39 影片：Radix Sort（LSD、MSD）（模組內建「radix-lsd」的 cued 版本）
FRAG.push(['sortlin-radix', '影片：Radix Sort（LSD、MSD）', async (tok) => {
  await step(tok);                                   // 1:15:39 radix sort：今年不講
  Object.assign(CFG.dist, { algo: 'radix', input: 'video' }); enterDist(true); controls('');
  const n0 = tag('今年課程不講，但很有趣', 'note', 0, 4.4, 0);
  say('Radix Sort', '今年的課程沒時間講');
  await step(tok);                                   // 1:15:51 按千位、百位、十位、個位分開排
  txt(n0, '千位、百位、十位、個位：拆成一位一位排');
  say('把大數字拆成一位一位', '每一位分開排序，配合 stable sorting');
  await step(tok);                                   // 1:16:15 像 hash：同一位數放一堆
  await runTo(tok, Math.floor(lastStep() * 0.13), 2400);
  txt(n0, '像 hash：這一位是 0 的一堆、是 1 的一堆…');
  say('有點像 hash：同一位數的放一堆', '也是一種 divide');
  await step(tok);                                   // 1:17:18 LSD：從個位數先排
  await runTo(tok, Math.floor(lastStep() * 0.25), 2400);
  txt(n0, 'LSD：從最低位（個位）先排');
  say('影片寫 LSD', '從個位數先排，再十位、百位');
  await step(tok);                                   // 1:17:08 再排十位、百位……
  await runTo(tok, lastStep(), 2800);
  txt(n0, '一位一位排完 → 全部排好（每回合要 stable）');
  say('一位一位往上排', '最後全部排好');
  await step(tok);                                   // 1:17:20 另一版從高位排到低位（MSD）
  txt(n0, 'MSD：從最高位先分堆，再在每一堆裡排');
  say('另一個版本從高位排到低位', 'MSD');
  await step(tok);                                   // 1:17:49 用位數的觀念做 divide and conquer
  txt(n0, '兩個版本：都用「位數」做 divide and conquer');
  say('兩個版本相似', '都用位數的觀念 divide and conquer');
}]);

// 一棵「分堆的樹」：quick sort 的 pivot 一層一層往下長；x = 最終排序位置，每堆保持原本的順序
function qTree(vals, o = {}) {
  const sorted = [...vals].sort((a, b) => a - b), dx = o.dx || 1.1, top = o.top || 6.2, dy = o.dy || 1.3;
  const X = (k) => (k - (vals.length - 1) / 2) * dx;
  const M = {}; vals.forEach((v, i) => { M[v] = cube(v, colorFor(v), [0.75, 0.75, 0.75], X(i), top, 0); });
  const T = { M, X: (v) => X(sorted.indexOf(v)), depth: 0, levels: [] };
  // split the pile occupying sorted slots lo.. at depth d around pivot p
  T.split = (pile, lo, p, d, par) => {
    glow(M[p], GOLD);
    const y = top - d * dy;
    move(M[p], X(sorted.indexOf(p)), y, 0);
    const L = pile.filter((v) => v < p), G = pile.filter((v) => v > p);
    L.forEach((v, k) => move(M[v], X(lo + k), y - dy, 0));
    G.forEach((v, k) => move(M[v], X(lo + L.length + 1 + k), y - dy, 0));
    if (par !== null && par !== undefined) line(T.X(par), y + dy, T.X(p), y, -0.1);
    T.depth = Math.max(T.depth, d);
    (T.levels[d] = T.levels[d] || []).push(p);
    return { L, G, lo, hi: lo + L.length + 1 };
  };
  T.done = (p) => { glow(M[p], null); tint(M[p], '#e8dcc0'); };
  // finish a pile with a chooser for the pivot, fast
  T.finish = async (tok, pile, lo, d, par, pick, ms) => {
    if (!pile.length) return;
    const p = pick(pile); const r = T.split(pile, lo, p, d, par); await beat(tok, ms); T.done(p);
    await T.finish(tok, r.L, lo, d + 1, p, pick, ms); await T.finish(tok, r.G, r.hi, d + 1, p, pick, ms);
  };
  return T;
}
const midPick = (pile) => [...pile].sort((a, b) => a - b)[(pile.length - 1) >> 1];

// 1:18:37 影片：標準函式庫的 sort（大堆 divide and conquer、小堆 local 調整）；stable_sort 的核心是 merge sort
async function hybridRun(tok, R, lo, hi, TH, o) {
  if (hi < lo) return;
  if (hi - lo + 1 <= TH) {
    o.z = R.zone(o.z, GREEN, lo, hi);
    for (let i = lo + 1; i <= hi; i++) await insRound(tok, R, i, { ms: o.ms, lo });
    return;
  }
  const seg = R.v.slice(lo, hi + 1), p = seg[0];
  o.z = R.zone(o.z, BLUE, lo, hi); R.off(); R.hl([lo], GOLD); await beat(tok, o.ms * 2);
  const L = seg.filter((v) => v < p), G = seg.filter((v) => v > p);
  await R.arrange(tok, lo, L.concat([p], G), o.ms * 4); R.off(); R.hl([lo + L.length], GREEN);
  o.parts.push([lo, lo + L.length - 1], [lo + L.length + 1, hi]);
}
FRAG.push(['sortlin-hybrid-video', '影片：標準函式庫的 sort', async (tok) => {
  fresh(LCAM, LLOOK);
  await step(tok);                                   // 1:18:37 標準函式庫用的不是純 quick sort
  const R = lRow([7, 2, 10, 5, 12, 1, 9, 4, 13, 3, 11, 8], { idx: true, dx: 0.95, sz: 0.7 });
  prop('monitor', -6.2, 0, -1.6, 1.0, '影片');
  say('標準函式庫真正用的 sort', '不是純粹的 quick sort');
  await step(tok);                                   // 1:18:42 混合了不同的 sort
  const o = { ms: 160, parts: [], z: null };
  await hybridRun(tok, R, 0, 11, 5, o);
  note('混合好幾種 sort', 0, 2.6, 0);
  say('它混合了不同的 sort', '大堆先像 quick sort 一樣分開');
  await step(tok);                                   // 1:18:50 範圍小的時候做附近的 local 調整
  const parts = o.parts.slice(); o.ms = 48;
  for (const [a, b] of parts) await hybridRun(tok, R, a, b, 6, o);
  if (o.z) kill(o.z); R.off(); R.hl(R.v.map((_, i) => i), GREEN);
  say('範圍小的時候', '只在附近幾個做 local 的調整');
  await step(tok);                                   // 1:18:58 global 用 divide and conquer
  pkt('Global：divide and conquer', -2.6, -0.5, 1.4); pkt('Local：insertion', 3.0, -0.5, 1.4);
  say('Global 用 divide and conquer 的想法', '');
  await step(tok);                                   // 1:19:50 stable sort：核心是 merge sort
  note('另一個：stable_sort → 核心是 Merge Sort', 0, 3.6, 0);
  say('另一個 sort 是 stable sort', '顧名思義 stable；核心是 merge sort');
}]);

// 1:20:31 影片：Shell Sort 預告（以 insertion 為底、多次掃過）
FRAG.push(['sortlin-shell-video', '影片：Shell Sort 預告', async (tok) => {
  fresh([0, 7, 13], [0, 1.6, 0]);
  await step(tok);                                   // 1:20:31 以 insertion sort 為底
  const R = lRow([14, 3, 11, 7, 16, 1, 9, 13, 5, 12, 2, 15, 8, 4, 10, 6], { dx: 0.78, sz: 0.6 });
  prop('monitor', -6.2, 0, -1.6, 1.0, '影片');
  say('Shell Sort：等一下會講', '以 insertion sort 為底');
  await step(tok);                                   // 1:20:38 像 bubble 一樣 multiple pass
  for (const g of [5, 2]) for (let i = g; i < R.v.length; i++) await insRound(tok, R, i, { ms: 25, gap: g });
  say('像 bubble sort 一樣掃很多次', 'multiple pass');
  await step(tok);                                   // 1:20:50 巧妙運用 insertion 的特性
  for (let i = 1; i < R.v.length; i++) await insRound(tok, R, i, { ms: 45 });
  R.hl(R.m.map((_, i) => i), GREEN);
  say('巧妙運用 insertion sort 的特性', '很快就完成');
}]);

// 1:21:23 影片：Bubble 像 selection（極值浮到定位）＋順便修鄰居；Cocktail Shaker 左右來回搖
FRAG.push(['sortlin-cocktail', 'Cocktail Shaker：往左右兩邊的 bubble', async (tok) => {
  fresh(LCAM, LLOOK);
  await step(tok);                                   // 1:21:23 bubble 的行為有點像 selection
  const R = lRow([3, 8, 5, 1, 9, 2], { idx: true, dx: 1.3 });
  let lo = 0, hi = R.v.length - 1, zr = null, zl = null;
  await bubblePass(tok, R, lo, hi, 1, { ms: 200 });
  zr = R.zone(zr, GREEN, hi, hi); hi--;
  say('Bubble：每輪最大的浮到右邊', '行為有點像 selection');
  await step(tok);                                   // 1:21:40 同時也把很多錯誤的 pair 調整了
  note('順便把錯誤的鄰居 pair 修好', 0, 2.4, 0);
  say('選最極端的同時', '也把很多錯誤的鄰居 pair 修好');
  await step(tok);                                   // 1:22:15 cocktail shaker
  const sh = prop('parcel', -5.8, 0, 1.6, 0.7, '雞尾酒搖搖杯'); bob(sh, 0.15, 6);
  say('Cocktail Shaker', '像調酒：左邊搖一下、右邊搖一下');
  await step(tok);                                   // 1:22:27 往左右兩邊的 bubble sort
  let sw = await bubblePass(tok, R, lo, hi, -1, { ms: 230 });
  zl = R.zone(zl, GREEN, 0, lo); lo++;
  say('往左搖：小的沉到左邊', '往左右兩邊的 bubble sort');
  await step(tok);                                   // 1:22:35 一次做一個方向
  sw = await bubblePass(tok, R, lo, hi, 1, { ms: 200 }); hi--;
  if (sw) await bubblePass(tok, R, lo, hi, -1, { ms: 200 });
  if (zl) kill(zl); zr = R.zone(zr, GREEN, 0, R.v.length - 1);
  say('一次做一個方向，左右輪流', '一樣是鄰居交換');
}]);

// 1:23:01 影片：Gnome（小精靈）、Bitonic、Bogo sort
FRAG.push(['sortlin-video-misc', '影片：Gnome、Bitonic、Bogo', async (tok) => {
  fresh(LCAM, LLOOK);
  await step(tok);                                   // 1:23:01 剛才講的小精靈
  let R = lRow([3, 6, 8, 4, 2], { idx: true, dx: 1.4 });
  const gm = buddy('小精靈', '', '#9fd18b', R.x(3), 0, 1.7, 0.55);
  await gnomeRoll(tok, R, gm, 3, 450); await gnomeRoll(tok, R, gm, 4, 350); gm.mood('happy');
  say('這是剛才講的小精靈（gnome sort）', '鄰居交換、一路搬運');
  await step(tok);                                   // 1:23:18 bitonic sort
  R.kill(); kill(gm.g);
  R = lRow([2, 5, 7, 8, 6, 4, 3, 1], { dx: 1.2 });
  const z1 = R.zone(null, BLUE, 0, 3), z2 = R.zone(null, GOLD, 4, 7);
  note('小 → 大', R.x(1.5), 1.9); note('大 → 小', R.x(5.5), 1.9);
  say('Bitonic sort', '課程不會講');
  await step(tok);                                   // 1:23:45 有點像 merge：一半大排到小、一半小排到大再混合
  await R.arrange(tok, 0, [1, 2, 3, 4, 5, 6, 7, 8], 1600); kill(z1); kill(z2); R.hl([0, 1, 2, 3, 4, 5, 6, 7], GREEN);
  say('有點像 merge sort', '一半小到大、一半大到小，再混合');
  await step(tok);                                   // 1:24:08 亂排亂換，看哪天排好
  R.off();
  await R.arrange(tok, 0, [5, 2, 8, 1, 7, 3, 6, 4], 900); await R.arrange(tok, 0, [3, 7, 1, 6, 2, 8, 4, 5], 900);
  const h = helper(-6.0, 1.6, '小幫手', 0.6); h.mood('wow');
  say('亂排亂換', '看看哪一天剛好排好');
  await step(tok);                                   // 1:24:17 bogo sort：好玩為主
  bad('Bogo sort：不是 formal 的演算法', 0, 2.4, 0);
  h.mood('happy');
  say('這叫 Bogo sort', '好玩為主，不是真的有用');
}]);

// 1:25:30 Q&A：insertion 的「借過」和 bubble 都是鄰居交換，但每輪保證的東西不同
FRAG.push(['sortlin-bubble-vs-insert-guarantee', 'Bubble 與 Insertion 每輪保證什麼', async (tok) => {
  fresh(LCAM, LLOOK);
  await step(tok);                                   // 1:25:30 insertion 一直借過，跟 bubble 一樣嗎？
  const A = lRow([4, 2, 5, 1, 3], { y: 3.6, tiles: false, dx: 1.3 });
  const B = lRow([4, 2, 5, 1, 3], { y: 0.6, dx: 1.3 });
  tag('Bubble', 'ptr', -4.9, 3.6, 0); tag('Insertion', 'ptr', -4.9, 0.6, 0);
  const h = helper(5.8, 1.6, '同學', 0.6); h.mood('wow');
  bub('借過借過，跟 bubble 一樣嗎？', 4.6, 2.8, 1.6);
  say('同學問：insertion 一直借過', '跟 bubble sort 一樣嗎？');
  await step(tok);                                   // 1:25:37 neighbor 交換的都有類似的地方
  note('都是 neighbor 交換', 0, 2.2, 0);
  say('Neighbor 交換的', '都有一些類似的地方');
  await step(tok);                                   // 1:25:45 差在一輪換完保證了什麼
  say('差別在：一輪做完', '保證了什麼');
  await step(tok);                                   // 1:25:52 insertion 保證那個東西塞到正確地方
  for (let i = 1; i < 4; i++) await insRound(tok, B, i, { ms: 160 });
  B.hl([0, 1, 2, 3], GOLD);
  say('Insertion：拿的那個塞到正確的地方', '前面這段 1 2 4 5 排好了');
  await step(tok);                                   // 1:25:59 bubble 像 selection：極值浮到該到的地方
  await bubblePass(tok, A, 0, 4, 1, { ms: 260 }); A.hl([4], GREEN);
  say('Bubble：像 selection', '保證最大的 5 浮到最終位置');
  await step(tok);                                   // 1:26:14 其他值的相對關係就可能不同
  h.mood('happy');
  note('其他值：bubble 是 2 4 1 3，insertion 是 1 2 4 5', 0, 5.0, 0);
  say('其他值的相對關係', '就可能不一樣');
}]);

// 1:27:21 Shell Sort：insertion with long jumps，間隔 10 → 5 → 2 → 1
FRAG.push(['sortlin-shell', 'Shell Sort：間隔 10、5、2、1 的 insertion', async (tok) => {
  fresh([0, 7, 13], [0, 1.6, 0]);
  await step(tok);                                   // 1:27:21 影片裡的 Shell Sort
  const R = lRow([14, 3, 11, 7, 16, 1, 9, 13, 5, 12, 2, 15, 8, 4, 10, 6], { idx: true, dx: 0.78, sz: 0.6 });
  const mv = { c: 0 }; const ml = tag('移動 0 次', 'ptr alt', 0, 3.6, 0);
  const hk = () => txt(ml, '移動 ' + mv.c + ' 次');
  const h = helper(-6.4, 1.8, '小幫手', 0.6);
  say('Shell Sort 在做什麼？', '');
  await step(tok);                                   // 1:27:29 insertion sort 是 adaptive
  const n1 = note('Insertion：adaptive', 0, 4.6, 0);
  say('Insertion sort 是 adaptive', '');
  await step(tok);                                   // 1:27:37 快排好時快、差很遠時慢
  txt(n1, '快排好 → 很快；離排好很遠 → 很慢');
  h.mood('sad');
  say('大概排好時很快', '離排好很遠時很慢');
  await step(tok);                                   // 1:27:56 有點像 skip list：開快車
  const car = pkt('快車 →', R.x(0), 2.6, 0);
  for (const k of [10, 5, 15]) await travel(tok, car, car.position.clone(), V3(R.x(k), 2.6, 0), 600);
  kill(car); h.mood('wow');
  txt(n1, '開快車：可以做比較遠的交換');
  say('有一點像 skip list', '不要都是慢車：開一些快車');
  const chain = (c, g) => { const a = []; for (let k = c; k < R.v.length; k += g) a.push(k); return a; };
  const runChain = async (c, g, ms) => { for (let i = c + g; i < R.v.length; i += g) await insRound(tok, R, i, { ms, gap: g, mv, hk }); };
  await step(tok);                                   // 1:28:31 每 10 個：0 號、10 號……
  R.hl(chain(0, 10), BLUE);
  txt(n1, '間隔 10：0 號、10 號看成一串');
  say('一開始每 10 個看一次', '0 號、10 號、20 號……');
  await step(tok);                                   // 1:28:41 想成假的 linked list，跑 insertion
  R.off(); await runChain(0, 10, 350);
  say('把它們想成一串，跑 insertion sort', '有需要就一次跳很遠');
  await step(tok);                                   // 1:29:02 1、11、21……；2、12、22……
  for (let c = 1; c < 6; c++) { R.off(); R.hl(chain(c, 10), BLUE); await runChain(c, 10, 110); }
  R.off(); txt(n1, '間隔 10 的每一串都做完');
  say('再做 1、11、21……', '2、12、22……每一串都做');
  await step(tok);                                   // 1:29:23 縮小：每 5 個
  for (let i = 5; i < R.v.length; i++) await insRound(tok, R, i, { ms: 55, gap: 5, mv, hk });
  txt(n1, '間隔 5');
  say('縮小：每 5 個 5 個做', '');
  await step(tok);                                   // 1:29:32 每 2 個 2 個
  for (let i = 2; i < R.v.length; i++) await insRound(tok, R, i, { ms: 38, gap: 2, mv, hk });
  txt(n1, '間隔 2');
  say('再每 2 個 2 個做', '');
  await step(tok);                                   // 1:29:39 最後每 1 個：資料幾乎排好
  const before = mv.c;
  for (let i = 1; i < R.v.length; i++) await insRound(tok, R, i, { ms: 45, mv, hk });
  R.hl(R.m.map((_, i) => i), GREEN); h.mood('happy');
  txt(n1, '間隔 1：只移動 ' + (mv.c - before) + ' 次，幾乎不用動');
  say('最後一般的 insertion', '作用在幾乎排好的資料上，很快');
  await step(tok);                                   // 1:29:55 insertion sort with long jumps
  good('Shell Sort = insertion sort with long jumps', 0, 5.6, 0);
  say('Shell Sort', '= insertion sort with long jumps');
}]);

// 1:30:09 Shell Sort 的性質：in-place；long jump → 不 stable；但很 adaptive；理論難分析、實務快
FRAG.push(['sortlin-shell-props', 'Shell Sort：不 stable、但很 adaptive', async (tok) => {
  fresh(LCAM, LLOOK);
  await step(tok);                                   // 1:30:09 用 insertion → 不需要額外空間
  const A = lRow([3, '5A', '5B', 1], { y: 3.6, tiles: false, dx: 1.6 });
  tag('long jump', 'ptr', -4.6, 3.6, 0);
  const h = helper(5.8, 1.6, '小幫手', 0.6);
  good('in-place：不需要額外空間', 0, 5.0, 0);
  say('裡面用的是 insertion sort', '不需要額外空間');
  await step(tok);                                   // 1:30:17 有 long jump → 不是 stable
  for (const g of [2, 1]) for (let i = g; i < 4; i++) await insRound(tok, A, i, { ms: 150, gap: g });
  A.hl([2, 3], RED); h.mood('sad');
  bad('5B 跑到 5A 前面', 4.6, 2.6, 0);
  say('有 long jump：1 一跳越過 5B', '所以<span class="no">不是 stable</span>');
  await step(tok);                                   // 1:30:24 但跟 insertion 一樣很 adaptive
  A.off(); h.mood('calm');
  const B = lRow([1, 2, 3, 4, 5, 6, 7, 8], { y: 0.6, dx: 1.1 });
  const mv = { c: 0 }; const ml = tag('移動 0 次', 'ptr alt', 0, 1.9, 0);
  for (const g of [4, 2, 1]) for (let i = g; i < 8; i++) await insRound(tok, B, i, { ms: 40, gap: g, mv, hk: () => txt(ml, '移動 ' + mv.c + ' 次') });
  B.hl([0, 1, 2, 3, 4, 5, 6, 7], GREEN); h.mood('happy');
  say('但跟 insertion 一樣很 adaptive', '原本排好 → 每輪都不用動');
  await step(tok);                                   // 1:30:38 理論上不好分析
  const n1 = note('理論：最壞情形都不容易分析', 0, 5.8, 0);
  say('理論上它不好分析', '連最壞情形都不太明朗');
  await step(tok);                                   // 1:30:58 實務上比較快
  txt(n1, '實務：比直接用 insertion 快');
  say('但實務上', '比直接用 insertion sort 快');
  await step(tok);                                   // 1:31:21 一堆加速的小技巧
  txt(n1, '一堆加速 insertion 的小技巧');
  say('可以想成一堆加速的 trick', '先 long jump，進入快排好的階段');
  await step(tok);                                   // 1:31:58 理論分析和實務不見得一樣
  txt(n1, '理論分析 ≠ 實務上的好用');
  say('理論的分析', '跟實務上不見得完全一樣');
  await step(tok);                                   // 1:32:43 多呼叫幾次 insertion sort
  txt(n1, '不用另寫 Merge／Quick：多呼叫幾次 insertion');
  say('不一定要寫複雜的 merge、quick', '多呼叫幾次 insertion sort 就好');
  await step(tok);                                   // 1:33:07 好用的拼裝車
  txt(n1, '好用的拼裝車：需要 adaptivity 時想到它');
  await h.hop(tok);
  say('好用的拼裝車', '需要 adaptivity 時可以想到它');
}]);

// 1:33:47 Merge Sort（bottom-up）：6 5 4 7 8 3 1 2 → 小堆 → 中堆 → 大堆
FRAG.push(['sortlin-merge-bottomup', 'Merge Sort：小堆合併成中堆、大堆', async (tok) => {
  fresh([0, 6.5, 13], [0, 3, 0]);
  const DX = 1.2, X = (i) => (i - 3.5) * DX, LY = [0.6, 2.2, 3.8, 5.4];
  let cur = [], vals = [6, 5, 4, 7, 8, 3, 1, 2], nxt = [], nv = [];
  // merge the two runs starting at s (each w long) of level L-1 into level L
  const mergeAt = async (s, w, L, ms) => {
    let p = s, q = s + w, at = s; const pe = s + w, qe = s + 2 * w;
    while (p < pe || q < qe) {
      const takeP = q >= qe || (p < pe && vals[p] <= vals[q]);
      if (p < pe) glow(cur[p], GOLD); if (q < qe) glow(cur[q], GOLD);
      await beat(tok, ms);
      const k = takeP ? p++ : q++;
      const v = vals[k];
      nv[at] = v; nxt[at] = cube(v, colorFor(v), [0.8, 0.8, 0.8], X(at), LY[L], 0, 0.9); at++;
      glow(cur[k], null); tint(cur[k], '#cfc6b6');
      await beat(tok, ms);
    }
    const g = ghostBox(GREEN, 2 * w * DX - 0.15, 1.05, 1.1); g.position.set((X(s) + X(s + 2 * w - 1)) / 2, LY[L], 0);
  };
  const nextLevel = () => { cur = nxt; vals = nv; nxt = []; nv = []; };
  await step(tok);                                   // 1:33:47 merge sort 的行為很容易懂
  tag('Merge Sort（bottom-up）', 'ptr', 0, 6.6, 0);
  say('Merge Sort 的行為很容易懂', '');
  await step(tok);                                   // 1:33:54 6 5 4 7 8 3 1 2，每一筆是一個小堆
  cur = vals.map((v, i) => cube(v, colorFor(v), [0.8, 0.8, 0.8], X(i), LY[0], 0, 1.2));
  tag('小堆', 'idx', -6.0, LY[0], 0);
  say('6 5 4 7 8 3 1 2', '每一筆自己是一個小堆');
  await step(tok);                                   // 1:34:03 小堆兩兩合併
  tag('中堆', 'idx', -6.0, LY[1], 0);
  say('試著把小堆兩兩合併', '');
  await step(tok);                                   // 1:34:11 5、6 排好；4、7 排好
  await mergeAt(0, 1, 1, 250); await mergeAt(2, 1, 1, 250);
  say('6、5 → 5 6；4、7 → 4 7', '排好的中堆');
  await step(tok);                                   // 1:34:20 3 跟 8
  await mergeAt(4, 1, 1, 300);
  say('8、3 → 3 8', '');
  await step(tok);                                   // 1:34:29 1 跟 2；中堆再合成大堆
  await mergeAt(6, 1, 1, 300); nextLevel();
  tag('大堆', 'idx', -6.0, LY[2], 0);
  say('1、2 → 1 2', '再把兩個中堆混成大堆');
  await step(tok);                                   // 1:34:39 4 5 6 7；1 2 3 8
  await mergeAt(0, 2, 2, 160); await mergeAt(4, 2, 2, 160); nextLevel();
  say('5 6 + 4 7 → 4 5 6 7', '3 8 + 1 2 → 1 2 3 8');
  await step(tok);                                   // 1:34:49 兩個大堆合起來：1 2 3 4 5 6 7 8
  await mergeAt(0, 4, 3, 140); nextLevel();
  say('兩個大堆合起來', '1 2 3 4 5 6 7 8');
}]);

// 1:35:07 縱向 log n 層；合併 = sparse array／多項式相加，兩個指標各走一遍；橫向每層 n → n log n
FRAG.push(['sortlin-merge-twoptr', 'Merge = 兩個 sparse array 合併', async (tok) => {
  fresh([0, 6.5, 12], [0, 2.4, 0]);
  await step(tok);                                   // 1:35:07 1 → 2 → 4 → 8，合到 n
  const lad = [1, 2, 4, 8].map((s, k) => cube('size ' + s, '#4b9ee2', [0.7 + s * 0.35, 0.6, 0.6], -4.2, 0.6 + k * 1.2, 0, 1.0));
  say('縱向：堆的大小 1 → 2 → 4 → 8', '一直合到 n');
  await step(tok);                                   // 1:35:16 要 log₂ n 層
  const lg = good('log₂ n 層', -1.2, 2.4, 0);
  say('要花 log₂ n 那麼多層', '');
  await step(tok);                                   // 1:35:41 每一層 size 2ⁱ 的堆合起來
  glow(lad[1], GOLD);
  note('第 i 層：把 size 2ⁱ 的堆兩兩合起來', 0.8, 5.6, 0);
  say('每一層：把做好的堆兩兩合併', '這一層的堆 size 是 2ⁱ');
  await step(tok);                                   // 1:35:57 排好的 5 6 跟 4 7 怎麼合？
  lad.forEach((m) => kill(m)); kill(lg);
  const Lv = [5, 6], Rv = [4, 7];
  const Lm = Lv.map((v, k) => cube(v, colorFor(v), [0.85, 0.85, 0.85], -4.6 + k * 1.1, 3.4, 0, 1.0));
  const Rm = Rv.map((v, k) => cube(v, colorFor(v), [0.85, 0.85, 0.85], 3.5 + k * 1.1, 3.4, 0, 1.0));
  for (let k = 0; k < 4; k++) ctx.tile(V3(-1.65 + k * 1.1, 0.02, 0), 1.0, 1.0);
  say('排好的 5 6 跟排好的 4 7', '怎麼快速合起來？');
  await step(tok);                                   // 1:36:23 看成 x⁵ + x⁶、x⁴ + x⁷
  tag('x⁵ + x⁶', 'pkt', -4.05, 2.5, 0); tag('x⁴ + x⁷', 'pkt', 4.05, 2.5, 0);
  say('教過了：sparse array 相加', '5 6 看成 x⁵ + x⁶，4 7 看成 x⁴ + x⁷');
  await step(tok);                                   // 1:36:56 兩個指標各走一個，走完就合起來
  const pp = tag('p', 'ptr', 0, 0, 0), qp = tag('q', 'ptr alt', 0, 0, 0);
  let p = 0, q = 0, k = 0;
  const sp = () => { pp.position.set(p < 2 ? Lm[p].position.x : -2.6, 4.4, 0); qp.position.set(q < 2 ? Rm[q].position.x : 5.6, 4.4, 0); };
  sp();
  while (p < 2 || q < 2) {
    const takeP = q >= 2 || (p < 2 && Lv[p] <= Rv[q]);
    const m = takeP ? Lm[p++] : Rm[q++];
    glow(m, GOLD); await beat(tok, 250); glow(m, null);
    move(m, -1.65 + k * 1.1, 0.5, 0); k++; sp(); await beat(tok, 350);
  }
  say('兩個指標，兩邊各走一遍', 'size 2ⁱ 的兩堆 → 2ⁱ 的力氣');
  await step(tok);                                   // 1:37:20 sparse array、多項式相加：一樣的演算法
  note('merge ＝ sparse array 相加 ＝ 多項式相加', 0, 1.8, 0);
  say('Merge 這個演算法我們早就教過', 'sparse array、多項式相加');
  await step(tok);                                   // 1:37:29 橫向每層 n 的力氣
  const rows = [0.4, 1.0].map((y) => ghostBox(GOLD, 9.5, 0.3, 0.6));
  rows.forEach((g, i) => g.position.set(0, -0.1 + i * 0.01, 1.4));
  pkt('橫向：每層合併總共 n', 0, -0.6, 1.4);
  say('橫向：每層兩兩合併', '總共花 n 的力氣');
  await step(tok);                                   // 1:37:52 bottom-up：n log n
  good('n × log n 層 = O(n log n)', 0, 5.6, 0);
  say('Bottom-up：小堆 → 中堆 → 大堆', '總共 <span class="ok">O(n log n)</span>');
}]);

// 1:38:02 Top-down：遞迴切一半、兩半各自排好、再 merge（divide and conquer）
FRAG.push(['sortlin-merge-topdown', 'Merge Sort（top-down）：分而治之', async (tok) => {
  fresh([0, 7.5, 12.5], [0, 2.4, 0]);
  await step(tok);                                   // 1:38:02 也可以 top-down
  const R = lRow([6, 5, 4, 7, 8, 3, 1, 2], { dx: 1.1, z: 1.4, idx: true });
  tag('top-down', 'ptr', -5.6, 1.4, 1.4);
  say('不做 bottom-up，也可以 top-down', '');
  await step(tok);                                   // 1:38:09 最終要排好，先把兩半排好
  let zl = R.zone(null, BLUE, 0, 3), zr = R.zone(null, GOLD, 4, 7);
  say('最終要把整段排好', '先想辦法把兩半各自排好');
  await step(tok);                                   // 1:38:18 寫成 recursive code
  const cd = code(['msort(l, r):', '  if l >= r: return', '  m = (l + r) / 2', '  msort(l, m);  msort(m+1, r)', '  merge(l, m, r)        // O(n)'], 0, 7.0, 0.5, -2.6);
  say('寫成 recursive code', '');
  await step(tok);                                   // 1:38:23 像 binary search：從中間切一半
  cd.hl(2);
  const mid = arrow(V3((R.x(3) + R.x(4)) / 2, 3.2, 1.4), V3((R.x(3) + R.x(4)) / 2, 1.2, 1.4), 0x7a1010);
  say('像 binary search：從中間切一半', '');
  const ms = async (l, r, sp) => {
    if (l >= r) return;
    const m = (l + r) >> 1;
    await ms(l, m, sp); await ms(m + 1, r, sp);
    await R.arrange(tok, l, R.v.slice(l, r + 1).sort((a, b) => a - b), sp);
  };
  await step(tok);                                   // 1:38:31 左邊先排好、右邊再排好
  cd.hl(3); kill(mid);
  await ms(0, 3, 650);
  say('一半的左邊先排好', 'msort(l, m)：遞迴下去');
  await step(tok);                                   // 1:38:38 binary search 只進一半；這裡兩邊都要排
  await ms(4, 7, 650);
  pkt('binary search 只走一半；這裡兩半都要', 0, 4.0, 1.4);
  say('Binary search 偷懶只進一半', '這裡左右兩半都要排好');
  await step(tok);                                   // 1:38:50 合併：n 的力氣
  cd.hl(4); kill(zl); kill(zr);
  await R.arrange(tok, 0, [1, 2, 3, 4, 5, 6, 7, 8], 1300); R.hl([0, 1, 2, 3, 4, 5, 6, 7], GREEN);
  say('再 merge 起來', '跟剛才一樣，花 n 的力氣');
  await step(tok);                                   // 1:38:59 呼叫 log n 個 level
  cd.hl(-1);
  good('log n 層遞迴 × 每層 n = O(n log n)', 0, 3.2, 1.4);
  say('遞迴呼叫 log n 個 level', '');
  await step(tok);                                   // 1:39:18 divide and conquer
  note('divide（切開）→ conquer（merge 合起來）', 0, -0.6, 2.4);
  say('這就是 divide and conquer', '分而治之：先分開，再合起來');
}]);

// 1:39:49 Merge Sort 的性質：n log n、stable、容易平行（各堆獨立）、適合 external sort
FRAG.push(['sortlin-merge-parallel', 'Merge Sort：stable、好平行、external sort', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 2, 0]);
  const R = lRow([6, 5, 4, 7, 8, 3, 1, 2], { dx: 1.25, y: 0.6 });
  const cores = [];
  const corez = (k, i, j) => { const g = ghostBox('#c08a20', (j - i + 1) * 1.25 - 0.1, 1.3, 1.3); g.position.set((R.x(i) + R.x(j)) / 2, 0.6, 0); const l = prop('cpu', g.position.x, 1.5, 0, 0.45); const t = tag('核心 ' + k, 'ptr', g.position.x, 2.3, 0); cores.push(g, l, t); };
  const clear = () => { cores.forEach(kill); cores.length = 0; };
  await step(tok);                                   // 1:39:49 不管 bottom-up、top-down 都是 n log n
  const n1 = good('bottom-up、top-down：都是 O(n log n)', 0, 4.4, 0);
  say('不管 bottom-up 還是 top-down', '都花 n log n 的力氣');
  await step(tok);                                   // 1:39:56 仔細實作通常是 stable
  txt(n1, '仔細實作：通常是 stable');
  say('仔細實作的話', '通常是 stable');
  await step(tok);                                   // 1:40:05 標準函式庫的 stable sort 用 merge sort
  txt(n1, '標準函式庫的 stable_sort：用 Merge Sort');
  say('所以標準函式庫的 stable sort', '基本上是用 merge sort 做的');
  await step(tok);                                   // 1:40:13 不同的堆可以獨立做
  for (let k = 0; k < 4; k++) corez(k + 1, 2 * k, 2 * k + 1);
  await Promise.all([R.arrange(tok, 0, [5, 6], 900), R.arrange(tok, 4, [3, 8], 900)]);
  txt(n1, '不同的堆：可以獨立做');
  say('一直作用在不同的堆上', '每一堆可以獨立做');
  await step(tok);                                   // 1:40:21 丟到不同核心去做
  clear(); corez(1, 0, 3); corez(2, 4, 7);
  await Promise.all([R.arrange(tok, 0, [4, 5, 6, 7], 1000), R.arrange(tok, 4, [1, 2, 3, 8], 1000)]);
  txt(n1, '多核心：各做各的，做完再合起來');
  say('多核心電腦上丟給不同核心', '做完再合起來就好');
  await step(tok);                                   // 1:40:33 Heap 牽一髮動全身，很難平行
  clear(); corez(1, 0, 7);
  await R.arrange(tok, 0, [1, 2, 3, 4, 5, 6, 7, 8], 1000);
  bad('Heap：牽一髮動全身，很難平行', 0, 5.4, 0);
  say('跟 Heap Sort 很不一樣', 'Heap 牽一髮動全身，很難平行化');
  await step(tok);                                   // 1:40:56 external sort：資料在磁碟上
  clear();
  const disk = prop('disk', -5.4, 0, -2.4, 1.3, '磁碟（大檔案）'); bob(disk, 0.04);
  txt(n1, 'External sort：資料在磁碟上，不在記憶體');
  say('External sort', '不是在記憶體裡排，是在磁碟上');
  await step(tok);                                   // 1:41:15 一段段抓進記憶體排好
  const chunk = pkt('一段資料', -5.4, 1.8, -2.4);
  await travel(tok, chunk, V3(-5.4, 1.8, -2.4), V3(0, 2.4, 0), 1200);
  await R.arrange(tok, 0, [8, 7, 6, 5, 4, 3, 2, 1].reverse(), 600);
  txt(chunk, '排好 → 寫回暫存檔');
  await travel(tok, chunk, V3(0, 2.4, 0), V3(-5.4, 1.8, -2.4), 1000);
  say('一次抓一段進記憶體排好', '再寫回暫存檔');
  await step(tok);                                   // 1:41:43 暫存檔再 merge 起來
  const f1 = prop('file', 3.6, 0, -2.4, 0.9), f2 = prop('file', 5.2, 0, -2.4, 0.9);
  const mg = pkt('merge', 4.4, 2.0, -2.4);
  txt(n1, '暫存檔之間再 merge：要靠 Merge Sort');
  say('再跟其他暫存檔 merge 起來', '這種情境需要 merge sort');
}]);

// 1:43:02 Tree Sort：全部塞進 Binary Search Tree，再 in-order traversal
const QV = [6, 1, 4, 9, 7, 8, 3, 10, 2, 5];
const rk = (v) => [...QV].sort((a, b) => a - b).indexOf(v);
const TX = (v) => (rk(v) - 4.5) * 1.15;
FRAG.push(['sortlin-treesort', 'Tree Sort：塞進 BST，再 in-order', async (tok) => {
  fresh([0, 6.5, 13.5], [0, 3, 0]);
  const TY = (d) => 6.3 - d * 1.3;
  const h = helper(-6.4, 2.6, '小幫手', 0.6);
  await step(tok);                                   // 1:43:02 影片裡沒有，但三秒就懂
  const n1 = note('影片裡沒有的 sort：三秒鐘就懂', 0, 7.0, 0);
  say('特別講一個影片裡沒有的 sort', '三秒鐘就懂');
  await step(tok);                                   // 1:43:17 BST、AVL tree、紅黑樹……
  ['BST', 'AVL tree', '紅黑樹'].forEach((t, k) => pkt(t, -2.4 + k * 2.4, 5.6, 0));
  say('花了好多力氣教 Binary Search Tree', 'AVL tree、紅黑樹……');
  await step(tok);                                   // 1:43:29 BST 本質上就是排好的資料結構
  txt(n1, 'BST：排序存在它的 node 裡');
  say('BST 本質上就是排好序的資料結構', '');
  await step(tok);                                   // 1:43:37 通通塞到 BST 裡面
  const T = {};
  for (const v of QV) {
    let p = null, cur = T.root, d = 0;
    while (cur) { p = cur; cur = v < cur.v ? cur.l : cur.r; d++; }
    const node = { v, l: null, r: null, d, m: cube(v, colorFor(v), [0.8, 0.8, 0.8], TX(v), TY(d), 0, 1.0) };
    if (p) { line(TX(p.v), TY(p.d), TX(v), TY(d), -0.1); if (v < p.v) p.l = node; else p.r = node; } else T.root = node;
    await beat(tok, 240);
  }
  say('把要排序的東西通通塞進 BST', '小的往左、大的往右');
  await step(tok);                                   // 1:43:56 再做 in-order traversal
  const ino = async (nd) => { if (!nd) return; await ino(nd.l); glow(nd.m, GREEN); cube(nd.v, colorFor(nd.v), [0.7, 0.7, 0.7], TX(nd.v), 0.4, 2.8, 1.0); await beat(tok, 230); glow(nd.m, null); await ino(nd.r); };
  await ino(T.root); h.mood('happy');
  say('再做 in-order traversal', '排好的東西就輸出來：1 2 3 … 10');
  await step(tok);                                   // 1:44:05 缺點：要花 n 的空間
  txt(n1, '缺點：整棵樹要 n 的額外空間');
  say('缺點：要花 n 的額外空間', '還要把 BST 處理好（可以用 library）');
  await step(tok);                                   // 1:44:27 樹糟 n²、樹好 n log n
  txt(n1, '樹長歪：O(n²)；樹還不錯：O(n log n)');
  say('時間跟做出什麼樣的樹有關', '很糟的樹 n²，不錯的樹 n log n');
  await step(tok);                                   // 1:44:45 不容易做成 stable
  txt(n1, '不容易做成 stable');
  h.mood('sad');
  say('不容易做成 stable', 'BST 的調整不一定保得住順序');
  await step(tok);                                   // 1:45:13 資料來來去去時是好方法：歌曲推薦
  h.mood('happy');
  const song = pkt('♪ 新歌加入', 6.0, 6.6, 0);
  await travel(tok, song, V3(6.0, 6.6, 0), V3(TX(8) + 0.6, TY(4), 0), 1200);
  txt(n1, '資料一直進進出出：例如推薦歌單');
  say('資料一直加進來、移掉的時候', '例如個人的歌曲推薦清單');
  await step(tok);                                   // 1:45:56 只是簡單排序：殺雞用牛刀
  kill(song);
  txt(n1, '只做簡單的排序：殺雞用牛刀');
  say('只是要做簡單的 sorting', '那就有點殺雞用牛刀');
  await step(tok);                                   // 1:46:03 把 Heap 換成更嚴格的 BST
  txt(n1, 'Heap（寬鬆）→ BST（嚴格）：不用 selection，in-order 就好');
  say('其實就是把 Heap 換成更嚴格的 BST', '不用 selection，in-order 就好');
}]);

// 1:46:46 Quick Sort = 用「隨機 root」的 BST 做 tree sort，但不真的建樹：只分成兩堆
FRAG.push(['sortlin-quick-as-bst', 'Quick Sort：pivot 就是 BST 的 root', async (tok) => {
  fresh([0, 6.5, 13], [0, 2.6, 0]);
  await step(tok);                                   // 1:46:46 剛才影片的 quick sort 在做什麼
  const ms = QV.map((v, i) => cube(v, colorFor(v), [0.8, 0.8, 0.8], (i - 4.5) * 1.1, 0.6, 2.4, 1.0));
  const n1 = note('Quick Sort 到底在做什麼？', 0, 6.9, 0);
  say('剛才影片的 Quick Sort', '到底在做什麼？');
  await step(tok);                                   // 1:46:56 說穿了就是 tree sort
  txt(n1, 'Quick Sort ＝ Tree Sort');
  say('說穿了就是剛才的 Tree Sort', '');
  await step(tok);                                   // 1:47:03 用的是一棵 random 的 BST
  txt(n1, '用的樹：random 的 BST（不是 AVL、紅黑樹）');
  say('它用的樹不是 AVL 或紅黑樹', '是一棵 random 的 BST');
  await step(tok);                                   // 1:47:22 A0 當 root
  glow(ms[0], GOLD); move(ms[0], 0, 5.6, 0);
  txt(n1, '先想簡單的：A0 = 6 當 root');
  say('先用 A0（6）當 BST 的 root', '');
  await step(tok);                                   // 1:47:34 BST：比 A0 小往左、大往右
  for (let i = 1; i < QV.length; i++) { glow(ms[i], QV[i] < 6 ? BLUE : PINK); await beat(tok, 140); }
  txt(n1, 'BST：比 6 小 → 左邊；比 6 大 → 右邊');
  say('BST 會把比 6 小的往左插', '比 6 大的往右插');
  await step(tok);                                   // 1:47:50 quick sort：小的一堆、大的一堆
  let nl = 0, nr = 0;
  for (let i = 1; i < QV.length; i++) { glow(ms[i], null); if (QV[i] < 6) move(ms[i], -5.2 + (nl++) * 0.95, 3.2, 0); else move(ms[i], 1.6 + (nr++) * 0.95, 3.2, 0); }
  await beat(tok, 900);
  line(0, 5.6, -3.3, 3.2, -0.1); line(0, 5.6, 3.0, 3.2, -0.1);
  txt(n1, 'Quick：比 6 小一堆（1 4 3 2 5）、比 6 大一堆（9 7 8 10）');
  say('Quick sort：比 6 小的放一堆', '比 6 大的放一堆');
  await step(tok);                                   // 1:48:12 那一堆自己去排好 ＝ 自己去建 BST
  [1, 2, 3, 4, 5].forEach((v, k) => move(ms[QV.indexOf(v)], -5.2 + k * 0.95, 3.2, 0));
  [7, 8, 9, 10].forEach((v, k) => move(ms[QV.indexOf(v)], 1.6 + k * 0.95, 3.2, 0));
  await beat(tok, 1100);
  txt(n1, '每一堆自己去 sort ＝ 自己去建 BST');
  say('左堆自己去 sort', '就像左子樹自己去建 BST');
  await step(tok);                                   // 1:48:37 in-order：左、中、右
  QV.forEach((v, i) => move(ms[i], TX(v), 0.6, 2.4)); glow(ms[0], GREEN);
  await beat(tok, 1100);
  txt(n1, 'In-order：左邊、中間、右邊 → 排好了');
  say('In-order：左邊、中間、右邊', '各自做好，接起來就排好了');
  await step(tok);                                   // 1:49:10 不需要真的 build 一棵樹
  pkt('心裡知道 6 是 root，樹不用真的建', 0, 5.2, 0);
  say('沒有真的 build 一棵樹', '資料就不知不覺排好了');
}]);

// 1:49:44 模擬：6 先分兩堆；左堆不幸抓到 1（0 個 vs 4 個）；抓中間 → 平衡 → log n 層 × 每層 n
FRAG.push(['sortlin-quick-levels', 'Quick Sort：一層一層分堆，長出一棵樹', async (tok) => {
  fresh([0, 6, 13.5], [0, 3.2, 0]);
  await step(tok);                                   // 1:49:44 寫一個快速的 simulation
  const T = qTree(QV, { dy: 1.3, top: 6.2 });
  say('來做個 simulation', '6 1 4 9 7 8 3 10 2 5');
  await step(tok);                                   // 1:49:49 一開始把 6 抓出來
  glow(T.M[6], GOLD); move(T.M[6], T.X(6), 6.9, 0);
  say('Quick sort 一開始把 6 抓出來', '想要 6 在中間');
  await step(tok);                                   // 1:50:00 1 4 3 2 5 一邊；9 7 8 10 另一邊
  const r1 = T.split(QV.slice(1), 0, 6, 0, null); await beat(tok, 900); T.done(6);
  say('1 4 3 2 5 在一邊', '9 7 8 10 在另一邊');
  await step(tok);                                   // 1:50:23 兩邊各自去做
  const zl = ghostBox(BLUE, 5.6, 1.0, 1.0); zl.position.set(-2.75, 4.9, 0);
  const zr = ghostBox(GOLD, 4.5, 1.0, 1.0); zr.position.set(3.3, 4.9, 0);
  say('然後兩邊各自去做', '');
  await step(tok);                                   // 1:50:33 左邊抓到 1：沒有比 1 小的
  kill(zl);
  const r2 = T.split(r1.L, 0, 1, 1, 6); await beat(tok, 900); T.done(1);
  say('左邊可能把 1 抓出來', '比 1 小的 0 個、比 1 大的 4 個');
  await step(tok);                                   // 1:50:41 unbalanced BST，歪向一邊
  const w = bad('不平衡：歪向一邊', -4.4, 4.0, 0);
  say('不幸：對應到 unbalanced 的 BST', 'root 下面沒有兩邊平衡發展');
  await step(tok);                                   // 1:51:26 盡量抓在中點附近
  kill(w); kill(zr);
  await T.finish(tok, r2.G, r2.hi, 2, 1, midPick, 260);
  await T.finish(tok, r1.G, r1.hi, 1, 6, midPick, 260);
  say('Quick sort 一直在抓中間人', '盡量抓在中點附近 → 左右平均');
  await step(tok);                                   // 1:51:58 平衡時只要 log n 層
  good('平衡：只要 log n 層', 4.6, 6.6, 0);
  say('平衡的話', '只需要 log n 那麼多層');
  await step(tok);                                   // 1:52:15 橫向：分兩堆、移位置要 n
  const band = ghostBox(GOLD, 11.5, 0.9, 0.8); band.position.set(0, 4.9, 0);
  await anim(tok, 1600, (u) => { band.position.y = 4.9 - u * 2.6; });
  say('橫向：把東西分兩堆、移位置', '每層花 n 的力氣');
  await step(tok);                                   // 1:52:29 總共 n log n
  QV.forEach((v) => move(T.M[v], T.X(v), 0.4, 2.6));
  good('縱向 log n × 橫向 n = O(n log n)', 0, 7.2, 0);
  say('總共的複雜度', '<span class="ok">O(n log n)</span>');
}]);

// 1:53:07 永遠挑第一個：1 2 … 10 會長成一條鍊；隨機挑 pivot 多半落在中間
FRAG.push(['sortlin-quick-sorted-input', 'Pivot 永遠挑第一個 vs 隨機挑', async (tok) => {
  fresh([0, 6, 13.5], [0, 3.2, 0]);
  const D = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  await step(tok);                                   // 1:53:07 每次都挑第一格
  const n1 = note('如果每次都挑第一個當中間人……', 0, 7.4, 0);
  say('要注意：如果每次都挑第一格', '');
  await step(tok);                                   // 1:53:14 很糟糕的 data：1 2 3 … 10
  let T = qTree(D, { dy: 0.58, top: 6.3 });
  say('遇到很糟的 data', '1 2 3 4 5 6 7 8 9 10');
  await step(tok);                                   // 1:53:26 總是挑第一個：樹永遠長歪
  await T.finish(tok, D, 0, 0, null, (pile) => pile[0], 230);
  bad('長成一條鍊：n 層 → O(n²)', 3.6, 1.0, 0);
  say('總是挑第一個：每次只切掉自己', '樹永遠長歪 → <span class="no">O(n²)</span>');
  await step(tok);                                   // 1:53:36 常做的事：randomly choose root
  fresh([0, 6, 13.5], [0, 3.2, 0]);
  T = qTree(D, { dy: 1.3, top: 6.2 });
  const n2 = note('Randomly choose：隨機選 root', 0, 7.4, 0);
  say('常做的事：隨機選 root', '');
  await step(tok);                                   // 1:53:55 quick sort 裡叫 pivot
  txt(n2, 'BST 的 root，在 Quick Sort 裡叫 pivot（仲裁點）');
  say('這個 root 在 quick sort 裡', '通常叫做 pivot');
  await step(tok);                                   // 1:54:08 隨機選，多半選到中間
  await T.finish(tok, D, 0, 0, null, midPick, 260);
  good('只有 ' + (T.depth + 1) + ' 層：接近 log n', 4.0, 1.0, 0);
  say('10 個人裡隨機選一個', '很多時候會選到比較中間的');
  await step(tok);                                   // 1:54:15 不要總是挑第一個
  txt(n2, '隨便選中間點，不要總是挑第一個');
  say('所以要隨便選一個中間點', '不要總是挑第一個');
}]);

// 1:54:30 真正的 partition：從左掃、從右掃；9↔5、7↔2、8↔3，最後 6↔3
FRAG.push(['sortlin-quick-partition', 'Partition：左右兩個指標掃過來交換', async (tok) => {
  fresh(LCAM, LLOOK);
  await step(tok);                                   // 1:54:30 從左邊掃過去，留下比中間點小的
  const R = lRow(QV.slice(), { idx: true, dx: 1.15, sz: 0.74 });
  const pi = tag('i →', 'ptr', 0, 0, 0), pj = tag('← j', 'ptr alt', 0, 0, 0);
  R.at(pi, 1, 1.3); pj.element.style.visibility = 'hidden';
  say('真正在做的時候', '從左邊掃過去：留下比中間點小的');
  await step(tok);                                   // 1:54:41 從右邊掃回來，留下比中間點大的
  pj.element.style.visibility = ''; R.at(pj, 9, 1.9);
  say('從右邊掃回來', '留下比中間點大的');
  await step(tok);                                   // 1:54:50 中間點 6：1 比較小，沒問題
  R.hl([0], GOLD);
  R.hl([1], GREEN); await beat(tok, 600); gl(R.m[1], null);
  say('中間點是 6', '1 比 6 小：留在左邊沒問題');
  await step(tok);                                   // 1:54:58 4 沒問題；9 不應該在左邊；右邊看到 5
  R.at(pi, 2, 1.3); R.hl([2], GREEN); await beat(tok, 500); gl(R.m[2], null);
  R.at(pi, 3, 1.3); R.hl([3], RED); await beat(tok, 500);
  R.hl([9], RED);
  say('4 沒問題；9 比 6 大，不該在左邊', '從右邊掃，看到 5');
  await step(tok);                                   // 1:55:09 5 不該在右邊：9 跟 5 交換
  await R.swap(tok, 3, 9, 1000); R.off(); R.hl([0], GOLD);
  say('5 比 6 小，不該在右邊', '把 9 跟 5 交換');
  await step(tok);                                   // 1:55:19 quick sort 裡的 long jump
  const lj = pkt('long jump：左右各送一個過去', 0, 3.4, 0);
  say('這是 quick sort 裡的一種 long jump', '');
  await step(tok);                                   // 1:55:25 7 比較大、2 比較小：交換
  kill(lj);
  R.at(pi, 4, 1.3); R.at(pj, 8, 1.9); R.hl([4, 8], RED); await beat(tok, 500);
  await R.swap(tok, 4, 8, 900); R.off(); R.hl([0], GOLD);
  say('再掃下去：7 比較大、2 比較小', '交換：2 到左邊、7 到右邊');
  await step(tok);                                   // 1:55:38 10 沒問題；8 太大、3 太小：交換
  R.at(pi, 5, 1.3); R.hl([5], RED);
  R.at(pj, 7, 1.9); R.hl([7], GREEN); await beat(tok, 450); gl(R.m[7], null);
  R.at(pj, 6, 1.9); R.hl([6], RED); await beat(tok, 450);
  await R.swap(tok, 5, 6, 800); R.off(); R.hl([0], GOLD);
  say('10 比較大沒問題', '8 太大、3 太小：交換');
  await step(tok);                                   // 1:56:00 1 4 5 2 3 比 6 小；8 10 7 9 比 6 大
  R.at(pi, 6, 1.3); R.at(pj, 5, 1.9);
  const zl = R.zone(null, BLUE, 1, 5), zr = R.zone(null, PINK, 6, 9);
  say('i、j 交錯了', '1 4 5 2 3 比 6 小，8 10 7 9 比 6 大');
  await step(tok);                                   // 1:56:11 把 6 跟 3 換過來
  await R.swap(tok, 0, 5, 1100); R.off(); R.hl([5], GREEN);
  kill(zl); kill(zr); R.zone(null, BLUE, 0, 4); R.zone(null, PINK, 6, 9);
  say('最後把 6 跟 3 換過來', '6 站到最終位置');
  await step(tok);                                   // 1:56:21 6 左邊都比 6 小、右邊都比 6 大
  pi.element.style.visibility = 'hidden'; pj.element.style.visibility = 'hidden';
  good('左邊 < 6 < 右邊：再各自繼續', 0, 3.2, 0);
  say('6 的左邊通通比 6 小', '右邊通通比 6 大，再繼續下去');
}]);

// 1:56:56 Quick Sort 實務：橫向兩指標 n、縱向隨機 pivot；三數取中；recursion 要 stack；最壞情形（內建「quick-worst-case」的 cued 版本）
FRAG.push(['sortlin-quick-practice', 'Quick Sort 實務：pivot 選法、stack、最壞情形', async (tok) => {
  const v = [3, 5, 7, 9, 11, 13, 15];
  await step(tok);                                   // 1:56:56 橫向：兩個指標，n 的力氣
  Object.assign(CFG.dc, { algo: 'quick', input: 'sorted', pivot: 'first', rule: 'bari', vals: v.slice(), n: 7 }); enterDC(false); controls('');
  const n1 = note('橫向：兩個指標一左一右掃 → 每層 n', 0, 4.4, 0);
  say('橫向：兩個指標一左一右掃', '維持 n 的力氣');
  await step(tok);                                   // 1:57:04 縱向：隨機選 pivot，大機率平衡
  txt(n1, '縱向：隨機選 pivot → 大機率分成平衡的兩堆');
  say('縱向：隨機選 pivot', '大機率分成平衡的兩堆，log n 層');
  await step(tok);                                   // 1:57:40 選第一個有缺點
  txt(n1, '已排好的資料 ＋ 永遠選第一個');
  await runTo(tok, lastStep(), 2600);
  const worst = S.steps[lastStep()].cmp;
  txt(n1, '選第一個：一邊 0 個、一邊 n−1 個 → 比較 ' + worst + ' 次');
  say('選第一個有缺點', '已排好的資料：每次只切掉自己');
  await step(tok);                                   // 1:57:49 選三個，取最中間的（median of three）
  Object.assign(CFG.dc, { pivot: 'median3', vals: v.slice() }); enterDC(false); controls('');
  await runTo(tok, lastStep(), 2600);
  const n2 = note('三數取中：比較 ' + S.steps[lastStep()].cmp + ' 次（原本 ' + worst + ' 次）', 0, 4.4, 0);
  say('也有人選三個位置', '取最中間的那個（median of three）');
  await step(tok);                                   // 1:58:03 recursion：要付出 stack 的空間
  txt(n2, 'Recursion：除了原本的空間，還要呼叫堆疊的空間');
  say('用 recursion 實作', '還要在 stack 上付出一些空間');
  await step(tok);                                   // 1:58:10 最壞：長出不平衡的樹
  txt(n2, '最壞情形：不平衡的樹 → O(n²)');
  say('最壞的情形', '長出一棵不平衡的樹');
  await step(tok);                                   // 1:58:28 大資料、不需要 stability 時很有用
  txt(n2, '運氣不太差：大資料、不需要 stable 時很好用');
  say('運氣不太差的話很快', '大資料、不需要 stability 時很有用');
  Object.assign(CFG.dc, { pivot: 'first', input: 'video', vals: null, n: 9 });
}]);

// 1:58:33 Quick Sort 混合 Insertion Sort：大堆 partition、小堆 insertion
FRAG.push(['sortlin-hybrid', '混合排序：大堆 partition、小堆 insertion', async (tok) => {
  fresh(LCAM, LLOOK);
  await step(tok);                                   // 1:58:33 小資料時 recursion 有 overhead
  const R = lRow([7, 2, 10, 5, 12, 1, 9, 4, 13, 3, 11, 8], { idx: true, dx: 0.95, sz: 0.7 });
  const n1 = note('小資料：recursion 有 overhead；Insertion 很好用', 0, 3.6, 0);
  say('比較小的資料', 'recursion 有 overhead，insertion 反而好用');
  await step(tok);                                   // 1:58:46 quick 從大堆分到小堆
  const o = { ms: 170, parts: [], z: null };
  await hybridRun(tok, R, 0, 11, 5, o);
  txt(n1, 'Quick：像 merge 一樣，從大堆分到小堆');
  say('Quick sort 從大堆分到小堆', '');
  await step(tok);                                   // 1:58:55 不一定要分到最小的堆
  txt(n1, '堆已經夠小（≤ 5 個）：不用再分下去');
  say('小堆那邊', '不一定要一路 quick sort 到最小');
  await step(tok);                                   // 1:59:05 insertion 是 n²，但常數考慮進去比較 efficient
  const parts = o.parts.slice(); o.ms = 48;
  for (const [a, b] of parts) await hybridRun(tok, R, a, b, 6, o);
  if (o.z) kill(o.z); R.off(); R.hl(R.m.map((_, i) => i), GREEN);
  txt(n1, '小堆：insertion sort（n²，但常數小）');
  say('Insertion 雖然是 n²', '常數考慮進去，小堆反而比較快');
  await step(tok);                                   // 1:59:13 quicksort 混合 insertion sort
  txt(n1, 'Quick Sort ＋ Insertion Sort');
  say('Quick sort 混合 insertion sort', '到小堆就做 insertion');
  await step(tok);                                   // 1:59:25 實務上常見
  const h = helper(-6.0, 1.6, '小幫手', 0.6); h.mood('happy');
  good('實務上常見的 implementation', 0, 4.6, 0);
  say('這是實務上', '常見的 implementation');
}]);

// 1:59:37 Sorting 之間的脈絡：selection → heap → tree → quick；quick 與 merge 的 recursion
FRAG.push(['sortlin-family', 'Sorting 的脈絡：從 selection 到 quick', async (tok) => {
  fresh([0, 6, 13], [0, 3, 0]);
  const N = {};
  const node = (k, name, x, y, c) => { N[k] = { x, y, m: cube(name, c, [2.5, 0.75, 0.7], x, y, 0, 1.2) }; };
  const link = (a, b, lbl) => { const A = N[a], B = N[b]; const dx = Math.sign(B.x - A.x) * 1.3, dy = Math.sign(B.y - A.y) * 0.45; arrow(V3(A.x + (dx ? dx : 0), A.y + (dx ? 0 : dy), 0), V3(B.x - (dx ? dx : 0), B.y - (dx ? 0 : dy), 0)); tag(lbl, 'idx', (A.x + B.x) / 2 + (dx ? 0 : 1.5), (A.y + B.y) / 2 + (dx ? 0.55 : 0), 0); };
  const h = helper(-6.2, 0.2, '小幫手', 0.6);
  await step(tok);                                   // 1:59:37 最後一頁 best use，自己做做看
  const n1 = note('最後一頁：best use，有興趣自己試試', 0, 7.0, 0);
  say('最後一頁是 best use', '有興趣可以自己做做看');
  await step(tok);                                   // 1:59:49 quick sort 必講；給完整的面向
  node('quick', 'Quick Sort', 5.2, 5.4, '#b07ad0');
  txt(n1, 'Quick Sort 必講；其他是給你完整的面向');
  say('Quick sort 是課程必須講的', '其他是給大家完整的面向');
  await step(tok);                                   // 2:00:01 每個 sorting 都是計算思維的巧思
  txt(n1, '每個 sorting：一種計算思維的巧思');
  h.mood('wow');
  say('每一個 sorting algorithm', '都代表一種計算思維的巧思');
  await step(tok);                                   // 2:00:19 bubble 最好用的地方是教學
  node('bub', 'Bubble', -5.2, 1.4, '#e2a04b');
  bub('最好用在：教學', -2.6, 1.4, 0);
  say('Bubble sort 最好用的地方', '其實是教學');
  await step(tok);                                   // 2:00:45 selection → heap sort
  node('sel', 'Selection', -5.2, 5.4, '#4b9ee2');
  node('heap', 'Heap Sort', -1.75, 5.4, '#2fc092'); link('sel', 'heap', 'pile → Heap');
  txt(n1, '把 sorting 之間的脈絡串起來');
  say('從 selection sort 到 heap sort', '');
  await step(tok);                                   // 2:00:52 heap → BST（tree sort）→ quick sort
  node('tree', 'Tree Sort', 1.75, 5.4, '#e2a04b'); link('heap', 'tree', 'Heap → BST'); link('tree', 'quick', '隨機 root');
  say('Heap 換成 BST：tree sort', '再到 quick sort');
  await step(tok);                                   // 2:00:59 quick 的 recursion 跟 merge 的 recursion
  node('merge', 'Merge Sort', 5.2, 2.6, '#c0504d'); link('quick', 'merge', 'recursion：異同？');
  h.mood('happy');
  say('Quick 跟 merge 的 recursion', '有什麼一樣、不一樣？值得想想');
}]);

// 2:20:01 總結：每個 sorting 都連到學過的資料結構；radix、counting 沒時間教
FRAG.push(['sortlin-ds-links', 'Sorting 連回學過的資料結構', async (tok) => {
  fresh([0, 6, 12.5], [0, 2.9, 0]);
  const P = [['Merge Sort', 'Sparse array 合併'], ['Heap Sort', 'Heap'], ['Quick Sort', 'Binary Search Tree'], ['Insertion', 'Linked list'], ['Selection', 'Array、Heap']];
  const msg = [['Merge 裡有 sparse array 的 merge', ''], ['Heap sort 裡當然有 Heap', ''], ['Quick sort 跟 BST 有關係', ''], ['Linked list 跟 insertion 比較貼近', ''], ['Selection 跟 Heap、跟 array 的連結', '']];
  const pair = async (k) => {
    const y = 5.4 - k * 1.15;
    const a = cube(P[k][0], '#4b9ee2', [2.6, 0.75, 0.7], -3.6, y, 0, 1.2), b = cube(P[k][1], '#2fc092', [3.0, 0.75, 0.7], 3.6, y, 0, 1.2);
    await beat(tok, 500);
    line(-2.2, y, 2.0, y, 0, '#6a4a00'); glow(a, GOLD); glow(b, GOLD); say(msg[k][0], msg[k][1]);
    await beat(tok, 900); glow(a, null); glow(b, null);
  };
  await step(tok);                                   // 2:20:03 很多東西都連到教過的資料結構
  tag('Sorting', 'ptr', -3.6, 6.4, 0); tag('資料結構', 'ptr alt', 3.6, 6.4, 0);
  say('Sorting 裡的很多東西', '一個一個連到教過的資料結構');
  await step(tok); await pair(0);                    // 2:20:11 merge：sparse array
  await step(tok); await pair(1);                    // 2:20:23 heap sort：Heap
  await step(tok); await pair(2);                    // 2:20:30 quick sort：BST
  await step(tok); await pair(3);                    // 2:20:46 linked list ↔ insertion
  await step(tok); await pair(4);                    // 2:20:59 selection ↔ Heap、array
  await step(tok);                                   // 2:21:05 radix sort：透過影片講過
  const n1 = note('Radix Sort：只透過影片看過', 0, -0.4, 0.8);
  say('Radix sort 這學期沒時間教', '剛才透過影片講過');
  await step(tok);                                   // 2:21:12 counting sort：先數每個 element 出現幾次
  const cv = [3, 1, 3, 2, 1, 3];
  const cnt = [0, 0, 0, 0];
  const cl = [1, 2, 3].map((v) => tag(v + '：0 個', 'pkt', -2.4 + (v - 1) * 2.4, -1.4, 1.6));
  for (const v of cv) { cnt[v]++; txt(cl[v - 1], v + '：' + cnt[v] + ' 個'); await beat(tok, 300); }
  txt(n1, 'Counting Sort：先數每個值出現幾次 → 知道放哪');
  say('Counting sort', '先數每個 element 出現幾次，再決定放哪');
  await step(tok);                                   // 2:21:27 跟 radix 搭配；有興趣自己找資料
  txt(n1, 'Counting ＋ Radix 可以搭配；有興趣自己找資料');
  say('Counting 跟 radix 可以搭配', '有興趣自己找資料、上 forum 討論');
}]);
  }

  // ═══ sortmit.js ═══
  {
// ─── MIT 6.006：Nz1KZXbghj8（L7 Counting Sort, Radix Sort：比較模型下界 → 整數排序）與 9bkvws_vqLU（Rec7 複習） ───
// Cued scenes: every `await step(tok)` waits for the sentence it shows; beats are motion only.
// 只用 K 與 ctx。老師的例子：L7 binary search 決策樹 n = 3（a1 < x? → a0 < x? / a2 < x?）、排序葉子 a5 a7 a1 a0 …、
// log n! 取後半段、counting 用 3 5 7 5 5 3 6（兩個 3 = 雲／愛心）；Rec7 counting 用 4 1 3 2 3（3a、3b），
// pos = 0 0 1 2 4 5，尾端放 n = 5 由右往左減；radix 用 2341 1432 2413 1243 2143 1234。
// L7 的 radix 沒有板書例子：拆位數用 2341（取自 Rec7）、選 b 的長條用 n = 16、k = 4096 示意。
// 左下角的小幫手跟著反應（驚訝、開心、困惑）。
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, code, anim, line, ghostBox, travel, remove, buddy, step, GOLD, GREEN, RED, GRAY } = K;
const say = ctx.say, beat = ctx.beat, colorFor = ctx.colorFor;
const BLUE = '#1f3a6e', INK = '#3a3328', PAPER = '#efe3c8', MINT = '#d4e8da';
const MCAM = [0, 7.5, 13], MLOOK = [0, 2, 0];
const mN = (v) => parseInt(String(v), 10) || 0;
const mCol = (v) => colorFor(mN(v));
const bubble = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const pkt = (t, x, y, z = 0) => tag(t, 'pkt', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const guide = (x = -6.2, z = 1.8, s = 0.7) => buddy('', '', '#ffc56b', x, 0, z, s);
// a row of cubes on floor tiles; R.x(i) = slot position
function mRow(vals, o = {}) {
  const n = o.n || vals.length, dx = o.dx || 1.1, y = o.y === undefined ? 0.45 : o.y, z = o.z || 0, sz = o.sz || [0.8, 0.8, 0.8];
  const x0 = o.x0 === undefined ? -(n - 1) * dx / 2 : o.x0;
  const R = { v: vals.slice(), m: [], n, dx, y, z, x: (i) => x0 + i * dx, ix: [] };
  if (o.tiles !== false) for (let i = 0; i < n; i++) ctx.tile(V3(R.x(i), 0.02, z), dx * 0.9, 0.95);
  if (o.idx) for (let i = 0; i < n; i++) R.ix[i] = tag(o.idx === true ? String(i) : o.idx[i], 'idx', R.x(i), 0.05, z + 0.72);
  if (o.name) tag(o.name, 'ptr', x0 - dx * 0.5 - 0.95, y, z);
  vals.forEach((v, i) => { if (v === null || v === undefined) return; R.m[i] = cube(v, o.color ? o.color(v) : mCol(v), sz, R.x(i), y, z, o.drop ? 2.4 : 0); });
  R.hl = (list, c) => list.forEach((i) => { if (R.m[i]) glow(R.m[i], c); });
  R.off = () => R.m.forEach((m) => { if (m) glow(m, null); });
  return R;
}
// a text box (decision node, info card)
const mBox = (t, x, y, z = 0, w = 2.4, c = PAPER, drop = 0) => cube(t, c, [w, 0.7, 0.8], x, y, z, drop);
// a code panel whose lines appear one by one: P.show(i) reveals line i (and lights it)
function mCode(lines, x, yTop, dy, z) {
  const P = code(lines, x, yTop, dy, z), w = Math.max(...lines.map((s) => s.length));
  P.ls.forEach((l) => txt(l, ''.padEnd(w, ' ')));
  P.show = (i, lit = true) => { txt(P.ls[i], lines[i].padEnd(w, ' ')); if (lit) P.hl(i); };
  P.set = (i, s) => txt(P.ls[i], s.padEnd(w, ' '));
  return P;
}

// ── decision tree of binary search, n = 3 (the lecturer's board) ──
const BS = [
  ['r', 'a1 < x ?', 0, 5.4, null, ''],
  ['L', 'a0 < x ?', -3.2, 3.7, 'r', 'no'],
  ['R', 'a2 < x ?', 3.2, 3.7, 'r', 'yes'],
  ['l0', 'x ≤ a0', -4.7, 1.9, 'L', 'no'],
  ['l1', 'a0 < x ≤ a1', -1.6, 1.9, 'L', 'yes'],
  ['l2', 'a1 < x ≤ a2', 1.6, 1.9, 'R', 'no'],
  ['l3', 'a2 < x', 4.7, 1.9, 'R', 'yes'],
];
function mBSNode(N, id, drop = 1.2) {
  const [, t, x, y, p, side] = BS.find((r) => r[0] === id);
  if (p) {
    const [, , qx, qy] = BS.find((r) => r[0] === p);
    line(qx, qy - 0.35, x, y + 0.35);
    if (side) tag(side, 'idx', (qx + x) / 2 + (x > qx ? 0.45 : -0.45), (qy + y) / 2, 0);
  }
  const leaf = id[0] === 'l';
  N[id] = mBox(t, x, y, 0, leaf ? 2.6 : 2.2, leaf ? MINT : PAPER, drop);
  return N[id];
}
const mBSTree = () => { const N = {}; for (const r of BS) mBSNode(N, r[0], 0); return N; };

// 0:30 計畫：定理（下界）、證明、「反例」（換模型就能線性）
FRAG.push(['sortmit-plan', '今天的計畫：下界與線性時間排序', async (tok) => {
  fresh([0, 6.2, 12], [0, 2, 0]);
  const gd = guide(-6.2, 2.2);
  await step(tok);                                   // 0:30 linear-time sorting: when possible, when not
  bubble('Linear-time sorting：什麼時候可能？什麼時候不可能？', 0, 5.4, 0);
  say('今天：線性時間排序', '什麼時候做得到、什麼時候做不到');
  await step(tok);                                   // 0:36 theorem, proof, counterexample
  ['定理', '證明', '「反例」'].forEach((t, i) => note(t, -2.4 + i * 2.4, 4.5, 0));
  say('課程結構：定理、證明、反例');
  await step(tok);                                   // 0:48 theorem: sorting needs n log n (worst case)
  const b = cube('sort：Ω(n log n)', PAPER, [3.6, 0.8, 1], -3.2, 1.4, 0, 3);
  say('定理：排序最差至少要 n log n 時間');
  await step(tok);                                   // 0:53 then: sometimes linear time
  const c = cube('有時候 O(n)！', MINT, [3.2, 0.8, 1], 3.2, 1.4, 0, 3);
  gd.mood('wow');
  say('然後證明：有時候可以線性時間', '這不是矛盾嗎？');
  await step(tok);                                   // 1:00 both correct: different models of computation
  tag('Comparison model', 'ptr', -3.2, 2.5, 0); tag('RAM model', 'ptr alt', 3.2, 2.5, 0);
  gd.mood('calm');
  say('兩個定理都對：model of computation 不同');
  await step(tok);                                   // 1:12 the comparison model: good for lower bounds
  glow(b, GOLD);
  note('適合用來證明下界（lower bound）', -3.2, 3.3, 0);
  say('Comparison model', '很適合拿來證明「至少要多久」');
  await step(tok);                                   // 1:22 searching needs log n: binary search is optimal
  const a = cube('search：Ω(log n)', PAPER, [3.6, 0.8, 1], -3.2, 0.5, 0, 3);
  say('下界一：搜尋要 log n', 'binary search 已是最佳');
  await step(tok);                                   // 1:27 sorting needs n log n: merge sort is optimal
  glow(a, GOLD);
  good('binary search、merge sort 都是最佳', -3.2, -0.5, 1.0);
  say('下界二：排序要 n log n', 'merge sort 已是最佳');
  await step(tok);                                   // 1:31 break out to the RAM model: linear time
  cube('counting sort', MINT, [3.2, 0.8, 1], 3.2, 0.5, 0, 3);
  glow(c, GREEN);
  gd.mood('happy'); await gd.hop(tok);
  say('最後跳出 comparison model', '在 RAM model 某些情況做到線性');
}]);

// 1:56 Comparison model：item 是黑盒子，只能比較；cost = 比較次數
FRAG.push(['sortmit-cmp-model', 'Comparison model：只能比大小', async (tok) => {
  fresh(MCAM, MLOOK);
  const gd = guide(-6.2, 2.0);
  await step(tok);                                   // 1:56 restrict the operations to comparisons
  bubble('Comparison model：只允許「比較」', 0, 4.6, 0);
  say('只允許一種操作：比較');
  await step(tok);                                   // 2:06 input items are black boxes
  const R = mRow(['?', '?', '?', '?', '?'], { color: () => INK, dx: 1.6, drop: true });
  gd.mood('wow');
  say('每個 input item 都是黑盒子', '看不到裡面是什麼');
  await step(tok);                                   // 2:22 abstract data type: supports one operation, compare
  note('abstract data type：只支援 compare', 0, 3.6, 0);
  gd.mood('calm');
  say('每個 item 像一個只支援「比較」的資料結構');
  await step(tok);                                   // 2:52 less than, ≤, >, ≥, =
  const ops = tag('可用：<　≤　>　≥　=', 'ptr', 0, 2.6, 0);
  R.hl([0, 1], GOLD);
  const q = tag('a0 < a1 ?', 'pkt', R.x(0.5), 1.6, 0);
  say('可以用 <、≤、>、≥、=');
  await step(tok);                                   // 3:09 a binary answer: yes or no
  txt(q, 'a0 < a1 ? → yes');
  say('每次比較只得到 yes / no', '這是唯一的操作');
  await step(tok);                                   // 3:24 merge sort moves items, but only compares them
  R.off(); remove(q); kill(ops);
  mBox('Merge sort：只用比較', -4.2, 0.4, 2.4, 3.2, MINT, 2);
  say('Merge sort：搬動 item、改指標', '但認識 item 的方式只有比較');
  await step(tok);                                   // 3:34 heaps and heap sort, binary search trees: only compare
  mBox('Heap sort：只用比較', 0, 0.4, 2.4, 3.2, MINT, 2);
  mBox('BST：只用比較', 4.2, 0.4, 2.4, 3.2, MINT, 2);
  gd.mood('happy');
  say('Heap、Heap sort、BST 也只用比較', '→ 都在這個模型裡');
  await step(tok);                                   // 3:59 time cost = number of comparisons
  const alg = buddy('比較次數', 0, '#b9d3ea', 5.6, 0, -1.0, 0.8);
  for (let k = 0; k < 3; k++) { R.off(); R.hl([k, k + 2], GOLD); alg.set(k + 1); await beat(tok, 450); }
  R.off(); gd.mood('wow');
  say('時間 cost = 比較的次數', '其他操作都不收費');
  await step(tok);                                   // 4:28 even counting only comparisons: search log n, sort n log n
  note('search：至少 log n　sort：至少 n log n', 0, 3.6, 1.2);
  alg.mood('wow');
  say('就算只算比較次數', '搜尋要 log n、排序要 n log n');
}]);

// 4:50 Binary search 的決策樹（n = 3）
FRAG.push(['sortmit-bs-tree', 'Binary Search 的決策樹（n = 3）', async (tok) => {
  fresh([0, 5, 13], [0, 3, 0]);
  const gd = guide(-6.2, 2.6, 0.6), N = {};
  await step(tok);                                   // 4:50 the decision tree
  bubble('Decision tree（決策樹）', 0, 6.6, 0);
  say('證明下界的工具：decision tree');
  await step(tok);                                   // 6:08 all possible comparisons, outcomes and answers
  note('畫出演算法所有可能的比較、結果與答案', 0, 6.0, 0);
  gd.mood('wow');
  say('把演算法「所有可能的執行」畫成一棵樹');
  await step(tok);                                   // 6:32 example: binary search
  gd.mood('calm');
  say('例子：binary search', '看中間、比較、往左或往右');
  await step(tok);                                   // 7:06 n = 3, array indexed from 0
  mRow(['a0', 'a1', 'a2'], { idx: true, z: 3.2, y: 0.4, color: () => '#b9d3ea', drop: true });
  say('n = 3 的已排序陣列', '找 x 該落在哪裡');
  await step(tok);                                   // 7:38 first: is a1 < x ?
  mBSNode(N, 'r'); glow(N.r, GOLD);
  say('第一步一定是：a1 < x ?', '圓圈（節點）= 一次比較');
  await step(tok);                                   // 7:58 no → x ≤ a1 → compare a0 < x ?
  glow(N.r, null); mBSNode(N, 'L'); glow(N.L, GOLD);
  say('no：x ≤ a1，在左邊', '再問 a0 < x ?');
  await step(tok);                                   // 8:12 no again → x ≤ a0, put it in a box
  glow(N.L, null); mBSNode(N, 'l0'); glow(N.l0, GREEN);
  say('又是 no：x ≤ a0', '方框 = 演算法結束、得到答案');
  await step(tok);                                   // 8:38 yes → a0 < x ≤ a1
  mBSNode(N, 'l1'); glow(N.l1, GREEN);
  say('yes：a0 < x ≤ a1', 'x 夾在 a0 和 a1 中間');
  await step(tok);                                   // 9:10 x right of a1 → check x against a2
  mBSNode(N, 'R'); glow(N.R, GOLD);
  say('第一題答 yes：x 在 a1 右邊', '再問 a2 < x ?');
  await step(tok);                                   // 9:32 yes → x is bigger than a2: outside the array
  glow(N.R, null); mBSNode(N, 'l3'); glow(N.l3, GREEN);
  say('yes：a2 < x', 'x 比全部都大，在陣列右邊外面');
  await step(tok);                                   // 9:48 no → between a1 and a2
  mBSNode(N, 'l2'); glow(N.l2, GREEN);
  gd.mood('happy');
  say('no：a1 < x ≤ a2', '四片葉子 = x 可能落在的四個區間');
  await step(tok);                                   // 10:04 a sorting algorithm's tree would be exponential
  note('排序的樹會大到指數級', 4.6, 6.4, 0);
  gd.mood('wow');
  say('排序也能這樣畫，但樹會非常大', '只拿來分析，不拿來寫程式');
  await step(tok);                                   // 10:21 you see all possible executions at once
  gd.mood('happy');
  say('好處：一眼看到所有可能的執行');
}]);

// 11:10 一次執行 = 根到葉的路徑；時間 = 路徑長；最差 = 樹高
FRAG.push(['sortmit-tree-path', '執行 = 根到葉的路徑，最差 = 樹高', async (tok) => {
  fresh([0, 5, 13], [0, 3, 0]);
  const gd = guide(-6.2, 2.6, 0.6), N = mBSTree();
  await step(tok);                                   // 11:10 internal node = a binary decision
  ['r', 'L', 'R'].forEach((k) => glow(N[k], GOLD));
  say('內部節點 = 一次 binary decision', '這裡就是一次比較');
  await step(tok);                                   // 11:37 a leaf = the answer is found
  ['r', 'L', 'R'].forEach((k) => glow(N[k], null)); ['l0', 'l1', 'l2', 'l3'].forEach((k) => glow(N[k], GREEN));
  say('葉子 = 演算法結束，回傳答案');
  await step(tok);                                   // 12:25 a single execution corresponds to…?
  ['l0', 'l1', 'l2', 'l3'].forEach((k) => glow(N[k], null));
  const cur = tag('x', 'pkt', 0, 6.4, 0);
  gd.mood('wow');
  say('問題：一次執行對應到樹上的什麼？');
  await step(tok);                                   // 12:38 a root-to-leaf path
  glow(N.r, GOLD); await travel(tok, cur, V3(0, 6.4, 0), V3(-3.2, 4.6, 0), 800);
  glow(N.L, GOLD); await travel(tok, cur, V3(-3.2, 4.6, 0), V3(-1.6, 2.8, 0), 800);
  glow(N.l1, GREEN);
  gd.mood('calm');
  say('從根一路走到葉子：root-to-leaf path');
  await step(tok);                                   // 13:04 running time = length of the path
  say('這次執行花多少時間？', '= 路徑的長度');
  await step(tok);                                   // 13:17 x between a0 and a1: one, two comparisons → cost 2
  const cost = buddy('cost', 0, '#b9d3ea', -5.4, 0, -1.2, 0.8);
  for (let k = 1; k <= 2; k++) { cost.set(k); await beat(tok, 600); }
  cost.mood('happy');
  say('x 在 a0、a1 之間：比了 2 次', '路徑長度也是 2');
  await step(tok);                                   // 13:36 the worst-case running time?
  say('那「最差」執行時間是什麼？');
  gd.mood('wow');
  await step(tok);                                   // 13:52 the height of the tree
  ['l0', 'l1', 'l2', 'l3'].forEach((k) => glow(N[k], GREEN));
  tag('height（樹高）', 'ptr alt', 5.6, 3.7, 0);
  say('最差 = 最長的 root-to-leaf path = 樹高');
  await step(tok);                                   // 14:21 here 2; binary search in general log n
  good('這裡高度 = 2；binary search 一般是 log n', 0, 0.6, 1.2);
  gd.mood('calm');
  say('這棵樹高 2', 'binary search 一般是 log n');
  await step(tok);                                   // 14:46 how low can you make your tree?
  bubble('最少要多少時間？ ⇔ 樹最矮能多矮？', 0, 6.6, 0);
  gd.mood('happy'); await gd.hop(tok);
  say('問題變成：樹最矮能多矮？', '樹的事我們很熟');
}]);

// 15:35 搜尋下界：至少 n 片葉子 → 高度 ≥ log n
FRAG.push(['sortmit-search-lb', '搜尋下界：n 片葉子 → 高度 ≥ log n', async (tok) => {
  fresh([0, 5, 13], [0, 3, 0]);
  const gd = guide(-6.3, 2.6, 0.6);
  const Y = [5.6, 4.4, 3.2, 1.9], W = 8, X0 = 1.5, pos = [], leaves = [];
  const drawLevel = (d) => {
    const c = 1 << d; pos[d] = [];
    for (let i = 0; i < c; i++) {
      const x = X0 + ((i + 0.5) / c - 0.5) * W; pos[d][i] = x;
      if (d) line(pos[d - 1][i >> 1], Y[d - 1] - 0.3, x, Y[d] + 0.3);
      const nd = cube(d === 3 ? 'a' + i : '', d === 3 ? MINT : PAPER, d === 3 ? [0.8, 0.6, 0.7] : [0.7, 0.6, 0.7], x, Y[d], 0, 1);
      if (d === 3) leaves.push(nd);
    }
  };
  await step(tok);                                   // 15:35 searching among n preprocessed items
  mBox('n 個前處理過的 item', -4.4, 5.6, 0, 3.6, PAPER, 1.5);
  say('定理：在 n 個前處理過的 item 中找一個 item');
  await step(tok);                                   // 16:18 requires Ω(log n) comparisons
  const th = mBox('最差需要 Ω(log n) 次比較', -4.4, 4.7, 0, 3.6, MINT, 1.5);
  say('comparison model 裡最差要 Ω(log n) 次比較');
  await step(tok);                                   // 16:32 preprocessing is free: sort them, build an AVL tree
  note('前處理免費：先排序、建 AVL tree 都行', -4.4, 3.8, 0);
  gd.mood('wow');
  say('前處理隨便做、不收費', '但找新的 item 還是要 log n');
  await step(tok);                                   // 17:29 each step only no or yes → binary tree
  drawLevel(0); drawLevel(1);
  gd.mood('calm');
  say('每一步只有 yes / no', '→ 決策樹是二元樹');
  await step(tok);                                   // 17:39 the height could be large: linear search has height n
  const ch = [];
  for (let k = 0; k < 4; k++) { ch.push(cube('', '#cfc6b6', [0.4, 0.4, 0.4], -4.4, 2.8 - k * 0.6, 0, 0.6)); if (k) ch.push(line(-4.4, 3.4 - k * 0.6 - 0.2, -4.4, 2.8 - k * 0.6 + 0.2)); }
  const lt = bad('linear search：高度 n', -4.4, 0.4, 0);
  say('樹也可能很高：linear search 高度是 n', '我們在意的是「最矮」');
  await step(tok);                                   // 17:56 the tree has to contain all possible answers
  ch.forEach(kill); kill(lt);
  bubble('樹必須包含所有可能的答案', X0, 6.6, 0);
  gd.mood('wow');
  say('關鍵：樹必須包含所有可能的答案');
  await step(tok);                                   // 18:20 the decision tree is binary
  drawLevel(2); await beat(tok, 400); drawLevel(3);
  for (let d = 0; d < 4; d++) tag((1 << d) + ' 個', 'idx', 6.3, Y[d], 0);
  gd.mood('calm');
  say('決策樹是二元的', '每往下一層，節點最多 ×2');
  await step(tok);                                   // 18:34 at least n leaves, one for each answer
  leaves.forEach((m) => glow(m, GREEN));
  say('至少 n 片葉子：每個答案至少一片', 'x 可能等於 n 個 item 中的任何一個');
  await step(tok);                                   // 18:58 several leaves may share an answer
  note('同一個答案可以有好幾片葉子', X0, 0.9, 0.6);
  say('葉子可能比答案多', '沒關係，我們只需要「至少 n 片」');
  await step(tok);                                   // 19:41 at least n leaves → height ≥ log n
  tag('2ʰ ≥ n ⇒ h ≥ log n', 'ptr alt', -4.4, 2.4, 0);
  say('高度 h 的二元樹最多 2ʰ 片葉子', '2ʰ ≥ n ⇒ h ≥ log n');
  await step(tok);                                   // 19:55 the height is the worst-case running time: done
  glow(th, GREEN);
  gd.mood('happy'); await gd.hop(tok);
  say('樹高 = 最差執行時間 → 得證');
  await step(tok);                                   // 20:29 binary search is optimal in the comparison model
  good('binary search 是最佳的', -4.4, 1.6, 0);
  say('binary search 在 comparison model 裡是最佳的');
  await step(tok);                                   // 20:46 BST search / successor / predecessor need log n
  good('BST 的 search、successor 也至少 log n', X0, 0.2, 1.4);
  say('BST 的 search、找下一個／上一個', '不管怎麼做都至少 log n');
}]);

// 21:36 排序的決策樹：內部節點 aᵢ < aⱼ ?，葉子是排列；n! 片葉子
FRAG.push(['sortmit-sort-leaves', '排序的決策樹：葉子是排列', async (tok) => {
  fresh([0, 5, 13], [0, 3, 0]);
  const gd = guide(-6.3, 2.6, 0.6);
  await step(tok);                                   // 21:40 how many leaves does it have to have?
  bubble('排序的決策樹：至少要幾片葉子？', 0, 6.6, 0);
  say('同樣的策略：決策樹是二元的', '問題是要幾片葉子');
  await step(tok);                                   // 21:45 not drawing it: the tree is ginormous
  const big = note('樹高 n log n → 約 2^(n log n) 個節點，畫不完', 0, 6.0, 0);
  gd.mood('wow');
  say('排序的樹太大，不畫完整的例子');
  await step(tok);                                   // 22:20 internal nodes compare two items: ai < aj ?
  remove(big);
  const r = mBox('ai < aj ?', 0, 5.4, 0, 2.2, PAPER, 1.2);
  gd.mood('calm');
  say('內部節點：比較兩個 item', 'ai < aj ?');
  await step(tok);                                   // 22:34 a no and a yes; swaps don't appear
  line(-0.5, 5.05, -3, 4.15); line(0.5, 5.05, 3, 4.15);
  tag('no', 'idx', -1.9, 4.75, 0); tag('yes', 'idx', 1.9, 4.75, 0);
  note('交換（swap）不出現在樹上', 3.6, 5.4, 0);
  say('分成 no、yes 兩條路', '樹上只記比較，交換不算');
  await step(tok);                                   // 22:47 a leaf: a5, then a7, then a1, then a0…
  const lf = mBox('a5 ≤ a7 ≤ a1 ≤ a0 ≤ …', -3, 3.8, 0, 4.2, MINT, 1.2);
  glow(lf, GREEN);
  say('葉子：寫出排好的順序', 'a5 最小、再來 a7、a1、a0……');
  await step(tok);                                   // 23:13 you just write down the order; not charged
  note('寫下答案：不收費', -3, 2.9, 0);
  say('最後直接寫下排序結果', '只有比較要收費');
  await step(tok);                                   // 23:39 decision tree is binary
  kill(lf);
  say('決策樹是二元的', '和搜尋一樣');
  await step(tok);                                   // 23:49 leaves ≥ number of possible answers
  const cnt = tag('葉子數 ≥ 答案數', 'ptr alt', 0, 0.6, 2);
  say('葉子數 ≥ 可能的答案數', '同一個答案可能出現在好幾片葉子');
  await step(tok);                                   // 24:04 n factorial: the number of permutations
  const perms = ['a0 a1 a2', 'a0 a2 a1', 'a1 a0 a2', 'a1 a2 a0', 'a2 a0 a1', 'a2 a1 a0'];
  for (let i = 0; i < 6; i++) { mBox(perms[i], -5.25 + i * 2.1, 1.9, 0, 1.9, MINT, 1.5); await beat(tok, 350); }
  txt(cnt, 'n = 3：3! = 6 種排列');
  gd.mood('wow');
  say('答案有幾種？n!（排列數）', 'n = 3 時有 6 種');
  await step(tok);                                   // 24:15 all items distinct → n! permutations: worst case
  txt(cnt, '葉子數 ≥ n!');
  say('元素都不同時有 n! 種排列', '這就是最壞情況');
  await step(tok);                                   // 24:32 height ≥ log₂ n!
  tag('高度 ≥ log₂(n!)', 'ptr', 0, 6.6, 0);
  gd.mood('calm');
  say('所以高度 ≥ log₂ n!', 'n = 3：⌈log₂ 6⌉ = 3 次比較');
}]);

// 25:06 log n! = Σ log i ≥ (n/2)·log(n/2) = Ω(n log n)；Stirling 給出 n log n − O(n)
FRAG.push(['sortmit-logfact', 'log n! = Σ log i = Ω(n log n)', async (tok) => {
  fresh([0, 4.5, 12.5], [0, 2.2, 0]);
  const gd = guide(-6.4, 2.4, 0.6);
  const n = 16, dx = 0.72, x0 = -(n - 1) * dx / 2 + 0.4, S = 1.1, bars = [];
  await step(tok);                                   // 25:06 Stirling's formula, or write it as a sum
  note('方法一：Stirling 公式', -3, 6.2, 0); note('方法二：寫成總和', 3, 6.2, 0);
  say('要證 log n! ≥ n log n', '可以用 Stirling，或寫成總和');
  await step(tok);                                   // 25:32 log of a product = sum of logs
  for (let i = 1; i <= n; i++) {
    const h = Math.max(0.06, Math.log2(i) * S);
    bars[i] = cube(null, '#9fc4e6', [0.6, h, 0.6], x0 + (i - 1) * dx, h / 2, 0);
    tag(String(i), 'idx', x0 + (i - 1) * dx, 0.05, 0.6);
    await beat(tok, 110);
  }
  tag('n = 16', 'ptr', -5.6, 5.2, 0);
  say('log 乘積 = log 的總和', 'log n! = log n + log(n−1) + … + log 1');
  await step(tok);                                   // 25:47 summation: Σ log i
  bubble('log n! = Σ over i=1..n log i', 1.5, 5.4, 0);
  say('寫成 Σ log i（i 從 1 到 n）', '每根長條高 = log i');
  await step(tok);                                   // 26:02 at most n log n: easy
  const top = ghostBox(GOLD, n * dx, 0.05, 0.7); top.position.set(x0 + (n - 1) * dx / 2, 4 * S, 0);
  say('每項 ≤ log n → 總和 ≤ n log n', '「至多」很容易');
  await step(tok);                                   // 26:06 we need at least n log n
  kill(top); gd.mood('wow');
  say('要證的是「至少」n log n', '這比較難');
  await step(tok);                                   // 26:19 log looks like this: area under the curve
  for (let i = 1; i <= n; i++) glow(bars[i], '#1f3a6e');
  await beat(tok, 500);
  for (let i = 1; i <= n; i++) glow(bars[i], null);
  say('log 曲線：先爬得快、後面很平', '總和 ≈ 曲線下的面積');
  await step(tok);                                   // 27:03 look at the last half: all about log n
  for (let i = n / 2; i <= n; i++) tint(bars[i], '#4b9ee2');
  gd.mood('calm');
  say('看後一半：每一項都差不多是 log n');
  await step(tok);                                   // 27:21 throw away the first n/2 terms
  for (let i = 1; i < n / 2; i++) tint(bars[i], GRAY);
  say('丟掉前一半的項', 'Σ over i=1..n ≥ Σ over i=n/2..n log i');
  await step(tok);                                   // 27:24 each term is at least log(n/2)
  const half = ghostBox(GREEN, (n / 2 + 1) * dx, 3 * S, 0.75);
  half.position.set(x0 + (n / 2 - 1) * dx + (n / 2) * dx / 2, 1.5 * S, 0);
  say('後一半每項 ≥ log(n/2)', '把每項都換成 log(n/2)，總和只會更小');
  await step(tok);                                   // 27:42 log(n/2) = log n − 1
  bubble('log(n/2) = log n − 1', 1.5, 4.4, 0);
  say('log(n/2) = log n − 1');
  await step(tok);                                   // 28:00 n/2 terms → (n/2)(log n − 1)
  bubble('≥ (n/2)(log n − 1)', 1.5, 3.6, 0);
  say('一共 n/2 項', '≥ (n/2)(log n − 1)');
  await step(tok);                                   // 28:14 = Ω(n log n)
  good('= Ω(n log n)：排序下界得證', 1.5, 2.8, 0.6);
  gd.mood('happy'); await gd.hop(tok);
  say('(n/2) log n 是主項', '<span class="ok">Ω(n log n)</span>');
  await step(tok);                                   // 28:44 Stirling: n! ≈ √(2πn)(n/e)ⁿ
  note('Stirling：n! ≈ √(2πn)·(n/e)ⁿ', -3, 5.4, 0.6);
  gd.mood('calm');
  say('另一種做法：Stirling 公式', 'n! ≈ √(2πn)(n/e)ⁿ');
  await step(tok);                                   // 29:24 n log n − O(n): the constant is 1
  note('取 log：n log n − O(n)', -3, 4.6, 0.6);
  say('取 log 得 n log n − O(n)', '常數其實是 1（剛剛證到 1/2 也夠）');
}]);

// 29:57 回顧：比較樹 → 數葉子 → 取 log；搜尋（前處理）log n；沒前處理其實要 n，但只證得到 log n
FRAG.push(['sortmit-lb-recap', '下界回顧：前處理與「不一定緊」', async (tok) => {
  fresh([0, 5.5, 12], [0, 2, 0]);
  const gd = guide(-6.4, 2.4, 0.6);
  const row = (r, a, b, c) => { const y = 3.4 - r * 1.4; mBox(a, -2.6, y, 0, 4.2, PAPER, 1.2); const m = mBox(b, 2.6, y, 0, 4.6, MINT, 1.2); glow(m, c); return m; };
  await step(tok);                                   // 30:00 framework: binary tree → count leaves → take log
  ['比較樹是二元的', '至少幾片葉子？', '取 log → 下界'].forEach((t, i) => bubble(t, -3.6 + i * 3.6, 5.6, 0));
  say('框架：二元樹 → 數葉子 → 取 log');
  await step(tok);                                   // 30:22 searching: n preprocessed items
  row(0, 'search（已前處理）', 'Ω(log n)', GREEN);
  say('搜尋：n 個已前處理的 item');
  await step(tok);                                   // 30:32 comparisons among items are free; only x vs items is charged
  note('item 之間的比較免費，只算 x 和 item 的比較', 0, 4.5, 0.6);
  say('item 兩兩比較都免費', '只對 x 和 item 的比較收費');
  await step(tok);                                   // 30:56 sorting: not preprocessed
  row(2, 'sort（沒前處理）', 'Ω(n log n)', GREEN);
  say('排序：沒有前處理');
  await step(tok);                                   // 31:03 if preprocessed you'd need zero comparisons
  note('先排好的話：0 次比較', 2.6, -0.4, 0.6);
  gd.mood('wow');
  say('如果已經前處理過，排序根本不用比');
  await step(tok);                                   // 31:07 search without preprocessing needs n, but proof gives log n
  row(1, 'search（沒前處理）', '實際要 n；這招只證到 log n', GOLD);
  say('沒前處理的搜尋其實要 n（linear search）', '但這個證法只證得到 log n');
  await step(tok);                                   // 31:30 the technique may not give a tight bound
  bad('下界一定正確，但不一定「緊」', 0, 0.4, 1.2);
  gd.mood('sad');
  say('這個技巧給的是下界', '不一定等於真正的答案（不一定 tight）');
  await step(tok);                                   // 31:37 search always log n (even preprocessed); sort n log n
  gd.mood('happy'); await gd.hop(tok);
  say('結論：搜尋就算前處理也要 log n', '排序（沒前處理）要 n log n');
}]);

// 31:58 離開 comparison model：整數排序（key 是 0..k−1 的整數、放得進一個 word）
FRAG.push(['sortmit-integer-model', '整數排序：key 是 0..k−1 的整數', async (tok) => {
  fresh([0, 6.5, 12], [0, 1.5, 0]);
  const gd = guide(-6.3, 2.4, 0.6);
  const k = 8, dx = 1.25, x0 = -(k - 1) * dx / 2, ix = [];
  await step(tok);                                   // 31:58 henceforth not in the comparison model
  const cm = mBox('comparison model', 0, 3.6, 0, 3.6, PAPER, 1.5);
  say('從現在開始（包括之後的 hashing）', '都不在 comparison model 裡');
  await step(tok);                                   // 32:29 RAM: memory is an array, O(1) access
  fly(cm);
  for (let i = 0; i < k; i++) { ctx.tile(V3(x0 + i * dx, 0.02, 0), dx * 0.9, 1); ix[i] = tag('[' + i + ']', 'idx', x0 + i * dx, 0.05, 0.75); }
  tag('RAM：記憶體是一個陣列，任一格 O(1) 存取', 'ptr', 0, 2.2, -1.2);
  say('RAM：記憶體就是一個大陣列', '任何一格都能 O(1) 存取');
  await step(tok);                                   // 32:38 use the RAM's power to sort in linear time, sometimes
  gd.mood('wow');
  say('用 RAM 的能力', '有時候能線性時間排序');
  await step(tok);                                   // 32:52 a better title: integer sorting
  bubble('Integer sorting（整數排序）', 0, 4.6, 0);
  say('這段更貼切的名字：integer sorting');
  await step(tok);                                   // 33:13 the things you sort are integers (or map to them)
  gd.mood('calm');
  say('假設要排的東西是整數', '不是整數的，通常也能對應成整數');
  await step(tok);                                   // 33:43 keys are integers; n of them
  const keys = [3, 5, 7, 5, 5, 3, 6], hgt = {};
  for (const v of keys) { hgt[v] = (hgt[v] || 0) + 1; cube(v, mCol(v), [0.8, 0.6, 0.8], x0 + v * dx, 0.32 + (hgt[v] - 1) * 0.62, 0, 2.5); await beat(tok, 250); }
  say('n 個 key，每個都是整數');
  await step(tok);                                   // 34:02 in a range: non-negative, 0 .. k − 1
  txt(ix[k - 1], 'k−1');
  note('範圍：0 … k−1（非負整數）', 0, 3.4, 0);
  say('key 都在 0 … k−1 之間', '假設非負，比較好想');
  await step(tok);                                   // 34:16 k is a parameter, like n
  tag('k = 可能的值有幾種（新參數）', 'ptr alt', 0, 4.0, -1.2);
  say('k 是新的參數', '就像 n 一樣');
  await step(tok);                                   // 34:27 each fits in a word
  const w = ghostBox(GOLD, 1.2, 0.8, 1.1); w.position.set(x0 + 3 * dx, 0.4, 0);
  note('一個 key 放得進一個 word', x0 + 3 * dx, 1.4, 0.6);
  say('每個 key 都放得進一個 word', 'word = 電腦一次能處理的一格');
  await step(tok);                                   // 35:01 compare, add, subtract, multiply, divide: O(1)
  bubble('比較 ＋ − × ÷ ：都是 O(1)', 3.0, 3.0, 1.0);
  gd.mood('wow');
  say('可以比較，也可以加減乘除', '每個都是 O(1)：比只能比較強多了');
  await step(tok);                                   // 35:43 for k not too big: linear time
  good('k 不太大 → 可以線性時間排序', 0, -0.2, 1.6);
  gd.mood('happy');
  say('k 不太大時，可以線性時間排序');
  await step(tok);                                   // 35:53 still a research area; conjecture: always linear
  note('研究前沿：猜想永遠都能線性', -3.4, 5.2, 0);
  gd.mood('calm');
  say('整數排序到現在還是研究題目', '猜想：所有情況都能線性');
  await step(tok);                                   // 36:10 best so far: n √(log log n) w.h.p.
  note('目前最佳：n√(log log n)（高機率）', 3.4, 5.2, 0);
  say('目前最佳：O(n√(log log n))', '已經很接近 n，比 n log n 好很多');
  await step(tok);                                   // 36:42 many cases: easy linear time
  gd.mood('happy'); await gd.hop(tok);
  say('很多常見情況（k 不大）', '線性時間排序其實很簡單');
}]);

// ── counting with counters: A (input) → count[v]++ → write each value count[v] times ──
function mCounter(vals, k, o = {}) {
  const S = { cnt: Array(k).fill(0), A: null, C: null, O: null };
  const dxC = Math.min(1.1, 11 / k);
  S.showA = () => { S.A = mRow(vals, { z: o.za === undefined ? -2.6 : o.za, idx: true, name: 'A', drop: true }); };
  S.showC = () => { S.C = mRow(Array(k).fill('0'), { z: 0.6, idx: true, name: 'count', color: () => PAPER, sz: [0.8, 0.4, 0.8], y: 0.25, dx: dxC, drop: true }); };
  S.inc = async (tok, j, ms = 450) => {
    const v = mN(vals[j]);
    S.A.off(); S.C.off(); S.A.hl([j], GOLD); glow(S.C.m[v], GOLD);
    S.cnt[v]++; relabel(S.C.m[v], S.cnt[v]);
    say('看到 ' + vals[j] + ' → count[' + v + '] 加一', 'count[' + v + '] = ' + S.cnt[v]);
    await beat(tok, ms);
  };
  S.showO = () => { S.O = mRow(Array(vals.length).fill(null), { z: 3.4, idx: true, name: 'out' }); };
  S.write = async (tok, ms = 280) => {
    let w = 0;
    for (let v = 0; v < k; v++) {
      S.C.off(); glow(S.C.m[v], S.cnt[v] ? GREEN : GRAY);
      if (!S.cnt[v]) { await beat(tok, ms * 0.4); continue; }
      for (let c = 0; c < S.cnt[v]; c++) { cube(v, mCol(v), [0.8, 0.8, 0.8], S.O.x(w), S.O.y, S.O.z, 2); w++; await beat(tok, ms); }
    }
    S.C.off();
  };
  return S;
}

// 36:51 Counting Sort 的直覺：3 5 7 5 5 3 6 → 數每個值有幾個
FRAG.push(['sortmit-count-357', 'Counting Sort：數一數 3 5 7 5 5 3 6', async (tok) => {
  fresh([0, 8.5, 11], [0, 0.6, 0.4]);
  const gd = guide(-6.4, 3.4, 0.6), S = mCounter([3, 5, 7, 5, 5, 3, 6], 8);
  await step(tok);                                   // 36:51 first algorithm: counting sort
  bubble('Counting sort', 0, 3.4, -2.6);
  say('第一個線性排序：counting sort');
  await step(tok);                                   // 37:01 no comparisons; depends on n and k
  note('完全不比較！時間看 n 和 k', 0, 2.6, -2.6);
  gd.mood('wow');
  say('counting sort 完全不做比較', '時間取決於 n 和 k');
  await step(tok);                                   // 37:18 count all the items: 3 5 7 5 5 3 6
  S.showA();
  gd.mood('calm');
  say('名字就是做法：數一數', '例子：3 5 7 5 5 3 6');
  await step(tok);                                   // 37:32 two 3's, three 5's, one 6, one 7
  S.A.hl([0, 5], GOLD); await beat(tok, 500); S.A.off(); S.A.hl([1, 3, 4], BLUE);
  say('兩個 3、三個 5、一個 6、一個 7');
  await step(tok);                                   // 37:42 the smallest key 3: write two 3's, then three 5's…
  S.A.off();
  bubble('寫出：3 3 5 5 5 6 7', 0, 1.7, -1.0);
  say('3 最小有兩個就寫兩個 3', '再寫三個 5、一個 6、一個 7');
  await step(tok);                                   // 38:11 allocate an array of counters, size k
  S.showC();
  say('開一個大小 k 的計數陣列', 'k 種可能的 key → k 個計數器');
  await step(tok);                                   // 38:23 run through the items: key 3 → increment index 3
  for (let j = 0; j < 7; j++) await S.inc(tok, j, 380);
  S.A.off(); S.C.off();
  gd.mood('happy');
  say('一路走過去：看到 key 就把那一格加一', '兩個 3、三個 5、一個 6、一個 7');
  await step(tok);                                   // 38:43 then how do I output? traverse the counters
  S.showO();
  gd.mood('calm');
  say('怎麼輸出？依 index 順序走過計數陣列', '陣列本來就依 key 排好');
  await step(tok);                                   // 39:06 the 3 position ends up with the value 2
  glow(S.C.m[3], GOLD);
  say('index 3 的格子是 2', '代表有兩個 3');
  await step(tok);                                   // 39:15 skip the zeros; nonzero → write the key that many times
  await S.write(tok, 260);
  say('0 的格子直接跳過', '非 0 的就照次數寫出來');
  await step(tok);                                   // 39:30 but all it does is sort integers
  bad('只能排整數本身，帶不走其他資料', 0, 1.6, 4.6);
  gd.mood('sad');
  say('這個版本只能排「整數本身」', '老師說不值得寫下來');
}]);

// 39:42 帶著衛星資料：每格改成 list（雲朵 3、愛心 3）
FRAG.push(['sortmit-count-lists', 'Counting Sort（list 版）：帶著整筆資料', async (tok) => {
  fresh([0, 9, 11], [0, 1.4, 0.6]);
  const gd = guide(-6.4, 3.4, 0.6);
  const vals = ['3☁', 5, 7, 5, 5, '3♥', 6], k = 8, dx = 1.25;
  const P = mCode(['L = [[] for i in range(k)]', 'for j in range(n):', '    L[key(A[j])].append(A[j])', 'output = []', 'for i in range(k):', '    output.extend(L[i])'], 0, 6.7, 0.48, -3.6);
  await step(tok);                                   // 39:42 each item has a key, but also other stuff
  const A = mRow(vals, { z: -2.2, idx: true, name: 'A', drop: true });
  say('每個 item 有一個 key', '但通常還帶著其他資料');
  await step(tok);                                   // 39:52 like sorting a spreadsheet by one column
  note('像試算表依某一欄排序：整列資料都要跟著走', 0, 2.0, -2.2);
  say('像試算表「依這一欄排序」', '整列資料都要一起搬');
  await step(tok);                                   // 40:08 this 3 has a cloud, that 3 has a heart
  A.hl([0, 5], GOLD);
  gd.mood('wow');
  say('兩個 3：一個畫雲、一個畫愛心', '它們是不同的 item');
  await step(tok);                                   // 40:21 which 3 goes first?
  say('只說「有兩個 3」：哪一個先？', '雲先、還是愛心先？');
  await step(tok);                                   // 40:34 I want to put the cloud and the heart somewhere
  A.off();
  gd.mood('calm');
  say('要把雲和愛心「本人」放到正確位置');
  await step(tok);                                   // 40:58 an array of k things: no longer counters, now lists
  const B = mRow(Array(k).fill(null), { z: 0.4, idx: true, name: 'L', dx });
  P.show(0);
  say('一樣是大小 k 的陣列', '但每格不是計數器，而是一個 list');
  await step(tok);                                   // 41:14 for j: L[key(A[j])].append(A[j])
  P.show(1, false); P.show(2);
  const lists = Array.from({ length: k }, () => []);
  for (let j = 0; j < vals.length; j++) {
    const v = mN(vals[j]), m = A.m[j];
    move(m, B.x(v), 0.45, 0.4 + lists[v].length * 0.95);
    lists[v].push(m); A.m[j] = null;
    await beat(tok, 380);
  }
  gd.mood('happy');
  say('依序把每個 item append 到 L[key]', '放進去的是整個 item');
  await step(tok);                                   // 41:26 the output is an empty list initially
  P.show(3);
  const O = mRow(Array(vals.length).fill(null), { z: 4.3, idx: true, name: 'out' });
  gd.mood('calm');
  say('output 一開始是空的 list');
  await step(tok);                                   // 41:43 iterate through the array: output.extend(L[i])
  P.show(4, false); P.show(5);
  let w = 0;
  for (let v = 0; v < k; v++) for (const m of lists[v]) { move(m, O.x(w), O.y, O.z); w++; await beat(tok, 300); }
  say('依 i = 0 … k−1 把 L[i] 接到 output 後面', '同一格裡的順序 = 原本出現的順序');
  await step(tok);                                   // 41:58 this is counting sort; the textbook uses three arrays
  P.hl(-1);
  note('課本版本：不用 list，用三個陣列，時間一樣', 0, 2.4, 4.3);
  say('這就是 counting sort 的一種版本', '課本用三個陣列，時間相同');
  await step(tok);                                   // 42:29 like the key function in Python's sort
  bubble('key(x)：取出 0..k−1 的整數', 3.6, 1.8, -2.2);
  say('key(A[j])：像 Python sort 的 key 函式', '保證是 0 … k−1 的整數');
  await step(tok);                                   // 42:44 the item is not just the key: everything
  good('雲朵 3 仍在愛心 3 前面', -2.6, 1.6, 4.3);
  gd.mood('happy'); await gd.hop(tok);
  say('搬的是整個 item，不只是 key', '雲朵 3 還在愛心 3 前面');
}]);

// 43:08 時間分析：建 k 個空 list O(k)、n 次 append O(n)、串接 Σ(|Lᵢ| + 1) → O(n + k)
FRAG.push(['sortmit-count-time', 'Counting Sort 的時間：O(n + k)', async (tok) => {
  fresh([0, 8, 11], [0, 1, 0.6]);
  const gd = guide(-6.4, 2.4, 0.6);
  const k = 8, vals = [3, 5, 7, 5, 5, 3, 6], dx = 1.25, x0 = -(k - 1) * dx / 2;
  const tally = buddy('步數', 0, '#b9d3ea', 5.9, 0, 2.6, 0.75);
  let s = 0;
  const T = [], L = Array.from({ length: k }, () => []);
  await step(tok);                                   // 43:08 creating k empty lists: O(k)
  for (let i = 0; i < k; i++) { T[i] = cube('[]', PAPER, [1, 0.25, 1], x0 + i * dx, 0.15, -1.6, 1); tally.set(++s); await beat(tok, 200); }
  tag('O(k)', 'ptr alt', 0, 1.2, -2.6);
  say('建 k 個空 list：每個 O(1)', '共 O(k)');
  await step(tok);                                   // 43:13 each append is constant → n appends
  for (const v of vals) { L[v].push(cube(v, mCol(v), [0.8, 0.6, 0.8], x0 + v * dx, 0.45, -0.1 + L[v].length * 0.85, 2)); tally.set(++s); await beat(tok, 300); }
  tag('O(n)', 'ptr alt', -3.6, 1.2, 2.2);
  gd.mood('wow');
  say('append 一次 O(1)（key 是一個 word）', 'n 次 → O(n)');
  await step(tok);                                   // 43:35 concatenating L[i] takes |L[i]|
  const cur = tag('▼', 'ptr', x0, 1.5, -1.6);
  for (let i = 0; i < k; i++) { cur.position.set(x0 + i * dx, 1.5, -1.6); glow(T[i], GOLD); await beat(tok, 240); glow(T[i], null); }
  gd.mood('calm');
  say('串接時，看 L[i] 要花 |L[i]|', '有幾個 item 就花多少');
  await step(tok);                                   // 43:51 an empty list still needs a look: + 1
  [0, 1, 2, 4].forEach((i) => glow(T[i], GRAY));
  note('空的也要看一眼：+1', x0 + 1.5 * dx, 1.4, -1.6);
  say('空的 list 也要看一眼', '所以每格是 |L[i]| + 1');
  await step(tok);                                   // 43:54 Σ|L[i]| = n, plus 1 each → n + k
  bubble('Σ(|L[i]| + 1) = n + k = 7 + 8', 0, 3.6, 0);
  say('|L[i]| 加起來 = 全部 item = n', '每格再加 1 → n + k');
  await step(tok);                                   // 44:10 counting sort is O(n + k)
  good('Counting sort = O(n + k)', 0, 2.8, 0.6);
  gd.mood('happy');
  say('counting sort 的時間：O(n + k)');
  await step(tok);                                   // 44:12 if k = O(n): linear time
  say('k = O(n) 時就是線性時間');
  await step(tok);                                   // 44:17 a bit bigger and you're in trouble: a warm-up
  bad('k 一大就慢 → 只是暖身', 0, 2.0, 1.2);
  gd.mood('sad');
  say('k 稍微大一點就不行了', 'counting sort 只是暖身');
}]);

// ── radix matrix: one row per number (along z), one cube per digit (along x) ──
const RX_NUMS = ['2341', '1432', '2413', '1243', '2143', '1234'];
function mRadix(nums, o = {}) {
  const X = [-2.1, -0.7, 0.7, 2.1], z0 = o.z0 === undefined ? -3 : o.z0, dz = 1.15;
  const M = { rows: [], z: (r) => z0 + r * dz, X };
  for (let c = 0; c < 4; c++) tag(['千', '百', '十', '個'][c] + '位', 'idx', X[c], 0.05, z0 - 0.9);
  nums.forEach((s, r) => {
    const m = s.split('').map((d, c) => cube(d, colorFor(+d), [1.0, 0.7, 0.9], X[c], 0.4, M.z(r), o.drop ? 2 + r * 0.3 : 0));
    M.rows.push({ s, m });
  });
  M.col = (c, color) => M.rows.forEach((R) => glow(R.m[c], color));
  M.rowHl = (s, color) => M.rows.forEach((R) => { if (R.s === s) R.m.forEach((m) => glow(m, color)); });
  M.off = () => M.rows.forEach((R) => R.m.forEach((m) => glow(m, null)));
  // move rows into the given order
  M.order = async (tok, list, ms = 1200) => {
    const by = {}; M.rows.forEach((R) => { by[R.s] = R; });
    const nr = list.map((s) => by[s]);
    nr.forEach((R, r) => R.m.forEach((m, c) => move(m, X[c], 0.4, M.z(r))));
    M.rows = nr; await beat(tok, ms);
  };
  return M;
}
const stableBy = (list, c) => list.slice().sort((a, b) => (+a[c]) - (+b[c]) || list.indexOf(a) - list.indexOf(b));

// 44:45 Radix Sort 的想法：拆成 base b 的 d 位數，從最低位排到最高位（像試算表依欄排序）
FRAG.push(['sortmit-radix-idea', 'Radix Sort：拆位數、從最低位排', async (tok) => {
  fresh([0, 9, 10], [0, 0, 0.3]);
  const gd = guide(-6.0, 2.6, 0.6);
  await step(tok);                                   // 44:45 radix sort uses counting sort as a subroutine
  bubble('Radix sort：用 counting sort 當副程式', 0, 2.4, -5.3); // both top lines sit above the digit table's column names
  say('radix sort 拿 counting sort 當副程式', '能處理大得多的 k');
  await step(tok);                                   // 45:09 k can be polynomial: up to n^100, still linear
  note('key 到 n¹⁰⁰ 也還是線性時間！', 0, 1.6, -5.0);
  gd.mood('wow');
  say('k 可以是 n 的多項式', '例如 key 在 0 … n¹⁰⁰，仍是線性時間');
  await step(tok);                                   // 45:38 the spreadsheet approach: break each integer into columns
  const M = mRadix(RX_NUMS, { drop: true });
  tag('示意（十進位）', 'idx', 4.0, 0.05, -3.9);
  gd.mood('calm');
  say('把每個整數拆成好幾欄', '像試算表（Excel）的做法');
  await step(tok);                                   // 46:03 write the numbers in some base b
  say('就像平常寫數字，但不一定是十進位', '任意 base b');
  await step(tok);                                   // 46:11 least significant digit, the next one, …
  for (let c = 3; c >= 0; c--) { M.off(); M.col(c, GOLD); await beat(tok, 450); }
  M.off();
  say('最低位、次低位、……一串位數');
  await step(tok);                                   // 46:18 max value k → d = log_b k digits
  bubble('位數 d = log_b k（+1）', 5.3, 1.6, -2.0); // right of the digit table, clear of its column names
  say('最大值是 k → 位數 d = log_b k', '+1 之類的不用太精確');
  await step(tok);                                   // 46:51 we won't actually compute the base-b representation
  note('不必先轉成 base b（那要 n log k 時間）', 4.6, 1.6, 0.9);
  say('不必真的先算出 base b 表示法', '那要 n·log k 時間');
  await step(tok);                                   // 47:08 sort all integers by the least significant digit
  M.col(3, GOLD);
  say('第 1 回合：依最低位，把「全部」整數排序', '這個例子剛好已依個位排好');
  await step(tok);                                   // 47:20 next least significant … most significant: d rounds
  let cur = RX_NUMS.slice();
  for (const c of [2, 1, 0]) { M.off(); M.col(c, GOLD); cur = stableBy(cur, c); await M.order(tok, cur, 700); }
  M.off();
  gd.mood('happy');
  say('再依次低位、……最後依最高位', 'd 位數 → d 回合');
  await step(tok);                                   // 47:37 like clicking the least significant column first in Excel
  good('先點最不重要的欄，再依序點到最重要的欄 → 全部排好', 0, 0.4, 4.4);
  await gd.hop(tok);
  say('像試算表：先點最次要的欄', '再一路點到最重要的欄');
}]);

// 48:11 每回合 counting sort O(n + b)；取第 i 位的 key 函式 O(1)
FRAG.push(['sortmit-radix-digit', '取第 i 位：(x // bⁱ) mod b', async (tok) => {
  fresh([0, 6, 12], [0, 2, 0]);
  const gd = guide(-6.2, 2.2, 0.6);
  const D = ['2', '3', '4', '1'], X = [-2.4, -0.8, 0.8, 2.4], m = [];
  for (let i = 0; i < 4; i++) m[i] = cube(D[i], '#b9d3ea', [1.2, 1.2, 1.2], X[i], 0.7, 0, 2.4);
  tag('x = 2341，b = 10', 'ptr', 0, 2.4, 0);
  await step(tok);                                   // 48:11 each round sorts by a digit using counting sort
  bubble('每回合：依一位數做 counting sort', 0, 4.6, 0);
  say('每一回合用 counting sort 依某一位排序');
  await step(tok);                                   // 48:43 normally n + k; here n + b
  tag('一回合 O(n + b)', 'ptr alt', 4.6, 3.6, 0);
  say('平常是 O(n + k)', '這裡是 O(n + b)');
  await step(tok);                                   // 48:57 every digit is between 0 and b − 1
  note('每一位都在 0 … b−1', 4.6, 2.8, 0);
  say('因為每一位數只會是 0 … b−1');
  await step(tok);                                   // 49:06 the key function computes the digit we care about
  bubble('key(x) = 這回合要看的那一位', 0, 3.8, 0);
  gd.mood('wow');
  say('這裡用到 key 函式', 'key(x) = 算出這回合關心的那一位');
  await step(tok);                                   // 49:15 least significant digit: x mod b
  glow(m[3], GOLD);
  note('2341 mod 10 = 1', X[3], 2.0, 0.8);
  gd.mood('calm');
  say('最低位：x mod b', '2341 mod 10 = 1');
  await step(tok);                                   // 49:20 most significant: divide by b^(d−1)
  glow(m[3], null); glow(m[0], GOLD);
  note('2341 // 1000 = 2', X[0], 2.0, 0.8);
  say('最高位：除以 bᵈ⁻¹', '2341 // 1000 = 2');
  await step(tok);                                   // 49:29 one divide and one mod: constant time
  glow(m[0], null); glow(m[2], GOLD);
  note('(2341 // 10) mod 10 = 4', X[2], 2.9, 0.8);
  say('中間的位：一次除法 + 一次 mod', 'key 函式是 O(1)');
  await step(tok);                                   // 49:38 just compute them as we need them
  glow(m[2], null);
  say('不用先全部寫下來', '需要哪一位就當場算');
  await step(tok);                                   // 49:51 total time: (n + b) × d
  good('總時間 = (n + b) · d', 0, 4.6, 1.0);
  gd.mood('happy'); await gd.hop(tok);
  say('d 回合，每回合 O(n + b)', '總時間 O((n + b)·d)');
}]);

// 50:03 選 b：b 大位數少，但 b 超過 n 就虧 → b = Θ(n)，O(n·log_n k)；k ≤ nᶜ → O(cn)
FRAG.push(['sortmit-radix-b', '選 b = Θ(n)：O(n·log_n k)', async (tok) => {
  fresh([0, 4.5, 12.5], [0, 2.4, 0]);
  const gd = guide(-6.4, 2.4, 0.6);
  const n = 16, k = 4096, bs = [2, 4, 8, 16, 64, 256], X = [-4, -2.2, -0.4, 1.4, 3.2, 5], bars = [];
  await step(tok);                                   // 50:03 d = log base b of … (written as n)
  const f = tag('(n + b) · log_b n', 'ptr', -1, 6.2, 0);
  say('d 是那個 log：寫成 (n + b)·log_b n', '（等一下老師會改）');
  await step(tok);                                   // 50:10 what should b be?
  tag('示意：n = 16，k = 4096', 'idx', 3.2, 6.2, 0);
  for (let i = 0; i < bs.length; i++) {
    const c = (n + bs[i]) * Math.log(k) / Math.log(bs[i]), h = c / 85;
    bars[i] = cube(null, '#4b9ee2', [1.2, h, 1], X[i], h / 2, 0);
    tag('b=' + bs[i], 'idx', X[i], 0.05, 0.8); tag(String(Math.round(c)), 'idx', X[i], h + 0.3, 0);
    await beat(tok, 300);
  }
  gd.mood('wow');
  say('b 該選多大？', '長條 = 不同 b 的總成本');
  await step(tok);                                   // 50:28 sorry, this is not n: it is k
  txt(f, '(n + b) · log_b k');
  bad('更正：是 log_b k，不是 log_b n', -1, 5.4, 0);
  gd.mood('calm');
  say('老師更正：是 log_b k', '總時間 (n + b)·log_b k');
  await step(tok);                                   // 50:40 b large, but not bigger than n → b = n
  glow(bars[3], GOLD);
  say('b 大一點，位數就少', '但 b 不該比 n 大 → 取 b = n');
  await step(tok);                                   // 50:50 minimizing a sum: usually when the terms are equal
  note('兩項的和最小，通常發生在兩項相等時', 2.0, 4.6, 0);
  say('想讓兩項之和最小', '通常在兩項相等的時候');
  await step(tok);                                   // 51:10 b = Θ(n) → n · log_n k
  glow(bars[2], GREEN); glow(bars[3], GREEN);
  txt(f, 'b = Θ(n) → O(n · log_n k)');
  gd.mood('happy');
  say('b = Θ(n) 時最小', '總時間 O(n·log_n k)');
  await step(tok);                                   // 51:26 k polynomial in n → linear
  say('k 是 n 的多項式時', '→ 線性時間');
  await step(tok);                                   // 51:38 k ≤ n^c → O(c·n)
  bubble('k ≤ nᶜ → log_n k ≤ c → O(c·n)', 2.0, 3.8, 0);
  say('k ≤ nᶜ：log_n k ≤ c', 'O(c·n)，c 是常數 → 線性');
  await step(tok);                                   // 51:46 reasonably small integers → linear-time sorting
  good('整數是 n 的多項式大小 → 線性時間排序', 0, -0.4, 1.4);
  await gd.hop(tok);
  say('整數「合理地小」（n 的多項式）', '就能線性時間排序');
  await step(tok);                                   // 52:00 example and proof in the textbook / notes
  gd.mood('calm');
  say('例子與正確性證明（簡單歸納）', '見課本與講義');
}]);

// ───────────── Rec7 ─────────────
// 0:44 學過的五種排序：時間、Θ(n) 下限、in place
FRAG.push(['sortmit-rec-roster', '五種排序：時間與 in place', async (tok) => {
  fresh([0, 6, 12.5], [0, 2, 0]);
  const gd = guide(-6.4, 2.6, 0.6);
  const X = [-5.0, -2.5, 0, 2.5, 5.0], m = [];
  await step(tok);                                   // 0:44 dumbest to smartest: merge sort (somewhere in the middle)
  m[1] = mBox('Merge', X[1], 0.4, 0, 2.2, PAPER, 2);
  say('從最笨排到最聰明', '有人先喊 merge sort：放中間');
  await step(tok);                                   // 0:58 insertion sort; heapsort
  m[0] = mBox('Insertion', X[0], 0.4, 0, 2.2, PAPER, 2); await beat(tok, 300);
  m[2] = mBox('Heap', X[2], 0.4, 0, 2.2, PAPER, 2);
  say('最簡單的 insertion sort', '還有 Heap sort');
  await step(tok);                                   // 1:11 counting sort
  m[3] = mBox('Counting', X[3], 0.4, 0, 2.2, PAPER, 2);
  say('counting sort');
  await step(tok);                                   // 1:20 radix sort
  m[4] = mBox('Radix', X[4], 0.4, 0, 2.2, PAPER, 2);
  gd.mood('happy');
  say('最後一個：radix sort');
  await step(tok);                                   // 1:47 insertion sort: n²
  tag('O(n²)', 'ptr', X[0], 1.5, 0);
  gd.mood('sad');
  say('insertion sort：n²', '很慢');
  await step(tok);                                   // 1:52 linear is as good as it gets
  gd.mood('calm');
  say('線性時間已經是最好的可能');
  await step(tok);                                   // 2:01 the output has n elements → Θ(n)
  const fl = ghostBox(GREEN, 12.5, 0.05, 1.2); fl.position.set(0, 1.0, 0);
  note('輸出就要寫 n 個元素 → 至少 Θ(n)', 0, 2.6, 0);
  say('輸出陣列有 n 個元素', '光寫出來就要 Θ(n)');
  await step(tok);                                   // 2:17 merge sort: n log n
  tag('O(n log n)', 'ptr', X[1], 1.5, 0);
  say('merge sort：n log n');
  await step(tok);                                   // 2:35 a heap operation is O(h) = O(log n)
  glow(m[2], GOLD);
  note('一次 Heap 操作 O(h) = O(log n)', X[2], 3.4, 0);
  say('一次 Heap 操作（insert／extract）', 'O(h)，h = log n');
  await step(tok);                                   // 2:47 n inserts, then n extracts → n log n
  tag('O(n log n)', 'ptr', X[2], 1.5, 0);
  glow(m[2], null);
  say('n 次 insert、再 n 次 extract', '→ O(n log n)');
  await step(tok);                                   // 3:09 what's special about these three? in place?
  [0, 1, 2].forEach((i) => glow(m[i], BLUE));
  gd.mood('wow');
  say('前三種有什麼特別？', '有人說：in place');
  await step(tok);                                   // 3:24 merge sort is not quite in place
  [0, 1, 2].forEach((i) => glow(m[i], null));
  tag('不是 in place', 'idx', X[1], 2.2, 0);
  note('in-place merge sort 存在，但太難，不教', X[1], 3.0, 0);
  gd.mood('calm');
  say('merge sort 不是 in place', 'in-place 版本存在，但要博士學位才看得懂');
  await step(tok);                                   // 3:44 heapsort is in place
  tag('in place', 'ptr alt', X[2], 2.2, 0);
  say('Heap sort 是 in place');
  await step(tok);                                   // 3:56 insertion sort is slow: we don't care much
  tag('太慢，不在意', 'idx', X[0], 2.2, 0);
  say('insertion sort 太慢，不太在意它');
  await step(tok);                                   // 4:00 what's special about these three, not the other two?
  [0, 1, 2].forEach((i) => glow(m[i], BLUE));
  gd.mood('wow');
  say('前三種有、後兩種沒有的共同點是？');
}]);

// 4:20 Comparison model：key 是 blob，只知道兩個誰大 → 下界 n log n
FRAG.push(['sortmit-rec-cmp', 'Comparison model：key 只能比大小', async (tok) => {
  fresh(MCAM, MLOOK);
  const gd = guide(-6.2, 2.0);
  await step(tok);                                   // 4:20 you need to be able to compare them
  const a = cube('k1', INK, [1.0, 1.0, 1.0], -1.4, 0.5, 0, 2), b = cube('k2', INK, [1.0, 1.0, 1.0], 1.4, 0.5, 0, 2);
  const q = tag('k1 < k2 ?', 'pkt', 0, 1.6, 0);
  say('前三種不需要整數', '只要 key 能互相比較');
  await step(tok);                                   // 4:40 the comparison model
  bubble('Comparison model', 0, 3.4, 0);
  say('這就是 comparison model');
  await step(tok);                                   // 4:55 keys are blobs: only know which one is greater
  txt(q, 'k1 < k2 ? → yes');
  glow(a, GOLD); glow(b, GOLD);
  note('key 是 blob：只知道兩個誰大', 0, 2.6, 0);
  gd.mood('wow');
  say('key 就像一團 blob', '只知道兩個之中誰比較大，其他都不知道');
  await step(tok);                                   // 5:12 there is a lower bound for this model
  gd.mood('calm');
  say('這個模型有一個下界（lower bound）');
  await step(tok);                                   // 5:28 cannot do better than n log n with comparisons only
  bad('只靠比較：至少 n log n', 0, 4.2, 0);
  gd.mood('sad');
  say('只用比較來排序', '不可能比 n log n 更快');
  await step(tok);                                   // 5:33 so merge sort and heap sort are optimal
  mBox('Merge：最佳', -3.6, 0.4, 2.4, 2.6, MINT, 2); mBox('Heap sort：最佳', 3.6, 0.4, 2.4, 2.6, MINT, 2);
  gd.mood('happy');
  say('所以在這個模型裡', 'merge sort 和 Heap sort 已經是最佳');
}]);

// 5:41 Python 讓自訂物件能比較：__cmp__（Py2）或 __lt__ __le__ __gt__ __ge__ __eq__ __ne__
FRAG.push(['sortmit-rec-python-cmp', 'Python：讓物件支援比較運算', async (tok) => {
  fresh([0, 5.5, 12], [0, 3, 0]);
  const gd = guide(-6.4, 2.4, 0.6);
  const P = mCode(['class Key:', '  def __cmp__(self, other):  # Py2：<0 / 0 / >0', '  def __lt__(self, other):   # <', '  def __le__(self, other):   # <=', '  def __gt__(self, other):   # >', '  def __ge__(self, other):   # >=', '  def __eq__(self, other):   # ==', '  def __ne__(self, other):   # !='], -0.6, 6.4, 0.55, -1);
  await step(tok);                                   // 5:45 make my own objects respond to these operators
  bubble('自己的物件：也想用 merge sort 排', 3.6, 2.6, 1.6);
  say('數字本來就能用 < ==', '自己寫的物件呢？');
  await step(tok);                                   // 6:09 calling merge sort on them: it crashes
  bad('直接丟進 merge sort → 當掉', 3.6, 1.8, 1.6);
  gd.mood('sad');
  say('直接拿去 merge sort 會當掉', '它不知道怎麼比較');
  await step(tok);                                   // 6:18 suppose this is my key class
  P.show(0);
  gd.mood('calm');
  say('假設這是我的 Key 類別');
  await step(tok);                                   // 6:32 the old-school way (Python 2): __cmp__
  P.show(1);
  say('舊寫法：__cmp__(self, other)', '只在 Python 2 有效');
  await step(tok);                                   // 6:52 returns a number < 0, = 0 or > 0
  note('回傳 <0、0、>0', 3.4, 5.9, -1);
  say('回傳一個數：小於 0、等於 0、大於 0', '分別代表 <、=、>');
  await step(tok);                                   // 6:58 you'll see it in old code; don't use it in new code
  bad('舊程式看得到，新程式別用', 3.4, 5.2, -1);
  say('舊程式裡會看到', '新程式不要用');
  await step(tok);                                   // 7:10 the new way: __lt__ (less than)
  P.show(2);
  gd.mood('wow');
  say('新寫法：__lt__ = less than', '對應 <');
  await step(tok);                                   // 7:24 __le__, __gt__
  P.show(3, false); await beat(tok, 400); P.show(4);
  say('__le__（<=）、__gt__（>）');
  await step(tok);                                   // 7:31 __ge__
  P.show(5);
  say('__ge__（>=）');
  await step(tok);                                   // 7:47 also define __eq__ and __ne__
  P.show(6, false); await beat(tok, 400); P.show(7);
  gd.mood('calm');
  say('最好也定義 __eq__（==）和 __ne__（!=）');
  await step(tok);                                   // 8:06 they take self and other, return True or False
  P.hl(-1);
  note('收 self、other，回傳 True / False', 3.4, 2.4, -1);
  say('都接收 self 和 other', '回傳 True / False');
  await step(tok);                                   // 8:16 any object can act as a key: every sort works
  const a = cube('k1', '#b9d3ea', [0.9, 0.9, 0.9], -1.2, 0.5, 2.2, 2), b = cube('k2', '#b9d3ea', [0.9, 0.9, 0.9], 1.2, 0.5, 2.2, 2);
  glow(a, GOLD); glow(b, GOLD);
  const op = tag('k1 < k2  →  k1.__lt__(k2)', 'ptr alt', 0, 1.6, 2.2);
  gd.mood('happy'); await gd.hop(tok);
  say('k1 < k2 會呼叫 k1.__lt__(k2)', 'insertion、merge、Heap、BST、AVL 全都能用');
  await step(tok);                                   // 8:35 the problem: the n log n bound
  txt(op, '但仍卡在 Ω(n log n)');
  gd.mood('sad');
  say('問題是 n log n 這個下界', '不是最快的可能');
  await step(tok);                                   // 8:47 break out: look into the boxes
  bubble('打開盒子看內容 → 更快的排序', 0, 2.6, 2.2);
  gd.mood('wow');
  say('要跳出 comparison model', '打開盒子看內容，才能寫出更快的排序');
}]);

// 9:18 Counting Sort：4 1 3 2 3，count 陣列 index 0..5
FRAG.push(['sortmit-rec-count-basic', 'Counting Sort：4 1 3 2 3', async (tok) => {
  fresh([0, 8.5, 11], [0, 0.6, 0.4]);
  const gd = guide(-6.4, 3.4, 0.6), S = mCounter([4, 1, 3, 2, 3], 6);
  await step(tok);                                   // 9:18 the array 4 1 3 2 3
  S.showA();
  say('例子：4 1 3 2 3', '用 counting sort 怎麼排？');
  await step(tok);                                   // 9:38 initialize an array of all possible values
  say('先開一個陣列：每個可能的值一格');
  await step(tok);                                   // 9:48 assumption: integers 0 .. k − 1
  note('假設：值是 0 … k−1 的整數', 0, 2.2, -2.6);
  gd.mood('wow');
  say('counting sort 要先知道值的範圍', '假設是 0 … k−1 的整數');
  await step(tok);                                   // 10:00 or anything you can map to them
  gd.mood('calm');
  say('不一定真的是這些數', '只要能對應到它們就行');
  await step(tok);                                   // 10:05 an array with indices 0 … 5
  S.showC();
  say('開一個 index 0 … 5 的陣列', 'k = 6');
  await step(tok);                                   // 10:27 initialized with zeros
  S.C.hl([0, 1, 2, 3, 4, 5], GRAY); await beat(tok, 400); S.C.off();
  say('每格初值都是 0');
  await step(tok);                                   // 10:37 iterate, incrementing the matching counter: 4
  await S.inc(tok, 0, 500);
  await step(tok);                                   // 10:54 one, three, two; the second 3 makes it 2
  for (let j = 1; j < 5; j++) await S.inc(tok, j, 500);
  S.A.off(); S.C.off();
  gd.mood('happy');
  say('第二個 3 讓 count[3] 變成 2', '0 1 1 2 1 0');
  await step(tok);                                   // 11:20 output: one 1, one 2, two 3's, one 4
  S.showO();
  await S.write(tok, 300);
  say('依序輸出：一個 1、一個 2、兩個 3、一個 4');
  await step(tok);                                   // 11:28 no zeros, no fives: so far so good
  good('1 2 3 3 4', 0, 1.6, 3.4);
  say('沒有 0、沒有 5', '到這裡都很好');
}]);

// 11:44 穩定性：3a、3b → 每格改成 linked list
FRAG.push(['sortmit-rec-count-lists', '要穩定：每格改成 linked list', async (tok) => {
  fresh([0, 9, 11], [0, 1.4, 0.6]);
  const gd = guide(-6.4, 3.4, 0.6);
  const vals = [4, 1, '3a', 2, '3b'], k = 6;
  const A = mRow(vals, { z: -2.2, idx: true, name: 'A' });
  await step(tok);                                   // 11:44 we care about stability
  bubble('Stability（穩定性）', 0, 2.0, -2.2);
  say('少了一件事：stability');
  await step(tok);                                   // 11:47 equal keys: first in the input → first in the output
  note('相等的 key：輸入先出現的，輸出也要先', 0, 1.3, -2.2);
  say('兩個相等的 key', '輸入裡先出現的，輸出也要在前面');
  await step(tok);                                   // 12:05 you have to remember where they were in the input
  gd.mood('wow');
  say('光看 key 分不出誰先誰後', '要記得它們在輸入裡的位置');
  await step(tok);                                   // 12:15 3a and 3b: the counts can't tell them apart
  A.hl([2, 4], GOLD);
  bad('count[3] = 2：哪個是 3a？', 3.6, 1.6, 0.4);
  gd.mood('sad');
  say('兩個 3 標成 3a、3b', '只存計數，輸出時只知道「寫一個 3」');
  await step(tok);                                   // 12:30 replace each value with a linked list
  A.off();
  const B = mRow(Array(k).fill(null), { z: 0.4, idx: true, name: 'L' });
  gd.mood('calm');
  say('改法：每格存一條 linked list', '放對應到這個值的 key');
  await step(tok);                                   // 12:45 a 1 here, a 2 here, 3a then 3b, a 4
  const lists = Array.from({ length: k }, () => []);
  for (let j = 0; j < vals.length; j++) { const v = mN(vals[j]), m = A.m[j]; move(m, B.x(v), 0.45, 0.4 + lists[v].length * 0.95); lists[v].push(m); A.m[j] = null; await beat(tok, 450); }
  say('1 │ 2 │ 3a → 3b │ 4', '3 的串列：3a 在前、3b 在後');
  await step(tok);                                   // 12:59 go through these and output them the right way
  const O = mRow(Array(vals.length).fill(null), { z: 3.6, idx: true, name: 'out' });
  let w = 0;
  for (let v = 0; v < k; v++) for (const m of lists[v]) { move(m, O.x(w), O.y, O.z); w++; await beat(tok, 380); }
  gd.mood('happy');
  say('依序輸出：1 2 3a 3b 4', '<span class="ok">穩定</span>');
}]);

// 13:03 不用 linked list：3a 該放在「比 3 小的 key 有幾個」那一格
FRAG.push(['sortmit-rec-pos-meaning', 'pos[v] = 比 v 小的 key 有幾個', async (tok) => {
  fresh([0, 8.5, 11], [0, 0.6, 0.4]);
  const gd = guide(-6.4, 3.6, 0.6);
  const vals = [4, 1, '3a', 2, '3b'];
  const A = mRow(vals, { z: -2.6, idx: true, name: 'A' });
  let O = null, PR = null;
  await step(tok);                                   // 13:03 in C there's no built-in linked list
  bad('C 語言：沒有現成的 linked list', 0, 2.0, -2.6);
  gd.mood('sad');
  say('換成 C 這種低階語言', '沒有 linked list，自己寫很麻煩');
  await step(tok);                                   // 13:33 another way?
  gd.mood('wow');
  say('有沒有別的方法？');
  await step(tok);                                   // 14:02 an output array of five elements
  O = mRow(Array(5).fill(null), { z: 3.2, idx: true, name: 'out' });
  gd.mood('calm');
  say('開一個 5 格的輸出陣列');
  await step(tok);                                   // 14:07 see 4 → belongs here; 1 → here; 3a → here …
  const dest = [4, 0, 2, 1, 3];
  for (let j = 0; j < 5; j++) { A.off(); A.hl([j], GOLD); O.ix[dest[j]].element.className = 'lab-label ptr alt'; await beat(tok, 450); O.ix[dest[j]].element.className = 'lab-label idx'; }
  A.off();
  say('希望看到 key 就知道它該放哪一格', '4 → 這格、1 → 這格、3a → 這格……');
  await step(tok);                                   // 14:28 at 3a: look inside here, it tells where 3a belongs
  A.hl([2], GOLD);
  note('看一眼某個陣列，就知道 3a 放哪', 0, 1.6, 0.4);
  say('輪到 3a 時，查某個陣列', '它告訴我 3a 該去哪一格');
  await step(tok);                                   // 15:05 how would I define the position?
  gd.mood('wow');
  say('用「排好之後」的性質，怎麼定義位置？');
  await step(tok);                                   // 15:14 3a goes to: how many keys are smaller than 3 (= 2)
  A.hl([1, 3], BLUE);
  const c3 = cube('3a', mCol(3), [0.8, 0.8, 0.8], O.x(2), O.y, O.z, 2); glow(c3, GREEN);
  gd.mood('happy');
  say('比 3 小的 key 有 2 個（1、2）', '→ 3a 放在 out[2]');
  await step(tok);                                   // 15:33 four keys are smaller than 4 → position 4
  A.off(); A.hl([0], GOLD); A.hl([1, 2, 3, 4], BLUE);
  const c4 = cube(4, mCol(4), [0.8, 0.8, 0.8], O.x(4), O.y, O.z, 2); glow(c4, GREEN);
  say('比 4 小的有 4 個', '→ 4 放在 out[4]');
  await step(tok);                                   // 15:58 compute it from the counting array
  A.off();
  gd.mood('calm');
  say('這個資訊可以從計數陣列算出來', '還是 counting sort，不用比較');
  await step(tok);                                   // 16:25 another array of size k
  PR = mRow(Array(6).fill(null), { z: 0.4, idx: true, name: 'pos' });
  say('先另外開一個大小 k 的陣列', '（最後會原地改，不用多的空間）');
  await step(tok);                                   // 16:34 it tells: the first 1 goes here, the first 2 here …
  note('第一個 1 去哪、第一個 2 去哪、第一個 3 去哪……', 0, 1.5, 0.4);
  say('它要告訴我：每種 key 的第一個放哪');
  await step(tok);                                   // 17:26 the number of elements smaller than v
  bubble('pos[v] = 比 v 小的元素個數', 0, 2.2, 0.4);
  gd.mood('wow');
  say('直覺：pos[v] = 比 v 小的元素有幾個');
  const pos = [0, 0, 1, 2, 4, 5];
  const fill = async (list) => { for (const v of list) { PR.m[v] = cube(pos[v], PAPER, [0.8, 0.5, 0.8], PR.x(v), 0.3, 0.4, 1.5); await beat(tok, 450); } };
  await step(tok);                                   // 17:48 smaller than 0: zero; smaller than 1: zero
  gd.mood('calm');
  await fill([0, 1]);
  say('比 0 小：0 個；比 1 小：0 個');
  await step(tok);                                   // 17:54 smaller than 2: one; smaller than 3: two
  await fill([2, 3]);
  say('比 2 小：1 個；比 3 小：2 個', '這是累加（cumulative sum）');
  await step(tok);                                   // 18:07 smaller than 4: four; smaller than 5: five
  await fill([4, 5]);
  say('比 4 小：4 個；比 5 小：5 個', 'pos = 0 0 1 2 4 5');
  await step(tok);                                   // 18:14 differences between neighbours
  PR.hl([3, 4], GOLD);
  note('pos[4] − pos[3] = 2 = 3 的個數', PR.x(3.5), 1.4, 0.4);
  say('相鄰兩格的差 = 那個值的個數（count）', 'pos[4] − pos[3] = 2 個 3');
  await step(tok);                                   // 18:45 the first is zero; each next = previous + count
  PR.off();
  bubble('pos[0] = 0；pos[v+1] = pos[v] + count[v]', 0, 2.2, 1.8);
  say('第一格一定是 0', '下一格 = 這格 + 這個值的個數');
  await step(tok);                                   // 19:14 a new array just to see it; now do it in place
  gd.mood('happy'); await gd.hop(tok);
  say('開新陣列只是為了看清楚', '接下來試著原地算出來');
}]);

// 19:45 由左往右算 pos：running sum，原地覆寫需要 temp
FRAG.push(['sortmit-rec-pos-forward', '原地算 pos：running sum ＋ temp', async (tok) => {
  fresh([0, 6, 11.5], [0, 1.5, 0]);
  const gd = guide(-6.4, 2.4, 0.6);
  const P = mCode(['sum = 0', 'for i in range(k):', '    temp = pos[i]', '    pos[i] = sum', '    sum = sum + temp'], 0, 5.6, 0.5, -2.5);
  const R = mRow([0, 1, 1, 2, 1, 0], { idx: true, name: 'pos', color: () => PAPER, dx: 1.3 });
  let sumL = null;
  await step(tok);                                   // 19:45 pseudocode: turn the counts into positions
  bubble('0 1 1 2 1 0 → 0 0 1 2 4 5', 0, 2.2, 0);
  say('一開始 pos 裡放的是 count', '目標：變成 0 0 1 2 4 5');
  await step(tok);                                   // 20:08 can we do it in place?
  note('原地（in place）：不開新陣列', 0, 1.4, 1.4);
  say('能不能原地做？');
  await step(tok);                                   // 20:23 recount everything for each key → n²
  bad('每個都回頭重數 → n²', 3.6, 2.6, 0);
  gd.mood('sad');
  say('每來一個新的就回頭數一遍', '那是 n²，太慢');
  await step(tok);                                   // 20:44 keep a running sum
  gd.mood('happy');
  say('改用 running sum（累加和）');
  await step(tok);                                   // 20:58 sums always start at zero
  P.show(0); sumL = tag('sum = 0', 'ptr alt', -2.4, 2.3, 1.2);
  gd.mood('calm');
  say('sum 從 0 開始');
  await step(tok);                                   // 21:16 for i from 0 to k − 1 (Python: zero-based)
  P.show(1);
  say('i 從 0 到 k−1', 'Python 是 0-based：range(k)');
  await step(tok);                                   // 21:50 sum = sum + pos[i]
  P.set(2, '    sum = sum + pos[i]'); P.hl(2);
  say('sum = sum + pos[i]');
  await step(tok);                                   // 22:12 pos[i] must get the sum before adding: need a temp
  gd.mood('wow');
  say('pos[i] 要放「加之前」的 sum', '需要一個暫存變數 temp');
  await step(tok);                                   // 22:31 temp = pos[i]
  P.show(2);
  const tmpL = tag('temp = –', 'ptr', 2.4, 2.3, 1.2);
  say('temp = pos[i]', '先把 pos[i] 存起來，免得被蓋掉');
  await step(tok);                                   // 22:35 pos[i] = sum (before incrementing)
  P.show(3);
  say('pos[i] = sum（加之前的值）');
  await step(tok);                                   // 22:51 sum = sum + temp → run it
  P.show(4);
  let sum = 0; const v = [0, 1, 1, 2, 1, 0];
  for (let i = 0; i < 6; i++) { R.off(); R.hl([i], GOLD); txt(tmpL, 'temp = ' + v[i]); relabel(R.m[i], sum); sum += v[i]; txt(sumL, 'sum = ' + sum); await beat(tok, 420); }
  R.off(); P.hl(-1);
  gd.mood('happy');
  say('sum = sum + temp', '跑完：0 0 1 2 4 5');
  await step(tok);                                   // 23:09 does it make sense? "not really"
  gd.mood('sad');
  say('大家懂嗎？', '「不太懂」');
  await step(tok);                                   // 23:24 you already overwrote the previous column
  bad('原地覆寫：一不小心就蓋掉還要用的值', 0, 0.4, 1.8);
  say('原地覆寫很容易出錯', '前一格已經被蓋掉了');
  await step(tok);                                   // 24:14 "sorry, I'm getting confused"
  gd.mood('wow');
  say('連助教都搞混了', '這個寫法真的容易錯');
}]);

// 24:27 技巧：在尾端放 n = 5，由右往左：sum = n；sum −= pos[i]；pos[i] = sum
FRAG.push(['sortmit-rec-pos-backward', '技巧：尾端放 n，由右往左減', async (tok) => {
  fresh([0, 6, 11.5], [0, 1.5, 0]);
  const gd = guide(-6.4, 2.4, 0.6);
  const P = mCode(['sum = n', 'for i from k-1 down to 0:', '    sum = sum - pos[i]', '    pos[i] = sum'], 0, 5.6, 0.5, -2.5);
  const R = mRow([0, 1, 1, 2, 1, 0, null], { idx: ['0', '1', '2', '3', '4', '5', 'n'], name: 'pos', color: () => PAPER, dx: 1.25 });
  let sumL = null;
  await step(tok);                                   // 24:27 put a 5 after the array
  R.m[6] = cube(5, '#e8c770', [0.8, 0.8, 0.8], R.x(6), 0.45, 0, 2);
  gd.mood('wow');
  say('助教的技巧：在陣列後面放 5', '5 = 元素個數 n');
  await step(tok);                                   // 24:41 what's this difference? zero
  R.hl([5, 6], GOLD);
  say('5 和前一格（count[5]）的差？', '最後一格的位置');
  await step(tok);                                   // 25:03 start at the end instead of the beginning
  R.off();
  const ar = pkt('← 從尾端開始', R.x(6), 1.6, 0);
  await travel(tok, ar, V3(R.x(6), 1.6, 0), V3(R.x(4), 1.6, 0), 900);
  gd.mood('calm');
  say('不從頭開始，改從尾端開始');
  await step(tok);                                   // 25:04 n elements: the last key's index = n − its count
  note('最後一種 key 的開頭 = n − 它的個數', 0, 2.6, 0);
  say('一共 n 個元素', '最後一種 key 從 n − 它的個數 開始');
  await step(tok);                                   // 25:39 for i from n − 1 down to 0 (the values: k − 1)
  P.show(1);
  note('板書寫 n−1；pos 只有 k 格，應是 k−1', 3.4, 4.6, -2.5);
  say('i 由後往前', '迴圈跑的是值域：k−1 到 0');
  await step(tok);                                   // 26:07 add everything up: 5 = n
  R.hl([0, 1, 2, 3, 4, 5], BLUE);
  bubble('0+1+1+2+1+0 = 5 = n', 0, 2.6, 1.4);
  say('count 全部加起來 = 5', '就是 key 的總數 n');
  await step(tok);                                   // 27:07 the temp way works too; this is easier to write
  R.off();
  say('前面 temp 的寫法也行', '一樣的結果，但這個比較好寫');
  await step(tok);                                   // 28:07 the difference between n and the last one: pos of the last
  P.show(0); sumL = tag('sum = 5', 'ptr alt', 0, 2.4, 1.2);
  R.hl([5], GOLD);
  say('sum = n = 5', 'n 減掉最後一格，就是最後一種 key 的位置');
  let sum = 5; const v = [0, 1, 1, 2, 1, 0];
  const it = async (i) => { R.off(); R.hl([i], GOLD); sum -= v[i]; txt(sumL, 'sum = ' + sum); relabel(R.m[i], sum); glow(R.m[i], GREEN); await beat(tok, 420); };
  await step(tok);                                   // 28:34 subtract pos[i]
  P.show(2);
  await it(5);
  say('sum = sum − pos[5] = 5 − 0 = 5', 'pos[5] = 5');
  await step(tok);                                   // 29:02 then pos[i] = sum: run it down to 0
  P.show(3);
  for (let i = 4; i >= 0; i--) await it(i);
  R.off(); P.hl(-1);
  gd.mood('happy');
  say('pos[i] = sum，一路往左', '得到 0 0 1 2 4 5');
  await step(tok);                                   // 29:13 no temp variables
  good('不需要 temp！', 3.4, 2.4, 1.2);
  await gd.hop(tok);
  say('除了 sum，不需要 temp');
  await step(tok);                                   // 29:34 pos before the loop = counts, after = positions
  note('迴圈前：count　迴圈後：位置（同一個陣列）', 0, 0.4, 1.6);
  gd.mood('calm');
  say('迴圈前 pos 是 count，迴圈後是位置', '其實是同一個陣列');
}]);

// 30:01 輸出：out[pos[A[i]]] = A[i]；pos[A[i]] += 1（3a、3b 不會撞在同一格）
FRAG.push(['sortmit-rec-place', '放進 out：out[pos[A[i]]] = A[i]，pos++', async (tok) => {
  fresh([0, 9, 11], [0, 1, 0.6]);
  const gd = guide(-6.4, 3.6, 0.6);
  const P = mCode(['out = [None] * n', 'for i in range(n):', '    out[pos[A[i]]] = A[i]', '    pos[A[i]] += 1'], 0, 6.6, 0.48, -3.8);
  const vals = [4, 1, '3a', 2, '3b'];
  const A = mRow(vals, { z: -2.2, idx: true, name: 'A' });
  const pos = [0, 0, 1, 2, 4, 5];
  const PR = mRow(pos, { z: 0.6, idx: true, name: 'pos', color: () => PAPER, sz: [0.8, 0.5, 0.8], y: 0.3 });
  let O = null;
  const put = async (i) => {
    const v = mN(vals[i]), m = A.m[i];
    A.off(); PR.off(); glow(m, GOLD); glow(PR.m[v], GOLD); P.hl(2);
    move(m, O.x(pos[v]), O.y, O.z); A.m[i] = null;
    await beat(tok, 700); glow(m, null);
  };
  const bump = async (v) => { P.hl(3); pos[v]++; relabel(PR.m[v], pos[v]); glow(PR.m[v], GREEN); await beat(tok, 400); };
  await step(tok);                                   // 30:01 the hard part is done: now produce the output
  good('最難的 pos 已經算好了', 0, 2.0, 0.6);
  say('算出 pos 是 counting sort 最難的部分', '接著產生輸出');
  await step(tok);                                   // 30:21 a new array of n NIL values
  P.show(0);
  O = mRow(Array(5).fill(null), { z: 3.4, idx: true, name: 'out' });
  say('先開一個 n 格、全是 None 的 out');
  await step(tok);                                   // 30:40 iterate over A from 0 to n − 1
  P.show(1);
  say('i 從 0 到 n−1 走過 A');
  await step(tok);                                   // 31:34 out[pos[A[i]]] = A[i]; pos[A[i]] += 1
  P.show(2, false); P.show(3, false); P.hl(2);
  gd.mood('wow');
  say('out[pos[A[i]]] = A[i]', '寫完後 pos[A[i]] 加一');
  await step(tok);                                   // 31:59 start at 4: pos[4] = 4 → out[4]
  gd.mood('calm');
  await put(0);
  say('4：pos[4] = 4', '寫到 out[4]');
  await step(tok);                                   // 32:24 then increment it to 5
  await bump(4);
  say('pos[4] 加一，變成 5');
  await step(tok);                                   // 32:34 then 1: pos[1] = 0 → out[0]
  await put(1);
  say('1：pos[1] = 0', '寫到 out[0]');
  await step(tok);                                   // 32:46 increment; 3a: pos[3] = 2 → out[2], increment
  await bump(1); await put(2); await bump(3);
  say('3a：pos[3] = 2 → out[2]', 'pos[3] 變成 3');
  await step(tok);                                   // 33:03 2: pos[2] = 1 → out[1]; pos[2] becomes 2
  await put(3); await bump(2);
  say('2：pos[2] = 1 → out[1]', 'pos[2] 變成 2');
  await step(tok);                                   // 33:14 3b: pos[3] is now 3 — no overwriting 3a
  await put(4); await bump(3);
  gd.mood('happy'); await gd.hop(tok);
  say('3b：pos[3] 已經是 3 → out[3]', '不會蓋掉 3a！pos[3] 變成 4');
  await step(tok);                                   // 33:46 pos points to the first slot of each key; then moves on
  PR.off(); P.hl(-1);
  note('pos[v]：下一個 v 要寫的位置', 0, 1.4, 0.6);
  gd.mood('calm');
  say('pos[v] 一開始指向 v 的第一格', '每寫一個就往後移一格');
  await step(tok);                                   // 34:19 the easy part; the hard magic is pos
  good('1 2 3a 3b 4：穩定', 0, 1.6, 3.4);
  say('這段是簡單的部分', '真正的魔法在算 pos');
}]);

// 35:13 Radix 的 key：d 位、每位 base k → 共 kᵈ 種 key
FRAG.push(['sortmit-rec-radix-keys', 'Radix 的 key：d 位、每位 base k', async (tok) => {
  fresh([0, 9, 10], [0, 0, 0.3]);
  const gd = guide(-6.0, 2.6, 0.6);
  let M = null;
  await step(tok);                                   // 35:13 the example: six 4-digit numbers
  M = mRadix(RX_NUMS, { drop: true });
  say('例子：六個 4 位數', '2341 1432 2413 1243 2143 1234');
  await step(tok);                                   // 35:50 what do keys look like?
  gd.mood('wow');
  say('複習：兩種排序的 key 長什麼樣？', 'counting sort 和 radix sort');
  await step(tok);                                   // 35:55 counting sort: keys are 0 … k − 1
  note('counting sort：key 是 0 … k−1 的整數', 0, 1.8, -4.4);
  gd.mood('calm');
  say('counting sort：key 是 0 … k−1 的整數');
  await step(tok);                                   // 36:10 radix sort: a key is a sequence of d digits
  for (let c = 0; c < 4; c++) { M.off(); M.col(c, GOLD); await beat(tok, 400); }
  M.off();
  say('radix sort：key 是 d 位數的序列', '這裡 d = 4');
  await step(tok);                                   // 36:20 each digit in base k: 0 … k − 1
  note('每一位是 base k：0 … k−1', 0, 1.8, -3.6);
  say('每一位不一定是十進位', '是 base k：0 … k−1');
  await step(tok);                                   // 36:31 how many keys can I represent?
  gd.mood('wow');
  say('d 位、每位 base k', '一共能表示幾種 key？');
  await step(tok);                                   // 37:01 base 2, eight bits → 2⁸
  bubble('kᵈ 種；例：8 個 bit（k = 2）→ 2⁸ = 256', 4.2, 1.6, -1.0);
  gd.mood('happy');
  say('kᵈ 種', '例：base 2、8 位 → 2⁸');
  await step(tok);                                   // 37:11 one more digit → × k
  say('多一位數', '能表示的 key 數就 ×k');
}]);

// 37:52 從最低位開始；第 2 回合起一定要穩定 → 依最後兩位已排好
FRAG.push(['sortmit-rec-radix-lsd', 'LSD：從個位開始，每回合穩定', async (tok) => {
  fresh([0, 9, 10], [0, 0, 0.3]);
  const gd = guide(-6.0, 2.6, 0.6);
  const M = mRadix(RX_NUMS);
  let cur = RX_NUMS.slice();
  await step(tok);                                   // 37:52 d digits → d rounds
  note('d 位 → d 回合', 4.4, 1.6, -3);
  say('key 拆成 d 位數', '所以排 d 回合');
  await step(tok);                                   // 37:59 each round: sort all keys by one digit
  for (let c = 0; c < 4; c++) { M.off(); M.col(c, GOLD); await beat(tok, 400); }
  M.off();
  say('每一回合：依其中一位，把所有 key 排序');
  await step(tok);                                   // 38:18 which digit first? intuition: the most significant
  M.col(0, RED);
  gd.mood('wow');
  say('先排哪一位？', '直覺會說：最高位');
  await step(tok);                                   // 38:52 go against it: start with the least significant
  M.off(); M.col(3, GOLD);
  bad('考試時：反直覺！從最低位開始', 4.4, 1.6, -1.8);
  gd.mood('calm');
  say('radix sort 反直覺', '從最低位開始，往前做');
  await step(tok);                                   // 39:24 sort by the last digit
  good('剛好已依個位排好', 4.4, 1.6, -0.6);
  say('第 1 回合：依個位排序', '1 2 3 3 3 4：剛好已經排好');
  await step(tok);                                   // 39:30 by the digit before the last: what must the sort have?
  M.off(); M.col(2, GOLD);
  say('第 2 回合：依十位排序', '這個排序法需要什麼性質？');
  await step(tok);                                   // 39:46 stable
  bubble('必須 stable（穩定）', 4.4, 1.6, 0.6);
  gd.mood('wow');
  say('必須是 stable 的排序');
  await step(tok);                                   // 39:55 that's why we went through counting sort's pain
  gd.mood('calm');
  say('前面花那麼多力氣做 counting sort', '就是為了這裡要穩定');
  await step(tok);                                   // 40:00 sort them stably by the tens digit
  cur = stableBy(cur, 2);
  await M.order(tok, cur, 1400);
  say('穩定地依十位排：2413 1432 1234 2341 1243 2143', '十位相同時保持上一回合的順序');
  await step(tok);                                   // 40:46 the three with a 4: still sorted by the last digit
  M.off(); ['2341', '1243', '2143'].forEach((s) => M.rowHl(s, GREEN));
  gd.mood('happy');
  say('十位都是 4 的三個：個位仍是 1 3 3', '→ 依「最後兩位」已經排好');
  await step(tok);                                   // 41:05 sort by this digit → sorted by the last three digits
  M.off(); M.col(1, GOLD);
  cur = stableBy(cur, 1); await M.order(tok, cur, 1200);
  M.off();
  say('第 3 回合依百位（穩定）', '→ 依最後三位排好');
  await step(tok);                                   // 41:17 from the last digit to the first: all the way
  M.col(0, GOLD);
  cur = stableBy(cur, 0); await M.order(tok, cur, 1200);
  M.off(); M.rows.forEach((R) => R.m.forEach((m) => glow(m, GREEN)));
  say('第 4 回合依千位 → 全部排好', '1234 1243 1432 2143 2341 2413');
  await step(tok);                                   // 41:29 why we need a stable sort, and to start from the end
  good('穩定 ＋ 從尾端開始 → 正確', 4.4, 1.6, 2.0);
  await gd.hop(tok);
  say('所以需要穩定排序', '也所以要從最低位開始');
  await step(tok);                                   // 41:39 which stable sort did we just learn? counting sort
  bubble('每回合用 counting sort', -4.4, 1.6, 3.0);
  say('剛學的穩定排序是？', 'counting sort');
}]);

// 42:05 時間：d 回合 × O(n + k)；要 O(n) → d = O(1)、k = O(n) → key 可到 n^O(1)
FRAG.push(['sortmit-rec-radix-time', 'Radix 何時是 O(n)：d = O(1)、k = O(n)', async (tok) => {
  fresh([0, 6, 12], [0, 2, 0]);
  const gd = guide(-6.4, 2.4, 0.6);
  const sl = [];
  let t = null;
  await step(tok);                                   // 42:05 radix = d rounds of counting sort
  for (let r = 0; r < 4; r++) { sl[r] = cube('counting sort', '#b9d3ea', [5, 0.6, 1.4], -0.6, 0.35 + r * 0.7, 0, 2); await beat(tok, 350); }
  tag('d 回合', 'ptr', -4.2, 1.4, 0);
  say('radix sort = d 回合的 counting sort');
  await step(tok);                                   // 42:23 one round O(n + k); d of them: d(n + k)
  t = tag('O(d·(n + k))', 'ptr alt', 4.0, 1.6, 0);
  say('一回合 O(n + k)', 'd 回合：O(d·(n + k))');
  await step(tok);                                   // 42:42 I'd like to say radix sort is O(n)
  bubble('想要：radix sort = O(n)', 0, 3.8, 0);
  gd.mood('wow');
  say('想說 radix sort 是最佳的 O(n)', '需要什麼條件？');
  await step(tok);                                   // 43:20 d·n has to be at most O(n)
  sl.forEach((s) => glow(s, GOLD));
  gd.mood('calm');
  say('d·n 必須是 O(n)', '不然整個就超過了');
  await step(tok);                                   // 43:30 so d is a constant: O(1)
  sl.forEach((s) => glow(s, null));
  note('條件一：d = O(1)', 4.0, 2.6, 0);
  say('所以 d 必須是常數：d = O(1)');
  await step(tok);                                   // 43:46 even if k is much smaller (log n, 2), one round is O(n)
  say('k 比 n 小很多（log n、甚至 2）', '一回合還是 O(n)');
  await step(tok);                                   // 44:11 set k as high as possible: k = O(n)
  note('條件二：k = O(n)（越大越好）', 4.0, 3.3, 0);
  gd.mood('wow');
  say('那乾脆把 k 設到最大', 'k = O(n)');
  await step(tok);                                   // 44:31 (Q&A) n = number of keys, k = size of the count array
  bubble('n = key 的個數　k = 計數陣列的大小', 0, 4.6, 0);
  gd.mood('calm');
  say('提醒：n 是 key 的個數', 'k 是計數陣列的大小（值的範圍）');
  await step(tok);                                   // 45:02 in memory we can use base-10000 digits
  note('黑板上用十進位；電腦裡可用 base 10000', -3.4, 3.6, 1.2);
  say('黑板上只能寫十進位', '電腦裡可以用 base 10000 之類的位數');
  await step(tok);                                   // 45:08 fewer digits run faster
  kill(sl[3]); kill(sl[2]);
  gd.mood('happy');
  say('位數越少（d 越小）', '跑得越快');
  await step(tok);                                   // 45:24 both bounds together: keys up to n^O(1)
  txt(t, 'key ≤ n^O(1) → O(n)');
  gd.mood('wow');
  say('兩個條件合起來', 'key 可以從 0 一路到 n^O(1)');
  await step(tok);                                   // 45:42 n^c for any constant c: huge keys
  good('很大的整數也能線性排序（只要是 nᶜ）', 0, -0.2, 1.4);
  gd.mood('happy'); await gd.hop(tok);
  say('key 可以到 nᶜ（c 是任意常數）', '很大的數也能線性時間排序');
}]);

// 46:12 換成穩定的 merge sort？d × n log n → 不是線性；回顧：從 n log n 到 Θ(n)
FRAG.push(['sortmit-rec-radix-merge', '每回合改用 merge sort 會怎樣', async (tok) => {
  fresh([0, 4.5, 12], [0, 2.2, 0]);
  const gd = guide(-6.4, 2.4, 0.6);
  const n = 16, d = 2, k = 16;
  const hc = d * (n + k) / 30, hm = d * n * Math.log2(n) / 30;
  let a = null;
  await step(tok);                                   // 46:12 use merge sort instead of counting sort?
  bubble('每回合改用（穩定的）merge sort？', 0, 5.4, 0);
  gd.mood('wow');
  say('如果每回合改用穩定的 merge sort 呢？');
  await step(tok);                                   // 46:32 it's stable, so it's correct; running time?
  a = cube(null, '#4b9ee2', [1.6, hc, 1.2], -2.2, hc / 2, 0); tag('counting：d·(n + k)', 'ptr', -2.2, hc + 0.5, 0);
  tag('示意：n = 16，d = 2', 'idx', 0, 0.05, 1.5);
  gd.mood('calm');
  say('它是穩定的，所以結果正確', '那時間呢？');
  await step(tok);                                   // 46:47 d × n log n
  const b = cube(null, '#c06a4a', [1.6, hm, 1.2], 2.2, hm / 2, 0); tag('merge：d·n log n', 'ptr', 2.2, hm + 0.5, 0);
  say('d 回合 merge sort：d·n log n');
  await step(tok);                                   // 46:55 never linear: merge sort doesn't go well with radix
  glow(b, RED);
  bad('d 再小也有 n log n → 不划算', 2.2, hm + 1.2, 0);
  gd.mood('sad');
  say('d 再小也逃不掉 n log n', 'merge sort 不適合搭配 radix sort');
  await step(tok);                                   // 47:01 we started at n log n and got to O(n)
  glow(a, GREEN);
  gd.mood('happy');
  say('回顧：從 n log n 一路做到 O(n)');
  await step(tok);                                   // 47:10 the best possible is Ω(n): we reached it
  const f = ghostBox(GREEN, 9, 0.05, 1.6); f.position.set(0, hc, 0);
  good('碰到 Ω(n) 的極限', -2.2, hc + 1.2, 0);
  await gd.hop(tok);
  say('最好也只能 Ω(n)', '我們碰到這個極限了');
}]);

// 47:26 穩定性 Q&A：第 2 回合不穩定會壞掉；哪些排序穩定
FRAG.push(['sortmit-rec-stable-why', '穩定性：radix 為什麼需要、誰穩定', async (tok) => {
  fresh([0, 9, 10.5], [0, 0, 0.6]);
  const gd = guide(-6.2, 3.0, 0.6);
  let M = null;
  await step(tok);                                   // 47:26 question: what is stability, which sorts are stable?
  bubble('Q：穩定是什麼？哪些排序穩定？', 0, 2.2, -4.0);
  gd.mood('wow');
  say('同學問：stability 的條件？', '哪些排序是穩定的？');
  await step(tok);                                   // 47:43 equal keys: the first in the input is first in the output
  note('相等的 key：輸入先出現 → 輸出也先', 0, 1.4, -4.0);
  gd.mood('calm');
  say('穩定：兩個相等的 key', '輸入裡先出現的，輸出也先出現');
  await step(tok);                                   // 47:55 keys may be complex objects mapped to integers
  bubble('key 可能是複雜物件（__int__ 轉成整數）', 0, 2.2, -2.6);
  say('key 不一定是整數', '可能是有 __int__ 方法的複雜物件');
  await step(tok);                                   // 48:11 the sort only sees a 3
  say('排序法只看到它對應的整數', '例如兩個不同的物件都只是「3」');
  await step(tok);                                   // 48:21 the first one in the input must come out first
  say('輸入裡先出現的那個', '輸出也必須在前面');
  await step(tok);                                   // 48:41 second round: counting sort sees only the tens digit
  M = mRadix(['2341', '1432', '2413', '1243', '2143', '1234'], { z0: -1.6, drop: true });
  M.col(2, GOLD);
  say('回到 radix 的第 2 回合', 'counting sort 只看得到十位');
  await step(tok);                                   // 48:58 this looks like 3; these three look like 4
  M.off(); ['2341', '1243', '2143'].forEach((s) => M.rowHl(s, BLUE));
  gd.mood('wow');
  say('1432、1234 看起來都是 3', '2341、1243、2143 看起來都是 4');
  await step(tok);                                   // 49:09 output 2341 at the very end → not sorted by the last two digits
  await M.order(tok, ['2413', '1432', '1234', '1243', '2143', '2341'], 1200);
  M.off(); ['1243', '2143', '2341'].forEach((s) => M.rowHl(s, RED));
  gd.mood('sad');
  say('如果把 2341 放到最後', '43、43、41：最後兩位不再有序');
  await step(tok);                                   // 49:20 it breaks any algorithm that assumes stability
  bad('依賴穩定性的演算法就壞了', 4.4, 1.6, 0);
  say('任何依賴穩定性的演算法都會壞掉');
  await step(tok);                                   // 49:23 stability: convenient for algorithms built on top
  await M.order(tok, ['2413', '1432', '1234', '2341', '1243', '2143'], 1200);
  M.off(); ['2341', '1243', '2143'].forEach((s) => M.rowHl(s, GREEN));
  gd.mood('calm');
  say('穩定才保住上一回合的成果', '用不到就不在意，但有時非要不可');
  await step(tok);                                   // 50:06 insertion sort never swaps equal keys: stable
  M.rows.forEach((R) => R.m.forEach((m) => fly(m)));
  const names = ['Insertion', 'Merge', 'Heap', 'Counting', 'Radix'], X = [-5.0, -2.5, 0, 2.5, 5.0];
  const card = (i, ok, why) => { const b = mBox(names[i], X[i], 0.4, 1.4, 2.2, ok ? MINT : '#efc9c0', 2); glow(b, ok ? GREEN : RED); tag(ok ? '穩定' : '不穩定', ok ? 'ptr alt' : 'ptr', X[i], 1.4, 1.4); tag(why, 'idx', X[i], 0.05, 2.3); };
  card(0, 1, '相等的不交換');
  say('insertion sort：遇到相等的不會交換', '→ 穩定');
  await step(tok);                                   // 50:18 merge sort: change one character to make it stable
  card(1, 1, '改一個字元（≤）');
  say('merge sort：講義裡那版不穩定', '改一個字元就穩定');
  await step(tok);                                   // 50:29 heapsort: unstable (a really small example)
  card(2, 0, '有很小的反例');
  gd.mood('sad');
  say('Heap sort：不穩定', '有一個很小的反例');
  await step(tok);                                   // 50:41 counting sort: stable
  card(3, 1, '由左往右放');
  gd.mood('happy');
  say('counting sort：穩定');
  await step(tok);                                   // 50:45 radix sort: stable
  card(4, 1, '靠穩定的 counting');
  await gd.hop(tok);
  say('radix sort：穩定', '只有 Heap Sort 不穩定');
}]);
  }

  // ═══ sortpeng.js ═══
  {
// ─── hXwxLgEOp-U：交大彭文志 Lec22 Sorting（Weiss / Horowitz 投影片）— cued: each step(tok) waits for the sentence it shows ───
// 只用 K 與 ctx。老師的例子：insertion / selection / bubble 都用 34 8 64 51 32 21（Weiss）；
// quick 用 Weiss 的 13 81 92 43 65 31 57 26 75 0（pivot 65，左堆再挑 31）與 Horowitz 的 26 5 37 1 61 11 59 15 48 19；
// heap 用 Weiss 的 insert 14（13 21 16 24 31 19 68 65 26 32）與 31 41 59 26 53 58 97（max heap 97 53 59 26 41 58 31）；
// radix 用 Weiss 的 64 8 216 512 27 729 0 1 343 125；external sort 用 4500 筆、記憶體 750 筆（3 個 250 的 block）；
// merge 順序用 Horowitz 的 2、4、5、15 個 block（43 vs 52）。
// merge 的例子（11 8 14 7 23 4 …）投影片只念出一部分：A6、A7 兩格（15 與 6）與單飛的 A8（9）是重建／示意值。
// 電話簿、筆畫數、身高、身分證字母、top-k 的字頻等是示意資料（老師沒有念數字）。
// Motion between steps is short (beat ≤ 2.5 s); the picture then holds until the next sentence.
const { V3, fresh, tag, cube, move, kill, glow, tint, txt, relabel, showL, code, line, arrow, ghostBox, GOLD, GREEN, RED, GRAY, step, buddy, prop, bob, travel } = K;
const say = ctx.say, beat = ctx.beat, colorFor = ctx.colorFor;
const BLUE = '#1f3a6e', PINK = '#8a1f5a';
const C_ME = '#7cb8ee', C_PIV = '#f4a56a', C_MEM = '#cfe3d4';
const nOf = (v) => parseInt(String(v), 10) || 0;
const W34 = [34, 8, 64, 51, 32, 21];
// friendly labels: a speech bubble, a sticky note, a travelling pill, a tick, a cross
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const pill = (t, x, y, z = 0) => tag(t, 'pkt', x, y, z);
const ok = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const no = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
// a row of value cubes; R.v = values, R.m = meshes, slot i at x = R.x(i)
function pRow(vals, o = {}) {
  const dx = o.dx || 1.05, y = o.y === undefined ? 0.5 : o.y, z = o.z || 0, sz = o.sz || 0.78;
  const n = vals.length, x0 = o.x0 === undefined ? -(n - 1) * dx / 2 : o.x0;
  const R = { v: vals.slice(), m: [], dx, y, z, n };
  R.x = (i) => x0 + i * dx;
  if (o.tiles !== false) for (let i = 0; i < n; i++) ctx.tile(V3(R.x(i), 0.02, z), dx * 0.9, 1.0);
  if (o.idx) for (let i = 0; i < n; i++) tag((o.pre || '') + (i + (o.base || 0)), 'idx', R.x(i), o.tiles === false ? y - 0.75 : 0.05, z + (o.tiles === false ? 0 : 0.75));
  vals.forEach((v, i) => { R.m[i] = v === null ? null : cube(v, colorFor(nOf(v)), [sz, sz, sz], R.x(i), y, z, o.drop ? 2.4 : 0); });
  R.hl = (list, c) => list.forEach((i) => { if (R.m[i]) glow(R.m[i], c); });
  R.off = () => R.m.forEach((m) => { if (m) glow(m, null); });
  R.at = (l, i, dy = 1.3) => { l.position.set(R.x(i), R.y + dy, R.z); };
  R.swap = async (tok, i, j, ms = 800) => {
    const a = R.m[i], b = R.m[j], h = R.y + 1.1;
    move(a, R.x(i), h, R.z); await beat(tok, ms * 0.3);
    move(a, R.x(j), h, R.z); move(b, R.x(i), R.y, R.z); await beat(tok, ms * 0.4);
    move(a, R.x(j), R.y, R.z); await beat(tok, ms * 0.3);
    [R.m[i], R.m[j]] = [R.m[j], R.m[i]]; [R.v[i], R.v[j]] = [R.v[j], R.v[i]];
  };
  // rearrange slots lo.. into the given value order (a permutation of those slots)
  R.arrange = async (tok, lo, order, ms = 900) => {
    const pool = []; for (let k = lo; k < lo + order.length; k++) pool.push([R.v[k], R.m[k]]);
    const h = R.y + 1.1;
    pool.forEach(([, m], k) => move(m, R.x(lo + k), h, R.z)); await beat(tok, ms * 0.3);
    order.forEach((v, k) => { const p = pool.findIndex((e) => e && e[0] === v); const [, m] = pool[p]; pool[p] = null; R.v[lo + k] = v; R.m[lo + k] = m; move(m, R.x(lo + k), h, R.z); });
    await beat(tok, ms * 0.4);
    for (let k = lo; k < lo + order.length; k++) move(R.m[k], R.x(k), R.y, R.z);
    await beat(tok, ms * 0.3);
  };
  R.zone = (old, c, i, j, hgt = 1.2) => { if (old) kill(old); if (j < i) return null; const g = ghostBox(c, (j - i + 1) * dx, hgt, 1.2); g.position.set((R.x(i) + R.x(j)) / 2, R.y, R.z); return g; };
  return R;
}
// insertion of slot i, one lecturer sentence at a time: lift → cmp (true = the left one is bigger) → shift … → place
function insCursor(R, i) {
  const km = R.m[i], kv = R.v[i], h = R.y + 1.1; let j = i - 1;
  return {
    kv, get j() { return j; },
    lift() { glow(km, GOLD); move(km, R.x(i), h, R.z); },
    cmp() { if (j < 0) return false; glow(R.m[j], BLUE); return R.v[j] > kv; },
    shift() { glow(R.m[j], null); move(R.m[j], R.x(j + 1), R.y, R.z); R.m[j + 1] = R.m[j]; R.v[j + 1] = R.v[j]; j--; move(km, R.x(j + 1), h, R.z); },
    place() { if (j >= 0) glow(R.m[j], null); R.m[j + 1] = km; R.v[j + 1] = kv; move(km, R.x(j + 1), R.y, R.z); glow(km, null); return j + 1; },
  };
}
// a whole insertion pass, quickly (motion only)
async function insFast(tok, R, i, ms = 300) {
  const c = insCursor(R, i); c.lift(); await beat(tok, ms);
  while (c.cmp()) { c.shift(); await beat(tok, ms); }
  c.place(); await beat(tok, ms);
}
// heap drawn as a tree (1-based slots); H.m[i] mesh, H.v[i] value
function heapView(vals, o = {}) {
  const n = o.n || vals.length, top = o.top === undefined ? 5.4 : o.top, Wd = o.W || 9, dy = o.dy || 1.3, cx = o.cx || 0;
  const pos = (i) => { const d = Math.floor(Math.log2(i)), k = i - (1 << d); return [cx - Wd / 2 + (k + 0.5) * Wd / (1 << d), top - d * dy]; };
  const H = { v: [null], m: [null], n, pos };
  for (let i = 2; i <= n; i++) { const [x, y] = pos(i), [px, py] = pos(i >> 1); line(px, py, x, y, 0); }
  for (let i = 1; i <= n; i++) {
    const [x, y] = pos(i), v = vals[i - 1];
    H.v[i] = v === undefined ? null : v;
    H.m[i] = v === undefined || v === null ? null : cube(v, colorFor(v), [0.8, 0.8, 0.8], x, y, 0, o.drop ? 2 : 0);
    if (o.idx !== false) tag(String(i), 'idx', x + 0.62, y + 0.42, 0);
  }
  H.swap = async (tok, i, j, ms = 700) => {
    const a = H.m[i], b = H.m[j], [xi, yi] = pos(i), [xj, yj] = pos(j);
    if (a) move(a, xj, yj, 0); if (b) move(b, xi, yi, 0); await beat(tok, ms);
    [H.m[i], H.m[j]] = [H.m[j], H.m[i]]; [H.v[i], H.v[j]] = [H.v[j], H.v[i]];
  };
  return H;
}
// sift down slot i inside 1..size; cmp(a, b) true when a should be above b
async function siftDown(tok, H, i, size, cmp, ms, onSwap = () => {}) {
  while (2 * i <= size) {
    let c = 2 * i; if (c + 1 <= size && cmp(H.v[c + 1], H.v[c])) c++;
    glow(H.m[i], GOLD); glow(H.m[c], BLUE); await beat(tok, ms * 0.5);
    glow(H.m[i], null); glow(H.m[c], null);
    if (!cmp(H.v[c], H.v[i])) break;
    await H.swap(tok, i, c, ms); onSwap(i, c); i = c;
  }
}
// radix buckets 0..9 along the floor, the input / output row on top
const BX = (b) => -6.3 + b * 1.4, TX = (i) => -5.85 + i * 1.3, TOPY = 5.0;
const p3 = (v) => String(v).padStart(3, '0');
const RADIX = [64, 8, 216, 512, 27, 729, 0, 1, 343, 125];
function radixBuckets() { for (let b = 0; b < 10; b++) { ctx.tile(V3(BX(b), 0.02, 0), 1.25, 1.0); tag(String(b), 'idx', BX(b), 0.05, 0.8); } }
function radixItems(vals, pad = true) { return vals.map((v, i) => ({ v, m: cube(pad ? p3(v) : v, colorFor(v), [1.15, 0.5, 0.8], TX(i), TOPY, 0) })); }
function radixSetup(vals) { radixBuckets(); return radixItems(vals); }
// drop items into buckets by digit; st[b] keeps the arrival order (bottom = first in)
async function distribute(tok, items, dig, ms, st) {
  st = st || []; for (let b = 0; b < 10; b++) st[b] = st[b] || [];
  for (const it of items) { const b = dig(it.v); glow(it.m, GOLD); move(it.m, BX(b), 0.35 + st[b].length * 0.56, 0); st[b].push(it); await beat(tok, ms); glow(it.m, null); }
  return st;
}
// read buckets 0 → 9, each from the bottom up (first in, first out) back to the top row
async function collect(tok, st, slot0, ms) {
  const out = []; let k = slot0;
  for (let b = 0; b < 10; b++) for (const it of st[b]) { move(it.m, TX(k), TOPY, 0); out.push(it); k++; await beat(tok, ms); }
  return out;
}

// 00:00 電話簿：record、key，最笨的 sequential search
FRAG.push(['sortpeng-seq-search', 'Sequential Search：一筆一筆比 key', async (tok) => {
  fresh([0, 6.8, 12], [0, 2.4, 0]);
  const names = ['陳', '彭', '林', '王', '李', '張'];
  await step(tok);                                   // 0:00 today: sorting; HW top-k words by frequency
  const t0 = bub('今天的主題：Sorting（排序）', 0, 5.8, 0);
  const words = [['data', 5], ['the', 9], ['tree', 7]];
  const W = words.map(([w, f], i) => { const m = cube(f, colorFor(f), [1.4, 0.6, 0.8], -1.7 + i * 1.7, 4.2, 0); relabel(m, w + ' ×' + f); return m; });
  say('作業 1、2：找 top-k popular word', '要先依 frequency 排序');
  await beat(tok, 700);
  move(W[1], -1.7, 4.2, 0); move(W[2], 0, 4.2, 0); move(W[0], 1.7, 4.2, 0);
  await beat(tok, 900);
  await step(tok);                                   // 0:49 database: records
  W.forEach(kill); kill(t0);
  const fields = [['彭文志', '名字'], ['交大', '公司'], ['03-xxx', '電話']];
  const card = fields.map(([v, f], i) => { const m = cube(i, colorFor(i + 3), [1.6, 0.6, 0.8], -1.8 + i * 1.8, 4.4, 0, 1.5); relabel(m, v); tag(f, 'idx', -1.8 + i * 1.8, 3.75, 0.5); return m; });
  bub('一筆 record = 好幾個欄位', 0, 5.4, 0);
  say('Database 處理的是一筆一筆的 record', '');
  await step(tok);                                   // 1:11 phone book: one contact = one record
  const R = pRow(names.map((s, i) => i + 1), { dx: 1.5, idx: true, base: 1, pre: 'a' });
  R.m.forEach((m, i) => relabel(m, names[i]));
  tag('手機電話簿：6 個聯絡人', 'ptr', 0, 1.6, 0);
  say('電話簿裡每個聯絡人都是一筆 record', '名字、公司、電話…');
  await step(tok);                                   // 1:46 find 彭文志's phone
  const me = buddy('找的人', '彭?', C_ME, -6.0, 0, 1.4, 0.7); me.look(1); me.mood('wow');
  say('要在電話簿裡找「彭文志」', '你會怎麼做？');
  await step(tok);                                   // 2:13 write a program to do it
  me.mood('calm');
  bub('寫一個程式：搜尋聯絡人', -4.8, 2.6, 1.4);
  say('如果要你設計一個 software 來找呢？', '');
  await step(tok);                                   // 2:41 scan: take each record, check the name
  for (let i = 0; i < 3; i++) { glow(R.m[i], GOLD); await beat(tok, 350); glow(R.m[i], null); }
  say('Scan：一筆一筆拿出來看名字', '不是就丟過去看下一筆');
  await step(tok);                                   // 3:07 the searched field is called key
  card.forEach((m, i) => glow(m, i === 0 ? GOLD : null));
  R.m.forEach((m) => glow(m, GOLD));
  ok('名字欄位 = key', -1.8, 5.4, 0.6);
  say('拿來搜尋的那個欄位叫 key', '電話簿用「名字」當 key');
  await step(tok);                                   // 4:00 getKey
  R.off();
  pill('getKey() → 取出 key', 3.6, 3.0, 0.6);
  say('getKey()：問一筆 record「你的 key 是什麼？」', '');
  await step(tok);                                   // 4:15 setKey when adding a contact
  pill('setKey("林") → 設定 key', 3.6, 2.4, 1.0);
  say('setKey()：新增聯絡人時設定它的 key', '');
  await step(tok);                                   // 4:44 dumbest way: a loop over every record
  card.forEach(kill);
  const cd = code(['i = n;', 'while (i > 0 && a[i].getKey() != k)', '  i--;', 'return i;   // 0 = 沒找到'], 0, 5.6, 0.52);
  say('最笨的方法：一個迴圈 scan 每一筆', '');
  await step(tok);                                   // 4:52 the value we look for is k
  me.set('k=彭'); me.mood('happy');
  say('要找的 key 值叫 k', 'k = 彭');
  await step(tok);                                   // 5:01 while: compare each record's key with k
  cd.hl(1);
  say('while 迴圈：這一筆的 key 等於 k 嗎？', '不等於就 i--');
  await step(tok);                                   // 5:27 i starts at n
  cd.hl(0);
  const ip = tag('i = 6', 'ptr', 0, 0, 0); R.at(ip, 5, 1.2);
  say('一開始 i = n（老師說 100 筆就從 100 開始）', '這裡 n = 6');
  await step(tok);                                   // 5:36 counting down: 6, 5, 4, 3 …
  for (let i = 5; i >= 2; i--) {
    R.at(ip, i, 1.2); txt(ip, 'i = ' + (i + 1)); cd.hl(1); glow(R.m[i], RED);
    await beat(tok, 300); glow(R.m[i], null); cd.hl(2); await beat(tok, 150);
  }
  say('倒著檢查：張、李、王、林都 ≠ 彭', 'i 一直減');
  await step(tok);                                   // 5:43 equals k → leave the loop, return i
  R.at(ip, 1, 1.2); txt(ip, 'i = 2'); glow(R.m[1], GREEN); cd.hl(3);
  me.mood('happy'); await me.hop(tok);
  say('a[2] 的 key == 彭 → 跳出 while', 'return i = 2');
  await step(tok);                                   // 6:06 sequential search
  note('Sequential search：最差要看 n 筆 → O(n)', 0, 3.2, 1.2);
  say('一筆一筆檢查 = sequential search', 'O(n)');
}]);

// 06:21 先排序 → binary search，O(n) 降到 O(log n)
FRAG.push(['sortpeng-binary-search', '排好序才能 Binary Search', async (tok) => {
  fresh([0, 6.5, 12], [0, 2, 0]);
  const vals = [3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16];
  await step(tok);                                   // 6:21 is there a faster way?
  const me = buddy('找的人', 'k=11', C_ME, -6.2, 0, 2.2, 0.6); me.mood('wow');
  bub('有沒有更快的方法？', -5.2, 2.2, 2.2);
  say('有沒有比一筆一筆找更快的方法？', '');
  await step(tok);                                   // 6:29 your phone sorts contacts
  const R = pRow(vals, { dx: 1.0, idx: true, sz: 0.72 });
  tag('通訊錄依「姓的筆畫」排好序', 'ptr', 0, 1.7, 0);
  say('手機通訊錄會依 last name／筆畫排序', '');
  await step(tok);                                   // 6:49 jump straight to 11 strokes
  const hand = pill('直接跳到 11 劃 →', -5.2, 3.0, 0);
  await travel(tok, hand, V3(-5.2, 3.0, 0), V3(R.x(7), 2.2, 0), 1100);
  glow(R.m[7], GOLD); me.mood('happy');
  say('假設「彭」是 11 劃：直接翻到 11 劃那裡', '人也是這樣加速的');
  await step(tok);                                   // 7:12 binary search needs sorted data
  kill(hand); glow(R.m[7], null);
  const zs = R.zone(null, GREEN, 0, 11); ok('先決條件：這個欄位已經排好序 ✓', 0, 3.4, 0);
  say('Binary search 的先決條件', '要搜尋的欄位，資料都已排序');
  await step(tok);                                   // 7:35 sequential search: O(n)
  kill(zs);
  note('Sequential：O(n)', -4.6, 4.6, 0);
  say('本來 sequential search 要 O(n)', '');
  await step(tok);                                   // 7:43 compare with the middle, cut in half
  let lo = 0, hi = vals.length - 1, z = null, cnt = 0;
  const mp = tag('mid', 'ptr alt', 0, 0, 0);
  while (lo <= hi) {
    const mid = (lo + hi) >> 1; cnt++;
    z = R.zone(z, BLUE, lo, hi); R.at(mp, mid, 1.2); glow(R.m[mid], GOLD);
    await beat(tok, 550);
    if (vals[mid] === 11) { glow(R.m[mid], GREEN); break; }
    glow(R.m[mid], null);
    if (vals[mid] < 11) lo = mid + 1; else hi = mid - 1;
  }
  say('每次跟中間比：小了丟左半、大了丟右半', '比了 ' + cnt + ' 次就找到 11');
  await step(tok);                                   // 7:50 down to O(log n)
  note('排好序 + Binary：O(log n)', 4.4, 4.6, 0);
  me.mood('happy'); await me.hop(tok);
  say('每次對切 → O(log n)', '<span class="ok">O(n) → O(log n)</span>');
  await step(tok);                                   // 8:10 an application of sorting
  kill(z);
  bub('先 sort，再 search → 快很多', 0, 3.4, 1.0);
  say('這就是 sort 的一個應用', '');
  await step(tok);                                   // 8:40 HW3: top-K PageRank nodes
  note('作業 3：PageRank 最高的 top-K node → 也要 sort', 0, 5.6, 0);
  say('作業 3 一樣要用到 sort', '');
  await step(tok);                                   // 9:15 no single winner
  const fam = ['Insertion', 'Selection', 'Bubble', 'Merge', 'Quick', 'Heap'];
  fam.forEach((s, i) => { const b = buddy(s, '', colorFor(i + 2), -5.0 + i * 2.0, 0, 3.2, 0.5); b.look(i < 3 ? 1 : -1); });
  say('等一下介紹很多種 sort', '<span class="no">沒有一種永遠是 winner</span>，各有優缺點');
}]);

// 09:32 Internal sort vs External sort
FRAG.push(['sortpeng-int-ext', 'Internal vs External Sort', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 2, 0]);
  await step(tok);                                   // 9:32 two kinds
  bub('Internal sort', -3.6, 4.6, 0); bub('External sort', 3.4, 4.6, 0);
  say('排序演算法大致分兩類', 'internal 和 external');
  await step(tok);                                   // 9:52 internal: everything fits in memory
  const mem = ghostBox(GREEN, 4.2, 2.2, 2.0); mem.position.set(-3.6, 1.2, 0);
  tag('Memory', 'ptr', -3.6, 2.7, 0);
  const a = [];
  for (let k = 0; k < 6; k++) a.push(cube(null, colorFor(k), [0.6, 0.6, 0.6], -4.6 + (k % 3) * 1.0, 0.5 + Math.floor(k / 3) * 0.7, 0, 3));
  ok('全部放得進 memory ✓', -3.6, 3.4, 0.4);
  say('要排的數字或 records 全部能放進 memory', '→ Internal sort');
  await step(tok);                                   // 10:19 too many elements
  const disk = prop('disk', 3.4, 0, 1.6, 1.4, 'Disk 上的資料');
  const b = [];
  for (let k = 0; k < 15; k++) b.push(cube(null, colorFor(k + 1), [0.55, 0.55, 0.55], 1.4 + (k % 5) * 1.0, 0.4 + Math.floor(k / 5) * 0.75, -1.0, 2));
  say('如果資料量超過 memory 能容納的…', '');
  await step(tok);                                   // 10:31 4GB memory, 500GB data
  const ml = tag('Memory 4GB', 'ptr', -3.6, 2.7, 0.6), dl = tag('資料 500GB', 'ptr alt', 3.4, 3.1, -1.0);
  no('500GB 塞不進 4GB ✗', 3.4, 4.0, 0);
  say('Memory 4GB、資料 500GB', '塞不進去');
  await step(tok);                                   // 10:51 external method sort
  note('→ External method sort', 3.4, 5.4, 0);
  say('這時要用 external method sort', '');
  await step(tok);                                   // 11:08 buy more memory?
  mem.scale.set(1.15, 1.15, 1); txt(ml, 'Memory 8GB？');
  say('多買 memory 不就好了？', '');
  await step(tok);                                   // 11:25 data grows faster than memory
  for (let k = 0; k < 5; k++) b.push(cube(null, colorFor(k + 4), [0.55, 0.55, 0.55], 1.4 + k * 1.0, 0.4 + 3 * 0.75, -1.0, 2.5));
  txt(dl, '資料 5000GB…');
  say('資料成長的速度比 memory 快太多', '');
  await step(tok);                                   // 11:45 external sort will be needed
  for (let r = 0; r < 3; r++) { move(b[r], -4.6 + r * 1.0, 2.0, 0); }
  await beat(tok, 900);
  for (let r = 0; r < 3; r++) { glow(b[r], GREEN); move(b[r], 1.4 + r * 1.0, 0.4, -1.0); }
  await beat(tok, 900);
  say('一次只讀一部分進 memory，排完寫回去', '→ external sort 一定會用到');
  await step(tok);                                   // 11:51 start with internal methods
  ok('先講 internal 的經典演算法', -3.6, 4.0, 0.4);
  say('今天先講 internal、最後講 external', '');
  void disk;
}]);

// 12:04 Insertion Sort 的想法：前 n−1 個已排好，把第 n 個插進去
FRAG.push(['sortpeng-insert-idea', 'Insertion Sort：抓一個插進排好的部分', async (tok) => {
  fresh([0, 6.5, 11], [0, 1.8, 0]);
  await step(tok);                                   // 12:04 given n numbers
  let R = pRow([8, 32, 34, 51, 64, 21], { dx: 1.3, idx: true, pre: 'a' });
  say('Insertion sort：假設給你 n 個數字', '');
  await step(tok);                                   // 12:12 suppose n−1 of them are already sorted
  let zs = R.zone(null, GREEN, 0, 4);
  const st = tag('前 n−1 個已經排好', 'ptr', R.x(2), 2.1, 0);
  say('假設已經知道前 n−1 個怎麼排', '');
  await step(tok);                                   // 12:20 grab the n-th and put it in
  await insFast(tok, R, 5, 380);
  zs = R.zone(zs, GREEN, 0, 5); txt(st, 'n 個都排好了');
  say('第 n 個抓出來，塞進前面 n−1 個裡', '→ n 個都排好');
  await step(tok);                                   // 12:37 insertion = 插入
  bub('Insertion = 插入：抓一個，insert 到排好的裡面', 0, 3.6, 0);
  say('名字就是概念：抓一個出來 insert', '');
  await step(tok);                                   // 13:15 like mathematical induction
  const lad = [];
  const rung = (s, i, cls) => { const l = tag(s, cls || 'note', 4.8, 5.4 - i * 0.6, 1.0); lad.push(l); return l; };
  rung('n 個 ← 靠 n−1 個排好', 0);
  say('前 n−1 個怎麼排好？', '像數學歸納法');
  await step(tok);                                   // 13:31 n−1 relies on n−2 …
  rung('n−1 個 ← 靠 n−2 個', 1); await beat(tok, 400); rung('⋮', 2, 'idx');
  say('再假設 n−2 個排好，把第 n−1 個丟進去', '一路 recursive 下去');
  await step(tok);                                   // 13:39 n = 1: one number
  rung('n = 1：只有一個 → 本來就排好 ✓', 3, 'good');
  say('最後 n = 1：只有一個數字', '本來就排好了');
  await step(tok);                                   // 13:52 the array has two parts: sorted …
  lad.forEach(kill); R.m.forEach(kill); kill(zs); kill(st);
  R = pRow(W34, { dx: 1.3, idx: false, tiles: false });
  zs = R.zone(null, GREEN, 0, 0);
  const sl = tag('sorted', 'ptr', R.x(0), 2.3, 0);
  say('示意圖：array 分成兩部分', '前面是 sorted');
  await step(tok);                                   // 14:00 … and unsorted
  let zu = R.zone(null, GRAY, 1, 5);
  const ul = tag('unsorted', 'idx', (R.x(1) + R.x(5)) / 2, 2.3, 0);
  say('後面是 unsorted', '');
  await step(tok);                                   // 14:20 the first element of the unsorted part: index p
  const pp = tag('p', 'ptr alt', 0, 0, 0); R.at(pp, 1, -1.0);
  glow(R.m[1], GOLD);
  say('unsorted 的第一個 element，index 是 p', 'a[p] = 8');
  await step(tok);                                   // 14:34 insert it into the sorted part a[0..p−1]
  glow(R.m[1], null);
  await insFast(tok, R, 1, 420);
  say('抓出來，insert 到 sorted 的 a[0..p−1]', '');
  await step(tok);                                   // 14:43 the sorted part grows
  zs = R.zone(zs, GREEN, 0, 1); zu = R.zone(zu, GRAY, 2, 5);
  sl.position.set((R.x(0) + R.x(1)) / 2, 2.3, 0); ul.position.set((R.x(2) + R.x(5)) / 2, 2.3, 0);
  say('sorted 的部分往右多一格', '');
  await step(tok);                                   // 14:52 next p, insert again, one by one
  R.at(pp, 2, -1.0);
  await insFast(tok, R, 2, 380);
  zs = R.zone(zs, GREEN, 0, 2); zu = R.zone(zu, GRAY, 3, 5);
  sl.position.set(R.x(1), 2.3, 0); ul.position.set((R.x(3) + R.x(5)) / 2, 2.3, 0);
  say('p 往右一格，再塞一個', '一個一個塞進來');
}]);

// 15:09 例子 34 8 64 51 32 21：Pass 1–4
FRAG.push(['sortpeng-insert-passes', 'Insertion Sort：34 8 64 51 32 21', async (tok) => {
  fresh([0, 6.5, 11], [0, 1.8, 0]);
  await step(tok);                                   // 15:09 six numbers
  const R = pRow(W34, { dx: 1.3, idx: true, pre: 'a', drop: true });
  const pl = tag('', 'ptr alt', 0, 3.6, 0);
  say('例子：六個數字 34 8 64 51 32 21', '');
  await step(tok);                                   // 15:19 a0 = 34 alone is sorted
  let zs = R.zone(null, GREEN, 0, 0);
  say('一開始 a0 = 34：只有一個數字', '自己就排好了（畫底線）');
  await step(tok);                                   // 15:36 Pass 1: take a1 = 8
  txt(pl, 'Pass 1');
  let c = insCursor(R, 1); c.lift();
  say('Pass 1：拿 a1 = 8', '要 insert 到前半段（只有 34）');
  await step(tok);                                   // 15:53 8 vs 34
  c.cmp();
  say('8 和 34 比：34 比較大', '');
  await step(tok);                                   // 16:05 8 goes to a0
  c.shift(); await beat(tok, 500); c.place();
  zs = R.zone(zs, GREEN, 0, 1);
  say('34 往右、8 放到 a0', '8 34 畫底線：排好了');
  await step(tok);                                   // 16:26 Pass 2: 64
  txt(pl, 'Pass 2');
  await insFast(tok, R, 2, 450);
  zs = R.zone(zs, GREEN, 0, 2);
  say('Pass 2：64 比 8、34 都大', '直接排在最後：8 34 64');
  await step(tok);                                   // 16:51 Pass 3: 51 goes between 34 and 64
  txt(pl, 'Pass 3');
  await insFast(tok, R, 3, 450);
  zs = R.zone(zs, GREEN, 0, 3);
  say('Pass 3：51 介於 34 和 64 之間', '64 往後 shift 一位 → 8 34 51 64');
  await step(tok);                                   // 17:14 always: take one from the unsorted part
  bub('每次從還沒排好的部分拿一個，塞進前面排好的', 0, 4.6, 0);
  say('一直類推', '');
  await step(tok);                                   // 17:36 Pass 4: 32 comes in
  txt(pl, 'Pass 4');
  c = insCursor(R, 4); c.lift();
  say('Pass 4：32 要塞進來', '怎麼塞？一個一個比');
  await step(tok);                                   // 18:05 32 vs 64
  c.cmp();
  say('32 和 64 比：64 比較大', '');
  await step(tok);                                   // 18:22 64 moves right, 32 moves forward
  c.shift();
  say('64 往右、32 往前', '有點像 bubble sort 的味道');
  await step(tok);                                   // 18:40 32 vs 51: 51 is copied right
  c.cmp(); await beat(tok, 500); c.shift();
  say('32 和 51 比：51 比較大', '51 往右，32 再往前');
  await step(tok);                                   // 18:48 32 vs 34
  c.cmp(); await beat(tok, 500); c.shift();
  say('32 和 34 比：32 比較小', '34 往右，32 再往前');
  await step(tok);                                   // 19:09 32 vs 8: 8 is smaller, stop
  c.cmp(); await beat(tok, 500); c.place();
  zs = R.zone(zs, GREEN, 0, 4);
  say('32 和 8 比：8 比較小 → 停', '32 放在 8 後面');
  await step(tok);                                   // 19:19 the result of this pass
  say('Pass 4 後：' + R.v.join(' '), '考試考的是每個 pass 的中間結果');
  await step(tok);                                   // 19:28 the idea once more
  bub('抓 unsorted 的第一個 → 一個一個比 → 放到該放的位置', 0, 4.0, 1.0);
  say('概念很簡單：抓一個 element insert 進來', '');
}]);

// 20:16 紅字的程式：tmp = a[p]，a[j-1] > tmp 就 a[j] = a[j-1]
FRAG.push(['sortpeng-insert-code', 'Insertion Sort 的程式：插入 32', async (tok) => {
  fresh([0, 7, 12], [0, 2.4, 0]);
  const cd = code(['for (p = 1; p < n; p++) {', '  tmp = a[p];', '  for (j = p; j > 0 && a[j-1] > tmp; j--)', '    a[j] = a[j-1];', '  a[j] = tmp;', '}'], 0, 6.2, 0.5);
  const R = pRow([8, 34, 51, 64, 32, 21], { dx: 1.3, idx: true, pre: 'a', x0: -4.2 });
  let zs = R.zone(null, GREEN, 0, 3);
  const jp = tag('', 'ptr', 0, 0, 0); showL(jp, false);
  await step(tok);                                   // 20:16 p starts at 1
  cd.hl(0);
  say('紅字是程式：外層 for，p 從 1 開始', '');
  await step(tok);                                   // 20:24 a0 never moves in pass 1
  glow(R.m[0], GREEN);
  note('a0 自己就排好：不用從 0 開始', R.x(0), 2.2, 0.6);
  say('p = 1 就是 Pass 1：a0 不用動', '');
  await step(tok);                                   // 20:33 tmp = a[p]
  glow(R.m[0], null); cd.hl(1);
  const tmp = buddy('tmp', '', C_PIV, 5.2, 0, 1.2, 0.7);
  const c = insCursor(R, 4); c.lift();
  const pk = pill('32', R.x(4), 2.2, 0);
  await travel(tok, pk, V3(R.x(4), 2.2, 0), V3(5.2, 1.0, 1.2), 800);
  kill(pk); tmp.set(32); tmp.mood('happy');
  say('前四個已排好，現在 p = 4', 'tmp = a[4] = 32（先拿出來記住）');
  await step(tok);                                   // 20:42 j = p
  cd.hl(2); showL(jp, true); R.at(jp, 4, -1.4); txt(jp, 'j = 4');
  say('內層 for：j = p = 4', '');
  await step(tok);                                   // 20:51 condition: j > 0 and a[j−1] > tmp
  c.cmp(); tmp.look(-1);
  say('條件：j > 0 而且 a[j−1] > tmp', 'a[3] = 64 > 32 → 成立');
  await step(tok);                                   // 21:04 a[j] = a[j−1]
  cd.hl(3); c.shift();
  say('a[j] = a[j−1]：64 往右複製一格', '老師叫它 swap，其實是 shift');
  await step(tok);                                   // 21:37 j−−, the loop goes on
  cd.hl(2); R.at(jp, 3, -1.4); txt(jp, 'j = 3');
  c.cmp(); await beat(tok, 450); cd.hl(3); c.shift(); await beat(tok, 450);
  cd.hl(2); R.at(jp, 2, -1.4); txt(jp, 'j = 2');
  c.cmp(); await beat(tok, 450); cd.hl(3); c.shift(); await beat(tok, 450);
  cd.hl(2); R.at(jp, 1, -1.4); txt(jp, 'j = 1');
  say('j−−，再比：51、34 也比 32 大', '一個一個往右 shift');
  await step(tok);                                   // 21:50 run until the loop stops, then a[j] = tmp
  c.cmp(); await beat(tok, 500);
  cd.hl(4); c.place(); tmp.set(''); tmp.mood('calm');
  zs = R.zone(zs, GREEN, 0, 4);
  say('a[0] = 8 不大於 32 → 跳出', 'a[j] = tmp：32 放進 a1');
  await step(tok);                                   // 22:19 go back and read the code
  cd.hl(-1); showL(jp, false);
  note('回去一定要自己 trace 程式', 4.4, 3.6, 0);
  say('程式一定要回去自己看、自己 trace', '');
  await step(tok);                                   // 22:36 not the only way to write it
  note('寫法不唯一：也可以從頭開始比', 4.4, 3.0, 0.6);
  say('這不是唯一的寫法', '');
  await step(tok);                                   // 22:47 the exam may change the red lines
  cd.ls.slice(1, 4).forEach((l) => { l.element.className = 'lab-label bad'; });
  say('考試可能把紅字改掉', '再問你每一步的結果');
}]);

// 23:07 Selection Sort 的想法：每次從剩下的選最小的
FRAG.push(['sortpeng-select-idea', 'Selection Sort：每次選最小的', async (tok) => {
  fresh([0, 6.5, 11], [0, 1.8, 0]);
  await step(tok);                                   // 23:07 another one: selection sort
  const R = pRow(W34, { dx: 1.3, idx: true, pre: 'a' });
  bub('Selection sort', 0, 4.2, 0);
  say('另一個：Selection sort', '');
  await step(tok);                                   // 23:17 insertion = insert, selection = select
  note('Insertion = 插入', -3.4, 3.4, 0); note('Selection = 選擇', 3.4, 3.4, 0);
  say('顧名思義：selection 就是「選擇」', '');
  await step(tok);                                   // 23:24 sort n numbers small to large
  say('給你 n 個數字，從小排到大', '');
  await step(tok);                                   // 23:38 pick the smallest for the first place
  for (let i = 0; i < 6; i++) { glow(R.m[i], GOLD); await beat(tok, 200); glow(R.m[i], null); }
  glow(R.m[1], PINK);
  const a1 = arrow(V3(R.x(1), 1.5, 0.6), V3(R.x(0), 1.5, 0.6), 0x8a1f5a);
  say('從 n 個裡挑最小的（8）', '放第一個位置');
  await step(tok);                                   // 23:47 from the remaining n−1, the smallest goes second
  for (let i = 1; i < 6; i++) { glow(R.m[i], i === 1 ? PINK : GOLD); await beat(tok, 200); if (i !== 1) glow(R.m[i], null); }
  glow(R.m[5], PINK);
  arrow(V3(R.x(5), 1.9, 0.6), V3(R.x(1), 1.9, 0.6), 0x8a1f5a);
  say('再從剩下 n−1 個選最小的（21）', '放第二個位置');
  await step(tok);                                   // 23:55 and so on
  say('再從剩下的選最小的……', '這就是 selection sort');
  await step(tok);                                   // 24:05 the picture looks the same, the idea differs
  kill(a1); R.off();
  const zs = R.zone(null, GREEN, 0, 1), zu = R.zone(null, GRAY, 2, 5);
  tag('sorted', 'ptr', (R.x(0) + R.x(1)) / 2, 2.4, 0); tag('unsorted', 'idx', (R.x(2) + R.x(5)) / 2, 2.4, 0);
  say('示意圖跟 insertion 長得一樣', '可是 idea 不一樣');
  await step(tok);                                   // 24:24 a double arrow: a swap
  arrow(V3(R.x(2), 2.9, 0.6), V3(R.x(4), 2.9, 0.6), 0x0f5a3a); arrow(V3(R.x(4), 2.9, 0.6), V3(R.x(2), 2.9, 0.6), 0x0f5a3a);
  say('雙箭頭：unsorted 裡最小的跟 a[p] 對調', '');
  await step(tok);                                   // 24:35 p = 0, 1, 2 …
  const pp = tag('p', 'ptr alt', 0, 0, 0);
  for (let p = 0; p < 3; p++) { R.at(pp, p, -1.1); txt(pp, 'p = ' + p); await beat(tok, 500); }
  say('p = 0、1、2…一路累積', '');
  await step(tok);                                   // 24:50 every run selects the minimum
  say('每一個 run 都做一次「選最小」', '');
  void zs; void zu;
}]);

// 25:09 例子：34 8 64 51 32 21，每回合選最小跟 a[p] 交換；再看程式
FRAG.push(['sortpeng-select-passes', 'Selection Sort：選最小的跟 a[p] 交換', async (tok) => {
  fresh([0, 7, 12], [0, 2.4, 0]);
  const R = pRow(W34, { dx: 1.3, idx: true, pre: 'a' });
  let zs = null;
  const pp = tag('p = 0', 'ptr alt', 0, 0, 0); R.at(pp, 0, -1.4);
  const scan = async (p) => { let m = p; for (let j = p; j < 6; j++) { glow(R.m[j], GOLD); await beat(tok, 160); if (R.v[j] < R.v[m]) m = j; glow(R.m[j], null); } glow(R.m[m], PINK); return m; };
  await step(tok);                                   // 25:09 the smallest of the six is 8
  let m = await scan(0);
  say('六個數字裡最小的是 8', '');
  await step(tok);                                   // 25:17 8 is at A1
  const at = note('8 在 A1', R.x(1), 2.2, 0.4);
  say('8 原來的位置在 A1', '');
  await step(tok);                                   // 25:27 copy to A0 (swap with 34)
  kill(at); await R.swap(tok, 0, m, 1000); R.off();
  zs = R.zone(zs, GREEN, 0, 0);
  say('8 換到 A0，34 換到 8 原來的位置', '');
  await step(tok);                                   // 25:48 the remaining five
  R.at(pp, 1, -1.4); txt(pp, 'p = 1');
  const zr = R.zone(null, GRAY, 1, 5);
  say('剩下 34 64 51 32 21 五個', '');
  await step(tok);                                   // 26:02 the smallest is 21
  m = await scan(1);
  say('五個裡最小的是 21', '');
  await step(tok);                                   // 26:18 copy 21 to A1, 34 to 21's place: swap
  kill(zr); await R.swap(tok, 1, m, 1000); R.off();
  zs = R.zone(zs, GREEN, 0, 1);
  say('21 到 A1、34 到 21 的位置', '這叫 swap（對調）');
  await step(tok);                                   // 26:40 the others stay where they are
  R.hl([2, 3, 4], BLUE);
  say('中間的 64 51 32 都維持在原地', '');
  await step(tok);                                   // 26:54 exams ask for the intermediate steps
  R.off();
  const n1 = note('考試：寫出每個 pass 的中間過程', 0, 4.4, 0);
  say('考試不會問最後結果', '會要你寫出中間過程');
  await step(tok);                                   // 27:30 compare with insertion sort
  const n2 = bub('Insertion：中間的 element 每個 pass 都可能挪動', -2.0, 3.6, 0.6);
  say('跟 insertion sort 比一比', '');
  await step(tok);                                   // 27:54 selection only swaps a[p] with the minimum
  const n3 = bub('Selection：只動 a[p] 和最小值那兩格', 2.0, 3.0, 1.0);
  say('Selection 只把最小值跟位置 p 交換', '沒影響到的數字不會動');
  await step(tok);                                   // 28:28 and so on: p = 2
  R.at(pp, 2, -1.4); txt(pp, 'p = 2');
  m = await scan(2); await R.swap(tok, 2, m, 800); R.off();
  zs = R.zone(zs, GREEN, 0, 2);
  say('依此類推：p = 2，最小 32 跟 64 對調', R.v.join(' '));
  await step(tok);                                   // 28:49 three left: 51 64 34, the smallest is 34
  R.at(pp, 3, -1.4); txt(pp, 'p = 3');
  m = await scan(3);
  say('剩 51 64 34 三個：最小是 34', '');
  await step(tok);                                   // 28:57 34 here, 51 there
  await R.swap(tok, 3, m, 1000); R.off();
  zs = R.zone(zs, GREEN, 0, 3);
  say('34 換到 a3、51 換到後面', R.v.join(' '));
  await step(tok);                                   // 29:05 done
  R.at(pp, 4, -1.4); txt(pp, 'p = 4');
  m = await scan(4); await R.swap(tok, 4, m, 800); R.off();
  zs = R.zone(zs, GREEN, 0, 5);
  say('最後一個 pass：51 跟 64 對調', '結束：' + R.v.join(' '));
  await step(tok);                                   // 29:16 the code: the inner for loop
  [n1, n2, n3].forEach(kill);
  const cd = code(['for (p = 0; p < n-1; p++) {', '  min = p;', '  for (j = p+1; j < n; j++)', '    if (a[j] < a[min]) min = j;', '  swap(a[p], a[min]);', '}'], 0, 6.2, 0.5);
  cd.hl(2);
  say('程式：內層 for 迴圈在找最小值', '在 unsorted 的部分找');
  await step(tok);                                   // 29:29 min = p, j from p+1
  cd.hl(1);
  say('min = p，j 從 p+1 開始', '在 p+1 到 n 裡找最小');
  await step(tok);                                   // 29:49 swap a[p] and a[min]
  cd.hl(4);
  say('找到最小的 → swap(a[p], a[min])', '');
  await step(tok);                                   // 29:59 the outer loop from p = 0
  cd.hl(0);
  say('外面再一層 for：p 從 0 開始', '');
}]);

// 30:21 Bubble Sort：從右往左兩兩比，小的像氣泡往前浮
FRAG.push(['sortpeng-bubble-passes', 'Bubble Sort：21 像氣泡往前浮', async (tok) => {
  fresh([0, 7, 12], [0, 2.4, 0]);
  const R = pRow(W34, { dx: 1.3, idx: true, pre: 'a' });
  let zs = null;
  const bp = tag('○ 氣泡', 'pkt', 0, 0, 0); showL(bp, false);
  // compare a[j-1], a[j]; swap if a[j] is smaller; returns true when swapped
  const cmpSwap = async (j, ms = 700) => {
    R.off(); R.hl([j - 1, j], GOLD); R.at(bp, j, 1.5); showL(bp, true);
    await beat(tok, ms * 0.4);
    const sw = R.v[j] < R.v[j - 1];
    if (sw) { R.hl([j - 1, j], RED); await R.swap(tok, j - 1, j, ms); R.at(bp, j - 1, 1.5); }
    R.off(); return sw;
  };
  await step(tok);                                   // 30:21 bubble sort from intro to CS
  bub('Bubble sort（計概講過）', 0, 4.6, 0);
  say('計概講過的 Bubble sort', '');
  await step(tok);                                   // 30:34 compare two at a time
  R.hl([4, 5], GOLD);
  say('概念：兩兩比較', '相鄰的兩個比大小');
  await step(tok);                                   // 30:45 like a bubble in water
  R.off();
  const bb = pill('○', R.x(5), 0.6, 1.0);
  await travel(tok, bb, V3(R.x(5), 0.6, 1.0), V3(R.x(0), 2.6, 1.0), 1600);
  kill(bb);
  say('像水裡的氣泡：咕嚕咕嚕往上冒', '最小的那個一路浮到前面');
  await step(tok);                                   // 30:51 the adjective has a meaning
  note('sort 前面的形容詞都有意義！', 3.6, 3.6, 0);
  say('Bubble、insertion、selection…', '名字都是提示');
  await step(tok);                                   // 31:27 the example: 34 8 64 51 32 21
  say('例子一樣是 34 8 64 51 32 21', '');
  await step(tok);                                   // 31:41 Pass 0 decides A0
  const a0 = tag('Pass 0 決定 A0', 'ptr alt', R.x(0), 2.6, 0);
  say('Pass 0 做完，A0 的數字就決定了', '');
  await step(tok);                                   // 32:04 the circle simulates the bubble
  R.at(bp, 5, 1.5); showL(bp, true);
  say('那個圓圈 ○ 就是在模擬氣泡', '從最後面 A5 開始');
  await step(tok);                                   // 32:12 A5 = 21 vs A4 = 32 → swap
  await cmpSwap(5, 900);
  say('21 和 32 比：21 比較小 → swap', '21 往前走、32 到 A5');
  await step(tok);                                   // 32:36 21 vs 51 → swap
  await cmpSwap(4, 900);
  say('21 再跟 51 比：還是比較小 → swap', '');
  await step(tok);                                   // 32:47 21 vs 64 → swap
  await cmpSwap(3, 900);
  say('21 跟 64 比：swap，又往前一格', '');
  await step(tok);                                   // 32:58 21 vs 8: 8 is smaller
  await cmpSwap(2, 900);
  say('21 跟 8 比：8 比較小', '21 這個氣泡停下來');
  await step(tok);                                   // 33:10 the relay goes to 8; 8 vs 34
  R.at(bp, 1, 1.5); txt(bp, '○ 接棒：8'); R.hl([0, 1], GOLD);
  say('接力給 8：8 再跟 A0 的 34 比', '');
  await step(tok);                                   // 33:20 swap again: Pass 0 done
  R.hl([0, 1], RED); await R.swap(tok, 0, 1, 900); R.off();
  zs = R.zone(zs, GREEN, 0, 0); txt(bp, '○');
  say('8 比 34 小 → swap', 'Pass 0 做完：8 就定位');
  await step(tok);                                   // 33:30 Pass 1: 32 vs 51, 32 vs 64
  kill(a0);
  await cmpSwap(5, 650); await cmpSwap(4, 650);
  say('Pass 1：32 跟 51 比 → swap；跟 64 比 → swap', '');
  await step(tok);                                   // 33:50 32 vs 21: stop, hand over to 21
  await cmpSwap(3, 700); R.at(bp, 2, 1.5); txt(bp, '○ 接棒：21');
  say('32 跟 21 比：21 比較小 → 32 停', '接棒給 21');
  await step(tok);                                   // 34:01 21 vs 34 → swap; Pass 1 done
  await cmpSwap(2, 900); txt(bp, '○');
  zs = R.zone(zs, GREEN, 0, 1);
  say('21 跟 34 比 → swap', 'Pass 1 做完：' + R.v.join(' '));
  await step(tok);                                   // 34:13 after Pass i, A0..Ai are sorted
  for (let p = 2; p < 5; p++) for (let j = 5; j > p; j--) if (R.v[j] < R.v[j - 1]) await R.swap(tok, j - 1, j, 600);
  showL(bp, false);
  zs = R.zone(zs, GREEN, 0, 5);
  say('做完 Pass i：A0 到 Ai 由小到大排好', '要做很多個 pass');
  await step(tok);                                   // 34:41 the code
  const cd = code(['for (p = 0; p < n-1; p++)', '  for (j = n-1; j > p; j--)', '    if (a[j] < a[j-1])', '      swap(a[j], a[j-1]);'], 0, 6.0, 0.5);
  cd.hl(0);
  say('程式：外層一樣是一個 for 迴圈', '');
  await step(tok);                                   // 35:03 j starts at n−1, the last element
  cd.hl(1);
  say('內層 for：j 從 n−1（最後一個）開始往前', '');
  await step(tok);                                   // 35:14 compare two; smaller → swap
  cd.hl(2); await beat(tok, 700); cd.hl(3);
  say('兩兩比較：後面的比較小就 swap', '');
}]);

// 35:36 Merge 的概念：兩隊各自排好身高，合成一隊
FRAG.push(['sortpeng-merge-idea', 'Merge：兩個排好的小隊合成一隊', async (tok) => {
  fresh([0, 6.5, 12], [0, 2, 0]);
  await step(tok);                                   // 35:36 the adjectives carry the meaning
  ['insert', 'select', 'bubble'].forEach((s, i) => note(s, -3 + i * 3, 5.4, 0));
  say('沒有老師跟我講：sort 前面的形容詞有意義', '');
  await step(tok);                                   // 35:53 results are the same; the concept is in the adjective
  bub('結果都一樣，重點是 concept：藏在形容詞裡', 0, 4.6, 0);
  say('排出來的結果都一樣', '重點是 concept');
  await step(tok);                                   // 36:12 merge = combine
  note('merge = 結合', 0, 3.8, 0.6);
  say('第四個：Merge sort', 'merge 就是「結合起來」');
  await step(tok);                                   // 36:18 two sorted lists
  const Av = [152, 158, 165, 171], Bv = [149, 160, 163, 175];
  const ax = (k) => -6.0 + k * 1.15, bx = (k) => 2.55 + k * 1.15, ox = (k) => -4.2 + k * 1.2;
  const A = Av.map((v, k) => buddy('', v, '#9fc8ee', ax(k), 0.9, 1.2, 0.48 + k * 0.05));
  const B = Bv.map((v, k) => buddy('', v, '#f3c1a0', bx(k), 0.9, 1.2, 0.47 + k * 0.05));
  say('手上有兩堆「已經 sort 好」的 list', '');
  await step(tok);                                   // 36:34 two teams at a camp, each sorted by height
  tag('第一小隊（矮→高）', 'ptr', -4.3, 2.4, 1.2); tag('第二小隊（矮→高）', 'ptr', 4.3, 2.4, 1.2);
  for (let k = 0; k < 8; k++) ctx.tile(V3(ox(k), 0.02, -1.2), 1.08, 1.0);
  say('營隊兩個小隊，各自依身高排好', '要合成一個大隊');
  await step(tok);                                   // 36:51 merge them: compare the two front people
  let a = 0, b = 0;
  for (let k = 0; k < 8; k++) {
    const takeA = b >= 4 || (a < 4 && Av[a] <= Bv[b]);
    const p = takeA ? A[a++] : B[b++];
    p.mood('happy'); move(p.g, ox(k), 0, -1.2);
    await beat(tok, 300);
  }
  say('兩隊排頭兩兩比：矮的先出列', '合成 8 人的大隊，也是排好的');
  await step(tok);                                   // 37:10 a recursive algorithm
  bub('recursive algorithm', -3.6, 4.0, 1.4);
  say('Merge sort 是一個 recursive（遞迴）的演算法', '');
  await step(tok);                                   // 37:13 divide and conquer
  bub('Divide and Conquer', 3.6, 4.0, 1.4);
  say('它用的策略叫 divide and conquer', '');
  await step(tok);                                   // 37:42 divide: cut a big problem into small ones
  const big = cube('大問題', GRAY, [5.0, 0.7, 1.0], 0, 3.0, -1.8);
  await beat(tok, 500); kill(big);
  const parts = [0, 1, 2, 3].map((i) => cube('小問題', colorFor(i), [1.15, 0.6, 1.0], -2.4 + i * 1.6, 3.0, -1.8));
  say('Divide：把大問題切成小問題', '');
  await step(tok);                                   // 37:49 conquer each one
  for (const m of parts) { glow(m, GREEN); await beat(tok, 300); }
  say('Conquer：每個小問題一一征服', '');
  await step(tok);                                   // 38:00 then the big problem is solved
  ok('小問題都解了 → 大問題就解了 ✓', 0, 4.0, -1.8);
  say('每個 subtask 都征服 → 大問題就解了', '');
}]);

// 40:36 例子：兩兩 merge，單飛的那個之後再加入；兩段長度不必相同
FRAG.push(['sortpeng-merge-passes', 'Merge Sort：一輪一輪兩兩合併', async (tok) => {
  fresh([0, 6.5, 12], [0, 1.8, 0]);
  const R = pRow([11, 8, 14, 7, 23, 4, 15, 6, 9], { dx: 1.25, idx: true, pre: 'A' });
  const zs = [];
  const runs = (list) => { zs.forEach(kill); zs.length = 0; for (const [i, j] of list) zs.push(R.zone(null, GREEN, i, j)); };
  const pl = tag('', 'ptr alt', 0, 3.4, 0);
  await step(tok);                                   // 40:36 back to divide and conquer
  say('回到 divide and conquer', '切成小問題、各自解、再 combine');
  await step(tok);                                   // 40:57 at first: compare two at a time
  runs([[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6], [7, 7], [8, 8]]);
  txt(pl, 'Pass 1');
  say('一開始兩兩去做比較', '');
  await step(tok);                                   // 41:08 one number under the underline: nothing to sort
  R.hl([0, 1], GOLD);
  say('11 和 8：底線下各只有一個數字', '一個數字本來就排好');
  await step(tok);                                   // 41:20 combine 8 and 11
  await R.arrange(tok, 0, [8, 11], 1100); R.off();
  runs([[0, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6], [7, 7], [8, 8]]);
  say('merge 起來：8 11', 'combine 時順便排好');
  await step(tok);                                   // 41:40 7 and 14
  await R.arrange(tok, 2, [7, 14], 1100);
  runs([[0, 1], [2, 3], [4, 4], [5, 5], [6, 6], [7, 7], [8, 8]]);
  say('14 和 7 也 combine：7 14', '');
  await step(tok);                                   // 41:50 merging 8 11 with 7 14: 7 is the smallest
  txt(pl, 'Pass 2');
  R.hl([0, 2], GOLD); await beat(tok, 500); glow(R.m[2], GREEN);
  say('8 11 和 7 14 合併：兩邊的頭 8 和 7', '7 最小，先放');
  await step(tok);                                   // 41:59 then 8 …
  await R.arrange(tok, 0, [7, 8, 11, 14], 1200); R.off();
  runs([[0, 3], [4, 4], [5, 5], [6, 6], [7, 7], [8, 8]]);
  say('剩下的頭裡 8 最小，再來 11、14', '→ 7 8 11 14');
  await step(tok);                                   // 42:15 that procedure is called merge
  note('合併兩個 sorted list 的 procedure：merge', 0, 4.4, 0);
  say('把兩個 sorted list 合起來的程序叫 merge', '');
  await step(tok);                                   // 42:21 the rest pairs up the same way
  await R.arrange(tok, 4, [4, 23], 700); await R.arrange(tok, 6, [6, 15], 700); await R.arrange(tok, 4, [4, 6, 15, 23], 900);
  runs([[0, 3], [4, 7], [8, 8]]);
  say('其他的也一樣兩兩 combine：4 23、6 15 → 4 6 15 23', '');
  await step(tok);                                   // 42:30 the last one flies solo
  glow(R.m[8], GOLD);
  const solo = bub('A8 = 9：沒人配對，先單飛', R.x(8) - 0.6, 2.4, 0);
  say('最後那一個沒辦法兩兩比', '只好自己單飛');
  await step(tok);                                   // 42:41 a good question: what if it can't pair up?
  note('像 23 和 4 → 4 23；落單的那個怎麼辦？', -2.0, 5.4, 0);
  say('同學問：沒辦法兩兩比怎麼辦？', '');
  await step(tok);                                   // 42:59 it joins a merged list in a later pass
  glow(R.m[8], null); kill(solo);
  await R.arrange(tok, 0, [4, 6, 7, 8, 11, 14, 15, 23], 1000);
  await R.arrange(tok, 0, [4, 6, 7, 8, 9, 11, 14, 15, 23], 1000);
  runs([[0, 8]]); txt(pl, '');
  say('之後的 pass 再加入已經 merge 好的 list', R.v.join(' '));
  await step(tok);                                   // 43:32 does every list need the same length?
  zs.forEach(kill); zs.length = 0;
  bub('兩段的數字個數一定要一樣嗎？', 0, 4.0, 0);
  say('又衍生一個問題：每段的長度要一樣嗎？', '');
  await step(tok);                                   // 44:03 four here, five there?
  zs.push(R.zone(null, BLUE, 0, 3), R.zone(null, PINK, 4, 8));
  tag('4 個', 'ptr', (R.x(0) + R.x(3)) / 2, 2.0, 0); tag('5 個', 'ptr', (R.x(4) + R.x(8)) / 2, 2.0, 0);
  say('一邊 4 個、一邊 5 個可不可以？', '');
  await step(tok);                                   // 44:15 merge only needs two sorted lists
  ok('可以！只要兩段都是 sorted list', 0, 3.2, 0.6);
  say('Merge 只要求：合併的是兩個 sorted list', '長度不必一樣');
}]);

// 44:59 merge 的做法：p、q 兩個 pointer，結果放進另一個 array B
FRAG.push(['sortpeng-merge-pq', 'Merge：p、q 比大小，copy 到新陣列 B', async (tok) => {
  fresh([0, 6.8, 12], [0, 2, 0]);
  const Lv = [7, 8, 11, 14], Rv = [4, 6, 15, 23];
  const xs = (k) => -5.25 + k * 1.5;
  let Am = [], Bt = [];
  let p = 0, q = 4, k = 0;
  const pp = tag('p', 'ptr', 0, 0, 0), qp = tag('q', 'ptr alt', 0, 0, 0); showL(pp, false); showL(qp, false);
  const sp = () => { pp.position.set(xs(Math.min(p, 3)), 4.5, 0); txt(pp, p < 4 ? 'p = ' + p : 'p 走完'); qp.position.set(xs(Math.min(q, 7)), 4.5, 0); txt(qp, q < 8 ? 'q = ' + q : 'q 走完'); };
  const take = (ms) => {
    const takeP = q >= 8 || (p < 4 && Lv[p] <= Rv[q - 4]);
    const m = takeP ? Am[p] : Am[q];
    if (takeP) p++; else q++;
    move(m, xs(k), 0.5, 0); glow(m, null); k++; sp();
    return beat(tok, ms);
  };
  await step(tok);                                   // 44:59 merge is simple
  for (let i = 0; i < 8; i++) { ctx.tile(V3(xs(i), 3.0, 0), 1.3, 1.0); tag('A' + i, 'idx', xs(i), 3.05, 0.75); }
  Am = Lv.concat(Rv).map((v, i) => cube(v, colorFor(v), [0.8, 0.8, 0.8], xs(i), 3.5, 0, 1.5));
  say('Merge 怎麼做？其實很簡單', '');
  await step(tok);                                   // 45:08 A0..A3 and A4..A7 are sorted
  const lz = ghostBox(GREEN, 5.9, 1.0, 1.2); lz.position.set((xs(0) + xs(3)) / 2, 3.5, 0);
  const rz = ghostBox(BLUE, 5.9, 1.0, 1.2); rz.position.set((xs(4) + xs(7)) / 2, 3.5, 0);
  say('前半 A0..A3、後半 A4..A7', '各自都已經 sort 好');
  await step(tok);                                   // 45:17 two pointers p and q
  showL(pp, true); showL(qp, true); sp();
  say('兩個 pointer：p 指左段第一個 A0', 'q 指右段第一個 A4');
  await step(tok);                                   // 45:35 which of the two is smaller?
  glow(Am[0], GOLD); glow(Am[4], GOLD);
  say('p = 0、q = 4：A0 = 7 和 A4 = 4 比', '誰比較小？');
  await step(tok);                                   // 45:44 4 is smaller: copy it
  glow(Am[0], null); glow(Am[4], GREEN);
  say('4 比較小 → 把 4 copy 一份', '放到哪裡？');
  await step(tok);                                   // 45:59 into another array
  for (let i = 0; i < 8; i++) { ctx.tile(V3(xs(i), 0.02, 0), 1.3, 1.0); tag('B' + i, 'idx', xs(i), 0.05, 0.75); }
  await take(800);
  say('放進另一個 array B：B0 = 4', '');
  await step(tok);                                   // 46:12 not back into A: 7 would be lost
  const warn = no('放回 A0？7 就被蓋掉不見了 ✗', xs(0), 5.3, 0);
  say('不能放回 A：放 A0 的話 7 就不見了', '一定要另開新的 array');
  await step(tok);                                   // 46:48 the overhead of merge sort
  kill(warn);
  note('Merge sort 的 overhead：額外一個 array', 3.6, 5.6, 0);
  say('所以 merge sort 需要額外的 array 空間', '');
  await step(tok);                                   // 47:11 q becomes 5
  sp(); glow(Am[0], GOLD); glow(Am[5], GOLD);
  say('4 被 copy 後，q 加 1 → q = 5', '');
  await step(tok);                                   // 47:23 6 is still smaller than 7 → B1
  glow(Am[0], null); await take(800);
  say('A5 = 6 還是比 7 小 → copy 到 B1', 'q 再加 1 → q = 6');
  await step(tok);                                   // 47:46 and so on
  for (let i = 0; i < 6; i++) await take(380);
  say('就這樣一直類推', '一邊走完，剩下的照抄');
  await step(tok);                                   // 47:56 like polynomial addition
  note('像多項式加法：兩個指標一路比下去', -3.0, 5.6, 0);
  say('這跟多項式相加（比指數）很像', '');
  await step(tok);                                   // 48:15 remember: extra space, pointer + 1
  kill(lz); kill(rz);
  say('重點：要有額外的 array 空間', '被 copy 的那邊 pointer 加 1');
}]);

// 48:33 遞迴版 mergeSort(a, tmp, left, right)
FRAG.push(['sortpeng-merge-recursive', '遞迴的 mergeSort(a, tmp, left, right)', async (tok) => {
  fresh([0, 7.2, 12.5], [0, 2.6, 0]);
  const R = pRow([11, 8, 14, 7, 23, 4, 15, 6], { dx: 1.3, idx: true });
  let cd = null, z = null;
  const zs = [];
  const zl = (list, c) => { zs.forEach(kill); zs.length = 0; for (const [i, j] of list) zs.push(R.zone(null, c, i, j)); };
  await step(tok);                                   // 48:33 a recursive function: mergeSort
  cd = code(['mergeSort(a, tmp, left, right) {', '  if (left < right) {', '    center = (left + right) / 2;', '    mergeSort(a, tmp, left, center);', '    mergeSort(a, tmp, center+1, right);', '    merge(a, tmp, left, center+1, right);', '  } }'], 0, 6.6, 0.48);
  cd.hl(0);
  say('recursive function：mergeSort', '');
  await step(tok);                                   // 48:47 tmp: the extra array
  const tb = note('tmp：額外的 array', 4.8, 2.6, 0.6);
  say('一定要有一個額外的 array：tmp', '');
  await step(tok);                                   // 48:55 left and right
  const lp = tag('left', 'ptr', R.x(0), -0.6, 0.8), rp = tag('right', 'ptr', R.x(7), -0.6, 0.8);
  z = R.zone(z, BLUE, 0, 7);
  say('left、right：這段 list 的最左和最右', 'mergeSort(a, tmp, 0, 7)');
  await step(tok);                                   // 49:11 the boundary condition
  cd.hl(1);
  say('Boundary condition：left < right 才繼續切', '（老師口誤說成「就停止」）');
  await step(tok);                                   // 49:24 center = half
  cd.hl(2);
  const cp = tag('center = 3', 'ptr alt', R.x(3), 1.6, 0);
  say('成立就取一半：center = (0 + 7) / 2 = 3', '');
  await step(tok);                                   // 49:33 call left..center and center+1..right
  cd.hl(3); kill(z); zl([[0, 3], [4, 7]], BLUE);
  say('呼叫 mergeSort(left, center)', '再呼叫 mergeSort(center+1, right)');
  await step(tok);                                   // 49:41 then merge
  cd.hl(5);
  say('兩半都處理完，才 merge', '');
  await step(tok);                                   // 50:08 at first: the whole 0..7
  kill(cp); cd.hl(0); zl([[0, 7]], BLUE);
  say('一開始呼叫的是整串 0 到 7', '切成 0..3 和 4..7 兩塊');
  await beat(tok, 700); zl([[0, 3], [4, 7]], BLUE);
  await step(tok);                                   // 50:30 recursive again: a0..a1, a2..a3 …
  cd.hl(3); zl([[0, 1], [2, 3], [4, 7]], BLUE);
  await beat(tok, 600); zl([[0, 0], [1, 1], [2, 3], [4, 7]], BLUE);
  say('又 recursive 呼叫：a0..a1、a2..a3', '一路往下切');
  await step(tok);                                   // 50:39 left ≥ right: stop
  cd.hl(1);
  R.hl([0, 1], GOLD);
  say('left 不小於 right（只剩一個）', '就不再切，直接 return');
  await step(tok);                                   // 51:21 cut until it can't be cut any more
  R.off(); zl([[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6], [7, 7]], BLUE);
  say('不斷 recursive，切到不能再切為止', '');
  await step(tok);                                   // 51:47 then the merging starts
  cd.hl(5);
  for (const [l, r] of [[0, 1], [2, 3], [4, 5], [6, 7]]) await R.arrange(tok, l, R.v.slice(l, r + 1).sort((x, y) => x - y), 450);
  zl([[0, 3], [4, 7]], GREEN);
  await R.arrange(tok, 0, R.v.slice(0, 4).sort((x, y) => x - y), 500); await R.arrange(tok, 4, R.v.slice(4, 8).sort((x, y) => x - y), 500);
  zl([[0, 7]], GREEN);
  await R.arrange(tok, 0, R.v.slice().sort((x, y) => x - y), 600);
  say('到最小單位才開始 merge，一路合回來', R.v.join(' '));
  await step(tok);                                   // 52:12 mind the boundary condition
  cd.hl(1); cd.ls[1].element.className = 'lab-label bad';
  say('寫 recursive 最重要：boundary condition', '沒寫 → 程式永遠跑不完');
  await step(tok);                                   // 52:44 extra space again
  void lp; void rp;
  tb.element.className = 'lab-label ptr alt';
  say('Merge 的程式很長，其實就是 p、q 比大小', '注意：要有額外空間 tmp');
}]);

// 52:54 T(n) = 2T(n/2) + n → O(n log n)
FRAG.push(['sortpeng-merge-recurrence', 'Merge Sort 分析：T(n) = 2T(n/2) + n', async (tok) => {
  fresh([0, 6.5, 12], [0, 2.6, 0]);
  const lv = [['n'], ['n/2', 'n/2'], ['n/4', 'n/4', 'n/4', 'n/4'], ['1', '1', '1', '1', '1', '1', '1', '1']];
  const ys = [5.2, 3.8, 2.4, 0.8];
  const level = (d) => { const k = lv[d].length, w = 9.6 / k; lv[d].forEach((s, i) => { const x = -5.2 + w * (i + 0.5); const g = ghostBox(d === 3 ? GREEN : BLUE, w - 0.15, 0.7, 1.0); g.position.set(x, ys[d], 0); tag(s, d === 3 ? 'idx' : '', x, ys[d], 0); }); };
  await step(tok);                                   // 52:54 T(n): sorting n numbers
  level(0);
  const f = tag('T(n)', 'ptr alt', 5.8, 6.2, 0);
  say('T(n)：給你 n 個數字，排好要花的時間', '');
  await step(tok);                                   // 53:02 cut in half: 2T(n/2), divide
  level(1); txt(f, 'T(n) = 2T(n/2)');
  say('切兩半，每半 n/2 個 → 2T(n/2)', '這是 divide');
  await step(tok);                                   // 53:20 + n: the merge
  txt(f, 'T(n) = 2T(n/2) + n'); tag('+ n', 'ptr alt', 5.8, ys[0], 0);
  say('後面的 + n：做 merge 的成本', '');
  await step(tok);                                   // 53:33 each half splits again
  level(2); tag('+ n', 'ptr alt', 5.8, ys[1], 0);
  say('每個 T(n/2) 又可以再細分成 T(n/4)', '這一層 merge 加起來也是 n');
  await step(tok);                                   // 53:50 solving recurrences: discrete math
  note('解遞迴式：離散數學會教', -4.0, 6.2, 0);
  say('怎麼解這種 recursive function？', '離散數學會教');
  await step(tok);                                   // 54:05 the answer: n log n
  level(3); tag('+ n', 'ptr alt', 5.8, ys[2], 0);
  tag('log n 層', 'ptr', -6.3, 3.0, 0);
  say('切到剩 1 個：共 log n 層，每層 n', '<span class="ok">T(n) = O(n log n)</span>');
  await step(tok);                                   // 54:14 substitute again and again
  const sub = code(['T(n) = 2T(n/2) + n', '     = 4T(n/4) + 2n', '     = 8T(n/8) + 3n', '     = … = nT(1) + n log n'], 3.4, 1.9, 0.42, 1.6);
  say('也可以一直代換下去', '代到 T(1) 為止');
  await step(tok);                                   // 54:39 algorithms, chapter one
  note('演算法第一章也會教', -4.0, 5.6, 0.6);
  say('現在不會解沒關係', '演算法課還有機會');
  await step(tok);                                   // 54:49 the concept: halve (divide), merge (conquer)
  sub.hl(3);
  say('Merge sort 的概念：切兩半 = divide', 'merge 合起來 = conquer');
}]);

// 55:12 Quick Sort：選 pivot 65，小的一堆、大的一堆，再遞迴
FRAG.push(['sortpeng-quick-65', 'Quick Sort：pivot 65 把資料分兩堆', async (tok) => {
  fresh([0, 6.5, 12], [0, 2, 0]);
  await step(tok);                                   // 55:12 quick sort
  bub('Quick sort', 0, 5.4, 0);
  say('從 merge 的概念再衍生一種：Quick sort', '');
  await step(tok);                                   // 55:29 the name only says "fast"
  note('quick = 快？名字看不出做法', 0, 4.6, 0);
  say('它的形容詞沒告訴你做法', '只說它很快');
  await step(tok);                                   // 56:02 comparison-based
  note('comparison-based：靠比大小的排序裡，它算很快', 0, 3.8, 0);
  say('在 comparison-based（靠比大小）的排序裡', '它算是最快的之一');
  await step(tok);                                   // 56:19 also divide and conquer
  say('它的概念也是 divide and conquer', '');
  await step(tok);                                   // 56:28 pick one: the pivot (a "標兵")
  const st = [0.5, 0.75, 0.6, 0.9, 0.55, 0.8].map((s, i) => buddy('', '', colorFor(i + 2), -5.0 + i * 2.0, 0, 1.6, s));
  st[2].mood('wow'); st[2].glow('#6a4a00');
  tag('pivot（標兵）', 'ptr alt', st[2].g.position.x, 1.4, 1.6);
  say('先挑一個出來當 pivot', '可以把它想成「標兵」');
  await step(tok);                                   // 56:35 smaller in one pile, bigger in the other
  bub('比它小的一堆 ｜ 比它大的一堆', 0, 4.6, 1.6);
  say('比 pivot 小的放一堆、大的放一堆', '');
  await step(tok);                                   // 56:49 the class: pick a student as pivot
  move(st[2].g, 0, 0, 1.6);
  say('像全班選一位同學當 pivot', '叫他站中間');
  await step(tok);                                   // 56:58 shorter left, taller right
  const sh = [0, 4], tl = [1, 3, 5];
  sh.forEach((i, k) => move(st[i].g, -4.6 + k * 1.6, 0, 1.6)); tl.forEach((i, k) => move(st[i].g, 1.8 + k * 1.6, 0, 1.6));
  st.forEach((b, i) => { if (i !== 2) { b.mood('happy'); b.look(i === 0 || i === 4 ? 1 : -1); } });
  await beat(tok, 900);
  say('比他矮的站左邊、比他高的站右邊', '再各自繼續選 → recursive');
  await step(tok);                                   // 57:13 the example
  st.forEach((b) => kill(b.g));
  const vals = [13, 81, 92, 43, 65, 31, 57, 26, 75, 0];
  const M = {}; vals.forEach((v, i) => { M[v] = cube(v, colorFor(v), [0.8, 0.8, 0.8], -5.85 + i * 1.3, 3.0, 0, 1.5); });
  say('例子：隨便挑一個數字當 pivot：65', '');
  glow(M[65], GOLD);
  await step(tok);                                   // 57:21 the smaller ones in one pile
  move(M[65], 0.6, 0.5, 0); const pv = tag('pivot 65', 'ptr alt', 0.6, 1.5, 0);
  const small = [13, 43, 31, 57, 26, 0], big = [81, 92, 75];
  for (let i = 0; i < small.length; i++) { move(M[small[i]], -5.6 + i * 1.0, 0.5, 0); await beat(tok, 250); }
  const zl = ghostBox(BLUE, 6.2, 1.2, 1.2); zl.position.set(-3.1, 0.5, 0);
  say('比 65 小的放一堆', '13 43 31 57 26 0');
  await step(tok);                                   // 57:32 the bigger ones in another
  for (let i = 0; i < big.length; i++) { move(M[big[i]], 2.1 + i * 1.0, 0.5, 0); await beat(tok, 250); }
  const zr = ghostBox(PINK, 3.2, 1.2, 1.2); zr.position.set(3.1, 0.5, 0);
  say('比 65 大的放另一堆', '81 92 75');
  await step(tok);                                   // 57:40 65 is the landmark
  glow(M[65], GREEN);
  say('65 就像一個標的物：左邊都比它小、右邊都比它大', '65 已經站在最後的位置');
  await step(tok);                                   // 57:59 pick a pivot in the left pile: 31
  kill(zl); glow(M[31], GOLD);
  const L2 = [13, 26, 0], R2 = [43, 57];
  move(M[31], -2.6, 0.5, 0);
  L2.forEach((v, i) => move(M[v], -5.6 + i * 1.0, 0.5, 0)); R2.forEach((v, i) => move(M[v], -1.6 + i * 1.0, 0.5, 0));
  await beat(tok, 700);
  say('左堆再選一個 pivot：剛好選到 31', '13 26 0 ｜31｜ 43 57');
  await step(tok);                                   // 58:12 recursive until done
  const fin = [0, 13, 26, 31, 43, 57, 65, 75, 81, 92];
  kill(zr); kill(pv);
  fin.forEach((v, i) => { glow(M[v], null); move(M[v], -5.85 + i * 1.3, 0.5, 0); });
  await beat(tok, 900);
  fin.forEach((v) => glow(M[v], GREEN));
  say('每一堆都再選 pivot、分兩堆', '一直 recursive 下去 → 排好');
  await step(tok);                                   // 58:37 much like merge sort
  note('Merge sort：從中間切兩半', -3.4, 4.4, 0); note('Quick sort：看 pivot 切兩半', 3.4, 4.4, 0);
  say('概念跟 merge sort 很像：都切兩半', '');
  await step(tok);                                   // 59:01 how to cut depends on the pivot
  say('差別：哪兩半？看比 pivot 大還是小', '');
  await step(tok);                                   // 59:08 the code: skipped today, trace it at home
  bub('程式今天跳過：回去自己 trace', 0, 2.6, 1.2);
  say('程式還蠻複雜，回去要 trace', '');
}]);

// 59:54 pivot 怎麼選：最小/最大就白選；random、median-of-three、sampling
FRAG.push(['sortpeng-pivot-choice', 'Pivot 怎麼選：random、三數取中、取樣', async (tok) => {
  fresh([0, 6.5, 12], [0, 2, 0]);
  const vals = [5, 9, 2, 7, 1, 8, 3, 6, 4];
  const R = pRow(vals, { dx: 1.25 });
  let z1 = null, z2 = null;
  await step(tok);                                   // 59:54 how to choose the pivot
  say('Quick sort 的難處：pivot 怎麼選？', '');
  await step(tok);                                   // 60:01 picking the smallest or largest is useless
  glow(R.m[4], RED);
  await R.arrange(tok, 0, [1, 5, 9, 2, 7, 8, 3, 6, 4], 900);
  z2 = R.zone(z2, PINK, 1, 8);
  no('左邊 0 個、右邊 n−1 個', 0, 2.4, 0);
  say('剛好選到最小（或最大）的', '有選跟沒選差不多');
  await step(tok);                                   // 60:08 random choice
  kill(z2); R.off();
  const dice = pill('random 選一個', 0, 3.4, 1.0);
  glow(R.m[6], GOLD);
  say('可以用 random 的方法選', '');
  await step(tok);                                   // 60:15 the median would be best
  kill(dice); R.off();
  const mid = R.v.indexOf(5); glow(R.m[mid], GREEN);
  note('中位數 5 當 pivot：左右剛好各一半', 0, 3.6, 0);
  say('有技巧的選法：選中位數', '中位數當 pivot 最好');
  await step(tok);                                   // 60:32 but finding the median = sorting
  no('找真正的中位數：有 O(n) 方法，但常數大', 0, 4.6, 0);
  say('老師說：找中位數就等於先排完序', '其實有 O(n) 的 selection，只是常數大，實務很少用');
  await step(tok);                                   // 60:41 pick three at random
  R.off();
  const s3 = [1, 4, 7]; R.hl(s3, GOLD);
  say('先 random 選三個出來', s3.map((i) => R.v[i]).join('、'));
  await step(tok);                                   // 60:48 their median
  const med = s3.slice().sort((a, b) => R.v[a] - R.v[b])[1];
  s3.forEach((i) => glow(R.m[i], i === med ? GREEN : null));
  ok('三個的中位數：' + R.v[med] + '（median of three）', 0, 2.6, 1.0);
  say('取三個的中位數當 pivot', '比較保險');
  await step(tok);                                   // 61:08 must it be three?
  say('一定要選三個嗎？', '不一定');
  await step(tok);                                   // 61:18 sampling
  bub('Sampling（取樣）', -4.4, 5.4, 0);
  say('資料量很大就多選一些', '這叫 sampling（取樣）');
  await step(tok);                                   // 61:31 one million numbers → 1000 samples
  z1 = note('100 萬個數字 → 抽 1000 個 → 排序 → 取中位數當 pivot', 0, 5.4, 1.2);
  say('例：100 萬個裡抽 1000 個，排一排取中位數', '用它去 sort 那 100 萬個');
  void z1;
}]);

// 62:09 例子（Horowitz）：26 5 37 1 61 11 59 15 48 19，pivot = 第一個，看 left/right
FRAG.push(['sortpeng-quick-textbook', '例子：每次遞迴的 left、right', async (tok) => {
  fresh([0, 7, 12.5], [0, 2.4, 0]);
  const calls = [
    [1, 10, [11, 5, 19, 1, 15, 26, 59, 61, 48, 37]],
    [1, 5, [1, 5, 11, 19, 15]],
    [1, 2, [1, 5]],
    [4, 5, [15, 19]],
    [7, 10, [48, 37, 59, 61]],
    [7, 8, [37, 48]],
  ];
  const pivAt = { '1,10': 6, '1,5': 3, '1,2': 1, '4,5': 5, '7,10': 9, '7,8': 8 };
  let R = null, tbl = null, z = null;
  const run = async (c, ms) => {
    const [l, r, res] = calls[c];
    showL(tbl.ls[c + 1], true); tbl.hl(c + 1);
    z = R.zone(z, BLUE, l - 1, r - 1);
    await R.arrange(tok, l - 1, res, ms);
    glow(R.m[pivAt[l + ',' + r] - 1], GREEN);
  };
  await step(tok);                                   // 62:09 the textbook example
  R = pRow([26, 5, 37, 1, 61, 11, 59, 15, 48, 19], { dx: 1.25, idx: true, base: 1, drop: true });
  say('課本的例子', '');
  await step(tok);                                   // 62:16 10 records; watch left and right
  tbl = code(['left right'].concat(calls.map(([l, r]) => String(l).padStart(4) + String(r).padStart(6))), 5.4, 6.4, 0.42, -1.5);
  tbl.ls.forEach((l, i) => showL(l, i === 0));
  say('10 筆 record：注意表上的 left 和 right', '');
  await step(tok);                                   // 62:31 the pivot is the first element
  glow(R.m[0], GOLD);
  say('pivot 選這一段的第一個 element', '');
  await step(tok);                                   // 62:36 first round: pivot 26
  const pt = tag('pivot 26', 'ptr alt', R.x(0), 1.6, 0);
  say('第一輪：pivot = 26', 'left = 1、right = 10');
  await step(tok);                                   // 62:45 26 splits it into two halves
  kill(pt); glow(R.m[0], null);
  await run(0, 1200);
  say('26 把資料分成兩半', '小的在 26 前面、大的在後面');
  await step(tok);                                   // 62:57 left = 1, right = 5
  showL(tbl.ls[2], true); tbl.hl(2); z = R.zone(z, BLUE, 0, 4);
  say('26 前面那段：left = 1、right = 5', '專門處理左半邊');
  await step(tok);                                   // 63:09 pivot 11 — exactly the median
  glow(R.m[0], GOLD);
  say('左半的 pivot 也是第一個：11', '剛好是中位數！');
  await step(tok);                                   // 63:24 smaller in front, bigger behind
  glow(R.m[0], null);
  await R.arrange(tok, 0, [1, 5, 11, 19, 15], 1000); glow(R.m[2], GREEN);
  say('比 11 小的放前面、大的放後面', '1 5 ｜11｜ 19 15');
  await step(tok);                                   // 63:31 next: left = 1, right = 2
  await run(2, 900);
  say('這一 run：left = 1、right = 2', '');
  await step(tok);                                   // 63:41 recursive calls change left and right
  await run(3, 700); await run(4, 900); await run(5, 700);
  say('像 debug mode：每次 recursive 呼叫', '都在改變 left、right，處理某一個 partition');
  await step(tok);                                   // 64:09 sorted
  kill(z); R.m.forEach((m) => glow(m, GREEN)); tbl.hl(-1);
  say('全部做完就排好了', R.v.join(' '));
}]);

// 64:20 n 小時 insertion 較好；T(n) = T(i) + T(n−i−1) + cn：最差 n²、最好/平均 n log n
FRAG.push(['sortpeng-quick-analysis', 'Quick Sort 分析：看 pivot 切在哪', async (tok) => {
  fresh([0, 6.5, 12], [0, 2.8, 0]);
  await step(tok);                                   // 64:20 few numbers: quick sort is pointless
  const ins = buddy('Insertion', '', '#9fc8ee', -2.0, 0, 2.2, 0.7), qk = buddy('Quick', '', '#f3c1a0', 2.0, 0, 2.2, 0.7);
  say('數字太少時做 quick sort 沒什麼意義', '');
  await step(tok);                                   // 64:29 insertion is better for small sizes
  ins.mood('happy'); await ins.hop(tok); qk.mood('sad');
  ok('小規模資料：Insertion 比較好', -2.0, 1.8, 2.2);
  say('統計過：規模小的排序，insertion sort 比 quick sort 好', '');
  await step(tok);                                   // 64:44 the analysis
  kill(ins.g); kill(qk.g);
  const f = tag('T(n) = T(i) + T(n−i−1) + cn', 'ptr alt', 0, 6.0, 0);
  say('Quick sort 的分析：遞迴式', '');
  await step(tok);                                   // 65:00 pick a pivot out of n numbers
  const pv = cube('pivot', GOLD, [0.9, 0.7, 0.8], 0, 0.5, 2.0, 1.5);
  say('n 個數字裡選出一個 pivot', '');
  await step(tok);                                   // 65:12 one side has i, the other n−i−1
  const zl = ghostBox(BLUE, 3.0, 0.7, 0.8); zl.position.set(-2.2, 0.5, 2.0); tag('i 個', 'ptr', -2.2, 1.2, 2.0);
  const zr = ghostBox(PINK, 4.0, 0.7, 0.8); zr.position.set(2.7, 0.5, 2.0); tag('n − i − 1 個', 'ptr', 2.7, 1.2, 2.0);
  say('一邊 i 個 → T(i)', '另一邊 n−i−1 個 → T(n−i−1)');
  await step(tok);                                   // 65:21 + cn: like the merge
  note('+ cn：分堆要掃一遍', 0, 1.8, 2.0);
  say('+ cn：把資料分堆的成本', '就像 merge sort 的 merge');
  await step(tok);                                   // 65:38 always the smallest or largest → n²
  kill(pv); kill(zl); kill(zr);
  tag('最差：每次選到最小／最大', 'ptr', -3.5, 5.2, 0);
  for (let d = 0; d < 8; d++) { const w = (8 - d) * 0.4; const g = ghostBox(RED, w, 0.4, 0.8); g.position.set(-3.5 - 1.6 + w / 2, 4.5 - d * 0.52, 0); await beat(tok, 150); }
  say('每次只少一個 → n 層', '<span class="no">worst case O(n²)</span>');
  await step(tok);                                   // 65:46 best case: halves
  tag('最好：每次剛好對半', 'ptr', 3.5, 5.2, 0);
  for (let d = 0; d < 4; d++) { const k = 1 << d, w = 3.2 / k; for (let i = 0; i < k; i++) { const g = ghostBox(GREEN, w - 0.1, 0.5, 0.8); g.position.set(3.5 - 1.6 + w * (i + 0.5), 4.5 - d * 1.1, 0); } await beat(tok, 300); }
  say('每次剛好均分兩半 → log n 層、每層 n', '<span class="ok">best case O(n log n)</span>');
  await step(tok);                                   // 65:58 average: n log n
  txt(f, '平均：O(n log n)');
  say('Average 也是 O(n log n)', '推導留到演算法課');
}]);

// 66:33 比較排序的下界：a、b、c 的 decision tree，3 4 5 走到 a<b<c
FRAG.push(['sortpeng-decision-tree', 'Decision Tree：比較排序最快 n log n', async (tok) => {
  fresh([0, 6, 12], [0, 3, 0]);
  const N = {
    r: [0, 5.4, 'a<b ?'], n1: [-3.5, 4.0, 'c>a ?'], n3: [3.5, 4.0, 'c>b ?'],
    n2: [-2.0, 2.6, 'c>b ?'], n4: [2.0, 2.6, 'c>a ?'],
    l1: [-5.4, 2.6, 'c<a<b'], l2: [-3.0, 1.2, 'a<c<b'], l3: [-1.0, 1.2, 'a<b<c'],
    l4: [1.0, 1.2, 'b<c<a'], l5: [3.0, 1.2, 'b<a<c'], l6: [5.4, 2.6, 'c<b<a'],
  };
  const T = {};
  const node = (k) => { T[k] = tag(N[k][2], k[0] === 'l' ? 'idx' : 'ptr', N[k][0], N[k][1], 0); };
  const edge = (a, b) => line(N[a][0], N[a][1], N[b][0], N[b][1], 0);
  let tmp = [];
  await step(tok);                                   // 66:33 what are these algorithms based on?
  const fam = ['Insertion', 'Selection', 'Merge', 'Quick'];
  tmp = fam.map((s, i) => bub(s, -4.5 + i * 3.0, 5.6, 0));
  say('Insertion、Selection、Merge、Quick', '都根據什麼為基礎？');
  await step(tok);                                   // 66:48 grab two numbers, ask which is bigger
  const x1 = cube('?', colorFor(1), [0.8, 0.8, 0.8], -1.0, 3.2, 0, 1.5), x2 = cube('?', colorFor(2), [0.8, 0.8, 0.8], 1.0, 3.2, 0, 1.5);
  const vs = pill('哪個大？', 0, 4.2, 0);
  say('每次抓兩個數字出來比大小', '這叫 comparison');
  await step(tok);                                   // 66:56 comparison-based: at best n log n
  const nl = note('靠比較的排序：最快約 O(n log n)', 0, 2.0, 1.0);
  say('靠比較設計出來的排序', '最快大概只能到 n log n');
  await step(tok);                                   // 67:20 the proof: a decision tree
  [x1, x2, vs, nl].forEach(kill); tmp.forEach(kill);
  say('為什麼？用 decision tree 來證明', '');
  await step(tok);                                   // 67:40 three elements a, b, c
  const A = buddy('a', '', '#9fc8ee', -1.4, 0, 3.0, 0.6), B = buddy('b', '', '#f3c1a0', 0, 0, 3.0, 0.6), Cc = buddy('c', '', '#cfe3a0', 1.4, 0, 3.0, 0.6);
  say('給你三個變數 a、b、c', '不告訴你它們的值');
  await step(tok);                                   // 68:14 how many orders? 6
  ['l1', 'l2', 'l3', 'l4', 'l5', 'l6'].forEach(node);
  say('大小順序有幾種？3! = 6 種', '答案一定是其中一種');
  await step(tok);                                   // 68:44 a=3, b=4, c=5 → a<b<c
  A.set(3); B.set(4); Cc.set(5);
  T.l3.element.className = 'lab-label ptr alt';
  say('a = 3、b = 4、c = 5', '屬於 a < b < c');
  await step(tok);                                   // 69:20 a=5, b=4, c=3 → c<b<a
  A.set(5); B.set(4); Cc.set(3);
  T.l3.element.className = 'lab-label idx'; T.l6.element.className = 'lab-label ptr alt';
  say('反過來 a = 5、b = 4、c = 3', '屬於 c < b < a');
  await step(tok);                                   // 69:51 starting from the root
  T.l6.element.className = 'lab-label idx';
  A.set(''); B.set(''); Cc.set('');
  node('r');
  say('從 root 出發，往下長', '');
  await step(tok);                                   // 70:07 why "decision": a < b ?
  T.r.element.className = 'lab-label ptr alt';
  say('每個 node 做一個 decision：a < b 嗎？', '');
  await step(tok);                                   // 70:26 the three answers with a < b
  node('n1'); edge('r', 'n1'); edge('n1', 'l1'); node('n2'); edge('n1', 'n2'); edge('n2', 'l2'); edge('n2', 'l3');
  ['l1', 'l2', 'l3'].forEach((k) => { T[k].element.className = 'lab-label good'; });
  say('a < b 的三種解都在左邊', 'c<a<b、a<c<b、a<b<c');
  await step(tok);                                   // 70:48 the right side: a > b
  node('n3'); edge('r', 'n3'); edge('n3', 'l6'); node('n4'); edge('n3', 'n4'); edge('n4', 'l4'); edge('n4', 'l5');
  ['l4', 'l5', 'l6'].forEach((k) => { T[k].element.className = 'lab-label bad'; });
  say('右半邊都是 a > b 的', '');
  await step(tok);                                   // 71:01 split again: c > a or c < a
  T.r.element.className = 'lab-label ptr'; T.n1.element.className = 'lab-label ptr alt';
  say('a < b 那三種，再依「c > a ？」細分', '一直切下去');
  await step(tok);                                   // 71:20 the answers are in the leaves
  T.n1.element.className = 'lab-label ptr';
  ['l1', 'l2', 'l3', 'l4', 'l5', 'l6'].forEach((k) => { T[k].element.className = 'lab-label ptr alt'; });
  say('最後的答案都存在 leaf node', '');
  await step(tok);                                   // 71:49 3, 4, 5 again
  ['l1', 'l2', 'l3', 'l4', 'l5', 'l6'].forEach((k) => { T[k].element.className = 'lab-label idx'; });
  A.set(3); B.set(4); Cc.set(5);
  const cur = cube(null, GOLD, [0.45, 0.45, 0.45], N.r[0], N.r[1] + 0.6, 0);
  say('想像你是電腦：a = 3、b = 4、c = 5', '從 root 出發');
  await step(tok);                                   // 72:09 a < b: 3 < 4 → left
  move(cur, N.n1[0], N.n1[1] + 0.6, 0);
  say('a < b？3 < 4 成立', '走到左邊');
  await step(tok);                                   // 72:19 c > a?
  move(cur, N.n2[0], N.n2[1] + 0.6, 0);
  say('c > a？5 > 3 成立', '再往下走');
  await step(tok);                                   // 72:29 c > b? → leaf a<b<c
  move(cur, N.l3[0], N.l3[1] + 0.6, 0); T.l3.element.className = 'lab-label good';
  say('c > b？5 > 4 成立', '到 leaf：a < b < c，找到答案');
  await step(tok);                                   // 72:51 every internal node compares two
  ['r', 'n1', 'n2', 'n3', 'n4'].forEach((k) => { T[k].element.className = 'lab-label ptr alt'; });
  say('每個 internal node 都做一次「兩兩比較」', '');
  await step(tok);                                   // 73:03 all solutions in one tree
  ['r', 'n1', 'n2', 'n3', 'n4'].forEach((k) => { T[k].element.className = 'lab-label ptr'; });
  say('所有可能的解答，都能用這一棵 tree 表示', '');
  await step(tok);                                   // 73:43 root to leaf = questions asked
  [['r', 'n1'], ['n1', 'n2'], ['n2', 'l3']].forEach(([a, b]) => line(N[a][0], N[a][1] + 0.05, N[b][0], N[b][1] + 0.05, 0.05, '#a8730f'));
  say('從 root 問一連串問題，到 leaf 就知道答案', '');
  await step(tok);                                   // 73:51 number of comparisons = tree height
  const ht = tag('高度 3 = 最多比 3 次', 'ptr alt', -5.8, 4.6, 0);
  say('比較次數 = 走到 leaf 的路徑長', '最差 = 樹的高度');
  await step(tok);                                   // 74:04 decision tree is a binary tree
  kill(cur); [A, B, Cc].forEach((b) => kill(b.g));
  const bt = note('binary tree：深度 d → 最多 2^d 個 leaf', 0, 0.2, 2.2);
  say('Decision tree 也是一棵 binary tree', '深度 d 最多 2^d 個 leaf；有 L 個 leaf，深度至少 log L');
  await step(tok);                                   // 74:33 how many leaves? n!
  txt(bt, 'n 個數字 → n! 種順序 → n! 個 leaf');
  say('leaf 有幾個？n 個數字有 n! 種排列', '三個數字：3! = 6');
  await step(tok);                                   // 74:52 the height is log n!
  txt(ht, '高度 ≥ log n!');
  say('所以樹高至少 log n!', '');
  await step(tok);                                   // 75:14 log n! ≈ n log n
  txt(ht, 'log n! = Θ(n log n)');
  say('log n! 等同於 n log n', '<span class="ok">比較排序最快 n log n</span>');
  await step(tok);                                   // 75:55 "quick sort is fastest" assumes comparisons
  bub('說 quick sort 最快，前提是「靠比大小」', 0, 6.2, 0);
  say('Quick sort 最快的前提', '它也是靠比大小建構的');
  await step(tok);                                   // 76:10 AI: a solution space (A*)
  note('AI：solution space、A*', 5.0, 5.6, 0);
  say('這棵樹在人工智慧裡叫 solution space', '還有 A* 也是在 tree 上找最佳解');
  await step(tok);                                   // 77:05 recap
  say('在 comparison-based 的情況下', '最快的排序就是 n log n');
}]);

// 77:28 Heap Sort 直覺版：min heap，delete n 次，結果放到另一個 array
FRAG.push(['sortpeng-heap-minextra', 'Min Heap 刪 n 次：需要額外的陣列', async (tok) => {
  fresh([0, 6.5, 12], [0, 2.8, 0]);
  const bx = (k) => -4.5 + k * 1.5;
  let H = null, size = 7, k = 0;
  // delete the root into B[k]; the last leaf goes to the root and sinks
  const delMin = async (ms) => {
    const m = H.m[1]; glow(m, GOLD); await beat(tok, ms * 0.6);
    glow(m, null); move(m, bx(k), 0.5, 0); H.m[1] = null; k++; await beat(tok, ms * 0.6);
    if (size > 1) {
      const lm = H.m[size], [x1, y1] = H.pos(1); move(lm, x1, y1, 0); H.m[1] = lm; H.v[1] = H.v[size]; H.m[size] = null; H.v[size] = null; size--;
      await beat(tok, ms * 0.5);
      await siftDown(tok, H, 1, size, (a, b) => a < b, ms);
    } else size = 0;
  };
  await step(tok);                                   // 77:28 review: what is a Heap
  H = heapView([26, 41, 31, 53, 58, 59, 97], { top: 5.6, W: 8, dy: 1.3, drop: true });
  say('複習一下：Heap', '（之前講 tree 時講過）');
  await step(tok);                                   // 77:35 min Heap and max Heap
  note('min Heap', -5.6, 5.6, 0); note('max Heap', 5.6, 5.6, 0);
  say('Heap 分兩種：min Heap 和 max Heap', '');
  await step(tok);                                   // 77:43 min Heap: the root is always the smallest
  glow(H.m[1], GREEN);
  ok('root 永遠最小', 0, 6.4, 0);
  say('min Heap：root 永遠是最小的', '');
  await step(tok);                                   // 77:52 can a min Heap sort small → large?
  glow(H.m[1], null);
  bub('用 min Heap 從小排到大？', 0, 0.6, 2.2);
  say('能不能用 min Heap 從小排到大？', '這叫 Heap sort');
  await step(tok);                                   // 78:26 step 1: build a min Heap
  say('直覺的做法：第一步，建一個 min Heap', '');
  await step(tok);                                   // 78:34 then delete n times
  for (let i = 0; i < 7; i++) { ctx.tile(V3(bx(i), 0.02, 0), 1.3, 1.0); tag('B' + i, 'idx', bx(i), 0.05, 0.75); }
  say('接著 delete n 次', '每次 delete 都拿到剩下最小的');
  await step(tok);                                   // 78:48 first delete: the smallest
  await delMin(500);
  say('第一個 delete 出來：最小的 26', '放到另一個 array B0');
  await step(tok);                                   // 78:54 second delete: the smallest of the rest
  await delMin(500);
  say('第二個 delete 出來：剩下最小的 31', '放 B1，一直下去就是排序');
  await step(tok);                                   // 79:18 drawback: extra space for the deleted values
  for (let i = 0; i < 7; i++) { const g = ghostBox(RED, 1.3, 0.2, 1.0); g.position.set(bx(i), 0.1, 0); }
  no('缺點：要額外一個 array 存放 ✗', 0, 1.5, 1.2);
  say('缺點：每次 delete 的值要 copy 到另一個 array', '多用了 n 格空間');
  await step(tok);                                   // 79:42 after delete: adjust the Heap, O(log n)
  await delMin(550);
  say('root 刪掉後 Heap 要調整：最後一個補到 root 往下沉', '每次調整 O(log n)');
  await step(tok);                                   // 80:10 n × log n
  while (size > 0) await delMin(150);
  say('delete n 次 × 每次 O(log n)', '<span class="ok">O(n log n)</span>');
}]);

// 80:29 build Heap 最笨：insert n 次；insert 14：放最底下、往上比 parent
FRAG.push(['sortpeng-heap-insert14', 'Insert 14：放到最後，往上跟 parent 比', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 3, 0]);
  const vals = [13, 21, 16, 24, 31, 19, 68, 65, 26, 32];
  const H = heapView([], { n: 11, top: 5.6, W: 11, dy: 1.35 });
  const rx = (i) => -4.95 + i * 1.1;
  let row = [];
  await step(tok);                                   // 80:29 given n numbers, build a Heap
  row = vals.map((v, i) => cube(v, colorFor(v), [0.7, 0.7, 0.7], rx(i), 0.4, 1.4, 2));
  say('給你 n 個數字，要建一個 min Heap', '你會怎麼做？');
  await step(tok);                                   // 81:04 grab one number at a time
  const [x1, y1] = H.pos(1); move(row[0], x1, y1, 0); H.m[1] = row[0]; H.v[1] = 13;
  say('最笨的方法：每次撈一個數字出來', '第一個只有一個點，不用調整');
  await step(tok);                                   // 81:11 insert them one by one
  for (let i = 1; i < 10; i++) { const [x, y] = H.pos(i + 1); move(row[i], x, y, 0); H.m[i + 1] = row[i]; H.v[i + 1] = vals[i]; await beat(tok, 200); }
  say('再一個一個 insert、調整 Heap', 'insert n 次 → 就是一個 Heap');
  await step(tok);                                   // 81:49 insert 14
  const m = cube(14, colorFor(14), [0.8, 0.8, 0.8], 5.6, 6.2, 0, 1.5);
  say('現在 insert 14 會怎麼做？', '');
  await step(tok);                                   // 82:02 put it at the bottom first
  const [x, y] = H.pos(11); move(m, x, y, 0); H.m[11] = m; H.v[11] = 14;
  const spot = tag('最底下的空位 a[11]', 'note', x, y - 0.8, 0.6);
  say('insert：先把數字放到最底下的空位', '然後 bottom-up 往上走');
  await step(tok);                                   // 82:09 compare with its parent
  kill(spot);
  glow(H.m[5], BLUE); glow(m, GOLD); await beat(tok, 500);
  glow(H.m[5], null); await H.swap(tok, 11, 5, 700);
  say('跟 parent 31 比：14 比較小', '14 取代 parent、31 往下走');
  await step(tok);                                   // 82:18 keep going up
  glow(H.m[2], BLUE); await beat(tok, 400); glow(H.m[2], null);
  await H.swap(tok, 5, 2, 700);
  glow(H.m[1], BLUE); await beat(tok, 500); glow(H.m[1], null); glow(m, GREEN);
  say('再跟 parent 21 比 → 換；跟 13 比：14 比較大 → 停', '14 停在 a[2]');
  await step(tok);                                   // 82:26 Heaps are stored in an array
  const A = [];
  for (let i = 1; i <= 11; i++) { A[i] = cube(H.v[i], colorFor(H.v[i]), [0.62, 0.62, 0.62], rx(i - 1), 0.4, 1.4); tag(String(i), 'idx', rx(i - 1), -0.1, 2.0); }
  glow(A[2], GREEN); glow(A[1], BLUE);
  ok('a[i] 的 parent = a[i/2]', 0, -0.6, 2.4);
  say('Heap 最常用 array 存', 'index 除以 2 就知道 parent');
  await step(tok);                                   // 82:42 build Heap the dumb way = insert one by one
  glow(A[2], null); glow(A[1], null);
  say('Build Heap 最笨的方法', '一個一個抓出來 insert');
  await step(tok);                                   // 83:04 delete is top-down
  note('delete：從 root 往下調（top-down）', -4.0, 6.4, 0);
  say('delete 的話是 top-down 調整', '');
  await step(tok);                                   // 83:18 insert / delete: O(log n)
  note('insert、delete：O(log n)', 4.0, 6.4, 0);
  say('不管 insert 或 delete', '都是 O(log n)');
  await step(tok);                                   // 83:27 Heap sort: O(n log n)
  ok('用 Heap 排序：O(n log n)', 0, 6.9, 0);
  say('用 Heap 做 sort', '<span class="ok">O(n log n)</span>');
}]);

// 83:38 用 max Heap：刪掉的 root 放到尾巴空出來的格子 → 原地排序
FRAG.push(['sortpeng-heap-maxinplace', 'Max Heap：刪掉的放尾巴，原地排好', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 2.8, 0]);
  const ax = (i) => -4.5 + (i - 1) * 1.5;
  let H = null; const A = [null];
  const sync = () => { for (let i = 1; i <= 7; i++) { relabel(A[i], H.v[i]); tint(A[i], colorFor(H.v[i])); } };
  let done = null, size = 7;
  const delMax = async (ms) => {
    glow(H.m[1], GOLD); glow(H.m[size], BLUE); await beat(tok, ms * 0.5);
    glow(H.m[1], null); glow(H.m[size], null);
    await H.swap(tok, 1, size, ms); sync();
    glow(H.m[size], GREEN); glow(A[size], GREEN);
    if (done) kill(done); done = ghostBox(GREEN, (8 - size) * 1.5, 1.0, 1.2); done.position.set((ax(size) + ax(7)) / 2, 0.45, 0);
    size--;
  };
  await step(tok);                                   // 83:38 min Heap needs an extra array
  const n0 = no('min Heap：要額外的 array', 0, 6.4, 0);
  say('剛剛用 min Heap 從小排到大', '需要額外的 array');
  await step(tok);                                   // 83:51 use a max Heap
  kill(n0);
  H = heapView([97, 53, 59, 26, 41, 58, 31], { top: 5.8, W: 8, dy: 1.3, drop: true });
  say('另一種策略：用 max Heap', 'root 永遠最大');
  await step(tok);                                   // 83:57 no extra array
  ok('不需要多餘的 array ✓', 0, 6.6, 0);
  say('用 max Heap 就不需要多餘的 array 空間', '');
  await step(tok);                                   // 84:02 the array that stores the Heap
  for (let i = 1; i <= 7; i++) { ctx.tile(V3(ax(i), 0.02, 0), 1.3, 1.0); tag(String(i), 'idx', ax(i), 0.05, 0.75); A[i] = cube(H.v[i], colorFor(H.v[i]), [0.7, 0.7, 0.7], ax(i), 0.45, 0); }
  say('原本存 Heap 的 array', '做完以後就是排好序的結果');
  await step(tok);                                   // 84:23 how it maps: 97 at 1, 53 at 2, 59 at 3
  for (const i of [1, 2, 3]) { glow(A[i], GOLD); glow(H.m[i], GOLD); await beat(tok, 400); }
  say('對應到 array：97 在 1、53 在 2、59 在 3', '依此類推');
  await step(tok);                                   // 84:40 delete 97
  for (const i of [1, 2, 3]) { glow(A[i], null); glow(H.m[i], null); }
  glow(H.m[1], GOLD);
  say('一開始 delete 97', '');
  await step(tok);                                   // 85:00 the root is empty; 97 goes to the tail
  await delMax(900);
  say('root 空出來；97 放到尾巴空出來的那一格', 'array 的第 7 格：97 已就定位');
  await step(tok);                                   // 85:08 adjust the Heap
  await siftDown(tok, H, 1, size, (a, b) => a > b, 650, sync);
  say('當然要做 Heap 的調整', '31 往下沉，下一個最大的 59 浮上來');
  await step(tok);                                   // 85:21 delete again in the blue part
  await delMax(700);
  await siftDown(tok, H, 1, size, (a, b) => a > b, 450, sync);
  say('對剩下（藍色）的部分再 delete', '59 放到第 6 格');
  await step(tok);                                   // 85:45 after all the deletes
  while (size > 1) { await delMax(220); await siftDown(tok, H, 1, size, (a, b) => a > b, 200, sync); }
  glow(H.m[1], GREEN); glow(A[1], GREEN);
  say('全部 delete 完', '');
  await step(tok);                                   // 85:53 26 31 41 …, no extra space
  say('array：26 31 41 53 58 59 97', '<span class="ok">不用額外空間</span>就排好了');
  await step(tok);                                   // 86:09 intuitive min Heap vs clever max Heap
  note('min Heap：多一個 array', -4.4, 6.5, 0); note('max Heap：同一個 array 排好', 4.4, 6.5, 0);
  say('直覺用 min Heap 要花額外空間', 'max Heap 很技巧地在同一個 array 上排好');
}]);

// 86:40 bottom-up build Heap：31 41 59 26 53 58 97 先照放，再由下往上調
FRAG.push(['sortpeng-heap-bottomup', 'Bottom-up Build Heap：從下面的小 Heap 長上來', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 2.8, 0]);
  const vals = [31, 41, 59, 26, 53, 58, 97];
  const ax = (i) => -4.5 + (i - 1) * 1.5;
  let H = null; const A = [null];
  const sync = () => { for (let i = 1; i <= 7; i++) { relabel(A[i], H.v[i]); tint(A[i], colorFor(H.v[i])); } };
  await step(tok);                                   // 86:40 a better way: top-down or bottom-up
  const t1 = note('top-down', -3.4, 6.4, 0), t2 = note('bottom-up', 3.4, 6.4, 0);
  say('Build Heap 還有更好的方法', 'top-down 或 bottom-up');
  await step(tok);                                   // 86:48 top-down: grab them one by one from the front
  bub('從前面一個一個加進來', -3.4, 5.6, 0);
  say('top-down：像一個一個夾，從前面開始撿', '');
  await step(tok);                                   // 86:58 bottom-up: every small one at the bottom is a Heap
  t2.element.className = 'lab-label ptr alt'; kill(t1);
  say('bottom-up：從下面開始', '下面每個都是一個小 Heap');
  await step(tok);                                   // 87:15 throw the numbers into the array
  for (let i = 1; i <= 7; i++) { ctx.tile(V3(ax(i), 0.02, 0), 1.3, 1.0); tag(String(i), 'idx', ax(i), 0.05, 0.75); A[i] = cube(vals[i - 1], colorFor(vals[i - 1]), [0.7, 0.7, 0.7], ax(i), 0.45, 0, 2); }
  say('先把數字丟進 array', '順序不管');
  await step(tok);                                   // 87:24 slots 1 to 7 = the tree
  H = heapView(vals, { top: 5.4, W: 8, dy: 1.3 });
  say('七個數字放在 A1 到 A7', '對應成一棵樹');
  await step(tok);                                   // 87:34 start adjusting from the bottom
  for (const i of [4, 5, 6, 7]) glow(H.m[i], GREEN);
  say('從下面開始調整', '葉子 26 53 58 97 各自就是小 Heap');
  await step(tok);                                   // 87:52 58 and 97 with their parent 59
  for (const i of [4, 5, 6, 7]) glow(H.m[i], null);
  const [x3, y3] = H.pos(3); const z3 = ghostBox(BLUE, 4.2, 2.0, 1.0); z3.position.set(x3, y3 - 0.6, 0);
  glow(H.m[3], GOLD); glow(H.m[6], BLUE); glow(H.m[7], BLUE);
  say('58、97 的 parent 是 59', '三個裡 97 最大');
  await step(tok);                                   // 88:18 max Heap: push 97 up, 59 down
  [3, 6, 7].forEach((i) => glow(H.m[i], null));
  await H.swap(tok, 3, 7, 900); sync();
  say('max Heap：97 往上推、59 往下降', '');
  await step(tok);                                   // 88:29 this subtree is a Heap now
  kill(z3); ok('這棵 subtree 符合 Heap ✓', x3, y3 + 1.0, 0);
  say('這棵 subtree 就符合 Heap 的特質', '');
  await step(tok);                                   // 88:42 26 53 41: 53 goes up
  const [x2, y2] = H.pos(2); const z2 = ghostBox(BLUE, 4.2, 2.0, 1.0); z2.position.set(x2, y2 - 0.6, 0);
  await beat(tok, 300); await H.swap(tok, 2, 5, 900); sync(); kill(z2);
  say('依此類推：41、26、53', '53 往上走');
  await step(tok);                                   // 88:54 both subtree roots are the biggest of three
  glow(H.m[2], GREEN); glow(H.m[3], GREEN);
  say('兩棵 subtree 的 root，都是三個裡最大的', '接著把 97 和 53 拿出來跟 root 比');
  await step(tok);                                   // 89:04 the biggest goes up
  glow(H.m[2], null); glow(H.m[3], null);
  await siftDown(tok, H, 1, 7, (a, b) => a > b, 700, sync);
  say('最大的往上推：97 上去、31 往下沉', '97 53 59 26 41 58 31');
  await step(tok);                                   // 89:18 one of many ways: bottom-up
  for (let i = 1; i <= 7; i++) glow(A[i], GREEN);
  say('Build Heap 有很多種方法', '這是 bottom-up：先 map 到 array，再從下往上調');
}]);

// 89:50 Bucket Sort：依資料特性丟進籃子，不比大小；MSD vs LSD
FRAG.push(['sortpeng-bucket-idea', 'Bucket Sort：照字母丟進籃子', async (tok) => {
  fresh([0, 6.5, 12], [0, 2, 0]);
  const L = ['A', 'B', 'C', 'D', 'E', 'F'], bx = (k) => -5.5 + k * 1.9;
  const ids = ['F2', 'A1', 'C3', 'A4', 'E5', 'B6', 'C7'];
  let ms = [];
  await step(tok);                                   // 89:50 a bucket is a basket
  L.forEach((s, k) => { ctx.tile(V3(bx(k), 0.02, 0), 1.6, 1.0); tag(s, 'ptr', bx(k), 0.05, 0.8); });
  say('Bucket sort：bucket 就是籃子', '');
  await step(tok);                                   // 90:00 ID numbers start with a letter
  ms = ids.map((s, i) => { const m = cube(i + 1, colorFor(i), [1.1, 0.5, 0.8], -5.4 + i * 1.6, 4.6, 0, 1.5); relabel(m, s + '…'); return m; });
  say('例如身分證：第一個字是英文字母', '');
  await step(tok);                                   // 90:08 prepare 26 baskets
  tag('… Z（共 26 個籃子）', 'idx', 5.4, 1.6, 0.8);
  say('準備 26 個籃子', 'A 到 Z');
  await step(tok);                                   // 90:17 each goes to its basket
  const h = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < ids.length; i++) { const k = L.indexOf(ids[i][0]); glow(ms[i], GOLD); move(ms[i], bx(k), 0.35 + h[k] * 0.56, 0); h[k]++; await beat(tok, 300); glow(ms[i], null); }
  say('看第一個字母，直接丟進對應的籃子', '');
  await step(tok);                                   // 90:28 no comparing with each other
  ok('完全沒有互相比大小 ✓', 0, 3.2, 0);
  say('Bucket sort 沒有互相比大小', '');
  await step(tok);                                   // 90:36 it uses a property of the data
  bub('靠的是資料本身的特性（第一個字母）', 0, 4.2, 0);
  say('它依資料的特性，把資料送到該去的地方', '');
  await step(tok);                                   // 91:01 numbers: digits
  const d = ['1', '0', '0'].map((s, i) => { const m = cube(s, colorFor(i + 5), [0.7, 0.7, 0.7], 3.4 + i * 0.8, 5.6, 0, 1.2); return m; });
  tag('百 十 個', 'idx', 4.2, 6.2, 0);
  say('數字也行：看它的每一位', '100 有三位：百位 1、十位 0、個位 0');
  await step(tok);                                   // 91:23 several rounds of bucketing
  say('依位數多做幾次 bucket', '一位做一次');
  await step(tok);                                   // 91:29 a bit like hash
  note('有點像 hash：算一下就知道放哪', -3.6, 5.6, 0);
  say('有時候很像 hash', '');
  await step(tok);                                   // 91:36 MSD: radix exchange sort
  ms.forEach(kill); d.forEach(kill);
  note('MSD：Radix exchange sort（從最重要的位數）', -1.0, 4.2, 0.6);
  say('常用兩種：第一種 MSD', 'Radix exchange sort');
  await step(tok);                                   // 91:42 LSD: straight radix sort
  note('LSD：Straight radix sort（從最不重要的位數）', 1.0, 3.2, 1.0);
  say('第二種 LSD', 'Straight radix sort');
}]);

// 92:00 Radix Exchange Sort（MSD）：先看百位數，bucket 裡超過一個再看十位、個位
FRAG.push(['sortpeng-msd', 'Radix Exchange Sort：從百位數開始（MSD）', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 2.6, 0]);
  let items = null, st = null, zs = null;
  await step(tok);                                   // 92:00 most significant digit: radix exchange sort
  bub('Radix exchange sort（MSD）', 0, 6.4, 0);
  say('第一種：依最重要（最左邊）的位數排序', '');
  await step(tok);                                   // 92:05 the example numbers
  items = radixItems(RADIX, false);
  say('直接看例子：64 8 216 512 27 729 0 1 343 125', '');
  await step(tok);                                   // 92:15 written as three digits
  items.forEach((it) => relabel(it.m, p3(it.v)));
  say('都表示成三位數', '1 → 001、8 → 008、64 → 064');
  await step(tok);                                   // 92:37 the most significant digit: hundreds
  say('三位數裡最重要的位：百位數', '最左邊那一位');
  await step(tok);                                   // 93:04 each digit 0..9: a bucket
  radixBuckets();
  say('每一位只會是 0 到 9', '每個數字值對應一個 bucket（籃子）');
  await step(tok);                                   // 93:21 064 → bucket 0
  st = await distribute(tok, items.slice(0, 1), (v) => Math.floor(v / 100), 600);
  say('064：百位是 0', '丟進 bucket 0');
  await step(tok);                                   // 93:39 008 → bucket 0
  st = await distribute(tok, items.slice(1, 2), (v) => Math.floor(v / 100), 600, st);
  say('008：百位是 0', '也丟進 bucket 0');
  await step(tok);                                   // 93:51 216 → bucket 2
  st = await distribute(tok, items.slice(2, 3), (v) => Math.floor(v / 100), 600, st);
  say('216：百位是 2', '丟進 bucket 2');
  await step(tok);                                   // 94:03 and so on: 027 → bucket 0 …
  st = await distribute(tok, items.slice(3), (v) => Math.floor(v / 100), 280, st);
  say('依此類推：027 放 bucket 0……', '');
  await step(tok);                                   // 94:04 the bottom one came in first
  glow(st[0][0].m, GOLD);
  say('每個 bucket 最下面的，就是最早放進來的', '');
  await step(tok);                                   // 94:34 read left to right
  glow(st[0][0].m, null);
  items = await collect(tok, st, 0, 220);
  say('從左邊的 bucket 讀到右邊', '');
  await step(tok);                                   // 94:47 bucket 0 is crowded
  zs = ghostBox(RED, 6.4, 0.9, 1.0); zs.position.set((TX(0) + TX(4)) / 2, TOPY, 0);
  say('bucket 0 特別多人', '064 008 027 000 001');
  await step(tok);                                   // 94:58 everything to the right is bigger
  for (let i = 5; i < 10; i++) glow(items[i].m, GREEN);
  say('右邊的數字都比 bucket 0 的大', '125 216 343 512 729 已經排好');
  await step(tok);                                   // 95:25 still needs more work
  say('這個方法只是「大概」排好', '因為只看了百位數');
  await step(tok);                                   // 95:44 sort bucket 0 again by the tens digit
  st = await distribute(tok, items.slice(0, 5), (v) => Math.floor(v / 10) % 10, 380);
  say('bucket 0 裡面還要再排', '依十位數再丟一次');
  await step(tok);                                   // 95:58 read left to right again
  const five = await collect(tok, st, 0, 260);
  kill(zs); zs = ghostBox(RED, 3.8, 0.9, 1.0); zs.position.set((TX(0) + TX(2)) / 2, TOPY, 0);
  say('一樣從左讀到右', '008 000 001 都在十位的 bucket 0');
  await step(tok);                                   // 96:08 still more than one: the ones digit
  st = await distribute(tok, five.slice(0, 3), (v) => v % 10, 380);
  await collect(tok, st, 0, 260); kill(zs);
  say('bucket 裡還有好幾個', '再依個位數排');
  await step(tok);                                   // 96:22 recursive
  items.forEach((it) => glow(it.m, GREEN));
  say('Radix exchange sort 要 recursive 下去', '000 001 008 027 064 125 216 343 512 729');
}]);

// 96:54 Straight Radix Sort（LSD）：個位 → 十位 → 百位，每輪從 bucket 0 讀到 9
FRAG.push(['sortpeng-lsd', 'Straight Radix Sort：從個位數開始（LSD）', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 2.6, 0]);
  let items = null, st = null;
  const dig = [(v) => v % 10, (v) => Math.floor(v / 10) % 10, (v) => Math.floor(v / 100)];
  const seq = tag('', 'ptr alt', 0, 6.2, 0); showL(seq, false);
  await step(tok);                                   // 96:54 straight radix sort
  items = radixSetup(RADIX);
  bub('Straight radix sort（LSD）', -3.8, 6.2, 0);
  say('另一種：Straight radix sort', '');
  await step(tok);                                   // 97:14 least significant digit, right to left
  say('依最小（最右邊）的位數開始', '從右到左做 bucket sort');
  await step(tok);                                   // 97:30 064 → bucket 4
  st = await distribute(tok, items.slice(0, 1), dig[0], 600);
  say('先看個位數：064 → bucket 4', '');
  await step(tok);                                   // 97:40 008 → bucket 8
  st = await distribute(tok, items.slice(1, 2), dig[0], 600, st);
  say('008：個位是 8 → bucket 8', '');
  await step(tok);                                   // 97:50 and the rest
  st = await distribute(tok, items.slice(2), dig[0], 260, st);
  say('其他的依此類推', '');
  await step(tok);                                   // 97:59 read from bucket 0
  items = await collect(tok, st, 0, 220);
  say('從 bucket 0 讀到 bucket 9', 'output 一個新的 sequence');
  await step(tok);                                   // 98:30 the new sequence
  showL(seq, true); txt(seq, items.map((it) => p3(it.v)).join(' '));
  say('得到新的 sequence', '還沒排好');
  await step(tok);                                   // 98:39 bucket again by the tens digit
  st = await distribute(tok, items, dig[1], 220);
  say('照這個順序，再依十位數做一次 bucket sort', '');
  await step(tok);                                   // 99:30 read them out again
  items = await collect(tok, st, 0, 200);
  txt(seq, items.map((it) => p3(it.v)).join(' '));
  say('再讀出來：000 001 008 512 216 125 027 729…', '');
  await step(tok);                                   // 99:52 each bucket bottom to top
  note('每個 bucket：從底下讀到上面（先放的先讀）', 3.6, 5.6, 1.2);
  say('每個 bucket 依序從底下讀到上面', '');
  await step(tok);                                   // 100:07 once more by the hundreds digit
  st = await distribute(tok, items, dig[2], 220);
  say('還沒排好 → 再依百位數做一次', '');
  await step(tok);                                   // 100:31 read buckets 0 → 9: done
  items = await collect(tok, st, 0, 200);
  txt(seq, items.map((it) => p3(it.v)).join(' '));
  items.forEach((it) => glow(it.m, GREEN));
  say('Bucket 0 到 9 依序讀出來', '全部排好了');
  await step(tok);                                   // 100:51 the idea of straight radix sort
  say('從最右邊的位數開始，一輪一輪丟、讀', '做到最左邊的百位數就排好');
}]);

// 101:36 Radix 沒有比較；bucket 用 Queue（FIFO）；n 個數字 × 3 位 → 3 輪
FRAG.push(['sortpeng-radix-cost', 'Radix：bucket 是 Queue，不比大小', async (tok) => {
  fresh([0, 6.5, 12], [0, 2.4, 0]);
  await step(tok);                                   // 101:36 does it compare sizes?
  const me = buddy('Radix', '', '#cfe3a0', -5.2, 0, 1.6, 0.7); me.mood('wow');
  bub('有沒有比大小？', -5.2, 1.8, 1.6);
  say('Straight radix sort 裡有沒有比大小？', '');
  await step(tok);                                   // 101:46 no: just digit → bucket
  me.mood('happy');
  ok('沒有比大小：看位數 → 丟 bucket', -3.0, 3.6, 0);
  say('沒有！完全依照數字的位數', '丟到該去的 bucket');
  await step(tok);                                   // 102:01 even inside one bucket
  say('就算同一個 bucket 有很多數字', '也沒有互相比大小，下一輪再看別的位數');
  await step(tok);                                   // 102:18 faster than quick sort?
  const qk = buddy('Quick', '', '#f3c1a0', 5.2, 0, 1.6, 0.7); qk.look(-1); me.look(1);
  say('那它會不會比 quick sort 還快？', '想一想');
  await step(tok);                                   // 102:38 n numbers, 3 digits each
  const ln = tag('n 個數字 × 3 位數 → 3 輪', 'ptr alt', 0, 5.8, 0);
  say('n 個數字、每個 3 位數', '就要做 3 輪');
  await step(tok);                                   // 102:56 three times, like hashing
  note('每輪：每個數字算一下位數就丟進去（像 hash）', 0, 5.0, 0.4);
  say('每一輪就像做一次 hash', '共 3 次');
  await step(tok);                                   // 103:29 each number checked once per round
  txt(ln, '每輪 n 個各丟一次 + 讀 10 個 bucket');
  say('每個數字每輪只檢查一次、丟一次', 'd 位數、r 個 bucket：O(d(n + r))');
  await step(tok);                                   // 103:51 is a bucket a Queue or a Stack?
  kill(me.g); kill(qk.g);
  const q = ghostBox(BLUE, 6.0, 1.0, 1.2); q.position.set(0, 2.6, 0);
  tag('bucket 2（十位數 = 2）', 'ptr', 0, 3.6, 0);
  tag('後 ←', 'idx', 3.6, 2.6, 0); tag('← 前', 'idx', -3.6, 2.6, 0);
  const vs = [125, 27, 729];
  const ms = vs.map((v, i) => cube(p3(v), colorFor(v), [1.15, 0.5, 0.8], 3.0 + i * 1.3, 1.0, 1.6));
  for (let i = 0; i < 3; i++) { move(ms[i], -1.6 + i * 1.6, 2.6, 0); await beat(tok, 300); }
  say('每個 bucket 用 Queue 還是 Stack？', '125、027、729 依序進 bucket 2');
  await step(tok);                                   // 104:02 Queue: first in, first out
  for (let i = 0; i < 3; i++) { move(ms[i], -2.6 + i * 1.6, 0.4, 0); await beat(tok, 350); }
  ok('Queue（FIFO）：125 027 729，上一輪的順序保住 ✓', 0, 1.2, 1.6);
  say('Queue：first in, first out', '先進去的先讀出來');
  await step(tok);                                   // 104:08 so every bucket is a Queue
  no('Stack 會變 729 027 125 ✗', 0, 4.6, 0);
  say('所以每個 bucket 用 Queue 實作', '用 Stack 會把順序弄反');
  await step(tok);                                   // 104:52 a lot like hash
  note('下禮拜：hash', 4.6, 5.6, 0);
  say('Bucket 在某種程度上跟 hash 很像', '下禮拜就講 hash');
}]);

// 105:17 MSD 回顧：只有擠在一起的 bucket 要再排；小 bucket 可以改用 insertion sort
FRAG.push(['sortpeng-msd-review', 'MSD 回顧：小 bucket 可改用別的 sort', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 2.6, 0]);
  let items = null, st = null;
  await step(tok);                                   // 105:17 radix exchange sort again
  items = radixSetup(RADIX);
  bub('再看一次 Radix exchange sort', 0, 6.4, 0);
  say('再看一次 Radix exchange sort', '');
  await step(tok);                                   // 105:23 by the most significant digit
  st = await distribute(tok, items, (v) => Math.floor(v / 100), 230);
  say('依最左邊、最重要的位數排序', '先看百位數');
  await step(tok);                                   // 105:49 a bucket with more than one
  items = await collect(tok, st, 0, 180);
  const zs = ghostBox(RED, 6.4, 0.9, 1.0); zs.position.set((TX(0) + TX(4)) / 2, TOPY, 0);
  say('讀出來後，看哪個 bucket 超過一個數字', 'bucket 0 有五個');
  await step(tok);                                   // 105:59 take it out, sort by the tens digit
  st = await distribute(tok, items.slice(0, 5), (v) => Math.floor(v / 10) % 10, 300);
  const five = await collect(tok, st, 0, 200); kill(zs);
  say('把那個 bucket 抓出來，依十位數再排', '');
  await step(tok);                                   // 106:18 there is still a group
  const z3 = ghostBox(RED, 3.8, 0.9, 1.0); z3.position.set((TX(0) + TX(2)) / 2, TOPY, 0);
  say('你看這裡還有一小群', '008 000 001');
  await step(tok);                                   // 106:24 the others are done
  for (let i = 5; i < 10; i++) glow(items[i].m, GREEN); glow(five[3].m, GREEN); glow(five[4].m, GREEN);
  say('後面的就不用了', '125 216 343 512 729 已經排好');
  await step(tok);                                   // 106:30 use a sort from before, e.g. insertion
  const ins = buddy('Insertion', '', '#9fc8ee', -4.6, 0, 2.4, 0.6); ins.mood('happy');
  const vals3 = five.slice(0, 3);
  const order = vals3.slice().sort((a, b) => a.v - b.v);
  order.forEach((it, i) => move(it.m, TX(i), TOPY, 0)); await beat(tok, 900);
  order.forEach((it) => glow(it.m, GREEN)); kill(z3);
  say('這一小撮也可以用之前教的 sort', '數字很少 → insertion sort 效果很好');
  await step(tok);                                   // 106:47 or keep going by digits
  note('或繼續依十位、個位做 bucket：都可以', 2.6, 6.4, 0);
  say('也可以繼續依位數做下去', '都可以');
}]);

// 106:55 LSD 回顧：一輪一輪，先丟進去的先讀出來（Queue）
FRAG.push(['sortpeng-lsd-review', 'LSD 回顧：一輪一輪，bucket 是 Queue', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 2.6, 0]);
  let items = null, st = null;
  const dig = [(v) => v % 10, (v) => Math.floor(v / 10) % 10, (v) => Math.floor(v / 100)];
  await step(tok);                                   // 107:05 start from the rightmost digit
  items = radixSetup(RADIX);
  bub('Straight radix sort：從最右邊的位數開始', 0, 6.4, 0);
  say('Straight radix sort：一輪一輪', '從最右邊的位數開始，不是比較');
  await step(tok);                                   // 107:19 drop into the matching bucket
  st = await distribute(tok, items, dig[0], 220);
  say('看最右邊那一位是多少', '丟到對應的 bucket');
  await step(tok);                                   // 107:27 read them out: a new list
  items = await collect(tok, st, 0, 200);
  say('從 bucket 讀出來', '產生新的 list');
  await step(tok);                                   // 107:36 by the tens digit
  st = await distribute(tok, items, dig[1], 220);
  say('照這個 list 的順序', '再依中間的十位數丟');
  await step(tok);                                   // 107:52 bottom to top: first in, first out
  items = await collect(tok, st, 0, 200);
  say('從左到右、每個 bucket 從下到上讀', '先丟進去的先讀出來');
  await step(tok);                                   // 108:09 a Queue
  note('bucket = Queue', 4.4, 5.8, 1.0);
  say('所以 straight radix sort 很常用到 Queue', '');
  await step(tok);                                   // 108:17 again by the hundreds digit
  st = await distribute(tok, items, dig[2], 220);
  say('再依百位數丟進去', '');
  await step(tok);                                   // 108:22 read out: sorted
  items = await collect(tok, st, 0, 200);
  items.forEach((it) => glow(it.m, GREEN));
  say('依序讀出來', '最後就是排序結果');
  await step(tok);                                   // 108:33 complexity: scan each number, hash it
  note('Complexity：每輪把每個數字 scan 一次、丟進 bucket', -2.4, 6.4, 0);
  say('分析：頂多就是對每個數字 scan、丟進 bucket', '');
}]);

// 109:13 Radix、Merge 好平行化：MapReduce = divide and conquer；每群 bucket 一台機器
FRAG.push(['sortpeng-parallel', 'MapReduce：多台機器一起排', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 2.4, 0]);
  const mx = (i) => -4.4 + i * 4.4;
  let boxes = [], parts = [];
  await step(tok);                                   // 109:13 parallel: many machines
  for (let i = 0; i < 3; i++) { boxes.push(prop('cpu', mx(i), 0, 1.6, 1.0, '機器 ' + (i + 1))); }
  say('平行化：用很多台 machine 一起做 sort', '');
  await step(tok);                                   // 109:25 hint: MapReduce
  bub('Hint：MapReduce', 0, 6.4, 0);
  say('大規模平行計算裡有個 MapReduce', '');
  await step(tok);                                   // 109:36 MapReduce = divide and conquer
  note('MapReduce 講穿了 = Divide and Conquer', 0, 5.6, 0);
  say('講穿了就是 divide and conquer', '');
  await step(tok);                                   // 109:47 Map does the divide
  const big = cube('一大堆數字', GRAY, [8.0, 0.7, 1.0], 0, 4.4, 0, 1.5);
  await beat(tok, 500); kill(big);
  parts = [0, 1, 2].map((i) => cube('一份', colorFor(i), [2.6, 0.6, 0.8], mx(i), 4.4, 0));
  for (let i = 0; i < 3; i++) { move(parts[i], mx(i), 2.0, 0); await beat(tok, 250); }
  say('Map：做 divide', '切成很多小問題，分給不同機器');
  await step(tok);                                   // 109:55 Reduce does the conquer
  parts.forEach((m) => glow(m, GREEN)); await beat(tok, 500);
  parts.forEach((m, i) => move(m, -2.7 + i * 2.7, 0.4, 3.2)); await beat(tok, 800);
  say('Reduce：做 conquer', '各自做完再合起來');
  await step(tok);                                   // 110:03 just like merge sort
  note('Merge sort：切 → 各自排 → merge', -3.6, 6.4, 1.0);
  say('跟剛剛的 merge sort 一樣', 'divide → merge');
  await step(tok);                                   // 110:13 merge sort and radix sort both map easily
  note('Radix sort：一樣好平行化', 3.6, 6.4, 1.0);
  say('Merge sort、radix sort', '都很容易 implement 成 MapReduce');
  await step(tok);                                   // 110:27 a bucket (or a group of buckets) per machine
  parts.forEach(kill);
  const groups = [[0, 1, 2, 3], [4, 5, 6], [7, 8, 9]];
  // one name per machine ('bucket 0–3'); the cubes keep just their number, so neighbours never cover each other
  groups.forEach((g, i) => { g.forEach((b, k) => cube(String(b), colorFor(b), [0.8, 0.5, 0.8], mx(i) - (g.length - 1) * 0.45 + k * 0.9, 1.0, 0, 1.5)); tag('bucket ' + g[0] + '–' + g[g.length - 1], 'ptr', mx(i), 1.85, 0); });
  say('每個 bucket（或一群 bucket）', '交給一台 machine 執行');
  await step(tok);                                   // 110:41 many machines sort together
  boxes.forEach((b) => bob(b, 0.06, 6));
  ok('bucket 本來就有順序：各台做完，接起來就好 ✓', 0, 3.4, 0);
  say('很多台 machine 一起幫你排一堆數字', '');
}]);

// 110:57 Internal sort 總結：比較 vs 不比較；沒有永遠的贏家
FRAG.push(['sortpeng-summary', 'Internal Sort 總結', async (tok) => {
  fresh([0, 6.5, 12], [0, 2.6, 0]);
  let ms = [];
  const cmp = ['Insertion', 'Selection', 'Bubble', 'Merge', 'Quick', 'Heap'];
  await step(tok);                                   // 110:57 internal sort
  const mem = ghostBox(GREEN, 12.0, 4.2, 1.6); mem.position.set(0, 2.4, 0);
  tag('Memory', 'ptr', -5.4, 4.8, 0);
  say('上面講的都叫 Internal sort', '');
  await step(tok);                                   // 111:04 everything is loaded into memory
  say('基本概念：所有數字都 load 到 memory 裡', '');
  await step(tok);                                   // 111:10 insertion, selection, bubble, quick, merge …
  ms = cmp.map((s, i) => { const m = cube(i + 1, colorFor(i), [2.2, 0.6, 0.8], -5.0 + (i % 3) * 2.4, 3.4 - Math.floor(i / 3) * 1.2, 0, 2.5); relabel(m, s); return m; });
  say('Insertion、Selection、Bubble、Quick、Merge…', '數字都在 memory 裡');
  await step(tok);                                   // 111:19 comparison-based
  const zl = ghostBox(BLUE, 7.6, 3.0, 1.2); zl.position.set(-2.6, 2.8, 0);
  tag('Comparison-based：最快 O(n log n)', 'ptr alt', -2.6, 1.0, 0.6);
  say('前面這些：靠比較（comparison-based）', '');
  await step(tok);                                   // 111:25 the later ones don't compare
  const r = cube(9, colorFor(9), [2.2, 0.6, 0.8], 4.6, 3.0, 0, 2.5); relabel(r, 'Radix');
  tag('不比大小', 'ptr', 4.6, 4.0, 0);
  say('後面的 radix：不用做任何 comparison', '');
  await step(tok);                                   // 111:33 so it can be faster
  glow(r, GREEN);
  say('速度可以比較快', '');
  await step(tok);                                   // 111:43 quick is not always the quickest
  glow(ms[4], GOLD);
  note('Quick 不一定最 quick：看 pivot', -2.6, 5.6, 0);
  say('每種都有優缺點', 'quick sort 不一定最 quick，要看 pivot 怎麼選');
  await step(tok);                                   // 111:50 insertion for small inputs
  glow(ms[0], GOLD);
  note('小規模資料：Insertion 較好', 2.6, 5.6, 0);
  say('小規模資料：insertion sort 比較好', '');
  await step(tok);                                   // 112:08 the adjective is the concept
  ms.forEach((m, i) => glow(m, i === 4 ? null : GREEN));
  say('除了 quick sort，sort 前面的形容詞就是它的 concept', 'insert、select、bubble、merge');
  void zl;
}]);

// 112:35 External sort：4500 筆、memory 750 筆 = 3 個 250 的 block；6 個 run 各排好，再一個 block 一個 block merge
FRAG.push(['sortpeng-external-runs', 'External Sort：6 個 run，用 block 合併', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 2.4, 0]);
  const rx = (r) => -6.0 + r * 1.12, by = (b) => 0.35 + b * 0.62, sx = (s) => 2.5 + s * 1.4;
  const B = [];
  let big = null, memL = null, diskL = null;
  await step(tok);                                   // 112:35 more numbers than one computer's memory
  const dk = ghostBox(GRAY, 7.0, 2.6, 1.4); dk.position.set(-3.2, 1.3, 0);
  diskL = tag('Disk', 'ptr', -3.2, 3.0, 0);
  const mm = ghostBox(BLUE, 4.4, 1.2, 1.4); mm.position.set(3.9, 1.0, 0);
  memL = tag('Memory', 'ptr alt', 3.9, 2.0, 0);
  big = cube('一大堆資料', GRAY, [6.4, 1.6, 1.0], -3.2, 1.0, 0, 1.5);
  say('External sort：數字超過一台電腦的 memory', '');
  await step(tok);                                   // 112:42 only one computer, no cluster
  const pc = prop('cpu', 3.9, 0, 2.6, 0.8, '只有一台電腦（沒有 cluster）');
  say('假設只有一台電腦', '沒有 cluster（一群電腦）');
  await step(tok);                                   // 112:59 use the idea of merge sort
  note('用 merge sort 的概念', 0, 5.4, 0);
  say('解法：用 merge sort 的概念推展出來', '');
  await step(tok);                                   // 113:18 memory holds at most 750 records
  txt(memL, 'Memory：最多 750 筆');
  say('例：電腦的 memory 最多放 750 筆 record', '');
  await step(tok);                                   // 113:26 4500 to sort
  txt(diskL, 'Disk：4500 筆');
  say('總共要 sort 的有 4500 筆', '塞爆 memory');
  await step(tok);                                   // 113:39 4500 = 6 × 750
  note('4500 ÷ 750 = 6', 0, 4.6, 0);
  say('4500 是 750 的幾倍？6 倍', '');
  await step(tok);                                   // 114:08 partition into six
  kill(big);
  for (let r = 0; r < 6; r++) { B.push([]); for (let b = 0; b < 3; b++) B[r].push(cube(250, colorFor(r), [0.95, 0.5, 0.8], rx(r), by(b), 0, 1.0)); }
  say('把 4500 筆 partition 成 6 份', '每份 750 筆（一個 run）');
  await step(tok);                                   // 114:37 memory = three blocks
  for (let s = 0; s < 3; s++) ctx.tile(V3(sx(s), 0.45, 0), 1.2, 1.0);
  say('Memory 的 750 筆分成三個 block', '');
  await step(tok);                                   // 114:48 250 per block
  for (let s = 0; s < 3; s++) tag('250', 'idx', sx(s), 0.5, 0.75);
  say('每個 block 均分 250 筆', '');
  await step(tok);                                   // 115:17 the third block is kept for the merge
  tag('輸入', 'idx', sx(0), -0.2, 0.9); tag('輸入', 'idx', sx(1), -0.2, 0.9); tag('放結果', 'ptr alt', sx(2), -0.2, 0.9);
  say('第三個 block 要留下來做 merge', '兩個 block 讀進來、一個放 merge 結果');
  await step(tok);                                   // 115:53 six runs
  const ranges = ['1–750', '751–1500', '1501–2250', '2251–3000', '3001–3750', '3751–4500'];
  for (let r = 0; r < 6; r++) { tag('Run' + (r + 1), 'idx', rx(r), -0.15, 0.8); }
  tag('Run1 = 1–750、Run2 = 751–1500 …', 'say', -3.2, 3.6, 0);
  say('6 個 run：' + ranges.slice(0, 2).join('、') + '…', '');
  await step(tok);                                   // 116:23 Run1: sort it
  for (let b = 0; b < 3; b++) move(B[0][b], sx(b), 1.0, 0);
  say('先處理 Run1（1–750）：把它排好序', '');
  await step(tok);                                   // 117:06 250 at a time, merge, result in the third block
  glow(B[0][0], GOLD); glow(B[0][1], GOLD); await beat(tok, 600);
  glow(B[0][2], GREEN); glow(B[0][0], GREEN); glow(B[0][1], GREEN);
  say('每次抓 250 進來，用 merge 的方法', '結果放在 memory 第三個 block');
  await step(tok);                                   // 117:23 store back to disk
  for (let b = 0; b < 3; b++) move(B[0][b], rx(0), by(b), 0);
  say('再把排好的 block 存回 disk', '');
  await step(tok);                                   // 117:33 Run2 … Run6 the same
  for (let r = 1; r < 6; r++) {
    for (let b = 0; b < 3; b++) move(B[r][b], sx(b), 1.0, 0);
    await beat(tok, 250);
    for (let b = 0; b < 3; b++) { glow(B[r][b], GREEN); move(B[r][b], rx(r), by(b), 0); }
    await beat(tok, 250);
  }
  say('Run2 到 Run6 都一樣', '6 個 run 都排好了');
  await step(tok);                                   // 117:55 merge Run1 and Run2: a higher-level merge sort
  [0, 1].forEach((r) => B[r].forEach((m) => glow(m, GOLD)));
  say('接著 merge Run1 和 Run2', '更 high level 的 merge sort');
  await step(tok);                                   // 118:04 p → Run1's first block, q → Run2's
  [0, 1].forEach((r) => B[r].forEach((m) => glow(m, null)));
  const p = tag('p', 'ptr', rx(0), by(0) + 0.55, 0.5), q = tag('q', 'ptr', rx(1), by(0) + 0.55, 0.5);
  await beat(tok, 500);
  move(B[0][0], sx(0), 1.0, 0); move(B[1][0], sx(1), 1.0, 0);
  p.position.set(sx(0), 1.7, 0.5); q.position.set(sx(1), 1.7, 0.5);
  say('p 指 Run1 的第一個 block、q 指 Run2 的第一個 block', '讀進 memory');
  await step(tok);                                   // 118:13 compare; the result goes into the third block
  const o = cube(250, GOLD, [0.95, 0.5, 0.8], sx(2), 1.0, 0, 1.5);
  say('比大小，結果放在 memory 的第三個 block', '');
  await step(tok);                                   // 118:26 store it back
  move(o, -5.4, 3.0, 0);
  const out = tag('merge 好的新 run（1500 筆）', 'idx', -3.6, 3.6, 0.6);
  say('第三個 block 滿了就 store 回 disk', '');
  await step(tok);                                   // 118:40 the unit is a block
  note('以 block 為單位！', 3.9, 3.0, 0);
  say('注意：這裡的 merge 以 block 為單位', '');
  await step(tok);                                   // 118:58 internal: p, q point to numbers
  note('internal merge：p、q 指一個數字；external：指一個 block', 3.9, 3.7, 0.6);
  say('Internal merge sort 的 p、q 指的是數字', 'external 的 p、q 指的是一個 block');
  await step(tok);                                   // 119:26 inside the blocks: two more pointers
  const ip = tag('↑', 'pkt', sx(0), 0.3, 0.9), iq = tag('↑', 'pkt', sx(1), 0.3, 0.9);
  say('兩個 block 讀進來後', 'block 裡面再用兩個指標指向 record，一筆一筆比');
  await step(tok);                                   // 119:42 many rounds
  kill(ip); kill(iq); kill(p); kill(q);
  txt(out, '6 個 run → 3 → 2 → 1：要 run 好幾輪');
  say('依此類推，要跑好幾輪', '');
  await step(tok);                                   // 120:06 memory is too small: blocks, store back to disk
  say('概念 = merge sort；差別：memory 放不下，所以用 block', '排好的 block 存回 disk，下次再讀出來');
  void pc;
}]);

// 120:37 merge 順序：weighted external path length，2 4 5 15 → 43 vs 52；Huffman 決定最佳順序
FRAG.push(['sortpeng-merge-order', 'Merge 順序：weighted external path length', async (tok) => {
  fresh([0, 6.2, 12.5], [0, 3, 0]);
  const node = (v, x, y, c, d = 0) => cube(v, c || colorFor(v), [0.75, 0.75, 0.75], x, y, 0, d);
  const Lp = { r: [-3.6, 5.4], a: [-4.8, 4.1], b: [-5.7, 2.8], l2: [-6.3, 1.5], l4: [-5.1, 1.5], l5: [-3.9, 2.8], l15: [-2.4, 4.1] };
  const Rp = { r: [3.6, 5.4], a: [2.1, 4.0], b: [5.1, 4.0], l2: [1.4, 2.6], l4: [2.8, 2.6], l5: [4.4, 2.6], l15: [5.8, 2.6] };
  const ed = (P, a, b) => line(P[a][0], P[a][1], P[b][0], P[b][1], 0);
  const L = {}, Rn = {};
  let n1 = null;
  await step(tok);                                   // 120:37 so far every run was equal
  n1 = note('剛剛：每個 run 都均分 750 筆', 0, 6.4, 0);
  say('剛剛的例子做得太好了：每個 run 都均分', '');
  await step(tok);                                   // 120:44 what if they are not equal?
  txt(n1, '如果不均分呢？');
  say('那如果 run 的大小不一樣呢？', '');
  await step(tok);                                   // 120:59 runs of 2, 4, 5, 15 blocks
  kill(n1);
  ['l2', 'l4', 'l5', 'l15'].forEach((k) => { L[k] = node(+k.slice(1), Lp[k][0], Lp[k][1], null, 1.5); });
  say('四個 run：分別有 2、4、5、15 個 block', '方塊上的數字 = 這個 run 有幾個 block');
  await step(tok);                                   // 121:20 the merge order matters
  ['l2', 'l4', 'l5', 'l15'].forEach((k) => { Rn[k] = node(+k.slice(1), Rp[k][0], Rp[k][1], null, 1.5); });
  tag('順序 A', 'ptr', -3.6, 6.4, 0); tag('順序 B', 'ptr', 3.6, 6.4, 0);
  say('兩兩 merge，但 merge 的順序會有影響', '左右是兩種順序');
  await step(tok);                                   // 121:30 which is more efficient?
  bub('怎麼 merge 比較有效率？', 0, 0.4, 1.4);
  say('要怎麼 merge 才比較有效率？', '');
  await step(tok);                                   // 121:38 weighted external path length
  note('weighted external path length = Σ（block 數 × 被 merge 的次數）', 0, -0.3, 2.2);
  say('用 weighted external path length 來評估', '');
  await step(tok);                                   // 121:58 2 blocks: how many merges? 2 + 4 first
  ed(Lp, 'b', 'l2'); ed(Lp, 'b', 'l4'); L.b = node(6, Lp.b[0], Lp.b[1], GRAY, 1.5);
  say('左邊：2 和 4 先 merge 成 6', '');
  await step(tok);                                   // 122:08 then with 5, then with 15
  ed(Lp, 'a', 'b'); ed(Lp, 'a', 'l5'); L.a = node(11, Lp.a[0], Lp.a[1], GRAY, 1.5); await beat(tok, 700);
  ed(Lp, 'r', 'a'); ed(Lp, 'r', 'l15'); L.r = node(26, Lp.r[0], Lp.r[1], GRAY, 1.5);
  say('再跟 5 merge 成 11，再跟 15 merge 成 26', '');
  await step(tok);                                   // 122:13 2 is merged three times: 2 × 3; 4 × 3
  glow(L.l2, GOLD); glow(L.l4, GOLD);
  const c1 = tag('2×3 + 4×3', 'ptr alt', -5.7, 0.6, 0.6);
  say('從 2 走到 root 要經過三次 merge → cost 2×3', '4 也是 4×3');
  await step(tok);                                   // 122:25 15 is merged once: total 43
  glow(L.l2, null); glow(L.l4, null); glow(L.l15, GOLD);
  txt(c1, '2×3 + 4×3 + 5×2 + 15×1 = 43');
  say('最上面的 15 只 merge 一次 → 15×1', '加起來 = 43');
  await step(tok);                                   // 122:34 the balanced one on the right
  glow(L.l15, null);
  ed(Rp, 'a', 'l2'); ed(Rp, 'a', 'l4'); ed(Rp, 'b', 'l5'); ed(Rp, 'b', 'l15');
  Rn.a = node(6, Rp.a[0], Rp.a[1], GRAY, 1.5); Rn.b = node(20, Rp.b[0], Rp.b[1], GRAY, 1.5); await beat(tok, 600);
  ed(Rp, 'r', 'a'); ed(Rp, 'r', 'b'); Rn.r = node(26, Rp.r[0], Rp.r[1], GRAY, 1.5);
  say('右邊比較 balance：兩兩 merge', '2+4、5+15，再合起來');
  await step(tok);                                   // 123:04 its cost is 52
  tag('(2 + 4 + 5 + 15) × 2 = 52', 'ptr alt', 3.6, 0.6, 0.6);
  say('右邊的 cost 算出來是 52', '');
  await step(tok);                                   // 123:12 the biggest run merges twice: 30
  glow(Rn.l15, RED);
  no('15 × 2 = 30', 5.8, 1.6, 0.6);
  say('block 最多的 15 要 merge 兩次', '光它就貢獻 30');
  await step(tok);                                   // 123:37 the order matters a lot
  glow(Rn.l15, null);
  ok('43 < 52：左邊比較省', -3.6, 0.0, 1.2);
  say('Merge 的順序很敏感', 'cost 越小越好（老師口誤說 balance 比較好）');
  await step(tok);                                   // 124:01 the best merge strategy?
  say('怎麼產生最佳的 merge strategy？', '也就是：哪兩個先 merge');
  await step(tok);                                   // 124:17 Huffman code solves it
  bub('Huffman code！', 0, 6.4, 0);
  say('答案：之前的 Huffman code 就可以解', '');
  await step(tok);                                   // 124:42 message frequency ↔ number of blocks
  note('Huffman：字出現的次數 ↔ 這裡：run 的 block 數', 0, 5.6, 0.6);
  say('換個角度：Huffman 的「出現次數」', '在這裡變成 run 的 block 數');
  await step(tok);                                   // 124:48 apply Huffman: merge the two smallest each time
  [L.l2, L.l4, L.b, L.a, L.r].forEach((m) => glow(m, GREEN));
  say('套用 Huffman：每次合併最小的兩個', '2+4 → 6、+5 → 11、+15 → 26 = 左邊那棵');
}]);

// 125:13 External sort 不只一種解法：MapReduce，6 台電腦各排 750 筆再 merge
FRAG.push(['sortpeng-mapreduce', 'External Sort 另一解：多台電腦', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 2.4, 0]);
  const mx = (i) => -5.5 + i * 2.2;
  let big = null, parts = [];
  await step(tok);                                   // 125:13 is merge sort the only answer?
  big = cube('4500 筆', GRAY, [7.0, 0.7, 1.0], 0, 5.2, 0, 1.5);
  bub('External sort 只能用 merge sort 嗎？', 0, 6.4, 0);
  say('External sort 只能用 merge sort 嗎？', '');
  await step(tok);                                   // 125:39 no
  say('不是唯一解', '');
  await step(tok);                                   // 125:47 the constraint: one computer
  note('剛剛的限制：只用一台 computer', -3.6, 3.6, 0);
  say('剛剛有個 constraint：只用一台 computer', '');
  await step(tok);                                   // 126:10 MapReduce is another way
  note('另一種解法：MapReduce', 3.6, 3.6, 0);
  say('剛剛講的 MapReduce 是另一種解法', '');
  await step(tok);                                   // 126:17 many computers, small memories
  const pcs = [];
  for (let i = 0; i < 6; i++) { pcs.push(ghostBox(BLUE, 1.9, 1.4, 1.4)); pcs[i].position.set(mx(i), 1.4, 0); tag('電腦 ' + (i + 1), 'idx', mx(i), 0.4, 0.8); }
  say('有很多台 computer', '每台 memory 都很小（750 筆）');
  await step(tok);                                   // 126:25 six computers, six parts
  kill(big);
  parts = [0, 1, 2, 3, 4, 5].map((i) => { const m = cube(750, colorFor(i), [1.6, 0.6, 0.8], mx(i), 5.2, 0); return m; });
  for (let i = 0; i < 6; i++) { move(parts[i], mx(i), 1.4, 0); await beat(tok, 200); }
  say('用六部電腦：4500 筆切六等份', '每台 750 筆');
  await step(tok);                                   // 126:34 each does an internal sort
  parts.forEach((m) => glow(m, GREEN));
  say('每台各自做 internal sort', '');
  await step(tok);                                   // 126:38 then merge
  parts.forEach((m, i) => move(m, -5.0 + i * 2.0, 3.6, 0)); await beat(tok, 800);
  parts.forEach(kill);
  cube('4500 筆 sorted', GREEN, [7.0, 0.7, 1.0], 0, 3.6, 0);
  say('再 merge 起來', '可以！');
  await step(tok);                                   // 126:44 that's sorting
  ok('Sorting 就上到這邊', 0, 5.2, 0);
  say('Sorting 就上到這邊', '');
}]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

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
    sceneOrder: ['quick-partition', 'quick-worst-case', 'merge-sort', 'heap-sort', 'comparison-lower-bound', 'counting-sort', 'radix-lsd', 'stability'].concat(FRAG.map((f) => f[0])),
    stop() { stopTimer(); },
  };
}
