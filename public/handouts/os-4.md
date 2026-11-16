# CPU排程

很多程式都想用 CPU，可是一個 core 一次只能跑一個，總要有人決定現在輪到誰：這就是 CPU scheduler。這一章先講排程的基本觀念（CPU burst、四個排程時機、preemptive 與 non-preemptive、dispatcher、五個評估指標），再一個一個模擬基本演算法（FCFS、SJF／SRTF、Priority、Round Robin、Multilevel Queue、Multilevel Feedback Queue），接著是多處理器與硬體層的排程（SMP、affinity、NUMA、load balancing、hardware thread）、real-time 排程（Rate-Monotonic、EDF），最後看 Solaris、Windows XP、Linux 怎麼把這些想法拼在一起。考試一定要會手畫 Gantt chart，算 waiting、turnaround、response time。

## 學完這章要會
- 說明 CPU burst／I/O burst、CPU-bound／I/O-bound，以及 scheduler 只看 ready queue
- 說出四個排程時機，分辨 preemptive 與 non-preemptive，知道 preemptive 的代價
- 分辨 scheduler 與 dispatcher，說明 dispatch latency
- 寫出 CPU utilization、throughput、turnaround、waiting、response time 的定義與公式
- 對 FCFS、SJF、SRTF、Priority、RR 畫 Gantt chart 並計算平均時間；說明 convoy effect、starvation 與 aging
- 用 exponential average 預測下一個 CPU burst
- 比較 MLQ 與 MLFQ，模擬 MLFQ
- 說明排程演算法的評估方法（deterministic modeling、queueing model、simulation、implementation）
- 說明 SMP、processor affinity、NUMA、push／pull migration、memory stall 與 coarse／fine-grained multithreading
- 模擬 Rate-Monotonic 與 EDF，知道兩者的可排程條件
- 說出 Solaris、Windows XP、Linux 的 priority 範圍方向與排程特色

## 基本觀念

### 為什麼需要 CPU scheduler
multiprogramming 把很多程式放進 memory，P1 到 P5 都 ready 了，可是 core 有限，同一時間一個 core 只能跑一個。scheduler 的任務：**CPU 一空下來，就挑一個 ready 的送上去**，讓 CPU 一直有事做，utilization 才會高。課本叫 process scheduling，但這裡 thread 和 process 不用分那麼細，問的就是：CPU 上的指令來自誰？OS 裡有好幾種 scheduler（job scheduler、mid-term scheduler），這章只管 **CPU scheduler（short-term scheduler）**。

### CPU burst 與 I/O burst
程式任何時刻只做兩件事之一：用 CPU 計算，或做 I/O。把指令攤開：

- 連續好幾條都在用 CPU 的一段，叫 **CPU burst**（從 memory load 資料、加減乘除都算 CPU 的工作）。
- 連續好幾條都在做 I/O（等 I/O 完成）的一段，叫 **I/O burst**。

```
CPU burst → I/O burst → CPU burst → I/O burst → … → CPU burst（結束）
```

連續的 CPU 指令全算同一個 burst，所以兩個 CPU burst 不會相鄰，後面一定接 I/O burst。程式一開始做 I/O，就被放進 waiting queue，這段時間根本沒辦法用 CPU。所以 **CPU scheduler 只管 CPU burst**，正在做 I/O 的程式它完全看不見。

### CPU-bound 與 I/O-bound
想把電腦調快，先找 bottleneck：這支程式主要吃 CPU 還是吃 I/O？

- **CPU-bound**：例如一個 for 迴圈從 1 跑到 1 萬，一直 `i++`，完全不碰 I/O，是超長的 CPU burst。
- **I/O-bound**：沒有很長的 CPU burst。CPU 比 I/O 快太多，幾條指令一下就做完，接著就要等很久的 I/O（例如 `i++` 之後馬上 `fread` 讀檔、再寫出去）。

統計一般程式 CPU burst 長度的 histogram（橫軸是 burst 長度 ms，縱軸是頻率）：最左邊最高，幾乎所有 CPU burst 都非常短；右邊很矮但有長尾，少數 burst 非常長，擁有這種長 burst 的就是 CPU-bound 程式。所以大部分程式其實卡在 I/O，CPU 常常閒著，這正是 OS 要載入一堆程式、大家輪流用 CPU 的原因。

### Scheduler 只看 ready queue
用 process 的五狀態圖看：CPU scheduler 只做一件事，從 ready 那群裡挑一個進 running。程式跑到要做 I/O 的地方，是**它自己**從 running 走到 waiting，不是 scheduler 決定的；它在 waiting 裡，不在 ready queue，scheduler 看不到它。等 I/O 做完回到 ready queue，scheduler 才把它當候選人。

### 四個排程時機
從狀態轉換看，scheduler 能被叫起來重新選人的時機最多四種：

1. **Running → waiting**：正在跑的程式要做 I/O（或 wait 等 child），CPU burst 結束，CPU 空了，一定要選人。
2. **Running → ready**：程式還在跑卻被踢回 ready，例如 time sharing 的 timer interrupt（例如每 100 ms 響一次），OS 拿回控制權重新決定，可能還是選它，也可能換人。
3. **Waiting → ready**：某個程式 I/O 做完回來了，多了一個候選人，說不定它很重要。
4. **Running → terminate**：程式跑完，CPU 空出來，當然要選下一個。

### Preemptive 與 non-preemptive
- **Non-preemptive（不可搶佔）**：程式正在一段 CPU burst 中間、還能繼續跑，就不打斷它。所以只在時機 **1 和 4** 選人，也就是 CPU burst 自然結束的時候。
- **Preemptive（可搶佔）**：四種時機全都會重新排程，2 和 3 是它多出來的機會。

> **例題** 時機 2：P1 跑到一半 timer 響了。preemptive 可以改選別人，P1 被趕回 ready queue，換 P3 上去；non-preemptive 則知道 P1 這段還沒跑完、不能打斷，馬上又把 P1 放回 CPU。
> 時機 3：P2 做完 I/O 回來，priority 比正在跑的 P1 高。preemptive 會叫 P1 立刻讓開、P2 插進來；non-preemptive 先不理 P2，讓 P1 把這段 burst 跑完，P2 才上。

> **重點** 看 Gantt chart 判斷：某個程式的一段 CPU burst 被切成兩段、中間插了別人，就是 preemptive；每一段都剛好是一個完整的 CPU burst，跑完才換人，就是 non-preemptive。

> **陷阱** non-preemptive 的「不打斷」是不打斷**一個 CPU burst**，不是整個程式。程式有很多 burst（例如迴圈裡 `i++` 是 CPU burst、`print(i)` 是 I/O burst），做完一段 burst 去 I/O，回來時重新加入 ready queue，跟當時排隊的人一起重新排。考題可能給「P1 第一個 burst 7，I/O 若干時間後第二個 burst 4」，第二個 burst 要重新排程。

### Preemptive 的代價：synchronization
preemptive 通常效能比較好：它比較 dynamic，隨時能把 CPU 交給更適合的人；排程時機是 non-preemptive 的 superset，CPU 使用率通常更高。

缺點是 **synchronization**：
> **例題** P1 要把 count 加 1，剛把 count = 5 讀進 register 就被打斷；P2 把 count 加成 6 寫回；P1 回來，把它算的 6 寫回。加了兩次，結果是 6 不是 7。

只怕 CPU burst 中間被打斷，因為只有 CPU burst 會讀寫 memory，I/O burst 碰的是裝置。既然會中途打斷，寫程式的人就得自己處理同步，花時間又容易錯。更麻煩的是，kernel 自己的程式也可能改資料改到一半被打斷：

1. kernel 裡每次碰共享資料就自己 lock、unlock：可以解決，但 OS 會寫得又囉嗦又複雜。
2. 跑 kernel 程式時把 timer interrupt 關掉：沒人來打斷，kernel 一口氣做完，對 kernel 來說等於 non-preemptive（**non-preemptive kernel**），自然沒有同步問題。

所以一般 OS 平常用 preemptive scheduler 拿效能，kernel 執行時不讓它被打斷，減輕寫 kernel 的負擔。這也是 kernel 要寫得精簡的原因：寫得又臭又長，interrupt 被關很久，整個系統反應就變慢。（Linux 2.6 之後 kernel 本身也可被搶佔，只在拿著 lock 這類關鍵區段暫時關掉搶佔。）

### Scheduler 與 dispatcher
- **Scheduler**：只負責「選」，決定下一個是誰（例如選了 P2）。
- **Dispatcher**：真的去「換人」，把 CPU 交給 scheduler 選中的 process：
  1. **context switch**：把 P1 的 register 等狀態存進它的 PCB，再把 P2 的 program counter、page table pointer 等載進來
  2. 切換到 user mode
  3. 跳到 P2 程式中正確的位置（上次停的地方）繼續跑

換人不是免費的：從停掉一個程式到啟動下一個花的時間叫 **dispatch latency**，主要花在 context switch，interrupt 的 disable／enable 也要時間。做 context switch、呼叫 scheduler 之前，會先把 timer 關掉，免得換到一半又被打斷。所以 dispatcher 是比較大的元件：先呼叫 scheduler 選人，再完成 dispatch。dispatcher 每次 process 切換都會被呼叫，所以要越快越好。

## 排程的評估指標
| 指標 | 定義 | 目標 |
|---|---|---|
| **CPU utilization** | CPU 忙碌的比例。理論 0～100%，一般系統約 40%～90%，90% 就算很高（Linux 的 top、Windows 工作管理員看得到） | 越高越好 |
| **Throughput** | 每單位時間完成幾個 process（例如丟進 100 個，每秒平均做完幾個）。跟輸入有關，只能拿同樣的輸入比 | 越高越好 |
| **Turnaround time** | 從 submit 到整個結束花多久（使用者角度） | 越短越好 |
| **Waiting time** | 明明可以跑，卻在 **ready queue** 裡等的時間總和；做 I/O 的時間不算 | 越短越好 |
| **Response time** | 從 submit 到**第一次**開始執行（第一個 CPU burst 開始） | 越短越好 |

前兩個是整個系統的角度；比較演算法時，主要看後三個單一 job 的指標。

```
turnaround = completion − arrival
waiting    = turnaround − burst（只有一段 burst 時）
           = turnaround − 所有 CPU burst − 所有 I/O 時間（有好幾段時）
response   = 第一次上 CPU − arrival
```

> **例題** 某 process 在 t = 0 進入系統：0～2 在 ready queue 等，2～4 用 CPU，4～6 做 I/O，6～7 又在 ready queue 等，7～9 用 CPU 後結束。
> - turnaround = 9 − 0 = 9
> - waiting = 2 + 1 = 3（I/O 的 2 不算）
> - response = 2 − 0 = 2

response 只看第一次開始；waiting 要把每次在 ready queue 等的全加起來。像打字、點按鈕這種 interactive 系統最在乎 response time：有回應，使用者就覺得它在動。至於 waiting time，有一個演算法可以證明是最小的：SJF。

## FCFS：First-Come, First-Served
先來先做，用一個 FIFO queue 實作。

> **例題** P1、P2、P3 都在 0 到（P1 稍早一點），這次的 CPU burst 分別是 24、3、3。（只寫一個 24 是簡化，真實程式有很多段 burst，這裡只模擬「現在這一段」。）
> ```
> | P1                      | P2 | P3 |
> 0                         24   27   30
> ```
> waiting：P1 = 0、P2 = 24、P3 = 27，平均 (0 + 24 + 27) / 3 = **17**。
> 每人只有一段 burst，所以 response time 也是 0、24、27。
> 順序若變成 P2、P3、P1：
> ```
> | P2 | P3 | P1                      |
> 0    3    6                         30
> ```
> waiting 變成 P1 = 6、P2 = 0、P3 = 3，平均 (6 + 0 + 3) / 3 = **3**。

> **例題** 延續第一種順序，如果 P1 跑完 24 後做 4 秒 I/O，在 28 秒回到 ready queue，此時 P3 要跑到 30，P1 要等到 30。P1 這次等了 30 − 28 = **2**，不是 30 − 24 = 6，因為 I/O 那 4 秒不算等待。這時 waiting 和 response 就不一樣了。

- FCFS 換成 preemptive 也沒差：就算能打斷，先來的還是先做，所以 FCFS 一定是 non-preemptive 的效果。
- **Convoy effect**：一開始跑個超大的 P1，後面全部從 24 起跳，短工被長工卡住（像一群車跟在慢車後面）。
- FCFS 沒有任何 intelligence，好壞完全看工作到達的順序。

## SJF：Shortest-Job-First
要讓平均等待最短，就**最短的先做**。兩個工作一長（6）一短（2）：長的放前面，短的要等 6；交換後短的在前，長的只要等 2。任兩個換成短的在前，總等待只會變小或不變，所以 **SJF 的平均 waiting time 理論上一定最小（optimal）**。

- 「最短」是指**已經在 ready queue 裡**的人當中最短，還沒到的不算。
- SJF 也分 non-preemptive 和 preemptive；到達時間不同時兩種排出來可能不同。兩種各自是同類中的最佳解，而且 preemptive 的最佳平均等待 ≤ non-preemptive（它選擇的機會比較多）。

> **例題（non-preemptive SJF）**
> | Process | Arrival | Burst |
> |---|---|---|
> | P1 | 0 | 7 |
> | P2 | 2 | 4 |
> | P3 | 4 | 1 |
> | P4 | 5 | 4 |
>
> - t = 0：只有 P1，沒得選。7 看起來很長，但別人還沒來，只能讓它跑，而且一跑就跑到 7。
> - t = 7：P2（4）、P3（1）、P4（4）都在排隊，選最短的 P3，跑 7～8。
> - t = 8：剩 P2、P4 都是 4，平手（tie），先到的 P2 先，8～12；再 P4，12～16。
> ```
> | P1                | P3 | P2         | P4         |
> 0                   7    8            12           16
> ```
> waiting：P1 = 0、P2 = 8 − 2 = 6、P3 = 7 − 4 = 3、P4 = 12 − 5 = 7，平均 (0 + 6 + 3 + 7) / 4 = **4**。CPU 有工作就不讓它閒著的話，任何 non-preemptive 排法都不可能比 4 更小。

SJF 只在平均 waiting time 最好，可能犧牲 response 或 turnaround。例如 P2 第 2 秒到、第 8 秒才開始，response 是 6。有的系統要 response 最小，有的要 waiting 最小，要看需求選演算法。

> **例題（含 idle 與平手規則）**
> | Process | Arrival | Burst |
> |---|---|---|
> | P1 | 1 | 3 |
> | P2 | 2 | 4 |
> | P3 | 1 | 2 |
> | P4 | 4 | 4 |
>
> 用 non-preemptive SJF（選人的 criteria 是 burst time），Gantt chart 一定從 0 開始畫：
> - t = 0：檢查有誰在 0 到？一個都沒有，CPU **idle**，0～1 畫成 idle。
> - t = 1：**先看誰到了**：P1、P3。再比 burst：P3（2）比 P1（3）短，P3 跑 1～3。
> - t = 3：P1（1 到）、P2（2 到）在 ready queue。P1 的 3 比 P2 的 4 短，P1 跑 3～6。
> - t = 6：P2 一直在等，P4 在 4 也到了，兩個都是 4，平手。**平手看 arrival time**：P2 在 2 到、P4 在 4 到，選 P2，跑 6～10。（若連 arrival 也一樣，選 process id 比較小的。）
> - 最後 P4 跑 10～14。
> ```
> | idle | P3   | P1      | P2        | P4        |
> 0      1      3         6           10          14
> ```
> | Process | CT | TAT = CT − AT | WT = TAT − BT | RT |
> |---|---|---|---|---|
> | P1 | 6 | 5 | 2 | 2 |
> | P2 | 10 | 8 | 4 | 4 |
> | P3 | 3 | 2 | 0 | 0 |
> | P4 | 14 | 10 | 6 | 6 |
>
> 平均 turnaround = (5 + 8 + 2 + 10) / 4 = 25 / 4 = **6.25**；平均 waiting = (2 + 4 + 0 + 6) / 4 = 12 / 4 = **3**。
> non-preemptive 時 response time 一定等於 waiting time：一拿到 CPU 就跑完，沒有第二次；只有 preemptive 會把 burst 切開，兩者才可能不同。

> **陷阱** 每到一個時間點，**先檢查誰已經到了，再在到了的人裡面比 burst**；還沒到的不能選。

### Preemptive SJF：SRTF
有新人進 ready queue 就重新比，可以打斷正在跑的。比的是**剩餘時間**，所以課本叫 **SRTF（Shortest-Remaining-Time-First）**。

> **例題** 同一組 P1(0, 7)、P2(2, 4)、P3(4, 1)、P4(5, 4)，改用 SRTF：
> - t = 0：只有 P1，先跑。
> - t = 2：P2 進來要 4；P1 跑了 2、剩 5。4 < 5，P1 被 preempt 回去排隊，P2 上 CPU。之後再比時，P1 是剩下的 5，不是原本的 7。
> - t = 4：P3 進來要 1；P2 剩 2、P1 剩 5。P3 最短，打斷 P2，P3 跑 4～5。
> - t = 5：P4 到要 4，P3 剛好做完。P2 剩 2 最短，P2 跑 5～7 做完。
> - t = 7：P4 的 4 比 P1 的 5 短，P4 跑 7～11；最後 P1 跑 11～16。
> ```
> | P1   | P2   | P3 | P2   | P4        | P1           |
> 0      2      4    5      7           11             16
> ```
> 被打斷時 waiting 不能只看開始時間，用公式最穩：waiting = completion − arrival − burst。
> P1 = 16 − 0 − 7 = 9；P2 = 7 − 2 − 4 = 1；P3 = 5 − 4 − 1 = 0；P4 = 11 − 5 − 4 = 2。
> 平均 (9 + 1 + 0 + 2) / 4 = **3**，比 non-preemptive 的 4 小。

> **陷阱** preemptive 時 response 和 waiting 很容易不一樣：P1 一來就上 CPU，response time 是 0；但它從 2 等到 11，waiting time 是 9。兩個是不同的指標。preemptive 的平均等待較小，代價是 burst 跑到一半 context switch，帶來 synchronization 問題。

### 預測下一個 CPU burst
SJF 理論上最好，實際上做不到：排程在程式跑之前就要決定，沒人知道這段 burst 多長。解法是 **approximate SJF**：看這個程式過去的歷史，猜它下一個 burst 多長，再用猜的值做 SJF。每段 burst 的長度排起來是一串 time series，最簡單的預測是 **exponential average**：

```
τₙ₊₁ = α · tₙ + (1 − α) · τₙ        0 ≤ α ≤ 1
tₙ   ：第 n 個 CPU burst 的實際長度（最近的資訊）
τₙ   ：對第 n 個 burst 的預測（過去的歷史）
τₙ₊₁ ：對下一個 burst 的預測
```

α 決定比較相信最近一次的實際值，還是過去的預測：
- **α = 0**：τₙ₊₁ = τₙ，預測永遠不變，只看歷史。
- **α = 1**：τₙ₊₁ = tₙ，只看上一次的實際值。

為什麼叫 exponential？展開：`τₙ₊₁ = α·tₙ + (1−α)·α·tₙ₋₁ + … + (1−α)ʲ·α·tₙ₋ⱼ + … + (1−α)ⁿ⁺¹·τ₀`，越久以前的值前面乘越多次 (1 − α)，影響力像指數一樣 decay。

> **例題** τ₀ = 10、α = 1/2（最近一次和過去的預測各佔一半，直接相加除以 2）：
> - 一開始完全不知道程式的行為，先猜 τ₀ = 10；實際跑了 t₀ = 6。
> - τ₁ = (6 + 10) / 2 = 8；實際 t₁ = 4。
> - τ₂ = (4 + 8) / 2 = 6；實際 t₂ = 6。
> - τ₃ = (6 + 6) / 2 = 6；實際 t₃ = 4。
> - τ₄ = (4 + 6) / 2 = 5；實際 t₄ = 13。
> - τ₅ = (13 + 5) / 2 = 9；實際 t₅ = 13。
> - τ₆ = (13 + 9) / 2 = 11；實際 t₆ = 13。
> - τ₇ = (13 + 11) / 2 = 12。
>
> | i | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
> |---|---|---|---|---|---|---|---|---|
> | 實際 tᵢ | 6 | 4 | 6 | 4 | 13 | 13 | 13 | … |
> | 預測 τᵢ | 10 | 8 | 6 | 6 | 5 | 9 | 11 | 12 |
>
> 實際值跳到 13 並穩定之後，預測很快就追上了。

只要程式行為有規律（例如迴圈每次做一樣的事），預測最後就會貼近真實值；也可以換更複雜的時間序列預測方法。真實 OS 的想法一樣是 burst 短的優先，但通常不用數學預測，而是用 MLFQ 這類直覺的方法在執行時分類。

## Priority scheduling
每個 process 給一個 priority，scheduler 挑**當下** priority 最高的先做（相同的用 FCFS）。priority 可以一建立就固定（例如 OS 自己的最高、使用者的較低），也可以依執行時的行為往上或往下調。一樣分兩版：跑到一半來了一個 priority 更高的，preemptive 版會打斷正在跑的；non-preemptive 版只是把它放到 ready queue 最前面。

- **SJF 就是一種 priority scheduling**：把 priority 設成（預測的）CPU burst 長度，越短越高。
- 真實的 OS 全都是 priority scheduling：它最 general，什麼規則都能換算成 priority，只是摻雜很多經驗。

> **例題** 五個 process 都在 0 到，數字越小 priority 越高：
> | Process | Burst | Priority |
> |---|---|---|
> | P1 | 10 | 3 |
> | P2 | 1 | 1 |
> | P3 | 2 | 4 |
> | P4 | 1 | 5 |
> | P5 | 5 | 2 |
> ```
> | P2 | P5      | P1                | P3  | P4 |
> 0    1         6                   16    18   19
> ```
> waiting：P1 = 6、P2 = 0、P3 = 16、P4 = 18、P5 = 1，平均 41 / 5 = **8.2**。

> **陷阱** priority 的數字方向各系統不同：恐龍書的慣例是**數字越小越優先**；Solaris、Windows 是數字越大越優先；Linux 是越小越優先。題目先看清楚。

### Starvation 與 aging
priority scheduling 的問題是 **starvation（飢餓）**：P4 priority 很低，又一直有比它高的 P5、P6 插隊，就永遠輪不到，想跑卻一直跑不到，就像餓死一樣（也像貧富不均，窮的人一直翻不了身）。有個真實故事：一台 IBM 大型主機從 1967 年用到 1973 年，退役時才發現有個 low-priority process 從沒被執行過。

解法是 **aging**：每過一段時間它都沒被執行，就把它的 priority 往上加，P4 的 priority 慢慢升高，終於上 CPU。多久加一次、每次加多少只是 policy。所以 priority scheduling 一般都會搭配 aging。

## Round Robin（RR）
大家輪流做，理論上最 fair。RR 控制的是：每次輪到你最多能做多久，這段時間叫 **time quantum**（time slice），例如 100 ms 或 10 ms。quantum 固定，不管 burst 多長，時間一到就讓出來，排到 ready queue 最後面，所以 **RR 本質上是 preemptive**；burst 剩不到一個 quantum 的就提早結束、提早讓出。

> **例題** P1 = 5、P2 = 3、P3 = 4，都在 0 到，q = 2：
> ```
> | P1 | P2 | P3 | P1 | P2 | P3 | P1 |
> 0    2    4    6    8    9    11   12
> ```
> P1 做 2 就被叫停、剩 3；P2 第二輪只剩 1，做 9 就結束。waiting：P1 = 12 − 5 = 7、P2 = 9 − 3 = 6、P3 = 11 − 4 = 7。
> 換人次數：quantum 大過所有 burst（每人一次做完）只換 2 次；q = 2 換 6 次；q = 1 要換 11 次。

- quantum **非常大**（大過所有 burst）：每個人一上去都一次做完，**變成 FCFS**。
- quantum **非常小**（例如 1）：大家一次做一點點，非常公平，但每次換人都有 context switch 成本，**overhead 吃掉效能**。
- 所以一般系統的 quantum 不會非常大也不會非常小。

> **例題** q = 20，P1 = 53、P2 = 17、P3 = 68、P4 = 24，都在 0 到：
> ```
> | P1 | P2 | P3 | P4 | P1 | P3 | P4 | P1 | P3 | P3 |
> 0    20   37   57   77   97   117  121  134  154  162
> ```
> P1 做到 20 下來、剩 33；P2 只要 17，37 提早結束；P3 先做 20；P4 做 20 剩 4；P1 再做 20 剩 13；P3 再做 20 剩 28；P4 做完 4（121）；P1 做完 13（134）；P3 剩下的 28 做到 162。
> 完成時間：P1 = 134、P2 = 37、P3 = 162、P4 = 121。
> - 平均 waiting = (81 + 20 + 94 + 97) / 4 = **73**（P1 = 134 − 53、P2 = 37 − 17、P3 = 162 − 68、P4 = 121 − 24）
> - 平均 turnaround = (134 + 37 + 162 + 121) / 4 = **113.5**
> - 平均 response = (0 + 20 + 37 + 57) / 4 = **28.5**
>
> 同一組用 SJF（順序 P2、P4、P1、P3，完成於 17、41、94、162）：平均 turnaround = (17 + 41 + 94 + 162) / 4 = **78.5**；平均 response = (0 + 17 + 41 + 94) / 4 = **38**。

RR 的平均 turnaround 通常比較高（經驗上，不能嚴格證明）：RR 太公平，大家一起被拉長，沒有人特別快，平均就降不下來（就像 1% 的人擁有 50% 的財富，平均財富看起來就很高；平均要拉開，靠的是少數人特別突出）。但 RR 的 **response time 非常好**：保證輪流，最多等「前面的人數 × quantum」就一定輪到你，上例最多 3 × 20 = 60。

> **重點** 演算法沒有絕對好壞，看用哪個 metric：要 response 好用 RR；要平均 waiting 最小用 SJF。

## Multilevel Queue（MLQ）
實際系統會把基本演算法 mix 在一起。第一種兜法：ready queue 不只一條，而是很多條，每條放不同類型的工作（例如 system processes、interactive processes、batch processes、student processes），重要性不同，管理方式也不同，**每個 queue 有自己的演算法**：interactive 的工作需要 response 好，用 RR；system process（kernel 程式一定要先跑）用 priority scheduling。

**process 一直待在自己的 queue，不會移動。** 但每一刻還是只能選一個人上 CPU，queue 之間怎麼選？

- **Fixed priority（preemptive）**：上層 queue 有人，下層就不能跑（下層可能 starvation）。
- **Time slice**：每個 queue 分到一定比例的 CPU 時間，例如前景 80%（RR）、背景 20%（FCFS）。另一種做法是照權重**機率**決定這次從哪個 queue 拿 job：例如 50% 的機會從 system process 挑，剩下 50% 分給其他 queue（20%、10%、10%、10%），抽中的 queue 最前面的人上 CPU；抽到空的 queue（例如 student 那條沒人）就重抽。這種做法裡，queue 畫成五層但上下沒意義，純看機率。

## Multilevel Feedback Queue（MLFQ）
重點在 **feedback**：OS 在 run time 觀察程式的行為，再決定它該待第幾層。

- queue **上下有意義**：OS 一律從最上面的 queue 挑人，第一個 queue 空了才去第二個拿。
- process **可以在 queue 之間移動**。

為什麼要這樣？很多事要跑了才知道：使用者程式有的一直做 I/O、有的一直算，使用者也不會告訴 OS；但只要跑過，OS 就知道它的 burst 多長、呼叫了哪些 system call，於是能在 run time 幫它分類：

- **上層放 I/O-bound** 的程式（別想反了：最先跑的反而是常做 I/O 的）。I/O-bound 代表 CPU burst 很短，先做它就等於 shortest job first，平均等待最小。看到程式呼叫了 I/O 的 system call，或 burst 真的比較短，就往上提。
- **quantum 用完還做不完**，代表 burst 很長、是 CPU-bound，**往下踢一層**。
- 只從最上層開始跑，其實就是 priority scheduling，一直卡在最下層的會 starvation，所以 MLFQ 一定也有 **aging**：等太久就往上提一層。

### MLFQ 例子
設定：**Q0 用 RR、q = 8；Q1 用 RR、q = 16；Q2 用 FCFS**。
- 新進的 process 先進 Q0。在 Q0 一次最多做 8；8 全用完還沒做完，系統就認定它的 burst 超過 8，降到 Q1。burst 小於 8 的留在第一層（不一定最短，但都比 8 短）。
- Q0 空了才做 Q1。在 Q1 一次最多做 16，用完還沒做完再沉到 Q2。16 以內的中等工作留在第二層。
- 上面兩層都空了，剩下的就是每次 burst 都超過 16 的吃 CPU 程式，在最下層用 FCFS，先來的先排到，比較不會 starvation。
- 前兩層用 RR，大家輪流，也比較不容易 starvation；quantum 上面小、下面大。

> **例題** 四個 process 都在 0 依序進入 Q0，burst：P1 = 30、P2 = 6、P3 = 14、P4 = 3。
> - Q0（q = 8）：P1 0～8（剩 22，降到 Q1）；P2 8～14 做完；P3 14～22（剩 6，降到 Q1）；P4 22～25 做完。
> - Q1（q = 16）：P1 25～41（剩 6，降到 Q2）；P3 41～47 做完。
> - Q2（FCFS）：P1 47～53 做完。
> ```
> | P1 | P2 | P3 | P4 | P1          | P3 | P1 |
> 0    8    14   22   25            41   47   53
> ```
> waiting：P1 = 53 − 30 = 23、P2 = 14 − 6 = 8、P3 = 47 − 14 = 33、P4 = 25 − 3 = 22。短的 P2、P4 很快在第一層做完，執行時自動貼近 SJF。

這樣拼的好處：執行時自動貼近 SJF，又比較不會 starvation；拼法要是反過來（上層 quantum 大、下層小），指標就可能變得很差。程式做完一段 burst 去 I/O 會離開 ready queue，下次回來放回原本那層；這些資訊記在 PCB 專門放 scheduling 資訊的地方。最下層只要上面全空也輪得到。

MLFQ 要設計的參數：
- 幾個 queue
- 每層用什麼演算法（以及 quantum）
- 何時 **upgrade**（升級）
- 何時 **downgrade**（降級）
- process 一開始進哪一層

queue 之間怎麼挑不用設計（一律從上往下）。大部分系統都用 feedback queue，因為它在執行時就能分類，不用靠複雜、有誤差又花時間的數學預測。

| | MLQ | MLFQ |
|---|---|---|
| process 能否換 queue | 不能，固定在一個 queue | 能，依 run time 行為升降 |
| queue 之間怎麼選 | fixed priority 或 time slice（比例、機率） | 一律從最上層開始選 |
| 是否需要 aging | fixed priority 時下層可能 starvation | 需要，等太久往上提 |

> **陷阱** MLQ 與 MLFQ 名字很像但完全不同：MLQ 固定在一個 queue、queue 間照規則（例如比例）挑；MLFQ 會在 queue 間移動、一律從最上層選。

## 怎麼評估排程演算法
scheduling 是任何電腦系統裡都很 fundamental 的機制。評估第一步是**定義 metric**：要 response 最小？waiting 最小？還是 turnaround 最小？（例如「在最大 response time ≤ 1 秒的條件下，CPU 使用率最大」）。接著提出演算法，有的能證明最好，再評估它到底多好：

1. **Deterministic modeling**：把輸入全部給定，一步步手動模擬（例題都是這種）。簡單，但不 general，輸入一改結果就變：FCFS 先短後長很好，先長後短就最糟，只能幫你建立直覺。
2. **Queueing model**：scheduling 本質上就是排隊，可以對應到 queueing theory，用機率分析，得到「有多少比例的機會，等待時間是多少」。例如 Little's formula：n = λ × W（queue 平均長度 = 平均到達率 × 平均等待時間）。但常找不到完全吻合的 model，只好加 assumption，而假設在真實世界不一定成立。
3. **Simulation**：寫一個程式把演算法放進去模擬，餵大量的 workload，例如真實系統的 log（trace）：什麼時候來了哪些 job、burst 怎麼變，看結果好不好。
4. **Implementation**：模擬覺得不錯，最後才真的實作進系統。真實系統有額外 overhead，像 context switch，模擬沒算到，實作才發現 quantum 設太小、切換成本累積很大。

## 多處理器與硬體層的排程

### 軟體排程與硬體排程
前面的排程全在 software level，也就是 OS 管的 ready queue。下面還有真正的硬體，而且是一層層的：主機板上可能有兩個 CPU 插槽（multiprocessor），一顆 CPU 裡有好幾個 core，一個 core 又能同時跑好幾個 **hardware thread**（例如 Intel 的 Hyper-Threading；GPU 一個 core 能跑的更多）。所以排程有兩層：

1. **OS 那一層**：決定哪個 software thread 放到哪個 hardware thread（**logical CPU**）上。硬體說「我有 slot 空了」，OS 就從 ready queue 選一個交出去。前面學的演算法都是這一層。
2. **Core 內部那一層**：一個 core 此刻要執行它的哪一個 hardware thread，由硬體決定。

### Asymmetric 與 symmetric multiprocessing
- **Asymmetric multiprocessing**：其中一顆是 master，管所有 process（排程、I/O、系統資料結構）。OS 選中的全交給 master，再由它分到各個 processor。簡單，但 master 基本上不跑一般程式，使用率可能很低，也可能成為瓶頸。
- **Symmetric multiprocessing（SMP）**：沒有 master，每顆 CPU 自己排程，所有 CPU 一起去拿同一個 ready queue 裡的 process（或各自有 private queue）。一個 process 不能同時在兩顆 CPU 上跑，所以 dequeue 時要 synchronization，確保只有一顆拿到，會慢那麼一點點。一般電腦都是 SMP。

### Processor affinity
**Affinity**：把程式綁在指定的 core 上，一定要在那裡跑，那個 core 被佔著就只能等。好處是 **cache 可以 reuse**：L1 cache 每個 core 各一份不共用，P 一直在 core 0 跑，cache 裡都是它的資料，**cache hit rate**（要的資料剛好在 cache 裡的比例）就高，而 cache 比 main memory 快得多。所以很講究效能、又能控制要跑幾個 process 時，大家都會用 system call 把程式綁在某個 core。affinity 等於在排程上加限制：scheduler 只能把它排到這個 core。

- **Soft affinity**：OS 盡量讓它待在同一個 core，但那個 core 太忙或等太久，還是可以排到別的 core（代價是新 core 的 cache 沒有它的資料，要重抓）。
- **Hard affinity**：無論如何只能在這個 core，寧可等，也不換地方。

### NUMA 與排程
memory architecture 分 **UMA**（存取時間均勻）和 **NUMA**（非均勻）。規模大、processor 多的電腦通常是 NUMA：每顆 CPU 旁邊有一塊比較近的 memory，讀自己旁邊的（local）快，讀別人那邊的（remote）慢。P 在 CPU 0 建立的資料，就在 memory 0；要搬到另一邊就是 memory copy，成本很高。OS 會定期重新排程，若 P 被排到 CPU 1，每次存取都要跨過去，很慢，所以希望把 process 排回它資料那一側的 CPU。寫 thread 程式時也能用 flag 給 OS hint，例如要求記憶體一定在 local，或綁在同一顆 CPU。NUMA 是以 CPU 為單位：同一顆 CPU 上的 core 接同一個 memory bank，跑哪個 core 都沒關係。

### Load balancing：push 與 pull
因為資料有 locality，使用者會想把程式綁在某個 processor；程式一開始放哪個 core 可能是隨機的，但跑了之後有了資料、有了 cache，就想綁在那裡。結果 core 0 的工作越疊越多、大家 wait time 變久，core 3 卻很閒。所以 **affinity（locality）與 load balancing 是 trade-off**：綁得越緊越不平衡。

**Load balancing** 讓每個 core 的工作量差不多（SMP 中每顆 CPU 有自己的 ready queue 時才需要；共用一個 queue 就自然平衡），兩種做法：

- **Push migration**：工作量重的一方主動發起，把工作推給輕的（例如一個專門的 task 定期檢查各 CPU 的負載）。
- **Pull migration**：自己 queue 空了、甚至 idle 的一方主動去找，把工作從忙的 CPU 拉過來。

搬工作一定有 source 和 destination，兩種結果一樣，只差在誰先發起。Linux 兩種都用。選哪種可以看系統 loading：每次問「你能不能接」都是 overhead，希望發起的人越少越好。系統很忙時閒的人少，就讓少數閒的人 pull；系統很閒時忙的人少，就讓少數忙的人 push。

### Memory stall 與 hardware thread
一條指令分好幾個 cycle，其中很重要的一步是存取記憶體。很多 core、很多 thread 共用同一條 memory bus，存取撞在一起就得停下來等，叫 **memory stall**：這時 CPU 根本沒在執行指令，只是卡著等記憶體（cache miss 也會造成 stall）。

所以一個 core 放好幾個 hardware thread（Hyper-Threading 2 個，GPU 甚至 10 個以上）：一個 core 跑很多 thread 不會變慢，因為利用了 stall 的空檔：thread 0 在等記憶體，thread 1 拿來算。把執行和等記憶體 overlap 起來就能塞兩個 thread；再加更多 register，可以塞更多。怎麼利用空檔排另一個 thread 進來，也是排程問題，而且是硬體層級做的。換 thread 時，pipeline 裡還有上一個 thread 的東西：

| | Coarse-grained multithreading | Fine-grained multithreading |
|---|---|---|
| 何時切換 | 只在遇到 memory stall 這類長延遲事件時才切 | 在指令邊界（每個 cycle）就切 |
| 怎麼切 | 把 pipeline flush 掉再換 thread | 像硬體裡的 context switch，多加 register 保留 pipeline 狀態，直接切去沒有 stall 的 thread |
| 切換成本 | 高（清空 pipeline 很花時間） | 低（靠額外硬體） |

這些都在硬體層級；OS 只在乎硬體說現在有幾個可執行的位置，然後給出順序。

## Real-time scheduling
之前的排程用 waiting time 或整個系統的效能衡量；real-time 的定義是**必須在 deadline 之前完成**，重點不是越快越好，而是不能超過期限。一般排程不知道 deadline，real-time 的工作一定會告訴你 deadline。

- **Soft real-time**：盡量避免 miss deadline，只保證重要的工作優先。例如影音串流，有時清楚有時不太清楚，盡量讓你看得到。
- **Hard real-time**：必須保證不 miss。大部分 control system（汽車、武器、核電廠）都是，miss 一次可能就是車子失控。

### Periodic task 的描述
real-time 工作用三個參數描述：
1. **Ready time**（arrival）：什麼時候進系統、開始可以執行。
2. **Execution time t**：就像 CPU burst，每次要跑多久。
3. **Period p**：多久出現下一次 burst；下一次到達的時間點就是這一次的 **deadline d**。

0 ≤ t ≤ d ≤ p。要保證趕上 deadline，工作必須很有規律；完全沒規律根本沒辦法排。例如 period 10、execution 4：每 10 個單位來一個 burst，每次都要在 10、20、30… 之前把這 4 做完。period 一定要比 execution 長，不然一個週期內根本做不完。一個 task 的 CPU 使用率是 t / p。

### Rate-Monotonic（RM）
**static priority** 的 preemptive priority scheduling，priority 依 **period** 決定：period 越短，下一個 burst 越快來，越急，priority 越高（就像寫作業，急的先做）。period 是事先給定的常數，priority 執行時不會變，這就是 static。名字的意思：rate 是頻率（1 / period），monotonic 是單調，rate 越高 priority 越高，等於照 period 由短到長排。RM **完全不管 execution time**：就算某個 task 的 execution 很長，它的 priority 也只看 period。

> **例題** 三個 task，arrival 都從 0，tuple 是（period, execution）——注意題目的 tuple 順序要看清楚：
> T1 = (4, 1)、T2 = (5, 2)、T3 = (20, 5)。period 4 < 5 < 20，所以 priority：T1 > T2 > T3。
> - 0～1：T1 做完這一輪（下一次在 4 才來）。
> - 1～3：T2 做完這一輪（下一次在 5）。
> - 3～4：只剩 T3，做 1 個單位。
> - 4～5：T1 又來了，priority 最高，**preempt** T3。
> - 5～7：T2 剛好在 5 也來了，比 T3 高。
> - 7～8：沒有更高的人，T3 再做 1（累計 2）。
> - 8～9：T1 第三次到達，做 1。
> - 9～10：T2 要到 10 才來，T3 做 1（累計 3）。
> - 10～12：T2；12～13：T1（12 到達）。
> - 13～15：T3 做完剩下的 2（累計 5），趕上 deadline 20。
> ```
> |T1|T2   |T3|T1|T2   |T3|T1|T3|T2   |T1|T3   |
> 0  1     3  4  5     7  8  9  10    12 13    15
> ```
> 這組的 CPU 使用率 = 1/4 + 2/5 + 5/20 = 0.25 + 0.4 + 0.25 = 0.9。

RM 的可排程條件：N 個 task 時，若總使用率 ≤ **N(2^(1/N) − 1)**，就保證排得完（N = 1 是 100%，N = 2 約 83%，N = 3 約 78%，N 很大時趨近 69%）。上例 0.9 超過 78% 卻還是排得完，因為這個上界只是**充分條件**。RM 是 static，有不少缺點，排出來的結果不一定特別好。

### Earliest-Deadline-First（EDF）
**dynamic priority**：看「當下」誰的 deadline 最近，越近 priority 越高。就像寫作業：看哪份 deadline 最近，剩三天的先做。注意 **period 長不代表 deadline 遠**：很早公布、期限很長的作業，放著放著也會只剩兩天。每當有新的 task 進 ready queue（下一個 period 到了），就要重新決定一次 priority。

> **例題** T1：period 2、execution 0.9；T2：period 5、execution 2.3。
> - t = 0：T1 的 deadline 是 2，T2 是 5，T1 先做 0～0.9。
> - 0.9～2：T2 做了 1.1，還剩 1.2。（T1 這一輪做完 0.9 就離開 ready queue。）
> - t = 2：新的 T1 來了，deadline 4；T2 的 deadline 還是 5。T1 比較急，preempt T2，做 2～2.9。
> - 2.9～4：T2 又做了 1.1，剩 0.1。
> - t = 4：T1 又來了，可是這次倒過來：新 T1 的 deadline 是 6，T2 是 5，**T2 比較早**，所以 T2 繼續做完剩下的 0.1，到 4.1。
> - 4.1～5：T1 做 0.9，在 deadline 6 之前完成。
> ```
> | T1  | T2   | T1  | T2   |T2| T1  |
> 0     0.9    2     2.9    4  4.1   5.0
> ```
> 第 2 秒 T1 比較高，第 4 秒卻換 T2 比較高：完全看當下誰的 deadline 趕。考試特別小心 0.9、1.1、0.1 這些長度的計算。

EDF 的結論：只要 CPU 總使用率 ≤ 100%（不計 context switch 成本），EDF 理論上每個工作都趕得上。（上例使用率 0.9/2 + 2.3/5 = 0.45 + 0.46 = 0.91。）

| | Rate-Monotonic | EDF |
|---|---|---|
| Priority | static，依 period（越短越高） | dynamic，依當下 deadline（越近越高） |
| 可排程條件 | 使用率 ≤ N(2^(1/N) − 1) 保證可排（充分條件） | 使用率 ≤ 100% 即可 |
| 特性 | 簡單，但不一定最好 | 理論上最佳，每次有新 task 都要重算 |

## 實際 OS 的排程
大部分真實 OS 都 based on priority，因為它最通用；它們都是把 priority、shortest job、multilevel feedback 的想法拼在一起。每個 process 一建立就有 priority（在 Linux 打 top 就看得到每個程式的 priority 或 nice 值）。

### Solaris
- priority 0～169，**數字越大越優先**。
- process 分成六大類 **priority class**，每類對應一段 priority 範圍：

| Class | Priority 範圍 |
|---|---|
| Interrupt threads | 160～169（最高） |
| Real-time（RT） | 100～159 |
| System（SYS） | 60～99 |
| Fair share、Fixed priority、Time sharing、Interactive | 0～59（共用這段，所以不同 class 的 priority 可能一樣） |

- process 不能隨便選 class：建立時 OS 依 policy 或提示決定它屬於哪類，放進去就一直待著，不會跳來跳去。
- 每個 class 有自己的排程演算法（有點像 multilevel queue），結果都轉成「在自己範圍裡升降」。
- 整個 OS 只看 **global priority**：數字最大的先做；同一個 priority 的多個 process 之間用 RR。
- 60 以上的 system process，priority 一建立就固定。使用者的 process 難預測，所以 Solaris 有一張 **dispatch table**（time sharing／interactive class 用），每一列是一個 priority：

| Priority | Time quantum | 用完 quantum 後的新 priority | 從 sleep 回來的新 priority |
|---|---|---|---|
| 0 | 200 | 0 | 50 |
| 20 | 120 | 10 | 52 |
| 30 | 80 | 20 | 53 |
| 59 | 20 | 49 | 59 |

讀表：
- **priority 越高，quantum 越小**（59 只有 20 ms）：高 priority 的應該是短工作，給你高 priority，但只能做 20 ms 就換人。
- **用完 quantum** 還沒做完：系統認為你不夠短，**降低** priority（59 → 49）。壞處是比較難輪到；好處是輪到時 quantum 比較長，正適合 CPU-bound 的程式。
- **從 sleep／waiting 回來**：priority **提高**（例如 20 → 52）。它待在 waiting 代表沒在用 CPU，很可能是 I/O-bound（純粹是系統工程的經驗）。

結果：CPU-bound 慢慢沉下去，I/O-bound 慢慢浮上來；高 priority 配小 quantum，跟 MLFQ 例子上層 8、下層 16 的設計非常像。

### Windows XP
- priority 0～31，**數字越大越優先**（priority-based、preemptive）。
- 6 個 priority class：real-time、high、above normal、normal、below normal、idle；每個 class 裡再分 7 個 relative priority（time-critical、highest、above normal、normal、below normal、lowest、idle）。class 和 relative priority 交叉出來的數字就是最後的 priority。
- 一樣依執行情況調整：CPU 用得多（quantum 用完）往下降，I/O 做得多（從 wait 回來）往上升，但每個 class 只在自己那七個數字之間跳，不會低於該 class 的 base priority。
- **唯一不跳的是 real-time class**：priority 是 static，範圍 16～31，最低也有 16。
- 一樣看 global priority，最高的先；priority 相同的放同一個 queue，用 RR 輪流。

### Linux（2.6 版）
- priority 0～140，**數字越小越優先**（跟 Solaris、Windows 相反）。
  - 0～99：real-time task，priority 固定。
  - 100～140：一般使用者 task（nice 值），執行時依互動程度調整。
- 每個 priority 也對應一個 quantum，但**跟 Solaris 相反：priority 越高，quantum 越長**（最高約 200 ms，最低約 10 ms）。
- 特色是兩個 list：**active array** 和 **expired array**。
  - 其他 OS 是輪到你就跑一個 burst；給你 200、你這段只做 100，剩下的就浪費了。Linux 認為不公平：給你 200 就讓你用完。task 做完一段 burst 還有剩餘 quantum（例如還剩 100、之後剩 40），就留在 active array，還能再被執行。
  - quantum 用完（剩 0），就放到 expired array，這一輪不能再跑。task 移到 expired 時，依它的互動程度重算 priority（sleep 越久越像 I/O-bound，priority 越高）。
  - 等 active 全空了（大家都用完 quantum），就把兩個 array 的 pointer **交換**，expired 變成新的 active。
- 所以每個人每一輪都真的用滿自己的 quantum，等於照 quantum 的比例分配執行時間。

| | Solaris | Windows XP | Linux 2.6 |
|---|---|---|---|
| Priority 範圍 | 0～169 | 0～31 | 0～140 |
| 方向 | 越大越優先 | 越大越優先 | 越小越優先 |
| Real-time | 100～159 | 16～31（static） | 0～99（static） |
| 高 priority 的 quantum | 較短 | — | 較長 |
| 特色 | priority class + dispatch table | 6 class × 7 relative priority | active／expired array 交換 |

## 重點整理
- CPU scheduler 只管 ready queue 裡的 CPU burst；多數 CPU burst 很短，少數長的是 CPU-bound。
- 四個排程時機：running→waiting、running→ready、waiting→ready、terminate。non-preemptive 只在 1、4；preemptive 四種都會。
- preemptive 效能較好但有 synchronization 問題；kernel 常關 interrupt 讓自己 non-preemptive。
- Scheduler 選人，dispatcher 換人（context switch、切 user mode、跳到正確位置）；dispatch latency 是換人的時間。
- turnaround = 完成 − 到達；waiting = turnaround − burst（− I/O）；response = 第一次上 CPU − 到達。non-preemptive 時 response = waiting（單一 burst）。
- FCFS：non-preemptive 效果，convoy effect；24、3、3 平均等 17，換順序只要 3。
- SJF：平均 waiting 最小（optimal），但要知道 burst 長度；平手看 arrival，再看 PID。SRTF 比剩餘時間。P1(0,7) P2(2,4) P3(4,1) P4(5,4)：SJF 平均 4、SRTF 平均 3。
- 預測：τₙ₊₁ = α tₙ + (1 − α) τₙ；α = 0 只看歷史、α = 1 只看上次。
- Priority：SJF 是特例；starvation 靠 aging 解；數字方向看題目（恐龍書越小越優先）。
- RR：preemptive；q 太大變 FCFS、太小 context switch overhead 大；平均 turnaround 較高，但 response 好，最多等 (n − 1) × q。
- MLQ：process 固定在 queue，queue 間用 fixed priority 或 time slice；MLFQ：依行為升降、從最上層選、上層放 I/O-bound、quantum 用完就降級、要 aging。
- 評估：deterministic modeling、queueing model（Little's formula n = λW）、simulation、implementation。
- SMP 每顆 CPU 自己排程；affinity 提高 cache hit rate（soft／hard）；NUMA 要排在資料旁邊；affinity 與 load balancing 是 trade-off；push／pull migration。
- Memory stall → 一個 core 多個 hardware thread；coarse-grained 遇長延遲才切、要 flush pipeline；fine-grained 指令邊界就切、成本低。排程兩層：OS 排到 logical CPU，core 選 hardware thread。
- Real-time：soft 盡量、hard 保證。RM：static，period 越短越優先，使用率 ≤ N(2^(1/N) − 1) 保證可排；EDF：dynamic，deadline 越近越優先，使用率 ≤ 100% 即可。
- Solaris：0～169 越大越優先，高 priority 小 quantum，用完 quantum 降、sleep 回來升。Windows XP：0～31 越大越優先，real-time 16～31 static。Linux 2.6：0～140 越小越優先，高 priority 長 quantum，active／expired array。

## 名詞對照
| 中文 | English |
|---|---|
| CPU 排程 | CPU scheduling |
| 短期排程器 | short-term scheduler (CPU scheduler) |
| CPU 突發／I/O 突發 | CPU burst / I/O burst |
| CPU 密集／I/O 密集 | CPU-bound / I/O-bound |
| 可搶佔／不可搶佔 | preemptive / non-preemptive |
| 分派器 | dispatcher |
| 分派延遲 | dispatch latency |
| CPU 使用率 | CPU utilization |
| 產出量 | throughput |
| 回轉時間 | turnaround time |
| 等待時間 | waiting time |
| 回應時間 | response time |
| 甘特圖 | Gantt chart |
| 先來先服務 | first-come, first-served (FCFS) |
| 護航效應 | convoy effect |
| 最短工作優先 | shortest-job-first (SJF) |
| 最短剩餘時間優先 | shortest-remaining-time-first (SRTF) |
| 指數平均 | exponential average |
| 優先權排程 | priority scheduling |
| 飢餓 | starvation |
| 老化 | aging |
| 輪流排程 | round robin (RR) |
| 時間配量 | time quantum / time slice |
| 多層佇列 | multilevel queue (MLQ) |
| 多層回饋佇列 | multilevel feedback queue (MLFQ) |
| 確定性模型 | deterministic modeling |
| 排隊模型 | queueing model |
| 模擬 | simulation |
| 非對稱／對稱多處理 | asymmetric / symmetric multiprocessing (SMP) |
| 處理器親和性 | processor affinity |
| 軟／硬親和性 | soft / hard affinity |
| 負載平衡 | load balancing |
| 推／拉遷移 | push / pull migration |
| 記憶體停滯 | memory stall |
| 硬體執行緒 | hardware thread |
| 邏輯 CPU | logical CPU |
| 粗粒度／細粒度多執行緒 | coarse-grained / fine-grained multithreading |
| 即時排程 | real-time scheduling |
| 軟性／硬性即時 | soft / hard real-time |
| 週期性工作 | periodic task |
| 截止時間 | deadline |
| 速率單調排程 | rate-monotonic scheduling (RM) |
| 最早截止時間優先 | earliest-deadline-first (EDF) |
| 優先權類別 | priority class |
| 分派表 | dispatch table |
| 活動陣列／過期陣列 | active array / expired array |
