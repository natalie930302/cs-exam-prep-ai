# 記憶體系統

這章從記憶體的硬體講起：一條 DIMM 裡的 rank、chip、bank，DRAM 怎麼用 RAS／CAS 讀資料，burst mode 和 bank interleaving 怎麼讓 data bus 不停下來，memory interleaving 怎麼降低存取延遲。接著是 virtual memory：page、frame、page table、page fault，page table 太大和太慢兩個問題分別怎麼解（limit register、inverted page table、multi-level page table、TLB），以及 TLB、page table、cache 合起來怎麼運作。最後整理 memory hierarchy 的共同架構、3C miss、cache controller 的 FSM，以及多核心的 cache coherence。interleaving 的 cycle 計算、位址切割與 TLB／cache 組合題都是考試重點。

## 學完這章要會
- 說出 DIMM、channel、rank、chip、bank、row、column 的層級關係，算記憶體頻寬
- 說明 DRAM 讀取的 RAS／CAS 步驟、burst mode 與 bank interleaving
- 算 interleaving 與非 interleaving 的存取 cycle，比較 low-order 與 high-order interleaving
- 說明 virtual memory 為什麼用 fully associative、write back、由 OS 管理
- 把 virtual address 切成 virtual page number 與 page offset，查 page table 做 address translation
- 說明 page fault 的處理流程、reference bit 近似 LRU、dirty bit
- 算 page table 的大小，說明 limit register、inverted page table、two-level page table
- 說明 TLB 的運作、兩種 TLB miss，以及 TLB、page table、cache 哪些組合可能發生
- 說明 virtually indexed, physically tagged cache 的條件
- 用 3C 分類 cache miss，判斷改設計是否一定變快
- 說出 cache controller FSM 的四個 state，以及 snooping／directory 的 cache coherence 做法

## 一條記憶體裡面有什麼：DIMM 的層級

一條記憶體（俗稱「一條 RAM」）英文叫 **DIMM（dual inline memory module，雙列直插記憶體模組）**：電路板上焊著好幾顆 DRAM 晶片，插在主機板的插槽（slot）上。一般桌機主機板有 4 個 DIMM 插槽，所以最多一次裝 4 條。

從外到內的層級：

```
DIMM（一條記憶體）
 └─ rank（一起回應同一個讀寫請求的一組晶片，典型是一面的 8 顆）
     └─ chip（一顆 DRAM 晶片）
         └─ bank（晶片裡的獨立小倉庫，常見 8 個）
             └─ array（一張格子）
                 └─ row × column → 交叉點是 cell，存 1 個 bit
```

- **rank**：典型 DIMM 正面的 8 顆晶片合起來是 1 個 rank（rank 0）。有些 DIMM 不只一個 rank，例如雙 rank（dual-rank）的記憶體條，第二個 rank 通常放在背面，翻過來那 8 顆就是 rank 1。
- **bank**：每顆晶片切成好幾個 bank，可以把 bank 想成晶片裡獨立運作的小倉庫。
- **array**：每個 bank 由好幾個 array 組成。array 是排成格子的 cell：橫的一排叫 **row（列）**，直的一行叫 **column（行）**，交叉點就是一個 **cell**，存 1 個 bit。

> **陷阱** rank 不是「一面」本身，而是「一起回應同一個讀寫請求的一組晶片」，只是通常剛好是一面的 8 顆。

> **重點** 設計記憶體永遠在 **容量、速度、耗電（能源效率）、成本** 之間取捨。後面每一個設計決定（幾顆晶片、幾個 bank、幾條通道）都是這個取捨。

## Memory channel：位址、命令、資料三組線

DIMM 插在插槽上，插槽經過一組叫 **memory channel（記憶體通道）** 的線路，接到 **memory controller（記憶體控制器）**，也就是負責指揮記憶體讀寫的電路。在現代 PC 裡，memory controller 不是獨立晶片，而是和 CPU 做在同一顆晶片上。

```
 ┌──────────────────────┐   memory channel   ┌────────┐
 │ CPU                  │ ── address bus ──→ │        │
 │  └ memory controller │ ── command bus ──→ │  DIMM  │
 │                      │ ←─ data bus ────→  │        │
 └──────────────────────┘                    └────────┘
```

memory channel 其實是三組線：

| 線路 | 傳什麼 | 典型條數 |
|---|---|---|
| address bus | 「要哪裡」：記憶體位址 | 17 |
| command / control bus | 「要做什麼」：開 row、讀、寫等命令與控制訊號 | 6 |
| data bus | 資料本身 | 64 |
| 合計 | | 17 + 6 + 64 = 87 |

### 17 條位址線，能定址的不只 2¹⁷

位址分兩次送：先送 **row address**，再用同一組線送 **column address**，這叫 **位址多工（address multiplexing）**。所以總位址長度可以遠超過 17 bits，例如 row 17 bits + column 10 bits = 27 bits（示意數字）。

> **陷阱** 位址線只有 17 條，但 row、column 分兩次送，能定址的範圍遠大於 2¹⁷。

### ECC 與 data bus 寬度

- 記憶體若支援 **ECC（error-correcting code，錯誤更正碼）**，會多 8 條檢查用的線，data bus 變成 64 + 8 = **72 bits**。
- 早期 PC 的 data bus 只有 32 條，模組和主機板之間也只有 32-bit 的連接；那種模組叫 **SIMM（single inline memory module，單列直插記憶體模組）**。當時一次搬 32 bits = 4 bytes，這個單位叫一個 **word（字組）**。
- 現代 PC 的 data bus 是 64 bits，是 SIMM 的兩倍；word 也變成 64 bits = 8 bytes。

> **陷阱** DIMM 的 dual 常被解釋成「寬度是 SIMM 的兩倍」或「有正面和背面」。比較精確的意思是：**DIMM 兩面的金手指是各自獨立的訊號，SIMM 兩面的接點是相通的。**

## 頻寬：2,133 MT/s，一個 word 不到半奈秒

memory channel 的有效頻率典型是 2,133 MHz，意思是每秒傳 2,133 百萬次資料，常寫成 **2,133 MT/s（mega transfers per second）**。

> **例題** 每次傳一個 64-bit word，求頻寬與每個 word 的時間。

```
每秒傳的 word 數 = 2,133 × 10⁶ = 21.33 億個 64-bit word
每個 word = 64 bits = 8 bytes
頻寬 = 2,133 × 10⁶ × 8 B = 17,064 × 10⁶ B/s = 17.064 GB/s

每個 word 的時間 = 1 ÷ 2,133,000,000 秒 ≈ 0.469 × 10⁻⁹ 秒 ≈ 0.469 ns（不到半奈秒）
```

問題是：存取一個 cell 其實很慢，DIMM 怎麼跟得上這麼快的 bus？答案是後面三招：**DDR、burst、bank interleaving**。

## 單通道、雙通道、四通道與 rank

| 模式 | 接法 | 理論頻寬（以 17.064 GB/s 為一條通道） |
|---|---|---|
| single-channel | 兩條 DIMM 共用同一條 memory channel，一次只有一條通道在傳 | 17.064 GB/s |
| dual-channel | 兩條 DIMM 各有自己的通道，memory controller 能同時對兩條讀寫 | × 2 = 34.128 GB/s |
| quad-channel | 4 條 DIMM 各有自己的通道 | × 4 = 68.256 GB/s |

- 說「理論」頻寬，是因為實際程式不一定能一直同時用到每一條通道。
- 能不能多通道，要看主機板怎麼佈線、CPU 的記憶體控制器支不支援。大多數 PC 有雙通道；四通道常見於工作站或高階電競機。
- **一條通道能掛幾條 DIMM 有電氣限制**：同一條線分岔接到好幾條 DIMM，訊號會被分弱，就傳不了那麼快，所以一條通道通常最多掛 2 條。
- **多 rank 的 DIMM**：兩個（或四個）rank 插在同一個插槽上，一定共用同一條通道。所以多 rank 容量大、比較耗電，但速度幾乎沒有提升。

> **陷阱** dual-channel 的「兩倍」是理論頻寬。雙 rank ≠ 雙通道：兩個 rank 共用同一條通道。

## DDR 與晶片寬度：x8、x16

### DDR：一個 clock 傳兩次

存取單一個 cell 是很慢的過程，光讀或寫 1 個 bit 就要好幾個 clock cycle（時脈週期）。可是 data bus 每個 clock 可以傳兩次：時脈從低變高的 **上升緣（rising edge）** 傳一次，從高變低的 **下降緣（falling edge）** 再傳一次。這就是 **DDR（Double Data Rate，雙倍資料速率）**。

```
clock    ┌──┐  ┌──┐  ┌──┐
       ──┘  └──┘  └──┘  └──
傳輸      ↑  ↓  ↑  ↓  ↑  ↓     每個 clock 2 次（2 個 64-bit word）
```

所以 2,133 MT/s 的實際時脈只有一半：2,133 ÷ 2 = **1,066.5 MHz**。

> **重點** 記憶體模組的設計目標：讓 data bus 一直有資料在跑，不要閒著。

### 8 顆晶片各管 8 條線

一般 DIMM 上每顆晶片只接 data bus 的 8 條線，叫 **x8 晶片**。一個 64-bit word 拆成 8 份，每份 8 bits，8 顆晶片同時各管一份：

```
64-bit word = [chip0: 8 bits][chip1: 8 bits] … [chip7: 8 bits]
               8 顆 × 8 bits = 64 bits
```

8 顆最常見，但也有晶片多一點或少一點的 DIMM：

| 晶片多 | 晶片少 |
|---|---|
| 每顆容量固定時總容量大，例如每顆 8 Gbit × 8 顆 = 64 Gbit = 8 GB（示意數字） | 省電 |
| 每個讀寫請求都要這些晶片一起動 → 越耗電 | 每顆要管更多條線，例如 **x16 晶片** 只要 4 顆，每顆管 16 條 → 每顆要更多資料接腳，而 **pin 很貴** |

### bank 一起動作

- 每顆晶片裡通常有 8 個 bank。
- 各晶片中 **位置相同的 bank**（例如都是 bank 0）共用同一組位址與控制訊號，會一起動作。所以寫一個 64-bit word，就是 8 bits 同時寫進每顆晶片的 bank 0。

> **陷阱** 「每個 bank 存 8 bits」是不精確的說法：bank 能存的遠多於 8 bits，正確意思是 x8 晶片每次存取進出 8 bits。

> **陷阱** 一次讀寫 64 bits 只是比較「寬」，每次存取要等的時間跟讀 1 bit 一樣，並沒有比較快。

## Bank 內部：RAS 開 row，CAS 選 column

示意模型：一個 bank 有 8 個 array 疊在一起，每個是 8 row × 8 column = 64 個 cell，8 個加起來 512 個 cell。

真實的 array 是長方形，例如 1024 columns × 16384 rows：

```
一個 array 的 cell 數 = 1024 × 16384 = 16,777,216
選 16384 個 row 需要 log₂ 16384 = 14 bits
選 1024 個 column 需要 log₂ 1024 = 10 bits
```

### 讀一個 word 的步驟（示意：row 5、column 3）

1. 送 row address，並發出 **RAS（row address strobe，列位址選通）** 訊號，啟動讀取週期，選 row 5。
2. 送 column address，並發出 **CAS（column address strobe，行位址選通）** 訊號，選 column 3。row + column 指定每個 array 裡的一個 cell；8 個 array 共用位址，所以 8 個 cell 都在 (5, 3)。
3. 被選中的整個 row 5 被啟動，整排資料複製進下方的 **sense amplifiers（感測放大器）**，也叫 **row buffer**，並鎖住。**開 row 是讀取週期裡比較慢的部分。** 完成後說 row 5 是 **open（開著）** 的。
4. 每個 array 從 row buffer 挑出 column 3 的 bit，一起送進 **output buffer**，共 8 bits。
5. DIMM 上 8 顆晶片裡位置相同的 bank 同時做一模一樣的事：8 bits × 8 顆 = 一個 64-bit word。

```
          column: 0 1 2 3 4 5 6 7
row 0             . . . . . . . .
 …
row 5  ←RAS       ■ ■ ■ ■ ■ ■ ■ ■   整排複製到 row buffer（慢）
 …
row buffer        ■ ■ ■ ■ ■ ■ ■ ■
                        ↑CAS 選 column 3 → output buffer
```

### 只讀一個 column 很浪費

一個 bank 一次只能開一個 row。早期 DRAM 讀完就把 row 關掉，下次要用再重開。可是開一整排 1024 個 column（甚至兩倍）卻只用 1 個，只用了 1/1024 ≈ 0.098%，大約千分之一，非常浪費時間。

> **陷阱** RAS 先、CAS 後：先開 row（慢），再選 column（快）。row 開著時讀同一 row 的其他 column，不必重送 row address。

## Burst mode 與 prefetching

聰明的做法：row 5 還開著，就直接讀下一個 column 4，不用重開 row；再讀 column 5、column 6，資料就從 row buffer 一個接一個流出來。

只要給 **一個 row address 和一個起始 column address**，就能讀出一整串資料，這叫 **burst（突發傳輸）**。row 開著時連續讀的 column 數叫 **burst length（BL）**。示意：讀了 column 3、4、5、6，burst length = 4。

| 世代 | burst length |
|---|---|
| DDR2 | 4 |
| DDR3 | 8 |
| DDR4 | 8（可截成 BC4） |
| DDR5 | 16 |

> **陷阱** 常見的錯誤說法是「DDR4 的 burst length 是 16」。DDR4 標準還是 BL8，DDR5 才是 BL16。

上面只畫一個 bank。實際 DDR3 模組 8 顆晶片裡的 bank 同時動，一次 burst 連續送出 8 個 64-bit word：8 × 8 bytes = **64 bytes**。這種「一次從 array 抓好幾份資料，再一份一份快速送出」的技術叫 **prefetching（預取）**。

## Bank interleaving：讓 data bus 不停下來

### 單一 bank 的問題：關 row 很久

- 每個 bank 同一時間只能開一個 row；burst 結束後必須先把這個 row 關掉，才能開別的 row。
- 關 row 要做兩件事：DRAM 讀取會破壞電荷，所以先把剛讀過的 cell **寫回去刷新**；再把 bit line 重新 **precharge（預充電）** 到準備好的電壓。這可能要花到 **18 個 clock cycle**。
- CPU 和 DRAM 之間不是一個 byte 一個 byte 搬，而是以 **cache line（快取區塊）** 為單位。一條 cache line 通常 64 bytes = 8 個 64-bit word。
- BL8 的一次 burst：8 次 × 8 bytes = 64 bytes，剛好填滿一條 cache line；DDR 一個 clock 傳兩次，所以只要 8 ÷ 2 = **4 個 clock**。

> **例題（示意）** 只靠 bank 0 連讀好幾條 cache line，bus 有多忙？（開 row 10 個 clock 是示意數字；關 row 18 個 clock、burst 4 個 clock。）

```
bank 0 一輪 = 送 burst 4 + 關 row 18 + 開 row 10 = 32 個 clock
bus 忙碌率 = 4 / 32 = 12.5%
```

### 讓 bank 輪流上場

為了提高吞吐量，同一顆晶片裡每個 bank 都設計成 **可以獨立運作**，不同 bank 可以處在讀寫週期的不同階段：有的在開 row、有的在送資料、有的在關 row。這種輪流使用 bank 的做法叫 **bank interleaving（bank 交錯）**。

bank 0 一送完 burst，bank 1 的 burst 馬上接上（它早就提前開好 row 了）；接著 bank 2、bank 3……一路輪下去，data bus 上一格接一格，沒有空隙。

```
clock:  0    4    8    12   16   20   24   28   32
bus:    [b0 ][b1 ][b2 ][b3 ][b4 ][b5 ][b6 ][b7 ][b0 ] …  沒有空隙
```

各 bank 的時間表（示意，clock 編號從 0 起；每個 bank 在輪到自己之前就先開好 row）：

| bank | 送 burst | 關 row（18） | 再開 row（10） | 下一次送 burst |
|---|---|---|---|---|
| 0 | 0–3 | 4–21 | 22–31 | 32–35 |
| 1 | 4–7 | 8–25 | 26–35 | 36–39 |
| 2 | 8–11 | 12–29 | 30–39 | 40–43 |
| k | 4k ～ 4k+3 | 4k+4 ～ 4k+21 | 4k+22 ～ 4k+31 | 4k+32 ～ 4k+35 |

在 bank 3 送資料（clock 12–15）的那一刻，其他 bank 有的在開 row、有的在關 row，都在為下一次準備。等 bank 7 送完，bank 0 正好恢復：

```
bank 0 恢復需要：4 + 18 + 10 = 32 clock
8 個 bank 輪一圈：8 × 4 = 32 clock   → 正好接上，bus 忙碌率 100%
```

> **重點** bank interleaving 讓 data bus 在長時間連續讀寫時保持滿載。條件是：**bank 輪一圈的時間 ≥ 單一 bank 的恢復時間**，bus 才不會空下來。

## 一顆晶片要放幾個 bank：速度和容量的取捨

放幾個 bank 是 DRAM 設計者的重要決定（8 個最常見，也有多一點或少一點）。

- **bank 多**：能同時進行的存取多，平行度高、平均等待（延遲）短，data bus 更常有事做 → 記憶體更快。
- **但矽面積固定**：bank 一多（例如 16 個），每個 bank 變小，也就是 array 變小、數量變多。每個 array 都要自己的周邊電路：
  - **decoder（解碼器）**：把位址變成選哪一排
  - **sense amplifier（感測放大器）**：放大訊號
  - **multiplexer（多工器）**：挑出要的 column
- 想做出容量最大的 DRAM，就要少放周邊電路，把空間留給真正存資料的 cell。所以 **bank 越多，容量越低**。

> **例題（示意）** 晶片面積 100，每個 bank 的周邊電路佔 1.5，留給 cell 的面積是多少？

```
8 個 bank： 100 − 8 × 1.5  = 100 − 12 = 88
16 個 bank：100 − 16 × 1.5 = 100 − 24 = 76
```

- **bank 少**（例如 4 個）：bank 和 array 都比較大，容量可能更高；但大 array 的 **bit line**（連接一整行 cell 的導線）很長、電容大，讀寫比較慢也比較耗電。又是一個取捨。

## Memory interleaving：連續位址輪流放進不同 bank

### 為什麼需要

CPU 的架構越來越聰明、時脈越來越高、管線越來越深，可是記憶體供應資料的速度跟不上，CPU 常常等不到資料。這個「CPU 快、記憶體慢」的瓶頸叫 **von Neumann bottleneck（馮紐曼瓶頸）**，讓昂貴的處理器沒辦法全力運作。為了縮小落差，記憶體設計演進了好幾次，早期的一種解法就是 **memory interleaving（記憶體交錯）**。

### 怎麼運作

把連續位址輪流放進不同 bank。4 個 bank 時，bank 編號 = 位址 mod 4：

```
bank 0: 0  4  8  12
bank 1: 1  5  9  13
bank 2: 2  6  10 14
bank 3: 3  7  11 15
```

- 一個記憶體晶片被存取之後，要先恢復一段時間才能再被存取。
- 如果連續位址都在同一個晶片，快速的 CPU 只能停下來等，這段等待叫 **wait state**。
- 有了 interleaving：bank 0 把資料送給 CPU 的同時，bank 1 已經在收下一個位址；等 bank 1 送資料時，bank 0 已經恢復好，又可以被存取。結果連續幾個 word 之間的等待時間大幅縮短。

### 可以做在哪一層

回到前面的層級：DIMM → rank → chip → bank → row × column 的 cell。interleaving 可以做在不同層級：多通道之間（channel interleaving）、rank 之間、chip 之間都可以交錯。但最早、最基本的單位是 **bank**，以下都指以 bank 為單位的 interleaving：主記憶體分成好幾個 bank，位址輪流交錯放。

## 算 cycle：非交錯 28，交錯 10

> **例題** 假設送位址給 DRAM 要 1 個 cycle，DRAM 存取一個 word 要 5 個 cycle，資料送回來要 1 個 cycle。連續取 4 個 word，非交錯和 4 個 bank 交錯各要幾個 cycle？

取一個 word：1 + 5 + 1 = 7 cycles。

**非交錯**：要等前一次存取完全結束，才能開始下一個位址，四個 word 排成一長條。

```
cycle:  1  2-6    7 | 8  9-13  14 | 15 16-20 21 | 22 23-27 28
word0:  A  存取5  D |
word1:              | A  存取5  D |
word2:                            | A  存取5  D |
word3:                                          | A  存取5  D
總計 4 × 7 = 28 cycles
```

**4 個 bank 交錯**：每個 cycle 送一個位址給不同 bank，各 bank 的存取錯開一個 cycle 重疊進行。

```
cycle:   1  2  3  4  5  6  7  8  9  10
bank 0:  A  ■  ■  ■  ■  ■  D
bank 1:     A  ■  ■  ■  ■  ■  D
bank 2:        A  ■  ■  ■  ■  ■  D
bank 3:           A  ■  ■  ■  ■  ■  D
（A = 送位址，■ = 存取，D = 送回資料）
最後一個在第 10 個 cycle 結束 = 1 + 5 + 4 × 1 = 10 cycles
```

加速：28 ÷ 10 = **2.8 倍**。

> **陷阱** 這裡的 28 是「每個 word 都重送位址」的算法。課本的算法是位址只送一次：非交錯 = 1 + 4 × 5 + 4 × 1 = 25 cycles。交錯的 1 + 5 + 4 × 1 = 10 兩種算法一致。考試要看題目假設位址送幾次。

## n-way interleaving：分成幾個 bank

「幾 way」就是主記憶體被分成幾個 bank。n-way = n 個 bank，選 bank 要 **log₂ n 個 bit**：

| n-way | bank 數 | 選 bank 的 bit 數 |
|---|---|---|
| 2-way | 2 | 1 |
| 4-way | 4 | 2（00、01、10、11） |
| 8-way | 8 | 3 |
| 16-way | 16 | 4 |

## Low-order 與 high-order：用哪幾個 bit 選 bank

兩種 interleaving 的差別在用位址的哪幾個 bit 選 bank：

- **low-order interleaving（低位交錯）**：用位址最右邊、最低位的 bits（LSB）選 bank，左邊高位 bits 選 bank 裡第幾個 word。連續位址的低位一直在變，所以 0、1、2、3 輪流落在 bank 0、1、2、3。
- **high-order interleaving（高位交錯）**：用最左邊、最高位的 bits（MSB）選 bank，低位 bits 選 word。連續位址的高位不變，所以 0～3 全在 bank 0、4～7 全在 bank 1，一整塊一整塊分配。

> **陷阱** low-order 的「low」是指 **用位址的低位 bits 選 bank**，不是 bank 編號低。

### 例題：4 個 bank 的 low-order（4-bit 位址、16 個 word）

4 個 bank 需要 log₂ 4 = 2 bits 選 bank，4-bit 位址剩 2 bits 選 word：

```
位址 = [ word: 高 2 bits | bank: 低 2 bits ]
```

| bank 0 | bank 1 | bank 2 | bank 3 |
|---|---|---|---|
| 0000 | 0001 | 0010 | 0011 |
| 0100 | 0101 | 0110 | 0111 |
| 1000 | 1001 | 1010 | 1011 |
| 1100 | 1101 | 1110 | 1111 |

- 0000：低位 `00` → bank 0；高位 `00` → word 0。
- 0110：低位 `10` → bank 2；高位 `01` → word 1。

第一個 cycle 結束後，bank 0 已經開始處理 0000；接下來 CPU 繼續送 0001、0010、0011，它們落在 bank 1、2、3，所以取資料和選 bank、選 word 可以重疊進行。

### 例題：4 個 bank 的 high-order（同樣 4-bit 位址）

最高 2 bits 選 bank，低 2 bits 選 word：

```
位址 = [ bank: 高 2 bits | word: 低 2 bits ]
```

| bank 0 | bank 1 | bank 2 | bank 3 |
|---|---|---|---|
| 0000 | 0100 | 1000 | 1100 |
| 0001 | 0101 | 1001 | 1101 |
| 0010 | 0110 | 1010 | 1110 |
| 0011 | 0111 | 1011 | 1111 |

- 0000：高位 `00` → bank 0；低位 `00` → word 0。
- 同樣的 0110：高位 `01` → bank 1；低位 `10` → word 2。（low-order 時它在 bank 2 的 word 1。）

high-order 最適合 **共享記憶體（shared memory）**，也就是好幾個處理器共用一塊記憶體：例如 CPU 1 正在存取 bank 0，同一時間 CPU 2 可以存取 bank 2，兩個不衝突，真正同時進行。

## 兩種 interleaving 的優缺點與 bank conflict

| | low-order | high-order |
|---|---|---|
| 優點 | burst 讀連續位址時延遲可以重疊（像 28 變 10）；連續位址分散到各 bank，每個 bank 工作平均（負載平衡） | 共享記憶體中不同 CPU 可同時用不同 bank，平行度好；容錯好：壞一個 bank 只影響那一整塊位址，其他照常用 |
| 缺點 | 不連續讀可能 bank conflict；每塊資料都分散在所有 bank，壞一個 bank 幾乎所有資料都受影響，整個 DRAM 不能用 | 連續位址都在同一個 bank，連續存取沒辦法管線化重疊 |
| 適合 | 單一處理器連續讀 | 多處理器各用一塊 |

> **例題** 4 個 bank 的 low-order，依序讀位址 0、4、8、12（每次跳 4）會怎樣？

```
0 mod 4 = 0, 4 mod 4 = 0, 8 mod 4 = 0, 12 mod 4 = 0  → 全落在 bank 0
```

四次存取都卡在同一個 bank，必須一個等一個，這叫 **bank conflict**。

### Bank conflict 的兩種情形

- **low-order**：CPU 接連存取的位址落在同一個 bank。
- **high-order 的共享記憶體**：好幾個處理器同時要用同一個 bank。

### 兩種一起用

可以結合：外層在 **chip 層級用 high-order**，提供多處理器的平行度；內層在 **bank 層級用 low-order**，讓連續讀取的延遲重疊。

### 實務與替代方案

- 在現在的 DDR 記憶體裡，interleaving 是可選的功能，常搭配 burst 模式使用。
- 另一條路是把記憶體和 bus（或 cache）做寬：例如一次拿 4 個 word 寬的資料，只要 1 + 5 + 1 = 7 cycles，但匯流排和多工器比較貴。

> **陷阱** low-order 給「單一處理器連續讀」（重疊延遲），high-order 給「多處理器各用一塊」（平行），不要記反。

## 為什麼需要 virtual memory：multiprogramming

Memory hierarchy（記憶體階層）由上到下是：CPU 旁的 cache（快取）、main memory（主記憶體）、disk（硬碟）。Cache 放常用的東西；那 main memory 和 disk 之間為什麼還要多一層 virtual memory（虛擬記憶體）？答案和作業系統（OS）的 multiprogramming（多工）有關。

### 只跑一個 program 時：不需要翻譯

程式裡每樣東西都有 address（位址）：程式碼、static data（固定的資料）、stack（堆疊）各放在 user memory space 的某個位置。

如果整台電腦只跑一個 program，它獨佔 CPU 和 memory，事情最簡單：程式說「第 100 號位址」，就直接是 memory 的第 100 個位置。Virtual address 就是 physical address，完全不需要 translation（位址轉換）。一個跑完才換下一個（sequential）。

### Multiprogramming：IO 時把 CPU 讓出去

問題是 program 常常在做 IO（讀寫硬碟、等輸入），一次 IO 要花上百萬個 cycle，這段時間 CPU 只能閒著，很浪費。

所以 OS 讓好幾個 program 一起 run：P1 去做 IO，OS 就從 ready list 拿一個準備好的 program 來用 CPU。

可是每個人寫程式時位址都從 0 開始，同一個位址到底放誰的？解法是：

- 每個 program 都有自己的 address space（位址空間），大家再 share 同一塊 physical memory（實體記憶體）。
- User 看到的空間甚至可以比 physical memory 還大，因為反正不會一次全部搬進來。

### 為什麼只搬一部分就夠：locality

靠 locality（區域性）：程式在同一段時間只會用到某一塊。執行到哪一塊，就把那一塊搬進 main memory。還沒用到的放在 disk 上的 swap space（交換區），所有 program 需要的空間都先在那裡有位置。

每次只搬需要的一小塊。Cache 那一層一塊叫 block；virtual memory 這一層，一塊叫 page（頁）。

> **陷阱** Virtual memory 不只是「讓 memory 看起來更大」，更關鍵的是讓多個 program 安全地 share 同一塊 physical memory。

## 每個 process 都有一整個 virtual address space

Virtual memory 是 OS 層面的操作概念，一開始不容易懂很正常。

Program 執行起來就是一個 process（行程，不是 processor）。每個 process 都有完整、獨立的 virtual address space，例如 2³² 個 byte。可是假設三個 process 同時在跑，它們共用同一個 CPU、同一塊 physical memory。

```
P1 的 virtual space (2³² bytes)   P2 的 virtual space   P3 的 virtual space
        │ 只搬用到的 3、4 個 page      │                    │
        └────────────┬────────────────┴────────────────────┘
                     ▼
          同一塊 physical memory（大家的 page 混在一起放）
                     ▲
          disk：每個 process 的整個 space 都有位置（swap 出去，不必連續）
```

一個 process 的生命週期大致是：

1. P1 在跑。雖然它的空間有 2³² 那麼大，實際只要把要用的三、四個 page 拿進 main memory。
2. P1 跑到一半要做 IO，就放棄 CPU，讓給 P2。
3. 輪到 P1 再跑時，它需要的 page 還在 main memory，從剛才被 interrupt 的地方 resume（繼續做）。

自己看到、可以使用的空間叫 virtual address space，其中只有幾塊放進 physical memory。整個 2³² 的空間都在 disk 上有位置；沒用到的就 swap 出去放在 disk，而且不需要連續擺放，用到時再搬過來。

> **重點** 正因為很多 program 要 share CPU 和 memory（multiprogramming），又有 locality 可以只搬自己要用的部分，所以才需要 translation。不用 virtual memory，就只能一個 program 獨佔 memory 和 CPU、一個跑完才換下一個。

## Virtual memory 這一層：page 很大、由 OS 管

把 virtual memory 看成 hierarchy 多了一層：

| 層 | 角色 | 特性 |
|---|---|---|
| main memory | upper level（上層） | 小、快，只放少部分 program |
| disk | lower level（下層） | 大、慢，所有 program 都在這裡 |

- Disk 比 memory 慢非常多。要用的東西不在 main memory，就要花很長很長的時間搬進來。
- 既然搬一次這麼貴，就一次搬大塊一點，這一塊叫 page，大小通常 1 KiB 以上。
- 搬的時候，這個 program 把 CPU 讓給別人，disk 在背景慢慢搬，不浪費 CPU。
- 一次 miss 要上百萬個 cycle，就算 OS（軟體）多跑幾萬個 cycle 把事情處理得聰明一點也很划算，所以這一層用 software 管理。

從 disk 搬到 memory 也要做 translation，概念和 memory、cache 之間非常像。搬進搬出都用固定大小：在 disk 上這一塊叫 **page**，放進 memory 時佔的位置叫 **frame**（頁框）。兩者一樣大，所以搬進來剛好放得下。

> **觀念** 換個角度看，main memory 就是 disk 的 cache。

### Page 對到 frame：放哪裡都可以

假設有 A、B 兩個 program，各有自己的 virtual space；常用的 page 放進 physical memory，不常用的留在 disk，許多 program 同時在 physical memory 裡 run。

Virtual 和 physical 的位置不需要一樣：A 的 page 1 可以放在 physical 的 2 號，B 的 page 4 可以放在 0 號，放哪裡都行。做法是把 program 切成一塊一塊（例如 1K），physical 也切成一樣大小的一塊一塊，兩邊切法相同；只要有一張 translation table 記錄誰在哪就好。

| physical frame | 裡面放的是 |
|---|---|
| 0 | B 的 page 4 |
| 1 | （其他 page 或空著） |
| 2 | A 的 page 1 |
| … | … |

A、B 其他不常用的 page 留在 disk。

> **比喻** 教室只有 10 個座位，這就是 frame：每個位置一樣大，可以坐任何一位學生。學號 38 號的學生坐到 10 號位。只要有一張表寫著「38 號 → 10 號位」，要找他就到 10 號位去找。這張表就是一個 mapping：把 virtual page 對應到 physical frame。

所以寫程式時可以用很大的 virtual space，很方便；真正執行時一次只用到幾塊，用到哪塊再搬進來。如果要用的 page 不在 main memory，就叫 **page fault**（缺頁）。

## 四個問題：為什麼 virtual memory 用 fully associative

和 cache 一樣，這一層也要回答四個問題：

| 問題 | Cache 的說法 | Virtual memory 的答案 |
|---|---|---|
| 一塊多大 | block size | page 很大（miss penalty 上百萬 cycle） |
| 放哪裡、怎麼找 | placement | fully associative，靠 page table 找 |
| 滿了誰出去 | replacement | 近似 LRU（reference bit），見後面 |
| 寫入怎麼處理 | write | write back + dirty bit，見後面 |

**第一個問題（多大）**：miss penalty 高達上百萬個 cycle，一旦 page fault 還要 interrupt、讓出 CPU，所以乾脆一次搬大塊，page 通常很大。

**第二個問題（怎麼放）**：cache 學過三種：

- direct map：每塊只能放一個固定位置。
- set associative：放在一組裡的某幾個位置。
- fully associative：哪裡都可以放。

如果用 direct map，memory 明明還有空位，卻因為位置固定而不能放，就會多發生 page fault，而每次的 penalty 都非常大。所以 virtual memory 用 **fully associative**：任何一個 page 可以擺在任何一個 frame。位置的大小一定符合 page 的大小，一個洞剛好塞一個 page。

既然 page 可以在任何地方，就需要一張表記錄它在哪裡，這張表就是 **page table**（分頁表），用來做 translation。

> **陷阱** Virtual memory 用 fully associative 是為了降低 page fault 次數（penalty 太大），代價是要一張 page table 來查位置。

## 位址怎麼切：virtual page number + page offset

給一個 virtual address（虛擬位址）。如果一個 page 是 2¹² 個 byte：

```
 virtual address
 ┌──────────────────────────┬──────────────────┐
 │ virtual page number (VPN)│ page offset      │
 │ high-order bits：第幾個 page │ 最低 12 bits：page 裡第幾個 byte │
 └──────────────────────────┴──────────────────┘
```

- 最低 12 個 bit 是 **page offset**（頁內位移），表示在 page 裡的第幾個 byte。
- 扣掉 offset，前面剩下的 bit 是 **virtual page number**（VPN，虛擬頁號），表示第幾個 page。

這和 word（字組）的概念一樣：一個 word 4 個 byte，最後 2 個 bit 只是在 word 裡挑第幾個 byte，找第幾個 word 時不用理它。前面的 high-order bits（高位元）告訴你是第幾個 page，就像看第幾個 word 一樣。

為什麼 offset 不用翻譯？把一整個 page 搬到某個 frame，裡面第 0、1、2、3 個 byte 的位置會變嗎？不會，第 3 個 byte 搬過去還是第 3 個。這個相對位置就是 page offset，所以 offset 原封不動抄過去。Page 要擺去哪個 frame 不重要，只要一張 translation table 對應就好。

```
virtual address:   [  VPN  ][ page offset ]
                       │           │
                  page table       │ 照抄
                       ▼           ▼
physical address:  [  PFN  ][ page offset ]
```

> **陷阱** 只有 page number 需要翻譯；page offset 原封不動抄過去。

> **例題** Page 大小 4096 = 2¹² bytes。某個 byte 在 page 5、offset 0x2A4；查 page table 得到 page 5 → physical frame number 3。求 physical address。

1. Offset 是 low-order 12 bits，不變：0x2A4。
2. VPN 5 查表換成 frame 3。
3. Frame 3 的起點是 3 × 4096 = 12288 = 0x3000，接上不變的 offset：

```
PA = 3 × 4096 + 0x2A4
   = 0x3000 + 0x2A4
   = 0x32A4
```

對照原本的 virtual address：5 × 4096 + 0x2A4 = 0x52A4。前面的 5 換成 3，後面的 2A4 照抄。

### 例題：4 個 page、2 個 frame

平常的 memory reference（記憶體存取）就是給一個地址，去那裡拿東西。如果 virtual 和 physical 一樣，給 0011 就去 0011 拿，給 1011 就去 1011 拿。但 virtual address 其實是寫程式時自己編的「假」號碼，東西真正擺在 memory 的另一個地址，所以需要 translation。

設定：

- Virtual space 分成 4 個 page，每個 page 只有 4 個 byte，位址從 0000 排到 1111，共 16 個。
- 前兩個 bit 是 page number（00 是第 0 個 page、01 是第 1 個……），後兩個 bit 是 page offset（page 裡的第 0～3 個 byte）。
- Physical memory 只有 2 個 frame，地址前面就是 frame number，寫作 00、01。

```
virtual space                         physical memory
page 00: 0000 0001 0010 0011          frame 00: 0000 0001 0010 0011  ← page 01 搬進來
page 01: 0100 0101 0110 0111  ─────►  frame 01: 0100 0101 0110 0111
page 10: 1000 1001 1010 1011
page 11: 1100 1101 1110 1111
```

Page 01 常常被用到，就把它整塊搬進 main memory，放在 frame 00。Page table 有 4 個 entry（對應 4 個 page），第 01 個 entry 記下「page 01 → frame 00」：

| page number | valid | frame |
|---|---|---|
| 00 | 0 | – |
| 01 | 1 | 00 |
| 10 | 0 | – |
| 11 | 0 | – |

現在要拿 page 01 裡的第 3 個 element（offset 11）。搬到 frame 以後它還是第 3 個嗎？是的，整塊一起搬，offset 不會變，會變的只有前面的 page number。

把 virtual address 0110 翻成 physical：

1. 切開：`01 | 10`，page number = 01，offset = 10。
2. 查 page table 第 01 個 entry → frame 00。
3. Offset 10 不變，接在 frame 00 後面 → physical address **0010**。

> **重點** Low-order bits 是 offset，原樣抄；high-order bits 是 page number，查表換成 frame number。（frame number 這裡寫成 00、01 兩位，重點在 offset 原樣接上、只換掉 page number。）

### Virtual space 可以比 physical 大

Translation 之後位址不一定變小，但 virtual address 可以比較大，physical 可以比較小。例如 virtual 有 2³⁶ 個 address（64 GiB），physical 只有 2³⁴（16 GiB），2³⁶ ÷ 2³⁴ = 4，virtual 是 physical 的 4 倍。

因為都切成一塊一塊、又不會同時全部搬進來，virtual 可能有 1024 個 page，physical 只有 32 個 frame 也沒關係，每次真正用到的只有幾個 page。Physical 有多大是 hardware 決定的；virtual address space 可以跟它一樣大，也可以不一樣大。

## Page table

### 從空表長起來：valid bit

Page table 和 cache 很像，是一張表，每次有 page 搬進來就更新它。

1. 一開始 page table 是空的。每個 entry 有一個 **valid bit**，全部是 0，表示「還沒有東西」。
2. 拿 VPN 2 去查，valid = 0，代表這個 page 還沒搬進來 → **page fault**。
3. OS 到 disk 把這個 page 搬到 main memory 的某個 frame，這裡放進 frame 1。
4. OS 把 entry 2 設成 valid = 1，並記下 frame 1。
5. 下次再 access VPN 2，查到 valid，直接翻譯到 frame 1，不再 page fault。

```
一開始              第一次查 VPN 2（page fault 後）     之後再查 VPN 2
VPN valid frame     VPN valid frame                    VPN valid frame
 0    0    -         0    0    -                        0    0    -
 1    0    -         1    0    -                        1    0    -
 2    0    -   →     2    1    1      →                 2    1    1   → hit，直接到 frame 1
 3    0    -         3    0    -                        3    0    -
```

> **比喻** OS 像班長，知道教室哪裡還有空位、誰坐在哪個 frame，所以由它決定 page 放哪裡。

Physical memory 裡同時有好多個 program，**每個 program 都有自己的 page table**，把自己的 virtual page 翻譯到 frame，這些表都由 OS 管理。

### Paging 的定義

**Paging**（分頁）：virtual address 切成 page，physical address 切成 page frame，兩者一定要一樣大（equal size），誰對到誰靠 page table 記錄這個 mapping。

- 在 memory 裡：例如第 3 個 page 對到第 5 個 frame，table 給你有效的 frame，就拿得到資料。
- 不在 memory：table 告訴你它還在 disk、沒搬進來，這就是 page fault。

### Page table 是 memory 裡的 array

Page table 就是一個放在 main memory 裡的 array（陣列）：第 i 個 entry 對應第 i 個 page，存它的 physical frame number，所以直接用 page number 當 index 去查。

Page table 不一定從位址 0 開始放，可以放在任何地方。起點記在 **page table register**（分頁表暫存器），它告訴硬體 page table 從哪裡開始。

> **例題** Page table 從 memory 位址 100 開始放。(1) 第 5 個 entry 在哪？(2) VPN = 38 的 entry 在哪？

1. 第 5 個 entry：100 + 5 = **105**。
2. VPN 38：若 table 從 0 開始放就在 38；從 100 開始放，就在 100 + 38 = **138**。到 138 拿出 frame number。

```
page table register = 100
address:  100   101  ...  105  ...  138  ...
entry:    [0]   [1]  ...  [5]  ... [38]  ...
                                    │
                         frame number → PA 的 high-order bits，接上 page offset
```

拿到的 frame number 當 physical address 的 high-order bits，接上不變的 page offset（low-order bits），translation 就完成了。

一個 page table entry 裡有：

| 欄位 | 意義 |
|---|---|
| frame number | page 在 memory 時，放在哪個 frame |
| valid | 這個 page 現在在不在 memory |
| reference | 最近有沒有被用過 |
| dirty | 有沒有被寫過 |

Page 在 memory 裡就是 hit，entry 給你 frame number；不在 memory 的，entry 指到 disk 上的 swap area（告訴 OS 它在 disk 的哪裡），這時就是 page fault，程式不能繼續，要等 OS 處理。

## Page fault：硬體偵測、OS 處理

### Page fault 時 process 去哪了

1. 查 page table 發現 page 不在 main memory → page fault，發生 interrupt（中斷），OS 開始處理。
2. 這個 process 被 context switch，把 CPU 讓給別人用。
3. 做 IO：disk 慢慢把需要的 page 搬到 memory 的空 frame。
4. 搬完再 interrupt 一下，OS 把這個 process 放回 ready queue（等候用 CPU 的隊伍），等 CPU 有空。
5. 輪到它時，從剛才停下的地方繼續。

對 program 自己來說，好像一直按順序在跑，完全不知道中間發生過什麼。

### 為什麼交給 OS

Page fault 的 penalty 很大。硬體可以偵測到 valid = 0，但沒辦法自己修好，必須交給 software（OS）處理。

| | cache miss | page fault |
|---|---|---|
| 代價 | 幾個 cycle | 上百萬 cycle（disk） |
| 誰處理 | 硬體，很快修好 | OS 軟體 |
| 這段時間 CPU | stall 幾個 cycle | context switch 給別的 process |

OS 跑幾千、幾萬個 cycle，比起 disk 的幾百萬個 cycle 小很多，而且軟體可以做比較複雜、聰明的決定。

> **陷阱** Cache miss 由硬體處理（CPU stall 幾個 cycle）；page fault 由 OS 軟體處理（context switch），因為 penalty 差了好幾個數量級。

### OS 處理 page fault 的步驟

1. 如果 main memory 還有空 frame，直接把 page 搬進來（剛開始執行時常是這樣）。
2. 如果 physical memory 已經滿了，就要 replace（換掉）一個 page；被換掉的如果改過，要先寫回 disk，把位置空出來。
3. 把要的 page 從 disk 讀進來、update page table，讓 program resume。

OS 事先要做的準備：

- 一開始就替整個 virtual address space 在 disk 上建好 swap space，每個 page 在 disk 上都先有位置。
- 用 data structure 記錄：哪個 page 在 disk 哪裡、在哪個 frame、什麼時候被用過，才能決定換誰。

OS 把事情決定好、設定好之後，真正的 IO 不需要 OS 一直盯著，disk 自己把資料搬到 memory，搬完再 interrupt CPU。

## Page replacement 與 write back

### Replacement：近似 LRU 的 reference bit

Direct map 每塊只有一個固定位置，新的來就換掉原本的，不用選。Set associative 一組都滿時需要 policy；fully associative 更需要：例如 1024 個 frame 全滿，新的 page 要進來，該請誰出去？

靠 temporal locality（時間區域性）：最近用過的待會很可能再用，所以把最久沒用的搬出去，這叫 **LRU**（least recently used）。

純 LRU 要一直記錄誰最近用、誰最久沒用，太複雜。實作上改用 **reference bit**（也叫 use bit），每個 page 一個 bit：

1. Page 只要被用到，reference bit 就設成 1。
2. OS 要換 page 時，找 reference bit 是 0 的（代表最近沒被用），從中挑一個換掉。
3. 不能用過一次就永遠算「最近用過」，所以每隔一段時間把全部清回 0，之後被用到的才再設成 1。

> **例題** 有 16 個 page，先把 reference bit 全部清成 0。下一段時間有 10 個 page 被用到，bit 變成 1，剩 6 個還是 0。要 replace 時，就從這 6 個 bit = 0 的 page 裡隨便挑一個換掉。（下表哪幾個是 1 為示意，數量 10 個 1、6 個 0 才是重點。）

```
page:          0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15
清 0 後:       0 0 0 0 0 0 0 0 0 0  0  0  0  0  0  0
一段時間後:    1 1 0 1 1 0 1 1 0 1  1  0  1  0  1  0   ← 10 個 1、6 個 0
可換的候選:        2     5     8       11    13    15
再過一段時間:  全部清回 0，重新記錄
```

### Write：一定是 write back

- Write through：每次寫都同步寫到下層。
- Write back：先寫在上層，被換出去時才寫回。

Virtual memory 不可能用 write through：每更新一次就寫 disk，要上百萬 cycle，根本做不到。所以一定是 **write back**。

Write back 要配 **dirty bit**（髒位元），放在 page table entry 裡，記錄這個 page 有沒有被改過：

- 沒改過：和 disk 上的資料一模一樣，換出去時不用寫回。
- 改過：被 replace 時，要多做一次寫回 disk 的動作。

> **陷阱** Virtual memory 不可能用 write through：每次寫都寫 disk 太慢。

## Page table 帶來的兩個麻煩

四個問題（多大、放哪裡怎麼找、換誰、怎麼寫）都和 cache 一樣回答完了，可是 page table 本身帶來兩個新問題：

1. **Page table 太大**：同時有好幾個 program 在 run，每個都有自己的一張 page table；因為 fully associative，每個 page 都要一個 entry（1024 個 page 就要 1024 個 entry），virtual space 很大時 table 就很大。
2. **太慢**：page table 擺在 memory 裡，每次都要先到 page table 做 translation，再用得到的 physical address 去 access 真正的資料，等於每次存取要兩倍的 memory access。

這裡先處理「太大」；「太慢」靠 TLB 解決（下一部分）。

### Page table 有多大

為什麼每個 page 都要一格？Cache 用硬體比 tag，不用為每個可能的 block 都建一格；virtual memory 是 fully associative、用查表法，就得每個 virtual page 都有一格。

> **例題** 32-bit virtual address，page 大小 4 KiB，每個 entry 4 bytes。一張 page table 多大？

1. Page 大小 4 KiB = 2¹² bytes → page offset 用掉 12 bits。
2. Page number = 32 − 12 = 20 bits → 共 2²⁰ 個 entry。
3. 2²⁰ × 4 bytes = 2²² bytes = **4 MiB**。

```
32-bit VA:  [ VPN 20 bits ][ offset 12 bits ]
page table: 2²⁰ entries × 4 B = 4 MiB（每個 program 一份）
```

好多 program 同時在跑，每人一張 4 MiB 的表，memory 被吃掉一大塊。

其實 page table 也有 locality：同一段時間只會 access 某一塊 virtual space，可能只用到其中一兩個 entry，不需要整張都放著。以下三種方法。

### 方法一：bound register（limit register）

用 bound register（界限暫存器）限制 table size。程式執行時 dynamic data 和 stack 會一直長，table 也跟著慢慢長，一開始不必整張配置。

- 例如現在只用到 100 個 entry，limit 就設 100，只配置 0 到 100；用得更多再放更多 entry 進去。
- 用到第 10、15、18 個 entry，就用多少給多少，limit 慢慢往上漲：用到第 15 個就設 15，用到 30 就設 30。
- Limit 設 30 的意思是：30 以下合法、30 以上不合法，需要時再往上長。

但 memory 其實是從兩端長過來的：

```
高位址 ┌──────────────┐
       │ stack   ↓    │  從高位址往下長
       │              │
       │ (未使用)      │
       │              │
       │ dynamic data ↑│  從低位址往上長
低位址 └──────────────┘
```

所以用**兩個 limit register** 比較合理：一個管往上長的（dynamic data），一個管往下長的（stack）。

### 方法二：hashing → inverted page table

回想資料結構的 hash table：值的範圍是 1 到 1000，但真正出現的只有 100 個。用 array 直接 index 就要開 1000 格，大多空著，就像 page table 一樣浪費。改成只挖 100 個洞，用 hash function 決定位置，例如 mod 100：101 除以 100 餘 1，就放在第 1 格。

Page table 也一樣：virtual 可能有 1024 個 page，但 physical frame 只有 100 個，任何時刻最多只有 100 個 page 在 memory。所以：

- 依 **frame 數**只建 100 個 entry，用 hash function 把 page number map 進這張表。
- 1024 個 page 擠進 100 格，一定會 collision（碰撞），所以每個 entry 要記錄**是哪個 page number**、對應**哪個 frame**。
- 衝突時用 hashing 的方法：chaining（用 linked list 串起來）或 linear probing（往下一格找）；比對記錄的 page number，對不上就繼續找。

> **例題** （示意）hash function = page number mod 100，表有 100 格。Page 5、105、205 都在 memory，分別放在 frame 7、42、63。查 page 205 的 frame。

```
slot 5 → [page 5, frame 7] → [page 105, frame 42] → [page 205, frame 63]   (chaining)
```

1. 205 mod 100 = 5，到 slot 5。
2. 第一個記錄 page 5 ≠ 205，往下；page 105 ≠ 205，往下；page 205 相符 → frame 63。

> **例題** 28-bit virtual address、4K page，physical 有 16K 個 frame。一般 page table 和 inverted page table 各要幾個 entry？

1. Page offset：4K = 2¹² → 12 bits。
2. Page number：28 − 12 = 16 bits → 2¹⁶ = 64K 個 page。
3. 一般 page table：每個 virtual page 一格 → **64K** 個 entry。
4. Inverted page table（反向分頁表）：依 frame 數建 → **16K** 個 entry。Page 數是 frame 數的 64K ÷ 16K = 4 倍，表就小 4 倍。

沒有直接 index 了，要去哪一格找？靠 hash function 算出位置。

> **陷阱** Inverted page table 的大小跟 physical frame 數成正比，不是跟 virtual page 數。

### 方法三：two-level page table（multi-level）

把 page table 本身再分頁。32-bit、4 KiB page 時 page number 有 20 bits，全展開要 2²⁰ 個 entry。把 page number 再切成兩份：

```
[ 第一層 index 10 bits ][ 第二層 index 10 bits ][ offset 12 bits ]
        │                       │
        ▼                       ▼
   第一層 table ──► 選哪一大塊 ──► 該塊的第二層 table（2¹⁰ 個 entry）──► frame number
```

- 前面那份（第一層）先選哪一大塊。
- 每一大塊裡有 2¹⁰ 個 entry，由後面那份（第二層）用 index 找到真正的 entry。

關鍵是：**有用到的那一塊才展開**（配置第二層 table），沒用到的不 allocate。（示意）若只用到 2 塊，只需 2¹⁰ + 2 × 2¹⁰ = 3 × 2¹⁰ 個 entry，遠小於 2²⁰。

> **例題** Page number 只有 4 bits，拆成 2 | 2。開頭 00、01、10、11 各一塊，每塊 4 個 entry。只有 00、01 兩塊有用到，要存幾個 entry？

1. 全部展開：2⁴ = 16 個 entry。
2. 第一層：4 個 entry（00、01、10、11），記錄每塊有沒有用到：1 = 已展開，0 = 沒用到。
3. 00、01 有用到 → 各展開一張 4 個 entry 的第二層；10、11 沒用到 → 不 allocate。
4. 合計：4 + 2 × 4 = **12** 個 entry，比 16 個少。

```
第一層             第二層
00 [1] ──────► [00][01][10][11]   (page 0000～0011)
01 [1] ──────► [00][01][10][11]   (page 0100～0111)
10 [0]   (不配置)
11 [0]   (不配置)
```

## Page table 太慢：每次存取要兩次 memory reference

Page table 太大的問題可以用 limit register、hashing、multi-level page table 處理；接下來是另一個問題：**太慢**。

Page table 放在哪裡？放在 main memory 裡。所以每次要用一個 virtual address：

1. 先到 memory 裡的 page table 查出對應的 entry，換出 physical address；
2. 拿到 physical address 之後，再去 memory 拿真正的資料。

每一次存取都要 **2 次 memory reference**。Memory 光存取一次就慢到需要加 cache 來加速了，現在還要兩次，當然不能接受。

> **觀念** 一個 page 很大，裡面每個 address 做 translation 時，用到的都是**同一個 page table entry**。常用的 entry 何必放在 memory？放到靠近 CPU 的地方，就能馬上翻譯。這就是 TLB。

## TLB：translation 的 cache

放在 CPU 旁邊、專門存 translation 的 buffer，全名叫 **translation look-aside buffer（TLB）**。

### 為什麼只放一個 entry 就有用

Page 很大（1024、2048 個 byte），用到這個 address，下一個、再下一個多半在同一個 page 裡，用的是同一個 translation。例如連續存取 `0100`、`0101`……，每個 address 都要翻譯，查的卻都是同一個 page table entry。

所以最早的 TLB 真的**只有一個 entry**，就已經省掉很多事。這就是 cache 的觀念：常用的東西放在靠近 CPU 的地方；只是 TLB 放的不是資料，而是 translation。

- 沒有 TLB：每次 memory operation 要兩次 memory access，一次讀 page table entry，一次真正存取。
- TLB 是**硬體**做的。OS 是軟體，做不到這麼快，所以需要硬體幫忙。
- 後來硬體越來越便宜，TLB 不只放一個 entry，而是放好幾個，組織得像一個 cache。

### 使用方式

每次要翻譯，先查 TLB：

- **TLB hit**：translation 已經在 TLB 裡，馬上得到 physical address，直接去 main memory 存取。根本不用碰 page table，memory reference 只剩拿資料那一次。
- **TLB miss**：才到 main memory 查 page table，做真正的 translation，再去 physical memory 拿東西。

### TLB 放在哪、怎麼組織

- Main memory 被分成很多塊：一塊放 page table，其餘是各個 process 執行時用的 frame。
- TLB 通常在 **memory management unit（MMU，記憶體管理單元）** 裡，在 **CPU 這一端**，不在 DRAM 那一端。
- TLB 有多個 entry，可以組織成 **fully associative**，也可以是 **set associative**。
- TLB 的 hit rate 很高，**miss rate 只有 0.01%～1%**：因為每個 page 都很大，locality 非常高。
- TLB miss 的處理有兩種做法：用**硬體**處理（比較複雜），或發出 interrupt 跳到 OS，用**軟體**處理。

### TLB hit 時的 write：dirty bit

TLB hit 時如果是 read，就沒事了；如果是 write，別忘了 **dirty bit**。

TLB entry 只是 page table entry 的一份 copy。Page table 在 memory 裡，不可能每寫一次就去改 memory 裡的 page table，所以 **dirty bit 先記在 TLB 這邊**；等這個 TLB entry 被換掉（replace），或 page 被換出去時，才把 dirty 的資訊寫回 page table。

### 兩種 TLB miss

1. **Page 在 main memory**，只是它的 translation 沒擺上 TLB：從 page table 把 entry 搬上 TLB 就好。
2. **Page 根本不在 memory**：page table 裡沒有有效的 translation，TLB 更不可能有。這就是 **page fault**，要照 page fault 的方式處理。

層次要分清楚：TLB 是 page table 的一小部分（子集）。不在 page table 的，一定也不在 TLB。

> **陷阱** TLB miss ≠ page fault。大多數的 TLB miss 只是 translation 不在 TLB，從 page table 補上來即可；只有 page table 也沒有有效 translation 時才是 page fault。

> **重點** Page table 太大 → limit register、hashing、multi-level；page table 存取太慢 → TLB（把常用的 translation 放在 CPU 附近，省掉每次多出來的那一次 memory access）。

## TLB 加 cache：最好一次 memory access 都不用

翻譯完拿到 physical address，真的要去 memory 拿資料嗎？不一定，上面還有一層 cache。TLB 跟 cache 其實都是為了加速：

| 配備 | 一次存取要做的事 |
|---|---|
| 什麼都沒有 | 到 memory 的 page table 翻譯，再去 memory 拿資料，共 2 次 memory access |
| 有 TLB | 翻譯先查 TLB，hit 就馬上得到 physical address |
| 有 cache | 拿到 physical address 先查 cache，hit 就不用去 memory |
| TLB hit 且 cache hit | 一次 memory access 都不用（最好的情況） |

### 各種路徑

- **最好**：CPU 發出 virtual address → 查 TLB，hit 得到 physical address → 查 cache，hit 直接把資料給 CPU。
- **差一點**：TLB miss，entry 不在 TLB → 去 memory 的 page table 翻譯 → 拿到 physical address 再查 cache。這只是 translation 不在 TLB 而已。
- 不管 TLB hit 或 miss，拿到 physical address 都去 cache 找；不在 cache 就是 **cache miss**，要去 memory 把東西搬進來。

以上都還沒有 page fault，東西都在 main memory。而且這個流程是 **sequential（循序）** 的：先翻譯完，才查 cache。

### 位址怎麼接起來

1. Virtual address 切成 **virtual page number（VPN）| page offset**。
2. VPN 送進 TLB（只有少少幾個 entry，就在 CPU 旁邊），很快給出 **physical page number**。
3. Physical page number 接上不變的 page offset，就是 **physical address**。
4. 再用 physical address 查 cache：後半段當 cache index，最前面當 tag 來比對；cache 用 direct map 或 set associative 都可以。

```
virtual address :  [ virtual page number | page offset ]
                              |                 |
                             TLB             (不變)
                              v                 v
physical address:  [ physical page number | page offset ]
重新切給 cache  :  [      tag      |  index  | block offset ]
```

### 流程圖：read、write 與 protection

```
CPU 發出 virtual address
        |
   TLB access ── miss ──> 到 page table 補 entry（不在 memory 就是 page fault）
        | hit
     是 write？
     ├─ 否（read）──> 查 cache ── hit ──> 資料給 CPU
     |                        └─ miss ──> CPU stall，硬體從 memory 搬 block
     └─ 是 ──> 有 write access（寫入權限）？
               ├─ 沒有 ──> write protection exception（OS 中斷，不准寫）
               └─ 有 ──> 查 cache ── hit ──> 寫進 cache，設好 dirty 等 bit
                                   └─ miss ──> 照 cache miss 處理
```

- **Read**：cache hit，資料給 CPU；cache miss，CPU 要 **stall**（停下來等）。
- Cache miss 用**硬體**處理：CPU 只是停幾個 cycle，**不放棄 CPU**。如果交給 OS，OS 要跑很多指令，反而更慢。
- **Write**：先檢查有沒有 write access。沒有權限就是 **write protection exception**，OS 中斷這個 process，不准寫這個地方；有權限才去 cache，hit 就寫進去並設好 dirty 等 bit，miss 就照 cache miss 處理。

整個設計的目標：大部分時候都走 **TLB hit → cache hit** 這條路，完全不碰 main memory。

| 走到哪裡 | 大約代價 | 由誰處理 |
|---|---|---|
| 只在 TLB 和 cache 之間 | 一兩個 cycle | 硬體 |
| 要到 main memory | 更多 cycle | 硬體（CPU stall） |
| 連 memory 都沒有（page fault） | 上百萬個 cycle | OS（軟體），多花幾千幾萬個 cycle 也沒關係 |

> **陷阱** Cache miss：硬體處理，CPU **stall**。Page fault：軟體（OS）處理，做 **context switch**。差別來自 penalty 相差太多。

## TLB、page table、cache：哪些組合可能發生

三者各自 hit 或 miss，共 8 種組合：

| TLB | Page table | Cache | 可能嗎 | 說明 |
|---|---|---|---|---|
| hit | hit | hit | 可能 | 最好的情況：TLB 翻好、資料在 cache |
| hit | hit | miss | 可能 | translation 在 TLB，資料不在 cache。注意：TLB hit 時其實根本不會去查 page table |
| miss | hit | hit | 可能 | entry 還沒搬上 TLB（例如第一次用），但資料可能已經在 cache |
| miss | hit | miss | 可能 | 在 page table 找到 translation，但資料還沒搬進 cache |
| miss | miss | miss | 可能 | page 不在 main memory，就是 page fault；可能，但很花時間 |
| hit | miss | miss | 不可能 | TLB 只是 page table 常用的一小部分；page table 都沒有，TLB 怎麼會有 |
| hit | miss | hit | 不可能 | 同上：TLB 是 page table 的子集，TLB hit 則 page table 一定 hit |
| miss | miss | hit | 不可能 | page table miss 代表 page fault、東西不在 memory，不在 memory 就不可能在 cache |

> **陷阱** 「TLB hit、page table miss」不論 cache 如何都不可能；「page table miss 卻 cache hit」也不可能。

## Cache 用 physical address，所以要排隊

先把整條路複習一次：

- Virtual memory 是 memory hierarchy 的最後一層。每個 program 有自己的 virtual address space，很多 program 同時跑，共用一塊 physical memory。因為 locality，只要把需要的 page 搬進 main memory；整個 program 的 virtual space 都放在 disk 的 **swap space**。
- Disk 和 main memory 之間的 miss penalty 很大，所以搬進搬出的單位 page 很大（1K、4K bytes），而且用 fully associative：memory 只要有位置就能放。
- 翻譯時，page number 換成 frame number，當 physical address 的前半部（high-order bits）；後半部是不變的 page offset。
- Page table 在 memory 裡，正常要兩次 memory access；常用的 data 放 cache、常用的 translation 放 TLB，兩者都 hit 時一次都不用。

Cache 用的是什麼 address？**Physical address**。Process 很多，但 physical memory 只有一份，所以 physical address 才是 **unique（獨一無二）** 的。因此一定要先翻譯才能查 cache：TLB hit 直接拿到 physical address，miss 要去 memory 找 entry。做完 translation 才能查 cache，是 sequential 的，時間被拉長。

## Virtually addressed cache：快，但有兩個問題

能不能讓「翻譯」和「查 cache」同時做？要同時做，cache 就得直接用 virtual address，cache 裡擺的就是 virtual address：

- 直接拿 virtual address 去 cache 找，**hit 就結束**，完全不用翻譯。
- 只有 **miss** 時，才翻成 physical address，去 main memory 把東西搬進 cache。

天下沒有這麼容易的事，會出現兩個問題。

### 問題一：同一個 virtual address 不再 unique

Cache 是共用的。Multiprogramming 下，好幾個 process 輪流在同一個 CPU 上跑，共用同一個 cache。一個 process 說「第 8 號 address」，另一個也說「第 8 號」，但各有自己的 address space，其實不是同一個 data。

**解法**：每個 process 有一個 **process ID**，把 process ID 加進 tag，就知道是誰的，又變 unique 了。

> **陷阱** Virtually addressed cache 的 tag 若不加 process ID，換 process 之後，同一個 virtual address 會拿到別人的資料。

### 問題二：不同 virtual address 指到同一個 physical 位置

Physical address 可能被 **share**：兩個 process 用不同的 virtual address 指到同一個 physical location（稱為 aliasing）。這樣 cache 裡同一個 physical 位置就有兩份 copy，改一份、其他 copy 也都要改，維持 **consistency（一致性）** 要花很多硬體。

> **重點** Virtually addressed cache：好處是 translation 和 cache access 能同時做；代價是要用很多硬體處理 process ID 與多份 copy 一致的問題。

## Virtually indexed, physically tagged

另一個做法稍微變化一下，叫 **virtually indexed, physically tagged（虛擬索引、實體標籤）**：

- Cache 的 **tag 仍用 physical address**，它是 unique，不會有「不同名字、同一位置」的問題。
- Cache 的 **index 取自 page offset 裡不會被翻譯改掉的 bits**。

### 為什麼可以

看 translation：TLB 只把 page number 換成 frame number，**page offset 不會變**。

再看 cache 的地址：最後幾個 bit 是 block offset。Block 是 4 bytes 時，最後 2 個 bit 不用理它；前面那一整段是 block number，把 block number 的 low-order bits 當 index 去讀 cache，剩下的高位就是 tag，用來分辨 map 到同一格的人。

如果 index 用到會被翻譯改掉的 bits，拿 virtual address 去 index 就不正確，只能等翻譯完再查（sequential，很慢）。可是翻譯會改變的只有前面 frame number 那一小段；只要 **page 夠大**，cache 的 index 加 block offset 就完全落在 page offset 裡。這幾個 bit 在 virtual address 跟 physical address 是一樣的，所以能直接拿 virtual address 的這幾個 bit 去查 cache。

> **例題** （示意）32-bit 位址、page 4 KiB（page offset 12 bits）、block 4 bytes（block offset 2 bits）、cache index 10 bits。能不能做 virtually indexed, physically tagged？

```
page offset    = log₂ 4096 = 12 bits
block offset   = log₂ 4    = 2 bits
index          = 10 bits
index + offset = 10 + 2 = 12 ≤ 12   → 成立

virtual address : [ VPN (20 bits)          | page offset (12 bits)      ]
                         | TLB                   | 不變
physical address: [ PPN (20 bits)          | page offset (12 bits)      ]
cache 的切法     : [ tag (20 bits，= PPN)   | index (10) | block off (2) ]
```

Index 和 block offset 全在 page offset 內，所以用 virtual address 的低 12 bits 就能讀 cache；tag 剛好就是翻譯出來的 physical page number。若 index 要 11 bits，`11 + 2 = 13 > 12`，最高那個 index bit 會被翻譯改掉，就不能這樣做。

### 流程

1. Virtual address 的 page offset 部分（不會變）拿去當 index，讀 cache；**同時** page number 送進 TLB 翻譯。
2. Cache 讀出 tag 要一點時間，這段時間 TLB 也在翻譯；tag 讀出來時，翻譯也好了，馬上比對，沒有浪費時間。Cache access 與 translation 同步進行。
3. TLB 翻出的 physical tag 與 cache 讀出的 tag 比對：一樣而且 valid，就是 **hit**，資料送給 CPU。
4. Cache 沒有（tag 不對或 invalid）但 **TLB hit**：只要 **1 次** memory access 把 block 拿進來。
5. **TLB 也 miss**：先去 page table 把 entry 搬進來，再去拿 block，共 **2 次** memory access。

Index 跟 virtual address 一樣，所以叫 **virtually indexed**；tag 卻是 physical address，所以叫 **physically tagged**。

> **陷阱** 條件：**index 的 bit 數 + block offset 的 bit 數 ≤ page offset 的 bit 數**，也就是 page 要夠大，index 才不會落到會被翻譯改掉的地方。

## Memory protection：kernel mode 與 system call

很多 process 共用同一塊 physical memory，我的 data 會不會被別人改掉？每個 task 都有自己的 virtual address，但用的是同一塊 physical memory，所以需要 **memory protection（記憶體保護）**。

- 保護靠 **OS**。有些事 user program 不能做，例如看 page table、設定 translation。每個 process 有自己的 page table，碰不到別人的。
- OS 跑在 **supervisor mode**，也叫 **kernel mode（核心模式）**，只有這個 mode 才能做這些動作。
- User 要從 user mode 進 kernel mode，一定要透過 **system call（系統呼叫）**。

所以 physical memory 雖然共用，並不是任何 user program 都能碰別人的東西，user 之間不會互相存取對方的 data。

## 小結：page table、TLB、cache 的 index

- Page table 做 translation；TLB 加速 translation。
- TLB 和 cache 都在 memory 系統裡，最快是 **TLB hit + cache hit**。
- Cache 用 physical address 的 index，所以要先經過 TLB 翻譯。
- 想更快：cache 直接用 virtual address（virtually addressed cache）；或 page 夠大時，用不變的部分當 index，只有 tag 要翻譯（virtually indexed, physically tagged）。

## Memory hierarchy 的共同架構：四個問題

Cache、TLB、virtual memory，每一層都靠 **principle of locality**，運作方式都像 cache。每一層都要回答同樣四個問題，唸書時照這四個問題去比較每一層，最清楚。

### 問題一：block placement（放哪裡）

放法不同，找法也不同。

- **Direct map**：用 set associative 的角度看，就是每個 set 只有 1 個 entry（**one-way**）。Index 算出來只有一個位置，直接放進去。
- **n-way set associative**：index 算出屬於哪個 set；2-way 的 set 有兩個位置，4-way 有四個，選哪個都行，比較不用搶。
- **Fully associative**：整個 cache 只有**一個 set**，裡面 N 個位置，放哪都行。

Associativity 越高，miss rate 越低，但**好處越來越小**；同時 complexity、cost 和 access time 都會增加。

### 問題二：block identification（怎麼找）

| 方式 | 怎麼找 | 要比幾個 tag |
|---|---|---|
| Direct map | index 指到唯一位置 | 1 個 |
| n-way set associative | index 選出 set，set 裡 n 個同時比 | n 個（n 越大硬體越多） |
| Fully associative cache | 全部同時比 | 全部，例如 1024 個 entry 就要 1024 個 tag 同時比 |
| Virtual memory | 建一張完整的 lookup table（page table），用 page number 直接 index 就知道在哪個 frame | 不用比 tag |

Cache 用硬體做比對；virtual memory 也是 fully associative，查 page table 要多一次 memory access，但 fully associative 讓 miss rate 降低：只要有空位就能放。

### 問題三：block replacement（誰出去）

- Direct map 只有一個位置，新的來、舊的就走，**沒得選**；set associative 和 fully associative 才有 replacement 的問題。例如 4-way，四個位置坐滿了，新的人進來，誰出去？
- **LRU（least recently used）**：照 temporal locality，很久沒用的以後最可能也不用，所以把最久沒用的搬出去。
- Way 很多時，精確記錄誰最久沒用要很多硬體，所以通常用 **approximation（近似）**。Virtual memory 用的 **reference bit** 就是一例：每隔一段時間清成 0，用到就設成 1，要換時挑還是 0 的。
- **Random**：隨機挑，硬體最省。

### 問題四：write policy（怎麼寫）

- **Write through**：每次寫上層，同時寫下層，兩份 copy 一致，但 traffic（流量）大增。加一個 **write buffer** 可以減少負擔：先寫進 buffer，buffer 再慢慢寫到下層。
- **Write back**：寫的時候不寫回，只把它標成 **dirty**（被寫過）；等這塊要被 replace 時才寫回下層。
- **Virtual memory 一定是 write back**：overhead 太大，不可能每改一個 data 就寫回 disk，要等 page 被換出去時才整塊寫回。

## Miss 的三個來源：3C

Cache miss 和 page fault 都有三種來源：

1. **Compulsory miss（強制性 miss）**，也叫 **cold start miss**：一開始誰都不在裡面，第一次存取某個 block 一定 miss。
2. **Capacity miss（容量 miss）**：容量真的不夠。要用的東西有 100，upper level 只放得下 80，一定擺不下。Virtual memory 也一樣：physical memory 有限，放不下所有 process 的 virtual space，就有 capacity miss。
3. **Conflict miss**，也叫 **collision miss（衝突 miss）**：direct map 或 set associative 為了快、不想用太多硬體做比對，用 index 規定你只能坐某個位置（或某個 set）；就算別的位置空著，也不能過去。Fully associative 沒有這個問題，有位置就能進。

> **例題** （示意）4 個 block 的 direct-mapped cache，依序存取 block 0、4、0、4。同樣的序列換成 4 個 block 的 fully associative cache 又如何？

Direct map：line = block mod 4，0 和 4 都 map 到 line 0。

| 存取 | line | hit/miss | 存取後 line 0 | line 1–3 | miss 種類 |
|---|---|---|---|---|---|
| 0 | 0 | miss | 0 | 空 | compulsory |
| 4 | 0 | miss（踢掉 0） | 4 | 空 | compulsory |
| 0 | 0 | miss（踢掉 4） | 0 | 空 | conflict |
| 4 | 0 | miss（踢掉 0） | 4 | 空 | conflict |

4 次全部 miss，line 1～3 一直空著也不能用。

Fully associative：

| 存取 | hit/miss | 存取後 cache 內容 |
|---|---|---|
| 0 | miss | {0} |
| 4 | miss | {0, 4} |
| 0 | hit | {0, 4} |
| 4 | hit | {0, 4} |

只 miss 前 2 次。Direct map 多出來的後 2 次 miss，在 fully associative 下不會發生，所以是 conflict miss。

> **陷阱** 判斷法：同一個 miss 若在（同大小的）fully associative cache 下不會發生，它就是 **conflict miss**。Conflict miss 只出現在不是 fully associative 的設計。

## 改 design 一定變快嗎

知道 miss 的原因，改 design 降低 miss rate，**不一定**提升整體 performance，要看整體：

| 改法 | 好處 | 代價 |
|---|---|---|
| Cache size ↑ | capacity miss ↓（空間更大） | cache 越大越慢，access time ↑ |
| Associativity ↑（例如 2-way → 4-way） | 一個 set 容納更多人，conflict miss ↓ | access time ↑ |
| Block size ↑ | 附近資料一起搬進來，利用 spatial locality，miss rate ↓ | 每次搬的東西多，miss penalty ↑ |

### Block size 太大，miss rate 反而上升

Cache size 固定時，block size 一直變大，miss rate **先下降，後來反而上升**。原因：cache size 固定，block 越大，**number of blocks 越少**；格子變少，更多人 map 到同一個位置，conflict 就多了。

> **例題** （示意）16 KiB 的 cache，block 16 B 與 block 1 KiB 各有幾個 block？

```
16 B  的 block：16 KiB / 16 B  = 16384 / 16   = 1024 個 block
1 KiB 的 block：16 KiB / 1 KiB = 16384 / 1024 = 16 個 block
```

從 1024 格變成只剩 16 格，map 到同一格的人大增，conflict miss 跟著增加。

### 其他趨勢

- **Synchronous SRAM** 可以送出一串 burst of data；**DRAM** 也重新設計，提供更高的 bandwidth（頻寬）。
- **Restructure code（改寫程式）** 增加 locality。設計演算法不能只看 time complexity：資料若分散，cache miss 會讓它變慢。
- **Prefetching（預先抓取）**：先把資料抓上來，也能降低 cache miss。

## 常犯的錯：byte address 與 word、block、page address

題目給的位址通常是 **byte address**（位元組位址），不是 word address。算 index、page number 之前，一定要先弄清楚 word、block、page 各是多大。

32-bit 位址可以定址 2³² 個 byte，所以這 32 個 bit 是 byte address，每個 byte 一個編號。要換成 word、block 或 page 的編號，做法都一樣：看 size 是 2 的幾次方，就把最右邊那幾個 low-order bits 當成 offset 扣掉，剩下的高位就是它的 address。

| 單位 | size | offset bits | 剩下的 address bits |
|---|---|---|---|
| word | 4 bytes = 2² | 2 | 32 − 2 = 30（word address） |
| cache block | 32 bytes = 2⁵ | 5 | 32 − 5 = 27（block address） |
| page | 4 KiB = 4 × 1024 = 2¹² | 12 | 32 − 12 = 20（page number） |

```
word： [        word address 30        | 2 ]
block：[      block address 27      |  5   ]
page： [  page number 20  |   page offset 12   ]
```

> **陷阱** 位址是 byte address 時，要算 word／block／page number，先扣掉對應 size 的 offset bits；把 byte address 直接當成 block number 去取 index 是最常見的錯。

## 寫程式也要想到 locality：row major

寫程式時不能忘了底下有一個 memory system。一維 array 依 index 一個接一個走，存取的是連續位址，spatial locality 很好。

二維 array 就要先問它在記憶體裡怎麼擺。Memory 是一維的，二維 array 只能選一種攤平方式：

- **row major**：一個 row 擺完再擺下一個 row。
- **column major**：一個 column 擺完再擺下一個 column。

如果機器用 row major，程式也一個 row 一個 row 走，連續存取的資料就擺在一起，locality 很好。反過來，資料是 row major、程式卻一個 column 一個 column 走，每次都跳過一整個 row，locality 就沒了。

### 例題：4×4 array，row 走與 column 走（示意）

設 4×4 的 int array `a` 以 row major 存放，一個 block 剛好放 4 個 element（也就是一個 row），cache 只放得下 2 個 block（這裡用 direct-mapped，row i 放在 index i mod 2）。

```
記憶體中的擺法（row major）：
block 0: a[0][0] a[0][1] a[0][2] a[0][3]
block 1: a[1][0] a[1][1] a[1][2] a[1][3]
block 2: a[2][0] a[2][1] a[2][2] a[2][3]
block 3: a[3][0] a[3][1] a[3][2] a[3][3]
```

```c
/* 依 row 走：和擺法一致 */
for (i = 0; i < 4; i++)
    for (j = 0; j < 4; j++)
        sum += a[i][j];

/* 依 column 走：每次跳過一整個 row */
for (j = 0; j < 4; j++)
    for (i = 0; i < 4; i++)
        sum += a[i][j];
```

依 row 走：每個 row 的第一個 element miss，把整個 block 搬進來，後面 3 個都 hit。

| 存取 | block | index | 結果 | 存取後 cache（index 0 / 1） |
|---|---|---|---|---|
| a[0][0] | 0 | 0 | miss | B0 / – |
| a[0][1]～a[0][3] | 0 | 0 | hit ×3 | B0 / – |
| a[1][0] | 1 | 1 | miss | B0 / B1 |
| a[1][1]～a[1][3] | 1 | 1 | hit ×3 | B0 / B1 |
| a[2][0] | 2 | 0 | miss | B2 / B1 |
| a[2][1]～a[2][3] | 2 | 0 | hit ×3 | B2 / B1 |
| a[3][0] | 3 | 1 | miss | B2 / B3 |
| a[3][1]～a[3][3] | 3 | 1 | hit ×3 | B2 / B3 |

16 次存取只 miss 4 次。

依 column 走：

| 存取 | block | index | 結果 | 存取後 cache（index 0 / 1） |
|---|---|---|---|---|
| a[0][0] | 0 | 0 | miss | B0 / – |
| a[1][0] | 1 | 1 | miss | B0 / B1 |
| a[2][0] | 2 | 0 | miss | B2 / B1 |
| a[3][0] | 3 | 1 | miss | B2 / B3 |
| a[0][1] | 0 | 0 | miss | B0 / B3 |
| a[1][1] | 1 | 1 | miss | B0 / B1 |
| a[2][1] | 2 | 0 | miss | B2 / B1 |
| a[3][1] | 3 | 1 | miss | B2 / B3 |
| 第 3、4 個 column 同樣模式 | | | miss ×8 | |

每個 block 還沒被再用到就被換掉，16 次全部 miss。

> **重點** 存取順序要配合資料的擺法。兩種迴圈做的是同一件事，但順序跟擺法不 match，cache miss 一多，速度就掉下來。

## Cache 的 control：為什麼要 finite state machine

先回想 processor 的 control 怎麼來：

- **single cycle processor**：看 instruction 的 opcode 就知道要發哪些 control signal，加減乘除等細節再看 funct field。
- **pipeline**：control signal 在 decode 階段就產生，後面的 stage 才用到，就跟著指令一路往下傳。

Cache 沒有 instruction 可看。它要發出什麼 control signal，取決於現在處在哪個 **state**（狀態）、收到哪些 **input**。所以用 **finite state machine（FSM，有限狀態機）** 來 model：在某個 state 收到某些 input，就發出對應的 signal，並 transition（轉移）到下一個 state。

### 例子：一個簡單的 cache

- direct mapped
- write-back
- **write allocate**：write miss 時也要把 block 搬進 cache
- block = 4 個 word = 16 bytes
- cache size 16 KiB → 16K ÷ 16 = 1024 個 block
- 32-bit byte address
- 每個 block 有 valid bit 與 dirty bit
- **blocking cache**：存取 cache 的期間，CPU stall 在那裡等

位址怎麼切：

1. block 16 bytes = 2⁴，最右邊 4 個 bit 是 block offset。
2. 往左是 block number，取它的 low-order bits 當 index；1024 = 2¹⁰ 個 block，index 要 10 個 bit。
3. 剩下 32 − 10 − 4 = 18 個 bit 就是 tag。

```
 31            14 13          4 3      0
[    tag 18     |  index 10   | offset 4 ]
```

## Cache controller 的 input 和 output

Controller 夾在 CPU 和 memory 中間，兩邊各有一組訊號。

| 介面 | 訊號 | 寬度／說明 |
|---|---|---|
| CPU → cache | Read/Write | 這次是讀還是寫 |
| CPU → cache | Valid | 線上訊號隨時在變，CPU 把 Valid 設成 1 才表示「要開始存取」 |
| CPU → cache | Address | 32 bits（2³² 個 byte） |
| CPU → cache | Write Data | 32 bits（一個 word） |
| cache → CPU | Read Data | 32 bits |
| cache → CPU | Ready | 東西準備好了，通知 CPU |
| cache → memory | Read/Write | miss 時要讀；write-back 的 dirty block 被換掉時要寫回 |
| cache → memory | Valid | 通知 memory 開始存取 |
| cache → memory | Address | 32 bits |
| cache ↔ memory | Data | 128 bits：一次搬一整個 block，4 words × 32 bits = 128 |
| memory → cache | Ready | memory 讀完或寫完才送；memory 慢，可能要好幾個 cycle |

## 四個 state：Idle、Compare Tag、Write-Back、Allocate

```
Idle ──(Valid CPU request)──► Compare Tag
Idle ◄──(hit；write 時 set dirty、valid、tag)── Compare Tag
Compare Tag ──(miss，舊 block clean)──► Allocate
Compare Tag ──(miss，舊 block dirty)──► Write-Back
Write-Back ──(memory 未 ready)──► Write-Back
Write-Back ──(memory ready)──► Allocate
Allocate ──(memory 未 ready)──► Allocate
Allocate ──(memory ready，新 block 已讀進)──► Compare Tag
```

各 state 做的事：

1. **Idle**：沒有存取時待在這裡，每個 clock 原地轉；CPU 送來 Valid = 1 的 request 才離開，轉到 Compare Tag。
2. **Compare Tag**：比 tag。valid 而且 tag 相同就是 hit，資料可以用。如果是 write，要發 signal 寫入並 set dirty bit；dirty、valid、tag 存在一起，所以 set dirty、set valid、set tag 一起寫。hit 就做完了，回到 Idle。
3. miss 時看被換掉的舊 block：
   - 是 dirty（被改過）→ 到 **Write-Back**，把舊 block 寫回 memory。寫回很久，在 memory 送回 Ready 之前一直留在這個 state；memory 說寫好了才到 Allocate。
   - 不是 dirty → 不用寫回，直接到 Allocate。
4. **Allocate**：不管是 read miss 還是 write miss，都把新的 block 從 memory 讀進 cache，同樣要等 memory Ready。讀完回到 Compare Tag，這次 tag 已經相同，就 hit，再回 Idle。

最長的路徑是「舊 block 是 dirty，又遇到 write miss」：

```
Idle → Compare Tag（miss）→ Write-Back → Allocate → Compare Tag（hit，寫入、set dirty）→ Idle
```

> **觀念** 為什麼 write miss 也要 allocate？寫入的只是 block 裡的一個 word，但 block 是一個整體，所以要把整個 block 搬上來，這就是 write allocate。另一種 policy 是 write no-allocate：不搬 block，只改 memory 裡那個 word。

> **陷阱** write allocate 時，Allocate 搬上來的是 memory 裡的舊資料，真正的寫入是在回到 Compare Tag 之後才做：再寫一次，並把 dirty 設成 1，read 和 write 才一致。

## FSM 怎麼變成硬體

FSM 把 cache controller 分成幾個 state，每個 state 就是一個 clock cycle 要做的事。如果某個 state 的工作特別多，clock cycle 就必須長到讓它做完；所有 state 共用同一個 clock，其他 state 的 cycle 也被一起拉長。解法是把它拆成兩個 state，各做一半，clock cycle 就能縮短。

有了 FSM，就能用邏輯設計的方法合成硬體：

- 4 個 state 需要 ⌈log₂ 4⌉ = 2 個 bit 記錄（00、01、10、11），也就是兩個 latch 或 flip-flop。
- 這個 **state register** 記住 **present state**；算出來的 **next state** 再存回去。
- input 和 present state 一起送進 **combinational logic**（組合邏輯），輸出這個 cycle 要發的 control signal 和 next state。

```
input ─────────────┐
                   ▼
present state ──► combinational logic ──► control signals
     ▲                    │
     │                    ▼
state register ◄──── next state（每個 clock 存回去）
（2 個 flip-flop）
```

> **觀念** 這跟 instruction 的 control 很不一樣：指令進來看 opcode 就知道要做什麼；cache controller 要看「現在在哪個 state」加上「收到什麼 input」，所以要把所有 state 與 input 的組合都 model 進 FSM。

## Cache coherence：多個 CPU 各有一份 copy

最後是平行化和 memory hierarchy 的關係：**cache coherence（快取一致性）**。這個問題只有平行時才會出現。

現在一顆 processor 裡有好幾個 core（multi-core），每個 core 有自己的 cache，同一份 data 可能在不同 cache 各存一份 copy。多個 CPU share 同一個 physical address 時就會出問題。

### 例子：write-through 也會不一致

假設 cache 是 write-through（寫入時 memory 同步更新），memory 裡 X 一開始是 0。

| 步驟 | 動作 | A 的 cache | B 的 cache | memory X |
|---|---|---|---|---|
| 0 | 初始 | – | – | 0 |
| 1 | CPU A 讀 X | 0 | – | 0 |
| 2 | CPU B 讀 X | 0 | 0 | 0 |
| 3 | CPU A 把 1 寫進 X | 1 | 0 | 1 |

前兩步都沒問題。第 3 步 A 的 cache 和 memory 都更新成 1，但 B 沒有跟著更新，B 的 cache 裡還是 0。同一個 location 出現兩個值，這就是 coherence 問題。

### 定義

非正式地說，coherence 就是：**讀一個 location，一定讀到最近寫進去的值**。正式定義有三條：

1. 同一個 processor 寫了某個 location 之後再讀，中間沒有別人寫，要讀到自己剛寫的值。（單一 processor 本來就是這樣。）
2. 別的 processor 寫了這個 location，經過足夠的時間之後再讀，要讀到新寫的值。
3. 對同一個 location 的寫入要 **serialized**：P1、P2 都寫同一個 location 時，寫入要排成一個順序，而且每個 processor 看到的順序都一樣，不能有人看到 P1 先、有人看到 P2 先。

## 維持 coherence：snooping 與 directory

同一份 data 會經由 **migration**（搬移）和 **replication**（複製）出現在好幾個地方，形成好幾份 copy。維持一致性的 protocol 有兩種：

- **Directory-based**：集中式。有一個 directory 記錄每份 data 的狀況：誰 share 它、有沒有被 update、誰可以寫。
- **Snooping**：沒有中央管理者。每個 cache 自己監看 interconnect（例如 bus）上經過的傳輸。

> **比喻** snoop 的意思是愛管閒事、到處探聽，就像史努比這隻狗整天東看西看。每個 cache 都盯著 bus，看別人在做什麼。

### Write invalidate

常用的是 **invalidating snooping protocol**：

- 要寫的 cache 必須先取得該 block 的 **exclusive access**（獨占權），不能兩個 cache 同時寫，否則分不出誰先誰後。
- 寫的同時在 bus 上 **broadcast**（廣播）一個 invalidate message。
- 其他 cache 一直在監看，看到後如果自己也有這份 copy，就把它 **invalidate**（作廢）。
- 之後誰讀到被作廢的 copy，就是 cache miss，向持有最新值的 **owner** 要資料。

### 例題：write-back cache 加 write invalidate

這個例子用 write-back cache，memory 裡 X 一開始是 0。

| 步驟 | processor 動作 | bus 上的動作 | A 的 cache | B 的 cache | memory X |
|---|---|---|---|---|---|
| 0 | | | – | – | 0 |
| 1 | A 讀 X | cache miss for X | 0 | – | 0 |
| 2 | B 讀 X | cache miss for X | 0 | 0 | 0 |
| 3 | A 寫 1 到 X | invalidate for X | 1 | invalid | 0 |
| 4 | B 讀 X | cache miss for X | 1 | 1 | 1 |

- 第 3 步：A 取得 exclusive access 後寫入並廣播 invalidate，B 看到就把自己的 X 作廢。因為是 write-back，memory 裡仍是舊的 0。
- 第 4 步：B 的 X 已經 invalid，所以 miss；它向 owner A 要資料，拿到 1，同時 memory 也更新成 1。

> **重點** snooping 的基本概念：大家各管各的；要寫時發出 invalidate，有 copy 的人就作廢；之後誰 miss，就去跟 owner 要最新的值。

## 真實例子：Intel 四核心的三層 cache

一顆 Intel 4-core processor 有三層 cache（L1、L2、L3），而前面的例子都只有一層。

| 層級 | 內容 | private 或 shared |
|---|---|---|
| L1 | 分成 I-cache（指令）與 D-cache（資料） | private：每個 core 各一份 |
| L2 | — | private：每個 core 各一份 |
| L3 | 8 MB | shared：四個 core 都來這裡拿 data |

現在的 multi-core 多半這樣設計：L1、L2 private，L3 shared。TLB 也做成兩層（2-level TLB）。Intel 和 AMD 的處理器在 TLB 與 cache 的 size、replacement 方式上各有不同，值得對照一下實際數字，對現今處理器的規模有個概念。

## Multiprocessor 與 out-of-order 怎麼評估

- **Multiprocessor**：很多 processor 同時 map 到同一個 cache 位置的機會變大，associativity 要增加。
- **Out-of-order superscalar**：雖然有 cache miss，只要還有別的指令 ready，functional unit 照樣在跑，miss 被 hide 在裡面，performance 不一定被拖垮。

> **陷阱** 在 out-of-order processor 上，不能只拿 cache miss 次數去算 performance；要用 simulation，看整體真正的平均時間。

## 結語：又快又大的 memory 錯覺

記憶體技術有一個躲不掉的取捨：快的 memory 一定小，大的 memory 一定慢。Memory hierarchy 和 caching 的做法，是把一小部分資料放在靠近 CPU 的 upper level，讓 CPU 看起來像擁有一個又快、又大的 memory。

這個錯覺成立的前提是 locality：程式在任何時刻只需要一小部分（它的 working window），只要把這部分搬到上層就夠了。階層可以疊很多層，光 cache 就有 L1、L2、L3，往下還有 main memory 和 disk；DRAM 本身也靠 burst mode 和 interleaving 拚頻寬。不論是 single processor 還是 multiprocessor，memory system 的設計都非常重要。

## 重點整理
- 記憶體層級：DIMM → rank → chip → bank → array → row × column → cell（1 bit）；rank = 一起回應同一讀寫請求的一組晶片（典型一面 8 顆）
- Memory channel = address bus 17 + command bus 6 + data bus 64 = 87 條；row/column 位址多工，可定址範圍遠大於 2¹⁷；ECC 時 data bus 72 bits
- SIMM：32-bit data bus、word = 4 bytes；DIMM：64-bit、word = 8 bytes；dual 精確意思是兩面接點訊號各自獨立
- 2,133 MT/s × 8 B = 17.064 GB/s；每個 word ≈ 0.469 ns；DDR 實際時脈 = 一半 = 1,066.5 MHz
- dual-channel 理論 × 2（34.128 GB/s）、quad-channel × 4（68.256 GB/s）；一條通道通常最多 2 條 DIMM；雙 rank ≠ 雙通道
- DDR：clock 上升緣、下降緣各傳一次；x8 晶片 × 8 顆 = 64 bits；晶片多容量大但耗電，晶片少（x16 × 4 顆）省電但 pin 多而貴
- 讀取：RAS 送 row address 開 row（慢，整排進 row buffer/sense amp）→ CAS 選 column（快）；一個 bank 一次只能開一個 row
- Burst：一個 row + 起始 column 連讀多個 column；BL：DDR2 4、DDR3 8、DDR4 8、DDR5 16；DDR3 一次 burst 8 × 8 B = 64 B（prefetching）
- 關 row = 寫回刷新 + bit line precharge，最多約 18 clocks；cache line 64 B = BL8 一次 burst = 4 clocks
- Bank interleaving：bank 輪流送 burst，條件為「輪一圈時間 ≥ 單一 bank 恢復時間」（示意 8 × 4 = 32 = 4 + 18 + 10）
- bank 多 → 平行度高、快，但周邊電路（decoder、sense amp、mux）吃面積 → 容量低；bank 少 → 容量高但 bit line 長、慢、耗電
- Memory interleaving 為了緩解 von Neumann bottleneck，避免 wait state；可做在 channel、rank、chip、bank 層，最基本是 bank
- 送位址 1、存取 5、回傳 1：非交錯 4 × 7 = 28（位址只送一次的課本算法 1 + 4×5 + 4×1 = 25）；4-bank 交錯 1 + 5 + 4×1 = 10；快 2.8 倍
- n-way interleaving = n 個 bank，選 bank 要 log₂ n bits
- Low-order：低位 bits 選 bank，連續位址分散 → 連續讀延遲重疊、負載平均；缺點 stride 存取 bank conflict（如 0、4、8、12 全在 bank 0）、壞一個 bank 全受影響
- High-order：高位 bits 選 bank，連續位址同一 bank → 適合共享記憶體多處理器、容錯好；缺點連續存取無法重疊
- 可結合：chip 層 high-order + bank 層 low-order；替代方案：加寬記憶體/bus（4 word 寬只要 1 + 5 + 1 = 7 cycles，但 bus 與 mux 貴）
- Virtual memory 的關鍵是讓多個 process（multiprogramming）安全 share 同一塊 physical memory；每個 process 有自己完整的 virtual address space（例 2³² bytes），靠 locality 只搬用到的 page
- 不在 memory 的 page 放在 disk 的 swap space；main memory 就是 disk 的 cache
- Disk 上一塊叫 page、memory 裡的位置叫 frame，兩者一樣大（通常 ≥ 1 KiB）
- Miss penalty 上百萬 cycle → page 很大、用 fully associative（降低 page fault）、由 OS 軟體管理
- Virtual address = VPN | page offset；只翻譯 VPN → frame number，offset 原樣照抄（例：page 5 → frame 3，offset 0x2A4 → PA = 3 × 4096 + 0x2A4 = 0x32A4）
- Virtual space 可以比 physical 大（例 2³⁶ vs 2³⁴，差 4 倍）；physical 大小由 hardware 決定
- Page table：memory 裡的 array，VPN 當 index，起點在 page table register（從 100 開始時 VPN 38 在 138）；每個 process 一張，由 OS 管
- PTE 欄位：frame number、valid、reference、dirty；invalid 時指向 disk 的 swap area → page fault
- Page fault：硬體偵測（valid = 0），OS 處理；process 被 context switch，IO 完成後 interrupt、回 ready queue、resume
- OS 處理 page fault：有空 frame 直接放；滿了 replace（dirty 的先寫回）→ 讀入 page → update page table → resume
- Replacement：近似 LRU，用 reference (use) bit：用到設 1、換時挑 0、定期全部清 0
- Virtual memory 一定 write back（不可能 write through），dirty bit 在 PTE，改過的 page 換出時才寫回
- Page table 兩個問題：太大、每次存取要兩次 memory access
- 32-bit VA、4 KiB page、4 B/entry：2²⁰ entries × 4 B = 4 MiB（每個 process 一份）
- 縮小 page table：bound/limit register（stack 往下長、heap 往上長 → 兩個 limit register）、hashing（inverted page table）、multi-level page table
- Inverted page table 大小 ∝ physical frame 數（28-bit VA、4K page → 64K page；16K frame → 只要 16K entry）；collision 用 chaining 或 linear probing，entry 要記 page number
- Two-level page table：用到的塊才展開第二層；4-bit page number 拆 2|2、只用 2 塊 → 4 + 2 × 4 = 12 個 entry（全展開 16）
- Page table 在 memory：沒有 TLB 時每次存取要 2 次 memory reference（一次查 page table、一次拿資料）
- TLB（translation look-aside buffer）= translation 的 cache，硬體實作，位於 CPU 端的 MMU；可為 fully 或 set associative
- TLB miss rate 只有 0.01%～1%（page 大、locality 高）；TLB miss 可由硬體或 OS（軟體）處理
- TLB hit 時 write：dirty bit 先記在 TLB，TLB entry 被換掉時才寫回 page table
- TLB miss 兩種：page 在 memory（從 page table 補 entry）／page 不在 memory（page fault）；TLB miss ≠ page fault
- TLB hit + cache hit → 一次 memory access 都不用；基本流程 VA → TLB → PA → cache，是 sequential
- Write 先檢查 write access，沒有就是 write protection exception
- Cache miss：硬體處理、CPU stall；page fault：OS 處理、context switch（上百萬 cycle）
- 不可能的組合：TLB hit 而 page table miss；page table miss 而 cache hit
- Cache 用 physical address（unique），所以要先翻譯再查 cache
- Virtually addressed cache：可同時做，但要在 tag 加 process ID，且 aliasing（多個 VA 指同一 PA）要硬體維持一致
- Virtually indexed, physically tagged：index + block offset 的 bit 數 ≤ page offset 的 bit 數；cache miss 且 TLB hit → 1 次 memory access，兩者都 miss → 2 次
- Memory protection：page table 等只有 OS 在 supervisor（kernel）mode 能動；user 透過 system call 進 kernel mode
- 四個問題：placement（direct = 1-way、n-way、fully = 1 個 set）、finding（比 1／n／全部 tag；VM 用 page table 直接 index）、replacement（LRU、approximation 如 reference bit、random）、write（write through + write buffer／write back + dirty；VM 一定 write back）
- Associativity ↑：miss rate ↓ 但好處遞減，cost 與 access time ↑
- 3C：compulsory（cold start）、capacity、conflict（collision）；在 fully associative 下不會發生的 miss 才是 conflict miss
- Cache size ↑ → capacity miss ↓、access time ↑；associativity ↑ → conflict ↓、access time ↑；block size ↑ → miss rate ↓、miss penalty ↑
- Cache size 固定、block 太大 → block 數變少 → conflict ↑，miss rate 反而上升
- 趨勢：synchronous SRAM／DRAM burst 與高 bandwidth、restructure code 增加 locality、prefetching
- 題目位址通常是 byte address；size = 2ᵏ 就扣掉 k 個 low-order bits：32-bit 下 word(4B) address 30 bits、block(32B) address 27 bits、page(4 KiB) number 20 bits
- row major 存放時依 row 存取 locality 好；依 column 存取每次跳一整個 row，miss 暴增（示意：4×4、block 4 element、cache 2 block → 4 次 miss 對 16 次 miss）
- Cache controller 沒有 instruction，control 取決於 state + input → 用 finite state machine
- 簡單 cache 例：direct mapped、write-back、write allocate、16 KiB、block 16 B（1024 blocks）、blocking → tag 18 | index 10 | offset 4
- Controller 介面：CPU↔cache 的 data 32 bits；cache↔memory 的 data 128 bits（一個 block 4 words），memory Ready 可能要好幾個 cycle
- 四個 state：Idle → Compare Tag →（hit 回 Idle；miss+dirty → Write-Back → Allocate；miss+clean → Allocate）→ Allocate 完回 Compare Tag（hit）→ Idle
- Write allocate：write miss 也要先把整個 block 讀進來，回 Compare Tag 後才寫入並 set dirty；write no-allocate 只改 memory
- FSM 合成：4 個 state 用 ⌈log₂ 4⌉ = 2 個 flip-flop 當 state register；combinational logic 由 input + present state 產生 control signals 與 next state；某 state 太重會拉長所有 cycle，可拆成兩個 state
- Cache coherence：讀一個 location 要讀到最近寫入的值；三條：同 processor 寫後讀、別人寫後經足夠時間再讀、同一 location 的 write 要 serialized 且大家看到同一順序
- Coherence protocol：directory-based（集中記錄誰 share）、snooping（各 cache 監看 bus）
- Write invalidate：寫者取得 exclusive access 並 broadcast invalidate，其他 copy 作廢；之後 miss 向 owner 拿最新值（write-back 時 memory 此時才更新）
- Intel 4-core：L1（I/D 分開）、L2 private，L3 8 MB shared；TLB 也是 2-level
- Multiprocessor 要提高 associativity；out-of-order 可 hide miss，不能只用 miss 次數算 performance，要用 simulation

## 名詞對照
| 中文 | English |
|---|---|
| 雙列直插記憶體模組 | DIMM (dual inline memory module) |
| 單列直插記憶體模組 | SIMM (single inline memory module) |
| 記憶體通道 | memory channel |
| 記憶體控制器 | memory controller |
| 位址匯流排 | address bus |
| 命令／控制匯流排 | command / control bus |
| 資料匯流排 | data bus |
| 位址多工 | address multiplexing |
| 錯誤更正碼 | ECC (error-correcting code) |
| 字組 | word |
| 單通道／雙通道／四通道 | single- / dual- / quad-channel |
| 雙倍資料速率 | DDR (double data rate) |
| 上升緣／下降緣 | rising edge / falling edge |
| 列位址選通 | RAS (row address strobe) |
| 行位址選通 | CAS (column address strobe) |
| 感測放大器 | sense amplifier |
| 列緩衝區 | row buffer |
| 輸出緩衝區 | output buffer |
| 突發傳輸 | burst |
| 突發長度 | burst length |
| 預取 | prefetching |
| 預充電 | precharge |
| 快取區塊 | cache line |
| 解碼器 | decoder |
| 多工器 | multiplexer |
| 位元線 | bit line |
| 馮紐曼瓶頸 | von Neumann bottleneck |
| 記憶體交錯 | memory interleaving |
| bank 交錯 | bank interleaving |
| 等待狀態 | wait state |
| 低位交錯 | low-order interleaving |
| 高位交錯 | high-order interleaving |
| n 路交錯 | n-way interleaving |
| bank 衝突 | bank conflict |
| 共享記憶體 | shared memory |
| 虛擬記憶體 | virtual memory |
| 多工 | multiprogramming |
| 行程 | process |
| 位址空間 | address space |
| 虛擬位址 | virtual address |
| 實體位址 | physical address |
| 位址轉換 | address translation |
| 交換區 | swap space / swap area |
| 頁 | page |
| 頁框 | frame / page frame |
| 缺頁 | page fault |
| 分頁 | paging |
| 分頁表 | page table |
| 分頁表項目 | page table entry (PTE) |
| 分頁表暫存器 | page table register |
| 虛擬頁號 | virtual page number (VPN) |
| 實體頁框號 | physical frame number |
| 頁內位移 | page offset |
| 有效位元 | valid bit |
| 參考位元 | reference bit / use bit |
| 髒位元 | dirty bit |
| 最近最少使用 | least recently used (LRU) |
| 寫回 | write back |
| 寫穿 | write through |
| 全關聯 | fully associative |
| 中斷 | interrupt |
| 環境切換 | context switch |
| 就緒佇列 | ready queue |
| 界限暫存器 | bound register / limit register |
| 雜湊 | hashing |
| 碰撞 | collision |
| 鏈結法 | chaining |
| 線性探測 | linear probing |
| 反向分頁表 | inverted page table |
| 兩層分頁表 | two-level page table |
| 多層分頁表 | multi-level page table |
| 轉譯後備緩衝區 | translation look-aside buffer (TLB) |
| 記憶體管理單元 | memory management unit (MMU) |
| 位址轉譯 | address translation |
| 實體頁號 | physical page number |
| 分頁錯誤 | page fault |
| 停頓 | stall |
| 寫入保護例外 | write protection exception |
| 循序 | sequential |
| 虛擬位址快取 | virtually addressed cache |
| 行程識別碼 | process ID |
| 別名 | aliasing |
| 一致性 | consistency |
| 虛擬索引、實體標籤 | virtually indexed, physically tagged |
| 記憶體保護 | memory protection |
| 監督模式／核心模式 | supervisor mode / kernel mode |
| 系統呼叫 | system call |
| 置換空間 | swap space |
| 區塊放置 | block placement |
| 寫入緩衝區 | write buffer |
| 強制性 miss（冷啟動 miss） | compulsory miss (cold start miss) |
| 容量 miss | capacity miss |
| 衝突 miss | conflict miss (collision miss) |
| 頻寬 | bandwidth |
| 預先抓取 | prefetching |
| 區域性原理 | principle of locality |
| 位元組位址 | byte address |
| 字組位址 | word address |
| 區塊位址 | block address |
| 頁號 | page number |
| 列優先 | row major |
| 行優先 | column major |
| 有限狀態機 | finite state machine (FSM) |
| 寫入配置 | write allocate |
| 不配置寫入 | write no-allocate |
| 阻塞式快取 | blocking cache |
| 快取控制器 | cache controller |
| 狀態暫存器 | state register |
| 目前狀態／下一狀態 | present state / next state |
| 組合邏輯 | combinational logic |
| 快取一致性 | cache coherence |
| 序列化 | serialized |
| 搬移／複製 | migration / replication |
| 窺探協定 | snooping protocol |
| 目錄式協定 | directory-based protocol |
| 作廢 | invalidate |
| 獨占存取 | exclusive access |
| 廣播 | broadcast |
| 私有快取／共享快取 | private cache / shared cache |
| 亂序執行 | out-of-order execution |
| 超純量 | superscalar |
