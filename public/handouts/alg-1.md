# 複雜度與遞迴

這一章是整門演算法的地基：先講清楚「演算法」是什麼、怎麼從一個實際問題走到一個證明過的演算法（以 stable matching 為例），再學怎麼「數」一個演算法要花多少時間——frequency count、漸近符號 O／Ω／Θ、函數成長率比較、best／worst／average case，以及遞迴式的三種解法（代換法、遞迴樹、Master Theorem）。後半用 peak finding、document distance、BST、hashing、table doubling 與 rolling hash，示範「分析」怎麼回頭指導「設計」。Time complexity 在各校都是必考，Master Theorem 和遞迴樹要能手算，不能只會套公式。

## 學完這章要會

- 說出演算法的五個特性（input、output、definiteness、finiteness、effectiveness），分辨演算法與程式、priori analysis 與 posteriori testing。
- 用 Gale–Shapley 解 stable matching，並會證明：最多 n² 輪會停、結果是 perfect、結果 stable、結果是 male-optimal。
- 用 frequency count 數出時間函數，並一眼判斷各種迴圈（i++、i*=2、p+=i、i*i<n、巢狀、前後相接）的複雜度。
- 寫出 O、Ω、Θ 的正式定義並用定義證明；用代數字、取 log、Stirling 公式比較函數成長率。
- 區分 best／worst／average case 與 O／Ω／Θ 是兩回事。
- 把遞迴程式寫成 T(n)，用代換法、遞迴樹、Master Theorem（遞減型與除法型）解出來，處理 T(√n) 這類需要換變數的式子。
- 理解資料結構如何決定 running time（Gale–Shapley 的 O(n²) 實作、Python 的 cost model、hashing 的 Θ(1 + α)、table doubling 的攤銷 O(1)、rolling hash 的 O(1) 操作）。

## 演算法是什麼

### 解題的第一步：抓出本質

遇到難題，第一眼常常只看到一團亂：線索散落一地、看不出結構。第一件事是抽絲剝繭，把跟問題真正有關、本質上的難處（essential part）萃取出來；一萃取出來，問題就變單純了。瑣碎的細節先放一邊，直接處理核心、設計演算法；核心解決之後，再用 generalization（推廣）或 extension（擴充）把方法擴大到能處理那些細節。能理出問題的頭緒，大概就成功一半了。學演算法與其說是背解法，不如說是學「釣魚的技巧」——訓練解決問題的思考方式。

### 定義

「algorithm」這個字來自 al-Khwārizmī（代數之父，寫了解一次、二次方程的書），algebra 與 algorithm 都源自他。演算法是整個 Computer Science 的核心，影響的領域早已不限於寫程式的人。不過演算法沒有一本書給出完全嚴謹的定義，只有大致的概念：

- **一般說法**：解決一個計算問題的 step-by-step procedure（一步一步的程序）。
- **Knuth**：演算法是一個 procedure，必須 **finite**（會停）、**definite**（明確）、**effective**（做得到），而且會產生 **output**。描述演算法前要先把問題講清楚：input 是什麼、希望的 output 是什麼。少數情況可以沒有 input，但 output 一定要有。
- **CLRS**（Introduction to Algorithms，取四位作者姓氏字首）：演算法是一個 well-defined（定義完整）的 procedure，把給定的 input 轉換成期待的 output。

真正「設計」一個演算法要做三件事，缺一不可：

1. 把 procedure 清楚寫下來。
2. 證明它正確。
3. 分析它的執行時間，給一個合理的 bound（上限）。

### 五個特性

| 特性 | 意思 | 例子 |
|---|---|---|
| Input | 開工前拿到的資料，**input ≥ 0** | 「印出 1 到 10」不需要 input |
| Output | 一定要有結果，**output ≥ 1** | `void show(){ printf("Hi"); }` 沒有參數、沒有回傳值，但印出 Hi 就是 output |
| Definiteness（明確性） | 每一句話都 unambiguous，只有一種解讀 | `x ← 4` 誰看都一樣；「把大的放前面」可能被讀成「整串排序」或「只搬最大的」，有歧義 |
| Finiteness（有限性） | 一定在有限步驟內停下 | `while(true)` 跑不完的不是演算法；10 行或 10000 行都可以，只要有限 |
| Effectiveness（有效性） | 每一步都能用紙筆在有限時間內做到 | 「直接猜出答案」不是有效步驟 |

- Definiteness 的另一個例子：√−1 在實數裡沒有值，把它當普通實數加減乘除，這一步就不明確。人都算不出來的敘述，不能要求電腦做。
- Finiteness 的反例：資料庫 server、Web server 只要沒人關就一直跑、一直接 request。這種東西叫 **service**，不是演算法；演算法是 procedure，做完一定要停。

> **陷阱** Effectiveness 有兩種說法。課本（Knuth、CLRS）的意思是「每一步都夠基本、能用紙筆在有限時間內做到」；另一種說法是「不寫多餘的敘述」，例如加總陣列的演算法裡寫了 `t ← 100`，t 之後完全沒用到，就是多餘的（拿掉它，A = [3, 5, 2] 照樣得到 s = 10）。考試以課本定義為準，但兩種說法都可能出現。同樣地，「每一步都已知、沒有魔法」有時被歸到 definiteness，課本則把「做得到」歸在 effectiveness、「意義唯一」才是 definiteness。

> **比喻** 演算法就像化學實驗、物理實驗或食譜：都需要 input（藥品器材、儀器、食材）；目的是得到結果（溶液、實驗結果、一道菜），至少一個 output；每一步都是已知、做得到的步驟，不能有一步寫「這裡變個魔術」；菜到某個時間點就煮好，一定會停（finiteness）；加熱了某個藥品卻沒加進溶液、切了蔬菜卻沒下鍋，都是多餘的步驟。

### 演算法 vs 程式

軟體開發生命週期（software development life cycle）最重要的兩個階段是 **design phase** 和 **implementation phase**。蓋房子不能用試錯法（蓋錯拆掉重蓋）；軟體容易刪了重寫，反而讓人感覺不到浪費。所以順序是先設計、再寫程式。設計時用類似英文、不管語法的句子先想清楚怎麼運作——這份設計就是演算法。

| | 演算法 | 程式 |
|---|---|---|
| 什麼時候寫 | design time | implementation time |
| 誰寫 | 有 domain knowledge（領域知識）的人，例如會計軟體找會計師、醫院系統找醫師或行政人員；programmer 懂該領域時可一人分飾兩角 | programmer |
| 用什麼語言 | 任何人看得懂的語言：類似英文的句子或數學符號（Σ 表加總、← 表存值），推薦數學符號，精簡不易誤會；條件是整個 programmer 團隊都讀得懂 | 程式語言（C、C++、Java、Python） |
| 跟硬體／OS | 無關（hardware independent、language independent） | 要先選定硬體與作業系統（Linux 或 Windows 寫法不同） |
| 怎麼檢驗 | **analyze**（priori analysis，事前分析） | **testing**（posteriori testing，事後測試） |

- **Priori analysis**：不用執行，用想的、用算的，得到時間函數和空間函數，例如 f(n) = 2n + 3（輸入大小 n 時要做幾步）。
- **Posteriori testing**：寫成程式在電腦上跑，量到的是牆鐘時間（幾秒、幾毫秒）和佔用多少 byte。同一個程式換台電腦，這台 3.2 ms、那台可能 5.1 ms。

> **重點** 考試要的時間複雜度，都是 priori analysis 得到的函數（像 2n + 3），不是實測秒數。

### 演算法的寫法

演算法沒有固定語法（no fixed syntax），清楚、大家看得懂就好。因為讀者至少都學過 C，常直接用 C 風格寫。以 Swap 為例：

```c
Algorithm Swap(a, b)
{
    temp = a;
    a = b;
    b = temp;
}
```

- 開頭寫 `Algorithm`，告訴讀者這不是要拿去編譯的程式。
- 參數不寫 data type（int、float 等到寫程式時才決定）；temp 不宣告就直接用。
- 大括號可改成 `begin … end`（Pascal 習慣），賦值可寫 `:=` 或箭頭 `←`（舊版 CLRS 用箭頭）。

> **重點** 考試寫 pseudocode 可依 CLRS 慣例（← 表示指定、陣列從 1 開始），不必拘泥 C 語法；重點是清楚、無歧義。另一套常用寫法：第一行替 procedure 取名（可在括號裡定義 input／output），**每一行都要編號**，討論時說「第三行」大家就知道是哪一步；可以用 while、for、if、else、return 等 keyword。一行 pseudocode 翻成 C 可能要好幾行，因為抽象層次拉高了。不要一開始就打開電腦寫程式：先證明正確、分析速度，最後才實作。

### 分析的準則

- **Time**：要花多久做完。我們要的是 time function（用 n 表示做幾步），不是手錶時間。
- **Space**：執行時用掉多少記憶體。
- 視需求加入其他準則：網路傳輸量（不必要的 10 MB 能否壓成 2 MB）、耗電量 power consumption（筆電、平板、手機）、寫 device driver 等系統程式時用了幾個 CPU register。

**Swap 的分析**：

- 時間：每個簡單敘述算 1 單位時間。三行各 1，f(n) = 3，常數。敘述再長也只算 1，例如 `x = 5*a + 6*b` 變成機器碼大約 4 個指令（兩個乘、一個加、一個存），但我們不細到機器碼。若某一行是呼叫另一個演算法，就不能算 1，要把那個演算法也分析進來。
- 空間：a、b 是參數，temp 是區域變數，每個變數 1 個 word，S(n) = 3，常數，寫成 O(1)（3 或 3000 都是 O(1)）。用 word 不用 byte，是因為寫演算法時還不知道型別。

> **比喻** 要分析多細看需求：開車去朋友家，發動就出發；要登陸火星，就得把每個小細節都規劃好。我們做的是 shallow analysis：每個敘述 1 單位、每個變數 1 word。

## 演算法課的地圖

學演算法會經過四站：

1. **簡介**：用 stable matching 示範演算法怎麼來；認識排程、配對、選點、遊戲等問題類型。
2. **Background**：拿到別人設計的演算法，能分析它——快不快、正不正確、會不會吃光記憶體（先懂遊戲規則）；以及 graph（點和連線，可表示道路、朋友關係、網路連線）。
3. **核心技巧**：
   - **Greedy algorithm（貪婪演算法）**：每一步拿眼前最好的（像先抓最大的硬幣）。簡單、快，但只有具備特殊性質的問題才保證最佳解。
   - **Divide and Conquer（各個擊破）**：拆成小問題分別解；最難的通常是把小答案整合回原問題的解。
   - **Dynamic Programming（DP，動態規劃）**：這裡的 programming 是 linear programming 那種「最佳化」的意思，不是寫程式。背景來自 divide and conquer，但有自己的特殊性質。修了演算法卻不會 DP，就不算修過演算法。
   - **Network Flow（網路流）**：想像水管裡的水或電線裡的電流，常用在資源分配。
4. **難題與對策**：NP-completeness；更難的 PSPACE-complete（常出現在 AI、game playing）。對策有 approximation algorithm（保證不低於某個水準，例如「不保證 100 分，但保證 90 分以上」，而且在合理時間內）、local search（從一個解往旁邊更好的解移動）、randomized algorithm（執行時引入隨機，例如隨機挑而非固定挑最左邊）。還有不會停的演算法（algorithms that run forever），與 finiteness 剛好相反，屬進階主題。

## 從問題到演算法：Stable Matching

設計演算法的流程：

1. 遇到一個 practical、非解決不可的問題。
2. **Formulate**：把問題描述清楚，萃取本質、清掉不重要的東西。定義問題往往是最難的一步（碩士學會 solving technique，博士要學會 define problem）。
3. 設計演算法，演算法本身也要乾淨。
4. 證明正確：一定吐出正確結果，或拿到最佳解。
5. 分析執行時間。能證明額外的好性質就是加分。

### 問題

想像你開交友公司，有 n 位男客戶、n 位女客戶。每個人都把對面 n 個人排名，這張表叫 **preference list（偏好清單）**，男女合計 2n 張。你要配出 n 對，條件：

1. 一對一，全部配完，沒人落單。
2. **Stable**：配完後不存在一對男女，彼此喜歡對方勝過被配給自己的人（否則他們會「劈腿」）。

**正式定義**：

- **Matching**：一對一的配對。**Perfect matching**：每個人都剛好配到一個對象。perfect 不是「幸福美滿」，只代表「大家都配完了」（有些問題不是每個人都配得到，全員配到已經很好）。
- **Unstable pair**：m 和 w 沒有配在一起，但 m 喜歡 w 勝過自己的配偶，w 也喜歡 m 勝過自己的配偶。
- **Stable matching**：perfect，而且沒有任何 unstable pair。
- **Stable matching problem**：給定 n 男 n 女的完整 preference list（不能平手），找出一個 stable matching（如果存在）。

Formulate 得更乾淨：男生編號 1..n、女生編號 1..n，每張 preference list 就只是一串數字（a sequence of numbers）。

> **例題** 三男 X、Y、Z，三女 A、B、C（左邊最喜歡）：
> ```
> X: A B C      A: Y X Z
> Y: B A C      B: X Y Z
> Z: A B C      C: X Y Z
> ```
> 隨便配：Z 先挑，拿最愛 A；Y 拿最愛 B；X 的 A、B 都被拿走，只好拿 C。
> 檢查 X–B：X 把 B 排第 2，勝過現在的 C（第 3）；B 最喜歡 X，勝過現在的 Y。兩人互相更喜歡對方 → unstable pair，配對不 stable。
> 其實還有另一對：X 最愛 A，而 A 的偏好 Y > X > Z，比起現在的 Z 更喜歡 X。不過找到一對就足以說不 stable。
> 換成 X–A、Y–B、Z–C：Z 想要 A 或 B，但 A、B 都比較喜歡現在的人，沒人跟他跑，這就 stable。

問題出在配對過程沒有照每個人的意願：X 根本沒機會去追他喜歡的人。

### 直覺法：隨便配，有 unstable 就 swap

1. 先隨便配一組。
2. 若有 unstable pair，就把那兩人 swap 配在一起，被拆散的人互配。
3. 重複直到沒有 unstable pair。

> **陷阱** 這方法不 valid。一次 swap 解掉一個 unstable pair，可能同時製造新的，一路換下去可能形成 cycle，繞一圈回到最初的配對，永遠停不下來，違反 finiteness。
> 例如偏好表 X: A>B>C、Y: B>A>C、Z: A>B>C；A: Y>Z>X、B: Z>Y>X、C: X>Y>Z，從 X–A、Y–B、Z–C 出發，swap 4 次就回到原配對。

### Gale–Shapley 演算法

1962 年 Gale 與 Shapley 提出，原則只有一個：每個人都盡量追求自己最大的利益。2012 年 Shapley 與把它用到各種經濟問題的 Roth 一起得到諾貝爾經濟學獎。

機制只有兩件事：**男生向女生 propose（求婚）**，每一圈一次求婚；**女生決定 accept 或 reject**。背後的概念叫 **deferred decision making**（把最後的決定延後）：女生 accept 只是當下的決定，「訂婚」可以毀約。每個人有三種狀態：free、engaged、married。

```
Gale-Shapley
1  所有人初始化為 free
2  while 存在一個 free 的男生 m，而且他還沒向所有女生求過婚
3      挑一個這樣的 m
4      w ← m 還沒求過婚的女生中，m 最喜歡的那位
5      if w 是 free
6          (m, w) 訂婚
7      else if w 喜歡 m 勝過她的未婚夫 m'
8          (m, w) 訂婚，m' 變回 free
       else
           w reject m（什麼都不變）
9  把所有 engaged 的配對轉成 married，輸出配對集合 S
```

女生面對求婚的三種 case：

1. **她是 free**：先 accept（可以反悔，不吃虧）。
2. **她已訂婚、但更喜歡新來的**：dump 掉未婚夫，改跟新人訂婚，舊未婚夫變回 free。
3. **她已訂婚、比較喜歡現在的未婚夫**：reject，什麼都不變，被拒的男生再向名單上下一位求婚。

> **例題** 2 男 2 女。m1 最喜歡 w1；m2 也向 w1 求婚；w1 喜歡 m2 勝過 m1。
> 1. m1 → w1：w1 free，接受。（m1, w1）
> 2. m2 → w1：w1 比較 m2 和 m1，比較喜歡 m2，甩掉 m1。（m2, w1），m1 free。
> 3. m1 → 第二志願 w2：w2 free，接受。（m1, w2）
> 4. 沒有 free 的男生，迴圈停，第 9 行輸出 S = {(m2, w1), (m1, w2)}。

> **例題** 5 男 V、W、X、Y、Z，5 女 A、B、C、D、E。照順序挑 free 的男生：V 向最愛 B 求婚，B free，接受；W 向最愛 D 求婚，D 接受；X 也最愛 B，B 最喜歡的就是 X，甩掉 V 改跟 X；V 找第二名 A，A 接受；Y 向 A 求婚，A 比較喜歡 V，拒絕 Y；Y 找下一位 D，D 喜歡 Y 勝過 W，甩掉 W……依此類推，有些男生被拒好多次。最後穩定：**V–A、W–C、X–B、Y–E、Z–D，一共 14 次求婚**。拿紙筆自己跑一遍，確認是 14 次。

### 兩個觀察

- **觀察 1**：男生求婚的順序一定從最喜歡往最不喜歡走（例如 Y 依序向 A、D、C、B、E 求婚，只往右走）。
- **觀察 2**：女生一旦 engaged 就再也不會回到 free；她只在更喜歡的人來求婚時換人，所以未婚夫只會越換越好（trade up），例如 D 依序是 W、Y、Z。

男生從最愛往下走、女生的未婚夫從不喜歡往上換，方向相反。後面所有證明都靠這兩個觀察。

> **觀念** Gale–Shapley 算 greedy 嗎？它有「大家先顧自己」的 greedy 味道，但不算 greedy algorithm。一般 greedy 每一步做完決定就鎖住、不反悔（因為能證明每一步選擇屬於最終最佳解，所以不會 revisit）；Gale–Shapley 的女生會推翻之前的決定。

### 證明一：最多 n² 輪一定停（termination）

while 的條件是「存在 free、還沒求完的男生」，但男生會在 free 與 engaged 間來回，很難數條件成立幾次。換角度：**每一輪恰好有一次求婚**。每個男生最多向 n 個女生各求一次（不會向同一個女生求兩次），n 個男生合計最多 **n² 次求婚**，所以最多 n² 輪。5 男 5 女有 25 格，demo 只用了 14 次，14 ≤ 25。

> **陷阱** n² 是最差情況的上限（upper bound），不是每次都跑滿。

演算法課最常用的證明招數有兩招：反證法（proof by contradiction）與數學歸納法（induction），這章只用反證法。

**反證法的固定步驟**：

1. 假設結論的反面 ¬P。
2. 一步一步合理推論（deduction）。
3. 推出矛盾（contradiction），例如同時得到「A 比 B 好」與「B 比 A 好」。
4. 推論每一步都合理，錯的只能是假設；所以 P 成立。

### 證明二：結果是 perfect matching

假設結束時有男生 Z 沒配到（還是 free）。迴圈停了，條件不成立；Z 是 free，唯一可能是 **Z 已向所有女生求過婚**。另一方面 n 男 n 女，有一個男生沒配到就至少有一個女生 E 沒配到。由觀察 2，女生被求過一次婚就永遠 engaged，E 還 free 表示**從沒人向 E 求婚**，Z 也沒有——與「Z 向所有女生求過婚」矛盾。所以結束時沒有 free 的男生，結果是 perfect matching。

> **重點** 每一步推論都要緊扣 procedure 的某一行，不能用 procedure 以外的理由。

### 證明三：結果是 stable

假設輸出 S 有 unstable pair：S 中 m–w、m′–w′，但 m 喜歡 w′ 勝過 w、w′ 喜歡 m 勝過 m′。m 最後停在 w，所以 w 是 m 最後一次求婚的對象。分兩種 case：

- **Case 1：m 從沒向 w′ 求婚**。男生從最愛往下求，還沒輪到 w′ 就停在 w，表示 m 喜歡 w 勝過 w′，與假設矛盾。
- **Case 2：m 曾向 w′ 求婚**。他最後沒跟 w′ 在一起，表示被 w′ 拒絕（當場拒絕或之後被甩）。女生拒絕一定是因為有更喜歡的人 m″。
  - 若 m″ = m′：w′ 喜歡 m′ 勝過 m，矛盾。
  - 若 m″ ≠ m′：女生只會越換越好，從 m″ 換到最後的 m′，所以 w′ 喜歡 m′ 勝過 m″ 勝過 m，矛盾。

兩種 case 都矛盾，S 一定 stable。直覺：就算你心裡有更喜歡的人，對方也沒更喜歡你，所以沒人想換。

### Stable matching 不唯一；male-optimal

同一組 input 可以有好幾個 stable matching。用前面三男三女的表：男生求婚跑 Gale–Shapley 得 X–A、Y–B、Z–C；改成女生向男生求婚，得 A–Y、B–X、C–Z，檢查也是 stable。

- **Valid partner**：若存在某個 stable matching 把 m 和 w 配在一起，w 就是 m 的 valid partner。通常排最前面的幾位不會是 valid，中間一段才是。
- **best(m)**：m 的 valid partner 中排名最前的那位。
- **S***：每個男生都配到 best(m) 的配對。

**定理**：Gale–Shapley（男生求婚）的輸出就是 S*，稱為 **male-optimal**。每個男生的 best(m) 唯一，所以**不管挑男生的順序怎樣，結果都一模一樣**（誰寫程式、哪台電腦，答案都相同）。

一個極端例子：男生都配到第一志願、女生都配到最後一名，仍可能 stable——女生雖然有更喜歡的人，對方卻沒更喜歡她。

證明演算法正確時的兩個原則：(1) 每個理由都要來自 procedure 的某一行；(2) 盡量用上所有已知條件（定義、procedure 的行為），不要浪費資訊。

**Male-optimal 的證明**（這章最不直覺的證明，要在執行 E 與另一個 stable matching S′ 之間來回切換）：

1. 假設某次執行 E 中有男生沒配到 best(m)。那他在 E 裡一定曾被某個 valid partner 拒絕（否則他從最愛一路求下來，一定會求到 best(m) 並留住她）。
2. 挑整個 E 中**第一次**有男生被 valid partner 拒絕的那一輪，被拒的男生叫 m。因為 best(m) 是 valid 裡排最前的，這次拒絕他的正是 w = best(m)。
3. w 拒絕 m 是因為更喜歡另一個 m′，所以 **w 喜歡 m′ 勝過 m**（結論 1）。
4. w 是 m 的 valid partner，存在 stable matching S′ 把 m 與 w 配在一起；S′ 中 m′ 配給某個 w′，w′ 是 m′ 的 valid partner。
5. 回到 E：m′ 與 w 訂婚的那一刻，還沒有任何人被 valid partner 拒絕過。m′ 由愛到不愛求婚，排在 w 前面的女生都拒絕過他，因此她們都是 invalid；w′ 是 valid 又不是 w，只能排在 w 後面，所以 **m′ 喜歡 w 勝過 w′**（結論 2）。
6. 在 S′ 中，m′ 與 w 互相更喜歡對方，S′ 不 stable，矛盾。所以每個男生都配到 best(m)。

### 對男生最好、對女生最差

誰主動求婚，誰就拿到 optimal。男生求婚的版本 male-optimal，女生則是 **pessimal**：每個女生配到她所有 valid partner 中最差的那一個。demo 中 X 配到第 1 志願 B，Y 卻配到第 5 志願 E。改成女生求婚，結果對稱變成 female-optimal。雙方都依自己在這個機制下的最大利益行動：男生從最喜歡的開始求；女生沒有更好的就先接受，有更好的就換。

**應用**：1962 年提出時解的就是大學入學分發；美國的醫學院畢業生分發到醫院實習，從 1950 年代就在用本質相同的方法（後來 Roth 證明了這件事）。每個系、每家醫院有名額 quota（many-to-one 的 deferred acceptance：系所保留名額內最喜歡的考生）。台灣大學入學分發本質上也是 Gale–Shapley 小幅修改：**考生是主動 propose 的「男生」**，系所只能接受或拒絕，名額滿了就退掉排最後的人，讓他改填下一志願。所以分發以考生的最大利益出發。

### Effective 與 efficient

- **Effective**：有效、答案對。答案是 yes／no 時，就是要證明演算法正確；之後還會談 solution quality（證明是最佳解）。
- **Efficient**：有效率——run time 短、memory 不用爆。

最後的建議：不要只看 procedure 第一行做什麼、第二行做什麼，要拿紙筆找個小例子親手跑一遍，才會發現沒想清楚的 gap。

## 五個代表性問題

| 問題 | 描述 | 例子的最佳解 | 難度與技巧 |
|---|---|---|---|
| Interval scheduling（區間排程） | 一台機器、一堆有固定開始與結束時間的工作，挑最多個互不 overlap 的 | 選 A、C、E 三個 | 簡單，greedy |
| Weighted interval scheduling（加權區間排程） | 每個工作有 weight（重要性或收益），讓 weight 總和最大 | 只選 B、D，5 + 5 = 10（選三個反而總和只有 3） | 簡單，DP |
| Bipartite matching（二分圖配對） | 左右兩群，有連線代表可以配；求配出最多對 maximum cardinality matching（cardinality 就是數量） | B–E、A–F、C–G、D–H 四對，剛好 perfect | 簡單，Network Flow |
| Independent set（獨立集） | 在 graph 中選最多個兩兩沒有連線的點 | 選 1 就不能選 2、3；最佳 {1, 4, 5, 6}（7 跟 4、5、6 都相連） | NP-complete |
| Competitive facility location（競爭式設施選址） | 一排有分數的棋子，兩人輪流拿，拿走一顆後它兩邊的鄰居都不能再拿，求自己積分最大 | 後手可保證 20 分，但無法保證 25 分 | PSPACE-complete（比 NP-complete 更難） |

> **觀念** 本質不同，解法就不同：interval scheduling 每個工作權重都是 1，選最多個就好；加了 weight，選得少總和反而可能更大。

## Frequency count：一行一行數

時間分析的基本工具：每個敘述執行一次算 1 單位，重複執行的敘述就數它總共執行幾次（frequency）。

### 陣列加總 Sum

```c
Algorithm Sum(A, n)
{
    s = 0;                    // 1
    for (i = 0; i < n; i++)   // n + 1
        s = s + A[i];         // n
    return s;                 // 1
}
```

for 的條件 `i < n` 被檢查 **n + 1 次**：以 n = 5 追蹤，i = 0..4 成立 5 次，i = 5 時 5 < 5 不成立再檢查 1 次，共 6 次。最後那次不成立也要算，因為電腦真的檢查了才知道要離開。（若把 i = 0 與每次 i++ 也分開算，會變成 2n + 2；習慣上 for 那一行就記 n + 1。）

合計 f(n) = 1 + (n + 1) + n + 1 = **2n + 3**，最高次 1，order of n，線性時間（linear）。一行只執行 1 次的演算法時間是 1，叫 constant（常數時間）。空間：A 佔 n 個 word，n、s、i 各 1，S(n) = n + 3，O(n)。

### 兩個 n×n 矩陣相加

```c
for (i = 0; i < n; i++)            // n + 1
    for (j = 0; j < n; j++)        // n(n + 1)
        C[i][j] = A[i][j] + B[i][j];   // n · n
```

外層條件 n + 1 次；外層裡每一行被帶著跑 n 次，內層 for 自己檢查 n + 1 次，所以 n(n + 1)；最內層 n² 次（3×3 就是 9 次）。f(n) = (n + 1) + n(n + 1) + n² = **2n² + 2n + 1**，O(n²)，quadratic（平方時間）。空間：A、B、C 各 n²，n、i、j 各 1，S(n) = 3n² + 3，O(n²)。

> **陷阱** 寫 O(n²) 不是說 f(n) 等於 n²，只是說最高次數是 2。

### 兩個 n×n 矩陣相乘

```c
for (i = 0; i < n; i++)                 // n + 1
    for (j = 0; j < n; j++) {           // n(n + 1)
        C[i][j] = 0;                    // n²
        for (k = 0; k < n; k++)         // n²(n + 1)
            C[i][j] = C[i][j] + A[i][k] * B[k][j];   // n³
    }
```

合計 (n + 1) + (n² + n) + n² + (n³ + n²) + n³ = **2n³ + 3n² + 2n + 1**，O(n³)，cubic（立方時間）；3×3 時最內層做 27 次。空間：三個矩陣各 n²，加 n、i、j、k，S(n) = 3n² + 4，O(n²)。

> **陷阱** 時間 O(n³)，空間仍是 O(n²)；時間和空間要分開算。迴圈每多包一層，次方就多 1（求和 O(n)、相加 O(n²)、相乘 O(n³)）。

## 各種迴圈的複雜度

寫 order 只看最高次，所以只要數迴圈本體 stmt 做幾次就好。

### 加減型

- `for (i = 0; i < n; i++) stmt;` → n 次，O(n)。
- `for (i = n; i > 0; i--) stmt;` → 也是 n 次，O(n)（從 1 走到 10 和從 10 走回 1 都是 10 步）。
- `for (i = 1; i < n; i += 2) stmt;` → n/2 次（n = 40 時 20 次），係數不寫，O(n)；`i += 20` 也只是 n/20，仍是 O(n)。
- 兩層都跑 n 的巢狀迴圈：n × n = n²，O(n²)。

### 內層 j < i：三角形

```c
for (i = 0; i < n; i++)
    for (j = 0; j < i; j++)
        stmt;
```

| i | j 跑過的值 | stmt 次數 |
|---|---|---|
| 0 | （0 < 0 不成立） | 0 |
| 1 | 0 | 1 |
| 2 | 0, 1 | 2 |
| 3 | 0, 1, 2 | 3 |
| … | … | … |
| n−1 | 0..n−2 | n−1 |

總數 0 + 1 + … + (n − 1) = n(n − 1)/2（n = 6 時 15 次）；常見寫法 1 + 2 + … + n = n(n + 1)/2 也一樣，展開都是 ½n² 加一次項，**O(n²)**。三角形大約是正方形的一半，但一半只是係數。

### p = p + i：條件看的是 p

```c
p = 0;
for (i = 1; p <= n; i++)
    p = p + i;
```

追蹤：第 1 圈 p = 1，第 2 圈 p = 1 + 2 = 3，第 3 圈 6，第 4 圈 10……跑 k 圈時 p = 1 + 2 + … + k = k(k + 1)/2。p > n 時停，k(k + 1)/2 > n，約 k²/2 > n，所以 k ≈ √(2n)，**O(√n)**。n = 25：p = 1, 3, 6, 10, 15, 21, 28，跑 7 次（√50 ≈ 7.07）。

> **陷阱** 條件不是 `i < n` 的時候，不能直接說 n 次，一定要追蹤變數怎麼變。

### 乘除型：log 次

```c
for (i = 1; i < n; i = i * 2)
    stmt;
```

i 依序是 1, 2, 2², 2³, …，跑 k 次後 i = 2ᵏ；i ≥ n 時停，令 2ᵏ = n，k = log₂ n，**O(log n)**。log₂ n 就是「2 要乘幾次才變成 n」。對照：加 1，加 k 次到 n，k = n；乘 2，2ᵏ = n，k = log₂ n。加是 n 次，乘是 log n 次。log 長得非常慢：n 一百萬也才約 20 次。

> **例題** log n 不是整數時要進位還是捨去？n = 8：i = 1, 2, 4 執行，i = 8 時 8 < 8 不成立，3 次 = log₂ 8。n = 10：i = 1, 2, 4, 8 執行，i = 16 停，4 次，而 log₂ 10 ≈ 3.32。所以次數是 **⌈log₂ n⌉**（無條件進位）。

- `for (i = n; i >= 1; i = i / 2)`：i 依序 n, n/2, n/2², …（n = 32：32、16、8、4、2、1），跑 k 次後 i = n/2ᵏ，令 n/2ᵏ = 1 得 k = log₂ n，O(log n)。整數除法裡 1/2 變成 0，就停了。`i = n; while (i > 1) i = i / 2;` 一樣 O(log n)。
- `for (i = 0; i * i < n; i++)`：i² ≥ n 時停（n = 25：i = 0..4 執行，i = 5 時 25 不小於 25），i ≈ √n，**O(√n)**。

### 前後相接的迴圈與 log log n

- 兩個獨立的 for 各跑 n 次，一前一後：n + n = 2n，**O(n)**。千萬別寫成 n²——巢狀才相乘，前後相接只相加。

```c
p = 0;
for (i = 1; i < n; i = i * 2)
    p++;                       // 跑 log n 次，結束時 p = log n
for (j = 1; j < p; j = j * 2)
    stmt;                      // 跑 log p 次
```

第二個迴圈跑 log p 次，而 p = log n，所以 stmt 做 **log log n** 次。n = 256：p = 8，第二個迴圈 j = 1, 2, 4 共 3 次 = log₂ 8。

### 外層 n、內層乘 2

```c
for (i = 0; i < n; i++)
    for (j = 1; j < n; j = j * 2)
        stmt;
```

外層 n 次，每次內層 log n 次（n = 8 時 j = 1, 2, 4，3 次；8 列共 24 次）。總共約 2n log n + n，最高項 n log n，**O(n log n)**。

### 迴圈總整理（以 n = 64 對照）

| 迴圈更新 | 次數 | 複雜度 |
|---|---|---|
| i++ | 64 | O(n) |
| i += 2 | 32 | O(n) |
| i--（從 n 往下） | 64 | O(n) |
| i *= 2 | 6 | O(log₂ n) |
| i *= 3 | ⌈log₃ 64⌉ = ⌈3.8⌉ = 4 | O(log₃ n) |
| i /= 2（從 n 往下） | 64, 32, 16, 8, 4, 2：6 | O(log₂ n) |

> **重點** 計數變數用加或減（每次 1、2、10、100 都一樣）→ O(n)；用乘或除 → O(log n)；條件比的是累加量（p += i、i*i < n）→ O(√n)。O 只寫最高次項、不寫係數（n²/2 就寫 n²）。

## while、do-while、if

### 各種迴圈

- C 有 for、while、do-while；for 和 while 可互換。
- Pascal 式 `for i := 1 to n do`：i 一次只加 1（要加 2 得寫 `step 2`），所以本體 n 次、條件 n + 1 次，一看就知道。
- **while** 的條件可以寫任何東西，true 就繼續、false 才停，一定要研究它什麼時候停。C 的 for 也很自由（初始化、條件、更新都能隨便寫），所以 C 的 for 也要當 while 研究，除非一眼看得出是 n 次。
- **do-while** 是 post-tested（先做再檢查），條件一開始就是 false 也會做 1 次；while 是 pre-tested，一次都不做。
- **repeat … until**：條件 false 就繼續、變成 true 才停（「重複做，直到某件事發生」）。和 do-while 一樣至少做 1 次，但條件意義相反：do-while 是 true 繼續，repeat-until 是 true 停止。

### while 的例子

> **例題** `i = 0; while (i < n) { stmt; i++; }`
> i = 0：1 次；條件 i < n：n + 1 次；stmt：n 次；i++：n 次。f(n) = 1 + (n + 1) + n + n = **3n + 2**，Θ(n)。
> 寫成 `for (i = 0; i < n; i++) stmt;` 把每部分都算，一樣 3n + 2；之前習慣省略 i = 0 和 i++ 記成 2n + 1，兩者都是 O(n)。

> **例題** `a = 1; while (a < b) { stmt; a = a * 2; }`
> a = 1, 2, 2², …，跑 k 次後 a = 2ᵏ；a ≥ b 時停，2ᵏ = b，k = log₂ b。把 b 叫做 n，就是 O(log n)。條件裡根本沒有 n，照樣要追蹤。

> **例題** `i = 1; k = 1; while (k < n) { stmt; k = k + i; i++; }`
> k 依序 1 → 2 → 4 → 7 → 11 → …（多加的量越來越大）。跑 m 次後 k = 1 + (1 + 2 + … + m) ≈ m(m + 1)/2。k ≥ n 時停，m² ≈ n，m ≈ √n，**O(√n)**。n = 20：k 到 22 才停，跑 6 次。和 p = p + i 是同一招。

> **例題** 用減法求 GCD：
> ```c
> while (m != n) {
>     if (m > n) m = m - n;
>     else       n = n - m;
> }
> ```
> m = 6、n = 3：6 − 3 = 3，相等，1 次，GCD = 3。m = n = 5：0 次。m = 16、n = 2：14、12、10、8、6、4、2，共 7 次，約 16/2。最壞是小的那個數是 1（16 和 1 要減 15 次），約 n 次。所以最少 O(1)、最多 O(n)。
> 注意這裡的 n 是數值本身的大小，不是輸入筆數。

### if 的影響

```c
Test(n) {
    if (n < 5) printf("%d", n);       // O(1)
    else for (i = 0; i < n; i++) printf("%d", i);   // O(n)
}
```

條件成立（n = 3）只做一個敘述，O(1)；不成立（n = 10）跑迴圈，O(n)。可以說快的一邊是 best case、慢的一邊是 worst case。

> **陷阱** 不是有 if 就一定有 best／worst case。若改成「n > 5 才跑迴圈，否則什麼都不做」，n 夠大時只有一種跑法。嚴格來說 best／worst case 是比較同樣大小 n 的不同輸入；這個例子的分支只看 n。

### Binary search 與遞迴函數

**Binary search**：i = 1、j = n 各 1 次；每圈取 mid = (i + j)/2，範圍砍半（n = 16：16、8、4、2、1），迴圈與裡面的敘述各 log n 次；if 和 else 每圈只走一邊，也只算 log n。粗算 f(n) = **3 log n + 2**，logarithmic（對數時間）。

**遞迴函數**沒有迴圈，就把它的時間寫成 T(n)：

```c
void Test(int n) {
    if (n > 0) {
        printf("%d", n);   // 1
        Test(n - 1);       // T(n-1)
        Test(n - 1);       // T(n-1)
    }
}
```

T(n) = 2T(n − 1) + 1。這種用自己表示自己的式子叫 **recurrence relation（遞迴式）**，解出來是 2ⁿ 量級（exponential，指數時間），解法在後面的遞迴式小節。迴圈靠數次數，遞迴要先寫成 T(n) 再解。

## 什麼叫「有效率」

### 好演算法的兩個條件

1. **正確**：輸出一定要對，靠 logical proof（反證法、直接推導）保證。答案錯了，跑再快也沒意義。
2. **Efficient**：對 resource 的需求少，分 time complexity（執行時間）與 space complexity（記憶體）。課程重點在 running time，而且看的是隨 input size 變大的「成長趨勢」，不是幾分幾秒。

Algorithm、Data Structure、Programming 是同一件事的三個面向：先在高層次設計演算法、用 logical proof 確認正確與時間合理，再配上合適的資料結構實作。資料結構配錯，別人跑得飛快你的卻很慢。

> **比喻** 好演算法配上合理的程式，沒有 90 分也有 85 分；爛演算法就算配上 100 分的 programmer，最多 70 分。演算法決定上限。

> **比喻** 19 世紀的 Babbage 最早提出「執行時間可以分析」。他設計的 difference engine 靠一次次加減法算數值，右邊有根搖桿（crank），每轉一圈機器動作一次。任務 A 轉 3 圈、任務 B 轉 8 圈，圈數就代表執行時間。（他一生想造的 Analytical Engine 沒有完成；後人照手稿造出的是 Difference Engine No. 2，在倫敦 Science Museum。）

### 三個逐步修正的定義

- **定義一**：寫成程式後，在 real input instance 上跑得快。→ 太模糊：快慢跟機器有關（超級電腦 vs 三年前的筆電），而且設計者不知道使用者會餵什麼資料。資料 100 筆時 A、B 兩支程式差不多，100 萬筆時 A 還跑得動、B 已跑不動——我們要的是 **scalability**（資料暴增時，時間只微微上升）。所以定義要與機器無關、與 instance 無關，而且能預測 n 變大時時間怎麼長。
- **定義二**：在 worst case 下，比 brute force（暴力法：把所有可能答案都試一遍再挑最好的）有本質上（qualitatively）更好的表現，並用可分析的 model 量化。→ 還沒照顧到 scalability。
- **定義三**：有 **polynomial running time** 的演算法就是 efficient。

**為什麼用 worst case？** 使用者可能拿各種奇怪資料「折磨」程式，大家都拿最差情況比最公平：最差都能接受，平常只會更好。Average case 要先知道所有 input 的機率分布，理論上通常不知道。（程式競賽用固定的 benchmark，才能在那組測資上取平均。）

**Input size** 的例子：stable matching 有 n 男 n 女，每人一張長度 n 的 preference list，input size = n×n + n×n = **2n²**。執行時間寫成 n 的函數 T(n)。

### Polynomial running time 與 primitive step

若存在常數 c > 0、d > 0，使執行時間上限 ≤ c·Nᵈ（N 為 input size），就說它有 polynomial running time。d = 1：資料多一倍時間多一倍；d = 2：二次成長；d = ½：√N，長得更慢。

c·Nᵈ 數的是 **primitive computational step**（基本計算步驟）。什麼算一步？

1. 一行組合語言指令算一步（RISC 大約一個 cycle）——但 procedure 比 C 還高階，這樣算不實際。
2. 標準程式語言的一行算一步，例如一次比較 a > b、一次指定 a = b + c。
3. 重點是：一步的刻度可以很大（對應 100 個 cycle 都沒關係），**只要這一步的工作量跟 input size 無關**。兩個 32-bit 整數相加算一步（每個數固定 32 bit）；但「把 n 個數加起來」要做 n − 1 次加法（n = 6 時 5 次），不是一步。工作量跟 n 有關，就要再切細。

**定義三的例外**：

- 6.02×10²³ × n²⁰ 形式上是 polynomial，但 c、d 大得誇張，實際不可行。設計演算法最好不超過 n²，真的不行 n² log n 勉強可以（例如 VLSI 晶片設計，資料量動輒百萬到 billion 等級）。
- 有些演算法 worst case 是指數（2ⁿ、3ⁿ），實際卻很好用，因為平常很少撞上最差情況，例如線性規劃的 Simplex method、Unix 用 regular expression 搜尋文字的 grep。

比較演算法時，還是以 worst-case 執行時間為準。

### Running time 對照表

假設機器每秒執行 10⁶ 個高階指令（very long 代表超過 10²⁵ 年）：

| n | n | n log n | n² | n³ | 1.5ⁿ | 2ⁿ | n! |
|---|---|---|---|---|---|---|---|
| 10 | < 1 秒 | < 1 秒 | < 1 秒 | < 1 秒 | < 1 秒 | < 1 秒 | 約 4 秒 |
| 30 | < 1 秒 | < 1 秒 | < 1 秒 | < 1 秒 | < 1 秒 | 約 18 分 | 約 8×10¹⁸ 年 |
| 50 | < 1 秒 | < 1 秒 | < 1 秒 | < 1 秒 | 約 11 分 | 約 36 年 | very long |
| 100 | < 1 秒 | < 1 秒 | < 1 秒 | 1 秒 | 約 12,900 年 | 約 4×10¹⁶ 年 | very long |
| 1,000 | < 1 秒 | < 1 秒 | 1 秒 | 約 17 分 | very long | very long | very long |
| 100,000 | < 1 秒 | 約 2 秒 | 約 3 小時 | 約 32 年 | very long | very long | very long |
| 1,000,000 | 1 秒 | 約 20 秒 | 約 12 天 | 約 31,710 年 | very long | very long | very long |

n log n 與 n² 在這個範圍都還等得下去；n³ 在 n = 10 萬時就要 32 年；1.5ⁿ、2ⁿ、n! 在 n 很小時就受不了。左邊能寫成 c·nᵈ 的是 polynomial，右邊是 non-polynomial（指數、階乘）。找得到 polynomial-time 演算法的問題算相對簡單，一直找不到的算相對困難。

## 漸近符號 O、Ω、Θ

### 為什麼只看最高次

精細地數出 1.62n² + 3.5n + 8 步太細了：n 一大，n² 那一項幾乎佔全部，所以只留最高次項，low-order terms 與係數都不理，說它「是 n² 的表現」。太細也沒意義：每個人切步驟的刻度不同，係數就不同，但次方不變（大家的刻度都與 n 無關）。所有被 n² 壓住的演算法可歸成同一個 class。這套理論叫 **asymptotic analysis（漸近分析）**，看的是演算法「本質上」的執行時間（intrinsic computational tractability）。little o、little ω 這裡不討論。

> **比喻** 把一個又長又醜的 g(x)（含 x^1.5·sin x 這種抖動項、主導項 1.1x²）畫在 0 到 200 的尺度，它抖來抖去跟 x² 不像；拉到 0 到 200,000，兩條線幾乎疊在一起。尺度越大，低次項造成的雜訊越看不到，所以 g(x) = Θ(x²)。

### 正式定義

T(n) 是 input size n 時的 worst-case 步驟數。

- **Big-O（上界，upper bound）**：存在常數 c > 0 與 n₀ ≥ 0，使所有 n ≥ n₀ 都有 T(n) ≤ c·f(n)，記作 T(n) = O(f(n))。
- **Big-Ω（下界，lower bound）**：存在 c > 0、n₀，使所有 n ≥ n₀ 都有 T(n) ≥ c·f(n)。
- **Θ（tight bound）**：存在 c₁、c₂ > 0、n₀，使所有 n ≥ n₀ 都有 c₁·f(n) ≤ T(n) ≤ c₂·f(n)。也就是 O 與 Ω 同時成立（係數可以不同）。

前面一小段沒壓住沒關係，n₀ 就是「從這裡開始」。極限的看法：若 lim T(n)/f(n) 是一個有限的正數，兩者互為 Θ；趨近 0 或 ∞ 就不是 Θ。漸近分析在數學上就是極限分析。

> **陷阱** Ω 是 T(n) 在上、c·f(n) 在下，別把不等號寫反。Θ 有時被口語叫 average bound，但它和 average case 完全無關，叫 tight bound 比較不會搞混。

### 用定義證明：找 c 與 n₀

> **例題** f(n) = 2n + 3。
> - **O**：把每一項都放大成 n 的倍數：2n + 3 ≤ 2n + 3n = 5n，n ≥ 1 成立（n = 1 時兩邊都是 5），c = 5、n₀ = 1，f(n) = O(n)。寫 10n 也行（n = 1 時 10 ≥ 5）。同法 2n + 3 ≤ 2n² + 3n² = 5n²，所以 O(n²) 也對。
> - **Ω**：2n + 3 ≥ 1·n，n ≥ 1 成立，c = 1，f(n) = Ω(n)；2n + 3 ≥ log n 也成立，所以 Ω(log n) 也對。
> - **Θ**：1·n ≤ 2n + 3 ≤ 5n，n ≥ 1，所以 f(n) = Θ(n)。不能說 Θ(n²)：下界 c₁·n² 不管 c₁ 多小（例如 0.25），n 夠大都會超過 f(n)。也不能說 Θ(log n)：上界 c₂·log n 蓋不住 2n + 3。
> - f(n) = O(log n) 是錯的，Ω(n²) 也是錯的。

> **例題** f(n) = 2n² + 3n + 4：3n ≤ 3n²、4 ≤ 4n²（n ≥ 1），所以 f(n) ≤ 9n²，c = 9、n₀ = 1，O(n²)；後面兩項都是正的，f(n) ≥ 1·n²，Ω(n²)；合起來 Θ(n²)。（同招用在 2n² + 3n + 1 得 6n²。）求 Θ 就是把 O 和 Ω 的結果湊在一起。

> **例題** f(n) = n² log n + n：n² log n + n ≤ 10·n² log n（n 夠大），且 ≥ 1·n² log n，所以 O、Ω、Θ(n² log n) 都成立。n² log n 不在常用類別表上，它比 n² 大、比 n³ 小，自成一類。

> **例題** 也可以用指數當上界：2n² + 3n + 1 的每一項換成 2ⁿ，n 夠大時 ≤ 6·2ⁿ，所以 O(2ⁿ)。對，但沒用。

### 上界有很多，要寫最接近的

把類別排成一條階梯：1 < log n < √n < n < n log n < n² < n³ < … < 2ⁿ < 3ⁿ < … < nⁿ。2n + 3 屬於 n 這一格：n 與它右邊所有類別都是上界，n 與它左邊所有類別都是下界，n 自己是 tight bound。所以 O(n)、O(n²)、O(2ⁿ) 都對，但要寫最接近的 O(n)；Ω 也要寫最接近的 Ω(n)。能寫 Θ 就寫 Θ，寫不出來才用 O 或 Ω。捷徑：看最高次項（2n² + 3n + 2 在 n² 格，n + 5 在 n 格）。

> **比喻** 問一支手機大概多少錢：「大約 20,000」最有用（Θ）；「最少 18、19 千，最多 21、24 千」也還接近；「最少 2,000」沒錯但沒用（太遠的 Ω）；「最多 10 萬、20 萬」也沒錯但沒意義（太遠的 O）。

> **例題** T(n) = 1.62n² + 3.5n + 8，判斷九題（n、n²、n³ 各問 O、Ω、Θ）：
> - O(n)：No，c·n 最後會被 1.62n² 超過。O(n²)：Yes（c = 2，n₀ = 12）。O(n³)：Yes，但不夠 tight。
> - Ω(n)：Yes。Ω(n²)：Yes（c = 1）。Ω(n³)：No，c·n³ 最後一定超過 T(n)。
> - Θ 要上下同時成立，只有 Θ(n²) 成立。
>
> c = 2 時：n = 11，T(11) = 196.02 + 38.5 + 8 = 242.52 > 2·121 = 242；n = 12，T(12) = 233.28 + 42 + 8 = 283.28 ≤ 288，從 n₀ = 12 起成立。寫作業要寫出 c 和 n₀，不能只答 yes／no。分析結果越接近真實越好：別人的演算法是 n²，說它 n³ 人家會生氣。

> **陷阱** O、Ω、Θ 只是描述「函數的界」，跟 best／worst case 無關。很多人以為 O 就是 worst case、Ω 就是 best case，這是錯的；任何 case 都能用任何符號。

### O 與 Θ 的差別什麼時候重要

- Θ 的上下界只能差常數倍，例如 g(x) 主導項 1.1x²，x 夠大時夾在 x² 與 1.2x² 之間。很多講義寫 O，實際上多半指 Θ。
- **g(x) = x(1 + sin x)**：sin x = −1 時 g = 0，會無限多次碰到 0，找不到像樣的下界；但 g ≤ 2x。只能寫 **g(x) = O(x)**——這才是 O 真正的意思：只保證不會更大。實務上很在乎上界：搜尋引擎要在 200 毫秒內回應，慢到 400 毫秒就會流失使用者。
- **g(x) = (1 + sin x)·x^1.5 + x^1.4**：1 + sin x ≥ 0，所以 g ≥ x^1.4；1 + sin x ≤ 2，所以 g ≤ 2x^1.5 + x^1.4 ≤ 3x^1.5。上下界差在指數，不是常數倍，**沒有 Θ**，只能說 g = Ω(x^1.4)、g = O(x^1.5)。也不能寫 Θ(x^1.5)，因為 g 會無限多次掉回 x^1.4。
- 實用自我檢查：這門課遇到的執行時間幾乎就是 1、log n、n、n log n、n² 這幾種；解遞迴式算出很怪的東西，多半是算錯了。

### 等號其實是「屬於」

f(n) = 5n³、g(n) = 3n²，兩者都是 O(n³)。若真的是「等於」，就推出 f = g，顯然不對。O(n³) 是所有被 n³ 壓住的函數的**集合**，正確寫法是 f(n) ∈ O(n³)；寫等號是數學上對等號的 abuse，讀作 is。（「亞里斯多德是人」對，「人是亞里斯多德」就不對。）證明時要 by definition 找出 c 與 n₀。

### 性質

| 性質 | 內容 | 適用 |
|---|---|---|
| 乘常數 | f = O(g) ⇒ a·f = O(g)。例：f = 2n² + 5 是 O(n²)，7f = 14n² + 35 仍是 O(n²) | O、Ω、Θ |
| Transitivity（遞移性） | f = O(g)、g = O(h) ⇒ f = O(h)。例：n = O(n²)、n² = O(n³) ⇒ n = O(n³) | O、Ω、Θ |
| Transpose symmetry（轉置對稱） | f = O(g) ⇔ g = Ω(f)。例：n = O(n²) ⇔ n² = Ω(n) | O 與 Ω |
| Reflexivity（反身性） | f = O(f)、f = Ω(f)、f = Θ(f)（不等式含等號） | O、Ω、Θ |
| Symmetry（對稱性） | f = Θ(g) ⇔ g = Θ(f) | 只有 Θ |
| 夾擠 | f = O(g) 且 f = Ω(g) ⇒ f = Θ(g) | |
| Rule of sums | f = O(g)、d = O(e) ⇒ f + d = O(max(g, e))。例：n + n² = O(n²) | |
| Rule of products | f₁ = O(g₁)、f₂ = O(g₂) ⇒ f₁·f₂ = O(g₁·g₂)。例：n·n² = O(n³) | |

> **陷阱** O 沒有對稱性：n = O(n²)，但 n² ≠ O(n)。

- **Rule of sums** 用在一行一行加總：O(1) + O(n) + O(n²) + O(n) = O(n²)。整體被最慢的那一步（bottleneck，瓶頸）綁住。
- **Rule of products** 用在迴圈：時間 = 圈數 × 每圈工作量（5 圈、每圈 3 件事 = 15）。

## 函數的類別與比大小

### 類別名稱

| 類別 | 名稱 | 例子 |
|---|---|---|
| 1 | constant（常數；2、5、5000 都算，跟 n 無關） | Swap |
| log n | logarithmic（底數 2 或 3 都同一類） | binary search |
| √n = n^0.5 | sublinear（次線性） | |
| n | linear（2n + 3、500n + 700、n/5000 + 6 都是） | linear search |
| n log n | loglinear | merge sort |
| n² | quadratic | 矩陣相加 |
| n³ | cubic | 矩陣相乘 |
| n⁴ | quartic | |
| 2ⁿ、3ⁿ、4ⁿ | exponential | 河內塔 |
| n! | factorial | |
| nⁿ | （比階乘更大） | |

polynomial 指 n 的常數次方；n¹⁰⁰ 甚至 n 的一千萬次方理論上仍是 polynomial，只是根本不能用。實作上盡量壓在 n² 以下。

**由小到大**：1 < log n < √n < n < n log n < n² < n³ < … < n¹⁰⁰ < 2ⁿ < 3ⁿ < nⁿ。

> **例題** 代數字驗證 log n、n、n²、2ⁿ：
> - n = 1：0、1、1、2
> - n = 2：1、2、4、4
> - n = 4：2、4、16、16
> - n = 8：3、8、64、256
> - n = 9：約 3.17、9、81、512
>
> n 小時可能忽大忽小甚至相等（n = 2、4 時 n² = 2ⁿ），但過了某個 n 之後 2ⁿ 永遠較大。n 從 8 到 9，n² 只多 17，2ⁿ 直接翻倍。

> **陷阱** n¹⁰⁰ 也輸給 2ⁿ。n = 10 時 n¹⁰⁰ = 10¹⁰⁰ 遠大於 1024，但比大小看的是 n 很大以後：交點約在 n ≈ 996，之後 2ⁿ 永遠較大。

### 比較兩個函數的方法

1. **代數字**：n² 對 n³，代 n = 2、3、4 得 4／8、9／27、16／64。函數一複雜就不可靠。
2. **兩邊取 log**：log 是遞增函數，大小關係不變，式子卻變簡單。log n² = 2 log n、log n³ = 3 log n，所以 n² < n³。
3. **用 log 公式化簡**（不一定要兩邊取 log）。

常用 log 公式（沒寫底數一律以 2 為底；lg 是 log₂ 的縮寫）：

1. log(ab) = log a + log b
2. log(a/b) = log a − log b
3. log aᵇ = b·log a（最常用）
4. a^(log_c b) = b^(log_c a)（次方裡有 log 時，a、b 可對調）
5. aᵇ = n ⇔ b = log_a n

> **陷阱** 直接比原函數時係數可以丟（2n 與 3n 都是 Θ(n)）；**取了 log 之後係數就不能丟**。2ⁿ 對 2²ⁿ：取 log 得 n 對 2n，差 2 倍代表原函數差了 2ⁿ 倍——2²ⁿ = 4ⁿ，比 2ⁿ 大得多。取 log 後若只差常數倍，原函數仍可能不同階。

### 化簡成 Θ 的練習

| f(n) | 化簡 | Θ |
|---|---|---|
| 10⁸⁰ | 跟 n 無關（約宇宙原子數） | Θ(1) |
| (20n)⁷ | 20⁷·n⁷ | Θ(n⁷) |
| log(n¹⁰⁰) | 100 log n | Θ(log n) |
| log₅ n | log n / log 5 | Θ(log n) |
| log(log₁₀₀ n) | 底數只差常數倍 | Θ(log log n) |
| log₅(log n¹⁰⁰) | log(100 log n) = log 100 + log log n | Θ(log log n) |

log 裡的指數、log 的底數，都只變成常數倍。電腦科學的「自然」底數是 2（一個 bit 只有兩種值），所以 log n 預設 log₂ n。

### 比大小的例題

> **例題** n² log n 對 n(log n)¹⁰：取 log，左邊 2 log n + log log n，右邊 log n + 10 log log n。先比最大項：2 log n > log n，log log n 小太多（像 2 塊多對 1 塊多，零錢不影響輸贏）。**n² log n 較大**。

> **例題** 3·n^√n 對 2^(√n·log n)：√n·log n = log(n^√n)，所以 g = 2^(log n^√n) = (n^√n)^(log 2) = n^√n（公式 3 反用、再用公式 4）。只差係數 3，**f = Θ(g)**。

> **例題** n^(log n) 對 2^√n：取 log 得 log² n 對 √n，還看不出來；再取一次 log 得 2 log log n 對 ½ log n，右邊大。**2^√n 較大**。一次不夠就取兩次。

> **例題** 2^(log n) 對 n^√n：取 log 得 log n 對 √n·log n，左邊小。其實 2^(log n) = n^(log 2) = n。

> **例題** 依成長率排序 f₁ = n^(1/3)、f₂ = lg n、f₃ = 2^√(lg n)。令 z = lg n，取 lg：lg f₁ = z/3（一次）、lg f₂ = lg z（log）、lg f₃ = √z（sublinear）。由小到大 **lg n < 2^√(lg n) < n^(1/3)**。這題取 log 後是「不同等級」，結論才穩。

> **例題** 分段函數：g₁ 在 n < 100 時是 n³、n ≥ 100 時是 n²；g₂ 在 n ≤ 10,000 時是 n²、之後是 n³。n < 100 時 g₁ 大；100 到 10,000 一樣大；超過 10,000 後 g₂ 永遠大，所以 **g₁ = O(g₂)**。比函數不看小的 n，這就是定義中 n₀ 的意思。

> **例題** 是非題：
> 1. (n + k)ᵐ = Θ(nᵐ)：對，二項式展開最高項 nᵐ（例：(n + 3)² = n² + 6n + 9）。
> 2. 2ⁿ⁺¹ = O(2ⁿ)：對，2ⁿ⁺¹ = 2·2ⁿ。
> 3. 2²ⁿ = O(2ⁿ)：錯，2²ⁿ = 4ⁿ。
> 4. √(log n) = O(log log n)：錯，取 log 得 ½ log log n 對 log log log n，右邊更小。
> 5. n^(log n) = O(2ⁿ)：對，取 log 得 log² n 對 n。

### 階乘

- **n!**：每個因數換成 n，n! ≤ nⁿ，O(nⁿ)；每個因數換成 1，n! ≥ 1，Ω(1)。也有 n! ≥ n log n，所以 Ω(n log n)、Ω(n) 都是正確下界。在常用類別表上找不到 n! 的 Θ；但 Stirling 公式給出 n! = Θ(√n·(n/e)ⁿ)。
- **log n!**：上界 log n! ≤ log nⁿ = n log n。下界：後半 n/2 個因數都 ≥ n/2，所以 log n! ≥ (n/2)·log(n/2)，也是 n log n 等級。**log n! = Θ(n log n)**，考試很愛考。
- **Stirling 近似**：n! ≈ √(2πn)·(n/e)ⁿ，階乘長得跟指數一樣快。
- **log C(n, n/2)**：C(n, n/2) = n! / ((n/2)!·(n/2)!)。分子 (n/e)ⁿ，分母兩個 (n/2e)^(n/2) 相乘是 (n/2e)ⁿ，相除剛好 2ⁿ；根號部分約一約，C(n, n/2) ≈ 2ⁿ/√(πn/2)。取 log 得 n − ½ log n + 常數，**Θ(n)**。

> **陷阱** 每個因數換成 log n 得到的是 (log n)ⁿ，不是 n log n；不過 n! ≥ n log n 本身成立。

> **例題** 依成長率排序 n⁴、C(n, 3)、n + log⁴ n、n^(log n)、2ⁿ、C(n, n/2)：
> - C(n, 3) = n(n−1)(n−2)/6，Θ(n³)；n + log⁴ n 是 Θ(n)（log n 不管幾次方都比不過 n）。
> - n^(log n) 對 2ⁿ：取 log 得 log² n 對 n，2ⁿ 大。
> - C(n, n/2) ≈ 2ⁿ/√n，取 log 是 n − ½ log n，比 log² n 大、比 n 小。
> - 結果：**n + log⁴ n < C(n, 3) < n⁴ < n^(log n) < C(n, n/2) < 2ⁿ**。

## Best、worst、average case

同一個演算法、同樣大小 n，不同輸入跑的時間不同。

### Linear search

陣列（index 從 0 開始）：

```
index: 0  1  2   3  4  5  6  7  8   9
value: 8  6  12  5  9  7  4  3  16  18
```

- 找 key = 7：從左一個一個比，在 index 5 找到，比 6 次（成功搜尋）。找 20：全部比完都沒有（失敗搜尋）。
- **Best case**：key 在第一格（找 8），B(n) = 1。
- **Worst case**：key 在最後一格（找 18），W(n) = n。
- **Average case**：所有情況的時間總和 ÷ 情況數。key 在第 i 格要比 i 次，平均 (1 + 2 + … + n)/n = n(n + 1)/2 ÷ n = **(n + 1)/2**（n = 10 時 5.5 次）。平均通常難算（要列出所有情況與分布），而且常跟 worst case 同階，所以多半直接分析 worst case。這裡的時間都以比較次數計。

> **重點** Case 和符號是兩回事。B(n) = 1 可以寫 O(1)、Ω(1)、Θ(1)；W(n) = n 可以寫 O(n)、Ω(n)、Θ(n)；average (n + 1)/2 也三種都能寫。

### BST 搜尋

Binary search tree：每個節點左邊都比它小、右邊都比它大。

```
平衡的 BST（高度約 log n）        左斜 BST（left skewed，高度 n）
          20                              40
        /    \                           /
      10      30                       30
     /  \    /  \                     /
    5   15  25  40                  25
                                   /
                                 20
                                /
                              15
                             /
                           10
                          /
                         5
```

- 找 15（平衡樹）：20 → 15 < 20 往左到 10 → 15 > 10 往右找到，比 3 次 = 樹高（7 個元素，log₂ 8 = 3）。
- Best case：找 root，B(n) = 1。Worst case：找 leaf（5、15、25、40），W(n) = 樹高。
- 同樣 7 個數建成左斜樹，worst case 找 5 要比 n 次。
- 所以 BST 的 worst case 寫成樹高 h 最準確：**log n ≤ h ≤ n**，minimum worst case 是 log n、maximum worst case 是 n。考試很愛問 minimum／maximum worst case time。（嚴格說平衡 BST 高度是 ⌊log₂ n⌋ + 1 層，漸近上是 log n。）

## 實作 Gale–Shapley：資料結構決定 running time

我們只證過 while 最多 n² 圈；圈數還不等於執行時間。用 rule of sums 把演算法切三段：line 1（全部設成 free）O(n)、while 迴圈、line 9（輸出配對，過程中記好每個男生配誰，掃一遍）O(n)。依 rule of products，while 的時間 = n² 圈 × 每圈工作量。**只要每一圈是 O(1)，整體就是 O(n²)**。

每一圈裡，訂婚、改回 free 都只是簡單指定，真正麻煩的是四件事：

1. **line 2**：判斷還有沒有 free 的男生，並馬上拿出一個（拿誰都可以，反正結果一樣）。
2. **line 3**：找出他還沒求過的女生中排名最高的那位。
3. **line 4**：判斷女生是不是 free；若已訂婚，未婚夫是誰。
4. **line 6**：女生比較來求婚的 m 和未婚夫 m′，比較喜歡誰。

**表示法**：不記名字，男生編 1..n、女生編 1..n（兩邊不混用，不必把女生編成 n+1..2n）。每個男生掛一個長度 n 的 array 存 preference list，例如 1 號男生最喜歡 Amy、Bertha、Clare（1、2、3 號）就記成 1 2 3。

| 工作 | 資料結構 | 做法 | 時間 |
|---|---|---|---|
| line 2 free 男生 | **linked list**（free 人數會一直變，不適合固定大小的 static array；preference list 長度固定 n，才適合 array） | first 指向 NULL 表示沒人了；取出：拿第一筆，first 改指向第二筆（借第一筆的 next）；被甩的男生插回最前面：他的 next 指向原本 first 所指，first 改指向他 | O(1) |
| line 3 下一個求婚對象 | 每個男生一個欄位 **Next**，記下一個要求婚的是第幾名 | 初始全設 1（O(n)）；每次求婚後不論成敗 Next 加 1（男生從排名高往下求，不會跳回去） | O(1) |
| line 4 女生狀態 | 每個女生一個欄位 **Current**，記目前未婚夫編號 | 初始填 0（不是 1..n 的值都可）；例：女 1–男 1、女 2–男 3、女 3 free，Current = 1, 3, 0 | O(1) |
| line 6 比較兩個男生 | 每個女生一個 **Ranking array**：第 m 格存「m 號男生排第幾名」 | 直接 indexing 查兩人名次再比 | O(1) |

> **例題** line 6 若直接掃女生的 preference list：1 號女生與 6 號訂婚（6 號排第 5），1 號男生來求婚（排第 2）。要知道 6 號排第幾得一格一格掃到第 5 格，1 號再掃到第 2 格；來的人排最後就要掃完整份，worst case O(n)，整體變成 n² × O(n) = **O(n³)**。
> 反過來存：1 號女生的清單是 `3 1 4 5 6 2`（第 1 名 3 號、第 2 名 1 號……），Ranking 就是 `2 6 1 3 4 5`（1 號排第 2、2 號排第 6、3 號排第 1……）。資訊完全一樣，只是換方向。未婚夫 6 號 → Ranking[6] = 5；1 號求婚 → Ranking[1] = 2；2 < 5，她接受，O(1)。
> 建 Ranking 是 preprocess：邊掃清單邊填（3 號排第 1，就到第 3 格寫 1；1 號排第 2，就到第 1 格寫 2……），每個女生 O(n)，n 個女生 O(n²)，只做一次。

**總時間**：初始化 O(n²) + line 1、9 各 O(n) + n² 圈 × O(1) = **O(n²)**。

> **重點** 同一個 procedure，不同人寫成程式，執行時間可能差很多（O(n³) vs O(n²)），差在資料結構。沒有絕對好的資料結構（linked list 不一定贏 array，反之亦然），要看演算法要做哪些 operation。寫程式前先知道演算法本質上的執行時間；為了讓操作變快，可以先 preprocessing（像建 Ranking），前提是前處理的代價承受得起。

## Model of computation 與 Python 的 cost

演算法是電腦程式在數學世界的對應物（analog），用 pseudocode（有結構、讓人能推理的英文）寫；電腦的對應物是 **model of computation（計算模型）**，規定兩件事：能做哪些操作、每個操作的 cost。running time 就是所有操作的 cost 加總。

### Random access machine（RAM）

- 記憶體是一個巨大的 array，以 word 為單位，編號 0、1、2… 就是 address；知道 address 就能直接跳過去（random access）。
- 常數時間內可以 load 常數個 word 到暫存器、對暫存器做常數次運算（例如 r3 = r1 + r2）、再 store 回去。暫存器只有常數個——就像寫 assembly，不管 cache 的話是很準的模型。
- 一個 word 有 w 個 bits（通常 32 或 64），且 w ≥ log（記憶體大小），才裝得下任何位址。通常把每個輸入數字當成一個 word，所以比較兩個 word 是 Θ(1)。

### Pointer machine

- 對應簡化的物件導向：可以動態配置 object，每個 object 只有常數個 field，field 裝一個 word 或一個 pointer（指向另一個 object 或 null，Python 的 None）。
- 例：doubly linked list，每個 node 有 prev、value、next；第一個的 prev 與最後一個的 next 是 null；手上有一個 head pointer（就是 Gale–Shapley 的 first）。
- `x = x.next` 走到下一個 node、改一個欄位都是常數時間；不能對 pointer 做加法。
- RAM 可以模擬 pointer machine（pointer 換成大表格的 index），所以 pointer machine 比較弱。

### Python 操作的 cost

| 操作 | 時間 | 說明 |
|---|---|---|
| `L[i] = L[j] + 5` | O(1) | Python 的 list 是 **array**，不是 linked list（Scheme 的 list 才是） |
| `x = x.next`（object 有常數個 attribute） | O(1) | |
| `L.append(x)` | O(1)（攤銷） | 用 table doubling 預留空位 |
| `L1 + L2` | O(1 + len(L1) + len(L2)) | 非破壞性，要建新 list、全部複製；那個 1 是兩邊都空時建空 list 的時間 |
| `L1.extend(L2)` | O(1 + len(L2)) | 直接改 L1，只跟 L2 長度有關 |
| `x in L` | O(n) | 沒排序，最壞從頭比到尾；若 == 本身很貴，再乘上比較成本 |
| `len(L)` | O(1) | list 內建計數器 |
| `L.sort()` | O(n log n) | 乘上比較兩元素的時間；用 comparison sort |
| dict 存、取、查 key、刪 key | O(1) with high probability | 背後是 hash table；key 要是一個 word。`D.update` 一次處理很多 key，不是常數 |
| 長整數加法 | 兩數 word 數相加 | 直式加法，一位一位加 |
| 長整數乘法 | 約（兩數 word 數總和）的 lg 3 ≈ 1.585 次方 | Karatsuba；直式乘法是兩長度相乘，二次方 |

`heapq` 實作 heap。Python 很多內建功能背後就是這門課教的演算法；有些高階操作很慢甚至是指數時間（例如 regular expression 在一般情況可能要指數時間），寫演算法時一定要知道哪些快、哪些慢。

> **陷阱** 看到 + 別以為一定是常數：兩邊都是一個 word 才是常數，兩邊是整個資料結構就要看長度。

## Document distance：用 cost 找出慢在哪

**問題**：給兩份文件 D1、D2，算它們的距離。用途：判斷兩個網頁是否幾乎一樣（只存、只顯示一份）、找 Wikipedia 的鏡像網站、檢查作業是否太像、搜尋（把查詢當成很短的文件，距離小的排前面）。

- 文件 = 一串 words；word = 一串連續的英數字元（a–z、0–9），去掉空白和標點、全部轉小寫。
- **文件向量** D[w]：單字 w 在 D 裡出現幾次。每個可能的字一格，大部分是 0。

> **例題** D1 = "The fox is in the hat."，D2 = "The fox is outside."
> 切字：D1 = the, fox, is, in, the, hat；D2 = the, fox, is, outside。（The 和 the 算同一字，句號去掉。）
> 向量：D1 = {the: 2, fox: 1, is: 1, in: 1, hat: 1}；D2 = {the: 1, fox: 1, is: 1, outside: 1}。
> 內積 = 2·1（the）+ 1·1（fox）+ 1·1（is）= **4**；in、hat、outside 只出現在一邊，貢獻 0。其實不必兩個向量都走一遍：只走 D1，每個字到 D2 查。

**為什麼要除以長度**：內積量的是共同性（越大越像），但兩份一百萬字、一半相同的文件內積高達 500,000，兩份一模一樣的 100 字文件內積只有 100——內積不是 scale invariant。除以兩向量的長度（‖D‖ = √(Σ D[w]²)）就是夾角的 cos：

```
d(D1, D2) = arccos( (D1 · D2) / (‖D1‖ · ‖D2‖) )
```

> **例題** "the cat" = (1, 1, 0)、"the dog" = (1, 0, 1)（軸是 the、cat、dog）。內積 1，長度都是 √2，cos θ = 1/(√2·√2) = 1/2，θ = **60°**。夾角 0° 表示幾乎一樣，90° 表示完全沒有共同的字。這個量法約 1975 年資訊檢索剛起步時就在用。

演算法三步：(1) 切字；(2) 數每個字的次數得到向量；(3) 算內積，再除以長度、取角度。約 1 MB 的文件，八個 Python 版本依序是 228.1、164、123、71、18.3、11.5、1.8、0.2 秒，快了約 1000 倍；很多是把二次方改成線性或 n log n。

### 怎麼分析一支大程式

1. **Top-down 畫呼叫樹**：main 對兩份文件各呼叫 `word_frequencies_for_file`（步驟一、二：內部呼叫 `get_words_from_line_list` 切字、`count_frequency` 數次數），再呼叫 `vector_angle`（步驟三：呼叫 `inner_product` 三次）。上層的時間 = 子函式時間加總。
2. **逐行算 cost × times**，再加總（像做內積）。

**`get_words_from_string`**（一行 n 個字元；假設每個 word 長 w 個字元，w 是常數，所以一行約 n/(w+1) 個 word）：

| 行 | 做什麼 | cost | times |
|---|---|---|---|
| 9、10 | 建 word_list、character_list | 1 | 1 |
| 11 | for 每個字元 | 1 | n |
| 12 | `isalnum` 判斷 | 1 | n |
| 13 | 英數字元就 append 到 character_list | 1 | 扣掉空白的字元數 |
| 14 | 否則，若 character_list 長度 > 0 | 1 | n/(w+1) |
| 15 | join 成字串 | w | n/(w+1) |
| 16 | 轉小寫 | w | n/(w+1) |
| 17 | append 到 word_list | 1 | n/(w+1) |
| 18 | 清空 character_list | 1 | n/(w+1) |
| 19–23 | 迴圈結束後收最後一個 word（20–22 行是 15–17 行的複製） | w、w、1 | ≤ 1 |

總和 O(n)。以 "The fox is outside"（is 後面打了兩個空白）追蹤：T、h、e 進 character_list；遇空白 → join 成 "The" → 轉小寫 "the" → 收進 word_list → 清空；第二個空白時 character_list 長度是 0，第 14 行擋下，不會收進空 word；最後的 outside 由迴圈後的 19–23 行收進來。

> **陷阱** `get_words_from_line_list` 裡的 `word_list = word_list + words_in_line`。文件有 z 行、每行 k 個 word：第 1 次複製 k 個、第 2 次 2k、……第 z 次 zk，總成本 k(1 + 2 + … + z) ≈ kz²/2 = O(z²k)。總字數 W = zk，所以是 O(W²/k)，k 幾乎是常數 → **O(W²)**，二次方。例：a 有 1000 個元素、b 有 3 個，`c = a + b` 成本 1003；`a.extend(b)` 只花 3。改成 extend，總共 O(W)（這就是 docdist2）。

**`inner_product`**（兩層迴圈逐字比較）：第 3 行走 L1 次，第 4、5、6 行各 L1·L2 次（5 乘 4 就是 20 次比較），所以 O(L1·L2)，L 是不重複的字數。

> **陷阱** 字串比較 `word1 == word2` 一個字元一個字元比，遇到不同就停："the" 與 "fox" 第一個字元就分出來，"foy" 與 "fox" 要比到第三個。長度 w 的字串比較最壞 Θ(w)，不是 Θ(1)；英文字長是常數，這裡才當常數。`sum += count1 * count2` 是數字運算，Θ(1)。

**docdist1 總時間**：`count_frequency` 也是 O(W²)；兩份文件各處理一次 → O(W1² + W2²)（兩份大小可能差很多，不能寫成 W²）。`vector_angle` 算三次內積：L1·L2 + L1² + L2²。因 L1 ≤ W1、L2 ≤ W2，且 L1·L2 ≤ W1·W2 ≤ (W1² + W2²)/2，全部被吸收，總時間 **Θ(W1² + W2²)**。另一個觀點：英文字彙量有限，文件很大時 L 幾乎是常數。

**變快的做法**：數次數改用 dict（`count[word] += 1`，每次 O(1) w.h.p.，處理一個 word 花它長度的時間，總共是文件長度，線性）；或先把 words 排序、再數連續相同的幾個。切字用簡單掃描（遇到非英數字元就開新 word），線性時間；不要用 regular expression。

## 遞迴式（一）：遞減型

### Tracing tree 與遞迴式

```c
void test(int n) {
    if (n > 0) {
        printf("%d", n);
        test(n - 1);
    }
}
```

呼叫 test(3)：印 3 → test(2) 印 2 → test(1) 印 1 → test(0) 檢查 0 > 0 不成立，停。把每次呼叫畫成方塊、用線連起來，叫 **tracing tree**（或 recursive tree）。印了 3 次、呼叫 4 次；推廣到 n：印 n 次、呼叫 n + 1 次，f(n) = n + 1，**Θ(n)**。

寫成 **recurrence relation**：設 test(n) 花 T(n)，printf 花 1，test(n−1) 花 T(n−1)：

```
T(n) = T(n−1) + 1    , n > 0
T(n) = 1             , n = 0
```

if 的判斷不算也沒關係：+1 與 +2 解出來的成長一樣；任何常數都寫成 1（或 c）。n = 0 時雖然什麼都沒做，檢查也要時間，所以邊界寫 1 不寫 0。

### Back substitution（反覆代換）

```
T(n) = T(n−1) + 1
     = [T(n−2) + 1] + 1 = T(n−2) + 2
     = T(n−3) + 3
     ...
     = T(n−k) + k
```

一路代到碰到已知的邊界 T(0)：令 n − k = 0，k = n，T(n) = T(0) + n = **n + 1**，Θ(n)，與 tracing tree 一致。

### T(n) = T(n−1) + n

```c
void Test(int n) {
    if (n > 0) {
        for (i = 0; i < n; i++)
            printf("%d", n);
        Test(n - 1);
    }
}
```

1（if）+ (n + 1)（for 條件）+ n（printf）+ T(n−1) = T(n−1) + 2n + 2，只看成長就簡化成 **T(n) = T(n−1) + n**。

- **遞迴樹**：每層的工作 n、n−1、n−2、…、2、1、0，總和 n(n + 1)/2 = (n² + n)/2，**Θ(n²)**。
- **代換法**：T(n) = T(n−2) + (n−1) + n = T(n−3) + (n−2) + (n−1) + n = … = T(n−k) + (n−k+1) + … + n。令 k = n：T(n) = T(0) + 1 + 2 + … + n = 1 + n(n + 1)/2，Θ(n²)。

> **陷阱** 代換時別把 (n−1) + n 合併成 2n − 1，一合併規律就看不出來了。這種展開代換有時被稱為 induction method，但它不是嚴格的數學歸納法證明。

### T(n) = T(n−1) + log n

迴圈改成 `for (i = 1; i < n; i = i * 2)`，跑 log n 次，所以 T(n) = T(n−1) + log n。

- 遞迴樹每層 log n、log(n−1)、…、log 2、log 1 = 0，總和 = log(n·(n−1)·…·1) = **log n!**。
- 代換法：T(n) = T(n−k) + log(n−k+1) + … + log n，k = n 得 T(n) = 1 + log n!。
- log n! ≤ log nⁿ = n log n；且後半 n/2 個因數都 ≥ n/2，log n! ≥ (n/2) log(n/2)。所以 **T(n) = Θ(n log n)**。

### 捷徑：a = 1 時乘上 n

| 遞迴式 | 答案 |
|---|---|
| T(n−1) + 1 | O(n) |
| T(n−1) + n | O(n²) |
| T(n−1) + log n | O(n log n) |
| T(n−1) + n² | O(n³) |
| T(n−2) + 1 | O(n)（只做 n/2 層，仍是線性） |
| T(n−100) + n | O(n²) |

n 每次減 1，共 n 層，每層做一次 f(n)，所以答案是 **n·f(n)**。但前面若有係數（像 2T(n−1) + 1），就不能直接乘 n。

### T(n) = 2T(n−1) + 1

```c
void Test(int n) {
    if (n > 0) {
        printf("%d", n);
        Test(n - 1);
        Test(n - 1);
    }
}
```

**遞迴樹**：第 0 層 1 個呼叫、第 1 層 2 個、第 2 層 4 個……每層翻倍，每個呼叫做 1 單位工作，每層時間 2⁰、2¹、2²、…、2ᵏ，k = n 時碰到 T(0)：

總和 1 + 2 + 2² + … + 2ⁿ。**等比級數（GP series）** a + ar + ar² + … + arᵏ = a(rᵏ⁺¹ − 1)/(r − 1)，這裡 a = 1、r = 2，得 2ⁿ⁺¹ − 1。驗算：1 + 2 + 4 + 8 = 15 = 16 − 1。所以 **T(n) = 2ⁿ⁺¹ − 1 = Θ(2ⁿ)**。

**代換法**：

```
T(n) = 2T(n−1) + 1
     = 2[2T(n−2) + 1] + 1 = 2²T(n−2) + 2 + 1
     = 2³T(n−3) + 2² + 2 + 1
     ...
     = 2ᵏT(n−k) + 2ᵏ⁻¹ + ... + 2 + 1
k = n:  = 2ⁿ·T(0) + (2ⁿ − 1) = 2ⁿ⁺¹ − 1
```

### 河內塔 Tower of Hanoi

三根柱子 A、B、C，A 上的盤子由下往上越來越小，要全部搬到 C。規則：一次搬一個；任何時候大盤子不能壓在小盤子上。B 是輔助柱。

- 1 個盤子：A → C，1 步。
- 2 個盤子：小盤 A → B（using C）；大盤 A → C；小盤 B → C（using A），3 步。
- 3 個盤子：把上面 2 個當一組，用剛剛的 3 步從 A 搬到 B（using C）；最大的 A → C；再把 B 上的 2 個搬到 C（using A）。用同一個方法解小一號的問題，就是遞迴。

```c
TOH(n, A, B, C)      // 參數：盤子數、來源、中繼、目的
{
    if (n > 0) {
        TOH(n - 1, A, C, B);              // 上面 n-1 個：A 到 B，using C
        printf("Move disk from %c to %c", A, C);   // 最大的：A 到 C
        TOH(n - 1, B, A, C);              // n-1 個：B 到 C，using A
    }
}
```

兩次規模 n−1 的呼叫加一次 printf：T(n) = 2T(n−1) + 1。

> **例題** 追蹤 TOH(3, 1, 2, 3)（柱子編號 1、2、3）。
> TOH(3,1,2,3) 展開成 TOH(2,1,3,2)、印「1→3」、TOH(2,2,1,3)；每個 TOH(2) 再展開成 TOH(1)、印、TOH(1)；TOH(0) 什麼都不做。
> 依執行順序收集印出的步驟：
> ```
> 1→3, 1→2, 3→2, 1→3, 2→1, 2→3, 1→3
> ```
> 共 7 步，從頭到尾沒有大壓小，三個盤子全部到 3 號柱。

> **重點** 搬動次數 M(n) = 2M(n−1) + 1、M(0) = 0，解得 **2ⁿ − 1**（3 個盤子 7 步）。前面的 2ⁿ⁺¹ − 1 比較多，是因為把 T(0) 的空呼叫也算成 1；兩者都是 Θ(2ⁿ)。

### 遞減型 Master Theorem

把例子分兩堆觀察：係數 1 的 → f(n) 乘上 n；係數 2 的 → 乘上 2ⁿ（2T(n−1) + 1 是 O(2ⁿ)，3T(n−1) + 1 是 O(3ⁿ)，2T(n−1) + n 是 O(n·2ⁿ)）。

一般式 **T(n) = aT(n−b) + f(n)**，a > 0、b > 0（a 是呼叫自己幾次、b 是每次減多少、f(n) 是這層的工作），f(n) = O(nᵏ)、k ≥ 0：

| 條件 | 答案 |
|---|---|
| a < 1 | O(nᵏ)，也就是 O(f(n)) |
| a = 1 | O(nᵏ⁺¹)，也就是 O(n·f(n)) |
| a > 1 | O(nᵏ·a^(n/b))，也就是 O(f(n)·a^(n/b)) |

- 每次減 b 時層數是 n/b，所以 aⁿ 改成 a^(n/b)，例如 T(n−2) 就是 2^(n/2)。
- a > 1 的公式是安全的上界；f(n) 是多項式時 tight 答案其實是 Θ(a^(n/b))，例如 2T(n−1) + n = Θ(2ⁿ)。
- a < 1（例如 0.5）在實際程式裡很少見（呼叫 0.5 次不合理），主要是數學上的完整。
- 這個定理是從例子觀察出來的，要自己動手寫幾題才記得住。

## 遞迴式（二）：除法型

參數變小有三種方式：減（n − 1）、除（n/2）、開根號（√n）。除法型除到最後是 1，所以 base case 取 **T(1) = 1**（硬取 0 的話一路到 0 很難解）。

### T(n) = T(n/2) + 1

```c
void Test(int n) {
    if (n > 1) {
        printf("%d", n);
        Test(n / 2);
    }
}
```

- **遞迴樹**：每層只做 1 步，參數 n、n/2、n/2²、…、n/2ᵏ。除到 n/2ᵏ = 1 → n = 2ᵏ → k = log₂ n（aᵇ = c ⇔ b = log_a c，例如 2⁵ = 32 ⇔ 5 = log₂ 32）。總時間 = 層數 = **Θ(log n)**。
- **代換法**：T(n) = T(n/2²) + 2 = T(n/2³) + 3 = … = T(n/2ᵏ) + k；n/2ᵏ = 1 時 T(n) = T(1) + log n = 1 + log n。

### T(n) = T(n/2) + n

- 遞迴樹：每層工作也砍半：n、n/2、n/2²、…，總和 n(1 + ½ + ¼ + … ) = n·Σ(1/2ⁱ)。
- ½ + ¼ + ⅛ + … = 1（把圓先放半個、再放四分之一、八分之一……剛好拼成一整個圓），含首項 1 的 1 + ½ + ¼ + … 趨近 2。
- 代換法：T(n) = T(n/2ᵏ) + n/2ᵏ⁻¹ + … + n/2 + n = T(1) + n(1 + ½ + … ) ≈ 1 + 2n。
- **T(n) = Θ(n)**：只有一個子問題、每層工作減半，總和由第一層的 n 說了算。

> **陷阱** Σ_{i=0}^{k} 1/2ⁱ 包含首項 1，總和趨近 2 而不是 1；但不管 1 還是 2 都是常數，答案 O(n) 不變。

### T(n) = 2T(n/2) + n（一定要背）

先跑 n 次迴圈，再呼叫 Test(n/2) 兩次：T(n) = 2T(n/2) + n，T(1) = 1。

- **遞迴樹**：第 1 層 n；第 2 層 2 個 n/2，合計 n；第 3 層 4 個 n/4，合計 n；第 4 層 8 個 n/8……**每層都是 n**（格子變多、每格變小，剛好抵銷），共 k = log n 層，T(n) = n log n。
- **代換法**：
  ```
  T(n) = 2T(n/2) + n
       = 2[2T(n/2²) + n/2] + n = 2²T(n/2²) + 2n
       = 2²[2T(n/2³) + n/2²] + 2n = 2³T(n/2³) + 3n
       ...
       = 2ᵏT(n/2ᵏ) + kn
  n/2ᵏ = 1 → 2ᵏ = n, k = log n:
  T(n) = n·T(1) + n log n = n + n log n = Θ(n log n)
  ```

### Merge sort 的遞迴式與遞迴樹

Merge sort：切成兩半 → 兩半各遞迴排序（相信小問題會被解決）→ 合併。base case：只剩 1 個元素就已經排好。合併用「兩根手指」：各指著一半的開頭，比大小，小的放進結果、那根手指往後一格，n 個數約比 n 次，**Θ(n)**。切開可能 Θ(1) 或複製一份 Θ(n)，都不影響答案。

```
T(n) = 2T(n/2) + Θ(n),  T(1) = Θ(1)
```

前面的 2（呼叫兩次）很重要，少了它答案完全不同。

**遞迴樹（call graph）**：每個方塊是一次呼叫，先寫問題大小，再改寫成「這次呼叫自己花的成本」（不含孩子）。把 Θ(n) 寫成 cn 再加：Θ 記號只能放心地加有限幾項，這裡項數會隨 n 變多，用具體的 cn 加完再換回 Θ 永遠不會錯。

```
第 1 層：           cn                    → cn
第 2 層：      cn/2      cn/2             → cn
第 3 層：   cn/4 cn/4  cn/4 cn/4          → cn
  ...
第 L 層：  c  c  c  ...  c  （n 個）      → cn
```

第 ℓ 層的大小是 n/2^(ℓ−1)；最底層大小 1：n/2^(L−1) = 1 → L − 1 = log n → **L = log n + 1**（寫成 n/2^ℓ 忘掉 −1 也會被漸近記號吸收，但最好寫出真正的式子）。每層 cn，T(n) = cn(log n + 1) = **Θ(n log n)**。

> **觀念** 「質量守恆」：每一層的元素加起來永遠是 n 個；某層加起來不是 n，就代表路上弄丟了元素。遞迴樹有三種典型：每層成本一樣（merge sort）；成本集中在根、往下快速變小（T(n/2) + n）；成本集中在葉子。每層成本不同也沒關係，一層層算出來再全部加總。

## Master Theorem（除法型）

專解 **T(n) = aT(n/b) + f(n)**，條件 a ≥ 1（至少呼叫一次）、b > 1（規模真的變小）、f(n) 漸近為正（n 夠大時一直是正的）。a 是每層分成幾個子問題、b 是規模縮成幾分之一、f(n) 是遞迴以外的工作（合併、比較）。

**為什麼比 n^(log_b a)**：樹深 n/bᵏ = 1 → k = log_b n；最底層有 a^(log_b n) = **n^(log_b a)** 個節點，這就是遞迴部分的份量。例如 2T(n/2) + n，n^(log₂2) = n，剛好是 merge sort 的 n 片葉子。

### 版本一：f(n) = Θ(nᵏ logᵖ n)，比 log_b a 與 k

把 f(n) 寫成 nᵏ logᵖ n（n² log n：k = 2、p = 1；n：k = 1、p = 0；常數 1：k = 0、p = 0）。想像天平，左盤放遞迴部分（log_b a）、右盤放 f(n)（k）：

| 情況 | 條件 | 答案 |
|---|---|---|
| Case 1 | log_b a > k | Θ(n^(log_b a)) |
| Case 2 | log_b a = k，p > −1 | Θ(nᵏ logᵖ⁺¹ n)（f(n) 再乘一個 log n） |
| | log_b a = k，p = −1 | Θ(nᵏ log log n) |
| | log_b a = k，p < −1 | Θ(nᵏ) |
| Case 3 | log_b a < k，p ≥ 0 | Θ(nᵏ logᵖ n)（就是 f(n)） |
| | log_b a < k，p < 0 | O(nᵏ)（定理只給上界） |

### 版本二：多項式倍（CLRS 寫法）

把 n^(log_b a) 與 f(n) 放上天平：

1. **Case 1**：f(n) = O(n^(log_b a − ε))，ε > 0（f 比遞迴部分小一個多項式倍，例如差 n^0.1 倍以上）→ Θ(n^(log_b a))。
2. **Case 2**：f(n) = Θ(n^(log_b a)·logᵏ n)，k ≥ 0（同階，或只多 log 因子；log 比任何多項式都慢）→ Θ(n^(log_b a)·logᵏ⁺¹ n)。注意這裡的 k 是 log 的次方，等於版本一的 p。
3. **Case 3**：f(n) = Ω(n^(log_b a + ε))，且滿足 **regularity condition** a·f(n/b) ≤ c·f(n)（某個 c < 1，n 夠大；確保越往下工作越少）→ Θ(f(n))。f(n) 是 nᵏ logᵖ n 形式時，regularity 會自動成立，所以版本一沒提。

> **陷阱** 分母有 log 的 Case 3（例如 2T(n/2) + n²/log n），版本一只給 O(n²)；用版本二的 case 3（f(n) = Ω(n^1.5)、regularity 成立）可得更緊的 **Θ(n²/log n)**。同理 4T(n/2) + n³/log n 精確答案是 Θ(n³/log n)。

### 練習

| 遞迴式 | log_b a | k, p | 情況 | 答案 |
|---|---|---|---|---|
| 2T(n/2) + 1 | 1 | 0, 0 | 1 | Θ(n) |
| 4T(n/2) + 1 | 2 | 0, 0 | 1 | Θ(n²) |
| 4T(n/2) + n | 2 | 1, 0 | 1 | Θ(n²) |
| 8T(n/2) + n | 3 | 1, 0 | 1 | Θ(n³) |
| 8T(n/2) + n² | 3 | 2, 0 | 1 | Θ(n³) |
| 8T(n/2) + n log n | 3 | 1, 1 | 1 | Θ(n³) |
| 9T(n/3) + 1 | 2 | 0, 0 | 1 | Θ(n²) |
| 9T(n/3) + n | 2 | 1, 0 | 1 | Θ(n²) |
| 16T(n/2) + n² | 4 | 2, 0 | 1 | Θ(n⁴) |
| T(n/2) + 1 | 0 | 0, 0 | 2 | Θ(log n)（binary search） |
| 2T(n/2) + n | 1 | 1, 0 | 2 | Θ(n log n)（merge sort） |
| 2T(n/2) + n log n | 1 | 1, 1 | 2 | Θ(n log² n) |
| 4T(n/2) + n² | 2 | 2, 0 | 2 | Θ(n² log n) |
| 4T(n/2) + n² log n | 2 | 2, 1 | 2 | Θ(n² log² n) |
| 4T(n/2) + (n log n)² | 2 | 2, 2 | 2 | Θ(n² log³ n) |
| 8T(n/2) + n³ | 3 | 3, 0 | 2 | Θ(n³ log n) |
| 9T(n/3) + n² | 2 | 2, 0 | 2 | Θ(n² log n) |
| 2T(n/2) + n/log n | 1 | 1, −1 | 2 | Θ(n log log n) |
| 2T(n/2) + n/log² n | 1 | 1, −2 | 2 | Θ(n) |
| T(n/2) + n | 0 | 1, 0 | 3 | Θ(n) |
| T(n/2) + n² | 0 | 2, 0 | 3 | Θ(n²) |
| 2T(n/2) + n² | 1 | 2, 0 | 3 | Θ(n²) |
| 2T(n/2) + n² log n | 1 | 2, 1 | 3 | Θ(n² log n) |
| 4T(n/2) + n³ | 2 | 3, 0 | 3 | Θ(n³) |
| 4T(n/2) + n³ log² n | 2 | 3, 2 | 3 | Θ(n³ log² n) |
| 2T(n/2) + n²/log n | 1 | 2, −1 | 3 | 版本一 O(n²)；精確 Θ(n²/log n) |

> **例題** 2T(n/4) + n^0.51：n^(log₄2) = n^0.5，f(n) = n^0.51 大了 n^0.01 倍，仍是多項式倍，Case 3。檢查 regularity：2·(n/4)^0.51 = 2·4^(−0.51)·n^0.51 ≈ 0.99·n^0.51，0.99 < 1，成立。答案 **Θ(n^0.51)**。

> **重點** 口訣：log_b a 比較大，答案直接寫 n^(log_b a)；一樣大，f(n) 再乘一個 log n（log 的次方加 1；分母的 log 另外處理）；f(n) 比較大，答案就是 f(n)。

### 根號型：T(n) = T(√n) + 1

```c
void Test(int n) {
    if (n > 2) {
        printf("%d", n);
        Test(sqrt(n));
    }
}
```

條件寫 n > 2：√1 = 1、√0 = 0，開根號永遠到不了更小，所以根號型的最小值要 ≥ 2。

**代換法**：T(n) = T(n^(1/2)) + 1 = T(n^(1/2²)) + 2 = … = T(n^(1/2ᵏ)) + k。設 n = 2ᵐ，則 n^(1/2ᵏ) = 2^(m/2ᵏ)，每開一次根號指數砍半（2¹⁶、2⁸、2⁴、2²、2¹）。開到 T(2)：m/2ᵏ = 1 → m = 2ᵏ → k = log₂ m；m = log₂ n，所以 **k = log log n**，T(n) = Θ(log log n)。n = 65536 = 2¹⁶ 只要開 4 次根號。

**遞迴樹**：每層一個節點、成本 1，規模 n、n^(1/2)、n^(1/4)、…、第 h 層 n^(1/2ʰ)。提示 n^(1/log n) = 2 是常數：自訂 base case T(常數) = Θ(1)，讓最底層 n^(1/2ʰ) = n^(1/log n) → 2ʰ = log n → h = log log n。總成本 h·1 = Θ(log log n)。

> **陷阱** T(n) = T(√n) + 1 不是 aT(n/b) + f(n) 形式，不能直接套 Master Theorem。要先換變數：令 m = log n、S(m) = T(2ᵐ)，則 T(√n) = T(2^(m/2)) = S(m/2)，得 S(m) = S(m/2) + 1，套 Case 2 得 Θ(log m) = **Θ(log log n)**。

## Peak finding：用分析指導設計

**為什麼要在乎大輸入**：全美國的公路圖、人類基因體（約 10⁹ 個字母）、社群網路（約五億個節點），「大」的標準一直往上調（以前 1000、後來一百萬、現在一兆 10¹²）。掃過 10⁹ 個元素的 Θ(n) 幾秒就好；n³ 就是 10²⁷ 步，最快的電腦也跑不完。這就是 **scalability**。

### 1D peak

陣列 a, b, c, …, i（位置 1..n）。位置 2 是 peak ⇔ b ≥ a 且 b ≥ c（不比左右鄰居小）；邊界只看一邊，位置 9 是 peak ⇔ i ≥ h。題目是找「一個」peak（如果存在）。

> **觀念** 用 ≥ 定義時，peak 一定存在：整個陣列的最大值一定 ≥ 鄰居。改成嚴格大於，像 [3, 3, 3, 3] 就沒有 peak——演算法要能明確說「沒有」並給出論證。

- **直接法**：從左往右一格一格檢查。peak 在中間約看 n/2 個，一路遞增（1, 2, …, n）時 peak 在最右邊要看 n 個，worst case **Θ(n)**。
- **Divide and conquer**：可能有好幾個 peak，只要一個，所以可以大膽丟掉一半，只要確定留下的那半有 peak。

```
1D-peak(a, 1..n):
  看中間 n/2
  if a[n/2] < a[n/2 − 1]: 只在左半找
  else if a[n/2] < a[n/2 + 1]: 只在右半找
  else: n/2 是 peak
```

為什麼右半一定有 peak？從比較大的右鄰居一直往上坡走，最慘走到邊界，邊界也算 peak。

> **例題** 陣列 `3 4 5 6 7 6 5 4`（8 個數）。看位置 4 的 6，右邊 7 比較大 → 往右，剩 `7 6 5 4`；中間 6，左邊 7 比較大 → 往左；剩 7 一個，一定是 peak。

時間：看中間 Θ(1)、看兩個鄰居 Θ(1)，然後剩一半大小的同一個問題：

```
T(n) = T(n/2) + Θ(1),  T(1) = Θ(1)
令 Θ(1) = c：T(n) = c + T(n/2) = 2c + T(n/4) = … = i·c + T(n/2ⁱ)
n/2ⁱ = 1 → i = log n：T(n) = c·log n + Θ(1) = Θ(log n)
```

Master Theorem：a = 1、b = 2、f(n) 常數，Case 2，Θ(log n)。Θ(n) 與 Θ(log n) 差的是指數級：n = 2ᵏ 時一個 2ᵏ 步、一個 k 步。n 約一千萬時，直接法實測 13 秒，divide and conquer 0.001 秒（秒數換機器會變，比例的感覺要記住）。

### 2D peak

n 列 × m 欄的矩陣，a 是 2D peak ⇔ a ≥ 上下左右四個鄰居。一樣用 ≥，所以一定存在。

- **Greedy ascent**：從某格出發，只要有鄰居比較大就往那裡爬（例：從中間的 12 開始，預設先往左、碰邊界往下，一路 12、13、14、15、16、17、19、20，20 比鄰居都大）。正確，但總有矩陣能讓它繞過大部分格子，worst case **Θ(nm)**（正方形就是 Θ(n²)）。
- **錯誤的嘗試**：挑中間欄 j = m/2，在這欄找 1D peak（log n），再在那一列找 1D peak（log m），合計 log n + log m，很快，但**是錯的**。例：中間欄裡 12 ≥ 上面 10、≥ 下面 11，是這欄的 1D peak（同欄下面明明有更大的 19，但演算法不會往下看）；接著在 12 那一列 14、13、12、11 往左走到 14，是這列的 1D peak；可是 14 下面是 15，14 不是 2D peak。

> **重點** 正確但慢，永遠比快但錯好。快不快和對不對是兩個問題。

- **正確版**：只改一件事——中間欄找**全域最大值**，不是 1D peak。

```
2D-peak(矩陣, 欄 1..m):
  j = m/2；掃整欄找最大值，位置 (i, j)
  比較 (i, j−1)、(i, j)、(i, j+1)
  if 左邊比較大: 在左半的欄遞迴
  else if 右邊比較大: 在右半的欄遞迴
  else: (i, j) 是 2D peak
  base case：只剩一欄，回傳該欄最大值
```

(i, j) 是整欄最大，上下一定不比它大；左右也比過了，所以四個方向都 ≤ 它。找最大值等於一次搞定上下兩個方向。

> **例題** 中間欄是 8、13、9、17，最大 17；左 16、右 19，右邊大 → 丟掉左半。下一個中間欄 10、12、11、19，最大 19，右邊 20 更大 → 再往右。最後一欄最大是 20，≥ 左邊的 19，就是 peak。

```
T(n, m) = T(n, m/2) + Θ(n),  T(n, 1) = Θ(n)
```

每層掃一欄 n 格 Θ(n)，欄數砍半共 log₂ m 層，**Θ(n log m)**，遠比 Θ(nm) 快。

> **陷阱** 另一種記號用 m 列 n 欄：T(n, m) = Θ(m) + T(n/2, m)，m 不變，當常數看就和 1D 的 c + T(n/2) 一樣，答案寫成 Θ(m log n)。兩者是同一件事，考試先看清楚誰是列、誰是欄。

> **陷阱** 變形：每欄改找 1D peak（log m 而非掃整欄 m）。m、n 都是一百萬時，每層從一百萬步變成約 20 步，快約 5×10⁴ 倍。但這只分析了速度——前面「欄找 1D peak」的版本就是錯的，正確性必須另外證明或找反例。

## 資料結構、rep invariant 與 BST

### Data structure 與 representation invariant

Data structure 是一組幫你存資料、之後再取出的演算法，分兩類：**query**（只問不改，例如 BST 的 find）與 **update**（改資料，例如 insert、delete）。每個資料結構都有一條 **representation invariant（RI）**：資料必須照某種規則擺好，而且永遠成立。

- Sorted array 的 RI：a[i] < a[i+1]。好處：min、max 是 O(1)，可以 binary search O(log n)（找 16：中間 15 太小往右、23 太大往左，找到 16）。
- RI 壞掉，query 就可能答錯：把 15 和 42 對調後找 15，中間 42 太大往左、4 太小往右、8 太小往右……回答「沒有 15」，但 15 明明在最後面。
- Update 結束時必須維持 RI：在 sorted array insert 10，要把 10 後面的元素全部往右搬一格；直接 append 在最後雖然快，RI 就壞了。證明一個 update 正確 = 證明開始時 RI 成立、結束時 RI 仍成立。

**checkRI**：自己實作資料結構時，update 的 bug 常常很久以後某次 query 答錯才被發現，那時已不知道是哪次 update 弄壞的。寫一個 checkRI 走遍整個結構檢查 RI、不成立就丟 exception，在每次 update 最後呼叫，bug 一出現就抓到。確定程式正確後要拿掉再交，因為 checkRI 往往比操作本身慢很多。

> **例題** Max heap：每個節點最多兩個孩子，除了最後一層每層都填滿、最後一層從左邊開始放（台灣課本與考試稱 **complete binary tree**；full binary tree 通常指每層全滿）。RI：每個父節點 ≥ 它的孩子（例如根 50 ≥ 30 且 ≥ 40），由歸納法得根就是 max，query max 是 O(1)。
> Insert 45：先放在最後一層最左邊的空位（父節點是 10）；45 > 10，swap；45 > 新的父節點 30，再 swap；45 ≤ 50，停。最壞從底換到根，O(樹高) = O(⌊log n⌋) = O(log n)。存成陣列時，父節點的位置就是自己的位置除以 2。Extract max 也是 O(log n)。
> 但 heap 的 checkRI 要走過每個節點，O(n)；每次 update 都呼叫的話，O(log n) 的操作就變成 O(n)。

### BST 的 find、insert

每個節點是一個 object，有 key、left、right、parent。RI：每個節點都滿足「左子樹的 key < 自己 < 右子樹的 key」。

```
        23
       /  \
      8    42
     / \
    4   16
       /
      15
```

- **find**：拿 key 跟目前節點比，小往左、大往右，和 binary search 一樣。find(16)：23 → 8 → 16。find(14)：23 → 8 → 16 → 15 → 15 的左邊是空的，死路，不存在。時間 **O(h)**（h 是樹高），先寫 h，等學了平衡樹保證 h = O(log n) 再換掉。
- **insert**：沿著 find 會走的路往下，碰到第一個死路就放新節點，原本的節點都不動。insert(14)：23 → 8 → 16 → 15，15 的左邊空，14 成為 15 的左孩子（下次 find(14) 走完全一樣的路一定找得到）。insert(5)：23 → 8 → 4，5 > 4 放在 4 的右邊（路徑「小、小、大」）。程式幾乎就是 find，唯一差別是碰到 None 時建新節點，O(h)。實作前要先想清楚重複的 key 怎麼處理（例如在節點上掛一條 linked list 存多個值）。
- **退化（degenerate）**：依序 insert 5、10、15、20、25，每個新節點都接在最右邊，樹變成一條 list，h = n，search 是 O(n)。資料隨機時樹高約 log n；要完全避免就用 balanced tree。

### Successor 與 predecessor

**successor（next_larger）**：所有比 x 大的 key 中最小的（排成一排時 x 的下一個）。

- **Case 1：有右子樹** → 往右一步，再一路往左走到底（就是右子樹的 min）。next_larger(8)：8 → 16 → 15，答案 15。找整棵樹的 min 也是從根一路往左：23 → 8 → 4。
- **Case 2：沒有右子樹** → 沿 parent 往上，只要自己是右孩子就繼續；第一次發現自己是左孩子時，那個父節點就是 successor。next_larger(4)：4 是 8 的左孩子，答案 8。next_larger(16)：16 是 8 的右孩子（8 比 16 小）→ 繼續；8 是 23 的左孩子 → 答案 23。42 一路上到根都沒轉，沒有 successor。
- **predecessor（prev_smaller）**：完全對稱，left 換 right、min 換 max。prev_smaller(23)：往左一步到 8，再一路往右 16，答案 16。

> **觀念** 用「先找 min，再一直呼叫 successor」依序列出所有 key：單次 successor 是 O(h)，看似 O(n log n)，但每條邊剛好走兩次（一次往下、一次往上），n 個節點有 n − 1 條邊，總共 2(n − 1) 步，n 次 successor 合計 **O(n)**，與 in-order traversal 一樣。Range query（列出 L 到 H 之間的 key）：先找第一個 ≥ L 的，再一直 successor 到超過 H，**O(log n + 輸出個數)**。

### BST delete

1. **Leaf**（例如 15）：直接拿掉。
2. **只有一個孩子**（例如 16，只有左孩子 15）：把孩子接到它原本的位置——8 的 right 改指向 15、15 的 parent 改指向 8。那棵子樹的 key 本來就都比 8 大，RI 照樣成立；直線或 zigzag 都一樣。
3. **兩個孩子都有**（例如 8）：找 successor（8 → 16 → 15），把 successor 的 key 搬到 8 的位置，再刪掉原本的 successor 節點。新的 15 左邊 4 比它小、右邊 16 比它大。

> **陷阱** Case 3 不會沒完沒了：successor 一定沒有左孩子（若有，那個左孩子比它小又比 8 大，它才該是 successor），所以刪 successor 一定是 case 1 或 case 2。換上來的是 successor 的 key，再刪原本的 successor 節點。

時間：找節點 O(h) + （兩個孩子時）找 successor O(h) + 改幾個指標 O(1) = **O(h)**。程式上，`BST.delete(k)` 先 find 再呼叫節點自己的 delete（刪到根時還要更新整棵樹的 root）；節點的 delete 中，少一個孩子是 happy case（改指標），兩個孩子是 sad case（找 successor、交換 key、對 successor 呼叫 delete，遞迴一層就結束）。

### Augmentation

讓節點「胖一點」：例如每個節點多存「我這棵子樹的最小值」，min 就從 O(h) 變 O(1)。

- 計算：孩子算好時，節點值 = min(自己的 key, 左孩子的值, 右孩子的值)，O(1)。例：刪掉 8 之後的樹 23（左 15、右 42），15 那棵最小是 4、42 那棵是 42，23 的值 = min(23, 4, 42) = 4；leaf 的值就是自己。
- 維護：insert 3（路徑 23 → 15 → 4，3 成為 4 的左孩子），只有插入路徑上的 4、15、23 子樹改變，沿路徑往回重算：4 → 3、15 → 3、23 → 3；路徑外的 16、42 不用動。O(h)。delete 也一樣。
- 條件：節點的值能由自己加孩子的值在 O(1) 算出來，任何這種函數都能這樣維護。

## Hashing

### Dictionary ADT

**ADT（abstract data type）** 只規定能做什麼、不管怎麼實作。Dictionary 存很多 item，每個 item 有一個 key，支援 insert(item)、delete(item)、search(key)。

- Search 是 **exact search**：key 完全一樣才找到；沒有就報錯（Python 丟 KeyError）。BST 找不到還能給 successor／predecessor，dictionary 只回答有沒有。
- 假設 key 唯一：insert 已存在的 key 就覆蓋（cat 從 1 變 5）。
- Python 的 dict：`D[key]`（search）、`D[key] = val`（insert）、`del D[key]`（delete）、`D.items()`（所有 (key, value)）。
- 現成解法是平衡 BST（如 AVL tree），三個操作都 O(log n)；在比較模型下搜尋最快就是 log n。換成 RAM model（key 是整數可以拿來算），用 randomized 的方法可以做到以很高機率 O(1)。
- **用途**：docdist 數字數、資料庫（hashing 或搜尋樹）、線上字典查定義、拼字檢查（改一兩個字母再查）、早期搜尋引擎記「字 → 網頁」、登入查帳號、編譯器把變數名稱翻成位址、路由器用目的 IP 查轉送方向、OS 查 port 對應的程式、Ctrl-F 與 grep 的字串搜尋、比較 DNA、rsync／Dropbox 判斷哪裡改過、密碼學確認檔案沒被竄改。

### Direct access table 與 prehashing

**Direct access table**：一個大陣列，key 當 index，沒用到的格子放 None。insert、delete、search 都是 O(1)。兩個問題：

1. Key 不一定是整數（字串 cat 放第幾格？）→ **prehashing**。
2. **Memory hog**：每個可能的 key 都要先留一格；64-bit 整數要 2⁶⁴ ≈ 1.8×10¹⁹ 格 → **hashing**。

**Prehash** 把任何 key 對應到一個非負整數。理論上任何東西都是一串 bits，就是一個整數（字母 c 是 01100011 = 99），所以分析時假設 key 是非負整數。Python 的 `hash()` 其實是 prehash：hash(42) = 42；字串用某種方法算整數（當年的 Python 曾有兩個不同字串都算出 64；現在字串 hash 加了隨機成分）。自訂物件可寫 `__hash__`，沒寫就用 id（記憶體位置）。

> **陷阱** Prehash 的值絕不能隨時間改變：存進去時算出 4 放第 4 格，之後算成 5 就去第 5 格找，明明存了卻找不到。所以 mutable 物件（例如 list，append 後值就變了）不能當 key。

### Hash function 與 chaining

**Hashing**（hash 原意是切碎攪拌，和 hash browns 同字源）：用 hash function h 把巨大的 key space U 映射到 {0, 1, …, m − 1}，m 是 hash table T 的格數。希望 **m = Θ(n)**（n 是目前存的 key 數），空間線性。

由鴿籠原理（pigeonhole principle），一定會有 **collision**：k_i ≠ k_j 但 h(k_i) = h(k_j)。處理方法有 chaining 與 open addressing。

**Chaining**：撞到同一格的 items 串成一條 linked list，沒有 item 的格子存 null。

> **陷阱** 最壞情況：h 一固定，總有一大堆 key 會撞在同一格，結構退化成一條長 n 的 list，search **Θ(n)**。任何 hashing 的 worst case 都很糟；實務上好用靠的是隨機化。

**Simple uniform hashing（SUH）**：兩個機率假設——(1) uniformity：每個 key 落到每一格的機率都是 1/m；(2) independence：每個 key 獨立地落下。這個假設不實際，只是讓分析方便。

- Chain 的期望長度 = n/m，叫 **load factor α**（例：4 格、12 個 key，α = 3）。α = 1 平均每條長 1，α = 10 平均長 10，仍是常數；只要 m = Θ(n)，α 就是常數。
- Search：算 h、沿 list 逐一比，期望時間 **Θ(1 + α)**（1 是算 h、跟第一個指標的常數時間）。

> **重點** Θ(1 + α) 是期望時間，worst case 仍是 Θ(n)。

### 三種 hash function

1. **Division method**：h(k) = k mod m。若 m 與 key 有公因數就很糟：key 都是偶數、m 取 8，餘數一定是偶數，奇數格永遠空著。實務上 m 取質數，且不要靠近 2 或 10 的次方。常常能用但不保證（hackish）。
2. **Multiplication method**：h(k) = [(a·k) mod 2ʷ] >> (w − r)。w 是 word size（實際常是 64，示意 8），a 是隨機的 w-bit 整數，m = 2ʳ。
   - 二進位乘法就是把 k 依 a 的每個 1 移位後相加，進位把它們混在一起；乘積最多 2w bits，mod 2ʷ 只留右邊那個 word，再右移 w − r 位，留下右邊那個 word 最左邊的 r 位。
   - 中間的位每份移位過的 k 都有貢獻，混得最均勻，所以取中間。
   - a 要是奇數，且最好介於 2^(w−1) 和 2ʷ 之間（不要太靠近 2 的次方）。理論上一定找得到讓它很糟的 key。
3. **Universal hashing**：h(k) = ((a·k + b) mod p) mod m，p 是比 key space 大的質數，a、b 在建表時從 {0..p−1} 隨機選定。保證：**對任意（就算最壞的）兩個不同 key，碰撞機率 ≤ 1/m**——機率是對「隨機選出的 hash function」取的，不是對輸入。再用 linearity of expectation，輸入再壞 chain 的期望長度仍是 α，所以 α 為常數時期望時間 O(1)。這才是 hashing 理論上真正有效的原因。（課本版本取 a ∈ {1, …, p−1}、b ∈ {0, …, p−1}。）

## Table doubling 與攤銷分析

### Grow 與 rehash

事先不知道 n：m 太小（4 格塞 16 個，α = 4）chain 變長；一開始開太大（32 格放 4 個）又浪費。目標 m = Θ(n)：m = Ω(n) 讓 α 是常數、m = O(n) 讓空間線性。做法：m 先設一個常數，需要時 grow 或 shrink。

**Grow**（insert 完發現 n > m）：開新的 table T′（大小 m′），把舊表每個 item 重新 insert 進去，叫 **rehash**，時間 **Θ(n + m + m′)**（走過舊表 m 格、list 上 n 個 item、新表 m′ 格初始化）。例：m = 8 放了 8 個，insert 第 9 個後 n = 9 > 8，建 16 格的新表，新的 hash 是 k mod 16，25 和 9 都落在第 9 格，照樣 chaining。

> **陷阱** Rehash 一定要換新的 hash function h′（對應 m′）；還用舊的 h，只會送到前 8 格，新加的格子永遠用不到。

> **觀念** Resize 的成本跟 table 滿不滿無關：Python 的 table 存的是 reference（記憶體位址），搬一個 item 只是搬一個小數字，O(1)。空表要看 m 格（m 次 index、0 次搬移），滿表 m 次 index 加 m 次搬移 = 2m，都是 Θ(m)。

### 放大多少

- **錯誤：m′ = m + 1**。從 8 格開始，前 8 次各花 1；第 9 次起每次 insert 都滿、都要重建，成本 9、10、11、12……，n 次 insert 合計約 n²/2 = **Θ(n²)**。
- **正確：m′ = 2m（table doubling）**。8 → 16（第 9 個）→ 32（第 17 個）→ 64……只重建約 log n 次，但不是 n log n：每次重建成本 8、16、32、…、n 是等比級數，由最後一項主宰，總和 < 2n。n 次 insert 共 **Θ(n)**。

### Amortized 的定義

說一個操作的 **amortized running time 是 T(n)**：不保證每一次都只花 T(n)，而是**任意 k 次操作的總時間 ≤ k·T(n)**。所以 table doubling 下 insert 是 amortized Θ(1)；第 17 次 insert 那一次單獨是線性時間，但這種昂貴操作很少（約 log n 次）。

> **比喻** 房租每個月付一大筆，也可以想成每天付 50 美元。把高柱子削下來填到矮柱子上：CPU 實際花的時間沒變，變的只是怎麼算帳。

> **陷阱** Amortized 的「平均」是對同一串操作取平均，跟 average case（對隨機輸入取平均）是兩回事，這裡沒有任何隨機輸入。只有 real-time 系統才在乎每一次都要快。

> **例題** 從大小 1 的 table 開始，滿了就 resize 成兩倍。第 i 次 insert 的成本（resize 時要搬舊的再放新的）：
> ```
> 第 i 次:  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15 16
> 成本:     1  2  3  1  5  1  1  1  9  1  1  1  1  1  1  1
> ```
> 只有第 2、3、5、9 次要 resize（換成 2、4、8、16 格）。16 次總成本 31，平均每次不到 2，攤銷 O(1)；攤平後每次大約 3 以內。貴的成本每次加倍，兩次貴的之間的間隔也每次加倍，所以切開重新分配後柱子一樣高。若只看單次最壞 9，16 次就是 144——上界沒錯但太鬆。

Delete 只把 item 拿掉、table 大小不變，只會讓情況更好（n 變小，要更多次 insert 才觸發重建），所以 insert、delete 混著做 k 次仍是 O(k)。

### Shrink

先 insert n 次再 delete n 次，m 停在最大，浪費空間，要縮表。

> **陷阱** 錯誤做法：n 掉到 m/2 時縮成一半。m = 8 放滿 8 個，insert 第 9 個 → 放大成 16；刪掉第 9 個，n = 8 = m/2 → 縮回 8；insert、delete 輪流做，每一次都要線性時間重建（在 2ᵏ 與 2ᵏ⁺¹ 之間來回抖動）。

正確做法：**n 掉到 m/4 才縮成一半**（任何大於 2 的比例都行，用 4 讓大小維持 2 的次方）。縮完是半滿，要再放大得再 insert m/2 個，這麼多便宜操作足以付清下一次重建。結果：任意混合的 k 次 insert／delete，amortized 時間 O(1)，且隨時 **n ≤ m ≤ 4n**，空間線性。

### Python list

Python list 是 resizable array：L[i] O(1)、`append` O(1)、`pop()`（刪最後一個）O(1)，但刪第一個要把後面全部往前搬，O(n)。它底層就是 table doubling，所以 append、pop 其實是 **constant amortized**。

> **觀念** 也能做到每一次最壞都是常數：快滿時先在旁邊建一個兩倍大的新 table，之後每次 insert 順便搬幾個（夠大的常數，例如 5 個）過去，舊表滿的那一刻剛好搬完直接切換。很難寫對，只有 real-time 系統才在意。Table doubling 不在乎 hashing 本身，只要重建是線性時間就適用。

## String matching：Karp-Rabin 與 rolling hash

**問題**：給字串 s 與 t，問 s 是不是 t 的 substring（grep、編輯器的尋找；s 通常很小，t 很大）。

**暴力法**：

```python
any(s == t[i : i + len(s)] for i in range(len(t) - len(s) + 1))
```

例：s = '6006'，t = '16006…'：i = 0 時 '1' ≠ '6'；i = 1 四個字元都相同，match。共 len(t) − len(s) + 1 個位置，時間 len(s)·(len(t) − len(s))，寫成 **O(len(s)·len(t))**。下限是 len(s) + len(t)（兩個字串總得看過一遍）。

> **陷阱** 寫成 `range(len(t) - len(s))` 會漏掉最後一個位置，要加 1。

### 想法：比 hash 值，相同再確認

> **例題** 文件 "the fox is"（空白也算字元），key = "the"，k = 3。框住 3 個字元的 **sliding window**：
> - "the"：hash 等於 h(key)，逐字比確認，真的 match。
> - "he␣"：hash 不同 → 字串一定不同，O(1) 跳過。
> - ……一路滑下去。
> - "␣is"：hash 剛好等於 h(key)，逐字比卻不同 → **false positive**。
>
> hash 不同直接跳過；hash 相同才花 O(k) 確認。

Collision 一定存在：例如在 1 GB 檔案裡找 1 MB 的 MP3，輸入有 256^(100萬) 種，32-bit 輸出只有 2³²（約 40 億）種，鴿籠原理保證一定會撞。只能希望 hash 像隨機一樣，輸出有 O 種時大約每 O 次才誤判一次。總時間 = hash 相同的次數 × O(k) + 不同的次數 × O(1)。關鍵在：每滑一格，怎麼 O(1) 算出新視窗的 hash？

### Rolling hash ADT

相鄰兩個視窗共用 len(s) − 1 個字元，只差開頭刪一個、尾巴加一個。Rolling hash r 維護一個字串 x：

- `r.append(c)`：在 x 尾端加字元 c。
- `r.skip(c)`：刪掉 x 的第一個字元（像 pop left）。
- `r()`：回傳 h(x)。

例如 x = "THE"，append 空白、skip T，變成 "HE␣"。三個操作都要 O(1)。

### Karp-Rabin

```python
rs = RollingHash()
for c in s: rs.append(c)              # 只算一次 h(s)
rt = RollingHash()
for c in t[:len(s)]: rt.append(c)
if rs() == rt() and s == t[:len(s)]: 找到
for i in range(len(s), len(t)):
    rt.skip(t[i - len(s)])            # 丟掉視窗第一個字
    rt.append(t[i])                   # 加入下一個字
    if rs() == rt():                  # 「可能」相同
        if s == t[i - len(s) + 1 : i + 1]:   # O(len(s)) 逐字確認
            找到
```

> **例題** 把字串當十進位數、用 mod 17：h('6006') = 6006 mod 17 = 5；第一個視窗 '1600' mod 17 = 2，2 ≠ 5，往右；skip '1'、append '6' 得 '6006'，hash 5 = 5，逐字比確認是真的 match。再往右，'0600' mod 17 也是 5，但字串不同——假警報。

設計成假警報機率 ≤ 1/len(s)：每次假警報花 len(s)，乘上機率，每個位置花在假警報的期望時間是常數。總時間 **O(len(s) + len(t))**，再加上每個要回報的 match 各花 len(s)；只找一個 match 就是線性時間。（Karp 與 Rabin 在 1987 年發表；它是最早用隨機化解問題的漂亮例子之一。）

### 實作：division method

h(x) = x mod p，p 是隨機選的質數，至少跟 len(s) 一樣大（越大假警報越少）；找隨機質數：隨便挑差不多大的數檢查是否質數，依質數定理約試 log n 次就會找到。Karp 與 Rabin 證明了用 division method 時期望時間成立。

把字串看成 base a 的多位數 u（prehash；ASCII 是 256 進位，示意用 10 進位，'600' 就是 600）：

- **append(c)**：u → u·a + ord(c)。600 → 6000 + 6 = 6006。
- **skip(c)**：u → u − c·a^(len(u)−1)。6006 → 6006 − 6×10³ = 6。
- 全部 mod p 算，結果和先算 u 再 mod p 一樣；r 只要存兩個數：目前的 hash 值，與 skip 要用的 a 的次方 mod p。

> **例題** Base 100、p = 23，數列 3 14 15 92 65 35 89 79 31（圓周率的數字），視窗大小 5。
> 1. 第一個視窗 314159265 mod 23 = **11**。
> 2. 滑一格：3 出去、35 進來，新數 1415926535 mod 23 = **6**。每次對大數重算是 O(k)，要直接從 11 算出 6。
> 3. 先推大數怎麼變：減掉最前面的 3（3 × 100⁴）→ 14159265；乘 base → 1415926500；加 35 → 1415926535。所以新 n = n·base − old·base^size + new（size = 5）。
> 4. 兩邊 mod p，n mod p 就是目前的 hash，大數不用存。剩下的 base^size 也是大數（repeated squaring 也要 O(log size)，size 可能一百萬），但視窗大小不變時可預先算好：**magic = base^size mod p**。
> 5. hash = (hash·base − old·magic + new) mod p。驗算：magic = 100⁵ mod 23 = 16，11·100 − 3·16 + 35 = 1087，1087 mod 23 = **6**。

**拆成 append 與 skip**（通用版，可任意順序呼叫）：

```
init(base, p):  hash = 0; magic = 1        # size = 0 時 base⁰ = 1
                ibase = base⁻¹ mod p       # 只算一次
append(new):    hash  = (hash·base + new) mod p
                magic = (magic·base) mod p
skip(old):      magic = (magic·ibase) mod p           # 先降一階
                hash  = (hash − old·magic + p·base) mod p
```

- append 3、14、15、92、65 之後 hash = 11、magic = 16（100 mod 23 = 8，8⁵ mod 23 = 16），和直接算的一樣。

> **陷阱** append 千萬別漏 mod p：Python 會用大數照算、答案也對，但會越跑越慢還找不到原因。

> **例題** 再 append(35)：hash = (11·100 + 35) mod 23 = 1135 mod 23 = 8，magic = 16·8 mod 23 = 13，size = 6。接著 skip(3)：magic = 13·ibase mod 23。ibase：100 mod 23 = 8，8 × 3 = 24 ≡ 1，所以 ibase = 3；magic = 39 mod 23 = 16（正是 3 的權重 100⁵ mod 23）。hash = 8 − 3·16 = −40，補上 p·base = 2300 得 2260，2260 mod 23 = **6**，正是新視窗的 hash。

> **陷阱** 減出負數：數學上 mod 的結果在 0..p−1，但 C、Java 的 % 會給負數（−3 % 23 = −3，正確是 20）；Python 的 % 會回傳非負。解法：mod p 下加上 p 的倍數不改變結果；因為 magic < p、old < base，old·magic < base·p，補上 p·base 一定變正。

**乘法反元素（multiplicative inverse）**：size 少 1 時 magic 要除以 base，但 mod 下除不盡（5 ÷ 100 不是整數）。mod 質數 p 時，1..p−1 的每個 a 都有 a⁻¹ 使 a·a⁻¹ mod p = 1。例：mod 23 下 6⁻¹ = 4（6 × 4 = 24 ≡ 1）；驗證 7 × 6 = 42 ≡ 19，19 × 4 = 76 ≡ 7，乘 4 抵銷了乘 6。所以「除以 base」改成「乘 ibase 再 mod p」；ibase 只在 init 算一次。

> **觀念** 為什麼不用 bit shift？shift 等於把整個大數存著，hash() 時要對整個大數 mod p，O(size)。為什麼要存 magic？base^size 很大，不能每次重算；替每個 size 查表又太多。append 一次 magic 乘 base、skip 一次乘 ibase，一伸一縮像毛毛蟲，所以也叫 **caterpillar hash**；每次都 mod p，數字永遠很小，三個操作都是 O(1)。

**p 怎麼選**：false positive 約 1/p，p 越大越少；但 p 超過一個 word，一次運算就不只一個指令。折衷：取一個比 2³² 小一點的質數。一定要質數，因為反元素要存在：mod 8 時 2 乘任何數只得 0、2、4、6，沒有反元素；3 × 3 = 9 ≡ 1，3 的反元素是 3。精確規則：a 與模數互質才有反元素（mod 8 時 1、3、5、7 都有），而且反元素存在就唯一；真正需要的是 base 與 p 互質，取質數 p 最省事。

## Open addressing

只用一個 array，沒有 pointer、沒有 linked list，**每一格最多放一個 item**，所以 m ≥ n。碰撞時用 **probing**：hash function 改成 h(k, i)，i 是 trial count，給出「依序要試哪些格」的順序。

> **重點** 對每個 key，h(k, 0), h(k, 1), …, h(k, m−1)（或從 1 數到 m）必須是 {0, 1, …, m−1} 的一個 **permutation**，每一格剛好出現一次。這樣 table 只剩一格空時也一定試得到。

- **insert**：照順序 probe，直到遇到 None（或 DeleteMe），放進去。
- **search(k)**：照順序 probe；遇到 k 就成功；遇到其他 key 或 DeleteMe 繼續；遇到 None 就確定不在（insert 用的是同一串序列，一定停在第一個空格，不可能跳過空格放到後面）。
- **delete**：不能改回 None，要放 **DeleteMe** 旗標。

> **例題** m = 7（格 0..6）。依序 insert 586、133、204、481：各自第一次 trial 就成功，586 在第 1 格、133 在第 2 格、204 在第 4 格、481 在第 6 格。
> insert 496：h(496, 1) = 4（204，被佔）→ h(496, 2) = 1（586，被佔）→ h(496, 3) = 3（空）→ 放進第 3 格，試了 3 次。
> ```
> 格:  0     1    2    3    4    5     6
>     None  586  133  496  204  None  481
> ```
> search(496)：4（204，繼續）→ 1（586，繼續）→ 3（496，找到）。search(700)：第 2 格是 133 繼續 → 第 5 格是 None，確定不在。
> delete(586) 若直接改回 None，再 search(496)：4（204）→ 1（None）→ 停，回報找不到——但 496 就在第 3 格！改放 DeleteMe：4（204）→ 1（DeleteMe，不停）→ 3（496），正確。之後 insert 999 若 probe 到第 1 格，可以直接蓋掉 DeleteMe 放進去。

> **陷阱** DeleteMe：**insert 把它當空、search 把它當滿**。

### Probing strategy

- **Linear probing**：h(k, i) = (h′(k) + i) mod m，從 h′(k) 一格一格往下試，mod m 繞回開頭，所以是 permutation。問題是 **clustering**：一段連續被佔用的格子越大，新 key 越容易撞進去（100 格裡 4 格長的 cluster 被撞到的機率 4/100，是單一格的 4 倍），撞進去就走到尾巴放下，cluster 再長一格。例：h′(k) = 42 落在 cluster 裡，試 43、44……一路到 57 才是空格，多試了 15 次。在合理的機率假設下，α 介於 0.01 與 0.99 時就會出現 Θ(log n) 長的 cluster，就算 h′ 很完美也一樣，search／insert 不再是期望常數時間。
- **Double hashing**：h(k, i) = (h₁(k) + i·h₂(k)) mod m，每次跳 h₂(k) 格。要成為 permutation，**h₂(k) 必須與 m 互質**：m = 8、h₂ = 3 時 8 次 trial 剛好走遍 8 格；h₂ = 2 與 8 有公因數，只會踩同幾格。簡單做法：m 取 2 的次方（正合 table doubling），h₂(k) 永遠取奇數（把普通 hash 的最後一個 bit 設成 1）。實務效果很好。

### 效能

**Uniform hashing assumption**：每個 key 的整串 probe 序列是 m! 種排列中任何一種，機率相等。（和 simple uniform hashing 不同：SUH 只說每個 key 落到哪一格均勻獨立。）實務上很難做到，double hashing 很接近。

**定理**：α = n/m，search、insert、delete 的期望 probe 次數 **≤ 1/(1 − α)**。α = 0.99 時平均 100 次（常數，但很糟），所以實務上 α 超過約 0.5～0.6 就要 resize；α 到 0.7 左右，open addressing 就比同樣格數的 chaining 差。優點：好寫、省記憶體（不需要 pointer）。

> **觀念** 直覺：7 格放 5 個，空格比例 (m − n)/m = 2/7 = 1 − α，第一次 trial 成功的機率 p = 1 − α；試過的滿格不會再試，之後每次成功機率不會更差。成功機率 p 平均要試 1/p 次（像擲骰子擲出 6 平均擲 6 次），所以 ≤ 1/(1 − α)。

> **陷阱** DeleteMe 還佔著位置，delete 不會立刻降低負載（chaining 刪掉一個 chain 就變短）：塞滿再全部刪掉後，每格都是 DeleteMe，search 可能要走遍整個 table。算 α 時 DeleteMe 也要算進去。Resize 時重新 hash 只搬真正的 item，DeleteMe 全部變回 None。

## Cryptographic hash：密碼怎麼存

這是用途完全不同的 hash（補充觀念）。笨方法是把密碼用明文存在檔案（像 /etc/passwd），甚至所有人都讀得到。我們希望連系統管理員都不知道你的密碼：

- 用 **one-way（單向）** 的 cryptographic hash：給 h(x) 很難反推 x。
- 檔案只存帳號與 h(密碼)。登入時把輸入的 x′ 算 h(x′)，與存的 h(x) 比，相同才放行；系統從頭到尾不需要知道 x。
- 還需要 **collision resistance**：很難找到兩個輸入撞出同一個 hash。

## 演算法設計練習

### Bunker hill：2D 的 rolling hash

W × H 的地圖（每格是亮度數字），找 w × h 的小圖案（例：w = 3、h = 2；圖案也是輸入）出現幾次。

- **暴力法**：位置數 (W − w + 1)(H − h + 1)（例：6 × 4 = 24），每個位置最壞比滿 wh 格，O(WH·wh)。演算法至少要看完整張圖，所以 O(WH) 是最好能做到的。
- 只比左上角、相同才完整比對：資料隨機時很快，但地圖到處都是 2 時 false positive 很多。
- 整塊視窗做 rolling hash，往右滑時加一欄、去一欄，每欄 h 格，O(h)；總共 O(WH·h)。
- **Hash of hashes**：每一欄先壓成一個 hash（圖案的 3 欄是 p₀、p₁、p₂；地圖目前的 h 列每欄一個，共 W 個），在這排欄 hash 上做 1D Karp-Rabin。往下移一列時，每一欄都是直向的 rolling hash，出去一格、進來一格，O(1) 更新。總時間 **O(WH)**（最佳），額外記憶體 O(W)。

### 假硬幣與 decision tree 下界

9 枚金幣中有一枚較輕的假幣，用完全準確的天平最少秤幾次？

- 二分法：兩邊一樣多，天平永遠不會「一樣重」，每次只得到 1 bit；但天平有三種結果（1 trit ≈ log₂ 3 ≈ 1.58 bit），每次浪費約 0.58 bit。
- **分三堆、秤其中兩堆**：1 2 3 對 4 5 6 一樣重 → 假幣在 7 8 9；7 對 8，7 較輕 → 找到。9 枚只秤 2 次 = log₃ 9。不能被 3 整除就補幾枚真幣。
- **下界（decision tree）**：任何演算法都是「秤、看結果、決定下一次秤什麼」，畫成每個節點分三支的樹，葉子是答案。秤 h 次最多 3ʰ 片葉子，要能答 N 種答案：3ʰ ≥ N → **h ≥ log₃ N**（秤 3 次最多 27 種，30 枚就得秤第 4 次，81 片葉子）。這個推論不管演算法長怎樣都成立；分三堆的方法剛好達到下界，所以是最佳。比較排序的 Ω(n log n) 下界也是這樣證的。

### 兩個已排序串列的第 k 小

A = 5 13 22 43 56 62 81 86 87，B = 2 3 7 9 15 19 24 28 32（數字都不同），找合併後第 k = 9 小。

- Merge 到第 k 個就停：兩個指標，O(k)，空間 O(1)，但仍是線性。
- **每輪丟掉約一半**：取 A 第 i 個、B 第 j 個，i + j = k。若 B[j] < A[i]，則 B[1..j] 都排在第 k 名之前、不是答案 → 丟掉，k 減 j；A[i] 右邊的排名都超過 k → 也丟掉（A[i] 自己留著）。反之亦然。

> **例題**
> ```
> k = 9：A 第 4 個 43 vs B 第 5 個 15 → 15 較小，丟 2 3 7 9 15（k 減 5），丟 43 右邊
>        剩 A = 5 13 22 43，B = 19 24 28 32，k = 4
> k = 4：A 第 2 個 13 vs B 第 2 個 24 → 13 較小，丟 5 13（k 減 2），丟 24 右邊的 28 32
>        剩 A = 22 43，B = 19 24，k = 2
> k = 2：22 vs 19 → 19 較小，丟 19（k 減 1），丟 22 右邊的 43
>        剩 A = 22，B = 24，k = 1
> k = 1：取兩邊開頭較小的 → 22
> ```
> 合併後 2 3 5 7 9 13 15 19 22，第 9 小確實是 22。

每輪 k 約減半，**O(log k)**。k ≤ N₁ + N₂，所以 O(log(N₁ + N₂)) 也對，但 O(log k) 更緊（k = 1 時一輪就結束，串列多長都一樣）。另一種寫法：兩個 index i、j 永遠加起來是 k，對 i 做 binary search，j 跟著調。

### Shifted array

排好序的 1 3 5 6 7 9 12，把前 k = 4 個搬到最右邊得 **7 9 12 1 3 5 6**（像旋轉），k 未知，找 e。

> **觀念** 考試技巧：先花約三分之一時間想，目標是時間到時手上一定有東西可寫；先想 brute force（不管多慢只求正確）。兩個解一樣快時，寫簡單的那個——程式越簡單越不容易有 bug。

1. 暴力：linear search，O(n)。
2. 知道 k：移回原樣 O(k) + binary search，最壞 O(n)（Python list 從前面 pop 一個就要 O(n)，更慢）。改成腦中想像排好序的陣列、看第 (mid + n − k) mod n 個，O(log n) 但容易寫錯。更簡單：左段 7 9 12、右段 1 3 5 6 各自排好，**兩段各做一次 binary search**，O(log n)。
3. 不知道 k：用 binary search 找斷崖（discontinuity）。左段全部 ≥ A[0]、右段全部 < A[0]（A[0] = 7 就是那條水平線）。猜中間：值 < A[0] 表示已在右段，斷崖在左邊，往左找；值 ≥ A[0] 表示還在左段，往右找。找到最小值 1 在 index 3，k = n − 3 = 4。總共 **O(log n)**。

### Min-heap 的第 k 小

Min-heap（陣列 2 5 7 6 9 8，位置 1 是 root，H[j] 的孩子在 H[2j]、H[2j+1]），n 個元素，找第 k 小（k = 3：2、5、6，答案 6）。目標 O(k log k)。

| 方法 | 時間 |
|---|---|
| 整個 sort 取第 k 個 | O(n log n) |
| extract-min k 次（heap sort 做一半） | O(k log n) |
| 掃所有元素，用大小 k 的 **max-heap 袋子** 存目前最小的 k 個；新元素比袋中最大的小就替換 | O(n log k) |
| 只留前 k 層（往下的路徑數字只會變大，第 k+1 層以下上面至少有 k 個更小的祖先），再 extract-min k 次（高度變 k） | O(k²) |
| **Horizon**：另開 min-heap Z，存 (值, index)；先放 root；做 k 次：取出 Z 的最小 (v, j)，把 H[2j]、H[2j+1]（若存在）放進 Z | O(k log k) |

> **陷阱** 直接拿陣列前 k 個是錯的：前 3 個是 2 5 7，但第 3 小是 6。Heap 只保證父 ≤ 子，陣列沒有排好。

> **例題** Horizon 追蹤：Z = {2}；取出 2（j = 1），放入 5（index 2）、7（index 3）；取出 5（j = 2），放入 6（index 4）、9（index 5）；取出 6（j = 4），孩子在第 8、9 格超出陣列不放；k = 3 → 回傳 6。每輪取出 1 個、最多放進 2 個，Z 最多約 k 個，每次 O(log k)，k 輪共 O(k log k)。正確性：往下的路徑數字遞增，horizon 永遠含有還沒取出的最小值。考場想不到時寫 O(k log n) 的解，簡單、兩三行就拿大半分數。

### Range minimum query

陣列 6 7 2 5 3 8 9 4（n = 8，2 的冪），預處理後要快速回答 min(i..j)（例：min(2..5) = min(7, 2, 5, 3) = 2）。

- **極端一**：預先算好所有 (i, j) 的答案存進 hash，查詢 O(1)，空間約 n²。每格各掃一遍建表 O(n³)；從 [i, i] 往右長、新 min = min(舊 min, 下一個數)，建表 O(n²)。
- **極端二**：不預處理，查詢時從 i 掃到 j，O(n)。
- **Partial minima**：從中間切開，左半從中間往左累積最小值，右半從中間往右累積：
  ```
  陣列:         6  7  2  5 | 3  8  9  4
  累積最小值:   2  2  2  5 | 3  3  3  3
  ```
  查 min(2..6) 跨過中點：左邊那格的 2 與右邊那格的 3 取小，查兩個值就好。若 i、j 在同一半，就對那一半遞迴（6 7 2 5、3 8 9 4 各自再切）。空間 **S(n) = 2S(n/2) + n = O(n log n)**（和 merge sort 同一條遞迴式；寫成 n + S(n/2) 就錯了，兩半都要遞迴），查詢只看 2 個值，O(1)。

> **觀念** Pseudocode 越簡單越好：特例越少，bug 越少（每千行程式的 bug 數大約是常數）。練題時先自己想至少半小時再看解答，卡住的那段時間進步最多。

## 重點整理

- 演算法五特性：input ≥ 0、output ≥ 1、definiteness、finiteness、effectiveness；server 是 service 不是演算法。
- 演算法：design time、domain knowledge、任何人看得懂的語言、與硬體／OS 無關、priori analysis；程式：implementation time、程式語言、posteriori testing。
- Swap：時間 3、空間 3 word，都是 O(1)；每個簡單敘述 1 單位時間，每個變數 1 word。
- Gale–Shapley：最多 n² 次求婚；結果 perfect、stable、male-optimal（每個男生配到 best(m)）、female-pessimal；與挑男生的順序無關；誰求婚誰占優勢；台灣大學分發中考生是求婚方。
- GS 實作：free 男生用 linked list、Next、Current、女生的 Ranking array（反過來存），每圈 O(1)，總共 O(n²)；直接掃清單會變 O(n³)。
- Frequency count：for 條件 n + 1 次；Sum 2n + 3；矩陣相加 2n² + 2n + 1；矩陣相乘 2n³ + 3n² + 2n + 1（空間仍 O(n²)）。
- 迴圈：i++／i += c → O(n)；i *= 2、i /= 2 → O(log n)（次數 ⌈log₂ n⌉）；p += i、i*i < n → O(√n)；巢狀相乘、前後相接相加；內層 j < i → n(n−1)/2；前迴圈算 p = log n、後迴圈 log p → O(log log n)；外 n 內乘 2 → O(n log n)。
- Efficient = polynomial worst-case running time；primitive step 的工作量與 n 無關。
- O：T(n) ≤ c·f(n)；Ω：T(n) ≥ c·f(n)；Θ：c₁f(n) ≤ T(n) ≤ c₂f(n)，皆對 n ≥ n₀；lim T/f 為有限正數 ⇒ Θ。等號其實是 ∈。
- 能寫 Θ 就寫 Θ；O、Ω 給最接近的界；O、Ω、Θ 與 best／worst case 無關。
- 性質：transitivity（三者）、reflexivity（三者）、symmetry（只有 Θ）、transpose symmetry（f = O(g) ⇔ g = Ω(f)）、rule of sums 取 max、rule of products 相乘。
- 1 < log n < √n < n < n log n < n² < n³ < … < 2ⁿ < 3ⁿ < n! < nⁿ；n¹⁰⁰ 與 2ⁿ 約在 n ≈ 996 交叉。
- 比大小：取 log（取 log 後係數不能丟：2²ⁿ = 4ⁿ ≠ O(2ⁿ)）；a^(log_c b) = b^(log_c a)。
- log n! = Θ(n log n)；n! ≈ √(2πn)(n/e)ⁿ；log C(n, n/2) = Θ(n)。
- Linear search：best 1、worst n、average (n + 1)/2；BST worst case = 樹高 h，log n ≤ h ≤ n。
- 遞減型：T(n−1) + f(n) → n·f(n)；2T(n−1) + 1 = 2ⁿ⁺¹ − 1 = Θ(2ⁿ)；河內塔搬 2ⁿ − 1 次。aT(n−b) + f(n)：a < 1 → f(n)；a = 1 → n·f(n)；a > 1 → f(n)·a^(n/b)。
- 除法型：T(n/2) + 1 = Θ(log n)；T(n/2) + n = Θ(n)；2T(n/2) + n = Θ(n log n)（merge sort，每層 cn、共 log n + 1 層）。
- Master Theorem：比 log_b a 與 k（f = nᵏ logᵖ n）。大於 → n^(log_b a)；等於 → nᵏ logᵖ⁺¹ n（p = −1 → nᵏ log log n；p < −1 → nᵏ）；小於 → f(n)（p < 0 只給 O(nᵏ)）。Case 3 一般要檢查 a·f(n/b) ≤ c·f(n)、c < 1。
- T(√n) + 1 = Θ(log log n)：先換變數 m = log n 才能套 Master Theorem。
- 1D peak：Θ(n) → divide and conquer Θ(log n)；2D peak：greedy ascent Θ(nm)；欄找 1D peak 再列找是錯的；欄找最大值 Θ(n log m)。
- BST：find／insert／delete 都是 O(h)；successor 兩個 case；delete 有兩個孩子時換 successor 的 key（successor 沒有左孩子）；連續 n 次 successor 共 O(n)；range query O(log n + 輸出數)；augmentation 用 O(h) 維護換 O(1) 查詢。
- Hashing with chaining：SUH 下期望 Θ(1 + α)、α = n/m；worst case Θ(n)；universal hashing 保證碰撞機率 ≤ 1/m。
- Division method m 取質數、遠離 2 與 10 的次方；multiplication method a 取奇數。
- Table doubling：n > m 時放大成 2m 並 rehash（換新的 h）；n = m/4 時縮成一半；insert／delete 攤銷 O(1)，n ≤ m ≤ 4n；m + 1 的放大法是 Θ(n²)。
- Amortized T(n)：任意 k 次操作總時間 ≤ k·T(n)，與 average case 無關。
- Karp-Rabin：rolling hash 的 append、skip、r() 都 O(1)；hash = (hash·base − old·magic + new) mod p；skip 先 magic 乘 ibase；負數補 p·base；p 取接近 word 大小的質數，false positive 約 1/p；總時間 O(len(s) + len(t))。
- Open addressing：probe 序列必須是 permutation；DeleteMe（insert 當空、search 當滿）；linear probing 會 clustering；double hashing 要 h₂ 與 m 互質；期望 probe 次數 ≤ 1/(1 − α)，α 約 0.5 就 resize。
- 下界：秤假硬幣 h ≥ log₃ N（decision tree）；兩個已排序串列第 k 小 O(log k)；shifted array O(log n)；heap 第 k 小 O(k log k)（horizon）；range minimum 空間 2S(n/2) + n = O(n log n)、查詢 O(1)。

## 名詞對照

| 中文 | English |
|---|---|
| 演算法 | algorithm |
| 明確性 | definiteness |
| 有限性 | finiteness |
| 有效性 | effectiveness |
| 事前分析 | priori analysis |
| 事後測試 | posteriori testing |
| 領域知識 | domain knowledge |
| 虛擬碼 | pseudocode |
| 穩定配對 | stable matching |
| 偏好清單 | preference list |
| 完美配對 | perfect matching |
| 不穩定配對 | unstable pair |
| 延後決定 | deferred decision making |
| 反證法 | proof by contradiction |
| 數學歸納法 | induction |
| 有效配偶 | valid partner |
| 對男性最佳 | male-optimal |
| 最悲觀 | pessimal |
| 區間排程 | interval scheduling |
| 二分圖配對 | bipartite matching |
| 獨立集 | independent set |
| 競爭式設施選址 | competitive facility location |
| 近似演算法 | approximation algorithm |
| 局部搜尋 | local search |
| 隨機演算法 | randomized algorithm |
| 網路流 | network flow |
| 動態規劃 | dynamic programming |
| 貪婪演算法 | greedy algorithm |
| 各個擊破 | divide and conquer |
| 暴力法 | brute force |
| 次數計算法 | frequency count method |
| 多項式時間 | polynomial running time |
| 基本計算步驟 | primitive computational step |
| 可擴展性 | scalability |
| 漸近分析 | asymptotic analysis |
| 上界／下界／緊界 | upper bound / lower bound / tight bound |
| 遞移性 | transitivity |
| 反身性 | reflexivity |
| 對稱性 | symmetry |
| 轉置對稱 | transpose symmetry |
| 加法規則／乘法規則 | rule of sums / rule of products |
| 瓶頸 | bottleneck |
| 常數／對數／線性／平方／立方／指數／階乘 | constant / logarithmic / linear / quadratic / cubic / exponential / factorial |
| 次線性 | sublinear |
| 最好／最壞／平均情況 | best case / worst case / average case |
| 二元搜尋樹 | binary search tree (BST) |
| 左斜樹 | left skewed tree |
| 遞迴關係式 | recurrence relation |
| 反覆代換 | back substitution |
| 遞迴樹 | recursion tree / tracing tree |
| 等比級數 | geometric (GP) series |
| 河內塔 | Tower of Hanoi |
| 主定理 | Master Theorem |
| 正則條件 | regularity condition |
| 計算模型 | model of computation |
| 隨機存取機 | random access machine (RAM) |
| 指標機 | pointer machine |
| 文件距離 | document distance |
| 內積 | inner product / dot product |
| 峰值 | peak |
| 貪婪爬升 | greedy ascent |
| 表示不變量 | representation invariant (RI) |
| 完全二元樹 | complete binary tree |
| 後繼／前驅 | successor / predecessor |
| 擴充 | augmentation |
| 抽象資料型別 | abstract data type (ADT) |
| 字典 | dictionary |
| 直接存取表 | direct access table |
| 前置雜湊 | prehashing |
| 雜湊函數 | hash function |
| 碰撞 | collision |
| 鴿籠原理 | pigeonhole principle |
| 鏈結法 | chaining |
| 簡單均勻雜湊 | simple uniform hashing |
| 負載因子 | load factor |
| 除法法／乘法法 | division method / multiplication method |
| 通用雜湊 | universal hashing |
| 表格加倍 | table doubling |
| 攤銷分析 | amortized analysis |
| 字串比對 | string matching |
| 滑動視窗 | sliding window |
| 滾動雜湊 | rolling hash |
| 偽陽性 | false positive |
| 乘法反元素 | multiplicative inverse |
| 開放定址 | open addressing |
| 探測 | probing |
| 線性探測 | linear probing |
| 群聚 | clustering |
| 雙重雜湊 | double hashing |
| 均勻雜湊假設 | uniform hashing assumption |
| 密碼學雜湊 | cryptographic hash |
| 單向 | one-way |
| 抗碰撞 | collision resistance |
| 決策樹 | decision tree |
| 區間最小值 | range minimum |
