# 圖論（基礎）

圖（graph）就是一堆點加上連接它們的邊，用來描述「誰跟誰有關係」：地圖上相鄰的州、分子裡的原子、電路、網路。這一章打底：圖的正式定義與各種分類（simple graph、multigraph、pseudograph、有向圖）、degree 與握手定理、幾種特殊的圖（Kₙ、Cₙ、Wₙ、Qₙ、二分圖）、walk／trail／path 等名詞、連通分量、用矩陣和串列表示圖，以及判斷兩個圖是否同構（isomorphism）。章首先補上偏序（partial order）、Hasse 圖與拓撲排序，它們是「關係」與「圖」的橋樑。考試最常考：Σdeg(v) = 2|E| 與奇數度點有偶數個、Kₙ／Wₙ／Qₙ／K_{m,n} 的點數邊數、名詞的定義差異、用不變量證明不同構。

## 學完這章要會
- 偏序的三個條件（reflexive、antisymmetric、transitive）、poset、字典順序；畫 Hasse diagram；分辨 maximal／greatest、上界／最小上界；判斷 lattice；拓撲排序。
- 圖的定義 G = (V, E)：無向邊 {u, v}、有向邊 (u, v)。
- simple graph、multigraph、pseudograph、directed graph、directed multigraph 的差別（兩套用語）。
- adjacent、incident、endpoint；degree、isolated、pendant；loop 算 2 度；in-degree、out-degree。
- 握手定理 Σdeg(v) = 2|E| 與 handshaking lemma（奇數度點有偶數個）。
- Kₙ、Cₙ、Wₙ、Qₙ、K_{m,n} 的點數、邊數、regular 程度；子圖與聯集。
- walk、trail、circuit、path、cycle 的定義表。
- 用「中間有 path」這個等價關係定義 component 與 connected。
- adjacency matrix、adjacency list、incidence matrix；Aᵏ 數 walk。
- 同構的定義；找對應證明同構、用不變量證明不同構。

## 銜接：偏序、Hasse 圖與拓撲排序

### partial order 的三個條件

partial ordering 像「≤」，但允許有些東西不能比較。集合 A 上的關係 ≼ 是 **partial order**，要滿足：
- **reflexive**：a ≼ a。
- **antisymmetric**：a ≼ b 且 b ≼ a ⇒ a = b。
- **transitive**：a ≼ b、b ≼ c ⇒ a ≼ c。

例：≤、≥、整除 |、集合包含 ⊆ 都是 partial order。2 | 4、4 | 8 ⇒ 2 | 8；但 2 ∤ 3 且 3 ∤ 2，兩者不能比——這就是「partial」的意思。任兩個元素都能比、可以排成一串的叫 **total（linear）ordering**。

> **陷阱** partial order 要 antisymmetric，不是 symmetric；若是 symmetric，2 ≤ 3 就會推出 3 ≤ 2。

**poset**（partially ordered set）：集合加上一個 partial order。兩個 poset 的 Cartesian product 上可以定義 **lexicographic order**（字典順序）：

```
(a₁, b₁) ≼ (a₂, b₂) ⇔ a₁ ≺ a₂，或 a₁ = a₂ 且 b₁ ≼ b₂；否則不能比
```

> **例題** 兩個座標都用整除：
> - (2, 1) ≼ (4, 3)：2 | 4 且 2 ≠ 4，第一個座標就分出大小。
> - (3, 1) 與 (2, 4)：3 和 2 不能比，所以兩者不能比。
> - (3, 1) ≼ (3, 4)：第一個座標相等，比第二個，1 | 4。

### Hasse diagram

把 partial order 畫成有向圖：每點都有自己的圈（reflexive）、只有單行道（antisymmetric）、滿足遞移。化簡成 **Hasse diagram**：
1. 擦掉每個點自己的圈。
2. 擦掉可由遞移推出的邊（有 a → b → c 就擦掉 a → c）。
3. 小的放下面、大的放上面。
4. 箭頭都是由下往上，拿掉箭頭。

> **例題** A = {2, 3, 4, 6, 9, 10}，關係是整除。
> 1. 有關係的配對：(2,2)(2,4)(2,6)(2,10)(3,3)(3,6)(3,9)(4,4)(6,6)(9,9)(10,10)。4、6、9、10 往上沒有能被它整除的了。
> 2. 擦掉自己的圈。
> 3. 擦遞移邊：這裡沒有 a → b → c 這種兩段的鏈，這一關自動過（但還是要檢查）。
> 4. 2、3 放下面，4、6、9、10 放上面，拿掉箭頭：
> ```
>  4    10    6     9
>   \   |   /  \   /
>    \  |  /    \ /
>       2        3
> ```
> 線（由下往上）：2–4、2–10、2–6、3–6、3–9。沒有上下線連著的兩點不能比，例如 4 和 9。

> **陷阱** Hasse 圖的線可以交叉，不會造成誤解；沒有一路往上連線的兩點就是不能比較。

### maximal 與 greatest、minimal 與 least

類比函數的極大值（區域性）與最大值（全域性）：
- **maximal**（極大元素）：找不到任何元素比它大（可能只是因為不能比）。
- **greatest**（最大元素）：所有其他元素都 ≼ 它。
- minimal、least 同理。

> **例題**（示意）Hasse 圖：1、2、3 在最下層，都往上連到 4；4 再往上連到 6 和 7。
> - 4 不是 maximal，因為 6、7 比它大。6、7 上面沒有元素，都是 maximal。
> - 6 和 7 不能比，所以沒有 greatest。
> - 1、2、3 都是 minimal，沒有 least。若在最下面再加一個點、所有線都從它出發，它就是 least。

**定理**：有限、非空的 poset 一定至少有一個 maximal 和一個 minimal。證明：若 a 不是極小，就有比它小的元素；再看那個，不是極小就再往下找。transitive 保證越找越小，集合有限，只能找有限次，一定停在某個極小元素。無限集合不一定：(ℤ, ≤) 沒有極大也沒有極小。

> **陷阱** maximal 不一定是 greatest：可能有好幾個 maximal 而沒有 greatest。

### 上界與最小上界

- u 是集合 S 的 **upper bound**：S 中每個元素都 ≼ u（u 可以在 S 裡面，也可以在外面）。
- **least upper bound**（LUB）：所有上界中最小的那個。下界、**greatest lower bound**（GLB）同理。

> **例題**（示意）Hasse 圖：a、b 在最下層，都往上連到 c；c 再往上分別連到 d 和 e。
> - {a, b} 的上界：c、d、e，最小的是 c ⇒ LUB = c。
> - {a, b, c}：c ≼ c，c 也是上界；上界仍是 c、d、e，LUB = c。
> - {a, b, c, d}：上界只有 d，LUB = d。
> - {a, b, c, d, e}：d、e 不能比，沒有元素比兩者都大，連上界都沒有，當然沒有 LUB。

### lattice（格）

**lattice**：一個 poset，其中任兩個元素都有 LUB 和 GLB。要判斷是不是 lattice，必須把所有配對都檢查過。
- 上例：d、e 的 GLB 是 c，但 d、e 沒有 LUB ⇒ 不是 lattice。分成兩堆、彼此根本不能比的圖也不會是 lattice。

> **例題**（示意）元素 a～i，Hasse 圖的線（由下往上）：a–b、a–c、a–e、c–d、b–f、e–f、d–h、f–h、f–i。
> - c、a：比兩者都大的有 c、d、h，最小的是 c ⇒ LUB(c, a) = c；比兩者都小的只有 a ⇒ GLB = a。
> - e、b：比兩者都大的有 f、h、i，最小是 f ⇒ LUB(e, b) = f；GLB(e, b) = a。
> - i、h：下界有 f、b、e、a，GLB = f；但上面沒有合起來，沒有上界 ⇒ 沒有 LUB。
>
> 所以不是 lattice。lattice 的長相大概是：底下收起來、上面也收起來。

### topological sorting（拓撲排序）

搬家要先拉網路線、先把位置清開；蓋大樓要綁鋼筋、拉管線、灌漿，一樓做完才能做二樓。工作之間的先後是一個 partial order。把所有工作排成一列，能比較的小的一定在前、大的在後，叫 **topological sorting**。

> **例題** 七個工作，A ≺ C、B ≺ C、C ≺ D、C ≺ E、F ≺ G，其他沒有關係。
> 一種答案：A B C D E F G；另一種：F G B A C E D。答案不唯一。

**演算法**：每次從剩下的元素挑一個 minimal element 拿走，重複到全部排完。有限 poset 一定有 minimal（上面的定理），所以一定挑得到。

## 圖的定義

一個 graph 由兩個集合組成：**V**（vertices，節點／端點；單數 vertex）與 **E**（edges，邊），寫成 G = (V, E)。V 是有限、非空集合，叫 vertex set；E 叫 edge set。定義一個圖就是描述這兩個集合。這裡的「圖」不是統計圖表。

- **undirected graph**（無向圖）：邊是 unordered pair {u, v}，沒有方向。
- **directed graph**（digraph，有向圖）：E ⊆ V × V，邊是 ordered pair (u, v)，畫圖時加箭頭。

> **例題** 無向圖 V = {a, b, c, d}，E = {{a,b}, {a,c}, {a,d}, {b,d}, {c,d}}：4 個端點、5 條邊。同一個圖可以有很多種畫法，數學上是同一個圖。邊也可以命名 e₁、e₂、…，例如 V = {A, B, C}、E = {{A,B}, {B,C}}。

> **例題** 有向圖 V = {a, b, c, d}，E = {(a,b), (a,c), (a,d), (b,d), (c,d)}。V × V 共 16 個 ordered pair，E 只取其中 5 個。另一例：邊 (B, A)、(B, C)、(C, B)，(B, C) 和 (C, B) 是兩條不同的邊。

> **陷阱** {a, b} 用大括號是集合、沒有順序（無向）；(a, b) 用小括號、有順序（有向）。

### 描述點跟邊的用語

無向邊 e = {u, v}：
- u、v **adjacent**（相鄰，互為 neighbors）；
- u、v 是 e 的 **endpoints**；
- e **incident with** u 和 v；e **connects** u and v。

考題常用完整的英文句子敘述，要能從中認出點和邊。

有向邊 e = (u, v)：u **adjacent to** v、v **adjacent from** u；u 是 **initial vertex**、v 是 **terminal vertex**。

### 圖的分類

**一套用語**：
- **simple graph**：任兩個不同端點之間最多一條邊，而且沒有 loop（自己連自己）。例：美國各州相鄰的圖；它像一個沒有 loop 的 symmetric relation。
- **multigraph**：允許多重邊（multiple edges）與 loop，是更廣義的圖。

**另一套用語**（更細）：

| 類型 | 邊的方向 | 多重邊 | loop |
|---|---|---|---|
| simple graph | 無向 | 不允許 | 不允許 |
| multigraph | 無向 | 允許 | 不允許 |
| pseudograph | 無向 | 允許 | 允許 |
| directed graph | 有向 | 不允許 | 允許 |
| directed multigraph | 有向 | 允許 | 允許 |

多重邊無法用集合 {a, b} 區分（兩條都是 {a, b}），所以要給每條邊命名，再用一個函數 f 指出每條邊的端點。directed graph 就是一個 binary relation 的圖。

> **陷阱** 「multigraph」在兩套用語裡不一樣：一套允許 loop，另一套把有 loop 的叫 pseudograph。讀題先確認討論的是哪一種圖、名詞怎麼定義。

## Degree 與握手定理

**deg(v)**：與 v 相連（incident）的邊數。
- degree 0：**isolated**（孤立點）；degree 1：**pendant**（懸掛點）。
- 一個 **loop 對 degree 貢獻 2**。

> **陷阱** 一個 loop 讓 deg(v) 加 2，不是加 1。

> **例題** 6 個端點，degree 分別是 3、2、4、2、0、1（a 有一個 loop，算 2）。總和 3 + 2 + 4 + 2 + 0 + 1 = 12 = 2 × 6，圖有 6 條邊。
> 再一例（示意）：degree 1、2、3、3、1，總和 10 = 2 × 5 條邊。

**握手定理**：

```
Σ_{v∈V} deg(v) = 2|E|
```

證明：每條邊（包含 loop）對 degree 總和恰好貢獻 2——兩個端點各 1，loop 對同一點貢獻 2。

**推論（handshaking lemma）：奇數 degree 的端點一定有偶數個。**
1. 把 V 分成 V_O（degree 奇數）和 V_E（degree 偶數），是 V 的 partition。
2. Σ_{V_O} deg(v) + Σ_{V_E} deg(v) = 2|E|。右邊是偶數，V_E 的部分也是偶數 ⇒ V_O 的部分是偶數。
3. V_O 裡每一項都是奇數，奇數個奇數相加是奇數 ⇒ |V_O| 一定是偶數。

> **比喻** 派對上，人是端點、兩人握過手就連一條邊。「跟奇數個人握過手的人」一定有偶數個。

**有向圖**：in-degree deg⁻(v) = 進入 v 的邊數，out-degree deg⁺(v) = 從 v 出去的邊數，deg(v) = deg⁻(v) + deg⁺(v)。每條有向邊恰好給一個點 1 個入度、給一個點 1 個出度：

```
Σ deg⁻(v) = Σ deg⁺(v) = |E|
```

## 特殊的圖

**regular graph**：無向圖，所有端點 degree 相同；每點 degree 都是 r 叫 **r-regular**。

| 圖 | 定義 | 點數 | 邊數 | 備註 |
|---|---|---|---|---|
| Kₙ（complete graph） | 任兩個不同點恰一條邊 | n | C(n, 2) = n(n − 1)/2 | (n − 1)-regular |
| Cₙ（cycle，n ≥ 3） | n 點繞成一圈 | n | n | 2-regular；點數 = 邊數 |
| Wₙ（wheel） | Cₙ 加一個中心點連到每一點 | n + 1 | 2n | 外圈 n 條 + 輪輻 n 條 |
| Qₙ（n-cube） | 兩份 Qₙ₋₁ 對應點相連 | 2ⁿ | n·2ⁿ⁻¹ | n-regular |
| K_{m,n}（complete bipartite） | 兩堆之間所有配對都連 | m + n | m·n | |
| Petersen graph | 10 點、非常對稱 | 10 | 15 | 3-regular |

> **陷阱** Wₙ 有 n + 1 個點，不是 n 個：W₆ 有 7 點、12 邊。C₈ 有 8 點、8 條邊。

### n-cube Qₙ

遞迴定義：Q₀ 是單一點；Qₙ₊₁ = 兩份 Qₙ，再把對應的點兩兩連一條邊。（Qₙ 的點可以看成長度 n 的 bit string，只差一個 bit 的兩點相連。）

正式寫法：Q₀ = ({v₀}, ∅)；若 Qₙ = (V, E)，複製一份 (V′, E′)，則 Qₙ₊₁ 的點集 = V ∪ V′，邊集 = E ∪ E′ ∪ {{vᵢ, vᵢ′}}。

> **例題** 點數 aₙ = 2aₙ₋₁，a₀ = 1 ⇒ aₙ = 2ⁿ。
> 邊數：兩份各自的邊，加上新連的 2ⁿ⁻¹ 條：eₙ = 2eₙ₋₁ + 2ⁿ⁻¹，e₁ = 1。
> e₂ = 2·1 + 2 = 4、e₃ = 2·4 + 4 = 12、e₄ = 2·12 + 8 = 32，一般 eₙ = n·2ⁿ⁻¹（也可以用握手定理：2ⁿ 個點各 n 度，2ⁿ·n/2）。

### 二分圖

**bipartite graph**：點能分成兩堆，邊只在兩堆之間，同一堆內沒有邊。

> **例題** 邊 ab、bc、cd、de：分成 {a, c, e} 和 {b, d}，每條邊都跨兩堆，是二分圖。

**K_{m,n}**：兩堆分別 m、n 個點，所有跨堆的配對都連。K₂,₂ 有 4 條邊；K₂,₃ 有 5 個點、6 條邊。

### 子圖與聯集

- H 是 G 的**子圖**（subgraph）：H 本身是圖，且 V(H) ⊆ V(G)、E(H) ⊆ E(G)。
- 取了一條邊卻沒取它的端點，就不是圖，也不是子圖。
- **聯集** G₁ ∪ G₂ = (V₁ ∪ V₂, E₁ ∪ E₂)。

> **陷阱** 子圖裡每條邊的兩個端點都必須在子圖的點集合裡。

## Walk、trail、path

（名詞照一般教科書；各書叫法不完全統一。）

**walk**：有限的交替序列 v₀, e₁, v₁, e₂, …, eₙ, vₙ，其中 eᵢ 連接 vᵢ₋₁ 與 vᵢ。walk 沒有任何限制，點、邊都可以重複。
- **長度** = 經過的邊數 n（重複的也算）。
- 起點 = 終點叫 **closed walk**，否則叫 **open walk**。

更嚴格的走法：
- **trail**：邊不重複。closed trail 叫 **circuit**。
- **path**：點不重複（所以邊也不重複）。closed path 叫 **cycle**。

| 限制 | open | closed |
|---|---|---|
| 點、邊都可重複 | open walk | closed walk |
| 邊不重複 | trail | circuit |
| 點不重複 | path | cycle |

> **陷阱** 點不重複 ⇒ 邊一定不重複；但邊不重複不代表點不重複（trail 可以經過同一點兩次）。

## 連通分量與 connected

在無向圖 G = (V, E) 的點集上定義關係：u、v 之間有一條 path 就說它們有關係。這是**等價關係**：
- reflexive：自己到自己（長度 0 的 path）。
- symmetric：u 到 v 的 path 反過來就是 v 到 u。
- transitive：u 到 v、v 到 w 都有路，接起來 u 到 w 有路（接起來若有重複的點，把中間繞圈的部分剪掉仍是一條 path）。

等價關係產生 **equivalence classes**，它們是 V 的 partition：兩點在同一個 class ⇔ 它們之間有 path。

設分成 r 個 class V₁, …, V_r，令 Eᵢ = 兩端點都在 Vᵢ 的邊。不會有邊跨兩個 class（有這條邊，兩邊的點就有路相通，會落在同一個 class），所以 E₁, …, E_r 也是 E 的 partition。Gᵢ = (Vᵢ, Eᵢ) 叫做 G 的一個 **component**（連通分量）。簡單講：連在一起的那一整塊就是一個 component，不同 component 之間沒有連線。

> **例題** 圖中 1、2、3、4、5 五點連在一起，另一部分跟它們沒連 ⇒ 兩個 components。若全部連在一起，只有一個 component。

**connected graph**：只有一個 component 的圖。等價的定義：無向圖是 connected ⇔ 任兩個不同的點之間都有一條 path。後面常假設圖是 connected。

> **陷阱** connected 是「任兩點之間有 path」，不是「任兩點之間有邊」（那是 complete graph）。

## 圖的表示法

電腦裡存圖的方法：邊列表、adjacency list、adjacency matrix、incidence matrix。

### adjacency list

每個點列出它的鄰居。

> **例題** 無向圖：
> ```
> A: B, C
> B: A, C, E, F
> C: A, B, F
> D: （沒有鄰居，孤立點）
> E: B
> F: B, C
> ```
> 有向圖只記出去的邊：A → B；B → C, E；C → A, B。

### adjacency matrix（相鄰矩陣）

先固定點的順序，第 i 列第 j 行記錄點 i 與點 j 之間有沒有邊（有填 1、沒有填 0）；兩點間有兩條邊就填 2（multigraph）。

> **例題** 把上面的無向 adjacency list 寫成矩陣（順序 A～F）：
> ```
>     A B C D E F
> A [ 0 1 1 0 0 0 ]
> B [ 1 0 1 0 1 1 ]
> C [ 1 1 0 0 0 1 ]
> D [ 0 0 0 0 0 0 ]
> E [ 0 1 0 0 0 0 ]
> F [ 0 1 1 0 0 0 ]
> ```
> 每一列的和就是該點的 degree（B 是 4），全部加起來 = 2|E| = 12。

- 無向圖的 adjacency matrix 一定是對稱的方陣。
- 有向圖的不一定對稱，它就是那個 binary relation 的 0-1 矩陣。

> **陷阱** 無向圖的相鄰矩陣一定對稱；有向圖的不一定。

### incidence matrix

記錄「點」和「邊」是否 incident。一種寫法列是邊、行是點，每一列恰好兩個 1（一條邊兩個端點）；另一種寫法是它的轉置：列是點、行是邊，每一行兩個 1。

### Aᵏ 數 walk

- 用布林運算算 Aᵏ：(i, j) 元素是 1 ⇔ 從 i 到 j 有長度 k 的 walk。
- 用一般加法算：Aᵏ 的 (i, j) 元素 = 從 i 到 j 長度為 k 的 walk 個數。

> **例題**（示意）三角形 K₃（點 a、b、c 兩兩相連），A 的對角線是 0、其餘是 1。A² 的對角線是 2（a→b→a、a→c→a），非對角線是 1（a→c→b 是唯一長度 2 的 a 到 b 的 walk）。

> **陷阱** 一般加法下 Aᵏ 數的是 walk（點、邊可以重複），不只是 path。

## 圖的同構

兩個無向圖 G₁ = (V₁, E₁)、G₂ = (V₂, E₂) **isomorphic**（同構）⇔ 存在 bijection f : V₁ → V₂，使得

```
{a, b} ∈ E₁ ⇔ {f(a), f(b)} ∈ E₂
```

這個 f 叫 **isomorphism**。直覺：同一個圖，只是點的名字或畫法不同，所有數學性質都一樣，所以可以挑比較好處理的那個來討論。

> **陷阱** 條件是「若且唯若」：G₁ 有邊要對到 G₂ 有邊，沒有邊也要對到沒有邊。

### 證明同構：找出對應

> **例題** G₁：點 a、b、c、d，邊 ab、ad、bd、bc、cd。G₂：點 t、u、v、w，邊 tv、tu、vw、vu、wu，畫法看起來不一樣。
> 1. 必要條件：點數都是 4、邊數都是 5（但相同還不保證同構）。
> 2. 找對應 f：a → t、b → v、d → u、c → w。
> 3. 逐一檢查 5 條邊：ab → tv ✓、ad → tu ✓、bc → vw ✓、bd → vu ✓、cd → wu ✓，全部對上。
>
> 直覺上把 c 折過去、整張翻過來，兩張圖就長得一樣。

> **例題** 同一個二分圖的兩種畫法：G₁ 的點 a～e，G₂ 的點 x、y、z、s、t。f：a → x、b → s、c → y、d → t、e → z 是 bijection，且 {u, v} ∈ E₁ ⇔ {f(u), f(v)} ∈ E₂，所以同構。

> **例題** Petersen graph（10 點、15 邊、3-regular）和另一個同樣 10 點、15 邊、每點 3 度的圖同構，對應為 a→1、b→2、c→7、d→5、e→6、f→8、g→3、h→10、i→4、j→9。
> 手算技巧：先猜一點，例如 a → 1；那麼 a 的鄰居 e、f、b 必須對到 1 的鄰居 6、8、2；一路往外對，對不上再調整。判斷同構另外也有演算法。

> **陷阱** 點數、邊數相同只是必要條件，不是充分條件；一定要找到保持邊的對應才算證明同構。

### 證明不同構：找一個不變量不同

同構的圖所有性質都一樣，所以只要找到一個不同的性質（**invariant**，不變量）就證明不同構：點數、邊數、degree 序列、有沒有某種子圖（例如 K₅、四點兩兩相連）。

> **例題** 兩個圖都 5 個點，但一個 8 條邊、一個 7 條邊 ⇒ 不同構。（其他性質也不同：一個有四點兩兩相連，另一個少一條邊。）

> **例題**（示意）兩個圖都是 5 點 7 邊，但 degree 2 的點一個有 1 個、一個有 3 個 ⇒ 不同構。
> 反過來，degree 3、4、2 的點能兩兩對應時，可以試著對出同構。

> **陷阱** 不變量都一樣不代表同構；但有一個不變量不同就一定不同構。

同構的應用：化學分子的結構比對、電路圖（schematic）比對、偵測程式抄襲、bioinformatics、computer vision。

## 重點整理
- partial order = reflexive + antisymmetric + transitive；total order 任兩元素可比。
- Hasse 圖：擦自環、擦遞移邊、小下大上、拿掉箭頭。
- maximal ≠ greatest；有限非空 poset 必有 maximal、minimal。
- lattice：任兩元素都有 LUB 和 GLB。拓撲排序：反覆拿走一個 minimal。
- 無向邊 {u, v}、有向邊 (u, v)；simple：無多重邊、無 loop。
- loop 算 2 度；Σdeg(v) = 2|E|；奇數度點有偶數個；有向圖 Σdeg⁻ = Σdeg⁺ = |E|。
- Kₙ：n(n − 1)/2 邊、(n − 1)-regular；Cₙ：n 邊；Wₙ：n + 1 點、2n 邊；Qₙ：2ⁿ 點、n·2ⁿ⁻¹ 邊；K_{m,n}：m + n 點、mn 邊；Petersen：10 點 15 邊 3-regular。
- walk ⊇ trail（邊不重複）⊇ path（點不重複）；closed 版：closed walk、circuit、cycle。
- component = 「有 path」等價關係的等價類；connected = 一個 component = 任兩點有 path。
- 無向圖相鄰矩陣對稱；Aᵏ(i, j) = 長度 k 的 walk 數。
- 同構：保持相鄰的 bijection；不變量不同 ⇒ 不同構。

## 名詞對照
| 中文 | English |
|---|---|
| 偏序 | partial order |
| 偏序集 | poset (partially ordered set) |
| 全序 | total (linear) order |
| 字典順序 | lexicographic order |
| 哈斯圖 | Hasse diagram |
| 極大元素／最大元素 | maximal element / greatest element |
| 上界／最小上界 | upper bound / least upper bound |
| 格 | lattice |
| 拓撲排序 | topological sorting |
| 圖 | graph |
| 端點、節點 | vertex (vertices) |
| 邊 | edge |
| 有向圖 | directed graph (digraph) |
| 無向圖 | undirected graph |
| 相鄰 | adjacent |
| 關聯 | incident |
| 自環 | loop |
| 多重邊 | multiple edges |
| 簡單圖 | simple graph |
| 度數 | degree |
| 孤立點 | isolated vertex |
| 懸掛點 | pendant vertex |
| 入度／出度 | in-degree / out-degree |
| 握手引理 | handshaking lemma |
| 正則圖 | regular graph |
| 完全圖 | complete graph |
| 輪圖 | wheel |
| n 維立方體 | n-cube |
| 二分圖 | bipartite graph |
| 子圖 | subgraph |
| 走訪、行跡、路徑 | walk, trail, path |
| 迴路、圈 | circuit, cycle |
| 連通分量 | component |
| 連通圖 | connected graph |
| 相鄰矩陣 | adjacency matrix |
| 相鄰串列 | adjacency list |
| 關聯矩陣 | incidence matrix |
| 同構 | isomorphism |
| 不變量 | invariant |
