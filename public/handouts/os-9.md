# 檔案系統

CPU 與 memory 之後，OS 要管的最後一塊資源是儲存空間。這章分兩半：先從使用者的角度看檔案系統提供什麼（file、access method、directory、mounting、sharing 與 protection），再進到內部看它怎麼實作（layered file system、on-disk 與 in-memory 結構、VFS、allocation method、free-space management），最後往下接到硬碟本身的結構與存取時間。考試最常考三種配置方式（contiguous／linked／indexed）的比較、FAT 的結構，以及 UNIX inode 的最大檔案大小與「讀第 N 塊要幾次 I/O」的計算。

## 學完這章要會
- 說出 file 是 logical storage unit、sector 是 physical 最小單位，並列出 file attributes 與 operations
- 解釋 per-process 與 system-wide open-file table 各存什麼、為什麼要分兩張
- 從 API 參數分辨 sequential、direct、index access
- 分清 partition、volume、raw partition，以及五種 directory 結構（含 hard／soft link、reference count、garbage collection）
- 說明 mount point、mount table 怎麼跨 partition 找檔案
- 讀懂 `ls -l` 的 rwx、用 `chmod` 數字設定權限
- 畫出 layered file system 與 on-disk／in-memory 結構，走一遍 open、read/write、create 的流程；說出 VFS 的用途
- 比較 contiguous、extent、linked、FAT、indexed、linked index、multi-level index、inode 的優缺點與 I/O 次數
- 算 inode 的最大檔案大小、判斷第 N 塊落在 direct 或哪一層 indirect
- 說出四種 free-space management，算 bit vector 的大小
- 說出硬碟結構（platter／track／sector／cylinder）、CLV 與 CAV、access time 的三個部分，以及為什麼 disk scheduling 的目標是 seek time

## File 是什麼：logical storage unit

CPU、memory 之後，OS 要管的最後一塊資源是 **storage（儲存）**，而儲存最常見的形式就是**檔案（file）**。檔案系統分兩半來看：先看 **interface**（站在使用者的角度，檔案系統提供什麼），再看 **implementation**（內部怎麼做）。這一段是 interface：檔案與 access method、directory、mounting、sharing、protection。

**File 是一種 logical storage unit（邏輯儲存單位）**。「邏輯」的意思是：它是為了讓人方便使用而定義的單位，不是硬體真正的樣子。對 storage 來說，存的東西只是一堆 bytes，它不在乎內容是文字還是圖片；file 是呈現與使用資料最常見的方式。

**Physical unit（實體單位）**要看硬體用什麼方式儲存。目前最主要的儲存裝置仍是 **hard drive（硬碟）**，靠讀寫頭在旋轉的盤面上讀寫：

- 硬碟裡有好幾片讀寫盤，叫 **platter**，疊在一起轉動。
- 每片盤面切成一圈一圈的同心圓，每一圈叫 **track（磁軌）**。
- 每個 track 再切成一段一段，每一段叫 **sector（磁區）**。

**Sector 才是真正存資料的最小 physical storage unit**，資料最後都落在某個 sector 上。

```
logical                         physical
a.txt（一串 bytes）  ──map──▶   platter → track → sector
```

> **重點** 檔案系統的工作之一，就是把 file 這個邏輯單位的內容，map 到實體的 sector 上。

## File attributes

除了把內容 map 到 device 上，一個檔案還帶著很多 **attribute（屬性）**：

| 屬性 | 說明 |
|---|---|
| name | 檔名，使用者取來方便自己辨認，**它也只是一個屬性** |
| identifier | 真正唯一的身分，一個人看不懂（non-human readable）的 ID，例如 `#1027`（示意） |
| type | 檔案型別 |
| location | 存在 device 的哪裡 |
| size | 大小 |
| protection | 誰可以讀、寫、執行 |

人不愛記數字，所以才在 ID 之外另外有檔名。有些屬性是給使用者方便讀檔、用檔，有些是給 OS／file system 自己管理用。這些屬性全部都要存起來（存回硬碟）：**屬性加上內容，才構成一個 file**。

## File operations

File 支援的 operation 不多，大約十種：

- **open、read、write**：最常見。
- **create、delete**。
- **truncate（截斷）**：從某個位置開始，後面的內容通通不要了。處理檔案時很常用。
- **concatenate（串接）**：把兩個檔案接在一起，誰在前誰在後都可以。

```
truncate（從第 5 格之後截掉，示意）
log: [A][B][C][D][E][F][G][H]   →   [A][B][C][D][E]

concatenate（把 log2 接到 log1 後面）
log1: [a1][a2][a3]   log2: [b1][b2]   →   [a1][a2][a3][b1][b2]
```

> **例題** 什麼時候用 concatenate？系統裡不同 process 各自 dump 了一份 log，分在不同檔案，但要合在一起看才有意義，這時就把它們接起來。

## 開檔之後的兩張表

要操作、修改檔案內容，系統運作時需要一些 **metadata（描述資料的資料）**：這個檔案存在哪？剛剛操作到哪個位置？這些資訊主要放在兩個 data structure 裡：

1. **Process 這邊：open-file table**。正在操作檔案的 process 會有一張。
2. **OS 這邊：system-wide open-file table**。檔案被開啟時，OS 也把它的資料存進這張全系統共用的表。

> **觀念** 問：為什麼操作檔案前一定要先 open？
> 答：因為 open 才會建立這兩張表裡需要的資訊（entry）；沒有 open，後面的讀寫都做不了。

### Per-process open-file table

**重點：它是 per process 的，每個 process 各有一張**。每開一個檔案，表裡就多一個 entry；entry 本身是一個 data structure，存**只跟這個 process 有關**的資訊。

寫 C 時 `fopen` 會回傳一個 **file handler**（常被叫做 file pointer），之後讀寫都用它。這個 handler 其實就是對到 open-file table 裡某個 entry 的位置。

entry 裡的兩個例子：

- **position**：目前讀寫到哪。剛開檔時是 0；read 之後往後移。同一個檔案可以被很多 process 開，但每個 process 有自己的 position。
- **access right**：同一個檔案，P1 用 read 開、P2 用 write 開，權限就不同。

```
P1 的 open-file table          P2 的 open-file table
| a.txt | pos 4 | read  |      | a.txt | pos 0 | write |
（P1 讀了 4 bytes，pos 0→4）   （P2 沒讀，pos 仍是 0）
```

### System-wide open-file table

跨整個 OS：任何 process 開啟的檔案，在這裡都有一個 entry。兩邊的 entry 是對在一起的：P1、P2 表裡的 a.txt，都指到 system-wide 表裡**同一個** a.txt。

它存 **process independent（跟 process 無關）** 的資訊，不管誰開，看到的都一樣：

- **disk location**：寫一個 byte 時要知道寫到 disk 哪裡；檔案只有一份，內容的位置也只有一個。
- **access date、file size**：很多 process 同時開 a.txt，看到的都相同。

```
P1 table: a.txt ──┐
                  ├──▶ system-wide table: a.txt | disk location | access date | size
P2 table: a.txt ──┘
```

### 為什麼要切兩張表：data consistency

問：為什麼不乾脆把 size、location 也在每個 process 的表裡各存一份？

答：把同一份資料 **duplicate** 好幾份來維護，在系統設計上很危險。

> **例題** 假設 P1、P2 的表裡都存了 size = 100。
> 1. P1 寫入資料，檔案變長，P1 那份 size 改成 120。
> 2. P2 那份還是 100。
> 3. 兩份對不上：這就是 **data consistency（資料一致性）** 問題，多個副本要保持一致通常非常麻煩。

> **重點** 大家都該看到一樣的資料，只存一份在 system-wide table；會因 process 而不同的（position、access right），才各自存在 per-process open-file table。檔案開啟後，attribute 就依「跟 process 有沒有關」分到這兩張表。

## File type：副檔名只是 hint

File type 就是副檔名，例如 `report.docx` 的 `docx`。要有正確觀念：**副檔名對 OS 沒有實質意義，只是一個 hint（提示）**。

你點兩下一個檔案，OS 怎麼知道要用哪個程式開？它看副檔名，先猜、先試用對應的程式（`.docx` 就用 Word），就只是這樣。所以在 Linux，很多檔案根本沒有副檔名，也完全沒問題；副檔名主要方便人分辨，也讓系統有個猜測依據。

> **陷阱** 副檔名不決定檔案內容的格式，OS 只把它當 hint 來選開啟的程式。

## Access methods：sequential、direct、index

存取檔案大致分三大類：**sequential、direct、index**，其他多半是它們的變化版。

### Sequential access（循序存取）

最主要的一種。檔案就是一個 **array of bytes**，讀寫必須連續，所以這種 API **只需要一個 current position**：

- 呼叫 read／write **不用給位置，只給長度**，例如 `read(fp, 4)`。
- 讀完 4 個 bytes，position 自動往後移 4。這是 **implicit（隱含）** 的：程式裡沒寫，是 file system／library 幫你移。
- 要跳到別的地方，要 **reset／rewind**：把 position 移回 0，或移到指定位置。

```
檔案：[0][1][2][3][4][5][6][7][8][9]
       ▲ pos = 0
read(fp, 4)  → 讀出 0～3
[0][1][2][3][4][5][6][7][8][9]
             ▲ pos = 4（自動前進）
rewind       → pos 回到 0
```

C library 的 `fopen`、`fread`、`fwrite` 都是 sequential access。

為什麼檔案系統偏好 sequential？檔案多存在硬碟上，**硬碟循序讀寫遠快於 random**，讀寫頭不用一直跳；這也最符合「從頭讀到尾」的使用情境。

### Direct access（直接存取，也就是 random access）

跳著讀：直接告訴檔案系統要讀檔案的哪個位置，例如 `read(fp, 7, 1)`（位置 7、長度 1），就直接跳到第 7 格。所以這種 API 的 read／write **一定要多一個 position 參數**，不然 library 不知道要讀哪，因為位置可以是任意的。

```
[0][1][2][3][4][5][6][7][8][9]
                      ▲ read(fp, 7, 1)：直接跳到第 7 格讀 1 byte
```

看起來比較 powerful：一個 API 就能讀任何位置。那為什麼還要 sequential 的 API？因為兩者各有好處：

- 本來就要從頭掃到尾：用 sequential 很簡單，reset 之後 read、read、read 就讀完了。
- 用 direct 也做得到，但每次讀之前都要自己把 position 加上去（increase position），讀寫位置變成使用者要管，不直覺也不方便。

所以依使用行為選 API；而檔案系統實際看到的，大部分都是 sequential access。

### Index access（索引存取）

是 random／direct access 的變形，懂概念即可，最像 **database**。

在 database 找資料，你只會說「我要 John 的資料」：拿一個名字當 identifier，卻不知道它存在哪。這時不會想從頭 sequential 找（太慢），而是希望 random access 直接把那一筆拉出來。

一般檔案沒有 structure，就是從頭讀到尾，所以多半 sequential；但當內容裡有一筆一筆的 **record**，它還是檔案，讀法就不一樣了。這時在 random access 上再建一張 **index table**，把 key 對到 position：

```
index table             檔案（record 0, 1, 2, ...）
| John  | 6 |  ──────▶  直接 random access 到第 6 筆
| Smith | 2 |（示意）
| Adams | 9 |（示意）
```

查 John → 表上寫 6 → 直接去第 6 筆。

### 再看一組例子：從 API 參數分辨三種存取

- **Sequential**：C 的 `fread`、`fwrite`，一筆接一筆往後讀。
- **Index**：database，用一個 key 去查。
- **Direct**：比較像高階語言提供的功能。例如 MATLAB load 一個檔案，每一行當 row，逗號隔開的當 column，變成一張表；然後要 `A(3,3)`，也就是第 3 列第 3 行的資料。不用 index、不用名字，直接給座標，這就是 direct access。

> **重點** 看 API 的參數就分得出來：
> - 沒給 position → 一定是 **sequential**
> - 給的是位置（像 `A(3,3)`、`read(fp, 7, 1)`）→ **direct**
> - 給的是名字（像 John 這種自己取的 key）→ **index**

哪一種比較好，要看 application 的行為需求。實作上（database、file system 或語言多加的一層）都要處理 mapping，而且 access pattern 對到實體裝置上的方式不同：循序的就盡量把資料連著放；會跳著讀、有 index 的，就要建內部 data structure 來追蹤、快速搜尋位置，減少多餘的 I/O。

## Access pattern 要配合儲存裝置

檔案系統大多是 sequential；database 其實也是一種檔案資料，但設計很不同。

Disk 不喜歡 random access，因為讀寫頭要一直移動。所以上層要 support random access，**通常一定要有 memory cache**：先把資料放在 memory，用 memory 的 random access 速度撐住。Database 就是這樣，盡量把資料 keep 在 memory。

> **重點** 依應用情境選適合的 access method：
> - 對上（使用者）：選對了可以減少寫程式的 effort。
> - 對下（儲存裝置）：要讓這種 access pattern 在 physical device 上跑得有效率；pattern 跟裝置特性不合時（例如在 disk 上做 random），靠中間那層管理軟體想辦法。

同樣是 file system，實作方式也不同：有的適合 sequential，有的適合 random，有的適合 truncate 或 concatenate。

## Partition 與 volume

檔案一多就要用 directory（資料夾）管理。講 directory 前，先分清兩個詞：

- **Partition（分割區）**：把一顆硬碟（或儲存裝置）切割，切出來的一塊，例如切成 P1、P2。
- **Volume**：像電腦裡的 C 槽、D 槽，是 partition **format 之後、有了 file system** 的樣子。

買一顆新硬碟，流程是：

1. **Partition**：決定要切多少空間出來當一個儲存區。
2. **Formatting（格式化）**：在這塊 partition 上**建立一個檔案系統**。
3. 有了檔案系統，就能用檔案的方式存資料，它就從 partition 變成 **volume**（例如 C:）。

現在軟體很有彈性，partition 不一定對到一顆硬碟：

- 可以是好幾顆 disk 組成（group of multiple disks）。例如每顆只有 2T，五顆串起來：2T × 5 = 10T 的 partition，甚至可以透過網路串，變成分散式的概念。
- 也可以只切一顆硬碟的一部分。
- 但受硬體限制：像 floppy、CD-ROM 就是一整個，沒辦法再切。

> **陷阱** Volume 不等於 partition：partition 是 raw（原始、沒格式化）的，format 之後才是 volume，差別就在**有沒有 file system**。

### Raw partition：database 與 swap space

Database 的角色跟檔案系統很像，也要把資料放在儲存裝置上，只是它要 support random access、要建 index，管理方式不同。所以很多 database **根本不 format**，直接拿一塊 raw partition 來用，它不想用檔案的形式：傳統 database 用 table 存，每個 row 多大都知道，何必再透過 file？直接切來用就好。

之前講的 **swap space** 也一樣，給它一塊 raw partition 就好。沒人規定一定要經過 file system。

### Directory、partition 和 disk 的關係

Directory 把檔案切割分類，讓你比較容易找到要的檔案。注意這裡的「位置」只是 **logical** 的，也就是 path，例如 `/home/john/a.txt`；下面的 disk 1、disk 2 才是實體的儲存裝置。

```
volume:   [   A   ][   B   ][        C         ]
disk:     [      disk 1      ][      disk 2     ]
          A、B 在同一顆 disk 上；C 跨兩顆 disk
```

Volume 可以在同一顆 disk 上，也可以跨 disk，沒有一定。Format 之後最大的差別：**檔案系統會記錄 directory 和 file 的 data structure**。找檔案時，先從 directory 找到它，再看它的內容存在哪裡。

## Directory 的本意：檔名對到 ID

現在 directory 是一棵 tree，但它是一步步演進來的。早期使用者少、檔案也少，最早可以說沒有資料夾。

每個名字對到一個檔案，而檔案真正的身分是機器用的 **unique ID**（例如 `test → #5021`，示意），人根本記不住。所以 **directory 一開始的目的很單純：把人看得懂、有意義、可以改的檔名，對到那個唯一的 ID**。

這個 mapping 有個跟之前（memory 等）都不同的地方：**file 必須是 persistent 的**，斷電也不能丟。所以不只檔案內容，**directory 的資訊也一定要寫到硬碟上**；可以在 memory 當 cache，但最後要寫回去。運作時才 load 到 memory，放進前面那兩張表（system-wide table、open-file table），給 process 用。

### Directory operations 與 list 的瓶頸

Directory 的 operation 更少：

- **create file**：也算，因為要把它加進 directory 的結構，系統才知道它存在。
- **delete、rename**。
- **list directory**：像 `ls`，把資料夾內容列出來。

> **觀念** 在現代檔案系統裡，**list 常常是最大的 bottleneck**，是最耗時間的操作。一個 folder 有一萬個 file，要吃多少 memory、花多少時間才能全部從 disk 撈出來？再加上 tree 很深、使用者很多，大型系統隨便一個 `ls` 都可能卡很久，這是設計時的一大考量。

另一個設計問題是 **search（怎麼找）**：給一個 path，例如 home 底下 john 的 homework1 裡的 a.txt，要怎麼很快 traverse 到它？Directory 甚至不一定用 tree 存，也可能用 **hash**。

## Directory 結構的演進

### Single-level directory

結構就是一個 root，底下全部是檔名，沒有 folder（但它仍是一個 directory）。

```
root
├── test
├── a.out
├── data
└── mail     （檔名示意）
```

問題：

1. **檔名一定要 unique**，不然沒辦法 mapping。很多使用者共用一個目錄時，大家編譯完都產生 `a.out`：不是把別人的檔案 override 掉，就是系統說「已經存在」，根本建不了。
2. **list 效率很差**：沒有分類，只能 scan through 一大堆不是你的檔案。

早期規模小、只為了解決 mapping，沒問題；使用者和檔案一多就撐不住。

### Two-level directory

一層不夠就多層，多層指的就是 folder。最上層是 **MFD（master file directory）**，底下每個 user 有自己的資料夾：

```
MFD
├── user1
│   ├── a
│   └── b
└── user2
    ├── a
    └── c       （檔名示意）
```

好處：

1. list 只會列出你自己的檔案。
2. 可以一層層往下 traverse，**path** 的概念就出來了，例如 `/user1/a`。

不過最終要做的，還是把檔名對到 ID，這才是 directory 的本意。

### Tree-structured directory

既然能兩層，何必固定兩層？乾脆變成 tree，幾層都可以，每個使用者都能自己建資料夾，這就是現在檔案系統的樣子。

- **Absolute path（絕對路徑）**：從 root 一路寫下來，例如 `/spell/mail/exp`。
- **Relative path（相對路徑）**：相對於目前所在的位置。人在 `/spell/mail` 底下，寫 `exp` 就好。

Relative path 是為了方便；系統處理時，多半還是先把它換成 absolute path，再做後面的動作。

### Acyclic-graph directory 與 link

Tree 的限制是**每個 node 只能有一個 parent**，像 count 只屬於 dict。可是實際上常希望不同的人 **share 同一個檔案**。所以放鬆限制：`/dict/count` 和 `/spell/count` 兩個名字，對到同一份內容，多了一條 edge。

```
        root
       /    \
    dict    spell
       \    /
       count        （/dict/count 與 /spell/count 是同一份檔案；簡化示意）
```

可以加 edge，但有一條規矩：**不能形成 cycle**，不能繞一圈回到自己。這樣同一個檔案就有 **multiple absolute path**，很多軟體因設計需求會這樣用。

Linux 用 `ln` 建 link：

```
ln     原檔 新名字      # hard link
ln -s  原檔 新名字      # symbolic link（soft link）
```

| | soft link（symbolic link） | hard link |
|---|---|---|
| 本質 | 只記原檔的路徑 | 同一個檔案的另一個名字 |
| 刪掉原檔名之後 | 內容消失，soft link 指向不存在的路徑 | 內容還在；要所有名字都刪掉，內容才消失 |

問：為什麼不直接 copy 一份？

1. copy 真的浪費空間。
2. 又是 duplication：資料本來該只有一份，複製了就要煩惱一致性。用 link，檔案出現在兩個資料夾，卻是同一份，有人改了，另一邊馬上看到。

> **陷阱** Acyclic graph 允許共享（一個 node 可以有多個 parent），但**不允許 cycle**。

### Dangling pointer 與 reference count

資料一份、名字兩個，就像寫程式的 pointer。從一邊把檔案真的砍掉，另一邊的名字還在，卻指向不存在的東西，這就是 **dangling pointer（懸空指標）**。這時去 access 就會出錯，而且不只是「找不到」：名字存在，內容卻 lost 了，是一種 fail 的狀況。

為什麼先只談 acyclic graph？因為**沒有 cycle，這問題比較好解**：用 **reference count（counter）**。

```
建立 /dict/count             counter = 1
ln 建 /spell/count            counter = 2
刪 /dict/count               counter = 1  → 還有人指著，保留內容
刪 /spell/count              counter = 0  → 真的從 storage 移除
```

每多一個名字 +1，刪一個名字 −1，**減到 0 才真的從 storage 移除**；不是 0 就代表還有人指著它，要 keep 住。

### General-graph directory 與 garbage collection

整理一下：single-level → two-level → tree → acyclic graph，最一般化的是 **general graph**：任何位置、任何方向都能加 edge（例如 bin 連到 g2 的 link）。跟 acyclic 最大的差別：**cycle 會跑出來**，例如 g2 和 t1 互相指著繞成一圈。有了 cycle，dangling pointer 就更難處理，跟寫程式處理 pointer 一樣頭痛。

> **例題** 把 bin 到 g2 這個 link 刪掉，會怎樣？

```
刪除前                         刪除後
root                          root
 └── bin ──▶ g2               └── bin        g2
             ▲ │                             ▲ │
             │ ▼                             │ ▼
             t1                              t1
（g2、t1 互相 reference，結構簡化示意）
```

1. 刪掉之後，g2 和 t1 從 root 已經走不到了，理應刪掉。
2. 但只看 counter 刪不掉：它們互相 reference，count 還是 1，永遠不會變 0。

解法：

- **Cycle detection**：檢查有沒有 cycle、有沒有連線。
- **Garbage collection（垃圾回收）**，最常見：週期性（periodically）從 root 往下 **label（標記）**，看哪些是 **reachable**；標記完，沒被 label 到的就是 **unreachable**，刪掉。這是「兩個 pass」的做法（先標記、再刪除），不用管有沒有 cycle，走不到的就是要刪的。

但檔案系統的使用者和檔案數量都很驚人，週期性這樣掃，**overhead 太大**。所以**很多檔案系統乾脆不支援 general graph**：加的 link 會造成 cycle 時，直接當 invalid 擋掉，避免後面的維護問題（這種需求本來也很少見）。

> **陷阱** Reference count 只能處理 acyclic graph；有 cycle 時要靠 garbage collection（或乾脆禁止會造成 cycle 的 link）。

說到底，directory 就是在做 mapping，幫你找到檔案真正的 ID。

## Mounting

要用一個儲存裝置，第一件事就是把它 **mount（掛載）** 進系統，系統才 access 得到上面的資料。這裡說的是 file system 的 mounting：存取檔案都要透過 directory structure 去找，所以 mount 第一件事是決定 **mount point（掛載點）**：要掛在 tree 的哪個節點？目錄一定有一個 root，掛上去的那個節點（例如 `usr`）就是 mount point。

### Mount 的三種時機

1. **Boot time**：一開機就 mount 好，最好的例子是系統槽。OS 本身也存在檔案系統裡，那個 volume 不先 mount，OS 的資料根本 load 不進 memory 開始執行。
2. **Run time 自動 mount**：一插上去就自動偵測，甚至沒有 driver 也幫你下載，使用者什麼都不用做。
3. **手動 mount（manually）**：比較早期、比較特殊的裝置，或找不到 driver、無法自動化時，自己下指令掛。

### 例子：把 volume 掛進 tree

```
mount 前                        mount 後
/                               /
├── local ── (一些檔案)          ├── local ── (一些檔案)
├── usr   （空）                 ├── usr  ◀── mount point：第二個 volume 的內容
└── home  （空）                 │    └── (另一個 file system 的檔案)
                                └── home
```

- 把第二個 volume 掛在 `usr` 下面，`usr` 就是 mount point，底下換成另一個 file system。
- 可以 **recursive**：在掛進來的 volume 底下，再掛別的，一直下去。
- **Windows** 為了減少使用者麻煩、限制較多，一掛就是 C 槽、D 槽、E 槽，只能掛在 root 下，比較感覺不到 mount point。
- **Linux／Mac** 可以自己選，只要資料夾存在就行，例如把 `games` 掛在 `john` 底下；甚至再切第四個 partition 掛上去也行，tree 可以任意延展。

### Mount table：跨 partition 找檔案

Mount 一個 partition／volume 時，OS 會維護一張 **mount table**，系統才知道有這個 partition 存在。

> **例題** 系統槽 P1 的 root 下有三個 folder，其中 `usr`、`mnt` 是掛進來的，分別來自 partition P2、P3。要找 `/usr/hw.c`。

```
P1（系統槽）                        mount table（欄位內容示意）
/                                  | mount point | partition | port   | protocol |
├── (第三個資料夾)                  | /usr        | P2        | port 1 | SATA     |
├── usr  [m]                       | /mnt        | P3        | port 2 | USB      |
└── mnt  [m]

P2
/ （= /usr）
└── hw.c
```

1. Directory 裡只要在 `usr`、`mnt` 上標一個 **m**（mark 起來），就能把它們放在同一個檔案系統下操作。
2. 從 root 開始找，也就是 system drive（系統槽 P1）。
3. 走到 `usr`，發現有 m，代表是 mount 進來的，就去查 mount table：這個 drive 接在哪個 port、用什麼 protocol，對到哪個 physical device。
4. 靠這些資訊切到 P2；**P2 的 root 就相當於 `usr`**。
5. 在 P2 裡繼續往下 traverse，找到 `hw.c` 的資訊，再把內容讀出來。

> **重點** Mount 會發生的事：directory structure 上把 mount point 做標記 + OS 維護 mount table + partition table 存著 access 那個 partition 需要的資訊，就能跨 partition 找檔案。

## Sharing：owner、group、others

檔案系統存在的理由之一，就是讓多個使用者透過檔案分享資料，所以 **permission（權限）** 非常重要：作業放在工作站上，誰都能看、還可能被別人 override，那就慘了。

1. 要能 **identify 使用者**：每個使用者有一個 unique 的 **user ID**。
2. 還有 **group ID**：一群人需求相同、share 相同的檔案，就放在同一個 group。預設（by default）你的 group 就是你自己，系統建使用者時會幫他建一個只有他自己的 group，所以平常沒感覺，但它存在。管理者可以建一個 `students` group，把學生（例如 bob、carol）都放進去，students 只能 access 某些檔案，很好管。

檔案這邊分**三個 level（class）**。例如 `hw.c` 的 owner 是 alice，group 是 students：

| level | 誰 |
|---|---|
| **owner** | 檔案的擁有者，一個檔案只有一個 owner（這裡是 alice） |
| **group** | 不是 owner，但屬於檔案的 group（這裡是 students，如 bob、carol） |
| **others** | 其他人全部丟這裡 |

例如 owner 能讀寫甚至執行，group 只能讀。任何使用者一定落在其中一個 level，照那個 level 的權限統一管理。

> **陷阱** 同一個 group 的人權限全部相同，沒辦法再細分。

## Access control：從 ACL 簡化成 rwx

權限本身只有三種：**read、write、execute**。只有檔案的 **owner 或 root**（系統管理者）可以修改檔案的權限、group、owner，其他人只能照它規定的 policy 走。

權限要怎麼描述？這叫 **access control（存取控制）問題**，從早期設計 OS、檔案系統時就在想。最直覺的是每個檔案一張 list，列出每個使用者有什麼權限，這就是 **ACL（access-control list）**。但使用者一直增加，list 要一直改、又很長，光存就耗空間，還要 load 進 memory 才能判斷，不可行。

所以現在：**三個 class（owner、group、others）× 三種權限（r、w、x）**，每個 class 3 個 bit，總共才 **9 個 bit**。

> **例題** owner `111`、group `110`、others `100` 代表什麼？
> - owner `111`：r、w、x 三個權利都有。
> - group `110`：能讀、寫，不能執行。
> - others `100`：只能讀。
> 某個 bit 是 0，就代表沒有那個權利。Owner 或 root 就透過修改這幾個 bit 控制存取。

### ls -l 的那串符號

在 Linux 打 `ls -l`，前面那串符號就是 access control list：

```
-rw-rw-r--   ... staff ... 檔名
│└┬┘└┬┘└┬┘
│ │  │  └── others：r--  只能讀
│ │  └───── group (staff)：rw-  能讀寫、不能執行
│ └──────── owner：rw-  能讀寫、不能執行
└────────── 第一個字元：- 是 file，d 是 directory（不屬於權限）
```

後面 9 個符號分三組，字母代表有（enable），dash（`-`）代表沒有（disable）。

**對 folder 來說，x 的意思是能不能 traverse 進去**，看到裡面的內容。

> **陷阱** 遇到 permission denied 時，要檢查路徑上**每一層 parent folder**，你這個使用者有沒有 x；有 x 才能進去那個 folder。另外，目錄的 r 是列出內容，x 是進入／穿過。

Windows 也有一樣的機制，只是用圖形介面設定。

### chmod

改權限的指令是 `chmod`，每個數字對應一個 class，口訣 **r = 4、w = 2、x = 1**，加起來就是那個數字。

> **例題** `chmod 644` 設成什麼？
> - owner：6 = 4 + 2 = `110` → `rw-`
> - group：4 = `100` → `r--`
> - others：4 = `100` → `r--`
> 結果是 `rw-r--r--`。

## Protection：damage 與 security

Protection 分兩個層面（前面的 ACL 也是 protection 的一部分：同一個系統裡，你不能隨便看別人的檔案）：

1. **Damage（損壞）**：檔案絕對不能遺失。方法是之後儲存系統會講的 **RAID**：資料 copy 在多顆硬碟上，壞一顆還能從另一顆讀，用多顆硬碟提高 reliability。
2. **Privacy、security**：怎麼不讓資料被偷走，這是很大的獨立領域。
   - 單一系統最基本的是 **password**：登入了，就是合法使用者；系統知道你的 ID 之後，再用 ACL 判斷你能做什麼。這是假設使用者要 login 才能 access file 時最基本的 protection。
   - 但現在很容易被突破：根本不用 login，透過程式、web 服務就能侵入。
   - 有了網路，你的 password 傳到遠端的路上，封包可能被監聽、截走，所以還要**加密**等機制。

## File system 的內部：disk allocation 是核心
前面都是使用者看到的 file system（檔案、目錄、mount、保護）。接下來進到 file system 內部，看它的 structure 和管理檔案的方式。其中最重要、一定要會的是 **disk allocation method（磁碟配置方法）**。

作業系統的工作就是管理資源，file system 管的是儲存資源，也就是 disk 的空間。問題很具體：

- 一個 1 GB 的檔案，要擺到硬碟的哪些位置？
- 要一次整個連續放好嗎？
- 如果切成好幾塊分開放，又怎麼記得每一塊放到哪裡？

決定「一個檔案怎麼 map 到 physical device 上的位置」，就是 disk allocation，它是 file system 最主要的管理機制；自己實作一個 file system 時，最主要要寫的也是這一塊。

## Block 與 sector
File system 最主要的工作是 **mapping**：把資料放到 physical storage device 上。這裡以目前主流的 hard drive 為例，其他裝置類似但情況不完全一樣。

- **Block（data block，資料區塊）**：file system 對下層讀寫的最小單位。不管軟體怎麼管理，對裝置都是以 block 為單位操作。
- **Sector（磁區）**：hard drive 在實體上的最小單位。

兩者不一定一樣大：可能剛好相同，但通常 block 是 sector 的倍數，一個 block 由好幾個 sector 組成。

```
sector：通常 512 bytes
block ：1 KB、甚至 4 KB

4 KB block = 4096 / 512 = 8 個 sector

block 0      block 1      ...
[s0 s1 s2 s3][s4 s5 s6 s7] ...   ← 這張圖的 block 0 對到 4 個 sector
```

Block 不可能比 sector 小：sector 已經是實體上最小的單位，logical 的單位只能建在它上面。block 和 sector 之間還有一層轉換，mapping 不一定一對一；但 file system 管到最後，碰得到的只有以 block 為單位的東西，所以這章講的都是 block。

> **陷阱** Block 是 logical（file system）的單位，sector 是 physical 的單位；block ≥ sector，通常是倍數。

## 一個 OS 可以有多種 file system
一個作業系統不一定只有一個 file system。整個 directory 常常橫跨好幾個 file system：不同 volume（C 槽、D 槽）可以 format 成不同的檔案系統，只要 OS 支援就行。例如傳統的 FAT32、NTFS，Mac 也有自己的 file system。

- **差別在對下**：不同 file system 最大的差別在 disk allocation 的方式，以及 search file structure 的實作，也就是管理 disk 資源的方式不同。
- **對上都一樣**：都是 file、都支援 sequential 讀寫、都有 directory 的概念，API 和 operation 都相同。

> **觀念** 問：為什麼換一種 file system，format 時資料要全部清掉？
> 答：兩種 file system 管理 disk 的方式完全不同，互相讀不懂，不可能沿用，只能整個重新格式化。

## File system 就是在做 mapping
File system 給的 API 通常是 sequential access：一個 file handle（檔案代號）、一個在 memory 裡的 buffer（緩衝區）、一個 size，就這樣讀寫。最後的目的，是把這些資訊對到 physical storage device 上的一塊空間。

看起來很單純：把 memory 的一個位置，對到 disk 上的一個位置，讓資料寫到正確的地方。實際寫入還要靠 **driver（驅動程式）** 下指令操作 storage device 的 **I/O controller**，透過 controller 上的 **register（暫存器）** 一個一個 byte 寫進裝置（細節在 I/O system 那章）。

## Layered file system
這個 mapping 中間會經過好幾層 layer。切成很多層，每一層比較 modular（模組化），也比較清楚自己該做什麼。現在一般的 file system 都這樣設計：

```
應用程式（fopen / read / write）
        │
┌───────▼──────────────────────────┐
│ logical file system               │  定義 API、檔案的 logical 長相、
│                                   │  resolve permission（ACL）、open 檔案
├───────────────────────────────────┤
│ file-organization module          │  logical 的 file position → 第幾個 block
├───────────────────────────────────┤
│ basic file system                 │  block → 哪顆 disk、partition、
│                                   │  cylinder、track、sector
└───────┬───────────────────────────┘   ↑ 俗稱的 file system 就是這三層
        ▼
   device driver（在 file system 外面，真正做 I/O）
        ▼
   I/O controller → disk
```

### Logical file system
最接近使用者，負責把檔案呈現給使用者，決定檔案 logical 的長相（view）。例如 sequential access 的那些 API 就是它定義的。它也負責 **resolve permission**：ACL（access control list，存取控制清單）的檢查就是這層的事。它的工作是找到 file、把它 open 出來、用 API 提供出去，並在 access 時判斷這次存取有效還是無效。

所以要改 ACL 的控制機制、改 API、或加新的 method，只要改 logical file system 就好。

### File-organization module
從這層開始做 mapping：把 logical 的位置（file access position）轉成「第幾個 block」。logical 的資訊是：有 file handle，知道是 `a.txt`、目前 position 在哪、要讀寫多少 size；要回答的是：這段資料存在哪一個 data block？例如「這個檔案的第 3 個、第 100 個 byte 在第幾個 block 裡」，就是這層在算。

> **例題** （示意）block 大小 4 KB = 4096 bytes，要讀 `a.txt` 從 offset 10000 開始的資料。
> 10000 ÷ 4096 = 2 餘 1808，所以落在檔案的第 2 個 block（從 0 開始數），block 內的 offset 是 1808。
> 「檔案的第 2 個 block」實際是 disk 上哪個 block，要看 FCB 記錄的位置，也就是 allocation method 決定的。

檔案要切成幾個 block、這些 block 放在 disk 的什麼位置，都在這層決定。各家 file system 最大的差異就在這層：怎麼分配 disk 的空間。實作 file system 時，主要寫的也是這一層的機制。

### Basic file system
知道是哪個 block 之後，還要對到 disk 上的實際位置：哪顆 disk、哪個 partition（甚至可能跨兩顆 disk）、哪個 cylinder（磁柱）、哪片盤的哪個 track、從哪個 sector number 開始。這層一般很少改：只要是 hard drive 就是這樣，除非出現新的 storage device，才需要重寫這裡的 mapping。

### Driver 在 file system 外面
有了位置，要真的做 I/O（read、write）的是 driver，它在 file system 外面：只要裝好這個 device 的 driver，file system 就能下指令寫到要的位置。

> **重點** 各層的名字不必硬背，但要知道分成三層、目的完全不同；要改什麼（permission、allocation、新的儲存裝置），就知道去哪一層改。

## On-disk structures
實作 mapping 需要一些 data structure，分成兩類。第一類是 **on-disk structure**：檔案和其他資料不同，它是 persistent（永久存在）的、不能遺失，所以這些 structure 一定要存在 disk 上，不能只放在 memory。

一個 partition 在 disk 上的 layout：

```
┌──────────────┬──────────────────┬───────────┬──────┬────────────────────────┐
│ boot control │ partition control│ directory │ FCBs │ data blocks            │
│ block        │ block            │ structure │      │（真正放檔案內容的地方）│
│ (optional)   │                  │           │      │                        │
└──────────────┴──────────────────┴───────────┴──────┴────────────────────────┘
  ← 前面是控制資訊 ────────────────────────────────→  ← 剩下的空間全部是 data
```

### Boot control block（開機控制區塊）
顧名思義是開機用的。如果要用這個 partition 上的作業系統開機（系統槽），partition 最前面會先 reserve 一塊空間給它。裡面存 booting 需要的 code 和 data，例如要開機的 file system 在哪；甚至存最基本的 instruction，不經過 file system，像 hard code 一樣直接 load 進 memory 讓 CPU 開始跑，再慢慢把整個系統 boot 起來（因為 load 整個 file system 很費工）。

它是 **optional** 的：不是每個 partition 都拿來開機。開機時系統會去找它，不能開機的 partition 就忽略。

### Partition control block（分割區控制區塊）
一顆 hard drive 可以切成好幾個 partition，每個 partition 都有一個 partition control block，記錄這個 partition 在硬碟上從哪到哪（range）、有多少 block、還有多少空間。做磁區分割時，切好位置後第一件事就是建立它，OS boot 起來後才能透過它知道硬碟有幾個 partition、每個的範圍、怎麼 access 裡面的內容。

### File control block（FCB，檔案控制區塊）
有了 partition 的資訊，接著要知道裡面有哪些 file，靠的是 FCB。

- FCB **不是檔案內容**，只是 **metadata（描述資料）**：檔案內容實際所在的 location、size、permission 等 attribute。
- 每個 file 一個 FCB，概念就跟每個 process 一個 PCB（process control block）一樣。
- 開檔時，把 FCB load 到 open-file table，就能開始 access 這個檔案。

> **觀念** UNIX 的 inode（就是 FCB）其實不存檔名，檔名記在 directory 的 entry 裡。

### Directory structure
為了管理這些 file，還要存 directory structure，描述那棵 tree 或 acyclic graph。

### 建立的順序：partition → format
1. **切 partition**：建立 partition control block。
2. 如果不 format，就沒有 FCB 和 directory，這叫 **raw partition（原始分割區）**。
3. **Format**：選一種 file system，建立 FCB、directory structure 這些基本資訊；通常先存 directory structure，存完之後剩下的空間全部拿來放檔案的 data blocks（怎麼放看配置方式）。
4. 之後 create file，就是修改或新增這些結構的內容，再開始 access。

在 memory 做的任何修改，最後（eventually）一定要寫回 on-disk structure，才不會遺失。

### FCB 最重要的是 data blocks 的 location
Data blocks 是可用的空間，檔案內容可以任意擺，但擺在哪一定要記在 FCB 裡，不然找不到。所以 FCB 的 metadata 中最重要的就是 **file data blocks 的 location**。到底怎麼擺、要記哪些資訊、用什麼方式記，就是後面的 allocation method。

## In-memory structures
當 file system 被 load 起來，或開始 access 某個 directory、volume、file 時，要把資訊搬進 memory，OS 才能處理。memory 裡的結構基本上和 disk 上的一一對應，只有 boot control block 不用 load，它只是開機用。

| In-memory structure | 存什麼 | 何時 load |
|---|---|---|
| Mount table（partition table） | 已 mount 的 partition 資訊 | mount 時 |
| Directory structure（部分） | 最近存取的 directory entry | traverse 時 |
| System-wide open-file table | 被開啟檔案的 FCB | open 時 |
| Per-process open-file table | handle、position、permission（以 read 還是 write 開） | open 時產生；只在 memory |

- **Mount table**：系統要知道哪些 partition 已經 mount。mount 一個 partition 或 volume 最主要做的事，就是把它的 partition table load 到 memory，OS 才知道這個 partition 長什麼樣、能直接操作它。
- **Directory structure**：mount 之後要使用，就要 traverse，所以要 load directory。但**只 load 一部分**（recently accessed）：file system 很大、memory 有限，而且大部分時間只會用到某些資料夾和檔案，全部 load 很浪費。比較合理的是 load 最近最常用的部分，或以 tree 來說先 preload 下一個 level；讀的時候一次 sequentially 多 load 一點，也比一次一次分批讀有效率。
- **System-wide open-file table**：真正開檔操作時 load 的表，裡面其實就是 FCB。FCB 只跟 file 有關、跟使用者無關，所以整個 FCB load 進來，全系統共用。
- **Per-process open-file table**：開檔後只跟這個 process 有關的 state：handle 是什麼、目前 position、permission（用 read 還是 write 開）。這張表**不存在 disk 上**，它跟 file 本身沒有直接關聯，是操作過程中才產生的資訊。

> **重點** 四個主要的 in-memory structure：mount table、部分 directory、system-wide open-file table、per-process open-file table。要分清楚哪些在 disk、哪些在 memory。

## open()、read()/write()、create() 的流程
有了 disk 上和 memory 裡的結構，用 open、read/write、create 三個操作看它們合作的順序。懂每個結構的目的，順序都推得出來。

### open()
1. 要 open 的位置已經 mount 好，所以從 root directory 開始，照 file path 一路 traverse，找檔案存不存在。
2. Directory 不會全在 memory：走到需要的部分不在 memory 時，就看它屬於哪個 file system、在哪個 partition，從那裡把 directory structure load 進來，繼續 traverse。也就是先看 memory，找不到才去 secondary storage（on-disk structure）拿。
3. 找到後，directory 最後指到的是 **FCB**。directory 不認識「檔案」，它知道的是 FCB；有了 FCB 就知道檔案的資訊和位置。
4. 把 on-disk 的 FCB load 到 memory 的 **system-wide open-file table**。
5. 再依這個 process 的 permission 等，填好 **per-process open-file table** 的 entry。

```
disk                               memory
directory ──(load 缺的部分)──────→ directory（部分）
                                      │ traverse path，最後指到 FCB
FCB ─────────────(load)──────────→ system-wide open-file table [FCB]
                                      ▲
                                   per-process open-file table
                                   [handle, position, permission]
```

> **重點** 一句話：open 就是找到 FCB，把它從 disk 搬進 memory。

### read() / write()
假設檔案已經 open。memory 裡有兩層 open-file table：system-wide（FCB）和 per-process（這個 process 的資訊）。

1. 呼叫 API 一定要給 **file handle**，因為它就是 per-process open-file table 裡那個 entry 的 pointer。透過它知道：檔案有沒有開、開啟時拿到什麼 permission、目前 position 在哪。permission denied 這類問題在這一層就被擋回（reject）。
2. 確定檔案已開、知道從哪個位置開始讀之後，要找真正的位置。真正的位置存在 FCB 裡，所以 per-process entry 要知道 system-wide 那張表的 entry 在哪，順著去問：內容到底存在哪？
3. 用 FCB 裡的 location 資訊找到 disk 上的位置，讀出來或寫進去。

補充：FCB 很大時不一定全部 load。檔案很大時，location 本身也可能用 linked list 等 data structure 串起來，pointer 散在好幾個 data block 上，要分批 load。

```
file handle → per-process entry（檢查 permission、拿 position）
            → system-wide entry（FCB）
            → FCB 的 location → disk 上的 block → 讀／寫
```

### create()
1. **先建立 FCB**。它最重要：一開始內容是空的，但有了 FCB，這個檔案才存在。
2. 要把它放到某個 path，所以 directory structure 要更新。create 可以寫任何 path，跟目前下指令的位置無關，所以要先確認 path 存在；這就是為什麼有時 create 會回「資料夾不存在，無法建立」。
3. 確認的過程跟 open 一樣：traverse directory，不在 memory 就從 disk load，直到確定那個 directory 存在。
4. 在那個 directory 底下加上檔名。檔名本身也是 directory 的一部分，就像 tree 的 leaf node，所以要更新 directory structure。
5. 把檔名指到它的 FCB。

之後再 write，只是加 data block，並更新 FCB 裡的 pointer。

## 寫回 disk：flush 與 logging
上面的改動，到這裡都**只在 memory 裡**（是 process 在操作）。要確保不遺失，就要寫回 disk：file system 會**週期性（periodically）flush** 回 disk，或關機時全部 flush。更新過的 directory 和 FCB 都要寫回 disk，下次開機才存在。寫回之後 `ls` 看得到，才代表真的建好了。

- **跳電會掉資料**：只寫到 in-memory structure，還來不及寫回 disk 就斷電了。不只 create，rename 等所有修改都是同一個道理：先寫在 memory，到一定時間才 flush。
- **不正常關機後要 scan disk**：系統常會先掃描 disk，看資訊有沒有對不上（不 match）。為什麼會對不上？一個操作可能改了很多地方，flush 時按順序寫，可能只寫一半就斷電：有些已寫回、有些還沒。這就像 transaction 沒做完：整個操作應該全部完成才算數。

```
create 一個檔案改到的地方：directory entry、FCB、…
flush 依序寫回： [directory 已寫回] [FCB 還沒寫回] ← 斷電
→ disk 上的 directory 和 FCB 對不上，資訊不一致
```

- **Logging**：很多 file system 可以開 logging，除了改 memory 裡的結構，也把這些動作寫成 log。log 保證真的寫到 disk 上；如果真的 crash，就拿 log 做 recovery。

> **重點** In-memory 的修改最後要寫到 on-disk 才算真的保留；只 flush 一半會不一致，所以要 scan disk 或用 log 做 recovery。

## Virtual file system（VFS）
拉高看整個 OS：它要同時支援 **multiple file system** 和 **multiple storage device**，一般系統很常見這種設定。下面可能同時有 UNIX file system 和 NTFS。但寫程式呼叫 library 的 `fopen` 時，假設的是只有一個 file system、一個 directory。事實上不同 partition 被 format 成不同 volume，可能用不同的 file system。使用者不需要看見這件事，所以中間需要一層 interface 做 **abstraction（抽象化）**，把差異藏起來。

另一種情況，同一個 file system 用到不同的 disk：只要靠 driver，不同 driver 讓同樣的 block I/O 讀寫到不同 device 上，file system 不用特別處理。

```
           使用者程式：fopen / read / write（同一套 API）
                         │
             ┌───────────▼───────────┐
             │ VFS（很薄的統一介面）  │  看檔案由哪個 FS 管，就轉給它
             └─────┬───────────┬─────┘
                   ▼           ▼
            UNIX file system   NTFS
                   │           │
               driver A     driver B
                   ▼           ▼
                 disk 1      disk 2
```

這層 **virtual file system（VFS，虛擬檔案系統）** 是很簡單、很薄的一層 unified（統一）file system interface：它看檔案是哪個 file system 管的，就把呼叫轉（dispatch）給那個 file system。

### VFS 把 mount 起來的樹接在一起
系統裡 mount 的每個 volume 都可以由不同的 file system 管。為什麼能全部接在一起？就是因為前面那層 unified interface。使用者不直接對各個 file system 的 API 操作，而是透過這個統一、不會變的介面。

- VFS **只是 interface**：每個要 mount 進來的 file system，都得把它 implement 出來，才能被操作。
- 最大的好處：使用者**永遠用同一套 API** 寫程式，不用管下面的實作。
- Traverse 時，整棵 tree 不屬於某一個 file system：因為 mount，它是接來接去的。跨到別的 file system 時，traverse directory 一樣透過 VFS 的 interface 去用另一個 file system 的資訊。

所以 VFS 這層是必要的，所有 file system 才能用相同的介面操作。

## Linux VFS 的四個 object
Linux 的 VFS 分成四個主要的 object（或說 class），對應前面講的 structure：

| Object | 代表什麼 | 對應前面的結構 |
|---|---|---|
| inode | 一個 individual file | on-disk 的 FCB |
| file object | 一個已 open 的檔案 | open 後 load 到 memory 使用的物件 |
| superblock object | 整個 file system | partition control block 裡的資料 |
| dentry object（directory entry） | directory | directory structure |

- **inode**：看 file system 的書或 code 一定會看到。inode 就是一個檔案的 FCB；它是 VFS 這層定義的統稱，各家 file system 去 implement 操作 inode 的 API 和裡面的細節。
- **file object**：跟 inode 都是「file」，差在 inode 是 on-disk 的那個 FCB，file object 是把檔案 open 之後、load 到 memory 使用的 object。
- 整理起來：volume（superblock）、directory（dentry）、file；file 又分成 on-disk 固定的 inode，和 active 起來開始操作的 file object。

每個 class 都定義了自己的 **method**，這就是 interface 的部分，各家 file system 要去 implement。例如 open 在 file object 裡；要 read 一個檔案，一定是從已經 open 的檔案讀，所以 read 也在 file object 底下。implement 好之後，上面的 system code 就照著 VFS 對 file system 下指令。

> **陷阱** inode 是 on-disk 的 FCB；file object 是 open 之後 in-memory 的 object，兩者不同。

## 實作的兩大重點
從實作的角度，這些結構裡最影響使用者感受到的效能的有兩件事：

1. **Directory 怎麼維護**：directory 很大，traverse 時給一個 file path，要能很快知道它存不存在。可以用 **linked list** 把整棵 tree 串起來，也可以用 **hash table（雜湊表）** 直接 lookup。不同的維護方式影響 **search time**，使用者感受到的效能差很多。
2. **Data block 怎麼擺**：讀寫是 random 還是 sequential 的存取，效能跟 data block 的擺法有絕對的關係。

第二件就是接下來的 allocation method。

## Allocation methods：檔案內容放在哪些 block

**Allocation method（配置方式）**回答的問題是：一個檔案的內容，要 map 到 disk 上哪些 data block？放法決定讀寫頭移動的路徑，也就決定效能。

三種基本做法：

1. **Contiguous（連續配置）**：連續擺放。
2. **Linked（鏈結配置）**：像 linked list 一樣，把 block 一塊一塊串起來。
3. **Indexed（索引配置）**：把每一塊的 pointer 收集起來，要找就查表。

設計時要考慮兩件事：

- **空間**：disk 空間有限，檔案大小又會改變，找不找得到一段夠長的連續空間就是問題。
- **存取方式**：**sequential access（循序存取）**和 **random access（隨機／直接存取）**在不同擺法下表現差很多，各有好壞。

實務上三種做法常常 **hybrid（混合）**，互相補對方的缺點，例如後面的 extent、FAT、linked index scheme、UNIX inode。

## Contiguous allocation

### 做法
檔案從哪一塊開始擺，後面就必須連續放。課本的圖：disk 有 0～31 號 block，五個檔案各佔一段連續的 block，directory 記錄每個檔案的起點與長度：

```
directory
file    start   length
count     0       2      → block 0, 1
tr       14       3      → block 14, 15, 16
mail     19       6      → block 19 ~ 24
list     28       4      → block 28 ~ 31
f         6       2      → block 6, 7
```

FCB（file control block）／directory entry 只需要存兩個值：**起點（start）**和**長度（length）**。

### 用算的找到位置
要讀檔案的第 x 個 byte：

1. `x ÷ block size` 取商，得到在檔案的第幾塊（從 0 算起）；餘數是塊內的位移。
2. 實體 block = `start + 第幾塊`。

> **例題** 找 tr 的第 1000 個 byte，block size 200（示意）。
> 1000 ÷ 200 = 5 餘 0 → 在檔案的第 5 塊（從 0 算）的第一個位置。tr 的 start = 14，所以實體 block = 14 + 5 = 19。完全用算的，不用 traverse。

> **陷阱** 上面的 14 + 5 = 19 只是示範公式的數字。課本圖裡 tr 只有 3 塊（14～16），實際存取不能超過 length，第 5 塊根本不存在。

> **例題** 再看一個例子：mail 從 block 19 開始、長度 6。要第 5 塊（從 1 算起，也就是 offset 4），實體 block = 19 + 4 = 23（示意）。

### Block 編號與 block size 從哪來
Partition 告訴 file system 哪一段 disk 空間可用；**format（格式化）**時，file system 決定 block size，並把這段空間的 block 做好編號（labeling）。所以 file system 一定知道 block size 和每塊的編號。

### 優點
- 找任何位置的 effort 最小：用算的就知道第幾塊，不用 traverse。算完只要發 **1 個 I/O request** 就讀到。
- 所以 seek 最少，**sequential 和 random 都一樣快**。
- Directory entry 很小，只要兩個 integer（起點、塊數）。

### 缺點
- **External fragmentation（外部碎裂）**，而且很嚴重：檔案來來去去，空位變得東一塊西一塊。
- **檔案長不大**：例如 tr 後面緊接著 mail，tr 想長大就沒有位置，只能整個搬家（整份 copy，effort 很大），找不到地方就 fail。disk 越用越難用。
- 解法跟 memory 管理一樣是 **compaction**，也就是常說的「硬碟重組／整理硬碟」，處理的就是 fragmentation。

## Extent-based file system

為了解決 contiguous 長不大的問題，有一個折中：**extent-based file system**，等於 **contiguous + linked**。

- 空間不夠時，不是給一個 block，而是一次給一個 **extent**：一組連續的 block（例如定義 5 塊為一個單位）。
- 用完了再給一個 extent，新的 extent 可以在別的地方。
- extent 之間用 linked list 串起來。這是 **on-disk structure**，所以「串起來」的意思是：每個 extent 的尾巴留 4 個 byte，記錄下一個 extent 的位置。要把那個 block 讀進 memory 才知道下一個在哪。
- 每個 extent 要記：起始 block、長度（固定長度可省；可變長度就要記）、下一個 extent 在哪（沒有就寫 null）。

### 代價
- 減少了 external fragmentation（長度可動態調整的話更好）。
- 但 extent 若是固定大小（例如一次給 5 塊），用不完的部分就是 **internal fragmentation（內部碎裂）**。所以固定大小時，內部、外部碎裂都還可能有；任意長度才能解決 external。
- 最主要犧牲的是 **random access**。

> **例題** 每個 extent 3 塊，要讀檔案的第 7 塊，需要幾個 I/O？
> 第 1～3 塊在第 1 個 extent，第 4～6 塊在第 2 個，第 7 塊在第 3 個 extent。可是第 3 個 extent 在哪？必須沿著 linked list 走：

```
I/O 1：讀第 1 個 extent 的尾巴 → 得知第 2 個 extent 的位置
I/O 2：讀第 2 個 extent 的尾巴 → 得知第 3 個 extent 的位置
I/O 3：讀第 7 塊（第 3 個 extent 的第 1 塊）
共 3 個 I/O；純 contiguous 只要 1 個，多了 2 個額外 I/O
```

disk 讀越多次越慢，random 的效能當然變差。

> **重點** 真實系統：FAT 系列走 linked 路線；contiguous 這一派的代表是 **XFS**，用的就是 extent，很多 OS 都支援。

## Linked allocation

### 做法
另一個極端：全部用 link。每個 block 尾端留幾個 byte 存下一塊的位置。課本的檔案 jeep：

```
directory: jeep  start = 9   end = 25

block 9 → block 16 → block 1 → block 10 → block 25 → null(-1)
```

Directory 存起點和終點。存**終點**是因為要在檔案尾巴加東西時，知道最後一塊就不用從頭 traverse 才找到尾巴。

### 優點
- **沒有 size 問題、沒有 external fragmentation**：任何一個空的 block 都能接上去（例如再接上 28）。容易長大縮小，free 掉的 block 也很好 reuse。
- **Sequential 還不錯**：順著讀本來就是在 traverse。讀完 block 16 的 data 時，下一塊的 pointer 也一起讀進來了，沒有額外讀取。
- **配置空間非常有效率**：找空間是 **O(1)**，從 free list 最上面 pop 一塊就好，所以 create 最快。

### 缺點
- **Random access 很慘**：位置越後面，越要先讀一堆根本不需要的 block，只為了拿 pointer。
- **每個 block 都要犧牲幾個 byte 存 pointer**（例如 4 byte）。
- **Reliability 差**：中間只要一個 link 斷掉，後面整個檔案全部 lost。一個 block 壞掉，或改檔時斷電、metadata 沒修好，整個檔案就可能崩掉。

### Random 到底多慘
根本原因：**pointer 散在 disk 各個 data block 裡，每讀一個 pointer 就是一次 I/O。**

> **例題** 計算 linked allocation 的 I/O 次數（示意）：
> - 從頭順著讀：沒問題，每塊讀一次，pointer 順便拿到。
> - 從第 5 塊讀到第 10 塊：前 4 塊還是得先讀出來，才找得到第 5 塊在哪。
> - Random：先讀第 8 塊，要從頭走 8 次（讀第 1～8 塊）；接著要第 3 塊，又得從頭走 3 次，總共 8 + 3 = 11 次 I/O，而且第 1～3 塊被重複讀。

### 改善：cluster
把好幾個 block **cluster（叢集）**成一個單位來配置，link 數量和 traverse 次數就變少。link 加上 contiguous，其實就是 extent 的概念。

## FAT：把 pointer 收集成一張表

### 做法
Linked 在真實世界也看得到，就是有名的 **FAT32**。它要解決的是：random access 時得一塊一塊去 disk 查 pointer。

做法很簡單：把所有 linked list 的 pointer（一種 metadata）抽出來，收集成一張表，叫 **FAT（File Allocation Table）**。表的第 i 格存「block i 的下一塊是誰」。

課本的例子：directory 記著檔案 test 從 217 開始。

```
directory entry: test ... start block = 217

FAT（index = block 編號）
  ...
  217 | 618      ← block 217 的下一塊是 618
  ...
  339 | EOF      ← 檔案結束
  ...
  618 | 339      ← block 618 的下一塊是 339
  ...

test 的 block 順序：217 → 618 → 339 → EOF
```

> **陷阱** 鏈是 217 → **618** → 339 → EOF（課本圖的數字），不要記成 217 → 168。

再看一個例子：若 FAT[9] = 16，意思是 block 9 的下一塊是 16，依此類推。用前面 jeep 的鏈來填，表就是 FAT[9]=16、FAT[16]=1、FAT[1]=10、FAT[10]=25、FAT[25]=EOF。

### 為什麼快
- 這張表**只有 pointer，沒有 data**。它存在 partition 前面幾個連續的 block。
- **Mount 時把整張表 load 進 memory**。pointer 比 data 小很多，可以一次循序讀進來。
- 之後就算 random access，「沿著鏈走」的動作還在，但是**在 memory 裡走，沒有 disk I/O**。
- 在 memory 找到真正的 block 編號後，再對 disk 下一次指令：**1 次 disk I/O**，跟 contiguous 一樣快。例如讀第 8 塊，只要 1 次 disk I/O。

說穿了，FAT 就是 **pointer 的 cache**：把 pointer 收集在相鄰的 block、整個 load 到 memory，讓 random access 的 seek 降到最低。

- 為什麼叫 FAT32？表的每個 entry 用 **32 bit**。FAT64 做法一樣，只是 entry 變 64 bit。
- 壞掉怎麼復原（fail recovery）是另一個議題，可以用 log 等做法。

> **陷阱** FAT 已經**不是傳統的 linked allocation**，是改善版。考題說「linked allocation」，通常指 pointer 藏在每個 data block 裡的傳統版；FAT 要另外看。

## Indexed allocation

### 做法
一樣把 pointer 收集起來，放在一個專門的 block，叫 **index block**。jeep 的 index block 是 block 19：

```
directory: jeep  index block = 19

index block 19:
entry:  0   1   2   3   4   5   6   7
value:  9  16   1  10  25  -1  -1  -1
```

要檔案的第 3 塊（從 0 算），直接查第 3 格，是 1 → 去讀 block 1。再看一個例子：第 4 格是 10，就直接去 block 10。完全是 **lookup**，不用沿著鏈走（direct access 的概念）。

讀取流程：directory 存檔名和一個指到 index block 的 pointer → 把 index block 讀出來 → 找到要的那一格 → 直接 access 那個 data block。FCB 只要存 index block 的 id。

### 跟 linked、FAT 的差別

| | Linked（傳統） | FAT | Indexed |
|---|---|---|---|
| pointer 放哪 | 每個 data block 的尾巴 | 一張表，整個 file system 共用 | index block，**每個檔案一個** |
| data block 裡有 pointer 嗎 | 有 | 沒有 | 沒有，只有 data |
| 找第 k 塊 | 在 disk 上沿 link 走 | 在 memory 沿 link 走 | 直接 lookup 第 k 格 |

> **陷阱** FAT 是整個 file system 一張表，裡面別的 entry 可能是別的檔案的 pointer，而且查表時走的還是 link；indexed 是每個檔案自己一個 index block，直接 lookup。不要混在一起。

### 優點
- **Random access 非常有效率**，sequential 也一樣，一次就找到位置。
- **沒有 external fragmentation**：有空位就能用，跟 linked 一樣。
- 有一個 free list 知道哪些 block 可用，就能輕鬆 create 或 extend 檔案。

### 缺點：一整個 index block 的浪費
缺點一樣出在 pointer：要存 pointer，就得賠上一整個 index block，而且 index block 只能放 index。

> **例題** 檔案只有 2 個 data block，pointer 4 byte，index block 512 byte：
> 需要的 pointer 空間 = 2 × 4 = 8 byte，但仍要配置一整塊 512 byte 的 index block，浪費 512 − 8 = 504 byte。
> 傳統 linked 只是每塊浪費 4 byte（2 塊共 8 byte）。index 和 data 完全分開，小檔案的浪費比 linked 更嚴重。

## 檔案太大：一個 index block 放不下

小檔案浪費空間；檔案非常大時，問題反過來：pointer 多到一個 block 放不下。

> **例題** block 512 byte、pointer 4 byte：一個 index block 能放 512 ÷ 4 = **128** 個 pointer。檔案超過 128 個 data block（128 × 512 B = 64 KB），一個 index block 就不夠，需要好幾個 index block。

怎麼延伸成多個 index block？有三種做法：linked index scheme、multi-level index、combined scheme（UNIX inode）。

### 做法一：Linked index scheme
名字有 link，但本質**還是 indexed**，只是用 link 解決 index block 不夠大的問題。

- 一開始只有一個 index block（例如 19），照一般 indexed 的做法指到各個 data block。
- 檔案長到超過，就 create 一個新的 index block。
- 兩個 index block 之間留一個 pointer（例如 index block 的最後一格），串成 linked list。
- 檔案一直長，就一直加 index block、一直加 link。

```
[index block 19] ──link──▶ [index block A] ──link──▶ [index block B] ──▶ null
   │ │ │ ...                  │ │ │ ...                  │ │ ...
   data blocks                data blocks                data blocks
```

缺點：random 跳到很後面時，要先一個一個查好幾個 index block。有 10 個 index block，最壞要 lookup 10 次；檔案越大越慢，**前面快、後面慢，速度很不平均**。適合中等大小（medium size）的檔案。

> **例題** 讀第 k 塊要幾個 I/O（示意，block 512 B、pointer 4 B，每個 index block 用最後一格當 link，所以存 127 個 data pointer；FCB 在 memory、index block 不在）：
> 讀檔案的第 300 塊（從 0 算）。第 1 個 index block 管第 0～126 塊，第 2 個管 127～253，第 3 個管 254～380 → 第 300 塊在第 3 個 index block。
> I/O = 讀第 1 個 index block + 讀第 2 個 + 讀第 3 個 + 讀 data = **4 次**。若是第 50 塊，只要讀第 1 個 index block + data = 2 次。

### 做法二：Multi-level index
跟 memory 管理中 **page table 的延伸（hierarchical paging）**一模一樣：階層式的 index。

- 最上層的 index block（例如 16）叫 **outer index**，它的 pointer 指到的不是 data block，而是另一個 index block。
- 例如 16 的第一格寫 19，19 裡存的還是 index，再往下指到的才是真正的 data。這是 2 level，要 3 level 也可以。
- **只有最底層（leaf）的 pointer 才指向 data block。**

```
outer index 16          inner index 19, ...         data
 [19][..][..]  ──▶  [ptr][ptr][ptr]...  ──▶  [data block]
```

優點：就算要讀很後面的 block，也是直接往下跳，**每個 block 經過的層數都一樣**（2 level 就是查 2 個 index block），速度穩定，前後都差不多。也可以說「都差不多慢」，但系統（效能管理和使用者）通常 prefer 穩定、可預測。

缺點：hierarchy 是指數成長的，**空間浪費比較嚴重**。所以真的很大的檔案才用；中等大小用 linked index 可能就夠。

> **例題** 2-level index 能管多大的檔案（示意，block 512 B、pointer 4 B）：
> 每個 index block 有 512 ÷ 4 = 128 個 pointer。outer 128 格 × 每個 inner 128 格 = 128² = 16384 個 data block，最大檔案 = 16384 × 512 B = 8 MB。
> 讀任一塊（FCB 在 memory）= 讀 outer + 讀 inner + 讀 data = 3 次 I/O，不管是第 0 塊還是最後一塊都一樣。

| | Linked index | Multi-level index |
|---|---|---|
| index block 的組織 | 串成一條 linked list | 樹狀（hierarchy） |
| 讀後面的 block | 要一個一個走，越後面越慢 | 層數固定，前後一樣快 |
| 空間 | 較省 | 指數成長，浪費較多 |
| 適合 | 中等大小 | 非常大的檔案 |

## UNIX inode：combined scheme

### 結構
第三種做法是 **combined scheme**，也是 **UNIX inode** 預設的做法。它也是 multi-level，但**依檔案大小決定層數**：小檔案一層就夠，大檔案才用多層。就像 Intel 的 page table 可以選 4 MB 或 4 KB 的 page，是一種折中，給你選擇。

inode 存檔案的資訊，其中最重要的就是 data block 在哪。inode 裡存 pointer 的欄位分成：

```
inode
┌──────────────┐
│ direct 0     │──▶ data
│ direct 1     │──▶ data
│ ...          │
│ direct 11    │──▶ data                         （12 個 direct block）
│ single ind.  │──▶ [index] ──▶ data
│ double ind.  │──▶ [index] ──▶ [index] ──▶ data
│ triple ind.  │──▶ [index] ──▶ [index] ──▶ [index] ──▶ data
└──────────────┘
```

- **Direct blocks**：直接存 data block 的 pointer。檔案小時最好直接指到，要第幾塊直接在這裡找。
- 但 inode 只是一個 data structure，大小有限。一個 entry 只指一個 block，block 4 KB 時，一個 entry 只管 4 KB；就算有一千個 direct entry，也才 4 MB 左右，根本不夠。
- **Single indirect**：這個 pointer 指到的不是 data，而是一個 index block（裡面存的還是 index）。indirect 就是「多加一層」。
- 再不夠用 **double indirect**（兩層），還不夠用 **triple indirect**（三層）。從哪一個 pointer 開始找，就知道裡面的值要當成 data 還是 index 來解讀。

這就是 combined：把 multi-level 分成不同層級混著用。

### 最大檔案大小的計算
> **例題** 12 個 direct、1 個 single、1 個 double、1 個 triple indirect；block 4 KB、pointer 4 byte。最大檔案多大？

步驟一：每個 index block 能放幾個 pointer
```
4 KB ÷ 4 B = 4096 ÷ 4 = 1024 = 2¹⁰ 個 pointer
```

步驟二：每一部分管多少空間
```
direct  : 12 × 4 KB                       = 48 KB
single  : 1024 × 4 KB     = 2¹⁰ × 2¹² B   = 2²² B = 4 MB
double  : 1024² × 4 KB    = 2²⁰ × 2¹² B   = 2³² B = 4 GB
triple  : 1024³ × 4 KB    = 2³⁰ × 2¹² B   = 2⁴² B = 4 TB
```

步驟三：相加
```
最大檔案 = 48 KB + 4 MB + 4 GB + 4 TB
```

檔案 ≤ 48 KB 只用 direct；≤ 48 KB + 4 MB 只用 direct 和 single；以此類推。4 TB 已經非常大，整顆 disk 也不過 TB 級。當然仍有極限，檔案真的大到那樣，file system 很多東西都得改寫。

> **陷阱** 最大檔案是**四項相加**，不是只取 triple 那一項；double 是 1024² × 4 KB，不是 2 × 1024 × 4 KB。

> **例題** 換一組數字練習（示意）：block 1 KB、pointer 4 B、12 direct + single + double + triple。
> 每塊 pointer 數 = 1024 ÷ 4 = 256 = 2⁸。
> direct = 12 × 1 KB = 12 KB；single = 256 × 1 KB = 256 KB；double = 256² × 1 KB = 2¹⁶ KB = 64 MB；triple = 256³ × 1 KB = 2²⁴ KB = 16 GB。
> 最大檔案 = 12 KB + 256 KB + 64 MB + 16 GB。

### 讀某一塊要幾次 I/O
層數越多，lookup 越多。假設 **inode 已在 memory**（I/O 次數含讀 data 那一次）：

| 該 block 落在 | 要讀的東西 | Disk I/O |
|---|---|---|
| direct | data | 1 |
| single indirect | 1 個 index block + data | 2 |
| double indirect | 2 個 index block + data | 3 |
| triple indirect | 3 個 index block + data | 4 |

好處就在 performance：小檔案都走 direct，一次 lookup 就找到資料；越後面的部分才付出多層的代價。

### 例題：第 N 塊落在哪一區、要幾次 I/O
（示意；block 4 KB、pointer 4 B、12 direct，block 從 0 編號，inode 在 memory。）先算每一區管的 block 範圍：

```
direct : block 0 ~ 11                                  （12 塊）
single : block 12 ~ 12+1024-1 = 1035                   （1024 塊）
double : block 1036 ~ 1036+1024²-1 = 1036+1048576-1 = 1049611
triple : block 1049612 起
```

1. 讀 byte 40000：40000 ÷ 4096 = 9 餘 3136 → block 9 → direct → **1 次** I/O。
2. 讀 byte 2,000,000：2000000 ÷ 4096 = 488 餘 1152 → block 488 → 12 ≤ 488 ≤ 1035 → single indirect，是 single index block 的第 488 − 12 = 476 格 → 讀 index block + data = **2 次**。
3. 讀 byte 8,000,000：8000000 ÷ 4096 = 1953 餘 512 → block 1953 > 1035 → double indirect。在 double 區的 offset = 1953 − 1036 = 917；第一層格號 = ⌊917 ÷ 1024⌋ = 0，第二層格號 = 917 mod 1024 = 917 → 讀第一層 index、第二層 index、data = **3 次**。

## 考題：讀第 10 塊要幾次 I/O

這幾種配置方式一定要知道怎麼運作，而且要會算：不同的 I/O pattern，各需要幾個 I/O request 才完成。名字很像（linked、linked index、multi-level），一定要分清楚才算得對。

> **例題** 檔案有 10 個 block，要讀**第 10 塊的第 3 個 byte**。假設 FCB 在 memory、index block 不在 memory。

| 配置方式 | 過程 | I/O 次數 |
|---|---|---|
| Contiguous | start + 9 用算的，直接讀 | 1 |
| Linked（傳統） | 讀第 1～9 塊拿 pointer，再讀第 10 塊 | 10 |
| FAT（已 load 到 memory） | 在 memory 查表走到第 10 塊，再讀 | 1 |
| Indexed | 讀 index block，再讀 data | 2 |

補充其他方式（示意，同樣假設）：linked index scheme 只要一個 index block 就裝得下 10 個 pointer，所以也是 2 次；2-level multi-level index 是讀 outer + inner + data = 3 次；UNIX inode（inode 在 memory）第 10 塊落在 direct（0～11），1 次。

第 3 個 byte 只影響塊內位移，不影響 I/O 次數。

## Free-space management

配置講完，還要管理**剩下的空間在哪**，才有得配置。做法有四種，前三種名字陌生，其實就是前面學過的配置方式：

| 做法 | 等於哪種配置 | 怎麼做 |
|---|---|---|
| **Linked list** | linked allocation | 每個空 block 存下一個空 block 的位置 |
| **Grouping** | linked index | 第一個空 block 存 n 個空 block 的位址，最後一格指到下一組 |
| **Counting** | contiguous | 記錄（起點, 連續幾塊），例如 (2, 4) 表示從 block 2 開始連續 4 塊是空的 |
| **Bit vector** | （不串起來） | 每個 block 用 1 個 bit 表示空或不空 |

> **觀念** 把 free space 想成一個檔案，把空 block 全部串起來。這個檔案很簡單，只需要支援 sequential access：每次拿第一個空位，用完就把位置換一下。所以名字不用刻意背，知道做法就好。

### Bit vector（bitmap）
把整個 partition（一個 file system 管一個 partition）的 data block 拿來看，每塊只要知道有沒有被用，就用 1 個 bit 表示：有幾塊就有幾個 bit。

```
block:  0 1 2 3 4 5 6 7 8 9 ...
bit  :  1 1 0 0 0 0 1 0 1 1 ...      （示意；此處 0 = free、1 = occupied）
→ 找 0：block 2、3、4、5、7 可配置
```

> **陷阱** bit 的意義有兩種慣例：一種是 0 = free、1 = occupied；課本剛好相反，**1 = free、0 = allocated**。考試看題目的定義。

它不把 free block 串起來，就是一串 0101，而且一次就能看到很多塊誰空誰不空。

優點：

- **簡單**。
- **判斷快**：電腦本來就是 bit，硬體處理 0101 比沿著 link 走、再判斷數字快得多；而且一次可以讀 32 或 64 個 bit，一整排一起看。

缺點：partition 越大，bit 越多；多到塞不進 CPU cache 就會變慢，發揮不了優勢。

> **例題** 課本的例子：1 TB 的 disk、block 4 KB，bitmap 多大？
> block 數 = 2⁴⁰ ÷ 2¹² = 2²⁸ 塊 → 需要 2²⁸ bit。
> 2²⁸ bit ÷ 8 = 2²⁵ byte = 32 MB。

### 為什麼要一次知道所有空位
隨便找一個空位不就好了？為什麼要知道所有 0 在哪？

1. **Contiguous 不能隨便找**：它要一串**連續的 0**，用 bit vector 一眼就看出哪裡有，例如找到 block 8～13 這 6 個連續的 0（示意）。
2. **就算是 linked**，同一個檔案放近一點，磁頭移動也會少。所以不管哪種做法，都希望同一個檔案放在相近的 physical location。要知道「附近哪裡有空」，單純的 linked list 做不到，要有這串 bit。
3. 可以 load 某一段範圍，看看範圍內哪裡空，資訊更多，就能選到更近、更好的位置。

實際的 file system 很少直接用前面那三種串法（那樣蠻複雜），會切成一段一段，做類似 binary search 的事。為了 performance，大部分 file system 要的是：**給一個 position，很快回答離它最近的 0 在哪**，甚至再加條件：最近、**而且大小至少某個 size**（例如找到 block 17～18，示意）。加上這些條件，linked list 類的做法都得修改；bit vector 不用修改就能回答，所以很有效率。

## 檔案系統的兩層 mapping

整個 file system implementation 最重要的就是 **mapping**，而且有兩層：

1. **Namespace**：一個 file path 怎麼對到一個 inode，也就是 FCB（directory 的工作）。
2. **Location**：FCB 裡記錄的檔案位置，怎麼 map 到 disk 上的實體位置，也就是前面這幾種 allocation method。

## Mass storage：往下走到硬碟

File system 管的是 file 這種 logical 的東西；它底下的 **storage system** 管的是實體的 storage device，更 low level。

為什麼叫 **mass storage（大量儲存）**？因為要用好幾顆 disk，拼出更 reliable、效能更好的系統。這個年代的做法就是：用現有的硬體兜起來，靠軟體管理，做出更強或更便宜的系統。

這裡以 disk（hard drive）為主，它仍是最常見的 storage；SSD、Flash 也有，但先從 hard drive 的構造開始。接著是 disk scheduling（讀寫頭怎麼移動），最後是非常重要的 RAID。

### Disk structure
- File system 讀寫的 logical 單位是 **block**；block 再 map 到 **sector**，一個 block 由一個或多個 sector 組成。
- 一顆 disk 有好幾片 **platter（盤片）**，每片有一圈圈的 **track（磁軌）**，track 再切成 **sector（磁區）**。

```
platter（俯視）
      ┌─────────────── track（外圈）
      │   ┌────────── track（內圈）
   ( ( ( ● ) ) )      每圈 track 切成多個 sector
```

- Sector 要有編號才能做 mapping。從哪開始編沒有規定：sector 0 可能在最外圈，也可能在最內圈，但**編號一定要連續、有關聯**。
- 因為硬碟最好順著移動讀寫，**編號差就代表讀寫頭要移動的距離**。之後的 disk scheduling 就是要 minimize 這個距離，看編號就知道。

### 轉法：CLV 與 CAV
注意：外圈的空間比內圈大。磁碟類裝置（hard drive、CD-ROM、DVD-ROM）依轉法分兩種。

**CLV（Constant Linear Velocity，固定線速度）**

- 外圈空間大、sector 多、資料也多；為了每秒讀出一樣多的資料，**轉速要變**。
- 讀外圈時，轉一小段就經過 6 個 sector，不用轉很快；內圈 sector 少，要讀一樣的 6 個 sector 得轉一整圈。所以**外圈轉慢、讀到內圈就加速**。
- 這就是放 CD／DVD 時會突然加速、聲音變大，有時又慢下來的原因：轉速隨讀內圈或外圈在變。

**CAV（Constant Angular Velocity，固定角速度）**

- **轉速永遠固定**，例如 7200 轉。每圈的 sector 數一樣（例如每圈都是 8 個），轉過同樣的角度，讀出的資料量就一樣。
- 買硬碟除了看等級和容量，一定要看 **rotation speed**，單位是 **RPM（revolutions per minute，每分鐘轉數）**。不管資料放哪、怎麼用，都維持這個轉速。
- 所以存資料要配合：**外圈 density（密度）比較疏**，外圈的 sector 又長又寬，內圈比較密，這樣同樣角度讀到的量一樣。對軟體來說越穩定、越 predictable 越好，硬體就配合做到。

> **重點** 要維持相同的 data rate，只有兩種選擇：改轉速（CLV）或改 density（CAV）。標準 hard drive 用 **CAV**；CD、DVD 用 **CLV**。

### Disk attachment
Disk 要接到電腦上才能做 I/O，透過兩邊的 controller：

- 電腦端：**host controller**，可能是一張 controller card、主機板上的晶片，甚至由 CPU 直接擔任。
- 裝置端：drive 自己的 controller，disk 就是 **disk drive controller**。
- 中間的連線（例如常見的 SATA 排線）是 **bus**。每種 bus 都有自己的 **protocol**，兩邊講好才能傳資料。細節在 I/O 系統那章。

```
[CPU / memory] ── host controller ══ bus（例如 SATA）══ disk controller ── [disk]
```

## Disk scheduling 的目的與 disk access time

File system、database 等各種軟體會同時丟一大堆 I/O request 給 disk，disk controller 要決定**照什麼順序處理**。**Disk scheduling** 的目的就是減少讀寫時間。

### Disk access time
Hard drive 的盤片以固定速度 rotate，每圈的 sector 數固定；要讀不同 track，讀寫頭（arm 前端的 head）就得往內或往外移。要讀某個 sector，就要知道它在哪片 platter、哪個 track（不同 platter 可以同時讀）。

讀一個 sector 的步驟：

1. **Seek**：把讀寫頭移到那個 track。
2. **Rotation**：等盤片轉到那個 sector（rotational latency）。
3. **Transfer**：真正讀寫資料。

```
access time = seek time + rotation time + transfer time
```

- **Seek time**：移動磁頭的時間，由 track 的位置決定。
- **Rotation time**：由轉速和目標離現在位置多遠決定。
- **Transfer time** = 資料量 ÷ bandwidth；bandwidth 越高越短。反過來，知道傳了多少資料、request 從進去到完成花多久，也能算出 bandwidth。

> **例題** 7200 RPM 的 rotation time：
> 一圈 = 60 秒 ÷ 7200 = 1/120 秒 ≈ 8.33 ms。
> 平均要等半圈 = 8.33 ÷ 2 ≈ 4.17 ms（課本常用的算法）。

> **例題** transfer time 與 bandwidth（示意）：讀 4 KB，bandwidth 100 MB/s → 4 KB ÷ 100 MB/s ≈ 4096 ÷ 100,000,000 s ≈ 0.04 ms。反推：若 8 MB 花 0.1 s 傳完，bandwidth = 8 MB ÷ 0.1 s = 80 MB/s。

### 為什麼目標是 minimize seek time
三個時間中，哪一個能靠 scheduling 改善？

- **Transfer time**：不行。它跟資料量有關；一次 sequential 讀很多 byte，跟把同樣大小切碎散落各地，時間當然不同，但那是使用者的 I/O pattern，controller 管不到。
- **Rotation time**：本來就很快（每分鐘 7200 轉）。轉得快的好處是資料量大、要轉好幾圈時讀得快，所以它也跟 bandwidth 有關。不需要特別最佳化。
- **Seek time**：真正的大問題。移動磁頭是**機械動作**，光從最內圈移到最外圈就很久。SSD 為什麼快？因為它根本沒有機械。

所以 disk scheduling 的目標就是 **minimize seek time**。而且 seek time 不是看單一 request，而是看**所有 request 的處理順序**：如果要讀的資料剛好每個 track 各有一個 sector，依序走過去跟亂跳，磁頭移動距離差非常多，時間也差非常多。

```
依序：  track 0 → 1 → 2 → 3 → 4          移動距離小
亂跳：  track 0 → 4 → 1 → 3 → 2          來回移動，距離大很多
```

> **重點** 這個問題只有 hard drive、CD-ROM 這類有磁碟的裝置才有；SSD 等其他 storage device 的管理重點不同。具體的 disk scheduling 演算法接在下一章。

## 重點整理
- File 是 logical storage unit；最小 physical storage unit 是 sector（硬碟：platter → track → sector），檔案系統把 file map 到 sector
- 檔名只是 attribute；真正唯一的是 identifier（ID）；屬性 + 內容 = file
- File operations 約十種：open、read、write、create、delete、truncate（某點之後全丟）、concatenate（兩檔接起來）
- 操作前要先 open：open 才建立 open-file table 與 system-wide table 的 entry
- Per-process open-file table：position、access right（因 process 而異）；fopen 的 file handler 對到其中一個 entry
- System-wide open-file table：disk location、access date、file size（process independent），只存一份以避免 data consistency 問題
- 副檔名對 OS 只是 hint（選開啟程式用），不決定內容格式
- 三種 access：sequential（API 不給 position，read 後 position 隱含前進，reset/rewind）、direct/random（API 帶 position）、index（給 key 查 index table）
- 硬碟循序讀寫遠快於 random；上層要支援 random access 通常需要 memory cache
- Partition 是 raw；format（建立 file system）後才是 volume；partition 可跨多顆 disk（5 × 2T = 10T），floppy、CD-ROM 不能切
- Database、swap space 可直接用 raw partition
- Directory 本意：檔名 → unique ID 的 mapping；資訊必須 persistent 寫回硬碟
- Directory operation：create、delete、rename、list；list 常是現代 FS 的 bottleneck；search 可用 tree 或 hash
- 目錄結構演進：single-level（檔名須 unique、list 差）→ two-level（MFD + 每 user 一個目錄）→ tree（absolute / relative path）→ acyclic graph（可共享、不可 cycle）→ general graph（可有 cycle）
- ln = hard link（所有名字都刪才消失），ln -s = soft/symbolic link（只記路徑，原檔刪了就指向不存在）
- Acyclic graph 用 reference count 解 dangling pointer：減到 0 才真的刪
- General graph 有 cycle，reference count 不夠 → cycle detection 或 garbage collection（從 root label reachable，兩個 pass）；GC 太貴，多數 FS 禁止造成 cycle 的 link
- Mount 先決定 mount point；三種時機：boot time、run time 自動、手動；可 recursive；Windows 只能掛成 C:/D:，Linux/Mac 可掛在任何已存在資料夾
- 跨 partition 找檔：directory 上標 m + mount table（port、protocol）+ partition 資訊；被掛 partition 的 root 相當於 mount point
- Sharing：user ID、group ID（預設 group 是自己）；檔案分 owner（唯一）/ group / others，同 group 權限相同不能細分
- 只有 owner 或 root 能改權限與擁有者
- 完整 ACL 太長不可行 → 3 class × rwx = 9 bit
- ls -l：第一字元表示 file/directory，後 9 個分三組；目錄的 x = 能否 traverse 進去，permission denied 要檢查路徑上每層 parent 的 x
- chmod：r=4、w=2、x=1；644 = rw-r--r--
- Protection 兩層面：damage（RAID 多顆硬碟副本）與 privacy/security（password 登入 + ACL；網路上要加密）
- Disk allocation（檔案怎麼 map 到 disk 上的位置）是 file system 最核心的管理機制
- Block 是 file system（logical）的最小單位，sector 是 disk（physical）的最小單位；block ≥ sector，通常是倍數（sector 512 B，block 1–4 KB，4 KB = 8 sectors）
- 一個 OS 可有多個 file system（FAT32、NTFS…）：差在 disk allocation 與 search 的實作，對上介面相同；換 file system 要重新 format
- Layered file system：logical file system（API、permission/ACL）→ file-organization module（position → 第幾個 block，各家差異所在）→ basic file system（block → disk/partition/cylinder/track/sector）；driver 在 file system 外面做 I/O
- On-disk：boot control block（optional）、partition control block（切 partition 時建）、directory structure、FCB（format 時建）、data blocks；沒 format = raw partition
- FCB 是 metadata 不是內容，每檔一個（像 PCB），最重要的是 data blocks 的 location；UNIX inode 不存檔名（檔名在 directory entry）
- In-memory：mount table、部分 directory（recently accessed）、system-wide open-file table（FCB）、per-process open-file table（handle、position、permission，不在 disk）；boot control block 不 load
- open = traverse path 找到 FCB，load 到 system-wide table，再填 per-process table
- read/write：file handle → per-process entry（permission、position）→ system-wide entry（FCB）→ location → disk
- create：建 FCB → 確認 path（traverse）→ directory 加檔名 → 指到 FCB；之後 write 只加 data block、更新 FCB pointer
- 修改先在 memory，週期性或關機時 flush；跳電會掉資料、只 flush 一半會不一致 → scan disk 或 logging + recovery
- VFS：很薄的統一介面，依檔案所屬 file system dispatch；每個 mount 的 FS 都要 implement 它；同一 FS 用不同 disk 靠 driver
- Linux VFS 四 object：inode（on-disk FCB）、file object（open 後 in-memory）、superblock（整個 FS）、dentry（directory）；open、read 是 file object 的 method
- 實作兩大重點：directory 維護方式（linked list / hash table → search time）、data block 擺法（影響 random / sequential 效能）
- 三種基本配置：contiguous（連續）、linked（串鏈）、indexed（查表）；實務常 hybrid（extent、FAT、linked index、inode）
- Contiguous：FCB 存 (start, length)；實體 block = start + ⌊byte ÷ block size⌋；1 次 I/O，sequential 與 random 都快；缺點 external fragmentation、檔案長不大，解法 compaction
- Extent-based = contiguous + linked：一次配一組連續 block，extent 尾巴記下一個 extent；固定大小有 internal fragmentation；犧牲 random（每 extent 3 塊讀第 7 塊要 3 次 I/O）
- 傳統 linked：directory 存 start、end；無 external fragmentation、容易長大、配置 O(1)（free list pop）；random 差（讀第 k 塊要 k 次 I/O）、每塊浪費 pointer 空間、一個 link 斷後面全 lost
- FAT：pointer 集中成一張表（整個 file system 一張），mount 時 load 進 memory，random 也只要 1 次 disk I/O；FAT32 = entry 32 bit；FAT 不是傳統 linked
- Indexed：每個檔案一個 index block，直接 lookup，data block 只有 data；random/sequential 都快、無 external fragmentation；小檔案也要賠一整個 index block（2 塊只用 8 B，浪費 504 B）
- 一個 index block 的 pointer 數 = block size ÷ pointer size（512 ÷ 4 = 128；4 KB ÷ 4 = 1024）
- Linked index scheme：index block 串成 linked list，本質仍是 indexed；越後面越慢（10 個 index block 要查 10 次），適合中等檔案
- Multi-level index：同 hierarchical page table，只有 leaf 指 data；每塊層數相同、速度穩定，但空間浪費較大，適合非常大的檔案
- UNIX inode（combined）：12 direct + single + double + triple indirect；block 4 KB、pointer 4 B → 48 KB + 4 MB + 4 GB + 4 TB（四項相加）
- inode 在 memory 時讀一塊的 I/O：direct 1、single 2、double 3、triple 4
- 讀 10 塊檔案的第 10 塊（FCB 在 memory、index block 不在）：contiguous 1、linked 10、FAT 1、indexed 2
- Free-space：linked list（= linked）、grouping（= linked index）、counting（= contiguous，記 (起點, 塊數)）、bit vector
- Bit vector：每 block 1 bit；簡單、硬體一次看 32/64 bit；partition 大時超出 cache 變慢（1 TB ÷ 4 KB = 2²⁸ 塊 → 32 MB）；課本慣例 1 = free，看題目定義
- Bit vector 能快速找「離某位置最近、且大小至少 n 的連續空位」，有利於把同一檔案放近
- File system 兩層 mapping：path → inode（FCB）；FCB 的 location → 實體 block
- Disk：block → 一個或多個 sector；platter → track → sector；sector 編號連續，編號差 ≈ 磁頭移動距離
- CLV 改轉速（外圈慢、內圈快，CD/DVD）；CAV 轉速固定、改 density（外圈疏，hard drive）；轉速單位 RPM
- Disk attachment：host controller ─ bus（如 SATA，各有 protocol）─ disk controller
- access time = seek + rotation + transfer；7200 RPM 一圈 = 60/7200 s ≈ 8.33 ms，平均半圈 ≈ 4.17 ms；transfer = 資料量 ÷ bandwidth
- Disk scheduling 目標是 minimize seek time（機械動作最慢；取決於所有 request 的順序）；SSD 無機械，重點不同

## 名詞對照
| 中文 | English |
|---|---|
| 檔案系統 | file system |
| 邏輯儲存單位 | logical storage unit |
| 讀寫盤 | platter |
| 磁軌 | track |
| 磁區 | sector |
| 屬性 | attribute |
| 識別碼 | identifier |
| 截斷 | truncate |
| 串接 | concatenate |
| 開檔表 | open-file table |
| 全系統開檔表 | system-wide open-file table |
| 檔案控制代碼 | file handler（file pointer） |
| 資料一致性 | data consistency |
| 檔案型別（副檔名） | file type（extension） |
| 循序存取 | sequential access |
| 直接存取／隨機存取 | direct access / random access |
| 索引存取 | index access |
| 分割區 | partition |
| 磁區／槽 | volume |
| 格式化 | formatting |
| 原始分割區 | raw partition |
| 置換空間 | swap space |
| 目錄 | directory |
| 單層目錄 | single-level directory |
| 雙層目錄 | two-level directory |
| 主檔案目錄 | master file directory (MFD) |
| 樹狀目錄 | tree-structured directory |
| 絕對路徑 | absolute path |
| 相對路徑 | relative path |
| 無環圖目錄 | acyclic-graph directory |
| 一般圖目錄 | general-graph directory |
| 硬連結 | hard link |
| 符號連結／軟連結 | symbolic link / soft link |
| 懸空指標 | dangling pointer |
| 參考計數 | reference count |
| 垃圾回收 | garbage collection |
| 環偵測 | cycle detection |
| 掛載 | mounting |
| 掛載點 | mount point |
| 掛載表 | mount table |
| 共享 | sharing |
| 權限 | permission / privilege |
| 存取控制 | access control |
| 存取控制串列 | access-control list (ACL) |
| 擁有者 | owner |
| 群組 | group |
| 其他人 | others |
| 保護 | protection |
| 損壞 | damage |
| 可靠度 | reliability |
| 磁碟配置方法 | disk allocation method |
| 資料區塊 | (data) block |
| 格式化 | format(ting) |
| 驅動程式 | device driver |
| 控制器 | I/O controller |
| 暫存器 | register |
| 分層式檔案系統 | layered file system |
| 邏輯檔案系統 | logical file system |
| 檔案組織模組 | file-organization module |
| 基本檔案系統 | basic file system |
| 存取控制清單 | access control list (ACL) |
| 磁柱 | cylinder |
| 磁碟上的結構 | on-disk structure |
| 記憶體中的結構 | in-memory structure |
| 開機控制區塊 | boot control block |
| 分割區控制區塊 | partition control block |
| 檔案控制區塊 | file control block (FCB) |
| 行程層級開檔表 | per-process open-file table |
| 檔案代號 | file handle |
| 寫回 | flush |
| 日誌 | logging / log |
| 復原 | recovery |
| 虛擬檔案系統 | virtual file system (VFS) |
| 索引節點 | inode |
| 檔案物件 | file object |
| 超級區塊物件 | superblock object |
| 目錄項目 | dentry (directory entry) |
| 雜湊表 | hash table |
| 搜尋時間 | search time |
| 配置方式 | allocation method |
| 連續配置 | contiguous allocation |
| 鏈結配置 | linked allocation |
| 索引配置 | indexed allocation |
| 隨機（直接）存取 | random (direct) access |
| 外部碎裂 | external fragmentation |
| 內部碎裂 | internal fragmentation |
| 硬碟重組 | compaction |
| 延伸區 | extent |
| 叢集 | cluster |
| 檔案配置表 | File Allocation Table (FAT) |
| 索引區塊 | index block |
| 鏈結索引 | linked index scheme |
| 多層索引 | multi-level index |
| 外層索引 | outer index |
| 組合式 | combined scheme |
| 直接區塊 | direct block |
| 單層間接 | single indirect |
| 雙層間接 | double indirect |
| 三層間接 | triple indirect |
| 格式化 | format |
| 掛載 | mount |
| 剩餘空間管理 | free-space management |
| 位元向量 | bit vector (bitmap) |
| 分組 | grouping |
| 計數 | counting |
| 大量儲存 | mass storage |
| 固定線速度 | Constant Linear Velocity (CLV) |
| 固定角速度 | Constant Angular Velocity (CAV) |
| 每分鐘轉數 | revolutions per minute (RPM) |
| 主機控制器 | host controller |
| 磁碟控制器 | disk controller |
| 匯流排 | bus |
| 磁碟排程 | disk scheduling |
| 存取時間 | access time |
| 搜尋時間 | seek time |
| 旋轉時間 | rotation time (rotational latency) |
| 傳輸時間 | transfer time |
| 頻寬 | bandwidth |
