# 圖論（進階）

這一章把圖論從「定義」推到「定理與演算法」：一筆畫（Euler circuit／trail）的充要條件與找法、Hamilton 問題、平面圖與 Euler 公式 v − e + r = 2、Kuratowski 定理、圖著色與四色定理；樹的性質與等價定義、rooted tree、m-ary tree、走訪與 Polish notation、生成樹（DFS／BFS）與 Cayley 公式、merge sort；最後是四個最佳化問題：最短路徑（Dijkstra）、最小生成樹（Prim、Kruskal）、二分圖配對（Hungarian algorithm、Hall 定理）、最大流（max-flow min-cut）。考試最常考：用奇數度點判斷 Euler、平面圖不等式證明 K₅／K₃,₃ 不是平面圖、χ(G) 與 chromatic polynomial、樹的 |V| = |E| + 1 與 complete m-ary tree 公式、三種走訪、Dijkstra／Prim／Kruskal 手跑。

## 學完這章要會
- 無向圖的連通、component；有向圖的強連通與弱連通。
- Euler circuit ⇔ connected 且全部偶度；Euler trail ⇔ connected 且恰兩個奇度點；證明與「走到卡住、break out」演算法。
- 分清 Euler（每條邊一次）與 Hamilton（每個點一次）。
- 平面圖、embedding、region；Euler 公式與歸納證明；girth、region degree、e ≤ g(v − 2)/(g − 2)；K₅、K₃,₃ 非平面；subdivision、homeomorphic、Kuratowski 定理。
- χ(G)：Kₙ、Cₙ、二分圖；chromatic polynomial 的乘法與陷阱；四色定理的來龍去脈。
- 樹的定義、三個性質與證明、四個等價敘述；forest 的 |V| = |E| + r。
- rooted tree 名詞、level、height；m-ary、complete、balanced；n = mi + 1、l ≤ mʰ、h ≥ ⌈log_m l⌉。
- preorder、inorder、postorder；expression tree 與 Polish notation 的計算。
- spanning tree：拿掉 circuit 的邊、DFS、BFS（queue）、有向圖的 spanning forest；Cayley 公式 nⁿ⁻² 與 Prüfer code。
- merge sort 的 splitting／merging 與 worst case n log₂ n − n + 1。
- Dijkstra（label、predecessor、O(n²)）；principle of optimality。
- Prim 與 Kruskal 的步驟、證明（交換論證）與複雜度。
- matching、augmenting path、Hungarian algorithm 與正確性；Hall 定理；deficiency。
- network、flow 的兩個條件、cut、val(f) ≤ c(S, T)、f-augmenting path、max-flow min-cut、Edmonds–Karp。

## 連通性

- 兩點之間有 path 就說它們連在一起；任兩點之間都有 path 的圖叫 **connected graph**（連通圖）。擦掉邊可能讓圖不連通；連在一起的每一塊叫 **component**，不連通的圖有兩個以上的 component。
- 有向圖的 path 要順著箭頭走，所以連通要分兩種：
  - **strongly connected**（強連通）：任兩點 a、b，a → b 和 b → a 都走得通。若某點 B 只進不出，就不是強連通。
  - **weakly connected**（弱連通）：把方向拿掉、當成無向圖後是連通的。
- 兩圖同構時，對應點之間的連通性、路徑是否存在等性質都相同。

## Euler circuit 與 Euler trail（一筆畫）

### Königsberg 七橋問題

Königsberg（今俄羅斯 Kaliningrad）有一條河、七座橋，河把陸地分成四塊：中間的島 A，以及 B、C、D。能不能從某處出發，每座橋恰好走一次，最後回到出發點？

試了幾次都試不出來——但「試不出來」不是證明，用電腦窮舉也不是好的證明；要說出一定失敗的理由。

**看島 A**：每到 A 一次就是「進來 + 出去」，用掉 2 座橋；到 A k 次用掉 2k 座。每座橋都要走而且不重複，所以連到 A 的橋數必須是偶數；但 A 連了 5 座 ⇒ 不可能。從 A 出發也一樣：出去、回來成對，最後回到 A，仍是偶數。

**翻譯成圖**：每塊陸地是一個 vertex，每座橋是一條 edge：

```
C–A 兩座、A–B 兩座、A–D 一座、C–D 一座、B–D 一座
degree：A = 5、B = 3、C = 3、D = 3
```

得到 4 點、7 邊的 multigraph，四個點的 degree 全是奇數，所以既沒有 Euler circuit，也沒有 Euler trail。Euler 在 1736 年的論文解決了七橋問題與一般情況（充分條件的完整證明是後人補的），這被視為圖論的第一個定理，vertex、edge 的概念也是為此而生。

### 定義

在無向圖（simple 或 multigraph）上：
- **Euler circuit**：經過每條邊恰好一次的 circuit（起點 = 終點）。
- **Euler trail**：經過每條邊恰好一次的 open trail（起點 ≠ 終點）。

（有些書叫 Euler cycle／Euler path。trail 是邊不重複的 open walk，circuit 是邊不重複的 closed walk。）

> **比喻** trail 像「A 地集合、B 地解散」；circuit 是「同一個地點集合、解散」。一筆畫就是筆不離紙、每條「邊」恰好畫一次。

### 定理與證明

**定理**：無向圖 G（沒有 isolated vertex）有 Euler circuit ⇔ G connected 且每個 vertex 的 degree 都是偶數。

> **陷阱** 前提是沒有 isolated vertex（沒有邊的點不必走到）；有的話先拿掉再判斷。

**必要條件（⇒）**：
- connected：Euler circuit 經過所有點；任取兩點，沿著 circuit 從一點走到另一點，剪掉重複點的部分就是 path。
- degree 偶數：每經過 v 一次用掉兩條邊，一條進來（arriving）、一條離開（departing），所以 deg(v) = 2 ×（離開 v 的次數），是偶數。

**充分條件（⇐）**：用 constructive proof——給一個演算法把 Euler circuit 找出來（它不一定唯一，只要證存在）。
1. 從任一點、任一條邊開始走；走過的邊不能再走，有多條可選就隨便挑；一直走到卡住（get stuck，到某點沒有邊可走）。
2. **卡住的點一定是出發點**：若卡在中間某點，進出這點用掉的邊數是奇數，但它的 degree 是偶數，一定還有邊可出去，矛盾。所以走過的路是一個 circuit（可以重複點，不重複邊）。
3. **break out**：若還有邊沒走，因為 G connected，circuit 上一定有某點還有沒用的邊。把同一個 circuit 改從那一點開始寫，回到它時沿沒用的邊走出去，照原法走到再卡住。例：circuit A B C D E A 卡住，C 還有邊到 X ⇒ 改寫成 C D E A B C，再從 C 走到 X……
4. 重複直到不能 break out。此時這個 circuit 就是 Euler circuit：任取一條邊 vw，因為 G connected，從起點 A 到 v 有 path A, A₁, A₂, …, v；A–A₁ 一定在 circuit 上（否則可在 A break out），A₁ 在 circuit 上，依此類推 v 在 circuit 上，所以 vw 也在 circuit 上。

> **陷阱** break out 不是丟掉剛走的路，而是把同一個 circuit 換個起點寫，再接著往外走。

> **例題** 4 點 multigraph，用對稱的 adjacency matrix 描述（順序 A B C D）：
> ```
>     A B C D
> A [ 0 2 1 1 ]
> B [ 2 0 0 2 ]
> C [ 1 0 0 3 ]
> D [ 1 2 3 0 ]
> ```
> degree：A 4、B 4、C 4、D 6，全偶、連通 ⇒ 有 Euler circuit。直接在矩陣上走，每用一條邊對應格子減 1，可選時照字母順序：
> 1. 從 A：A → B → A → C → D → A，A 的邊用完，卡住。
> 2. A 沒有沒用的邊，B 有 ⇒ 改寫成 B A C D A B，從 B 出去：B → D → B，又卡住，circuit 變成 B A C D A B D B。
> 3. C 還有沒用的邊（C–D 還剩 2 條）⇒ 改寫成 C D A B D B A C，從 C 出去：C → D → C。
> 4. 所有點的邊都用完，不能 break out ⇒ Euler circuit：**C D A B D B A C D C**（9 條邊）。

### Euler trail

起點第一次只出去、終點最後只進來，所以這兩點 degree 是奇數，其餘是偶數。

**定理**：G 有 Euler trail ⇔ G connected 且**恰好**兩個 vertex 的 degree 是奇數。trail 從一個奇點走到另一個奇點。

**充分條件的證明**：在兩個奇數點之間加一條想像的邊（imaginary edge），所有 degree 都變偶數；用前面的演算法找 Euler circuit，並把新邊當成第一條；最後刪掉這條邊，就得到從一個奇點到另一個奇點的 Euler trail。它是前一個定理的 corollary。

> **陷阱** 要「恰好」兩個奇數點；0 個奇點時有的是 Euler circuit。奇數點不是 0 個或 2 個，就絕對沒有（奇數點個數一定是偶數，所以其他可能是 4、6、…個）。

> **例題** 用連線數（degree）判斷：
> - 1、3、2、2、2：兩個奇數點 ⇒ 有 Euler trail，頭尾就是那兩個奇數點。
> - 中心 3、外面 1、1、1：四個奇數點 ⇒ 都沒有。
> - 2、2、3、1：兩個奇數點 ⇒ 有 Euler trail，從一個奇數點開始、另一個結束。
> - 七橋 3、5、3、3：四個奇數點 ⇒ 都沒有。

**手找的漸進法**：先從一個奇數點隨便走到另一個奇數點，把走過的邊擦掉；剩下的圖（residual graph）每點都是偶度，從走過的點出發繞圈回來，再把圈接進原來的路（兜一圈再接回）。找 Euler circuit 就從任一點先繞一圈回自己，再慢慢接。

## Hamilton path 與 Hamilton circuit

- **Hamilton path**：把每一個**頂點**恰好經過一次（像推銷員挨家挨戶拜訪）；頭尾相連叫 **Hamilton circuit**。
- 這比 Euler 問題難得多：沒有簡單的判斷條件，屬於 NP-complete 問題，目前沒有已知的有效率演算法。考的多是概念。

> **陷阱** Euler 是每條「邊」恰好一次，看 degree 就能判斷；Hamilton 是每個「頂點」恰好一次，沒有簡單判斷法。

## 平面圖

### 定義

G 能畫在平面上而且邊不交叉（邊只在端點相交），就叫 **planar graph**。某種畫法有交叉沒關係，只要**存在**一種不交叉的畫法就是 planar。這種不交叉的畫法叫 **planar embedding**。用途：network visualization、EDA（電路 layout 希望線不交叉）。planar 與邊有無方向無關，只討論無向圖。

> **陷阱** 「這樣畫有交叉」不代表 non-planar；「我畫不出來」也不是 non-planar 的證明。

### 完全圖與完全二分圖

- K₁、K₂、K₃ 都是 planar。K₄ 有 C(4, 2) = 6 條邊，常見畫法對角線交叉，但把一條對角線繞到外面就不交叉 ⇒ planar。
- K₅：5 點、10 邊、4-regular。畫外框、A–C、A–D 放裡面、C–E 和 E–B 繞外面，最後 B–D 怎麼放都交叉（還不是證明，後面證）。K₆ 以後邊更多，也都不是。
- **bipartite graph**：vertex set 分成兩個不相交的子集 V₁、V₂（bipartition），每條邊一端在 V₁、一端在 V₂。K_{m,n}：|V₁| = m、|V₂| = n，所有跨邊都連。
- K₁,₁、K₁,₂、K₂,₁ 是 planar；K₂,₂ 把一條邊繞到外面 ⇒ planar；K₂,₃ 兩條邊繞到外面 ⇒ planar（K₃,₂ 是翻過來，也是）。
- K₃,₃：6 點、9 邊。照 K₂,₃ 的方法畫好兩個點的邊，再畫第三個點的邊，最後一條怎麼放都交叉（後面證）。K₃,₄ 含 K₃,₃，也不是 planar。

### Euler 公式

planar embedding 把平面切成好幾個 **region**（區域，外面無限大的那塊也算）。

> **例題** K₄ 的 embedding：4 點、6 邊、4 個 region。另一個圖：7 點、11 邊、6 個 region。兩者都是 v − e + r = 2：4 − 6 + 4 = 2、7 − 11 + 6 = 2。

> **陷阱** 外面那塊無限大的區域也是一個 region，別漏數。

**Euler's Theorem for Planar Graphs**：G 是 connected planar graph（不連通就每個 component 分開看），則

```
v − e + r = 2
```

**證明**：對邊數 e 做數學歸納法（允許 multigraph）。
1. **基底** e = 0、1：單一點 1 − 0 + 1 = 2；一點一個 loop 1 − 1 + 2 = 2；兩點一邊 2 − 1 + 1 = 2。
2. **假設**：邊數 0～k 的 connected planar graph 都成立。
3. **步驟**：G 有 k + 1 條邊，任取一條邊 ab 拿掉得 H（k 條邊）。
   - **Case 1：H 仍 connected**（拿掉的是 loop，或是兩側是不同 region 的邊——不論影響的是內部或外部 region）：點數不變、邊數少 1、region 少 1（兩塊併成一塊）。由假設 v − k + (r − 1) = 2 ⇒ v − (k + 1) + r = 2。
   - **Case 2：H 斷成兩個 component** H₁、H₂，各自 connected planar、邊數 ≤ k：v₁ + v₂ = v，e₁ + e₂ = k，外面那塊被兩邊各算一次，r₁ + r₂ = r + 1。兩式相加 (v₁ − e₁ + r₁) + (v₂ − e₂ + r₂) = 4 ⇒ v − k + (r + 1) = 4 ⇒ v − (k + 1) + r = 2。
4. 兩種情況都成立，證完。

> **陷阱** 分開數兩個 component 時，外面那個無限 region 被數了兩次，所以 r₁ + r₂ = r + 1。

要有 embedding 才能數 r；但判斷「是不是 planar」時手上沒有 embedding。所以接下來用不等式把 r 消掉，得到 planar 的必要條件。

### girth 與 region 的 degree

- **girth**：最短 cycle 的長度。例：最短 cycle 長 4 ⇒ girth 4。沒有 cycle 的圖，標準定義 girth = ∞（考試照這個答）；有一種講法為了讓下面的不等式也能套，改約定成「全部邊數」，那只是方便用的約定。
- K₅：最短 cycle 是三角形（simple graph 沒有長度 2 的 cycle）⇒ girth 3。K₃,₃：二分圖的 cycle 長度必為偶數，又沒有長度 2 ⇒ girth 4。
- **region 的 degree** deg(R)：繞 R 的邊界走一圈的最短 closed walk 的邊數。伸進 region 的「懸空」邊會被走兩次，要算兩次。

> **例題** 兩個各 9 條邊、4 個 region 的 embedding：
> - 一個的 region degree 是 5、3、3、7（外圍有一條伸出去的邊算兩次）：5 + 3 + 3 + 7 = 18 = 2 × 9。
> - 另一個是 4、3、5、6：4 + 3 + 5 + 6 = 18 = 2 × 9。

和 Σdeg(v) = 2e 一樣：**Σ deg(R) = 2e**，因為每條邊有兩側，各對一個 region 貢獻 1。

### Edge–Vertex Inequality

**定理**：connected planar simple graph，girth g ≥ 3，則

```
e ≤ g(v − 2)/(g − 2)
```

**推導**（Euler 公式的 corollary）：每個 region 的 degree ≥ g ⇒ 2e = Σdeg(R) ≥ g·r。代入 r = 2 − v + e：2e ≥ g(2 − v + e) ⇒ (g − 2)e ≤ g(v − 2) ⇒ e ≤ g(v − 2)/(g − 2)。

（g = 3 時就是常見的 e ≤ 3v − 6；g = 4 時 e ≤ 2v − 4。）

> **例題** K₅ 不是 planar：v = 5、e = 10、g = 3，上界 3(5 − 2)/(3 − 2) = 9 < 10 ⇒ non-planar。

> **例題** K₃,₃ 不是 planar：v = 6、e = 9、g = 4，上界 4(6 − 2)/(4 − 2) = 8 < 9 ⇒ non-planar。

> **陷阱** 這只是必要條件：不滿足一定 non-planar，滿足不代表一定是 planar。

### Kuratowski 定理

- **elementary subdivision**：G 是無向 simple graph、E ≠ ∅，把邊 vw 換成 vz、zw（z 是新點），也就是在邊上多加一個點。subdivision 不改變 planar／non-planar。
- **homeomorphic**：G₁、G₂ 同構，或都能從同一個圖經過一連串 elementary subdivision 得到。例：G₂、G₃、G₄ 分別由 G₁ 做 1、2、3 次 subdivision 得到 ⇒ 兩兩 homeomorphic。homeomorphic 的圖同為 planar 或同為 non-planar。
- **subgraph**：V₁ ⊆ V、E₁ ⊆ E 且 G₁ 本身是圖。有一個 non-planar 的 subgraph ⇒ 整個圖 non-planar。

**Kuratowski's Theorem**（1930）：G non-planar ⇔ G 有一個 subgraph homeomorphic to K₅ 或 K₃,₃。充分方向容易；必要方向的證明很長，這裡不證。結果漂亮，但實際上那個 subgraph 不一定好找。

> **例題** Petersen graph（10 點、15 邊、3-regular）不是 planar。
> 標法：外圈 a b c d e；輻條 a–f、b–g、c–h、d–i、e–j；內星 f–h、h–j、j–g、g–i、i–f。
> - 用 Kuratowski：拿掉 a–b、d–i 兩條邊，剩下的是 K₃,₃（{c, f, j} 對 {e, g, h}）的 subdivision，多出來的點是 a、b、d、i ⇒ non-planar。
> - 用不等式：最短 cycle 長 5，g = 5，上界 5(10 − 2)/(5 − 2) = 40/3 ≈ 13.3 < 15 ⇒ non-planar。

## 圖著色

### 地圖著色與對偶圖

一塊大陸分成幾個國家，相鄰國家的旗子（地圖顏色）不能同色，最少要幾種顏色？把每個區域變成一個頂點、兩區相鄰就連一條邊，得到 **dual graph**（對偶圖），地圖著色就變成**頂點著色**（graph coloring）：相鄰頂點不同色，最少要幾色。

> **例題** 國家 A～E，相鄰關係 A–B、A–C、B–C、B–E、C–D、C–E、D–E。
> - 依序塗（greedy）：A 黃；B 綠；C 藍；D 不鄰 A，可以黃；E 鄰 B、C、D（綠、藍、黃）⇒ 被迫用第 4 色。
> - 但 B、D 不相鄰、可以同色：C 黃、E 綠、B 藍、D 藍、A 綠 ⇒ **3 色就夠**。A、B、C 兩兩相鄰是三角形，至少 3 色，所以最少是 3。

> **陷阱** 一個一個照順序塗（greedy）不保證用最少的顏色。

### chromatic number χ(G)

塗好一個圖所需的最少色數。
- 能用 2 色塗好的圖可以重畫成二分圖：任何有邊的 bipartite graph，χ(G) = 2。三角形要 3 色，所以不是二分圖。
- **完全圖**：每點都和其他所有點相鄰，χ(Kₙ) = n（K₂ 要 2 色、K₃ 要 3 色、K₄ 要 4 色）。
- **cycle**：C₃ = K₃，χ = 3；C₄：A、C 一色，B、D 一色，χ = 2；C₅：交錯兩色到最後一點同時碰到兩種顏色，要第 3 色，χ = 3；C₆：A、C、E 一色，B、D、F 一色，χ = 2（就是二分圖）。一般：n 偶數 χ(Cₙ) = 2，n 奇數 χ(Cₙ) = 3。

### chromatic polynomial P(G, λ)

不問最少幾色，改問：給 λ 種顏色，有幾種合法塗法？依序替頂點選色，用乘法原理。代入 λ = k 就是 k 色的塗法數；P(G, k) > 0 的最小 k 就是 χ(G)。

> **例題** K₄（四點兩兩相鄰）：第一點 λ 種；第二點鄰第一點，λ − 1；第三點鄰前兩點，λ − 2；第四點鄰前三點，λ − 3。
> P(G, λ) = λ(λ − 1)(λ − 2)(λ − 3)；6 色時 6·5·4·3 = **360** 種。

> **例題** 上面地圖的對偶圖。順序 C、E、B、D、A，讓每個新點「已塗的鄰居彼此相鄰」：
> - C：λ
> - E（鄰 C）：λ − 1
> - B（鄰 C、E，兩者相鄰、必不同色）：λ − 2
> - D（鄰 C、E）：λ − 2
> - A（鄰 B、C）：λ − 2
>
> P(G, λ) = λ(λ − 1)(λ − 2)³。5 色：5·4·27 = **540** 種；3 色：3·2·1 = 6 > 0，2 色：0 ⇒ χ(G) = 3。

> **陷阱** 乘法只在「每個新頂點的已塗鄰居兩兩相鄰（一定不同色）」時成立。若照 A、B、C、D、E 的順序，E 的已塗鄰居 B、D 不相鄰、可能同色，寫成 λ − 3 就錯了（會得到錯的 λ(λ − 1)(λ − 2)(λ − 1)(λ − 3)）。同理 K₄ 少一條邊（A、C 不相鄰）時，答案是 λ(λ − 1)(λ − 2)²，λ = 6 時 480，不是 360。

### 四色定理

**四色定理**：每張地圖都能只用四種顏色著色，使有共同邊界的國家顏色不同；也就是沒有地圖需要五色。
- 由來：1852 年有人替英國各郡著色時發現四色就夠，問題經由 De Morgan 傳開，懸了一百多年。
- 「4」不能再少：中間一國、外圍三國且四國兩兩相鄰的地圖一定要 4 色。
- 地圖 → 網路：每國一點、有共同邊界就連線。長相不同的地圖可能給出同一個網路。每張地圖都能變成網路，但不是每個網路都來自地圖：五國兩兩相鄰（K₅）畫出來的線一定交叉。能畫成邊不交叉的就是平面圖，所以四色定理說的是：**平面圖的 χ ≤ 4**。
- 每張地圖都有一個國家的鄰國不超過 5 個：簡單連通平面圖（v ≥ 3）滿足 e ≤ 3v − 6，平均 degree = 2e/v < 6，所以一定有頂點 degree ≤ 5。
- **六色定理**（容易）：假設有需要 7 色的地圖，取最小的一張；它有一國 A 鄰國 ≤ 5 個。拿掉 A，地圖變小，可以 6 色著色；放回 A，鄰國最多占 5 色，第 6 色給 A，矛盾。
- **五色定理**：同樣的思路，但 A 有 5 個不同色的鄰國時，要先重新著色（Kempe chain）騰出一色。
- 同樣的論證直接用在 4 色不夠強：1879 年 Kempe 的證明被接受約十年後，1890 年 Heawood 指出錯誤。
- 1976 年 Appel 與 Haken：列出一組每張地圖必含其一的組態（unavoidable set），證明每個組態都能（重新）用 4 色著色（reducible）。組態將近兩千個，必須用電腦逐一檢查，是第一個重要的電腦輔助證明，當時很有爭議；後來清單縮到 633 個，但仍需要電腦。

## 樹

### 定義

**tree**：先是一個 undirected simple graph，而且
1. **connected**（只有一個 component）；
2. **沒有 cycle**。

不一定 connected、但每個 component 都是 tree 的圖叫 **forest**（森林）。

> **例題**（示意）三個 undirected simple graph：G₁ connected、沒有 cycle ⇒ tree；G₂ connected 但有 cycle ⇒ 不是 tree；G₃ 有兩個 component，不 connected ⇒ 不是 tree，但每個 component 都是 tree ⇒ forest。

### 三個性質

T 是 tree：
1. |V| ≥ 2 時，任兩個不同點之間有**唯一**的 path。
2. 拿掉任何一條邊，剩下的圖剛好兩個 component，而且每個都是 tree。
3. |V| = |E| + 1。

> **陷阱** 性質 1 的重點是「唯一」；只是「有 path」那是 connected。

**證明性質 1**：T connected，所以 a、b 之間至少一條 path。若有兩條不同的 path，其中某些邊會構成 cycle（兩條 path 可能有重疊的部分，cycle 由其中一部分邊構成），違反沒有 cycle ⇒ 唯一。

**證明性質 2**：
1. 拿掉邊 {a, b}（端點留著）得 T′ = (V, E − {{a, b}})。若 T′ 仍 connected，a、b 之間在 T′ 還有一條 path，加上 {a, b} 本身，T 中 a、b 之間就有兩條 path，違反性質 1 ⇒ T′ 不 connected。
2. 分組：每個點在 T 中到 a 的唯一 path，沒經過 {a, b} 的仍連到 a；經過 {a, b} 的只連到 b。每個點恰好落在一組 ⇒ 剛好兩個 component。
3. 拿掉邊不會製造新的 cycle，T 沒有 cycle，兩個 component 也沒有 ⇒ 都是 tree。

**性質 3**：先看小樹：1 點 0 邊、2 點 1 邊、3 點 2 邊、4 點 3 邊（4 點的樹不只一種形狀）。用 strong induction 對點數證明：
1. 基底：1 個點，|E| = 0。
2. 假設：點數 ≤ k 的 tree 都成立（k ≥ 1）。
3. 步驟：k + 1 個點的 T，拿掉一條邊，由性質 2 得兩棵 tree T₁、T₂。|V₁| + |V₂| = k + 1、|E₁| + |E₂| = |E| − 1，兩棵都至少 1 個點，所以點數都 ≤ k。
4. |V| = (|E₁| + 1) + (|E₂| + 1) = |E| − 1 + 2 = |E| + 1。

> **陷阱** 假設要寫「≤ k 都成立」（strong induction），因為 T₁、T₂ 的點數不一定剛好是 k。

### 四個等價敘述

對 undirected simple graph T，下面四個敘述等價：
- (a) T 是 tree。
- (b) T 沒有 cycle，且 |V| = |E| + 1。
- (c) T connected，且 |V| = |E| + 1。
- (d) T 沒有 cycle，而且加上任何一條原本沒有的邊 {a, b}，就剛好產生一個 cycle。

（connected、沒有 cycle、|V| = |E| + 1 三個條件，任兩個成立第三個就成立。）證法：(a) ⇒ (b) ⇒ (c) ⇒ (d) ⇒ (a)。

- **(a) ⇒ (b)**：依定義沒有 cycle；由性質 3，|V| = |E| + 1。
- **(b) ⇒ (c)**：設 T 有 r 個 component，每個 connected 又沒有 cycle，都是 tree，|Vᵢ| = |Eᵢ| + 1。加總 |V| = |E| + r；又 |V| = |E| + 1 ⇒ r = 1 ⇒ connected。
- **(c) ⇒ (d)**：
  - 先證沒有 cycle（反證）：若有 cycle C，C 上點數 = 邊數；其他點都要靠 path 連到 C，每多一個點至少多一條新邊 ⇒ |E| ≥ |V|，與 |V| = |E| + 1 矛盾。所以 T 是 tree。
  - 加上原本沒有的邊 {a, b}：T 中 a 到 b 有唯一 path P（長度 ≥ 2），P + {a, b} 是一個 cycle。若還有另一個 cycle C′，它一定含 {a, b}，拿掉 {a, b} 剩下另一條 a 到 b 的 path P′ ≠ P，矛盾 ⇒ 剛好一個。
- **(d) ⇒ (a)**：已沒有 cycle，只要證 connected。若不 connected，取兩個 component 各一點 a、b；依 (d)，加上 {a, b} 應剛好產生一個 cycle，但 a、b 在不同 component，加上去不會有 cycle，矛盾。

> **重點** 任何 forest：|V| = |E| + r，r 是 component（樹）的個數。

> **陷阱** (d) 的「加一條邊」是兩端點都已存在、但原本沒有這條邊；加上後是「剛好一個」cycle。

### rooted tree

- **directed tree**：directed graph 拿掉方向後是 tree。
- **rooted tree**：directed tree 中有一個特別的點叫 root，每條邊的方向都 away from the root。平常不畫箭頭，root 畫在最上面往下長（像抓著根把樹提起來）。

名詞（都沒有性別）：
- **parent／child**：B 是 C 的 parent，C 是 B 的 child。
- **sibling**：同一個 parent 的 children。
- **ancestor／descendant**：從 root 到該點路上的點是它的祖先；它下面的點是後代（都不含自己）。
- **leaf**：沒有 children 的點；其他叫 **internal vertex**（root 只要有 children 也算）。
- **subtree**：以某點為 root，它和它下面的部分。
- **level**：root 到該點唯一 path 的邊數，root 是 level 0。**height**：最大的 level。

> **例題** 一棵 rooted tree，root A；level 1：B、F、G；level 2：C、H、I、J；level 3：D、E、K、L、N。B 是 C 的 parent，C 的 children 是 D、E；G 的 children H、I、J 是 siblings；E 的祖先是 C、B、A，B 的後代是 C、D、E。leaves：D、E、F、I、K、L、N；internal：A、B、C、G、H、J。height = 3。

> **陷阱** height 數的是邊數，不是層數；只有 root 的 tree height 是 0。

### m-ary tree

- **m-ary tree**：每個 internal vertex 最多 m 個 children（m = 2 binary、3 ternary、4 quaternary）。
- **complete m-ary tree**：每個 internal vertex 剛好 m 個 children。

> **陷阱** 這裡的 complete 是「有 children 就剛好 m 個」，不是「每一層都排滿」（資料結構的 heap 用的是後者）。

**complete m-ary tree 的數量關係**：n 個點、l 個 leaf、i 個 internal，n = l + i。
1. **n = mi + 1**：除了 root，每個點都是唯一某個 internal vertex 的 child；i 個 internal 各剛好 m 個 children ⇒ mi = n − 1。
2. **l = (m − 1)i + 1**：把 l = n − i 代入 ①。
3. **i = (l − 1)/(m − 1) = (n − 1)/m**：由 ①② 解出。

只要懂 ① 就好，其他推得出來；三個式子只對 complete m-ary tree 成立。

> **例題**（示意）complete binary tree 有 i = 4 個 internal vertex：n = 2·4 + 1 = 9、l = 4 + 1 = 5。

**balanced**：高度 h 的 rooted tree，每個 leaf 的 level 都是 h 或 h − 1。例：5 個 leaf，3 個在 level 2、2 個在 level 3，h = 3 ⇒ balanced；一個 leaf 在 level 1、其他在 level 3 ⇒ 不 balanced。

### 葉子數與高度

**定理**：高度 h、l 個 leaf 的 m-ary tree，**l ≤ mʰ**。直觀：整棵長滿也只有 mʰ 個葉子。

證明（對 h 歸納）：h = 1 時葉子都是 root 的 children，最多 m 個。設 height < h 都成立；level 1 的點各為一個 subtree 的 root，最多 m 個 subtree，每個 height ≤ h − 1，葉子 ≤ m^(h−1)，全部 ≤ m·m^(h−1) = mʰ。

取 log（遞增）：log_m l ≤ h，h 是整數 ⇒ **h ≥ ⌈log_m l⌉**。
- ⌈x⌉（ceiling）：≥ x 的最小整數，⌈3.5⌉ = 4、⌈4⌉ = 4；⌊x⌋（floor）：≤ x 的最大整數，⌊3.5⌋ = 3、⌊4⌋ = 4。
- 這只是下界：不 balanced（一邊拉很長）時 h 可能大很多。

**complete 且 balanced ⇒ h = ⌈log_m l⌉**：height 是 h，至少一個葉子在 level h；complete 又 balanced，level h − 1 以上都長滿，所以 l > m^(h−1)；又 l ≤ mʰ。取 log：h − 1 < log_m l ≤ h ⇒ h = ⌈log_m l⌉。應用：decision tree 常是 binary tree，height = 最多要做幾次判斷。

## 樹的走訪

**tree traversal**：有系統地拜訪每個點一次（例如找最大、最小）。root r、subtrees T₁, …, Tₘ，三種方法差在什麼時候拜訪 root：
- **preorder**：r，再依序 preorder T₁, …, Tₘ。
- **postorder**：依序 postorder T₁, …, Tₘ，最後 r。
- **inorder**：binary tree 是左、r、右；一般 m-ary tree 約定 T₁、r、T₂, …, Tₘ（root 放第二個）。

> **例題** binary tree：
> ```
>                 r
>            /         \
>           a           b
>         /   \           \
>        c     d           e
>       / \               /  \
>      f   g             h    i
>     /   /               \    \
>    j   k                 m    n
>   / \                   /    / \
>  p   q                 s    t   u
> ```
> （b 只有右 child e；h 只有右 child m；i 只有右 child n。）
> - preorder：r a c f j p q g k d b e h m s i n t u
> - postorder：p q j f k g c d a s m h t u n i e b r
> - inorder：p j q f c k g a d r b h s m e i t n u

> **陷阱** inorder 不是「由左到右逐層」；h 沒有左 subtree，所以先拜訪 h 本身，再走它的右 subtree（s m）。

### expression tree 與 Polish notation

數學式子可以存成 binary tree：運算子放在 parent，兩個 children 是它的兩個運算元，變數都是葉子。

> **例題** t + (u * v) / (w + x − y ↑ z)（* 乘、/ 除、↑ 取指數），把 w + x − y↑z 讀成 w + (x − y↑z)：
> ```
>        +
>       / \
>      t   /
>         / \
>        *    +
>       / \  / \
>      u  v w   −
>              / \
>             x   ↑
>                / \
>               y   z
> ```
> 6 個運算子、7 個葉子，每個運算子剛好兩個 children。
> - preorder ⇒ **Polish notation**（紀念波蘭邏輯學家 Łukasiewicz）：`+ t / * u v + w − x ↑ y z`
> - postorder ⇒ **reverse Polish notation**：`t u v * w x y z ↑ − + / +`

> **陷阱** 若讀成 (w + x) − y↑z，數值一樣，但 tree 的形狀不同，寫出來的 Polish notation 也不同。

**計算 Polish notation**：從右往左掃，碰到運算子就和它後面兩個數運算，用結果取代這三個（reverse Polish 從左往右掃）。

> **例題** t = 4、u = 2、v = 3、w = 1、x = 9、y = 2、z = 3：
> ```
> + 4 / * 2 3 + 1 − 9 ↑ 2 3
> + 4 / * 2 3 + 1 − 9 8          ↑ 2 3 = 2³ = 8
> + 4 / * 2 3 + 1 1              − 9 8 = 9 − 8 = 1
> + 4 / * 2 3 2                  + 1 1 = 2
> + 4 / 6 2                      * 2 3 = 6
> + 4 3                          / 6 2 = 6 ÷ 2 = 3
> 7                              + 4 3 = 7
> ```
> 和直接代入原式 4 + 6/(1 + 9 − 8) = 7 相同。

> **陷阱** 運算子作用在它後面兩個數，前一個是左運算元：/ 6 2 是 6 ÷ 2，− 9 8 是 9 − 8，不是反過來。

## 生成樹

### 定義

G = (V, E) 是 connected simple graph。T = (V′, E′) 是 G 的 **spanning tree** ⇔ T 是 G 的 subgraph、T 是 tree、而且 V′ = V（包含 G 的所有點）。n 個點的 spanning tree 一定恰有 n − 1 條邊。spanning tree 通常不唯一：邊取法不同就得到不同的樹。

**作法一：拿掉 circuit 上的邊**。保留所有點，把 simple circuit 上的邊拿掉，直到沒有 circuit。

> **例題** 圖有 a～g 7 點、9 邊，所有點連通，但含 simple circuit（如 a–b–f–e–a），不是樹。
> 1. 拿掉 {a, e}，circuit a–b–f–e–a 消失。
> 2. 還有 e–g–f–e：拿掉 {e, f}。
> 3. 還有 f–c–g–f：拿掉 {c, g}。
>
> 剩下 6 條邊，連通、沒有 circuit、7 個點都在 ⇒ spanning tree。換別條邊拿也可以，所以不唯一。

> **例題** 圖有兩個 simple circuit a–b–d 和 b–c–e，各拿掉一條（例如 {a, b}、{b, c}），剩下 a–d–b–e–c：5 點 4 邊，沒有 circuit。圖有很多 circuit 時，每個 circuit 都要拿掉一條，拿完要檢查：點都還在、沒有 circuit。

> **例題** 三角形 a–b–c 只有一個 circuit，拿掉 {a, b}、{a, c}、{b, c} 任一條都是 spanning tree ⇒ 共 3 棵。

### DFS（depth-first search）

先把點排好順序 v₁, …, vₙ（有多個選擇時照這個順序，考題沒說時通常照字母或編號由小到大）。任選一點當 root，一直往「和路徑最後一點相鄰、還不在樹上」的點延伸，能走多遠走多遠；走不動就 **backtrack**（回溯）到上一個點，看能不能從那裡走到沒拜訪的點，不行再往回退。

```
T ← {v₁}
visit(v₁)

procedure visit(v)
    for 每個與 v 相鄰、不在 T 的 w
        把 w 和邊 {v, w} 加進 T
        visit(w)          { 先把 w 探索完，才回到 v 看下一個鄰居 }
```

每次加入的點都不在 T 裡，所以不會產生 cycle，最後得到 spanning tree。遞迴的行為等於用 stack。DFS 選到的邊叫 **tree edge**；圖中其他的邊都連接某點和它的祖先或子孫，叫 **back edge**。

> **例題** 從 f 出發：f → g → h → k → j；j 走不動，退回 k、再退回 h，接上 i；一路退回 f，走 f → d → e → c → a；a 走不動，退回 c 接上 b，所有點都進樹。根可以任選，換一個根（例如 h）也會得到 spanning tree，只是不同棵。題目指定根時一定要照做。

> **例題** 點 A～J 的 connected simple graph（含 cycle A–B–D，不是樹），照字母順序、從 A 做 DFS：
> A → B → D；D 走不下去，回 B → E → F；回 E → H；一路回到 A → C → G → I；回 G → J。
> 加入順序 A B D E F H C G I J；9 條邊 = 10 − 1，是 spanning tree。

### BFS（breadth-first search）

任選 root，先把所有和 root 相鄰的點與邊加入（level 1），再對上一層的每個點加入它相鄰、還沒在樹上的點（不會造成 circuit），一層一層往外長，讓每個點的 level 盡量小。

```
T ← {v₁}；L ← (v₁)                 { L 存「走到了但還沒處理」的點 }
while L 不空
    從 L 前端移除 v
    for 每個與 v 相鄰、不在 L 也不在 T 的 w
        把 w 加到 L 尾端
        把 w 和邊 {v, w} 加進 T
```

> **陷阱** L 是 queue（First In First Out，像排隊）；DFS 是遞迴，等於 stack（先進後出）。BFS 改用 stack，走法就不再是一層一層。

> **例題** 選 e 當根：e 相鄰 b、d、f、i ⇒ level 1（a 不和 e 相鄰）。level 2：b 接 a、c；d 接 h；f 接 g、j；i 接 k（已經在樹上的不再接）。level 3：g 接 l、k 接 m；a、c、h、j 沒有新點可接。

> **例題** 前面 A～J 的圖從 A 做 BFS：A 的鄰居 B、C、D 依序進 queue；拿出 B ⇒ 加 E；拿出 C ⇒ 加 G；拿出 D ⇒ 沒有可加的；拿出 E ⇒ 加 F、H；拿出 G ⇒ 加 I、J；F、H、I、J 都沒有可加的，queue 空了就結束。層次：A｜B C D｜E G｜F H I J。

同一張圖：DFS 樹又深又長（先走出一條很長的路再回溯補點），BFS 樹又矮又寬，兩棵邊數一樣（例：13 點的圖都是 12 條邊）。

**有向圖**：DFS、BFS 都能改成照箭頭方向走，但結果不一定是 spanning tree，而是 **spanning forest**。例：從 a 出發得到 a → b → c → g，c 不能走到 d（箭頭是 d → c）；回溯後接上 f、e；回到 a 不能再擴充，就另起一棵樹 d → h → l → k → j；最後 i 自己成一棵樹。應用：搜尋引擎的 web spider（crawler）從已知網頁出發，有系統地探索整個 Web。

**BFS 的應用**：
- 限制高度：做到 level 5 就停，不一定是 spanning tree，但離起點最短距離 ≤ 5 的點全在裡面，而且都在最小的 level。用在 P2P network（找附近的 node）、搜尋引擎 crawler、social network。
- **Erdős number**：collaboration graph 的點是作者，兩人合寫過論文就連一條邊（simple graph，多篇也只一條）。從 Paul Erdős（1913–1996，匈牙利數學家，組合數學與數論，約 1500 篇論文、500 多位合作者）出發做 BFS，所在的 level 就是 Erdős number（到他的最短 path 邊數）。Erdős 本人是 0，和他合寫過的是 1（他已過世，固定約 512 人），number 2 約一萬兩千多人。

> **陷阱** Erdős 本人的 Erdős number 是 0，不是 1。

### 數生成樹：Cayley 公式

三個點的樹畫法不同但都同構。改成記錄點的標號，叫 **labeled tree**。

> **例題** 3 個點：樹只差在中心是誰（1、2 或 3）⇒ 3 棵（就是三角形的 3 棵 spanning tree）。
> 4 個點：形狀只有兩種——
> - 星形（一點連其他三點）：只看中心標什麼，4 種。
> - 路徑形（degree 1、2、2、1）：4 × 3 × 2 × 1 = 24 種排法，但反向的標號（例如 2134 與 4312）是同一棵，除以 2 ⇒ 12 種。
>
> 共 12 + 4 = **16** 棵。

**Cayley 定理**：n 個點的 labeled tree 共 **nⁿ⁻²** 棵（= Kₙ 的 spanning tree 數）。驗證：3¹ = 3、4² = 16、5³ = 125。

證明想法：直接數很難，改用 bijection——把每棵 labeled tree 對應到一個數列 a₁, …, a_(n−2)，每項是 1 到 n。數列共 nⁿ⁻² 個，所以樹也有 nⁿ⁻² 棵。這個數列叫 **Prüfer code**：每次找編號最小的葉子，記下它相鄰的點，再把該葉子和邊移除，做到剩兩個點。

> **例題** 6 個點的樹，邊 3–1、4–2、5–2、2–1、1–6：
> 1. 葉子 3、4、5、6，最小 3，連到 1 ⇒ 記 1，移除 3。
> 2. 葉子 4、5、6，最小 4，連到 2 ⇒ 記 2。
> 3. 葉子 5、6，最小 5，連到 2 ⇒ 記 2；此時 2 只剩鄰居 1，變成葉子。
> 4. 葉子 2、6，最小 2，連到 1 ⇒ 記 1。剩 1、6 兩點，停。
>
> Prüfer code = **1 2 2 1**（長度 6 − 2 = 4）。每棵樹有唯一的 code，也能由 code 還原樹 ⇒ 一一對應。

## 用樹排序：merge sort

bubble sort 和 insertion sort 以比較次數來看都是 O(n²)。用 binary tree 組織資料可以降低比較次數（Algorithms + Data Structures = Programs）。merge sort 兩步：splitting、merging，各對應一棵 binary tree。

> **例題** 6 2 7 3 4 9 5 1 8（9 個數）。
> **splitting**：每次切一半，不能整除時左邊多一個（⌈9/2⌉ = 5），一直分到每個點只有一個數：
> ```
> 6 2 7 3 4 9 5 1 8
> 6 2 7 3 4 | 9 5 1 8
> 6 2 7 | 3 4 | 9 5 | 1 8
> 6 2 | 7 | 3 | 4 | 9 | 5 | 1 | 8
> 6 | 2
> ```
> splitting tree 每個 internal vertex 都有兩個 children：8 個 internal、9 片葉子。
> **merging**：從葉子往上，把兩個已排好的 list 合成一個——比兩個 list 的第一個（最小的），小的寫下來並拿掉；一邊空了，剩下的整段接到後面。
> ```
> 6 + 2 → 2 6；  2 6 + 7 → 2 6 7；  3 + 4 → 3 4；  2 6 7 + 3 4 → 2 3 4 6 7
> 9 + 5 → 5 9；  1 + 8 → 1 8；      5 9 + 1 8 → 1 5 8 9
> 2 3 4 6 7 + 1 5 8 9 → 1 2 3 4 5 6 7 8 9
> ```
> 最後一次 merge：2 比 1、2 比 5、3 比 5、4 比 5、6 比 5、6 比 8、7 比 8，共 7 次；左邊空了，8 9 直接接上。

```
procedure MergeSort(L = a₁, …, aₙ)
    if n > 1 then
        m := ⌈n/2⌉
        L₁ := a₁, …, aₘ；L₂ := aₘ₊₁, …, aₙ
        L := Merge(MergeSort(L₁), MergeSort(L₂))

procedure Merge(L₁, L₂)          { L₁、L₂ 都已排好 }
    L := 空串列
    while L₁、L₂ 都不空
        比較兩者的第一個，較小的移到 L 的右端
    把還不空的那個整段接到 L 的右端（它們都比 L 裡的大）
    return L
```

（n = 7 時 m = 4，前面 4 個；寫成 ⌊n/2⌋ 就是前面 3 個，Big-O 不受影響。）

**Merge 最多比幾次**：比較只發生在 Merge 裡。L₁ 有 n₁ 個、L₂ 有 n₂ 個，每比一次少一個，剩最後一個就不必比 ⇒ 最多 n₁ + n₂ − 1 次。

> **陷阱** 一邊空了以後剩下的不用再比，所以 n₁ + n₂ − 1 是上限，常常更少。

**worst case**：設 n = 2ʰ（不是 2 的次方時 Big-O 一樣）。splitting tree 的 level k（0 ≤ k ≤ h）每個點有 2^(h−k) 個元素；同一個 parent 的兩個點叫一對，level k 有 2^(k−1) 對。
- level k 的每一對：兩個 list 各 2^(h−k) 個，最多 2^(h−k+1) − 1 次；乘上 2^(k−1) 對 = 2ʰ − 2^(k−1)。
- level h：每對各 1 個，比 1 次，共 2^(h−1) 次（= 2ʰ − 2^(h−1)，符合上式）。
- 全部：Σₖ₌₁ʰ (2ʰ − 2^(k−1)) = h·2ʰ − (2ʰ − 1)。
- 代 n = 2ʰ、h = log₂ n：**n log₂ n − n + 1 = O(n log n)**，比 O(n²) 好：每層 O(n)，但只有 log n 層。

> **陷阱** log 的底在 Big-O 裡不重要（換底只差常數倍）；精確式子 n log₂ n − n + 1 的底是 2。

## 最短路徑：Dijkstra 演算法

### 權重圖與問題

每條邊再給一個數字叫 **weight**（權重），這種圖叫 **weighted graph**，寫成 G = (V, E, w)，w : E → ℝ。權重可以是距離、時間、過路費。這裡考慮 weighted、undirected、connected simple graph，w(u, v) > 0；沒有邊的兩點 weight 設 ∞。path 的 weight（長度）= 它所有邊的 weight 總和。**shortest path problem**：在兩點間所有 path 中找 weight 最小的。

> **例題** 6 點 A～F、8 條邊：w(A,B) = 1、w(A,C) = 4、w(B,D) = 3、w(B,E) = 3、w(C,D) = 10、w(C,E) = 3、w(D,F) = 5、w(E,F) = 1。
> A→B→D→F = 1 + 3 + 5 = 9；A→C→D→F = 4 + 10 + 5 = 19；A→B→E→F = 1 + 3 + 1 = 5。哪一條最短？要有系統的方法。

暴力列出所有 path 再比，path 太多。關鍵是 **principle of optimality**：若 A 到 B 的最短路徑 P 經過 C，則 P 裡 A 到 C 那段也是 A 到 C 的最短路徑（反證：若有更短的一段，換上去 P 就不是最短）。例：台北到新竹的最短路經過桃園，台北到桃園那段也最短。所以到每個中間點只要留最短的那條，其他都可以丟。

> **陷阱** principle of optimality 說的是「最短路徑的任何一段也是最短」；不是「每一步都走 weight 最小的邊」，反過來「兩段最短路接起來一定最短」也不成立。

### 演算法

**直覺**（greedy 一步步確定）：從起點出發，每次在目前「看得到」的點裡，確定離起點最近的那一個——繞別的地方只會更遠。

> **例題** 路網（示意距離）：臺北–桃園 30、臺北–宜蘭 50、桃園–新竹 70、桃園–宜蘭 70、宜蘭–花蓮 100、宜蘭–南投 70、新竹–南投 10、南投–臺中 40。從臺北出發：
> 1. 臺北的鄰居：桃園 30、宜蘭 50 ⇒ 桃園 30 確定。
> 2. 經過桃園：新竹 100；宜蘭 30 + 70 = 100 比 50 遠 ⇒ 宜蘭 50 確定。
> 3. 經過宜蘭：花蓮 150、南投 120。候選 新竹 100、南投 120、花蓮 150 ⇒ 新竹 100 確定。
> 4. 新竹到南投 10 ⇒ 南投改成 110 並確定；南投到臺中 40 ⇒ 臺中 150。
> 5. 臺中、花蓮都是 150，隨便挑，最後都確定。
>
> 要知道「怎麼走」，就得記下每點是從哪裡來的——所以要列表。

**Dijkstra's algorithm**：輸入 weighted、undirected、connected simple graph（weight 非負），點編號 v₁, …, vₙ（編號只是為了好講），起點 v₁。
- 每個點的 **label** 是 (L(v), 前一點)：L(v) 是「目前已知」從 v₁ 到 v 的最短距離（只經過已處理的點），前一點（predecessor）是這條路上 v 的前一站。
- 初始：L(v₁) = 0、label (0, –)；其他 L(v) = ∞；S = ∅（S 放已處理、已確定的點）。

```
while S ≠ V
    挑一個不在 S、L 值最小的點 u（一樣小就隨便挑）
    S := S ∪ {u}
    for 每個不在 S 的 v
        if L(u) + w(u, v) < L(v) then
            L(v) := L(u) + w(u, v)；v 的 predecessor := u
```

（只要某個終點的話，它進 S 就可以停。）結束時 L(vᵢ) 是 v₁ 到 vᵢ 最短 path 的 weight；沿 predecessor 一路往回找（backtrack）就得到整條 path。

**為什麼挑 L 最小的就對**：每次挑的都是目前 L 最小的，從別的未處理點繞過來不會更短（weight 非負），所以它的 L 就是真正的最短距離；這個性質一直維持（可用數學歸納法證明）。加進 S 的 label 不會再改變。

> **陷阱** 比較的是 L(u) + w(u, v) 和 L(v)，不是只比 w(u, v)。Dijkstra 需要 weight 不是負的，有負 weight 時「挑 L 最小的就確定」不再成立。

> **例題** 上面 A～F 的圖，從 A 出發：
>
> | 輪 | 挑 u | 更新 | 確定 |
> |---|---|---|---|
> | 1 | A（0） | B = 0 + 1 = 1、C = 0 + 4 = 4 | A = 0 |
> | 2 | B（1） | D = 1 + 3 = 4、E = 1 + 3 = 4 | B = 1 |
> | 3 | D（4，與 C、E 同值，任挑） | F = 4 + 5 = 9；C 經 D 是 14，不更新 | D = 4 |
> | 4 | C（4） | E 經 C 是 7，不更新 | C = 4 |
> | 5 | E（4） | F = 4 + 1 = 5 < 9，更新 | E = 4 |
> | 6 | F（5） | 無 | F = 5 |
>
> 結果 A 0、B 1、C 4、D 4、E 4、F 5。回溯：F 的 5 來自 E（4 + 1），E 來自 B，B 來自 A ⇒ A → B → E → F；D 的 4 來自 B ⇒ A → B → D。

> **例題** weight matrix（把 adjacency matrix 的 1 換成 weight、0 換成 ∞）：
> ```
>     A  B  C  D  E  F
> A [ ∞  3  9  7  ∞  ∞ ]
> B [ 3  ∞  5  ∞  6  8 ]
> C [ 9  5  ∞  2  4  ∞ ]
> D [ 7  ∞  2  ∞  ∞  5 ]
> E [ ∞  6  4  ∞  ∞  1 ]
> F [ ∞  8  ∞  5  1  ∞ ]
> ```
> 1. u = A：B (3, A)、C (9, A)、D (7, A)；E、F 仍 ∞。
> 2. u = B（3）：C 改成 3 + 5 = 8 (8, B)；B、D 沒有邊，D 維持 7；E (9, B)；F (11, B)。
> 3. u = D（7）：C 經 D 是 7 + 2 = 9，不比 8 好；D、E 沒有邊；F 經 D 是 7 + 5 = 12，不比 11 好——都不變。
> 4. u = C（8）：E 經 C 是 8 + 4 = 12，不比 9 好；C、F 沒有邊——不變。
> 5. u = E（9）：F 經 E 是 9 + 1 = 10 < 11 ⇒ (10, E)。
> 6. u = F：已沒有不在 S 的點，結束。
>
> 最後 label：A (0, –)、B (3, A)、C (8, B)、D (7, A)、E (9, B)、F (10, E)。
> A 到 F 最短 10：F ← E ← B ← A，path A B E F；A 到 C 是 A B C（8）；A 到 D 是 A D（7）。
> 所有 predecessor 邊（AB、BC、AD、BE、EF）合起來是一棵 spanning tree（**shortest-path tree**）：A 到每點恰好一條 path，而且都是最短的。

> **例題** 12 個點 V1～V12，從 V1 出發，依序確定：V1 0、V2 1、V4 3、V3 3、V6 5、V7 6、V8 6、V5 6、V9 8、V10 9、V12 10、V11 11（同值時任選）。V12 確定後 V11 經 V12 是 10 + 1 = 11 < 13 而更新。只要找 V12 的話，V12 確定就可以停。
> 回溯：V12 ← V10 ← V7 ← V6 ← V2 ← V1，最短路徑 V1→V2→V6→V7→V10→V12，長度 10。

> **陷阱** 同樣大的 L 挑哪個都可以，距離一樣，只是回溯出的路可能不同；最短路徑可能不只一條，演算法只給其中一條。

Edsger W. Dijkstra（1930–2002），荷蘭計算機科學家，在作業系統、程式語言、演算法都有基礎性的貢獻，1972 年得 Turing Award。

### 複雜度

- direct implementation：真正有運算的是 n − 1 輪（最後一輪只剩一點）。第 i 輪找最小 L 最多 n − i 次比較；更新最多 n − i 次比較和 n − i 次加法。比較總數 Σ 2(n − i) = n(n − 1)，加法 Σ (n − i) = n(n − 1)/2，worst case **O(n²)**。
- 用 binary heap 做 priority queue：**O(e log n)**（e 是邊數）。邊不多時比 O(n²) 小；e 跟 n² 同等級時反而比較大。複雜度跟資料怎麼存有關。

## 最小生成樹

### 定義

給 weighted、undirected、connected simple graph（n 點、e 邊），**minimal spanning tree**（MST，也叫 minimum spanning tree）是所有 spanning tree 中邊 weight 總和最小的那棵。MST 不一定唯一，演算法給出其中一棵。

> **例題** 用上面 weight matrix 的圖比三棵 spanning tree：
> - T₁ = Dijkstra 的 shortest-path tree（AB 3、BC 5、AD 7、BE 6、EF 1）：3 + 5 + 7 + 6 + 1 = 22。
> - T₂：另一棵，weight 33。
> - T₃（AB 3、BC 5、CD 2、CE 4、EF 1）：3 + 5 + 2 + 4 + 1 = 15。
>
> T₃ 最小，是 MST。但 A 到 E：T₁ 是 9、T₃ 是 3 + 5 + 4 = 12——目的不同，結果就不同。

> **陷阱** shortest-path tree ≠ MST：一個讓「起點到各點」最短，一個讓「所有邊的總和」最小。

**greedy algorithm**（貪心演算法）：每一步都做當下看起來最好的選擇，不管對未來的影響（repeatedly makes locally best choices, ignoring effects in the future）。不是所有問題 greedy 都對（下棋能吃就吃可能掉進陷阱），但 MST 問題 greedy 會成功。

### Prim's algorithm

T 是一棵逐漸長大的樹，一開始是任一個點。每次在「一端在 T、一端不在 T」的邊中挑 weight 最小的，連同它帶進來的點加入 T。這樣不會產生 cycle，T 一直是 tree；做 n − 1 次得到 spanning tree。

> **例題** 同一張圖從 A 開始（6 點，要再加 5 次）：
> 1. T = {A}：候選 AB 3、AC 9、AD 7 ⇒ 加 AB。
> 2. T = {A, B}：AC 9、AD 7、BC 5、BE 6、BF 8 ⇒ 加 BC。
> 3. T = {A, B, C}：AD 7、BE 6、BF 8、CD 2、CE 4 ⇒ 加 CD（AC 兩端都在 T，不能加）。
> 4. T = {A, B, C, D}：BE 6、BF 8、CE 4、DF 5 ⇒ 加 CE。
> 5. 只剩 F：BF 8、DF 5、EF 1 ⇒ 加 EF。
>
> 結果 AB、BC、CD、CE、EF，total 3 + 5 + 2 + 4 + 1 = **15**，就是 T₃。

> **陷阱** Prim 只看一端在 T、一端不在 T 的邊；兩端都已在 T 裡的邊會造成 cycle，不能加。

**證明 Prim 給出 MST**：
1. **是 spanning tree**：每次加的邊接在 T 上 ⇒ connected；做 n − 1 次 ⇒ n 點 n − 1 邊；每條邊一端在 T、一端不在 ⇒ 沒有 cycle。
2. **是 minimal**（歸納）：假設「目前的 T 是某一棵 MST M 的 subtree」。一開始 T 只有一點，每棵 MST 都包含它。加上演算法選的邊 e：
   - **e ∈ M**：T + e 仍是 M 的 subtree。
   - **e ∉ M**：把 e 加進 M，因為 e 的兩端都在 M 中，產生唯一的 cycle。e 一端在 T、一端不在 T，沿 cycle 繞回 T，一定還有另一條邊 e′ 也跨過 T 的邊界。e′ 也是候選，演算法卻選了 e，所以 w(e′) ≥ w(e)。令 M′ = M + e − e′：打斷唯一的 cycle，仍含所有點，是 spanning tree；w(M′) = w(M) + w(e) − w(e′) ≤ w(M)，所以 M′ 也是 MST，而且包含 T + e。
3. 每一步都成立，最後的 T 含所有點，就是一棵 MST。

> **陷阱** M′ 不必等於 M，只要「某一棵」MST 包含 T + e；e′ 要挑 cycle 上「跨過 T 邊界」的那條，不是隨便一條。

### Kruskal's algorithm

不要求過程中一直是 tree：先把所有邊照 weight 由小到大排序，T 從空集合開始，每次加一條不在 T 中、加進去不會形成 cycle、weight 最小的邊，加滿 n − 1 條。

> **例題** 同一張圖（10 條邊）排序後：
> 1. EF 1 ✓、CD 2 ✓、AB 3 ✓、CE 4 ✓（都不形成 cycle）。
> 2. weight 5 有兩條：DF 會形成 cycle D–C–E–F ✗；BC ✓。
> 3. 已有 5 條邊，結束：EF、CD、AB、CE、BC，total **15**，和 Prim 一樣。
>
> 已選的邊形成的塊數：加 CD 後 2 塊（EF、CD）、加 AB 後 3 塊、加 CE 後 2 塊（AB、CDEF）、加 BC 後 1 塊。過程中 T 是不連通的 forest，最後才連成一棵；Prim 的 T 則一直是一棵樹。

> **陷阱** Kruskal 判斷的是「加進去會不會形成 cycle」，不是「是否接在已選的邊上」；過程中 T 可以是 forest。

**證明 Kruskal 給出 MST**：
1. **是 spanning tree**（比 Prim 多一步，因為過程中不一定 connected）：output T 有 n − 1 條邊、沒有 cycle。若 T 有 k 個 component，每個都是 tree，T 的點數 = (n − 1) + k；k ≥ 2 會超過 n，但 T 是 G 的 subgraph 最多 n 點，矛盾 ⇒ k = 1，T 是 tree；tree 有 n − 1 條邊就有 n 個點 ⇒ spanning tree。
2. **是 minimal**：歸納假設改成「T 是某棵 MST M 的 subgraph」（T 不一定是 tree）。T = ∅ 時成立。加上 e：e ∈ M 就沒事；e ∉ M 時，加進 M 產生唯一的 cycle。e 的條件是兩端不在 T 的同一個 component（可能一端不在 T、兩端都不在、或在不同 component）；沿 cycle 繞一圈，可以找到另一條 e′ ≠ e，兩端也不在 T 的同一個 component。e、e′ 都有資格，演算法選了 e，w(e) ≤ w(e′)；M′ = M + e − e′ 是 MST 且包含 T + e。

兩個證明幾乎一樣：subtree 換成 subgraph，「一端在 T、一端不在 T」換成「兩端不在 T 的同一個 component」（條件更寬：e 的兩端可以都已在 T 裡，只要在不同 component）。

### 複雜度

- Prim 和 Dijkstra 很像：direct implementation O(n²)；用 binary heap 做 priority queue 可到 O(e log n)。
- binary heap：資料結構裡的 complete binary tree（一層一層由左到右填滿，和上面「每個 internal 剛好 2 個 children」的 complete 意思不同），而且 parent 比 children 小（min-heap）。
- Kruskal 用 union-find 資料結構：O(e log e)。

不是所有問題 greedy 都能找到最好的，但常常可以先從 greedy 想起，再調整。

## 配對問題

### 問題與定義

> **例題** 舞會有 8 個女生（大寫 A～H：Alice、Betty、Cindy、Doris、E、Flo、Gloria、Hazel）和 8 個男生（小寫 a～h：Art、Bill、Carl、Don、Eric、Frank、Gary、Hal）。女生喜歡的男生：
>
> | 女生 | 喜歡的男生 |
> |---|---|
> | A | a e f g h |
> | B | b c h |
> | C | c e f g |
> | D | d h |
> | E | b c d |
> | F | b d |
> | G | a b c d |
> | H | b c d |
>
> 每個女生能不能都和一個她喜歡的男生跳舞？條件：每個女生恰好配一個她喜歡的男生；每個男生只配一個女生。配到的越多越好。

一般的 matching problem：兩個集合 X、Y，X 的成員和 Y 的某些成員 compatible。例：職業介紹所（人 ↔ 工作）；排先發（10 個守備位置 ↔ 球員）。用 **bipartite graph** 描述：X、Y 是 bipartition，compatible 就連一條邊（舞會共 26 條邊）。

- **matching** M ⊆ E：M 中任兩條邊沒有共同端點（一女不配兩男、一男不配兩女）。
- **maximum matching**：沒有其他 matching 的 |M| 比它大。
- **complete matching**：X 的每個點都配到，|M| = |X|。

問題變成：這個二分圖有沒有 complete matching？沒有的話，maximum matching 多大？

> **陷阱** matching 的條件 X 端和 Y 端都要檢查。另外 maximum matching（size 最大）和 maximal matching（不能再加任何一條邊）不同；口語上有時把前者也說成 maximal。

### 先配配看：greedy 會卡住

照字母順序能配就配：A–a、B–b、C–c、D–d（size 4）。E 喜歡 b、c、d，三個都被配走了，卡住。

> **陷阱** 「能配就配」不保證最大，卡住不代表已經是最大。

**調整**：E 喜歡 b，但 b 配給了 B；B 還喜歡 h，而 h 沒被配。把 h 配給 B、b 配給 E：路徑 E–b–B–h 上，不在 matching 的邊和在 matching 的邊對調，size 從 4 變 5。

### alternating path 與 augmenting path

- **alternating path**：從一個 unmatched 的 x 出發，邊依序 不在 M、在 M、不在 M、……
- **augmenting path**：最後停在一個 unmatched 的 y。把路上的邊「在／不在」對調，|M| 加 1（不在 M 的邊比在 M 的多一條）。

> **陷阱** alternating path 不一定能 augment；要結束在 unmatched 的 y 才是 augmenting。

**Hungarian algorithm**：從 unmatched 的 x 用 modified BFS 長 **alternating tree**——往下走不在 M 的邊、從 y 往下一定走它在 M 裡的那條邊；已經出現在 tree 上的點不能再長一次。碰到 unmatched 的 y 就 augment。

> **例題** 接著做（M = A–a、B–h、C–c、D–d、E–b，size 5）：
> 1. **從 F**（喜歡 b、d）：b → E、d → D。E 喜歡 b、c、d，b、d 已在樹上，c → C；D 喜歡 d、h，h → B。C 喜歡 c、e、f、g，e 沒配到 ⇒ 找到 **F–b–E–c–C–e**。augment：F–b、E–c、C–e 進 M，E–b、C–c 出 M，size 6。
> 2. **從 G**（喜歡 a、b、c、d，都已配：a–A、b–F、c–E、d–D）：從 A 往下，a 已在樹上，e 有配（給 C），f 沒配到 ⇒ **G–a–A–f**。augment：A–f、G–a，M = A–f、B–h、C–e、D–d、E–c、F–b、G–a，size 7。
> 3. **從 H**（喜歡 b、c、d）：b → F、c → E、d → D；F（b、d）、E（b、c、d）長不下去；D → h → B；B（b、c、h）也長不下去。沒有 augmenting path。
>
> 從 H 長出的樹叫 **Hungarian tree**，root H 叫 **Hungarian acorn**（橡實）。樹上 5 個女生 B、D、E、F、H 只喜歡 4 個男生 b、c、d、h，所以 8 個女生不可能都配到。maximum matching = 7。

> **陷阱** Hungarian tree 不是找錯了，它指出問題所在：樹上的 x 比 y 多一個，她們喜歡的男生不夠分。

```
把所有 x 標成 untested
while 還有 unmatched 且 untested 的 x
    任選一個這樣的 x，從它長 alternating tree
    if 長到 unmatched 的 y（augmenting）then
        augment matching；把所有 x 改回 untested
    else
        碰到 Hungarian tree，把 root（Hungarian acorn）標成 tested
```

結束時，要嘛所有 x 都配到，要嘛所有 unmatched 的 x 都是 Hungarian acorn。

> **陷阱** 每次 augment 之後要把所有 x 清回 untested：matching 變了，之前不行的可能又可以。

**定理**：Hungarian algorithm 結束時的 matching 是 maximum matching。

**證明**：設演算法的結果是 A-matching，假設有更大的 B-matching，|B| > |A|。
1. 則有某個 x 是 B-matched 但 A-unmatched。從它出發走 B-edge、A-edge、B-edge……交替的 path。
2. 若最後停在一個 y（走 B-edge 到達、該 y 是 A-unmatched），這條 path 對 A 是 augmenting，與演算法已停止矛盾。所以 path 一定停在一個 A-matched、B-unmatched 的 x。
3. 這給出一個對應：每個「B 有 A 沒有」的 x ↦ 一個「A 有 B 沒有」的 x。它是一對一的：若兩條 path 終點相同，往回看第一次碰到同一點的兩條邊，同為 A-edge（則 A 不是 matching）或同為 B-edge（則 B 不是 matching），矛盾。
4. 由鴿籠原理，「A 有 B 沒有」的 x 個數 ≥「B 有 A 沒有」的 x 個數；兩邊都有或都沒有的 x 不影響，所以 |A| ≥ |B|，矛盾。

### Hall's theorem

G 是二分圖，V = X ∪ Y，A ⊆ X。**R(A)** = Y 中與 A 的某個點相鄰的點的集合。

> **例題** x₁–y₁, y₂；x₂–y₂, y₃；x₃–y₄, y₁。A = {x₁, x₂, x₃} ⇒ R(A) = {y₁, y₂, y₃, y₄}。

**Hall's theorem**：G 有 complete matching ⇔ 對所有 A ⊆ X，|R(A)| ≥ |A|。（任找幾個女生，她們喜歡的男生數都 ≥ 女生數。）
- **必要性**（contrapositive）：若某個 A 有 |R(A)| < |A|，光 A 就配不完，沒有 complete matching。很 trivial。
- **充分性**（contrapositive）：沒有 complete matching ⇒ 跑 Hungarian algorithm，有 x 沒配到，它是 Hungarian acorn，長出 Hungarian tree。這棵樹的葉子都是 x，樹上 x 連到的 y 全在樹上；除了 root，每個 x 都由一條 matching 邊接在某個 y 下面，所以 x 比 y 剛好多 1。取 A = 樹上的 x，|R(A)| = |A| − 1 < |A|。舞會：A = {B, D, E, F, H}，R(A) = {b, c, d, h}，4 < 5。

> **陷阱** 條件是「對所有」子集 A 都要成立；只檢查 A = X 不夠。

### deficiency

Hall 條件要檢查 2^|X| 個子集，不見得好用。定義 **deficiency**：

```
δ(G) = max over A ⊆ X of ( |A| − |R(A)| )      （取 A = ∅ 得 δ(G) ≥ 0）
```

**定理**：maximum matching 的 size = |X| − δ(G)；有 complete matching ⇔ δ(G) = 0。舞會 δ = 1、|X| = 8 ⇒ 最多 7。

**證明**：
1. **上界**：取 A₀ 使 |A₀| − |R(A₀)| = δ，光 A₀ 就有 δ 個人配不到 ⇒ 任何 matching ≤ |X| − δ。
2. **達到**：在 Y 這邊加 δ 個新點 D，把 X 的每個點連到 D 的每個點（新邊集 K），得 G*：X* = X、Y* = Y ∪ D、E* = E ∪ K。對非空的 A ⊆ X，R*(A) = R(A) ∪ D（不相交），|R*(A)| = |R(A)| + δ ≥ |A|；A = ∅ 時兩邊都是 0。G* 滿足 Hall 條件，有 complete matching M*（|M*| = |X|）。
3. M* 在 K 裡最多 δ 條（D 只有 δ 個點），也不能少於 δ（否則拿掉 K 的邊後超過上界）⇒ 拿掉剛好 δ 條，得到 size |X| − δ 的 matching。

Hall 定理的證明用到 Hungarian algorithm；deficiency 定理的證明用到 Hall 定理。

> **陷阱** δ(G) 取的是 max，不是加總；而且 δ(G) ≥ 0。

## 最大流

### network 與 flow

**transport network** N = (V, E)：connected directed simple graph，
- 唯一的 **source** s：連在 s 上的邊都離開 s；
- 唯一的 **sink** t：連在 t 上的邊都指向 t；
- 每條有向邊 (v, w) 有 **capacity** c(v, w)，假設是非負整數（有負的就全部加一個常數、不是整數就全部乘一個常數，不影響實際問題）。

可以模擬輸送液體的管線（每根管子的容量）或電腦網路（每條 link 的最大 data rate）。

> **陷阱** (v, w) 是有序對，c(v, w) 和 c(w, v) 是兩個方向，不要當成無向邊。

**flow** f：每條邊 e 給一個非負整數 f(e)，滿足
1. **feasibility**：f(e) ≤ c(e)（流量不超過容量）。
2. **conservation**：除了 s、t，每點 inflow = outflow（流量守恆，不會漏）。

沒有邊的地方 capacity 和 flow 都當作 0。**value** val(f) = source 的 outflow。**maximum flow**：value 最大的 flow。

> **陷阱** conservation 不要求 s 和 t：s 只流出、t 只流進。

> **例題** 6 個點 s、a、b、c、d、t 的 network，以及一個 flow f：
>
> | 邊 | capacity | f |
> |---|---|---|
> | (s, a) | 5 | 3 |
> | (s, b) | 4 | 2 |
> | (s, c) | 3 | 3 |
> | (a, d) | 6 | 1 |
> | (a, t) | 3 | 2 |
> | (b, d) | 2 | 2 |
> | (c, d) | 7 | 1 |
> | (c, t) | 5 | 2 |
> | (d, t) | 4 | 4 |
>
> feasibility：每條 f ≤ c ✓。conservation：a：3 = 1 + 2；b：2 = 2；c：3 = 1 + 2；d：1 + 2 + 1 = 4 = 4。outflow(s) = 3 + 2 + 3 = 8 = inflow(t) = 2 + 2 + 4 ⇒ val(f) = 8。

### cut

**cut (S, T) separating s and t**：S、T 是 V 的 partition，s ∈ S、t ∈ T。

**性質 1**：對任何 flow f、任何這樣的 cut，

```
val(f) = Σ_{x∈S, y∈T} f(x, y) − Σ_{u∈T, v∈S} f(u, v)      （流過去 − 流回來）
```

> **例題** S = {s, a, b, d}、T = {c, t}：S → T 的邊 (a, t)、(d, t)、(s, c)，flow 2 + 4 + 3 = 9；T → S 的邊 (c, d)，flow 1。9 − 1 = 8 = val(f)。

**證明**（只用 conservation）：val(f) = Σ_y f(s, y) − Σ_y f(y, s)（後者 = 0）。對 S 裡其他每個 x 加上 outflow(x) − inflow(x)（= 0，因為 x ≠ s、t）。合併成對整個 S 加總，再把 V 拆成 S ∪ T：S → S 的兩項一樣、消掉，剩 Σf(S → T) − Σf(T → S)。

取 T = {t}：前項 = inflow(t)，後項 = outflow(t) = 0 ⇒ **val(f) = outflow(s) = inflow(t)**。

> **陷阱** 流回來的（T 到 S）要扣掉，不是加上去。

**cut 的 capacity**：c(S, T) = Σ_{x∈S, y∈T} c(x, y)，只加 S 到 T 的邊。
- S = {s, a, b}：(s, c) 3 + (a, d) 6 + (a, t) 3 + (b, d) 2 = 14。
- S = {s, b}：(s, a) 5 + (b, d) 2 + (s, c) 3 = 10。

> **陷阱** cut capacity 只算 S → T 方向的 capacity；flow value 公式才要減掉 T → S 的 flow，兩者不要混。

**性質 2**：任何 flow、任何 cut，**val(f) ≤ c(S, T)**。val(f) = Σf(S→T) − Σf(T→S) ≤ Σf(S→T)（後項 ≥ 0）≤ Σc(S→T) = c(S, T)（feasibility）。所以 max flow ≤ min cut；找到一個 flow 剛好等於某個 cut capacity，它就是 maximum flow（那個 cut 也是 minimum cut）。

### 把 flow 變大

> **例題** 從 f（value 8）出發：
> 1. directed path s → a → t：(s, a) 3/5、(a, t) 2/3 都沒滿。兩條邊加同樣的量，conservation 仍成立；最多加 min(5 − 3, 3 − 2) = 1 ⇒ F₁：(s, a) 4、(a, t) 3，value 9。
> 2. 再找 s – a – d – c – t：(c, d) 的箭頭和 path 方向相反（backward edge）。
>    - forward 能加 c − f：(s, a) 5 − 4 = 1、(a, d) 6 − 1 = 5、(c, t) 5 − 2 = 3。
>    - backward 等於把反向的 flow 抵消：最多 (c, d) 現在的 flow 1（不能變負）。
>    - Δ = min(1, 5, 1, 3) = 1 ⇒ F₂：(s, a) 4→5、(a, d) 1→2、(c, d) 1→0、(c, t) 2→3。
>    - value：source 5 + 2 + 3 = 10，sink 3 + 4 + 3 = 10。8 → 9 → 10。
> 3. cut S = {s, b}、T = {a, c, d, t} 的 capacity 是 10 = val(F₂) ⇒ F₂ 是 maximum flow。

> **陷阱** 可以加的量取最小值：(s, a) 能加 2、(a, t) 只能加 1，加 2 會讓 (a, t) 超量。backward edge 看的是它現在的 flow（1），不是 capacity（7）。

**f-augmenting path**：P 是 s 到 t 的 path（在 underlying undirected graph 上），每條邊：
- forward edge（順著 path 方向）：f(e) < c(e)；
- backward edge（逆著方向）：f(e) > 0。

沿 P 在 forward 邊加、backward 邊減 Δ_P = min Δ_e，其中 forward Δ_e = c(e) − f(e)、backward Δ_e = f(e)。兩個條件都不會違反，value 增加 Δ_P。例：min(5 − 4, 6 − 1, 1, 5 − 2) = 1。

一般做法：flow 從全部 0 開始（一定合法，像 matching 從空的開始），一直找 f-augmenting path 加大，直到找不到。

> **陷阱** forward 要「嚴格小於」capacity（等於就沒空間）；backward 要「嚴格大於」0（是 0 就沒得抵消）。

### Max-Flow Min-Cut Theorem

**定理**：從 s 到 t 的 flow 最大值 = separating s、t 的 cut capacity 最小值。

**證明**：設 F 是 maximum flow。令 S = 所有 v，使得從 s 到 v 有一條 **incomplete f-augmenting path**（每條邊都滿足 f-augmenting 的條件，但終點不必是 t），s ∈ S；T = V − S。
1. **t ∈ T**：若 t ∈ S，就有 s 到 t 的 f-augmenting path，F 還能加大，矛盾。所以 (S, T) 是合法的 cut。
2. **S → T 的邊滿載**：(x, y)，x ∈ S、y ∈ T，若 f(x, y) < c(x, y)，path 可以延長到 y，y ∈ S，矛盾 ⇒ f(x, y) = c(x, y)。
3. **T → S 的邊是 0**：(u, v)，u ∈ T、v ∈ S，若 f(u, v) > 0，path 可以從 v 沿 backward 邊延伸到 u，u ∈ S，矛盾 ⇒ f(u, v) = 0。
4. 代入：val(F) = Σf(S→T) − Σf(T→S) = Σc(S→T) − 0 = c(S, T)。任何 cut (S′, T′) 都有 c(S′, T′) ≥ val(F) = c(S, T)，所以 (S, T) 是 minimum cut。

> **例題** 在 F₂ 上找 S：(s, a) 5 = 5、(s, c) 3 = 3 滿了走不過去；(s, b) 2 < 4 ⇒ b ∈ S；(b, d) 2 = 2 也滿了。所以 S = {s, b}、T = {a, c, d, t}，S → T 的 (s, a)、(s, c)、(b, d) 都滿載，c(S, T) = 10 = val(F₂)。

**Edmonds–Karp algorithm**（1972）：flow 從全 0 開始；repeat：從 s 用 BFS 長一棵 incomplete f-augmenting path 的樹（每條加進樹的邊都要滿足 forward f < c、backward f > 0，不是照箭頭方向就能走）；長到 t 就沿那條 path 加 Δ_P，否則停。停下時 S = 樹上的點、T = V − S：t ∉ S，S → T 滿載、T → S 為 0，所以 flow 是 maximum flow、(S, T) 是 minimum cut。

Ford–Fulkerson method（1956）沒規定怎麼找 path；Edmonds–Karp 用 BFS 找，是它的一種實作。

## 重點整理
- 強連通：任兩點雙向可達；弱連通：拿掉方向後連通。
- Euler circuit ⇔ connected + 全偶度；Euler trail ⇔ connected + 恰兩奇度點（從奇點到奇點）；七橋 3、5、3、3 都不行。
- Hamilton：每點一次，沒有簡單判斷條件（NP-complete）。
- 平面圖 v − e + r = 2；Σdeg(R) = 2e；e ≤ g(v − 2)/(g − 2)（g = 3：e ≤ 3v − 6）；K₅：9 < 10、K₃,₃：8 < 9、Petersen：40/3 < 15。
- Kuratowski：non-planar ⇔ 含 homeomorphic to K₅ 或 K₃,₃ 的 subgraph。
- χ(Kₙ) = n、χ(二分圖) = 2、χ(C偶) = 2、χ(C奇) = 3；P(K₄, λ) = λ(λ − 1)(λ − 2)(λ − 3)；平面圖 χ ≤ 4。
- tree = connected + 無 cycle；唯一 path、拿一邊斷成兩棵、|V| = |E| + 1；forest |V| = |E| + r。
- complete m-ary：n = mi + 1、l = (m − 1)i + 1、i = (n − 1)/m；l ≤ mʰ、h ≥ ⌈log_m l⌉（complete + balanced 取等號）。
- preorder 根左右、inorder 左根右、postorder 左右根；Polish = preorder，從右往左算。
- spanning tree 有 n − 1 條邊；DFS 用 stack（遞迴）、BFS 用 queue；Cayley：nⁿ⁻²；Prüfer code 長度 n − 2。
- merge sort worst case n log₂ n − n + 1 = O(n log n)；一次 merge 最多 n₁ + n₂ − 1 次比較。
- Dijkstra：挑 L 最小、更新 L(u) + w(u, v) < L(v)；O(n²)，heap 版 O(e log n)；weight 不可為負。
- Prim：一端在 T、一端不在 T 的最小邊；Kruskal：不成 cycle 的最小邊；證明都靠交換 e、e′；Kruskal O(e log e)。
- matching：augmenting path 讓 |M| + 1；Hungarian algorithm 停下即 maximum；Hall：complete matching ⇔ ∀A，|R(A)| ≥ |A|；max matching = |X| − δ(G)。
- flow：feasibility + conservation；val(f) = 流過去 − 流回來 ≤ c(S, T)；max flow = min cut；Edmonds–Karp 用 BFS 找 f-augmenting path。

## 名詞對照
| 中文 | English |
|---|---|
| 強連通／弱連通 | strongly / weakly connected |
| 尤拉迴路 | Euler circuit |
| 尤拉行跡 | Euler trail |
| 哈密頓路徑／迴路 | Hamilton path / circuit |
| 平面圖 | planar graph |
| 平面嵌入 | planar embedding |
| 區域 | region (face) |
| 圍長 | girth |
| 細分 | elementary subdivision |
| 同胚 | homeomorphic |
| 對偶圖 | dual graph |
| 著色數 | chromatic number |
| 著色多項式 | chromatic polynomial |
| 四色定理 | four color theorem |
| 樹、森林 | tree, forest |
| 有根樹 | rooted tree |
| 葉 | leaf |
| 內部節點 | internal vertex |
| 層、高度 | level, height |
| m 元樹 | m-ary tree |
| 平衡 | balanced |
| 前序、中序、後序 | preorder, inorder, postorder |
| 波蘭表示法 | Polish notation |
| 生成樹 | spanning tree |
| 深度優先搜尋 | depth-first search (DFS) |
| 廣度優先搜尋 | breadth-first search (BFS) |
| 回溯 | backtrack |
| 生成森林 | spanning forest |
| 標號樹 | labeled tree |
| 合併排序 | merge sort |
| 權重圖 | weighted graph |
| 最短路徑 | shortest path |
| 最佳化原理 | principle of optimality |
| 最小生成樹 | minimal (minimum) spanning tree |
| 貪心演算法 | greedy algorithm |
| 配對 | matching |
| 最大配對 | maximum matching |
| 完全配對 | complete matching |
| 交錯路徑 | alternating path |
| 擴增路徑 | augmenting path |
| 匈牙利演算法 | Hungarian algorithm |
| 霍爾定理 | Hall's theorem |
| 不足數 | deficiency |
| 運輸網路 | transport network |
| 源點、匯點 | source, sink |
| 容量 | capacity |
| 流量守恆 | conservation |
| 割 | cut |
| 最大流最小割定理 | max-flow min-cut theorem |
