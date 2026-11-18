# CPU設計

有了指令集和算術單元，就能把一顆 processor 拼起來。這章先補完浮點乘法，再用五個步驟設計 MIPS 的 single-cycle datapath：寫出每個指令的 RTL、挑元件、依序接上 fetch、R-type、load／store、beq、jump 的路徑，再設計 control（main control 的 truth table、ALUOp 與 ALU control）。最後比較 single-cycle、多週期（FSM）與 pipeline 的優缺點，為下一章鋪路。考試常考各指令的 control signal 設定（lw／sw／beq／add），以及 single-cycle 的 clock 為什麼被最慢的 lw 拖住。

## 學完這章要會
- 執行浮點乘法：exponent 相加減 bias、significand 相乘、正規化、捨入、決定 sign
- 說出指令執行的五個步驟，以及 combinational 與 state element、edge-triggered clocking
- 用 RTL 寫出 add、lw、sw、addi、beq、j 做的事，包含 sign extension 與 PC + 4
- 畫出 single-cycle datapath 的每條路徑，說明哪裡需要 mux（fan-in）
- 為 R-type、lw、sw、beq、j 填出 RegDst、ALUSrc、MemtoReg、RegWrite、MemRead、MemWrite、Branch、ALUOp、Jump
- 由 ALUOp 與 funct 推出 ALU control 的 truth table 與邏輯式
- 算各指令的 delay，說明 critical path 與 single-cycle clock 的浪費
- 比較 single-cycle、FSM（多週期）與 pipeline 的 clock、CPI 與限制

## Floating point 乘法

### 先用科學記號想

IEEE 754 single precision 把 32 bits 分成三段：1 個 sign、8 個 exponent、23 個 fraction，值是 `(−1)^S × 1.fraction × 2^(exponent − bias)`。同一串 0 和 1，當整數讀和當 floating point 讀，意思完全不同，所以加法、乘法的 hardware 也跟著不同。

先不管電腦，用國中的科學記號想：兩個「某數 × 10 的幾次方」相乘，**mantissa 相乘、exponent 相加**。

- 2.0×10³ × 3.0×10² = 6.0×10⁵
- 5.0×10³ × 4.0×10² = 20.0×10⁵：小數點前超過一位，不是 normalized form。小數點左移一位、exponent 加 1 → 2.0×10⁶。

### Biased exponent：相加後要減一次 bias

電腦裡的 exponent 不是直接存真正的值，而是存「真正的 exponent + bias」，叫 biased representation。single precision 的 bias 是 127。

> **例題** exponent 用 4 bits、bias = 8，計算 7 + (−3)。

```
真正的 exponent      存起來的值 (加 bias 8)
      7          →   7 + 8 = 15 = 1111
     −3          →  −3 + 8 =  5 = 0101

直接把存的值相加：15 + 5 = 20
正確答案：7 + (−3) = 4，應存成 4 + 8 = 12
多出來的 8：兩個數各加了一次 bias，相加後等於加了兩次
修正：20 − 8 = 12 ✓
```

> **陷阱** 兩個 biased exponent 相加後，一定要再減一次 bias。這一步最容易忘。

### 完整步驟

1. exponent 相加，再減一次 bias。
2. mantissa（significand）相乘。
3. normalize（小數點前不只一位就右移並調整 exponent）。
4. rounding 到可存的位數；round 完可能又不是 normalized，第 3、4 步可能要重複。
5. 設定 sign：sign 和 magnitude 分開存，大小照乘，sign = S₁ XOR S₂（同號得正、異號得負）。

| S₁ | S₂ | S₁ XOR S₂ | 結果 |
|---|---|---|---|
| 0 | 0 | 0 | 正 × 正 = 正 |
| 0 | 1 | 1 | 正 × 負 = 負 |
| 1 | 0 | 1 | 負 × 正 = 負 |
| 1 | 1 | 0 | 負 × 負 = 正 |

### 例題：0.5 × (−0.4375)

> **例題** 用 4 位有效 binary 數：A = 1.000₂ × 2⁻¹（= 0.5），B = −1.110₂ × 2⁻²（= −0.4375），求 A × B。

```
① exponent
   真正值：  −1 + (−2) = −3
   存的值：  (−1+127) + (−2+127) = 126 + 125 = 251
             0111 1110 + 0111 1101 = 1111 1011 (251)
   減 bias： 251 − 127 = 124 = 0111 1100 = −3 + 127 ✓

② mantissa 相乘
        1.000
      × 1.110
      -------
     1.110000      (1000 × 1110 = 1110000，小數點後 3+3 = 6 位)

③ normalize：小數點前只有一個 1，已經 normalized，不用調整
④ round 到 4 位：1.110
⑤ sign：0 XOR 1 = 1 → 負

答案：−1.110₂ × 2⁻³ = −(1 + 0.5 + 0.25) × 1/8 = −1.75/8 = −0.21875
驗算：0.5 × (−0.4375) = −0.21875 ✓

存成 single precision：
   S = 1 | exponent = 0111 1100 | fraction = 1100 0000 0000 0000 0000 000
```

## Floating point 的硬體：Coprocessor 1

主 CPU 裡有 ALU、乘法器、除法器，但它們都是給整數用的。floating point 的加、乘需要很多 hardware（對齊、相加、normalize、round……），不是幾個 full adder 搞得定，所以交給另一顆 processor：**Coprocessor 1**。

- 歷史：最早的 x86 沒有 floating point 硬體，只能用 software 拿整數指令慢慢模擬（emulate）；後來為了加快，才加上 floating point coprocessor。x86 的 floating point／multimedia 指令也隨時間一直加上去。
- Coprocessor 1 有自己的 register file（`$f0`～`$f31`）和自己的運算單元，跟主 CPU 分開。
- 硬體不同，指令也要分開：寫 `add` 到底是誰的加？所以 floating point 指令後面帶 `.s`（single precision）或 `.d`（double precision）。
- register 名稱也看得出來：`$f0`、`$f1` 是 coprocessor 的；寫 `$t0` 這種，就是主 CPU 的 register。
- double precision 一個數 64 bits，一個 register 只有 32 bits，所以用一對：`$f0`＋`$f1` 當一個、`$f2`＋`$f3` 當另一個。
- load／store 要分：一般的 `lw`、`sw` 是主 CPU 的；搬進／搬出 coprocessor 1 的 register 用 `lwc1`、`swc1`（c1 = coprocessor 1）。
- 主 CPU 與 coprocessor 之間搬資料用 move：`mfc1`（move from coprocessor 1）、`mtc1`（move to coprocessor 1）。

（示意）指令寫法：

```asm
lwc1  $f2, 0($s0)       # 從 memory 載入 single precision 到 $f2
lwc1  $f4, 4($s0)
add.s $f0, $f2, $f4     # single precision 加法：$f0 = $f2 + $f4
mul.d $f6, $f8, $f10    # double precision：$f6/$f7、$f8/$f9、$f10/$f11 各是一對
swc1  $f0, 8($s0)       # 存回 memory
mfc1  $t0, $f0          # 把 $f0 的 32 bits 搬到主 CPU 的 $t0
mtc1  $t1, $f12         # 把 $t1 搬進 coprocessor 1 的 $f12
```

## 同一串 bits，不同解釋

同樣 32 個 bits 可以有不同的解釋，解釋不同，需要的 hardware 就不同。

```
1000 1100 0000 1000 0000 0000 0000 0100   (0x8C080004)

① two's complement 整數： −1945632764

② MIPS 指令：
   op     rs     rt     immediate
   100011 00000  01000  0000 0000 0000 0100
   35     0      8      4
   35 = lw，rt = 8 = $t0 → lw $t0, 4($zero)

③ single precision floating point：
   S = 1 | exponent = 0001 1000 = 24 | fraction = 000 1000 0000 0000 0000 0100
   值 = −1.0625… × 2^(24−127) = −1.0625… × 2⁻¹⁰³ ≈ −1.05×10⁻³¹（非常小的負數）
```

- 當整數相加：一個 ripple-carry 或 carry-lookahead adder 就好。
- 當 floating point 相加：要對齊 exponent、相加、normalize、round 一大串。

> **觀念** 資訊的意義看你怎麼解釋。先決定解釋（表示法），再照著解釋去設計 hardware。instruction set 可以支援各種表示法。

## Range 與 precision 有限：結合律失效

bits 數目有限：32 個不夠換 64 個，但 64 個還是有極限，所以不論用哪種表示法，**range（能表示多大）和 precision（能多精確）一定有限**。

有限的後果之一：floating point 加法沒有 associativity（結合律）。

> **例題** x = −1.5×10³⁸，y = 1.5×10³⁸，z = 1.0。比較 (x + y) + z 與 x + (y + z)。

```
(x + y) + z：
   x + y = −1.5×10³⁸ + 1.5×10³⁸ = 0.0
   0.0 + z = 1.0
   結果 1.0

x + (y + z)：
   y + z = 1.5×10³⁸ + 1.0 → y 已大到極限，加 1.0 表示不出差別 → 1.5×10³⁸（1.0 被吃掉）
   x + 1.5×10³⁸ = 0.0
   結果 0.0
```

> **陷阱** floating point 的 (x+y)+z 不一定等於 x+(y+z)：很大的數加 1.0，1.0 會被「吃掉」。

- parallel programming 要特別小心：一連串加法分給不同 processor，誰先加、誰後加不固定，結果可能不同、難以預測。
- 誰在乎這點誤差？日常帳戶少 0.002 分沒人在乎，但科學運算非常依賴 floating point。Intel Pentium 曾因 floating point 除法的 bug 而回收。

## 乘除 2 的次方用 shift

要乘或除的是 2ⁱ，就不要真的做乘除，用 shift：

```
5 × 4 = 5 × 2²  → 左移 2 位
0000 0101 (5)  →  0001 0100 (20)
```

乘法、除法要一個 bit 一個 bit 做 iteration，花 hardware 又花時間；barrel shifter 一個 clock cycle 就 shift 完。

### Signed shift 要補 sign bit

shift 分 signed 和 unsigned。右移 signed 數時，空出的位置要補 sign bit：

```
−8 = 1111 1000，右移 1 位想得到 −4
補 sign bit 1： 1111 1100 = −4   ✓
補 0：          0111 1100 = 124  ✗
```

### Sign extension

把位數變多、但表示同一個數：**正數前面補 0、負數前面補 1**（也就是複製 sign bit）。

```
4 bits 1010 (−6)  → 8 bits 1111 1010 (仍是 −6)
4 bits 0101 (5)   → 8 bits 0000 0101 (仍是 5)
```

這個觀念在 `lw` 算位址時馬上會再用到。

## Make the common case fast

- instruction set 支援各種表示法，bits 怎麼解釋由設計者定；定好再設計加減乘除的 hardware。不管哪種表示法，range 和 precision 都有限。
- 對設計 processor 很重要的觀察：指令設計了一大堆，真正常用的只有一小部分，約 54 個。用 SPEC benchmark 測，這些常用指令涵蓋 SPEC integer 的全部、SPEC floating point 的 97%。
- trade-off：要做很便宜的 processor，少用的指令乾脆不做，需要時用 software emulate；要加速，就加速最常用的那些——同樣代價，整體跑更快。這叫 **make the common case fast**。
- 實例：常要 decode 的指令給小而快的 decoder；不常用的給大一點、但省電的 decoder。

## 設計一顆 processor：為什麼先做 single cycle

前面學了 instruction set 的 trade-off，也學了 adder、ALU 等運算元件，現在把它們組成真正的 CPU。只實作幾個代表性的指令，但方法學會了就能類推出一整顆 processor。

- **single cycle**：每個 instruction 都在一個 clock cycle 內做完。問題是指令有長有短，`lw`、`sw` 要等 memory 很慢；cycle 要等最長的指令，短的只好乾等。所以不實際，但能教會基本方法。
- 下一步是 **pipeline**：把指令切成一階一階的 stage，現在的 processor 都這樣做。
- ISA 像一本說明書：規定 CPU 認識哪些指令，但沒規定內部要怎麼設計才快。所以有三代設計：單週期（single cycle）→ 多週期（multi-cycle，用 FSM 控制）→ pipeline，每一代都在解決上一代的根本問題。

> **重點** 讀 datapath 圖的方法：每個元件、每條線都搞清楚從哪來、代表什麼、為什麼要有。全懂了就不用背。

## CPU 效能：IC × CPI × cycle time

所有 general-purpose CPU 都在做同一件事：從 memory 拿指令（fetch）→ 看懂它（decode）→ 執行（execute）→ 拿下一個，一直重複。

```
CPU time = Instruction Count × CPI × Clock Cycle Time
```

| 因素 | 由誰決定 |
|---|---|
| Instruction count (IC) | instruction set（例如有沒有乘法指令）、compiler（翻得聰不聰明、有沒有 optimize） |
| CPI (cycles per instruction) | hardware（例如加法器設計得快還是簡單，做加法要的 cycle 數就不同） |
| Clock cycle time | hardware |

single cycle：每個指令一個 cycle，CPI = 1，跑 100 個指令就是 100 個 cycles。但 clock period 很長——要等最長的指令做完 clock 才能變——所以不見得 efficient。

## 一個指令怎麼執行

### PC 與 fetch

程式寫好後，每個指令第一件事是 **instruction fetch**：從 memory 拿出來。去哪裡拿？看 **program counter（PC）**。

- PC 是 32-bit register，裡面放一個位址，告訴你去 instruction memory 的哪裡拿指令。
- 一個接一個執行時，下一個在 PC + 4（一個指令 4 bytes，例如 1000 → 1004）；要跳到 2000，就把 PC 改成 2000。

### Decode、讀 register、執行、更新 PC

1. **Decode**：拿到 32 bits，一開始不知道是 R、I 還是 J，就三種解釋一起做，等 opcode 看完才知道是哪種。
2. 去 register file 讀運算元：有的讀 rs、rt 兩個；有的只讀 rs，因為 rt 是要寫入的 destination。
3. ALU 照指令運算；如果是 `lw`、`sw`，還要 access data memory。
4. 更新 PC：一般是 PC + 4；branch 或 jump 的 target address 在過程中就要先算好。
5. 下一輪再 fetch、decode、execute……這就是程式執行的全部。

### 指令執行的五個步驟

幾乎每道指令都能拆成五步：

| 步驟 | 做什麼 |
|---|---|
| ① Fetch | 照 PC 抓指令，PC 指向下一道（MIPS 一道指令 4 bytes，所以是 PC + 4，不是「加一」） |
| ② Decode | 像翻譯官：把一串 0 和 1 翻成「這是加法，用 R1 和 R2」 |
| ③ Execute | 把運算元送進 ALU 真正運算；跳躍指令在這一步算出目標位址 |
| ④ Memory Access | 只有 load、store 在這步做事；`add` 這種純運算跳過 |
| ⑤ Write Back | 結果寫回目標暫存器，例如 `add R0, R1, R2` 把和存進 R0 |

## 要實作的指令子集與 R／I／J format

實作的指令很少，但三大類都齊了（跟 memory 溝通、做運算、改變 control sequence）：

| 類別 | 指令 | format |
|---|---|---|
| memory reference | `lw`（memory → register）、`sw`（register → memory） | I |
| arithmetic-logical | `add`、`sub`、`and`、`or`、`slt` | R |
| control | `beq`（相等就跳）、`j`（直接跳） | I、J |

MIPS 只有三種 instruction format，每種欄位加起來都是 32 bits。只有一種 format 最好設計，不得已才妥協成三種；自己設計過 hardware 就懂：**format 越少、越一致越好**。

### 各欄位

```
R-type:  | op (6) | rs (5) | rt (5) | rd (5) | shamt (5) | funct (6) |
          31–26    25–21    20–16    15–11     10–6        5–0

I-type:  | op (6) | rs (5) | rt (5) |       immediate (16)          |
          31–26    25–21    20–16              15–0

J-type:  | op (6) |                 target (26)                    |
          31–26                        25–0
```

- **rs、rt、rd 為什麼 5 bits**：register file 有 32 個 register，要指定第幾個，2⁵ = 32。
- **shamt**（shift amount）：資料 32 bits，shift 0～31 位共 32 種，5 bits 剛好。
- **funct**：所有 R-type 的 opcode 都是 000000，加減怎麼分？靠 funct：`add` = 100000、`sub` = 100010。
- **I-type 的 16-bit immediate** 有三種用途：
  - load／store 的 offset：base（rs 的內容）+ offset = memory 位址。
  - constant，例如 `addi`；這 16 bits 是 two's complement，可正可負。
  - `beq` 的 offset：概念一樣，只是加在 PC 上，決定跳去哪。
- **J-type 的 26-bit target**：指令以 4 bytes 為單位，後面補兩個 0（28 bits），前面再接 PC 的前 4 bits，湊成 32 bits。

### 哪些指令用哪個 format

- R-type：`add`、`sub`、`and`、`or` 等；rs、rt 當 source，rd 當 destination，做什麼由 funct 決定。
- I-type 三類一定要記：load／store、immediate 運算、branch。三類都用 rs、rt、immediate，但解釋不同，最容易混。
- J-type：jump，直接跳過去，只有這一個。

## Datapath 概觀：共用的路要靠 mux

不管多複雜，形狀都差不多：

1. PC 放一個 32-bit 位址，例如 1000，就去 instruction memory 的 1000 拿指令；要跳到 10000，PC 就放 10000，下一次就去 10000 拿。
2. 指令在圖上只畫一條線，其實是 32 bits：前 6 bits 一定是 opcode，後面是 rs、rt、rd 等欄位。
3. 三種 format 中 rs、rt 永遠在同樣的位置，所以這兩個 5-bit 地址可以馬上拿去讀 register file。
4. 讀出來交給 ALU。R-type 算完直接寫回 register file，結束。
5. `lw`、`sw`：ALU 算出的是 memory 位址，還要去 data memory；`lw` 讀到的資料再放回 register。

MIPS 是 **load-store machine**：資料要先 load 進 register 才能算，算完再 store 回去；搬資料和運算不混在一起。

問題：寫回 register 的入口只有一個，ALU 的結果要走，memory 讀出的資料也要走。

> **比喻** 兩台車搶同一個高速公路入口。解法是在入口放一個 multiplexer（mux）：2-to-1 或 4-to-1 的 mux 決定這個 cycle 讓誰上高速公路。

mux 一定有一個 control signal 決定選哪邊；這個訊號從 opcode decode 出來——知道是哪個指令，就知道誰該優先。完成的 datapath 元件還是那些，只是多了好幾個 mux，各由 control signal 控制，共用的路就不會打架。

## 基本元件：combinational 與 state element

### Wire、bus、information

- signal 在 wire 上：low = 0、high = 1。
- data 常是 32 bits，圖上不畫 32 條線，而是畫一條線再打一條斜線，表示這是一組 bus。
- 線上跑的 0101 就是 information，可能是 two's complement 整數，也可能是 floating point，看你怎麼表示。

### 兩種 hardware

- **Combinational element**：input 一變 output 就變，例如 AND gate、adder、ALU、mux。3 + 4 換成 5 + 4，output 馬上從 7 變 9。
- **Sequential（state）element**：負責存。時間切成一個個 clock cycle，每個 period 做一件事，做完的結果存下來給下一個 cycle 用。存 data 的 state element 就是 register，裡面是一排 flip-flop。

### Level sensitive 與 edge triggered

| 方式 | 何時寫入 |
|---|---|
| level sensitive | 只要 clock 是 high，整段時間都可以寫進去 |
| edge triggered | 只有 clock transition 的那一瞬間（rising edge：0 → 1）才寫 |

edge triggered：兩個 edge 之間，input D 怎麼變都沒用；output Q 只在 edge 那一刻抓 D 的值。datapath 常用 edge-triggered 元件，以避免 racing 這類 timing 問題。

### Write enable

要寫進去，不只 clock 要 transition，**Write（write enable）還要等於 1**。

```
clock edge:   ↑      ↑      ↑      ↑
Write:        1      0      1      0
結果:        寫入   不變   寫入   不變
```

為什麼重要？register file、data memory 的 input 接到很多地方、一直在變，但不是每個指令都要寫，不能每個 clock 都寫。所以它們一定有 Write 這個 control signal，由 controller 決定：要寫設 1，不寫設 0。

## Clocking methodology 與 critical path

```
[state element] → [combinational logic] → [state element]
      ↑ clock edge：新 data 送出             ↑ 下一個 clock edge：存入結果
```

- clock transition 時新 data 進來，combinational logic 只要 input 一變就開始算。
- 算要時間：訊號要經過一個個 gate，這段叫 **path delay**，走完才算完成。
- path delay 一定要小於 clock period；太長的話，下一個 clock 已經 transition 了 output 才到，就 latch 不到正確資料。
- 不同 input 組合走的路有快有慢，要用最長的那條——**critical path**——決定 clock period。（示意）三條 path 中最長的是 5.5 ns，clock period 就至少 5.5 ns。
- 起點和終點也可以是同一個 state element：每個 clock 來，它就換成新算好的值。

## 設計 processor 的五個步驟

1. **分析 instruction set**：不只要知道有哪些指令，還要知道每個的 format，decode 時才知道 32 bits 怎麼解釋、要做什麼。
2. **選出 datapath 需要的元件**。
3. **組合（assemble）datapath**：一個指令一個指令接起來；很多指令有共同的部分，整合成一個 datapath。
4. **決定每個指令的 control signal**：同一個 datapath 為什麼能做不同指令？靠 control。
5. **合成 control logic**。

> **比喻** 像炒菜：連要炒麻婆豆腐還是牛肉都不知道，怎麼炒？所以第一步一定是分析指令。

以下先做前三步（datapath），第四、五步（control）在下一部分。

## RTL：把每個指令做什麼寫清楚

RTL（logical register transfer）用 register 之間的搬移來描述指令。把每個指令的動作寫出來，就能照著設計 hardware。記號：`R[x]` = 第 x 個 register 的內容，`MEM[a]` = memory 位址 a 的內容，`←` = 寫入，`‖` = concatenate。

### add（R-type）

```
欄位：op(6) rs(5) rt(5) rd(5) shamt(5) funct(6)
R[rd] ← R[rs] + R[rt]
PC    ← PC + 4
```

rs、rt 像 index，去 register file 拿出 R[rs]、R[rt]，相加後放進 R[rd]；同時 PC ← PC + 4 準備下一個指令。例如第 rs、第 rt 個 register 拿出 7 和 5，相加，把 12 放回第 rd 個。sub、and、or 同理，只是運算不同。

### lw（I-type）

```
欄位：op(6) rs(5) rt(5) immediate(16)
addr  ← R[rs] + SignExt(imm16)
R[rt] ← MEM[addr]
PC    ← PC + 4
```

- 16 bits 解釋成 offset；base 在 rs 指定的 register（base register）。
- ALU 做 32-bit 運算，offset 只有 16 bits，而且可正可負，寬度不同不能直接加，要先 **sign extension** 成 32 bits。
- hardware 一開始不知道是哪種 type，就每種解釋都做、每個欄位都拿出來；opcode 揭曉後，用不到的不理它。

為什麼不能直接前面補 0：

```
4-bit 1011 = −5
補 0：0000 1011 = 11   ✗
sign extension（正數補 0、負數補 1）：
  0101 → 0000 0101 = 5    ✓
  1011 → 1111 1011 = −5   ✓
```

> **例題** base R[rs] = 1000，offset = −4，求 `lw` 的位址。

```
offset −4 (16 bits)   = 1111 1111 1111 1100
SignExt → 32 bits     = 1111 1111 1111 1111 1111 1111 1111 1100 (−4)
addr = 1000 + (−4)    = 996
R[rt] ← MEM[996]
```

> **陷阱** offset 是 signed：sign extension 不是一律補 0，負數要補 1。

### sw

```
MEM[R[rs] + SignExt(imm16)] ← R[rt]
PC ← PC + 4
```

同樣的 format，方向相反：把 rt 的內容放到 memory，位址一樣是 R[rs] + sign-extended offset。PC + 4 每個指令都逃不掉。

### addi

```
R[rt] ← R[rs] + SignExt(imm16)
PC    ← PC + 4
```

constant 有正有負，所以 16 bits 是 signed，範圍 −32768～32767，immediate 也一定要 sign extension。

```
−50 (16 bits) = 1111 1111 1100 1110
SignExt → 1111 1111 1111 1111 1111 1111 1100 1110 = −50   ✓
補 0    → 0000 0000 0000 0000 1111 1111 1100 1110 = 65486 ✗
```

### beq

```
if (R[rs] == R[rt])  PC ← PC + 4 + (SignExt(imm16) ‖ 00)
else                 PC ← PC + 4
```

- 把 rs、rt 拿出來比，相等才跳。
- hardware 一開始不知道它是不是 branch，所以 always 先做 PC + 4；跳也是以 PC + 4 為基準。
- target = offset 做 sign extension、後面接兩個 0（即 ×4），再加 PC + 4。
- target 可以先算好放著，到底跳不跳，等比較結果出來再決定。

### ‖ 是 concatenate

> **陷阱** RTL 裡的雙直線 `‖` 是 concatenate（把兩串 bits 接起來），不是 OR。

offset ‖ 00 就是在 offset 後面補兩個 0。為什麼？一個指令 4 bytes，word address 最後兩 bits 一定是 00，不必浪費 bits 存，用的時候補回來。

```
offset = 3 = 11₂
11 ‖ 00 = 1100₂ = 12 = 3 × 4
```

## 需要哪些 component

| 元件 | 用途 |
|---|---|
| register file | 存 32 個 register 的內容，每個 32 bits |
| program counter (PC) | 32 bits，記下一個要執行的指令位址；memory space 是 2³² bytes，位址要 32 bits 才指得到每一格 |
| +4 adder | 每次 PC + 4，專門做這件事的簡單加法器 |
| ALU | 做加減等運算 |
| sign extender | 16 bits → 32 bits |
| instruction memory | 放指令 |
| data memory | lw／sw 存取資料 |
| branch adder | PC + 4 加上 branch offset，算 target address |

- 有的指令用不到 sign extension，但 hardware 不知道，就 always 先做，用不用由 control 決定——就像設計 ALU 時加、and、or 全部一起算，最後用 mux 選要哪個結果。
- combinational components（adder、mux、ALU）進出都是 32 bits，圖上那條斜線代表其實有 32 條線。

### Register：一定要有 write enable

sequential 元件有兩類：PC 和 register。一個 register 就像 32 個 D flip-flop 排在一起，存 32 bits；它一定要有 write enable，因為不是每個 cycle 都要寫。

### Register file：兩個 read port、一個 write port

```
           RA (5) ──┐                ┌── busA (32)
           RB (5) ──┤                ├── busB (32)
           RW (5) ──┤  Register File │
         busW (32) ─┤  32 × 32-bit   │
            WrEn  ──┤                │
             clk  ──┘
```

- 每次要讀兩個 operand（rs、rt），所以要兩個地址 RA、RB，也就是兩個 read port。若一個 cycle 只讀一個，一個 port 就夠；但 port 越多 hardware 越貴，這是 trade-off。
- 目標：**每個 cycle 讀兩個、寫一個**。cycle 一開始給地址就讀出來；cycle 結束的 transition 才寫進去。
- 三個地址各 5 bits（2⁵ = 32 選一）：讀的 RA、RB，寫的 RW。
- 例：RA = 3、RB = 8 → 第 3、第 8 個 register 的內容分別放上 busA、busB。
- 寫：RW = 5，資料從 busW 進去，第 5 個 register 的內容就變了。
- **WrEn**：有時只讀不寫，靠它控制這個 cycle 准不准寫；clock edge 且 WrEn = 1 才寫（這裡的圖用 negative edge）。

### Memory element：只有一個 address

```
  Address ──┐            ┌── Data Out (32)
  Data In ──┤   Memory   │
    WrEn  ──┤            │
     clk  ──┘
```

- 只有一個 address：memory 一次只做一件事，不是 read 就是 write，address 共用就好。
- 一個 Data In、一個 Data Out。
- 只要給 address，它 always 把那格的資料讀出來；只有 WrEn = 1（write）時，才把 Data In 寫進 address 指的那格。

## 組 datapath ①：Fetch

每個指令都要做的事：fetch，然後 PC + 4。

```
        ┌────────────── +4 adder ──── PC+4 ──┐
        │                                    │
 ┌────┐ │   ┌───────────────────┐            │
 │ PC ├─┴──►│ Read Address      │            │
 └─▲──┘     │ Instruction Memory├─► Instruction[31:0]
   │        └───────────────────┘            │
   └───────────── (clock edge 時才寫回) ◄────┘
```

1. PC 的值接到 instruction memory 的 read address，給地址它就把 32-bit 指令讀出來，接著才 decode。
2. 同時用一個加法器算 PC + 4。
3. 算好的 PC + 4 **不會**馬上寫進 PC，只是算好在那裡等；要等這個 clock period 結束、edge trigger 時才寫進 PC。

> **觀念** 問：PC + 4 算好了，為什麼不馬上寫回？答：PC 一變，instruction memory 就吐出另一個指令，前一個還沒做完，就亂掉了。

## 組 datapath ②：R-type

```
Instruction[25:21] rs ──► RA          busA ──► ALU input A
Instruction[20:16] rt ──► RB          busB ──► ALU input B
Instruction[15:11] rd ──► RW                    │ ALUctr
                          busW ◄────────────────┘ ALU result
                          RegWr
```

- 從固定位置拿出 op、rs、rt、rd。
- rs → 第一個 read address RA；rt → 第二個 read address RB；rd 是要寫的地方 → write address RW。
- 兩個 operand 從 busA、busB 出來進 ALU：`R[rd] ← R[rs] op R[rt]`。
- ALU 做加還是減，由 control signal **ALUctr** 決定（怎麼產生在下一部分）。
- ALU output 接 busW，寫進 rd 指定的 register。
- 寫不寫由 **RegWr** 決定：R-type 要寫，RegWr = 1；別的指令不一定，所以這也是 control signal。

## 組 datapath ③：Load／store

format 是 op、rs、rt、16-bit immediate，跟 R-type 比沒有 rd。

```
rs ──► RA ── busA ─────────────────► ALU A
rt ──► RB ── busB ──────────────────────────────────► Data Memory: Write Data (sw)
imm16 ──► Sign Extend ── 32 bits ──► ALU B
                                      ALU result ──► Data Memory: Address
                                      Data Memory: Read Data ──► busW (lw)
rt ──► RW (lw 的 destination)
```

1. rs、rt 一樣接 RA、RB 去讀。
2. immediate 做 sign extension，跟 rs 讀出的 base 一起進 ALU 相加。
3. ALU 算出位址，接到 data memory 的 address。
4. **lw**：讀出的 data 接到 busW 寫回 register file；寫到 rt，所以 rt 也要接到 RW（R-type 接的是 rd）。
5. **sw**：讀出 rt，從 busB 接到 data memory 的 write data。

> **陷阱** load／store 的 base 永遠在 rs，位址永遠是 R[rs] + SignExt(offset)。rt 的角色不同：`lw` 的 rt 是 destination（資料要放哪），`sw` 的 rt 是 source（要把它的內容存進 memory）。

## Fan-out 可以，fan-in 要用 mux

指令剛讀出來時，根本不知道是 R-type、load 還是 store，所以所有可能都先接好。format 盡量一致（rs、rt 位置都一樣），這些地方就不用做選擇。但有一個地方不一樣：寫入的地址，R-type 給 rd，load 給 rt。

- **fan-out**：一個 gate 的 output 同時接到好幾個 input，完全沒問題。
- **一個 input 同時接兩個 output**：不行，兩個訊號會打架，不知道聽誰的。前面要放一個 select 的元件，也就是 mux。

```
rt ──┐
     ├─► 2-to-1 mux ──► RW (write address)
rd ──┘        ▲
            RegDst
```

> **陷阱** fan-out 沒問題；同一個 input 有兩個來源時一定要加 mux。

## 合併 R-type 與 load／store

- ALU 第一個 operand 永遠是 rs，只有一種可能，直接接——format 一致的好處。
- ALU 第二個 operand 有兩個來源：R-type 來自 rt（busB），load／store 來自 sign extension → 加一個 2-to-1 mux，control signal 叫 **ALUSrc**。
- 寫回 register file 的 data 有兩個來源：ALU 結果，或 load 從 memory 讀出的資料 → 再一個 2-to-1 mux，control signal 叫 **MemtoReg**。
- write register 的地址 rt／rd → 2-to-1 mux，control signal 叫 **RegDst**（register destination）。

| control signal | = 0 | = 1 |
|---|---|---|
| ALUSrc | ALU 第二運算元來自 register file（busB） | 來自 sign extension（immediate） |
| MemtoReg | 寫回 ALU 結果 | 寫回 data memory 讀出的資料 |
| RegDst | write address = rt | write address = rd |

### 問答：R-type 與 load 怎麼設

- 問：R-type 的 ALUSrc？答：第二個 operand 從 register file 來 → 0。
- 問：R-type 的 MemtoReg？答：寫回的是 ALU 結果 → 0。
- 問：load 的 ALUSrc？答：第二個 operand 是 sign extension 來的 offset → 1。
- 問：load 的 MemtoReg？答：寫回的是 memory 讀出的資料 → 1。
- 問：write register 前面要不要一個 2-to-1 mux？答：要。load 寫 rt、R-type 寫 rd，需要 mux 決定 destination（RegDst）。

| 指令 | RegDst | ALUSrc | MemtoReg |
|---|---|---|---|
| R-type | 1（rd） | 0 | 0 |
| lw | 0（rt） | 1 | 1 |

## 加入 beq

beq 也是 I-type；加入後 R-type、load/store、branch 三大類就齊了。beq 比較 rs 和 rt 是否 equal，相等就跳到新位址，不走 PC + 4。

1. **比較**：用 ALU 做減法。R[rs] − R[rt] ≠ 0 → not equal；= 0 → ALU 的 **Zero** 輸出為 1（例如 7 − 7 = 0）。
2. **算 target**：PC + 4 反正已經先算好，以它為基準。ALU 已經拿去比較了，所以要**另一個加法器**專門算 target：16 bits 先 sign extend、再左移兩位（×4），加上 PC + 4。target 一定要先算好，不能等確定要跳才開始算，那就來不及了。
3. **選下一個 PC**：再一個 2-to-1 mux，在 PC + 4 和 target 之間選；equal（Zero = 1）就選 target，否則選 PC + 4。

> **例題** PC = 1000，beq 的 offset = 3，相等時跳去哪？

```
PC + 4               = 1004
SignExt(3) << 2      = 3 × 4 = 12
target               = 1004 + 12 = 1016
Zero = 1 → next PC = 1016；Zero = 0 → next PC = 1004
```

> **觀念** control signal 大多只看 instruction 就能決定，但 branch 例外：要比對兩個 register 是否 equal，這在 datapath 裡做，所以 datapath 也要把結果（Zero）交給 control，一起決定下一個 PC。

## 完整的 single-cycle datapath

```
【次序（next PC）部分】
PC ──► Instruction Memory (Read Address)
PC ──► +4 adder ──► PC+4 ──┬──────────────────────────► next-PC mux 輸入 0
                           └──► branch adder ──► target ──► next-PC mux 輸入 1
imm16 ──► Sign Extend ──► <<2 ──► branch adder
next-PC mux ──► PC（clock edge 時寫入）；選 1 的條件：是 beq 且 Zero = 1

【資料部分】
Instruction[31:26] op ──► Control（產生各 control signal）
Instruction[25:21] rs ──► RA
Instruction[20:16] rt ──┬► RB
                        └► RegDst mux 輸入 0   (fan-out)
Instruction[15:11] rd ──► RegDst mux 輸入 1
RegDst mux ──► RW
Instruction[15:0] imm16 ──► Sign Extend ──┬► ALUSrc mux 輸入 1
                                          └► <<2（branch target）
busA ──────────────────────────► ALU 輸入 A
busB ──┬► ALUSrc mux 輸入 0 ──► ALU 輸入 B        （ALU 做什麼由 ALUctr 控制）
       └► Data Memory Write Data（sw）
ALU result ──┬► Data Memory Address
             └► MemtoReg mux 輸入 0
ALU Zero ──► next PC 的選擇（beq）
Data Memory Read Data ──► MemtoReg mux 輸入 1
MemtoReg mux ──► busW ──► Register File（RegWr = 1 且 clock edge 才寫）
```

逐條看線的理由：

- **控制「次序」的部分**：PC 讀出來，經 +4 adder 得到下一個 sequential address；beq 時 sign extension 的值左移兩位、加上 PC + 4 得 branch target；mux 決定跳不跳，選出的就是下一個指令位址，寫回 PC。
- **rs、rt** 接兩個讀地址；rt 也可能是 destination，所以多拉一條 fan-out 出去。
- **RegDst mux**：寫入地址可能是 rt 或 rd。
- **ALUSrc mux**：ALU 第一個 operand 永遠是 rs；第二個可能來自 register file 或 sign extension。
- **MemtoReg mux**：R-type 的 ALU 結果直接寫回；load 的 ALU 算的是位址，要讀 memory 再寫回。
- control 決定每個控制點（RegDst、ALUSrc、MemtoReg、RegWr、ALUctr……）的值，datapath 才會執行想要的指令。

> **重點** 這張圖最重要：學會了就已經會一半的 pipeline。把每條線的原因找出來，就不用背。

### 例題：add 在完整 datapath 上走一遍

> **例題** `add $t1, $t2, $t3`，`$t2` = 7、`$t3` = 5，追蹤資料流。

1. PC 送出位址，去 instruction memory 拿出指令；rs（`$t2`）、rt（`$t3`）、rd（`$t1`）欄位出來，rs、rt 去 access register file。
2. 同時 PC + 4 算好放著等。
3. busA = 7、busB = 5。**ALUSrc = 0**，第二個 operand 從 register file 來。
4. ALU 算出 12。ALU 結果也接到 data memory 的 address（fan-out），memory 看到 input 變也會去讀——讀就讀，我們不拿它的值。
5. **MemtoReg = 0**，mux 選 ALU 這條路，12 放上 busW；**RegDst = 1**，write address = rd。
6. 結果其實早就算好在那裡等；clock edge 一來，才「搭」一聲寫進 register file：`$t1` = 12，PC 也同時更新成 PC + 4。

## Single cycle 的 timing

### Clock period 要設成最長的 delay

clock transition 時 data available，開始運算；全部算完，下一個 transition 才可以來，代表新的 cycle 開始。所以 clock period 一定要設成最長那條 path 的 delay；不然 transition 時還有 path 沒算完，就 latch 到錯的資料。

### R-type 的 register-to-register timing

從新的 clock edge 開始（這裡的圖用 negative edge）：

1. **Clock-to-Q delay**：trigger 後，PC 的 output 要一下子才出來（裡面是 cross-coupled 的 NOR／NAND gate 之類的電路），output 叫 Q，所以叫 clock-to-Q。
2. **Instruction memory access time**：PC 一出來就去讀 instruction memory，讀出來也要時間。
3. **Control decode delay**：指令出來，controller 要 decode，才知道是加還是 load、mux 設 0 還是 1。
4. **Register file access delay**：同時 rs、rt 的位置已經知道，趕快去讀 register file。
5. **ALU delay**：讀出來 ALU 再算；ALU 算完、data ready，clock 才可以 transition。

> **重點** 可以同時做的取較長者（control decode 與 register file access 並行）；一定要接續的要相加（register 讀完才能算 ALU）。

> **例題**（示意）clock-to-Q = 30 ps、instruction memory = 200 ps、control decode = 50 ps、register file = 100 ps、ALU = 200 ps，求 R-type 的 path delay。

```
clock-to-Q   IM access   max(decode 50, reg 100)   ALU
   30     +    200     +          100            + 200  = 530 ps
```

### Critical path：load 最長

beq、load、store、R-type 中，最長的是 **load**：前段和 R-type 一樣，但 ALU 只算出位址，還要 access data memory，讀完才寫回 register file。這條最長的 path 就是 critical path：

```
critical path (lw) = clock-to-Q
                   + instruction memory access
                   + register file access
                   + ALU
                   + data memory access
                   + setup time (register file write)
                   + clock skew
```

- **setup time**：clock transition 之前，data 必須先準備好、穩定一段時間；不能 clock 來了還在變。
- **clock skew**：clock 送到各處有先有後；為了不產生 racing，以最壞情況考量，把 clock 再拉長一點。

> **例題**（示意）沿用上面的數字，再加 data memory = 200 ps、setup time = 20 ps、clock skew = 10 ps，求 lw 的 critical path。

```
30 + 200 + 100 + 200 + 200 + 20 + 10 = 760 ps
（clkQ  IM   reg   ALU   DM  setup skew）
→ single cycle 的 clock period 至少 760 ps；R-type 只要 530 ps 也得等 760 ps
```

> **陷阱** clock period 要涵蓋 setup time 與 clock skew，不只是各單元 delay 的和。

## Control：決定 datapath 走哪條路

datapath 只是把「可以走的路」都接好；**control（控制）** 則依照現在執行的指令，決定這一次走哪一條。要決定的事情包括：

- PC 的來源從哪裡來？要跳還是不跳？
- register 要不要寫？
- destination 是 rt 還是 rd？
- ALU 的第二個 operand 從哪裡來？寫回的資料從 ALU 還是 memory 來？

這些全都是 **control signal（控制訊號）**：大多是 datapath 上那些 2-to-1 mux 的選擇訊號，以及 register file、memory 的 write／read enable。

- **controller（控制單元）** 讀進指令的 opcode，發出 control signal 去控制 datapath。
- datapath 也會回報資訊給 controller，例如 beq 讓 ALU 把兩數相減，結果為 0 就送出 **Zero**，告訴它「兩個一樣」，PC 的來源就要改。

> **觀念** datapath 告訴你有哪些路可以走；control 依照目前的 operation 決定這次走哪條。

control signal 的值之間沒有規律，所以 control logic 稱為 **random logic**；相對地，adder 每個 bit 的電路都長得一樣，稱為 **regular logic**。

## MIPS 的 format 一致，control 才簡單

看完 datapath 與 control 的設計，就能體會 MIPS 的 instruction set 為什麼設計得好（比 Intel x86 那種格式多變的指令集好處理）：

- **opcode 永遠在前 6 bits**：每次固定拿前 6 bits 就知道是什麼指令。若 opcode 位置不固定（可能是前 6 bits，也可能是前 8 bits），每個地方都要檢查，controller 就變得很複雜。
- **source register 位置固定**：rs 永遠在同一處、永遠是第一個 source（ALU 的第一個 operand 永遠是 rs，不需要 control）；第二個讀的一定是 rt，R-type、beq、sw 都讀 rt。
- **base register 永遠在 rs**；beq、lw、sw 的 offset（immediate）一定在後 16 bits。不論 immediate 拿去做 sign extension、算 PC-relative 位址，或做 immediate 運算，位置都一樣。
- 唯一不一致的地方是 **destination**：R-type 寫 rd，lw 寫 rt。這只要加一個 mux（RegDst）來選就好。
- ALU 的第二個 operand 可能是 rt，也可能是 sign extension 出來的 immediate，那裡也要一個 mux（ALUSrc）。

> **重點** 某個欄位「可能是這個、也可能是那個」，datapath 就得把兩邊都接上，再用 control 選。format 越不一致，需要的 mux 越多；format 越簡單、越一致，datapath 與 controller 就越容易合成。

## Controller：輸入 opcode，輸出 control signals

control signal 就是 datapath 圖上的那些控制點。會設計 datapath、再會設計 control，就會設計一顆 processor。

- **write enable**：register file 光給 address 不代表要寫，還要 `RegWrite = 1` 才寫。memory 也一樣，`MemWrite = 1` 才寫，否則只會被讀。
- controller 的 **input** 主要是 opcode（前 6 bits）：知道 opcode 就知道是哪個指令，也就知道每個訊號該設多少。
- controller 的 **output** 分別接到各個 mux 的 select input 與各個 enable。

單週期 datapath 上的 control signal（加入 jump 之後）：

| 訊號 | 控制什麼 | = 0 | = 1 |
|---|---|---|---|
| RegDst | 寫入 register 的編號 | rt（lw） | rd（R-type） |
| ALUSrc | ALU 第二個 operand | register file 讀出的 rt | sign-extended immediate |
| MemtoReg | 寫回 register 的資料 | ALU 結果 | data memory 讀出的值 |
| RegWrite | register file 寫入 | 不寫 | 寫 |
| MemRead | data memory 讀取 | 不讀 | 讀 |
| MemWrite | data memory 寫入 | 不寫 | 寫 |
| Branch | 是否為 branch 指令 | 否 | 是（再和 Zero 做 AND） |
| ALUOp（2 bits） | 告訴 ALU control 是哪一組 | 00 加、01 減、10 看 funct | |
| Jump | 下一個 PC 是否為 jump target | 否 | 是 |

## 兩個例外：PCSrc 要看 Zero、ALU 要看 funct

大部分 control signal 看 opcode 就能立刻決定，例如 destination 是 rt 還是 rd，一看 opcode 就知道。但有兩個不行：

### 例外一：PCSrc（下一個指令在哪）

opcode 只能告訴你「這是 branch」，但 branch 不一定會跳，還要看 ALU 把 rs、rt 相減是不是 0，是 0 才真的跳。所以 datapath 上有一個 AND gate：

```
PCSrc = Branch AND Zero
        ↑ controller 給     ↑ datapath（ALU）給
```

兩個都是 1，PCSrc 才是 1，PC 才選 branch target；否則選 PC + 4。

### 例外二：ALU 要做什麼 operation

ALU 的 control code（設計 ALU 時定好的）：

| ALU control | 運算 |
|---|---|
| 0000 | AND |
| 0001 | OR |
| 0010 | add |
| 0110 | subtract |
| 0111 | slt（set on less than） |

> **陷阱** 問：R-type 只看 opcode 能知道 ALU 要做什麼嗎？答：不行。R-type 的 opcode 全是 `000000`，要再看最後 6 bits 的 **funct** 欄位才知道是 add、sub、and、or 還是 slt。這是考過的題目。

不過 opcode 也不是沒用：

- lw、sw 一看就知道要做**加**（rs + sign-extended offset，算記憶體位址）。
- beq 一看就知道要做**減**（比較 rs、rt）。
- R-type 不知道，要看 funct。

所以 opcode 先做部分解碼，告訴你是哪一組，再加上 funct，才真正決定 ALU control。這就是**兩層的 controller（two-level control）**：

```
opcode (6 bits) ──→ [ main control ] ──→ 7 個 mux／enable 訊號（+ Jump）
                          │
                          └─ ALUOp (2 bits) ──┐
                                              ├→ [ ALU control ] ──→ 4-bit ALU control
instruction[5:0] = funct (6 bits) ────────────┘
```

## 逐一設定 control signals：add、lw、beq、sw

control logic 看起來 random，其實只要知道每個指令在 datapath 上怎麼走，truth table 就找得出來。做法：把每個指令沿 datapath 走一遍，每碰到一個 mux 或 enable，就問「這個指令要選哪條」。

### add（R-type）

1. Instruction fetch：從 instruction memory 取出指令。前 6 bits 送進 controller decode；rs 接 register file 的第一個讀地址、rt 接第二個；最後的 funct 接到 ALU control。
2. ALU 第一個 operand 永遠是 rs，不需要 control。第二個前面有 ALUSrc 這個 mux：add 的第二個 operand 從 rt 讀出來，選 register file 那條 → **ALUSrc = 0**。
3. 算完要寫回，碰到 MemtoReg 這個 mux：寫回的資料可能來自 memory，也可能來自 ALU。add 的結果來自 ALU → **MemtoReg = 0**。
4. 寫回時要告訴 register file 寫到哪裡：rt 還是 rd？add 的 destination 由 rd 指定 → **RegDst = 1**。
5. register file 每次都寫嗎？見下面的陷阱。add 要寫回 → **RegWrite = 1**。
6. 不讀寫 memory → **MemRead = 0、MemWrite = 0**。
7. PC 要選誰？一個是 PC + 4，一個是 branch target。add 不跳 → **Branch = 0**，**PCSrc = 0**（選 PC + 4）。
8. ALU 要看 funct 決定 → **ALUOp = 10**。

> **陷阱** register file 的 write data 一直在線上，clock 也一直會來；如果沒有 RegWrite 控制，每個 cycle 都會把線上的值寫進去。所以需要 RegWrite（register 的 write enable）。只有 R-type 和 lw 會寫 register；對照一下，beq 不寫回，所以 beq 的 RegWrite = 0。

### lw

1. Instruction fetch，接著做 ALU 運算。
2. ALU 第一個 source 是 rs（大家都一樣，不用 control）。第二個可能是 rt，也可能是 sign extension 來的 offset；lw 要 offset → **ALUSrc = 1**。
3. ALU 算出來的是 memory 位址，去讀 data memory → **MemRead = 1**、**MemWrite = 0**。
4. 讀出來要寫回 register file，這個 mux 的資料從 memory 來 → **MemtoReg = 1**。
5. destination 是 rt 還是 rd？lw 的 destination 由 rt 指定 → **RegDst = 0**。
6. lw 要寫回 → **RegWrite = 1**。
7. 跟 add 一樣是 PC + 4 → **Branch = 0**、**PCSrc = 0**。
8. 一看 opcode 就知道要做加 → **ALUOp = 00**。

### beq

1. ALU 要比較 rs 和 rt，第二個 source 要 rt → **ALUSrc = 0**。
2. 比完之後，ALU 的值還是會一路跑到寫回的地方，線上「有值」。這時候該寫嗎？不該 → **RegWrite = 0**。
3. 既然不寫，RegDst、MemtoReg 選什麼都沒差，是 **don't care**，記成 **X**。
4. 不讀寫 memory → **MemRead = 0、MemWrite = 0**。
5. 比完要決定跳不跳 → **Branch = 1**。相等（Zero = 1）時 PCSrc = 1，PC 選 branch target；不相等時仍是 PC + 4。
6. 一看 opcode 就知道要做減 → **ALUOp = 01**。

> **觀念** don't care 不是「設成 0」，而是「設 0 或 1 結果都一樣」。這個自由度在合成邏輯時可以拿來化簡。

### sw（自己推）

sw 寫 memory、不寫 register：**MemWrite = 1、RegWrite = 0**；不寫 register，所以 **RegDst、MemtoReg = X**。位址 = rs + offset，所以 **ALUSrc = 1**、**ALUOp = 00**；不讀 memory（MemRead = 0）；不是 branch（Branch = 0）。

### 四個指令總表

| 指令 | RegDst | ALUSrc | MemtoReg | RegWrite | MemRead | MemWrite | Branch | ALUOp1 | ALUOp0 |
|---|---|---|---|---|---|---|---|---|---|
| R-format（add 等） | 1 | 0 | 0 | 1 | 0 | 0 | 0 | 1 | 0 |
| lw | 0 | 1 | 1 | 1 | 1 | 0 | 0 | 0 | 0 |
| sw | X | 1 | X | 0 | 0 | 1 | 0 | 0 | 0 |
| beq | X | 0 | X | 0 | 0 | 0 | 1 | 0 | 1 |

## Control 就是一張 truth table

每個指令都走一遍、知道每個 mux 怎麼設之後，合成就很簡單：control 只是 input 到 output 的 mapping，也就是一張 **truth table**。

- input：opcode
- output：每一個 control signal
- opcode 告訴你是哪個指令，就把 output 設成剛才走一遍得到的值。

> **重點** 設計 control 最難的是「知道每個訊號該怎麼設」；一旦知道，剩下的就是 truth table 與邏輯合成。

## ALUOp：opcode 先分成三組

兩層 controller 先看 ALU 那一層。大部分 control signal 在 opcode 一定下來就能發出（要不要 read、write、memory write……）；ALU 比較麻煩，從 opcode 只知道一半：

| opcode 是 | 知道什麼 |
|---|---|
| lw、sw | 要做加（算位址） |
| beq | 要做減（比較） |
| R-type | 不知道，要看 funct |

> **例題** 問：三種狀態要用幾個 bits encode？答：2 個，因為 2² = 4 ≥ 3。

編碼成：**00 = 加、01 = 減、10 = 要看 funct**。這 2 bits 從 main controller 出來，叫 **ALUOp**。ALUOp 再搭配指令最後 6 bits 的 funct，才真正決定給 ALU 的 control。

ALU control 的 output 就是設計 ALU 時定好的 control code：要做加就輸出 0010，要做減就輸出 0110。什麼時候發 0110？有兩種情況：opcode 就說要減的 beq（ALUOp = 01），或 R-type（ALUOp = 10）而 funct 說是 sub。兩種都發出 0110。

所以 main control 一共發出 **7 個控制 mux 與 enable 的訊號**（RegDst、ALUSrc、MemtoReg、RegWrite、MemRead、MemWrite、Branch）**加上 2 bits 的 ALUOp**，共 9 個 output。

## ALU control 的 truth table

ALUOp 是 00 或 01 時，funct 也會被讀出來（它就是指令的後 6 bits，lw／sw／beq 的這 6 bits 其實是 offset 的一部分），但不需要看，是 don't care，表上打 X。

R-type 用到的 funct 值：add = `100000`（32）、sub = `100010`（34）、and = `100100`（36）、or = `100101`（37）、slt = `101010`（42）。

| ALUOp1 | ALUOp0 | F5 F4 F3 F2 F1 F0 | 指令 | ALU 動作 | ALU control |
|---|---|---|---|---|---|
| 0 | 0 | X X X X X X | lw／sw | add | 0010 |
| 0 | 1 | X X X X X X | beq | subtract | 0110 |
| 1 | 0 | 1 0 0 0 0 0 | add | add | 0010 |
| 1 | 0 | 1 0 0 0 1 0 | sub | subtract | 0110 |
| 1 | 0 | 1 0 0 1 0 0 | and | AND | 0000 |
| 1 | 0 | 1 0 0 1 0 1 | or | OR | 0001 |
| 1 | 0 | 1 0 1 0 1 0 | slt | slt | 0111 |

規則：碰到 00，不管 funct，輸出 0010；碰到 01，輸出 0110；碰到 10 才看 funct。左邊是 input、右邊是 output，這就是 truth table。

## ALU control 的邏輯式

- input：ALUOp 2 bits + funct 6 bits = **8 個 input**
- output：**4 個 output**（ALU control 的 bit 3～bit 0）

用邏輯設計學過的 Karnaugh map 合成，**一次只看一個 output**，把它為 1 的那幾列找出來，看在什麼條件下是 1，再用 don't care 化簡。

化簡時可用的 don't care：

- ALUOp = 11 永遠不會出現，所以只要 ALUOp1 = 1 就一定是 R-type，可以不看 ALUOp0；只要 ALUOp0 = 1 就一定是 beq。
- 五個 funct 的前兩位都是 `10`，F5、F4 不用看。

### bit 3

七列全部是 0。不管 input 怎麼變永遠是 0 → **constant 0**，不需要任何邏輯，直接接 ground。

### bit 2

為 1 的列：beq（ALUOp = 01）、sub、slt。beq 的條件是 ALUOp0 = 1；sub、slt 的條件是 ALUOp1 = 1 且 F1 = 1（sub `100010`、slt `101010` 的 F1 都是 1，add、and、or 的 F1 都是 0）。

```
bit 2 = ALUOp0 + ALUOp1·F1
```

### bit 1

為 0 的列只有 and（`100100`）與 or（`100101`），兩者都是 ALUOp1 = 1 且 F2 = 1；其他列都是 1。

```
bit 1 = ¬ALUOp1 + ¬F2
```

### bit 0

為 1 的列只有 or（F0 = 1）與 slt（F3 = 1），兩者都是 R-type。

```
bit 0 = ALUOp1·(F3 + F0)
```

### 代回驗算

| 列 | ALUOp1 ALUOp0 | F3 F2 F1 F0 | bit 3 | bit 2 = ALUOp0 + ALUOp1·F1 | bit 1 = ¬ALUOp1 + ¬F2 | bit 0 = ALUOp1·(F3+F0) | 結果 |
|---|---|---|---|---|---|---|---|
| lw／sw | 0 0 | X X X X | 0 | 0 + 0 = 0 | 1 | 0 | 0010 ✓ |
| beq | 0 1 | X X X X | 0 | 1 | 1 | 0 | 0110 ✓ |
| add | 1 0 | 0 0 0 0 | 0 | 0 + 0 = 0 | 0 + 1 = 1 | 1·0 = 0 | 0010 ✓ |
| sub | 1 0 | 0 0 1 0 | 0 | 0 + 1 = 1 | 0 + 1 = 1 | 1·0 = 0 | 0110 ✓ |
| and | 1 0 | 0 1 0 0 | 0 | 0 | 0 + 0 = 0 | 1·0 = 0 | 0000 ✓ |
| or | 1 0 | 0 1 0 1 | 0 | 0 | 0 + 0 = 0 | 1·1 = 1 | 0001 ✓ |
| slt | 1 0 | 1 0 1 0 | 0 | 0 + 1 = 1 | 0 + 1 = 1 | 1·1 = 1 | 0111 ✓ |

四條式子代回七列，output 全部正確。畫成 gate 時 input 可以共用（例如 ALUOp1 同時進 bit 2 與 bit 0 的 AND gate），bit 3 直接接 ground，ALU control 的四個 output 就完成了。

## Main control 的 truth table

真正的順序是：**main controller 先 decode 出 ALUOp，再加上 funct 進 ALU control**；上面是倒著講（先做小的 ALU controller）。

main controller 主要看 opcode，知道是什麼指令，大部分 control 就都知道了。各指令的 opcode：

| 指令 | opcode（十進位） | Op5 Op4 Op3 Op2 Op1 Op0 |
|---|---|---|
| R-format | 0 | 0 0 0 0 0 0 |
| lw | 35 | 1 0 0 0 1 1 |
| sw | 43 | 1 0 1 0 1 1 |
| beq | 4 | 0 0 0 1 0 0 |
| j | 2 | 0 0 0 0 1 0 |

main control 的 truth table（input 是 opcode，output 是 control signal，值就是前面一個指令一個指令 trace 出來的；教科書常畫成「上面是 opcode、下面是 output」的矩陣，內容相同）：

| 輸出 ＼ 指令 | R-format | lw | sw | beq |
|---|---|---|---|---|
| RegDst | 1 | 0 | X | X |
| ALUSrc | 0 | 1 | 1 | 0 |
| MemtoReg | 0 | 1 | X | X |
| RegWrite | 1 | 1 | 0 | 0 |
| MemRead | 0 | 1 | 0 | 0 |
| MemWrite | 0 | 0 | 1 | 0 |
| Branch | 0 | 0 | 0 | 1 |
| ALUOp1 | 1 | 0 | 0 | 0 |
| ALUOp0 | 0 | 0 | 0 | 1 |

讀表舉例：

- R-type 的 RegDst 決定 destination 從 rt 還是 rd 來；R-type 寫 rd，所以是 1。
- ALUSrc 決定 ALU 第二個 operand：R-type 從 rt 來，所以是 0。設 0 選一條 path、設 1 選另一條。
- ALUOp：R-type 屬於「不知道」那組，填 10；lw、sw 要做加，填 00；beq 做減，填 01。

## 每個 output 一條式子：用 PLA 實作

每個 control signal 都是一個 output。針對每一個 output，看它**什麼時候是 1**。

> **例題** RegWrite 什麼時候設 1？也就是什麼時候要寫 register？R-type 會寫，lw 也會寫。所以 opcode 是 `000000` 或 `100011` 時設 1：用 AND gate 認出這兩個 opcode，再 OR 起來，就是 RegWrite。

先用 AND gate 認出每個指令（¬ 表示取反）：

```
R-format = ¬Op5·¬Op4·¬Op3·¬Op2·¬Op1·¬Op0     (000000)
lw       =  Op5·¬Op4·¬Op3·¬Op2· Op1· Op0     (100011)
sw       =  Op5·¬Op4· Op3·¬Op2· Op1· Op0     (101011)
beq      = ¬Op5·¬Op4·¬Op3· Op2·¬Op1·¬Op0     (000100)
```

再把每個 output 為 1 的指令 OR 起來（don't care 取 0）：

```
RegDst   = R-format
ALUSrc   = lw + sw
MemtoReg = lw
RegWrite = R-format + lw
MemRead  = lw
MemWrite = sw
Branch   = beq
ALUOp1   = R-format
ALUOp0   = beq
```

這正好是 **PLA（programmable logic array）** 的結構：

- **AND plane**：把各種 opcode 認出來（每個指令一個 AND gate）。
- **OR plane**：把需要的條件 OR 起來。例如 ALUSrc 在 lw 和 sw 時是 1，就從這兩個 AND gate 各拉一條線到 ALUSrc 的 OR gate。

每個 output 都這樣接，AND、OR 做成 PLA，main controller 就完成了。

## 加入 jump

### jump 的格式與目標位址

```
| op (6 bits) = 2 | address (26 bits) |
  31          26    25               0
```

除了 opcode，剩下 26 bits 全拿來描述目標位址（這題考過）。目標位址的組法：

1. 26 bits 左移兩位、後面補 `00`：因為它是 word address，指令以 4 bytes 為單位 → 變成 28 bits。
2. 前面接上 **PC + 4 的最高 4 bits** → 湊成 32 bits。

```
jump target = { (PC+4)[31:28] , address[25:0] , 00 }
                   4 bits          26 bits      2 bits  = 32 bits
```

> **例題** （示意）某 j 指令放在位址 `0x9000_0010`，address 欄位為 `0x0000400`。

```
PC + 4             = 0x9000_0014 → 最高 4 bits = 1001
address (26 bits)  = 00 0000 0000 0000 0100 0000 0000   (0x0000400)
左移 2 位 (28 bits) = 0000 0000 0000 0001 0000 0000 0000 (0x0001000)
接上 1001          = 1001 0000 0000 0000 0001 0000 0000 0000
jump target        = 0x9000_1000
```

反過來驗算：把 target 去掉最高 4 bits 與最低 2 bits，剩下的 26 bits 就是原來的 address 欄位。

### 加進 datapath

- opcode decode 出來是 jump，controller 就多發一個 control signal：**Jump**。
- 原本 datapath 的 PC + 4 照常計算。
- **第一個 mux**（PCSrc = Branch AND Zero）：beq 而且相等選 1（branch target），否則選 0（PC + 4）。也就是在 sequential 與 branch 之間選。
- **第二個 mux**（Jump）：在第一個 mux 的結果與 jump target 之間選；Jump = 1 選 jump target。選出來的寫回 PC。

```
PC+4 ─────────┐
              ├─[mux PCSrc]─┐
branch target ┘             ├─[mux Jump]──→ PC
jump target ────────────────┘
```

新的 datapath 只是多算一個 jump target，control 多一個 Jump。jump 的控制訊號：Jump = 1、RegWrite = 0、MemWrite = 0（不寫任何東西），其餘 RegDst、ALUSrc、MemtoReg、MemRead、Branch、ALUOp 都是 X（為了安全，MemRead、Branch 通常也設 0）；其他指令的 Jump 都是 0。到這裡 R、I、J 三種 type 的 datapath 與 control 都齊了。

## Worst case：lw 決定 single cycle 的 clock

single cycle 的 cycle 長度是固定的，所以 clock period 要設成**最長的指令**所需的時間。最長的是 lw，它要經過：clock-to-Q、instruction memory、讀 register、ALU、最主要的 data memory、寫回 register，再加上 clock skew。

用常見的示意數字（ps）：instruction fetch 200、register read 100、ALU 200、data memory 200、register write 100。

| 指令 | IF | Reg read | ALU | Mem | Reg write | 合計 |
|---|---|---|---|---|---|---|
| lw | 200 | 100 | 200 | 200 | 100 | 800 |
| sw | 200 | 100 | 200 | 200 | | 700 |
| R-type | 200 | 100 | 200 | | 100 | 600 |
| beq | 200 | 100 | 200 | | | 500 |

- clock period = 800 ps（由 lw 決定）。其他指令不需要那麼久，但大家都要一樣，clock 不能變來變去。
- **CPI**（clock cycles per instruction）：每個指令一個 cycle，CPI = 1，只是 cycle 很長。
- 所以不 efficient：R-type 只要 600 ps，每次白等 200 ps。

single cycle 的 datapath 與 control，後面的 pipeline 全部會沿用，一定要懂。

### 再看一個例子：add 2 ns、load 10 ns

每道指令用一個 clock cycle 把五個步驟（Fetch、Decode、Execute、Memory Access、Write Back）全走完，CPI 永遠是 1，前一道做完下一道馬上開始，設計最簡單。致命問題是：大家共用一個 clock，週期必須讓最慢的指令也做得完。

- add 只要 2 ns，load 要讀記憶體，要 10 ns → clock cycle 至少 10 ns。
- add 明明 2 ns 就夠，還要等滿 10 ns，白白空等 8 ns，這段時間大部分電路都閒著。
- 真實 CPU 有幾十種指令，時間可以差好幾倍；讓最慢的決定節奏，等於整顆 CPU 都用最慢的速度跑。

## FSM（多週期）處理器：短 cycle，但一次只跑一道

改進的想法：不要讓每道指令都用一樣的時間，而是把一道指令拆成好幾個短 cycle，每個 cycle 只做一步。這就是 **FSM（finite state machine）處理器**，也就是 **multi-cycle（多週期）** 處理器。

| 指令 | 步驟 | cycle 數 | cycle = 2 ns 時的時間 |
|---|---|---|---|
| add | Fetch、Decode、Execute、Write Back | 4 | 8 ns |
| load | Fetch、Decode、Execute、Memory Access、Write Back | 5 | 10 ns |
| jump | 約 3 步 | 3 | 6 ns |

- 每步很簡單，cycle 可以縮短到例如 2 ns；add 只花 8 ns、jump 6 ns，不用再陪 load 等 10 ns。每個 cycle 都在做有意義的事。
- 控制單元是一個 **finite state machine（有限狀態機）**：記住現在走到第幾步，依目前的狀態決定下一步做什麼。
- 優點：要加新的複雜指令，通常只要在狀態機裡多加幾個狀態，不必改整條 datapath。
- 根本瓶頸：前一道沒做完，下一道不能開始，同一時間只有一道指令在跑。Fetch 的電路在 Execute 時閒著，ALU 在 Memory Access 時也閒著。

> **例題** 一段執行共 9 個 cycle，處理器有 5 個單元（五個步驟各一），總共 9 × 5 = 45 格；每個 cycle 只有一個單元在工作，只用到 9 格，**硬體使用率 = 9 ÷ 45 = 20%**。

## Pipeline 概觀

現在的高效能 processor 一定使用 **pipeline（管線）**。它也是拿 single cycle 的 datapath 與 control 改出來的。學 pipeline 的順序：

- 先 overview，再看 pipeline 的 datapath 與 control（single cycle 學會了，這兩個很簡單）。
- 難的是 **data hazard** 與 **control hazard**：sequential 執行時前一個做完才做下一個；pipeline 裡前一個還沒做完、後一個就進來了，有 dependency 就會出問題。
- **exception**：發生 interrupt 這類不正常的事，要跳出正常的執行流程，也算一種 hazard。
- 最後是其他高效能架構，例如 **superscalar**、**dynamic pipelining**。

（pipeline 的完整內容在下一章。）

## 洗衣服的比喻：6 小時 vs 3.5 小時

> **比喻** 四個人 A、B、C、D 都要洗衣服，要經過三站：洗衣機洗 30 分鐘、烘乾機烘 40 分鐘、桌上摺 20 分鐘，一個人共 90 分鐘。就像宿舍洗衣房只有一台洗衣機、一台烘乾機、一張桌子。

### 做法一：sequential laundry

A 進去就把門鎖起來，洗、烘、摺全部做完才開門讓 B 進去，B 也一樣。

```
總時間 = 4 × 90 = 360 分鐘 = 6 小時
```

這很自私：A 在烘的時候洗衣機沒人用；A 在摺的時候兩台機器都空著。

### 做法二：pipelined laundry

A 洗完去烘，洗衣機就讓 B 用；A 摺衣服時，B 烘、C 洗。**resource 用完就 release 給下一個人**。

逐人時間：

| 人 | 洗 | 烘 | 摺 | 完成 |
|---|---|---|---|---|
| A | 0–30 | 30–70 | 70–90 | 90 |
| B | 30–60 | 70–110（等 A 烘完，空等 10 分） | 110–130 | 130 |
| C | 60–90 | 110–150 | 150–170 | 170 |
| D | 90–120 | 150–190 | 190–210 | 210 |

```
總時間 = 30 + 4 × 40 + 20 = 210 分鐘 = 3.5 小時
```

## Latency 不變、throughput 增加

從洗衣服的例子學到：

1. **latency 不變**：latency 就是 response time，把衣服丟進去到拿回來要多久。每一批還是要洗、烘、摺，30 + 40 + 20 = 90 分鐘，pipeline 不會讓它變快。
2. **throughput 增加**：throughput 是單位時間完成的工作量。四批在 90、130、170、210 分完成，穩定後每 40 分鐘完成一批。
3. **pipeline rate 被最慢的 stage 限制**：B 洗完只要 30 分，但 A 還在烘 40 分，B 只能等；每一站其實都變成 40 分。
4. **同一時間用到不同的 resource**，大家共享；但每個 resource 一次只能給一個人用，不能搶。
5. **potential speedup = stage 數**：切成三個 stage、三件事同時做，最多快 3 倍。
6. 實際達不到：
   - stage 長度不平衡（30、40、20），被最長的限制：實際 speedup = 360 ÷ 210 ≈ 1.71 倍。
   - **fill** 與 **drain**：剛開始只用到洗衣機，結束時只用到摺衣桌，其他 resource 閒著，也降低 speedup。
   - **dependency** 更麻煩，會讓 pipeline 停下來（stall）。洗衣服沒有 dependency，所以很順；processor 的 dependency 後面再處理。

> **陷阱** pipeline 改善的是 **throughput**，不是單一工作的 **latency**。

## Processor 的 pipeline：800 ps vs 200 ps

single cycle 一個 cycle 要把所有事做完，lw 完整做完才換下一個。但 lw 其實可以拆成幾個動作：fetch、decode 與讀 register、ALU 運算、memory access、寫回。把這個長 cycle 切成五個 stage，每一站做完，resource 就給下一個指令：lw 在讀 register 時，instruction memory 就能給下一個指令用。

> **例題** 用前面的示意數字，連續執行三個 lw。single cycle 每個 800 ps；pipeline 最慢的 stage 是 200 ps，就把每個 stage 都設成 200 ps。

站在出口等結果出來：

```
single cycle：  |---lw1 800---|---lw2 800---|---lw3 800---|
               完成時間 800、1600、2400 ps

pipeline（每格 200 ps）：
        0    200  400  600  800  1000 1200 1400
lw1     IF   Reg  ALU  Mem  Reg
lw2          IF   Reg  ALU  Mem  Reg
lw3               IF   Reg  ALU  Mem  Reg
               完成時間 1000、1200、1400 ps
```

- 第一個要 5 × 200 = 1000 ps，之後每 200 ps 就出來一個。
- 注意第一個 lw 的 latency 從 800 ps 變成 1000 ps（register 讀寫只要 100 ps，卻也得佔滿 200 ps 的 stage），latency 沒有改善；改善的是每 200 ps 完成一個的 throughput。
- 為什麼能 pipeline？register、ALU、memory 這些 resource 本來就在，只是同一時間分給不同指令共享。

## Pipeline：五個工作站同時開工

> **比喻** 傻瓜做法是一件衣服洗完、烘完、摺好才換下一件；聰明做法是第一件搬進烘衣機時，第二件馬上進洗衣機，兩台同時跑。

把五個步驟想成五個工作站，不同的指令同時在不同的站：

```
          CC1    CC2    CC3     CC4     CC5
指令 A    Fetch  Decode Execute Memory  WriteBack
指令 B           Fetch  Decode  Execute Memory
指令 C                  Fetch   Decode  Execute
```

- 第 1 個 cycle：A 在 Fetch。
- 第 2 個 cycle：A 在 Decode，B 開始 Fetch。
- 第 3 個 cycle：A 在 Execute、B 在 Decode、C 在 Fetch，三道指令同時在跑。
- 穩定之後每個 cycle 都有一道指令做完，理論上 5 級 pipeline 的效能可到 single cycle 的 5 倍。
- 跟 FSM 比：clock 週期差不多短；但 FSM 一道指令要 3～5 個 cycle，pipeline 平均每道約 1 個 cycle，CPI 大幅降低，throughput 大增。

## 五個 stage：IF、ID、EX、MEM、WB

single cycle 的 datapath 從頭到尾只有一個 stage。要拿它當 pipeline 的骨架，就要把 datapath 分成一階一階，每站做什麼、做完沒有要分清楚，就像洗衣、烘乾，不分清楚衣服會跟別人的混在一起。

五個 stage（一定要記）：

| Stage | 名稱 | 做什麼 |
|---|---|---|
| IF | instruction fetch | 用 PC 去 instruction memory 拿指令，存進 instruction register（後面好幾個 cycle 都要用）；計算 PC + 4 |
| ID | instruction decode／register file read | controller decode、讀 register file；branch target 也可在這裡先算好 |
| EX | execution／address calculation | R-type 做加減；lw、sw 算記憶體位址；beq 比較兩數是否相等；jump 算 target |
| MEM | memory access | lw、sw 存取 data memory；R-type 在這一站沒事做 |
| WB | write back | 把結果（例如 lw 讀到的 data）寫回 register file |

> **例題** 問：lw、sw 在 EX 時 ALU 在做什麼？答：在算 memory 位址（address calculation）：rs + sign-extended offset。

- 各指令用到的 stage 數：sw 到第四個 stage（MEM）就結束；lw 要寫回，需要五個 stage；R-type 不用 MEM，結果在 EX 就算完了，看起來可以讓它第四個 stage 就寫回（IF、ID、EX、WB）；但這樣會出問題，見下面的 structural hazard。
- 分好 stage 之後，要把 resource 跟 stage 對起來：resource 共享，但**任何時間每個 resource 只能給一個指令用**，不能搶。

## Pipeline register：把每個 stage 切乾淨

把 single cycle datapath 切成五段（IF；有 decoder 與 register file 的 ID；ALU 的 EX；data memory 的 MEM；WB）之後，就能 pipeline 了嗎？不行。

- 「切」只是心裡想的。signal 不會照你想的跑：有快有慢，在一個長 cycle 裡有的已經跑到後面、有的還在前面。
- 我們要**一個 stage 剛好一個 clock cycle**：做完、存起來，下一個 stage 再開始，每段都切得乾乾淨淨。
- 所以在每個切開的地方加一個 **pipeline register**，把這個 stage 做完的東西存進去。四個 pipeline register 依前後兩個 stage 命名：**IF/ID、ID/EX、EX/MEM、MEM/WB**。
- pipeline register 由 clock 控制、跟 clock 同步：clock 一來，這段的結果寫進去，下一個 clock 再開始下一輪。
- 存好之後，這一段的 resource（例如 instruction memory）就能 release 給下一個指令；下一段的 input 從 pipeline register 拿。

> **例題** 問：加了 pipeline register 之後，clock period 比原來長還是短？答：變短。原本是整個 single cycle 那麼長，現在只要一個 stage 的時間，clock 變快。

## lw 在 pipeline 裡：先讀再說，寫回要選對 rt

### 每個 stage 做的事與用到的 resource

| Stage | lw 做什麼 | 用到的 resource |
|---|---|---|
| IF | 讀 instruction memory、PC + 4，指令存進 IF/ID | instruction memory |
| ID | decode，同時讀 register file、做 sign extension，全部存進 ID/EX | register file 的 read port（與 decoder） |
| EX | 算位址，存進 EX/MEM | ALU |
| MEM | 讀 data memory，存進 MEM/WB | data memory |
| WB | 把資料寫回 register file 的 rt | register file 的 write port |

- IF 取出的指令一定要存進 pipeline register，不能弄丟，因為下一個 clock 下一個指令就進來了。
- 圖上元件左半邊上色代表 write、右半邊上色代表 read。

> **觀念** 問：ID 時 opcode 還在 decode，rs、rt、rd 早就在指令裡，直接拿去讀 register file。讀出來一定會用到嗎？答：不一定，那時候還不知道是什麼指令。但為了省時間，先讀再說；decode 完知道是什麼指令，用不到的就不理。sign extension 也照做，後 16 bits 一起做好，最後由 controller 選要的 data。

### 寫回時要用誰的 rt

lw 跑到第五站要寫回 register file，寫到 rt。可是這時候後面的新指令已經在 ID，也拿出它自己的 rt。到底用誰的？我們要的是第五站那個 lw 的 rt。

```
        CC1  CC2  CC3  CC4  CC5
lw      IF   ID   EX   MEM  WB   ← 要寫回「lw 的 rt」
指令 2       IF   ID   EX   MEM
指令 3            IF   ID   EX
指令 4                 IF   ID
指令 5                      IF
```

CC5 時 IF/ID 裡裝的已經是指令 4，它的 rt 欄位不是 lw 的。這要靠 control 想辦法選對，也是 dependency 帶來的麻煩、hazard 難的地方。

教科書的修正：讓「要寫的 register 編號」跟著 pipeline register（ID/EX → EX/MEM → MEM/WB）一路傳到 WB，寫回時用的就是 lw 自己的 rt。

## R-type 跟 lw 混在一起：structural hazard

R-type 走 IF、ID、EX，然後 WB，若省掉 MEM，四個 stage 就結束。

- 全部都是 lw 時，一個接一個 pipeline，沒有問題。
- 但不能規定指令誰跟誰排在一起，可能是 lw、lw、R、lw，什麼組合都有。

> **例題** 前面一個 lw，後面跟一個 R-type：

```
          CC1  CC2  CC3  CC4  CC5
lw        IF   ID   EX   MEM  WB    ← 第 5 個 stage 寫 register file
R-type         IF   ID   EX   WB    ← 第 4 個 stage 就寫 register file
                              ↑ CC5 兩個都要寫
```

R-type 晚一個 cycle 進來，兩個都在 CC5 寫 register file，可是 register file 只有一個 write port，就打架了。

> **比喻** 前面的人要洗、烘、摺；你的衣服已經手洗好，晚一小時來，跳過洗衣機直接去烘，就跟前面那個人撞在烘乾機了。

- 這是 **resource conflict**：時間沒分配好，兩個指令搶同一個 resource。
- 正式名稱是 **structural hazard（結構危障）**：不同指令在同一時間要用同一個 resource。
- 教科書的解法：讓 R-type 也走滿五站，MEM 空過，大家都在第五站寫回，就不會撞。

> **陷阱** structural hazard 的定義是「不同指令在同一個 cycle 要用同一個 resource」（例如 register file 的 write port、共用的記憶體），跟資料相依無關。

## 三種 hazard 與解法

天下沒有白吃的午餐：多道指令同時在 pipeline 裡會互相干擾，這叫 **hazard**，分三種：**structural、data、control**。

### Structural hazard：共用記憶體

另一個常見例子：早期指令和資料放在同一塊記憶體。

```
      CC1  CC2  CC3  CC4  CC5
A     IF   ID   EX   MEM  WB
B          IF   ID   EX   MEM
C               IF   ID   EX
D                    IF   ID
                     ↑ CC4：A 在 MEM 讀資料、D 在 IF 抓指令，搶同一塊記憶體
```

解法：把指令記憶體和資料記憶體分開，這就是快取要分 **I-cache**（指令）和 **D-cache**（資料）的原因，Fetch 與 Memory Access 就不會互搶。

### Data hazard

最常見的 hazard：一道指令要用前一道指令的結果，但前一道還沒跑完。

```asm
add R0, R1, R2    # R0 = R1 + R2
sub R3, R0, R4    # 要用 add 算出的 R0
```

sub 在 Decode（CC3）讀 R0，但 add 要到 Write Back（CC5）才寫回；不處理的話 sub 讀到舊值，結果錯誤。

**解法一：stall**。插入 **bubble**（也就是 **NOP**，no operation），讓 sub 等到 add 寫回再讀。教科書假設 register file **前半 cycle 寫、後半 cycle 讀**，所以要等 2 個 cycle：

```
              CC1  CC2  CC3  CC4  CC5  CC6  CC7  CC8
add R0,R1,R2  IF   ID   EX   MEM  WB
sub R3,R0,R4       IF   --   --   ID   EX   MEM  WB
                        (bubble)  ↑ CC5：add 前半寫 R0，sub 後半讀到新值
```

簡單粗暴，但浪費時間，throughput 下降。

**解法二：forwarding（又叫 bypassing）**。add 在 EX（CC3）算完，結果其實已經在 CPU 裡，直接轉給 sub 的 EX（CC4），不必等寫回，就不用 stall。代價是多一些偵測、轉發的電路。

```
              CC1  CC2  CC3  CC4  CC5  CC6
add R0,R1,R2  IF   ID   EX   MEM  WB
                         └──→┐
sub R3,R0,R4       IF   ID   EX   MEM  WB
```

**Load-use hazard：forwarding 也救不了**。load 要到 MEM 才拿到資料，但下一道指令的 EX 剛好排在同一個 cycle，差一個 cycle，一定要 stall 1 個 cycle。

> **例題** （示意）lw 後面緊接著使用它載入的 register：

```
              CC1  CC2  CC3  CC4  CC5  CC6  CC7
lw  R1,0(R2)  IF   ID   EX   MEM  WB
                              └──→┐  (MEM 結束才有資料)
add R3,R1,R4       IF   ID   --   EX   MEM  WB
                            (stall 1 個 cycle)
```

**instruction scheduling（指令排程）**：聰明的 compiler 在 load 和使用它的指令中間，塞一道不相關的指令，原本要空等的那個 cycle 就被利用起來：

```asm
lw  R1, 0(R2)
sub R5, R6, R7    # 不相關的指令填進空檔（示意）
add R3, R1, R4    # 此時 lw 的資料已可 forwarding，不必 stall
```

### Control hazard 與 branch prediction

control hazard 最棘手：遇到 if-else、迴圈這種 branch（例如 `beq`），CPU 不知道下一道是往下走還是跳到 L，卻必須一直提前 fetch。

假設 beq 到 EX 才知道結果，這時後面已經先抓進兩道「猜的」指令：

```
          CC1  CC2  CC3  CC4
beq       IF   ID   EX          ← CC3 才知道要不要跳
猜的 1         IF   ID   ×      ← 猜錯就丟掉
猜的 2              IF   ×      ← 猜錯就丟掉
正確指令                  IF
```

猜錯的話，已進入 pipeline 的錯誤指令全部丟掉，叫 **pipeline flush（清空）**，這裡白白損失 2 個 cycle。

解法是 **branch prediction（分支預測）**：先猜。現代 CPU 猜得很準，準確率可到 95% 以上。

- **一律預測不跳（predict not taken）**：實作最簡單，但迴圈的 branch 幾乎每次都跳回去，只有最後一次離開，準確率很低。
- **依歷史預測**：記住每個 branch 過去跳了沒，上次跳，這次就猜跳。迴圈連續跳了 10 次，下次大機率還是跳。

> **例題** 一個迴圈的 branch 共執行 11 次：前 10 次跳回去（T），第 11 次離開（N）。

| 第幾次 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 實際 | T | T | T | T | T | T | T | T | T | T | N |
| 一律猜不跳 | N ✗ | N ✗ | N ✗ | N ✗ | N ✗ | N ✗ | N ✗ | N ✗ | N ✗ | N ✗ | N ✓ |
| 照上次結果猜 | N ✗ | T ✓ | T ✓ | T ✓ | T ✓ | T ✓ | T ✓ | T ✓ | T ✓ | T ✓ | T ✗ |

一律猜不跳：11 次只猜對 1 次。照上次結果猜（第 1 次沒有歷史、猜不跳）：11 次猜對 9 次，只錯在進入迴圈與離開迴圈。

猜對：pipeline 滿速前進，沒有損失；猜錯：flush 掉錯誤的指令，從正確位置重來，損失幾個 cycle。「猜對免費、猜錯付代價」是現代 CPU 效能的關鍵之一。

## 總結：single cycle → FSM → pipeline

演進線：每一代都是為了解決上一代的根本問題。

1. **single cycle** 最簡單，但 clock 被最慢的指令拖垮、硬體大量閒置 → 讓指令用多個短 cycle，就有了 FSM。
2. **FSM（多週期）** 比較靈活，但指令仍一道一道序列執行，硬體使用率低 → 讓多道指令同時在不同階段，就有了 pipeline。
3. **pipeline**：N 級 pipeline 理論上 N 倍效能，但帶來三種 hazard，控制邏輯更複雜。

| | Single cycle | FSM（multi-cycle） | Pipeline |
|---|---|---|---|
| clock cycle | 長（= 最慢指令，如 lw） | 短（一個步驟） | 短（= 最慢的 stage） |
| CPI | 1 | 3～5（依指令） | 理想約 1 |
| 同時執行的指令 | 1 | 1 | 最多 = stage 數 |
| 控制 | combinational truth table | finite state machine | 控制訊號隨 pipeline register 傳遞，另需處理 hazard |
| 主要缺點 | 快指令空等、硬體閒置 | 硬體使用率仍低 | hazard |

三種 hazard 的對策：

| Hazard | 原因 | 對策 |
|---|---|---|
| Structural | 不同指令同一 cycle 搶同一個 resource | 分開 resource（I-cache／D-cache）、統一各指令的 stage 安排 |
| Data | 要用前一道尚未寫回的結果 | stall、forwarding；load-use 必須 stall 1 cycle，再加上 compiler 的 instruction scheduling |
| Control | branch 結果出來前不知道下一道指令 | branch prediction，猜錯就 flush |

延伸：

- 現代 CPU 早已不只五級，有十幾到二十幾級，還能同時跑好幾條 pipeline。
- flush 的想法演變成 **speculative execution**；data hazard 的解法演變成 **out-of-order execution** 與 **register renaming**。
- 下一步是 **cache**：pipeline 讓 CPU 跑得很快，但記憶體速度跟不上；如果每次都要去記憶體拿資料，pipeline 的優勢就被抵消了。

## 重點整理
- FP 乘法：exponent 相加再減一次 bias → mantissa 相乘 → normalize → round（可能重複）→ sign = S₁ XOR S₂
- 兩個 biased exponent 相加多加了一次 bias（bias 8 例：15 + 5 = 20，減 8 得 12 = 4 + 8）
- 1.000₂×2⁻¹ × −1.110₂×2⁻² ：126 + 125 − 127 = 124；1.000 × 1.110 = 1.110000 → −1.110₂×2⁻³ = −0.21875
- FP 由 Coprocessor 1 處理：`$f0`～`$f31`，指令加 .s／.d，double 用一對 register，lwc1／swc1，mfc1／mtc1
- 同一串 32 bits 可解釋成整數、指令、floating point；解釋不同 hardware 就不同
- range 與 precision 有限 → FP 加法無結合律：(−1.5×10³⁸ + 1.5×10³⁸) + 1.0 = 1.0，−1.5×10³⁸ + (1.5×10³⁸ + 1.0) = 0.0
- 乘除 2ⁱ 用 shift（barrel shifter 一個 cycle）；signed 右移補 sign bit；sign extension 正數補 0、負數補 1
- make the common case fast：常用指令約 54 個，涵蓋 SPEC int 100%、SPEC fp 97%
- CPU time = IC × CPI × clock cycle time；IC 由 ISA 與 compiler 決定，CPI 與 cycle time 由 hardware 決定
- single cycle：CPI = 1，但 clock period = 最長指令（lw）的 delay
- 指令五步：Fetch、Decode、Execute、Memory Access（只有 load／store）、Write Back
- R-type：op 6 | rs 5 | rt 5 | rd 5 | shamt 5 | funct 6；I-type：op | rs | rt | imm16；J-type：op | target 26
- R-type opcode 都是 000000，靠 funct 區分（add 100000、sub 100010）
- I-type 三類：load／store、immediate 運算、branch；J target：PC 前 4 bits ‖ target26 ‖ 00
- 設計 processor 五步：分析 ISA → 選元件 → 組 datapath → 決定 control signal → 合成 control logic
- RTL：add：R[rd] ← R[rs] + R[rt]；lw：R[rt] ← MEM[R[rs] + SignExt(imm16)]；sw：MEM[R[rs] + SignExt(imm16)] ← R[rt]；addi：R[rt] ← R[rs] + SignExt(imm16)；每個都有 PC ← PC + 4
- beq：相等時 PC ← PC + 4 + (SignExt(imm16) ‖ 00)，否則 PC + 4；target 先算好
- ‖ 是 concatenate 不是 OR；offset ‖ 00 = offset × 4
- edge triggered + write enable：clock edge 且 Write = 1 才寫
- register file：兩個 read port（RA、RB → busA、busB）、一個 write port（RW、busW、WrEn），地址各 5 bits
- memory：一個 address、Data In／Data Out，always 讀出，WrEn = 1 才寫
- PC + 4 算好後等 clock edge 才寫回 PC
- fan-out 可以；一個 input 有兩個來源要用 mux
- RegDst（rt／rd）、ALUSrc（0 register、1 immediate）、MemtoReg（0 ALU、1 memory）
- R-type：ALUSrc 0、MemtoReg 0；lw：ALUSrc 1、MemtoReg 1
- beq：ALU 相減判 Zero，另一個 adder 算 target，mux 選 next PC
- 可並行取較長、須接續要相加；critical path（lw）= clock-to-Q + IM + reg file + ALU + DM + setup time + clock skew
- control 決定 datapath 走哪條路：各 mux 的 select 與 write／read enable；control logic 是 random logic（adder 那種是 regular logic）
- MIPS format 一致（opcode 固定前 6 bits、rs 第一個 source、第二個讀 rt、offset 在後 16 bits）→ 只有 destination（rt／rd）要 RegDst mux
- 兩個例外：PCSrc = Branch AND Zero；ALU 動作要看 funct（R-type opcode 全是 000000）→ 兩層 controller（main control + ALU control）
- add（R-type）：RegDst 1、ALUSrc 0、MemtoReg 0、RegWrite 1、MemRead 0、MemWrite 0、Branch 0、ALUOp 10
- lw：RegDst 0、ALUSrc 1、MemtoReg 1、RegWrite 1、MemRead 1、MemWrite 0、Branch 0、ALUOp 00
- sw：RegDst X、ALUSrc 1、MemtoReg X、RegWrite 0、MemRead 0、MemWrite 1、Branch 0、ALUOp 00
- beq：RegDst X、ALUSrc 0、MemtoReg X、RegWrite 0、MemRead 0、MemWrite 0、Branch 1、ALUOp 01
- 沒有 RegWrite 控制，register file 每個 cycle 都會被寫；不寫 register 時 RegDst、MemtoReg 是 don't care
- ALUOp（2 bits）：00 加（lw／sw）、01 減（beq）、10 看 funct（R-type）
- ALU control code：0000 AND、0001 OR、0010 add、0110 sub、0111 slt；funct：add 100000、sub 100010、and 100100、or 100101、slt 101010
- ALU control 邏輯式：bit3 = 0；bit2 = ALUOp0 + ALUOp1·F1；bit1 = ¬ALUOp1 + ¬F2；bit0 = ALUOp1·(F3 + F0)
- opcode：R 000000(0)、lw 100011(35)、sw 101011(43)、beq 000100(4)、j 000010(2)
- main control 用 PLA：AND plane 認 opcode，OR plane 組 output；RegWrite = R + lw、ALUSrc = lw + sw、MemtoReg = MemRead = lw、MemWrite = sw、Branch = ALUOp0 = beq、RegDst = ALUOp1 = R
- jump target = {(PC+4)[31:28], address[25:0], 00}；第二個 mux 由 Jump 控制
- single cycle：clock period = 最慢指令（lw 200+100+200+200+100 = 800 ps）；CPI = 1；R-type 600 ps 白等 200 ps
- FSM（multi-cycle）：短 cycle，add 4、load 5、jump 約 3 個 cycle；一次只跑一道，使用率低（例 9/45 = 20%）
- 洗衣：sequential 4 × 90 = 360 分；pipeline 30 + 4 × 40 + 20 = 210 分；speedup 360/210 ≈ 1.71（理想 = stage 數 3）
- pipeline 改善 throughput，不改善 latency；被最慢的 stage 限制；unbalanced stage、fill／drain、dependency 降低 speedup
- processor：single cycle 每 800 ps 一個；pipeline stage 200 ps，第一個 1000 ps、之後每 200 ps 一個
- 五個 stage：IF、ID（decode + 讀 register）、EX（運算／算位址／比較）、MEM、WB；sw 4 stage、lw 5 stage
- pipeline register（IF/ID、ID/EX、EX/MEM、MEM/WB）由 clock 控制，把 stage 切乾淨；clock period 縮為一個 stage
- lw 寫回要用自己的 rt：destination 編號隨 pipeline register 傳到 WB
- lw（5 stage）後接 R-type（4 stage）→ CC5 同時寫 register file → structural hazard；解法：R-type 也走滿 5 stage
- 三種 hazard：structural（分 I-cache／D-cache）、data（stall 2 cycle 或 forwarding；load-use 必 stall 1 + instruction scheduling）、control（branch prediction，猜錯 flush，例中損失 2 cycle）
- 迴圈 branch 11 次（10T1N）：一律猜不跳對 1 次，照上次結果猜對 9 次

## 名詞對照
| 中文 | English |
|---|---|
| 浮點數 | floating point |
| 單精度／雙精度 | single precision／double precision |
| 指數 | exponent |
| 尾數 | mantissa／significand |
| 偏差表示法 | biased representation |
| 正規化 | normalize |
| 捨入 | rounding |
| 協同處理器 | coprocessor |
| 結合律 | associativity |
| 範圍／精確度 | range／precision |
| 符號擴展 | sign extension |
| 桶式移位器 | barrel shifter |
| 基準測試 | benchmark |
| 讓常見情況變快 | make the common case fast |
| 單週期 | single cycle |
| 多週期 | multi-cycle |
| 管線 | pipeline |
| 指令數 | instruction count |
| 每指令週期數 | CPI (cycles per instruction) |
| 時脈週期 | clock cycle time／clock period |
| 程式計數器 | program counter (PC) |
| 取指令 | instruction fetch |
| 解碼 | decode |
| 寫回 | write back |
| 指令格式 | instruction format |
| 位移量 | shift amount (shamt) |
| 功能碼 | funct |
| 立即值 | immediate |
| 資料路徑 | datapath |
| 多工器 | multiplexer (mux) |
| 控制訊號 | control signal |
| 載入／儲存架構 | load-store machine |
| 組合邏輯元件 | combinational element |
| 狀態元件 | state (sequential) element |
| 正反器 | flip-flop |
| 準位觸發 | level sensitive |
| 邊緣觸發 | edge triggered |
| 寫入致能 | write enable |
| 時脈方法 | clocking methodology |
| 關鍵路徑 | critical path |
| 暫存器轉移語言 | RTL (register transfer) |
| 串接 | concatenate |
| 暫存器檔 | register file |
| 讀取埠／寫入埠 | read port／write port |
| 扇出 | fan-out |
| 時脈到輸出延遲 | clock-to-Q delay |
| 建立時間 | setup time |
| 時脈偏移 | clock skew |
| 競跑 | racing |
| 控制單元 | controller／control unit |
| 隨機邏輯 | random logic |
| 規則邏輯 | regular logic |
| 主控制單元 | main control |
| ALU 控制 | ALU control |
| 功能碼 | funct（function code） |
| 不在乎項 | don't care |
| 真值表 | truth table |
| 卡諾圖 | Karnaugh map |
| 可程式邏輯陣列 | PLA（programmable logic array） |
| 跳躍目標位址 | jump target address |
| 時脈週期 | clock cycle／clock period |
| 每指令時脈數 | CPI（clock cycles per instruction） |
| 有限狀態機 | finite state machine（FSM） |
| 延遲（回應時間） | latency（response time） |
| 吞吐量 | throughput |
| 加速比 | speedup |
| 填滿／排空 | fill／drain |
| 指令擷取 | instruction fetch（IF） |
| 指令解碼 | instruction decode（ID） |
| 執行 | execution（EX） |
| 記憶體存取 | memory access（MEM） |
| 寫回 | write back（WB） |
| 位址計算 | address calculation |
| 管線暫存器 | pipeline register |
| 危障 | hazard |
| 結構危障 | structural hazard |
| 資料危障 | data hazard |
| 控制危障 | control hazard |
| 資源衝突 | resource conflict |
| 停頓／氣泡 | stall／bubble（NOP） |
| 前饋 | forwarding（bypassing） |
| 載入使用危障 | load-use hazard |
| 指令排程 | instruction scheduling |
| 分支預測 | branch prediction |
| 管線清空 | pipeline flush |
| 推測執行 | speculative execution |
| 亂序執行 | out-of-order execution |
| 暫存器重新命名 | register renaming |
| 超純量 | superscalar |
| 動態管線 | dynamic pipelining |
| 例外 | exception |
