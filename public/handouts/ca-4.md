# Pipeline

Pipeline 讓五個指令同時在 IF、ID、EX、MEM、WB 五個 stage 上工作，理想上每個 cycle 完成一個指令（CPI = 1）。代價是 hazard：structural、data、control 三種危障會逼 pipeline stall，讓 CPI = 1 + 平均每指令 stall 數。這章依序講 pipelined datapath 與 control、forwarding 與 hazard detection、load-use 一定要停的那一拍、branch 的 flush、predict not taken、1-bit／2-bit 動態預測、delayed branch、pipeline 中的 exception，最後是 multiple issue、loop unrolling 與 superscalar。考試常直接給一段含 lw、branch 的組合語言，要你畫 pipeline 圖、算實際 stall 了幾個 cycle。

## 學完這章要會
- 畫出指令在五段 pipeline 中的時序圖，說明 pipeline register 與 control 怎麼跟著指令走
- 算 pipeline 的理想加速與 CPI，知道 CPI = 1 + stalls per instruction
- 分辨 structural、data、control hazard，以及 RAW、WAR、WAW，說明五段 MIPS 為什麼只有 RAW
- 寫出 forwarding unit 的條件（含 RegWrite、rd ≠ 0、double data hazard），判斷每個 cycle 的 ForwardA／ForwardB
- 偵測 load-use 並插入 bubble；分辨 lw 接 sw（有 MEM forwarding 不必停）與真正的 load-use
- 給一段組合語言，逐指令找出 hazard，算出總 cycle 數與 CPI
- 比較 stall、predict not taken、1-bit／2-bit predictor、branch target buffer、delayed branch，並算 branch 對 CPI 的影響
- 說明 exception 在 pipeline 中怎麼處理（EPC、Cause、flush），precise 與 imprecise 的差別
- 用 IPC 描述 multiple issue，排 dual-issue 的指令包，做 loop unrolling 與 register renaming

## 從 single cycle 到 pipeline

pipeline（管線）是 high performance 處理器一定會用的架構：讓很多個指令在同一個時間一起做，各用各的硬體。

### single cycle 的浪費

single cycle（單週期）設計裡，一個指令在一個長長的 clock cycle 裡全部做完，下一個指令才進來。問題是在這個長 cycle 裡，同一時間其實只有一段硬體在忙：抓指令時 ALU 閒著，用 ALU 時資料記憶體閒著，其他硬體大部分時間都在等，很浪費。

### pipeline 的精神：硬體資源大家共用

pipeline 把 datapath 要做的事切成好幾段，叫 **stage**，讓不同的指令錯開，同一時間各自使用不同 stage 的硬體，一起往前做。

> **比喻** 洗衣服分成洗、烘、摺三步。第一籃在烘的時候，洗衣機已經空了，第二籃就可以開始洗；不必等第一籃整個摺完才洗下一籃。好幾個指令在執行時互相重疊（overlap），就是 pipelining。

### MIPS 的五個 stage（一定要背）

| 段 | 名稱 | 做什麼 |
|---|---|---|
| 1 | IF（instruction fetch） | 拿 PC 去 instruction memory 把指令抓出來 |
| 2 | ID（instruction decode / register read） | 解讀這是什麼指令，同時讀 register file（指令一抓出來，rs、rt、rd 是哪幾個 register 就知道了） |
| 3 | EX（execution） | 用 ALU 執行：R-type 在這裡做加減等運算；lw、sw 在這裡算記憶體位址 |
| 4 | MEM（memory access） | 讀或寫 data memory；R-type 用不到記憶體，但還是要「空著」走過這一段 |
| 5 | WB（write back） | 把結果寫回 register file |

### 指令錯開一個 cycle 進場

第一個指令進到第二段時，第一段的硬體已經 release（空出來），第二個指令馬上進來 fetch；第一個走到第三段時，前兩段又空了，第三個進來。所以**每個指令都比前一個晚一個 cycle 開始**。

```
          CC1  CC2  CC3  CC4  CC5  CC6  CC7  CC8  CC9
指令 1    IF   ID   EX   MEM  WB
指令 2         IF   ID   EX   MEM  WB
指令 3              IF   ID   EX   MEM  WB
指令 4                   IF   ID   EX   MEM  WB
指令 5                        IF   ID   EX   MEM  WB
```

直著看 CC5 這一欄，五列都有東西：同一時間最多有 5 個指令在跑，各用各的硬體。從 CC5 開始，每個 cycle 都有一個指令做完。

### latency 與 throughput

問：pipeline 會讓「一個」指令變快嗎？
答：不會。每個指令自己還是要走完五段，response time，也就是 **latency**（一個指令從進去到出來的時間），沒有縮短。pipeline 加大的是 **throughput**（產出量，單位時間完成的工作量）：穩定之後每個 cycle 都有一個指令完成。

> **陷阱** pipeline 改善的是 throughput，不是單一指令的 latency。而且因為多了 pipeline register 的存取時間，單一指令的 latency 甚至會稍微**變長**一點。「pipeline 讓每個指令執行得更快」是錯的敘述。

## Pipelined datapath：pipeline register

### 光畫線不算切段

pipeline 的 datapath 可以直接拿 single cycle 的 datapath 來用，因為它本來就一段一段由左往右排好了。可是在圖上畫幾條線說「這裡切一下」，並不會真的變成五個 stage，還少了一樣東西：**pipeline register**（管線暫存器，也叫 pipeline latch）。每兩個 stage 中間都要真的加一個暫存器。

- 一段做完，結果先存進 pipeline register，存好了這個 cycle 才算完成。
- 下一段在下一個 cycle 從 pipeline register 拿資料繼續做。
- 這樣一個 cycle 只做一段，clock cycle 就切得又細又短。

**五個 stage 之間要加 4 個 pipeline register**，依照它夾在哪兩段中間命名：IF/ID、ID/EX、EX/MEM、MEM/WB。這個數字算題目時會用到。

> **重點** pipeline 對 datapath 的修改其實很簡單：single cycle 的 datapath 切好 stage，段與段之間加 pipeline register。

### 切得越平均越好

問：stage 要隨便切，還是盡量切平均？
答：盡量平均（balance）。因為 pipeline 的 clock 由**最長的那一段**決定。短的段做完了也不能先把指令往下送，要等最慢那段做完，大家才一起進到下一段；短段剩下的時間就是白白在等。所以

```
clock period = max(各 stage 的時間)
```

各段切得越 balance，等待的浪費就越少。

## 每種指令都排成五段

### R-type 也要等到第五段才寫回

lw 一定要走滿五段。R-type（add、sub 這類 register 之間的運算）不用讀寫記憶體，如果讓它只走四段（IF、ID、EX、WB），算完就馬上寫回，會怎樣？

```
           CC1  CC2  CC3  CC4  CC5  CC6
lw         IF   ID   EX   MEM  WB          ← CC5 寫 register file
R-type          IF   ID   EX   WB          ← CC5 也寫 register file（衝突！）
```

lw 在自己的第五段（CC5）寫回；R-type 晚一個 cycle 進來，在自己的第四段寫回，也是 CC5。兩個指令在同一個 cycle 都要用 register file 的 **write port**，撞在一起了。這種兩個指令搶同一個硬體的情形就是 **structural hazard**（結構危障，後面詳談）。

兩個重要觀念：

1. 每個 functional unit（ALU、記憶體、register file 的寫入口……）**同一時間只能給一個指令用**。
2. 同一個 resource，**所有指令都要在同一個 stage 用它**。write back 就是在用 register file 的 write port，lw 是在第五段用它，所以大家都在第五段用。

為什麼一定要同一段？如果你在第四段用、我在第五段用，我們又剛好差一個 cycle，就會在同一個 cycle 搶同一個東西。解法：R-type 也一律在第五段寫回，它的第四段 MEM 本來就用不到，就空著不做事。

```
           CC1  CC2  CC3  CC4  CC5  CC6
lw         IF   ID   EX   MEM  WB          ← CC5 寫
R-type          IF   ID   EX   (MEM) WB    ← CC6 寫，MEM 空著
```

改完之後 lw 在 CC5 寫、R-type 在 CC6 寫，每個 cycle 的資源都不衝突。pipeline 的規矩是後一個指令一定比前一個晚一個 cycle 開始：你先用完，下一個 cycle 才輪到我。只要「每個指令都晚一個 cycle 進來」加上「同一個資源都在同一段用」，前面的人永遠在你前面，就永遠不會打架。

> **比喻** 洗衣服本來應該先洗再烘。我比前一個人晚一步到，卻跳過洗衣機直接去搶烘衣機，就跟前面那個人撞上了。跳過一段，就等於插隊搶先一步。

> **陷阱** R-type 的結果在 EX 就算好了，但仍然要等到第五段才寫回；提早在第四段寫，接在 lw 後面時會在同一個 cycle 搶 write port（structural hazard）。

### sw 與 beq 也補成五段

- **sw** 只要四段：抓指令、讀暫存器、算位址、寫記憶體。它不寫暫存器，最後補一個「假的」write back，什麼都不做。
- **beq** 更短，只有三段：IF、ID、EX（抓指令、讀兩個暫存器、比較）。後面的 MEM、WB 也假裝有，只是不做事。

這樣 pipelined datapath 就完成了：**不管什麼指令，都走 IF、ID、EX、MEM、WB 五段**，每個 cycle、每一段都只有一個指令。

| 指令 | IF | ID | EX | MEM | WB |
|---|---|---|---|---|---|
| lw | 抓指令 | 讀 rs | 算位址 rs + offset | 讀 data memory | 寫回 rt |
| R-type | 抓指令 | 讀 rs、rt | ALU 運算 | 不做事 | 寫回 rd |
| sw | 抓指令 | 讀 rs、rt | 算位址 rs + offset | 寫 data memory | 不做事 |
| beq | 抓指令 | 讀 rs、rt | 比較 | 不做事 | 不做事 |

### 圖形表示法（graphic representation）

另一種畫法：每列一個指令、往右是 clock cycle，格子裡寫那一段用到的**硬體**：IM（instruction memory）、Reg（讀 register）、ALU、DM（data memory）、Reg（寫回 register）。

```
           CC1  CC2  CC3  CC4  CC5  CC6  CC7
指令 1     IM   Reg  ALU  DM   Reg
指令 2          IM   Reg  ALU  DM   Reg
指令 3               IM   Reg  ALU  DM   Reg
```

這種圖可以「直著看」一個 cycle：例如 CC3，第一個指令在用 ALU，第二個在讀 register，第三個正在抓指令。一眼就看出每個 cycle 誰在用什麼硬體。

## 例題：lw 與 sub 一拍一拍走過 datapath

> **例題** 指令 `lw $10, 20($1)` 之後接 `sub $11, $2, $3`，逐 cycle 追蹤它們在 pipelined datapath 上的位置。

```asm
lw  $10, 20($1)     # $10 = Mem[$1 + 20]
sub $11, $2, $3     # $11 = $2 - $3
```

```
           CC1  CC2  CC3  CC4  CC5  CC6
lw         IF   ID   EX   MEM  WB
sub             IF   ID   EX   MEM  WB
```

| cycle | lw | sub |
|---|---|---|
| CC1 | IF：用 PC 到 instruction memory 把 lw 讀出來 | （還沒進來） |
| CC2 | ID：讀 register（`$1`）、decode | IF：第一段空出來，sub 進來 fetch |
| CC3 | EX：ALU 算位址 `$1` + 20（20 先 sign extension 成 32 位元） | ID：讀 `$2`、`$3` |
| CC4 | MEM：讀 data memory | EX：ALU 算 `$2` − `$3` |
| CC5 | WB：把讀到的資料寫回 `$10` | MEM：什麼都不做 |
| CC6 | （完成） | WB：用 write port 把結果寫回 `$11` |

重點說明：

- CC2 時，lw 用 register file，sub 用 instruction memory，兩個用的是不同硬體，互不相干。
- 問：CC2 的時候，lw 這條指令放在哪裡？
  答：在 **IF/ID** 這個 pipeline register。第一段讀出來的東西先存在這裡，第二段才拿來用。
- 問：什麼時候寫進 pipeline register？
  答：在 clock cycle 結束的那一瞬間（end of clock cycle）寫進去。那時舊的內容已經用完，就被新的蓋掉。
- 問：sub 的答案在 CC4 就算完了，CC5 直接寫回可以嗎？
  答：不行，寫回一律在第五段。所以 CC5 的 sub 走在 MEM，什麼都不做；CC6 才寫回 `$11`。
- 兩個指令一共 2 + 4 = 6 個 cycle。

## Pipelined control

### 控制訊號的「值」不變，變的是「什麼時候用」

datapath 講完，再來是 control：誰告訴每一段硬體「這次要做什麼」？

single cycle 時，controller 看指令的 opcode，一次把所有 control signal 發出去。其實有兩個 controller：**main controller** 看 opcode，**ALU controller** 看 function code（R-type 指令裡決定做加、減、and、or 的欄位），分兩個是為了讓 opcode 那邊簡單一點。control signal 管的是：要不要寫 register（RegWrite）？ALU 做加還是減？ALU 第二個輸入選誰（ALUSrc）？寫回的資料來自 memory 還是 ALU（MemtoReg）？

改成 pipeline 之後，跟 single cycle 比，哪裡一樣、哪裡不一樣？

- **一樣的：訊號的值。** 以 R-type 為例，EX 段 ALU 拿 rs 和 rt 來算，ALUSrc 設 0（選 rt）；寫回的資料從 ALU 來，MemtoReg 設 0。這跟 single cycle 一模一樣。訊號也還是拿 opcode 去查同一張 truth table 產生。
- **不一樣的：什麼時候用。** single cycle 是同一個 cycle 全部用完；pipeline 裡，EX 段的訊號在第 3 個 cycle 用，MEM 段的在第 4 個，WB 段的在第 5 個。

### 分組，跟著指令往下傳

問：control signal 在第一段 IF 就知道了嗎？
答：不知道，指令才剛抓進來，還沒解讀。所以 **IF 段不需要任何 control signal**（每個 cycle 都一樣是抓指令、PC + 4）。第二段 ID decode 結束時，所有 control signal 就全部知道了；ID 段本身讀 register 也不需要特別的控制。

知道得早、用得晚，於是把 control signal 依照「哪一段要用」做 **grouping（分組）**：

- **EX 組**：EX 段用（RegDst、ALUOp、ALUSrc）
- **M 組**：MEM 段用（Branch、MemRead、MemWrite）
- **WB 組**：WB 段用（RegWrite、MemtoReg）

還沒輪到的組就存在 pipeline register 裡，跟著指令一段一段往下傳，用掉的就不再往下傳：

```
ID   decode 完：EX、M、WB 三組都存進 ID/EX
EX   用掉 EX 組 → M、WB 兩組存進 EX/MEM
MEM  用掉 M 組  → WB 組存進 MEM/WB
WB   用掉 WB 組
```

> **重點** 懂了 single cycle 的 control，pipeline 的 control 就很簡單：在 decode 產生，然後分組往下傳，傳到要用的那一段才用。

### 四種指令的控制訊號（依組別）

每組裡的位元順序：EX 組 = RegDst、ALUOp1、ALUOp0、ALUSrc；M 組 = Branch、MemRead、MemWrite；WB 組 = RegWrite、MemtoReg（X 表示 don't care）。

| 指令 | RegDst | ALUOp1 | ALUOp0 | ALUSrc | Branch | MemRead | MemWrite | RegWrite | MemtoReg |
|---|---|---|---|---|---|---|---|---|---|
| R-type | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 |
| lw | 0 | 0 | 0 | 1 | 0 | 1 | 0 | 1 | 1 |
| sw | X | 0 | 0 | 1 | 0 | 0 | 1 | 0 | X |
| beq | X | 0 | 1 | 0 | 1 | 0 | 0 | 0 | X |

所以 lw 的三組是 EX = `0001`、M = `010`、WB = `11`；R-type（例如 sub）是 EX = `1100`、M = `000`、WB = `10`。

## Destination register 也要跟著傳

### 寫回時要寫「哪一個」register？

write back 時 register file 需要一個寫入位址：R-type 的結果寫到 **rd**，lw 從記憶體讀來的資料寫到 **rt**。

問：寫回時，可以直接用 IF/ID 裡指令的 rd 欄位當位址嗎？
答：不行。指令走到 WB 時，IF/ID 裡放的是剛抓進來的**新指令**，它的 rs、rt、rd 跟正在寫回的那個指令沒有關係。要用的是正在寫回的這個指令**自己的** rd（或 rt），因為是它要寫回去。

所以不只 control signal，**destination register 的號碼也要往下傳**：rd 在 ID 段雖然用不到，也要放進 pipeline register，跟著它的指令一路帶到第五段；到了 WB，就拿這個一路跟過來的號碼當寫入位址。

### RegDst mux：只帶一個號碼往下走

問：lw 寫回的 register 號碼從哪裡來？
答：還是它自己原本那條指令，只是欄位不同。用一個 mux（多工器）由 RegDst 選：R-type 選 rd，lw 選 rt。

一個 R-type 在 ID 段時，rs、rt、rd 三個欄位都已經拿出來了。rd 現在用得到嗎？用不到，要到第五段才寫回。那可以丟掉嗎？不行，丟了等一下就不知道要寫去哪。所以它跟 control signal 一樣，先放進 pipeline register。

既然 decode 完就知道是 R-type 還是 lw，與其 rt、rd 兩個號碼一路都帶著走，不如用 mux 先選好，之後只帶一個 destination 往下傳。（教科書的圖把這個 mux 畫在 EX 段，所以 RegDst 屬於 EX 組；選完之後 EX/MEM、MEM/WB 都只帶一個號碼。）

> **陷阱** 這時 pipeline 裡同時有兩個「rt」：ID 段讀 register 用的是**新指令**的 rs、rt；WB 段寫回用的是**舊指令**一路跟過來的 rt 或 rd。兩者是不同的東西，畫 datapath 時千萬別把寫入位址接到 IF/ID 的欄位上。

sw、beq 這種不寫 register 的指令呢？位址照樣一路帶過去，但它們的 RegWrite = 0，到了第五段也不會寫，道理跟 single cycle 一樣。

> **重點** destination register 的號碼，功能就跟 control signal 很像：凡是「現在用不到、等一下才用」的東西，都要放進 pipeline register 一路往下傳。

## 例題：五個指令跑一遍，control 跟著指令走

> **例題** 以下五個指令依序進入 pipeline，追蹤每個 cycle 各段在做什麼、control signal 怎麼跟著指令走。

```asm
lw  $10, 20($1)
sub $11, $2, $3
and $12, $4, $5
or  $13, $6, $7
add $14, $8, $9
```

```
           CC1  CC2  CC3  CC4  CC5  CC6  CC7  CC8  CC9
lw         IF   ID   EX   MEM  WB
sub             IF   ID   EX   MEM  WB
and                  IF   ID   EX   MEM  WB
or                        IF   ID   EX   MEM  WB
add                            IF   ID   EX   MEM  WB
```

逐 cycle：

- **CC1**：lw 只做 IF。這段不需要任何 control signal，因為還不知道它是什麼指令。
- **CC2**：lw 進 ID，control 產生：EX 組 `0001`、M 組 `010`、WB 組 `11`（MemRead = 1、RegWrite = 1、MemtoReg = 1），在 cycle 結束時存進 ID/EX。sub 進來 IF。
- **CC3**：lw 到 EX，拿出 EX 組來用：ALUSrc = 1，ALU 第二個輸入選 sign extension 過來的 20，算位址 `$1` + 20。上一個 cycle 讀出的 rs 值、rt 值、sign-extend 後的立即值，也都放在 ID/EX 裡一起帶過來。同一個 cycle，sub 正在 ID，產生它自己的 control（EX `1100`、M `000`、WB `10`）。and 進來 IF。
- 問：sub 新產生的 control 會不會跟 lw 還在用的那一組打架？
  答：不會。新的值要等 clock edge 一來才寫進 ID/EX，那時 lw 已經用完它的 EX 組並往下走了。新的寫進去、舊的被蓋掉，剛剛好。
- **CC4**：lw 到 MEM，用 M 組（MemRead = 1）讀記憶體；sub 到 EX，用自己的 EX 組做減法；and 在 ID；or 在 IF。各段做不同指令的事，各做各的。過了 EX，lw 只剩 M、WB 兩組在 EX/MEM 裡往下帶，EX 組已經用掉。
- **CC5**：lw 到 WB，用 WB 組（RegWrite = 1、MemtoReg = 1）把記憶體資料寫回，寫入位址就是 mux 選好、一路跟過來的 `$10`。sub 在 MEM（M 組全 0，不做事）；and 在 EX；or 在 ID；add 在 IF。
- **CC6**：sub 寫回 `$11`。
- **CC7、CC8**：and 寫回 `$12`、or 寫回 `$13`。
- **CC9**：add 寫回 `$14`。

每個指令都帶著自己的 control 往前走，像帶著自己的說明書。五個指令一共 5 + 4 = **9 個 cycle**。

> **重點** k 段 pipeline 跑 N 個指令（沒有 hazard）需要 N + (k − 1) 個 cycle；五段就是 N + 4。

## pipeline 的加速：理想與現實

### 小結：基本概念

- datapath：single cycle 的 datapath 切好 stage，段與段之間加 pipeline register。
- control：一樣在第二段 decode，按照哪一段要用分好組，一路往下傳，傳到那一段才用；destination register 號碼這類等一下才用的東西也一起傳。
- 基本概念：工作分成好幾個 step，每個 step 用不同的硬體，所以可以同時被不同的指令執行；每個 clock cycle 開始下一個指令，同一個資源又都在同一段用，所以不會打架。
- MIPS 的好處：每個指令都是 32 位元一樣長、格式簡單，所以很容易做成 pipeline。

### 5 倍 speedup 只是理想

理論上切成五段就有 5 倍 speedup。

> **例題** 五段一樣長（每段 1 個時間單位），跑 1000 個指令。

```
不 pipeline：每個指令 5 單位 → 1000 × 5 = 5000
pipeline  ：(1000 + 4) 個 cycle × 1 = 1004
speedup   ：5000 / 1004 ≈ 4.98
```

很接近 5，但不是剛好 5，因為一開始要先花 4 個 cycle 把 pipeline 填滿。

> **例題** 五段的時間分別是 2、1、2、2、1。

```
不 pipeline：每個指令 2+1+2+2+1 = 8 單位
pipeline  ：clock 只能設成最長段 = 2，每個 cycle 完成一個指令
speedup   ：8 / 2 = 4（跑 1000 個指令：8000 / (1004 × 2) ≈ 3.98）
```

clock 要配合最慢的那一段，加速就只剩大約 4 倍。這就是切 stage 要盡量 balance 的原因。

最麻煩的還有 **hazard**：到目前為止，都假設每個指令都不依賴前一個，一路順順往下走。

### 理想 CPI = 1

用 CPI（每道指令平均花幾個 cycle）來看：pipeline 填滿之後，理想上每個 cycle 都有一道指令在 WB 做完，所以 **CPI = 1**。

一開始前 4 個 cycle 是在填 pipeline，還沒有指令做完。五段 pipeline 跑 N 道指令要 N + 4 個 cycle：

```
CPI = (N + 4) / N
N = 6           → 10 / 6   ≈ 1.67
N = 100         → 104 / 100 = 1.04
N = 10 億       → 幾乎就是 1
```

一個程式通常有幾十億道指令，多的 4 個 cycle 攤得很薄，所以初始填充不是大問題，可以說 CPI ≈ 1。真正讓 CPI 大於 1 的是 **stall**。

## Stall：汽車生產線的比喻

就算 pipeline 已經填滿（穩定狀態），CPI 還是可能不是 1，原因是 **pipeline stall**（管線停頓）。

> **比喻** 汽車生產線：第一站裝車門、第二站裝前輪、第三站裝後輪，後面還有很多站。每個 cycle 每台車往前一站，就像指令每個 cycle 前進一個 stage。

某個時刻，黑車在裝後輪，紫車在裝前輪，綠車在第一站裝車門。裝前輪時，機器把紫車的輪子弄壞了：

```
             裝車門   裝前輪        裝後輪       下一站
cycle t      綠       紫（輪子壞）  黑
cycle t+1    綠(擋住) 紫（重裝）    （空）       黑
cycle t+2    新車     綠            紫           （空）
cycle t+3    …        新車          綠           紫      （空格繼續往後走）
```

- cycle t+1：生產線往前移，黑車往下一站走；紫車沒有前輪，不能放它走（否則會做出沒有前輪的車），只好在原站多待一個 cycle 重裝。
- 紫車沒過來，裝後輪那站這個 cycle 沒車可做，工人只能閒著。
- 綠車的車門裝好了，可是前面被紫車擋住，也不能往前。
- cycle t+2：輪子裝好，大家往前走，但那個空檔，也就是 **bubble**（氣泡），會一路跟著往下走。

### stall 讓 CPI > 1

從生產線出口看：黑車離開之後，有一整個 cycle 沒有車做完，下一個 cycle 紫車才出來。每一次 stall，都讓某個 cycle「本來該完成一台，卻沒有完成」。

> **例題** 每 5 台車就 stall 一次。

```
5 台車需要 5 + 1 = 6 個 cycle
CPI = 6 / 5 = 1.2 = 1 + (平均每台 stall 數 1/5 = 0.2)
```

一般式：`CPI = 1 + 平均每道指令的 stall cycle 數`。有 stall 的 pipeline，CPI 一定**大於** 1。

汽車的 stall 來自輪子壞掉；處理器的 pipeline 裡，讓指令「卡住」的原因就是下面要講的 hazard。

## Hazard：管線危障

### hazard 是什麼

好幾個指令在 pipeline 裡重疊執行，一重疊就可能出問題。pipeline 裡發生、讓下一個指令沒辦法照原本的節奏在它該執行的那個 cycle 執行的狀況，就叫 **hazard**（危障）。共有三種：

| 種類 | 原因 | 跟 dependency 有關嗎 |
|---|---|---|
| structural hazard（結構危障） | 兩個指令在同一個 cycle 要用同一個硬體資源 | 無關，純粹搶硬體 |
| data hazard（資料危障） | 要用的資料得靠前一個指令算出來，但前一個還沒做完（還沒寫回） | 有關（data dependency） |
| control hazard（控制危障） | branch、jump 這類會改變流程的指令，讓 fetch 不知道下一個該抓哪個 | 有關（control dependency） |

### hazard 從哪來：datapath 上往回走的線

在 datapath 上看，data hazard 和 control hazard 都來自往回走的 **feedback path**：

1. WB 把結果寫回**前面**的 register file。
2. branch 算出新的 PC，送回**最前面**的 IF。

資料往回走，就可能來不及給後面的指令用。以前一次只做一個指令（sequential）沒有問題：前一個全部做完、都寫回去了，下一個才開始。pipeline 就不一樣了。

**data hazard 的來源**：寫 register 要到第五段才寫。假設一個指令要寫 R5，下一個緊接著要用 R5：

```
           CC1  CC2  CC3  CC4  CC5
寫 R5      IF   ID   EX   MEM  WB      ← CC5 才寫 R5
讀 R5           IF   ID                ← CC3 就讀 R5（前一個才在 EX）
```

讀在 CC3、寫在 CC5，下一個讀到的是舊資料，這就是 data hazard。

**control hazard 的來源**：beq 可能照順序往下走，也可能跳去 target。在這個 datapath 裡要到第四段 MEM 才知道跳不跳。可是下一個指令每個 cycle 都要進來，只好先猜：假裝照順序，PC = PC + 4，把後面的指令抓進來。

```
           CC1  CC2  CC3  CC4  CC5
beq        IF   ID   EX   MEM          ← CC4 才知道跳不跳
猜的 1          IF   ID   EX
猜的 2               IF   ID
猜的 3                    IF
```

真正知道時如果其實要跳，已經抓進來、做到一半的 **3 個指令**都錯了，要把它們 **flush**（像沖馬桶一樣沖掉）重來；猜對就正常繼續。（control hazard 的處理在下一部分詳談。）

### dependency 一定牽涉 write

data hazard 和 control hazard 的根源都是指令和指令之間的 **dependency**（相依）。什麼才算有 dependency 的問題？

- 兩個指令都只是**讀**同一個 register：沒關係，讀不會改變任何東西，誰先誰後結果都一樣。
- 一定要牽涉到 **write**：寫會改變 state，順序沒排好才會出錯。

control hazard 也是順序問題：branch 才到第二段就得 fetch 下一個，下一個是誰還不知道；為了讓 pipeline 保持滿的，只好先猜，猜對很好，猜錯就要處理。

> **觀念** 不管用什麼架構，都不能違反程式的意思：程式寫的是「前面寫完、後面才用」，後面就一定要拿到新資料。

### 萬用解：wait

要解決 hazard 永遠有一招：**wait（等）**。有相依，就等你寫回去我再做。

> **例題** 沒有任何其他技巧時，後一個指令要等前一個在 CC5 寫回之後，才能在 ID 讀 register。

```
           CC1  CC2  CC3  CC4  CC5  CC6  CC7  CC8  CC9
I1（寫）   IF   ID   EX   MEM  WB
I2（讀）                       IF   ID   EX   MEM  WB
```

I2 的 fetch 從 CC2 延到 CC5，多等 3 個 cycle。等一定能解決問題，但浪費 cycle；做 pipeline 就是要每個 cycle 都有東西出來，所以要想更好的辦法（forwarding 等，見下一部分）。

## Structural hazard

### 定義

同一個 clock cycle 裡，pipeline 中不只一個指令要用同一個 resource（記憶體、general purpose register、ALU……），產生衝突（resource clash）。它跟 dependency 無關，純粹是硬體不夠分。

### 例題：四個 phase、指令與資料共用一個 memory

> **例題** 四個 phase 的 pipeline：FI（fetch instruction，取指令）、DI（decode，解碼）、EI（execute，執行）、WR（write result，寫結果）。FI 要從 memory 讀指令，WR 在這個例子裡也要把結果寫進 memory，兩個 phase 都用到同一個 memory。四個指令 I1～I4。

照 pipeline 排，I1 在 decode 時 I2 被 fetch，I2 decode 時 fetch I3，I3 decode 時 fetch I4，一路錯開一格，七個 cycle 做完：

```
       T1   T2   T3   T4   T5   T6   T7
I1     FI   DI   EI   WR
I2          FI   DI   EI   WR
I3               FI   DI   EI   WR
I4                    FI   DI   EI   WR
```

看 T4 這一欄：I1 在 WR，要寫 memory；同一時間 I4 在 FI，要從 memory 讀指令。兩個指令搶同一個 memory，這就是 structural hazard（只有這一格衝突）。

**解法：I4 晚點 fetch。** I1、I2、I3 照原本的時間跑都沒問題，問題只在 I4 要 fetch 的那一點。T4、T5、T6 的 memory 分別被 I1、I2、I3 的 WR 占住，所以 I4 要等 I3 寫完，T7 才能 fetch：

```
       T1   T2   T3   T4   T5   T6   T7   T8   T9   T10
I1     FI   DI   EI   WR
I2          FI   DI   EI   WR
I3               FI   DI   EI   WR
I4                                   FI   DI   EI   WR
```

沒有任何一個 cycle 有兩個 phase 同時用 memory，衝突避開了。代價是時間：原本 7 個 cycle 做完，現在要 **10 個**。

### MIPS 的做法：memory 拆成兩塊

同樣的問題放到五段 MIPS 上：如果把 instruction memory 和 data memory 合成同一塊，一個指令在第四段存取資料，同一時間另一個指令在第一段要抓指令，兩個都要用這塊 memory。

```
           CC1  CC2  CC3  CC4  CC5  CC6  CC7  CC8
lw         IF   ID   EX   MEM  WB             ← CC4 讀資料
指令 2          IF   ID   EX   MEM  WB
指令 3               IF   ID   EX   MEM  WB
指令 4                    IF   ID   EX   MEM  WB   ← CC4 抓指令（衝突）
```

解法是拆成 **instruction memory** 和 **data memory** 兩塊，IF 用一塊、MEM 用另一塊，CC4 就不衝突了。這也就是做 pipeline 的條件：**每一個 stage 用的 resource 要不一樣**。

> **陷阱** 「共用一個 memory 會在第 4 個 cycle 產生 structural hazard」是在指令與資料共用 memory 的設定下才成立。教科書的五段 MIPS 把 instruction memory 和 data memory 分開，所以沒有這種 memory 的 structural hazard。

> **重點** structural hazard 的兩個解法：每個 resource 都在同一個 stage 用（R-type 不可提早在第四段寫回）、每個 stage 用不同的 resource（IM、DM 分開）。再加上每個指令相差一個 cycle，你用完就換我用，就永遠不衝突。

## Data hazard

一個指令執行時，要依賴另一個還在 pipeline 裡處理中的指令的結果，就是 data hazard。

### 在 datapath 上看：誰會讀到錯的 R5？

一個指令在 EX 已經算完，但要到第五段才寫回 R5。看它後面的指令在讀 register（ID）時，它走到哪裡：

| 寫 R5 的指令在 | 同時在 ID 讀 R5 的是 | 讀得到新值嗎 |
|---|---|---|
| EX（第 3 段） | 下一個 | 讀不到，還沒寫回 |
| MEM（第 4 段） | 下兩個 | 讀不到 |
| WB（第 5 段，正在寫） | 下三個 | 理論上還沒寫進去；若有 internal forwarding 就讀得到 |
| 已寫完 | 下四個以後 | 讀得到 |

register file 可以設計成 **internal forwarding**：利用 edge trigger，**clock 前半段先寫、後半段才讀**，同一個 cycle 寫進去的值，同一個 cycle 就讀得到。這樣下三個就 OK。

結論：下一個、下兩個只要讀的 source 剛好是 R5，就一定讀錯，這就是 data hazard。

### 例題：sub 寫 `$2`，後面誰讀到舊值？

> **例題** 下列程式中，sub 寫 `$2`，後面四個指令都讀 `$2`。哪幾個會讀到舊的 `$2`？

```asm
sub $2,  $1, $3     # 寫 $2
and $12, $2, $5     # 讀 $2
or  $13, $6, $2     # 讀 $2
add $14, $2, $2     # 讀 $2
sw  $15, 100($2)    # 讀 $2
```

```
           CC1  CC2  CC3  CC4  CC5  CC6  CC7  CC8  CC9
sub        IF   ID   EX   MEM  WB                     ← CC5 寫回 $2
and             IF   ID   EX   MEM  WB                ← CC3 讀 $2
or                   IF   ID   EX   MEM  WB           ← CC4 讀 $2
add                       IF   ID   EX   MEM  WB      ← CC5 讀 $2
sw                             IF   ID   EX   MEM  WB ← CC6 讀 $2
```

sub 要到 CC5 的 WB 才把結果寫回 `$2`；後面四個指令都在第二段讀 `$2`，分別是 CC3、4、5、6。照程式的意思，它們要的都是新的 `$2`。

| 指令 | 讀 `$2` 的 cycle | 不靠任何特別設計 | register file 有 internal forwarding |
|---|---|---|---|
| and | CC3 | 舊值（錯） | 舊值（錯） |
| or | CC4 | 舊值（錯） | 舊值（錯） |
| add | CC5（與寫同一個 cycle） | 錯 | 前半段寫、後半段讀 → 正確 |
| sw | CC6 | 正確 | 正確 |

- 不靠任何特別設計：and、or、add 三個都拿不到新值，只有 CC6 的 sw 正確。
- register file 做 internal forwarding 之後：只剩 **and、or** 兩個會讀錯，這兩個才是要另外處理的 data hazard。

## 三種 data hazard：RAW、WAR、WAW

暫存器只有讀、寫兩種動作，所以依兩個指令對**同一個暫存器**讀寫的先後，把 data hazard 分成三種。名字容易搞混，先約定：程式裡前面的指令叫 **I1**，後面的叫 **I2**；名稱「X after Y」的意思是 I2 做 X、I1 做 Y。

| 名稱 | I1 | I2 | 別名 | 正確順序 | hazard 是什麼 |
|---|---|---|---|---|---|
| RAW（read after write） | 寫 | 讀 | flow dependency、true dependency | I1 寫完 I2 才讀 | I1 還沒寫進去，I2 就先讀，讀到舊值 |
| WAR（write after read） | 讀 | 寫 | anti dependency | I1 讀完 I2 才寫 | I2 搶在 I1 讀之前先寫，I1 讀到被改過的新值 |
| WAW（write after write） | 寫 | 寫 | output dependency | 照 issue 順序，I1 先寫、I2 後寫 | I2 先寫、I1 後寫，最後留下的是 I1 的舊結果 |

### RAW

I1 先寫、I2 後讀，I2 依賴 I1 寫的資料。例：I1 是 ADD，結果寫進 R0；I2 是 SUB，要讀 R0。在 I1 把結果交出來之前，I2 不能用 R0，不然拿到舊值。上一節 sub `$2` 的例子就是 RAW。

MIPS 會發生 RAW：讀在第二段、寫在第五段，後面的指令很容易讀得太早。畫成時間軸看，I2 依賴 I1 的箭頭從 I1 的 WB（CC5）指向 I2 的 ID（CC3），**往左指**，等於時間倒流，這就是 RAW hazard。

### WAR

I1 讀、I2 寫同一個暫存器。例：I1 是 ADD，要讀 R0（或 R3）來做加法；I2 是 SUB，結果要寫進 R0。I1 在前面，本來該讀到**舊**的值；hazard 是 I2 不守規矩，搶在 I1 讀之前先寫，把舊資料蓋掉，I1 反而讀到新值，結果就錯了。這種情形比較少見，通常出現在有 **auto increment**（存取完自動把位址或 index 加一）的指令上。MIPS 沒有這種指令。

### WAW

I1、I2 都寫同一個暫存器，照程式的意思最後要留 I2 的值。例：I1 寫 5、I2 寫 6，答案應該是 6；如果 6 先寫、5 後寫，最後變成 5，就錯了。（同理，先寫 3 再寫 5 應該留 5，順序反了就變 3。）兩個指令都寫 R0 時，必須照它們 issue 的順序寫：誰先 issue 誰先寫。

### 為什麼五段 MIPS 只有 RAW

```
           CC1  CC2  CC3  CC4  CC5  CC6
I1         IF   ID   EX   MEM  WB
I2              IF   ID   EX   MEM  WB
                ↑ I1 在 CC2 讀       ↑ I2 在 CC6 寫
```

- **WAR 不可能**：I1 在 CC2 就讀完了；I2 比 I1 晚一個 cycle 開始，又在最後一段才寫，是 CC6。寫遠在讀之後，不可能搶先。
- **WAW 不可能**：大家都在第五段寫，I1 永遠早一個 cycle，I1 在 CC5 寫、I2 在 CC6 寫，順序不會顛倒，後面的沒辦法超越前面的去蓋掉它。
- **RAW 會發生**：I1 在 CC5 才寫，I2 在 CC3 就讀。

> **重點** 設計的關鍵：operand 一律在 ID 讀、write 一律放在最後一段，WAR、WAW 就絕對不會發生。三種 data hazard 裡，只有 RAW 會發生在五段 MIPS。

> **觀念** WAR 和 WAW 只會在指令平行執行或 out-of-order（不照順序）執行時出現；五段 MIPS 是照順序（in-order）執行的。它們的成因只是 compiler 剛好用了同一個暫存器名字，換一個暫存器，也就是 **register renaming**，就能完全避免。所以 RAW 才叫 **true dependency**：資料真的要從前面傳過來；WAR、WAW 只是名字撞到，又叫 **name dependency**。

> **陷阱** RAW 的「read after write」描述的是**正確的程式順序**（寫之後才讀），hazard 是硬體讓讀跑到寫之前。判斷種類時看「後面那個指令做什麼 after 前面那個指令做什麼」，不要把 I1、I2 弄反。

## Data hazard 的兩大類：前面是 R-type，還是 load

MIPS 的五段 pipeline 只會發生 RAW（read after write）這種 data hazard。要處理它，先問兩個問題：

- **誰會「寫」register？** 只有兩大類：R-type 指令，和 load（`lw`）。它們都在第五段 WB 寫回。
- **誰會「讀」register？** 各種指令都可能讀，而所有的讀 register 都在第二段 ID。

兩類寫的人，資料「出現」的時間不一樣：

| 前面的指令 | 資料什麼時候真的算好 | 規定什麼時候寫回 | 後面的指令馬上要用時 |
|---|---|---|---|
| R-type | 第 3 段 EX 結束就有了 | 第 5 段 WB | 資料已經在，只是還沒寫回 → **forwarding** 直接送過去 |
| load | EX 只算出記憶體位址，第 4 段 MEM 讀完記憶體才有 | 第 5 段 WB | 資料真的還不存在 → 只能 **stall**，停下來等 |

> **重點** 聽到 data hazard，就要想到兩大類：一種用 forwarding 馬上解決，一種一定要 stall。關鍵是「data 出來了沒」。實際程式的指令組合再多，後面讀的人都一樣在 ID 讀；前面寫的人只有 R-type 和 load 兩類，歸類完就只有這兩種情況。

### 有相依不一定有 hazard

第一個指令要寫回 `$5`，但要到 cycle 5 才寫。

- 下一個指令只晚一個 cycle，在 cycle 3 的 ID 就要讀 `$5`，還沒寫回，讀到舊值 → hazard。
- 如果讀的指令排在很後面，cycle 6 才讀，那時早就寫好了 → 沒有 hazard。

> **觀念** 有 dependency（相依）不一定有 hazard，要看兩個指令隔多遠。dependency 是程式本身的性質；hazard 是「在 pipeline 裡距離太近、讀到舊值」才發生。

- R-type 接 R-type：答案在第三段就算好了，不要從 register file 拿，直接送過去，這叫 **forwarding**（也叫 bypassing）。
- `lw` 接 R-type：`lw` 第四段讀完記憶體才有資料，下一個在 cycle 4 的 EX 就要用，資料還沒出來，只好 **stall**。

hazard 另一大類是 control（branch）hazard：branch 要過幾段才知道跳不跳，但每個 cycle 都要 fetch 新指令，只好先猜下一個是循序的（sequential），可能猜錯。stall 最簡單但傷 performance；改成先猜、猜錯再 flush，大部分會猜對。這部分在後面的 control hazard 一節講。

## 解 RAW 的第一招：internal forwarding（前半寫、後半讀）

沿用前面的例子：`sub` 寫 `$2`，後面 `and`、`or`、`add`、`sw` 都讀 `$2`。不做任何特別設計時，cycle 3、4、5 讀 register 的三個指令都拿不到新值，只有 cycle 6 才讀的 `sw` 是對的。

```asm
sub $2, $1, $3      # 寫 $2
and $12, $2, $5     # 讀 $2
or  $13, $6, $2     # 讀 $2
add $14, $2, $2     # 讀 $2
sw  $15, 100($2)    # 讀 $2
```

```
              CC1  CC2  CC3  CC4  CC5  CC6  CC7  CC8  CC9
sub $2        IF   ID   EX   MEM  WB
and ..,$2          IF   ID*  EX   MEM  WB
or  ..,$2               IF   ID*  EX   MEM  WB
add ..,$2                    IF   ID*  EX   MEM  WB
sw  ..($2)                        IF   ID   EX   MEM  WB
（ID* = 讀到 $2 的時間點早於或等於 sub 寫回的 CC5）
```

第三個 `add` 的狀況特別：`sub` 在 CC5 寫，`add` 也在 CC5 讀，同一個 cycle。

解法是把 register file 設計成 clock 一來就寫入（edge trigger，在時脈邊緣那一瞬間寫進去）。讀的那邊 clock 一來也開始讀，剛開始讀到的可能還是舊值；但過了半個 clock，寫的那邊已經寫好，下半個 clock 讀出來的就是新資料。

> **重點** internal forwarding：register file **前半個 cycle 寫、後半個 cycle 讀**。同一個 cycle 先寫後讀，`add` 的 hazard 就解決了。剩下 `and`、`or` 兩個要另外處理。

## 軟體解法：compiler 插 no-op

最簡單的方法是 **compiler insert no-op**：編譯器看到 dependency，就在中間插入什麼都不做的指令（no-op，no operation），讓 pipeline 空轉，等距離夠遠，資料就拿得到。

`and` 至少要在 CC5（`sub` 寫回的那個 cycle，靠前半寫後半讀）才讀得到 `$2`，比原本的 CC3 晚兩個 cycle，所以 `sub` 後面插兩個 nop：

```
              CC1  CC2  CC3  CC4  CC5  CC6  CC7  CC8  CC9  CC10 CC11
sub $2        IF   ID   EX   MEM  WB
nop                IF   ID   EX   MEM  WB
nop                     IF   ID   EX   MEM  WB
and ..,$2                    IF   ID   EX   MEM  WB
or  ..,$2                         IF   ID   EX   MEM  WB
add ..,$2                              IF   ID   EX   MEM  WB
sw  ..($2)                                  IF   ID   EX   MEM  WB
```

`and` 的 ID 正好落在 CC5，讀對了；後面的都更晚，也都對。五個指令總共 **11 個 cycle**。

用硬體 forwarding、不插 nop：五個指令 5 + 4 = **9 個 cycle**，省下 2 個。

> **觀念** 插 nop 軟體就做得到，但我們用 pipeline 就是為了加速，插一堆 nop 等於白白丟掉 clock cycle。所以要靠硬體：data hazard 的硬體處理就兩招，**forwarding** 和 **stall**。

## Forwarding：結果早就算好，就放在 pipeline register 裡

有問題的是 `and` 和 `or`：它們讀完 register，在 EX 要拿 `$2` 來算。`sub` 的結果在 CC3（它自己的 EX）就算好了，只是規定第五段才能寫，所以 CC4、CC5 它一直都在，只是還沒寫回 register file。那就直接拿來用。

> **觀念** 問：`sub` 算完、還沒寫回的時候，資料放在哪裡？丟掉了嗎？
> 答：沒丟，就在 pipeline register 裡。

pipeline register 用前後兩段的名字來叫，中間畫一條斜線：IF/ID、ID/EX、EX/MEM、MEM/WB。

| 時間 | `sub` 的結果在哪 | 誰要用 | 從哪拿 |
|---|---|---|---|
| CC4 | EX/MEM | `and`（在 EX） | 從 EX/MEM forward |
| CC5 | MEM/WB | `or`（在 EX） | 從 MEM/WB forward |
| CC5 | 正在寫回 register file | `add`（在 ID） | internal forwarding，正常讀 |

```
              CC1  CC2  CC3  CC4  CC5  CC6  CC7  CC8  CC9
sub $2        IF   ID   EX   MEM  WB
and ..,$2          IF   ID   EX   MEM  WB            （CC4 從 EX/MEM 拿）
or  ..,$2               IF   ID   EX   MEM  WB         （CC5 從 MEM/WB 拿）
add ..,$2                    IF   ID   EX   MEM  WB    （CC5 前寫後讀）
sw  ..($2)                        IF   ID   EX   MEM  WB
```

要學會 forwarding 要搞懂兩件事：
1. **datapath 要怎麼改**（資料從哪條線送過去）；
2. **什麼時候要 forward**（control，由誰判斷、條件是什麼）。

## Datapath：ALU 前面的 3 選 1 mux

放大 EX 附近：左邊 ID/EX，中間 ALU，右邊 EX/MEM、data memory、MEM/WB。

- 正常狀況：ALU 的資料是從 register file 讀出來，經過 ID/EX 送進來。
- 依賴**前一個**指令：資料在 **EX/MEM** 裡。
- 依賴**前兩個**指令：資料在 **MEM/WB** 裡。

把這兩個地方的資料拉回來，接到 ALU 輸入前面。ALU 每個輸入就有三種來源，所以兩個輸入前面**各放一個 3-to-1 mux**：

```
             ┌──────────────┐
ID/EX (rs值) ─┤00            │
EX/MEM 結果 ──┤10  mux A     ├──► ALU 上方輸入
MEM/WB 結果 ──┤01            │
             └──────────────┘
             ┌──────────────┐
ID/EX (rt值) ─┤00            │
EX/MEM 結果 ──┤10  mux B     ├──► ALU 下方輸入
MEM/WB 結果 ──┤01            │
             └──────────────┘
         ForwardA、ForwardB 由 forwarding unit 送出
```

## Forwarding unit：00、10、01

控制這兩個 mux 的是 **forwarding unit**：

| mux control | 選哪個 | 意思 |
|---|---|---|
| 00 | ID/EX（register file 讀出的值） | 正常，不 forward |
| 10 | EX/MEM | 從前一個指令 forward（最新的） |
| 01 | MEM/WB | 從前兩個指令 forward（write back 那段的） |

運算元有兩個，所以發兩個訊號：**ForwardA 管 rs、ForwardB 管 rt**。兩者不一定一樣，可能 rs 依賴前一個、rt 依賴前兩個。

### 它怎麼知道要送哪一個

要讀的是 rs、rt。如果前面指令要寫的 destination 剛好是 rs 或 rt，就可能有 dependency。所以：

- 光讀出 rs、rt 的「值」不夠，rs、rt 的「**號碼**」也要傳進 ID/EX，交給 forwarding unit 去比。就算這次不需要 forward，讀了哪幾個 register，號碼也一定要記下來往下傳。
- 比的對象有兩個：**EX/MEM 的 rd** 和 **MEM/WB 的 rd**，都是等一下要寫回的目的地。
- 這裡的 rd 是經過 RegDst mux 選過的：load 取 rt、R-type 取 rd，最後只剩一個 destination 號碼往下傳。

### 只比號碼夠嗎？還要看 RegWrite

> **觀念** 問：只比 rs、rt 跟 rd，「我讀的跟你要寫的一樣就 forward」，這樣夠不夠？
> 答：不夠。不管什麼指令，rs、rt、rd 這些欄位都會被拿出來一路傳下去，裡面一定有值。如果前一個是 `sw`、`beq` 這種根本不寫 register 的指令，欄位剛好一樣也不能 forward，它根本沒要寫。所以要把 **RegWrite** 也拉給 forwarding unit，RegWrite = 1 才算數。

> **陷阱** destination 是 `$0` 要不要 forward？不用。`$0` 永遠是 0，寫了也不會變；若把算出來的值 forward 過去反而錯。所以還要加一條 **rd ≠ 0**。

forwarding unit 的 input / output 整理：

| 來源 | 拉進 forwarding unit 的東西 |
|---|---|
| ID/EX（現在在 EX 的指令） | rs 號碼、rt 號碼 |
| EX/MEM（前一個指令） | rd 號碼（RegDst 選過）、RegWrite |
| MEM/WB（前兩個指令） | rd 號碼（RegDst 選過）、RegWrite |
| output | ForwardA（給 rs 的 mux）、ForwardB（給 rt 的 mux），各為 00 / 10 / 01 |

## Forwarding 的完整條件

這些條件不用背，懂了意思自然寫得出來：前一個（或前兩個）指令**要寫**、寫的**不是 `$0`**、寫的**正是我要讀的**。

```
EX hazard（從前一個指令，EX/MEM）：
if (EX/MEM.RegWrite
    and (EX/MEM.RegisterRd ≠ 0)
    and (EX/MEM.RegisterRd = ID/EX.RegisterRs))   ForwardA = 10

if (EX/MEM.RegWrite
    and (EX/MEM.RegisterRd ≠ 0)
    and (EX/MEM.RegisterRd = ID/EX.RegisterRt))   ForwardB = 10

MEM hazard（從前兩個指令，MEM/WB）：
if (MEM/WB.RegWrite
    and (MEM/WB.RegisterRd ≠ 0)
    and not (EX/MEM.RegWrite and (EX/MEM.RegisterRd ≠ 0)
             and (EX/MEM.RegisterRd = ID/EX.RegisterRs))
    and (MEM/WB.RegisterRd = ID/EX.RegisterRs))   ForwardA = 01

if (MEM/WB.RegWrite
    and (MEM/WB.RegisterRd ≠ 0)
    and not (EX/MEM.RegWrite and (EX/MEM.RegisterRd ≠ 0)
             and (EX/MEM.RegisterRd = ID/EX.RegisterRt))
    and (MEM/WB.RegisterRd = ID/EX.RegisterRt))   ForwardB = 01

以上都不成立：ForwardA = 00、ForwardB = 00
```

- 例：`sub` 寫 `$2`、下一個 `and` 讀 `$2`（rs）→ EX hazard，ForwardA = 10。
- 例：`or $13,$6,$2` 的 rt 依賴前兩個的 `sub` → MEM hazard，ForwardB = 01。
- 例：前一個是 `sw`，欄位剛好也是 `$2` → RegWrite = 0，ForwardA 仍為 00。
- rt 的條件和 rs 一模一樣，把 rs 換成 rt 就是 ForwardB。

MEM hazard 那條多出來的 `not (…)`，就是下一節的 double data hazard。

做完 forwarding，`sub`、`and`、`or`、`add`、`sw` 這串：`and` 從 EX/MEM 拿、`or` 從 MEM/WB 拿、`add` 在 CC5 靠 internal forwarding，**一個 cycle 都不用 stall**。

## Double data hazard：兩個都寫同一個，拿最新的

假如前一個指令要寫 R3，前兩個指令也要寫 R3，而我的 rs 要讀 R3。EX/MEM 和 MEM/WB 兩邊都符合 forward 的條件，要拿誰的？

答案是 **EX/MEM（前一個指令）**。照程式順序，最後寫 R3 的是前一個，它的值才是最新的。

> **例題** 再看一個例子：三個指令連續累加到 `$1`，第三個要拿誰的結果？

```asm
add $1, $1, $2
add $1, $1, $3
add $1, $1, $4      # 讀 $1：前一個、前兩個都寫 $1
```

```
                CC1  CC2  CC3  CC4  CC5  CC6  CC7
add $1,$1,$2    IF   ID   EX   MEM  WB
add $1,$1,$3         IF   ID   EX   MEM  WB
add $1,$1,$4              IF   ID   EX   MEM  WB
```

CC5 第三個指令在 EX：EX/MEM 裡是第二個的 `$1`（新），MEM/WB 裡是第一個的 `$1`（舊）。要取第二個的，**ForwardA = 10**。（CC4 第二個在 EX 時，它的 rs `$1` 依賴第一個，同樣 ForwardA = 10。）

整理 forwarding logic：ALU 前的 mux 三個 input，一個是正常讀出來的，兩個是還沒寫回的。00 選正常的，01 選 write back 那段的，10 選最新的、在 memory 那段的。兩邊都能 forward 時，要取 memory 那段最新的，不能取到 write back 的。

> **重點** 寫成條件：先看前一個（要寫、rd ≠ 0、等於我的 rs），成立就送 10。前兩個的條件都一樣，但要**多加一條**：前一個的條件不成立時，才去看前兩個，一樣就送 01。

## 我在 EX 時，爸爸和祖父在哪裡

做例子之前先注意兩件事。

1. **forwarding unit 是在 EX 這段做檢查**，不是在 ID 讀 register 的時候。因為不是每次都要 forward：正常狀況下，rs、rt 照樣從 register file 讀出來送進 ID/EX，等 ALU 真的要算時才檢查要不要換掉。
2. **我在 EX 時，前面的指令在哪裡？**

> **比喻** 家族比喻：前一個指令是「爸爸」，前兩個是「祖父」。我在 EX 時，爸爸在 MEM，結果在 **EX/MEM**；祖父在 WB，結果在 **MEM/WB**。

立體的 datapath 圖容易看花，可以改看只有時間的圖：每列一個指令，往右是 clock cycle。看 CC5 這一欄：

```
           CC1  CC2  CC3  CC4  CC5  CC6
祖父       IF   ID   EX   MEM  WB        ← 結果在 MEM/WB
爸爸            IF   ID   EX   MEM       ← 結果在 EX/MEM
我                   IF   ID   EX        ← 正在 EX，forwarding unit 在這裡比對
```

這個搞清楚，判斷要 forward 誰才不會亂。

## 例題：sub、and、or、add，每個 cycle 的 ForwardA／ForwardB

```asm
sub $2, $1, $3      # 寫 $2
and $4, $2, $5      # rs=$2, rt=$5，寫 $4
or  $4, $4, $2      # rs=$4, rt=$2，寫 $4
add $9, $4, $2      # rs=$4, rt=$2，寫 $9
```

```
              CC1  CC2  CC3  CC4  CC5  CC6  CC7  CC8
sub $2,$1,$3  IF   ID   EX   MEM  WB
and $4,$2,$5       IF   ID   EX   MEM  WB
or  $4,$4,$2            IF   ID   EX   MEM  WB
add $9,$4,$2                 IF   ID   EX   MEM  WB
```

**CC4：`and` 在 EX**
- ID/EX 存著 `and` 的 source 號碼 2（rs）和 5（rt），讀完不能丟。
- 爸爸 `sub` 在 MEM，結果在 EX/MEM，同時記著「destination 是 2」。
- 比對 rs：2 = EX/MEM.rd = 2。`sub` 會寫 register 嗎？會，RegWrite = 1。寫的是 `$0` 嗎？不是。條件全成立 → **ForwardA = 10**。
- rt 的 `$5` 沒有依賴 → **ForwardB = 00**。

**CC5：`or` 在 EX**
- 爸爸 `and`：destination 4；祖父 `sub`：destination 2。兩個都是 R-type，RegWrite = 1。
- `or` 要讀 rs = 4、rt = 2。
- rs 的 4 對到爸爸 → **ForwardA = 10**。
- rt 的 2 對到祖父（爸爸寫的是 4，不衝突）→ **ForwardB = 01**。兩個 mux 選的不一樣。

**CC6：`add` 在 EX**
- 爸爸 `or` 寫 4，祖父 `and` 也寫 4，兩個都要寫 4 → double data hazard，取最新的爸爸 → **ForwardA = 10**。
- rt 的 `$2`：`sub` 早在 CC5 寫回，`add` 在 CC5 的 ID 靠前半寫後半讀已讀到新值 → **ForwardB = 00**。

| 週期 | 在 EX 的指令 | EX/MEM（爸爸）rd | MEM/WB（祖父）rd | ForwardA | ForwardB |
|---|---|---|---|---|---|
| CC4 | `and $4,$2,$5` | 2（sub） | — | 10 | 00 |
| CC5 | `or $4,$4,$2` | 4（and） | 2（sub） | 10 | 01 |
| CC6 | `add $9,$4,$2` | 4（or） | 4（and） | 10 | 00 |

有了 forwarding，這四個指令完全不用 stall，5 + 3 = **8 個 cycle** 做完。

## Load-use：forwarding 救不了，一定要 stall

再把所有指令分析一次：讀 register 的指令很多，但讀一定在第二段；寫的只有 R-type 和 load。

- 前一個是 R-type：EX 就算好，下一個來到 EX 時直接 forward，箭頭往右（往未來）走，沒問題。
- 前一個是 load：EX 只是在算地址，要等 memory access 做完，也就是 **CC4 結束**，資料才出來。下一個指令 **CC4 一開始**做 EX 就要用了。箭頭得往回走，時間倒流，forward 也沒辦法。

```
                CC1  CC2  CC3  CC4  CC5  CC6
lw  $2,20($1)   IF   ID   EX   MEM  WB
                               └─ 資料在 CC4 結束才有
and $4,$2,$5         IF   ID   EX   ...
                               ↑ CC4 開始就要用 → 時間倒流，無法 forward
```

> **重點** cannot always forward：**load 後面馬上用它的結果（load-use），一定要停一個 cycle**。停一拍等於中間插一個 nop；讀的人 EX 延到 CC5，這時資料已經在 MEM/WB，再 forward 就好。

兩種做法：
- 軟體：compiler 在中間插一個 no-op。
- 硬體：在 run time 用 **hazard detection unit** 自己偵測，自己插。

硬體「插 no-op」的意思：讓這個指令**再做一遍**。同一個指令下個 cycle 再 decode 一次，後面那個也再 fetch 一次；第一次 decode 出來的那份不要了，control 全部給 0 往下傳，就是一個什麼都不做的 nop，也叫 **bubble**。

所以要做兩件事：一個偵測這種情況的 controller，以及讓 datapath 真的停得下來。

## 在 ID 偵測 load-use，讓 pipeline 停一拍

### 為什麼在 ID 就能偵測

假設前一個是 `lw $2`，我這個 `and` 在 ID，又要讀 `$2`。

- 我在 decode，我的 rs、rt 是誰已經很清楚（在 **IF/ID** 裡）。
- 前一個 `lw` 正在 EX，它的資料和 control 全都在 **ID/EX** 裡。
- 怎麼知道它是不是 load？看 **MemRead**，只有 load 會讀記憶體。所以把 ID/EX.MemRead 拉進來。
- 再把前一個的 destination 號碼拉進來。前一個是 load，而且 destination 等於我的 rs 或 rt，就一定要 stall。

### 怎麼 stall

我現在在 decode，一定會產生一組 control signal。不管它的話，下個 cycle 它就送去執行了；可是我們要停一拍，這份 control 不能用。

1. 在 Control 和 ID/EX 之間放一個 mux，改選 **0**：control 全是 0，進到 EX 就是 no-op（bubble）。
2. IF/ID 裡的 `and` 要留著，下個 cycle 再做一遍，所以 **IF/IDWrite = 0**，不讓新指令寫進來。
3. PC 本來要寫 PC + 4，現在不寫：**PCWrite = 0**，同一個指令再 fetch 一次。

> **重點** stall = control 給 0 插一個 bubble，PC 和 IF/ID 不動讓指令重做。

### Hazard detection unit：別忘了是 rt

| | 內容 |
|---|---|
| input | ID/EX.MemRead（前一個是不是 load）、ID/EX.RegisterRt（load 的 destination）、IF/ID.RegisterRs、IF/ID.RegisterRt（我要讀的） |
| output | PCWrite = 0、IF/IDWrite = 0、control mux 選 0 |

```
if (ID/EX.MemRead
    and ((ID/EX.RegisterRt = IF/ID.RegisterRs)
         or (ID/EX.RegisterRt = IF/ID.RegisterRt)))
    stall the pipeline one cycle:
        PCWrite = 0；IF/IDWrite = 0；ID/EX 的 control 全部設 0
```

> **陷阱** 一定要拿 **ID/EX 的 rt** 來比，不是 rd。load 的 destination 是 rt（`lw rt, offset(rs)`），這點考試考過。

驗一下：`lw` 後面讀它的結果（放在 rs 或 rt）→ 要停；不相關的 → 不用；前面是 `add` 這種 R-type → 不用停，交給 forwarding。

硬體上就是在讀 register 那裡多一個 hazard detection unit；它的 control 就是把上面的條件寫成布林式。下一個 cycle，送進 ID/EX 的 control 全是 0，灰色的 bubble 就是它；IF/ID 沒換，`and` 再 decode 一次；PC 沒改，同一個 `or` 再抓一次。這就叫 **insert a bubble**。

## 例題：lw 之後先 stall 再 forward

把前面例子的第一個指令換成 load：

```asm
lw  $2, 20($1)      # destination 是 rt = $2
and $4, $2, $5
or  $4, $4, $2
add $9, $4, $2
```

**CC3：偵測**
- `lw` 在 EX（ID/EX 裡），MemRead = 1 → 是 load；ID/EX.rt = 2。
- `and` 在 ID（IF/ID 裡），要讀 rs = 2、rt = 5。ID/EX.rt = IF/ID.rs → 條件全中，stall。
- 動作：control mux 選 0，讓 0 往下傳；PCWrite = 0、IF/IDWrite = 0。

**CC4**：0 在 EX 變成 bubble；`and` 還在 ID（再 decode 一次）、`or` 還在 IF（再 fetch 一次），因為 IF/ID、PC 沒被寫入，內容不變。

```
                CC1  CC2  CC3  CC4  CC5  CC6  CC7  CC8  CC9
lw  $2,20($1)   IF   ID   EX   MEM  WB
and $4,$2,$5         IF   ID   ID   EX   MEM  WB
(bubble)                       EX   MEM  WB
or  $4,$4,$2              IF   IF   ID   EX   MEM  WB
add $9,$4,$2                        IF   ID   EX   MEM  WB
```

接著換 forwarding unit 上場：

**CC5：`and` 在 EX**，要讀 2 和 5。
- 爸爸（EX/MEM）是 bubble，RegWrite = 0，沒東西。
- 祖父（MEM/WB）是 `lw`，destination 2。因為已經延了一拍，`lw` 讀出來的資料已經到 MEM/WB。
- rs → **ForwardA = 01**（從 MEM/WB）；rt 的 `$5` 正常 → **ForwardB = 00**。

**CC6：`or` 在 EX**，load 的問題已經過去，只看要不要 forward。讀 4 和 2。
- 爸爸 `and` 寫 4，RegWrite = 1，等於 rs → **ForwardA = 10**。
- 祖父是 bubble，沒影響。
- rt 的 `$2`：`lw` 在 CC5 已寫回，`or` 在 CC5 的 ID 後半段就讀到 → **ForwardB = 00**。

**CC7：`add` 在 EX**，讀 4 和 2。
- 爸爸 `or` 寫 4，祖父 `and` 也寫 4 → 取最新的爸爸，**ForwardA = 10**；rt **ForwardB = 00**。

| 週期 | 在 EX | EX/MEM（爸爸） | MEM/WB（祖父） | ForwardA | ForwardB |
|---|---|---|---|---|---|
| CC4 | bubble | `lw`（rd 2） | — | — | — |
| CC5 | `and $4,$2,$5` | bubble | `lw`（rd 2） | 01 | 00 |
| CC6 | `or $4,$4,$2` | `and`（rd 4） | bubble | 10 | 00 |
| CC7 | `add $9,$4,$2` | `or`（rd 4） | `and`（rd 4） | 10 | 00 |

總共 4 + 4 + 1 = **9 個 cycle**：`lw` 後面多一個 bubble，`and` 的 ID 做兩次、`or` 的 IF 做兩次。

> **重點** data hazard 兩種情況總結：前面是 R-type → 結果已算出，always forward；前面是 load、下一個馬上讀 → 先 stall 一個 cycle，再 forward（從 MEM/WB）。考試很喜歡考 control signal（ForwardA/B、PCWrite、IF/IDWrite）怎麼設，懂了就會，不用背。

## 常被混淆：lw 後面接 sw 不一定要 stall

```asm
lw $t0, 0($a0)
sw $t0, 0($a1)      # 把剛載入的值存回記憶體
```

這有資料相依，但 `sw` 要用 `$t0` 的地方是 **MEM 段**（當作要寫進記憶體的資料），不是 EX：

```
               CC1  CC2  CC3  CC4  CC5  CC6
lw $t0,0($a0)  IF   ID   EX   MEM  WB
                               └──────┐  資料 CC4 結束出現，CC5 在 MEM/WB
sw $t0,0($a1)       IF   ID   EX   MEM←┘ CC5 才要寫記憶體
```

`lw` 的資料 CC4 結束就有（在 MEM/WB），`sw` 在 CC5 的 MEM 才需要它，時間是往前走的。只要有 **MEM 階段的 forwarding**（MEM/WB → data memory 的寫入資料），就**不必 stall**。

> **陷阱** 真正即使有 forwarding 也一定要停一個 cycle 的是 **load-use**：`lw` 的結果被下一條指令在 **EX** 使用。`lw` 接 `sw` 存回剛載入的值，不屬於這種。
> 但若 `sw` 是拿剛載入的值當**位址的 base**，例如 `lw $t0,…` 接 `sw $t1, 0($t0)`，位址在 EX 計算，就是 load-use，要停一拍。
> 另外，若題目的 datapath 只有 ALU 前的 forwarding（沒有 MEM 階段的 forwarding），`lw` 接 `sw $t0` 仍要停一拍，作答時先看清楚題目給的硬體。

## Control hazard：branch 會改變 PC

第三種 hazard 是 **control hazard**（也叫 branch hazard），是 pipeline 裡最複雜的一種。它出在 branch、條件判斷這類會改掉 PC（下一個要抓的指令位址）的指令：程式接下來往哪走，由 branch 自己決定。

想像一個 branch 在 pipeline 的最前面。它在 decode 時，pipeline 已經在 fetch 下一個指令了，可是 branch 還沒決定跳不跳，根本不知道下一個是誰。不管怎樣都一定要 fetch 一個，只好先挑一個抓進來；挑錯了就叫 **branch misprediction**（分支預測錯誤）。if-else 也一樣：要等前面的結果出來，才知道下一個該去哪裡拿。

- 一般指令：PC = PC + 4。
- `beq` taken：算出 target（例如 1000），跳過去；not taken：PC + 4（sequential）。
- unconditional branch（`j`）一定跳。

到這裡三種 hazard 都認識了：**structural、data、control**。

> **觀念** branch hazard 也是 feedback 造成的：「要跳去哪」要到很後面才寫回 PC，但 pipeline 要裝滿，`beq` 才到 decode，下一個就要 fetch 進來了。抓進來的跟最後的決定不一樣，就是 branch hazard。

### 決定得越晚，flush 越多

什麼時候才知道要不要跳？decode？execute？還是 memory？看 datapath 怎麼切。若在第四段 MEM 才決定：

```
                    CC1  CC2  CC3  CC4  CC5  CC6  CC7  CC8
beq (taken)         IF   ID   EX   MEM  WB
                                   ↑ CC4 才決定要跳
下一個 (PC+4)            IF   ID   EX   → flush
再下一個                      IF   ID   → flush
再再下一個                         IF   → flush
target                                  IF   ID   EX   MEM ...
```

如果要跳，已經進來的 3 個指令都得犧牲；target 要到 CC5 才 fetch，**branch penalty = 3 個 cycle**，太浪費了。

> **觀念** 問：這樣洗掉來得及嗎？
> 答：來得及。只有寫 register、寫記憶體才會改變 state，這些指令都還沒走到 MEM／WB，清掉沒有副作用。

決定能不能往前移？多加一點硬體就好。

- 移到 IF？不行，指令才剛抓進來，連它是不是 branch 都不知道。
- 最快可以移到 **ID**：decode 完就知道它是 branch，rs、rt 也讀出來了，在 ID 多放一個比較器比一下就好；target 位址也在 ID 算好。

```
                    CC1  CC2  CC3  CC4  CC5  CC6  CC7
beq (taken)         IF   ID   EX   MEM  WB
                         ↑ CC2 就決定
下一個 (PC+4)            IF   → flush（IF/ID 清成 0）
target                        IF   ID   EX   MEM  WB
```

跟猜的一樣（not taken）就繼續；猜錯了才 flush：把 IF/ID 裡剛抓的那一個清成 0，PC 改選 target。只犧牲 1 個 cycle，**penalty 從 3 降到 1**。

## Flush：猜錯就沖掉

假設 `beq` 其實要跳，可是 IF 已經抓了一個錯路上的指令進來。一發現要去的地方跟抓進來的不一樣，就把錯的指令 **flush** 掉。

> **比喻** flush 就像沖馬桶：整個沖走，當作沒抓過。

為什麼能直接沖？錯的指令才走到前面幾段，還沒寫任何東西；沒寫，state 就沒變，沖掉不會留後遺症。

### Flush 就是變成 bubble

> **觀念** 問：怎麼 flush 一個指令？
> 答：把那個指令變成一個 **bubble**。bubble 跟著 pipeline 往前流，但裡面是空的。

怎樣才算變成 bubble？讓它不改變任何 state，也就是暫存器和記憶體的內容。這種什麼都不做的指令叫 **no-op**（no operation），它不會去寫任何東西。讀一下沒關係，真正危險的是寫，所以 flush 的重點就是：**絕對不能讓它寫**。

### 做法：control 全設 0

- **已經 decode 過、在中間段的指令**：把它的 control signal 全部設成 0。例如 `lw` 原本 RegWrite = 1、MemRead = 1，通通變 0。control 全是 0，就是不寫暫存器、不讀也不寫記憶體；指令還在 pipeline 裡流，卻什麼事都不做。
- **還在 IF、還沒 decode 的指令**：把抓進來的 32 位元指令整個清成 0。

> **例題** `lw $4, 50($7)` 被 flush 掉（指令清成 0）會變成什麼？

`lw $4, 50($7)` 的機器碼（I-format：op, rs, rt, immediate）：

| 欄位 | op | rs | rt | immediate |
|---|---|---|---|---|
| 十進位 | 35 | 7 | 4 | 50 |
| 二進位 | 100011 | 00111 | 00100 | 0000 0000 0011 0010 |

合起來 `1000 1100 1110 0100 0000 0000 0011 0010` = `0x8CE40032`。

清成 `0x00000000` 之後，op = 0 是 R-format，funct = 0 是 `sll`，rs = rt = rd = 0、shamt = 0，解出來就是：

```asm
sll $0, $0, 0       # 把 $0 左移 0 位寫回 $0：什麼都沒做
```

這就是 MIPS 的 `nop`。

> **重點** 已經在中間的，把 control signal 設 0；還在 IF 的，把指令本身設 0。兩種都是讓它不做事，這個位置就像塞了一個 bubble。control hazard 猜錯時，處理方法就是 flush。flush 掉的指令等於白做、傷 performance，所以越早發現越好：本來在第 4 段（MEM）決定要 flush 3 個，移到第 2 段（ID）只 flush 1 個。

## Deeper pipeline：猜錯的代價更大

比較三種 pipeline：

| pipeline | 在第幾段決定跳不跳 | 猜錯要 flush 幾個 |
|---|---|---|
| 五段，在 ID 決定 | 2 | 1 |
| 五段，在 MEM 決定 | 4 | 3 |
| 較深，例如 8 段，在第 6 段決定 | 6 | 5 |

> **重點** 規律：**branch penalty = 決定的 stage − 1**。pipeline 越深（或 superscalar 這種一次跑好幾條的），決定又在很後面，猜錯的 penalty 就越大、越明顯。

那為什麼還要切那麼深？stage 切越多，每段事情越少，clock cycle 越短，效能越高。可是一猜錯，後面全部犧牲。所以「**猜對**」這件事非常重要。

### 最簡單的猜法：predict not taken

`beq` 要到 decode（第 2 段）才決定，但第 1 段已經要 fetch：fetch 哪個，就是在猜。

- 可以猜「跟上一次一樣」，但要記錄歷史，比較複雜。
- 最直覺的是 PC = PC + 4，假設循序執行（**predict not taken**）；真的跳就猜錯、flush 重來。

> **陷阱** 只猜 PC + 4 常常會錯：loop 最後的 branch 大部分都要跳回 loop 的頭。loop 會執行很多次（1000 次、1 萬次），每次跳回頭都猜錯，所以不能只用 PC + 4。更好的預測方法接在下一節。

## 考試題型：給一段組合語言，算實際 stall 幾個 cycle

考題常直接給一段含 `lw`、branch 的指令序列，要你手算實際的 stall cycle 數，不只是代公式。作法：

1. 先確定題目的假設：有沒有 forwarding（ALU 前？MEM 段？）、register file 是否前半寫後半讀、branch 在哪一段決定、用什麼預測（例如 predict not taken）。
2. 從上往下逐條看，每個讀 register 的指令往上找最近的寫者：
   - 寫者是 R-type → forwarding，0 stall。
   - 寫者是 `lw`、而且就是**緊鄰的上一條**、讀的人在 **EX** 要用 → load-use，stall 1。
   - `lw` 隔一條以上 → 從 MEM/WB forward（或已寫回），0 stall。
   - `lw` 接 `sw` 存回同一個值、有 MEM 段 forwarding → 0 stall。
3. branch 猜錯（例如 predict not taken 但實際 taken）→ 加上 penalty（決定 stage − 1）。
4. 總 cycle = 5 + (實際執行的指令數 − 1) + stall 數。

### 例題：逐條判斷再畫時序圖（示意）

假設：五段 pipeline，ALU 前有完整 forwarding，也有 MEM 段 forwarding（MEM/WB → data memory 寫入資料）；register file 前半寫後半讀；branch 在 ID 決定，predict not taken；`beq` 實際 taken。

```asm
      lw   $t0, 0($a0)       # I1
      add  $t1, $t0, $t2     # I2  緊接著用 $t0
      lw   $t3, 4($a0)       # I3
      sw   $t3, 8($a0)       # I4  把剛載入的 $t3 存回
      lw   $t4, 12($a0)      # I5
      sub  $t5, $t1, $t2     # I6
      and  $t6, $t4, $t5     # I7  $t4 來自隔一條的 lw，$t5 來自上一條
      beq  $t7, $zero, L     # I8  實際 taken
      or   $s1, $s2, $s3     # I9  錯路，會被 flush
      ...
L:    add  $s0, $t6, $t1     # I10
```

逐條判斷：

| 指令 | 讀的 register 與最近寫者 | 判斷 | stall |
|---|---|---|---|
| I2 `add` | `$t0` ← I1 `lw`（緊鄰） | load-use，EX 要用 | 1 |
| I4 `sw` | `$t3` ← I3 `lw`（緊鄰），當寫入資料用；base `$a0` 無人寫 | MEM 段 forwarding | 0 |
| I6 `sub` | `$t1` ← I2 `add`（隔 3 條，已寫回或可 forward）；`$t2` 無人寫 | 無 hazard | 0 |
| I7 `and` | `$t4` ← I5 `lw`（隔一條）；`$t5` ← I6 `sub`（緊鄰，R-type） | ForwardA = 01、ForwardB = 10 | 0 |
| I8 `beq` | `$t7`、`$zero` 都沒被前面寫 | 無 data hazard；taken 但猜 not taken | 1（flush I9） |
| I10 `add` | `$t6` ← I7、`$t1` ← I2，都已寫回 | 無 hazard | 0 |

時序圖（`--` 表示 bubble 所在）：

```
          CC1 CC2 CC3 CC4 CC5 CC6 CC7 CC8 CC9 CC10 CC11 CC12 CC13 CC14 CC15
I1  lw    IF  ID  EX  MEM WB
I2  add       IF  ID  ID  EX  MEM WB
bubble                    EX  MEM WB
I3  lw            IF  IF  ID  EX  MEM WB
I4  sw                    IF  ID  EX  MEM WB
I5  lw                        IF  ID  EX  MEM WB
I6  sub                           IF  ID  EX  MEM  WB
I7  and                               IF  ID  EX   MEM  WB
I8  beq                                   IF  ID   EX   MEM  WB
I9  or                                        IF   --（flush，變 bubble）
I10 add                                            IF   ID   EX   MEM  WB
```

檢查關鍵 cycle：
- CC3：I2 在 ID、I1 在 EX，ID/EX.MemRead = 1、ID/EX.rt = `$t0` = IF/ID.rs → stall；CC4 插 bubble，I2 再 ID、I3 再 IF。
- CC5：I2 在 EX，祖父 MEM/WB 是 I1 → ForwardA = 01。
- CC8：I4 `sw` 在 MEM，I3 的資料在 MEM/WB → MEM 段 forwarding，不用停。
- CC10：I7 在 EX，爸爸 I6（`$t5`）→ ForwardB = 10；祖父 I5（`$t4`）→ ForwardA = 01。
- CC10：I8 在 ID 決定 taken，I9 已在 IF → flush；CC11 改抓 I10。

計數：實際執行（不算被 flush 的）9 條指令，理想需要 5 + (9 − 1) = 13 個 cycle；stall 1（load-use）+ 1（branch flush）= 2，共 **15 個 cycle**。平均每條指令 stall 2/9，CPI ≈ 1 + 2/9 ≈ 1.22。

改變假設看看差多少：
- 若沒有 MEM 段 forwarding（只有 ALU 前的 forwarding）：I4 `sw` 也要停 1 → 16 個 cycle。
- 若 branch 在 MEM 才決定：flush 3 個 → 15 − 1 + 3 = 17 個 cycle。

> **陷阱** branch 移到 ID 決定後，比較用的 rs、rt 要在 ID 就備好。若 `beq` 的運算元剛好由**前一條**指令算出（或前一兩條是 `lw`），ID 時資料還沒到，需要額外 stall；上面的例題故意讓 `beq` 不依賴前面的結果，避開這種情況。作答時遇到這種組合要特別檢查。

## Predict not taken：把 branch 決定搬到 ID

以 `beq` 為例：兩個暫存器相等就跳到 target。問題是 branch 在 pipeline 裡走到「決定點」之前，硬體根本不知道要不要跳，但 pipeline 每個 cycle 都得抓一個指令進來。最省事的做法是照順序繼續 fetch（PC + 4），等於先假設 branch 不會跳，這叫 **predict not taken**（預測不跳）。

- 猜對（真的 not taken）：照順序抓進來的指令都是對的，沒有損失。
- 猜錯（其實 taken）：決定之前多抓的那幾個指令全是錯的，必須 **flush**（沖掉）。所以 predict not taken 需要額外的硬體：做出決定之後，能把抓錯的指令清掉。

如果決定點在 MEM（第 4 段），決定時後面已經抓了 3 個指令，猜錯三個全錯。決定得越晚，錯的代價越大：

| branch 在第幾段決定 | 決定時已多抓的指令 | 猜錯要 flush 幾個（penalty） |
|---|---|---|
| 第 2 段 ID | 1 | 1 |
| 第 3 段 EX | 2 | 2 |
| 第 4 段 MEM | 3 | 3 |
| 第 6 段（深 pipeline，示意） | 5 | 5 |

> **重點** penalty = 決定點所在的 stage 編號 − 1。早點做決定，錯也早點錯，不必在 pipeline 走了半天才 flush。

### 怎麼把決定搬到 ID

1. **target 位址提早算**：branch target = PC + 4 + offset × 4。原本在 EX 用 ALU 算，改成在 ID 多放一個加法器來算。
2. **條件提早比**：`beq` 的 rs、rt 在 ID 就已經從 register file 讀出來，再加一個比較器（相等嗎？），branch decision 在 ID 就做得出來。

這樣決定時只有 IF 多抓的「那一個」是錯的，只要 flush 一個。

### 怎麼 flush 那一個指令

讓 IF/ID 這次寫進去的是 0，而不是剛從 instruction memory 讀出來的指令。做法是在 IF/ID 前面加一個 2-to-1 mux：平常寫入剛讀的指令，要 flush 時寫入 0。控制這個 mux 的訊號稱為 **IF.Flush**。ID 裡偵測到「這是 `beq`，而且比較結果相等、要跳」，就發出 IF.Flush；同時 ID 已經算好 target，PC 直接改成 target，下一個 cycle 就抓 target 的指令。犧牲的只有一個 bubble。

> **觀念** 全部是 0 的指令就是 `sll $0, $0, 0`，也就是 nop；IF/ID 清成 0 等於把那個指令變成什麼都不做的 bubble。

### 例題：beq 在 ID 判定 taken

程式（位址為十進位）：

```asm
36: sub ...
40: beq $1, $3, 7      # $1 == $3 就跳
44: and ...
     ...
72: lw  ...
```

- cycle 3：`beq` 在 ID 比較 `$1` 和 `$3`，相等，要跳。
- target = 40 + 4 + 7 × 4 = 44 + 28 = **72**，也在 ID 算好。
- 下一個 clock：IF/ID 寫入 0（44 的 `and` 被清掉），PC 改成 72。
- cycle 4：44 的 `and` 變成 bubble，72 的 `lw` 被抓進來，抓對了。

```
           CC1  CC2  CC3  CC4  CC5  CC6  CC7  CC8
36 sub     IF   ID   EX   MEM  WB
40 beq          IF   ID*  EX   MEM  WB             * ID 判定 taken，算出 target=72
44 and               IF   nop  nop  nop  nop       ← IF.Flush，變成 bubble
72 lw                     IF   ID   EX   MEM  WB
```

3 個有效指令共用 8 個 cycle，只多付了 1 個 bubble。

## Dynamic branch prediction

### 一律猜 not taken 的問題

taken 就跳到 target，not taken 就是 PC + 4。乍看之下程式大多是照順序走，猜 PC + 4 好像不錯，但要看 branch 從哪裡來：

- **if-then-else**：只走過一次，猜錯一次無所謂。
- **for loop**：迴圈最後一個指令是 branch，要跳回開頭，這是 **taken**，而且會執行很多很多次。

> **例題** 一個迴圈跑 101 次，迴圈尾端的 branch 前 100 次 taken（跳回開頭）、第 101 次 not taken（離開）。一律猜 not taken 會錯 **100 次**，只對最後 1 次。

所以預測不該固定，改用 **dynamic branch prediction**（動態分支預測）：每個 branch 的預測會隨它過去的表現改變。

### 最簡單的規則：照上一次

上一次跳了，這次就猜跳；上一次沒跳，這次就猜不跳。

- **怎麼記**：用 branch 指令的位址當 index，去一張表查它上一次跳了沒。
- **什麼時候查**：instruction fetch 的時候就要查。抓某個位址時，若它是 branch 且上次 taken，下一個就直接去 target 抓。
- **為什麼這麼在意**：pipeline 很長、branch 又很晚才決定的話，猜錯一次要 flush 很多指令，代價很大。

這張表叫 **branch prediction buffer**，也叫 **branch history table（BHT）**。表不可能很大，只記最近遇到的 branch：位址，以及 taken 還是 not taken。查到就照它猜，真的猜錯才 flush。

## Branch history table 的長相與查法

### 表裡記什麼

每個 branch 一列，記錄它上一次是 taken（1）還是 not taken（0）。

- 一開始還不知道，就用 default，例如全部先猜 not taken，記成 0。
- 位址 48 的 branch 第一次出現，預測 not taken（0），結果其實要跳：猜錯，把那個 bit 更新成 1。
- 下次再遇到這個指令，查到 1，就猜 taken。

```
  branch 位址 | 上次結果
  ------------+---------
       48     |  0  → 實際 taken，猜錯 → 改成 1
```

### 用 associative memory 實作

抓指令時，PC 的值就是這個 branch 的位址（例如 48），拿它去查表。但這張表不能用一般陣列做：

- **一般陣列**：index 是固定的，知道 index 是 100 就直接去第 100 格拿。若用這種方法，每一個可能的指令位址都要留一格，需要非常大一塊記憶體，太浪費。
- **associative memory**（關聯式記憶體）：只有少少幾個 entry，每個 entry 除了內容，還存著「我是哪個位址」。查的時候拿位址去跟每個 entry 存的位址比對，對上（match）了才讀出內容。

例如 5 個 entry，就記最近 5 個 branch 的位址和它們是 taken 還是 not taken。查表時 5 個 entry **同時**比對：有 match 就讀出預測；全都沒有 match，表示最近沒碰過這個 branch，就照預設的方法猜。

### 例題：associative 查表

表只有 3 個 entry，index 要「寫出來」存在表裡，因為它不是照順序排的：

```
  index（存在表內） | 內容
  -----------------+------
          3        |  A
          5        |  B
          7        |  C
```

- 讀 5：把 5 **同時**跟 3、5、7 比對，第二個 match，讀出 **B**。
- 讀 4：跟 3、5、7 都不一樣，沒有 match，什麼都不讀出來（表裡沒有它）。

這樣就不必每個位址都記，只記最近跳過的那幾個 branch，代價是每一筆都要同時存「位址」和「內容」。預測結果就存在內容欄。

### 和 cache 是同一種東西

這種查表用的記憶體就是 **cache**（下一章的主題）。背景是：

- 記憶體分好幾層，主記憶體在 CPU 晶片外面（off chip），存取一次要很久。
- pipeline 的 clock 要配合最慢的 stage。若 MEM 每次都真的去主記憶體，整條 pipeline 每一拍都被拖長。
- 所以 CPU 旁邊放一個小而快的 cache，常用的東西放進去，通常一個 cycle 就拿到。

branch history table 就用同樣的方式做：小、快、只存最近用到的那幾筆。

## 查表、預測、猜錯時 flush 加 flip

每次 fetch 指令前的流程：

1. 拿 PC 去查表，看有沒有 match。
2. 有 match 就讀出預測：
   - 猜不跳 → 抓 **fall through**，也就是 PC + 4。
   - 猜跳 → 抓 target。要抓 target 就得知道 target 在哪，所以 target address 也要記（見下面的 branch target buffer）。
3. 等 branch 真正決定，若發現猜錯，做兩件事：
   - **flush** pipeline，沖掉抓錯的指令；
   - **flip** prediction：把預測翻過來。只用 1 個 bit 記，所以一猜錯就馬上翻。例如表裡記 taken（1），這次實際 not taken，就改成 0。

預測錯的 penalty 很大，所以大家都想把 branch prediction 做得更好。

## 1-bit predictor 與巢狀迴圈

**1-bit predictor**：跳記 1、不跳記 0，這次就照上一次猜。它在某些情況不夠用，最典型的就是 **loop 裡面還有 loop**（巢狀迴圈），例如 inner loop 跑 50 次、outer loop 跑 100 次，這種程式非常常見。inner loop 的 branch 每跑完一輪就會猜錯，outer 跑 100 次就錯 100 次以上。只要牽涉到 loop，錯一次就被乘上很多倍。

> **重點** 最佳化時要特別盯著 loop，這就是設計原則 **make the common case fast**（讓最常發生的情況變快）。loop optimization 本身就是一個常見的研究題目。

### 例題：1-bit 跑巢狀迴圈

inner loop 每一輪：結尾的 branch 前 100 次都 taken（跳回頭），第 101 次 not taken（離開 inner loop，回到 outer loop）。設預測 bit 起始為 1（taken）。

第 1 輪 inner loop：

| inner 第幾次 branch | 預測（bit） | 實際 | 對錯 | 更新後 bit |
|---|---|---|---|---|
| 1 | T（1） | T | 對 | 1 |
| 2 | T（1） | T | 對 | 1 |
| … | T（1） | T | 對 | 1 |
| 100 | T（1） | T | 對 | 1 |
| 101 | T（1） | **N** | **錯**：flush，bit 翻成 0 | 0 |

跳出 inner loop，outer loop 做完一圈，又進入 inner loop。第 2 輪：

| inner 第幾次 branch | 預測（bit） | 實際 | 對錯 | 更新後 bit |
|---|---|---|---|---|
| 1 | **N（0）** | T | **錯**：flush，bit 翻成 1 | 1 |
| 2 | T（1） | T | 對 | 1 |
| … | T（1） | T | 對 | 1 |
| 100 | T（1） | T | 對 | 1 |
| 101 | T（1） | **N** | **錯**：flush，bit 翻成 0 | 0 |

第 3 輪之後都和第 2 輪一樣。

```
第 1 輪：錯 1 次（出口）
第 2 輪：錯 2 次（重新進來的第一次 + 出口）
第 3 輪：錯 2 次
...
```

問題在哪：taken → not taken 只是一次性的，只在出口發生一次，大部分時候都是 taken。錯一次就把 bit 翻掉，太早下結論，結果下一輪一進來又錯。

> **陷阱** 1-bit predictor 在巢狀迴圈裡，inner loop 每一輪錯 **2 次**（出口一次、下一輪第一次），不是 1 次。只有第一輪（若起始預測是 taken）錯 1 次。

## 2-bit predictor：錯兩次才翻

改成「連錯兩次才翻」：

- loop 出口那次猜錯，但只錯一次，預測仍維持 taken。
- 下一輪再進 inner loop，預測 taken，實際也 taken，猜對。

### 例題：省一次有差嗎

outer loop 跑 1000 輪，每輪 inner loop 的 branch 執行 101 次，總共 1000 × 101 = 101000 次 branch。

| predictor | 第 1 輪 | 之後每輪 | 總錯誤數 | 錯誤率 |
|---|---|---|---|---|
| 1-bit | 1 | 2 | 1 + 999 × 2 = **1999** | 1999 / 101000 ≈ **1.98%** |
| 2-bit | 1 | 1 | 1000 × 1 = **1000** | 1000 / 101000 ≈ **0.99%** |

多花一個 bit，錯誤就砍半。預測錯誤率就是要壓到這麼低（零點幾到一點多 %），所以值得多用一個 bit。

### 四個 state 的 finite state machine

兩個 bit 有四種組合，所以 2-bit predictor 就是一個 **4 個 state 的 finite state machine**：兩個 state 預測 taken，兩個 state 預測 not taken。兩個 bit 用兩個 flip-flop 存；**下一個 state 由「現在的 state」加上「這次實際的結果」決定**，用很簡單的 control 電路就做得出來。

state 怎麼編號（state assignment）都可以。以下以 00 為起點、往右兩格是 not taken 這側：

```
     預測 taken            |        預測 not taken
  ┌────────┐  N   ┌────────┐  N   ┌────────┐  N   ┌────────┐
  │ 00 強T │ ───> │ 01 弱T │ ───> │ 10 弱N │ ───> │ 11 強N │
  │        │ <─── │        │ <─── │        │ <─── │        │
  └────────┘  T   └────────┘  T   └────────┘  T   └────────┘
   T：留在原地                                     N：留在原地
```

| 現在 state | 預測 | 實際 T → 下一個 state | 實際 N → 下一個 state |
|---|---|---|---|
| 00（強 taken） | T | 00 | 01 |
| 01（弱 taken） | T | 00 | 10 |
| 10（弱 not taken） | N | 01 | 11 |
| 11（強 not taken） | N | 10 | 11 |

- 在最左邊的 taken state，這次也真的 taken，就留在原地。
- 出現一次 not taken：往右移一格，但這格還是預測 taken，不會馬上改口。
- 連續兩次 not taken，才移到預測 not taken 的那一邊。
- not taken 那側也一樣：在強 not taken，要兩次 taken 才回到預測 taken。

> **例題** 現在在 00，branch 來了，預測 taken；實際 not taken，猜錯 → 走到 01。下一個 branch 來，在 01 仍預測 taken；萬一又 not taken → 走到預測 not taken 的 10，下一次才猜 not taken。

> **陷阱** state 的編號與箭頭畫法各書不同。有的畫法在「弱」state 猜錯時直接跳到另一側的「強」state，而不是相鄰的弱 state。考試一律照題目給的圖走，不要套自己記的編號。

### 例題：2-bit 跑同一個巢狀迴圈

起點 00（強 T）。

| inner 第幾次 branch | 現在 state | 預測 | 實際 | 對錯 | 下一個 state |
|---|---|---|---|---|---|
| 第 1 輪 1～100 | 00 | T | T | 對 | 00 |
| 第 1 輪 101 | 00 | T | N | **錯** | 01 |
| 第 2 輪 1 | 01 | **T** | T | **對** | 00 |
| 第 2 輪 2～100 | 00 | T | T | 對 | 00 |
| 第 2 輪 101 | 00 | T | N | **錯** | 01 |

出口那一次只把 state 從強 T 降到弱 T，下一輪第一次仍猜 taken，猜對。每一輪只錯 1 次。

## 猜 taken，可是 target 在哪：branch target buffer

### 光知道「要跳」不夠

就算預測要跳，還得知道跳去哪裡。在這個設計裡，target 是在第 2 個 cycle（ID）才算出來的（原本在 EX 算，為了提早決定才整個搬到 decode）。可是 IF 在 cycle 2 就要抓下一個指令，那時 target 還沒算好；就算猜 taken，也不知道去哪抓，還是要多等 1 個 cycle。

```
           CC1  CC2  CC3
beq        IF   ID        ← target 在 CC2 的 ID 才算好
next            IF?       ← CC2 就要抓，只知道「猜 taken」，不知道位址
```

所以表裡只用一個 bit 記 taken／not taken 不夠，**target address 也要記**。

### 要記哪個 target

問：表裡要記哪一個位址？
答：表裡為什麼會記著 taken？因為上一次它真的跳了，而那時就已經算出它跳去哪裡。把那次算出的 target 一起存起來即可。

於是表裡每一列有三欄：

```
  branch 位址 | T/N | target
  ------------+-----+-------
       48     |  T  |   96
```

之後拿 PC 查表，若命中且預測 taken，target（例如 96）同時讀出來，下一個 cycle 馬上去 96 抓，不用等。這種邊跑邊記、邊預測的方法就是 dynamic prediction，這張連 target 都存的表叫 **branch target buffer（BTB）**。

> **觀念** 看起來只差一個 cycle，但 loop 會一直重複，一錯就錯很多次，所以預測錯誤率通常要壓到很低的個位數百分比。

## Delayed branch：把那一個 slot 拿來做正事

前面都是在「猜」。處理 control hazard 的另一種想法叫 **delayed branch**（延遲分支）。

`beq` 在 ID 決定，ID 結束就知道要不要跳，再過一個 clock 就能抓正確的指令。但在它決定的那個 cycle，IF 已經抓了一個指令進來：抓 PC + 4，結果要跳，錯；抓 target，結果不跳，也錯。其實只差這一個 cycle。

換個想法：這個多出來的 slot（**delay slot**）放一個「**不管跳不跳，本來就要執行**」的指令，那抓什麼都不會錯。

### 例題：把 add 搬進 delay slot

```asm
# 原本
add  $s1, $s2, $s3     # 不管跳不跳都會執行
beq  $s2, $zero, L
...                    # delay slot：原本會抓到 fall through 的指令

# compiler 重排後
beq  $s2, $zero, L
add  $s1, $s2, $s3     # delay slot：always executed
```

- 搬之前檢查 dependency：`add` 寫 `$s1`，`beq` 只讀 `$s2` 和 `$zero`，彼此沒有相依，可以安全搬到 `beq` 後面。
- 就算 `beq` 跳走了，這個 `add` 本來也要執行，完全不用 flush。

```
              CC1  CC2  CC3  CC4  CC5  CC6
beq           IF   ID   EX   MEM  WB             ← ID 決定
add (slot)         IF   ID   EX   MEM  WB        ← 照常走完五段，不浪費
L 或 下一條             IF   ...                 ← 依決定抓正確的指令
```

### 定義與條件

- **delayed branch**：branch 後面緊接的那一個指令，不管跳不跳都一定執行（always executed）。硬體永遠抓下一個指令（看起來像 predict not taken），卻沒有 penalty；效果上等於 branch 的決定晚一個 cycle 才生效，所以叫 delayed。
- 這是 **compiler** 的技巧：把指令重新排列（reorder）。
- 條件是能搬：跟 branch 有 dependency 的指令不能亂搬。
- 大約 50% 的情況找得到這種指令；找不到，delay slot 只好放一個 **nop**（no-op）。
- 不需要 flush：下一個指令不是有用的指令就是 nop，都不用沖掉。

> **重點** pipeline 淺、在 ID 就決定，只要塞 1 個指令，很好找；pipeline 很深、要塞 3 個，就很難塞滿。

## 整理：處理 control hazard 的三種機制

這三個機制有關，但不是混在一起用的，很容易搞混，分開記：

| 機制 | 做法 | 猜錯時 | 需要的東西 |
|---|---|---|---|
| 一、predict not taken | 一律抓 PC + 4 | flush；決定在第 2 段 flush 1 個、第 3 段 2 個、第 4 段 3 個 | flush 硬體；五段 pipeline 把決定搬到 ID，penalty 1 cycle |
| 二、delayed branch | compiler 在 branch 後面的 slot 放「跳不跳都要執行」的指令，找不到放 nop | 沒有「猜錯」：下一個本來就該執行 | compiler 重排；適合 pipeline 短、slot 只有 1 個 |
| 三、branch history table（dynamic prediction） | 用 branch 位址查表，照歷史猜 T/N，配合 BTB 讀出 target | flush + 更新預測 | 更多硬體（表、比對電路） |

### 為什麼需要機制三

- 機制一的缺點：always not taken，遇到 taken 就要 flush。五段 pipeline flush 一個還可以，但高效能處理器可能切到 10 個 stage 以上；決定點若在第 6 段，猜錯就要 flush 5 個。
- 不能亂猜：迴圈的 branch 大多是 taken，一律猜 not taken 會一直錯。
- 電晶體越來越便宜，大家做更長的 pipeline、更短的 clock。這時第 2 段本來就很忙，沒辦法隨便把 branch 決定往前搬，只好靠預測，用 branch history table 把歷史記下來（要更多硬體），用在高效能的設計。

> **陷阱** delayed branch 不是一種「預測」。它是另一個想法：用 compiler 塞有用的指令，讓 slot 裡的指令本來就該執行，所以不用 flush；branch prediction 則是猜，猜錯一定要 flush。

## Branch 對 CPI 的影響

pipeline 填滿之後，理想上每個 cycle 完成一個指令，CPI = 1；每一次 stall 都讓某個 cycle「本該完成一個卻沒完成」。所以：

```
CPI = 1 + 平均每個指令的 stall cycles
branch 造成的 stall / 指令 = branch 比例 × 猜錯比例 × 每次猜錯的 penalty
```

> **比喻** 生產線每 5 台車出一次狀況、多卡 1 個 cycle，就要 6 個 cycle 才完成 5 台：CPI = 6 / 5 = 1.2 = 1 + 1/5。

### 例題：比較幾種處理 branch 的方式（示意）

設定（示意數字）：程式中 20% 的指令是 branch，其中 60% 實際 taken；沒有其他 stall。

1. **不預測，每個 branch 都 stall 到決定為止**（決定在 ID，每個 branch 停 1 cycle）
   - stall / 指令 = 0.2 × 1 = 0.2
   - CPI = 1 + 0.2 = **1.20**
2. **predict not taken，決定在 ID**（猜錯 = taken 的那 60%，penalty 1）
   - stall / 指令 = 0.2 × 0.6 × 1 = 0.12
   - CPI = 1 + 0.12 = **1.12**
3. **predict not taken，決定在 MEM**（penalty 3）
   - stall / 指令 = 0.2 × 0.6 × 3 = 0.36
   - CPI = 1 + 0.36 = **1.36**
4. **2-bit predictor + BTB，決定在 ID**，預測正確率 90%（猜錯 10%，penalty 1；猜對 taken 時 BTB 直接給 target，不損失）
   - stall / 指令 = 0.2 × 0.1 × 1 = 0.02
   - CPI = 1 + 0.02 = **1.02**

```
方式                               stall/指令      CPI
不預測（每個 branch stall 1）      0.2×1     =0.20  1.20
predict not taken，ID 決定         0.2×0.6×1 =0.12  1.12
predict not taken，MEM 決定        0.2×0.6×3 =0.36  1.36
2-bit + BTB，ID 決定（90% 準）     0.2×0.1×1 =0.02  1.02
```

### 例題：深 pipeline 時預測的效益（示意）

同樣 20% branch、60% taken，但 pipeline 很深，branch 在第 6 段才決定（猜錯 penalty = 5）。

- 一律猜 not taken：stall / 指令 = 0.2 × 0.6 × 5 = 0.6 → CPI = **1.6**
- dynamic predictor 正確率 90%：stall / 指令 = 0.2 × 0.1 × 5 = 0.1 → CPI = **1.1**
- 加速比（指令數、clock 相同）= 1.6 / 1.1 ≈ **1.45 倍**

penalty 越大，預測準確率帶來的差距越大，這就是深 pipeline 一定要做 dynamic prediction 的原因。

### 例題：1-bit 與 2-bit 換算成 CPI（示意）

沿用上面巢狀迴圈的錯誤率（1-bit 1.98%、2-bit 0.99%，這部分是 branch 本身的猜錯比例），另設 branch 占指令 20%、猜錯 penalty 5（示意）：

- 1-bit：0.2 × 0.0198 × 5 = 0.0198 → CPI ≈ **1.020**
- 2-bit：0.2 × 0.0099 × 5 = 0.0099 → CPI ≈ **1.010**

> **陷阱** 「猜錯比例」是針對 branch 而言，要先乘上 branch 在所有指令中的比例，才是每個指令的 stall。題目若給的是「predict not taken」，猜錯比例就是 taken 的比例；給的是預測正確率 p，猜錯比例是 1 − p。還要看清楚 penalty 是幾個 cycle（由決定點在第幾段而定），以及猜對 taken 時有沒有 BTB（沒有 BTB 的話，猜對 taken 仍要等 target 算出來）。

## Exception 與 interrupt

branch 之外，另一個會打斷正常流程的是 **exception**（例外）：寫程式時沒預期、但執行時發生的事件（unexpected event），程式只好停下來，跳去作業系統（OS）處理。原因有兩大類：

- **I/O**：例如硬碟資料讀完了，要通知原本在等的程式。process A 做 I/O 時會把 CPU 讓給 process B；I/O 做完一定要通知 A，不然 A 永遠沒辦法繼續。
- **程式本身出問題**：例如解碼出一個不認得的 opcode（**undefined opcode**），或運算 **overflow**。

MIPS 的用詞：

| 名稱 | 來源 | 例子 |
|---|---|---|
| exception | CPU **內部**發生 | undefined opcode、arithmetic overflow |
| interrupt | **外部** I/O controller 送來 | I/O 做完，送 signal 給 CPU 說「我這邊好了」，CPU 再找時間處理 |

> **觀念** exception 也是一種 control hazard：本來照順序執行，突然要停下來、改去執行別的程式，control flow 就變了。一發生，pipeline 裡做到一半的指令可能都要 flush，會犧牲效能。跳到 OS 也沒什麼特別，OS 也是一組程式，只是它是 system program，不是使用者寫的。

> **陷阱** exception／interrupt 的分法是 MIPS 的定義；有些架構把兩者都叫 interrupt。作答時照題目採用的定義。

## 處理 exception：EPC、Cause、入口位址

先不管 pipeline，當成一次執行一個指令（single cycle）來想。CPU 正在執行位址 1000 的指令，突然來了一個沒預期的 signal。不同事件處理方式不同，但共同點是：正常流程要停下來。

### 1. 跳去 OS：改 PC

跳去 OS 其實就是改 PC。例如 OS 的處理程式從 34686 開始，就把 PC 從 1000 改成 34686。本來該執行下一個指令，結果跳到別的地方，所以說 exception 也是 control hazard。

### 2. 記下 PC：EPC

處理完很多情況還要回來（像 I/O，只是暫停一下，處理完繼續原本的程式），所以要先把被打斷的指令（**offending instruction**）的位址存進一個特別的暫存器：**EPC（Exception Program Counter）**，這裡記 1000。處理完把 EPC 放回 PC，程式就從那裡繼續。

回來要回到哪一個指令，分兩種：

| 狀況 | 被打斷的指令 | 回來時 |
|---|---|---|
| I/O interrupt | 通常讓它做完再處理 | 執行**下一個**指令 |
| exception（如 overflow） | 指令本身出問題，沒做完 | **重新執行**這個指令 |

### 3. 記下原因：Cause

原因存在 **Cause register**，因為 OS 有很多種處理程式，handler 要知道是哪一種狀況。簡化成只有兩種 exception 時，一個 bit 就夠：

```
Cause = 0  → undefined opcode
Cause = 1  → overflow
```

因為是 exception，出問題的指令不會被做完，接著馬上跳去 handler。

### 4. 跳去 handler：single entry 或 vectored

| 方法 | 做法 |
|---|---|
| **single entry**（MIPS） | 只有一個入口，位址 **8000 0180**（十六進位），不管哪種 exception 都跳到這裡；入口程式再看 Cause 是 0 還是 1，跳到 undefined opcode 或 overflow 的 handler |
| **vectored interrupt**（向量式中斷） | 直接拿原因當 index 查一張表，表裡寫著每種原因的 handler 位址，直接跳過去；例如 undefined opcode → handler A 的位址，overflow → handler B 的位址 |

> **比喻** single entry 像一個大門：大家都從這裡進去，進去之後再由 OS 判斷是哪一種、帶到對應的處理程式。vectored interrupt 則像每種事件各有自己的門，直接走到對應的房間。

### 5. handler 做完之後

- **restartable**（可以重新開始）：用 EPC 跳回原來的程式繼續。
- 救不回來的錯誤：**terminate** 這個程式，並 **report error**。

## Pipeline 裡的 exception

上面的步驟不管有沒有 pipeline 都要做到，但 pipeline 同時有好多指令：出事指令的前面有快做完的，後面也有剛抓進來的。所以在 pipeline 裡，exception 就像一個 control hazard：流程要改，跳去 OS 的位址。

> **重點** 原則：出事之前的指令讓它們做完，出事的指令和之後的指令通通 flush，記 Cause、EPC，再跳到 handler。整件事就像一個沒預測到的 branch：抓錯的沖掉，改去抓 handler 的指令。

例如 `add $1, $2, $1` 在 EX 算出 overflow：絕對不能讓 `add` 把結果寫進 `$1`，寫下去 program state 就被改了，錯誤會留下來。所以前面的 `and`、`or` 繼續做完；`add` 和後面的 `slt`、`lw` 全部 flush，再把原因記進 Cause。

### Exception 需要的硬體

假設 exception 發生在 EX（例如 overflow）：

1. **flush 訊號**：EX 和它前面 ID、IF 的 control signal 都要能清成 0，所以加了 **IF.Flush、ID.Flush、EX.Flush** 三條訊號。發生 exception 時這些訊號變成 1，把那些指令的 control 清成 0。
2. **PC 前的 mux 多一個輸入**：把 **8000 0180** 接到 PC 前面的 mux。一發現 exception 就把它載入 PC，下一個 cycle 開始抓 handler 的指令。
3. **兩個暫存器**：**Cause** 記原因，**EPC** 記出事指令的位址，之後靠它回來。

> **重點** flush 就是把 control signal 設成 0。哪個 stage 出事，那裡和後面進來的都 flush，前面的讓它做完，跟 control hazard 的處理幾乎一樣。

可以重來的 exception：先 flush，handler 處理完，再回到那個指令從頭執行一次，好像什麼都沒發生。I/O interrupt 通常讓那個指令做完才處理，overflow 則要從那個指令重新開始。所以 PC 存起來之後，要由 handler（軟體）判斷要從哪一個指令繼續。

### 例題：4C 的 add 發生 overflow

程式從 40 開始（位址為十六進位），handler 在 8000 0180，它的第一個指令是一個 `sw`，先把一些東西存起來：

```asm
40:  sub ...
44:  and ...
48:  or  ...
4C:  add $1, $2, $1      # 發生 overflow
50:  slt ...
54:  lw  ...
...
80000180: sw ...         # handler 第一個指令
```

- cycle 1～5：每個 cycle 抓一個，大家照常往前走（沒有 stall）。
- cycle 6：`add` 進 EX，算出 overflow。從 `add` 開始，`add`（EX）、`slt`（ID）、`lw`（IF）全部 flush，control signal 清成 0。前面的 `and`、`or` 繼續做完：`and` 在 cycle 6 寫回，`or` 在 cycle 7 寫回；`sub` 早就做完了。
- 同時 EPC 記下位址（教科書的硬體存的是 4C + 4 = **50**），Cause 記成 overflow；PC 載入 8000 0180。
- cycle 7：`add`、`slt`、`lw` 原本該做的段都變成 bubble；同一個 cycle 已經從 8000 0180 抓進 handler 的第一個指令 `sw`。

```
              CC1  CC2  CC3  CC4  CC5  CC6  CC7  CC8  CC9  CC10 CC11
40 sub        IF   ID   EX   MEM  WB
44 and             IF   ID   EX   MEM  WB
48 or                   IF   ID   EX   MEM  WB
4C add                       IF   ID   EX!  bub  bub               ! overflow
50 slt                            IF   ID   bub  bub  bub
54 lw                                  IF   bub  bub  bub  bub
80000180 sw                                 IF   ID   EX   MEM  WB
```

（CC6 的 EX! 表示偵測到 overflow；`add` 被 flush，沒有寫回 `$1`。add、slt、lw 變成 3 個 bubble。）

同一個處理器，前面跑一般程式，出事後 PC 換成 OS 的程式來跑，OS 也只是軟體。handler 再把 EPC 減 4（50 − 4 = 4C），就找到出事的 `add`。

> **陷阱** 教科書硬體存進 EPC 的是 PC + 4（這裡是 50），不是出事指令本身的位址 4C；要找出事的指令或重新執行它，handler 要先把 EPC 減 4。

## 同時好幾個 exception：precise 與 imprecise

pipeline 同時有好幾個指令，同一個 cycle 可能發生好幾個 exception。五個 stage 上各有一個指令：i1 已經在 WB，i5 剛進 IF。

```
  IF    ID    EX    MEM   WB
  i5    i4    i3    i2    i1        （i1 最早進來，i5 最晚）
```

假設有幾個指令同時出事，分散在不同 stage（示意：i2 在 MEM、i4 在 ID 都出事）。先處理誰？

- 先處理**最早的指令**，也就是走得最遠、在最後面 stage 的那個，因為它最早進來、最早開始執行。
- 所以選在 MEM 的 i2：i2 以及它以下的 i3、i4、i5 全部 flush，i1 讓它做完。（i4 的問題等 i2 處理完、重新執行到 i4 時自然會再發生。）

```
  IF    ID    EX    MEM   WB
  i5    i4    i3    i2    i1
  flush flush flush flush 做完    → 處理 i2 的 exception
```

能準確找到出事的指令，它之前的都做完、之後的都清掉，這叫 **precise exception**（精確例外）。五段 pipeline 做這件事很簡單：指令依序進來，誰在最後面一看就知道。

### Imprecise exception

在 **superscalar**、很深、又 **out-of-order**（不照順序執行）的處理器裡，沒有相依的指令可以先做，走在最後面 stage 的不一定是最早的指令。不知道誰最早，要維持 precise exception 就很難。

這時改用 **imprecise exception**：把 pipeline 停下來、把 state 存起來，直接跳去 OS，讓 OS 判斷是誰出事、哪些要 flush。硬要用硬體找出精確的那一個，要很多硬體，所以一般交給軟體。判斷得沒那麼精確也沒關係，能 recover 就好，所以 out-of-order 的處理器常用 imprecise exception。

| | precise exception | imprecise exception |
|---|---|---|
| 做法 | 硬體找出最早出事的指令，之前做完、之後 flush | 停 pipeline、存 state，交給 OS 判斷 |
| 適用 | 依序執行的 pipeline（如五段 MIPS），容易做 | superscalar、深 pipeline、out-of-order |
| 代價 | 亂序處理器要很多硬體 | 軟體處理較複雜，但只要能 recover 即可 |

> **陷阱** 「最早的指令」是指在 pipeline 裡走得最遠（stage 編號最大）的那個，不是剛進 IF 的那個；但這只在依序執行時成立，out-of-order 時就不一定。

## 更多平行：instruction-level parallelism（ILP）

更進階的處理器，例如 superscalar 和 dynamic pipelining，都是在追求更多的 **instruction-level parallelism（ILP，指令層級平行）**：讓同一時間有更多指令在執行。

其實 pipeline 本身就是一種 ILP。切成五段，五個指令依序錯開一個 cycle 進來：

```
          CC1  CC2  CC3  CC4  CC5  CC6  CC7  CC8  CC9
指令 1     IF   ID   EX   MEM  WB
指令 2          IF   ID   EX   MEM  WB
指令 3               IF   ID   EX   MEM  WB
指令 4                    IF   ID   EX   MEM  WB
指令 5                         IF   ID   EX   MEM  WB
```

看 CC5 這一欄：五個指令分別在 WB、MEM、EX、ID、IF，正好五個同時在執行。沒有 dependency 的話，之後每個 cycle 完成一個指令，throughput（單位時間完成的量）大約是不用 pipeline 的 5 倍。

想要更多 parallelism，有兩個方向：把 pipeline 加深，或把 pipeline 加寬。

## 方法一：deeper pipeline（切得更細）

把每個 stage 再切細，切成 7 個、8 個、10 個 stage。10 個 stage 就同時有 10 個指令在做，理想上是 10 倍。這叫 **deeper pipeline**。

> **比喻** 洗衣服：本來一台洗衣機要洗完又脫水才結束。擺兩台，一台專門洗、一台專門脫水，就多了一個 stage；烘乾、摺衣服也各拆成兩段。stage 越多，同時在處理的衣服就越多。

切得更小，每段的工作變少，clock cycle 就能變短。clock cycle 要設成**最慢那個 stage 的時間**。

> **例題**（示意）一件工作總共 1000 ps。切成 5 段、每段 200 ps，clock = 200 ps；切成 10 段、每段 100 ps，clock = 100 ps，更快。

代價：

- cycle 很短，每段分到的時間很少，有些工作不見得塞得進去。
- pipeline 很深時，branch 在很後面才決定，猜錯的 penalty 也很大（要 flush 的指令更多）。

## 方法二：multiple issue（從寬度加平行）

stage 數不變，還是五段，但只能有一條 pipeline 嗎？再加一條：一條同時有 5 個指令在跑，兩條就有 10 個。平行可以從**深度**加，也可以從**寬度**加。把資源加倍，同一個 cycle 就能 issue（發出）不只一個指令。

問：兩條 pipeline，每個 clock cycle 要 fetch 幾個指令？

答：一條 pipeline 每個 cycle 丟一個進去；兩條就是 resource 加倍——兩個 instruction fetch、register file 一次讀出更多 operand、兩個 ALU——所以每個 cycle 要 fetch **2 個**。pipeline 填滿之後每個 cycle 完成 2 個，理想 CPI 是 0.5。

一般化：可以一次 fetch 2 個、3 個、4 個。兩條 pipeline、每條五段，CC5 時同時有 2 × 5 = **10 個**指令在跑：

```
          CC1  CC2  CC3  CC4  CC5  CC6
指令 1     IF   ID   EX   MEM  WB
指令 2     IF   ID   EX   MEM  WB
指令 3          IF   ID   EX   MEM  WB
指令 4          IF   ID   EX   MEM  WB
指令 5               IF   ID   EX   MEM
指令 6               IF   ID   EX   MEM
指令 7                    IF   ID   EX
指令 8                    IF   ID   EX
指令 9                         IF   ID
指令 10                        IF   ID
```

這叫 **multiple issue**：每個 stage 同時處理不只一個指令，IF 一次抓兩個、ID 一次解兩個、EX 一次算兩個。

## CPI 與 IPC

- single issue 的 pipeline，最好的情況是每個 cycle 完成 1 個指令；有 dependency 要 stall、或要 flush，就連 1 個都不到。所以用 **CPI（cycles per instruction）** 衡量，single issue 時 **CPI ≥ 1**。
- 2-issue 一個 cycle 可以完成 2 個指令，CPI 就小於 1，用起來不直覺。所以改用 **IPC（instructions per cycle）**：一個 cycle 完成幾個指令，**越大越好**。
- 兩者互為倒數：**IPC = 1 / CPI**。

### 例題：4 GHz、4-way multiple issue

處理器 4 GHz，4-way multiple issue（一次發 4 個）。

1. 4 GHz = 每秒 4 × 10⁹ 個 cycle。
2. 每個 cycle 最多 4 個指令 → 每秒最多 4 × 10⁹ × 4 = 16 × 10⁹，即 **160 億（16 billion）** 個指令。
3. 沒有 dependency 時，每個指令平均只要 1/4 個 cycle → **CPI = 0.25**。
4. 換成 IPC：一個 cycle 完成 4 個 → **IPC = 4**。兩個數字講的是同一件事。

> **陷阱** 這是最好的狀況（peak）。有 dependency 時，就算有兩條 pipeline，也不一定每次湊得到兩個能一起做的指令，實際 IPC 會低於理想值。

## Static 與 dynamic multiple issue

| | static multiple issue | dynamic multiple issue |
|---|---|---|
| 何時決定哪些指令一起發 | compile time | run time（程式真的在跑） |
| 誰決定 | compiler（軟體） | hardware |
| hazard 的偵測與避免 | compiler 負責，硬體不管 | 全部由硬體處理 |
| 代表 | VLIW | superscalar |

- **static**：compiler 把能一起發的指令包在一起，叫一個 **issue packet**；4-way 一包 4 個，2-way 一包 2 個。
- **dynamic**：有點像 forwarding 的概念——硬體偵測到條件符合，就讓指令平行做。不過 compiler 如果幫忙把沒有相依的指令排在附近，效果會更好，因為硬體一次看得到的範圍有限。

> **重點** 一句話：static 是軟體（compiler）的方法，dynamic 是硬體的方法。

## Speculation（猜測執行）

不管哪一種 multiple issue，**speculation（猜測）**都很重要。什麼都不敢猜，遇到 branch 就等它決定、遇到 load 就等資料，只能呆在那邊，根本平行不起來。所以策略是 **start operation as soon as possible**：盡快開始做，猜錯了再 **roll back**。

兩個常見的猜法：

1. **猜 branch**：猜 taken 或 not taken，先照猜的做下去。
2. **猜 load**：一個 store（sw）後面緊接一個 load（lw），這兩個通常不會用到同一個 address，就猜它們不同，讓 load 先做。

### Speculate on load：什麼時候會錯

> **例題**（示意）記憶體內容：位址 100 存 5、位址 200 存 7、位址 1300 存 3。程式是 store 把 9 寫到某個位址，緊接著 load 從某個位址讀。正常順序是 store 先做完，再做 load。

| 情況 | store 寫入 | load 讀取 | 照順序（store 先） | load 先做 | 結果 |
|---|---|---|---|---|---|
| 同一位址 | 1300 ← 9 | 1300 | 讀到 9 | 讀到舊的 3 | 錯 |
| 同一位址 | 100 ← 9 | 100 | 讀到 9 | 讀到舊的 5 | 錯 |
| 不同位址 | 100 ← 9 | 200 | 讀到 7 | 讀到 7 | 不會錯 |

- 讓 load 先做，**只有兩個是同一個位址時才會錯**。
- 但正常寫程式，會先寫回記憶體、又馬上讀同一個位址嗎？很少——馬上要用的值，放在 register 裡用就好。
- 所以假設位址不同、讓 load 先做，做完再 check 有沒有猜錯。這種「先假設不衝突、讓 load 先做」的技巧就叫 **speculate on load**。

問：為什麼是讓 load 先，而不是 store 先？

答：store 的運算早就做完了，只差把結果寫進記憶體，晚一點寫不影響別人；store 還可以先放進 buffer 慢慢寫。load 不一樣：讀進來的資料下一個指令可能馬上要拿去加、去減，晚一步大家都得等；遇到 cache miss 還要去 memory 拿，等更久。萬一真的猜錯，rollback 就好。

### 猜錯的善後：fix-up routine 或硬體 flush

- **軟體（compiler）做法**：compiler 把 load 搬到 store 前面（reorder）。因為是 compiler 的做法，硬體不幫忙檢查，所以 compiler 要插一段 if-then-else 檢查剛才猜對沒：猜對什麼都不用做；猜錯就跳到 **fix-up routine**，把錯的結果修回來。
- **硬體做法**：用更多硬體檢查條件，發現猜錯就把相關指令 **flush** 掉。

下面是 compiler 做法的樣子（示意，假設兩個指令的 offset 相同，只要比 base register）：

```asm
        lw   $t2, 0($s2)      # load 搬到 store 前面：猜 $s2 != $s1
        sw   $t1, 0($s1)
        bne  $s1, $s2, OK     # 位址不同 → 猜對，什麼都不用做
        add  $t2, $t1, $zero  # fix-up：位址相同，load 應該拿到剛存進去的值
OK:     ...
```

### 為什麼 multiple issue 一定要猜

問：猜，跟 multiple issue 有什麼關係？

答：不猜的話，要等 branch 決定才能抓下一個指令：beq 後面就空一格，下一個晚一個 cycle 才進來，pipeline 常常是空的。硬體明明一次能抓兩個，但不敢猜，還是只能抓一個，兩條 pipeline 等於白做。要讓 pipeline 大部分時間都是滿的，就一定要猜。猜錯時，軟體的方法是程式裡加檢查、錯了跳到 fix-up routine；硬體的方法就是 superscalar 架構。

### Superscalar 的處理方式：照順序進、亂序做、照順序寫回

1. **fetch / issue in order**：照程式順序抓進來，順便把指令之間的 dependency 找出來。
2. **execute out of order**：誰準備好誰先做。
3. 做完的結果先放在 **buffer**，不馬上寫回 register，也不馬上寫進記憶體——只有改變 state 才會真的影響結果，中間怎麼算、暫存在哪都沒關係。
4. **commit in order**：最後才照原本程式的順序，一個一個寫回去。還在猜、還不確定對不對的，就留在 buffer，確定了才寫回。branch 猜錯，就把 buffer 裡錯的結果 flush 掉，完全不影響 state。

### 猜測執行碰上 exception

> **例題**（示意）branch 還沒決定，猜後面的 load 會被執行，就先讓它做；結果這個 load 用的位址 `$t0` 不合法（invalid address），產生 exception。

```asm
        beq  ...              # 還沒決定
        lw   $t1, 0($t0)      # 猜它會執行，先做 → $t0 是 invalid address
```

這個 exception **不能算數**：照正常順序，branch 可能根本不會走到這個 load。處理方法：

- **static**：把 exception **延後（defer）**。
- **dynamic**：把 exception 也放進 buffer，等這個指令真的 commit、確定會執行，才處理。

speculation 和 exception 交錯在一起，都要更多硬體、更多心力。

## Static multiple issue：VLIW

static multiple issue 主要靠 compiler。程式還沒執行，compiler 就把能平行的指令包在一起（例如一個 add 加一個 lw），整包當成一個指令：

- 同一包裡不能有 dependency。
- 發生 exception 時，也把整包當作一個指令處理。
- 程式本身要有足夠的 parallelism，才找得到能包在一起的指令。
- pipeline 的 resource 也要增加，才能同時執行一整包。

一整包就像一個很長的指令，所以叫 **VLIW（very long instruction word）**。說一個處理器是 VLIW，意思就是它靠 compiler 把很多指令包在一起、同時執行。

### Scheduling：compiler 自己移除 hazard

- **規則一**：同一個 issue packet 裡不能有 dependency。像 add 寫 `$t0`、lw 拿 `$t0` 當位址，就不能同一包。
- packet 與 packet 之間的相依，要看 processor 怎麼處理（有沒有 forwarding、要不要 stall），compiler 都要知道。
- 找不到能一起包的，就插 **nop**。這就是 **scheduling** 要解決的問題。

## MIPS dual issue：一個 ALU/branch 配一個 load/store

VLIW 並不是隨便兩個指令都能包在一起。這個 dual issue（一次發兩個）例子規定：

| slot | 可放的指令 |
|---|---|
| slot 0 | ALU 或 branch |
| slot 1 | load 或 store |

- 不能兩個 load，也不能兩個 ALU（或兩個 branch）。
- 每個指令 32 bit，一包兩個就是 64 bit，**對齊 64 bit** 存放，每次固定抓 64 bit。
- 包不起來的那一格就放 nop。這樣規定是為了簡化硬體：每次都固定抓 64 bit，不用一下抓一個、一下抓兩個。

pipeline 圖上，每個 cycle 同時進兩個，一個 ALU/branch、一個 load/store，一起走五段：

```
                     CC1  CC2  CC3  CC4  CC5  CC6  CC7
ALU 或 branch         IF   ID   EX   MEM  WB
load 或 store         IF   ID   EX   MEM  WB
ALU 或 branch              IF   ID   EX   MEM  WB
load 或 store              IF   ID   EX   MEM  WB
ALU 或 branch                   IF   ID   EX   MEM  WB
load 或 store                   IF   ID   EX   MEM  WB
```

> **陷阱** 直覺會以為「隨便找兩個互不相干（independent）的指令就能包」，其實不是：有兩條 pipeline 不代表可以隨便要，有些 resource 要共用，硬體已經規定好怎麼搭——一個要從 ALU/branch 組選、一個要從 load/store 組選，選不出來就放 nop。scheduling 必須照硬體的規定來包，這是考試必考的地方。

### Dual issue 要加的硬體

不用整個處理器加倍，只要增加某些 resource。以同時執行 add（ALU）和 sw（store）為例：

| 位置 | 原本 single issue | dual issue |
|---|---|---|
| register file read port | 2 個 | **4 個**：R-type 讀 rs、rt；sw 讀 rs（基底）、rt（要存的值） |
| register file write port | 1 個 | **2 個**：可能兩個指令同時走到 WB |
| EX | 一個 ALU（算數和算位址共用） | **多一個 ALU**（adder），專門算 load/store 的位址 |
| MEM、WB | — | 跟原本一樣 |

port 越多，硬體越貴，不是免費的。

> **比喻** 要做 shift，ALU 做不到，就得加一個 shifter。想加功能，就要加硬體；想一次發兩個，就要加 port、加 ALU。

## Dual issue 的 hazard

兩個同時做雖然快，但 hazard 一發生，代價也比較大。

### 同一包裡不能 forward

- single issue：add 在 EX 算出 `$t0`，下一個 cycle 的 sub 要用，結果已在 pipeline register 裡，直接 forward 過去，完全不用停。
- dual issue：如果 add 和要用 `$t0` 的 lw 在**同一包**，兩個同時在 EX，一個正在算、一個就要用，**沒有東西可以 forward**。只好拆成兩包，讓 lw 晚一個 cycle，就像 stall 一樣。

> **例題**（示意）

| cycle | ALU / branch | load / store |
|---|---|---|
| 想要的 | add `$t0`, … | lw `$t1`, 0(`$t0`) ← 同一包，不行 |
| 1 | add `$t0`, … | nop |
| 2 | nop | lw `$t1`, 0(`$t0`) |

### Load-use 在 dual issue 損失兩個位置

問：什麼是 load-use hazard？

答：data dependency 有兩種。

1. **R-type 接 R-type**（例：`sub $2` 接 `and` 用 `$2`）：ALU 型指令要到第 5 stage 才寫回，但在 EX 就算出來了，下一個指令到 EX 時結果已在 pipeline register 裡，用 forwarding 直接拿就好。
2. **load 接使用者**（例：`lw $2` 接 `and` 用 `$2`）：load 在第 4 stage（MEM）才去記憶體讀資料，第 4 stage 結束才拿得到；下一個 and 在那個時候已經在第 3 stage（EX）要用，資料還沒出來，怎樣都給不了。所以一定有 **1 個 cycle 的 penalty**，and 停一格（插一個 bubble）。

這一個 cycle 的代價：

- single issue：一拍只能做 1 個，損失 **1 個**指令的位置。
- dual issue：一拍本來能做 2 個，損失 **2 個**指令的位置。

> **重點** 所以 dual issue 的 scheduling 特別重要，要盡量把指令排好，避開 stall。forwarding 與 load-use 是前面 hazard 的內容，不熟要回頭複習。

## Scheduling 例子：4 個 cycle 做 5 個指令

把一個 loop 排進上面的 dual-issue 處理器。它做的事：陣列每次讀一個元素，加上一個固定的數（scalar），再寫回去。

```asm
Loop: lw   $t0, 0($s1)        # $s1 指著目前的元素，把它讀進 $t0
      addu $t0, $t0, $s2      # 加上 scalar $s2
      sw   $t0, 0($s1)        # 寫回原位
      addi $s1, $s1, -4       # 往前移一個元素（一個 word = 4 bytes，例如 100 → 96）
      bne  $s1, $zero, Loop   # $s1 還不是 0 就繼續
```

相依有兩串：

- `$t0` 這串：lw → addu → sw
- `$s1` 這串：addi → bne

排法（左邊 ALU/branch，右邊 load/store）：

1. lw、addu、sw 互相相依，不可能同一包，各占一個 cycle。lw 在 cycle 1；addu 要躲 load-use，不能在 cycle 2，排到 cycle 3；sw 在 cycle 4。
2. addi 是 ALU 指令，跟 `$t0` 那串無關，放進 cycle 2 的 ALU 格。
3. ALU 類可以跟 load/store 類包一起，branch 也可以跟 store 配一包：bne 跟 sw 包在 cycle 4。
4. 注意 sw 現在在 addi **之後**，`$s1` 已經減了 4，offset 要從 0 改成 **4**，才寫回原位。

| cycle | ALU / branch | load / store |
|---|---|---|
| 1 | nop | lw `$t0`, 0(`$s1`) |
| 2 | addi `$s1`, `$s1`, -4 | nop |
| 3 | addu `$t0`, `$t0`, `$s2` | nop |
| 4 | bne `$s1`, `$zero`, Loop | sw `$t0`, 4(`$s1`) |

驗算 offset：設進入時 `$s1` = 100。lw 讀位址 100；cycle 2 之後 `$s1` = 96；sw 寫 4 + 96 = 100，正是原位。

結果 8 個格子只有最後一包兩格都有用，其他都是 nop。

- 4 個 cycle 執行 5 個指令：**IPC = 5 / 4 = 1.25**（CPI = 0.8）。
- 兩條 pipeline 的理想 IPC 是 2，現在只多一點點，效能不好。排好的版本和照順序執行的結果完全一樣。

> **陷阱** 指令移到 addi 之後，用 `$s1` 當 base 的 offset 一定要跟著調整（0 → 4），這是排程題最常漏的地方。

## Loop unrolling：一圈做四份

剛才排的只是一圈，可是 loop 要跑 1000 次。compiler 有一個很重要的方法：**loop unrolling（迴圈展開）**——把 loop body copy 4 份放在同一圈，一圈處理 4 個相鄰元素，1000 次變成 1000 / 4 = **250 圈**。

為什麼？展開之後，compiler 一次看得到的指令（**window**）變大了，同時有很多指令可以一起做，就能好好地排、好好地包。

### 只 copy 不改名：看起來全部相依

```asm
Loop: lw   $t0, 0($s1)
      addu $t0, $t0, $s2
      sw   $t0, 0($s1)
      lw   $t0, -4($s1)
      addu $t0, $t0, $s2
      sw   $t0, -4($s1)
      lw   $t0, -8($s1)
      addu $t0, $t0, $s2
      sw   $t0, -8($s1)
      lw   $t0, -12($s1)
      addu $t0, $t0, $s2
      sw   $t0, -12($s1)
      addi $s1, $s1, -16
      bne  $s1, $zero, Loop
```

四份都用 `$t0`，看起來每一份都依賴前一份，好像沒辦法平行。可是這一份的 `$t0` 跟下一份的 `$t0` 真的有關係嗎？**沒有**：前一份讀進來、加完、已經 store 回去了，下一份 load 進 `$t0` 的是全新的資料。

### Register renaming

那就換名字：四份分別用 **`$t0`、`$t1`、`$t2`、`$t3`**，多用幾個 register 就好。這就是 **rename**。它們之間只是名字相同造成的 **name dependency**，資料根本沒有相依。這種因名字相同造成的相依叫 **anti-dependence（反相依）**，就是前面講的 **WAR（write after read）**：後一份要寫 `$t0`，必須等前一份讀完 `$t0`（sw 用掉），換個名字這個限制就消失。

> **陷阱** 只 unroll 不 rename 不行。四份都還叫 `$t0`，compiler 會以為它們相依，就不敢重新排。

### Unroll + rename 之後的排程：8 個 cycle 做 14 個指令

一次考慮四個元素一起排：先連續兩個 cycle 都在 load，資料到了就開始加，同時繼續 load 下一份；**後一份的 load 和前一份的加法重疊在同一個 cycle**，最後一路 store 回去。

| cycle | ALU / branch | load / store |
|---|---|---|
| 1 | addi `$s1`, `$s1`, -16 | lw `$t0`, 0(`$s1`) |
| 2 | nop | lw `$t1`, 12(`$s1`) |
| 3 | addu `$t0`, `$t0`, `$s2` | lw `$t2`, 8(`$s1`) |
| 4 | addu `$t1`, `$t1`, `$s2` | lw `$t3`, 4(`$s1`) |
| 5 | addu `$t2`, `$t2`, `$s2` | sw `$t0`, 16(`$s1`) |
| 6 | addu `$t3`, `$t3`, `$s2` | sw `$t1`, 12(`$s1`) |
| 7 | nop | sw `$t2`, 8(`$s1`) |
| 8 | bne `$s1`, `$zero`, Loop | sw `$t3`, 4(`$s1`) |

逐格檢查（設進入時 `$s1` = 100）：

- cycle 1：addi 和 lw `$t0` 同一包，lw 讀的是**舊的** `$s1` = 100，讀位址 100；addi 把 `$s1` 改成 84。
- cycle 2 起 `$s1` = 84，所以 offset 要加回 16 的差：lw `$t1` 讀 12 + 84 = 96、lw `$t2` 讀 8 + 84 = 92、lw `$t3` 讀 4 + 84 = 88，正好是 100、96、92、88 四個相鄰元素。
- store 也一樣：sw `$t0` 寫 16 + 84 = 100、sw `$t1` 寫 96、sw `$t2` 寫 92、sw `$t3` 寫 88，都寫回原位。
- load-use：`$t0` 在 cycle 1 載入、cycle 3 才用；`$t1` cycle 2 → cycle 4；`$t2` cycle 3 → cycle 5；`$t3` cycle 4 → cycle 6，每一個都隔了一包，沒有違反 load-use。
- 每一包都是「一個 ALU/branch + 一個 load/store」，同一包內沒有相依。

結果：

- 8 個 cycle 執行 14 個指令（1 addi + 4 lw + 4 addu + 4 sw + 1 bne），**IPC = 14 / 8 = 1.75**，比剛才的 1.25 好很多。16 個格子只剩 2 個 nop。
- 換算每個元素：原本 4 cycle 處理 1 個元素；現在 8 cycle 處理 4 個，平均 2 cycle 一個。
- 代價：要用更多 register（`$t0`～`$t3` 同時在用），程式碼也變成大約 **4 倍大**（code size 變大）。

### Unrolling 的另一個好處：減少 loop control overhead

本來每一圈都要 bne 檢查一次要不要繼續（還有 addi 更新指標）；展開 4 次之後，4 份做完才查一次，**1000 次檢查變 250 次**，指令變少了。以總指令數算：原本 5 × 1000 = 5000 個，展開後 14 × 250 = 3500 個。

問：loop 次數不是 4 的倍數怎麼辦？

答：例如 1003 次：前 1000 次用展開版跑 250 圈，剩下 3 次照原本一圈一圈跑完。

> **重點** 軟體方法最重要的就是 scheduling，尤其是 loop：loop 跑一千、一萬次，排得不好效能就差很多。

## Dynamic multiple issue：superscalar

dynamic multiple issue 主要靠硬體，最簡單的版本叫 **superscalar processor**：

- 在 issue 時檢查 dependency，決定這個 cycle 發 0 個、1 個、2 個……，避開 structural hazard 和 data hazard。
- 不靠 compiler 也行；但 compiler 幫忙把沒相依的指令集中在一起，硬體比較容易一次發多個。不過最後發幾個，還是硬體決定。

### 例子：out-of-order execution

```asm
lw   $t0, 20($s2)
addu $t1, $t0, $t2      # 要用 $t0，跟 lw 相依
sub  $s4, $s4, $t3      # 跟上面兩個都無關
slti $t5, $s4, 20       # 用 sub 的 $s4
```

- lw 和 addu 相依，就算是 2-issue，也只能先發 lw，再發 addu。
- 可是 sub 跟 lw、addu 根本沒關係。load 要很久，為什麼要讓 sub 乾等？那就讓 sub 先做：load 還沒做完，後面的 sub 已經先做了，這就是 **out-of-order execution**。
- 誰能做就先做，只要最後 commit 時照順序寫回就好，由硬體把關。

### Superscalar 的結構：三段

```
 ┌───────────────────────────────┐
 │ instruction fetch & decode    │  in-order issue（照順序，才能找出 dependency）
 └───────────────────────────────┘
      │          │           │
 [reservation] [reservation] [reservation]   ← 每個 function unit 前面一個
 [ station   ] [ station   ] [ station   ]
      │          │           │
 [ integer ]  [ floating ]  [ load/store ]   out-of-order execute（operand 到齊就做）
      │          │           │
 ┌───────────────────────────────┐
 │ commit unit（reorder buffer） │  in-order commit（照程式順序寫回 state）
 └───────────────────────────────┘
```

1. **in-order issue**：instruction fetch 和 decode 照順序，因為要靠順序找出 dependency，並把 dependency 記下來。
2. **out-of-order execute**：很多個 function unit（整數、浮點、load/store），誰的 operand 到齊誰先做。每個 function unit 前面有一個 **reservation station（保留站）**，hold 住它要的 operand；operand 可以來自 register file、剛算完的 function unit，或 commit unit 裡算好但還沒寫回的值（很像 forwarding）。兩個 operand 都到了就做運算。
3. **in-order commit**：**commit unit** 也是一個 buffer，算完的結果先放這裡，不馬上寫回 register file 或記憶體；寫回會改變 state，所以一定照原本程式的順序 commit。

中間這段只要 ready 就算，所以能加快速度。

### 硬體也在做 renaming 和 speculation

- **renaming**：superscalar 只認 data dependency，data 一 ready 就開始做，暫存器原本叫什麼名字根本不重要。這就等於 loop unrolling 時做的 register renaming，只是改由硬體自動完成。
- **speculation**：硬體常用兩種——branch prediction，和 load speculation。load 的資料常常馬上要用，所以早點猜、早點 load；猜錯只要不 commit 就好。做法例如：
  - 預測 load 的 effective address；
  - 前面的 store 還沒完成（outstanding）就先 load；
  - 把 store 要寫的值直接 bypass 給後面的 load。
- 結果還不確定，就留在最後一段的 buffer 先不 commit，確認錯了就 redo。

## 為什麼不只靠 compiler（VLIW）

compiler 的方法 offline 做就好，處理器不太要改；superscalar 則要很多硬體做檢查。那為什麼還需要 superscalar？三個原因：

1. **不是所有 stall 都能事先預測**：例如記憶體系統，cache hit 一個 cycle 就拿到，cache miss 要去主記憶體，要很多 cycle，pipeline 只好等。哪些資料會在 cache 裡，compile 時絕對不知道，compiler 沒辦法事先排好。
2. **delay slot 不見得填得滿**：像 delayed branch，不見得每次都找得到足夠的指令填 delay slot。
3. **同一個 ISA 有很多實作**：4 段、5 段、2-issue……每種的 latency 和 dependency 都不一樣。compiler 要針對每台機器最佳化，換一台可能就不適用、要重來，很麻煩。

所以光靠 VLIW 不夠，還是需要 superscalar。

## Multiple issue 的極限

multiple issue 大部分情況都有效，但效果常常沒想像中好：

- **dependency 難消除**：尤其是 pointer，兩個指標可能指到同一個地方（aliasing），這種相依很難去掉。
- **window 太小**：一次看到的指令太少，找不到夠多沒相依的指令一起做。
- **記憶體的 delay 與 bandwidth 有限**：pipeline 很難一直滿。
- **speculation 要猜得對**：猜錯就得 flush，付出代價。
- 還有 **power（耗電）**。

## Power wall：轉向 multi-core

電晶體越來越便宜，一顆晶片放了很多機制：branch prediction、superscalar、很深的 pipeline。但硬體越多越複雜就越耗電，**power 變成 limiting factor**，沒辦法一直加。所以現在走 **multi-core（多核心）**：不必把每個 core 做得那麼複雜，pipeline 簡單一點、多放幾個 core，耗電還更低。

| 處理器 | pipeline stage 數 | core 數 | 功耗 |
|---|---|---|---|
| Pentium 4 | 31 | 1 | 103 W |
| Intel Core | 14 | 2 | 75 W |
| UltraSPARC III | 14 | 1 | 90 W |
| UltraSPARC T1 | 6 | 8 | 70 W |

## 回顧：Pipeline 整章的核心觀念

- pipeline 的概念很簡單，麻煩的是 **dependency**，也就是 data hazard 和 control hazard。
- pipeline 跟 **technology** 有關：電晶體便宜又多，設計才越來越複雜、pipeline 越來越深。
- 也跟 **instruction set** 有關：指令集太複雜就很難切 stage，簡單的像 MIPS 比較好做；指令集會影響 datapath 和 control 的設計。
- **pipeline 增加的是 throughput，不會減少單一指令的 latency。**
- 三種 hazard 與解法：

| hazard | 解法 |
|---|---|
| structural | 每個 resource 固定在同一個 stage 使用（避免兩個指令同時搶同一個資源） |
| data | forwarding，不夠時 stall |
| control | predict，猜錯 flush |

- 要再加速就靠 ILP，有 static（compiler、VLIW）和 dynamic（hardware、superscalar）兩種；但受 dependency 限制，很難達到理想值。

## 重點整理
- pipeline 改善 throughput，不改善單一指令 latency（多了 pipeline register，latency 甚至略增）
- MIPS 五段：IF、ID（decode + 讀 register）、EX、MEM、WB；每個指令比前一個晚一個 cycle 進場，同時最多 5 個指令
- 五段之間加 4 個 pipeline register：IF/ID、ID/EX、EX/MEM、MEM/WB；在 clock cycle 結束時寫入
- clock period = 最長 stage 的時間 → stage 要切得 balance
- 每個資源同一時間只給一個指令用，且所有指令都在同一個 stage 用它；R-type 也在第 5 段寫回（MEM 空著），sw、beq 也補成五段
- k 段 pipeline 跑 N 個指令需 N + (k − 1) 個 cycle（五段：N + 4；lw+sub 6 個、五個指令 9 個）
- control signal 的值與 single cycle 相同，ID 段 decode 產生，分 EX/M/WB 三組存在 pipeline register 隨指令往下傳，用掉就不再傳；IF 段不需要 control
- lw 控制：EX 0001、M 010、WB 11；R-type：EX 1100、M 000、WB 10
- destination register（R-type 選 rd、lw 選 rt，RegDst mux）也要隨指令傳到 WB；不能用 IF/ID 裡新指令的欄位
- 理想 speedup = stage 數；五段等長跑 1000 個指令 ≈ 4.98；段長 2,1,2,2,1 → 只剩約 4 倍
- 理想 CPI = 1；含填充 CPI = (N + 4)/N；有 stall：CPI = 1 + 平均每指令 stall 數（每 5 個 stall 1 次 → 1.2）
- hazard 三種：structural（搶硬體，與 dependency 無關）、data、control；data/control hazard 來自往回走的 feedback path（WB 寫回 register、branch 改 PC）
- dependency 一定牽涉 write；兩個都只讀沒有問題
- 萬用解 wait：沒有其他技巧時，相依的下一個指令 fetch 從 CC2 延到 CC5（多等 3 cycle）
- 指令與資料共用一個 memory → CC4 第 1 個指令 MEM 與第 4 個指令 IF 衝突；MIPS 用分開的 IM、DM 避免（每個 stage 用不同 resource）
- 四 phase（FI/DI/EI/WR）共用 memory 例：I4 延到 T7 fetch，7 → 10 個 cycle
- 寫 R5 的指令：下一個、下兩個讀到舊值；下三個靠 register file internal forwarding（前半寫、後半讀）可讀到新值
- sub `$2` 例：and（CC3）、or（CC4）讀錯；add（CC5）靠 internal forwarding 正確；sw（CC6）正確
- RAW = flow / true dependency；WAR = anti dependency；WAW = output dependency
- 五段 MIPS 只有 RAW：operand 一律在 ID 讀、write 一律在 WB，WAR、WAW 不會發生；WAR/WAW 只在平行或 out-of-order 執行時出現，可用 register renaming 避免（name dependency）
- 會寫 register 的只有 R-type 與 load（都在 WB 寫）；讀 register 都在 ID。
- 前面是 R-type：結果 EX 就算好 → forwarding，0 stall；前面是 lw 且下一條在 EX 就用（load-use）→ 一定 stall 1 cycle 再 forward。
- 有 dependency 不一定有 hazard，看兩條指令距離。
- Internal forwarding：register file 前半 cycle 寫、後半 cycle 讀，同 cycle 寫讀可拿到新值。
- Compiler 插 nop：sub 後面插 2 個 nop，5 條指令 11 cycles；硬體 forwarding 只要 9 cycles。
- Forwarding datapath：ALU 兩個輸入前各一個 3-to-1 mux；00 = register file（ID/EX）、10 = EX/MEM（前一個）、01 = MEM/WB（前兩個）。
- ForwardA 管 rs、ForwardB 管 rt；forwarding unit 在 EX 檢查。
- EX hazard：EX/MEM.RegWrite 且 EX/MEM.Rd ≠ 0 且 EX/MEM.Rd = ID/EX.Rs（或 Rt）→ 10。
- MEM hazard：MEM/WB.RegWrite 且 MEM/WB.Rd ≠ 0 且 EX hazard 不成立 且 MEM/WB.Rd = ID/EX.Rs（或 Rt）→ 01。
- Double data hazard：前一個、前兩個都寫同一 register → 取最新的 EX/MEM（10）。
- 我在 EX 時：爸爸（前一個）結果在 EX/MEM，祖父（前兩個）結果在 MEM/WB。
- 例 sub/and/or/add：CC4 A=10,B=00；CC5 A=10,B=01；CC6 A=10,B=00；共 8 cycles、0 stall。
- Load-use 偵測在 ID：if (ID/EX.MemRead and (ID/EX.Rt = IF/ID.Rs or ID/EX.Rt = IF/ID.Rt)) stall；比的是 lw 的 rt。
- Stall：control mux 選 0（bubble）、PCWrite = 0、IF/IDWrite = 0，指令重 decode／重 fetch。
- 例 lw/and/or/add：stall 1，CC5 A=01、CC6 A=10、CC7 A=10，共 9 cycles。
- lw 接 sw 存回剛載入的值：有 MEM 段 forwarding 就不必 stall；lw 結果當 sw 的 base 位址則是 load-use。
- Branch 在 MEM 決定 penalty 3、在 ID 決定 penalty 1；penalty = 決定的 stage − 1；pipeline 越深 penalty 越大。
- Flush = 變 bubble：已 decode 的 control 全設 0；IF 中的指令整個清 0（0x00000000 = sll `$0`,`$0`,0 = nop）。
- lw `$4`,50(`$7`) = 0x8CE40032。
- Predict not taken（PC + 4）在 loop 尾端 branch 幾乎每次猜錯。
- 算 stall 題：總 cycle = 5 + (執行指令數 − 1) + stall 數；CPI ≈ 1 + stall/指令數。
- predict not taken：照順序抓 PC + 4；猜錯要 flush，penalty = 決定點 stage 編號 − 1（ID 1 個、EX 2 個、MEM 3 個）
- 把 branch 決定搬到 ID：ID 多一個加法器算 target = PC + 4 + offset × 4、多一個比較器比 rs = rt；IF/ID 前的 mux 寫 0（IF.Flush），只損失 1 個 bubble
- 例：40 beq `$1`,`$3`,7 → target = 40 + 4 + 7 × 4 = 72；44 的 and 變 bubble，cycle 4 抓 72 的 lw
- 迴圈 branch 大多 taken：迴圈 101 次一律猜 not taken 錯 100 次
- branch history table（branch prediction buffer）：用 branch 位址在 IF 時查表；用 associative memory（像 cache）做，只存最近的 branch，所有 entry 同時比對，沒 match 用 default
- 猜錯：flush pipeline + flip prediction（1-bit 一錯就翻）
- 1-bit predictor 在巢狀迴圈中 inner loop 每輪錯 2 次（出口 + 下一輪第一次）
- 2-bit predictor：4 個 state 的 FSM（兩個預測 T、兩個預測 N），連錯兩次才改預測；每輪只錯 1 次
- outer 1000 輪 × 101 次 branch：1-bit 錯 1999 次（≈1.98%），2-bit 錯 1000 次（≈0.99%）
- branch target buffer：表中每列存 branch 位址、T/N、target，預測 taken 時同時讀出 target，0 等待
- delayed branch：branch 後一個指令（delay slot）always executed；compiler 搬一個跳不跳都要執行、沒有 dependency 的指令進去，找不到放 nop；約 50% 找得到；不需 flush；深 pipeline slot 多就難填
- control hazard 三機制：predict not taken + flush／delayed branch／branch history table（dynamic prediction），彼此不混用
- CPI = 1 + stalls per instruction；branch stall/指令 = branch 比例 × 猜錯比例 × penalty
- MIPS：CPU 內部的叫 exception（undefined opcode、overflow），外部 I/O 的叫 interrupt
- 處理 exception：存 EPC（offending instruction 位址）、存 Cause（原因）、PC 改成 handler 位址
- I/O interrupt 讓指令做完、回來執行下一個；exception（overflow）指令沒做完、回來重新執行
- MIPS single entry point 8000 0180（依 Cause 分派）；vectored interrupt 用原因當 index 直接跳對應 handler
- handler 結束：restartable 用 EPC 回去；不能 recover 就 terminate + report error
- pipeline 中的 exception：之前的指令做完，出事指令與之後的 flush（control signal 設 0：IF.Flush、ID.Flush、EX.Flush），PC 載入 8000 0180
- 例：4C add overflow 在 cycle 6 EX；add、slt、lw 變 3 個 bubble；and、or 做完；EPC = 4C + 4 = 50；cycle 7 抓 handler 的 sw
- 多個 exception 同時：先處理最早的（在最後面 stage 的）→ precise exception；out-of-order/superscalar 難做，用 imprecise（停 pipeline、存 state、交給 OS）
- pipeline 本身就是 ILP：5 stage → 同時 5 個指令，無 dependency 時 throughput 約 5 倍
- 加平行的兩個方向：deeper pipeline（切更細，clock = 最慢 stage；代價：工作塞不進、branch penalty 變大）與 multiple issue（加寬，兩條 pipeline 同時 2 × 5 = 10 個指令）
- 兩條 pipeline 每個 cycle fetch 2 個，理想 CPI = 0.5
- single issue CPI ≥ 1；multiple issue 改用 IPC（越大越好），IPC = 1 / CPI
- 4 GHz、4-way：每秒最多 16 billion 個指令，CPI = 0.25，IPC = 4（peak，dependency 會讓它達不到）
- static multiple issue = compiler 在 compile time 包成 issue packet、compiler 負責 hazard（VLIW）；dynamic = hardware 在 run time 決定、處理 hazard（superscalar）
- speculation：盡快開始做，猜錯再 roll back；猜 branch、猜 load（store 後接 load 通常不同位址，先 load）
- speculate on load 只有 store 與 load 同一位址才會錯；load 先做因為資料馬上要用、cache miss 久，store 可放 buffer 慢慢寫
- 猜錯善後：compiler 插檢查 + fix-up routine；hardware 檢查後 flush
- superscalar：in-order issue、out-of-order execute、in-order commit；結果先放 buffer，猜錯 flush 不影響 state
- 猜測執行產生的 exception 不能馬上算數：static 延後（defer），dynamic 放進 buffer 等 commit 才處理
- VLIW：一包內不能有 dependency，exception 時整包當一個指令；找不到就放 nop
- MIPS dual issue：slot 0 = ALU/branch，slot 1 = load/store；64 bit aligned，每次抓 64 bit
- dual issue 硬體：register file 4 個 read port、2 個 write port，EX 多一個 ALU 算 load/store 位址；MEM、WB 不變
- dual issue：同一包內不能 forward（必須拆包）；load-use 1 cycle penalty 在 dual issue 損失 2 個指令位置
- 例題 loop（lw/addu/sw/addi/bne）排成 4 cycle 5 指令，IPC = 1.25；sw offset 0 → 4（因 addi 已先減 4）
- loop unrolling ×4 + register renaming（`$t0`～`$t3`）：8 cycle 14 指令，IPC = 1.75；代價：多用 register、code size 約 4 倍
- unrolling 減少 loop control overhead：1000 次 bne 檢查 → 250 次；不是 4 的倍數（1003）就 1000 次展開 + 3 次單獨跑
- 名字相同造成的相依 = name dependency / anti-dependence（WAR），rename 即可；只 unroll 不 rename 不行
- superscalar 結構：reservation station 放 operand（來自 register file、function unit、commit unit），operand 到齊就執行；commit unit 是 buffer，in-order commit
- hardware 也做 renaming（只認 data dependency）與 speculation（branch prediction、load speculation：預測位址、store 未完成先 load、store 值 bypass 給 load）
- 仍需 superscalar 的三原因：stall 不能全預測（cache miss）、delay slot 填不滿、同一 ISA 多種實作
- multiple issue 的限制：dependency（pointer）、window 太小、memory delay/bandwidth、speculation 猜錯代價、power
- power wall → multi-core：Pentium 4（31 stage、1 core、103 W）、Intel Core（14、2、75 W）、UltraSPARC III（14、1、90 W）、UltraSPARC T1（6、8、70 W）
- pipeline 增加 throughput，不減少單一指令 latency；三種 hazard：structural、data（forwarding + stall）、control（predict + flush）

## 名詞對照
| 中文 | English |
|---|---|
| 管線 | pipeline |
| 階段 | stage |
| 單週期 | single cycle |
| 管線暫存器 | pipeline register / pipeline latch |
| 指令擷取 | instruction fetch (IF) |
| 指令解碼 | instruction decode (ID) |
| 執行 | execution (EX) |
| 記憶體存取 | memory access (MEM) |
| 寫回 | write back (WB) |
| 延遲 | latency / response time |
| 產出量 | throughput |
| 加速比 | speedup |
| 每指令週期數 | CPI (cycles per instruction) |
| 寫入埠 | write port |
| 功能單元 | functional unit |
| 控制訊號 | control signal |
| 主控制器 | main controller |
| ALU 控制器 | ALU controller |
| 真值表 | truth table |
| 分組 | grouping |
| 目的暫存器 | destination register |
| 多工器 | multiplexer (mux) |
| 符號延伸 | sign extension |
| 時脈邊緣 | clock edge |
| 圖形表示法 | graphic representation |
| 停頓 | stall |
| 氣泡 | bubble |
| 危障 | hazard |
| 結構危障 | structural hazard |
| 資料危障 | data hazard |
| 控制危障 | control hazard |
| 相依 | dependency |
| 回授路徑 | feedback path |
| 清除 | flush |
| 資源衝突 | resource clash |
| 指令記憶體 | instruction memory (IM) |
| 資料記憶體 | data memory (DM) |
| 內部轉送 | internal forwarding |
| 寫後讀 | read after write (RAW) |
| 讀後寫 | write after read (WAR) |
| 寫後寫 | write after write (WAW) |
| 流相依／真相依 | flow dependency / true dependency |
| 反相依 | anti dependency |
| 輸出相依 | output dependency |
| 名稱相依 | name dependency |
| 暫存器重新命名 | register renaming |
| 亂序執行 | out-of-order execution |
| 自動遞增 | auto increment |
| 控制危障／分支危障 | control hazard / branch hazard |
| 轉送 | forwarding (bypassing) |
| 空指令 | no-op (nop) |
| 管線暫存器 | pipeline register |
| 轉送單元 | forwarding unit |
| 危障偵測單元 | hazard detection unit |
| 載入後使用 | load-use |
| 雙重資料危障 | double data hazard |
| 分支預測錯誤 | branch misprediction |
| 分支懲罰 | branch penalty |
| 預測不跳 | predict not taken |
| 邊緣觸發 | edge trigger |
| 沖掉（指令） | flush |
| 分支決定 | branch decision |
| 動態分支預測 | dynamic branch prediction |
| 分支預測緩衝區 | branch prediction buffer |
| 分支歷史表 | branch history table (BHT) |
| 關聯式記憶體 | associative memory |
| 快取 | cache |
| 循序下一個指令 | fall through |
| 翻轉預測 | flip prediction |
| 1 位元預測器 | 1-bit predictor |
| 2 位元預測器 | 2-bit predictor |
| 有限狀態機 | finite state machine |
| 正反器 | flip-flop |
| 分支目標緩衝區 | branch target buffer (BTB) |
| 延遲分支 | delayed branch |
| 延遲槽 | delay slot |
| 空指令 | nop (no-op) |
| 讓常見情況變快 | make the common case fast |
| 例外 | exception |
| 中斷 | interrupt |
| 未定義運算碼 | undefined opcode |
| 溢位 | overflow |
| 例外程式計數器 | EPC (Exception Program Counter) |
| 原因暫存器 | Cause register |
| 例外處理程式 | exception handler |
| 出事的指令 | offending instruction |
| 單一入口 | single entry point |
| 向量式中斷 | vectored interrupt |
| 可重新開始的 | restartable |
| 精確例外 | precise exception |
| 不精確例外 | imprecise exception |
| 超純量 | superscalar |
| 指令層級平行 | instruction-level parallelism (ILP) |
| 更深的 pipeline | deeper pipeline |
| 多重發出 | multiple issue |
| 每指令週期數 | cycles per instruction (CPI) |
| 每週期指令數 | instructions per cycle (IPC) |
| 靜態多重發出 | static multiple issue |
| 動態多重發出 | dynamic multiple issue |
| 發出封包 | issue packet |
| 猜測執行 | speculation |
| 推測載入 | speculate on load |
| 退回 | roll back |
| 修正程式 | fix-up routine |
| 超純量處理器 | superscalar processor |
| 依序提交 | in-order commit |
| 超長指令字 | very long instruction word (VLIW) |
| 排程 | scheduling |
| 雙發出 | dual issue |
| 讀取埠／寫入埠 | read port / write port |
| 迴圈展開 | loop unrolling |
| 反相依 | anti-dependence (WAR) |
| 迴圈控制開銷 | loop control overhead |
| 保留站 | reservation station |
| 提交單元 | commit unit |
| 重排序緩衝區 | reorder buffer |
| 功能單元 | function unit |
| 功耗牆 | power wall |
| 多核心 | multi-core |
