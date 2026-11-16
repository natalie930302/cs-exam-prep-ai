# 記憶體層次與 Cache

Processor 越來越快，DRAM 卻跟不上，兩者的差距越拉越大。memory hierarchy 利用程式的 locality，把常用的資料放在小而快的 cache 裡，讓 processor 看到一個「又快又大」的 memory。這章從 SRAM／DRAM 講起，一路講到 direct-mapped、set associative、fully associative 三種 cache 映射，位址怎麼切成 tag／index／offset，hit/miss 怎麼追蹤，write-through 與 write-back，AMAT 與 CPI 的計算，多層 cache，最後帶出 virtual memory。位址切割、hit/miss 追蹤和 AMAT／CPI 計算是考試必考的計算題。

## 學完這章要會
- 比較 SRAM、DRAM、disk 的速度、容量與價錢，說明為什麼要做 memory hierarchy
- 用 temporal／spatial locality 解釋 cache 為什麼有效
- 定義 hit、miss、hit time、miss penalty、hit rate、miss rate
- 把 byte address 切成 tag、index、byte offset，算出各欄位的 bit 數
- 手動追蹤 direct-mapped、set associative、fully associative cache 的 hit/miss 與內容
- 說明 block size 的好處與代價、read/write 的 hit 與 miss 怎麼處理
- 比較 write-through（加 write buffer）與 write-back（加 dirty bit），以及 write miss 的兩種策略
- 算三種 memory 組織的 miss penalty、cache 對 CPI 的影響、AMAT（含多層 cache 的兩種算法）
- 說明 replacement（LRU、random）與 associativity 的代價
- 說出 virtual memory 的 page、frame、page fault 與 address translation 的基本概念

## 單元架構：cache 與 virtual memory

理想的 memory 有三個願望：存取很快、容量很大、價錢便宜。這三件事通常互相衝突：快的貴，便宜的慢。解法是 **memory hierarchy（記憶體階層）**，整個單元分兩大塊：

1. **Cache（快取）**：在 processor（處理器）和 memory 之間加一個小而快的 cache，常用的資料先放在 cache，就不必每次都去慢的 memory 拿。先學最簡單的 cache 怎麼運作，再學讓它 performance（效能）更好的技巧。
2. **Virtual memory（虛擬記憶體）**：在 memory 和 secondary memory（例如 disk 硬碟）之間的另一個階層，讓 memory 看起來比實際更大。

> **觀念** 讀這個單元要 top-down：這一章的內容看起來一大堆，先抓住章節要學哪幾件事（其實就是各 section 的標題），把架構記起來，再往下看每件事怎麼做。大架構好記；從細節 bottom-up 往上背，很容易忘。

## 做 memory 的技術：SRAM、DRAM 與 disk

### Random access 與非 random access

依存取方式，memory technology 分兩大類：

- **Random access（隨機存取）**：不管存取哪一個位置，花的時間都一樣（每一格的 access time 都是同一個 t）。
- **非 random access**：位置不同，存取時間就不同。例如 **magnetic disk（磁碟）**：read/write head（讀寫頭）要先移到資料所在的位置才能開始讀，所以時間要看它離上一個位置多遠。Disk 主要當 **secondary memory**（第二層儲存，像硬碟），不是平常說的主記憶體。

Random access memory（**RAM**）又分兩種：

| | 用在哪 | 速度 |
|---|---|---|
| **SRAM**（static RAM，靜態） | **cache**，也就是 processor 和 main memory 中間那一層 | 讀寫一次可以跟 CPU 的一個 cycle 一樣快，跟得上 CPU |
| **DRAM**（dynamic RAM，動態） | **main memory（主記憶體）**，平常說的「memory」 | 存取要幾十到幾百個 clock cycle（時脈週期） |

為什麼需要 cache？因為去 memory 一趟可能要幾十、幾百個 clock cycle。CPU 存取時不是直接去 DRAM，而是**先經過 cache**；資料已經在 cache 裡，就直接拿，不必去 memory。

### SRAM：快、耗電、貴

SRAM 的特性：**low density**（同樣面積存的 bit 少）、**high power**（耗電）、**expensive**（貴），但是 **fast**。

- 結構：兩個反相器（NOT gate）交叉接起來，叫 **cross-coupled**：output 拉回去當 input，就像 logic design 學過的 **latch**，能把 1 或 0 鎖住。
- 快：它用了比較多 transistor（電晶體），但和一般 logic 是同一種製程，製程一進步它就跟著變快。
- 耗電：電路一直接著電源（VDD 和 ground）在運作，所以 high power。
- 貴、容量小：一個 bit 要好幾個 transistor，同樣面積放不了多少 bit。所以不可能整個 memory 都用 SRAM 做。
- 為什麼叫 **static**：只要 power on，存的 1 或 0 就一直保持住，不用管它。

### DRAM：便宜、容量大，但慢、要 refresh

- 結構：**一個 transistor 加一個 capacitor（電容）** 存一個 bit，用電容裡的電荷表示 0 或 1。
- 電容充好電之後，電荷會隨時間慢慢漏掉，叫 **decay**，所以需要 **refresh（刷新）**：每隔幾個 millisecond（毫秒），把資料讀出來再寫回去。這就是 **dynamic** 的由來。CPU 的 cycle 是 nanosecond（奈秒）等級，所以要跑非常多個 cycle 才輪到一次 refresh。
- 一個 transistor 就存一個 bit，所以 DRAM 是 **high density**（容量大）、**low power**（不必一直接著電源）、**便宜**。
- 缺點是 **slow**：讀的時候電容的訊號很微弱，要先用 **sense amplifier（感測放大器）** 放大，才知道是 0 還是 1。

> **陷阱** Static／dynamic 指的是**要不要 refresh**：SRAM 只要有電就一直保持；DRAM 的電容會漏電，必須定期 refresh。

### DRAM 像一個矩陣：row 和 column

SRAM 用起來很直覺：給它一個 address（地址），它就找出那個位置的 content（內容）。

DRAM 的結構不一樣：所有的 bit 排成一個二維的 matrix（矩陣），像一張大表格。要在表格裡找到一格需要兩個座標，所以 address 要拆成兩半：

1. 一半當 **row address**：用它把整個 row（一整列）**activate**，那一列的資料全部讀出來，放進 **buffer（暫存區）**。
2. 另一半當 **column address**：再從這一列裡 select（選出）要的那一格。

```
（示意：6 × 8 的 DRAM 陣列，真的 DRAM 大得多）
          column 0  1  2  3  4  5  6  7
row 0            .  .  .  .  .  .  .  .
row 1            .  .  .  .  .  .  .  .
row 2  ← row address 選中，整列讀進 buffer
row 3            .  .  .  .  .  .  .  .
row 4            .  .  .  .  .  .  .  .
row 5            .  .  .  .  .  .  .  .

buffer:         [ .  .  .  .  .  .  .  . ]
                             ↑ column address 選出這一格
```

這種 DRAM 結構主要用在 main memory；後面講 miss penalty 時會再回來看它。

### 速度和價錢：沒有一種技術能全包

課本 2008 年的資料（重點是**數量級**的差距）：

| Technology | 存取時間 | 每 GB 價錢 |
|---|---|---|
| SRAM | 0.5–2.5 ns（約一個 clock cycle） | 2000–5000 美金 |
| DRAM | 50–70 ns | 20–75 美金 |
| Magnetic disk | 5–20 ms | 0.2–2 美金 |

- DRAM 對 SRAM：50 ÷ 0.5 = 100，資料若在 DRAM，可能要等約 **100 個 cycle**。
- Disk：5 ms = 5,000,000 ns，跟 SRAM 差到**百萬倍**的等級。

貪心一點，我們想要：存取很快、容量很大、又很便宜。任何一種技術單獨用都做不到（快的很貴，便宜的很慢）；但把三種合在一起、規劃成一層一層的 **hierarchy**，就能做到。

> **重點** Memory hierarchy 的目標：**存取時間像 SRAM 一樣快，容量和成本卻像 disk 一樣大又便宜。**

## Processor 和 DRAM 越差越遠

- 照 **Moore's law**，logic 電路越做越小，processor 越來越快。
- DRAM 是另一種製程，靠電容存資料，沒辦法像 logic 那樣一直變快，速度進步得很慢。
- 所以 processor 和 memory 的速度差距（**gap**）一年比一年大。程式裡 load／store 很多，一做就得停下來等 memory；東西沒到，processor 再快也只能空等。**Gap 越嚴重，cache 越重要。**

解法就是 memory hierarchy：把不同 technology 一層一層排好。越靠近 processor，用越貴、越快的技術，但容量比較小；越往下層，容量越大、速度越慢、價錢越便宜。

> **觀念** 問：我願意多花錢，把 cache 做到超大，不是更好嗎？
> 答：不行。設計的老原則是 **small is fast**：東西做大，訊號要走更遠、要找的格子更多，就變慢了。所以 cache 一定要小。

資料不可能全放在最上層，所以上下兩層之間需要一套機制，決定什麼時候把資料搬上來、什麼時候搬下去。

## Upper level、lower level 與 block

這個單元談兩對層級：

1. **cache ↔ memory**
2. **memory ↔ disk**（也就是 virtual memory 系統）

每一對裡，靠近 processor 的叫 **upper level（上層，也叫 high level）**，離得遠的叫 **lower level（下層）**。

> **陷阱** Memory 的角色會變：在 cache 那一對裡它是 **lower level**；在 virtual memory 那一對裡它變成 **upper level**。要看在講哪一對。

Upper level 比較小，不可能所有東西都放上去，所以資料得在上下層之間搬來搬去。搬的大小要**固定**，不能這次搬一個、下次搬兩個，那樣就亂了。

- 這個固定的最小搬動單位，在 cache 和 memory 之間叫 **block（區塊）**。
- 在 virtual memory 裡，同樣的概念叫 **page（頁）**。
- 規則：要嘛整個 block 一起搬進來，要嘛整個一起搬出去，不會只搬其中一兩個 byte。就像讀 memory 時一次讀一個 word：4 個 byte 一起讀，不會拆開。

Block size 可大可小：1 個 word、4 個 word、16 個 word 都可以，舉例時常假設一個 block 就是一個 word。但 block 只有一個 word 的話，用不到 spatial locality（下一個要用的根本沒搬進來），所以實際的 block 會大一點。（block 大小的取捨在後面詳談。）

## Principle of locality：九成時間跑一成程式

上層小又快、下層大又慢，這樣的設計真的有用嗎？有用，關鍵是 **principle of locality（區域性原理）**：任何一個時間，程式只會存取 address space（所有地址）裡**很小的一部分**。

常說的 **90/10 rule**：**90% 的時間，都在執行那 10% 的 code。**

> **觀念** 如果每個地址被用到的機率都一樣，怎麼組織 memory 都沒用；正因為存取不平均，hierarchy 才有辦法發揮。

> **比喻** 去圖書館不會每本書都看。常看的那幾本放在身邊，大部分時候伸手就拿得到；其他的留在書架上，要用再去拿。

回想自己寫程式：寫了 100 行，真正一直反覆在跑的只有一小段。

- 一般的 statement 執行一次就過去了，不會重複。
- If-then-else 也只會走其中一邊。
- Function、subroutine 會被一直呼叫。
- 真正的主角是 **loop（迴圈）**：程式碼很短，卻吃掉大部分的執行時間。

所以只要把那 10% **正確地**搬到最近的 cache，大部分要用的東西都找得到。其他 90% 平常用不到，就不用搬進來；用到再搬，不用了就搬出去，常用的東西自然一直留在 cache。

### Temporal 與 spatial locality

Locality 分兩種：

- **Temporal locality（時間區域性）**：一個 item 剛被 reference（存取）過，很快又會再被 reference。例如同一個 `x` 一再出現。
- **Spatial locality（空間區域性）**：一個位置被 reference 後，它旁邊、後面的位置很快也會被 reference。例如 `a`、`a+1`、`a+2`… 連著用。

> **觀念** 這不是背的，是從程式行為觀察出來的：會寫程式，就說得出哪些 program construct 符合哪一種 locality。

### Locality 的例子：loop、array、指令

| 種類 | 例子 | 說明 |
|---|---|---|
| Temporal | **loop** | 迴圈裡的 instruction 剛 fetch（從記憶體取出指令）完，下一圈馬上又要 fetch，所以 loop 的 instruction 應該留在 cache，不要搬走 |
| Spatial | **array** | `A[0]`、`A[1]`、`A[2]`… 在記憶體裡排在一起，依序被存取 |
| Spatial | **sequential instruction** | 指令大多一條接一條執行，`PC = PC + 4`，下一條就在隔壁 |

> **陷阱** **Linked list（鏈結串列）不算**有好的 spatial locality：node 散在記憶體各處，靠 pointer 跳來跳去，位址不連續。

正因為程式有 temporal 和 spatial locality，memory hierarchy 才會 work：常用的放近（小、快、貴一點沒關係），不常用的放遠（大、便宜、慢一點沒關係）。DRAM 慢但便宜又 dense，提供大容量；SRAM 快但貴、不 dense，提供快速存取。

## 每一層由誰來管

```
registers（MIPS 32 個，最快）
    ↕  compiler（寫 assembly 時是 programmer 自己）
cache（SRAM，on-chip，和 CPU 在同一顆 chip）
    ↕  cache controller（hardware）
main memory（DRAM，off-chip，約 100 cycles）
    ↕  OS（software，加少量 hardware 協助），搬的單位是 page
disk（另一個獨立的裝置）
    ↕  file 的讀寫由 user 自己決定
```

- **Register** 也是存東西的地方，最靠近 processor，非常快，算完的結果都先存回 register。
- 學 single-cycle 時好像只有一個 memory，直接 load／store；但直接用 memory 太慢，每次 load／store 可能要 100 個 cycle。所以中間加一層 **cache**，和 processor 做在同一顆 chip 上，叫 **on-chip**。把 processor 晶片照片放大來看，很大一塊面積都是 cache。
- **Main memory** 是 **off-chip**：CPU 和記憶體條是分開買的，存取 memory 得出 chip，所以更慢。
- 管理者：
  - register ↔ memory：大部分是 **compiler** 決定哪個 variable 放哪個 register；寫 assembly 就是自己決定。
  - cache ↔ memory：**cache controller**，是 hardware；發生 cache miss 時由 hardware 讓 CPU 停下來，等資料讀進來。
  - memory ↔ disk：搬的是 page，主要由 **OS（operating system）** 做，是 software，再加一點 hardware 幫忙。
  - file：由 **user** 自己決定讀寫。

## Hit、miss 和它們的代價

```
   upper level（較小、較快）        lower level（較大、較慢）
   ┌─────────────┐                  ┌─────────────┐
   │      Y      │  ← block 搬上來 ─ │   X    Y    │
   └─────────────┘                  └─────────────┘
   要 Y：在 upper level 找到 → hit
   要 X：upper level 沒有 → miss，要從 lower level 搬上來
```

- **Hit（命中）**：要的資料就在 upper level。
- **Miss（未命中）**：CPU 去 upper level 找，找不到。
- **Hit rate（命中率）**：存取 upper level 時，找得到的比例。
- **Miss rate（未命中率）** = 1 − hit rate。
- **Hit time（命中時間）** = 存取 upper level 的時間 **＋ 判斷「這是不是我要的」的時間**。要判斷是因為上層小，那一格裡放的不一定是你要的，得檢查。
- **Miss penalty（未命中的代價）** = 把 upper level 某個 block 換掉、從 lower level 把新的 block 拿上來、再送給 processor 的時間。去下層拿要時間：main memory 本身有 **latency（延遲）**，從 off-chip 搬到 on-chip 還有 **transfer（傳輸）** 時間。

> **重點** **Hit time ≪ miss penalty**，所以 miss 一多，效能就掉很多。

> **陷阱** Hit time 不只是讀資料的時間，還包含「判斷是不是 hit」的時間。Miss rate = 1 − hit rate。

## Memory hierarchy 的四個問題

不管 cache 還是 virtual memory，都要回答同樣四個問題；四個都答完，cache 和 virtual memory 就全懂了。

> **比喻** 下面有 100 個人，上面只有 10 個座位，一定不是一人一位。

1. **Block placement（放置）**：搬上來的是 block，但上層比較小，要放在哪裡？
2. **Block identification（識別）**：很多人會搶同一個位置，要怎麼找到你的 block？
3. **Block replacement（替換）**：10 個位置坐滿了，第 11 個人要上來，總得請一個人出去。請誰？
4. **Write strategy（寫入策略）**：資料現在有兩份 copy，上層一份、下層一份，要不要隨時保持一樣？

Read 只是讀，不改內容，兩份 copy 一樣，不會出事；write 會改變內容，讓兩份不一致，write policy 的問題和代價都在這裡。

## Direct-mapped cache：位置就是 mod 的餘數

Cache 夾在 processor 和 memory 中間、建在 CPU 裡面（on-chip），因為 register 直接去 memory 要約 100 個 cycle，太慢。要解決的問題：哪些東西放上來？放哪裡（place）？要用的時候怎麼找到（identify）？Memory 地址是 0、1、2、3… 照順序排，可是程式存取東一個西一個，需要一套規則決定放哪。最簡單的規則叫 **direct-mapped cache（直接對映）**：每個 block 在 cache 裡都有一個**固定的位置**。

### 例子：cache 8 個 block、memory 32 個 block

進出都以 block 為單位；為了簡單，先假設 **1 block = 1 byte**。Cache 的 8 個位置編號 0～7。下層就照順序分配位置：0 到 7，再從 0 到 7，一輪一輪下去。把 memory 排成 4 列、每列 8 個，每一列剛好一輪：

```
cache 位置:     0   1   2   3   4   5   6   7
memory 第 1 列: 0   1   2   3   4   5   6   7
memory 第 2 列: 8   9  10  11  12  13  14  15
memory 第 3 列: 16  17  18  19  20  21  22  23
memory 第 4 列: 24  25  26  27  28  29  30  31
```

同一欄的 block 都搶 cache 同一格：1、9、17、25 都去 1 號；5、13、21、29 都去 5 號。

給一個地址，怎麼馬上知道在哪一格？

```
cache 位置 = (block address) mod (cache 的 block 數)
```

Mod 就是取餘數，例如 101 mod 100 = 1。

### 換成二進位：取最低幾個 bit 就是 index

Cache 位置要 3 個 bit（000～111），memory 的 block address 是 5 個 bit：

```
block  binary   mod 8   最後 3 bits
  1    00001      1        001
  9    01001      1        001
 17    10001      1        001
 25    11001      1        001

  5    00101      5        101
 13    01101      5        101
 21    10101      5        101
 29    11101      5        101
```

除以 8 的餘數，剛好就是最後 3 個 bit。結論：cache 的 block 數是 8 = 2³ 時，**不用真的做除法，取 block address 最低 3 個 bit 就是位置**。這 3 個 bit 叫 **index（索引）**。

> **陷阱** Direct-mapped 的 index 是「**block address**」mod block 數，不是 byte address；而且只有 block 數是 2 的冪次時，才剛好等於取最低幾個 bit。

### 例題：block 20 放哪一格

> **例題** 下層有 32 個 block（編號 0～31），cache 有 8 個 block（0～7）。第 20 個 block 會 map 到 cache 的哪一格？

1. 除數是**上層**的 block 數：8。
2. 20 ÷ 8 = 2 餘 **4**，所以放第 4 格。
3. 注意編號從 0 開始（0、1、2、3、4），「第 4 格」其實是第 5 個位置。
4. 用二進位驗證：20 = 16 + 4 = `10100`；4 = `100`。只有 8 個 block，位置只要 3 個 bit；`10100` 的最後 3 個 bit 是 `100`，剛好就是餘數 4。

```
block 20 = 10 100
              ^^^ index = 100 = 4 → cache 第 4 格
```

> **重點** Direct-mapped 規則：上層有幾個 block 就當除數，下層的 block number 去除，餘數就是位置；用二進位更快，直接取最後幾個 bit 當 index，馬上找到那一格。

## Tag 和 valid bit：格子裡到底是誰

1、9、17、25 都 map 到同一格 `001`。用 index 很快就能找到那一格，但問題是：**那一格裡放的，到底是不是我要的那個 block？** 四個都有可能坐在那裡。所以除了 data，還要把它的地址也存進 cache，才知道是誰。

要存整個地址嗎？不用。坐在 `001` 這格，就代表後 3 個 bit 一定是 `001`，這部分已經**隱含**在位置裡了。它們不同的是前面的 **high-order bits（高位）**：

```
block   地址      存的 tag   index（隱含在位置）
  1    00 001       00          001
  9    01 001       01          001
 17    10 001       10          001
 25    11 001       11          001
```

只存高位這一段就好，這叫 **tag（標籤）**。所以 cache 每一格要存：**data + tag**。

還有一個問題：剛開機時，cache 裡本來就有亂七八糟的 0 和 1，怎麼知道是真資料還是垃圾？再多一個 bit，叫 **valid bit（有效位元）**：

- 一開始全部設成 **0**，表示裡面的東西都不能用。
- 程式跑起來、真的從 memory 把資料讀進來了，才把那格的 valid 設成 **1**。

存取流程：**先用 low-order bits（index）找到位置，再檢查 valid 與 tag**，確定是不是我要的資料。

> **陷阱** Tag 只存「去掉 index（以及後面會學的 offset）之後的高位 bits」，不是整個 address。

## 跑一遍：22、26、22、26、16、3、16、18

> **例題** 8 個 block 的 direct-mapped cache，一開始全部 invalid。依序讀 word address 22、26、22、26、16、3、16、18，判斷每一次是 hit 還是 miss。

Address 是 5 bit 的 word address；8 個 block → index 3 bits，剩下前面 2 bits 是 tag：

```
| tag (2 bits) | index (3 bits) |
```

逐次存取：

| # | 地址 | Binary（tag index） | Index | Tag | 那格原本 | 結果 | 之後該格內容 |
|---|---|---|---|---|---|---|---|
| 1 | 22 | 10 110 | 110 | 10 | V = N（空） | miss | 110：V=Y, tag 10, Mem[22] |
| 2 | 26 | 11 010 | 010 | 11 | V = N（空） | miss | 010：V=Y, tag 11, Mem[26] |
| 3 | 22 | 10 110 | 110 | 10 | V=Y, tag 10 | **hit** | 不變 |
| 4 | 26 | 11 010 | 010 | 11 | V=Y, tag 11 | **hit** | 不變 |
| 5 | 16 | 10 000 | 000 | 10 | V = N（空） | miss | 000：V=Y, tag 10, Mem[16] |
| 6 | 3 | 00 011 | 011 | 00 | V = N（空） | miss | 011：V=Y, tag 00, Mem[3] |
| 7 | 16 | 10 000 | 000 | 10 | V=Y, tag 10 | **hit** | 不變 |
| 8 | 18 | 10 010 | 010 | 10 | V=Y, tag 11（是 26） | miss | 010：V=Y, tag 10, Mem[18]（26 被換掉） |

- 第 1、2 次 miss：cache 一開始是空的，資料本來就不在裡面。
- 第 3、4 次 hit：那格有資料（valid），而且 tag 相同。
- 第 8 次：index `010` 那格有資料，但那是 26 的，tag 是 `11`，而 18 的 tag 是 `10`。Tag 不同，不是我的資料 → miss。只有一個位置，26 只好出去，換 18 進來。

第 7 次存取後（第 8 次之前）的 cache：

```
index  V   tag  data
 000   Y   10   Mem[16]
 001   N
 010   Y   11   Mem[26]
 011   Y   00   Mem[3]
 100   N
 101   N
 110   Y   10   Mem[22]
 111   N
```

全部跑完後的 cache：

```
index  V   tag  data
 000   Y   10   Mem[16]
 001   N
 010   Y   10   Mem[18]   ← 26 被換掉
 011   Y   00   Mem[3]
 100   N
 101   N
 110   Y   10   Mem[22]
 111   N
```

結果：8 次存取，**3 次 hit、5 次 miss**。

> **重點** 用 index 找到那一格後，不是「有資料」就算數，一定要 **valid = 1 而且 tag 相同** 才是 hit。

> **陷阱** 18 和 26 都對到 index `010`，但 tag 不同（`10` vs `11`），所以 18 是 miss，會把 26 換掉。

Direct-mapped 的 replacement 很簡單：每個 block 只有一個位置可去，直接蓋過去。但如果原本那個 block 在 cache 裡被寫過（**dirty**），要先寫回 memory 再蓋。

## 32-bit 位址怎麼切：tag、index、offset

真正的 cache 裡，一個 block 不會只有 1 個 byte，通常有好幾個 byte。假設一個 block 就是一個 word（4 bytes），32-bit 位址的最後 2 個 bit 叫 **byte offset（位元組偏移）**：00、01、10、11 決定要拿這個 word 裡的第幾個 byte。

Cache 有 1K 個 word（1K = 1024 = 2¹⁰），要分出 1024 格需要 10 個 bit，這 10 個 bit 就是 **index**，用來決定放在 cache 的哪一格。Index 取的是 low-order 的部分，但要**先扣掉最後的 byte offset**。剩下最高的那些 bit 就當 **tag** 存起來。

```
 31                    12 11            2 1    0
+------------------------+---------------+------+
|        tag (20)        |   index (10)  |offset|
|                        |               | (2)  |
+------------------------+---------------+------+
```

> **重點** 一定要會的題型：給一個位址和 cache 結構，問 tag、index、byte offset 各幾個 bit。口訣：**先扣 offset（log₂ block 的 byte 數），再扣 index（log₂ block 數），剩下的才是 tag。**

### 例題：1024 個 block，每個 block 4 bytes

1. Offset：block 4 bytes → log₂4 = **2** bits。
2. Index：1024 個 block = 2¹⁰ → **10** bits。
3. Tag：32 − 10 − 2 = **20** bits。

Tag 有 20 bits，表示 cache 的每一格有 2²⁰ 個不同的 block 在搶同一個位置，靠 tag 來分辨目前坐在這格的是誰。

每一格除了 data 還要一個 valid bit，所以一格的大小是：

```
valid 1 bit + tag 20 bits + data 32 bits = 53 bits
```

### 例題：結構一樣，block 改成 8 bytes

- 問：一個 block 是 2 個 word（8 bytes）時，後面要留幾個 bit？答：log₂8 = **3** bits。
- 若 block 數仍是 1024 → index 仍是 10 bits。
- Tag = 32 − 10 − 3 = **19** bits。

> **陷阱** Cache 結構一變，tag 長度就跟著變。Index 只由 cache 有多少個 block 決定；block 變大而 block 數不變時，offset 變長、tag 變短。

## 例題：64 個 block × 16 bytes，byte address 1200 放哪一格

> **例題** Cache 有 64 個 block，每個 block 16 bytes，位址 32 bits。（1）位址怎麼切？（2）byte address 1200 會 map 到 cache 的哪一格？

**（1）切位址**

1. Offset：16 bytes = 2⁴ → **4** bits（block 裡的第幾個 byte）。
2. Index：64 個 block = 2⁶ → **6** bits。
3. Tag：32 − 6 − 4 = **22** bits。

**（2）用除法算**

1. 1200 是 byte address，一個 block 16 bytes：⌊1200 / 16⌋ = **75**，它在記憶體的第 75 個 block。
2. Cache 有 64 個 block：75 mod 64 = **11**，放在 cache 的第 11 格。

**（3）用二進位再看一次**（不用真的除也知道在哪格）

1200 = 1024 + 128 + 32 + 16 = `10010110000`₂。

```
1200 = 0000 0000 0000 0000 0000 0100 1011 0000
                                        ^^^^  最後 4 bits = offset（block 內第 0 個 byte）
去掉 offset → block address = 1001011₂ = 75
block address 的後 6 bits = 001011₂ = 11  → index
再前面的 22 bits = 000...0001         → tag = 1（＝ ⌊75 / 64⌋）
```

| 欄位 | bit 數 | 值 |
|---|---|---|
| tag | 22 | 0000000000000000000001（= 1） |
| index | 6 | 001011（= 11） |
| offset | 4 | 0000（= 0） |

除以 64 等於把 block address 右移 6 位，取 mod 64 等於只留最後 6 bits，所以「取後 6 bits」就是 index。

> **陷阱** Memory address 以 byte 為單位。要先除以 block 的 byte 數，換成 block address，才能 mod cache 的 block 數。直接拿 1200 mod 64 是錯的。

## 先把 byte address 換成 block address

題目給的位址是 **byte address**，也就是以 byte 為單位編號。這裡是最常搞混的地方。

- 要算第幾個 **word**：一個 word 4 bytes，最後 2 bits 不用看。byte 0～3 是 word 0，byte 4～7 是 word 1。
- 要算第幾個 **block**：上下兩層（lower level、upper level）都是以 block 為單位在搬，所以用 mod 找位置時，兩邊的單位一定都要是 block。

一個 block 2 個 word、一個 word 4 bytes → 一個 block 8 bytes，後面 3 個 bit 可以忽略。8 個 byte 綁成一體：

```
byte address   block
0000 ~ 0111    block 0   （最後 3 bits = block 裡第幾個 byte）
1000 ~ 1111    block 1
```

做 mapping 的步驟：

1. 先看 block size 多大（lower、upper level 的 block 要一致）。
2. 去掉 block 內的 bit，得到 block number（block address）：
  - block 8 bytes = 2³ → 去掉後 3 bits
  - block 16 bytes = 2⁴ → 去掉後 4 bits
  - block 32 bytes = 2⁵ → 去掉後 5 bits
3. 拿 block number 去 mod：有幾個 set（direct-mapped 時就是幾格），就知道 index 有幾個 bit。
4. 剩下的全部是 tag。

> **陷阱** mod 之前兩邊單位要一致：先把 byte address 換成 block address，再 mod set 數。

## 同一個 block 裡的 word：只差 offset

給一個位址要拿某個 word：先用 index 那段決定是 cache 的第幾格（第幾個 block）。

問：同一個 block 裡的那些 word，index 和 tag 是不是都一樣？
答：是。Block 是把連續的位址圈在一起，圈在一起的位址，前面的 high-order bits 都一樣，所以 index、tag 相同，只差最後幾個 low-order bits。

> **例題**（示意）4-bit 的 word address，每 2 個 word 綁成一個 block，cache 有 4 格。

```
word address   block   index   block offset
0000           0       00      0
0001           0       00      1    ← 同一 block：前 3 bits 相同
0010           1       01      0
0011           1       01      1
...
1010           5       01      0
1011           5       01      1
```

word 0010、0011 屬於同一個 block，tag（最高 1 bit = 0）和 index（01）一模一樣，只有最後的 block offset 不同；word 1010、1011 也 map 到第 01 格，但 tag 是 1，靠 tag 區分。

存取流程：

1. **index** 找到 cache 的那一格；
2. 比對 **tag**（且 valid）確認是不是我要的 block；
3. **block offset** 選出 block 裡的哪個 word；
4. **byte offset** 選 word 裡的哪個 byte（以 word 為單位存取時先不理它）。

## Block 要多大：好處和代價

Block size 可以自己定：一個 word、四個、十六個……。

### 好處：spatial locality

Block 只有一個 word，就用不到 spatial locality，下一個要用的根本沒搬進來。Spatial locality 是「用到一個，隔壁很快也會用到」，那就乾脆一起搬：

```
block = [w0 w1 w2 w3]
讀 w0 → miss，整個 block 搬進來
讀 w1 → hit
讀 w2 → hit
讀 w3 → hit
```

所以因為 spatial locality，**large block size 可以降低 miss rate**。

### 代價

1. **Block 數變少、競爭變多**：cache 總大小通常固定（做大會變慢又貴）。例如 cache 有 10 個 block，block 變兩倍大就只剩 5 個 block（同理 16 格變 8 格）。位置變少，更多 block map 到同一格，更容易 miss。
2. **Miss penalty 變大**：block 越大，每次 miss 從下層搬要花越多時間。本來 4 個 word 很快，變 16 個 word 就要更久，而且通常要等整塊搬完 CPU 才重新存取。
3. **可能白搬**：一大塊搬進來，搞不好只用到其中兩個。
4. **Pollution（汙染）**：block 越大、裡面 element 越多，只要任何一個被寫過，整個 block 就是 dirty，被換掉時要寫回 memory，又多花時間。

### 改善 large block 的 miss penalty

- **Early restart**：要的是第 4 個 word，那 1、2、3、4 一搬到就讓 CPU 開始做，5 以後在背後慢慢搬。
- **Critical word first**：先搬要的那個 word，再搬後面的，最後回頭搬前面的。

```
block 16 個 word，要第 4 個：
early restart       ：1 2 3 [4]→CPU 開始  5 6 ... 16
critical word first ：[4]→CPU 開始  5 6 ... 16  1 2 3

block 8 個 word，要第 5 個（critical word first）：
5 6 7 8 1 2 3 4
```

兩招都需要多一些 hardware。

### 看圖：miss rate 對 block size

這張圖最重要，看圖要能講出設計的道理（數值示意，趨勢同課本）：

- X 軸：block size；Y 軸：miss rate；每條線是一種 cache size：4K、16K、64K、256K（4K 在最上面）。

| 曲線 | 現象 | 原因 |
|---|---|---|
| 4K 前半段 | 往下 | block 變大，spatial locality 發揮作用，要用的先搬進來了 |
| 4K 後半段 | 往上翹 | block 太大、block 數太少，大家搶同一個位置，miss 反而變多 |
| 64K、256K | 平很多 | cache 夠大，block 再大，block 數還是夠，不會擠來擠去 |

## Read hit 與 read miss

Cache 存取分 read、write，各自又分 hit、miss，一共四個 case：

| | hit | miss |
|---|---|---|
| read | CPU 照常 | stall，從下一層搬整個 block |
| write | write-through 或 write-back | write allocate 或 write around |

- **Read hit**：最好的情況。資料就在 cache，很快拿到，CPU 照常做，完全不受影響。
- **Read miss**：資料不在 cache，CPU 必須 **stall**，停下整條 pipeline，因為沒資料做不下去。這時去 next level（可能是 L2 cache 或 main memory）把整個 block 搬進 cache。
  - instruction cache miss → 資料到了之後重新做一次 instruction fetch；
  - data cache miss → 等資料到了，把那次 data access 完成。

為什麼由 hardware 處理？因為 compile 的時候根本不知道哪次存取會 hit、哪次會 miss。

> **陷阱** Cache miss 是 **hardware stall**：CPU 不會讓給別的程式，還是自己的，只是停下來等資料進來再繼續。之後的 virtual memory（memory 與 disk 之間）發生 miss（page fault）時，才是由 OS 用 interrupt／exception 處理。兩者處理方式不同。

## Write hit：write-through 與 write-back

Write hit：要寫的資料已經在 cache 裡。Read 做 100 次都不影響內容，可是 write 一次，cache 和 memory 的兩份 copy 就不一樣了，這是 **consistency（一致性）** 問題。

> **例題**（數值示意）cache、memory 原本都存 X = 5。CPU 把 X 寫成 7 但只寫進 cache：cache 是 7、memory 還是 5，兩份 copy 不一致。

### Write-through

每次更新 cache，同時也寫回 main memory，兩邊永遠一致（consistent）。

- 優點：兩份 copy 永遠一樣，就算突然發生 interrupt，memory 裡也是最新的。
- 缺點：每次都要寫 memory，浪費 memory bandwidth（頻寬），製造很多 traffic，而且很慢。

> **例題** Write-through 有多慢？平常 CPI = 1，10% 的指令是 store，寫一次 memory 要 100 個 cycle。就算是 hit，每個 store 也要等 memory 寫完：
> effective CPI = 1 + 10% × 100 = 1 + 10 = **11**，慢了 11 倍。

### Write buffer

解法：不直接寫 main memory，先寫進 processor 裡的一個小 **write buffer（寫入緩衝區）**。

- Store 寫進 buffer，CPU 就繼續跑；buffer 由 memory controller 在背後慢慢寫回 memory。
- 只有 buffer 滿了，processor 才需要停下來等。
- Write buffer 其實就是一個 FIFO（先進先出的佇列），通常有 4 個 entry。

問：下一個指令要 read 的資料，還在 buffer 裡沒寫回去怎麼辦？
答：可以直接從 buffer **forward（轉送）** 過來，不用再去 memory 拿，但要有 hardware 來控制。

> **陷阱** Write buffer 只能吸收短時間的 store 高峰。如果 store 太頻繁，寫入速度平均起來比 memory 消化的速度還快，buffer 一定會滿，還是會 stall。

### Write-back

每寫一次就改 memory 太花時間，也增加 memory 的 traffic，所以 write-back 只把新的值寫在 cache 裡，一直等到這個 block 被 **replace**（很久沒用、位置被別人搶走）時，才把最新的資料寫回 memory。

用 write-back，每一格要多記一件事：它有沒有被寫過。這個 bit 叫 **dirty bit**：

- 被寫過 → 設成 1；
- 被換掉時：dirty = 1 才寫回 memory；dirty = 0 表示和 memory 一樣，直接蓋過去。

優缺點：

- 優點：traffic 少。（示意）同一格連寫 3 次，write-through 要寫 memory 3 次，write-back 只在被換掉時寫 1 次。
- 缺點：寫回之前，memory 那份是舊的，兩份 copy 不一致。

不管 write-through 還是 write-back，寫回 memory 時都可以加一個 buffer，讓它慢慢寫，CPU 不用等。

> **陷阱** Write-back 一定要有 dirty bit；dirty = 0 的 block 被換掉時直接覆蓋，不用寫回。

| | write-through | write-back |
|---|---|---|
| 寫 cache 時 | 同時寫 memory | 只寫 cache |
| 何時寫回 memory | 每次 | block 被 replace 且 dirty = 1 |
| 需要 dirty bit | 不用 | 要 |
| 一致性 | 永遠一致 | 寫回前 memory 是舊的 |
| memory traffic | 多 | 少 |

## Write miss：要不要搬進來

第四個 case：要寫的東西不在 cache 裡。直覺是先把 block 搬進來，再把新資料寫上去，但要看搭配哪種 write policy。

- **Write allocate**：write miss 時把 block fetch 進 cache，再寫到 cache。Write-back 本來就是寫在 cache、等 replace 才寫回，所以通常用 write allocate。
- **No-write allocate（又叫 write around）**：write miss 時直接寫 main memory，不把 block 搬進來。Write-through 不一定要 allocate，因為很多寫入（例如 initialization 初始化）只寫一次、之後根本不讀，搬進來只會增加 traffic。

| write policy | write miss 時 |
|---|---|
| write-back | 通常 write allocate |
| write-through | 可以 write allocate，也可以 no-write allocate（write around） |

> **重點** Hit／miss 再分 read／write，四個 case 各做什麼，分類清楚就不會亂。

## 真實例子：Intrinsity FastMATH

Intrinsity FastMATH 是一顆商用 embedded processor（嵌入式處理器），有 12 個 stage 的 pipeline，每個 cycle 都可能同時要取指令和存取資料，所以用 **split cache**：instruction cache（I-cache）和 data cache（D-cache）分開，可以同時存取。

- 每個 cache 都是 256 個 block，每個 block 16 個 word。
- 16 words = 64 bytes；256 × 64 bytes = **16 KiB**。（前面一個 word 一個 block 的例子其實很極端。）
- D-cache 可以設成 write-through，也可以設成 write-back。

Miss rate（課本的 SPEC 測試數據）：

| | miss rate | 原因 |
|---|---|---|
| I-cache | 0.4% | 指令大多照順序（sequential）執行，又有 loop，temporal、spatial locality 都很好抓 |
| D-cache | 約 11.4% | 資料比較亂：array 還算整齊，其他資料、尤其有 pointer 的，不知道會指去哪 |
| 合計 | 約 3.2% | 其實相當低 |

### FastMATH 的位址切割

> **例題** 32-bit byte address，256 個 block，每個 block 16 個 word，一個 word 4 bytes。位址怎麼切？

1. **Byte offset**：一個 word 4 bytes → **2** bits，選 word 裡第幾個 byte。
2. **Block offset**：一個 block 16 words = 2⁴ → **4** bits，選 block 裡第幾個 word。
3. **Index**：256 個 block = 2⁸ → **8** bits，選第幾個 block。
4. **Tag**：32 − 8 − 4 − 2 = **18** bits，map 到同一格的 block 靠這 18 bits 區分。

```
 31          14 13       6 5          2 1      0
+--------------+----------+------------+--------+
|   tag (18)   | index (8)| block off  | byte   |
|              |          |   (4)      | off (2)|
+--------------+----------+------------+--------+
```

Cache 的結構（256 列）：

```
index  valid  tag(18)   data: word0 word1 ... word15
  0     V      ....          ...
  1     V      ....          ...
 ...
 255    V      ....          ...
```

查找流程：

1. 用 8-bit index 選到一列。
2. 拿位址的 tag 跟那列存的 tag 比，一樣而且 valid = 1 就是 **hit**。
3. 一列（一條 line，也就是一個 block）有 **16 個 word**，整塊一起搬。Hit 之後用 4-bit block offset 控制一個 **16 選 1 的 MUX（多工器）**，選出要的 word：0000 是第 0 個 word，0001 是第 1 個……一直到 1111。
4. Word 選出來後，再用最後 2 bits 的 byte offset（00、01、10、11）挑這個 word 4 個 byte 中的哪一個。

同一個 block 的 16 個 word，tag 和 index 全部一樣，只差這 4 個 block offset bits。

問：如果一個 block 只放 4 個 word 呢？答：block offset 只要 log₂4 = **2** bits。

> **陷阱** Block offset 選 word、byte offset 選 byte；兩者都不參與 index 與 tag 的計算。

## Memory 怎麼配合 cache：miss penalty

Cache hit 不用碰 memory；miss 就要從 memory 把整個 block 搬上來。Miss penalty 取決於搬一個 block 的時間，以及 memory 怎麼設計來配合 cache。

### 三種 memory 組織

1. **One-word-wide memory**：memory 一次存取一個 word，bus（匯流排）也一次只傳一個 word。
2. **Wide memory**：一次存取四個 word，bus 也做得一樣寬，四個 word 同時傳到 cache。
3. **Interleaved memory（交錯）**：memory 切成 4 個 bank，可以同時存取；但 bus 沒那麼寬，還是一次傳一個 word。

### Access time 與 cycle time

- **Access time**：給位址到拿到資料的時間。
- **Cycle time**：從這次存取開始，到下一次可以再存取的時間。

為什麼有 cycle time？DRAM 是電容做的，每次讀都要先 sense amplify（放大訊號），還要把資料寫回電容，才能做下一筆，所以 cycle time 比較長。

- 沒有 interleave（①②）：只有一個 memory，一筆做完、等 cycle time 結束，才能做下一筆。
- Interleave（③）：切成 4 個獨立的 bank，每個 bank 也要等 cycle time，但 4 個同時做，一次就拿到 4 筆。

### 例題：算三種組織的 miss penalty

> **例題** 假設送 address 給 memory 要 1 個 bus clock；每次存取 DRAM 要 15 個 cycle 才能開始下一筆；把一個 word 傳回 cache 要 1 個 cycle；cache block 是 4 個 word。三種組織的 miss penalty 各是多少？

| 組織 | 送位址 | DRAM 存取 | 傳回 cache | miss penalty |
|---|---|---|---|---|
| ① one-word-wide | 1 | 4 次 × 15 = 60 | 4 次 × 1 = 4 | 1 + 60 + 4 = **65** cycles |
| ② wide（4 words） | 1 | 1 次 × 15 = 15 | 1 次 × 1 = 1 | 1 + 15 + 1 = **17** cycles |
| ③ interleaved（4 banks） | 1 | 4 bank 同時，1 次 × 15 = 15 | 4 次 × 1 = 4 | 1 + 15 + 4 = **20** cycles |

```
① 位址|--DRAM 15--|傳|--DRAM 15--|傳|--DRAM 15--|傳|--DRAM 15--|傳|
② 位址|--DRAM 15（4 words 一起）--|傳(4 words)|
③ 位址|--bank0..3 同時 15--|傳|傳|傳|傳|
```

- Wide 最快，但 bus、pin 都要變寬，hardware 很貴。
- Interleave 只是把 memory 切成 bank，成本小，效能卻接近。為什麼有用？同時存取 4 個 bank，就把 cycle time 藏起來了，資料一到就能傳。

> **陷阱** Interleaved 的 bus 仍是 1 word 寬，所以傳輸要 4 次（4 × 1）；但 DRAM 存取只要 1 次 15 cycles。不要寫成 1 + 15 + 1。

## DRAM 的 row、column 與 DDR SDRAM

Cache 給一個位址，馬上就能從位址知道在哪個 block。DRAM 不一樣：位址拆成兩部分，一部分做 **row access**，一部分做 **column access**。

> **例題** 22-bit 位址拆一半：11 bits 給 row decoder，可以選 2¹¹ = 2048 條 row；另外 11 bits 是 column。整個 DRAM 就像一個 2048 × 2048 的 bit 矩陣。

存取步驟：

1. 用 row address 決定哪一列，把**整列**讀下來，放進 **latch**。
2. 用另一半的 column address，從 latch 裡挑出要的那一個。

好處：整列已經在 latch 裡，接下來讀同一列的其他 column 就非常快。連續的位址可以用 **burst mode** 一口氣讀出來，而 cache 的 block 剛好就是連續的位址。

### DDR SDRAM

現在用的 DRAM 叫 **DDR SDRAM（Double Data Rate Synchronous DRAM）**：

- 最早的 DRAM 是 **asynchronous（非同步）** 的，要靠一些 control signal（例如低電位有效的讀寫訊號）控制讀寫。
- **Synchronous（同步）**：直接用 clock 來控制讀寫。
- **Double data rate**：clock 的 rising edge（上升緣）和 falling edge（下降緣）都能傳資料，所以兩倍快。
- **Burst mode**：連續的位置都已在 latch 裡，只要給起始位址（starting address）和長度，就跟著 clock 一筆一筆連續讀出來。

現在 PC 都用 DDR SDRAM，每 GB 的價錢一路往下掉。Row access 和 column access 的時間都在進步，而 column access 一直比 row access 快很多，因為 row 已經在 latch 裡了。

## Cache 對 CPI 的影響：2 變 5.44

前面講了 memory hierarchy（靠 locality）、最基本的 direct-mapped cache，以及 memory 怎麼配合 cache。接下來量一量這個最簡單的 cache，performance 到底怎麼樣。

```
CPU time = (CPU execution cycles + memory-stall cycles) × cycle time

memory-stall cycles = (memory accesses / program) × miss rate × miss penalty
```

- 不管 hit 或 miss，都得先查 cache 才知道，所以 **hit 的時間算在 execution cycles 裡**。
- 只有 miss 時，才要加上額外的 memory-stall cycles。
- Memory access 包含取指令與 load、store。
- **Base CPI**：假設完全沒有 cache miss（每次都 hit）時，每個指令平均要幾個 cycle。

> **例題** I-cache miss rate 2%，D-cache miss rate 4%，miss penalty 100 cycles，base CPI = 2，load／store 佔全部指令的 36%。實際 CPI 是多少？

兩個 cache 分開算：

1. **I-cache**：每個指令都要被 fetch，所以每個指令都存取 I-cache **1 次（100%）**。
   stall = 1 × 2% × 100 = **2** cycles／指令。
2. **D-cache**：只有 36% 的 load／store 存取 D-cache。
   stall = 36% × 4% × 100 = 0.36 × 4 = **1.44** cycles／指令。
3. 實際 CPI = 2 + 2 + 1.44 = **5.44**。

```
CPI
5.44 |  [ D-cache stall 1.44 ]
4.00 |  [ I-cache stall 2.00 ]
2.00 |  [ base CPI     2.00 ]
   0 +-----------------------
```

> **陷阱** I-cache 的存取比例是 100%，不是 64%（1 − 36%）：每個 instruction 都要 fetch。只有 load／store（36%）才多存取 D-cache。這是核心，搞錯就算不出來。

## AMAT：平均記憶體存取時間

AMAT（average memory access time，平均記憶體存取時間）用來衡量「平均一次記憶體存取要花多久」。

不管最後是 hit 還是 miss，都要先花 **hit time** 去查 cache，所以 hit time 每一次都要付；萬一是 miss，再加上額外的 **miss penalty**：

```
AMAT = hit time + miss rate × miss penalty
```

> **例題** clock 1 ns，hit time 1 個 cycle，miss penalty 20 個 cycle，I-cache 的 miss rate 5%（也就是 20 次存取裡平均 1 次 miss）。求 AMAT。

```
AMAT = 1 + 5% × 20
     = 1 + 1
     = 2 cycles  = 2 × 1 ns = 2 ns
```

前面那個 1（hit time）一定要加。

> **陷阱** 常見錯法：0.95 × 1 + 0.05 × 20 = 1.95，以為 95% hit、5% miss 分開算。錯在 hit time 每次都要付，乘的是 100%，不是 hit rate；miss 的那 5% 只是「額外」多付 20。
> 真的要拆成 hit / miss 兩種情況，miss 那次總共花 1 + 20 = 21：0.95 × 1 + 0.05 × 21 = 0.95 + 1.05 = 2，結果一樣。

### 從次數推 AMAT：5 個 request

換個角度，從最原始的「次數」推 AMAT，可以拿來驗證公式。

> **例題** 有 5 個 request：A、B、C、D、E。A、B、C 都 miss，D、E 是 hit。hit 一次花 t = 5 秒，miss 一次花 m = 10 秒（秒數只是方便計算的示意單位；這裡把 miss 的「整段時間」叫做 miss penalty）。求平均存取時間。

```
request :  A    B    C    D    E
結果    :  M    M    M    H    H
時間    : 10   10   10    5    5

平均 = (hit 次數 × hit time + miss 次數 × miss 時間) ÷ 總次數
     = (2 × 5 + 3 × 10) ÷ 5
     = (10 + 30) ÷ 5
     = 40 ÷ 5 = 8 秒
```

hit 的 request 要 5 秒、miss 的要 10 秒，全部平均下來每個 request 8 秒（把 5 根長短不一的柱子攤平後的平均高度）。

### 標準公式：改用 hit ratio

考題通常不會告訴你幾次 hit、幾次 miss，而是直接給 **hit ratio**（命中率）h：

- h = hit 次數 ÷ 總次數
- miss ratio = 1 − h = miss 次數 ÷ 總次數

把上面的式子拆成兩半：hit 那部分除以總次數，加上 miss 那部分除以總次數。前者的「hits ÷ attempts」就是 h，後者的「misses ÷ attempts」就是 1 − h，於是得到大部分書上的標準公式：

```
AMAT = h × t + (1 − h) × m
```

代回例子：h = 2/5 = 0.4

```
AMAT = 0.4 × 5 + 0.6 × 10 = 2 + 6 = 8 秒   （和直接用次數算的一樣）
```

> **陷阱** 這個公式的 m 是 miss 的「總時間」（10 秒）。另一種寫法 `hit time + miss rate × miss penalty` 裡的 penalty 是「額外」多花的時間（10 − 5 = 5 秒）：5 + 0.6 × 5 = 5 + 3 = 8，結果相同。
> 先看清楚題目的 miss penalty 是總時間還是額外時間：總時間用 `h·t + (1−h)·m`；額外時間用 `t + (1−h)·penalty`。

## CPU 越快，cache 越重要

cache 對 performance 很重要，但設計 processor 時常常沒被考慮進去。就算 CPU 的 performance 一直提高，miss penalty 反而變得更顯著（significant）：

- **降低 base CPI**：memory stall 的 cycle 數不變，佔的比例反而變大。沿用前面 CPI 從 2 變 5.44 的例子（memory stall 3.44 cycle）：stall 佔 3.44 / 5.44 ≈ 63%；把 base CPI 降到 1，總 CPI 變 4.44，stall 佔 3.44 / 4.44 ≈ 77%。
- **提高 clock rate**：memory 的存取時間（ns）不變，換算成 cycle 數就變多，stall 的比例也跟著增加。

寫程式也一樣：只看 big O、只算指令數（instruction count），不考慮 memory access pattern，算出來的和實際 performance 會差很多（後面會看一個 radix sort 對 quicksort 的例子）。

## 改善 cache 的三個方向

回到公式 `AMAT = hit time + miss rate × miss penalty`，結果由三個變數決定；想讓結果變小，從任何一個下手都可以（做研究也是這樣找方向）：

1. 降低 **hit time**：檢查 data 在不在 cache 的時間。
2. 降低 **miss rate**。
3. 降低 **miss penalty**。

接下來的 associativity 主要是在降 miss rate，但會影響 hit time。

## Direct-mapped 的缺點：一個號碼一張椅子

先回頭看原來的 direct-mapped：cache 有 8 個 block，memory 有 32 個 block。memory 的 block address 除以 8 的餘數就是 cache 裡的位置；好幾個 block 會到同一格，就用 high-order bits（tag）比對現在坐在那裡的是誰。

> **例題** 存取順序剛好是 1、9、17、25 四個 block 輪流（1、9、17、25、1、9、17、25，共 8 次），direct-mapped 8 格 cache 的結果？

這四個 block 除以 8 都餘 1，全部 map 到 index 001（5-bit block address：00001、01001、10001、11001，最後 3 bit 都是 001，前 2 bit 是 tag）。

```
存取  block  index  tag   hit/miss  index 001 存的   踢出
 1      1     001   00     miss         1             —
 2      9     001   01     miss         9             1
 3     17     001   10     miss        17             9
 4     25     001   11     miss        25            17
 5      1     001   00     miss         1            25
 6      9     001   01     miss         9             1
 7     17     001   10     miss        17             9
 8     25     001   11     miss        25            17
```

8 次全部 miss。

> **比喻** 一個號碼只有一張椅子，一次只能坐一個人；下一個人來，前一個人就得出去。可是 cache 其他 7 個位置都空著沒人坐，這四個人卻一直擠同一張椅子。限制太大，所以要改善。

## Fully associative：坐哪裡都可以

最直接的改善：不要給固定位置，cache 只要有空位，坐哪裡都可以。這是另一個極端，叫 **fully associative**（全關聯）。

同樣的 1、9、17、25 輪流存取：第一個放第一格、第二個放第二格……

```
存取  block  hit/miss  cache 內容（8 格）
 1      1     miss     1  -  -  -  -  -  -  -
 2      9     miss     1  9  -  -  -  -  -  -
 3     17     miss     1  9 17  -  -  -  -  -
 4     25     miss     1  9 17 25  -  -  -  -
 5      1     hit      （不變）
 6      9     hit
 7     17     hit
 8     25     hit
```

只有前 4 次 miss（第一次搬進來），之後全部 hit。

代價：

- 要找的時候不知道它在哪一格，所以**沒有 index**，整個 block address 都要存成 tag。
- 存取時每一格都有可能，每一格都要 check。一格一格 sequential 地比？8 個 entry 要比 8 次、花 8 個 cycle，太慢。
- 所以要同時比：每個 entry 配一個 **comparator**（比較器），8 個 entry 就 8 個 comparator 一起比；16 個 entry 就 16 個。

> **重點** Fully associative 優點是非常彈性，有空位就能用、絕不浪費；缺點是比對的 hardware 很多，很貴。

## Set associative：一個號碼幾張椅子

fully associative 太自由了，不需要整個 cache 都能坐，一個號碼裡有兩個或四個位置就夠。這叫 **set associative**（集合關聯），是 direct-mapped 和 fully associative 的折衷：

- 像 direct-mapped 一樣先 map 到一個號碼，這個號碼叫 **set**；
- 但 set 裡有好幾個位置（way），進了 set 之後，在 set 裡像 fully associative 一樣全部同時比對。

> **比喻** 先找家，再找房間。原本 8 戶人家、每戶一個房間（direct-mapped）；現在把 8 個 entry 改成 4 戶、每戶 2 個房間（2-way）。以前要除以 8 找位置，現在除以 4 就找到家（set）；到了家，兩個房間都可能住著你要找的人，所以兩個房間同時查（2 個 comparator）。比 fully 的 8 個少，比 direct-mapped 的 1 個多一點，取中間。

### 位置怎麼算

```
set = block number mod（set 的數目）
set 數 = cache 的 block 數 ÷ n          （n-way）
```

例如 2-way、4 個 set 時，9 mod 4 = 1，block 9 放在 set 1。找的時候只要在那個 set 裡找，2-way 只要 check 兩個。

> **陷阱** set associative 是用「set 的數目」去 mod，不是用 block 的數目；index bits = log₂（set 數），不是 log₂（block 數）。

### 例題：1、9 交替存取

> **例題** 8 個 block 的 cache，block 1、9 交替存取（1、9、1、9、1、9，共 6 次）。比較 direct-mapped 與 2-way（4 個 set、每 set 2 格）。

Direct-mapped：1 mod 8 = 1、9 mod 8 = 1，同一格只有一個位置，這個進來那個就出去。

```
存取  block  hit/miss  index 1 存的
 1      1     miss        1
 2      9     miss        9
 3      1     miss        1
 4      9     miss        9
 5      1     miss        1
 6      9     miss        9
```

6 次全部 miss。

2-way：1 mod 4 = 1、9 mod 4 = 1，都在 set 1，但 set 1 有兩張椅子，兩個都放得下。

```
存取  block  set  hit/miss  set 1 內容
 1      1     1    miss      1  -
 2      9     1    miss      1  9
 3      1     1    hit       1  9
 4      9     1    hit       1  9
 5      1     1    hit       1  9
 6      9     1    hit       1  9
```

只有前 2 次 miss。做到 4 張椅子（4-way）更有彈性；如果所有位置都在同一個 set 裡，就變成 fully associative，彈性最大。

### 統一的看法

| 組織 | 每個 set 幾格 | set 數（8 個 block） | index bits | comparator |
|---|---|---|---|---|
| direct-mapped（1-way） | 1 | 8 | 3 | 1 |
| 2-way set associative | 2 | 4 | 2 | 2 |
| 4-way set associative | 4 | 2 | 1 | 4 |
| fully associative（8-way） | 8 | 1 | 0（沒有 index） | 8 |

- n-way 的 n 就是一個 set 裡有幾個 block：2 個叫 two-way，4 個叫 four-way；n-way 要 n 個 comparator，不必整個 cache 每格都配一個。代價是彈性沒有 fully associative 那麼大。
- direct-mapped 可以看成 1-way；fully associative 是 n-way，n 等於 cache 的 block 數。
- fully associative 一個 block 可以到任何 entry，所以不需要 index，但每個 entry 都要 comparator。

## 例題：block 12 放在哪

> **例題** 8 個 entry 的 cache，block address 12 在三種組織下可以放在哪裡？

- **Direct-mapped**：12 mod 8 = 4，只能放第 4 格，只要比 1 個 tag。index 用 3 bit。
- **2-way set associative**：先算 set 數：8 個 entry、每 set 2 個 → 4 個 set（0～3）。12 mod 4 = 0 → set 0，set 0 的兩格都可以放；set 0 有兩個 entry，要 2 個 comparator 同時找。index 用 2 bit。
- **Fully associative**：任何一個空位都可以放；不知道在哪一格，要 8 個 comparator 同時比。不需要 index。

```
direct-mapped   格：0 1 2 3 [4] 5 6 7         只能在 4
2-way           set：[0] 1 2 3（每 set 2 格）  set 0 的任一格
fully           8 格任一格
```

## Associativity 越高，tag 越長

同樣 8 個 block 的 cache 可以組成四種樣子，每個 entry 都存 tag + data：

```
1-way（direct-mapped）：8 個 set × 1 個（tag, data）
2-way                 ：4 個 set × 2 個（tag, data）
4-way                 ：2 個 set × 4 個（tag, data）
8-way（fully）        ：1 個 set × 8 個（tag, data）
```

存取 2-way 時，block address 除以 4 找到 set，把 set 裡兩個 tag 拿出來同時比，看是 hit 還是 miss；4-way 每個 set 有 4 個 tag；8-way 只有一個 set，8 個 tag 同時比。

為什麼 tag 長度會變？理論上要存整個 address 才知道是誰，但 index 那段在同一個位置一定都一樣，是 redundant 的，所以去掉 index 剩下的才是 tag。address 長度固定時，index 每少 1 bit，tag 就多 1 bit。

> **例題** 5-bit 的 block address（memory 32 個 block），8-block cache 四種組織的 index / tag 長度？

| 組織 | set 數 | index bits | tag bits |
|---|---|---|---|
| direct-mapped | 8 | 3 | 5 − 3 = 2 |
| 2-way | 4 | 2 | 5 − 2 = 3 |
| 4-way | 2 | 1 | 5 − 1 = 4 |
| fully | 1 | 0 | 5 − 0 = 5 |

> **觀念** 變來變去只有一個概念：address 分成 tag 和 set number（當 index）。一個 set 只有一個 entry 就是 direct-mapped；全部擺在一個 set 就是 fully associative。associativity 越高，tag 越長。

## 例題：存取 0、8、0、6、8

> **例題** cache 只有 4 個 block，依序存取 block 0、8、0、6、8。分別用 direct-mapped、2-way set associative、fully associative，各有幾次 miss？（set associative 用 LRU 替換）

三種組織：direct-mapped 有 4 個位置（0～3），mod 4；2-way 有 2 個 set，mod 2；fully associative 沒有 index，只有 1 個 set（4 格都在裡面）。

### Direct-mapped（mod 4）

```
存取  block  index      hit/miss  cache[0]  cache[1]  cache[2]  cache[3]
 1      0    0 mod 4=0   miss        0         -         -         -
 2      8    8 mod 4=0   miss        8         -         -         -     （踢掉 0）
 3      0    0           miss        0         -         -         -     （踢掉 8）
 4      6    6 mod 4=2   miss        0         -         6         -
 5      8    0           miss        8         -         6         -     （踢掉 0）
```

每一次都 miss：明明只是 0、8 交替，但只有一個位置可放，5 次全 miss。

### 2-way set associative（2 個 set，mod 2，LRU）

```
存取  block  set        hit/miss  set 0 內容   說明
 1      0    0 mod 2=0   miss      0  -
 2      8    8 mod 2=0   miss      0  8         同一個 set，還有空位
 3      0    0           hit       0  8         0 還在；此時 8 是最久沒用的
 4      6    6 mod 2=0   miss      0  6         set 滿了，LRU 踢掉 8
 5      8    0           miss      8  6         LRU 踢掉 0（0 比 6 更久沒用）
```

1 個 hit、4 個 miss。

> **陷阱** 2-way 時 6 mod 2 = 0：在 direct-mapped 時 6 在別的格子，現在只剩 2 個 set，6 也擠進 set 0，和 0、8 搶位置。一個 set 雖然有兩格，但 cache 大小固定時 set 數變少，更多 block 會擠到同一個 set。

### Fully associative（1 個 set，4 格）

```
存取  block  hit/miss  cache 內容
 1      0     miss     0  -  -  -
 2      8     miss     0  8  -  -
 3      0     hit      0  8  -  -
 4      6     miss     0  8  6  -     （還有空位）
 5      8     hit      0  8  6  -
```

2 個 hit，只 miss 3 次。

| 組織 | miss 次數 | 每次比對的 comparator |
|---|---|---|
| direct-mapped | 5 | 1 |
| 2-way | 4 | 2 |
| fully associative | 3 | 4 |

> **重點** miss 次數 5 → 4 → 3：associativity 越高，miss 越少；但成本也越高，fully 每次要 4 個 comparator，2-way 要 2 個，direct-mapped 只要 1 個。

## Associativity 的效果越來越小

從 direct-mapped 到 2-way、4-way，comparator 變多，miss rate 會降，但降幅越來越小。課本的例子（64 KiB data cache、16-word block）：

| associativity | miss rate | 比上一級少 |
|---|---|---|
| 1-way | 10.3% | — |
| 2-way | 8.6% | 約 1.7%（大約 2%） |
| 4-way | 8.3% | 0.3% |
| 8-way | 8.1% | 0.2% |

效果越來越低，comparator 的數目卻一直增加，成本越來越高。

## 4-way set-associative cache 的實作

> **例題** 一個 4-way set-associative cache：每個 set 有 4 個 entry（4 個 way），共 256 個 set，data 欄位 32 bit。32-bit byte address 要怎麼切？

1. **block 大小**：block 是搬進搬出的單位。data 是 32 bit = 1 word = 4 byte，所以一個 block 就是一個 word。
2. **byte offset**：byte address 最後 2 個 bit（bit 0、1）用來選 word 裡的第幾個 byte，找 block 時不用；從 bit 2 開始才是 block address。offset = log₂ 4 = 2 bit。
3. **block 數與 set 數**：256 個 set × 每 set 4 個 block = 1024 個 block。反過來，從 cache 的 block 數看，要除以 4 才得到 set 數（1024 ÷ 4 = 256）。
4. **index**：256 個 set 要 log₂ 256 = 8 個 bit 才選得出第幾個 set。block address 除以 256 的餘數就是它最後 8 個 bit，直接拿來當 set index。
5. **tag**：index 那段已經隱含在位置裡，不用存。tag = 32 − 8 − 2 = 22 bit。

```
 31                              10 9         2 1     0
+----------------------------------+-----------+-------+
|            tag (22)              | index (8) | off(2)|
+----------------------------------+-----------+-------+
```

一個 set 有 4 個 block，4 個 tag 都要存著；算 cache 總大小時，這些 tag（和 valid bit）也要算進去。例如（延伸計算）：data 共 1024 × 32 bit = 4 KiB；每個 entry 另存 22-bit tag + 1-bit valid，共 1024 × 23 = 23,552 bit。

存取的流程：

1. 用 8-bit index 直接選到一個 set，這個 set 的四個 way 同時被讀出。
2. 4 個 way 都可能是要的那個，所以 4 個 tag 一起讀出來，用 **4 個 comparator** 同時和 address 的 tag 比對。
3. 比對一樣而且 valid 就輸出 1；4 個結果經過一個 **OR gate**，任何一個是 1 就是 hit。
4. hit 了，是哪一個 way？用比對結果去控制一個 **4-to-1 MUX**，從 4 筆 data 裡選出那一筆。

```
address → index(8) ─→ 選出 set：way0 way1 way2 way3
                        │     │     │     │
tag(22) ─────────────→ [=]   [=]   [=]   [=]   （各自 AND valid）
                        └──┬──┴──┬──┴──┬──┘
                           OR → Hit
                        比對結果 → 4-to-1 MUX → Data
```

## Replacement：該請誰出去

複習 placement：

- direct-mapped：每個 block 只 map 到一個位置，沒得選，直接擺進去，原來那格的被蓋掉。
- n-way：map 到 set 後有 n 個選擇（2-way 兩個、4-way 四個）。
- fully associative：cache 有幾個 block，就有幾個選擇。

有選擇，就要決定誰出去，這就是 **replacement**。萬一選錯，踢掉的那個等一下又要用，就會搬來搬去，又回到 direct-mapped 那種互踢的問題。所以希望被換掉的是待會兒不會再用到的。

- **Direct-mapped**：沒有選擇，不用煩惱。
- **Random**：set associative 和 fully associative 可用；不想多花 hardware 記錄，就隨便挑一個。
- **LRU（least recently used）**：換掉最久沒被用到的。因為 locality，很久沒用的多半不會再用。但真正的 LRU 要記錄每個 block 使用的先後，需要比較多 hardware，很麻煩。
- **Pseudo-LRU**：近似 LRU 就好。例如 2 個 entry 時：設一個 pointer，被指到的就是下次要被 replace 的；只要一用到某個 entry，就把 pointer 推到另一個。最近被用到的一定不會被指到，這樣就近似 LRU。

## Set associative 的代價：hit time 變長

| | direct-mapped | n-way set associative |
|---|---|---|
| comparator | 1 個 | n 個，同時比 |
| 選 data | 只有一筆，不用選 | 需要 n-to-1 MUX |
| data 何時能用 | 不必等，先拿去用 | 要等 tag 比完、hit 決定後才知道選哪一筆 |

- direct-mapped 只有一筆 data：可以不等，先假設它是 hit 拿去用；最後發現是 miss，把那筆 data 丟掉就好，反正 miss 本來就要做一大堆事。
- 4-way 就算 hit，也不知道是第幾個 way，要等比對結果控制 MUX 選出來，多了 MUX 的 delay。

> **陷阱** set associative 的 MUX 在 tag 比對之後，所以 hit time 比 direct-mapped 長。cache access 常常在 pipeline 的 critical path 上，這點延遲很要緊。

> **重點** direct-mapped、set associative、fully associative 各種結構，其實就是在 hit time、miss rate、miss penalty 三者之間取捨。

## Multilevel cache：L1 求快、L2 求少 miss

除了改善單一 cache，另一種加速方法是做成**多層快取（multilevel cache）**：第一層、第二層，甚至第三層 cache。每一層用的都是 cache 的技術，但**越靠近 processor 的越小、越快**。

- **L1（primary cache，主快取）**：最靠近 CPU。它小，所以快（small is fast），主要目的是**降低 hit time**。
- **L2**：做大一點，大就不容易 miss，主要目的是**降低 miss rate**。L2 比 L1 大、慢一點，但比 main memory 快很多。
- **L3**：更高階的處理器還會再加第三層。

存取流程：L1 miss 時**不直接去 main memory**（太花時間），而是先找 L2，由 L2 來供應資料；連 L2 都沒有，才去 main memory。Main memory 雖然最慢，但真正要去的比例已經很低，整體時間就降下來。

### 例題：加一層 L2，CPI 從 9 降到 3.4

> **例題** Base CPI（沒有 miss 時）= 1，clock rate 4 GHz；每個指令有 2% 的機率在 L1 miss；main memory 存取時間 100 ns。(1) 只有 L1 時 CPI 是多少？(2) 加一個 L2，存取時間 5 ns，L2 也 miss、最後必須去 main memory 的比例是每個指令 0.5%，CPI 變多少？

**(1) 只有一層 cache**

Miss 的代價要用 clock cycle 算，先把時間換成 cycle 數：

```
4 GHz → 每秒 4 × 10⁹ 個 cycle → 1 cycle = 0.25 ns
miss penalty（到 memory）= 100 ns ÷ 0.25 ns = 400 cycles

每個指令平均多出的 stall = 2% × 400 = 8 cycles
CPI = 1 + 8 = 9
```

沒有 miss 只要 1 個 cycle，有了 cache miss 變成 9 個 cycle。

**(2) 加一層 L2**

L1 miss 的那 2% 現在先去找 L2；L2 也 miss 的才去 main memory。

```
L1 miss、到 L2 的 penalty   = 5 ns ÷ 0.25 ns  = 20 cycles
L2 也 miss、到 memory 的 penalty = 100 ns ÷ 0.25 ns = 400 cycles

CPI = 1 + 2% × 20 + 0.5% × 400
    = 1 + 0.4     + 2
    = 3.4
```

只多一層 L2，CPI 就從 9 降到 3.4，速度約為 9 ÷ 3.4 ≈ 2.6 倍。

> **陷阱** 題目的 0.5% 已經是「以每個指令來算」最後要去 memory 的比例，也就是 **global miss rate**，所以直接乘 400，**不要再乘 2%**。（換算：若改問 L2 自己的 local miss rate，則是 0.5% ÷ 2% = 25%。）

### L1 和 L2 的設計重點

| | L1（primary cache） | L2 |
|---|---|---|
| 目標 | hit time 越小越好（minimal hit time） | miss 越少越好（low miss rate） |
| 容量 | 小（small is fast） | 大 |
| Hit time | 短 | 較長，但遠小於去 main memory |
| Block size | 較小 | 較大 |

- L2 慢一點沒關係，但容量要大，才能減少 miss，不要那麼常去 main memory。L2 雖然比 L1 多花一點時間，比起去 main memory 還是少很多，所以 L2 專心追求 low miss rate。
- 大部分的存取還是在 L1 完成。因此有了 L2 之後，**L1 通常做得比單層（single-level）設計時更小**，block size 也比 L2 小。

## 多層 cache 的 AMAT：同時找還是一層層找

多層 cache 的平均存取時間（AMAT）依「怎麼找」分成兩種情況：**simultaneous（同時）**與 **hierarchical（階層、一層一層）**。兩種情況都用同一個想法：**AMAT = ∑（在第 k 層找到的機率 × 在第 k 層找到所花的時間）**，差別只在「花的時間」怎麼算。

### 兩層：simultaneous

CPU **同時**對 L1、L2 發出存取，兩層一起找。

- 存取 L1 要 t1，存取 L2 要 t2；L1 的 hit ratio 為 h。
- L2 是最後一層，假設資料一定在那裡，hit ratio = 1。
- L1 hit：花 t1。L1 miss：L2 早就同時在找，只要等 t2。

```
AMAT(sim) = h × t1 + (1 − h) × t2
```

> **例題** h = 0.8、t1 = 2、t2 = 10：AMAT = 0.8 × 2 + 0.2 × 10 = 1.6 + 2 = 3.6。

### 兩層：hierarchical

**先在 L1 找**，花 t1；L1 找不到，**才去 L2 找**，再花 t2。L2 一定找得到。

```
L1 hit ：花 t1
L1 miss：|—— t1（找 L1 失敗）——|—— t2（找 L2）——|  → 共 t1 + t2

AMAT(hier) = h × t1 + (1 − h) × (t1 + t2)
           = [h × t1 + (1 − h) × t1] + (1 − h) × t2
           = t1 + (1 − h) × t2
```

化簡後的形式就是常見的「hit time + miss rate × miss penalty」：t1 每次都要付，miss 的才多付 t2。

> **例題** 同樣 h = 0.8、t1 = 2、t2 = 10。展開：0.8 × 2 + 0.2 × 12 = 1.6 + 2.4 = 4；化簡：2 + 0.2 × 10 = 4。兩式相同，且比 simultaneous 的 3.6 大。

> **陷阱** Hierarchical 時，miss 已經先花了 t1 才去找 L2，所以 **miss 的時間是 t1 + t2，不是 t2**。

### 三層：simultaneous

L1、L2、L3 的存取時間為 t1、t2、t3，L1、L2 的 hit ratio 為 h1、h2；最後一層 L3 一定有資料（hit ratio = 1）。

| 情況 | 機率 | 時間（同時找） |
|---|---|---|
| L1 hit | h1 | t1 |
| L1 miss、L2 hit | (1 − h1) × h2 | t2 |
| L1、L2 都 miss，L3 hit | (1 − h1)(1 − h2) × 1 | t3 |

```
AMAT(sim) = h1·t1 + (1 − h1)·h2·t2 + (1 − h1)(1 − h2)·t3
```

三層同時在找，所以每種情況**只算「找到的那一層」的時間**。

> **例題** h1 = 0.8、h2 = 0.5、t1 = 1、t2 = 5、t3 = 20。三種情況的機率分別是 0.8、0.2 × 0.5 = 0.1、0.2 × 0.5 = 0.1，加起來剛好是 1。AMAT = 0.8 × 1 + 0.1 × 5 + 0.1 × 20 = 0.8 + 0.5 + 2 = 3.3。

### 三層：hierarchical

一層一層找。機率跟上面完全一樣，只差時間：

| 情況 | 機率 | 時間（一層層找） |
|---|---|---|
| 在 L1 找到 | h1 | t1 |
| 到 L2 才找到 | (1 − h1) × h2 | t1 + t2 |
| 到 L3 才找到 | (1 − h1)(1 − h2) | t1 + t2 + t3 |

```
AMAT(hier) = h1·t1 + (1 − h1)·h2·(t1 + t2) + (1 − h1)(1 − h2)·(t1 + t2 + t3)
           = t1 + (1 − h1)·t2 + (1 − h1)(1 − h2)·t3
```

化簡的意思：**t1 每次都付；L1 miss 的才多付 t2；L1、L2 都 miss 的才再付 t3**。

化簡過程：t1 的係數是 h1 + (1 − h1)h2 + (1 − h1)(1 − h2) = 1；t2 的係數是 (1 − h1)h2 + (1 − h1)(1 − h2) = (1 − h1)；t3 的係數是 (1 − h1)(1 − h2)。

> **例題** 同樣 h1 = 0.8、h2 = 0.5、t = 1、5、20。展開：0.8 × 1 + 0.1 × 6 + 0.1 × 26 = 0.8 + 0.6 + 2.6 = 4；化簡：1 + 0.2 × 5 + 0.1 × 20 = 1 + 1 + 2 = 4。

## Cache 對軟硬體設計的影響

### Cache miss 與 out-of-order 執行

回想指令層級平行（instruction-level parallelism, ILP）的兩種做法：**superscalar** 和 **VLIW**。VLIW 靠 compiler 找出沒有 dependency 的指令，排在一起同時做。

> **觀念** 問：既然 compiler 就能排，為什麼還需要硬體很多的 superscalar？
> 答：因為 cache。Compile 的時候根本不知道哪個 load 會 cache miss，也就無法事先（靜態）排好順序。Cache miss 只有 run time 才知道，哪些指令是 independent 的也只有那時才知道，所以要靠 **out-of-order** 的 CPU 在 run time 動態排程：資料還沒來的指令放在 **reservation station** 裡等，資料已經 ready 的指令先進 function unit 做運算。

要分析一個程式的 cache 行為更麻煩，通常用 **simulator** 模擬 cache 的結構，看會發生多少 cache miss。

### Radix sort 對 quicksort：指令少不一定快

Cache 也會影響軟體（演算法）的實際表現。比較兩種排序：

- 從 complexity 看：radix sort 是 O(n)，quicksort 是 O(n log n)，元素多時 radix sort 理論上比較快。

把兩者實際跑起來，X 軸是要排序的元素個數，看三張圖的趨勢：

| 圖 | 量的是什麼 | 結果 |
|---|---|---|
| 第一張 | 每個 item 要幾個 instruction | radix sort 較少，看起來較快 |
| 第二張 | 真正執行時每個 item 要幾個 clock cycle | 反而 **quicksort 較快** |
| 第三張 | 每個 item 的 cache miss 數 | radix sort 高很多 |

原因在 locality：

- **Radix sort** 把元素丟進各個 bucket，範圍一大，存取就散在 array 的各個地方（東一個、西一個），沒有 locality，cache miss 很多。
- **Quicksort** 一直在比對相鄰的元素，存取連在一起，cache miss 比較少。

> **重點** 設計演算法不能只看 big O 或指令數，還要考慮 **data access pattern** 和 cache。

## Virtual memory：把 main memory 當 disk 的 cache

Cache 的部分重點就是**放、找、換、寫**這四個問題。接下來看下一層：**虛擬記憶體（virtual memory）**。作業系統課還會再細講，計算機組織著重它需要哪些**硬體支援**。

### 為什麼要 virtual memory

- 前面的 cache 與 main memory 之間由 **cache controller** 這個硬體管理，cache miss 時讓 processor stall 等資料。Main memory 與 disk 之間則是再下一個 level。
- 如果程式用的 address 就是 physical address，一個 memory 一次只能跑一個程式。實際上我們希望**同一個 physical memory 能同時跑好多個程式**。
  - 為什麼要同時跑很多程式？一個程式跑到一半要去做 I/O，I/O 很慢，processor 不能白等，就讓別的程式用。
- 做法：每個程式有自己的 address space，經過 **translation（轉換）** 對應到真正的 physical address。
- 而且不用整個程式都搬進來：程式有 locality，90% 的時間只用 10%。只搬一部分進 memory，其他放在 disk，要用再搬。

這仍是 upper level／lower level 的概念，只是現在 **upper level 是 main memory，lower level 是 disk**：

| | Cache ↔ main memory | Main memory ↔ disk（virtual memory） |
|---|---|---|
| 速度差距 | 幾十到幾百個 cycle | 幾百萬個 cycle（disk 已經是 I/O） |
| 誰來管 | 硬體（cache controller），miss 時 stall | OS（system software） |
| 搬動單位 | block | page（很大） |
| Placement | direct-mapped／set associative／fully associative | fully associative |

- 差距達百萬 cycle，這一層不需要硬體搶時間，交給 **OS** 處理。
- 從 disk 搬一次要花很大力氣，所以搬動單位 **page** 做得很大。
- 一次搬一大塊，就別讓它搶位置：任何位置都能放，也就是 **fully associative**。
- Software 可以做比較複雜的 policy：比起 page fault 搬一個 page 的龐大時間，多花一點時間決定也划算；cache miss 就不行，必須用硬體快速處理。

> **重點** Virtual memory 就是：把 main memory 當作 cache，把 disk 當作下層的 storage。

### 每個程式有自己的 virtual address space

- Physical memory 只有一個（例如 2³² 個 byte），但**每個程式都有自己的 private virtual address space**，彼此不 share。
- 所有程式的東西都可以放在 disk，要用時只把需要的那幾塊搬到 memory（例如兩個程式各搬兩頁進來）。
- 搬上來可以放在 physical memory 的**任何空位**，只要有一個 translation 告訴我們它放在哪就好。
- 下層的位址叫 **virtual address（虛擬位址）**，上層叫 **physical address（實體位址）**，中間靠 translation 轉換。
- 與 cache 比較：cache 用 index（direct-mapped、set associative）加 tag 比對來找位置；virtual memory 是 fully associative，**查一張 table** 就知道在哪。

其他好處：

1. **Protection（保護）**：每個程式有自己的 virtual address，程式之間可以互相保護，沒有權限就碰不到別人的資料。
2. **Virtual address space 可以比 physical memory 還大**，因為每次只搬一小部分上來。

### Page、page fault、frame

- 從下層搬到上層一樣是一塊一塊，這一塊叫 **page（頁）**。一個程式可能有一千個 page，memory 裡也許只放五個，用到才放上去。
- 所以一樣有四個問題：placement、怎麼找、replacement、write。
- 要用的 page 不在 main memory，叫 **page fault（分頁錯誤）**，相當於 cache miss。
- Physical memory 也切成跟 page 一樣大的一塊塊，每一塊叫 **frame（頁框）**。一個 page map 到一個 frame，大小一樣，一起搬進、一起搬出（例如 page 5 放進 frame 2）。

要回答的設計問題：page size 多大？怎麼放（也就決定了怎麼找）？怎麼 replacement？什麼時候搬？

- **什麼時候搬**：cache 常常 **prefetch**（還沒用就先搬）；page 太大，沒用到就搬進來太浪費 bandwidth，所以**只在 page fault 時才搬**，叫 **demand load**。

### Page size 與 page table

- **Page size**：page fault 的代價非常大，要幾百萬個 cycle，因為是從 disk 這個 I/O 搬到 memory。OS 忙了半天只搬一點點，划不來，所以 page 都很大，例如 **4K byte**。
- **Placement**：減少 page fault 很重要，不能像 direct-mapped 那樣，明明別處有空位卻不給用。所以 virtual memory 用 **fully associative**：memory 只要有位置，就把 page 放進去。
- **怎麼找**：fully associative 沒有 index，又不能一個一個找，所以建一張表，叫 **page table（分頁表）**。

Page table 很單純：**你是第幾個 page，就記你 map 到第幾個 frame**。它像一個 array，用 **page number 當 index**：16 個 page 就有 16 個 entry，要查第 i 個 page 就看第 i 個 entry；**V（valid）= 1 表示在 memory**。

Virtual address space 切成一個個 page，physical memory 切成一樣大的 frame；virtual 雖然連續，放到 physical 可以隨便擺。

> **例題** 一個有 8 個 page 的程式，每次存取先查 page table。

```
page table（以 page number 為 index）
 page | V | frame
------+---+------
  0   | … |  …
  1   | … |  …
  2   | … |  …
  3   | 1 |  1     ← 存取 page 3：V = 1，在 memory 的 frame 1
  4   | 0 |  -     ← 存取 page 4：V = 0，資料在 disk → page fault
  5   | … |  …
  6   | … |  …
  7   | … |  …
```

一產生 page fault，要做一大堆處理，這是 **OS** 在做，不是硬體。

### Address translation：換 page number，offset 照搬

Page table 怎麼做 translation？跟 cache 一樣，先找出 block 的編號，在這裡是 **page number**；page 裡面的位址綁在一起，不用管。

- Page size 4K = 2¹² byte，所以位址**最低 12 個 bit 是 page offset**（page 裡第幾個 byte）。
- 32-bit 的 virtual address 去掉 12 bit offset，**前 20 個 bit 是 virtual page number**（第幾個 page）。
- 拿 virtual page number 查 page table，得到 **physical frame number**；physical memory 有多少個 frame，就用幾個 bit 表示，例如 18 bit。
- 一個 page 是整塊搬到一個 frame，裡面的位址分佈一模一樣：在 page 裡是第三個 element，到 frame 裡也是第三個。所以 **page offset 直接照搬**。
- **Physical address = physical frame number 接上同樣的 page offset**。

```
virtual address（32 bits）
 | virtual page number (20 bits) | page offset (12 bits) |
                │                            │
          查 page table                  原封不動
                ▼                            ▼
 | physical frame number (18 bits) | page offset (12 bits) |
physical address（18 + 12 = 30 bits）
```

> **例題** Page size 4K（offset 12 bits = 3 個十六進位數字）。Virtual address 0x3ABC，假設 page table 記錄 page 3 在 frame 7，求 physical address。

```
0x3ABC → 最後 3 個 hex 數字是 offset
         page number = 0x3，offset = 0xABC
查 page table：page 3 → frame 7
physical address = frame 7 接上 offset 0xABC = 0x7ABC
```

> **陷阱** Translation **只換 page number**；page offset 不變，因為 page 和 frame 一樣大。

## 一個階層、四個問題

不同的 memory 技術，容量、速度、價錢都不一樣；但程式有 locality，90% 的時間大多只用 10% 的程式。因此把 memory 做成一層一層的 **hierarchy**：近的快、小、貴，遠的大、慢、便宜，processor 看到的是一個**又快又大**的 memory。

第一層：在 processor 和 main memory 之間加一層用 **SRAM** 做的 cache（快、容量小、比較貴）。靠近 processor 的 cache 是 upper level，main memory 是 lower level。Cache 小，只有少部分東西能放上去，於是產生四個問題；main memory 與 disk 之間（virtual memory）也是同樣的關係。

1. **Placement（放哪裡）**：direct-mapped、set associative、fully associative，差別在「一個號碼有幾張椅子」。
2. **Finding the block（怎麼找）**：怎麼放決定了怎麼找。Cache 用 index 找位置、tag 比對、valid bit 確認；virtual memory 則查 page table。
3. **Replacement（換誰出去）**：不能全部都擺在上面，位置有競爭時就要有人回到 lower level。Direct-mapped 沒得選，其他用 random 或 LRU。
4. **Write（怎麼寫）**：寫了一個 block 會造成 upper level 和 lower level 不一致。做法是 write-through 加 write buffer，或 write-back 加 dirty bit。

### 回顧 placement：從 direct-mapped 到 set associative

要改善 cache 效能，可從三個變數下手：降低 hit time、降低 miss rate、降低 miss penalty。

- **Direct-mapped**：每個 block 有固定位置。Upper level 有 8 個 block（0～7），lower level 的位址除以 8，餘數就是位置，所以 block 0 和 block 8 都到第 0 格。
  - 缺點：若程式交替存取 0、8、0、8……，兩者只能放同一格，每次都把對方踢出去，**一直 miss**，而其他格子可能全是空的。
- **Fully associative**：沒有固定位置，有空就進去。代價是可能擺在任何一格，所以每一格都要存 address，存取時每一格都要比對；一個一個比太慢，8 格就要 **8 個 comparator** 同時比，硬體很多。
- 一個極端只有一個位置、另一個極端全部位置都可以，取中間就是 **set associative**。

把這四個問題搞清楚，cache 和 virtual memory 這整套系統就懂了。

## 重點整理
- Memory hierarchy 目標：存取時間像 SRAM，容量與成本像 disk；單一 technology 做不到
- SRAM：cross-coupled（latch），多個 transistor／bit，快、耗電、貴、low density，用在 cache；DRAM：1 transistor + 1 capacitor，要 refresh（每幾 ms），dense、便宜、low power、慢（要 sense amplifier），用在 main memory
- Static／dynamic 的差別 = 要不要 refresh
- DRAM 是 2-D matrix：row address 把整列讀進 buffer，column address 選出那一格
- 2008：SRAM 0.5–2.5 ns、$2000–5000/GB；DRAM 50–70 ns、$20–75/GB；disk 5–20 ms、$0.2–2/GB；DRAM 約慢 100 倍，disk 百萬倍等級
- Processor–DRAM gap 越來越大 → cache 越重要；small is fast，cache 不能無限做大
- 越靠近 processor：越快、越小、越貴；越遠：越大、越慢、越便宜
- 搬動單位固定：cache ↔ memory 叫 block，virtual memory 叫 page；整塊一起搬；memory 在 cache 對是 lower level，在 VM 對是 upper level
- Principle of locality：90/10 rule（90% 時間跑 10% code）；temporal（loop）、spatial（array、sequential instruction PC+4）；linked list 的 spatial locality 差
- 管理者：register↔memory compiler；cache↔memory cache controller（hardware）；memory↔disk OS（+少量 hardware）；file user
- Miss rate = 1 − hit rate；hit time = 存取 upper level + 判斷 hit/miss 的時間；miss penalty = 換掉 block + 從 lower level 取來（latency + transfer）+ 送到 processor；hit time ≪ miss penalty
- 四個問題：block placement、block identification、block replacement、write strategy
- Direct-mapped：位置 = (block address) mod (cache block 數)；block 數為 2ᵏ 時取最低 k bits 當 index
- Tag = 去掉 index（與 offset）後的高位 bits；每格存 valid bit + tag + data；valid 初始為 0
- Hit 條件：valid = 1 且 tag 相同
- 例 22,26,22,26,16,3,16,18（8-block DM）：3 hits、5 misses，18 把 26 換掉
- Direct-mapped replacement 直接覆蓋；dirty block 要先寫回
- 位址切割：offset = log₂(block 的 byte 數)，index = log₂(block 數)，tag = 32 − index − offset；先扣 offset，再扣 index，剩下才是 tag
- 1024 blocks × 4 bytes：offset 2、index 10、tag 20；每格 1 + 20 + 32 = 53 bits；block 改 8 bytes：offset 3、tag 19
- 64 blocks × 16 bytes：offset 4、index 6、tag 22；address 1200 → block 75 → 75 mod 64 = 11
- 先把 byte address 除以 block 大小換成 block address，才能 mod block（set）數
- 同一個 block 的 word：tag、index 相同，只差 block offset；流程 index → tag（+ valid）→ block offset 選 word → byte offset 選 byte
- Large block：利用 spatial locality 降 miss rate；代價是 block 數變少（競爭多）、miss penalty 大、可能白搬、pollution
- Miss rate 對 block size：小 cache 先降後升；大 cache 曲線平
- 改善大 block 的 penalty：early restart、critical word first
- Read miss → hardware stall（I-miss 重新 fetch，D-miss 完成存取）；page fault 才由 OS 處理
- Write-through：每次寫 memory，永遠一致；CPI 1、store 10%、寫 100 cycles → CPI 11
- Write buffer：FIFO（常見 4 entries），滿了才 stall；可 forward 給後面的 read
- Write-back：只寫 cache，replace 時 dirty = 1 才寫回；traffic 少但 memory 暫時是舊的
- Write miss：write-back 通常 write allocate；write-through 可 no-write allocate（write around）
- FastMATH：split I/D cache 各 256 blocks × 16 words = 16 KiB；tag 18 | index 8 | block offset 4 | byte offset 2；miss rate I 0.4%、D 11.4%、合計 3.2%
- Miss penalty（送位址 1、DRAM 15、傳一 word 1、block 4 words）：one-word-wide 65、wide 17、interleaved 20
- DRAM：row 讀進 latch 再選 column；burst mode；DDR SDRAM = synchronous + rising/falling edge 都傳
- CPU time = (execution cycles + memory-stall cycles) × cycle time；memory-stall cycles = accesses × miss rate × miss penalty
- 例：base CPI 2、I-miss 2%、D-miss 4%、penalty 100、load/store 36% → 2 + 2 + 1.44 = 5.44（I-cache 是 100% 的指令）
- AMAT = hit time + miss rate × miss penalty；hit time 每次都付（乘 100%），不是乘 hit rate
- 例：hit 1 cycle、penalty 20、miss rate 5% → AMAT = 1 + 0.05 × 20 = 2 cycles（不是 1.95）
- 標準式 AMAT = h × t + (1 − h) × m，其中 m 是 miss 的「總時間」；若 penalty 是「額外時間」用 t + (1 − h) × penalty
- base CPI 降低或 clock rate 提高時，memory stall 佔的比例變大（3.44/5.44 ≈ 63% → 3.44/4.44 ≈ 77%）
- 改善 cache 三方向：降 hit time、降 miss rate、降 miss penalty
- Direct-mapped 同一格的 block 輪流存取會互踢，全部 miss，其他格卻空著
- Fully associative：沒有 index，整個 block address 當 tag，每個 entry 一個 comparator
- Set associative：set = block number mod set 數；set 數 = block 數 ÷ n；index bits = log₂(set 數)
- n-way 需要 n 個 comparator；direct-mapped = 1-way，fully = n-way（n = block 數）
- address 長度固定時 index 每少 1 bit，tag 多 1 bit（5-bit block address、8 blocks：tag 2/3/4/5）
- 0,8,0,6,8 在 4-block cache：direct 5 miss、2-way（LRU）4 miss、fully 3 miss
- Associativity 效果遞減：10.3% → 8.6% → 8.3% → 8.1%（64 KiB、16-word block）
- 4-way、256 sets、1-word block、32-bit address：offset 2、index 8、tag 22；4 comparator + OR + 4-to-1 MUX
- Replacement：direct-mapped 不用選；random、LRU、pseudo-LRU（2 entry 用一個 pointer）
- Set associative 的 MUX 在 tag 比對之後 → hit time 比 direct-mapped 長；direct-mapped 可先假設 hit 使用 data
- Multilevel cache：L1 小而快，目標降低 hit time；L2 大，目標降低 miss rate；L1 miss 先找 L2，再 miss 才去 main memory
- 有 L2 時 L1 比單層設計更小，L1 block size 比 L2 小
- 兩層 CPI = base CPI + (L1 miss/指令) × L2 penalty + (global miss/指令) × memory penalty；例：1 + 2%×20 + 0.5%×400 = 3.4（單層 1 + 2%×400 = 9）
- Global miss rate 已經是每個指令的比例，直接乘 memory penalty，不要再乘 L1 miss rate
- 兩層 simultaneous：AMAT = h·t1 + (1 − h)·t2
- 兩層 hierarchical：AMAT = h·t1 + (1 − h)(t1 + t2) = t1 + (1 − h)·t2（miss 時間是 t1 + t2）
- 三層 simultaneous：AMAT = h1·t1 + (1 − h1)h2·t2 + (1 − h1)(1 − h2)·t3
- 三層 hierarchical：AMAT = t1 + (1 − h1)·t2 + (1 − h1)(1 − h2)·t3
- Compile 時不知道哪個 load 會 cache miss → 需要 out-of-order superscalar（reservation station）動態排程
- Radix sort O(n) 指令少，但缺乏 locality、cache miss 多，實際 cycles/item 比 quicksort 慢
- Virtual memory：main memory 當 disk 的 cache；由 OS 管（差百萬 cycle）；單位 page（大，如 4 KB）；fully associative；demand load
- Page fault = page 不在 main memory（對應 cache miss），由 OS 處理
- Page table 以 virtual page number 為 index，記 frame number 與 valid bit
- Address translation：VPN 查 page table 換成 PFN，page offset 照搬；4 KB page → 12-bit offset，32-bit VA → 20-bit VPN
- 四個問題：placement、finding the block、replacement、write

## 名詞對照
| 中文 | English |
|---|---|
| 記憶體階層 | memory hierarchy |
| 快取 | cache |
| 虛擬記憶體 | virtual memory |
| 第二層儲存 | secondary memory |
| 隨機存取 | random access |
| 靜態隨機存取記憶體 | SRAM (static RAM) |
| 動態隨機存取記憶體 | DRAM (dynamic RAM) |
| 主記憶體 | main memory |
| 磁碟 | magnetic disk |
| 讀寫頭 | read/write head |
| 交叉耦合 | cross-coupled |
| 電容 | capacitor |
| 電荷衰減 | decay |
| 刷新 | refresh |
| 感測放大器 | sense amplifier |
| 列位址／行位址 | row address / column address |
| 處理器與記憶體速度差距 | processor–memory gap |
| 上層／下層 | upper level / lower level |
| 區塊 | block |
| 頁 | page |
| 區域性原理 | principle of locality |
| 時間區域性 | temporal locality |
| 空間區域性 | spatial locality |
| 晶片內／晶片外 | on-chip / off-chip |
| 快取控制器 | cache controller |
| 命中／未命中 | hit / miss |
| 命中率／未命中率 | hit rate / miss rate |
| 命中時間 | hit time |
| 未命中代價 | miss penalty |
| 延遲 | latency |
| 放置 | block placement |
| 識別 | block identification |
| 替換 | block replacement |
| 寫入策略 | write strategy |
| 直接對映快取 | direct-mapped cache |
| 索引 | index |
| 標籤 | tag |
| 有效位元 | valid bit |
| 被寫過的 | dirty |
| 位元組偏移 | byte offset |
| 區塊偏移 | block offset |
| 位元組位址 | byte address |
| 區塊位址 | block address |
| 區塊大小 | block size |
| 失誤率 | miss rate |
| 失誤代價 | miss penalty |
| 汙染 | pollution |
| 提早重啟 | early restart |
| 關鍵字優先 | critical word first |
| 停頓 | stall |
| 一致性 | consistency |
| 寫穿 | write-through |
| 寫回 | write-back |
| 髒位元 | dirty bit |
| 寫入緩衝區 | write buffer |
| 轉送 | forwarding |
| 寫入配置 | write allocate |
| 不配置寫入（繞寫） | no-write allocate (write around) |
| 分離式快取 | split cache |
| 指令快取 | instruction cache (I-cache) |
| 資料快取 | data cache (D-cache) |
| 嵌入式處理器 | embedded processor |
| 多工器 | multiplexer (MUX) |
| 匯流排 | bus |
| 交錯式記憶體 | interleaved memory |
| 記憶體庫 | bank |
| 存取時間 | access time |
| 週期時間 | cycle time |
| 頻寬 | bandwidth |
| 突發模式 | burst mode |
| 雙倍資料率同步 DRAM | DDR SDRAM (Double Data Rate Synchronous DRAM) |
| 非同步 / 同步 | asynchronous / synchronous |
| 上升緣 / 下降緣 | rising edge / falling edge |
| 記憶體停頓週期 | memory-stall cycles |
| 基本 CPI | base CPI |
| 平均記憶體存取時間 | average memory access time (AMAT) |
| 命中率 | hit ratio |
| 直接映射 | direct-mapped |
| 全關聯 | fully associative |
| 集合關聯 | set associative |
| 集合 | set |
| 路 | way |
| 關聯度 | associativity |
| 比較器 | comparator |
| 最近最少使用 | least recently used (LRU) |
| 近似 LRU | pseudo-LRU |
| 隨機替換 | random replacement |
| 關鍵路徑 | critical path |
| 多層快取 | multilevel cache |
| 主快取 | primary cache (L1) |
| 全域失誤率 | global miss rate |
| 區域失誤率 | local miss rate |
| 同時存取 | simultaneous access |
| 階層存取 | hierarchical access |
| 指令層級平行 | instruction-level parallelism (ILP) |
| 超純量 | superscalar |
| 超長指令字 | VLIW (very long instruction word) |
| 亂序執行 | out-of-order execution |
| 保留站 | reservation station |
| 基數排序 | radix sort |
| 快速排序 | quicksort |
| 資料存取模式 | data access pattern |
| 虛擬位址 | virtual address |
| 實體位址 | physical address |
| 位址轉換 | address translation |
| 頁框 | frame |
| 分頁錯誤 | page fault |
| 分頁表 | page table |
| 虛擬頁號 | virtual page number (VPN) |
| 實體頁框號 | physical frame number |
| 頁內位移 | page offset |
| 需求載入 | demand load |
| 預取 | prefetch |
| 保護 | protection |
| 直接對映 | direct-mapped |
| 置換 | replacement |
