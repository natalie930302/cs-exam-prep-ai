# I/O 與中斷

CPU 和鍵盤、磁碟這些周邊裝置（peripherals）之間怎麼傳資料，有三種方式（modes of transfer）：programmed I/O、interrupt-initiated I/O、DMA。三者的差別在於 CPU 要花多少時間在 I/O 上。資料在 memory、CPU、I/O 之間跑，靠的是共用的 bus；好幾個裝置同時要用 bus 時，由 bus arbitration 決定先給誰。考試常考三種 I/O 方式的比較、interrupt 的處理流程，以及三種 bus 仲裁方式的線數、速度與公平性。

## 學完這章要會
- 說出資料傳輸真正的 source 與 target 是 memory，CPU 只負責處理與轉手
- 比較 programmed I/O（polling，busy waiting）、interrupt-initiated I/O、DMA 的流程與 CPU 負擔
- 寫出 interrupt 的處理流程：command → interface 監看 → interrupt request → 暫停 → ISR → resume
- 分清 exception 與 interrupt
- 說明 DMA 的 bus request／bus grant、cycle stealing、burst mode，以及它的優缺點（含 cache coherence 問題）
- 比較 daisy chain、polling、independent request 三種 bus arbitration：用哪些線、怎麼決定優先權、優缺點

## 資料傳輸的大前提：memory 是起點和終點

電腦處理的全是 binary（二進位）資訊，也就是一串 0 和 1；周邊裝置送來的資料也一樣。

- 從外部裝置收進來的資料，最後一定存進 memory（記憶體）。
- CPU 要送給外部裝置的資料，也是先從 memory 拿出來，經過 CPU，再送到裝置。
- CPU 在這裡只負責「處理」和「轉手」，它不是資料的老家。

> **重點** 資料傳輸真正的 source（起點）和 target（終點）永遠是 memory unit。記住這句，就懂為什麼 DMA 可以把 CPU 跳過去。

資料既然是在 memory 和 I/O 之間跑，「怎麼跑」就有幾種做法，每一種叫一個 mode：

- 有的 mode 讓 CPU 當中間人：資料先從裝置進 CPU，再由 CPU 寫進 memory。
- 有的 mode 不經過 CPU：資料直接在 memory 和 I/O 之間傳。

具體有三種：

1. Programmed I/O
2. Interrupt-initiated I/O（由中斷發動的 I/O）
3. DMA（Direct Memory Access，直接記憶體存取）

## Programmed I/O：CPU 一直 polling

Programmed I/O 是最簡單的 I/O 做法。「programmed」的意思是：整個傳輸都寫在程式裡、由程式控制。

- CPU 包辦所有工作，沒有任何幫手。
- 資料在 processor 和 I/O module（裝置的介面）之間傳，一定要經過 CPU。
- I/O 指令寫在程式裡，每一筆資料傳輸都由程式中的一條指令發動；一般來說，資料是在 CPU 暫存器和 memory 之間搬。

下面是用 MIPS 組合語言寫法的示意：先讀裝置狀態，還沒好就跳回去再讀；好了就讀資料，再存進 memory。

```
loop: lw   $t0, status      # 讀裝置狀態
      beq  $t0, $zero, loop # 還沒 ready（status = 0）就跳回去再問
      lw   $t1, data        # ready 了：把資料讀進暫存器 $t1
      sw   $t1, buffer      # 再把 $t1 存進 memory
```

CPU 不知道裝置什麼時候準備好，只好一直去問，這叫 **polling**（輪詢）：第一次問，status 是 0，還沒好，`beq` 跳回 loop 再問；ready 了沒？還沒。ready 了沒？還沒……

監看期間 CPU 不能做別的事，其他程式分不到 CPU，只能乾等。

> **例題（示意）** 假設 160 個 cycle 裡來 8 筆資料，用 programmed I/O：
> CPU 整條時間軸不是在 polling，就是在搬資料，沒有空檔。
> CPU 能拿去做別的事的時間 = 0 / 160 = **0%**。

- 優點：容易實作，需要的硬體很少，不用額外的控制電路。
- 缺點：**busy waiting**（忙碌等待）。CPU 看起來很忙，其實一直在等裝置 ready，長時間被綁住，卻沒產生有用的結果。

### Polling 的 CPU 負擔怎麼算

polling 佔 CPU 的比例：

```
每秒花在 polling 的 cycles = 每秒 poll 次數 × 每次 poll 的 cycles
polling 佔 CPU 的比例     = 每秒花在 polling 的 cycles ÷ clock rate
```

而且不論裝置忙不忙，都得一直 poll，這正是它浪費的地方。

> **例題（示意）** 某裝置每秒要 poll 30 次，每次 poll 花 400 個 cycle，處理器 clock rate 500 MHz。
> 每秒花在 polling 的 cycles = 30 × 400 = 12,000 cycles
> 佔 CPU 比例 = 12,000 ÷ 500 × 10⁶ = 0.0024%
> 這種慢速裝置的負擔很小；裝置越快、每秒要 poll 的次數越多，負擔就越大，而且裝置閒著時也照樣要 poll。

## Interrupt-initiated I/O：裝置好了才叫 CPU

**interrupt**（中斷）就是「打斷」：正在做的工作被暫停，先去處理別的事，處理完再回來把原本的工作接著做完，這叫 **resume**。

> **比喻** 寫作業寫到一半接了一通電話，講完回來繼續寫，前面寫的不用重來。

它解決了 programmed I/O 的限制：CPU 不必一直監看周邊裝置。

### Interrupt 的處理流程

1. CPU 先送一個特別的 command 給 I/O interface，意思是「資料好了你再發 interrupt request 通知我」。
2. 在等的這段時間，CPU 繼續執行其他程式，不用乾等。
3. 一直監看裝置的是 **interface**（介面電路），不是 CPU。
4. 裝置的資料 available（準備好）時，interface 才送出 **interrupt request**（簡稱 IRQ）。只有 ready 才會發。
5. CPU 看到 interrupt request，先把目前正在執行的工作（主程式）停下來。
6. CPU 去服務這個請求：把裝置的資料搬進來、存進 memory。處理中斷的這段程式叫中斷服務程式（ISR，interrupt service routine）。
7. 處理完，CPU 回到剛才被打斷的主程式，繼續做完（resume）。

> **例題（示意）** 同樣 160 個 cycle 裡來 8 筆資料，改用 interrupt：
> 8 筆資料各中斷一次，每次 6 個 cycle → CPU 只忙 8 × 6 = 48 cycles。
> 剩下 160 − 48 = 112 cycles 可做別的事：112 / 160 = **70%**。
> 從 0% 到 70%，差別就在 CPU 不用一直監看。

### Exception 與 interrupt 要分開記

- **Exception**（例外）：發生在 CPU 內部，由正在執行的指令引起，例如 overflow、未定義的指令。
- **Interrupt**（中斷）：來自 CPU 外部的事件，例如 I/O 裝置發出的 interrupt request。

在 MIPS 裡兩者處理的步驟相同：把 EPC（exception program counter，記下回來時要用的指令位址）和 Cause（記錄原因）存起來，再跳到 handler。但兩者 EPC 指向的指令不同，所以兩種流程要分開記。

> **陷阱** 不要把 exception 和 interrupt 的處理流程混成一套：一個是內部、由執行中的指令引起；一個是外部、由裝置引起。

## 前兩種方式共同的缺點

把 programmed I/O 和 interrupt-initiated I/O 放在一起比，兩者都有兩個主要缺點：

1. **處理器要管理每一筆 I/O 傳輸**，每次 I/O 都要執行好幾條指令。例如傳 4 個 word（一個 word 是一筆固定大小的資料），每個 word 各要一條 `lw`、一條 `sw`，共 8 條指令，全落在 CPU 頭上。
2. **I/O 傳輸率受限於處理器處理資料的速度**：資料一定要經過 CPU，所以 I/O 最多只能跟 CPU 搬資料一樣快，資料在 interface 前排隊等 CPU。

這兩個缺點由第三種方式 DMA 解決。

## DMA：CPU 只發動，資料直接進 memory

DMA（Direct Memory Access）把負責搬運的 interface 換成 **DMA controller**，它透過 memory bus 直接把資料搬進或搬出 memory。資料在 memory 和 I/O 之間直接傳，不用每一筆都麻煩 CPU，CPU 可以做自己的事。

- CPU 只負責**發動**傳輸：把起始位址（從哪裡開始放）、要傳幾個 word 等資訊告訴 DMA controller，之後就放手。
- 特別適合快速的儲存裝置，例如磁碟（magnetic disk）、磁帶（magnetic tape），因為它們一次要傳一大塊資料。
- DMA 讓周邊裝置透過 memory 直接交換資料：精確地說，是裝置直接和 memory 交換資料。

### 傳輸過程：bus request、bus grant、cycle stealing

1. DMA 透過 memory bus 要求一個 memory cycle（使用 bus 的一小段時間），這叫 **bus request**。
2. 請求被允許（**bus grant**）後，DMA 直接把第一個 word 寫進 memory。同時，它暫存器裡的位址往後移一格，剩下要傳的數量減 1。
3. 這時 CPU 如果也要用 memory，只要稍等一下：CPU 只是**延後**自己的 memory 存取。這叫 **cycle stealing**（偷 cycle）：DMA 偷用 bus 一個 cycle，CPU 只被耽誤一點點。
4. 剩下的 word 也一樣，每傳一個偷一個 cycle。

> **例題（示意）** CPU 告訴 DMA controller：起始位址 A000，傳 4 個 word（位址以 word 為單位）。

```
傳完第幾個   寫入位址   位址暫存器（下一個）   剩餘數量
開始          —         A000                  4
1             A000      A001                  3
2             A001      A002                  2
3             A002      A003                  1
4             A003      A004                  0（傳完）
```

在 DMA 傳輸的那一刻，bus 由 DMA controller 掌控，CPU 沒有 memory bus 的控制權。這時 CPU 常被說成 idle；更精確的說法是：CPU 不能用 bus，但不需要 bus 的工作照樣能做。

DMA 傳完一整塊後，會發一次中斷通知 CPU。所以 DMA 只在**開頭（設定）**和**結尾（中斷）**打擾 CPU。

> **例題（示意）** 同樣 160 個 cycle 裡傳 8 個 word，改用 DMA：
> 開頭設定 10 cycles ＋ 每個 word 偷 1 cycle（8 cycles）＋ 結束時中斷一次 6 cycles = 24 cycles。
> CPU 自由的時間 = (160 − 24) / 160 = 136 / 160 = **85%**。

另一種做法是 **burst mode**：DMA 一次佔住 bus，把整塊資料傳完才還給 CPU。

### 三種方式比一比（同一個示意模型）

| 方式 | 誰監看裝置 | 資料經過 CPU？ | CPU 被佔用 | CPU 自由時間 |
|---|---|---|---|---|
| Programmed I/O | CPU 一直 polling | 是 | 160 / 160 | 0% |
| Interrupt-initiated I/O | interface | 是（ISR 搬） | 8 × 6 = 48 | 70% |
| DMA | DMA controller | 否，直接進 memory | 10 + 8 + 6 = 24 | 85% |

### DMA 的優缺點

- 優點一：周邊可以直接讀寫 memory，不需要 CPU 參與。
- 優點二：資料傳輸的同時，處理器可以去做別的事，整體處理更快。
- 缺點一：要多一顆 DMA controller 來搬資料，增加系統成本。
- 缺點二：可能產生 **cache coherence**（快取一致性）問題。

> **例題（示意）** CPU 的 cache 裡存著 X = 5。DMA 直接把 memory 裡的 X 改成 9，cache 不知道，還是舊的 5：同一個 X，兩邊對不上。

> **重點** DMA：快、讓 CPU 自由；代價是控制器的成本，以及 cache 可能拿到舊資料。

## Bus arbitration：誰先用 bus

system bus 由三種 bus 組成：

- **data bus**：傳資料
- **address bus**：傳位址
- **control bus**：傳控制訊號

**arbitration**（仲裁）就是決定現在誰可以用 bus 來讀或寫。為什麼需要？一條 bus 接著很多裝置，好幾個裝置（D1、D2、D3）可能同時都想用 bus，但**同一時間 bus 只能服務一個裝置**：D1 的資料上了 bus，D2、D3 就得等。所以要有人決定先給誰。

> **比喻** arbitration 像一個 master（老大），由它決定哪個裝置先存取。

好的仲裁方式要在兩件事之間取得平衡：

- **bus priority**（優先權）：優先權最高的先服務，再輪到低的。
- **fairness**（公平）：每個裝置都有機會被服務到，不會有人永遠排不到。

有三種仲裁機制，各自用一些特別的 control lines；目標一樣是依優先權服務裝置，只是規則不同：

1. daisy chain（菊鍊）
2. polling（輪詢）
3. independent request（獨立請求）

## Daisy chain：grant 一台傳一台

名字的意思是：裝置像花圈一樣，一個串著一個。

- 做決定的只有一個角色：**bus master**。不管哪個系統，master 只有一個。
- 裝置 D1、D2、D3 接到三條控制線：
  - **BR（bus request）**：大家共用。
  - **BUSY（bus busy）**：大家共用。
  - **BG（bus grant）**：最特別，從 master 出發，一台串一台經過 D1、D2、D3。

```
            BR（共用） ─────────┬─────────┬─────────┐
            BUSY（共用）────────┼─────────┼─────────┤
 bus master ── BG ──> [D1] ── BG ──> [D2] ── BG ──> [D3]
```

### 運作步驟（假設三台都要用 bus）

1. 想用 bus 的裝置把 BR 拉起來，告訴 master「有人要用」。
2. master 確認 bus 空閒：BUSY 線是 0，現在沒人在傳資料。
3. 優先權由**位置**決定：離 master 越近越高。D1 最高、D3 最低。
4. master 送出 grant，grant 先到 D1。D1 有請求，就把 grant 攔下來，不往下傳。
5. D1 拿到 bus，同時拉起 BUSY，告訴大家「我在用」，其他裝置就不能再要。
6. D1 用完釋放 bus（BUSY 放下）。下一次 grant 經過 D1，D1 已經沒有請求，就把 grant 往下傳。
7. 下一個有請求的 D2 拿到 bus；D2 用完，grant 再一路傳到 D3。

服務順序 D1 → D2 → D3，一個接一個，像一條鏈。

> **重點** 裝置只有在**自己沒有請求**時，才把 grant 往下傳。

### 優缺點

- 優點：構造非常簡單，線也很少。
- 缺點一：**不能保證 fairness**。快輪到最後一台時，可能又有高優先權的裝置插進來，低優先權裝置可能被無限期擋在外面。
- 缺點二：**慢**。grant 要一台一台傳，到 D3 得經過三站，鏈越長越慢，限制了 bus 的速度。

> **例題（示意）** D3 一直在等，但 D1、D2 每次用完馬上又請求。grant 總是先經過 D1、D2：

| 輪次 | 有請求的裝置 | grant 被誰攔下 |
|---|---|---|
| 1 | D1、D2、D3 | D1 |
| 2 | D1、D2、D3 | D1（又請求了） |
| 3 | D2、D3（D1 剛用完） | D2 |
| 4 | D1、D2、D3 | D1 |

> **陷阱** 連續 4 輪 D3 一次都沒輪到。這種「永遠等不到」叫 **starvation**（飢餓）；daisy chain 離 arbiter 越遠的裝置越容易 starvation。

## Polling：master 用 ID 一個個問

拼法 p-o-l-l-i-n-g。它很像 daisy chain，差別是：**沒有那條一路串下去的 bus grant**，改由 master 決定先服務誰。

> **陷阱** 這裡的 polling 是 bus 仲裁的方法，和前面 programmed I/O 裡「CPU 一直問裝置好了沒」的 polling 是兩回事。

用到三種線：

- **poll lines**：一組線（可以有好幾條），取代原本的 grant 線，上面放裝置的 **ID**。
- **bus request**
- **bus busy**：有人在用 bus 時拉起來。

3 台裝置用 ID 1～3，2 條 poll lines 就夠，因為 2 個 bit 最多可以表示到 3。

### 運作步驟（假設 D2、D3 想用）

1. bus 不忙時，想用的裝置向 master 發 bus request。
2. master 把裝置 ID 一個個放上 poll lines 去問：ID 1 的 D1 沒有請求；ID 2 的 D2 有請求，就回應 master。
3. 拿到 bus grant 的 D2 把 bus 標成 busy，開始使用。

每台裝置都有自己的 ID，master 依 ID 決定先服務誰，一切由 master 說了算。

### 優缺點

- 優點：daisy chain 的缺點（不公平、慢、最低優先權可能一直等）這裡都沒有。因為每台有 ID，master 能決定從哪個 ID 問起。例如上次服務了 D2，這次從 ID 3 開始問，D3 就先被服務，不會無限期等待。
- 缺點一：要多幾條 poll lines；daisy chain 只要一條 grant 線。
- 缺點二：master 一台一台 poll 也要時間，所以跟 daisy chain 的 grant 一樣有延遲。

## Independent request：每台自己一對線

名字就說明了：每個裝置彼此獨立。master 和每台裝置之間都有**自己的 request 線（R）**和**自己的 grant 線（G）**，外加一條大家共用的 **BUSY**。

```
 bus master ──R1/G1── [D1]
            ──R2/G2── [D2]
            ──R3/G3── [D3]
            ──BUSY（共用）── D1、D2、D3
```

### 運作過程

- D1 準備好，從自己的 R1 送出請求；bus 正空著，master 從 G1 回覆，D1 拿到 bus。
- D2 也從 R2 請求，但 bus 還被 D1 佔著，就先等；D1 釋放後，master 才送 G2。
- D3 從 R3 請求，等 bus 空出來，master 就把 G3 給 D3。
- 共用的 BUSY 線：誰在用 bus，誰就把它拉起來，別人一看就知道要等。
- bus 忙的時候，裝置一定要等它被釋放。例如 D1 再請求，要等 D3 放掉 bus，master 才送 G1。
- 好幾台同時請求：master 一樣等 bus 空了才送 grant，並依優先權決定給誰（例如 D1 最高就先給 D1）。

整理步驟：

1. bus 不忙就送 bus request。
2. master 決定給誰，從該裝置的 grant 線通知。
3. 拿到 grant 的裝置標 bus busy。
4. 用完標 bus release（釋放）。

### 優缺點

- 優點：快，而且可以做 **dynamic priority**（動態優先權），優先權可以隨時調整。例如把 D3 調成最高，這次就先給 D3。
- 缺點：線太多。每台一條 request 加一條 grant，**N 個裝置要 2N 條線**；3 台就是 6 條。

## 三種仲裁方式比較

| 方式 | 專用控制線 | 優先權怎麼定 | 優點 | 缺點 |
|---|---|---|---|---|
| Daisy chain | BR、BUSY、一條串接的 BG | 離 master 越近越高（固定） | 構造簡單、線最少 | 不公平（starvation）、grant 逐台傳很慢 |
| Polling | BR、BUSY、一組 poll lines（放 ID） | master 依 ID 決定，可換起點 | 公平，不會無限期等 | 要額外 poll lines；逐一 poll 有延遲 |
| Independent request | 每台各一條 R、一條 G，加共用 BUSY | master 依 priority，可動態調整 | 最快、最有彈性 | N 台要 2N 條線 |

> **重點** 考比較題，就從**線數、速度、公平性**三個面向下手。

## 重點整理
- 資料傳輸真正的 source 與 target 永遠是 memory；CPU 只負責處理和轉手
- 三種 I/O：programmed I/O、interrupt-initiated I/O、DMA
- Programmed I/O：CPU 一直 polling，busy waiting；硬體簡單，但 CPU 被綁住
- Polling 負擔 = 每秒 poll 次數 × 每次 cycles ÷ clock rate；不論裝置忙不忙都得 poll
- Interrupt 流程：CPU 送 command → interface 監看 → 資料 ready 發 interrupt request → CPU 暫停 → 執行 ISR → resume
- Exception 來自 CPU 內部（執行中的指令，如 overflow、未定義指令）；interrupt 來自外部（I/O）；MIPS 都存 EPC、Cause 再跳 handler
- 前兩種的共同缺點：每筆傳輸都要 CPU 執行多條指令；傳輸率受限於 CPU 速度
- DMA：CPU 只給起始位址和 word 數；DMA controller 經 bus request／bus grant 直接寫 memory；cycle stealing；傳完發一次中斷
- DMA 只在開頭（設定）和結尾（中斷）打擾 CPU；burst mode 一次佔住 bus 傳完整塊
- DMA 期間 bus 由 DMA controller 掌控，CPU 不能用 bus
- DMA 缺點：要 DMA controller（成本）、可能有 cache coherence 問題
- 示意模型 160 cycles／8 筆：CPU 自由時間 programmed 0%、interrupt 70%、DMA 85%
- Bus arbitration 要平衡 priority 與 fairness；同一時間 bus 只服務一個裝置
- Daisy chain：BR、BUSY 共用，BG 串接；近 master 優先；沒請求才往下傳 grant；簡單但不公平、慢
- Polling（仲裁）：poll lines 放 ID，master 決定；公平但要額外線、有延遲
- Independent request：每台各一對 R/G 加共用 BUSY；快、dynamic priority；N 台 2N 條線

## 名詞對照
| 中文 | English |
|---|---|
| 周邊裝置 | peripheral |
| 傳輸模式 | mode of transfer |
| 程式控制 I/O | programmed I/O |
| 中斷驅動 I/O | interrupt-initiated I/O |
| 直接記憶體存取 | DMA (Direct Memory Access) |
| 輪詢 | polling |
| 忙碌等待 | busy waiting |
| 中斷 | interrupt |
| 中斷請求 | interrupt request (IRQ) |
| 中斷服務程式 | interrupt service routine (ISR) |
| 繼續 | resume |
| 例外 | exception |
| 介面 | interface |
| DMA 控制器 | DMA controller |
| 匯流排請求 | bus request |
| 匯流排允許 | bus grant |
| 偷 cycle | cycle stealing |
| 突發模式 | burst mode |
| 快取一致性 | cache coherence |
| 系統匯流排 | system bus |
| 資料匯流排 | data bus |
| 位址匯流排 | address bus |
| 控制匯流排 | control bus |
| 匯流排仲裁 | bus arbitration |
| 匯流排主控者 | bus master |
| 優先權 | priority |
| 公平性 | fairness |
| 菊鍊 | daisy chain |
| 輪詢線 | poll lines |
| 獨立請求 | independent request |
| 動態優先權 | dynamic priority |
| 飢餓 | starvation |
