# 樹（基礎）

很多資料天生有階層：組織圖、檔案目錄、運算式。Tree 就是用來存這種資料的結構，而 binary tree 是後面所有搜尋樹、heap 的基礎。這章從定義與名詞開始，學 tree 的各種表示法、binary tree 的性質（node 數上下界、n₀ = n₂ + 1、full 與 complete）、四種走訪（inorder、preorder、postorder、level order）、threaded binary tree，再到 heap、Huffman code、BST、selection tree 與 disjoint set（union-find）。走訪順序、由走訪結果重建樹、heap 的插入刪除、Huffman 編碼與 union-find 都是考試常客。

## 學完這章要會
- 正確使用 level、depth、height、degree、leaf 等名詞，注意 root 算 level 0 或 level 1 的兩種慣例
- 把一般樹用 left-child right-sibling 轉成 binary tree
- 算 binary tree 第 i 層最多幾個 node、高度 h 的 node 數上下界，證明 n₀ = n₂ + 1
- 分辨 full binary tree 與 complete binary tree；用 array 存 complete binary tree（2i、2i+1、⌊i/2⌋）
- 手算 inorder、preorder、postorder、level order，寫出遞迴與非遞迴（stack、queue）程式
- 判斷哪些走訪組合能唯一決定一棵樹，並從 inorder + preorder 重建
- 說明 threaded binary tree 的用途與 thread 的接法
- 對 max heap 做 insert（往上爬）與 deleteMax（往下落），知道都是 O(log n)
- 建 Huffman tree、算編碼長度與壓縮後的位元數
- BST 的搜尋、插入、刪除與用 leftSize 找第 k 小
- winner tree／loser tree 的用途；union-find 的 weighting rule 與 collapsing rule

## 為什麼需要 tree：有階層的資料

之前學的資料結構都是「平平的」：vector 把資料一格一格攤成一排，每格有編號 [0]、[1]、[2]；linked list 像一串人在排隊，箭頭只代表「下一個」。兩者都沒有上下之分，光看一排資料，看不出誰屬於誰。

樹（tree）要表達的是 **hierarchical（階層）關係**：誰在上、誰在下、誰管誰。之後很多更複雜的資料結構，都是從 tree 長出來的。

### 例子：大學的組織圖

```
                          台大
          ┌────────┬───────┴──────┬──────────────┐
        理學院    工學院       社會科學院      電機資訊學院
        ┌──┴──┐     │                         ┌───┴───┐
      數學系 物理系 土木系                    資訊系   電機系
```

學校一層、學院一層、系所一層，一層一層往下，這就是階層。把學校、學院、系所都當成一筆資料，再好好表示它們的上下關係，這種 data structure 就叫 tree。

> **觀念** tree 不是什麼關係都能表示，它在意的是**從屬**：往上看「我屬於誰」，往下看「我管哪些」。

### 例子：檔案目錄

電腦的目錄裡有子目錄，子目錄裡還有子目錄，一路往下最後才是一個個檔案。Windows、Mac、Linux 的檔案系統都是用 tree 在分門別類。

### 其他應用

- **族譜**：上面是祖先，下面接它的 child，child 再生自己的 child，一層一層長下去。課本用歐洲人種的族譜示意：最上面是共同祖先，往下分出不同民族。真實的族譜可以非常深，例如某人在族譜的 level 32，來台的祖先在 level 28，那位祖先就是一棵 subtree 的 root。
- **Sensor network 的 object tracking**（物體追蹤）也用 tree 組織。
- **PCS 行動通訊**：最底下的 leaf node 是基地台，手機開機就向所在基地台註冊。使用者從 K 基地台的範圍走到 L 的範圍，叫 **handoff**；L 若沒有足夠的 channel，通話就會被中斷（blocking / dropping）。

## Tree 的定義

### Root 與 subtree

觀察組織圖：它有一個階層最高的地方，這個最高的 node 叫 **root（樹根）**。自然界的樹根長在下面，資訊系的樹剛好倒過來，root 畫在最上面。

root 底下，每個學院連同它的系，自己也是一個有階層的小結構。這些藏在大樹裡的小樹也是樹，叫 **subtree（子樹）**，記作 T1、T2、…。

定義：**一棵樹 T 由一個 root，加上 n 棵 subtree T1…Tn 組成。** 對回組織圖：root 裝「台大」，四個學院各是一棵 subtree，n = 4。

課本的正式寫法：

> **重點** Tree 是一個或多個 node 的有限集合（a finite collection of nodes），其中有一個特別的 node 叫 root（最原始的祖先）；其餘 node 分成 T1…Tk 幾棵**互不相交（disjoint）**的 subtree，每棵 subtree 本身也是 tree。因此一般的 tree **一定有 root，不能是空的**。

一個 node 最多能連出幾個 child（分枝數）可以依需求規定；規定最多 2 個，就是 binary tree（後面詳述）。

### 遞迴定義與終止條件

上面是用「樹」來定義「樹」，因為 subtree 本身也是樹，這叫 **recursive definition（遞迴定義）**。遞迴的意思是：解一件事時，叫一個結構一樣的自己去解其中一小塊，再把結果合起來。T1 也可以依樣畫葫蘆：它有自己的 root（理學院），底下又有 T1-1、T1-2…T1-m 這些更小的樹。大樹拆小樹，小樹拆更小的樹。

> **陷阱** 只寫出「拆」的遞迴式，程式（或定義）還不算完成，因為不保證會停。跟遞迴式同等重要的是 **termination condition（終止條件）**：什麼時候已經小到不能再小。

Tree 的終止情形：一個 node 只有自己、下面沒有任何 subtree（例如「數學系」），遞迴就停在這裡。**遞迴式 + 終止條件**，定義才完整。（教科書也常把「空樹」當作遞迴的基底；binary tree 的定義允許空樹，但 general tree 的定義要求至少一個 node。）

### Ordered tree 與 unordered tree

定義沒說清楚：T1、T2、T3 之間要不要排順序？

- 從某個角度看，各學院是平等的，只要知道都屬於台大，換個位置排還是同一棵樹。這時 subtrees 只是一個 **set**。
- 但學院也有編號（例如電機資訊學院是 90）。若學校要照編號處理文件，學院之間就有先後，subtrees 是一個 **sequence**，這種樹叫 **ordered tree（有序樹）**。

> **重點** 在 ordered tree 中，兩棵子樹對調就算不同的樹。

## Tree 的名詞

以下用這棵樹說明（13 個 node）：

```
                 A
         ┌───────┼───────┐
         B       C       D
       ┌─┴─┐     │     ┌─┼─┐
       E   F     G     H I J
     ┌─┴─┐             │
     K   L             M
```

（課本常用的版本沒有 M，共 12 個 node；以下若說「課本的樹」即指沒有 M 的版本。）

### Node、level、depth

- **node（節點）**：樹裡每一筆資料、每個放資料的位置。組織圖裡的台大、電資學院、資訊系都是 node。
- **root**：畫在最頂端的 node，這裡是 A。
- **level（層）**：用階層替 node 編號。**level 有兩種慣例：**

| 慣例 | root | B、C、D | E～J | K、L、M |
|---|---|---|---|---|
| root 為 level 0（像 C 語言從 0 數） | 0 | 1 | 2 | 3 |
| root 為 level 1（Horowitz 課本，考試用這個） | 1 | 2 | 3 | 4 |

level 也常叫 **depth（深度）**：root 最淺，越往下越深。

> **陷阱** 考試題目先看清楚 root 從 0 還是從 1 算。課本（考試）以 root 為 level 1。

### Leaf 與 internal node

從 root 一路長到末梢，長到不能再長的地方，就是完全沒有 subtree 的 node，叫 **leaf（樹葉）**；比較正式的叫法是 **external node**，因為它們在樹的最外圍。上圖的 leaf：K、L、F、G、M、I、J。

不是 root、又還沒長到末梢、像長在樹幹和枝枒上的 node，叫 **internal node**。所以 node 可分 root、leaf、internal 三種。

> **陷阱** 定義因書而異：多數課本（含 Horowitz）把「degree ≠ 0 的 node」都叫 nonterminal／internal，所以有小孩的 root 也算 internal。另外，在 extended binary tree 中 external node 指補上的空節點方塊，與 leaf 意義不同，注意題目語境。

> **陷阱** H 底下還掛著 M，所以 H 是 internal node，不是 leaf。**只要有小孩，就不是葉子。**

### 族譜關係：parent、child、sibling、ancestor、descendant

把樹想成族譜：root A 是大家的共同祖先，level 1、level 2…（以 root 為第 0 代時）就是第一代、第二代。

- **parent**：往上的那條連結。A 是 C 的 parent。
- **child**：反過來，C 是 A 的 child。B 直接往下連的 E、F 是 B 的 child。
- **sibling（兄弟姊妹）**：有**同一個 parent** 的 node。B、C、D 是 sibling（parent 都是 A）；E、F 是；K、L 也是（parent 都是 E）。
- **descendant（子孫）**：一個 node 底下的子子孫孫。B 的 descendants 是 E、F、K、L。
- **ancestor（祖先）**：往上的爸爸、阿公、阿祖一路到 root。M 的 ancestors 是 H、D、A。
- **path（路徑）**：從 root 一路走到某 node 經過的路線。到 K 的 path 是 A、B、E、K；路上經過的 A、B、E 就是 K 的 ancestors。

> **陷阱** K、L 是 E 的 child，對 B 而言是孫輩（descendant），**不是** B 的 child。parent／child 是相對關係：把 B 這塊 subtree 拉出來看，B 是它底下 node 的 parent，但 parent 不等於 root。

> **陷阱** sibling 的條件是同一個 parent。只是同一層、parent 不同（如 E 和 G）不算 sibling，硬要叫的話是堂兄弟（cousin）。

問：D 和 G 是什麼關係？
答：G 的 parent 是 C，C 和 D 都是 A 的小孩、互為 sibling，所以 D 是「G 的 parent 的 sibling」，可以叫 uncle（叔叔）。不過 uncle 不是課本正式術語，考試常考的還是 parent、child、sibling、ancestor、descendant。

樹的名詞混了兩套語言：園藝的 root、leaf，和家族的 parent、child、sibling、ancestor、descendant。

### Height

level 像「你是第幾代」；從樹的角度更在意它有多深、多高。**tree 的 height（高度，也叫 depth）就是最大的 level。** 上圖最深的 node 是 K、L、M：

- root 為 level 0：K、L、M 在 depth 3，**height = 3**。
- root 為 level 1（課本）：K、L、M 在 level 4，**height = 4**。

兩個都沒錯，差在 root 從 0 還是從 1 算。考試照課本。

### Degree

- **degree of a node**：這個 node 的小孩數，也就是它往外連出去的 pointer 數，等於遞迴定義裡它的 subtree 數。上圖 degree(A) = 3、degree(B) = 2、degree(C) = 1、degree(D) = 3，leaf 為 0。
- **degree of a tree**：所有 node 中最大的 degree（全家最會生的那個有幾個小孩）。上圖 tree 的 degree = 3。

> **陷阱** C 身上有兩條線：一條是 A 連下來的，一條連到 G。degree(C) 是 2 嗎？**不是**。在 tree 裡，別人指到它的那條不算，只算它自己 point out 出去的，所以 degree(C) = 1。之後學 graph 會再分 in-degree 和 out-degree；tree 其實是一種特殊的 graph。

## Tree 的表示法

抽象的樹講完，接著是 represent：寫程式時怎麼把一棵樹存進記憶體？array 用連續的記憶體，linked list 用小紙條（指標）。回到定義「tree = root + 一堆 subtree」：把這些 subtree 裝進一個 **container**（裝資料的容器，像保鮮盒、碗）。root 存自己的資料，旁邊附一張小紙片寫著去哪裡找那個 container，這條往下的連結叫 **child link**。

很多應用也要反過來從小孩找回家長，例如從資訊系找回它屬於哪個學院。常見做法是讓每棵 subtree 都有一條 link 指回它的 root，往上找家長的連結叫 **parent link**。

### 做法一：每個 node 開 k 個 pointer（k-ary tree）

最直覺的做法：讓 root 開很多條 link，每條各指一個小孩。若 tree 的 degree 是 k，叫 **k-ary tree**（每個 node 最多指到 k 個 node）。為了讓每個 node 長一樣，每個 node 都是一格 data 加上 k 格 pointer，不管實際有幾個小孩都先開好：

```
| data | child1 | child2 | ... | childk |
```

問：n 個 node 的 k-ary tree，pointer 浪費多少？
答：

1. 總共開了 n × k 個 pointer。
2. 真正用到的：root 沒人指到，其他每個 node 都剛好被一個 pointer 指到，所以用了 n − 1 個。
3. 浪費（null）的：nk − (n − 1) = **n(k − 1) + 1** 個。

> **例題** 課本的樹 n = 12、k = 3：開了 36 個 pointer，只用 11 個，null 有 36 − 11 = 25 個。

k 越大浪費越多；k = 2（binary tree）時 null link 有 n + 1 個。不過之後會學的 B-tree、B+ tree 也是 k-ary tree，實務上 k 不會大得誇張，要看資料型態決定。

### 做法二：用 vector 當 container

vector 可以用 index 直接拿到任何一格。設 root 有三個小孩 T1、T2、T3（嚴格說是它們的 root）各佔 vector 的一格，root 和這個 vector 用一條 child link 連起來。T1 有兩個小孩，也放進一個 vector，T1 用一條 link 找到它；T3 有三個小孩亦同。T2 沒有小孩，可以放一個空 array，或直接用 null pointer。

```
root ──► [ T1 | T2 | T3 ]
           │    │     │
           │   NULL   └──► [ c1 | c2 | c3 ]
           └──► [ a1 | a2 ]
```

再加上每個小孩指回 parent 的虛線，就很像 doubly linked list：爸爸找得到小孩，小孩也找得到爸爸。

### 做法三：用 linked list 當 container

T1、T2、T3 串成一條 list，最後指到 null；root 只要一條 link 找到 list 的第一個（T1）。T1 的兩個小孩也是一條 list；T3 有三個 node 的 list；T2 沒小孩，child link 直接指 null。

```
root
  │
  ▼
  T1 ──────► T2 ──────► T3 ──► NULL
  │          │          │
  ▼          ▼          ▼
  a1 ─► a2   NULL       c1 ─► c2 ─► c3
```

比較：vector 版在記憶體裡是相對連續的一塊；linked list 版用比較多小紙條連來連去。

> **重點** 這些小紙條只有兩種：**橫的**指向同一層的兄弟姊妹（sibling），**往下的**指向自己的（第一個）小孩（child）。所以每個 node 最多兩張小紙條（例如 T1 往下指小孩、往右指 T2），也可能一張（T2 只有兄弟）或零張，**不會有三張**。

### 做法四：括號（list）表示法

用括號代表「誰是誰的小孩」：K、L 的共同 parent 是 E，寫成 E(K,L)；再往外，E、F 的 parent 是 B，寫成 B(E(K,L),F)。課本的樹整棵寫成：

```
A( B( E(K,L), F ), C(G), D(H,I,J) )
```

照括號畫成 linked list：A 後面接三個指標，每個指向一條子 list；B 那條 list 又分兩支，一支指向 E，E 後面再接 K、L。A 的三個分支，各是一條 linked list。

```
A ─► [•] ─────────────► [•] ───────► [•]
      │                  │            │
      ▼                  ▼            ▼
      B ─► [•] ─► F      C ─► G       D ─► H ─► I ─► J
            │
            ▼
            E ─► K ─► L
```

> **觀念** 不要以為樹只能畫成樹的樣子。tree 是比較高層的概念，怎麼 implement 是另一回事。

### 做法五：Left-Child Right-Sibling（LCRS）

既然每個 node 只有兩種小紙條，就換一種畫法：

- 原本往下的 **child** 連結改成往**左下**畫，指到第一個（最左邊的）小孩。
- 原本橫的 **sibling** 連結改成往**右下**畫，指到下一個兄弟。

以 root 有 T1、T2、T3 為例：root 左下接 T1；T1 左下接它的第一個小孩 a1，a1 右下接 a2；T1 右下接 T2；T2 沒小孩、左下空著，右下接 T3；T3 沒有下一個兄弟，但左下接 c1，再一路往右下接 c2、c3。

```
        root
        /
      T1
     /  \
   a1    T2
     \     \
      a2    T3
            /
          c1
            \
             c2
               \
                c3
```

重畫之後，root 只剩一個小孩 T1，而 T1 底下兩棵 subtree：左邊是它的小孩，右邊是它原本的兄弟。每個 node 最多兩條連線，而且它仍然是一棵樹，可以一路遞迴拆下去。

> **例題** 把課本的樹 A( B( E(K,L), F ), C(G), D(H,I,J) ) 轉成 LCRS。

每個 node 只有三個欄位：

```
| data | left child | right sibling |
```

- A 的 left child 指 B；A 是 root，沒有 sibling，right sibling 是 null。
- B 的 left child 指 E；right sibling 指 C，C 再指 D，兄弟串成一串。
- C 只有一個小孩，left child 指 G。
- 其餘照樣：E 的 left child 指 K，K 的 right sibling 指 L；E 的 right sibling 指 F；D 的 left child 指 H，H 指 I，I 指 J。

把 right sibling 當成 right child（整張圖順時針轉 45 度），得到一棵 binary tree：

```
            A
           /
          B
        /   \
       E     C
      / \   / \
     K   F G   D
      \       /
       L     H
              \
               I
                \
                 J
```

只要 data、left child、right sibling 三格，就避開了 k-ary 大量浪費 pointer 的問題。

> **重點** LCRS：左連結 = 原樹的 child 關係，右連結 = 原樹的 sibling 關係。它能表示任何一棵 **ordered tree**（T1、T2、T3 要有先後，才知道誰接誰；轉換只對 ordered tree 唯一）。因為原 root 沒有兄弟，**轉出來的 binary tree，root 的右子樹一定是空的**。所以任何 general tree 都能當 binary tree 來存。

> **陷阱** 程式裡（記憶體中）的長相，跟這棵 tree 本來的長相要分清楚。例如一般 tree「A 底下 B」或「A 底下 B、C」，用 LCRS 存進記憶體後長得不一樣，不要混在一起。

### 表示法小結

tree 看起來像族譜，但表示法有好幾種：括號的 linked list、LCRS，還有最直覺也最浪費的「degree 多少就開多少個 child 欄位」。k-ary tree 中 k = 2，就是 binary tree。

問：存 tree 的那些 vector，要不要全部塞在一起？
答：這是實作上的選擇。可以把所有 node 塞進一個大 vector，再用 link 在格子間跳；存取和配置都方便。但塞得太緊，就像把 linked list 全塞進 vector：失去插入的彈性。例如 T1 多生一個小孩，就得像 vector 插入一樣把後面的東西通通擠開。這是 trade-off：一個大 vector 存取方便，但 insertion、removal 綁手綁腳。

## Binary tree（二元樹）

### 定義

每個 node 最多兩個小孩，也就是 degree 最多 2 的樹，叫 **binary tree**。一般的樹想生幾個都可以，binary tree 限制最多兩個（戲稱「二胎化」）。而且左小孩和右小孩意思不同，畫在左、畫在右有差別。

> **重點** 課本定義：binary tree 是 a **finite set** of nodes。既然是集合，就可以是空集合，所以**沒有任何 node 的 empty binary tree 是合法的**。不是空的話，就有一個 root，底下分出兩棵互斥的 left subtree 和 right subtree（它們本身也是 binary tree，可以為空）。

| | 一般 tree | binary tree |
|---|---|---|
| 能不能是空的 | 不行（至少一個 node） | 可以 |
| 子樹有沒有左右／順序之分 | 不管順序 | 左右有別 |
| degree 上限 | 沒有上限 | ≤ 2 |

所以「A 只有左孩子 B」跟「A 只有右孩子 B」是**兩棵不同的 binary tree**，但當成一般 tree 看是同一棵。

```
    A          A
   /            \
  B              B
（兩棵不同的 binary tree）
```

> **觀念** binary tree 和 binary search tree 只差一個 search，差在哪？先自己想，後面介紹 BST 時揭曉。

### NULL link

長到尾巴、不再往下長的地方，其實都有一張指向空的小紙條，也就是 **NULL link**。它沒有存任何資料，以後畫圖都不畫，需要時自己腦補。可以這樣想 binary tree：**每個 node 都有左右兩個連結位置，只是某一邊可能是空的。**

> **陷阱** 把空紙條算進來，每個 node 都有兩個「連結位置」，但這不代表 degree 是 2。課本的 degree 只算非空的 subtree，leaf 的 degree 仍是 0。

問：binary tree 會有只有一個小孩的 node 嗎？
答：會。例如一般樹轉 LCRS 後的 root：原 root 沒有 sibling，所以只剩左小孩。

### 幾種長相：skewed 與 complete

```
skewed（左歪斜）   skewed（右歪斜）     complete
      A               A                    A
     /                 \                 /   \
    B                   B               B     C
   /                     \             / \   / \
  C                       C           D   E F   G
 /                         \         / \
D                           D       H   I
```

- **skewed binary tree（歪斜樹）**：全部歪向同一邊，每個 node 只有一個孩子，看起來根本就是一條 linked list。
- **complete binary tree（完全二元樹）**：排得整整齊齊的那種。精確定義見後面，不是「很平衡」就算。

### 用遞迴建一棵 binary tree

想法：拿第一筆資料 data[0] 當 root，剩下的資料分到各個 subtree，各自遞迴建好再接上。

```
ConstructTree(data):
    if data is empty:
        return NULL                       // termination condition
    else:
        create root node from data[0]
        partition data[1..] into n sets   // binary tree: n = 2
        for i = 1..n:
            T_i = ConstructTree(set_i)    // 同一個函式一再呼叫：recursion
            link root to T_i
        return address of root node       // 代表整棵樹
```

分割的規則可以自己定（奇數一邊、偶數一邊也行）。最簡單的規則：比 data[0] 小的去左邊、大的去右邊。

> **例題** 用資料 5、3、8、1、4 建樹（小的放左、大的放右）。

1. root = 5；剩下 {3, 8, 1, 4}，比 5 小的 {3, 1, 4} 去左、比 5 大的 {8} 去右。
2. 左邊 ConstructTree({3,1,4})：root = 3；{1} 去左、{4} 去右。
3. ConstructTree({1})：root = 1，左右都是空集合，各自 return NULL。{4}、{8} 同理。
4. 一路把 root 和回傳的 subtree 連起來：

```
      5
     / \
    3   8
   / \
  1   4
```

沒有資料的位置拿到的都是 NULL，遞迴就在這些地方停下來。「小的放左、大的放右」正是之後 binary search tree（BST）插入的雛形。

> **陷阱** 只寫 else 那段（遞迴式）是常見錯誤：資料都分完了還一直往下呼叫。上面 if 那行的終止條件「data 為空就 return NULL」缺一不可。

## Binary tree 的 node 數與高度

先說清楚：**以下兩套公式描述同一件事，差別只在 root 的 level 從 1 還是從 0 算。**

| | root 為 level 1（課本，深度記 k） | root 為 level 0（高度記 h） |
|---|---|---|
| 第 i 層最多幾個 node | 2^(i−1) | 2^i |
| 整棵最多幾個 node | 2^k − 1 | 2^(h+1) − 1 |
| 整棵最少幾個 node | k | h + 1 |
| 只有 root 的樹 | 深度 1 | 高度 0 |

（同一棵樹 k = h + 1，代進去兩邊完全一致。）

### 課本版（root 為 level 1）

**Lemma**：第 i 層最多 2^(i−1) 個 node；深度 k 的 binary tree 最多 2^k − 1 個 node。

推導：
- 第 1 層只有 root：2^(1−1) = 2⁰ = 1。
- 第 2 層：root 最多兩個孩子，最多 2 個。
- 第 3 層：每個人又能生兩個，最多 4 個。每往下一層就乘 2，所以第 i 層最多 2^(i−1) 個。
- 整棵最多 = 每層最大值相加 = ∑(i=1..k) 2^(i−1) = 1 + 2 + 4 + … + 2^(k−1) = 2^k − 1（等比級數）。

> **例題** k = 4：最多 1 + 2 + 4 + 8 = 2⁴ − 1 = 15 個 node。

### 高度版（root 為 level 0）

問：要塞 10 萬筆資料，樹最矮能多矮、最高能多高？先看小的例子。（node 才是真正裝資料的地方；binary tree 每個 node 最多兩個真的小孩，也可能只有一個，另一個是 NULL。）

- **h = 0**：只有 root 孤單一人，最少、最多都是 1 個。
- **h = 1**：root 至少要生一個小孩才長得出高度，最少 2 個；生兩個就是 3 個。**2 ≤ n ≤ 3**。
- **h = 2**：最多是每個人都生兩個，1 + 2 + 4 = 7 個。最少是「代代單傳」，每一代只生一個，共 3 個。**3 ≤ n ≤ 7**。

```
h = 2 最多（7 個）        h = 2 最少（3 個，以下都算單傳）
        o                  o      o        o      o
      /   \               /      /          \      \
     o     o             o      o            o      o
    / \   / \           /        \          /        \
   o   o o   o         o          o        o          o
```

因為 binary tree 左右有差，有人生左小孩、有人生右小孩，這些都算單傳，都是最少的情況。只往一個方向偏著長的就是 **skewed tree**：一點也不像樹，根本是 linked list，是一棵**退化**的樹。linked list 的限制和缺點它全都有，所以我們不喜歡這種歪歪的樹。

**一般高度 h：**

- 最少：每一代至少一個人，第 0 代到第 h 代，共 **h + 1** 個。
- 最多：每層 1、2、4、8…，第 i 層 2^i 個。用二進位看這個加法：2^i 剛好是二進位第 i 位，每層都滿就是第 0 位到第 h 位全是 1。一串 1 再加 1 會一路進位，例如 `1111 + 1 = 10000 = 2⁴`，所以 h + 1 個 1 等於 **2^(h+1) − 1**。

> **例題** 連續 8 個 1：`11111111₂ = 2⁸ − 1 = 255`（不是 2⁹ − 1）。

> **重點** 高度 h 的 binary tree：**h + 1 ≤ n ≤ 2^(h+1) − 1**（root 為 level 0）。

反過來，給 n 個 node，高度會落在哪？
- 最高：**n − 1**，就是代代單傳的歪斜樹。
- 最矮：**⌈lg(n+1)⌉ − 1**（lg 是以 2 為底的 log），大約 lg n。

換成課本慣例：n 個 node 的 complete binary tree，深度為 **⌈log₂(n+1)⌉**。

問：五層的樹，高度是 5 還是 4？
答：不同的書說法不一樣，沒有完全公定的定義。若 root 是第 0 層，往下第 1、2、3、4 層，最深那層的編號就是高度，所以是 4；考試用的 Horowitz 課本 root 是 level 1，同一棵樹 depth 是 5。寫題目前先確認它用哪一種定義。課本版 2^k − 1 和 2^(h+1) − 1 其實是同一件事。

### 為什麼在意樹高

tree 是階層式的存取，常常從 root 出發一路往下找。若每層只看一次、決定往左還往右，最多只要找「樹的層數」那麼多次（h + 1 次，h 以 root 為 0 計），成本跟 h 綁在一起。這和分析 sequential search、binary search 一樣，數拜訪了幾個 node。

> **例題** 兩棵都是 7 個 node 的 binary tree，找 7：

```
矮的（h = 2）                 歪斜的（h = 6）
        4                     1
      /   \                    \
     2     6                    2
    / \   / \                    \
   1   3 5   7                    3
                                   \
                                    4
                                     \
                                      5
                                       \
                                        6
                                         \
                                          7
```

- 矮的：4 → 6 → 7，比 3 次。
- 歪斜的：1 → 2 → … → 7，要走 7 次，一路走到底。

兩個極端：
- **best case**：樹很矮，高度接近 log n，只要約 log n 次。就像 binary search 在排好序的 array 上，每比一次丟掉一半候選，所以約比 log n 次。
- **worst case**：像 linked list 的歪斜樹，高度 n − 1，要花 linear 的力氣，跟在 linked list 上做 sequential search 差不多。

> **重點** 設計 tree 的資料結構和演算法，都要努力把高度壓低。同一層多塞一點、矮胖的樹對我們有利；瘦高的樹不好。花力氣設計了更複雜的結構，若要退化，不如乖乖回去用 linked list。

## 性質：n₀ = n₂ + 1

**Lemma**：對任何一棵**非空**的 binary tree，設
- n₀ = degree 0 的 node 數（leaf），
- n₁ = degree 1 的 node 數，
- n₂ = degree 2 的 node 數，

則 **n₀ = n₂ + 1**，跟 n₁ 一點關係都沒有。

> **例題** 驗證這棵樹：

```
      A
     / \
    B   C
   / \   \
  D   E   F
```

leaf 是 D、E、F，n₀ = 3；有兩個孩子的是 A、B，n₂ = 2；只有一個孩子的是 C，n₁ = 1。3 = 2 + 1 成立。（degree 0 的 node 一定在最下面，因為它不再往外指。）

### 證明：從兩個方向數 pointer

設 n = node 總數，B = branch（往下連的 pointer）數。上例 n = 6，有 5 條線，B = 5。

1. 每個 node 的 degree 只能是 0、1、2，所以 **n = n₀ + n₁ + n₂**。（注意沒有 2n₂。）
2. 從「被指到」的角度數：除了 root 沒人指到，其他每個 node 都剛好被一條線指到，所以 B = n − 1，即 **n = B + 1**。
3. 從「指出去」的角度數：degree 1 的各指出 1 條，共 n₁ 條；degree 2 的各指出 2 條，共 2n₂ 條。所以 **B = n₁ + 2n₂**。
4. 把 3 代進 2：n = n₁ + 2n₂ + 1。
5. 把 1 代進左邊：n₀ + n₁ + n₂ = n₁ + 2n₂ + 1。
6. 兩邊消掉 n₁ 和一個 n₂：**n₀ = n₂ + 1**。∎

證明只是幾個式子互相代換，不需要微積分。（數學在資工到處都用得到，往後的 data mining 也常用到 SVD 這類線性代數工具。）

> **重點** 常見考法：給 leaf 數，問 degree 2 的 node 有幾個，直接減 1；或給 degree 2 的個數，leaf 就是加 1。

## Full binary tree 與 complete binary tree

full 和 complete 是**不一樣**的兩個名詞。

### Full binary tree（完滿二元樹）

> **重點** 深度為 k（root 為 level 1）的 **full binary tree** 擁有 **2^k − 1** 個 node，也就是這個深度允許的最大值，每個位置都被佔滿。以 root 為 level 0 的高度 h 表示，就是 2^(h+1) − 1 個 node（每層都塞滿）。

例：level 1 到 level 4 全滿，2⁴ − 1 = 15 個 node。

> **陷阱** 有些英文教材把 full binary tree 定義成「每個 node 有 0 或 2 個孩子」，和課本（Horowitz）的定義不同，注意題目語境。

### 層序編號與 path code

把 full binary tree 的 node 編號：由上到下分層、同一層由左到右（level order），1、2、3、…。再把編號寫成二進位：

```
                 1 (1)
              /        \
          2 (10)        3 (11)
          /    \        /    \
     4 (100) 5 (101) 6 (110) 7 (111)
```

規律跟路徑有關：在每條**往左**的 link 上寫 **0**，每條**往右**的 link 上寫 **1**。

- 從 1 號往左走，就像在 1 後面接 0，得到 10，是 2 號；再往左接 0，得到 100，是 4 號。
- 3 號是 11，往左接 0 變 110，是 6 號。
- 從 1 一路往右：11 是 3，111 是 7。

> **重點** **node 編號 = 先放一個 1，後面接上從 root 走下來的 0／1 路徑**，這串叫 **path code**。

二進位後面接一個 0，就是左移一位，也就是 **×2**（110 = 6，接 0 變 1100 = 12）；接 1 就是左移再加 1，**×2 + 1**。所以 2、3 是 1 的 ×2 和 ×2+1；4、5 是 2 的。小孩的編號都能從爸爸算出來。

### Complete binary tree（完全二元樹）

```
              A1
           /      \
         B2        C3
        /  \      /  \
      D4    E5  F6    G7
     /  \
   H8    I9          （10～15 號位置是空的）
```

這棵只有 A 到 I 九個 node，沒有全滿，後面 10 到 15 號位置是空的。除了最後空掉的部分，其他位置都跟 full tree 一模一樣，這叫 complete binary tree。

> **重點** 深度 k、有 n 個 node 的 binary tree，若它的 node 剛好對應到同深度 full binary tree 的編號 **1 到 n**（中間沒有空缺），就是 **complete binary tree**。full 是每個位置都佔滿；complete 是前面排滿，後面可以剩一些空位。full 一定是 complete，反之不然。

> **例題** 把上圖的 H、I 移到 G 底下，還是 complete 嗎？

不是。G 是 7 號，它的小孩在 14、15 號，所以 H、I 變成 14、15 號，中間 8 到 13 號是空的，**有洞就不算 complete**。

```
              A1
           /      \
         B2        C3
        /  \      /  \
      D4    E5  F6    G7
                     /  \
                  H14    I15     （8～13 空著 → 不是 complete）
```

> **陷阱** complete 不是「看起來很平衡」就算，要檢查編號 1..n 有沒有洞。

## Binary tree 的 array 表示法

為什麼要編號？因為學過的資料結構裡，最喜歡用編號的是 vector（array）：可以用 index 直接存取。array 能存 tree，是因為每個 node 都有固定該放的位置。照 level order 編號，編號幾號就放第幾格，**第 0 格不用**。

```
index:  0   1   2   3   4   5   6   7   8   9
      | - | A | B | C | D | E | F | G | H | I |
```

> **重點** （1-based）位置 i 的 node：
> - left child 在 **2i**
> - right child 在 **2i + 1**
> - parent 在 **⌊i/2⌋**（i = 1 是 root，沒有 parent）

驗證：
- A 在 1，left child B 在 2、right child C 在 3。
- B 在 2，left child 在 4 是 D，right child 在 5 是 E。
- D 在 4，4/2 = 2，parent 是 B；E 在 5，5/2 = 2.5 無條件捨去得 2（整數除法），parent 也是 B。

> **陷阱** right child 是 2i + 1，不是 2i − 1；找 parent 是**除以 2 取整數**，不是乘以 2。

> **陷阱** 上面是 1-based。若 array 從 0 開始：left = **2i + 1**、right = **2i + 2**、parent = **⌊(i − 1)/2⌋**。

好處：
- 根本不用存連線的小紙條，要找誰算一下編號就好，省下一大塊空間。
- ×2、×2+1 就是左移一位（再加 1），非常快，往往比沿著指標在記憶體裡跳還快。

### 不是 full 的樹：留空格

每棵 binary tree 都能看成「full binary tree 砍掉一些 node 的殘缺版」，砍掉的位置在 array 裡留空格（像櫃子有幾格沒用），這樣任何 binary tree 都能不用 link 存起來。代價是空間：

- 樹越接近 full，越不浪費：7 個 node 的 full tree 剛好 7 格。
- 四層的樹只裝 10 個 node，仍要 1 + 2 + 4 + 8 = 15 格。
- 五層的樹也只裝 10 個，卻要 31 格，白白空了 21 格。樹越空，浪費越多。
- **complete binary tree** 剛好對應一個 size n 的 array（編號 1..n），一格都不浪費，連接關係還是 ×2、×2+1。full binary tree 和 complete binary tree 是 array 表示法最喜歡的情況。

> **例題** 左歪斜樹 A、B、C、D、E（深度 5）放進 array：

1. A 放 1。
2. B 是 A 的左孩子：2 × 1 = 2。
3. C 是 B 的左孩子：2 × 2 = 4。
4. D 是 C 的左孩子：2 × 4 = 8。
5. E 是 D 的左孩子：2 × 8 = 16。

```
index: 1   2   3   4   5   6   7   8   9  ...  15  16
     | A | B | - | C | - | - | - | D | - | ... | - | E |
```

5 個 node 要開到 16 格（= 2^(5−1)），中間一堆空著。若是往右歪，深度 5 要開到 2⁵ − 1 = 31 格，卻只用 5 格。

> **重點** array 表示法：優點是找 parent、child 只要乘除，一步就到；缺點是樹不夠 complete 就浪費一大堆空間。

## Binary tree 的 linked 表示法

不想浪費空間，就改用 node：每個 node 三個欄位，data 加上指向左、右孩子的 pointer。

```
| leftChild | data | rightChild |
```

```cpp
class Tree;

class TreeNode {
    friend class Tree;
private:
    TreeNode *leftChild;
    char data;
    TreeNode *rightChild;
};

class Tree {
public:
    // tree operations ...
private:
    TreeNode *root;   // 指向最上面的 TreeNode
};
```

Tree 這個 class 只有一個 pointer 叫 root，指向最上面那個 TreeNode；有了 root，就能從它開始 traverse 整棵樹。

### 找 child 容易、找 parent 難

以前面 A～I 的 complete tree 為例：

- 問 D 的 child：找到 D，直接看它的左右 pointer，H 和 I 就是孩子。
- 問 D 的 parent：node 裡只有往下指的 pointer，沒有往上的，只好從 root 開始往下找到 D（A → B → D）。技巧是用兩個 pointer：一個往下走，另一個跟在它上一層；找到 D 時，後面那個指的 B 就是 parent。

> **重點** linked binary tree 找 parent 比找 child 難。如果常常要找 parent，就在 node 多加一個 parent 欄位（代價是多一個欄位）。

full binary tree 用 node 存，pointer 大多用得到；skewed tree 用 node 存，就是一條 linked list。

### Array vs linked 怎麼選

| | array | linked |
|---|---|---|
| 找 parent | 簡單，算 ⌊i/2⌋ | 不簡單，要從 root 往下找 |
| space overhead | 要先宣告整塊，樹不 complete 時浪費 | 用多少 create 多少 |
| insert／delete | 困難：牽涉資料移動，插一個後面整串要搬 | 簡單：改幾個 pointer（pointer assignment） |

沒有絕對的好壞，看需求：建好之後不再 insert、delete，用 array；常常要 insert、delete，就不該用 array。

### 實務經驗：node 四散 vs 壓進 vector

一個 MPEG-2 decoder（DVD 用的影像格式）的期末作業：影像部分大致等於每秒做 30 次 JPEG 解碼，做不到播放就會卡。解碼要一直在 Huffman tree 上從 root 走到 leaf。若 node 四散在記憶體各處、用指標連起來，就用不到 cache，像一直要跑去很遠的倉庫搬東西，速度不夠：別人一秒解 30 張，自己一秒解 1 張，播放嚴重延遲。

解法就是前面的做法：把 full binary tree 壓進 vector，讓 node 在記憶體裡靠在一起，而且找小孩只要 ×2、×2+1 這種簡單計算。full binary tree、vector、path code 這組關係，之後學 Huffman tree 或 JPEG 時用得到。

## 網站與 HTML：tree 還是 graph？

問：網站的架構是 tree 嗎？
答：分幾個角度看。

- 若網站的檔案放在 directory 裡，這個目錄結構可以看成 **tree structure**。
- 但網頁之間是用 hyperlink 連的。「我連到你」不代表「我是你爸爸」，沒有上下關係；超連結可以互連、繞一圈，比 tree 更複雜，屬於 **graph structure**。
- 網頁本身是 **HTML**（HyperText Markup Language；ML 是 markup language，不是 machine learning）寫的。HTML 用文字標記出結構，是一種結構化的文字。例如外面一個連結標記 `a`，裡面包一張圖片 `img`：把每個標記想成一棵 subtree，`a` 是 root，`img` 是它的小孩。一層一層撥下去，整個網頁就是一棵 tree，叫 **parse tree**，和下面的 expression tree 一樣都在描述文法結構。

```
      a
      |
     img
```

## Expression tree（運算式樹）

把 tree 和「用 stack 解析算式」連起來的，就是 **expression tree**：

- root 和 internal node 放 **operator（運算子）**：×、+、−。
- leaf 放 **operand（運算元）**：要算的數字。

```
            ×
         /     \
        +       −
       / \     / \
      3   5   2   +
                 / \
                7   4
```

這裡全是 binary 運算子，每個吃兩個數，所以是一棵 binary tree。若有 unary 運算子（例如負號），那個 node 就只有一個小孩；若有多參數的 function call，像 f(a, b, c)，就有三個小孩，可能變成 general tree。

### 求值：先算左右 subtree，再做 root

> **例題** 求上圖的值。

1. 左 subtree：3 + 5 = 8。
2. 右 subtree 也遞迴做：左邊 2 是 leaf，就是 2；右邊 7 + 4 = 11；做減法 2 − 11 = −9。
3. root：8 × (−9) = **−72**。

### Subtree 就是括號：把樹寫回算式

這棵樹藏著「什麼先算、什麼後算」：subtree 裡的先算，算完才輪到 root。

> **陷阱** 若只照左右位置讀，會得到 `3 + 5 × 2 − 7 + 4`，意思整個錯了，需要括號。

規則：**每棵 subtree 加括號，root 的運算子放中間，遞迴做下去；leaf 不用加括號。**

1. 左 subtree 先算：(3 + 5)。
2. 右 subtree 是「2 減某棵 subtree」，那棵是 7 + 4，也要加括號：2 − (7 + 4)。
3. 右邊整個再包一層，乘號放中間：

```
(3 + 5) × (2 − (7 + 4))
```

（2 照理也是一棵 subtree，但它是 leaf，就不用加括號。）

> **重點** internal node 放 operator，external node 放 operand，**subtree 代表 parentheses**。這個「左、中、右」的讀法就是後面的 **inorder** traversal（加完整括號）；「先算左右、再算 root」的順序就是 **postorder**，得到 postfix：`3 5 + 2 7 4 + − ×`。

## 二元樹走訪（Binary Tree Traversal）

### 為什麼需要走訪
走訪（traversal）就是把 tree 裡的每個 node 都拜訪**剛好一次**，拜訪時順便做一件事（最常見的是把資料印出來）。

問：給兩棵 binary tree T1、T2，怎麼判斷它們一不一樣？人眼一看就知道，但要讓電腦也能判斷，有兩種想法：

1. 兩個 pointer 從兩棵樹的 root 一起往下，一個 node 一個 node 比，比到不同就停。
2. 用 traversal 把 tree 變成一個字串（string），再比兩個字串。

> **陷阱** 只比「一種」走訪字串不夠。下面兩棵樹的 preorder 都是 `A B D C`，但 inorder 不同，形狀其實不一樣。要嘛加上 null 標記，要嘛用 inorder 搭配 preorder／postorder 一起比。

```
   T1:    A             T2:    A
         / \                  / \
        B   C                B   C
       /                      \
      D                        D

 preorder : A B D C          A B D C   （相同）
 inorder  : D B A C          B D A C   （不同）
```

走訪的意義不只是「考試會考」，它是讓我們快速掌握一棵 tree 結構（structure）的工具：比較、複製、求值都建立在走訪上。

### L、V、R：三個動作排出三種走訪
Node 只有 `leftChild`、`data`、`rightChild` 三個欄位，所以走訪時能做的動作也只有三種：

- **L**：看到一個 node 先不印，先往它的**左**子樹走。
- **V**（visit）：把這個 node 的資料印出來。
- **R**：不往左也不印，往**右**子樹走。

三個動作排順序有 3! = 6 種，其中三種只是把左右對調。規定「先左後右」之後只剩三種：

| 順序 | 名稱 | 中文 |
|---|---|---|
| VLR | preorder | 前序 |
| LVR | inorder | 中序 |
| LRV | postorder | 後序 |

> **重點** 名字只在講一件事：**root（V）什麼時候印**。V 在最前面叫 pre，在中間叫 in，在最後叫 post；而且左邊永遠排在右邊前面。

- Inorder = 左 → root → 右：左邊整塊先處理完，才輪到 root，最後才是右邊；root 夾在中間（in = 中間）。
- Preorder = root → 左 → 右：root 一走到就先印（pre = 前）。
- Postorder = 左 → 右 → root：左右都做完，root 最後才印（post = 後）。

最小的例子：root A，左小孩 B，右小孩 C（3 個 node、高度 1）。

```
    A
   / \
  B   C

preorder : A B C
inorder  : B A C
postorder: B C A
```

## 手算三種走訪

用同一棵樹練習：A 的左小孩 B，B 只有右小孩 D；A 的右小孩 C，C 的左小孩 E、右小孩 F；E 只有左小孩 G；F 有 H、I 兩個小孩。

```
          A
        /   \
       B     C
        \   / \
         D E   F
          /   / \
         G   H   I
```

> **重點** 每到一個 node 先問：「它是不是某棵 subtree 的 root？」是的話就套用同一條規則再做一次（這就是遞迴的感覺）；在 inorder／postorder 裡，它還不能馬上印。

### Inorder：B D A G E C H F I
1. 到 A：inorder 要先做完 A 的整個左子樹，所以還不能印 A。
2. 往左到 B。B 下面還有小孩，B 自己也是一棵 subtree 的 root，再套一次規則：先看 B 的左邊。
3. B 的左邊是 null，代表左邊做完了 → 印 **B**。
4. B 的右邊是 D，D 沒有小孩 → 印 **D**。
5. 退回 A：左子樹 B、D 都處理好了 → 印 **A**。
6. 右半部從 C 開始。C 是 root，先往左到 E；E 是 G 的 root，再往左到 G。
7. G 左邊是空的 → 印 **G**；退回 E，E 的左邊做完 → 印 **E**。
8. E 右邊沒東西，退回 C，C 的左半部完成 → 印 **C**。
9. C 的右邊 F 有兩個小孩，先到左邊 H → 印 **H**；回到 F → 印 **F**；最後右邊 → 印 **I**。

結果：`B D A G E C H F I`。檢查：A 左子樹的 node（B、D）都在 A 前面，右子樹的都在 A 後面。

### Preorder：A B D C E G F H I
1. A 一到就印 **A**。
2. 往左到 B，B 是它那棵小樹的 root，馬上印 **B**。
3. B 的左邊是空的，看右邊：D 一到就印 **D**。
4. D 沒小孩，退回 A，A 的左半部完成，換右半部。
5. C 是右子樹的 root → 印 **C**；往左印 **E**，再往左印 **G**。
6. C 的左半部做完，去右邊的 F：F 是 root，先印 **F**；再先左印 **H**，最後印 **I**。

結果：`A B D C E G F H I`。觀察：每棵小樹的 root 都排在它自己的小孩前面。

### Postorder：D B G E H I F C A
1. 從 A 開始，但 A 要最後印，先往左。到 B，B 下面有 D，所以 B 也要等。
2. B 左邊空的，右邊是 D，D 沒小孩 → 印 **D**；B 的左右都完成 → 印 **B**。
3. 退回 A：左半部印完，但右半部還沒做，A 還不能印。
4. 到 C，C 也要最後印；往左到 E，E 是 G 的 root，還不能印。
5. G 左右都是空的 → 印 **G**；退回 E，E 右邊沒東西 → 印 **E**。
6. 回到 C，右半部還沒做；去 F，F 也要最後印。先印 **H**，再印 **I**，F 左右都完成 → 印 **F**。
7. 退回 C，左右都印好 → 印 **C**；最後退回 A → 印 **A**。

結果：`D B G E H I F C A`。

> **重點** 寫完三種走訪先做兩個檢查：**preorder 第一個一定是 root，postorder 最後一個一定是 root**。

## 畫線法：一眼讀出三種走訪

每次都在腦中跑遞迴很累，有一個快速的「畫線法」。例子：root 3，左小孩 6（底下 5、2），右小孩 4（底下 9、8）。

```
          3
        /   \
       6     4
      / \   / \
     5   2 9   8
   ─────────────────  ← 第一步：在整棵樹最下面畫一條水平底線
```

第二步：從每個 node 的某個位置往下拉一條線接到底線，**線不能交叉**（交叉了順序就會讀錯）。第三步：由左往右讀底線上的落點。

| 從 node 的哪裡拉線 | 由左往右讀出 | 走訪 |
|---|---|---|
| 左邊 | 3 6 5 2 4 9 8 | preorder |
| 正下方（中間） | 5 6 2 3 9 4 8 | inorder |
| 右邊 | 5 2 6 9 8 4 3 | postorder |

Inorder 的拉線最好想像：把每個 node 垂直投影到底線上，左子樹的 node 都在它左邊，右子樹的都在右邊。

```
          3
        /   \
       6     4
      / \   / \
     5   2 9   8
     |   | |   |      （3、6、4 也各自從正下方垂直落下）
   ──5─6─2─3─9─4─8──  → inorder：5 6 2 3 9 4 8
```

> **觀念** 為什麼有效？想像沿著樹的外圍逆時針繞一圈（Euler tour），每個 node 會被經過三次：在它**左邊**經過時記下來就是 preorder（root 先），在它**下方**經過時記下來就是 inorder（左、root、右），在它**右邊**、最後一次經過時記下來就是 postorder（root 最後，所以 3 排在最後）。左、中、右三個位置對應 pre、in、post。

## 運算式樹的四種走訪

Stack 章節的運算式 `A / B * C * D + E` 可以畫成一棵運算式樹（expression tree）：operator 在內部 node，operand（A、B…）在 leaf。leaf 底下的 null 指標欄位其實還在，只是指不下去。

```
               [+]
              /   \
           [*]     [E]
          /   \
       [*]     [D]
      /   \
   [/]     [C]
   /  \
 [A]  [B]
```

| 走訪 | 輸出 | 對應寫法 |
|---|---|---|
| inorder（LVR） | `A / B * C * D + E` | infix |
| preorder（VLR） | `+ * * / A B C D E` | prefix |
| postorder（LRV） | `A B / C * D * E +` | postfix |
| level order | `+ * E * D / C A B` | 一層一層、由左到右 |

> **重點** 對運算式樹做 inorder、preorder、postorder，剛好得到 infix、prefix、postfix 三種寫法。下面的程式都用這棵樹來追蹤。

## 遞迴實作

### Inorder：三行程式
`class Tree` 的宣告裡只有一個 pointer：`root`，整棵樹都從它找起。走訪寫成 Tree 的 member function，把 root 傳進去：

```cpp
void Tree::Inorder()            // driver：從 root 開始
{  Inorder(root); }

void Tree::Inorder(TreeNode *currentNode)
{
    if (currentNode) {                      // 停止條件：是 null 就直接回去
        Inorder(currentNode->leftChild);    // L
        cout << currentNode->data;          // V
        Inorder(currentNode->rightChild);   // R
    }
}
```

- Inorder 裡又呼叫 Inorder 自己，是遞迴函式（recursive function）。
- 遞迴一定要會停，否則就是無限迴圈。停止條件就是那個 `if`：current node 不是 null 才往下做。
- `if` 裡面三行剛好就是 L、V、R。

### 追蹤遞迴呼叫
用「第幾次呼叫」標記，追蹤上面那棵運算式樹（為了區分，上層的 `*` 記作 `*₁`、下層的記作 `*₂`）：

| 呼叫 | 在誰身上 | 發生什麼 |
|---|---|---|
| 1 | + | 不是 null，做 L |
| 2 | `*₁` | 做 L |
| 3 | `*₂` | 做 L |
| 4 | / | 做 L |
| 5 | A | 做 L |
| 6 | null（A 的左） | 空的，馬上 return；回到 A 印出 **A** |
| 7 | null（A 的右） | return；A 這次呼叫結束，回到 /，印出 **/** |
| 8 | B | 做 L |
| 9、10 | null、null | 中間印出 **B**；回到 `*₂` 印出 `*` |
| 11–13 | C、null、null | 印出 **C**；回到 `*₁` 印出 `*` |
| 14–16 | D、null、null | 印出 **D**；回到 + 印出 **+** |
| 17–19 | E、null、null | 印出 **E**；全部退回，結束 |

輸出：`A / B * C * D + E`。

> **觀念** 連 null 也算一次呼叫：每個 node 呼叫一次、每個空指標也呼叫一次。n 個 node 的 binary tree 有 n + 1 個空指標，所以總共 2n + 1 次呼叫（這棵 9 個 node，共 19 次）。

> **重點** inorder 的精神：**盡量往左走，走不下去就印，再看右邊能不能走。** 右邊若有 node，一樣先往它的左邊鑽。

### Preorder、postorder：只搬 cout 那一行
會寫 inorder，另外兩種只要 copy 一份、改名、調整三行的順序：

```cpp
void Tree::Preorder(TreeNode *currentNode)
{
    if (currentNode) {
        cout << currentNode->data;          // V
        Preorder(currentNode->leftChild);   // L
        Preorder(currentNode->rightChild);  // R
    }
}

void Tree::Postorder(TreeNode *currentNode)
{
    if (currentNode) {
        Postorder(currentNode->leftChild);  // L
        Postorder(currentNode->rightChild); // R
        cout << currentNode->data;          // V
    }
}
```

對運算式樹，preorder 輸出 `+ * * / A B C D E`，postorder 輸出 `A B / C * D * E +`。三種程式只差 `cout` 那一行的位置。

## 非遞迴 inorder：自己拿 stack

如果不准用遞迴，就自己用一個 stack（last in first out）。為什麼是 stack？inorder 要先往左，自己還不能印，所以先 push 進 stack 記著，等左邊做完再 pop 回來印。

```cpp
void Tree::NonrecInorder()
{
    Stack<TreeNode*> s;
    TreeNode *currentNode = root;              // 一開始 current = root
    while (1) {
        while (currentNode) {                  // 一路往左，一路 push
            s.Push(currentNode);
            currentNode = currentNode->leftChild;
        }
        if (s.IsEmpty()) return;               // stack 空了就整個結束
        currentNode = s.Top(); s.Pop();        // pop 最後放進去的
        cout << currentNode->data;             // 印出
        currentNode = currentNode->rightChild; // 改走右子樹，回到外層迴圈
    }
}
```

### 例題：用 stack 走運算式樹
stack 由左（底）寫到右（頂）：

| 步驟 | 動作 | stack | 輸出 |
|---|---|---|---|
| 1 | 從 + 一路往左 push | + `*₁` `*₂` / A | |
| 2 | A 的左是 null，內層 while 跳出；pop A，印；current = A 的右 = null | + `*₁` `*₂` / | A |
| 3 | current 是 null，直接 pop /，印；current = B | + `*₁` `*₂` | A / |
| 4 | push B；B 的左是 null | + `*₁` `*₂` B | |
| 5 | pop B，印；current = null | + `*₁` `*₂` | A / B |
| 6 | pop `*₂`，印；current = C，push C | + `*₁` C | `A / B *` |
| 7 | pop C，印 | + `*₁` | `A / B * C` |
| 8 | pop `*₁`，印；current = D，push D | + D | `A / B * C *` |
| 9 | pop D，印 | + | `A / B * C * D` |
| 10 | pop +，印；current = E，push E | E | `A / B * C * D +` |
| 11 | pop E，印；current = null；stack 空 → 結束 | （空） | `A / B * C * D + E` |

輸出和遞迴版一模一樣。

> **觀念** 思考題：preorder、postorder 不用遞迴怎麼寫？preorder 只要把「印出」移到 push 的時候做；postorder 比較麻煩，要記錄右子樹是不是已經走過，或改用兩個 stack。

## Level order：換成 queue

Level order 從上到下（從 level 1 的 root 開始）、每層由左到右印。這次不用 stack，用 queue（first in first out）。

規則只有一句：**從 queue 抓一個出來印，有孩子就把孩子（先左後右）丟進 queue，queue 空了就結束。**

```cpp
void Tree::LevelOrder()
{
    Queue<TreeNode*> q;
    TreeNode *currentNode = root;
    while (currentNode) {
        cout << currentNode->data;
        if (currentNode->leftChild)  q.Push(currentNode->leftChild);
        if (currentNode->rightChild) q.Push(currentNode->rightChild);
        if (q.IsEmpty()) return;
        currentNode = q.Front(); q.Pop();      // 取出 queue 的第一個當下一個 current
    }
}
```

### 例題：運算式樹的 level order
queue 由左（front）寫到右（rear）：

| 取出並印 | 放入 | 印完後的 queue |
|---|---|---|
| + | `*₁`、E | `*₁` E |
| `*₁` | `*₂`、D | E `*₂` D |
| E | （沒有孩子） | `*₂` D |
| `*₂` | /、C | D / C |
| D | — | / C |
| / | A、B | C A B |
| C | — | A B |
| A | — | B |
| B | — | （空）→ 結束 |

輸出：`+ * E * D / C A B`。

> **陷阱** 問：程式裡兩個 `if`（先放 left child、再放 right child）可以顛倒嗎？答：不行。queue 是先進先出，先放右邊的話，每一層就變成由右到左印了。

> **重點** 深度優先的三種走訪（pre／in／post）靠遞迴或 stack；一層一層的 level order 靠 queue。

## 走訪的應用：相等、相似、複製

知道走訪順序是為了掌握 tree 的結構。最直接的應用：比較兩棵 tree 是否相等、是否相似，以及把一棵 tree 完整複製一份。

### 相似（similar）與相等
例如一棵是 A 底下接 B、C，另一棵是 A 底下接 C、B：root 一樣，只是孩子順序換了。

```
    A          A
   / \        / \
  B   C      C   B
```

相不相似要看定義：只看形狀，root 下面都接兩個 child，很像；如果要求左右放的東西也一樣，就不相似。課本的定義是：

- **similar**：兩棵 binary tree 結構相同（左右也要對應），資料可以不同。
- **equivalent**：結構相同，資料也相同。

照這個定義，上面兩棵形狀一樣，屬於 similar，但資料位置不同，不是 equivalent。

比較的快速做法：用 traversal 把 tree 轉成字串再做字串比較，例如 preorder 分別是 `ABC` 和 `ACB`。還可以用 LCS（Longest Common Subsequence，最長共同子序列）看兩個字串共同出現的字和順序：`ABC` 和 `ACB` 的 LCS 長度是 2（例如 `AB`）。

### Copy：複製一棵 tree
把原 tree 的 root 傳進 Copy：

```cpp
TreeNode* Tree::Copy(TreeNode *orig)
{
    if (!orig) return 0;                       // binary tree 可以是空樹，空的就直接 return
    TreeNode *temp = new TreeNode;             // 向系統要一個新 node
    temp->data = orig->data;                   // V：抄 data
    temp->leftChild  = Copy(orig->leftChild);  // L：遞迴複製整棵左子樹
    temp->rightChild = Copy(orig->rightChild); // R：遞迴複製整棵右子樹
    return temp;
}
```

例如原樹 A(B(D, E), C)：先 new 一個 A'、抄 data，再遞迴複製 B 那棵（B'、D'、E'），再複製 C（C'）。每個 node 都 new 一個新的。

> **陷阱** 問：直接寫 `temp->leftChild = orig->leftChild;` 不就好了？答：不行。那只是 pointer assignment，只複製了 root，底下的子樹跟原 tree 共用；一改原 tree，copy 也跟著變，不是真正的複製。左右兩邊都要遞迴呼叫 Copy，左右 subtree 才會各自有一份新的。

上面這個版本的順序是 V、L、R，像 preorder。課本的 C++ 版寫成

```cpp
return new TreeNode(orig->data, Copy(orig->leftChild), Copy(orig->rightChild));
```

先遞迴複製左右子樹、最後才建 node，所以稱為 **modified postorder**。其實哪種順序都能完成複製，關鍵是左右都要遞迴。

### Equal：判斷兩棵 tree 相等
用 operator overloading 定義 `==`：寫 `s == t` 時，把兩棵 tree 的 root 傳給 `Equal(a, b)`，a、b 都是 `TreeNode` 的 pointer。

```cpp
bool Tree::operator==(const Tree& t) const
{  return Equal(root, t.root); }

bool Equal(TreeNode *a, TreeNode *b)
{
    if (!a && !b) return true;                 // 兩個都是空樹：一樣
    return (a && b                             // 1. 兩個都要有值
         && a->data == b->data                 // 2. data 相同
         && Equal(a->leftChild,  b->leftChild) // 3. 整棵左子樹相同（遞迴，不只比一層）
         && Equal(a->rightChild, b->rightChild)); // 4. 整棵右子樹相同
}
```

四個條件全成立才回傳 true，一個 if 就搞定。例如兩棵都是 A(B(D, ), C)：root 都是 A，過關；再遞迴比左子樹 B(D)、右子樹 C，全部相同 → true。若把其中一棵最底下的 D 換成 E，要遞迴比到最深那層才發現不同，回傳 false。

> **觀念** `&&` 會短路（short-circuit）：一遇到 false，後面的條件就不再算，遞迴也不再往下比。

## 走訪能否決定唯一的 tree

Equal 很簡單，similar 難得多，不可能一個 if 解決。一種做法還是把走訪輸出變成字串來比：一棵 tree 可以產生 inorder、preorder、postorder 三種字串。那麼，只給一種走訪字串，能不能決定唯一的一棵 tree？

### 只給一種走訪：不唯一
下面三棵樹形狀不同，inorder 卻全是 `A B C`：

```
  (1)  B        (2) A              (3)      C
      / \            \                     /
     A   C            B                   B
                       \                 /
                        C               A

 inorder : A B C       A B C           A B C
 preorder: B A C       A B C           C B A
```

加上 preorder 就分得開了：三棵的 preorder 分別是 `BAC`、`ABC`、`CBA`。

### 例題：只給 inorder `B C A E D G H F I`
問：對應的 binary tree 唯一嗎？

不唯一。inorder 是「左 root 右」，隨便挑一個當 root 都能切：

- 挑 **A** 當 root：A 左邊的 `B C` 是左子樹，右邊的 `E D G H F I` 是右子樹，照同樣方法繼續往下長，得到一棵樹。
- 挑 **D** 當 root：左子樹由 `B C A E` 組成，右子樹由 `G H F I` 組成，又長出另一棵。

```
 挑 A：          A                 挑 D：          D
              /     \                           /     \
          {B C}   {E D G H F I}           {B C A E}  {G H F I}
```

兩棵不同的樹，inorder 一模一樣，所以只給 inorder，binary tree 不唯一。

### Inorder 加 preorder（或 postorder）才唯一
想法：**preorder 第一個一定是 root**（postorder 則是最後一個）；到 inorder 裡找到它，它左邊那段是左子樹、右邊那段是右子樹。左右兩段再各自這樣切，一層一層下去，每一步都只有一種切法，所以樹是唯一的（這是課本習題，可以自己寫成證明）。

### 例題：由 preorder `A B D C E G F H I` 與 inorder `B D A G E C H F I` 重建
1. preorder 第一個是 **A** → root。在 inorder 裡切：左 `B D`，右 `G E C H F I`。
2. 左子樹的 preorder 是接下來 2 個：`B D`。第一個 **B** 是左子樹的 root；inorder `B D` 中 B 左邊沒有東西、右邊是 D → B 沒有左子，右子是 **D**。
3. 右子樹的 preorder 是剩下的 `C E G F H I`。root 是 **C**；在 inorder `G E C H F I` 切：左 `G E`，右 `H F I`。
4. C 的左子樹 preorder `E G`：root **E**；inorder `G E` 中 G 在 E 左邊 → E 的左子是 **G**。
5. C 的右子樹 preorder `F H I`：root **F**；inorder `H F I` → 左子 **H**、右子 **I**。

```
          A
        /   \
       B     C
        \   / \
         D E   F
          /   / \
         G   H   I
```

正好是前面手算三種走訪那棵樹（它的 postorder `D B G E H I F C A` 可以拿來驗算）。

> **陷阱** 考試重點：**inorder + preorder、inorder + postorder 都能唯一決定 binary tree；preorder + postorder 一般不行**（只有每個 node 都是 0 或 2 個孩子時才可以）。例如 A 只有左子 B、和 A 只有右子 B，preorder 都是 `A B`、postorder 都是 `B A`，少了 inorder 就分不出 B 在左還是右。

### 例題：distinct binary tree（課本習題）
形狀不一樣就算不同的 binary tree（distinct binary tree）。用 1、2、3 三個 node，preorder 都是 `1 2 3`，可以畫出 5 棵不同的 binary tree：

```
 (a)   1      (b)  1      (c)   1      (d)  1       (e) 1
      /           /            / \           \           \
     2           2            2   3           2           2
    /             \                          /             \
   3               3                        3               3

 inorder: 3 2 1   2 3 1      2 1 3        1 3 2        1 2 3
```

這 5 棵 preorder 一樣，inorder 卻各不相同，所以可以用 preorder 與 inorder 的關係來分辨它們（3 個 node 的 distinct binary tree 數目 = 5，是 Catalan number）。

## Satisfiability 問題與 PostOrderEval

### 命題邏輯運算式與 satisfiability
命題邏輯運算式（propositional calculus expression）的變數只能是 true／false（1／0），運算子有三種：

- **not（¬）**：反過來。
- **and（∧）**：兩個都真才真。
- **or（∨）**：一個真就真。

優先順序：**not 最高，and 次之，or 最低**。例如括號 `(x1 ∧ ¬x2)` 要先算 `¬x2`，再跟 x1 做 and。

**Satisfiability（可滿足性）問題**：x1、x2、x3… 設成什麼值，整個式子會是 true？

> **比喻** 設計開燈電路：式子算出 1，燈才亮。如果布林式寫得不好，燈可能永遠不會亮，所以要檢查有沒有任何一組輸入能讓輸出為 1。

### 例題：`(x1 ∧ ¬x2) ∨ (¬x1 ∧ x3) ∨ ¬x3`
三個變數各有 T、F 兩種，共 2³ = 8 種組合，要一組一組代進去試；成立的可能不只一組，每一組 true 都要印出來。

| x1 | x2 | x3 | x1 ∧ ¬x2 | ¬x1 ∧ x3 | ¬x3 | 結果 |
|---|---|---|---|---|---|---|
| T | T | T | F | F | F | **F** |
| T | T | F | F | F | T | T |
| T | F | T | T | F | F | T |
| T | F | F | T | F | T | T |
| F | T | T | F | T | F | T |
| F | T | F | F | F | T | T |
| F | F | T | F | T | F | T |
| F | F | F | F | F | T | T |

8 組裡有 7 組成立，只有 TTT 不成立。

式子很長又有括號，畫成 tree 會清楚得多（從式子建樹的方法見課本）：

```
                 ∨
               /   \
             ∨       ¬
           /   \       \
         ∧       ∧      x3
        / \     / \
      x1   ¬   ¬   x3
            \   \
            x2   x1
```

注意 ¬ 只有一個運算元，放在 **rightChild**，leftChild 是空的。

### 電腦怎麼算布林式：stack 兩階段 vs postorder 一次
輸入 TTT 這組值之後，怎麼讓電腦自己算出式子是 true 還是 false？它跟 stack 章節的算術 expression evaluation（例如 `2 + 3 * 4`）很像，只是加減乘除換成 not、and、or，變數只能是 0 或 1。

- **用 stack：兩個 phase。**
  - Phase 1：infix 轉 postfix，`2 + 3 * 4` → `2 3 4 * +`。
  - Phase 2：照 postfix 算：數字就 push；遇到 operator 就 pop 兩個出來算，再 push 回去。`3 * 4 = 12`，`2 + 12 = 14`。
- **用 tree：一個 phase。** 把式子建成 tree，直接做 postorder：走訪時孩子的值先算好，再算自己，走完答案就在 root。代價是一定要先把這棵 tree 建好，這步躲不掉。

### 求值用的 node：四個欄位
原本的 tree node 只有 left、data、right 三個欄位，這裡多一個 `value`：

```
 ┌───────────┬──────┬───────┬────────────┐
 │ leftChild │ data │ value │ rightChild │
 └───────────┴──────┴───────┴────────────┘
```

- `leftChild`／`rightChild`：指向左右孩子。
- `data`：自己是誰——operator（not／and／or），或變數被設成的 true／false。
- `value`：拿左右子樹算好的值做完運算後的結果。

### PostOrderEval 程式
架構就是 postorder（L R V），只是 V 從「印出來」改成「看 data 是什麼，用 switch 分 case 去算」：

```cpp
void SatTree::PostOrderEval(SatNode *s)
{
    if (s) {                                   // 空的就什麼都不做
        PostOrderEval(s->leftChild);           // L
        PostOrderEval(s->rightChild);          // R
        switch (s->data) {                     // V：依 data 求值
            case LogicalNot:   s->value = !s->rightChild->value; break;
            case LogicalAnd:   s->value = s->leftChild->value && s->rightChild->value; break;
            case LogicalOr:    s->value = s->leftChild->value || s->rightChild->value; break;
            case LogicalTrue:  s->value = true;  break;   // 變數被設成 true
            case LogicalFalse: s->value = false;          // 變數被設成 false
        }
    }
}
```

> **陷阱** 運算時拿的是孩子的 **value**，不是 data！data 記自己是誰，value 記算出來的結果。not 只取 **rightChild** 的 value（左子是空的）。

Postorder 最後才處理 root，所以**答案在 root 的 value**。整個演算法是窮舉：

```cpp
for (each of the 2ⁿ combinations of (x1, …, xn)) {
    把這組 true/false 填進各變數 leaf 的 data;
    PostOrderEval(root);
    if (root->value) 印出這組 (x1, …, xn);
}
```

> **重點** n 個變數要試 2ⁿ 種組合，每種都走訪整棵樹一次 O(g)（g 為樹的 node 數），總時間 **O(g · 2ⁿ)**，是指數時間。

### 例題：代入 TTT 與 TTF
TTT（x1 = T, x2 = T, x3 = T），照 postorder 由下往上算：

| node | 計算 | value |
|---|---|---|
| x1 | 變數 | T |
| x2 | 變數 | T |
| ¬x2 | ¬T | F |
| x1 ∧ ¬x2 | T ∧ F | F |
| x1（右邊那個） | 變數 | T |
| ¬x1 | ¬T | F |
| x3 | 變數 | T |
| ¬x1 ∧ x3 | F ∧ T | F |
| 左下的 ∨ | F ∨ F | F |
| x3 | 變數 | T |
| ¬x3 | ¬T | F |
| root ∨ | F ∨ F | **F** |

root 是 F，這組不印，換下一組。TTF：前兩個括號一樣是 F，但 `¬x3 = ¬F = T`，root = `F ∨ T` = **T** → 印出 (T, T, F)。

### 延伸：用 tree 算算術運算式
問：這支程式拿去算 stack 章節的算術運算式，要怎麼改？

答：一樣建成一棵 tree，switch 裡把 not、and、or 換成 `+ - * /`，leaf 的 value 就是數字（或變數的值）。以 `2 + 3 * 4` 為例（把 2、3、4 想成 x1、x2、x3 的值）：

```
      +
     / \
    2   *
       / \
      3   4
```

postorder：`2 3 4 * +`；先算 `3 * 4 = 12`，再算 `2 + 12 = 14`，答案在 root。

> **陷阱** 減法和除法是 `left op right`，左右順序不能反。

- stack 作法要兩支程式：一支 infix 轉 postfix，另一支 EVAL 再算 postfix。
- tree 作法只要走訪一次，簡單多了；但前提是要先把 infix 式子變成一棵 tree，這步要自己設計。

> **例題** 不准用 stack，用 tree 做 expression evaluation（很可能出成考題）。答題要寫兩步：**先建樹、再 postorder 求值**，只寫 postorder 不算解完。

再一題：`A / B − C + D * E − A * C`。先建成對應的 tree，設好 A 到 E 的值，postorder 走一遍就有答案；它的 postorder 正好就是 postfix `A B / C - D E * + A C * -`。

```
                 −
               /   \
             +       *
           /   \    / \
          −     *  A   C
         / \   / \
        /   C D   E
       / \
      A   B
```

> **觀念** 遇到「trace code」的題目，就一行一行自己追；真的追不懂，把程式打進 C、C++ 或 Java，用 debugger step by step 看變數怎麼變。會 trace 別人的程式很重要，進公司後常常要讀別人寫好的大型 project；寫 code 則像打電動，越寫經驗值越高，也能直接看到邏輯跑起來的結果。

## 引線二元樹（Threaded Binary Tree）

### n + 1 個空 link
Threaded binary tree 的用意：把 binary tree 裡沒用到的 link 拿來利用。

- n 個 node，每個 node 兩個 pointer，共 **2n** 個 link 欄位。
- 除了 root 沒人指，其他 node 各被一條 link 指到，所以只用了 **n − 1** 條 link（也就是 n − 1 條邊）。
- 空著的 null link：2n − (n − 1) = **n + 1** 個。

> **重點** n 個 node 的 binary tree 有 **n + 1** 個 null link，考試很常考。

反正 node 都產生了、欄位本來就在，不如拿來用，這就是 thread 的概念：**讓空 link 指向這個 node 在 inorder 裡的前一個或後一個**。

- 規則一：`ptr->leftChild` 是空的 → 改指向 ptr 的 **inorder predecessor**（前一個）。
- 規則二：`ptr->rightChild` 是空的 → 改指向 ptr 的 **inorder successor**（後一個）。

### 例題：接上 thread
課本的例子（n = 9，共 18 個 link 欄位，用了 8 條，空 10 條）：

```
              A
          /       \
        B           C
      /   \       /   \
     D     E     F     G
    / \
   H   I

 inorder：H D I B E A F C G
```

| node | left thread → | right thread → |
|---|---|---|
| H | （無前一個，懸空） | D |
| I | D | B |
| E | B | A |
| F | A | C |
| G | C | （無後一個，懸空） |

例如 E 是 leaf，兩個 pointer 本來都是 null：left 改指 inorder 前一個 B，right 改指後一個 A。I 的前一個是 D、後一個是 B。共 10 條 thread，正好是 n + 1。

H 是 inorder 第一個，沒有前一個；G 是最後一個，沒有後一個，這兩條會懸空。可以讓它們指到 root；課本的做法是指向一個 **head node**。

### leftThread、rightThread 與 head node
現在每條 link 都指到某個 node，就得分得出：這條指的是真正的孩子，還是 thread？所以 node 多加兩個 Boolean 欄位：

```
 ┌────────────┬───────────┬──────┬────────────┬─────────────┐
 │ leftThread │ leftChild │ data │ rightChild │ rightThread │
 └────────────┴───────────┴──────┴────────────┴─────────────┘
```

- `leftThread = true`：leftChild 是 thread；`false`：leftChild 是普通的孩子指標。rightThread 同理。
- 例：I 左右出去都是 thread，兩個欄位都是 true；B 兩邊都是真正的孩子，兩個欄位都是 false。

**Head node** 就像 linked list 的 head node，是整棵樹的頭：

- head 的 `leftChild` 指向真正的 root A（leftThread = false）。
- head 的 `rightChild` 彎回來指著自己（rightThread = false）。
- H 的 left thread、G 的 right thread 都改指向 head，不再懸空。
- 空樹時：head 的 leftThread = true，leftChild 指回 head 自己。

只要看每個 node 的 t／f 兩個欄位，就知道每條 link 是不是通到真正的孩子。

### Thread 的用途與代價
用途：很快找到某個 node 在 inorder 的下一個（successor）或上一個（predecessor），例如 E 的 right thread 一步就到 A。照著 thread 欄位走，就能做完整個 inorder，**不用 stack、也不用遞迴**，O(n)。

```cpp
ThreadedNode* ThreadedTree::InorderSucc(ThreadedNode *x)
{   // 回傳 x 的 inorder successor
    ThreadedNode *temp = x->rightChild;
    if (!x->rightThread)                       // 右邊是真正的子樹：
        while (!temp->leftThread)              //   找右子樹最左邊的 node
            temp = temp->leftChild;
    return temp;                               // 右邊是 thread：直接就是 successor
}
```

從 head 開始一直呼叫 InorderSucc，回到 head 時就走完整棵樹的 inorder。

> **觀念** 實務上 threaded tree 很少用到，它是 binary tree 研究演進的產物：有人提出「別浪費空間」，之後就被寫進教科書。

代價：

1. 每個 node 多了 leftThread、rightThread 兩個 Boolean 欄位。
2. insert、delete 時，除了原本的 pointer 還要調整 thread，多做很多 pointer assignment。

### 例題：把 R 插成 X 的右孩子
**Case 1：X 原本沒有右子樹。** X 的 right 本來是 thread，指向 X 的 inorder successor A。

```
 插入前：                          插入後：
        A                                 A
       /                                 /
     ...                               ...
       \                                 \
        X                                 X
          X.right ⇢ A（thread）             \
                                             R
                                               R.left  ⇢ X（thread）
                                               R.right ⇢ A（thread）

 inorder：… X A …                  inorder：… X R A …
 （⇢ 表示 thread，實線是真正的孩子 link）
```

要設的欄位：

- `X->rightChild = R`，`X->rightThread = false`（現在指的是真正的孩子，不是 thread）。
- `R->rightChild = A`（接手 X 原本指向 A 的 thread），`R->rightThread = true`。
- `R->leftChild = X`，`R->leftThread = true`（R 的前一個是 X）。

**Case 2：X 原本就有右子樹。** X 的右孩子是 Y，Y 有左孩子 W；W 的 left thread 指向 X。插入後，X 原本整棵右子樹往下移一層，變成 R 的右子樹。

```
 插入前：                    插入後：
      X                          X
       \                          \
        Y                          R
       /                            \
      W                              Y
                                    /
                                   W

 inorder：X W Y A           inorder：X R W Y A
```

- `X->rightChild = R`（rightThread = false）；`R->leftChild = X`（leftThread = true）。
- `R->rightChild = Y`（rightThread = false），接手 X 原本的右子樹。
- **容易漏的一條**：W 的 left thread 本來指向 X，現在要改指向 R。因為 inorder 是 L V R，插入後 W 的前一個從 X 變成 R。（W 就是 R 右子樹在 inorder 裡的第一個 node。）

```cpp
void ThreadedTree::InsertRight(ThreadedNode *x, ThreadedNode *r)
{   // 把 r 插成 x 的右孩子
    r->rightChild  = x->rightChild;   // r 接手 x 原本的右 link（Case 1 是 thread，Case 2 是子樹）
    r->rightThread = x->rightThread;
    r->leftChild   = x;               // r 的 left thread 指回 x
    r->leftThread  = true;
    x->rightChild  = r;
    x->rightThread = false;
    if (!r->rightThread) {            // Case 2：r 有右子樹
        ThreadedNode *temp = InorderSucc(r);  // 右子樹最左邊的 node（例中的 W）
        temp->leftChild = r;          // 它的 left thread 改指 r
    }
}
```

插成左孩子也一樣，分「原本沒有左子樹」和「已經有左子樹」兩種 case。

## 優先佇列（Priority Queue）

### 不照排隊順序的 queue
情境：一堆東西排著，每次都要拿出「最小的」那一個。例如 Huffman 演算法裡的 DeleteMinWeight：先 delete 出最小的當 first，再 delete 一次拿第二小的當 second。這已經不是 first in first out，誰先出去是看 priority。這種照優先權取出的 queue 叫 **priority queue（優先佇列）**。

Priority queue 也有 add 和 delete 兩個動作。光看 add（放進去）看不出它和普通 queue 的差別；重點在 delete：每個元素帶著自己的 priority，取出時看 priority 決定拿誰。

- **Max priority queue**：每次 delete 回傳目前裡面最大的（例如裡面有 100、1、37、8，回傳 100）。
- **Min priority queue**：每次 delete 回傳最小的（回傳 1）。

應用：

- Huffman：每次取頻率最小的兩個 → min priority queue。
- Machine service：每個 job 要花的時間不同，讓最快做完的先做 → min priority queue。

Priority queue 常被直接叫做 **heap（堆積）**。

> **觀念** 嚴格講，priority queue 是 ADT（抽象資料型態），heap 是實作它最常用的資料結構，兩者不完全相同。

### 怎麼存：先甘後苦、先苦後甘
依序放入 100、1：

| 存法 | 放入 100、1 之後 | 怎麼維持順序 |
|---|---|---|
| unordered linked list | 100 → 1 | 不排，直接塞 |
| unordered array | a[0] = 100, a[1] = 1 | 不排，直接塞 |
| sorted linked list | 1 → 100 | pointer assignment 改指標 |
| sorted array | a[0] = 1, a[1] = 100（100 往後搬一格） | data movement 搬資料 |

| 實作 | insert | delete 最大／最小 |
|---|---|---|
| unordered array／list | O(1)：直接丟進去 | O(n)：要全部 scan 一遍 |
| sorted array／list | O(n)：要找位置、排好 | O(1)：最大的就在一端 |
| max heap | **O(log n)** | **O(log n)** |

> **比喻** Unordered 是「先甘後苦」：放的時候很爽，拿的時候才辛苦。Sorted 剛好相反，「先苦後甘」。Heap 兩邊都不差。

log n 來自 heap 用 tree 表示，操作只沿著樹高走，而樹高約 log n。log n 長得很慢：n 是一百萬，log₂ n 也才大約 20。所以 priority queue 通常用 heap 做。

## Max heap 與 min heap

### 定義
- **Max heap**：每個 node 的 key 都**不小於**它 children 的 key。所以 root 永遠是最大的，而且每個 subtree 自己也是 max heap（下面沒有任何數比它的根大）。
- **Min heap**：每個 node 的 key 都**不大於**它 children 的 key；最小的在 root。
- 不管 max 還是 min，heap 一定是 **complete binary tree**。

```
 max heap：            min heap（示意）：
        14                    2
      /    \                /   \
    12      7              7     4
   /  \    /              / \
  10   8  6             10   8

 array: [1]14 [2]12 [3]7 [4]10 [5]8 [6]6
```

> **陷阱** Heap 有沒有規定左邊一定比右邊大？**沒有**。左 12 右 7、左 10 右 8 都合法。Heap 只管上下（parent 與 child），不管左右；「左小右大」是 binary search tree 的規則，兩者不要混。

### 為什麼用 array 存
Node 旁邊的編號 1 到 6 就是 array 的 index：這棵 tree 其實就存在 array 裡，畫成樹只是方便看。放法是一層一層、由左到右：root 放 [1]，下一層放 [2]、[3]……，[0] 不用。

```
 index :  [0] [1] [2] [3] [4] [5] [6]
 value :   -   14  12   7  10   8   6
```

- i 的 parent 是 ⌊i/2⌋，例如 [5] 的 parent 是 [2]；i 的左右 child 是 2i、2i + 1。
- insert 和 delete 都要一直找 parent、找 child，用 index 一算就到。
- 也可以用 node 加 left、right pointer 實作，但 pointer 只往下指，要往上找 parent 就得多存東西或多花時間。
- heap 是 complete binary tree，array 中間不會留洞，一點空間都不浪費。

## Max heap 的 insert：放最後、往上爬（bottom-up）

Insert 只做兩件事：

1. 新元素先放在 heap **最末端的下一個位置**，維持 complete binary tree。
2. 跟 **parent** 比：比 parent 大就往上爬，一直到爬不上去（parent 比它大，或已經到 root）為止。

三個例子都從同一個 max heap 開始：

```
        20
      /    \
    15      2
   /  \
  14   10

 index: [1] [2] [3] [4] [5]
 value:  20  15   2  14  10
```

### 例一：insert 1
[1] 到 [5] 都用了，1 放進 [6]，也就是 2 的左小孩。

```
        20
      /    \
    15      2
   /  \    /
  14   10 1

 [1]20 [2]15 [3]2 [4]14 [5]10 [6]1
```

1 跟 parent 2 比，沒有比較大 → 待著，insert 結束。

> **陷阱** Insert 永遠是跟 **parent** 比，不是跟 root 比。

問：可以把 1 放到右邊別的空位（例如 2 的右邊）嗎？答：不行。heap 一定是 complete binary tree，位置要依序填，只能放在 [6]。

### 例二：insert 5
先放在 [6]（2 的左小孩）：

```
 步驟 1：放在最後              步驟 2：5 > parent 2，交換位置
        20                            20
      /    \                        /    \
    15      2                     15      5
   /  \    /                     /  \    /
  14   10 5                     14   10 2

 [ 20 15 2 14 10 5 ]           [ 20 15 5 14 10 2 ]
```

5 再跟 parent 20 比，比較小 → 停。結果 `20 15 5 14 10 2`。

### 例三：insert 21

```
 步驟 1：放在 [6]           步驟 2：21 > 2，上去       步驟 3：21 > 20，再上去
        20                         20                         21
      /    \                     /    \                     /    \
    15      2                  15      21                 15      20
   /  \    /                  /  \    /                  /  \    /
  14   10 21                 14   10 2                  14   10 2

 [20 15 2 14 10 21]         [20 15 21 14 10 2]         [21 15 20 14 10 2]
```

21 到了 root，到 root 就一定停。結果 `21 15 20 14 10 2`。

> **重點** 最多爬樹高那麼多次，insert 是 **O(log n)**。

### Insert 的程式

```c
void Insert(Element x)
{   /* 把 x 插入 max heap：heap[1..n] */
    if (n == MaxSize) { HeapFull(); return; }  /* heap is full */
    n++;                                       /* 最後一格的下一格 */
    int i;
    for (i = n; i != 1; i /= 2) {              /* i == 1 就是到 root，不能再往上 */
        if (x.key <= heap[i/2].key) break;     /* 沒比 parent 大：停 */
        heap[i] = heap[i/2];                   /* parent 往下搬 */
    }
    heap[i] = x;                               /* 最後才把 x 放進去 */
}
```

- Array 大小固定為 `MaxSize`；`n == MaxSize` 就是滿了。
- `n` 記錄 heap 有幾個元素，也剛好是最後一格的 index。例子放在 [1] 到 [5]，所以 n = 5；`n++` 之後 n 才變 6，新元素從 [6] 開始試。
- `i` 代表 x 目前要試放的位置；parent 是 `heap[i/2]`。

> **陷阱** 程式其實沒有每層 swap：x 一直拿在手上，只把 parent 往下 copy（`heap[i] = heap[i/2]`），最後才一次寫 `heap[i] = x`，比 swap 少搬一半。往上爬一層是 `i /= 2`（i 除以 2）。

### 例題：trace insert 21
原 heap `20 15 2 14 10`，n = 5。

| 時點 | i | 比較 | 動作 | heap[1..6] |
|---|---|---|---|---|
| n++ 後 | 6 | — | n = 6 | 20 15 2 14 10 _ |
| 第 1 輪 | 6 | 21 vs heap[3] = 2 | 21 較大，不 break；heap[6] = 2，i = 3 | 20 15 2 14 10 2 |
| 第 2 輪 | 3 | 21 vs heap[1] = 20 | 21 較大；heap[3] = 20，i = 1 | 20 15 20 14 10 2 |
| 迴圈檢查 | 1 | i == 1 | 迴圈結束 | |
| 結束 | 1 | — | heap[1] = 21 | **21 15 20 14 10 2** |

> **觀念** 延伸題：heap 不用 array，改用 node 加 left、right pointer，insert 要怎麼改？難處就在 pointer 只往下指，往上找 parent 不方便。

## Max heap 的 delete：最後一個元素補到 root、往下落（top-down）

### 先想笨方法
Max heap 的 delete（沒指定刪誰）就是把 root 拿走，這正是 priority queue「拿出最大的」動作。仍用 `20 15 2 14 10`：20 被拿走，root 空了。

笨方法：從剩下的數字裡找最大的補上。15 最大 → 15 移上來；15 原來的位置又空了，從它下面挑 14 補上……

```
 拿走 20          15 補上 root       14 補上 [2]
     _                15                 15
   /   \            /    \             /    \
  15    2          _      2           14     2
 /  \             / \                / \
14   10          14  10             _   10

                                 array: [1]15 [2]14 [3]2 [4]_ [5]10
```

補到最後，位置 [4] 空著、10 留在 [5]，已經不是 complete binary tree 了，所以這不是正確作法。

### 正解：把最後一個元素「打」到 root，再往下落
- 方向要記住：**insert 是 bottom-up**（從下往上），**delete 是 top-down**（從上往下）。
- 原本 5 個元素在 [1]~[5]；刪掉一個只剩 4 個，只需要 [1]~[4]，所以最後一格 [5] 要收回，樹才維持 complete。
- 原本在 [5] 的 10 怎麼辦？

> **比喻** 像打彈珠：砰一聲把最後一個元素 10 打到 root，再讓它往下落，落到該停的地方。

程式裡不直接把 10 放進 root，而是先存在變數 `k`（k = 10）。因為下面可能有比它大的 child（像 15），直接放就違反 root 最大的規則。

往下落的規則：每到一個空位，先挑出**較大的 child**（只有大的那個有資格上去，否則換上去會比另一個小孩還小），拿它跟 k 比：

- child 比 k 大 → child 往上搬，空位往下移一層。
- 走到 leaf，或 k 已經比較大的 child 大（或相等）→ 停，把 k 放進空位。

### 例題：delete 一次（`20 15 2 14 10`）

```
 步驟 0：取出 20，k = 10，n 變 4（[5] 收回）
         _                       k = 10
       /   \
     15     2
    /
  14
 array: [1]_ [2]15 [3]2 [4]14

 步驟 1：root 的 child 是 15、2，較大的是 15；15 > 10 → 15 上去
        15
       /   \
      _     2
     /
   14
 array: [1]15 [2]_ [3]2 [4]14

 步驟 2：[2] 只有一個 child 14；14 > 10 → 14 上去
        15
       /   \
     14     2
     /
    _
 array: [1]15 [2]14 [3]2 [4]_

 步驟 3：[4] 是 leaf，下面沒小孩 → 10 放這裡
        15
       /   \
     14     2
     /
   10
 array: [1]15 [2]14 [3]2 [4]10
```

結果 `15 14 2 10`，每個 parent 都比 child 大，仍是 max heap；20 被 return 出去。

### deleteMax 的程式

```c
Element* DeleteMax(Element& x)
{   /* 從 max heap 刪除最大元素，放進 x 回傳 */
    if (n == 0) { HeapEmpty(); return 0; }     /* heap 是 empty */
    x = heap[1];                               /* 要 return 的是 root（最大） */
    Element k = heap[n]; n--;                  /* 最後一個元素存進 k，heap 少一格 */
    int i, j;
    for (i = 1, j = 2; j <= n; ) {             /* i：要決定放誰的位置；j：它的左 child */
        if (j < n)                             /* 右 child 存在才比 */
            if (heap[j].key < heap[j+1].key) j++;  /* j 指向較大的 child */
        if (k.key >= heap[j].key) break;       /* k 不比最大的 child 小：停 */
        heap[i] = heap[j];                     /* child 往上 copy */
        i = j; j *= 2;                         /* 往下走一層 */
    }
    heap[i] = k;
    return &x;
}
```

- `j` 和 `j+1` 是 i 的兩個 child，root 的 child 是 [2] 和 [3]。
- `j < n` 是在確認右 child 存在；少了這個檢查，`j++` 可能讀到 heap 範圍外的東西。

> **陷阱** `j++` 之前一定要先確認 `j < n`（右 child 存在）。

### 例題：trace deleteMax（`20 15 2 14 10`）
一開始 x = 20，k = heap[5] = 10，n = 4，i = 1，j = 2（[5] 已經抓進 k）。

| 輪 | i | j | 較大的 child | 比較 | 動作 | heap[1..4] |
|---|---|---|---|---|---|---|
| 開始 | 1 | 2 | — | — | — | 20 15 2 14 |
| 1 | 1 | 2 | heap[2] = 15 vs heap[3] = 2 → j = 2 | 10 < 15 | heap[1] = 15；i = 2，j = 4 | 15 15 2 14 |
| 2 | 2 | 4 | j = 4 = n，沒有右 child → heap[4] = 14 | 10 < 14 | heap[2] = 14；i = 4，j = 8 | 15 14 2 14 |
| 3 | 4 | 8 | j = 8 > n = 4 | — | 迴圈結束 | |
| 結束 | 4 | — | — | — | heap[4] = k = 10 | **15 14 2 10** |

第 1 輪後第 2 格的 15 是舊值，下一輪會被蓋掉；第 2 輪後 [4] 的 14 也是舊值，最後被 10 蓋掉。結果跟手算一樣，最後把 20 return 回去。

## Heap 操作的成本

| 操作 | 成本 | 原因 |
|---|---|---|
| insert | O(log n) | 最多從 leaf 爬到 root，走樹高 |
| delete（刪 root） | O(log n) | 最多從 root 走到 leaf，走樹高 |
| 刪除／搜尋任意指定元素（例如刪 10） | O(n) | 要先 scan 找到它 |

刪任意元素有兩步：

1. 先 scan 找到它：heap 只保證上下關係，其他位置沒排序，看不出 10 在哪，只能把 array 一格一格 scan，最壞看完 n 格，O(n)。
2. 刪掉後留下洞，再往 subtree 調整（可能往上或往下），O(log n)。

加起來 n + log n。整體由比較慢的那段（bottleneck）決定；n 比 log n 大得多，所以是 **O(n)**。

> **陷阱** n + log n 是由 **n** 主導，不是 log n。

## Heap sort

Heap 能拿來排序嗎？可以，這就是 heap sort。要把一堆數字排成由小到大：

1. Phase 1：把 n 個數字建成 **min heap**（root 永遠是最小的）。
2. Phase 2：對它 **delete n 次**。每次拿出來的都是目前最小的，依序就是由小到大。

### 例題：排序 5、3、8、1、4
**Phase 1：從空 heap 一個一個 insert**（min heap：比 parent 小就往上爬）。

| insert | 過程 | heap（array） |
|---|---|---|
| 5 | 放 [1] | 5 |
| 3 | 放 [2]；3 < parent 5 → 往上 | 3 5 |
| 8 | 放 [3]；8 > 3 → 停 | 3 5 8 |
| 1 | 放 [4]；1 < 5 → 上到 [2]；1 < 3 → 上到 [1] | 1 3 8 5 |
| 4 | 放 [5]；4 > parent 3 → 停 | 1 3 8 5 4 |

```
 建好的 min heap：
         1
       /   \
      3     8
     / \
    5   4
```

**Phase 2：delete 5 次**（min heap：最後一個元素補到 root，跟較**小**的 child 比，往下落）。

| delete | 取出 | k（最後一個） | 往下落 | 剩下的 heap |
|---|---|---|---|---|
| 1 | 1 | 4 | child 3、8 中較小的 3 < 4 → 3 上去；[2] 的 child 5 > 4 → 停 | 3 4 8 5 |
| 2 | 3 | 5 | child 4、8 中較小的 4 < 5 → 4 上去；[2] 已是 leaf → 停 | 4 5 8 |
| 3 | 4 | 8 | child 5 < 8 → 5 上去；停 | 5 8 |
| 4 | 5 | 8 | 沒有 child → 8 放 root | 8 |
| 5 | 8 | — | — | （空） |

依序取出 `1 3 4 5 8`，排好了。

### 成本
- 每次 insert 最多爬樹高 O(log n)，做 n 次。
- 每次 delete 也是 O(log n)，做 n 次。
- 加起來約 2n log n，heap sort 是 **O(n log n)**。

> **觀念** 逐一 insert 建 heap 是 O(n log n)；課本另有 bottom-up 的 heapify，建 heap 只要 O(n)，但整體排序仍是 O(n log n)。教科書版的 heap sort 通常用 **max heap** 在原 array 裡排成遞增（每次把最大的換到 array 尾端），概念是一樣的。

> **重點** Heap 三原則：第一，max heap root 最大，min heap root 最小。第二，insert 時新元素放在**最後一個位置**，再 **bottom-up** 跟 parent 比。第三，delete 時把**最後一個元素提到 root**，再 **top-down** 跟較大（min heap 則較小）的 child 比，往下找它的位置。

## Huffman code：用 binary tree 和 heap 做壓縮

Huffman code 把前面學過的兩樣東西合在一起用：

- **binary tree**：每個 node 最多兩個小孩，碼就藏在這棵樹裡。
- **priority queue**：每次要能很快拿出「最小的」那個。priority queue 用 **heap** 實作，看到 priority queue 就想到 heap。

用途是**編碼（encode）**：把文字變成一串 0 和 1 傳給對方（像以前的傳真機），對方收到這串 bits 後，再照同一套 code **解碼（decode）**回原本的文字。

### ASCII：固定長度編碼

ASCII 讓每個字元（字母、標點、控制字元）都對到一個固定的 code。大小寫是不同字元：

| 字元 | ASCII code |
|---|---|
| 大寫 E | 01000101 |
| 小寫 e | 01100101 |

所以 ASCII 是 **fixed length coding（固定長度編碼）**：不管一個字元常不常出現，它的 code 都一樣長。標準 ASCII 其實是 7 bits，平常用 1 byte（8 bits）儲存，以下計算都以每字元 8 bits 算。

### 出現越多、碼越短

1952 年 David Huffman 發明了 Huffman code，目標是用**最少的 code length（最少的 bit 數）**表示一段文字。

看例句 `Eerie eyes seen near lake.`：用 ASCII 存，每個字元換一個 8-bit code，大寫 E 和小寫 e 一樣長。但這句話裡出現最多的是小寫 e（8 次），這麼常出現的字元，應該給它最少的 bit；ASCII 做不到，不管出現幾次都是 8 bits。

Huffman 的想法是 **variable length coding（變動長度編碼）**：依每個字元的 **frequency（出現頻率）**編碼，越常出現的 code 越短，總長就變少。最常出現的字，很自然就用最少的單位來描述它。

所以第一步是**統計**：

- 統計的是**字元**，不是單字；出現幾次就記幾次。
- 空白也是字元（例句中出現 4 次），句點、冒號、引號等標點與控制字元也要統計，因為存檔時它們一樣要存。
- 實作上就是 scan 整個檔案的每一行，算出每個字元的 frequency。

### Codebook：碼與明文的對照表

另一種說法：把要編碼的東西叫 **message**，M1、M2、…、Mn，可以把 message 想成文章中的 word（字）。每個 message 有一個代號，整理起來叫 **codebook（碼書）**，就是碼與明文的對照表。

- Huffman 產生 codebook 的方式是看頻率：**出現最頻繁的字，用最短的碼**。
- 文章傳過去，接收方手上有同一份 codebook，照著碼把原文解回來。
- 碼越長，要讀的 bit 越多，解碼越花時間。
- 所以讓頻繁出現的 word 的 code size 小一點，整份文件編碼後的總長度就最小。

> **觀念** Huffman 是**編碼／壓縮**，不是加密。誰拿到樹（codebook）都解得開。

### Codebook 長成一棵樹：prefix code

> **例題** 四個 message M1～M4（想成只有四個 word），它們的 Huffman code 是 M1 = 000、M2 = 001、M3 = 01、M4 = 1。畫成樹，往左記 0、往右記 1：

```
          root
        0/    \1
        ●      M4
      0/ \1
      ●   M3
    0/ \1
    M1  M2
```

M1 的碼 000，就是從 root 往下走到 M1 這個 leaf 的路徑：左、左、左。同理 001 是 M2，01 是 M3，只有一個 1 的是 M4。所以 **codebook 本身就長成一棵 tree**。

為什麼碼不會搞混？因為每個 message 都在 **leaf**，沒有一個碼是另一個碼的開頭（前綴）。這叫 **prefix code（prefix-free code，前綴碼）**：一串 bit 接在一起傳，不需要分隔符號，也能唯一解碼。

樹可以有不同長法（例如 M4 放左邊也行），但要符合一個 **objective function（目標函數）**：每個 message 有自己的頻率 qᵢ，碼長 dᵢ 就是它所在 leaf 的深度，要讓

```
總長度 = ∑ qᵢ × dᵢ   （頻率 × 碼長，對所有 message 加總）
```

最小。這個量叫 **weighted external path length（加權外部路徑長）**。頻率越高、碼越短，整份檔案的 code size 就最小。

## 建 Huffman tree：每次合併最小的兩個（greedy）

Huffman 的精神只有一句：**每次挑兩個 frequency 最小的，把它們 merge**。這是一種 greedy（貪婪）作法。

### 例題：頻率 2、3、5、7、9、13

方塊是 leaf，代表 message，方塊裡的數字是它出現的次數；merge 出來的圓圈 node 上的數字，是它整棵 subtree 頻率的總和。

| 步驟 | queue 裡（由小到大） | 取出最小兩個 | merge 結果 |
|---|---|---|---|
| 1 | 2, 3, 5, 7, 9, 13 | 2, 3 | 5 |
| 2 | 5, 5(圓), 7, 9, 13 | 5(圓), 5 | 10 |
| 3 | 7, 9, 10, 13 | 7, 9 | 16 |
| 4 | 10, 13, 16 | 10, 13 | 23 |
| 5 | 16, 23 | 16, 23 | 39 |
| 結束 | 39 | queue 只剩一棵 | Huffman tree 完成 |

每次 merge 出來的 subtree 就當成一個「更大的 message」，頻率是兩者相加，丟回 queue 裡排隊。6 個 message 一共 merge 5 次；**n 個 message 共 merge n − 1 次**。

最後的 Huffman tree（□ 是 leaf，( ) 是 merge 出來的 node）：

```
                 (39)
             0/        \1
          (16)          (23)
         0/  \1       0/    \1
        □7    □9    (10)     □13
                   0/   \1
                  (5)    □5
                 0/ \1
                □2   □3
```

讀碼：往左記 0、往右記 1。

| 頻率 | 碼 | 碼長 |
|---|---|---|
| 2 | 1000（右、左、左、左） | 4 |
| 3 | 1001（右、左、左、右） | 4 |
| 5 | 101 | 3 |
| 7 | 00 | 2 |
| 9 | 01 | 2 |
| 13 | 11 | 2 |

頻率很高的 13 離 root 近，只要 2 bits；很少出現的 2 和 3 離 root 最遠，用最長的碼。字是什麼不重要（可以想成 I、the、you），重要的是頻率。

總長度 = 2×4 + 3×4 + 5×3 + 7×2 + 9×2 + 13×2 = 93。

### Bottom-up：合併出來的是「虛擬字」

建 Huffman tree 的關鍵字是 **bottom-up（由下往上）**，不是從 root 往下建：

- 頻率少的字先 merge 成一棵 subtree。為什麼最小的先合？因為它本來就該在最底層、碼最長，先抓出來，它就被壓在最下面。
- 2 和 3 合出來的圓圈 5，可以想成一個**虛擬的、合起來的字**，頻率是 5。樹蓋好後，走到這個圓圈的碼是 100；2 和 3 共用 100 這段碼，到下一層才分開（2 = 1000、3 = 1001）。
- 圓圈只是過渡時期生出來的 internal node，上面的數字是它整棵 subtree 頻率的總和。
- 接著在 5、5、7、9、13 裡再抓最小的 5 和 5 合成 10，它也是一個虛擬字。每次都從 queue 抓 frequency 最小的兩個，直到結束。

### 程式：BinaryTree 的 merge 建構子與主迴圈

`BinaryTree` 類別的 private 部分有一個 `root`；每個 node 有 `weight`（頻率）。建構子 `BinaryTree(bt1, bt2)` 就是 merge：bt1、bt2 成為新 root 的左、右子樹，新 root 的 weight 是兩棵樹 root 的 weight 相加。

```cpp
BinaryTree::BinaryTree(BinaryTree& bt1, BinaryTree& bt2)
{   // merge：bt1、bt2 變成新 root 的左右子樹
    root = new TreeNode;
    root->leftChild  = bt1.root;
    root->rightChild = bt2.root;
    root->weight = bt1.root->weight + bt2.root->weight;
}

void Huffman(Queue& queue, int n)
{   // 一開始 queue 裡有 n 棵樹，每棵只有一個 node（一個 message）
    for (int i = 0; i < n - 1; i++) {          // 做 n-1 次 merge
        BinaryTree first  = DeleteMinWeight(queue);   // 最小
        BinaryTree second = DeleteMinWeight(queue);   // 第二小
        BinaryTree* bt = new BinaryTree(first, second);
        Insert(queue, *bt);                    // 合出來的樹放回 queue
    }
}
```

以 2、3、5、7、9、13 為例：第一圈 first、second 只是單一 node（2 和 3），合成 2 + 3 = 5 的小樹再 insert 回 queue；跑完 n − 1 = 5 圈，queue 只剩一棵 weight 39 的 Huffman tree。

也可以不數次數，改成檢查 queue：**queue 只剩一棵樹就停**（再取兩棵會失敗）。

`DeleteMinWeight`（從 queue 拿出 weight 最小的）怎麼做才快？答案是 **min heap**。

### 實作流程：統計 → min heap → 建樹 → 編碼

用 `Eerie eyes seen near lake.` 完整做一次。這是 binary tree 加 heap 的應用題。

**Phase 1：統計每個字元的 frequency。** 含空白和句點一共 26 個字元，大小寫分開算：

| 字元 | E | e | r | i | 空白 | y | s | n | a | l | k | . |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 次數 | 1 | 8 | 2 | 1 | 4 | 1 | 2 | 2 | 2 | 1 | 1 | 1 |

共 12 種字元，次數加總 1+8+2+1+4+1+2+2+2+1+1+1 = 26。這張表就是建樹的材料（實作上：開檔、scan 所有字元、統計）。

**Phase 2：建 Huffman tree。** 它本身是一棵 binary tree，建樹靠 priority queue，用的是 **minimum heap**，因為每次都要快速找出 frequency 最小的。

Huffman node 有四個欄位：

```cpp
struct HuffmanNode {
    char ch;                    // 代表的字元（merge 出來的 node 沒有字元）
    int  freq;                  // frequency
    HuffmanNode* left;          // 左小孩
    HuffmanNode* right;         // 右小孩
};
```

程式裡的 priority queue（例如叫 `MyQueue`）就是一個用 array 做的 heap。

### 把頻率表 insert 成 min heap

一開始手上只有一個個單一字元，各帶著自己的 frequency，把它們逐一 insert 進 min heap。min priority queue 的第一個位置 [1] 永遠放 frequency 最小的；每次 insert 完都要往上跟 parent 比，比 parent 小就交換，**次數相同的不用交換**。

依字元在句子中第一次出現的順序 insert（陣列 index 從 1 開始）：

```
insert E1 : [E1]
insert e8 : [E1, e8]                       8 比 parent 1 大，e 留在下面
insert r2 : [E1, e8, r2]
insert i1 : 放在 [4]，parent [2]=e8 比較大 → 交換；再跟 [1]=E1 比，一樣大不換
            [E1, i1, r2, e8]
insert 空4: [E1, i1, r2, e8, 空4]
insert y1 : [6] 的 parent [3]=r2 → 交換；跟 E1 一樣大不換
            [E1, i1, y1, e8, 空4, r2]
insert s2 : [E1, i1, y1, e8, 空4, r2, s2]
insert n2 : [8] 的 parent [4]=e8 → 交換；跟 [2]=i1 比不換
            [E1, i1, y1, n2, 空4, r2, s2, e8]
insert a2 : [9] 的 parent [4]=n2，一樣大不換
insert l1 : [10] 的 parent [5]=空4 → 交換；跟 [2]=i1 一樣大不換
            [E1, i1, y1, n2, l1, r2, s2, e8, a2, 空4]
insert k1 : [11] 的 parent [5]=l1，一樣大不換
insert .1 : [12] 的 parent [6]=r2 → 交換；跟 [3]=y1 一樣大不換

最後的 min heap：
index:  1   2   3   4   5   6   7   8   9   10  11  12
       E1  i1  y1  n2  l1  .1  s2  e8  a2  空4 k1  r2
```

調整完一定要符合 min heap 性質：root 永遠最小。heap 的 insert 和 delete 都要會自己寫（min heap、max heap 都要會）。

### Huffman 主迴圈

```cpp
while (heap 裡有兩個以上的 element) {
    HuffmanNode* z = new HuffmanNode;     // 1. 產生新的 node z
    z->left  = heap.DeleteMin();          // 2. 第一次 delete：最小的當左小孩
    z->right = heap.DeleteMin();          // 3. 第二次 delete：原本第二小的當右小孩
    z->freq  = z->left->freq + z->right->freq;
    heap.Insert(z);                       // 4. z 代表一棵小 subtree，放回 heap
}
// heap 只剩一個 node：它就是 Huffman tree 的 root
```

第一次 delete 拿到最小的 E1；delete 完 heap 會調整（最後一個 r2 搬到 [1]，往下跟較小的小孩交換），原本第二小的 i1 變成最小，第二次 delete 就拿到它：

```
delete E1 後：[i1, l1, y1, n2, k1, .1, s2, e8, a2, 空4, r2]
第二次 delete 拿到 i1
z = (E1 左, i1 右)，z->freq = 1 + 1 = 2，insert 回 heap
```

**成本**：n 個字元做 n − 1 輪，每輪幾次 heap 操作各 O(log n)，總共 **O(n log n)**。

### 例題：Eerie eyes seen near lake. 的完整合併過程

依 frequency 由小到大：E1 i1 y1 l1 k1 .1 r2 s2 n2 a2 空4 e8。每輪取最小的兩個，先取出的當左小孩：

| 輪 | 取出（左, 右） | 新 node | 合併後 queue 裡的東西 |
|---|---|---|---|
| 1 | E1, i1 | 2 = (E,i) | y1 l1 k1 .1 r2 s2 n2 a2 (E,i)2 空4 e8 |
| 2 | y1, l1 | 2 = (y,l) | k1 .1 r2 s2 n2 a2 (E,i)2 (y,l)2 空4 e8 |
| 3 | k1, .1 | 2 = (k,.) | r2 s2 n2 a2 (E,i)2 (y,l)2 (k,.)2 空4 e8 |
| 4 | r2, s2 | 4 = (r,s) | n2 a2 (E,i)2 (y,l)2 (k,.)2 空4 (r,s)4 e8 |
| 5 | n2, a2 | 4 = (n,a) | (E,i)2 (y,l)2 (k,.)2 空4 (r,s)4 (n,a)4 e8 |
| 6 | (E,i)2, (y,l)2 | 4 | (k,.)2 空4 (r,s)4 (n,a)4 (Eiyl)4 e8 |
| 7 | (k,.)2, 空4 | 6 | (r,s)4 (n,a)4 (Eiyl)4 6 e8 |
| 8 | (r,s)4, (n,a)4 | 8 | (Eiyl)4 6 e8 8 |
| 9 | (Eiyl)4, 6 | 10 | e8 8 10 |
| 10 | e8, 8 | 16 | 10 16 |
| 11 | 10, 16 | 26 | 只剩一棵 → 完成 |

12 種字元，merge 了 11 次（n − 1）。第 4 輪以後有多個同頻率的候選（例如第 7 輪有四個 4 可選），上表採用這個例子的經典取法；換別的取法樹會不同，但總長度一樣（見下一節）。做到 heap 只剩兩個時，它們各是一棵 subtree，頻率是 10 和 16；最後合併，root 是 26，正好是整句的字元數。

```
                        (26)
                 0/              \1
              (10)                (16)
           0/      \1          0/      \1
         (4)        (6)       e8        (8)
       0/   \1    0/   \1             0/     \1
     (2)    (2)  (2)   空4          (4)      (4)
    0/ \1  0/ \1 0/ \1             0/ \1    0/ \1
    E   i  y   l k   .             r   s    n   a
```

越常出現的字元（像 e）越靠近 root。

### 編碼：從 root 走到 leaf 就是碼

規則還是往左 0、往右 1。例如大寫 E：從 root 26 往左到 10（0），往左到 4（0），往左到 2（0），再往左到 E（0），所以 **E = 0000**。每個字元都在 leaf，從 root 走到它的路徑就是它的 Huffman code；每個 leaf 都走一次，就得到整張 **code table**：

| 字元 | 次數 | 碼 | 碼長 | 次數 × 碼長 |
|---|---|---|---|---|
| E | 1 | 0000 | 4 | 4 |
| i | 1 | 0001 | 4 | 4 |
| y | 1 | 0010 | 4 | 4 |
| l | 1 | 0011 | 4 | 4 |
| k | 1 | 0100 | 4 | 4 |
| . | 1 | 0101 | 4 | 4 |
| 空白 | 4 | 011 | 3 | 12 |
| e | 8 | 10 | 2 | 16 |
| r | 2 | 1100 | 4 | 8 |
| s | 2 | 1101 | 4 | 8 |
| n | 2 | 1110 | 4 | 8 |
| a | 2 | 1111 | 4 | 8 |
| 合計 | 26 | | | 84 |

E 和 i 只差最後一個 bit；出現 8 次的 e 只要 2 bits。

> **陷阱** 數碼長時要數清楚走了幾步：E 從 26 → 10 → 4 → 2 → E 走了四步，碼是 0000、i 是 0001，不是 000、001。

**編碼**就是照 code table，把句子每個字元換成它的 bits 接起來。例如開頭 `Eerie`：

```
E    e  r    i    e
0000 10 1100 0001 10   →  0000101100000110（16 bits；ASCII 要 5 × 8 = 40 bits）
```

### 壓縮效果：208 bits 降到 84 bits

- ASCII：26 個字元 × 8 bits = **208 bits**。
- Huffman：∑ 次數 × 碼長 = **84 bits**。

快算法：把所有 internal node 上的數字加起來，2 + 2 + 2 + 4 + 4 + 4 + 6 + 8 + 10 + 16 + 26 = 84（每個字元的次數會被它上面的每個 internal node 各算一次，次數正好等於碼長）。

> **陷阱** 有些教材寫這句話用 Huffman「只要 73 bits」，這是錯的。照這張頻率表，最佳就是 84 bits（理論下界 entropy 約 82 bits，不可能低到 73）。考試給頻率表時，自己算 ∑ 頻率 × 碼長。

從 208 降到 84，同一句話用更少的 bit 存，這就是 **compression（壓縮）**。

另一種粗略算法：如果簡化假設每個 code 都是 4 bits，則 4 × 26 = 104 bits，也比 208 少（實際照這棵樹是 84，因為高頻的 e 只用 2 bits）。

### Overhead：樹也要存

壓縮有沒有 **overhead（額外負擔）**？有：Huffman tree（codebook）也得存在檔案前面（header），不然對方解不開。所以實際檔案大小是「編碼後的 bits + X」，X 是存樹的空間（例如 104 + X）。字很少的短檔，壓了可能反而變大。

實作壓縮程式時要注意：

- 壓縮檔前面要有 **header** 存 Huffman tree，否則無法解碼後面的資料。
- 編出來的一串 0/1 要真正以 **byte** 寫進 binary 檔，不是把字元 '0'、'1' 寫成 .txt（那樣反而更大）。
- ZIP、RAR 等壓縮檔也是靠 codebook 把原檔還原；ZIP 常用的 DEFLATE 是 LZ77 再加上 Huffman coding，Huffman 是其中一部分。
- 建樹除了上面的迴圈寫法，也可以寫成 recursive 版本。

### 解碼：0 往左、1 往右，走到 leaf

收到一串 0 和 1，只要手上有那棵樹，解碼很簡單：

1. 從 root 出發，一個 bit 一個 bit 讀：讀到 0 往左，讀到 1 往右。
2. 一直走一定會走到某個 leaf，leaf 上的字元就是解出來的字，輸出它。
3. 回到 root，繼續讀下一個 bit。

> **例題** 解碼 `0010101101`。

```
讀 0 → 10，讀 0 → 4，讀 1 → (y,l) 的 2，讀 0 → y      輸出 y   回 root
讀 1 → 16，讀 0 → e                                    輸出 e   回 root
讀 1 → 16，讀 1 → 8，讀 0 → (r,s) 的 4，讀 1 → s       輸出 s
結果：yes
```

第一個 bit 是 1 時從 root 往右到 16，下一個是 0 就往左到小寫 e：`10 → e`。因為所有字元都在 leaf（prefix-free），不需要分隔符號。

### 再看一個應用：JPEG

Huffman tree 是資料壓縮裡非常重要、一種特別的 binary tree。它的 path 就像 full binary tree 的 path code：往左是 0，往右是 1。JPEG 影像裡就用到 Huffman tree：壓縮後的資料是一串 bit，順著 bit 沿 path 走，到 leaf 就 decode 出一個符號，再回 root。JPEG 解出來的是影像資料而不是 A、B、C 這種字母，但意思一樣。顯示一張照片，要從 root 走到 leaf 非常多次，寫 JPEG decoder 的核心工作就是不停地做這件事。

### Huffman tree 唯一嗎？

問：同樣的輸入（每個字元的 frequency），Huffman tree 只會有一種樣子嗎？Huffman code 呢？

答：**都不唯一**。頻率 1 的字元有很多個，為什麼一定是 E 先出來？l 或 k 先出來也可以，只要不違反 heap 的性質，次數一樣的誰先誰後都合法；左右子樹互換也算不同的樹。但每一種 Huffman tree 的總 bit 數（∑ 頻率 × 碼長）都一樣，都是最小的。

> **例題** 頻率 1、1、2、2。先合 1 + 1 = 2，此時有三個 2，挑哪兩個，樹就不同：

```
取法一：合兩個原本的 2           取法二：合 (1+1) 和一個原本的 2
          (6)                              (6)
        /     \                          /     \
     (2)       (4)                      2       (4)
     / \       / \                             /   \
    1   1     2   2                           2    (2)
                                                   / \
                                                  1   1
碼長：1,1,2,2 都是 2                碼長：2→1、2→2、1→3、1→3
總長 = (1+1+2+2)×2 = 12            總長 = 2×1 + 2×2 + 1×3 + 1×3 = 12
```

兩棵樹不一樣，總長都是 12。

## Binary search tree（BST，二元搜尋樹）

BST 是一種有大小規則的 binary tree：

1. **left subtree** 裡每個 node 都比 root 小。
2. **right subtree** 裡每個 node 都比 root 大。
3. 左、右 subtree 也都是 BST（每個 node 都要成立）。

課本預設 BST 裡的 key 互不相同。

```
        30
       /  \
      5    40
     /    /  \
    2    32   45
```

5、2 都比 30 小，40、32、45 都比 30 大，而且在每個 node 上都成立，所以這是 BST。

> **陷阱** 條件是「**整棵**左子樹 < root < **整棵**右子樹」，每個 node 都要成立，不是只跟自己的 parent 比。

常考題型：給兩棵樹，判斷哪一棵是 BST。如果某棵樹裡 25 的右下方出現 22，它就不是 BST：22 比 25 小，卻放在 25 的右邊。

### Search：比大小，一路往下走

給一個數字 x，問它在不在 BST 裡：先跟 root 比，小就往左、大就往右；到了下一層，做一模一樣的比較。

> **例題** 在上面那棵樹找 32：32 > 30 往右到 40；32 < 40 往左，找到 32。找 35：35 > 30 往右到 40；35 < 40 往左到 32；35 > 32 往右，是 null，找不到。

每一層做的事都一樣，所以 search 很自然寫成 recursive function：

```cpp
TreeNode* BST::Search(TreeNode* t, int x)   // 從 root 開始呼叫：Search(root, x)
{
    if (t == 0) return 0;                    // 空樹或走到 null：找不到
    if (x == t->data) return t;              // 找到，回傳這個 node
    if (x < t->data) return Search(t->leftChild, x);
    return Search(t->rightChild, x);         // 剩下的情況：x 比較大
}
```

不想用遞迴，可以用迴圈一路往下走（iterative 版本）：

```cpp
TreeNode* BST::IterSearch(int x)
{
    for (TreeNode* t = root; t; ) {
        if (x == t->data) return t;
        if (x < t->data) t = t->leftChild;
        else             t = t->rightChild;
    }
    return 0;                                // 走到 null，找不到
}
```

search 最多走樹的高度 h 步，時間 **O(h)**：平衡時約 O(log n)，歪成一條線時是 O(n)。

### Search by rank：第 k 小與 leftSize

除了找某個數字，也可以問：BST 裡排第 k 名的是誰（像排序後看名次）？這叫 **search by rank**。

> **例題** BST 裡有 60、70、65、80（60 是 root，70 是 60 的右小孩，65、80 是 70 的左右小孩），問第二大的數字是誰？

- 最笨的方法：traverse 整棵樹，把每個數字丟進 max heap，再 DeleteMax k 次。若 heap 剛好是 [80, 70, 65, 60]，第 2 格是 70，但那只是巧合，一般要 DeleteMax k 次才準。
- 其實連 heap 都不用：對 BST 做 **inorder traversal**，出來就是由小到大的順序（O(n)）。
- 課本的作法更聰明：在 node 裡多加一個欄位 **leftSize**，可以降到 O(h)。

**leftSize = 左子樹的 element 個數 + 1**（把自己也算進去），也就是這個 node 在「以自己為 root 的子樹」裡的名次。

```
      30 [3]
     /      \
   5 [2]    40 [2]
   /        /    \
 2 [1]   32 [1]  45 [1]
```

- 5：左子樹只有 2 一個 node，leftSize = 1 + 1 = 2。
- 2：沒有左子樹，leftSize = 0 + 1 = 1。
- 30：左子樹有 5、2 兩個，leftSize = 3。
- 40：左子樹只有 32，leftSize = 2。
- 32、45：沒有左小孩，leftSize = 1。

> **陷阱** 只看以這個 node 為 root 的左子樹。40 在 30 的右邊，但不能把 30 左邊的 node 算進 40 的 leftSize。

課本的 `Rank(k)` 找的是**由小到大第 k 個（第 k 小）**，考試照這個定義。

> **例題** 在上面的樹找第 5 小（k = 5）。由小到大是 2、5、30、32、40、45，答案應該是 40。

```
t = 30，leftSize = 3：最小的數到 30 為止只有 3 個，第 5 個不在左邊、也不是 30
        k = 5 > 3 → 往右，k = 5 − 3 = 2
t = 40，leftSize = 2：k = 2 = leftSize → 回傳 40
```

為什麼往右要減？右邊的 node 只記得自己左邊有幾個，不知道 30 那一邊（30 和它的左子樹）的 3 個，所以先扣掉，問題變成「在 40 這棵子樹裡找第 2 個」。往左走則 k 不用動，因為左邊的名次本來就從最小開始算。

> **重點** 口訣：**往右走就減 leftSize，往左走不用減**。

```cpp
TreeNode* BST::RankGet(int k)       // 找由小到大第 k 個
{
    TreeNode* t = root;
    while (t) {
        if (k == t->leftSize) return t;          // 例：找第 3 個，root 30 就是
        if (k < t->leftSize) t = t->leftChild;   // 往左，k 不變
        else {
            k -= t->leftSize;                    // 往右，先減
            t = t->rightChild;
        }
    }
    return 0;
}
```

思考題：leftSize 要怎麼決定、怎麼維護（期末考可能要寫出程式）？提示：insert 時，沿路**往左走**經過的每個 node，leftSize 都要加 1；delete 時對應地減 1。也可以先用 postorder 算出每棵子樹的大小，再設 leftSize = size(left) + 1。

### Insert：先 search，走到空位就放

insert 和 delete 都不能破壞 BST 左小右大的特質。insert 的作法就是 **search 走到 null 的那一格，把新 node 放進去**；會 search 就會 insert。

> **例題** 在下面的 BST 依序 insert 80、35。

```
原本            insert 80               insert 35
   30              30                      30
  /  \            /  \                    /  \
 5    40         5    40                 5    40
/               /       \               /    /  \
2              2         80            2    35   80
```

- 80：80 > 30 往右到 40；80 > 40 往右，是空的，放在這裡。
- 35：35 > 30 往右到 40；35 < 40 往左，是空的，放成 40 的 left child。

如果 search 時遇到一樣的 key：課本的 BST 不收重複 key，就不插入。

```cpp
bool BST::Insert(int x)
{
    TreeNode *p = root, *pp = 0;           // pp 是 p 的 parent
    while (p) {                            // 先 search
        pp = p;
        if (x == p->data) return false;    // 已存在，不插入
        if (x < p->data) p = p->leftChild;
        else             p = p->rightChild;
    }
    p = new TreeNode(x);                   // 走到 null：放在這裡
    if (!root) root = p;
    else if (x < pp->data) pp->leftChild = p;
    else                   pp->rightChild = p;
    return true;
}
```

### Delete：leaf、一個 child、兩個 child

最高準則一樣：**刪完以後，還要是一棵 BST**。課本完整分三種情況：

1. **刪 leaf**：直接移除。
2. **只有一個 child**：讓那個 child（整棵 subtree）接上來。
3. **有兩個 child**：用替身取代——取**左子樹最大**（inorder predecessor）或**右子樹最小**（inorder successor），兩種都可以。

**情況：只有一個 child。** node2 是 node1 的右小孩，node2 只有一棵 right subtree T2，現在要刪 node2：

```
   node1                 node1
   /    \                /    \
  T1    node2    →      T1     T2
           \
            T2
```

把 T2 整棵接上來補 node2 的位置。為什麼還是 BST？T2 本來就在 node1 右邊，裡面每個 node 一定都比 node1 大。

**情況：兩個 child。** 兩棵子樹總不能一起接上來。

> **例題** 在下面的 BST delete 60。60 底下一棵以 50 為 root，另一棵只有 70。

```
刪除前                               刪除後
          40                                  40
        /    \                              /    \
      20      60                          20      55
     /  \    /  \                        /  \    /  \
    10  30  50   70                     10  30  50   70
           /  \                                /  \
          45   55                             45   52
              /
             52
```

1. 去左子樹找最大的：從 50 一路往右走到底，是 55。
2. 把 55 拉上來取代 60：55 是左邊最大的，所以它比左邊全部都大，又比右邊的 70 小，放這裡剛好。
3. 55 走了以後，它原本的小孩 52 補上它的位置，整棵還是 BST。

也可以改取右子樹最小的（這裡是 70）來取代。替身（左子樹最大／右子樹最小）**最多只有一個 child**（左子樹最大的 node 不會有右小孩），所以把它從原位置刪掉時，又回到 leaf 或一個 child 的簡單情況。

### 插入順序決定樹的形狀

BST 一開始是空的，數字一個一個 insert 進來，**insert 的順序決定樹的形狀**。

> **例題** 1、2、3、…、10 由小到大依序 insert。

```
1
 \
  2
   \
    3
     \
      ...
        \
         10
```

1 先當 root；2 比 1 大放右邊；3 比 1、2 都大，又往右放；之後每一個都更大，一直往右接。結果是一棵往右歪的 **skewed tree**，高度 10。在它上面 search 要一個一個往下走，跟 linked list 沒兩樣，變成 **O(n)**。

同樣十個數字換個順序，例如 5、3、8、2、4、7、9、1、6、10，高度只有 4：

```
            5
          /   \
        3       8
       / \     / \
      2   4   7   9
     /       /     \
    1       6       10
```

要發揮 BST 降低 search 成本的好處，樹要比較 **balanced**。後面章節的 **AVL tree** 每插入一個就調整，讓每個 node 的左右子樹高度最多差 1，高度保證是 O(log n)，search 就一直很快。

## Selection tree：winner tree 與 loser tree

**selection tree（選擇樹）**有兩種：**winner tree** 和 **loser tree**。

### Winner tree：像比賽的賽程表

現在有 8 個 queue，叫 run1～run8（可以想成 8 個隊伍）。每個 run 裡的數字都已經由小排到大，最前面那個站在 leaf 上，後面的在排隊：

| run | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| 內容 | 10 15 16 | 9 20 38 | 20 20 30 | 6 15 25 28 | 8 15 50 | 9 11 16 | 90 95 99 | 17 18 20 |

上面就像比賽的賽程表：兩兩比，**小的勝出**往上走。這張賽程表本身是一棵 **complete binary tree**（node 依 heap 的方式編號 1～15，leaf 是 8～15）。

```
                        1: 6
                /                 \
           2: 6                     3: 8
         /      \                 /       \
     4: 9        5: 6         6: 8          7: 17
     /  \        /  \         /  \          /   \
    10   9     20    6       8    9       90     17
  run1 run2  run3  run4    run5 run6     run7   run8
```

- 第一輪：10 對 9 → 9，20 對 6 → 6，8 對 9 → 8，90 對 17 → 17。
- 勝者再跟勝者比：9 對 6 → 6，8 對 17 → 8。
- 最後 6 對 8 → 6。站在 root 的 6，就是所有 run 裡最小的數字。

每個 leaf 對應一個 run，run 裡排著一串排好的數字。

### 重賽與 O(n log k)

有了 winner tree，要把所有 run 合併成一個排好的序列，只要一直把 root 拿出來：

```
輸出 6。run4 的下一個數 15 補上 leaf 11。
沿 leaf 11 到 root 這條路重賽：
  node 5：15 對 20 → 15
  node 2：15 對 node 4 的 9 → 9
  node 1：9 對 node 3 的 8 → 8
新的 winner 是 8，下一個輸出它。
```

複雜度（k = run 的個數，這裡 k = 8；n = 全部 record 的筆數）：

- 一開始建好整張賽程表（setup）：**O(k)**。
- 每輸出一個，只沿一條路從 leaf 重賽到 root，樹高 log k：每次 **O(log k)**。
- n 筆都要輸出一次，merge 完所有 run：**O(n log k)**。

### Loser tree：node 裡放輸家

loser tree 是 winner tree 的小修改：winner tree 的 node 放贏家（比較小的數）；loser tree 的 node 放那場比賽的**輸家**（數字大的），最上面另外多一個 **node 0** 放總冠軍。

```
                      0: 6   （總冠軍）
                      1: 8
                /                \
           2: 9                    3: 17
         /      \                /       \
     4: 10       5: 20       6: 9         7: 90
     /  \        /  \        /  \         /   \
    10   9     20    6      8    9      90     17
```

例如 10 對 9，10 輸了，就留在 node 4。

好處在重賽：6 輸出後 15 上來，一路只跟 parent 存的輸家比，不用回頭找兄弟節點：

```
node 5 存 20：15 對 20 → 15 贏，20 留在 node 5
node 2 存 9 ：15 對 9  → 9 贏， 15 留在 node 2
node 1 存 8 ：9 對 8   → 8 贏， 9 留在 node 1
node 0 = 8（新的總冠軍）
```

winner tree 重賽時要讀兄弟節點的值；loser tree 只要和路徑上的 parent 比。

### 為什麼需要 winner tree：external sort

問：要從小排到大，直接 sort 不就好了？上面那些 run 加起來才二十幾個數字，全丟進 memory 排一排就好。

答：關鍵在**數字多到 memory 放不下**的時候。這時把資料切成 8 個 partition，每一塊自己 sort（每塊都夠小，保證放得進 memory），排好的每一塊就是一個 run；再建一棵 winner tree 來合併。這棵樹本身很小，用不到多少 memory，每個 run 一次只拿最前面的數字來比。partition 加 winner tree，就能排很大量的數字。

這對應到 **external sort（外部排序）**。sorting 分兩類：

- **internal sort**：資料全部放得進 memory。
- **external sort**：資料大到 memory 放不下，放在磁碟上；分段讀進來排成 run，再合併。

> **陷阱** external sort 指的是**一台機器、記憶體不夠**、資料在磁碟上，和「很多台電腦分著算」的分散式排序是兩回事。

（延伸：現在 big data 的資料量大到一台電腦存不下，需要分散式、雲端運算，例如 MapReduce，概念類似 divide and conquer。DS、OS 是這些的基礎。）

## Forest：很多棵樹也能變成一棵 binary tree

tree 是一棵樹，**forest（森林）**就是很多棵樹，正式定義是 **a set of disjoint trees**。

> **例題** 下面的 forest 有三棵樹，把它轉成一棵 binary tree。

```
     A          E          G
   / | \        |         / \
  B  C  D       F        H   I
```

方法跟前面的 **left child–right sibling** 一樣：左邊連第一個小孩，右邊連下一個兄弟。

1. 第一棵：A 的 left 連到第一個小孩 B，B 的兄弟 C、D 用 right 一個接一個串起來（B → C → D）。
2. E、F 與 G、H、I 也照做。
3. 三棵樹的 root A、E、G 也當成兄弟，用 right 串起來。

```
        A
       / \
      B   E
       \   / \
        C F   G
         \   /
          D H
             \
              I
```

為什麼要轉？這樣就不用為 forest 另外發展一套理論，binary tree 的技巧直接拿來用。

**Forest traversal**：

- **preorder**：每棵樹的 preorder 依序接起來：A B C D、E F、G H I → `A B C D E F G H I`。
- **inorder**：每棵樹的 inorder 依序接起來：B C D A、F E、H I G → `B C D A F E H I G`。（forest 的 inorder 是：先 inorder 第一棵樹 root 底下的子樹森林，再訪 root，再處理其餘的樹。）

這兩種剛好等於轉成 binary tree 後的 preorder、inorder；**postorder 沒有這種對應**。

## Disjoint sets：用 tree 表示集合

假設有三個 set，每個 set 是一堆數字，程式裡怎麼表示？每個 set 用一條 linked list 或一個 array 都可以；這裡介紹另一種：**用一棵 tree 表示一個 set**。

```
S1 = {0, 6, 7, 8}     S2 = {1, 4, 9}     S3 = {2, 3, 5}

      0                    4                  2
    ↗ ↑ ↖                ↗   ↖              ↗   ↖
   6  7  8              1     9            3     5
```

- root 是這個 set 的某一個 element：S1 以 0 為 root，6、7、8 都指到 0；S2 以 4 為 root；S3 以 2 為 root。
- 注意箭頭是 **child 往上指 parent**（parent pointer），和一般 binary tree 往下指相反；0 有 3 個小孩，所以不一定是 binary tree。
- 這些 set 是 **disjoint（互斥）**：任兩個 Sᵢ、Sⱼ 的交集都是空集合，一個數字只會在一個 set 裡。

### 兩種運算：find 與 union

- **union**：把兩個 set 合成一個更大的 set。
- **find(i)**：給一個數字 i，問它屬於哪個 set。例如 3 屬於 S3，8 屬於 S1。

每個 set 有名字，所以另外有一張表記 **set name**（S1、S2、S3），set name 有 pointer 指到該 set 的 root，root 也指回來（雙向）。

> **例題** find(3)：找到 3，一路往上走到 root 2，再透過 root 對到 set name，答案 S3。find(7)：7 往上到 root 0，反查得到 S1。

**union** 的做法：把一個 set 的 root 直接接到另一個 set 的 root 底下。union(S1, S2) 有兩種合法結果：

```
第一種：S2 當 S1 的 child          第二種：S1 當 S2 的 child
         0                                 4
      ↗ ↑ ↑ ↖                           ↗  ↑  ↖
     6  7  8  4                        1   9   0
            ↗   ↖                            ↗ ↑ ↖
           1     9                          6  7  8
```

哪一種比較好？要看之後做什麼 operation（不外乎 find 或 union）。如果常做 find(1)、find(9)：第一種要從 1 到 4、再到 0，走兩個 hop；第二種只要一個 hop 就到 root 4，馬上查到 set name。所以沒有絕對，要看每個元素被 find 的頻率；課本給的規則是後面的 weighting rule。

### Parent array：一個陣列就夠

剛剛畫成樹的 set，用一個 array 就能表示：**index 是 element，格子裡存它的 parent；-1 代表它是 root**。

```
index  :  0   1   2   3   4   5   6   7   8   9
parent : -1   4  -1   2  -1   2   0   0   0   4
```

- 0、2、4 是 root：parent[0] = parent[2] = parent[4] = -1。
- 6、7、8 都掛在 0 底下：parent[6] = parent[7] = parent[8] = 0。
- 9 的 parent 是 4，parent[9] = 4；parent[1] = 4；parent[3] = parent[5] = 2。

> **例題** 用 array 做 find(7)。

```
parent[7] = 0 → 去看 0 那格
parent[0] = -1 → 到 root 了，root 是 0
再查 set name 表：root 0 對到 S1
```

要回答是 S1、S2 還是 S3，還需要另一張表記每個 root 對應的 set name。

**在 array 上 union**：例如 union 0 和 4，讓 4 那棵接到 0 底下，只要改一個數字：

```
index  :  0   1   2   3   4   5   6   7   8   9
union前: -1   4  -1   2  -1   2   0   0   0   4
union後: -1   4  -1   2   0   2   0   0   0   4      ← 只有 parent[4]: -1 → 0
```

只有被合併那棵的 root 要改，1、9 還是指向 4，都不用動。union 完做 find(1)：

```
parent[1] = 4 → parent[4] = 0 → parent[0] = -1：root 是 0，查表得 S1
```

> **陷阱** find 一定要一路走到 root，不能只看 parent[i] 一層（parent[1] = 4，但 4 已經不是 root 了）。另外，課本的 union(i, j) 假設傳進來的 i、j 都是 root；要合併任意兩個元素所在的 set，先各自 find 到 root 再 union。

array 表示法的好處是只讀、改陣列裡的數字，不用讓 pointer 指來指去。node + pointer 與 array 兩種表示法的優缺點要自己比較（期末可能考）。提示：array 版需要 element 是 0～n−1 的編號（或先轉成編號），pointer 版每個 node 要多存指標。

### 最糟的 union 順序：長成一條直線

> **例題** 0 到 n−1 一開始各自是一個 set，依序做 union(0,1)、union(1,2)、…、union(n−2, n−1)（每次讓後者當 root）。

以 n = 5 為例，parent array 的變化：

```
index        :  0   1   2   3   4
初始          : -1  -1  -1  -1  -1
union(0,1)   :  1  -1  -1  -1  -1
union(1,2)   :  1   2  -1  -1  -1
union(2,3)   :  1   2   3  -1  -1
union(3,4)   :  1   2   3   4  -1

形狀：0 → 1 → 2 → 3 → 4（root）
```

結果長成一條直線：最下面是 0，最上面的 root 是 n−1。

- union：每次 O(1)，n−1 次總共 **O(n)**。
- 接著做 find(0)、find(1)、…：find(0) 要從最底下一路爬到 root，經過 n 個 node；find(1) 經過 n−1 個……只有 find(n−1) 一步就到。整串 find 的總時間約 n + (n−1) + … ≈ n²/2（課本寫成 ∑ᵢ₌₂ⁿ i），是 **O(n²)**。

> **陷阱** O(n²) 是「整串 n 個 find」的總成本；單次 find 最差是 O(n)。

這樣 find 太貴了，要想辦法別讓樹長成一直線。

### Weighting rule：node 少的接到 node 多的

**weighting rule for union(i, j)**：如果以 i 為 root 的樹 node 數比以 j 為 root 的少，就讓 j 當 root（i 接到 j 底下）；否則讓 i 當 root。一句話：**node 少的，歸到 node 多的那邊**。

> **陷阱** 比的是兩棵樹的 node 數（要先 find 到 root 再比），不是比數字大小。

實作上，課本把 node 數用負數存在 root 的 parent 欄位：-4 代表「我是 root，這棵有 4 個 node」。

> **例題** 用 weighting rule 重做 union(0,1)、union(1,2)、union(2,3)。

```
index         :  0   1   2   3
初始           : -1  -1  -1  -1     每棵都只有 1 個 node
union(0,1)    : -2   0  -1  -1     一樣大，選 0 當 root
union(1,2)    : -3   0   0  -1     find(1) = 0，那棵 2 個 node > {2} 的 1 個 → 2 接到 0
union(2,3)    : -4   0   0   0     find(2) = 0，那棵比較大 → 3 接到 0
```

```
        0
     ↗  ↑  ↖
    1   2   3
```

樹不會變直線，而是被**打平**：root 0 底下直接掛所有 node，每次 find 一步就到。

### Weighted union 的高度上界

- union 本身沒差：單次還是 O(1)，總共 O(n)。
- find 有改進。**Lemma**：用 weighting rule 建出、有 m 個 node 的樹，高度不超過 **⌊log₂m⌋ + 1**（證明見課本）。
- find 只要走樹的高度，所以一次 find 是 **O(log m)**。

什麼時候樹最高？每次都是**一樣大的兩棵**合併的時候。

> **例題** 0～7 一開始各自一個 set，先兩兩 union，再兩組兩組合，最後合成一棵。node 數相同時選左邊的 root。

```
index                    :  0   1   2   3   4   5   6   7
初始                      : -1  -1  -1  -1  -1  -1  -1  -1
union(0,1)               : -2   0  -1  -1  -1  -1  -1  -1
union(2,3)               : -2   0  -2   2  -1  -1  -1  -1
union(4,5)               : -2   0  -2   2  -2   4  -1  -1
union(6,7)               : -2   0  -2   2  -2   4  -2   6
union(0,2)               : -4   0   0   2  -2   4  -2   6
union(4,6)               : -4   0   0   2  -4   4   4   6
union(0,4)               : -8   0   0   2   0   4   4   6
```

```
               0
          ↗    ↑    ↖
         1     2      4
               ↑    ↗   ↖
               3   5     6
                         ↑
                         7
```

{0,1,2,3} 以 0 為 root，{4,5,6,7} 以 4 為 root，最後把 4 接到 0。最深的 7 要走 7 → 6 → 4 → 0，樹高 4 層，剛好等於 ⌊log₂8⌋ + 1 = 4，就是上界。

### Collapsing rule：find 時順便把路壓平

weighting rule 只看 node 數，沒考慮之後的 find（query）。

> **例題** 在上面那棵 8 個 node 的樹上，做 8 次 find(7)。

- 不調整：每次 find(7) 都走 7 → 6 → 4 → 0 三步，8 × 3 = **24** 步。
- 改法：第一次 find(7) 走 3 步，走完順便把 7 和路上的 6 直接改指 root 0；之後 7 次都一步就到，共 3 + 7 = **10** 步，cost 少了一半以上。

```
find(7) 前：parent = [-8, 0, 0, 2, 0, 4, 4, 6]
find(7) 後：parent = [-8, 0, 0, 2, 0, 4, 0, 0]     ← parent[6]、parent[7] 改成 0

               0
        ↗   ↗  ↑  ↖   ↖
       1   2   4   6   7
           ↑   ↑
           3   5
```

這就是 **collapsing rule**：做 find(i) 時，把 i 到 root 路徑上的**每個 node 都直接改指 root**。課本把第一次 find 後重設 link 的成本也算進去，數字會比 10 多一點（課本記為 13 moves），但結論一樣，遠少於 24。

> **陷阱** 課本的 collapsing find 是**每次 find 都壓平**，不需要先知道誰常被查。

```cpp
int Sets::CollapsingFind(int i)
{   // 先找到 root，再把 i 到 root 路上的每個 node 直接指向 root
    int r;
    for (r = i; parent[r] >= 0; r = parent[r]);   // 找 root（root 的 parent 是負數）
    while (i != r) {
        int s = parent[i];
        parent[i] = r;
        i = s;
    }
    return r;
}
```

### 延伸：預測 query、依查詢頻率建樹

weighting rule 建出的樹只看 node 數，本身沒有不好，但可以更好：可以根據使用者的 find，結構性地調整樹（像把常查的 7 拉上去）。

- 但「find(7) 會做 8 次」是看了 query log 才知道的，有點事後諸葛。online 的時候，第一次 find(7) 出現，無法保證後面還有 7 次。難處在於要即時 **predict** 未來的 query；一種做法是看歷史，例如統計過去一個月的 log，find(7) 出現後通常還跟著幾次。
- 「find(7) 後常跟著 7 次」其實是個機率，而且每個數字都有自己的統計。問題變成：**給每個數字和它被查的機率，造一棵期望 cost 最小的樹**（常被查的放 root 附近）。例如觀察 30 天，1 佔了 90% 的 query、2 約 5%，其他更少，那 1 就該在 root。這類思考題期末可能出；課本裡對應的正式題目是之後的 **optimal binary search tree**。
- 類比：網路看電影，熱門電影常被看，就多複製幾份放到看的人旁邊。片子只放在台大的 node，交大的人要跑三個 hop；交大也放一份，一個 hop 就到。P2P 複製熱門內容跟調整樹的結構本質一樣：讓常用的東西離使用者近一點。

> **觀念** 這段是延伸討論。考試的 collapsing rule 不需要預測，每次 find 都做。

## 用 union-find 求 equivalence class

set operation 可以拿來求 **equivalence class（等價類）**，把彼此有關係的數字分成同一組：**i ≡ j 就代表 i、j 在同一個 set，把它們 union 起來**。遞移關係（例如 1≡2、2≡3 推出 1≡3）union 自動就處理好了。

> **例題** n = 12（數字 0～11），pairs：0≡4、3≡1、6≡10、8≡9、7≡4、6≡8、3≡5、2≡11、11≡0。求所有 equivalence class。

作法：0～11 先各自當一個 set，再一對一對處理：對 i≡j，先 find(i)、find(j) 找到兩個 root，若不同就 union（這裡用 weighting rule，一樣大時讓前一個的 root 當 root；root 以 -1 表示，node 數另外記）。

```
index        :  0   1   2   3   4   5   6   7   8   9  10  11
初始          : -1  -1  -1  -1  -1  -1  -1  -1  -1  -1  -1  -1
0≡4          : -1  -1  -1  -1   0  -1  -1  -1  -1  -1  -1  -1
3≡1          : -1   3  -1  -1   0  -1  -1  -1  -1  -1  -1  -1
6≡10         : -1   3  -1  -1   0  -1  -1  -1  -1  -1   6  -1
8≡9          : -1   3  -1  -1   0  -1  -1  -1  -1   8   6  -1
7≡4          : -1   3  -1  -1   0  -1  -1   0  -1   8   6  -1
6≡8          : -1   3  -1  -1   0  -1  -1   0   6   8   6  -1
3≡5          : -1   3  -1  -1   0   3  -1   0   6   8   6  -1
2≡11         : -1   3  -1  -1   0   3  -1   0   6   8   6   2
11≡0         : -1   3   0  -1   0   3  -1   0   6   8   6   2
```

逐步說明：

- 7≡4：先 find(4)：parent[4] = 0，parent[0] = -1，root 是 0（這棵有 0、4 兩個 node）；7 自己一個，所以把 parent[7] 設成 0。
- 6≡8：root 6 那棵 {6,10} 和 root 8 那棵 {8,9} 一樣大，讓 8 接到 6：parent[8] = 6。
- 3≡5：3 的 root 是 3（{1,3}），5 接進來：parent[5] = 3。
- 11≡0：find(11) = 2（{2,11}，2 個 node），find(0) = 0（{0,4,7}，3 個 node），小的接到大的：parent[2] = 0。

最後剩下三個 root（0、3、6），每個 set 就是一個 class：

```
root 0：{0, 2, 4, 7, 11}      （11 → 2 → 0）
root 3：{1, 3, 5}
root 6：{6, 8, 9, 10}         （9 → 8 → 6）
```

用 array 實作很方便：像 7≡4 要知道 4 的 root，直接查表 parent[4] = 0、parent[0] = -1，再把 parent[7] 設成 0 就好，比用 linked list 一個一個找快。

### 兩種解法的比較

同一個問題（給 number pairs，輸出 equivalence classes）有不同解法，要會分析各自的優缺點和 complexity：

| 解法 | 作法 | 複雜度 |
|---|---|---|
| 前面 linked list 章節的解法 | 兩個 phase：先替每個數字建 linked list，記下跟它有關的數字；再用 stack 把遞移的關係找出來 | O(m + n)（m 個 pair、n 個數字） |
| union-find | 掃過所有 pair，每對做 find + union | 配上 weighting rule 和 collapsing rule 幾乎是線性（課本用 Ackermann 函數的反函數 α 表示，實務上視為常數） |

### Set 的表示為什麼還算 tree

set operation 用 array 表示，是因為 root 和 parent 的關係很好寫。它跟 tree 的關係：它也有 root，只是 pointer 方向不同——一般 tree 是 parent 往下指，這裡是 child 往上指。改成往下指（root 指向 set 裡的 element）基本上也做得到；箭頭方向顛倒不影響本質，所以它仍然屬於 tree 的範疇。

## 本章收尾：考試重點

heap 也是一種 tree，各種 tree 的特質都要知道。

1. **heap 和 binary search tree 的規則**，以及它們的 **insert、delete** 一步一步怎麼調整（考試會要你畫出每一步）。
2. **tree 的 traversal**：preorder、inorder、postorder、level order。traversal 的用途：copy 一棵 tree、判斷兩棵 tree 是否相等、**expression evaluation**（例如用 postorder 算出運算式的值）。

一句話收尾：各種 tree 的 insert、delete，以及 traversal 和它的應用。

## 重點整理
- Tree = root + n 棵互不相交的 subtree（遞迴定義）；一般 tree 至少一個 node，不能是空的；遞迴要有終止條件
- Ordered tree：subtrees 有順序（sequence），子樹對調算不同的樹；unordered：subtrees 是 set
- Level 兩種慣例：root = level 0 或 level 1（課本／考試用 level 1）；height = 最大 level，同一棵樹兩種算法差 1
- Degree of node = 指出去的 child 數（被指到的不算）；degree of tree = 最大的 node degree
- Leaf（external node）= 沒有小孩的 node；只要有小孩就不是 leaf；sibling 必須同一個 parent（同層不同 parent 是 cousin）
- k-ary tree 每 node 開 k 個 pointer：共 nk、用 n−1、null = n(k−1)+1；binary tree 的 null link = n+1
- LCRS：左 = 第一個 child、右 = 下一個 sibling；任何 ordered tree 可轉 binary tree，且 root 的右子樹必為空
- Binary tree：可為空、左右有別、degree ≤ 2；「只有左孩子 B」與「只有右孩子 B」是不同的 binary tree
- root 為 level 1：第 i 層最多 2^(i−1) 個 node；深度 k 最多 2^k − 1 個 node
- root 為 level 0：高度 h 時 h+1 ≤ n ≤ 2^(h+1) − 1；n 個 node 時 ⌈lg(n+1)⌉ − 1 ≤ h ≤ n − 1
- n 個 node 的 complete binary tree 深度（root level 1）= ⌈log₂(n+1)⌉
- 搜尋成本與樹高成正比：矮樹約 log n（best），歪斜樹 n−1 退化成 linked list（worst）；要壓低高度
- 非空 binary tree：n₀ = n₂ + 1（證明：n = n₀+n₁+n₂、n = B+1、B = n₁+2n₂）
- Full binary tree（課本）：深度 k 有 2^k − 1 個 node 全滿；有些英文教材的 full 指每個 node 有 0 或 2 個 child
- Complete binary tree：node 剛好對應 full tree 的編號 1..n，中間不能有洞
- Path code：編號 = 1 後接路徑（左 0、右 1）的二進位；接 0 = ×2、接 1 = ×2+1
- Array 表示（1-based）：left 2i、right 2i+1、parent ⌊i/2⌋；0-based：2i+1、2i+2、⌊(i−1)/2⌋
- 歪斜樹放 array 浪費：左歪深度 k 最後在 2^(k−1)；右歪要 2^k − 1 格
- Linked 表示：找 child 容易、找 parent 難（從 root 往下、用兩個 pointer，或加 parent 欄位）
- Array vs linked：array 找 parent 快、insert/delete 要搬資料、不 complete 時浪費；linked 用多少開多少、insert/delete 改 pointer
- Expression tree：internal node 放 operator、leaf 放 operand，subtree 代表括號；(3+5)×(2−(7+4)) = −72
- 三種走訪看 V（root）的位置：preorder = VLR、inorder = LVR、postorder = LRV；固定先左後右
- preorder 第一個、postorder 最後一個一定是 root
- 畫線法：底線上從 node 左邊／正下方／右邊拉線（不交叉），由左往右讀 = pre／in／post
- 運算式樹：inorder = infix、preorder = prefix、postorder = postfix；level order 一層一層由左到右
- 遞迴走訪連 null 也呼叫一次：n 個 node 共 2n + 1 次呼叫
- 非遞迴 inorder 用 stack（一路往左 push，走不下去 pop 印出，再往右）；level order 用 queue，先放左子再放右子，順序不能換
- Copy 左右都要遞迴（不能只做 pointer assignment）；課本稱 modified postorder
- Equal：兩個都空 → true；否則 a && b && data 相同 && 左相同 && 右相同（&& 會短路）
- similar：結構相同、資料可不同；equivalent：結構與資料都相同
- 單一走訪不能決定唯一 binary tree；inorder + preorder、inorder + postorder 可以；preorder + postorder 一般不行
- 3 個 node 的 distinct binary tree 有 5 種（preorder 相同時 inorder 各不同）
- Satisfiability：n 個變數試 2ⁿ 組，每組 postorder 求值一次，O(g · 2ⁿ)；運算優先 not > and > or
- PostOrderEval：node 有 leftChild、data、value、rightChild；運算拿孩子的 value，not 只用 rightChild；答案在 root 的 value
- 用 tree 做 expression evaluation：先建樹、再 postorder 求值（一個 phase；stack 法要兩個 phase）
- n 個 node 的 binary tree 有 2n 個 link，用掉 n − 1 個，null link 有 n + 1 個
- Threaded tree：空 leftChild 指 inorder predecessor、空 rightChild 指 inorder successor；leftThread／rightThread 為 true 表示是 thread；兩端懸空的 thread 指向 head node
- Threaded tree 的 inorder 不需 stack、不需遞迴，O(n)；代價是多兩個 Boolean 欄位、insert/delete 要多調 thread
- 在 threaded tree 把 R 插成 X 的右子：R 接手 X 原本的右 link 與 rightThread，R.leftThread 指回 X，X.rightThread = false；若 X 原有右子樹，該子樹 inorder 第一個 node 的 left thread 改指 R
- Priority queue：max PQ 刪最大、min PQ 刪最小；PQ 是 ADT，heap 是常用實作
- unordered：insert O(1)、delete O(n)；sorted：insert O(n)、delete O(1)；heap：兩者都 O(log n)
- Max heap：每個 node 的 key ≥ children 的 key，且是 complete binary tree；左右之間不比大小（與 BST 不同）
- Heap 用 array 從 [1] 存：parent(i) = ⌊i/2⌋，children = 2i、2i + 1
- Insert：放在最後一格（n+1），bottom-up 跟 parent 比，parent 往下搬，最後才放 x；O(log n)
- deleteMax：取 heap[1]，k = heap[n]、n−−，top-down 跟較大的 child 比（j++ 前先確認 j < n）；O(log n)
- 刪除／搜尋 heap 中任意元素：scan O(n) + 調整 O(log n) = O(n)
- Heap sort：建 heap（逐一 insert，O(n log n)；heapify 可 O(n)）+ delete n 次，總 O(n log n)
- ASCII 是 fixed length coding（標準 7 bits，通常存成 8 bits）；Huffman 是依頻率的 variable length coding：越常出現碼越短
- Huffman 目標：weighted external path length ∑ 頻率 × 碼長 最小；所有字元都在 leaf，所以是 prefix(-free) code，解碼不需分隔符號
- 建 Huffman tree：每次從 min heap 取 frequency 最小的兩個 merge（先取出的當左小孩），新 node 頻率 = 兩者相加，放回 heap；bottom-up；n 個字元 merge n − 1 次，總時間 O(n log n)
- 讀碼：往左 0、往右 1；解碼：從 root 照 bit 走到 leaf 輸出字元，再回 root
- 「Eerie eyes seen near lake.」：26 字元，ASCII 208 bits，Huffman 84 bits（= 所有 internal node 數字的和）
- Huffman tree／code 不唯一（同頻率取法、左右互換），但總長度都相同且最小
- 壓縮有 overhead：Huffman tree 要存在檔案 header
- BST：整棵左子樹 < root < 整棵右子樹，每個 node 都成立；search／insert／delete 都是 O(h)，平衡 O(log n)，skewed O(n)
- BST 的 inorder 是由小到大
- leftSize = 左子樹 node 數 + 1；Rank(k) 找第 k 小：k = leftSize 回傳，k < leftSize 往左（k 不變），否則 k −= leftSize 往右
- BST insert：search 走到 null 的位置放新 node；重複 key 不插入
- BST delete：leaf 直接刪；一個 child 讓 child 接上；兩個 child 用左子樹最大或右子樹最小取代（替身最多一個 child）
- 依序插入已排序資料 → skewed tree，高度 n；AVL tree 保證高度 O(log n)
- Winner tree：complete binary tree，小的勝出，root 是最小值；setup O(k)，每次重賽 O(log k)，合併 k 個 run 共 n 筆 O(n log k)
- Loser tree：node 存輸家，node 0 存總冠軍；重賽只跟路徑上的 parent 比，不用讀兄弟
- External sort：資料大於 memory，分段排序成 run，再用 winner／loser tree 合併
- Forest → binary tree：left child–right sibling，各棵樹的 root 互為兄弟；forest 的 preorder／inorder = 轉換後 binary tree 的 preorder／inorder，postorder 沒有對應
- Disjoint set 用 tree 表示，pointer 由 child 指向 parent；parent array：parent[i] 存 parent，root 存 -1（或 −node 數）
- union：一棵的 root 接到另一棵 root 底下，O(1)；find：一路走到 root
- 直線最差情況：n − 1 次 union O(n)，整串 find O(n²)（單次 O(n)）
- Weighting rule：node 少的接到 node 多的；m 個 node 的樹高度 ≤ ⌊log₂m⌋ + 1，find O(log m)；等大兩棵合併時達到上界
- Collapsing rule：find 時把路徑上每個 node 直接改指 root（每次都做）；8 次 find(7)：24 步 → 10 步（課本算法 13 moves）
- Equivalence class：i ≡ j 就 union；union-find（weighted + collapsing）近乎線性（α），linked list + stack 解法 O(m + n)
- 本章考點：heap、BST 的 insert／delete 步驟；traversal 及其應用（copy、判斷相等、expression evaluation）

## 名詞對照
| 中文 | English |
|---|---|
| 樹 | tree |
| 階層 | hierarchical |
| 節點 | node |
| 樹根 | root |
| 子樹 | subtree |
| 遞迴定義 | recursive definition |
| 終止條件 | termination condition |
| 有序樹 | ordered tree |
| 層 | level |
| 深度 | depth |
| 高度 | height |
| 樹葉 | leaf |
| 外部節點 | external node |
| 內部節點 | internal node |
| 父節點 | parent |
| 子節點 | child |
| 兄弟節點 | sibling |
| 祖先 | ancestor |
| 子孫 | descendant |
| 路徑 | path |
| 分支度 | degree |
| k 元樹 | k-ary tree |
| 左子右兄弟表示法 | left-child right-sibling (LCRS) representation |
| 二元樹 | binary tree |
| 空指標 | NULL link |
| 歪斜樹 | skewed binary tree |
| 完滿二元樹 | full binary tree |
| 完全二元樹 | complete binary tree |
| 層序 | level order |
| 路徑碼 | path code |
| 分支 | branch |
| 剖析樹 | parse tree |
| 運算式樹 | expression tree |
| 運算子 | operator |
| 運算元 | operand |
| 換手 | handoff |
| 走訪 | traversal |
| 前序 | preorder |
| 中序 | inorder |
| 後序 | postorder |
| 階層順序走訪 | level order traversal |
| 拜訪 | visit |
| 中序式／前序式／後序式 | infix／prefix／postfix |
| 遞迴函式 | recursive function |
| 堆疊 | stack |
| 佇列 | queue |
| 先進先出 | first in first out (FIFO) |
| 後進先出 | last in first out (LIFO) |
| 相似 | similar |
| 等價 | equivalent |
| 最長共同子序列 | longest common subsequence (LCS) |
| 運算子多載 | operator overloading |
| 指標指定 | pointer assignment |
| 短路求值 | short-circuit evaluation |
| 相異二元樹 | distinct binary tree |
| 命題邏輯運算式 | propositional calculus expression |
| 可滿足性問題 | satisfiability problem |
| 引線二元樹 | threaded binary tree |
| 引線 | thread |
| 中序前行者 | inorder predecessor |
| 中序後繼者 | inorder successor |
| 首節點 | head node |
| 優先佇列 | priority queue |
| 最大優先佇列／最小優先佇列 | max priority queue／min priority queue |
| 抽象資料型態 | abstract data type (ADT) |
| 堆積 | heap |
| 最大堆積／最小堆積 | max heap／min heap |
| 二元搜尋樹 | binary search tree (BST) |
| 由下往上 | bottom-up |
| 由上往下 | top-down |
| 瓶頸 | bottleneck |
| 堆積排序 | heap sort |
| 霍夫曼編碼 | Huffman code / Huffman coding |
| 霍夫曼樹 | Huffman tree |
| 編碼 | encode |
| 解碼 | decode |
| 固定長度編碼 | fixed length coding |
| 變動長度編碼 | variable length coding |
| 頻率 | frequency |
| 碼書 | codebook |
| 碼表 | code table |
| 前綴碼 | prefix code / prefix-free code |
| 目標函數 | objective function |
| 加權外部路徑長 | weighted external path length |
| 最小堆積 | min heap |
| 貪婪 | greedy |
| 壓縮 | compression |
| 額外負擔 | overhead |
| 依名次搜尋 | search by rank |
| 左子樹大小欄位 | leftSize |
| 中序前驅／中序後繼 | inorder predecessor / inorder successor |
| 歪斜樹 | skewed tree |
| 平衡 | balanced |
| AVL 樹 | AVL tree |
| 選擇樹 | selection tree |
| 勝者樹 | winner tree |
| 敗者樹 | loser tree |
| 順串 | run |
| 內部排序 | internal sort |
| 外部排序 | external sort |
| 森林 | forest |
| 左子右兄弟表示法 | left child–right sibling |
| 互斥集合 | disjoint sets |
| 聯集 | union |
| 尋找 | find |
| 父節點陣列 | parent array |
| 加權規則 | weighting rule |
| 壓縮路徑規則 | collapsing rule |
| 等價類 | equivalence class |
| 最佳二元搜尋樹 | optimal binary search tree |
