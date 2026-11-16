# 圖（基礎）

Graph 用點和邊描述「一群東西與它們之間的關係」：地圖、電路、專案流程、社群網路都是 graph。這章先建立名詞（有向／無向、degree、path、cycle、connected、complete、subgraph、connected component、strongly connected component），再學四種存法：adjacency matrix、adjacency list（含 inverse list 與一維陣列的 sequential 表示）、adjacency multilist、incidence matrix，比較它們的空間與時間。最後學兩種走訪：BFS 用 queue、DFS 用 stack，以及它們的 spanning tree、結果不唯一、時間複雜度與找 connected component。

## 學完這章要會
- 寫出 G = (V, E) 的定義，分辨 (u, v) 與 ⟨u, v⟩，知道 self loop、multigraph 不算一般 graph
- 用 degree 公式 ∑deg = 2e 算邊數；n 個點的 complete graph 有 n(n−1)/2（無向）或 n(n−1)（有向）條邊
- 判斷 connected、strongly connected，找出 connected component 與 SCC
- 畫出 adjacency matrix（無向對稱、有向不一定對稱）與 adjacency list，說出 O(V²) 與 O(V + E) 的空間差別，知道 dense／sparse 各該用哪一種
- 寫出 inverse adjacency list、sequential 表示、adjacency multilist 與 incidence matrix
- 手跑 BFS（queue）與 DFS（stack／遞迴），畫出 BFS／DFS spanning tree，知道結果不唯一
- BFS、DFS 的時間：adjacency matrix O(V²)、adjacency list O(V + E)
- 用 DFS／BFS 的呼叫次數算 connected component 數

## Graph 是什麼

這裡的 graph（圖）不是數學課 y = f(x) 畫出來的函數曲線，而是一種資料結構：**一群東西，加上它們之間的關係**。

- 每個東西叫 **node**，也叫 **vertex**（頂點）。兩個名字課本和考題都會用。
- 把兩個 node 連起來的線叫 **edge**（邊）。有邊，代表這兩點之間有某種關係。
- 最好懂的例子是社群網路（social network）：每個人是一個 node，兩個人是朋友就連一條 edge。

依照邊有沒有方向，graph 分成兩大類：

| 類型 | 邊的樣子 | 例子 |
|---|---|---|
| undirected graph（無向圖） | 普通的線，A–B 從哪一端看都一樣 | 朋友關係：你是小明的朋友，小明也是你的朋友 |
| directed graph（有向圖） | 箭頭，有起點和終點 | 網頁與超連結：頁 1 連到頁 2，不代表頁 2 連回頁 1 |

在有向圖裡，「頁 1 → 頁 2」和「頁 2 → 頁 1」是兩條不同的邊。

## 七橋問題與 degree

### Königsberg 七橋問題

graph 的起源是一個歷史問題。歐洲小鎮 Königsberg 有一條河，河上有七座橋，河把陸地分成四塊，標成 A、B、C、D，其中 A 是河中間的一個島。

把地圖抽象化（model 成 graph）：

- 大寫字母 A、B、C、D 代表陸地 → **vertex**
- 小寫字母 a～g 代表橋 → **edge**，一條 edge 就是一座橋

整張地圖只剩下點和線。問題是：**能不能從某一點出發，每座橋剛好走一次，最後回到起點？**

### Degree（分支度）

**degree** = 一個 vertex 連了幾條邊。七橋圖中：

| vertex | A | B | C | D |
|---|---|---|---|---|
| degree | 5 | 3 | 3 | 3 |

所求路線要滿足兩個條件：

1. 起點和終點是同一個點；
2. 每一座橋都要走過，而且只能走一次。

Euler 沒有一條一條去試，而是證明了定理：**要有這種路，每個 vertex 的 degree 都必須是偶數。** 理由是：走進一塊陸地就得再走出來，進、出各用一座橋，所以每個點的橋一定成對用掉。七橋圖的 degree 是 5、3、3、3，全是奇數，所以這種走法不存在。這大概是第一個把真實問題 model 成 graph 來解的例子。

> **重點** 連通圖中，每條邊恰走一次並回到起點，叫 **Euler circuit**，充要條件是所有點的 degree 皆為偶數。若不必回到起點，叫 **Euler path**，條件是奇數 degree 的點恰為 0 個或 2 個。

> **陷阱** 七橋圖 A=5、B=C=D=3，四個點全是奇數 degree，所以 Euler circuit 和 Euler path 都不存在（奇點有 4 個，不是 0 或 2）。

## Graph 的應用

graph 很簡單，只有兩個重要元件：**vertex 的集合**與 **edge 的集合**。有這兩樣就是一個 graph。應用非常廣：

### 電路 layout

晶片上的元件怎麼擺、線怎麼拉：在有限的空間裡，把 gate 用連線（route）接起來。看起來是硬體問題，本質是演算法問題。

### Shortest path（最短路徑）

導航（例如 Google Map）給一個起點 source、一個終點 destination，規劃路線；從起點到終點通常有好幾種走法。graph 後面的內容會一再回到這個問題。

- **空間上的 shortest path**：走最少的公里數。例如上面一條路 3 + 4 = 7 公里，下面一條 5 + 5 = 10 公里，空間上最短是上面那條。
- **時間上的 shortest path**：找 travel time 最短的路。上面那條雖然近，但有一段常塞車，要 30 分鐘；下面那條較遠，只要 15 分鐘。

> **觀念** 空間上最短，不一定時間上最短。同一張圖，edge 上記的是距離還是時間，答案就不同。

### 地圖就是一張 graph

地圖就是 G = (V, E)：V 是地點和路口，E 是道路。地圖上的 **POI**（Point of Interest）是景點、餐廳、地標這類點，例如一所大學、一家鬆餅店。

例如早期某地圖 app 圖資不足，搜尋「交通大學」卻找到上海的交大：該有的點、該有的 POI 不在資料裡。大廠都搶著做地圖，因為地圖是手機最常用的 app，從查詢就能知道一個區域的人在找什麼。

> **觀念** 導航把人帶進深山、帶到山崖邊，多半不是演算法爛，而是圖資不完整：真正的近路不在資料（graph）裡，找出來的 shortest path 就不是真的最短。要解決，得把圖資補齊。

### Project planning（專案規劃）

大型專案（例如開發一套作業系統）會分成很多 component：設計、實作、測試等部分工作。component 的先後關係畫成 graph：箭頭表示這個做完，下一個才能開始，而且下一個 component 必須在某個時間內完成。大公司的軟體非常龐大，開發流程通常畫成 graph 來掌控進度。

### 社群網路（social science）

最典型的是 Facebook：每個 user 是一個 vertex，兩人加為朋友就連一條 edge。

「推薦你可能認識的人」怎麼做？先看你的**鄰居**（你的朋友小明、小華），再看**鄰居的鄰居**：小明和小華都跟阿強是朋友，你和阿強有 2 位共同朋友，就推薦你加阿強。

## 正式定義：G = (V, E)

graph **G = (V, E)** 由兩部分組成：

- **V**：頂點的集合；要強調是哪張圖的，寫成 **V(G)**。
- **E**：邊的集合，寫成 **E(G)**。

邊可以有方向，也可以沒有，看需求：

- **undirected edge** 寫成小括號 **(u, v)**，u、v ∈ V。(u, v) 和 (v, u) 是同一條邊。
- **directed edge** 寫成角括號 **⟨u, v⟩**，表示 u 指向 v（u 是 tail、v 是 head）。⟨u, v⟩ 和 ⟨v, u⟩ 是兩條不同的邊。

### 三個範例圖

後面會一直用到這幾張圖：

```
G1：complete graph（無向）        G2：tree           G3：directed graph
V = {0, 1, 2, 3}                    0               0 ⇄ 1 → 2
E = {(0,1),(0,2),(0,3),            / \              E = {⟨0,1⟩, ⟨1,0⟩, ⟨1,2⟩}
     (1,2),(1,3),(2,3)}           1   2
每點都和其他所有點相連，共 6 條邊
```

- **G1** 是 complete graph（完全圖）：每個點都跟其他所有點相連，4 個點共 6 條邊。無向圖裡 (0,1) 和 (1,0) 是同一條，只算一次。
- **G2** 是一棵 tree。tree 也可以看成 graph：樹的 node 就是 vertex，樹枝就是 edge。
- **G3** 是有向圖：⟨0,1⟩ 是 0 指向 1，⟨1,0⟩ 是 1 指向 0，兩條不同；另外還有 ⟨1,2⟩，共 3 條邊。

## Self loop 與 multigraph

一般討論的 graph 有兩個限制。

### 限制一：沒有 self loop

自己連到自己的邊，例如 (0, 0)，叫 **self loop**，也叫 **self edge**。

它不是不可能出現。例如 formal language 裡的 **finite state machine（FSM，有限狀態機）**：compiler 檢查 C 程式的語法時，把語法表示成 graph，每個點代表一個 token（程式裡的一個字或符號）。程式能在這台 FSM 上走完，就編譯通過；在哪裡走不下去，就在那裡報 error。這種 graph 裡就會有自己連到自己的邊。

### 限制二：沒有 multiple edges

同兩點之間有好幾條邊，叫 **multiple edges**；有這種邊的圖叫 **multigraph**（多重圖）。例如 1 和 3 之間有兩條以上的邊，3 和 2 之間也有好幾條。

什麼時候會出現？看應用。在 Facebook 上，3 和 2 是兩個人，邊代表一次互動：3 PO 一篇文，2 回覆或按讚。3 一個月前 PO、這個月又 PO、上禮拜再 PO，2 每次都回應。為了保留每次互動的時間，不能只留最後一次，每次各記一條邊，同兩點之間就有很多條邊，形成 multigraph。

> **重點** 考試用的課本，預設討論的 graph **沒有 self loop，也沒有 multiple edges**。

## 基本術語：adjacent、path、cycle、DAG

- **adjacent（相鄰）**：若 (u, v) ∈ E，就說 u 和 v 相鄰，也就是兩點之間有一條邊直接連著。edge 表示成一對頂點（pair）；有向圖的 pair 有順序，⟨u, v⟩ 和 ⟨v, u⟩ 不同。
- **path（路徑）**：從一個點出發，一路經過的相鄰頂點序列（以及經過的邊）。例如在 G1 中 0 → 1 → 3 → 2 是一條 path。
- **path 的 length**：path 經過的**邊數**。0 → 1 → 3 → 2 經過 3 條邊，length 是 3。
- **simple path**：除了起點和終點可以相同之外，經過的點都必須 distinct（不重複）。0、1、3、2 每點只出現一次，是 simple path。
- **cycle（環）**：起點等於終點的 simple path，也就是走一走又繞回起點，例如 0 → 1 → 2 → 0。
- **DAG（directed acyclic graph）**：沒有任何 cycle 的有向圖，怎麼走都繞不回去。

> **陷阱** 「有 cycle 就不是 simple path」不精確。課本定義的 cycle，本身就是「起點等於終點的 simple path」；simple path 的定義正好允許起點和終點相同。

## Connected 與 complete graph 的邊數

### Connected、strongly connected

- **connected（連通）**：給兩個點 u、v（例如 G1 的 0 和 3），只要找得到一條 path 把它們接起來（如 0 → 1 → 3），就說 u、v connected。任兩點都 connected 的無向圖，叫 connected graph。
- **strongly connected（強連通）**：用在有向圖，條件更嚴格：任兩點 u、v 之間，u 到得了 v，**而且** v 也到得了 u。

> **陷阱** strongly connected 要求每一對 u、v 都**互相有 directed path**（u→v 與 v→u 都要有路），不是要求每兩點之間都有直接的邊。

### Complete graph 的邊數

complete graph：每個點都跟其他所有點有邊。n 個頂點時：

- **無向**：每兩點一條邊，就是從 n 個點挑 2 個：C(n, 2) = **n(n−1)/2**。n = 4 時是 6（就是 G1）。
- **有向**：u→v、v→u 是兩條不同的邊，每一對要乘 2：**n(n−1)**。n = 4 時是 12。

## Subgraph（子圖）

G′ 是 G 的 **subgraph**，條件是：

**V(G′) ⊆ V(G) 且 E(G′) ⊆ E(G)**

也就是取一部分的點、一部分的邊；留下的邊，兩端的點也都要還在。以 G1 為例：

```
(i)   0                     只有頂點 0，邊集合為空
(ii)  0、1、2 三個點         G1 原本 6 條邊，只留 2 條
(iii) 0、1、2、3 四個點      只留 (0,1)、(0,2)、(0,3)（示意）
(iv)  0、1、2、3 四個點      只留 (0,1)、(1,2)、(2,3)（示意）
```

- (i) 只有一個頂點、沒有邊，還算 graph 嗎？算：有點就是 graph；它的 V、E 都是原來的子集合，所以也是 subgraph。
- (ii) 取三個點、只保留兩條邊，一樣是 G1 的 subgraph。

## Connected component 與 strongly connected component

### Connected component（連通元件）

```
G4：
H1：  0 ─ 1          H2：  4 ─ 5 ─ 6 ─ 7
      │   │
      2 ─ 3
E(H1) = {(0,1), (0,2), (1,3), (2,3)}
E(H2) = {(4,5), (5,6), (6,7)}
```

G4 分成兩塊：H1 和 H2，各是一個 **connected component**。

- 在 H1 裡任兩點都有 path：0 和 3 有 0 → 1 → 3；2 和 1 有 2 → 0 → 1。
- 在 H2 裡也一樣：4 和 7 有 4 → 5 → 6 → 7。

component 也是一種 subgraph，但多了條件：裡面任兩點都必須 connected，而且它是 **maximal**（極大）：再多加任何一個點就不連通了。

> **陷阱** connected component 是 **maximal connected subgraph**。只取 H1 的 {0, 1} 雖然連通，但還能再加入 2、3 而保持連通，所以 {0, 1} 不是 component。

### Strongly connected component（SCC）

無向圖只要有一條 path，兩個方向就都能走；有向圖要兩個方向都有 path 撐著才行。

以 G3 為例（⟨0,1⟩、⟨1,0⟩、⟨1,2⟩）：

- 0 到得了 1（⟨0,1⟩），1 也到得了 0（⟨1,0⟩），所以 **{0, 1}** 是一個 strongly connected component。
- 頂點 2：從 1 到得了 2，但 2 回不到 1，所以 2 不能跟 0、1 合在一起，**{2}** 自己是一個 SCC。

G3 共有 **2 個 SCC：{0, 1} 和 {2}**。

只有自己一個點的 component 常叫 **isolated**（孤立點）。它沒有其他點可以比，「任兩點互相到得了」的條件不會被違反，所以符合定義；不過很多實際應用會把孤立點濾掉。

> **陷阱** 2 自成一個 SCC，是因為從 2 回不到 1，不是因為 2 沒有邊（⟨1,2⟩ 仍然存在）。

## Degree 與邊數公式

**degree**：一個 vertex 連接的邊數。G1 每個點都連 3 條，d₀ = d₁ = d₂ = d₃ = 3。

有向圖的 degree 分兩種：

- **in-degree**：指進來的邊數。G3 中指向 1 的只有 ⟨0,1⟩，所以 1 的 in-degree = 1。
- **out-degree**：指出去的邊數。1 指出去有 ⟨1,0⟩、⟨1,2⟩，所以 1 的 out-degree = 2。

設 graph 有 n 個頂點、e 條邊，dᵢ 是頂點 i 的 degree，則

**e = (d₀ + d₁ + … + dₙ₋₁) / 2 = (∑ dᵢ) / 2**

G1：(3 + 3 + 3 + 3) / 2 = 6。

為什麼除以 2？每條邊有兩個端點，在兩端的 degree 各被算一次，例如 (0,1) 在 d₀、d₁ 各算一次。

> **重點** 有向圖：∑ in-degree = ∑ out-degree = e，**不用除以 2**（每條有向邊只貢獻一個 in、一個 out）。

## Graph ADT

ADT（abstract data type）只說明這個資料結構能做哪些操作，不管怎麼實作。Graph ADT 的操作：

- **InsertVertex**：加入一個頂點
- **InsertEdge**：加入一條邊
- **DeleteVertex**：刪除一個頂點
- **DeleteEdge**：刪除一條邊
- **IsEmpty**：Boolean function，判斷 graph 是不是空的

## 表示法一：Adjacency matrix（鄰接矩陣）

紙上的 graph 電腦看不懂，要存進程式。最簡單的存法是 **adjacency matrix**：n 個頂點就用一個 n × n 的二維陣列，M[i][j] 表示 i 和 j 之間有沒有邊。**有邊填 1，沒邊填 0。**

### 無向圖

圖：A–B、B–C 兩條邊。

```
      A  B  C
  A [ 0  1  0 ]
  B [ 1  0  1 ]
  C [ 0  1  0 ]
```

- A–B 有邊：A 列 B 行、B 列 A 行**都**填 1（無向，兩格都要填）。
- B–C 也填兩格；A 和 C 之間沒邊，維持 0。
- 表格上方和左側是 node 的名字；要查 i、j 有沒有邊，看第 i 列第 j 行那一格，一步就知道。
- 外層有幾列，每一列就有幾格，所以是正方形；3 × 3 的矩陣代表 3 個 node。
- 就算沒有邊，每一列也要有「node 個數」那麼多格，沒邊的地方填 0（這點和 adjacency list 不同，list 只記真正的鄰居）。
- **無向圖的矩陣沿主對角線對稱**：M[i][j] = M[j][i]。

寫成 JavaScript 就是陣列裡放陣列：

```javascript
const matrix = [
  [0, 1, 0],  // A
  [1, 0, 1],  // B：跟 A、C 都有邊
  [0, 1, 0],  // C
];
```

### 有向圖

有向邊 ⟨u, v⟩ 只在 **u 列 v 行**填 1。圖：⟨B,A⟩、⟨C,A⟩（B 指向 A，C 指向 A）。

```
      A  B  C
  A [ 0  0  0 ]
  B [ 1  0  0 ]
  C [ 1  0  0 ]
```

- B 指向 A，只填 M[B][A] = 1；A 沒有指向 B，所以 M[A][B] = 0。
- 兩條有向邊，整張矩陣就只有兩個 1，不會在反方向自動補 1。
- 所以有向圖的矩陣通常**不對稱**。

> **重點** 有向圖矩陣：第 i **列**的總和 = i 的 **out-degree**；第 j **行**的總和 = j 的 **in-degree**。

### 再看一個例子：7 個點的有向圖

```
邊：1→2, 1→3, 1→4, 2→4, 2→5, 3→6, 4→3, 4→6, 4→7, 5→4, 5→7, 7→6

      1  2  3  4  5  6  7
  1 [ 0  1  1  1  0  0  0 ]
  2 [ 0  0  0  1  1  0  0 ]
  3 [ 0  0  0  0  0  1  0 ]
  4 [ 0  0  1  0  0  1  1 ]
  5 [ 0  0  0  1  0  0  1 ]
  6 [ 0  0  0  0  0  0  0 ]
  7 [ 0  0  0  0  0  1  0 ]
```

1 連到 2、3、4，所以 M[1][2]、M[1][3]、M[1][4] 都是 1；整張填完共 12 個 1。這是有向圖，M[1][2] = 1 但 M[2][1] = 0；若是無向圖，矩陣會 symmetric。

### 空間與 dense／sparse

- 空間是 **O(V²)**，只跟頂點個數有關，和邊有幾條無關：7 個點就是 7 × 7 = 49 格，真正是 1 的只有 12 格。
- graph 很 **dense**（稠密，例如 complete graph）時，格子幾乎都有值，用 matrix 存還算有效率。
- graph 很 **sparse**（稀疏）時，大部分是 0，浪費很多空間 → 改用 adjacency list。

## 表示法二：Adjacency list（鄰接串列）

每個 vertex 記一張清單，寫下跟它直接相連的鄰居。

### 無向圖：A–B、B–C

```
A → B
B → A → C
C → B
```

A 只連到 B；B 連到 A、C；C 只連到 B。三張清單合起來就記下了整張圖的邊。A 的清單有 B，B 的清單也有 A：同一條邊兩邊各記一次，這是無向圖的寫法。

JavaScript 可以用物件（key 是頂點名、value 是鄰居陣列），或把 A、B、C 改成編號 0、1、2，直接用陣列裡放陣列：

```javascript
const adjList = { A: ["B"], B: ["A", "C"], C: ["B"] };
// 改用編號：第 1 格放 B 的鄰居 [0, 2]
const adj = [[1], [0, 2], [1]];
```

### 用 linked list 存

每個頂點有一個 **head**（頭節點），後面接著它連到的點。以前面 7 個點的有向圖為例：

```
head
 1 → 2 → 3 → 4
 2 → 4 → 5
 3 → 6
 4 → 3 → 6 → 7
 5 → 4 → 7
 6 → (空)
 7 → 6
```

6 沒有指出去的邊，就是空串列。每條串列記的都是跟這個點 **adjacent** 的點，所以叫 adjacency list。

- **adjacent node**：只經過一條邊（one hop）就到得了的點。從 1 一步就到 2、3、4。
- 串列裡的順序不重要：1 的串列寫成 4、3、2 也可以，只要都是鄰居。

### 空間 O(V + E)

V 個 head 加上 E 個節點：這張圖是 7 + 12 = 19，比 matrix 的 49 格省很多。無向圖每條邊在兩端各記一次，節點數是 2E，但大 O 一樣是 **O(V + E)**。

### G1 與 G3 的 adjacency list

```
G1（complete，無向）        G3（有向）
0 → 1 → 2 → 3               0 → 1
1 → 0 → 2 → 3               1 → 0 → 2
2 → 0 → 1 → 3               2 → (空)
3 → 0 → 1 → 2
```

- G1 每個點都跟其他 3 個點相連，所以每條串列的節點數一樣，都是 3 個。
- G3：0 指向 1；1 指向 0、2；2 沒有指出去的邊，串列是空的。**有向圖的 adjacency list 只記指出去的邊**，串列長度 = out-degree。

## Inverse adjacency list：誰指向我

adjacency list 記「我指向誰」，串列長度是 **out-degree**。**inverse adjacency list**（inverse 是顛倒）反過來記「誰指向我」，串列長度是 **in-degree**。以 G3 為例：

```
adjacency list（我指向誰）    inverse adjacency list（誰指向我）
0 → 1                         0 → 1      （1 指向 0）
1 → 0 → 2                     1 → 0      （0 指向 1）
2 → (空)                      2 → 1      （1 指向 2）
```

為什麼需要它？假設只有 adjacency list，問「2 的 in-degree 是多少」：

1. scan list[0]：沒有 2。
2. scan list[1]：有 2，計數 +1。
3. scan list[2]：空的。

答案是 1，但只問一個點就要把所有串列掃過一遍；要算所有點的 in-degree 也一樣要全掃，很花時間。有了 inverse adjacency list，直接數 2 那條串列有幾個節點，答案就出來了。

## 表示法三：Sequential representation（一維陣列）

只用一個一維陣列 node[] 存整張 graph。以 G4（頂點 0～7，共 8 個；H1、H2 兩個 component，共 7 條邊）為例：

```
index: 0  1  2  3  4  5  6  7  8 | 9 10 11 12 13 14 15 16 17 18 19 20 21 22
node : 9 11 13 15 17 18 20 22 23 | 2  1  3  0  0  3  1  2  5  4  6  5  7  6
       └──── 各頂點鄰居的起點 ───┘ └──────────────── 鄰居區 ────────────────┘
```

- 前段 index 0～7 對應 8 個頂點，每格記「這個頂點的鄰居從陣列第幾格開始放」。
- index 8 沒有對應的頂點，只是標示結尾的記號（node[8] = 23）。
- node[0] = 9：0 的鄰居從 index 9 開始；index 9、10 放的是 2 和 1，所以 0 跟 2、1 相連，對照 H1 正確。
- 放到哪裡為止？看下一個頂點：node[1] = 11，1 的鄰居從 11 開始，所以 0 的鄰居是 index 9～10。**不用另外記終點，下一個頂點的起點減 1 就是。**
- node[7] = 22：index 22 放的是 6，所以 7 只跟 6 相連。

> **觀念** 這跟「多個 polynomial 共用一個陣列、用起點標出每個多項式範圍」的存法很像。

陣列大小：n + 1 格起點（含結尾記號），加上每條無向邊記兩次的 2e 格：**n + 2e + 1** = 8 + 14 + 1 = 23 格，就是 index 0～22。

> **陷阱** G4 的頂點是 0～7，共 **8** 個，不是 7 個。

缺點：**新增或刪除頂點時，movement cost 很高**。例如新增 vertex 8、9，它們的起點要放在 index 8、9，可是 index 9 原本放的是 0 的鄰居，後面整段都得往右 shift。

## 表示法四：Adjacency multilist

### 為什麼需要

在 adjacency list 裡，一條無向邊 (u, v) 被存了兩次：u 的串列裡有 v，v 的串列裡也有 u。同一條邊，兩份資訊。**adjacency multilist**（也叫 multi-linked list，很多條串列交織在一起）要做到的是：**一條邊只存一次**。

- adjacency list 以 **vertex** 為出發點建串列；
- adjacency multilist 以 **edge** 為出發點。

### Node 結構

每條邊用一個 node 表示。node 的第二、第三欄放這條邊兩端的 vertex，後兩欄是 pointer：

```
| (mark) | vertex1 | vertex2 | link1 | link2 |
```

- **link1**：跟第一個端點（vertex1）有關的下一條邊
- **link2**：跟第二個端點（vertex2）有關的下一條邊

### 例題：complete graph（頂點 0～3）

6 條邊依序編成 N0～N5：

```
head        vertex1 vertex2  link1  link2
0 → N0      N0:  0     1      N1     N3
1 → N0      N1:  0     2      N2     N3
2 → N1      N2:  0     3      0      N4
3 → N2      N3:  1     2      N4     N5
            N4:  1     3      0      N5
            N5:  2     3      0      0
（pointer 欄的 0 代表 null）
```

沿 pointer 追蹤：

1. head 0 指向 N0 = (0,1)。N0 的 link1 = N1：除了 (0,1)，下一條跟 0 有關的邊在 N1。
2. N1 = (0,2)，link1 = N2：跟 0 有關的還有 N2。
3. N2 = (0,3)，link1 = 0（null）：跟 0 有關的邊到此結束。
4. vertex 0 的串列是 **N0 → N1 → N2**，內容正好是 adjacency list 裡 0 的鄰居 1、2、3。
5. 再看 N0 的 link2：跟 1 有關的下一條邊在 N3 = (1,2)；N3 的 link1 指向 N4 = (1,3)；N4 之後是 null。vertex 1 的串列是 **N0 → N3 → N4**。
6. 同理，vertex 2 的串列是 N1 → N3 → N5，vertex 3 的串列是 N2 → N4 → N5。

### 節點數與畫法

- multilist 的 node 數 = graph 的**邊數**：這張 complete graph 有 6 條邊，就是 6 個 node；adjacency list 則要 12 個節點。
- 畫法：
  1. 數 graph 有幾條邊；
  2. 每條邊編號：先以 0 開頭的 (0,1)、(0,2)、(0,3)，再以 1 開頭、以 2 開頭的；
  3. 把每個 node 的兩個 pointer 填上。

> **觀念** 一般 linked list 的 node 只屬於一條 list；multilist 的 node 有兩個 pointer，同時屬於兩條 list（N0 同時在 0 和 1 的串列裡），所以叫 multi-linked list。

> **陷阱** adjacency list 和 adjacency multilist 名字只差幾個字母，意思完全不同：一個以**頂點**為出發點，一個以**邊**為出發點。

### 四種表示法比較

| 表示法 | 空間 | 優點 | 缺點 |
|---|---|---|---|
| adjacency matrix（二維） | O(V²) | 查 i、j 有沒有邊一步就知道；dense graph 有效率 | sparse graph 浪費空間 |
| adjacency list | O(V + E) | sparse graph 省空間 | 查一條邊要掃串列；有向圖求 in-degree 要全掃（可用 inverse adjacency list） |
| sequential（一維陣列） | n + 2e + 1 格 | 很省 | 增刪頂點要搬動整個陣列 |
| adjacency multilist | 每條邊一個 node | 每條邊只存一次 | 結構較複雜，pointer 要分清楚屬於哪一端 |

## 另一種存法：Incidence matrix（關聯矩陣）

incidence matrix 記的是「哪條邊連著哪個點」。

- adjacency matrix：列是 node、行也是 node → 一定是 **V × V** 的正方形。
- incidence matrix：**列是 node、行是 edge**，每一直行是一條邊 → 大小 **V × E**，列數和行數不一定相同，可以是長方形。

### 無向圖：e1 = (A,B)、e2 = (B,C)

```
      e1  e2
  A [  1   0 ]
  B [  1   1 ]
  C [  0   1 ]
```

一條邊連著兩個 node，所以每一行裡恰有兩個 1。e1 那一行 A = 1、B = 1、C = 0，表示 e1 連接 A 和 B。

### 有向圖：e1 = ⟨B,A⟩、e2 = ⟨C,A⟩

邊**離開**的點填 **−1**，**進入**的點填 **+1**：

```
      e1  e2
  A [ +1  +1 ]
  B [ −1   0 ]
  C [  0  −1 ]
```

A 被兩條邊指進來，A 那一列是兩個 +1，正好是它的 in-degree 2。JavaScript 寫法一樣是陣列裡放陣列，每個小陣列是一個點的那一列：

```javascript
const incidence = [
  [ 1,  1],  // A
  [-1,  0],  // B
  [ 0, -1],  // C
];
```

## Weighted graph 與 network

### Weight（權重）

edge 上可以加一個數字，叫 **weight**，表示這條邊多遠、多貴、要多久（從一個頂點到另一個頂點的 cost，或兩點的距離）。前面的例子都是 **unweighted**，只管有沒有邊，所以只填 0、1。

把 graph 當地圖：A–B 4 公里、B–C 2 公里，矩陣就直接填權重：

```
      A  B  C
  A [ 0  4  0 ]
  B [ 4  0  2 ]
  C [ 0  2  0 ]
```

> **陷阱** 權重可以是任何數，包括 1、0 甚至負數，不一定「大於 1」。所以 weighted adjacency matrix 常用 **∞**（或另設記號）表示沒有邊，以免跟權重 0 混淆。

### Network 與 road network

邊有 weight 的 graph 統稱 **network**。這裡的 network 不是電腦網路、Wi-Fi 那種，而是有權重的 graph。

導航用的道路網 **road network** 就是一個 graph：

- **vertex** 是交叉路口（intersection）；
- 一條路被路口切成很多 **road segment**（路段），每一段是一條 **edge**；
- 道路通常雙向，去也會過、回也會過，所以 road network 是**有向圖**，雙向道就是兩條方向相反的邊；
- 路段的 cost 是實際距離（physical distance）。

給起點 S、終點 D，找一組路段把 S 接到 D 且距離總和最小，就是 **shortest path**。例如路線 S → B → A → C → D 的距離總和 8 是所有走法中最短的。

## Graph traversal：visit 與 explore

tree 有 traversal（pre-order、level order 等），可以用來判別結構、複製、比較。graph 也有兩種 traversal：

- **DFS**（depth first search，深度優先搜尋）
- **BFS**（breadth first search，廣度優先搜尋）

先學兩個詞：

- **visit（拜訪）**：走到某個頂點上。
- **explore（探索）**：站在某個頂點上，去看（拜訪）它所有的鄰居。

BFS 和 DFS 的差別，就在**什麼時候去探索下一個點**。

### 小例子

這張圖其實是一棵樹，但樹也是一種 graph：

```
        1
      / | \
     2  4  5
   / | \
  3  6  7
邊：(1,2) (1,4) (1,5) (2,3) (2,6) (2,7)
```

**BFS**（從 1 開始；起點可任選）：

1. 拜訪 1。
2. 探索 1：拜訪它所有鄰居 2、4、5（順序任意）。結果 1 2 4 5。
3. 下一個探索的點照拜訪先後挑：2 最早 → 探索 2，拜訪 7、3、6（順序同樣任意）。
4. 探索 4、5、7、3、6，都沒有新鄰居。

BFS = **1 2 4 5 7 3 6**

**DFS**（從 1 開始）：

1. 拜訪 1，開始探索 1，走到 2、拜訪 2。
2. 1 還有 4、5 沒拜訪，但先不管：到了新頂點 2，就改成探索 2。
3. 2 的鄰居有 7、6、3，先走 3；3 又是新點，6、7 先放著。
4. 探索 3：除了 2 沒有別的鄰居 → 3 探索完，退回 2。
5. 2 還有 6：拜訪 6，6 沒有其他鄰居，退回 2；再拜訪 7，退回 2。2 處理完，退回 1。
6. 1 還有 4：拜訪 4，退回；再拜訪 5，退回 1。全部結束。

DFS = **1 2 3 6 7 4 5**

> **重點** BFS 把一個點**探索完**（鄰居全拜訪），才換下一個點。DFS 一拜訪到新點，就把目前的點 **suspend（暫停）**，先去探索新點：從 1 拿到 2 就暫停 1，從 2 走到 3 就暫停 2，所以會一路往深處鑽。

### 在 binary tree 上

```
        1
      /   \
     2     3
    / \   / \
   4   5 6   7
```

- **BFS**：拜訪 1；探索 1 → 拜訪 2、3；探索 2、3 → 拜訪 4、5、6、7。結果 **1 2 3 4 5 6 7**，就是一層一層、每層由左到右的 **level order traversal**。
- **DFS**：拜訪 1；1 → 2（暫停 1）；2 → 4（暫停 2）；4 下面沒東西，退回 2 走到 5；5 也沒有，退回 1；走右邊 3 → 6，退回 3 → 7。結果 **1 2 4 5 3 6 7**，正好是 **pre-order**：先根、再左子樹、再右子樹。

> **重點** DFS 像 tree 的 **pre-order**；BFS 像 tree 的 **level order**。

## BFS：用 queue

BFS 需要的資料結構是 **queue**（佇列）：像排隊，先排進去的先出來（FIFO）。

### 例題：10 個頂點、13 條邊

```
邊：(1,2) (1,4) (2,3) (2,5) (2,7) (2,8) (3,4) (3,9) (3,10)
    (5,6) (5,7) (5,8) (7,8)
```

- **初始步驟**：選一個起點（哪個都可以），這裡選 1：拜訪 1、寫進結果、放進 queue。
- **重複步驟**：從 queue 取出一個頂點，探索它：把還沒拜訪的鄰居依序拜訪、寫進結果、放進 queue。

| 取出 | 檢查鄰居 | 新拜訪 | queue（取出並加入後） | 結果 |
|---|---|---|---|---|
| （初始） | | 1 | 1 | 1 |
| 1 | 4、2 | 4、2 | 4 2 | 1 4 2 |
| 4 | 1 已拜訪、3 | 3 | 2 3 | 1 4 2 3 |
| 2 | 1、3 已拜訪；5、8、7 | 5、8、7 | 3 5 8 7 | 1 4 2 3 5 8 7 |
| 3 | 4、2 已拜訪；10、9 | 10、9 | 5 8 7 10 9 | … 10 9 |
| 5 | 2、8、7 已拜訪；6 | 6 | 8 7 10 9 6 | … 6 |
| 8 | 2、5、7 都已拜訪 | 無 | 7 10 9 6 | |
| 7 | 都已拜訪 | 無 | 10 9 6 | |
| 10、9、6 | 都已拜訪 | 無 | 空 | |

queue 空了，BFS 完成：**1 4 2 3 5 8 7 10 9 6**。

### BFS spanning tree 與 cross edge

每次拜訪新點時用到的邊（實線）組成 **BFS spanning tree**：用最少的邊把所有頂點連起來，10 個點剛好 9 條邊。

```
BFS spanning tree（從 1 出發）：
1 ─┬─ 4 ── 3 ─┬─ 10
   │          └─ 9
   └─ 2 ─┬─ 5 ── 6
         ├─ 8
         └─ 7
非樹邊（虛線）：(2,3) (5,7) (5,8) (7,8)
```

像 8–7 這種連到已拜訪點的邊，不會長出新樹枝，畫成虛線；BFS 裡的非樹邊叫 **cross edge**。

> **陷阱** 無向圖的 BFS 中，非樹邊兩端的層數最多差 1，所以都是 cross edge，**不會出現 back edge**。

### BFS 的兩個自由與兩條規則

- 自由一：起點任選。
- 自由二：探索一個點時，鄰居可以用任意順序拜訪。
- **規則一**：選一個點來探索，必須把它的鄰居**全部拜訪完**，才能換下一個點。例如探索 1 時，4 和 2 都要先拜訪，之後才能去探索 4。
- **規則二**：下一個要探索的點，**只能從 queue 取**。所以 BFS 會一層一層往外擴。

### 同一張圖，很多種 BFS

只要守住兩條規則，同一張圖能寫出很多種合法 BFS：

- 從 1 開始，先拜訪 2 再拜訪 4 → queue 是 2 4，先探索 2：依序拜訪 8、5、7、3；探索 4：3 已拜訪；探索 8：5、7 已拜訪；接著依 queue 輪到 5：拜訪 6；再探索 7、3：從 3 拜訪 10、9。結果 **1 2 4 8 5 7 3 6 10 9**。
- 從 5 開始：探索 5，拜訪 2、8、7、6；探索 2，拜訪 3、1；8、7、6 沒有新點；探索 3，拜訪 9、10、4。結果 **5 2 8 7 6 3 1 9 10 4**。

> **陷阱** 依規則二，下一個探索的點一定是最早被拜訪、還在 queue 前端的那個。第一個例子拜訪 2、4、8、5、7、3 後，探索完 2、4、8，下一個輪到的是 5（不是 7）。

> **重點** BFS 答案不唯一。考試通常會規定「鄰居依編號由小到大」，答案才唯一。

### 再看一個例子：A B D E C

```
      A
    / | \
   B  D  E
    \ | /
      C
邊：(A,B) (A,D) (A,E) (B,C) (D,C) (E,C)
```

一層一層看：第一層 A，第二層 B、D、E，第三層 C，每層由左到右輸出，BFS = **A B D E C**。考出來是送分題，但要會寫程式：

| 步驟 | 動作 | queue |
|---|---|---|
| 1 | 輸出 A；A 的鄰居 B、D、E 依序放進 queue | B D E |
| 2 | 取出 B、輸出 B；B 連到 C，C 放進 queue | D E C |
| 3 | 取出 D、輸出 D；D 也連到 C，但 C 已在 queue 裡，不再放 | E C |
| 4 | 取出 E、輸出 E；E 連到 C，同樣不放 | C |
| 5 | 取出 C、輸出 C | 空 |

> **觀念** BFS 要在**放進 queue 的時候**就做記號（visited），同一個點才不會進 queue 兩次。

### BFS 程式

```c
void bfs(int v)
{ /* 從 v 開始做 BFS；visited[] 初值全為 FALSE */
    nodePointer w;
    front = rear = NULL;          /* 初始化 queue */
    printf("%5d", v);
    visited[v] = TRUE;
    addq(v);
    while (front) {               /* queue 不空就繼續 */
        v = deleteq();
        for (w = graph[v]; w; w = w->link)
            if (!visited[w->vertex]) {
                printf("%5d", w->vertex);
                addq(w->vertex);
                visited[w->vertex] = TRUE;   /* 進 queue 時就標記 */
            }
    }
}
```

## DFS：用 stack

DFS 用的資料結構是 **stack**（堆疊）：像一疊盤子，最後放上去的最先拿走（LIFO）。

### 例題：同一張 10 頂點的圖

- **初始步驟**：從 1 開始，拜訪 1，放進 stack。
- **規則**：新拜訪的點就開始探索；一拜訪到新點，就把目前的點**暫停**、留在 stack 裡，先探索新點。

| 動作 | stack（底 → 頂） | 結果 |
|---|---|---|
| 拜訪 1 | 1 | 1 |
| 探索 1 → 拜訪 4（2 先放著，1 暫停） | 1 4 | 1 4 |
| 探索 4 → 拜訪 3 | 1 4 3 | 1 4 3 |
| 探索 3 → 拜訪 10 | 1 4 3 10 | … 10 |
| 10 沒有其他鄰居，pop，退回 3 | 1 4 3 | |
| 探索 3 → 拜訪 9 | 1 4 3 9 | … 9 |
| 9 走不下去，pop，退回 3 | 1 4 3 | |
| 3 的下一個鄰居 2 → 拜訪 2 | 1 4 3 2 | … 2 |
| 探索 2 → 拜訪 8 | 1 4 3 2 8 | … 8 |
| 探索 8 → 拜訪 7 | 1 4 3 2 8 7 | … 7 |
| 探索 7 → 拜訪 5 | 1 4 3 2 8 7 5 | … 5 |
| 探索 5 → 拜訪 6 | 1 4 3 2 8 7 5 6 | … 6 |
| 6 沒有其他鄰居，pop，退回 5 | 1 4 3 2 8 7 5 | |
| 5 的鄰居 2、8 都已拜訪，pop，退回 7 | 1 4 3 2 8 7 | |
| 7 能去的 2 已拜訪，pop；之後 8、2、3、4、1 依序 pop | 空 | |

DFS = **1 4 3 10 9 2 8 7 5 6**

> **觀念** 怎麼知道要退回哪裡？看 stack 頂端，這就是 stack 的用途。DFS 一路往深處走：幾乎所有點都先被**拜訪**，之後才一個一個被**探索完**。

### DFS spanning tree 與 back edge

```
DFS spanning tree（從 1 出發）：
1 ── 4 ── 3 ─┬─ 10
             ├─ 9
             └─ 2 ── 8 ── 7 ── 5 ── 6
非樹邊（虛線，back edge）：(1,2) (2,5) (2,7) (5,8)
```

- DFS 走過的實線邊組成 **DFS spanning tree**，又深又窄。
- 不在樹上的虛線邊叫 **back edge**，它們都連回**祖先**（例如 (5,8)：8 是 5 的祖先）。
- 對這棵樹做 pre-order（先根、再左、再右），得到 1 4 3 10 9 2 8 7 5 6，正好就是 DFS 的順序。所以 DFS 就像對 graph 做 pre-order。

> **重點** 無向圖的 DFS 只有 tree edge 和 **back edge**（非樹邊一定連回祖先）；BFS 的非樹邊才叫 **cross edge**。

### 同一張圖，很多種 DFS

- 從 1 開始，先走 2：2 → 8 → 7 → 5 → 6；6 走不下去退回 5，5 處理完再退回 7、8、2；從 2 走到 3、再到 9；9 退回 3 走到 10，10 退回 3 走到 4；4 的鄰居 1 已拜訪，一路退回。結果 **1 2 8 7 5 6 3 9 10 4**。
- 從 3 開始：3 → 4 → 1 → 2 → 5 → 6；6 退回 5，從 5 走到 7、再到 8；8 走完，一路退回 7、5、2、1、4，回到 3；3 還剩 10、9：走到 10、退回，再走到 9。結果 **3 4 1 2 5 6 7 8 10 9**。

> **重點** DFS 的起點、鄰居都能任選；唯一的規則是：**拜訪到新頂點，就暫停目前的點，先探索新點。**

### 照 adjacency list 做 DFS

DFS 很像 tree 的 pre-order：有左邊就一直往左走，走到不能走為止。假設 graph 用 adjacency list 存，另有一個 Boolean array **visited[]** 記錄每個頂點有沒有拜訪過（拜訪過 mark 成 1，沒有是 0）。

規則：看目前頂點的串列，**第一個沒拜訪過的**就去拜訪，然後 recursive 地繼續。

```
0 → 1 → 2              邊：(0,1) (0,2) (1,3) (1,4) (2,5) (2,6)
1 → 0 → 3 → 4              (3,7) (4,7) (5,7) (6,7)
2 → 0 → 5 → 6
3 → 1 → 7
4 → 1 → 7
5 → 2 → 7
6 → 2 → 7
7 → 3 → 4 → 5 → 6
```

1. 從 0 出發：拜訪 0、輸出 0，visited[0] = 1。
2. 0 的串列第一個是 1，沒拜訪過 → 走到 1。
3. 1 的串列：0 已輸出過，跳過；3 沒拜訪過 → 拜訪 3。
4. 3 的串列：1 已拜訪；7 → 拜訪 7。
5. 7 的串列：3 已拜訪；4 → 拜訪 4。
6. 4 的串列：1、7 都拜訪過，沒路可走 → 像 recursive 函式 return，回到呼叫它的 7。
7. 7 的串列繼續看：5 → 拜訪 5；5 的串列：2 → 拜訪 2；2 的串列：0、5 已拜訪，6 → 拜訪 6。
8. 之後一路 return，所有點都拜訪過。

DFS = **0 1 3 7 4 5 2 6**

```
visited（結束時）：
index : 0 1 2 3 4 5 6 7
value : 1 1 1 1 1 1 1 1
```

### DFS 結果不唯一

問：DFS 的結果是唯一的嗎？
答：不一定。adjacency list 沒規定小的排前面，串列存的順序不同，走出來就不同。例如 0 的串列可以寫 1、2，也可以寫 2、1：左邊先走 1，右邊先走 2。若只把 0 的串列改成 0 → 2 → 1，DFS 會變成 0 2 5 7 3 1 4 6（示意）。

### DFS 程式

給一個點 v，從 v 的串列看起，沒拜訪過的就 output，然後 recursive 做下去：

```c
#define FALSE 0
#define TRUE  1
short int visited[MAX_VERTICES];

void dfs(int v)
{ /* 從 v 開始做 DFS；visited[] 初值全為 FALSE */
    nodePointer w;
    visited[v] = TRUE;
    printf("%5d", v);
    for (w = graph[v]; w; w = w->link)
        if (!visited[w->vertex])
            dfs(w->vertex);
}
```

DFS 有兩種寫法：寫成 recursive（如上），或不用遞迴、自己用一個 stack 實作：

```python
def dfs_iterative(graph, s):
    visited = {s}
    order = [s]
    stack = [(s, iter(graph[s]))]      # 堆疊存「頂點 + 它的串列看到哪裡」
    while stack:
        v, it = stack[-1]              # 看 stack 頂端：目前在探索的點
        for w in it:
            if w not in visited:       # 拜訪到新點：暫停 v，push w
                visited.add(w)
                order.append(w)
                stack.append((w, iter(graph[w])))
                break
        else:
            stack.pop()                # v 的鄰居都拜訪過：探索完，退回
    return order
```

## BFS、DFS 的時間複雜度

| 表示法 | DFS | BFS |
|---|---|---|
| adjacency list | O(n + e) | O(n + e) |
| adjacency matrix | O(n²) | O(n²) |

（n = 頂點數 V，e = 邊數 E）

- **adjacency list**：每個頂點只拜訪一次，每條串列的節點（每條邊）也只被看常數次，所以是 O(n + e)。只計邊時常簡寫成 O(e)。
- **adjacency matrix**：每個點都要掃一整列 n 格才知道鄰居是誰，n 個點就是 n × n = O(n²)。

> **陷阱** 說「BFS、DFS 都是 O(n)，因為每個點只拜訪一次」只算了一半：探索時還要檢查每條邊。考試以 adjacency list O(V + E)、adjacency matrix O(V²) 為準。

## 應用：找 connected component

BFS、DFS 能做很多事，例如算 graph 有幾個 connected component（課本 Program 6.3）：

```c
void connected(void)
{ /* 找出 graph 的所有 connected component */
    int i;
    for (i = 0; i < n; i++)
        if (!visited[i]) {
            dfs(i);           /* 一次 dfs 走完一整個 component */
            printf("\n");
        }
}
```

以 G4 為例：

1. i = 0：沒拜訪過 → dfs(0)，一次走完整個 H1（0、1、2、3）。
2. i = 1、2、3：都拜訪過，跳過。
3. i = 4：沒拜訪過 → dfs(4)，走完 H2（4、5、6、7）。
4. i = 5、6、7：跳過。

dfs 被呼叫 2 次 → G4 有 2 個 connected component。

> **重點** 呼叫幾次 dfs（或 bfs），就有幾個 connected component。用 adjacency list 時整體仍是 O(n + e)。

> **觀念** 這些程式一定要親手 trace：拿一張小圖，一步一步追 visited[]、queue 或 stack 的變化。

## 重點整理
- Graph G = (V, E)：V 頂點集合、E 邊集合；無向邊 (u,v) = (v,u)，有向邊 ⟨u,v⟩ ≠ ⟨v,u⟩（u 是 tail、v 是 head）
- Euler circuit（每邊恰走一次回到起點）：連通且所有點 degree 皆偶數；Euler path：奇數 degree 點恰 0 或 2 個；七橋 A=5、B=C=D=3，兩者皆不存在
- 課本預設 graph 沒有 self loop、沒有 multiple edges（有 multiple edges 的叫 multigraph）
- path length = 經過的邊數；simple path：除起終點外點不重複；cycle = 起點等於終點的 simple path；DAG = 無 cycle 的有向圖
- n 點 complete graph 邊數：無向 n(n−1)/2，有向 n(n−1)（n = 4：6 與 12）
- subgraph：V(G′) ⊆ V(G) 且 E(G′) ⊆ E(G)
- connected component = maximal connected subgraph；strongly connected 要求任兩點互相有 directed path（不是直接有邊）
- G3（⟨0,1⟩⟨1,0⟩⟨1,2⟩）有 2 個 SCC：{0,1}、{2}
- e = (∑ dᵢ)/2；有向圖 ∑ in-degree = ∑ out-degree = e
- Graph ADT：InsertVertex、InsertEdge、DeleteVertex、DeleteEdge、IsEmpty
- adjacency matrix：空間 O(V²)，查邊 O(1)；無向必對稱；有向圖第 i 列和 = out-degree、第 j 行和 = in-degree；適合 dense graph
- adjacency list：空間 O(V + E)（無向圖 2E 個節點）；有向圖只記指出去的邊，串列長度 = out-degree；適合 sparse graph
- inverse adjacency list：記「誰指向我」，串列長度 = in-degree
- sequential（一維陣列）：大小 n + 2e + 1，前 n 格存鄰居起點、node[n] 為結尾；鄰居範圍 = node[i] ～ node[i+1]−1；缺點：增刪頂點要 shift 整個陣列
- adjacency multilist：每條邊一個 node（node 數 = 邊數），欄位 vertex1、vertex2、link1、link2；一個 node 同時在兩條串列上
- incidence matrix：列是 node、行是 edge，大小 V × E；無向每行兩個 1；有向離開 −1、進入 +1
- weighted graph 稱 network；矩陣填權重，沒邊常用 ∞（權重可為 0 或負）
- BFS 用 queue（像 level order），DFS 用 stack／recursion（像 pre-order）
- BFS 規則：探索一點要拜訪完它所有鄰居才換下一點；下一個探索點只能從 queue 取；放進 queue 時就標記 visited
- DFS 規則：一拜訪到新點就暫停目前的點、先探索新點
- BFS、DFS 結果都不唯一（起點、鄰居順序可任選）；考題常規定鄰居由小到大
- 無向圖：BFS 的非樹邊是 cross edge（層差 ≤ 1），DFS 的非樹邊是 back edge（連回祖先）；n 點的 spanning tree 有 n−1 條邊
- BFS／DFS 時間：adjacency list O(n + e)，adjacency matrix O(n²)
- connected()：對每個未拜訪頂點呼叫一次 dfs，呼叫次數 = connected component 數

## 名詞對照
| 中文 | English |
|---|---|
| 圖 | graph |
| 頂點 | vertex / node |
| 邊 | edge |
| 無向圖 | undirected graph |
| 有向圖 | directed graph |
| 分支度 | degree |
| 入分支度 | in-degree |
| 出分支度 | out-degree |
| 尤拉迴路 | Euler circuit |
| 尤拉路徑 | Euler path |
| 最短路徑 | shortest path |
| 興趣點 | POI (Point of Interest) |
| 完全圖 | complete graph |
| 自身迴圈 | self loop / self edge |
| 多重圖 | multigraph |
| 有限狀態機 | finite state machine (FSM) |
| 相鄰 | adjacent |
| 路徑 | path |
| 簡單路徑 | simple path |
| 環 | cycle |
| 有向無環圖 | DAG (directed acyclic graph) |
| 連通 | connected |
| 強連通 | strongly connected |
| 子圖 | subgraph |
| 連通元件 | connected component |
| 強連通元件 | strongly connected component (SCC) |
| 孤立點 | isolated vertex |
| 抽象資料型態 | ADT (abstract data type) |
| 鄰接矩陣 | adjacency matrix |
| 鄰接串列 | adjacency list |
| 反鄰接串列 | inverse adjacency list |
| 循序表示法 | sequential representation |
| 鄰接多重串列 | adjacency multilist (multi-linked list) |
| 關聯矩陣 | incidence matrix |
| 稠密／稀疏 | dense / sparse |
| 權重 | weight |
| 加權圖 | weighted graph / network |
| 道路網 | road network |
| 路段 | road segment |
| 交叉路口 | intersection |
| 走訪 | traversal |
| 拜訪／探索 | visit / explore |
| 深度優先搜尋 | depth first search (DFS) |
| 廣度優先搜尋 | breadth first search (BFS) |
| 佇列 | queue |
| 堆疊 | stack |
| 生成樹 | spanning tree |
| 交叉邊 | cross edge |
| 後退邊 | back edge |
| 層序走訪 | level order traversal |
| 前序走訪 | pre-order traversal |
