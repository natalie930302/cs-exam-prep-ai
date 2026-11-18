# 指令集架構 ISA

ISA 是軟體與硬體之間的約定：處理器能執行哪些指令、operand 放哪裡、指令怎麼編成 32 bits。這章先補完效能的量法（加權 CPI、Amdahl's law、power、SPEC、晶片成本），再以 MIPS 為例，從算術指令、register 與 memory operand、R／I／J 三種 format，一路講到分支、迴圈、procedure call 與 stack、字串處理、32-bit 常數，以及 PC-relative 與 pseudo-direct 等定址模式。考試常考指令編碼（欄位逐一換成 bits）、branch／jump 目標位址的計算、定址模式比較，以及把 C 程式翻成 MIPS。

## 學完這章要會
- 用加權 CPI、Amdahl's law、SPECratio 與 geometric mean 比較效能，知道 MIPS 指標為什麼不可靠、power wall 怎麼來
- 算一片 wafer 上的 die 成本，說明面積與缺陷的影響
- 說明 MIPS 為什麼是 load-store、三個 operand、32 個 register，並寫出常用 register 的用途
- 把 C 的算式、陣列存取、if-else、while、遞迴函式翻成 MIPS assembly
- 把 R-format、I-format、J-format 指令逐欄編成二進位與十六進位
- 用 lb／lbu／sb 處理字元，寫出 strcpy；分辨 signed 與 unsigned 比較（slt／sltu）
- 依 caller／callee 慣例使用 `$t`、`$s`、`$ra`、`$sp`，畫出遞迴時 stack 的變化
- 用 lui + ori 做 32-bit 常數；算 beq 的 PC-relative offset（從 PC + 4 起算、以 word 為單位）與 j 的 pseudo-direct 目標
- 比較 immediate、register、base、PC-relative、pseudo-direct 等定址模式

## 效能怎麼量：response time、throughput 與 CPU time

要說一台電腦「效能好不好」，得先講好量的是什麼。就像比賽跑步，要先說清楚比的是時間，還是比誰跑得遠。

### 兩種標準

- **Response time（回應時間）**：一件工作（job）丟進電腦，到拿到結果總共花多久。越短越好。
- **Throughput（產出量）**：不管單一件事多快，而是看單位時間內總共做完多少工作，例如每秒完成幾個 job。

兩種都有用；這一章主要討論 response time，也就是「一件事要花多久」。

### 從牆上時鐘到 CPU time

用牆上的時鐘量（elapsed time），從丟進去到結果出來的時間其實混了很多東西：CPU 在算的時間、等 I/O（例如讀硬碟）的時間、還有閒著（idle）的時間。要評估 CPU 本身，就把 I/O、idle 拿掉，只算 CPU 真正在做事的時間，稱為 **CPU time**。

CPU 跟著 clock（時脈）一拍一拍做事，所以可以數這件工作總共跑了幾個 clock cycle，再乘上每一拍的長度 **clock period（clock cycle time）**：

```
CPU time = clock cycles 數 × clock period
         = clock cycles 數 ÷ clock rate
```

**Clock rate（clock frequency，時脈頻率）** 是每秒有幾拍，剛好是 clock period 的倒數；既然互為倒數，「乘 period」就等於「除以 rate」。

> **例題** 一件工作跑了 12 個 clock cycle，clock period = 0.5 ns。
> - CPU time = 12 × 0.5 ns = 6 ns。
> - Clock rate = 1 ÷ 0.5 ns = 2 × 10⁹ 拍／秒 = 2 GHz。
> - 用另一種寫法驗算：12 ÷ (2 × 10⁹ /s) = 6 × 10⁻⁹ s = 6 ns，結果相同。

## 從 clock 到指令：IC 與 CPI

數 clock 對寫程式的人太低階了。programmer 比較關心的是：我的程式有幾個指令？每個指令要多久？所以改從指令（instruction）的角度，用兩個量來描述：

- **IC（instruction count，指令數）**：程式總共執行了幾個指令。
- **CPI（clocks per instruction，又稱 cycles per instruction）**：平均一個指令要幾個 clock cycle 才做完。

### ISA 是軟硬體的約定

**ISA（instruction set architecture，指令集架構）** 是 software 和 hardware 之間的 interface（介面）：硬體照 ISA 實作，軟體照 ISA 開發。每個指令的複雜度不同，硬體的做法（organization）也不同，所以有的指令 1 拍做完、有的要 3 拍。把它們平均起來就是 CPI。

> **例題** 6 個指令依序佔用的 cycle 數加起來共 12 拍（每個指令佔幾格不一樣，例如 2、1、3……）。
> - 平均 CPI = 12 ÷ 6 = 2。
> - 反過來：IC × CPI = 6 × 2 = 12 個 cycle，跟直接數格子一樣。

### 效能公式

總 cycle 數 = IC × CPI，再乘每拍長度，就得到這一章最重要的公式：

```
CPU time = Instruction count × CPI × Clock cycle time
         = IC × CPI ÷ Clock rate
```

- IC 受 program（程式寫得好不好）、instruction set（指令集怎麼設計）、compiler（會不會把多餘的指令拿掉）影響。
- CPI 主要由硬體設計，也就是 **organization（組織、實作方式）** 決定。而且不同種類的指令 CPI 不同，要看程式裡各種指令佔多少，即 **instruction mix（指令組合）**，再算平均。

## 例題：同一個 ISA 的電腦 A 與 B

> **例題** 兩台電腦 A、B 的 ISA 相同。A 的 clock cycle time = 250 ps、CPI = 2.0；B 的 clock cycle time = 500 ps、CPI = 1.2。同一個程式，哪台比較快？快幾倍？

### 「ISA 相同」代表什麼

同一個程式、同一個 compiler 編出來的指令一模一樣，指令數也一樣，記作 **I**。那為什麼還是兩台不同的電腦？因為 organization 不同：就像都用 Intel 的指令集，卻用不同電路去實作。

- ps 是 picosecond，10⁻¹² 秒（兆分之一秒）。
- A 的 clock 快（每拍 250 ps），但每一拍能做的事少，一個指令平均要 2 拍。
- B 的 clock 慢（每拍 500 ps），但每一拍長、做得多，一個指令平均只要 1.2 拍。

### 計算

```
CPU time_A = I × 2.0 × 250 ps = I × 500 ps = 500·I ps
CPU time_B = I × 1.2 × 500 ps = I × 600 ps = 600·I ps
```

500·I < 600·I，所以 **A 比較快**：它每個指令要比較多拍，但每一拍短很多。

```
A 比 B 快幾倍 = Performance_A ÷ Performance_B
             = CPU time_B ÷ CPU time_A
             = 600·I ÷ 500·I = 1.2
```

I 消掉，A 比 B 快 1.2 倍。

> **陷阱** 問「誰快幾倍」，要把**慢的那台的時間放分子**、快的放分母（performance 是時間的倒數）。很容易放反。

> **陷阱** Clock 比較快不代表整體比較快，一定要連 CPI（還有 IC）一起算出 CPU time 再比。

## 依指令類別加權算 CPI

上一題直接給了平均 CPI。這個平均是怎麼來的？乘法和加法不會一樣快；load、store 還要跑到 memory 拿資料，更花時間。所以把指令分類，同一類的 CPI 相同，每一類有自己的 CPIᵢ：

```
Clock cycles = ∑ (CPIᵢ × ICᵢ)

平均 CPI = Clock cycles ÷ IC = ∑ CPIᵢ × (ICᵢ ÷ IC)
```

第二個寫法就是「每類 CPI × 它佔的比例」再加總，跟算學期總成績的加權平均一樣。

### 例題：兩個 compiler 產生的兩段序列

指令分 A、B、C 三類，CPI 分別是 1、2、3（C 類較複雜）。兩個 compiler 對同一段程式產生兩種指令序列：

| 類別 | CPI | Sequence 1 的 IC | Sequence 2 的 IC |
|---|---|---|---|
| A | 1 | 2 | 4 |
| B | 2 | 1 | 1 |
| C | 3 | 2 | 1 |
| 合計 IC | | 5 | 6 |

Sequence 1：

```
Clock cycles = 2×1 + 1×2 + 2×3 = 2 + 2 + 6 = 10
平均 CPI    = 10 ÷ 5 = 2.0
```

Sequence 2：

```
Clock cycles = 4×1 + 1×2 + 1×3 = 4 + 2 + 3 = 9
平均 CPI    = 9 ÷ 6 = 1.5
```

Sequence 2 的指令比較多（6 > 5），總 cycle 反而比較少（9 < 10），在同一台機器上它比較快。

> **陷阱** 「指令少」不等於「跑得快」。比的是總 cycle 數（再乘 cycle time），不是指令數。

## 誰影響 IC、CPI、clock rate

把 CPU time = IC × CPI × clock period 裡的三個量，對五件會影響效能的事一格一格檢查：

| | IC | CPI | Clock rate |
|---|---|---|---|
| Program | ✓ | ✓ | ✗ |
| Compiler | ✓ | ✓ | ✗ |
| ISA | ✓ | ✓ | ✗（常見教科書表格列為 ✓） |
| Organization | ✗ | ✓ | ✓ |
| Technology | ✗ | ✗ | ✓ |

ISA 是表上的分界線：**往上是 software，只影響 IC 和 CPI；往下是 hardware，才跟 clock rate 有關。**

### Program

- IC ✓：一個人寫 100 行、另一個人寫 50 行，或用不同的 algorithm，執行的指令數就不同。
- CPI ✓：用到的指令種類不同，平均 CPI 就不同（見下方問答）。
- Clock rate ✗：clock 多快是硬體做出來的，跟程式怎麼寫無關。

問：program 會影響 CPI 嗎？直覺可能答「不會」。
答：會。同樣的工作，一個寫法用一堆加法、另一個用乘法，用到的指令種類不同，每個指令的拍數就不同，平均 CPI 也就不同。

### Compiler

- IC ✓：compiler 把程式翻成指令，不同 compiler、有沒有做 optimization（最佳化），產生的指令數不同。
- CPI ✓：既然 compiler 決定了指令的種類和數量，CPI 跟著變。
- Clock rate ✗：那是硬體實作的事。

### ISA

假設一套指令集只有「加」和「shift（移位）」，沒有乘法：要做乘法就得用一堆加和 shift 湊出來；另一套有乘法指令，一個指令搞定。所以 ISA 影響 IC，也影響 CPI。

> **陷阱** ISA 是否影響 clock rate 有兩種版本：上表依分界線的說法打 ✗；常見教科書的表格打 ✓（指令越複雜，硬體越難做快）。考選擇題時要看題目依據哪個版本。

### Organization

ISA 定好以後，真的用硬體把加、減、乘這些指令做出來，這就是 organization。

- IC ✗：指令數在 program、compiler、ISA 那幾層就決定好了。
- CPI ✓：同一個 32-bit 加法，用 **carry ripple adder**（把 full adder 串起來）硬體少但慢；用 **carry lookahead adder**（像一棵樹，一大塊電路）硬體多但快。做法不同，要的 cycle 就不同。
- Clock rate ✓：每一拍設多長、每拍做多少事，都是硬體設計決定的。

### Technology

**Technology（製程技術）**：設計好之後拿到晶圓廠（例如台積電）做出來。製程進步，**feature size**（電晶體／線寬的尺寸）越做越小，電路跑更快：cycle 數一樣，但每個 clock period 變短了，所以影響 clock rate。

## Fallacy：用 MIPS 當效能指標

這裡的 MIPS 不是 MIPS 指令集，而是一個數字：**MIPS = million instructions per second**，每秒執行幾百萬個指令。常聽到「這台 3 MIPS、那台 5 MIPS」，直覺上 2 MIPS 的機器應該比 1 MIPS 的快。

問題是 MIPS 只數指令「個數」，不管每個指令有多複雜。

> **例題**（示意）同一個程式：A 機器指令簡單，要 1000 萬個指令，速率 2 MIPS；B 機器指令複雜，300 萬個指令就做完，速率 1 MIPS。
> - A 的執行時間 = 10 × 10⁶ ÷ (2 × 10⁶ /s) = 5 秒。
> - B 的執行時間 = 3 × 10⁶ ÷ (1 × 10⁶ /s) = 3 秒。
> - MIPS 比較低的 B 反而比較快。

由定義可寫成 `MIPS = IC ÷ (執行時間 × 10⁶) = Clock rate ÷ (CPI × 10⁶)`：它跟 IC 無關，所以看不出「完成同一個程式要幾個指令」，不同 ISA 之間更沒辦法比。

> **陷阱** MIPS 高不一定比較快。MIPS 好算，卻反映不了真正的效能；要比的是 execution time（或 throughput），也就是真正算出來的時間。

## Amdahl's law：只有被改進的部分會變快

> **比喻** 從台北開車到高雄：先在市區走 0.5 小時才上高速公路，高速公路開 4 小時，下交流道到目的地再 0.5 小時，共 0.5 + 4 + 0.5 = 5 小時。
> 改坐飛機呢？到機場、出機場那兩段市區的半小時怎麼樣都省不掉；能改進的只有中間那段：4 小時變成飛機 1 小時。
> 總時間 = 0.5 + 1 + 0.5 = 2 小時，speedup = 5 ÷ 2 = 2.5 倍。中間那段快了 4 倍，整體卻只快 2.5 倍。

**Amdahl's law**：改進系統的某一部分，只有那部分變快，沒被影響的時間不變，所以整體的改進有上限。

```
T_improved = T_affected ÷ 改進倍數 n + T_unaffected
```

另一種寫法（以比例表示，被改進部分佔原時間比例 f）：`Speedup = 1 ÷ ((1 − f) + f ÷ n)`。當 n → ∞，Speedup 最多只到 1 ÷ (1 − f)。

### 例題：乘法佔 80 秒

一個程式跑 100 秒，其中乘法佔 80 秒，其他 20 秒在做別的事。想讓整個程式快 5 倍，也就是 100 ÷ 5 = 20 秒跑完，辦得到嗎？

```
80 ÷ n + 20 = 20
80 ÷ n      = 0     → n 必須是 ∞
```

那 20 秒不是乘法，怎麼改進乘法都還在。要總共 20 秒，乘法就得變 0 秒，等於要無限快，所以**做不到**。

再看一個例子（示意）：同一個程式，若只要整體快 4 倍（25 秒）：

```
80 ÷ n + 20 = 25
80 ÷ n      = 5     → n = 16
```

乘法要快 16 倍，整體才快 4 倍；而整體 speedup 的上限是 100 ÷ 20 = 5 倍，永遠到不了。

> **陷阱** 整體 speedup 受「沒被改進的部分」限制：改進的部分再快，總時間也不會少於不受影響的時間。

### Make the common case fast

Amdahl's law 給的設計原則：**make the common case fast**，讓最常發生的情況變快。加法、load、store 一天到晚在用，值得加速；乘法如果只佔 1% 的時間，花大錢、大量 hardware 加速它，整體只快一點點。所以設計處理器前要先做 **profiling**，看時間花在哪裡，把資源花在最常跑的地方，用最少的成本換最大的改進。

## Power：dynamic、static 與 power wall

除了跑多快，**power（功率消耗）** 近年變成設計電腦最大的限制之一。看 Intel 二十幾年來各代處理器：clock rate 越來越快，power 也越來越大，直到最近兩代才變平。為什麼變平？要先知道 power 的組成。

### 兩種 power

- **Dynamic power（動態功率）**：做事時才耗。電路用電壓高低代表 0 和 1；CMOS 從 0 變 1、1 變 0，就要對輸出端的電容充電、放電，這就消耗能量。
- **Static power（靜態功率）**：不做事也在耗，來源是漏電流 **leakage**。

### Dynamic power 公式

```
Dynamic power ∝ Capacitive load × Voltage² × Frequency（switched）
```

- **Capacitive load（電容負載 C）**：一個 gate 的輸出接給越多 gate（**fan-out** 越大），要推動的電容就越大；它也跟電路面積很有關。
- **Voltage（電壓 V）**：用多高的電壓代表 1、多低代表 0。
- **Frequency（f）**：切換頻率，0↔1 切換得多快。

### 為什麼 frequency 快千倍，power 只多 30 倍

過去 25 年 frequency 快了超過 1000 倍，dynamic power 卻只增加大約 30 倍。秘訣是**降電壓**：從 5 V 降到 1 V，每一代大約降 15%。因為是平方項，電壓變 1/5，power 就變 1/25；1000 × 1/25 = 40，跟「約 30 倍」同一量級（C 等其他因素也有變化）。

那一直降電壓不就好了？不行。降到大約 1 V 就降不下去了，再降 leakage 會變很大，電晶體想關也關不緊。Power 降不下來，同一塊面積又塞進更多運算，**power density（單位面積功率）** 變很高，產生很多熱，散熱變成大問題。

### 例題：C、V、f 都降到 85%

新 CPU 和舊 CPU 相比，capacitive load、voltage、frequency 都變成舊的 85%，新 power 是舊的多少？

```
P_new / P_old = (C × 0.85) × (V × 0.85)² × (f × 0.85) ÷ (C × V² × f)
              = 0.85 × 0.85² × 0.85
              = 0.85⁴

0.85² = 0.7225
0.85³ = 0.7225 × 0.85 = 0.614125
0.85⁴ = 0.614125 × 0.85 ≈ 0.522
```

新 power ≈ 舊的 0.52。每樣只降 15%，power 卻幾乎砍半，就是因為電壓是平方項。

### Power wall

可惜因為 leakage，電壓沒辦法再降，power 也就降不下來、熱散不掉。很貴的散熱方法，一般桌機和便宜的伺服器負擔不起，這個限制叫 **power wall（功率牆）**。

## 從 uniprocessor 到 multicore

為了 power，近年的方向變了：不再只靠縮小 feature size 把單一處理器做快，而是走向 **multi-core（多核心）**。

### Uniprocessor 效能成長趨緩

**Uniprocessor**：一顆晶片只有一個 core。

- 2002 年以前，效能每年約進步 1.5 倍。
- 2002 年以後只剩每年約 1.2 倍。原因：power、指令層級平行度 **ILP（instruction-level parallelism）** 挖不出更多、memory latency（記憶體太慢，資料拿不進來）。
- 2004 年以後，大家改把好幾個 core 放進同一顆 microprocessor，例如 2 核、4 核。

### 責任轉移到 programmer

以前 processor 變快，舊程式一行 code 都不用改，放到新機器上自然就快。換成多核心，要變快的責任就落在 programmer 身上，程式不改，多出來的 core 不會自動幫忙。

問：程式一行都不改，加了 2 個、4 個 core，到底增加了什麼？
答：同一個 job 丟進去時間一樣，**response time 沒變**；增加的是 **throughput**——第一個 job 放這個 core、第二個放那個 core，單位時間做完更多事。既然能同時做好幾件事，也可以把 clock frequency 調慢一點，power 就跟著降。

### Parallel programming 的難處

要讓單一工作更快（改進 response time），就得寫 **parallel program（平行程式）**，明確把工作分給不同 core：

1. 找出哪些地方能同時做，拆成不同部分的 code，分給不同 core。
2. **Load balancing（負載平衡）**：若工作 A 很大、B 很小，core 2 一下就做完在發呆，整體還是要等 A；所以工作要平均分。
3. **Communication 與 synchronization（溝通與同步）**：若 C 要等 A、B 都做完才能開始，就不能 A 一做完就去做 C。

這些都是平行程式不好寫的原因。

## Benchmark 與 SPEC

有了效能（CPU time）和 power 的標準，下一個問題是：實際上怎麼量？最直接的方法是拿一個程式到 A、B、C 機器上跑，看哪台快。

### 選哪個程式：看 workload

問：拿矩陣相乘的程式來測，好不好？
答：看情況。如果平常天天在做矩陣相乘（例如做科學計算），用它測很有意義；如果平常很少算矩陣（例如寫作），就沒什麼意義。

所以要依自己的 **workload（工作負載，平常的工作內容）** 來測：工程師常用 compiler、試算表，作家常用文書處理。

### Benchmark 與 industry standard

- 每個人都自己組一組程式太辛苦 → 有人先寫好一組給大家用，稱為 **benchmark（效能測試程式組）**。
- A 公司、B 公司各自做 benchmark，一定挑對自己有利的程式，沒有公信力 → 需要 **industry standard**：各家一起出資成立機構來做 benchmark，大家用同一組測才公平，這就是 **SPEC（Standard Performance Evaluation Corporation）**。
- SPEC 從 1989 年開始。SPEC2006 中有專測 CPU 的 SPEC CPU2006，分 integer（整數）和 floating point（浮點數）兩組，另有 HPC 等其他項目。

### Benchmark 的問題

- 程式是公開的，廠商可以讓 compiler 或 library 專門針對這些 code 做 optimization，分數好看，卻不代表真實效能。
- 測出來的結果跟整個系統的設定（**system configuration**）有關；測試規格本身也可能剛好對某台機器有利。
- Benchmark 只是一小組程式，涵蓋不了所有情況；而且要定期更換，否則大家只針對它優化。

> **觀念** 做研究實驗時，其實也是在做 benchmarking：例如影像處理領域就有大家共用的標準測試圖片，大家用同一組資料比較方法好壞。

## SPECratio 與 geometric mean

### 例題：SPEC CPU2006 integer 測 AMD X4

把 SPEC CPU2006 中整數運算的那組 12 個程式拿到 AMD 的處理器 X4 上跑。每個程式收集 IC、CPI、clock cycle time，乘起來就是 execution time。例如 perl 在 X4 上跑了 637 秒。

光看 637 秒這個絕對值很難比，所以找一台 **reference machine（參考機器）**，每台機器都跟它比，比完就能知道誰好。perl 在參考機器上要 9770 秒。

```
SPECratio = 參考機器的執行時間 ÷ 待測機器的執行時間

perl：SPECratio = 9770 ÷ 637 ≈ 15.3
```

計算方式跟「A 比 B 快幾倍」一樣（慢的放分子），**SPECratio 越大越快**。

### 用 geometric mean 彙總

12 個程式各有一個 SPECratio，要合成一個總分，SPEC 用 **geometric mean（幾何平均）**：

```
Geometric mean = (SPECratio₁ × SPECratio₂ × … × SPECratio₁₂) 開 12 次方根
X4 的結果 ≈ 11.7
```

若用 **arithmetic mean（算術平均）**，全部加起來除以個數，結果會不一樣。SPEC 選幾何平均的好處：**換一台參考機器，排名也不變**。

> **例題**（示意）兩台機器 X、Y 跑兩個程式 P1、P2 的時間：X = (10 s, 100 s)，Y = (20 s, 40 s)。
> - 參考機器 R1 = (100 s, 1000 s)：X 的 ratio = (10, 10)，Y 的 ratio = (5, 25)。算術平均 X = 10、Y = 15；幾何平均 X = √100 = 10、Y = √125 ≈ 11.18 → 兩種平均都是 Y 較好。
> - 參考機器 R2 = (1000 s, 100 s)：X 的 ratio = (100, 1)，Y 的 ratio = (50, 2.5)。算術平均 X = 50.5、Y = 26.25（排名翻轉成 X 較好）；幾何平均 X = √100 = 10、Y = √125 ≈ 11.18 → 仍是 Y 較好。
> - 原因：幾何平均的比值 GM_X ÷ GM_Y = GM(Y 的時間) ÷ GM(X 的時間)，參考機器的時間在相除時消掉了。

自己設計一顆 processor，也照同樣流程跑這組 benchmark，得到自己的一張表。最後只比 summary 那個數字：一顆是 10、另一顆是 11，就說對這組 benchmark 而言，11 那顆的 CPU 效能較好。

## SPEC power：每一瓦做多少事

Power 也有 benchmark（SPECpower）。不能只看耗多少電，還要看同時做了多少事，所以記錄兩樣東西：

- **Throughput**：每秒完成幾個 operation，單位是 **ssj_ops**。
- **Power**：消耗多少瓦（watts）。

負載（load）不同，耗電也不同，所以從 100% 負載開始，90%、80%……每 10% 跑一次，一路到 0%（共 11 個負載點）。

```
總分 = ∑ ssj_ops ÷ ∑ power        （所有負載點加總，單位：ssj_ops／watt）
```

也就是「每一瓦能做多少事」。

看 X4 的結果：負載降低時，做的事一路變少，耗電也往下降，但**降得比較慢**。最右邊 0% 負載時完全沒做事，performance 是 0，power 卻還不小。原因就是 static power：leakage 什麼都不做也一直在漏。電壓已經降到大約 1 V，漏電在整個 power 裡佔很大比例，怎麼解決正是目前的研究題目。

## Fallacy：閒著就很省電？

錯誤觀念（fallacy）：「電腦閒著、負載低的時候就很省電」。看實測資料（以滿載的 power 為 100%）：

| Load | Power（相對滿載） |
|---|---|
| 100% | 100% |
| 50% | 83% |
| 10% | 61% |
| 0% | 仍要 141 W |

只做一半的工作還要 83% 的電，只做 10% 還要 61%，什麼都不做還要吃掉 141 瓦。所以「閒著就省電」是錯的，原因就是 leakage。

最理想的處理器是 **power 與 loading 成正比**（energy proportional）：做一半的事只耗一半的電。現在的處理器因為漏電還做不到。

Google 資料中心的統計：伺服器大部分時間負載在 10%～50%，真的跑滿 100% 只佔約 1% 的時間。也就是說，電大多花在負載不高的時候；誰能做出耗電跟負載成比例的處理器，就能省下大量電力，這是仍待解決的挑戰。

> **陷阱** 什麼都不做（idle）不等於 low power；0% load 的 power 主要是 static power（leakage）。

## 晶片怎麼做出來：wafer、die 與 yield

效能之外還要看 **cost（成本）**。先看一顆晶片（IC）怎麼做出來：

```
silicon ingot（矽晶棒，直徑約 8～12 吋）
   │ 切片（slicer）
   ▼
blank wafer（空白晶圓）
   │ 20～40 道 processing steps（每一道用一張 mask 光罩，把電晶體、導線的圖形照上去）
   ▼
patterned wafer（同一設計重複很多份，每個小方塊是一個 die）
   │ wafer tester：測試每個 die
   ▼
dicing（切割）→ 壞的 die 丟掉
   │
   ▼
packaging（封裝，bond die to package）
   │
   ▼
part tester：再測一次 → 出貨（ship to customers）
```

- **Silicon ingot（矽晶棒）**：長長一根像香腸。
- **Wafer（晶圓）**：從晶棒切下的薄圓片；送進晶圓廠（例如台積電）一層層做出電路。
- **Die（晶粒）**：晶圓上重複做的每一個小方塊。
- **Packaging（封裝）**：die 上的線寬非常小，沒辦法直接跟外面連，要包裝並拉出摸得到的接腳。

### Yield（良率）

做 100 顆不一定 100 顆都好，可能只有 90 顆好。好的 die 佔全部的比例叫 **yield（良率）**，這裡是 90%。Yield 越高代表製程越好；如果只有 50%，做 100 顆就要丟 50 顆，成本當然很高。

## 一顆 die 多少錢：面積與缺陷

一片晶圓上是同一個設計重複很多次，例如一片 AMD X2 的晶圓上有 117 個 die。

```
Cost per die    = Cost per wafer ÷ (Dies per wafer × Yield)
Dies per wafer ≈ Wafer area ÷ Die area
```

分母「dies per wafer × yield」就是一片晶圓上**好的** die 數。

> **例題** 一片晶圓 100 元，可切 100 個 die，yield 90%。
> - 好的 die = 100 × 0.9 = 90 顆（只有這 90 顆能賣）。
> - Cost per die = 100 ÷ 90 ≈ 1.11 元。

> **例題** 晶圓面積 1000。
> - Die 面積 100 → dies per wafer ≈ 1000 ÷ 100 = 10 顆。
> - Die 面積 50 → dies per wafer ≈ 1000 ÷ 50 = 20 顆。
> - Die 越大，切得越少。

（實際上晶圓是圓的，邊緣會浪費一些不完整的 die，所以是「約等於」。）

### Yield 跟什麼有關

Yield 取決於 **defects per area（單位面積缺陷數）** 和 **die area（die 的面積）**。

- **缺陷從哪來**：線寬只有幾十奈米，晶圓廠雖然是無塵室（clean room），還是有很小的灰塵，灰塵掉到 chip 上那顆就壞了。製程控制得越好，缺陷率越低，yield 越高；每家晶圓廠、每種製程都有自己的缺陷率。
- **面積的影響**：同樣掉了 5 顆灰塵，整片只切 5 顆大 die，很可能每顆都中獎；切成 100 顆小 die，最多壞 5 顆，至少 95 顆是好的。

```
同一片晶圓、同樣 5 個缺陷 ×

切 5 顆大 die：      切 100 顆小 die：
┌────┬────┐         ┌─┬─┬─┬─┬─┬─┬─┬─┬─┬─┐
│ ×  │  × │         │×│ │ │ │ │ │×│ │ │ │   ……
├────┼────┤         ├─┼─┼─┼─┼─┼─┼─┼─┼─┼─┤
│ ×  │ ×  │         │ │ │ │×│ │ │ │ │ │ │
├────┴────┤         …（共 100 顆，最多 5 顆壞）
│    ×    │
└─────────┘
可能 5 顆全壞        yield ≥ 95%
```

教科書給的 yield 公式（同樣表達「缺陷率越高、面積越大，yield 越低」）：

```
Yield = 1 ÷ (1 + (Defects per area × Die area ÷ 2))²
```

> **重點** 缺陷率由製程決定，die 面積由設計者決定。面積越大 → 每片切得越少、yield 也越低 → 每顆成本上升得比面積更快。成本跟面積關係最大。

### 晶片的總成本

除了 die 本身，還有：

- **Testing cost（測試成本）**：做完要測哪些好、哪些壞。
- **Packaging cost（封裝成本）**：沒包裝的 bare die（裸晶）根本摸不到，包好有接腳才能放進電腦。

```
晶片成本 = die 的成本 + 測試成本 + 封裝成本
```

再拿成本和效能做 trade-off（取捨），就能決定該選哪台電腦。

## 效能部分的結論

1. **Technology 持續進步**，cost／performance（花多少錢買到多少效能）一直在改善。依據的是 **Moore's law（摩爾定律）**：晶片上的電晶體數量大約每 1.5～2 年翻一倍。
2. **Abstraction（抽象化）**：把下一層的複雜細節藏起來，讓我們可以一層一層理解系統。
3. **ISA 是 hardware 和 software 的介面**：有了它，軟體和硬體可以分開各自發展。
4. **Execution time 是最好的效能衡量**：真的把執行時間算出來才準，MIPS 之類的指標都不是。
5. **Power 是限制因素**：電壓降不下去，散熱一定要解決。
6. 所以現在的處理器靠 **parallelism（平行化）**，例如 multi-core，來提升效能。

接下來進入 ISA 本身：指令有哪些 operand、格式怎麼設計。

## 指令集要規定哪些事

這一章把指令集（instruction set）整個介紹完，例子用 MIPS。指令集定好之後，後面的章節才照著它去設計硬體，所以這章是地基。

複習：計算機架構（computer architecture）= **ISA**（instruction set architecture）+ **machine organization**。ISA 聽起來抽象，但對寫程式的人來說，它就是組合語言（assembly）：用 C 寫的程式，compiler 最後就是把它翻成 assembly code。

### 從一行 C 看指令的組成

一段 C 程式一定有：

- **運算子（operator）**：加、減、乘、除、取餘數……
- **運算元（operand）**：operator 作用的對象，可以是變數（variable），也可以是常數（constant）。
- **expression**：operator 作用在 operand 上；算完再指定給一個變數，就是 **assignment**。

`a = b + 5` 這一行 C，寫成 assembly 要四行（示意寫法，還不是 MIPS 的語法）：

```asm
load  R1, b        # 從記憶體拿 b
load  R2, 5        # 把常數 5 放進來
add   R3, R1, R2   # 相加
store a, R3        # 結果存回 a
```

- 每行最前面的 load、add、store 說明「要做什麼」，叫 **op code**（operation code）。
- 這四行的 operand 從三個地方來：**記憶體（memory）**裡的資料、**暫存器（register）**、**常數** 5。
- 為什麼切這麼細？因為每一行 assembly 都對應硬體的一個動作。高階語言一行寫起來輕鬆，硬體卻要分四步才做得完。

### ISA 要規定的四件事

1. **Storage**：有幾個 register、記憶體多大、怎麼去記憶體拿資料。
2. **Data type**：同一串 0101，當整數和當浮點數，值不一樣，加法器的設計也不一樣。
3. **Instruction format**：一個指令多長？固定 32 bits、16 bits，還是有長有短？
4. **Operations**：這顆處理器准你做哪些動作，load、store、加減乘除等等。

MIPS 的格式很簡單：只有 **R、I、J 三種，一律 32 bits**。Intel x86 的指令有長有短，越複雜，硬體越要花功夫判斷「這是哪種指令」。

## 算術指令：一個動作、三個 operand

MIPS 的 operand 有三個來源：**register**、**memory**、**常數**（MIPS 叫 **immediate**）。

算術（與邏輯）指令固定四個 field：

| field | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| 內容 | operation | destination（結果放哪） | source 1 | source 2 |

```asm
add a, b, c        # a = b + c
```

- 每個指令 32 bits，格式很死：**一個 operator 加三個 operand**，順序是目的、來源一、來源二。
- C 裡一次加四、五個數，不能在後面一直寫下去，只能拆成好幾條指令。

> **重點** Design Principle 1：**Simplicity favors regularity**（要簡單就要規律）。格式越規律，硬體越簡單：固定位置的前幾個 bits 就是 op code，一看就懂。要判斷的事少 → 面積小、成本低、速度還能提升。

### 例題：f = (g + h) − (i + j)

四個 operand，但一個指令只能有兩個 source，所以拆開（t0、t1 是暫存結果的名字）：

```asm
add t0, g, h       # t0 = g + h
add t1, i, j       # t1 = i + j
sub f, t0, t1      # f = t0 - t1
```

一行 C 變三個指令，每條都守「一個動作、三個 operand」。

## 為什麼 operand 要放在 register

上面的 t0、g、h 只是方便看的名字。**assembly 沒有 variable**，必須說清楚資料放在哪。像 add 這種指令，operand **只能放在 register**。

- **Register**：CPU 裡、緊貼著加法器（ALU）的一排小格子，合起來叫 **register file**。
- **Memory**：另一顆晶片，要拿資料得離開 processor（off-chip），很花時間。

Register 的四個好處：

1. **快**：就在 ALU 旁邊，比 memory 快很多。
2. **compiler 好用**：算到一半的暫存值直接丟在 register。
3. **減少 memory traffic**：變數放 register，就不用一直跑記憶體。
4. **提高 code density**：指令裡要寫出位置的編號，編號越大要的 bits 越多。

> **比喻** 班上 150 人，學號至少要 8 bits（2⁸ = 256 ≥ 150）；記憶體位址更要 32 bits。可是 register 只有 32 個，2⁵ = 32，**5 bits** 就能指定一個，省很多。

## MIPS 的 32 個 register

- 32 個 register，編號 0～31，指定一個要 5 bits。
- 想要 64 個？比較有彈性，但每個要 6 bits；128 個要 7 bits。一個 add 要寫三個 register，32 個時就用掉 3 × 5 = 15 bits；register 越多，指令越擠。
- MIPS 選 32 個 register，每個 32 bits；資料和指令也都是 32 bits。
- 為什麼不要更多？register file 越大就越慢。

> **重點** Design Principle 2：**Smaller is faster**。

32 個 bits 合起來叫一個 **word**。不管存取 register 還是 memory，基本單位都是 word。

### Register 的名字與用途

Register 可以叫編號，也可以叫名字（比較好讀），例如 `$s0` 就是 16 號。

| 名字 | 編號 | 用途 |
|---|---|---|
| `$zero` | 0 | 永遠是 0（0 太常用，用硬體固定一個） |
| `$v0`～`$v1` | 2～3 | procedure 的回傳值（value） |
| `$a0`～`$a3` | 4～7 | procedure 的參數（argument） |
| `$t0`～`$t7` | 8～15 | 暫時的值（temporary），例如算到一半的結果 |
| `$s0`～`$s7` | 16～23 | 程式裡一般的變數（saved） |
| `$t8`～`$t9` | 24～25 | 暫時的值 |
| `$gp`、`$sp`、`$fp`、`$ra` | 28、29、30、31 | 特殊用途：global pointer、stack pointer、frame pointer、return address |

1 號（`$at`）留給 assembler、26～27 號（`$k0`、`$k1`）留給作業系統，所以**不是每個 register 都能亂用**。

> **陷阱** 編號要記準：`$s0`～`$s7` 是 16～23，`$t0`～`$t7` 是 8～15，`$t8`、`$t9` 是 24、25，`$gp`/`$sp`/`$fp`/`$ra` 是 28～31。

### MIPS 的整體組織

- CPU 裡有 32 個 register 和運算單元（arithmetic unit）：register file → ALU → 寫回 register；memory 在 CPU 外面。
- 乘法結果會變長、除法有商和餘數，都放在 **Hi**、**Lo** 兩個特別的 register。
- 浮點數另外交給 **coprocessor 1**。同一串 bits 當整數或當浮點數，解釋不同，硬體也不同。

## 用 register 寫 f = (g + h) − (i + j)

加法的 operand 一定要在 register。假設 f、g、h、i、j 已經放在 `$s0`～`$s4`，並代入 g = 5、h = 3、i = 4、j = 2：

```asm
add $t0, $s1, $s2   # $t0 = g + h = 5 + 3 = 8
add $t1, $s3, $s4   # $t1 = i + j = 4 + 2 = 6
sub $s0, $t0, $t1   # f = 8 - 6 = 2
```

結果 2 與直接算 (5 + 3) − (4 + 2) 相同。一行 C 寫成三行 assembly，每一行都是一個 destination、兩個 source。

> **重點** 加、減、and、or 只能在 register 上做；資料不在 register，就得先用別的指令（load）搬進來。

## Register 架構的演變

Register file 長什麼樣，是指令集很重要的特性。歷史上大致四種：**accumulator**、**stack**、**general purpose register（GPR）**、**load-store**。MIPS 是 load-store。

### Accumulator（累加器）

最早硬體很貴，CPU 裡只建得起一個 register，叫 accumulator。做 A = B + C：先 load B 進 accumulator，再 add C，結果還在 accumulator。指令只要寫**一個 address**；另一個運算元和結果放哪都不用講，反正只有一個。

### Stack

Register 多了，但只能像疊盤子一樣後進先出（LIFO），只能動最上面（top of stack）那個。做 A + B：push A、push B，再 add，自動把最上面兩個相加放回頂端，最後 pop 到 C。這裡的 add **連一個 operand 都不用寫**。

### General purpose register（GPR）

硬體越來越便宜，可以有很多 register，而且任何一個都能存取。

- 分 **2-address**（`add A, B` 表示 A = A + B）與 **3-address**。要寫的位址越多，指令越長。
- operand 可以在 register，也可以直接從 memory 拿。

### Load-store（RISC）

規定加減運算的**三個 operand 全都要在 register 裡**。為什麼比較好？只要有一個 operand 在 memory，這個指令要花多久就說不準。所以把「去記憶體拿東西」拆成獨立的 load、store；指令切得小又單純，就好做 optimization。

## C = A + B 的四種寫法

```asm
# Stack
push A
push B
add          # 頂端兩個相加，放回頂端
pop  C

# Accumulator
load  A      # 每條只寫一個位址，另一方一定是 accumulator
add   B
store C

# Register-memory
load  R1, A
add   R1, B  # 直接拿記憶體裡的 B 來加
store C, R1

# Load-store
load  R1, A
load  R2, B
add   R3, R1, R2
store C, R3
```

- 1975 年後就沒人用 stack 和 accumulator 了。**x86 屬 register-memory，MIPS（RISC）屬 load-store**。
- 比較後兩種，看三件事：每個指令幾個 bytes、總共幾個指令、CPI 多少。

| | Register-memory | Load-store |
|---|---|---|
| 指令數 | 3 | 4 |
| 每個指令長度 | 較長（要放記憶體位址） | 較短 |
| add 的速度 | `add R1, B` 要先等記憶體送來 B | operand 都在 register，很快做完 |

> **陷阱** 3 個指令不一定比 4 個快！指令數少不代表 cycle 數少，要看每個指令要幾個 cycle（CPI）。指令拆得小又單純，反而好做 optimization。

MIPS 是 load-store machine：算術、邏輯運算的 operand，一定要先在 register file 裡。

## Memory operand：base register 加 offset

簡單變數放 register 沒問題，但 array、matrix 這種大量資料，32 個 register 放不下，只能放 memory。運算前資料又一定要在 register，所以要搬（**data transfer**）：

- memory → register：**load**
- register → memory：**store**

搬資料要講清楚兩件事：

1. **哪個 register**：5 bits 就搞定。
2. **記憶體的哪個位置**：記憶體像一條很長的一維陣列，每個 byte 一個編號，叫 **byte address**。MIPS 記憶體有 2³² 個 byte，位址要 32 bits。（對照：若只有 1024 = 2¹⁰ 個 byte，位址只要 10 bits。）

把 32 bits 的位址直接寫進指令？op code、register 再加 32 bits，指令就塞不下了。所以 MIPS 換個方法：

- 先找一個 **pointer** 指到某個位置，要的地方就是 pointer 再往上加多少，加的量叫 **offset**（偏移量）。
- 關鍵：pointer 放在 register 裡，指令只要 5 bits 說是哪個 register。這個 register 叫 **base register**。
- offset 通常是很小的數，用不了幾個 bits。

> **重點** 有效位址 = base register 的內容 + offset。

### 例題：拿位址 1012 的資料

要拿位址 1012 裡的 999。直接寫 1012，前面一大串 0 也得寫，還是 32 bits。改成：`$s0` 放 1000（像指標指到 1000），要 1012 就是 1000 + 12，指令只寫「base 是 `$s0`，offset 12」。

- 要拿一萬附近的資料？把 base 改設成 10000，再從那裡加 offset。
- 為什麼 base 放 1000？因為資料就在附近，這其實就是 array：元素在 1000、1004、1008……一筆一筆往上。
- 一筆加 4，因為位址以 byte 算，而 MIPS 一個 word 是 4 個 byte。
- `$s0` 裡的 1000 不是天上掉下來的，要先用一個指令把它設好。

## lw 與 sw

### lw（load word）

```asm
lw $t0, 12($s0)    # $t0 = Mem[$s0 + 12]
```

| op code | 目的 register | offset | base register |
|---|---|---|---|
| `lw` | `$t0` | 12 | `$s0` |

- 一次搬一個 word（32 bits）。
- 第一個元素的位置當 base，其他元素從 base 加多少去拿，剛好對應 array。

> **例題** `$s0` = 1000，記憶體 1012 放著 999。執行 `lw $t0, 12($s0)`：位址 = 1000 + 12 = 1012，去 1012 拿東西 → `$t0` = **999**。

> **陷阱** 1012 只是位址；lw 載入 register 的是 Mem[1012] 的**內容** 999，不是 1012。

為什麼不直接把位址寫進指令？32 bits 的位址放不下，只好用間接的方式描述。

### sw（store word）

算完要把資料從 register 寫回記憶體。描述位址的方法一模一樣（base + offset），只是 op code 不同。

```asm
sw $t0, 12($s0)    # Mem[$s0 + 12] = $t0
```

> **例題** `$s0` = 1000、`$t0` = 25，執行 `sw $t0, 12($s0)`：位址 1000 + 12 = 1012，執行完記憶體 1012 這格變成 25。

offset 是整數，**可正可負**，往上或往下都行。

## 陣列：g = h + A[8] 與 A[12] = h + A[8]

假設 g 在 `$s1`、h 在 `$s2`，陣列 A 第 0 個元素的位址（base）在 `$s3`。代入 h = 5、A 從 1000 開始、A[8] = 30。

### 例題：g = h + A[8]

A[8] 的 offset 是多少？不是 8！一個元素 4 個 byte，所以是 8 × 4 = **32**。

```asm
lw  $t0, 32($s3)     # 位址 1000 + 32 = 1032，$t0 = A[8] = 30
add $s1, $s2, $t0    # g = h + A[8] = 5 + 30 = 35
```

### 例題：A[12] = h + A[8]

讀 A[8]、加上 h 之後，還要寫回 A[12]，offset = 12 × 4 = **48**。

```asm
lw  $t0, 32($s3)     # $t0 = A[8] = 30
add $t0, $s2, $t0    # $t0 = h + A[8] = 35
sw  $t0, 48($s3)     # A[12] = 35（位址 1048）
```

> **重點** 存取 array 時 base 不用動，只要改 offset（32、48……）就能拿到任何一個元素。

> **陷阱** offset 以 byte 計：A[8] 的 offset 是 8 × 4 = 32，不是 8。

## Byte address、alignment 與 endian

### 為什麼位址以 byte 計

記憶體一格一格存取，每格一個位址：Memory[0]、Memory[1]、Memory[2]……這一格是存取的基本單位。早期記憶體很貴，一格就是一個 byte；技術進步後一次能拿更多。

既然 MIPS 都以 4 個 byte 存取，為什麼不用「第幾個 word」當位址來省 bits？因為**還是常常要拿單一個 byte**，所以位址照樣以 byte 計。MIPS 一個 word 是 4 bytes，所以 word 的位址是 0、4、8……都是 4 的倍數。

### Alignment（對齊）

一個 word **一定要從 4 的倍數開始放**。從位址 1、2 或 3 開始放一個 word，就是沒對齊，不合法。

```
位址:   0    1    2    3    4    5    6    7
       [ word 0 (合法)    ][ word 1 (合法)    ]
            [ 從 1 開始的 word：不合法 ]
```

### Big endian 與 little endian

一個 word 裡的 4 個 byte 怎麼排？以 0x12345678 為例，12 是最高位（most significant）的 byte，78 是最低位（least significant）的 byte。

| 位址 | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| Little endian | 78 | 56 | 34 | 12 |
| Big endian | 12 | 34 | 56 | 78 |

- **Little endian**：位址 0 放最低位的 byte。
- **Big endian**：位址 0 放最高位的 byte。**MIPS 是 big endian**。
- 這只是習慣，買機器時知道它用哪一種，就知道怎麼存取裡面的 byte。

> **陷阱** Big endian：位址最小的 byte 是 most significant byte（「大的那端」先放）。

## Register 放不下：spilling

到這裡，register 和 memory 都能放 operand，但要運算，一定先搬到 register。

- 平常由 compiler 分配：一直要用到的變數放 register。
- 變數太多放不下，就用 load、store 把一些丟到記憶體，像水滿出來一樣，叫 **spilling**。
- 把 register file 做大、全部塞進去不就好了？不行，做大就變慢（smaller is faster）。
- Register 只要 5 bits 就能指定，所以一個 add 能描述三個 register；記憶體位址太長，所以搬資料的指令一次只處理**一個** memory operand。

> **重點** 分工：常用、最近要用的放 register；不常用、放不下的，寫回 memory。

## Immediate operand：把常數放進指令

第三種 operand：**immediate**（常數）。`a = a + 5`、`b = b + 1` 這種加常數的運算很常見，統計起來大約佔一半（約 50%）的 operand。

機器只認得 0 和 1，要加 5 就需要 5 的 bit pattern，這個 pattern 不能憑空變出來。

- 最直覺的做法：常數先存在記憶體，要用再 load。可是加個 5 就要多一個 load，太浪費。
- 這種情況又佔一半，依照 **make the common case fast**，乾脆把常數**直接放進指令裡**。讀出指令的同時，常數也一起拿到了。
- 這種指令名字後面加 i，例如 **addi**（add immediate）。

```asm
addi $s0, $s1, 10    # f = g + 10（f 在 $s0、g 在 $s1）
addi $s2, $s1, -1    # 減 1 = 加 -1
```

> **觀念** 常數可正可負，所以 MIPS **不需要 subtract immediate**：要減常數，就加負的常數。

### `$zero`：硬體接死的 0

常數 0 太常用，MIPS 把第 0 號 register 用硬體接死成 0（**hard-wired**）。

- `$zero` 改不了：就算寫「0 加 5 放進 `$zero`」，它還是 0，這個指令等於白做。
- 妙用：MIPS **沒有 move 指令**。要把 `$s1` 搬到 `$t2`：

```asm
add $t2, $s1, $zero  # $t2 = $s1 + 0，原封不動搬過去
```

## 指令也是 32 bits

（有號數、無號數與二補數的表示法屬於 logic design 的範圍，需要先熟悉。）

`add`、`$t0` 對機器沒有意義，它只看得懂 0 和 1，所以指令也要編成 0101。

- **長度**：register 32 bits，記憶體一次搬一個 word 也是 32 bits，那指令也定為 32 bits，越規律越簡單。
- **切 field**：把 32 bits 切成好幾格，每格代表一種資訊。電腦拿到指令，先取前 6 bits，那是 op code；再取 5 bits，那是第幾號 register……
- **格式要一致**：如果各格式的 op code 長度不同（6、7、8 bits 都有），拿到指令連「先取幾個 bits」都不知道，只好先猜。所以不管哪種指令，**第一格都是 6 bits 的 op code**。
- 對照 x86 一大堆格式，硬體就很複雜。這些格式不是要死背，要懂它為什麼這樣設計。

MIPS 只有三種格式：**R-type、I-type、J-type**，所有指令都落在這三種裡。（J-type 與分支、跳躍的定址在後面介紹。）

## R-format

R 代表 register，就是加、減、邏輯運算這類指令。

| 欄位 | op | rs | rt | rd | shamt | funct |
|---|---|---|---|---|---|---|
| bits | 6 | 5 | 5 | 5 | 5 | 6 |

- **op**：是什麼指令。R-type 很特別：加、減、and、or **全部共用同一個 op，六個 0**（000000）。
- **funct**（function code）：到底是哪個運算看最後 6 bits。op 加 funct 一起決定動作。

| 指令 | funct（十進位） | funct（二進位） |
|---|---|---|
| add | 32 | 100000 |
| sub | 34 | 100010 |
| and | 36 | 100100 |
| or | 37 | 100101 |

- **rs**：第一個 source；**rt**：第二個 source；**rd**：destination（結果放這）。register 有 32 個，所以各 5 bits。
- **shamt**（shift amount）：給 shift 用。32-bit 資料最多移 31 次（再多全是 0，沒意義），0～31 共 32 種，5 bits 剛好。沒用到 shift 的指令（例如 add）填 0。

### 例題：add `$t0`, `$s1`, `$s2` 的編碼

把 `$s1` 加 `$s2` 放到 `$t0`。R-type → op = 0；加法 → funct = 32；rs = `$s1` = 17、rt = `$s2` = 18、rd = `$t0` = 8、shamt = 0。

| 欄位 | op | rs | rt | rd | shamt | funct |
|---|---|---|---|---|---|---|
| 十進位 | 0 | 17 | 18 | 8 | 0 | 32 |
| 二進位 | 000000 | 10001 | 10010 | 01000 | 00000 | 100000 |

接起來每 4 bits 一組換成十六進位（hexadecimal）：

```
000000 10001 10010 01000 00000 100000
= 0000 0010 0011 0010 0100 0000 0010 0000
=   0    2    3    2    4    0    2    0
= 0x02324020
```

> **陷阱** Assembly 寫 `add rd, rs, rt`（destination 寫最前面），但編碼時欄位順序是 op、rs、rt、rd、shamt、funct。

- 這串 0101 跟一般資料長得一模一樣，差別只在：告訴機器它是指令，它就照指令格式去解釋。
- 知道是 R-type，硬體就照格式切：6、5、5、5、5、6，一段一段拿出來，就知道要做什麼。
- R-type 長什麼樣一定要記得，後面設計硬體就是照這三種格式來做的。

### 十六進位與二進位互換

一長串 0101 很難讀，常用十六進位：每 4 bits 一個 hex digit。

> **例題** hex `eca8 6420` 換成二進位：每個 digit 換 4 bits，反過來也一樣。

| hex | e | c | a | 8 | 6 | 4 | 2 | 0 |
|---|---|---|---|---|---|---|---|---|
| binary | 1110 | 1100 | 1010 | 1000 | 0110 | 0100 | 0010 | 0000 |

## I-format：常數與 offset 放在 16 bits

I 就是 immediate：指令裡有一格放常數。屬於 I-type 的有 lw、sw、addi 等。

| 欄位 | op | rs | rt | immediate（constant 或 address） |
|---|---|---|---|---|
| bits | 6 | 5 | 5 | 16 |

- op 6 bits，rs、rt 各 5 bits；R-type 後面的 rd（5）、shamt（5）、funct（6）共 16 bits，合成一格 immediate。
- 只描述兩個 register：**rs** 是 source；**rt** 叫 target，在 addi、lw 時它就是放結果的地方（destination）。

### Sign extension

這 16 bits 被當成**有號數**，可是運算的資料是 32 bits，要先擴成 32 bits，叫 **sign extension**（符號擴展）：看最高位的 sign bit，0（正數）前面補 0；1（負數）前面補 1。這是二補數的性質，擴展後值不變。

```
-50 (16 bits) = 1111 1111 1100 1110 = 0xFFCE
擴成 32 bits  = 1111 1111 1111 1111 1111 1111 1100 1110 = 0xFFFFFFCE   (仍是 -50)
+50 (16 bits) = 0000 0000 0011 0010 → 前面補 0
```

所以常數不能任意大：16-bit 有號數範圍是 −2¹⁵～2¹⁵ − 1，即 **−32768～32767**，超過就放不進這個指令。

> **重點** Design Principle 3：**Good design demands good compromise**（好設計需要好妥協）。為什麼不沿用 R-type、把常數塞進 shamt 或 funct？那只有 5、6 bits，太小，所以妥協：合併成 16 bits。格式雖不同，但盡量相像：前 6 bits 一定是 op，接著 5 bits 是 rs，再來是 rt，解碼（decode）硬體就很接近。

### 例題：addi `$21`, `$22`, -50 的編碼

把 22 號 register 加 −50，放到 21 號。addi 的 op code 是 8。rs = 22（source），rt = 21（destination），immediate = −50 的二補數。

| 欄位 | op | rs | rt | immediate |
|---|---|---|---|---|
| 十進位 | 8 | 22 | 21 | −50 |
| 二進位 | 001000 | 10110 | 10101 | 1111111111001110 |

```
001000 10110 10101 1111111111001110
= 0010 0010 1101 0101 1111 1111 1100 1110
=   2    2    D    5    F    F    C    E
= 0x22D5FFCE
```

> **陷阱** Assembly 先寫目的地 21、再寫來源 22；格式裡卻是 rs（22）在前、rt（21）在後。

### 例題：lw `$t0`, 1200(`$t1`) 的編碼

load、store 也是 I-type。lw 的 op code 是 35；rs 放 base `$t1`（9 號），rt 放目的地 `$t0`（8 號），16 bits 放 offset 1200（= 0x04B0）。

| 欄位 | op | rs | rt | immediate |
|---|---|---|---|---|
| 十進位 | 35 | 9 | 8 | 1200 |
| 二進位 | 100011 | 01001 | 01000 | 0000010010110000 |

```
100011 01001 01000 0000010010110000
= 1000 1101 0010 1000 0000 0100 1011 0000
=   8    D    2    8    0    4    B    0
= 0x8D2804B0
```

### 再看一個例子：lw `$t0`, 32(`$s3`)

（也就是 g = h + A[8] 的第一條指令）lw 的 op = 35、`$s3` = 19、`$t0` = 8、offset = 32。

| 欄位 | op | rs | rt | immediate |
|---|---|---|---|---|
| 十進位 | 35 | 19 | 8 | 32 |
| 二進位 | 100011 | 10011 | 01000 | 0000000000100000 |

十六進位為 `0x8E680020`。

> **觀念** 問：offset 能多大？答：offset 也是 16-bit 有號數、要 sign extension，所以只能在 base 上下 2¹⁵ bytes 的範圍內。超過這個範圍，就得把 base 改到別的位置。

### I-format 的三種用途

R-type 只有一種樣子，好記；I-type 名字叫 immediate，卻有**三種用途**：

1. **immediate 運算**：addi 等，常數直接在指令裡。
2. **load / store**：lw、sw，rs 是 base register，16 bits 是 offset。
3. **conditional branch**：beq、bne。程式除了一行一行往下跑，最重要的是做決定（if-then-else），這要靠條件分支，它們也是 I-type（細節在後面的分支一節）。

後面設計硬體時，只要支援這幾種 type，幾乎就能建出一台電腦，所以格式一定要熟。

## Stored-program：指令和資料都是 0101

在 MIPS 裡，一個指令是 32 bits，一筆整數資料也是 32 bits。給你一串 0101，分得出是指令還是資料嗎？分不出來，它就是一串 bit。所以電腦乾脆不分：不管指令還是資料，通通變成 0101 放進記憶體，這叫 **stored-program computer**（儲存程式的電腦）。

- program 和 data 都放在 memory 裡，只是分在不同區塊。這看似簡單，其實是很厲害的發現。
- 讀出來要當資料或當指令都可以：同一串 `0x02324020`，當資料讀是整數 **36,847,648**；拿去執行，它就是 `add $t0, $s1, $s2`。
- **程式可以處理程式**：你寫的 C 程式，對你是要執行的「程式」；對 compiler 來說只是它的 input data，它讀進去，再輸出 assembly code。

> **重點** 指令用 binary 表示、和資料一起存在記憶體；一個 program 也可以是另一個 program 的 data。

## R-type 為什麼還要 funct

I-type 看最前面 6 bits 的 op code 就知道要做什麼；R-type 看完 op，還要再看最後 6 bits 的 funct，才知道是 add 還是 sub。為什麼要繞一圈？

### 假設全部塞進 op code

假設每種運算（add、sub、and、or……）都有自己的 op code：

1. 6 bits 只有 2⁶ = 64 種，不夠 → op 要加長，例如 7 bits。
2. 為了格式整齊，每種 type 的 op 都要一樣長。
3. 一個指令總共 32 bits，前面多用 1 bit，後面就得少 1 bit：
   - 對 R-type 沒差：rs、rt、rd、shamt 各 5 bits 照樣放得下，後面還有剩。
   - **I-type 就慘了**：immediate 從 16 bits 變 15 bits，範圍從 ±2¹⁵ 縮成 ±2¹⁴，少一半。

| 方案 | op | R-type 剩餘 | I-type immediate | 常數範圍 |
|---|---|---|---|---|
| 現行（有 funct） | 6 bits | 6 bits 給 funct | 16 bits | −2¹⁵～2¹⁵ − 1 |
| 全部塞進 op | 7 bits | 5 bits 用不完 | 15 bits | −2¹⁴～2¹⁴ − 1 |

### 聰明的做法

R-type 用完 rs、rt、rd、shamt 之後還剩 6 bits，就把「哪一種運算」放在這裡，就是 funct。所有 R-type 共用 op = 0，再用 funct 分（add 32、sub 34）；op 維持 6 bits，immediate 保住 16 bits。

> **陷阱** funct 存在的理由不是「R-type 比較特別」，而是為了讓 op 維持 6 bits，保住 I-type 16-bit 的 immediate。

## Logical operations：一個 bit 一個 bit 處理

接下來兩類重要指令：**logical operation** 與 **decision making**（branch）。decision making 重要，因為程式厲害就厲害在：有時執行、有時不執行，有時還要重複執行（branch 在下一部分介紹）。

之前都把 32 bits 當成一整個數字整塊加減。可是一個 word 裡其實就是 32 個 0 或 1，一個 bit 一個 bit 去處理，叫 **bitwise operation**，例如 shift、and、or。

| 運算 | C 運算子 | MIPS 指令 |
|---|---|---|
| Shift left | `<<` | `sll` |
| Shift right | `>>` | `srl`（另有 `sra`） |
| Bitwise AND | `&` | `and`、`andi` |
| Bitwise OR | 直線符號（單一條） | `or`、`ori` |
| Bitwise NOT | `~` | `nor` |

> **觀念** MIPS **沒有 NOT 指令**。R-type 都是兩個來源、一個目的，NOT 只有一個來源，為了格式一致就不另外設計，改用 nor。

## Shift：sll、srl、sra

寫法：目的 register、來源 register、移幾位。

```asm
sll $t2, $s0, 4      # $t2 = $s0 << 4，4 是 shift amount
```

- **sll**（shift left logical）：左移，右邊空出的位置**一律補 0**。
- **srl**（shift right logical）：右移，左邊空出的位置**一律補 0**。
- **sra**（shift right arithmetic）：把這串 bit 當成 signed number，右移時左邊補 **sign bit**（sign extension）：正數 sign bit 是 0 → 補 0；負數 sign bit 是 1 → 補 1。

（示意）8-bit 左移、右移 1 位：

```
原值          1011 0110
sll 1    →    0110 1100   (最右補 0，最左的 1 被擠掉)
srl 1    →    0101 1011   (最左補 0)
sra 1    →    1101 1011   (最左是 1，補 1)
```

### 例題：32-bit 移 8 位（示意）

```
x          = 0001 0010 0011 0100 0101 0110 0111 1000   (0x12345678，正數)
srl x, 8   = 0000 0000 0001 0010 0011 0100 0101 0110   (0x00123456，前面 8 格補 0)
sll x, 8   = 0011 0100 0101 0110 0111 1000 0000 0000   (0x34567800，前 8 bits 擠出去，後 8 格補 0)
sra x, 8   = 0000 0000 0001 0010 0011 0100 0101 0110   (sign bit 是 0，補 0，和 srl 相同)

y          = 1001 0010 0011 0100 0101 0110 0111 1000   (0x92345678，負數)
srl y, 8   = 0000 0000 1001 0010 0011 0100 0101 0110   (0x00923456，補 0，變成正數)
sra y, 8   = 1111 1111 1001 0010 0011 0100 0101 0110   (0xFF923456，補 8 個 1，仍是負數)
```

負數做 sra 8 之後仍是負數，數值相當於除以 2⁸。這就是 srl 和 sra 的差別。

> **陷阱** srl 不管正負一律補 0，只有 sra 會補 sign bit。左移沒有 arithmetic 版本，MIPS 只有 sll。

## Shift 的 R-format：左移就是乘 2

Shift 是 R-type：op = 0，funct 分辨左移／右移、logical／arithmetic；移幾位放在 **shamt**（5 bits，0～31，剛好夠一個 32-bit word）。Shift 只要一個來源、一個目的，兩個 register 就夠，所以 **rs 用不到，填 0**；來源放在 rt，目的放在 rd。

| 指令 | funct |
|---|---|
| sll | 0 |
| srl | 2 |
| sra | 3 |

### 例題：sll `$t2`, `$s0`, 4 的編碼

`$s0` = 16 號（來源，放 rt），`$t2` = 10 號（目的，放 rd），shamt = 4，funct = 0。

| 欄位 | op | rs | rt | rd | shamt | funct |
|---|---|---|---|---|---|---|
| 十進位 | 0 | 0 | 16 | 10 | 4 | 0 |
| 二進位 | 000000 | 00000 | 10000 | 01010 | 00100 | 000000 |

```
000000 00000 10000 01010 00100 000000
= 0000 0000 0001 0000 0101 0001 0000 0000
= 0x00105100
```

（示意）若 `$s0` = 9 = `0000 … 0000 1001`，左移 4 位得 `0000 … 1001 0000` = 144 = 9 × 2⁴。

### 左移 i 位 = 乘以 2ⁱ

- 左移補 0 就等於乘 2：左移 1 位 ×2，左移 2 位 ×4。例如 3 左移一位變 6，再一位變 12。
- 右移就是除法：右移 1 位 ÷2，右移 2 位 ÷4（對 unsigned 數成立）。
- 為什麼重要？shift 很便宜，一個 R-type 指令就做完；乘法要對每個 bit 處理，又麻煩又慢。

> **例題** 聰明的 compiler 看到 a × 8 = a × 2³，就改成 `sll` 3 位。驗算：5 = `101`，左移 3 位 = `101000` = 40 = 5 × 8。

## AND 選出 bit、OR 設定 bit

### and：用 mask 選出 bit

and 是 bitwise：兩個數的 bit 一一配對做 AND，兩個都是 1 才得 1。

| a | b | a AND b | a OR b |
|---|---|---|---|
| 0 | 0 | 0 | 0 |
| 0 | 1 | 0 | 1 |
| 1 | 0 | 0 | 1 |
| 1 | 1 | 1 | 1 |

`$t2` 裡有一個值，只想留下其中某一塊 bit，其他通通清成 0。做法：準備一個 **mask**（遮罩）放在 `$t1`，要保留的位置放 1，其他放 0。

```asm
and $t0, $t1, $t2    # mask 是 1 的地方保留，是 0 的地方變 0
```

```
$t2 = 0000 0000 0000 0000 0000 1101 1100 0000   (0x00000DC0)
$t1 = 0000 0000 0000 0000 0011 1100 0000 0000   (0x00003C00，mask)
$t0 = 0000 0000 0000 0000 0000 1100 0000 0000   (0x00000C00)
```

### or：把指定 bit 設成 1

or 的用途相反：把某些 bit 設成 1，其他 bit 不動。`$t1` 想變成 1 的位置寫 1，其他寫 0。跟 1 做 OR 一定是 1，跟 0 做 OR 不變。

```asm
or $t0, $t1, $t2
```

```
$t2 = 0000 0000 0000 0000 0000 1101 1100 0000   (0x00000DC0)
$t1 = 0000 0000 0000 0000 0011 1100 0000 0000   (0x00003C00)
$t0 = 0000 0000 0000 0000 0011 1101 1100 0000   (0x00003DC0)
```

## NOT 用 NOR 加 `$zero` 做出來

MIPS 沒有 NOT，用 **nor** 代替：`a NOR b = NOT (a OR b)`，先 OR 再取 NOT。

要用 NOR 做出 NOT a，b 要放什麼？要讓 a OR b 還是 a，b 就要是 0（跟 0 做 OR 不變）：

```
a NOR 0 = NOT (a OR 0) = NOT a
```

可是 nor 是 R-type，只能拿 register 當運算元，不能直接寫常數 0。0 從哪來？答案是 **`$zero`**：第 0 號 register 永遠是 0。

```asm
nor $t0, $t1, $zero  # $t0 = NOT $t1
```

> **例題** 拿剛才的 mask：`$t1` = 0x00003C00 = `0000 0000 0000 0000 0011 1100 0000 0000`，取 NOT 得 `1111 1111 1111 1111 1100 0011 1111 1111` = **0xFFFFC3FF**。

> **重點** NOT 用 NOR 實作，一個運算元放 `$zero` 就好。shift、and、or、nor 都是在 bit 層次上操作。

## 做決定：beq、bne 與 j

到目前為止的指令都只是運算。程式如果只會從第一行一路做到最後一行，寫不出有用的東西；程式真正的威力在於**做決定**（if 條件成立做 A，else 做 B）和**重複**（一段 code 一直做，直到條件滿足才停，也就是 loop）。MIPS 用 **branch（分支）** 指令支援這兩件事。

| 指令 | 寫法 | 意思 | 種類 |
|---|---|---|---|
| beq（branch on equal） | `beq rs, rt, L1` | rs 和 rt 的值相等，就跳到 L1（go to L1） | conditional branch |
| bne（branch on not equal） | `bne rs, rt, L1` | rs 和 rt 的值不相等，才跳到 L1 | conditional branch |
| j（jump） | `j L1` | 不管條件，執行到就跳到 L1 | unconditional jump |

- L1 是 **label（標籤）**，代表要跳去的那一行指令。
- beq、bne 叫 **conditional branch（條件分支）**：條件滿足才跳。
- j 叫 **unconditional jump（無條件跳躍）**。

### beq 也能「一定跳」，那為什麼還要 j？

`beq $zero, $zero, L1` 比較兩個永遠是 0 的 register，一定相等，所以一定跳，意思跟 `j L1` 一樣。差別在 **instruction format（指令格式）**，因此能跳的範圍不同：

```
beq / bne：I-format
| op (6) | rs (5) | rt (5) | 目標 (16 bits) |

j：J-format（第三種格式）
| op (6) |        目標 (26 bits)          |
```

- beq、bne 的欄位是 op、兩個 register、一個 label，跟 I-type 一模一樣，扣掉 6 + 5 + 5 個 bit，只剩 16 個 bit 描述目標。
- j 除了 6 bit 的 op，後面 26 個 bit 全部用來描述要跳去哪。
- 所以 **beq/bne 只能在附近跳，j 可以跳比較遠**。目標位址實際怎麼算，留到 branch／jump addressing 再談。

> **陷阱** beq 和 j 在意義上都能「一定跳」，但 beq 是 I-type（16-bit 欄位），j 是 J-type（26-bit 欄位），能跳的範圍不同，不能說兩者完全等價。

## if-then-else 編成 bne 加 j

C 程式：

```c
if (i == j)
    f = g + h;
else
    f = g - h;
```

變數配置：f、g、h、i、j 依序放在 `$s0`、`$s1`、`$s2`、`$s3`、`$s4`。

流程圖：

```
          i == j ?
         /        \
     true          false
       |              |
   f = g + h      f = g - h
       \              /
        \            /
            Exit（下一個 statement）
```

兩條路（true path、false path）最後都要到同一個出口 Exit，接著做下一個 statement。

```asm
        bne  $s3, $s4, Else    # i != j 就跳到 Else（條件反過來寫）
        add  $s0, $s1, $s2     # 沒跳表示 i == j：f = g + h
        j    Exit              # then 部分做完，一定要跳到出口
Else:   sub  $s0, $s1, $s2     # f = g - h
Exit:                          # 下一個 statement
```

- **條件反過來寫**：C 寫的是「i == j 就做 then」，組合語言寫成「i != j 就跳去 Else」，這樣不跳的時候自然往下做 then 的部分。
- Else 做完 sub 之後，下一行就是 Exit，自然往下走，不必再跳。
- then 部分（add）做完，**一定要補 `j Exit`**。

> **陷阱** 忘了 `j Exit` 會怎樣？電腦一個指令接一個照順序執行，add 做完會乖乖執行下一行 sub，把剛算好的 f 蓋掉，結果變成 g − h。電腦就是這麼「笨」：不想做下一個指令，就要明確叫它 jump。

### 例題：兩條路各跑一次（示意）

設 g = 10、h = 4。

| 情況 | bne | 接著執行 | f（`$s0`） |
|---|---|---|---|
| i = 2, j = 2 | 相等，不跳 | add → j Exit | 14 |
| i = 2, j = 5 | 不相等，跳到 Else | sub → Exit | 6 |
| i = 2, j = 2，但漏寫 j Exit | 不跳 | add（f = 14）→ sub（f = 6）| 6（錯） |

## Loop：while 迴圈與陣列索引

C 程式：

```c
while (save[i] == k)
    i += 1;
```

變數配置：i 在 `$s3`，k 在 `$s5`，陣列 save 的起始位址（base）在 `$s6`。

### 難在哪：offset 會跟著 i 變

以前存取陣列，offset 是固定的常數，可以直接寫在 lw 裡；這裡 i 是 index，一直在變，所以 offset 必須在執行時先算出來。

- save[i] 的 byte offset = i × 4，因為一個 word 佔 4 個 byte。
- i = 3 → 從 base 加 12（不是 3）；i = 5 → 加 20。**永遠要乘 4**。
- 乘法很慢，所以用 shift：左移 2 位就是乘 4。

```asm
Loop:   sll  $t1, $s3, 2       # $t1 = i * 4（byte offset）
        add  $t1, $t1, $s6     # $t1 = base + offset = save[i] 的位址
        lw   $t0, 0($t1)       # $t0 = save[i]（位址已算好，offset 寫 0）
        bne  $t0, $s5, Exit    # save[i] != k：條件不滿足，跳出迴圈
        addi $s3, $s3, 1       # i = i + 1
        j    Loop              # 回到迴圈開頭再做一遍
Exit:
```

> **陷阱** index i 要先 ×4 變成 byte offset；因為 i 會變，offset 不能寫死在 lw 的常數欄位裡，要先算進 `$t1`，再用 `lw $t0, 0($t1)`。

### 例題：save 前四格是 5、5、5、7，k = 5

i 從 0 開始；save 的 base 假設為 2000（位址是示意）。

| 第幾圈 | i | `$t1` = i×4 | save[i] 位址 | `$t0` = save[i] | bne 結果 | 之後 |
|---|---|---|---|---|---|---|
| 1 | 0 | 0 | 2000 | 5 | 5 = 5，不跳 | i = 1，j Loop |
| 2 | 1 | 4 | 2004 | 5 | 不跳 | i = 2，j Loop |
| 3 | 2 | 8 | 2008 | 5 | 不跳 | i = 3，j Loop |
| 4 | 3 | 12 | 2012 | 7 | 7 ≠ 5，跳到 Exit | 離開 |

結束時 i 停在 3。

### Loop 的結構

```
Loop:  sll / add / lw   ← index：算出 save[i] 在哪，讀進 $t0
       bne ... Exit     ← 測試：條件不滿足就跳出去
       addi             ← body：這裡只有 i += 1，實際上可能有很多 statement
       j Loop           ← 回到 loop 開頭
Exit:
```

### Basic block

loop 可能跑上百、上千次，把 body 最佳化，效果就很大。compiler 常以 **basic block（基本區塊）** 為單位做 optimization。

- **basic block**：一段指令序列，**只有一個入口（entry point）在開頭、只在最後一行才跳出去**；中間沒有任何地方會被跳進來，也沒有任何指令跳出去。
- 例如上面 loop 的前四行（sll、add、lw、bne）就是一個 basic block：只能從 Loop 進來，只在 bne 可能離開。

## slt：判斷「小於」

寫程式除了等於、不等於，還需要大於、小於、大於等於、小於等於。beq、bne 只能判斷 == 和 !=，其他四種做不到。MIPS 只多加一個指令：

| 指令 | 寫法 | 意思 | 格式 |
|---|---|---|---|
| slt（set on less than） | `slt rd, rs, rt` | rs < rt 則 rd = 1，否則 rd = 0 | R-type |

做法：先用 slt 算出 0 或 1，再用 conditional branch 拿它跟 `$zero` 比，決定要不要跳。

### 例題：if (g < h) goto Less;（g 在 `$s0`，h 在 `$s1`）

```asm
        slt  $t0, $s0, $s1     # g < h ? $t0 = 1 : $t0 = 0
        bne  $t0, $zero, Less  # $t0 != 0 表示 g < h 成立，跳到 Less
```

設 g = 3、h = 7：3 < 7 成立，`$t0` 被 set 成 1；1 ≠ 0，bne 跳到 Less。只要兩個指令。

另有 immediate 版本 `slti rt, rs, 常數`：rs < 常數則 rt = 1，否則 0（後面的 fact 會用到）。

## 為什麼沒有 blt：省 opcode、不拖慢 clock

既然要比大小，為什麼不直接設計 blt（小於就跳）、ble、bgt、bge 四個指令？

1. **省 opcode**：要多用掉 4 個 opcode，而 opcode 只有 6 個 bit，很珍貴。只要一個 slt，把兩個 register 的位置換一換，再配 beq 或 bne，就做得出四種比較。
2. **不拖慢 clock**：每個指令都要在一個 clock cycle 內做完，所有指令共用同一個 clock，clock period 一樣長。如果「比較」加「跳躍」合成一個指令，這個指令要做很多事，clock period 就得拉長，連 add、lw 也全被拖慢。拆成 slt + bne 兩個指令，雖然要兩個 cycle，但每個 cycle 還是短的，其他指令不受影響。

> **比喻** clock 像一把一直轉的刀子，轉一圈做一件事。只要有一個指令一圈做不完，整把刀就得轉慢一點，所有指令都跟著變慢。

beq、bne 才是最常用的 **common case**，讓它們保持簡單快速，這就是 **make the common case fast** 的設計原則。

### 練習：四種比較都只用 slt + beq/bne（a 在 `$s0`，b 在 `$s1`）

提示：交換 a、b 的位置決定是「小於」還是「大於」；用 bne 或 beq 決定有沒有等號。

```asm
# if (a <  b) goto L
        slt  $t0, $s0, $s1     # $t0 = (a < b)
        bne  $t0, $zero, L     # 成立就跳

# if (a >  b) goto L   等於 b < a
        slt  $t0, $s1, $s0     # $t0 = (b < a)
        bne  $t0, $zero, L

# if (a >= b) goto L   等於 not (a < b)
        slt  $t0, $s0, $s1     # $t0 = (a < b)
        beq  $t0, $zero, L     # a < b 不成立就跳

# if (a <= b) goto L   等於 not (b < a)
        slt  $t0, $s1, $s0     # $t0 = (b < a)
        beq  $t0, $zero, L
```

> **陷阱** 在 assembly 程式裡看到的 `blt`，是 **pseudo-instruction（虛擬指令）**：assembler 會把它換成 slt + bne（借用 `$at` 暫存），硬體並沒有這個指令。

## Signed 與 unsigned 的比較

同一串 bit，當 signed 或 unsigned 看，大小關係可能相反。

> **例題** `$s0` = 1111 1111 1111 1111 1111 1111 1111 1111（32 個 1），`$s1` = 0000 … 0001（= 1）。
> 當 unsigned：`$s0` = 4,294,967,295，比 1 大。
> 當 signed（two's complement）：最前面的 1 代表負數，`$s0` = −1，比 1 小。

```asm
        slt  $t0, $s0, $s1     # signed 比較：-1 < 1 成立，$t0 = 1
        sltu $t1, $s0, $s1     # unsigned 比較：4,294,967,295 < 1 不成立，$t1 = 0
```

- **slt** 做 signed 比較，**sltu**（set on less than unsigned）做 unsigned 比較。同一串 bit，結果不同，寫程式要用對指令。

到這裡，加減、logical、branch 都會了。接下來是組合語言最難的部分：procedure call。

## Procedure call 的六個步驟

整支程式寫成一大坨很沒組織。有了 **procedure（程序，函式）**，同一段 code 可以 **reuse**，程式也能寫得 **modular**。

角色：

- **caller（呼叫者）**：去叫別人的，像爸爸。
- **callee（被呼叫者）**：被叫的，像兒子。

六個步驟：

1. caller 把 **parameter（參數）** 放到 callee 拿得到的地方。同一個 procedure 叫很多次，參數不同，結果就不同。
2. 把 **control（執行權）** 交給 callee：跳到 procedure 那邊執行。
3. callee 取得需要的 **storage**，例如自己的 local variable。
4. 執行 procedure 的工作。
5. 把結果放在 caller 拿得到的地方。
6. 把 control 交回 caller，回到原來呼叫的地方繼續往下做。

在 assembly 裡：

- 參數要放在 **register**，因為運算都靠 register；而且位置要**固定**，否則 callee 不知道去哪裡拿。
- 結果也放在固定的 register，回到 caller 才知道去哪裡拿。
- 麻煩在於：爸爸叫兒子、兒子還會叫孫子，可是 **register file 只有一份**，大家共用，資料要放哪？這是後面要一一處理的問題。

## leaf_example：需要哪些特別的 register

```c
int main() {
    ...
    sum = leaf_example(a, b, c, d);
    ...
}

int leaf_example(int g, int h, int i, int j) {
    int f;
    f = (g + h) - (i + j);
    return f;
}
```

呼叫那一行和 procedure 本身在程式的不同地方（可能一個在第 5 行、一個在第 100 行）。執行到呼叫時要跳過去，算完再跳回來，接著往下做。需要：

| 需要什麼 | MIPS 的做法 |
|---|---|
| 回來的位置：呼叫的「下一個 statement」，叫 **return address（返回位址）** | 專門放在 **`$ra`** |
| 要跳去哪：procedure 的位址 | 跟 jump 一樣用 label 表示，這裡是 `leaf_example` |
| 參數（這次可能是 3、5、7、8，下次又是別的數） | **`$a0`～`$a3`**（a = argument） |
| 回傳值 | **`$v0`、`$v1`**（v = value） |
| 運算用的 register | 如 `$s0`～`$s7`、`$t0`～`$t7`，各有固定用途，不是亂用的 |

## 32 個 register 的分工

| 名稱 | 編號 | 用途 |
|---|---|---|
| `$zero` | 0 | 硬體接死，永遠是 0 |
| `$at` | 1 | 保留給 assembler（展開 pseudo-instruction 用） |
| `$v0`–`$v1` | 2–3 | 回傳值（value） |
| `$a0`–`$a3` | 4–7 | 參數（argument） |
| `$t0`–`$t7` | 8–15 | temporary |
| `$s0`–`$s7` | 16–23 | saved |
| `$t8`–`$t9` | 24–25 | temporary |
| `$k0`–`$k1` | 26–27 | 保留給 OS |
| `$gp` | 28 | global pointer |
| `$sp` | 29 | stack pointer |
| `$fp` | 30 | frame pointer |
| `$ra` | 31 | return address，別人不能亂用 |

- 寫 `$t0` 或 `$8` 都可以，指的是同一個 register。
- 之前 `$s` 和 `$t` 用起來好像沒差，到了 procedure call 用法就不同了（見後面的 register convention）。
- `$sp` 在呼叫 procedure 時馬上就會用到。

## Program Counter：下一個指令的位址

呼叫 procedure，第一件事是跳到 subroutine 那邊去。會跳的指令學過了：beq、bne 跳短距離，j 跳比較遠；要跳到 subroutine，一個 jump 就夠。可是跳過去不能就算了，做完還得**跳回來**，回到呼叫那一行的「下一個 instruction」。

問：程式執行時，「下一個要執行哪個指令」記在哪裡？
答：**Program Counter（PC，程式計數器）**。PC 裝的就是下一個要執行的指令位址。

- 不跳的時候是 **sequential（循序）執行**：一個指令 4 bytes，PC 每次加 4，1000 → 1004 → 1008 往下走。
- 要跳，就把 **target address（目標位址）** 放進 PC，下一步就從那裡執行。例如 subroutine 在位址 37685（隨口舉的數；真正的指令位址都是 4 的倍數），把 PC 設成這個位址就跳過去了。

## jal 與 jr `$ra`

### 例題：PC 在位址 1000 的呼叫指令，procedure 在 3468（位址皆為示意數字）

```
呼叫前：PC = 1000（呼叫指令）
跳過去：$ra ← 1000 + 4 = 1004   （記住 next instruction）
        PC  ← 3468              （下一個從 procedure 開始執行）
  ...procedure 執行...
跳回來：PC  ← $ra = 1004        （回到呼叫的下一行）
```

照理說兩個指令就能做到：一個把位址存進 `$ra`，一個 jump 過去。MIPS 把它合成**一個指令**：

| 指令 | 動作 |
|---|---|
| `jal ProcedureLabel`（jump and link） | `$ra = PC + 4`，然後 `PC = ProcedureLabel 的位址` |
| `jr $ra`（jump register） | `PC = $ra`（把第 31 號 register 的值 copy 到 PC） |

- 為什麼特別設計 jal？procedure call 太常用，這兩件事又很快做得完，合成一個指令就是 **make the common case fast**。
- jr 能用是因為 register 剛好 32 bits，等於一個位址的長度。
- jr 不只用在 procedure return，也能實作 **switch-case**：把各個 case 的程式位址放進 register，再 `jr` 過去。
- 結論：要實作 procedure call，一定要這兩個指令：**jal** 和 **jr**。

> **陷阱** jal 存進 `$ra` 的是「jal 的**下一個**指令」的位址（PC + 4），不是 jal 自己的位址。上例 `$ra` = 1004，不是 1000。

## Caller 這邊：搬參數、jal、拿結果

`sum = leaf_example(a, b, c, d);`：a、b、c、d 正在 main 裡運算，放在 `$s0`～`$s3`（示意值 5、3、4、2），sum 放在 `$s4`。

```asm
        add  $a0, $s0, $zero   # $a0 = a（加 0 等於 copy，就是 move）
        add  $a1, $s1, $zero   # $a1 = b
        add  $a2, $s2, $zero   # $a2 = c
        add  $a3, $s3, $zero   # $a3 = d
        jal  leaf_example      # $ra = 下一行的位址，跳到 leaf_example
        add  $s4, $v0, $zero   # 回來後結果在 $v0：sum = $v0
```

- `add $a0, $s0, $zero`：`$zero` 永遠是 0，加 0 等於沒變，就是把 `$s0` copy 到 `$a0`。這招其實就是 `move`（pseudo-instruction `move $a0, $s0`）。
- 回來時 `$v0` = (5 + 3) − (4 + 2) = 2，搬到 `$s4` 後 sum = 2。

## Callee 這邊：register 衝突

callee 要算 f = (g + h) − (i + j)：

- g、h、i、j 已由 caller 放在 `$a0`～`$a3`。
- local 變數 f 用 `$s0` 放。
- 一個指令只能加兩個數，所以 g + h、i + j 先放 temporary `$t0`、`$t1`。
- 結果放 `$v0` 回傳。

問題來了：**caller 自己也在用 `$s` 和 `$t`**！callee 又要用 `$s0`、`$t0`、`$t1`，兩邊搶同一批 register。register file 只有一份，不管跑到 main 還是 procedure 都用同一份；callee 一用，caller 的資料就被蓋掉。

> **比喻** 爸爸出門，你在家開 party 可以，但他回來之前要全部恢復原狀，不能讓他發現。callee 知道自己要用哪幾個 register，就在用之前先把舊值存起來，做完再還原。

## 存到 stack：記憶體與 `$sp`

舊值存在記憶體裡的 **stack（堆疊）**。記憶體很大，放得下。

- stack 是 **last in first out（LIFO，後進先出）**：新資料 **push** 到 **top of stack**，用完就 **pop** 掉。
- **stack pointer** 記住現在用到哪，指著 top of stack；它就是第 29 號 register **`$sp`**。
- 圖上方是高位址，**stack 從高位址往低位址長**：push 時 `$sp` 要先**減**，pop 時**加**回來。
- procedure 執行時，把要用的 `$s0` 和兩個 temporary 存進去，stack 往下長 3 格，`$sp` 跟著往下；procedure 一結束就把資料拿回來，`$sp` 回到原位，回到爸爸那邊就像什麼都沒發生過。

## leaf_example 完整程式，一行一行跑

```asm
leaf_example:
        addi $sp, $sp, -12     # stack 挪出 3 格（3 個 word × 4 bytes）
        sw   $t1, 8($sp)       # 存 $t1 的舊值
        sw   $t0, 4($sp)       # 存 $t0 的舊值
        sw   $s0, 0($sp)       # 存 $s0 的舊值
        add  $t0, $a0, $a1     # $t0 = g + h
        add  $t1, $a2, $a3     # $t1 = i + j
        sub  $s0, $t0, $t1     # f = $t0 - $t1
        add  $v0, $s0, $zero   # 回傳值 $v0 = f
        lw   $s0, 0($sp)       # 還原 $s0
        lw   $t0, 4($sp)       # 還原 $t0
        lw   $t1, 8($sp)       # 還原 $t1
        addi $sp, $sp, 12      # pop 3 格，$sp 回到原位
        jr   $ra               # 回到 caller
```

### 例題：逐行追蹤

起始狀態（示意值）：jal 已執行，`$ra` 已記好回去的位址，PC 在 leaf_example 第一行；參數 `$a0`～`$a3` = 5、3、4、2；`$s0`、`$t0`、`$t1` 原本是 11、22、33；`$sp` = 1000。

**1. `addi $sp, $sp, -12`**：要存 3 個資料，每個 4 bytes，共 12 bytes；stack 往低位址長，所以減 12。`$sp` = 988，空出 988、992、996 三格。

```
位址    內容
1000    （caller 的資料）
 996    ?
 992    ?
 988    ?          ← $sp
```

**2. `sw $t1, 8($sp)`**：位址 = `$sp` + 8 = 996，存入 `$t1` 的舊值 33。這就是 base + offset，只是 base register 換成 `$sp`。

**3. `sw $t0, 4($sp)`**：存到 992。**4. `sw $s0, 0($sp)`**：存到 988。三個會被破壞的 register 都存好了：

```
位址    內容
1000    （caller 的資料）
 996    33   （舊 $t1）
 992    22   （舊 $t0）
 988    11   （舊 $s0）  ← $sp
```

**5～8. 計算**（舊值都存好了，可以放心用）：

| 指令 | 結果 |
|---|---|
| `add $t0, $a0, $a1` | `$t0` = 5 + 3 = 8 |
| `add $t1, $a2, $a3` | `$t1` = 4 + 2 = 6 |
| `sub $s0, $t0, $t1` | `$s0` = f = 8 − 6 = 2 |
| `add $v0, $s0, $zero` | `$v0` = 2 |

這樣可以走了嗎？**不行**。走之前要恢復原狀，stack 裡那三格就是要拿回來的舊值。

**9～11. 還原**：`lw` 一個個載回來，`$s0` = 11、`$t0` = 22、`$t1` = 33。

**12. `addi $sp, $sp, 12`**：`$sp` 回到 1000。

**13. `jr $ra`**：跳回 caller。此時 `$v0` = 2，其他 register 和 `$sp` 全部復原，爸爸完全看不出來。

> **陷阱** stack 往低位址長：push 要先把 `$sp` **減**掉，pop 要**加**回來；sw/lw 的 offset 以 `$sp` 為 base。

## `$t` 與 `$s`：誰負責保存（register convention）

> **比喻** 爸爸出門把家交給你。冰箱被吃光他不在乎，桌上的玻璃可不能打破。爸爸不在乎的東西放 `$t`（temporary），被弄亂就算了；爸爸在乎的東西放 `$s`（saved），絕對不能破壞。

有了這個約定，callee 只要存 `$s`，`$t` 不用存，少做幾次 load、store，程式更有效率。leaf_example 因此只要存 `$s0`，stack 只長一格：

```asm
leaf_example:
        addi $sp, $sp, -4      # 只挪出 1 格
        sw   $s0, 0($sp)       # 只存 $s0
        add  $t0, $a0, $a1     # $t0 = g + h（$t 不必保存）
        add  $t1, $a2, $a3     # $t1 = i + j
        sub  $s0, $t0, $t1     # f = (g + h) - (i + j)
        add  $v0, $s0, $zero   # 回傳 f
        lw   $s0, 0($sp)       # 還原 $s0
        addi $sp, $sp, 4       # pop
        jr   $ra               # 回到 caller
```

- **caller 的責任**：不能期待 `$t` 不變（房子交給兒子，就要有冰箱被吃光的心理準備）。在乎的資料不要放 `$t`，要放 `$s`，或自己先存好；放 `$t` 就代表不在乎。
- **callee 的責任**：`$t` 隨便用，但只要用到 `$s`，就保證先存起來、用完還原。

這叫 **register convention**：`$t` 是 **caller-saved**，`$s` 是 **callee-saved**，考試常這樣問。

> **陷阱** caller-saved 的意思是「要保存得由 caller 自己存」，callee 不保證保留（`$t`）；callee-saved 是「callee 用到就必須存並還原」（`$s`）。別把名字的方向弄反。

## Non-leaf procedure：`$ra` 一定要存

真實情況沒這麼單純：祖父叫爸爸、爸爸叫你、你又叫你兒子，一代一代往下。

- **leaf procedure**：不再呼叫別人的 procedure，像樹葉長在最末端（leaf_example 就是）。
- **non-leaf procedure**：還會呼叫別的 procedure，包括 **nested call（巢狀呼叫）** 和自己叫自己的 **recursive call（遞迴呼叫）**。

每一代都用同一份 register file，所以交給下一代之前，相關資料都要先存起來：

- 每叫一層，就在 top of stack 放一塊屬於它的資料，stack 一層層往下長。
- return 之後，那一塊就 pop 掉，回到上一層；上一層做完再 pop。這是 procedure call 最基本的概念。只要 stack 安排好，nested 或 recursive 都沒問題。

最要注意的是 **return address**，一定要回得去：

```
祖父 jal 爸爸：$ra = 「回祖父」的位址
爸爸 jal 你  ：$ra = 「回爸爸」的位址   ← 「回祖父」被蓋掉了！
```

所以爸爸叫兒子之前，要先把自己的 `$ra` 存到 stack，回來再取出來，才回得了祖父那邊。argument、temporary 等之後還要用的也要存；叫完再把 stack 恢復原樣。

> **陷阱** non-leaf procedure 用 jal 呼叫別人時會覆寫 `$ra`，所以必須先把 `$ra` 存到 stack。

## 遞迴 fact(n)：完整程式與 stack 追蹤

```c
int fact(int n) {
    if (n < 1) return 1;
    else return n * fact(n - 1);
}
```

注意 else：叫完 fact(n − 1) 回來**還沒結束**，還要把回傳值乘上現在的 n 才 return。

### 要存哪些東西

站在「爸爸」（這一層 fact）的角度想兩件事：「我要 call 兒子」和「我做完要回去」。

- **`$a0`（n）**：呼叫 fact(n − 1) 前，`$a0` 要改成 n − 1（例如 3 變 2），可是回來要乘的是原本的 3，它已經不見了 → **要存**。
- **`$ra`**：自己做完還要回到上一層，而 jal 會把它蓋掉 → **要存**。
- **`$v0`**：兒子會用 `$v0` 回傳，可是這一層現在沒在用它 → **不用存**。

要存兩個，每個 4 bytes，所以 `$sp` 減 8。

### 完整 MIPS 程式

```asm
fact:
        addi $sp, $sp, -8      # stack 挪出 2 格
        sw   $ra, 4($sp)       # 存 return address
        sw   $a0, 0($sp)       # 存參數 n
        slti $t0, $a0, 1       # n < 1 ? $t0 = 1 : $t0 = 0
        beq  $t0, $zero, L1    # $t0 == 0（n >= 1）就跳到 L1 遞迴
        addi $v0, $zero, 1     # base case：回傳 1
        addi $sp, $sp, 8       # pop 2 格（$a0、$ra 沒被改，不必 lw）
        jr   $ra               # 回到上一層
L1:     addi $a0, $a0, -1      # 參數改成 n - 1
        jal  fact              # 呼叫 fact(n - 1)；$ra = 下一行的位址
        lw   $a0, 0($sp)       # 回來了：取回原本的 n
        lw   $ra, 4($sp)       # 取回原本的 return address
        addi $sp, $sp, 8       # pop 2 格
        mul  $v0, $a0, $v0     # $v0 = n * fact(n - 1)
        jr   $ra               # 回到上一層
```

逐段說明：

- **測 n < 1**：判斷小於用 slt 配 beq/bne；這裡跟常數 1 比，所以用 immediate 版 `slti $t0, $a0, 1`。n < 1 則 `$t0` = 1，否則 0。`beq $t0, $zero, L1`：`$t0` = 0 表示 n < 1 不成立，跳到 L1 遞迴。
- **base case（termination condition，終止條件）**：`addi $v0, $zero, 1` 把 1 放進 `$v0`；`addi $sp, $sp, 8` 還原 stack；`jr $ra`。這一層沒動到 `$a0` 和 `$ra`，所以不必 lw 回來。
- **L1（遞迴）**：`addi $a0, $a0, -1` 參數減 1；`jal fact` 叫自己。回來時兒子的回傳值 fact(n − 1) 已在 `$v0`。
  - `$a0` 剛才被改成 n − 1，所以先 `lw $a0, 0($sp)` 拿回原本的 n。
  - jal 把 `$ra` 改掉了，所以 `lw $ra, 4($sp)` 拿回原本的 return address。
  - `addi $sp, $sp, 8` 恢復 stack pointer。
  - `mul $v0, $a0, $v0` 就是 n × fact(n − 1)，最後 `jr $ra` 回到上一層。
- **兩條路比較**：base case 沒動 `$a0`、`$ra`，只還原 `$sp`；else 叫過 procedure，所以多兩個 lw。

> **陷阱** 回來後要先 `lw $a0` 拿回原本的 n 再乘；若直接用 `$a0`，乘到的是 n − 1，答案會錯。

### 例題：追蹤 fact(3)

起始：`$sp` = 1000。為了畫出 `$ra` 的內容，另外假設（示意）：main 在位址 4000 執行 `jal fact`，所以回 main 的位址是 4004；fact 的程式從 8000 開始，每個指令 4 bytes，`jal fact` 在 8036，因此「回到 fact 裡 jal 的下一行（`lw $a0, 0($sp)`）」的位址是 8040。

**往下呼叫（每層 push 8 bytes）**

| 步驟 | 這一層 | 進入時 `$a0` | 進入時 `$ra` | push 後 `$sp` | slti → `$t0` | 動作 |
|---|---|---|---|---|---|---|
| 1 | fact(3) | 3 | 4004 | 992 | 0 | 跳 L1，`$a0` = 2，jal（`$ra` = 8040） |
| 2 | fact(2) | 2 | 8040 | 984 | 0 | 跳 L1，`$a0` = 1，jal |
| 3 | fact(1) | 1 | 8040 | 976 | 0 | 跳 L1，`$a0` = 0，jal |
| 4 | fact(0) | 0 | 8040 | 968 | 1 | base case |

最深時（四層 n = 3、2、1、0，每層 8 bytes，`$sp` 降到 968）的 stack：

```
位址    內容
1000    （main 的資料）
 996    $ra = 4004（回 main）     ┐ fact(3) 的 frame
 992    $a0 = 3                   ┘
 988    $ra = 8040（回 fact(3)）  ┐ fact(2) 的 frame
 984    $a0 = 2                   ┘
 980    $ra = 8040（回 fact(2)）  ┐ fact(1) 的 frame
 976    $a0 = 1                   ┘
 972    $ra = 8040（回 fact(1)）  ┐ fact(0) 的 frame
 968    $a0 = 0                   ┘   ← $sp
```

**往回返回（每層 pop 8 bytes）**

| 步驟 | 這一層 | 動作 | lw 取回的 `$a0` | lw 取回的 `$ra` | pop 後 `$sp` | `$v0` | jr 到 |
|---|---|---|---|---|---|---|---|
| 5 | fact(0) | `$v0` = 1，只還原 `$sp` | （不 lw） | （不 lw，仍是 8040） | 976 | 1 | 8040（fact(1)） |
| 6 | fact(1) | lw、lw、pop、mul | 1 | 8040 | 984 | 1 × 1 = 1 | 8040（fact(2)） |
| 7 | fact(2) | lw、lw、pop、mul | 2 | 8040 | 992 | 2 × 1 = 2 | 8040（fact(3)） |
| 8 | fact(3) | lw、lw、pop、mul | 3 | 4004 | 1000 | 3 × 2 = 6 | 4004（main） |

結果 `$v0` = 6 = 3 × 2 × 1。全部回來以後，`$sp` 又回到 1000，一點都不亂。注意步驟 8 從 stack 取回的 `$ra` 是 4004，正是因為一開始有把它存起來，才回得了 main。

## Procedure frame（activation record）

一次呼叫在 stack 上放的東西：

- 會用到的 **argument**（saved argument registers）
- 最重要的 **return address**
- 會用到的 **`$s` register**
- procedure 自己的 **local 變數**，如 local array、structure，也由 callee 配置在這裡

```
高位址
        |  caller 的資料           |  ← 呼叫前 $sp、$fp 指在這附近
        +--------------------------+
        |  saved argument 暫存器   |  ┐
        |  saved return address    |  │ 這一次呼叫的
        |  saved $s 暫存器         |  │ activation record
        |  local arrays、structures|  ┘  ← $sp（top of stack）
低位址
```

- 這一整塊叫 **activation record（活動記錄）**，也叫 **procedure frame（程序框架）**。
- 每叫一次 procedure，就在 stack 頂端建一個 activation record；procedure 做完，就把它 pop 掉，從 stack 上刪除，`$sp` 回到原位。
- **`$fp`（frame pointer）** 指著目前這個 frame 的起點；`$sp` 則一直指著 top of stack。

## Memory layout：記憶體怎麼分區

整個 memory 看成一條一維的長條，從位址 0 往上：

```
位址（hex）
7fff fffc  ← $sp →  Stack              （往下長 ↓）
                     ......（空白）......
                     Dynamic data (heap)（往上長 ↑）
1000 8000  ← $gp     Static data
1000 0000
0040 0000  ← PC      Text（程式碼）
0000 0000            Reserved
```

| 區域 | 放什麼 |
|---|---|
| Reserved | 最底下，保留給特別用途 |
| Text | 程式，也就是指令；從 0040 0000 開始，PC 一開始就指在這 |
| Static data | 整個執行期間都存在的資料，如 global 變數；`$gp` 指在 1000 8000 |
| Dynamic data（heap） | 執行時才決定要不要配置的資料，如 C 的 malloc、Java 的 new、pointer 指到的資料；從下往上長 |
| Stack | 從最上面開始（`$sp` 初值 7fff fffc），往下長 |

- heap 往上、stack 往下，兩者往中間的空白處靠攏。

問：為什麼 `$sp` 用「減」的？
答：stack 從記憶體最上面開始往下長，所以 push 時 `$sp` 一定先減。

- 不管在哪一區，load、store 的方式都一樣：給 base address 和 offset 就拿得到。

## Procedure convention：caller 與 callee 的約定

> **觀念** 其實硬體根本不管：`$s`、`$t` 亂用也能跑，只要你自己記得哪些會被弄掉。但這樣很容易寫錯；而且 caller 和 callee 可能是不同人寫的，各用各的就會亂成一團。所以兩邊之間訂一份 **contract（契約）**：哪些能動、哪些不能動。就像你跟爸爸先講好，不同人寫的程式也能合作。

- caller：發出 jal 的 function；callee：被叫的 function。

| | callee 的權利（可以亂動） | callee 的義務（必須保持原狀） |
|---|---|---|
| register | `$v0`–`$v1`、`$a0`–`$a3`、`$t0`–`$t9`、`$ra` | `$s0`–`$s7`、`$sp` |
| 誰負責保存 | caller（caller-saved） | callee（callee-saved） |

- **caller 的責任**：自己的 return address 要顧好；`$a0`～`$a3`、`$v0`、`$v1` 之後還要用原值的話，自己存，callee 不會幫你還原；`$t` 也一樣，想保留就自己存到 stack。
- **caller 的權利**：`$s` 回來一定是原狀，想保護的東西就放 `$s`。
- **callee 的責任**：只負責 `$s` 和 `$sp`：用到就先存，回去之前還原。

> **陷阱** caller-saved：`$t`、`$a`、`$v`、`$ra`；callee-saved：`$s`（以及 `$sp`）。

### 整理：caller 與 callee 各做哪些事

**caller**

1. 把 `$sp` 往下挪，需要保留的 `$v`、`$a`、`$t`、`$ra` 存進 stack；`$s` 不用存，callee 會負責。
2. 把參數放進 `$a0`～`$a3`，然後 `jal` 跳過去。
3. 回來後從 `$v0`、`$v1` 拿結果。
4. 把存起來的值拿回來，恢復 stack pointer。

**callee**

1. `$s` 不能亂弄，要用就先存（`$sp` 往下挪、sw）；然後拿參數做運算。
2. 做完把結果放 `$v0`、`$v1`。
3. 回去前還原 `$s` 和 `$sp`，然後 `jr $ra` 跳回去。

兩邊分工清楚，程式就不會亂。

## 字元資料：ASCII 與 Unicode

電腦要跟人溝通，人用的是 A、B、C 這些符號，不是 0101。英文字母、標點符號、中文字等各式各樣的 symbol，叫 **character data（字元資料）**。

> **觀念** 不管是 2's complement 的數字、指令，還是字元，在電腦裡全都是 0101 的 bit pattern；差別只在怎麼解釋它。同一串 bit，當數字看是一個意思，當字元看又是另一個意思。哪個 pattern 叫 A、哪個叫 B，說穿了就是一個規定（encoding），大家照著規定用就好。

| 編碼 | 每個字元 | 字元數 |
|---|---|---|
| **ASCII** | 1 byte（8 bits） | 128 個 |
| **Latin-1** | 1 byte | 256 個 |
| **Unicode** | 32-bit character set | 全世界的文字（包括中文）幾乎都在裡面 |

- 例：大寫 'A' 的 ASCII = 65 = 0100 0001₂。
- 例：「中」的 Unicode 編號是 U+4E2D。

## lb、lbu、sb：把一個 byte 放進 32-bit register

數字通常是 32 bits，但一個 ASCII 字元只要讀一個 byte 就夠了，所以 MIPS 有 byte 和 halfword（2 bytes）的指令：

| 種類 | load | store |
|---|---|---|
| byte | lb（signed）、lbu（unsigned） | sb |
| halfword | lh（signed）、lhu（unsigned） | sh |

load 又分兩種解讀：把資料當 **signed number**，或當 **unsigned number**（例如當字元看）。

### 一個 byte 放在 register 的哪裡？

register 永遠是 32 bits；記憶體卻是 byte address，可以拿 1、2 或 4 個 byte。從記憶體只搬一個 byte（8 bits）進來：

- 規定放在 register 的**最右邊**（低 8 位）。
- 左邊剩下的 24 bits 填什麼，看用哪個指令：
  - **lb**：當 signed，左邊 24 bits 全填這個 byte 的 sign bit，叫 **sign extension（符號延伸）**。
  - **lbu**：當 unsigned，左邊 24 bits 全補 0，叫 **zero extension（零延伸）**。
  - lh、lhu 同理（左邊 16 bits）。
- **sb**（store byte）：從 register 存一個 byte 到記憶體，存的是**最右邊**那個 byte；sh 存最右邊 2 個 byte。

### 例題：同一個 byte F7，lb 和 lbu 結果不同

`$t0` 是 base register，指到記憶體裡一個 byte，內容是 0xF7 = 1111 0111。

```asm
        lb   $t1, 0($t0)       # 當 signed 讀進來
        lbu  $t2, 0($t0)       # 當 unsigned 讀進來
```

```
記憶體 byte：                                 1111 0111  (F7)

lb  → $t1 = 1111 1111 1111 1111 1111 1111  1111 0111
            └─ 24 bits 全填 sign bit 1 ─┘
          = 0xFFFFFFF7 = -9

lbu → $t2 = 0000 0000 0000 0000 0000 0000  1111 0111
            └──── 24 bits 全補 0 ─────┘
          = 0x000000F7 = 247
```

驗算：0xF7 = 247；當 8-bit two's complement 是 247 − 256 = −9。同一個 byte，指令不同，register 裡的結果就不同。

> **陷阱** lb 會 sign-extend：F7 這種最高位是 1 的 byte，用 lb 讀會變成負數；處理字元通常用 **lbu**。

## 傳地址也是 32 bits：call by value 與 call by reference

下一個例子是 string copy（strcpy）：把字串 y 一個字元一個字元複製到 x，直到字串結尾的 `\0`（null，值為 0）。

```c
void strcpy(char x[], char y[]) {
    int i;
    i = 0;
    while ((x[i] = y[i]) != '\0')   /* 複製一個字元，並檢查是不是 \0 */
        i += 1;
}
```

問：C 的 call by value 和 call by reference 有什麼不同？
答：
- **call by value（傳值）**：傳一個值過去，對方拿去算，算完就結束了。
- **call by reference（傳參考）**：傳一個地址過去，所有的變化都發生在那個地址裡的資料上。

C 把 array 傳給 function，傳的是**地址**，所以 strcpy 的 x、y 其實都是位址。地址也是 32 bits，一樣放在 register：x 的位址放 `$a0`，y 的位址放 `$a1`。拿到地址要取得裡面的資料，就是 load：把地址當 base register，再加上 offset。

> **重點** 不管 by value 還是 by reference，參數都放在 register：是值就直接用，是地址就當 base register 用。

## strcpy 寫成 MIPS

- caller 已把 x、y 的**地址**（不是值）放在 `$a0`、`$a1`。
- 迴圈變數 i 用 `$s0`。s 開頭的 register 是爸爸希望保持原狀的，小孩子不能把它弄壞，所以 callee 要先存 `$s0`。

```asm
strcpy:
        addi $sp, $sp, -4      # stack 挪出 1 格
        sw   $s0, 0($sp)       # callee 的責任：存 $s0 的舊值
        add  $s0, $zero, $zero # i = 0
L1:     add  $t1, $s0, $a1     # $t1 = y[i] 的地址（char 一個 byte，i 不用乘 4）
        lbu  $t2, 0($t1)       # $t2 = y[i]
        add  $t3, $s0, $a0     # $t3 = x[i] 的地址
        sb   $t2, 0($t3)       # x[i] = $t2（和上面的 lbu 合起來才是 x[i] = y[i]）
        beq  $t2, $zero, L2    # 剛搬的是 \0 就結束
        addi $s0, $s0, 1       # i = i + 1
        j    L1                # 回去搬下一個字元
L2:     lw   $s0, 0($sp)       # 還原 $s0
        addi $sp, $sp, 4       # pop
        jr   $ra               # 回到 caller
```

- `\0` 本身也會被複製過去（先 sb 再測試）。
- 跳出去之前要恢復 `$s0` 和 `$sp`，再 `jr $ra`。

### 例題：複製字串 "Hi"

設（示意位址）y 在 3000、x 在 4000，即 `$a0` = 4000、`$a1` = 3000；`$s0` 原值為 77；`$sp` = 1000。'H' = 72、'i' = 105（ASCII）。

| 步驟 | i（`$s0`） | `$t1` | `$t2` | `$t3` | sb 之後 | beq |
|---|---|---|---|---|---|---|
| 進入 | — | | | | stack：996 存 77，`$sp` = 996 | |
| 1 | 0 | 3000 | 'H'（72） | 4000 | x[0] = 'H' | 72 ≠ 0，不跳 → i = 1 |
| 2 | 1 | 3001 | 'i'（105） | 4001 | x[1] = 'i' | 不跳 → i = 2 |
| 3 | 2 | 3002 | '\0'（0） | 4002 | x[2] = '\0' | 0 = 0，跳 L2 |
| L2 | | | | | `$s0` = 77，`$sp` = 1000 | jr `$ra` |

結果：x 變成 "Hi" 再加一個 `\0`；`$s0` 還原成原本的 77，`$sp` 回到原位。

> **陷阱** char 一個 byte，所以 index 不用 ×4（對照前面 save[i] 是 int，要 sll 2）；搬字元用 lbu/sb，不是 lw/sw。

## strcpy 的兩個重點

1. **argument 可以是值，也可以是地址**：反正都是 32 bits，放在 `$a0`～`$a3`。如果是地址，就拿它當 base register，去 reference 記憶體裡的資料。
2. **MIPS 沒有 memory → memory 的指令**：要把記憶體 A 的資料搬到記憶體 B，一定要先 load 進 register file，再從 register store 到 B。MIPS 是 **load-store machine**，運算和搬移都要經過 register。

> **陷阱** 問「能不能一個指令把 y[i] 直接搬到 x[i]？」答案是不行，`x[i] = y[i]` 在 MIPS 一定是 lbu + sb 兩個指令（中間經過 `$t2`）。

## 16 bits 不夠用：兩個待解的問題

前面一直說 branch（beq、bne）是 I-type，但寫程式時只寫一個 label，例如 `beq $s0, $s1, L1`。指令格式裡真正放的是什麼？另外，I-type 的 immediate 只有 16 bits，若需要的常數超過 16 bits，根本放不下。

所以要處理兩件事：

1. 怎麼在 register 裡做出一個 **32-bit 常數**。
2. branch 與 jump 的**目標位址**怎麼放進指令裡（位址有 32 bits，欄位卻只有 16 或 26 bits）。

## 32-bit 常數：lui ＋ ori

不管資料多大，在 register 裡都是 32 bits。常數若 16 bits 就放得下，直接寫在指令的 immediate 裡即可（例如 `addi`）。放不下時，用 **lui（load upper immediate）** 搭配 **ori**：把 32-bit 常數拆成上下兩半，上半寫在 lui 的 immediate，下半寫在接下來 ori 的 immediate。

### 例題：把 4,000,000 放進 `$s0`

4,000,000 的十六進位是 `0x003D0900`，前 16 bits 不全是 0（有 1），16-bit 欄位裝不下。

```
4,000,000 = 0x003D0900
          = 0000 0000 0011 1101 | 0000 1001 0000 0000
            上半 16 bits = 0x003D = 61 | 下半 16 bits = 0x0900 = 2304
驗算：61 × 65536 + 2304 = 3,997,696 + 2304 = 4,000,000
```

```asm
lui  $s0, 61          # $s0 = 61 × 65536 = 0x003D0000（低 16 bits 清成 0）
ori  $s0, $s0, 2304   # $s0 = 0x003D0000 OR 0x00000900 = 0x003D0900 = 4,000,000
```

**第一步 lui**：lui 仍是 I-type，有 16-bit 常數欄位。它只需要一個 destination，不需要 source，所以 rs 填 0；rt 放 destination `$s0`（編號 16）。

| 欄位 | op | rs | rt | immediate |
|---|---|---|---|---|
| 十進位 | 15 | 0 | 16 | 61 |
| 二進位 | 001111 | 00000 | 10000 | 0000 0000 0011 1101 |

整個指令 = `0011 1100 0001 0000 0000 0000 0011 1101` = `0x3C10003D`。

lui 做兩件事：把指令後 16 bits 的 61 搬到 `$s0` 的**上半部**，並把 `$s0` 的**下半部 16 bits 全部清成 0**。執行後：

```
$s0 = 0000 0000 0011 1101 | 0000 0000 0000 0000   (= 61 × 65536 = 3,997,696)
```

**第二步 ori**：`ori $s0, $s0, 2304`。2304 也只有 16 bits，ori 會在前面補 0（zero-extend）變成 32 bits，它的 1 全在低 16 bits。

| 欄位 | op | rs | rt | immediate |
|---|---|---|---|---|
| 十進位 | 13 | 16 | 16 | 2304 |
| 二進位 | 001101 | 10000 | 10000 | 0000 1001 0000 0000 |

整個指令 = `0x36100900`。

```
  $s0        = 0000 0000 0011 1101 | 0000 0000 0000 0000
  2304 補 0  = 0000 0000 0000 0000 | 0000 1001 0000 0000
  OR         = 0000 0000 0011 1101 | 0000 1001 0000 0000  = 0x003D0900 = 4,000,000
```

上半部的 61 不受影響（任何 bit OR 0 都不變）；下半部原本是 0，OR 完就變成 2304。這樣就不必先把大常數存在記憶體再 load 進來。

> **陷阱** 第二步要用 ori，不能用 addi。addi 的 immediate 會做 sign extension：低半部最高位（bit 15）是 1 時，延伸出來的是 16 個 1，加下去會改到上半部；ori 是補 0，不會動到上半部。

### 例題（示意）：用 addi 會出錯的情形

想做 `0x00018000`：上半 1、下半 `0x8000`（bit 15 是 1）。

```asm
lui  $t0, 1              # $t0 = 0x00010000
addi $t0, $t0, 0x8000    # 0x8000 被 sign-extend 成 0xFFFF8000（= −32768）
```

```
0x00010000 + 0xFFFF8000 = 0x00008000   ← 錯，上半部被改掉了
用 ori：0x00010000 OR 0x00008000 = 0x00018000   ← 正確
```

## 再看一次 R-format 與 I-format

後面要依照 instruction format 來設計硬體（organization），所以每種 format 都一定要記得。

> **比喻** 煮菜要先知道要煮什麼菜才知道怎麼煮。ISA 就是那份菜單，硬體照著它做出來。

### R-format

| op | rs | rt | rd | shamt | funct |
|---|---|---|---|---|---|
| 6 bits | 5 bits | 5 bits | 5 bits | 5 bits | 6 bits |

用於加減、logical 等運算。MIPS 是 load-store machine：運算指令的兩個 source、一個 destination 全是 register。

### I-format

| op | rs | rt | immediate（constant 或 address） |
|---|---|---|---|
| 6 bits | 5 bits | 5 bits | 16 bits |

設計原則是 format 越一致越好，所以 op、rs、rt 的位置都和 R-type 相同，後面三個欄位合成 16 bits 的 immediate。

- **load／store**：例如 `lw $t0, 32($s3)`。這 16 bits 是 **offset**：base register 的內容加上 offset，才是真正要存取的記憶體位址。
- **immediate 運算**：例如 `addi`，這 16 bits 是常數本身（I 就是 immediate：constant 直接放在指令裡）。
- **conditional branch**：beq、bne 也用 I-format。

> **重點** 用 I-format 的三類指令：immediate 運算、conditional branch（beq／bne）、load 與 store。

### Immediate 是 two's complement，要 sign extension

16-bit immediate 是一個 **two's complement** 的數，可正可負（例如 −4）。但運算是 32 bits，所以使用前要做 **sign extension（符號延伸）**：把 sign bit 複製到前面 16 bits。

```
−4（16 bits） = 1111 1111 1111 1100 = 0xFFFC
sign extend  → 1111 1111 1111 1111 1111 1111 1111 1100 = 0xFFFFFFFC   仍是 −4

+5（16 bits） = 0000 0000 0000 0101 = 0x0005
sign extend  → 0000 0000 0000 0000 0000 0000 0000 0101 = 0x00000005   仍是 +5
```

正數 sign bit 是 0，前面補 0；負數 sign bit 是 1，前面補 1。正負都能正確延伸。

## Branch 的目標：PC-relative addressing

beq／bne 的格式是 op、rs、rt 加一個 16-bit immediate。beq 是 rs、rt 相等就跳，bne 是不相等才跳，由 op code 區分。

跳去哪裡？程式裡寫的 L1、L2 只是 symbolic 的描述，電腦看不懂，它只認得 0 與 1，所以指令裡必須放一個**數字**，也就是位址。因為指令本身也放在記憶體裡，「跳到某處」就是跳到某個 memory address。問題是位址有 32 bits，immediate 只有 16 bits。

解法是 **PC-relative addressing（PC 相對定址）**：不放絕對位置，而放**相對於 PC 的位置**。PC 是 **Program Counter**（不是個人電腦的 PC），記錄目前執行到哪個指令，裡面放的就是那個指令的位址。例如 beq 在位址 1000，執行它時 PC 就是 1000。

### 分支通常很近：offset

寫程式時，branch 通常只是往上或往下跳幾個 statement（例如 loop），目標一定在附近。beq 在 1000，目標大概是 1000 + 50 或 1000 − 50 之類。所以 immediate 就當成一個 **offset**，加到 PC 上就是目標：

- 16 bits 是帶號的 two's complement：**負的往上跳，正的往下跳**。
- 這跟 load／store 的 base + offset 很像，只是 base 從 register 換成了 PC。

### 以 word 為單位

lw／sw 的 offset 以 **byte** 為單位。branch 若也用 byte，16 bits 只能上下各跳約 2¹⁵ 個 byte，範圍太小。

MIPS 有沒有 1、2、3 個 byte 長的指令？沒有，指令永遠是 4 bytes。所以指令位址永遠是 0、4、8、12…這些 4 的倍數，二進位最後兩個 bit 一定是 `00`。既然一定是 00，就不必浪費空間放進 immediate，用的時候自動補兩個 0；補兩個 0 就是乘以 4。

因此 branch 的 immediate 是 **word offset**（以指令為單位）；lw／sw 可能只拿某一個 byte，才需要 byte address。範圍因此變成 4 倍：上下各約 2¹⁵ 個 word，也就是約 2¹⁷ 個 byte（精確地說是 −2¹⁵ ～ 2¹⁵ − 1 個指令）。

> **陷阱** lw／sw 的 offset 是 byte 為單位；branch 的 immediate 是 word（指令）為單位，算 byte 位址時要 × 4。

### offset 從 PC + 4 算起

正常情況下 PC 每次加 4（每個指令 4 bytes），PC + 4 就是下一個指令，不跳就執行它。大部分時候程式是循序執行，所以硬體先假設不跳，**先把 PC + 4 做掉**，同時去讀 rs、rt 比較是否相等，兩件事一起做比較快。比完若要跳，若還得先把 PC 減 4 恢復原狀就浪費時間了。所以規定 offset 從 **PC + 4（下一個指令）**開始算：

```
branch target = (PC + 4) + immediate × 4
```

> **重點** 這一行最重要：目標 = (PC + 4) + offset × 4。offset 從「下一個指令」數起，不是從 branch 自己數起。

### 例題：beq `$9`, `$0`, End 的 immediate

```asm
Loop: beq  $9, $0, End    # $9 == $0 就跳到 End
      add  $8, $8, $10    # 運算元示意
      addi $9, $9, -1     # 運算元示意
      j    Loop
End:
```

`$9` 與 `$0` 一樣就跳到 End；不一樣就做 add、addi，然後 j Loop 跳回去。assembly 寫到這樣就完成了，但電腦看不懂 End 這個 symbol，必須換成數字。

beq 是 I-type：op、rs、rt、immediate。查表 beq 的 op = 4；rs = 9、rt = 0 直接填。immediate 填多少？

- 執行 beq 時 PC 指著 beq，但加 offset 時 PC 已經加過 4，所以從**下一個指令 add** 開始數。
- 從 add 往下數（add 記 0）：addi 是 1、j 是 2、End 是 3。End 比 add 多 3 個指令，所以 **immediate = 3**。
- 欄位以指令為單位，兩個 0 會自動補，所以直接填 3，不用乘 4。

| 欄位 | op | rs | rt | immediate |
|---|---|---|---|---|
| 十進位 | 4 | 9 | 0 | 3 |
| 二進位 | 000100 | 01001 | 00000 | 0000 0000 0000 0011 |

整個指令 = `0x11200003`。

真正的 byte address：假設 beq 位址（PC）是 X：

```
target = X + 4 + 3 × 4 = X + 16
X = 1000：
  1000 beq
  1004 add     ← PC + 4，offset 從這裡算（0）
  1008 addi    (1)
  1012 j       (2)
  1016 End     (3)   = 1000 + 4 + 12 ✓
```

> **重點** 看 assembly 時的速算方式：從下一個指令開始算距離，目標比下一個指令多幾個指令就填幾（目標在上方就是負數）。

## J-format 與 pseudodirect addressing

最後一種格式是 **J-format**（J = jump），只有 j 使用（之後的 jal 也是同樣格式）。beq／bne 只能在 PC 附近跳，想跳遠一點就用 j。

最理想是直接放一個完整的 32-bit 位址，就能跳到任何地方。但指令也只有 32 bits，全拿來放位址，op code 就沒地方放；為了它把所有指令加長也不行。所以折衷（compromise）：op code 留著（j 的 op = 2），其餘欄位全部拿來放位址。

| op | address |
|---|---|
| 6 bits | 26 bits |

32 − 6 = 26 bits，只用 26 bits 描述位置，一定有些地方跳不到。怎樣讓 26 bits 跳得更遠？

### 補兩個 0：26 bits → 28 bits

和 branch 一樣的技巧：指令位址最後兩個 bit 一定是 00，不必放在指令裡，用的時候自動補上。26 bits 當 word address，補上 00 變成 28 bits，只差 4 個 bit 就是完整的 32 bits。

### 缺的 4 bits 從 PC 的最前面拿

缺的 4 bits 從 **Program Counter** 來，而且是拿 PC **最前面**的 4 bits。為什麼是前面？從 PC 前面拿 bit 接上去，等於把整個 memory 切成好幾塊：

```
只拿最前面 1 bit：切成 2 塊         拿最前面 2 bits：切成 4 塊
+------------+                      +------------+
| 1xxx...x   |                      | 11xx...x   |
+------------+                      +------------+
| 0xxx...x   |                      | 10xx...x   |
+------------+                      +------------+
                                    | 01xx...x   |  ← program 都在這塊，跳來跳去都對
                                    +------------+
                                    | 00xx...x   |  ← 從 00 跳到 10：接上的是 PC 的 00，錯
                                    +------------+
```

位址從全 0 往上數時，最後面的 bit 一直在變，最前面的 bit 要很久才變一次，所以**同一塊裡的位址，前面的 bit 都一樣**。只要整個 program 都落在同一塊（例如 01 這塊），在裡面跳來跳去，目標的前兩個 bit 也是 01，接上目前 PC 的 01 完全正確。但若要從 00 那塊跳到 10 那塊，接上去的是目前 PC 的 00，位址就錯了。

MIPS 拿 PC 最前面 4 個 bit：memory 切成 2⁴ = 16 塊，每塊 2²⁸ bytes = **256 MB**。這很大，大部分程式不會超過。擺程式的是 linker、loader，擺的時候別跨過 256 MB 的邊界即可，絕大多數情況都沒問題。

### j 的目標：接起來，不是加起來

```
新 PC = PC[31:28] ‖ address(26 bits) ‖ 00      共 4 + 26 + 2 = 32 bits
```

1. PC 最前面 4 個 bit。
2. 接上 j 指令的 26-bit 欄位。
3. 最後補兩個 0。

這種定址叫 **pseudodirect addressing（虛擬直接定址）**。注意這是 **concatenation（串接）**：三段 bit 依序排在一起，**不是加法**，連加法器都不需要。（嚴格說，取前 4 bits 的 PC 是已經加 4 之後的 PC；一般情況兩者前 4 bits 相同。）

要跳到**任意** 32-bit 位址：把位址放進 register，用 **jr（jump register）**。任何 register 都可以；若用 `$ra`，記得它裡面原本的返回位址很重要，要先存起來。

| 跳躍方式 | 定址 | 能跳多遠 |
|---|---|---|
| beq／bne | PC-relative | PC + 4 起上下約 2¹⁵ 個指令 |
| j（jal） | pseudodirect | 同一個 256 MB 區塊內 |
| jr | register | 任意 32-bit 位址 |

> **陷阱** j 只能跳到與目前 PC 同一個 256 MB 區塊內的位址；跨區塊要用 jr。

## 例題：從位址 80000 開始的 while 迴圈

C 程式：

```c
while (save[i] == k)
    i += 1;
```

i 在 `$s3`、k 在 `$s5`、save 的 base address 在 `$s6`，迴圈從位址 80000 開始：

```asm
Loop: sll  $t1, $s3, 2      # 80000  $t1 = i × 4
      add  $t1, $t1, $s6    # 80004  $t1 = &save[i]
      lw   $t0, 0($t1)      # 80008  $t0 = save[i]
      bne  $t0, $s5, Exit   # 80012  save[i] != k 就離開
      addi $s3, $s3, 1      # 80016  i += 1
      j    Loop             # 80020
Exit:                       # 80024
```

各指令欄位（十進位）：

| 位址 | 指令 | op | rs | rt | rd | shamt | funct／immediate／address |
|---|---|---|---|---|---|---|---|
| 80000 | sll | 0 | 0 | 19 | 9 | 2 | 0 |
| 80004 | add | 0 | 9 | 22 | 9 | 0 | 32 |
| 80008 | lw | 35 | 9 | 8 | | | 0 |
| 80012 | bne | 5 | 8 | 21 | | | 2 |
| 80016 | addi | 8 | 19 | 19 | | | 1 |
| 80020 | j | 2 | | | | | 20000 |

二進位：

```
80000 sll  000000 00000 10011 01001 00010 000000
80004 add  000000 01001 10110 01001 00000 100000
80008 lw   100011 01001 01000 0000000000000000
80012 bne  000101 01000 10101 0000000000000010
80016 addi 001000 10011 10011 0000000000000001
80020 j    000010 00000000000100111000100000
```

### bne `$t0`, `$s5`, Exit 的 immediate

op = 5，rs = `$t0` = 8，rt = `$s5` = 21。immediate 填多少？

> **陷阱** 從 bne 自己數到 Exit 是 3 行，容易填 3。但執行 bne 時 PC 已經加 4，指到 80016 的 addi；從 addi 數起（記 0），j 是 1，Exit 是 2，所以 **immediate = 2**。

驗算：`target = 80012 + 4 + 2 × 4 = 80024`，正好是 Exit。

### j Loop 的 26-bit 欄位

Loop 的絕對位址是 80000（十進位計算即可，換成二進位反而容易搞亂）。80000 是 byte address，指令裡只描述 word address，所以除以 4：

```
address 欄位 = 80000 ÷ 4 = 20000
20000 = 0x4E20 → 26 bits：00 0000 0000 0100 1110 0010 0000
整個指令 = 000010 | 00000000000100111000100000 = 0x08004E20
```

驗算：假設在同一個 segment，PC 前 4 bits 都是 0：

```
新 PC = 0000 ‖ 00000000000100111000100000 ‖ 00
      = 20000 × 4 = 80000 = Loop ✓
```

## 要跳很遠：條件反過來，再加一個 j

寫 loop 時都假設 beq／bne 的目標在 16-bit offset 的範圍內。萬一 L1 很遠，超過上下 2¹⁵ 個指令，immediate 描述不了，就利用能跳遠的 j：

```asm
# 原本（L1 太遠，放不進 16-bit offset）：
      beq  $s0, $s1, L1

# 改寫：條件反過來，跳過下一行的 j
      bne  $s0, $s1, L2   # 不相等：不用去 L1，跳過 j
      j    L1             # 相等：由 j 跳到很遠的 L1
L2:   ...
```

先用 branch 在附近決定要不要跳；要跳，就執行旁邊的 j，由 j 跳到很遠的 L1。

## Addressing mode（定址模式）

**Addressing mode** 是指令中指定 operand 在哪裡的各種方法；operand 可能在指令裡、在 register 裡，或在記憶體裡。這是 instruction set design 很重要的特性。MIPS 有五種：**immediate、register、base、PC-relative、pseudo-direct**。

### 1. Immediate addressing（立即定址）

格式：op（6 bits）、rs、rt、immediate。例如 `addi $s1, $s2, 5`，結果放在 rt。資料（5）直接跟著指令一起來，就在指令裡，不必再去記憶體拿。

| 欄位 | op | rs | rt | immediate |
|---|---|---|---|---|
| 十進位 | 8 | 18（`$s2`） | 17（`$s1`） | 5 |
| 二進位 | 001000 | 10010 | 10001 | 0000 0000 0000 0101 |

op code 只有 6 bits，所以最多 2⁶ = 64 種 op code。同一個指令（例如 add）換不同 register 不算不同指令，處理器是看欄位裡的值來分辨。

> **陷阱** 「op 6 bits，所以最多 64 種指令」是錯的：R-type 的 op 都是 0，再用 6-bit funct 區分，所以 MIPS 實際指令數不只 64 個。

### 2. Register addressing（暫存器定址）

R-format 有三個 register field。MIPS 有 32 個 register，2⁵ = 32，所以每個欄位 5 bits。shamt 是 shift amount，只有 shift 指令會用，add、sub 填 0。funct 6 bits：add 填 32（100000），sub 填 34（100010）。add、sub 的 op 是 000000。為什麼是 0 和 32？這是 MIPS 設計者的規定，自己設計處理器可以定別的值。

> **例題** `add $s1, $s2, $s3`：`$s2` + `$s3` 存到 `$s1`。`$s2` 的編號 18 填 rs，`$s3` 的 19 填 rt，destination `$s1` 的 17 填 rd。

| 欄位 | op | rs | rt | rd | shamt | funct |
|---|---|---|---|---|---|---|
| 十進位 | 0 | 18 | 19 | 17 | 0 | 32 |
| 二進位 | 000000 | 10010 | 10011 | 10001 | 00000 | 100000 |

```
0000 0010 0101 0011 1000 1000 0010 0000 = 0x02538820
```

叫 register addressing，是因為這個指令**所有 operand 都是 register**。

> **陷阱** assembly 寫成 `add rd, rs, rt`（destination 在最前面），機器碼欄位順序卻是 rs、rt、rd。

### 3. Base addressing（基底定址，又叫 displacement addressing）

> **例題** `lw $s1, 32($s3)`，假設 `$s3` 裡是 1000。

```
位址 = 32 + $s3 的內容 = 32 + 1000 = 1032
從 1032 開始拿一個 word（4 bytes）放進 $s1
```

word = 4 bytes，half word = 2 bytes，byte = 1 byte。load word 拿 4 bytes 放進 32-bit 的 `$s1`，剛好放得下；換成 `lh` 讀 2 bytes，`lb` 只讀 1 byte，結果一樣放進 `$s1`。load、store 都用 base addressing，可以存取 byte、halfword 或 word。

| 欄位 | op | rs | rt | address／offset |
|---|---|---|---|---|
| 十進位 | 35 | 19（`$s3`，base） | 17（`$s1`，結果） | 32 |
| 二進位 | 100011 | 10011 | 10001 | 0000 0000 0010 0000 |

```
1000 1110 0111 0001 0000 0000 0010 0000 = 0x8E710020
```

- 欄位填的是 register 的**編號**，不是內容。
- 32 雖然寫在指令裡，但它**不是資料，而是位址的一部分**。指令裡直接給的值：在 immediate mode 是 data，在 base mode 是 address。
- 名稱由來：`$s3` 提供位址的基準，叫 **base register**（也可以用 `$s4`、`$s5` 等任何 register）；32 是位移，叫 **offset** 或 **displacement**。
- 整個 32 bits 叫 **instruction code（機器碼）**；**op code** 只是最前面那 6 bits。

> **陷阱** 有些教材因為「位址由 register 間接提供」，也把 base addressing 叫 indirect addressing；教科書名稱是 base／displacement。不要和「記憶體裡存的是位址」的 memory indirect 混淆，MIPS 沒有那種。

### 4. PC-relative addressing（PC 相對定址）

PC 存著目前正在執行的指令的位址。指令也放在記憶體裡，處理器照 PC 的位址把指令拿進來執行；想跳到程式的別處，就改 PC 的值，它就會去新位址拿指令。

> **例題** `bne $s0, $s1, 100`（branch on not equal，不相等就跳；beq 則是相等才跳，就像高階語言的 if）。

- 100 不是第 100 個 byte，而是 100 個**指令**，每個 4 bytes，所以是 400 bytes。
- 從下一個指令算起：`target = PC + 4 + 100 × 4`。PC = 1000 時，目標 = 1000 + 4 + 400 = **1404**。

| 欄位 | op | rs | rt | offset |
|---|---|---|---|---|
| 十進位 | 5 | 16（`$s0`） | 17（`$s1`） | 100 |
| 二進位 | 000101 | 10000 | 10001 | 0000 0000 0110 0100 |

```
0001 0110 0001 0001 0000 0000 0110 0100 = 0x16110064
```

16 bits 放不下 20 萬、100 萬這種距離。

> **陷阱** 範圍不是「到 2¹⁶」：offset 是 16-bit signed，可跳 −2¹⁵ ～ 2¹⁵ − 1 個指令（從 PC + 4 起算）。

叫 PC-relative，是因為目標相對於目前的 PC：PC 是 1000，就以 1000 為基準。迴圈例題的 bne 也一樣：PC + 4 = 80016，再加 2 × 4 = 80024。

### 5. Pseudo-direct addressing（虛擬直接定址）

> **例題** `j 2500`：無條件跳躍（bne 是有條件），要去哪裡直接寫在指令的 26 bits 裡。

2500 是以指令為單位，不是 byte 位址；每個指令 4 bytes，要乘 4：

```
26-bit 欄位 = 2500 = 00 0000 0000 0000 1001 1100 0100
整個指令   = 000010 | 00000000000000100111000100 = 0x080009C4
目標       = PC[31:28] ‖ 2500 ‖ 00
           = 0000 ‖ (2500 × 4) = 10000      （PC 最高 4 bits 是 0）
```

> **陷阱** 不是「2500 × 4 再加上目前的 PC」。MIPS 是把 PC 最高 4 bits **接**在「26-bit 欄位 × 4」的前面，是串接不是相加。

位址幾乎是直接給的，但最高 4 bits 還要靠 PC 補，不算真正的 direct（直接把整個位址寫出來就跳過去），所以叫 pseudo-direct。

### 五種定址模式總整理

| 定址模式 | 用在 | operand／目標怎麼來 | 例子 |
|---|---|---|---|
| Immediate | addi、ori、lui 等 | operand 就在指令裡 | `addi $s1, $s2, 5` 的 5 |
| Register | R-type（add、sub…） | 指定 register，到 register file 拿 | `add $s1, $s2, $s3` |
| Base（displacement） | lw、sw、lh、lb… | register + 16-bit offset = 記憶體位址 | `$s3` = 100，`32($s3)` → 132 |
| PC-relative | beq、bne | (PC + 4) + offset × 4 | 80016 + 2 × 4 = 80024 |
| Pseudodirect | j、jal | PC[31:28] ‖ 26 bits ‖ 00 | 20000 × 4 = 80000 |

這五種就是 MIPS 存取 operand 與找跳躍目標的全部方式，並不複雜。

> **陷阱** MIPS **沒有** direct 和 indirect 定址。j 是 pseudodirect，不是 direct。

### 補充：一般定址模式名稱比較（標準背景，非 MIPS 專屬）

考題常把一般教科書的定址模式名稱放在一起比較（Immediate／Register／Direct／Indirect／Base／PC-relative）。以下為通用定義，A 表示指令中的位址欄位，R 表示 register，M[x] 表示記憶體位址 x 的內容：

| 模式 | operand 在哪 | 取得 operand 的記憶體存取次數 | 優點 | 缺點 |
|---|---|---|---|---|
| Immediate | 指令本身：operand = 常數 | 0 | 最快 | 常數大小受欄位限制 |
| Register | operand = R | 0 | 快、欄位短 | register 數量有限 |
| Direct（absolute） | operand = M[A] | 1 | 簡單 | A 欄位要夠長才能涵蓋整個記憶體 |
| Indirect（memory indirect） | operand = M[M[A]] | 2 | 可存取大範圍、適合指標 | 慢（多一次記憶體存取） |
| Register indirect | operand = M[R] | 1 | 位址空間大 | 需先把位址放進 register |
| Base／Displacement | operand = M[R + A] | 1 | 彈性大（陣列、struct、stack） | 需要一次加法 |
| PC-relative | 目標 = PC + A | （取跳躍目標，不存取資料） | 程式可重定位、欄位短 | 只能跳到附近 |

對照 MIPS：MIPS 沒有 direct 與 memory indirect；register indirect 可用 offset 為 0 的 base addressing 達成（例如 `lw $t0, 0($t1)`）；j 的 pseudodirect 是「接近 direct」但最高 4 bits 取自 PC。

## 從 C 程式到記憶體：translation

一個 C program 怎麼變成 0 與 1，放進 main memory 開始執行？中間有很多 system program 在幫忙。C 寫三五行的東西，assembly 要寫一大串，所以要有生產力就寫 high-level language，再交給工具轉換：

```
C program
   │ compiler
   ▼
assembly language program
   │ assembler
   ▼
object（machine language 的 0101）     library（現成的 routine）
   │                                        │
   └──────────────┬─────────────────────────┘
                  │ linker
                  ▼
            executable
                  │ loader
                  ▼
               memory
```

- **compiler（編譯器）**：把高階語言轉成 assembly。
- **assembler（組譯器）**：把 assembly 轉成 object（機器語言）。大致是**一對一翻譯**：把 add、`$t0` 這些符號換成 op code 與 register 編號。通常 compiler 會順便把這一步一起做完。
- **library**：現成的 routine，常用的功能不必自己重寫。
- **linker（連結器）**：把各個 module（自己寫的、外部來的）連起來，補上先前用 label 代表、還沒決定的跳躍位址，變成完整可執行的 **executable**。
- **loader（載入器）**：把 executable 放進記憶體。放好之後，每個指令的**絕對位址**才確定。若系統有 **virtual memory**，放在哪一塊都能執行；沒有的話，就要告訴它從哪個 base 開始算絕對位址，因為跳躍需要絕對位置。

這份 ISA（指令、三種 format、五種定址模式）就是後面設計硬體所依照的「菜單」。

## 重點整理
- Response time = 一件工作多久做完；throughput = 單位時間做完幾件工作
- CPU time = clock cycles × clock period = clock cycles ÷ clock rate（clock rate = 1 ÷ clock period）
- CPU time = IC × CPI × clock cycle time；IC × CPI = 總 cycle 數
- 相同 ISA → 相同 IC；例：A（250 ps, CPI 2.0）500·I ps vs B（500 ps, CPI 1.2）600·I ps → A 快 1.2 倍
- 「A 比 B 快幾倍」= time_B ÷ time_A（慢的放分子）；clock 快不代表整體快
- Clock cycles = ∑ CPIᵢ × ICᵢ；平均 CPI = ∑ CPIᵢ × (ICᵢ ÷ IC)；指令少不等於快（Seq1 10 cycles/CPI 2.0 vs Seq2 9 cycles/CPI 1.5）
- 影響表：program、compiler、ISA → IC、CPI；organization → CPI、clock rate；technology → clock rate（教科書表 ISA 也影響 clock rate）
- MIPS = IC ÷ (time × 10⁶) = clock rate ÷ (CPI × 10⁶)，不能當效能指標，要比 execution time
- Amdahl's law：T_improved = T_affected ÷ n + T_unaffected；100 s 中乘法 80 s 想快 5 倍做不到
- Make the common case fast；先 profiling
- Dynamic power ∝ C × V² × f；C、V、f 皆 ×0.85 → power ×0.85⁴ ≈ 0.52
- Static power = leakage；電壓降到約 1 V 降不下去 → power wall
- 程式不改只加 core：response time 不變、throughput 上升；改進 response time 要 parallel programming（load balancing、communication／synchronization）
- SPECratio = 參考機器時間 ÷ 待測機器時間（越大越好）；多程式用 geometric mean（換參考機器排名不變）
- SPEC power 總分 = ∑ ssj_ops ÷ ∑ power
- Idle 不省電：50% load 耗 83%、10% load 耗 61%、0% load 仍 141 W
- Cost per die = cost per wafer ÷ (dies per wafer × yield)；dies per wafer ≈ wafer area ÷ die area
- Yield 隨 defects per area 與 die area 上升而下降；晶片成本 = die + testing + packaging
- Moore's law：電晶體數約每 1.5～2 年翻倍
- ISA 規定四件事：storage（register 數、memory 大小與存取方式）、data type、instruction format、operations；MIPS 只有 R、I、J 三種格式，一律 32 bits
- 算術／邏輯指令：一個 operation、三個 operand（destination、source1、source2），operand 一定在 register；多個 operand 要拆成多條指令
- Design Principle 1 Simplicity favors regularity；2 Smaller is faster；3 Good design demands good compromise；另有 make the common case fast（immediate）
- f = (g + h) − (i + j) → add `$t0`,`$s1`,`$s2`；add `$t1`,`$s3`,`$s4`；sub `$s0`,`$t0`,`$t1`
- Register 好處：快、compiler 好用、減少 memory traffic、提高 code density（32 個 register 只要 5 bits）
- 32 個 register × 32 bits（1 word = 32 bits = 4 bytes）；`$zero`=0、`$v0`–`$v1`=2–3、`$a0`–`$a3`=4–7、`$t0`–`$t7`=8–15、`$s0`–`$s7`=16–23、`$t8`–`$t9`=24–25、`$gp`/`$sp`/`$fp`/`$ra`=28–31；乘除結果在 Hi/Lo，浮點在 coprocessor 1
- Register 架構演變：accumulator（1 address）→ stack（0 address）→ GPR（2/3-address，operand 可在 memory）→ load-store（RISC，operand 全在 register）；x86 是 register-memory，MIPS 是 load-store
- C = A + B：register-memory 3 個較長指令、load-store 4 個較短指令；指令少不一定快，要看 CPI
- 有效位址 = base register + offset；lw `$t0`, 12(`$s0`) 載入的是 Mem[`$s0`+12] 的內容；sw 位址描述相同；offset 可正可負
- 陣列 offset 以 byte 計：A[i] 的 offset = 4i（A[8] → 32、A[12] → 48），base 不動只改 offset
- MIPS 位址以 byte 計；word 必須對齊在 4 的倍數（alignment）；MIPS 是 big endian（位址 0 放 most significant byte）
- Spilling：register 放不下的變數用 load/store 放到 memory；一個 data transfer 指令只處理一個 memory operand
- Immediate：常數約占一半 operand → 放進指令（addi）；沒有 subi（加負數）；`$zero` 硬體接死為 0，寫入無效；move = add `$t2`, `$s1`, `$zero`
- R-format：op6 rs5 rt5 rd5 shamt5 funct6；R-type op=0，funct：add 32、sub 34、and 36、or 37、sll 0、srl 2、sra 3；assembly 寫 rd 在前，編碼順序是 rs rt rd
- add `$t0`,`$s1`,`$s2` = 0 17 18 8 0 32 = 0x02324020（當資料讀是 36,847,648）
- I-format：op6 rs5 rt5 immediate16；rt 是 addi/lw 的目的地；immediate 有號、sign extension，範圍 −32768～32767；offset 只能在 base ±2¹⁵ bytes 內
- addi `$21`,`$22`,−50 = 8 22 21 −50 = 0x22D5FFCE；lw `$t0`,1200(`$t1`) = 35 9 8 1200 = 0x8D2804B0；lw `$t0`,32(`$s3`) = 35 19 8 32
- I-format 三種用途：immediate 運算、load/store、conditional branch（beq/bne）
- Stored-program：指令和資料都是 0101，一起放在 memory；程式可以是另一個程式（compiler）的 data
- funct 存在是為了讓 op 維持 6 bits、保住 I-type 16-bit immediate（若 op 變 7 bits，immediate 剩 15 bits，範圍少一半）
- sll/srl 補 0；sra 補 sign bit；沒有 sla；左移 i 位 = ×2ⁱ，右移 i 位 = ÷2ⁱ（unsigned）；compiler 把 a×8 改成 sll 3
- Shift 是 R-type：rs 填 0、來源在 rt、目的在 rd、位數在 shamt；sll `$t2`,`$s0`,4 = 0 0 16 10 4 0
- and + mask 選出 bit（mask 0 的位置清 0）；or 把指定 bit 設成 1
- MIPS 沒有 NOT：nor `$t0`, `$t1`, `$zero` = NOT `$t1`（a NOR 0 = NOT a）；NOT 0x00003C00 = 0xFFFFC3FF
- beq/bne 是 conditional branch（I-format，16-bit 目標欄位，近距離）；j 是 unconditional jump（J-format，26-bit，可跳較遠）
- if-then-else：條件反過來寫（bne … Else）；then 做完一定要 j Exit，否則會掉進 else
- 陣列 int 索引：byte offset = i × 4，用 sll 2；offset 會變就先算進 register 再 lw 0(reg)
- basic block：只有開頭一個入口、只在最後跳出的指令序列；compiler 以它為單位最佳化
- slt rd, rs, rt：rs < rt 則 rd = 1 否則 0；配 beq/bne 與 `$zero` 做出 <、>、≤、≥ 四種比較
- 沒有 blt：省 opcode、避免拉長 clock period（make the common case fast）；blt 是 pseudo-instruction
- slt 是 signed 比較、sltu 是 unsigned 比較；0xFFFFFFFF 對 1：slt 得 1、sltu 得 0
- procedure call 六步：放參數 → 交出 control → 取得 storage → 執行 → 放結果 → 交回 control
- `$zero` 0、`$v0`–`$v1` 2–3、`$a0`–`$a3` 4–7、`$t0`–`$t7` 8–15、`$s0`–`$s7` 16–23、`$gp` 28、`$sp` 29、`$fp` 30、`$ra` 31
- PC 存下一個指令位址；循序執行 PC + 4
- jal L：`$ra` = PC + 4，PC = L；jr `$ra`：PC = `$ra`；jr 也可做 switch
- stack 從高位址往低位址長：push 先 addi `$sp`, `$sp`, −4k，pop 再 +4k
- `$t` 是 caller-saved、`$s` 是 callee-saved；caller-saved：`$t`、`$a`、`$v`、`$ra`；callee-saved：`$s`、`$sp`
- leaf 不再呼叫別人；non-leaf 呼叫前必存 `$ra`（及之後要用的 `$a` 等）
- fact：存 `$ra`、`$a0`（8 bytes）；base case 只還原 `$sp`；遞迴回來先 lw `$a0`、`$ra` 再 mul；fact(3) 最深 `$sp` 由 1000 降到 968
- activation record（procedure frame）：saved arguments、return address、saved `$s`、local arrays/structures
- memory layout（低→高）：reserved、text（0040 0000）、static data（`$gp` = 1000 8000）、heap ↑、stack ↓（`$sp` = 7fff fffc）
- ASCII 1 byte 128 字元、Latin-1 256、Unicode 32-bit；'A' = 65
- byte 放 register 最右邊：lb sign-extend、lbu zero-extend、sb 存最右 byte；F7 → lb = 0xFFFFFFF7（−9）、lbu = 0x000000F7（247）
- 參數可以是值或地址（都是 32 bits），地址當 base register 用
- MIPS 是 load-store machine：沒有 memory → memory 指令；strcpy 用 lbu + sb，index 不乘 4
- 32-bit 常數：lui 放上半 16 bits（下半清 0），再用 ori 放下半 16 bits；4,000,000 = 0x003D0900 → lui `$s0`, 61；ori `$s0`, `$s0`, 2304
- 第二步用 ori 不用 addi：addi 會 sign-extend，下半 bit 15 為 1 時會改到上半部；ori 是 zero-extend
- I-format 用於 immediate 運算、beq/bne、load/store；op、rs、rt 位置與 R-type 相同
- 16-bit immediate 是 two's complement，運算前 sign extension（−4 → 0xFFFFFFFC）
- branch target = (PC + 4) + immediate × 4；immediate 是 word offset，從下一個指令數起
- branch 範圍：−2¹⁵ ～ 2¹⁵ − 1 個指令（約 ±2¹⁷ bytes）；lw/sw offset 是 byte 為單位
- J-format：op 6 bits + address 26 bits；j 的 op = 2
- j 目標 = PC[31:28] ‖ 26-bit address ‖ 00（串接，不是加法）；只能在同一個 256 MB 區塊內跳
- 任意 32-bit 位址用 jr
- 80000 迴圈：bne `$t0`, `$s5`, Exit = 5 8 21 2（目標 80012 + 4 + 8 = 80024）；j Loop 欄位 = 80000 ÷ 4 = 20000
- 目標太遠：beq `$s0`,`$s1`,L1 改寫為 bne `$s0`,`$s1`,L2 ＋ j L1，L2 為下一行
- MIPS 五種定址：immediate、register、base（displacement）、PC-relative、pseudodirect；MIPS 沒有 direct、indirect
- add `$s1`, `$s2`, `$s3` = 0 18 19 17 0 32 = 0x02538820；assembly 順序 rd, rs, rt，機器碼 rs, rt, rd
- add funct 32、sub funct 34，op 皆 0；R-type 用 funct 區分，所以指令數不只 64
- lw `$s1`, 32(`$s3`) = 35 19 17 32；32 是位址的一部分不是 data
- bne `$s0`, `$s1`, 100：PC = 1000 → 目標 1404；j 2500 → 目標 10000
- Translation：C → compiler → assembly → assembler → object → linker（+ library）→ executable → loader → memory

## 名詞對照
| 中文 | English |
|---|---|
| 回應時間 | response time |
| 產出量 | throughput |
| 執行時間 | execution time |
| CPU 時間 | CPU time |
| 時脈週期 | clock period / clock cycle time |
| 時脈頻率 | clock rate / clock frequency |
| 指令數 | instruction count (IC) |
| 每指令平均時脈數 | CPI (clocks per instruction) |
| 指令集架構 | instruction set architecture (ISA) |
| 組織（硬體實作） | organization |
| 指令組合 | instruction mix |
| 製程技術 | technology |
| 特徵尺寸 | feature size |
| 漣波進位加法器 | carry ripple adder |
| 前瞻進位加法器 | carry lookahead adder |
| 謬誤 | fallacy |
| 每秒百萬指令 | MIPS (million instructions per second) |
| 安達爾定律 | Amdahl's law |
| 加速比 | speedup |
| 效能剖析 | profiling |
| 動態功率 | dynamic power |
| 靜態功率 | static power |
| 漏電流 | leakage |
| 電容負載 | capacitive load |
| 扇出 | fan-out |
| 功率密度 | power density |
| 功率牆 | power wall |
| 單處理器 | uniprocessor |
| 多核心 | multi-core |
| 指令層級平行度 | instruction-level parallelism (ILP) |
| 平行程式 | parallel program |
| 負載平衡 | load balancing |
| 同步 | synchronization |
| 工作負載 | workload |
| 效能測試程式組 | benchmark |
| 系統設定 | system configuration |
| 參考機器 | reference machine |
| 幾何平均 | geometric mean |
| 算術平均 | arithmetic mean |
| 矽晶棒 | silicon ingot |
| 晶圓 | wafer |
| 晶粒 | die |
| 光罩 | mask |
| 切割 | dicing |
| 封裝 | packaging |
| 良率 | yield |
| 單位面積缺陷數 | defects per area |
| 摩爾定律 | Moore's law |
| 抽象化 | abstraction |
| 平行化 | parallelism |
| 機器組織 | machine organization |
| 組合語言 | assembly language |
| 運算子 | operator |
| 運算元 | operand |
| 運算碼 | op code (operation code) |
| 暫存器 | register |
| 暫存器檔 | register file |
| 立即值 | immediate |
| 目的暫存器 | destination |
| 來源暫存器 | source |
| 字組 | word |
| 累加器 | accumulator |
| 堆疊 | stack |
| 通用暫存器 | general purpose register (GPR) |
| 載入／儲存架構 | load-store architecture |
| 暫存器－記憶體架構 | register-memory architecture |
| 資料搬移 | data transfer |
| 位元組位址 | byte address |
| 基底暫存器 | base register |
| 偏移量 | offset |
| 載入字組 | load word (lw) |
| 儲存字組 | store word (sw) |
| 對齊 | alignment |
| 大端序 | big endian |
| 小端序 | little endian |
| 最高有效位元組 | most significant byte |
| 最低有效位元組 | least significant byte |
| 溢出到記憶體 | spilling |
| 硬體接死 | hard-wired |
| 符號擴展 | sign extension |
| 位移量 | shift amount (shamt) |
| 功能碼 | function code (funct) |
| 十六進位 | hexadecimal |
| 儲存程式電腦 | stored-program computer |
| 位元運算 | bitwise operation |
| 邏輯左移 | shift left logical (sll) |
| 邏輯右移 | shift right logical (srl) |
| 算術右移 | shift right arithmetic (sra) |
| 遮罩 | mask |
| 條件分支 | conditional branch |
| 設計原則 | design principle |
| 程式碼密度 | code density |
| 分支 | branch |
| 無條件跳躍 | unconditional jump |
| 標籤 | label |
| 基本區塊 | basic block |
| 小於則設定 | set on less than (slt) |
| 虛擬指令 | pseudo-instruction |
| 程序／函式 | procedure |
| 呼叫者 | caller |
| 被呼叫者 | callee |
| 參數 | parameter / argument |
| 返回位址 | return address |
| 程式計數器 | program counter (PC) |
| 跳躍並連結 | jump and link (jal) |
| 暫存器跳躍 | jump register (jr) |
| 堆疊指標 | stack pointer (`$sp`) |
| 框架指標 | frame pointer (`$fp`) |
| 全域指標 | global pointer (`$gp`) |
| 後進先出 | last in first out (LIFO) |
| 暫存器使用約定 | register convention |
| 呼叫者保存 | caller-saved |
| 被呼叫者保存 | callee-saved |
| 葉程序 | leaf procedure |
| 非葉程序 | non-leaf procedure |
| 巢狀呼叫 | nested call |
| 遞迴呼叫 | recursive call |
| 終止條件 | termination condition |
| 活動記錄 | activation record |
| 程序框架 | procedure frame |
| 文字區（程式區） | text segment |
| 靜態資料 | static data |
| 動態資料（堆積） | dynamic data (heap) |
| 字元資料 | character data |
| 符號延伸 | sign extension |
| 零延伸 | zero extension |
| 半字組 | halfword |
| 傳值呼叫 | call by value |
| 傳參考呼叫 | call by reference |
| 載入-儲存架構 | load-store machine |
| 載入高位立即值 | load upper immediate (lui) |
| 補零延伸 | zero extension |
| 二補數 | two's complement |
| PC 相對定址 | PC-relative addressing |
| 位移量 | offset／displacement |
| 字組位址 | word address |
| 跳躍格式 | J-format |
| 虛擬直接定址 | pseudodirect addressing |
| 串接 | concatenation |
| 跳至暫存器位址 | jump register (jr) |
| 定址模式 | addressing mode |
| 立即定址 | immediate addressing |
| 暫存器定址 | register addressing |
| 基底定址 | base addressing |
| 直接定址 | direct addressing |
| 間接定址 | indirect addressing |
| 暫存器間接定址 | register indirect addressing |
| 移位量 | shift amount (shamt) |
| 機器碼 | instruction code |
| 運算碼 | op code |
| 編譯器 | compiler |
| 組譯器 | assembler |
| 目的檔 | object file |
| 連結器 | linker |
| 載入器 | loader |
| 函式庫 | library |
| 可執行檔 | executable |
| 虛擬記憶體 | virtual memory |
