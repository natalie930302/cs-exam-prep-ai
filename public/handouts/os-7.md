# 記憶體管理

program 變成 process 的關鍵，就是被 load 進 memory、有了自己的記憶體內容，所以記憶體怎麼管理是作業系統最重要的主題之一。這一章先講程式和記憶體怎麼「綁」在一起（address binding 的三個時間點、logical 與 physical address、MMU），再看 dynamic loading／linking 和 swapping，接著是配置方法：連續配置（first／best／worst fit、fragmentation）、paging（位址轉換、TLB、EMAT、protection、sharing、page table 的結構），最後是 segmentation 以及兩者合起來的 segmentation + paging。考試最常考位址的 bit 數計算、page table 大小、TLB 的 EMAT、internal 與 external fragmentation。

## 學完這章要會
- 說明 memory 為什麼重要，以及 memory management 要負責的事
- 分辨 compile-time、load-time、execution-time binding，說出 absolute code、relocatable code、MMU 的角色
- 分辨 logical（virtual）address 與 physical address，知道只有 execution-time binding 兩者才不同
- 分辨 dynamic loading 與 dynamic linking（誰控制、解決什麼問題），說明 stub
- 說明 swapping、backing store，以及為什麼只有 idle 的 process 能 swap
- 用 first fit、best fit、worst fit 配置記憶體；分辨 internal 與 external fragmentation，知道 compaction
- 說明 page、frame、page table；把 logical address 切成 p、d 並翻譯成 physical address
- 由 address bit 數與 page size 算出 page 數、page table entry 數與大小、frame number bit 數
- 說明 PTBR、TLB、flush TLB，計算 EMAT
- 說明 valid–invalid bit、PTLR、shared pages（reentrant code）
- 比較 hierarchical、hashed、inverted page table
- 做 segmentation 的位址轉換（base + offset、limit 檢查），以及 segmentation + paging 的兩段轉換

## 為什麼 memory 這麼重要
- **Memory 是 CPU 唯一能「直接」access 的儲存空間**。instruction 和 data 最後都得放在 memory 裡；中間的 cache 只是加速用的暫存，本體還是在 memory。CPU 沒辦法直接讀 disk，資料一定要先搬進 memory。
- 為了提高 CPU 使用率，用 **multiprogramming** 同時把很多 process 放在 memory 裡。這下就複雜了：每支程式能用多少記憶體？放在哪裡？這些都要 OS 決定。
- 還要做 **protection**：你不能隨便去改別人的記憶體。
- 記憶體畢竟有限，所以現在的電腦有 **virtual memory**，把 disk 也當成記憶體的一部分，資料在兩邊之間切換。但手機或 embedded system 儲存空間小，可能直接把 virtual memory 拿掉。

程式看到的連續空間其實是假象：為了有效使用實體記憶體，空間被切成小塊、散落各地，管理的方法就是 **paging** 和 **segmentation**，OS 會把程式的空間 map 到真正的實體記憶體，甚至 map 到硬碟上。你寫程式 pointer 亂指拿到的 **segmentation fault**，就是最貼近程式的 segmentation 那一層抓到你越界。真實的作業系統把 paging 和 segmentation 結合起來用。

## Address binding

### 三個時間點
你在程式裡寫了很多變數，每個變數最後都要變成某一個 memory address；但這個位址對到 physical memory 的哪裡，不一定 compile 完就知道。把程式和記憶體「綁」在一起叫 **address binding**，依「什麼時候決定」分成三種。程式從寫好到執行的流程是 compile → link → load → run：

1. **Compile time**：編譯程式的時候就決定。
2. **Load time**：程式準備放進 memory 的那一刻決定。
3. **Execution time（run time）**：程式已經在 memory 裡、真的開始跑的時候才決定。

順便認識幾個名詞（以 C library 為例）：在 link 的時候就把 library 放進程式裡，叫 **static linking**；在 load time 一次全部載入叫 **static loading**；等到執行時用到了才 load 進 memory，叫 **dynamic loading**；**dynamic linking** 也是在 run time 才做。

### Compile-time binding：absolute code
一個簡單的程式裡有變數 data，它最後一定要 bind 到某個實體位址。機器碼看不懂變數名稱，它吃的是位址，所以最早期在 compile 時就直接寫上實體位址。

> **例題** compile 時假設程式會從 0x1000 開始放，data 在程式裡的第 0x18 個位置，所以指令裡直接寫 **0x1018**。CPU 只是一行一行讀指令，看到哪個位址就去哪讀；程式真的放在 0x1000，data 就在 0x1018，讀得到。可是程式一搬家，例如從 0x1000 搬到 0x2000，它還是傻傻去讀 0x1018，就壞了。

- 這叫 **compile-time address binding**，產生的程式叫 **absolute code**。電腦只跑一支程式、又知道記憶體怎麼擺時可以這樣做，早期的 DOS 就是。
- 好處：非常簡單，執行也快，CPU 要的位置就在那裡，不用再經過任何翻譯。
- 缺點：位置定死，load 時一定要放在一模一樣的地方；想搬只能 recompile、重新 load、重新執行，等於把程式整個 kill 掉重來。簡單的 embedded device 還可以這樣做，很多 process 共用記憶體的一般電腦就很不理想。

程式為什麼會想搬家？記憶體不夠時它被搬到硬碟，回來時原位置可能被佔了，compile-time binding 就只能等。

### Load-time binding：relocatable code
把「決定位址」延後到 load 的時候。compile 時不再寫死絕對位置，而是留一個 **base** 當起點先不填，只算出離開頭多遠（例如 0x18），留給 loader 去填。

> **例題** 要 load 時，loader 看這台電腦當下記憶體哪裡有空位，找到 0x2000，就知道 base 是 0x2000，把位址改寫成 0x2000 + 0x18 = **0x2018** 再放進去。

- 這種程式叫 **relocatable code**，compile 完可以放到記憶體任何空位，寫程式的人不必知道哪裡有空。
- 但程式已經在跑、想換位置（例如被 swap 到 disk，回來時原位置被別人佔了），還是得 reload：只有 loader 知道位置，必須把程式 kill 掉、重新 load、再跑一次。至少不用重新 compile；而且 compile 完常常隔很久才執行，到時再找空間就好，已經有彈性多了。

### Execution-time binding：MMU
前兩種還達不到現代電腦的目標，要 **execution-time binding** 才能有 virtual memory。

> **例題** 同樣的程式，compile 之後、load 之後，程式碼都沒變，一直都是相對位置 **0x18**（從程式開頭算起第 0x18 個位置），loader 什麼都不改，原封不動放進記憶體。程式實際放在 0x2000，data 真正在 0x2018，但指令裡寫的還是 0x18：記憶體裡指令寫的位址，跟資料實際的位置居然不一樣！

那為什麼還跑得對？CPU 送出位址、到記憶體之前，中間有一個硬體元件叫 **MMU（memory management unit）**。CPU 渾然不知，以為 0x18 就是對的，就送出去；送到 memory 之前，MMU 才把它轉成 0x2018，這就是 run time。記憶體看不到正確位置，CPU 也不知道，唯一知道的就是 MMU。

> **例題** 最簡單的 MMU：加上一個 **relocation register**（也就是 base）。CPU 送出 logical address **346**，程式放在 **14000**，MMU 算 346 + 14000 = **14346** 送給記憶體。run time 想把程式從 14000 搬到 24000 也沒關係：程式上 CPU 前（context switch），OS 把它的 base 載入 MMU，base 改成 24000，346 就翻成 **24346**。

程式存取記憶體非常頻繁，每個位址都要翻譯，所以真實電腦把這套翻譯做成 hardware 電路才夠快。後面的 paging、segmentation 一樣是 MMU 在翻譯，只是不會只加一個數字這麼簡單。

### Logical address 與 physical address
- **Logical address**：從 CPU 送出來的位址。它是假的，所以也叫 **virtual address**。
- **Physical address**：真正送到 memory module 的位址。

compile-time 和 load-time binding 時，程式放進記憶體的就已經是真實位址，兩個位址一模一樣；**只有 execution-time binding 兩者才不同**，要靠 MMU 在執行時做 address translation。

這設計好在哪？

1. OS 管理實體記憶體非常有彈性，哪裡有空位都能用，靠翻譯對上就好。
2. 寫程式的人和 compiler 只要管 logical address，別的程式、記憶體怎麼管，都可以視而不見。整個系統的複雜度大幅降低，compiler 受益最大：它什麼都不用改，全部丟給 MMU。

> **陷阱** execution-time binding 時，CPU 送出的、記憶體裡指令寫的，都是 logical address，只有 MMU 知道 physical address。我們寫程式是「對著 CPU 寫」，看到的永遠只是 virtual address。

> **重點** 三種 binding：越往 execution time 越有彈性，可以在 run time 做很多記憶體管理；越往 compile time 越簡單、通常也越快，沒有 run time 的額外工作（MMU 就算是硬體，翻譯也要時間），所以簡單的裝置可能選前者。

## Dynamic loading 與 dynamic linking

### Dynamic loading：用到才 load
loader 的工作，是把程式在硬碟上的 disk image 載入記憶體，在記憶體裡把程式建立起來。

- **Static loading**：程式開始跑之前，把整個程式的記憶體內容全部建好、全部放進 memory，全部佔住記憶體。可是程式常常 allocate 一大堆卻沒用（像不小心多打幾個 0，array 開了 1 萬格，其實只用 10 格），load time 就得把那 1 萬格都佔住給你，浪費一堆用不到的記憶體。
- **Dynamic loading**：等「真的要用」的時候才 load 進記憶體。變數這種太細的空間 OS 管不到，它做的是 **routine 層級**：某個 function 被 call 到時，它的 code 才 load 進來；沒被 call，它就只是硬碟上的 code。

一支程式裡有非常多 routine 從來沒用過：程式要考慮各種可能，實際執行只走其中一條路。商業程式更明顯，可能 70%～80% 的 function 都在做 error handling，本來就不該常被用到；只為了加一個 flag、印一個訊息，就可能得從頭 test 一遍，可見處理錯誤的程式碼有多龐大。dynamic loading 就能避免把這些用不到的 code 載進記憶體。

OS 提供這個功能，但不會主動幫你決定，**由 programmer 自己決定**哪些 function 要用 dynamic loading。

```c
#include <dlfcn.h>

double (*cosine)(double);                       // function pointer：讓程式知道有這個 function
void *handle = dlopen("libm.so", RTLD_LAZY);    // 開啟、註冊 compile 好的 library
cosine = dlsym(handle, "cos");                  // run time 做 binding：cosine 就是 library 裡的 cos
printf("%f\n", (*cosine)(2.0));                 // 執行到這裡，cos 的 code 才從 disk load 進來
dlclose(handle);                                // 用完關掉、取消註冊
```

- 要動態載入的 function，先自己 compile 成一個 library（不需要 main，裡面放很多 function）。
- 程式 load 進記憶體時，cos 的 code 根本沒進來；執行到 call cos 那一行，才從 disk 把它 load 進來。
- 好處：對系統是解決記憶體浪費；對 programmer 是很有彈性。因為 run time 才 bind，程式可以視情況決定對到 cos，還是更精準的 double 版本，不同系統支援的不一樣。現在 programmer 用 dynamic loading，多半不是為了省記憶體，而是想在 run time 決定 call 哪個 function；遇到 porting 問題也常靠它解決。

> **例題** disk image（compile 出來的 binary）裡有 main 和 A、B、C 三個 function。static loading：main、A、B、C 全部一起 load 到記憶體。如果 B、C 定義成 dynamic library：一開始只有 main 和 A 在記憶體；程式 call 了 B，B 才被 load 進來，call 完它就可以離開。

### Static linking 的問題
程式裡 call 一個 printf，就要 link C library；電腦上只要是 C 寫的程式，每一支都會 link 到 C library。

**Static linking** 是 gcc 預設的作法：linker 把 library 的程式碼一起綁進來，變成一個 single binary，你的程式本來很小，link 完 binary 卻變大了。loader 拿到一整包也不知道怎麼拆，就整包 load 進記憶體。三支用 C library 的程式同時在跑，同一份 library 就被重複 load 進記憶體三次。對單一程式來說它本來就要用、也沒重複；但從 OS 的角度看，跨程式之間一堆 duplicate，記憶體可能就被這些重複的 library 佔滿。

> **陷阱** 這跟 dynamic loading 是不同的問題。dynamic loading 只管「一支程式」什麼時候用到某段 code；這裡是**跨程式**的問題。每支程式終究要用這個 library，所以就算 static linking 加上 dynamic loading，還是各有一份 copy。

### Dynamic linking：library 只放一份
**Dynamic linking**：到 run time、真的 call 到了才去 link。

- 程式 load 進記憶體時，可能只有 main program。
- C library 只需要放一份：library 是 immutable 的，不會被修改，大家可以 share。
- 第一支程式先 call printf，這時才把 library load 進記憶體；第二支程式也要 call printf，它先看 library 是不是已經在記憶體裡，在的話直接用，不用自己再 copy 一份。OS 確保整個系統只有一份 library。

library 在 compile 時有兩種選擇：compile 成 **dynamic library** 或 **static library**。Windows 的 **DLL（dynamic-link library）**就是 dynamic library，系統資料夾裡一大堆 .dll 檔全都是。compile 自己的程式時，要給 linker 一個 flag，告訴它這個 library 要用 dynamic 還是 static：

- static：全部綁成一包丟給 loader，binary 裡什麼都有。
- dynamic：你的 binary 比較小，library 的 code 還沒放進去。linker 會偷偷加一段很小的程式，叫 **stub**。stub 是 function 層級的：你 call 那個 function，先跑的是 stub，它去問 OS「這個 library 載入了嗎？在哪裡？」問到位置就完成 linking；還沒有，就請 OS 先把它 load 進來。被 call 的 library 也要配合，compile 時說明它是 dynamic library，OS 才能讓它和程式在 run time 溝通。

### 怎麼取捨
- dynamic linking 省的是「程式之間」重複的記憶體；programmer 沒辦法細部控制，只能選 dynamic 或 static library，一旦選了，裡面所有 function 都照那樣 link。
- dynamic 的小缺點是多了 stub，執行時要先找 code、問 OS，會稍微慢一點。
- static 的好處是比較快，而且不需要 OS 支援。像 embedded 或 IoT 裝置，OS 很陽春，可能根本不支援 dynamic linking。
- 不管拿來做 dynamic linking 還是 dynamic loading，那個 library 都叫 dynamic library，只是用法不同；static library 兩件事都不能做。

> **重點** **dynamic loading 是 programmer 自己做**，解決單一程式用不到的 code、減少它的記憶體用量；**dynamic linking 是 OS 幫你做**，解決跨程式重複的 library（shared library）。兩個不要搞反。

## Swapping

### Loader 和 swapper 不一樣
load-time binding 是在把 disk image 載入記憶體時做的；swapping 則是 run time 的事。兩個很像，都是把程式的記憶體內容從 disk 搬到 memory，但做事的系統元件不同：

- **Loader** 假設程式是「重新開始」：要建 PCB、初始化記憶體、建 heap 和 stack，是把 program 變成 process，很複雜。所以叫 loader 去改程式的位置，意思就是整支程式重跑。
- **Swapper** 單純多了，只是搬資料：不要了搬到 disk，要了搬回來，就是 memory 和 disk 之間的 data copy；搬到某個位置後，再改一下對應的值就好。

### Swapping 與 backing store
**Swapping**：已經 load 進記憶體的內容，在 memory 和 disk 之間移動。搬到 disk 上專門留給 OS 用的一塊空間，叫 **swap space**，標準名詞是 **backing store**。

- 安裝作業系統時會問要切多少給 swap space，這蠻重要的：**out of memory 其實是連 swap space 都用完了**，不只是實體記憶體滿。
- swap space 放的是記憶體內容，不是使用者的檔案，不歸 file system 管，由 OS 直接管理；在建檔案系統之前就先切出來了。
- 為什麼要 swapping？要 free out memory。很多記憶體是 run time 動態配置的，會一直長；有些 process 比較重要，想讓它先跑，不重要的一直佔著記憶體也不好，就先 swap 出去（這就是 mid-term scheduling，課本稱 medium-term scheduler）。
- swap 不一定以整個 process 為單位，下一章會看到可以小到一個 4KB 的 page，非常 fine grained。

### Swapping 要配合 execution-time binding
compile-time 或 load-time binding 也能 swap，但回來時**必須回到原來的位置**，因為位址寫死了。你離開的空間會被別人用，等你要回來，佔住那裡的人得先離開；偏偏把你踢走的那個人可能更重要，它一直站在那裡，你就永遠回不去。換成 execution-time binding，MMU 靠 base register 在 run time 決定位置，回來可以換地方。所以 **swapping 要跟 execution-time binding 一起用才有效**。

### 只有 idle 的 process 能 swap
OS 在 swap 之前一定要先檢查：process 必須是 idle 的，簡單講就是**不能正在做 I/O**。OS 讓 CPU 和 I/O overlap，在 waiting queue 的 process 雖然沒用 CPU，但如果在等 I/O，device 正透過 memory bus 把資料寫進它的記憶體；這時把它 swap 掉，I/O device 會把資料寫到錯的地方，或根本沒地方寫。所以在 I/O 的 waiting queue 裡不能 swap；如果是 sleep 的 waiting queue 就可以。

> **陷阱** 在 waiting queue 不代表能 swap：等 I/O 的 process，記憶體仍在被 device 使用。

解法：

1. 比較硬：程式做 I/O 前設一個 flag，OS 看到就先不 swap，等它做完再說。
2. 比較常用（**buffering**）：程式做 I/O 本來就透過 OS，OS 替它開一塊 OS buffer。I/O 的資料先進 OS 的記憶體，程式自己的記憶體沒被碰到，就能放心 swap 掉；等 I/O 做完、程式被 swap 回來，再把 buffer 的內容 copy 到程式的記憶體。OS 一定待在記憶體、不會被 swap，所以由它開 buffer。

### Swapping 有多花時間
disk 比 memory 慢很多（至少 100 倍），而且時間跟搬的大小成正比：一次 swap 整個 4GB 的 process，就要搬 4GB 到 disk，非常久。所以要搬得越少越好，還有不要搬錯人：把 P1 搬走，使用者馬上又要跑 P1，又得搬回來。下一章 virtual memory 就在處理這件事：一次只搬一個 4KB 的 page，再用演算法決定 swap 誰。

## 連續配置（contiguous allocation）

### Fixed 與 variable partition
**Contiguous allocation**：給每個程式一整塊「連續」的空間，比較符合寫程式的直覺。

- **Fixed partition**：先把實體記憶體切成固定大小的區塊。切幾格，最多就有幾個程式在記憶體裡（degree of multiprogramming），很好管理。
- **Variable-size partition**：你要多少就切多少給你，每個人分到的大小都不一樣。process 大小不同，又會進來、離開，離開就留下空著的洞（**hole**），而且 run time 一直在變。

> **比喻** fixed partition 就像停車場切成一格一格一樣大的停車格，一台車只能停一格。一台小機車只用了四分之一格，整格卻被佔住，旁邊明明還能再停兩三台，很浪費。variable partition 就像大家亂停車，留下一個個大小不一的空隙。

### First fit、best fit、worst fit
新程式要放進來，上面一個大洞、下面一個小洞都塞得下，要塞哪個？

- **First fit**：從頭找，第一個塞得下的就放進去。
- **Best fit**：全部的洞看一遍，挑塞得下的**最小**那個。
- **Worst fit**：全部的洞看一遍，挑**最大**的那個。

> **例題** 有 30K、70K、40K、90K 四個洞（照順序），要放一個 35K 的程式。
> | 演算法 | 選哪個洞 | 放完剩下 |
> |---|---|---|
> | First fit | 30K 不夠，70K 夠 → 70K | 35K |
> | Best fit | 夠大的有 70K、40K、90K，最小是 40K | 5K |
> | Worst fit | 最大的 90K | 55K |
>
> best fit 看起來最替別人著想，但剩下的 5K 小到幾乎沒人能用，反而等於浪費；worst fit 的想法是大洞用掉一部分，剩下 55K 還很大，別人還能用。

考試可能給一連串誰進來、誰離開，要你照這三個規則模擬擺放的位置。實際上誰最好？三個都是 heuristic，不保證結果一定比較好；但 **first fit 的 average case 最快**，找到第一個洞就結束，不用掃完整個 list；best fit 和 worst fit 一定要全部掃一遍（除非 list 依大小排序），比較花時間，效果又沒保證，所以實作上多選 first fit。

> **陷阱** best fit 不一定最省空間，它常留下很小、沒人能用的 hole。

### External 與 internal fragmentation
零零碎碎用不到的空間叫 **fragmentation（碎裂）**，分兩種：

- **External fragmentation**：浪費在**程式外面**。variable partition 的洞夾在程式中間（例如 P1 和 P2 之間），總空間明明夠，新的 P4 卻塞不進任何一個洞。只會在 variable size 發生：fixed size 格子都切好了，有空格、程式又塞得進一格，就停得進去。
- **Internal fragmentation**：浪費在**配出去的區塊裡面**。fixed partition 不管你要多少，都給一整格，沒用到的部分就浪費了（就像重型機車佔一整格）。

解法：

- external → **compaction**：定期整理記憶體，把程式往一邊搬，空間集中成一個大洞，P4 就放得下了。compaction 在 disk 上更常見，磁碟重組就是在做 compaction。（要能搬程式，需要 execution-time binding。）
- internal 沒什麼好解法，唯一的辦法是把格子切小，這正是 paging 要做的事。

> **重點** external 浪費在 process 之間（variable size）；internal 浪費在配出去的區塊裡面（fixed size）。

## Paging

### 為什麼需要 paging
RAM 容量很有限（大概 4GB 到 128GB），硬碟從 500GB、1TB 起跳；同樣的錢 RAM 貴很多，它是高速裝置，而且是 volatile，關機就沒了。程式平常放硬碟，要跑才搬進 RAM。可是程式越來越大，RAM 沒變大多少：打開工作管理員，背景就有好幾百個 process，再開個遊戲、繪圖軟體，RAM 就滿了。這時就需要 memory management，paging 就是其中一種方法，由 MMU 這個硬體單元實作。

> **陷阱** 把 page 暫存到硬碟（拿一部分硬碟當 virtual RAM）是下一章 **virtual memory** 的事（swap space）。paging 本身只是「把 logical 和 physical 空間切成等大的 page 和 frame，用 page table 對應」。

### Page、frame、page table
剛才講的都是 contiguous；另一種是 **non-contiguous allocation**：單一程式的記憶體本身就是不連續的。不連續也分兩種：variable size 的叫 **segmentation**，fixed size 的叫 **paging**。

擺放就是 logical 和 physical address 之間的 mapping。之前只切 physical，現在 logical 也切：

- physical 這邊切出來的單位叫 **frame**，就像車位，是一塊實體空間。
- logical 這邊切出來的叫 **page**，你的程式其實就是一堆 page。
- **frame size 一定等於 page size**（例如都是 2KB），一個 page 剛好放進一個 frame。嚴格來說兩個詞不能互換：frame 指實體，page 指程式那邊；但 size 相同，所以常被混用。

一個程式依大小變成若干個 page，目的就是找到同樣數量的 frame 把它們擺進去。要做到這件事，OS 要：

1. 知道哪些 frame 是 free 的，才能分配。
2. 維護 **page table**：記錄 page number 對到哪個 frame number，其實就是一個 array，用 page number 直接當 index。

> **例題** 程式的 logical memory 切成 page 0～3，實體記憶體切成一格格 frame。page 0 放到 frame 1，就在 page table 第 0 格寫 1；page 1 放到 frame 4……可以隨便亂放，只要 page table 記好：
> ```
> page table
> index(page)  frame
>     0          1
>     1          4
>     2          3
>     3          7
> ```

- **每個 process 都有自己的 page table**。另一支程式的 page 0 可能在 frame 2，它的表第 0 格就寫 2。page table 由 OS 配置、維護，使用者不能碰，有點像 PCB。process 放進 ready queue 之前，loader 要建 PCB、建 page table、配好記憶體，這才是 loader 最主要的工作。
- 想 **sharing** 也簡單：兩張表裡寫同一個 frame number（例如都寫 4），兩個程式就共用那塊記憶體。
- **Protection** 也是：表裡只有 1、4、3、7，MMU 翻譯只會碰到這四個 frame，別人的 frame 5 根本指不到。
- 表上寫 frame number 比較好懂；實作上存的其實是 frame 的 base address，因為最後要翻出第幾個 byte。

Paging 的好處：

1. 實體空間可以不連續分配。使用者以為自己的空間是連續的，其實 page 散落在不同 frame。
2. page 大小固定，**完全沒有 external fragmentation**；internal fragmentation 也能減少（只會發生在最後一個 page），page 越小，最多浪費的就越少。不過 page 也不能太小，不然 page table 會很大、很慢，這是一個 tradeoff。
3. **Share memory**：shared library 就是在 page table 動手腳，讓不同程式指到同一個 frame。切成 page 才好 share，因為常常只 share code 或 library 的某個 function，切小才能細粒度地 share。

### Logical address 切成 p 和 d
CPU 存取記憶體通常是 **byte addressing**：每個 address 指到一個 byte，就像每戶人家都有門牌號碼（有些系統是 4 個 byte 一個 address；題目沒特別說，就當 byte addressing）。有了 paging，logical address 這串 bit 切成兩段：

```
logical address:   |  page number p  |  page offset d  |
                    ← m − n bits →    ← n bits →
```

- **Page number p**：在程式裡的第幾個 page，拿去查 page table。
- **Page offset d**：在這個 page 裡的哪個位置（相對位置）。

bit 的長度有意義：

- offset 有 n 個 bit，能描述 2ⁿ 個位置，也就是一個 page 的大小。page size 4KB = 2¹²，位址裡就要留 **12 個 bit** 給 offset。**offset 的 bit 數只由 page size 決定。**
- page number 有 10 個 bit，最多表示 2¹⁰ 個數字，程式最多只能用 1024 個 page；page size 是 4KB 的話，程式最多能用 2¹⁰ × 4KB = 2²² bytes = 4MB，超過就沒辦法描述。
- 早期 32-bit 的電腦，程式最多只能用 4GB（2³² bytes），就是受限於位址的 bit 數；從 32 bit 換到 64 bit 很麻煩，所有的 address、硬體都得跟著改。

### Address translation：p 換成 frame，d 照抄
1. 用 p 當 index 查 page table，得到 frame number f（frame 的 base address）。
2. 接上**同一個** offset d：page 和 frame 一樣大，在 page 裡第幾個 byte，在 frame 裡就是第幾個 byte。

```
logical:   |  p  |  d  |
              │
              └─→ page table[p] = f
physical:  |  f  |  d  |        physical address = f × page size + d
```

切在哪完全由 page size 決定：page 大一點，d 的 bit 就多，p 的 bit 就少。全部都是 bit operation（把 p 那幾個 bit 換成 f），不需要真的做乘除法。

> **例題** page size 1KB = 2¹⁰，馬上想到：offset 是 10 個 bit。logical address 共 13 個 bit，最後 10 個是 offset d，前面 3 個是 page number。假設前 3 個 bit 是 010，也就是 p = 2，就去看 page table 的 index 2（從 0 開始數，所以是第三格）；假設裡面存的是 5，代表這個 page 放在 frame 5。frame 5 的 base address 是 1024 × 5 = 5120。翻譯就是把前面的 010 換成 101，offset 照抄，physical address = **5120 + d**。

> **例題** process X 有 10KB，page size 2KB，10 ÷ 2 = 5，切成 5 個 page（這裡從 P1 編到 P5；一般從 page 0 開始編）。CPU 要 P5 裡 offset d = 3 的位置。MMU 查 process X 的 page table，不是一行一行找，而是直接跳到 P5 那一格（page number 就是 index），寫著 frame 21。physical address = 21 × 2048 + 3 = 43008 + 3 = **43011**。

> **陷阱** page table 的 index 從 0 開始：p = 2 是第三個 entry。

系統可以改 page size、改 logical address 的 bit 數，但只要用 paging，翻譯原理都不變。考前一定要能自己算：給你一個系統，page number 幾個 bit、offset 幾個 bit、page size、table size 是多少。

### 位址計算題
> **例題** logical address 32 bits、physical address 36 bits、page size 4KB。
> - 兩個 bit 數不一樣可以嗎？可以。兩者沒有關聯，只要每個 logical address 能對到唯一的 physical 就行；剩下的實體空間給別的程式用。反過來，有了 virtual memory，logical 也可以比 physical 大。
> - page offset：4KB = 2¹² → **12 bits**。
> - page number：32 − 12 = **20 bits**。
> - page table entry 數 = page 數：2³² ÷ 2¹² = **2²⁰ 個**。
> - page table 大小：entry 數 × 每個 entry 大小（通常 4 bytes）= 2²⁰ × 4 B = **4MB**。
> - 一個程式最多能用：2³² bytes = **4GB**（由 logical address 決定）。這就是早期電腦不能超過 4GB 的原因：沒有位址能描述它，一直加硬體也沒用。
> - 實體記憶體多大：2³⁶ bytes = **64GB**（由 physical address 決定）。
> - frame number：36 − 12 = **24 bits**，比 page number 多。

> **陷阱** 題目問 page table 的「size」時，要分清楚是 entry 數（2²⁰）、byte 數（2²⁰ × 4 B = 4MB），還是 bit 數。不用死背，想清楚運作原理，就知道哪個數字該除以哪個。

> **例題** logical address 共 12 bits，page size 1KB，每個 page table entry 4 bytes。offset = log₂(1024) = 10 bits；page number = 12 − 10 = 2 bits → 2² = 4 個 entry；page table 大小 = 4 × 4 bytes = **16 bytes**。

> **例題** 已知某個 logical address 和它的 physical address，問查的是 page table 的第幾個 entry、frame number 是多少：把兩個位址轉成 bit，logical 的 page number 部分是 0 → 第 0 個 entry；physical 的 frame number 部分是二進位 11 → frame 3。

### Free frame list 與 frame table
OS 維護一個 **free frame list**：就是一個 linked list，把空的 frame 都串起來。page 要找 frame 時，從 list 最上面 pop 一個就好（反正是不連續配置，哪個 frame 都行），寫進 page table 就完成，配置是 **O(1)**。程式被 kill 掉時，看它的 page table 用了哪些 frame，全部放回 free frame list。

**Frame table** 剛好倒過來：記錄每個 frame 裡放的是哪個 process 的哪個 page。在 paging 裡它只是 accounting（記帳用），不參與 translation；唯一的特例是 inverted page table。

### Page size 怎麼選
page size 是 physical 和 logical 兩邊唯一一定要對上的參數。

- **一定是 2 的次方**：翻譯全靠 and、or、shift 這種 bit operation，不然還得十進位、二進位轉來轉去。
- 一般系統從 512 bytes 到 16MB 都有，最常見的是 **4KB 或 8KB**。
- 調大（例如 16MB）：internal fragmentation 很嚴重，很多程式才幾 KB，配一個 16MB 的 page 大半都浪費。
- 調小：page number 很多，page table 會變得很大，而且每個 process 都要一張，OS 浪費不少記憶體存這些表。同樣讀 4KB，page 是 4KB 時一個就夠，1KB 就要碰 4 個 page，每個都要查，還可能一次次從 disk 抓，效能往下掉。

所以 page size 通常是 4KB 或 8KB，純粹是經驗法則。

> **重點** paging 的本質：page table 做 translation，把 logical 和 physical memory 切開。使用者看到的 logical space 永遠是連續的，physical 卻可以散落各地；程式不變複雜，實體空間又用得有效率。代價是 OS 要維護 page table，還要在 run time 翻譯，所以都用 hardware 來做。

## Page table 的硬體支援

### PTBR：page table 放在 memory 裡
page table 本身也是 OS 建立的資料，跟別的資料一樣放在 memory 裡。翻譯的 MMU 是一塊硬體電路，它只能直接用自己 register 裡的資料，所以要先把 page table 的內容從 memory 讀進來；它靠一個 register 知道 page table 從哪裡開始，叫 **PTBR（page-table base register）**。

- PTBR 放的是 **physical address**：讀 page table 的是硬體本身，沒人會再幫它翻譯，必須直接給真正的位置。
- 每個 process 有自己的 page table，所以 PTBR 的值每個 process 一份，存在它的 **PCB** 裡；context switch 時，OS 把新 process 的 PTBR 值載入 MMU，P2 開始跑之後，MMU 用的就是 P2 自己的 page table。

### 一次 read 變兩次 memory access
1. CPU 送出 p 和 d，MMU 先去 memory 讀 page table，查出 page p 在哪個 frame（第 1 次）。
2. 翻譯完變成 f 和 d，再去 memory 讀真正要的資料（第 2 次）。

程式只下了一個 read，背後卻變成兩次 memory read，時間變兩倍：好比花錢買了每秒 100 GB 的記憶體，實際只有 50 GB 的效果。

### TLB
所以現在的電腦都加了 **TLB（translation look-aside buffer）**：本質是 cache，翻譯過的 page 對 frame 先記起來，下次 hit 了就不用再讀 page table，又回到一次 access。

- TLB 不是一般的 RAM，而是 **associative memory**，速度通常比一般 memory 快 10 倍以上。
- page table 有順序，要查第 3 頁直接跳到第 3 格；TLB 沒有順序，裡面可能亂亂地放著 page 1、7、5、2。問 page 3 在不在？一般記憶體只能一格一格比，N 筆就要 O(N)；associative memory 的電路可以**同時**拿 page 3 跟所有 entry 比，一次就知道有沒有，所以是 **O(1)**。
- 這種電路很複雜、很貴，容量做不大（大概幾千筆的等級），不可能把整張 page table 塞進去，只放最常用的一小部分。
- TLB 就是 MMU 的 cache，放在 MMU 裡面。**每個 process 都有自己的 page table，但 TLB 是硬體，整台電腦只有一個**，大家共用。

> **陷阱** TLB 雖然是「搜尋」，但是平行比對，時間是 O(1) 而不是 O(N)。

流程：

1. 每次翻譯，第一步先查 TLB。
2. **Hit**：直接拿到 frame（例如 frame 6），加上 d 去讀資料，只碰 memory 一次。
3. **Miss**：去 memory 讀 page table 得到 frame，再讀資料，共兩次；並把這筆 (p, f) 存進 TLB，滿了就踢掉最不常用的那筆。

### Context switch：flush TLB 或加 PID
TLB 每筆只記 page number 和 frame number，裡面裝的是 P1 的對應。換 P2 上來：每個 process 都有 page 0，卻對到不同 frame，P2 問 page 0，TLB 回的是 P1 的 frame。

- **解法一（最常用）：flush TLB**。context switch 時整個清空，因為 page table 換人了，舊的都不能用。
- **解法二：每筆多一個欄位記 process ID**（address-space identifier）。page number 和 PID 都對上才算 hit。

一般還是選 flush：現在的程式記憶體很大，一跑就把 TLB 塞滿自己的 page，留著別人的也沒什麼用；而且 TLB 很貴，每筆原本 page 加 frame 共 8 bytes，加 4 bytes 的 PID 變 12 bytes，三分之一都花在 PID 上。

> **重點** context switch 時，除了載入新的 PTBR，還要 flush TLB。flush 之後，接下來的存取全部 miss，每次都兩倍時間，直到 TLB 慢慢填回來，這也是 context switch 拖慢效能的一大原因。

### EMAT
**EMAT（effective memory access time）**：平均每次存取 memory 要多久。

```
EMAT = hit rate × (TLB 時間 + memory 時間)
     + (1 − hit rate) × (TLB 時間 + 2 × memory 時間)
```

> **例題** 查 TLB 要 20 ns，讀一次 memory 要 100 ns。
> - hit：查 TLB 20 + 讀資料 100 = **120 ns**。
> - miss：TLB 一樣要先查 20 ns（查了才知道沒中），再讀 page table 100、讀資料 100 = **220 ns**。
> - hit rate 70%：0.7 × 120 + 0.3 × 220 = 84 + 66 = **150 ns**。
> - hit rate 98%：0.98 × 120 + 0.02 × 220 = 117.6 + 4.4 = **122 ns**。
> - 沒有 TLB：每次兩次存取 = **200 ns**。98% 的 hit rate 少了約四成的時間（122 vs 200），已經很接近只讀一次 memory 的 100 ns；就算只有 70%，150 ns 也比 200 ns 少了 25% 的時間。

> **陷阱** miss 的時間要記得加上查 TLB 的 20 ns：是 220，不是 200。

> **例題** 題目給一串存取順序、TLB 只有 2 個 entry 時：依序看每一個是不是跟 TLB 裡的 page 相同；第一次 access 到的 page 一定 miss。數出 hit、miss 的次數後套公式：hit 是一次 TLB 加一次 memory，miss 多一次 memory（讀 page table）。

**Hit rate 為什麼這麼高：locality。** 實際電腦的 hit rate 常常超過 99%，因為程式讀資料有很強的 locality：code 是一個 instruction 接一個 instruction，program counter 每次往下移 4 個 byte；而 TLB 一筆存的是一整個 page（4KB）的翻譯。第一次讀某個 page 會 miss，放進 TLB；接下來 4 byte、4 byte 讀 1000 次，扣掉第一次，剩下 999 次全部 hit。for loop 把 array 每個 element 加 1 也一樣，連續讀，大部分待在同一個 page。所以 hit rate 通常很高，越高越接近 100 ns。

TLB 只是一個最佳化，可以沒有。translation 的過程沒變，只是 mapping 從 TLB 查，還是從記憶體讀 page table。

## Page table 的其他用途

### Valid–invalid bit
page table 每一格通常再加 **protection bit**：可以表示 read-only、可寫、executable（有點像開檔的 read only 權限，或宣告成 constant 的變數），存取時就知道能做什麼。一般 OS 在這裡最主要用的是 **valid／invalid bit**，表示這個 page 現在能不能用：

- 不能用的原因之一：OS 先 reserve 了很大的空間，但你還沒 malloc、stack 還沒長到那。
- 更重要的是下一章：invalid 也用來表示「這個 page 存在，但現在被 swap 到 disk 上」。

> **例題** page number 3 bits，最多 8 個 page，早期依 page number 長度先建好整張表（8 個 entry）。程式一開始只用 6 個，所以 page 0～5 標 v，page 6、7 還沒配置，標 i。pointer 不小心指到 page 6，查表立刻被擋，硬體 trap 給 OS，OS 判定非法存取就終止程式，也就是 segmentation fault。

> **例題** process X 的 page table 裡，P4 那一格標著 INV。這裡的 invalid 表示 P4 現在不在 RAM 裡，而是放在 secondary storage 上。CPU 要 P4 時就發生 **page fault**：要的 page 不在實體記憶體，必須先把它搬進來（下一章的主題）。

### PTLR（page-table length register）
真實電腦的 page table 不會只有 8 格。很多程式都很小，可能前十個 entry 是 valid，後面 9000 個全是 invalid，建一張超大的表存一堆 invalid 很浪費。所以再用一個 **PTLR**，記錄 page table 的長度（概念就像 base 和 limit 裡的 limit）：程式用到幾個就建幾個，length 記成 6，page number 超過範圍就直接擋掉。table 可以變短，也是動態長的：程式長到新的 page，OS 才再加一個 entry，標成 valid。

有了 length，為什麼還要 valid bit？

1. 在長度範圍內的 page，也可能被 swap 到 disk，目前不在記憶體。
2. 程式不一定一路連續往下長，heap 和 stack 中間可能有沒配置的 page，還是要一個 bit 標出來。

> **陷阱** PTLR 記的是 page table 有幾個 entry，以 page 為單位擋掉超出範圍的 page number。程式的長度常常不剛好落在 page 的邊界上，最後一個 page 裡沒用到的 byte 屬於 internal fragmentation，valid bit 和 PTLR 都抓不到它。

### Shared pages：reentrant code
有時我們「刻意」要 share：shared memory programming、thread 本來就要共用記憶體、create process 時用 copy on write（有改的部分才 copy，沒改的先共用），更重要的是 **shared library**：load 進記憶體之後大家一起用，只放一份。

能共用的 code 必須是 **reentrant code（pure code）**：執行時不會改自己，沒有任何使用者能改它的程式碼。library、editor、application 都是例子。做法是不同 process 的 virtual address，在 page table 裡指到同一個 frame，每個人都以為自己 load 了一份。paging 切得細，不必整個程式都 share，用到哪幾個 page 就 share 哪幾個，私人資料各用各的。

> **例題** 三個使用者都在用 editor，editor 佔三個 page。OS 知道它是 reentrant code，三張 page table 的前三格都填 **3、4、6**；三個人的 data 各自不同，分別在 frame **1、7、2**。
> ```
> P1 page table   P2 page table   P3 page table
> ed1 → 3         ed1 → 3         ed1 → 3
> ed2 → 4         ed2 → 4         ed2 → 4
> ed3 → 6         ed3 → 6         ed3 → 6
> data1 → 1       data2 → 7       data3 → 2
> ```
> 實體上 editor 只 load 一份，三個人看到的結果都正確。因為是 pure code，可以把它的 read-only bit 設起來，有人想寫進這塊空間，OS 一看是 read-only，直接丟 fault 擋掉。

## Page table 的結構

### 為什麼需要不同的結構
前面的做法是 page number 查一次表就好，叫 **one level**。virtual address 要能存取 2³² = 4GB、page 4KB，就需要 2²⁰ 個 entry，每個 4 bytes，光這張 page table 就要 4MB。這 4MB 是 MMU 用 physical address 在讀，沒人幫它翻譯，說第 3 格就直接跳過去，所以**必須實體上完全連續**。可是實體記憶體早就切成 4KB 的 frame、到處散落，很難找到連續 4MB；找不到就可能回你 out of memory，其實你明明還有記憶體。

接下來三種結構都在解決同一件事：空間還是很大時，怎麼讓每一張 page table 變小，塞得進零碎的空位。

### Hierarchical（multi-level）page table
entry 太多，就把它切成好幾段，每一段是一張獨立的小 table，可以塞到實體記憶體裡不同的位置；再建一張表記錄它們的位置。

> **例題** 32-bit 位址，原本 20 | 12。切成兩層：**10 | 10 | 12**。
> ```
> | p1 (10 bits) | p2 (10 bits) | d (12 bits) |
>   outer page     inner page     page offset
> ```
> - 後面 12 bits 完全不變，還是 page offset。
> - 前 10 bits 是 outer page table 的 index；outer table 存的不是資料的 frame，而是 inner table 放在哪個 frame。
> - 後 10 bits 是 inner page table 的 index；inner table 存的才是資料最後所在的 frame number。
> - 拆完最大的一張 table 只有 2¹⁰ 個 entry，2¹⁰ × 4 bytes = **4KB**，剛好一個 frame，有空 frame 就塞得進去。
> - outer table 的位置由 PCB 裡的 PTBR 直接指到；inner table 可以放在任何地方。

> **比喻** 1000 個 element 的 array 要連續 1000 格；寫成 10 個、每個 100 格的二維 array，一樣找得到。也可以再切成三層，完全是 array 怎麼拆的問題。

memory access 次數：p1 查 outer table（第 1 次），p2 查 inner table（第 2 次），加 offset 不用存取，讀資料（第 3 次）。從兩次變三次，切得越細，要讀的次數越多，所以 TLB 的功用就更大了。

> **陷阱** hierarchical 讓「單一張」table 變小，**entry 總數沒有變少**：小表合起來就是原本那張，還多一張 outer table，總數其實變多。每多一層就多一次 memory access。

**64-bit 的極限**：如果只切 2 level，例如 42 | 10 | 12，outer table 就有 2⁴² 個 entry，每個 4 bytes，是 **16 TB**，兩層根本不夠。就算前面對半分，每層還是二十幾個 bit。每層最好 10～12 個 bit，table 才塞得進一個 4KB 的 frame，64-bit 的位址大概要切成 5 層，總共 memory access 就是 6 次（5 層各查一次，再讀一次資料），變成 6 倍慢。真實電腦大概做到 4 level 就受不了了，總會有 TLB miss 的時候。

### Hashed page table
翻譯本質上是 lookup，可以用 hashing：先決定要幾個 bucket，hash 的是 **page number**。

> **例題** 5 個 bucket，hash function 是 mod 5：page 3 放 bucket 3，page 6 放 bucket 1。page 3、13、23 都擠在 bucket 3，要沿 linked list 一個一個比對 page number 相同才算找到。

- 每個 element 存三樣東西：**page number、frame number、指向下一個的 pointer**。對上了就拿 frame 去翻譯。
- bucket 數量很有彈性，跟 virtual address 的 bit 數無關。bucket 太少 collision 多，找到 bucket 還要一個一個 search；bucket 建得多，每個裡面只有一兩筆，很快就找到。要幾個 bucket 是 trade-off。
- 真正的好處：程式用的 virtual address 很分散（dynamic allocation、heap、stack），範圍也許跨 4TB，真正用到的可能才 4GB。一般的 page table 跟你用了多少無關：頭尾都用到、中間沒用，中間的 entry 也得全部留著，只能標 invalid。hash 不一樣：**沒用到的 page 根本不會出現在 bucket 裡**，也不用事先配置。用得少又分散時，hashing 比較有效率。
- 缺點：pointer 很多，entry 本身只存一個 4 bytes 的 frame，pointer 又用掉 4 bytes，空間多了一倍；運氣不好要 traverse linked list，每走一個 pointer 就是一次 memory access，跟多層 table 是一樣的問題。

**Clustered hashed page table**：每個節點不只放一筆，而是放一組（例如把 23、33、43 包在一起），存在連續的記憶體，像一張小小的 table，可以一次讀進 MMU、一次比對有沒有 hit。就算還要 scan，至少是一次讀進去，traverse 次數就少了（例如一次讀 4KB，約 1000 個 entry 一起 load 進 MMU 再找）。

### Inverted page table
不用 page table，改用 **frame table** 翻譯：index 是 frame number，裡面存的是 page number。但 frame 只有一個，同號碼的 page 卻很多（每個 process 都有 page 1），所以 entry 還要存 **PID**。

```
logical address: | pid | p | d |
search 整張表找 (pid, p)，在第 i 格找到 → physical address = | i | d |
```

- 為什麼要倒過來？為了省記憶體。page table 跟著 process 數量變多，一萬個 process 就一萬張表，還會一直長；frame 是硬體，數量固定，frame table 可以事先配好、大小不變，使用率幾乎是 100%。它比一張 page table 大，但所有 process 的 page table 加起來一定遠大於它。有 virtual memory 時 virtual 位址通常遠大於 physical，倒過來後只跟實體記憶體有關，**全系統一張就夠**。
- 缺點一：**translation 比較慢**，要 search 這張表。page table 可以直接跳到第 3 格；frame table 沒有順序，讀完 page 3 要讀 page 4，不知道在哪，只能 search。可以把連續的 entry 一次 load 進 MMU 做 linear search 來減輕。
- 缺點二：**sharing 很難**。一個 entry 就是一個 frame，只能記一個 page，想讓一個 frame 對到兩個 page 就做不到。sharing 實在太重要，所以這個做法很少見，雖然它真的很省空間。

> **重點** 三種結構怎麼選：
> - user memory 很分散（範圍大、真正用到的少）→ **hashed**
> - 記憶體很快、要最直接 → **one-level**（只查一次）
> - process 非常多、不需要考慮 page sharing → **inverted**
>
> 為什麼 page table 要拆成小塊：不想 allocate 一整塊連續的 physical memory（page table 本身沒辦法再做 mapping），讓每塊剛好放進一個 frame（通常 4KB），用 pointer 串起來。

## Segmentation

### 用 programmer 的角度切
寫程式拿到的錯誤不是 page fault，而是 segmentation fault，所以 OS 兩個都用，離 programmer 比較近的那層是 segmentation。

配置分 fixed-size 和 variable-size：fixed-size 的不連續配置是 paging；variable-size 的不連續配置就是 **segmentation**。它不只是大小不同，更重要的是**從使用者的角度**去切程式的記憶體：程式本來就是好幾個 segment，code、call stack 裡一個個 function、OO 裡的 object、heap、stack、記錄每個變數放哪的 symbol table。每一塊大小都不同，stack、heap 還會動態長大，所以是 variable size。寫 assembly 時，本來就會寫 code、data segment。

load 時跟 paging 一樣，用一張 **segment table** 翻譯，就能放到實體記憶體任何地方。缺點是 variable size 會讓 **external fragmentation** 很嚴重，要找到夠大的空間比 paging 難；配置時用 free list 找夠大的空間（前面的 first fit、best fit），把 base 填進表裡。

### Segmentation 的位址轉換
logical address 跟 paging 很像：`<segment number s, offset d>`。

- 最大的不同：paging 的 offset 只到一個 page（例如 4KB）；segment 可以長到任意大，offset 的 bit 數取決於系統規定一個 segment 最大多大（例如最大 4GB，offset 就要能描述到 4GB）。
- segment table 每個 entry 存 **base**（segment 起點的 physical address）和 **limit**（segment 長度）。segment 長度不固定，每個都要有自己的 limit，才知道 offset 合不合法。
- segment table 的位置存在 PCB（segment-table base register），也有長度（segment-table length register）：最多可以有 1000 個 segment，只用 4 個就寫 4。

```
1. 用 s 查 segment table，取得 (limit, base)
2. 檢查 d < limit；不成立 → trap（segmentation fault）
3. physical address = base + d      ← 真的相加
```

> **例題** logical address (s, d) = (2, 53)。查 segment table 第 2 格：limit 400、base 4300。53 < 400，合法；physical address = 4300 + 53 = **4353**。如果同一個 segment 的 offset 是 500，超過 limit 400，就丟出 segmentation fault。

> **陷阱** segmentation 是 base **加** offset：segment 可以從任意 byte 開始，不在 4KB 邊界上。paging 是 frame number **接上** offset：page 一定在 frame 邊界上，base 後面那幾個 bit 本來都是 0，所以 offset 可以直接接上去。

### Segmentation vs paging
| | Paging | Segmentation |
|---|---|---|
| 大小 | 固定（page = frame） | 不固定，依程式內容 |
| 切的角度 | 系統（硬體方便） | 使用者（程式的邏輯單位） |
| table entry | frame number（base） | base + limit |
| 轉換 | f 接上 d | base + d，先檢查 d < limit |
| fragmentation | 只有 internal（最後一頁） | external 很嚴重 |
| protection | 主要是 valid bit | 每個 segment 的讀、寫、執行權限 |
| sharing | 以 page 為單位 | 以 segment 為單位，長度精確 |

- 每個 segment 的空間各自獨立控制，heap 可以很大、data 可以很小，還能設 read、write 權限，不對就丟 fault。不同 segment 永遠不會 overlap。
- **Sharing**：概念跟 paging 一樣，兩個 process 的 segment table 裡 base 設成一樣，指到同一個實體位置就好。為什麼放在 segment 這層做？editor 跨好幾個 page，最後一頁還沒滿；但程式本來就是用 segment 寫的，editor 一定是一個 segment，load 一個 library 就是一個新的 segment；而且長度可以精確控制，editor 剛好 43062 bytes，就 share 這麼多，多一個 byte 都不會。不能只共用一個 segment 的一部分，想共用就建一個獨立的 segment。
- 還記得 thread 嗎？heap 共用、stack 不共用，所以 stack segment 設成不 share，heap segment 就能 share。

## Segmentation 加 paging

### Linear address
segmentation 在上面，大家寫程式只用這個概念；但它很容易有 external fragmentation，所以電腦在 segmentation 之後，再做一次 paging：

```
CPU ──logical──→ [segmentation unit] ──linear──→ [paging unit] ──physical──→ memory
                 └─────────────────── MMU ───────────────────┘
```

- 一個 process 的記憶體分成好幾個 segment（code、heap、stack）。先把每個 segment map 到一個很大的 **linear address space**。這個空間根本不存在，只是數字轉換，中間有洞也無所謂。
- 再用 paging 把 linear address space 切成固定大小的 page（一個 segment 可能跨三、四個 page），只要實體記憶體有空 frame，就把 page 一個個放上去。
- linear address 既不是 logical 也不是 physical。paging 只是吃一堆 bit，不在乎它叫 linear 還是 virtual address。

好處：programmer 用 segment 寫程式很容易，compiler 也只要知道是哪個 segment、哪個位置；下一層 MMU 再切成小 page，所以**完全沒有 external fragmentation，internal 又很少**，segment 再大也能分散放。

> **重點** 為什麼 segmentation 在上（靠近使用者）、paging 在下？segmentation 符合程式的組織方式（code、heap、local variable，每塊大小不一），方便 compiler 把程式放進 memory；OS 管理實體記憶體時希望每塊大小固定，用簡單的 page table mapping 就能很快找到空位、沒有 external fragmentation。所以效能、比較複雜的部分交給底層的 paging。答題要講出「為什麼」。

### Intel Pentium 的位址轉換
logical address **48 bits**：

```
|   selector (16 bits)   |        offset (32 bits)        |
| s (13) | g (1) | p (2) |
```

- 後面 **32 bits** 是 segment 的 offset，所以**單一 segment** 最多 4GB（不是整個程式不能超過 4GB）。
- 前面 16 bits 的 selector：**13 bits** 是 segment number；**1 bit** 表示 private 還是 shared 的 segment，兩者查不同的表；最後 **2 bits** 跟 protection 有關（x86 上是 privilege level，ring 0～3）。
- 13 bits 加上 share 那 1 bit，就是 2¹⁴ 個 segment，一半 share、一半不 share，每個最多 4GB。

翻譯：

1. Segmentation：依那 1 bit 選 private 或 shared 的 segment table，用 13 bits 當 index 讀出 base，跟 32-bit offset 相加，得到 **32-bit linear address**。
2. Paging：two-level page table，32 bits 一樣切成 **10 | 10 | 12**。前 10 bits 查 outer table 找到 inner table，後 10 bits 查出 frame，再接 offset，就完成了。
3. Intel 可以同時支援 **4KB 和 4MB** 的 page：outer table 查完有一個 bit，如果指到 4MB 的 page，後面 **22 bits** 就全部當 offset（2²² = 4MB）。程式大就用大 page，小就用 4KB。

### 綜合題：segmentation + paging
> **例題** 實體記憶體 512 bytes，page size 32 bytes，一共 8 個 segment。給 logical address **0x448**，求 physical address。
> 1. 512 = 2⁹ → physical address **9 bits**；32 = 2⁵ → page offset **5 bits**，page number（linear 的前段）= 9 − 5 = **4 bits**；8 = 2³ → segment number **3 bits**。
> 2. 0x448 換成二進位，共 12 bits：`0100 0100 1000`。前 3 bits `010` → **segment 2**；剩下 9 bits `0 0100 1000` = **72** → segment offset。
> 3. 查 segment table 第 2 格得到 base₂（並檢查 72 < limit），linear address = **base₂ + 72**。
> 4. 對 linear address 做 paging：低 5 bits 是 page offset，前 4 bits 是 page number，算出來是 **page 5**。
> 5. 查 page table 第 5 格，內容是 **2** → frame 2。把前 4 bits 換成 2（`0010`），低 5 bits 照抄：physical address = 2 × 32 + (linear 的低 5 bits)。
>
> （示意）若 base₂ = 96：linear = 96 + 72 = 168 = `0101 01000`（9 bits：page `0101` = 5，offset `01000` = 8）→ physical = 2 × 32 + 8 = **72**。

> **陷阱** 先做 segmentation（相加）得到 linear address，再對 linear address 做 paging（替換 page number）。不用擔心翻出來會跟別人撞在一起，那是配置時確認過的；offset 超過 segment 長度也會被擋掉。

## 重點整理
- memory 是 CPU 唯一能直接 access 的儲存；memory management 管配置、位置、protection
- address binding：compile time（absolute code，不能搬）、load time（relocatable code，搬要 reload）、execution time（MMU 翻譯，可隨時搬）
- logical（virtual）address 從 CPU 送出；physical address 送進 memory；只有 execution-time binding 兩者不同
- relocation register：physical = logical + base（346 + 14000 = 14346）
- dynamic loading：programmer 控制，用到才 load routine（dlopen／dlsym／dlclose）；dynamic linking：OS 支援，run time 才 link，shared library 只放一份，靠 stub
- swapping：backing store（swap space）不歸 file system 管；要配合 execution-time binding；等 I/O 的 process 不能 swap（用 OS buffer 解）
- first fit（最快、最常用）、best fit（留小洞）、worst fit（留大洞）
- external fragmentation：variable size，用 compaction；internal：fixed size，切小格
- paging：page = frame 大小；page table 每個 process 一張；p 查表換成 f，d 照抄
- offset bits = log₂(page size)；page number bits = logical bits − offset bits；frame number bits = physical bits − offset bits
- page table 大小 = entry 數 × entry 大小；32-bit、4KB、4 B entry → 2²⁰ entries、4MB
- page size 是 2 的次方，常見 4KB、8KB；大 → internal fragmentation，小 → table 大
- PTBR 存 page table 的 physical address，放在 PCB；沒 TLB 時每次存取要 2 次 memory access
- TLB：associative memory、O(1) 平行比對、全系統共用；context switch 要 flush（或加 PID）
- EMAT = h × (t + m) + (1 − h) × (t + 2m)；20 ns／100 ns：70% → 150、98% → 122、無 TLB → 200
- valid–invalid bit：未配置或在 disk 上；PTLR 限制 table 長度；兩者都需要
- shared pages 只限 reentrant（pure）code，可設 read-only
- hierarchical：每張 table 變小（4KB），entry 總數變多，每層多一次存取；64-bit 要 4～5 層
- hashed：hash page number，element 存 (p, f, next)；適合空間大又分散；clustered 一次讀一組
- inverted：一張 frame table 全系統共用，存 (pid, p)；省空間但要 search、難 sharing
- segmentation：(s, d)，segment table 存 base + limit；d < limit 才合法，physical = base + d（2, 53 → 4353）
- segmentation + paging：logical → segmentation → linear → paging → physical，兩個 unit 都在 MMU
- Pentium：48-bit logical（13 + 1 + 2 bit selector、32-bit offset）→ 32-bit linear → 10 | 10 | 12；也支援 4MB page

## 名詞對照
| 中文 | English |
|---|---|
| 位址繫結 | address binding |
| 絕對碼／可重定位碼 | absolute code / relocatable code |
| 記憶體管理單元 | memory management unit (MMU) |
| 重定位暫存器 | relocation register |
| 邏輯位址／虛擬位址 | logical address / virtual address |
| 實體位址 | physical address |
| 動態載入 | dynamic loading |
| 動態連結 | dynamic linking |
| 共享函式庫 | shared library |
| 置換 | swapping |
| 後備儲存 | backing store |
| 連續配置 | contiguous allocation |
| 固定／可變分割 | fixed / variable partition |
| 洞 | hole |
| 最先／最佳／最差配適 | first fit / best fit / worst fit |
| 外部／內部碎裂 | external / internal fragmentation |
| 緊縮 | compaction |
| 分頁 | paging |
| 頁／頁框 | page / frame |
| 頁表 | page table |
| 頁號／頁內偏移 | page number / page offset |
| 頁表基底暫存器 | page-table base register (PTBR) |
| 頁表長度暫存器 | page-table length register (PTLR) |
| 轉譯後備緩衝區 | translation look-aside buffer (TLB) |
| 關聯式記憶體 | associative memory |
| 有效記憶體存取時間 | effective memory access time (EMAT) |
| 區域性 | locality |
| 可重入碼 | reentrant code / pure code |
| 階層式分頁 | hierarchical paging |
| 雜湊頁表 | hashed page table |
| 反轉頁表 | inverted page table |
| 分段 | segmentation |
| 段表 | segment table |
| 線性位址 | linear address |
