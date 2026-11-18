# 數字系統與運算

計算機組織的第一章：先看電腦從電晶體、邏輯閘一路長成 processor 的脈絡，以及 ISA 為什麼是軟硬體之間的介面；接著學怎麼量效能（CPU time = IC × CPI × clock cycle time）、程式怎麼從 C 變成記憶體裡的機器碼；最後是電腦算術：ALU 與各種加法器、乘法器與除法器（含 Booth）、IEEE 754 浮點數與浮點加法。考試最常出的是 two's complement 的加減與 overflow、乘除法的逐步追蹤，以及 IEEE 754 single precision（1 + 8 + 23 bits）的編碼與解碼。

## 學完這章要會
- 解釋電腦為什麼用二進位，說明 NMOS／PMOS 怎麼組出 NAND，以及 processor = datapath + control
- 說明 computer architecture = ISA + machine organization，以及 ISA、ABI 作為介面的角色；比較 CISC 與 RISC
- 用 response time、throughput、CPU time 比較效能，會算 CPU time = IC × CPI × clock cycle time 與相對效能
- 說出 compiler、assembler、linker、loader 各做什麼，pseudo-instruction 怎麼展開，為什麼 `$at` 保留給 assembler
- 設計 32-bit ALU（and、or、add、sub、nor、slt），判斷與偵測 overflow，產生 Zero
- 比較 ripple carry、carry lookahead（g、p 與 c1～c4）、多層 lookahead、carry select 的速度與硬體
- 逐步追蹤乘法器（第一版、改良版）、Booth's algorithm 與除法器的每一輪暫存器內容
- 把十進位數編成 IEEE 754 single／double precision，也能從 bits 算回十進位；知道 bias、hidden 1、denormalized、∞、NaN
- 執行浮點加法的對齊、相加、正規化、捨入，並知道浮點加法不具結合律

## 為什麼電腦用二進位

電腦裡的資料都是靠電線上的訊號（signal）傳遞，一個訊號可能代表一個指令，也可能代表一個數字。訊號其實就是**電壓**，而電壓有雜訊、會抖動，不會剛好落在整齊的數值上，所以電腦不去分很多等級，而是畫一條門檻（threshold）：

- 比 threshold 高的一律算 **high**
- 比 threshold 低的一律算 **low**

電壓抖一點也不會判斷錯。只分高、低，一個訊號就只有兩種狀態（state），叫 high／low、true／false 或 1／0 都是同一件事。這樣一個訊號就是一個 **bit**。

> **觀念** 電腦用二進位不是隨便選的，而是電壓只分兩種最穩、最不怕雜訊。

## 電晶體：電子開關

0 與 1 要在電路裡運作，最基本的零件是電子開關（switch），也就是電晶體（transistor）。

### NMOS 的結構

```
            gate（金屬）
        ┌──────────────┐
        │ oxide 絕緣層 │
  source└──────────────┘drain
   [ n ]                [ n ]
 ─────────── p-type silicon（底座）───────────
```

- 底座是 **p-type silicon**：矽經化學摻雜後電洞較多，可想成帶正電。
- 底座上做出兩塊 **n-type silicon**：電子較多，帶負電。
- 兩塊 n-type 中間的上方鋪一層很薄的 **oxide insulator**（氧化物絕緣層），不導電，把上下隔開。
- 絕緣層上面再放一層金屬，叫 **gate**。
- 三個端點（terminal）：左邊 **source**、右邊 **drain**、上面 **gate**。在這三點加不同電壓，開關就會開或關。

把 n、p 對調（底座 n-type、兩邊 p-type）就是 **PMOS**。NMOS 與 PMOS 一起用，就能組出邏輯閘。

### 開關怎麼運作

1. 在 gate 加高電壓，異性相吸，底座裡的電子被吸到 gate 正下方聚集。
2. 這些電子在 source 與 drain 之間排成一條通道，叫 **channel**，兩邊接通。
3. 只要 source 與 drain 之間有電位差，電流就沿 channel 流過，開關是 **ON**。
4. 拿掉 gate 的電壓，電子散開、channel 消失，電流過不去，開關是 **OFF**。

所以 gate 的電壓決定開或關。

## 用電晶體組出 NAND gate

先記符號：

| 元件 | 符號特徵 | 導通條件 |
|---|---|---|
| NMOS | 無圈圈 | gate = 1 導通，gate = 0 不通 |
| PMOS | gate 前有小圈圈（代表相反） | gate = 0 導通，gate = 1 不通 |

接法：上面兩個 PMOS **並聯**接到 VDD（電源），下面兩個 NMOS **串聯**接到 Ground（接地）。輸入 A、B 各接到一個 PMOS 和一個 NMOS 的 gate，輸出 C 接在中間。並聯只要一條通就通；串聯要兩個都通才通。

```
        VDD
     ┌───┴───┐
   PMOS(A) PMOS(B)     ← 並聯
     └───┬───┘
         ├──── C（輸出）
       NMOS(A)
         │             ← 串聯
       NMOS(B)
         │
       Ground
```

逐一代入：

| A | B | NMOS（串聯） | PMOS（並聯） | C |
|---|---|---|---|---|
| 0 | 0 | 兩個都不通 → 下面斷 | 兩個都通 → VDD 把 C 充成 1 | 1 |
| 0 | 1 | 斷一個 → 下面斷 | 還有一條通 | 1 |
| 1 | 0 | 斷一個 → 下面斷 | 還有一條通 | 1 |
| 1 | 1 | 兩個都通 → C 接到 Ground | 兩個都斷 | 0 |

只有兩個都是 1 才輸出 0，其餘都是 1，也就是 NOT(A AND B)：這就是 **NAND gate**。

NAND 是 **functionally complete**（功能完備）：任何 Boolean function 都能只用 NAND 組出來。例如把同一個 A 同時接到兩個輸入，得到 NAND(A, A) = NOT A。

> **陷阱** NMOS 是 gate = 1 導通、PMOS 是 gate = 0 導通。NAND 裡 NMOS 是「串聯」（兩個都是 1 才把輸出拉到 0），PMOS 是「並聯」，別記反。

## 從 gate 到加法器、乘法與暫存器

有了 NAND 這個萬用閘，就能往上組出各種功能單元（function unit）。

- **Full adder（全加器）**：把三個 bit 相加，a、b 和右邊送進來的 carry-in；輸出這一位的 sum 與往左送的 carry-out。例：1 + 1 + 0 = 2，這一位寫 0、進位 1。
- 會加 1 個 bit 就會加 16 個 bit：每一位做的事都一樣，把 16 個 full adder 串起來、carry 往左傳；再加倍就是 32 bits。
- **乘法 = shift and add**：會加法、會 shift 就會乘法。

> **例題** 3 × 5：乘數 5 = `0101`，被乘數 3 = `0011`。乘數的第 0 位是 1 → 加上 `0011`（不移位）；第 2 位是 1 → 加上 `0011` 左移 2 位 = `1100`。`0011 + 1100 = 1111` = 15。

- **Latch（閂鎖）**：把兩個 gate 的輸出交叉接回彼此的輸入（cross-coupled），存進 1 之後即使輸入撤掉仍是 1，能記住 1 個 bit。
- **Register（暫存器）**：16 個或 32 個 latch 排在一起，就能存一個 16 或 32 bits 的數。

能運算又能記憶，電腦要的元件大致都做得出來了，這些都是數位邏輯設計的內容。

## 電腦的基本架構：processor、memory、I/O

執行一個指令（instruction）的流程：

1. 從 **memory** 拿出下一個 instruction（程式就是一串 instruction）。
2. 放進專門的暫存器 **instruction register**。
3. **Decode**：由 **control** 看懂這個 instruction 要做什麼。
4. Control 發出控制訊號：從 **register file**（一組暫存器）拿 data，送進 **ALU** 運算。
5. 把結果寫回暫存器，這個 instruction 就做完了。

任何電腦的 processor 都分成兩塊：

- **Datapath（資料路徑）**：資料走的路，從 register file 拿出、經過運算單元、再寫回 register file，路徑固定。
- **Control（控制單元）**：每個 clock 要做的事不同（這次加、下次減、再下次 shift，或什麼都不做），決定現在做什麼的就是 control。

Register 很快但放不多；大量的 data 和程式本身都放在 memory。Processor 與 memory 是整台電腦的核心。算完要給人用，所以還要 **I/O**：

- Input：把東西交給電腦，如 keyboard、mouse。
- Output：把結果交給人，如 display、printer。
- Disk 也算 I/O：資料多到 memory 放不下就放 disk，可讀可寫。

**Computer organization** 學的是：每個功能單元的功能與效能（例如加法器有 carry ripple 與 carry lookahead 兩種，硬體與速度都不同），以及元件怎麼連接、data 怎麼流、何時由 control 做什麼。這種描述常用 **RTL（Register Transfer Level）**。

## Organization 與 Architecture；ISA 是軟硬體介面

> **比喻** 蓋房子：建築師決定要幾層樓、幾間教室、幾個演講廳，這是「設計」（architecture）；營造商照圖施工，這是「實作」（organization）。

電腦也要先設計：科學運算要很強的 floating point；做影像多媒體可能整數就夠，指令也跟著不同。因此：

**Computer Architecture = Instruction Set Architecture（ISA，像建築師的設計）+ Machine Organization（照設計把硬體做出來）**

設計時要做 trade-off：這樣做還是那樣做？成本多少、效益多少？順序是先定 ISA，再設計 organization。

ISA 的另一個重要角色：它是 **software 與 hardware 之間的 interface**。

- 寫軟體的人不必知道硬體怎麼做，只要知道有哪些 instruction 可用，就能往上寫程式。
- 做硬體的人不用管會跑什麼程式，只要知道最後一定是執行這些 instruction。
- 所以開發新 processor 時常先定 ISA，兩邊可以同時、分開開工。
- 這裡的 hardware 不一定是真晶片，也可以是 **emulator**：用軟體模擬另一種 instruction set 的機器。

## 從高階語言到機器語言

```
high-level language   a = b + c;                    （C、Java）
        │ compiler
        ▼
assembly language     add $s0, $s1, $s2             （假設 a、b、c 在 $s0、$s1、$s2）
        │ assembler（查表直接轉換）
        ▼
machine language      0000 0010 0011 0010 1000 0000 0010 0000 = 0x02328020
```

這個 add 依 MIPS 規則編成 32 bits：

| op | rs | rt | rd | shamt | funct |
|---|---|---|---|---|---|
| 0 | 17（`$s1`） | 18（`$s2`） | 16（`$s0`） | 0 | 32 |
| 000000 | 10001 | 10010 | 10000 | 00000 | 100000 |

- 指令集長什麼樣，compiler 就產生什麼樣的 assembly；processor 不同，最後的 code 也不同。
- 這些 0、1 送進 processor 就變成 control signals，控制 data 在硬體裡怎麼走，又回到「訊號就是 0 與 1」。
- 從這個角度看，instruction set 就是**所有 assembly instruction 的集合**。

## ISA 規定了什麼

對寫軟體的人來說，ISA 是一個概念結構（conceptual structure）加上功能行為（functional behavior）：知道每個指令做什麼，不管它怎麼實作。ISA 要規定：

1. **Operand 數量**。設 b = 2、c = 3，要算 a = b + c：
   - 允許三個 operand：`add a, b, c`，一個指令完成。
   - 只允許兩個 operand（destination 必須等於其中一個 source）：先把 b 搬到 a，再把 c 加進 a，要兩個指令。
   - 結果都是 5，但指令數與所需硬體不同。
2. **Storage 怎麼組織**：例如 16 個還是 32 個 register。16 個能做的事少、但可能比較快，影響很大。
3. **Data 怎麼編碼**：負數用 two's complement 還是 one's complement？例如 −5：1's complement 是把 5 的每個 bit 反相，2's complement 再加 1。表示法不同，做加減的硬體就要不同設計。
4. **提供哪些指令**：有乘法指令就得放一個很大的乘法器；不常用就不提供，改用加法模擬，例如 6 × 4 就加 4 次 6，代價是很多個 cycle、很慢。
5. **Instruction format**（每個指令的 bits 怎麼排）與 **addressing**（怎麼拿到 data）。

本科以 **MIPS（R3000）** 指令集為例：先介紹指令，再看硬體怎麼建。MIPS 的重要特點是只用 **R、I、J 三種 format** 就描述完所有指令，每種的欄位加起來都剛好 32 bits。

## 兩大陣營：CISC 與 RISC

現在最普及的兩個指令集是 Intel 與 ARM：

- **Intel x86**：PC 上的指令集，從 286、386 一路到 64-bit，每一版都加指令、加硬體。PC 的 64-bit 版本是 x86-64；IA-64 是 Intel 另一套叫 Itanium 的架構，別搞混。
- **ARM**：已到第 8 版，手機裡大約九成是 ARM 核心，不是 x86。

| | CISC | RISC |
|---|---|---|
| 全名 | Complex Instruction Set Computer | Reduced Instruction Set Computer |
| 特徵 | 指令多又複雜 | 指令精簡 |
| 代表 | Intel x86 | ARM、MIPS（本科用的） |

學這門課的理由：應用一變就要加新東西、變化很快，而且到處都需要 processor；學完就有能力設計一個 processor。

### 先修知識

- 內容大致依序為：抽象與技術、instructions、arithmetic、processor、memory hierarchy。
- 先修是邏輯設計（Logic Design）：adder、latch、control、mux 都來自那裡，沒修過也一定要自己補。
- 數字表示法（number representation）要很熟，例如 −6：1's complement 把 6 反相，2's complement 再加 1。

> **例題** 4 bits 的 −6：6 = `0110` → 1's complement `1001` → 2's complement `1001 + 1 = 1010`。（示意：位數由此處自選）

## 本單元的三個主題

「Computer Abstractions and Technology」分三塊：

1. **歷史**：電腦怎麼從最早的樣子一步步走到現在。
2. **Abstraction（抽象化）**：每一層把下面的細節與複雜度藏起來，只看這一層就比較好懂。
3. **Technology**：製造技術一直進步，電腦也一直在變。

要說一台電腦好不好，得先定 performance 指標：

- 最重要的之一是 **CPU time**：做完一件工作 CPU 實際花的時間。
- 另一個很重要的是 **power**（耗電）。
- 有指標還要會量：用 **profiling** 找程式哪裡花時間，用 **benchmarking** 拿標準測試程式來比。
- 最後是 **cost**：花越多錢效能可能越好，兩者是 trade-off。

## 電腦的歷史

### 什麼才算 computer

算盤能幫忙計算，但**不是** computer，而且不是因為沒插電，就算插了電也不算。關鍵字是：

- **Programmable**：能依需求改變它要做的事；算盤不能換一個程式自己去做別的事。
- **Electronic machine**：能高速做數學與邏輯運算，還能收集、儲存、分析資料。

真正的電腦出現前已有各種計算裝置：通用的、專用的，機械的、機電的、電子的都有，例如專做差分計算的機器、記帳用的機器。

### Harvard Mark I（1944）

General purpose、以機械加電子做成。特色是 **instruction 與 data 分開放在兩個地方**，CPU 各自從兩邊拿。這種設計後來稱為 **Harvard architecture**，現代 processor 仍看得到。

> **陷阱** Harvard architecture 的重點是 instruction 與 data 放在「兩塊不同的 memory」，不是指某所學校的設計。

### ENIAC 與電晶體

- **ENIAC**：第一部全電子、可程式、general purpose 的電腦。University of Pennsylvania 於 1943 年開始做，1946 年完成。
- 背景是二次大戰（1939–1945）需要大量運算。史實上 ENIAC 是美國陸軍用來計算火砲彈道射表；破解密碼的是英國的 Colossus。
- 尺寸：長 25 公尺（約百米跑道的四分之一）、高 2.5 公尺（比 170 公分的人高 80 公分）。
- 用**真空管（vacuum tube）**當 switch；switch 是組成電腦最重要的元件。
- 速度每秒 1,900 次加法（現在是每秒幾十億次，但當時已很快）。
- 寫程式不是打字，而是靠人搬動 cable 與 switch、重新接線。
- 差不多同時發明了**電晶體**，比真空管 reliable、不易壞；下一個時期 transistor 被拿來當 switch，再與其他元件做成 IC。

### 1950 年代：商品化、IBM 與 IC

- 電腦開始商品化，但又貴又大，要放專門的房間，冷氣與溫度都很講究；一般人用不起，主要用在商務、辦公室自動化或科學計算。
- 出現電晶體做的電腦，如 **IBM 1401**。
- IBM 原本做 **punch card（打孔卡）**：以前沒有鍵盤，程式與資料都要打成卡片；卡片每個位置打洞或不打洞、光透不透得過去，就代表 1 或 0（又是二進位）。IBM 從 50 年代開始做電腦，後來被稱為 Big Blue。
- **IC（Integrated Circuit，積體電路，1958）**：電路除了 transistor 還要電阻、電容，原本都是獨立零件、要拉線連接、很佔空間。IC 把 transistor、電阻、電容通通做在**同一塊半導體**上一次做出來。電路尺寸因此可以一直縮小（shrink），一顆 chip 放越多 device，計算能力越大。

### 1970 年代：微處理器、PC 與 open system

- **Intel 4004 microprocessor**：整個 CPU 做在一顆 chip 上。第一個用途是計算機，也是商業考量：原本要 12 顆 chip，整合成 1 顆便宜多了。
- 有了 microprocessor 就有了 PC：**1977 年 Apple II** 是個人電腦的開始；**IBM PC 晚了四年，1981 年**才推出。
- PC 也造就了微軟的作業系統；1980 到 2000 年，PC 加微軟幾乎主宰市場。

> **觀念** 問：Apple II 早四年，為什麼後來的 PC 大多是 IBM 架構？答：一是比較便宜；更根本的是 IBM PC 是 **open system**，規格全部公開，誰都能做相容零件（台灣的周邊產業就是這樣起來的）。今天手機也有兩條路：Android 開放、很多廠商都能用；Apple 是 closed。

- Xerox 的實驗電腦 **Alto（1973）** 上已有 mouse、Ethernet、icon、menu、所見即所得（WYSIWYG），以及區域網路 LAN、雷射印表機。今天用的很多東西在 1973 年就有 prototype。

### 應用軟體、VLSI 與 RISC

- 讓 PC 真正好用的是軟體：硬體再強，沒有 application 也沒用。1979 年出現第一個電腦記帳軟體（試算表），PC 才真正普及；之後有 dBase 做資料庫。硬體加應用一起推，電腦才持續發展。
- 1980 年代進入 **VLSI（very large scale integration）** 時代：一顆 chip 已能放幾十萬個 transistor。
- 這時 IBM 的 Cocke、Berkeley 的 Patterson、Stanford 的 Hennessy 提出 **RISC**。RISC 不只是學術成果，很多商用 processor 也採用，主要在 workstation，如 MIPS、Sun、IBM。
- RISC 的對手是 CISC，用在 PC 上，就是 Intel 的 x86 系列。

### 後 PC 時代與 Moore's Law

- 80 年代以後 PC 越來越 high-end，workstation 越來越少人用，一台 PC 就夠。
- 現在是**後 PC 時代**，重點變成 **embedded computer**：冰箱、相機、手機、手錶裡都有一台小電腦。
- 從 1940 年代有電腦到現在不到一個世紀，發展非常快，撐住這個速度的是 **Moore's Law（摩爾定律）**：大約每一年半，一顆 chip 上的 transistor 數就加倍（翻倍五次就是 32 倍）。
- 意思是：同樣的面積、同樣的成本，每隔一段時間就有更強的計算能力，而且越來越便宜；便宜了就到處都用（車子裡一堆 microprocessor、手機、基因研究、搜尋引擎）。

### Feature size：電晶體為什麼能一直加倍

回到 NMOS 剖面：gate 加電壓 → 形成 channel → source 到 drain 有電流，開關打開。開與關就是讓電從 source 走到 drain，**這段距離越短，開關越快**。能做到多短取決於製程技術（technology），這個最短距離叫 **feature size**，也叫 **line width**，就是 source 到 drain 的長度。

- 技術一進步 feature size 就一直縮小，從最早的 100 micron 一路往下；晶圓代工廠已能量產 28 奈米製程。
- 換算：1 micron（µm）= 1000 奈米（nm），所以 28 nm = **0.028 µm**。
- 有多小？一根頭髮約 100 µm，100 ÷ 0.028 ≈ 3,571，比頭髮細三千多倍。Transistor 做得這麼小，一顆 chip 就能放非常多個；畫成圖（橫軸時間、縱軸一顆 microprocessor 內的 transistor 數）是一路往上的曲線。

> **陷阱** 28 nm = 0.028 µm，不是 0.28 µm。

Moore's Law 其實是一個**預測**：Gordon Moore（Intel 共同創辦人）在 1965 年的論文中提出。原本說每年加倍，1975 年改成每兩年；常見說法是「每 18 個月」，教科書寫「每 18 到 24 個月」，作答時用 18～24 個月最保險。

## 電腦的分類

| 類別 | 說明 | 重視什麼 |
|---|---|---|
| Desktop computer | 桌上的 PC 或 notebook，給個人用；general purpose（算東西、寫功課、上網） | cost/performance |
| Server | 系上、計算中心等共用的機器，更大、更 high-end，也有做科學計算的；從小台到整棟建築那麼大都有 | capacity、performance，**reliability** 更重要（不能一當機就把資料弄丟） |
| Embedded computer | 嵌在各種裝置裡、隨處可見；只是大系統裡的小 component | power、performance、cost，尤其不能貴；手持裝置電池有限，不能太耗電 |

## 推動電腦發展的力量

1. **Application 推動機器平衡地發展**：大家拿它做什麼，它就往哪裡長。三種應用要的技術完全不同：
   - 科學計算：要很強的 floating point；資料放不進 register、一直搬進搬出，所以 memory bandwidth 也很重要。
   - 交易處理（transaction，如銀行提款、上網查資料）：重要的是 I/O 與 integer 運算。
   - 多媒體：圖片由 pixel 組成，每個 pixel 只有 8 bits（256 級），是 low precision 運算。
2. **Application 推動 performance**：軟體跑得快就不會買新電腦，新軟體跑很慢大家才想換。High-level language 出現後程式好寫，像 game 這種吃計算與記憶體的程式也寫得出來，又推著硬體往前。
3. **Compatibility**：買新電腦一定希望舊的 application 還能跑。所以 Intel 的 CISC 雖然沒有 RISC 漂亮，但上面累積的軟體太多，換掉就不能用，大家只好繼續用。
4. **Ease of use**：新系統太複雜，大家就不想換。
5. **Market demand 與 market share**：一個好功能如果很少人要，研發成本回收不了，就不會做。

## General purpose 與 embedded 電腦的比較

把 desktop 與 server 合成一大類 **general purpose computer**，另一大類是 **embedded computer**。

### General purpose computer

- 最重要的是 **software compatibility**，因為上面一直有大量軟體在跑。
- Product life 很短（short product cycle：新一代一出，舊的就太慢被淘汰）、價格較高、profit margin 較大。
- OS 很重要：習慣 Windows 就繼續買 x86，習慣 workstation 的系統就繼續用那套。
- 未來 transistor 繼續變多，會往 performance、human interface、bandwidth 發展。

### Embedded computer

- 放在另一個 device 裡面、不是主角（例如冰箱裡那顆小 processor）。
- 只跑事先定好的應用（**predetermined application**），例如車子裡的固定管出油量、煞車。
- 用在 control、消費性電子、遊戲機、手機，在這些系統裡都只是一個零件。例如用 Lego 拼的機器人裝一顆 microprocessor，就能刷馬桶、換燈泡、玩魔術方塊。

與 general purpose 相比：

1. 通常**沒有 floating point**：功能固定，不需要複雜的小數運算。
2. **不需要 MMU**（memory management unit）：沒有很大的記憶體要管。
3. 與各式各樣的 **peripheral** 整合在一起。
4. **ISA 可以五花八門**：PC 市場很難做一顆與 Intel 相容的晶片去競爭；但 embedded 功能固定，自己設計 processor、自己寫軟體，compatibility 不是問題，比較容易進場。
5. **Low power** 很重要，因為它只是大系統的一小部分。
6. 可以活很久：4-bit、8-bit 的 microprocessor 至今還在用（像豆漿機裡就有一顆）。
7. 量很大、**cost 一定要低**：一台相機才幾千塊，裡面的 processor 不可能太貴。

以 microprocessor 出貨數量看：1995 年 x86 是第一，2002 年 ARM 已變第一（手機與 controller 都用它）；市場上手機 processor 成長最快。Embedded 是未來趨勢。

> **陷阱** Embedded computer 的 compatibility「不是」主要問題（自己寫自己的軟體）；general purpose 才是 software compatibility 最重要。

## Abstraction：分層看電腦

**Abstraction（抽象化）**：一台電腦可以從高層、中層、低層等不同層級來看。看高層時先把底下的細節藏起來，比較好懂；懂了再往下一層看。用這個方法一層層看電腦由哪些 component 組成，它幫我們處理複雜度（complexity）：一開始就看最細的部分只會搞混。

### 硬體、系統軟體、應用軟體

硬體單獨不會動，軟體單獨也不會，是軟體驅動硬體做事。三層像同心圓：

```
┌──────────────── application software ────────────────┐
│  ┌──────────── system software ─────────────┐        │
│  │   ┌──────── hardware ────────┐           │        │
│  │   └──────────────────────────┘           │        │
│  └──────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────┘
```

- **Application software（應用軟體）**：銀行、機場的系統，甚至 game。它不能直接跑在硬體上，要透過 system software。
- **System software（系統軟體）**，主要兩種：
  - **Compiler**：把 C 這類 high-level language 翻成機器懂的語言（叫人直接寫 0101 太麻煩，也寫不大）。
  - **OS（作業系統）**：處理大家共用的東西，如 I/O、memory、storage；與其每個程式各寫一份，不如寫一份大家共用。很多 process 可能同時要用同一個資源，誰先誰後要有人決定，這叫 scheduling 與 sharing resource。
- **Hardware**：最裡層。

電腦由 hardware、system software、application software 三大塊組成；研究領域也大致落在這三塊之一。

### 程式的層級：高階語言、組合語言、機器碼

以 C 寫的 swap 為例（把陣列 v 的第 k 個與第 k+1 個元素交換）：

```c
void swap(int v[], int k) {
    int temp;
    temp = v[k];
    v[k] = v[k+1];
    v[k+1] = temp;
}
```

- **High-level language**：寫起來很接近問題本身（像數學符號夾英文），提供 **productivity**（寫得快、寫得多）與 **portability**（每台機器指令集不同，但同一份 C 交給那台機器的 compiler 翻就好）。
- 經過 compiler 變成 MIPS **assembly language**，已經很像機器指令，但用 `lw` 這種符號表示，人還看得懂：

```asm
swap: sll  $2, $5, 2      # $2 = k × 4（教科書圖中寫成 muli $2, $5, 4）
      add  $2, $4, $2     # $2 = v 的位址 + k×4 = &v[k]
      lw   $15, 0($2)     # $15 = v[k]（temp）
      lw   $16, 4($2)     # $16 = v[k+1]
      sw   $16, 0($2)     # v[k] = v[k+1]
      sw   $15, 4($2)     # v[k+1] = temp
      jr   $31            # 返回
```

- **Assembler** 再一對一翻成 **machine code**，就是查表：

| 指令 | op | rs | rt | offset |
|---|---|---|---|---|
| `lw $t0, 0($t1)` | 35 | 9（`$t1`） | 8（`$t0`） | 0 |
| 二進位 | 100011 | 01001 | 01000 | 0000 0000 0000 0000 |

拼起來 `1000 1101 0010 1000 0000 0000 0000 0000` = **0x8D280000**。

## 電腦的組成

不管 desktop、server 還是 embedded，硬體都有：

- **Processor**：負責運算。
- **Memory**：存資料。
- **I/O**：與外界溝通，分三種：
  1. User-interface device：display（output）、keyboard、mouse（input）。
  2. Storage device：處理完把資料存起來，要用再拿出來。
  3. Network adapter（網路卡）：讓機器與機器連線溝通。

### 往下看一層：mouse

- 舊式滾球 mouse 用 **counter**：球往哪邊滾，x、y 就加或減，再反映成位置。
- 現在的 **optical mouse**：一顆 LED 發光照亮桌面；裡面其實是一台低解析度的小 camera，每秒拍 1,500 張照片；再用一顆小 processor 做 image processing，比對前後兩張哪裡不同，算出往 x、y 哪邊移動。

### 往下看一層：display

螢幕用 **bitmap** 表示影像，每一點叫一個 **pixel**。

- 黑白：每個 pixel 用 8 bits 表示灰階，2⁸ = 256 級；`00000000` 最黑、`11111111` 最白。
- 彩色：三原色 R、G、B 各 8 bits，一個 pixel 24 bits，可表示 2²⁴ = 16,777,216 種顏色。
- **Resolution** 是螢幕上有多少點：640 × 480 = 307,200 個 pixel；2560 × 1600 = 4,096,000 個 pixel，點越多畫面越細。
- 每一點對應一塊記憶體裡的一格，這塊記憶體叫 **frame buffer**；它存的是這一點的數值（例如那 8 bits），螢幕照這個數值顯示顏色。

這樣一層層往下看，本身就是 abstraction。

### 打開筆電：CPU、DRAM、cache

筆電內有風扇、DVD drive、hard drive、電池、插在插槽上的 **DRAM** memory，以及 **processor（CPU）**：只有小小一塊，卻是整台電腦最貴的零件。

- CPU 與 main memory **不在同一個 chip**：CPU 去 memory 拿東西是 **off-chip**，比較花時間。
- Processor 裡面有 datapath（運算）、control（告訴它何時做什麼），還有 **cache memory**。
- Cache 與運算單元做在同一個 chip 上（**on-chip**），比較小但很快。需要它是因為運算常馬上又要用剛才的資料，每次寫回 off-chip 再讀回來太浪費時間。
- 為什麼不做大一點？太大會讓整顆 CPU 變慢、也比較貴，所以做一塊小而快的貼著 processor。
- 以 4 core 的 processor 為例：每個 core 有自己的 L1 instruction cache 與 L1 data cache，下面還有共用的 L2、L3。Cache 佔了很大面積，真正運算的單元只有一小塊，目的就是讓常用資料不必到 off-chip 拿。

> **陷阱** Cache 在 processor 的 chip 上（on-chip），main memory（DRAM）在 chip 外（off-chip）。

### Volatile 與 non-volatile、網路

- Main memory 是 **volatile（揮發性）**：一斷電資料全不見。
- **Secondary memory**（disk、flash、CD、DVD）是 **non-volatile**：斷電還在、容量大，但更慢。
- **Network**：LAN、WAN，或 Wi-Fi、Bluetooth 等無線網路，讓機器連起來 share resource。

## ISA 是軟硬體介面；ABI

ISA 定義這顆 processor 要能執行哪些 instruction，是 hardware 與 software 之間很重要的 interface。

> **比喻** 雞生蛋、蛋生雞：軟體說「硬體沒做好我怎麼寫」，硬體說「軟體沒寫我怎麼知道要做什麼」，全卡住。在中間定一層 ISA，兩邊都有依據，就能分頭開工。

- 軟體的人不必管硬體怎麼 implement，只要相信它一定能執行這些 instruction。
- 除了 instruction set，還有 OS 幫忙處理細節，寫程式的人只要知道怎麼呼叫 **system call**。
- **ISA + system software 的介面 = ABI（Application Binary Interface）**。懂 ABI 就能寫應用。
- 硬體的人只要知道 instruction set，把它們實作出來；兩邊從這裡分開，各自往細的地方研究。

## 技術趨勢與 cost-performance

- Feature size 一直縮小，transistor 數約每 18 到 24 個月加倍（Moore's Law），所以電腦短時間發展這麼快。
- DRAM 容量也一樣：同樣面積，容量一直變大。
- 東西越小越快；晶片照面積算錢，面積越小越便宜，cost 越來越低。
- 把真空管時代「每塊錢買到的效能」當 1，五十多年後已是幾十億倍（教科書表上約 62 億倍）。效能多這麼多、又這麼便宜，所以到處都放得起 processor。

## Performance：用什麼標準比

> **比喻** 兩架飛機哪架比較好？
>
> | 飛機 | 載客數 | 航程（英里） | 時速（mph） | 載客數 × 時速 |
> |---|---|---|---|---|
> | Concorde（協和號） | 132 | 4000 | 1350 | 178,200 |
> | Boeing 747 | 470 | 4150 | 610 | 286,700 |
>
> 看載客量（passenger capacity）→ 747 最好；看不加油能飛多遠（cruising range）→ 表中的 Douglas DC-8 最好；看速度 → Concorde 最快。把人數與速度一起看（人數 × 速度，代表單位時間把多少人送多遠）→ 747 反而贏。答案取決於用什麼標準，電腦也一樣。

### Response time 與 throughput

- **Response time**（像飛機的速度）：一個工作丟進電腦，多久算出結果，越短越好。
- **Throughput**：total work done per unit time，單位時間做完多少工作（像人數 × 速度）。

兩者的關係：

1. 把 processor 換成更快的：同一個 job 更快跑完，單位時間也做更多事 → **兩者都改善**。
2. 多加一顆 processor：工作分不開時，一個 job 還是要那麼久。例如兩顆各做一個 job，每個仍要 10 個 time unit 才出來，response time 沒變；但同時做兩個，throughput 加倍 → **throughput 變好，response time 不一定變好**。

兩者都重要，但之後主要看 response time。

> **陷阱** 加更多 processor 不一定讓單一工作的 response time 變短，但 throughput 會增加。

### Elapsed time 與 CPU time

- **Elapsed time**（wall clock time）：時鐘上的時間，例如 10:40 丟進去、一分鐘後出結果，elapsed time 就是一分鐘。它不只包含 CPU 運算，還有 I/O、OS，以及與別人共用電腦時自己閒著的 idle 時間。Elapsed time 決定的是**整個 system** 的效能。
- **CPU time**：設計 processor 時只想看 CPU 多快，就把其他時間拿掉。CPU time = **user CPU time**（跑你的程式）+ **system CPU time**（OS 幫你處理事情）。
- System 與 CPU 的效能沒有絕對關係：CPU 快但別處拖累，整體還是差；幾顆慢的搭配得好也可能很好。
- 挑 **benchmark** 時要先想清楚要量什麼：科學家整天跑重計算，主要測 CPU；銀行重視 transaction、常要 I/O，就要測整個系統。

### 相對效能

**Performance = 1 / Execution time**（時間越長效能越差，倒數關係）。

**X 比 Y 快 n 倍：n = Performance_X / Performance_Y = Time_Y / Time_X**

> **例題** A 跑某程式要 10 秒，B 要 15 秒。A 比 B 快幾倍？n = Time_B / Time_A = 15 / 10 = 1.5，A 比 B 快 1.5 倍。

> **陷阱** 公式越簡單越容易搞混：分子放「比較慢那台」的時間，算出來才會大於 1。

## Clock 與 CPU time

**Clock** 是一個規律地 high、low、high、low 跳動的訊號，快慢固定（constant rate）。設計電腦時用 clock 控制 state：clock 的邊緣一到，這段運算就必須做完，把下一個 state 存起來。所以 clock 控制了 data transfer 與 computation，一件工作花多少時間就看用了幾個 clock。

- **Clock period（clock cycle time）**：一次 high 加一次 low，即一個 cycle 的時間。Period 拉長，一個 cycle 能做很多運算，但也代表跳得很慢。
- **Clock rate（clock frequency）**：每秒跳幾下（幾個 cycle），常拿來說電腦多快。
- 兩者互為倒數。例：period = 250 ps = 0.25 ns = 250 × 10⁻¹² 秒；1 / (250 × 10⁻¹² s) = 4 × 10⁹ /s = **4 GHz**。

### CPU time 公式

**CPU time = CPU clock cycles × clock cycle time = CPU clock cycles / clock rate**

> **例題** 每秒跑 100 個 clock，總共跑了 1000 個 clock，要多久？1000 / 100 = 10 秒。

改善效能的兩條路：

1. 減少需要的 clock cycle 數。
2. 提高 clock rate（把 period 變短）。

問：只要把 period 變小，效能一定變好嗎？答：只有 cycle 數不變時才一定變快。但 cycle 數常會跟著變：原本一個 cycle（period 1.0）剛好做完的工作，period 縮到 0.6 就做不完、要兩個 cycle，總時間變 1.2，反而更久。所以硬體設計者要在 clock rate 與 cycle 數之間 trade-off。

> **陷阱** Clock rate 提高不一定讓 CPU time 變短：cycle 數可能跟著增加。

> **例題** Computer A 的 clock 是 2 GHz，跑某程式 CPU time 10 秒。要設計 computer B 讓同一程式降到 6 秒，但 B 的總 cycle 數會是 A 的 1.2 倍。B 的 clock rate 要多少？
>
> 1. 公式：Clock rate_B = Clock cycles_B / CPU time_B，CPU time_B = 6 s。
> 2. Clock cycles_A = 10 s × 2 × 10⁹ /s = 20 × 10⁹。
> 3. Clock cycles_B = 1.2 × 20 × 10⁹ = 24 × 10⁹。
> 4. Clock rate_B = 24 × 10⁹ / 6 s = 4 × 10⁹ /s = **4 GHz**。

這些公式比高中數學還簡單，不要把它想難了。

## Instruction count 與 CPI

剛才的 clock、cycle 是比較低的層級；寫程式的人看到的是 instruction level：一個 C 程式經過 compiler 變成多少個 instruction。

- **IC（instruction count）**：程式執行的指令總數。
- **CPI（clock cycles per instruction）**：平均一個指令要幾個 cycle。不同硬體、不同指令的 CPI 不同：
  - 加法：carry ripple adder 要一位一位傳，假設要 5 個 cycle；carry lookahead 硬體大但快，可能 2 個就好。
  - 乘法用 shift and add，8 bit × 8 bit 至少要加 8 次，花的時間與加法不同，CPI 也不同。

**Clock cycles = IC × CPI**

**CPU time = IC × CPI × clock cycle time = IC × CPI / clock rate**

### 什麼影響 IC

1. **程式本身**：同樣寫 sorting，你寫 100 行、他寫 80 行，產生的指令數就不同。
2. **Algorithm**：quick sort 與 bubble sort 的指令數不同。所以電腦快不只是硬體的事，會不會寫好程式也很重要（這就是要學演算法與資料結構的原因）。
3. **ISA**：`x = a + b + c`。若 ISA 提供能一次把三個數相加的加法，一個指令就做完；只能兩個 source 時，要先算 a + b 放到 t，再把 t 加 c，要兩個指令。
4. **Compiler**：loop 裡寫了一行不變的 `a = 5`，跑 140 次就做 140 次；聰明的 compiler 搬到 loop 外，省下 139 個指令。

### 什麼影響 CPI

- 硬體：例如加法器用 ripple 還是 lookahead。
- 指令組成：不同指令 CPI 不同，平均 CPI 看各類指令佔的比例，簡單的指令越多越好。例如 A × 2⁵ 真的去乘很慢，其實就是 A 左移 5 位（3 × 32 = 96，`0011` 左移 5 位得 `1100000` = 96），聰明的 compiler 用一個 shift 就好。簡單的指令變多、難的變少，平均 CPI 就變小。

## 從 C 程式到記憶體

MIPS 有 R-type、I-type、J-type 三種 format，欄位加起來都是 32 bits，一定要熟記（之後要學硬體怎麼實作它們）。

```
C program
   │ compiler
   ▼
assembly language program
   │ assembler
   ▼
object module（machine language）   library routines（machine language）
   └──────────────┬──────────────────┘
                  │ linker
                  ▼
           executable（machine language）
                  │ loader
                  ▼
               memory
```

- 寫 assembly 一點點功能就要寫很長，所以讓 compiler 幫我們寫。
- **Assembler** 的主要工作是一對一轉換：把 load、store 這些符號直接對應成 0 與 1。
- 程式還會呼叫很多 **library**（別人或以前寫好的 subroutine，也是 machine language）。
- **Linker** 把這些 module 連成一個可執行的 **executable**；**loader** 把它載入 memory，程式就能開始跑。

### Pseudo-instruction 與 `$at`

真正的 instruction 設計出來就一定有硬體去執行它，這才叫 instruction set design。**Pseudo-instruction（虛擬指令）** 只是為了好寫，沒有對應的硬體，由 assembler 換成真指令：

- `move $t0, $t1`（把 `$t1` 搬到 `$t0`）：硬體裡沒有 register 直接搬到 register 的路。Assembler 換成 `add $t0, $zero, $t1`：0 加上 `$t1`、經過 ALU 放進 `$t0`，效果就是搬移。
- `blt $t0, $t1, L`（branch if less than）：沒有能同時比大小、測試、再跳的硬體。Assembler 用兩個真指令：

```asm
slt $at, $t0, $t1     # $t0 < $t1 則 $at = 1，否則 0
bne $at, $zero, L     # $at ≠ 0 就跳到 L
```

問題：你寫 blt 只用到 `$t0`、`$t1`，展開後卻需要第三個 register 放比較結果；32 個 register 裡你用掉了哪些，assembler 並不知道。所以 MIPS 規定 **1 號 register `$at`（assembler temporary）保留給 assembler**，使用者不准用。另外 **0 號 register `$zero` 在硬體上固定是 0**，move 就是靠它。

> **例題** `$t0` = 3、`$t1` = 5：`slt $at, $t0, $t1` → 3 < 5，`$at` = 1；`bne $at, $zero, L` → 1 ≠ 0，跳到 L。

> **陷阱** Pseudo-instruction 沒有自己的硬體；blt 展開成 `slt $at, …` 加 `bne`，所以使用者不能用 `$at`。

### Object module 裡有什麼

一個 subroutine 經 compiler、assembler 可能產生一個 object module，等 linker 連接。內容：

1. **Header**：說明這個包裹裡有什麼（各 segment 多大）。
2. **Text segment**：已翻成 0、1 的 machine instruction。
3. **Static data segment**：程式一開始執行就要配置好的 storage（不是跑到一半才配置的）。
4. **Relocation information**：還沒放進真正的 memory，absolute address 未知，要記下哪些地址之後要補。
5. **Symbol table**：記錄 global 的定義與 external reference（例如呼叫 library 的 function，link 時才補上）。
6. **Debugging information**。

### Linker 與 loader

Linker 的工作：

1. 把各 module 的 segment **merge** 在一起。
2. 決定每個 **label 的 address**（各 subroutine 原本各自做好，包在一起後才定位置）。
3. 把 **location dependent** 的地方與 **external reference** 補上正確地址。

Linker 只排好相對位置，真正放在 memory 哪裡是 loader 的事（有的系統從某個起點 relocate 上去）。有 **virtual memory** 時不用一次全搬：先放 disk，跑到哪搬到哪，用 translation table 記錄。

Loader 載入程式的步驟：

1. 讀 header，得知各 segment 的大小。
2. 建立 virtual address space。
3. 準備 text 與 data：有 virtual memory 時建好 page table，先標成「不在」，發生 page fault 時再一頁頁搬。
4. 把 argument 放到 stack（C 的 main 其實也是一個 procedure，開始前參數要先設好）。
5. Initialize registers。
6. 跳到 startup routine 開始執行（就像 C 程式從 main 開始）。

## Compiler 最佳化：IC 與 CPI 不能單看

以 bubble sort 為例，比較 C compiler 不最佳化（none）與 O1、O2、O3（數字取自教科書的圖）：

| | none | O1 | O2 | O3 |
|---|---|---|---|---|
| Relative performance（越高越好） | 1.00 | 2.37 | 2.38 | 2.41 |
| Clock cycles（百萬，越少越好） | 158,615 | 66,990 | 66,521 | 65,747 |
| Instruction count（百萬） | 114,938 | 37,470 | 39,993 | 44,993 |
| CPI | 1.38 | 1.79 | 1.66 | 1.46 |

- Performance 最高的是 O3（2.41），但與 O1、O2 差不多。
- Clock period 相同時，執行時間 = cycle 數 × period，cycle 越少越好。不優化的時間放分子、O3 的放分母：158,615 / 65,747 ≈ 2.41，正是 O3 的 relative performance。
- O1 的 instruction count 最少，能說 O1 最快嗎？不能：O1 的 CPI 最高（1.79），compiler 可能產生比較複雜的指令。
- IC × CPI 才是 cycle 數：O1 約 67,000（百萬），O3 約 65,700，O3 反而最快。

> **陷阱** 絕對不能單用 IC，也不能單用 CPI 來判斷 compiler 的好壞；instruction count 最少的（O1）不一定最快，要看 IC × CPI × clock cycle time。

### 演算法比 compiler 最佳化重要

| Relative performance | C none | C O1 | C O2 | C O3 | Java interpreter | Java JIT |
|---|---|---|---|---|---|---|
| Bubble sort | 1.00 | 2.37 | 2.38 | 2.41 | 0.12 | 2.13 |
| Quicksort | 1.00 | 1.50 | 1.50 | 1.91 | 0.05 | 0.29 |

- Java 有兩種執行方式：interpreter（不優化）與 just-in-time（JIT）編譯。C 的 optimization 與 Java 的差很多。
- 同樣是 O1，bubble sort 快 2.37 倍，quicksort 只快 1.5 倍；Java 的改善也較少，quicksort 時 Java 甚至比 C 不優化還差。不同程式即使用同樣的最佳化、不同語言，結果都不一樣。
- 最重要的比較：在 C 不優化時，**quicksort 比 bubble sort 快 2,468 倍**（約兩千五）。Compiler 再厲害也只改善 1.5 倍、2 倍多；換一個好 algorithm 卻快兩千多倍。

> **重點** 越上層的 optimization 改善越大：先把 algorithm 寫好，再用下層方法加速。三個教訓：IC、CPI 不能單獨當效能指標；compiler 最佳化的效果對 algorithm 很敏感；爛程式會差非常遠。

### Array 與 pointer

把 array 全清成 0（i 從 0 跑到 size，例如 100；array 一格接一格，每格 4 bytes）有兩種寫法：

```c
void clear1(int array[], int size) {        /* array index 寫法 */
    int i;
    for (i = 0; i < size; i += 1)
        array[i] = 0;
}

void clear2(int *array, int size) {         /* pointer 寫法 */
    int *p;
    for (p = &array[0]; p < &array[size]; p = p + 1)
        *p = 0;
}
```

- Array 寫法：i 一直加 1，但每次加完都要重算地址 base + i × 4。
- Pointer 寫法：p 直接指到某一格，下一格就加一個 element 的大小（4 bytes 就加 4），走過的清成 0。

兩者功能相同。轉成 MIPS（array 位址在 `$a0`、size 在 `$a1`）：

```asm
# clear1：array 版，loop 內 6 個指令
        move $t0, $zero         # i = 0
loop1:  sll  $t1, $t0, 2        # $t1 = i × 4（乘法太貴，用左移 2 位）
        add  $t2, $a0, $t1      # $t2 = &array[i]
        sw   $zero, 0($t2)      # array[i] = 0
        addi $t0, $t0, 1        # i = i + 1
        slt  $t3, $t0, $a1      # $t3 = (i < size)
        bne  $t3, $zero, loop1  # 若 i < size 跳回 loop1
```

```asm
# clear2：pointer 版，loop 內 4 個指令
        move $t0, $a0           # p = &array[0]
        sll  $t1, $a1, 2        # $t1 = size × 4
        add  $t2, $a0, $t1      # $t2 = &array[size]
loop2:  sw   $zero, 0($t0)      # *p = 0
        addi $t0, $t0, 4        # p = p + 4
        slt  $t3, $t0, $t2      # $t3 = (p < &array[size])
        bne  $t3, $zero, loop2  # 若 p < &array[size] 跳回 loop2
```

Pointer 版的 loop 裡沒有 i 的遞增，也沒有乘 4，都搬到外面只做一次。每圈省 6 − 4 = 2 個指令，跑 100 次省 200 個指令。

- **Strength reduction**：把重的運算換成輕的，例如乘法換成 shift（兩版都有做）。
- **Induction variable elimination**：把 index 的計算移到 loop 外，讓 loop 從 6 個指令變 4 個。

好的 compiler 會自動做這些，所以寫程式不必寫成難懂的版本，仍要寫得 readable。

## 其他指令集：ARM 與 x86

### ARM 與 MIPS

MIPS 與 ARM 最像，都是 RISC。ARM 是最普及的 embedded core，手機都用它，用量已超過 x86。

| | MIPS | ARM |
|---|---|---|
| 推出 | 約 1985 | 約 1985 |
| 指令長度 | 32 bits | 32 bits |
| Address space | 32 bits | 32 bits |
| Data alignment | 要 align | 要 align |
| Addressing mode | 少 | 多 |
| Register 數 | 32 | 16 |
| I/O | memory mapped | memory mapped |

**Memory-mapped I/O**：用存取記憶體地址的方式操作 I/O。

ARM 最大的不同：**每個指令前面有 4 bits 的 condition**，決定這個指令要不要執行。

- MIPS 要比較後跳：先用 `slt` 把結果放進指定的 register，再用 branch 測它。
- ARM 有專門的 **status register** 放 condition code：**N**（negative，結果為負）、**Z**（zero）、**C**（carry，有進位）、**V**（overflow）。
- `CMP r1, r2` 只比較、不改 register，只更新 condition code。例如 r1 = 3、r2 = 5：3 − 5 < 0，N = 1、Z = 0。
- 之後每個指令看目前的 condition code，滿足前 4 bits 的條件才執行，例如 `ADDLT` 只在「小於」時才加。
- 所以「if a < b 就做某事」：MIPS 要好幾個指令跳來跳去，ARM 一個有條件的指令就好，省下 IC。
- ARM 指令也是 32 bits，format 比 x86 規則，但比 MIPS 的三種多，要多幾個 bits 來分辨 format。

### x86：evolution with backward compatibility

x86 是 CISC，理解它最重要的一句話：**一路演進，同時向後相容**。這麼複雜、不 elegant 還留著，是因為以前的程式都用它寫，新的出來舊程式還是要能跑。

| 年份 | 處理器／擴充 | 重點 |
|---|---|---|
| 1974 | 8-bit（8080） | 沒有 register file，只有一個 accumulator，加減都在它裡面做 |
| 1978 | 8086 | 擴充成 16-bit |
| 1980 | 8087 | floating point coprocessor（原本只有整數，浮點交給協同處理器） |
| 1982 | 80286 | 較複雜的 MMU，address 24 bits，可定址 2²⁴ = 16 MB |
| 1985 | 80386 | 擴充成 32 bits（IA-32），多了 addressing mode、paging 與 segment |
| 1989 | 80486 | 同期有 AMD 等競爭者 |
| 1993 | Pentium | superscalar，可同時執行多個指令；有名的浮點除法（FDIV）bug，此後硬體做出來前的 formal verification 變得非常重要 |
| 之後 | Pentium Pro、Pentium II | 新架構一直出 |
| 1999 起 | SSE（Streaming SIMD Extension） | 一個指令同時處理很多資料，主要給串流的圖形資料 |

每次擴充都要相容、舊指令一定要留，這是它最大的負擔。技術上優雅不等於市場成功（technical elegance ≠ market success）。

### x86 的暫存器、定址、編碼與實作

- General purpose register 只有 8 個（32-bit 的 EAX、ECX 等），還與特定用途共用。
- 一個指令只有兩個 operand，一個兼當 source 與 destination：`add eax, ebx` 就是 eax = eax + ebx。
- Operand 可以直接在 memory；MIPS 則是 **load-store machine**，運算的東西要先在 register 或是 immediate。
- Memory 定址方法很多：base + displacement，還有 index × scale。每個指令都可能去 memory 拿資料，可能很久。
- Encoding：MIPS、ARM 每個指令都是 32 bits，每次 fetch 32 bits 再 decode 就好；x86 長度從 **1 byte 到 15 bytes**都有，光是「下一個指令多長」就要先看前面幾個 bits 才知道，每次 fetch 的大小也不一樣。
- 實作：為了相容全部都要支援，但 compiler 盡量產生簡單的指令，簡單的直接用硬體一對一做；複雜的指令拆成很多小的 **micro-operation** 湊起來執行。硬體只處理小而簡單的 micro-operation，好優化、好加速，其實就是 RISC 的概念，效能也與 RISC 差不多。

## Fallacy 與 pitfall

Fallacy 是錯誤觀念，pitfall 是容易踩的坑。

- **Fallacy 1：越 powerful 的指令，performance 越高。** 聽起來指令數變少了，但複雜指令很難實作，而且為了它整個 clock cycle 要拉長，其他所有指令都被拖慢。
- **Fallacy 2：要寫有效率的程式就要寫 assembly。** 現在 compiler 很厲害（如 strength reduction 都會做）；要有生產力、少犯錯，就寫 high-level language。
- **Fallacy 3：為了 backward compatibility，instruction set 就不能改、不能加。** 看 x86，指令一直加：舊的要留，但新應用需要新指令。
- **Pitfall 1：以為連續 word 的地址每次加 1。** Memory 是 byte 定址，一個 word 4 bytes，所以是 0、4、8、12。
- **Pitfall 2：把指向區域變數的 pointer 傳出 procedure。** Procedure 一結束，stack frame 被 pop 掉，pointer 就無效了。

## 四個設計原則

MIPS 指令集長這樣是有原因的：

1. **Simplicity favors regularity**：format 只有三種，op 固定 6 bits，rs、rt、rd 位置固定。
2. **Smaller is faster**：register 好像越多越好，為什麼不用 64 個？只取 32 個，因為小比較快。
3. **Make the common case fast**：常數很常用，所以設計 I-type，把常數直接放在指令裡，不用去 memory 拿。
4. **Good design demands good compromises**：最好只有一種 format，但 R、I、J 還是稍有不同，這就是折衷。

MIPS 是典型的 RISC，x86 是 CISC。將來做設計一定要先 **profiling**，找出最常用的指令來優化：依 Amdahl's law，佔的比例高，優化才有用。

## 從 ISA 到硬體：ALU 要做哪些運算

MIPS 的 ISA（instruction set architecture，電腦聽得懂哪些指令的規格）定好之後，要反過來問：硬體要怎麼蓋？做法是一塊一塊來：先把一個個 component 做好，再接起來，變成能執行每條指令的電路。

第一個要做的 component 跟運算有關，這一塊叫 **computer arithmetic（電腦算術）**。所有運算集中交給 **ALU（arithmetic logic unit，算術邏輯單元）**：CPU 裡真正動手做加減與邏輯運算的地方。先從加法、減法做起，再把它們建進 ALU。

問：MIPS 只有 R、I、J 三種格式，哪一種最需要 ALU？
答：**R-type**。像 `add`、`sub` 這種「兩個 register 運算、結果寫回 register」的指令，都要靠 ALU 算。

除了加減，R-type 還有 `and`、`or` 這類邏輯運算，所以要做一個**能被控制**的 ALU：叫它做哪種就做哪種。

減法不另外做減法器，而是利用 **two's complement（2 的補數）** 把減法變成加法。

> **觀念** 資料怎麼表示，決定硬體怎麼設計：因為整數用 two's complement 表示，減法才能直接借用加法器。

這次 ALU 要做的功能清單共六種：`and`、`or`、`add`、`sub`、`slt`（set on less than）、`nor`。會了這六種，其他運算也是用同樣方法一個一個加上去。

問：為什麼清單裡是 `nor` 而不是 `not`？
答：MIPS 沒有 NOT 指令，用 NOR 就能做出 NOT：`a NOR 0 = NOT a`。

| a | 0 | a OR 0 | a NOR 0 | NOT a |
|---|---|---|---|---|
| 0 | 0 | 0 | 1 | 1 |
| 1 | 0 | 1 | 0 | 0 |

## ALU 的外觀與 ALU control

```
              ALU control (4 bits)
                     │
          ┌──────────▼──────────┐
 a (32) ──►                     │
          │         ALU         ├──► Result (32)
 b (32) ──►                     ├──► Overflow
          │                     ├──► Zero
          └─────────────────────┘
```

- 兩個 32-bit 運算元 a、b 進，32-bit 結果出。
- **ALU control**：4 個 bit，告訴 ALU 這次做哪種運算。
- 另外輸出兩個訊號：**Overflow**（結果放不放得下）、**Zero**（結果是不是 0，給 `beq` 判斷相等用）。

ALU control 的對應（後面會看到每個 code 都不是亂編的）：

| ALU control | 運算 |
|---|---|
| 0000 | AND |
| 0001 | OR |
| 0010 | add |
| 0110 | sub |
| 0111 | slt |
| 1100 | NOR |

### 這 4 個 bit 從哪來

從指令本身，R-type 指令最後面那一段。R-type 有六個欄位：

| op | rs | rt | rd | shamt | funct |
|---|---|---|---|---|---|
| 6 bits | 5 bits | 5 bits | 5 bits | 5 bits | 6 bits |

共 32 bits。所有 R-type 的 op 都是 `000000`，光看 op 分不出是加還是減；真正決定做加、減還是 and 的是最後的 **funct** 欄位。funct 經過一點轉換，就變成 ALU control code。

> **重點** control 訊號是從指令裡「拉出來」的：R-type 的 op 全為 0，funct 決定 ALU 做哪種運算。

## 1-bit slice：先做好一個 bit

32 個 bit 一次設計很難，所以先只做一個 bit，叫 **one-bit slice（一片）**。這是 **divide and conquer（分而治之）**：把 32-bit ALU 切成 32 片 1-bit ALU。每個 bit 做的事都一樣，只要把一片做對，再複製、黏起來就好。基本版做完，再 **extension**：一步一步加功能，變成更複雜的 ALU。

1-bit ALU 的基本版：同一對 a、b **同時**送進三個零件：AND 閘、OR 閘、做加法的 **full adder（全加器）**。三個零件同時都有結果，但每次只要其中一個，所以後面接一個 **multiplexer（MUX，多工器）** 來挑。

```
           Operation (2 bits)
                 │
 a ──┬──[AND]──► 0 ┐
     │             │
 b ──┼──[OR ]──► 1 ├─ MUX ──► Result
     │             │
     └──[ + ]──► 2 ┘
          ▲  │
   CarryIn   CarryOut
```

## Multiplexer：select 決定誰出去

MUX 有多個 input、只有一個 output，由 **select input** 決定哪一個 input 走到 output。

### 2-to-1 MUX

兩個 input A、B，只能挑一個出去；只有兩個可選，select 1 個 bit 就夠。

| select | output |
|---|---|
| 0 | A |
| 1 | B |

### 4-to-1 MUX

四個 input，output 還是一個；四選一，select 要 2 bits。

| select | output |
|---|---|
| 00 | input 0 |
| 01 | input 1 |
| 10 | input 2 |
| 11 | input 3 |

### 回到 ALU：3-to-1 MUX

AND、OR、加法的結果各接到 MUX 的一個 input。只有三個 input，是 3-to-1 MUX；圖上叫 **Operation** 的線就是它的 select。三選一 select 還是要 2 bits，會多出一個組合（11）沒用到。

| Operation | 選出的結果 |
|---|---|
| 00 | AND |
| 01 | OR |
| 10 | 加法（full adder 的 sum） |

用一個 control 訊號控制 MUX，同一塊電路就能做三種運算。

## 把 1-bit ALU 串成 32 bits

一個 bit 會了，四個 bit 就把同一片重複四次。右邊是 bit 0（最低位），左邊是 bit 3。唯一不同的是 carry：**每片的 CarryOut 接到左邊那片的 CarryIn**。

```
   bit 3        bit 2        bit 1        bit 0
 ┌──────┐     ┌──────┐     ┌──────┐     ┌──────┐
 │ALU 3 │◄─c3─┤ALU 2 │◄─c2─┤ALU 1 │◄─c1─┤ALU 0 │◄─ CarryIn (c0)
 └──────┘     └──────┘     └──────┘     └──────┘
     ▲            ▲            ▲            ▲
     └────────────┴─ Operation ┴────────────┘   （同時送給每一片）
```

### 例題：0101 + 0011

逐位從右往左加（cᵢ = 進入 bit i 的 carry）：

```
bit  aᵢ bᵢ cᵢ │ sum  carry out
 0   1  1  0  │  0    1
 1   0  1  1  │  0    1
 2   1  0  1  │  0    1
 3   0  0  1  │  1    0

  0101   (5)
+ 0011   (3)
------
  1000   (8)
```

結果 1000 = 8，與 5 + 3 相同，進位一路從右傳到左。四片會了，十六片、三十二片也一樣，接下去就是 32-bit ALU。

> **重點** Operation 要同時送給每一片：32 片一起做同一種運算。

## 減法：A − B = A + (−B)

不另外做減法器，還是用加法器：把 B 變成 −B，A − B 就等於 A + (−B)。問題變成：在 two's complement 裡，−B 怎麼來？

1. 每個 bit 反相（invert）：0 變 1、1 變 0。例：B = 0110 → 1001。
2. 最低位（least significant bit）再加 1：1001 + 1 = 1010，就是 −6。

### 硬體：Binvert 與 CarryIn

- **反相**：在每片的 b 前面放一個 2-to-1 MUX，一個 input 是 b，一個是經過 inverter 的 b̄。控制它的 bit 叫 **Binvert**：Binvert = 0，b 照原樣進去；Binvert = 1，進去的是 b̄。
- **加 1**：問：這個 +1 要加在哪？答：硬體裡早就有現成的地方。每片都是 full adder，有三個 input：x、y 與 carry in。只要把 **bit 0 那片的 CarryIn 設成 1**，就等於 x + y + 1。

Binvert = 1 且 bit 0 的 CarryIn = 1，加法器算的就是 a + b̄ + 1 = a − b。

```
          Binvert
             │
 b ──┬───► 0 ┐
     │       ├─ MUX ──► full adder 的 y
     └─[NOT]► 1 ┘
```

### 例題（示意）：0111 − 0110

```
  0111            0111
− 0110    →       1001   (0110 反相)
                +    1   (bit 0 的 CarryIn = 1)
                ------
               1 0001    最左的 carry out 丟掉 → 0001 = 1
```

逐位：bit 0：1+1+1 = 11（sum 1，carry 1）；bit 1：1+0+1 = 10（sum 0，carry 1）；bit 2：1+0+1 = 10（sum 0，carry 1）；bit 3：0+1+1 = 10（sum 0，carry 1）。7 − 6 = 1 正確。

> **陷阱** 只做 Binvert 得到的是 1's complement（只有反相），一定要配上 bit 0 的 CarryIn = 1 才是 −B。

## ALU control code 的意義

| 運算 | code | 最後兩 bit | 從右數第 3 bit |
|---|---|---|---|
| AND | 0000 | 00 | 0 |
| OR | 0001 | 01 | 0 |
| add | 0010 | 10 | 0 |
| sub | 0110 | 10 | 1 |

- **最後兩個 bit** 就是接到 MUX 的 select，也就是 Operation：AND 00、OR 01、add 10。sub 最後兩 bit 也是 10，因為減法就是加法。
- **從右數第三個 bit 是 Bnegate**：b 要取負就是 1，不要就是 0。add 與 sub 的 MUX 都選加法器，差別只在 Bnegate。
- Bnegate **同時控制** Binvert 與 bit 0 的 CarryIn（反相與 +1 一起做，所以合成一條線）。

這 4 個 bit 由指令決定：拿到一條 R-type，從 funct 轉出這組 code，分給各條 control 線。

> **觀念** control 聽起來抽象，其實就是這些 MUX 的 select，以及要不要反相的訊號。

## NOR：用 De Morgan 改成「反相再 AND」

這次 a 前面也多一個反相的 MUX，控制線叫 **Ainvert**。依 **De Morgan 定律**：

`NOT(a OR b) = (NOT a) AND (NOT b)`

四種組合驗算：

| a | b | a OR b | NOT(a OR b) | NOT a | NOT b | (NOT a) AND (NOT b) |
|---|---|---|---|---|---|---|
| 0 | 0 | 0 | 1 | 1 | 1 | 1 |
| 0 | 1 | 1 | 0 | 1 | 0 | 0 |
| 1 | 0 | 1 | 0 | 0 | 1 | 0 |
| 1 | 1 | 1 | 0 | 0 | 0 | 0 |

做法：a 反相、b 反相，再讓 MUX 選 AND 的結果（select = 00）。

問：NOR 的 control code 是多少？
答：4 個 bit 依序是 Ainvert、Bnegate、Operation（2 bits）：a 要反相 1、b 要反相 1、選 AND 00 → **1100**。

> **重點** ALU control = Ainvert | Bnegate | Operation(2)。每個 code 都不是亂給的，它就是各條 control 線的值。

## Set on less than（slt）

`slt rd, rs, rt`：如果 rs < rt，rd 設成 1，否則設成 0。也就是兩個 register a、b 比大小，看 a 有沒有小於 b。

要另外做一個比較器嗎？太麻煩，ALU 裡已經有減法：只要算 a − b，結果是負的就代表 a < b。例：3 − 5 = 1110（−2），sign bit 是 1。

```
  0011   (3)
+ 1010   (5 = 0101 反相)
+    1   (CarryIn)
------
  1110   (−2)  sign bit = 1 → 3 < 5 成立
```

逐位：bit 0：1+0+1 = 10（sum 0，carry 1）；bit 1：1+1+1 = 11（sum 1，carry 1）；bit 2：0+0+1 = 1（sum 1，carry 0）；bit 3：0+1+0 = 1（sum 1）。

做完 a − b，destination register 其實只要設一個 bit：rd 最右邊的 bit 0 設成 1 代表小於，其他 31 個 bit 都是 0。成立時 rd = `000…001`，不成立時 rd 全是 0。所以 slt 的硬體分三部分處理：

1. **bit 1～30**：結果一律是 0。每片 MUX 本來只用到 00、01、10，第四個 input（11）還空著，把它叫 **Less**；中間這些片的 Less 接 0，選 11 時就輸出 0。
2. **最高位（MSB，bit 31）**：只要設成減法，MSB 那片的加法器就已經算出 a − b 的 sign bit。把這個加法器輸出另外拉一條線出來，叫 **Set**。a < b 時 a − b 是負數，Set = 1。但 MSB 自己的 Less 還是接 0，所以 MSB 的輸出是 0。
3. **bit 0**：把 Set 接到 bit 0 那片的 Less；選 11 時 bit 0 就輸出 Set 的值。

```
          Less          Less          Less          Less
  bit 31 ◄─ 0   bit 30 ◄─ 0   …    bit 1 ◄─ 0   bit 0 ◄─ Set
    │                                               ▲
    └── 加法器 sum（a−b 的 sign bit）= Set ──────────┘
```

slt 的 control：MUX 選 11，而且 b 要取負才算得出 a − b 的 sign bit，所以是 **0111**（Ainvert 0、Bnegate 1、Operation 11）。

問：選 11 時，加法器有沒有在做減法？
答：有。MUX 前面的 AND、OR、加法每一刻都在算，只是沒被選中的結果出不去。slt 沒有選加法的輸出，卻用了它算出的 sign bit。

> **觀念** **parallel data flow**：input 一來，每個單元的 output 都跟著變，MUX 只負責挑。

> **陷阱** slt 的 sign bit 是送到 **bit 0**，不是留在 bit 31；其他 bit（包含 bit 31）都輸出 0。

### 總整理：ALU 的六種運算

| 運算 | Ainvert | Bnegate | Operation | code | 說明 |
|---|---|---|---|---|---|
| AND | 0 | 0 | 00 | 0000 | 選 AND |
| OR | 0 | 0 | 01 | 0001 | 選 OR |
| add | 0 | 0 | 10 | 0010 | 選加法 |
| sub | 0 | 1 | 10 | 0110 | 選加法 + b 取負 |
| slt | 0 | 1 | 11 | 0111 | 選 Less + b 取負 |
| NOR | 1 | 1 | 00 | 1100 | a、b 都反相再選 AND |

## Overflow：什麼時候發生、怎麼偵測

**Overflow（溢位）**：答案大到或小到，放不進固定的 bit 數。

### 4-bit two's complement 能表示的範圍

| 二進位 | 值 | 二進位 | 值 |
|---|---|---|---|
| 0000 | 0 | 1000 | −8 |
| 0001 | 1 | 1001 | −7 |
| 0010 | 2 | 1010 | −6 |
| 0011 | 3 | 1011 | −5 |
| 0100 | 4 | 1100 | −4 |
| 0101 | 5 | 1101 | −3 |
| 0110 | 6 | 1110 | −2 |
| 0111 | 7 | 1111 | −1 |

16 種組合剛好表示 −8 到 7，負數比正數多一個。運算結果要用同一種表示法來讀：最大 7、最小 −8，超出就放不下。

### 例題：7 + 3

```
carry   0111 0      （c4 c3 c2 c1 c0 = 0 1 1 1 0）
         0111   (7)
       + 0011   (3)
       ------
         1010   → 讀成 −6
```

逐位：bit 0：1+1 = 10（sum 0，carry 1）；bit 1：1+1+1 = 11（sum 1，carry 1）；bit 2：1+0+1 = 10（sum 0，carry 1）；bit 3：0+0+1 = 1（sum 1，carry 0）。答案應該是 10，但 4 bits 最大只到 7：overflow。兩個正數加出 1010 = −6，符號錯了。

### 例題：(−4) + (−5)

```
carry   1000 0      （c4 c3 c2 c1 c0 = 1 0 0 0 0）
         1100   (−4)
       + 1011   (−5)
       ------
       1 0111   → 丟掉最左 carry，讀成 +7
```

逐位：bit 0：0+1 = 1；bit 1：0+1 = 1；bit 2：1+0 = 1；bit 3：1+1 = 10（sum 0，carry 1）。應該是 −9，比 −8 還小：overflow。兩個負數加出 0111 = +7。

### 什麼情況才可能 overflow

問：一正一負相加會不會 overflow？
答：永遠不會。正負互相抵消，結果一定落在兩者之間。

只有兩個**同號**（都正或都負）相加才可能 overflow：兩個正數相加應該永遠是正，兩個負數相加應該永遠是負。所以條件是：**正 + 正 → 負，或 負 + 負 → 正**，sign bit 不對了。

### 偵測：MSB 的 carry in ≠ carry out

把條件化簡，結論是只要看最高位（sign bit）那一位的 carry in 和 carry out 一不一樣：

- 7 + 3：MSB carry in = 1，carry out = 0，不一樣 → overflow。
- (−4) + (−5)：MSB carry in = 0，carry out = 1，不一樣 → overflow。

道理：兩個正數的 sign bit 都是 0，進來一個 carry 就把 sign bit 變成 1（變負），卻沒有 carry 推出去；兩個負數的 sign bit 1 + 1 推出一個 carry，又沒有 carry 進來，sign bit 就變成 0（變正）。

MSB 那一位的全部八種情況：

| a₃ | b₃ | carry in | sum₃ | carry out | overflow？ |
|---|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 0 | 否 |
| 0 | 0 | 1 | 1 | 0 | **是**（正+正得負） |
| 0 | 1 | 0 | 1 | 0 | 否（異號） |
| 0 | 1 | 1 | 0 | 1 | 否（異號） |
| 1 | 0 | 0 | 1 | 0 | 否（異號） |
| 1 | 0 | 1 | 0 | 1 | 否（異號） |
| 1 | 1 | 0 | 0 | 1 | **是**（負+負得正） |
| 1 | 1 | 1 | 1 | 1 | 否 |

只有 carry in ≠ carry out 的兩列是 overflow。偵測硬體很簡單：把 sign bit 的 carry in、carry out 接到一個 **XOR gate**，輸出 1 就是 overflow。

`Overflow = CarryIn(MSB) ⊕ CarryOut(MSB)`

### 例題（示意）：5 + (−3)，有 carry out 卻沒有 overflow

```
         0101   (5)
       + 1101   (−3)
       ------
       1 0010   → 丟掉最左 carry，2，正確
```

逐位：bit 0：1+1 = 10（carry 1）；bit 1：0+0+1 = 1（carry 0）；bit 2：1+1 = 10（carry 1）；bit 3：0+1+1 = 10（sum 0，carry 1）。MSB carry in = 1、carry out = 1，相同 → 沒有 overflow。

> **陷阱** 判斷 overflow 不是看 carry out 有沒有 1，而是 MSB 的 carry in 與 carry out 是否不同。

### Overflow 之後怎麼辦

偵測到 overflow 之後怎麼處理，看程式語言怎麼定義；有的語言覺得 overflow 就算了，沒關係。

- 需要處理：用會檢查的**有號指令**，例如 `add`、`sub`。一 overflow 就跳到 **exception handler（例外處理程式）**。
- 不在乎：用 **unsigned 指令**，例如 `addu`，overflow 也不會觸發 exception。

## Zero 偵測

**Zero**：把所有 Result bit 一起做 NOR，全部是 0 時才輸出 1。`beq` 就靠它判斷兩數相等（相減為 0）。

`Zero = NOT(R31 OR R30 OR … OR R1 OR R0)`

例（示意，4 bits）：

| Result | OR 全部 bit | Zero（NOR） |
|---|---|---|
| 0000 | 0 | 1 |
| 0100 | 1 | 0 |

## Ripple carry adder 的問題：carry 一級等一級

複習：ALU 能做 and、or、slt、nor 和加法，全部同時算好，再透過 MUX 決定輸出哪一個；MUX 的 select 就是 control signal，來源是 R-type 的 funct。接下來要讓 ALU 跑得更快，先回到加法器。

前面把 1-bit full adder 重複接起來的加法器叫 **ripple carry adder（漣漪進位加法器）**：進位像漣漪一樣一圈圈傳。

### Full adder

三個 input（x、y、carry in），兩個 output（sum、carry out）：

| x | y | cin | sum | cout |
|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 0 |
| 0 | 0 | 1 | 1 | 0 |
| 0 | 1 | 0 | 1 | 0 |
| 0 | 1 | 1 | 0 | 1 |
| 1 | 0 | 0 | 1 | 0 |
| 1 | 0 | 1 | 0 | 1 |
| 1 | 1 | 0 | 0 | 1 |
| 1 | 1 | 1 | 1 | 1 |

- carry out：三個 input 任兩個是 1 就進位：`cout = x·y + x·cin + y·cin`，三個 AND 加一個 OR。
- sum：`sum = x ⊕ y ⊕ cin`（1 的個數為奇數時是 1）。

每一級要過一個 AND 再一個 OR，叫 **two gate delay**，才產生 carry out。carry out 要給下一級當 carry in，下一級得等它進來，才算得出自己的 sum 和 carry out。

### 最壞情況：1111 + 0001

```
bit 0: 1+1     = 10 → c1 = 1   （2 gate delay 後才有）
bit 1: 1+0+c1  = 10 → c2 = 1   （再等 2 gate delay）
bit 2: 1+0+c2  = 10 → c3 = 1   （再等 2 gate delay）
bit 3: 1+0+c3  = 10 → c4 = 1   （再等 2 gate delay）
結果 1 0000
```

carry 一路傳到最左邊，每一級都在等右邊，delay 一直累加。sum 也會晚一點，但最晚出來的是最後一級的 carry out。n bits 的最後一個 carry 大約要 2n 個 gate delay；32 bits 要等 32 級。高效能處理器的 clock cycle 會被這段 delay 拖長，沒辦法接受。

問：一定要經過這麼多 stage 才拿得到 carry 嗎？下面的 carry lookahead adder 回答這個問題。

## Carry lookahead 的想法：把 c1 代進 c2

記號：cᵢ 是進入 bit i 的 carry；bit 0 的 carry out 就是 bit 1 的 carry in，叫 c1，是同一個東西。（另一種寫法把 bit 0 的 carry out 叫 C0；這裡一律用 c1。）

只看最低的兩個 bit：

```
c1 = b0·c0 + a0·c0 + a0·b0
c2 = b1·c1 + a1·c1 + a1·b1
```

單看式子其實很快：它是 **sum of products**，所有 AND 同時做，再一個 OR，只要兩級 gate（**two-level**）。問題是 c2 用到 c1，c1 要等 bit 0 算完才有，這就是 ripple carry 的 delay。

解法是**用空間換時間**：既然 c1 有式子，就把它直接代進 c2。

```
c2 = (a1 + b1)·c1 + a1·b1
   = (a1 + b1)·(a0·b0 + a0·c0 + b0·c0) + a1·b1
   = a1·a0·b0 + a1·a0·c0 + a1·b0·c0
   + b1·a0·b0 + b1·a0·c0 + b1·b0·c0
   + a1·b1
```

展開後 c2 有七項，還是 sum of products，而且只用到 a0、b0、a1、b1、c0：一開始就有的值，不必等誰。代價是 gate 變多：六個三輸入 AND 加一個兩輸入 AND，再一個七輸入 OR，就是用 hardware 換時間。

> **比喻** 「我不等你了，大家一起做」：這就是 carry lookahead adder 的基本概念。

## Generate 與 Propagate

一直代換式子太笨，換個角度看結構：每個 bit 在什麼情況下會有 carry out？每個 bit 定義兩個量，名字不是亂取的：

- **generate term gᵢ**（產生）：這個 bit 自己就能產生 carry，不靠別人。條件是 aᵢ、bᵢ 都是 1：1 + 1 已經是 10，不管 carry in 是什麼，一定進位。所以 **gᵢ = aᵢ · bᵢ**。這個最簡單也最重要，懂了它後面都會。
- **propagate term pᵢ**（傳遞）：carry in 是 1，carry out 就是 1；carry in 是 0，carry out 就是 0，把進來的 carry 原封不動傳出去。條件是 aᵢ、bᵢ 剛好一個是 1：carry in = 1 時加起來 10，有進位；carry in = 0 時加起來 1，沒進位。所以 **pᵢ = aᵢ ⊕ bᵢ**。

| aᵢ | bᵢ | gᵢ = aᵢbᵢ | pᵢ = aᵢ ⊕ bᵢ | pᵢ = aᵢ + bᵢ | carry out |
|---|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 0 | 0（kill） |
| 0 | 1 | 0 | 1 | 1 | = carry in |
| 1 | 0 | 0 | 1 | 1 | = carry in |
| 1 | 1 | 1 | 0 | 1 | 1 |

另一種寫法用 OR 定義 propagate：**pᵢ = aᵢ + bᵢ**。

> **陷阱** pᵢ 用 XOR 或 OR 算出的 carry 都一樣：兩者只在 aᵢ = bᵢ = 1 時不同，而那時 gᵢ = 1 已經保證進位。

每個 bit 的 gᵢ、pᵢ 只用到自己的 aᵢ、bᵢ，輸入一進來馬上就算得出來。

## Carry 方程式：c1、c2、c3、c4

**c1**：bit 0 什麼時候有 carry out？只有兩種：自己 generate，或把進來的 c0 propagate 出去。

`c1 = g0 + p0·c0`

**c2**：一個條件一個條件來。

1. bit 1 自己 generate：g1。
2. bit 1 不 generate，但 bit 0 generate，bit 1 幫它傳：p1·g0。
3. 兩個都不 generate，c0 進來，兩位都要傳：p1·p0·c0。

`c2 = g1 + p1·g0 + p1·p0·c0`

**規律**：某一位 generate，而它左邊（更高位）的每一位都幫忙 propagate。所有 carry 都能這樣寫：

```
c1 = g0 + p0·c0
c2 = g1 + p1·g0 + p1·p0·c0
c3 = g2 + p2·g1 + p2·p1·g0 + p2·p1·p0·c0
c4 = g3 + p3·g2 + p3·p2·g1 + p3·p2·p1·g0 + p3·p2·p1·p0·c0
```

c4 逐項讀：g3（bit 3 自己 generate）；或 g2 配 p3；或 g1 配 p2、p3；或 g0 配 p1、p2、p3；或 c0 配四個 p 全部 propagate。

寫得再複雜，每一項都是一個 AND（product），最後全部 OR，還是 sum of products、兩級 gate。理論上 c16 也能這樣寫出來，一樣是 two-level。

### 例題（示意）：用 p、g 算 1011 + 0110

a = 1011、b = 0110、c0 = 0（p 用 XOR）：

| bit | aᵢ | bᵢ | gᵢ | pᵢ |
|---|---|---|---|---|
| 3 | 1 | 0 | 0 | 1 |
| 2 | 0 | 1 | 0 | 1 |
| 1 | 1 | 1 | 1 | 0 |
| 0 | 1 | 0 | 0 | 1 |

```
c1 = g0 + p0·c0                     = 0 + 1·0             = 0
c2 = g1 + p1·g0 + p1·p0·c0          = 1 + …               = 1
c3 = g2 + p2·g1 + p2·p1·g0 + …      = 0 + 1·1 + …         = 1
c4 = g3 + p3·g2 + p3·p2·g1 + …      = 0 + 1·0 + 1·1·1 + … = 1
```

sum（XOR 版的 p 可直接用 sᵢ = pᵢ ⊕ cᵢ）：s0 = 1⊕0 = 1，s1 = 0⊕0 = 0，s2 = 1⊕1 = 0，s3 = 1⊕1 = 0 → 結果 1 0001 = 17 = 11 + 6，與逐位 ripple 相加相同。

## 水管比喻與平行電路

> **比喻** 把每一位想成一節水管，出口有沒有水，代表那裡有沒有 carry。
> generate：這一節自己有水龍頭，直接灌水，當然有水。
> propagate：自己沒水，但閥門開著（p = 1），能讓上游 c0 的水流過來。
> c2 也一樣：bit 1 自己出水；或 bit 0 出水、bit 1 閥門開；或 c0 的水穿過兩個打開的閥門。

實際電路：

```
a3 b3   a2 b2   a1 b1   a0 b0
 │ │     │ │     │ │     │ │
[p,g]   [p,g]   [p,g]   [p,g]     ← 1 個 gate 時間：pᵢ = XOR、gᵢ = AND，四位同時算
   \       \      /       /
    ┌────────────────────┐
    │ carry lookahead 邏輯 │ ◄── c0  ← two-level（AND 再 OR）
    └────────────────────┘
      │     │     │     │
      c4    c3    c2    c1        ← 同時算出，誰都不用等誰
```

每個 bit 都直接拿到自己的 aᵢ、bᵢ，pᵢ、gᵢ 同時算好直接送過去，c1 到 c4 才能一起算出來。這就是用硬體換速度。

## 問題：bit 一多，gate 的 input 太多（fan-in）

看 c4 最後一項：c0 AND p0、p1、p2、p3，已經是 5 個 input 的 AND。到第 16 個 bit，最後那項要 16 個 p 再加 c0，全部 AND 在一起。雖然還是 two-level，但 AND 和 OR 都太大。

第 n 個 carry 的式子有 n + 1 項，最長的 AND 有 n + 1 個 input：

| carry | 項數（OR 的 input 數） | 最長 AND 的 input 數 |
|---|---|---|
| c1 | 2 | 2 |
| c2 | 3 | 3 |
| c4 | 5 | 5 |
| c8 | 9 | 9 |
| c16 | 17 | 17 |
| c32 | 33 | 33 |

一個 gate 能接的 input 數叫 **fan-in**。真實的 gate 不可能有這麼多 input；就算做得出來，delay 也更大。所以理論可行、實際太大，不能直接做 32 bits 的 carry lookahead，要改進。改進有兩種：**cascaded（串接式）** 與 **multiple-level（多層）**。

## Cascaded carry lookahead adder

項數太多就切開：32 bits 切四塊，每塊 8 bits，塊內用 carry lookahead，式子最長只到 c8 那麼大（不必寫到 c32）。第一塊做完產生 C8，交給下一塊。

```
 bits 31..24     bits 23..16     bits 15..8      bits 7..0
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ 8-bit CLA│◄C24┤ 8-bit CLA│◄C16┤ 8-bit CLA│◄C8─┤ 8-bit CLA│◄─ C0
└──────────┘    └──────────┘    └──────────┘    └──────────┘
   stage 4         stage 3         stage 2         stage 1
```

一個 lookahead 單位拿到 c in，很快就產生 g、p 和它的 carry out；第一個 stage 的 8 個 bit 很快算出 carry out，接著第二、第三、第四個 stage。整體看起來像 ripple，只是一級是一整塊，一共 **4 個 stage 的 delay**。比 16 或 32 個 stage 好太多，而且每個 stage 裡面都很快。

## Multiple-level carry lookahead adder：區塊的大 P、大 G

cascaded 還是嫌慢：delay 仍跟 n 成正比。目標是 32 bits 只要 log n 的 delay。

cascaded 的問題出在 C8、C16、C24 來得太慢，要等前一塊做完，跟 ripple 很像。如果能先用別的方法拿到這些塊的 carry，各塊就能同時算，不用等。

做法：一樣切塊，但**把每一塊當成一個大 bit**，概念一模一樣。以 8 bits 一塊來說：

- 什麼時候有 C8？這塊自己 generate，或這塊 propagate 傳進來的 C0。
- C16 呢？第 1 塊 generate；或第 0 塊 generate、第 1 塊傳；或 C0 進來、兩塊都傳。

只要定義好「一塊的 generate」和「一塊的 propagate」：

- **大 P（block propagate）**：塊裡每個 bit 都 propagate，整塊才算 propagate，所以 P 是所有小 p 的 AND。
- **大 G（block generate）**：塊裡某一位 generate，而它上面每一位都 propagate，整塊就 generate。

以 4 bits 一塊（第 0 塊 = bit 0～3）為例：

```
P0 = p3·p2·p1·p0
G0 = g3 + p3·g2 + p3·p2·g1 + p3·p2·p1·g0
```

### 結構：16 bits = 4 塊 × 4 bits（two-level）

1. 每塊先算自己的大 P、大 G。
2. 第二層 carry lookahead 把每塊當一個 bit，同時算出各塊的 carry in：

```
c4  = G0 + P0·c0
c8  = G1 + P1·G0 + P1·P0·c0
c12 = G2 + P2·G1 + P2·P1·G0 + P2·P1·P0·c0
c16 = G3 + P3·G2 + P3·P2·G1 + P3·P2·P1·G0 + P3·P2·P1·P0·c0
```

3. 各塊拿到自己的 carry in，塊內再用 lookahead 同時算。

```
               ┌──────────── 第二層 CLA ────────────┐
               │  c4、c8、c12、c16 同時算出          │ ◄── c0
               └──▲──────▲──────▲──────▲──────────┘
             P3,G3│ P2,G2│ P1,G1│ P0,G0│     （p、g 往上送）
               ┌──┴─┐ ┌──┴─┐ ┌──┴─┐ ┌──┴─┐
               │塊 3│ │塊 2│ │塊 1│ │塊 0│     （carry in 再往下送）
               └────┘ └────┘ └────┘ └────┘
```

如果是 64 bits，就再往上加一層（4 bits 一塊 → 4 塊一組 → 再 4 組），結構像一棵 **tree**。

### Delay：log n

p、g 先一路往上傳，算出 carry 再一路往下，tree 的高度就是 log n。bit 數越大越划算：最多 log n 的 delay，是這幾種加法器裡最快的。

### 例題（示意）：16-bit multi-level carry lookahead

a = 0011 1010 0110 1101，b = 0001 0101 1100 0110，c0 = 0。

| 塊 | a | b | g（bit 3..0） | p（bit 3..0） | 大 P | 大 G |
|---|---|---|---|---|---|---|
| 3（bit 15..12） | 0011 | 0001 | 0001 | 0010 | 0 | 0 |
| 2（bit 11..8） | 1010 | 0101 | 0000 | 1111 | 1 | 0 |
| 1（bit 7..4） | 0110 | 1100 | 0100 | 1010 | 0 | 1 |
| 0（bit 3..0） | 1101 | 0110 | 0100 | 1011 | 0 | 1 |

- 塊 0：g2 = 1 且 p3 = 1 → G0 = p3·g2 = 1；p 有 0 → P0 = 0。
- 塊 1：同樣是局部 bit 2 generate、bit 3 propagate → G1 = 1，P1 = 0。
- 塊 2：四位全部 propagate → P2 = 1；沒有任何 g → G2 = 0。
- 塊 3：g0 = 1，但 p2 = p3 = 0 擋住，傳不到塊外 → G3 = 0；P3 = 0。

第二層：

```
c4  = G0 + P0·c0                 = 1
c8  = G1 + P1·G0 + P1·P0·c0      = 1
c12 = G2 + P2·G1 + …             = 0 + 1·1 = 1   （塊 2 整塊把塊 1 的 carry 傳過去）
c16 = G3 + P3·G2 + P3·P2·G1 + …  = 0 + 0 + 0·… = 0
```

各塊拿到 carry in 後同時算：

```
塊 0：1101 + 0110 + 0 = 1 0011 → 0011
塊 1：0110 + 1100 + 1 = 1 0011 → 0011
塊 2：1010 + 0101 + 1 = 1 0000 → 0000
塊 3：0011 + 0001 + 1 = 0 0101 → 0101
結果：0101 0000 0011 0011（c16 = 0）
```

驗算：0x3A6D + 0x15C6 = 14957 + 5574 = 20531 = 0x5033，正確；每塊的 carry out 也和第二層算出的 c4、c8、c12、c16 一致。

## Carry select adder

2n bits 的 ripple carry adder，carry 從頭傳到尾，delay 大約 2n。從中間切一半：進到上半部的 carry 有幾種可能？carry 只有一個 bit，所以只有兩種：0 或 1。

那就把上半部做兩份：一份假設 carry = 0，一份假設 carry = 1，兩種都先算。三個 n-bit 加法器同時算，delay 從 2n 變成大約 n。下半部算完就知道真正的 carry，用一個 2-to-1 MUX 挑對的那份。

```
 上半部 a,b ──► [n-bit adder, cin=0] ──► 0 ┐
 上半部 a,b ──► [n-bit adder, cin=1] ──► 1 ├─ MUX ──► 上半部 sum
                                            │ ▲
 下半部 a,b ──► [n-bit adder, cin=c0] ──────┼─┘ carry out 當 select
                         └──► 下半部 sum
```

切越多段，要複製的硬體越多，但速度越快。

### 例題（示意）：8 bits，1011 0110 + 0101 1100

```
下半部：0110 + 1100       = 1 0010   → sum 0010，carry = 1
上半部（假設 c=0）：1011 + 0101     = 1 0000
上半部（假設 c=1）：1011 + 0101 + 1 = 1 0001
MUX 依下半部 carry = 1，選 c=1 那份 → 上半部 0001，carry out 1
結果：1 0001 0010
```

驗算：182 + 92 = 274 = 256 + 16 + 2，正確。

## SIMD 分割加法器與 saturation

多媒體應用很多，加法器還有一些變形。多媒體資料像 pixel 只有 8 bits 或 16 bits，不需要拿 32 位元去算。所以把 64-bit 加法器 **partition（分割）** 成 8 個 8-bit，或 4 個 16-bit：**在分割處把 carry 切斷**。一個指令同時對很多筆資料做加法，叫 **SIMD（single instruction, multiple data）**。

### 例題（示意）：16-bit 加法器切成兩個 8-bit

```
           高 8 位       低 8 位
  a      0000 0001 │ 1111 1111
+ b      0000 0010 │ 0000 0001
---------------------------------
分割（carry 切斷）  0000 0011 │ 0000 0000   兩筆獨立的 8-bit 結果
不分割（16-bit）    0000 0100 │ 0000 0000   低位 carry 跑進高位，高位那筆就錯了
```

### Saturation（飽和運算）

結果超出範圍時，除了 overflow、truncation、rounding 以外，多媒體常用 **saturation**：overflow 就直接取能表示的最大值，也不用通知誰。

為什麼？pixel 的數字代表顏色深淺，數字越大越黑（或越亮）。8 bits 最大 255，算出 257、258 也沒意義，就用最深的那個值。

```
  1100 1000   (200)
+ 0110 0100   (100)
-------------
1 0010 1100   (300)

一般加法（wrap around）：丟掉第 9 位 → 0010 1100 = 44
saturation：            停在最大值   → 1111 1111 = 255
```

主要用在 audio、video：聲音和畫面能表達的範圍有限，超過就停在最大。

## 加法器總整理

| 加法器 | 做法 | 硬體 | carry delay |
|---|---|---|---|
| Ripple carry | 1-bit full adder 串接，carry 一級一級傳 | 最少 | 與 n 成正比（每位 2 gate delay） |
| Carry lookahead（單層） | 把式子攤平（**flatten**），每個 carry 各算各的，two-level | 多；c31 的 OR 項大到不能直接做（fan-in） | 理論上固定兩級 |
| Cascaded CLA | 切塊，塊內 lookahead，塊與塊之間 ripple | 中 | 與塊數成正比（32 bits 切 4 塊 → 4 stage） |
| Multiple-level CLA | 塊的大 P、大 G 再做一層 lookahead，carry 先往上再往下 | 多 | depth log n，最快 |
| Carry select | 上半部 carry=0、1 兩份都先算，MUX 選 | 上半部複製一份 | 2n → 約 n |

> **重點** carry lookahead 系列的核心都是「用空間換時間」：多花 gate，讓 carry 不必一級一級等。

## MIPS 的乘法指令：mult、Hi、Lo

整台電腦的 organization：CPU 外面是 memory；CPU 裡有前面做好的 ALU、32 個 general purpose register 組成的 register file，還有做 floating point 的 coprocessor。這一段的主角是旁邊另一塊：**乘法／除法硬體（multiply／divide unit）**。

它多了兩個特別的 register：**Hi** 和 **Lo**，各 32 bits，**不屬於**那 32 個一般 register。

乘法指令只給兩個來源 register，沒寫結果放哪：

```asm
mult $t1, $t2      # $t1 × $t2，64-bit 結果：高 32 bits → Hi，低 32 bits → Lo
mfhi $t3           # move from high：Hi → $t3
mflo $t4           # move from low ：Lo → $t4
```

問：為什麼 `mult` 不寫 destination？
答：32 bits 乘 32 bits，結果最多 64 bits，沒有一個一般 register 放得下（像十萬乘三十萬就超過 32 bits）。所以結果固定放在 Hi（高 32 bits）、Lo（低 32 bits），乘法分兩步：先乘，再用 `mfhi`／`mflo` 把需要的部分搬出來。

- 只想要 32 bits 的結果時，Hi 那 32 bits 其實就是 overflow 的部分，看需不需要。
- 另一種寫法 `mul rd, rs, rt`：有給 destination，直接把**低 32 bits** 放進 `rd`。
- `mult rs, rt`：結果自動放 Hi、Lo，要哪一半再用 `mflo` 或 `mfhi` 搬。
- unsigned 乘法用 `multu`（後面的硬體先講的就是 unsigned 乘法）。

```asm
mul  $t0, $s1, $s2   # $t0 = ($s1 × $s2) 的低 32 bits
```

> **陷阱** 一般 register 只有 32 bits，`mult` 的 64-bit 結果在 Hi、Lo，要用 `mfhi`／`mflo` 才拿得到；`mult` 本身不會改到任何一般 register。

## 紙筆乘法：看乘數的每一個 bit

乘法器跟加法器一樣，是一個專門幫我們乘的硬體零件。第一版硬體就是把紙筆算法直接搬上硬體，所以先複習紙筆怎麼乘。分兩部分：**unsigned**（當正數乘）與 **signed**（two's complement 表示的數相乘）。

- 上面的數叫 **multiplicand（被乘數）**，下面的叫 **multiplier（乘數）**。
- 二進位乘數每一位只有 0 或 1：是 1 就抄一次被乘數，是 0 就寫 0000。
- 每往下一個 iteration，被乘數就往左 shift 一位（紙上往左錯開一格）。

### 例題：1000 × 1001（8 × 9）

```
          1000      multiplicand (8)
      ×   1001      multiplier   (9)
      --------
          1000      乘數 bit0 = 1 → 抄被乘數
         0000       乘數 bit1 = 0 → 0（左移一格）
        0000        乘數 bit2 = 0 → 0（左移兩格）
     + 1000         乘數 bit3 = 1 → 抄被乘數（左移三格）
     ---------
       1001000      = 72
```

硬體不會最後一次全加，而是每一輪把新的一列加進目前的和；這個暫時的和叫 **partial product（部分積）**。

流程：看乘數這一位 → 是 1 就把「移好位置的被乘數」加進 partial product，是 0 不動 → 被乘數左移 → 換乘數下一位。

## 第一版乘法器

把紙筆做法直接變成硬體（以 32 bits 為例）：

| 元件 | 大小 | 動作 |
|---|---|---|
| Multiplicand register | 64 bits（被乘數起初放在**右半**） | 每輪左移 1 位 |
| ALU（加法器） | 64 bits | Product + Multiplicand |
| Product register | 64 bits（起初全 0） | 寫回 partial product |
| Multiplier register | 32 bits | 每輪右移 1 位，看最右邊那位（Multiplier0） |

```
 Multiplicand (64) ── shift left ─┐
                                  ▼
                           64-bit ALU ◄── Product (64)
                                  │           ▲
                                  └── write ──┘
 Multiplier (32) ── shift right，最右位 → Control（決定這輪加不加）
```

演算法（每個 iteration 三步，32 bits 做 32 次）：

1. 若 Multiplier0 = 1：Product = Product + Multiplicand。
2. Multiplicand 左移 1 位。
3. Multiplier 右移 1 位（把下一位移到最右邊）。

### 例題：0010 × 0011（2 × 3）

例子用 4 bits，所以 64-bit 的 register 畫成 8 bits。Multiplicand 0010 放在 8-bit register 最右邊。

| Iteration | 步驟 | Multiplier | Multiplicand | Product |
|---|---|---|---|---|
| 0 | 初始值 | 0011 | 0000 0010 | 0000 0000 |
| 1 | Multiplier0 = 1 → Product += Mcand | 0011 | 0000 0010 | 0000 0010 |
| 1 | Multiplicand 左移 | 0011 | 0000 0100 | 0000 0010 |
| 1 | Multiplier 右移 | 0001 | 0000 0100 | 0000 0010 |
| 2 | Multiplier0 = 1 → Product += Mcand | 0001 | 0000 0100 | 0000 0110 |
| 2 | Multiplicand 左移 | 0001 | 0000 1000 | 0000 0110 |
| 2 | Multiplier 右移 | 0000 | 0000 1000 | 0000 0110 |
| 3 | Multiplier0 = 0 → 不加 | 0000 | 0000 1000 | 0000 0110 |
| 3 | Multiplicand 左移 | 0000 | 0001 0000 | 0000 0110 |
| 3 | Multiplier 右移 | 0000 | 0001 0000 | 0000 0110 |
| 4 | Multiplier0 = 0 → 不加 | 0000 | 0001 0000 | 0000 0110 |
| 4 | Multiplicand 左移 | 0000 | 0010 0000 | 0000 0110 |
| 4 | Multiplier 右移 | 0000 | 0010 0000 | 0000 0110 |

結果 Product = 0000 0110 = 6。

> **陷阱** 乘數 bit 是 0 的那一輪不做加法，但兩個 shift **還是要做**，下一輪的位置才對得上。

## 第一版的浪費

第一版是紙筆算法的直接翻譯，有幾個地方可以改：

- 每個 iteration 都要做一次 **64-bit 加法**。加幾次取決於乘數有幾個 1（0 不用加，1 要加），所以一次乘法相當於很多次加法；乘法與加法的時間比大約 5:1 到 100:1，看設計而定。
- **Multiplicand register 一半永遠是 0**：64 bits 裡真正有效的只有 32 bits（例子裡 4 bits），有效的那幾位一路往左跑，左右兩邊永遠是 0。
- 更重要的一點：multiplicand 左移時右邊補 0，所以加進去之後，**Product 最右邊已經加完的 bits 之後不會再變**。用上面的表驗證：第 2 輪加的是 0000 0100，Product 的 bit 0 不再變；越往後，不變的低位越多。紙筆算也一樣：第二列加進來時最右邊那位不變，後面每加一列，不變的位就多一位。

既然低位不會再變、高位又都是 0，就不需要 64-bit 的加法器。

## 改良版乘法器：multiplicand 不動，改把 Product 右移

想法：與其把 multiplicand 往左移，不如把 partial product 往右移。multiplicand 不動，但還是要加到 partial product 的正確位置，就讓 partial product 右移去對準它。

> **比喻** 紙筆算是「被乘數往左走」；改良版是「被乘數站著不動，紙往右拉」。兩者的**相對位置**一模一樣。

以 0010 × 0011 想像：把 multiplicand 加進去的位置畫成一個固定的框框。

- 第一次加在框框裡。
- 第二次本來要加在左邊一位；現在框框不動，等於 partial product 先右移一位再加。
- 第三次要加在更左邊，就相當於 partial product 右移兩位。

好處：

1. **Multiplicand 只要 32 bits**：它根本不動。
2. **ALU 只要 32 bits**：右邊不再變的 bits 直接留在 Product 裡，左邊也不用算，只有左半要加。
3. **Multiplier 不用自己的 register**：partial product 一開始只需要 32 bits（加在 Product 左半），每一輪右移一位、多用一個 bit；所以一開始 Product 右半有 32 bits 空著，正好放 multiplier。multiplier 也是右移、每次看最右位，用掉一個就移出去，剛好空出位置給 partial product 往右長。兩者共用同一個 register，shift 時一起移。

| 元件 | 第一版 | 改良版 |
|---|---|---|
| Multiplicand | 64 bits，左移 | 32 bits，不動 |
| ALU | 64 bits | 32 bits（只加 Product 左半） |
| Product | 64 bits | 64 bits，右移；右半起初放 multiplier |
| Multiplier | 獨立 32-bit register，右移 | 併入 Product 右半 |

演算法（每輪）：

1. 若 Product0（Product 最右位，即目前的乘數位）= 1：Product 左半 = 左半 + Multiplicand。
2. Product 右移 1 位。

> **陷阱** multiplicand 不動時，是 Product **往右**移（不是往左）——相對位置跟紙筆算一樣。

### 例題：0010 × 0011（改良版）

Multiplicand = 0010（4 bits，不動）；Product 8 bits，右半先放 multiplier 0011。

| Iteration | 步驟 | Multiplicand | Product（左半 右半） |
|---|---|---|---|
| 0 | 初始值 | 0010 | 0000 0011 |
| 1 | Product0 = 1 → 左半 + 0010 | 0010 | 0010 0011 |
| 1 | Product 右移 | 0010 | 0001 0001 |
| 2 | Product0 = 1 → 左半 0001 + 0010 = 0011 | 0010 | 0011 0001 |
| 2 | Product 右移 | 0010 | 0001 1000 |
| 3 | Product0 = 0 → 不加 | 0010 | 0001 1000 |
| 3 | Product 右移 | 0010 | 0000 1100 |
| 4 | Product0 = 0 → 不加 | 0010 | 0000 1100 |
| 4 | Product 右移 | 0010 | 0000 0110 |

結果 0000 0110 = 6。每次右移，剛用掉的乘數位被移出去；移到右邊的 partial product bits 之後不會再變。最後 64-bit 結果的高 32 bits 進 Hi、低 32 bits 進 Lo。這是 unsigned 乘法（指令 `multu`）。

補充：做 unsigned 加法時左半可能產生進位，右移時這個 carry out 會移進 Product 最左邊那一位，不會遺失。

## 有號乘法

### 方法一：先當 unsigned 乘，再補正負號

1. 把兩個數都變成正的，用 unsigned 乘法器乘。例：−3 × 2，先算 3 × 2 = 6。
2. 正負看兩個 sign bit（最左邊那位，0 正、1 負）：兩個 0 是正，兩個 1 也是正，一 0 一 1 是負——也就是兩個 sign bit 做 **XOR**。
3. 結果該是負的，就把乘出來的結果取 two's complement：6 → −6。

### 方法二：直接用 two's complement 乘

不拿掉 sign，直接乘。有兩條規則：

- **規則一**：multiplicand 加進 partial product 前要做 **sign extension（符號延伸）**：延長位數時正數前面補 0、負數補 1，值才不變。
- **規則二**：乘數的 **sign bit**（最後一個 iteration）是 1 時，要**減掉** multiplicand（左移到該位置），不是加。

再進一步，可以用 **Booth's algorithm** 加速有號乘法（下一節）。

### 例題：(−7) × (−7)

−7 的 4-bit two's complement 是 1001。partial product 是 8 bits，所以 multiplicand 1001 要 sign extend 成 1111 1001。

| 乘數位 | 值 | 動作 | 加／減的數（8 bits） | partial product |
|---|---|---|---|---|
| — | — | 初始值 | — | 0000 0000 |
| b0 | 1 | 加 multiplicand | 1111 1001 | 1111 1001 |
| b1 | 0 | 加 0 | 0000 0000 | 1111 1001 |
| b2 | 0 | 加 0 | 0000 0000 | 1111 1001 |
| b3（sign bit） | 1 | **減** multiplicand 左移 3 位 | 1100 1000 | 0011 0001 |

```
   1111 1001      (−7)
 − 1100 1000      (−7 × 8 = −56)
 -----------
   0011 0001      = 49
```

(−7) × (−7) = 49，正確。

> **陷阱** 最後一個 bit 是 sign bit，代表 −2³，所以那一輪是「減」multiplicand（左移 3 位），不是加。

### 為什麼最後一位要減

把乘法寫成 A × B，A 是 multiplicand，B 是 multiplier。乘的意思是：B 的每一個 bit 分別乘 A，錯開位置再加起來。

- unsigned 的 B：`B = b₃·2³ + b₂·2² + b₁·2¹ + b₀·2⁰`
- two's complement 的 sign bit 代表 **−2ⁿ⁻¹**（4 bits 是 −8）：`B = −b₃·2³ + b₂·2² + b₁·2¹ + b₀·2⁰`
  - sign bit 是 0，這項就沒了；是 1 就要減 8。例：1001 = −8 + 1 = −7。

所以 `A × B = −b₃·(A·2³) + b₂·(A·2²) + b₁·(A·2¹) + b₀·(A·2⁰)`：前三項照常加，乘到 sign bit 那項就是 A × (−8)，也就是**減掉 A 左移 3 位**。

> **觀念** 這跟邏輯設計學的「取 two's complement = 反相加 1」是同一件事；代數上，就是把 2ⁿ⁻¹ 那一項從加改成減。

## Booth's algorithm（Booth 乘法）

### 想法：一串 1 只要一減一加

乘數有很多個 1 時，每碰到一個 1 就要加一次。例如乘數 0011 1110 有五個 1，要加五次。但它可以寫成兩數相減：

```
  0011 1110  =  0100 0000  −  0000 0010
     62      =     64      −      2
```

所以 A × 0011 1110 = A × 64 − A × 2：原本五次加法，現在只剩兩個位置要做事：低位那裡做一次**減**、高位那裡做一次**加**。

減和加對 ALU 一樣快（減法就是 b 取 complement 再加），所以五次運算變兩次，就快了。

關鍵是**連續的 1**：在一串 1 的起點做減，在這串 1 結束後的下一位做加，結果一模一樣。不必先把乘數化簡，從右邊往左掃過去，邊看邊決定：

- 碰到這串的第一個 1 → 做減。
- 中間的 1 → 不做事。
- 這串 1 結束、下一位是 0 → 做加。

用 0011 1110 走一遍：bit 1 是第一個 1（減 A·2¹）；bit 2～5 在 1 的中間（不動）；bit 6 是 1 結束後的 0（加 A·2⁶）。正好就是 A·64 − A·2。

### 規則：看目前這位和右邊那位

怎麼知道自己是第一個 1，還是這串 1 已經結束？要看左右：同時看兩個 bit——**目前這位（current bit）** 和**它右邊那一位**。

| current bit | 右邊那位 | 意義 | 動作 |
|---|---|---|---|
| 1 | 0 | 一串 1 的開始（beginning of run） | 減 multiplicand |
| 1 | 1 | 一串 1 的中間（middle of run） | 不動 |
| 0 | 1 | 一串 1 的結束（end of run） | 加 multiplicand |
| 0 | 0 | 一串 0 的中間 | 不動 |

- 為了偵測這件事，除了 Product 最右位，還要多一個 **1-bit register** 記住「右邊那一位」（上一輪被移出去的乘數位），一開始是 0。
- 每輪做完加／減，一樣要右移。Booth 是 signed 乘法，右移時要做 sign extension：左邊補 sign bit，叫 **算術右移（arithmetic shift right）**。
- 減 multiplicand 就是加它的 two's complement。
- Booth 只是讓加法次數變少、速度變快，乘出來的結果完全一樣。

> **陷阱** Booth 的 pair 是（目前的 bit, 右邊的 bit）：10 是一串 1 的開始 → 減；01 是結束 → 加。順序看反就全錯。

> **陷阱** Booth 每一輪的右移是算術右移，左邊補 sign bit，不是補 0。

### 例題：2 × 7

用改良版乘法器：multiplicand 只要 4 bits（0010，不動），Product 8 bits，乘數 0111 放在 Product 右半。−multiplicand = 1110。「右邊那位」初始為 0。

| Iteration | 步驟 | Multiplicand | Product | 右邊那位 |
|---|---|---|---|---|
| 0 | 初始值 | 0010 | 0000 0111 | 0 |
| 1 | (1,0) 開始 → 減：左半 0000 + 1110 = 1110 | 0010 | 1110 0111 | 0 |
| 1 | 算術右移（補 1） | 0010 | 1111 0011 | 1 |
| 2 | (1,1) 中間 → 不動 | 0010 | 1111 0011 | 1 |
| 2 | 算術右移 | 0010 | 1111 1001 | 1 |
| 3 | (1,1) 中間 → 不動 | 0010 | 1111 1001 | 1 |
| 3 | 算術右移 | 0010 | 1111 1100 | 1 |
| 4 | (0,1) 結束 → 加：左半 1111 + 0010 = 0001 | 0010 | 0001 1100 | 1 |
| 4 | 算術右移 | 0010 | 0000 1110 | 0 |

結果 0000 1110 = 14 = 2 × 7。三個 1 只做了一次減、一次加。

### 例題：2 × (−3)

−3 = 1101。Booth 的好處：負數也用一模一樣的做法。

| Iteration | 步驟 | Multiplicand | Product | 右邊那位 |
|---|---|---|---|---|
| 0 | 初始值 | 0010 | 0000 1101 | 0 |
| 1 | (1,0) 開始 → 減：0000 + 1110 = 1110 | 0010 | 1110 1101 | 0 |
| 1 | 算術右移 | 0010 | 1111 0110 | 1 |
| 2 | (0,1) 結束 → 加：1111 + 0010 = 0001 | 0010 | 0001 0110 | 1 |
| 2 | 算術右移 | 0010 | 0000 1011 | 0 |
| 3 | (1,0) 開始 → 減：0000 + 1110 = 1110 | 0010 | 1110 1011 | 0 |
| 3 | 算術右移 | 0010 | 1111 0101 | 1 |
| 4 | (1,1) 中間 → 不動 | 0010 | 1111 0101 | 1 |
| 4 | 算術右移 | 0010 | 1111 1010 | 1 |

結果 1111 1010 = −6 = 2 × (−3)。

> **觀念** 1 和 0 交錯出現時（像 1101 的右邊三位 101），Booth 反而動作比較多：每個 1、0 交界都要做一次加或減，這裡 4 輪做了 3 次加減，沒有省到。Booth 省的是「一長串連續的 1」。

## Sequential 與 combinational 乘法器

### Sequential multiplier

前面所有乘法器（包含 Booth）都是一輪一輪做：每次處理乘數的一位，加完 shift，存回 partial product，**下一個 cycle** 再做下一位。乘數有很多 bits 就要很多個 cycle，所以叫 **sequential multiplier（循序乘法器）**。它只需要**一個加法器**，這個 cycle 用完、下個 cycle 再用。

加法也有同樣兩種做法（邏輯設計學過）：

- **combinational**：16-bit 加法用 16 個 full adder 一起做。
- **sequential adder**：只用一個 full adder，一個 cycle 只做一位，把 carry 和 sum 存在 flip-flop，下個 cycle 做下一位；16 bits 要 16 個 iteration。

乘法同理：一位一位做、結果存回去是 sequential；全部同時加起來是 combinational。

### Combinational multiplier

能不能更快？**用空間換時間**：同一時間把每一列都做出來，一起加。

以 1000 × 1001 為例，四個 partial product 1000、0000、0000、1000，一開始就知道了嗎？可以：每個 partial product 的每一位，就是「乘數那一位 AND 被乘數那一位」，用四組 AND gate 同時產生。

```
 乘數 bit0=1 → AND 被乘數 → 1000
 乘數 bit1=0 → AND 被乘數 → 0000（位置左移 1）
 乘數 bit2=0 → AND 被乘數 → 0000（位置左移 2）
 乘數 bit3=1 → AND 被乘數 → 1000（位置左移 3）
```

四個同時有了，就一起加，不必一個 cycle 一個 cycle 加——這就是 **combinational multiplier（組合乘法器）**。

但要同時把四個加起來，就不能只有一個加法器（combinational 沒辦法 share）。最簡單的做法：

```
  PP0    PP1      PP2    PP3
    \    /          \    /
    adder1          adder2
         \          /
           adder3
             │
          Product
```

第一、二個先加，第三、四個也加，再把兩個結果相加，至少要三個加法器。一般化：所有 partial product 兩兩相加一路往下，中間沒有 flip-flop，**一個 clock cycle 做完**。

代價：加法器很多；而且從輸入到輸出的路徑很長，之後可以在中間加 **pipeline**。

| | Sequential | Combinational |
|---|---|---|
| 每個 cycle 做 | 乘數的一位 | 全部 |
| 加法器 | 一個，重複使用 | 很多個，不能共用（4 個 PP 至少 3 個） |
| 中間結果 | 存在 register（flip-flop） | 沒有 flip-flop |
| 速度 | 要很多 cycle | 一個 cycle（但路徑長） |

## Carry save adder 與 Wallace tree

combinational 乘法器是一層一層的加法結構，這個結構的**高度就是 delay**：

- 每個加法器若是 ripple carry，每一層都要等 32 位的 carry 一路傳下去，很慢。
- 用 carry lookahead 快一點，但要好多個，面積很大，代價太高。

改進：讓**每一層只有一個 full adder 的 delay**，只是要到最後一層才知道真正的結果。這種加法器叫 **carry save adder（CSA，進位保留加法器）**：carry 不加進下一位，而是**先存起來**。

- full adder 有三個 input，其實三個角色一樣，就叫 x、y、z；兩個 output：sum 和 carry。
- sum 跟 x、y、z 在**同一位**；carry 是進位，屬於**左邊高一位**的位置。
- 三個 n-bit 數相加：每一位各用一個 full adder，只加自己那一位的三個 input，不等前一位，沒有 carry propagation，所以只有**一個 full adder 的 delay**。例如某一位是 0、1、1，加起來 sum = 0、carry = 1。
- 產生的兩個 output 還是兩個數（carry 那個錯開一位），對好位置加起來，就等於原本三個數的和。**三個數變兩個數（3 → 2）**。

### 例題：三個 4-bit 數的 carry save 加法（示意）

X = 0111（7）、Y = 0101（5）、Z = 0011（3），和應為 15。

| 位 | x | y | z | sum | carry（進到左一位） |
|---|---|---|---|---|---|
| bit 3 | 0 | 0 | 0 | 0 | 0 |
| bit 2 | 1 | 1 | 0 | 0 | 1 |
| bit 1 | 1 | 0 | 1 | 0 | 1 |
| bit 0 | 1 | 1 | 1 | 1 | 1 |

```
 S =  0001           (每一位的 sum)            = 1
 C = 01110           (每一位的 carry 左移一位) = 14
 ----------
     01111           最後用一般加法器加一次     = 15
```

四個 full adder 同時做完，沒有互相等 carry。

### Wallace tree multiplier

要加更多數，就再拿三個變兩個，一直 3 → 2；再 group 一下，整個結構像一棵 tree，高度大約 log n。每一層雖然是 32 bits 相加，也只要一個 full adder 的時間。用 carry save adder 做成的這種乘法器叫 **Wallace tree multiplier**。

最後剩兩個數，但結果只能有一個，所以**最後一層要用一般加法器**，做一次 carry propagation。真正的快速乘法器就是這樣：中間每層只有一個 full adder 的 delay。

> **陷阱** carry save adder 不是「不產生 carry」，而是把 carry 存成另一個數（往左一位），不傳給下一位；最後一層仍需要一般加法器做 carry propagation。

## MIPS 的除法指令：Lo 放商，Hi 放餘數

乘跟除是一體兩面：乘法是 **shift and add**，除法就是 **shift and subtract**。所以乘除可以在同一個 component 做，也一樣用 Hi、Lo 存結果。

```asm
div  $t1, $t2      # $t1 ÷ $t2：Lo = quotient（商），Hi = remainder（餘數）
mflo $t3           # 取商
mfhi $t4           # 取餘數
divu $t1, $t2      # unsigned 除法，做法一樣
```

例：7 ÷ 2 → Lo = 3、Hi = 1。

- MIPS 硬體**不檢查 overflow**，也**不檢查除以 0**，照除不誤，結果可能是錯的；軟體要自己檢查。
- 這是 trade-off：硬體做檢查較簡單但有硬體成本，軟體做可能比較慢。

> **陷阱** 除法的 Lo 放商、Hi 放餘數；不要和乘法的 Hi（積的高 32 bits）搞混。

## 紙筆除法：夠減寫 1，不夠寫 0

**dividend（被除數）**、**divisor（除數）**、**quotient（商）**、**remainder（餘數）**。例：7 ÷ 2，即 0111 ÷ 10。

每一步把 divisor 放下面減減看：減出來 ≥ 0（夠減）商寫 1；不夠減就寫 0、不減。把下一位放下來，就相當於 divisor 往右移一位，去減下一個位置。

```
            0 0 1 1        quotient
         ┌─────────
     10  │ 0 1 1 1         dividend
            0              「0」不夠減 10 → 商 0
            0 1            「01」不夠減 10 → 商 0
            0 1 1
          −   1 0          「011」夠減 → 商 1，剩 1
            ─────
                1 1        放下最後一位
              − 1 0        「11」夠減 → 商 1，剩 1
              ─────
                  1        remainder
```

商 0011 = 3，餘數 1。

整理：每輪用 divisor 減；結果是正的（≥ 0）商寫 1；負的就恢復原狀，叫 **restore**，商寫 0。然後 divisor 右移，繼續。

## 第一版除法器

跟第一版乘法器同一個思路：

| 元件 | 大小 | 動作 |
|---|---|---|
| Divisor register | 64 bits（divisor 起初放在**左半**） | 每輪右移 1 位 |
| ALU | 64 bits | Remainder − Divisor |
| Remainder register | 64 bits（起初放 dividend） | 寫回 |
| Quotient register | 32 bits | 每輪左移 1 位，最右位放新商位 |

問：為什麼 Divisor 一開始放左邊？
答：回到紙筆算，「把下一位放下來」就是去減下一個（更低的）位置，等於 Divisor 一直往右移。所以它從最左邊開始。

演算法（每個 iteration）：

1. Remainder = Remainder − Divisor。
2. 若 Remainder ≥ 0：Quotient 左移，最右位補 1。若 Remainder < 0：restore（Remainder = Remainder + Divisor，把剛才減錯的加回去），Quotient 左移，最右位補 0。
3. Divisor 右移 1 位。

n bits 要做 **n + 1** 輪（4 bits 做 5 輪）。

### 例題：7 ÷ 2（第一版，0111 ÷ 0010）

| Iteration | 步驟 | Quotient | Divisor | Remainder |
|---|---|---|---|---|
| 0 | 初始值 | 0000 | 0010 0000 | 0000 0111 |
| 1 | Rem − Div | 0000 | 0010 0000 | 1110 0111 |
| 1 | Rem < 0 → restore，Q 左移補 0 | 0000 | 0010 0000 | 0000 0111 |
| 1 | Divisor 右移 | 0000 | 0001 0000 | 0000 0111 |
| 2 | Rem − Div | 0000 | 0001 0000 | 1111 0111 |
| 2 | Rem < 0 → restore，Q 左移補 0 | 0000 | 0001 0000 | 0000 0111 |
| 2 | Divisor 右移 | 0000 | 0000 1000 | 0000 0111 |
| 3 | Rem − Div | 0000 | 0000 1000 | 1111 1111 |
| 3 | Rem < 0 → restore，Q 左移補 0 | 0000 | 0000 1000 | 0000 0111 |
| 3 | Divisor 右移 | 0000 | 0000 0100 | 0000 0111 |
| 4 | Rem − Div | 0000 | 0000 0100 | 0000 0011 |
| 4 | Rem ≥ 0 → Q 左移補 1 | 0001 | 0000 0100 | 0000 0011 |
| 4 | Divisor 右移 | 0001 | 0000 0010 | 0000 0011 |
| 5 | Rem − Div | 0001 | 0000 0010 | 0000 0001 |
| 5 | Rem ≥ 0 → Q 左移補 1 | 0011 | 0000 0010 | 0000 0001 |
| 5 | Divisor 右移 | 0011 | 0000 0001 | 0000 0001 |

商 0011 = 3，餘數 0001 = 1。

> **陷阱** 第一版除法器 n bits 要做 n + 1 輪：Divisor 一開始在最左邊，第一輪一定不夠減。

## 改良版除法器：Divisor 不動，Remainder 往左移

第一版的浪費跟乘法器一樣：

- Divisor 從最左邊一路右移，64 bits 裡真正有用的只有 32 bits，前後都是 0。
- 減的時候也只減中間那一塊，64-bit 減法很浪費。

改進（與乘法器對稱）：

- **Divisor 變 32 bits、不動**；它原本往右，那就換 **Remainder 往左**移。這樣只要 **32-bit 的 ALU**（只用 Remainder 左半去減）。
- Remainder 每左移一位，右邊空出一格；商也是每次產生一位、往左長，剛好放進那一格——**商和餘數兩個 register 合併**成一個 64-bit Remainder register。
- 第一個商位如果是 1，一定超過 32 bits（overflow），反正不要，所以**一開始先 shift，省一輪**。

（第一版和這個版本之間還有一個過渡版本，效率較差，這裡直接用最快的版本。）

新的除法硬體：Divisor 32 bits、ALU 32 bits、Remainder 64 bits（每輪左移，空出的位置放商）。

### 演算法

1. 被除數 dividend 放進 Remainder register（右半）；**先左移一位**。
2. 重複 n 次（32 bits 做 32 輪；例子 4 bits 做 4 次）：
   - Remainder 左半 − Divisor，結果寫回左半。
   - 若結果 ≥ 0（夠減）：Remainder 左移，右邊空出的位置放 **1**。
   - 若結果 < 0（不夠減）：先 **restore**（把 Divisor 加回左半），再左移，新的位置放 **0**。
3. 最後：因為一開始多左移了一次，要把**左半右移一位**補回來，才是正確的餘數。右半是商，不動。

商放 0 還是 1？減出來正的放 1；負的放 0，而且放 0 之前別忘了先 restore。

> **陷阱** 最後一步只把 Remainder 的「左半」右移一位；右半是商，不動。

### 例題：7 ÷ 2（改良版）

Divisor = 0010；Remainder 8 bits，被除數 7 放右邊：0000 0111。

| Iteration | 步驟 | Divisor | Remainder（左半 右半） |
|---|---|---|---|
| 0 | 初始值 | 0010 | 0000 0111 |
| 0 | 先左移 1 位 | 0010 | 0000 1110 |
| 1 | 左半 − Div：0000 − 0010 = 1110 | 0010 | 1110 1110 |
| 1 | < 0 → restore | 0010 | 0000 1110 |
| 1 | 左移，補 0 | 0010 | 0001 1100 |
| 2 | 左半 − Div：0001 − 0010 = 1111 | 0010 | 1111 1100 |
| 2 | < 0 → restore | 0010 | 0001 1100 |
| 2 | 左移，補 0 | 0010 | 0011 1000 |
| 3 | 左半 − Div：0011 − 0010 = 0001 | 0010 | 0001 1000 |
| 3 | ≥ 0 → 左移，補 1 | 0010 | 0011 0001 |
| 4 | 左半 − Div：0011 − 0010 = 0001 | 0010 | 0001 0001 |
| 4 | ≥ 0 → 左移，補 1 | 0010 | 0010 0011 |
| 結束 | 左半右移 1 位 | 0010 | 0001 0011 |

左半 0001 = 餘數 1（→ Hi），右半 0011 = 商 3（→ Lo）。

## 有號除法：餘數跟被除數同號

一樣先取絕對值當 unsigned 除，除完再補正負號。規則：

- **規則一**：餘數一定跟**被除數**同號。
- **規則二**：商的正負看除數和被除數：同號為正，異號為負。

| 題目 | unsigned 結果 | 商 | 餘數 | 驗算 商 × 除數 + 餘數 |
|---|---|---|---|---|
| (−7) ÷ 2 | 3 餘 1 | −3（異號） | −1（同被除數） | (−3)(2) + (−1) = −7 |
| (−7) ÷ (−2) | 3 餘 1 | 3（同號） | −1（同被除數） | (3)(−2) + (−1) = −7 |

問：為什麼這樣定？
答：不管正負怎麼給，都要滿足 **quotient × divisor + remainder = dividend**；照這兩條規則，這個式子一定成立。

> **陷阱** 餘數的正負跟**被除數**，不是跟除數：(−7) ÷ (−2) 的餘數是 −1，不是 +1。

商也可能太大而 overflow，但 MIPS 不檢查 overflow，也不檢查除以 0，照除就對了，檢查交給軟體。

## 乘法器和除法器共用一套硬體

乘法器跟除法器雖然分開講，其實可以合在一起：MIPS 的 multiply 和 divide 本來就在同一個 component，Hi、Lo 也共用。

```
        ┌──────────────────────────┐
        │ Multiplicand / Divisor   │  32 bits，不動
        └────────────┬─────────────┘
                     ▼
              ┌─────────────┐
              │ 32-bit ALU  │  乘：加    除：減
              └──────┬──────┘
                     ▼
   ┌─────────────────┬─────────────────┐
   │      左半       │      右半       │  Product / Remainder（64 bits）
   └─────────────────┴─────────────────┘
     乘：右移（右半起初放乘數）   除：左移（空出的位置放商）
              │                    │
              Hi                   Lo
                     ▲
                  Control：現在做乘還是除？
```

- 同一個 ALU：乘的時候做加，除的時候做減。
- 同一個 64-bit register：
  - 乘法：一開始右半擺滿乘數；乘數一直被吃掉，partial product 一直長大，一起**往右移**。
  - 除法：剛好相反，一開始全是 remainder（被除數），一直**往左移**，每空出一位就放一個商位。
- 只要 control 告訴它現在是乘還是除，就知道往右還是往左移、ALU 做加還是減。

> **重點** 乘除共用硬體這張圖要記起來：不動的 32-bit Multiplicand／Divisor、32-bit ALU（加／減）、會移動的 64-bit Product／Remainder（右移／左移），結果都在 Hi、Lo。

乘除到這裡結束，接下來進入 floating point（浮點數）。

## 為什麼需要浮點數（floating point）

整數的加減乘除做完，接著是 **floating point（浮點數）**。順序和整數一樣：先決定數字怎麼表示，再依表示法設計硬體。

回想邏輯設計：同樣 n 個 bit，看你怎麼解釋，就代表不同的值。

| 表示法 | n bits 的範圍 | 8 bits 時 |
|---|---|---|
| unsigned | 0 ～ 2ⁿ − 1 | 0 ～ 255 |
| two's complement | −2ⁿ⁻¹ ～ 2ⁿ⁻¹ − 1 | −128 ～ 127（正的少一個，因為要留給 0） |
| 1's complement、excess | 各有各的範圍 | — |

同一個 bit pattern 有不同的解釋方法，但這些全都是**整數**的表示法。要表示很大很大、或很小很小的數，整數表示法就無能為力了。

解法來自**科學記號（scientific notation）**：很大或很小的數，我們不會寫一長串 0，而是寫成

```
significand × base^exponent
```

- 前面的部分叫 **significand**，也叫 **mantissa（尾數）**。
- 電腦是二進位，所以 base 是 2。
- 數字中間那個點，在二進位裡叫 **binary point（二進位小數點）**。

> **觀念** 為什麼叫 floating？整數的小數點永遠固定在最右邊（3、4、5 的點都在最右邊，不會動）。浮點數的點會跑來跑去，例如 2.3468、27.5，點在哪裡取決於整數和小數部分各有幾位。小數點位置不固定，所以叫 floating point。

## 為什麼要有 IEEE 754 標準

浮點數就是「mantissa × 2^exponent」。但假設有人用 10 個 bit 表示一個數，別人用 12 bits、14 bits，電腦根本不知道總共幾個 bit、哪幾個是 mantissa、哪幾個是 exponent。所以需要一個大家都遵守的 **standard**。

> **比喻** 就像字母有 ASCII：大寫 A 存 65、小寫 a 存 97，大家都照這個存，電腦才讀得懂。浮點數的「ASCII」就是 **IEEE 754**，現在的電腦都用它。

IEEE 754 有好幾種格式，最小的是 **binary16**（16 bits），叫 **half precision（半精度）**；後面會介紹 single、double 等格式。

## Normalize：第一位一定是 1

同一個數用科學記號有很多種寫法。為了一致，要 **normalize（正規化）**：去掉前面所有的 0（**leading zeros**），讓第一個位置非 0。二進位只有 0 和 1，非 0 就只有 1，所以 **normalized 的第一位一定是 1**。

> **例題** 1.0 × 2⁻⁹ 是 normalized；0.1 × 2⁻⁸ 的值一模一樣，但不是 normalized。我們只要一種寫法。

所以 normalized 的二進位科學記號一定長這樣：

```
1.xxxx × 2^yyyy
```

- 那個「1.」不會變，base「2」也不會變 → 都不必存（大家都是 2，存了是浪費）。
- 只要記下 x（significand 的小數部分）和 y（exponent），就能合成這個數。
- 還漏了一樣：**正負號**。significand 和 exponent 只代表大小，還要記 **sign**。

問：要存哪三樣東西？
答：sign bit、x（significand）、y（exponent）。有這三個就能合成這個數。

欄位排列順序是：**sign 最前面，再來 exponent，significand 放最後**。為什麼這樣排，下面「exponent 為什麼擺中間」解釋。

## IEEE 754 的 single 與 double precision

exponent 給幾個 bit、significand 給幾個 bit，決定了能表示的 **range（範圍）** 和 **precision（精確度）**，所以需要標準來定。

**Single precision（單精度，32 bits）**：

| 欄位 | sign (S) | exponent (E) | significand / fraction (F) |
|---|---|---|---|
| bit 數 | 1 | 8 | 23 |
| 位置 | bit 31 | bit 30～23 | bit 22～0 |

**Double precision（雙精度，64 bits）**：

| 欄位 | sign (S) | exponent (E) | significand / fraction (F) |
|---|---|---|---|
| bit 數 | 1 | 11 | 52 |
| 位置 | bit 63 | bit 62～52 | bit 51～0 |

sign 一樣擺在最前面（和 two's complement 的 sign bit 位置相同）；exponent 在前、significand 在後。

比起 single，double 的 exponent 只多 3 bits（8 → 11），主要增加的是 significand（23 → 52）。

> **重點** 增加 exponent 的 bits → **range** 變大（能表示的大小範圍更廣）；增加 significand 的 bits → **precision** 變高（數字更精準）。

另一種記法是「sign 加 mantissa 共幾 bit、exponent 幾 bit」：single 是 24（1 + 23）+ 8；double 是 53（1 + 52）+ 11。

## Sign bit 與 hidden 1

以 single 為例逐欄看（double 完全類似）。

**Sign bit**：1 是負、0 是正。也就是值的正負號是 (−1)^S。

**Significand**：因為是 normalized，最前面那個 bit 一定是 1。既然一定是 1，就不花一個 bit 存它，它藏在裡面，叫 **hidden one（hidden bit，隱藏位元）**。

- single：存 23 bits，加上 hidden 1，實際表示 **24 bits** 的 significand。
- double：存 52 bits，加上 hidden 1，實際是 **53 bits**。
- 扣掉 hidden 1，存下來的 fraction F 介於 0 與 1 之間；真正的 significand 是 **1.F**。

問：永遠有個 hidden 1，那 0 要怎麼表示？
答：fraction 全擺 0，讀出來前面還有個 1，是 1.000…，不是 0，兩者分不出來。所以 **0 不能用一般方法表示**，要另外特別表示（見後面「特殊值」）。

> **陷阱** 把 significand 拿出來時，前面一定要補回 1，變成 1.F。fraction 全 0 代表 1.0，不是 0。

## Exponent 為什麼擺中間

> **觀念** 想想看：比兩個浮點數誰大，要從哪開始比？不用一次全比，一步一步來。先比 **sign**：一正一負，正的一定大，後面不用比了。sign 一樣，下一個比 **exponent**。exponent 也一樣，才比 **significand**。所以 exponent 擺在第二位，sign 比完馬上就輪到它。

既然要拿來比大小，exponent 用什麼表示最好比？exponent 有正有負，需要一種有號整數的表示法。可以用 1's complement 或 two's complement，但用 two's complement 時，比大小得**做減法**再看正負。

如果能直接用 **comparator（比較器）**：從最高位開始比，誰先出現比較大的 bit 就是誰大，後面不用看，非常快。減法要等 carry 傳完才知道結果；comparator 很快就完成。

> **例題** ½ 的 exponent 是 −1，2 的 exponent 是 +1。用 8-bit two's complement：−1 是 `1111 1111`，+1 是 `0000 0001`。直接丟進 comparator，`1111 1111` 看起來比 `0000 0001` 大——錯了！−1 應該比較小。

為了讓 exponent 能直接用 comparator 比，IEEE 754 不用 1's complement 也不用 two's complement，改用 **biased notation（偏移表示法）**，也叫 **excess**。目標是看到 pattern 就能比大小：**pattern 小代表數小，pattern 大代表數大**。

### 補充問答：two's complement 為什麼不能直接比

用 4 bits 再看一次。

- A = `1111`（−1）、B = `0111`（7）。一般比較器從最高位比：A 是 1、B 是 0，就說 A 大。可是 −1 明明比 7 小。正確做法要用減法：−1 − 7 = −8，是負的，所以 A 比較小。
- −8 = `1000`、−7 = `1001`：sign bit 都是 1，光看最高位分不出來，一樣要相減：−8 − (−7) = −1 < 0，所以 −8 比較小。

真正的比較器只比**無號**的大小：從最高位往下，遇到第一個不同的 bit 就決定，所以快。這就是 exponent 要改用 biased notation 的原因。

## Biased notation：無號值減掉 bias

以 **bias 7**、4 bits 為例，把 pattern 從 `0000` 依序往上排：

```
pattern  unsigned  代表的值 (= unsigned − 7)
0000        0        −7   ← 最負
0001        1        −6
0010        2        −5
0011        3        −4
0100        4        −3
0101        5        −2
0110        6        −1
0111        7         0
1000        8        +1
1001        9        +2
1010       10        +3
1011       11        +4
1100       12        +5
1101       13        +6
1110       14        +7
1111       15        +8   ← 最正
```

等於把整個數線推了 7 個位置，前 7 個位置讓給負數，這就是 bias 7。這樣排，第一個最小、第二個次小……兩個 pattern 一比就知道誰大。

**怎麼算值**：先把 pattern 當 unsigned 算，再減 bias。

> **例題** `1011` 當 unsigned 是 8 + 2 + 1 = 11，減 7 得 **4**。換個說法：它從 0 開始排在第 11 位，但前 7 位讓給了負數，大家往前推 7 格，所以是 11 − 7 = 4。

- bias 8：前 8 個位置給負數，從 −8 開始排，算出的值減 8。
- bias 127：讓 127 個位置給負數，算出來減 127。

全 0 是最負、全 1 是最正，比大小直接用 comparator 比 exponent 就好。

**IEEE 754 的 bias：single 用 127，double 用 1023。**

> **例題** single 的 exponent −1 存成 −1 + 127 = 126 = `0111 1110`；+1 存成 1 + 127 = 128 = `1000 0000`。比較時看第一個 bit：0 比 1 小，馬上知道 +1 比較大。

所以比兩個浮點數：先比 sign，同號再比 exponent，一分出高下就停，不必像減法那樣全部做完。

問：exponent 為什麼要減 127？
答：8 bits 能存 0～255，減 127 之後，前段留給負的指數。存的 E 減 127 才是真正的指數，例如存的 E 是 104，真正的指數就是 104 − 127 = −23。（精確地說，IEEE 754 裡 E = 0 和 E = 255 保留給特殊值，後面會講。）

## Bias 公式與 half precision

每一種格式要知道三件事：sign 加 mantissa 用幾個 bit、exponent 用幾個 bit，以及最重要的 **biased exponent**。

為什麼要 bias？exponent 可能是負的，直接存很麻煩；每個 exponent 都加上固定的 bias，讓存進去的都是非負數。

bias 有一個好記的公式（n 是 **exponent 欄位的 bit 數**）：

```
bias = 2^(n−1) − 1
```

| 格式 | 總 bits | sign | exponent (n) | mantissa | bias |
|---|---|---|---|---|---|
| binary16（half precision） | 16 | 1 | 5 | 10 | 2⁴ − 1 = 15 |
| binary32（single precision） | 32 | 1 | 8 | 23 | 2⁷ − 1 = 127 |
| binary64（double precision） | 64 | 1 | 11 | 52 | 2¹⁰ − 1 = 1023 |

> **陷阱** 公式裡的 n 是 exponent 的「bit 數」，不是 exponent 本身。

> **陷阱** single 的 bias 是 2⁷ − 1 = 128 − 1 = **127**，不是 128；double 是 1024 − 1 = **1023**。

### 例題：half precision 的 biased exponent

binary16 的 16 bits 裡，11 bits 給 sign 和 mantissa（1 + 10），剩下 5 bits 給 exponent，所以 n = 5，bias = 2⁴ − 1 = 16 − 1 = 15。原本的 exponent 都加 15 再存：

| 真正的 exponent | 存的值 | 5-bit pattern |
|---|---|---|
| 8 | 8 + 15 = 23 | `10111` |
| −3 | −3 + 15 = 12 | `01100` |

負的 exponent 也變成正的存了。half precision 精度太低，比較少用；重點是 32 和 64 bits。

更大的格式還有 **binary128（quadruple precision，四倍精度）** 和 **binary256（octuple precision，八倍精度）**，但最重要的是 single 和 double。

## 浮點數的值怎麼算

把三個欄位合起來，single precision 一個正常（normalized）數的值是：

```
value = (−1)^S × (1.F) × 2^(E − 127)
```

- S：0 正、1 負。
- E：把 exponent 那 8 bits 當 unsigned 算出來，減 127，才是真正的指數（double 減 1023）。
- 1.F：hidden 1 加上存的 fraction（把 F 抄到小數點後面，就是 1 + F）。

> **重點** base 2 和 hidden 1 都是**隱含**的，不存在 bits 裡，解碼時不要忘了。

### 例題：從 bits 算回十進位

這 32 bits 是哪個數？

```
0 0110 1000 101 0101 0100 0011 0100 0010
```

逐欄拆開：

| 欄位 | bits | 解讀 |
|---|---|---|
| S | `0` | 正數 |
| E | `0110 1000` | unsigned = 64 + 32 + 8 = 104；104 − 127 = **−23** |
| F | `101 0101 0100 0011 0100 0010` | 1.F = 1 + 2⁻¹ + 2⁻³ + 2⁻⁵ + 2⁻⁷ + 2⁻⁹ + 2⁻¹⁴ + 2⁻¹⁵ + 2⁻¹⁷ + 2⁻²² |

1. sign bit 0 → 正數。
2. exponent `0110 1000` 當 unsigned 是 104。它不代表 104，要減 127：104 − 127 = −23。
3. significand 補上 hidden 1：fraction 第 1、3、5、7、9、14、15、17、22 位是 1，所以 1.F = 1 + 2⁻¹ + 2⁻³ + 2⁻⁵ + … ≈ 1.666。
4. 值 ≈ 1.666 × 2⁻²³ ≈ **1.986 × 10⁻⁷**。

（這 32 bits 寫成十六進位是 `0x34554342`。）

## 十進位轉成二進位：整數用除，小數用乘

反過來，十進位要變成浮點數，第一步是**先寫成二進位的科學記號**，再填進格式。如果有小數，要先把十進位的小數轉成二進位。

- **整數部分**：一直除以 2（輾轉相除），把餘數**由下往上**倒過來讀。
- **小數部分**：一直**乘以 2**，每次取出整數位（0 或 1），剩下的小數繼續乘，直到變 0（或位數用完）。

> **陷阱** 小數部分一定要用乘（multiply），不是用除。

### 例題：13 轉二進位

```
13 ÷ 2 = 6 餘 1   ↑
 6 ÷ 2 = 3 餘 0   │
 3 ÷ 2 = 1 餘 1   │ 由下往上讀
 1 ÷ 2 = 0 餘 1   │
```

13 = `1101₂`。

### 例題：0.75 轉二進位

```
0.75 × 2 = 1.5   → 取 1，剩 0.5   ↓
0.5  × 2 = 1.0   → 取 1，剩 0     ↓ 由上往下讀；剩 0 就結束
```

0.75 = `0.11₂`（= 0.11 × 2⁰）。驗算：2⁻¹ + 2⁻² = 0.5 + 0.25 = 0.75。

## 十進位轉 IEEE 754：例題

### 例題：−0.75 編成 single precision

1. 轉二進位：0.75 = `0.11₂`，即 0.11 × 2⁰。
2. normalize：0.11 × 2⁰ = **1.1 × 2⁻¹**。
3. sign：這個數是負的 → S = 1。
4. exponent：−1 + 127 = 126 = `0111 1110`。
5. fraction：1.1 前面那個 1 是 hidden one，不存；fraction 只存一個 1，後面全補 0。

| S | E（8 bits） | F（23 bits） |
|---|---|---|
| `1` | `0111 1110` | `100 0000 0000 0000 0000 0000` |

```
1 01111110 10000000000000000000000   = 0xBF400000
```

### 例題：43.57（整數、小數都有）

整數和小數**分開做**：整數用除、小數用乘。

```
整數 43：                    小數 0.57：
43 ÷ 2 = 21 餘 1  ↑          0.57 × 2 = 1.14 → 1
21 ÷ 2 = 10 餘 1  │          0.14 × 2 = 0.28 → 0
10 ÷ 2 =  5 餘 0  │          0.28 × 2 = 0.56 → 0
 5 ÷ 2 =  2 餘 1  │          0.56 × 2 = 1.12 → 1
 2 ÷ 2 =  1 餘 0  │          0.12 × 2 = 0.24 → 0
 1 ÷ 2 =  0 餘 1  │          0.24 × 2 = 0.48 → 0
                             0.48 × 2 = 0.96 → 0
→ 43 = 101011                0.96 × 2 = 1.92 → 1
                             ……（不會剛好結束）
                             → 0.57 = 0.10010001…
```

43.57 = `101011.10010001…₂`。0.57 沒辦法用有限位的二進位剛好表示，乘下去不會結束，只能存到格式允許的位數，最後一位做 rounding。

接下來的填法和前面一樣：normalize 成 `1.0101110010001… × 2⁵`，S = 0，E = 5 + 127 = 132 = `1000 0100`，F 存小數點後的 `0101 1100 1000 1111 0101 110`（23 bits，最後一位已 rounding），整個是 `0x422E47AE`。

### 例題：1/3

十進位 1/3 = 0.3333…，無窮下去。用同樣的乘法轉二進位：

```
1/3 × 2 = 2/3  → 0
2/3 × 2 = 4/3  → 1，剩 1/3
1/3 × 2 = 2/3  → 0
2/3 × 2 = 4/3  → 1，剩 1/3
……（01 一直重複）
```

1/3 = `0.010101…₂`。

1. normalize：小數點右移 2 位 → **1.0101… × 2⁻²**。
2. 正數 → S = 0。
3. exponent：−2 + 127 = 125 = `0111 1101`。
4. hidden one 不存，fraction 存 `0101 0101 …` 一直下去，最後一位依 rounding 決定。

```
0 01111101 01010101010101010101011   = 0x3EAAAAAB
```

（第 24 位以後還是 `0101…`，捨入時進位，所以最後一位是 1。）

### 例題：116 編成 single precision

**步驟 1：轉二進位**，一直除以 2，記下餘數：

```
116 ÷ 2 = 58 餘 0   ↑
 58 ÷ 2 = 29 餘 0   │
 29 ÷ 2 = 14 餘 1   │
 14 ÷ 2 =  7 餘 0   │ 由下往上讀
  7 ÷ 2 =  3 餘 1   │
  3 ÷ 2 =  1 餘 1   │
  1 ÷ 2 =  0 餘 1   │
```

116 = `1110100₂`。

**步驟 2：normalization**：小數點往左移 6 位 → **1.110100 × 2⁶**。

**步驟 3：照格式放進 32 bits**：

1. sign：116 是正的 → S = 0。
2. exponent：放的是 biased exponent，6 + 127 = 133 = 128 + 4 + 1 = `1000 0101`。
3. mantissa（23 bits）：小數點前的 1 不存，只存後面的 `110100`，剩下全部補 0。

| S | E（8 bits） | F（23 bits） |
|---|---|---|
| `0` | `1000 0101` | `110 1000 0000 0000 0000 0000` |

```
0 10000101 11010000000000000000000
0100 0010 1110 1000 0000 0000 0000 0000
   4    2    E    8    0    0    0    0   → 0x42E80000
```

> **陷阱** normalized 的「1.」不存（hidden bit），mantissa 只存小數點後面那些位。

**驗算（bits → 十進位）**：value = (−1)^S × 1.M × 2^(E − 127)。

- S = 0 → 正。
- M = `110100`，補回沒存的 1 → 1.110100。
- E = 133，133 − 127 = 6 → 小數點往右移 6 位，變回 `1110100` = 64 + 32 + 16 + 4 = **116**。

### 例題：116 編成 double precision

二進位和 normalization 都一樣：1.110100 × 2⁶。不一樣的只有 bias 和欄位寬度：

1. S = 0。
2. biased exponent：6 + 1023 = 1029 = 1024 + 4 + 1 = `100 0000 0101`（11 bits）。
3. mantissa（52 bits）：一樣放 `110100`，其他補 0。

| S | E（11 bits） | F（52 bits） |
|---|---|---|
| `0` | `100 0000 0101` | `1101 0000 0000 … 0000`（`110100` 後面 46 個 0） |

```
0 10000000101 1101000000000000000000000000000000000000000000000000
0100 0000 0101 1101 0000 … 0000
   4    0    5    D    0 …    0   → 0x405D000000000000
```

有小數的數（像上面的 −0.75、1/3）編成 double，做法完全一樣，只是 bias 換成 1023、欄位換成 11 + 52。

## Range 與 precision

給你一個浮點格式，要能算出它的 range 和 precision——這是考題。

### Range：由 exponent 決定

exponent 全 0（`0000 0000`）和全 1（`1111 1111`）**保留不用**，拿來表示特殊值（像 0 就還沒辦法表示）。所以正常數的 exponent：

- 最小用 `0000 0001` = 1 → 1 − 127 = **−126**。
- 最大用 `1111 1110` = 254 → 254 − 127 = **+127**。

| | exponent | significand | 值 |
|---|---|---|---|
| 最小的 normalized 數 | `0000 0001`（−126） | fraction 全 0，但有 hidden 1 → 1.0 | ±1.0 × 2⁻¹²⁶（≈ 1.2 × 10⁻³⁸） |
| 最大的數 | `1111 1110`（+127） | fraction 全 1 → 1.111…1 = 2 − 2⁻²³ | ±(2 − 2⁻²³) × 2¹²⁷ ≈ ±2.0 × 2¹²⁷（≈ 3.4 × 10³⁸） |

significand 全擺 1 時最大，離 2.0 只差 2⁻²³，所以大約是 2.0 × 2¹²⁷。正負兩邊對稱都有。

double 的算法完全一樣：exponent 11 bits，正常數用 1～2046，扣 bias 1023 後是 −1022～+1023，最小 normalized 是 ±1.0 × 2⁻¹⁰²²，最大約 ±2.0 × 2¹⁰²³。

### Precision：由 significand 決定

問：precision 跟 sign、exponent、significand 哪個有關？
答：跟 **significand** 有關，bits 越多越精確。single 是 23 bits、double 是 52 bits，這是格式定好的。

換成十進位位數：乘上 log₁₀2 ≈ 0.3。

- single：23 × 0.3 ≈ 6.9 → 大約 **6～7 位**十進位有效數字（一般說「約 6 位」）。
- double：52 × 0.3 ≈ 15.7 → 大約 **16 位**。

## 特殊值：exponent 全 0 與全 1

exponent 全 0 和全 1 是保留的。先不管 sign，exponent 分成三類：

- **E = 0**（全 0）：特殊。
- **E = 1～254**：正常數，照前面的 bias 與 hidden 1 解釋。
- **E = 255**（全 1）：特殊。

兩個保留值各搭配 significand（fraction）= 0 或 ≠ 0，共**四種特殊情況**。把這四種講清楚，所有組合就都說明完了：

| exponent E | fraction F | 代表 | 值怎麼算 |
|---|---|---|---|
| 0 | 0 | **±0** | 就是 0 |
| 0 | ≠ 0 | **denormalized number** | (−1)^S × 0.F × 2⁻¹²⁶ |
| 1～254 | 任意 | normalized number | (−1)^S × 1.F × 2^(E−127) |
| 255 | 0 | **±∞** | S = 0 為 +∞，S = 1 為 −∞ |
| 255 | ≠ 0 | **NaN** | not a number |

> **陷阱** 看到 exponent 全 0 或全 1，不能照一般方式去解釋（不能減 127、不能補 hidden 1）。

### 0 怎麼表示

**exponent 0、significand 也是 0，全部都是 0，就代表 0。**

- 這裡沒有 hidden one，因為 exponent = 0 是特別的表示法。
- 不要傻傻地當成 1.0 × 2⁻¹²⁷ 去算；看到這個 pattern 就知道是 0，不用 hidden one，也不用 bias。
- sign bit 還在，所以有 **+0** 和 **−0** 兩種 pattern，比較時可以用，但意思都是 0。

```
+0 : 0 00000000 00000000000000000000000
−0 : 1 00000000 00000000000000000000000
```

### Denormalized number：gradual underflow

**exponent 0、significand 不是 0。** 看到 exponent 是 0，就要特別解釋，不能減 127。

bits 有限，能表示的數也有限；超出範圍，太大是 **overflow（溢位）**，太小是 **underflow（下溢）**。underflow 時 IEEE 稍微「偷吃步」：用這個 pattern 多表示一些本來已經 underflow 的數，叫 **gradual underflow（漸進式下溢）**。

- 指數固定當作 **2⁻¹²⁶**，也就是正常數的最小指數。
- significand 擺什麼就是什麼，前面**沒有 hidden one**。

```
value = (−1)^S × 0.F × 2⁻¹²⁶
```

normalized 最小是 1.0 × 2⁻¹²⁶，比它還小的數，就用 **denormalized number（非正規化數，也叫 subnormal）** 表示。最小的正 denormalized 數是 F 只有最後一位是 1：0.000…01 × 2⁻¹²⁶ = 2⁻²³ × 2⁻¹²⁶ = 2⁻¹⁴⁹。

問：怎麼知道一個數有沒有 hidden one？
答：看 exponent。全 0 就是不正常的數，沒有 hidden one；1～254 才有。

> **陷阱** denormalized 的指數是 **−126**，不是 0 − 127 = −127；而且沒有 hidden 1（是 0.F，不是 1.F）。

> **重點** 考你「exponent 全 0、significand 有值」的 pattern，答案就是 denormalized number，用來做 gradual underflow。

### 無限大（infinity）

**exponent 全 1、significand 全 0**：sign 0 是 **+∞**，sign 1 是 **−∞**。浮點運算有時候會算出這種東西，例如除以 0，結果就表示成無限大。

```
+∞ : 0 11111111 00000000000000000000000
−∞ : 1 11111111 00000000000000000000000
```

### NaN（not a number）

**exponent 全 1、significand 不是 0**：定義成 **NaN**。像 0 ÷ 0、√−4，結果不是一個數，就用 NaN 表示，對 debug 很有用。

所有情況到此講完：正常的數（E = 1～254），加上 exponent 0 和 255 的四種特殊情況，後者不能用 bias 和 hidden 1 解釋。

## 浮點加法演算法：對齊、相加、正規化、捨入

表示法講完，接著照表示法設計加法器。

two's complement 的整數加法很簡單：full adder 兜一兜，ripple carry 或 carry lookahead 都行（見前面 ALU 的部分）。但浮點數同樣是 32 bits，解釋方法不同，分成 sign、exponent、significand，**不能直接用 full adder 加**。所以要自己設計：先想 algorithm，再把 hardware 做出來。

問：1.3 × 2⁵ + 1.3 × 2⁻⁵，可以直接把 mantissa 相加（1.3 + 1.3）嗎？
答：不行！要先讓兩個 exponent 一樣，也就是**把小數點對齊**。

問：要移哪一個？
答：用十進位想：把小的那個變成 0.00…幾 這種形式，往右移，再跟大的加。所以 exponent 不一樣時，**把指數小的那個往右移**到和大的一樣，而不是把大的往左移——把大的左移會丟掉高位。

> **陷阱** 對齊時是把「指數小」的數往右 shift（不是把大的往左移），以免丟掉高位（重要的位數）。

完整的四步：

1. **Align（對齊）**：比較兩個 exponent，把指數小的那個的 significand 往右移，移的位數 = 兩個 exponent 的差，直到兩者 exponent 相同。
2. **Add（相加）**：小數點對齊後，significand 相加。
3. **Normalize（正規化）**：結果可能不是 normalized，要左移或右移，exponent 跟著減或加；同時檢查 **overflow、underflow**。
4. **Round（捨入）**：normalize 時移來移去，significand 可能變很長，但 single 只有 23 bits，放不下就截掉或四捨五入，叫 **rounding**。rounding 完可能又進位、又不是 normalized，就**回到第 3 步**再 normalize；沒事就完成。

```
        ┌─────────────────────────┐
        │ 1. 對齊：指數小的右移     │
        └───────────┬─────────────┘
                    ▼
        ┌─────────────────────────┐
        │ 2. significand 相加      │
        └───────────┬─────────────┘
                    ▼
        ┌─────────────────────────┐
  ┌────▶│ 3. normalize            │──▶ overflow / underflow？→ 例外
  │     └───────────┬─────────────┘
  │                 ▼
  │     ┌─────────────────────────┐
  │     │ 4. rounding             │
  │     └───────────┬─────────────┘
  │                 ▼
  │        還是 normalized 嗎？
  └──── 否 ─────────┤
                    是 ▼
                   完成
```

整數加法只要 full adder 串起來；浮點加法卻是四步的複雜演算法，但硬體還是做得出來。

### 例題：0.5 + (−0.4375)（4 位二進位 significand）

兩個數：

- 0.5 = **1.000 × 2⁻¹**
- −0.4375 = **−1.110 × 2⁻²**（1.110₂ = 1.75，1.75 × ¼ = 0.4375）

**第 1 步 align**：exponent −2 比 −1 小，把它右移 1 位：

```
−1.110 × 2⁻²  →  −0.111 × 2⁻¹
```

**第 2 步 add**：exponent 一樣了，significand 相加（實際上是相減）：

```
   1.000 × 2⁻¹
 − 0.111 × 2⁻¹
 ─────────────
   0.001 × 2⁻¹
```

**第 3 步 normalize**：0.001 不是 normalized，要把這個數往左移。左移一位、兩位、三位，exponent 就減 3：

```
0.001 × 2⁻¹ → 0.010 × 2⁻² → 0.100 × 2⁻³ → 1.000 × 2⁻⁴
```

exponent −4 在 −126～127 之間，沒有 overflow／underflow。

**第 4 步 round**：1.000 剛好放得下 4 位，不需要捨入，也仍是 normalized → 完成。

結果 **1.000 × 2⁻⁴ = 0.0625**。驗算：0.5 − 0.4375 = 0.0625。

> **陷阱** 書上說 right shift、left shift，是指**這個數**往右或往左移，不是小數點；兩者方向相反。數往右移 = 小數點看起來往左移。自己測例子時記得這點，不然會覺得跟想的不一樣。

### 浮點加法沒有結合律

> **陷阱** 浮點數加法**不具結合律（associativity）**：(A + B) + C 不一定等於 A + (B + C)。原因就在第 1 步的對齊與第 4 步的捨入：一個很小的數跟一個很大的數相加時，小的那個右移到超出 significand 的位數，就整個被丟掉了。這是常見考題。

### 例題（示意）：(A + B) + C ≠ A + (B + C)

設 single precision 的 A = −1.5 × 10³⁸、B = +1.5 × 10³⁸、C = 1.0。

```
(A + B) + C = (−1.5×10³⁸ + 1.5×10³⁸) + 1.0
            = 0.0 + 1.0
            = 1.0

A + (B + C) = −1.5×10³⁸ + (1.5×10³⁸ + 1.0)
            = −1.5×10³⁸ + 1.5×10³⁸        ← 1.0 被吃掉
            = 0.0
```

為什麼 1.5 × 10³⁸ + 1.0 還是 1.5 × 10³⁸？1.5 × 10³⁸ 約是 2¹²⁶ 等級，1.0 是 2⁰；對齊時 1.0 要右移約 126 位，遠超過 significand 的 24 位，捨入後完全消失。兩種加法順序得到 1.0 與 0.0，差很多。

## 浮點加法器的硬體

浮點加法器的硬體看起來很複雜。浮點運算很晚才進到處理器裡，像 x86 一開始沒有浮點，要另外接 **coprocessor（協同處理器）**，就是因為太複雜。和整數加法器比，它要好幾個 ALU，還要移來移去。

> **觀念** 做 IC 設計就是這件事：給你一個 algorithm，把每一步變成 hardware。四步各對應一塊電路：對齊、相加、normalize、rounding。

```
第 1 步 對齊
  exp A, exp B → small ALU 相減 → control（誰小？差幾位？）
  sig A, sig B → MUX 2→1 → 選出「要移的」 → shift right（右移「差」位）
  sig A, sig B → MUX 2→1 → 選出「不移的」
  exp A, exp B → MUX 2→1 → 選出「較大的 exponent」
第 2 步 相加
  移過的 sig + 不移的 sig → big ALU
  big ALU 結果 → MUX 2→1（0：ALU 結果，1：rounding 繞回來的值）
第 3 步 normalize
  significand 左移或右移，exponent 同時加減（檢查 overflow／underflow）
第 4 步 rounding
  rounding 硬體 → 仍 normalized：輸出結果
               → 不 normalized：繞回第 3 步（上面 MUX 選 1）
```

各部分的功能：

- **第 2～4 步比較直覺**：相加交給 ALU；normalize 看要左移還是右移，exponent 跟著加減；rounding 有專門的硬體。
- **第 1 步比較不直覺**：怎麼知道誰的 exponent 小？先把兩個 exponent 拿出來，用 **small ALU** 相減，小的那個就要右移。
- **關鍵**：要被移的可能是 A 的 significand，也可能是 B 的，所以 shifter 前面要一個 **2-to-1 MUX** 來選；另一個不移的也可能是 A 或 B，所以 big ALU 的另一個 operand 前面也要一個 2-to-1 MUX。
- 這些 MUX 的 select 由 **control** 決定。control 怎麼知道？兩個 exponent 一減就知道誰小；要移幾位也由 control 告訴 shifter，就是 exponent 的差。
- **big ALU** 叫「big」，是因為對齊後的 significand 比原本寬。
- big ALU 後面又一個 2-to-1 MUX：一個 input 從 ALU 來，一個從 rounding 後面繞回來。第一次做時選 0（用 ALU 的結果）；rounding 後又進位、不是 normalized，就繞回去，這時選 1，再 normalize 一次。
- exponent 那邊也有一個 2-to-1 MUX：小的那個 significand 已經被移到大的那邊對齊了，所以保留**較大的 exponent**，再交給 normalize 調整。

用這些 MUX 控制不同路徑，algorithm 的每一步都能對應到硬體。

### 例題：用硬體走一次 0.5 + (−0.4375)

令 A = −1.110 × 2⁻²、B = 1.000 × 2⁻¹。

| 步驟 | 硬體 | 動作 / 結果 |
|---|---|---|
| 1 | small ALU | exponent 相減：(−1) − (−2) = 1 → A 的 exponent 比較小，差 1 |
| 1 | 兩個 significand MUX | 左邊 MUX 選 A 去 shift，右邊 MUX 選 B 直接進 big ALU |
| 1 | shifter | control 告訴它右移 1 位：−1.110 → −0.111 |
| 1 | exponent MUX | 選較大的 exponent：−1 |
| 2 | big ALU | 1.000 + (−0.111) = 0.001 |
| 3 | MUX（選 0）→ normalize | 0.001 左移 3 位 → 1.000；exponent −1 − 3 = −4 |
| 4 | rounding | 不需進位，仍 normalized → 直接輸出 1.000 × 2⁻⁴ |

## 浮點加法一個 cycle 做不完：pipeline

浮點加法比整數加法複雜太多，設計很花時間。從頭到尾做一次（對齊、相加、normalize、rounding，可能還要繞回去），**一個 clock cycle 可能做不完**；硬要在一個 cycle 內完成，clock period 就得拉得很長，拖慢所有指令。

常用的解法是 **pipeline（管線化）**：把它切成幾個 stage，一段一段做（pipeline 在後面的章節介紹）。所以浮點加法器通常會 pipeline。

## 重點整理
- 電腦用二進位：電壓以 threshold 分 high／low 兩種 state，最不怕雜訊
- NMOS gate=1 導通、PMOS gate=0 導通；NAND = PMOS 並聯接 VDD + NMOS 串聯接 Ground
- NAND 是 functionally complete；NAND(A,A) = NOT A
- 乘法 = shift and add；latch（cross-coupled）存 1 bit，排成 32 個就是 register
- Processor = datapath + control；電腦 = processor + memory + I/O
- Computer Architecture = ISA + Machine Organization；ISA 是軟硬體介面
- ISA 規定：operand 數、register 數、data 編碼、提供哪些指令、instruction format、addressing
- MIPS 只有 R、I、J 三種 format，每種都是 32 bits；add `$s0`,`$s1`,`$s2` = 0x02328020
- CISC（Intel x86）vs RISC（ARM、MIPS）
- Harvard architecture：instruction 與 data 放在不同 memory
- ENIAC：第一部全電子、可程式、general purpose 電腦（1946 完成），真空管
- IC（1958）：transistor、電阻、電容做在同一塊半導體上
- Moore's Law：chip 上 transistor 數約每 18～24 個月加倍
- Feature size = source 到 drain 的長度；28 nm = 0.028 µm
- Desktop 看 cost/performance；server 看 reliability；embedded 看 power 與 cost
- General purpose 最重視 software compatibility；embedded 的 compatibility 不是問題
- 電腦三大塊：hardware、system software（compiler、OS）、application software
- High-level language 提供 productivity 與 portability；assembler 一對一翻譯；lw `$t0`,0(`$t1`) = 0x8D280000
- 硬體：processor、memory、I/O（user-interface、storage、network adapter）
- 24-bit 彩色 pixel：2²⁴ = 16,777,216 色；frame buffer 存每個 pixel 的值
- Cache 在 on-chip、小而快；DRAM main memory 在 off-chip、volatile；disk/flash 是 non-volatile
- ABI = ISA + system software 介面
- Response time 看單一工作多快；throughput 看單位時間做多少；加 processor 只保證 throughput
- Elapsed time 含 I/O、OS、idle；CPU time = user CPU time + system CPU time
- Performance = 1 / Execution time；X 比 Y 快 n 倍：n = Time_Y / Time_X
- Clock rate = 1 / clock period；250 ps ↔ 4 GHz
- CPU time = clock cycles × cycle time = clock cycles / clock rate = IC × CPI × cycle time
- 提高 clock rate 可能讓 cycle 數增加，不一定變快
- IC 受程式、algorithm、ISA、compiler 影響；CPI 受硬體與指令組成影響
- C → compiler → assembly → assembler → object module → linker → executable → loader → memory
- Pseudo-instruction：move → add `$t0`,`$zero`,`$t1`；blt → slt `$at` + bne；`$at`（r1）保留給 assembler，`$zero`（r0）固定為 0
- Object module：header、text、static data、relocation info、symbol table、debugging info
- Loader 六步：讀 header、建 address space、準備 text/data、參數放 stack、初始化 register、跳到 startup
- 不能單用 IC 或 CPI 評估 compiler；O1 IC 最少但 CPI 1.79，O3 cycle 數最少最快
- Algorithm 改善（quicksort 比 bubble sort 快 2,468 倍）遠大於 compiler 最佳化
- Strength reduction（乘法→shift）；induction variable elimination（loop 6 → 4 個指令，100 圈省 200 個）
- ARM：16 個 register、每個指令 4-bit condition、status register N/Z/C/V、CMP 只設 condition code
- x86：CISC、backward compatibility、8 個 GPR、兩個 operand、operand 可在 memory、指令長 1～15 bytes、複雜指令拆成 micro-operation
- Fallacy：powerful instruction 不等於高效能；assembly 不一定比較快；backward compatibility 不代表指令集不變
- Pitfall：連續 word 地址 +4；不要回傳指向區域變數的 pointer
- 四個設計原則：simplicity favors regularity、smaller is faster、make the common case fast、good design demands good compromises
- ALU：兩個 32-bit 運算元進、32-bit 結果出，另有 Overflow、Zero 兩個輸出；4-bit ALU control 由 R-type 的 funct 轉出（R-type 的 op 全為 000000）
- ALU 六種運算：and、or、add、sub、slt、nor；MIPS 沒有 NOT，用 a NOR 0 = NOT a
- 1-bit slice（divide and conquer）：AND、OR、full adder 同時算，MUX 依 Operation 選（00 AND、01 OR、10 add、11 Less）；32 片串接，CarryOut 接左片 CarryIn，Operation 同時送給每一片
- 2-to-1 MUX select 1 bit；4-to-1（及 3-to-1）MUX select 2 bits
- 減法 A − B = A + B̄ + 1：Binvert = 1 且 bit 0 的 CarryIn = 1；只做 Binvert 只是 1's complement
- ALU control = Ainvert | Bnegate | Operation(2)：AND 0000、OR 0001、add 0010、sub 0110、slt 0111、NOR 1100；Bnegate 同時控制 Binvert 與 bit 0 的 CarryIn
- NOR = (NOT a) AND (NOT b)（De Morgan）：Ainvert = Binvert = 1 再選 AND
- slt：算 a − b，MSB 加法器的 sign bit（Set）接到 bit 0 的 Less；其他 bit（含 bit 31）的 Less 接 0；結果 000…001 或全 0
- parallel data flow：MUX 前的單元每一刻都在算，MUX 只負責挑（slt 用了沒被選中的加法器的 sign bit）
- 4-bit two's complement 範圍 −8～7；n bits 為 −2ⁿ⁻¹～2ⁿ⁻¹−1
- 只有同號相加可能 overflow（正+正得負、負+負得正）；一正一負永不 overflow
- Overflow = MSB 的 carry in ⊕ carry out（一個 XOR）；不是看 carry out 有沒有 1
- overflow 處理：add、sub 觸發 exception（跳 exception handler）；addu 不觸發
- Zero = 所有 Result bit 的 NOR
- full adder：cout = xy + x·cin + y·cin（2 gate delay），sum = x ⊕ y ⊕ cin；ripple carry delay 與 n 成正比
- gᵢ = aᵢbᵢ（generate）、pᵢ = aᵢ ⊕ bᵢ 或 aᵢ + bᵢ（propagate），兩種 p 算出的 carry 相同
- c1 = g0 + p0c0；c2 = g1 + p1g0 + p1p0c0；c4 = g3 + p3g2 + p3p2g1 + p3p2p1g0 + p3p2p1p0c0（sum of products，two-level）
- cₙ 有 n + 1 項、最長 AND 有 n + 1 個 input → fan-in 問題，不能直接做 32-bit CLA
- Cascaded CLA：32 bits 切 4 塊 8 bits，塊內 lookahead、塊間 ripple → 4 個 stage
- Multi-level CLA：大 P = 塊內所有 p 的 AND；大 G = g3 + p3g2 + p3p2g1 + p3p2p1g0（4-bit 塊）；第二層算 c4、c8、c12、c16；tree 結構，delay ∝ log n，最快
- Carry select：上半部 carry = 0、1 兩份都先算，下半部 carry 當 2-to-1 MUX select；2n → 約 n
- SIMD 分割加法器：64-bit adder 切成 8×8-bit 或 4×16-bit，分割處切斷 carry
- Saturation：overflow 時取最大值（200 + 100 → 255，不是 wrap 成 44），用於 audio、video
- mult rs, rt：64-bit 積的高 32 bits → Hi、低 32 bits → Lo，用 mfhi／mflo 搬到一般 register；mul rd, rs, rt 直接把低 32 bits 放 rd；multu 為 unsigned
- 第一版乘法器：64-bit Multiplicand（左移）、64-bit ALU、64-bit Product、32-bit Multiplier（右移）；Multiplier0 = 1 才加，但兩個 shift 每輪都做；32 bits 做 32 輪
- 第一版浪費：Multiplicand 一半永遠是 0；Product 已加完的低位不再變 → 不需要 64-bit 加法器；乘法約為加法的 5～100 倍時間
- 改良版乘法器：Multiplicand 32 bits 不動、ALU 32 bits、Product 64 bits 右移，右半起初放 multiplier（multiplier register 省掉）
- 有號乘法方法一：取絕對值做 unsigned 乘，sign bit XOR 為 1 則結果取 two's complement
- Two's complement 乘法：multiplicand 要 sign extension；乘數 sign bit 代表 −2ⁿ⁻¹，最後一輪若為 1 要「減」multiplicand（左移 n−1 位）；例 (−7)×(−7)：1111 1001 − 1100 1000 = 0011 0001 = 49
- Booth：看（current bit, 右邊那位）：10 減（run 開始）、11 不動、01 加（run 結束）、00 不動；右邊那位初始 0；每輪算術右移（補 sign bit）；結果與一般乘法相同
- Booth 例：2×7 = 0000 1110（14）；2×(−3) = 1111 1010（−6）；0011 1110 = 0100 0000 − 0000 0010（5 次加 → 1 減 1 加）；1、0 交錯時 Booth 不省反而多
- Sequential multiplier：一個加法器、每 cycle 處理一位；combinational multiplier：AND gate 同時產生所有 partial product、多個加法器（4 個 PP 至少 3 個）、一個 cycle 完成、路徑長可加 pipeline
- Carry save adder：每位一個 full adder，3 個數 → 2 個數（sum 同位、carry 左移一位），每層只有一個 full adder delay；Wallace tree 高度約 log n，最後一層要一般加法器做 carry propagation
- div rs, rt：Lo = 商、Hi = 餘數（與乘法 Hi 意義不同）；divu 為 unsigned；MIPS 不檢查 overflow 與除以 0，由軟體檢查
- 除法 = shift and subtract：夠減（≥ 0）商 1；不夠減 restore、商 0
- 第一版除法器：64-bit Divisor（起初在左半，右移）、64-bit ALU、64-bit Remainder、32-bit Quotient（左移）；n bits 做 n + 1 輪
- 改良版除法器：Divisor 32 bits 不動、ALU 32 bits、Remainder 64 bits 左移、商放進右邊空位；先左移一次省一輪，做 n 輪，最後只把左半右移一位；7÷2 → 0001 0011（餘 1、商 3）
- 有號除法：餘數與被除數同號；商同號為正、異號為負；quotient × divisor + remainder = dividend；(−7)÷2 = −3 餘 −1，(−7)÷(−2) = 3 餘 −1
- 乘除共用硬體：同一個 32-bit ALU（乘加、除減）、同一個 64-bit register（乘右移、除左移），control 決定；結果都在 Hi、Lo
- 浮點數 = significand（mantissa）× 2^exponent；binary point 位置會變，所以叫 floating point
- IEEE 754 是浮點數的共同標準（像 ASCII 之於字母）
- normalized：去掉 leading zeros，二進位第一位一定是 1 → 形式 1.F × 2^E，1 與 base 2 都不存
- 欄位順序：sign → exponent → significand（比大小時依序比 sign、exponent、significand）
- single precision 32 bits = 1 + 8 + 23，bias 127；double 64 bits = 1 + 11 + 52，bias 1023；half 16 bits = 1 + 5 + 10，bias 15
- bias = 2^(n−1) − 1，n 是 exponent 欄位的 bit 數（不是 exponent 本身）；single 是 127 不是 128
- 加 exponent bits → range 變大；加 significand bits → precision 變高
- hidden 1：single 實際 24 bits significand、double 53 bits；解碼時補回 1.F
- exponent 用 biased notation（excess）而不用 two's complement：pattern 大小 = 值大小，comparator 直接比，不必做減法
- biased 值 = unsigned 值 − bias；例 bias 7：1011 = 11 − 7 = 4；single 的 −1 存 0111 1110、+1 存 1000 0000
- 正常數的值 = (−1)^S × 1.F × 2^(E − 127)（double 減 1023）
- 十進位轉二進位：整數一直除以 2 取餘數（由下往上讀）；小數一直乘以 2 取整數位
- −0.75 = −1.1 × 2⁻¹ → 1 01111110 100…0 = 0xBF400000
- 116 = 1.110100 × 2⁶ → single 0 10000101 110100…0 = 0x42E80000；double E = 1029 → 0x405D000000000000
- 1/3 = 1.0101… × 2⁻² → S = 0、E = 125、F = 0101…（最後一位 rounding）
- single range：exponent 1～254 → −126～+127；最小 normalized ±1.0 × 2⁻¹²⁶，最大 ≈ ±2.0 × 2¹²⁷
- precision ≈ significand bits × log₁₀2（≈ 0.3）：single 約 6～7 位十進位、double 約 16 位
- E = 0、F = 0 → ±0（有 +0、−0）
- E = 0、F ≠ 0 → denormalized：0.F × 2⁻¹²⁶（指數 −126 不是 −127，沒有 hidden 1），用於 gradual underflow
- E = 全 1、F = 0 → ±∞（如除以 0）；E = 全 1、F ≠ 0 → NaN（如 0/0、√−4）
- 浮點加法四步：對齊（指數小的右移）→ significand 相加 → normalize（查 overflow／underflow）→ rounding（不 normalized 就回第 3 步）
- 對齊時移指數小的那個往右，不是把大的往左移（以免丟掉高位）
- 書上的 right/left shift 指「數」移動，不是小數點移動
- 例：1.000 × 2⁻¹ + (−1.110 × 2⁻²) → −0.111 × 2⁻¹ → 0.001 × 2⁻¹ → 1.000 × 2⁻⁴ = 0.0625
- 浮點加法沒有結合律：(A + B) + C ≠ A + (B + C)（小數對齊時被移出 significand 而消失）
- FP adder 硬體：small ALU（exponent 相減）、2-to-1 MUX 選要移／不移的 significand、shifter、big ALU、MUX 選較大 exponent、normalize、rounding（可繞回）
- 浮點加法一個 cycle 做不完，常用 pipeline 切成幾個 stage

## 名詞對照
| 中文 | English |
|---|---|
| 位元 | bit |
| 門檻電壓 | threshold |
| 電晶體 | transistor |
| 閘極／源極／汲極 | gate / source / drain |
| 通道 | channel |
| 功能完備 | functionally complete |
| 全加器 | full adder |
| 閂鎖 | latch |
| 暫存器 | register |
| 資料路徑 | datapath |
| 控制單元 | control |
| 指令集架構 | Instruction Set Architecture (ISA) |
| 機器組織 | machine organization |
| 模擬器 | emulator |
| 組譯器 | assembler |
| 編譯器 | compiler |
| 複雜指令集電腦 | CISC |
| 精簡指令集電腦 | RISC |
| 積體電路 | integrated circuit (IC) |
| 微處理器 | microprocessor |
| 超大型積體電路 | VLSI |
| 摩爾定律 | Moore's Law |
| 特徵尺寸 | feature size / line width |
| 嵌入式電腦 | embedded computer |
| 伺服器 | server |
| 記憶體管理單元 | memory management unit (MMU) |
| 抽象化 | abstraction |
| 應用軟體 | application software |
| 系統軟體 | system software |
| 生產力 | productivity |
| 可攜性 | portability |
| 組合語言 | assembly language |
| 機器碼 | machine code |
| 像素 | pixel |
| 解析度 | resolution |
| 畫面緩衝區 | frame buffer |
| 快取 | cache |
| 揮發性 | volatile |
| 次級記憶體 | secondary memory |
| 應用程式二進位介面 | Application Binary Interface (ABI) |
| 回應時間 | response time |
| 吞吐量 | throughput |
| 經過時間 | elapsed time (wall clock time) |
| 時脈週期 | clock period / clock cycle time |
| 時脈頻率 | clock rate / clock frequency |
| 指令數 | instruction count (IC) |
| 每指令平均週期數 | clock cycles per instruction (CPI) |
| 基準測試程式 | benchmark |
| 虛擬指令 | pseudo-instruction |
| 目的模組 | object module |
| 連結器 | linker |
| 載入器 | loader |
| 符號表 | symbol table |
| 重定位資訊 | relocation information |
| 強度折減 | strength reduction |
| 歸納變數消除 | induction variable elimination |
| 即時編譯 | just-in-time (JIT) compilation |
| 條件碼 | condition code |
| 記憶體映射 I/O | memory-mapped I/O |
| 向後相容 | backward compatibility |
| 微操作 | micro-operation |
| 謬誤 | fallacy |
| 陷阱 | pitfall |
| 電腦算術 | computer arithmetic |
| 算術邏輯單元 | arithmetic logic unit (ALU) |
| ALU 控制碼 | ALU control |
| 功能欄位 | funct field |
| 一位元切片 | one-bit slice |
| 分而治之 | divide and conquer |
| 多工器 | multiplexer (MUX) |
| 選擇輸入 | select input |
| 2 的補數 | two's complement |
| 1 的補數 | one's complement |
| 反相 | invert |
| 反相器 | inverter |
| 取負 | negate (Bnegate) |
| 進位輸入／輸出 | carry in / carry out |
| 最低有效位 | least significant bit (LSB) |
| 最高有效位 | most significant bit (MSB) |
| 符號位元 | sign bit |
| 迪摩根定律 | De Morgan's law |
| 小於則設定 | set on less than (slt) |
| 平行資料流 | parallel data flow |
| 溢位 | overflow |
| 例外處理程式 | exception handler |
| 漣漪進位加法器 | ripple carry adder |
| 閘延遲 | gate delay |
| 積之和 | sum of products |
| 前瞻進位加法器 | carry lookahead adder (CLA) |
| 產生項 | generate term |
| 傳遞項 | propagate term |
| 扇入 | fan-in |
| 串接式前瞻進位加法器 | cascaded carry lookahead adder |
| 多層前瞻進位加法器 | multiple-level carry lookahead adder |
| 進位選擇加法器 | carry select adder |
| 分割 | partition |
| 單指令多資料 | single instruction, multiple data (SIMD) |
| 截斷 | truncation |
| 捨入 | rounding |
| 飽和運算 | saturation |
| 攤平 | flatten |
| 乘法／除法單元 | multiply／divide unit |
| 被乘數 | multiplicand |
| 乘數 | multiplier |
| 積 | product |
| 部分積 | partial product |
| 符號延伸 | sign extension |
| 算術右移 | arithmetic shift right |
| Booth 演算法 | Booth's algorithm |
| 一串 1 的開始／結束 | beginning of run／end of run |
| 循序乘法器 | sequential multiplier |
| 組合乘法器 | combinational multiplier |
| 循序加法器 | sequential adder |
| 進位保留加法器 | carry save adder (CSA) |
| 華萊士樹乘法器 | Wallace tree multiplier |
| 被除數 | dividend |
| 除數 | divisor |
| 商 | quotient |
| 餘數 | remainder |
| 恢復 | restore |
| 浮點數 | floating point |
| 尾數、有效數 | significand / mantissa |
| 指數 | exponent |
| 二進位小數點 | binary point |
| 科學記號 | scientific notation |
| 正規化 | normalization / normalized |
| 前導零 | leading zeros |
| 隱藏位元 | hidden one / hidden bit |
| 小數部分 | fraction |
| 單精度 | single precision |
| 雙精度 | double precision |
| 半精度 | half precision (binary16) |
| 四倍精度 | quadruple precision (binary128) |
| 八倍精度 | octuple precision (binary256) |
| 偏移表示法 | biased notation / excess |
| 偏移指數 | biased exponent |
| 比較器 | comparator |
| 範圍 | range |
| 精確度 | precision |
| 下溢 | underflow |
| 漸進式下溢 | gradual underflow |
| 非正規化數 | denormalized number (subnormal) |
| 無限大 | infinity |
| 非數 | NaN (not a number) |
| 對齊 | alignment |
| 結合律 | associativity |
| 協同處理器 | coprocessor |
| 移位器 | shifter |
| 管線化 | pipeline |
