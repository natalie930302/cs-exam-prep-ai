# Thread與並行

現在的電腦都是多核心，計算量又越來越大，程式一定要平行；最容易拿到的平行方式就是 thread（執行緒）。這一章很短，但很常考也很常用：thread 和 process 差在哪（哪些共用、哪些私有）、為什麼要用 thread、user thread 和 kernel thread 的關係與三種 multithreading model、pthread 怎麼寫、Linux 怎麼用 clone 實作 thread，以及在 thread 裡呼叫 fork、cancel thread、signal、thread pool 這些使用上的 issue。

## 學完這章要會
- 說出同一個 process 的 threads 共用什麼（code、data、heap、open files）、各自有什麼（thread ID、PC、registers、stack）
- 舉例說明 multithreading 的用途與四個好處（responsiveness、resource sharing、scalability、economy）
- 說出 multicore programming 的五個挑戰
- 分辨 user thread 與 kernel thread，比較 many-to-one、one-to-one、many-to-many（與 two-level）的優缺點
- 寫出 pthread 的 create／join／detach，說明 pthread_create 的四個參數
- 說明 Java thread 怎麼對到底層、Linux 的 clone 怎麼建 thread
- 回答 threading issues：thread 裡 fork 複製幾個 thread、asynchronous 與 deferred cancellation、signal 交給誰、thread pool 的好處

## Thread 是什麼
**Thread** 又叫 **lightweight process（輕量級 process）**：光看名字就知道它跟 process 的界線很模糊，不是完全不同的東西，只是比較「輕」。一個完整的 process 有 code、data、files、stack；把其中一些跟別人共用，就變成 thread。所以 process 比較像一個**容器**，把 thread 裝在裡面。

真正在 CPU core（CPU 裡能獨立執行指令的核心）上算東西的是 thread：一個 process 可以拆成很多 thread，每一個都能被放到 core 上跑，所以正在用某個 core 的，其實是「某個 process 的某個 thread」。這就是那句定義：**thread 是 basic unit of CPU utilization（使用 CPU 的最基本單位）**。直覺地說，thread 就是程式裡一條正在跑的執行路線。

### 共用的部分：code、data、resources
「輕」輕在哪？要從 memory content 看。同一個 process 裡的 threads **共用 code section、data section（global variable）、OS resources（例如開啟的檔案）**，T1、T2 都指向同樣這幾塊。這是現代大部分 OS 對 thread 最基本的定義。

用 segmentation 的角度看更清楚：code、data 這些是不同的 segment，segment table 裡一個 segment 記一列位置。create 一個 thread，只要讓新 thread 的 segment table 指到同樣的 segment 就共用了，不用另外複製一份，所以叫 lightweight。也因此同一個 process 的 threads 關係非常緊密。

### 每個 thread 私有的部分
```
   single-threaded process          multithreaded process（3 個 thread）
 ┌──────┬──────┬──────┐          ┌──────┬──────┬──────┐
 │ code │ data │files │          │ code │ data │files │   ← 共用
 ├──────┴──────┴──────┤          ├──────┼──────┼──────┤
 │ registers │ stack  │          │ reg  │ reg  │ reg  │   ← 每個 thread 一份
 └───────────┴────────┘          │stack │stack │stack │
         │                       └──────┴──────┴──────┘
       thread                       │      │      │
                                 thread thread thread
```

每個 thread 要能獨立執行，「執行用的部分」就不能共用：

- **Thread control block（TCB）**：process 有 PCB 記狀態，thread 也有對應的 TCB。Linux 和教學用的 Nachos 不特別區分，用同一種結構管 process 和 thread，比較好維護；Windows 比較複雜，TCB 和 PCB 的內容不同。
- **Thread ID**：control block 管的是一個執行單位，所以每個 thread 有自己的 ID。
- **Program counter**：記錄下一行要執行哪裡。每個 thread 有自己的 PC，就能跑到不同位置、做完全不同的事；不同 thread 通常在跑不同的 function。
- **Registers**：各自執行，CPU 裡存中間值的 register 當然各自一份。
- **Stack**：stack 放 local variable。大家跑同一個 function、程式裡都叫 `i`，其實指到不同的記憶體位址；function 一 return，local variable 就沒了。所以每個 thread 有自己的 stack。

data 除了 global variable，還有 **heap**（malloc 動態配置出來的記憶體），這些都是**共用**的。

| 同一個 process 的 threads 共用 | 每個 thread 私有 |
|---|---|
| code section | thread ID（TCB） |
| data section（global variable） | program counter |
| heap（malloc 的記憶體） | register set |
| OS resources（open files、signals 等） | stack（local variable） |

> **陷阱** 考試最愛把 heap 和 stack 放錯邊：**heap 共用、stack 私有**；thread ID、PC、registers 也私有。

### 寫程式時怎麼分辨
```c
int g;                      // global：在 data section，所有 thread 共用

void *work(void *arg) {
    int i;                  // local：在這個 thread 的 stack，各自一份、互不干擾
    int *p = malloc(sizeof(int));  // p 本身在 stack；p 指到的空間在 heap，共用
    ...
}
```

把 pointer（例如 malloc 出來的位址、global 變數的位址）傳給別的 thread 用，也不會 segmentation fault，因為 data 和 heap 本來就共用，位址有效。OS 實作上可能用同一套東西管 thread 和 process，看起來有點混；但對 programmer 來說，兩者是完全不同的 programming model。

## 為什麼要用 thread
很多事一定要靠 multithreading 才做得到：

- **Web browser**：開網頁時文字很快就出來，圖片過一下才跳出來，因為 browser 用了好幾個 thread：文字、每一張圖各自用一個 thread 下載，下載完再顯示。
- **Web server**：要接很多 request，每個通常很小。main thread 一直在等；一接到 connection 就 create 一個新 thread 處理這個 request，main thread 馬上回去等下一個，大家都能不斷連進來。不用 multithreading 的話，一個人的 request 就可能卡住所有人，看起來就像 denial of service。
- **RPC server**：讓很多人同時呼叫它的 function，client 連進來就用新的 thread 接 request，main thread 繼續 loop 等。處理可以慢，但連線要馬上接起來。

### 四個好處
1. **Responsiveness（反應快）**：server 能很快回應每個 connection，不會因某個 request 卡住整台、拖慢 response time。互動遊戲也是：例如「青蛙過河」，一個 thread 控制車流、另一個 thread 接鍵盤輸入，各自獨立、各自很快反應，必要時（青蛙被車撞到）又能溝通。
2. **Resource sharing（資源共享）**：不同 process 為了 protection，記憶體彼此不共用，要溝通得透過 OS 轉交，很慢；同一個 process 的 thread 直接讀寫共用的 global variable，預設就能共享資料。
3. **Scalability（用滿多核心）**：現在的電腦全是 multi-core，甚至多顆 CPU、放到 cloud 上就是好多台電腦。要把這些資源用滿，就得讓每個 core 都有 thread 在跑，不然 core 就白白浪費。
4. **Economy（經濟）**：用 process 也能用多核心，那差別在哪？在成本。process 做什麼都要透過 OS，memory content 也多很多，建 process 要配記憶體、準備管理結構；thread 只要多一組 registers 和 stack。

> **例題** 實驗比較：用 `fork` 建 process 與用 `pthread_create` 建 thread，thread 快了 20 幾倍到 50 倍。溝通也差很多：process 之間用 MPI（message passing 的 library）send、receive 要做 memory copy；thread 用 shared memory，寫進 global variable 再讀出來就好，即使在同一台電腦上，效能也能差 2 倍到 15 倍。

所以能用 thread 做的就別用 process。什麼時候非用 process 不可？溝通的兩方根本是不同系統、不同 application，不可能混在一起的時候。如果只是想把自己的工作平行加速、大家在解同一個問題，就用 thread。

### 軟體與硬體一起走向多核心
- **Software**：multithreaded programming，用 Pthread、Java thread 這類 library 寫。
- **Hardware**：multi-core、多 CPU。

兩邊相輔相成：正因為有 thread programming，硬體才一直加核心。所謂 **death of CPU scaling**：以前電腦變快主要靠把時脈（GHz）往上加，製程到了瓶頸加不上去，現在比的是有幾個核心。手上有多核心、程式卻沒用 thread，就跑不贏人家。

對 OS 來說，接下來的問題是 thread 要跟哪個 core 做 binding。而且有些排程已經拆進 CPU 裡：例如 Intel 的 **Hyper-Threading** 讓一個 core 同時跑兩個 thread。所以 scheduling 有好幾層：OS 在排，CPU 內部、甚至單一 core 也在做硬體層的排程。thread 最後會落到最底層某個硬體執行單位上，中間隔了好幾層，就像 virtual address 要轉成 physical address。

## Multicore programming 的五個挑戰
thread programming 是 parallel programming 的一種（另一種是 message passing），問題相同，只是技巧不同。

1. **Dividing activities（identifying tasks，拆分工作）**：用 thread 就是把一件事拆給很多人做，前提是先拆得開。像分組作業：你寫 report、我寫 code、你做 survey、我跑實驗。不是每個問題都拆得開，拆法影響很大，拆不好就全卡在某一個人身上。
2. **Data splitting（資料切分）**：電腦做的事說穿了是 compute on data，計算要拆，資料也得跟著拆。例如平行排序 10 個 element、5 個 thread，每人平分兩個就好嗎？不一定，每筆資料的計算量可能不同。換成 graph 更麻煩：要讓每份的 vertex 數一樣，還是 edge 數一樣？
3. **Data dependency（資料相依）**：兩個 thread 要改同一筆資料，或第二個得等第一個改完，這時很難切，切了還可能算錯。
4. **Balance（load balancing）**：整個程式什麼時候結束，取決於最後做完的那個人；工作不平均，就等於沒平行。而且很多執行時間要跑了才知道，事先預測不了。
5. **Testing and debugging**（幾乎無解）：GDB 這類 debugger 可以 watch 變數、一步步 trace，但基本上只適用 sequential code。跨 core、跨電腦同時跑，很難一次追蹤全部；每個 thread 都照步驟做，誰先誰後一換，結果就不一樣。這個先後順序的問題，就是 synchronization 那一章要解決的。

## User thread 與 kernel thread
就像 process 分 user mode 和 kernel mode，thread 也分兩層：

- **User thread**：在 user space，就是 thread library（放在 API 那一層），例如 **POSIX Pthreads、Java threads、Win32 threads**。programmer 寫程式直接用的就是這些。
- **Kernel thread**：在 OS 裡面，是 OS 真正在管、在排程的單位；前面說「使用 CPU 的最基本單位」其實就是指它。每個 OS 都有自己的 kernel thread。

兩者是 **binding（mapping）** 的關係：你呼叫 API 建的是 user thread；它要執行時，OS 把它 bind 到某個 kernel thread 上才真正跑得起來。任何 user thread 要執行，都一定得掛在某個 kernel thread 上。而且 binding 在 run time 可以換：它去做 I/O 離開 CPU、回到 ready queue 再被排到時，可能改綁另一個。programmer 不用管 kernel thread；設計 OS 的人管的就是這些。

| | User thread | Kernel thread |
|---|---|---|
| 位置 | user level（thread library） | kernel 裡 |
| 速度 | 快：不碰 system call，就不用 interrupt、不用找 OS；create 快、好管理 | 慢：kernel 裡凡事都要經過 protection 等機制 |
| 被 block 時 | 若大家綁同一個 kernel thread，一個 block 全部卡死 | 彼此獨立，一個被 block 其他照常（就像不同 process 互不影響） |

為什麼有了快的 user thread 還需要 kernel thread？如果 kernel 這邊只有一個 thread，上面 create 了一堆 user thread 全部 bind 到同一個 kernel thread，只要其中一個進 kernel 做 I/O 或 sleep 把自己 block 住，大家共用的那個 kernel thread 就被卡死，誰都動不了。你以為開了一堆 thread，其實只是假象，頂多寫程式方便。「一個被 block 其他照常」這個特性，只有 kernel level 的 thread 才有。

## Multithreading models
OS 要決定 user thread 和 kernel thread 怎麼對應，而且不管怎麼對都得保證正確，於是有三種 model。

### Many-to-One
```
user:    U1   U2   U3   U4
           \   \   /   /
kernel:         K1
```
所有 user thread 都對到同一個 kernel thread。通常從 process 的角度看：一個 process 開一堆 thread，OS 只看到這個 process，就給它一個 kernel thread。同一時間只能有一個 user thread 掛上去，輪流使用。

- thread 全在 user space 管理、不進 kernel，所以**沒有 mode switch**（user、kernel mode 間的切換）。注意 **context switch 還是有的**：停下這個 thread、改跑那個，只是沒有 mode switch。
- 優點：thread creation 和 context switch 都非常快（不用 system call、不用 mode switch）。
- 缺點一 **blocking**：正在跑的 thread 一 block，整個 process 都被 block。因為 kernel 根本不知道這個 process 被分成好幾個 thread，它以為「這就只是一個 process」。
- 缺點二 **沒有 parallelism**：一次只有一個 thread 能用 kernel。電腦有 4 個 core，你在同一個 process 開 4 個 thread，它們從來沒有同時跑過。
- 但 global variable 的 sharing 還在，responsiveness 也做得到，所以用途不一樣。比較像傳統 process 的觀念，只是多了 thread 之間的 resource sharing。

### One-to-One
```
user:    U1   U2   U3   U4
         |    |    |    |
kernel:  K1   K2   K3   K4
```
**each user thread maps to exactly one kernel thread**。兩者其實是不同的東西，只是為了好實作、好管理，單純地一對一，用的時候完全沒感覺。

- 優點：**true parallelism**（每個 thread 都能在多核心上真的同時執行）；**沒有 blocking issue**（一個 block 了，其他不會被拖下水）；concurrency 最高。
- 缺點：**overhead 較高**（建 thread 時 kernel 也得參與，建出對應的 kernel thread；creation 和 context switch 會有 mode switch，比 many-to-one 貴）；kernel thread 要有 control block 等管理資料，所以 **OS 通常限制數量**（就像能開的 file 數量有上限）。

> **例題** 若 OS 最多只能建 100 個 kernel thread，在 one-to-one 下同時就只能跑 100 個 user thread。很多人以為 thread 可以無限開、寫錯程式就開一個；在 one-to-one 下這樣做可能把整個系統卡住。

### Many-to-Many
```
user:    U1   U2   U3   U4
          \  / \  / \  /
kernel:    K1   K2   K3
```
把多個 user thread 對到**較少或相等數量**的 kernel thread（kernel thread 數 ≤ user thread 數），沒有固定的對應，在 run time、每次 thread 要執行前才決定。

> **例題** 4 個 user thread 共用 3 個 kernel thread。其中一個被 block，它就占住一個 kernel thread；剩下 3 個 user thread 輪流用另外 2 個 kernel thread，繼續跑。只要不卡在同一個，其他人就能動。

- 優點：true parallelism；沒有 blocking issue；**scalability 比 one-to-one 好**（不是一個綁死一個，可以 assign 給任何一個）；最有彈性；kernel 還能自己決定要幾個 kernel thread（很多 user thread 都很輕的話，全交給一個處理，整體效能反而最好）。
- 缺點：設計與實作最複雜，thread scheduling 難，OS 比較容易出錯；creation 和 context switch 一樣比較貴（kernel 參與、有 mode switch）；管理 overhead 大，使用情境單純時多花時間管理卻換不到效能，不划算。

**Two-level model**：基本上是 many-to-many，但允許某個 user thread 直接綁定（bound）一個 kernel thread。

### 三種 model 比一比
| | Many-to-One | One-to-One | Many-to-Many |
|---|---|---|---|
| 對應 | 一個 process 的所有 user thread → 1 個 kernel thread | 1 個 user thread → 1 個 kernel thread | n 個 user thread → ≤ n 個 kernel thread |
| Thread 管理 | user space（建 thread 不建任何 kernel thread） | kernel 參與 | kernel 參與，run time 動態 mapping |
| 建立／切換速度 | 最快（無 mode switch） | 較慢 | 較慢 |
| 一個 thread block | 整個 process block | 其他不受影響 | 其他不受影響 |
| 多核心平行 | 不行 | 可以，concurrency 最高 | 可以 |
| 主要缺點 | blocking、無法利用 multiprocessor | thread 數量受 kernel 限制 | 實作複雜、overhead 大 |
| 實際使用 | 少見（硬體資源有限的 embedded device） | 最常見：**Linux、Windows** | 部分系統 |

> **重點** 大部分 OS 用 one-to-one：現在資源多，大家更在意好寫、不互相影響；OS 本來就不想太複雜，太複雜不好 debug，一般情況下整體效能反而變慢。

## Thread library 與 shared-memory programming
thread programming 是一種平行程式。平行程式依溝通方式（從記憶體看）分兩種：**shared memory programming** 和 **message passing programming**。thread 屬於 shared memory：

- 有一塊所有 thread 都讀得到的記憶體：global memory，包括 data segment 和 heap。
- 每個 thread 也有自己 private 的空間：local variable，在 stack 裡，別人拿不到。
- 溝通用 global variable 或 malloc 出來的 pointer：一個 thread 寫進去，另一個讀出來。

| | 優點 | 缺點 |
|---|---|---|
| Shared memory（thread） | 不用 memory copy，通常比較快 | synchronization、deadlock：大家隨時能寫同一塊記憶體，可能互相覆蓋，順序一變結果就變。有時為了保證正確，花的時間比省下的還多 |

**Shared memory programming 的三種寫法：**
1. **用 thread** 做 memory sharing（本章重點）。
2. **Process 之間**也能 shared memory：透過 OS 在 run time 建 segment，告訴 OS 這塊要給多個 process 共用。但 process 比較 heavy，很多東西要透過 OS 才能共用；thread 預設就共用 global variable，比較快。
3. **Compiler directive**：在程式碼裡加 directive，告訴 compiler 這一塊要平行化，它就幫你轉成 multithreaded program。最省力、從 porting 的角度也最多人用，但程式碼一定要很有規律才行。最簡單的例子是 for loop：處理一個很大的 array，讓每一圈 iteration 各用一個 thread 同時跑。實務上就是 OpenMP：在 for loop 前加一行 `#pragma omp parallel for`。

### POSIX 與 portability
programmer 喜歡 **portability**：在一個平台寫的程式，換到另一台只要 re-compile，不用改程式碼就能跑。靠的是 OS 上面那一層 **API layer**：每個 OS 的 kernel 和 system call 可以很不一樣，但 API 這層用相同的 interface，底下各自實現。Windows 有自己的 API；Linux、UNIX 等 open source 社群一起訂了 **POSIX（Portable Operating System Interface）**，照這個 standard 寫，在 Mac、Linux 上 recompile 就能跑，搬到 Windows 可能要整個重寫。C library 也屬於 POSIX 的一部分；**pthread 的 p 就是 POSIX**，它是這個 standard 定義的 thread API。

## Pthreads
pthread 很單純、很有彈性：只讓你 create、terminate thread，再加幾個溝通、同步用的 function；thread 裡做什麼全由你決定。流程：

1. `pthread_create`：create 一個 thread。大多數 thread library 裡，**一個 thread 就是「去跑一個 function」**，所以 function 裡的 local variable 是 private，function 之外的 global variable 是共用的。可以連續 call 很多次，create 出很多 thread。
2. thread 的 function 一 return，thread 就結束（pthread 沒有 delete thread）。
3. `pthread_join`：把 thread 的結果帶回 main thread（你的 main program）。

### pthread_create 的四個參數
```c
int pthread_create(pthread_t *tid,              // ① 回傳 thread ID
                   const pthread_attr_t *attr,  // ② attribute，NULL 用預設
                   void *(*start_routine)(void *),  // ③ thread 要跑的 function
                   void *arg);                  // ④ 傳給 function 的一個參數
```

1. **`pthread_t *`**：其實是「回傳值」：給它一個 `pthread_t` 的 pointer，它把這個 thread 的 ID 寫進去，像拿到一張號碼牌（token）。之後用這個 token 指定要對哪個 thread 做事，例如 join 它。
2. **Attribute**：做比較細的設定，控制 thread 建好之後的行為。例如在 multi-core 上把 thread 綁在某個 core：各 core 的 L1 cache 不共用，綁住能提高 cache hit rate。OS 預設不限制、哪個 core 有空就跑；想給 OS 這種 hint 就透過 attribute。它可以想成一個每個 bit 代表一種行為開關的整數；實際型別是 `pthread_attr_t` 結構，用 `pthread_attr_init` 等函式設定，不需要就傳 `NULL`。
3. **Function pointer**：這個 thread 要跑哪個 function。
4. **Argument**：傳給那個 function 的參數，**只有一個**，型別是 `void *`。API 想越簡潔越好，不可能定義一參數版、兩參數版。要傳很多個就**包進一個 struct，再傳 struct 的 pointer**，到了 function 裡自己解開。pthread 幫你做得很少：進來後要自己 cast 成正確型別，cast 錯就讀出亂碼，自己負責。

return 也一樣：不能直接回傳一個值，要透過 pointer 傳出來，而且要 call `pthread_join` 才拿得到。

### Hello world 範例
```c
#include <pthread.h>
#include <stdio.h>
#define NUM_THREADS 5

void *print_hello(void *arg) {
    long id = (long) arg;               // 進來後自己 cast 回原本的型別
    printf("Hello World! from thread %ld\n", id);
    return NULL;                        // function return，thread 就結束
}

int main() {
    pthread_t tid[NUM_THREADS];         // 用 array 存 thread ID，要開幾個都可以
    for (long t = 0; t < NUM_THREADS; t++)
        pthread_create(&tid[t], NULL, print_hello, (void *) t);  // 編號先轉成 void *
    for (long t = 0; t < NUM_THREADS; t++)
        pthread_join(tid[t], NULL);     // 一個一個 join 回來
    return 0;
}
```

每個 thread 都執行 printf，印出來的編號不同，而且**誰先印不一定**。這些都是 user thread，可以開很多個，但不代表它們會 map 到不同的 kernel thread。

### 傳多個參數與取回結果
```c
struct args { int lo, hi; long sum; };

void *partial_sum(void *p) {
    struct args *a = (struct args *) p;   // 自己把 struct 解開
    a->sum = 0;
    for (int i = a->lo; i < a->hi; i++)
        a->sum += i;                      // 結果寫回 struct，透過 pointer 帶出去
    return a;
}

// main 裡：
struct args a1 = {0, 50, 0}, a2 = {50, 100, 0};
pthread_t t1, t2;
pthread_create(&t1, NULL, partial_sum, &a1);
pthread_create(&t2, NULL, partial_sum, &a2);
pthread_join(t1, NULL);
pthread_join(t2, NULL);
long total = a1.sum + a2.sum;             // 0 + 1 + … + 99 = 4950
```

一般 thread programming 的模式：main thread 先跑不需要平行的部分；遇到要平行的部分就 create thread，每個 thread 跑相同或不同的 function、處理不同的 data；做完再 join，把結果收回 main thread 繼續往下；之後還可以再 create、再 join，動態重複。

### 不 join 就要 detach
不需要讀回資料就不會 call join，但大部分 thread library 會要求你 call **`pthread_detach`**：告訴 library 這個 thread 結束後直接把它的 resource free 掉。

不 call 會怎樣？系統在 run time 不知道之後會不會有人來 join 它，所以結束的 thread 會一直 hang 著，return 值和資源都留著不放（main 結束時整個 process 還是會結束，問題是在那之前資源一直被占著）。好習慣：**create 完，要嘛之後會 join，不 join 就立刻 detach**。一旦 detach 就永遠不能再 join；detach 之後，main thread 和這個 worker thread 除了共用 global variable 就沒關係了，不會再會合。

pthread 也有 lock、unlock 的 function，什麼時候該鎖、什麼時候該解，留到 synchronization 那章。

## Java threads
Java 有專門的 **Thread class**（implement **Runnable** 這個 interface）。Java 有自己的 virtual machine（JVM），自己就像一個 OS，所以 portability 比其他語言好：寫好的 Java program 可以在 Windows 上跑，也可以在 Linux 上跑。

裝 JVM 時會裝 Windows 版或 Linux／POSIX 版：
- Windows 版的 JVM 把 Java thread 對到 **Win32 thread**。
- UNIX、Linux 版的 JVM 對到 **pthread**。

也就是隔了一層：Java 建一個 thread，先對到那個 OS 的 user thread library，再往下到 kernel thread。所以 pthread 沒辦法在 Windows 上跑，Java 可以。換個 OS，行為就可能不同（可能是 one-to-one，比較複雜的 OS 可能是 many-to-many），這由 JVM 控制；用 pthread 則是 programmer 自己透過 attribute 設定。

## Linux threads：clone()
這講的是 kernel 怎麼管理 thread。某種程度上，**Linux 的 kernel 根本不 support thread**：對 programmer 還是有 thread（用 pthread library 就能在 process 裡 create thread），但 OS 把你建的每個 thread 都當成一個 process 來管。

差別在哪？用 `fork` 建的 process，兩個記憶體完全不相通（要 copy 一份）；透過 pthread 建出來的，是一種很特別的 process：有些記憶體是共用的。所以 Linux 另外提供一個 system call **`clone`**：目的一樣是建 process，只是參數多很多，用一組 **flag** 控制哪些資源共用、哪些不共用，直接把新 process 變成 thread 的樣子。每個 flag 對應一種資源，用 0 或 1 控制：

| Flag | 共用的東西 |
|---|---|
| `CLONE_FS` | file-system 資訊（例如目前的工作目錄） |
| `CLONE_VM` | 同一個 memory space |
| `CLONE_SIGHAND` | signal handler |
| `CLONE_FILES` | 開啟的檔案 |

flag 全部設成共用，就很像 thread；全部不共用，就很像 fork。Linux 把兩者都叫 **task**。所以 kernel 不必另外寫程式管 thread：它就是 process，只是建的時候用 clone 的參數決定哪些共用。對 programmer，process 和 thread 是完全不同的 programming model；對 OS，它們都只是要 core 去跑的執行單位。

## Threading issues
thread 都屬於同一個 process（process 彼此卻沒關聯），所以有些行為跟 process 不一樣，要特別注意。

### 在 thread 裡呼叫 fork()
一個 process 有兩個 thread，其中一個 call 了 fork，新的 process 該長什麼樣子？兩種可能：

1. **複製整個 process**：雖然只有一個 thread 呼叫，整個 process 照樣複製，原本兩個 thread，新的也有兩個。
2. **只複製呼叫 fork 的那個 thread**：新 process 只有一個 thread。Linux 比較容易這樣做，因為它本來就把 thread 當 process，fork 時看到的就是那一個 thread。

這沒有對錯：OS 可以兩種都支援、讓你選一個當 default（有些 UNIX 兩種 fork 都提供），也可以只支援一種。寫程式時要查那個 OS 的規格才知道你的 fork 是哪一種。

### exec()
exec 沒有爭議：它的定義是 replace，一 call exec，**整個 process（包括所有 thread）**就被換成新的程式，原本有幾個 thread 都不重要。

> **重點** 如果 fork 之後馬上 exec，只複製呼叫 fork 的那個 thread 就夠了，因為整個 process 反正會被換掉；如果 fork 之後不 exec，才需要複製所有 thread。

### Thread cancellation
cancellation 是在 thread 完成前終止它（被 cancel 的叫 **target thread**）。例如多個 thread 平行搜尋資料庫，一個找到了，其他就可以 cancel；或使用者按了網頁的停止鈕，正在載入的 thread 都要取消。thread 被 terminate 時，它用過的記憶體等資源要有人清掉，也就是 thread library 必須 clean up 被 cancel 的 thread。兩種做法：

| | Asynchronous cancellation | Deferred cancellation |
|---|---|---|
| 定義 | **立刻**終止 target thread | target thread 自己定期檢查該不該結束，跑到安全的點才結束 |
| 風險 | thread 可能做到一半、指令沒做完就被砍；配給它的資源、它正在更新的共享資料可能來不及處理好，造成 synchronization 問題 | 比較安全 |

deferred 的做法：target thread 先設好幾個可以被中斷的地方，叫 **cancellation point**。就算你按 Ctrl-C 要砍它，它還是跑到下一個 checkpoint 才結束，這就是 defer（延後）。為什麼不立刻做？overhead 大，而且做到一半就砍會出問題。**Pthreads 預設用 deferred**。

### Signal handling
**signal** 是 OS 用來通知 process「某件事發生了」的機制。例如某個 thread 呼叫 sleep 10 秒，10 秒後會有一個 signal 通知，讓它繼續跑。一個 process 有很多 thread，OS 第一件事要判斷：這個 signal 是給某一個 thread，還是給全部？一般的形式是 signal 先送到 process，再決定交給誰，四種選擇：

1. **交給它適用的那個 thread**（產生它的 thread）：像 sleep，只有那個 thread 去睡，10 秒後也只有它被叫醒。
2. **交給所有 thread**：例如某個 thread 直接 call exit 結束 process，所有 thread 都要被 kill。
3. **交給某些指定的 thread**：只要有 thread ID，thread 之間也能互傳 signal，交給特定的人處理。
4. **指定一個 thread 接收所有 signal**：送出的人沒說誰處理，就交給一個特定的 thread（例如 main thread）；有些 signal 預設就是它管。

所以 OS 要知道誰發的、誰來接：broadcast 給所有人、給指定的 thread，還是由 main thread 處理。

### Thread pool
原本的想法是需要平行時才動態建一個 thread，不要了再 delete 掉；但一直 create、delete 不太 efficient。所以像 web server 會一開始就建好一池 thread（**pool of threads**），pool 大小可以控制（例如 20 或 100 個），執行過程中一直 **reuse** 這些 thread 去跑不同的 function。

好處：
1. event 進來時不用在 run time 才建 thread，處理 request 更快。
2. 更主要的：**控制 pool size 就是控制這台 server 的資源用量**。web server 如果不設限，request 越多 thread 越多，最後 CPU 全被分光，整台可能 hang 住。pool size 控制在 10 或 100，就知道最多只用這麼多，剩下的留給系統。設定時看有幾個 core、多少 memory，估每個 thread 吃多少，算出最多開幾個。

> **重點** 在 thread 裡呼叫 fork、exec、signal 這些 function 時，要記得同一個 process 裡還有很多 thread。

## 重點整理
- Thread = lightweight process = basic unit of CPU utilization；process 像容器。
- 共用：code、data（global）、heap、open files；私有：thread ID（TCB）、PC、registers、stack。
- 好處：responsiveness、resource sharing、scalability（多核心）、economy（建 thread 比 fork 快 20～50 倍；shared memory 比 message passing 快 2～15 倍）。
- 只有不同系統、不同 application 才非用 process 不可。
- 五個挑戰：dividing activities、data splitting、data dependency、balance、testing and debugging。
- User thread（Pthreads、Java、Win32）快、在 user level；kernel thread 是 OS 排程的單位，一個 block 不影響其他。user thread 要 bind 到 kernel thread 才能執行。
- Many-to-one：快、無 mode switch，但一個 block 全卡、不能平行，少見（embedded）。
- One-to-one：平行、不互卡，但 overhead 高、數量受限；Linux、Windows 採用，最常見。
- Many-to-many：kernel thread ≤ user thread，彈性、scalable，但複雜。Two-level：many-to-many 加上可綁定。
- pthread_create(tid, attr, function, arg)：只有一個 `void *` 參數，多個要包 struct；回傳值要 join 才拿得到；不 join 就 detach，detach 後不能 join。
- Java thread 經 JVM 對到 Win32 thread 或 pthread。
- Linux 用 clone 建 task，flag（CLONE_VM、CLONE_FS、CLONE_FILES、CLONE_SIGHAND）決定共用什麼：全共用 ≈ thread，全不共用 ≈ fork。
- Thread 裡 fork：複製全部 thread 或只複製呼叫者；fork 後馬上 exec 只需複製一個。exec 換掉整個 process。
- Asynchronous cancellation 立刻終止；deferred 到 cancellation point 才結束（Pthreads 預設）。
- Signal 可交給：適用的 thread、所有 thread、某些 thread、一個指定接收全部 signal 的 thread。
- Thread pool：預先建好重複使用，更快，並用 pool size 控制資源。

## 名詞對照
| 中文 | English |
|---|---|
| 執行緒 | thread |
| 輕量級行程 | lightweight process |
| CPU 使用的基本單位 | basic unit of CPU utilization |
| 執行緒控制區塊 | thread control block (TCB) |
| 單執行緒／多執行緒行程 | single-threaded / multithreaded process |
| 反應性 | responsiveness |
| 資源共享 | resource sharing |
| 擴展性 | scalability |
| 經濟性 | economy |
| 多核心程式設計 | multicore programming |
| 拆分工作 | dividing activities / identifying tasks |
| 資料切分 | data splitting |
| 資料相依 | data dependency |
| 負載平衡 | load balancing |
| 使用者執行緒 | user thread |
| 核心執行緒 | kernel thread |
| 多對一／一對一／多對多模型 | many-to-one / one-to-one / many-to-many model |
| 兩層模型 | two-level model |
| 模式切換 | mode switch |
| 平行性 | parallelism |
| 共享記憶體程式設計 | shared-memory programming |
| 編譯器指示 | compiler directive |
| 可攜性 | portability |
| 執行緒函式庫 | thread library |
| 合併（等待執行緒結束） | join |
| 分離 | detach |
| 執行緒取消 | thread cancellation |
| 目標執行緒 | target thread |
| 非同步取消／延遲取消 | asynchronous / deferred cancellation |
| 取消點 | cancellation point |
| 訊號處理 | signal handling |
| 執行緒池 | thread pool |
