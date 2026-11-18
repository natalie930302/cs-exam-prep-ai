# 虛擬記憶體

上一章把 logical 和 physical address 切開，這一章再往前一步：程式的某一頁不一定要在 RAM 裡，可以先待在 disk，要用時才搬進來，這就是 virtual memory。在 virtual memory 底下做 paging 叫 demand paging。這一章依序講：為什麼不必把整支程式放進記憶體、demand paging 與 page fault 的處理流程、effective access time、copy-on-write 和 memory-mapped file，然後是重頭戲 page replacement（FIFO、Optimal、LRU 與它們的變形、Belady's anomaly、stack algorithm），最後是 frame allocation 與 thrashing（working set、page-fault frequency）。考試一定要會手算置換演算法的 page fault 次數，也常考 thrashing 的成因與解法。

## 學完這章要會
- 說明 virtual memory 的目的與好處，以及為什麼用 demand paging 而不是 demand segmentation
- 分辨 swapper 與 pager、invalid reference 與「還沒搬進來」，說明 pure demand paging
- 寫出 page fault 的處理步驟（trap → 找 frame → swap in → 更新 page table → restart）
- 計算 effective access time，從可接受的延遲反推 page fault rate
- 說明 copy-on-write 和 memory-mapped file 的作法與優缺點
- 說明 dirty bit 的用途
- 用 FIFO、Optimal、LRU 模擬 reference string，算 page fault 次數與 hit ratio
- 說明 Belady's anomaly，知道 LRU、Optimal 是 stack algorithm、FIFO 不是
- 說明 LRU 的實作（counter、stack、hash map + doubly linked list）與近似 LRU（reference bits、second chance）、LFU／MFU
- 說明每個 process 的最少 frame 數、fixed／priority allocation、local／global replacement
- 解釋 thrashing 的定義與惡性循環，用 working set model（D 與 m）和 PFF 解決

## 為什麼要 virtual memory

### 不必把整支程式放進記憶體
一個 process 開始跑，真的需要把它整支內容都搬進 memory 嗎？dynamic loading（用到某個函式才載入）和 dynamic linking（執行時才連 library）都能省記憶體；virtual memory 更積極：**讓放進記憶體的東西，每一樣都真的會被存取**。

- 處理錯誤的程式碼平常根本不會跑到，放在記憶體只是佔位置。
- 程式裡一堆 if else 分支，有些路徑可能永遠走不到。
- 宣告一個一萬個元素的 array，不小心多打幾個零，結果幾乎沒用到。

virtual memory 可以細到 page 這一層：沒被 access 的 page 就先不放，只搬真的用到的。目的是提高 **memory utilization**：不是看塞了多少，而是放進去的東西有沒有真的被存取。

### Virtual memory 的好處
logical address 和 physical address 之間用一張表連起來；既然切開了，程式的某一頁不一定要對到 RAM，甚至可以對到 disk，放哪裡使用者根本不用管。

1. **程式可以比實體記憶體還大**：RAM 只有 16GB，logical space 照樣可以更大，慢一點但跑得動。
2. **硬碟也被當成記憶體的一部分**：可用空間變大，就能放更多 process（degree of multiprogramming 提高），CPU、I/O 這些閒著的資源更容易有人用，使用率提高。
3. **寫程式變簡單**：尤其是 compiler、linker 這層，只管自己的 logical 空間就好。
4. **程式跑比較快，特別是啟動**：沒有 virtual memory，整支程式要先全部 load 進來才能開始；用 demand paging，一開始什麼都不搬，要哪頁才搬哪頁，一次 4KB，而不是一口氣 10MB。

這些好處跟上一章的 virtual address 有重疊，因為 virtual memory 包含它，而且更進一步用到了 disk。

### 為什麼是 paging，不是 segmentation
把記憶體內容搬到 disk，可以一頁一頁搬（**demand paging**），也可以一段一段搬（demand segmentation）。大家都用 paging：segment 大小不固定，搬回來要找夠大的空洞（像 best fit），最壞 O(n)；page 大小固定，有空位就一定放得下，從 free list 拿第一個就好，O(1)。

兩個同時存在時，segmentation 在上、paging 在下：segmentation 照使用者的角度切（code、heap、stack 各一段），寫程式比較直覺；真正放進 physical memory，固定大小的 paging 好管（找空位 O(1)、沒有 external fragmentation，internal fragmentation 也只在 4KB 以內）。所以 demand paging 是在 paging 這層做的，segmentation 主要跟 compiler 有關。

### Page 可以待在 disk
程式的 logical address 是一堆 page，page table 把每頁對到 RAM 的某個 frame。virtual memory 多一層：某一頁很久沒被存取，就 swap 到 disk，page table 那格標成「不在記憶體」。等 CPU 要存取它，OS 發現它在 disk，就搬回 physical memory，然後照常執行，好像什麼都沒發生。

- disk 好像變成記憶體的一部分，但 RAM 大小沒變，而且 **CPU 不能直接讀 disk**，一定要先搬回來。
- 誰該被踢到 disk？這就是後面的 replacement algorithm。選錯了，就會一直搬來搬去。
- 這種搬回來**不是 load program**：只是複製 4KB 的 bytes，不會去建 page table 或 PCB。

> **觀念** 對照沒有 virtual memory 時程式怎麼跑：compile 完的 binary 裡位址都是 virtual address；要 run 時，loader 建立 PCB 和 page table，一開始全部 load 進去，page table 每格填好；記憶體不夠或某個 process 很久沒跑，就把**整個 process** 搬到硬碟（以 process 為單位的 swapping）；執行中每個位址都透過 page table 翻譯；malloc 要更多記憶體時，OS 先改 page table 分配好位置，page table 標出哪些格子 valid、哪些 invalid；程式結束，就把它的 memory 和 page table 全部 free 掉。換成 demand paging，同一支程式會很不一樣。

## Demand paging

### 要了才搬
**Demand paging**：一開始所有 page 都在 disk 上，要哪一頁才搬那一頁，不是一次把整支程式全 load 進來。

- I/O 少，load time 短：一次只搬一個 4KB 的 page，當然比搬 10MB 快。
- 記憶體只放要用的東西，使用率提高，剩下的空間可以給別的程式，degree of multiprogramming 跟著提高。
- 就算沒有 dynamic loading、linking，光看程式怎麼用記憶體，以 page 為單位決定放哪，就是 demand paging。

### Swapper 和 pager
- **Swapper**（mid-term scheduler）以 **process** 為單位：把整個 P1 一口氣搬到 disk。
- **Pager** 做 demand paging，以 **page** 為單位：只搬某一頁，不會整個 process 一起動。所以一個 process 可以一部分在 disk、一部分在記憶體，照樣繼續跑，不用整個被 suspend。

OS 通常兩個都有，層級不同、不衝突：swapper 決定誰整個留下，pager 再挑留下的人哪些 page 不要。

### 無效位址，還是還沒搬進來
用了 demand paging，每次存取一個位址都要分清楚：

1. **Invalid reference**：這個位址根本沒分配給程式，超出範圍，本來就不該碰。
2. **位址有效，只是那一頁還沒搬進來**（之前沒人要用）。這種存取一樣會出錯，但這個錯其實是在通知 OS「demand 來了」，OS 就去把它搬進來。

極端一點叫 **pure demand paging**：load process 時只建 page table 和 PCB，記憶體裡一頁都不放；真的開始跑、用到哪一頁，才把那一頁放進記憶體。實際系統大多不會這麼 pure，可能先 load 一定會用到的部分，省掉開頭一連串的 fault。

### Valid–invalid bit
OS 靠 page table 每格的 **valid–invalid bit** 分辨，這個 bit 主要就是拿來做 virtual memory 的：

- **v（1）**：這一頁現在在記憶體裡。
- **i（0）**：在 demand paging 裡的意思是「這頁有效，只是目前不在記憶體」（或根本不屬於這個 process）。

存取時看到 i，就產生 **page fault**。OS 把那頁從 disk 搬進來，填上 frame 號碼，再把 bit 改成 v。pure demand paging 一開始一頁都不在，所以每個 bit 都是 i。讀寫權限通常放在 segment 那層管；page table 每格也可以有 protection bit。page 被換出去的地方叫 **backing store（swap space）**，跟一般存檔案的 file system 是兩回事。

位址有沒有效誰檢查？上一層 segment 有 length，先擋掉越界的；到 paging 這層只看在不在記憶體。

> **例題** process A 很大，切成 P1～P4 四個 page。P1、P2、P4 在 main memory，P3 在 secondary storage。要用 P3 時，它不在 main memory，這就是 page fault。硬碟留一塊空間放這些 page，main memory 滿了也沒關係，等於把 main memory 擴充了。

### Pure demand paging 一步步跑
> **例題** 為了好看，假設一頁只放一個指令。
> 1. load 時只建 page table（裡面全是 i）和 PCB，記憶體裡什麼都沒放。
> 2. 執行第一個指令，要存取記憶體，先查 page table：bit 是 i，產生 **page fault**（這是 paging 的過程，所以叫 page fault，不是 segmentation fault）。
> 3. fault 是一種 interrupt，把 OS 叫起來。OS 知道這行指令放在 disk 的哪裡，把那一頁 load 進記憶體的某個 frame。
> 4. update page table：填上 frame 號碼，把 valid bit 設起來。
> 5. 平常執行完一個指令，PC 會加 4；page fault 處理完，要把 **PC 減 4** 移回去，CPU 重新 fetch 同一個指令，這次資料在了，正常執行，結果跟沒發生過一樣。
> 6. 下一個指令如果在別的 page，就再來一次：fault、搬進來、更新表、重做。記憶體就慢慢長出來。

## Page fault 的處理

### 處理步驟
1. CPU 存取記憶體，MMU 查 page table，看到 invalid，丟出 **page fault**。它是軟體產生的 interrupt，所以也叫 **trap**。trap 優先權很高，OS 不能跳過、也不能忽略。
2. OS（pager）接到後確認：有沒有超過 segment 長度、或 PCB 記的記憶體上限？超過就是真的無效（終止程式）；有效、只是不在記憶體，才繼續做 paging。
3. 找到那一頁在 disk 上的位置（在 load、或把它搬到 disk 時，OS 就記下來了）。
4. 找一個空的 frame（從 free frame list 拿，O(1)）。
5. 做 swapping，把那頁內容從 disk 複製到這個 frame。
6. update page table：填上 frame 號碼，把 bit 設成 valid。
7. **Restart**：重新執行剛才那個指令（PC 減 4）。最後一步千萬別忘。

> **例題** CPU 正在跑 process A 的 P2，裡面有一個指令 `load X`，要用到 P3。
> - step 1：CPU 自己不知道 P3 在不在，靠 MMU 查 process A 的 page table（三欄：page number、frame number、valid–invalid bit）。P3 那格是 i，main memory 裡 P1、P2 都在，接著直接是 P4，就是沒有 P3。
> - step 2：發生 page fault，送一個 trap 給 OS，帶著「process A 的 P3 不在」這個資訊。
> - step 3：OS 到 secondary storage 找到 P3。
> - step 4：把 P3 帶回 main memory 的空 frame **F34**。P1、P2 在 F7、F8，P3 卻在 F34，不連續也沒關係，page table 就像索引。
> - step 5：update page table，P3 那格填上 F34，改成 valid。
> - step 6：restart，重新執行 `load X`，這次查得到 P3，順利跑下去。
>
> 如果 P3 本來就在，根本不會 fault：MMU 查到 frame 34，從 step 1 直接跳到 step 6。

### 沒有 free frame：先做 replacement
如果記憶體四格都滿了，新的 page 6 要進來，就要在「找 free frame」這步多做一件事：強迫某一頁從記憶體 swap 到 disk，清出一個位置。要踢誰由 **page replacement algorithm** 決定。這步只在必要時觸發：流程還是先找 free frame，真的沒有才呼叫 replacement。所以整個 page fault 流程快不快，很大程度取決於 replacement algorithm 好不好。

## Effective access time（EAT）
p 代表 **page fault rate**：每次存取記憶體發生 page fault 的機率，0 ≤ p ≤ 1。

```
EAT = (1 − p) × ma + p × page fault time
```

- 沒發生（機率 1 − p）：只花一次記憶體存取時間 ma（細算的話 ma 還要看 TLB 有沒有命中）。
- 發生（機率 p）：要花 page fault time，把整頁從 disk 搬進來再交給 CPU。
- 把步驟拆開看，trap、更新 page table 都很快，時間幾乎全花在 disk。

> **例題** ma = 200 ns，page fault time 約 8 ms = 8,000,000 ns。
> ```
> EAT = (1 − p) × 200 + p × 8,000,000
>     = 200 + p × 7,999,800  (ns)
> ```
> 前一項幾乎不重要，EAT 跟 p × page fault 時間成正比。
> - 1000 次存取只有 1 次 page fault，p = 0.001：EAT = 200 + 7999.8 ≈ 8200 ns = **8.2 µs**。原本 200 ns，**慢了大約 40 倍**，不是 40%。
> - 只願意慢 10%：EAT < 220 ns → 200 + 7,999,800p < 220 → p < 20 / 7,999,800 ≈ **0.0000025**，大約 40 萬次存取才能有 1 次 fault。

> **陷阱** 8.2 是微秒（µs），不是毫秒（ms）。10% 的條件算出來是四十萬分之一，比萬分之一小得多。數字不必背，記住 page fault rate 要極低。

> **例題** 記憶體存取 100 ms，page fault overhead 10 ms（直接當成公式裡的 page fault time），10 次有 1 次 fault，p = 0.1。
> EAT = (1 − 0.1) × 100 + 0.1 × 10 = 90 + 1 = **91 ms**。
> 如果題目說明 10 ms 是發生 fault 時在原本的存取之外「多」花的時間（多走 step 2～6），fault 那次就是 100 + 10 = 110 ms，EAT = 0.9 × 100 + 0.1 × 110 = **101 ms**。看清楚題目給的是哪一種。
> 這組數字只是練習代公式；真實的 page fault 要讀硬碟，比記憶體存取慢非常多。題目可能混著給 ms、µs、ns，先換成同一個單位再算。

為什麼有 virtual memory，電腦卻不覺得慢？跟 TLB 一樣，靠 **locality**：程式短時間總用附近的資料。一次 fault 就搬進一整個 page（通常 4KB，也有 8KB，Intel Pentium 甚至能選 4MB），而每次存取只讀 1 到 4 個 byte；像 for loop 一直讀同一個 array，搬進一頁之後，接下來在這頁裡都不會再 fault。從使用者角度，一般人大概容忍慢 10%，反推回去，page fault rate 要比 TLB miss rate 低得多。但程式跳來跳去、或同時開一堆程式、記憶體不夠，fault 就變多，電腦越來越慢。這也是大家建議裝 SSD 的原因：swap space 在 SSD 上，page fault 處理快很多，整台電腦就變快。

## Process 與 virtual memory
有了 virtual memory，對 process 的管理還有三個好處（都是「需要時才做」的最佳化，都跟 disk 有關）：

1. **Demand paging**：用到才載入，load 時間很小，每次 swapping 也很快。
2. **Copy-on-write**：寫了才複製，fork 變快。
3. **Memory-mapped file**：把檔案映射到記憶體。

### Copy-on-write
大部分 OS 用 fork 建 process，預設 child 是 parent 的複製，真的整份 copy 很浪費。MMU 做的就是對照：內容一樣，就讓兩邊的 page table 指到同一份實體 page（sharing）。但它們畢竟是兩個程式，行為不同，只要有一方**寫**了內容，OS 才複製那一頁，這就是 **copy-on-write（COW）**。

- 好處是建 process 快很多；代價是執行中才 copy，會慢一點點。
- 拿 free frame 給新 page 前，通常會先 **zero-out**（清成 0），不然可能看到前一個 process 的資料。

> **例題** fork 剛完成，parent 和 child 的使用者資料一模一樣，只有 OS 維護的 PCB 不同，所以兩邊 page table 設成一樣，共用 page A、B、C。fork 對 parent 和 child 回傳不同的值，程式靠它讓兩邊做不一樣的事。parent 在某個 function 裡新建變數 Test1，它在 stack 上，剛好落在 page C，這是一次 write。page C 兩邊不一樣了，於是複製一份 C 給 parent；A、B 還是照樣共用。誰拿新的、誰拿舊的是實作細節。parent 看得到 Test1，child 沒有，兩邊都正常跑。
> ```
> fork 後：           parent → A B C ← child      （三頁都共用）
> parent 寫 page C： parent → A B C'
>                    child  → A B C              （只複製 C，A、B 仍共用）
> ```

### Memory-mapped file
平常讀檔用 fopen、fread，要經過 file system，步驟多所以慢。**Memory-mapped file** 讓程式用存取記憶體的方式讀寫檔案：檔案本來就是一串 byte，對到一個 byte array，A[0] 對第 0 個 byte。只要一個指令，把整個檔案 map 到記憶體某處，之後用 array、pointer 操作，不需要 fread、fwrite。

它跟 virtual memory 是同一個概念（一個記憶體位址其實對到 disk 上的某個位置），只是方向倒過來：把 disk 上的檔案當成記憶體來存取。你把 A[1] 改掉，看起來只改了記憶體，但 OS 知道它對到檔案的哪個 byte，會幫你寫回去。一個 page 對到檔案的 4KB，很多 process 也能同時 map 到同一個檔案，各自把 page table 設好就行。

**兩種讀檔寫法比較：**

- 一般寫法：open 檔案，seek 到某個位置，再 read，全都透過 file system。file system 很重要的工作是 **buffering**：disk 太慢，read 時先 prefetch 一大塊（例如 256 bytes）到 buffer；你其實只要一個 int（4 bytes），它再從 buffer 複製到你的 buf，**資料被複製了兩次**。write 也一樣，先寫進 buffer，close 時才 flush（fflush 就是強迫它馬上寫）。
- Memory-mapped：一樣先 open，再告訴 OS 要 map 哪一段，它回傳一個 pointer p。之後直接用 pointer，像 `p[1000]++` 就等於一次 write，想跳到哪就跳到哪。但寫下去只改了記憶體，跟 disk 還沒同步，這時斷電資料就沒了；要等 **munmap**，或用 **msync** 強迫同步才寫回去。OS 不知道你改了哪個 byte，只能把 dirty 的 page 整頁重寫。用完要 munmap（解除 mapping），也要 close（關掉 file handle）。

```c
fd = open("data", O_RDWR);
p = mmap(NULL, len, PROT_READ | PROT_WRITE, MAP_SHARED, fd, 0);
p[1000]++;                 // 直接當 array 用，等於一次 write
msync(p, len, MS_SYNC);    // 需要時強迫寫回 disk
munmap(p, len);
close(fd);
```

**優點：**

- 完全跳過 file system（file system 是一整套系統，隨便一個 fread 都要檢查權限、檔案有沒有打開，呼叫路徑很長），所以**快**。
- **Sharing**：檔案進了記憶體，用 paging 就能讓很多 process 共用同一塊。file system 很嚴謹，檔案被人用 write 打開，別人就不能同時 write；用 mmap 可以自己寫 locking，控制更細。

**缺點：**

- 好用也就好弄壞：記憶體只有共不共用，沒有讀、寫、執行這些 access control；多人同時修改有同步問題（file system 會幫忙保護檔案，例如斷電後還能復原，自己用就得自己想辦法）。
- **Data loss**、不 reliable：資料在記憶體，不會隨時寫回 disk，一當機或停電就沒了。
- 寫程式比較難：只是一個 array，哪幾個 byte 是整數、哪些是字元都要自己算，錯一個 byte 就毀了。

所以它適合資料單純、要快、暫時性、使用者少的檔案，以及大量資料的傳輸（一次把一整塊資料寫出去）；一般情況還是交給 file system。最常用它的是系統層的軟體：swap、virtual memory 本身就是同樣的機制在搬一塊塊 4KB；Linux 裡每個 I/O device 都有一個對應的 file（其實是 device 的 memory），用 memory-mapped 的方式操作它，就能對 device 做 I/O。最好的例子是顯示卡：螢幕畫面就是一堆 pixel，也就是一個 byte array，用 mmap 一次寫完再 flush，非常快。

## Page replacement

### 為什麼重要
page fault 時要找空 frame 放新 page，全滿了就得做 replacement。它對效能影響很大，因為它決定 fault 次數：你把等一下要用的 page 2 踢走，它很快又要搬回來。

沒有空 frame 有兩種解法：極端的是用 swapper 把整個 process 搬走，但那支程式就完全不能動了；OS 比較喜歡細緻的作法：在 page 這層，由 pager 只挑一個 page 換出去。一個程式很多 page 其實沒在用，要找一頁來換並不難。

### Dirty bit
記憶體的內容本來就是從 disk load 進來的，disk 上原本就有一份 copy。很多 page 根本沒被改過（像 library 只有讀），踢出去時再寫一次很浪費。所以 page table 每格再多一個 **dirty bit（modify bit）**：

- 剛 load 進來是 0，跟硬碟上的一樣；只要被寫過，就設成 1。
- 換出去時檢查：是 0，沒改過，什麼都不用寫，新的 page 直接蓋過去；是 1，這 4KB 裡有 byte 改過但不知道是哪個，只好整頁寫回硬碟。

本來一次 fault 要寫出舊的、再讀進新的，兩次 disk 動作；有了 dirty bit，沒改過的就省一半。

### 兩個問題：給幾個 frame、換掉誰
1. **Frame-allocation algorithm**：記憶體不夠時，每個 process 給幾個 frame？例如一個程式其實要 100 個 frame，可能只給它 10 個，反正不用整支 load 進來。
2. **Page-replacement algorithm**：在那 10 個 frame 裡，新 page 要進來，換掉誰？

先講 replacement（只看單一程式），frame allocation 放到後面。

### 步驟
1. 找到造成 fault 的 page 在 disk 哪裡。
2. 找 free frame：有就用；沒有就呼叫 replacement algorithm 選一個 **victim**，把它 swap 到 disk（dirty 才需要寫回）。
3. 新 page 放進空出來的 frame，update page table。
4. 重新執行那個指令。

### Reference string
把 replacement 變成數學問題：目標是 page fault 的次數或比率越少越好。input 叫 **reference string**：程式執行時依序存取的記憶體位置記下來的一串，只在乎是第幾個 page，不管確切的 byte 位址（同一頁裡位置不同沒差）。例子通常從全空開始（之前發生過什麼我們也不知道），第一次存取每個 page 一定 fault，任何演算法都救不了。實際上有 locality，frame 也有成千上萬個，不會像例子 fault 這麼多。

下面都用這串：

```
1 2 3 4 1 2 5 1 2 3 4 5
```

基本演算法有三個：**FIFO** 最直觀，**Optimal** 是理論最佳，最重要的是 **LRU**，一般系統都在用。

## FIFO
**First in first out**：踢掉最早進來的那頁。用一個 queue 就能做（head、tail 兩個指標），上面最新、下面最舊。被用到（hit）也不會移動位置。

> **例題** FIFO，3 個 frame。F 表示 page fault；newest 到 oldest 是 queue 由新到舊，out 是被踢出的 page。
> ```
> ref      1  2  3  4  1  2  5  1  2  3  4  5
> newest   1  2  3  4  1  2  5  5  5  3  4  4
>             1  2  3  4  1  2  2  2  5  3  3
> oldest         1  2  3  4  1  1  1  2  5  5
> fault    F  F  F  F  F  F  F  .  .  F  F  .
> out               1  2  3  4        1  2
> ```
> - 1、2、3 有空位直接放；4 來時三格滿了，踢掉最早進來的 1。前四個都是第一次，任何演算法都救不了。
> - 接著 1 又來了！才剛把它踢掉，又是一次 fault，FIFO 的弱點就在這；2 也剛被擠出去，又 fault；5 把最舊的 4 擠出去。
> - 1 進來是 hit，但 FIFO 只看進來的順序，1 還是下一個被踢的；2 hit。3 進來，1 雖然剛被用過兩次，因為最早進來，還是被踢掉。4 是 fault（踢 2），最後的 5 是 hit。
> - 總共 **9 次** page fault。
>
> 畫起來好像 page 在移動，其實記憶體沒搬：page 一直待在原本的 frame，圖上只是 queue 的順序。

### Belady's anomaly
一般直覺是：多給 frame（多給資源），page fault 應該變少。**Belady's anomaly**：frame 增加了，page fault 反而**增加**（持平不算，必須是增加）。

> **例題** 同一串、同樣 FIFO，frame 從 3 改成 4：
> ```
> ref      1  2  3  4  1  2  5  1  2  3  4  5
> newest   1  2  3  4  4  4  5  1  2  3  4  5
>             1  2  3  3  3  4  5  1  2  3  4
>                1  2  2  2  3  4  5  1  2  3
> oldest            1  1  1  2  3  4  5  1  2
> fault    F  F  F  F  .  .  F  F  F  F  F  F
> out                        1  2  3  4  5  1
> ```
> 結果是 **10 次**，比 3 個 frame 的 9 次還多。給得更多，反而更糟。

畫成圖（橫軸 frame 數、縱軸 fault 次數），正常應該持平或往下，FIFO 卻在 3 到 4 往上跳。不是每一串都會這樣，但就是有可能發生。

> **重點** Belady's anomaly 為什麼重要？系統很多東西靠 tune 出來，大家調參數都假設資源越多越好；有 anomaly 的話，系統管理者不知道多給資源會變好還是變壞，插更多記憶體反而可能變慢，沒有規律就沒辦法 tune。所以 FIFO 的問題有兩層：fault 不夠少，更討厭的是 anomaly。

## Optimal（OPT）
replacement 的最佳解很好描述（也是 Belady 提出的）：**記憶體裡的 page 中，最晚才會再被用到的那頁先踢掉**。例如未來依序要 2、1、2、1、3，就踢 3。踢別人的話，它們一定比較早被用到，就更早 fault；不得已要踢，當然踢最不會用的。看的是存取順序，不是時間，隔幾毫秒都沒差。

說起來簡單、理論上也好證明，可是**做不到**：前提是要知道未來整串 reference string。compiler 也許能預測一部分，但程式有 branch，跑了才知道走哪邊。所以它是理論上的 **baseline／benchmark**：告訴我們最少最少會有幾次 fault，其他演算法看能多接近它。它的缺點跟排程的 SJF 一樣：都需要預知未來。很多研究在想怎麼預測，例如估每頁下次被 reuse 的距離，把最遠的踢掉，甚至用 learning 去逼近。

> **例題** Optimal，4 個 frame，同一串。每一列是一個固定的 frame。
> ```
> ref      1  2  3  4  1  2  5  1  2  3  4  5
> frame 1  1  1  1  1  1  1  1  1  1  1  4  4
> frame 2     2  2  2  2  2  2  2  2  2  2  2
> frame 3        3  3  3  3  3  3  3  3  3  3
> frame 4           4  4  4  5  5  5  5  5  5
> fault    F  F  F  F  .  .  F  .  .  .  F  .
> out                        4           1
> ```
> - 前四個直接擺進去，全部 fault，就算是 optimal 也一樣。1、2 本來就在，hit。
> - 5 來了要換人。往後看：1 下一個就用，接著 2，再來 3，4 最晚，所以踢 **4**。
> - 接下來 1、2、3 全都 hit。
> - 4 來了，往後只剩一個 5，5 不能丟；1、2、3 以後都不用了，丟誰都一樣，這裡丟最早進來的 1。最後的 5 hit。
> - 總共只有 **6 次**。FIFO 是 9 次、10 次，最好最好就是 6 次。

> **陷阱** 遇到最後的平手（好幾頁以後都不會再用），丟誰都算對；也有人約定平手時照 FIFO 丟最早進來的。但如果後面還有 2、3、1，就要丟最晚用的 1。

## LRU（least recently used）
optimal 用不了，實際上用得最多的是 **LRU**：一個 heuristic，既然不能看未來，那就**往回看過去**，**踢掉最久以前存取的那頁**。程式有 locality，剛用完的 page 很可能再用，附近的也是；越久沒用的，越可能不再用（像處理錯誤的函式）。實驗證明 LRU 表現不錯，而且能做到 O(1)，OS 做什麼都要快。

### 兩種實作
- **Counter**：每頁被存取時記一個 time stamp。要找最久沒用的，就得每格掃一遍，O(n)，frame 越多越慢。
- **Stack**：最近用的放最上面，最底下就是下一個要踢的，O(1)。跟 FIFO 的 queue 不同的是：**hit 時要把它拉到最上面**，所以最近被存取的永遠在最上面。

> **例題** LRU，4 個 frame，同一串。stack 由上（recent，最近）到下（oldest，最久）：
> ```
> ref      1  2  3  4  1  2  5  1  2  3  4  5
> recent   1  2  3  4  1  2  5  1  2  3  4  5
>             1  2  3  4  1  2  5  1  2  3  4
>                1  2  3  4  1  2  5  1  2  3
> oldest            1  2  3  4  4  4  5  1  2
> fault    F  F  F  F  .  .  F  .  .  F  F  F
> out                        3        4  5  1
> ```
> - 1、2、3、4 全部 fault，放進 stack，新的在最上面。
> - 1 進來，已經在記憶體，hit；1 是剛用過的，把它從底部拉回最上面，現在最底下的 2 變成下一個 victim。2 也在，拉上來，stack 變成 2、1、4、3。
> - 5 進來位置不夠，最底的 **3** 被踢掉（FIFO 在這裡會踢 1，不是 3）。
> - 後面照規則：1、2 hit；3 踢 4、4 踢 5、5 踢 1，都是 fault。
> - 總共 **8 次**：比 FIFO 的 10 次好，離 optimal 的 6 次還有距離。

考試時最好用實作的角度，照固定規則在腦中跑一遍，最不會錯。

### LRU 為什麼能 O(1)
- 用 **doubly linked list**：每個節點有前後指標，拿出一個節點、插到最前面都只要 O(1)。
- 但 hit 的 page 不一定在最下面，要怎麼馬上知道它在哪？一個個找就變 O(n)。所以再加一個 **hash map**：用 page 號碼當 key，存它在 list 裡的節點指標，hash 一下就拿到位置，從原位拿出來再放到最前面。
- hash map 加 doubly linked list，平均 O(1)。所以 LRU 好寫、很快、結果也不錯，是最常用的置換演算法，cache 的置換也大多用它。

## Stack algorithm
heuristic 的好壞會隨情況變，系統設計者更在乎可以證明的性質。LRU 和 optimal 都屬於 **stack algorithm**：

> **觀念** 定義：同樣的 input、同一個時間點，用 n 個 frame 時記憶體裡的 page 集合，一定是用 n + 1 個 frame 時的**子集合**（frame 加 1，原來那幾頁都還在，是 superset）。就像 stack 一直往上疊，越大，越一定包含原來的東西。

為什麼重要？多一個 frame，原來的都還在，只是多放一些；fault 也許不減，但**絕不會變多**，不會有 Belady's anomaly。

- **LRU**：往回看，記憶體放的就是最近看到的 n 個不同 page；n + 1 個 frame 就是最近的 n + 1 個，當然包含。
- **Optimal**：道理一樣，方向相反：往未來看前 n 個不同的 page。
- **FIFO 不是**：看第 7 個 reference（5）之後：

```
            3 個 frame     4 個 frame
LRU         {5, 1, 2}  ⊆  {5, 1, 2, 4}     ✓
FIFO        {5, 1, 2}      {5, 2, 3, 4}     ✗ 少了 page 1
```

> **重點** LRU、Optimal 是 stack algorithm，不會有 Belady's anomaly；FIFO 不是，會有。

## 練習：19 個 reference、3 個 frame
```
3 2 1 3 4 1 6 2 4 3 4 2 1 4 5 2 1 3 4
```
一開始全空，第一次把 page 放進去也算 fault；算 page fault 次數和 hit ratio。

### LRU
小技巧：要換頁時，從目前的位置往**左**看，在記憶體裡的三頁中，最後才看到（最左邊）的那頁就是最久沒用的。

| # | ref | 結果 | frames 之後 | 往左看 → 踢出 |
|---|---|---|---|---|
| 1 | 3 | F | 3 | |
| 2 | 2 | F | 3 2 | |
| 3 | 1 | F | 3 2 1 | |
| 4 | 3 | hit | 3 2 1 | |
| 5 | 4 | F | 3 4 1 | 先看到 3、再 1，最後才是 2 → 踢 2 |
| 6 | 1 | hit | 3 4 1 | |
| 7 | 6 | F | 6 4 1 | 1、4，最後 3 → 踢 3 |
| 8 | 2 | F | 6 2 1 | 6、1，最後 4 → 踢 4 |
| 9 | 4 | F | 6 2 4 | 2、6，最後 1 → 踢 1 |
| 10 | 3 | F | 3 2 4 | 4、2，最後 6 → 踢 6 |
| 11 | 4 | hit | 3 2 4 | |
| 12 | 2 | hit | 3 2 4 | |
| 13 | 1 | F | 1 2 4 | 2、4，最後 3 → 踢 3 |
| 14 | 4 | hit | 1 2 4 | |
| 15 | 5 | F | 1 5 4 | 4、1，最後 2 → 踢 2 |
| 16 | 2 | F | 2 5 4 | 5、4，最後 1 → 踢 1 |
| 17 | 1 | F | 2 5 1 | 2、5，最後 4 → 踢 4 |
| 18 | 3 | F | 2 3 1 | 1、2，最後 5 → 踢 5 |
| 19 | 4 | F | 4 3 1 | 3、1，最後 2 → 踢 2 |

page fault **14 次**、hit 5 次。hit ratio = **5/19**（分母是總存取數 19，不是 9），miss ratio = 1 − 5/19 = **14/19**。

### Optimal
準則：換掉未來最長一段時間不會被用到的 page，這次從目前位置往**右**看。平手（好幾頁以後都不會再用）就照 FIFO，換掉最早進來的。

| # | ref | 結果 | frames 之後 | 往右看 → 踢出 |
|---|---|---|---|---|
| 1 | 3 | F | 3 | |
| 2 | 2 | F | 3 2 | |
| 3 | 1 | F | 3 2 1 | |
| 4 | 3 | hit | 3 2 1 | |
| 5 | 4 | F | 4 2 1 | 接著要 1、再來 2，最後才要 3 → 踢 3 |
| 6 | 1 | hit | 4 2 1 | |
| 7 | 6 | F | 4 2 6 | 2 先、再 4，1 最右 → 踢 1 |
| 8 | 2 | hit | 4 2 6 | |
| 9 | 4 | hit | 4 2 6 | |
| 10 | 3 | F | 4 2 3 | 4、2 之後都會用，6 再也不用 → 踢 6 |
| 11 | 4 | hit | 4 2 3 | |
| 12 | 2 | hit | 4 2 3 | |
| 13 | 1 | F | 4 2 1 | 4 先、再 2，3 最右 → 踢 3 |
| 14 | 4 | hit | 4 2 1 | |
| 15 | 5 | F | 5 2 1 | 2、1 都會先出現，4 最右 → 踢 4 |
| 16 | 2 | hit | 5 2 1 | |
| 17 | 1 | hit | 5 2 1 | |
| 18 | 3 | F | 5 3 1 | 5、2、1 以後都不再用，平手 → 最早進來的 2 |
| 19 | 4 | F | 5 3 4 | 後面沒有請求了，平手 → 5、3、1 裡最早進來的 1 |

page fault **10 次**、hit 9 次，hit ratio **9/19**，miss ratio **10/19**。

### FIFO
| # | ref | 結果 | frames 之後 | 踢出（最早進來的） |
|---|---|---|---|---|
| 1 | 3 | F | 3 | |
| 2 | 2 | F | 3 2 | |
| 3 | 1 | F | 3 2 1 | |
| 4 | 3 | hit | 3 2 1 | |
| 5 | 4 | F | 4 2 1 | 3 |
| 6 | 1 | hit | 4 2 1 | |
| 7 | 6 | F | 4 6 1 | 2 |
| 8 | 2 | F | 4 6 2 | 1 |
| 9 | 4 | hit | 4 6 2 | |
| 10 | 3 | F | 3 6 2 | 4 |
| 11 | 4 | F | 3 4 2 | 6 |
| 12 | 2 | hit | 3 4 2 | |
| 13 | 1 | F | 3 4 1 | 2 |
| 14 | 4 | hit | 3 4 1 | |
| 15 | 5 | F | 5 4 1 | 3 |
| 16 | 2 | F | 5 2 1 | 4 |
| 17 | 1 | hit | 5 2 1 | |
| 18 | 3 | F | 5 2 3 | 1 |
| 19 | 4 | F | 4 2 3 | 5 |

page fault **13 次**，hit ratio **6/19**。

> **陷阱** 同一串的成績：FIFO 13 次、LRU 14 次、Optimal 10 次（hit ratio 6/19、5/19、9/19）。這串剛好 FIFO 比 LRU 少，但不能說 FIFO 比較好，換一串可能就反過來，只有 Optimal 永遠最少。

> **例題** page fault 次數分析題。程式的 code 只用一個 page，共 3 個 frame。array A 每個 element 4 bytes、每個 page 1000 bytes → 一頁放 250 個 → A 需要 4 個 page。page 的存取順序是 1 2 3 4 4 3 2 1。
> 1. 每執行一個 instruction 都會 access code 那個 page。load program 時 code page 發生第 1 次 fault，之後一直佔住第一個 frame，不會再 fault。資料只剩 **2 個 frame** 可用。
> 2. 依序讀 1、2、3、4，每一個第一次讀都 fault：4 次。讀完後兩個 frame 裡留下的是 3 和 4。
> 3. 往回讀 4、3 都還在，hit；接著 2、1 都不在，又各 fault 一次：2 次（用 LRU 或其他演算法結果都一樣）。
> 4. 總共 1 + 4 + 2 = **7 次**。
>
> 這就是 data layout 為什麼重要：分析程式的 page access pattern，就知道它會碰多少 page；很多程式切資料時用 4KB 這個數字，就是要對齊 page 大小、減少 page fault。

## 近似 LRU 與 counting 演算法
replacement 演算法還有一大堆，多半是 LRU 的變形，知道概念就好。

### Additional-reference-bits
每頁 8 個 bit，定期把「這段時間有沒有被用到」的 reference bit 移進最左邊（其他 bit 往右移）。把 8 個 bit 當成無號整數，**值越小越久沒用**，就先踢它。

> **例題** 01110111 比 11000100 小，所以 01110111 那頁更久沒被用到，優先被換掉。

### Second chance（clock）
frame 排成一圈（像 FIFO 的 queue），每頁一個 reference bit，被存取時設成 1。指標轉到要換的位置時：

- bit 是 1：不馬上踢，先清成 0、跳過，給它**第二次機會**。
- bit 已經是 0：才真的換掉。

> **例題** 指標依序經過 page 2（bit 1）、page 5（bit 1）都被清成 0、跳過；指到 bit 已經是 0 的 page 1，才把它換成新的 page 6。

這些基本上都在近似 LRU，因為 LRU 有前面那些好處。

### Counting：LFU 和 MFU
前面看的是 recency（多久以前用過）；另一類看 frequency（用了幾次），每頁旁邊記一個次數。

- **LFU（least frequently used）**：次數最少的先踢。問題是常用不代表正在用：程式常在某段時間狂用一塊記憶體，次數衝高，之後不用了卻一直佔著。
- **MFU（most frequently used）**：用最多次的先踢。想法是被用很多次的可能已經用完了（像 for loop 處理完的 array）。這沒有對錯，只是假設不同。

兩個都不受歡迎：每次存取都要加 1，很花時間；次數太多，counter 還會 overflow。而 LRU 的結果通常不比它們差，甚至更好。

## Frame allocation

### 每個 process 最少要幾個 frame
每個指令都有一個最少需要的 frame 數，給太少就跑不起來。

> **例題** IBM 370 的 MVC 指令：直接記憶體對記憶體搬（很多 CPU 只能記憶體到暫存器）。指令本身長 6 個 byte，運氣不好剛好跨在兩頁中間，光 fetch 指令就要 2 個 frame；來源資料只要六、八個 byte 就可能跨過頁界，又是 2 頁；目的地也可能跨兩頁。2 + 2 + 2 = **6**，OS 不保證 6 個 frame，這個指令就跑不動。一般沒這麼誇張，但 2 到 4 個 frame 一定需要。

### Fixed 與 priority allocation
- **Fixed allocation**：照 process 一開始的資訊決定，跟 run time 的狀況無關。
  - **Equal**：100 個 frame、5 個 process，每個 20 個。
  - **Proportional**：照程式大小比例分，aᵢ = (sᵢ / S) × m。
- **Priority allocation**：在 run time 才決定，看每個 process 的 priority，priority 高的比較重要就多給。priority 也能在執行中調，像霸佔 CPU 和記憶體太久的就降它。

> **例題** Proportional：62 個 frame，兩個 process 分別 10 頁和 127 頁，S = 137。
> - 10 / 137 × 62 ≈ 4.5 → 約 **4** 個
> - 127 / 137 × 62 ≈ 57.5 → 約 **57** 個

### Local 與 global replacement
process A 有新 page 要進來時：

- **Local replacement**：只能換掉自己的 page，通常跟 fixed allocation 綁在一起。就像你要 100 個，我只給你 10 個，你就只能在這 10 個位置裡搶來搶去。效果通常不好，因為事前不知道程式會怎麼跑，而程式行為變化又很大。
- **Global replacement**：挑 victim 時，任何程式沒在用的 page 都可以拿來換，通常跟 priority allocation 綁在一起：priority 高的一直去搶低的（例如 A 搶走了 B 一個 frame）。問題是最弱的那個可能被搶到連最少的 6 個都沒有，所以通常要設一個 minimum；更大的問題是 **thrashing**。

一般系統一定用 global 加 priority，但它必須解決 thrashing。

## Thrashing

### 定義
thrashing 的起因是 page fault：要用的 page 不在記憶體，就要去 disk 拿，而 disk 很慢。搬進來之前 CPU 不能繼續，因為正在執行的指令就要這頁；fault 發生在指令中途，沒辦法跟 I/O overlap。page fault 一頻繁，就有大量 I/O。

> **觀念** **Thrashing**：系統花在 paging 的時間，超過執行使用者指令的時間。這時一定看得到：degree of multiprogramming 很高，CPU 使用率卻嚴重下滑。page 因為 page fault，在 RAM 和 disk 之間失控地來回 swap。

```
CPU 使用率
  │            ╭──╮
  │         ╭──╯  │
  │      ╭──╯     │      ← thrashing：像懸崖一樣掉下去
  │   ╭──╯        ╰╮
  │ ╭─╯            ╰──
  └──────────────────────→ degree of multiprogramming
```

之前一直說 degree of multiprogramming 越高越好，能讓 CPU 和 I/O 重疊，CPU 使用率跟著往上升，所以 OS 喜歡一直加。但一直加的結果，每個 process 的 frame 越來越少，fault rate 開始上升，剛用的 page 很容易被踢掉；page 被踢就要 I/O，CPU 開始閒，使用率整個往下掉，又快又兇。

> **比喻** 從 working set 的角度看：程式初始化後大多只用一小部分 code 和 data pages（像大型遊戲，一開始 loading 很久，載入完就順順跑），最常被存取的那些 pages 叫 working set。working set 只佔一小部分時，virtual memory 最有效率；working set 變大、RAM 塞滿，有些 page 被搬出去、要用又搬回來，在臨界點之前還應付得來；一過臨界點，fault 急遽增加，處理 fault 的時間壓過真正的運算，就是 thrashing。

### 惡性循環
為什麼掉得那麼快，不是慢慢降？

1. 本來就有一些 fault；degree 一直加，fault 的機率就一直升。
2. fault 產生 I/O，CPU 開始 idle，使用率往下掉。
3. 早期的 OS 自以為聰明：看到 CPU 閒了，以為是 degree of multiprogramming 太低，於是讓更多 process 進 ready queue，希望 CPU 和 I/O 能重疊。
4. 新來的也要 frame 才能跑，就去跟原來的 process 搶（global replacement）。
5. 本來 fault 就是因為 frame 不夠，現在更少，fault 更多、I/O 更長，CPU 掉更兇，OS 又加更多 process……

所以 CPU 使用率像懸崖一樣掉下去，I/O 時間遠大於 CPU，系統幾乎不動，不是只慢一兩成。解法的關鍵是**控制每個 process 正確的 frame 數**，也就是控制 degree：working set model 和 page-fault frequency。

## Working set model

### 概念
從 locality 出發：給一段 window（例如一分鐘），數這個 process 在這段時間用了多少個不同的 page。用了幾個，就給它幾個 frame：給多了它不用，給少了就會 fault。但 locality 會變（程式先處理一個 array，再換另一個，或跑去某段 function），需要的數量也跟著變，所以 OS 要一直追蹤。

- **Δ（working-set window）**：理論上是一段時間；實作上為了簡單，通常數「最近 Δ 次存取」。
- **Working set**：最近 Δ 次存取裡出現過的不同 page。
- **WSS（working set size）**：working set 裡 page 的個數。

> **例題** Δ = 10，page reference table：
> ```
> … 2 6 1 5 7 7 7 7 5 1 | 6 2 3 4 1 2 3 4 4 4 3 4 3 4 4 4 1 3 2 3 4 4 4 3 4 4 4 …
>                     ↑ t1                                   ↑ t2
> ```
> - t1：過去 10 次是 2 6 1 5 7 7 7 7 5 1，不重複的有 {1, 2, 5, 6, 7}，**WSS(t1) = 5**。
> - t2：進到另一個 locality，過去 10 次是 3 4 4 4 3 4 3 4 4 4，只剩 {3, 4}，**WSS(t2) = 2**。不只 page 換了，數量也變了。

### D 與 m
- WSSᵢ：第 i 個 process 的 working set size。
- **D = ∑ WSSᵢ**：總需求。有 D 個 frame，大家都能順利跑，不會一直 fault。
- **m**：實際可用的 frame 數（實體記憶體大小）。

OS 算出 D 跟 m 比：

- **D > m**（例如 11 > 10）：有人會開始 fault，有 thrashing 的危險。OS **suspend** 一個 process（例如 priority 最低的），把它整個 swap 到 disk，這正是 mid-term scheduler 的工作，直到 D ≤ m。
- **m 遠大於 D**：很多 frame 空著，degree 不夠，就啟動新的 process，或把之前被 suspend 的叫回來。

> **陷阱** 很多人只寫一個 WSS，那是錯的。一定要**每個 process 都算 WSS、加總成 D，再跟 m 比**。

working set 能明顯解決 thrashing，通常能讓 CPU 使用率很高；缺點是 **expensive**：每次記憶體存取都要更新紀錄，每秒幾百萬次，overhead 很高。

## Page-fault frequency（PFF）
更直覺的作法是從 page fault 下手：frame 越多，fault rate 越低。監控每個 process 的 page fault rate，控制在一個範圍中間（例如 5% 到 10%）：

- 超過 **upper bound**：代表 frame 不夠，就多給。
- 低於 **lower bound**：frame 太多，就拿走一些，給超過上界的 process。
- 為什麼不壓到 0%？0% 代表給了太多閒置的 frame，degree 不夠，也不是好事。範圍設多少沒有標準答案，是 tune 出來的。
- 就這樣一直做 balancing。（沒有 free frame 可給時，就 suspend 某個 process。）

跟 working set 最大的差別：**只數 page fault 這個事件**。fault 很少發生，OS 本來就要處理，順手加 1 就好，overhead 小得多。

> **陷阱** PFF 成立的前提是：frame 增加，fault 一定不增加。所以不能有 anomaly，要用 LRU 這種 stack algorithm。

### Working set 和 PFF 是同一件事
從時間軸看 page fault rate，有時高、有時低：進入新的 locality、要重新建立 working set 的時候，rate 衝上去形成一個 peak；兩個 peak 之間就是一段 working set。working set 在 fault 衝高時更新 size，PFF 在超過上界時調整。從哪個角度做都可以，核心都是 locality；locality 會變，所以要在 run time 一直調。working set overhead 高，實務上大家多半觀察 page fault rate。

> **重點** thrashing 是什麼、為什麼會發生（惡性循環）、working set 和 PFF 怎麼做，考試很常問，一定要會描述。

## 重點整理
- virtual memory：只放真的會被存取的 page；程式可比 RAM 大、degree of multiprogramming 提高、寫程式簡單、啟動快
- demand paging（page、O(1) 找空位）優於 demand segmentation；segmentation 在上、paging 在下
- swapper 以 process 為單位，pager 以 page 為單位；pure demand paging 一開始一頁都不放
- valid–invalid bit：i 表示不在記憶體 → page fault（trap）
- page fault 處理：trap → 檢查合法 → 找 disk 位置 → 找 free frame（沒有就 replacement）→ swap in → 更新 page table、設 v → restart（PC − 4）
- EAT = (1 − p) × ma + p × fault time；200 ns、8 ms、p = 0.001 → 8.2 µs（慢 40 倍）；慢 10% 需 p < 0.0000025
- copy-on-write：fork 後共用 page，寫才複製；新 frame 先 zero-out
- memory-mapped file：檔案當 byte array，跳過 file system、快、可 share；缺點是無 access control、易 data loss、難寫；msync／munmap 才寫回
- dirty bit：沒改過的 victim 不用寫回，省一半 disk 動作
- FIFO：踢最早進來的；1 2 3 4 1 2 5 1 2 3 4 5 → 3 frame 9 次、4 frame 10 次（Belady's anomaly）
- Optimal：踢最晚才會用到的；4 frame 6 次；無法實作，當 benchmark
- LRU：踢最久沒用的；4 frame 8 次；stack 或 hash map + doubly linked list 做到 O(1)
- stack algorithm：n 個 frame 的內容 ⊆ n + 1 個；LRU、Optimal 是，FIFO 不是
- 19 個 reference、3 frame：FIFO 13、LRU 14、OPT 10；hit ratio 分母是總存取數
- 近似 LRU：additional-reference-bits（值小先踢）、second chance／clock（bit 1 清 0 跳過）；LFU／MFU 少用
- 最少 frame 數由指令決定（IBM 370 MVC 要 6 個）
- fixed（equal、proportional）vs priority allocation；local vs global replacement（一般用 global + priority，要防 thrashing）
- thrashing：paging 時間 > 執行時間；degree 高、CPU 使用率崖降；惡性循環
- working set：Δ 內不同 page 數 = WSS；D = ∑ WSSᵢ，D > m 就 suspend 一個 process
- PFF：fault rate 超過上界加 frame、低於下界收 frame；overhead 小；需 stack algorithm

## 名詞對照
| 中文 | English |
|---|---|
| 虛擬記憶體 | virtual memory |
| 需求分頁 | demand paging |
| 純需求分頁 | pure demand paging |
| 分頁程式 | pager |
| 置換程式 | swapper |
| 分頁錯誤 | page fault |
| 有效／無效位元 | valid–invalid bit |
| 有效存取時間 | effective access time (EAT) |
| 分頁錯誤率 | page fault rate |
| 寫入時複製 | copy-on-write (COW) |
| 記憶體映射檔案 | memory-mapped file |
| 修改位元 | dirty bit / modify bit |
| 頁面置換 | page replacement |
| 犧牲頁 | victim |
| 參考字串 | reference string |
| 先進先出 | FIFO |
| 最佳置換 | optimal (OPT) |
| 最近最少使用 | least recently used (LRU) |
| 畢雷迪異常 | Belady's anomaly |
| 堆疊演算法 | stack algorithm |
| 參考位元 | reference bit |
| 第二次機會 | second chance (clock) |
| 最不常用／最常用 | LFU / MFU |
| 頁框配置 | frame allocation |
| 等量／比例配置 | equal / proportional allocation |
| 區域／全域置換 | local / global replacement |
| 輾轉現象 | thrashing |
| 工作集 | working set |
| 工作集視窗 | working-set window (Δ) |
| 分頁錯誤頻率 | page-fault frequency (PFF) |
| 區域性 | locality |
