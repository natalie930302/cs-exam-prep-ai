# 同步與互斥

好幾個 process 或 thread 共用同一份資料、又可能在任何一條指令中間被切走時，結果會跟執行順序有關，這就是 synchronization 問題。這一章先看問題怎麼發生（race condition），把它定義成 critical section problem 和它的三個條件，再一路看解法：software 的 Peterson's solution、Bakery algorithm，硬體的 TestAndSet、Swap，工具層的 mutex、condition variable、semaphore，最後是三個經典同步問題、monitor 和 atomic transaction。考試最常考三個條件的判斷、semaphore 的 trace 與寫法，以及經典問題的解法。

## 學完這章要會
- 說明 synchronization 問題的成因與兩個先決條件，用 counter++ 的指令交錯解釋 race condition
- 寫出 critical section 的架構（entry、critical、exit、remainder section），分辨 mutual exclusion、progress、bounded waiting
- 判斷一個 entry／exit 寫法滿足哪幾個條件（strict alternation、Peterson、Peterson 的錯誤改法）
- 證明 Peterson's solution 三個條件都成立
- 說明 Bakery algorithm 為什麼要 tie breaker 和 choosing
- 用 TestAndSet、Swap 寫 entry／exit，知道它們缺 bounded waiting
- 使用 Pthread 的 mutex、condition variable，解釋 cond_wait 為什麼要傳 mutex
- 分辨 binary 與 counting semaphore，寫出 busy waiting 與 non-busy waiting 兩種實作並 trace
- 用 semaphore 控制執行順序、寫 data flow；看出 wait／signal 寫錯造成的 deadlock
- 寫出 bounded buffer、first readers-writers 的 semaphore 解法，說明 dining philosophers 為什麼會 deadlock
- 說明 monitor 的意義（只有一個 active thread），寫出 dining philosophers 的 monitor 解法
- 說明 atomic transaction、commit／rollback、log 與 checkpoint

## 誰會有同步問題

### Independent 與 cooperative process
從同步的角度，process 分兩種：

- **Independent process（獨立的）**：跟別人沒有任何依賴，它怎麼跑都不會影響其他人。
- **Cooperative process（合作的）**：要依賴別人、彼此互相協調，它的執行會影響別人。

同步問題**只發生在 cooperative process**：independent process 各用自己的 resource，不會打架；cooperative process 會共用 resource，問題就是從這裡來的。

> **比喻** 整個社區的人一起到社區劇場看電影：大家看同一個螢幕，有人想看 A、有人想看 B，一個人的選擇會影響別人，就要協調。在家看自己的電視，想看什麼就看什麼，不用跟誰商量。

### 問題的根源：共用資料被同時改
之前寫 shared memory 或 multi-thread 程式時就提過：好幾個 thread 共用一份資料，最大的麻煩就是同步。CPU scheduling 的 preemptive（可以中途把 CPU 搶走）比較好，但同樣會帶來同步問題。

問題的根源是一份 **shared data**。說穿了，data 就是某個記憶體位址裡存的內容。這份資料被兩個以上的 process 或 thread **concurrent（同時）讀寫**，就可能 **data inconsistency**：大家看到的值不一致。同一支程式有時跑出 A、有時跑出 B，programmer 根本沒辦法寫程式。原因是兩邊都在改它，先後順序一變，結果就跟著變。

解法就是讓它們 **cooperate**：確保每次執行的順序都一樣，值自然就一樣。控制執行順序是 programmer 的責任，能控制順序，就能解掉同步問題。

這一章的路線：critical section → hardware support → semaphore、monitor 等工具。

## Race condition

### 用 counter 把 buffer 用滿
回到 producer–consumer：producer 把東西放進共用的 buffer，consumer 從裡面拿。之前用 in、out 兩個 index 的解法沒有同步問題，但永遠要空一格，不然分不出滿還是空，等於浪費一格。

想把每一格都用滿，最直覺的作法：加一個兩邊都看得到的 **counter**，記錄 buffer 裡現在有幾個東西。producer 每放一個就 `counter++`，consumer 每拿一個就 `counter--`，看 counter 就知道滿還是空。

問題是：counter 本身也是一塊共用的記憶體，而且兩邊都要**改寫**它（一個加、一個減），counter 自己就有同步問題了。

### counter++ 被拆開之後
`counter++` 只是程式語言裡的一行，到了 CPU 會被拆成三個 instruction：

```
counter++ :                 counter-- :
  reg1 = counter              reg2 = counter
  reg1 = reg1 + 1             reg2 = reg2 - 1
  counter = reg1              counter = reg2
```

兩邊用的 register 各自分開（reg1、reg2），但 counter 那塊記憶體是共用的。preemptive scheduling 不保證三步一口氣做完。

> **例題** counter 原本是 5，producer 做一次 ++、consumer 做一次 --，答案應該是 5。看下面這個交錯：
> ```
> 步驟  誰在跑     指令                  reg1  reg2  counter(記憶體)
> T0   producer   reg1 = counter        5     -     5
> T1   producer   reg1 = reg1 + 1       6     -     5
>      ── context switch ──
> T2   consumer   reg2 = counter        6     5     5
> T3   consumer   reg2 = reg2 - 1       6     4     5
>      ── context switch ──
> T4   producer   counter = reg1        6     4     6
>      ── context switch ──
> T5   consumer   counter = reg2        6     4     4
> ```
> producer 讀了 5、加成 6，還沒寫回就被切走；consumer 讀到的還是 5，減成 4；producer 寫回 6，consumer 最後寫回 4，把 6 蓋掉。counter 從 5 變 6 又變 4，結果是 **4**。

> **例題** 換個順序：consumer 先讀 5、減成 4；producer 再讀 5、加成 6；consumer 先寫回 4，producer 最後寫回 6。最後寫的是 producer，結果是 **6**，一樣不對。只有一邊三個指令全部做完、另一邊再做，才會得到正確的 **5**。所以同一段程式只因交錯順序不同，就可能是 4、5、6，只有 5 是對的：**值跟執行的 ordering 有關**。

### 兩個先決條件
1. **有共用的記憶體內容**（這裡是 counter）。大家沒共用任何東西，就不可能發生。
2. **Preemptive scheduling**。CPU 能在做到一半時被搶走，才會「讀了還沒寫回就被換掉」。non-preemptive 的話，一個 CPU burst 會一口氣做完：讀、算、寫回之後才換人。

所以有些 OS 在 kernel 裡，乾脆把 interrupt 關掉，暫時變成 non-preemptive。

### Race condition 的定義
**Race condition**：多個 process 同時存取、修改共用資料時，**最後的值取決於最後修改它的那個人**。

> **比喻** 像賽跑，只是「最後跑完的人贏」：P 先寫 6、C 後寫 4，最後留下 4。誰最後寫，誰決定結果。

同步問題廣義來說還有很多種，race condition 特指這種「值看誰最後執行」的情況。要避免 race condition，就要讓這些 process **synchronize**。

- 最暴力的方法：把 scheduler 用的 interrupt 關掉，系統變 non-preemptive，就不會中途被切走。OS 可以這樣做，因為 kernel 的程式碼通常很短、priority 本來就高，關一下影響不大；**一般使用者程式絕對不行**，你一關，影響的是整個系統和其他使用者。
- 一般程式的標準作法：把它定義成 **critical section problem**。

## Critical section problem

### 定義與架構
- 問題的前提：有 **N 個 process**（才會有同時存取），加上一份**共用的 shared data**。兩個條件湊齊，才有這個問題。
- 程式裡存取共用資料、可能發生 race condition 的那段 code segment，叫 **critical section（臨界區）**。同一時間只能有一個 process 執行它。
- 在它前面加 **entry section**、後面加 **exit section**，目的是 **mutual exclusion（互斥）**：一次只能有一個人在 critical section 裡。有人在裡面，其他人就進不去，「同時存取」這個 race condition 的必要條件就被拿掉了。
- 其他程式碼叫 **remainder section**。

```c
do {
    entry section        // 上鎖：決定能不能進、拿到 lock
        critical section
    exit section         // 解鎖：通知別人 critical section 空了
        remainder section
} while (TRUE);
```

通常寫成 do-while，因為同步問題常發生在重複做的事情上。critical section 的解法其實是一套 **protocol**：每個 process 都遵守同一套規則，執行順序就能被控制。我們真正要設計的就是 entry 和 exit 兩段，整章的各種解法都在討論它們該怎麼寫。

> **比喻** critical section 是一個房間，門上有一把鎖（resource 的 lock）。P1 通過 entry section、拿到鎖進房間；在它走到 exit section 之前，別人都不能進。P1 做完經過 exit section 把鎖解開，等於通知大家「空了」，P2 才能進去。做完去做 remainder section，remainder 是獨立的，不影響別人。某段程式根本不用 shared variable，就直接做 remainder，不用經過 entry、exit。**entry 上鎖、exit 解鎖。**

> **比喻** 劇場就是 shared variable：P1 是一群想看電影 A 的人，P2 想看 B，P3 想看 C，三部片都只能在同一個劇場放。先預約的先看（執行 critical section），其他人等，一個接一個，這就是 mutual exclusion 的默契。要是大家同時都想現在用劇場、互相干擾，電影就放不成，這就是 critical section problem。P1、P2、P3 同時要進時要讓誰進，就是要解的問題。

### 三個條件
正確的 critical section 解法必須同時滿足：

1. **Mutual exclusion**：一個 process 在 critical section 裡時，其他 process 不能進去。
2. **Progress**：critical section 空著、又有人想進時，一定要讓某個想進的人進得去（決定誰進不能被無限延後），不能把大家卡在外面。
3. **Bounded waiting**：一個 process 提出要進的請求之後，別人插隊進去的次數要有上限，不能無止境地等。

只顧互斥不夠，因為可能又製造出別的問題（程式卡住、有人永遠等）。

> **比喻** 上廁所：**mutual exclusion** 是絕對不跟別人共用，A 在裡面 B 就不能進去。**Progress** 是廁所裡面是空的，想進的人就一定要進得去，不能掛個「維修中」把你鎖在外面。**Bounded waiting** 是廁所可能一直有人在用，但不能讓 D 無止境地等、一直被別人插隊。

> **陷阱** progress 和 bounded waiting 最容易混：progress 管「**空著時有沒有人進得去**」；bounded waiting 管「**你最多被插隊幾次**」。

做到 bounded waiting 最簡單的方法是排隊：first come, first serve。等待沒有上限就會 **starvation**：有人永遠輪不到。

### 解法的路線圖
1. **Software solution**：programmer 自己在程式裡加程式碼（strict alternation、Peterson、Bakery）。
2. **Hardware support**：電腦提供特殊的 atomic instruction（TestAndSet、Swap）。
3. **High-level 工具**：程式庫或語言提供的 API（mutex、condition variable、semaphore、monitor），直接呼叫就好。

## Software 解法：兩個 process

### 只靠 turn 輪流（strict alternation）
只有 P0、P1 兩個 process，兩邊都在 do-while 裡不斷想進 critical section。用一個像鑰匙的 token，叫 **turn**，是兩邊都看得到的 shared variable，值是 0 或 1：turn 是 0 換 P0 進，turn 是 1 換 P1 進。

```c
// Pi（i 是自己，j 是對方）
do {
    while (turn != i);   // entry section：鑰匙不在我手上就等
        critical section
    turn = j;            // exit section：把鑰匙交給對方
        remainder section
} while (TRUE);
```

`while (turn != i);` 後面的分號表示條件成立時就卡在這行一直檢查。

- **Mutual exclusion ✓**：turn 不是 0 就是 1，一次只有一個人進得去。
- **Progress ✗**：沒人規定兩個程式是你一行、我一行地輪著跑，CPU scheduling 是執行時才決定的，P0 可能跑了很多次 P1 才跑一次。

> **例題** P0 進去、做完、出來，把 turn 設成 1。P1 還在 remainder，根本還沒要進。P0 跑得快，馬上又想進去，卡在 while：turn 是 1，進不去。P1 不急，還沒跑到要進去那一行。critical section 明明空著，P0 卻進不去，這就違反 progress。這個寫法強迫「你做完換我、我做完換你」，可是現實裡 P0 很可能要連做兩次，手上卻沒有鑰匙。

- **Bounded waiting ✓**：你一次、我一次地輪流，對方進去過一次就一定換你，最多等一次。

結論：有 mutual exclusion、有 bounded waiting，**沒有 progress**。這個寫法叫 **strict alternation（嚴格輪流）**。

### Peterson's solution
Peterson's solution 是兩個 process 的正確解法，記住概念就好，不用背程式。它延續 turn 的想法（turn 等於 i，Pi 手上就有鑰匙），再加一個 **flag** 表示這個 process 現在想不想進。剛才的問題就出在只是死板地輪流，根本不知道對方想不想進。

```c
// 共用變數
int  turn;          // 鑰匙在誰手上
bool flag[2];       // flag[i] = Pi 想不想進，初值 FALSE

// Pi
do {
    flag[i] = TRUE;               // 我想進去
    turn = j;                     // 先把鑰匙讓給對方
    while (flag[j] && turn == j); // 對方想進「而且」鑰匙在對方手上，我才等
        critical section
    flag[i] = FALSE;              // 我不想進了
        remainder section
} while (TRUE);
```

- 只有「對方真的想進、而且有鑰匙」才會被擋住。就算鑰匙在 P1 手上，只要 P1 說不想進（flag[1] 是 false），P0 照樣進得去，這就解決了 progress。
- 進去前把自己的 flag 設成 true，出來時設回 false。

> **例題** 兩人都想進。P0、P1 都先把自己的 flag 設成 true；接著兩人都執行 `turn = j`，把鑰匙交給對方。最後寫 turn 的人等於讓了步：假設 P1 最後寫，turn 變成 0。再各自檢查：P0 的條件是 `flag[1] && turn == 1`，turn 是 0，不成立，P0 進去；P1 的條件是 `flag[0] && turn == 0`，兩個都成立，P1 只好等。

`turn = j` 寫在 while 前面，是先給對方一次檢查的機會；對方想進，鑰匙就不會還你。

### Peterson 不能亂改的地方
這只是 Peterson 的一種寫法，不一定要一模一樣，但有些地方不能亂改：

- **flag[i] = true 要緊貼在 while 之前**。它的意思是「我要進去了」，如果太早設（例如放到 remainder 裡），自己其實還沒要進，卻先擋住對方，違反 progress。
- **把 turn 交給對方**這個動作，寫在進去前或出來後都可以，重點是 token 有在兩人之間交換。只靠 turn 的版本，就是把交換放在出來之後。
- **一定要交給對方**。寫成 `turn = i`（把 token 搶給自己）一定錯。

> **例題** 錯誤版本：把 `turn = j` 改成 `turn = i`。P0 舉 flag、把 turn 設成 0，檢查 `flag[1] && turn == 1`：flag[1] 還是 false，break 進去。換 P1：它也舉 flag、把 turn 搶成 1，檢查 `flag[0] && turn == 0`：turn 是 1，條件不成立，也進去了。兩人都在裡面，mutual exclusion 被破壞。

### 證明 Peterson 三個條件都成立
**Mutual exclusion（反證法）**：假設兩人都已經在 critical section 裡。

1. 要進得去，while 條件就要不成立：對 P0 來說，要嘛 flag[1] 是 false，要嘛 turn 是 0；P1 反過來。
2. 兩人都進去，代表兩人的 flag 都已經是 true，所以「對方 flag 是 false」不可能成立。flag 那個條件幫不了任何人，能放人進去的只剩 turn。
3. turn 是用 assign 寫入的（不是 ++ 或 --），所以一定是 0 或 1，不可能同時是兩個值。turn 是 0 時 P1 的兩個條件都不成立，它不可能在裡面；turn 是 1 也一樣。矛盾，得證。

**Progress**：只要檢查兩種情況，只有一個人想進，或兩個人都想進。假設 P0 想進，P1 不在 critical section 裡（在 remainder 或 while 之前），要證 P0 跑到 while 時一定能 break。

- 情況一：P1 做完離開、不想進，flag[1] 一定是 false，P0 的條件不成立，進去。
- 情況二：P1 做完沒被 context switch，很快又繞回來想進。兩人都舉了 flag、也各自設了 turn。turn 不是 0 就是 1，一定有一個人進得去（不可能兩個，否則 mutual exclusion 已被違反）。
- 兩種情況都有人能進，critical section 不會空著沒人用。兩人都不想進就不用管，那不是 progress 的事。

**Bounded waiting**：這個最 tricky。設定：P1 在 critical section 裡，P0 在 while 等，要證 P1 做完之後下一個一定是 P0。

1. P1 出來，把 flag[1] 設成 false。如果剛好 context switch，P0 看到 false，不管 turn 是多少都 break 進去。
2. 常被忘記的情況：P1 沒被切走，繼續跑下一圈，又想進來，flag[1] 又變成 true。
3. 關鍵在 turn：P1 進下一輪前一定先執行 `turn = 0`，把鑰匙讓給 P0。P0 一直在等，它的 flag 一直是 true；鑰匙又在 P0 那，所以 P1 卡在 while。
4. context switch 不是一人一行，P1 可能連跑很多指令，但就是碰不到 critical section。直到它的時間用完、換到 P0，P0 一換過來就進去。

兩人都 ready 時鑰匙一定交給對方，剛出來的人沒辦法馬上再進，等的人一定先輪到。這就是「把鑰匙交給別人」跟「把鑰匙設給自己」的差別。

### Critical section 要包多大
> **例題** 把 producer–consumer 的整段程式都包進 critical section，看起來最安全，其實是錯的。一開始 buffer 是空的，consumer 先被呼叫，順利進了 critical section；它發現 buffer 是空的，就在 critical section 裡用迴圈等。這時 producer 才來，但整段都是 critical section，它被 entry section 擋在外面，沒機會放資料。consumer 等 producer 生資料、producer 等 consumer 離開，兩個互相等，卡死，這就是 **deadlock**。

> **例題** 另一種寫法是對的但不好：程式裡有一些完全獨立的計算，真正會 race 的只有 `counter++`，卻把計算也一起包進去。A 在裡面做到一半被 context switch，換到 B，B 也要進 critical section，就卡在 entry。那些計算本來誰排到誰就能做，包進去之後變成一定要等 A 全做完，critical section 被拉長。很多時候輪到你，你卻卡在 entry 做沒意義的等待，整體 CPU 效率變差。

> **重點** critical section 包得**越小越好**，只包跟 race condition 有關的程式；包錯範圍甚至會 deadlock。

## Software 解法：N 個 process（Bakery algorithm）

### 為什麼 Peterson 不能直接推廣
Peterson 只能用在兩個人，因為 turn 只有 0 或 1，交給對方非常明確。N 個 process 時，token 要設成多少？交給誰？現在誰手上有？全都不知道。所以改用排隊：**Bakery algorithm（麵包店演算法）**。

> **比喻** 郵局或麵包店只有一個人在結帳。大家先抽號碼牌，照號碼一個一個來，人再多，一次也只有一個人在結帳。抽號碼就是 first come, first serve，所以滿足 bounded waiting；只要有人抽了號碼，就知道下一個要服務誰，所以也滿足 progress。

放到程式裡：每個 process 進去之前先抽一個號碼，號碼越小越先執行。但程式比現實麻煩：現實的號碼機一次吐一張，程式裡抽號碼卻是好幾行，中途可能被切走，兩個人可能抽到一樣的號碼（號碼只保證不會變小，non-decreasing）。所以要一個 **tie breaker**：號碼一樣就比 **PID**，PID 小的先進。每個 process 的 ID 都是獨一無二的。

比較時寫成兩個數一組：`(a, b) < (c, d)` 的意思是 `a < c`，或 `a == c` 且 `b < d`。先比號碼，號碼一樣再比 PID。

### 程式
```c
bool choosing[n];   // 初值 FALSE
int  num[n];        // 初值 0，0 代表沒抽（不想進）

// Pi
do {
    choosing[i] = TRUE;                          // 我正在抽，先別跟我比
    num[i] = max(num[0], ..., num[n-1]) + 1;     // 抽號碼
    choosing[i] = FALSE;                         // 抽完了
    for (j = 0; j < n; j++) {
        while (choosing[j]);                     // Pj 正在抽，等它抽完
        while ((num[j] != 0) &&
               ((num[j], j) < (num[i], i)));     // Pj 比我早，等它
    }
        critical section
    num[i] = 0;                                  // 不進了
        remainder section
} while (TRUE);
```

一行一行看：

- `num` 是共用的 array，但 **num[i] 只有 Pi 自己會寫，別人只會讀**。只有一個寫入者，就不會 race。Peterson 的 flag 也是同樣道理。
- 抽號碼：看目前大家最大的號碼再加 1，例如看到最大是 5，就抽到 6。`max` 看起來是一行，其實是一連串 if-else 比較，是好幾個指令，所以才可能抽到一樣的號碼。
- 抽完用 for loop 跟每個人比。對方 num 是 0，代表他沒抽、不想進，直接跳過。對方有抽，才比 `(num[j], j) < (num[i], i)`；只要有人比你小，你就卡在 while。例如 P0 拿 3、P2 拿 6，P2 就要等。
- 號碼越抽越大，號碼小就是比較早抽，先讓他進，這就是 first come, first serve。
- 能 break 每個人的 while，代表大家都比你大或沒抽，你才進去。離開時把 num[i] 設回 0，等你的人就能 break。

### 為什麼要 choosing
`choosing[i]` 像一把鎖，告訴大家：Pi 現在是不是正在抽號碼。抽之前設成 true，抽完設成 false。跟任何人比之前，都先 `while (choosing[j]);` 多看一眼：他是不是正在抽？他正在抽的話，他的數字正在變，現在是 0，等一下就不是 0 了。太早跟他比，看到 0 以為他不進去；結果他雖然比你晚抽，抽完卻可能跟你一樣，而且 PID 比你小、照規則應該他先。

> **例題** 目前大家抽過的最大號碼是 5，P1 和 P4 都要進去。PID 1 比 4 小，所以號碼一樣時 P1 優先。
>
> **沒有 choosing 的錯誤版本：**
> 1. P1 開始抽：讀到 max 是 5，還沒把 6 寫回去，就被 context switch，num[1] 還是 0。
> 2. 換 P4 抽，而且先抽完：它也看到 5，num[4] = 6。
> 3. P4 檢查別人：num[1] 還是 0，看起來像沒抽，P4 直接進 critical section。
> 4. P1 回來把號碼寫回去，它剛才讀到的是 5，所以 num[1] = 6。
> 5. P1 比較：(6, 1) < (6, 4)，P1 覺得自己優先，也進去了。兩人都在裡面，**mutual exclusion 被破壞**。
>
> **有 choosing 的正確版本：**
> 1. P1 把 choosing[1] 設成 true，讀了 max 是 5 就被切走。
> 2. P4 抽完 6，比到 j = 1 時看到 choosing[1] 是 true，卡在 `while (choosing[1]);`。
> 3. P1 回來抽完，num[1] = 6，choosing[1] 設回 false。
> 4. P4 這才比：(6, 1) < (6, 4)，P4 被擋住。
> 5. P1 比較時發現沒人比它小，break 進去。PID 小的 P1 先進，這才是對的。

這就是同步難寫又難驗證的原因：每個指令之間都可能被切，人一多，順序組合多到數不完。

### Bakery 的正確性
- **Mutual exclusion**：一次只有 (號碼, PID) 最小的人能進，而這組數字獨一無二。
- **Progress**：目前 (號碼, PID) 最小的那個人，一定能 break 兩個 while，進到 critical section。
- **Bounded waiting**：first come, first serve，先抽先進，不會被無限插隊。

## Hardware support

### Atomic instruction
software 解法完全靠程式碼，可以去證明它對不對，但 entry section 可能七、八行以上，指令越多越慢。同步問題是因為 interrupt 會打斷程式，關掉 interrupt 是一種辦法，但會影響其他程式。另一種辦法是硬體：提供一些特殊 instruction，一次把好幾件事做完，中間保證不被 interrupt，叫 **atomic instruction（不可分割的指令）**。不管邏輯多複雜，只要是硬體一次做完，就沒有 race condition。真實的電腦系統都有提供這類指令。

> **觀念** 下面的 TestAndSet、Swap 看起來都是好幾行程式。如果它們只是一般的 software function，兩個 thread 同時呼叫，它自己就會 race。例如自己寫的 swap，P0、P1 可能都先讀到 lock 是 false，最後兩人都拿到 false，一起進去。所謂 hardware support，是把這個 function 用邏輯線路燒在硬體裡，**做成一個 single instruction**，不是一行 statement，也不是 function call；線路裡根本沒有 context switch 這回事。寫出來的幾行只是表達概念。好處有兩個：軟體變簡單，更重要的是快，硬體永遠比軟體快。

### TestAndSet
```c
bool TestAndSet(bool *target) {   // 整個是一條 atomic 指令
    bool rv = *target;    // test：記下原本的值
    *target = TRUE;       // set：不管原本是什麼，都設成 true
    return rv;
}
```

呼叫它，它會告訴你 lock 原本的值，同時把 lock 設成 true。很多人同時呼叫，也一定是一個做完下一個才做。

> **比喻** 去看門有沒有鎖，但不管看到什麼，都順手把門鎖上。

```c
bool lock = FALSE;      // 一開始沒鎖

do {
    while (TestAndSet(&lock));   // entry：拿到 false 才能進
        critical section
    lock = FALSE;                // exit：解鎖
        remainder section
} while (TRUE);
```

第一個呼叫的人一定拿到 false，break 出 while 進去；但它一呼叫，lock 就變 true，後面的人再呼叫拿到的都是 true，全部被卡住。離開時把 lock 設回 false，下一個呼叫的人拿到 false，就能進去。

- **Mutual exclusion ✓**：它是 atomic 的，第一個拿到 false 的人同時把它改成 true，不可能兩人都拿到 false。
- **Progress ✓**：沒人在裡面時 lock 是 false，第一個呼叫的人一定進得去。而且 N 個 process 都能用。
- **Bounded waiting ✗**：沒有排隊。100 個 process 都在 while 裡一直呼叫，OS 排程不一定輪流，誰剛好先呼叫誰就拿到，等於用搶的；某個 process 可能一直搶不到。

很多時候三個條件全做到代價太大，至少先解掉前兩個。

補上 bounded waiting 的作法是加一個 `waiting[]` 陣列，出來時依序把鎖交給下一個在等的人：

```c
bool waiting[n];   // 初值 FALSE
bool lock = FALSE;

// Pi
do {
    waiting[i] = TRUE;
    key = TRUE;
    while (waiting[i] && key)
        key = TestAndSet(&lock);
    waiting[i] = FALSE;
        critical section
    j = (i + 1) % n;                     // 從下一個開始往後找
    while ((j != i) && !waiting[j])
        j = (j + 1) % n;
    if (j == i) lock = FALSE;            // 沒人在等，解鎖
    else waiting[j] = FALSE;             // 直接把進去的權利交給 Pj
        remainder section
} while (TRUE);
```

出來的人照 i+1、i+2、… 的循環順序找下一個在等的人，所以任何在等的 process 最多等 n−1 輪。

### Swap
```c
void Swap(bool *a, bool *b) {   // atomic
    bool temp = *a;
    *a = *b;
    *b = temp;
}

bool lock = FALSE;   // 共用

do {
    key = TRUE;                       // 每個人自己的 key
    while (key == TRUE)
        Swap(&lock, &key);            // 換到 false 才能進
        critical section
    lock = FALSE;                     // 把紅球還回去
        remainder section
} while (TRUE);
```

> **比喻** 每個 process 手上都有一顆藍球（key = true），只有 lock 手上那顆是紅的（false）。拿到紅球的人可以進 critical section。swap 就像玩大風吹，大家換球，可是全場只有一顆紅球。P0 第一個來換，key 變 false，break 進去，這時 lock 變成 true（藍球）。P1、P2 再怎麼換都只換到藍球，只能在 while 裡一直換，等 P0 出來把 lock 設回 false，像把紅球還回去。

大家的程式碼一模一樣，不用分誰是誰，所以一樣能用在 N 個 process。

- **Mutual exclusion ✓**：所有 key 跟 lock 裡，同一時間只會有一個是 false，只有一顆紅球。
- **Progress ✓**：lock 是 false 時，第一個呼叫的人一定能 break。
- **Bounded waiting ✗**：沒有任何排隊規則，先呼叫的先進。

> **重點** TestAndSet 和 Swap 原則完全一樣：lock 是 false 時，第一個來的人進去。要人多又要 bounded waiting，就得排隊（像 Bakery 那樣比較複雜）；不在乎的話，硬體解法非常有效率。

## Pthread 的 mutex 與 condition variable

### Mutex
自己寫程式時，大部分不會去寫 Peterson，而是用現成的工具。Pthread 提供的就是 **mutex**（mutual exclusion 的縮寫），它是一個特殊變數，就是一把鎖。

```c
pthread_mutex_t mutex;
pthread_mutex_init(&mutex, NULL);   // 先 declare、再 initialize（它其實是一個資料結構）

pthread_mutex_lock(&mutex);         // entry section
    /* critical section */
pthread_mutex_unlock(&mutex);       // exit section

pthread_mutex_destroy(&mutex);      // 用完 destroy
```

- lock、unlock 裡面裝的，就是學過的那些解法（software 或 hardware 都行），Pthread 只是把它包起來。
- 程式裡所有可能 race 的地方都要呼叫 lock、unlock，而且**要用同一個 mutex**：mutex 本身就是大家共用的變數，必須是同一把鎖才擋得住彼此。
- 要保護的是互不相關的資料，就宣告別的 mutex，等於好幾把不同的鑰匙。只有用同一把 mutex 的 critical section 彼此互斥。

### Condition variable
很多程式同時跑時，常需要某個 **event** 發生，再去 trigger 其他 thread 開始做事。例如資料還沒載進來，大家沒辦法處理；一個 thread 負責載資料，載完再叫大家一起處理。**Condition variable（條件變數）**的用途就是：條件發生時，notify 其他 thread。

- `pthread_cond_wait`：等在某個 condition variable 上，沒人 signal，這個 thread 就 block。
- `pthread_cond_signal`：事件發生了，等在上面的 thread 會有**一個**被叫醒（通常是最早等的那個，看 library 怎麼做）。
- `pthread_cond_broadcast`：一次叫醒**全部**。
- 一樣要 init、用完 destroy。`cond_wait` 的參數還要一把 mutex：**condition variable 必須跟 mutex 一起用**。

> **例題** counter thread 負責改 x，action thread 要等 x 變成 0 才能做事。
> ```c
> // action thread                      // counter thread
> pthread_mutex_lock(&mutex);           pthread_mutex_lock(&mutex);
> if (x != 0)                           x--;
>     pthread_cond_wait(&cond, &mutex); if (x == 0)
> pthread_mutex_unlock(&mutex);             pthread_cond_signal(&cond);
> take_action();                        pthread_mutex_unlock(&mutex);
> ```
> action 發現 x 不是 0，就去 wait；counter 發現 x 變成 0，就 signal，action 被叫醒去做事。

為什麼兩邊都要包進 critical section？

1. 拿來當條件的 x 通常是共用變數，可能很多 thread 在加加減減，本來就要保護。
2. 「先檢查 x 是 0、再 signal」是好幾行，中間被切走、x 被改了，signal 時 x 可能已經不是 0。

所以 signal 那邊要在 critical section 裡，wait 那邊也必須在裡面。這是固定的 design pattern。

> **陷阱** 建議把 `if (x != 0)` 寫成 `while (x != 0)`：被叫醒後要重新檢查條件，因為條件可能已被別人搶先改掉，或發生 spurious wakeup（沒人 signal 卻醒來）。

### cond_wait 為什麼要傳 mutex
疑問：兩邊都在 critical section 裡，action 在裡面 wait 睡著，counter 不就進不來，deadlock 了嗎？一步一步看：

1. action 先進來，把 mutex lock 住。
2. x 不是 0，它呼叫 cond_wait，被 put to sleep（inactive）。這時**cond_wait 在裡面幫你 release 這把 lock**（你沒寫 unlock）。
3. 鎖放掉了，counter 才進得來，把 x 減到 0，條件成立，signal。
4. action 被叫醒，但手上沒有鎖（鎖在 counter 那），所以還卡在 cond_wait 這行：**cond_wait return 前要先 reacquire 這把 mutex**。
5. counter unlock 離開，action 重新拿回鎖，繼續做它的事。

看起來兩人都在裡面，但真正在執行的人手上一定有鎖。這就是 cond_wait 要傳 mutex 的原因：library 要幫你放鎖、再拿回來，得知道是哪一把。而且要傳 mutex，你自然就會把它寫在 critical section 裡，不會忘；Pthread 乾脆把這寫法規定死。這是 Pthread 的 coding style，其他 library（例如 C++、Java）也有 condition variable，寫法不一樣，概念相同。

### 同步的兩個目的
synchronization 就是**控制 thread 執行的順序或時間點**。

1. 解決 race condition（結果沒辦法預測）：工具是 **mutex lock**，不用自己寫 entry、exit，它包成函式讓你呼叫。
2. 控制「什麼時候」執行：工具是 **condition variable**，它就像一個 event waiting queue。很多 shared memory 的平行語言都有，實作不同，概念一樣。

### Thread pool
condition variable 的好例子是 thread pool，大部分 web server 都這麼做。

- 作法：先把 thread 建好放著，有工作就交給它做，做完不結束，留著等下一件。thread 不用一直刪掉又重建；更重要的是能控制系統總共用了多少 thread。不然 request 一多就建一堆 thread，硬體有限，只會一直 context switch，大家都變慢。控制 pool 的大小就能控制系統效能。
- 怎麼讓同一個 thread 做不同的工作？塞給它一個 **function pointer 跟 argument**，照著執行就是在處理 request。
- 每個 thread 跑一個 while loop：在 `cond_wait` 上睡著等 → 被叫醒 → 執行 data structure 裡指定的 function → 做完繞回去再等。thread 不會被 terminate。
- 所有 thread 都 wait 在**同一個 condition variable** 上，整個 pool 共用一個 condition variable 和一把 mutex。前面有一個 master，收到 request 就把 function pointer 和 argument 填好，然後 signal 叫醒一個。signal 不在乎叫醒誰，waiting queue 的第一個來做就對了，一次一個。也記錄 thread count，master 就知道目前有幾個在忙、什麼時候可以 signal。
- 一樣是先 lock、再 cond_wait、再 unlock，確保一個 job 不會被兩個 thread 同時拿走。

同步有兩個層面：一個是解 race condition，一個是控制執行順序，讓程式行為正確。

## Semaphore

### 概念：一個數資源的 counter
**Semaphore（號誌）**名字來自鐵路的號誌燈，告訴火車能不能通行。它有點像 condition variable 加上 mutex 的結合，是幫我們簡化程式、控制執行順序的工具。

- semaphore 說穿了是一個 **integer counter**，每個 semaphore 管理某一樣 resource，這個數字就是**目前 available 的資源數量**。
- 只靠兩個操作：**wait** 和 **signal**，也叫 **P** 和 **V**（來自荷蘭文）。wait 放在 entry section，signal 放在 exit section。
- wait 是「我要一個資源」：離開 wait 代表拿到一個，數字減 1；數字是 0 代表沒資源了，呼叫 wait 就卡住，直到數字大於 0。
- signal 是「我用完了，還回去」：數字加 1。

> **陷阱** semaphore 的 wait／signal 跟 condition variable 的 wait／signal 名字一樣，定義完全不同，千萬別混在一起（差別見 monitor 一節）。

### Binary 與 counting semaphore
- 資源只有一個，值只在 0 和 1 之間跳，叫 **binary semaphore**，用起來就像 mutex lock（把 critical section 當成一種資源，很多人想進但只能讓一個人進）。
- 值可以是任意整數（例如初值大於 1），叫 **counting semaphore**，能讓好幾個 process 同時進去。電腦裡很多資源本來就是一個數量，不只 true、false。例如 thread pool 有 10 個 thread，就把它 initialize 成 10，10 個以內都能進。

semaphore 比 mutex 更 powerful，適合更一般化的情況；但只要是 binary 的問題，大家通常直接用 mutex（實作簡單），要 counting 才用 semaphore。

> **陷阱** 嚴格的分法看「值域」：binary 只有 0、1；counting 是任意整數。「初值 1 就叫 binary」是簡化說法，counting semaphore 的初值也可以是 1。

> **例題** S 初值 1。P1 呼叫 wait(S)：S 是 1，不用等，S 減成 0，進去。P1 還在裡面時 P2 呼叫 wait(S)：S 是 0，只能在 while 裡一直轉。P1 做完出來呼叫 signal(S)，S 加回 1；P2 跳出迴圈、把 S 減成 0，進去。這就是它叫 wait 的原因。

> **例題** Counting semaphore，S 初值 3（3 個位置）：
> ```
> 事件              S     裡面的人
> P1 wait           3→2   P1
> P2 wait           2→1   P1 P2
> P3 wait           1→0   P1 P2 P3   （滿了）
> P4 wait           0     等待：P4
> P5、P6 wait       0     等待：P4 P5 P6
> P2 signal         0→1   P1 P3
> P4 通過 wait      1→0   P1 P3 P4
> ```

### 實作一：busy waiting（spinlock）
```c
wait(S) {
    while (S <= 0);   // 沒資源就在這行空轉
    S--;              // 拿走一個
}
signal(S) {
    S++;              // 還回一個，等的人就有機會 break
}
```

兩件很重要的事：

1. **wait 和 signal 必須是 atomic**，一次做完、不能被打斷。S 是共用變數，一個在加、一個在減，就跟最早的 counter 一樣會 race。用什麼做都行：硬體特殊指令、software 包成 critical section，或 kernel 先關 interrupt 再開。
2. 這種實作叫 **spinlock（自旋鎖）**：等的人一直在 while 裡 spinning。卡在 wait 的 thread 看起來沒在做事，對 CPU 來說卻一直在重複執行同樣的指令，等的人可能好幾個一起轉。壞處是浪費 CPU：CPU 百分之百好忙，程式卻都沒在動，這叫 **busy waiting**。好處是容易實作，一個 while loop 就搞定。

### 實作二：non-busy waiting（block 與 wakeup）
改用 OS 提供的兩個 system call：

- **block（sleep）**：把 process 放進 waiting queue，OS 不會排它上 CPU。就像等 I/O 時進入睡覺狀態，只是這次是 process 自己說「我在等 critical section，讓我去睡吧」。
- **wakeup(P)**：把 P 從 waiting queue 拿出來，放回 ready queue，讓它可以再被排程。

semaphore 的結構變成一個 value 加一個 waiting queue：

```c
typedef struct {
    int value;
    struct process *list;   // 等這個 semaphore 的 process
} semaphore;

wait(semaphore *S) {
    S->value--;                    // 先減
    if (S->value < 0) {            // 減完是負的：沒位置了
        add this process to S->list;
        block();                   // 去睡，不吃 CPU
    }
}

signal(semaphore *S) {
    S->value++;
    if (S->value <= 0) {           // 加完還 ≤ 0：list 裡還有人在等
        remove a process P from S->list;
        wakeup(P);
    }
}
```

- 為什麼要先減再睡？因為一呼叫 sleep 就沒機會再做任何事了。也因為先減，判斷條件是 `< 0`，不是 `<= 0`。
- **value 是負的時候，它的絕對值就是正在等的 process 數。**
- signal 的條件是加完之後 `≤ 0`（代表還有人在等），不是「大於等於 0」。
- 整段程式沒有任何 while loop，等的人都在睡，不吃 CPU。

> **例題** S 初值 1：
> ```
> 事件          value   list       說明
> P1 wait       1→0     -          不是負的，直接進去
> P2 wait       0→-1    P2         負的，P2 進 list、block
> P3 wait       -1→-2   P2 P3      |−2| = 2 個人在等
> P1 signal     -2→-1   P3         加完 ≤ 0，移出 P2 並 wakeup，P2 進去
> ```

### Spinlock 還是 sleep
考試常問：既然有兩種實作，是不是都用 non-busy waiting 就好？答案是**看等待時間**。

- non-busy waiting 不浪費 CPU，但要呼叫 system call，比 S 減 1 那三、四個指令慢很多；sleep、wakeup 還要 context switch、rescheduling，也不知道何時才輪到你。
- 等待時間**很短**，用 busy waiting：while 檢查兩三次就 break，反而比較快。現在電腦多半是多核心，你在 busy waiting 時，對方可能正在另一個 core 上跑，很快就放掉，你連 context switch 都不用。
- 等待時間**很長**（例如平均要等 5 秒，對 CPU 是超級漫長的時間），就去睡，把 CPU 讓給別人。system call 再慢，也就幾個 millisecond。

### wait、signal 本身要 atomic
不管哪一種實作，wait、signal 都必須是 atomic；第二種不只有 value 的加減，還有 queue 的插入、刪除，更不能讓它們同時執行。

- 最暴力的是 OS kernel 會做的：**disable interrupt**。但有好幾顆 CPU 時，只關一顆沒用，得讓整台電腦停下來，非常沒效率；所以 multiprocessor 上通常改用 spinlock（或 compare-and-swap 這類指令）保護這段很短的程式。
- 也可以用 hardware 或 software 寫 entry、exit，把 wait、signal 變成 critical section。wait、signal 裡面有 if-else，兩條路各要一個 exit section。

> **陷阱** 千萬不要把 sleep 跟 wakeup 包進 critical section！sleep 只是一個 system call，不像 cond_wait 會幫你放鎖、醒來再拿回來；一包進去，它就睡在裡面，沒人進得去。反過來，不用擔心大家同時呼叫 sleep、wakeup：它們是 OS 的 system call，OS 會保證它們沒有同步問題。

### POSIX semaphore
semaphore 由 OS 支援，kernel 自己很多地方都要用，所以已經做好，成為 Linux POSIX API 的一部分：

```c
#include <semaphore.h>
sem_t sem;
sem_init(&sem, 0, 1);      // 初值可以給任意整數
sem_wait(&sem);            // wait
    /* critical section */
sem_post(&sem);            // signal 在 POSIX 叫 post
sem_getvalue(&sem, &v);    // 看目前的值
sem_destroy(&sem);
```

它不屬於 Pthread，不只用在 thread 之間，很多時候是在 process 之間用，尤其在 OS level。初值設成 1，wait、signal 就像 lock、unlock，一樣能解 critical section。

### 用 semaphore 排順序
同步的另一個目的是控制誰先誰後。

> **例題** P1 裡有一行 S1，P2 裡有一行 S2，要求 S1 一定要在 S2 之前執行。如果剛好 S1 在第 10 秒、S2 在第 11 秒，沒問題；但也可能 S2 第 10 秒就跑了、S1 第 20 秒才跑，就不符合要求。
> ```c
> semaphore sync = 0;      // 還沒有通行證
> // P1                     // P2
> S1;                       wait(sync);   // 先拿通行證
> signal(sync);             S2;
> ```
> S2 先到時 sync 還是 0，wait 強迫 P2 停在這行。第 20 秒 P1 做完 S1、signal，sync 變 1；第 21 秒 P2 拿到通行證，sync 減回 0，執行 S2。順序保證是 S1 再 S2，沒有別的可能。P2 時間軸上多出來那段，就是它為了等 S1 花的 waiting time。

### Data flow：每條邊一個 semaphore
很多應用是一個 data flow：一堆 process，一個的 output 給另一個，有的還要等兩個人的 output。原則一樣：**每一條 edge 各建一個 semaphore，初值都是 0；有進來的邊就 wait，有出去的邊就 signal，中間是自己的 statement**。

> **例題** P1 最先執行，邊 a 通往 P2、邊 b 通往 P3；邊 c 從 P2 通往 P4；P4 有兩條出去的邊；P6 有兩條進來的邊 d、f，一條出去的邊 h。
> ```c
> // P1                // P2                // P4                    // P6
> S1;                  wait(a);             wait(c);                 wait(f);
> signal(a);           S2;                  S4;                      wait(d);
> signal(b);           signal(c);           signal(兩條出邊各一次);   S6;
>                                                                    signal(h);
> ```
> P1 做完 signal(a)、signal(b)，觸發 P2、P3 開始；P2 先 wait(a)，做完 signal(c) 讓 P4 開始；P6 要 f 和 d 兩個都等到了才開始，做完再 signal(h)。semaphore 常被這樣用，而且常常是跨 process 的。

### wait、signal 寫錯：deadlock 與 starvation
一堆 wait、一堆 signal 全由 programmer 自己控制，順序寫錯時 process 會互相等，誰都沒辦法前進。

> **例題** 兩個 semaphore S、Q，初值都是 1。
> ```
> P0:            P1:
> wait(S);       wait(Q);
> wait(Q);       wait(S);
>   ...            ...
> signal(S);     signal(Q);
> signal(Q);     signal(S);
> ```
> 第一步都能過：P0 拿走 S，P1 拿走 Q。接著 P0 要 Q，Q 在 P1 手上，卡住；P1 要 S，S 在 P0 手上，也卡住。兩個互相等待、沒辦法前進，這就是 **deadlock**。初值要是 0，那更不用說，第一行就卡住。

deadlock 的結果是 starvation，但兩者不一樣：**starvation** 是某個程式永遠沒機會執行，原因很多，deadlock 是一種；priority scheduling 裡 priority 太低也會 starvation。在同步裡，常常就是 programmer 一不小心寫錯，造成 deadlock，最後變成 starvation。

### Priority inversion
（補充）高 priority 的 process H 要用一個資源，這個資源的 lock 正被低 priority 的 L 拿著，H 只好等 L 放掉。這時中 priority 的 M 進來，它不需要那個資源，但 priority 比 L 高，就把 L 擠下 CPU；L 跑不了、放不掉 lock，H 就一直等。結果 H 實際上被 priority 比它低的 M 延遲了，這叫 **priority inversion**。

解法是 **priority inheritance（優先權繼承）**：L 拿著 H 在等的資源時，暫時把 L 的 priority 拉高到 H 的等級，讓 M 搶不走 CPU；L 一放掉資源，priority 就恢復原值，H 接著拿到資源。

> **陷阱** priority inversion 是「問題」（高 priority 被中 priority 間接插隊），priority inheritance 是「解法」（暫時把低 priority 的持鎖者拉高），不能只背名詞。

## 三個經典同步問題
同步問題五花八門，系統裡遇到的各種問題幾乎都能 reduce 成幾個 **classical synchronization problems**，所以它們主要拿來當考題：寫好的同步程式或工具，用它們檢驗是不是真的對、好不好用。最常見三個：bounded buffer、readers-writers、dining philosophers。

### Bounded buffer
就是一開始用來講同步問題的 producer–consumer。bounded 是有上限，buffer 的大小固定。buffer 空的時候 consumer 沒東西拿只能等；buffer 滿的時候 producer 沒地方放也要等。真實系統到處都是：compiler 的輸出交給 linker、linker 再交給 loader，中間都有 buffer；整個 I/O 系統每一層之間也都有 buffer。

用三個 semaphore 解：

```c
semaphore mutex = 1;   // 保護 buffer 本身
semaphore empty = n;   // 空格數
semaphore full  = 0;   // 有東西的格數

// producer                       // consumer
do {                              do {
    produce an item;                  wait(full);
    wait(empty);                      wait(mutex);
    wait(mutex);                      remove an item from buffer;
    add the item to buffer;           signal(mutex);
    signal(mutex);                    signal(empty);
    signal(full);                     consume the item;
} while (TRUE);                   } while (TRUE);
```

> **陷阱** producer 要先 wait(empty) 再 wait(mutex)。順序反過來的話，buffer 滿時 producer 先拿到 mutex，再卡在 wait(empty)；consumer 要拿東西得先拿 mutex，拿不到，兩邊互相等，deadlock。consumer 這邊同理，要先 wait(full) 再 wait(mutex)。

### Readers-writers 問題
file system、storage system 常碰到：做 read 的叫 reader，做 write 的叫 writer。

- 兩個人同時寫同一個檔案，內容會亂掉，所以 **writer 一次只能有一個**。
- 有 writer 在寫的時候，其他 reader、writer 全都不能碰，因為他們不知道檔案現在的狀態。
- 全部都是 reader 的話可以一起讀，反正不會改到內容。

這個問題分好幾個版本，要求一個比一個高：

- **First readers-writers problem**：最低要求，只保證 writer 用的時候是 exclusive access。reader 要等多久、什麼時候做，都不管。
- **Second readers-writers problem**：writer 有比較高的 priority，**writer 不能 starvation**。writer 一 ready，目前的 reader 做完就要換 writer；比 writer 晚來的 reader 不能插隊。反過來，這時換 reader 可能 starvation。
- 還有 third readers-writers problem，要求更多。

> **例題** 為什麼需要 second 版本？first 版本裡，拿到鎖的 reader 可以把鎖傳給下一個 reader。看時間軸：R1 從第 0 秒開始讀 10 秒；writer 第 2 秒就到了；第 8 秒 R2 來了，R1 還沒讀完，鎖就留給 R2，R2 又讀 10 秒（到第 18 秒）；R2 讀完前又有 reader 來，一直傳下去。第 2 秒就來的 writer 可能永遠拿不到鎖，這就是 **writer starvation**。

> **陷阱** second 版本是 **writer 優先**、防止 writer starvation，不是 reader 優先。first 版本會讓 writer starvation；second 版本則可能讓 reader starvation。

### First readers-writers 的 semaphore 解法
想法：用 counting 的概念，數一數現在有幾個 reader 在讀。只要還有 reader 在讀，鎖就一直在 reader 這邊；完全沒有 reader 時，鎖才放掉，writer 才有機會。以群組為單位：**第一個進來的 reader 替大家拿鎖，最後一個離開的替大家還鎖**。

```c
semaphore wrt   = 1;   // 檔案內容的寫入鎖（binary，像 mutex）
semaphore mutex = 1;   // 保護 readcount
int readcount   = 0;

// writer
wait(wrt);
    writing;
signal(wrt);

// reader
wait(mutex);
readcount++;
if (readcount == 1)      // 我是第一個 reader：替大家拿鎖
    wait(wrt);
signal(mutex);
    reading;
wait(mutex);
readcount--;
if (readcount == 0)      // 我是最後一個 reader：替大家還鎖
    signal(wrt);
signal(mutex);
```

> **例題** R1 來，readcount 變 1，等於 1，它是第一個 reader，去 wait(wrt) 搶鎖（writer 拿著的話就得等），這裡 R1 拿到了。R2 來，readcount 變 2，不是 1，代表已經有人幫大家拿到鎖，直接去讀；它要是也去 wait(wrt)，反而卡住自己。R1 讀完先走，readcount 變 1，不是 0，不用 signal，鎖繼續留在 reader 這群。R2 也走，readcount 減成 0，它是最後一個 reader，這時才 signal(wrt)，writer 終於可以寫了。

- readcount 自己也是好幾個 reader 共用的變數，大家可能同時加 1，跟 counter 一樣會 race，所以要用另一個 semaphore **mutex** 保護它。
- 而且要**連後面的 if 一起包進去**：改完要馬上檢查，不然值可能又被別人改了。減 1 那段也一樣。
- 寫完大架構後，再檢查哪裡會 race、一一保護。**有關聯的資料用同一把鎖，沒關聯的用不同的鎖**：wrt 保護檔案內容，mutex 保護 readcount，兩者無關，所以分開；全用一把可能出錯又沒效率。

這個解法的問題就是 writer starvation：reader 一直把鎖傳給後來的 reader，後來的 reader 超車先來的 writer。

### Dining philosophers
圓桌旁坐著五位哲學家，筷子跟人一樣多（五根），每根放在兩人中間。每個人要拿起左右兩支筷子才能吃，吃完放回去讓別人用。

- 每根筷子都是一個獨立的 resource，就像一塊獨立的記憶體內容，一次只能拿一支。不能寫一個神奇的 function 一次把兩支同時拿起來，能的話就沒有同步問題了。
- 程式常常就是同時需要好幾個資源，跟這題一模一樣。

最直覺的寫法是每根筷子一個 semaphore：

```c
semaphore chopstick[5] = {1, 1, 1, 1, 1};

// 哲學家 i
do {
    wait(chopstick[i]);              // 拿左邊
    wait(chopstick[(i + 1) % 5]);    // 拿右邊
        eat;
    signal(chopstick[i]);
    signal(chopstick[(i + 1) % 5]);
        think;
} while (TRUE);
```

> **例題** 五個人同時餓了，都先拿左邊：拿左邊都沒問題，五個人各拿到一支。要拿右邊時，右邊那支已經被隔壁拿走了，每個人拿著一支、等下一支，永遠等不到，**deadlock**，接著大家都吃不到（starvation），使用者就會覺得程式壞了。

要正確解它比較複雜，下面用 monitor 解。

## Monitor

### 為什麼需要 monitor
用 semaphore、mutex、condition variable，都得自己在程式裡呼叫一堆 wait、signal、lock，順序往前移一行、往後移一行，結果就不一樣：有時 deadlock，有時還是 race。它們可能比較快，但是很 **low level** 的工具，寫程式的小錯誤就會讓它卡住。

**Monitor** 是一種 **high-level language construct**，說穿了就是物件導向的概念：

- 一個 monitor 就是一個特殊的 class 產生出來的 object。
- 會 race、需要保護的變數，就當成這個 object 裡的 private（local）variable。
- 所有操作這些變數的動作都寫成 method，誰想碰這些變數，一定要透過 method。
- 跟一般 OO 只差一點點但非常重要：一般 OO 的 method 可以被很多 thread 同時執行，同時執行就會 race；**monitor 的 method 一次只能有一個在執行**。很多 thread 同時呼叫也沒關係，會被 queue 住，排隊一次一個進來，語言本身會保護這個 object，這就是 mutual exclusion。

為什麼簡單得多？你只要定義行為：哪些變數要保護、對它們有哪些操作。這些 method 預設就不能同時執行，所以不會有 critical section 的問題。它已經融進語言設計，所以說它 high level，是一個 specialized class；各語言形式不同，Java 這類語言都支援。

```
monitor monitor-name {
    shared variable declarations      // 只能被下面的 method 存取
    procedure P1(...) { ... }
    procedure P2(...) { ... }
    ...
    initialization code(...) { ... }
}
```

### 只有一個 active
大家常忽略一個細節：「一次一個」不是只有一個人在裡面，而是**只有一個 active 的 thread**。

- 在 monitor 裡呼叫 condition variable 的 wait、睡著的 thread 是 **inactive**：它在 object 裡做到一半被暫停了，這時可以讓別的 thread 進來，只要維持一個 active 就好。
- active 就是能執行裡面的 statement。

> **陷阱** 「monitor 裡同時只能有一個 thread」是錯的。monitor 裡可以同時有很多 thread（在 condition variable 的 queue 裡等），但 **active 的只有一個**。

### Monitor 裡的 condition variable
condition variable 不是拿來解 race 的，但同步時非常常用，monitor 也能結合它：

```
condition x, y;
x.wait();     // 呼叫的 thread suspend（變 inactive），進 x 的 queue
x.signal();   // 從 x 的 queue 叫醒一個；queue 是空的就什麼都不做
```

每個 condition variable 代表一個獨立的 waiting queue。T0 呼叫 wait，變 inactive、去 queue 裡等，裡面沒有 active 的了，外面的 T1 就能進來，再 signal 它，跟 Pthread 的例子一樣。

> **重點** condition variable 跟 semaphore 的 wait／signal 最大的差別：**semaphore 是 counter**，只要 wait 就減 1、只要 signal 就加 1，呼叫幾次就加減幾次，值是 0 時 signal 還是會加上去；**condition variable 是 queue**，wait 是排進 queue 並 suspend，signal 是拿出一個，queue 是空的時候 signal 什麼事都不會發生，沒有「負 1 個人」這種事。

### Dining philosophers 的 monitor 解法
用 monitor 把 method 定義出來，就不用再去想 low level 哪裡會 race。

變數：

- `state[5]`：每個人現在的狀態。**THINKING** 是沒要吃；**HUNGRY** 是想吃但還沒拿到筷子；**EATING** 是左右兩支都在手上。
- `self[5]`：condition variable，hungry 卻拿不到筷子的人放進自己的 queue 等，五個人五個 queue。

解法不能憑空變出筷子：有些錯的程式跑一跑大家都吃到了，結果是用了十根筷子，那不行。另外，這裡讓大家看得到彼此的狀態（global state），比較好解；看不到別人、fully distributed 的情況又難一層。state 是共用的，要想它會不會 race：只有一人寫、其他人讀就不會；兩人以上會改就要保護（這裡由 monitor 保護）。

```c
monitor DiningPhilosophers {
    enum { THINKING, HUNGRY, EATING } state[5];
    condition self[5];

    void pickup(int i) {
        state[i] = HUNGRY;
        test(i);                         // 試試自己能不能吃
        if (state[i] != EATING)
            self[i].wait();              // 不能吃就 suspend
    }

    void putdown(int i) {
        state[i] = THINKING;
        test((i + 4) % 5);               // 左邊的人現在可能能吃了
        test((i + 1) % 5);               // 右邊的人也是
    }

    void test(int k) {
        if (state[(k + 4) % 5] != EATING &&   // 左邊沒在吃
            state[k] == HUNGRY &&             // 他自己想吃
            state[(k + 1) % 5] != EATING) {   // 右邊沒在吃
            state[k] = EATING;
            self[k].signal();                 // 他可能在 queue 裡等，叫醒他
        }
    }

    initialization_code() {
        for (int i = 0; i < 5; i++)
            state[i] = THINKING;
    }
}

// 哲學家 i
DiningPhilosophers.pickup(i);
    eat;
DiningPhilosophers.putdown(i);
```

- 最重要的是 test：**test(k) 測的人不一定是呼叫的人**。putdown 時測的是鄰居，他們可能正被 suspend。
- 能吃的三個條件：左邊不在吃、右邊不在吃（兩支筷子都空著），**而且這個人自己是 hungry**。第三個條件不能漏，因為可能在幫別人測，鄰居有筷子不代表他想吃。
- 鄰居根本沒在等也沒關係，condition variable 的 signal 在空 queue 上什麼都不做。
- 只有 DiningPhilosophers 這個 object 是 monitor，哲學家只是呼叫它 method 的程式。

> **例題** 一開始五人都是 THINKING。
> ```
> 事件                  動作                                         state (P0..P4)
> 初始                  -                                            T T T T T
> P1 pickup             state[1]=H；test(1)：P0、P2 都沒在吃 → E      T E T T T   P1 直接吃
> P2 pickup             state[2]=H；test(2)：左邊 P1 在吃 → 失敗       T E H T T
>                       state[2]≠E → self[2].wait()，P2 在 monitor 裡被 suspend
> P1 putdown            state[1]=T                                   T T H T T
>                       test(0)：P0 是 THINKING，不是 hungry → 沒事
>                       test(2)：P1、P3 都沒在吃，P2 是 H → state[2]=E，self[2].signal()
>                                                                    T T E T T   P2 被叫醒，開始吃
> ```

> **陷阱** 這個解法一次拿兩支筷子，不會 deadlock；但仍可能讓某個哲學家 starvation（左右鄰居輪流吃，他一直等不到兩邊同時空）。

### Java 的 synchronized
這些概念在真實語言裡都包得很好用。

- **synchronized method**：概念就是 monitor，但更 fine-grained。不是整個 class 當成一個 monitor，而是 class 裡任何一個 method 都可以在前面加 synchronized，告訴 compiler 這幾個 method 有同步問題、不能同時執行。一個 class 可能有 10 個 method，你自己決定哪些要 synchronized。但只要加了 synchronized，這些 method 全部互斥，不能像用好幾把 mutex 那樣分成不同組。實際應用不一定每個 method 都要同步，所以這樣比較有彈性。
- **synchronized statement（block）**：把一段程式框起來，前面寫 synchronized 加一個變數，告訴 compiler 這個變數是共用的、會 race；compile 時自動在前面加 lock、後面加 unlock。它比較接近 mutex lock，不太像 monitor。自己用 mutex 也可以，只是這樣程式比較乾淨、好懂。

```java
public synchronized void deposit(int amount) { balance += amount; }

synchronized (obj) {
    // 這段對 obj 互斥
}
```

每個語言放這些工具的方式不同：Java 主要是這兩種，Pthread 則提供 mutex、condition variable 的 API。

## Atomic transaction
**atomic** 意思是不可分割，是形容詞：可以形容 instruction（TestAndSet），可以形容 function（semaphore 的 wait、signal），這裡形容 **transaction**。

- **Transaction** 是一整個流程：一連串 instruction、甚至 function 的集合，把整件事做完的邏輯。最常聽到的是 database，像去 ATM 提款就是一筆 transaction；跨行轉帳可能牽涉兩家銀行的操作，非常冗長，整個包起來叫 transaction。
- 它當然跟同步有關：兩個人同時轉帳，錢只加了一筆；一個存一個領，餘額變 0，沒解好都可能發生。
- **Atomic transaction**：要嘛全部做完，要嘛都不做（**all or nothing**），不能做到一半。做到一半叫 unstable，不知道怎麼接也不知道怎麼恢復。例如存錢失敗，就是金額完全沒動，不能失敗了卻多出 500 塊。
- 不只 database，file system 甚至 OS 也是。跳電後重開機變慢，就是在檢查 file system 的狀態對不對。

### Commit、abort 與 rollback
傳統作法是 **commit** 和 **abort**。做了很多動作之後，最後一定要 commit；沒 commit（abort），前面看起來做了也全部不算，要 **rollback** 回原本的狀態（git 的 commit 就是這個意思）。all 很簡單，難的是 none：做到一半了，要怎麼回到原本的狀態？

### Log
一般靠 **logging**：把每個步驟記在 **stable storage**（不會遺失的儲存）。系統可以 crash，log 絕對不能掉。log 記 transaction 的名稱、時間、動作，最重要的是**資料的舊值跟新值**，才知道怎麼改回去（或重做）。記哪些要設計：記太多，光寫 log 就變慢；記太少，又沒辦法重建。

### Checkpoint
log 沒有時間觀念，金融系統跑了十年，總不能從第一年開始重建。**Checkpoint** 就是系統還原點：記下一個完整、stable 的狀態，壞了就從最近的 checkpoint 接著 log 往下做。file system、database 都這樣做；要跑三個月的大氣模擬這類長時間程式，也會用 checkpoint、rollback、commit 來加快 recovery。

## 重點整理
- 同步問題只發生在共用 resource 的 cooperative process；兩個先決條件：shared data + preemptive scheduling
- counter++ 拆成 load、add、store 三個指令，交錯後結果可能是 4、5、6
- race condition：最後的值取決於最後修改它的人
- critical section 架構：entry（上鎖）→ critical → exit（解鎖）→ remainder
- 三條件：mutual exclusion、progress（空著時要進得去）、bounded waiting（被插隊次數有上限）
- strict alternation（只用 turn）：ME ✓、progress ✗、bounded waiting ✓
- Peterson：`flag[i]=TRUE; turn=j; while(flag[j] && turn==j);`，三條件都成立；turn 一定要交給對方，flag 要緊貼 while
- Bakery：抽號碼 max+1，(num, PID) 小的先；choosing 等對方抽完再比；三條件都成立
- TestAndSet、Swap：atomic 硬體指令；ME ✓、progress ✓、bounded waiting ✗（加 waiting[] 才有）
- critical section 越小越好，包太大會降效率甚至 deadlock
- mutex：lock = entry、unlock = exit；同一份資料用同一把 mutex
- cond_wait 會 release mutex，return 前 reacquire；條件判斷建議用 while
- semaphore = 資源數 counter；wait（P）減 1、signal（V）加 1；binary（0、1）vs counting（任意整數）
- busy waiting（spinlock）浪費 CPU、適合短等待；block／wakeup 適合長等待；value 為負時 |value| = 等待數
- wait、signal 本身必須 atomic；不可把 sleep 包進 critical section
- 排順序：sync = 0，S1; signal(sync) ／ wait(sync); S2；data flow 每條邊一個初值 0 的 semaphore
- wait(S) wait(Q) 與 wait(Q) wait(S) 交錯 → deadlock
- bounded buffer：mutex = 1、empty = n、full = 0；先 wait(empty／full) 再 wait(mutex)
- first RW：第一個 reader wait(wrt)、最後一個 reader signal(wrt)，readcount 用 mutex 保護；writer 可能 starvation
- second RW：writer 優先，reader 可能 starvation
- dining philosophers：全拿左邊 → deadlock；monitor 解法 state + self[5] + pickup／putdown／test，無 deadlock 但可能 starvation
- monitor：method 互斥，只有一個 active thread；CV 是 queue（空 queue signal 無效），semaphore 是 counter
- priority inversion：高 priority 被中 priority 間接延遲；解法 priority inheritance
- atomic transaction：all or nothing；commit／abort／rollback；log（舊值、新值）存 stable storage；checkpoint 縮短 recovery

## 名詞對照
| 中文 | English |
|---|---|
| 同步 | synchronization |
| 獨立的／合作的 process | independent / cooperative process |
| 資料不一致 | data inconsistency |
| 競爭情況 | race condition |
| 臨界區 | critical section |
| 進入區／離開區／剩餘區 | entry / exit / remainder section |
| 互斥 | mutual exclusion |
| 進展 | progress |
| 有限等待 | bounded waiting |
| 飢餓 | starvation |
| 死結 | deadlock |
| 嚴格輪流 | strict alternation |
| 麵包店演算法 | Bakery algorithm |
| 平手判定 | tie breaker |
| 不可分割的指令 | atomic instruction |
| 測試並設定 | TestAndSet |
| 互斥鎖 | mutex lock |
| 條件變數 | condition variable |
| 執行緒池 | thread pool |
| 號誌 | semaphore |
| 二元／計數號誌 | binary / counting semaphore |
| 忙碌等待 | busy waiting |
| 自旋鎖 | spinlock |
| 有界緩衝區 | bounded buffer |
| 讀者寫者問題 | readers-writers problem |
| 哲學家用餐問題 | dining philosophers problem |
| 監視器 | monitor |
| 優先權反轉／繼承 | priority inversion / inheritance |
| 不可分割的交易 | atomic transaction |
| 提交／中止／回復 | commit / abort / rollback |
| 穩定儲存 | stable storage |
| 檢查點 | checkpoint |
