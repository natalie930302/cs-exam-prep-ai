# 複雜度分析

同一個問題常有好幾個都正確的解法，差別在輸入變大以後跑得多快、用掉多少記憶體。這章先建立演算法、pseudocode、資料結構與 ADT 這些基本觀念，再學怎麼量一個程式的空間 S(P) 與時間 T(P)（數 program step），最後用 Big-O、Ω、Θ 描述成長趨勢。考試最常考的是用定義找 c 和 n₀ 證明漸近關係，以及判斷常見函數的成長順序。

## 學完這章要會
- 說出演算法的五個條件，並用 loop invariant 證明一個迴圈演算法的正確性
- 手動追蹤 selection sort、binary search（含遞迴版）與遞迴排列 perm
- 分辨 data structure、ADT 與實作；說出 system life cycle 的階段
- 算 S(P) = c + S_P：迴圈版與遞迴版加總的額外空間
- 用 count 法與 tabular method 數 program step（sum、rsum、矩陣加法）
- 寫出 Big-O、Ω、Θ 的定義，並用 c、n₀ 證明或否證，例如 3n+2 = O(n)、10n²+4n+2 = O(n²)
- 排出 log n < √n < n < n log n < n² < 2ⁿ 等常見函數的成長順序

## 從一個例子看時間複雜度：判斷質數

### 問題與兩種解法

時間複雜度（time complexity）是什麼？為什麼重要？先看一個故事。

Ram 和 Shyam 拿到同一份作業：給一個正整數 n，判斷它是不是質數（prime）。

- 質數：恰好只有兩個因數，1 和它自己。例如 7 只能被 1 和 7 整除。
- 最小的質數是 2，接著是 3、5、7、11……
- 1 不是質數：能整除 1 的只有 1 自己，湊不到兩個因數。

**Ram 的解法**：用 2、3、4、……一路試到 n−1，只要有任何一個數能整除 n，n 就有別的因數，不是質數；全部都除不盡，n 就是質數。

**Shyam 的解法**：只要試到 √n 就夠了。若 2 到 √n 之間沒有任何數整除 n，n 就是質數。

為什麼試到 √n 就夠？若 n = a × b，a 和 b 不可能都大於 √n（否則 a × b > √n × √n = n），所以一定有一個因數 ≤ √n。只要 √n 以內找不到因數，√n 以上也不會有。

```python
def is_prime_ram(n):          # 試除到 n-1
    if n < 2:
        return False          # 1 不是質數，另外處理
    for i in range(2, n):     # i = 2, 3, ..., n-1
        if n % i == 0:
            return False
    return True

def is_prime_shyam(n):        # 試除到 √n
    if n < 2:
        return False
    i = 2
    while i * i <= n:         # i ≤ √n
        if n % i == 0:
            return False
        i += 1
    return True
```

> **重點** 兩種解法都正確（1 的特例另外處理）。差別不在對錯，而在輸入變大之後的快慢。

### 代入數字

為了好算，假設電腦每做一次除法花 1 毫秒（ms），做幾次除法就花幾毫秒。

看**最壞情況（worst case）**：n 剛好是質數，迴圈不會中途找到因數而提早停下。

- Ram：從 2 試到 n−1，共 **n−2** 次除法。
- Shyam：從 2 試到 ⌊√n⌋，約 **√n − 1** 次除法。

| n | Ram 除法次數 | Ram 時間 | Shyam 除法次數 | Shyam 時間 |
|---|---|---|---|---|
| 11 | 11−2 = 9 | 9 ms | √11 ≈ 3.3，只試 2、3，共 2 次 | 2 ms |
| 101 | 101−2 = 99 | 99 ms | √101 ≈ 10.05，試 2～10，共 9 次 | 9 ms |
| 10⁶+3（七位數質數） | ≈ 10⁶ | 10⁶ ms = 10³ 秒 ≈ 16.66 分鐘 | ≈ √10⁶ = 10³ | 10³ ms ≈ 1 秒 |
| 10¹⁰+19（十一位數質數） | ≈ 10¹⁰ | 10¹⁰ ms = 10⁷ 秒 ≈ 115 天多 | ≈ √10¹⁰ = 10⁵ | 10⁵ ms = 100 秒 ≈ 1.66 分鐘 |

換算細節：

- 10⁶ ms = 10³ 秒；10³ ÷ 60 ≈ 16.66 分鐘。
- 10¹⁰ ms = 10⁷ 秒；10⁷ ÷ 86400（一天的秒數）≈ 115.7 天，跑四個月才有答案，完全不能用。
- n 很大時，「−2」「−1」這種小常數可以放心忽略。

> **陷阱** n = 11、101 這種小輸入，9 ms 對 2 ms、99 ms 對 9 ms 都不到一秒，看不出誰好。比較演算法一定要看 **n 很大**時的表現。

若用對數刻度畫成長條圖（每高一格代表多 10 倍），n 越大，兩條柱子的差距越驚人：同一題、同樣正確，Shyam 1.66 分鐘，Ram 要 115 天。

### 時間複雜度的直覺：O(n) 與 O(√n)

**時間複雜度**衡量的是：輸入變大時，程式花的時間**成長得多快**。

- Ram 的時間與 n 成正比：n 變兩倍，時間也約變兩倍，畫出來是一條直線。稱為 order of n 的演算法，記作 **O(n)**。
- Shyam 的時間與 √n 成正比：n 變 100 倍，時間只變 10 倍，曲線越走越平。記作 **O(√n)**。

這個 O 叫 **Big-O**，嚴格的數學定義在本章最後。

> **重點** Big-O 只保留主導項：n−2 的「−2」、√n−1 的「−1」，以及「每次除法 1 ms」這種機器常數，全部丟掉。

> **觀念** 程式正確只是基本要求，不是唯一重要的事；還要看大輸入時的表現。寫程式時應該一直追求 n 很大也跑得好的解法。

## 演算法是什麼

### 定義與比喻

演算法（algorithm）就是**解決問題的方法**。

> **比喻** 演算法是一種「譜」。學樂器有樂譜，告訴你怎麼演奏；武俠小說有暗器譜；學做菜有食譜。每一種譜都在描述「怎麼做一件事」。演算法就是「程式譜」：描述怎麼計算、怎麼寫程式。

寫程式就是對電腦下指令；演算法說明要下哪一串指令、照什麼步驟。照著步驟走，電腦就能**正確**又**有效率**地算出結果，這兩點是大部分演算法的目標。

### 演算法的五個條件

演算法的五個條件（criteria）由 Stanford 退休教授 Knuth 提出：

| 條件 | 意義 | 說明 |
|---|---|---|
| Input（輸入） | 演算法接收的資料 | 少數短程式可以沒有輸入（零個或多個 input） |
| Output（輸出） | 運算後得到的結果 | 至少一個 output；隱含「要正確」：給定 input 要得到對的 output，不能隨便吐答案 |
| Definiteness（明確性） | 每一步都清楚、不模稜兩可 | 像食譜寫「打蛋」，廚師一看就懂；演算法也要讓 programmer 一看就懂 |
| Effectiveness（有效性） | 每一步都是電腦做得到的基本操作 | 不能天馬行空變魔術；做不做得到與平台有關，例如平行演算法放在平行平台可以，拿到一般平台就做不到 |
| Finiteness（有限性） | 照步驟執行，一定在有限步內停下 | 不能跑到天荒地老 |

input 和 output 合起來，就反映出要解的問題。例如排序（sorting）問題：input 是一堆數字，output 也是一堆數字，但要由小到大（或由大到小）排好；能解它的演算法有 bubble sort、selection sort 等。

> **重點** 記法：definiteness 是給**人**看的（看得懂），effectiveness 是給**電腦**做的（做得到）。

> **陷阱** Finiteness 不是「程式碼行數有限」。兩三行就能寫出無窮迴圈；它說的是**執行步驟**有限、最後一定會停。這很常考。

> **陷阱** 五個條件裡**沒有**「有效率」這一條。暴力法（brute force）只要滿足五個條件，也是演算法。Effectiveness 指「每步做得到」，不是「有效率」。

## 第一個演算法：找最小值的位置

### 問題與程式

手上有一個 array（陣列），要找出最小值所在的位置（index）。例如最小的 2 在第 5 格，就回傳 5。

做法：先假設第 0 個最小，把它的位置「抓在手上」（存在變數 m）；接著從第 1 個開始逐一和手上那個比，發現更小的，就把手上的換成新位置；全部比完，回傳手上的位置。

```c
int getMinIndex(int arr[], int len)
{
    int m = 0;                      /* 先假設第 0 個最小 */
    for (int i = 1; i < len; i++)
        if (arr[i] < arr[m])        /* 看到更小的就換手 */
            m = i;
    return m;
}
```

> **例題** arr = {7, 5, 9, 4, 8, 2, 6}，len = 7，追蹤 m 的變化。

```
初始        m = 0  (arr[0] = 7)
i = 1  5 < 7  → m = 1
i = 2  9 < 5 ? 否 → m = 1
i = 3  4 < 5  → m = 3
i = 4  8 < 4 ? 否 → m = 3
i = 5  2 < 4  → m = 5
i = 6  6 < 2 ? 否 → m = 5
回傳 5（arr[5] = 2 是最小值）
```

### 用五個條件檢查

- Input：array 和它的長度；Output：最小元素的 index。
- Definiteness：用 C 寫成，懂 C 的人都看得懂。
- Effectiveness：compiler 會把 for、if 翻成一般平台的機器碼，電腦做得到。
- Finiteness：只有一個 for 迴圈，只要輸入正常（長度為正整數），一定會停。
- 輸出正確：最難的一項。要說服別人答案一定對，需要數學證明（proof）。

## 證明正確性：loop invariant

### 把「正確」寫成數學命題

第一步，把「正確」寫成一句能判斷真假的話：

回傳的 m 滿足：對所有 0 ≤ j < len，arr[m] ≤ arr[j]。也就是 arr[m] 不比任何其他元素大，是最小值。

迴圈要跑 len−1 輪（len = 1000 就要跑將近 1000 輪），直接證不好下手。技巧是改證「**每一輪迴圈結束時成立什麼**」。

觀察：一開始手上抓著位置 0；第 1 輪比第 1 個和第 0 個，留下小的；第 2 輪拿第 2 個和手上的比……每一輪就是多檢查一個。所以：

> **重點** 命題 P(k)：第 i = k 輪結束時，m 存的是 arr[0..k] 裡最小值的位置。例如 k = 5566，代表 arr[0] 到 arr[5566] 這段的最小值都看過、記下來了。

### 用數學歸納法證明

1. 基底（i = 1）：這輪只比了 arr[0] 和 arr[1]，留下較小者的位置，P(1) 成立，容易驗證。
2. 歸納假設：設 P(k) 成立，即第 k 輪結束時 m 是 arr[0..k] 最小值的位置。
3. 歸納步驟（i = k+1）：程式比較 arr[k+1] 與 arr[m]。
   - 若 arr[k+1] < arr[m]，m 改成 k+1；它比 arr[0..k] 的最小值還小，所以是 arr[0..k+1] 的最小值。
   - 否則 m 不變；arr[m] ≤ arr[k+1]，又是 arr[0..k] 的最小值，所以仍是 arr[0..k+1] 的最小值。
4. 故 P(1)、P(2)、……一路到 P(len−1) 都成立。迴圈結束時 m 是 arr[0..len−1] 的最小值位置，演算法正確。

這種「每輪迴圈結束時都維持成立的性質」叫 **loop invariant（迴圈不變量）**，是之後證明演算法正確性的重要工具。這類在離散結構上推論的證明方法，離散數學會更完整地教。

## 效率：淘汰賽與平行化

Knuth 的五個條件沒有列出效率（efficiency），但讓電腦算得快一直是潛藏的願望。效率要問的是：**array 變成 2 倍、10 倍大時，要多花多少時間？**

### 另一種找最小值：淘汰賽

兩兩比較，像淘汰賽（knockout tournament）：第 0、1 個比，第 2、3 個比，第 4、5 個比，第 6、7 個比，小的晉級、大的淘汰。

```
第 1 輪：  7  5   9  4   8  2   6  3
           \ /    \ /    \ /    \ /
第 2 輪：   5      4      2      3
             \    /        \    /
第 3 輪：      4             2
                 \         /
冠軍：               2
```

- 每畫一場比賽，電腦就做一次比較。8 筆資料比了 4 + 2 + 1 = **7** 次。
- 逐一掃描（前面的 for 迴圈）也是 **7** 次。

> **重點** n 個數找最小值，不論逐一掃描或淘汰賽，都需要 **n−1** 次比較：每淘汰一個人就得打一場，要淘汰 n−1 人。

### 淘汰賽會比較慢嗎？

問：淘汰賽比較次數一樣，會不會反而比較慢？
答：比較次數同樣是 7 次，但可能有**隱藏成本**：每場的結果要先存起來，存取要時間；寫成程式也可能多些變數、迴圈。所以「有可能」比較慢，但要嚴謹說出為什麼並不容易。

### 淘汰賽的優點：可平行化

同一輪的比賽彼此無關，可以**高度平行化**。假設電腦有 4 顆 CPU，第 1 輪 4 場同時比，一個單位時間就打完一輪；8 個數只要 3 輪（log₂ 8 = 3）就分出冠軍，而逐一掃描要 7 個單位時間。

> **觀念** 現代演算法的效率與平台高度相關：同樣的比較次數，在平行平台上可能快很多。

## Pseudocode：電腦科學的口語

### 為什麼用 pseudocode

程式碼規定得很嚴（要讓 compiler 看得懂），拿來和人溝通不一定有效率。所以電腦科學更常用 **pseudocode（虛擬碼）**——「假的」程式，也是寫演算法這份譜最常見的方式。

> **比喻** pseudocode 像口語。中文、英文都有嚴謹的文法，但平常說話沒那麼講究，意思一樣講得清楚。

getMinIndex 的 pseudocode：

```
GET-MIN-INDEX(arr, len)      // arr: 一個 integer array
  minimum_position ← 0
  for i from 1 to len−1
      if arr[i] < arr[minimum_position]
          minimum_position ← i
  return minimum_position
```

- 輸入就寫「一個 integer array」，不用管 C 的指標。
- `←` 是 assignment（賦值）：把右邊的值放進左邊。各語言賦值符號不同（C 用 `=`）；pseudocode 想強調「放進去」，常用左箭頭。簡報或純文字裡打不出箭頭時，常寫成 `<-`。
- `for i from 1 to len−1` 不綁定任何語言，不用分號、大括號，也不用先宣告 i。
- 重點是把意圖講清楚：先初始化、跑一個迴圈、某條件成立時更新。

問：pseudocode 和在程式裡寫註解差在哪？
答：pseudocode 本來就不必是完整嚴格的程式。程式一大就會發現，嚴格的程式碼不是最好的溝通方式，光寫變數宣告就很煩。

問：C 的語法人人一樣，pseudocode 卻人人不同，是因為程式還太小嗎？
答：是。程式一變大、變複雜，光讀程式碼去搞懂別人在做什麼就不夠了，需要更貼近意圖的描述。

### 三種不好的 pseudocode

好的 pseudocode 沒有硬性規定，反過來先看不好的：

1. **太詳細**：細節塞太多，反而看不出真正意圖。例如只想比兩個值，一行就能寫完，卻先放進兩個新變數再比，像在講廢話。所以上面連 i 的宣告都拿掉——C 一定要宣告，但意圖已藏在 for 迴圈裡。
2. **太神秘**：每行都看得懂，合起來卻看不出在做什麼。上面特意把變數取名 minimum_position，名字本身就說明用途；若改成 `a ← 0`、`for b …`、`if arr[b] < arr[a]`，就看不出意圖。變數一路取 a、b、aa、bb、cc、dd，或 XXYY、tmp、tmp2、tmp3，都是同樣的毛病。
3. **太抽象（惜字如金）**：例如只寫一句「run a loop that updates minimum position in every iteration」，多數人看不懂到底怎麼更新。

> **重點** pseudocode 的目標是 **communicate correctly**（正確地溝通）：靠好的命名或註解傳達意圖，在字太少與字太多之間取得平衡。

## Selection sort（選擇排序）

### 概念

從 getMinIndex 出發，可以升級成一個排序演算法：**selection sort**。selection 就是「選」：每一輪從還沒排好的元素裡選出最小的，放到它該在的位置。

另一種說法：數字分成 **sorted**（已排序）和 **unsorted**（未排序）兩堆，每輪從 unsorted 找出最小的，接到 sorted 的尾巴。

```
SELECTION-SORT(arr, len)     // arr: integer array；len: array 長度
  for i from 0 to len−2
      // 在 arr[i..len−1] 這個範圍裡找最小值的 index
      m ← GET-MIN-INDEX(arr[i..len−1]) 對應的 index
      swap arr[i] 與 arr[m]
```

第 0 小的放第 0 位，剩下最小的放第 1 位，第 2 小的放第 2 位……做完 array 就排好了。這樣的 pseudocode 沒有嚴格定義，但多數程式設計師都看得懂；手寫作業也常要求用 pseudocode 描述想法。

寫成 C：外層 for 和 pseudocode 一樣，內層 for 在 unsorted 部分找最小值的位置 min，再 swap。

```c
#define SWAP(x, y, t) ((t) = (x), (x) = (y), (y) = (t))

void sort(int list[], int n)
{
    int i, j, min, temp;
    for (i = 0; i < n - 1; i++) {
        min = i;
        for (j = i + 1; j < n; j++)      /* 在 list[i..n-1] 找最小 */
            if (list[j] < list[min])
                min = j;
        SWAP(list[i], list[min], temp);  /* 換到第 i 個位置 */
    }
}
```

> **觀念** 看不懂一段程式時，把它寫進 Visual Studio 這類 IDE，編譯後丟一堆數字進去跑、設中斷點 debug，就能看懂它怎麼運作。

### 例題：34、8、64、51、32、21

> **例題** 用 selection sort 由小到大排序 A = 34, 8, 64, 51, 32, 21，寫出每一輪結束後的序列（[ ] 內為已排好的部分）。

```
初始      34   8  64  51  32  21
第 1 輪   min = 8（A[1]），與 A[0]=34 交換
          [8]  34  64  51  32  21
第 2 輪   在 34 64 51 32 21 中 min = 21（A[5]），與 A[1]=34 交換
          [8  21]  64  51  32  34
第 3 輪   在 64 51 32 34 中 min = 32（A[4]），與 A[2]=64 交換
          [8  21  32]  51  64  34
第 4 輪   在 51 64 34 中 min = 34（A[5]），與 A[3]=51 交換
          [8  21  32  34]  64  51
第 5 輪   在 64 51 中 min = 51（A[5]），與 A[4]=64 交換
          [8  21  32  34  51]  64
結果      8  21  32  34  51  64
```

> **陷阱** 常見考題「第一輪結束後的序列」：答案是 8, 34, 64, 51, 32, 21，只有 8 和 34 互換，其他位置不動。

### 比較次數

第 1 輪在 n 個裡找最小要比 n−1 次，第 2 輪 n−2 次……最後一輪 1 次：

(n−1) + (n−2) + … + 1 = n(n−1)/2

所以 selection sort 的時間複雜度是 **Θ(n²)**（證明見本章最後的 Θ 一節）。不論輸入是否已排好，比較次數都一樣。

### 排序有很多種，誰最快？

selection sort、bubble sort、quick sort、merge sort……設計理念不同，但都能解決排序。

- 以比較為基礎（comparison-based，靠兩兩比大小）的排序，比較次數最少可以壓到約 **n log n**。
- quick sort：**平均** Θ(n log n)，**最壞** Θ(n²)（例如每次 pivot 都選到最大或最小）。
- 最壞情況也保證 Θ(n log n) 的是 **merge sort** 和 **heap sort**。
- 不靠比較的方法，如 radix sort、bucket sort：依位數或值的範圍，把資料分配到 bucket 再收集。因為不用兩兩比較，可以比 n log n 更快。

> **陷阱** quick sort 不是「不管平均或最壞都 n log n」：最壞是 n²。radix sort 也不是 hash：它是依位數做 stable 的分配與收集。

> **重點** 比較式排序在最壞情況下的下界是 **Ω(n log n)**。

## 搜尋問題與 binary search

### 從 naive 方法出發

搜尋問題：給一堆數字，使用者問「6 在不在裡面？」要回答有沒有，或它在哪裡。

最笨的方法：n 個數字一個一個驗明正身，叫**線性搜尋（linear search）**，效率不好。

> **觀念** 最笨的方法很重要。解題、做研究時先問：最 naive 的方法是什麼？有了 naive 方法，就會產生一些觀察，引導你找到更好的方法（naive plus）。這就是思考：先弄清楚要解的問題，先想最 naive 的解，再從觀察中改進。

搜尋的 naive plus 就是 **binary search（二分搜尋）**，基於二分法。

- 要件：數字必須**先排好序**。
- array 排好序後，可用 index 直接抓中間那格，這是二分搜尋的「偷吃步」。

> **陷阱** binary search 是一個演算法；binary search tree（二元搜尋樹）是一種樹狀資料結構。兩者不同。

### 例題：找 6 與找 25

> **例題** 排好序的 array 存 0 到 28 的偶數（共 15 個，index 0～14）。分別搜尋 6 與 25。

```
index:  0  1  2  3  4  5  6  7  8  9 10 11 12 13 14
value:  0  2  4  6  8 10 12 14 16 18 20 22 24 26 28
```

找 6：

```
left right middle  list[middle]  比較
 0    14     7         14        6 < 14 → 往左半，right = 6
 0     6     3          6        6 = 6  → 找到，回傳 3
```

6 比中間的 14 小，所以 6 一定在左半；右半都比 14 大，不用找。左半再切一刀剛好是 6，回報它在第 3 個位置（從 0 開始數）。

找 25：

```
left right middle  list[middle]  比較
 0    14     7         14        25 > 14 → 往右半，left = 8
 8    14    11         22        25 > 22 → 往右半，left = 12
12    14    13         26        25 < 26 → 往左半，right = 12
12    12    12         24        25 > 24 → 往右半，left = 13
13    12     -          -        left > right，範圍空了 → 找不到
```

最後只剩 24，也不是 25，就回報「沒有 25」。

> **重點** 每比一次範圍就砍一半，n 個數最多約比 log₂ n 次，時間 **O(log n)**；前提是資料已排序。

### 其他搜尋方法

- 把數字建成一棵 binary search tree，在樹上走，看數字在不在。
- hash：用 hash function 把數字丟進對應的 bucket，查的時候用同一個 function 去找。

光是「找一個數在不在」，就能想出好多種演算法。

### Binary search 的 pseudocode 與程式

演算法想好（先排序、每次找中間、切一半）之後，實作前先寫 pseudocode：

```
BINARY-SEARCH(list, searchnum, n)
  left ← 0;  right ← n−1
  while 還有數字沒檢查（left ≤ right）
      middle ← ⌊(left + right) / 2⌋
      if searchnum < list[middle]
          right ← middle − 1          // 找左半
      else if searchnum = list[middle]
          return middle               // 找到
      else
          left ← middle + 1           // 找右半
  return −1                           // 找不到
```

「找左半邊」就是把右邊界 right 設成 middle − 1（例如 14 的前一格）；「找右半邊」就是把左邊界 left 設成 middle + 1。

pseudocode 確定可行，再換成 C／C++ 的格式就能執行，兩者幾乎一樣。另一種常見寫法用 COMPARE 巨集搭配 switch-case：

```c
#define COMPARE(x, y) (((x) < (y)) ? -1 : ((x) == (y)) ? 0 : 1)

int binsearch(int list[], int searchnum, int left, int right)
{   /* 迭代版：沒有用遞迴 */
    int middle;
    while (left <= right) {
        middle = (left + right) / 2;
        switch (COMPARE(list[middle], searchnum)) {
            case -1: left = middle + 1;  break;  /* 中間的數比目標小 → 右半 */
            case  0: return middle;              /* 找到 */
            case  1: right = middle - 1;         /* 中間的數比目標大 → 左半 */
        }
    }
    return -1;                                   /* 找不到 */
}
```

遞迴版見後面的「遞迴」一節。

## Selection problem：找第 k 大

### 問題

**selection problem（選擇問題）**：給 N 個數字和一個 k，輸出第 k 大的數。k = 1 就是最大的；排序後依序是第一大、第二大……第 k 大。

- input：一堆數字 + k（以下例子 k = 3）
- output：第 k 大的數字

### 兩種方法

**方法一（naive）**：把 n 個數放進 array，由大到小排序，取位置 k 的那個。例子中第 3 大是 45。

**方法二**：只拿 k 個數進來，由大到小排好（array 大小只有 k）；其餘數字逐一和這 k 個的**最後一個**比：

- 比最後一個小 → 直接丟掉。
- 比最後一個大 → 插到適當位置，原本的最後一個被擠掉。
- 全部比完後，最後一個就是第 k 大。

```
先取 12, 45, 7 → 由大到小排成   [45, 12, 7]
下一個 33：33 > 7，插入適當位置 → [45, 33, 12]（7 被擠掉）
之後每個數都和最後一格比：小就丟，大就插入
全部比完 → 最後一格就是第 3 大（此例為 45）
```

### 哪個比較好？

兩個方法都對，一個要排序 n 個數，一個只排序 k 個。直覺上 n 遠大於 k 時方法二較好，但要仔細算：

- 方法一：排序 O(n log n)。
- 方法二：排 k 個 O(k log k)；其餘 n−k 個數，每個大的數插進來最壞要挪 k 格，共 O((n−k)·k)。合計最壞 **O(nk)**。

> **陷阱** n ≫ k 時方法二**不一定**比較好。只有 k 很小（小於約 log n）時，O(nk) 才比 O(n log n) 快；k 一大反而比較慢。

> **觀念** selection problem 和 sorting problem 不同，但可以借用排序的方法來解。學過的演算法會變成你的知識，面對新問題時回想哪些能拿來用——這就是站在巨人的肩膀上。拿既有的排序，加上兩三個自己的步驟，新解法就出來了，這也是在創造知識。

## 資料結構：收納資料的方式

### 定義與比喻

**data structure（資料結構）** 是在電腦裡整理資料的方式：organizing your data。

> **比喻** 整理就是「收納」。衣櫃收納衣服、廚房櫃子收納調味料、冰箱收納食物（food structure）、交響樂團的座位對應樂譜（player structure）。每個人的衣櫃都不一樣：有人依顏色分門別類，有人洗好就整欄丟進去。

回到電腦：algorithm 把 input 變成 output，這些 data 怎麼擺、怎麼收、放在記憶體還是磁碟，就是資料結構。

> **例題** 200 份考卷要發回，怎麼收最好？
> - 方法一：隨便疊，照交卷或改完的順序放。
> - 方法二：依分數由高到低排。容易看分數分布，也方便處理不及格的考卷。
> - 方法三：依學號排。手寫登記成績時，照學號逐一登記最方便。
> - 方法四：依學號尾數分成 10 堆。發考卷時每人去自己那堆找，快很多（就像依身分證字號尾數奇偶分流領口罩，收納的是排隊人潮）。
> 哪種最好？看使用情境。電腦也一樣：用什麼資料結構，取決於要解的問題。

### 收得好，演算法就快

想設計有效率的演算法，可以從收納資料的方式下手。

selection sort 最花力氣的步驟是「在一堆東西裡找出最小的」。1000 筆資料亂放，要逐一找，花 1000 的力氣；若用特別的方式排好（例如之後的 heap），只要約 10 的力氣——因為 log₂ 1000 ≈ 10，也就是每次取出最小值 O(log n)。從 1000 變成 10，selection sort 就快得多。

> **比喻** 演算法像食譜，資料結構像廚房裡調味料和食材的擺法。要做出好菜，廚房也要收好，快炒時才不會找不到調味料。

### get、insert 與維護

每個資料結構至少要有兩個操作：

- **get**：把東西拿出來。
- **insert**：把東西放進去。

get 和 insert 本身就是程式（演算法）。例如依顏色分類的衣櫃，放衣服前要先看顏色決定放哪；如果還要照大小排，就要先檢查大小再塞到適當位置。常用的東西放在快拿到的地方，整體效率就會比較好。

可以這樣想：資料結構定了一套**規則**。怎麼放才一直符合規則？怎麼拿到最想要的？此外還要**維護（maintain）**規則：一開始的建構，以及拿走或放入之後的調整。

> **例題** 規則是「每疊衣服差不多一樣高」。一疊 5 件、一疊 4 件還可以；再從 4 件那疊拿走一件剩 3 件，跟 5 件差太多，就要調整。get 像偷看最上面是什麼；真的拿走就改變了狀態，之後要維護規則。

> **重點** 規則要有程式碼去維護，這些程式碼也是演算法。資料結構最隱藏的力氣就是維護：get 看起來又快又簡單，維護卻常要花不少力氣。

兩個重點：一、資料結構是收納資料的方式；二、資料結構和演算法相輔相成。

### 演算法與資料結構的關係

問：演算法和資料結構是什麼關係？
答：

- 演算法在解決問題：運用設計理念（如 greedy 貪婪法）設計出解法，用 pseudocode 寫下來。演算法比較上層。
- 資料結構關心怎麼把演算法 implement（實作）出來，方式有 array、linked list、tree、hash 等，往下談實作細節。
- 兩者互相影響：用不同的資料結構，效率就不同；懂資料結構，也可能幫你找到更好的演算法。

因為兩者互相依賴、不容易分開教，常合成一門「資料結構與演算法」：先以實作為主；練熟後，「演算法設計與分析」再用數學模型分析不同演算法的特性。

## Data abstraction 與 ADT

### Data type：object、attribute、operation

C 裡的 struct 可以想成一筆 **data record（資料紀錄）**。例如 student 有三個欄位：學號 id、名字 name、分數 grade。從這個型態可以知道兩件事：object 叫什麼，以及它有哪些 **attribute（屬性）**。

```c
struct student {
    int   id;        /* 學號 */
    char  name[20];  /* 名字 */
    float grade;     /* 分數 */
};
```

data type 也有 **operation（操作）**：例如 integer 能加減乘除、取餘數、判斷相等。它佔多少空間看實作定義（例如 character 1 byte、integer 4 bytes）。但真正重要的，是知道這個 data type **能做哪些事**。

> **觀念** C 常被嫌漏洞多，但它非常強大：UNIX、Linux 都是用 C 寫的。

### ADT（abstract data type）

**ADT（抽象資料型態）**：只描述「objects 是什麼」和「能做哪些 functions」，**machine independent（與機器無關）**，也 **implementation independent（與實作無關）**。

```
ADT NaturalNumber
  objects:   0 到電腦能表示的最大整數（INT_MAX）之間的有序整數
  functions: 對所有 x, y ∈ NaturalNumber
    Zero()        ::= 0
    IsZero(x)     ::= if (x == 0) TRUE else FALSE
    Add(x, y)     ::= if (x + y <= INT_MAX) x + y else INT_MAX
    Equal(x, y)   ::= if (x == y) TRUE else FALSE
    Successor(x)  ::= if (x == INT_MAX) x else x + 1
    Subtract(x, y)::= if (x < y) 0 else x − y
end NaturalNumber
```

用 integer、float 還是 character 去存，都和這份規格無關。這就是 ADT 的精神：跳脫實作，只講「它是什麼、能做什麼」。

### Implementation dependent 的例子

把 array x 的值複製給 z：

```c
for (i = 0; i < n; i++)
    z[i] = x[i];
```

不管是 char 版還是 int 版，這兩行完全一樣。若綁在實作上（implementation dependent），就得說明 char 和 int 各佔多少 memory、memory 的哪個位置要 copy 到 z 的哪個位置，非常瑣碎。資料結構希望跳脫這些細節，直接講出概念：「把 x 給 z」。描述 array 也是如此：只講它有哪些 function（例如查 size、哪裡是開頭和結尾）。

### 演算法才是根本，語言只是工具

演算法對應的就是 ADT 裡的 function：在找解決問題的方法。流程是：

問題（ADT 的 function）→ 演算法 → pseudocode（可順便分析 complexity，複雜度）→ 換成某個語言的格式

從 pseudocode 到程式，差的頂多是語言格式，所以演算法和 C++、Java 無關。

> **例題** 假設你想出一個比所有搜尋法都好的方法，叫 My Search。先寫成 pseudocode，用最熟的 Python 很快就能做出來；要換語言，只是查表：查 while、for 在那個語言怎麼寫。

> **觀念** 不要為了學語言而學語言。最根本的是學會解決問題；有這能力，新語言再多也不怕。目的應該反過來：「我有個演算法想做成 iPhone app，所以才去學 Objective-C（Android app 則用 Java）」。也別問題還沒想清楚就急著開 IDE；先想清楚、寫 pseudocode，再寫程式。

## Programming 與 system life cycle

### Programming 不只是 coding

資工系不開十門語言課（C、Python、MATLAB 各一門），因為重要的不是語言，而是依應用情境掌握各平台的重要概念；系統程式、作業系統、計算機結構等必修，都在幫你認識不同平台。

> **比喻** programming 和 coding 不同。用蓋房子比：programming 是從設計圖一路到交屋；coding 只是其中的木工、水泥工。

Programming 的流程：

1. **Requirement（需求）**：要做什麼、什麼重要。
2. **Analysis（分析）**：怎麼做比較好、怎麼做比較不好。
3. **Design（設計）**：根據分析畫出藍圖。
4. **Refine（修正）**。
5. **Coding**：真正寫程式。
6. **Proof／testing／debug**：說明它為什麼是好的（像房子蓋好要做防水檢查）；testing 要自己測好，不要只靠批改系統。

C 程式設計的需求和分析都很簡單；資料結構與演算法開始走向 analysis 與 design，並帶入 proof——接到題目先想好，免得讓電腦跑到天荒地老還跑不完。目標是從 coding 走到 designing。實務上資深工程師主要做的是分析與設計（也就是 programming），寫 code 的比例反而少。練習建議：入門階段刷 LeetCode 太早，不如找 Online Judge 或生活中有趣的問題來解。

### 一個 system：小型搜尋引擎

> **例題** tiny search engine 是一個 system，要做三件事：撈網頁、分析內容建 index、處理使用者的 query 並顯示結果。這三步就是 system 的 requirements。從使用者看：輸入一個 query word，拿回一些 web page，這就是系統的 input 與 output。

設計系統採 **top-down**：先看使用者看到什麼（整體），再往下看每個小 component；不從 bottom-up 開始。

> **比喻** 像用地圖 app：先找到台灣，再 zoom in 到要去的地點。先宏觀，再微觀。

### System life cycle

整套流程稱為 **system life cycle**：

1. **Requirements**：掌握 input、output 與主要功能。
2. **Analysis**：把系統拆成 component。
3. **Design**：每個 component 有哪些 **data object**？每個 data object 負責的 **operation** 就是它的 function；function 要做事，通常得設計演算法來完成——演算法在這裡出場。
4. **Refinement and coding**：寫程式，再看 output 回頭 refine（function 可能定得不夠好）。
5. **Verification（驗證）**：
   - 正確性：結果對不對。
   - 多跑幾個 test case：跑對一個 case 就說演算法不錯，那可不行。
   - 效率：例如搜 1 萬個檔案和 100 萬個檔案，效能差多少？

**Scalability（可擴展性）測試**：把資料量從 100、1 萬、10 萬一路加到 100 萬，看效率怎麼變。1 萬個跑得好，不代表大量也行；資料一多，memory 可能爆掉、array 開不夠大，根本跑不起來。

> **重點** testing 有好幾層：小資料多測幾種 case 確認正確，再改變資料量測效率。

### 什麼是好程式

1. **output 符合 spec（requirement）**：作業的繳交期限也是一種 requirement。
2. **正常運作（correctness）**：所有合理的 case 都要對，不能跑出 segmentation fault。
3. **文件（document）**：程式要給很多人用，就要有說明文件，讓別人容易上手。
4. **error code**：出錯要回傳錯誤碼，上千行的大系統才好 debug。例如網頁找不到是 404（401 是未授權）。
5. **可讀性**：變數取有意義的名字（不要 XXYY、tmp2、tmp3），程式碼寫 comment（註解）。看得懂，別人才容易修改、討論、做 code review。實務上，需要交接的系統會要求寫 document 與 comment；跨國團隊（例如台灣、印度、美國的團隊一起做新聞首頁）的 comment 有標準格式；新功能先在備份平台上測，確定可行才上線，否則可能把整個 system 搞當。
6. **儲存空間有效率**：1 TB 硬碟現在很便宜，但 1995 年前後 64 MB 記憶體就算很強；而且 app 要放在手機、平板上，storage 和 memory 有限，省空間反而更重要。
7. **執行時間 acceptable**：這個詞很主觀。用慣 1 GHz 慢電腦的人覺得還好，用慣高效能電腦的人 1.5 秒就受不了。所以最終目標：runtime 越小越好。

## 資源：時間、空間與 trade-off

### 程式用掉的資源

- data structure 傳統上對應**儲存資源**（記憶體、硬碟）。
- algorithm 對應**計算資源**（CPU、GPU、雲端機器）。
- 其他資源：穿戴式裝置的電力（算太兇 30 分鐘就沒電）、網路頻寬，甚至寫程式的人力。

只看程式執行時用掉的資源，主要兩個面向：

1. **計算資源 → 時間**：CPU 或機器學習常用的 GPU，計算要花時間、花能量。傳統上用「多久跑完」衡量：100 筆資料要 1 秒、10 秒還是 100 秒？這就是**時間複雜度**的來源。作業跑了十分鐘還沒完，是再兩分鐘還是再兩千分鐘？後者就趕不上 deadline。
2. **記憶體、硬碟暫存、傳輸 → 空間**：6.4 G 的資料讀進來，在記憶體裡佔 6.4 G、64 G 還是 640 G？差很多；記憶體沒有 640 G，程式還沒存完就掛了；改用硬碟暫存，用多少也很重要。分散式環境中資料要在電腦之間傳，傳 6 MB、60 MB 還是 600 MB，時間差很多。儲存和傳輸都和資料量有關，統稱 **space**，對應**空間複雜度**。

「複雜度」就是：這件事有多費力。好的演算法通常時間效率高，好的資料結構通常空間效率好；兩者要搭配：不一定追求最省空間，而是用合理的空間換合理的時間。只有記憶體很小的嵌入式系統，才真的要每個 byte 都省。之後每個資料結構與演算法，都會用時間與空間複雜度來描述。

### Trade-off（取捨）

花 5 分鐘寫出很短的程式，卻讓電腦跑很久很久，划算嗎？看情境。

> **比喻** 愛整理的人 vs. 隨便丟的人。愛整理的人一天到晚在整理：東西一目了然、一下就拿到，但維護的力氣多。隨便丟的人放進去很省力、也不用維護，可是要找東西就要找很久。這就是資料結構裡「維護成本」與「取用成本」的取捨。

不同平台也有不同取捨：

- 平行運算平台：用非平行還是平行演算法？
- 分散式平台：工作分到各節點，傳輸要花很多力氣；全集中在一個節點，負荷又很重。
- 計算平台：深度學習常用 GPU，GPU 和 CPU 各有各的好處。

> **觀念** 好的程式設計師要知道自己面對哪些 trade-off、哪些重要、哪些不重要，才能做決定。人生就是在 prioritize，寫程式也一樣。

## 遞迴（recursion）

### 定義：direct 與 indirect

**recursive algorithm（遞迴演算法）**：自己呼叫自己的演算法。

- **direct recursion（直接遞迴）**：函式 A 直接呼叫 A 自己。
- **indirect recursion（間接遞迴）**：A 呼叫 B，B 再呼叫回 A，呼叫關係繞成一圈。

> **陷阱** A 只是呼叫一個「自己會遞迴的 B」，A 本身**不算**遞迴；要繞回 A 才是 indirect recursion。

例子：從 n 個取 m 個的**組合數**（不是排列）

C(n, m) = C(n−1, m) + C(n−1, m−1)

（第 n 個不選，從 n−1 個取 m 個；或第 n 個選，從 n−1 個再取 m−1 個。）重點是：問題變成小一號的自己。

### 遞迴的兩個要素

1. **recursive formula（遞迴式）**：把問題寫成「比較簡單但長得很像的自己」再加一點額外運算。遞迴式寫得出來，就成功一半。
2. **terminating condition（終止條件）**，又稱 **boundary condition（邊界條件）**：什麼時候停。還記得 finiteness 嗎？演算法一定要會停。

> **重點** 寫遞迴時一定要問自己：它什麼時候停？這會提醒你把 boundary condition 寫上去。

### 例一：階乘

n! = n × (n−1)!，所以 fact(n) 可以拆成 n × fact(n−1)。n = 0 時不能再扣下去，0! = 1 就是 boundary condition。

```c
int fact(int n)
{
    if (n == 0)
        return 1;              /* boundary condition：0! = 1 */
    return n * fact(n - 1);    /* 遞迴式 */
}
```

```
fact(4) = 4 * fact(3)
          fact(3) = 3 * fact(2)
                    fact(2) = 2 * fact(1)
                              fact(1) = 1 * fact(0)
                                        fact(0) = 1        ← 最底層
                              fact(1) = 1 * 1 = 1
                    fact(2) = 2 * 1 = 2
          fact(3) = 3 * 2 = 6
fact(4) = 4 * 6 = 24
```

最底層回傳 1，再一層層乘回去：1、2、6，最後 24。

### 例二：遞迴加總（recursive list summing）

把 10 個數加起來 = 把前 9 個加起來，再加上最後一個。先取出最後一個元素 **list[n−1]**（index 從 0 開始，所以最後一個是 n−1 而不是 n），再加上「前 n−1 個的總和」。

```c
float rsum(float list[], int n)
{
    if (n == 0)                          /* 終止條件：0 個數的和是 0 */
        return 0;
    return rsum(list, n - 1) + list[n - 1];   /* 前 n-1 個的和 + 最後一個 */
}
```

- 遞迴式：sum(n 個) = sum(n−1 個) + list[n−1]。
- 沒有終止條件會怎樣？10 個 → 9 個 → … → 0 個 → −1 個 → −2 個……跑到天荒地老。

> **重點** 寫得出遞迴式、又設得出合理的終止條件，兩件事合起來才是成功的遞迴。迴圈和遞迴都在「重複」：迴圈重複的是**指令**，遞迴重複的是**函式呼叫**。

### 例三：遞迴乘法

a × b = a × (b−1) + a，大問題用小一號的自己表示；b 每呼叫一次減 1，減到 b = 1 就停（boundary condition），直接回傳 a。

```c
int mult(int a, int b)
{
    if (b == 1)
        return a;                 /* boundary condition */
    return mult(a, b - 1) + a;    /* a*b = a*(b-1) + a */
}
```

```
mult(5,4) = mult(5,3) + 5
            mult(5,3) = mult(5,2) + 5
                        mult(5,2) = mult(5,1) + 5
                                    mult(5,1) = 5      ← b = 1，停
                        mult(5,2) = 5 + 5 = 10
            mult(5,3) = 10 + 5 = 15
mult(5,4) = 15 + 5 = 20
```

最底層回傳 5，再一層層加回去：10、15、20。5 × 3 也一樣，一路返回 5、10、15。

### 例四：1 加到 n——該不該用遞迴？

1 + 2 + … + n = (1 + … + (n−1)) + n；1 + … + (n−1) 又 = (1 + … + (n−2)) + (n−1)……也能寫成遞迴。

但真的要搞這麼複雜嗎？用公式 n(n+1)/2，或 for 迴圈一路加，都更直接。遞迴不是唯一解，要多問自己一句：有必要這麼複雜嗎？

> **重點** 迴圈通常比遞迴有效率。遞迴每次呼叫都要記住返回位置、再跳回原呼叫處，有額外 overhead；呼叫還要佔堆疊（stack）空間（下面算空間時會算給你看）。能用迴圈或公式時，不一定要用遞迴。

### 例五：遞迴版 binary search

前提一樣：數字已排好序，每跟中間的數比一次就切掉一半。前面的 while 版本是不用遞迴的寫法；遞迴版如下：

```c
int binsearch(int list[], int searchnum, int left, int right)
{
    int middle;
    if (left <= right) {
        middle = (left + right) / 2;
        switch (COMPARE(list[middle], searchnum)) {
            case -1: return binsearch(list, searchnum, middle + 1, right); /* 搜右半 */
            case  0: return middle;                                        /* 找到 */
            case  1: return binsearch(list, searchnum, left, middle - 1);  /* 搜左半 */
        }
    }
    return -1;   /* left > right：範圍空了，找不到 */
}
```

- left、right 是目前這段數列的左右邊界，調整它們就決定接下來搜哪一段。
- case −1：中間的數比目標小（例如找 13，中間是 9），左半不用看，呼叫自己搜 middle+1 到 right。
- case 1：中間的數比目標大，呼叫自己搜 left 到 middle−1。
- 兩個 boundary condition：找到就回傳位置；left > right 表示沒找到，回傳 −1。
- 比較：迴圈版要一個 `while (left <= right)` 一直繞；遞迴版靠呼叫自己。

### 例六：用遞迴產生所有排列（permutation）

給 a、b、c，輸出所有排列：3! = 6 種，abc、acb、bac、bca、cab、cba。

> **觀念** 直接寫 6 行 cout 把答案印出來，是人自己算好、電腦只負責印的「工人智慧」，不是人工智慧。字串一長、字母一多，人工算不完還可能算錯，所以要寫程式自動產生。

遞迴設計：

- case 1：第一個字元固定為 a，剩下 b、c 在第 2、3 個位置做排列。
- case 2：第一個字元是 b，後面排 a、c。
- case 3：第一個字元是 c，後面排 a、b。

寫一個函式 perm，三個參數：要排列的字串、排列範圍的起點、終點（例如 1 到 3 表示從第 1 個位置排到第 3 個位置）。第一位是 a 時，呼叫 perm(abc, 2, 3)：範圍縮到第 2～3 個位置，只排 b、c。範圍只剩一個位置（例如 3 到 3）時，只有一個字母可以排，這就是 boundary condition，直接輸出。

實作時用 swap 把要固定的字元換到最前面，遞迴完再換回來（以下用 0-based index，範圍 i 到 n）：

```c
#define SWAP(x, y, t) ((t) = (x), (x) = (y), (y) = (t))

void perm(char *list, int i, int n)
{   /* 產生 list[i..n] 的所有排列 */
    int j, temp;
    if (i == n) {                        /* 只剩一個位置：輸出 */
        for (j = 0; j <= n; j++)
            printf("%c", list[j]);
        printf("\n");
    } else {
        for (j = i; j <= n; j++) {
            SWAP(list[i], list[j], temp);   /* 把第 j 個字元固定到位置 i */
            perm(list, i + 1, n);           /* 排剩下的 */
            SWAP(list[i], list[j], temp);   /* 換回來，還原 */
        }
    }
}
```

> **例題** trace perm("abc", 0, 2)。

```
perm(abc,0,2)
├─ 固定 a（j=0，不換）→ abc
│   perm(abc,1,2)
│   ├─ 固定 b（j=1）→ abc → perm(abc,2,2) 範圍 2..2 → 輸出 abc
│   └─ 固定 c（j=2，交換 b,c）→ acb → perm(acb,2,2) → 輸出 acb；換回 abc
├─ 固定 b（j=1，交換 a,b）→ bac
│   perm(bac,1,2)
│   ├─ 固定 a → 輸出 bac
│   └─ 固定 c（交換 a,c）→ 輸出 bca；換回 bac
│   換回 abc
└─ 固定 c（j=2，交換 a,c）→ cba
    perm(cba,1,2)
    ├─ 固定 b → 輸出 cba
    └─ 固定 a（交換 b,a）→ 輸出 cab；換回 cba
    換回 abc
輸出順序：abc acb bac bca cba cab
```

a 開頭的結果是 abc、acb，剛好是「a + bc 的所有排列」；b、c 開頭也是同樣結構。建議拿 abc 自己 trace 一次程式。

### 不用遞迴也能排列

第 1、2、3 個位置都可以是 a、b、c，所以可用三層巢狀 for 迴圈（nested loop），一層管一個位置。但這樣會產生 aaa、aab 這種字元重複的組合，必須偵測已出現過的字元並排除。

```c
char s[] = "abc";
for (int x = 0; x < 3; x++)
    for (int y = 0; y < 3; y++)
        for (int z = 0; z < 3; z++)
            if (x != y && y != z && x != z)      /* 排除重複字元 */
                printf("%c%c%c\n", s[x], s[y], s[z]);
```

> **觀念** 同一個問題不只一種 solution。解題與研究沒有標準答案，要多一些自己的想法。

## 效能評估與空間複雜度

### Performance evaluation 的兩個層次

解題流程：搞清楚問題 → 設計 solution → 寫成程式跑出 output → 評估這個 solution 的效能。同一個問題可能有三種演算法都能解，誰快、誰慢、誰花的記憶體多？需要一套電腦科學共通的說法來描述好壞。

**performance evaluation（效能評估）** 有兩個層次：

1. **performance analysis**：與機器無關（machine independent）的複雜度分析。
2. **performance measurement**：實際計時，量程式從開始到結束的時間；會受硬體影響（CPU 好、memory 夠大，通常就跑得快），是 machine dependent。

所以評估效能通常用複雜度分析：

- **space complexity（空間複雜度）**：要用多少 memory。
- **time complexity（時間複雜度）**：大約要執行多少指令。

### S(P) = c + S_P

程式 P 的空間需求：

**S(P) = c + S_P(I)**

- **c**：固定部分，與輸入無關。例如編譯後存放程式碼本身的空間、簡單變數、常數。
- **S_P**：變動部分，與輸入的資料量有關，課本稱為 **instance characteristics**。例如給 n 個數字，就需要空間把這 n 個數存起來。**S_P 才是分析的重點。**

### 例題：迴圈加總的額外空間

> **例題** 把 array（換成 linked list 也一樣）裡所有數字加總，額外需要多少空間？

```c
float sum(float list[], int n)
{
    float total = 0;
    int i;
    for (i = 0; i < n; i++)
        total += list[i];
    return total;
}
```

算空間的前提：資料已經放好了（例如 20 個櫃子的 array），這不算在演算法頭上。要問的是：在那 20 個櫃子**之外**，這段演算法**額外**需要多少空間？資料已經在那裡，額外空間幾乎只看宣告了多少變數：

| 變數 | 用途 |
|---|---|
| total | 暫存目前的總和 |
| i | 迴圈計數器 |
| 回傳值 | 有些系統會替回傳值留一格 |
| list（array 指標） | 資料在哪 |
| n（array 長度） | 資料有多長 |

每個變數幾個 byte 依系統而定（指標可能 8 或 4 bytes，整數、浮點數也不一定）；在某個系統上五個合計約 **24 bytes**。

> **重點** 資料是 20 筆、2000 筆還是 2 萬筆，都只要 24 bytes：額外空間與資料量無關，即 **O(1)**（固定大小）。

### 例題：遞迴加總的呼叫堆疊

> **例題** 遞迴版 rsum（見上一節）額外需要多少空間？

照同樣的方法看函式裡的變數：輸入 list、n，加上一個回傳值，共三個。若指標算 8 bytes，看起來只要約 16 bytes，比迴圈版的 24 bytes 少——遞迴比較省嗎？

答案：**沒有比較好。**

- 算 10 個元素的和時，程式把它換成「list[9] + 前 9 個的和」；前 9 個又換成「list[8] + 前 8 個的和」……
- 做 9 號任務時，10 號任務還沒做完！它要等 9 號的結果（例如 5566），再加上 list[9]（例如 3），才得到 5569。
- 所以電腦必須記住「10 號還沒做完」，把它先擱在一邊，先去做 9 號。一路做到 1 號時，2 號到 10 號全都擱在一邊等著。這疊等待中的任務就是**呼叫堆疊（call stack）**。
- 「擱在一邊」在電腦裡就是要佔額外記憶體。

```
call stack（n = 10，由下往上疊）
| rsum(list, 0)  | 16 bytes   ← 最上層，正在執行
| rsum(list, 1)  | 16 bytes   等待
|      ...       |
| rsum(list, 9)  | 16 bytes   等待
| rsum(list, 10) | 16 bytes   等待
共 n + 1 層，總計 16 × (n + 1)（n = 10 時 11 層、176 bytes），約 16n
```

每個任務各有自己的 16 bytes，而且**同時**存在，所以不是 16，而是約 **16n**。n 夠大時，遞迴版反而比「不管 n 多大都只要 24 bytes」的迴圈版更耗空間。

> **重點** 遞迴的空間要算**呼叫堆疊的深度**。遞迴加總深度為 n + 1，額外空間 **O(n)**；迴圈版 **O(1)**。

> **觀念** 變化版：**tail recursion（尾遞迴）**——遞迴呼叫是函式的最後一步時，有些語言能把它轉成精簡的形式，不需要那麼多堆疊空間。看到程式碼要能算出它花多少空間、多少時間，才能拿來比較。

## 時間複雜度：program step

### T(P) = compile time + T_P

**T(P) = compile time + T_P**

- compile time（編譯時間）與輸入無關，編譯一次就好，不分析。
- T_P（執行時間）與程式裡做了哪些運算有關。

C 寫得很 high level，但電腦執行的是一條條 instruction（機器指令）：add、sub，以及 load（把資料載進來）、store（把結果存回去）。執行時間取決於 instruction set：做了多少個 add、load、store……這太細了，不會分析到這種程度。

資料結構與演算法改成數 **program step（程式步數）**：大約執行多少「步」，不管每一步是 add 還是 load。每個真正做事的敘述（例如一個 assignment、一次判斷、一個 return）算一步；只有宣告、沒有 assignment 的（如 `int i;`）不算。

### 方法一：count 法

在程式裡宣告一個全域變數 count，初值 0；每執行完一個敘述就 count++。這是比較笨但直觀的方法。

```c
int count = 0;     /* 全域變數 */

float sum(float list[], int n)
{
    float tempsum = 0;  count++;      /* assignment */
    int i;                            /* 只是宣告，不算 */
    for (i = 0; i < n; i++) {
        count++;                      /* for 的判斷（成立的 n 次） */
        tempsum += list[i];  count++; /* assignment */
    }
    count++;                          /* for 最後一次判斷（不成立，跳出） */
    count++;                          /* return */
    return tempsum;
}
```

計算：1（tempsum = 0）+ n（for 判斷成立）+ n（tempsum += …）+ 1（最後一次判斷）+ 1（return）= **2n + 3**。

n = 4 時：2 × 4 + 3 = **11** 步。

> **觀念** 問：算得很精準時，2n + 3 和 2n + 5 有什麼差別？答：n = 100 時，203 與 205 只差 2 步，幾乎沒感覺。在乎的是步數與 **n 的關係**，後面那些小數字不重要。

同樣的加總改用遞迴 rsum 寫，算出來是 **2n + 2** 步，與 2n + 3 同一個等級。

### 方法二：tabular method（表格法）

左邊列出每一行敘述，右邊算它牽涉到幾步：

- **s/e**（steps per execution）：每執行一次算幾步。
- **frequency**：這行總共執行幾次。
- **total steps** = s/e × frequency。

> **例題** 迭代版 sum 的步數表。

| 敘述 | s/e | frequency | total steps |
|---|---|---|---|
| `float sum(float list[], int n)` | 0 | 0 | 0 |
| `{` | 0 | 0 | 0 |
| `float tempsum = 0;` | 1 | 1 | 1 |
| `int i;` | 0 | 0 | 0 |
| `for (i = 0; i < n; i++)` | 1 | n+1 | n+1 |
| `tempsum += list[i];` | 1 | n | n |
| `return tempsum;` | 1 | 1 | 1 |
| `}` | 0 | 0 | 0 |
| **合計** | | | **2n + 3** |

1 + (n+1) + n + 1 = 2n + 3，與 count 法相同。

> **陷阱** for 迴圈的標頭（條件判斷）要執行 **n+1** 次：前 n 次判斷成立進入迴圈，最後還要多判斷一次才知道結束。迴圈本體只跑 **n** 次。

> **例題** 遞迴版 rsum 的步數表。

```c
float rsum(float list[], int n)
{
    if (n)
        return rsum(list, n - 1) + list[n - 1];
    return 0;
}
```

| 敘述 | s/e | frequency | total steps |
|---|---|---|---|
| `if (n)` | 1 | n+1 | n+1 |
| `return rsum(list, n-1) + list[n-1];` | 1 | n | n |
| `return 0;` | 1 | 1 | 1 |
| **合計** | | | **2n + 2** |

rsum(list, n) 會依序呼叫 n, n−1, …, 0，共 n+1 次，每次都做一次 `if` 判斷；前 n 次走遞迴那行，最後一次（n = 0）走 `return 0`。

### 例題：矩陣加法

把兩個 rows × cols 的 dense 矩陣（每格都存）A、B 相加存入 C；A、B、C 的空間都已配置好，用兩層 for 迴圈：

```c
void add(int a[][MAX_SIZE], int b[][MAX_SIZE], int c[][MAX_SIZE],
         int rows, int cols)
{
    int i, j;
    for (i = 0; i < rows; i++)
        for (j = 0; j < cols; j++)
            c[i][j] = a[i][j] + b[i][j];
}
```

| 敘述 | s/e | frequency | total steps |
|---|---|---|---|
| `for (i = 0; i < rows; i++)` | 1 | rows+1 | rows+1 |
| `for (j = 0; j < cols; j++)` | 1 | rows·(cols+1) | rows·cols + rows |
| `c[i][j] = a[i][j] + b[i][j];` | 1 | rows·cols | rows·cols |
| **合計** | | | **2·rows·cols + 2·rows + 1** |

內層 for 的標頭每次被外層帶進來都要判斷 cols+1 次，外層共進來 rows 次，所以是 rows·(cols+1)。

> **例題** 思考題：rows 遠大於 cols 時，把內外兩層迴圈交換，可以降低步數嗎？

交換後外層跑 cols 次、內層跑 rows 次：

```
外層 for j：      cols + 1
內層 for i：      cols·(rows + 1) = rows·cols + cols
本體：            rows·cols
合計：            2·rows·cols + 2·cols + 1
```

原本是 2·rows·cols + 2·rows + 1，交換後是 2·rows·cols + 2·cols + 1。rows ≫ cols 時 2·cols < 2·rows，交換後步數較少：外層迴圈的額外成本只需付 cols 次。例如 rows = 1000、cols = 2：原本 4000 + 2000 + 1 = 6001，交換後 4000 + 4 + 1 = 4005。

### 用常數估計成本：p、q、r、s、t

另一種看法：估計「大約要花幾步機器碼」。

- 內層 for 迴圈跑 cols 次，每次都要取 A、取 B、相加、存進 C（含 j++），假設花 **p**（例如 10 秒；100 欄就是 1000 秒）。
- j = 0 只在一開始做一次，與 cols 無關，這種零碎成本放進 **q**。所以內層約 **p·cols + q**，合起來叫 **r**。
- 外層跑 rows 次：與 rows 有關的成本放 **s**，無關的放 **t**。
- 整段加起來是 **rows·cols·p** 再加上其他幾項（rows·(q + s) + t 之類）。

p、q、r、s、t 在某台電腦上都是常數，但與平台有關：CPU 快兩倍，秒數大約減半。

### 差不多先生：只留主導項

- 不知道程式會跑在哪個平台，p、q、r、s、t 根本估不出來；那些值要編譯、執行之後才知道。設計階段能分析的，是成本與輸入大小（rows、cols）的關係。
- 分析時不想管這些常數。真想讓它們變小？換一台快一點的電腦就好。所以與平台有關的常數在演算法分析上不太重要。

> **陷阱** 不是常數不重要，而是「分析時」不重要。真的上線時，常數可能決定程式跑不跑得完。

所以需要一種「差不多先生」（rough）的描述，只說大概要花多少——與「2n + 3 和 2n + 5 沒差別」是同一個精神：

- 內層 for 迴圈「差不多花 cols 那麼多的力氣」，把 p、q 都塗掉。
- 外面再乘上 rows，總共差不多 **rows × cols**，也就是矩陣的元素個數：1000 個元素約 1000 的力氣，100 萬個元素約 100 萬。

> **重點** m 列 n 行的矩陣加法，時間是 **O(mn)**，常數全部丟掉。

接下來要用數學把「差不多」講精確，描述與資料量有關、最花時間和空間的核心部分：這就是 Big-O。

## 漸近符號：Big-O、Ω、Θ

### 為什麼要漸近分析

算 program step 最重要的目的，是求出複雜度。要看程式在 **best case（最好情況）**、**worst case（最壞情況）**、**average case（平均情況）** 下要幾步。例如判斷質數時看的是 worst case：n 剛好是質數。

注意：2n + 3、2n + 2 這種步數**不代表**真正的執行時間，看的是它與 n 的關係。一個程式要 n² 再加一些步，另一個只要 10n 步，n 一大，後者明顯比較有效率（n > 10 之後 n² 就超過 10n，n = 1000 時是 10⁶ 對 10⁴）。

### Big-O：上界

設 f(n) 是算出來的 program step。寫 f(n) = O(g(n))，就是要找出 g(n)。

> **重點** **定義**：f(n) = O(g(n)) 若且唯若**存在**正常數 c 和 n₀，使得對**所有** n ≥ n₀，都有 **f(n) ≤ c·g(n)**。

注意兩件事：

- 是「**小於等於**」。
- 只要 n 夠大（n ≥ n₀）時成立就好，n 很小時不管。

Big-O 是**上界（upper bound）**：f(n) 頂多長得跟 g(n) 一樣快。

### 例題：證明 3n + 2 = O(n)

> **例題** 證明 3n + 2 = O(n)。

要找 c、n₀ 使 n ≥ n₀ 時 3n + 2 ≤ c·n。取 c = 4：

```
3n + 2 ≤ 4n
⇔     2 ≤ n
```

所以取 **c = 4、n₀ = 2**：對所有 n ≥ 2，3n + 2 ≤ 4n 成立。

驗算：

| n | f(n) = 3n + 2 | c·g(n) = 4n | 成立？ |
|---|---|---|---|
| 1 | 5 | 4 | 否（n < n₀，不用管） |
| 2 | 8 | 8 | 是（剛好相等） |
| 3 | 11 | 12 | 是 |
| 10 | 32 | 40 | 是 |

畫成圖：f(n) = 3n + 2 一條線、c·g(n) = 4n 另一條線，從 n = 2 開始，4n 一直在 3n + 2 上面。

### 例題：證明 10n² + 4n + 2 = O(n²)

> **例題** 證明 10n² + 4n + 2 = O(n²)。

取 c = 11：

```
10n² + 4n + 2 ≤ 11n²
⇔            4n + 2 ≤ n²
⇔       n² − 4n − 2 ≥ 0
⇔                  n ≥ 2 + √6 ≈ 4.45
```

所以 **c = 11、n₀ = 5** 就成立（課本取 n₀ = 5；取 n₀ = 10 也可以，n₀ 只要夠大都對）。

| n | 10n² + 4n + 2 | 11n² | 成立？ |
|---|---|---|---|
| 4 | 160 + 16 + 2 = 178 | 176 | 否 |
| 5 | 250 + 20 + 2 = 272 | 275 | 是 |
| 10 | 1000 + 40 + 2 = 1042 | 1100 | 是 |

> **重點** c 和 n₀ 只要**找得到一組**就成立，不是唯一的。例如也可以取 c = 16、n₀ = 1：當 n ≥ 1 時 4n ≤ 4n²、2 ≤ 2n²，所以 10n² + 4n + 2 ≤ 10n² + 4n² + 2n² = 16n²。

### 最緊的上界

問：3n + 2 ≤ n² 在 n ≥ 4 時也成立（n = 4：14 ≤ 16；n = 3：11 > 9 不成立），所以 3n + 2 = O(n²) 也對嗎？
答：數學上是對的（c = 1、n₀ = 4）。但我們要的 g(n) 是所有上界中**最小**的那個，叫 **least upper bound（最緊的上界）**。所以 3n + 2 寫 O(n)，不寫 O(n²)。

> **陷阱** 3n + 2 = O(n²) 在數學上成立，只是不是最緊的上界；題目問「是否成立」時要答「成立」，問複雜度時要寫最緊的 O(n)。

> **觀念** 反過來，n² ≠ O(n)：若 n² ≤ c·n 對所有 n ≥ n₀ 成立，兩邊除以 n 得 n ≤ c，但 n 可以任意大，任何常數 c 都擋不住，所以找不到這樣的 c 和 n₀。

### Ω：下界

> **重點** **定義**：f(n) = Ω(g(n)) 若且唯若存在正常數 c 和 n₀，使得對所有 n ≥ n₀，都有 **f(n) ≥ c·g(n)**。

和 Big-O 只差在不等號方向。Ω 是 **lower bound（下界）**：f(n) 至少有這麼大。

> **例題** 證明 3n + 3 = Ω(n)。

取 **c = 3、n₀ = 1**：對所有 n ≥ 1，3n + 3 ≥ 3n（多了 3，永遠成立）。圖上 c·g(n) = 3n 這條線一直在 f(n) = 3n + 3 下面。

lower bound 也有很多（例如 3n + 3 = Ω(1) 也成立），Ω 要取其中**最大**的那個，也就是最緊的下界。

前面提過「比較式排序在最壞情況是 Ω(n log n)」，意思就是：最壞情況下，再聰明的比較式排序，至少也要比這麼多次。

### Θ：上下夾住

> **重點** **定義**：f(n) = Θ(g(n)) 若且唯若存在正常數 c₁、c₂ 和 n₀，使得對所有 n ≥ n₀，都有 **c₁·g(n) ≤ f(n) ≤ c₂·g(n)**。

Θ 是夾擠：用兩個常數畫上面一條、下面一條，把 f(n) 夾住。Θ 既是 upper bound 也是 lower bound，是最精確的描述。

> **重點** f(n) = Θ(g(n)) 若且唯若 f(n) = O(g(n)) **且** f(n) = Ω(g(n))。

> **例題** 證明 3n + 3 = Θ(n)。

- 下界：3n + 3 ≥ 3n，對 n ≥ 1 成立（c₁ = 3）。
- 上界：3n + 3 ≤ 4n ⇔ 3 ≤ n，對 n ≥ 3 成立（c₂ = 4）。
- 取 n₀ = 3（兩個條件都要成立，取較大者）：對所有 n ≥ 3，3n ≤ 3n + 3 ≤ 4n，所以 3n + 3 = Θ(n)。

> **例題** 證明 selection sort 的比較次數 f(n) = n(n−1)/2 = Θ(n²)。

- 上界：n(n−1)/2 = n²/2 − n/2 ≤ n²/2，對 n ≥ 1 成立（c₂ = 1/2）。
- 下界：要 n(n−1)/2 ≥ n²/4 ⇔ 2n(n−1) ≥ n² ⇔ 2n − 2 ≥ n ⇔ n ≥ 2，所以 c₁ = 1/4。
- 取 n₀ = 2：對所有 n ≥ 2，(1/4)n² ≤ n(n−1)/2 ≤ (1/2)n²，故 n(n−1)/2 = Θ(n²)。

驗算 n = 4：n²/4 = 4，n(n−1)/2 = 6，n²/2 = 8，4 ≤ 6 ≤ 8 成立。

### 常見成長速度

由慢到快：

**log n < √n < n < n log n < n² < 2ⁿ**

| n | log₂ n | √n | n | n log₂ n | n² | 2ⁿ |
|---|---|---|---|---|---|---|
| 16 | 4 | 4 | 16 | 64 | 256 | 65,536 |
| 1024 | 10 | 32 | 1024 | 10,240 | 1,048,576 | 約 1.8 × 10³⁰⁸ |

n 越大，差距越驚人。本章出現過的對應：

| 問題／演算法 | 複雜度 |
|---|---|
| 判斷質數：試除到 n−1 | O(n) |
| 判斷質數：試除到 √n | O(√n) |
| 找最小值（逐一掃描或淘汰賽） | n−1 次比較，Θ(n) |
| selection sort | Θ(n²) |
| binary search（已排序） | O(log n) |
| 比較式排序的下界 | Ω(n log n) |
| 迭代加總 | 2n + 3 步，時間 O(n)，額外空間 O(1) |
| 遞迴加總 | 2n + 2 步，時間 O(n)，額外空間 O(n) |
| m × n 矩陣加法 | O(mn) |

> **重點** 整章串起來：先會算 program step（count 法或 tabular method），丟掉與平台有關的常數，只留與 n 有關的主導項，再用 Big-O（上界）、Ω（下界）、Θ（夾住）描述；證明時只要找出一組 c 和 n₀。

## 重點整理
- 判斷質數最壞情況（n 為質數）：試除到 n−1 要 n−2 次，O(n)；試除到 √n 約 √n−1 次，O(√n)。n ≈ 10¹⁰ 時約 115 天 vs 1.66 分鐘
- 小輸入看不出演算法好壞，比較要看 n 很大時的表現；Big-O 只留主導項，丟掉常數與機器常數
- 演算法五條件：input、output（隱含正確）、definiteness（給人看）、effectiveness（給電腦做，與平台有關）、finiteness（執行步驟有限，不是行數有限）；沒有「有效率」這條，暴力法也是演算法
- loop invariant：第 k 輪結束時 m 是 arr[0..k] 最小值的位置，用數學歸納法證明正確性
- n 個數找最小值，逐一掃描或淘汰賽都要 n−1 次比較；淘汰賽可平行化，效率與平台有關
- 不好的 pseudocode：太詳細、太神秘、太抽象；目標是 communicate correctly；← 表示 assignment
- selection sort 比較次數 (n−1)+…+1 = n(n−1)/2 = Θ(n²)；34,8,64,51,32,21 第一輪後為 8,34,64,51,32,21
- quick sort 平均 Θ(n log n)、最壞 Θ(n²)；merge sort、heap sort 最壞也 Θ(n log n)；比較式排序下界 Ω(n log n)；radix／bucket sort 不靠比較
- binary search 要求資料已排序，每次範圍減半，O(log n)；找不到時 left > right，回傳 −1
- selection problem（第 k 大）：全部排序 O(n log n)；只維護 k 個最壞 O(nk)，k 小於約 log n 才較快
- 資料結構＝收納資料的方式；至少有 get、insert，維護規則的成本是隱藏的力氣；與演算法相輔相成
- ADT：只講 objects 與 functions，machine independent、implementation independent
- system life cycle：requirements → analysis → design → refinement and coding → verification（含 scalability 測試）
- 遞迴：direct（A 呼叫 A）、indirect（A→B→A）；兩要素：遞迴式＋終止條件（boundary condition）
- C(n, m) = C(n−1, m) + C(n−1, m−1)（組合）；fact(0) = 1；mult(a,1) = a
- perm(list, i, n)：i == n 時輸出，否則 swap 固定第 i 位再遞迴、再 swap 回來；3 個字共 3! = 6 種
- 迴圈通常比遞迴有效率：遞迴有呼叫 overhead 與堆疊空間
- S(P) = c + S_P（instance characteristics），分析重點是 S_P
- 迴圈加總額外空間 O(1)（約 24 bytes，與 n 無關）；遞迴加總呼叫堆疊深度 n + 1，約 16n bytes，O(n)
- T(P) = compile time + T_P，只分析 T_P；數 program step（宣告不算，assignment、判斷、return 各算一步）
- 迭代加總 2n + 3 步（n = 4 時 11 步）；遞迴 rsum 2n + 2 步
- tabular method：total = s/e × frequency；for 標頭執行 n+1 次，本體 n 次
- 矩陣加法 2·rows·cols + 2·rows + 1；內外迴圈交換後 2·rows·cols + 2·cols + 1（rows ≫ cols 時較少）；O(mn)
- 平台常數（p、q、r、s、t）分析時忽略，但上線時仍可能決定跑不跑得完
- f(n) = O(g(n))：存在 c、n₀，n ≥ n₀ 時 f(n) ≤ c·g(n)（上界，取最緊的）
- f(n) = Ω(g(n))：存在 c、n₀，n ≥ n₀ 時 f(n) ≥ c·g(n)（下界，取最緊的）
- f(n) = Θ(g(n))：c₁·g(n) ≤ f(n) ≤ c₂·g(n)；⇔ O 且 Ω
- 3n+2 = O(n)（c = 4, n₀ = 2）；10n²+4n+2 = O(n²)（c = 11, n₀ = 5）；3n+3 = Ω(n)（c = 3, n₀ = 1）；3n+3 = Θ(n)（3n ≤ 3n+3 ≤ 4n, n ≥ 3）
- 3n+2 = O(n²) 數學上成立但不是最緊上界；c 與 n₀ 不唯一，找到一組即可
- 成長速度：log n < √n < n < n log n < n² < 2ⁿ

## 名詞對照
| 中文 | English |
|---|---|
| 時間複雜度 | time complexity |
| 空間複雜度 | space complexity |
| 質數 | prime |
| 最壞情況 | worst case |
| 最好情況 | best case |
| 平均情況 | average case |
| 演算法 | algorithm |
| 輸入／輸出 | input／output |
| 明確性 | definiteness |
| 有效性 | effectiveness |
| 有限性 | finiteness |
| 正確性證明 | proof of correctness |
| 迴圈不變量 | loop invariant |
| 數學歸納法 | mathematical induction |
| 效率 | efficiency |
| 淘汰賽 | knockout tournament |
| 平行化 | parallelization |
| 虛擬碼 | pseudocode |
| 賦值 | assignment |
| 選擇排序 | selection sort |
| 以比較為基礎的排序 | comparison-based sorting |
| 線性搜尋 | linear search |
| 二分搜尋 | binary search |
| 二元搜尋樹 | binary search tree |
| 選擇問題 | selection problem |
| 資料結構 | data structure |
| 資料紀錄 | data record |
| 屬性 | attribute |
| 抽象資料型態 | abstract data type (ADT) |
| 資料抽象化 | data abstraction |
| 與機器無關 | machine independent |
| 與實作無關 | implementation independent |
| 系統生命週期 | system life cycle |
| 需求 | requirement |
| 驗證 | verification |
| 可擴展性 | scalability |
| 取捨 | trade-off |
| 遞迴 | recursion |
| 直接遞迴 | direct recursion |
| 間接遞迴 | indirect recursion |
| 遞迴式 | recursive formula |
| 終止條件／邊界條件 | terminating condition／boundary condition |
| 排列 | permutation |
| 組合 | combination |
| 呼叫堆疊 | call stack |
| 尾遞迴 | tail recursion |
| 效能評估 | performance evaluation |
| 效能分析 | performance analysis |
| 效能量測 | performance measurement |
| 實例特徵 | instance characteristics |
| 程式步數 | program step |
| 表格法 | tabular method |
| 每次執行步數 | steps per execution (s/e) |
| 執行次數 | frequency |
| 上界 | upper bound |
| 最緊上界 | least upper bound |
| 下界 | lower bound |
| 漸近符號 | asymptotic notation |
