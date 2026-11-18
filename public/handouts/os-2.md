# Process管理

OS 要管的是正在執行的程式，也就是 process。這一章回答四件事：process 在 memory 裡長什麼樣、OS 用什麼資料結構追蹤它（PCB）、它在五個狀態之間怎麼移動、OS 怎麼在 process 之間切換（context switch）與排程（三種 scheduler）；接著從 programmer 的角度看 process 怎麼被生出來（fork、exec、wait）、怎麼結束，最後是 process 之間怎麼溝通（shared memory、message passing、socket、RPC）。五狀態圖、context switch、fork 程式的 output 推導、producer–consumer 的 full／empty 條件都是必考。

## 學完這章要會
- 分清 program 與 process，畫出 process 的 memory layout（text、data、heap、stack）
- 默寫五狀態圖，說出每條轉換的原因
- 說出 PCB 裡有什麼、存在哪裡
- 說明 context switch 的步驟、為什麼是 overhead、怎麼讓它變快
- 比較 thread 與 process 共用與不共用的資源
- 分辨 long-term、short-term、mid-term scheduler，以及 degree of multiprogramming、CPU-bound／I/O-bound mix、thrashing
- 用 fork、exec、wait 推導程式的 output，畫 process tree，算出 n 個 fork 產生幾個 process
- 說明 copy-on-write、process termination、cascading termination
- 比較 shared memory 與 message passing；寫出 bounded buffer 的 full／empty 條件
- 分辨 direct／indirect communication、blocking／non-blocking；說出 socket 與 RPC 的運作

## Program 與 Process
中文的「程式」兩件事都叫，英文分得很清楚：

| | Program | Process |
|---|---|---|
| 性質 | **passive entity**：被動、不會動 | **active entity**：正在 execute 的程式 |
| 在哪裡 | disk 上的一個檔案（一串 binary code） | 已經被 load 進 **memory**、正在跑 |
| 比喻 | 書架上的一本食譜 | 照著食譜正在煮菜的過程 |

為什麼一定要進 memory？因為 CPU 只能直接存取 memory，disk 上的東西它碰不到。沒人執行的 program 永遠只是個檔案。OS 管的是 process；答題時用字千萬別混。

## Process 在 memory 裡的樣子
每個 process 有自己的一塊 **address space**，從 0 到 max，裡面切成幾塊：

- **Code segment（text）**：程式碼。原本存在檔案裡（例如 a.out），執行時 OS 把它 load 進來；放的是 compiler 編好的一道道機器指令，等 CPU 一條一條 fetch，不是 C 原始碼。
- **Data section**：**global variable**。load 時就知道有哪些，一開始就存在，任何 function 都看得到。
- **Stack**：**local variable**（function 裡宣告的變數）與 function call 的資訊。function 一 return 這些變數就不要了，stack 後進先出，一次 pop 掉，很有效率。
- **Heap**：**dynamic allocation**，例如 `malloc` 在執行時才要來的空間。最自由、要多少拿多少，也最容易出錯：空間由 programmer 自己管，用完要 deallocate，不然就是 **memory leak**。

```
max ┌──────────────┐
    │    stack     │  ↓ 往下長（local variable、function call）
    │      ↓       │
    │  （空出來）  │
    │      ↑       │
    │    heap      │  ↑ 往上長（malloc）
    ├──────────────┤
    │    data      │  global variable（大小固定）
    ├──────────────┤
    │    text      │  程式碼（大小固定）
  0 └──────────────┘
```

> **例題** `int g;`（在所有 function 外）放 data；`main` 裡的 `int x;` 放 stack；`int *p = malloc(8);` 中，指標變數 p 本身是 local variable 放 stack，它指到的那 8 byte 在 heap。

text 和 data 大小固定；heap 和 stack 在 run time 會變大變小，所以中間留一段空間，heap 往上長、stack 往下長，整塊空間用得有效率（實際擺法每個 OS 不太一樣）。malloc 太多，或 recursive 呼叫太深讓 stack 一直長，空間用完或超過大小限制，系統就回報 **out of memory**。每一區的管理方式不同，寫程式時要清楚每個變數在哪一區。

### Process 的 metadata
除了 memory 裡這四塊，OS 還要記「關於這個 process 的資料」：

- **Process state**：處在五個狀態的哪一個
- **Program counter（PC）**：現在執行到哪一行指令，最重要
- **Register 的內容**：register 是 CPU 裡超快的小格子，算到一半的值都在裡面。CPU 大家輪流用，register 不可能一直留給同一個 process，所以被換下來時要把值存起來，下次才能從原地接著做。這是 time sharing 的代價：誰都不能霸佔 CPU，被 switch 走之前得先存檔。
- **Resource 的狀態**：開了哪些檔案、用了哪些 socket 的 port（OS 給的像號碼牌一樣的 reference）

這些整理成一張表，就是 PCB。

## Process 的五個狀態
1. **New**：剛被 create。要把 program load 進 memory、配好各個 segment、做初始化。memory 很小的電腦（早期電腦、現在一些 embedded device）開太多 process，連 new 都會失敗，直接 out of memory。
2. **Ready**：process 搶的是 CPU 的 core，core 有限，先排進 queue 等。
3. **Running**：被選中，instruction 真的送進 CPU 執行。
4. **Waiting**：程式除了用 CPU 還會做 I/O（printf、scanf）。做 I/O 時不需要 CPU，但也不能馬上往下跑，於是進 waiting。等 I/O 做完、又需要 CPU 了，回到 ready。
5. **Terminated**：跟 new 相反，把所有資源 release，還給 OS。

```
                 admitted                 exit
     new ──────────────> ready      running ──────> terminated
                          │  ▲        ▲  │
       scheduler dispatch │  │        │  │
                          └──┼────────┘  │
                             │ interrupt │（timer：time slice 用完）
                             └───────────┤
                                         │ I/O 或 event wait
   I/O 或 event 完成                     ▼
   ready ◄────────────────────────── waiting
```

| 轉換 | 原因 |
|---|---|
| new → ready | OS **admit**：准不准你進來。memory 不夠，或沒有執行這個程式的 permission，就擋掉 |
| ready → running | **scheduler dispatch**：schedule 是選人，dispatch 是把選到的人 load 上 CPU |
| running → ready | **interrupt**，通常是 timer：time sharing 系統每隔幾 ms 發 hardware signal，主控權回到 OS 的 scheduler |
| running → waiting | 自己做 **I/O**，或 call **sleep** 這種 system call，主動放掉 CPU；也包括等別的 process（例如 wait 等 child） |
| waiting → ready | I/O 完成或 sleep 時間到，靠 interrupt 通知 OS，把它移回 ready |
| running → terminated | exit |

> **重點** scheduler 只從 ready queue 挑人：在 ready，代表一定能執行。waiting 的 process 就算 CPU 空著也不能跑，這是 waiting 和 ready 最大的不同。ready 和 waiting 都用 queue 管理。

> **陷阱** 被 timer interrupt 打斷 → 回 **ready**；自己 call sleep 或做 I/O → 進 **waiting**。不要因為「被停下來」就一律答 waiting。

**狀態對應位置**：
| 狀態 | 在哪裡 |
|---|---|
| new | 還在 disk、剛被 create、還沒擠進 memory |
| ready | 在 memory，隨時能上 CPU |
| running | 在 CPU 上 |
| waiting | 在 memory，卻不能上 CPU（等 I/O、等 interrupt、等別的 process、sleep） |
| terminated | 執行完離開 |

CPU 只有個位數到十幾個 core，memory 裡等著的 process 卻很多（multiprogramming）；disk 上還有更多 program 等著進 memory，memory 也有限。所以每一關都有人在搶位子，都需要排程。

## PCB：Process Control Block
process 一被 create，OS 就幫它 allocate 一張 **PCB**，記錄控制、管理這個 process 需要的資訊：

| 欄位 | 內容 |
|---|---|
| **Pointer** | 用來把 PCB 串進各種 queue（linked list） |
| **Process state** | new、ready、waiting… |
| **Program counter** | 下一條要執行的指令 |
| **CPU registers** | register 的內容（被換下來時存在這裡） |
| **CPU scheduling 資訊** | priority 等 |
| **Memory-management 資訊** | base register、limit register 的值 |
| **I/O status 資訊** | 在等哪個 device、開了哪些檔案 |
| **Accounting 資訊** | 用了多少資源，例如開了幾個 file |

重點細節：
- 說「把 process 放進 queue」，其實是把它的 **PCB** 放進去。OS 不會去搬 process 的 memory，而是用 linked list 把 PCB 一個個串起來。
- PC 和 register 是 OS 幫它記的，process 自己的 memory 裡沒有。
- base／limit 這種 hardware register 就那幾個，所以平常存在 PCB，輪到它 running 才 load 上去做檢查。
- 每個 device 有自己的 waiting queue，PCB 記下在等哪個，找得快。
- 系統怎麼知道你開了超過 400 個檔案？PCB 的 accounting 記的。
- **PCB 存在 kernel space**（OS 自己的 memory）。

## Context switch
**Context switch** 是專有名詞：把 CPU 上正在跑的 process 換成另一個 process。CPU 能被 share，全靠它。

什麼時候會換？一定是有 **interrupt**（例如有人按了 keyboard、timer 到了），或程式自己呼叫了 **system call**（例如 printf，請 OS 幫忙；CPU 先交給 OS 處理，OS 可能決定換另一個 process 上來，例如這個 process 要等 I/O）。不然 CPU 就一條一條讀同一個 process 的指令，它會永遠佔著 CPU。

```
P0（執行中）        OS                          P1
   │ interrupt 或 system call
   └─ idle ──> 把 PC、register 存進 PCB0
               從 PCB1 load P1 的 state  ───────> 執行（從 PCB1 記的 PC 開始）
                                                  │ interrupt 或 system call
               把 P1 的 state 存進 PCB1 <──── idle ┘
               從 PCB0 load P0 的 state
P0 從上次停下的地方繼續 <──
```

步驟：
1. P0 被打斷後只能 idle，等 OS 再讓它執行。
2. OS 把 CPU 裡的 state（PC、register）全部存進 P0 的 PCB。
3. 從 P1 的 PCB 把它的 state load 進來（P1 是 scheduler 選出的另一個 process，可能是別的 user 的）。
4. switch 完成，P1 才從它的 program counter 開始 fetch 指令。
5. 要換回 P0 就反過來：P1 的 state 存進 PCB1，再 load PCB0。上圖總共 switch 了兩次。

做這些事的時候，**P0 和 P1 都是 idle**，CPU 跑的是 OS 做 switch 的程式碼。所以 context switch 就是 kernel 透過 PCB 做 save 和 load，讓 process 從上次停下的地方繼續。

### Context switch 是 overhead
switch 期間大家都在 idle，對使用者來說就是浪費 CPU cycle：它純粹是為了管理和 sharing 付出的時間，所以是 **overhead**。能不做嗎？做不到：CPU 要 share、response time 要好，就得靠它，這是 trade-off。time sharing 每幾 ms 就要 switch 一次，所以一定要讓它變快：

1. **Memory 速度**：switch 其實就是在 memory 做 save、load，memory 快它就快。
2. **Register 少一點**，要存的就少。但現代 CPU 不會這樣做：register 越多算得越快、程式越好寫，所以反而越來越多。
3. **特殊指令**：有些 CPU 提供一條 instruction 就把所有 register 一次 save 或 load 完。
4. **Hardware support：多組 register set**（最常見）：CPU 裡準備好幾組 register，好幾個程式的狀態都留在 hardware 裡，switch 只是換一組 register 用，不用寫回 memory。速度快，代價是成本高（register 是很貴的儲存元件）。

> **陷阱** user mode ↔ kernel mode 的切換叫 **mode switch**，不是 context switch。context switch 是換到另一個 process，一定要存取 PCB。

## Thread：lightweight process
**Thread（執行緒）** 又叫 **lightweight process**。OS 管 thread 的方式跟 process 一樣，差別是：**同一個 process 底下的 thread 會共用一些 memory**。create thread 時共用的空間不用重建（parent process 早就配好了），所以 lightweight。而且 CPU 真正執行的基本單位其實是 thread；只有一個 thread 的 process，就是一對一。

| 同一個 process 的 threads 共用 | 每個 thread 自己有 |
|---|---|
| code section | thread ID |
| data section（global variable） | program counter |
| OS resource（例如 open 的 file） | register set |
| heap（有 pointer 就讀得到） | stack |

- 一個 thread open 了 file，另一個 thread 直接拿那個 file pointer 就能 read、write。
- register 和 stack 不共用：每個 thread 可能跑在不同位置、甚至不同 function，PC 和狀態得各自記；stack 放 function call 和 local variable，每個 thread 呼叫的 function 不同，彼此看不見。
- data section 共用，所以 multi-thread 程式用 global variable 溝通；heap 上的東西只要有 pointer，哪個 thread 都能讀。

thread 只是 process 下面再一層，管理概念相同。Linux 對 OS 而言每個 process 都當 thread，只看彼此哪些 memory 共用（教學用的 Nachos 也都叫 thread，它的 PCB 叫 thread control block）。

## Process scheduling
現代系統是 multiprogramming（很多 process 同時放在 memory，把 CPU 用到最滿），又要很頻繁地 context switch 才做得出 time sharing，所以大家要輪流用 CPU，誰先誰後交給 OS 裡叫 **scheduler** 的 module 決定。CPU 空出來，或有人被強迫 context switch，scheduler 就被叫起來挑下一個。

### 各種 queue
有 queue 就要 schedule：

- **Job queue**：早期 memory 小的電腦才有，決定哪個 program 可以 load 進 memory。從 job queue 被選進 ready queue 之後，還要再被 schedule 一次才輪得到 CPU。
- **Ready queue**：最主要，決定誰用 CPU。比較複雜的演算法 ready queue 可能不只一條（分 level 1、2、3）。
- **Device queue**：waiting 的 process 在這裡。每個 device（disk、印表機、鍵盤）通常各有一條；像 sleep 這種不是 I/O 的等待，也有另外的 waiting queue。

全都用 PCB 裡的 pointer 串起來，有時記 head 和 tail，甚至雙向串，方便 scheduler 在 run time 調整順序。

### Queueing diagram
```
ready queue ──> CPU ──┬──> exit
     ▲                ├── I/O request ──────> I/O queue ──> I/O 完成 ──────┐
     │                ├── time slice expired ──────────────────────────────┤
     │                ├── fork a child ──> child 執行（若 parent 要等）────┤
     │                └── wait for an interrupt ──> interrupt 發生 ────────┤
     └─────────────────────────────────────────────────────────────────────┘
```

process 被踢出 CPU 的原因：
1. **I/O request**（例如 call printf）：進那個 device 的 queue；I/O 做完，device 丟 interrupt，OS 把它放回 ready queue。
2. **Time slice expired**：timer 的 alarm 響了，直接回 ready queue 尾端。
3. **Fork a child**：process 也要被「生」出來（Linux 叫 fork）。若設計成讓 child 先跑，parent 就進 waiting，等 child 跑完再回 ready。
4. **Wait for an interrupt**：例如 call `sleep(100)`，請 OS 100 秒後 fire interrupt 叫醒我。

OS 通常為不同 event 準備專門的 queue。

### 三種 scheduler
| | Long-term（job scheduler） | Short-term（CPU scheduler） | Mid-term |
|---|---|---|---|
| 管哪一段 | disk → memory：哪個新程式可以被載入 | memory → CPU：ready 的 process 誰先上 CPU | memory → disk（swap out）與 disk → memory（swap in） |
| 頻率 | 低：幾秒甚至幾分鐘一次，要有人 launch 新程式才需要決定（人的動作很慢） | 非常高：至少每 100 ms 左右就一次（常常更頻繁），timer、system call、I/O interrupt 都會叫醒它 | 依需要 |
| 任務 | 控制 **degree of multiprogramming**，挑好的 CPU／I/O mix | 一定要 **efficient**，顧 waiting time 與 fairness | **swapping**：控制 degree、improve process mix、free 出 memory |

### Long-term scheduler 與 degree of multiprogramming
**Degree of multiprogramming** = memory 裡現在有幾個 process。long-term 決定 new 的程式能不能進 memory，等於在控制這個數字。

- degree 太低：像 batch 系統永遠是 1，它一去等 I/O，CPU 就沒事做。
- degree 太高：大家搶有限的 memory，一直在 disk 和 memory 之間 swapping，叫 **thrashing**。thrashing 時 CPU 看起來很忙，其實都在忙搬資料，沒在跑你的指令，所以還是很慢。

挑誰進 memory 很影響效能。原則來自 multiprogramming 的目的：讓 CPU 時間跟 I/O 時間 overlap。

- **CPU-bound** process：大部分時間在計算（加減乘除）。
- **I/O-bound** process：大部分時間在做 I/O（printf、scanf）。

全是 CPU-bound，CPU 忙翻，I/O device 全閒著；全是 I/O-bound，大家都在等很慢的 I/O，CPU 還是 idle。所以要挑出平衡的 **mix**，兩邊都不 idle。

現在 memory 大、又有 virtual memory，程式一執行就直接進 memory，long-term 已經淡化；挑人的工作交給 mid-term：先全部載入，之後再決定把誰 kick out 回 disk。重點不在誰負責，而是 ready queue 裡的 **CPU／I/O mix 和 degree** 永遠都重要。

### Short-term scheduler
核心是 scheduling algorithm（CPU 排程章專門講），要顧：

- **Waiting time**：大家平均等多久，像中午排隊買飯，越短越好。同樣一群人、同樣的到達順序，換個演算法，平均等待時間就不同。
- **Fairness**：大家等的時間盡量差不多。平均低不代表大家都滿意，就像國家平均收入高不代表均富；最久的人不能等無限久。
- 這些直接影響使用者感受到的 **response time**。

偏偏這個演算法自己要非常快：queue 很長時光掃一遍就要時間，要是 O(n²) 就慘了。

> **例題** 每 100 ms 排一次，演算法每次跑 10 ms：overhead = 10 / 100 = **10%**，這段 CPU 完全沒在幫使用者做事。若演算法要跑 50 ms，CPU 雖然 100% 在忙，卻有一半時間不在做你的事，當然覺得慢。所以 short-term 的演算法不能太複雜，理論再好跑太久就不 practical。

### Mid-term scheduler 與 swapping
mid-term 跟 virtual memory 一起出現：memory 不夠大，就拿 disk 一塊 **swap space** 當延伸。memory 不夠時，它把一些 process 踢回 disk，這叫 **swapping**：把 memory 裡的內容整個 dump 到 disk 存起來。為什麼有東西可以搬？一個程式一開口就能 allocate 1 GB，但通常不會馬上全用到，這些要了還沒在用的空間就先搬到 disk，把 memory 讓給別人。

- **Swap out**：memory → disk。控制 degree，避免 thrashing。
- **Swap in**：memory 空出位置，或它被選中要執行時，把等在 disk 的 process 搬回來。
- 目的：最主要是 **improve process mix**（調整 CPU-bound 和 I/O-bound 的比例；現代沒有 long-term，進來之後就靠 mid-term 管）；其次是 **free 出 memory**，把只是在等的 process 搬出去，讓給真正在跑的程式。

> **陷阱** 存到 disk 的不是原本的程式檔，而是它在 memory 裡的**當下內容**（變數的值、stack 等）。被 swap out 的 process 不能直接執行，要先 swap in 回 memory 才能回 ready。這種狀態有人歸在 waiting，恐龍書另外稱為 **suspended**。

## Process creation
### PID 與 process tree
每個 process 是獨立的 entity，一被 create 就 assign 一個獨一無二的 **PID（process identifier）**，就像身分證字號。process 不是開機就全部出現，而是被「生」出來的，有 **parent** 和 **children**。開機時只有一個 process（恐龍書圖中叫 `init`，PID 為 1），其他 process 都是它或它的後代 create 出來的。所以任何系統、任何時刻都畫得出一棵 **tree of processes**。在 Linux 上打 `ps -ael` 會列出所有 process 的 PID，每一行還有它的 parent（PPID），串起來就能重建這棵 tree。

不會有沒有 parent 的 process（就像 C 裡的 dangling pointer，OS 不允許）：有些系統在 parent 不見時把下面的 process 一起砍掉，叫 **cascading termination**；Linux 則讓 init（systemd）收養孤兒 process。

### Parent 與 child 的三個設計面向
parent 和 child 是兩支不同的程式，但有關聯。每個面向選哪一種，由設計 OS 的人決定：

1. **Resource sharing**（parent 開了 a.txt，child 能不能直接用那個 file handler？）
   - share all：看到的完全一樣
   - share subset：例如 global variable 看得到、動態配置的看不到
   - share nothing：各自一份 copy，address 完全不同
2. **Execution（執行順序）**：parent 生出 child 後有兩個 process，CPU 只有一顆，誰先？
   - concurrent：當成兩支普通程式，scheduler 決定誰先
   - parent 等 children terminate：child 優先。parent 一生完就進 waiting queue（注意它不是在做 I/O，也不是 sleep）
3. **Address space（memory content：code、data、heap、stack）**
   - duplicate：把 parent 的內容整份複製給 child，連 PC 都一樣（parent 在第 3 行生 child，child 也從第 3 行開始）。看起來、跑起來都一樣，連 virtual address 都一樣，但背後是各自獨立的 physical memory（改了自己的變數不會影響對方），本質上是兩支程式。
   - load new program：create 時直接 load 新 program 進 child 的 code section，PC 重設。

### fork()
UNIX／Linux 用 **fork** 這個 system call 生 child。對照上面的選項：

- **Address space：duplicate**。fork 之前有哪些 global variable、heap 配了什麼、值多少，child 全都有：你的 a 是 5，我的 a 也是 5，全部照抄一份變成 child 自己的。連 PC 都一樣：兩個都停在 fork 這一行。
- **Execution：concurrent**。可能 child 先跑，也可能 parent 先，由 OS 決定，parent 不用進 waiting。
- **唯一的不同是回傳值**：
  - child 拿到 **0**
  - parent 拿到新 child 的 **PID**（所以 parent 知道 child 是誰）
  - 失敗時回傳負值

> **比喻** 父母一定知道小孩是誰，小孩不一定知道父母是誰。child 想知道 parent，要另外 call system call 問 OS，例如 `getppid()`；自己的 PID 用 `getpid()`。

程式就靠回傳值判斷：pid 等於 0 走 child 的路，否則走 parent 的路。

> **例題** 程式 fex1.c 的 main 只有一行 `printf("Hello\n")`，並用 `getpid()` 印出 PID。用 `gcc fex1.c` 編出 a.out、`./a.out` 執行：印一行，PID 例如 5824。在 printf 前面加一行 `fork();` 重新編譯執行：印了兩次，PID 分別是 5837 和 5838。因為 fork 生了 child，後面的程式 parent 跑一次、child 也跑一次；兩個 PID 不同，內容卻一樣，所以印出一樣的字。

### exec 家族（execlp、execv…）
fork 是 duplicate，連執行碼都一樣；但生新 process 通常是要它做不同的事，所以 Linux 程式 fork 完下一步通常 call **exec** 家族（`execlp`、`execv` 等）。

給它一個 binary file（例如 `/bin/ls`），它把這個 process 的 **code segment 整個 replace** 成新程式，**heap、stack 全部清空，PC 設回新程式的起點**，等於 reset。這樣 child 就變成在跑 ls（列出資料夾內容的指令）。

> **重點** exec **不建立新 process**，是替換既有的那一個（包括它所有的 thread），所以 **PID 不變**，只有內容換了。exec 一定要傳參數，而且這個參數是另一支 program。exec 成功後，原程式碼在它後面的部分永遠不會執行。

| | fork | exec |
|---|---|---|
| 做什麼 | 建立一個跟自己一模一樣的 replica | 用參數指定的 program 取代整個 process |
| 新 process？ | 是，多一個 process | 否 |
| PID | child 拿到新的 PID | 不變 |
| 內容 | 與 parent 相同 | 換成新程式 |

> **例題** ex1.c：先用 `getpid()` 印自己的 PID，宣告 `char *args[] = {"Hello", "OS", "World", NULL};`，然後 `execv("./ex2", args);`，後面還有一行 `printf("Back to ex1.c");`。ex2.c 只有兩行：印 `We are in ex2.c`，再印自己的 PID。（編譯用 `gcc ex1.c -o ex1`、`gcc ex2.c -o ex2` 指定檔名，否則兩個 a.out 會互相蓋掉。）
> 執行 `./ex1`：
> ```
> PID of ex1.c = 5962
> We are in ex2.c
> PID of ex2.c = 5962
> ```
> ex2 印出的 PID 還是 5962：不是「跳」到另一支程式，而是同一個 process 的內容被 ex2 取代。`Back to ex1.c` 永遠印不出來，原本的程式碼已經被換掉，回不去了。

### 為什麼 fork 和 exec 要分開
既然 exec 會把內容整個重來，幹嘛先 fork？因為 **create 跟 reset 內容是兩件不同的事**：

- create（fork 做的）：跟 OS 註冊 PID、allocate memory space、建 PCB 這些 metadata、全部 initialize。exec 不管這些。
- 生出來之後放什麼變數、PC 多少、code 放什麼（exec 做的）。

所以要生一個新 process 去跑另一份 binary，就先 fork、再 exec。這只是 Linux 的決定：每個 OS 都能 define 自己的 system call，creation 真正的考量就三個（執行順序、資源歸誰、memory space 的起始狀態是複製還是重來），新版也可以加新的 system call。但 kernel 很複雜，system call 越少越好維護：給一塊塊 service，讓 programmer 自己組合。

### wait()
fork 是 concurrent，parent 和 child 誰先跑你控制不了；想控制就用 **wait**。call wait 時 parent 把自己放進 waiting queue，CPU 讓給 child，等 child 結束 OS 再把 parent 放回 ready queue。這是 programmer 自己下的同步指令，不是 OS 預設。Linux 的 `wait` 要給一個 status 的 pointer（記錄 child 結束時成功或失敗），回傳值是它等到的那個 child 的 PID；不指定等誰的版本，任何一個 child 結束它就返回，也有能指定 child 的版本。parent 還能對 child 做 kill、suspend 等，但 **fork、exec、wait** 三個最基本，一定要會。

### 例題：fork + execlp + wait 的 output
```c
#include <stdio.h>
#include <unistd.h>
#include <sys/wait.h>

int main() {
    pid_t a = fork();                       // 從這裡開始有兩個 process
    if (a == 0) {                           // child：a 是 0
        printf("I am child process\n");
        execlp("/bin/ls", "ls", NULL);      // child 變成 ls，後面的程式看不到
    } else {                                // parent：a 是 child 的 PID
        printf("I am parent process\n");
        wait(NULL);                         // 等 child（現在是 ls）結束
    }
    printf("process end\n");
    return 0;
}
```

推導：
1. call fork 後，想像旁邊多了一支一模一樣的 process，像雙胞胎，各有自己的 PC。唯一不同是 return 值：parent 的 a 是 child 的 PID（不可能是 0），child 的 a 是 0。（fork 其實是 C library 的 function，再去 call OS 同名的 system call。）
2. parent 走到 `a == 0` 不成立，跳去 else；child 進 if。程式碼一樣、同時在跑，但各有各的 PC，走到不同地方。
3. child 印 `I am child process`，接著 execlp：原本的程式碼整個被覆蓋，child 改去跑 `/bin/ls`，跑完就結束。後面的 `process end` 它根本看不到。
4. parent 印 `I am parent process`，然後 wait。child 內容換了，但還是同一個 process、同一個 PID，parent 等的還是它；parent 進 waiting queue，OS 知道 child 結束了就把它放回 ready queue。
5. parent 印 `process end`。

```
I am child process      ┐ 這兩行順序不一定（concurrent）
I am parent process     ┘
（ls 的輸出：列出目前資料夾的檔案）
process end             ← 一定在 ls 輸出之後，而且只有一行
```

> **重點** ls 的輸出一定在 `process end` 之前（parent 有 wait）；`process end` 只會出現一行（只有 parent 執行到）。前兩行的順序不能確定。

### Duplicate 怎麼實作：copy-on-write
A call fork 生出 child A'。兩種做法：

1. **Exact copy**（naive）：A 佔 100 MB 就再要 100 MB，全部 copy 一份。兩份內容一模一樣，很浪費。
2. **Copy-on-write**（實際系統常用）：只複製一定會改的部分（例如 PC、執行時必要的基本資料），其他部分不複製，用類似 pointer 的方式指回 parent，兩個 process 共用同一份。只要 parent 或 child 有人**寫**了共用的部分，OS 在 run time 發現，才真的 copy 那一塊，兩邊分家。所以 A' 一開始比 A 小，會慢慢長大，最後可能跟 A 一樣大，但值已經不同了。

對使用者來說兩個內容就是一模一樣，只是 OS 偷偷省下不必要的 memory。要是 child 呼叫 exec，code 換成別的程式、heap 也 reset，那塊空間就跟 A 完全脫鉤；有 copy-on-write，fork 完馬上 exec 也不會白白 copy 一大份。

### 例題：迴圈裡的 fork 與 process tree
> **例題** 下面的程式產生幾個 process？
> ```c
> for (int i = 0; i < 3; i++)
>     fork();
> ```
> 畫 tree 最不會迷路。fork 不會 reset PC，所以 parent 和 child 都會進下一圈再 fork：
> ```
> i = 0：P0 ──fork──> P1                         共 2 個
> i = 1：P0 ──> P2，  P1 ──> P3                  共 4 個
> i = 2：P0 ──> P4，P1 ──> P5，P2 ──> P6，P3 ──> P7   共 8 個
>
>               P0
>         ┌─────┼─────┐
>         P1    P2    P4
>       ┌─┴─┐   │
>       P3  P5  P6
>       │
>       P7
> ```
> 總共 2³ = 8 個 process（含原本的 P0）。同一個 process 在草稿上重複畫也沒關係，先畫完再精簡，重點是 parent／child 關係要對。

> **例題** 連寫三個 `fork();` 後面接一行 `printf`，會印幾次？
> 一開始只有 P1。第一個 fork：P1 生 P2（2 個）；第二個 fork：P1 生 P3、P2 生 P4（4 個）；第三個 fork：4 個各生一個，P5～P8（8 個）。每個 process 都執行那行 printf，所以印 **8 次**，8 個 PID 都不同。

> **重點** n 個依序執行的 fork（沒有 if 擋住）產生 **2ⁿ** 個 process（含原本那個），也就是新生 2ⁿ − 1 個。

> **陷阱** 考題常混 if／else 和 exec。例如 `if (pid == 0) execlp(...)`：那一支被 replace 之後就不會再執行後面的 fork，tree 在那裡斷掉。exec 只換內容，不會生新 process。最好的練習是自己出題、在 Linux 上跑一次，跟畫的 tree 對照。

## Process termination
- **exit**：最基本的結束方式（main return 時也會呼叫 exit）。exit 把 file handler、I/O buffer、allocate 的 memory 全部 deallocate 還給 OS。
- **abort**：parent 可以給 child 的 PID，強迫 kill 一個 child。只能從上往下：kill 自己的 children，不能 kill parent。例如 web server 為不同 client 生了很多 child process，某個 client 吃太多資源（可能是 malicious user）或已經斷線，parent 就 abort 那個 child。
- **Cascading termination**：OS 是 tree 的概念，有些系統 kill 一個 parent，它下面的 children 會一層一層被砍掉。
- **Ctrl-C**：console（shell）是上層 process，你跑的程式是它的 child；按 Ctrl-C 是送一個 `SIGINT` signal 給前景的程式讓它結束。
- 要砍不是你生的程式（例如別人卡住的 web server），用 `kill` 指令請 OS 砍，但要有 permission。

process 之間有很嚴謹、一層一層的上下關係，所以才能這樣 kill process。

## Interprocess communication（IPC）
process 常要互相溝通才兜得成大系統。**IPC** 指 process（甚至 thread）之間溝通的機制。

- **Independent process**：不跟別人溝通。
- **Cooperating process**：要透過 IPC 完成工作（網路程式全都是）。

溝通的目的：
1. **Information sharing**：不限一台電腦，socket 也是 IPC。
2. **Computation speedup**：很多 process 平行解同一個問題，難免要溝通。
3. **Convenience**：例如 web server 讓每個 user 對到一個 process 或 thread，很好管理。
4. **Modularity**：標準例子是 microkernel，component 放 user space，靠 IPC 溝通。

### Shared memory 與 message passing
| | Shared memory | Message passing |
|---|---|---|
| 做法 | 有一塊共用空間，兩邊用 pointer 直接讀寫 | 把資料 copy 給對方（send／receive），跨電腦就像 email |
| 速度 | 快（直接用 address 存取） | 通常慢（要 system call、要 copy） |
| 同步 | 最討厭：要 programmer 自己處理 | send／receive 本身就帶同步 |
| 適合 | 人少、pattern 簡單、同一台電腦 | 跨電腦（只能用它）、人多、溝通複雜 |

自己分辨：用 pointer 就是 shared memory；call send、receive 就是 message passing。所有網路程式、socket programming 都是 message passing。資料很小、又不想碰 locking 時，message passing 有時反而更快。OS 兩種都提供；message passing 通常包成一層層 API，你不會直接 call system call。

## Shared memory
shared memory 沒什麼 API，就是 direct memory access。唯一的條件：要有一塊 **shared memory region**，process 和 OS 都知道可以共用。因為 protection，它 **by default 不存在**：

1. call system call 請 OS 建立這塊 region（Linux 的例子是 `shmget`）。
2. 要用的 process 再 call **attach**，跟 OS 說要用這塊。
3. 建好之後 OS 就不管了：放什麼 data structure、怎麼用 pointer，兩邊自己說好。

### 同步問題
兩個以上的 process 同時 write，結果就說不準。例如共用一個 counter：producer 放東西就 `counter++`，consumer 拿東西就 `counter--`。看起來 5 加 1 變 6、減 1 回 5；但兩邊同時做，結果可能是 4 或 6。

> **例題** `counter++` 其實是三條指令：`register1 = counter; register1 = register1 + 1; counter = register1;`，`counter--` 同理用 register2。counter = 5 時若交錯執行：
> ```
> producer: register1 = counter        (register1 = 5)
> producer: register1 = register1 + 1  (register1 = 6)
> consumer: register2 = counter        (register2 = 5)
> consumer: register2 = register2 - 1  (register2 = 4)
> producer: counter = register1        (counter = 6)
> consumer: counter = register2        (counter = 4)
> ```
> 最後 counter = 4（若最後兩步順序對調則是 6），正確答案應該是 5。這種問題要由使用者自己處理（同步章節）。

### Producer–consumer：bounded buffer
最標準的 shared memory 例子：producer 產生資料放進 buffer，consumer 一個一個拿出來；兩支程式共用一塊**大小有限**的 buffer（例如 `BUFFER_SIZE = 5`）。

- `in`：producer 下一個要寫的位置
- `out`：consumer 下一個要讀的位置
- buffer 要一直 reuse，所以是 **circular buffer**：in、out 加 1 之後都要 mod BUFFER_SIZE，折回前面。

要判斷兩件事：
- **Empty**（consumer 不能再拿，要等 producer）：東西拿光時 out 追上 in，`in == out`。
- **Full**（producer 不能寫，否則 override 還沒讀的資料，資料 lost）：`(in + 1) % BUFFER_SIZE == out`。

為什麼 full 要加 1？如果每格都寫滿，in 繞一圈又會等於 out，跟空的時候一樣，分不出空還是滿。所以只好**永遠空一格**，犧牲一格空間（學了 locking 就能用滿）。

```c
#define BUFFER_SIZE 5
item buffer[BUFFER_SIZE];   // 以下三樣放在 shared region
int in = 0;
int out = 0;

// producer
while (true) {
    /* 產生一個 item：next_produced */
    while (((in + 1) % BUFFER_SIZE) == out)
        ;   /* full：什麼都不做，原地空轉（busy waiting） */
    buffer[in] = next_produced;
    in = (in + 1) % BUFFER_SIZE;
}

// consumer
while (true) {
    while (in == out)
        ;   /* empty：原地空轉 */
    next_consumed = buffer[out];
    out = (out + 1) % BUFFER_SIZE;
    /* 使用 next_consumed */
}
```

while 後面直接接分號，表示條件成立時就卡在那行一直空轉，叫 **busy waiting**；這兩個 while 就是在做 synchronization。哪邊寫錯（例如忘了加 1），就會讀到舊的錯值。shared region 裡要放三樣共用的東西：buffer、in、out。buffer 放什麼型態（integer、floating point）由 programmer 決定。這個例子沒用 locking，同步那章會再回來看。

> **例題** BUFFER_SIZE = 5，in = 0、out = 0（空）。producer 連放 4 個：in 依序變 1、2、3、4。此時 (4 + 1) % 5 = 0 = out → full，第 5 個放不進去。所以 **BUFFER_SIZE 為 5 時最多同時放 4 個（BUFFER_SIZE − 1）**。consumer 拿走一個後 out = 1，(4 + 1) % 5 = 0 ≠ 1，producer 才能再寫到 buffer[4]，in 繞回 0。

producer–consumer 在系統裡到處都是，例如先 compile 再 link：compiler 是 producer，linker 是 consumer。

## Message passing
OS 的 **message system** 提供兩個最基本的操作 `send(message)` 和 `receive(message)`，幫你做 memory copy，不需要 shared variable。

一般 function call 是 blocking 的：動作沒完成就不 return。message passing 的特色是 **sender 和 receiver 兩邊都要 call**，對上了才完成。兩邊都 blocking 時就像打電話：對方接起來你們才開始講，而且你知道他「現在」在跟你講（之前他可能在睡覺），這就是同步。shared memory 本身做不到這種同步，剛剛才要另外寫 while 判斷。

> **重點** message passing 雖然慢（要 copy），但好寫：同步內建，自己的 memory 也不會被別人蓋掉。規模大、溝通的人多時，比較好 debug、也比較好想清楚。

### Link：physical 與 logical
溝通前要先建立一條 **communication link**，再用 send／receive 在上面交換資料。link 分兩層看：

- **Physical**：實際的通道，例如 network、同一台電腦的 memory bus，甚至可以用 shared memory 實作。
- **Logical**：programmer 在意的 send、receive 的行為：
  - direct 或 indirect
  - 單向或雙向（建好後是否雙方都能傳）
  - symmetric 或 asymmetric（兩邊角色是否對等，較 minor）
  - **blocking 或 non-blocking**（最重要）
  - 真的 copy，還是先送 reference 之後再 copy
  - message 大小固定或可變：越 low level 越重效能、限制越嚴（例如 IP 封包有長度上限）；高階 API 比較彈性（例如 HTTP 的 body 可以任意大小）

### Direct communication
要**指名道姓**，像打電話：
- `send(P, message)`：送給 process P
- `receive(Q, message)`：從 process Q 收

特性：
- 指定好誰跟誰，系統就知道要建 link，所以通常**自動建立**。
- 一定是 **one-to-one**：一條 link 只連一對 process，不能 broadcast，也不適合對整個 group 傳。
- sender、receiver 很清楚，所以 link 通常是單向的（但沒有硬性規定）。
- 用它寫 producer–consumer 超簡單：一邊 send 下一個、一邊 receive 下一個，不用 while 判斷；兩邊都 blocking 時，send 要等對方 receive 才 return，送一個收一個，自然強同步。

缺點：太 synchronous（很多人要寫時大家都在等，中間的 buffer 可能爆掉）；最大的缺點是**對象寫死**，A 和 B 的 channel 不能改成 A 和 C，換人就得重建連線（overhead），沒有 modularity，是 ad hoc 的寫法。但不需要彈性時，它最簡單也最快。

### Indirect communication：mailbox
想成 email：信不是直接交到對方手上，而是先進一個 **mailbox（也叫 port）**，再由系統轉交。
- `send(A, message)`：送到 mailbox A
- `receive(A, message)`：從 mailbox A 拿

receiver 不認得 sender，sender 也不在乎誰收。特性：
- link 就是 mailbox，**要由 programmer 先建立**。
- 支援 **many-to-many**：很多人能去同一個 mailbox 拿，甚至像貼海報、大家都能讀；一對 process 也可以共用好幾個 mailbox。
- mailbox 是第三方，不是 sender 也不是 receiver；OS 提供的話就用 kernel memory 保管。

問題：P1 送一個 message 到 mailbox，P2、P3 同時 receive，誰拿到？不該兩個都拿到。解法：
1. 一條 link 最多只准兩個 process（名義上 indirect，實際就是 direct，不是好解法）。
2. 同一時間只准一個 process 執行 receive（用 locking）。
3. 讓系統（mailbox）自己決定給誰，再 notify 被選中的那個。

| | Direct | Indirect |
|---|---|---|
| 指定對象 | 指定對方 process | 指定 mailbox |
| Link 建立 | 自動 | programmer 建立 mailbox |
| 對應 | one-to-one | many-to-many |
| 比喻 | 打電話 | 寄 email |
| 優缺點 | 簡單、快、強同步；對象寫死、沒有 modularity | 有彈性；多人同時 receive 要處理 |

### Blocking 與 non-blocking
- **Blocking = synchronous**
- **Non-blocking = asynchronous**：不知道對方收到沒，像寄 email，寄出去就做我的事；message 也可能被 drop。比較複雜，但不用等，通常更有效率。

| | Blocking | Non-blocking |
|---|---|---|
| send | 等 receiver 真的收到、copy 進它的 buffer 才 return | 送出去就 return（像在 Gmail 按下 send） |
| receive | 一定要拿到 message 才 return（對方什麼時候送沒辦法預測） | 立刻 return，buffer 可能根本沒被填；通常回傳一個 token，讓你事後檢查收到了沒 |

send 和 receive 各有兩種版本，可以混搭，但同類配對邏輯上比較 make sense。

實作上的差別其實是 **buffer 怎麼控制**：
- **Blocking**：兩邊都 call 了就直接從 sender copy 到 receiver；可以看成 buffer 容量是 0 或 1。
- **Non-blocking**：receiver 還沒來，sender 已經送好幾個都 return 了，中間的 service 得有 buffer。
  - **Bounded** buffer：滿了，原本不等的 send 就被擋住，或回 error。
  - **Unbounded** buffer：一直 allocate，直到 out of memory。

## Socket
message passing 最常見的是 **socket**（另一個是 RPC）。socket 認對象的方法是 **IP + port**：
- **IP** 指一台電腦。
- **port** 指那台電腦上的一個 process：網路程式第一件事就是 **bind** 到一個 port，OS 收到封包才知道交給誰。每種服務有慣用的 port number，例如 HTTP 是 80、FTP 是 21。
- 所以 IP + port 就是「哪台 host 上的哪支程式」。兩個 process 不能綁同一個 port。

socket 很 **low-level**：message 就是一串 **unstructured bytes**，沒有資料型態。sender、receiver 要事先說好怎麼解讀（parsing 歸 programmer），它不會直接傳 integer 或 data structure 給你。

### Socket programming 的流程
```
server                                client
socket()   開一個 socket
bind(port) 綁到一個 port
listen()   上線，等人連進來
accept()   block 在這等  <────────── socket()
           有人 connect 就建立 link  connect()
read()/write()  <──────────────────> read()/write()
close()                               close()
```

client close 只關自己的 socket；server close 會連整個 port 都關掉。

如果 server 是 single thread，一次只能服務一個人。實際上 accept 之後，main thread 會 create 一個新的 thread 去服務這個 client，自己回去 listen 下一個，main thread 就不會被擋住。用 thread 而不是 process，是因為它們還有很多資訊要 share。所以 web server 都是 multi-thread programming。

## RPC（Remote Procedure Call）
socket 很 flexible，但只是一串 bytes；寫程式最喜歡的是 function call。**RPC（遠端程序呼叫）**：你 call 的 function 在另一個 process，甚至另一台電腦上。

- RPC 是建在 OS system call 上的一層 API。
- server 定義一些 function，透過 RPC library **register** 哪些可以被 call，也要設定 port。
- client 直接 call server 上的 function，例如 `add(3, 4)`；參數和回傳值都**有 data type**，不只是一串 bytes。
- programmer 不用管對方在哪台電腦、哪個 process，就像 call 普通 function；caller 像一般 blocking function call 一樣等結果傳回來。

### Stub 與 parameter marshalling
怎麼讓遠端的 function 用起來像本地的？關鍵在 RPC library 裡的代理程式：
- client 端的叫 **stub**，server 端的叫 **skeleton**，都由 library 實作，不用自己寫。
- 它們負責把有 data type 的參數**打包和拆包**，底下通常還是透過 socket 溝通，只是一層包一層。

把參數打包叫 **parameter marshalling**。跨電腦不簡單：
- 有的機器 **big endian**、有的 **little endian**，數字的 byte 排法不同。
- int 在有的電腦是 16 bit、有的是 32 bit，直接 copy bytes 過去可能讀出錯的值。

marshalling 時就把這些轉換處理好。另一個麻煩是 **pointer**：pointer 指的是 local memory，傳到別台電腦沒有意義；要有意義就得把指到的內容全 copy 過去。大小確定的 data structure 可以 copy，pointer 多半不支援。

## 溝通方式總整理
| 情境 | 用什麼 |
|---|---|
| 平行程式 | shared memory、message passing |
| 網路 | socket：IP + port 建連線、互傳 bytes |
| 分散式系統 | RPC：呼叫遠端 function，就像呼叫本地的一樣 |

## 重點整理
- Program 是 disk 上的 passive entity；process 是在 memory 裡執行的 active entity。
- Process memory：text（程式碼）、data（global）、heap（malloc，往上長）、stack（local，往下長）。
- 五狀態：new → ready → running → terminated；running → waiting（I/O、sleep、wait）→ ready；running → ready（interrupt／timer）。scheduler 只從 ready queue 選。
- PCB：pointer、state、PC、registers、scheduling、memory（base／limit）、I/O、accounting；存在 kernel space；queue 串的是 PCB。
- Context switch：存舊 process 的 state 到它的 PCB、從新 process 的 PCB load；期間兩者都 idle，是 overhead；加速靠快 memory、特殊指令、多組 register set。
- Thread 共用 code、data、heap、OS resource（例如 open 的 file）；各自有 thread ID、PC、registers、stack。
- Long-term：disk → memory，控制 degree of multiprogramming、CPU／I/O mix，頻率低（現代淡化）。Short-term：memory → CPU，頻率非常高（至少約每 100 ms 一次），要快（演算法 10 ms／每 100 ms = 10% overhead）。Mid-term：swap out／in，避免 thrashing、改善 mix。
- Degree 太低 CPU idle；太高 thrashing。
- fork：duplicate、concurrent；child 回傳 0，parent 拿到 child PID。exec：換內容、PID 不變、不建新 process。wait：parent 等 child。
- n 個 fork → 2ⁿ 個 process。
- Copy-on-write：先共用，有人寫才 copy。
- Termination：exit 釋放資源；parent 用 abort kill child；cascading termination；Ctrl-C 送 SIGINT。
- IPC 目的：information sharing、speedup、convenience、modularity。
- Shared memory 快但要自己同步；message passing 慢但自帶同步、能跨電腦。
- Bounded buffer：empty `in == out`；full `(in + 1) % BUFFER_SIZE == out`；最多放 BUFFER_SIZE − 1 個。
- Direct：指定 process、自動建 link、one-to-one。Indirect：mailbox（port）、programmer 建立、many-to-many。
- Blocking = synchronous；non-blocking = asynchronous；差別在 buffer（0/1、bounded、unbounded）。
- Socket = IP + port，傳 unstructured bytes；server：socket → bind → listen → accept。
- RPC：stub（client）／skeleton（server）做 parameter marshalling（endian、int 大小）；pointer 不能直接傳。

## 名詞對照
| 中文 | English |
|---|---|
| 程式 | program |
| 行程 | process |
| 位址空間 | address space |
| 程式碼區段 | code segment / text section |
| 資料區段 | data section |
| 堆疊 | stack |
| 堆積 | heap |
| 記憶體洩漏 | memory leak |
| 程式計數器 | program counter (PC) |
| 行程控制區塊 | process control block (PCB) |
| 新建／就緒／執行／等待／終止 | new / ready / running / waiting / terminated |
| 允許進入 | admit |
| 分派 | dispatch |
| 內容切換 | context switch |
| 額外負擔 | overhead |
| 執行緒 | thread |
| 輕量級行程 | lightweight process |
| 排程器 | scheduler |
| 長期／短期／中期排程器 | long-term / short-term / medium-term scheduler |
| 就緒佇列 | ready queue |
| 裝置佇列 | device queue |
| 多元程式的程度 | degree of multiprogramming |
| CPU 密集／I/O 密集 | CPU-bound / I/O-bound |
| 置換 | swapping (swap in / swap out) |
| 輾轉現象 | thrashing |
| 行程識別碼 | process identifier (PID) |
| 父行程／子行程 | parent process / child process |
| 寫入時複製 | copy-on-write |
| 連鎖終止 | cascading termination |
| 行程間通訊 | interprocess communication (IPC) |
| 獨立行程／合作行程 | independent process / cooperating process |
| 共享記憶體 | shared memory |
| 訊息傳遞 | message passing |
| 生產者–消費者問題 | producer–consumer problem |
| 有界緩衝區 | bounded buffer |
| 環狀緩衝區 | circular buffer |
| 忙碌等待 | busy waiting |
| 直接／間接通訊 | direct / indirect communication |
| 信箱 | mailbox |
| 阻塞／非阻塞 | blocking / non-blocking |
| 同步／非同步 | synchronous / asynchronous |
| 通訊端 | socket |
| 遠端程序呼叫 | remote procedure call (RPC) |
| 參數封送 | parameter marshalling |
