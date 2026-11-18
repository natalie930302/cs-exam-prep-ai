# NP理論

有些問題到現在只找得到指數時間的解法，卻沒人能證明它「一定」沒有多項式解。這一章建立判斷問題難度的工具：P、NP、EXP、R 的難度軸，decision 版與 optimization 版，非確定型演算法與 verifier，polynomial-time reduction，以及 NP-hard、NP-complete 的定義和 Cook–Levin 定理；最後實際用 reduction 證明 TSP、clique decision problem 是 NP-complete。考試重點：四個類別的關係與圖、證明 NPC 的兩個步驟（含 reduction 方向）、常見 NPC 問題清單，以及完整寫出一個 reduction 證明（例如 HC ≤p TSP、SAT ≤p CDP）。

## 學完這章要會

- 分辨 polynomial 與 exponential，把問題放上 P、EXP、R 的難度軸，說明為什麼大部分問題不可計算。
- 把 optimization 問題改寫成 decision 版，並用 binary search 從 decision 版找回最佳值。
- 寫出 class P、class NP 的定義；用非確定型演算法（猜）與 verifier（certificate）兩種角度說明 NP，證明 TSP ∈ NP。
- 說明 P ⊆ NP，以及 P vs NP 為什麼是 open problem。
- 寫出 X ≤p Y 的定義（yes 對 yes、no 對 no、多項式時間、輸入不能爆炸），分清 reduction 的三種用法與方向。
- 寫出 NP-hard、NP-complete 的定義，畫出 P、NP、NP-complete、NP-hard 的關係圖，說明「一個 NPC 有 poly 解 ⇒ P = NP」。
- 說出 Cook–Levin 定理（SAT 是 NPC）、CNF 與 k-SAT，知道 2SAT ∈ P、3SAT 是 NPC，列出常見 NPC 問題。
- 用兩個步驟證明 NP-complete：先證 L ∈ NP，再把已知 NPC 問題 reduce 到 L。
- 完整寫出 HC ≤p TSP 與 SAT ≤p clique decision problem 的建構與雙向證明。

## 有沒有比 polynomial 更久的問題

前面各章的問題，幾乎都能用 polynomial time（多項式時間）求出最佳解。這一章反過來問：有沒有一些問題，需要比 polynomial time 更久才做得完？

TSP（旅行推銷員）、SAT（可滿足性）、Knapsack（背包）這類問題目前看起來都很難。難在哪？到目前為止，**沒有人找到 polynomial time 的演算法能把它們 optimally（求出最佳解）解出來**。圍繞這件事有兩個重點：

1. **polynomial time reduction**（多項式時間歸約）：把一個問題轉成另一個問題。
2. **NP-completeness**（NP 完全性）：問題有多難的分級。

### 1960 年代的共識，與分不下去的兩群

大約 1960 年代大家就有共識：**找得到 polynomial time 演算法，就算 efficient（有效率）**，這種問題實際上也算容易解，例如 MST、最短路徑、排序。

於是很自然地想把問題分成兩群：

- 簡單的：有 polynomial 演算法。
- 難的：不存在 polynomial 演算法。

可是分不下去。對 TSP、SAT 這些問題，我們只知道「目前沒人找到」polynomial 解，卻不知道它是不是「真的不存在」。這個問題在 2000 年被列入 Clay 研究所的千禧年大獎難題（Millennium Prize Problems），證明出它們到底簡單還是難，就能得獎、在歷史上留名。

> **陷阱** 千禧年大獎難題共 **7** 題（不是「十大」），P vs NP 是其中一題，獎金 100 萬美元。

> **觀念** 一路學下來的每一章，都是能 polynomial time 求最佳解的問題，很容易讓人以為到處都是簡單問題。其實那只是少數。

後面會看到，這群目前沒人解得出來的問題有一個共同點：**難度是同一個等級，被綁在一起**。

- 好處：只要哪天有人用 polynomial time 解掉其中一個，整個 class 的問題就全部都能用 polynomial time 解掉。
- 壞處：到現在還沒有人找到這樣的演算法，所以它們全部看起來都很難。

### Polynomial time 與 exponential time 的演算法

NP-hard 和 NP-complete 是最重要、也最容易混淆的主題，而且它其實是一個「研究」主題。學過的演算法可以分成兩類：

| polynomial time | exponential time |
|---|---|
| linear search：n | 0/1 knapsack |
| binary search：log n | traveling salesperson（TSP） |
| 簡單的排序（bubble sort 等）：n² | sum of subsets |
| merge sort：n log n | graph coloring |
| | Hamiltonian cycle |

右邊這些問題用目前的方法，實際上有的是 n·2ⁿ、有的是 nⁿ，這裡統一寫成 2ⁿ，只是表示「它們都是指數時間」。

研究在做什麼？

- 搜尋：已經有 log n 的 binary search，還想要 O(1) 的搜尋。
- 排序：merge sort 是 n log n，還想要 O(n) 的排序。
- 對右邊那些指數時間的問題，最想要的就是一個 **polynomial time 的演算法**。

> **陷阱** 只靠「比較」的排序，下界是 Ω(n log n)，「O(n) 的比較排序」不可能存在；上面只是在說明研究的動機。

為什麼這麼想要 polynomial？因為 n 夠大時，就算是 n¹⁰、甚至 n¹⁰⁰，都比 2ⁿ 小得多，指數時間實在太耗時。可是電腦科學家、數學家研究了很久，還是沒找到這些問題的 polynomial 解法。研究一直沒結果，至少要讓做過的努力有用，於是有了一套研究框架（guidelines）：**NP-hard 和 NP-complete**。

### 輸入加倍：多項式和指數差在哪

- **P** 的時間是 T(n) = O(n^c)，即輸入大小 n 的多項式。
- **EXP** 的時間是 2^(n^c)。已經是指數了，指數上面是 n 還是 n¹⁰⁰，差別不大，反正都很慘。指數時間的問題算得出來，但大多數實際的題目要算到世界末日之後。
- 介於兩者之間還有 **NP**，一句話：Nondeterministic Polynomial（非確定性多項式），後面細講。

用「輸入加倍」比較最清楚：

```
多項式 n³：                       指數 2ⁿ：
n = 10  →  1000 步                n = 10  →  1024 步
n = 20  →  8000 步  （× 8）       n = 20  →  1024² = 1048576 步  （平方）
```

- 多項式：n 變 2n，時間變成 2^c · n^c，只乘上一個**固定的常數 2^c**（n³ 就是 × 8），不會越變越誇張。
- 指數：n 變 2n，時間變成 2^(2n) = (2ⁿ)²，**直接平方**。

所以我們喜歡多項式問題：它們才是「好解」的問題。

## 難度軸：P、EXP、R

**計算複雜度**（computational complexity）問的是：一個問題有多難算？問題依難度分類，每一類叫一個**複雜度類別**（complexity class）。先介紹三個：

- **P**：多項式時間能解的（決策）問題。輸入大小是 n 時，步數大約是 n 的固定次方，像 n²、n³，這種演算法算是「跑得動」。前面學過的排序、最短路徑等問題幾乎都在 P，**唯一的例外是 knapsack**：它只有 pseudo-polynomial 的解法。
- **EXP**：指數時間能解的問題。P 的問題給指數時間當然也解得完，所以 **P 整個包在 EXP 裡**。正式定義是 2 的「多項式」次方，不只 2ⁿ，連 2^(n²)、2^(n³) 都算在 EXP。幾乎想得到的問題都能在指數時間解（全部試一遍就好）；演算法設計一直在做的，就是把「看起來要指數時間」的問題找出多項式解，把它拉進 P。
- **R**：**有限時間內能解**的問題，不管跑多久，保證會算完並給出答案（可能久到世界末日都還沒跑完，但時間是有限的）。也叫 **decidable**（可判定）。R 來自 recursive（遞迴的），是 1930、40 年代的老用語，當時的意思就是「可計算」；記住「**R 就是 decidable**」即可。

> **陷阱** EXP 不是只有 2ⁿ：任何 2^(多項式) 都算。而且 P ⊆ EXP ⊆ R。

把這些類別畫成一條「computational difficulty（計算難度）」橫軸，越左越簡單、越右越難。這是示意圖，不是精確的數學圖，但很好用：

```
簡單 ───────┼──────────┼──────────────┼──────────────→ 難
            P   (之後補上 NP)   EXP              R      不可計算的問題
刻度左邊整段都屬於該類別（EXP 包含 P，R 包含 EXP）
```

P 和 EXP 中間先空著，之後要補上一個很重要的刻度。軸的箭頭還往右延伸：R 的右邊，還有根本不可能用程式解的問題。更讓人沮喪的是，**大部分問題其實都解不了**，而且這件事很好證明（見下一節）。我們在乎的實際問題，全部都在 R 裡面。

### 把問題放上難度軸

| 問題 | 問什麼（YES/NO） | 位置 |
|---|---|---|
| 負權環偵測 | 有沒有一個環，繞一圈權重總和 < 0？ | P（Bellman-Ford，O(VE)），當然也在 EXP |
| n × n 西洋棋 | 給一個盤面、輪到某一方，白棋最後會不會贏？ | EXP，**已證明不在 P** |
| 圍棋（Go） | 同上 | EXP，不在 P |
| Tetris（方塊全部事先告知） | 從這個盤面、拿這串方塊，能不能活下來？ | EXP；在不在 P 未知，但大家很相信不在。其實落在之後要定義的 NP 刻度 |
| Halting problem | 這支程式最後會不會停？ | **不在 R**（undecidable） |

**負權環偵測**：給一張有權重的圖，例如一個環的邊權是 2、−4、1，2 + (−4) + 1 = −1 < 0，就有負權環。用 Bellman-Ford O(VE) 判斷（V 點數、E 邊數）。小細節：Bellman-Ford 只檢查從起點 s 走得到的部分，所以加一個新點 s，用權重 0 的邊連到每個點，整張圖就都檢查得到了。

**n × n 西洋棋**：把所有可能的走法都下下看就知道誰會贏，所以在 EXP；而且已經證明它不在 P，這是第一個確定**不能**在多項式時間解的問題。為什麼研究 n × n 而不是 8 × 8？因為複雜度看的是「n 變大時時間怎麼成長」，固定大小的 8 × 8 沒辦法談成長（這也解釋了 8 × 8 為什麼這麼難）。很多複雜的遊戲都屬於這一類。

**Tetris**：照真正的遊戲規則，唯一的條件是之後會掉下來的方塊全部事先告訴你（不然方塊是隨機的，很難談最佳策略）。把所有放法試一遍就知道答案，所以在 EXP。

**Halting problem（停機問題）**：給一支程式（用 Python 或任何語言、任何表示法都一樣），問它最後會停下來，還是永遠跑下去？這很實用：程式跑了 5 小時，到底是寫錯變成無窮迴圈，還是只是慢？有個檢查程式告訴你就好了。可惜它比 chess 還難，位在軸的最右邊：

- 停機問題**沒有解**：不管多少時間、多少電腦、多少錢，都寫不出解它的程式。這不是「很慢」，而是「不可能」，已經有數學證明。這種問題叫 **undecidable**（不可判定）：沒有任何演算法能對每個輸入都正確回答。
- 有些特例很好判斷：什麼都沒寫的空程式、沒有迴圈的程式一定會停；`while True` 裡面沒有 `break` 一定不停。難的是寫出一支「對所有程式都正確」的判斷程式。
- 如果給無限的時間倒是可以：直接執行，等它停。但我們要的是有限時間，這就做不到。

> **陷阱** Undecidable 不是說每個特例都判斷不了，而是「沒有一個演算法能在有限時間內對所有輸入都判斷正確」。

> **比喻** 如果面試被考停機問題，可以放心地反問「那你示範看看？」，因為這題沒有人解得了。chess 比它好一些：雖然很花時間，但至少算得完。

## 為什麼大部分問題都不可計算

停機問題的證明比較長，這裡證一件更簡單的事：**幾乎所有問題都不在 R**。

### 決策問題

**Decision problem（決策問題）**：答案只有 YES 或 NO 的問題。上面的例子全是這種：有負權環嗎？白棋會贏嗎？活得下來嗎？程式會停嗎？

整個計算複雜度理論都只研究決策問題，主要是因為方便。其他問題也能改成決策問題，難度基本不變，例如「最短路徑多長？」改問「有沒有長度 ≤ k 的路？」。

### 程式 = 有限 bit 串 = 自然數

一邊是我們想解的「問題」，另一邊是拿來解它的「程式」（用程式來想，比用演算法精確：一段程式碼丟進 Python，能跑就是能跑）。

- 程式最後都存在電腦裡，全部是 0 和 1，也就是一串**有限長**的 binary string。
- 一串 0 和 1 可以看成一個二進位數，例如 `10110₂` = 16 + 4 + 2 = 22。
- 所以**每支程式對應一個自然數**（ℕ = 0, 1, 2, …），可能大得嚇人，但還是一個整數。

### 決策問題 = 無限 bit 串 = 實數

- 決策問題是一個函數：給一個輸入，回答 YES/NO。YES、NO 寫成 1、0；輸入也是 0 和 1 的字串，也是自然數。所以決策問題就是「**自然數 → {0, 1}**」的函數。
- 這種函數可以列成一張表：

```
輸入：   0  1  2  3  4  5  …
答案：   0  0  1  0  1  1  …
```

- 輸入有無限多個，每個都要答案，所以這張表是一條**無限長**的 bit 串；反過來，任何一條無限長的 bit 串都代表一個決策問題。
- 在無限 bit 串前面加一個二進位小數點，例如 `0.001011…₂`，它就變成 0 到 1 之間的一個**實數**。

| | 對應成 | 數量 |
|---|---|---|
| 程式 | 有限 bit 串 → 自然數 ℕ | countable（可數，能一個一個編號） |
| 決策問題 | 無限 bit 串 → 實數 ℝ | uncountable（不可數，編號編不完） |

實數遠比自然數多（這個證明在此不展開），所以**問題的數量遠遠多過程式的數量**。一支程式只解一個問題（給定輸入只會給一種答案），程式根本不夠分，因此**絕大多數決策問題沒有程式能解**。

問：那為什麼平常想得到的問題，大多都解得出來？
答：因為我們描述問題的方式本身就很像演算法，所以想得到的問題大多在 EXP 裡，一定可計算。

> **比喻** 想像一條無限長的線，能解的只有最左邊一小段。但演算法研究的就是這一小段，右邊幾乎沒什麼好研究的。

## Decision 版與 optimization 版

同一個問題有兩種問法，這是證明 NP-completeness 前一定要先搞懂的觀念（NP-completeness 談的是證明「設計不出 efficient 演算法」，和前面一直在設計演算法是完全不同的方向）：

- **Optimization problem（最佳化問題）**：instance 進來，找一個 solution 讓定義好的 cost 最小或最大；greedy、DP 處理的大多是這種。它的 formulation 包含兩部分：**objective function**（要最大化或最小化的量）與 **constraint**（解必須遵守的條件）。
- **Decision problem（判定問題）**：只問一個是非題，答案是 yes 或 no，也常寫成 1 或 0。

### 例一：最短路徑

- Optimization 版：在圖上找 s 到 t 的最短路徑，例如沿 2 + 1 + 2 + 3 = 8 的那條。
- Decision 版：「s 到 t 有沒有長度 ≤ k 的路？」它是一個問句，答案只有 yes/no。不用把最短路找出來，只要判斷「有沒有」。例如 k = 9：有一條長度 8 的路，8 ≤ 9，答 **YES**。

所以 decision 版**不會比** optimization 版難。

問：那證明困難時，為什麼專注在比較簡單的 decision 版？
答：如果連 decision 版都是 NP-complete，代表連這個簡單版本都設計不出有效率的演算法；要找出最短、最小的 optimization 版當然更不可能。optimization **至少跟** decision 一樣難，證明簡單的版本很難，就連帶證明了難的版本。

> **重點** 證 NP-complete 的第一步：手上的問題如果是 optimization 版，先改寫成 decision 版。

### 例二：MST — decision 版一定要給 bound

給一張 graph，edge 上有 cost。

（示意）5 個點的圖：

```
邊與 cost：A–B 1   B–C 2   C–D 2   A–C 3   D–E 4   B–D 5   C–E 6

Kruskal 依 cost 由小到大：
A–B 1  取
B–C 2  取
C–D 2  取
A–C 3  跳過（A、C 已連通，會成環）
D–E 4  取   → 已有 4 條邊連起 5 個點
MST = {A–B, B–C, C–D, D–E}，cost = 1 + 2 + 2 + 4 = 9
```

- **Optimization 版**：找一棵 cost 總和最低的 spanning tree → 9。
- **Decision 版**：不能問「cost 最小的是哪棵」，它沒辦法回答。要多給它一個參考的 **bound k**，問：「是否存在一棵 spanning tree，cost **最多是 k**？」
  - k = 10：cost 9 的那棵符合，答 **YES**。
  - k = 8：最小也要 9，bound 給太小了，答 **NO**。

> **重點** 描述一個 decision problem 一定要給 bound，不然它沒辦法回答 yes 或 no。

### 例三：TSP 的兩種形式

**Traveling salesman problem（TSP，旅行推銷員問題）**：一位業務員要拜訪他的客戶，幫他規劃路線：從所在城市出發，拜訪所有客戶一圈，再回到原城市，總長越短越好。

- 輸入：一些 city，以及任兩個 city 之間的距離。
- 條件一：start 和 end 在同一個 city。
- 條件二：每個 city **剛好 visit 一次**，不用來回走。

4 個城市的例子（A–B 3、B–C 4、C–D 3、D–A 4；對角線 A–C 5、B–D 5 為示意數字）。4 個城市只有 3 種不同的環：

```
A→B→D→C→A = 3 + 5 + 3 + 5 = 16
A→C→B→D→A = 5 + 4 + 5 + 4 = 18
A→B→C→D→A = 3 + 4 + 3 + 4 = 14   ← 最短
```

- **Optimization 版**：minimize 總長 → A→B→C→D→A，14。
- **Decision 版**：input 一樣，但要額外多給一個 **bound B**。問：「是否存在一條起訖同城、每個 city 恰一次、總長**不超過 B** 的 route？」B = 15 時，有 14 那圈，答 **YES**。

> **重點** 這一章探討的問題，全部都用 decision problem 的形式來描述。

### 用 binary search 從 decision 回到 optimization

Decision 版只說「有解沒超過 bound」，沒說這個 bound 是不是剛好最佳。手上只有 decision 版時，最佳值怎麼拿？**用 binary search 決定 bound 該設多少。**以 MST 為例（最佳值約 300 只是示意）：

```
問：有沒有 cost ≤ 1000 的 spanning tree？  YES  → 往下砍一半
問：≤ 500？                                YES
問：≤ 250？                                NO   → 最佳值在 (250, 500]
問：≤ 375？（卡在中間）                    YES  → 範圍 (250, 375]
……繼續對半縮小
```

問幾次之後範圍越縮越小，最後收斂（converge）到某一個值：bound 再小一點就找不到，大一點就一定找得到，那個 bound 就是**最佳解的值**。

> **重點** cost 是整數時，二分搜只需 O(log 上界) 次判定；若判定是 polynomial time，最佳值也能 polynomial time 求出。所以 decision 和 optimization 可以互相轉換：證明 decision 版很難，optimization 版也就很難。

### 真實例子：13509 個城市的 TSP

在美國地圖上標出 13509 個城市，任兩個城市的距離都算得出來，要求的是這些城市的 TSP：經過所有城市、回到起點的最短路線。這個例子的最佳解已經被算出來，但難度非常高。每年都有 TSP 競賽，網站上隨時有新的 instance 可以拿來測。

動態規劃那一章也解過 TSP：Held–Karp 的 DP 是 O(n²·2ⁿ)，比暴力法的 O(n!) 好，但仍然是指數時間，還是很高。後面會說明：TSP 的確很難，是 **NP-complete** 等級的問題。

## Class P 與 class NP 的定義

這些 class 不是互斥的，只是分類的角度不同。這裡談的全是 decision problem。

### Class P

- **定義**：在 **deterministic Turing machine**（確定型圖靈機，可以想成「一般的電腦」，每一步都很確定地往下算）上，能在 polynomial time 內 **solve**（真的把答案求出來）的 decision problem。
- n 是 input 的大小（例如陣列有幾個數），時間是 **n^O(1)**，也就是 n 的某個固定次方，像 n²、n³。
- 例：MST、排序、最短路徑。

> **陷阱** 這個 polynomial 一定是對 **problem size（輸入的大小）**來說的，**pseudo-polynomial 不算**。knapsack 的 DP 是 O(nW)，看起來像 polynomial，但 W 是一個數值，輸入只用約 log W 個 bit 表示，對輸入長度來說是指數。subset sum 和 knapsack 其實都是 Karp 最早發表的 21 個 NP-complete 問題之一（W 不大時 DP 還算可以），不能把它們算進 P——目前沒人知道它們在不在 P。

### Class NP

> **陷阱** 最常見的誤會：把 NP 當成 **Not Polynomial**。這是錯的。NP 是 **Nondeterministic Polynomial time**，N 是 nondeterministic，不是 not。一個問題屬於 NP，**不代表它不屬於 P**。

- **定義一（機器）**：能在 **nondeterministic Turing machine**（非確定型圖靈機，NTM）上 polynomial time 內決定的 decision problem。NTM 可以想成**會分身的機器**：每遇到選擇，就同時往所有分支走；只要有一條路走到 YES，就回答 YES，而那條成功的路長度是 polynomial。
- **定義二（驗證）**：把「猜中的那條路」當成一個解交給一般電腦，它能在 polynomial time 內**檢查**這個解對不對。也就是：給一個 solution，能在 polynomial time 內 **verify** 它是不是合法的解——只是 check 對不對、符不符合條件，不需要自己把解找出來。

> **重點** P 講的是 **solve**（找出解）；NP 講的是 **verify**（驗證解）。找解可能很難，但檢查很快。

因為 NP 只要求能 polynomial time 驗證，**就算很簡單的問題，也符合 NP 的定義**。

> **陷阱** P 和 NP 的關係常被說成「不知道誰包含誰」，這不精確：**P ⊆ NP 已經證明了**（能 polynomial time 解，就能 polynomial time 驗證），不知道的是 P = NP 還是 P ⊊ NP。大部分人認為 P 比較小、被 NP 包在裡面。

## 研究框架與 non-deterministic 演算法

從研究者的角度看，整個 NP-hard、NP-complete 主題建立在兩個想法上：

1. **解不出 polynomial 演算法，至少證明這些問題彼此很像**：解出一個，其他就跟著解出來。不要各做各的（我研究 knapsack、你研究 graph coloring，彼此沒關係，努力就分散了），要把它們集體關聯起來、找出彼此的關係。關係建立好以後，只要有人解出其中一個，全部都跟著解出來。
2. **寫不出 deterministic 演算法，就先寫 non-deterministic 的**：不知道怎麼做的那一行先空著，但整體必須是 **polynomial time** 的 non-deterministic 演算法。

### Deterministic 與 non-deterministic 演算法

- **Deterministic**：平常寫的演算法，每一行在做什麼、怎麼運作，我們都很清楚。
- **Non-deterministic**：裡面有些敘述，我們還不知道它是怎麼做到的。例如想寫 0/1 knapsack 的 polynomial 演算法，大部分的行都會寫，就一兩行不知道怎麼變成 polynomial，先留白，標成 non-deterministic。

好處是研究成果被保存下來：將來別人研究同一個問題時，可以把留白的那幾行補成 deterministic。就算花了十幾年還解不出來，做過的工作也不會白費。

### 例：non-deterministic search

在大小為 n 的陣列 A 裡找 key：

```
Algorithm NSearch(A, n, key)
{
    j = choice();          // 直接給出 key 所在的 index
    if (key == A[j]) {
        write(j);
        success();
    }
    write(0);
    failure();
}
```

- `choice()`、`success()`、`failure()` 是 non-deterministic 敘述，**假設每個都只花 O(1)**。
- 整個演算法沒有迴圈、每行 O(1)，所以是 **O(1)**，比最快的 binary search（log n）還快。
- `j = choice()`：choice 直接告訴你 key 在第 j 格。接著檢查 A[j] 是不是 key，是就輸出 j，success。
- 如果 A[j] 不是 key，代表 key **根本不在陣列裡**，輸出 0，failure。不是「找不到」，而是真的不存在。
- 例：找 key = 9，choice 不做任何搜尋、不檢查任何東西，直接說「在 index 4」，一步就到。

choice 怎麼在 O(1) 內知道 key 在第 j 格？我們不知道，這就是 non-deterministic 的部分。今天不知道，也許明天有人找到直接得到答案的方法，把這一行補上，就得到一個真正 O(1) 的演算法。

> **比喻** 不知道怎麼運作的東西叫 **magic**（魔法）；一旦知道怎麼做，它就變成 **technique**（技術），也就是 deterministic。

所以對那些目前要指數時間的問題，我們寫的是 **polynomial time 的 non-deterministic 演算法**（再寫指數時間的沒有意義）。

### 直覺版的 P 與 NP

- **P**：deterministic、polynomial time 的演算法，例如 linear／binary search、bubble／merge sort、單源最短路徑、MST、Huffman coding。
- **NP**：non-deterministic、但 polynomial time 的演算法。這正是我們想替 knapsack、TSP 寫的：不會變成 polynomial 的地方先留成 non-deterministic。

著名的圖是 **P 是 NP 的子集**，NP 把 P 包起來：

```
┌──────────── NP ────────────┐
│                            │
│     ┌────── P ──────┐      │
│     │ sorting, MST, │      │
│     │ shortest path │      │
│     └───────────────┘      │
│   knapsack, TSP, ...       │
└────────────────────────────┘
```

為什麼？以前大家只會 n² 的 bubble sort，那時 n log n 的排序對我們來說是 non-deterministic；後來有人找到 merge sort，它就變成 deterministic，搬進 P。**今天 deterministic 的，昨天是 non-deterministic；今天還不會的，明天可能變成 deterministic。**因此 deterministic ⊆ non-deterministic，P ⊆ NP。

> **陷阱** 「non-deterministic = 我們還不知道怎麼做」只是直覺說法。正式定義中，NP 是 nondeterministic TM 上 polynomial time 可決定（等價於 polynomial time 可驗證）的 decision problem，和人類知不知道解法無關。

P 到底是 NP 的真子集還是等於 NP，和後面的 Cook's theorem 有關。

## Lucky 演算法：每次都猜對

回到難度軸，補上 P 和 EXP 中間的刻度：**NP**。NP 跟動態規劃裡的「猜」（guessing）很有關係。

NP 的定義前半句跟 P 一樣：**多項式時間能解的決策問題**；差別在後半句：用一個 **lucky（很幸運的）演算法**來解。

- DP 也會猜，但它不知道哪個對，所以**每個選項都試一遍**。
- Lucky 演算法**只試一個**，因為它每次都剛好猜對。

這不是真實的計算方式，而是理論模型，叫 **nondeterministic model**。真實電腦做不出來，但這個瘋狂的模型抓到了「哪些問題能解」的核心。

運作方式：

1. 演算法跑著跑著遇到岔路，要走這邊還是那邊？它就**猜**一個。它不是丟硬幣、不是隨機，而是由一種「非確定性的魔法」決定。
2. 往下又遇到岔路就再猜，所以所有可能的執行過程長成一棵樹。
3. 每條路走到底，輸出 YES 或 NO。
4. **只要樹裡有任何一條路通到 YES，猜測就保證走到 YES**（對想找 YES 的人來說，這就是運氣好）。反過來，**每條路都是 NO**，怎麼猜都只能輸出 NO，它不會亂說 YES。

```
            start
           /     \
        猜左     猜右
        /  \       \
      NO   YES      NO
           ↑ 只要存在這樣一條路，lucky 演算法就會走到它
```

> **重點** NP = 用這種超幸運的演算法，能在多項式時間解出來的決策問題。

> **陷阱** Lucky 不是隨機：不是丟硬幣碰運氣，而是**保證**猜到通往 YES 的路（只要這條路存在）。

### 例：Tetris ∈ NP

問題：Tetris，事先知道所有方塊，能不能活下來？全部放法都試是指數時間，但用 lucky 演算法不用全部試：

1. 每個方塊放哪一欄？要不要轉？不知道，就用 nondeterministic 的方式**猜**。例如第一個方塊猜放在最右邊兩欄，放下去。
2. 照規則**模擬**：某一列滿了就消掉。這些規則很好寫成程式。
3. 下一個方塊也猜，連「最後一刻要不要轉」都可以猜；例如猜它橫放在左邊，剛好又消掉一列。
4. 每個方塊只猜少數幾次，總共**多項式個猜測**，整體還是多項式時間。
5. 最後判斷：我活下來了嗎？只要看方塊有沒有超過頂端那條線，沒有就是 YES。

只要有任何一種活下來的方法，猜測就會找到它，所以 **Tetris ∈ NP**。

問：如果把問題改成「我會不會死？」呢？
答：lucky 演算法會去找「有沒有任何一種死法」，答案幾乎一定是 YES，意思完全變了。「能不能活下來」在 NP；「會不會死」（活不下來）應該不在 NP，只是目前沒人能證明。

> **陷阱** NP 只對 YES 方向「幸運」，對一個問題和它的補集（YES/NO 對調）並不對稱。設定決策問題時，YES 跟 NO 的方向要設對。

### 另一個比喻：丟硬幣永遠丟對

既然解（下一節的 proof）只有多項式長，可以丟硬幣，每次正反面當一個 bit，拼出一份解。通常丟出來都是錯的，驗證不會通過；運氣超好，才剛好丟出正確的那一份，實際上機率幾乎是 0。但「概念上」運氣好就拿得到，這正是 Nondeterministic Polynomial 的意思：想像一台**丟硬幣永遠丟對的魔法機器**，它能在多項式時間產生正確的解，NP 就是這台機器能多項式時間解的問題。

> **陷阱** 「丟硬幣」只是比喻；nondeterministic 不是隨機演算法，重點是「只要存在正確的解，就一定猜到」。

## Verifier 與 certificate：NP 的實用定義

另一個等價、很多人覺得更直覺的說法：不想怎麼**解**問題，只想怎麼**檢查**答案。檢查答案通常比自己解題容易得多，就像對答案比寫考卷簡單。

**NP 的實用定義：能寫出一個 verifier（驗證程式）。**

- verifier 吃兩樣東西：**題目本身的輸入** + **一個「解」**。
- 它告訴我們這個解是對的還是錯的。
- verifier 本身必須在多項式時間跑完，也就是 **verifier ∈ P**。

正式說法：**只要答案是 YES，就能寫出一份證明，別人能在多項式時間檢查它**，確認答案真的是 YES。

問：決策問題的答案不就是 0 或 1 嗎？那「解」有多大？
答：要通過 verifier，不能只報答案，要交出一個**能說服它的字串**。所以 verifier 收到的不只是 YES/NO 一個 bit。

> **例題** 3SAT：給一個邏輯式，能不能幫變數選值，讓整個式子為真？只說「可以」沒有任何意義，你怎麼知道我說的對？我必須交出**每個變數是 0 還是 1**，你代進去，多項式時間就確認了。

這份解的大小也必須是**輸入大小的多項式**，不然 verifier 光讀它就沒辦法在多項式時間讀完（輸入大小本來就算在「多項式時間」裡）。對決策問題，這份能說服 verifier 的解，更嚴謹的名字叫 **proof（證明）**；CLRS 叫它 **certificate（憑證）**。

> **重點** 找到證明要花多久都沒關係，**只有「檢查證明」這一步必須是多項式時間**。

### 兩人遊戲：證明 Tetris 活得下來

把它想成兩個人的遊戲：一個很會玩 Tetris 的玩家想說服你，你是要被說服的人。

有個小故事：有人在信裡寫「I am NP-complete」。這句話其實沒意義，NP-complete 是在講問題，不是講人（學完 NP-complete 會覺得更好笑）；寫信的人想說的其實是「**I am lucky**」。那要怎麼證明自己 lucky？

1. 給他一關很難的 Tetris：這些方塊你活得下來嗎？他說：YES。
2. 怎麼證明？直接玩給你看：**證明就是一串移動**，每個方塊放哪、怎麼轉。
3. 把這串移動交出去，很容易就說服別人。檢查的人只是普通的多項式時間演算法：照 Tetris 規則一步步跑，看有沒有超過頂端。

Tetris 的規則很好寫成程式；難的是「知道該怎麼走」。

### Two-argument 的驗證演算法：MST

NP 探討的是「**驗證一個解**」的時間是 polynomial。驗證交給一個 **verification algorithm**，它回答 yes 或 no，而且是 **two-argument** 的，要吃兩個 input：

1. **instance**：例如 MST decision 版的這張 graph，加上 bound k = 10（沿用上面的示意圖）。
2. **某一個 solution**：白話說，就是隨便拿一棵 tree 丟給它，例如 {A–B, B–C, C–D, D–E}。

它檢查：

```
是不是 spanning tree？  4 條邊（= 5 − 1）、5 個點都連到、沒有環  → 是
cost 有沒有超過 bound？  1 + 2 + 2 + 4 = 9 ≤ 10                 → 是
輸出 YES
```

這些檢查都很快。

### 例題：證明 TSP ∈ NP

TSP decision 版的 input：n 個 city、兩兩之間的距離，還有一個 **bound**（這很重要，用來判斷有沒有超過），這裡設 B = 15。問：有沒有一條 route，起訖同城、每城恰一次、總長 ≤ B？

要說明 TSP ∈ NP，就看能不能在 polynomial time 內 verify 一個 solution。這個拿來驗證的 solution 就是 **certificate**。

1. 先隨便**猜（guess）**一個答案，例如 tour ⟨A, B, C, D, A⟩。
2. 檢查一：起點和終點是不是同一個城市？抓頭尾就知道，都是 A。
3. 檢查二：每個 city 是不是剛好 visit 一次？掃一遍就知道。
4. 檢查三：沿著 tour 走一圈把距離加起來，3 + 4 + 3 + 4 = 14，再和 bound 比：14 ≤ 15。

全部 linear time 做完 → 驗證是 polynomial time → **TSP ∈ NP**。

> **重點** 這一步很簡單但很重要：證明一個問題是 NP-complete 的**第一步**就是證明它屬於 NP，第二步才是證明它夠難。

> **陷阱** 驗證時**不用檢查這個 tour 是不是最短的**，只檢查它合不合法、總長有沒有超過 bound。

## P ⊆ NP，那 P = NP 嗎？

先確定一件事：P 的問題，非確定型機器當然也能 polynomial time 解——不分身、照樣算就好。所以 **P ⊆ NP** 一定成立。剩下只有兩種可能：

```
可能一：P ⊊ NP                     可能二：P = NP
┌──────── NP ────────┐            ┌──────── NP = P ────────┐
│   ┌──── P ────┐    │            │                         │
│   └───────────┘    │            │                         │
│ 有些問題不在 P     │            │ 能快速驗證的都能快速解 │
└────────────────────┘            └─────────────────────────┘
```

- **可能一**：P 是 NP 的真子集，NP 裡有些問題真的沒辦法快速解。
- **可能二**：P = NP，所有能快速驗證的問題，也都能快速解。

歷史上真的有問題從外面「走進」P：某些原本以為只在 NP、不在 P 的問題，後來找到 polynomial 演算法，例如**質數判定（PRIMES）在 2002 年由 AKS 演算法證明在 P**。

到底是哪一種？到現在沒人能證明，這就是理論計算機科學最有名的 open problem：**P vs NP**。

## P = NP？：運氣造不出來

既然 P ⊆ NP，最大的問題就是：P 和 NP 是不是其實一樣大？**P = NP？**

- 大多數人都相信 **P ≠ NP**，但沒有人證得出來；反過來 P = NP 也沒有證明，這是個**開放問題**。
- 它是 **Millennium Prize（千禧年大獎）難題**之一：證出來可得一百萬美元，也會成為全世界最有名的電腦科學家。
- P ≠ NP 的意思是：**有些問題在 NP 裡，卻不在 P 裡**（NP − P 不是空的）。

用「兩台電腦」來想：P 是真正的電腦能在多項式時間解的問題；NP 是**魔法電腦**能在多項式時間解的問題，這台電腦每次遇到岔路，都會告訴你正確的方向。魔法電腦顯然比較強，可是氣人的是，沒有人證明得了它真的比較強。

> **比喻** P ≠ NP 可以一句話說成「**you can't engineer luck**」：運氣可以相信，但沒辦法用普通電腦、用工程的方法把它造出來。

另一種說法：**解題比檢查答案難**。更正式地說：**產生一份證明，可能比檢查這份證明難**。數學就是這樣：證明一個定理很難，但檢查一份寫好的證明很簡單，只要確認每一步都能從前面推出來。證定理需要靈感、需要好點子；在這個模型裡，**靈感 = 運氣 = 猜**。我們只知道用「把所有可能的證明都試一遍」的方法來找。

## 常識論證：如果 NP 問題能快速解，就能冒充銀行

P ≠ NP 沒有數學證明，但「永遠猜對」這個模型可以拿來做一個**常識論證**：如果有人能在多項式時間解 NP 問題，他能賺到的錢遠遠不只一百萬。

### RSA 的私鑰與公鑰

假設你想做壞事：冒充一家銀行（純粹舉例）。現在銀行之間轉帳不是用卡車運金條，而是透過網路、用加密的安全連線；這種連線常用的加密演算法叫 **RSA**。

- 每家銀行有一把**私鑰（private key）**：兩個很大的質數 p 和 q，各有 n 個 bit。
- 銀行公開一個數 **N = p × q**，全世界都看得到。一定要公開 N，別人才能用它加密訊息、傳給這家銀行。
- 誰知道 p 和 q，誰就能解開加密的訊息，假裝自己是那家銀行。

> **例題** 用小數字示意：p = 61、q = 53，公開的 N = 61 × 53 = **3233**。

> **陷阱** 61、53、3233 只是示意用的小數字；真實 RSA 的 p、N 大約是 1024 bits 以上。

### Factoring 的 verifier

把「找出 p」寫成一個 verifier：

- 輸入：公開的 N，和你猜的 p。
- 做長除法（多項式時間），算 **N mod p**（N 除以 p 的餘數）。
- 餘數是 0：p 整除 N，你猜中了，verifier 很開心，你發財了。
- 餘數不是 0：運氣不好，再猜一次。

```
N = 3233
猜 p = 47：3233 = 47 × 68 + 37   → 3233 mod 47 = 37 ≠ 0，再猜
猜 p = 53：3233 = 53 × 61 + 0    → 3233 mod 53 = 0，猜中，另一個因數是 61
```

只要能讓 verifier 開心，你就從公開資訊（N）算出了私密資訊（p）。這個問題叫 **factoring（因數分解）**：給 N，找出它的因數。

真實的 p 和 N 大約 1024 bits，用丟硬幣的方式猜中的機率是 **1 / 2¹⁰²⁴**，比在宇宙裡隨便挑一顆原子、剛好挑中某一顆還難。如果有演算法能**產生**讓 verifier 開心的輸入，就能冒充銀行，全世界的金融系統也會大亂。可是金融系統還在正常運作，大家的錢都沒消失，代表沒人做到。

> **觀念** 結論：電子商務和銀行還能運作，代表沒有人能在多項式時間解 NP 問題。這是**常識論證，不是數學證明**。而且這裡假設的是一般的 Turing machine（一般電腦）；夠大的量子電腦會打破這個假設、破解 RSA，希望到時已經換成新的加密方法。

問：factoring 在 NP 裡嗎？它是 NP 裡最難的那種問題嗎？
答：在 NP 裡（verifier 只要做一次長除法，看 N mod p 是否為 0）；但一般認為 factoring **不是 NP-complete**，它不屬於「最難的那群」NP 問題。

## Reduction：把 A 轉成已經會解的 B

前面一直說「至少一樣難」，卻還沒定義。正式的意義來自 **reduction（歸約）**，而它其實是早就學過的東西：reduction 本來是一種**設計演算法的技巧**，像把問題建成一張圖、再呼叫學過的圖演算法（graph reduction），就是 reduction。

一般說法：**想解問題 A，就把 A 轉換成另一個已經會解的問題 B；解了 B，就解了 A。**

> **重點** 遇到不會的問題，第一件事就問：「能不能把它轉成我會解的問題？」能的話就做完了。轉過去的解法不一定是最好的，但至少是一個解法，而且通常是多項式時間。

### 例：只有 Dijkstra，也能解無權重最短路徑

無權重的最短路徑（邊沒有長度）本來用 BFS，線性時間。但假設手上只有 Dijkstra 的程式碼，什麼都不想寫。Dijkstra 解的是**有權重**的最短路徑，怎麼辦？

**把每條邊的權重都設成 1**：「最短」就變成「邊數最少」。很簡單，但這就是一個 reduction。

- 權重設 2 也可以，任何正數都行，只要每條邊都一樣。

> **陷阱** 權重全設成 0 不行：每條路的長度都變成 0，分不出哪條比較短。

### 例：乘積最小 → 取 log

有一題要找的路徑，是讓路徑上**權重的乘積**最小，而不是和。可是學過的最短路徑演算法，都是讓權重「加起來」最小。

一個字：**log**。因為 `log(a × b) = log a + log b`，每條邊的權重取 log，乘積就變成和，直接丟給 Dijkstra（權重都 ≥ 1 時取 log 後才不會出現負數；有小於 1 的權重會變成負邊，要改用 Bellman-Ford）。

也可以去改 Dijkstra 或 Bellman-Ford 的 relax 步驟，讓它直接算乘積。行得通，但要**重新證明正確性**，程式也麻煩。用 reduction，原本的程式一行都不用改。

> **重點** 這就是 reduction 成為最常用的演算法設計技巧的原因：能重用舊的演算法，不必為每個新問題重寫、重證。

### 例：最長路徑 → 權重取負號

問：最長路徑能不能用 Bellman-Ford 解？
答：可以：把所有權重**取負號**，最長的路就變成最短的路，再用 Bellman-Ford 求最短路徑。

> **陷阱** 取負號的做法只在「取負之後沒有負權環」時有意義（例如原圖是 DAG）。一般圖上的最長**簡單**路徑是 NP-hard。

### 例：改圖

- **照指定順序拜訪幾個景點**：把圖複製成好幾層（graph replication），第 i 層表示「已經依序拜訪完前 i 個景點」，走到第 i+1 個景點時跳到下一層，整件事就變成一次最短路徑查詢。
- **漏油油箱**：把油量這類奇怪的條件放進圖裡（改一下圖），又變回最短路徑。

這些多半是 graph reduction，但這個技巧到處都能用。

### 例：bipartite matching → network flow

network flow 那章就有標準的例子：用 network flow 解 **bipartite matching**（左右兩邊的點配對，每個點最多配一次）。

1. 把 bipartite graph **transform** 成 flow network：原圖幾乎照抄（邊改成由左指向右），多加一個 source s 連到左邊每個點、右邊每個點連到 sink t，**所有 capacity 都是 1**。
2. 用 network flow 的演算法（Ford-Fulkerson）找最大流。
3. 把結果**翻譯回** matching：有 flow 的左右邊就是配對。

```
（示意）左邊 1, 2, 3；右邊 a, b, c；所有 capacity = 1

        → 1 ─→ b ─
       /           \
   s  ──→ 2 ─→ a ──→  t
       \           /
        → 3 ─→ c ─

max flow = 3  →  matching = {1–b, 2–a, 3–c}
```

轉換花多少時間？幾乎完全照抄，再多加 s、t 兩個點和它們的邊，是 **linear time**，所以是 polynomial time。

> **重點** 轉換本身一定要在 polynomial time 內做完。如果轉換就要花 exponential time，那就白搭了。

這一章則是**換個方向**使用 reduction：不是為了解題，而是證明 NP 裡的問題都能 reduce 到某個很難的問題上。

## 借 B 的演算法解 A：yes 要對 yes

把 reduction 拿來解題時的完整流程：

- 有一個 decision problem A，想在 polynomial time 解它，但不知道怎麼做。
- A 的一個具體輸入叫做一個 **instance**，記作 α，例如「這張圖、這兩個點、k = 9」。
- 另外有一個問題 B，已經會在 polynomial time 解。
- 第一步：把 α 在 polynomial time 內轉成 B 的 instance β，這個轉換就叫 **reduction**。

```
A 的 instance α ──(poly time 轉換)──→ B 的 instance β ──→ B 的 poly 演算法 ──→ yes / no
```

轉換花 polynomial、解 B 也花 polynomial，**兩個 polynomial 加起來還是 polynomial**，所以 A 也能在 polynomial time 解。

> **重點** 最重要的條件：A 的答案是 yes 時，轉出來的 B 也要是 yes；A 是 no 時，B 也要是 no。否則 B 的答案就不能直接當成 A 的答案。

## X ≤p Y 的正式定義：可去可回

Reduction 是很強的武器：如果能在 polynomial time 解 Y，就會想知道，還有多少其他問題也能跟著解。

**符號**：`X ≤p Y`，讀作「X 可以 polynomial time reduce 到 Y」（polynomial time reduction）。

- **≤**：暗示 complexity 的高低：左邊 X 比較簡單，右邊 Y 比較難，或頂多一樣難。
- **下標 p**：把 X 的 input 轉成 Y 的 input，花的時間是 polynomial。
- 為什麼要轉？因為 X 的 input 有自己的長相，跟 Y 不一樣，要先轉成 Y 的 input，才能用 Y 的演算法解。

```
x（X 的 instance）──→ 轉換 f（poly time）──→ f(x) ──→ [ Y 的演算法 ] ──→ YES / NO
```

**定義**：對 X 的**任何一個** instance x，都能在 polynomial time 內建構出對應的 Y 的 input f(x)，而且

```
x 在 X 回答 yes   ⇔   f(x) 在 Y 回答 yes
```

不能隨便亂轉：用 Y 的演算法解完之後，答案還要能翻譯回原來的問題，所以必須是 **if and only if**：x 在 X 是 yes（例如符合給定的 bound），f(x) 在 Y 也要是 yes；反過來（vice versa），f(x) 在 Y 是 yes，x 在 X 也要是 yes。可以過去，也可以回來。

> **觀念** 這常被說成「一對一的對應（one-to-one correspondence）」。嚴格說轉換不必真的是一對一，只要「yes ⇔ yes」成立就夠了。

> **重點** 證明 X ≤p Y 要做三件事：① 轉換 f 是 polynomial time；② x 在 X 是 yes ⇒ f(x) 在 Y 是 yes；③ f(x) 在 Y 是 yes ⇒ x 在 X 是 yes。

Y 的演算法到底怎麼做，不用管：把它當成 **black box（黑盒子）**，假設它存在就能直接用。重點全放在轉換 f，希望它 efficient，能在 polynomial time 內做完。

問：X ≤p Y 代表什麼？
答：**Y 至少和 X 一樣難**。能解 Y，就能經過 poly 轉換解 X，所以右邊比較難或一樣難。

（下一步會用 traveling salesman problem 示範怎麼真的證一個 polynomial time reduction。）

## Reduction 不能讓輸入爆炸

為什麼「解出一個 NP-complete 問題，就解出全部」？靠的就是 reduction。常做的「圖的轉換」其實就是 reduction：把看起來很難的問題建成一張圖、跑最短路徑，再把結果轉回原問題的答案，這就是把原問題**歸約到最短路徑**。目標也不一定是最短路徑：任何你會解的問題都可以當轉換的目標。

> **比喻** 會解的問題就像地圖上的笑臉，最短路徑只是其中一個；走到任何一個笑臉都好。

但要小心：**轉換的過程中，問題的大小不能爆炸**。

> **例題** 把一個 3CNF 式子轉成一張圖，每多一個子句，頂點數就變 3 倍：
```
子句數 n = 1 → 3 個頂點
子句數 n = 2 → 9 個頂點
子句數 n = 3 → 27 個頂點
…           → 3ⁿ 個頂點
```
再跑 Dijkstra，時間至少是 3ⁿ，根本不是多項式。這種 reduction 沒有用，也不能拿來「證明 P = NP」。

> **陷阱** Reduction 本身必須是多項式時間，**產生的輸入也必須是多項式大小**，否則推不出原問題能在多項式時間解。

說穿了，計算複雜度理論就是一個「為什麼有些問題我們解不出來」的大理由。

## Reduction 的三種用法：方向不能放錯

建出 X ≤p Y，代表右邊比較難、左邊比較簡單或一樣難。使用時機分三種，**一定要分清楚，方向弄錯的話，證明就完全沒有作用**。

| 用法 | 目的 | X（左） | Y（右） | 結論 |
|---|---|---|---|---|
| Case 1 | 用已知演算法解新問題 | 新問題 | 已知有效率演算法的問題 | 新問題可 efficient 解，且不比 Y 難 |
| Case 2 | 證明新問題很難 | 已知很難的問題 | 新問題 | 新問題至少和已知難題一樣難 |
| Case 3 | 證明兩個問題一樣難 | 互相 | 互相 | X ≤p Y 且 Y ≤p X → polynomially equivalent |

### Case 1：用已知演算法解新問題

遇到一個新問題，想替它設計 efficient algorithm，但不想從頭設計，而是想用手邊已知的演算法來解。這時**新問題放左邊（X），已知有演算法的問題放右邊（Y）**。

例：**bipartite matching ≤p network flow**：把 matching 的圖轉成 flow network，用 Ford-Fulkerson 找到解，再翻譯回 matching 的 solution，結束。

這代表新問題可以被 efficient 地解掉，用的是舊演算法；同時也隱含**新問題不會比 network flow 難**（頂多一樣難；network flow 比較強，能解很多事）。實際上文獻裡 bipartite matching 有自己的演算法，複雜度比 network flow 再低一點，剛好印證這點。

### Case 2：證明新問題很難

遇到一個新問題，覺得它很難，想說服大家它真的很難。這叫 **intractability**：目前看不到 polynomial time 的解法。

> **陷阱** tractable 才是「polynomial time 可解」；intractable 是相反，不要把 intractable 講成 poly time solvable。

一樣建 X ≤p Y，但新的難問題要放哪邊？**新問題放 Y（右邊）**，因為要建構的是「Y 很難」。

做法：找一個**已經知道很難**的問題當 X，很多書、很多「問題字典」裡都查得到，例如 **circuit satisfiability（CIRCUIT-SAT）**。reduction 做成之後：左邊已經是 NP-complete，右邊比它更難或一樣難，所以新問題真的很難。

> **陷阱** 最常見的錯誤：把 X、Y 放反，已知難題放 Y、新問題放 X。這樣得到的只是「新問題比一個難題簡單，或一樣難」：它可能很簡單、也可能很難，**沒有帶來任何資訊**。因為任何簡單的問題都比難的問題簡單，例如排序也能 reduce 到 CIRCUIT-SAT，這說明不了什麼。這種錯甚至出現在學位論文裡，整個證明因此作廢。

正確時機：已知 X 很難、沒人找到 polynomial time 解法；新問題放 Y，才能說服大家 Y 很難。後面會用 **Hamiltonian cycle ≤p TSP** 示範：HC 已知是 NP-complete，要證 TSP 也很難。

### Case 3：證明兩個問題一樣難

要建構 **equivalence**：證明 X ≤p Y，**而且** Y ≤p X，兩個方向都要。那兩者就是 **polynomially equivalent**，難度一樣。

常見情況：model 一個新問題，結果發現它和某個經典問題一體兩面，只是換句話說。這時就像做一個一對一的對應，要花的功夫只剩 transformation 的時間，難度是一樣的。

> **重點** 三種用法裡，Case 2 最常出錯：要證「新問題很難」，**已知難題放左邊，新問題放右邊**。

## 用反證法證明 B 很難

把 reduction 拿來證明問題「很難」，邏輯是反證法。記住：NP-completeness 不是在證明問題簡單，而是證明它很難、沒有有效率的解法。這次主角換成 B。

- **目標**：證明 B 沒有 polynomial time 解。
- **已知一**：A 沒有 polynomial time 解。
- **已知二**：有一個從 A 到 B 的 polynomial time reduction。

證明（反證法：先假設相反的事成立，推出矛盾）：

1. 假設 B 有 polynomial time 解。
2. 那 A 的任何 instance 都能先在 poly time 轉成 B 的 instance，再用 B 的快速解法解掉，所以 A 也有 polynomial time 解。
3. 這和「A 沒有 polynomial time 解」矛盾。
4. 所以假設錯了：B 不可能有 polynomial time 解。

> **陷阱** 「A 沒有 poly 解」其實沒有人證明過，它是建立在 P ≠ NP 的假設上。嚴格的說法是：若 A 是 NP-complete 且 A ≤p B，則「B 有 poly 解」會推出「A 有 poly 解」，進而推出 **P = NP**。

到這裡為止的三件事：只看 decision 版；reduction 怎麼做；用反證法證明 B 很難。

### 為什麼要用這招：一則漫畫

老闆交給員工一個 task，過幾天來問進度：

1. 第一次：員工老實說找不到 efficient 的演算法，「可能是我太笨了」。老闆說：沒關係，再多花點時間。
2. 第二次：還是找不到，這次理直氣壯：「找不到，因為根本不存在！」老闆說：可能只是你找得不夠仔細，找不到不代表不存在。
3. 第三次：員工很有自信：「沒錯我找不到，但不是只有我，這些名人、天才們也都找不到！」

> **比喻** NP-complete 就是第三次的說法：證明一個問題跟「大家都解不出來的問題」一樣難。沒有人找得到 efficient 演算法，所以認為它很難；這比「我證明它不存在」容易得多，又比「我找不到」有說服力。

## Base problem：SAT 與 state space tree

要把很多難問題關聯起來，需要一個問題當基準，叫 **base problem**，就是 **satisfiability（SAT）**，用 **CNF** 公式表示。

- 公式用 boolean 變數 x1、x2、x3，每個只能是 0（假）或 1（真）。
- ∨ 是 or（或），∧ 是 and（且），¬x2 是「x2 的相反」。
- 括號裡的叫**子句（clause）**。子句內用 ∨ 連，子句之間用 ∧ 連，這種形式叫 CNF（conjunctive normal form）。

```
F = (x1 ∨ ¬x2 ∨ x3) ∧ (¬x1 ∨ x2 ∨ ¬x3)
        C1                  C2
```

**Satisfiability 問題**：x1、x2、x3 取什麼值，整個 F 會是真的？

### 例題：把 8 種組合全部代進去

| x1 x2 x3 | C1 = x1 ∨ ¬x2 ∨ x3 | C2 = ¬x1 ∨ x2 ∨ ¬x3 | F |
|---|---|---|---|
| 0 0 0 | 1 | 1 | 真 |
| 0 0 1 | 1 | 1 | 真 |
| 0 1 0 | 0（三項都是 0） | 1 | **假** |
| 0 1 1 | 1 | 1 | 真 |
| 1 0 0 | 1 | 1 | 真 |
| 1 0 1 | 1 | 0（三項都是 0） | **假** |
| 1 1 0 | 1 | 1 | 真 |
| 1 1 1 | 1 | 1 | 真 |

只有 010 和 101 讓某個子句全部是 0，F 為假；其他 6 種都讓 F 為真。

3 個變數要試 2³ = 8 種；**n 個變數就要試 2ⁿ 種**，所以 SAT 用這種方法也是指數時間，和 knapsack 那些問題同一類。

### State space tree

這些組合可以畫成一棵 **state space tree**：每一層決定一個變數（左分支 = 1、右分支 = 0）。從 root 走到 leaf 的一條路就是一組 (x1, x2, x3)，例如 1 → 0 → 1 就是 101；8 個 leaf 就是 8 種組合。

```
                    root
           x1=1 /          \ x1=0
              ○              ○
        x2=1 / \ x2=0  x2=1 / \ x2=0
            ○   ○          ○   ○
           / \ / \        / \ / \      ← x3 = 1 / 0
         111 110 101 100 011 010 001 000
```

## 0/1 knapsack 用的是同一棵樹

**0/1 knapsack**：3 個物品，每個有 profit（價值）和 weight（重量），背包容量 8；要讓 profit 越大越好，但總重不能超過容量。

- 解寫成 (x1, x2, x3)：xi = 1 表示放第 i 個物品，0 表示不放。
- 放或不放，一樣是 2³ = 8 種，畫出來是**同一棵 state space tree**；n 個物品就是 2ⁿ 種。
- 解法也一樣，逐一試每個 leaf：SAT 看公式是不是真的，knapsack 看 profit 是不是最大、有沒有超重。

問：把兩個題目都拿掉，只剩這棵樹，它是 SAT 的，還是 knapsack 的？
答：**兩個都是**。它們的解長得一模一樣，所以只要能在 polynomial time 解這棵樹，兩個問題就都能在 polynomial time 解。這是直覺；正式把它們關聯起來的方法是 reduction。

## SAT ∝ L：被 SAT 歸約到的都是 NP-hard

把 SAT 也加進指數時間問題的清單，先給這些問題一個名字：**hard problems**。SAT 是 base problem，叫它 **NP-hard**；其他的先叫 hard problems。

怎麼證明其他問題跟 SAT 有關係？用 reduction。另一種寫法：

```
SAT ∝ 0/1 knapsack     讀作 "satisfiability reduces to 0/1 knapsack"
（∝ 和 ≤p 是同一件事的兩種符號）
```

- 做法：拿 SAT 的一個 instance（一個具體的公式），在 polynomial time 內轉成 0/1 knapsack 的一個 instance。
- 意義：如果有人能在 polynomial time 解 knapsack，那「先轉換、再解 knapsack」就能在 polynomial time 解 SAT。
- **誰先被解出來不重要**，重點是它們連在一起：任何一個被解出來，另一個也自動解出來。
- 轉換本身只能花 polynomial time；要花 exponential time 就沒用了。

SAT 是 NP-hard，SAT ∝ 0/1 knapsack，所以 **0/1 knapsack 也是 NP-hard**。

### 遞移性

Reduction 有**遞移性（transitivity）**：

```
SAT ∝ L1      → L1 是 NP-hard
L1  ∝ L2      → L2 也是 NP-hard

例：SAT ∝ 0/1 knapsack ∝ graph coloring ∝ sum of subsets、Hamiltonian cycle …
```

不用每個問題都直接從 SAT 轉，從任何一個已知的 NP-hard 問題轉過來都可以。

> **重點** 只要 SAT **直接或間接** reduce 得到某個問題，那個問題就是 NP-hard。

## NP-hard ∩ NP = NP-complete

這些 NP-hard 問題裡，有沒有誰已經有 non-deterministic polynomial time 演算法？有：**SAT**。SAT 既是 NP-hard，又在 NP 裡，所以它是 **NP-complete**，落在兩個集合的交集。

```
 NP-hard（紅）：SAT、0/1 knapsack、graph coloring、sum of subsets、…
 NP（藍）     ：有 non-deterministic polynomial 演算法的問題（含 P）

        ┌──── NP ────┐
        │            │
        │      ┌─────┼──────── NP-hard ────┐
        │      │ SAT │ 0/1 knapsack, …     │
        │      └─────┼─────────────────────┘
        └────────────┘
               ↑
        交集 = NP-complete
```

這張圖只把「到目前為止兩個條件都已證明」的 SAT 放在交集裡；0/1 knapsack、graph coloring 等問題的 decision 版其實也在 NP，一旦證明，它們同樣是 NP-complete。

換成你自己的新問題 L，研究它基本要做兩件事：

1. 證明 SAT（直接或間接）reduce 到 L → L 進了 **NP-hard**。
2. 證明 L ∈ NP（寫出 non-deterministic polynomial time 演算法；正式說法是 L 有 polynomial time verifier）→ L 走進交集，成為 **NP-complete**。

能直接找到多項式解法當然最好；解不出來，至少做完這兩件。

> **觀念** 「有 non-deterministic polynomial 演算法」和「有 polynomial time verifier」是描述 L ∈ NP 的兩種說法，後者是較正式的定義。

## NP-complete 的正式定義

白話說，**NP-complete 是 NP 這個 class 裡最難的一小撮問題**。

假設 problem Y 屬於 NP，而且是 NP-complete。那 NP 裡**任何一個**問題 X 都可以 reduce 到 Y（X ≤p Y），用 Y 的演算法去解。所有 NP 問題都能靠 Y 解，所以 Y 是 NP 裡最難的。

把它收成兩個要件。一個 decision problem L 是 **NP-complete**，代表：

1. **L ∈ NP**。說的是「NP 裡最難的」，當然要在 NP 裡，缺一不可。
2. **NP 裡任何一個 L′ 都滿足 L′ ≤p L**。大家都能 reduce 到 L、用 L 的方法解，所以 L 最難。

> **重點** 第二個性質另外有名字，叫 **NP-hard**。只滿足 ② 叫 NP-hard；① ＋ ② 都滿足才是 NP-complete。即 **NP-complete = NP ∩ NP-hard**。

史上第一個 NP-complete 問題，就是照這個定義直接證的，非常難：因為要證「**每一個**」NP 問題（for each）都能 poly reduce 過來。Cook 的方法比較 tricky：用一種通用的表示法（general representation）把所有 NP 問題表示出來，再證明這個表示能轉過來，一次搞定。有了第一個之後，其他問題只要從已知的 NP-complete 問題 reduce 過來即可（前面的遞移性）。

## 難度軸上的 NP-hard 與 NP-complete

把問題依難度排在一條軸上，P 和 NP 各是軸上的一個刻度（越往右越難）。

**Tetris**（俄羅斯方塊）是個好例子。一般很相信 Tetris 在 NP 裡、但不在 P 裡，也就是落在 **NP − P** 這一塊；但這沒有被證明：如果 P = NP，NP − P 就是空的。確定知道的是：**只要 NP − P 裡有任何問題，Tetris 一定也在裡面**。某種意義上 Tetris 是 NP 裡最難的之一，這個刻度上還擠著很多問題。所以只要相信 P ≠ NP，就能推出 Tetris 不在 P。

為什麼？因為 Tetris 是 **NP-hard**：至少和 NP 裡**每一個**問題一樣難。是「≥」，不是嚴格的「>」，所以 Tetris 畫在 NP 的最右端。

```
難度 →
        P 的刻度          NP 的刻度
   ─────────┼─────────────────┼──────────────────→
   [  P     ]                 │
   [        NP                ]
                              [  NP-hard ……（一直往右）
                              ↑
                    Tetris：NP ∩ NP-hard = 剛好在 NP 的刻度上
```

- **情況一：P = NP**。P 的刻度移到 NP 的位置，Tetris 還在最右端，但它也在 P 裡（這樣就不有趣了）。
- **情況二：P ≠ NP**（NP 比 P 大）。NP 的最右端在 P 外面，所以 Tetris ∉ P。

Tetris 是 **NP-complete**，意思有兩個：它是 NP-hard，而且它在 NP 裡，即 NP ∩ NP-hard。NP-hard 是「從 NP 刻度往右的全部」：可能剛好在刻度上，也可能更右邊、更難。Tetris 既在 NP（刻度左邊這一段），又是 NP-hard（刻度右邊這一段），兩段的交集剛好落在刻度上。

> **重點** 證出一個問題是「某某-complete」的好處，就是知道它在難度軸上的**確切位置**：剛好在那個 class 的刻度上。

> **陷阱** NP-hard 的問題**不一定在 NP 裡**（可能在更右邊）；NP-complete 必須同時在 NP 裡且是 NP-hard。

## EXP-complete：chess 為什麼不在 P

NP-hard、NP-complete 是拿 NP 當刻度；同一套想法換成 EXP 當刻度，就得到 EXP-hard 與 EXP-complete：

- **EXP-hard**：從 EXP 刻度往右的全部，也就是至少和 EXP 裡每個問題一樣難。
- **EXP**：從刻度往左的全部。
- **EXP-complete**：兩段的交界，EXP 裡最難的問題。

```
難度 ──────────────────────────────────────────→
 [   P   ]
 [        NP        ]
 [              EXP              ]
                                 ↑ chess（EXP-complete）
                                 [ EXP-hard ……………→
```

**chess（西洋棋，n × n 盤面的推廣版）是 EXP-complete。** 這也是目前唯一已知、證明 chess 不在 P 的方法：

1. P ≠ EXP（EXP 比 P 大）很容易證明，早就證出來了。
2. chess 在 EXP 的最右端，而最右端一定在 P 的外面。
3. 所以 chess ∉ P。

> **觀念** NP 和 EXP 是不是一樣大（NP = EXP？）也還沒有人知道。這題沒有一百萬美元獎金，但一樣是大問題。

### chess 問題：給一個盤面，我能不能贏？

chess 跟 NP-complete 不是同一類，它在 EXP。問題是：給一個盤面，我能不能贏？要是有這個演算法就太好了：每一步都看走完後的盤面能不能贏，永遠只走到「能贏」的盤面，最後一定會贏。可惜沒有，chess 到現在還沒被完整解出來。

指數時間的演算法是有，但要問：**對什麼取指數？** 如果是 2ⁿ 而 n = 10，那還好。chess 是對「盤面配置的數量」取指數，配置多到沒有任何電腦算得完。打敗西洋棋冠軍的電腦 Deep Blue 大約只往下搜 15 步，能跟人比，但不保證每次都贏。

- 只有 P 以內的問題才算「解得快」。在乎的是 **scale**：輸入變大時還跑不跑得動。
- 指數演算法在 n = 8、10 這種小問題還能跑，n 一變大就撞牆。
- 比較聰明的演算法，只是把 2^(cn) 裡的常數 c 變小：跑得快一點、看得深一點，但擺脫不了 2ⁿ。

> **重點** 改進常數救不了指數：2^(cn) 的 c 再小，n 變大時仍然爆炸。

Tetris 則在 NP 那裡（不是 EXP 的最右端）。機器學習的很多問題也落在很難的區域，所以不好 scale。

## NP-hard 是一大片：連不可判定的都算

把 P、NP、NP-hard 畫在同一張地圖上，NP-hard 是一大片區域：難度**至少**跟 NP 裡最難的問題一樣，甚至更難。可以這樣理解：本質上比 nondeterministic Turing machine 在 polynomial time 內可解的問題更難（或一樣難）的，都歸到 NP-hard。

```
┌──────────────────────── NP-hard（一大片）────────────────┐
│                                                          │
│  ┌──── NP ────────────┐                                  │
│  │  ┌─ P ─┐    ┌──────┼── NP-complete（NP ∩ NP-hard）    │
│  │  └─────┘    │ SAT  │                                  │
│  └─────────────┴──────┘   沒有 poly verifier 的問題       │
│                           停機問題（undecidable）         │
└──────────────────────────────────────────────────────────┘
（圖是假設 P ≠ NP 時的樣子）
```

- NP-hard 這個分類太廣：它也收了連「快速驗證」都做不到的問題（沒有 polynomial time verifier），這些落在 NP 圈圈外面。
- 甚至連**不可判定（undecidable）**的問題都算，例如停機問題（Halting problem）：沒有任何程式能對所有輸入回答它，但它也是 NP-hard。
- 所以說一個問題是 NP-hard，只告訴你「它至少和 NP 一樣難」，對它到底多難說得很少。
- 很多實際上重要的問題其實都在 NP 裡，例如 TSP 的判定版、SAT。所以更值得問的是 NP 裡面的事。

> **陷阱** 常見說法「NP-hard 問題永遠不可能在 P」只有在**假設 P ≠ NP** 時才成立。NP-hard 的定義是「所有 NP 問題都能 poly time reduce 到它」；如果哪天證明 P = NP，NP-complete 問題就都在 P 了。

## NP-complete：一題有解，全部有解

更好的問題是：NP 裡有沒有一些問題，還不知道能不能用 polynomial time 解？有，例如 **SAT**（布林公式能不能被滿足），它就在 NP 和 NP-hard 交疊的地方。

1970 年代初，**Stephen Cook** 和 **Leonid Levin** 各自發現：某些 NP 問題的難度，和整個 NP 綁在一起。

- 只要這些問題裡**任何一個**有 polynomial 演算法，所有 NP 問題都能用 polynomial time 解。
- 原因是每一個 NP 問題都能 reduce 到這一類問題。這一類就叫 **NP-complete（NPC）**，剛好是 NP 和 NP-hard 的交集。

影響很大：從 NPC 裡挑一題、給出 polynomial 演算法，就能拿到千禧年大獎（Millennium Prize）的一百萬美元，目前沒人做到。

> **例題** 實際用途：主管要你做一個「即時」解某問題的 app，結果那個問題是 NPC。
> 這時可以有根據地說明：目前已知最好的 deterministic 方法都要 exponential time，要即時算出最佳解並不實際。

## NPC 有 poly 解 ⇒ P = NP：P vs NP 的兩種結局

### 定理：NPC 有 poly 解 ⇒ P = NP

由 NPC 的定義直接得到一個很重要的定理：

1. 設 Y 是 NP-complete，而且有一天有人能用 polynomial time 解 Y，那 Y ∈ P。
2. 剩下的 NP 問題都能（在 polynomial time 內）轉成 Y 的 input，用 Y 的演算法解，所以也都屬於 P。
3. P 撐滿整個 NP：P = NP。

```
有人 poly time 解掉 Y（NPC）之前：      之後：
┌──── NP ──────────────┐             ┌──── NP = P ──────────┐
│ ┌ P ┐       ┌ NPC ─┐ │             │                      │
│ └───┘       │  Y   │ │     ⇒       │   Y 和所有 NP 問題    │
│             └──────┘ │             │   都 poly time 可解   │
└──────────────────────┘             └──────────────────────┘
```

那 P 到底等不等於 NP？目前不知道，所以打一個問號：P =? NP。從 1970 年代到現在過了幾十年，還沒有人能用 polynomial time 解任何一個 NP-complete 問題，所以大部分人傾向相信 **P ≠ NP**，但也沒人證明得出來。

> **觀念** 2010 年，HP 的研究員 Vinay Deolalikar 提出一份 81 頁的證明，宣稱 P ≠ NP。他把證明放上網讓大家幫忙 debug、找致命錯誤，引起廣泛討論。後來大家發現證明有瑕疵、過不去，幾個月後就撤下來了。所以到現在，這個問題還是沒人解決。

整理三個名詞：

| 類別 | 意思 |
|---|---|
| P | 能用 polynomial time **解（solve）**的問題 |
| NP | non-deterministic polynomial 的縮寫（**不是** non-polynomial），能在 polynomial time 內**驗證（verify）**的問題 |
| NP-complete | NP 裡比較小的一群，是 NP 裡最難的問題；所有 NP 問題都能 poly time reduce 到它 |

如果有一天有人能用 polynomial time 解一個 NP-complete 問題，P 和 NP 就合而為一，所有 NP 問題都變簡單，「世界大同」。

### 只有兩種情況

P 是否等於 NP，答案只有兩種：等於，或不等於。

- **情況一：P = NP。** 有人對某一個 NPC 問題 L 找到 polynomial time 演算法，L 就屬於 P；所有 NP 問題都能 reduce 到 L，而 L 又能 poly time 解，所以所有 NP 問題都能 poly time 解。
- **情況二：P ≠ NP。** 有人明確證明 NPC 問題不可能有 polynomial time 演算法，就得到 P ≠ NP。

**Tractable** 指 polynomial time solvable（能有效率地解）；**intractable** 就是相反。NP-complete 到底比較靠 tractable 那邊，還是 intractable 那邊？目前確實沒有人知道。

### P 會長大嗎？Cook's theorem

另一種看法：P 是**今天已經知道**的 deterministic polynomial time 演算法。今天只有 non-deterministic 演算法的問題，明天可能找到 deterministic 的、進到 P 裡，所以 P 會越長越大，甚至有一天長到跟 NP 一樣大。（這只是一種樂觀的說法；多數學者其實相信 P ≠ NP。）

但這條路行得通嗎？如果 non-deterministic 永遠變不成 deterministic，那些 non-deterministic 演算法的研究就白做了。所以至少要證明這條路是對的：證明 P = NP。證出 P = NP 的意思是：解法其實已經存在，只是還沒被「發現」，不需要重新發明。

Cook 處理這件事，留下著名的 **Cook's theorem**，常見的一種說法是：

```
SAT ∈ P  ⇔  P = NP
```

也就是 SAT 一旦有 deterministic polynomial 演算法，P 就撐滿整個 NP。Cook 自己並沒有證出 SAT ∈ P，他只說：誰能證出來，這些研究就是對的。

> **陷阱** 正式的 Cook–Levin 定理內容是「**SAT 是 NP-complete**」；「SAT ∈ P ⇔ P = NP」是它的推論，不是定理本身。

## 第一個 NP-complete 問題從哪來

### Cook 與 Karp：NPC 的起源

問題的難度怎麼分級，故事要追溯到 1970 年代初期的兩個人，他們替後人打下 foundation，後人站在巨人的肩膀上繼續發展：

| 年份 | 人 | 貢獻 |
|---|---|---|
| 1971 | Stephen Cook | 證明史上第一個 NP-complete 問題：SAT（布林公式的可滿足性） |
| 1972 | Richard Karp | 一口氣發表 **21 個** NP-complete 問題 |

Karp 的 21 個是從 SAT 出發一路 reduce 出來的，清單本身就包含 SAT，所以一開始一共是 **21 個**（不是 1 + 21 = 22）。那個年代，只要找到一個新問題並證明它是 NP-complete，就能寫一篇論文。

還有一本很有名、到現在都很常被引用的書：Garey 和 Johnson 的《Computers and Intractability》（1979），等於是一本 **NP-complete 問題的字典**。遇到新問題就翻字典，看它是不是 NP-complete：

- 如果是，就知道要找 efficient 的最佳解大概不可行，馬上退而求其次：找 **heuristic（經驗法則）**或 **approximation algorithm（近似演算法）**。

當時世界各地的人各做各的研究、名詞（terminology）也各自定義，所以讀這部分的書，常看到意思差不多、名字不同的詞。

### Cook–Levin：不靠 reduction 的第一個

證明 B 很難的標準做法是從一個已知很難的 A reduce 過來。問題來了：**第一個 A 從哪裡來？** 所以一定要有「第一個」NP-complete 問題，後面的人才能拿它當 A。

這就是 **Cook's theorem（Cook–Levin 定理）**：不靠 reduction，而是從 **first principles**（最根本的定義，幾乎直接從 NP 的定義）證明 Boolean satisfiability（SAT）是 NP-complete。

```
NP-complete bucket（籃子）
  第 1 個：SAT          ← 從 first principles 直接證
  第 2 個：B            ← SAT ≤p B
  第 3 個：C            ← SAT ≤p C 或 B ≤p C（籃子裡任一個都可以）
  ……
```

- SAT 成為第一個放進籃子的問題；之後大家用 reduction，從 SAT reduce 到新問題，證明它也很難，就把它加進籃子。
- 籃子裡有兩個以後，證第三個時可以從籃子裡**任何一個** reduce 過來，不一定要從 SAT（reduction 有遞移性：SAT ≤p L₁、L₁ ≤p L₂ ⇒ L₂ 也是 NP-hard）。
- 反過來，只要籃子裡任何一個找到 polynomial time 解，透過這些 reduction，全部都被解掉。它們全部綁在一起：**解一個，等於解全部**。

> **陷阱** 證明了 SAT ≤p L，只能說 L 是 **NP-hard**；還要證 L ∈ NP（有 non-deterministic polynomial 演算法／poly time verifier）才是 NP-complete。

### CIRCUIT-SAT：電路能不能輸出 1

另一個常被列為「第一個 NPC」的問題是 **circuit satisfiability（CIRCUIT-SAT）**。證明不講，但題目一定要記，大一邏輯設計就做過很多遍了。

- 給一個 **combinational circuit（組合電路）**：左邊是 input x1、x2、x3，右邊是一個 output。
- 電路只由三種 gate 組成：
  - **AND**（符號倒 V，∧）：所有輸入都是 1，輸出才是 1。
  - **OR**（符號正 V，∨）：只要有一個輸入是 1，輸出就是 1。
  - **NOT**（符號 ¬，negation）：0 變 1、1 變 0。
- 問：能不能適當地把 input 設成 0 或 1，讓 output 是 1？能的話，這個電路就是 **satisfiable（可滿足）**。

### 例題：推一個小電路（示意）

電路如下：

```
第一層                第二層             第三層
x1, x2 → [AND] → g1 ─┐
x3     → [NOT] → g2 ─┴→ [OR] → g4 ─┐
x2, x3 → [OR]  → g3 ───────────────┴→ [AND] → output

g1 = x1 ∧ x2      g2 = ¬x3      g3 = x2 ∨ x3
g4 = g1 ∨ g2      output = g4 ∧ g3
```

先試 input 000：

| x1 x2 x3 | g1 = x1∧x2 | g2 = ¬x3 | g3 = x2∨x3 | g4 = g1∨g2 | output = g4∧g3 |
|---|---|---|---|---|---|
| 0 0 0 | 0 | 1 | 0 | 1 | **0** |
| 0 1 0 | 0 | 1 | 1 | 1 | **1** |

000 的 output 是 0；適當地調一下，改試 010，g3 變成 1，output 變成 1，所以這個電路可滿足。

小電路推一推就出來，但 input 有 n 個時有 2ⁿ 種組合可以試。

> **陷阱** 嚴格說，Cook 1971 原始證明的是 SAT（布林公式）；CLRS 的寫法是先證 CIRCUIT-SAT 是 NPC，再把它歸約到 SAT。兩種說法都會看到。

## SAT、CNF 與 k-SAT

### SAT 與 CNF

**SAT（satisfiability，可滿足性）**：給一個邏輯式子，找出變數的值（true 或 false），讓整個式子為 true。

SAT 的式子有固定格式：

- 由很多**子句（clause）**組成，子句之間用 **AND**（∧，「而且」）連起來。
- 每個子句裡只有變數，或前面加了 **NOT**（¬）的變數（合稱 literal，文字），用 **OR**（∨，「或」）連起來。

這種「AND 連起一堆 OR 子句」的形式叫 **CNF（conjunctive normal form，合取範式）**。

- 子句之間是 AND ⇒ **每一個子句**都必須為 true。
- 子句裡面是 OR ⇒ 每個子句裡**至少一個文字**為 true。

設有 n 個子句，每個子句最多 k 個變數。k 看起來只是個常數，但它重要到放進問題的名字：**k-SAT**。最重要的兩個是 **2SAT** 和 **3SAT**。

> **例題** 找變數值滿足
> `(x1 ∨ ¬x2) ∧ (x1 ∨ x4) ∧ (¬x1 ∨ x4) ∧ (¬x3 ∨ x4) ∧ (x2 ∨ x4)`
> 這是五個子句，每個子句 2 個文字，所以是 2SAT。題目是要「想出」x1 到 x4 的值，不是代值進去算：
> 1. 令 x4 = T：含 x4 的四個子句（第 2～5 個）都滿足。
> 2. 剩第一個 (x1 ∨ ¬x2)，令 x1 = T 就滿足。
> 所以 x1 = x4 = T（x2、x3 任意）就滿足整個式子。

> **例題** 3-CNF `(x1 ∨ ¬x2 ∨ x3) ∧ (¬x1 ∨ x2 ∨ ¬x3)` 在哪些 (x1, x2, x3) 為假？
> 某個子句的三個文字全假，整式就假。第一個子句全假要 x1 = 0、x2 = 1、x3 = 0，即 (0, 1, 0)；第二個子句全假要 x1 = 1、x2 = 0、x3 = 1，即 (1, 0, 1)。其餘 6 組都讓式子為真。

### 2SAT 在 P，3SAT 是 NP-complete

- **2SAT** 有多項式解法，而且只要線性時間 O(n)。
- **3SAT** 是 NP-complete！誰能快速解它，可以拿圖靈獎，或變得超有錢。
- 子句更長的 k-SAT（k > 3）都能用合理的 reduction 轉成 3SAT，輸入大小不會爆炸，所以 3SAT 就足以代表全部。

```
難度 ────────────────────────────────────────→
 [ 2SAT: O(n) …… P ]
 [                 NP                    3SAT ]  ← NP 的最右端
```

子句允許 2 個還是 3 個變數，看起來只差一個常數：2SAT 是 O(n)，在 P 的很左邊；3SAT 卻一路跑到 NP 的最右端，是 NP 裡最難的。只差一個變數，天差地遠。

> **重點** 2SAT ∈ P（線性時間）；3SAT 是 NP-complete。k 從 2 變 3，難度從「很簡單」跳到「NP 裡最難」。

### 暴力法與 SAT solver

問：把每個變數都試 true 和 false 呢？
答：那是 2ⁿ 種組合（n 是變數個數），指數時間，不是多項式。例如 3 個變數要試 2³ = 8 組。這反而讓人放心：要是這樣就是多項式，全世界這麼多年都白忙了。所以考試、面試這種有時間壓力的場合，別想當場解這個問題。

- 用暴力法（全部試），大約 **20 個變數**就跑不動了。
- 有研究者想把 3SAT 解得快一點，例如做到 2^(0.0001n)：那還是指數，但能解很多實際問題。
- 最先進的 **SAT solver**，幾個小時能處理 **1000 到 10000 個變數**。它們靠的是找出式子可以化簡的地方、做推論，再聰明地搜尋可能的組合。
- 但還不是多項式：例如 1000 bits 的 factoring 就沒被破解，不然大家早就發現了。

## 為什麼每個 NP 問題都能轉成 3SAT

只要解出 3SAT，就解出所有 NP 問題（因此所有 NP-complete 問題），因為每個 NP 問題的 verifier 都能轉成邏輯式。證明的概念如下：

1. 拿任何一個 NP 問題的 **verifier**。它需要兩樣東西：題目的輸入，和 proof（證據）。
2. 把 verifier 寫成一個**電路**，由 AND、OR、NOT 這些邏輯閘組成；電路最後算出 true（接受）或 false（不接受）。
3. **題目的輸入直接寫死在電路裡**，只有 proof 的 bits 是電路的輸入變數。
4. 電路很容易寫成布林式：每個 proof bit 變成一個布林變數，每個閘變成 AND、OR、NOT 這些布林函數。
5. 把布林式轉成 **3CNF**（每個子句 3 個文字的 CNF），丟給 3SAT。
6. 如果 3SAT 說可以滿足，它給出的變數賦值就是 proof 的每一個 bit。把這份 proof 餵回 verifier，verifier 會接受，原本的問題就解決了。

```
NP 問題的 verifier(input, proof)
        │ input 寫死在電路裡
        ▼
電路（AND / OR / NOT），變數 = proof 的 bits
        ▼
布林式 → 3CNF
        ▼
3SAT 求解 ── 可滿足 ──→ 賦值 = proof 的 bits ──→ 餵回 verifier：接受
```

為什麼整個過程是多項式？verifier 是多項式時間，所以電路大小也是輸入大小的多項式；proof 本來就是多項式大小。全部都在「多項式的世界」裡。這對**任何** NP 問題都成立，因為每個 NP 問題都一定有一個多項式時間的 verifier。

> **陷阱** 輸入要寫死在電路裡，不是當變數：我們不需要 3SAT 告訴我們輸入是什麼，要它找的只有 proof。

> **例題** Factoring：要分解 N。
> 把「N mod p 是否為 0」的演算法寫成電路，p 的 bits 是電路的輸入變數，N 寫死在電路裡。轉成 3CNF 丟給 3SAT，解出的變數值就是 p 的 bits，也就是 N 的一個因數。3SAT 要是解得夠快，你就把 N 分解了（破解加密），然後變成富翁。

## Factoring 不是最難的；NPC 全部綁在一起

factoring 在 NP 裡，但一般認為它**不是最難**的那一類 NP 問題。

> **陷阱** 「factoring 不是 NP 問題」是錯的說法。factoring ∈ NP，只是一般認為它不是 NP-complete（目前未知）。

前面「真能 poly time 解 NP 問題，早就有人破解加密賺大錢」的論證是常識論證，不是數學證明，但至少說明沒人知道怎麼在多項式時間解 NP 問題。

問：解是多項式大小、verifier 也很快，為什麼寫不出快的解題程式？
答：理論學者已經想這件事 40 多年了。想不出演算法，就改想證明「不可能」（P ≠ NP），這也失敗了。停機問題不一樣：它已經被證明沒有程式能解，大家都接受；但 P vs NP 到現在還證不出來。

退而求其次：找出 NP 裡「最難」的問題來研究，這些就是 NP-complete。factoring 不在這群裡（雖然它能讓你發財），有些問題比它更難。

- NP-complete 問題有好幾百個，很多有實際用途，解出來能幫公司省很多錢。
- 它們全部互相關聯：透過 reduction，解出其中一個，就解出全部（其他問題都能轉成它，用同一個解法解決）。
- 這麼多人想解，卻沒人解出任何一個，所以大家相信它們真的很難。

## NP-complete 問題動物園

| 問題 | 說明 |
|---|---|
| TSP（旅行推銷員） | 在圖上找一條走過**所有**頂點的最短路線（不是只到一個點） |
| 多字串 LCS | 兩個字串的最長共同子序列用 DP 就能解；但 n 個字串的 LCS 是 NP-complete |
| 謎題 | 踩地雷（Minesweeper）、數獨（Sudoku）……大部分有趣的謎題都是 NP-complete |
| SAT | 給一個布林式（只有 T/F 的邏輯式），例如 `x ∨ y ∧ ¬x`，問有沒有一組變數值讓它為 true；第一個被證明 NPC 的問題 |
| 3-coloring | 能不能用 3 種顏色替圖的每個點著色，讓相鄰的點顏色都不同 |
| 3D 最短路徑 | 如果你會飛，要從這裡飛到天花板上某一點，找最短路線竟然很難（嚴格說是已證明 NP-hard）；2D 平面上的最短路徑則是多項式時間，還好我們走在地上，能用平面和圖來建模 |
| Knapsack | 背包問題是 NP-complete，所以學過的 pseudo-polynomial 解法 O(nW) 已經是極限，除非 P = NP |

SAT 之所以是第一個，是因為用 reduction 證明總要有一個起點，而 SAT 幾乎可以直接從 NP 的定義證出來。

整個計算複雜度的大圖：

```
P ⊆ NP ⊆ EXP ⊆ R
```

### NPC 問題才是主流

NP-complete 問題非常多，各個領域都有。例如電機領域：

- **VLSI layout**（晶片佈局）
- **RTL 轉成 netlist** 那一塊，有很多很困難的問題
- 很多**驗證（verification）**問題，也都非常困難

後來大家發現：NP-complete 問題才是主流。實際遇到的問題，大概 99.9999% 都是 NP-complete 甚至更難；只有運氣很好時，才會遇到能 polynomial time 求最佳解的。課本雖然寫得很厚，但能用 polynomial time 最佳解的問題，其實只是很小的 subset。

## NPC 是解題地圖上的地雷

NP-complete 對解題的實際用處：想像你在考試或面試，從一個題目出發。把所有可能的問題想成一張**圖**，你的題目是起點。

- 圖上有幾個「終點」（笑臉）：你已經會解的問題。能轉成它們，就能寫答案走人：
  - merge sort（排序）
  - graph search：BFS、DFS
  - 最短路徑
  - 學過的 DP 問題
  - hashing、divide and conquer
- 你要做的，就是從起點靠一連串 **reduction** 走到任何一個笑臉。

```
            ┌→ 問題 A
題目（起點）─┼→ 問題 B（看起來最簡單，先走）─┬→ B1
            └→ 問題 C                     ├→ B2 ─→ …… ─→ ☺ 最短路徑：寫答案
                                          └→ B3
另一條路：題目 ─→ X ─→ Y ─→ 「poly time 解 knapsack」 ✗ 地雷，立刻回頭
```

1. 看到三種可能的轉換，沒時間全部試，就挑看起來最簡單的先做。
2. 它又能轉成三個新問題，再挑一個看起來有希望的。
3. reduction、reduction、reduction，走到笑臉，寫下來，解完。

壞情況是走上另一條路，每一步都離會解的問題越來越遠，一直試到面試官問「你有什麼問題想問我們？」，或監考說「考卷可以交了嗎？」。

以前地圖上只有好的終點；現在多了 NP-complete 問題，你知道它們很難，它們就是**地雷（哭臉）**。例如轉到最後變成「用多項式時間解 knapsack」：全世界都解不出來，就別走這條路，立刻回頭換方法。知道哪裡不能去，搜尋範圍就小很多，更容易找到通往笑臉的路。

> **重點** 讀 CLRS 的 NP-complete 章，認得更多「哭臉」：讀懂問題的敘述就好，證明不用管，相信它是 NP-complete 即可。考試、面試會順很多。

## 證明 NP-complete 的兩個步驟

有了 reduction 和 NP-complete 的定義，就能整理出「證明一個新問題是 NP-complete」的固定流程。設：

- **L**：想證明是 NP-complete 的新問題。
- **L′**：一個大家已經知道是 NP-complete 的問題，例如 SAT。

L 和 L′ 都必須是 **decision 版**（回答 yes／no），不是 optimization 版。

1. **證明 L ∈ NP**：L 的解（certificate）能在 polynomial time 內被驗證。
2. **證明 L′ ≤p L**：把已知 NPC 的 L′ reduce 到新問題 L。方向是 L′ → L，不能反過來。

兩步都完成，L 就是 NP-complete；只做第二步，只證到 L 是 **NP-hard**。

> **陷阱** 第二步最常見的錯誤是把方向弄反，寫成 L ≤p L′（把自己的問題轉成已知的難題）。這只代表「走這條路解 L 很難」，不代表沒有別條簡單的路，證不出 L 很難。正確方向 L′ ≤p L 的意思是：要是 L 能快速解，大家公認很難的 L′ 也就能快速解了，這不太可能，所以 L 很難。

問：為什麼證 NPC 一律用 decision 版？
答：optimization 版至少和 decision 版一樣難（找得到最佳解，就能回答「有沒有 ≤ B 的解」）。只要證明 decision 版設計不出 efficient 演算法，optimization 版只會更難，所以證 decision 版就夠了。

問：reduction 除了要 polynomial time，還要滿足什麼？
答：yes 對 yes、no 對 no：A 的 instance 答 yes，轉出的 B instance 也答 yes；A 答 no，B 也答 no。否則 B 的答案不能拿來當 A 的答案。

## Hamiltonian cycle 問題

接下來用一個完整的例子把兩個步驟走一遍：**Hamiltonian cycle ≤p TSP**。先介紹左邊這個已知很難的問題。

**Hamiltonian cycle（HC，哈密頓迴路）**，也有人叫 **Hamiltonian circuit**，指的是同一件事。

- **Input**：一張 undirected graph G。
- **問題**：能不能拿一支筆，從某一點出發，一筆畫經過所有的點（每點恰好一次），最後回到起點？
- 「筆不離開紙」的意思是：**只能用 input 圖上給定的 edge** 來完成這個 cycle。

Hamiltonian circuit problem 已經被證明是 NP-complete。

### 有 HC 和沒有 HC 的例子

- 由很多五角形拼成的圖（特別設計的經典例子）存在 Hamiltonian cycle：可以沿著一條路線經過每個點一次再繞回起點。
- **bipartite graph（二分圖）**：點分成左右兩組，邊只連左右兩組之間。下面這張 K₂,₃（左邊 2 個點、右邊 3 個點，左右全部相連）就畫不出來：

```
   左        右
   a1 ─┬─── b1
       ├─── b2
       └─── b3
   a2 ─┬─── b1
       ├─── b2
       └─── b3
```

在二分圖上走，一定是左、右、左、右交替。從 b1 出發：b1 → a1 → b2 → a2 → b3，走到 b3 後下一步必須回到左邊，但左邊的 a1、a2 都已經用過，回不到 b1；換別的順序也一樣，總是有一個右邊的點走不到。

> **重點** 一個 cycle 在二分圖上左右交替，所以左右兩邊用到的點數一定相等。點數為奇數、或兩邊點數不等的二分圖，一定沒有 Hamiltonian cycle。

## 目標：HC ≤p TSP

回顧 **traveling salesman problem（TSP，旅行推銷員問題）** 的 decision 版：

- 給 n 個 city（例如一個業務要拜訪的客戶），任兩個 city 之間的距離都知道。
- 問：有沒有一條 route，從某個 city 出發、經過每個 city **恰好一次**、最後回到出發點，而且**總長 ≤ 給定的 bound B**？

想建構的結論是「TSP 也很難」。方法是做一個 polynomial time reduction：**HC ≤p TSP**。HC 已知很難，只要成功 reduce 到 TSP，就代表 TSP 也很難（已知難的放左邊、新問題放右邊）。

這個 reduction 要完成兩塊：

1. **建構 transformation**：一個 function f，把 HC 的 input 轉成 TSP 的 input，並檢查 f 是 polynomial time。
2. **if and only if**：左邊 yes ⇒ 右邊 yes，而且右邊 yes ⇒ 左邊 yes。具體來說：
   - G 找得到 Hamiltonian cycle ⇒ 轉出的 TSP 有一條總長 ≤ B 的 route。
   - 轉出的 TSP 有總長 ≤ B 的 route ⇒ 能轉回 G 的一個 Hamiltonian cycle。

可以過去，也要可以回來。

## 轉換 f：有邊 cost 1、沒邊 cost 2、bound = n

f 的輸入是 HC 的 instance：一張 undirected graph G = (V, E)，有 n 個點。f 這樣造出 TSP 的 instance：

1. **city**：G 有幾個點，就建幾個 city（一點對一個 city）。
2. **距離**：TSP 需要任兩個 city 的距離，所以 TSP 的圖是 **complete graph（完全圖）**，任兩點之間一定要有 edge。原本 G 沒有 edge 的地方也要建一條，並給適當的 weight：
   - G 上**有** edge (u, v)：cost(u, v) = **1**。
   - G 上**沒有** edge (u, v)：也建一條，cost(u, v) = **2**。比較貴，走 TSP 時就不想用它。
3. **bound**：B = **n**。理由：Hamiltonian cycle 要經過全部 n 個點，只用 G 原有的 edge 走一圈，共 n 條 edge，每條 cost 1，加起來剛好 n。

**轉換的時間**：建 n 個點是 O(n)；任兩點都有 edge，約 n(n−1)/2 條，每條查一次 G 有沒有這條邊就能定 cost，整個是 **O(V²)**，polynomial time。第一塊完成。

> **觀念** 另一種寫法：G 上有的邊 cost 0、沒有的邊 cost 1、bound 0。道理完全一樣：總長 ≤ 0 就表示一條 cost 1 的邊都沒用到。

### 轉換的小例子（示意）

G 有 5 個點 a、b、c、d、e，邊為 a–b、b–c、c–d、d–e、e–a、a–c（6 條）。轉出的 TSP 是 K₅，共 5·4/2 = 10 條邊：

| 邊 | 在 G 上？ | cost |
|---|---|---|
| a–b、b–c、c–d、d–e、e–a、a–c | 有 | 1 |
| a–d、b–d、b–e、c–e | 沒有 | 2 |

bound B = n = 5。

## 正方向：HC yes ⇒ TSP yes

假設 G 找得到一個 Hamiltonian cycle，它經過所有點，寫成 v₁ → v₂ → … → vₙ → v₁。

1. 把同一圈搬到 TSP 的圖上：它也是每點恰好一次、回到起點的 route。
2. 這圈經過 n 條 edge，全部是 G 原本就有的 edge，所以在 TSP 圖上每條 cost 都是 1。
3. 總長 = n × 1 = n ≤ B = n，TSP 回答 yes。

左邊有解，右邊就找得到解。在上面的例子中，a → b → c → d → e → a 是 G 的 Hamiltonian cycle，搬到 TSP 上總長 1+1+1+1+1 = 5 ≤ 5。

## 反方向：TSP yes ⇒ HC yes

reduction 證明裡，if and only if 通常有一個方向比較難。從左到右是設計轉換時就想好的，比較自然；**回來的方向**常是卡關的地方。這題回來的方向稍難一點，但很直覺。

假設轉出的 TSP 圖上找到一條 route，總長 ≤ n。

1. 這個 tour 經過每個點恰好一次再回到原點，形成一個 cycle；有 n 個點，所以用了 **n 條 edge**。
2. 總長 ≤ n 平均分給 n 條 edge，每條平均最多 1。
3. 當初建圖時 cost 只有 1 和 2 兩種，沒有 0.5 這種值。每條 ≥ 1、總和 ≤ n，只要用到一條 cost 2，總長就至少 n + 1 > n。所以**每條都是 cost 1**。
4. cost 1 的 edge 在 G 上都有對應的 edge，把這一圈貼回 G，就是一個 Hamiltonian cycle。右邊 yes ⇒ 左邊 yes。

在示意例子裡，若 tour 走 a → b → d → c → e → a：cost 為 1 + 2 + 1 + 2 + 1 = 7 > 5，用到兩條 cost 2 的邊（b–d、c–e），不符合 bound，也正好對應到 G 上不存在的邊。只有全用 cost 1 的 tour 才會 ≤ 5，而那樣的 tour 就是 G 的 Hamiltonian cycle。

兩個方向都證完，就完成了 **Hamiltonian circuit ≤p TSP**。

## 實務證法：TSP 是 NP-complete

照定義，證明 L 是 NP-complete 要做兩件事：

1. L ∈ NP；
2. **所有** NP 問題都能 polynomial time reduce 到 L。

第 2 點實務上做不到，不可能對所有 NP 問題一個一個寫 reduction。所以實務上用一個 **theorem**：

- 第一個條件不變：**L ∈ NP**。
- 第二個條件改成：找一個**已知是 NP-complete 的 L′**，建構 **L′ ≤p L**。

這就夠了：所有 NP 問題都 ≤p L′，再接上 L′ ≤p L，就都 ≤p L。一般的 NPC 證明都用這招。

上面其實已經完整證完一題：**TSP is NP-complete**。

| 步驟 | 內容 |
|---|---|
| ① TSP ∈ NP | 猜一個 tour，polynomial time 檢查它是否每點恰一次、回到起點、總長 ≤ B |
| ② 選已知 NPC 的 L′ | Hamiltonian circuit |
| ③ 建 reduction function f | 有邊 cost 1、沒邊 cost 2、bound n；O(V²)，polynomial time |
| ④ 證 if and only if | HC yes ⇔ TSP yes，兩個方向都要證 |

透過 Hamiltonian circuit 當媒介，證明了 TSP 是 NP-complete。

問：要證明新問題 Y 很難，reduction 該怎麼寫？
答：已知 NPC 的 X ≤p Y。已知難的放左邊、新問題放右邊；放反（Y ≤p X）只說明 Y 不比難題難，沒有資訊。

問：X ≤p Y 且 Y ≤p X 代表什麼？
答：兩者 **polynomially equivalent**，一樣難；互相 reduce 得過去，只差 transformation 的時間。

問：bipartite matching ≤p network flow 告訴我們什麼？
答：這是新問題放左邊、已知可解的問題放右邊的用法：matching 可以 efficient 解，而且不比 flow 難。

## Complete graph 與 clique

再看另一個 NP-hard 的 graph problem：**clique decision problem（CDP）**。先認識 clique。

### Complete graph

一張 4 個頂點的圖，每個頂點都有 edge 連到其他所有頂點，這種圖叫 **complete graph（完全圖）**。

```
  1 ─── 2
  │ ╲ ╱ │
  │  ╳  │
  │ ╱ ╲ │
  4 ─── 3
```

> **重點** n 個頂點的 complete graph 有 n(n−1)/2 條邊。4 個點：4×3÷2 = 6 條；5 個點：5×4÷2 = 10 條。

3 個頂點兩兩相連（3 條邊）也是 complete graph；只有 2 個頂點、1 條邊也是。

### Clique

在上面的 4 點圖加一個頂點 5，只連兩條邊：5–3、5–4。5 沒有連到 1、2，所以這 5 個點的整張圖**不是** complete graph。

但看它的一部分，**subgraph（子圖）**：1、2、3、4 和它們之間的邊。這個 subgraph 本身是 complete graph。

> **重點** 圖中「本身是 complete graph 的 subgraph」叫 **clique（團）**。上圖的 {1, 2, 3, 4} 是一個 size 4 的 clique。

再看一個例子：3 個點的 complete graph {1, 2, 3}，再加上頂點 4、5 和幾條邊，其中 4 沒有連到 1。

- 整張圖是 complete 嗎？不是。
- 有 4 個點的 complete subgraph 嗎？沒有（例如 4 沒連到 1，湊不成 4 個點兩兩相連）。
- 有 3 個點的嗎？有，{1, 2, 3}，是 size 3 的 clique。

clique 可以是 2 個、3 個、4 個……一直到 n 個頂點。

### 在圖上找 clique（示意）

一張 6 個頂點的圖 G：1、2、3、4 兩兩相連，另外有邊 3–5、4–5、5–6。

```
  1 ─── 2
  │ ╲ ╱ │
  │  ╳  │
  │ ╱ ╲ │
  4 ─── 3
   ╲   ╱
     5
     │
     6
```

哪些 subgraph 是 complete graph？

| clique | size |
|---|---|
| {1, 2, 3, 4}（6 條邊兩兩相連） | 4 |
| {3, 4, 5} | 3 |
| {1, 2, 3}（{1, 2, 4} 等也是） | 3 |
| {5, 6}（一條邊） | 2，最小的 |

這張圖最大的 clique 是 size 4（5 沒連到 1、2，加不進去）。

## Clique decision problem

用同一張圖分清楚 decision 與 optimization：

- 有 size 3 的 clique 嗎？yes。
- 有 size 2 的 clique 嗎？yes。
- 有 size 4 的 clique 嗎？yes。

只回答 yes 或 no 的是 **decision problem**。

- 最大的 clique 有多大？找過 2、3、4，再上去就沒有了，答案是 4。

找最大或最小的是 **optimization problem**；問「有沒有 size k 的 clique」是 decision problem。

> **重點** **Clique decision problem（CDP）**：給一張圖 G 和一個數字 k，G 有沒有 size k 的 clique？

接下來要證 CDP 是 NP-hard。只要 decision 版是 NP-hard，找最大 clique 的 optimization 版至少一樣難，也是 NP-hard。

## 證明 NP-hard 的程序

一般程序（另一種寫法，用 ∝ 表示 reduces to）：

1. 要證的問題叫 **L2**。
2. 找一個**已知 NP-hard** 的問題，叫 **L1**。
3. 證明 **L1 ∝ L2**：拿 L1 的任一個 instance，從它造出 L2 的 instance，做到「L2 能在 polynomial time 解，L1 也就能在 polynomial time 解」。
4. 轉換本身必須在 polynomial time 內完成。

套到本題：L2 = CDP，L1 選 **satisfiability（SAT）**。所以要證 **SAT ∝ CDP**：拿一個 CNF 公式，從它造出一張圖和一個 k，使得「公式可滿足 ⇔ 圖有 size k 的 clique」。

## SAT ∝ CDP 的建構

### 例子公式

3 個變數 x1、x2、x3 的公式（∨ 是 or、∧ 是 and、¬ 是相反）：

```
F = (x1 ∨ x2) ∧ (¬x1 ∨ ¬x2) ∧ (x1 ∨ x3)
       C1            C2            C3
```

- 三個括號是三個 **clause（子句）** C1、C2、C3，子句之間用 ∧ 連。
- 子句不一定含全部三個變數，這裡每個子句只有兩個 literal。
- 一般來說公式有 k 個子句 C1 … Ck；目標是造一張圖，讓「有 size k 的 clique」對應「公式可滿足」。這裡 k = 3。

### 頂點：每個 literal 一個頂點

每個子句裡的每個 **literal**（變數或它的 ¬）變成一個頂點，各子句的頂點**分開放**，不混在一起。同樣是 x1，在 C1 和 C3 是**兩個不同的頂點**。

頂點寫成 **⟨a, i⟩**：a 是 literal，i 是它所在子句的編號。例如 C2 裡的 ¬x1 是 ⟨¬x1, 2⟩。

```
C1:  ⟨x1,1⟩   ⟨x2,1⟩
C2:  ⟨¬x1,2⟩  ⟨¬x2,2⟩
C3:  ⟨x1,3⟩   ⟨x3,3⟩
```

### 連邊的兩個規則

- **規則一**：同一個子句的頂點**不能**連。C1 的 x1 和 x2 不連；C2 的 ¬x1、¬x2 不連。不同子句的頂點才可以連。
- **規則二**：**不能連到自己的 negation**。x1 和 ¬x1 不可能同時為真，所以 C1 的 x1 和 C2 的 ¬x1 雖然在不同子句，也不連。

> **重點** 正式寫法：⟨a, i⟩ 和 ⟨b, j⟩ 之間有邊 ⇔ **i ≠ j**（不同子句）且 **b ≠ ā**（b 不是 a 的相反）。

逐對檢查：

| 子句對 | 頂點對 | 連？ | 理由 |
|---|---|---|---|
| C1–C2 | x1 – ¬x1 | 否 | negation |
| C1–C2 | x1 – ¬x2 | 是 | 不同子句、不矛盾 |
| C1–C2 | x2 – ¬x1 | 是 | |
| C1–C2 | x2 – ¬x2 | 否 | negation |
| C1–C3 | x1 – x1 | 是 | 同一個 literal，不矛盾 |
| C1–C3 | x1 – x3 | 是 | |
| C1–C3 | x2 – x1 | 是 | |
| C1–C3 | x2 – x3 | 是 | |
| C2–C3 | ¬x1 – x1 | 否 | negation |
| C2–C3 | ¬x1 – x3 | 是 | |
| C2–C3 | ¬x2 – x1 | 是 | |
| C2–C3 | ¬x2 – x3 | 是 | |

共 6 個頂點、9 條邊。整張圖的鄰接表：

```
⟨x1,1⟩  : ⟨¬x2,2⟩ ⟨x1,3⟩ ⟨x3,3⟩
⟨x2,1⟩  : ⟨¬x1,2⟩ ⟨x1,3⟩ ⟨x3,3⟩
⟨¬x1,2⟩ : ⟨x2,1⟩  ⟨x3,3⟩
⟨¬x2,2⟩ : ⟨x1,1⟩  ⟨x1,3⟩ ⟨x3,3⟩
⟨x1,3⟩  : ⟨x1,1⟩  ⟨x2,1⟩ ⟨¬x2,2⟩
⟨x3,3⟩  : ⟨x1,1⟩  ⟨x2,1⟩ ⟨¬x1,2⟩ ⟨¬x2,2⟩
```

這張圖加上 k = 3，就是 CDP 的一個 instance。頂點數 = 公式中 literal 的總數，邊最多是頂點數的平方量級，造圖只花 polynomial time。

## k-clique ⇔ 公式可滿足

### 圖上的 clique

- size 2：任兩個相連的頂點，例如 ⟨x1,1⟩–⟨x1,3⟩。
- size 3：⟨x2,1⟩、⟨¬x1,2⟩、⟨x3,3⟩ 兩兩相連，形成三角形。
- size 4：**沒有**。同一子句的頂點不相連，一個 clique 每個子句最多取一個頂點，只有 3 個子句。

所以 size k 的 clique 一定是「**每個子句剛好取一個頂點**」。這張圖的 size 3 clique 共有三個，挑任何一個都可以：

| clique（C1, C2, C3 各一） | 對應的賦值 |
|---|---|
| ⟨x2,1⟩, ⟨¬x1,2⟩, ⟨x3,3⟩ | x1 = 0, x2 = 1, x3 = 1 |
| ⟨x1,1⟩, ⟨¬x2,2⟩, ⟨x1,3⟩ | x1 = 1, x2 = 0, x3 任意 |
| ⟨x1,1⟩, ⟨¬x2,2⟩, ⟨x3,3⟩ | x1 = 1, x2 = 0, x3 = 1 |

### 例題：從 clique 得到滿足公式的值

> **例題** 取 clique {⟨x2,1⟩, ⟨¬x1,2⟩, ⟨x3,3⟩}，把選到的頂點都當成「真」，求出賦值並驗證 F。

1. x2 為真 → **x2 = 1**。
2. ¬x1 為真 → x1 為假，**x1 = 0**。
3. x3 為真 → **x3 = 1**。

代回公式：

```
C1 = x1 ∨ x2   = 0 ∨ 1 = 1
C2 = ¬x1 ∨ ¬x2 = 1 ∨ 0 = 1      （x1 = 0 所以 ¬x1 = 1；x2 = 1 所以 ¬x2 = 0）
C3 = x1 ∨ x3   = 0 ∨ 1 = 1
F  = 1 ∧ 1 ∧ 1 = 1
```

公式成立。換別的 clique 照同樣的方法做，公式也一樣成立。

### 一般證明：兩個方向

**clique ⇒ 可滿足**：設圖有 size k 的 clique。

- 規則一 ⇒ 它在每個子句剛好取一個頂點。
- 規則二 ⇒ 裡面沒有互為相反的兩個 literal，所以「把這 k 個 literal 都設成真」不會自相矛盾；沒出現的變數隨便給。
- 每個子句都有一個 literal 為真 ⇒ 每個子句為真 ⇒ F 為真。

**可滿足 ⇒ clique**：設 F 有一組滿足的賦值。

- 每個子句挑一個為真的 literal，共 k 個頂點。
- 它們分屬不同子句（規則一滿足），而且同時為真、不會互相矛盾（規則二滿足），所以兩兩有邊，形成 size k 的 clique。

例如賦值 x1 = 1, x2 = 0, x3 = 0：C1 挑 x1、C2 挑 ¬x2、C3 挑 x1，得到 {⟨x1,1⟩, ⟨¬x2,2⟩, ⟨x1,3⟩}，查上面的表確實兩兩相連。

### 結論

CDP 能在 polynomial time 解，SAT 就能跟著解（先 polynomial time 造圖，再問 CDP）。SAT 是 NP-hard，所以 **CDP 是 NP-hard**。同樣的歸約也常用 3-CNF-SAT（每個子句恰好 3 個 literal）來做，建構方式一樣。

> **陷阱** 這個 reduction 只證到 **NP-hard**，不是 NP-complete。要證 NP-complete 還要證 CDP ∈ NP，也就是寫出 CDP 的 non-deterministic polynomial 演算法：猜 k 個頂點，檢查它們兩兩之間都有邊（k(k−1)/2 對），polynomial time。CDP 其實已知是 NP-complete。

## 用 reduction 證明困難：3-Partition → Tetris

reduction 也能證明一個遊戲很難，例如證明 **Tetris（俄羅斯方塊）** 是 NP-hard：有研究團隊證明了，一個叫 **3-Partition** 的問題可以歸約到 Tetris。

**3-Partition**：給 n 個數，能不能把它們三個三個分成 n/3 組，而且每組的和都相等？

> **例題**（示意）9 個數 1, 3, 8, 2, 4, 6, 5, 5, 2，總和 36，要分成 9/3 = 3 組，每組和 36/3 = 12：
> (1, 3, 8)、(2, 4, 6)、(5, 5, 2)，每組都是 12，答案 yes。

聽起來簡單，但 3-Partition 是 NP-complete（Garey 與 Johnson 在 1975 年證明）。

站在巨人的肩膀上：不必再證 3-Partition 難，只要證 Tetris **至少跟它一樣難**。

- **定義**：A 能歸約到 B，就說 B 至少跟 A 一樣難。
- **理由**：解 B 就能解 A，先把 A 的題目轉成 B 的題目，再用 B 的方法解。B 有好方法，A 就有好方法。
- 大家相信 3-Partition 不在 P，那 Tetris 最好也不在 P；不然把 3-Partition 轉成 Tetris 一解，3-Partition 就在 P 了。

其實所有 NP-complete 問題都能互相歸約。

> **陷阱** 要證你的問題是 NP-complete（或 NP-hard），是找一個已知 NPC 的問題**歸約到你的問題**（已知難的 → 你的問題），方向不要弄反。

> **觀念** reduction 兩用：正面可以設計新演算法（把新問題轉成已會解的問題）；反面可以證明「這個問題比那個難」：你相信 A 難，就該相信 B 也難。

## 四個類別總整理：P、NP、NP-complete、NP-hard

大部分理論學者相信 P ≠ NP，所以下面的圖照 P ≠ NP 的情況畫：

```
+------------------- NP --------------------+
|                                           |
|   +-------+            +------------------+----------------+
|   |   P   |            |   NP-complete    |  NP-hard but   |
|   +-------+            |  (NP ∩ NP-hard)  |  not in NP     |
|                        +------------------+----------------+
|                                           |
+-------------------------------------------+
      NP-hard = 右邊整個框（NP-complete ＋ 不在 NP 裡的部分）
```

| 類別 | 意思 |
|---|---|
| P | 有 polynomial time 的 decider，能快速回答 YES／NO |
| NP | 不一定有快的 decider，但都能在 polynomial time 驗證一個解 |
| NP-complete | NP 裡最難的一類：屬於 NP，而且是 NP-hard |
| NP-hard | 所有 NP 問題都能 polynomial time reduce 到它；範圍最廣，包含 NPC，也包含很多不在 NP 裡的問題（例如停機問題） |

> **陷阱** 兩個常見的錯誤說法：
> - 「NPC 問題**確定沒有** polynomial decider」：錯，這只是大家的猜測，還沒被證明（等價於 P ≠ NP 尚未證明）。
> - 「NP-hard 是**所有沒有** polynomial decider 的問題」：錯，NP-hard 的定義是所有 NP 問題都能 polynomial time reduce 到它，和「有沒有快的演算法」無關。

> **陷阱** NP 是 **Nondeterministic Polynomial time** 的縮寫，不是 「Not Polynomial」。

問：P ⊆ NP、P = NP、P ≠ NP、「NPC 都沒有 poly 演算法」，哪一個已經被證明？
答：只有 **P ⊆ NP**：能在 polynomial time 解，當然能在 polynomial time 驗證。其餘三個都是未解問題。

問：NP-hard 問題一定在 NP 裡嗎？
答：不一定，例如停機問題（halting problem）是 NP-hard 但連可判定都不是。NP-hard 又在 NP 裡的，才叫 NP-complete。

問：若任一個 NP-complete 問題有 polynomial time 演算法，會推出什麼？
答：**P = NP**。因為每個 NP 問題都能 polynomial reduce 到這個 NPC 問題，再用它的 polynomial 演算法解。

## 重點整理

- 目前沒人找到 TSP、SAT、Knapsack 等問題的 polynomial time 最佳解演算法，也沒人證明它不存在；P vs NP 是 7 個千禧年大獎難題之一（100 萬美元）。
- 多項式 O(n^c)：輸入加倍，時間只乘常數 2^c（n³ 是 × 8）；指數 2ⁿ：輸入加倍，時間平方（2^(2n) = (2ⁿ)²）。
- EXP = 2^(n^c) 時間可解（2^(n²)、2^(n³) 也算）；R = decidable = 有限時間可解；P ⊆ EXP ⊆ R。
- 負權環偵測 ∈ P（Bellman-Ford O(VE)，加一個 0 權重邊連到所有點的源點）；n×n chess、圍棋 ∈ EXP 且已證明 ∉ P；Tetris ∈ NP。
- Halting problem ∉ R（undecidable）：特例可判斷，但沒有對所有程式都正確的演算法。
- 程式 = 有限 bit 串 = 自然數（countable）；決策問題 = 無限 bit 串 = [0,1) 的實數（uncountable）→ 絕大多數決策問題不可計算。
- 複雜度理論只研究 decision problem；decision 版不比 optimization 版難，optimization 至少跟 decision 一樣難。
- Decision 版一定要給 bound（MST 的 k、TSP 的 B）；證 NPC 第一步先把 optimization 改寫成 decision。
- 用 binary search 問 O(log 上界) 次 decision，就能求出最佳值 → 兩版本可互相轉換。
- TSP 的 Held–Karp DP 是 O(n²·2ⁿ)，比暴力 O(n!) 好，但仍是指數。
- P：deterministic TM 上 n^O(1) 時間可 solve；polynomial 是對輸入大小，pseudo-polynomial（knapsack O(nW)）不算。
- NP = Nondeterministic Polynomial（不是 Not Polynomial）；NP 問題不代表不在 P。
- NP 的三種等價看法：NTM（會分身）poly time 決定／lucky 演算法每次都猜對／YES 時存在多項式長的 certificate，可被 poly time verifier 檢查。
- Non-deterministic 敘述 choice()、success()、failure() 假設 O(1)；NSearch 是 O(1)。
- NP 只對 YES 方向幸運：「能不能活下來」∈ NP，「會不會死」應該不在 NP；YES/NO 方向要設對。
- Verifier 吃（instance, certificate），verifier ∈ P，certificate 長度須是輸入大小的多項式；找證明多久都可以。
- 證 TSP ∈ NP：檢查起訖同城、每城恰一次、總長 ≤ B，linear time；不用檢查是否最短。證 NPC 第一步就是證屬於 NP。
- P ⊆ NP 已證明；未知的是 P = NP 還是 P ⊊ NP。PRIMES 在 2002 年由 AKS 證明 ∈ P。
- P ⊆ NP；P = NP？是開放問題（千禧年大獎），大多數人相信 P ≠ NP，即 NP − P 不是空的。
- P ≠ NP 的直覺：you can't engineer luck；產生證明可能比檢查證明難（靈感 = 運氣 = 猜）。
- 常識論證：RSA 公開 N = p × q；factoring 的 verifier 檢查 N mod p = 0（長除法，多項式時間）；若能多項式時間解 NP 問題就能破解 RSA。這是常識論證，不是證明；量子電腦不在此假設內。
- Factoring ∈ NP，但一般認為不是 NP-complete。
- Reduction 原本是設計技巧：把 A 轉成會解的 B（無權重 → 權重全設 1 用 Dijkstra；乘積 → 取 log；最長 → 取負號，需無負權環；bipartite matching → network flow，capacity 全 1、linear time 轉換）。
- 權重全設 0 不行；設任何相同正數都可以。
- X ≤p Y：X 的任一 instance x 能在 poly time 轉成 f(x)，且 x 是 yes ⇔ f(x) 是 yes；Y 至少和 X 一樣難。
- 證 X ≤p Y 三件事：① 轉換 poly time ② X yes ⇒ Y yes ③ Y yes ⇒ X yes；Y 的演算法當 black box。
- Reduction 必須 poly time 且產生 poly 大小的輸入（3CNF → 3ⁿ 頂點的圖不算）。
- 三種用法：Case 1 新問題放 X、已知可解放 Y（解題）；Case 2 已知難題放 X、新問題放 Y（證難）；Case 3 雙向 ≤p（polynomially equivalent）。
- 最常見錯誤：證難時把新問題放在 X，得不到任何資訊（排序也能 reduce 到 CIRCUIT-SAT）。
- 反證：A 難、A ≤p B，若 B 有 poly 解則 A 也有 → 矛盾；嚴格說是推出 P = NP。
- SAT（CNF）是 base problem；n 個變數 2ⁿ 種賦值；SAT 與 0/1 knapsack 共用同一棵 state space tree。
- SAT ∝ L ⇒ L 是 NP-hard；reduction 有遞移性（SAT ∝ L1 ∝ L2 ⇒ L2 NP-hard）。
- NP-complete = NP ∩ NP-hard；L 是 NPC ⇔ ① L ∈ NP ② ∀ L′ ∈ NP，L′ ≤p L（只滿足 ② 叫 NP-hard）。
- 新問題證 NPC：① 從已知 NPC/SAT reduce 過來 ② 證明它在 NP（poly time verifier）。
- NP-hard 是「≥」NP 裡每個問題，不一定在 NP；Tetris 是 NPC，若 P ≠ NP 則 Tetris ∉ P。
- EXP-hard = EXP 刻度往右的全部；EXP-complete = EXP 裡最難；chess 是 EXP-complete。
- P ≠ EXP 已證明 ⇒ chess ∉ P（目前唯一的證法）；NP = EXP？未知。
- 指數要問「對什麼取指數」；聰明演算法只把 2^(cn) 的 c 變小，擺脫不了指數；只有 P 才 scale。
- NP-hard 範圍很廣：含沒有 poly verifier 的問題，甚至不可判定的停機問題；「NP-hard ∉ P」要先假設 P ≠ NP。
- NP-complete = NP ∩ NP-hard；任一 NPC 有 poly 解 ⇒ 全部 NP 問題 poly 可解 ⇒ P = NP。
- P = NP？只有兩種情況：某 NPC 找到 poly 解（P = NP），或證明 NPC 不可能 poly（P ≠ NP）；多數人相信 P ≠ NP。
- P：poly time solve；NP：poly time verify（non-deterministic polynomial，不是 non-polynomial）。
- Tractable = polynomial time solvable；intractable 相反。
- Cook–Levin 定理：SAT 是 NP-complete（從 first principles 證）；推論 SAT ∈ P ⇔ P = NP。
- Cook 1971 第一個 NPC（SAT）；Karp 1972 列出 21 個（含 SAT，不是 22 個）；Garey & Johnson（1979）是 NPC 字典。
- 問題是 NPC ⇒ 改找 heuristic 或 approximation algorithm。
- 證了 SAT ≤p L 只得 L 是 NP-hard；再證 L ∈ NP 才是 NPC；reduction 有遞移性，可從籃子裡任一 NPC 歸約。
- CIRCUIT-SAT：AND/OR/NOT 組合電路，能否設 input 讓 output = 1；CLRS 先證它 NPC 再歸約到 SAT。
- CNF：子句間 AND、子句內 OR；每個子句至少一個文字為真。
- 2SAT ∈ P（O(n)）；3SAT 是 NPC；k > 3 的 SAT 都能 poly reduce 到 3SAT。
- SAT 暴力法 2ⁿ（n = 變數數）；約 20 個變數就跑不動；SAT solver 幾小時可處理 1000～10000 個變數。
- 任何 NP 問題 ≤p 3SAT：verifier → 電路（輸入寫死、proof bits 為變數）→ 布林式 → 3CNF → 3SAT 的賦值即 proof。
- Factoring ∈ NP，但一般認為不是 NP-complete（未知）。
- NPC 例：TSP、n 個字串的 LCS、踩地雷、數獨、SAT、3-coloring、Knapsack（3D 最短路徑 NP-hard；2D 是多項式）。
- Knapsack 是 NPC ⇒ 除非 P = NP，pseudo-polynomial 已是極限。
- P ⊆ NP ⊆ EXP ⊆ R。
- 解題時 NPC 是地雷：reduction 走到 NPC（如 poly time 解 knapsack）就回頭。
- 證 L 是 NPC 兩步：① L ∈ NP（poly time 驗證）；② 已知 NPC 的 L′ ≤p L（方向不能反）。只做 ② 只證到 NP-hard。
- L、L′ 都用 decision 版；optimization 版至少和 decision 版一樣難。
- Reduction 要 poly time，且 yes ⇔ yes（兩個方向都要證；回來的方向通常較難）。
- 實務 theorem：L ∈ NP ＋ 某已知 NPC 的 L′ ≤p L ⇒ L 是 NPC（不必對所有 NP 問題做 reduction）。
- Hamiltonian cycle：undirected graph 上一筆畫經過每點恰一次再回起點，只能用給定的邊；NP-complete。點數奇數或兩邊不等的二分圖沒有 HC。
- HC ≤p TSP：G 的 n 點 → n 個 city；G 有的邊 cost 1、沒有的邊 cost 2（complete graph）；bound B = n；轉換 O(V²)。
- HC yes ⇒ TSP yes：同一圈 n 條 cost 1 → 總長 n ≤ n。TSP yes ⇒ HC yes：n 條邊、每條 ≥ 1、總長 ≤ n ⇒ 每條都是 cost 1 ⇒ 全是 G 的邊。
- 另一種寫法：有邊 cost 0、沒邊 cost 1、bound 0。
- TSP is NP-complete：猜 tour poly time 檢查（∈ NP）＋ HC ≤p TSP。
- Complete graph：n 點有 n(n−1)/2 條邊；clique = 本身是 complete graph 的 subgraph。
- CDP：給 G 和 k，G 有沒有 size k 的 clique（decision）；問最大 clique 多大是 optimization。
- 證 L2 NP-hard：選已知 NP-hard 的 L1，證 L1 ∝ L2（poly time 轉換，L2 可解 ⇒ L1 可解）。
- SAT ∝ CDP：每個子句的每個 literal 一個頂點 ⟨a, i⟩；⟨a, i⟩–⟨b, j⟩ 有邊 ⇔ i ≠ j 且 b ≠ ā；k = 子句數。
- 公式可滿足 ⇔ 圖有 size k 的 clique；clique 每個子句剛好取一個頂點，把選到的 literal 設為真即得賦值。
- SAT ∝ CDP 只證到 CDP 是 NP-hard；加上 CDP ∈ NP（猜 k 點、檢查 k(k−1)/2 對）才是 NPC。
- 3-Partition：n 個數分 n/3 組、每組三個、和相等；NP-complete（Garey & Johnson 1975）；3-Partition ≤p Tetris ⇒ Tetris NP-hard。
- A ≤p B ⇒ B 至少和 A 一樣難；所有 NPC 問題都能互相歸約。
- 四類（設 P ≠ NP）：P ⊆ NP；NPC = NP ∩ NP-hard；NP-hard 最廣，含不在 NP 的問題（如停機問題）。
- 已證明的只有 P ⊆ NP；「NPC 沒有 poly 演算法」只是猜測；任一 NPC ∈ P ⇒ P = NP。
- NP = Nondeterministic Polynomial time，不是 Not Polynomial。

## 名詞對照

| 中文 | English |
|---|---|
| 多項式時間 | polynomial time |
| 指數時間 | exponential time |
| 多項式時間歸約 | polynomial time reduction |
| NP 完全性 | NP-completeness |
| 千禧年大獎難題 | Millennium Prize Problems |
| 計算複雜度 | computational complexity |
| 複雜度類別 | complexity class |
| 可判定 | decidable |
| 不可判定 | undecidable |
| 停機問題 | Halting problem |
| 負權環 | negative-weight cycle |
| 決策問題、判定問題 | decision problem |
| 最佳化問題 | optimization problem |
| 目標函數 | objective function |
| 限制條件 | constraint |
| 可數／不可數 | countable / uncountable |
| 二進位字串 | binary string |
| 旅行推銷員問題 | traveling salesman problem (TSP) |
| 最小生成樹 | minimum spanning tree (MST) |
| 偽多項式 | pseudo-polynomial |
| 確定型圖靈機 | deterministic Turing machine |
| 非確定型圖靈機 | nondeterministic Turing machine (NTM) |
| 非確定性多項式時間 | nondeterministic polynomial time (NP) |
| 非確定性演算法 | non-deterministic algorithm |
| 非確定性模型 | nondeterministic model |
| 驗證程式 | verifier |
| 驗證演算法 | verification algorithm |
| 憑證 | certificate |
| 證明 | proof |
| 質數判定 | primality testing (PRIMES) |
| 未解問題 | open problem |
| 千禧年大獎難題 | Millennium Prize Problem |
| 私鑰 | private key |
| 因數分解 | factoring |
| 歸約 | reduction |
| 圖的歸約 | graph reduction |
| 二分圖匹配 | bipartite matching |
| 網路流 | network flow |
| 實例 | instance |
| 黑盒子 | black box |
| 若且唯若 | if and only if |
| 一對一對應 | one-to-one correspondence |
| 難解性 | intractability |
| 多項式等價 | polynomially equivalent |
| 電路可滿足性 | circuit satisfiability (CIRCUIT-SAT) |
| 基準問題 | base problem |
| 可滿足性問題 | satisfiability (SAT) |
| 子句 | clause |
| 合取範式 | conjunctive normal form (CNF) |
| 狀態空間樹 | state space tree |
| 0/1 背包問題 | 0/1 knapsack |
| 著色問題 | graph coloring |
| 子集合加總 | sum of subsets |
| 漢米爾頓迴路 | Hamiltonian cycle |
| 遞移性 | transitivity |
| NP 難 | NP-hard |
| NP 完備 | NP-complete |
| EXP-完全 | EXP-complete |
| EXP-難 | EXP-hard |
| 組合電路 | combinational circuit |
| 文字 | literal |
| 可處理的 | tractable |
| 難處理的 | intractable |
| 經驗法則 | heuristic |
| 近似演算法 | approximation algorithm |
| 三著色 | 3-coloring |
| 最長共同子序列 | longest common subsequence (LCS) |
| 背包問題 | knapsack problem |
| 踩地雷 | Minesweeper |
| 數獨 | Sudoku |
| 晶片佈局 | VLSI layout |
| 驗證 | verification |
| 第一原理 | first principles |
| 哈密頓迴路 | Hamiltonian cycle／Hamiltonian circuit |
| 二分圖 | bipartite graph |
| 完全圖 | complete graph |
| 子圖 | subgraph |
| 團 | clique |
| 團決策問題 | clique decision problem (CDP) |
| 否定 | negation |
| 轉換函數 | transformation / reduction function |
| 三分割問題 | 3-Partition |
| 俄羅斯方塊 | Tetris |
| 判定器 | decider |
