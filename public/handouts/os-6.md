# 死鎖 Deadlock

上一章用 lock 保護 critical section，可是鎖用不好就出事：P1 拿著一把鎖在等 P2 的鎖，P2 拿著另一把在等 P1 的，兩邊都等對方先放手，誰也動不了，這就是 deadlock（死結）。這一章先把 deadlock 定義清楚（四個必要條件、resource-allocation graph），再看四種處理方式：prevention（事先拆掉一個條件）、avoidance（執行中每次分配前先檢查，Banker's algorithm）、detection 加 recovery（發生了再處理），以及乾脆 ignore。考試必考四個條件、看 RAG 判斷有沒有 deadlock，以及 Banker's algorithm 的手算。

## 學完這章要會
- 寫出 deadlock 的定義，用例子（單線橋、tape drive、semaphore、十字路口）說明
- 說出四個必要條件，知道「四個同時成立才可能 deadlock、缺一個就不會」
- 畫 resource-allocation graph，判斷有沒有 deadlock；知道「有 cycle」什麼時候一定 deadlock、什麼時候不一定
- 分辨 prevention、avoidance、detection／recovery、ignore
- 說明拿掉每一個條件的作法與代價（尤其 total order 拿掉 circular wait 的證明）
- 用 claim edge 做 single instance 的 avoidance
- 分辨 safe、unsafe、deadlock；找 safe sequence
- 手算 Banker's algorithm：Available、Need、safety algorithm、resource-request algorithm
- 用 wait-for graph 和 detection algorithm 偵測 deadlock；說明 recovery 的選擇

## 什麼是 deadlock

### 定義
**Deadlock**：一組 process 裡，每個 process 都在等一個事件（例如有人放掉資源），而這個事件只有組內另一個 process 能觸發。偏偏組內每個人都在等，沒有人會去觸發。說穿了，它們在等一件**永遠不會發生的事**。

> **比喻** 單線橋一次只能過一台車。兩邊各開來一台，在橋中間碰頭了。只要有一台願意倒車，另一台就過得去；兩台都不退，就永遠卡在橋上。橋是一個資源，兩台車是兩個都想要它的 process。

### Hold 著資源又在等
process 執行時要用 resource。這個詞很抽象：可以是一段程式、一塊 memory，甚至 CPU 核心的執行時段。總之要先佔有它才能繼續跑。資源有限，P1 先拿到 R1，別人想要就只能等。

麻煩的是程式常常要好幾種資源。P1 拿到 R1、P2 拿到 R2，兩個人各握一部分，又都在等對方手上那份。這就是 deadlock 的核心：**hold 住一個資源，同時 wait 另一個；等不到又不肯放手，就永遠卡住**。

> **例題** 兩台 tape drive，一次只能給一個程式用，而程式要同時寫兩台才做得完。剛好兩個 process 各搶到一台，又都在等另一台。誰都不退讓，整個系統就像停住一樣。

> **例題** 上一章的 semaphore：A、B 初值都是 1，左邊程式先 `wait(A)` 再 `wait(B)`，右邊程式順序反過來，先 `wait(B)` 再 `wait(A)`。兩邊都先拿到第一個時，左邊握 A 等 B、右邊握 B 等 A，兩個都要齊才放手，就 deadlock 了。

> **例題** 兩個 process P1、P2，兩個資源 R1、R2（各一個），P1、P2 都要同時拿到 R1 和 R2 才做得完。
> 1. time 0：R1 空著，配給 P1（R1 → P1）；R2 也空著，配給 P2（R2 → P2）。
> 2. P1 還缺 R2，對 R2 發 request（P1 → R2）；P2 還缺 R1，也發 request（P2 → R1）。
> 3. P1 拿不到 R2 就不放 R1，P2 拿不到 R1 也不放 R2。箭頭繞成一圈：P1 等 P2 放掉 R2，P2 等 P1 放掉 R1，完全符合定義。

結論：只要程式要同時拿好幾個資源，而它們又被別人拿走，就有可能 deadlock。

## 四個必要條件
deadlock 發生時，下面四個條件**同時成立**。它們是 **necessary condition（必要條件）**：四個都成立才「可能」deadlock；反過來，**少一個就保證不會**。

1. **Mutual exclusion（互斥）**：一個資源一次只能給一個人用，不能用 shared mode 共用。如果資源可以 share，大家同時用，根本不用排隊，當然不會 deadlock。但這個條件很常成立，因為解 critical section 本來就要求一次只有一個人進去。
2. **Hold and wait（持有並等待）**：手上至少握著一個資源，同時還在等另一個，而且不放手。如果規定拿不到就把手上的全部放掉、重新來過，沒有人邊握邊等，就不會 deadlock。
3. **No preemption（不可搶奪）**：資源只能由拿著它的人自願放掉，別人不能逼它交出來。如果可以 preempt（例如直接把程式 kill 掉），你等的人就會被逼著讓出資源。可是很多資源搶不了：印表機印到一半，不能叫它先停、等一下再接著印，狀態記不下來（或 resume 代價太大）。
4. **Circular wait（循環等待）**：存在一組 P0、P1、…、Pn，P0 等 P1、P1 等 P2、…、Pn 又回頭等 P0，繞成一圈。如果只是單向排隊（最後一個沒在等第一個），最後一個做完放手，前面就依序解開，只是等久一點，不叫 deadlock。

> **陷阱** 四個條件都成立不保證一定 deadlock（例如有 cycle 但資源有多個 instance，見後面的 RAG）；但只要破壞其中一個，就保證不會 deadlock。另外 circular wait 其實隱含了 hold and wait，四個條件不是完全獨立的。

> **比喻** 十字路口四個方向的車剛好全擠進路口，沒有一台動得了。
> - **Mutual exclusion**：把路口切成四格，每格是一個資源，一格只能停一台車，不然就撞了。
> - **Hold and wait**：每台車佔住自己這格，同時在等前面那格空出來。這就是路口要畫黃線、不准停在裡面的原因：一停下來就是 hold and wait。
> - **No preemption**：一般車不能叫前車讓開，只有消防車、救護車這種有特權的才能搶路權。
> - **Circular wait**：四台車你等我、我等他繞成一圈；只要有一格沒被佔住，大家最後都能慢慢通過。
>
> 電腦裡也一樣，路口那幾格換成 lock、共用的 memory 或實體設備，就是程式在搶的東西。麻煩的是，這四個條件都是電腦運作常常需要的。

## System model 與 resource-allocation graph

### Resource type、instance 與 request、use、release
要用演算法處理 deadlock，得先把問題寫成模型：

- **Resource type**：資源的種類。CPU 是一種，memory 是一種，device、lock 也各是一種。
- **Instance**：每種 type 底下的實際個數，例如 CPU 有 4 個 core、硬碟有 2 顆。就像 counting semaphore，代表的是一個數量，不一定只有 0 或 1。
- 一個程式就能描述成：要哪些種類的資源、每種要幾個 instance。
- 使用資源的過程一直重複三步：**request（申請）→ use（使用）→ release（放掉）**。use 的期間資源被這個 process 佔住，別人不能用，process 之間就有了誰等誰的 dependency。

### Resource-allocation graph（RAG）
誰等誰的關係畫成 graph 最清楚。**Resource-allocation graph** G = (V, E) 描述系統現在的狀態：

- vertex 有兩種：**process** 畫成圓圈；**resource** 畫成方塊，方塊裡每個點是一個 instance。
- edge 有兩種：
  - **Request edge**：P → R，process 想要這個資源、還沒拿到、正在等（就像等一把 lock 才能進 critical section）。
  - **Assignment edge**：R → P，這個 instance 已經配給 process、正在用。
- 顏色不重要，**方向才重要**：P 指向 R 是在等，R 指向 P 是已經拿到。

> **例題** 三個 process、四種資源：R1、R3 各 1 個 instance，R2 有 2 個，R4 有 3 個。
> ```
> Request edge:     P1 → R1      P2 → R3
> Assignment edge:  R1 → P2      R2 → P1      R2 → P2      R3 → P3
>
>         (P1) ─────→ [R1 ●] ─────→ (P2) ─────→ [R3 ●] ─────→ (P3)
>          ↑                         ↑
>          └──────── [R2 ● ●] ───────┘
>                    [R4 ● ● ●]   （沒人用）
> ```
> 從圖上直接看得到 hold and wait：P1 握著一個 R2，又在等 R1。也能沿著箭頭找有沒有繞成一圈（circular wait）。

之後就用這張圖判斷兩件事：現在是不是已經 deadlock？答應某個 request 以後會不會有危險？

### 讀圖判斷 deadlock
> **例題** 上面那張圖有沒有 deadlock？P1 要 R1，可是 R1 在 P2 手上；R2 的兩個 instance，一個在 P1、一個在 P2；P2 要 R3，R3 在 P3 手上。
> 1. P3 沒在要別的資源，靠手上的 R3 就能做完，做完放掉 R3。
> 2. R3 空出來，P2 的 request 變成配置，P2 也能跑完，放掉 R1、R2、R3。
> 3. P1 只差 R1，現在拿到了，也能做完。
>
> 沿著箭頭也找不到任何一圈。**沒有 deadlock**。

> **例題** 同一張圖只改一個地方：P3 也來 request R2（多一條 P3 → R2）。
> 1. R2 的兩個 instance 在 P1、P2 手上，沒有空的，P3 得等 P1 或 P2 先做完。
> 2. P2 要 R3，R3 在 P3 手上，P2 做不完。
> 3. P1 要 R1，R1 在 P2 手上，而 P2 又卡在 P3 後面。
>
> 每個人都在等另一個人，**deadlock**。這張圖有兩個 cycle：
> ```
> P1 → R1 → P2 → R3 → P3 → R2 → P1
> P2 → R3 → P3 → R2 → P2
> ```
> R2 雖然有兩個 instance，但兩個都在圈裡的人手上，沒得繞過去，所以真的卡死。

> **例題** 有 cycle 卻沒有 deadlock：R1、R2 各有 2 個 instance。
> ```
> P1 → R1      R1 → P2      R1 → P3
> P3 → R2      R2 → P1      R2 → P4
> ```
> 圖上有一圈 P1 → R1 → P3 → R2 → P1。但 P2 沒在等任何人，一定做得完，做完放掉一個 R1，P1 拿到 R1 也能做完；P3 要的 R2 在 P1 或 P4 手上，而 P4 沒被任何人擋住，做完就會放出一個 R2。所以雖然有一圈，**沒有 deadlock**。把 R1、R2 改成只有一個 instance，就鐵定卡死。

> **重點**
> - 圖上**沒有 cycle** → 一定沒有 deadlock（少了 circular wait）。
> - 有 cycle、而且**每種資源都只有一個 instance** → 一定 deadlock（你要的那一個一定被圈裡的人拿著）。
> - 有 cycle、但資源有**多個 instance** → 只是**可能** deadlock，要再仔細判斷。

> **陷阱** 「有 cycle 一定 deadlock」只在 single instance 時成立；multiple instance 時 cycle 只是必要條件。

## 處理 deadlock 的四種方式
1. **Deadlock prevention**：事先把四個條件拿掉一個。不管程式怎麼寫，都絕對不會 deadlock（never enter deadlock）。
2. **Deadlock avoidance**：run time 一直盯著資源怎麼分配，每次分配前判斷「現在把這個資源給它安不安全」，避開危險。
3. **Detection + recovery**：先不管，讓系統跑，等 deadlock 真的發生了再處理。要解兩件事：偵測到已經 deadlock，以及怎麼恢復（例如 kill 哪個 process 影響最小）。
4. **Ignore**：系統什麼都不做，卡住就卡住。為什麼有人選它？detection 和 avoidance 要一直檢查系統，很耗 CPU，會讓系統變慢；deadlock 本來就不常發生，真的發生了，就讓使用者自己按 Ctrl+Alt+Delete 重開機。大部分一般的商用系統就是這樣。但武器控制、核電廠這種重要系統不能叫人 reboot，就得用前面的方法。

> **陷阱** prevention 和 avoidance 常被搞混：prevention 是**事前**把條件拆掉（規則層面讓它不可能發生）；avoidance 是**執行中**每次分配前先檢查，避開危險。detection 又是另一件事：**事後**找出已經發生的 deadlock。

## Deadlock prevention
不用在執行中一直檢查，而是一開始就讓系統不可能 deadlock：四個條件一個一個拿出來，看怎麼讓它不成立。

### 拿掉 mutual exclusion
就是把 synchronization 用的 lock 抽掉。某些地方真的可行：memory 的資料如果大家都只讀不寫（read-only），同時讀也不會錯，根本不用鎖。可是不是每種資源都能這樣，印表機、critical section 本質上一次只能一個人用，一定要互斥。所以實際作法是**先把資源分類，本來就能共用的就別上鎖**，這些資源就不會造成 deadlock。

### 拿掉 hold and wait
改寫法：要用好幾個資源，就**一次全部拿到才往下做**（另一種講法：process 開始執行前，就先一次申請好它要的全部資源）。只要有一個拿不到（例如 R2 被人用著），就把已經拿到的全部放掉，從頭再來。這樣沒人會握著一個在等。本質是 **all or nothing**。

缺點：

- **資源使用率很低**，因為要同時全部拿到的機會小很多。
- 很多 process 一直拿、放、拿、放，始終跑不起來，資源又常常閒著，整台電腦效能變差。
- 一直湊不齊資源的 process 可能 **starvation**。

> **例題** （示意）每個資源拿到的機率是 1/2，三個同時拿到就是 1/2 × 1/2 × 1/2 = 1/8，機率是相乘的。

所以像 CPU 這麼重要的資源不適合，使用率太低會嚴重拖慢執行；有些 I/O device 本來就很慢，用這招影響不大，可以考慮。

### 拿掉 no preemption（允許 preemption）
允許 preemption 的前提是**能把這個資源目前的 state 記下來**。記得下來，就能隨時喊停、先讓別人用，用完再還你，你從剛剛停的地方接著做。

- **CPU** 就是標準例子，這正是 CPU 有 context switch 的原因。CPU 能被搶，使用率就很高；比較重要的 process 一來，馬上可以把 CPU 讓給它。
- 代價是要存這些 state：多用一些 memory、register（像 PC、SP）。
- 不是每種資源都能搶：印表機印到一半，狀態沒辦法記錄，不能說停就停。這招適合 CPU、memory 這種狀態存得下來的資源，很多 I/O device 做不到。

### 拿掉 circular wait（total order）
把所有資源排成一個 **total order**：每個資源一個編號，誰先誰後很清楚，分配規則只准一個方向。

會繞成圈，是因為等待方向最後繞回來了：最後面的人在等最前面的人。如果規則只准一個方向，這條「繞回來的邊」就不存在，圈就斷了。

**規則**：資源編號 R0、R1、R2、…，process 要 Rk 時，手上所有編號比 k 大的都要先放掉。等價的寫法：只能照編號遞增的順序 request；要 Rj 時，手上不能有編號大於等於 j 的資源。

> **例題** P 已經有 R0 和 R5，現在想要 R3。要照順序，得先拿 R3 才輪到 R5，所以 R5 要先還回去，拿到 R3 再拿 R5。更極端：手上什麼都有了卻要 R0，那就全部放掉，從 R0 開始一步一步重拿。

> **例題** tape drive 編號 1、disk 編號 5、printer 編號 12。三個都要，就得照 1、5、12 的順序拿。

**為什麼這樣保證沒有圈？** 一個等待圈一定是一串 hold and wait 接起來的：P0 拿著某個資源在等 P1 手上的、P1 拿著更大編號的在等 P2 手上的……照規則，每個人等的資源編號都比自己手上的大，沿著圈編號一路變大。要繞回原點變成圈，最後一定有一條：某個 process 拿著編號很大的 Rn，卻在要編號小的 R0。但拿著高編號、去要低編號，正是規則禁止的，這條根本不會出現，所以圈不可能形成。

缺點有點像 hold and wait：越後面的資源越難拿到，因為前面的要先拿齊，等比較久。不規定順序的話，也許 R5 剛好先空出來，運氣好反而更快，但也就有了 deadlock 的危險。

### 系統裡的實例：memory 與 CPU
- **Memory**：系統讓大家共用存取，像 multi-thread 程式的 global memory，所有 thread 都能同時讀寫。以系統角度，memory 等於**拿掉了 mutual exclusion**，所以光是 access memory 不會 deadlock。上一章的 deadlock，是 programmer 為了解 race condition 自己在程式裡加鎖造成的。
- **CPU**：不能共用，兩個 instruction 不可能混在同一條 pipeline 裡一起跑。CPU 不能共用又不想 deadlock，OS 就讓它可以被搶：context switch 把 register 存到 memory，隨時換人用，等於**允許 preemption**。

剛好是兩個相反的例子，所以這兩個資源本身不會造成 deadlock。至於 programmer 自己加的 critical section，就得 programmer 自己負責。

## Deadlock avoidance

### 考慮 worst case
avoidance 假設四個條件都可能成立，系統在執行中根據目前狀態，及時避開 deadlock。deadlock 都是程式做了某個資源動作（例如申請資源 R）之後才發生的。要事先避免，就得考慮 **worst case**：假設未來最糟的事都發生，會不會 deadlock？只有最壞情況也不會出事，系統才答應這次分配，這樣不管別人之後做什麼都安全。

分兩種情況，概念一樣：

- 每種資源只有一個 instance：用 RAG 加 claim edge 找圈。
- 有多個 instance：用 Banker's algorithm。

### Single instance：claim edge
request edge 和 assignment edge 都是已經發生的事，可是 worst case 要求系統也考慮未來。所以多加一種邊：**claim edge**，畫成**虛線**，方向跟 request edge 一樣是 P ⇢ R，表示「P 未來**可能**會要 R」（系統事先知道，例如 trace 程式碼得知）。

- 最壞情況下它真的發生了：P 真的提出要求，虛線就變成實線的 request edge。邊越多越容易繞成圈，把未來可能的事都當成會發生，這就是 worst case。
- 但 claim 變 request 時箭頭方向沒變，所以這一步還不危險。真正要小心的是下一步：**資源給出去、箭頭翻過來（R → P）的那一刻**。
- 系統要決定給不給：給的話邊翻成 assignment edge；不同意就維持 request，P 先等著。系統有權做這個決定。

> **例題** 目前狀態：R1 給了 P1（R1 → P1），P2 在等 R1（P2 → R1）；claim edge：P1 ⇢ R2、P2 ⇢ R2。R2 現在沒人在用。
> ```
> Assignment edge:  R1 → P1
> Request edge:     P2 → R1
> Claim edge:       P1 ⇢ R2      P2 ⇢ R2      （⇢ 表示虛線）
> ```
> - **P1 要 R2**：假設給它，邊變成 R2 → P1。圖上 P1 拿著 R1、R2，P2 等 R1、claim R2，沒有圈，**可以給**。
> - **P2 要 R2**：假設給它，邊變成 R2 → P2。這時 P1 ⇢ R2 → P2 → R1 → P1，繞成一圈。雖然 P1 ⇢ R2 現在還只是 claim，但最壞情況下它下一秒就可能成真，到時就真的 deadlock。所以**不答應**，P2 維持 request 先等。

> **重點** 就算資源現在空著，avoidance 也可以擋，這是它跟一般配置最大的不同。這個決定取決於目前狀態：如果 P1 根本沒拿著 R1，那把 R2 給 P2 也不會有圈。

**演算法**：

1. 畫上所有 claim edge。
2. claim 變成 request 時，先假設翻成 assignment edge。
3. 跑一次 cycle detection。
4. 有圈就維持 request，讓它等，等狀態改變、同意也不會有圈，才真的分配；沒有圈才答應。

**代價**：系統拆開來看，資源種類比想像多很多，process 也常常幾千個，n 不會小；跑一次找圈，最好的演算法也要 n² 等級，很花時間。除非真的很怕 deadlock，系統不一定願意付這個代價。

### Safe、unsafe 與 deadlock
多個 instance 不好畫圖，改用 **Banker's algorithm（銀行家演算法）**，計算量大約也是 n²。把系統所有可能的狀態分成兩區：

- **Safe state**：絕對不可能發生 deadlock。
- **Unsafe state**：最壞情況下**有可能** deadlock。真正的 deadlock 只是 unsafe 裡面的一小塊。

```
全部可能的狀態
┌───────────────────┬──────────────────────────┐
│                   │  unsafe                  │
│      safe         │     ┌──────────────┐     │
│                   │     │   deadlock   │     │
│                   │     └──────────────┘     │
└───────────────────┴──────────────────────────┘
```

avoidance 就是讓系統一直待在 safe 區，任何會把系統推進 unsafe 的動作都擋掉。

**怎麼判斷 safe？** 找一個順序，讓所有 process 照順序一個一個都能執行完（假設每個人都要到 Max）。找得到這個順序，叫 **safe sequence**，系統就是 safe；找不到，就是 unsafe。

> **陷阱** unsafe ≠ deadlock。unsafe 只代表 OS 沒辦法保證避開 deadlock、「可能」走到 deadlock；deadlock ⊂ unsafe。說「unsafe 就會 deadlock」是簡化說法。

> **例題** 一種資源：12 台 tape drive。三個 process：
> | Process | Max | 目前持有 | 還可能要（Max − 持有） |
> |---|---|---|---|
> | P0 | 10 | 5 | 5 |
> | P1 | 4 | 2 | 2 |
> | P2 | 9 | 2 | 7 |
>
> Max 是事先給定的（由 compiler 或 programmer 提供），是**某個時刻同時最多要幾台**，不是整個程式總共用幾台。P0 現在用 5 台，代表它下一秒可能再要 5 台。
>
> 已用 5 + 2 + 2 = 9 台，空著 12 − 9 = 3 台。最壞情況下一秒大家都要到 Max：
> 1. 空 3 台夠 P1（還要 2），先給它，它跑完把手上的 4 台全部還回來：3 − 2 + 4 = **5** 台。
> 2. 5 台夠 P0（還要 5），跑完還回 10 台：5 − 5 + 10 = **10** 台。
> 3. 10 台夠 P2（還要 7），跑完，12 台全部回來。
>
> 照 ⟨P1, P0, P2⟩ 大家都能做完，這個狀態是 **safe**，⟨P1, P0, P2⟩ 就是 safe sequence。

> **例題** 小改一下：P2 多拿一台，從 2 台變 3 台（還要 6 台）。現在用了 10 台，只剩 2 台。
> 1. 剩 2 台夠 P1（還要 2），做完還回 4 台：2 − 2 + 4 = **4** 台。
> 2. 只有 4 台，P0 還要 5、P2 還要 6，都不夠，卡住。
>
> 找不到 safe sequence，這個狀態是 **unsafe**。它現在 deadlock 了嗎？還沒有，要等最壞情況真的發生（大家真的要到 Max）才會卡死。avoidance 就是事前考慮最壞情況：答應之後會不會進入 unsafe？會的話就擋（所以「P2 再要 1 台」這個 request 在前一個例子的狀態下不該被答應）。

> **陷阱** process 做完時，加回空位的是它**目前拿著的數量**，不是 Max。

找順序時不用煩惱從誰開始，從上往下掃就好：每做完一個，空出來的只會變多，先選誰不影響找不找得到。

### Banker's algorithm
Banker's algorithm 是 **deadlock avoidance** 的演算法（考試常問它屬於 prevention 還是 avoidance：答案是 **avoidance**）。之所以算 avoidance，是因為要事先告訴 OS：有哪些 process、會要哪些資源、最多要多少（Max），OS 再根據這些資訊決定誰先執行、誰要先等。

資料結構（n 個 process、m 種資源）：

| 名稱 | 意義 |
|---|---|
| Available | 每種資源目前還空著幾個 = Total − 所有 Allocation 加總 |
| Max | 每個 process 對每種資源最多需要幾個（事先給定、永遠不變） |
| Allocation | 每個 process 目前已經拿到幾個（會隨分配改變） |
| Need | 還可能要幾個 = Max − Allocation |

**Safety algorithm（判斷是不是 safe）**：

1. Work = Available；每個 process 的 Finish = false。
2. 找一個 Finish = false、而且 **Need ≤ Work（每一種資源都要）** 的 process。找不到就跳到第 4 步。
3. 假設它跑完、放出資源：**Work = Work + Allocation**，Finish = true，回到第 2 步。
4. 所有 Finish 都是 true → safe；否則 unsafe。

**Resource-request algorithm（Pi 送來 Request 時）**：

1. 檢查 Request ≤ Need；超過就是錯誤（要的比宣告的 Max 還多）。
2. 檢查 Request ≤ Available；不夠就只能等。
3. **假裝答應**（還沒真的給）：Available −= Request、Allocation[i] += Request、Need[i] −= Request。
4. 在這個假設狀態下跑 safety algorithm：safe 就真的答應；unsafe 就恢復原狀，讓 Pi 等（hold 住或拒絕）。

> **陷阱** 三個常見計算錯誤：
> - Available 是 Total 減 **Allocation** 的加總，不是減 Max，也不是減 Need。
> - Need = Max − Allocation 要 A 減 A、B 減 B、C 減 C，對錯欄是最常見的錯。
> - process 做完時 Work 加的是 **Allocation**，不是 Need。

## Banker's algorithm 手算

### 例題一：P1～P5
> **例題** 5 個 process P1～P5，3 種資源 A、B、C（可以想成 CPU、memory、printer），系統總共 A 10 個、B 5 個、C 7 個。
>
> | Process | Allocation (A,B,C) | Max (A,B,C) |
> |---|---|---|
> | P1 | (0, 1, 0) | (7, 5, 3) |
> | P2 | (2, 0, 0) | (3, 2, 2) |
> | P3 | (3, 0, 2) | (9, 0, 2) |
> | P4 | (2, 1, 1) | (4, 2, 2) |
> | P5 | (0, 0, 2) | (5, 3, 3) |
>
> 問：這個狀態會不會 deadlock？safe 的話寫出 safe sequence。

**第一步：Available。** 不是從時間 0 看，而是某個時間點，表上的 Allocation 都已經被拿走了。

- A 欄：0 + 2 + 3 + 2 + 0 = 7
- B 欄：1 + 0 + 0 + 1 + 0 = 2
- C 欄：0 + 0 + 2 + 1 + 2 = 5
- 已配出 (7, 2, 5)，Available = (10, 5, 7) − (7, 2, 5) = **(3, 3, 2)**

**第二步：Need = Max − Allocation。** 像小孩要 10 顆蘋果、你給了 3 顆，還要再給 7 顆。

| Process | Max | Allocation | Need |
|---|---|---|---|
| P1 | (7, 5, 3) | (0, 1, 0) | (7, 4, 3) |
| P2 | (3, 2, 2) | (2, 0, 0) | (1, 2, 2) |
| P3 | (9, 0, 2) | (3, 0, 2) | (6, 0, 0) |
| P4 | (4, 2, 2) | (2, 1, 1) | (2, 1, 1) |
| P5 | (5, 3, 3) | (0, 0, 2) | (5, 3, 1) |

**第三步：safety algorithm。** Work 從 (3, 3, 2) 開始，每一步只問：用目前的 Work，滿不滿足得了某個 process 剩下的 Need？

| 步驟 | 檢查 | Need ≤ Work？ | 做完後 Work |
|---|---|---|---|
| 1 | P1 (7,4,3) vs (3,3,2) | A、B、C 都不夠，跳過 | (3, 3, 2) |
| 2 | P2 (1,2,2) vs (3,3,2) | 可以 | (3,3,2) + (2,0,0) = (5, 3, 2) |
| 3 | P3 (6,0,0) vs (5,3,2) | A 要 6 只有 5，不行 | (5, 3, 2) |
| 4 | P4 (2,1,1) vs (5,3,2) | 可以 | (5,3,2) + (2,1,1) = (7, 4, 3) |
| 5 | P5 (5,3,1) vs (7,4,3) | 可以 | (7,4,3) + (0,0,2) = (7, 4, 5) |
| 6 | P1 (7,4,3) vs (7,4,5) | 可以 | (7,4,5) + (0,1,0) = (7, 5, 5) |
| 7 | P3 (6,0,0) vs (7,5,5) | 可以 | (7,5,5) + (3,0,2) = (10, 5, 7) |

- 第一輪看 P3 時，B、C 都不用，看起來好像行，但 A 要 6 只有 3，還是不行。**三種資源必須同時都夠**，不能只給一部分：假設 P2 的 A 不是 1 而是 4，就算 B、C 夠也不行。
- 最後 Work 剛好等於總數 (10, 5, 7)，所有資源都回來了，這是很好的驗算。
- 結論：**safe**，safe sequence 是 ⟨P2, P4, P5, P1, P3⟩。

> **重點** safe sequence 不唯一。做完 P2、P4 時 Work 是 (7, 4, 3)，P3 的 (6, 0, 0) 也夠，所以 ⟨P2, P4, P3, P5, P1⟩ 也行。考題可能直接給一個順序，問它是不是 safe sequence，那就照順序一步步驗算。什麼時候 unsafe？只有在某一步，**任何一個** process 都滿足不了的時候；只要有一個可以，就能往下排。

### 例題二：P0～P4 與兩個 request
> **例題** 同樣 A、B、C 總量 (10, 5, 7)，process 編號 P0～P4。Allocation 跟例題一一樣（只是編號往前移），但 P3、P4 的 Max 不同，別混用。
>
> | Process | Allocation | Max | Need |
> |---|---|---|---|
> | P0 | (0, 1, 0) | (7, 5, 3) | (7, 4, 3) |
> | P1 | (2, 0, 0) | (3, 2, 2) | (1, 2, 2) |
> | P2 | (3, 0, 2) | (9, 0, 2) | (6, 0, 0) |
> | P3 | (2, 1, 1) | (2, 2, 2) | (0, 1, 1) |
> | P4 | (0, 0, 2) | (4, 3, 3) | (4, 3, 1) |
>
> Available = (10, 5, 7) − (7, 2, 5) = (3, 3, 2)。

**原狀態是不是 safe？** 從上往下掃，A、B、C 三欄要同時都夠。P0 要 (7, 4, 3)，三欄都不夠，就算全給它也做不完。P1 的 (1, 2, 2)、P3 的 (0, 1, 1) 都夠，先給誰都可以。

| 順序 | Need | 做完後 Work |
|---|---|---|
| 起始 | - | (3, 3, 2) |
| P1 | (1, 2, 2) | + (2,0,0) = (5, 3, 2) |
| P3 | (0, 1, 1) | + (2,1,1) = (7, 4, 3) |
| P4 | (4, 3, 1) | + (0,0,2) = (7, 4, 5) |
| P2 | (6, 0, 0) | + (3,0,2) = (10, 4, 7) |
| P0 | (7, 4, 3) | + (0,1,0) = (10, 5, 7) |

⟨P1, P3, P4, P2, P0⟩ 全部做完，是 safe state，最後 Work 也回到總量。

**Request 一：P1 再要 (1, 0, 2)**（例如它要 malloc、建立物件），OS 要決定答不答應。

1. Request (1, 0, 2) ≤ Need[P1] (1, 2, 2) ✓；≤ Available (3, 3, 2) ✓。
2. 假設答應（還不是真的給）：Allocation[P1] (2, 0, 0) → **(3, 0, 2)**；Need[P1] → **(0, 2, 0)**；Available → **(2, 3, 0)**。
3. 在假設狀態下跑 safety：

| 順序 | Need | 做完後 Work |
|---|---|---|
| 起始 | - | (2, 3, 0) |
| P1 | (0, 2, 0) | + (3,0,2) = (5, 3, 2) |
| P3 | (0, 1, 1) | + (2,1,1) = (7, 4, 3) |
| P4 | (4, 3, 1) | + (0,0,2) = (7, 4, 5) |
| P0 | (7, 4, 3) | + (0,1,0) = (7, 5, 5) |
| P2 | (6, 0, 0) | + (3,0,2) = (10, 5, 7) |

找得到 safe sequence ⟨P1, P3, P4, P0, P2⟩，**可以答應**。答應後不管未來發生什麼，都還有解。

**Request 二：P4 要 (3, 3, 0)**，一樣從**原本的狀態**出發（剛才 P1 那個 request 並沒有發生）。

1. Request (3, 3, 0) ≤ Need[P4] (4, 3, 1) ✓；≤ Available (3, 3, 2) ✓。
2. 假設答應：Allocation[P4] (0, 0, 2) → **(3, 3, 2)**；Need[P4] → **(1, 0, 1)**；Available → (3, 3, 2) − (3, 3, 0) = **(0, 0, 2)**。
3. Work = (0, 0, 2)，看每個 Need：P0 (7, 4, 3)、P1 (1, 2, 2)、P2 (6, 0, 0)、P3 (0, 1, 1)、P4 (1, 0, 1)，每個都至少有一欄比 Work 大，**找不到 safe sequence**。

所以系統把這次分配先 hold 住，甚至直接拒絕，這樣就不會進 unsafe state。

> **陷阱** P4 這個 request 沒超過 Need，也沒超過 Available，資源明明「夠」，還是不能給：給了會進 unsafe。avoidance 會拒絕資源有空的 request。

> **重點** Banker's 的流程：每個 request 先改 Allocation 假設它發生，跑一遍 safety；會進 unsafe 就等，保持 safe 才答應。Max 永遠不變，它是程式最壞情況的需求，是事先給定的；Allocation 才記錄目前狀態，會隨分配改變，我們檢查的就是改變之後會不會出問題。

### Banker's 的限制
avoidance 需要事先把資訊交給系統：幾個 process、幾種資源、每個最多要多少。可是現實中 process 很少事先說出固定的需求，需求是動態的，執行中會增減，所以很難真的照這樣實作。不過它是很重要的理論基礎，考試也常考，要仔細算。

> **陷阱** Banker's 是 avoidance，**不是** detection。deadlock detection 是另一個演算法：比的是目前的 Request，不用 Max，用在 deadlock 已經發生之後。把 Banker's 叫做 detection algorithm 是錯的。

## Deadlock detection
會做 avoidance，就能拿同一套演算法來做 detection。差別是 detection **不管未來**：沒有 claim edge、也不用 Max，只看現在；它也不用決定給不給，所以更簡單。

### Single instance：wait-for graph
每種資源只有一個 instance 時，回到圖：系統狀態一改變就記下來，畫出目前的 request edge 和 assignment edge（不畫 claim edge），然後跑找圈的演算法。single instance 有圈就是 deadlock。

可以再簡化：把資源節點拿掉，直接畫「Pi 在等 Pj 放掉資源」的箭頭 Pi → Pj，叫 **wait-for graph**。拿掉資源不影響結果，一樣找圈，找到就偵測到 deadlock。

> **例題** RAG 上有 P1 → R1 → P2 → R2 → P3 → R3 → P1 一圈（每種資源一個 instance），化成 wait-for graph 就是 P1 → P2 → P3 → P1，有圈，deadlock。

> **陷阱** wait-for graph 只適用 single instance。

### Multiple instance：detection algorithm
每種資源有多個 instance 時，跑跟 safety algorithm 一樣的找順序演算法，但只要兩張表：**Allocation** 和 **Request**（目前真的在要的量），**不需要 Max**。為什麼？Need 是假設最多會要多少；Request 是事實，現在就是要這麼多才能跑。

1. Work = Available；Allocation 是 0 的 process 可直接設 Finish = true，其他 Finish = false。
2. 找 Finish = false 而且 **Request ≤ Work** 的 process；找不到就跳到第 4 步。
3. 假設它做得完：Work = Work + Allocation，Finish = true，回到第 2 步。
4. 跑完 Finish 還是 false 的 process，就是**已經 deadlock** 的 process。

> **例題** A、B、C 總共 (7, 2, 6) 個，全配出去了，Available = (0, 0, 0)。
>
> | Process | Allocation | Request |
> |---|---|---|
> | P0 | (0, 1, 0) | (0, 0, 0) |
> | P1 | (2, 0, 0) | (2, 0, 2) |
> | P2 | (3, 0, 3) | (0, 0, 0) |
> | P3 | (2, 1, 1) | (1, 0, 0) |
> | P4 | (0, 0, 2) | (0, 0, 2) |
>
> 例如 P1 已經卡在那裡，它要 2 個 A、2 個 C 才能跑。
>
> | 順序 | Request ≤ Work？ | 做完後 Work |
> |---|---|---|
> | 起始 | - | (0, 0, 0) |
> | P0 | (0,0,0) 可以 | + (0,1,0) = (0, 1, 0) |
> | P1 | (2,0,2) 不夠，先等 | (0, 1, 0) |
> | P2 | (0,0,0) 可以 | + (3,0,3) = (3, 1, 3) |
> | P3 | (1,0,0) 可以 | + (2,1,1) = (5, 2, 4) |
> | P4 | (0,0,2) 可以 | + (0,0,2) = (5, 2, 6) |
> | P1 | (2,0,2) 可以 | + (2,0,0) = (7, 2, 6) |
>
> 全部做得完，Finish 全是 true，順序 ⟨P0, P2, P3, P4, P1⟩，**目前沒有 deadlock**。

> **例題** 同一個例子，P2 又多要一個 C，Request 從 (0, 0, 0) 變 (0, 0, 1)。沒有 avoidance，程式要什麼系統就給（不夠就讓它等）。跑 detection：P0 做完，Work 是 (0, 1, 0)；P1 要 (2, 0, 2)、P2 要 (0, 0, 1)、P3 要 (1, 0, 0)、P4 要 (0, 0, 2)，都有一欄不夠。Finish 還是 false 的 **P1、P2、P3、P4 已經 deadlock**。

> **陷阱** 「multiple instance 找不到順序不一定 deadlock」說的是 avoidance 的 unsafe（用 Max 假設最壞情況）。detection algorithm 用的是**目前的 Request**，跑完還做不完的 process 就是已經 deadlock 了。

為什麼 OS 要算這些？卡住的是使用者程式，OS 自己還能跑；它得知道程式不動是不是 deadlock，才能處理。

## Recovery
偵測到之後，真正麻煩的是 recovery。假設 P1～P4 互相等成一圈，P5、P6 沒參與：

- **最暴力**：所有 process 全部 kill，等於 reboot。
- **好一點**：只 kill 圈裡的 P1～P4，P5、P6 不受影響。
- **更溫和**：one at a time，一次砍一個，再跑一次 detection 看解開了沒，不行再砍下一個。問題是先砍誰？也許砍 priority 最低的，但不一定解得開，因為它手上的資源可能很少；從低 priority 一路砍下去，最後砍掉的反而更多。怎麼做最好，需要很多使用者程式的資訊。
- 總之要選一個 **victim**。如果系統支援 **preemption 加 rollback**（例如定期做 checkpoint），被砍的可以回到之前的狀態，不必全部重來。還要看支援程度：能 partial rollback（退回剛好解開的地方），還是只能 total rollback（整個重來）。
- 會不會老是砍同一個？很可能，它就永遠跑不完，這叫 **starvation**。所以要把被 rollback 的次數算進 cost。

recovery 多半 case by case。實務上要嘛事先 avoid 或 prevent，要嘛乾脆 ignore，讓使用者自己處理。

## 重點整理
- deadlock：一組 process 都在等只有組內別人能觸發的事件
- 四個必要條件：mutual exclusion、hold and wait、no preemption、circular wait；同時成立才可能 deadlock，破壞一個就不會
- RAG：request edge P → R、assignment edge R → P；無 cycle 一定無 deadlock；single instance 有 cycle 一定 deadlock；multiple instance 有 cycle 不一定
- 四種處理：prevention（事前拆條件）、avoidance（執行中檢查）、detection + recovery（事後）、ignore（多數一般系統）
- 拿掉 mutual exclusion：能共用的（read-only）不上鎖；拿掉 hold and wait：all or nothing，使用率低、可能 starvation；允許 preemption：要能存 state，適合 CPU、memory；拿掉 circular wait：資源編號，只能遞增順序 request
- memory 等於拿掉互斥、CPU 等於允許搶，兩者本身不造成 deadlock
- single instance avoidance：claim edge（虛線 P ⇢ R），假設翻成 assignment 後有圈就不給
- safe 與 unsafe 互補；deadlock ⊂ unsafe，unsafe ≠ deadlock
- Available = Total − ΣAllocation；Need = Max − Allocation
- safety：Need ≤ Work（每一欄）才可做；做完 Work += Allocation；最後 Work 應回到 Total
- request：Request ≤ Need、≤ Available → 假裝分配 → safety → safe 才給
- safe sequence 不唯一；資源夠也可能因 unsafe 不給
- Banker's 是 avoidance，不是 detection；需要事先知道 Max，實務難用
- detection：single instance 用 wait-for graph 找圈；multiple instance 用 Allocation + Request（不用 Max），跑完 Finish = false 者即 deadlocked
- recovery：kill 全部／圈內／一次一個；選 victim、rollback（checkpoint）；被 rollback 次數算進 cost 避免 starvation

## 名詞對照
| 中文 | English |
|---|---|
| 死結 | deadlock |
| 必要條件 | necessary condition |
| 互斥 | mutual exclusion |
| 持有並等待 | hold and wait |
| 不可搶奪 | no preemption |
| 循環等待 | circular wait |
| 資源種類／實例 | resource type / instance |
| 資源配置圖 | resource-allocation graph (RAG) |
| 請求邊／配置邊／宣告邊 | request edge / assignment edge / claim edge |
| 環 | cycle |
| 死結預防 | deadlock prevention |
| 死結避免 | deadlock avoidance |
| 死結偵測 | deadlock detection |
| 死結復原 | deadlock recovery |
| 全序 | total order |
| 安全狀態／不安全狀態 | safe state / unsafe state |
| 安全序列 | safe sequence |
| 銀行家演算法 | Banker's algorithm |
| 安全演算法 | safety algorithm |
| 資源請求演算法 | resource-request algorithm |
| 等待圖 | wait-for graph |
| 犧牲者 | victim |
| 回復 | rollback |
| 檢查點 | checkpoint |
| 飢餓 | starvation |
