# 平行與多核

要讓電腦更快，可以改指令集、做 pipelining，或用好幾顆處理器一起做（multiprocessor）。這章先用 Amdahl's law 回答「局部加強之後，整體快幾倍」，並看出處理器再多也有上限；接著看多核心各有 private cache 之後產生的 cache coherence problem，以及用 MSI／MESI 等狀態、snooping 與 directory 兩類硬體 protocol 解決它。Amdahl's law 的計算與 MESI 的四個狀態都是必考題。

## 學完這章要會
- 用正規化把總指令（總時間）當成 1，找出 f 和 s
- 推導並套用 Amdahl's law：speedup = 1 / ((1 − f) + f/s)
- 算 s → ∞ 時的上限 1 / (1 − f)，解釋處理器再多也有上限的原因
- 說明多核心 private／shared storage，以及 cache coherence problem 怎麼產生
- 寫出 M、E、S、I（以及 O、F）各狀態的意義與轉換
- 比較 write update 與 write invalidate、snooping 與 directory-based protocol

## Amdahl's law 在問什麼

把 CPU 的某個部分加強（enhancement）之後，整台 CPU「整體」快幾倍？回答這個問題的就是 **Amdahl's law**（Amdahl 定律），算出來的倍數叫 **speedup**（加速比）。

讓 CPU 變快的方法很多：

- 改良 **instruction set**（指令集），讓 CPU 認得更好用的指令。
- **pipelining**（管線化）：像生產線一樣，讓好幾個指令重疊執行。
- **multiprocessor system**（多處理器系統）：用好幾顆處理器一起做。

不管用哪一種方式增強，整體快多少都用同一條定律算。這類題目考試一定會出；先把幾個名詞弄懂，題目就很好解。

## 正規化：f 被增強、1 − f 不變

先看一顆還沒增強的舊 CPU，它要跑 n 個 instructions。不直接用 n，而是用 **normalized**（正規化）的指令數：把全部指令當成 1。

```
正規化 = 指令數 ÷ 總指令數
例：1000 個指令 ÷ 1000 = 1
```

實際上是 500 個還是 1000 個並不重要。這樣做是因為題目給「增強了多少」時，通常給百分比（20%、30%、50%）。若每次都換算（1000 個的 30% 是 300 個）很麻煩；總數當成 1，30% 直接寫 0.3。

增強後的 CPU 分成兩塊：

- **f**：被增強（enhanced）的比例。例如浮點指令占 20%，f = 0.2。
- **1 − f**：沒被增強（unenhanced）的比例。
- 兩塊加起來還是 1。
- **s**（scale）：被增強的部分快了幾倍。

問題就是：只有 f 這一塊快了 s 倍，整體會快幾倍？

## 舊時間 ÷ 新時間 = speedup

speedup 看的是時間的比值：舊 CPU 花多久、新 CPU 花多久。

- 舊 CPU：什麼都沒增強，正規化時間 = 1。
- 新 CPU 分兩塊：
  - 沒增強的那塊，時間和以前一模一樣：**1 − f**。
  - 增強的那塊快了 s 倍，時間剩原來的 1/s：**f/s**。

```
舊 CPU： [######## 1 − f ########][## f ##]          = 1
新 CPU： [######## 1 − f ########][f/s]             = (1 − f) + f/s
         （以 f = 0.2、s = 3 畫：0.8 + 0.067 ≈ 0.867）
```

新 CPU 的總時間 (1 − f) + f/s 比 1 少，所以比較快。注意：沒增強的 1 − f，在新舊兩邊花的時間完全一樣長，這一點就是後面「有上限」的原因。

```
overall speedup = 舊時間 / 新時間 = 1 / ((1 − f) + f/s)
```

這就是 Amdahl's law。

> **陷阱** 時間不變的是**沒增強**的那塊（1 − f），不是增強的那塊。分母是新時間 (1 − f) + f/s，千萬別寫成 (1 − f) + f × s。

## 處理器再多，也有上限

處理器加到上千顆，CPU 會快上千倍嗎？不會。程式裡 **serial**（序列）的那一段只能一步一步做，不能分給別的處理器，它花的時間跟舊 CPU 一樣。所以不是處理器越多就一直越快：多到某個數量之後，執行時間變成一個常數，不再下降。

> **例題（示意）** 一個程式在 1 顆 CPU 上要 1 ms，其中 90% 可以平行（f = 0.9）。用 n 顆處理器時，執行時間 = 0.1 + 0.9/n ms：

| 處理器數 n | 執行時間（ms） |
|---|---|
| 1 | 1 |
| 2 | 0.1 + 0.45 = 0.55 |
| 4 | 0.1 + 0.225 = 0.325 |
| 8 | 0.1 + 0.1125 = 0.2125 |
| 64 | 0.1 + 0.0140625 ≈ 0.114 |
| 256 | 0.1 + 0.0035156 ≈ 0.1035 |
| 1024 | 0.1 + 0.000879 ≈ 0.1009 |

一開始加到 2、4、8 顆，時間掉得很快；到 64、256、1024 顆幾乎不動了，因為被序列部分 1 − f = 0.1 ms 擋住，下不去。

同樣 f = 0.9，丟 1000 顆處理器：speedup = 1 / (0.1 + 0.9/1000) = 1 / 0.1009 ≈ **9.91**，遠小於 1000。

> **重點** s → ∞ 時，f/s → 0，speedup 的極限 = **1 / (1 − f)**。f = 0.9 時頂多 10 倍。

## 例題：浮點指令占 20%、快 3 倍

> **例題** 一顆常用在科學計算的處理器有 integer（整數）和 floating point（浮點）兩種指令。浮點指令改良成原來的 3 倍快，整數指令不變。程式裡 20% 是浮點指令，求整體 speedup。

```
10 格示意：[浮][浮][整][整][整][整][整][整][整][整]
```

1. 找 f：被增強的是浮點指令，占 20% → f = 0.2。
2. 找 s：快了 3 倍 → s = 3。
3. 套公式：speedup = 1 / ((1 − f) + f/s) = 1 / (0.8 + 0.2/3)。
4. 取 LCM 通分，分子分母同乘 3：分子 = 3，分母 = 3 × 0.8 + 0.2 = 2.4 + 0.2 = 2.6。
5. speedup = 3 / 2.6 ≈ **1.1538**。

浮點快了 3 倍，整台處理器只快了約 1.15 倍。就算浮點快到無限多倍，整體最多也只有 1 / (1 − 0.2) = 1 / 0.8 = **1.25** 倍。

> **重點** 只把一部分加速 s 倍，整體不會跟著快 s 倍；整體被沒加速的那部分限制住。

## 多核心的 private 與 shared storage

處理器一多，新的麻煩跟著來。先看一顆 dual-core（雙核心）處理器：

```
   [core 0]        [core 1]
   [L1]            [L1]        ← private
   [L2]            [L2]        ← private
   [        L3 cache       ]   ← shared
            │ system bus
   [      main memory      ]   ← shared
```

- 每個 core 的 **L1、L2** cache 是 **private**（私有），別的 core 用不到。
- **L3 cache** 和 **main memory** 是大家共用的，叫 **shared**。
- 處理器透過 **system bus**（系統匯流排）接到 main memory。

所以多處理器系統裡，每個 core 有自己的儲存，也有大家共用的儲存，問題就藏在這裡。

換一個簡化模型：四個處理器 P1～P4，每個只有一個 private cache；大家共用的 main memory 透過 system bus 接到每個處理器；四個 private cache 之間另有一條 **internal bus**（內部匯流排）互相連接。

```
 [P1]      [P2]      [P3]      [P4]
 [cache1]  [cache2]  [cache3]  [cache4]
    └──── internal bus（cache 之間）────┘
    └──────── system bus ───────────────┘
              [main memory]
```

## 例子：A = 7，四個處理器各改一次

main memory 裡的程式有一個 global variable（全域變數）A，初值 7，四個處理器都要處理同一個 A。這種「多個處理器處理同一份資料」有時被稱為 MISD（多指令流、單一資料流）；但依 Flynn 分類，共享記憶體的多核心其實屬於 **MIMD**。重點是：大家共用同一個 A。假設 cache 用 write back，改完晚點才寫回 memory。

1. P1 要做 A + 1：先找自己的 private cache，但這是第一次存取 A，cache 裡沒有，這叫 **compulsory miss**（第一次一定 miss）。P1 往下一層的 main memory 把 A = 7 帶進自己的 cache，加 1 → P1 的 A = 8。
2. P2 要做 A + 2：它的 cache 也沒有，只好去 main memory 拿。P1 只改了自己的 cache，memory 裡還是 7。P2 拿到 7，加 2 → 9。
3. P3 要做 A − 1：從 memory 拿 7 → 6。
4. P4 要做 A − 2：從 memory 拿 7 → 5。

| 步驟 | P1 cache | P2 cache | P3 cache | P4 cache | memory |
|---|---|---|---|---|---|
| 初始 | — | — | — | — | 7 |
| P1：A + 1 | 8 | — | — | — | 7 |
| P2：A + 2 | 8 | 9 | — | — | 7 |
| P3：A − 1 | 8 | 9 | 6 | — | 7 |
| P4：A − 2 | 8 | 9 | 6 | 5 | 7 |

同一個變數 A，四個 cache 裡分別是 8、9、6、5，memory 還是 7。同一份資料、不同地方的值不一樣，這叫 **inconsistency**（不一致），也就是 **cache coherence problem**。

> **陷阱** 這種多核心共用記憶體的組織，依 Flynn 分類是 MIMD，不是 MISD。

## Cache coherence 與 coherence problem

- **cache coherence**（快取一致性）：同一份共享資料放進好幾個 local cache 時，大家的值要保持一致（uniformity）。例如四個 cache 都是 7，就是一致的。
- **cache coherence problem**：某個處理器更新了自己那份副本（例如 P1 改成 8），其他 cache 要怎麼跟著同步？只要共享的值同時待在好幾個 private cache，就得保持同步，難在要一直維持住。
- 解法：**cache coherency protocol**（快取一致性協定），訂好一套規則，讓所有 private cache 保持一致。

## Cache line 的狀態：M、S、I

cache 在邏輯上切成一條一條的 **line**（也叫 block），每次搬資料以一條 line 為單位。為了維持一致，**cache controller**（管理 cache 的電路）替每一條 block 記一個狀態：

| 狀態 | 意義 |
|---|---|
| M（Modified） | 被自己的處理器改過，和 main memory 不一樣 |
| S（Shared） | 沒被改過，可以同時出現在一個以上的 cache |
| I（Invalid） | 別的處理器寫了這份資料，我手上的副本作廢，不能再用 |

> **重點** 一個 block 要同時出現在好幾個 cache，它一定得是 **Shared**。

### 套回 A = 7 的例子

| 事件 | P1 | P2 | P3 | P4 | memory | bus 上 |
|---|---|---|---|---|---|---|
| P1、P2 第一次從 memory 讀 A | S（7） | S（7） | I（沒有） | I（沒有） | 7 | — |
| P1 把 A 改成 8 | M（8） | I | I | I | 7 | P1 送出 invalidate |

- P1、P2 第一次從 memory 把 A 拿進來，狀態都設成 S。
- P1 要把 A 改成 8：它那條 line 從 S 升級成 M，同時在 bus 上送出 invalidate。因為是 write-back，memory 暫時還是 7。
- 從 P2 來看：別人先改了 A，為了一致，P2 那條 line 從 S 降成 I，下次要用 A 就得重新拿最新的值。

這三個狀態合起來就是 **MSI protocol**；「寫之前先讓別人的副本失效」就是 write invalidate 的做法。

## 其他狀態：Exclusive、Owned、Forward

除了 M、S、I，還可以加三種狀態：

- **E（Exclusive，獨占）**：這條 line 只在我的 cache，而且和 memory 一樣。別的處理器來讀時，就變成 S。例如 P1 自己讀 A 是 E；P2 也來讀，兩邊都變 S。M、E、S、I 四個狀態就是 **MESI** protocol。
- **O（Owned，擁有者）**：我是這份內容的負責人，別人來讀時由我提供資料。例如 P1 已把 A 改成 8（M），P2 來讀時 P1 變成 O，直接把 8 交給 P2，memory 還是舊的 7。這是 **MOESI**。
- **F（Forward，轉送）**：一種特殊的 Shared，負責把資料轉送給其他 cache。精確地說，在 Intel 的 **MESIF** 中，好幾個 cache 共享同一份資料時，由 F 那一份負責回應新的讀取，避免大家同時回應。例如 P3 來讀，由持有 F 的 P2 轉送，之後 F 交給最新拿到資料的 P3。

```
MESI 狀態轉換（本章例子出現過的）
  第一次讀，只有我有        → E
  E，別人也來讀             → S
  第一次讀，別人也有        → S
  自己寫（S 或 E）           → M，bus 上送 invalidate
  別人寫                     → I
  M，別人來讀（MOESI）       → O，由我供應資料
```

> **觀念** 一條 line 能有哪些狀態，取決於採用哪一種 protocol：MSI、MESI、MOESI、MESIF。

## 軟體 scheme 與硬體 protocol

解決 coherence problem 也有軟體做法，叫 **software-based cache coherence scheme**，只靠 compiler 和 OS：

- compiler 分析程式碼，找出哪些資料放進 cache 不安全（例如共享變數）。
- OS 在執行時，不讓這些資料被 cache。

> **陷阱** 軟體做法叫 **scheme**，不叫 protocol；硬體做法才叫 **cache coherency protocol**。

計算機組織的重點放在硬體 protocol，而且它的效能比軟體 scheme 好。硬體 protocol 分兩大類：**snooping**（bus-based）與 **directory-based**。

## Snooping：write update 與 write invalidate

snoop 就是偷聽。每個 cache 隨時監聽 bus：有處理器在 shared bus 上廣播一個請求，其他 cache controller 都聽得到，並據此管理自己的副本。

> **比喻** snooping 就是大家都在偷聽同一條 bus 上的廣播。

snooping 主要有兩種做法。假設四個 cache 都有 A = 7（S），P1 把 A 寫成 8：

| 做法 | P1 | P2 | P3 | P4 |
|---|---|---|---|---|
| write update（其他共享副本一起更新） | 8 | 8 | 8 | 8 |
| write invalidate（其他共享副本作廢） | 8（M） | I | I | I |

再配上 cache 的寫入策略：

- **write through**：寫 cache 時同時寫 memory → P1 寫 8 之後，memory 馬上是 8。
- **write back**：先只寫 cache，之後再寫回 → P1 寫 8 之後，memory 還是 7。

兩種做法 × 兩種寫入策略 = 四種組合：

1. write update + write-through
2. write update + write-back
3. write invalidate + write-through
4. write invalidate + write-back

> **重點** 實務上多數 snooping 系統採用 write invalidate + write-back，例如 MSI、MESI。

## Directory-based protocol

第二類硬體 protocol 是 **directory-based**（目錄式）：

- 維護一個集中的 **directory**，記錄每筆資料現在在哪些 cache。例如 A 在 P1、P3，directory 就記成 `[1 0 1 0]`（P1～P4 各一位）。
- 除了集中的目錄，每個處理器也有自己的 **private directory**，一起幫忙維持一致。

| | Snooping（bus-based） | Directory-based |
|---|---|---|
| 溝通方式 | broadcast（廣播） | point-to-point（點對點） |
| 連接 | 所有 cache 接在同一條 bus | 可擴充的互連網路 |
| P1 要寫 A（A 在 P1、P3） | 廣播給其他三個 | 只通知 P3 |

> **重點** cache coherency protocol 是解決 coherence problem 的**硬體**做法：snooping 靠廣播、大家偷聽；directory 靠目錄點名通知。

## 重點整理
- Amdahl's law：speedup = 舊時間 / 新時間 = 1 / ((1 − f) + f/s)
- 正規化：總指令（總時間）當 1；f = 被增強的比例，1 − f = 沒增強的比例，s = 增強的倍數
- 新時間 = (1 − f) + f/s；沒增強的 1 − f 時間不變；分母不是 (1 − f) + f × s
- 上限：s → ∞ 時 speedup → 1 / (1 − f)；f = 0.9 最多 10 倍（1000 顆處理器 ≈ 9.91）
- 處理器多到某數量後執行時間趨近常數（序列部分 1 − f）
- 例題：f = 0.2、s = 3 → 3 / 2.6 ≈ 1.1538；上限 1.25
- 多核心：L1、L2 private；L3、main memory shared
- cache coherence problem：同一份共享資料在各 private cache 值不一致（A：8、9、6、5，memory 7）
- 多核心共用記憶體依 Flynn 分類是 MIMD
- M：被自己改過、和 memory 不同；S：沒改過、可在多個 cache；I：作廢
- 要同時在多個 cache 就必須是 Shared
- E：只在我這裡且和 memory 一致，別人讀就變 S（MESI）
- O：擁有者，負責供應資料（MOESI）；F：多個共享者中負責回應讀取（MESIF）
- 軟體叫 scheme（compiler + OS），硬體叫 protocol；硬體效能較好
- Snooping（bus-based、broadcast）vs directory-based（目錄、point-to-point、可擴充）
- write update（大家一起改）vs write invalidate（別人作廢）；× write-through／write-back 共四種組合
- 實務上多採 write invalidate + write-back

## 名詞對照
| 中文 | English |
|---|---|
| Amdahl 定律 | Amdahl's law |
| 加速比 | speedup |
| 增強 | enhancement |
| 指令集 | instruction set |
| 管線化 | pipelining |
| 多處理器系統 | multiprocessor system |
| 正規化 | normalized |
| 序列的 | serial |
| 雙核心 | dual-core |
| 私有的 | private |
| 共用的 | shared |
| 系統匯流排 | system bus |
| 內部匯流排 | internal bus |
| 全域變數 | global variable |
| 強制失誤 | compulsory miss |
| 不一致 | inconsistency |
| 快取一致性 | cache coherence |
| 快取一致性問題 | cache coherence problem |
| 快取一致性協定 | cache coherency protocol |
| 快取控制器 | cache controller |
| 已修改 | Modified |
| 獨占 | Exclusive |
| 共享 | Shared |
| 無效 | Invalid |
| 擁有者 | Owned |
| 轉送 | Forward |
| 作廢 | invalidate |
| 窺探 | snooping |
| 寫入更新 | write update |
| 寫入作廢 | write invalidate |
| 寫穿 | write through |
| 寫回 | write back |
| 目錄式協定 | directory-based protocol |
| 廣播 | broadcast |
| 點對點 | point-to-point |
| 軟體方案 | software-based scheme |
| 多指令流多資料流 | MIMD |
| 多指令流單資料流 | MISD |
