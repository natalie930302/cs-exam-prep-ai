# 進階樹：B-Tree、B+ Tree、Trie

資料量大到放不進記憶體時，要放在硬碟上，而硬碟一次讀一個 block，查詢成本就是「讀了幾個 block」。這章從 index 與多層 index 出發，看它怎麼變成 m-way search tree，再加上規則成為 B-tree：學它的規則、搜尋、插入（split）與刪除（rotate、merge），以及 2-3 tree、2-3-4 tree 與紅黑樹的關係。接著看資料庫真正用的 B+ tree：資料全在 leaf、leaf 串成 linked list，因此 range query 很快。最後學處理字串的 Trie 與前綴查詢。B-tree 插入刪除的手算、B-tree 與 B+ tree 的差別是考試常客。

## 學完這章要會
- 用 record 大小、block 大小算出一張表佔幾個 block，以及加上 dense／sparse／multi-level index 後查詢要讀幾個 block
- 說出 m-way search tree 節點的三樣東西（key、child pointer、record pointer），以及沒有規則時樹為什麼會長歪
- 背出 order m 的 B-tree 規則：非 root 至少 ⌈m/2⌉ 個 child、root 至少 2 個 child、所有 leaf 同一層；算出每個 node 的 key 數範圍
- 手算 B-tree 與 2-3 tree 的插入：overflow 就 split，連續 split 到 root 時樹長高；分清 left biased 與 right biased
- 手算 B-tree 的刪除：先向兄弟 rotate，借不到就 merge；刪 internal node 的 key 時換成 predecessor 或 successor
- 說明 2-3-4 tree 與紅黑樹的對應
- 說出 B+ tree 改了 B-tree 哪三件事，手算 B+ tree 的單點查詢與 range query
- 畫出 Trie、做前綴查詢、寫出 Trie 的節點，知道什麼題目該用 Trie

## 先懂硬碟：資料以 block 為單位

B-tree 和 B+ tree 是資料庫（database）裡的核心結構。只背插入、刪除的步驟，很容易忘記它為什麼長這樣；它的形狀其實是被硬碟的存取方式逼出來的，所以先從硬碟講起。學習順序：disk structure → indexing → multi-level indexing → m-way search tree → B-tree → B+ tree。

### 硬碟的結構

- 硬碟裡有一張會轉的圓盤，叫 **platter**，資料寫在盤面上。
- 盤面劃成一圈一圈的同心圓，每一圈叫 **track（磁軌）**，由內到外編號 track 0、1、2、3…。這些圓不是真的刻上去的，是邏輯上的分區方式。
- 從中心像切披薩一樣切成扇形，每一塊叫 **sector（磁區）**，也有編號（例如 0～5）。
- 某一個 track 和某一個 sector 交會的那一小格，叫 **block（區塊）**。block 的位址用（track 編號, sector 編號）表示，例如 track 1、sector 0；或 track 2、sector 1。每個 block 都能用這兩個號碼唯一找到。
- block 多大依廠商而定，學習時通常假設 **512 bytes**（一個 byte 大約存一個英文字母）。
- 把一個 block 攤開，裡面 512 個 byte 從第 0 個排到第 511 個，每個 byte 的位置編號叫 **offset**。例如第 2 個 byte 的 offset 就是 2。
- 要找到硬碟上的某一個 byte，需要三樣東西：**track + sector + offset**。

硬碟裝在主軸上旋轉，旁邊有一支磁頭臂，前端的 **head** 負責讀寫：

- 轉動 platter → head 底下經過的 sector 改變，所以**轉盤是用來換 sector**。
- 磁頭臂往內、往外移 → 換到不同圈，所以**移臂是用來換 track**。

> **重點** 硬碟上的資料以 block 為單位存放，也以 block 為單位讀寫：一次一定搬一整個 block，不會只搬 1 個 byte。所以之後估時間，都是在算「讀了幾個 block」。

### 資料要先搬進 main memory

程式在 **main memory（RAM）** 裡執行，不能直接在硬碟上處理資料。要用硬碟上的資料，得先把那個 block 搬進 main memory；處理完、有結果要保存，再寫回硬碟。搬一次很花時間，所以目標很明確：**盡量少讀幾個 block**。

- 在 main memory 裡怎麼安排資料、讓程式快速使用 → **資料結構（data structures）** 在學的。
- 在硬碟上怎麼有效率地存放資料 → **DBMS** 在研究的。

B-tree 剛好把這兩邊接起來。

## 一張表要佔幾個 block

### 例題：employee 表

一張 employee 表有 100 筆 record（每一列是一筆），5 個欄位：

| 欄位 | 大小 |
|---|---|
| ID | 10 bytes |
| name | 50 bytes |
| department | 10 bytes |
| section | 8 bytes |
| address | 50 bytes |
| **合計** | **128 bytes / record** |

1. 一個 block 512 bytes，放得下 512 / 128 = **4 筆** record。
2. 前 4 筆放第一個 block，接下來 4 筆放下一個，依此類推。
3. 100 筆 / 4 = **25 個 block** 存整張表。

現在要找 employee ID = 5 的那筆。問題是不知道它在哪個 block。查詢花多少時間，主要看讀了幾個 block（讀硬碟比在記憶體裡比較慢太多）。沒有任何線索就只能一個一個讀，**最壞要讀完 25 個 block**。要更快，就建 index。

## Index（索引）：從 25 次降到 5 次

index 就像書最後面的索引頁：關鍵字對到第幾頁。

- 每個 entry 存一個 **key**（這裡是 employee ID），再配一個 pointer，指向那筆 record 所在的 block。這種指到 record 的指標叫 **record pointer**。
- 表裡每一筆 record 在 index 裡都有自己的 entry，這叫 **dense index（密集索引）**。
- index 本身也要存在硬碟上，所以它**也會佔 block**。

### 例題：index 要幾個 block、查一次讀幾個 block

1. 一個 entry = ID 10 bytes + record pointer 6 bytes（假設）= **16 bytes**。
2. 100 筆 record → 100 個 entry。
3. 一個 block 放 512 / 16 = **32 個 entry**。
4. 100 / 32 = 3.125，三個 block 放不下；block 只能整塊使用，所以進位成 **4 個 block**。index 才 4 個 block，比整張表的 25 個小很多。
5. 查詢：先在 index 找 key，最多讀 4 個 index block；找到 entry 後，用 record pointer 直接讀資料所在的那 1 個 block。

```
沒有 index：最壞 25 次 block 存取
有 index ：4（index）+ 1（資料）= 5 次 block 存取
```

## Multi-level index（多層索引）：幫 index 再建 index

如果 index 本身也越來越大呢？假設資料變成 1000 筆：

- 表要 1000 / 4 = 250 個 block。
- index 有 1000 個 entry，1000 / 32 = 31.25 → 細算約 **32 個 block**。為了好算，常直接取整數假設 index 佔 **40 個 block**。

光在幾十個 block 的 index 裡找就很慢了，那就**幫 index 再建一層 index**：

- 上一層不必對每個 entry 都放一筆，而是**下一層的每個 block 放一筆**。下層一個 block 有 32 個 entry，上層一個 entry 就管這一整塊。
- 例如上層第一筆 key 是 1，指向第一個 index block；下一筆 key 是 33，因為第一塊裝了 1～32。
- 這種不是每筆 record 都有 entry 的 index，叫 **sparse index（稀疏索引）**。

### 例題：兩層 index 的存取次數

照「index 佔 40 個 block」的假設：

1. 上層有 40 個 entry（每個 index block 一筆），一個 block 放 32 個 → 上層只要 **2 個 block**。
2. 查詢：上層讀 2 個 + index 讀 1 個 + 表讀 1 個 = **4 次** block 存取。

> **陷阱** 1000 個 entry 的 index 細算是 1000 / 32 = 31.25 → 32 個 block，「40 個 block」只是取整數好講。照 32 個 block 算，上層 32 個 entry 剛好 1 個 block，查詢是 1 + 1 + 1 = 3 次。不論哪個數字，結論相同：多蓋一層 index，block 存取就更少。

## 多層 index 轉過來就是一棵樹

把多層 index 畫出來：最底下是資料表，上面是主 index，每個 entry 指向一組 record；主 index 太大，就在上面加一層，每個 entry 指向下一層的一組 entry；這層也太大，再往上加一層。表越長越大，index 就一層一層往上加，存取的 block 數就壓下來了。

```
        [上層 index]
        /    |     \
  [index] [index] [index]      ← 主 index
   / | \   / | \   / | \
  資料表的各個 block
```

把這張圖轉 90 度來看：最上面一個入口，往下分岔，這就是一棵 **tree**。

問題是：難道要有人一直盯著資料庫，表太大就手動加一層？我們希望**表變大時自動加一層、資料刪掉表變小時自動拿掉一層**，這叫 **self-managed multi-level index**（自己管理層數的多層索引）。

> **重點** B-tree 和 B+ tree 就是會自己長高、自己變矮的多層 index。它們都是從 m-way search tree 演變而來。從 index 一路講到 B-tree，就是為了把 B-tree 和 database 連起來。

## m-way search tree

### 從 BST 推廣

回想 **binary search tree（BST）**：每個 node 放 1 個 key，最多 2 個 child（所以叫 binary）；找東西從 root 開始，比較小往左、比較大往右。例如找 15：15 比 10 大往右，比 20 小往左，找到。

一個 node 能不能放兩個 key、有三個 child？可以。例如 node 放 20 和 50：

```
            [20 | 50]
          /     |     \
     [10,15] [30,35] [60,90]
      < 20   20～50    > 50
```

- 比 20 小的（10、15）放最左邊的 child。
- 介於 20 和 50 之間的（30、35）放中間。
- 比 50 大的（60、90）放右邊。

道理跟 BST 一樣，所以它也是 search tree。搜尋 30：30 > 20 且 30 < 50，走中間 child，找到。每個 node 多比幾次，方法不變。這個例子每個 node 最多 2 個 key、最多 3 個 child，叫 **3-way search tree**。

> **重點** **m-way search tree**：每個 node 最多 m 個 child、m − 1 個 key，m 也叫 **degree**。BST 就是 degree 2 的 m-way search tree。degree 可以是 100、甚至 1000；degree 100 的 node 放 99 個 key，剛好可以塞滿一個硬碟 block。

### 節點裡的三樣東西

BST 的 node：中間放資料，兩邊各一個 child pointer。m-way 要更多 child pointer。以 4-way 為例，4 個 child、3 個 key：

```
cp | K1 | cp | K2 | cp | K3 | cp
```

（cp = child pointer）m 個 child pointer 之間夾著 m − 1 個 key 的位置；在硬碟上，每個 cp 指向一個 block。

拿它當資料庫的 index 時，每個 key 後面還要多一個 **record pointer（rp）**，指向資料庫裡那筆 record（index 本來就是用 key 找資料）。樹本來就有很多層，所以 m-way search tree 天生就能做多層 index。

> **重點** 節點三樣東西：**key、child pointer、record pointer**。degree 4 → 4 個 cp、3 個 key、3 個 rp。

### 沒有規則，樹會長歪

直接拿 m-way search tree 當 index 會出問題。以 10-way search tree（每個 node 最多 10 個 child、9 個 key）為例：

1. 插入 10：建一個 node 放 10，這個 node 還有 8 個空位。
2. 插入 20：明明還有空位，卻另開一個 child 放 20。
3. 插入 30：又往右再開一個 node。

```
[10]
    \
    [20]
        \
        [30]
```

樹變成一條往下斜的線，很浪費。應該先把一個 node 填滿再開新的，可是 m-way search tree **沒有任何規定**，愛怎麼插就怎麼插。最壞情況 n 個 key 長成 n 層，搜尋一層一層往下，退化成 **linear search**。

問題出在建樹的過程沒有規範。把規則加上去，m-way search tree 就變成 **B-tree**。

## B-tree 的規則

B-tree = **加上規則的 m-way search tree**。order（階數）m 就是一個 node 最多幾個 child，所以 order m 的 B-tree 也是一棵 m-way search tree。

1. **每個 node 至少半滿**：非 root 的 internal node 至少要有 **⌈m/2⌉** 個 child。注意是 ceiling（無條件進位），不是 floor，例如 ⌈5/2⌉ = 3。degree 10 的話，非 root 的 internal node 隨時都要至少 5 個 child。
2. **root 例外**：規則一套不到 root 上——第一個 key 插進去時 root 只有 1 個 key，馬上違規。所以 root 至少 **2 個 child** 就好，也就是 root 可以只有 1 個 key（整棵樹只有 root 一個 node 時除外）。
3. **所有 leaf 都在同一層**，所以每次搜尋走的層數都一樣。
4. **建法是 bottom-up**：key 一律先進 leaf，滿了就 split 往上送，樹是從 root 那端長高的。

建 m-way search tree 時守住這些規則，其實就是在建 B-tree。

> **陷阱** ⌈m/2⌉ 不是「目前 node 半滿才能開下一個 node」的建立順序，而是**每個非 root 的 internal node 隨時都要守的 child 數下限**，用來控制高度。leaf 沒有 child，不套這條 child 下限。

### 用 order 4 把規則算一遍

- 一個 node 有 4 個 pointer 的位置，中間只夾得下 3 個 key → 最多 m − 1 = **3 個 key**，由小排到大。
- 已經 3 個 key，第 4 個又擠進來 → **overflow**，要 **split（分裂）**。
- 下限：internal node 至少 ⌈4/2⌉ = 2 個 child → 至少 1 個 key。
- 合起來：order 4 的 B-tree，每個 node 有 **1～3 個 key**。

> **重點** 一般式：非 root 的 node，key 數介於 **⌈m/2⌉ − 1** 到 **m − 1** 之間；root 至少 1 個 key。

> **陷阱** 下限寫成 m/2 在 m = 4 時剛好整除看不出差別；m 是奇數時會差 1，一定要取上整 ⌈m/2⌉，而且 root 例外。

插入時找位置跟 BST 一樣：從 root 開始比大小走到 leaf，只是一個 node 裡有好幾個 key 要比。

### 2-3 tree 與 2-3-4 tree

B-tree 有兩個常見的小名（這裡的 order 都是 B-tree 的 order）：

| order | 名稱 | 每個 node 的 key 數 | child 數 |
|---|---|---|---|
| 3 | **2-3 tree** | 1～2 | 2～3 |
| 4 | **2-3-4 tree** | 1～3 | 2～4 |

2-3 tree：最多 3 個 child、2 個 key；root 至少 2 個 pointer 往下指（除非整棵樹只有它一個 node）；非 root 的 node，child 至少 ⌈3/2⌉ = 2。例如一棵 2-3 tree 的 root 下有 node B、C：B 有 2 個 key，所以有 3 個 pointer；C 有 1 個 key，有 2 個 pointer，都符合「至少 2 個」。每個 node 不是 2 個 child 就是 3 個，所以叫 2-3 tree。

## 搜尋：四種情況

搜尋跟 BST 一樣，從 root 比大小決定往哪個 child 走。差別是 2-3 tree 的一個 node 裡可能有兩個 key：**first key** 和 **second key**，要找的 x 跟這兩個比。以 root = [20, 40] 為例：

| 情況 | 條件 | 動作 | 例子 |
|---|---|---|---|
| 一 | x < first key | 走 left child | 找 10：10 < 20，走左邊 |
| 二 | first key < x < second key | 走 middle child | 找 30：20 < 30 < 40 |
| 三 | x > second key | 走最右邊的 pointer | 找 80：80 > 40 |
| 四 | x 等於某個 key | 找到 | 找 40：在 root 就找到 |

## 插入：滿了就 split，樹往上長

### 例題：degree 4，依序插入 10、20、40、50、60、70、80、30、35、5、15

這題 split 時送**第 3 個 key** 上去（左邊留 2 個）。

1. 插入 10：樹是空的，建一個 node 放 10。10 有左右兩個 child pointer；當 index 用還有一個 record pointer 指向資料。
2. 插入 20、40：依大小排在後面 → `[10, 20, 40]`，node 滿了。
3. 插入 50：照大小應排最後，但已經 3 個 key，硬塞就是 `[10, 20, 40, 50]`，overflow。split：開一個新 node，10、20 留左邊，50 去右邊，**40 送上去當 root**。

```
      [40]
     /    \
[10,20]   [50]
```

新的一層出現在最上面，樹是往上長的，這就是 **bottom-up**。對照多層 index：leaf 這層是第一層 index，上面這層就是自動長出來的第二層。

4. 插入 60：比 40 大，走右邊 → `[50, 60]`。插入 70 → `[50, 60, 70]`，滿了。
5. 插入 80：該進右邊 node 但沒空間 → split：50、60 留左邊，80 去右邊，**70 送到 root**，root 變成 `[40, 70]`。

```
         [40 | 70]
        /    |    \
  [10,20] [50,60] [80]
```

6. 插入 30：比 40 小，走最左邊 → `[10, 20, 30]`，滿了。
7. 插入 35：也走最左邊，沒位置 → `[10, 20, 30, 35]` split：10、20 留左邊，35 去右邊，**30 往上送**，root 變成 `[30, 40, 70]`，下面掛 4 個 child。

```
            [30 | 40 | 70]
          /     |     |     \
    [10,20]  [35]  [50,60]  [80]
```

規律：node 滿了又有 key 要進來，就分裂，把一個 key 送到 parent。

### 連續 split

8. 插入 5：比 30 小，走最左邊，排最前面 → `[5, 10, 20]`，滿了。
9. 插入 15：進同一個 leaf → `[5, 10, 15, 20]`，沒空間。split：5、10 留左邊，20 在右邊，**15 往上送**。
10. parent 本來是 `[30, 40, 70]`，加上 15 變成 `[15, 30, 40, 70]`，**也爆了**。parent 再 split：15、30 留左邊，70 在右邊，**40 往上當新的 root**，樹又高一層。分裂後 child 連結也要跟著改，例如 70 的左邊接 `[50, 60]`，右邊接 `[80]`。

```
                  [40]
             /            \
        [15 | 30]          [70]
       /    |    \        /    \
  [5,10]  [20]  [35]  [50,60]  [80]
```

插入的過程中，樹自己長出了三層 index，高度一層層往上加，跟 multi-level index 一模一樣；而且有規則管著，所有 leaf 都在同一層，看起來就是一層層整齊的 index。

### left biased 與 right biased

4 個 key 要 split 時，中間有兩個可以選：

- 送**第 3 個**上去 → 左邊留比較多，叫 **left biased**。
- 送**第 2 個**上去 → 右邊留比較多，叫 **right biased**。

兩種都合法，但長出來的樹不一樣。

> **陷阱** 考試要照題目規定送哪一個。課本常用的慣例是送第 ⌈m/2⌉ 個；order 4 就是第 2 個。

### 例題：order 4，送第 2 個 key，依序插入 5、3、21、9、1、13、2、7、10、12、4

**插入 5、3、21、9（第一次 split）**

1. 樹是空的，5 直接當 root。只有一個 node 時，它同時是 root 也是 leaf。
2. 插入 3：比 5 小排前面 → `[3, 5]`。node 裡的 key 永遠由小到大。
3. 插入 21：排最後 → `[3, 5, 21]`，三格滿了。
4. 插入 9：該在 5 和 21 中間 → `[3, 5, 9, 21]`，overflow。4 個是偶數，中間兩個 5 和 9 都能選；這裡選 5（第 ⌈4/2⌉ = 2 個）。沒有 parent，就開新 root 放 5：

```
    [5]
   /   \
 [3]  [9,21]
```

樹長高一層，而且是從 root 那端長的，所以 leaf 永遠在同一層。

**插入 1、13、2、7（9 往上）**

每次都從 root 比起：

1. 插入 1：比 5 小往左，比 3 小排前面 → `[1, 3]`，還有空位。
2. 插入 13：比 5 大往右，夾在 9 和 21 中間 → `[9, 13, 21]`，滿了。
3. 插入 2：往左，排在 1 和 3 中間 → `[1, 2, 3]`，左邊也滿了。
4. 插入 7：比 5 大往右，排最前面 → `[7, 9, 13, 21]`，overflow。送第 2 個：**9 進 parent**，parent 變 `[5, 9]`；左邊留 `[7]`，右邊是 `[13, 21]`。

```
          [5 | 9]
        /    |    \
  [1,2,3]   [7]   [13,21]
    < 5    5～9     > 9
```

root 的兩個 key 切出三個區間：小於 5、5 到 9 之間、大於 9，各掛一個 child。

**插入 10、12（12 往上）**

1. 插入 10：10 > 9 走最右邊；在 13、21 裡它最小，排最前面 → `[10, 13, 21]`，又滿了，再來一個就要 split。
2. 插入 12：一樣走最右邊，排在 10 和 13 中間 → `[10, 12, 13, 21]`，overflow。第 2 個 key **12 往上送**，root 變成 `[5, 9, 12]`。

```
           [5 | 9 | 12]
         /    |    |    \
  [1,2,3]   [7]  [10]  [13,21]
```

root 也滿了，下次再有 key 送上來，root 也得分裂。

**插入 4（一路分裂到 root）**

1. 4 比 5 小，走最左邊到 `[1, 2, 3]`，排最後 → `[1, 2, 3, 4]`，overflow。
2. split 這個 leaf：**2 往上送**，左邊留 `[1]`，右邊是 `[3, 4]`。
3. parent 本來就有 3 個 key，加上 2 變成 `[2, 5, 9, 12]`，parent 也爆了——這就是**連續 split**。
4. parent 再分裂，第 2 個 key **5 往上**。它已經是 root，就新開一個 root 放 5。這次插入一共分裂兩次。原本接在舊 root 底下的 child 也跟著搬到新的兩個 node 底下。

```
                [5]
            /          \
         [2]           [9 | 12]
        /   \         /   |    \
     [1]  [3,4]    [7]  [10]  [13,21]
```

5 的左邊是 `[2]`，2 底下是 `[1]` 和 `[3, 4]`；5 的右邊是 `[9, 12]`，底下三個 child 是 `[7]`、`[10]`、`[13, 21]`（`[10]` 夾在 9 和 12 中間，是 9 的右邊，不是左邊）。

完成：order 4，每個 node 1～3 個 key，所有 leaf 在同一層。

> **重點** B-tree **只有 root 分裂時才會長高**，所以 leaf 永遠在同一層。

## 2-3 tree 的插入：三個準則與連鎖反應

先像 search 一樣找到該放的 node，叫它 **u**，u 一定是 leaf。放進 u 有兩種情況：

1. u 只有 1 個 element，還有空位 → 直接放。
2. u 已經 2 個 element，滿了 → **split**。

split 時，原本 2 個加新來 1 個，共 3 個數字，照三個準則：

- **準則一**：開一個新 node，放**最大**的。
- **準則二**：**中間**那個 insert 到 u 的 **parent**。
- **準則三**：**最小**的留在原本的 u。

### 例題：插入 60，連鎖反應

原本的樹：root A = [20, 40]，最右邊的 leaf C = [70, 80]，共 4 個 node。左、中兩個 leaf 依搜尋例子（找 10 走左、找 30 走中）畫成 [10]、[30]（示意）。

```
        A[20 | 40]
       /    |     \
    [10]  [30]   C[70,80]
```

1. 插入 60：60 > 40，走最右邊落在 C → C = `[60, 70, 80]`，三個數字超過上限，要 split。
2. 最大的 80 進新 node，中間的 **70 往 parent 走**，最小的 60 留在 C。
3. C 的 parent 是 A。70 放進去，A = `[20, 40, 70]`，也三個了，A 也要 split，同樣三個準則再做一次。
4. A 的中間是 **40**，往上送；A 是 root 沒有 parent，就產生**新的 root [40]**，樹高 + 1。

```
              [40]
           /        \
       A[20]        [70]
       /   \        /   \
    [10]  [30]   C[60]  [80]
```

下面 split 送上去，又讓上面 split，叫 **連鎖反應（chain reaction）**，最壞一路 split 到 root。

數 node：原本 4 個，C 分裂 + 1、A 分裂 + 1、新 root 再 + 1，現在 7 個。

> **重點** internal node 的 pointer 數**永遠是 key 數 + 1**，畫圖時不要少畫一根。

問：60 存在哪裡？
答：插入一律先進 leaf，所以 60 就在最底層的 leaf C 裡。

> **陷阱** 「真正的數值都存在 leaf」是 **B+ tree** 的性質。在 B-tree（包括 2-3 tree）裡，上層的 key 也是資料本身；被 split 送上去的 70、40 就只存在上層。

## B-tree 當 index：每個 key 都有 record pointer

回到資料庫：每個 node 有指向 child 的 pointer，也有 record pointer；而且**每個 key 都有自己的 record pointer，不管它在哪一層**。這些 pointer 指到硬碟上的 record，所以 B-tree 很適合拿來實作 multi-level index。

> **重點** B-tree 的 node = **key + child pointer（也叫 block pointer）+ record pointer**。

## 刪除：先向兄弟借，借不到就合併

insert 太滿會 split；delete 太空就要 **merge**——node 被刪到一個 key 都不剩，就得調整。以下用 2-3 tree 示範。

### 刪完沒空就沒事

(a) 原本的樹：

```
          A[50 | 80]
        /     |      \
  B[10,20] C[60,70] D[90,95]
```

(b) 刪 70：50 < 70 < 80，走中間到 C，把 70 刪掉。C 還剩 60，每個 node 都至少 1 個 key，合法，不用調整。

(c) 再刪 90：比 80 大，走最右邊到 D，刪掉。D 還剩 95，一樣沒事。

```
          A[50 | 80]
        /     |      \
  B[10,20]  C[60]   D[95]
```

> **重點** 簡單的刪除：刪完 node 沒空掉，就不用動。

### 刪 60：向兄弟借（rotate）

1. 60 在 C，刪掉後 C 變成 0 個 key，不合法。
2. 直接把空 node 回收，整棵樹要大改，是大工程，所以**先找旁邊的兄弟借**。
3. 左邊兄弟 B 有 10、20 兩個，借一個也不會空，可以做 **rotate**：parent 的 **50 往下推到 C**，B 最大的 **20 往上送到 parent**。

```
          A[20 | 80]
        /     |      \
     B[10]  C[50]   D[95]
```

大小順序都還對。

### 刪 95：借不到就合併（combine / merge）

1. 95 在 D，刪掉後 D 也空了。
2. 不能 rotate：兄弟 C 只有 50 一個，借出去自己就空了。
3. **combine**（也叫 merge）：parent 的 **80 往下推**，跟 C 的 50 合成 `[50, 80]`，空的 D 刪掉。

```
        A[20]
       /     \
    B[10]  C[50,80]
```

parent 少一個 key，也少一個 child。如果 parent 因此也空了，就在上一層再借或再合併；一路併到 root 被拿光，**樹高減 1**。

> **重點** 兄弟借得起（有 2 個 key）→ rotate；兄弟借不起 → merge：parent 夾在中間的那個 key 下來，跟兄弟併成一個 node。

### Rotate 的三種 case

看空掉的 node **p** 是 parent **r** 的哪一個 child。r 有兩個 key x、z；q 是 p 旁邊、有 2 個 key 的兄弟；a、b、c、d 是掛在下面的 subtree。每次 rotate 只動到三個數字，前提是兄弟要有 2 個數字才借得起。（下圖中 q 的另一個 key 標成 w，示意）

**case 1：p 是 r 的 left child**，跟右邊的兄弟 q 借。x 往下推到 p，q 最小的 y 往上提到 r，r 變成 [y, z]，大小順序沒亂。

```
調整前                         調整後
      r[x | z]                      r[y | z]
     /    |    \                   /    |    \
  p[ ]  q[y,w]  ...             p[x]  q[w]   ...
   |    / | \                   / \    / \
   a   b  c  d                 a   b  c   d
```

**case 2：p 是 r 的 middle child**，跟右邊的兄弟 q 借。r 的第二個 key z 往下推到 p，q 最小的 y 往上提到 r。

```
調整前                         調整後
      r[x | z]                      r[x | y]
     /    |    \                   /    |    \
   ...  p[ ]  q[y,w]             ...  p[z]  q[w]
         |    / | \                   / \    / \
         a   b  c  d                 a   b  c   d
```

**case 3：p 是 r 的 right child**，只能跟左邊的兄弟 q 借。z 往下推到 p，q 最大的 y 往上提到 r，x 不動。

```
調整前                         調整後
      r[x | z]                      r[x | y]
     /    |    \                   /    |    \
   ...  q[w,y]  p[ ]             ...  q[w]  p[z]
        / | \    |                    / \    / \
       a  b  c   d                   a   b  c   d
```

> **陷阱** 搬完 key 之後，下面掛的 subtree（a、b、c、d）也要接到對的 node，**由左到右的順序一定要對**；最後確認每根 pointer 都指到調整過的 node。

### 要刪的 key 在 internal node

要刪的 key 不在 leaf、而在 internal node 時，先找**替身**換上去：左子樹最大的 **predecessor**，或右子樹最小的 **successor**。例如 internal node 裡的 60，左子樹最大是 50，就先把 60 換成 50，再去 leaf 把原本那個 50 刪掉。這樣刪除永遠變成「從 leaf 刪」，之後照 rotate 或 merge 處理就好。

### 例題：刪除 internal node 的 key（示意）

在前面 degree 4 例題建好的樹（每個 node 1～3 個 key）刪 70：

```
                  [40]
             /            \
        [15 | 30]          [70]
       /    |    \        /    \
  [5,10]  [20]  [35]  [50,60]  [80]
```

1. 70 在 internal node。左子樹最大的是 60（predecessor），把 70 換成 60。
2. 去 leaf `[50, 60]` 刪掉 60，剩 `[50]`，仍有 1 個 key，合法，不用再調整。

```
                  [40]
             /            \
        [15 | 30]          [60]
       /    |    \        /    \
  [5,10]  [20]  [35]    [50]   [80]
```

## 2-3-4 tree 與紅黑樹

- 2-3 tree 是 order 3；**2-3-4 tree** 是 order 4，一個 node 最多 3 個 key、4 個 pointer。
- 2-3-4 tree 的高度介於 **log₄(n+1)** 和 **log₂(n+1)** 之間：每個 node 都分 4 岔時最矮，都只分 2 岔時最高。

2-3-4 tree 比 2-3 tree 好的地方：

1. 插入可以 **top-down**：往下走時就先把滿的 node 拆掉，insert / delete 的調整只發生一次，不會像 2-3 tree 回頭一路連鎖反應到 root。
2. 表示方法很有效率，可以改寫成 **red-black tree（紅黑樹）**。紅黑樹仍然是 binary tree：一個有 3 個 key 的 node，拆成中間黑、兩旁紅的三個小 node。

```
2-3-4 tree 的 node        紅黑樹
   [a | b | c]              b（黑）
                           /     \
                       a（紅）  c（紅）
```

> **陷阱** 資料結構這段至少要懂 2-3 tree，2-3-4 tree 的插入刪除可當補充；但「2-3-4 tree ↔ 紅黑樹」的對應在演算法很常考，要記住。

## Range search 與 B+ tree 的動機

前面的 search 都是找「一個值」。但很多查詢要的是一堆值，例如：把學期平均 ≥ 80 分的學生全部列出來。這種有範圍的查詢叫 **range search**（範圍搜尋，也叫 range query）。

最笨的方法：80 search 一次、81 search 一次、82 search 一次……一路到 100，要下二十幾次 search，太慢。

**B+ tree** 跟 B-tree 很像，差別在：最底層的 leaf node 用 linked list（鏈結串列）串起來。找到 80 之後，沿著串列往右走，後面所有的值就都拿到了。

### 在資料庫裡：B+ tree 就是 index

在 database 裡，B+ tree 就是所謂的 **index**（索引）結構。

- index 裡的 key：K1、K2 … Kn，是拿來比大小的數值。
- 每個 key 對應一個 pointer，指到 disk 上的一個 **page**（一塊資料區）。
- page 裡放的是 **record**，也就是資料庫裡的資料，例如學生的成績資料。

> **觀念** database 課教的是怎麼存、怎麼取資料，以及怎麼從 ER model 設計 relation，不只是教裝 MySQL。到 Oracle 這類資料庫公司，要實作的正是 index structure 這種底層的東西。

## B+ tree 把 B-tree 改了三件事

拿前面依序插入 10、20、40、50、60、70、80、30、35、5、15 長出來的那棵 order 4 B-tree，稍微改一下就是 B+ tree。原本那棵 B-tree：

```
              [40]
          /          \
     [15 30]          [70]
     /  |  \          /   \
 [5 10] [20] [35]  [50 60] [80]

B-tree：每個 key（不管在哪一層）都帶自己的 record pointer
```

改成 B+ tree：

```
                  [40]
             /            \
       [15 30]             [70]
       /  |  \             /   \
 [5 10]→[15 20]→[30 35]→[40 50 60]→[70 80]

上層：只有 key + child pointer（指路用）
leaf：所有 key，每個都有 record pointer，串成 linked list
```

1. **record pointer 只從 leaf 出來**：上層（非 leaf）node 只剩 key 和 child pointer，不放 record pointer。
2. **上層的每個 key 在 leaf 都要有一份副本（copy）**：15 在上層，所以 leaf 裡也放一個 15，帶著 record pointer，跟 20 在一起；30 下到 leaf，跟 35 在一起；40 下到 leaf，跟 50、60 在一起（三個都有 record pointer）；70 也下到 leaf，跟 80 在一起。結果：樹裡的每個 key 一定都會出現在 leaf。
3. **leaf 在同一層，像 linked list 一樣串起來**，可以從左一路走到右。

### dense index 與 sparse index

- leaf 層包含所有 key，每筆都有 record pointer，是 **dense index**（密集索引）。
- 上面幾層只負責指路，是 **sparse index**（稀疏索引）。

所以 B+ tree 比 B-tree 更像一個 **multi-level index**（多層索引），這就是「plus」多出來的地方。懂了 B-tree，B+ tree 就不難。

> **重點** B-tree vs. B+ tree：① B+ tree 所有 key 都在 leaf，非 leaf 的 key 只是指路用的副本；② record pointer 只從 leaf 出來；③ leaf 在同一層，串成 linked list。

> **陷阱** B+ tree 插入時 leaf 分裂：中間的 key 是「複製」上去，leaf 裡仍保留這個 key（因為所有 key 都要在 leaf）；上層的 index node 分裂時，中間的 key 才是「移」上去（不留在原 node）。B-tree 則一律是移上去。

B-tree 和 B+ tree 還有很多分析可以做，是個大主題；這裡的目的是把 B-tree／B+ tree 和 database 的 index 連起來。

## B+ tree 的 order 與例子（order d = 1）

資料庫實際用的 B+ tree：

- 也是 m-way 的樹，一個 node 的 pointer 可以超過兩個。
- 是 **balanced** tree：所有 leaf 都在同一層，每次搜尋走的層數一樣。

### B+ tree 的 order d

在 B+ tree 裡，**order d** 的意思是：每個非 root 的 node 至少 d 個 entry、最多 2d 個（entry 就是 node 裡的 key 值）。d = 1 就是每個 node 1 到 2 個 key。

> **陷阱** B+ tree 的 order 定義跟 B-tree 不一樣。B-tree 的 order m 是「一個 node 最多幾個 child」；這裡的 order d 是「非 root node 最少幾個 key」（最多 2d 個）。看題目用的是哪一種。

### 例子：order d = 1 的 B+ tree

key 是每個人的年紀，用「年紀」這個欄位建 index：

```
                         [40]
               /                     \
          [20 33]                    [51 63]
         /   |    \                 /   |    \
  [10* 15*]⇄[20* 27*]⇄[33* 37*]⇄[40* 46*]⇄[51* 55*]⇄[63* 97*]
```

- root 是 40，只有 1 個 entry（root 可以少於 d）。
- 下一層 [20, 33] 和 [51, 63] 各有 2 個 entry，剛好是上限 2d = 2。
- leaf 裡的數字後面有個 `*`，例如 `63*`：`*` 代表一個 pointer。`63*` 的意思是「年紀 63 的那個人，資料在這個 pointer 指到的 disk record」。
- 上面 internal node 裡的 63 只是拿來比大小、指路的鍵值，資料不在那裡；上面每個數字在 leaf 都有對應的 pointer（資料的 pointer 全在 leaf）。
- leaf 用 **doubly linked list**（雙向鏈結串列）串起來，往前、往後都能走，等於 linked list 和 tree 的混搭。

好處：年紀 < 40 的值全在 root 左邊的 subtree，搜尋範圍一下就被限定住；≥ 40 的都在右邊。同樣的道理遞迴下去：介於 20 和 33 之間的值，都在 [20, 33] 中間那棵小 subtree。

### 例題：找 key 27（年紀 27 的人，資料在哪？）

從 root 開始比，跟以前在 search tree 找一個 key 一樣：

1. 27 < 40 → 走 root 的左邊。
2. 到 [20, 33]：20 ≤ 27 < 33 → 走中間的 pointer。
3. 到 leaf [20*, 27*]，有 27 → hit！跟著 `27*` 的 pointer 拿到資料。

> **陷阱** B+ tree 就算在上層看到一樣的 key 也不停，一定要走到 leaf 才拿得到資料（上層沒有 record pointer）。

所以 B+ tree 一樣能做單一值的 search；它真正的強項是接下來的 range query。

## B+ tree 的節點格式

```
| P0 | K1 | P1 | K2 | P2 | … | Kn | Pn |
```

一個 node 有一排 key K1、K2 … Kn，中間穿插 pointer P0、P1 … Pn，pointer 比 key 多一個。

1. 跟 B-tree 一樣，key 排好序：K1 < K2 < … < Kn。
2. 非 root 的 node，key 的個數 n 必須滿足 **d ≤ n ≤ 2d**，d 就是 B+ tree 的 order。例如 d = 2，每個非 root node 有 2 到 4 個 key。
3. root 的 key 個數至少 1 個、最多 2d 個。

搜尋就是跟著 pointer 比大小往下走，跟 B-tree 很像；一路走到 leaf，找到 `ki*`，`*` 就是指向 record 的 pointer。

## order 2 的 B+ tree：單點查詢與 range query

一棵 order d = 2 的 B+ tree，root 有 4 個 key，下面 5 個 leaf 串起來：

```
                     [13 | 17 | 24 | 30]
          /        /        |         \          \
 [2* 3* 5* 7*]⇄[14* 16*]⇄[19* 20* 22*]⇄[24* 27* 29*]⇄[33* 34* 38* 39*]⇄ null
```

（每個 leaf 有 2 ～ 4 個 key，符合 d ≤ n ≤ 2d；root 有 4 = 2d 個。）

三個查詢：Q1 年紀 5、Q2 年紀 15、Q3 年紀 ≥ 24 的所有資料。

### Q1：找 5

5 跟 13、17、24、30 比：5 < 13 → 走最左邊的 pointer。leaf 裡有 2、3、5、7 四筆，其中就有 5，找到了。

### Q2：找 15

13 ≤ 15 < 17 → 走 13 和 17 中間的 pointer。那個 leaf 只有 14、16，沒有 15 → **no return**（找不到，不回傳資料）。

> **陷阱** 這個 leaf 是 [14*, 16*]；13 是 root 裡的分隔 key，不在這個 leaf。

### Q3：找年紀 ≥ 24 的全部（range query）

1. 先 search 24：在 root 比到 24 ≤ 24 < 30 → 走 24 和 30 中間的 pointer。
2. 到 leaf，找到 24。
3. 關鍵：leaf 是由小到大串起來的，所以從這裡往右串出去的值一定都 ≥ 24。沿著 linked list 一直往右走，經過的都拿出來，走到 null 就停。

```
[24* 27* 29*] → [33* 34* 38* 39*] → null
結果：24, 27, 29, 33, 34, 38, 39
```

### 延伸：< 24 和 15 ～ 24

- **< 24**：一樣先找到 24 所在的 leaf，再沿著 linked list 往左走，經過的（22、20、19、16、14、7、5、3、2）都 < 24。往左走要靠 **doubly** linked list，這就是 leaf 用雙向串列的原因。
- **15 ≤ x ≤ 24**：只要 search 一次，找到 15 該在的 leaf，再沿著 linked list 往右掃，碰到 > 24 的就停：

```
search 15 → leaf [14* 16*]：14 < 15 跳過，16 ✓
→ [19* 20* 22*]：19 ✓ 20 ✓ 22 ✓
→ [24* 27* 29*]：24 ✓，27 > 24 停
結果：16, 19, 20, 22, 24
```

> **陷阱** 範圍查詢 15 ～ 24 不需要做兩次 search（找 15、再找 24）。往下走一次找到起點，之後沿 leaf 掃到超出範圍為止。

> **重點** B+ tree 做 range query：大於、小於、介於兩值之間都一樣快——從 root 往下走一次找起點，之後沿著 leaf 的 linked list 掃。B-tree 就沒這麼漂亮：資料散在各層，要做 inorder traversal，在樹裡上上下下地走。

## 延伸：R-tree 與空間查詢

B+ tree 比 B-tree 多了 range search 的能力。再往下延伸是 **R-tree**。

- 剛才的 key 是年紀，一個數字就能表示，這叫**一維**（1-D）資料。
- **二維**資料：例如路上的景點，要用經度、緯度兩個數字表示位置。
- 查詢例子：以交大為中心，把半徑 5 公里內的景點全部找出來。

笨方法：用經度建一棵 B+ tree、用緯度再建一棵，各做一次 range query，再把兩個結果**取交集**（intersection）。

> **陷阱** 兩棵 B+ tree 的結果要取交集，不是 union：景點必須經度、緯度都落在範圍內。

厲害的方法是 R-tree（1984 年提出）：用矩形把位置相近的點分成一組，查詢時只看和查詢範圍重疊的矩形。它專門處理**空間資料**（spatial data）的查詢，還能推廣到**多維度**（multidimensional）空間。這部分屬於補充。

## Trie：路徑就是字串

**trie**（唸作 try）就是一棵樹。學校課程不太花時間教，演算法課本也講得不多，但面試非常常考。

- 最常拿來存字元：每個節點只放一個字元。
- 從 root 往下走到某個節點，沿路的字元串起來就是一個字串（單字或前綴）。例如 root → c → a 是「ca」，只是單字的一部分；再走到 r，就是完整單字「car」。
- 字串就是一條路徑，所以查「某個字串在不在」只要沿路往下走：長度 L 的字串只走 L 步。

### 例題：前綴查詢（prefix query）

把一個小字典存進 trie：car、card、care、cat、call、calm、do、dog。共同的開頭（例如 ca）只存一次。下圖 ● 表示「有單字在這裡結束」。

```
            root
           /    \
          c      d
          |      |
          a      o●          (do)
        / | \    |
      r●  t●  l  g●          (car)(cat)(dog)
     / \      | \
    d●  e●    l● m●          (card)(care)(call)(calm)
```

問：有沒有以 C-A-R 開頭的單字？從 root 依序走 c → a → r：

1. 走得到 r，而且 r 有標記 → car 本身就是一個完整單字。
2. r 底下還有 d、e → 還有 card、care。整棵 r 子樹就是「以 car 開頭」的所有單字。

car 同時是完整單字，也是別的單字（card、care）的前綴（prefix）。只走 3 步就知道答案。

> **重點** trie 的查詢時間只跟字串長度 L 有關（L 步），跟字典裡有多少單字無關，所以前綴查詢非常快。

## Trie 的節點怎麼寫

實作上要寫一個 `Node` class。它不像 binary search tree 的節點只有 left、right 兩個指標，因為一個字母後面可能接很多種字母。children 有兩種存法：

| 做法 | 怎麼找 child | 缺點／優點 |
|---|---|---|
| 陣列 | 英文小寫 26 格，`children[ch - 'a']` 直接找 | 大部分格子是空的，浪費空間 |
| lookup table（例如 hash map） | 字元 → 子節點，只存真的存在的 child | 更常見；可以直接問「有沒有 A 這個 child？」有就馬上拿到 |

光知道「有 R 這個 child」還不夠，還要知道走到這裡是完整單字還是只是前綴。所以每個節點再加一個 flag，例如 `isCompleteWord`：走到 car 的 r 是 true，走到 ca 的 a 是 false。

### 程式碼（示意）

以下是依上面描述寫成的最小版本（hash map 存 children ＋ isCompleteWord flag）：

```python
class Node:
    def __init__(self):
        self.children = {}            # 字元 -> 子節點（lookup table）
        self.is_complete_word = False # 有單字在這裡結束嗎？

class Trie:
    def __init__(self):
        self.root = Node()

    def insert(self, word):
        node = self.root
        for ch in word:
            if ch not in node.children:
                node.children[ch] = Node()
            node = node.children[ch]
        node.is_complete_word = True

    def find(self, s):                # 沿路走 len(s) 步；走不下去回傳 None
        node = self.root
        for ch in s:
            node = node.children.get(ch)
            if node is None:
                return None
        return node

    def is_prefix(self, s):           # 有沒有以 s 開頭的單字
        return self.find(s) is not None

    def is_word(self, s):             # s 本身是不是完整單字
        node = self.find(s)
        return node is not None and node.is_complete_word
```

## 什麼題目會用到 trie

只要跟「**單字驗證**」（word list validation）有關的題目，就想想 trie：

- **拼字遊戲（Scrabble）盤面找出所有單字**：邊走邊用 trie 檢查目前的字母組合還是不是有效前綴，不是就提早放棄這條路（剪枝）。
- **從一串字串中找出所有名人名字**：先把名人名字存進 trie，再拿每個字串去比對。

## 最佳化：接著上一次的位置查

trie 題目常見的一招。情境：使用者邊打字，一旦確定打出來的字不可能是任何單字，就馬上畫底線標錯。用上面的字典：

| 使用者打到 | trie 裡 | 判斷 |
|---|---|---|
| C | 有 c 節點 | 有效前綴，OK |
| CA | c 底下有 a | 有效前綴，OK |
| CAL | a 底下有 l（call、calm） | 有效前綴，OK |
| CALP | l 底下沒有 p | 不可能是任何單字，標錯 |

- **天真寫法**：每次都從 root 重新查整個前綴：C 走 1 步、CA 走 2 步、CAL 走 3 步……前面走過的路一直重走。
- **更好的做法**：記住上一次停在哪個節點。多打一個字元時，只要問「這個字元是不是上一個節點的 child？」每次只要 1 步。

實作方式有兩種：

1. 在 trie 內部保存「目前位置」的狀態。
2. 查詢時把節點回傳給呼叫者，下次直接從那個節點繼續往下問。

```python
# （示意）方式 2：把節點交回呼叫者
node = trie.root
for ch in "CALP".lower():
    node = node.children.get(ch) if node else None   # 每打一個字只走 1 步
    print(ch, "OK" if node else "標錯")
```

## B-tree、B+ tree、Trie 怎麼串起來

- 硬碟一次讀一個 block，所以要用 index，少讀幾個 block。
- index 太大就幫 index 再建一層 index；多層 index 轉過來就是樹，而會自己長高、變矮的那棵，就是 B-tree。
- B-tree 是有規則的 m-way search tree：非 root 至少 ⌈m/2⌉ 個 child，root 至少 2 個 child，所有 leaf 在同一層。
- 插入一律進 leaf，滿了就 split 把中間 key 送上去，連鎖到 root 才長高。
- 刪除先向兄弟 rotate 借，借不到就 merge；合併到 root 被拿光，樹才變矮。
- B+ tree 把資料（record pointer）全放 leaf、leaf 串成 linked list，上層只指路，所以 range query 是往下走一次、再往右一路掃。
- Trie 把字串變成路徑，查詢只跟字串長度有關；前綴查詢和單字驗證都靠它。

## 重點整理
- 硬碟以 block 為單位存放與讀寫；block 位址 = (track, sector)，某個 byte = track + sector + offset；轉盤換 sector、移臂換 track
- 程式只能處理 main memory 裡的資料；查詢成本 = 讀了幾個 block
- employee 例：128 bytes/record、512 bytes/block → 4 筆/block，100 筆 = 25 block；無 index 最壞 25 次
- dense index：entry = key 10 + record pointer 6 = 16 bytes，32 entry/block，100 筆 → 4 block；查詢 4 + 1 = 5 次
- sparse index：上層每個 index block 一筆；multi-level index 每多一層，block 存取更少；B-tree / B+ tree = 自己長高變矮的多層 index
- m-way search tree：每個 node 最多 m 個 child、m − 1 個 key；BST = degree 2；沒有建樹規則可能退化成高度 n（linear search）
- B-tree node = key + child pointer（block pointer）+ record pointer；每個 key 都有 record pointer
- B-tree（order m）：非 root internal node 至少 ⌈m/2⌉ 個 child；root 至少 2 個 child；所有 leaf 同一層；bottom-up 建立
- 非 root node 的 key 數 ⌈m/2⌉ − 1 ～ m − 1；order 4 → 1～3 個 key
- 2-3 tree = order 3 B-tree（1～2 key、2～3 child）；2-3-4 tree = order 4 B-tree（1～3 key、2～4 child）
- 插入一律先進 leaf；overflow 就 split，把一個 key 送到 parent；可能連續 split（連鎖反應）到 root；只有 root split 時樹才長高
- 偶數個 key split：送第 3 個 = left biased，送第 2 個（第 ⌈m/2⌉ 個）= right biased；照題目規定
- 2-3 tree split：最大的進新 node、中間的進 parent、最小的留在原 node
- internal node 的 pointer 數 = key 數 + 1
- 「真正資料都在 leaf」是 B+ tree 的性質，B-tree 上層 key 也是資料
- 刪除：node 沒空就不動；空了先向兄弟 rotate（兄弟要有 2 個 key），借不到就 merge（parent 夾在中間的 key 下來和兄弟合併）；root 被併光則樹高 − 1
- rotate 三種 case：p 是 left / middle child 向右兄弟借（最小的上去），p 是 right child 向左兄弟借（最大的上去）；subtree 由左到右順序要對
- 刪 internal node 的 key：換成 predecessor（左子樹最大）或 successor（右子樹最小），變成從 leaf 刪
- 2-3-4 tree 高度介於 log₄(n+1) 與 log₂(n+1)；可 top-down 插入，調整只發生一次；可轉成紅黑樹（3-key node → 中間黑、兩旁紅）
- range search 的笨方法是每個值各 search 一次；B+ tree 讓 leaf 串成 linked list，找到起點後沿 leaf 掃即可
- B+ tree vs. B-tree：所有 key 都在 leaf（上層只是指路副本）、record pointer 只從 leaf 出來、leaf 同層串成 linked list
- B+ tree 的 leaf 層是 dense index，上層是 sparse index；B+ tree 更像 multi-level index
- B+ tree leaf 分裂：中間 key「複製」上去（leaf 保留）；index node 分裂：中間 key「移」上去
- B+ tree 的 order d：非 root node 有 d ≤ n ≤ 2d 個 key；root 有 1 ～ 2d 個 key（與 B-tree 的 order m＝最多 m 個 child 定義不同）
- node 格式 P0 K1 P1 … Kn Pn，pointer 比 key 多一個，K1 < K2 < … < Kn
- leaf 的 `k*` 的 * 是指向 disk record 的 pointer；上層 key 只拿來比大小，搜尋一定走到 leaf
- leaf 用 doubly linked list 串起來，才能往左做「< x」的查詢
- range query（≥、≤、介於）：往下 search 一次找起點，再沿 leaf 掃到超出範圍；B-tree 則要 inorder traversal 上上下下走
- 二維範圍查詢的笨方法：經度、緯度各一棵 B+ tree 再取交集（不是 union）；R-tree（1984）用矩形分組處理 spatial data，可推廣到多維
- trie：每個節點一個字元，root 到節點的路徑就是字串；查詢 L 長字串只走 L 步，與字典大小無關
- trie 節點：children 用 26 格陣列（children[ch − 'a']，多數空格）或 hash map（只存存在的 child）＋ isCompleteWord flag
- 單字驗證（word list validation）類題目想到 trie；邊打字檢查時記住上次節點，每多一字元只走 1 步

## 名詞對照
| 中文 | English |
|---|---|
| 磁碟盤 | platter |
| 磁軌 | track |
| 磁區 | sector |
| 區塊 | block |
| 位移 | offset |
| 讀寫頭 | head |
| 主記憶體 | main memory (RAM) |
| 資料庫管理系統 | DBMS |
| 紀錄 | record |
| 索引 | index |
| 紀錄指標 | record pointer |
| 子節點指標 | child pointer / block pointer |
| 密集索引 | dense index |
| 稀疏索引 | sparse index |
| 多層索引 | multi-level index |
| 自我管理的多層索引 | self-managed multi-level index |
| m 路搜尋樹 | m-way search tree |
| 分支度 | degree |
| 階數 | order |
| 溢位 | overflow |
| 分裂 | split |
| 由下往上 | bottom-up |
| 由上往下 | top-down |
| 左偏／右偏 | left biased / right biased |
| 連鎖反應 | chain reaction |
| 旋轉（向兄弟借） | rotate |
| 合併 | merge / combine |
| 前驅／後繼 | predecessor / successor |
| 2-3 樹 | 2-3 tree |
| 2-3-4 樹 | 2-3-4 tree |
| 紅黑樹 | red-black tree |
| 線性搜尋 | linear search |
| 範圍搜尋 | range search |
| 範圍搜尋／範圍查詢 | range search / range query |
| B+ 樹 | B+ tree |
| 頁 | page |
| 子節點指標 | child pointer |
| 副本 | copy |
| 階 | order |
| 平衡樹 | balanced tree |
| 雙向鏈結串列 | doubly linked list |
| 中序走訪 | inorder traversal |
| R 樹 | R-tree |
| 空間資料 | spatial data |
| 多維空間 | multidimensional space |
| 交集 | intersection |
| 字典樹 | trie |
| 前綴 | prefix |
| 查找表 | lookup table |
| 雜湊表 | hash map |
| 單字驗證 | word list validation |
