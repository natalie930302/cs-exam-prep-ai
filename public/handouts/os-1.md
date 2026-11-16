# OS概論

作業系統（Operating System, OS）夾在應用程式和硬體中間：上面的程式怎麼使用電腦、下面的硬體資源怎麼分配，全靠它。這一章把整門課的地圖攤開：OS 是什麼、為什麼從 batch 演進到 multiprogramming 和 time sharing、電腦有哪些架構，再進到 interrupt、儲存階層、dual mode 保護，最後是 system call 和 API 的差別、OS 的內部結構與 virtual machine。考試最常考的是：multiprogramming 和 time sharing 的目的、trap 和 interrupt、哪些指令是 privileged instruction、system call 和 API 的差別、microkernel 和 modular 的差別。

## 學完這章要會
- 說出 OS 的角色（control、coordinate）、三種稱呼（resource allocator、control program、kernel）和設計上 convenience 與 efficiency 的取捨
- 比較 batch、multiprogramming、time sharing 的運作方式和目的（系統角度 vs 使用者角度）
- 分辨 multiprocessor、multi-core、many-core，SMP 和 AMP，UMA 和 NUMA，tightly 和 loosely coupled，client-server 和 peer-to-peer，cluster
- 說明 real-time 的定義，hard 和 soft real-time 的差別
- 比較 busy waiting（polling）和 interrupt-driven I/O，畫出 hardware interrupt 與 software interrupt（trap）的處理流程
- 說明 storage hierarchy、caching、cache coherence
- 用 dual mode、mode bit、privileged instruction 解釋 I/O、memory、CPU 三種保護，並判斷一條指令該不該是 privileged
- 分清 system call 和 API：層次、對應關係、為什麼要有 API、參數怎麼傳
- 比較 simple、layered、microkernel、modular 四種 OS 結構，說明 virtual machine 的原理與好處

## 電腦系統的組成與 OS 的角色

### 四個組成
電腦系統可以切成四塊：

1. **User**：使用這台電腦的人。user 不一定是人，也可以是機器、別的程式、別台電腦。物聯網（IoT）裡 device 跟 device 直接溝通，中間沒有人；自動駕駛的車要跟別的車溝通，這時 user 就是別的車。
2. **Application**：user 透過應用程式使用電腦。定義很廣：game、Word、compiler 都算，只要是靠程式達成某個目的。
3. **Operating system**：夾在中間，是應用程式和硬體之間的橋樑。不管把電腦切得多粗，OS 這層都在。
4. **Hardware**：CPU、memory、I/O device。

在 OS 的世界，hardware 叫做**資源（resource）**：只在乎它提供什麼、有多少、怎麼分配。資源分三種：

- **CPU**：computing resource，計算資源
- **Memory**：儲存資源，而且是主要的、比較快的那種
- **I/O device**：例如 disk，或網路的 bandwidth（能傳多少資料）

有些資源因為硬體限制，一次得整個獨占；有些可以切得很細來分。

電腦也可以粗分成三層：上面是應用程式，下面是硬體，中間是 OS，三層缺一不可。新的硬體 device 推出時，也是靠 OS 替它建出一個能用的系統。例如買一顆 SSD 插上去，要先 formatting（格式化）才能存資料，格式化就是 OS 在做的事；device 怎麼被使用完全由 OS 掌控。寫程式碰到 segmentation fault、程式 crash，那些錯誤訊息其實是 OS 給的線索：懂 OS，就知道是哪裡沒照 OS 的規定做。

### Control 與 Coordinate
OS 在中間做的事可以用兩個字概括：

- **Control（控制）**：你跑一個程式，它要 CPU，就由 OS 去控制 CPU，讓它拿到計算的 cycle。這是單方向的控制，實務上多半是寫 driver。
- **Coordinate（協調）**：電腦不會只有一個人、一支程式，大家都在 sharing、搶資源。OS 要協調資源怎麼分，讓每個程式都能跑、又滿足各自的需求。例如 time sharing 把時間切得很細，會造成 overhead、浪費一些計算資源，對系統不算好事，但使用者要的正是大家能同時用。coordinate 比 control 難得多，大部分研究都在這裡。

最早的 batch 系統一次一個人、沒有 sharing，OS 幾乎不用 coordinate。

### OS 是一直都在的軟體，製造一層抽象
OS 本身也是軟體，但它有兩個特別之處：

1. **Permanent**：電腦一開機，OS 就一直在。OS 不見了電腦就不會動，其他程式都沒有這個特性。
2. **Abstraction**：它把下面的硬體抽象化，變成一組 API 讓上面的程式呼叫，就像一台 virtual machine 的介面。API 怎麼定義，就決定了程式看到、使用這台電腦的方式。所以 OS 本身就是一個「虛擬」的概念，這也是 virtual machine 技術很自然的原因：介面可以一層一層往上搭。

抽象成 API 比較接近 control（照定義好的 API 使用資源）；而 OS 只有一個、上面卻有很多 application，大家都得經過這組 API，OS 就能決定怎麼分配（例如這個 CPU time slot 給誰），這就是 coordinate。

### OS 的三種說法
- **Resource allocator（資源分配者）**：先 manage 再 allocate，讓大家用得有效率，又顧到公平、即時等要求。memory 管理分 memory，file system 分 disk block，CPU scheduling 分 CPU cycle，全是分配。
- **Control program（控制程式）**：透過 driver 控制硬體，讓硬體照我的意思做。這部分多半是看 device spec、寫 driver 的苦工。
- **Kernel（核心）**：OS 的別名，而且最常用。「裝一個 kernel」「用哪個 kernel」指的就是 OS。kernel 只有一個；application、compiler、toolchain 都不是 kernel。

> **重點** 前兩個說法是概念，能用自己的話解釋即可；kernel = OS 這個稱呼一定要知道。

### 設計目標：convenience 與 efficiency
使用者對 OS 通常要兩件事：

- **Convenience（方便）**：越接近一般人的產品越重要。Windows 能崛起，就是把圖形介面帶給大眾 PC（更早已有 Xerox Alto、Apple Macintosh 的 GUI，Windows 不是第一個）。
- **Efficiency（效率，即 performance）**：跑程式不要 delay，越快跑完越好。

兩者一定互相矛盾（contradict）：為了方便多加的 GUI 要吃資源、多跑程式，速度一定變慢。所以是 **trade-off**，看使用者在乎什麼：Windows、手機重 convenience；大型程式、科學計算要 efficient 的 OS。早期電腦又少又貴，只在乎效率；現在價格普及，方便變得重要。手機也要取捨：方便很重要，但耗電、能做多少工作也是 efficiency。

### OS 為什麼這麼有影響力
1. **它是 user program 和 hardware 之間唯一的 interface**。程式語言可以選 C、Java、Python，OS 卻只能選一個；換掉 OS，上面整套東西都要重寫或重調。
2. **OS 不能有 bug**。一般程式有 bug 重開就好；OS 一 crash，整台電腦的狀態和上面的程式全沒了。
3. **掌握 OS 就能影響上面的軟體和下面的硬體**。Microsoft 靠一個 OS 成為最有錢的公司：想在 Windows 上跑就得 follow 它的 API。硬體也要跟 OS 搭配，業界稱 Wintel（Windows + Intel）；Apple 硬體和 OS 都自己做，配合更緊。但 OS 也不是完全控制硬體，兩邊互相影響：手機的硬體就是手機，不能逼它變成 PC，OS 得去配合，才有 iOS 和 Android。

### 形形色色的 OS
- x86 PC：Windows；Linux（大型、重要的系統多半選 Linux，和它是 open source 很有關：原始碼公開、可以改；Windows 是商業產品，包得好用但看不到也改不了）；Apple 自己的 OS。Linux 1991 年才出現，比 Windows 晚，它的前身 UNIX 是 1969 年。
- 手機：Android、iOS，Windows 也做過 Windows 10 Mobile；Linux 這邊有 Ubuntu 等不同發行版。
- Embedded（嵌入式）：範圍最廣，IoT 時代各種 device 都要 OS。這種 OS 要很 flexible：新產品一出就能裝，能快速拿掉不要的部分。手機也算 embedded，只是比較 general；Xbox、PS4 上是綁著硬體的 embedded OS；Raspberry Pi 一塊小板子跑自己的 OS，常拿來做嵌入式雛形。

這些 OS 本質一樣，只是依需求調整。

## 整門課的地圖
課本是 Operating System Concepts（恐龍書），分八個 part。書名強調 Concepts：電腦的樣子變了很多，但 OS 的核心概念幾十年沒變。一台電腦最不可或缺的三個要素是：

| 要素 | 對應的 OS 主題 |
|---|---|
| CPU | process（正在執行的程式）：scheduling、synchronization |
| Memory | memory management、virtual memory |
| Storage | file system、I/O |

最前面再加一個 overview（OS 的角色、system structure，其中最重要的是 system call）。後面還有 protection、security、distributed system、special purpose system 等 part。

- **Process**：電腦上同時跑的 process 可能有幾百、幾千個，CPU 卻只有十幾、幾十個。OS 最重要的工作之一就是 **scheduling**：決定現在輪到誰。process 之間還要共用資源、互相溝通，就會遇到 **synchronization（同步）**，通常是整本書最難的部分：它要像演算法一樣嚴謹地證明正確，不能靠跑程式驗證，因為可能的執行順序太多，跑一次只看到那一次的結果。
- **Memory**：內容最多、最複雜。
- **Storage**：大家天天在開檔、存檔，比較好想像，但很雜，因為儲存和 I/O 是變化最大的部分（例如觸控螢幕就是新的 I/O device）。file system 要決定的一件事是：檔案內容到底放在硬碟哪裡，也就是把資料放到 physical device 上。
- **Distributed system**：早期電腦貴、網路不發達，各用各的；現在雲端、big data、IoT 都不是一台電腦做得完，要把很多電腦連起來，讓它們像一台電腦一樣做事。
- **Special purpose system**：車子、核電廠、武器、太空梭裡都是電腦在控制，一樣需要 OS，但設計考量完全不同。
- **Protection / security**：系統就像一個家，沒有 security，別人隨便闖進來，當然不是好系統。

## OS 的演進：Mainframe
**Mainframe** 指最早期的電腦：體積超大、非常昂貴，只有國家級研究或特殊單位用得起。特性是 I/O device 很慢、計算力比較強、做的事很單一（例如只管銀行的某件事，或只做科學模擬）。今天專門處理某件事、而且是大量工作的機器仍叫 mainframe，例如銀行的 server；它特別要求 **reliability**（有 component 壞掉整台也不會 crash）和 **security**（不能被 compromise）。

mainframe 上的 OS 經過三代：**batch → multiprogramming → time sharing**。後兩者到今天的電腦都還在用，是最 fundamental 的概念。

### Batch（批次）
最早的程式寫在打洞的卡片上，一疊卡片就是一個程式。一台電腦一次只處理一個程式，做完一個才輪到下一個，所以叫 batch（Windows 的 .bat 批次檔也是這個字）。每一疊卡片的結構跟現在的程式很像：

1. 開始卡：說「我要開始跑程式」，上面有 ID
2. 程式本身
3. Load 卡：把程式 load 進 memory（CPU 讀不到硬碟，只能 access memory，所以一定要先 load）
4. Input 卡：執行中需要的輸入
5. 結果 output 成另一張卡（或印到 printer）

那時 memory 只切兩塊：一塊給 OS（OS 也是程式，也要佔 memory），一塊給 user。反正沒人搶，用完整個清掉換下一個人。卡片順序由使用者自己排，排錯就 fail。

> **陷阱** 很多人各帶一疊卡片來，誰先誰後是 **operator（一個人）** 決定的，不是 OS 的 scheduler。OS 只做 **transfer control**：在 job 和 job 之間做 initialize 與 clean up，把控制權交給下一個程式。

一次只有一個人跑，他有 total control，也沒有 security 問題。

**Batch 的三個問題：**
1. **One job at a time**：後面的人只能等。
2. **No interaction**：卡片丟進去、結果吐出來，中間想改什麼都插不上手。
3. **CPU 常常 idle**（最嚴重）：電腦超貴，CPU 卻常在發呆。任何程式只做兩件事：要嘛在算（用 CPU），要嘛在做 I/O。CPU 是電子的、讀卡片是機械的，CPU 遠比 I/O 快；電腦裡只有一個程式時，它去做 I/O，CPU 沒人可服務，只能 idle。

> **陷阱** batch 的 CPU 使用率低，不是因為 CPU 慢，而是做 I/O 時沒有別的 job 可以用 CPU。CPU 遠快於 I/O 這件事到今天仍然成立。

兩個解法：一次一個 job 和 CPU idle → **multiprogramming**；沒有互動 → **time sharing**（切換得很快，人比電腦慢太多，電腦可以偷偷處理很多人的事，讓每個人以為自己擁有整台電腦，其實它還是一步一步做）。

### Multiprogramming
目標：就算程式在做 I/O，也讓 CPU 一直有事做。方法：在 memory 裡同時放好幾個 program（OS、Job 1、Job 2、Job 3…）。Job 1 去做 I/O，CPU 不等它，馬上換 Job 2；Job 2 去做 I/O，再換 Job 3。

```
Batch：
CPU  ███░░░░░███░░░░░███      ░ = CPU idle（在等 I/O）
I/O     █████   █████

Multiprogramming：
CPU  J1█ J2█ J3█ J1█ J2█ ...  幾乎沒有 idle
I/O     J1██ J2██ J3██ ...    一個做 I/O 時，另一個用 CPU
```

關鍵字是 **overlap**：一個程式做 I/O 的同時，另一個在用 CPU。放的程式越多，越能保證隨時有人要用 CPU，**CPU utilization** 就提高。

**Spooling**：要讓 CPU 和 I/O 同時運作，第一個先決條件是 spooling（Simultaneous Peripheral Operation On-Line）。I/O device 其實很被動，若要 CPU 不斷下指令、盯它的狀態，CPU 就沒空做別的。

> **比喻** 主管叫屬下做事，結果屬下寫一行字就跑回來問「接下來要幹嘛？」，主管整天都在下指令，自己的事都做不了，更別說多工。

spooling 的做法：例如從 disk 搬一個 1 GB 的檔案到 memory，這段時間 CPU 完全不用管，去做自己的計算；I/O 做完再 **notify** CPU，CPU 才回來處理剩下的事。教科書常見的例子是印表機：要印的資料先放到 disk 的 buffer，印表機慢慢印，CPU 繼續做別的。spooling 只是概念，真正實現它的機制是 **interrupt**，整個 OS 可以說是被 interrupt 驅動的。

**Multiprogramming 要 OS 管的事：**
- **Job scheduling**：程式寫好、compile 好後存在 disk；要挑哪些 load 進 memory、讓它變 active？早期或 embedded 系統 memory 有限，不能全放。現在 memory 很大，通常都 load 得進來，job scheduling 就沒那麼重要了。
- **Memory management**：每個 job 分多少空間？程式還會動態要 memory。
- **CPU scheduling**：CPU core 比 job 少得多（64 核已經很厲害，memory 裡卻可能有幾百個 job），從 memory 挑一個 job 放到 core 上跑。
- **Interrupt**：實現 spooling。

補充：現在很多 I/O device 上有自己的小 chip（coprocessor），幫 CPU 處理 I/O 的計算，讓 CPU 專心算難的。

### Time sharing（分時）
multiprogramming 提高了 CPU 使用率，但使用者還是覺得不好用：對單一程式來說，行為一模一樣，甚至更慢（CPU 有限，還得讓給別人）。使用者要的是：

- **Interactive**：隨時跟程式互動，也就是很頻繁地在 I/O 和 CPU 之間切換
- 很多人同時用，卻感覺不到別人

解法是 **time sharing**（也有人叫 multi-tasking，但這名字容易搞混）：不是一次跑一個 job，而是用「時間」切 CPU，A、B、C 輪流，每個只跑幾個 millisecond 就換人，看起來大家都在同時跑。CPU 頻繁切換，隨時檢查 I/O device（以前是鍵盤，現在是觸控螢幕）有沒有 input，你一按鍵系統就立刻處理，於是有互動的感覺。

> **重點** 跟 multiprogramming 最大的差別在「什麼時候換 job」：multiprogramming 是做完或去做 I/O 才換；time sharing 是 **time slot 一到就 switch**。現在的電腦能同時跑幾百個程式，靠的就是這種固定時間換人的 CPU scheduling。

**Time sharing 帶出的新問題**（剛好對應後面各章）：
- **Virtual memory**：切換頻繁，要 CPU 一直有事做，就得塞更多程式輪流（可能是以前的十倍、百倍），memory 不夠，於是把 disk 當 memory 用：資料在 disk 上，程式卻以為它在 memory。
- **File system**：使用者最常做的是開檔、編輯、存檔，需要 file system 管 disk 上的檔案。
- **Synchronization**：很多應用由好幾個程式合作完成，同時改同一個 counter 就會亂掉。最簡單的做法是 **lock**（我在用就鎖起來）；但 lock 用多了會你擋我、我擋你，誰都動不了，叫 **deadlock（死結）**。為什麼難？每幾 ms 就切換，切點在很低階的指令之間：`count++` 其實是 load、add、store 三條指令，中間就可能被換掉。

### 三種系統的目的
| 系統 | 做法 | 目的 |
|---|---|---|
| Batch | 一次只跑一個 job，一個人獨占整台電腦 | 當作比較用的 baseline |
| Multiprogramming | memory 裡放很多 program，I/O 時換人用 CPU | 提高 **CPU utilization**（系統的角度） |
| Time sharing | 用時間切 CPU，time slot 到就換 | **Interactive**、很短的 **response time**，多人 sharing（使用者的角度） |

> **陷阱** 常考：multiprogramming 是從系統出發（CPU 使用率）；time sharing 是從使用者出發（互動、反應時間）。不要把兩者的目的對調。

## 電腦系統架構
不管什麼電腦都會碰到上面的 OS 問題，但硬體的組成五花八門。

### Personal computer
最單純的電腦只有一個 single core，早期的 PC 就是這樣；「personal」是每個人都能有一套自己的電腦系統。使用者最在乎 **convenience** 和 **responsiveness**（按一下要等好幾秒就不爽），所以現在的電腦幾乎一定是 time sharing。I/O device 演進很快：鍵盤 → 觸控 → 聲控。PC 的 OS（Linux、Mac OS、Windows、Android）都有很好的 GUI（Graphical User Interface）。

缺點是 **security** 差，尤其早期 Windows：一是 PC 發展早，software architecture 沒定義好，只求快點能動，容易被找到漏洞；二是當初根本沒想到 Internet，只要使用者不破壞自己的電腦就好。現在電腦都連網，會有外來、未授權的人透過網路改你的東西（例如 ATM 被植入病毒、自動吐鈔的新聞）。

### Multiprocessor（tightly coupled）
計算量越來越大，現在的電腦裡通常有很多個 core，透過 system bus（硬體的線）緊密連在一起，叫 **multiprocessor system**，也叫 **tightly coupled**：買來一個盒子，裡面全用硬體的線接好。I/O 共用，memory 也共用（**shared memory**），所有 core 上的程式看到同一份 memory 內容，例如同一個 x；兩個 core 同時改它，就有 synchronization 問題。一顆四核、八核的 CPU 本身就是 tightly coupled 的平行系統。

好處：
1. **Throughput**：同樣空間塞更多核心，每秒完成的計算量高。
2. **Economy**：memory、I/O、主機板共用，比拆成很多台獨立電腦省錢。
3. **Reliability**：一個 core 壞了，其他還能跑。

前兩個最重要。

### SMP 與 AMP
依 processor 扮演的角色分：

| | Symmetric（SMP） | Asymmetric（AMP） |
|---|---|---|
| 角色 | 每個 core 角色相同，沒有 master；程式放哪個 core 由 OS 決定 | 一個 master core 管理其他 core，指令先經過它再分派 |
| 優點 | 每個 core 都在算，loading 分擔、使用率高；簡單 | 有人統一管，可以 scale 得比較大 |
| 缺點 | 不同 processor 上的程式要同步，需要 locking 等機制；靠 protocol 協調是 overhead，core 數 scale 不大 | master 不做使用者的計算，等於浪費 |
| 用在 | 一般消費性電腦、手機（現在幾乎都是 SMP） | 超級電腦等要非常多核心的系統 |

### Multi-core 與 cache coherence
一顆 CPU chip 上有很多 core，叫 **multi-core processor**，是最 tightly coupled 的方式（燒在同一個 chip 上）。memory 在主機板上，所有 core 共用；但 memory 和 register 之間有多層 cache（L1、L2、L3），L1 最靠近 register，每個 core 各有一份。同一份資料會被 copy 到不同 core 的 cache；Core 0 改寫時若只改到自己的 cache，copy 之間就不一致。現在用 hardware 解決：改寫時確保反映到 memory，或至少反映到所有存了這份資料的 cache。這很重要，因為程式常被換來換去：先在 Core 0 跑，幾 ms 後換到另一個 core，同一個變數你沒動它，就該看到同一個值。這叫 **cache coherence**。

### Many-core：GPGPU 與 SIMD
**Many-core processor**：同一個 processor 上核心數到幾百個。最常見的是 **GPGPU**（General-Purpose GPU）：拿顯示卡做一般計算，因為很多計算跟圖形計算同型，丟到 GPU 上快很多。

GPU 塞得下幾百個 core，是因為它是 **SIMD**（Single Instruction, Multiple Data）：就算有 700 個 processor，同一時間只能做同一條指令（例如大家都「乘以 2」），但這條指令同時套在不同資料上。很適合 array、matrix 這類線性代數運算；有很多 if-else、同一時間大家要做不同事的程式就不適合。Intel 的 Xeon Phi 介於 CPU 和 GPU 之間（約 60～72 個 core），比較 flexible，不一定要 SIMD；Tile64 放的是傳統 CPU，但在 chip 上的 interconnect（晶片內網路）下了很大功夫，因為東西塞在小空間又共用，不減少 congestion，跑 64 個 CPU 結果可能像只有 1 個。

### 用「買電腦」來分
- **Multiprocessor computer system**：打開機殼，主機板上有多個 CPU 或 GPU 插槽。還是一台電腦，只是多個 processor 在同一塊 motherboard 上。
- **Multi-core**：單一個 processor 裡有多個 core，它本身還不算一個 computer system。
- 兩者可以結合：multiprocessor 系統上插 multi-core 的 processor。
- **Many-core**：也是單一 device，但本身就像一台小電腦，在整台電腦裡看起來是一張插卡（例如插 8 張 GPU 卡、每張 100 多個 core）。

### UMA 與 NUMA
從 memory 的角度看 multiprocessor：

- **UMA（Uniform Memory Access）**：大家用同樣方式接上 memory，**memory access time 相同**，程式跑在哪個 core 都一樣快，最適合 SMP。你的電腦和手機都是。缺點：CPU 一多，大家搶同一條 memory bus，contention 變多，memory 變成 bottleneck。
- **NUMA（Non-Uniform Memory Access）**：用 hierarchy 管：例如 CPU 切成四區，每區有自己的 **local memory**（存取最快）；其他區的叫 **remote memory**，也連得到，但要先跟那塊的 controller 溝通，比較慢。好處是可以 scale 得很大；缺點是存取時間不一樣，資料擺哪裡影響效能：程式跑在左上角、memory 配在右下角，就變 remote access。好的 OS 會自動管理，或至少給 flag 讓你指定程式跑哪裡、只從 local memory 要空間。高效能、scale 很大的系統多半是 NUMA。

> **陷阱** UMA／NUMA 的 uniform 指的是 **memory access time 是否相同**，不只是接線方式。

### Distributed system（loosely coupled）
透過網路把很多電腦連起來（例如學校把電腦串起來做同一件事；廣義來說 Internet 也是）。跟 tightly coupled 最大的差別：**每台電腦有自己的 memory，全是 local、不共用**；連到別人的電腦，不代表能直接用他的 memory，一定要透過他的程式、他的 OS。

目的：
1. **Resource sharing**：去別人那裡抓檔案、照片。
2. **Load balancing**：一台工作太多，移一些給另一台。
3. **Reliability**：每台獨立，一台壞了不影響另一台；雲端用很多台電腦就是為了這個，工作和資料都能交給別台、備份在多台。相比之下 multiprocessor 是同一台，memory bus 一壞整台就毀，reliability 有限。

**Client-server**：就是 master-slave。所有事情經過 server 的 centralized control（例如 FTP server 和 client）。比較好蓋，但 server 往往是 bottleneck，也是單點失效。data center 仍常用它，但會下很多功夫：用十台、二十台當 server，master 壞了立刻交給 backup server；或把重的計算交給 client，server 只處理最重要、最快做完的事。

**Peer-to-peer**：沒有 server，每台都是 peer、角色相同，大家 follow 同一套 protocol 溝通。最重要的特點是**沒有 single point of failure**：任何一台離開系統照樣運作，非常 reliable，loading 也平衡。例子：串流（全世界同時看奧運，影音資料量太大，不可能大家都從同一台 server 拷，實際上互相分享、就近讀片段）。Internet 就是標準的 peer-to-peer：沒有任何國家或組織管它，它卻不會 break；要消滅它只能拿掉所有連著的電腦。

> **陷阱** client-server 的弱點在 server（bottleneck、single point of failure）；peer-to-peer 沒有 single point of failure。

**Cluster（叢集）**：分散式系統中比較特殊的子集合，用 **local area network** 連在同一個機房，頻寬高、溝通快（相比 Internet 可能從台灣連到美國）。宿舍自組的 cluster 用一般 Ethernet；高效能 cluster 和超級電腦用 **InfiniBand**：快約十倍、也貴十倍以上，快在 **RDMA（Remote DMA）**：DMA 讓資料搬移不必經過 CPU，RDMA 把這招延伸到跨網路。cluster 也能分 symmetric、asymmetric（例如十台裡一台當 master）。

### 統整：從一顆 core 到整個 Internet
```
single-core   最早期的 PC
   ↓
multi-core    一顆 CPU 裡很多 core（例如手機）
   ↓
multiprocessor 主機板插好幾個 CPU／GPU（一般 PC、server）
   ↓          ── 以上 tightly coupled：在同一個 box 裡
cluster       很多台用 LAN 串起來，單一管理者、軟體可能都一樣
   ↓
distributed   最 general：能溝通完成一件事就算（Internet、雲端 data center）
              ── loosely coupled：跨網路的很多個 box
```

## 依用途分的特殊系統
每種用途的系統都可以用各種架構，這裡只看用途。

### Real-time system（即時系統）
很多人以為 real-time 就是很快。定義其實是：**慢慢做沒關係，重點是每個工作要在 deadline 之前做完**。所以 real-time 系統最 critical 的是 **scheduler**：排出讓每個工作都趕上 deadline 的順序。

> **例題** 手上有三份作業 A、B、C，各有自己的截止時間，其中 B 最早到期、C 次之、A 最晚。若照拿到的順序 A → B → C 寫，寫完 A 再寫 B，B 就遲交了。改用 **Earliest Deadline First（EDF）**：誰的 deadline 最早先做誰，順序變成 B → C → A，三份都準時。單一 CPU、可以 preempt 時，只要有任何排法趕得上，EDF 就一定趕得上；但工作量超過 CPU 負荷時，誰都保證不了（細節在 CPU 排程章）。

deadline 不是亂訂的，是使用者能接受的 response time 或 reaction time，或做某個決定的關鍵時間點，通常不寬鬆。車子可以想成多了四個輪子的電腦：踩油門要動、踩煞車要及時停，這些都跟時間有關，負責讓它們準時發生的就是 real-time OS。武器、醫療設備、各種 control system 也都是。

| | Soft real-time | Hard real-time |
|---|---|---|
| 定義 | 盡量在 deadline 前做完，沒做完也不會出大事 | miss 任何一個 deadline 都是 fundamental failure |
| 做法 | 用 priority：照優先順序盡量做 | 必須保證 |
| 例子 | multimedia、串流影音 | 汽車、武器等重要 control system |

soft 的例子：收訊差時串流影音先出現影像的框、大致輪廓，好一點開始有顏色，再好一點解析度上來，因為它 prioritize：重要的線條先送，高解析度細節後送。

hard real-time 的挑戰：一是 scheduling algorithm；二是通常**沒有 secondary storage**（memory 是 primary storage，memory 以外的 disk 等叫 secondary storage），資料全放 memory。原因不只是 disk 慢，更是 **disk 的讀取時間不好掌握**，不知道要花多久就沒辦法保證 deadline。你的電腦硬體其實差不多，能不能變成 real-time，是 OS 控制的問題。

### Multimedia system
處理圖形、speech、video、audio，通常是 **soft real-time**。分 on-demand（看存好的影音檔）和 live（直播），傳輸時可先 buffer。這類系統都有重要的壓縮技術：資料太大，但不是每一點都重要；各種格式各有取捨（檔案小但畫質差、解壓快、壓縮快），看情境挑。

### Handheld 與 embedded system
能帶著走、體積小（例如手機）。跟一般電腦最大的差別是硬體 **specialized**（手機沒有鍵盤，拿掉很多東西才做得小），所以 OS 也要 customize，很多 component 用 modular 的方式加減。不會把傳統 OS 裝到手機上：傳統 OS 光跑自己就吃掉大部分資源，而且對電力管理很差甚至沒有（插著電誰管用了多少？手機可不行）。手機 memory 小、processor 慢，所以把東西丟到雲端算；電力非常 critical。display 和 I/O 方式也一直需要改進。

### Cloud computing 與 IoT
**Cloud computing**：透過 internet，把 internet 當成自己的電腦用。**IoT（物聯網）**：把所有物品連在一起計算、溝通。這些新系統都需要新的 OS。系統名詞不用背，重點是聽到一種系統時，知道它的設計考量、跟一般系統差在哪。

## 電腦怎麼運作：I/O 與 interrupt

### von Neumann 架構與 OS 的工作
電腦用 **von Neumann 架構**：CPU 負責算，memory 放程式和資料，加上 I/O device，用 **bus（匯流排）** 全連起來。OS 跑在上面要做：

- **Control**：指令在 CPU 執行，指令要用的 data 一定在 memory，結果可能寫到 I/O device（例如存進硬碟）。
- **Coordinate**：很多程式 concurrent 地跑又不能出錯；最基本的「錯」就是我的程式改到你的 memory。讓大家同時共用資源又互不干擾，是 OS 的責任。

這裡講的是 **protection（保護）**，不是 security：protection 是正常使用下一個人不會影響別人（一個程式 crash 不能讓整台 crash）；security 處理惡意的、透過網路的攻擊。

> **陷阱** Protection ≠ Security。protection 處理正常使用下程式之間互不影響；security 處理惡意攻擊。

### Device controller 與 buffer
CPU 要對 disk 讀寫一筆資料時，資料一定要經過 **device controller（控制器）**，它是一塊硬體，負責最 low level 的控制，例如控制硬碟讀寫頭的轉動和移動。controller 上一定有 **buffer**：I/O device 很慢、CPU 很快，中間要緩衝。buffer 通常不大，controller 怎麼設計、buffer 多大，決定了這個 device 每秒最多搬幾個 byte。

controller 上有兩種 register：
- **Status register**：現在的狀態，busy（正在做 I/O）或 idle
- **Data register**：另一個小 buffer，資料可以很快先寫進來

一次 I/O 分兩段：

```
device ──(controller 自己做，裡面有小 chip)──> buffer ──(CPU 下指令)──> memory
```

controller 是被動的，不會自己決定做什麼；整台電腦真正的老大是 CPU。

### Busy waiting（polling）
早期最直接的控制方法：整個 I/O 過程 CPU 自己在旁邊盯著。例子：把一個字串輸出到 device。

```c
// 把字串 p 一個字元一個字元送到 device，字串以 '\0' 結尾
while (*p != '\0') {
    while (peek(status) == BUSY)
        ;              // buffer 滿了：一直 peek，問「好了沒」
    poke(data, *p);    // 把這個字元寫到 controller
    p++;               // 先 poke 再 p++，順序反了會跳過第一個字
}
```

外層迴圈一個字一個字送；buffer 很小、很快就滿，所以每次寫之前都要用 **peek** 偷看 controller 的 status，BUSY 就卡在內層 while 裡一直 peek，等 OK 了才 **poke** 下一個字元。

問題：搬一個 byte 可能要好幾 ms，對 CPU 是超長的時間。真正在寫的時間只有一點點，大部分時間都在等；字串越長浪費越多。而且程式 A 做 I/O 時還霸佔著 CPU，CPU 和 I/O 無法 overlap；就算 memory 裡放了很多程式（multiprogramming），B 也輪不到 CPU。最諷刺的是 CPU 使用率看起來 100%，其實都在做無意義的 peek。這種方式也叫 **polling**。

### Interrupt-driven I/O
現在的電腦改用 **interrupt（中斷）** 驅動，也就是 **event-driven**：平常各做各的，有事件發生才通知、才處理。interrupt 可以改變 CPU 執行的 flow：CPU 正在跑某程式，interrupt 隨時能打斷它，叫它先去做別的事。

```
CPU：  ▔▔▔▔▔▔▔▁▁▔▔▔▔▔▔▔▁▁▔▔▔▔    高 = 跑使用者程式；低 = 在 OS 裡處理 interrupt
I/O：  ▁▁▁▁▁▁▁▔▔▁▁▁▁▁▁▁▔▔▁▁▁▁    低 = 傳輸中（busy）；高 = idle
              ↑ buffer 滿／傳完 → 發 interrupt，CPU 去搬資料，搬完 return
```

程式在 CPU 上算的同時，I/O 也在傳；傳到一個段落（例如 controller 的 buffer 滿了），要把資料搬進 memory 得靠 CPU，device 就發 interrupt 通知 CPU；CPU 被打斷，切到 OS 裡負責這個 I/O 的 **routine** 去搬資料；搬完 interrupt 結束，CPU 回去跑原來的程式（**resume**，不會被 kill），I/O 繼續傳下一批。

**用 interrupt 完成一次 I/O 的完整流程：**
1. CPU 正在跑程式 A，程式 B 在等著。A 要輸出一個很大的檔案（例如呼叫 printf）。
2. A 不能直接碰硬體，呼叫 OS（system call），一路走到最底層的 **device driver**。
3. driver 用 interrupt 的方式 initiate 這次 I/O：CPU 下一道指令給 controller，交代要搬多少（例如 200 byte），並說好「搬的過程別找我，全搬完再通知我」。
4. controller 自己開始搬。A 要等 I/O 做完才能跑下一行，所以停在旁邊等；CPU 不閒著，switch 到 B。
5. 全搬完，controller signal 一個 interrupt；資料已在 memory 指定的位置。
6. CPU 打斷 B，執行 OS 的 **interrupt handler**：確認 I/O 做完，把 A 改成可以執行（ready）。
7. 現在 A、B 都 ready，誰先跑由 **CPU scheduling** 決定（可能讓 B 繼續，也可能 A 的 priority 高先跑 A）。

滑鼠的情況不同：沒有程式先發起 I/O，是 hardware 直接丟出 signal；OS 叫出負責滑鼠的 handler，處理完再呼叫顯示的程式把游標畫到新位置。這些步驟全在 OS 內部完成，沒經過任何使用者程式。

所有 OS 都是 interrupt driven：有事要處理才把 OS 叫醒；沒事時最好一條指令都不跑，CPU 就 idle（所以常看到 CPU 使用率很低），但隨時能反應。

### Hardware interrupt（signal）與 software interrupt（trap）
| | Hardware interrupt | Software interrupt |
|---|---|---|
| 來源 | 任何 device（鍵盤、硬碟、滑鼠），不是程式裡的指令產生的 | 一定是使用者程式引起 |
| 性質 | **被動**：程式跑得好好的突然被打斷，任何兩條指令之間都可能 | **主動**：程式自己發出，例如要做 I/O，然後把自己 suspend，等完成再被叫醒 |
| 別名 | **signal** | **trap** |
| 找處理程式 | **interrupt vector**（硬體固定的陣列） | OS 依編號分流（switch-case／system-call table） |

software interrupt 有兩種：
1. **不預期的錯誤**：除以 0、segmentation fault（存取了不該碰的記憶體）。CPU 執行到錯誤就產生 software interrupt，由 OS 接手（例如把 program counter 移到印錯誤訊息的地方），所以整台電腦不會當掉，還能印出錯誤訊息。
2. **System call**：程式請 OS 幫忙時呼叫的介面，最常見。它跟一般 function call 最大的不同：一般 function call 只是把 program counter 跳過去；system call 一定要透過 interrupt。為什麼要繞這一圈？為了 **protection**：透過 interrupt，OS 能分辨這是 OS 的功能還是一般函式，並檢查合不合法；合法清單事先定好，使用者繞不過。

為什麼叫 trap（陷阱）？程式本來要做別的事，卻被這個 interrupt 困進 OS 裡，由 OS 決定怎麼辦。

> **陷阱** 把 hardware interrupt 叫 signal 是部分教材的用法；恐龍書把 software 產生的中斷叫 **trap 或 exception**。UNIX 的 signal 另指 kernel 送給 process 的非同步通知。答題時以課本說法為準，trap = software interrupt。

### Hardware interrupt 的處理流程
1. 程式正在跑，使用者動了一下滑鼠。偵測到 signal 的是硬體（主機板），跟軟體無關。
2. 查 **interrupt vector**：一個陣列，每格只放一個 **function pointer**（處理程式在哪裡）。只放 pointer 是因為每個處理程式大小不同，塞不進固定大小的格子，所以每格只放 4 byte 的 pointer。
3. 每個 signal 帶一個 **signal number**，依編號找到對應那格（例如第 2 格）。裝 driver 做的事，就是把那一格的 pointer 改成指向新 driver 的程式碼。
4. 依 pointer 跳到真正處理的程式，叫 **service routine**（OS 提供的一項服務）。
5. interrupt 發生時 OS 先記下被打斷的是誰，以及它的 **program counter**；處理完 **restore**，讓那支程式從正確位置 resume。做完一定要 return，而且不能影響原程式。

interrupt vector 是固定的：有幾格、能處理哪些編號跟硬體綁死，只能換格子裡的 pointer。（常駐在 memory 裡的那部分 OS 舊稱 **resident monitor**。）

### Software interrupt 的處理流程
程式自己需要 OS 幫忙（呼叫 system call，或除以 0 讓 OS 必須出手）：一樣先記下自己跑到哪，然後 trap 進 OS。不同的是 OS 依編號用 switch-case 分流，不是固定的陣列：system call 數量是 unbounded（一個 OS 定義 100 個，另一個定義 1000 個都行），不可能燒死在硬體上；甚至可以 load 一個 kernel module 新增 system call。每個 system call 有自己的編號，OS 依編號找到對應 routine 執行，做完 return 回呼叫的程式。恐龍書的描述是：trap 也經 interrupt vector 的一格進 kernel，再用編號查 OS 自己的 system-call table。

### 共同架構與「中斷中的中斷」
不管 hardware 或 software，一定有三樣東西：
1. **Interrupt vector**：只存 function pointer
2. **Interrupt handler／service routine**：真正做事的程式，可以被改寫（例如裝新 driver）
3. **記住被打斷者的位址**（program counter），不然跳到 OS 之後回不來

routine 跑到一半又來一個 interrupt 怎麼辦？每次被打斷，register 和程式狀態都要能還原，要記很多東西，這是 overhead；一直被打斷還會產生嚴重的 synchronization 問題。OS 必須非常快（理想上你感覺不到它存在），所以 service routine 常用 **assembly language** 寫。像 Linux 這種重效能的系統，處理 interrupt 時會先 **disable** 後來的 signal（當作沒看到，要的話再送一次）。interrupt 也可以被 **mask**：分高低優先權，高的在處理時低的全部被忽略。所以有時動滑鼠電腦沒反應，可能正卡在一個比較重要的 interrupt routine 裡。

## Storage hierarchy（儲存階層）
資料用階層的方式存放：**越上面越快、越小、越貴；越下面越大、越慢、越便宜**。速度、容量、價錢互相牽制才疊出這種結構。錢有限又要效率時，用階層通常最好；但每層多大、放什麼要設計好，設計不好花大錢也不會變快。

```
register          CPU 裡，最快最小
cache L1/L2/L3    多核心時 L1 每個 core 自己有，L2、L3 可能共用
main memory       CPU 能直接存取的最後一層
────────────────  ↑ volatile（斷電就沒）   ↓ non-volatile
secondary storage hard drive、SSD、flash
光碟
tape（磁帶）      便宜、容量大、不易壞，大型系統的最後一層仍是 tape
```

儲存技術一直進步（Flash、SSD、non-volatile memory 會插進中間），但有**三件事不變**：
1. **速度**：上層一定比較快，製程決定的。
2. **價錢**。
3. **Volatile 與否**：volatile 就是一關電資料就沒了，memory、cache 以上全是。系統一 crash，這些層的資料就救不回來。non-volatile memory 跟 memory 差不多快、斷電不掉，但比較貴，也只放在中間。

### Main memory 是分界
main memory 是 CPU 能直接存取的最後一層：資料一定要在 memory，CPU 才能用；I/O device 它不能直接讀。上面的 register、cache 都只是 copy，最後以 main memory 上的資料為準。main memory 用的技術叫 **RAM（Random Access Memory）**。下面的 secondary storage CPU 不能直接讀，要先搬到 memory，越往下越慢，所以 real-time 系統不用它。secondary storage 比較大（因為便宜），而且 non-volatile；最標準的是硬碟，SSD、flash、non-volatile memory 也都算。

### DRAM 與 SRAM
| | DRAM | SRAM |
|---|---|---|
| 結構 | 每個 bit 只要一個電晶體 | 較大 |
| 特性 | 小、便宜、省電，但較慢 | 快，但大、耗電、貴 |
| 用途 | main memory | L1、L2、L3 cache |

近年 DRAM 進步比較多的是存取它的 bus：買電腦聽到 DDR 第幾代，講的就是這條 memory bus。core 越來越多、大家搶著讀 memory，這條通道常是真正的 bottleneck。大部分技術都有 trade-off（越快越貴）：如果某技術全面勝出，舊的早就從 hierarchy 上消失了。

**Random access** 的意思是：讀任何位置花的時間都一樣，讀第 1 個 byte 跟第 100 個沒差，效能一致、可預期（跟 UMA 的想法類似）。

### Hard drive：位置決定時間
硬碟是**機械式**的：一支讀寫手臂上有很多磁頭，底下疊著好幾片磁碟；磁碟會轉、磁頭會移，才讀得到任何位置。所以資料放在哪，跟讀取要多久有絕對關係：磁頭剛好在附近就快；資料在磁頭對面，就得等磁盤轉過來。

```
讀取時間 = transfer time + positioning time
transfer time    ：只跟資料量有關，越多越久
positioning time ：seek time（把磁頭移到磁軌）+ rotational latency（等資料轉到磁頭下）
                   跟磁頭現在的位置有關，時間不固定
```

因此硬碟**不是 random access**。7200 轉、5400 轉：轉得越快，rotational latency 越短，價錢也越高。

### SSD 與硬碟
SSD 是**電子式**的，跟 memory 很像，只是斷電資料不會掉；沒有轉磁盤找位置的問題，等於去掉了 positioning time，所以隨機讀取明顯比硬碟好。但如果讀的是連續的、量又夠大，transfer time 遠大於 positioning time，硬碟不會輸 SSD 太多。SSD 真正贏在讀取跳來跳去的時候，例如開機（booting）。所以很多人買一顆小 SSD 裝 OS，要大空間、一次讀一大堆的檔案放硬碟：照 device 特性設計系統。

### Caching
資料最終存在最慢、空間最大的 device（例如 disk，這份是「本尊」）；每次都去那裡讀太慢，所以讀過一次就 **copy 一份**放到比較快的 device，用得越頻繁就 cache 到越上層。

- caching 是 **copy 不是搬移**，後面一定還有一份。cache 的定義：那份 copy 是暫時的，隨時砍掉都不該造成資料遺失。
- CPU 要資料時先到最近的一層找，有就直接讀；沒有（**miss**）就往下一層找，最後一定找得到；讀回來時順便 cache 在上面幾層。
- 所以 cache miss 反而比較慢（一層層檢查、回來還要 copy，有時比沒有 cache 還慢）。但程式存取有 pattern（常用的就是那些），第一次 miss 慢、之後很快，整體變好。
- 反例：**big data** 資料大到 memory 塞不下，通常讀一遍就丟、不回頭重讀，下次回來早被擠掉了，這類系統甚至不做 cache 反而更快。

### Cache coherence 與 consistency
cache 只是分身，不能跟本尊不一樣。不一樣就有 **coherence**（也叫 **consistency**）問題。例如改資料時通常只改最上層的 cache：x 變 7，memory 還是 5。暫時不一樣是可以的，重點是**讓所有程式看到一致的值**。

- 資料只有一支程式在用：通常沒事，讀資料一定從上往下，改了最上層，下次也讀最上層。
- 很多 memory 內容是共用的（有指標就碰得到；multi-thread 的 thread 就是故意要 share memory），另一個 core 就可能讀到舊的 5。
- multi-core 更難：一支程式在第一個 core 跑一跑換到第二個，兩邊 cache 不同。系統一定要製造「大家看到都一樣」的假象。
- 分散式系統最難：不同電腦、不同 memory，還要考慮網路隨時可能斷線。大型雲端系統能長這麼大，其實是選擇**放棄 consistency**：同一個網址你看到的和我看到的版本不一定一樣，但不影響使用；要保證一致，一台改了就要通知一萬台，一定快不起來。

## Hardware protection
protection 的意思：很多程式同時跑、共用資源時，彼此不會互相影響。我的程式 crash，你的照跑；我只看到自己的 segmentation fault，不是整台關機。我能碰的 memory 只有自己的，絕對不能不經 OS 去碰別人的。

問題是：CPU 吃進去的指令上沒有標記「這是 OS 的」，光看 CPU 分不出誰是 OS。分不出來，使用者就能寫一段像 OS 的指令去做 OS 才能做的事，就像分不出總統和平民，誰都能亂發號司令。所以最底層一定要靠 **hardware** 提供最基本的保護（硬體改不了，惡意程式再厲害也不能把硬體重燒），軟體的保護再建在上面。

### User mode 與 kernel mode
- **User mode**：執行 OS 以外的程式。不能直接存取 hardware，也不能碰受保護的 memory（OS 或別的程式的；自己的變數當然可以）。程式 crash 不會讓系統當掉，比較安全，大部分程式都在 user mode 跑。
- **Kernel mode**（也叫 **monitor mode**、**privileged mode**、supervisor mode）：OS 在執行，可以直接存取 memory 和 hardware。這裡的程式一 crash，整個系統跟著 crash 或停擺。

同一條指令（例如都是 add），是 OS 送的還是使用者送的意義不同。你呼叫 printf，最後其實是 OS 的程式碼 **on behalf of**（代替）你在做，因為你呼叫了 system call。為什麼一定要經過 OS？螢幕、I/O device 只有一個，要統一管，不然你 output、我也 output，controller 的 buffer 就亂成一團。

### Mode bit
硬體上用一個 bit 就能分兩個 mode，叫 **mode bit**，在 CPU 的狀態暫存器裡：

```
mode bit = 1 → user mode（平常）
mode bit = 0 → kernel（monitor）mode

user 程式 ──interrupt / trap / system call──> mode bit 設 0，跑 OS 的 routine
OS routine ──return（return-from-trap）────> mode bit 設回 1，回到 user 程式
```

不只 system call，程式出錯、硬體送來 signal，處理 interrupt 的第一件事都是把 bit 翻成 0。所以 interrupt 除了切換程式，還有一個意義：**切換 mode**。

### Privileged instruction
有些指令會影響到別人，就要求它一定經過 OS。設計 instruction set 時（例如 x86）就寫死一組 **privileged instruction（特權指令）**，只能在 kernel mode 執行。使用者也可以把這種指令寫進程式送給 CPU，CPU 一看是特權指令就檢查 mode bit：是 user mode 就不做，直接丟 interrupt 給 OS，OS 通常丟一個 fault 把程式停掉。

例如「把資料寫到 I/O device」是特權指令，使用者不能直接做，得呼叫 system call 請 OS 幫忙；mode bit 翻到 kernel mode，OS 用自己寫好的 routine、照它的規則幫你寫。OS 定義了這組 system call，就能完全控制什麼能做。原則：**privileged instruction 的目的是保護電腦，強迫使用者一定要經過 OS**。

要保護的不外乎三樣：I/O、memory、CPU。

### I/O 保護
I/O 哪些要保護？**全部**。螢幕、printer、網卡、硬碟都只有一個、全是共用的，controller 和 buffer 也只有一個。所以**所有 I/O 指令都是 privileged**，一定要透過 OS 的 driver（前面的 peek、poke 也是特權指令）。

但只保護 I/O 不夠。hacker 繞不過 I/O，就繞 memory：memory 沒保護的話，使用者可以偷偷把 memory 裡 **interrupt vector** 的某一格改成指向自己的程式。OS 以為要寫硬碟，結果被繞走，而且已經在 kernel mode，想做什麼都行。早期常見的 **buffer overflow** 攻擊就是偷偷改 memory，讓它執行不該執行的指令。所以更重要的是保護 memory。

### Memory 保護：base 與 limit register
interrupt vector、service routine 都放在 memory 的 OS 區；而且 user program 之間也不能互相篡改。做法：每支程式能讀寫的記憶體限制在一段**連續空間**，用兩個 register 描述：

- **Base register**：起始位置
- **Limit register**：長度

程式開始跑時這兩個值載入 CPU 的 register。之後每條存取 memory 的指令都要過這一關：

```
          address
             │
     address ≥ base ? ──否──> trap（addressing error，交給 OS）
             │是
 address < base + limit ? ──否──> trap
             │是
     送上 memory bus，存取 memory
```

> **例題** base = 300040、limit = 120900，合法位址是 300040 ≤ address < 420940。存取 300039 → 小於 base，trap；存取 420940 → 不小於 base + limit，trap；存取 350000 → 合法。

這裡丟的是 trap，因為是軟體指令引起的錯。要變大（例如 malloc），是透過 OS 調整，不是自己調；沒跟 OS 講就越界，就收到 segmentation fault。（精確說，malloc 多半先在自己的 heap 裡分，不夠才用 system call 請 OS 擴大。）

> **重點** 修改 base 和 limit 的指令必須是 privileged instruction。不然使用者把 limit 加大一倍就能越界，整套機制就沒用了。

### CPU 保護：timer
不能讓一支程式霸佔 CPU，讓別人、甚至 OS 自己都沒機會跑。例如不小心寫了 `while (1)` 的 infinite loop，電腦卻不會整個死掉，你還能按 Ctrl-C 或切到別的程式。為什麼？靠 **time sharing**：主機板上有一個 **timer**，就算沒人呼叫 system call，它也會定期觸發，時間一到就丟 interrupt 打斷正在跑的程式，讓 CPU 去跑 OS 的 scheduler，決定原程式繼續、換別人、還是先處理 OS 自己的事。所以每次 timer 觸發，控制權都回到 OS 手上。

timer 多久觸發一次（10 ms 還是 100 ms）可以動態調整，要用 load 指令寫進 hardware register。**load timer 是 privileged instruction**：不然使用者把 timer 設成無限大，OS 永遠不會被叫起來，他就能一直霸佔 CPU。

### 怎麼判斷是不是特權指令
判斷標準：**使用者擅自執行它，會不會危害電腦運作？** 會就是特權指令。

| 指令 | Privileged？ | 理由 |
|---|---|---|
| add（3 + 4）等算術 | 否 | 只動自己的資料 |
| 所有 I/O 指令（含 peek、poke） | 是 | device 共用 |
| 修改 base／limit register | 是 | 可以越界存取 |
| load timer | 是 | 可以霸佔 CPU |
| 修改 mode bit、關閉 interrupt | 是 | 可以把自己變成 kernel、讓 OS 拿不回控制權 |

## OS 提供的服務（OS services）
OS 是唯一的 API、唯一的資源 manager，所有程式都要經過它；它提供的動作本質上是 **service**：你要做什麼，它幫你做（interrupt routine 也因此叫 service routine）。服務大致幾類，知道即可：

**對使用者有幫助的：**
- **User interface**：人怎麼跟電腦溝通（CLI、GUI）
- **Program execution**：載入、執行程式
- **I/O operation**
- **File system** 管理檔案
- **Communication**：不同電腦上的 process（例如網路上的 HTTP、TCP），或同一台電腦上的 process 之間
- **Error detection**：要定義、偵測錯誤，有 bug 時系統才能正常運作

**讓系統本身運作的：**
- **Resource allocation**：例如 CPU scheduling algorithm
- **Accounting（記帳）**：追蹤每支程式用了多少資源。例如某支程式開了 1000 個檔案，整台電腦就被拖慢了，所以會設 limit（一個 process 最多 4 GB memory、開檔數有上限）；administrator（最高權限管理者）可以改這些 limit。
- **Protection 與 security**：帳號、password、login，防病毒、防 malicious 的使用者。

### User interface：CLI、shell、GUI
- **CLI（Command Line Interface）**：一行一行打指令，早期只有這種。運作很單純：fetch 使用者打的指令，然後執行。
- **GUI（Graphical User Interface）**：視窗、圖示、滑鼠。

GUI 其實是架在 CLI 上面的：GUI 做得到的 CLI 都做得到，CLI 還能做很多 GUI 做不到的。電腦世界是一層層疊起來的 software stack，要建大系統、把工具串起來自動化都靠 CLI。現在系統兩種都有：單純處理資料、計算、跟人無關的工作用 CLI，只有最上層才給人看。這又是 convenience 與 performance 的 trade-off：GUI 方便，但比較慢、比較受限。用指令操作也比較貼近 OS：每個指令背後都是 OS 在做事。

**Shell（殼）**：你在 CLI 打的指令不是直接交給 OS，提供這個介面的是一支叫 shell 的程式，在 OS 上面一層（常見的有 csh／C shell、bash）。為什麼要多一層？因為每個人的習慣不同。例如看資料夾內容，Linux 的指令是 `ls`，從 Windows 來的人習慣打 `dir`：在 shell 設定檔加一個 **alias**，讓 `dir` 代表 `ls` 就好。OS 是從系統角度出發，system call 一旦定下就不能隨便改，所以個人化要放在 OS 外面：每個人有自己的 shell，可以換 bash 或 csh、重定義指令、讓資料夾顯示藍色。

> **重點** shell 不屬於 OS，它是 OS 外面一層比較友善的 CLI 介面。

### Communication：message passing 與 shared memory
不管同一台電腦或跨電腦，溝通都能依「怎麼用 memory」分兩類（CPU 能直接碰的只有 memory）：

- **Message passing**：像寫 email。Process A 先把訊息 copy 到 kernel（OS 的記憶體），Process B 再從 kernel copy 過來讀，本質就是 memory copy。為什麼不直接從 A copy 到 B？因為 **protection**：每個 process 有自己的 base 和 limit，B 的記憶體就在旁邊，A 也沒權利直接寫；只有 OS 有權讀寫各 process 的資料，它收好、確認完整再交出去，所以這麼簡單的事也要 system call。（為了效能也能直接 copy，但很少這樣做：copy 到一半斷掉，要同時救兩支程式很麻煩。）跨電腦也一樣：copy 到 kernel、送網路封包（socket programming），對方 kernel 收到再 copy 過去；TCP/IP 很慢就是因為一層一層 copy。
- **Shared memory**：兩個 process 都能讀寫同一塊記憶體，A 寫進去 B 直接看到。為了保護，共用區不會憑空出現，要先用 system call 請 OS 建立。multi-thread 例外：thread 的定義就是部分記憶體 by default 共用。

| | Message passing | Shared memory |
|---|---|---|
| 缺點 | 要 memory copy，通常比較慢 | synchronization、deadlock 等不可預期的問題 |

## 程式怎麼跟 OS 互動
```
你的程式（user mode）
   │ 呼叫
API / C library
   │
system library = system call   ← OS 的 interface
   │
OS（管 memory、CPU…）          kernel
   │
driver（OS 的一部分，放最下層、可抽換）
   │
hardware
```

user mode 指你的程式和它用的 memory 空間；kernel 指 OS 自己用的空間和資源。I/O device 太多樣，每個可能要自己的 driver，所以 driver 特別切開放在最下層，可以抽換。

**printf 一路往下**：程式先 compile 成 machine language（.o 檔），再 **link**：把 compile 好的 binary 接在一起。link 時一定會自動接上 **system library**，才是能跑的執行檔（可能先 link 到 C library，C library 再用 system library，間接接進去）。因為 printf 要輸出到 screen，負責輸出的是 OS，不是 C library。執行時：printf → system call → driver → 硬體，全程經過 OS，只是包了太多層你沒直接看到。除非程式完全不用 OS 的 code，否則不 link system library 就跑不起來。

## System call
**System call** 是程式向 OS kernel 請求 service 的 programmatic 方式。user mode 的程式需要 memory、hardware 等資源時不能直接碰，於是呼叫 OS；呼叫那一瞬間從 user mode 切到 kernel mode，用完再切回來。system call 通常是 C、C++ 寫成的 routine，例如 `open()`、`read()`、`write()`。

> **陷阱** user mode ↔ kernel mode 的切換，恐龍書叫 **mode switch**；**context switch** 是 CPU 換去跑另一個 process（要存取 PCB）。有些教材把 mode 切換也說成 context switch，考試要用課本說法分清楚。

**System call 的特性：**
- 它是 OS 唯一的 interface，OS 上有一層 system call layer；它是 **part of OS**。
- 它是 **software interrupt（trap）**：只有 interrupt 能改變 mode，所以 call 了 system call 就一定進 kernel mode，一般 function 沒有這個特性。
- 入口那一小段（放編號、執行 trap 指令）要用 **assembly** 寫，因為 C 下不了 trap 指令；kernel 裡的 service routine 多半是 C。
- 大家共用，**效能優先**、不管方便；方便交給上面的 shell 和 API。
- 很 **expensive**：不只是移 program counter，而是整套 interrupt 流程。

### 例題：複製一個檔案要幾個 system call
> **例題** 把 source 檔的內容複製到 destination 檔，每一步都是 system call：
> 1. 取得 input 檔名：在螢幕顯示提示（用到 monitor 這個 output device）、接收使用者輸入（鍵盤或滑鼠），共 3 個（取得檔名、顯示提示、接收輸入；也可以列出檔案讓使用者用滑鼠點）
> 2. 取得 output 檔名：同樣 3 個
> 3. open input 檔；若不存在 → abort（終止也是 system call）
> 4. create output 檔；若同名檔已存在 → abort
> 5. loop：read input、write output，直到讀不到東西（read fails）；每一次 read、每一次 write 都是 system call，過程中有 hardware error 也要 abort
> 6. close output 檔
> 7. 在螢幕顯示「複製完成」
> 8. terminate normally
>
> 只是複製一個檔案，就執行了一大串 system call；有些程式每秒要執行上千個。

直接用 system call 寫 copy 大概要十幾二十行，每一行都是 system call，還要懂一堆 low level 細節。用 C library 的 API：一個 `fopen`、`fread`，再一個 `fwrite`，大概三行就寫完。API 一樣有很多參數，但每個欄位目的都很明確。

## API 與 system call 的差別
這一章最重要的問題：**system call 和 API 不是同一個東西換名字**。

**API（Application Program Interface）**：建在 system call 上面的一層介面，純粹為了寫程式方便而設計，跟 OS 本身不需要那麼緊密。就像 shell 讓「人」方便下 command，API 讓「程式」方便 call function。我們說 **program against API**：對著 API 寫程式，很少直接碰 system call。API 的形式就是一堆 library：C library 常被當成 OS 的 API 之一；Android 的 API 是 Java。所以 C、Java 常被叫做 system programming language。

```
user application
   │ call API（一般 function call，不是 interrupt，仍在 user mode）
API library
   │ 需要 OS 時才 call system call
system call ── trap ──> kernel mode：找到 service routine 執行
   │                         │
   └────────── return ◄──────┘
```

### 對應關係不是一對一
| 對應 | 例子 |
|---|---|
| 一對零 | math library 的 `abs`（取絕對值只處理數字，不需要 OS）、指數運算：包成 function 只是為了方便 |
| 一對多 | `fopen` 背後至少要三四個 system call；使用者用法五花八門，方便的 API 往下常對到好幾個 |
| 多對一 | `malloc` 和 `free` 是兩個 API，底層都可能用到同一個 system call `brk`（參數不同） |

system call 希望越少越好、互不重疊、每個只做一件事，單純好 debug；API 則依需求組合。

> **陷阱** `malloc`／`free` 屬於 C library（API），底層透過 `brk`／`sbrk`（或 `mmap`）向 OS 要記憶體；`free` 多半只是把空間還給 malloc 管的 heap，不一定 call `brk`。不是每次呼叫 API 都會觸發 system call。

**另一個大差別**：call API 不是 interrupt，不會進 kernel mode；只有 API 裡 call 了 system call 才間接進 OS。system call 是 interrupt，等於打斷別人趕快做一件事，所以要寫得非常簡潔；API 是自己要做的事，做久一點沒差，用 C、Java 寫都行。

> **例題** printf 要不要 system call？要。它要輸出到螢幕，螢幕是 I/O device，I/O 指令一定是 privileged instruction，所以 printf 要 call system call，由 OS 去下那些特權指令，做完 return 回原來的地方。abs 則完全在 API 那層做完。

### Interface 與 library
function 的定義（名字和參數）就是 **interface**；怎麼 implement 是另一回事。例如算 2 的 n 次方：可以寫 for 迴圈一直乘 2；聰明一點用 shift（左移一位就是乘以 2）；更厲害的是做一個硬體幫你算（hardware support），一條指令瞬間完成。同一個 interface 可以有三種 implementation，這些實作集合起來就是 **library**。

### Win32、POSIX、Java API
- **Win32**：Windows 的 API。注意 Win32 是 API，不是 system call。
- **POSIX**（Portable Operating System Interface，for UNIX）：UNIX、Linux、Mac 都 follow 的標準化 API。這些系統的 system call 和實作都不一樣，但 API 的定義相同，各自寫好那層去 call 自己的 system call。所以叫 **portable**：program against API，Linux 上寫的程式拿到 Mac 只要重新 compile，不用改寫。例如 multi-thread 的 **Pthread**，P 就是 POSIX。
- **Java API**：Java 跑在 Java Virtual Machine（JVM）上，在自己模擬的機器上跑，下面真實的機器是什麼不重要，所以 portability 更好、也更能保護程式。代價：runtime 要把程式碼翻成 x86 或 MIPS 指令，會慢一點。越 general、越 portable，要做的事就越多。

### 為什麼要多一層 API
1. **好寫程式**：能用 C、Java 這些語言很快寫；直接對 system call 寫（還要懂 assembly）非常難。
2. **Portability**：例如 POSIX（它出現的一大目的就是整合各家 UNIX）。
3. **Efficiency**：很多程式碼根本不需要 call OS；system call 很 expensive，自己組二十幾個 system call 大概組不過設計 OS 的人，透過 API 就能用最有效率的方式組合，你不用懂下層怎麼實現。

### System call 怎麼傳參數
跟一般 function call 一樣要 passing parameter，只是後面的流程是 interrupt。三種方式：

1. **Register**：直接把值寫進 register，最快，但 register 數量有限。
2. **Table（block）in memory**：參數很多時，先建一個 data structure 把參數放進去，再把它的 **pointer** 放進 register 傳過去（例如資料放在 table，把指向它的 pointer X 放進 register）。OS 已經在 kernel mode，有所有權限，誰給的 pointer 它都存取得到。
3. **Stack**：每個 process 都有一塊 stack，呼叫方把參數 **push** 進去，OS **pop** 出來。

## OS 的結構
使用者和系統設計者要的不一樣，所以中間才有 API；設計 OS 時雙方目標也不同：

| 使用者要 | 系統設計者要 |
|---|---|
| easy to use | easy to design、implement、debug、maintain |
| reliable，不隨時 crash（早期的 blue screen 就是不穩） | reliable：kernel code 不能有 bug |
| safe、secure | |
| 快：互動的快（手機點下去就有反應） | efficient：系統本身運作的效率 |

最大的差別：使用者要「用」得方便，系統要「維護、實作」得方便。

### Simple OS（MS-DOS）
最早期的 OS，代表是 MS-DOS。最下層有 driver（BIOS 的 driver、software 的 driver），中間的 **resident system program** 是真正的 OS，所有事情都在它裡面，最上面是 application。簡單講就是**沒分**：全堆在一起，怎麼 call 都行。唯一的架構是 driver 跟 OS 切開，所以能 plug-in 其他 I/O device。

- 好處：開發者很自由；當時系統沒那麼複雜，會動就好、把介面做得 user-friendly 比較重要。
- 壞處：各部分可以亂連、互相亂呼叫，**非常不安全**（90 年代那麼多 bug、worm，就是定義不清容易被鑽漏洞），而且**很難 maintain**。單一公司 total control 還能撐；像 Linux 這種 open source 社群一起貢獻，改一處可能影響所有人，沒辦法 co-work。

### Monolithic
傳統 UNIX、Linux 的 kernel 在恐龍書裡歸為 **monolithic**：所有 kernel 功能（file system、CPU scheduling、memory management…）放在同一個 kernel space 裡的一大塊程式，彼此直接呼叫。效能好（不用一層層傳、不用 message passing），但難實作、難擴充，一處出錯可能拖垮整個 kernel。

### Layered OS
OS 其實是一個很大的 program，裡面有很多 subsystem（memory、I/O driver、process、CPU scheduling，就像課本的每一章），而且互相依賴：virtual memory 用 disk 當空間，所以 memory 要 call I/O；I/O 想少做 memory copy，也要用到 memory 管理的功能。

layered 的做法比較強硬：切成一層一層，最底層（hardware）叫 **layer 0**，再往上包。規則：**外層可以 call 內層，內層不能 call 外層**，也就是 layer N 可以 call layer 0 到 N−1 的任何 function，只能往下。例如 memory 那層可以 call 下面的 process 層，但不能 call 上面的 I/O 層。分層的經典例子是 THE 系統。

- 好處：**非常容易 debug、maintain**。呼叫不會繞圈，可以一層層 test：下面 OK 了再測上面，很容易找出哪一層出問題；改了某一層的函式，只影響上面的層。
- 缺點一：layer 怎麼切很 **arbitrary**（I/O 和 memory 互相 call，切不好效能就很差）。
- 缺點二：**效能比較差**，要一層一層往下 call，就像網路的 socket，好幾層一路 package、unpack，很多 memory copy，不能直接跳到某層。

### Microkernel
Carnegie Mellon 大學提出，代表例子是 **Mach**（Mac 也部分用了 microkernel 的概念；不少新的 IoT、embedded OS 往這方向走）。**kernel 的程式碼越少越好**：

- kernel 只負責 module 之間怎麼溝通、怎麼傳、怎麼處理失敗；其他所有 subsystem（連 graphics、I/O manager、file system）都變成 module，放在 **user space**，就像一般 user program，crash 了也沒關係，只要 kernel 不 crash。
- 好處：比較 **reliable**（只要那一點點 kernel 沒 bug）、安全；模組化，想換掉 memory management 只要重寫那個 module、hook 上去，OS 變得 configurable；容易 **portable**、容易 **extension**。
- 缺點：**效能比 layered 更差**：subsystem 在 user space，彼此溝通都要經過 kernel，全是 system call（interrupt）；而且用 **message passing** 溝通，傳參數一定要 memory copy。

### Modular OS 與 loadable kernel module
現在的 Linux 基本上就是 modular。就像程式用物件導向（OO），系統也切成一堆 subsystem，每個 define 好自己的 interface。跟 microkernel 很像，唯一的不同：**這些 module 全在 kernel space 裡**，所以 subsystem 之間不需要 message passing，效能比較好，也比較有彈性。

modular 的重點是 **loadable**：可以 load 一個 kernel module 進去，改變 OS 的功能。怎麼運作？hardware signal 用 interrupt vector，system call 這邊則有一張 **system call table**，本來就預留一些空的 entry。用 administrator 權限執行 `insmod`（insert module），就是去改這張表的 entry：

- 可以**新增** system call。
- 最常見的是 **replace**：例如本來有 `open`，你 insert 自己的 kernel code override 那個 entry，你的版本先偷偷印出 file name，再 call 原本的 function，所以不影響系統運作。這樣就能 **intercept** 那個 system call，拿來做 profiling、debugging。

> **陷阱** microkernel 和 modular 都把 OS 切成 module，差在 **module 放哪裡**：microkernel 的 module 在 **user space**（靠 message passing，慢但可靠）；modular OS 的 module 在 **kernel space**（直接呼叫，快）。

| 結構 | 怎麼組織 | 優點 | 缺點 | 例子 |
|---|---|---|---|---|
| Simple | 沒有分層，只把 driver 切開 | 自由、簡單 | 不安全、難 maintain | MS-DOS |
| Monolithic | kernel 功能全在同一塊 kernel space | 效能好 | 難實作、難擴充 | 傳統 UNIX、Linux |
| Layered | layer N 只能 call 下面的層 | 好 debug、好 maintain | 層難切、一層層 call 效能差 | THE |
| Microkernel | kernel 最小，服務放 user space，message passing | reliable、易擴充、易移植 | 溝通靠 system call + memory copy，最慢 | Mach |
| Modular | module 在 kernel space，可 load | 有彈性、效能好 | | 現代 Linux |

## Virtual machine（VM）
VM 把下面整個抽象化：OS 本來就把硬體抽象給程式用，VM 更 general：就算下面已經有 OS 在跑，VM 仍能把它抽象成「就像一台硬體」，所以裝了一個 OS 之後，上面還能再裝一個 OS，對上面的 OS 來說就像直接裝在實體機器上。

### 例子：Nachos
Nachos 是一個教學用的完整 OS，但它不是跑在硬體上，而是跑在 Linux 上：最下面 x86 硬體，上面 Linux，Nachos 坐在 Linux 上。在 Nachos 上寫的 user program 要 `#include "syscall.h"` 才能呼叫 Nachos 的 system call。

**Instruction set translation**：Nachos 模擬的指令集是 **MIPS**（簡單、容易產生），不是下面 Linux 跑的 x86。Nachos 裡有一段 **machine simulation code** 模擬一顆 MIPS CPU：把 MIPS 指令轉成 x86 指令交給下面執行，看起來好像有顆 MIPS 在跑，其實做事的是下面真的 CPU。模擬出來的機器也要有人管，所以還有 **Nachos kernel code**，它才是真正的 Nachos OS，它和模擬機器之間的互動，跟在實體硬體上裝 Linux 完全一樣。所以編 user program 不能用一般的 gcc，要用工具編出 MIPS binary；兩邊的 binary 互相看不懂，就像兩台不同電腦。VM 的關鍵就是 instruction set translation。

**Stub**：Nachos 是不完整的 VM，可以偷吃步。例如 file system 有兩種：一種是真的在 Nachos 裡實作的 real file system；另一種是 **stub（替身）**：程式要 open 一個檔，stub 直接 redirect 給下面 Linux 的 file system，所以在 Nachos 裡看到的檔案跟登入的那台 server 一模一樣。真正的 VM 當然不能依靠另一個 OS，stub 只負責把指令轉送下去，自己沒有真的做。

### VM 的歷史
VM 四五十年前就有了：一台電腦有很多使用者，為什麼不讓每個人有自己的 OS？當時就做出來而且 work，isolation 非常好；但 CPU 慢、memory 小，每人多跑一個 OS 負擔太重，就沒流行。

### VM 怎麼執行特權指令
結構：最下面硬體，上面是管理 VM 的那層（virtualization layer），再上面很多 VM，各有自己的 **guest kernel**，互不知道彼此。虛擬化不是改 kernel，而是夾一層 layer：每個 VM 都以為整台硬體只屬於自己。

難點又回到 dual mode：kernel 假設自己在 kernel mode，所以才能執行特權指令。在 VM 裡，guest kernel 對底層來說其實跑在 **user mode**，我們得騙它以為自己在 kernel mode。它執行特權指令時實際在 user mode，指令就會 fail。

1. **第一代解法（trap-and-emulate）**：特權指令在 user mode 執行是非法的，CPU 產生一個 trap；這個 interrupt 先回到下面那層，由它接住。它一看就知道「上面那個 VM 想執行特權指令」，於是在 kernel mode 幫它再執行一次。代價：system call 本來就慢，現在變成下去、上來、再下去，做兩次。一般指令則直接 go through，沒有問題。
2. **Hardware support**：買 CPU 看到「支援 virtualization technology」就是這個。CPU 多了一個 mode：除了 kernel mode、user mode，還有 **VM mode**；看到特權指令，CPU 自己就知道它來自 VM，直接讓它過，不用再繞一趟，所以快。

### Critical instruction（補充）
**Critical instruction** 不是特權指令，在 user mode 也能執行、不會被擋；但同一條指令在 user mode 和 kernel mode 執行，**結果不一樣**。例如某指令在 user mode 算 A + B，在 kernel mode 卻變成 A + 2B。沒有 hardware support 時，它在 user mode 本來就能跑，不會丟 interrupt，下面根本發現不了：guest kernel 在 user mode 執行得到 A + B，但它以為自己在 kernel mode，本該得到 A + 2B，結果就錯了。所以不能只靠「是不是特權指令」判斷，還得另外找出 critical instruction，純 software 虛擬化沒那麼簡單。

### VM 的好處
1. **Protection**（最早提出 VM 的原因）：isolation 完整，hack 了一個 OS 也碰不到另一個。
2. **Compatibility**：有些 legacy software 一定要在舊環境才能跑；沒有 VM 就要一個環境買一台電腦。作業要 Linux、手上只有 Mac，開個 VM 就好。
3. **Research 與開發**：寫 kernel 只要有 bug 就 crash，直接在實體機器上改，每次都要重裝、整台重開；在 VM 裡它再怎麼 crash 也只是一個 program，甚至能把 state 存到下面的機器。另一個應用是 **honey farm**：用 VM 開一台假機器讓人攻擊，就像用蜜吸引蜜蜂，記錄攻擊 pattern 拿來研究。
4. **Cloud computing**：大型 data center 把大的實體機器切成很多小 VM 租出去，使用者只要能連線（例如 SSH）就能用。重點是 resource sharing 與高使用率：一人一台實體機器，CPU cycle 大多空著，很難賺錢。不過雲端不一定靠 VM，現在更多用 **container**，比 VM 更 lightweight。重點都是 **isolation**：明明共用，卻讓你覺得那是自己的電腦。

### Full virtualization 與 para-virtualization
下面原本的 OS 叫 **host OS**，上面來作客、其實跑在 user mode 的叫 **guest OS**。

| | Full virtualization | Para-virtualization |
|---|---|---|
| guest OS | **完全不用改**：能裝在實體 PC 上的 OS 就能直接裝，它渾然不知自己在虛擬世界 | **必須修改**，不是隨便拿一個就能裝 |
| 實作 | 較難，要處理特權指令和 critical instruction，靠 virtualization layer 或硬體支援 | 多一個 global zone（master／manager），知道所有 VM 的存在，可以開後門，較容易實現 |
| 例子 | VMware（早期 CPU 還沒有 hardware support 就做到了）、KVM（open source） | Xen |

para 的效能不一定比較差，甚至可能比較好：每個 OS 都假設硬體只有自己在用，例如 file system 會把讀取重排成 sequential 讓 disk 讀得快；但大家共用同一顆 disk，你 sequential、我也 sequential，交錯起來就變 random，白最佳化了。para 的 master 拿到大家的 pattern，能再做一次 global 的最佳化；缺點是多一層溝通的 overhead。沒有哪個一定好；現在有 hardware support，full 比較熱門。

### Java Virtual Machine
Java 的執行方式照 VM 的概念設計（JVM），它的虛擬化相對單純，只管執行指令，跟 Nachos 很接近，重點是 code translation。Java 編完是自己的 binary，叫 **bytecode**（不是 x86 也不是 MIPS），到不同電腦上執行時 JVM 再翻成那台 host 的指令。JVM 像一個 OS，程式只會用到 VM 裡的 memory，isolation 好，所以很 secure。逐條翻譯很慢，所以有 **JIT（just-in-time）compile**：把翻過的指令記下來，像查字典，遇到同樣的直接用。但再怎麼最佳化，還是比直接編成機器碼的 C 慢一點。

## 重點整理
- OS = 夾在 application 和 hardware 之間的 permanent 軟體；角色是 control 與 coordinate；別名 kernel；也稱 resource allocator、control program。
- 設計目標 convenience 與 efficiency 互相矛盾，是 trade-off。
- Batch：一次一個 job，CPU 在 I/O 時 idle；誰先跑由 operator 決定。
- Multiprogramming：多個 program 放 memory，CPU 與 I/O overlap，目的是 CPU utilization（系統角度）；需要 job scheduling、memory management、CPU scheduling、interrupt（spooling）。
- Time sharing：time slot 到就換，目的是 interactive、短 response time（使用者角度）；帶出 virtual memory、file system、synchronization、deadlock。
- Multiprocessor（tightly coupled，shared memory）好處：throughput、economy、reliability。SMP 對等、AMP 有 master。
- UMA 存取時間相同；NUMA 分 local／remote，可 scale 大，資料擺放影響效能。
- Distributed（loosely coupled）：memory 不共用；目的 resource sharing、load balancing、reliability。client-server 有單點失效；peer-to-peer 沒有。cluster 用 LAN、InfiniBand／RDMA。
- Real-time = 在 deadline 前完成，不是越快越好；hard 不能 miss，soft 盡量；hard real-time 通常不用 secondary storage。EDF：deadline 早的先做。
- Busy waiting（polling）浪費 CPU；interrupt-driven 讓 CPU 與 I/O 同時運作。
- Hardware interrupt（signal）被動、查 interrupt vector（function pointer 陣列）；software interrupt（trap）主動，來自錯誤或 system call，依編號查 system-call table。都要保存被打斷者的 PC。
- Storage hierarchy：越上越快越小越貴；memory 以上 volatile；main memory 是 CPU 能直接存取的最後一層。DRAM → main memory，SRAM → cache。
- 硬碟讀取 = transfer time + positioning time（seek + rotational latency），不是 random access；SSD 沒有 positioning time。
- Cache 是 copy 不是搬移；要維持 coherence／consistency。
- Mode bit：1 = user、0 = kernel；interrupt／trap 切到 kernel，return 切回 user。
- Privileged instruction：擅自執行會危害系統的就是。所有 I/O、改 base／limit、load timer 都是；add 不是。
- Memory 保護：base ≤ address < base + limit，否則 trap。
- CPU 保護：timer 定期 interrupt，讓控制權回到 OS。
- System call：OS 唯一的介面、software interrupt、會進 kernel mode、昂貴、入口用 assembly。
- API：建在 system call 上、為了方便；呼叫 API 不是 interrupt；對應可以一對零、一對多、多對一。Win32、POSIX、Java API 都是 API。為什麼要 API：好寫、portable、efficient。
- System call 傳參數：register、memory 中的 table（傳 pointer）、stack。
- OS 結構：simple（MS-DOS）、monolithic（傳統 UNIX）、layered（只能往下 call，好 debug 但慢）、microkernel（module 在 user space，靠 message passing，可靠但慢）、modular（module 在 kernel space，可 load，現代 Linux）。
- VM：guest kernel 實際在 user mode；特權指令靠 trap 給下層代為執行，或 hardware 的 VM mode；critical instruction 是純軟體虛擬化的難點。好處：protection、compatibility、開發與研究、cloud。full 不改 guest OS，para 要改。

## 名詞對照
| 中文 | English |
|---|---|
| 作業系統 | operating system (OS) |
| 核心 | kernel |
| 資源分配者 | resource allocator |
| 控制程式 | control program |
| 批次系統 | batch system |
| 多元程式 | multiprogramming |
| 分時 | time sharing |
| 假離線 | spooling |
| 工作排程 | job scheduling |
| CPU 排程 | CPU scheduling |
| 死結 | deadlock |
| 同步 | synchronization |
| 多處理器 | multiprocessor |
| 緊密耦合／鬆散耦合 | tightly coupled / loosely coupled |
| 對稱／非對稱多處理 | SMP / AMP |
| 均勻／非均勻記憶體存取 | UMA / NUMA |
| 分散式系統 | distributed system |
| 主從式 | client-server |
| 點對點 | peer-to-peer |
| 叢集 | cluster |
| 即時系統 | real-time system |
| 最早截止時間優先 | earliest deadline first (EDF) |
| 嵌入式系統 | embedded system |
| 匯流排 | bus |
| 裝置控制器 | device controller |
| 忙碌等待／輪詢 | busy waiting / polling |
| 中斷 | interrupt |
| 中斷向量 | interrupt vector |
| 中斷處理程式 | interrupt handler / service routine |
| 陷阱 | trap |
| 儲存階層 | storage hierarchy |
| 揮發性 | volatile |
| 次級儲存 | secondary storage |
| 搜尋時間 | seek time |
| 旋轉延遲 | rotational latency |
| 快取一致性 | cache coherence |
| 保護 | protection |
| 雙模式 | dual mode |
| 使用者模式／核心模式 | user mode / kernel (monitor) mode |
| 模式位元 | mode bit |
| 特權指令 | privileged instruction |
| 基底暫存器／界限暫存器 | base register / limit register |
| 計時器 | timer |
| 系統呼叫 | system call |
| 應用程式介面 | application program interface (API) |
| 命令列介面 | command line interface (CLI) |
| 圖形使用者介面 | graphical user interface (GUI) |
| 訊息傳遞 | message passing |
| 共享記憶體 | shared memory |
| 分層式 | layered |
| 微核心 | microkernel |
| 單一核心 | monolithic kernel |
| 可載入核心模組 | loadable kernel module |
| 虛擬機器 | virtual machine |
| 完全虛擬化／半虛擬化 | full virtualization / para-virtualization |
| 即時編譯 | just-in-time (JIT) compilation |
