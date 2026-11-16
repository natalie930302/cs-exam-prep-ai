# BST、AVL Tree、Red-Black Tree

要同時「快速搜尋」又「快速插入刪除」，sorted array、sorted list、heap 都做不到，binary search tree（BST）可以，但它的成本是 O(h)：插入順序不好時樹會退化成一條 linked list，h 變成 n。這章先學 BST 與 skip list，再學兩種讓樹保持 O(log n) 高度的平衡樹：靠旋轉維持的 AVL tree，以及從 2-3-4 tree 對應過來的 red-black tree；中間也介紹依搜尋機率建最佳樹的 optimal BST，以及給磁碟用的 B-tree、2-3 tree。考試重點是 BST 操作、AVL 四種旋轉與平衡因子，以及紅黑樹的性質。

## 學完這章要會
- BST 的定義、搜尋、插入、刪除（0／1／2 個 child），以及 min、max、successor、rank
- 知道 BST 的操作都是 O(h)，插入順序決定樹高，最壞退化成 O(n)
- 算每個 node 的高度與 balance factor，判斷是否為 AVL tree
- 證明 AVL tree 的高度是 O(log n)（最稀疏 AVL 與 Fibonacci）
- 分辨 LL、RR、LR、RL 四種失衡並做正確的旋轉，插入與刪除後沿路更新高度
- 用 dynamic programming 算 optimal BST 的 w、c、r 表
- B-tree、2-3 tree 的插入（split）與刪除（rotate、combine）
- 2-3-4 tree 與紅黑樹的對應；紅黑樹的性質與高度上界
- 紅黑樹插入（紅叔變色、黑叔旋轉）與刪除的各種情形；最後 root 要塗黑

## 為什麼需要 BST：跑道預約系統

二元搜尋樹（binary search tree，BST）和 binary search 是同一個想法：每次看中間、砍掉一半。差別在於 BST 的資料會一直變動（插入、刪除），binary search 則假設資料是固定排好的陣列。

### 問題

機場只有一條跑道，要寫一個降落預約系統（runway reservation）：

- 預約的是未來的降落時間 t，時間視為連續的實數（實作上用 64-bit 數字表示，假設時間單調遞增）。
- 要求在時間 t 降落時，如果前後 k 分鐘內沒有別的降落，就把 t 加進集合 R；否則拒絕。這其實是一個「帶條件的 insert」。
- 飛機降落後，要把那個時間從 R 刪掉（delete）。
- k 是參數，以下例子都用 k = 3 分鐘。
- 目標：所有操作都要 O(log n)，n = |R|。

> **例題** 現在時間是 37，R = {41.2, 49, 56.3}，k = 3。
> - 要求 53：比 49 晚 4、比 56.3 早 3.3，兩邊都至少 3 分鐘 → 接受。
> - 要求 44：離 41.2 只差 2.8 → 太近，拒絕。
> - 要求 20：現在已經 37 了，不能排在過去 → 拒絕。

### 把學過的結構一個一個拿來試

**unsorted array / list**：幾乎每件事都是線性時間。不做檢查的話 insert 是 O(1)（接在最後），但 k 分鐘檢查要掃整個 array，O(n)。

**sorted array**：可以用 binary search 找插入位置。

> **例題** R = [4, 20, 32, 37, 45]，要插入 t = 34。先看中間的 32：34 > 32，左半邊整個不用看，往右半邊找。找到插入點後，只要跟左右鄰居 32、37 比，就完成 k 分鐘檢查。（以 k = 3 而言，34 離 32 只差 2，其實會被拒；這裡只是示範代價。）

精確地說：binary search 找最小的 i 使 R[i] ≥ t，O(log n)；比較 R[i] 與 R[i−1] 只要 O(1)。但真正把 34 塞進去時，陣列是連續的，37、45 都要往右搬一格（shift），最壞 O(n)。

**sorted linked list**：找到插入點後，改兩個指標就接進去，O(1)。問題是 list 沒有 random access，不能直接跳到第 n/2 格做 binary search，找位置要 O(n)。

> **重點** list 會插入、array 會搜尋，各只做對一半。我們要的是搜尋和插入都快的結構。

**heap**：heap 的 invariant 很弱，只保證 parent ≤ 自己的 children（min-heap），也就是 root 最小。拿最小值 O(1)，但要找 t 附近 k 以內的值，就得 O(n)。

> **例題** 一棵 min-heap：21 在上，children 是 23 和 30。插入 25：先放在最後一格（30 底下），跟 parent 30 比，25 比較小就交換；再跟 21 比，21 < 25，停。整個過程完全沒看過 23 那一邊；如果那邊有一個 24，離 25 只差 1，插入時根本不會發現。要檢查只能另外去掃，O(n)。

**dictionary（hash table）**：也有一樣的問題，hash 打散了大小順序，找不到「t 附近」的值。

最接近的還是 sorted array：只要能「快速插入的 sorted array」，問題就解決了，這正是 BST。BST 的 invariant 比 heap 強，是不同的資料結構，對這題比較好。

## 另一條路：從 linked list 長出 skip list

### 用什麼結構做 Map

Map（給 key 找 value）可以用 array 延伸出來的 hash 來做；也可以想想 linked list 和 tree 能不能拿來做 map。

> **觀念** 順帶整理幾個 hash 與 map 的問題：
> - 問：open addressing 把資料放到附近的格子，下次怎麼確定拿到的是自己要的那筆？答：資料可能不在 key 原本對應的位置，同一格可能放著來自不同 key 的資料，所以 table 裡一定要把 key 和 value 一起存，查的時候比對 key。可以把 open addressing 想成在同一塊空間裡串了很多條 implicit linked list，就像 array 隱含一棵 complete binary tree。
> - TinyURL 可以看成一個 map：短網址後面那串是 key，原本的網址是 value。
> - perfect hash：例如 32 個 keyword 要一對一放進 32 個 bucket。

**extendible hashing 回顧**：hash function 可以擴充，例如本來 mod 4，改成 mod 8。

- naive 做法：每個 key 都重新 hash，例如 cat（c 開頭）放 [2]、good（g 開頭）放 [6]，但這是重複的力氣。
- lazy 做法：只有滿出來的那一格才重新分。還沒分家的格子只在 [6] 留一張小紙條：「要找 [6] 的去 [2] 找」，兩格共用同一串。
- 再塞一個 c 開頭的字（例如 cool）讓那串超過上限，這時才真的分家：good 搬去 [6]，cat 和 cool 留下。
- 連新的一格都放不下，才再 extend 整個 hash table 的大小。

**直接用 linked list 做 map**：

- key 不能比大小時只能串成一串，找任何東西都要整條走過去逐一比對。unordered list：insertion 很快，search 很慢。
- array 能快是因為 random access；linked list 沒有辦法快速標出東西在哪。
- 就算排好序（ordered），linked list 也不能做 binary search，還是 slow search；而且 ordered list 還有 slow insertion：要先找到插在哪。

### 快車：把中點另外存起來

slow search 的原因是只能 sequential，像每站都停的慢車。binary search 需要兩個條件：資料排好、而且能很快找到中點。linked list 找不到中點，那就用額外空間把中點存起來。

> **比喻** 高鐵、台鐵快車只停大站，到了大站再轉車去小站；機場快線也是同樣的道理，交通上的快慢車就是在節省運輸資源。

8 筆資料 2 4 5 9 10 11 15 20，中點是 9；找 10 時先跟 9 比，10 在 9 後面，一次消掉一半。9 之後再存一個像四分位點的「中點 2 號」11：10 < 11，就在 9 和 11 之間找。把這些中點整理起來，就是在普通車之外加一條「兩站一停」的快車：

```
快車:   head ──────→ 4 ──────→ 9 ───────→ 11 ───────→ 20
普通車: head → 2 → 4 → 5 → 9 → 10 → 11 → 15 → 20
```

找 10：坐快車經過 4、9，到 11 發現過頭了，就在 9 這站轉普通車，下一站就是 10。10 排第 5 個，原本要比 5 次；現在比 4、9、11 再回頭，大約 3～4 次。

快車就是最低層級的一些中點：binary search 是 top-down 地想（先找整體中點），這裡是 bottom-up 地想（先在底層兩兩取一）。

### 特快車、超快車：Skip List

在快車上面再兩個一數，做一班特快車：9、20；最上面再加一條只有 9 的超快車，它就是 binary search 的第一個中點。

```
超快車: head ─────────────────→ 9
特快車: head ─────────────────→ 9 ─────────────────────→ 20
快車:   head ──────→ 4 ──────→ 9 ───────→ 11 ───────→ 20
普通車: head → 2 → 4 → 5 → 9 → 10 → 11 → 15 → 20
```

找 15：特快車到 9，下一站 20 過頭，在 9 往下換快車；快車從 9 走到 11，20 又過頭，在 11 往下；普通車從 11 一站就到 15。有效比較的 node 幾乎只有 9、11、15（再加上跟 20 比兩次）。

ordered linked list 加上一堆更快的 linked list，就叫 **Skip List**。從上往下看是 list of mid、list of quad……，search 像一個 zooming 的過程。每層大約砍一半，約 log N 層，search 大約 log N 次比較。

> **陷阱** 這裡畫的是「每層剛好砍一半」的理想版。實際用丟銅板決定層數的隨機 skip list，搜尋只有「期望」O(log n)，最差仍可能 O(n)。保證最差 O(log n) 的是 AVL、紅黑樹這類平衡樹。

### Skip list 的空間

問：skip list 很吃記憶體嗎？

- 底層 n 個；兩兩一數的快車約 n/2；四個一數約 n/4，再上去 n/8、n/16……
- 1/2 + 1/4 + 1/8 + … ≤ 1：上面各層加起來最多再一條 list，大約多花一倍空間，換到快速搜尋。
- 每個箭頭也是一張小紙條，會多一些，但只是常數倍，空間仍是 O(n)。
- 有時不能多花一倍，例如要求只用一棵 tree 實作 double-ended priority queue。

### 怎麼實作

- 可以真的維護好幾條不同的 linked list；也可以在原本的 node 上標註「普通車、快車……各自的下一站在哪」。
- 通常不複製資料（連 key 都可能太大），只多存 pointer。
- 圖上畫單箭頭，也可以用雙箭頭：好做，但更吃記憶體。

### 再看一個例子：找 9、找 6

```
最上層:          8
中間層:   3 ──→ 8 ──→ 13
底層:  2 → 3 → 5 → 8 → 9 → 10 → 13
```

上下各層的 3（或 8）其實是同一個元素。

- 找 9：從 8 進來，9 > 8 往右但這層沒了，往下；中間層下一站 13 過頭，在 8 再往下；底層 8 的下一站就是 9，找到。
- 找不存在的 6：8 已經過頭，回到 3；3 往右到 5，下一個已經是 8，所以沒有 6。

（標準 skip list 是從 head 的最高層出發，往右比、過頭就往下一層；「從 8 進來、過頭回到 3」是為了對應 binary search 的講法。）

### 插入怎麼辦：丟銅板

以上只講了 search。ordered list 的兩個缺點：slow search 已經用快車解決，slow insertion 還沒。亂序資料要排成 ordered linked list，本質上就是 insertion sort；skip list 一次插入可能要動很多條 list，看起來只會更慢。

> **例題** 在底層 2 3 5 8 9 10 13 插入 6。找不到 6 時已經停在 5 和 8 中間，底層的插入是 linked list 的強項：改兩張小紙條，5、6、8 就連起來。問題是上面各層：如果堅持嚴格「兩兩一數」，上一層要從 3、8、13 變成 3、6、9、13，再上一層也要改……每一層都要更新。上面各層 node 加起來約等於底層的 n 個，一次 insertion 就是 O(n)。

> **觀念** 所有資料結構和演算法的設計，其實都在想辦法偷懶。成本來自「嚴格規定」兩兩一數、四四一數；就像 extendible hash 還不用分家就先共用。

放鬆規則：「差不多」兩兩一數就好。

1. 6 先放進底層。
2. 丟銅板：正面就在上一層也放一個 6，反面就停。
3. 上去了就再丟一次，決定要不要上上層。

所以一個元素在第二層的機率是 1/2，第三層是 1/4……期望上約一半的點在第二層、1/4 在第三層。插入時只要更新 1 層的機率 1/2、更新 2 層的機率 1/4……平均很少，而且每次都只是普通的 linked list 插入。

這是少數的 randomized data structure（以後還會看到 randomization，例如 QuickSort）。removal 也需要一定的 randomization，這裡不細講。skip list 其實很好實作：有 linked list library 就能快速寫出一個 map。

### 從 skip list 長出 BST

把 skip list 畫出來，看起來很像一棵 tree。拿一個「龜毛」地照規則建出來（不是隨機建）的 skip list：

```
最上層:        8
中間層:   3 ── 8 ── 13
底層:  2  3  5  8  10  13
```

- 找 2：從 8 進來，8 過頭往 3，3 還是過頭，找到 2。走 8、3、2。
- 找 5：8 過頭回到 3，從 3 往右找到 5。走 8、3、5。
- 找 10：8 → 13 過頭 → 往左找到 10。走 8、13、10。

每一站都只有「往左」或「往右」兩種走法。把搜尋時碰到的點和左右關係另外畫出來，就是一棵 binary tree，最先比的中點 8 就是 root：

```
        8
      /   \
     3     13
    / \   /
   2   5 10
```

從 8 往左的都比 8 小，往右的都比 8 大；每棵 subtree 都一樣。有這個性質的 binary tree，就叫 **Binary Search Tree**。

小結：skip list 的 search 靠類似 binary search 的快慢車，insertion 靠 randomization；BST 則把「中點」直接做成樹的結構。

## BST 的定義與零件

### Node 的結構

BST 由 0 個或更多 node 組成，是真正用指標串起來的樹（不像 heap 可以隱含在 array 裡）：

- value（或 key）：可以存任何一種資料項目。
- left：指向左子的 pointer，可以是 NULL。
- right：指向右子的 pointer，可以是 NULL。
- 有些寫法再加一個 parent pointer（每個 node 有 key 以及 parent、left、right 三個指標）。

binary tree 和 BST 的 node 結構一樣，BST 多的是 key 的大小規則。

### Root、leaf、path、depth

```
          8
        /   \
       3     10
      / \      \
     1   6      14
        / \    /
       4   7  13
```

- binary tree 可以是空的（0 個 node）；非空就有一個 root，是整棵樹的起點，找東西都從它出發。
- 每個 node 從 root 走過去只有唯一一條路，例如 7 的路徑是 8、3、6、7。
- 左右都沒有孩子的 node 叫 leaf：這棵的 leaf 是 1、4、7、13。
- depth 是離 root 的距離，root 在第 0 層。

### BST 性質

對所有 node x、y：

- 若 y 在 x 的左子樹，key(y) < key(x)（或 ≤）。
- 若 y 在 x 的右子樹，key(y) > key(x)（或 ≥）。

> **重點** 看的是「整棵子樹」，不是只看直接的孩子，所以 BST 的規則比 heap 強。例如 root 30、左子 17、17 底下 14 和 20：30 的左邊整棵都比 30 小、右邊整棵都比 30 大；中間的 17 也要成立：14 < 17 < 20。

> **陷阱** 有的寫法用嚴格的 < 和 >，不放重複的 key；有的寫 ≤ / ≥，允許重複時要另外規定相等的放哪一邊。

建 BST 就是照「左小右大」一路放下去：比 root 小放左邊、比 root 大放右邊，進到子樹再做同樣的事。

### 例題：造一棵 size 9、depth 3 的 BST

> **例題** 造一棵 size 9、depth 3、root 為 8 的 BST，leaf 必須剛好是 1、4、7、13。

1. size 9 = 共 9 個 node；1、4、7、13 不能有孩子。
2. 8 當 root；左子放比 8 小的 3，右子放比 8 大的 10。
3. 1 < 3，放 3 的左邊（leaf）；3 的右邊放 6；4 < 6 放 6 的左、7 > 6 放 6 的右。1、4、7 都是 leaf。
4. 右邊：14 > 10 放 10 的右邊；13 < 14 放 14 的左邊（leaf）。
5. depth：8 → 10 → 14 → 13 要走 3 步，depth = 3。數 node：8、3、10、1、6、14、4、7、13，共 9 個。

得到的就是上一小節畫的那棵樹。

> **陷阱** depth／height 的起算點有不同慣例：這裡 root 在第 0 層；Horowitz（洪逸）等課本的 level 從 1 算，這棵樹就是 4 層。題目問深度、高度時先看用哪個慣例。

## BST 的基本操作

### Search：BST 就是 binary search

binary search 需要中點，BST 的中點就是 root。跟 root 比：小就去左 subtree，大就去右 subtree；進到 subtree 再做一模一樣的事，這就是 recursive call。例如在上面那棵樹找 7：7 < 8 去左邊，右邊整片不用看，這就是 binary search 的偷吃步。

```
BSTSearch(T, key):
    if T is empty: return NOT_FOUND      // 終止條件，不能少
    if key == T.key: return T.value
    if key <  T.key: return BSTSearch(T.left, key)
    else:            return BSTSearch(T.right, key)
```

> **陷阱** 第一行的終止條件「T 是空的就回傳找不到」很容易漏掉；沒有它，找不存在的 key 時會一直往下呼叫停不下來。

### 搜尋次數看樹高

```
         40
        /  \
      20    50
     /  \     \
   10    30    60
```

- 找 30：40 不是，30 < 40 往左；20 不是，30 > 20 往右；第 3 次比較找到。
- 找 60：60 > 40 往右，60 > 50 再往右，也是 3 次。
- 找不存在的 32：32 < 40 往左、32 > 20 往右、32 > 30 往右，右邊是空的 → 搜尋失敗（unsuccessful），一樣比了 3 次。

搜尋可能成功也可能失敗，但「最多比幾次」看的是樹的高度。這棵以層數算高度是 3（以邊數算是 2）。n 個 node 的 binary tree，高度最小約 log n、最大可到 n。

### Insert：在「該找到卻找不到」的地方放進去

插入就是搜尋：沿著比大小往下走，走到空的地方就放進去。每次只走一條路。

> **例題** 從空樹依序插入 49、79、46、41。

```
插 49:   49        插 79:   49        插 46:    49        插 41:     49
                              \                 /  \                /  \
                               79             46    79            46    79
                                                                 /
                                                               41
```

49 直接當 root；79 > 49 接右邊；46 < 49 接左邊；41 < 49、41 < 46，接成 46 的左子。

另一個例子：在 in-order 為 11、20、26、29、41、50、65 的樹（見後面 AVL 插入例）插 30：30 < 41 往左、30 > 20 往右、30 > 29 往右，走到沒有東西的地方，30 成為 29 的右 child。

### 插入時順便做 k 分鐘檢查

BST 的好處：找插入位置的同時就能做檢查。

> **例題** 樹是上面的 49（左 46、46 的左 41；右 79），k = 3。
> - 要求 42：42 vs 49 差 7，OK，往左；42 vs 46 差 4，OK，往左；42 vs 41 只差 1 → 違反安全條件，拒絕。
> - 要求 45：45 vs 49 差 4，通過；45 vs 46 只差 1 → 失敗。

為什麼只檢查路徑上的 node 就夠？因為 t 在排序中的前一個（predecessor）和後一個（successor）一定在搜尋路徑上。不管有沒有檢查，insert 都只走一條路，最多 h 步（h 是樹高），所以是 O(h)。

由左往右讀，這棵 BST 就是排好的 41、46、49、79，像 sorted array 加上指標。

### Find 與重複的 key

find 46：從 49 往左就找到，回傳的是指向那筆 record 的指標；拿到指標可以讀資料，也可以直接覆蓋。想放重複的 key 也行，叫 multiset，但要能分辨同 key 的元素，例如 46a、46b。

問：樹不平衡會怎樣？目前只說到 O(h)，還不是想要的 O(log n)，這是後面整章要解決的問題。

### Min、max、next-larger

- min：一直往左走。49 → 46 → 41，最小是 41。
- max：一直往右走。49 → 79。
- next-larger(x)：比 x 大的下一個值（successor），例如 next-larger(46) = 49。對應的還有 predecessor（next-smaller）。

這些都最多走樹高那麼多步，O(h)。對照：min-heap 找最小是 O(1)，直接回傳 root。很多 BST 操作都能在 O(h) 做完，有些甚至 O(1)。

BST 的操作 min、max、insert、delete、find（search）、successor、predecessor 全部都是 O(h)。

### In-order traversal：BST 是動態的排序

BST 可以看成「動態的排序」：資料進進出出，順序隨時知道。BST = rooted binary tree + 每個 node 存 key + search property。要印出順序，就用 in-order traversal：遞迴走左、印自己、遞迴走右。

```
            41
          /    \
        20      65
       /  \    /
     11    29 50
          /
        26
```

in-order 印出 11、20、26、29、41、50、65，剛好由小到大。

## Augmentation：多記子樹大小，算 rank

新需求：rank(t) = 降落時間 ≤ t 的飛機有幾架，而且不能讓 O(h) 變慢。做法：每個 node 多記一個數字，這叫 augmented BST。

記的是**子樹大小（含自己）**：

```
插入 43 之前                    插入 43 之後
       49(5)                          49(6)
      /     \                        /     \
   46(1)    79(3)                 46(2)    79(3)
            /   \                 /        /   \
         64(1)  83(1)          43(1)    64(1)  83(1)
```

- leaf 是 1；79 底下有 64、83，所以是 3；49 是 5。
- insert 43：沿插入路徑走，經過的 node 都 +1：49 變 6、46 變 2，新 node 43 的 size = 1。
- 有 k 分鐘檢查時：先做一般 insert（含檢查），成功了再沿路把 size 加 1；走兩次還是 O(h)。

**用子樹大小算 rank(t)**：沿搜尋 t 的路徑走；遇到 key ≤ t 的 node，就加 1（自己），再加它左子樹的 size。

> **例題** 在插入 43 後的樹算 rank(79)。
> 1. 49 ≤ 79：加 1；往右走時，49 左邊那棵（46 子樹）一定都比 79 小，直接加它的 size 2，不用走進去。
> 2. 79 ≤ 79：加 1，再加 79 左邊 64 那棵的 size 1。
> 3. 合計 1 + 2 + 1 + 1 = 5。驗證：≤ 79 的有 43、46、49、64、79，正好 5 個。只走一條路徑，O(h)。

> **陷阱** rank(78) 的路徑和 rank(79) 一樣，但 79 不 ≤ 78，不能加 79 自己那一項：rank(78) = 1 + 2 + 1（64 子樹）= 4。

同樣的手法可以在 node 多維護其他值（例如子樹的最小值），只要它能用 children 的值在 O(1) 算出來。

## BST 的刪除：調整指標就好

問：刪掉 79，要把整棵樹拆掉重建嗎？不用，只要調整幾個指標。

```
刪除 79 之前                刪除 79 之後
       49                         49
      /  \                       /  \
    46    79                   46    83
   /     /  \                 /     /
 43    64    83             43    64
```

79 有兩個孩子，就找右子樹最小的（inorder successor）83 上來頂替；83 剛好是 79 的右子、沒有左子，所以直接上移，原本的 64 改接成 83 的左子，左小右大照樣成立。

整理刪除的三種情況：

1. 沒有孩子：直接拿掉。
2. 一個孩子：讓孩子接上原本的位置。
3. 兩個孩子：找右子樹最小（或左子樹最大）的 node 來補位，再刪掉那個補位 node（它最多只有一個孩子，回到情況 1 或 2）。

## 樹高的問題：插入順序決定一切

### 壞消息：h 可能是 O(n)

依序插入已排序的 43、46、48、49……，長出來的不像樹，像一條 list。需要 balanced BST，讓 h = O(log n)，前面說的 O(h) 才都變成 O(log n)。

### 同一組 key、不同順序

> **例題** 7 個 key 依序插入 30、40、10、50、20、5、35，每個 key 都從 root 開始比。

```
          30
        /    \
      10      40
     /  \    /  \
    5    20 35   50
```

如果又來一個 50，比到已經有了就不放：BST 不放重複的 key。這棵高度 3（層數），大約 log n，是最矮的。

換成 50、40、35、30、20、10、5，每個都比前面小，一路往左下長：

```
            50
           /
         40
        /
      35
     /
   30
   ...
  /
 5
```

高度變成 n = 7；找 5 要比 7 次，跟 linear search 一樣。

> **重點** BST 的問題：高度不受控制，全看 key 進來的順序。

### 3 個 key 的 3! = 6 種順序

```
30,20,10      30,10,20      10,30,20      10,20,30      20,10,30 與 20,30,10
    30           30          10            10                 20
   /            /              \             \               /  \
  20          10                30            20           10    30
 /              \              /                \
10               20          20                  30
```

只有 20 先進來的兩種得到平衡的樹（高度 2，最小）；其他四種都歪成一條（高度 3）。我們想要最小高度的 BST，搜尋時間才會短。拿到高的形狀總不能丟掉重來，所以要有一套把高樹轉成矮樹的程序：rotation。

### 歪掉的月份樹

12 個月份照字母順序插入（APR、AUG、DEC、FEB、JAN、JULY、JUNE、MAR、MAY、NOV、OCT、SEPT），每個都比前面大，歪成一條 skewed binary search tree。找 SEPT 要從 root 一路比到底，最多比 12 次；平均比較次數 = (1 + 2 + … + 12) / 12 = 78 / 12 = 6.5。同樣 12 個月份排成 AVL tree，最多只要比 5 次（見後面的完整例題）。

### O(h) 的最好與最壞

搜尋從 root 一路往某個 subtree 走，直到沒有為止，走的是 root 到某個 leaf 的路徑，花的力氣就是樹高：O(h)。

- worst case：很高的樹就是偽裝的 linked list，h = n，O(h) = O(n)。例如 8 → 5 → 3 → 2 一路往下，找 2 要走 4 個 node，跟 linked list 一樣。
- best case：像 complete binary tree 那麼矮，h ≈ log n。理想的 perfectly balanced tree 每一層都排滿；n 個 key 放進 binary tree，高度至少約 log n（每層最多翻倍）。
- 最糟是一條 path：height = n，就算平均也有 n/2。

height 的定義：從 root 往下到 leaf 的最長路徑長度。**balanced** 的正式定義：height = O(log n)。

> **陷阱** 不平衡的 BST 會退化成 linked list，失去 O(log n)，搜尋、插入、刪除都變成 O(n)。考題給一串已排序（或接近排序）的 key 依序插入時，要立刻想到這點。

在 heap 那裡成功過一次：max tree 加上 complete 的限制就變得好用。這次也想在 BST 上加條件，讓樹高低一點。

## 要加多少限制：寬鬆到嚴格

資料結構設計有很多 trade-off。畫一條線，左邊限制寬鬆、右邊限制嚴格：

```
寬鬆 ←───────────────────────────────────────────→ 嚴格
一般 BST        紅黑樹        AVL tree        complete BST
```

| 結構 | 插入後的維護 | 最差搜尋 |
|---|---|---|
| 一般（arbitrary）BST | 幾乎不用，隨便找位置放 | O(n) |
| 紅黑樹（Red-Black tree） | 常數次調整 | O(log n) |
| AVL tree | 常數次調整 | O(log n) |
| complete BST | O(n) | O(log n) |

- 最寬鬆的一般 BST 顧不住樹高。
- 最嚴格的是要求 BST 也是 complete binary tree，其實就是 ordered array 換個樣子：樹高一定是 log n，但插入後要花 O(n)，才能把每個蘿蔔放回唯一的坑。
- 中間的 AVL 和紅黑樹：插入後只要常數次的結構調整，最差搜尋仍是 O(log n)。

> **陷阱** 「常數次調整」指的是旋轉（結構調整）的次數是常數；insert 本身要先 O(log n) 往下找，再沿路往回更新高度，所以整體仍是 O(log n)。

### 為什麼 complete BST 難維護

> **例題** complete BST 放 1、2、3：只能 root 2、左 1、右 3，array 是 [2, 1, 3]。插入 4 後，又要 complete 又要 BST，只能長成：

```
插入 4 之前        插入 4 之後
     2                  3
    / \                / \
   1   3              2   4
                     /
                    1
array [2, 1, 3]     array [3, 2, 4, 1]
```

原本的三個元素全部換了位置，跟 ordered array 插入一樣大家都要讓開，O(n)。heap 的插入只修「最後一格到 root」那一條 path；BST 的性質更強，只修一條 path 不夠。

### AVL 還是紅黑樹

兩者複雜度看起來一樣，但在這條線上的位置不同：紅黑樹在 AVL 左邊一點（較寬鬆）。中間其實有很多種選擇，挑這兩種是因為有代表性又實用。

- AVL：easy to teach。比較嚴格，建樹時可能旋轉很多次。
- 紅黑樹：faster in general，指的是維護比較快、比較能適應動態調整，因為它比較寬鬆；search 稍慢一點點。實務上比較常用紅黑樹，但它難教，所以先學 AVL。

> **重點** 一句話：AVL 搜尋稍快、插入稍慢；紅黑樹剛好相反。

## 每個 node 的高度

### 定義

- depth：從上往下數，root 是 0。
- height（某個 node 的）：從這個 node 往下走到 leaf，最長那條路有多長。leaf 的 height 是 0。

```
              41 (3)
            /       \
        20 (2)      65 (1)
       /     \      /
   11 (0)  29 (1) 50 (0)
           /
        26 (0)
```

公式：**height(x) = max(height(x.left), height(x.right)) + 1**。

> **重點** 空的 child 高度定成 −1：leaf 就是 max(−1, −1) + 1 = 0，公式不用寫特例。這只是縮短程式的技巧。

像記子樹大小一樣，用 augmentation 讓每個 node 存自己的 height。因為只靠 children 的 local formula，就能以 O(1) 額外成本維護。AVL 需要隨時 O(1) 讀到節點高度，每次往下重算太慢，所以一定要存起來。

> **陷阱** 高度有兩種慣例：數邊（leaf = 0、NULL = −1）與數層（Horowitz：leaf = 1、空樹 = 0）。左右的差值兩種算法一樣，所以 balance factor 不受影響；但題目問「高度」或「最少節點數」時，要看是哪個慣例。

## AVL tree 的定義

AVL 是兩位發明人 Adelson-Velsky 和 Landis 的縮寫，1962 年就有了，是最早被發明、到現在仍然最簡單的平衡樹方法。

AVL tree 是一棵 BST，再加上 height balanced 的條件：

1. 左右子樹 T_L、T_R 本身也都是 height balanced。
2. |h_L − h_R| ≤ 1：左右兩邊的高度相差不超過 1。

這是遞迴定義：任挑一個 node，它的左右子樹都要符合。要求差 0 不可能（等於強迫成完美的樹，n 不剛好就做不到）；差 1 幾乎一樣好，而且可以在 log n 時間維持。

### Balance factor

每個 node 定一個 balance factor（平衡因子）：

**BF = h_L − h_R**（BF 不是 boyfriend）

- 不取絕對值：正的是左邊高，負的是右邊高。
- AVL 每個 node 的 BF 只能是 −1、0、+1（也可以寫成 |BF| ≤ 1）。所有維護都在保持這三種值。
- leaf 的 BF 一定是 0。
- 只要有一個 node 的 BF 超出這三個值，就是 imbalanced，要做 rotation。
- 而且是每插一個就檢查、就調整，不是全部插完才回頭修。

> **例題** 只看形狀算 BF（高度數「邊」，不是數 node）。
> - 第一棵：root 左右最長都走 2 步，BF = 0；兩個 node 各是左 1、右 0，BF = 1；leaf 都是 0。BF 依序為 0、1、1、0、0，全部在範圍內，平衡。
> - 第二棵：root 左邊最長 3 條邊、右邊 1 條，BF = 3 − 1 = 2，失衡；另有一個 node 左 0、右 2，BF = −2，也失衡。
> - 第三棵：root 左 1、右 3，BF = −2，失衡。
> 後兩棵都不是 AVL。

### 看高度，不看節點數

> **例題** 某棵樹的 node 3 左邊有一棵 2 個 node 的子樹、右邊是空的。如果說「左邊 2、右邊 0」，那是節點數，不是高度。換成高度：左邊高 1，右邊空的算 −1，差 2 → 不是 AVL。
> 反過來，一棵樹 root 左邊 3 個 node、右邊 1 個：節點數差 2，但高度只差 1（左 1、右 0）→ 是合格的 AVL。

> **重點** AVL 不管節點數，只管高度。核心性質（rep invariant）：每一個 node 的左右子樹高度最多差 1；嚴格來說還要加上「它是 BST」，所以程式裡 AVL 類別直接繼承（inherit）BST。

### 胡蘿蔔樹：只看 root 不夠

> **例題** 依序插入 4、5、3、6、2、7、1（不做任何調整），左右各自往外長，像根胡蘿蔔：

```
            4
          /   \
         3     5
        /       \
       2         6
      /           \
     1             7
```

只看 root：左邊（3、2、1）和右邊（5、6、7）都高 2，看起來很平衡。但看 node 3：左邊 2 那棵高 1，右邊空的是 −1，差 2，不平衡；5 也一樣（左 −1、右 1）。AVL 的條件要每一個 node 都成立，有一個不平衡，整棵就不是 AVL。rebalance 的目標就是轉完以後每個 node 都平衡。

### 任何 n 都排得出 AVL

問：任何個數的 node（例如 13 個、17 個）都能排成 AVL 嗎？

- 一個答案：一個一個呼叫 AVL insert，結果自然就是 AVL。
- 另一個答案：complete tree。形狀跟 heap 一樣，只是照中序放 1 到 13（heap 的值不符合 BST 順序）。任何 complete tree 都一定是 AVL：只有最後一層沒填滿，root 到底的路徑長度是 log n 或 log n − 1，任何地方高度差都 ≤ 1。

> **陷阱** 這種「最矮的樹」有時被隨口叫成 optimal BST，但課本的 optimal binary search tree 是依存取機率求最小搜尋成本的 BST（用動態規劃求），兩者不要混用。

## AVL 的高度是 O(log n)

一般 BST 最壞會長成一條 list，高度 O(n)；在乎 AVL，是因為它的高度保證是 O(log n)。

### 想法：固定高度，用最少節點蓋樹

反過來問：高度固定是 h，最少要幾個 node？高度大、節點少，就是最稀疏、最糟的 AVL。

> **觀念** 問：要建好的樹不是應該讓高度越小越好嗎？答：那是在想怎麼建好樹；這裡是在證明高度的上界，要扮 devil's advocate：寫完演算法，先想怎麼把它弄壞，找最糟的 AVL 長什麼樣；找不到反例才能安心。

以數邊的高度（leaf = 0）蓋最省的 AVL：

- h = 0：只有一個 node。
- h = 1：最少 2 個 node。
- h = 2：不能用一條 3 個 node 的鏈（root 左右高度差會是 2），另一邊至少要放一棵 h = 0 的樹 → 4 個。
- h = 3：一邊放最省的 h = 2（4 個），另一邊放最省的 h = 1（2 個），加 root → 7 個。

```
h=0    h=1     h=2         h=3
 o      o       o             o
         \     / \          /   \
          o   o   o        o     o
                   \        \   / \
                    o        o o   o
                                    \
                                     o
```

一般地，讓每個 node 都「右邊比左邊高 1」，能省一個 node 就省一個；這種樹像碎形一樣遞迴長出來。定義 **N_h = 高度 h 的 AVL 最少的 node 數**：

**N_h = 1 + N_{h−1} + N_{h−2}**

高的一邊是 h − 1，另一邊最多矮 1，是 h − 2，再加上 root 自己。代入：N_0 = 1、N_1 = 2、N_2 = 4、N_3 = 7、N_4 = 12。

> **例題** 蓋高度 4 的最省 AVL：root 至少要有一個高度 3 的 child，就放最省的那棵（7 個 node）；另一邊只能跟 3 差 1，可選 3 或 2，選 2 因為比較省（4 個）。接起來 N_4 = 7 + 4 + 1 = 12。

> **觀念** 問：h − 2 那棵子樹，每片 leaf 都要在同一層嗎？答：不用，只要那棵子樹的 root 高度是 h − 2；它本身也是歪的，只有一條路徑到底。例如把 h = 2 的 AVL 接上去，它高度 2、旁邊兄弟高度 3。同一層的 node 不必等高，只有「同一個 parent 底下的兩個 children」要差 ≤ 1；差更多就可能退化成 linked list。

> **陷阱** 以層數算高度（Horowitz）時，N(1) = 1、N(2) = 2、N(3) = 4……同一個數列只是下標位移一格。

### Fibonacci 下界：h < 1.44 log₂ n

N_h 很像 Fibonacci，只是多了 +1，所以比 Fibonacci 數還大：N_h > F_h。

- F_h = φʰ / √5 取最接近的整數，φ = (1 + √5) / 2 ≈ 1.618（黃金比例）> 1，所以 N_h 至少指數成長，大約是 φʰ。
- 一棵 n 個 node、高度 h 的 AVL：n ≥ N_h > φʰ / √5。
- 兩邊取 log_φ：h < log_φ n + 常數 ≈ 1.440 log₂ n（1 / log₂ φ ≈ 1.44）。

精確的上界是 h < 1.44 log₂(n + 2)。所以 AVL 最高也只是完美平衡的樹大約 1.44 倍，搜尋時間 O(log n)。

> **陷阱** 常數是 1.44，不是「大約 2 到 3 之間」。

### 簡單版證明：h < 2 log₂ n

不背 Fibonacci 也行。N_{h−1} 和 N_{h−2} 不對稱，想辦法換成一樣：要證的是下界，只能換成小的，把 N_{h−1} 換成 N_{h−2}：

N_h = 1 + N_{h−1} + N_{h−2} > 1 + 2N_{h−2} > 2N_{h−2}

每多兩層，node 數至少翻倍，所以 N_h 至少是 2^(h/2) 的常數倍。n ≥ N_h > 2^(h/2) → h < 2 log₂ n。不是最緊的（真正的最糟是 1.44 log n），但好證，作業可以用這招。

> **重點** 結論：只要每個 node 左右高度差 ≤ 1，就保證 balanced。沒有演算法能在一連串插入刪除中一直維持完美的樹，所以退一步，差 1 就好。問題是：怎麼維持？

## Rotation：O(1) 又不破壞順序

修樹只需要一個工具：rotation。BST 只要會兩件事：search 和 rotation。

### Left rotate 與 right rotate

x 和它的右 child y，底下掛三棵 subtree：a、b、c（有的可能是空的）。

```
   left rotate(x) →
      x                    y
     / \                  / \
    a   y                x   c
       / \              / \
      b   c            a   b
               ← right rotate(y)
```

- left rotate(x)：y 升上去、x 降下來；x 原本的 parent 變成 y 的 parent。
- 只有 b 換了 parent：從 y 換成 x。改的指標是常數個，所以 O(1)。
- in-order 前後都是 a、x、b、y、c，所以還是合法的 BST。
- 反過來做 right rotate(y)，就轉回去。root 往左移叫 left rotate，往右移叫 right rotate。

### Right rotate 的 pseudocode

A 掛在 E 底下，A 的左 child 是 B，B 的右子樹是 c：

```
right rotate(A) 之前          之後
        E                     E
        |                     |
        A                     B
       / \                   / \
      B   d                 a   A
     / \                       / \
    a   c                     c   d
```

B 升上來，A 變成 B 的右 child；B 原本的右子樹 c 搬到 A 的左邊，中序順序不變（a、B、c、A、d），搜尋照樣能用。旋轉必須是 O(1)：只能改圖上這幾條連結，不能鑽進子樹裡重排。

```python
def right_rotate(self, A):
    B = A.left
    c = B.right
    E = A.parent
    # 1. B 接到 A 原本的位置
    B.parent = E
    if E is None:
        self.root = B
    elif E.right is A:      # 比的是指標，不是 key
        E.right = B
    else:
        E.left = B
    # 2. c 從 B 搬到 A 的左邊
    A.left = c
    if c is not None:
        c.parent = A
    # 3. A 變成 B 的右 child
    B.right = A
    A.parent = B
    update_height(A)        # 先更新下面的 A
    update_height(B)        # 再更新上面的 B
```

- 改了 child 就要改 parent，指標永遠成對改，才不會搞丟。
- B.parent = E 之後，E 要用左指標還是右指標指向 B？看 A 原本是不是 E 的右 child（`E.right is A`），這是指標比較，不用比 key。
- left rotate 就是把 left、right 全部互換：複製貼上、左右對調。

> **陷阱** 別忘了上面 parent 那條連結。只看 A、B 之間好像「只換兩張小紙條」，但原本指向 A 的 parent（或整棵樹的 root 指標）也要改指向 B，共要改 3 條連結（各自加上對應的 parent 指標）。

為什麼要 rebalance？依序插入越來越大的數，BST 會變成一條很長的路徑；就算不考慮遞迴深度爆掉，也會變得很慢。

### 用旋轉把高樹轉矮

30、20、10 這條往左的鏈：繞著 30 轉，把 30 拉到右邊，20 就升上來了。10、20、30 往右的鏈也一樣：10 往下、20 升上來、30 到右邊。

> **比喻** 想像在 node 的位置釘一根釘子，線繞過釘子，一拉，中間那個就升上來；線上掛著的東西（子樹）會被甩到另一邊。

zigzag 的 30、10、20 一步做不到：先繞 10 轉，變成一直線；再繞 30 轉，就平衡了。總共四種旋轉，可以把 BST 轉成平衡的。

> **重點** 不管樹多大，旋轉永遠只動三個 node（加上它們掛著的子樹整塊搬家）。

## 四種失衡：LL、LR、RR、RL

### 找出 Y 和 A

- 新插入的 node 叫 **Y**。
- 插入 Y 之後，BF 超出 −1、0、1 的 node 叫 **A**。如果有好幾個 node 失衡，A 取**離 Y 最近**的那一個：從 Y 往 root 走，遇到的第一個違規 node。
- 從 A 往下走向 Y，看第一步往哪、第二步往哪：

| 類型 | Y 的位置 | 修法 |
|---|---|---|
| LL | A 的左子樹的左邊 | 單旋（一次 right rotate） |
| LR | A 的左子樹的右邊 | 雙旋（double rotation） |
| RR | A 的右子樹的右邊 | 單旋（一次 left rotate） |
| RL | A 的右子樹的左邊 | 雙旋 |

不管樹多大，一定落在這四種之一，不會有第五種。英文課本把 LR 寫得很繞，記中文「A 的左子樹的右邊」就好。

> **陷阱** LL／LR／RR／RL 看的是「從 A 往 Y 走的頭兩步」，不是看 Y 是誰的左右子，也不是看整條路徑。路徑是右、左、左（或右、左、右）都只取前兩步 → RL。

> **陷阱** RR 是以「新 node 在 A 的右邊的右邊」命名，做的其實是一次左旋（B 逆時針轉上來）；LL 做的是右旋。不要跟旋轉方向的名稱搞混。

### 三個 node 的最小例子

以下 BF 依序列出由下往上的 node。

**LL**：30、20，再插 10。

```
插 10 之前     插 10 之後（30 的 BF = 2）    LL rotation 後
   30              30                          20
  /               /                           /  \
 20              20                          10   30
                /
               10
```

一開始 BF 是 0（20）、1（30），平衡。10 比 30 小、比 20 小，放在 20 的左邊；BF 變成 0、1、2，30 失衡。插在左的左 → LL imbalance。繞著 30 轉：20 升上來、30 到右邊、10 留在左邊。BF = 2 表示左邊重，−2 表示右邊重。

**RR**：10、20，再插 30。

```
插 30 之後（10 的 BF = −2）    RR rotation 後
  10                              20
    \                            /  \
     20                         10   30
       \
        30
```

30 比 10 大、比 20 大，放在 20 的右邊；BF 變成 0、−1、−2，10 失衡，右的右 → RR。繞 10 轉：20 升上來，10 到左邊，BF 全部 0。

同樣的例子用 3、5、8：插入 3，BF = 0；插入 5（3 的右邊），BF(5) = 0、BF(3) = 0 − 1 = −1，仍是 AVL；插入 8（一路往右到 5 的右邊），BF(8) = 0、BF(5) = −1、BF(3) = 0 − 2 = −2，違反 AVL。長成一長串，就從中間的 5 把它拉起來：5 當新的 root，左 3、右 8，三個 BF 都是 0。

**LR**：30、10，再插 20。

```
插 20 之後          第一步：繞 10 轉       第二步：繞 30 轉
  30                   30                    20
 /                    /                     /  \
10                   20                    10   30
  \                 /
   20              10
```

20 比 30 小、比 10 大，放在 10 的右邊；BF 是 0、−1、2，30 失衡，插在左的右 → LR。第一步繞 10 轉（left rotate 10），20 升上來，變成一直線，也就是 LL 的形狀；第二步繞 30 轉（right rotate 30）：20 當 root，10 在左、30 在右。兩步算成一次旋轉，叫 double rotation。

**RL**：10、30，再插 20。

```
插 20 之後          第一步：繞 30 轉       第二步：繞 10 轉
 10                   10                     20
   \                    \                   /  \
    30                   20                10   30
   /                       \
  20                        30
```

20 在 10 的右、30 的左；BF 是 0、1、−2，10 失衡，右再左 → RL。先繞 30 轉，再繞 10 轉，20 一樣當 root。

> **重點** LL、RR 是單旋；LR、RL 是雙旋。雙旋的一步記法：三個 node 中最下面那個（中間值）直接升成 root，另外兩個分到左右。

### 另一種講法：3、5、4（RL）

依序插入 3、5、4：4 塞在 3 的右邊、5 的左邊。BF：4 是 0，5 是 +1，3 是 −2。

3 最小、5 最大，都是極值，誰當頭都不平衡；只有中間的 4 當頭才行。

> **比喻** 4 是孫子，想當家不能直接挑戰阿公，要先處理跟爸爸的關係。

```
插 4 之後         rotate 4 和 5          rotate 4 和 3
  3                 3                      4
   \                 \                    / \
    5                 4                  3   5
   /                   \
  4                     5
BF: 3=−2,5=+1,4=0   BF: 3=−2,4=−1,5=0    BF 全 0
```

先 rotate 4 和 5：4 上來，5 變成 4 的右小孩；這時 3 還是 −2，還沒處理完。再 rotate 4 和 3，就是熟悉的 RR，4 當上這棵 subtree 的 root。問題點在阿公的右邊的左邊，叫 RL：要連跳兩級，就用兩次各跳一級的 rotate。

## 通式：一般大小的樹

### LL 通式：B 上提、B_R 給 A

A 的左 child 是 B；B_L、B_R、A_R 是 subtree。

```
插入前                插入 Y 後（BF(A)=2）          LL 調整後
      A                     A                         B
     / \                   / \                      /   \
    B   A_R(h)            B   A_R(h)             B_L     A
   / \                   / \                    (h+1)   / \
B_L   B_R             B_L   B_R                      B_R   A_R
(h)   (h)            (h+1)  (h)                      (h)   (h)
                      含 Y
```

- 插入前 A 是合法的（BF(A) = 1）：A_R 高 h，B 那邊高 h + 1；B 原本平衡，所以 B_L、B_R 都是 h。
- Y 插進 B_L：B_L 變 h + 1，BF(B) = 1；A 的左邊變 h + 2，BF(A) = (h + 2) − h = 2，違規。
- LL 調整：A 往右下壓，B 往上提，變成這一塊的新 root；B 原本的右子樹 B_R 搬過去，當 A 的左子樹。
- B_R 本來就比 B 大、比 A 小，放那裡剛好仍是 BST。
- 高度：A 底下兩邊都是 h，B 底下兩邊都是 h + 1，全部平衡。

另一種畫法把 B 的左 child 也標成 C（各帶子樹）：只看 A、B、C 三個，B 升上來，C 在左、A 在右；C 的左右子樹、A 的右子樹留在原位；少掉的是 B 的右子樹，唯一的空位是 A 的左邊，就放那裡。

### RR 通式：rotate(A, B)

RR 跟 LL 剛好顛倒，像鏡像。A 的右 child 是 B，B 底下是 BL、BR，A 的左邊是 AL。

```
插入後（bf(A) = −2）             rotate(A, B) 後
      A                               B
     / \                            /   \
   AL   B                          A     BR
  (h)  / \                        / \   (h+1)
     BL   BR                    AL   BL
     (h) (h+1)                  (h)  (h)
          含新 node
```

- B 原本平衡（BL、BR 都是 h），新 node 插進 BR，讓 BR 多一層；B 只是 −1，還沒事，出問題的是 A：AL 的底和 BR 的底差了 2 層，bf(A) = −2。
- 把 B 拉上來、A 滾下去：AL 跟著 A 降一層，BR 跟著 B 升一層。
- BL 去哪？BL 是比 A 大、比 B 小的資料，必須在 A 的右邊。
- 轉完 AL、BL、BR 底端切齊，bf(A) = 0、bf(B) = 0。AL 還在 A 左、BR 還在 B 右。

```c
/* rotate(A, B)：B 逆時針轉上來 */
A->right = B->left;
B->left  = A;
/* 另外：原本指向 A 的 parent（或 root 指標）要改指向 B */
```

### 為什麼調整一次就夠

真正的 AVL 插入：

1. 先照 BST 插入，這條 path 上的 bf 可能都變了。
2. 從下往上重算 bf，找到第一個不平衡的點，就是 A。
3. 依四種情況旋轉（例如插在 A 的右邊的右邊，就 rotate(A, B)）。

> **重點** 關鍵：轉完之後，這棵 subtree 的高度跟插入前一模一樣（上圖插入前 A 子樹高 h + 2，調整後 B 子樹也是 h + 2）。高度沒變，上面所有 node 的 bf 就通通不會變。找到第一個出錯的地方、修一次，事情就結束。

> **觀念** 問：BL 接到 A 的右邊，bf(A) 不會又變成 2 嗎？答：A 是插一個就差到 2，表示它原本就是 −1，B 那邊比 AL 高一層。代數字：BL 高 10，B 原本平衡，BR 也是 10，B 那層是 11，所以 AL 是 10；轉完 AL 和 BL 是 10 對 10，bf(A) = 0。BL 會不會只有 9？那插入後 B 自己就先失衡了，第一個失衡點就不會是 A。

和 strict 的 ordered array 不同：只旋轉一次，其他 subtree 都不動，有自由度。維護只是幾個 pointer 的改變，力氣主要花在沿著樹高往上找第一個要修的地方。

### RL 通式：兩次 rotate

新 node 落在 C 底下，C 管著 CL、CR 兩棵 subtree；C 是 B 的左 child，B 是 A 的右 child。以 BR 的高度 h 為準：

```
插入後                    第一次：rotate C 和 B        第二次：rotate C 和 A
      A                        A                              C
     / \                      / \                           /   \
   AL   B                   AL   C                         A     B
  (h)  / \                 (h)  / \                       / \   / \
      C   BR                  CL   B                    AL  CL CR  BR
     / \  (h)                     / \                  (h)       (h)
   CL   CR                      CR   BR
（CL、CR 原本 h−1，新 node 讓其中一棵變 h）
```

- 插入後 C 有一點點不平衡（例如 bf(C) = −1），C 的爸爸 B 另一邊是 BR，C 這邊多一層，bf(B) = +1，都還合法。
- 真正出問題的是老爺爺 A：AL 的底和新 node 差兩層，bf(A) = −2。
- 要重組的是 A、B、C 三代；新 node 只是導火線，RL 說的是 A、B、C 之間的關係。對照 3、5、4：A = 3、B = 5、4 同時是 C 和新插入的 node。
- 第一次：扭轉 C 和 B，C 上來，B 轉下去當 C 的右小孩。BR 跟著降一層，CL 跟著升一層（與 AL 切齊），CR 改掛到 B 的左邊。從 A 的角度沒有改變；這時看起來更不平衡，別緊張，這只是兩步中間的暫時狀態。
- 第二次：C 和 A 交換，C 成為這一群的新 root。B 那一支跟著 C 上一層：CR、新 node、BR 都上去。A 變成 C 的左小孩，AL 跟著降一級；CL 升上來，但接在 A 的右邊，不是 C 底下。
- 結果 B 的 bf 是 0、A 最多差 1、C 也平衡。插入前這棵高 h + 2，調整完還是 h + 2：高度沒變，上面的 bf 都不動，一樣只修一次。

這叫 RL 修正；左右對調的鏡像，就是 LR 修正。

> **觀念** 問：示意圖裡 CL、CR 一定要一樣高嗎？答：新 node 插在 CL 或 CR 都行，重點是 C 這棵變高了。但 CL、CR 原本若不一樣高，插入後 C 自己就失衡，出問題的會是 C；若 CL 原本就比 AL 高，A 在插入前就已經差 2 了。因為 A 是第一個出問題的點，各棵 subtree 的高度都被限制住了。

### LR 一步到位：C 拉上來，四塊照順序接

LR 最單純的情形 (a) 只有三個 node：把最下面的 C 調上來，三個都平衡。一般圖：A、B、C 加上四塊 subtree B_L、C_L、C_R、A_R，新 node 在 A 的左子樹的右邊（在 C_L 或 C_R 底下）。

```
LR 調整前                         LR 調整後
         A                              C
        / \                           /   \
       B   A_R(h)                    B     A
      / \                           / \   / \
  B_L(h) C                       B_L C_L C_R A_R
        / \
     C_L   C_R
（C_L、C_R 原本 h−1，新 node 在其中一棵）
```

- 一樣把 C 拉到 root，B 在左、A 在右（A、B 往下壓）。
- 四塊怎麼放？照原本由左到右 **B_L、C_L、C_R、A_R** 的順序接上去：C_L 接到 B 的右邊（C_L 的值本來就都比 B 大），C_R 接到 A 的左邊（C_R 比 A 小、比 C 大）。B 的左子樹 B_L、A 的右子樹 A_R 不動。
- LR 分成 (a)(b)(c) 三個 case：(a) 下面沒有 subtree；(b) 和 (c) 只差在新 node 在 C_L 下面還是 C_R 下面，做法都一樣。

> **重點** 技巧：確認 A、B、C → C 拉上來 → 四塊由左到右接好。RL 照鏡子做：四塊由左到右是 A_L、C_L、C_R、B_R，C 升上來、A 在左、B 在右，C_L 接到 A 的右邊、C_R 接到 B 的左邊。可以把它當公式記。

### 小結：AVL 兩招走天下

- RR、LL：新 node 插在外側，在出問題的地方轉一次（one rotation）。
- RL、LR：新 node 插在內側，轉兩次（two rotations），把下面的第二代轉上來當新 root。
- 流程永遠一樣：插入、往回走、找到第一個出問題的點、修好，就結束了。

> **觀念** 用高度看單次旋轉：某 node 左子樹高 k−1，右 child 的兩棵子樹高度為「k−1 或 k」（兩種可能）與 k（外側那棵），右 child 高度就是 k+1。左右差 2，違反 AVL。外側一直線的情形只要對它**左旋一次**，兩邊高度變成 k 與「k 或 k+1」，恢復 AVL。

## 另一種講法：從最低的違規點 x 往上修

### AVL insert = 先插再修

1. simple BST insert：往下找位置，接上一個新的 leaf。
2. 這不保證還是 AVL，所以第二步：fix AVL property。

用箭頭標記每個 node：↙ 左重、↘ 右重、— 一樣高。

> **例題** 在下面這棵 AVL 插入 23。

```
插入 23 之前                 插入 23 之後（29 雙重左重）       right rotate(29) 之後
          41                          41                             41
        /    \                      /    \                         /    \
      20      65                  20      65                     20      65
     /  \    /                   /  \    /                      /  \    /
   11    29 50                 11    29 50                    11    26 50
        /                           /                              /  \
      26                          26                              23   29
                                 /
                               23
```

23 < 41、> 20、< 29、< 26，放在 26 的左邊。路徑上的高度全部改了：26 變 1、29 變 2、20 變 3、41 變 4。29 左邊高 1、右邊空的 −1，雙重左重，壞掉了；23、26、29 排成一直線。做 right rotate(29)：26 升上來，29 變成它的右 child，23 留在左邊（就是 rotation 圖裡的 subtree a）。再檢查箭頭，每個 node 最多只重 1，又是 AVL tree。

> **例題** 接著插入 55。

```
插入 55 之後                 left rotate(50)             right rotate(65)
       41                         41                          41
     /    \                     /    \                      /    \
   20      65                 20      65                  20      55
  ...     /                  ...     /                   ...     /  \
        50                         55                          50    65
          \                       /
           55                    50
```

55 > 41、< 65、> 50，放在 50 的右邊。50 變右重，65 雙重左重（左邊 50 那棵高 1，右邊不存在算 −1）；65、50、55 先左再右，是 zigzag。直接 right rotate(65) 呢？會變成 zag-zig，高度一樣，沒用。先 left rotate(50)，55 升上來，變成一直線；一直線就會修了：再 right rotate(65)。55 當這棵的 root，左 50、右 65，三個都平衡。有人叫它 double rotation，其實就是兩次 rotation。

### 一般做法

從剛改到的 node 開始往上走，每走一步用 max + 1 更新高度，直到某個 node 兩邊差 2。這個**最低的違規點**叫 x（上例是 65）。空 subtree 定成 −1 很方便，AVL 性質寫起來比較簡單。AVL 性質看的是左右子樹高度，不是層數。

**Case 1：一直線，轉一次。** 假設 x 右邊比較重（左邊對稱），看它的右 child y。若 y 也是右重：

```
left rotate(x) 之前              之後
      x (k)                        y (k−1)
     /    \                       /     \
  A(k−3)   y (k−1)            x (k−2)   C(k−2)
          /    \              /    \
      B(k−3)  C(k−2)       A(k−3)  B(k−3)
```

- 設 x 高 k；x 右重，y 的高度是 k − 1；y 右重，C 是 k − 2。
- x 是最低的違規點，y 本身是 AVL，所以 B 是 k − 3；x 兩邊差 2，A 也是 k − 3。
- 對 x 做 left rotate，y 升上來。A、B、C 裡面完全沒動，高度不變。
- 轉完 x 兩邊都是 k − 3（x 高 k − 2），y 兩邊都是 k − 2（y 高 k − 1），兩個都平衡。
- 這塊的高度變回 k − 1，正好是插入前的高度，所以插入時修一次就能停。

> **陷阱** y 是右 child，這一步是 **left** rotate(x)，不是 right rotate。

> **陷阱** 「修完最低的違規點，上面可能還有違規、要一路往上修」只對刪除成立。插入時修好最低的違規點（一次單旋或一次雙旋），子樹高度回到插入前的值，祖先不會再違規；考「插入最多幾次旋轉」答 1 次單旋或 1 次雙旋。另外「y 平衡」的情況插入時不可能發生（y 正是剛變高的那一側），只會出現在刪除：那時單旋轉後高度不變，可以停止往上。

**Case 2：zigzag，轉兩次。** x 的右 child z 是左重，x、z、y 先右再左。做法跟插入 55 一樣：先 right rotate(z)，讓 y 升上來變成一直線；再 left rotate(x)：

```
之前                    right rotate(z)          left rotate(x)
    x                       x                         y
   / \                     / \                      /   \
  A   z                   A   y                    x     z
     / \                     / \                  / \   / \
    y   D                   B   z                A   B C   D
   / \                         / \
  B   C                       C   D
```

y 在上，x、z 在兩邊；in-order 順序（A x B y C z D）完全沒變，AVL 性質也恢復了。

**用高度看 heavy path。** 再用數字講一次 Case 2：a 左邊 k − 1、右邊 b 是 k + 1，差 2，不是 AVL。b 的左子 c 高 k（底下兩棵 k − 1），b 的右子樹 k − 1。

```
之前                   right rotate(b)          left rotate(a)
     a                      a                         c (k+1)
    / \                    / \                      /     \
 k−1   b (k+1)          k−1   c (k+1)          a (k)       b (k)
      / \                    / \               /  \        /  \
  (k) c  k−1              k−1   b (k)        k−1  k−1    k−1  k−1
     / \                       / \
   k−1  k−1                  k−1  k−1
```

對 b 右旋：c 升到 b 的位置，b 降到 c 的右下，b 的右子樹不變、左邊換成 c 原本的右子樹。這時 b 高 k、c 高 k + 1，a 還是左 k − 1、右 k + 1，還不是 AVL；但重的那條路變成一直線了。再對 a 左旋，c 當根，左右都是 k。

> **重點** 差別在 heavy path（比較重、比較高的那條往下的路）：高度 k + 2、k + 1、k 排成一直線 → 轉一次；heavy path 是 zigzag → 先轉一次拉直，再轉一次。失衡時，看較重那邊的 child 是哪個孫子較高，決定轉一次還是兩次。

## AVL 插入的程式

### 插完要沿路更新高度

> **例題** 在一棵 BST 插入 6.5：6.5 > 4、> 5、> 6 一路往右，到 7 時 6.5 < 7，放在 7 的左邊。

```
插入前（只畫插入路徑）       插入後
4 (3)                        4 (4)
  \                            \
   5 (2)                        5 (3)
    \                            \
     6 (1)                        6 (2)
      \                            \
       7 (0)                        7 (1)
                                   /
                                6.5 (0)
```

路徑上的 7、6、5、4，高度原本是 0、1、2、3，插入後全部加 1。這個例子是挑過的（剛好全部 +1），一般情況只有部分 node 的高度會變，但要檢查的仍是整條路徑，所以 AVL insert 之後一定要沿路更新高度。

### 程式：BST insert 加 rebalance

AVL 的 insert、delete 都很短：呼叫原本的 BST 程式，再呼叫 rebalance。所有魔法都在 rebalance。

```python
def height(node):
    if node is None:
        return -1                 # 空子樹高度 −1 的小技巧
    return node.height

def update_height(node):
    node.height = max(height(node.left), height(node.right)) + 1

class AVL(BST):                   # AVL 是一種 BST，直接繼承
    def insert(self, k):
        node = super().insert(k)  # 一般 BST insert，回傳新 node
        self.rebalance(node)

    def delete(self, k):
        node = super().delete(k)  # 回傳被拿掉的 node
        self.rebalance(node.parent)

    def rebalance(self, node):
        while node is not None:
            update_height(node)   # 第一件事：更新高度
            if height(node.left) >= 2 + height(node.right):      # 左重
                if height(node.left.left) >= height(node.left.right):
                    self.right_rotate(node)                       # LL
                else:
                    self.left_rotate(node.left)                   # LR
                    self.right_rotate(node)
            elif height(node.right) >= 2 + height(node.left):    # 右重
                if height(node.right.right) >= height(node.right.left):
                    self.left_rotate(node)                        # RR
                else:
                    self.right_rotate(node.right)                 # RL
                    self.left_rotate(node)
            node = node.parent    # 一路往上走到 root
```

- rebalance 是一個 while 迴圈，迴圈裡第一件事是更新高度：插入後高度可能已經變了，拿舊高度判斷一定出錯。
- 它用的工具只有 left rotate 和 right rotate。
- 插入或刪除後，高度一路往上都可能改變，所以迴圈一路往上走到 root，每一層都檢查是否要 rebalance。

### 旋轉後更新高度：由下往上

旋轉時高度一直在變，存著的高度不更新，看起來還是 AVL，但高度記錯了，之後就會做出錯的決定。

right rotate A（B 是 A 的左 child）之後：B 的高度會變，A 也可能變；c 等子樹內部沒動，它們的高度不用重算。

> **陷阱** 順序必須是先 A 再 B（由下往上），因為 update_height 假設 children 的高度已經正確；先算 B 會用到 A 的舊高度，答案就錯了。

## 完整例題

### 月份例：MAR、MAY、NOV、AUG、APR、JAN、DEC、JULY、FEB、JUNE、OCT、SEPT

字串照字母順序比大小（例如 MAY 跟 MAR 比：前兩個字一樣，第三個字 Y > R，所以 MAY 比較大）。以下 BF 以層數算高度，差值與數邊相同。

**插入 MAR、MAY、NOV → RR**

```
插 NOV 之後（MAR 的 BF = −2）     RR 之後
MAR                                  MAY
  \                                 /   \
   MAY                            MAR   NOV
     \
      NOV
```

MAR 當 root；MAY > MAR 放右邊，BF(MAR) = 0 − 1 = −1、BF(MAY) = 0。插 NOV 又往右，root MAR 的 BF 變成 −2。MAR 是 A、NOV 是 Y，Y 在 A 的右子樹的右邊：RR。MAY 拉上來、MAR 壓到左邊、NOV 在右，三個 BF 都是 0。

**插入 AUG、APR → LL（A 取最近的違規點）**

```
插 APR 之後                         LL（A = MAR）之後
         MAY  BF=2                        MAY  BF=1
        /   \                            /   \
  BF=2 MAR   NOV                       AUG    NOV
      /                               /   \
    AUG                             APR   MAR
    /
  APR
```

插 AUG（MAR 的左邊）沒有人違規。插 APR，一路往左放在 AUG 的左邊：MAY 和 MAR 兩個的 BF 都變成 2。A 是誰？取離 Y 最近的那個：從 APR 往上，先碰到 MAR。APR 在 MAR 的左子樹的左邊 → LL：AUG 提上來，MAR 往右下壓。只修了 MAR 那一小塊，上面的 MAY 也跟著回到 h_L = 2、h_R = 1，BF = 1，全部符合規定。

**插入 JAN → LR**

```
插 JAN 之後                          LR 之後
          MAY  BF=2                         MAR
         /   \                            /     \
 BF=−1 AUG    NOV                       AUG      MAY
      /   \                            /   \        \
    APR   MAR  BF=1                  APR   JAN       NOV
          /
        JAN
```

JAN < MAY、> AUG、< MAR，放在 MAR 的左邊。從 JAN 往上，第一個違規的是 MAY（BF = 3 − 1 = 2），JAN 在它左子樹的右邊 → LR。對照通式：A = MAY、B = AUG、C = MAR。C（MAR）提到最上面，AUG 在左、MAY 在右；四塊由左到右：B_L = APR、C_L = 剛插的 JAN、C_R = 空、A_R = NOV，依序接上（JAN 接到 AUG 的右邊，空的 C_R 接到 MAY 的左邊）。LR 的調整幅度很大，連 root 都換了，但 APR、AUG、JAN、MAR、MAY、NOV 照字母順序一個都沒亂。不管怎麼調整，結果都必須維持 BST 的特質。

**插入 DEC、JULY → 不用調整**

DEC < MAR、> AUG、< JAN，放 JAN 的左邊；JULY < MAR、> AUG、> JAN，放 JAN 的右邊。BF：JAN 0、AUG −1、MAR 1，沒有違規。

**插入 FEB → RL**

```
插 FEB 之後                                RL（A = AUG）之後
                MAR  BF=2                           MAR
              /     \                             /     \
     BF=−2 AUG       MAY BF=−1                 DEC       MAY
          /   \         \                     /   \         \
        APR   JAN BF=1   NOV                AUG   JAN        NOV
             /   \                         /     /   \
     BF=−1 DEC   JULY                    APR   FEB   JULY
             \
             FEB
```

FEB < MAR、> AUG、< JAN、> DEC，放在 DEC 的右邊。這次違規的 node 不只一個：AUG = −2、MAR = 2（MAY 只有 −1，沒有違規）。從 FEB 往上，第一個違規的是 AUG，FEB 在 AUG 右子樹的左邊 → RL。A = AUG、B = JAN、C = DEC：DEC 拉到這塊的最上面，AUG、JAN 當它的 child；四塊 A_L = APR、C_L = 空、C_R = FEB、B_R = JULY 依序接上（FEB 接到 JAN 的左邊）。修完 MAR 也自動回到 BF = 1。

**插入 JUNE → LR**

```
插 JUNE 之後                                  LR（A = MAR）之後
                MAR  BF=2                                 JAN
              /     \                                  /       \
    BF=−1  DEC       MAY                             DEC         MAR
          /   \         \                           /   \       /   \
        AUG   JAN BF=−1  NOV                      AUG   FEB  JULY   MAY
        /    /   \                               /             \       \
      APR  FEB   JULY                          APR             JUNE    NOV
                    \
                    JUNE
```

JUNE < MAR、> DEC、> JAN、> JULY（JUN 的 N > JUL 的 L），放在 JULY 的右邊。往上第一個違規的是 root MAR（左 4、右 2）。JUNE 在 MAR 左子樹的右邊，又是 LR：A = MAR、B = DEC、C = JAN。JAN 拉上來當新的 root；四塊 B_L = AUG 子樹、C_L = FEB、C_R = JULY 子樹、A_R = MAY 子樹依序接上（FEB 接到 DEC 的右邊、JULY 接到 MAR 的左邊）。

**插入 OCT → RR；SEPT → 不用調整**

```
插 OCT 之後（只畫右半）              RR（A = MAY）之後
        MAR                               MAR
       /   \                             /   \
    JULY    MAY  BF=−2                JULY    NOV
       \       \                         \   /   \
       JUNE     NOV                    JUNE MAY  OCT
                  \
                  OCT
```

OCT > JAN、> MAR、> MAY、> NOV，放在 NOV 的右邊，MAY 的 BF 變 −2，RR：NOV 拉上來。最後 SEPT 放在 OCT 的右邊，NOV、MAR、JAN 的 BF 都是 −1，不用調整。

**最後的 AVL tree**

```
                  JAN
               /       \
            DEC         MAR
           /   \       /    \
         AUG   FEB  JULY     NOV
         /             \    /   \
       APR            JUNE MAY   OCT
                                   \
                                   SEPT
```

12 個月全插完，root 是 JAN，高度 5（層數），最多比 5 次；跟一開始歪成 12 層比，矮多了。

### 依序插入 40、20、10、25、30、22、50

每次插入後算 bf，失衡就看成因、做對應的旋轉。

**40、20、10 → LL**

```
插 10 之後         LL 之後
     40               20
    /                /  \
  20               10    40
  /
10
```

40 單獨一個 node；20 放左邊，bf 是 0 和 1。插入 10：40 的 bf = 2 − 0 = 2，插在左的左 → LL。20 當根、10 左、40 右，bf 全 0。

**插入 25**：比 20 大、比 40 小，放 40 的左邊；20 的 bf = 1 − 2 = −1，仍平衡。

**插入 30 → LR（好幾個失衡，轉最近的）**

```
插 30 之後                      LR（A = 40）之後
      20  bf=−2                       20
     /  \                            /  \
   10    40  bf=2                  10    30
        /                               /  \
      25                              25    40
        \
         30
```

30 在 20 的右、40 的左、25 的右。40 變 2、20 變 −2，兩個都失衡。從新 node 往上找，第一個失衡的是 40，轉它就好，上面的 20 會自動平衡。40 往下先左再右，LR：一步到位，30 拉上來，25 在左、40 在右。

**插入 22 → RL（只看失衡點往下兩步）**

```
插 22 之後                        RL（A = 20）之後
    20  bf=−2                            25
   /  \                                /    \
 10    30                            20      30
      /  \                          /  \       \
    25    40                      10    22      40
   /
 22
```

22 在 20 的右、30 的左、25 的左。其他 node 都平衡，只有 root 20 失衡：左高 1、右高 3，bf = −2。路徑是右、左、左，但只看失衡點往下兩步：右、左 → RL。就算插的是 26（右、左、右），一樣是 RL。A = 20、B = 30、C = 25：25 升上來，20 帶著 10 去左邊，30、40 在右邊；22 原本是 25 的左子，現在變成 20 的右子。

**插入 50 → RR**

```
插 50 之後                       RR（A = 30）之後
        25                              25
      /    \                          /    \
    20      30  bf=−2               20      40
   /  \       \                    /  \    /  \
 10    22      40                10   22  30   50
                 \
                  50
```

50 接在 40 的右邊，30 的 bf 變 −2，RR：40 升上來，30 在左、50 在右；25、20、10、22 不動。得到一棵完全平衡的樹。

> **陷阱** 不能等全部插完再轉，bf 絕對不該出現 ±3。每插一個，只要有失衡就馬上轉。

### 大一點的樹：插入 42 → RL

> **例題** 下面這棵 AVL 每個 node 都平衡。插入 42。

```
插 42 之後                                  RL（A = 40）之後
            40  bf=−2                                 45
          /     \                                  /      \
        20       50                              40        50
       /  \     /   \                           /  \      /  \
     10   30  45     60                       20    41  47    60
             /  \      \                     /  \     \         \
           41    47     70                 10    30    42        70
             \
              42
```

42 > 40、< 50、< 45、> 41，接在 41 的右邊。往上更新 bf：root 40 左高 2、右高 4，bf = −2。路徑是右、左、左、右，只看前兩步：RL。只用三個 node：A = 40、B = 50、C = 45。45 升上來當 root，40 去左、50 在右；四塊依序接上：A_L = 20 子樹 → 40 的左；C_L = 41 子樹 → 40 的右；C_R = 47 → 50 的左；B_R = 60 子樹 → 50 的右。所以 AVL 的高度最多約 1.44 log n，搜尋是 O(log n)。

### 依序插入 1 到 7

**插入 1、2、3 → RR**

```
插 3 之後       RR 之後
1                 2
 \               / \
  2             1   3
   \
    3
```

從 3 往上找，1 的 bf = −2，3 在 1 的右邊的右邊（RR）：2 拉上來、1 下去。

**插入 4**：放在 3 的右邊，往回看 4、3、2 都平衡。

**插入 5 → RR（A = 3）**

```
插 5 之後             RR 之後
    2                     2
   / \                   / \
  1   3  bf=−2          1   4
       \                   / \
        4                 3   5
         \
          5
```

4 提上來、3 轉下去；這棵 subtree 插入前高 2，修完還是 2，上面不受影響。

**插入 6 → RR（A = 2）**

```
插 6 之後                 rotate 2 和 4 之後
    2  bf=−2                    4
   / \                        /   \
  1   4                      2     5
     / \                    / \     \
    3   5                  1   3     6
         \
          6
```

5、4 都平衡（4 左邊是 3、右邊是 5–6），到 2 才發現左高 1、右高 3。問題在 2 的右邊的右邊，要修正的是 2 和 4 的關係：rotate 2 和 4，4 在上、2 在下；1 和 5、6 不變，原本 4 的左子樹 3 改接到 2 的右邊。

**插入 7 → RR（A = 5）**

```
插 7 之後                 RR 之後
      4                       4
    /   \                   /   \
   2     5  bf=−2          2     6
  / \     \               / \   / \
 1   3     6             1   3 5   7
            \
             7
```

5 不平衡，6 上來、5 變成 6 的左子。最後意外得到一棵 full binary tree，但過程中從沒堅持 complete。

### AVL demo：插入 1、2、3、15、14、13

AVL 的線上 demo 通常在 node 旁標 subtree 的高度：實作通常存高度，需要 bf 時再相減。

**插入 1、2、3 → RR**：往回更新高度發現 1 不平衡，把中間的 2 拉上來。

```
1                 2
 \               / \
  2             1   3
   \
    3
```

處理細節：2 拉上來當新 root，1 降下來當 2 的小孩，3 還接在 2 的右邊。看似複雜，其實只改兩個 node 的關係，像逆時針把方向盤扭回來；另一條要改的 link 是 2 原本的左子樹（比 1 大、比 2 小）改接到 1 的右邊。往回找最多花 O(log n)，修正本身只有幾行。

**插入 15**：放在 3 的右邊，更新高度後不需要 rotation。

**插入 14 → RL（A = 3）**

```
插 14 之後            第一次旋轉            第二次旋轉
  2                     2                     2
 / \                   / \                   / \
1   3  bf=−2          1   3                 1   14
     \                     \                   /  \
      15                    14                3    15
     /                        \
   14                          15
```

14 走 2 右、3 右、15 左，在 3 產生不平衡，插在它右邊的左邊：RL。轉兩次，14 拉上來，3、15 在兩邊。

**插入 13 → RL（A = 2）**

```
插 13 之後                    RL 之後
    2  bf=−2                      3
   / \                          /   \
  1   14                       2     14
     /  \                     /     /  \
    3    15                  1    13    15
     \
      13
```

13 > 2、< 14、> 3，塞在 3 的右邊。問題不在 14（14 左高 1、右高 0，還合法），一路回到 2 才不平衡：左 0、右 2。路徑右、左 → RL，A = 2、B = 14、C = 3。2、14、3 重新洗牌，把 3 拉上去；C_L 是空的接到 2 的右邊，C_R = 13 接到 14 的左邊。

## 修正為什麼算 O(1)

問：插入要先往下找位置，就 O(log n) 了，為什麼說修正是 O(1)？

答：往下找的 log n 本來就跑不掉，要比的是在這之外還要多花多少力氣（maintenance 的力氣）。

- RR 的修正很 local：只在出問題的那一點轉一次，那裡和其他地方就都滿足 AVL，所以是常數時間；修完就高枕無憂。
- 對比 heap 的 insert：插在最後，一路往上浮，最壞要浮 log n 層。
- 就算額外力氣跟樹高 h 有關也還好，因為 h 被限制在 O(log n)。
- 要是拿 complete binary tree 當 BST，插一個就整棵都要動，就不太好。

> **重點** 插入的總成本仍是 O(log n)（往下找、往回找第一個失衡點、沿路更新高度），O(1) 指的是 rotation 本身的次數與工作量。

## AVL 的刪除

刪除的做法：先照 BST 刪除，再從被拿掉的位置往回找，不平衡就調整。接續 demo 的樹 3（左 2–1，右 14–13、15）：

**刪 1**：往回看高度，沒有不平衡。

```
刪 1 之後
     3
    / \
   2   14
      /  \
    13    15
```

**刪 2 → 轉一次**

```
刪 2 之後（3 的 bf = −2）        left rotate(3) 之後
   3                                  14
    \                                /  \
     14                             3    15
    /  \                             \
  13    15                            13
```

3 的左邊空了、右邊高 2，轉一次，把 14 拉上來。注意這時 14 本身是平衡的（左右都高 0），這種「y 平衡」的情況只會出現在刪除；單旋轉後這塊高度沒變。

**刪 15 → 轉兩次**

```
刪 15 之後（14 的 bf = 2）      第一次：left rotate(3)    第二次：right rotate(14)
     14                              14                        13
    /                               /                         /  \
   3                              13                         3    14
    \                             /
     13                          3
```

14 左邊高 1、右邊空，又不平衡；左 child 3 是右重，zigzag，轉兩次，13 拉上來。

**刪除非 leaf 的 node**：為了看清楚，先插入 5（5 < 13、> 3，放在 3 的右邊），再刪 root 13。

```
刪 13 之前            用 5 補位、刪掉原本的 5 之後
     13                       5
    /  \                     / \
   3    14                  3   14
    \
     5
```

要刪的不是 leaf，直接挖掉會留一個洞，要重排整棵樹；做法是找人補位：

- 左子樹裡最大的：先往左一步，再一路往右到底，這裡是 5，數字上最接近 13。
- 或右子樹裡最小的（inorder successor）：先往右一步，再一路往左到底，這裡是 14。
- 常見做法先往左抓，左子樹是空的才往右。

補位後，問題就轉成刪掉那個補位 node。它最多只有一個小孩，但不一定是 leaf：左子樹最大的 node 可能有一個左小孩，要把值搬上來後刪掉它，並把它的小孩接上去，再檢查相關 subtree 的高度。

> **陷阱** 刪除「原理」跟插入一樣，但次數不同：插入只要修一次（單旋或雙旋）就結束；刪除修完後子樹可能變矮，祖先可能再失衡，所以要一路往上檢查，最多旋轉 O(log n) 次。例外是兄弟（y）BF = 0 的情況，單旋後高度不變，可以停。

## 實作細節

### 用 pointer 還是 array

heap 用 array，是因為它常常要找 parent 和 child，而且形狀固定（complete）。AVL 一直旋轉、形狀不固定，用 array 會有大量搬移與空洞，所以課本用 link（pointer）實作，每個 node 存 bf。每種資料結構的表示方法不只一種，要想清楚哪種適合。

### BF 怎麼算才快

- 每 insert 一個 node，只要從插入點沿插入路徑往上更新 BF，不用算整棵樹的 BF；插入只會改到 root 到 leaf 那條路上的高度，往回修正時順便更新。所以 insert 是 O(log n)。
- 從 Y 往 root 走，第一個 |BF| = 2 的 node 就是 A，再依 LL、LR、RR、RL 四種空間關係做調整。
- 簡單做法是每個 node 存左右兩邊的樹高 h_L、h_R（或存自己的高度），一減就有 bf。只存子樹的 node 數是不行的，節點數得不到高度差。
- bf 其實只需要 −1、0、+1 三種值，可以設計更省 bit 的存法；那是實作細節。

> **觀念** 問：這棵樹只在乎平衡嗎？答：插入和 search 時一直在跟 node 比大小，其實就是在排序。

### 每插一個就調整

每加一個 node，就算一次 BF、調整一次。調整方法有固定步驟，照著四種通式依樣畫葫蘆、看圖說話就好。

> **觀念** 思考題：能不能先插 k 個 node，再一次調整？提示：一次插很多個，違規的地方可能不只一處，BF 也可能超過 ±2，LL／LR／RR／RL 四種 case 就不夠判斷了。

## AVL 的效率、AVL sort 與 ADT

### 和其他結構比較

| 操作 | AVL tree | sorted sequential list（陣列） | unsorted linked list |
|---|---|---|---|
| search x | O(log n)（最差就是樹高） | O(log n)（binary search） | O(n)（只能從頭找） |
| 找第 k 小 | O(log n)（node 存 leftSize） | O(1)（直接拿） | — |

AVL 找第 k 小：每個 node 多存 leftSize 欄位（augmentation），就知道答案在左子樹、自己還是右子樹，只要走樹的高度，O(log n)。

> **陷阱** leftSize 有兩種定義：Horowitz 定義為「左子樹 node 數 + 1」，也有人定義為不含自己的左子樹 node 數；用哪種定義，找第 k 小時的比較式要跟著調整。

> **例題** 建一棵 n 個 node 的 AVL tree 要多久？n 次 insert，每次 O(log n)，共 O(n log n)。

### AVL sort

把全部元素 insert 進 AVL，再做 in-order traversal：

- 每次 insert 是 O(h) = O(log n)，共 O(n log n)。
- in-order traversal 是線性時間 O(n)。

總共 O(n log n)，是繼 heap sort、merge sort 之後，另一種 n log n 的排序。

### ADT 與資料結構

- **ADT（abstract data type）**：規定要支援哪些操作，像 Java 的 interface。
- **資料結構**：怎麼做到這些操作。
- insert、delete、min 這一組操作叫 **priority queue**。可以用 heap 實作，也可以用 AVL，甚至 sorted array。
- AVL 還多了 heap 做不到的：find next larger／next smaller，也就是 successor、predecessor。如果連 successor、predecessor 都要，就需要 balanced BST。
- heap 的好處是 in place；AVL 到處是指標，空間多一個常數倍。不在意常數的話，AVL 什麼都能 O(log n)。

## Optimal BST：什麼叫「最好」的 BST

同樣一組字，可以排成好幾棵不同的 binary search tree（BST）。要說哪一棵「最佳」（optimal），得先講清楚用什麼標準來比。

### 用比較次數當 cost

最直接的 cost（成本）：從 root 開始找，要做幾次 comparison（比較）才找到那個字。每往下一層就多比一次，所以找某個 node 的比較次數，就是它的 **level**（root 是第 1 層）。

例如兩棵放 for、do、while、return、if 的 BST：

```
左邊那棵                     右邊那棵
        for                        for
       /   \                      /   \
     do     while               do     return
           /                          /     \
       return                       if      while
        /
      if
```

- 左邊找 if：for → while → return → if，比 4 次。
- 右邊找 if：for → return → if，只要 3 次。

若看 **worst case**（最壞情況，也就是樹高），右邊比較好。可是最壞的情況不一定常發生；只看樹高來評估 BST 不夠好。更好的標準要把「每個字多常被找」算進去：如果大家都在查 for，for 就該放在靠近 root 的地方。

> **陷阱** worst case 的比較次數少，不代表平均搜尋成本低。optimal BST 的 cost 要把搜尋機率算進去。

### Fail node、internal path 與 external path

為了把「找不到」也畫進樹裡，在每個空位補上一個方塊，叫 **fail node**（失敗節點），它實際上不存在，只代表搜尋失敗落在哪裡。補上方塊的樹叫 extended binary tree。

- **internal path**：找得到時走的路（root 走到樹裡的 node）。
- **external path**：找不到時走的路（root 走到某個 fail node）。

以左邊那棵為例，找 cc（不在樹裡）：cc < for 往左，cc < do 再往左，do 的左邊已沒有字，落到 do 左下的方塊。從 root 到這個方塊經過 2 條 edge，所以這條 external path 長度是 2。

- **I** = 所有 internal path 長度的和；**E** = 所有 external path 長度的和。
- path 長度算的是經過幾條 edge（hop），**不是**比較次數；root 自己是 0。

左邊那棵：for 是 0，do、while 是 1，return 是 2，if 是 3，所以 I = 0 + 1 + 1 + 2 + 3 = 7。

```
            for(0)
           /      \
        do(1)      while(1)
        /  \        /     \
      [2]  [2]  return(2)  [2]
                /     \
             if(3)    [3]
             /  \
           [4]  [4]
```

方塊（fail node）共 6 個，E = 2 + 2 + 2 + 3 + 4 + 4 = 17。

> **重點** extended binary tree 一定有 **E = I + 2n**。本例 n = 5、I = 7，所以 E = 7 + 10 = 17。
> 另外兩個常見推導：skewed tree（歪成一條線）的 I = 0 + 1 + … + (n−1)；complete binary tree 的 I = ∑ ⌊log₂ i⌋（i = 1..n）。

### 把搜尋機率算進 cost

只數 hop 不是真正的 cost，因為沒考慮每個字被搜尋的機率。設 a₁ < a₂ < … < aₙ，搜尋 aᵢ 的機率是 pᵢ；搜尋不存在的字會落到 fail node Eᵢ（i = 0..n），機率是 qᵢ。

- 成功搜尋：∑ pᵢ × level(aᵢ)。pᵢ 越大，aᵢ 越該靠近 root。
- 失敗搜尋：∑ qᵢ × (level(Eᵢ) − 1)。走到 leaf 發現沒有 child 就知道失敗，不會真的走進方塊，所以要減 1。

```
cost = ∑(i=1..n) pᵢ·level(aᵢ) + ∑(i=0..n) qᵢ·(level(Eᵢ) − 1)
```

> **陷阱** fail node 那一項要用 level − 1：比較只做到 leaf 為止。

### 例題：do、if、while 的五棵樹

三個字 do < if < while 可以排出 5 棵不同的 BST：

```
 (a)          (b)            (c)          (d)            (e)
  while         if          do            while          do
  /            /  \           \           /                 \
 if          do   while        if        do                 while
 /                              \          \                /
do                              while       if             if
```

**第一組機率：uniform**。3 個字加 4 個方塊，共 7 種結果，每種機率 1/7。

tree (a)：
- 成功：while 在 level 1、if 在 level 2、do 在 level 3 → (1 + 2 + 3)/7 = 6/7。
- 失敗：do 底下兩個方塊在 level 4，但只比到 do，算 3；if 右邊的方塊算 2；while 右邊的方塊算 1 → (3 + 3 + 2 + 1)/7 = 9/7。
- cost(a) = 15/7。

同樣算法：只有平衡的 (b) 是 13/7（成功 1 + 2 + 2 = 5，失敗四個方塊各 2 = 8），其他 (a)(c)(d)(e) 都是 15/7。所以 uniform 時 (b) 是 optimal。

**第二組機率：不平均**。p₁(do) = 0.5、p₂(if) = 0.1、p₃(while) = 0.05；q₀ = 0.15、q₁ = 0.1、q₂ = 0.05、q₃ = 0.05。

| 樹 | 成功部分 | 失敗部分 | cost |
|---|---|---|---|
| (a) | 0.05·1 + 0.1·2 + 0.5·3 = 1.75 | 0.15·3 + 0.1·3 + 0.05·2 + 0.05·1 = 0.9 | 2.65 |
| (b) | 0.1·1 + 0.5·2 + 0.05·2 = 1.2 | (0.15 + 0.1 + 0.05 + 0.05)·2 = 0.7 | 1.9 |
| (c) | 0.5·1 + 0.1·2 + 0.05·3 = 0.85 | 0.15·1 + 0.1·2 + 0.05·3 + 0.05·3 = 0.65 | 1.5 |
| (d) | 0.05·1 + 0.5·2 + 0.1·3 = 1.35 | 0.15·2 + 0.1·3 + 0.05·3 + 0.05·1 = 0.8 | 2.15 |
| (e) | 0.5·1 + 0.05·2 + 0.1·3 = 0.9 | 0.15·1 + 0.1·3 + 0.05·3 + 0.05·2 = 0.7 | 1.6 |

最小是 1.5，tree (c)：do 最常被找，放 root 最划算。**機率一變，最佳的樹就跟著變。**

> **陷阱** 有的課本把 (d) 印成 2.05，照公式算是 2.15。

### Static set 的前提

optimal BST 針對 **static set**：字和它們的搜尋機率事先給定、不隨時間改變。真實環境（例如搜尋引擎）每個月、甚至每天大家查的字都不同，是 dynamic 的；dynamic set 的 optimal BST 要怎麼定義 cost 是另一個問題（思考題，不在考試範圍）。

### 暴力法行不通

給 n 個字和所有 pᵢ、qᵢ，最笨的方法：把 n 個 key 能組成的所有 BST 都產生出來，每棵算 cost，取最小。但 BST 的數量是 Catalan number：

```
C(n) = (2n)! / (n!·(n+1)!)      C(3) = 5，C(10) = 16796
```

呈指數成長，光是「產生所有 BST」這一步就做不完。比較好的方法是 **dynamic programming**（動態規劃）：小問題先算好存起來，大問題由小問題組出來。

## Optimal BST 的 dynamic programming

### 符號：T、c、r、w

- **Tᵢⱼ**（i < j）：用 aᵢ₊₁ … aⱼ 建出來的 optimal BST。它的 fail node 是 qᵢ … qⱼ，比字多一個。
- **cᵢⱼ**：Tᵢⱼ 的 cost；**rᵢⱼ**：Tᵢⱼ 的 root（記下標 k）。
- **wᵢⱼ**：weight，= pᵢ₊₁ + … + pⱼ + qᵢ + … + qⱼ。

weight 只是把機率加起來；cost 還要乘上 level。兩者要分開看。

初始條件：Tᵢᵢ 只有一個 fail node，**wᵢᵢ = qᵢ、cᵢᵢ = 0、rᵢᵢ = 0**（空樹不用比較）。

要找的是 **T₀ₙ**（cost c₀ₙ、weight w₀ₙ、root r₀ₙ）。做法：每棵 subtree 都 optimal，組出來的 T₀ₙ 才會 optimal。

### 遞迴式：每個 k 都試

假設 Tᵢⱼ 的 root 是 aₖ（i < k ≤ j）：

- 比 aₖ 小的 aᵢ₊₁ … aₖ₋₁ 去左子樹，就是 Tᵢ,ₖ₋₁；
- 比 aₖ 大的 aₖ₊₁ … aⱼ 去右子樹，就是 Tₖⱼ。

左右子樹接到 aₖ 下面後，裡面每個點（含 fail node）都往下多一層，所以每個點的 cost 都多算一次自己的機率，也就是多加一次子樹的 weight：

```
cᵢⱼ = pₖ + c(i,k−1) + c(k,j) + w(i,k−1) + w(k,j)
```

又 pₖ + w(i,k−1) + w(k,j) 剛好就是 wᵢⱼ，所以

```
cᵢⱼ = wᵢⱼ + c(i,k−1) + c(k,j)
```

root 選誰事先不知道，就把 k 從 i+1 試到 j，取最小：

```
cᵢⱼ = wᵢⱼ + min{ c(i,k−1) + c(k,j) }    (i < k ≤ j)
rᵢⱼ = 使上式最小的 k
wᵢⱼ = wᵢ,ⱼ₋₁ + pⱼ + qⱼ
```

wᵢⱼ 跟選哪個 k 無關，所以只要比後面兩項。

> **陷阱** k 的範圍是 **i < k ≤ j**（k = j 時右子樹是空的 Tⱼⱼ），不是 i < k < j。

### 驗證：T₀₂

T₀₂ 含 a₁、a₂ 和 q₀、q₁、q₂。假設 a₂ 當 root：a₁ 在左，q₂ 在右。

```
        a2
       /  \
     a1    [q2]
    /  \
  [q0] [q1]
```

用遞迴式：
- 左子樹 T₀₁：c₀₁ = w₀₁ + c₀₀ + c₁₁ = p₁ + q₀ + q₁；w₀₁ = q₀ + p₁ + q₁。
- 右子樹 T₂₂：c₂₂ = 0，w₂₂ = q₂。
- cost = p₂ + c₀₁ + c₂₂ + w₀₁ + w₂₂ = p₂ + (p₁ + q₀ + q₁) + 0 + (q₀ + p₁ + q₁) + q₂ = **2p₁ + p₂ + 2q₀ + 2q₁ + q₂**。

直接用 level 算：a₁ 在 level 2 → 2p₁；a₂ 在 level 1 → p₂；q₀、q₁ 在 level 3 → 各算 2；q₂ 在 level 2 → 算 1。結果一樣。

> **觀念** 遞迴式裡完全沒有 level，靠的是「每往上接一層，就多加一次 weight」，一層層累加，自然把 level 乘進去了。這一頁說明兩件事：公式和 level 的定義一致；cost 可以由 subtree 遞迴算出來。

### 例題：do、if、return、while 的 DP 表

4 個字，已照字母排好：(a₁, a₂, a₃, a₄) = (do, if, return, while)。用搜尋次數代替機率（不必 normalize）：

```
p1..p4 = 3, 3, 1, 1
q0..q4 = 2, 3, 1, 1, 1
```

表的橫軸是 i，縱軸是「樹裡有幾個字」（j − i），一列一列往下填。

**第 0 列（沒有字）**：wᵢᵢ = qᵢ，cᵢᵢ = 0，rᵢᵢ = 0。

```
w00 = 2   w11 = 3   w22 = 1   w33 = 1   w44 = 1
```

> **陷阱** c₀₀ = 0，不是 2；2 是 w₀₀。

**第 1 列（一個字）**：root 只能是那個字。

- T₀₁（do）：w₀₁ = p₁ + q₀ + q₁ = 3 + 2 + 3 = 8；c₀₁ = 8 + c₀₀ + c₁₁ = 8 + 0 + 0 = 8；r₀₁ = 1。
- T₁₂（if）：w₁₂ = 3 + 3 + 1 = 7；c₁₂ = 7；r₁₂ = 2。
- T₂₃（return）：w₂₃ = 1 + 1 + 1 = 3；c₂₃ = 3；r₂₃ = 3。
- T₃₄（while）：w₃₄ = 1 + 1 + 1 = 3；c₃₄ = 3；r₃₄ = 4。

**第 2 列（兩個字）**：

- T₀₂：w₀₂ = w₀₁ + p₂ + q₂ = 8 + 3 + 1 = 12。
  - k = 1（do 當 root）：c₀₀ + c₁₂ = 0 + 7 = 7
  - k = 2（if 當 root）：c₀₁ + c₂₂ = 8 + 0 = 8
  - 取 7：c₀₂ = 12 + 7 = 19，r₀₂ = 1。（k = 2 那棵 if 當 root、do 掛左邊也是合法的 BST，只是比較貴。）
- T₁₃：w₁₃ = 7 + 1 + 1 = 9。
  - k = 2：c₁₁ + c₂₃ = 0 + 3 = 3
  - k = 3：c₁₂ + c₃₃ = 7 + 0 = 7
  - c₁₃ = 9 + 3 = 12，r₁₃ = 2。
- T₂₄：w₂₄ = 3 + 1 + 1 = 5。
  - k = 3：c₂₂ + c₃₄ = 0 + 3 = 3
  - k = 4：c₂₃ + c₄₄ = 3 + 0 = 3
  - 平手，取前者：c₂₄ = 5 + 3 = 8，r₂₄ = 3。

**第 3 列（三個字）**：

- T₀₃：w₀₃ = 12 + 1 + 1 = 14。
  - k = 1：c₀₀ + c₁₃ = 0 + 12 = 12
  - k = 2：c₀₁ + c₂₃ = 8 + 3 = 11
  - k = 3：c₀₂ + c₃₃ = 19 + 0 = 19
  - c₀₃ = 14 + 11 = 25，r₀₃ = 2。
- T₁₄：w₁₄ = 9 + 1 + 1 = 11。
  - k = 2：c₁₁ + c₂₄ = 0 + 8 = 8
  - k = 3：c₁₂ + c₃₄ = 7 + 3 = 10
  - k = 4：c₁₃ + c₄₄ = 12 + 0 = 12
  - c₁₄ = 11 + 8 = 19，r₁₄ = 2。

**第 4 列（四個字，答案一定在最下面這格 T₀₄）**：w₀₄ = 14 + 1 + 1 = 16。

| k | root | c(0,k−1) + c(k,4) | 和 |
|---|---|---|---|
| 1 | do | c₀₀ + c₁₄ = 0 + 19 | 19 |
| 2 | if | c₀₁ + c₂₄ = 8 + 8 | **16** |
| 3 | return | c₀₂ + c₃₄ = 19 + 3 | 22 |
| 4 | while | c₀₃ + c₄₄ = 25 + 0 | 25 |

最小 16 在 k = 2：**c₀₄ = 16 + 16 = 32，r₀₄ = 2（if）**。

整張表：

| j − i | i = 0 | i = 1 | i = 2 | i = 3 | i = 4 |
|---|---|---|---|---|---|
| 0 | w00=2 c00=0 r00=0 | w11=3 c11=0 r11=0 | w22=1 c22=0 r22=0 | w33=1 c33=0 r33=0 | w44=1 c44=0 r44=0 |
| 1 | w01=8 c01=8 r01=1 | w12=7 c12=7 r12=2 | w23=3 c23=3 r23=3 | w34=3 c34=3 r34=4 | |
| 2 | w02=12 c02=19 r02=1 | w13=9 c13=12 r13=2 | w24=5 c24=8 r24=3 | | |
| 3 | w03=14 c03=25 r03=2 | w14=11 c14=19 r14=2 | | | |
| 4 | w04=16 c04=32 r04=2 | | | | |

**把樹組回來**：r₀₄ = 2 → if 當 root；左邊 T₀₁ 的 root r₀₁ = 1 → do；右邊 T₂₄ 的 root r₂₄ = 3 → return；return 的右邊 T₃₄ 的 root r₃₄ = 4 → while。

```
          if
         /  \
       do    return
               \
               while
```

用 level 檢查：成功 = 3·1(if) + 3·2(do) + 1·2(return) + 1·3(while) = 14；失敗 = q₀·2 + q₁·2 + q₂·2 + q₃·3 + q₄·3 = 4 + 6 + 2 + 3 + 3 = 18；合計 32，與 c₀₄ 相符。

> **重點** 大的答案由前面算好的小答案推出來，這就是 dynamic programming。a₁ … aₙ 一定要先**排好序**。

> **觀念** 樹已經給定時，cost 一定會算；難在不知道樹長怎樣，又要 cost 最小。透過 weight 加總與遞迴，讓 left subtree、right subtree 都是最佳解；決定 root 的方法其實很直接：k 從 i+1 到 j 全部試，選最小。這張表第一次看常看不懂，演算法課的 DP 章節還會再出現一次。

## m-way search tree

前面的 BST、AVL、optimal BST 都是 binary。**m-way search tree** 一個 node 最多有 m 個 subtree（m 個 pointer）。

node 的內容：

```
n, A0, (K1, A1), (K2, A2), ..., (Kn, An)      n < m
K1 < K2 < ... < Kn
A0 指向 < K1 的子樹；Ai 指向介於 Ki 與 Ki+1 之間的子樹；An 指向 > Kn 的子樹
```

搜尋 x：從 root 開始，先看 node 裡有沒有 key 等於 x，有就找到；沒有的話，若 Kᵢ < x < Kᵢ₊₁，就往這兩個 key 中間的 pointer Aᵢ 走。

> **重點** 高度 h 的 m-way search tree 最多有 ∑(i=0..h−1) mⁱ = (mʰ − 1)/(m − 1) 個 node，最多 mʰ − 1 個 key。

## B-tree

### 定義

m-way search tree 裡最重要的一種是 **B-tree**。order 為 m 的 B-tree 是一棵 m-way search tree，而且：

1. root 至少有 2 個 child。
2. root 與 fail node 以外的 node，至少有 ⌈m/2⌉ 個 child。
3. 所有 fail node 都在同一個 level，所以 B-tree 永遠是平的。

m 叫 **order**。例如 order 3：非 root 的 node 至少 ⌈3/2⌉ = 2 個 child；order 4：中間層每個 node 至少 ⌈4/2⌉ = 2 個 pointer。

### 例題：在 B-tree 搜尋 30

```
                  [21 | 48 | 72]
                 /    |     |    \
                   [25 | 31 | 41]
                   /   |
                 [26]
                 /  \
               fail fail
```

1. root 的 21、48、72 都不是 30；30 落在 21 與 48 之間，往中間那個 pointer 走。
2. 到 [25 | 31 | 41]：沒有 30；30 落在 25 與 31 之間，再往下。
3. 到 [26]：還是沒有，再往下就是 fail node，回報找不到。

B-tree 每一層只走一個 node，搜尋成本跟樹高成正比。

### 為什麼要矮胖：少讀 disk

binary tree 每個 node 只有 2 個 child，key 一多樹就很高；AVL 雖然平衡，key 很多時高度還是很高。與其讓樹又高又瘦，不如讓它長胖變矮，很快就到 leaf。

file system、資料庫常用 B-tree、B+ tree：**每個 node 就是一個 disk block（page）**，每讀一個 node 就是一次昂貴的 disk access，所以要讓樹很矮。實作在 disk 上時，m 通常介於 32 到 256，樹非常矮。

代價是每個 node 裡要比的 key 變多了，所以 node 內用 binary search 找區間：例如在 [21 | 48 | 72] 找 30，先比中間的 48，再比 21，知道落在 21 到 48 之間。

> **觀念** 只要每個 node 的子節點數是常數，樹高仍是 O(log n)。B-tree 不靠旋轉來平衡，而是靠 split / merge，平衡的方式和 AVL 不同。

### 插入與刪除（概念）

- **insert**：先像 search 一樣找到該放的 leaf。leaf 沒滿就直接放；滿了又硬塞（例如一個 node 最多 5 個 key，又塞第 6 個）就 **overflow**，要 **split**：拆成兩個，中間的 key 推到上一層，上層的 index 也跟著調整。
- **delete**：找到 key 刪掉後，若 child 少於 ⌈m/2⌉ 就是 **underflow**，要跟兄弟借或 **merge**（合併）。

> **陷阱** delete 後要檢查的是 underflow（太少），不是 overflow。

細節用 2-3 tree、2-3-4 tree 來看。

## 2-3 tree

### 定義與搜尋

order 3 的 B-tree 叫 **2-3 tree**，order 4 叫 **2-3-4 tree**，兩者都是 B-tree。2-3 tree：root 至少 2 個 child，其他 internal node 至少 ⌈3/2⌉ = 2 個 child，所以每個 node 放 1 或 2 個 key、有 2 或 3 個 child。

> **重點** n 個 key 的 2-3 tree，高度介於 log₃(n+1) 與 log₂(n+1) 之間。

search x（node 裡 key 為 k1 < k2）：

1. x 等於某個 key → 找到。
2. x < k1 → 走左邊。
3. k1 < x < k2 → 走中間。
4. x > k2 → 走右邊。

### 插入：滿了就 split

先用 search 找位置（key 已存在就不插），落到的 leaf 叫 u：

- u 只有 1 個 key：直接放進去，結束。
- u 已有 2 個 key：放進去變 3 個，要 **split**：
  1. 產生新 node，放三個裡**最大**的；
  2. **中間**的 key 推到 u 的 parent；
  3. **最小**的留在 u。

> **例題** 從下面這棵開始，依序 insert 70、30、60。

```
          A[40]
         /     \
   B[10 20]    C[80]
```

**insert 70**：70 > 40 往 C 走，C 只有 80，還有空位，直接放。

```
          A[40]
         /     \
   B[10 20]    C[70 80]
```

**insert 30**：30 < 40 走到 B，B 已有 10、20，滿了 → split B：最大的 30 放新 node D，中位數 20 推到 A，10 留在 B。

```
            A[20 40]
          /    |     \
      B[10]  D[30]  C[70 80]
```

**insert 60**：60 > 40 走到 C，C 已有 70、80 → split C：80 到新 node E，60 留在 C，70 推給 A。A 變成 20、40、70，又爆了 → 再 split A：70 到新 node F，20 留在 A，40 拉到新的 root G。

```
                 G[40]
               /       \
          A[20]         F[70]
          /   \         /    \
      B[10]  D[30]  C[60]   E[80]
```

兩次 split 是連鎖反應，新 node 依序是 E、F、G。

> **重點** 2-3 tree 只有 root split 時樹高才 +1，樹是「從上面長高」的，所以 leaf 永遠在同一層。

### 刪除：rotate 與 combine

> **例題** 從下面這棵開始，依序 delete 70、90、60、95。

```
              A[50 80]
           /     |     \
     B[10 20] C[60 70] D[90 95]
```

1. **delete 70**：70 在 50、80 之間，走到 C 刪掉，C 還剩 60，沒事。
2. **delete 90**：D 還剩 95，沒事。
3. **delete 60**：C 空了，違反 2-3 tree 性質。左兄弟 B 有兩個 key，可以分一個 → **rotate**：parent 的 50 搓下來給 C，B 的 20 丟上去給 parent，大小順序仍正確。

```
              A[20 80]
           /     |     \
       B[10]   C[50]   D[95]
```

4. **delete 95**：D 空了，兄弟 C 只有一個 key，分不出來，不能 rotate → **combine**：把 parent 的 80 拉下來跟 C 合併，D 拿掉。

```
           A[20]
          /     \
      B[10]    C[50 80]
```

> **重點** rotate 盡量不動 pointer，只讓 key 在 node 之間轉。相鄰兄弟有 2 個 key 才能 rotate；兄弟只有 1 個 key 就 combine（拉 parent 的 key 下來合併）。

## 為什麼需要紅黑樹

### AVL 的優缺點

- AVL 好教：insertion 的四個 case 其實只有兩種：轉一次或轉兩次。
- 缺點：每個 node 要多存 subtree 高度（例如一個 4 byte 的 int 或 short），有 memory overhead。
- 優點：樹比較矮，適合 search。
- 為了一直保持矮，insertion、removal 的維護要多花力氣；還是 O(log n)，只是常數大一些。AVL 是「路見不平」：一看到不平衡就幾乎立刻 rebalance。

**red-black tree（紅黑樹）** 走相反的路：寬鬆一點，search 可能多花一點點，但 insertion、removal 更有效率，適合資料常變動的動態環境；而且每個 node 只存顏色，兩種顏色 1 bit 就夠。唯一的缺點是難教。

紅黑樹的規則（先看一眼）：

1. root 是黑色。
2. 紅色 node 的小孩一定是黑色（不能兩個紅連在一起）。
3. 從 root 到每個 leaf（空腳），經過的黑色 node 數量都一樣。

直接背規則和插入步驟（插紅色、看爸爸、再看叔叔……）就像念咒語。其實紅黑樹對應一個很好懂、但不好實作的結構：**2-3-4 tree**。先學它，再對照紅黑樹。

## 2-3-4 tree

### 三種 node

BST 每個 node 只放一個 element；2-3-4 tree 的 node 可以放多個 element、有多個小孩：

| node | element | 小孩 |
|---|---|---|
| 2-node | a | 2 個：< a、> a |
| 3-node | a < b | 3 個：< a、a 與 b 之間、> b |
| 4-node | a < b < c | 4 個 |

沒滿的 node 就是暫存區，新來的可以直接擠進去：有一點不平衡也先放著。（也可以做 2-3 tree 或 2-3-4-5 tree，但對應紅黑樹的是 2-3-4。）

### 兩條規定

典型的 2-3-4 tree：

```
              [5 16]
           /    |      \
        [3] [7 11 14] [18 21]
```

1. 每個 node 是 2-node、3-node 或 4-node：**橫向有彈性**。
2. 所有 leaf 在同一個高度：**縱向反而更嚴格**。

更精確地說，要同高的是 leaf 往下伸出的空腳（之後會長東西的位置，即 external node / null link），可以想成「蟑螂腳」。所以樹高是 O(log n)。兩個極端：每個 node 都裝三筆（最矮），或每個都只裝一筆（像一棵完全平衡的 BST）。

> **重點** 2-3-4 tree 仍有 multi-way search 的順序性質，加上高度保證，就能在 O(log n) 找到東西。

### 插入：有空房就住

在上面那棵樹插入：

- **insert 2**：2 < 5 往左，到 [3] 已經是 leaf，不能再長一層；[3] 還沒滿，2 直接住進去 → [2 3]。
- **insert 20**：20 > 16，到 [18 21]，還有空房 → [18 20 21]。
- **insert 13**：走到 [7 11 14]，房間滿了。也不能往下塞，否則 13 長出的腳會跟別人不同層。

### 滿了就分家：insert 13

7、11、13、14 四個人擠爆了，叫 **overflow**。滿了就分家（split）：一定要有人留在這一層，leaf 的高度才不變；把中間的 11 或 13 抓上去（兩個都可以）。

不能抓 7：7 上去後，一邊有小孩（11 13 14）、一邊沒有，那邊的腳就不同高。

抓 11：11 擠進上一層變 [5 11 16]；7 接在 5 與 11 之間，13 14 接在 11 與 16 之間。

```
               [5 11 16]
          /     |    |      \
      [2 3]   [7] [13 14] [18 20 21]
```

### 連續分家，樹才長高：insert 23

接著插入 23：走到 [18 20 21]，滿了 → 抓 20 上去「取暖」，18 一家、21 23 一家。上面變成 [5 11 16 20]，也滿了 → 再抓 11（也可以抓 16）上去，成為新的 root，樹這時才長高一層。

```
                   [11]
              /            \
          [5]               [16 20]
         /   \            /    |    \
     [2 3]   [7]     [13 14] [18] [21 23]
```

> **重點** 整條路上每一代都滿，樹才會長高。insertion 只有兩件事：有空房就住；滿了就分家，把中間的往上 insert。

**問**：為什麼是 2-3-4，不能 3-4-5？
**答**：必須能容納只有一筆資料的 node（例如剛分家出來的 [7]）。

**問**：分家時中間有兩個人，選哪個會影響之後嗎？
**答**：不知道未來會插入、刪除什麼時，兩個一樣好，通常隨便拿一個。

**問**：分家後的 7 和 13 14 要合起來嗎？
**答**：不用。它們各自是 11 兩邊的小孩：一家變兩家，11 上去當聯絡人。11 再往上移時也不用合：7 仍是 5 的右小孩，13 14 仍是 16 的左小孩。

### 例題：依序插入 1 到 10

依序插入看起來很極端，會不會歪掉？（以下分家時都抓中間偏左的那個。）

```
插 1、2、3：     [1 2 3]

插 4（滿，2 上去）：
        [2]
       /   \
    [1]   [3 4]

插 5：  [2] / [1] [3 4 5]
插 6（滿，4 上去）：
        [2 4]
       /  |   \
    [1]  [3]  [5 6]

插 7：  [2 4] / [1] [3] [5 6 7]
插 8（滿，6 上去）：
          [2 4 6]
        /  |   |   \
     [1]  [3] [5] [7 8]

插 9：  [7 8 9]
插 10（7 8 9 10 滿，8 上去；上面 2 4 6 8 也滿，4 上去當 root）：
                 [4]
              /        \
          [2]            [6 8]
         /   \         /   |   \
       [1]   [3]     [5]  [7]  [9 10]
```

就算這麼極端的順序，大部分地方還有空房。

> **比喻** 像公司的階層化管理：人少時很扁平，從基層做起；人多了選小組長，組長多了再選大組長。樹是從底層往上（往根部）長的，所以不會長成歪斜的 linked list。

### 「蟑螂腳」的嚴格定義

**問**：把上圖的 [3] 這個 node 拿掉，還是合法的 2-3-4 tree 嗎？
**答**：不是。剩下的 leaf 都還在同一高度，但 [2] 的右邊那隻空腳比別人高一層，不合群。

所以正式定義是：**所有 external node（空腳、null link）都在同一層**，不只是 leaf 同高；也不能有空的 leaf。空腳的用途就是確認高度，管住樹高與資料量的關係。

## 2-3-4 tree ↔ 紅黑樹

### 為什麼要換成 binary tree

2-3-4 tree 的程式很難寫：一個 node 放三個排好的 element，要 if-then-else 半天，很容易寫錯。我們要的是 binary tree：一個 node 兩張小紙條（兩個 pointer），超好寫。辦法：把 2-3-4 tree 的每種 node，對應到 BST 裡的一小塊。

### 對應規則：黑是代表，紅是跟班

每個 2-3-4 node（一家人）選一個代表，**代表塗黑**放上面，其他家人**塗紅**，依大小接在代表下面。

```
2-node [a]       →      a(B)

4-node [a b c]   →        b(B)
                         /    \
                      a(R)    c(R)

3-node [a b]     →    a(B)            或         b(B)
                         \                      /
                         b(R)                a(R)
```

- 2-node：一個黑 node。
- 4-node：中間的當代表（黑），左右兩個紅，這樣最平衡。
- 3-node：兩種畫法都可以：小的當代表、大的紅色跟班在右下；或大的當代表、小的紅色跟班在左下。

> **比喻** 一棟房子住 1 到 3 個人，但只能有一個代表，就像分組報告只能有一個組長。

整棵換完就是紅黑樹。反過來，把每個黑色和相連的紅色圈起來，就是原本的 2-3-4 node。（因為 3-node 有兩種畫法，一棵 2-3-4 tree 可以對應好幾棵紅黑樹。）

### 例題：2 5 / 1｜3 4｜6 7 8

```
2-3-4 tree:
              [2 5]
           /    |      \
        [1]   [3 4]   [6 7 8]
```

[2 5] 讓 2 當代表（上面、黑），5 紅在右下；[6 7 8] 讓 7 當代表，6、8 紅；[3 4] 這次讓 4 當代表，3 紅在左下；[1] 自己當代表。

```
紅黑樹:
            2(B)
           /    \
        1(B)    5(R)
               /    \
            4(B)    7(B)
            /       /   \
         3(R)    6(R)   8(R)
```

### 再看一個例子：5 16 / 3｜7 11 14｜18 21

[5 16] 選 5 當代表；[7 11 14] 由 11 當代表；[18 21] 選 21 當代表；[3] 自己是代表。其他家人 16、7、14、18 塗紅。

```
               5(B)
              /    \
           3(B)    16(R)
                  /     \
              11(B)      21(B)
              /   \       /
           7(R)  14(R)  18(R)
```

### 黑色數量為什麼一樣（black-height）

從任一隻空腳往 root 數黑色 node：

- 從 3 底下出發：3(黑)、5(黑) → 2 個。
- 從 7 底下出發：7 紅不算、11 黑、16 紅不算、5 黑 → 還是 2 個。

因為每碰到一個黑，就是碰到一家的代表，也就是走過 2-3-4 tree 的一層。2-3-4 tree 的空腳全都同高，所以紅黑樹每條路徑上的黑色數量都一樣。這個數量叫 **black-height**（課本也叫 black depth），它其實就是對應 2-3-4 tree 的高度。

### 規則都從 2-3-4 來

- 紅色是跟著代表住的家人，所以**紅色的爸爸一定是黑**（例：7、14 的爸爸 11，18 的爸爸 21，16 的爸爸 5）。
- 代表總是放上面，所以 **root 一定是黑**。
- **紅色的小孩一定是黑**（或沒有小孩）：再往下接就是別家了。
- 每條路徑黑色數量相同：對應空腳同高。

### 紅黑樹的高度

每棵紅黑樹都對應一棵 2-3-4 tree，而 2-3-4 tree 的高度有保證（log n）。一個 2-3-4 node 最多拆成紅黑樹的兩層（黑 + 紅），所以紅黑樹最多是對應 2-3-4 tree 的 2 倍高：一個 log n，一個最多 2 log n，只差常數。

> **重點** 紅黑樹高度 ≤ 2 × (對應 2-3-4 tree 的高度) = O(log n)；black-height = 2-3-4 tree 的高度。

## 紅黑樹的插入

以下用 2 5 / 1｜3 4｜6 7 8 對應的那棵紅黑樹為例。實作上把空腳也當成黑色的 node（null 視為黑），判斷時只要問「是不是黑」。

### 有空房：塗紅就好

**insert 1.5**：2-3-4 tree 裡住進 [1] 這家（變 [1 1.5]）。紅黑樹裡照一般 BST 插入，接在 1 的右下；1 已經是代表，1.5 塗紅。

**insert 4.5**：2 右、5 左、4 右 → 接在 4 的右下，塗紅。4 當家長、4.5 當跟班（[3 4 4.5]）。

```
            2(B)
           /    \
        1(B)    5(R)
          \     /    \
        1.5(R) 4(B)   7(B)
              /   \    /  \
           3(R) 4.5(R) 6(R) 8(R)
```

只要對應到空房間，爸爸是黑的，塞進去標紅，什麼都不用做。

### 紅父不能容

**insert 1.8**：比 2 小、比 1 大、比 1.5 大 → 塗紅接在 1.5 的右下。1、1.5、1.8 歪成一串（就是 AVL 的 RR 情形）：這一家應該是 1.5 在上、1 與 1.8 在兩邊。1.8 的爸爸應該是黑色代表，它卻接在紅色後面，紅接紅，違規。

**insert 9**：接在 8 的右下，塗紅；爸爸 8 也是紅，同樣違規。對應 2-3-4 tree：[6 7 8] 塞 9 要分家。

紅父有兩種原因：

1. 這家沒滿，只是歪了，沒拿中間當頭（原本是 3-node，塞在不平衡的那一邊）。
2. 這家已經滿了（原本是 4-node，又塞一個，本來就要分家）。

怎麼分辨？看**叔叔**（uncle，爸爸的兄弟）。3-node 只有兩個人，爸爸旁邊接的是別家的黑色代表或空腳 → **黑叔叔**；4-node 的爸爸旁邊是同一家的紅色跟班 → **紅叔叔**。

### 黑叔叔：rotate（restructure）

黑叔叔就像 AVL：旋轉爺爺和爸爸，爸爸漆黑、爺爺漆紅，新點維持紅，其他 link 都不變。爺爺被轉下來，所以叫「黑叔逼爺退」。

> **例題** insert 1.8（外側：新點、爸爸、爺爺在同一直線）。

```
修正前                         修正後（rotate 1 與 1.5）
   1(B)   叔叔 = 1 的左空腳(黑)       1.5(B)
     \                              /     \
     1.5(R)                      1(R)    1.8(R)
        \
        1.8(R)
```

（這一小塊仍掛在 2 的左邊。）對應 2-3-4：[1 1.5 1.8]，1.5 當代表。

**內側情形**：新點在爸爸的另一邊（例如爺爺 G 的右孩子是爸爸 P，新點 x 是 P 的左孩子），要做**雙旋轉**：新點 x 轉上來漆黑，爺爺 G 漆紅、爸爸 P 維持紅。這是常考題。

```
修正前                    修正後（double rotation）
    G(B)                       x(B)
      \                       /    \
      P(R)                 G(R)    P(R)
      /
    x(R)
```

> **陷阱** 黑叔叔有外側（LL、RR：一次旋轉，爸爸漆黑、爺爺漆紅）與內側（LR、RL：兩次旋轉，新點漆黑、爺爺漆紅）兩種，不要只記外側。

### 紅叔叔：只變色（recolor）

紅叔叔表示這家是滿的 4-node，要分家。紅黑樹裡不改結構：

1. 紅爸爸、紅叔叔改成黑 → 各自成為一家的代表，分家完成。
2. 爺爺要往上加入上一家，新成員一律先紅 → 爺爺改紅。
3. 看爺爺的爸爸：是黑就停；又是紅，就再看是黑叔還是紅叔，繼續處理。

變色可能一路傳上去，所以叫「紅叔變色龍」。

> **例題** insert 9（從 2 5 / 1｜3 4｜6 7 8 那棵原始的樹開始）。

```
修正前                          第 1 步：紅叔叔 6 → recolor
         2(B)                            2(B)
        /    \                          /    \
     1(B)    5(R)                    1(B)    5(R)
            /    \                          /    \
         4(B)    7(B)                    4(B)    7(R)
         /       /   \                   /       /   \
      3(R)    6(R)   8(R)             3(R)    6(B)   8(B)
                       \                               \
                       9(R)                            9(R)
```

7 改紅後，爸爸 5 也是紅；5 的兄弟（7 的叔叔）是 1，黑色 → 黑叔叔；2 → 5 → 7 都往右，是外側 → rotate 2 與 5：5 漆黑、2 漆紅。

```
第 2 步：黑叔叔 1 → rotate
                 5(B)
              /        \
          2(R)          7(R)
         /    \        /    \
      1(B)    4(B)   6(B)   8(B)
              /                \
           3(R)                9(R)
```

對應 2-3-4 tree：root [2 5 7]，小孩 [1]｜[3 4]｜[6]｜[8 9]。

> **重點** 插入或刪除做完後，一律把 root 塗黑。紅叔叔的 recolor 一路傳到 root 時，root 會被改成紅，這時直接塗回黑即可，這正對應 2-3-4 tree 的 root 分家、樹長高一層。

### 四句口訣

1. **新生先為紅**：新插入的 node 一律塗紅，照一般 BST 插入（一定插在某隻空腳）。
2. **紅父不能容**：爸爸是黑就結束（2-3-4 那家有空房）；爸爸是紅就要調整（紅色是小弟，小弟頭上要有大哥，也就是那家的黑色代表）。
3. **黑叔逼爺退**：叔叔是黑 → rotate，爺爺被轉下來。
4. **紅叔變色龍**：叔叔是紅 → recolor，問題可能一路往上傳。

四句維持的就是 2-3-4 tree 與紅黑樹的等價關係。

### 例題：insert 15（紅叔叔接黑叔叔）

從 5 16 / 3｜7 11 14｜18 21 對應的紅黑樹開始，insert 15：塗紅，接在 14 的右下。

```
修正前
               5(B)
              /    \
           3(B)    16(R)
                  /     \
              11(B)      21(B)
              /   \       /
           7(R)  14(R)  18(R)
                    \
                    15(R)
```

**第 1 步**：爸爸 14 紅、叔叔 7 也紅 → [7 11 14] 這家滿了，要分家：11 推上去，7、14 改黑當新代表，11 像新生一樣改紅（recolor）。

```
第 1 步後
               5(B)
              /    \
           3(B)    16(R)
                  /     \
              11(R)      21(B)
              /   \       /
           7(B)  14(B)  18(R)
                    \
                    15(R)
```

**第 2 步**：11 的爸爸 16 也是紅，還沒完。11 的叔叔是 3，黑色 → [5 16] 這家沒滿，只是 11 插在不平衡的那一邊（5 → 16 往右、16 → 11 往左，內側）。5、16、11 重新排（restructure，雙旋轉）：11 當代表塗黑，5、16 變紅掛兩邊，上面的 5 滑下來。

```
第 2 步後
                  11(B)
               /         \
           5(R)           16(R)
          /    \         /     \
       3(B)    7(B)   14(B)    21(B)
                         \      /
                        15(R) 18(R)
```

對應 2-3-4 tree：root [5 11 16]，小孩 [3]｜[7]｜[14 15]｜[18 21]。root 11 是黑，結束。

> **重點** 紅叔叔只變色，問題往上傳；黑叔叔才旋轉，轉完就結束。

### 旋轉和變色，哪個貴

- 黑叔叔：要旋轉（restructure），改幾張小紙條（pointer），但只是一個 local rotation，做一次就結束。
- 紅叔叔：可能很多步，但只改顏色，樹的結構完全不動。對照 2-3-4 tree，紅叔是分家，要蓋新房子，反而最難；換到紅黑樹只是改一堆 1 bit，簡單又快。
- 而且很多插入根本不用調整：例如 3 黑、5 紅（3-node [3 5]）插入 2，爸爸 3 是黑，還有空房。

靠爸爸的顏色就能當場決定要不要調整，不必像 AVL 往上找到失衡點，所以紅黑樹很多時候比 AVL 更有效率。

> **觀念** 一個 4-node 只能放三個：黑 + 兩紅已經串好，再塞一個紅就是紅叔叔的情形，一定要分家。

## 紅黑樹的刪除

### 第一步：變成刪 leaf

BST 刪除的重要觀念：盡量讓刪除發生在 leaf，從中間砍斷再接回很麻煩。

以 5 16 / 3｜7 11 14｜18 21 那棵為例，要刪 16：先往右到 21，再一路往左鑽到底，找到 18（右子樹最小、16 的下一個）。把 18 請上來補 16 的位置，問題就變成刪掉底下那個 leaf 18。也可以找左子樹最大的；一邊空就找另一邊；兩邊都空，它本身就是 leaf。2-3-4 tree 也一樣：刪 16，就借 18 上來，改成刪 18。

畫圖時把空腳畫成黑色，像潛在的下一個 node：旁邊是黑空腳表示那家還有空間，是紅色表示那家可能已滿。

### 簡單的情形：那家還有人

2-3-4 tree 裡刪掉之後那家還有人，就很簡單：例如刪 18（21 還在）、刪 14、刪 11，都是從 4-node 或 3-node 刪一個人。

對應到紅黑樹，就是**刪紅色的 leaf**：除了把空腳接好，什麼都不用做。

但 2-3-4 的每種情形不一定直接出現在紅黑樹：11 在紅黑樹裡有小孩（7、14），不是 leaf。這時先走第一步，請 14 上去頂替 11 的位置，再刪掉紅色 leaf 14。

### 2-3-4 tree：向兄弟借（transfer）

難的是從 **2-node** 刪人。例如刪 3：3 走了，這家就沒人，直接拆掉空腳就不同高。

那就向兄弟家借：隔壁 [7 11 14] 住得很擠。離 3 最近的是爸爸 5：5 下來顧家，隔壁最小的 7 上去當新爸爸。隔壁剩兩人也沒關係。

```
刪 3 前                              刪 3 後（transfer）
          [5 16]                             [7 16]
        /   |     \                        /    |     \
     [3] [7 11 14] [18 21]              [5]  [11 14]  [18 21]
```

這叫 **transfer**，條件是 **borrowable**：相鄰兄弟是 3-node 或 4-node。

再看一例：先刪 7、14（都是簡單情形），樹變成 [5 16] / [3]｜[11]｜[18 21]。再刪 11（又是 2-node）：從 [18 21] 借，16 下來、18 上去。

```
          [5 16]                            [5 18]
        /   |    \          →             /   |    \
     [3]  [11]  [18 21]                [3]  [16]  [21]
```

### 2-3-4 tree：借無可借就合併（fuse）

接著刪 21：這家只有它一個，隔壁 [16] 也是一個人住；18 下來、16 上去也不行，借無可借。那就合在一起取暖：把爸爸 18 拉下來，跟兄弟 16 合成一家。

```
          [5 18]                         [5]
        /   |    \         →            /   \
     [3]  [16]  [21]                 [3]  [16 18]
```

這叫 **fuse**：爸爸跟被刪者的兄弟合體，上一層少了一個 key、一條連結。上一層原本是 3-node [5 18]，少一個是簡單情形；若上一層也是 2-node，就在上一層再做一次同樣的刪除。所以 fuse = 合併 + 在上一層 remove。

> **重點** 2-3-4 刪除：家裡還有人就直接刪；沒人就跟興旺的兄弟借（transfer），借不到就合併（fuse），合併可能往上連鎖。

### 紅黑樹：黑兄弟有紅外甥 → rotate

先看簡單的：2-3-4 是 [5] / [3]｜[7 11]，紅黑樹 7 當代表（黑）、11 紅在右下。刪 3，2-3-4 向兄弟 [7 11] 借。

在紅黑樹裡，要刪的 3 跟 2-3-4 的兄弟 7 在同一層；兄弟可借，表示**兄弟是黑色，而且有紅色小孩（紅外甥）**。做 rotate 5 跟 7（跟 AVL 的 rotate 一樣）：爸爸轉下來，兄弟轉上去；被借走的紅外甥 11 改塗黑。

```
刪 3 前                刪 3 後（rotate 5、7）
      5(B)                   7(B)
     /    \                 /    \
  3(B)    7(B)           5(B)    11(B)
             \
             11(R)
```

對應 2-3-4：[7] / [5]｜[11]，正是 transfer。

### 紅黑樹：沒得借 → recolor

再看不能借的：2-3-4 是 [5 16] / [3]｜[7]｜[18 21]。紅黑樹讓 16 當 root，5 是紅。

```
刪 3 前                           刪 3 後（recolor）
          16(B)                            16(B)
         /     \                          /     \
      5(R)     21(B)                   5(B)     21(B)
     /    \     /                         \      /
  3(B)   7(B) 18(R)                       7(R) 18(R)
```

刪 3，兄弟 [7] 沒人可借，要 fuse：5 拉下來跟 7 合成一家 [5 7]。紅黑樹只要重新塗色（**recolor**）：兄弟 7 塗紅變成跟班，5 塗黑當家長。

5 原本是紅（附屬的家人），樂得下來當家長，塗黑就結束。要是 5 原本就是黑，塗黑也補不回少掉的那個黑，就在它身上多圈一個黑（黑上加黑，**double black**），表示還沒完，要到上一層繼續處理，這就是 fuse 的「在上一層 remove」。

### 刪黑色的三種情形

刪紅色 leaf 永遠 easy，困難都在刪黑色。這裡的「兄弟」指 **2-3-4 tree 裡的兄弟**：

| 情形 | 紅黑樹的樣子 | 2-3-4 | 處理 |
|---|---|---|---|
| 一 | 兄弟同層、黑色，有紅色小孩 | transfer（可借） | restructure，做完就結束 |
| 二 | 兄弟同層、黑色，只有黑小孩 | fuse（不能借） | recolor，可能往上傳 |
| 三 | 兄弟不同層：紅黑樹的兄弟是紅色（red sibling） | 兄弟的 3-node 排法不合預期 | 先 rotate，變成情形一或二 |

### 情形一通式：restructure

A 是兄弟們的爸爸，顏色不一定（紅或黑），在 2-3-4 代表上一層。x 要刪，兄弟 B 是黑，底下有紅色的 C 可以借。

**C 在內側**（C 介於 A 與 B 之間）：x 刪掉後，A 下去頂在 x 的位置；C 上去坐 A 原本的位置，A 在左、B 在右，C 剛好介於兩者之間，仍是 BST。

```
修正前                         修正後
     A(?)                         C(A 原本的顏色)
    /    \                       /    \
  x(B)   B(B)                  A(B)   B(B)
         /
       C(R)
```

- A 塗黑：它是空掉那家的新主人。
- B 本來就是家長，仍是黑。
- C 坐的是 A 原本的位置，所以**繼承 A 原本的顏色**。

**C 在外側**（例如 B 的右小孩）：單旋轉 A、B，B 上去拿 A 原本的顏色，A 與 C 塗黑（就是前面刪 3 那個例子）。

restructure 和 AVL 的 restructure 類似：把三代關係重新組成平衡狀態；做完就結束，不會再往上。

### 情形二通式：recolor

兄弟 B 是黑，而且沒有任何紅色小孩，沒人可借（對應 fuse）：

1. 兄弟 B 改塗紅，變成附屬的家人。
2. 爸爸 A 要「加一個黑」：A 原本是紅，被請下來當家長，塗黑就解決。
3. A 原本是黑 → A 變成 **double black**，等於要在上一層刪掉它；對 A 再看它的兄弟和外甥，重複三種情形。

```
A 原本紅：                      A 原本黑：
    A(R)          A(B)             A(B)           A(BB)  ← double black，往上處理
   /    \    →       \            /    \    →        \
 x(B)   B(B)         B(R)       x(B)   B(B)          B(R)
```

recolor 不改結構，但可能一路往上，像 AVL 往上更新高度。

### 情形三：紅兄弟是假兄弟

要刪的 x 是黑，紅黑樹裡的兄弟 B 卻是紅。這個紅色是**假兄弟**：它其實是 2-3-4 tree 裡爸爸那一層的人，因為上一層那個 3-node [A B] 排成了 A 在上、B 在下。

先轉一轉：rotate A 與 B，讓 B 在上、A 在下，B 塗黑、A 塗紅。轉完，x 的真兄弟一定是黑色帶頭，就照情形一或二處理。

> **例題** 2-3-4 是 [5 16] / [3]｜[7 11]｜[18 21]，刪 3。

```
刪 3 前：3 的紅黑樹兄弟是 16（紅）→ 情形三
               5(B)
              /    \
           3(B)    16(R)
                  /     \
               7(B)     21(B)
                  \      /
                 11(R) 18(R)
```

第 1 步：rotate 5、16，16 上去塗黑，5 下來塗紅；3 的真兄弟變成 7（黑）。

```
               16(B)
              /     \
          5(R)       21(B)
         /    \       /
      3(B)    7(B)  18(R)
                \
                11(R)
```

第 2 步：真兄弟 7 是黑、有紅色小孩 11（外側）→ 情形一：rotate 5、7，7 拿 5 原本的顏色（紅），5、11 塗黑，3 拿掉。

```
               16(B)
              /     \
          7(R)       21(B)
         /    \       /
      5(B)   11(B)  18(R)
```

對應 2-3-4：[7 16] / [5]｜[11]｜[18 21]，5 下來、7 上去，就是 transfer。若一開始選 7 當上面那個（16 在 7 下面）畫法不同，但同樣牽涉 5、16、11、7 四個 node 的重排。

### 紅黑樹刪除的完整步驟

1. 先換成刪 leaf（找右子樹最小或左子樹最大來頂替）。
2. 刪的是紅色 → 直接拿掉。
3. 刪的是黑色：
   1. 兄弟是紅（red sibling）→ 先 rotate 那個 3-node，找出真兄弟。
   2. 真兄弟（一定是黑）有紅小孩 → restructure，做完就結束。
   3. 真兄弟只有黑小孩 → recolor；爸爸原本紅就結束，原本黑就成為 double black，到上一層重複。
4. 最後把 root 塗黑（double black 傳到 root 時，直接去掉多的那個黑即可）。

每一步都對應 2-3-4：從 4-node、3-node 刪是 easy；從 2-node 刪先找真兄弟，有得借就 transfer（restructure），沒得借就 fuse（recolor）。

> **重點** 紅黑樹的刪除（以及插入）的各種情形，是資工所考試最常考的觀念題：入學考試不容易考寫 code，但常考這些操作的步驟與對應。

### 例題：double black 怎麼往上傳

double black 就是一個記號：這裡還有沒解決的事，要特別小心。

```
2-3-4 tree:
                  [20]
               /         \
           [10]           [30 40]
          /    \        /    |    \
        [5]   [15]   [25]  [35]  [45]

紅黑樹（刪 5 前）:
                 20(B)
               /       \
           10(B)        30(B)
          /    \       /     \
       5(B)  15(B)  25(B)    40(R)
                            /     \
                         35(B)   45(B)
```

刪黑色 leaf 5（x）：兄弟 15（y）是黑，沒有紅小孩可借 → 情形二 recolor：15 塗紅。爸爸 10（A）原本是黑 → 10 變成 double black，等於要在上一層刪掉它，像迴圈跑回上一層。

```
                 20(B)
               /       \
          10(BB)        30(B)
              \        /     \
             15(R)  25(B)    40(R)
                            /     \
                         35(B)   45(B)
```

上一層：10 的兄弟 30（S）是黑，而且有紅色小孩 40（C，外側）→ 情形一：以 20（P）為軸旋轉，30 上去拿 20 原本的顏色（黑），20 和 40 塗黑，double black 消失。

```
                    30(B)
                 /        \
             20(B)         40(B)
            /     \        /    \
        10(B)    25(B)  35(B)   45(B)
            \
            15(R)
```

對應 2-3-4：刪 5 → [10] 與 [15] fuse 成 [10 15]，上一層 [10] 變空 → 向 [30 40] transfer：20 下來、30 上去，得到 [30] / [20]｜[40] / [10 15]｜[25]｜[35]｜[45]。每條路徑的黑色數量都是 3。

> **觀念** restructure 是一次性的，做完就解決；沒人可借才 recolor，黑色才會繼續往上傳。recolor 往上傳遞，和 2-3-4 tree 在 fuse 時到上一層做 removal，是一模一樣的事。

### 為什麼刪除還是 O(log n)

- 2-3-4 tree 高度 O(log n)，一個 2-3-4 node 最多變成兩層紅黑樹 node，所以紅黑樹高度也是 O(log n)。
- 刪除中跟樹高有關的只有 recolor，對應一連串的 fuse。
- restructure 從隔壁借到人就沒事了，不會影響其他層。
- 紅兄弟時，爸爸跟兄弟轉一次就好，轉完就有黑兄弟。
- 找 node 花樹高的時間，維護也最多花樹高的時間 → 仍是 O(log n)。

## 總整理：2-3-4 操作 ↔ 紅黑樹操作

| 2-3-4 tree | 紅黑樹 |
|---|---|
| insert 進 2-node（有空房） | 加一個紅色就好（爸爸是黑） |
| insert 進 3-node | 大多只是塞個紅的；方向不對（黑叔叔）才 restructure |
| insert 進 4-node（滿了，分家） | recolor（紅叔叔），甚至一連串 recolor |
| remove from 4-node / 3-node | 剪掉紅色的 leaf |
| remove from 2-node：transfer | restructure（兄弟排法不對時先做一次 pre-restructure） |
| remove from 2-node：fuse | recolor，可能往上傳 |

2-3-4 tree 最複雜的分家（overflow）與合併（fuse），到紅黑樹都只是 recolor：只改顏色 bit，不改指標。restructure 只在逼不得已時才做，不像 AVL 每次插入都要完整檢查。

### 課本的三條規則

課本的 official 定義：

1. 紅色 node 的小孩一定是黑（往下就是下一個 2-3-4 node）。
2. root 是黑（root 是 2-3-4 node 的代表）。
3. 所有 external node（空腳）的 **black depth** 都一樣。

black depth 其實就是 2-3-4 tree 的高度。這三條全都是從 2-3-4 tree 來的；最神奇的 black depth 維護，來源就是 2-3-4 tree 的空腳同高。

## 樹的家族

```
BST ──嚴格平衡──→ AVL tree
 │
 └─multiway─→ 2-3 tree ──→ 2-3-4 tree ──→ B-tree family（B-tree、B+ tree…）
                 │              │
             binary 版本     binary 版本
                 ↓              ↓
              AA tree        紅黑樹
```

- BST 做嚴格（rigorous）的平衡，就是 AVL tree。
- 往 multiway 發展：2-3 tree，再到 2-3-4 tree。
- 2-3-4 tree 的 binary 版本是紅黑樹；2-3 tree 的 binary 版本叫 **AA tree**。
- 紅黑樹在需要的性質（search 快、insert/remove 快、省空間）之間取得比較好的平衡，所以最 popular。
- multiway 再發展，就是整個 B-tree 家族，一個 node 裝很多資料，很適合硬碟等 external storage：一次抓一把，不用拿著小紙條到處找。

> **觀念** 先了解儲存媒介的特性，才能設計出好的資料結構。資料結構像工具箱，沒有絕對好壞，要依問題挑適合的工具。

> **觀念** 實作紅黑樹不必從零寫：讀懂現成函式庫（例如 LibAVL）裡 AVL 四種情形與紅黑樹的寫法、並能修改，往往比重造輪子更重要。自己寫遞迴時要注意終止條件與 edge case（例如整棵樹只有 root）。「紅黑」與 B-tree 的「B」名稱由來說法不一，不必背。

## 重點整理
- 跑道預約：sorted array 搜尋 O(log n) 但插入要 shift O(n)；sorted list 插入 O(1) 但搜尋 O(n)；heap、hash 找不到 t 附近的值 → BST
- Skip list：每層約砍一半、約 log n 層；空間 n(1 + 1/2 + 1/4 + …) ≤ 2n = O(n)；插入丟銅板決定層數，搜尋是「期望」O(log n)、最差 O(n)
- BST 性質：左子樹「整棵」都比 node 小、右子樹整棵都比 node 大（不只直接的孩子）；嚴格 < 不放重複 key
- BSTSearch 第一行要先判斷 T 為空（終止條件）
- BST 的 search、insert、delete、min、max、successor、predecessor 全是 O(h)；插入 = 在「該找到卻找不到」的地方放進去
- min 一直往左、max 一直往右；in-order traversal（左、自己、右）印出排序結果，O(n)
- k 分鐘檢查只要看搜尋路徑：t 的 predecessor、successor 一定在路徑上
- Augmentation：node 存子樹大小；rank(t) = 沿路徑對每個 key ≤ t 的 node 加 1 + 左子樹 size，O(h)
- 刪除：0 個孩子直接刪；1 個孩子接上；2 個孩子用右子樹最小（或左子樹最大）補位
- 高度取決於插入順序：已排序的 key 依序插入 → 退化成 linked list，h = n，失去 O(log n)
- 3 個 key 有 3! = 6 種插入順序，只有中間值先插的 2 種是平衡的
- 12 個月照字母順序插入：最多比 12 次、平均 78/12 = 6.5 次；AVL 版最多 5 次
- 限制寬鬆→嚴格：一般 BST（最差 O(n)）、紅黑樹、AVL（常數次旋轉、最差 O(log n)）、complete BST（維護 O(n)）
- AVL 搜尋稍快、插入稍慢；紅黑樹相反，實務較常用
- node 高度 = max(h_L, h_R) + 1，空子樹 = −1、leaf = 0（數邊）；數層慣例 leaf = 1、空樹 = 0，差值相同
- AVL：每個 node |h_L − h_R| ≤ 1；BF = h_L − h_R ∈ {−1, 0, 1}，看高度不看節點數，每個 node 都要成立
- 任何 complete tree 都是 AVL，所以任何 n 都排得出 AVL
- 最少節點 N_h = 1 + N_{h−1} + N_{h−2}：N_0..N_4 = 1, 2, 4, 7, 12（數邊）
- AVL 高度 h < 1.44 log₂(n + 2)（Fibonacci 下界 N_h > F_h ≈ φʰ/√5）；簡單版 N_h > 2N_{h−2} → h < 2 log₂ n
- Rotation 是 O(1)、保持 in-order 順序；right rotate(A)：B = A.left 上來，B 的右子樹變 A 的左子樹，共改 3 條連結（含 parent）
- 失衡類型看「從 A 往 Y 的頭兩步」：LL、RR 單旋；LR、RL 雙旋；A = 從 Y 往上第一個 |BF| = 2 的 node
- LL 通式：B 上提，B_R 給 A 當左子樹；RR 通式：A.right = B.left; B.left = A
- LR 通式：C 拉上來，四塊 B_L、C_L、C_R、A_R 由左到右接；RL：A_L、C_L、C_R、B_R
- 插入時修好最低的違規點一次（單旋或雙旋）就夠，因為該子樹高度回到插入前；刪除可能要一路往上，最多 O(log n) 次旋轉
- 旋轉後更新高度由下往上：先舊 parent（降下去的）再新 parent
- AVL insert 總成本 O(log n)，O(1) 指的是旋轉本身；每插一個就調整，bf 不會出現 ±3
- AVL 存高度（或 bf）不能只存節點數；用 pointer 實作，不用 array
- 建 AVL：n 次插入 O(n log n)；AVL sort = n 次插入 + in-order = O(n log n)
- AVL 找第 k 小用 leftSize，O(log n)；sorted array 是 O(1)
- ADT 規定操作（priority queue = insert、delete、min），資料結構負責實作；要 successor/predecessor 就需要 balanced BST
- Optimal BST 的 cost = ∑ pᵢ·level(aᵢ) + ∑ qᵢ·(level(Eᵢ) − 1)；fail node 那項要減 1
- 只看 worst case（樹高）不夠，要把搜尋機率算進 cost；機率一變，最佳樹就變；前提是 static set
- extended binary tree：E = I + 2n（path 長度算 edge 數，root 為 0）
- n 個 key 的 BST 數量是 Catalan number C(n) = (2n)!/(n!(n+1)!)，n = 10 有 16796 棵，暴力法不可行
- DP：wᵢⱼ = wᵢ,ⱼ₋₁ + pⱼ + qⱼ；cᵢⱼ = wᵢⱼ + min{c(i,k−1) + c(k,j)}，i < k ≤ j；初始 wᵢᵢ = qᵢ、cᵢᵢ = 0、rᵢᵢ = 0
- 例 (do, if, return, while)，p = 3,3,1,1、q = 2,3,1,1,1：c₀₄ = 32、r₀₄ = 2，樹 = if 為 root、do 左、return 右、while 在 return 右
- 高度 h 的 m-way search tree 最多 (mʰ − 1)/(m − 1) 個 node、mʰ − 1 個 key
- B-tree（order m）：root 至少 2 個 child；其他非 fail node 至少 ⌈m/2⌉ 個 child；所有 fail node 同一層
- B-tree 矮胖 = 少讀 disk；一個 node = 一個 disk block；m 常為 32～256；node 內用 binary search
- B-tree insert：滿了 overflow → split（中間 key 往上推）；delete 後 underflow → 借或 merge
- 2-3 tree 高度介於 log₃(n+1) 與 log₂(n+1)；只有 root split 時才長高，leaf 永遠同層
- 2-3 tree split：最大放新 node、中間推給 parent、最小留原 node；delete：兄弟有 2 key → rotate，否則 combine
- AVL 每 node 存高度、樹較矮利於 search；紅黑樹每 node 只存 1 bit 顏色，insert/remove 較有效率
- 2-3-4 tree：2/3/4-node 橫向有彈性；所有 external node（空腳）同一層
- 2-3-4 insert：有空房就住；滿了就分家，中間的往上 insert；整條路都滿才長高
- 2-3-4 → 紅黑樹：每家代表塗黑放上面，其他家人塗紅；4-node 中間當代表；3-node 有兩種畫法
- 紅黑樹規則：root 黑；紅 node 的小孩是黑；每條 root 到空腳路徑的黑色數量相同（black depth = 2-3-4 樹高）
- 紅黑樹高度 ≤ 2 × 2-3-4 樹高 = O(log n)
- 插入四句：新生先為紅、紅父不能容、黑叔逼爺退（rotate）、紅叔變色龍（recolor，可能往上傳）
- 黑叔叔外側（LL/RR）單旋：爸爸黑、爺爺紅；內側（LR/RL）雙旋：新點黑、爺爺紅
- 插入或刪除後一律把 root 塗黑
- 紅叔叔只變色、只改 1 bit，結構不動；黑叔叔旋轉一次就結束
- 刪除：先換成刪 leaf；刪紅 leaf 直接拿掉；刪黑分三種：黑兄弟有紅小孩 → restructure（C 拿 A 原本顏色，A、B 黑；外側時 B 拿 A 顏色，A、C 黑）；黑兄弟無紅小孩 → 兄弟塗紅、爸爸紅變黑結束，爸爸黑則 double black 往上；紅兄弟 → 先 rotate（兄弟黑、爸爸紅）再處理
- 2-3-4 刪除：有人直接刪；2-node 向兄弟借（transfer）或與爸爸、兄弟合併（fuse，上一層再 remove）
- 對應：transfer ↔ restructure、fuse ↔ recolor、insert 進 4-node ↔ recolor、刪 3/4-node ↔ 刪紅 leaf
- 刪除仍 O(log n)：只有 recolor 會往上傳，restructure 與紅兄弟 rotate 都只做一次
- 樹的家族：BST → AVL；BST → 2-3 → 2-3-4 → B-tree family；2-3-4 ↔ 紅黑樹，2-3 ↔ AA tree

## 名詞對照
| 中文 | English |
|---|---|
| 二元搜尋樹 | binary search tree (BST) |
| 跑道預約 | runway reservation |
| 不變條件 | invariant |
| 隨機存取 | random access |
| 跳躍串列 | skip list |
| 隨機化資料結構 | randomized data structure |
| 根 | root |
| 葉節點 | leaf |
| 子樹 | subtree |
| 深度 | depth |
| 高度 | height |
| 中序走訪 | in-order traversal |
| 後繼者 | successor |
| 前驅者 | predecessor |
| 多重集合 | multiset |
| 擴增 | augmentation |
| 排名 | rank |
| 偏斜二元搜尋樹 | skewed binary search tree |
| 平衡樹 | balanced tree |
| 完整二元樹 | complete binary tree |
| 高度平衡 | height balanced |
| AVL 樹 | AVL tree |
| 平衡因子 | balance factor (BF) |
| 紅黑樹 | red-black tree |
| 旋轉 | rotation |
| 左旋／右旋 | left rotate / right rotate |
| 單旋轉 | single rotation |
| 雙旋轉 | double rotation |
| 重路徑 | heavy path |
| 之字形 | zigzag |
| 再平衡 | rebalance |
| 黃金比例 | golden ratio (φ) |
| 抽象資料型態 | abstract data type (ADT) |
| 優先佇列 | priority queue |
| 原地 | in place |
| 開放定址 | open addressing |
| 可擴充雜湊 | extendible hashing |
| 完美雜湊 | perfect hash |
| 最佳二元搜尋樹 | optimal binary search tree |
| 比較 | comparison |
| 最壞情況 | worst case |
| 失敗節點 | fail node |
| 延伸二元樹 | extended binary tree |
| 內部路徑長 | internal path length |
| 外部路徑長 | external path length |
| 歪斜樹 | skewed tree |
| 靜態集合 | static set |
| 卡特蘭數 | Catalan number |
| 動態規劃 | dynamic programming |
| 權重 | weight |
| m 路搜尋樹 | m-way search tree |
| 階 | order |
| 磁碟區塊 | disk block |
| 溢位 | overflow |
| 下溢 | underflow |
| 分裂 | split |
| 合併 | merge / combine / fuse |
| 2-3 樹 | 2-3 tree |
| 2-3-4 樹 | 2-3-4 tree |
| 外部節點 | external node |
| 黑高度／黑深度 | black-height / black depth |
| 叔叔節點 | uncle |
| 兄弟節點 | sibling |
| 重組 | restructure |
| 重新著色 | recolor |
| 借位 | transfer |
| 雙黑 | double black |
| 紅兄弟 | red sibling |
| AA 樹 | AA tree |
