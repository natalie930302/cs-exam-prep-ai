# 最大流 / 二分圖匹配

Network flow 問的是：一張每條邊都有容量的有向圖，從 source 最多能送多少東西到 sink。這一章從 flow network 的定義和兩個限制出發，學會用 residual graph 找 augmenting path、靠「退水」修正錯誤選擇的 Ford-Fulkerson 演算法，再證明它的正確性、分析 O(mC) 的時間，最後用 max-flow min-cut theorem 說明「最大流 = 最小割」，並把二分圖匹配轉成最大流來解。考試最常考：手畫 residual graph 一輪一輪跑 Ford-Fulkerson、找出 min cut、說明 forward／backward edge，以及把匹配問題建成 flow network。

## 學完這章要會

- 寫出 flow network、s-t flow、v(f) 的定義，檢查 capacity constraint 與 conservation constraint。
- 算任一個 s-t cut 的 capacity（只算 A → B 方向的邊），知道每個 cut 都是 max flow 的上界。
- 由目前的 flow 建出 residual graph G_f（forward edge 記 c − f、backward edge 記 f）。
- 找 augmenting path、算 bottleneck，沿路更新原圖的 flow，一輪一輪跑到 G_f 裡 s 走不到 t。
- 跑完後用「s 走得到的點」找出 min cut，並驗證 max flow = min cut。
- 證明 Ford-Fulkerson 每一輪都產生合法的 flow、flow 嚴格變大、整數容量下一定停。
- 說明 O(mC) 為什麼是 pseudo-polynomial，舉出「200 輪對 2 輪」的壞例子，知道挑 path 的改進（Edmonds-Karp、Δ-scaling）。
- 寫出 max-flow min-cut theorem 的三個等價敘述並完成證明（含 weak duality）。
- 把二分圖匹配建成 flow network（容量全為 1），用 alternating path 讓匹配多一對。

## Flow network：圖裡有東西在流

**Network flow（網路流）**處理的對象叫 **flow network（流網路）**：它是一張圖（graph），只是想像圖裡有「東西」從某些點出發、沿著邊流到別的點。只要問題裡有東西在流，就能畫成 flow network。

- **水管網路（water pipes）**：最直覺的例子。很多管子接在一起，管子是邊，管子裡的水就是 **flow（流量）**。
- **Transportation network（運輸網路）**：道路、鐵路上流的是車和人；運輸管理領域很多問題都用它來解。
- **Computer network（電腦網路）**：資料被切成一個個 **packet**，在網路線上流來流去。
- **Circuit network（電路）**：導線裡流的是電流，也可以看成一種流動。

> **例題** 早期的實際問題：1955 年，蘇聯每天要用鐵路把大批工人運到東歐的工廠，問鐵路運量夠不夠。左邊是蘇聯、右邊是東歐，中間整片鐵路網就是一個 transportation network，車廂裡載的是人。
> 這裡的鐵路**沒有方向**：可以運過去，也可以運回來。每一小段鐵路在一段時間內最多能運多少，就是那段鐵路的 **capacity（容量）**。有了每段的上限，就能算出整個鐵路網一天最多運多少：當年算出大約 163,000。（常被說成「人次」；原始研究 Harris & Ross（1955）算的其實是每天約 163,000 噸的貨運量。）

Network flow 本身的內容多到可以寫成一整本書。這個領域的經典名著作者是經濟系教授；做最佳化（optimization）的專家，多半在數學系和經濟系。

## 定義：有向圖加上容量

把鐵路的例子一般化。先看一個小例子：四個點 s、a、b、t，五條邊。

```
          a
     2 ↗  │  ↘ 1
    s     │3    t
     1 ↘  ↓  ↗ 2
          b

邊（capacity）：s→a 2、s→b 1、a→b 3、a→t 1、b→t 2
```

- 鐵路的邊沒有方向，但**一條無向邊就等於兩條方向相反的邊**（a → b 和 b → a 各一條）。所以一般化之後，flow network 是一張 **directed graph（有向圖）**，每條邊都有箭頭。
- 它比一般的有向圖多一樣東西：**每條邊上的 capacity**。另一種說法：flow network 是一張 **weighted digraph（有向加權圖）**，邊的權重（通常是整數）就是容量。
- 兩個特別的點：**source（源點）**，記作 s；**sink（匯點）**，記作 t（也叫 target）。其他中間的點（這裡的 a、b）叫 **internal node（內部點）**。
- 每條邊有 **head（箭頭端）** 和 **tail（尾端）**，流量只能從 tail 往 head 流，也就是只能**順著箭頭**流，例如 s → a → t。如果某段水管其實可以雙向流，就建兩條方向相反的邊。

> **比喻** 每條邊是一段水管，capacity 是水管的粗細，灌超過它水管就爆。source 是**水龍頭**，一直把水灌進網路；sink 是**水桶**，只負責接收。

要解的問題（**maximum flow problem，最大流問題**）：已知每段水管的容量，整個網路從 s 到 t 最多能讓多少水通過？換個說法，就是水龍頭最多能開多大（每單位時間送出多少水），也等於水桶每單位時間最多收到多少水。兩種看法一樣。

## 先試灌一次，再學會「退水」

### 第一次灌水：被最細的水管卡住

一開始水龍頭關著，管線全空。每條邊寫成 **flow / capacity**，現在 flow 全是 0。打開水龍頭，水從 s 出來，可以往上走 a，也可以往下走 b。

先往上試：s → a → b → t，三段容量 2、3、2。三段水管接成一串，能過的水量被**最細的那段**卡住：min(2, 3, 2) = 2。把 2 單位推下去：

```
          a
   2/2 ↗  │  ↘ 0/1
    s     │2/3   t
   0/1 ↘  ↓  ↗ 2/2
          b
水桶收到 2
```

順著這條路還能再多嗎？不行，s → a 和 b → t 都滿了，再灌就爆管。目前送了 2 單位。整個網路就只能送 2 嗎？

### 能不能走 s → b → a → t？

想再送更多，自然會想到：從 s 送到 b，再讓 a 送到 t。可是 a 的水要從哪裡來？中間 b 到 a 是**逆著** a → b 的箭頭走。

規則是每條水管都要順著箭頭灌水，所以 a → b 只能從 a 灌到 b。

- **管子全空的時候**：s → b → a → t 走不通，根本沒有水可以逆流，只能順著箭頭走，例如 s → b → t。
- **現在的狀態**：a → b 裡已經有 2 單位往下流。s → b 還空著，可以再灌 1。水到了 b 之後，其實**可以**往 a 的方向走：往上送 1，會跟往下的 2 互相抵消。

這個動作叫 **undo flow（退流、把水退回去）**：把一部分已經送出去的水退回來。往下 2、往上 1，實際上就是 2 − 1 = 1 單位往下。結果 s → b、a → t 各多 1：

```
          a
   2/2 ↗  │  ↘ 1/1
    s     │1/3   t
   1/1 ↘  ↓  ↗ 2/2
          b
水龍頭送出 2 + 1 = 3；水桶收到 1 + 2 = 3
```

> **觀念** 退水完全合法，所有 flow network 都允許。有了它，就不會卡死在第一次選的那條路上。但有**前提**：管子裡要先有水才能退，最多只能退回原本那麼多；空管不能送反方向的水。

灌完之後，從 s 出去的管子（s → a 2/2、s → b 1/1）和流進 t 的管子（a → t 1/1、b → t 2/2）全滿，再也灌不下去。總水量看水龍頭送出多少是 2 + 1 = 3，看水桶收到多少是 1 + 2 = 3，兩邊一定一樣。3 就是這張圖的 **maximum flow（最大流）**：我們要解的就是在網路裡灌水，灌得越多越好。

## 記法：f / c 與 flow value

之後都用這種畫法：每條邊寫兩個數字，用斜線隔開，**f / c**。

- **c 是 capacity**：題目一開始就給定，代表水管的上限。
- **f 是 flow**：某個時刻（或灌完時）這條管子裡流的水量。

正式定義：**s-t flow f** 是一個函數，把每條邊 e 對應到一個實數 f(e)，就是這條邊的流量。

- f(e) 一定 **≥ 0**：頂多不灌水，負的水不合理。
- **每一條邊**都要給一個值，才算是完整的 assignment（指定）。

符號 **v** 取 value 的意思，代表一種灌法的總水量。**v(f)** 定義為 **source 往外送出的流量總和**。上面那種灌法 f：v(f) = 2 + 1 = 3。反過來從 sink 看，它收到的也是 1 + 2 = 3。

> **重點** 從 source 量和從 sink 量，兩者一定相等。不相等就代表中間有水管爆了在漏水，或是水憑空冒出來，都不合理。

## 兩個硬性限制

Maximum flow 問題的目標是找出**最大的 v(f)**，而且不只總量，還要交代**每條邊上各流多少**。不管怎麼灌，都要滿足兩個 **hard constraint（硬性限制）**，違反任何一個就是 illegal（不合法）的解。

1. **Capacity constraint（容量限制）**：水管裡的水不能超過容量，也不能是負的。
   - 對每條邊 e：**0 ≤ f(e) ≤ c(e)**。
   - 例：某條邊容量 11，它的流量只能在 0 到 11 之間。
2. **Flow conservation（流量守恆）**：每個 internal node **流進的總量 = 流出的總量**。
   - 學過電路的話，它就像 **KCL（克希荷夫電流定律）**：流進節點的電流等於流出的電流。
   - 只管 internal node。source 只送不收、sink 只收不送，本來就不平衡，所以 s、t 不算。

> **例題** 檢查小例子灌完的狀態：a 流進 2（s → a），流出 1 + 1（a → b、a → t），平衡；b 流進 1 + 1（s → b、a → b），流出 2（b → t），平衡。

- 流進 > 流出：水在這個點不見了，等於水管破了在漏水。
- 流進 < 流出：水憑空多出來，無中生有。
- 兩種都不合法。

> **陷阱** 限制只有這兩條。「每條邊都必須流滿」**不是**限制：最大流裡很多邊都沒滿。另外，守恆只要求中間的點；source 沒有流入、sink 沒有流出，不必（也不會）守恆。

## Cut：切一刀得到上界

### 先找 upper bound

在學怎麼求最大流之前，先退一步想：這是一個**最大化**問題，flow 越大越好。最大化問題可以先問：有沒有 **upper bound（上界）**？有的話，它就不會無限長大，一定被某個值卡住。而且上界越**緊**越好：壓得越低，越靠近真正的答案。

換一張新圖：從 s 到 t，中間有 a、b、c、d，邊上標的是 capacity。

```
   s ──10──→ a ──4──→ c ──10──→ t
   │         │ ╲      ↑         ↑
   10        2  8     6         │
   ↓         ↓   ↘    │         │
   b ────9─────→  d ──┘         │
                  └──────10─────┘

邊（capacity）：
s→a 10   s→b 10   a→b 2   a→c 4   a→d 8
b→d 9    d→c 6    c→t 10  d→t 10
```

內部管線可能很複雜，但有一個很簡單的觀察：**隨便剪一刀把網路切開，讓 s 在一側、t 在另一側**，任何從 s 流到 t 的水，一定都會穿過這個切面。（s、t 在同一側的話，這一刀就沒有意義。）切面剪到的每條水管都有上限，能流過去的水，最多就是把它們全部灌滿。

### 三種切法

| 切法 | s 那一側 | 剪到的 s 側 → t 側的邊 | 上界 |
|---|---|---|---|
| 第一刀 | {s, a, b} | a→c 4、a→d 8、b→d 9 | 4 + 8 + 9 = 21 |
| 第二刀 | {s} | s→a 10、s→b 10 | 10 + 10 = 20 |
| 斜切 | {s, b} | s→a 10、b→d 9（a→b 是反向，不算） | 10 + 9 = 19 |

- 第一刀：flow 不可能超過 21。
- 每一刀都會形成一個 **cut（切割）**，每個 cut 都提供一個上界。第二刀只剪 s 出來的兩條，20 比 21 更緊。
- 既然每個 cut 都是上界，就從所有 cut 裡挑容量總和最小的那個，它最緊，叫 **min cut（最小割）**。

### 斜切：反方向的邊不算

斜著切，剪到 s → a、a → b、b → d 三條邊：s、b 在一側，a、c、d、t 在另一側。

前兩刀剪到的邊都很「順」，都是從 source 那側流向 sink 那側。但這一刀剪到一條**反方向**的邊：a → b 是從 sink 那側流回 source 那側。

- 順方向的 **forward 邊**：算上界時，最多就是灌滿。
- 反方向的邊：我們希望它**不要灌水**，因為灌了等於把水送回 source 那側，總量只會變少。

所以這個 cut 只算 forward 的邊：10 + 9 = 19，容量 2 的那條反向邊不算。

> **重點** cut 的容量只加「s 側 → t 側」的邊的 capacity；「t 側 → s 側」的邊不算。

這個問題有一個漂亮的性質：**最緊的上界剛好達得到，max flow = min cut**（**max-flow min-cut theorem，最大流最小割定理**），證明在後面。這張圖的最大流剛好就是 19，下面跑演算法就會看到。

## Ford-Fulkerson 的想法

求最大流最有名的演算法叫 **Ford-Fulkerson**。這個 Ford 就是 Bellman-Ford 的那位 Ford，Fulkerson 是另一位學者。

- 出發點跟第一個例子一樣，是 **greedy（貪婪）**：順著邊的方向，能送就送。
- 再加上**退水**：管子裡有水的時候，就多出一種灌水的機會。
- 原來的 flow network 記作 **G**，每條邊標 f / c。Ford-Fulkerson 最特別的是另外建一張 **residual graph（剩餘圖）**，記作 **G_f**（讀作 G sub f），專門記每條邊「還能灌多少、能退多少」。
- 每一輪在 G_f 上找路灌水，回去更新 G，再重建 G_f。**兩張圖交替操作**，直到灌不下去。

## Residual graph G_f 怎麼建

回到 s、a、b、t 的小例子。剛剛先灌 2，再灌 1，第二次其中一段其實是退水。小圖用眼睛看得出來，網路一大就不行了，要有系統地把所有可能（包含退水）都記下來。

假設現在已經灌了 2 單位在裡面：

```
flow network G（灌了 2 之後）
s→a 2/2   a→b 2/3   b→t 2/2   s→b 0/1   a→t 0/1
```

要記兩種灌水能力：

- **還沒灌滿的管子**：a → b 容量 3 只灌了 2，往下還能再灌 1。
- **有水的管子可以退**：a → b 有 2 單位往下流，最多可以退 2 往上。可以想成有一條往上的「想像水管」，容量 2；真的有水流過它，意思就是退水。

G_f 的點跟原圖一樣，邊要重新建。原圖每條水管，在 G_f 裡**最多變成兩條邊**：

| 原圖的邊 | f / c | G_f 的 forward 邊（還能灌 c − f） | G_f 的 backward 邊（能退 f） |
|---|---|---|---|
| s→a | 2/2 | 已滿，不建（建了容量也是 0） | a→s 2 |
| s→b | 0/1 | s→b 1 | 沒水，不建 |
| a→b | 2/3 | a→b 1 | b→a 2 |
| a→t | 0/1 | a→t 1 | 沒水，不建 |
| b→t | 2/2 | 已滿，不建 | t→b 2 |

```
residual graph G_f（灌了 2 之後）
forward ：s→b 1   a→b 1   a→t 1
backward：a→s 2   b→a 2   t→b 2
```

> **重點** forward edge 的容量 = **c − f**（等於 0 就不建）；backward edge 的容量 = **f**（沒水就不建）。backward edge 提供退水機制，只有裡面有水的管子才有；沒水硬要退，flow 就變負的，違反 capacity constraint。

## Augmenting path 與 bottleneck

- **Residual capacity（剩餘容量）**：G_f 上每條邊的容量，代表現在還有多少灌水能力。在原圖上看，順向就是 capacity 減掉目前的 flow，例如容量 11、已經流 9，就剩 11 − 9 = 2。
- 只要 **G_f 上找得到一條 s 到 t 的路**，就代表還能把水灌進去。
- 能灌多少？取路上 residual capacity 的最小值，叫 **bottleneck（瓶頸，bottleneck capacity）**。

剛剛第二次灌水走的是 s → b → a → t，在 G_f 上就是 s→b 1、b→a 2、a→t 1 三條邊。容量 1、2、1，最多灌 min(1, 2, 1) = 1；再多，容量 1 的那兩段就爆了。

灌完之後，要**回頭更新原來的 flow network G**：

| G_f 上的邊 | 跟原邊的方向 | 原圖的更新 |
|---|---|---|
| s→b | 相同 | s→b：0 + 1 = 1 |
| b→a | 相反（退水） | a→b：2 − 1 = 1 |
| a→t | 相同 | a→t：0 + 1 = 1（滿了） |

總水量變成 2 + 1 = 3。更新完 flow network，再產生新的 G_f，繼續找、繼續灌，一輪一輪（iteratively）做：

```
flow network G（灌了 3 之後）
s→a 2/2   s→b 1/1   a→b 1/3   a→t 1/1   b→t 2/2

residual graph G_f
forward ：a→b 2
backward：a→s 2   b→s 1   b→a 1   t→a 1   t→b 2
s 沒有任何往外的邊 → 找不到 s 到 t 的路，停止，max flow = 3
```

這條在 G_f 上找到、能把水加上去的 s-t 路，叫 **augmenting path（增廣路徑）**。augment 是「加上去」的意思，不會把原本的流量拿掉。一直做到 G_f 再也找不到 s 到 t 的路，就停下來，這時就是 maximum flow。

> **重點** 更新規則一句話：path 上的邊**跟原邊同方向就加（increase）**，**反方向就減（decrease）**，減的就是 undo flow。

> **陷阱** 有些資料把「一條路上最小的剩餘容量」叫成 minimal cut，這是用語錯誤。**min cut** 是把頂點分成兩邊的那個 cut（max-flow min-cut theorem 的那個 cut）；一條路上的最小剩餘容量要叫 **bottleneck capacity**。

### 流程回顧

1. 一開始 flow network 全空，每條邊的 flow 都是 0。
2. 每次灌水前，針對當下的 flow network 建 residual graph，把所有灌水的可能都記下來：
   - 順著邊的方向、還有剩餘容量的水管 → forward edge。
   - 管子裡已經有水 → 反方向的 backward edge，容量就是管子裡現在的水量（最多全部退掉）。
3. 在 **G_f（不是 flow network）**上找一條 s 到 t 的路，找出路上 residual capacity 最低的 bottleneck，灌那麼多。
4. 用它更新原來的 flow network：同方向加、反方向減。
5. 更新後得到新的 flow network，再建對應的 G_f，看能不能再找到 augmenting path。

## 再看一個例子：A 到 F

換一張圖，問題一樣：整個網路最多能過多少流量？這張圖裡 **A 是 source、F 是 sink**。規則一樣兩條：例如 A → C 容量 11，上面的流量只能在 0 到 11 之間；中間的點（例如 C）流進來多少就要流出去多少；A 只出不進、F 只進不出，不必守恆。

### 第一條路：A → C → D → F

```
A ──11──→ C ──9──→ D ──11──→ F
```

三段 capacity 11、9、11，整條路被最細的那段卡住：min(11, 9, 11) = 9。沿這條路送 9：

| 邊 | flow / capacity | residual capacity |
|---|---|---|
| A→C | 9/11 | 11 − 9 = 2 |
| C→D | 9/9 | 9 − 9 = 0（滿了） |
| D→F | 9/11 | 11 − 9 = 2 |

總 flow = 9。把每條邊換成「還剩多少」來標，就是 residual graph，下一條路就在這張圖上找。

### 第二條路：A → C → B → E → F

還有邊沒滿，再找一條：

```
residual capacity：A ──2──→ C ──10──→ B ──9──→ E ──2──→ F
```

沿路剩餘容量 2、10、9、2（A → C 只剩 2），bottleneck = min(2, 10, 9, 2) = 2，這次最多送 2。

| 邊 | 送完後 flow / capacity |
|---|---|
| A→C | 11/11（剛好滿了） |
| C→B | 2/10 |
| B→E | 2/9 |
| E→F | 2/2 |

總 flow = 9 + 2 = 11。

### Augmenting path 可以用的兩種邊

1. **Non-full forward edge**：順著原方向、還沒流滿的邊，可以再加流。例如 A → C 原本 9/11，還沒滿。
2. **Non-empty backward edge**：已經有流量的邊，可以反方向走，把流量退回去，就是 undo flow。

> **陷阱** 只用 non-full forward edge 是不夠的；有 flow 的 backward edge 也能走。飽和的 forward edge 和空的 backward edge 都不能走。

### Ford-Fulkerson 三步驟

1. **初始**：flow = 0，所有邊都是空的。
2. **只要還找得到 source 到 sink 的 augmenting path**，就把這條路能送的量（path flow）加進總 flow：0 加 9 變 9，再加 2 變 11……一直重複，直到再也找不到 augmenting path。
3. **回傳**這時的 flow，它就是整個網路的 maximum flow。

> **陷阱** 停止條件是「G_f 中找不到 s 到 t 的 augmenting path」，不是「所有邊都飽和」，也不是「做滿某個次數」。

## 完整跑一次 Ford-Fulkerson（flow = 19）

回到 s、a、b、c、d、t 那張圖（capacity：s→a 10、s→b 10、a→b 2、a→c 4、a→d 8、b→d 9、d→c 6、c→t 10、d→t 10），從頭到尾完整跑一次。

### 第 1 輪：s → a → d → t，灌 8

一開始全部沒水，每條邊的 flow 都是 0。為目前的 flow network 建 G_f：它跟原圖**長得一模一樣**；因為沒有水就沒有東西可退，所以沒有 backward edge。

```
G_f（flow = 0）
forward ：s→a 10  s→b 10  a→b 2  a→c 4  a→d 8  b→d 9  d→c 6  c→t 10  d→t 10
backward：（無）
```

在 G_f 上找一條 s 到 t 的路。**怎麼找都可以**：過程會不同，但最後的結果一樣好。假設選了 s → a → d → t，bottleneck = min(10, 8, 10) = 8。灌 8 進去：

```
G（flow = 8）
s→a 8/10  s→b 0/10  a→b 0/2  a→c 0/4  a→d 8/8
b→d 0/9   d→c 0/6   c→t 0/10 d→t 8/10
```

### 第 2 輪：s → b → d → c → t，灌 6

針對新的 flow network 重建 G_f。其實**只有剛剛那條路動到的三條邊會變**，其他地方都不用重建：

- s → a 容量 10、灌了 8：forward 剩 2，backward a→s 8。
- a → d 已經灌滿：順方向沒有邊了，只剩反方向 d→a 可以退 8。
- d → t 灌了 8：forward 剩 2，backward t→d 8。

```
G_f（flow = 8）
forward ：s→a 2   s→b 10  a→b 2  a→c 4  b→d 9  d→c 6  c→t 10  d→t 2
backward：a→s 8   d→a 8   t→d 8
```

一樣任意找一條 augmenting path：s → b → d → c → t，四段 10、9、6、10，bottleneck = 6。沿這四條邊灌 6：

```
G（flow = 14）
s→a 8/10  s→b 6/10  a→b 0/2  a→c 0/4  a→d 8/8
b→d 6/9   d→c 6/6   c→t 6/10 d→t 8/10
```

到目前為止，兩輪都是順著邊的方向灌，還沒用到退水。flow = 8 + 6 = 14。

### 第 3 輪：s → b → d → a → c → t，走反向邊，灌 3

重建 G_f，大部分保留，只更新剛剛動到的四條邊。d → c 灌滿了，順方向不能再灌，但反方向 c→d 可以退 6。

```
G_f（flow = 14）
forward ：s→a 2   s→b 4   a→b 2   a→c 4   b→d 3   c→t 4   d→t 2
backward：a→s 8   b→s 6   d→a 8   d→b 6   c→d 6   t→c 6   t→d 8
```

這次的路比較繞：**s → b → d → a → c → t**。注意 **d → a 是 backward 邊**，代表把 a → d 的水退回去。五段 4、3、8、4、4，bottleneck = 3。沿這五條邊把 3 單位灌回原來的 flow network：

| G_f 上的邊 | 方向 | 原圖的更新 |
|---|---|---|
| s→b | forward | 6 + 3 = 9 |
| b→d | forward | 6 + 3 = 9 |
| d→a | backward | a→d：8 − 3 = 5 |
| a→c | forward | 0 + 3 = 3 |
| c→t | forward | 6 + 3 = 9 |

d → a 是倒著灌 3，等於 a → d 退掉 3；退掉的水改從 a 走到 c，一點都沒浪費。

```
G（flow = 17）
s→a 8/10  s→b 9/10  a→b 0/2  a→c 3/4  a→d 5/8
b→d 9/9   d→c 6/6   c→t 9/10 d→t 8/10
檢查守恆：a 進 8、出 5 + 3；d 進 5 + 9、出 6 + 8；c 進 6 + 3、出 9
```

總流量變成 14 + 3 = 17。

### 第 4 輪：s → a → d → t，灌 2

再建 G_f：

```
G_f（flow = 17）
forward ：s→a 2   s→b 1   a→b 2   a→c 1   a→d 3   c→t 1   d→t 2
backward：a→s 8   b→s 9   d→a 5   c→a 3   d→b 9   c→d 6   t→c 9   t→d 8
```

還有一條 s → a → d → t，三段 2、3、2，bottleneck = 2。沿這三條邊再灌 2：

```
G（flow = 19）
s→a 10/10  s→b 9/10  a→b 0/2  a→c 3/4  a→d 7/8
b→d 9/9    d→c 6/6   c→t 9/10 d→t 10/10
```

flow = 17 + 2 = 19。

### 停下來：順便找到 min cut

針對現在的狀況再建一次 residual graph，在上面找 augmenting path：

```
G_f（flow = 19）
forward ：s→b 1   a→b 2   a→c 1   a→d 1   c→t 1
backward：a→s 10  b→s 9   d→a 7   c→a 3   d→b 9   c→d 6   t→c 9   t→d 10

從 s 出發：s 往外只有 s→b（s→a 已滿）
到了 b：b 往外只有 b→s（b→d 已滿）→ 走不出去
s 走得到的點 = {s, b}，到不了 t
```

找不到 augmenting path，演算法停下來。停下來時的解就是最好的解：**maximum flow = 19**。

在 G_f 裡，{s, b} 和其他點之間好像隔著一道鴻溝，所有往外的路都被砍斷了。把它想成一個 cut，一側是 {s, b}，對應回原來的 flow network 剪出同一個 cut：

```
s 側 {s, b}  →  t 側 {a, c, d, t}
s→a 10/10（滿）   b→d 9/9（滿）     → 算：10 + 9 = 19
a→b 0/2（t 側 → s 側，沒有水）      → 不算
```

這就是前面斜切的那一刀！它的容量 19 剛好等於灌進去的最大流 19：**min cut = max flow**。backward 方向的 a → b 不算，因為 cut 是上界，可以讓它不灌水，實際上它也真的是 0/2。

> **重點** min cut 就在「G_f 中 s 走得到的範圍」的邊界。找到 max flow，min cut 也順便到手。而且 max flow = min cut 不是這個例子的巧合，是可以證明的定理。

## Ford-Fulkerson 虛擬碼

```
Ford-Fulkerson(G, s, t, c)
    for each edge e in G:                      // initialization
        f(e) ← 0
    G_f ← residual graph of G with respect to f
    while there is an s-t path in G_f:
        P ← an s-t path in G_f                 // augmenting path
        b ← bottleneck(P)                      // min residual capacity on P
        for each edge e in P:
            if e is a forward edge:
                f(e) ← f(e) + b                // 順著原方向多灌 b
            else:                              // e = eᴿ, backward edge
                f(e) ← f(e) − b                // 原圖那條邊退水 b
        update G_f according to the new f
    return f
```

- 開頭是 **initialization**：所有邊的 flow 清成 0。
- 依照目前的 flow 建 G_f：forward edge 記還能灌多少（c − f），backward edge 記能退多少（上限是管子裡現在的水量 f）。一開始沒水，第一個 G_f 只有 forward edge；backward 就算建了，容量也是 0，等於沒有。
- 大的 while loop，每一輪灌一次水：在 G_f 上找 s 到 t 的 augmenting path P，找得到就表示能灌水。
- bottleneck b：P 經過的邊裡 residual capacity 最小的那個，剩下能力最少的那段限制了整條路的灌水量。
- 把 b 灌回原來的 flow network：路上每條邊，看它在原圖是 forward（原圖就是這個方向，f(e) 加 b）還是 backward（記作 **eᴿ**，跟原圖方向相反，代表 undo flow，原圖那條邊的 flow 減 b）。
- 改完再依新的 flow network 更新 G_f，一直重複；直到 G_f 裡 s 到不了 t，while loop 停下來，輸出當下的 flow。

> **陷阱** 沿 augmenting path 要 update 的是**原來的 flow network G**，不是 residual graph；G_f 是更新完 flow 之後再重新建的。

## Ford-Fulkerson 的正確性（一）：每一輪都是合法的 flow

演算法會跑了，接著要問它對不對。正確性分兩層：

1. 吐出來的是不是**合法的 flow**，也就是 **feasible solution（可行解）**。
2. 是不是**最佳解**（maximum flow）。這一層要靠後面的 max-flow min-cut theorem。

這一節處理第一層。Ford-Fulkerson 一輪一輪做，每灌一次水就產生一個新的 flow。把這一輪開始時的 flow 叫 **f**，沿 augmenting path P 灌完 bottleneck b 之後的叫 **f′**。要證 f′ 合法，就是證它滿足兩大限制：

- **capacity constraint**：每條邊 0 ≤ flow ≤ capacity。
- **conservation constraint**：每個 internal node 流入 = 流出。

證明的思路是歸納：

- 一開始 flow 全是 0。很差，但它是合法的。
- 所以只要證「f 合法 ⇒ f′ 也合法」，每一輪都保持合法即可。
- f 跟 f′ 只差在 P 經過的邊上（P 是 simple path），其他邊完全沒動，所以只要檢查 P 上的邊和點。

P 是在 residual graph G_f 上找的，P 上每條邊對原來的 flow network 來說只有兩種：**forward edge**（跟原圖同方向）或 **backward edge**（原圖反方向的退水邊）。分開檢查。

### forward edge：不會超過容量

forward edge 在 G_f 上的 residual capacity 是 **c − f**。例如容量 c = 10、已流 f = 6，就還剩 4。

bottleneck b 是 P 上所有 residual capacity 的最小值，所以 b ≤ 每一條的 residual，對這條邊就是 **b ≤ c − f**。

沿 forward edge 灌水是增加：f′ = f + b。例如 b = 3，6 + 3 = 9。

- 上限：f′ = f + b ≤ f + (c − f) = c，f 跟 −f 消掉，**f′ ≤ c**，沒有超過容量。
- 下限：f′ = f + b 是加上一個正數，所以 **f′ ≥ f ≥ 0**。

得到 0 ≤ f′ ≤ c，forward edge 過關。

### backward edge：不會變成負的

backward edge 的 residual capacity 就是這一輪開始時的 flow **f**：管子裡有多少水，最多就只能退多少。例子裡 f = 6。

P 上的 u → v 如果是 backward，代表原圖裡這條邊其實是 **v → u**，方向倒過來。灌水之前 f 合法，所以這條邊本來就滿足 0 ≤ f ≤ c。

沿 backward edge 灌水是退水：f′ = f − b。例如 b = 3，6 − 3 = 3。

- 上限：減完一定比原來小，**f′ ≤ f ≤ c**。
- 下限：b 是最小的 residual，所以 b ≤ 這條邊的 residual，也就是 **b ≤ f**。代進去：f′ = f − b ≥ f − f = 0。最多退到 0，不會變負。

forward、backward 都沒問題，capacity constraint 這一塊過關。

> **例題** forward edge 原 flow f、capacity c，加上 bottleneck b 後為什麼 f + b ≤ c？
> 答：因為 b ≤ 這條邊的 residual = c − f。backward edge 減 b 後為什麼不會變負？因為 backward 的 residual = f，且 b ≤ f。兩個 residual 不要記反。

### conservation：守恆還是成立

更新之後，每個 internal node 仍要流入 = 流出。augmenting path 只改到 path 上的點；source 只產生、sink 只吸收，**s 和 t 不用檢查**，只要檢查 path 上的 internal node。

這一輪開始前 flow 合法，所以每個 internal node 本來就守恆。取 path 上任一個 internal node v：

```
灌水前                         灌水後（b = 2，path 從 3 那條進、從 4 那條出）
  3 →┐       ┌→ 4               5 →┐       ┌→ 6
     v                             v
  2 →┘       └→ 1               2 →┘       └→ 1
流入 3 + 2 = 5 = 流出 4 + 1      流入 5 + 2 = 7 = 流出 6 + 1
```

path 從一條 incoming edge 進 v、從一條 outgoing edge 出去：進來那條多了 b，出去那條也多了 b，所以進 7、出 7。就像**等量加法**：原本 x = y，兩邊都加 b，x + b = y + b 仍然相等。

上面只畫了「進、出都是 forward edge」的情況。path 在 v 用到 backward edge 時也一樣守恆：

- 兩條都是 backward：流入、流出各減 b。
- 一條 forward、一條 backward：兩條邊都在 v 的同一側（都是流入或都是流出），一條加 b、一條減 b，那一側的總和不變。

> **重點** Ford-Fulkerson 每一輪結束時得到的新 flow f′ 都是合法的 flow（capacity constraint 與 conservation 都成立）。

## 整數容量這個前提

一個常被忽略、但非常重要的性質：假設輸入的 flow network 裡，所有 capacity 都是 **integer（整數）**。

問：容量也可能是小數，像 0.5、1.5，怎麼辦？

答：實作時第一步先做 **normalization**，全部除以它們的最大公因數。例如容量 1、0.5、1.5、0.5、1，最大公因數是 0.5，除完變成 2、1、3、1、2，全是整數。可以這樣做，是因為每一輪的 bottleneck 都是對容量取最小值、做加減得來的，一定是最大公因數的整數倍，不會出現「0.5 倍」。

為什麼一定要整數？

- 如果是任意小數，可能這次加 0.1、下次加 0.0001，一點一點往上爬，根本無法估計要跑幾輪。
- 整數就不同：每次**至少加 1**。只要知道 flow 的上界，例如 100，就知道最多 100 輪一定結束。

這是一個 **invariant（不變式）**：只要輸入的 capacity 是整數，每一輪的 flow 和 residual capacity 也都一定是整數，所以每次增加的水量（bottleneck）都是正整數。

> **陷阱** 除以最大公因數只適用於有理數容量。容量是無理數時，Ford-Fulkerson 甚至可能永遠停不下來。

## 每一輪 flow 都嚴格變大

一開始 flow 是空的，v(f) = 0。之後每一輪沿 augmenting path 灌 bottleneck，flow **嚴格遞增**：

v(f′) = v(f) + b，且 b > 0

b 一定大於 0：如果 b 是 0，表示已經沒有路可灌，演算法早就停了。

證明只要看 source，因為 flow 的值就是 s 送出去的總量：

1. 找的 path 是 **simple path**：不繞圈、不重複拜訪同一個點，所以走出 s 之後不會再回到 s。
2. 原圖裡 s 沒有 incoming edge，只會往外流，所以 G_f 裡從 s 出發的邊不可能是退水邊。
3. 因此 path 的第一條邊一定是從 s 出發的 **forward edge**，沿它灌水是增加，s 送出的量剛好多了 b。例如 2 + 1 = 3。

## Running time：O(mC)

前面知道，容量是整數時，過程中的 flow 和 G_f 全是整數。要估什麼時候停，先找 flow 的一個上界。

**所有 cut 都是上界**。最簡單的一刀：把 source 單獨切出來，剪斷它所有往外的邊。這個值記作

C = s 所有出邊的 capacity 總和

例如前面的例子 s 有兩條出邊、容量 10 和 10，C = 10 + 10 = 20。C 一定 ≥ 最後的 max flow（它是上界），但不一定是 min cut（那個例子的 min cut 是 19）。

- 迭代次數：worst case 每一輪只加 1（整數最少就是 1），1、2、3、4……所以**最多 C 輪**一定停。
- 每一輪的時間，m 為邊數：
  - 建 residual graph：跟邊數成正比，O(m)。
  - 找 augmenting path：任何找路的演算法都可以，用 BFS 或 DFS 是 O(m)。用 Dijkstra 也行，但要 O(m log n)，比較慢，沒必要。
  - 沿路灌水、更新 flow：最多走過所有的邊，O(m)。

總時間：**O(m · C)**。

### 壞例子：200 輪對 2 輪

C 很大的時候，就怕每次只加一點點。原始論文特別設計了一個反例：四個點、上下對稱，四條容量 100 的粗水管，中間一條容量 1 的細水管。

```
          u
   100 ↗  │  ↘ 100
  s       │1      t
   100 ↘  ↓  ↗ 100
          v
```

一開始 flow 全是 0，residual graph 跟原圖一樣。運氣不好時：

| 輪 | 在 G_f 找到的 path | bottleneck | 更新後 | v(f) |
|---|---|---|---|---|
| 1 | s → u → v → t（經過中間細管） | min(100, 1, 100) = 1 | s→u 1、u→v 1、v→t 1 | 1 |
| 2 | s → v → u → t（v → u 是反向邊，把 u → v 的 1 退回去） | min(100, 1, 100) = 1 | s→v 1、u→v 0、u→t 1 | 2 |
| 3 | 又走上面的 Z 字 s → u → v → t | 1 | … | 3 |
| 4 | 又走下面的 Z 字 s → v → u → t | 1 | … | 4 |

上面一個 Z 字、下面一個 Z 字輪流走，每次都只加 1。C = 100 + 100 = 200，worst case 要跑 **200 輪**。

可是最好的走法很快：上面 s → u → t 直接送 100、下面 s → v → t 送 100，**2 輪**就到 200。所以「隨便找路」不見得是好做法。

### O(mC) 是 pseudo-polynomial

整理：worst case 每次只加 1，需要 C 個 iteration；每個 iteration 是 O(m)，整體被 m · C bound 住。

問：O(mC) 是 polynomial time 嗎？答：**不是**。

- m 是 input size，告訴你有幾條邊，輸入越大 m 越大，這部分沒問題。
- 問題出在 C：它是 capacity 的**數值**。邊可以很少，capacity 卻可以很大；C 非常大時，worst case 就要跑非常多輪。
- 它看起來像兩個一次方相乘、很像多項式，但裡面有一個跟 input size 無關的數值參數。更精確地說，數值 C 只要大約 log C 個 bit 就寫得下，所以 C 相對於輸入長度是指數級的。

這種時間叫 **pseudo-polynomial time（擬多項式時間）**。動態規劃裡的 **knapsack** 和 **subset sum** 也是：它們是 O(nW)，n 是物品總數，W 是背包容量，也是一個數值。物品很少但背包很大時，表格就會超大。

> **陷阱** O(mC)、O(nW) 都不是多項式時間，因為 C、W 是數值不是 input size。

## 挑好的 augmenting path

壞例子說明：複雜度取決於每次怎麼挑 augmenting path。挑得好兩輪結束，挑得差兩百輪。常見的策略（知道概念即可）：

1. **挑 bottleneck 比較大的 path**：有很多條路可選時，挑 bottleneck 大的，這一輪就能多灌一點。
2. **挑經過最少邊的 path**：用 BFS 就能很快找到兩點間經過最少邊的路。這就是 **Edmonds-Karp** 演算法，時間 O(VE²)，跟容量大小無關。
3. **Δ-scaling**：控制 bottleneck 的大小。
   - 一開始設一個很大的門檻 Δ，容量小於 Δ 的水管全部當作不存在。壞例子中間那條容量 1 的細管就不見了。
   - 先用大水管灌水，灌得差不多了，再慢慢放寬 Δ，把小水管開放出來，提供更多灌水的機會。
   - 好處是一開始不會去走細管，避免 bottleneck 太小、每次只加一點點。時間是 O(E² log C)。

> **陷阱** 「挑 bottleneck 最小的 path」不是策略，它正是壞例子那種慢的走法。

## Max flow 與 min cut：primal 與 dual

從最佳化的角度看：**max flow 是 primal（主問題），min cut 是它的 dual（對偶問題）**。演算法其實同時在兩個問題上操作、交替進行：flow 從下面往上長，cut 的上界從上面往下壓；到最佳解時兩邊剛好碰頭。結論就是 **max-flow min-cut theorem**：最後求得的 max flow 值，等於 min cut 的 capacity。

再複習 cut（定義見前面）：

- 隨便切一刀，但 s、t 一定要在不同側。
- 每個 cut 都是 flow 的上界：所有的水都得穿過這個切面，從 source 端流到 sink 端，而切面上剪到的水管最多只能送 capacity 那麼多。
- 只加 **forward 方向**（source 側 → sink 側）的邊的容量；反方向的邊可以叫它不要送水，不算。
- 任何把 s、t 分開的 cut 都是上界，要找的是最緊的那個。

用前面跑過 Ford-Fulkerson 的例子（s → a 10、s → b 10、a → b 2、a → c 4、a → d 8、b → d 9、d → c 6、c → t 10、d → t 10）：

| cut 的 source 側 | 剪到的 forward 邊 | 反方向（不算） | capacity |
|---|---|---|---|
| {s, a, b, c} | a→d 8、b→d 9、c→t 10 | d→c 6 | 8 + 9 + 10 = 27（很鬆） |
| {s, a, b} | a→c 4、a→d 8、b→d 9 | 無 | 4 + 8 + 9 = 21 |
| {s} | s→a 10、s→b 10 | 無 | 20 |
| {s, b} | s→a 10、b→d 9 | a→b 2 | 10 + 9 = 19（最小） |

最小的是 19，而這張圖的最大流正是 19：最佳解就出現在 min cut 上。

## Max-flow min-cut theorem 與它的證明

講 network flow 一定會提這個定理：**max-flow min-cut theorem（最大流最小割定理）**。

> **重點** 在一個 flow network 裡，max flow 的值等於 min cut 的 capacity。它也解釋了 Ford-Fulkerson 為什麼正確：它停下來時找到的就是 maximum flow。

符號提醒：

- flow 的值 v(f) 依定義**從 source 端量**（source 只產生 flow）。上面例子的最終 flow 是 s → a 10、s → b 9，v(f) = 10 + 9 = 19。
- **cut (A, B)** 是任何一種把點分成 A、B 兩半的 partition，而且 s ∈ A、t ∈ B。
- **cap(A, B)** 只算從 A 流向 B 的邊的 capacity，從 B 倒流回 A 的邊不算（可以讓那條水管完全不流水）。例子的 min cut A = {s, b}：cap(A, B) = 10 + 9 = 19。
- 到最佳解時兩者相等：v(f) = 19 = cap(A, B)。

要證這個等號，就證下面三個敘述（statement）可以互相推導：

1. **①** 存在一個 cut (A, B)，使 v(f) = cap(A, B)。
2. **②** f 是 maximum flow。
3. **③** 對 f 找不到任何 augmenting path（G_f 上 s 走不到 t）。

證法：① ⇒ ②、② ⇒ ③、③ ⇒ ①，繞一圈，三件事就等價。重點其實是：**一定找得到 flow 剛好等於某個 cut 的情況，而那個 flow 就是 max flow。**

### ② ⇒ ③：反證法

三個證明裡最簡單的一個，用 **proof by contradiction（反證法）**：先假設結論不成立，推出矛盾。

要證：若 f 是 max flow，就找不到 augmenting path。

1. 假設 f 是 max flow，可是 G_f 裡還找得到一條 s 到 t 的路。
2. 照 Ford-Fulkerson 的做法，就能沿著這條路再送水進去。
3. 這條路的 bottleneck 一定 > 0，所以 flow 一定變大，例如 2 變 3。
4. flow 還能變大，表示 f 根本不是最大的，跟假設矛盾。

所以 f 是 max flow 時，G_f 裡 s 一定走不到 t。

### Weak duality：任何 flow ≤ 任何 cut

要證 ① ⇒ ②，先證一個比較弱的敘述，叫 **weak duality（弱對偶）**：

> **重點** 對任何 flow f、任何把 s、t 分開的 cut (A, B)，v(f) ≤ cap(A, B)。

之前是靠觀察體會「隨便一刀都是上界」，現在用推導證明。用同一張例子，取 Ford-Fulkerson 第三輪後、v(f) = 17 的那個 flow，以及 cut A = {s, a, c}、B = {b, d, t}：

```
跨過 cut 的邊（flow / capacity）
  A → B：s→b 9/10   a→b 0/2   a→d 5/8   c→t 9/10
  B → A：d→c 6/6
A 內部的邊：s→a 8/10   a→c 3/4
```

**第一步：一路加加減減，把 v(f) 改寫成跨過 cut 的量。**

1. 從定義開始：v(f) = s 出邊上的 flow 總和 = 8 + 9 = 17。
2. 動個小手腳，減一個 0：s 沒有 incoming edge，所以流進 s 的總和是 0。
   v(f) = （流出 s 的總和）−（流入 s 的總和）
3. 再加一堆 0：A 裡除了 s 以外的每個點（a、c），流出 − 流入 = 0（守恆）。
4. 合起來：**v(f) = ∑ over v ∈ A of（流出 v 的 flow − 流入 v 的 flow）**，也就是 A 這一側每個點流出去的減掉流進來的。
5. 換成邊的角度看：每條邊在出發點貢獻一個 +，在到達點貢獻一個 −。
   - 兩端都在 A 裡的邊，像 s → a、a → c，一加一減剛好抵消。
   - 沒被抵消的只有跨過 cut 的邊（只有一端在 A）：從 A 出去的只貢獻 +；從 B 流進 A 的，像 d → c，只貢獻 −。
6. 所以 **v(f) = ∑(A → B 的 flow) − ∑(B → A 的 flow)** = (9 + 0 + 5 + 9) − 6 = 17。

**第二步：放大成 capacity。**

1. 每條邊的 flow 一定 ≥ 0（最多不流，不能是負的）。減掉的 B → A 那一項是一堆 ≥ 0 的數，只會變小，所以 v(f) ≤ ∑(A → B 的 flow) = 9 + 0 + 5 + 9 = 23。
2. 每條邊的 flow ≤ 它的 capacity，把 flow 換成 capacity 只會更大：≤ ∑(A → B 的 capacity) = 10 + 2 + 8 + 10 = 30 = cap(A, B)。

```
v(f) = f_out(A) − f_in(A) ≤ f_out(A) ≤ cap(A, B)
  17 =     23   −    6    ≤    23    ≤    30
```

得到：任何 flow 的值 ≤ 任何一個 cut 的 capacity。這就是 weak duality。

### ① ⇒ ②：直接推論

敘述 ① 說：有某個 flow 剛好等於某個 cut 的 capacity，例如 19 = 19。由 weak duality，任何 flow 都不超過這個 cut；而這個 flow 已經頂到了，不可能再大，所以它就是 max flow。

### ③ ⇒ ①：s 走得到的點圍成一個 cut

敘述 ③ 說沒有 augmenting path，要推出這個 flow 剛好等於某個 cut。

沒有 augmenting path，就是 G_f 上 s 走不到 t。但 s 還是可能走出去一點，走到一些點就卡住。就像前面的例子，最後一輪從 s 出發只走得到 b，就再也走不出去。

**定義 cut**：把 G_f 裡 s 走得到的點全部收進 A，其他的點是 B。

- s 一定走得到自己，所以 s ∈ A。
- s 走不到 t，所以 t ∈ B。自然分成兩半，形成一個 cut。

接著跟 weak duality 一樣加加減減：v(f) = ∑(A → B 的 flow) − ∑(B → A 的 flow)。

- **第二項是 0**：B → A 的邊（例子裡的 a → b）上一定沒有 flow。若它有 flow，G_f 裡就有一條從 A 往外的退水邊，s 就能走出 A，跟「A 是 s 走得到的所有點」矛盾。
- **第一項等於 capacity**：A → B 的邊一定全都流滿（飽和）。若沒滿，G_f 裡還有 forward 邊能從 A 走出去，一樣矛盾。

於是 v(f) = cap(A, B) − 0。例子裡 A = {s, b}：v(f) = 10 + 9 = 19 = cap(A, B)。③ ⇒ ① 證完。

### 定理得證

① ⇒ ②、② ⇒ ③、③ ⇒ ① 全部完成，max-flow min-cut theorem 得證。而且證明本身給了做法：

- Ford-Fulkerson 停下來（③ 成立）時，當下的 flow 就是 max flow（②）。
- 同時也找到一個 capacity 總和最小的 cut，就是 min cut：**G_f 中 s 走得到的點當 A 側**。
- 算 min cut 只算 forward 方向，也就是從 source 側往 sink 側的邊。

定理漂亮、演算法又跑得乾淨，這是 network flow 這麼受歡迎的原因。

> **例題** Ford-Fulkerson 停止時，min cut 的 source 側怎麼找？
> 答：取 G_f 中從 s 走得到的點。例子中是 {s, b}，容量 10 + 9 = 19。不是「flow > 0 的邊的起點」，也不是「原圖中與 s 相鄰的點」。

## 應用：資源分配

會算 max flow 之後，最常見的用途是**資源分配**：每個資源有上限，很多人要用。

再看一個例子：甲、乙、丙三個人分用 R1、R2 兩個資源。網路的形狀是 s → 人 → 資源 → t：

- 管子就是資源，每個資源的上限就是 capacity：R1 → t 是 3、R2 → t 是 2。
- s → 每個人的邊是他要多少：甲 2、乙 3、丙 2。
- 人 → 資源的邊表示誰能用哪個資源，標 ∞ 代表這條沒有額外限制。

直接跑 max flow：最多分出 **5** 單位，R1 的 3 和 R2 的 2 剛好用滿。例如甲用 R1 兩單位、乙用 R1 一單位、丙用 R2 兩單位。每條邊上的 f/c 就是分配結果。

資源分配的問題幾乎每一種都有人試過用 network flow 解。碰到資源分配，可以想想把 network flow 稍微改一下能不能套。

> **觀念** 應用上真正難的是怎麼把問題 **model 成 flow network**。model 成功，答案就交給 max flow 演算法去算；為什麼算出來是對的，則由 max-flow min-cut theorem 保證。

## 二分圖匹配（bipartite matching）

### 問題

一個很有名的應用：**bipartite matching（二分圖匹配）**。它跟 stable matching 是兄弟問題，都在二分圖上。

- stable marriage：男女配對，每人最多一個，而且配完之後沒有人想「劈腿」。
- 這裡不管穩不穩定，只求**配出越多對越好**，叫 **maximum bipartite matching**。

畫成 **bipartite graph（二分圖）**：點分成兩群，左邊男生、右邊女生；中間有一些邊相連，但同一群之間沒有邊。有邊代表兩個人有機會配成一對；沒邊就是差太遠，連朋友都做不成。規則：一個男生最多配一個女生，一個女生也最多配一個男生。

最完美的情況叫 **perfect matching（完美匹配）**：每個人都恰好配到一個對象。

> **陷阱** perfect matching 不一定是 stable matching：perfect 只看數量（每人恰好一個），stable 看配完有沒有互相想換的組合。

例子（男生 1～5、女生 1′～5′ 的一張二分圖）：

- 一個解配出 3 對，有 2 個男生、2 個女生落單。
- 其實最好可以配到 4 對。
- 但這張圖不管怎麼配，都配不出 5 對，所以它沒有 perfect matching。

### 把 matching 變成 max flow

這個問題有專屬的演算法，但不必另外設計：用手上已經會的 max flow 來解。它本質上就是資源分配：把女生分給男生，每個「資源」最多只能配一個。最難的一步是建出合理的網路，讓跑完 max flow 剛好就是答案。

建法：

1. max flow 一定要有 source 和 sink，所以**額外加兩個點 s 和 t**。
2. 配對的邊本來沒有方向，這裡強制規定：**一律從左邊男生指向右邊女生**。
3. **s 連到所有男生**，**所有女生連到 t**，方向也是從左到右。
4. capacity **全部設 1**：
   - 中間配對的邊給 1：一個男生只能配一個女生。
   - s → 每個男生給 1：配成功的話，男生最多只有 1 單位的水流向某個女生。
   - 每個女生 → t 給 1：每個女生最多收到一個對象。

```
         1     1     1
  s ──→ 男 ──→ 女 ──→ t
  （s 連到每個男生；可配對的男→女各一條；每個女生連到 t）
```

如果把 s → 某男生（或某女生 → t）開成 2，就代表那個人可以找兩個對象。**用 capacity 就能控制每人配幾個。**

在這張網路上跑 max flow，結果是 **4**，代表可以配出 4 對。回到原圖解讀：**有流到 1 單位水的中間邊，就是配成功的那幾對。**

### 灌水過程：alternating path

細看它怎麼灌：一樣從沒有水的網路開始，建 G_f、灌水。特別的是容量全是 1，灌就灌 1、退就退 1，每條邊只有「有水／沒水」兩種狀態，有點像 binary。

假設跑到一半，已經配了 3 對：**1–2′、3–3′、5–4′**。這時的 G_f：

- 配到的邊（男 → 女）容量用完了，順向沒有邊，只剩**反向邊**（女 → 男，下面用 ⇠ 表示）。
- 沒配到的邊，在 G_f 上還是**順向邊**（男 → 女，用 → 表示）。

從 s 出發找到 t 的路，找到這條 augmenting path：

```
s → 2 → 2′ ⇠ 1 → 1′ → t

s → 2     ：2 是還沒配到的男生
2 → 2′    ：順向邊（新配）
2′ ⇠ 1    ：反向邊，在原圖是 1 → 2′（拆掉舊配對 1–2′）
1 → 1′    ：順向邊（新配）
1′ → t    ：1′ 是還沒配到的女生
```

它一定長這樣：

1. 先從 s 走到一個**還沒配到的男生**（2）。
2. 接著左右交替：順著到右邊（2 → 2′），沿反向邊倒回左邊（2′ → 1），再順著到右邊（1 → 1′）……右、左、右、左。
3. 最後到達右邊一個**還沒配到的女生**（1′），再流到 t。

這條路上順向邊（新配的）比反向邊（拆掉的舊配對）**多一條**：2–2′、1–1′ 新配，1–2′ 拆掉，所以配對數從 3 變 4，結果是 **1–1′、2–2′、3–3′、5–4′**。

直接解 bipartite matching 的專屬演算法，找的也是這種「順、反、順、反」的路，叫 **alternating path（交錯路徑）**。

> **例題** 用 max flow 解 bipartite matching 時，matching 裡找到的 augmenting path 有什麼特性？
> 答：順向、反向交替出現，起點是沒配到的男生、終點是沒配到的女生，順向邊比反向邊多一條，所以每找到一條，配對數 +1。

## 重點整理

- Flow network = directed graph + 每條邊的 capacity c(e)；source s 產生 flow、sink t 接收；無向邊 = 兩條相反方向的邊。
- 邊標 f / c；s-t flow f 把每條邊對應到非負實數；v(f) = source 送出的總量 = sink 收到的總量。
- Capacity constraint：0 ≤ f(e) ≤ c(e)；Flow conservation：每個 internal node 流入 = 流出（s、t 不算，像 KCL）。
- 不要求每條邊流滿。
- 任何把 s、t 分在兩側的 cut 都是 max flow 的上界；cut 容量只加 s 側 → t 側的邊，t 側 → s 側的邊不算。
- Min cut = 容量最小的 cut，最緊的上界；max flow = min cut。
- Undo flow：有水的邊可以反方向送水抵消（最多退回原有的量），空管不能退。
- Residual graph G_f：forward edge 容量 c − f（0 就不建），backward edge 容量 f（沒水就不建）。
- Augmenting path = G_f 上 s 到 t 的路；bottleneck = 路上最小的 residual capacity（不是 min cut）。
- 更新原 flow network：與原邊同方向 f(e) + b，反方向（eᴿ）f(e) − b；更新的是 G，G_f 之後重建。
- Augmenting path 可用 non-full forward edge 與 non-empty backward edge。
- Ford-Fulkerson：flow 從 0 開始，反覆找 augmenting path 加 bottleneck，G_f 中 s 到不了 t 時停止，得到 max flow。
- 停止時 G_f 中 s 走得到的點集合 S 給出 min cut (S, V − S)，其容量 = max flow。
- 例：s,a,b,t 小圖 max flow = 3；s,a,b,c,d,t 圖依序灌 8、6、3、2，max flow = 19 = min cut {s, b}（10 + 9）。
- Ford-Fulkerson 正確性兩層：每輪產生的 flow 都合法（feasible），停下來時是最佳解（由 max-flow min-cut theorem 保證）
- forward edge：residual = c − f，b ≤ c − f ⇒ f′ = f + b ≤ c；backward edge：residual = f，b ≤ f ⇒ f′ = f − b ≥ 0
- conservation：path 經過 internal node 時進、出各變動 b（等量加減），仍守恆；s、t 不檢查
- capacity 全為整數 ⇒ flow 與 residual capacity 永遠是整數（invariant），每輪至少 +1；小數先除以最大公因數；無理數容量可能不終止
- 每輪 v(f′) = v(f) + b，b > 0：path 的第一條邊必是從 s 出發的 forward edge
- C = s 所有出邊 capacity 總和（一個 cut，故是上界）；最多 C 輪，每輪 O(m) ⇒ Ford-Fulkerson O(mC)
- 壞例子：四條 100、中間一條 1，亂走 Z 字要 200 輪，好走法 2 輪
- O(mC) 是 pseudo-polynomial（C 是數值不是 input size），同 knapsack／subset sum 的 O(nW)
- 挑 augmenting path 的策略：bottleneck 大的、邊數最少的（BFS，Edmonds-Karp O(VE²)）、Δ-scaling O(E² log C)
- max flow 是 primal、min cut 是 dual；max-flow min-cut theorem：max flow 值 = min cut capacity
- cap(A, B) 只算 A → B 的邊；B → A 的邊不算
- 定理證明：①存在 cut 使 v(f) = cap(A, B)、②f 是 max flow、③G_f 無 augmenting path；①⇒②⇒③⇒①
- weak duality：任何 flow ≤ 任何 cut；v(f) = f_out(A) − f_in(A) ≤ f_out(A) ≤ cap(A, B)
- ③⇒①：A = G_f 中 s 走得到的點；A → B 的邊全飽和、B → A 的邊 flow 為 0 ⇒ v(f) = cap(A, B)；這也是找 min cut 的方法
- 資源分配：s → 人（需求）→ 資源（∞）→ t（資源上限），跑 max flow；難處在 model 成 flow network
- bipartite matching → max flow：加 s、t，邊一律左到右，所有 capacity 設 1；max flow 值 = 最大配對數，有 flow 的中間邊就是配對
- perfect matching 不一定 stable
- matching 中的 augmenting path 是 alternating path：從沒配到的男生到沒配到的女生，順反交替，順向邊多一條，配對數 +1

## 名詞對照

| 中文 | English |
|---|---|
| 網路流 | network flow |
| 流網路 | flow network |
| 流量 | flow |
| 容量 | capacity |
| 源點 | source |
| 匯點 | sink |
| 內部點 | internal node |
| 有向圖 | directed graph |
| 有向加權圖 | weighted digraph |
| 最大流 | maximum flow |
| 最大流問題 | maximum flow problem |
| 流值 | flow value, v(f) |
| 容量限制 | capacity constraint |
| 流量守恆 | flow conservation |
| 硬性限制 | hard constraint |
| 上界 | upper bound |
| 切割 | cut |
| 最小割 | min cut |
| 最大流最小割定理 | max-flow min-cut theorem |
| 退流 | undo flow |
| 剩餘圖 | residual graph |
| 剩餘容量 | residual capacity |
| 增廣路徑 | augmenting path |
| 瓶頸（瓶頸容量） | bottleneck (bottleneck capacity) |
| 順向邊 | forward edge |
| 反向邊 | backward edge |
| 運輸網路 | transportation network |
| 貪婪 | greedy |
| 可行解 | feasible solution |
| 流量守恆 | conservation constraint |
| 正規化 | normalization |
| 不變式 | invariant |
| 簡單路徑 | simple path |
| 擬多項式時間 | pseudo-polynomial time |
| 背包問題 | knapsack problem |
| 子集合加總 | subset sum |
| Δ 縮放 | Δ-scaling |
| 主問題 | primal |
| 對偶問題 | dual |
| 反證法 | proof by contradiction |
| 弱對偶 | weak duality |
| 飽和（流滿） | saturated |
| 資源分配 | resource allocation |
| 二分圖 | bipartite graph |
| 二分圖匹配 | bipartite matching |
| 最大二分圖匹配 | maximum bipartite matching |
| 完美匹配 | perfect matching |
| 穩定匹配 | stable matching |
| 交錯路徑 | alternating path |
