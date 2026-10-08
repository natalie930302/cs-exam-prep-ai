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
// 只用 K 與 ctx（這個片段也會裝進 ds-8）。陣列一律 1-based。
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, line, GOLD, GREEN, RED, GRAY } = K;
const say = ctx.say, beat = ctx.beat, colorFor = ctx.colorFor;
const BLUE = '#1f3a6e';
const QLY = [6.2, 4.7, 3.2, 1.7];
const QCAM = [0, 6, 15.5], QLOOK = [0, 3.3, 1];
// 一棵 heap：上面是樹、下面是陣列格（同一份資料兩種畫法）
function qTree(vals, o = {}) {
  const W = o.w || 11, X0 = o.x0 || 0, cap = o.cap || vals.length, arr = o.arr !== false;
  const cz = o.cz === undefined ? 3.4 : o.cz, dx = o.dx || 0.9, sz = o.sz || 0.9, min = !!o.min;
  const better = (x, y) => (min ? x < y : x > y);
  const GT = min ? '<' : '>', GE = min ? '≤' : '≥', BIG = min ? '小' : '大';
  const col = (v) => (o.color ? o.color(v) : colorFor(v));
  const S = { a: [null], nd: [null], cl: [null], ed: [null], size: 0, cap };
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
  // insert 的調整：由葉子往根（向上）
  S.up = async (tok, i, ms = 900) => {
    while (i > 1) {
      const p = i >> 1; S.off(); S.hl([i], GOLD); S.hl([p], BLUE);
      if (!better(S.a[i], S.a[p])) { say(S.a[i] + ' ' + (min ? '≥' : '≤') + ' parent ' + S.a[p] + '：停', 'parent = ⌊' + i + '/2⌋ = ' + p); await beat(tok, ms); break; }
      say(S.a[i] + ' ' + GT + ' parent ' + S.a[p] + '：往上換', 'parent = ⌊' + i + '/2⌋ = ' + p);
      await beat(tok, ms * 0.6);
      await S.sw(tok, i, p, ms); i = p;
    }
    S.off(); return i;
  };
  // delete／heapify 的調整：由根往葉子（向下），和較大（min-heap 是較小）的孩子換
  S.down = async (tok, i, size, ms = 900) => {
    while (2 * i <= size) {
      const l = 2 * i, r = l + 1; let c = l; if (r <= size && better(S.a[r], S.a[l])) c = r;
      S.off(); S.hl([i], GOLD); S.hl(r <= size ? [l, r] : [l], BLUE);
      say('孩子 ' + (r <= size ? S.a[l] + '、' + S.a[r] : S.a[l]) + '：較' + BIG + '的是 ' + S.a[c], 'left = 2·' + i + ' = ' + l + (r <= size ? '，right = ' + r : ''));
      await beat(tok, ms);
      if (!better(S.a[c], S.a[i])) { say(S.a[i] + ' ' + GE + ' ' + S.a[c] + '：不用換', '停在 [' + i + ']'); await beat(tok, ms); break; }
      say(S.a[c] + ' ' + GT + ' ' + S.a[i] + '：交換', 'A[' + i + '] ↔ A[' + c + ']');
      await S.sw(tok, i, c, ms); i = c;
    }
    S.off(); return i;
  };
  // 刪除根：最後一個補到根，再往下調；keep = 把刪掉的值放進空出來的格子
  S.pop = async (tok, ms = 900, keep = true) => {
    const n = S.size, top = S.a[1];
    S.off(); S.hl([1], RED);
    say('刪除根 ' + top, '只能刪 root（A[1]）');
    await beat(tok, ms);
    fly(S.nd[1]); S.nd[1] = null;
    const topCell = S.cl[1]; S.cl[1] = null;
    if (n > 1) { S.mv(n, 1); if (S.ed[n]) { kill(S.ed[n]); S.ed[n] = null; } }
    if (topCell) {
      if (keep) { const cn = S.c(n); glow(topCell, null); move(topCell, cn.x, cn.y, cn.z); tint(topCell, GRAY); S.cl[n] = topCell; }
      else fly(topCell, V3(0, 6, 5));
    }
    S.a[n] = keep ? top : null;
    S.setSize(n - 1);
    if (n > 1) say('最後一個 ' + S.a[1] + ' 補到根', keep ? top + ' 放進空出來的 [' + n + ']' : 'heap size = ' + (n - 1));
    await beat(tok, ms);
    await S.down(tok, 1, n - 1, ms);
    return top;
  };
  return S;
}
const qGap = (S, list) => list.map((i) => { const c = S.c(i); return tag('空', 'ptr', c.x, 0.95, c.z); });
const HQ_MAX = [50, 30, 20, 15, 10, 8, 16];

// 02:29 陣列表示
FRAG.push(['heaphq-array-rep', '用陣列存 Binary Tree：A–G 與三個公式', async (tok) => {
  fresh(QCAM, QLOOK);
  const S = qTree([], { cap: 7, color: () => '#4b9ee2' });
  say('用陣列存樹：元素和父子關係都要存', 'index 從 1 開始（課堂慣例）');
  await beat(tok, 2400);
  for (const [k, v] of ['A', 'B', 'C', 'D', 'E', 'F', 'G'].entries()) { S.put(k + 1, v, 3); say('一層一層、由左到右填：' + v, 'A[' + (k + 1) + '] = ' + v); await beat(tok, 650); }
  S.hl([2], GOLD); S.hl([4], GREEN);
  say('B 在 i = 2：左孩子在 2i', 'left = 2·2 = 4 → D');
  await beat(tok, 2200);
  S.off(); S.hl([2], GOLD); S.hl([5], GREEN);
  say('右孩子在 2i + 1', 'right = 2·2 + 1 = 5 → E');
  await beat(tok, 2200);
  S.off(); S.hl([3], GOLD); S.hl([6, 7], GREEN);
  say('C 在 i = 3：孩子在 6、7', 'left = 6 → F，right = 7 → G');
  await beat(tok, 2400);
  S.off(); S.hl([6], GOLD); S.hl([3], GREEN);
  say('F 在 6：parent = 6/2 = 3', 'parent = ⌊i/2⌋ → C');
  await beat(tok, 2200);
  S.off(); S.hl([7], GOLD); S.hl([3], GREEN);
  say('G 在 7：7/2 = 3.5，取 floor', '⌊7/2⌋ = 3 → C');
  await beat(tok, 2400);
  S.off();
  say('照層序填，公式自動成立', 'left = 2i、right = 2i + 1、parent = ⌊i/2⌋');
  await beat(tok, 2800);
}]);

// 05:38 缺節點要留空格
FRAG.push(['heaphq-array-gaps', '缺少的節點要在陣列留空格', async (tok) => {
  fresh(QCAM, QLOOK);
  let S = qTree([], { cap: 7, color: () => '#4b9ee2' });
  for (const [k, v] of ['A', 'B', 'C', 'D', 'E'].entries()) { S.put(k + 1, v, 3); say('A B C D E 一樣層序填', 'A[' + (k + 1) + '] = ' + v); await beat(tok, 550); }
  say('最後一層不滿也沒關係', '公式照樣成立');
  await beat(tok, 2200);
  fresh(QCAM, QLOOK);
  S = qTree([], { cap: 7, color: () => '#4b9ee2' });
  for (const [k, v] of ['A', 'B', 'C'].entries()) S.put(k + 1, v);
  say('這棵：D 是 C 的左孩子', 'B 沒有孩子');
  await beat(tok, 2200);
  S.put(4, 'D', 3); S.hl([4], RED);
  say('直接接著放 D 到 [4]？', '<span class="no">[4] = 2·2：D 變成 B 的左孩子</span>');
  await beat(tok, 2600);
  S.off(); S.mv(4, 6);
  say('D 要放在 [6] = 2·3', 'C 的左孩子');
  await beat(tok, 1800);
  qGap(S, [4, 5]);
  say('B 的兩個孩子位置要留空', 'A B C _ _ D');
  await beat(tok, 2400);
  S.hl([6], GOLD); S.hl([3], GREEN);
  say('D 的 parent：⌊6/2⌋ = 3 → C', '有缺的節點就留空格，公式才對');
  await beat(tok, 2800);
}]);

// 07:22 full vs complete
FRAG.push(['heaphq-full-complete', 'Full Binary Tree 與 Complete Binary Tree', async (tok) => {
  fresh(QCAM, QLOOK);
  const S = qTree(['A', 'B', 'C', 'D', 'E', 'F', 'G'], { cap: 9, color: () => '#4b9ee2' });
  for (let d = 0; d < 3; d++) tag('h ' + d, 'idx', -6.3, QLY[d], 0);
  say('高度 2：節點數已是最多', 'full：2^(h+1) − 1 = 2³ − 1 = 7');
  await beat(tok, 2800);
  say('再加一個節點，高度就會變 3', 'full binary tree：沒有空位');
  await beat(tok, 2200);
  tag('h 3', 'idx', -6.3, QLY[3], 0);
  S.put(8, 'H', 3); S.put(9, 'I', 3);
  say('Complete：陣列中間沒有空格', 'A … I 連續，後面的空位不算');
  await beat(tok, 2800);
  S.hl([8], RED);
  await beat(tok, 600);
  fly(S.nd[8]); fly(S.cl[8]); kill(S.ed[8]); S.nd[8] = S.cl[8] = S.ed[8] = null;
  const g = qGap(S, [8]);
  say('拿掉 H：[8] 變空格', '<span class="no">中間有空 → 不是 complete</span>');
  await beat(tok, 2800);
  kill(g[0]); S.mv(9, 8); S.hl([8], GREEN);
  say('課本定義：h − 1 層以上是 full', '最後一層由左往右填');
  await beat(tok, 2800);
  S.off();
  say('Full 一定也是 Complete', '（有人把 complete 叫 almost complete）');
  await beat(tok, 2600);
}]);

// 11:33 判斷 complete 的例子
FRAG.push(['heaphq-complete-check', '判斷是不是 Complete：看陣列有沒有空格', async (tok) => {
  const col = () => '#9b7ef4';
  fresh(QCAM, QLOOK);
  let S = qTree([1, 2, 3, 4, 5], { cap: 10, color: col });
  say('一層一層檢查：有沒有缺的', '從左邊開始，不能跳過');
  await beat(tok, 2200);
  say('1、2 個，最後一層從左邊開始', '<span class="ok">complete</span>');
  await beat(tok, 2800);
  fresh(QCAM, QLOOK);
  S = qTree([1, 2, 3, null, null, null, 4], { cap: 10, color: col });
  say('最後一層只有最右邊一個', '陣列：1 2 3 _ _ _ 4');
  await beat(tok, 1800);
  qGap(S, [4, 5, 6]);
  say('中間空了 3 格', '<span class="no">不是 complete</span>');
  await beat(tok, 2800);
  fresh(QCAM, QLOOK);
  S = qTree([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], { cap: 10, color: col });
  say('上面三層滿，最後一層靠左', '<span class="ok">complete</span>（之後沒節點不要緊）');
  await beat(tok, 2800);
  for (let d = 0; d < 4; d++) tag('h ' + d, 'idx', -6.3, QLY[d], 0);
  say('一層沒填滿不會往下長', '高度最小：h = ⌊log₂ n⌋ = ⌊log₂ 10⌋ = 3');
  await beat(tok, 3000);
}]);

// 14:11 max heap／min heap
FRAG.push(['heaphq-max-min', 'Max Heap 與 Min Heap', async (tok) => {
  fresh(QCAM, QLOOK);
  const A = qTree(HQ_MAX, { arr: false, w: 6, x0: -3.4, sz: 0.75 });
  tag('Max Heap', 'ptr alt', -3.4, 7.4, 0);
  say('Heap 先要是 complete binary tree', 'A = 50, 30, 20, 15, 10, 8, 16');
  await beat(tok, 2400);
  A.hl([2], GOLD); A.hl([4, 5], BLUE);
  say('30 ≥ 15、10', '每個節點 ≥ 所有子孫');
  await beat(tok, 1800);
  A.off(); A.hl([3], GOLD); A.hl([6, 7], BLUE);
  say('20 ≥ 8、16', '可以等於：允許重複');
  await beat(tok, 1800);
  A.off(); A.hl([1], GREEN);
  say('根是最大值 50', 'max heap');
  await beat(tok, 2200);
  const B = qTree([10, 30, 20, 35, 40, 32, 25], { arr: false, w: 6, x0: 3.4, sz: 0.75 });
  tag('Min Heap', 'ptr', 3.4, 7.4, 0);
  B.hl([2], GOLD); B.hl([4, 5], BLUE);
  say('35、40 ≥ 30，也 ≥ 10', '每個節點 ≤ 所有子孫');
  await beat(tok, 2200);
  B.off(); B.hl([1], GREEN);
  say('根是最小值 10', 'min heap');
  await beat(tok, 2600);
  say('之後都用 max heap 講', 'min heap 做法相同，方向相反');
  await beat(tok, 2400);
}]);

// 16:18 錯誤的 insert：塞進根
FRAG.push(['heaphq-insert-wrong', '常見錯誤：把 60 直接塞到根', async (tok) => {
  fresh(QCAM, QLOOK);
  const S = qTree(HQ_MAX, { cap: 15, dx: 0.74 });
  say('insert 60：60 最大，最後要在根', 'A = 50, 30, 20, 15, 10, 8, 16');
  await beat(tok, 3000);
  const p1 = S.p(1), n60 = cube(60, colorFor(60), [0.9, 0.9, 0.9], p1.x + 1.6, 7.6, 0);
  glow(n60, RED);
  say('錯誤想法：60 塞進根，其他往下推', '50 → 20 那邊 → 16 再往下');
  await beat(tok, 2200);
  S.mv(7, 15); say('16 被擠到 20 底下', '20 再往下推'); await beat(tok, 1200);
  S.mv(3, 7); say('20 被擠下去', '50 也往右下推'); await beat(tok, 1200);
  S.mv(1, 3); say('50 讓出根', '60 坐上根'); await beat(tok, 1200);
  move(n60, p1.x, p1.y, 0); S.nd[1] = n60; S.a[1] = 60; S.cell(1, 60, 1);
  say('樹往右下長出一條', '16 跑到 [15]');
  await beat(tok, 2800);
  qGap(S, [8, 9, 10, 11, 12, 13, 14]);
  say('陣列 [8]～[14] 全空', '<span class="no">不是 complete，不能這樣插</span>');
  await beat(tok, 3600);
}]);

// 18:02 正確的 insert
FRAG.push(['heaphq-insert-60', 'insert 60：放最後一格，再往上比', async (tok) => {
  fresh(QCAM, QLOOK);
  const S = qTree(HQ_MAX, { cap: 8 });
  say('正確：放在陣列下一個空位', '[8]：2·4 = 8 → 15 的左孩子');
  S.put(8, 60, 3);
  await beat(tok, 2600);
  S.hl([8], RED);
  say('還是 complete，但 60 > 15', '<span class="no">違反 max heap</span>');
  await beat(tok, 2200);
  await S.up(tok, 8, 950);
  S.hl([1], GREEN);
  say('60 到根：比較、交換 3 次', 'A = ' + S.a.slice(1).join(', '));
  await beat(tok, 2800);
  say('交換次數 ≤ 高度 = log n', '插入 6 就 0 次：O(1) ～ O(log n)');
  await beat(tok, 2800);
  S.off();
  say('insert：由葉子往根調整', '方向：向上');
  await beat(tok, 2400);
}]);

// 22:15 delete：只能刪根
FRAG.push(['heaphq-delete-50', 'Delete：刪根、最後一個補上、往下調', async (tok) => {
  fresh(QCAM, QLOOK);
  const S = qTree(HQ_MAX, { cap: 7, sizeTag: true });
  S.hl([1], GOLD);
  say('只能刪根：最大的 50', '像蘋果堆，只拿最上面那顆');
  await beat(tok, 2600);
  S.off(); S.hl([2, 4], RED);
  say('錯誤：30 補上去、15 再補上去', '<span class="no">[4] 空掉 → 不是 complete</span>');
  await beat(tok, 2800);
  S.off();
  await S.pop(tok, 1000, false);
  S.hl([1], GREEN);
  say('又是 max heap：30 在根', 'A = ' + S.a.slice(1, S.size + 1).join(', '));
  await beat(tok, 2600);
  S.off();
  say('delete：由根往葉子調整', '方向：向下，最多 log n 次 → O(log n)');
  await beat(tok, 2600);
}]);

// 27:51 刪掉的值放進空格
FRAG.push(['heaphq-delete-store', '刪除的值放進空出來的格子 → 排好序', async (tok) => {
  fresh(QCAM, QLOOK);
  const S = qTree([30, 16, 20, 15, 10, 8], { cap: 7, sizeTag: true });
  S.cell(7, 50); tint(S.cl[7], GRAY); S.a[7] = 50;
  say('heap size = 6，[7] 已不屬於 heap', '把刪掉的 50 存在 [7]');
  await beat(tok, 2800);
  await S.pop(tok, 900, true);
  say('8 在 [3]：size = 5，沒有孩子', '2·3 = 6 > 5 → 停');
  await beat(tok, 2600);
  say('一直刪：每次拿到剩下最大的', '刪掉的值依序放到尾端');
  await beat(tok, 1800);
  for (let k = 0; k < 4; k++) await S.pop(tok, 420, true);
  for (let i = 1; i <= 7; i++) if (S.cl[i]) tint(S.cl[i], '#2fc092');
  say('從左讀：由小到大排好了', 'A = ' + S.a.slice(1, 8).join(', ') + '：heap sort 的想法');
  await beat(tok, 3200);
}]);

// 30:55 heap sort 第一步：逐一 insert
FRAG.push(['heaphq-sort-build', 'Heap Sort 第一步：10 20 15 30 40 逐一 insert', async (tok) => {
  fresh(QCAM, QLOOK);
  const vals = [10, 20, 15, 30, 40];
  const S = qTree(vals, { cap: 5, cellsOnly: true, sizeTag: true });
  say('要排序：10, 20, 15, 30, 40', '第一步：建 heap；第二步：全部 delete');
  await beat(tok, 2600);
  for (let k = 1; k <= 5; k++) {
    S.node(k, S.a[k], 3); S.setSize(k); S.hl([k], GOLD);
    say(k === 1 ? '10 自己就是 heap' : 'insert ' + S.a[k] + '：放在 [' + k + ']', 'heap size = ' + k);
    await beat(tok, k === 1 ? 1800 : 1000);
    await S.up(tok, k, 700);
  }
  S.hl([1], GREEN);
  say('max heap 建好了', 'A = ' + S.a.slice(1, 6).join(', '));
  await beat(tok, 2600);
  S.off();
  say('n 個元素，每個最多爬 log n', '建 heap：O(n log n)');
  await beat(tok, 2600);
}]);

// 36:07 heap sort 第二步：全部 delete
FRAG.push(['heaphq-sort-delete', 'Heap Sort 第二步：一直 delete，放到空出的位置', async (tok) => {
  fresh(QCAM, QLOOK);
  const S = qTree([40, 30, 15, 10, 20], { cap: 5, sizeTag: true });
  say('從剛建好的 max heap 開始', 'A = 40, 30, 15, 10, 20');
  await beat(tok, 2200);
  for (let k = 0; k < 4; k++) await S.pop(tok, 650, true);
  for (let i = 1; i <= 5; i++) if (S.cl[i]) tint(S.cl[i], '#2fc092');
  say('排好了：10, 15, 20, 30, 40', '每次 delete O(log n)，共 n 次');
  await beat(tok, 2800);
  say('n log n（建）+ n log n（刪）', '2n log n = <span class="ok">O(n log n)</span>');
  await beat(tok, 2800);
}]);

// 41:35 heapify
FRAG.push(['heaphq-heapify', 'Heapify：由右往左掃，往下調整', async (tok) => {
  fresh(QCAM, QLOOK);
  const S = qTree([10, 20, 15, 12, 40, 25, 18], { cap: 7 });
  say('complete，但不是 max heap', 'A = 10, 20, 15, 12, 40, 25, 18');
  await beat(tok, 2400);
  say('從最後一個往前掃（由右往左）', '每個元素往下調整（像 delete 那樣）');
  await beat(tok, 2200);
  for (let i = 7; i >= 4; i--) { S.hl([i], GREEN); say(S.a[i] + ' 沒有孩子：自己就是 heap', 'i = ' + i); await beat(tok, 700); }
  S.off();
  for (let i = 3; i >= 1; i--) {
    S.hl([i], GOLD);
    say('i = ' + i + '：' + S.a[i] + ' 往下看', '它底下的子樹都已是 heap');
    await beat(tok, 1200);
    await S.down(tok, i, 7, 800);
  }
  S.hl([1], GREEN);
  say('max heap 完成', 'A = ' + S.a.slice(1, 8).join(', '));
  await beat(tok, 2600);
  S.off();
  say('heapify：O(n)', '逐一 insert 建 heap：O(n log n) → heapify 較快');
  await beat(tok, 2800);
}]);

// 46:51 priority queue
const HQ_PQ = [8, 6, 3, 10, 9];
const pqX = (i) => (i - 2) * 1.9;
FRAG.push(['heaphq-pq-priority', 'Priority Queue：數字本身就是 priority', async (tok) => {
  fresh([0, 6, 12], [0, 0.8, 0]);
  const bs = HQ_PQ.map((v, i) => cube(v, colorFor(v), [1.2, 0.9, 1.2], pqX(i), 0.45, 0, 4));
  say('Queue 是 FIFO；priority queue 不是', '刪除時拿 priority 最高的');
  await beat(tok, 2600);
  say('這裡數字本身就是 priority', '8 的 priority 是 8，3 的是 3');
  await beat(tok, 2400);
  const ord = [...HQ_PQ.keys()].sort((a, b) => HQ_PQ[a] - HQ_PQ[b]);
  const tags = [];
  say('規則一：數字越小，priority 越高', '先刪 3，再 6，再 8');
  for (let k = 0; k < 3; k++) { glow(bs[ord[k]], GOLD); tags.push(tag('#' + (k + 1), 'ptr', pqX(ord[k]), 1.6, 0)); await beat(tok, 900); }
  await beat(tok, 1400);
  tags.forEach(kill); bs.forEach((b) => glow(b, null)); tags.length = 0;
  say('規則二：數字越大，priority 越高', '先刪 10，再 9，再 8');
  for (let k = 0; k < 3; k++) { const i = ord[4 - k]; glow(bs[i], BLUE); tags.push(tag('#' + (k + 1), 'ptr alt', pqX(i), 1.6, 0)); await beat(tok, 900); }
  await beat(tok, 1400);
  say('兩種規則都可以，事先說好', '小的優先 → min heap；大的優先 → max heap');
  await beat(tok, 3000);
}]);

FRAG.push(['heaphq-pq-array-vs-heap', 'Priority Queue：用陣列 vs 用 Heap', async (tok) => {
  fresh([0, 6, 12], [0, 0.8, 0]);
  const xs = (i) => (i - 2.5) * 1.7;
  const bs = HQ_PQ.map((v, i) => cube(v, colorFor(v), [1.2, 0.9, 1.2], xs(i), 0.45, 0));
  say('用一般陣列：小的優先', 'A = 8, 6, 3, 10, 9');
  await beat(tok, 2200);
  const nx = cube('x', '#d8cfc0', [1.2, 0.9, 1.2], xs(5), 0.45, 0, 4);
  say('insert：直接放尾端', '<span class="ok">O(1)</span>');
  await beat(tok, 2200);
  glow(bs[2], RED);
  say('delete：要先找到 3', '最高 priority 可能在任何位置');
  await beat(tok, 1800);
  fly(bs[2]);
  [bs[3], bs[4], nx].forEach((b, k) => move(b, xs(2 + k), 0.45, 0));
  say('刪掉後後面全部往前移', '<span class="no">O(n)</span>');
  await beat(tok, 2600);
  say('改成保持排序？換 insert 要 O(n)', '總有一個操作是 O(n)');
  await beat(tok, 2600);
  fresh(QCAM, QLOOK);
  const S = qTree([3, 6, 8, 10, 9], { cap: 5, min: true, sizeTag: true });
  say('改用 min heap（同一組數字）', 'A = 3, 6, 8, 10, 9');
  await beat(tok, 2400);
  await S.pop(tok, 750, false);
  say('insert、delete 都只走一條路徑', '<span class="ok">O(log n)</span>');
  await beat(tok, 2600);
  say('heap 最適合實作 priority queue', '小的優先用 min heap，大的優先用 max heap');
  await beat(tok, 2800);
}]);
  }

  // ═══ sortbari.js ═══
  {
const { V3, fresh, tag, cube, move, kill, glow, tint, code, ghostBox, GOLD, GREEN, GRAY } = K;
// ─── mB5HXBb_HY8：Abdul Bari〈Merge Sort〉、7h1s2SojIRw：Abdul Bari〈Quick Sort〉 ───
// Merge sort 的例子：索引 1..8 = 9 3 7 5 6 4 8 2（mid = ⌊(l+h)/2⌋，7 次 merge 依 post-order 編號）。
// Quick sort 的例子：10 16 8 12 15 6 3 9 5，尾端放 ∞；pivot = A[l]，i 找 > pivot、j 找 ≤ pivot，
// 交錯後 A[l] ↔ A[j]（第一次 partition → 6 5 8 9 3 10 15 12 16），之後 QuickSort(l, j)、QuickSort(j+1, h)。
const SB_M = [9, 3, 7, 5, 6, 4, 8, 2];
const SB_Q = [10, 16, 8, 12, 15, 6, 3, 9, 5, Infinity];
const sbS = (v) => (v === Infinity ? '∞' : String(v));
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
// top-down merge sort trace on 9 3 7 5 6 4 8 2; mode 'idx' shows (low, high) of every call
async function sbTrace(tok, mode, ms) {
  const vals = SB_M.slice(); let merges = 0;
  const idx = mode === 'idx';
  const rng = (l, h, g) => { if (idx) tag('(' + (l + 1) + ',' + (h + 1) + ')', 'idx', (sbX(l, g) + sbX(h, g)) / 2, SB_Y[g] - 0.55, 0); };
  const root = vals.map((v, k) => sbCube(v, k, 8)); rng(0, 7, 8);
  async function rec(l, h, nodes) {
    const g = h - l + 1;
    if (g === 1) {
      glow(nodes[0], GREEN);
      say(idx ? '(' + (l + 1) + ',' + (l + 1) + ')：l = h，一個元素' : vals[l] + '：只剩一個元素', '一個元素就是排好的串列');
      await beat(tok, ms * 0.6); glow(nodes[0], null);
      return nodes;
    }
    const m = (l + h) >> 1;
    nodes.forEach((n) => tint(n, GRAY));
    say(idx ? 'MergeSort(' + (l + 1) + ', ' + (h + 1) + ')：mid = ' + (m + 1) : '切開：' + vals.slice(l, m + 1).join(' ') + ' | ' + vals.slice(m + 1, h + 1).join(' '),
      idx ? 'mid = (' + (l + 1) + ' + ' + (h + 1) + ') / 2 = ' + (m + 1) + '：先做左半，右半等一下' : '先處理左半，右半等一下');
    await beat(tok, ms);
    const L = []; for (let k = l; k <= m; k++) L.push(sbCube(vals[k], k, g / 2, 0.8)); rng(l, m, g / 2);
    await beat(tok, ms * 0.5);
    const Ls = await rec(l, m, L);
    const R = []; for (let k = m + 1; k <= h; k++) R.push(sbCube(vals[k], k, g / 2, 0.8)); rng(m + 1, h, g / 2);
    say(idx ? '左半完成，換右半 (' + (m + 2) + ',' + (h + 1) + ')' : '左半排好了，換右半', '');
    await beat(tok, ms * 0.6);
    const Rs = await rec(m + 1, h, R);
    merges++;
    nodes.forEach(kill);
    const res = Ls.concat(Rs).map((x) => x.userData.v).sort((a, b) => a - b);
    say('第 ' + merges + ' 次 merge → ' + res.join(' '), idx ? 'Merge(' + (l + 1) + ', ' + (m + 1) + ', ' + (h + 1) + ')' : 'post-order：左、右都好了才 merge（根）');
    const out = await sbMerge(tok, Ls, Rs, l, g, ms);
    tag('#' + merges, 'ptr alt', (sbX(l, g) + sbX(h, g)) / 2, SB_Y[g] + 0.55, 0);
    await beat(tok, ms * 0.5);
    return out;
  }
  return rec(0, 7, root);
}

// ── Merge Sort ──
// 00:00 divide and conquer：大問題拆開，一個元素就是「小問題」
FRAG.push(['sortbari-merge-dc', 'Divide and Conquer：拆到只剩一個元素', async (tok) => {
  fresh([0, 4, 13], [0, 3.4, 0]);
  const ms = SB_M.map((v, k) => sbCube(v, k, 8, 1.2));
  say('Merge sort：recursive、divide and conquer', '問題大 → 拆成子問題；小 → 直接解；再合併');
  await beat(tok, 3200);
  say('問題：把 8 個元素排好', '8 個元素 → 大問題');
  await beat(tok, 2200);
  for (const g of [4, 2, 1]) {
    ms.forEach((m, k) => move(m, sbX(k, g), SB_Y[g], 0));
    say(g > 1 ? '還是大問題 → 再拆' : '拆到只剩一個元素', g > 1 ? '每段 ' + g + ' 個元素（兩個也算大）' : '一個元素 = 小問題，不用排');
    await beat(tok, 2200);
  }
  ms.forEach((m) => glow(m, GREEN));
  say('小問題的解，合併成大問題的解', '<span class="ok">一個元素本身就是排好的</span>');
  await beat(tok, 3000);
}]);

// 01:25 演算法 MergeSort(l, h)
FRAG.push(['sortbari-merge-code', 'MergeSort(l, h) 演算法', async (tok) => {
  fresh([0, 4, 13], [0, 3.4, 0]);
  const C = code(['Algorithm MergeSort(l, h)', '{', '  if (l < h)', '  {', '    mid = (l + h) / 2;', '    MergeSort(l, mid);', '    MergeSort(mid + 1, h);', '    Merge(l, mid, h);', '  }', '}'], -3.4, 6.0, 0.5);
  const X = (k) => 0.9 + k * 0.72;
  const row = SB_M.map((v, k) => cube(v, colorFor(v), [0.55, 0.55, 0.55], X(k), 3.0, 0, 1.2));
  SB_M.forEach((v, k) => tag(String(k + 1), 'idx', X(k), 2.4, 0));
  C.hl(0);
  say('參數：串列的開頭 l、結尾 h', 'l = low　h = high');
  const lt = tag('l', 'ptr', X(0), 3.8, 0), ht = tag('h', 'ptr', X(7), 3.8, 0);
  await beat(tok, 3000);
  C.hl(2);
  say('l < h：至少兩個元素 → 大問題', 'l = h 表示只有一個元素，不用做');
  await beat(tok, 3200);
  C.hl(4);
  tag('mid', 'ptr alt', X(3), 4.4, 0); glow(row[3], GOLD);
  say('找中間：mid = (1 + 8) / 2 = 4', '整數除法：9 / 2 = 4');
  await beat(tok, 3000);
  C.hl(5);
  let z = ghostBox('#4b9ee2', 4 * 0.72, 0.9, 0.9); z.position.set((X(0) + X(3)) / 2, 3.0, 0);
  say('左半 1～4：遞迴 merge sort', 'MergeSort(1, 4)');
  await beat(tok, 2800);
  C.hl(6);
  const z2 = ghostBox('#dd8238', 4 * 0.72, 0.9, 0.9); z2.position.set((X(4) + X(7)) / 2, 3.0, 0);
  say('右半 5～8：遞迴 merge sort', 'MergeSort(5, 8)');
  await beat(tok, 2800);
  C.hl(7); glow(row[3], null);
  say('兩半都排好 → 合併', 'Merge(l, mid, h) = Merge(1, 4, 8)');
  await beat(tok, 3000);
  kill(lt); kill(ht);
  say('一個陣列裡同時放兩個串列', '[l..mid] 與 [mid+1..h]');
  await beat(tok, 3200);
}]);

// 04:19 追蹤（索引版）：7 次 merge
FRAG.push(['sortbari-merge-trace-idx', '追蹤 MergeSort(1, 8)：遞迴樹與 7 次 merge', async (tok) => {
  fresh([0, 4, 13], [0, 3.4, 0]);
  say('MergeSort(1, 8)：9 3 7 5 6 4 8 2', 'low = 1、high = 8');
  await beat(tok, 2400);
  const out = await sbTrace(tok, 'idx', 620);
  out.forEach((m) => glow(m, GREEN));
  say('一路切到一個元素，再一路 merge', '<span class="ok">2 3 4 5 6 7 8 9</span>　共 7 次 merge');
  await beat(tok, 3200);
}]);

// 09:00 和 two-way merge sort 比較
FRAG.push(['sortbari-merge-twoway', 'Two-way merge sort vs merge sort', async (tok) => {
  fresh([0, 4, 13], [0, 3.4, 0]);
  let cur = SB_M.map((v, k) => sbCube(v, k, 1, 1.0));
  tag('two-way（迭代）', 'ptr', -5.6, 6.6, 0);
  say('two-way merge sort：一輪一輪', '前兩個、下兩個、再下兩個……');
  await beat(tok, 2600);
  let pass = 0;
  for (const g of [2, 4, 8]) {
    pass++;
    const next = [];
    for (let lo = 0; lo < 8; lo += g) {
      const A = cur.slice(lo, lo + g / 2), B = cur.slice(lo + g / 2, lo + g);
      next.push(...await sbMerge(tok, A, B, lo, g, 360));
    }
    cur = next;
    say('第 ' + pass + ' 輪：每段 ' + g + ' 個', cur.map((m) => m.userData.v).join(' '));
    await beat(tok, 1800);
  }
  say('merge sort：遞迴，先左半、再右半', 'pattern 不同，合併方式一樣');
  await beat(tok, 3200);
  say('一樣一次合併兩個串列 → 也是 two-way', '因為是遞迴版，另外叫 merge sort');
  await beat(tok, 3200);
}]);

// 10:06 時間：每層 n 個、共 log n 層
FRAG.push(['sortbari-merge-levels', 'Merge sort 的時間：n × log n', async (tok) => {
  fresh([0, 4, 13], [0, 3.4, 0]);
  const rows = { 1: SB_M, 2: [3, 9, 5, 7, 4, 6, 2, 8], 4: [3, 5, 7, 9, 2, 4, 6, 8], 8: [2, 3, 4, 5, 6, 7, 8, 9] };
  rows[1].forEach((v, k) => sbCube(v, k, 1, 0.8));
  say('從遞迴樹最下面開始 merge', '一個一個的元素');
  await beat(tok, 2600);
  let lv = 0;
  for (const g of [2, 4, 8]) {
    lv++;
    rows[g].forEach((v, k) => sbCube(v, k, g, 1.0));
    tag('8 個 = n', 'ptr alt', 5.6, SB_Y[g], 0);
    tag('第 ' + lv + ' 層', 'idx', -5.6, SB_Y[g], 0);
    say('這一層 merge 了 8 個元素', '每層 merge 的總量 = n');
    await beat(tok, 2600);
  }
  say('8 個元素 → 3 層 = log₂ 8', '1 → 2 → 4 → 8：每層加倍');
  await beat(tok, 3200);
  say('遞迴先左後右，不是一輪輪 pass', '但層數一樣是 log n');
  await beat(tok, 3000);
  say('n × log n', '<span class="ok">Θ(n log n)</span>');
  await beat(tok, 3000);
}]);

// 11:59 追蹤（數字版）：merge 在 post-order
FRAG.push(['sortbari-merge-trace-num', '用數字追蹤：merge 發生在 post-order', async (tok) => {
  fresh([0, 4, 13], [0, 3.4, 0]);
  say('用數字再追一次：low 1、high 8', '9 3 7 5 6 4 8 2');
  await beat(tok, 2400);
  const out = await sbTrace(tok, 'num', 620);
  out.forEach((m) => glow(m, GREEN));
  say('呼叫自己兩次 → 追蹤樹是 binary tree', '<span class="ok">merge 的順序 = post-order</span>（左、右、根）');
  await beat(tok, 3400);
}]);

// 17:28 遞迴式與 master theorem
FRAG.push(['sortbari-merge-recurrence', 'T(n) = 2T(n/2) + n → Θ(n log n)', async (tok) => {
  fresh([0, 4, 13], [0, 3.4, 0]);
  const C = code(['MergeSort(l, h)          T(n)', '{ if (l < h)', '  { mid = (l + h) / 2;     1', '    MergeSort(l, mid);     T(n/2)', '    MergeSort(mid + 1, h); T(n/2)', '    Merge(l, mid, h);      n', '  }', '}'], -3.0, 5.8, 0.55);
  C.hl(0);
  say('假設整個演算法花 T(n)', '用 recurrence relation 求時間');
  await beat(tok, 2800);
  C.hl(4);
  say('左右各一半：T(n/2) + T(n/2)', 'mid 只是常數，忽略');
  await beat(tok, 2800);
  C.hl(5);
  say('merge 兩個串列：共 n 個元素', 'Merge = n');
  await beat(tok, 2600);
  C.hl(-1);
  say('T(n) = 2T(n/2) + n（n > 1）', 'n = 1 時什麼都不做，寫常數 1');
  await beat(tok, 3000);
  const W = 4.4;
  for (let d = 0; d < 4; d++) {
    const cnt = 1 << d, w = W / cnt;
    for (let c = 0; c < cnt; c++) cube(null, '#4b9ee2', [w - 0.1, 0.35, 0.5], 4.0 - W / 2 + w * (c + 0.5), 5.4 - d * 1.0, 0, 0.6);
    tag('n', 'ptr alt', 6.6, 5.4 - d * 1.0, 0);
    await beat(tok, 500);
  }
  tag('log n 層', 'idx', 4.0, 1.6, 0);
  say('Master theorem：a = 2、b = 2', 'f(n) = n = n^k，k = 1');
  await beat(tok, 3000);
  say('log_b a = log₂ 2 = 1 = k → case 2', 'case 2：f(n) 乘上 log n');
  await beat(tok, 3200);
  say('Merge sort 的時間', '<span class="ok">Θ(n log n)</span>');
  await beat(tok, 3000);
}]);

// ── Quick Sort ──
// a floor row of value cubes with i / j / l / h pointers
function sbRow(vals, o = {}) {
  const dx = o.dx || 1.1, z = o.z || 0, y = 0.5, n = vals.length, x0 = -(n - 1) * dx / 2;
  const R = { v: vals.slice(), m: [], dx, z, y };
  R.x = (i) => x0 + i * dx;
  for (let i = 0; i < n; i++) ctx.tile(V3(R.x(i), 0.02, z), dx * 0.9, 1.0);
  vals.forEach((v, i) => { R.m[i] = cube(sbS(v), v === Infinity ? '#d8cfc0' : colorFor(v), [0.8, 0.8, 0.8], R.x(i), y, z, o.drop ? 2.2 : 0); });
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
// Bari's partition(l, h): h is the sentinel slot (∞ or an earlier pivot); returns j
async function sbPart(tok, R, l, h, o = {}) {
  const ms = o.ms || 800, hl = o.code ? (k) => o.code.hl(k) : () => {}, p = R.v[l];
  let i = l, j = h;
  glow(R.m[l], GOLD);
  const pt = R.ptr('pivot', 'ptr alt', l, 2.6), it = R.ptr('i', 'ptr', i, 1.3), jt = R.ptr('j', 'ptr', j, 1.9);
  hl(1); say('pivot = A[l] = ' + p, 'i = l、j = h　' + R.str());
  await beat(tok, ms);
  while (i < j) {
    hl(2); hl(3);
    do { i++; R.at(it, i, 1.3); glow(R.m[i], '#1f3a6e'); await beat(tok, ms * 0.35); glow(R.m[i], null); } while (R.v[i] <= p);
    say('i 停在 ' + sbS(R.v[i]) + '（> ' + p + '）', R.str());
    await beat(tok, ms * 0.5);
    hl(4);
    do { j--; R.at(jt, j, 1.9); glow(R.m[j], '#8a1f5a'); await beat(tok, ms * 0.35); glow(R.m[j], null); } while (R.v[j] > p);
    say('j 停在 ' + sbS(R.v[j]) + '（≤ ' + p + '）', R.str());
    await beat(tok, ms * 0.5);
    hl(5);
    if (i < j) {
      say('i < j：交換 ' + sbS(R.v[i]) + ' 和 ' + sbS(R.v[j]), R.str());
      await R.swap(tok, i, j, ms);
      say('交換後', R.str());
      await beat(tok, ms * 0.3);
    } else {
      say('i > j：交錯了，不交換', 'j 停的地方就是 pivot 的位置');
      await beat(tok, ms * 0.8);
    }
  }
  hl(7);
  say('A[l] 和 A[j] 交換：' + p + ' ↔ ' + R.v[j], R.str());
  await R.swap(tok, l, j, ms);
  glow(R.m[j], null); tint(R.m[j], GREEN);
  hl(8);
  say(p + ' 歸位：return j', R.str());
  await beat(tok, ms);
  kill(pt); kill(it); kill(jt);
  return j;
}

// 00:00 想法：學生依身高自己找位置
FRAG.push(['sortbari-quick-students', 'Quick sort 的想法：學生自己找位置', async (tok) => {
  fresh([0, 4, 11], [0, 1.4, 0]);
  const H = [1.6, 2.4, 1.0, 2.0, 3.0, 1.3, 1.8], C = ['#4b9ee2', '#e55a9b', '#2fc092', '#dd8238', '#9b7ef4', '#31aab0', '#c08a1f'];
  const X = (i) => -4.5 + i * 1.5;
  let line = H.map((h, i) => { const m = cube('', C[i], [0.7, h, 0.7], X(i), h / 2, 0, 1.0); m.userData.h = h; return m; });
  const place = async (moving, ms = 1600) => {
    for (const m of moving) move(m, m.position.x, m.userData.h / 2, 1.8);
    await beat(tok, ms * 0.35);
    line.forEach((m, i) => move(m, X(i), m.userData.h / 2, moving.includes(m) ? 1.8 : 0));
    await beat(tok, ms * 0.35);
    for (const m of moving) move(m, X(line.indexOf(m)), m.userData.h / 2, 0);
    await beat(tok, ms * 0.3);
  };
  say('依身高排隊：老師指定位置？', '還是學生自己找位置？');
  await beat(tok, 3000);
  say('自己找位置比較快 → quick sort', '每個人找到自己在排序後的位置');
  await beat(tok, 2600);
  const short = line[2]; glow(short, GOLD);
  say('最矮的：自己走到最前面', '不需要別人幫忙');
  line = [short].concat(line.filter((m) => m !== short)); await place([short]);
  glow(short, null);
  const tall = line.find((m) => m.userData.h === 3.0); glow(tall, GOLD);
  say('最高的：自己走到最後面', '');
  line = line.filter((m) => m !== tall).concat([tall]); await place([tall]);
  glow(tall, null);
  const me = line.find((m) => m.userData.h === 1.8); glow(me, GOLD);
  say('其他人：比我高的往後站', '比我矮的往前站');
  await beat(tok, 2000);
  const lo = line.filter((m) => m !== me && m.userData.h < 1.8), hi = line.filter((m) => m !== me && m.userData.h > 1.8);
  const movers = line.filter((m, i) => m !== me && (m.userData.h < 1.8) !== (i < line.indexOf(me)));
  line = lo.concat([me], hi); await place(movers);
  tint(me, GREEN);
  say('我就站在自己的排序位置了', '前面都比我矮、後面都比我高');
  await beat(tok, 3000);
}]);

// 02:13 什麼叫「在排序位置」
FRAG.push(['sortbari-quick-sorted-pos', '在排序位置：左邊都小、右邊都大', async (tok) => {
  fresh([0, 7, 10], [0, 0.4, 0]);
  const A = sbRow([10, 80, 90, 60, 30, 20], { z: -2.0, dx: 1.05, drop: true });
  say('10 80 90 60 30 20', '哪一個一眼就知道排好了？');
  await beat(tok, 2600);
  glow(A.m[0], GOLD);
  say('10：最小、又在最前面', '<span class="ok">10 已經在排序位置</span>');
  await beat(tok, 2800);
  say('同理：最大的在最後面也是', '其他元素還不知道');
  await beat(tok, 2400);
  const B = sbRow([4, 6, 7, 10, 16, 12, 13, 14], { z: 1.6, dx: 1.05, drop: true });
  say('4 6 7 10 16 12 13 14', '哪一個在排序位置？');
  await beat(tok, 2600);
  glow(B.m[3], GOLD);
  const gl = ghostBox('#2fc092', 3 * 1.05, 1.0, 1.1); gl.position.set(B.x(1), 0.5, 1.6);
  say('10：左邊 4 6 7 都比 10 小', '');
  await beat(tok, 2400);
  const gr = ghostBox('#dd8238', 4 * 1.05, 1.0, 1.1); gr.position.set((B.x(4) + B.x(7)) / 2, 0.5, 1.6);
  say('右邊 16 12 13 14 都比 10 大', '<span class="ok">10 在排序位置</span>，右邊自己還沒排好');
  await beat(tok, 3200);
  say('quick sort：讓元素找到排序位置', '名字叫 quick，但不是最快的排序');
  await beat(tok, 3000);
}]);

// 03:58 初始設定：l、h、∞、pivot、i、j
FRAG.push(['sortbari-quick-setup', 'Partition 的準備：∞、pivot、i、j', async (tok) => {
  fresh([0, 6, 12], [0, 1.2, 0]);
  const R = sbRow(SB_Q.slice(0, 9).concat([Infinity]), { drop: true });
  kill(R.m[9]); R.m[9] = null;
  say('quick sort：divide and conquer', '9 個元素：10 16 8 12 15 6 3 9 5');
  await beat(tok, 2600);
  R.ptr('l', 'idx', 0, -0.6); R.ptr('h', 'idx', 9, -0.6);
  say('l = low 開頭，h = high 尾端', '尾端多一格');
  await beat(tok, 2400);
  R.m[9] = cube('∞', '#d8cfc0', [0.8, 0.8, 0.8], R.x(9), 0.5, 0, 2.2);
  say('尾端放 ∞：end-of-list 標記', '像字串的 \\0；實作用最大整數');
  await beat(tok, 3000);
  glow(R.m[0], GOLD); R.ptr('pivot', 'ptr alt', 0, 2.6);
  say('第一個元素當 pivot = 10', '目標：找到 10 的排序位置');
  await beat(tok, 2800);
  const gl = ghostBox('#2fc092', 4.4, 1.0, 1.1); gl.position.set(R.x(1.5), 0.5, 0);
  const gr = ghostBox('#dd8238', 4.4, 1.0, 1.1); gr.position.set(R.x(6.5), 0.5, 0);
  say('比 10 小的到左邊，大的到右邊', '');
  await beat(tok, 2600);
  kill(gl); kill(gr);
  R.ptr('i', 'ptr', 0, 1.3); R.ptr('j', 'ptr', 9, 1.9);
  say('i 從 pivot 出發，找 > pivot', 'j 從 ∞ 出發，找 ≤ pivot → 兩個交換');
  await beat(tok, 3200);
  say('i 最遠停在 ∞，j 最遠停在 pivot', '所以不會跑出陣列');
  await beat(tok, 3000);
}]);

// 06:30 partition 過程：16↔5、12↔9、15↔3，10↔6
FRAG.push(['sortbari-quick-partition', 'Partition：10 16 8 12 15 6 3 9 5', async (tok) => {
  fresh([0, 6, 12], [0, 1.2, 0]);
  const R = sbRow(SB_Q);
  say('partitioning procedure', 'i 找 > 10、j 找 ≤ 10，找到就交換');
  await beat(tok, 2400);
  const j = await sbPart(tok, R, 0, 9, { ms: 1000 });
  const gl = ghostBox('#2fc092', j * R.dx, 1.0, 1.1); gl.position.set((R.x(0) + R.x(j - 1)) / 2, 0.5, 0);
  const gr = ghostBox('#dd8238', (8 - j) * R.dx, 1.0, 1.1); gr.position.set((R.x(j + 1) + R.x(8)) / 2, 0.5, 0);
  say('左邊都 < 10、右邊都 > 10', '兩邊還沒排好 → 各自遞迴 quick sort');
  await beat(tok, 3400);
}]);

// 09:17 partition 的程式碼
FRAG.push(['sortbari-quick-code', 'partition(l, h) 演算法', async (tok) => {
  fresh([0, 6, 12], [0, 2.4, 0]);
  const C = code(['partition(l, h)', '{ pivot = A[l]; i = l; j = h;', '  while (i < j)', '  { do { i++; } while (A[i] <= pivot);', '    do { j--; } while (A[j] > pivot);', '    if (i < j) swap(A[i], A[j]);', '  }', '  swap(A[l], A[j]);', '  return j;', '}'], 0, 6.4, 0.46, -2.5);
  const R = sbRow(SB_Q, { z: 1.8 });
  C.hl(0);
  say('把剛才的步驟寫成 partition', '參數 l、h');
  await beat(tok, 2400);
  await sbPart(tok, R, 0, 9, { ms: 640, code: C });
  C.hl(-1);
  say('i 往右、j 往左，交錯就停', 'return j = pivot 的位置');
  await beat(tok, 3000);
}]);

// 11:57 QuickSort(l, h)：遞迴，pivot 當左半邊的 ∞
FRAG.push(['sortbari-quick-recursive', 'QuickSort(l, h)：左邊用 pivot 當 ∞', async (tok) => {
  fresh([0, 6, 12], [0, 2.4, 0]);
  const C = code(['QuickSort(l, h)', '{ if (l < h)', '  { j = partition(l, h);', '    QuickSort(l, j);', '    QuickSort(j + 1, h);', '  }', '}'], 0, 6.2, 0.5, -2.5);
  const R = sbRow([6, 5, 8, 9, 3, 10, 15, 12, 16, Infinity], { z: 1.8 });
  tint(R.m[5], GREEN);
  C.hl(1);
  say('l < h：還有東西要排', '');
  await beat(tok, 2200);
  C.hl(2);
  say('partition 回傳 j：10 已歸位', R.str());
  await beat(tok, 2600);
  C.hl(3);
  let z = ghostBox('#2fc092', 6 * R.dx, 1.0, 1.1); z.position.set((R.x(0) + R.x(5)) / 2, 0.5, 1.8);
  say('左邊 QuickSort(l, j)：包含 j', '已排好的 10 當左半邊的 ∞');
  await beat(tok, 3200);
  await sbPart(tok, R, 0, 5, { ms: 340 });
  say('3 5 已就位；再 partition 9 8', '右邊的 10 當 ∞　' + R.str());
  await beat(tok, 1600);
  await sbPart(tok, R, 3, 5, { ms: 340 });
  kill(z);
  C.hl(4);
  z = ghostBox('#dd8238', 4 * R.dx, 1.0, 1.1); z.position.set((R.x(6) + R.x(9)) / 2, 0.5, 1.8);
  say('右邊 QuickSort(j + 1, h)', '尾端本來就有 ∞');
  await beat(tok, 2600);
  await sbPart(tok, R, 6, 9, { ms: 340 });
  kill(z);
  C.hl(-1);
  for (let k = 0; k < 9; k++) tint(R.m[k], GREEN);
  say('每個 pivot 都歸位 → 排好了', R.str());
  await beat(tok, 3000);
}]);
  }

  // ═══ sortlin.js ═══
  {
// ─── cxbabnqtWsk：台大林軒田 DSA「Sorting / Summary」（selection → heap → bubble → insertion → shell → merge → tree → quick） ───
// 只用 K 與 ctx。老師的例子：merge 用 6 5 4 7 8 3 1 2；quick 用 pivot 6，左堆 1 4 3 2 5、右堆 9 7 8 10，
// 掃描交換 9↔5、7↔2、8↔3，最後 6↔3（陣列 6 1 4 9 7 8 3 10 2 5 由逐字稿重建）；insertion 的 adaptive 用 2 3 4 5 6；
// shell 的間隔 10 → 5 → 2 → 1；壞資料 1..10 永遠挑第一個。其他小陣列是示意資料（老師板書沒有念出數字）。
const { V3, fresh, tag, cube, move, glow, tint, txt, code, arrow, ghostBox, line, kill, GOLD, GREEN, RED } = K;
const say = ctx.say, beat = ctx.beat, colorFor = ctx.colorFor, lab = ctx.lab;
const BLUE = '#1f3a6e', PINK = '#8a1f5a';
const LCAM = [0, 7.5, 12.5], LLOOK = [0, 2, 0];
const nOf = (v) => parseInt(String(v), 10) || 0;
// a small grey label hanging on a mesh (moves with it)
function sub(m, text, dy = 0.75) { const l = lab.label(text, 'idx'); l.position.set(0, dy, 0); m.add(l); return l; }
// a row of value cubes; R.v = values, R.m = meshes, slot i at x = R.x(i)
function lRow(vals, o = {}) {
  const dx = o.dx || 1.05, y = o.y === undefined ? 0.5 : o.y, z = o.z || 0, sz = o.sz || 0.78;
  const n = o.n || vals.length;
  const x0 = o.x0 === undefined ? -(n - 1) * dx / 2 : o.x0;
  const R = { v: vals.slice(), m: [], dx, y, z, n };
  R.x = (i) => x0 + i * dx;
  if (o.tiles !== false) for (let i = 0; i < n; i++) ctx.tile(V3(R.x(i), 0.02, z), dx * 0.9, 1.0);
  if (o.idx) for (let i = 0; i < n; i++) tag(String(i), 'idx', R.x(i), o.tiles === false ? y - 0.75 : 0.05, z + (o.tiles === false ? 0 : 0.75));
  vals.forEach((v, i) => { R.m[i] = v === null ? null : cube(v, colorFor(nOf(v)), [sz, sz, sz], R.x(i), y, z, o.drop ? 2.4 : 0); });
  R.hl = (list, c) => list.forEach((i) => { if (R.m[i]) glow(R.m[i], c); });
  R.off = () => R.m.forEach((m) => { if (m) glow(m, null); });
  R.at = (l, i, dy = 1.3) => { l.position.set(R.x(i), R.y + dy, R.z); };
  // swap two slots: one hops over the other
  R.swap = async (tok, i, j, ms = 800) => {
    const a = R.m[i], b = R.m[j], h = R.y + 1.1;
    if (a) move(a, R.x(i), h, R.z); await beat(tok, ms * 0.3);
    if (a) move(a, R.x(j), h, R.z); if (b) move(b, R.x(i), R.y, R.z); await beat(tok, ms * 0.4);
    if (a) move(a, R.x(j), R.y, R.z); await beat(tok, ms * 0.3);
    [R.m[i], R.m[j]] = [R.m[j], R.m[i]]; [R.v[i], R.v[j]] = [R.v[j], R.v[i]];
  };
  // take slot `from` out and put it at slot `to` (< from); the ones in between shift right by one
  R.rot = async (tok, from, to, ms = 1000) => {
    const a = R.m[from], av = R.v[from], h = R.y + 1.1;
    move(a, R.x(from), h, R.z); await beat(tok, ms * 0.25);
    for (let k = from - 1; k >= to; k--) { move(R.m[k], R.x(k + 1), R.y, R.z); R.m[k + 1] = R.m[k]; R.v[k + 1] = R.v[k]; await beat(tok, (ms * 0.45) / Math.max(1, from - to)); }
    R.m[to] = a; R.v[to] = av;
    move(a, R.x(to), h, R.z); await beat(tok, ms * 0.15);
    move(a, R.x(to), R.y, R.z); await beat(tok, ms * 0.15);
  };
  // rearrange slots lo..hi into the given value order (values must be a permutation of that range)
  R.arrange = async (tok, lo, order, ms = 900) => {
    const pool = []; for (let k = lo; k < lo + order.length; k++) pool.push([R.v[k], R.m[k]]);
    const h = R.y + 1.1;
    pool.forEach(([, m], k) => move(m, R.x(lo + k), h, R.z)); await beat(tok, ms * 0.3);
    order.forEach((v, k) => { const p = pool.findIndex((e) => e && e[0] === v); const [, m] = pool[p]; pool[p] = null; R.v[lo + k] = v; R.m[lo + k] = m; move(m, R.x(lo + k), h, R.z); });
    await beat(tok, ms * 0.4);
    for (let k = lo; k < lo + order.length; k++) move(R.m[k], R.x(k), R.y, R.z);
    await beat(tok, ms * 0.3);
  };
  // a translucent box over slots i..j
  R.zone = (old, c, i, j, hgt = 1.2) => { if (old) kill(old); if (j < i) return null; const g = ghostBox(c, (j - i + 1) * dx, hgt, 1.2); g.position.set((R.x(i) + R.x(j)) / 2, R.y, R.z); return g; };
  return R;
}
// one selection round: scan slots i+1.. for the minimum (strict <, so the smallest index wins), then swap or rotate it to slot i
async function selRound(tok, R, i, o = {}) {
  const ms = o.ms || 260, n = R.v.length; let m = i;
  for (let j = i + 1; j < n; j++) {
    R.off(); glow(R.m[i], GREEN); if (m !== i) glow(R.m[m], PINK); glow(R.m[j], GOLD);
    if (o.cnt) o.cnt.c++; if (o.onCmp) o.onCmp();
    await beat(tok, ms);
    if (nOf(R.v[j]) < nOf(R.v[m])) m = j;
  }
  R.off(); glow(R.m[i], GREEN); glow(R.m[m], PINK);
  await beat(tok, ms * 1.6);
  if (m !== i) { if (o.rot) await R.rot(tok, m, i, 1000); else await R.swap(tok, i, m, 800); }
  R.off(); return m;
}
// backward insertion of slot i into the sorted part (step = gap): shift bigger ones by `gap`, stop at ≤ key
async function insRound(tok, R, i, o = {}) {
  const ms = o.ms || 300, g = o.gap || 1, lo = o.lo || 0, hk = o.hk || (() => {});
  const km = R.m[i], kv = R.v[i], h = R.y + 1.1;
  glow(km, GOLD); move(km, R.x(i), h, R.z); hk('key', kv); await beat(tok, ms);
  let j = i - g;
  while (j >= lo) {
    glow(R.m[j], BLUE); if (o.cnt) o.cnt.c++; hk('cmp', R.v[j], kv); await beat(tok, ms);
    if (nOf(R.v[j]) <= nOf(kv)) { glow(R.m[j], null); break; }
    glow(R.m[j], null); move(R.m[j], R.x(j + g), R.y, R.z); R.m[j + g] = R.m[j]; R.v[j + g] = R.v[j];
    if (o.mv) o.mv.c++; hk('shift', R.v[j + g]);
    j -= g; move(km, R.x(j + g), h, R.z); await beat(tok, ms);
  }
  R.m[j + g] = km; R.v[j + g] = kv; move(km, R.x(j + g), R.y, R.z); glow(km, null); hk('place', kv, j + g); await beat(tok, ms);
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

// 19:58 Selection Sort 的想法：從 unsorted 裡叫最小的出來，跟目的地交換
FRAG.push(['sortlin-selection-swap', 'Selection Sort：叫最小的出來排隊', async (tok) => {
  fresh(LCAM, LLOOK);
  const R = lRow([5, 3, 8, 1, 6, 2], { idx: true, dx: 1.3 });
  let zone = null;
  const dst = tag('目的地', 'ptr', 0, 0, 0); R.at(dst, 0);
  say('還沒排好的人：每次叫最小的出來', '由小排到大');
  await beat(tok, 2400);
  for (let i = 0; i < R.v.length - 1; i++) {
    R.at(dst, i);
    say('在 unsorted 裡找最小的', '綠 = 目的地 a[' + i + ']、桃紅 = 目前最小');
    const m = await selRound(tok, R, i, { ms: 240 });
    zone = R.zone(zone, GREEN, 0, i);
    say(m === i ? R.v[i] + ' 已經在目的地' : '最小 ' + R.v[i] + ' 換到 a[' + i + ']', 'sorted 區多一格');
    await beat(tok, 700);
  }
  zone = R.zone(zone, GREEN, 0, R.v.length - 1);
  say('一個一個叫出來 → 排好了', '每輪：選最極端的，換到 sorted 尾端');
  await beat(tok, 2800);
}]);

// 21:12 常見實作：swap 一步到位 vs rotate 一格一格擠；linked list 就是 insertion
FRAG.push(['sortlin-selection-rotate', 'Selection 的實作：swap、rotate、linked list', async (tok) => {
  fresh(LCAM, LLOOK);
  const A = lRow([3, 8, 6, 1, 9], { y: 3.6, tiles: false, dx: 1.3 });
  const B = lRow([3, 8, 6, 1, 9], { y: 0.6, dx: 1.3 });
  tag('swap', 'ptr', -4.6, 3.6, 0); tag('rotate', 'ptr', -4.6, 0.6, 0);
  A.hl([0], GREEN); A.hl([3], PINK); B.hl([0], GREEN); B.hl([3], PINK);
  say('第一輪：目的地 3（綠）、最小 1（桃紅）', '兩種做法換到前面');
  await beat(tok, 2600);
  say('做法一：直接 swap', '1 ↔ 3，一步到位');
  await A.swap(tok, 0, 3, 1000); A.off();
  say('3 被丟到後面去了', '[1, 8, 6, 3, 9]');
  await beat(tok, 2400);
  say('做法二：rotate，一格一格往後擠', '1 拿出來，3 8 6 各往後一格');
  await B.rot(tok, 3, 0, 2200); B.off();
  say('其他人的相對順序沒變', '[1, 3, 8, 6, 9]');
  await beat(tok, 2400);
  const ar = arrow(V3(B.x(3), 2.2, 0.9), V3(B.x(0) - 0.4, 1.3, 0.9), 0x8a1f5a);
  say('Linked list：把 1 剪下、插到前面', 'insertion，不是 swap');
  await beat(tok, 2800);
  kill(ar);
  say('rotate 多花幾步，但做的事一樣', '差別在：同值的順序會不會亂（stable）');
  await beat(tok, 3000);
}]);

// 23:28 Stable：先用 final project 排、再用總成績排，同分保持原順序
FRAG.push(['sortlin-stable-twokeys', 'Stable：總成績同分，保留 final project 的順序', async (tok) => {
  fresh([0, 6, 12], [0, 1.6, 0]);
  const recs = [{ n: 'A', t: 90, f: 80, c: '#4b9ee2' }, { n: 'B', t: 85, f: 95, c: '#2fc092' }, { n: 'C', t: 90, f: 88, c: '#e2a04b' }, { n: 'D', t: 85, f: 70, c: '#b07ad0' }];
  const X = (k) => -3.6 + k * 2.4;
  recs.forEach((r, k) => { r.m = cube(r.n, r.c, [1.1, 1.1, 1.1], X(k), 0.7, 0, 2); sub(r.m, '總 ' + r.t + '／FP ' + r.f, 1.05); });
  const place = (order) => order.forEach((n, k) => { const r = recs.find((q) => q.n === n); move(r.m, X(k), 0.7, 0); });
  say('排名次：總成績高的前面', '總成績同分 → 再比 final project');
  await beat(tok, 2800);
  say('第一輪：先用 FP 排', 'FP：95 > 88 > 80 > 70');
  place(['B', 'C', 'A', 'D']); await beat(tok, 2400);
  say('第二輪：用總成績排（stable）', '總：90、90、85、85');
  await beat(tok, 1800);
  place(['C', 'A', 'B', 'D']); await beat(tok, 1600);
  glow(recs[2].m, GOLD); glow(recs[0].m, GOLD);
  say('C、A 同是 90：C 還在 A 前面', 'same key → 相對順序不動');
  await beat(tok, 2600);
  glow(recs[2].m, null); glow(recs[0].m, null); glow(recs[1].m, GOLD); glow(recs[3].m, GOLD);
  say('B、D 同是 85：B 還在 D 前面', '第一輪排好的 FP 高下沒被打亂');
  await beat(tok, 2600);
  glow(recs[1].m, null); glow(recs[3].m, null);
  say('名次：C、A、B、D', 'stable = same-valued elements 保持原順序');
  await beat(tok, 3000);
}]);

// 25:32 swap 版的 selection 會把同值的順序弄亂；rotate（insertion）版保持 stable
FRAG.push(['sortlin-selection-unstable', 'Swap 版 Selection 不 stable，rotate 版 stable', async (tok) => {
  fresh(LCAM, LLOOK);
  const A = lRow(['2A', 3, '2B', 1], { y: 3.6, tiles: false, dx: 1.5 });
  const B = lRow(['2A', 3, '2B', 1], { y: 0.6, dx: 1.5 });
  tag('swap', 'ptr', -4.4, 3.6, 0); tag('rotate', 'ptr', -4.4, 0.6, 0);
  say('2A、2B 的 key 一樣', '找最小時，同值取 index 小的');
  await beat(tok, 2400);
  say('Swap 版：最小的跳很遠去交換', '');
  for (let i = 0; i < 3; i++) await selRound(tok, A, i, { ms: 220 });
  A.hl([1, 2], RED);
  say('2B 跑到 2A 前面了', '<span class="no">unstable</span>');
  await beat(tok, 2600);
  say('Rotate 版：拿出來、其他往後擠', '');
  for (let i = 0; i < 3; i++) await selRound(tok, B, i, { ms: 220, rot: true });
  B.hl([1, 2], GREEN);
  say('2A 仍在 2B 前面', '<span class="ok">stable</span>：不 swap，改用 insertion');
  await beat(tok, 3000);
}]);

// 27:21 雙層 for loop → O(n²)；不用額外空間 → in-place
FRAG.push(['sortlin-selection-cost', 'Selection Sort：O(n²) 時間、in-place', async (tok) => {
  fresh([0, 7.5, 12.5], [0, 2.4, 0]);
  const cd = code(['for i = 0 .. n-2:          // 外層：每個位置', '  m = i', '  for j = i+1 .. n-1:      // 內層：找最小', '    if a[j] < a[m]: m = j', '  swap(a[i], a[m])'], 0, 7.0, 0.5, -2.6);
  const R = lRow([4, 2, 5, 1, 3], { dx: 1.3, z: 1.4, idx: true });
  const cnt = { c: 0 };
  const cl = tag('比較 0 次', 'ptr alt', 4.9, 2.0, 1.4);
  say('雙層 for loop', '外層掃每個位置、內層找最小');
  await beat(tok, 2600);
  for (let i = 0; i < 4; i++) {
    cd.hl(2); say('i = ' + i + '：內層比較 ' + (4 - i) + ' 次', 'n − 1 − i 次');
    await selRound(tok, R, i, { ms: 300, cnt, onCmp: () => txt(cl, '比較 ' + cnt.c + ' 次') });
    cd.hl(4); await beat(tok, 400);
  }
  cd.hl(-1); R.hl([0, 1, 2, 3, 4], GREEN);
  say('4 + 3 + 2 + 1 = 10 次', 'n(n−1)/2 → <span class="ok">O(n²)</span>');
  await beat(tok, 3000);
  R.off();
  say('只在原本的格子裡換來換去', '不需要額外空間 → <span class="ok">in-place</span>');
  await beat(tok, 3000);
}]);

// 29:02 Heap Sort = 把 unsorted pile 換成 heap 的 selection：前面 heap 區、後面 sorted 區
FRAG.push(['sortlin-heap-select', 'Heap Sort：unsorted pile 換成 heap', async (tok) => {
  fresh(LCAM, LLOOK);
  const R = lRow([9, 7, 8, 3, 5, 6, 1], { idx: true, dx: 1.25 });
  const n = R.v.length;
  let zh = R.zone(null, BLUE, 0, n - 1), zs = null;
  const lh = tag('heap 區（unsorted）', 'ptr', 0, 1.6, 0), ls = tag('sorted', 'ptr alt', 0, 1.6, 0);
  const lbl = (k) => { lh.position.set((R.x(0) + R.x(Math.max(0, k))) / 2, 1.6, 0); ls.position.set(k < n - 1 ? (R.x(k + 1) + R.x(n - 1)) / 2 : 0, 1.6, 0); ls.element.style.visibility = k < n - 1 ? '' : 'hidden'; };
  lbl(n - 1);
  say('unsorted pile 已經是 max heap', '老大壓在上面：a[0] 最大');
  await beat(tok, 2600);
  for (let k = n - 1; k > 0; k--) {
    R.off(); R.hl([0], RED);
    say('找最大不用掃：就是根 ' + R.v[0], '換到 heap 區最後面');
    await beat(tok, 700);
    await R.swap(tok, 0, k, 800);
    zh = R.zone(zh, BLUE, 0, k - 1); zs = R.zone(zs, GREEN, k, n - 1); lbl(k - 1);
    let i = 0;
    while (2 * i + 1 < k) {
      const l = 2 * i + 1, r = l + 1; let c = l; if (r < k && R.v[r] > R.v[l]) c = r;
      R.off(); R.hl([i], GOLD); R.hl(r < k ? [l, r] : [l], BLUE);
      await beat(tok, 450);
      if (R.v[c] <= R.v[i]) break;
      say(R.v[i] + ' 往下沉，' + R.v[c] + ' 浮上來', '只走一條路徑：O(log n)');
      await R.swap(tok, i, c, 600); i = c;
    }
    R.off();
  }
  zh = R.zone(zh, BLUE, 0, -1); zs = R.zone(zs, GREEN, 0, n - 1); lbl(-1); lh.element.style.visibility = 'hidden';
  say('每次找最大 O(log n)，共 n 次', '<span class="ok">O(n log n)</span>，heap 放原陣列 → in-place');
  await beat(tok, 3000);
}]);

// 36:21 Bubble Sort：每輪看相鄰兩個，大小不對就換
FRAG.push(['sortlin-bubble-pass', 'Bubble Sort：相鄰兩個比高矮', async (tok) => {
  fresh(LCAM, LLOOK);
  const R = lRow([5, 1, 4, 2, 8], { idx: true, dx: 1.4 });
  const n = R.v.length; let zone = null;
  say('排隊時：只跟隔壁比高矮', '第 1、2 個，再第 2、3 個……');
  await beat(tok, 2600);
  for (let p = 1; p < n; p++) {
    say('第 ' + p + ' 輪：一路看相鄰的兩個', '左邊比較大就交換');
    const sw = await bubblePass(tok, R, 0, n - p, 1, { ms: 420 });
    zone = R.zone(zone, GREEN, n - p, n - 1);
    if (sw === 0) { say('這一輪一次都沒換', '沒有 disordered pair → 排好了'); await beat(tok, 2400); break; }
    say('最大的浮到右邊：' + R.v[n - p], '這一輪換了 ' + sw + ' 次');
    await beat(tok, 1300);
  }
  zone = R.zone(zone, GREEN, 0, n - 1);
  say('最多掃 n 輪；只用原本的空間', '<span class="ok">in-place</span>、O(n²)');
  await beat(tok, 2800);
}]);

// 38:39 Bubble：一樣高就不換 → stable；selection 的 swap 跳很遠，所以難 stable
FRAG.push(['sortlin-bubble-stable', 'Bubble Sort：一樣高就不換 → stable', async (tok) => {
  fresh(LCAM, LLOOK);
  const R = lRow(['3A', 1, '3B', 2], { idx: true, dx: 1.6 });
  say('3A、3B 一樣高', '看 bubble 會不會把它們換掉');
  await beat(tok, 2400);
  for (let p = 1; p < 4; p++) {
    say('第 ' + p + ' 輪', '相鄰比較，左邊大才換');
    const sw = await bubblePass(tok, R, 0, 4 - p, 1, { ms: 450, onEq: async () => { say('3A、3B 一樣高：不換', '鄰居交換 + 同值不換'); await beat(tok, 1600); } });
    if (sw === 0) break;
  }
  R.hl([2, 3], GREEN);
  say('3A 仍在 3B 前面', '<span class="ok">stable</span>');
  await beat(tok, 2400);
  R.off();
  const ar = arrow(V3(R.x(3), 2.4, 0), V3(R.x(0), 2.4, 0), 0x8a1f5a);
  say('對照 Selection 的 swap：一跳好幾格', '中間若有同值的人就被跨過 → 難 stable');
  await beat(tok, 3000);
  kill(ar);
  say('只跟鄰居換，就很容易做到 stable', '');
  await beat(tok, 2400);
}]);

// 40:20 Adaptive：差不多排好時，第一輪修好兩組鄰居，第二輪沒交換就停
FRAG.push(['sortlin-bubble-adaptive', 'Bubble Sort 的 adaptive：沒交換就提早停', async (tok) => {
  fresh(LCAM, LLOOK);
  const R = lRow([1, 3, 2, 4, 5, 7, 6, 8], { idx: true, dx: 1.1 });
  const n = R.v.length; const cnt = { c: 0 }; let swaps = 0;
  const cl = tag('比較 0、交換 0', 'ptr alt', 0, 2.6, 0);
  const upd = () => txt(cl, '比較 ' + cnt.c + '、交換 ' + swaps);
  say('差不多排好：只有兩組鄰居反了', '3,2 和 7,6');
  R.hl([1, 2, 5, 6], RED); await beat(tok, 2600); R.off();
  for (let p = 1; p < n; p++) {
    say('第 ' + p + ' 輪', p === 1 ? '把那兩組換回來' : '再掃一次確認');
    const sw = await bubblePass(tok, R, 0, n - p, 1, { ms: 330, cnt, onSwap: () => { swaps++; upd(); } });
    upd();
    if (sw === 0) { say('第 ' + p + ' 輪沒有任何交換', '第 ' + (p + 1) + ' 輪起不用掃 → early stop'); await beat(tok, 2800); break; }
  }
  R.hl([0, 1, 2, 3, 4, 5, 6, 7], GREEN);
  say('原本排得越好，做得越少 → adaptive', '對照：Heap Sort 不管好壞都先重建 heap');
  await beat(tok, 3200);
}]);

// 42:07 磁帶：讀取頭只要捲一點就能換鄰居；跟 10 格外的換要捲很遠
FRAG.push(['sortlin-tape', '磁帶上的排序：鄰居交換便宜', async (tok) => {
  fresh([0, 6.5, 12], [0, 1.4, 0]);
  const R = lRow([4, 9, 2, 7, 5, 6, 1, 8, 3, 10, 12, 11], { dx: 0.95, sz: 0.68 });
  const head = ghostBox('#c08a20', 0.9, 1.4, 1.3); const hl = tag('讀取頭', 'ptr', 0, 1.9, 0);
  const put = (x) => { head.position.set(x, 0.6, 0); hl.position.set(x, 1.9, 0); };
  let pos = 4, roll = 0; put(R.x(pos));
  const rl = tag('捲動 0 格', 'ptr alt', 0, 3.0, 0);
  const goTo = async (k, ms) => { const a = R.x(pos), b = R.x(k), d = Math.abs(k - pos); await K.anim(tok, ms, (t) => put(a + (b - a) * t)); roll += d; pos = k; txt(rl, '捲動 ' + roll + ' 格'); };
  say('磁帶像捲筒衛生紙：捲到讀取頭才讀得到', '');
  await beat(tok, 2800);
  say('換鄰居：5 和 6', '讀一格、捲 1 格、再讀');
  R.hl([4, 5], GOLD); await beat(tok, 900);
  await goTo(5, 600); await R.swap(tok, 4, 5, 800); R.off();
  say('只捲了 1 格', 'neighbor swap 很便宜');
  await beat(tok, 2200);
  roll = 0; txt(rl, '捲動 0 格');
  say('換 10 格以外的：9 和 12', '捲過去 10 格、讀、再捲回來');
  R.hl([1, 10], GOLD); await goTo(1, 900); await goTo(10, 1800);
  await R.swap(tok, 1, 10, 900); await goTo(1, 1800); R.off();
  say('一次遠距交換要捲 ' + roll + ' 格', '這種媒體上 Bubble Sort 反而好用');
  await beat(tok, 3000);
}]);

// 45:38 Insertion Sort：玩撲克牌——手上一疊排好的，摸一張插到對的位置
FRAG.push(['sortlin-insert-cards', 'Insertion Sort：摸一張牌，插到對的位置', async (tok) => {
  fresh([0, 6, 12], [0, 1.6, 0]);
  const CW = [0.8, 1.2, 0.25], X = (k) => -5 + k * 1.15, HY = 0.8;
  const hand = [3, 7].map((v, k) => ({ v, m: cube(v, colorFor(v), CW, X(k), HY, 0) }));
  const pile = [5, 2, 9].map((v, k) => ({ v, m: cube(v, colorFor(v), CW, 2.6 + k * 1.15, HY, 0) }));
  tag('手上：sorted pile', 'ptr', -3.9, 2.2, 0); tag('桌上：unsorted pile', 'ptr alt', 3.75, 2.2, 0);
  say('手上的牌一直保持排好', '大老二：小的在左、大的在右');
  await beat(tok, 2600);
  while (pile.length) {
    const c = pile.shift(); glow(c.m, GOLD);
    say('隨便摸一張：' + c.v, '不用挑最小的');
    move(c.m, c.m.position.x, 3.0, 0); await beat(tok, 1000);
    let k = hand.length;
    while (k > 0 && hand[k - 1].v > c.v) k--;
    if (k > 0) glow(hand[k - 1].m, BLUE); if (k < hand.length) glow(hand[k].m, BLUE);
    say('找位置：' + (k > 0 ? hand[k - 1].v : '最前') + ' 和 ' + (k < hand.length ? hand[k].v : '最後') + ' 之間', '後面的牌往右挪');
    move(c.m, X(k), 3.0, 0); await beat(tok, 900);
    for (let q = hand.length - 1; q >= k; q--) move(hand[q].m, X(q + 1), HY, 0);
    await beat(tok, 600);
    move(c.m, X(k), HY, 0); hand.splice(k, 0, c); await beat(tok, 700);
    hand.forEach((h) => glow(h.m, null));
  }
  say('手上：2 3 5 7 9', 'sorted pile 長大、unsorted pile 變空');
  await beat(tok, 2800);
}]);

// 47:12 Insertion 的各種實作：sequential search / binary search；array 插入要往後擠，linked list 只改指標
FRAG.push(['sortlin-insert-search', 'Insertion 的實作：怎麼找位置、怎麼插', async (tok) => {
  fresh(LCAM, LLOOK);
  const R = lRow([2, 4, 5, 7, 9, 11, null], { idx: true, dx: 1.2 });
  const key = cube(8, colorFor(8), [0.78, 0.78, 0.78], 5.6, 3.4, 0);
  const cl = tag('', 'ptr alt', 0, 3.6, 0);
  const cur = tag('', 'ptr', 0, 0, 0);
  say('要把 8 插進排好的 2 4 5 7 9 11', '先找位置');
  await beat(tok, 2400);
  say('Sequential search：從頭一個一個看', '找第一個比 8 大的');
  for (let j = 0; j < 5; j++) { R.off(); R.hl([j], j === 4 ? RED : GOLD); R.at(cur, j); txt(cur, '看'); txt(cl, '比較 ' + (j + 1) + ' 次'); await beat(tok, 550); }
  say('9 > 8：位置在 a[4]', 'sequential：O(n) 次比較');
  await beat(tok, 2000);
  R.off(); txt(cur, ''); txt(cl, '');
  const lo = tag('lo', 'ptr', 0, 0, 0), hi = tag('hi', 'ptr', 0, 0, 0), md = tag('mid', 'ptr alt', 0, 0, 0);
  say('Array 可以做 binary search', '每次看中間，砍掉一半');
  let L = 0, H = 5, c = 0;
  while (L <= H) {
    const M = (L + H) >> 1; c++;
    R.at(lo, L, 1.3); R.at(hi, H, 1.9); R.at(md, M, 2.5); R.off(); R.hl([M], GOLD); txt(cl, '比較 ' + c + ' 次');
    await beat(tok, 900);
    if (R.v[M] < 8) { say('a[' + M + '] = ' + R.v[M] + ' < 8', 'lo = mid + 1'); L = M + 1; } else { say('a[' + M + '] = ' + R.v[M] + ' > 8', 'hi = mid − 1'); H = M - 1; }
    await beat(tok, 1100);
  }
  [lo, hi, md].forEach((l) => l.position.set(0, -5, 0)); R.off();
  say('位置還是 a[4]，只比 ' + c + ' 次', 'binary search：O(log n) 次比較');
  await beat(tok, 2200);
  say('但 array 插入要把後面往後擠', '11、9 各往後一格 → O(n)');
  for (let k = 5; k >= 4; k--) { move(R.m[k], R.x(k + 1), R.y, 0); R.m[k + 1] = R.m[k]; R.v[k + 1] = R.v[k]; await beat(tok, 700); }
  move(key, R.x(4), 0.5, 0); R.m[4] = key; R.v[4] = 8; await beat(tok, 1200);
  say('Linked list：插入只改指標 O(1)', '但只能從頭 sequential search');
  await beat(tok, 2800);
  say('Skip list：找得快也插得快', '可以，但要額外空間 → overkill');
  await beat(tok, 3000);
}]);

// 48:35 從前面找 vs 從後面找：遇到同值時，backward 自然 stable
FRAG.push(['sortlin-insert-forward-backward', 'Insertion：從前找 vs 從後找（stable）', async (tok) => {
  fresh(LCAM, LLOOK);
  const A = lRow([1, '3A', 5, '3B'], { y: 3.6, tiles: false, dx: 1.5 });
  const B = lRow([1, '3A', 5, '3B'], { y: 0.6, dx: 1.5 });
  tag('從前面找', 'ptr', -4.7, 3.6, 0); tag('從後面找', 'ptr', -4.7, 0.6, 0);
  say('前三張已排好，要插入 3B', '3A 先來、3B 後來');
  await beat(tok, 2600);
  say('Naive：從前面找第一個 ≥ 3 的', '');
  A.hl([3], GOLD);
  for (let j = 0; j < 2; j++) { A.hl([j], BLUE); await beat(tok, 700); A.m[j] && glow(A.m[j], null); }
  A.hl([1], RED);
  say('碰到 3A 就停 → 3B 插到它前面', '同值的人被插隊了');
  await beat(tok, 1600);
  await A.rot(tok, 3, 1, 1600); A.hl([1, 2], RED);
  say('[1, 3B, 3A, 5]：不 stable', '<span class="no">要 stable 得記得「跨過」同值</span>');
  await beat(tok, 2600); A.off();
  say('Backward：從後面往前，比 key 大才讓位', '');
  await insRound(tok, B, 3, { ms: 650 });
  B.hl([1, 2], GREEN);
  say('碰到 3A（不比 3B 大）就停', '[1, 3A, 3B, 5]：<span class="ok">stable</span>');
  await beat(tok, 3000);
}]);

// 49:32 Gnome Sort（小精靈排序）：用鄰居交換把一個元素滾到正確位置
FRAG.push(['sortlin-gnome', 'Gnome Sort：小精靈把牌一路滾回去', async (tok) => {
  fresh(LCAM, LLOOK);
  const R = lRow([3, 6, 8, 4, 2], { idx: true, dx: 1.4 });
  const gm = tag('小精靈', 'ptr alt', 0, 0, 0);
  say('Insertion 也能用鄰居交換來做', 'Gnome sort（小精靈排序）');
  await beat(tok, 2600);
  let pos = 0, guard = 0;
  while (pos < R.v.length && guard++ < 40) {
    R.at(gm, pos, 1.4); R.off();
    if (pos === 0 || R.v[pos - 1] <= R.v[pos]) {
      if (pos > 0) R.hl([pos - 1, pos], GREEN);
      say(pos === 0 ? '最左邊：往右走' : R.v[pos - 1] + ' ≤ ' + R.v[pos] + '：順序對，往右走', '');
      await beat(tok, 420); pos++;
    } else {
      R.hl([pos - 1, pos], RED);
      say(R.v[pos - 1] + ' > ' + R.v[pos] + '：交換，往左退一步', '咚咚咚，滾回去');
      await beat(tok, 300);
      await R.swap(tok, pos - 1, pos, 650); pos--;
    }
  }
  R.off(); R.hl([0, 1, 2, 3, 4], GREEN); gm.position.set(0, -5, 0);
  say('每個元素都滾到 sorted 裡的正確位置', '跟 insertion 一樣的結果、一樣 stable');
  await beat(tok, 3000);
}]);

// 50:11 Selection 把力氣花在「選」，Insertion 把力氣花在「放」
FRAG.push(['sortlin-select-vs-insert', 'Selection vs Insertion：力氣花在選還是放', async (tok) => {
  fresh(LCAM, LLOOK);
  const A = lRow([4, 1, 3, 5, 2], { y: 3.6, tiles: false, dx: 1.3 });
  const B = lRow([4, 1, 3, 5, 2], { y: 0.6, dx: 1.3 });
  tag('Selection', 'ptr', -4.9, 3.6, 0); tag('Insertion', 'ptr', -4.9, 0.6, 0);
  const ca = { c: 0 }, cb = { c: 0 };
  const la = tag('選：比較 0 次', 'ptr alt', 4.9, 4.6, 0), lb = tag('放：比較 0 次', 'ptr alt', 4.9, 1.6, 0);
  say('同一組資料、兩種想法', '');
  await beat(tok, 2000);
  say('Selection：每輪掃完 unsorted 才選得出最小', '選很累，放的位置很確定');
  for (let i = 0; i < 4; i++) await selRound(tok, A, i, { ms: 210, cnt: ca, onCmp: () => txt(la, '選：比較 ' + ca.c + ' 次') });
  A.hl([0, 1, 2, 3, 4], GREEN);
  await beat(tok, 900);
  say('Insertion：隨便拿下一張，花力氣找位置', '選很輕鬆，放要找＋挪');
  for (let i = 1; i < 5; i++) await insRound(tok, B, i, { ms: 260, cnt: cb, hk: () => txt(lb, '放：比較 ' + cb.c + ' 次') });
  B.hl([0, 1, 2, 3, 4], GREEN);
  say('兩個都是 for loop × O(n) → O(n²)', '都 reuse 原本空間（in-place）');
  await beat(tok, 3200);
}]);

// 51:21 Backward insertion 是 adaptive：2 3 4 5 6 每張只看前一張
FRAG.push(['sortlin-insert-adaptive', 'Backward Insertion 是 adaptive：2 3 4 5 6', async (tok) => {
  fresh(LCAM, LLOOK);
  const A = lRow([2, 3, 4, 5, 6], { y: 3.6, tiles: false, dx: 1.4 });
  const B = lRow([2, 3, 4, 5, 6], { y: 0.6, dx: 1.4 });
  tag('backward', 'ptr', -5.0, 3.6, 0); tag('naive（從前）', 'ptr', -5.0, 0.6, 0);
  const ca = { c: 0 };
  const la = tag('比較 0 次', 'ptr alt', 5.0, 4.6, 0), lb = tag('比較 0 次', 'ptr alt', 5.0, 1.6, 0);
  say('發到一副幾乎排好的牌：2 3 4 5 6', '一張一張掀起來');
  await beat(tok, 2600);
  say('Backward：只看前一張，比它大就放後面', '');
  for (let i = 1; i < 5; i++) await insRound(tok, A, i, { ms: 380, cnt: ca, hk: () => txt(la, '比較 ' + ca.c + ' 次') });
  say('每張只比 1 次：共 4 次', '幾乎排好 → 接近 O(n)');
  await beat(tok, 2200);
  say('Naive：從最前面開始找位置', '5 要先看 2、3、4……');
  let c = 0;
  for (let i = 1; i < 5; i++) {
    B.off(); B.hl([i], GOLD);
    for (let j = 0; j < i; j++) { glow(B.m[j], BLUE); c++; txt(lb, '比較 ' + c + ' 次'); await beat(tok, 300); }
    B.off();
  }
  say('1 + 2 + 3 + 4 = 10 次', '已經排好還是 O(n²)：不 adaptive');
  await beat(tok, 2600);
  A.hl([0, 1, 2, 3, 4], GREEN);
  say('Backward 版：排得越好越快', '<span class="ok">adaptive</span>');
  await beat(tok, 2800);
}]);

// 53:08 三個 O(n²) 怎麼選：Insertion 通常最好（stable、adaptive 都容易）
FRAG.push(['sortlin-n2-compare', '三個 O(n²) 排序怎麼選', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 2.6, 0]);
  const cols = ['Selection', 'Bubble', 'Insertion'], X = [-2.6, 0.6, 3.8];
  const rows = [['stable', ['要小心', '容易', '容易']], ['adaptive', ['不容易', '容易', '容易']], ['實務速度', ['慢', '最慢', '較快']], ['直覺好寫', ['最直覺', '直覺', '要練']]];
  const CC = { 容易: '#3e9e6e', 較快: '#3e9e6e', 最直覺: '#3e9e6e', 直覺: '#3e9e6e', 要小心: '#d8b25a', 要練: '#d8b25a', 慢: '#d8b25a', 不容易: '#c0504d', 最慢: '#c0504d' };
  cols.forEach((c, k) => tag(c, 'ptr', X[k], 5.6, 0));
  const msg = ['stable：鄰居交換、從後插入都容易', 'adaptive：bubble 提早停、backward insertion', '速度：insertion 通常比 bubble 快', '但初學者覺得 selection 最直覺'];
  const cells = [];
  for (let r = 0; r < rows.length; r++) {
    const y = 4.3 - r * 1.2; tag(rows[r][0], 'idx', -5.4, y, 0);
    rows[r][1].forEach((t, k) => cells.push(cube(t, CC[t], [2.4, 0.8, 0.6], X[k], y, 0, 1.6)));
    say(msg[r], '');
    await beat(tok, 2600);
  }
  cells.forEach((m, i) => { if (i % 3 === 2) glow(m, GOLD); });
  say('O(n²) 裡選 Insertion', '效率、簡潔度通常都比 selection 好');
  await beat(tok, 3200);
}]);

// 56:14 Backward insertion = 「借過、借過」：一個 loop 同時找位置＋往後擠
FRAG.push(['sortlin-insert-shift', 'Backward Insertion：借過、借過', async (tok) => {
  fresh([0, 7.5, 12.5], [0, 2.4, 0]);
  const cd = code(['key = a[i];  j = i - 1', 'while j >= 0 and a[j] > key:', '    a[j+1] = a[j];  j--     // 借過', 'a[j+1] = key'], 0, 6.8, 0.52, -2.6);
  const R = lRow([2, 4, 6, 8, 5], { dx: 1.4, z: 1.4, idx: true });
  say('5 要排進已經排好的 2 4 6 8', '從隊伍最後面開始');
  await beat(tok, 2400);
  await insRound(tok, R, 4, { ms: 900, hk: (s, a, b) => {
    if (s === 'key') { cd.hl(0); say('5 被選出來', 'key = 5'); }
    else if (s === 'cmp') { cd.hl(1); say(a > b ? a + ' > 5：借過！' : a + ' ≤ 5：停', 'a[j] > key ?'); }
    else if (s === 'shift') { cd.hl(2); say(a + ' 往後挪一格', 'a[j+1] = a[j]'); }
    else { cd.hl(3); say('5 站進空位', 'a[j+1] = key'); }
  } });
  cd.hl(-1); R.hl([0, 1, 2, 3, 4], GREEN);
  say('一個 loop 做完兩件事', '找到位置 ＋ 把人往後擠');
  await beat(tok, 3000);
}]);

// 77:59 標準函式庫的 sort：大堆用 quick sort 分，小堆改用 insertion sort（118:28 也講）
FRAG.push(['sortlin-hybrid', '混合排序：大堆 partition、小堆 insertion', async (tok) => {
  fresh(LCAM, LLOOK);
  const R = lRow([7, 2, 10, 5, 12, 1, 9, 4, 13, 3, 11, 8], { idx: true, dx: 0.95, sz: 0.7 });
  const TH = 5; let z = null;
  say('實務上的 sort 是混合的', '大堆 divide and conquer、小堆 local 調整');
  await beat(tok, 2600);
  const go = async (lo, hi) => {
    if (hi < lo) return;
    z = R.zone(z, hi - lo + 1 <= TH ? GREEN : BLUE, lo, hi);
    if (hi - lo + 1 <= TH) {
      say('只剩 ' + (hi - lo + 1) + ' 個：改用 insertion sort', 'recursion overhead 不划算');
      await beat(tok, 900);
      for (let i = lo + 1; i <= hi; i++) await insRound(tok, R, i, { ms: 200, lo });
      return;
    }
    const seg = R.v.slice(lo, hi + 1), p = seg[0];
    R.off(); R.hl([lo], GOLD);
    say(hi - lo + 1 + ' 個還很多：partition', 'pivot = ' + p + '，小的左、大的右');
    await beat(tok, 1100);
    const L = seg.filter((v) => v < p), G = seg.filter((v) => v > p);
    await R.arrange(tok, lo, L.concat([p], G), 1000);
    R.off(); R.hl([lo + L.length], GREEN); await beat(tok, 600);
    await go(lo, lo + L.length - 1); await go(lo + L.length + 1, hi);
  };
  await go(0, R.v.length - 1);
  z = R.zone(z, GREEN, 0, R.v.length - 1); R.off();
  say('Quick sort 混合 insertion sort', '常數考慮進去，小堆用 O(n²) 反而快');
  await beat(tok, 3000);
}]);

// 81:23 影片：Bubble Sort 與 Cocktail Shaker Sort（左右來回搖）
FRAG.push(['sortlin-cocktail', 'Cocktail Shaker：往左右兩邊的 bubble', async (tok) => {
  fresh(LCAM, LLOOK);
  const R = lRow([3, 8, 5, 1, 9, 2], { idx: true, dx: 1.3 });
  let lo = 0, hi = R.v.length - 1, zr = null, zl = null;
  say('Bubble：每輪把最大的浮到右邊', 'Cocktail：右邊搖一下、左邊搖一下');
  await beat(tok, 2600);
  while (lo < hi) {
    say('往右搖：大的浮到右邊', '');
    let sw = await bubblePass(tok, R, lo, hi, 1, { ms: 330 });
    zr = R.zone(zr, GREEN, hi, R.v.length - 1); hi--;
    if (!sw || lo >= hi) break;
    say('往左搖：小的沉到左邊', '');
    sw = await bubblePass(tok, R, lo, hi, -1, { ms: 330 });
    zl = R.zone(zl, GREEN, 0, lo); lo++;
    if (!sw) break;
  }
  zr = R.zone(zr, GREEN, 0, R.v.length - 1); if (zl) kill(zl);
  say('兩頭一起收斂 → 排好', '一樣是鄰居交換：stable、O(n²)');
  await beat(tok, 2800);
}]);

// 85:35 Q&A：insertion 的「借過」和 bubble 都是鄰居交換，但每輪保證的東西不同
FRAG.push(['sortlin-bubble-vs-insert-guarantee', 'Bubble 與 Insertion 每輪保證什麼', async (tok) => {
  fresh(LCAM, LLOOK);
  const A = lRow([4, 2, 5, 1, 3], { y: 3.6, tiles: false, dx: 1.3 });
  const B = lRow([4, 2, 5, 1, 3], { y: 0.6, dx: 1.3 });
  tag('Bubble', 'ptr', -4.9, 3.6, 0); tag('Insertion', 'ptr', -4.9, 0.6, 0);
  say('兩個都在跟鄰居換位置', '差在：一輪做完保證了什麼');
  await beat(tok, 2400);
  say('Bubble 一輪', '');
  await bubblePass(tok, A, 0, 4, 1, { ms: 330 });
  A.hl([4], GREEN);
  say('保證：最大的 5 浮到定位', '跟 selection 一樣，極值先就定位');
  await beat(tok, 2400);
  say('Insertion：借過到 1 為止', '');
  for (let i = 1; i < 4; i++) await insRound(tok, B, i, { ms: 300 });
  B.hl([0, 1, 2, 3], GOLD);
  say('保證：前面這段已排好 1 2 4 5', '但 4、5 還不是最終位置（3 還沒插）');
  await beat(tok, 3200);
}]);

// 87:13 Shell Sort：用 long jump 的 insertion，間隔 10 → 5 → 2 → 1
FRAG.push(['sortlin-shell', 'Shell Sort：間隔 10、5、2、1 的 insertion', async (tok) => {
  fresh([0, 7, 13], [0, 1.6, 0]);
  const R = lRow([14, 3, 11, 7, 16, 1, 9, 13, 5, 12, 2, 15, 8, 4, 10, 6], { idx: true, dx: 0.78, sz: 0.6 });
  const mv = { c: 0 }; const ml = tag('移動 0 次', 'ptr alt', 0, 3.4, 0);
  say('Insertion 在快排好的資料上很快', '那就先開「快車」：遠距離交換');
  await beat(tok, 2600);
  for (const g of [10, 5, 2, 1]) {
    const before = mv.c;
    const chain = []; for (let k = 0; k < R.v.length; k += g) chain.push(k);
    R.off(); R.hl(chain, BLUE);
    say('間隔 ' + g + '：' + (g > 1 ? chain.slice(0, 3).join('、') + '… 號看成一串' : '最後一般的 insertion'), '每串各做 insertion sort');
    await beat(tok, 1800); R.off();
    for (let i = g; i < R.v.length; i++) await insRound(tok, R, i, { ms: g === 1 ? 80 : 120, gap: g, mv, hk: () => txt(ml, '移動 ' + mv.c + ' 次') });
    say('間隔 ' + g + ' 做完：這輪移動 ' + (mv.c - before) + ' 次', g > 1 ? '一次可以跳 ' + g + ' 格' : '');
    await beat(tok, 1100);
  }
  R.hl(R.m.map((_, i) => i), GREEN);
  say('最後的 insertion 幾乎不用動', 'insertion sort with long jumps');
  await beat(tok, 2800);
}]);

// 90:07 Shell Sort 的性質：long jump → 不 stable；但很 adaptive；理論難分析、實務快
FRAG.push(['sortlin-shell-props', 'Shell Sort：不 stable、但很 adaptive', async (tok) => {
  fresh(LCAM, LLOOK);
  const A = lRow([3, '5A', '5B', 1], { y: 3.6, tiles: false, dx: 1.5 });
  tag('long jump', 'ptr', -4.6, 3.6, 0);
  say('同值 5A、5B，間隔 2 先做', '5A 和 1 在同一串');
  await beat(tok, 2400);
  for (const g of [2, 1]) {
    say('間隔 ' + g, g === 2 ? '1 一跳兩格，越過 5B' : '');
    for (let i = g; i < 4; i++) await insRound(tok, A, i, { ms: 420, gap: g });
  }
  A.hl([2, 3], RED);
  say('5B 跑到 5A 前面', '<span class="no">不 stable</span>：long jump 跨過了同值');
  await beat(tok, 2600);
  A.off();
  const B = lRow([1, 2, 3, 4, 5, 6, 7, 8], { y: 0.6, dx: 1.1 });
  const mv = { c: 0 }; const ml = tag('移動 0 次', 'ptr alt', 0, 1.9, 0);
  say('原本就排好的資料', '間隔 4 → 2 → 1');
  for (const g of [4, 2, 1]) for (let i = g; i < 8; i++) await insRound(tok, B, i, { ms: 90, gap: g, mv, hk: () => txt(ml, '移動 ' + mv.c + ' 次') });
  B.hl([0, 1, 2, 3, 4, 5, 6, 7], GREEN);
  say('每輪都不用動 → adaptive', '<span class="ok">最壞情形難分析，實務上比單純 insertion 快</span>');
  await beat(tok, 3200);
}]);

// 93:44 Merge Sort（bottom-up）：6 5 4 7 8 3 1 2 → 小堆 → 中堆 → 大堆
FRAG.push(['sortlin-merge-bottomup', 'Merge Sort：小堆合併成中堆、大堆', async (tok) => {
  fresh([0, 6.5, 13], [0, 3, 0]);
  const DX = 1.2, X = (i) => (i - 3.5) * DX, LY = [0.6, 2.2, 3.8, 5.4];
  let cur = [6, 5, 4, 7, 8, 3, 1, 2].map((v, i) => cube(v, colorFor(v), [0.8, 0.8, 0.8], X(i), LY[0], 0));
  let vals = [6, 5, 4, 7, 8, 3, 1, 2];
  const lvl = ['每一筆自己是一個小堆', '兩兩合併 → 中堆', '中堆合併 → 大堆', '大堆合併 → 全部排好'];
  say(lvl[0], '6 5 4 7 8 3 1 2');
  await beat(tok, 2400);
  let w = 1, ghosts = [];
  for (let L = 1; L <= 3; L++) {
    say(lvl[L], 'size ' + w + ' + ' + w + ' → ' + 2 * w);
    const nv = [], nm = [];
    for (let s = 0; s < 8; s += 2 * w) {
      let p = s, q = s + w; const pe = s + w, qe = s + 2 * w;
      while (p < pe || q < qe) {
        const takeP = q >= qe || (p < pe && vals[p] <= vals[q]);
        if (p < pe) glow(cur[p], GOLD); if (q < qe) glow(cur[q], GOLD);
        await beat(tok, 220);
        const k = takeP ? p++ : q++;
        const v = vals[k], at = nv.length;
        nv.push(v); nm.push(cube(v, colorFor(v), [0.8, 0.8, 0.8], X(at), LY[L], 0, 0.9));
        glow(cur[k], null); tint(cur[k], '#cfc6b6');
        await beat(tok, 200);
      }
      ghosts.push((() => { const g = ghostBox(GREEN, 2 * w * DX - 0.15, 1.05, 1.1); g.position.set((X(s) + X(s + 2 * w - 1)) / 2, LY[L], 0); return g; })());
    }
    cur = nm; vals = nv; w *= 2;
    await beat(tok, 900);
  }
  say('1 → 2 → 4 → 8：共 log₂ n 層', '每層合併 O(n) → <span class="ok">O(n log n)</span>');
  await beat(tok, 3000);
}]);

// 95:05 合併兩個排好的堆 = sparse array／多項式相加：兩個指標各走一遍
FRAG.push(['sortlin-merge-twoptr', 'Merge = 兩個 sparse array 合併', async (tok) => {
  fresh([0, 6.5, 12], [0, 2, 0]);
  const Lv = [5, 6], Rv = [4, 7];
  const Lm = Lv.map((v, k) => cube(v, colorFor(v), [0.85, 0.85, 0.85], -4.6 + k * 1.1, 3.4, 0));
  const Rm = Rv.map((v, k) => cube(v, colorFor(v), [0.85, 0.85, 0.85], 3.5 + k * 1.1, 3.4, 0));
  tag('x⁵ + x⁶', 'idx', -4.05, 2.6, 0); tag('x⁴ + x⁷', 'idx', 4.05, 2.6, 0);
  for (let k = 0; k < 4; k++) ctx.tile(V3(-1.65 + k * 1.1, 0.02, 0), 1.0, 1.0);
  const pp = tag('p', 'ptr', 0, 0, 0), qp = tag('q', 'ptr alt', 0, 0, 0);
  const sp = () => { pp.position.set(p < 2 ? Lm[p].position.x : -2.6, 4.4, 0); qp.position.set(q < 2 ? Rm[q].position.x : 5.6, 4.4, 0); };
  let p = 0, q = 0, k = 0; sp();
  say('排好的 5,6 和排好的 4,7 怎麼合？', '我們教過：sparse array 相加');
  await beat(tok, 2800);
  while (p < 2 || q < 2) {
    const takeP = q >= 2 || (p < 2 && Lv[p] <= Rv[q]);
    if (p < 2) glow(Lm[p], GOLD); if (q < 2) glow(Rm[q], GOLD);
    say(p < 2 && q < 2 ? '比 ' + Lv[p] + ' 和 ' + Rv[q] + '：小的先放' : '另一邊走完：剩下的照抄', '');
    await beat(tok, 1200);
    const m = takeP ? Lm[p++] : Rm[q++];
    glow(m, null); move(m, -1.65 + k * 1.1, 0.5, 0); k++; sp();
    await beat(tok, 900);
  }
  tag('x⁴ + x⁵ + x⁶ + x⁷', 'idx', 0, -0.2, 0.9);
  say('兩個指標各走完一遍', '兩堆 size 2ⁱ → 2ⁱ 的力氣，線性');
  await beat(tok, 2800);
  say('橫向：每層 merge 總共 O(n)', '縱向 log n 層 → O(n log n)');
  await beat(tok, 3000);
}]);

// 98:02 Top-down：遞迴切一半、兩半各自排好、再 merge（divide and conquer）
FRAG.push(['sortlin-merge-topdown', 'Merge Sort（top-down）：分而治之', async (tok) => {
  fresh([0, 7.5, 12.5], [0, 2.4, 0]);
  const cd = code(['msort(l, r):', '  if l >= r: return', '  m = (l + r) / 2', '  msort(l, m);  msort(m+1, r)', '  merge(l, m, r)        // O(n)'], 0, 7.0, 0.5, -2.6);
  const R = lRow([6, 5, 4, 7, 8, 3, 1, 2], { dx: 1.1, z: 1.4, idx: true });
  let z = null;
  const dl = tag('', 'ptr alt', 0, 2.5, 1.4);
  say('想排好整段：先排好左半、右半', '跟 binary search 一樣從中間切');
  await beat(tok, 2600);
  const ms = async (l, r, d) => {
    z = R.zone(z, BLUE, l, r); txt(dl, 'depth ' + d); dl.position.set((R.x(l) + R.x(r)) / 2, 2.5, 1.4);
    if (l >= r) { cd.hl(1); await beat(tok, 260); return; }
    const m = (l + r) >> 1; cd.hl(2);
    say('msort(' + l + ', ' + r + ')：切成 ' + l + '..' + m + ' 和 ' + (m + 1) + '..' + r, '兩半都要排（binary search 只走一半）');
    await beat(tok, 500);
    cd.hl(3); await ms(l, m, d + 1); await ms(m + 1, r, d + 1);
    z = R.zone(z, GREEN, l, r); cd.hl(4); txt(dl, 'merge');
    dl.position.set((R.x(l) + R.x(r)) / 2, 2.5, 1.4);
    const sorted = R.v.slice(l, r + 1).sort((a, b) => a - b);
    say('merge(' + l + '..' + r + ')：' + sorted.join(' '), 'conquer：合起來');
    await R.arrange(tok, l, sorted, 700);
  };
  await ms(0, 7, 0);
  cd.hl(-1); txt(dl, '');
  say('遞迴 log n 層、每層 merge O(n)', '<span class="ok">O(n log n)</span>；divide and conquer');
  await beat(tok, 3000);
}]);

// 99:46 Merge Sort 的性質：stable、容易平行（各堆獨立）、適合 external sort
FRAG.push(['sortlin-merge-parallel', 'Merge Sort：stable、好平行、external sort', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 2, 0]);
  const R = lRow([6, 5, 4, 7, 8, 3, 1, 2], { dx: 1.25, y: 0.6 });
  const cores = [];
  const corez = (k, i, j) => { const g = ghostBox('#c08a20', (j - i + 1) * 1.25 - 0.1, 1.3, 1.3); g.position.set((R.x(i) + R.x(j)) / 2, 0.6, 0); const l = tag('核心 ' + k, 'ptr', g.position.x, 1.8, 0); cores.push(g, l); };
  const clear = () => { cores.forEach(kill); cores.length = 0; };
  say('每一堆的工作互不相干', '可以丟給不同核心同時做');
  for (let k = 0; k < 4; k++) corez(k + 1, 2 * k, 2 * k + 1);
  await beat(tok, 2400);
  await Promise.all([R.arrange(tok, 0, [5, 6], 900), R.arrange(tok, 4, [3, 8], 900)]);
  say('4 個核心同時排好 4 個小堆', '');
  await beat(tok, 1600); clear();
  corez(1, 0, 3); corez(2, 4, 7);
  await Promise.all([R.arrange(tok, 0, [4, 5, 6, 7], 1000), R.arrange(tok, 4, [1, 2, 3, 8], 1000)]);
  say('2 個核心各合併一半', '做完再合起來就好');
  await beat(tok, 1600); clear();
  corez(1, 0, 7);
  await R.arrange(tok, 0, [1, 2, 3, 4, 5, 6, 7, 8], 1000);
  say('Heap 牽一髮動全身，很難平行', 'merge sort 容易平行化');
  await beat(tok, 2800); clear();
  const disk = ghostBox('#6e5f49', 13, 0.5, 1.6); disk.position.set(0, 3.6, -2); tag('磁碟上的大檔案', 'ptr alt', 0, 4.3, -2);
  say('External sort：資料不在記憶體', '一段段讀進來排好 → 寫回 → merge');
  await beat(tok, 3000);
  R.hl([0, 1, 2, 3, 4, 5, 6, 7], GREEN);
  say('仔細實作是 stable', '標準庫的 stable_sort 核心就是 merge sort');
  await beat(tok, 2800);
}]);

// 103:02 Tree Sort：全部塞進 Binary Search Tree，再 in-order traversal
const QV = [6, 1, 4, 9, 7, 8, 3, 10, 2, 5];
const rk = (v) => [...QV].sort((a, b) => a - b).indexOf(v);
const TX = (v) => (rk(v) - 4.5) * 1.15;
FRAG.push(['sortlin-treesort', 'Tree Sort：塞進 BST，再 in-order', async (tok) => {
  fresh([0, 6.5, 13.5], [0, 3, 0]);
  const TY = (d) => 6.3 - d * 1.3;
  const T = {};
  say('BST 本身就是排好的資料結構', '全部 insert，再做 in-order traversal');
  await beat(tok, 2600);
  for (const v of QV) {
    let p = null, cur = T.root, d = 0;
    while (cur) { glow(cur.m, GOLD); await beat(tok, 220); glow(cur.m, null); p = cur; cur = v < cur.v ? cur.l : cur.r; d++; }
    const node = { v, l: null, r: null, d, m: cube(v, colorFor(v), [0.8, 0.8, 0.8], TX(v), TY(d), 0, 1.4) };
    if (p) { line(p.m.position.x, TY(p.d), TX(v), TY(d), 0); if (v < p.v) p.l = node; else p.r = node; } else T.root = node;
    say('insert ' + v + (p ? '：接在 ' + p.v + ' 的' + (v < p.v ? '左' : '右') + '邊' : '：當 root'), '比較小往左、比較大往右');
    await beat(tok, 420);
  }
  say('In-order：左子樹 → 自己 → 右子樹', '輸出就是排好的');
  await beat(tok, 1800);
  const out = [];
  const ino = async (n) => { if (!n) return; await ino(n.l); glow(n.m, GREEN); out.push(cube(n.v, colorFor(n.v), [0.7, 0.7, 0.7], TX(n.v), 0.4, 2.8, 1.2)); await beat(tok, 380); glow(n.m, null); await ino(n.r); };
  await ino(T.root);
  say('1 2 3 … 10：排好了', '樹平衡 O(n log n)、長歪 O(n²)；要 O(n) 額外空間');
  await beat(tok, 3000);
  say('資料一直進進出出時特別好用', '例如一直加歌、刪歌的推薦清單');
  await beat(tok, 2600);
}]);

// 106:40 Quick Sort = 用「隨機 root」的 BST 做 tree sort，但不真的建樹：只分成兩堆
FRAG.push(['sortlin-quick-as-bst', 'Quick Sort：pivot 就是 BST 的 root', async (tok) => {
  fresh([0, 6.5, 13], [0, 2.6, 0]);
  const ms = QV.map((v, i) => cube(v, colorFor(v), [0.8, 0.8, 0.8], (i - 4.5) * 1.1, 0.6, 2.4));
  say('Quick sort 其實就是 tree sort', '只是不真的把樹建出來');
  await beat(tok, 2400);
  glow(ms[0], GOLD); move(ms[0], 0, 5.6, 0);
  say('抓 6 當 root（pivot）', '');
  await beat(tok, 1600);
  let nl = 0, nr = 0;
  for (let i = 1; i < QV.length; i++) {
    const v = QV[i]; glow(ms[i], BLUE); await beat(tok, 260);
    if (v < 6) move(ms[i], -5.2 + (nl++) * 0.95, 3.2, 0); else move(ms[i], 1.4 + (nr++) * 0.95, 3.2, 0);
    glow(ms[i], null); await beat(tok, 260);
  }
  const g1 = line(0, 5.6, -3.3, 3.2, 0), g2 = line(0, 5.6, 2.8, 3.2, 0);
  say('比 6 小一堆：1 4 3 2 5', '比 6 大一堆：9 7 8 10');
  await beat(tok, 2800);
  say('左堆自己去 sort ＝ 左子樹自己建 BST', '右堆同理');
  await beat(tok, 2200);
  [1, 2, 3, 4, 5].forEach((v, k) => move(ms[QV.indexOf(v)], -5.2 + k * 0.95, 3.2, 0));
  [7, 8, 9, 10].forEach((v, k) => move(ms[QV.indexOf(v)], 1.4 + k * 0.95, 3.2, 0));
  await beat(tok, 1400);
  kill(g1); kill(g2);
  QV.forEach((v, i) => move(ms[i], TX(v), 0.6, 2.4));
  glow(ms[0], GREEN);
  say('In-order：左堆、6、右堆', '兩邊排好，接起來就排好了');
  await beat(tok, 3000);
}]);

// 一棵「堆的樹」：每層把每堆的第一個（或指定的）當 pivot，左右兩堆往下一層；x = 最終排序位置
async function pileTree(tok, vals, o = {}) {
  const dy = o.dy || 1.3, top = o.top || 6.2, pick = o.pick || ((pile) => pile[0]), ms = o.ms || 900;
  const sorted = [...vals].sort((a, b) => a - b), X = (v) => (sorted.indexOf(v) - (vals.length - 1) / 2) * (o.dx || 1.1);
  const M = {}; vals.forEach((v, i) => { M[v] = cube(v, colorFor(v), [0.75, 0.75, 0.75], (i - (vals.length - 1) / 2) * (o.dx || 1.1), top, 0); });
  let level = [{ pile: vals.slice(), lo: 0, par: null }], d = 0, depth = 0;
  while (level.length) {
    const next = [];
    if (o.onLevel) await o.onLevel(d, level);
    for (const { pile, lo, par } of level) {
      const p = pick(pile); glow(M[p], GOLD);
      const L = pile.filter((v) => v < p), G = pile.filter((v) => v > p);
      if (o.onPivot) await o.onPivot(p, L, G, d);
      const y = top - d * dy;
      move(M[p], X(p), y, 0);
      L.forEach((v, k) => move(M[v], X(sorted[lo + k]), y - dy, 0));
      G.forEach((v, k) => move(M[v], X(sorted[lo + L.length + 1 + k]), y - dy, 0));
      if (par !== null) line(X(par), y + dy, X(p), y, 0);
      await beat(tok, ms);
      glow(M[p], null); tint(M[p], '#e8dcc0');
      if (L.length) next.push({ pile: L, lo, par: p });
      if (G.length) next.push({ pile: G, lo: lo + L.length + 1, par: p });
    }
    depth = d; level = next; d++;
  }
  return { M, X, depth };
}

// 109:41 模擬：6 先分兩堆；左堆不幸抓到 1（0 個 vs 4 個）；平衡時 log n 層 × 每層 n
FRAG.push(['sortlin-quick-levels', 'Quick Sort：一層一層分堆，長出一棵樹', async (tok) => {
  fresh([0, 6, 13.5], [0, 3.2, 0]);
  say('6 1 4 9 7 8 3 10 2 5', '每堆抓一個中間人（pivot）分兩堆');
  await beat(tok, 2400);
  const T = await pileTree(tok, QV, { dy: 1.3, ms: 850, onPivot: async (p, L, G) => {
    if (p === 6) say('抓 6：左 1 4 3 2 5、右 9 7 8 10', '');
    else if (p === 1) { say('左堆抓到 1：左 0 個、右 4 個', '不幸：樹長歪一邊'); await beat(tok, 1400); }
    else say('抓 ' + p + '：左 ' + L.length + ' 個、右 ' + G.length + ' 個', '');
  } });
  say('分完了：pivot 排成一棵 BST', '高度 ' + (T.depth + 1) + ' 層');
  await beat(tok, 2600);
  say('平衡時 log n 層，每層搬動 O(n)', '<span class="ok">O(n log n)</span>');
  await beat(tok, 2400);
  QV.forEach((v) => move(T.M[v], T.X(v), 0.4, 2.6));
  say('依 x 讀出來：1 2 3 … 10', 'in-order = 排好的結果');
  await beat(tok, 2800);
}]);

// 112:43 永遠挑第一個：1 2 … 10 會長成一條鍊（O(n²)）；隨機挑多半落在中間
FRAG.push(['sortlin-quick-sorted-input', 'Pivot 永遠挑第一個 vs 隨機挑', async (tok) => {
  fresh([0, 6, 13.5], [0, 3.2, 0]);
  const D = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  say('資料 1 2 3 … 10，永遠挑第一個', '');
  await beat(tok, 2200);
  await pileTree(tok, D, { dy: 0.58, top: 6.3, ms: 520, onPivot: async (p) => { say('挑 ' + p + '：左 0 個、右 ' + (10 - p) + ' 個', '每次只切掉 pivot 自己'); } });
  say('樹長成一條鍊：n 層', '<span class="no">O(n²)</span>');
  await beat(tok, 2800);
  fresh([0, 6, 13.5], [0, 3.2, 0]);
  say('改成隨機挑 pivot', '10 個裡隨便挑，多半挑到中間附近');
  await beat(tok, 2000);
  const T = await pileTree(tok, D, { dy: 1.3, ms: 800, pick: (pile) => pile[pile.length >> 1], onPivot: async (p, L, G) => { say('挑到 ' + p + '：左 ' + L.length + '、右 ' + G.length, '（示意：剛好挑到中間）'); } });
  say('只有 ' + (T.depth + 1) + ' 層：接近 log n', '隨機 pivot → 很大機率平衡');
  await beat(tok, 3000);
}]);

// 114:30 真正的 partition：i 從左掃、j 從右掃，9↔5、7↔2、8↔3，最後 6↔3
FRAG.push(['sortlin-quick-partition', 'Partition：左右兩個指標掃過來交換', async (tok) => {
  fresh(LCAM, LLOOK);
  const R = lRow(QV.slice(), { idx: true, dx: 1.15, sz: 0.74 });
  const pi = tag('i', 'ptr', 0, 0, 0), pj = tag('j', 'ptr alt', 0, 0, 0);
  R.hl([0], GOLD);
  say('pivot = 6', 'i 從左找 > 6、j 從右找 < 6');
  await beat(tok, 2400);
  const hi = R.v.length - 1, p = R.v[0];
  let i = 1, j = hi;
  while (true) {
    while (i <= hi && R.v[i] < p) { R.at(pi, i, 1.3); say(R.v[i] + ' < 6：留在左邊沒問題', ''); await beat(tok, 500); i++; }
    if (i <= hi) { R.at(pi, i, 1.3); R.hl([i], RED); say(R.v[i] + ' > 6：不該在左邊', 'i 停'); await beat(tok, 1000); }
    while (j > 0 && R.v[j] > p) { R.at(pj, j, 1.9); say(R.v[j] + ' > 6：留在右邊沒問題', ''); await beat(tok, 500); j--; }
    R.at(pj, j, 1.9); if (j > 0 && i < j) { R.hl([j], RED); say(R.v[j] + ' < 6：不該在右邊', 'j 停'); await beat(tok, 1000); }
    if (i >= j) break;
    say('交換 ' + R.v[i] + ' ↔ ' + R.v[j], 'long jump：左右各送一個過去');
    await R.swap(tok, i, j, 900); R.off(); R.hl([0], GOLD);
    i++; j--;
  }
  R.off(); R.hl([0, j], GOLD);
  say('i、j 交錯：1 4 5 2 3 都比 6 小', '8 10 7 9 都比 6 大');
  await beat(tok, 2200);
  say('6 和 3 交換', '6 站到最終位置');
  await R.swap(tok, 0, j, 1000); R.off(); R.hl([j], GREEN);
  say('左邊都 < 6、右邊都 > 6', '掃一遍 O(n)，再各自遞迴');
  await beat(tok, 3000);
}]);

// 119:31 Sorting 之間的脈絡：selection → heap → tree → quick；quick 與 merge 的 recursion
FRAG.push(['sortlin-family', 'Sorting 的脈絡：從 selection 到 quick', async (tok) => {
  fresh([0, 6, 13], [0, 3, 0]);
  const N = {};
  const node = (k, name, x, y, c) => { N[k] = { x, y, m: cube(name, c, [2.5, 0.75, 0.7], x, y, 0, 1.4) }; };
  const link = (a, b, lbl) => { const A = N[a], B = N[b]; const dx = Math.sign(B.x - A.x) * 1.3, dy = Math.sign(B.y - A.y) * 0.45; arrow(V3(A.x + (dx ? dx : 0), A.y + (dx ? 0 : dy), 0), V3(B.x - (dx ? dx : 0), B.y - (dx ? 0 : dy), 0)); tag(lbl, 'idx', (A.x + B.x) / 2 + (dx ? 0 : 1.5), (A.y + B.y) / 2 + (dx ? 0.55 : 0), 0); };
  say('每個 sorting 都是一種計算思維的巧思', '把它們串起來看');
  await beat(tok, 2400);
  node('sel', 'Selection', -5.2, 5.4, '#4b9ee2'); await beat(tok, 900);
  node('heap', 'Heap Sort', -1.75, 5.4, '#2fc092'); link('sel', 'heap', 'pile → heap');
  say('Selection 的 unsorted pile 換成 heap', '找最大變快');
  await beat(tok, 2400);
  node('tree', 'Tree Sort', 1.75, 5.4, '#e2a04b'); link('heap', 'tree', 'heap → BST');
  say('Heap 換成更嚴格的 BST', '不用 selection，in-order 就好');
  await beat(tok, 2400);
  node('quick', 'Quick Sort', 5.2, 5.4, '#b07ad0'); link('tree', 'quick', '隨機 root');
  say('BST 不真的建，只分堆', 'pivot = 隨機的 root');
  await beat(tok, 2400);
  node('merge', 'Merge Sort', 5.2, 2.6, '#c0504d'); link('quick', 'merge', 'recursion 對照');
  say('Quick：先分好再遞迴；Merge：先遞迴再合併', '兩種 divide and conquer');
  await beat(tok, 2800);
  node('ins', 'Insertion', -5.2, 2.6, '#4b9ee2'); node('shell', 'Shell Sort', -1.75, 2.6, '#2fc092'); link('ins', 'shell', 'long jump');
  node('bub', 'Bubble', -5.2, 0.8, '#e2a04b');
  say('Insertion 加上 long jump → Shell', 'Bubble 最好用的地方：教學');
  await beat(tok, 3000);
}]);

// 140:01 總結：每個 sorting 都連到學過的資料結構
FRAG.push(['sortlin-ds-links', 'Sorting 連回學過的資料結構', async (tok) => {
  fresh([0, 6, 12.5], [0, 2.9, 0]);
  const P = [['Merge Sort', 'Sparse array 合併'], ['Heap Sort', 'Heap'], ['Quick Sort', 'Binary Search Tree'], ['Insertion', 'Linked list'], ['Selection', 'Array、Heap']];
  const msg = ['merge ＝ sparse array／多項式相加', 'heap sort 用的就是 heap', 'quick sort 跟 BST 有關', 'linked list 天生適合 insertion', 'selection 連到 array 和 heap'];
  tag('Sorting', 'ptr', -3.6, 6.4, 0); tag('資料結構', 'ptr alt', 3.6, 6.4, 0);
  for (let k = 0; k < P.length; k++) {
    const y = 5.4 - k * 1.15;
    const a = cube(P[k][0], '#4b9ee2', [2.6, 0.75, 0.7], -3.6, y, 0, 1.2), b = cube(P[k][1], '#2fc092', [3.0, 0.75, 0.7], 3.6, y, 0, 1.2);
    await beat(tok, 500);
    line(-2.2, y, 2.0, y, 0, '#6a4a00'); glow(a, GOLD); glow(b, GOLD);
    say(msg[k], '');
    await beat(tok, 2000);
    glow(a, null); glow(b, null);
  }
  tag('Radix、Counting：這學期沒教，可以自己找資料', 'idx', 0, -0.5, 0.8);
  say('Radix、Counting sort 沒時間教', '有興趣自己找資料、上 forum 討論');
  await beat(tok, 3000);
}]);
  }

  // ═══ sortmit.js ═══
  {
// ─── MIT 6.006：Nz1KZXbghj8（L7 Counting Sort, Radix Sort：比較模型下界 → 整數排序）與 9bkvws_vqLU（Rec7 複習） ───
// 只用 K 與 ctx。老師的例子：L7 binary search 決策樹 n = 3（a1 < x? → a0 < x? / a2 < x?）、排序葉子 a5 a7 a1 a0 …、
// log n! 取後半段、counting 用 3 5 7 5 5 3 6（兩個 3 = 雲／愛心）；Rec7 counting 用 4 1 3 2 3（3a、3b），
// pos = 0 0 1 2 4 5，尾端放 n = 5 由右往左減；radix 用 2341 1432 2413 1243 2143 1234。
// L7 的 radix 沒有板書例子：拆位數用 2341（取自 Rec7）、選 b 的長條用 n = 16、k = 4096 示意。
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, code, anim, line, ghostBox, GOLD, GREEN, RED, GRAY } = K;
const say = ctx.say, beat = ctx.beat, colorFor = ctx.colorFor;
const BLUE = '#1f3a6e', INK = '#3a3328', PAPER = '#efe3c8', MINT = '#d4e8da';
const MCAM = [0, 7.5, 13], MLOOK = [0, 2, 0];
const mN = (v) => parseInt(String(v), 10) || 0;
const mCol = (v) => colorFor(mN(v));
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
async function mTree(tok, spec, o = {}) {
  const N = {}, P = {};
  for (const [id, t, x, y, p, side] of spec) {
    const leaf = id[0] === 'l';
    P[id] = [x, y];
    if (p) {
      const [qx, qy] = P[p];
      line(qx, qy - 0.35, x, y + 0.35);
      if (side) tag(side, 'idx', (qx + x) / 2 + (x > qx ? 0.45 : -0.45), (qy + y) / 2, 0);
    }
    N[id] = mBox(t, x, y, 0, leaf ? 2.6 : 2.2, leaf ? MINT : PAPER, o.ms ? 1.2 : 0);
    if (o.ms) { if (o.cap && o.cap[id]) say(o.cap[id][0], o.cap[id][1]); await beat(tok, o.cap && o.cap[id] ? o.ms * 2.2 : o.ms); }
  }
  N.P = P; return N;
}

// 00:22 計畫：定理（下界）、證明、「反例」（換模型就能線性）
FRAG.push(['sortmit-plan', '今天的計畫：下界與線性時間排序', async (tok) => {
  fresh([0, 6.2, 12], [0, 2, 0]);
  tag('Comparison model', 'ptr', -3.2, 4.4, 0); tag('RAM（整數）', 'ptr alt', 3.2, 4.4, 0);
  say('定理：排序最差要 n log n', '在 comparison model 裡');
  const a = cube('search Ω(log n)', PAPER, [3.6, 0.8, 1], -3.2, 0.5, 0, 3);
  await beat(tok, 2600);
  const b = cube('sort Ω(n log n)', PAPER, [3.6, 0.8, 1], -3.2, 1.4, 0, 3);
  say('兩個下界：搜尋與排序', 'binary search、merge sort 已是最佳');
  await beat(tok, 3200);
  glow(a, GOLD); glow(b, GOLD);
  await beat(tok, 1200);
  say('換到 RAM 模型：有時能線性', '不矛盾：兩個定理的模型不同');
  const c = cube('counting sort', MINT, [3.2, 0.8, 1], 3.2, 0.5, 0, 3);
  await beat(tok, 2200);
  const d = cube('radix sort', MINT, [3.2, 0.8, 1], 3.2, 1.4, 0, 3);
  await beat(tok, 2000);
  glow(c, GREEN); glow(d, GREEN);
  say('整數鍵 → O(n) 排序', '「定理、證明、反例」');
  await beat(tok, 3200);
}]);

// 01:45 Comparison model：item 是黑盒子，只能比較；cost = 比較次數
FRAG.push(['sortmit-cmp-model', 'Comparison model：只能比大小', async (tok) => {
  fresh(MCAM, MLOOK);
  const R = mRow(['?', '?', '?', '?', '?'], { color: () => INK, dx: 1.6, drop: true });
  say('每個 item 都是黑盒子', '看不到內容，只能拿兩個來比');
  await beat(tok, 2800);
  const cnt = tag('比較次數 = 0', 'ptr alt', 0, 3.4, 0);
  const ops = ['<', '≤', '>', '≥', '='], pairs = [[0, 1], [2, 3], [1, 4], [0, 3], [2, 4]], ans = ['yes', 'no', 'no', 'yes', 'no'];
  for (let k = 0; k < 5; k++) {
    const [i, j] = pairs[k];
    R.off(); R.hl([i, j], GOLD);
    const op = tag('a' + i + ' ' + ops[k] + ' a' + j + ' ?', 'ptr', (R.x(i) + R.x(j)) / 2, 1.7, 0);
    say('比較：答案只有 yes / no', '可用 <、≤、>、≥、=');
    await beat(tok, 1100);
    txt(op, 'a' + i + ' ' + ops[k] + ' a' + j + ' → ' + ans[k]);
    txt(cnt, '比較次數 = ' + (k + 1));
    await beat(tok, 1000);
    kill(op);
  }
  R.off();
  say('時間 = 比較次數', '搬動、指標操作都不收費');
  await beat(tok, 3000);
  say('Merge、Heap、BST 都只比較', '→ 都在這個模型裡；下界 Ω(n log n)');
  await beat(tok, 3200);
}]);

// 04:50 Binary search 的決策樹（n = 3）
FRAG.push(['sortmit-bs-tree', 'Binary Search 的決策樹（n = 3）', async (tok) => {
  fresh([0, 5, 13], [0, 3, 0]);
  mRow(['a0', 'a1', 'a2'], { idx: true, z: 3.2, y: 0.4, color: () => '#b9d3ea' });
  say('n = 3 的已排序陣列', '找 x 該落在哪裡');
  await beat(tok, 2200);
  await mTree(tok, BS, { ms: 900, cap: {
    r: ['第一步一定問：a1 < x ?', '圓圈 = 決策（一次比較）'],
    L: ['no：x ≤ a1，往左問 a0', 'a0 < x ?'],
    R: ['yes：x 在 a1 右邊，問 a2', 'a2 < x ?'],
    l0: ['葉子 = 找到答案', '方框 = 演算法結束'],
  } });
  say('四片葉子：x 落在四個區間', '內部節點 = 比較，葉子 = 答案');
  await beat(tok, 3200);
  say('排序也能這樣畫，但會很大', '決策樹只拿來分析，不拿來寫程式');
  await beat(tok, 3000);
}]);

// 10:28 一次執行 = 根到葉的路徑；時間 = 路徑長；最差 = 樹高
FRAG.push(['sortmit-tree-path', '執行 = 根到葉的路徑，最差 = 樹高', async (tok) => {
  fresh([0, 5, 13], [0, 3, 0]);
  const N = await mTree(tok, BS);
  say('一次執行 = 從根走到葉', 'x 在 a0 與 a1 之間');
  await beat(tok, 2400);
  const cur = tag('x', 'ptr alt', 0, 6.4, 0);
  const cost = tag('cost = 0', 'ptr', -5.2, 5.6, 0);
  glow(N.r, GOLD); say('a1 < x ?  → no', '第 1 次比較'); txt(cost, 'cost = 1');
  await beat(tok, 1800);
  await anim(tok, 900, (t) => cur.position.set(-3.2 * t, 6.4 - 1.7 * t, 0));
  glow(N.L, GOLD); say('a0 < x ?  → yes', '第 2 次比較'); txt(cost, 'cost = 2');
  await beat(tok, 1800);
  await anim(tok, 900, (t) => cur.position.set(-3.2 + 1.6 * t, 4.7 - 1.8 * t, 0));
  glow(N.l1, GREEN); say('到葉子：a0 < x ≤ a1', '執行時間 = 路徑長度 = 2');
  await beat(tok, 2800);
  ['l0', 'l1', 'l2', 'l3'].forEach((k) => glow(N[k], GREEN));
  tag('height = 2', 'ptr alt', 5.6, 3.7, 0);
  say('最差情況 = 最長路徑 = 樹高', '所以：時間下界 ⇔ 樹最矮能多矮');
  await beat(tok, 3600);
}]);

// 15:01 搜尋下界：至少 n 片葉子 → 高度 ≥ log n
FRAG.push(['sortmit-search-lb', '搜尋下界：n 片葉子 → 高度 ≥ log n', async (tok) => {
  fresh([0, 5, 13], [0, 3, 0]);
  say('決策樹是二元樹', '每次比較只有 yes / no');
  await beat(tok, 2200);
  const Y = [5.6, 4.4, 3.2, 1.9], W = 11.2, pos = [];
  const lv = [], leaves = [];
  for (let d = 0; d < 4; d++) {
    const c = 1 << d; pos[d] = [];
    for (let i = 0; i < c; i++) {
      const x = ((i + 0.5) / c - 0.5) * W; pos[d][i] = x;
      if (d) line(pos[d - 1][i >> 1], Y[d - 1] - 0.3, x, Y[d] + 0.3);
      const nd = cube(d === 3 ? 'x=a' + i : '', d === 3 ? MINT : PAPER, d === 3 ? [1.2, 0.6, 0.7] : [0.7, 0.6, 0.7], x, Y[d], 0, 1);
      if (d === 3) leaves.push(nd);
    }
    lv[d] = tag(c + ' 個', 'idx', 6.4, Y[d], 0);
    say('第 ' + d + ' 層最多 ' + c + ' 個節點', '每往下一層最多 ×2');
    await beat(tok, 1400);
  }
  say('答案至少 n 種 → 至少 n 片葉子', 'x 可能等於 n 個 item 中任一個');
  await beat(tok, 3000);
  leaves.forEach((m) => glow(m, GREEN));
  say('高度 h 的樹最多 2ʰ 片葉子', '2ʰ ≥ n ⇒ h ≥ log₂ n');
  await beat(tok, 3200);
  say('搜尋需要 Ω(log n) 次比較', '<span class="ok">binary search／BST 已是最佳</span>');
  await beat(tok, 3200);
}]);

// 21:25 排序的決策樹：內部節點 aᵢ < aⱼ ?，葉子是排列；n! 片葉子
FRAG.push(['sortmit-sort-leaves', '排序的決策樹：葉子是排列', async (tok) => {
  fresh([0, 5, 13], [0, 3, 0]);
  const r = mBox('ai < aj ?', 0, 5.4, 0, 2.2, PAPER, 1.2);
  say('內部節點：aᵢ < aⱼ ?', '交換不出現在樹上，只看比較');
  await beat(tok, 2600);
  line(-0.5, 5.05, -3, 4.15); line(0.5, 5.05, 3, 4.15);
  tag('no', 'idx', -1.9, 4.75, 0); tag('yes', 'idx', 1.9, 4.75, 0);
  const lf = mBox('a5 ≤ a7 ≤ a1 ≤ a0 ≤ …', -3, 3.8, 0, 4.2, MINT, 1.2);
  say('葉子：直接寫出排好的順序', '例：a5 最小、再來 a7、a1、a0…');
  await beat(tok, 3200);
  kill(lf);
  const perms = ['a0 a1 a2', 'a0 a2 a1', 'a1 a0 a2', 'a1 a2 a0', 'a2 a0 a1', 'a2 a1 a0'];
  const cnt = tag('葉子 ≥ 0', 'ptr alt', 0, 0.6, 2);
  for (let i = 0; i < 6; i++) {
    mBox(perms[i], -5.25 + i * 2.1, 1.9, 0, 1.9, MINT, 1.5);
    txt(cnt, '葉子 ≥ ' + (i + 1));
    say('n = 3：每種排列都要有葉子', '共 3! = 6 種');
    await beat(tok, 750);
  }
  await beat(tok, 1200);
  say('葉子數 ≥ n!（所有排列）', '元素都不同時，最壞情況');
  await beat(tok, 2800);
  say('高度 ≥ log₂(n!)', 'n = 3：⌈log₂ 6⌉ = 3 次比較');
  await beat(tok, 3200);
}]);

// 24:46 log n! = Σ log i ≥ (n/2)·log(n/2) = Ω(n log n)；Stirling 給出 n log n − O(n)
FRAG.push(['sortmit-logfact', 'log n! = Σ log i = Ω(n log n)', async (tok) => {
  fresh([0, 4.5, 12.5], [0, 2.2, 0]);
  const n = 16, dx = 0.72, x0 = -(n - 1) * dx / 2, S = 1.1, bars = [];
  say('log n! = log n + … + log 1', 'log 乘積 = log 的總和 = Σ log i');
  for (let i = 1; i <= n; i++) {
    const h = Math.max(0.06, Math.log2(i) * S);
    bars[i] = cube(null, i >= n / 2 ? '#4b9ee2' : '#9fc4e6', [0.6, h, 0.6], x0 + (i - 1) * dx, h / 2, 0);
    tag(String(i), 'idx', x0 + (i - 1) * dx, 0.05, 0.6);
    await beat(tok, 140);
  }
  tag('n = 16', 'ptr', -5.6, 5.2, 0);
  await beat(tok, 1600);
  const top = ghostBox(GOLD, n * dx, 0.05, 0.7); top.position.set(0, 4 * S, 0);
  say('每項 ≤ log n：上界 n log n 很簡單', '要證的是「至少」n log n');
  await beat(tok, 3000);
  kill(top);
  for (let i = 1; i < n / 2; i++) tint(bars[i], GRAY);
  say('丟掉前一半的項', 'Σ_{i=1..n} ≥ Σ_{i=n/2..n} log i');
  await beat(tok, 2800);
  const half = ghostBox(GREEN, (n / 2 + 1) * dx, 3 * S, 0.75);
  half.position.set(x0 + (n / 2 - 1) * dx + (n / 2) * dx / 2, 1.5 * S, 0);
  say('後一半每項 ≥ log(n/2)', 'log(n/2) = log n − 1');
  await beat(tok, 3000);
  say('≥ (n/2)·(log n − 1)', '= Ω(n log n)：排序下界得證');
  await beat(tok, 3200);
  say('Stirling：n! ≈ √(2πn)(n/e)ⁿ', 'log n! = n log n − O(n)，常數其實是 1');
  await beat(tok, 3400);
}]);

// 29:53 回顧：搜尋（已前處理）Ω(log n)；沒前處理其實要 n，但這招只證得到 log n；排序 Ω(n log n)
FRAG.push(['sortmit-lb-recap', '下界回顧：前處理與「不一定緊」', async (tok) => {
  fresh([0, 5.5, 12], [0, 2, 0]);
  const rows = [
    ['search（已前處理）', 'Ω(log n)：緊', GREEN, '前處理免費，只算 x 與 item 的比較'],
    ['search（沒前處理）', '實際要 n；樹只證到 log n', GOLD, '下界正確，但不一定緊'],
    ['sort（沒前處理）', 'Ω(n log n)：緊', GREEN, '前處理過就 0 次比較了'],
  ];
  for (let r = 0; r < 3; r++) {
    const y = 4.2 - r * 1.6;
    const a = mBox(rows[r][0], -3, y, 0, 4.4, PAPER, 1.5);
    await beat(tok, 900);
    const b = mBox(rows[r][1], 3, y, 0, 4.6, MINT, 1.5);
    glow(b, rows[r][2]);
    say(rows[r][0], rows[r][3]);
    await beat(tok, 3000);
  }
  say('框架：樹是二元 → 數葉子 → 取 log', '只是下界，不保證就是答案');
  await beat(tok, 3400);
}]);

// 31:53 離開 comparison model：整數排序（key 是 0..k−1 的整數、放得進一個 word）
FRAG.push(['sortmit-integer-model', '整數排序：key 是 0..k−1 的整數', async (tok) => {
  fresh([0, 6.5, 12], [0, 1.5, 0]);
  const k = 8, dx = 1.25, x0 = -(k - 1) * dx / 2;
  for (let i = 0; i < k; i++) { ctx.tile(V3(x0 + i * dx, 0.02, 0), dx * 0.9, 1); tag(i === k - 1 ? 'k−1' : String(i), 'idx', x0 + i * dx, 0.05, 0.75); }
  say('RAM：記憶體是陣列，O(1) 存取', '不再只有比較');
  await beat(tok, 2600);
  say('n 個 key，都是 0..k−1 的整數', 'k 是新的參數（和 n 一樣）');
  const keys = [3, 5, 7, 5, 5, 3, 6], hgt = {};
  for (const v of keys) { hgt[v] = (hgt[v] || 0) + 1; cube(v, mCol(v), [0.8, 0.6, 0.8], x0 + v * dx, 0.32 + (hgt[v] - 1) * 0.62, 0, 2.5); await beat(tok, 450); }
  await beat(tok, 1000);
  const w = ghostBox(GOLD, 6.4, 0.9, 1.1); w.position.set(0, 3.2, 0);
  tag('一個 word', 'ptr alt', -3.9, 3.2, 0);
  say('每個 key 放得進一個 word', '+ − × ÷ mod 都是 O(1)');
  await beat(tok, 3000);
  kill(w);
  say('k 不太大 → 可以線性時間排序', '研究前沿：O(n√(log log n))，猜想是 O(n)');
  await beat(tok, 3400);
}]);

// ── counting sort with counters: input → count[v]++ → write each value count[v] times ──
async function mCountBasic(tok, vals, k, cap) {
  fresh([0, 8.5, 11], [0, 0.6, 0.4]);
  const n = vals.length;
  const A = mRow(vals, { z: -2.6, idx: true, name: 'A', drop: true });
  const C = mRow(Array(k).fill('0'), { z: 0.6, idx: true, name: 'count', color: () => PAPER, sz: [0.8, 0.4, 0.8], y: 0.25, dx: Math.min(1.1, 11 / k) });
  const cnt = Array(k).fill(0);
  say(cap[0], cap[1]);
  await beat(tok, 2600);
  for (let j = 0; j < n; j++) {
    const v = mN(vals[j]);
    A.off(); C.off(); A.hl([j], GOLD); glow(C.m[v], GOLD);
    cnt[v]++; relabel(C.m[v], cnt[v]);
    say('看到 ' + v + ' → count[' + v + ']++', 'count[' + v + '] = ' + cnt[v]);
    await beat(tok, 950);
  }
  A.off(); C.off();
  say('數完了：依 index 由小到大輸出', '0 的格子直接跳過');
  await beat(tok, 2400);
  const O = mRow(Array(n).fill(null), { z: 3.4, idx: true, name: 'out' });
  let w = 0;
  for (let v = 0; v < k; v++) {
    C.off(); glow(C.m[v], cnt[v] ? GREEN : GRAY);
    if (!cnt[v]) { await beat(tok, 260); continue; }
    say('count[' + v + '] = ' + cnt[v] + '：寫 ' + cnt[v] + ' 個 ' + v, '');
    for (let c = 0; c < cnt[v]; c++) { O.m[w] = cube(v, mCol(v), [0.8, 0.8, 0.8], O.x(w), O.y, O.z, 2); w++; await beat(tok, 450); }
    await beat(tok, 400);
  }
  C.off();
  say(cap[2], cap[3]);
  await beat(tok, 3200);
}
// ── counting sort with lists: L[key].append(item) → concatenate; items keep their identity (stable) ──
async function mCountLists(tok, vals, k, cap, withCode) {
  fresh([0, 9, 11], [0, 1.4, 0.6]);
  const n = vals.length, dx = Math.min(1.25, 11 / k);
  let P = null;
  if (withCode) P = code(['L = [[] for i in range(k)]', 'for j in range(n):', '    L[key(A[j])].append(A[j])', 'out = []', 'for i in range(k):', '    out.extend(L[i])'], 0, 6.7, 0.48, -3.6);
  const A = mRow(vals, { z: -2.2, idx: true, name: 'A', drop: true });
  const B = mRow(Array(k).fill(null), { z: 0.4, idx: true, name: 'L', dx });
  say(cap[0], cap[1]);
  if (P) P.hl(0);
  await beat(tok, 2600);
  const lists = Array.from({ length: k }, () => []);
  if (P) P.hl(2);
  for (let j = 0; j < n; j++) {
    const v = mN(vals[j]), m = A.m[j];
    glow(m, GOLD);
    say('L[' + v + '].append(' + vals[j] + ')', 'append 到串列尾端：O(1)');
    await beat(tok, 600);
    move(m, B.x(v), 0.45, 0.4 + lists[v].length * 0.95);
    lists[v].push(m); A.m[j] = null;
    await beat(tok, 750);
    glow(m, null);
  }
  say(cap[2], cap[3]);
  await beat(tok, 2600);
  if (P) P.hl(5);
  const O = mRow(Array(n).fill(null), { z: 4.3, idx: true, name: 'out', tiles: true });
  let w = 0;
  for (let v = 0; v < k; v++) {
    if (!lists[v].length) continue;
    say('out.extend(L[' + v + '])', '串列裡的順序 = 原本出現的順序');
    for (const m of lists[v]) { glow(m, GREEN); move(m, O.x(w), O.y, O.z); w++; await beat(tok, 600); glow(m, null); }
  }
  if (P) P.hl(-1);
  say(cap[4], cap[5]);
  await beat(tok, 3200);
}

// 36:50 Counting Sort 的直覺：3 5 7 5 5 3 6 → 數每個值有幾個
FRAG.push(['sortmit-count-357', 'Counting Sort：數一數 3 5 7 5 5 3 6', async (tok) => {
  await mCountBasic(tok, [3, 5, 7, 5, 5, 3, 6], 8, ['開一個大小 k 的計數陣列', 'k 種可能的 key → k 個計數器', '兩個 3、三個 5、一個 6、一個 7', '<span class="ok">只排整數可以，但帶不走其他資料</span>']);
}]);

// 39:26 帶著衛星資料：每格改成 list（雲朵 3、愛心 3）
FRAG.push(['sortmit-count-lists', 'Counting Sort（list 版）：帶著整筆資料', async (tok) => {
  await mCountLists(tok, ['3☁', 5, 7, 5, 5, '3♥', 6], 8, ['key 之外還有別的資料', '像試算表依一欄排序，整列跟著走', '每個 item 都放進自己的串列', '放的是整個 item，不只是 key', '雲朵 3 仍在愛心 3 前面', '<span class="ok">list 版 counting sort（穩定）</span>'], true);
}]);

// 42:18 時間分析：建 k 個空 list O(k)、n 次 append O(n)、串接 Σ(|Lᵢ| + 1) → O(n + k)
FRAG.push(['sortmit-count-time', 'Counting Sort 的時間：O(n + k)', async (tok) => {
  fresh([0, 8, 11], [0, 1, 0.6]);
  const k = 8, vals = [3, 5, 7, 5, 5, 3, 6], dx = 1.25, x0 = -(k - 1) * dx / 2;
  const steps = tag('步數 = 0', 'ptr alt', 0, 4.6, 0);
  let s = 0;
  const T = [];
  for (let i = 0; i < k; i++) {
    T[i] = cube('[]', PAPER, [1, 0.25, 1], x0 + i * dx, 0.15, -1.6);
    s++; txt(steps, '步數 = ' + s);
    say('建 k 個空 list', '每個 O(1) → O(k)');
    await beat(tok, 300);
  }
  await beat(tok, 1400);
  const L = Array.from({ length: k }, () => []);
  for (const v of vals) {
    L[v].push(cube(v, mCol(v), [0.8, 0.6, 0.8], x0 + v * dx, 0.45, -0.6 + L[v].length * 0.85, 2));
    s++; txt(steps, '步數 = ' + s);
    say('n 次 append', '每次 O(1) → O(n)');
    await beat(tok, 450);
  }
  await beat(tok, 1400);
  const cur = tag('▼', 'ptr', x0, 1.5, -1.6);
  let t = 0;
  for (let i = 0; i < k; i++) {
    cur.position.set(x0 + i * dx, 1.5, -1.6); glow(T[i], GOLD);
    t += L[i].length + 1;
    say('串接：看 L[' + i + ']，花 |L[' + i + ']| + 1', '空的 list 也要看一眼');
    await beat(tok, 650); glow(T[i], null);
  }
  txt(steps, '串接 = ' + t + ' = n + k = 7 + 8');
  say('Σ(|Lᵢ| + 1) = n + k', '<span class="ok">counting sort = O(n + k)</span>');
  await beat(tok, 3000);
  say('k = O(n) 才是線性；k 大就慢', '所以只是暖身 → radix sort');
  await beat(tok, 3000);
}]);

// 44:31 Radix Sort 的想法：拆成 base b 的 d 位數，從最低位排到最高位（像試算表依欄排序）
FRAG.push(['sortmit-radix-idea', 'Radix Sort：拆位數、從最低位排', async (tok) => {
  fresh([0, 6, 12], [0, 2, 0]);
  say('目標：k 到 nᶜ 也能線性', '例如 key 在 0 … n¹⁰⁰');
  await beat(tok, 2800);
  const D = ['2', '3', '4', '1'], X = [-2.4, -0.8, 0.8, 2.4], m = [];
  for (let i = 0; i < 4; i++) { m[i] = cube(D[i], '#b9d3ea', [1.2, 1.2, 1.2], X[i], 0.7, 0, 2.4); tag('digit ' + (3 - i), 'idx', X[i], 0.05, 0.95); }
  say('每個整數寫成 base b 的 d 位數', 'd = log_b k（+1）');
  await beat(tok, 3200);
  const order = ['最低位', '次低位', '…', '最高位'];
  for (let r = 0; r < 4; r++) {
    m.forEach((c) => glow(c, null)); glow(m[3 - r], GOLD);
    say('第 ' + (r + 1) + ' 回合：依' + order[r] + '排序', '每回合都排「全部」整數');
    await beat(tok, 1700);
  }
  m.forEach((c) => glow(c, null));
  say('像試算表：先點最次要的欄', '再依序點到最重要的欄 → 全部排好');
  await beat(tok, 3200);
  say('每一回合用 counting sort', 'd 回合');
  await beat(tok, 2600);
}]);

// 48:01 每位數的 key 函式 O(1)：(x // bⁱ) mod b；每回合 counting sort O(n + b)
FRAG.push(['sortmit-radix-digit', '取第 i 位：(x // bⁱ) mod b', async (tok) => {
  fresh([0, 6, 12], [0, 2, 0]);
  const D = ['2', '3', '4', '1'], X = [-2.4, -0.8, 0.8, 2.4], m = [];
  for (let i = 0; i < 4; i++) m[i] = cube(D[i], '#b9d3ea', [1.2, 1.2, 1.2], X[i], 0.7, 0, 2.4);
  tag('x = 2341，b = 10', 'ptr', 0, 2.4, 0);
  say('不用先轉成 base b', '需要哪一位就當場算');
  await beat(tok, 2600);
  const f = ['2341 mod 10 = 1', '(2341 // 10) mod 10 = 4', '(2341 // 100) mod 10 = 3', '(2341 // 1000) mod 10 = 2'];
  for (let i = 0; i < 4; i++) {
    m.forEach((c) => glow(c, null)); glow(m[3 - i], GOLD);
    say('第 ' + i + ' 位：一次除法、一次 mod', f[i]);
    await beat(tok, 2000);
  }
  m.forEach((c) => glow(c, null));
  say('key 函式 O(1) → 每回合 O(n + b)', '位數都在 0..b−1，用 counting sort');
  await beat(tok, 3000);
  say('d 回合：O((n + b)·d)', 'd = log_b k → O((n + b)·log_b k)');
  await beat(tok, 3200);
}]);

// 49:51 選 b：b 大位數少，但 b 超過 n 就虧 → b = Θ(n)，O(n·log_n k)；k ≤ nᶜ → O(cn)
FRAG.push(['sortmit-radix-b', '選 b = Θ(n)：O(n·log_n k)', async (tok) => {
  fresh([0, 4.5, 12.5], [0, 2.4, 0]);
  const n = 16, k = 4096, bs = [2, 4, 8, 16, 64, 256], X = [-5, -3, -1, 1, 3, 5], bars = [];
  tag('n = 16，k = 4096', 'ptr', -4.6, 5.6, 0);
  say('cost = (n + b)·log_b k', '想讓它最小：b 該多大？');
  await beat(tok, 2800);
  for (let i = 0; i < bs.length; i++) {
    const c = (n + bs[i]) * Math.log(k) / Math.log(bs[i]), h = c / 85;
    bars[i] = cube(null, '#4b9ee2', [1.2, h, 1], X[i], h / 2, 0);
    tag('b=' + bs[i], 'idx', X[i], 0.05, 0.8); tag(String(Math.round(c)), 'idx', X[i], h + 0.3, 0);
    say('b = ' + bs[i] + ' 的成本', '(' + n + ' + ' + bs[i] + ')·log_' + bs[i] + ' 4096 = ' + Math.round(c));
    await beat(tok, 1300);
  }
  glow(bars[2], GREEN); glow(bars[3], GREEN);
  say('b 太小位數多；b 超過 n 就虧', '兩項相等時最小 → b = Θ(n)');
  await beat(tok, 3200);
  say('O(n·log_n k)', '老師一度寫成 log_b n，更正為 log_b k');
  await beat(tok, 2600);
  say('k ≤ nᶜ → O(c·n)', '<span class="ok">key 是 n 的多項式 → 線性時間</span>');
  await beat(tok, 3200);
}]);

// ───────────── Rec7 ─────────────
// 00:21 學過的五種排序：時間、Θ(n) 下限、in place
FRAG.push(['sortmit-rec-roster', '五種排序：時間與 in place', async (tok) => {
  fresh([0, 6, 12.5], [0, 2, 0]);
  const names = ['Insertion', 'Merge', 'Heap', 'Counting', 'Radix'], T = ['O(n²)', 'O(n log n)', 'O(n log n)', 'O(n + k)', 'O(d(n + k))'];
  const X = [-5.2, -2.6, 0, 2.6, 5.2], m = [];
  for (let i = 0; i < 5; i++) { m[i] = mBox(names[i], X[i], 0.4, 0, 2.3, PAPER, 2); await beat(tok, 450); }
  say('從「最笨」到「最聰明」', 'insertion、merge、heap、counting、radix');
  await beat(tok, 2400);
  const f = ghostBox(GREEN, 13, 0.05, 1.2); f.position.set(0, 1.0, 0);
  say('最好也只能 Θ(n)', '輸出就要寫 n 個元素');
  await beat(tok, 3000);
  for (let i = 0; i < 3; i++) { tag(T[i], 'ptr', X[i], 1.5, 0); await beat(tok, 700); }
  glow(m[2], GOLD);
  say('Heap：n 次 insert／extract', '每次 O(h) = O(log n) → O(n log n)');
  await beat(tok, 3200);
  glow(m[2], null);
  tag('in place', 'ptr alt', X[0], 2.2, 0); tag('不是 in place', 'idx', X[1], 2.2, 0); tag('in place', 'ptr alt', X[2], 2.2, 0);
  say('Heap in place，Merge 不是', 'in-place merge sort 存在，但太難不教');
  await beat(tok, 3400);
  [0, 1, 2].forEach((i) => glow(m[i], BLUE));
  say('前三種有什麼共同點？', '都只用比較 → comparison model');
  await beat(tok, 3000);
}]);

// 05:42 Python 讓自訂物件能比較：__cmp__（Py2）或 __lt__ __le__ __gt__ __ge__ __eq__ __ne__
FRAG.push(['sortmit-rec-python-cmp', 'Python：讓物件支援比較運算', async (tok) => {
  fresh([0, 5.5, 12], [0, 3, 0]);
  const P = code(['class Key:', '  def __cmp__(self, other):  # Py2：<0 / 0 / >0', '  def __lt__(self, other):   # <', '  def __le__(self, other):   # <=', '  def __gt__(self, other):   # >', '  def __ge__(self, other):   # >=', '  def __eq__(self, other):   # ==', '  def __ne__(self, other):   # !='], -0.6, 6.4, 0.55, -1);
  say('自己的物件也想丟進 merge sort', '只要它會「比較」就行');
  await beat(tok, 2600);
  P.hl(1); say('舊寫法：__cmp__（只有 Python 2）', '回傳 <0、0、>0；新程式別用');
  await beat(tok, 3000);
  for (let i = 2; i <= 5; i++) { P.hl(i); say('新寫法：一個運算子一個方法', '回傳 True / False'); await beat(tok, 1100); }
  P.hl(6); say('順便定義 __eq__、__ne__', '== 與 !=');
  await beat(tok, 1800); P.hl(7); await beat(tok, 1000);
  P.hl(-1);
  const a = cube('k1', '#b9d3ea', [0.9, 0.9, 0.9], -1.2, 0.5, 2.2, 2), b = cube('k2', '#b9d3ea', [0.9, 0.9, 0.9], 1.2, 0.5, 2.2, 2);
  glow(a, GOLD); glow(b, GOLD);
  const op = tag('k1 < k2  →  k1.__lt__(k2)', 'ptr alt', 0, 1.6, 2.2);
  say('k1 < k2 會呼叫 __lt__', 'insertion、merge、heap、BST、AVL 全都能用');
  await beat(tok, 3400);
  txt(op, '但仍卡在 Ω(n log n)');
  say('缺點：逃不出 n log n', '→ 要打開盒子看內容（整數 key）');
  await beat(tok, 3200);
}]);

// 08:58 Counting Sort：4 1 3 2 3，count 陣列 index 0..5
FRAG.push(['sortmit-rec-count-basic', 'Counting Sort：4 1 3 2 3', async (tok) => {
  await mCountBasic(tok, [4, 1, 3, 2, 3], 6, ['假設 key 是 0..k−1 的整數', '這裡 k = 6：count[0..5] 先全設 0', '輸出 1 2 3 3 4', '<span class="ok">排好了，但兩個 3 是誰？</span>']);
}]);

// 11:39 穩定性：3a、3b → 每格改成 linked list
FRAG.push(['sortmit-rec-count-lists', '要穩定：每格改成 linked list', async (tok) => {
  await mCountLists(tok, [4, 1, '3a', 2, '3b'], 6, ['穩定：相等的 key 保持輸入順序', '只存計數就分不出 3a、3b', '每格存一條 linked list', '3 的串列：3a → 3b', '輸出 1 2 3a 3b 4', '<span class="ok">穩定</span>；但 C 裡沒有現成 linked list'], false);
}]);

// 13:03 不用 linked list：3a 該放在「比 3 小的 key 有幾個」那一格
FRAG.push(['sortmit-rec-pos-meaning', 'pos[v] = 比 v 小的 key 有幾個', async (tok) => {
  fresh([0, 8.5, 11], [0, 0.6, 0.4]);
  const vals = [4, 1, '3a', 2, '3b'];
  const A = mRow(vals, { z: -2.6, idx: true, name: 'A', drop: true });
  const O = mRow(Array(5).fill(null), { z: 3.2, idx: true, name: 'out' });
  say('輸出陣列有 5 格：誰放哪一格？', '想看到 key 就知道它的位置');
  await beat(tok, 2800);
  const cases = [[2, [1, 3], 2], [0, [1, 2, 3, 4], 4]];
  for (const [j, sm, p] of cases) {
    A.off(); A.hl([j], GOLD); A.hl(sm, BLUE);
    say(vals[j] + '：比它小的有 ' + p + ' 個', '→ 放在 out[' + p + ']');
    await beat(tok, 2600);
    const c = cube(vals[j], mCol(vals[j]), [0.8, 0.8, 0.8], O.x(p), O.y, O.z, 2);
    glow(c, GREEN);
    await beat(tok, 1600);
  }
  A.off();
  const pos = [0, 0, 1, 2, 4, 5];
  const PR = mRow(Array(6).fill(null), { z: 0.4, idx: true, name: 'pos' });
  for (let v = 0; v < 6; v++) {
    PR.m[v] = cube(pos[v], PAPER, [0.8, 0.5, 0.8], PR.x(v), 0.3, 0.4, 1.5);
    say('pos[' + v + '] = 比 ' + v + ' 小的個數', '= ' + pos[v]);
    await beat(tok, 1000);
  }
  PR.hl([3, 4], GOLD);
  say('pos[4] − pos[3] = 2 = 3 的個數', '相鄰兩格的差 = count');
  await beat(tok, 3200);
}]);

// 19:14 由左往右算 pos：running sum，原地覆寫需要 temp
FRAG.push(['sortmit-rec-pos-forward', '原地算 pos：running sum ＋ temp', async (tok) => {
  fresh([0, 6, 11.5], [0, 1.5, 0]);
  const P = code(['sum = 0', 'for i in range(k):', '    temp = pos[i]', '    pos[i] = sum', '    sum = sum + temp'], 0, 5.6, 0.5, -2.5);
  const R = mRow([0, 1, 1, 2, 1, 0], { idx: true, name: 'pos', color: () => PAPER, dx: 1.3 });
  const sumL = tag('sum = 0', 'ptr alt', -2.4, 2.3, 1.2), tmpL = tag('temp = –', 'ptr', 2.4, 2.3, 1.2);
  say('一開始 pos 裡是 count', '要原地變成「比 v 小的個數」');
  P.hl(0);
  await beat(tok, 2600);
  let sum = 0;
  const v = [0, 1, 1, 2, 1, 0];
  for (let i = 0; i < 6; i++) {
    R.off(); R.hl([i], GOLD);
    P.hl(2); txt(tmpL, 'temp = ' + v[i]); say('先把 pos[' + i + '] 存到 temp', '不然馬上被蓋掉');
    await beat(tok, 1000);
    P.hl(3); relabel(R.m[i], sum); say('pos[' + i + '] = sum = ' + sum, '');
    await beat(tok, 1000);
    P.hl(4); sum += v[i]; txt(sumL, 'sum = ' + sum); say('sum += temp', 'sum = ' + sum);
    await beat(tok, 900);
  }
  R.off(); P.hl(-1);
  say('得到 0 0 1 2 4 5', '要記得 temp，容易寫錯');
  await beat(tok, 3000);
}]);

// 24:24 技巧：在尾端放 n = 5，由右往左：sum = n；sum −= pos[i]；pos[i] = sum
FRAG.push(['sortmit-rec-pos-backward', '技巧：尾端放 n，由右往左減', async (tok) => {
  fresh([0, 6, 11.5], [0, 1.5, 0]);
  const P = code(['sum = n', 'for i from k-1 down to 0:', '    sum = sum - pos[i]', '    pos[i] = sum'], 0, 5.6, 0.5, -2.5);
  const R = mRow([0, 1, 1, 2, 1, 0, 5], { idx: ['0', '1', '2', '3', '4', '5', 'n'], name: 'pos', color: () => PAPER, dx: 1.25 });
  tint(R.m[6], '#e8c770');
  say('在陣列後面放 n = 5', 'count 全部加起來 = key 的總數 = n');
  P.hl(0);
  await beat(tok, 3000);
  const sumL = tag('sum = 5', 'ptr alt', 0, 2.4, 1.2);
  let sum = 5;
  const v = [0, 1, 1, 2, 1, 0];
  for (let i = 5; i >= 0; i--) {
    R.off(); R.hl([i], GOLD);
    P.hl(2); sum -= v[i]; txt(sumL, 'sum = ' + sum); say('sum − pos[' + i + ']', (sum + v[i]) + ' − ' + v[i] + ' = ' + sum);
    await beat(tok, 1200);
    P.hl(3); relabel(R.m[i], sum); glow(R.m[i], GREEN); say('pos[' + i + '] = ' + sum, '從右往左，不需要 temp');
    await beat(tok, 1100);
  }
  R.off(); P.hl(-1);
  say('同樣得到 0 0 1 2 4 5', '這一步是 counting sort 最難的部分');
  await beat(tok, 3200);
}]);

// 30:00 輸出：out[pos[A[i]]] = A[i]；pos[A[i]] += 1（3a、3b 不會撞在同一格）
FRAG.push(['sortmit-rec-place', '放進 out：out[pos[A[i]]] = A[i]，pos++', async (tok) => {
  fresh([0, 9, 11], [0, 1, 0.6]);
  const P = code(['out = [None] * n', 'for i in range(n):', '    out[pos[A[i]]] = A[i]', '    pos[A[i]] += 1'], 0, 6.6, 0.48, -3.8);
  const vals = [4, 1, '3a', 2, '3b'];
  const A = mRow(vals, { z: -2.2, idx: true, name: 'A' });
  const pos = [0, 0, 1, 2, 4, 5];
  const PR = mRow(pos, { z: 0.6, idx: true, name: 'pos', color: () => PAPER, sz: [0.8, 0.5, 0.8], y: 0.3 });
  const O = mRow(Array(5).fill(null), { z: 3.4, idx: true, name: 'out' });
  P.hl(0); say('out 先放 n 個空位', 'pos 指向每種 key 的第一格');
  await beat(tok, 2600);
  for (let i = 0; i < 5; i++) {
    const v = mN(vals[i]), m = A.m[i];
    A.off(); PR.off(); glow(m, GOLD); glow(PR.m[v], GOLD);
    P.hl(2); say(vals[i] + '：pos[' + v + '] = ' + pos[v], '寫進 out[' + pos[v] + ']');
    await beat(tok, 1300);
    move(m, O.x(pos[v]), O.y, O.z); A.m[i] = null;
    await beat(tok, 900);
    P.hl(3); pos[v]++; relabel(PR.m[v], pos[v]); say('pos[' + v + '] 加一 → ' + pos[v], v === 3 && i === 2 ? '下一個 3 就不會蓋掉 3a' : '');
    await beat(tok, 1100);
    glow(m, null);
  }
  PR.off(); P.hl(-1);
  say('1 2 3a 3b 4：3a 仍在 3b 前', '<span class="ok">穩定</span>；只多用大小 k 的陣列');
  await beat(tok, 3200);
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
    nr.forEach((R, r) => R.m.forEach((m, c) => move(m, X[c] + (o.lift ? 0 : 0), 0.4, M.z(r))));
    M.rows = nr; await beat(tok, ms);
  };
  return M;
}
const stableBy = (list, c) => list.slice().sort((a, b) => (+a[c]) - (+b[c]) || list.indexOf(a) - list.indexOf(b));

// 35:06 Radix 的 key：d 位數、每位 base k → 共 kᵈ 種 key
FRAG.push(['sortmit-rec-radix-keys', 'Radix 的 key：d 位、每位 base k', async (tok) => {
  fresh([0, 9, 10], [0, 0, 0.3]);
  const M = mRadix(RX_NUMS, { drop: true });
  say('今天的例子：六個 4 位數', '2341 1432 2413 1243 2143 1234');
  await beat(tok, 3000);
  say('key = d 位數的序列', '每位不一定是十進位：0..k−1（base k）');
  for (let c = 0; c < 4; c++) { M.off(); M.col(c, GOLD); await beat(tok, 700); }
  M.off();
  await beat(tok, 1200);
  say('d 位 base k → kᵈ 種 key', '例：8 bits（k = 2）→ 2⁸ = 256');
  await beat(tok, 3200);
  say('多一位數，可表示的 key 就 ×k', '');
  await beat(tok, 2600);
}]);

// 37:19 從最低位開始；第 2 回合起一定要穩定 → 依最後兩位已排好
FRAG.push(['sortmit-rec-radix-lsd', 'LSD：從個位開始，每回合穩定', async (tok) => {
  fresh([0, 9, 10], [0, 0, 0.3]);
  const M = mRadix(RX_NUMS);
  say('先排哪一位？直覺說最高位', '<span class="no">反過來</span>：從最低位開始');
  await beat(tok, 3000);
  let cur = RX_NUMS.slice();
  const nm = ['個位', '十位', '百位', '千位'];
  for (let r = 0; r < 4; r++) {
    const c = 3 - r;
    M.off(); M.col(c, GOLD);
    say('第 ' + (r + 1) + ' 回合：依' + nm[r] + '穩定排序', r === 0 ? '剛好已依個位排好' : '同一位相等時保持上一回合順序');
    await beat(tok, r < 2 ? 2400 : 1500);
    cur = stableBy(cur, c);
    await M.order(tok, cur, r < 2 ? 1400 : 1000);
    if (r === 1) {
      M.off(); ['2341', '1243', '2143'].forEach((s) => M.rowHl(s, GREEN));
      say('十位都是 4 的三個：個位仍是 1 3 3', '→ 依「最後兩位」已排好');
      await beat(tok, 3400);
    }
  }
  M.off();
  say('四回合後完全排好', '1234 1243 1432 2143 2341 2413');
  await beat(tok, 3200);
}]);

// 42:00 時間：d 回合 × O(n + k)；要 O(n) → d = O(1)、k = O(n) → key 可到 n^O(1)
FRAG.push(['sortmit-rec-radix-time', 'Radix 何時是 O(n)：d = O(1)、k = O(n)', async (tok) => {
  fresh([0, 6, 12], [0, 2, 0]);
  const sl = [];
  for (let r = 0; r < 4; r++) { sl[r] = cube('counting sort：O(n + k)', '#b9d3ea', [6, 0.6, 1.4], 0, 0.35 + r * 0.7, 0, 2); await beat(tok, 600); }
  say('一回合 counting sort：O(n + k)', 'radix = d 回合');
  await beat(tok, 2600);
  const t = tag('O(d·(n + k))', 'ptr alt', 4.6, 1.6, 0);
  say('總共 O(d·(n + k))', '想要 O(n)：兩個條件');
  await beat(tok, 2800);
  sl.forEach((s) => glow(s, GOLD));
  say('d = O(1)：位數是常數', '不然 d·n 就超過 O(n)');
  await beat(tok, 3000);
  sl.forEach((s) => glow(s, null));
  say('k 比 n 小也是 O(n)：不如取大', 'k = O(n)：每位 base n');
  await beat(tok, 3200);
  txt(t, 'key ≤ n^O(1) → O(n)');
  say('key 可以到 nᶜ（c 是常數）', '<span class="ok">很大的整數也能線性排序</span>');
  await beat(tok, 3200);
  say('電腦裡可用 base 10000 之類', '位數越少，跑得越快');
  await beat(tok, 2600);
}]);

// 46:10 換成穩定的 merge sort？d × n log n → 不是線性；回顧：從 n log n 到 Θ(n)
FRAG.push(['sortmit-rec-radix-merge', '每回合改用 merge sort 會怎樣', async (tok) => {
  fresh([0, 4.5, 12], [0, 2.2, 0]);
  const n = 16, d = 2, k = 16;
  const hc = d * (n + k) / 30, hm = d * n * Math.log2(n) / 30;
  say('穩定的 merge sort 也正確', '但時間呢？');
  await beat(tok, 2600);
  const a = cube(null, '#4b9ee2', [1.6, hc, 1.2], -2.2, hc / 2, 0); tag('d·(n + k)', 'ptr', -2.2, hc + 0.5, 0);
  await beat(tok, 1400);
  const b = cube(null, '#c06a4a', [1.6, hm, 1.2], 2.2, hm / 2, 0); tag('d·n log n', 'ptr', 2.2, hm + 0.5, 0);
  tag('n = 16，d = 2', 'idx', 0, 0.05, 1.5);
  say('d 再小也有 n log n', '<span class="no">merge sort 配 radix 不划算</span>');
  await beat(tok, 3400);
  glow(a, GREEN);
  const f = ghostBox(GREEN, 9, 0.05, 1.6); f.position.set(0, hc, 0);
  say('從 n log n 一路做到 O(n)', '剛好碰到 Ω(n) 的極限');
  await beat(tok, 3400);
}]);

// 47:18 穩定性 Q&A：第 2 回合不穩定會壞掉；哪些排序穩定
FRAG.push(['sortmit-rec-stable-why', '穩定性：radix 為什麼需要、誰穩定', async (tok) => {
  fresh([0, 9, 10.5], [0, 0, 0.6]);
  const M = mRadix(['2341', '1432', '2413', '1243', '2143', '1234']);
  say('穩定：相等的 key 保持輸入順序', 'counting sort 只看到「這一位」');
  await beat(tok, 3000);
  M.col(2, GOLD);
  say('第 2 回合只看十位', '2341、1243、2143 看起來都是 4');
  await beat(tok, 2600);
  await M.order(tok, ['2413', '1432', '1234', '1243', '2143', '2341']);
  M.off(); ['1243', '2143', '2341'].forEach((s) => M.rowHl(s, RED));
  say('如果把 2341 放到最後', '43、43、41：最後兩位不再有序');
  await beat(tok, 3400);
  await M.order(tok, ['2413', '1432', '1234', '2341', '1243', '2143']);
  M.off(); ['2341', '1243', '2143'].forEach((s) => M.rowHl(s, GREEN));
  say('穩定才保住上一回合的成果', '41、43、43 ✓');
  await beat(tok, 2800);
  M.rows.forEach((R) => R.m.forEach((m) => fly(m)));
  await beat(tok, 900);
  const names = ['Insertion', 'Merge', 'Heap', 'Counting', 'Radix'], ok = [1, 1, 0, 1, 1], X = [-5.2, -2.6, 0, 2.6, 5.2];
  const why = ['相等不交換', '改一個字元（≤）', '有小反例', '由左往右放', '靠 counting'];
  for (let i = 0; i < 5; i++) {
    const b = mBox(names[i], X[i], 0.4, 0.5, 2.3, ok[i] ? MINT : '#efc9c0', 2);
    glow(b, ok[i] ? GREEN : RED);
    tag(ok[i] ? '穩定' : '不穩定', ok[i] ? 'ptr alt' : 'ptr', X[i], 1.4, 0.5);
    say(names[i] + '：' + (ok[i] ? '穩定' : '不穩定'), why[i]);
    await beat(tok, 1500);
  }
  say('只有 Heap Sort 不穩定', 'merge 要「相等取左邊」才穩定');
  await beat(tok, 3200);
}]);
  }

  // ═══ sortpeng.js ═══
  {
// ─── hXwxLgEOp-U：交大彭文志 Lec22 Sorting（Weiss / Horowitz 投影片） ───
// 只用 K 與 ctx。老師的例子：insertion / selection / bubble 都用 34 8 64 51 32 21（Weiss）；
// quick 用 Weiss 的 13 81 92 43 65 31 57 26 75 0（pivot 65，左堆再挑 31）與 Horowitz 的 26 5 37 1 61 11 59 15 48 19；
// heap 用 Weiss 的 insert 14（13 21 16 24 31 19 68 65 26 32）與 31 41 59 26 53 58 97（max heap 97 53 59 26 41 58 31）；
// radix 用 Weiss 的 64 8 216 512 27 729 0 1 343 125；external sort 用 4500 筆、記憶體 750 筆（3 個 250 的 block）；
// merge 順序用 Horowitz 的 2、4、5、15 個 block（43 vs 52）。
// merge 的例子（11 8 14 7 23 4 …）投影片只念出一部分：A6、A7 兩格（6 與 15）與單飛的 A8（9）是重建／示意值。
// 電話簿、身高、身分證字母、binary search 的 key 等是示意資料（老師沒有念數字）。
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, showL, code, line, arrow, ghostBox, GOLD, GREEN, RED, GRAY } = K;
const say = ctx.say, beat = ctx.beat, colorFor = ctx.colorFor, lab = ctx.lab;
const BLUE = '#1f3a6e', PINK = '#8a1f5a';
const nOf = (v) => parseInt(String(v), 10) || 0;
const W34 = [34, 8, 64, 51, 32, 21];
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
// backward insertion of slot i (shift bigger ones right, stop at ≤ key); hk(kind, …) for captions / code lines
async function insRound(tok, R, i, ms, hk = () => {}) {
  const km = R.m[i], kv = R.v[i], h = R.y + 1.1;
  glow(km, GOLD); move(km, R.x(i), h, R.z); hk('key', kv, i); await beat(tok, ms);
  let j = i - 1;
  while (j >= 0) {
    glow(R.m[j], BLUE); hk('cmp', R.v[j], kv, j + 1); await beat(tok, ms);
    if (R.v[j] <= kv) { glow(R.m[j], null); break; }
    glow(R.m[j], null); move(R.m[j], R.x(j + 1), R.y, R.z); R.m[j + 1] = R.m[j]; R.v[j + 1] = R.v[j];
    hk('shift', R.v[j + 1], kv, j + 1);
    j--; move(km, R.x(j + 1), h, R.z); await beat(tok, ms);
  }
  R.m[j + 1] = km; R.v[j + 1] = kv; move(km, R.x(j + 1), R.y, R.z); glow(km, null); hk('place', kv, j + 1); await beat(tok, ms);
  return j + 1;
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
    H.m[i] = v === undefined || v === null ? null : cube(v, colorFor(v), [0.8, 0.8, 0.8], x, y, 0);
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
    glow(H.m[i], GOLD); glow(H.m[c], BLUE); await beat(tok, ms);
    glow(H.m[i], null); glow(H.m[c], null);
    if (!cmp(H.v[c], H.v[i])) break;
    await H.swap(tok, i, c, ms); onSwap(i, c); i = c;
  }
}
// radix buckets 0..9 along the floor, the input / output row on top
const BX = (b) => -6.3 + b * 1.4, TX = (i) => -5.85 + i * 1.3, TOPY = 5.0;
const p3 = (v) => String(v).padStart(3, '0');
function radixSetup(vals) {
  for (let b = 0; b < 10; b++) { ctx.tile(V3(BX(b), 0.02, 0), 1.25, 1.0); tag(String(b), 'idx', BX(b), 0.05, 0.8); }
  return vals.map((v, i) => ({ v, m: cube(p3(v), colorFor(v), [1.15, 0.5, 0.8], TX(i), TOPY, 0) }));
}
async function distribute(tok, items, dig, ms) {
  const st = []; for (let b = 0; b < 10; b++) st.push([]);
  for (const it of items) { const b = dig(it.v); glow(it.m, GOLD); move(it.m, BX(b), 0.35 + st[b].length * 0.56, 0); st[b].push(it); await beat(tok, ms); glow(it.m, null); }
  return st;
}
async function collect(tok, st, slot0, ms) {
  const out = []; let k = slot0;
  for (let b = 0; b < 10; b++) for (const it of st[b]) { move(it.m, TX(k), TOPY, 0); out.push(it); k++; await beat(tok, ms); }
  return out;
}

// 00:00 電話簿：record、key，最笨的 sequential search
FRAG.push(['sortpeng-seq-search', 'Sequential Search：一筆一筆比 key', async (tok) => {
  fresh([0, 6.8, 12], [0, 2.4, 0]);
  const names = ['陳', '彭', '林', '王', '李', '張'];
  const R = pRow(names.map((s, i) => i + 1), { dx: 1.5, idx: true, base: 1, pre: 'a' });
  R.m.forEach((m, i) => relabel(m, names[i]));
  const cd = code(['i = n;', 'while (i > 0 && a[i].getKey() != k)', '  i--;', 'return i;   // 0 = 沒找到'], 0, 5.6, 0.52);
  const kp = tag('k = 彭', 'ptr alt', -5.6, 2.6, 0);
  say('每筆 record 有好幾個欄位', '搜尋用的欄位叫 key（這裡是名字）');
  await beat(tok, 2800);
  const ip = tag('i', 'ptr', 0, 0, 0);
  cd.hl(0); R.at(ip, 5, 1.2); txt(ip, 'i = 6');
  say('從第 n 筆開始往回 scan', 'n = 6');
  await beat(tok, 1600);
  for (let i = 5; i >= 0; i--) {
    R.at(ip, i, 1.2); txt(ip, 'i = ' + (i + 1)); cd.hl(1); glow(R.m[i], GOLD);
    say('getKey() = ' + names[i] + (names[i] === '彭' ? ' == k' : ' ≠ k'), names[i] === '彭' ? '找到了' : 'i--，看下一筆');
    await beat(tok, 1100);
    if (names[i] === '彭') { glow(R.m[i], GREEN); cd.hl(3); break; }
    glow(R.m[i], null); cd.hl(2); await beat(tok, 400);
  }
  say('return i = 2', 'Sequential search：最差 O(n)');
  await beat(tok, 2800);
  kill(kp);
}]);

// 06:21 先排序 → binary search，O(n) 降到 O(log n)
FRAG.push(['sortpeng-binary-search', '排好序才能 Binary Search', async (tok) => {
  fresh([0, 6.5, 12], [0, 2, 0]);
  const vals = [3, 7, 10, 14, 18, 21, 25, 29, 33, 38, 42, 47];
  const R = pRow(vals, { dx: 1.0, idx: true, sz: 0.72 });
  tag('k = 38', 'ptr alt', 0, 4.6, 0);
  say('key 欄位先排好序', '前提：要搜尋的欄位已經 sorted');
  await beat(tok, 2600);
  let lo = 0, hi = vals.length - 1, step = 0, z = null;
  const mp = tag('mid', 'ptr', 0, 0, 0);
  while (lo <= hi) {
    const mid = (lo + hi) >> 1; step++;
    z = R.zone(z, BLUE, lo, hi); R.at(mp, mid, 1.2); glow(R.m[mid], GOLD);
    say('第 ' + step + ' 次：比中間的 ' + vals[mid], vals[mid] === 38 ? '38 == k，找到' : (vals[mid] < 38 ? vals[mid] + ' < 38 → 丟掉左半' : vals[mid] + ' > 38 → 丟掉右半'));
    await beat(tok, 1900);
    if (vals[mid] === 38) { glow(R.m[mid], GREEN); break; }
    glow(R.m[mid], null);
    if (vals[mid] < 38) lo = mid + 1; else hi = mid - 1;
  }
  say('每次對切：只比了 ' + step + ' 次', 'O(n) → <span class="ok">O(log n)</span>');
  await beat(tok, 3000);
}]);

// 09:32 Internal sort vs External sort
FRAG.push(['sortpeng-int-ext', 'Internal vs External Sort', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 2, 0]);
  const mem = ghostBox(GREEN, 4.2, 2.2, 2.0); mem.position.set(-3.6, 1.2, 0);
  tag('Memory 4GB', 'ptr', -3.6, 2.8, 0);
  const a = [];
  for (let k = 0; k < 6; k++) a.push(cube(null, colorFor(k), [0.6, 0.6, 0.6], -5.0 + (k % 3) * 1.0, 0.5 + Math.floor(k / 3) * 0.7, 0, 3));
  say('資料全部放得進 memory', '→ Internal sort');
  await beat(tok, 2800);
  const disk = ghostBox(RED, 5.0, 3.4, 2.0); disk.position.set(3.4, 1.8, 0);
  tag('Disk：500GB', 'ptr alt', 3.4, 4.0, 0);
  const b = [];
  for (let k = 0; k < 20; k++) b.push(cube(null, colorFor(k + 1), [0.55, 0.55, 0.55], 1.4 + (k % 5) * 1.0, 0.4 + Math.floor(k / 5) * 0.75, 0, 2));
  say('資料 500GB、memory 只有 4GB', '塞不進去');
  await beat(tok, 2600);
  for (let k = 0; k < 6; k++) glow(b[k], RED);
  say('多買 memory？', '資料長得比 memory 快太多');
  await beat(tok, 2600);
  for (let k = 0; k < 6; k++) glow(b[k], null);
  say('一次只讀一部分進來、排完寫回去', '→ External sort');
  for (let r = 0; r < 2; r++) {
    for (let k = 0; k < 3; k++) move(b[r * 3 + k], -5.0 + k * 1.0, 2.0, 0);
    await beat(tok, 1200);
    for (let k = 0; k < 3; k++) { glow(b[r * 3 + k], GREEN); move(b[r * 3 + k], 1.4 + ((r * 3 + k) % 5) * 1.0, 0.4 + Math.floor((r * 3 + k) / 5) * 0.75, 0); }
    await beat(tok, 1200);
  }
  say('今天先講 internal、最後講 external', '');
  await beat(tok, 2600);
}]);

// 12:00 Insertion Sort 的想法：前 p 個已排好，把 a[p] 插進去
FRAG.push(['sortpeng-insert-idea', 'Insertion Sort：抓一個插進排好的部分', async (tok) => {
  fresh([0, 6.5, 11], [0, 1.8, 0]);
  const R = pRow(W34, { dx: 1.3, idx: true, pre: 'a' });
  let zs = R.zone(null, GREEN, 0, 0), zu = R.zone(null, GRAY, 1, 5);
  tag('sorted', 'ptr', R.x(0), 2.3, 0); const ut = tag('unsorted', 'idx', (R.x(1) + R.x(5)) / 2, 2.3, 0);
  say('假設前 n−1 個已經排好', '第 n 個插進去 → n 個都排好（歸納法）');
  await beat(tok, 3200);
  say('一路推回去：n = 1 只有一個，本來就排好', 'a0 = 34 自己就是 sorted');
  await beat(tok, 2800);
  const pp = tag('p', 'ptr alt', 0, 0, 0);
  for (let p = 1; p <= 2; p++) {
    R.at(pp, p, 2.0);
    const ar = arrow(V3(R.x(p), 2.0, 0.6), V3(R.x(0) - 0.3, 1.4, 0.6), 0x6a4a00);
    say('unsorted 的第一個 a[' + p + '] = ' + R.v[p], '插進 a[0..' + (p - 1) + ']');
    await beat(tok, 1800); kill(ar);
    await insRound(tok, R, p, 420);
    zs = R.zone(zs, GREEN, 0, p); zu = R.zone(zu, GRAY, p + 1, 5);
    ut.position.set((R.x(p + 1) + R.x(5)) / 2, 2.3, 0);
    say('sorted 區多一格', '0..' + p + ' 排好了');
    await beat(tok, 1500);
  }
  say('p 一格一格往右，直到 p = n−1', '每次：抓一個，insert 到該放的位置');
  await beat(tok, 2800);
}]);

// 15:05 例子 34 8 64 51 32 21：Pass 1–5
FRAG.push(['sortpeng-insert-passes', 'Insertion Sort：34 8 64 51 32 21', async (tok) => {
  fresh([0, 6.5, 11], [0, 1.8, 0]);
  const R = pRow(W34, { dx: 1.3, idx: true, pre: 'a' });
  let zs = R.zone(null, GREEN, 0, 0);
  const pl = tag('', 'ptr alt', 0, 3.6, 0);
  say('六個數字：34 8 64 51 32 21', 'a0 = 34 自己就排好');
  await beat(tok, 2600);
  for (let p = 1; p < 6; p++) {
    txt(pl, 'Pass ' + p);
    await insRound(tok, R, p, p === 4 ? 650 : 380, (k, a, b) => {
      if (k === 'key') say('Pass ' + p + '：拿 a' + p + ' = ' + a, '插進前面 ' + p + ' 個');
      if (k === 'cmp') say(b + ' 跟 ' + a + ' 比', a > b ? a + ' 比較大 → 往右挪一格' : a + ' ≤ ' + b + ' → 停');
    });
    zs = R.zone(zs, GREEN, 0, p);
    say('Pass ' + p + ' 後：' + R.v.join(' '), '底線部分 a0..a' + p + ' 排好');
    await beat(tok, 1300);
  }
  say('結果 8 21 32 34 51 64', '考試考的是每個 pass 的中間結果');
  await beat(tok, 3000);
}]);

// 19:24 紅字的程式：tmp = a[p]，a[j-1] > tmp 就 a[j] = a[j-1]
FRAG.push(['sortpeng-insert-code', 'Insertion Sort 的程式：插入 32', async (tok) => {
  fresh([0, 7, 12], [0, 2.4, 0]);
  const cd = code(['for (p = 1; p < n; p++) {', '  tmp = a[p];', '  for (j = p; j > 0 && a[j-1] > tmp; j--)', '    a[j] = a[j-1];', '  a[j] = tmp;', '}'], 0, 6.2, 0.5);
  const R = pRow([8, 34, 51, 64, 32, 21], { dx: 1.3, idx: true, pre: 'a' });
  let zs = R.zone(null, GREEN, 0, 3);
  const jp = tag('', 'ptr', 0, 0, 0);
  say('前四個已排好：8 34 51 64', '現在 p = 4');
  cd.hl(0); await beat(tok, 2600);
  await insRound(tok, R, 4, 1100, (k, a, b, j) => {
    if (k === 'key') { cd.hl(1); say('tmp = a[4] = 32', '拿出來'); R.at(jp, 4, -1.4); txt(jp, 'j = 4'); }
    if (k === 'cmp') { cd.hl(2); R.at(jp, j, -1.4); txt(jp, 'j = ' + j); say('a[j−1] = ' + a + ' > 32 ？', a > b ? '成立' : '不成立 → 跳出迴圈'); }
    if (k === 'shift') { cd.hl(3); say('a[' + j + '] = a[' + (j - 1) + ']：' + a + ' 往右挪', '然後 j--'); }
    if (k === 'place') { cd.hl(4); say('a[' + b + '] = tmp = 32', '插進 8 和 34 中間'); }
  });
  zs = R.zone(zs, GREEN, 0, 4);
  say('8 32 34 51 64 ｜ 21', '紅字可能被改寫：注意每一步');
  await beat(tok, 3000);
  cd.hl(-1);
}]);

// 23:07 Selection Sort：每回合從 unsorted 選最小的，跟 a[p] 交換
FRAG.push(['sortpeng-select-passes', 'Selection Sort：選最小的跟 a[p] 交換', async (tok) => {
  fresh([0, 7, 12], [0, 2.4, 0]);
  const cd = code(['for (p = 0; p < n-1; p++) {', '  min = p;', '  for (j = p+1; j < n; j++)', '    if (a[j] < a[min]) min = j;', '  swap(a[p], a[min]);', '}'], 0, 6.2, 0.5);
  const R = pRow(W34, { dx: 1.3, idx: true, pre: 'a' });
  let zs = null;
  const pp = tag('p', 'ptr alt', 0, 0, 0);
  say('同一組：34 8 64 51 32 21', '每回合從剩下的選最小的');
  await beat(tok, 2400);
  for (let p = 0; p < 5; p++) {
    R.at(pp, p, -1.4); txt(pp, 'p = ' + p); cd.hl(1);
    let m = p; const slow = p < 2;
    for (let j = p + 1; j < 6; j++) {
      R.off(); glow(R.m[p], GREEN); if (m !== p) glow(R.m[m], PINK); glow(R.m[j], GOLD); cd.hl(3);
      await beat(tok, slow ? 420 : 220);
      if (R.v[j] < R.v[m]) m = j;
    }
    R.off(); glow(R.m[m], PINK); cd.hl(4);
    say('剩下的最小是 ' + R.v[m], m === p ? '已經在 a' + p : 'swap a' + p + '(' + R.v[p] + ') ↔ a' + m + '(' + R.v[m] + ')');
    await beat(tok, slow ? 1500 : 800);
    if (m !== p) await R.swap(tok, p, m, slow ? 1000 : 700);
    R.off(); zs = R.zone(zs, GREEN, 0, p);
    say('Pass ' + p + ' 後：' + R.v.join(' '), slow && p === 1 ? '中間的 64 51 32 都沒動' : '');
    await beat(tok, slow ? 1600 : 900);
  }
  zs = R.zone(zs, GREEN, 0, 5); cd.hl(-1);
  say('只動 a[p] 和最小值那兩格', '跟 insertion 不同：中間元素不會挪');
  await beat(tok, 3000);
}]);

// 30:15 Bubble Sort：從右往左兩兩比，小的像氣泡往前浮
FRAG.push(['sortpeng-bubble-passes', 'Bubble Sort：21 像氣泡往前浮', async (tok) => {
  fresh([0, 7, 12], [0, 2.4, 0]);
  const cd = code(['for (p = 0; p < n-1; p++)', '  for (j = n-1; j > p; j--)', '    if (a[j] < a[j-1])', '      swap(a[j], a[j-1]);'], 0, 6.0, 0.5);
  const R = pRow(W34, { dx: 1.3, idx: true, pre: 'a' });
  let zs = null;
  const bp = tag('', 'ptr alt', 0, 0, 0);
  say('34 8 64 51 32 21：從最後面開始兩兩比', '小的往前浮，像水裡的氣泡');
  await beat(tok, 2600);
  for (let p = 0; p < 5; p++) {
    const slow = p < 2;
    for (let j = 5; j > p; j--) {
      R.off(); R.hl([j - 1, j], GOLD); R.at(bp, j, 1.4); txt(bp, '○'); cd.hl(2);
      const sw = R.v[j] < R.v[j - 1];
      if (slow) say('Pass ' + p + '：a' + j + '=' + R.v[j] + ' 跟 a' + (j - 1) + '=' + R.v[j - 1], sw ? R.v[j] + ' 比較小 → swap，往前' : R.v[j - 1] + ' 比較小 → 不換，接棒給 ' + R.v[j - 1]);
      await beat(tok, slow ? 1100 : 300);
      if (sw) { cd.hl(3); R.hl([j - 1, j], RED); await R.swap(tok, j - 1, j, slow ? 900 : 500); }
    }
    R.off(); zs = R.zone(zs, GREEN, 0, p);
    say('Pass ' + p + ' 後：' + R.v.join(' '), 'a0..a' + p + ' 就定位');
    await beat(tok, slow ? 1800 : 800);
  }
  zs = R.zone(zs, GREEN, 0, 5); txt(bp, ''); cd.hl(-1);
  say('Pass i 做完：a0..ai 排好', '要做很多 pass；相鄰交換');
  await beat(tok, 3000);
}]);

// 35:42 Merge 的概念：兩隊各自排好身高，合成一隊
FRAG.push(['sortpeng-merge-idea', 'Merge：兩個排好的小隊合成一隊', async (tok) => {
  fresh([0, 6.5, 12], [0, 2, 0]);
  const Av = [152, 158, 165, 171], Bv = [149, 160, 163, 175];
  const Am = Av.map((v, k) => cube(v, colorFor(k), [0.9, 0.6, 0.8], -6.0 + k * 1.15, 3.6, 0));
  const Bm = Bv.map((v, k) => cube(v, colorFor(k + 1), [0.9, 0.6, 0.8], 2.55 + k * 1.15, 3.6, 0));
  tag('第一小隊（排好）', 'ptr', -4.3, 4.5, 0); tag('第二小隊（排好）', 'ptr', 4.3, 4.5, 0);
  for (let k = 0; k < 8; k++) ctx.tile(V3(-4.2 + k * 1.2, 0.02, 0), 1.08, 1.0);
  say('兩個小隊都已經依身高排好', '合成一個大隊');
  await beat(tok, 2800);
  let a = 0, b = 0;
  for (let k = 0; k < 8; k++) {
    const takeA = b >= 4 || (a < 4 && Av[a] <= Bv[b]);
    if (a < 4) glow(Am[a], GOLD); if (b < 4) glow(Bm[b], GOLD);
    if (k < 3) say('比兩隊排頭：' + (a < 4 ? Av[a] : '—') + ' vs ' + (b < 4 ? Bv[b] : '—'), '矮的先出列');
    await beat(tok, k < 3 ? 1300 : 600);
    const m = takeA ? Am[a++] : Bm[b++]; glow(m, null);
    move(m, -4.2 + k * 1.2, 0.4, 0);
    if (a < 4) glow(Am[a], null); if (b < 4) glow(Bm[b], null);
    await beat(tok, k < 3 ? 800 : 450);
  }
  say('只要兩兩比排頭', 'Merge Sort：divide and conquer');
  await beat(tok, 2400);
  say('Divide：切成小問題；Conquer：各個擊破', '合起來，大問題就解了');
  await beat(tok, 3000);
}]);

// 40:46 例子：兩兩 merge，單飛的那個之後再加入；兩段長度不必相同
FRAG.push(['sortpeng-merge-passes', 'Merge Sort：一輪一輪兩兩合併', async (tok) => {
  fresh([0, 6.5, 12], [0, 1.8, 0]);
  const R = pRow([11, 8, 14, 7, 23, 4, 15, 6, 9], { dx: 1.25, idx: true, pre: 'A' });
  const zs = [];
  const runs = (w) => { zs.forEach(kill); zs.length = 0; for (let i = 0; i < 9; i += w) { const g = R.zone(null, i + w >= 9 && 9 - i < w && w > 1 ? GRAY : GREEN, i, Math.min(8, i + w - 1)); zs.push(g); } };
  const pl = tag('', 'ptr alt', 0, 3.4, 0);
  runs(1);
  say('一開始每個數字自己就是一段 sorted list', '底線只有一個數字：不用排');
  await beat(tok, 2600);
  for (const w of [1, 2, 4, 8]) {
    txt(pl, 'Pass ' + (Math.log2(w) + 1));
    for (let i = 0; i + w < 9; i += 2 * w) {
      const hi = Math.min(8, i + 2 * w - 1);
      const seg = R.v.slice(i, hi + 1).sort((x, y) => x - y);
      R.hl(Array.from({ length: hi - i + 1 }, (_, k) => i + k), GOLD);
      if (w <= 2) say('merge ' + R.v.slice(i, i + w).join(' ') + ' 和 ' + R.v.slice(i + w, hi + 1).join(' '), '→ ' + seg.join(' '));
      await beat(tok, w <= 2 ? 900 : 500);
      await R.arrange(tok, i, seg, w <= 2 ? 900 : 1100);
      R.off();
    }
    runs(2 * w);
    if (w === 1) { say('A8 = 9 沒有對象：先單飛', '之後再併進已經 merge 好的 list'); await beat(tok, 2400); }
    if (w === 4) { say('8 個 和 1 個也能 merge', '只要求兩段都是 sorted list，長度不必一樣'); await beat(tok, 2600); }
    await beat(tok, 900);
  }
  say('排好：' + R.v.join(' '), '每次 combine 都產生一段更長的 sorted list');
  await beat(tok, 3000);
}]);

// 44:54 merge 的做法：p、q 兩個 pointer，結果放進另一個 array B
FRAG.push(['sortpeng-merge-pq', 'Merge：p、q 比大小，copy 到新陣列 B', async (tok) => {
  fresh([0, 6.8, 12], [0, 2, 0]);
  const Lv = [7, 8, 11, 14], Rv = [4, 6, 15, 23];
  const xs = (k) => -5.25 + k * 1.5;
  for (let k = 0; k < 8; k++) { ctx.tile(V3(xs(k), 3.0, 0), 1.3, 1.0); tag('A' + k, 'idx', xs(k), 3.05, 0.75); }
  const Am = Lv.concat(Rv).map((v, k) => cube(v, colorFor(v), [0.8, 0.8, 0.8], xs(k), 3.5, 0));
  const lz = ghostBox(GREEN, 5.9, 1.0, 1.2); lz.position.set((xs(0) + xs(3)) / 2, 3.5, 0);
  const rz = ghostBox(BLUE, 5.9, 1.0, 1.2); rz.position.set((xs(4) + xs(7)) / 2, 3.5, 0);
  for (let k = 0; k < 8; k++) { ctx.tile(V3(xs(k), 0.02, 0), 1.3, 1.0); tag('B' + k, 'idx', xs(k), 0.05, 0.75); }
  const pp = tag('p', 'ptr', 0, 0, 0), qp = tag('q', 'ptr alt', 0, 0, 0);
  let p = 0, q = 4;
  const sp = () => { pp.position.set(xs(Math.min(p, 3)), 4.5, 0); txt(pp, p < 4 ? 'p = ' + p : 'p 走完'); qp.position.set(xs(Math.min(q, 7)), 4.5, 0); txt(qp, q < 8 ? 'q = ' + q : 'q 走完'); };
  sp();
  say('A0..A3、A4..A7 各自排好', 'p 指左段開頭、q 指右段開頭');
  await beat(tok, 2800);
  for (let k = 0; k < 8; k++) {
    const takeP = q >= 8 || (p < 4 && Lv[p] <= Rv[q - 4]);
    if (p < 4) glow(Am[p], GOLD); if (q < 8) glow(Am[q], GOLD);
    const slow = k < 3;
    if (p < 4 && q < 8) say('A' + p + '=' + Lv[p] + ' vs A' + q + '=' + Rv[q - 4], (takeP ? Lv[p] : Rv[q - 4]) + ' 比較小 → copy 到 B' + k);
    else say('一邊走完：剩下的照抄', '');
    await beat(tok, slow ? 1500 : 600);
    const m = takeP ? Am[p] : Am[q]; glow(m, null);
    if (p < 4) glow(Am[p], null); if (q < 8) glow(Am[q], null);
    move(m, xs(k), 0.5, 0);
    if (takeP) p++; else q++; sp();
    if (slow) say('被 copy 的那邊 pointer + 1', takeP ? 'p = ' + p : 'q = ' + q);
    await beat(tok, slow ? 1100 : 500);
  }
  say('結果在另一個 array B', '直接寫回 A 會蓋掉 7！→ 額外 O(n) 空間');
  await beat(tok, 3200);
}]);

// 48:30 遞迴版 mergeSort(a, tmp, left, right)
FRAG.push(['sortpeng-merge-recursive', '遞迴的 mergeSort(a, tmp, left, right)', async (tok) => {
  fresh([0, 7.2, 12.5], [0, 2.6, 0]);
  const cd = code(['mergeSort(a, tmp, left, right) {', '  if (left < right) {', '    center = (left + right) / 2;', '    mergeSort(a, tmp, left, center);', '    mergeSort(a, tmp, center+1, right);', '    merge(a, tmp, left, center+1, right);', '  } }'], 0, 6.6, 0.48);
  const R = pRow([11, 8, 14, 7, 23, 4, 15, 6], { dx: 1.3, idx: true });
  let z = null;
  const cl = tag('', 'ptr alt', 0, 2.0, 0);
  say('tmp：額外陣列；left、right：兩端', 'mergeSort(a, tmp, 0, 7)');
  await beat(tok, 2800);
  const rec = async (l, r) => {
    z = R.zone(z, BLUE, l, r); txt(cl, '(' + l + ', ' + r + ')'); cl.position.set((R.x(l) + R.x(r)) / 2, 2.0, 0);
    cd.hl(1);
    if (l >= r) { say('left = right：只剩一個', '不再切，直接 return'); await beat(tok, 420); return; }
    const c = (l + r) >> 1; cd.hl(2);
    if (r - l >= 3) say('切成 ' + l + '..' + c + ' 和 ' + (c + 1) + '..' + r, 'center = ' + c);
    await beat(tok, r - l >= 3 ? 1200 : 450);
    cd.hl(3); await rec(l, c); cd.hl(4); await rec(c + 1, r);
    z = R.zone(z, GREEN, l, r); cd.hl(5); txt(cl, 'merge'); cl.position.set((R.x(l) + R.x(r)) / 2, 2.0, 0);
    const s = R.v.slice(l, r + 1).sort((x, y) => x - y);
    say('merge(' + l + '..' + r + ') → ' + s.join(' '), '兩半都排好了，才開始合併');
    await R.arrange(tok, l, s, r - l >= 3 ? 1100 : 700);
  };
  await rec(0, 7);
  cd.hl(-1); txt(cl, '');
  say('一直切到不能再切，再一路 merge 回來', 'boundary condition 沒寫 → 無窮遞迴');
  await beat(tok, 3000);
}]);

// 52:45 T(n) = 2T(n/2) + n → O(n log n)
FRAG.push(['sortpeng-merge-recurrence', 'Merge Sort 分析：T(n) = 2T(n/2) + n', async (tok) => {
  fresh([0, 6.5, 12], [0, 2.6, 0]);
  const lv = [['n'], ['n/2', 'n/2'], ['n/4', 'n/4', 'n/4', 'n/4'], ['1', '1', '1', '1', '1', '1', '1', '1']];
  const ys = [5.2, 3.8, 2.4, 0.8];
  say('T(n)：排 n 個數字的時間', 'T(n) = 2T(n/2) + n');
  await beat(tok, 2600);
  for (let d = 0; d < 4; d++) {
    const k = lv[d].length, w = 9.6 / k;
    lv[d].forEach((s, i) => { const x = -5.2 + w * (i + 0.5); const g = ghostBox(d === 3 ? GREEN : BLUE, w - 0.15, 0.7, 1.0); g.position.set(x, ys[d], 0); tag(s, d === 3 ? 'idx' : '', x, ys[d], 0); });
    tag(d === 3 ? '共 n' : '+ n', 'ptr alt', 5.8, ys[d], 0);
    say(d === 0 ? '切兩半：2T(n/2)；merge：+n' : d === 3 ? '切到剩 1 個為止' : '每一半再切：T(n/2) = 2T(n/4) + n/2', d === 3 ? '' : '這一層 merge 加起來 = n');
    await beat(tok, 2200);
  }
  const g = tag('log n 層', 'ptr', -6.3, 3.0, 0);
  say('每層 n，共 log n 層', '<span class="ok">T(n) = O(n log n)</span>');
  await beat(tok, 2800);
  say('遞迴式怎麼解：離散／演算法會教', '代換到 T(1) 為止');
  await beat(tok, 2600);
  kill(g);
}]);

// 55:09 Quick Sort：選 pivot 65，小的一堆、大的一堆，再遞迴
FRAG.push(['sortpeng-quick-65', 'Quick Sort：pivot 65 把資料分兩堆', async (tok) => {
  fresh([0, 6.5, 12], [0, 2, 0]);
  const vals = [13, 81, 92, 43, 65, 31, 57, 26, 75, 0];
  const M = {}; vals.forEach((v, i) => { M[v] = cube(v, colorFor(v), [0.8, 0.8, 0.8], -5.85 + i * 1.3, 4.6, 0); });
  say('在一堆數字裡先挑一個 pivot（標兵）', '隨便挑：65');
  await beat(tok, 2600);
  glow(M[65], GOLD); move(M[65], 0.6, 0.5, 0); const pv = tag('pivot', 'ptr alt', 0.6, 1.5, 0);
  await beat(tok, 1400);
  const small = [13, 43, 31, 57, 26, 0], big = [81, 92, 75];
  say('比 65 小的站左邊、比 65 大的站右邊', '');
  for (let i = 0; i < small.length; i++) { move(M[small[i]], -5.6 + i * 1.0, 0.5, 0); await beat(tok, 350); }
  for (let i = 0; i < big.length; i++) { move(M[big[i]], 2.1 + i * 1.0, 0.5, 0); await beat(tok, 350); }
  const zl = ghostBox(BLUE, 6.2, 1.2, 1.2); zl.position.set(-3.1, 0.5, 0);
  const zr = ghostBox(PINK, 3.2, 1.2, 1.2); zr.position.set(3.1, 0.5, 0);
  say('0 43 31 13 26 57 ｜65｜ 81 92 75', '65 已經站到最終位置');
  await beat(tok, 2600);
  say('左邊那堆再挑一個 pivot：31', '一直 recursive 下去');
  glow(M[31], GOLD); await beat(tok, 1400);
  const L2 = [13, 26, 0], R2 = [43, 57];
  move(M[31], -2.6, 0.5, 0);
  L2.forEach((v, i) => move(M[v], -5.6 + i * 1.0, 0.5, 0)); R2.forEach((v, i) => move(M[v], -1.6 + i * 1.0, 0.5, 0));
  say('13 26 0 ｜31｜ 43 57', '小的左、大的右');
  await beat(tok, 2200);
  const fin = [0, 13, 26, 31, 43, 57, 65, 75, 81, 92];
  kill(zl); kill(zr); kill(pv);
  fin.forEach((v, i) => { glow(M[v], null); move(M[v], -5.85 + i * 1.3, 0.5, 0); });
  await beat(tok, 1200);
  fin.forEach((v) => glow(M[v], GREEN));
  say('每一堆都這樣切 → 排好', '跟 merge sort 一樣 divide and conquer');
  await beat(tok, 3000);
}]);

// 59:46 pivot 怎麼選：最小/最大就白選；random、median-of-three、sampling
FRAG.push(['sortpeng-pivot-choice', 'Pivot 怎麼選：random、三數取中、取樣', async (tok) => {
  fresh([0, 6.5, 12], [0, 2, 0]);
  const R = pRow([1, 2, 3, 4, 5, 6, 7, 8, 9], { dx: 1.25 });
  let z1 = null, z2 = null;
  say('如果剛好選到最小的當 pivot', '');
  glow(R.m[0], RED); await beat(tok, 1600);
  z2 = R.zone(z2, PINK, 1, 8);
  say('左邊 0 個、右邊 n−1 個', '有選跟沒選差不多 → 最差 O(n²)');
  await beat(tok, 2800);
  kill(z2); glow(R.m[0], null);
  const s = [1, 4, 7];
  say('Random 選三個出來', s.map((i) => R.v[i]).join('、'));
  R.hl(s, GOLD); await beat(tok, 2000);
  glow(R.m[1], null); glow(R.m[7], null); glow(R.m[4], GREEN);
  say('取三個的中位數：5', 'median-of-three');
  await beat(tok, 2000);
  z1 = R.zone(z1, BLUE, 0, 3); z2 = R.zone(null, PINK, 5, 8);
  say('切得接近一半', '中位數當 pivot 最好，但真的去找中位數太貴');
  await beat(tok, 2800);
  const sm = tag('100 萬個數字 → 抽 1000 個 → 排序取中位數', 'ptr alt', 0, 3.4, 0);
  say('資料很大就多抽一些：sampling', '不一定要選三個');
  await beat(tok, 3200);
  kill(sm);
}]);

// 62:07 例子（Horowitz）：26 5 37 1 61 11 59 15 48 19，pivot = 第一個，看 left/right
FRAG.push(['sortpeng-quick-textbook', '例子：每次遞迴的 left、right', async (tok) => {
  fresh([0, 7, 12.5], [0, 2.4, 0]);
  const R = pRow([26, 5, 37, 1, 61, 11, 59, 15, 48, 19], { dx: 1.25, idx: true, base: 1 });
  const calls = [
    [1, 10, [11, 5, 19, 1, 15, 26, 59, 61, 48, 37]],
    [1, 5, [1, 5, 11, 19, 15]],
    [1, 2, [1, 5]],
    [4, 5, [15, 19]],
    [7, 10, [48, 37, 59, 61]],
    [7, 8, [37, 48]],
  ];
  const pivAt = { '1,10': 6, '1,5': 3, '1,2': 1, '4,5': 5, '7,10': 9, '7,8': 8 };
  const tbl = code(['left right'].concat(calls.map(([l, r]) => String(l).padStart(4) + String(r).padStart(6))), 5.4, 6.4, 0.42, -1.5);
  tbl.ls.forEach((l, i) => showL(l, i === 0));
  let z = null;
  say('10 筆 record，pivot = 這段的第一個', '注意每一輪的 left、right');
  await beat(tok, 2600);
  for (let c = 0; c < calls.length; c++) {
    const [l, r, res] = calls[c];
    showL(tbl.ls[c + 1], true); tbl.hl(c + 1);
    z = R.zone(z, BLUE, l - 1, r - 1);
    glow(R.m[l - 1], GOLD);
    say('left = ' + l + ', right = ' + r + '：pivot = ' + R.v[l - 1], c === 1 ? '11 剛好是中位數' : '小的放前面、大的放後面');
    await beat(tok, c < 2 ? 1800 : 1000);
    glow(R.m[l - 1], null);
    await R.arrange(tok, l - 1, res, c < 2 ? 1100 : 800);
    glow(R.m[pivAt[l + ',' + r] - 1], GREEN);
    await beat(tok, c < 2 ? 1400 : 700);
  }
  kill(z); R.m.forEach((m) => glow(m, GREEN)); tbl.hl(-1);
  say('1 5 11 15 19 26 37 48 59 61', '像 debug mode：看每次遞迴處理哪一段');
  await beat(tok, 3000);
}]);

// 64:12 n 小時 insertion 較好；T(n) = T(i) + T(n−i−1) + cn：最差 n²、最好/平均 n log n
FRAG.push(['sortpeng-quick-analysis', 'Quick Sort 分析：看 pivot 切在哪', async (tok) => {
  fresh([0, 6.5, 12], [0, 2.8, 0]);
  say('數字很少時 quick sort 沒什麼意義', '小規模：Insertion Sort 比較好');
  await beat(tok, 2800);
  tag('T(n) = T(i) + T(n−i−1) + cn', 'ptr alt', 0, 6.0, 0);
  say('左邊 i 個、右邊 n−i−1 個', '+ cn：partition 掃一遍');
  await beat(tok, 2600);
  tag('最差：每次選到最小／最大', 'ptr', -3.5, 5.2, 0);
  for (let d = 0; d < 8; d++) { const w = (8 - d) * 0.4; const g = ghostBox(RED, w, 0.4, 0.8); g.position.set(-3.5 - 1.6 + w / 2, 4.5 - d * 0.52, 0); await beat(tok, 220); }
  say('每次只少一個：n 層', '<span class="no">O(n²)</span>');
  await beat(tok, 2200);
  tag('最好：每次剛好對半', 'ptr', 3.5, 5.2, 0);
  for (let d = 0; d < 4; d++) { const k = 1 << d, w = 3.2 / k; for (let i = 0; i < k; i++) { const g = ghostBox(GREEN, w - 0.1, 0.5, 0.8); g.position.set(3.5 - 1.6 + w * (i + 0.5), 4.5 - d * 1.1, 0); } await beat(tok, 400); }
  say('log n 層、每層 n', '最好與平均：<span class="ok">O(n log n)</span>');
  await beat(tok, 3000);
}]);

// 66:12 比較排序的下界：a、b、c 的 decision tree，3 4 5 走到 a<b<c
FRAG.push(['sortpeng-decision-tree', 'Decision Tree：比較排序最快 n log n', async (tok) => {
  fresh([0, 6, 12], [0, 3, 0]);
  const N = {
    r: [0, 5.4, 'a<b ?'], n1: [-3.5, 4.0, 'c>a ?'], n3: [3.5, 4.0, 'c>b ?'],
    n2: [-2.0, 2.6, 'c>b ?'], n4: [2.0, 2.6, 'c>a ?'],
    l1: [-5.4, 2.6, 'c<a<b'], l2: [-3.0, 1.2, 'a<c<b'], l3: [-1.0, 1.2, 'a<b<c'],
    l4: [1.0, 1.2, 'b<c<a'], l5: [3.0, 1.2, 'b<a<c'], l6: [5.4, 2.6, 'c<b<a'],
  };
  const E = [['r', 'n1'], ['r', 'n3'], ['n1', 'l1'], ['n1', 'n2'], ['n2', 'l2'], ['n2', 'l3'], ['n3', 'n4'], ['n3', 'l6'], ['n4', 'l4'], ['n4', 'l5']];
  E.forEach(([a, b]) => line(N[a][0], N[a][1], N[b][0], N[b][1], 0));
  const T = {}; for (const k in N) T[k] = tag(N[k][2], k[0] === 'l' ? 'idx' : 'ptr', N[k][0], N[k][1], 0);
  say('三個變數 a、b、c：共 3! = 6 種大小順序', '答案一定是其中一種');
  await beat(tok, 3000);
  say('每個 internal node 問一次「誰大」', '六個答案都在 leaf');
  await beat(tok, 2600);
  const cur = cube(null, GOLD, [0.45, 0.45, 0.45], N.r[0], N.r[1] + 0.6, 0);
  const walk = async (path, capt) => {
    for (const [k, c] of path) { move(cur, N[k][0], N[k][1] + 0.6, 0); say(capt, c); await beat(tok, 1500); }
  };
  await walk([['r', 'a=3, b=4：3 < 4 → 往左'], ['n1', 'c=5 > a=3 → 往右'], ['n2', 'c=5 > b=4 → 往右'], ['l3', '到 leaf：a < b < c']], 'a=3, b=4, c=5');
  T.l3.element.className = 'lab-label ptr alt';
  await beat(tok, 1200);
  move(cur, N.r[0], N.r[1] + 0.6, 0); await beat(tok, 600);
  await walk([['r', 'a=5 > b=4 → 往右'], ['n3', 'c=3 < b=4 → 往右'], ['l6', '到 leaf：c < b < a']], 'a=5, b=4, c=3');
  say('比較次數 = 走到 leaf 的深度', '最差 = 樹高 = 3');
  await beat(tok, 2600);
  say('n 個數字 → n! 個 leaf → 樹高 ≥ log n!', 'log n! = Θ(n log n)：<span class="ok">比較排序最快 n log n</span>');
  await beat(tok, 3400);
}]);

// 77:00 Heap Sort 直覺版：min heap，delete n 次，結果放到另一個 array
FRAG.push(['sortpeng-heap-minextra', 'Min Heap 刪 n 次：需要額外的陣列', async (tok) => {
  fresh([0, 6.5, 12], [0, 2.8, 0]);
  const H = heapView([26, 41, 31, 53, 58, 59, 97], { top: 5.6, W: 8, dy: 1.3 });
  for (let k = 0; k < 7; k++) { ctx.tile(V3(-4.5 + k * 1.5, 0.02, 0), 1.3, 1.0); tag('B' + k, 'idx', -4.5 + k * 1.5, 0.05, 0.75); }
  say('Min heap：root 永遠最小', '從小排到大 → 一直 delete root');
  await beat(tok, 2600);
  let size = 7;
  for (let k = 0; k < 7; k++) {
    const slow = k < 2;
    const m = H.m[1]; glow(m, GOLD);
    if (slow) say('delete：root ' + H.v[1] + ' 是剩下最小的', 'copy 到另一個 array B' + k);
    await beat(tok, slow ? 1200 : 450);
    glow(m, null); move(m, -4.5 + k * 1.5, 0.5, 0); H.m[1] = null;
    await beat(tok, slow ? 700 : 350);
    if (size > 1) {
      const lm = H.m[size], [x1, y1] = H.pos(1); move(lm, x1, y1, 0); H.m[1] = lm; H.v[1] = H.v[size]; H.m[size] = null; H.v[size] = null; size--;
      if (slow) say('最後一個補到 root，往下調整', '每次 delete O(log n)');
      await beat(tok, slow ? 900 : 350);
      await siftDown(tok, H, 1, size, (a, b) => a < b, slow ? 600 : 260);
    } else size = 0;
  }
  say('n 次 × O(log n) = O(n log n)', '<span class="no">缺點：要額外一個 array</span>');
  await beat(tok, 3000);
}]);

// 80:20 build heap 最笨：insert n 次；insert 14：放最底下、往上比 parent
FRAG.push(['sortpeng-heap-insert14', 'Insert 14：放到最後，往上跟 parent 比', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 3, 0]);
  const H = heapView([13, 21, 16, 24, 31, 19, 68, 65, 26, 32], { n: 11, top: 5.6, W: 11, dy: 1.35 });
  tag('a[i] 的 parent = a[i/2]', 'ptr', -4.6, 6.3, 0);
  say('Build heap 最笨的方法：一個一個 insert', 'insert n 次');
  await beat(tok, 2800);
  const [x, y] = H.pos(11);
  const m = cube(14, colorFor(14), [0.8, 0.8, 0.8], x, y, 0, 2.5); H.m[11] = m; H.v[11] = 14;
  say('insert 14：先放在最底下的空位 a[11]', 'bottom-up 往上走');
  await beat(tok, 2200);
  let i = 11;
  while (i > 1) {
    const p = i >> 1; glow(H.m[p], BLUE); glow(m, GOLD);
    const up = 14 < H.v[p];
    say('14 跟 parent a[' + p + '] = ' + H.v[p] + ' 比', up ? '14 比較小 → parent 往下、14 往上' : '14 比較大 → 停');
    await beat(tok, 1600); glow(H.m[p], null);
    if (!up) break;
    await H.swap(tok, i, p, 900); i = p;
  }
  glow(m, GREEN);
  say('14 停在 a[2]', 'insert O(log n)；delete 則是 top-down');
  await beat(tok, 3000);
}]);

// 83:33 用 max heap：刪掉的 root 放到尾巴空出來的格子 → 原地排序
FRAG.push(['sortpeng-heap-maxinplace', 'Max Heap：刪掉的放尾巴，原地排好', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 2.8, 0]);
  const H = heapView([97, 53, 59, 26, 41, 58, 31], { top: 5.8, W: 8, dy: 1.3 });
  const ax = (i) => -4.5 + (i - 1) * 1.5;
  const A = [null];
  for (let i = 1; i <= 7; i++) { ctx.tile(V3(ax(i), 0.02, 0), 1.3, 1.0); tag(String(i), 'idx', ax(i), 0.05, 0.75); A[i] = cube(H.v[i], colorFor(H.v[i]), [0.7, 0.7, 0.7], ax(i), 0.45, 0); }
  const sync = () => { for (let i = 1; i <= 7; i++) { relabel(A[i], H.v[i]); tint(A[i], colorFor(H.v[i])); } };
  say('Max heap 存在 array：97 在 1、53 在 2、59 在 3', '');
  await beat(tok, 2800);
  let zone = null;
  for (let size = 7; size > 1; size--) {
    const slow = size >= 6;
    glow(H.m[1], GOLD); glow(H.m[size], BLUE);
    if (slow) say('delete ' + H.v[1] + '：跟尾巴 a[' + size + '] 交換', '刪掉的放進空出來的尾巴');
    await beat(tok, slow ? 1500 : 500);
    glow(H.m[1], null); glow(H.m[size], null);
    await H.swap(tok, 1, size, slow ? 900 : 500); sync();
    glow(H.m[size], GREEN); glow(A[size], GREEN);
    if (zone) kill(zone); zone = ghostBox(GREEN, (8 - size) * 1.5, 1.0, 1.2); zone.position.set((ax(size) + ax(7)) / 2, 0.45, 0);
    if (slow) say('剩下 1..' + (size - 1) + ' 往下調整', '');
    await siftDown(tok, H, 1, size - 1, (a, b) => a > b, slow ? 650 : 280, sync);
    if (slow) { say('下一個最大 ' + H.v[1] + ' 浮上來', ''); await beat(tok, 1200); }
  }
  glow(H.m[1], GREEN); glow(A[1], GREEN);
  say('array：26 31 41 53 58 59 97', '<span class="ok">不用額外空間</span>，O(n log n)');
  await beat(tok, 3000);
}]);

// 86:30 bottom-up build heap：31 41 59 26 53 58 97 先照放，再由下往上調
FRAG.push(['sortpeng-heap-bottomup', 'Bottom-up Build Heap：從下面的小 heap 長上來', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 2.8, 0]);
  const H = heapView([31, 41, 59, 26, 53, 58, 97], { top: 5.8, W: 8, dy: 1.3 });
  const ax = (i) => -4.5 + (i - 1) * 1.5;
  const A = [null];
  for (let i = 1; i <= 7; i++) { ctx.tile(V3(ax(i), 0.02, 0), 1.3, 1.0); tag(String(i), 'idx', ax(i), 0.05, 0.75); A[i] = cube(H.v[i], colorFor(H.v[i]), [0.7, 0.7, 0.7], ax(i), 0.45, 0); }
  const sync = () => { for (let i = 1; i <= 7; i++) { relabel(A[i], H.v[i]); tint(A[i], colorFor(H.v[i])); } };
  say('7 個數字先照順序丟進 a[1..7]', '順序不管');
  await beat(tok, 2600);
  say('葉子 26 53 58 97 各自就是小 heap', '從下面開始調整');
  await beat(tok, 2400);
  for (const i of [3, 2, 1]) {
    const z = ghostBox(BLUE, i === 1 ? 8.4 : 4.2, i === 1 ? 4.0 : 2.0, 1.0);
    const [x, y] = H.pos(i); z.position.set(x, i === 1 ? y - 1.3 : y - 0.6, 0);
    const c1 = H.v[2 * i], c2 = H.v[2 * i + 1];
    say('subtree a[' + i + '] = ' + H.v[i] + '，孩子 ' + c1 + '、' + c2, '最大的往上推');
    await beat(tok, 1600);
    await siftDown(tok, H, i, 7, (a, b) => a > b, 800, sync);
    say('這棵 subtree 符合 max heap', '');
    await beat(tok, 1000); kill(z);
  }
  say('97 53 59 26 41 58 31', 'Bottom-up build heap 完成');
  await beat(tok, 3000);
}]);

// 89:42 Bucket Sort：依資料特性丟進籃子，不比大小；MSD vs LSD
FRAG.push(['sortpeng-bucket-idea', 'Bucket Sort：照字母丟進籃子', async (tok) => {
  fresh([0, 6.5, 12], [0, 2, 0]);
  const L = ['A', 'B', 'C', 'D', 'E', 'F'], bx = (k) => -5.5 + k * 1.9;
  L.forEach((s, k) => { ctx.tile(V3(bx(k), 0.02, 0), 1.6, 1.0); tag(s, 'ptr', bx(k), 0.05, 0.8); });
  tag('… Z（共 26 個籃子）', 'idx', 5.4, 1.6, 0.8);
  const ids = ['F2', 'A1', 'C3', 'A4', 'E5', 'B6', 'C7'];
  const ms = ids.map((s, i) => { const m = cube(i + 1, colorFor(i), [1.1, 0.5, 0.8], -5.4 + i * 1.6, 4.6, 0); relabel(m, s + '…'); return m; });
  say('身分證第一個字是英文字母', '準備 26 個 bucket（籃子）');
  await beat(tok, 2600);
  const h = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < ids.length; i++) {
    const k = L.indexOf(ids[i][0]); glow(ms[i], GOLD);
    move(ms[i], bx(k), 0.35 + h[k] * 0.56, 0); h[k]++;
    say(ids[i] + '… 看第一個字母 ' + ids[i][0], '直接丟進 bucket ' + ids[i][0]);
    await beat(tok, 900); glow(ms[i], null);
  }
  say('從左邊的籃子依序讀出來', '<span class="ok">完全沒有互相比大小</span>');
  await beat(tok, 2600);
  say('數字也一樣：一位一位丟 bucket，有點像 hash', 'MSD：Radix exchange；LSD：Straight radix');
  await beat(tok, 3200);
}]);

// 92:00 Radix Exchange Sort（MSD）：先看百位數，bucket 裡超過一個再看十位、個位
FRAG.push(['sortpeng-msd', 'Radix Exchange Sort：從百位數開始（MSD）', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 2.6, 0]);
  const vals = [64, 8, 216, 512, 27, 729, 0, 1, 343, 125];
  let items = radixSetup(vals);
  say('每個數字補成三位數：064、008…', 'bucket 0..9');
  await beat(tok, 2600);
  say('先看最左邊的百位數', 'Most significant digit');
  await beat(tok, 1400);
  let st = await distribute(tok, items, (v) => Math.floor(v / 100), 500);
  say('bucket 0 擠了五個', '064 008 027 000 001；其他 bucket 各一個');
  await beat(tok, 2400);
  items = await collect(tok, st, 0, 260);
  const zs = ghostBox(RED, 6.4, 0.9, 1.0); zs.position.set((TX(0) + TX(4)) / 2, TOPY, 0);
  say('從左讀到右：125 以後都排好', '前五個（bucket 0）還要再排');
  await beat(tok, 2600);
  st = await distribute(tok, items.slice(0, 5), (v) => Math.floor(v / 10) % 10, 550);
  say('只把 bucket 0 那五個，再依十位數分', '008 000 001 都在 bucket 0');
  await beat(tok, 2200);
  const five = await collect(tok, st, 0, 300);
  kill(zs); const z2 = ghostBox(RED, 3.8, 0.9, 1.0); z2.position.set((TX(0) + TX(2)) / 2, TOPY, 0);
  await beat(tok, 900);
  st = await distribute(tok, five.slice(0, 3), (v) => v % 10, 550);
  say('還是超過一個 → 再看個位數', '');
  await beat(tok, 1600);
  await collect(tok, st, 0, 300); kill(z2);
  say('全部排好', '000 001 008 027 064 125 216 343 512 729；小 bucket 也可改用 insertion sort');
  await beat(tok, 3000);
}]);

// 96:48 Straight Radix Sort（LSD）：個位 → 十位 → 百位，每輪從 bucket 0 讀到 9
FRAG.push(['sortpeng-lsd', 'Straight Radix Sort：從個位數開始（LSD）', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 2.6, 0]);
  let items = radixSetup([64, 8, 216, 512, 27, 729, 0, 1, 343, 125]);
  const names = ['個位數', '十位數', '百位數'], dig = [(v) => v % 10, (v) => Math.floor(v / 10) % 10, (v) => Math.floor(v / 100)];
  say('這次從最右邊的位數開始', 'Least significant digit');
  await beat(tok, 2400);
  for (let r = 0; r < 3; r++) {
    say('第 ' + (r + 1) + ' 輪：看' + names[r], r === 0 ? '064 → bucket 4、008 → bucket 8' : '照上一輪讀出來的順序丟');
    await beat(tok, 1200);
    const st = await distribute(tok, items, dig[r], r === 0 ? 450 : 320);
    say('bucket 0 → 9，每個 bucket 從下往上讀', '先放進去的先讀出來');
    await beat(tok, 1200);
    items = await collect(tok, st, 0, 220);
    say(r < 2 ? '新的 sequence，還沒排好' : '新的 sequence', items.map((it) => p3(it.v)).join(' '));
    await beat(tok, 1800);
  }
  items.forEach((it) => glow(it.m, GREEN));
  say('百位數做完 → 全部排好', '<span class="ok">從頭到尾沒有比大小</span>');
  await beat(tok, 3000);
}]);

// 101:30 Radix 沒有比較；bucket 用 Queue（FIFO）；n 個數字 × 3 位 → 3 輪
FRAG.push(['sortpeng-radix-cost', 'Radix：bucket 是 Queue，不比大小', async (tok) => {
  fresh([0, 6.5, 12], [0, 2.4, 0]);
  const q = ghostBox(BLUE, 6.0, 1.0, 1.2); q.position.set(0, 2.6, 0);
  tag('bucket 2（十位數 = 2）', 'ptr', 0, 3.6, 0);
  tag('rear ←', 'idx', 3.6, 2.6, 0); tag('← front', 'idx', -3.6, 2.6, 0);
  const vs = [125, 27, 729];
  const ms = vs.map((v, i) => cube(p3(v), colorFor(v), [1.15, 0.5, 0.8], 3.0 + i * 1.3, 5.0, 0));
  say('第 2 輪：125、027、729 依序進 bucket 2', '它們個位已排好：5 < 7 < 9');
  await beat(tok, 2600);
  for (let i = 0; i < 3; i++) { move(ms[i], -1.6 + i * 1.6, 2.6, 0); await beat(tok, 700); }
  say('讀出來：先進先出', 'Queue（FIFO），不是 Stack');
  await beat(tok, 1600);
  for (let i = 0; i < 3; i++) { move(ms[i], -2.6 + i * 1.6, 0.4, 0); await beat(tok, 700); }
  say('125 027 729：上一輪的順序保住了', '用 Stack 會變 729 027 125');
  await beat(tok, 2800);
  tag('3 位數 → 3 輪；每輪：n 個各丟一次 + 讀 10 個 bucket', 'ptr alt', 0, 6.0, 0);
  say('沒有比大小，每個數字算一下丟進 bucket', 'O(d·(n + r))：d 位數、r 個 bucket');
  await beat(tok, 3400);
}]);

// 108:56 / 125:13 MapReduce：Map = divide、Reduce = conquer；多台電腦各排一份再合併
FRAG.push(['sortpeng-mapreduce', 'MapReduce：多台機器 divide and conquer', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 2.4, 0]);
  const rad = !!(ctx.params || {}).radix;
  const k = rad ? 3 : 6, mx = (i) => rad ? -4.4 + i * 4.4 : -5.5 + i * 2.2;
  const labels = rad ? ['bucket 0–3', 'bucket 4–6', 'bucket 7–9'] : ['1–750', '751–1500', '1501–2250', '2251–3000', '3001–3750', '3751–4500'];
  const big = cube(rad ? 'n 個數字' : '4500 筆', GRAY, [rad ? 6.0 : 7.0, 0.7, 1.0], 0, 5.2, 0);
  say(rad ? 'Radix：每個（或一群）bucket 給一台機器' : '每台電腦 memory 只放得下 750 筆', rad ? '' : '那就用 6 台電腦');
  await beat(tok, 2600);
  const boxes = [], parts = [];
  for (let i = 0; i < k; i++) { const g = ghostBox(BLUE, rad ? 3.4 : 1.9, 1.6, 1.4); g.position.set(mx(i), 2.6, 0); boxes.push(g); tag('機器 ' + (i + 1), 'idx', mx(i), 1.5, 0.8); }
  kill(big);
  for (let i = 0; i < k; i++) { const m = cube(i + 1, colorFor(i), [rad ? 2.6 : 1.6, 0.6, 0.8], mx(i), 5.2, 0); relabel(m, labels[i]); parts.push(m); }
  say('Map = Divide：切成很多小問題', '分給不同機器');
  await beat(tok, 1600);
  for (let i = 0; i < k; i++) { move(parts[i], mx(i), 2.6, 0); await beat(tok, 300); }
  say('每台機器各自排好（internal sort）', '同時進行');
  await beat(tok, 1600);
  parts.forEach((m) => glow(m, GREEN)); await beat(tok, 1400);
  say('Reduce = Conquer：合起來', rad ? 'bucket 本來就有順序：接起來就好' : '再 merge 成一份');
  for (let i = 0; i < k; i++) move(parts[i], rad ? -3.0 + i * 3.0 : -5.0 + i * 2.0, 0.4, 0);
  await beat(tok, 1600);
  boxes.forEach(kill);
  const out = cube(rad ? '排好的 n 個' : '4500 筆 sorted', GREEN, [7.0, 0.7, 1.0], 0, 0.4, 0);
  parts.forEach(kill);
  say('Merge sort、Radix sort 都很容易平行化', 'MapReduce 講穿了就是 divide and conquer');
  await beat(tok, 3000);
  kill(out);
}]);

// 110:51 Internal sort 總結：比較 vs 不比較；沒有永遠的贏家
FRAG.push(['sortpeng-summary', 'Internal Sort 總結', async (tok) => {
  fresh([0, 6.5, 12], [0, 2.6, 0]);
  const cmp = ['Insertion', 'Selection', 'Bubble', 'Merge', 'Quick', 'Heap'];
  const zl = ghostBox(BLUE, 7.6, 3.6, 1.2); zl.position.set(-2.6, 2.6, 0);
  const zr = ghostBox(GREEN, 3.0, 3.6, 1.2); zr.position.set(4.6, 2.6, 0);
  tag('Comparison-based', 'ptr', -2.6, 4.9, 0); tag('不比大小', 'ptr', 4.6, 4.9, 0);
  say('Internal sort：資料全在 memory', '');
  await beat(tok, 2000);
  const ms = cmp.map((s, i) => { const m = cube(i + 1, colorFor(i), [2.2, 0.6, 0.8], -5.0 + (i % 3) * 2.4, 3.4 - Math.floor(i / 3) * 1.2, 0, 2.5); relabel(m, s); return m; });
  await beat(tok, 1400);
  tag('最快 O(n log n)', 'ptr alt', -2.6, 1.0, 0);
  say('靠比大小的：最快 n log n', 'decision tree 的高度');
  await beat(tok, 2600);
  const r = cube(9, colorFor(9), [2.2, 0.6, 0.8], 4.6, 3.0, 0, 2.5); relabel(r, 'Radix');
  say('Radix／Bucket：照位數丟籃子', '不用比較');
  await beat(tok, 2400);
  glow(ms[4], GOLD); glow(ms[0], GOLD);
  say('Quick 不一定最 quick：看 pivot', '小規模資料：Insertion 比較好');
  await beat(tok, 2800);
  say('名字裡的形容詞就是它的概念', 'insert、select、bubble、merge（quick 除外）');
  await beat(tok, 3000);
}]);

// 112:26 External sort：4500 筆、memory 750 筆 = 3 個 250 的 block；6 個 run 各排好，再一個 block 一個 block merge
FRAG.push(['sortpeng-external-runs', 'External Sort：6 個 run，用 block 合併', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 2.4, 0]);
  const dk = ghostBox(GRAY, 7.0, 2.6, 1.4); dk.position.set(-3.2, 1.3, 0);
  tag('Disk：4500 筆', 'ptr', -3.2, 3.0, 0);
  const rx = (r) => -6.0 + r * 1.12, by = (b) => 0.35 + b * 0.62;
  const B = [];
  for (let r = 0; r < 6; r++) { B.push([]); for (let b = 0; b < 3; b++) B[r].push(cube(r + 1, colorFor(r), [0.95, 0.5, 0.8], rx(r), by(b), 0)); tag('Run' + (r + 1), 'idx', rx(r), -0.15, 0.8); }
  B.forEach((col) => col.forEach((m) => relabel(m, '250')));
  const mm = ghostBox(BLUE, 4.4, 1.2, 1.4); mm.position.set(3.9, 1.0, 0);
  tag('Memory：750 = 3 個 block', 'ptr alt', 3.9, 2.0, 0);
  const sx = (s) => 2.5 + s * 1.4;
  say('4500 ÷ 750 = 6：切成 6 個 run', '每個 run 750 筆 = 3 個 block');
  await beat(tok, 3000);
  for (let r = 0; r < 6; r++) {
    const slow = r === 0;
    for (let b = 0; b < 3; b++) move(B[r][b], sx(b), 1.0, 0);
    if (slow) say('Run1 讀進 memory 排好', '兩個 block 輸入、一個 block 放 merge 結果');
    await beat(tok, slow ? 1800 : 500);
    for (let b = 0; b < 3; b++) { glow(B[r][b], GREEN); move(B[r][b], rx(r), by(b), 0); }
    if (slow) say('排好的 run 存回 disk', '');
    await beat(tok, slow ? 1500 : 450);
  }
  say('6 個 run 都排好了', '接著 merge 兩個 run');
  await beat(tok, 2000);
  const p = tag('p', 'ptr', rx(0), 2.4, 0), q = tag('q', 'ptr', rx(1), 2.4, 0);
  for (let s = 0; s < 2; s++) {
    const a = B[0][2 - s], b = B[1][2 - s];
    p.position.set(rx(0), by(2 - s) + 0.55, 0); q.position.set(rx(1), by(2 - s) + 0.55, 0);
    move(a, sx(0), 1.0, 0); move(b, sx(1), 1.0, 0);
    say('p → Run1 的 block、q → Run2 的 block', '讀進 memory 的前兩格');
    await beat(tok, 1600);
    const o = cube(250, GOLD, [0.95, 0.5, 0.8], sx(2), 1.0, 0, 1.5);
    say('block 裡再用兩個指標比大小', '結果寫進第三個 block');
    await beat(tok, 1600);
    move(o, -2.4 + s * 1.0, 3.7, 0);
    say('輸出 block 滿了就存回 disk', '單位是 block，不是一個數字');
    await beat(tok, 1400);
    kill(a); kill(b);
  }
  say('Run1 + Run2 → 1500 筆的 run，一輪一輪合併', '概念 = merge sort');
  await beat(tok, 3000);
}]);

// 120:30 merge 順序：weighted external path length，2 4 5 15 → 43 vs 52；Huffman 決定最佳順序
FRAG.push(['sortpeng-merge-order', 'Merge 順序：weighted external path length', async (tok) => {
  fresh([0, 6.2, 12.5], [0, 3, 0]);
  const node = (v, x, y, c, d = 0) => cube(v, c || colorFor(v), [0.75, 0.75, 0.75], x, y, 0, d);
  // left tree: ((2+4)+5)+15
  const Lp = { r: [-3.6, 5.4], a: [-4.8, 4.1], b: [-5.7, 2.8], l2: [-6.3, 1.5], l4: [-5.1, 1.5], l5: [-3.9, 2.8], l15: [-2.4, 4.1] };
  const Rp = { r: [3.6, 5.4], a: [2.1, 4.0], b: [5.1, 4.0], l2: [1.4, 2.6], l4: [2.8, 2.6], l5: [4.4, 2.6], l15: [5.8, 2.6] };
  const ed = (P, a, b) => line(P[a][0], P[a][1], P[b][0], P[b][1], 0);
  ['l2', 'l4', 'l5', 'l15'].forEach((k) => { node(+k.slice(1), Lp[k][0], Lp[k][1]); node(+k.slice(1), Rp[k][0], Rp[k][1]); });
  say('四個 run：2、4、5、15 個 block', 'merge 的順序有影響');
  await beat(tok, 2600);
  ed(Lp, 'b', 'l2'); ed(Lp, 'b', 'l4'); node(6, Lp.b[0], Lp.b[1], GRAY, 1.5);
  say('左：2 和 4 先 merge', ''); await beat(tok, 1200);
  ed(Lp, 'a', 'b'); ed(Lp, 'a', 'l5'); node(11, Lp.a[0], Lp.a[1], GRAY, 1.5); await beat(tok, 1000);
  ed(Lp, 'r', 'a'); ed(Lp, 'r', 'l15'); node(26, Lp.r[0], Lp.r[1], GRAY, 1.5); await beat(tok, 1000);
  tag('2×3 + 4×3 + 5×2 + 15×1 = 43', 'ptr alt', -3.6, 0.3, 0);
  say('每個 run 的 block 數 × 被 merge 幾次', '2 要 merge 3 次 → 2×3');
  await beat(tok, 3000);
  ed(Rp, 'a', 'l2'); ed(Rp, 'a', 'l4'); ed(Rp, 'b', 'l5'); ed(Rp, 'b', 'l15');
  node(6, Rp.a[0], Rp.a[1], GRAY, 1.5); node(20, Rp.b[0], Rp.b[1], GRAY, 1.5); await beat(tok, 1000);
  ed(Rp, 'r', 'a'); ed(Rp, 'r', 'b'); node(26, Rp.r[0], Rp.r[1], GRAY, 1.5); await beat(tok, 1000);
  tag('(2 + 4 + 5 + 15) × 2 = 52', 'ptr alt', 3.6, 0.3, 0);
  say('右：兩兩平衡地 merge', '最大的 15 也要 merge 兩次 → 30');
  await beat(tok, 3000);
  say('43 < 52：平衡的反而比較貴', 'cost 越小越好');
  await beat(tok, 2600);
  say('最佳順序 = Huffman：每次合併最小的兩個', '2+4 → 6，6+5 → 11，11+15 → 26 = 左邊那棵');
  await beat(tok, 3400);
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
