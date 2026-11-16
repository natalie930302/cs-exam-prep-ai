# 雜湊表 Hash Table

搜尋若要比 binary search 的 O(log n) 更快，就不能只靠比大小：hashing 用 hash function 直接把 key 算成表中的位置，平均 O(1)。這章從 symbol table、map 與 direct addressing 出發，學各種 hash function（division、mid-square、folding、字串的 polynomial hash），collision 為什麼躲不掉，以及兩大類處理法：chaining 與 open addressing（linear probing、quadratic probing、double hashing）。Load factor 決定效率，表太滿就要 rebuild；資料庫則用 dynamic hashing（trie、extendible hashing、directoryless）。最後延伸到 BST、AVL、amortized 分析與 binomial heap。

## 學完這章要會
- 說明 symbol table／map／dictionary，以及 direct addressing 為什麼不實際
- 計算 division、mid-square、shift／boundary folding，與字串的 polynomial、cyclic shift hash code；說出好 hash function 的條件（uniform、除數取質數）
- 分辨 bucket、slot、loading density（α = n／(s·b)），以及 collision 與 overflow 的差別
- 說明 hash set 與 Bloom filter 為什麼「說不在一定不在，說在可能錯」
- 手算 chaining 的表與搜尋成本（平均 O(1 + α)、最壞 O(n)）
- 手算 linear probing、quadratic probing、double hashing 的插入與搜尋，說明 primary／secondary clustering 與刪除要留墓碑
- 知道 load factor 過高時效率劇降、表長大兩倍的 full rebuild 與 partial rebuild（mod k → mod 2k）
- 畫出 dynamic hashing 的 trie 與 extendible hashing 的 directory，說明 split 怎麼發生
- 說明 array 長兩倍的 amortized O(1)，以及 binomial heap 的 insert、merge、removeMax

## 搜尋要多快：從 O(n) 到 O(1)

雜湊（hashing）是為了**搜尋（search）**而設計的技術：給一個值，要很快知道它在不在、在哪裡。

| 方法 | 前提 | 做法 | 時間 |
|---|---|---|---|
| linear search | 元素在陣列中任意排列 | 從左往右一個一個比 | O(n)（最壞每筆都看過） |
| binary search | 元素要先排好序 | 每次看中間，要找的比較大往右、比較小往左，每次砍掉一半 | O(log n) |
| hashing | 選好 key 與 hash function | 算一次 function 就知道資料在哪個 bucket | O(1)（理想情況） |

binary search 的代價是資料要先排序，得多花排序的時間；而且 O(log n) 仍不夠快。目標是 O(1)：資料再多，也只要幾步就到。

用 hash 有兩個關鍵：

1. 決定要拿什麼當 key（例如通訊錄用名字）。
2. 選哪一個 hash function，不同的 hash function 效果不同。

hash 只要算一次 function 就知道資料該在哪個 bucket，所以 insert、delete、search 理想上都是常數時間。

> **觀念** bucket sort 依數字最前面或最後面的幾個 bit 決定丟進哪個 bucket，這其實就是 hash 的概念：由 key 的一部分算出它屬於哪一桶。

## 要查的表：symbol table、map 與 dictionary

### Symbol table

寫 assembler 或 compiler 時最重要的資料結構是**符號表（symbol table）**。它像一個目錄：左邊是字串（symbol），右邊是它對應的屬性（attribute），例如 machine code。assembler 看到 `INT`，就去 symbol table 查它的 machine code。

- 查某個 key 對應的 attribute 叫 **retrieve**；table 很大時也要能很快找到。
- table 也要支援修改：insert 和 delete。
- 通訊錄、database 也都是這種 table，都要做 insert、delete、search，其中**最頻繁的是 search**。

### 性質與實作要分開

資料結構「要滿足的性質」和「用什麼實作」是兩回事。

- **priority queue** 是一種性質：能很快 remove 或 retrieve 最大的 key，而且把 key 與對應資料 insert 進去也要快。實作可以用 heap、binomial heap 或 ordered array，快慢各不同。
- **stack**、**queue** 也是性質：stack 可以用 array 實作，queue 可以用 circular array 實作。

### Map 與 dictionary

**map** 可以看成 priority queue 的延伸：一樣帶著 key 把資料放進去，但不再是拿最大的，而是**指定 key 去 get 或 remove**，而且要快。就像看地圖：地名是 key，用它找到要的東西在哪。

- map 存的是 key 與 value 的**一對一**關係：key₁ → value₁、key₂ → value₂。例如 key 放名字、value 放電話，就是一本通訊錄。
- 一個 key 對到**多個** value，叫 **dictionary（字典）**，像英文字典一個字有好幾個解釋。
- dictionary 也能用 map 做：value 那格改放一個集合（set），例如一條 linked list。

**雜湊表（hash table）**是存資料的資料結構，每筆資料有兩部分：key 與 value（record）。它是實作**關聯陣列（associative array）**的一種方式：把 key 對應（map）到 value。核心就是一個陣列；示範時常只畫 index 0～4 五格，真正實作時表會開得大很多。

### Ordered map 與 unordered map

| 種類 | key 的假設 | 例子 |
|---|---|---|
| ordered map | key 之間有大小關係，可以排順序；有些 map 會利用順序快速 insert / remove | integer 有大小；string 有字典順序（A 開頭排前面、Z 開頭排後面） |
| unordered map | 不在乎 key 能不能比較，只要是 key 就能放 | — |

ordered 是比較強的假設；unordered 則是探討「假設很弱時還有哪些招能做得快」。hash table 走的是 unordered 這條路：key 不需要比大小，而且通常是**變動長度（variable length）**的，不像 32-bit 整數有固定位數（例如英文字典，key 是單字、value 是單字的解釋）。

## 用 linked list、array 做 map 有多慢

先用已經會的東西實作 map：把 key 與 value 打包成一筆資料。

| 實作 | insert | get | remove |
|---|---|---|---|
| unordered linked list | 每筆都插在 head，O(1) | 整串掃過，O(n) | 要先找到，O(n) |
| ordered linked list（照 key 排序） | 要找適合的位置，O(n) | 不能直接跳到中間，沒有 binary search，O(n) | O(n) |
| unordered array | 塞在最後，O(1) | 只能 sequential search，O(n) | 後面的人要往前補位 |
| ordered array | 要擠進中間，後面全部往後挪，O(n) | binary search，O(log n) | 拿走一個，後面的人往前補位，O(n) |

衡量標準：跟 n 成正比就算慢；log n 勉強算快（256 筆也只要約 8 步）。

> **陷阱** ordered array 的 insert 不是 O(log n)。binary search 找到位置確實只要 O(log n)，但之後要把後面的元素全部推開，仍是 O(n)。

> **觀念** insert 的主要成本常可看成「先 get 一次、確認不存在，再放進去」。

## 直接拿 key 當 index（direct addressing）

最簡單的 hashing：**值是多少就放第幾格**。array 像一排櫃子，key 就是櫃子號碼，打開那格就能放、就能拿。key、value 不必打包，array 裡只放 value。

> **例題** 手上有 8、3、13、6、4、10，各放進同號的格子。

```
index : 0  1  2  3  4  5  6  7  8  9  10 11 12 13
value : .  .  .  3  4  .  6  .  8  .  10 .  .  13
```

- 找 10：直接看 [10]，有 → 找到。
- 找 12：[12] 是空的 → 不在。
- 不論找得到或找不到，都是一步，O(1)。insert 就是一次 assignment，get 就是算出櫃子、打開拿出來，都是常數時間。

問題在空間：前提是 key 是範圍有限的小整數（small integer）。多一個 50，陣列就得開到 index 50（51 格），而 50 離其他數字很遠；只存 7 個數卻開一大排櫃子，大部分空著。這是**用空間換時間**的取捨（space trade-off），但換得太貴了。

## Hash function：把 key 算成 index

不讓 key 直接當 index，中間加一台機器：**雜湊函數（hash function）**。它看一眼 key，照固定規則算出一個 index，告訴我們資料該放陣列哪一格。

> **例題** hash("Paul") 算出 3，Paul 的名字和電話就放進 [3]。另一個人 hash 出 1 就放 [1]，再一個放 [2]、再一個放 [4]。位置全由 hash function 決定。

> **重點** 同一個 key 每次丟進去都要算出同一個 index（deterministic）。今天放在 3、明天算出 4，就找不到了。

查詢也一樣：想用某人的名字查他的電話，就把 key 丟進**同一個** hash function，它吐出的 index 直接告訴你去哪一格；就算陣列有一百萬格，其他 index 都不用看。

### 數學模型：key space → hash table

- 要存的 key 合起來叫 **key space**，存放的地方叫 **hash table**，h 負責把 key 映射過去。
- h(x) = x 就是上一節的 direct addressing：h(8) = 8、h(13) = 13。它是**一對一（one-to-one）**的理想 hash function，不會撞，但 key 是 50 就需要 index 50，表太長、浪費空間。
- 換成別的函數讓表變小，多半會變成**多對一（many-to-one）**（也取決於 key 和表的大小），這就是之後 collision 的來源。

## 兩步走：hash code 再 compress

實際情況：array 只有 100 格，key 的範圍卻有 1 萬種，甚至 key 根本不是整數。計畫是「任意 key → integer → small integer」，把函數 h 拆成兩步：

1. **hash code**：用任何方法把 key 轉成一個整數，這個整數**不必小**。任何字串都能看成整數，但太大的整數沒辦法開 array 放。
2. **壓縮（compress）**：把這個整數壓進 array 放得下的範圍。最簡單的是除法取餘數：表有 k 格就 mod k，結果一定落在 0～k−1，不會出界（餘數一定比除數小）。

> **例題** 字串 "ABC" 用下面的 polynomial hash code 算出 18273；表有 100 格，18273 mod 100 = 73，放 [73]。

有了 h，map 的操作就變成熟悉的 array 操作：

```
insert(key, value):  A[h(key)] = value
get(key):            v = A[h(key)]
```

- 存東西的 array 叫**桶陣列（bucket array）**：好幾個 value 可能要塞在同一個櫃子（桶），有了 index 就把東西往那一桶丟。
- 決定 key 用哪個櫃子的 h 就叫 hash function。
- convert、compress、array access 三件事都快，就有快速的 map；所以 hash table 可以看成「把 array 延伸來做 map」。
- 若範圍是 0～9999 就開 10000 格；範圍 0～5566 就開 5567 格。

> **觀念** 建議的做法：好好設計 hash code，最後 mod 一次就好。很多複雜的方法其實等同於把計算塞進 hash code 裡；compress 這一步通常就是 division。

> **陷阱** 用 division 壓縮時，除數最好選**質數**（或沒有小質因數的數），避免 2 的次方，否則只看得到 key 的低位 bit，容易撞。另外，hash function 不是只有 division 一種：課本還列了 mid-square、folding、digit analysis 等。

## 字串的 hash code

### 只看第一個字

最粗糙的做法：只看第一個字元。英文字母只有 26 個，得到 0～25，可直接放進 26 格的 array。但 apple 和 act 都是 a 開頭，直接撞在同一格（collision）。

### Summation：把字元碼加起來

把 key 每個位置的值（字串就用 ASCII 碼）加起來得到一個整數。

> **例題** A = 65、B = 66、C = 67。
> - "ABC" = 65 + 66 + 67 = 198
> - "ACB" = 65 + 67 + 66 = 198 → 一樣
> - 以 apple、act 為例：apple = 97 + 112 + 112 + 108 + 101 = 530，act = 97 + 99 + 116 = 312。加總的數字可能很大（例如到 4 byte 整數的範圍），所以要再 compress，例如只有 100 格就 mod 100，得到 0～99。

- 缺點：加法不管順序，**對位置的變換不敏感**，字母一樣、位置不同就撞在一起。
- 優點：算起來簡單又快。
- 如果應用中常打錯位置（form 打成 from），這些字就會一直撞，得一直處理 collision。

> **觀念** 對位置不敏感不一定好、也不一定壞，要看應用。

### Polynomial hash code：乘上 16ⁱ

改良：第 i 個位置先乘上 16ⁱ 再加總（第 0 個乘 16⁰、第 1 個乘 16¹、第 2 個乘 16²）。

> **例題**
> - "ABC" = 65 + 66×16 + 67×256 = 65 + 1056 + 17152 = **18273**
> - "ACB" = 65 + 67×16 + 66×256 = 65 + 1072 + 16896 = **18033**
> - 兩者不同，ABC 和 ACB 在 hash code 這一關分開了。但 compress 之後仍可能撞：18273 mod 10 = 3，18033 mod 10 = 3。

- 16 可以換成任何數 a（例如 5 或 9）。這一類統稱 **polynomial hash code**：把 key 的各位置當係數，代入 a 去 evaluate 多項式 `c₀ + c₁·a + c₂·a² + …`。
- 選 16 的理由：乘 16 等於左移 4 個 bit，乘 8 等於左移 3 個 bit，用 shift 就能做，bit 運算更有效率。

> **觀念** 問：乘那麼多次方不會 overflow 嗎？
> 答：實際上不會算出完整的多項式值。計算過程中邊算邊 mod 2³²，結果一直保留在 32 bit（4 byte）整數裡，就不會 overflow。也可以接受很大但有限的 hash code（例如 256 bit），最後再做相應的 compress。

### Cyclic shift hash code

一般的 shift 做法是每處理一個字元就把目前結果往左移、再加上新字元；但整數只有 32 bit，左邊移出去的 bit 會被擠掉，右邊補 0。**cyclic shift** 把擠出去的 bit 繞回右邊（低位）補上，資訊不會丟。

> **例題** 用 8 bit 示意左移 4 位（實際是 32 bit）。

```
原本          10110011
一般左移 4    00110000   （左邊 1011 被丟掉，右邊補 0）
cyclic 左移 4 00111011   （移出去的 1011 繞回右邊）
```

每處理一個字元就「轉一次、加一次」，迴圈跑完就是 hash code。以下是這個流程的寫法（示意）：

```c
unsigned int cyclic_hash(const char *s) {
    unsigned int h = 0;                  /* 32-bit */
    for (; *s; s++) {
        h = (h << 4) | (h >> 28);        /* 循環左移 4 bit */
        h += (unsigned char)*s;          /* 加上新字元 */
    }
    return h;
}
```

sum → polynomial → cyclic shift，是從簡單排到複雜。

### 越複雜越難猜：one-way

- sum 一眼就看得出 ABC 和 ACB 會撞；cyclic shift 運算複雜，很難猜到哪兩個 key 會有同樣的 hash code。
- 這種「難猜」對密碼學、身分驗證很有用。好的函數還要 **one-way**：告訴你 hash code 是 1126，很難反推原本的 key。one-way function 是「算過去很快，反推要接近暴力搜尋的時間」，在密碼學、區塊鏈、演算法、計算理論的課程中會再遇到。
- 設計性質好又算得快的 hash code 不容易，是很深入的領域；一般應用用 polynomial 或 cyclic shift 多半就夠好了。

> **例題** bucket array 的示範：用 sum（ASCII 加總）當 hash code，再 mod 8。
> - cat = 99 + 97 + 116 = 312 → 312 mod 8 = 0
> - dog = 100 + 111 + 103 = 314 → 2
> - egg = 101 + 103 + 103 = 307 → 3
> - god 也是 314 → 2，跟 dog 丟進同一桶。很多東西要丟同一桶怎麼辦，就是後面 collision handling 的問題。

## 課本的 hash function：mid-square、division、folding

### Mid-square（平方取中）

key 先寫成二進位，**先平方、再取中間若干個 bit** 當 bucket 位址。取幾個 bit 不限定；取 r 個 bit，表就要有 2ʳ 個 bucket。

> **例題** key = 13，13² = 169 = `10101001`₂。取中間 4 個 bit（示意）：`10[1010]01` → `1010`₂ = 10，放 bucket 10，表有 2⁴ = 16 個 bucket。

> **陷阱** 順序是「先平方、再取中間」，不是「先取中間再平方」。

### Division（除法）

h(x) = x mod M，三種裡**最常用**。

- 若 M = 2ⁱ，除以 2ⁱ 的餘數就是 key **最右邊（最低）的 i 個 bit**，其他位全被忽略。例如 M = 2：A1、B1、C1 的最後一個 bit 都是 1，全掉進同一個 bucket；而且只有兩個 bucket，很快就滿，有用 hash 跟沒用差不多。
- 所以 M 要選**質數**，或至少沒有小質因數（例如沒有小於 20 的質因數）的數。

> **陷阱** mod 2ⁱ 看的是最右邊（最低位）的 i 個 bit，不是最左邊。M 取 10、15 這類有小質因數的數都不理想。

### Folding（摺疊）

把 key 切成一段一段（segment），再把各段相加。

> **例題** x = 12320324111220，每 3 位一段：

```
段：   P1   P2   P3   P4   P5
       123  203  241  112  20
```

- **shift folding**：各段直接對齊相加
  123 + 203 + 241 + 112 + 20 = **699**
- **folding at the boundaries**：像摺紙條一樣沿段與段的邊界來回對折，被翻過去的段（第 2、4 段）數字倒過來：203 → 302、112 → 211；241 與 20 不變。
  123 + 302 + 241 + 211 + 20 = **897**

同一個 key，兩種折法得到 699 與 897，結果不同。

> **陷阱** boundary folding 被反轉的是偶數段（203、112），241 不變；總和是 897。

三種之中最常用的仍是 division。

## Collision 躲不掉：鴿籠原理

- 最完美的情況：100 個 key 一對一對應到 0～99，叫**完美雜湊（perfect hashing）**，沒有空櫃子，也不用多 allocate。
- 但大部分時候 key 的數量或範圍比櫃子數 k 大。key 範圍 0～1 萬、櫃子只有 100 個，就不可能 perfect：不管選哪個 h，都會有兩個 key 的 h 值一樣。
- **鴿籠原理（pigeonhole principle）**：3 個籠子關 4 隻（或 5 隻）鴿子，至少兩隻擠同一籠。籠子是格子，鴿子是 key。100 個 key、50 格一定有 key 同格；100 個 key、99 格也一定有兩個擠同一格。

**碰撞（collision）**：兩個不同的 key 被送到同一格。

```
h(k₁) = h(k₂)，但 k₁ ≠ k₂
```

撞的原因有兩種：

1. hash code 本來就一樣，例如 sum 讓 ABC、ACB 都是 198。
2. hash code 不同，compress 之後才撞，例如 polynomial 的 18273、18033 mod 10 都是 3。

> **觀念** 問：做完 division 會不會產生新的重複？答：會，這就是 collision。

撞了之後怎麼辦叫 **collision handling**。所以 hash 有兩個難題：一、找好的 hash function（一開始就少撞）；二、處理 collision。

## 好的 hash function：uniform、分散

hash function 的目的是把 key 分散到 bucket array 的各個位置。好的 hash function：

1. 不要太複雜，算得快。
2. collision 機率要小，資料要**平均**分到每個 bucket，不要某些 bucket 特別多，k 格都要用到；這也是空間最平均的利用。

每筆資料丟進每個 bucket 的機率都是 1/b（b 為 bucket 數）的，叫**均勻雜湊函數（uniform hash function）**。

> **比喻** 最壞的 hash function：不管什麼 key 都回傳 0，就像不管記者問什麼，都只回答同一句話。結果資料全擠在第 0 格，很快 overflow，其他格子閒著，空間全浪費，還要花很多力氣處理 collision。

> **重點** 目標不是完全不撞（鴿籠原理保證一定會撞），而是盡量分散；分散了，就算撞到也處理得來。

> **比喻** 口罩實名制剛開始時的單雙號分流，就是只有兩格的 hash。用身分證最後一碼決定分在 1、3、5 還是 2、4、6 那一組。最後一碼是檢查碼，由英文字母（轉成兩位數）和前 8 個數字加權算出，很像 polynomial hash code；再 mod 2，把所有人 compress 成兩格。目的就是分散，別把藥局塞爆。hash table 也一樣，只是 array、hash code、key 更複雜：別把某一格塞爆。

## Bucket、slot 與 loading density

課本的符號：

- **identifier** 就是 key。資料 x 放在 h(x) 算出來的 bucket 裡；知道怎麼放就知道怎麼找，search x 時也是算 h(x)，只到那個 bucket 裡找。
- hash table 有 **b 個 bucket**，每個 bucket 有 **s 個 slot**（最多放 s 筆 record），h(x) 一定落在 0～b−1。
- **identifier density** = n / T：n 是表中的個數，T 是所有可能 identifier 的個數（通常大得嚇人）。
- **loading density**（也叫 **loading factor**，負載因子）：

```
α = n / (s·b)
```

表示表被佔用的比例。

> **例題** s = 2、b = 6，最多放 2 × 6 = 12 筆；現在放了 4 筆，α = 4 / 12 = 1/3。α 越大，越容易撞。

## Collision 不等於 overflow

- **collision**：h(i₁) = h(i₂)，兩筆資料搶同一個 bucket。bucket 還有空位就沒事，兩筆都放得下。
- **溢位（overflow）**：要放進去時，bucket 已經滿了，資料滿出來。
- collision 只要用 hash 就一定會發生；overflow 要看 bucket 滿了沒。

> **陷阱** collision ≠ overflow。只有 s = 1 時，一 collision 就一定 overflow，兩者同時發生（常考）。

> **例題** 26 個 bucket（b = 26，編號 0～25）、每個 bucket 放 2 筆（s = 2）。hash function 只看第一個英文字母的順序：A → 0、B → 1、…、Z → 25。依序放入 GA、D、A、G、L、A2、A1、A3、A4。

- GA：G 是第 7 個字母，編號從 0 開始 → bucket 6
- D → 3，A → 0，G → 6，L → 11，A2 → 0

```
bucket   slot 1   slot 2
  0      A        A2      ← 滿
  3      D
  6      GA       G       ← 滿
 11      L
```

接著 A1、A3、A4 開頭都是 A，都要進已滿的 bucket 0 → **overflow**。資料不能丟，所以一定要有處理 overflow 的方法。

## Collision handling

資料一多一定會 overflow。課本的兩大策略：

- **開放定址（open addressing）**：開放其他 bucket 的空間給 overflow 的資料用。
- **鏈結法（chaining）**：不佔用別人的 bucket，用 linked list 把同一個 bucket 的資料串起來排隊。

更細地分，撞了之後可以有下面幾種做法（方法 1～3 都是在 bucket 裡再放一個容器）。

### 方法 0：不理他（tolerate some errors）

insert 時打開櫃子發現已經有東西：

- 把原來的東西丟掉、換成新的；或
- 乾脆不放新的（don't insert）。

有些應用只想留最新的，舊的丟掉沒關係，碰撞又不常發生時就可行。這不是 standard 的處理，要看應用。背後的思維叫 **tolerate some errors**：容許一些錯誤（把不該丟的東西丟掉），換來簡單。

### 用 hash 做 Set：0 一定不在、1 可能錯

容錯的想法可以延伸：拿 hash table 來做**集合（Set）**。set 可以看成「key 對應到 true / false 的 map」，用來快速判斷某元素是否屬於集合。

- 開一個 array，每格只放 **1 個 bit**，預設 0。把 k₁～k_p 放進集合時，把 h(k₁)～h(k_p) 那幾格設成 1。
- 沒存 key，也沒存 value，size 非常小。
- 查一個新的 kᵢ：用同一個 h 算出位置，看那格是 0 還是 1。
  - 是 **0**：kᵢ 從來沒放進來過。這是確定的答案，no error。
  - 是 **1**：沒有 collision 的話代表它在；但有 collision 時，那個 1 可能是另一個撞在同一格的 key 設的，不一定對。

> **例題** 沿用 sum mod 8，集合 = {cat, dog, egg}，設 bit 0、2、3 為 1。（查詢的字是示意）

```
index : 0 1 2 3 4 5 6 7
bit   : 1 0 1 1 0 0 0 0
```

- 查 bee：98 + 101 + 101 = 300，300 mod 8 = 4 → bit 4 是 0 → 一定不在。
- 查 god：314 mod 8 = 2 → bit 2 是 1 → 回答「在」，但其實是 dog 設的，答錯了。

> **重點** 這是「說不在一定對、說在可能錯」的資料結構，錯誤全部來自 collision。

### Bloom filter

上面的 bit array 就是 **Bloom filter** 最基本的一塊：把 hash 延伸來做 set。真正的 Bloom filter 用**好幾個** hash function：

- 插入 x：h₁(x)、h₂(x)、h₃(x)…算出的每一格都設成 1。
- 查詢：所有格子都是 1 才說「在」；只要有一格是 0，就一定不在。
- hash function 之間若彼此獨立，要全部剛好撞到很難；用 10 個時錯誤率可以壓得很低。只有每一格都剛好被別人設成 1，才會誤報「在」。

> **例題** 8 個 bit、3 個 hash function（h 值為示意）。
> - 插入 x：h₁, h₂, h₃ = 1, 4, 7；插入 y：2, 4, 6。
> - 查 w：1, 3, 7 → bit 3 是 0 → 一定不在。
> - 查 z：1, 6, 7 → 三格都是 1（分別由 x、y、x 設的）→ 回答「在」，但 z 沒放過，這就是誤報。

```
index : 0 1 2 3 4 5 6 7
bit   : 0 1 1 0 1 0 1 1
```

Bloom filter 能很快判斷一個 element 在不在 set 裡：「不在」是肯定的答案；「在」有小小機率錯，但大部分是對的。在大資料時代非常有用。

> **例題** 廣告系統：有 1532 個使用者對紅色廣告特別有反應，每來一個使用者，就要很快判斷他是不是這群人之一。一個一個比對 1532 人，比完時秀廣告的機會已經沒了。把這 1532 人建成 Bloom filter，來一個人算幾個 hash 就知道。說「是」偶爾會錯，頂多多秀紅色廣告給十個人，沒關係；但保證那 1532 人都看得到紅色廣告。

### 方法 1：每個 bucket 一個固定大小的小 array

比較標準的處理：每個 bucket 放一個 fixed array，就像把一個置物櫃隔成 4 小格，撞在一起的人各放一格。但第 5 個人來就放不下，還是會 overflow（hash function 不夠好或資料分布特別時，四小格都滿了）。如果這種情況不常發生，它是簡單好用的方法。

> **觀念** array 的櫃子大小固定，而處理 collision 等於要求櫃子能變動大小。所以櫃子裡可以不直接放東西，而是放一張「小紙條」（pointer），指到一條 linked list 或像 vector 一樣會動態長大的 array。這就是下面 chaining 的出發點。

### 方法 2：Chaining

又一個人 hash 出 3，但 [3] 已經有 Paul 了 → collision。做法是從每一格拉一條 linked list：新來的人接在 [3] 的串列上，跟 Paul 排在一起；再有人 hash 到 3，就繼續往後接。資料不會被覆蓋，也不會遺失。這種做法叫 **chaining**，也稱 **open hashing**：元素不存在表的格子本身，而是存在該 index 的 chain（linked list）節點裡。

> **例題** h(x) = x mod 10，依序放入 8、3、13、6、4、10。

```
[0] → 10
[1]
[2]
[3] → 3 → 13
[4] → 4
[5]
[6] → 6
[7]
[8] → 8
[9]
```

- 13 mod 10 = 3，跟 3 撞在一起，就接在 3 的後面。
- 搜尋 13：h(13) = 3，到 [3] 的 chain 從頭找：3 不是，13 找到。
- chain 裡可能不只一個元素，必須沿著 linked list 搜。

linked list 要多長就多長，有的長、有的短，但我們希望**每條 chain 都很短**。insert、get 時 hash 的部分很快（算 hash code、compress 就到那一格），之後花的時間跟那一格放了多少東西有關；大家擠同一格、串列很長，就像要排很長的隊。hash function 設計得好，每格的串列就不會太長。

### Chaining 的搜尋成本

> **例題** 延續 26 個 bucket、只看第一個字母的 hash function，改用 chaining。bucket 是 linked list 的頭（header），新 node 插在串列**最前面**。依序放入 GA、D、A、G、L、A2、A1、A3、A4、Z、ZA、E 共 12 個 identifier。

```
[0]  → A4 → A3 → A1 → A2 → A
[3]  → D
[4]  → E
[6]  → G → GA
[11] → L
[25] → ZA → Z
（其他 bucket 為空）
```

- 找 A3：A3 屬於 bucket 0，從 bucket 0 的頭往下走：A4 不是、A3 找到。完全不碰別的 bucket。
- 平均搜尋長度（12 個 identifier 每個都找一次，平均比幾次）：

| 比較次數 | identifier | 筆數 |
|---|---|---|
| 1 | A4、D、E、G、L、ZA | 6 |
| 2 | A3、GA、Z | 3 |
| 3 | A1 | 1 |
| 4 | A2 | 1 |
| 5 | A | 1 |

```
6×1 + 3×2 + 1×3 + 1×4 + 1×5 = 24
平均 = 24 / 12 = 2
```

最慘的是 A：它最早進來，被後來的擠到最後，要比 5 次。

- chaining 不佔用別人的 bucket，但搜尋效能受串列長度影響。
- uniform hash 時，瓶頸在 overflow 的處理；但最難的其實是決定 hash function。
- hash function 取不好，所有資料掛在同一串，搜尋就跟走整條 linked list 一樣：worst case O(n)。

> **重點** chaining 的平均搜尋時間是 O(1 + α)，α = n/m（load factor，m 為格數）；最壞全部擠在同一條 chain，O(n)。

> **陷阱** 「chaining 的時間大於 1，但一定比 log n 快」是錯的說法。比 log n 快只在 α 很小時的平均情況成立；平均是 O(1 + α)，最壞是 O(n)。

### Key 要跟 value 一起存

> **觀念** 問：同一格串了好幾個值，怎麼知道哪個是我的？
> 答：沒有 collision 的世界，那一格是你專屬的，只存 value 就好。有 collision 就得「對證件」，所以一般會把 key 和 value 一起存。就像共用櫃子，每樣東西都要貼姓名或學號，拿的時候才不會拿錯。

### 方法 3：其他 container（secondary data structure）

更進階一點：bucket 裡放任何能動態裝下一堆碰撞 key 的 container，通常叫**次級資料結構（secondary data structure）**。

- hash 只是先分流。例如 100 萬人分流後每桶還有 1 萬人，1 萬人找來找去還是太多，桶子裡可以再用另一個 hash。
- hash 先分成小包，小包裡再用別的招，這是一種**階層式（hierarchical）**的設計。
- array、linked list 是基本款；進階款比較合用，但更複雜、更難 maintain。

> **重點** collision handling 的整理：
> - 方法 0：error tolerant，容許一些錯誤（丟掉舊的或不放新的；延伸出 hash set 與 Bloom filter）。
> - 方法 1、2、3：bucket 裡放 array、linked list、其他 container，統稱 secondary data structure。
> - insert 時怎麼處理 collision，決定了之後 get / search 要怎麼找。

## Open addressing：把表裡的空格用起來

處理 collision 的另一大類叫 **open addressing（開放定址）**：所有資料都放在 hash table 本身，不另外接任何資料結構。

### 動機：chaining 浪費了空格

取 h(x) = x mod 10，依序放 10、20、30、40、50，餘數全是 0。用 chaining（separate chaining）的話，第 0 格串成：

```
[0] → 50 → 40 → 30 → 20 → 10
[1] (空)
[2] (空)
 …
[9] (空)
```

第 1 到第 9 格明明都空著，卻另外花了 linked list 的記憶體。Hash table 常常是有的地方很塞、有的地方很空；前面幾種處理方式（不理他、每格切成小 array、掛 linked list、掛其他 container）都是幫「塞的地方」多配置空間，空的地方還是空的。能不能把空的地方回收再利用？做法是：最想放的 bucket 已經有人，就放到附近另一個 bucket。

名字的由來：open 指「開放」別的 bucket 給 overflow 的資料住。

> **陷阱** 名詞很容易搞混：chaining 又叫 **open hashing**；probing 叫 **closed hashing**，卻又叫 **open addressing**，字面上剛好跟 open hashing 相反。判斷時看「資料放在表裡面（probing）」還是「掛 chain 在外面（chaining）」。

Chaining 存的資料數可以比表的格數還多；open addressing 只用表本身的記憶體，所以需要比較大的表，load factor 越低越快。

### 先看 collision 怎麼發生

取 h(x) = x mod size，size = 10：8 mod 10 = 8 放 [8]；3 mod 10 = 3 放 [3]；13 mod 10 也是 3，跟 3 搶同一格，這就是 collision。解法分兩類：open hashing（chaining）與 closed hashing（linear probing、quadratic probing 等）。

### 最直覺的做法：撞了放下一格

再看 10、20、30、40（mod 10）：

- insert 10 放 [0]。
- 20 也算到 0，撞了，就放下一格 [1]。
- 30 算到 0 已滿，試 [1] 也滿，放 [2]。
- 40：[0]、[1]、[2] 都不空，放 [3]。

這種「往下一格找」的方法叫 **linear probing（線性探測）**。

> **比喻** 找座位。進教室最愛坐第三排中間：第一排太認真、壓力大，最後一排像來混的，第三排進可攻、退可守。可是來晚了，第三排中間已經有人坐，這就是 hash function 算出的 bucket 被佔了。「不理他」像把坐在那裡的人趕走，「切小格」像兩個人擠同一張椅子，「linked list」像大家手牽手串一串，都不實際。真正會做的是：去第二志願，沒有就第三志願，依序找下去。耐心有限，找到第十志願都沒位子，就兩手一攤，今天不上了。這種照志願一個個找位子的方式，就是 open addressing。

## Open addressing 的 insert 與 get

把 `array[key] = value` 的步驟寫清楚：

1. 先用原本的 hash function 算出第一志願 h₀，例如第 3 格，就先試第 3 格有沒有人。
2. 有人了就試 h₁（第二志願），再不行就試 h₂，依此類推。
3. 耐心是 **m 次**：h₀ 到 hₘ₋₁（m 為表的格數）。
4. 全部都有人，就 declare failure：insert 失敗，交給呼叫的程式處理。

get 照**同樣的順序**找，就像朋友知道你找座位的順序，照著順序來找你。全部順位都找過還沒有，就代表你沒來上課：這個 key 不在表裡。

> **陷阱** 試的次數是 h₀～hₘ₋₁ 共 m 次，不是 m+1 次。

剩下的問題是：h₁、h₂ 這些後面的志願怎麼算？

## Probe 的一般式

```
Hᵢ(k) = (h(k) + f(i)) mod ts        i = 0, 1, 2, …,  f(0) = 0
```

- 小寫 h 是原本的 hash function；大寫 Hᵢ 是第 i 次 probe 的位置。
- 規定 f(0) = 0，所以 H₀(k) = h(k)，第一次一定試原本算出的位置；之後第 i 次多跳 f(i) 格（offset），bucket 滿了不一定只放下一格。
- 最後 mod ts，ts（TableSize）是 bucket 個數：走到表尾就 wrap around 繞回表頭。

**Probe（探測）** 就是去問鄰居：「這裡有人住嗎？」有人住，就問下一家。依序嘗試的位置 H₀、H₁、H₂… 叫 **probe sequence**。f 的選法決定三種常見做法：

| 做法 | f(i) | 說明 |
|---|---|---|
| linear probing | i | 一格一格往下，i 的一次方，所以叫 linear |
| quadratic probing | i² | 跳 1、4、9…格 |
| double hashing | i · h₂(k) | 用另一個 hash function 決定步伐 |

寫成程式就是一個 for 迴圈：i 從 0 開始套公式，找到空 bucket 就跳出來。

```c
/* linear probing insert（示意） */
#define EMPTY -1

int insert(int table[], int ts, int key) {
    for (int i = 0; i < ts; i++) {
        int pos = (key % ts + i) % ts;   /* Hᵢ(k) = (h(k) + i) mod ts */
        if (table[pos] == EMPTY) {
            table[pos] = key;
            return pos;
        }
    }
    return -1;   /* 試了 ts 次都滿：declare failure */
}
```

## Linear probing 實戰

### 例題：insert 89、18、49、58、9（表 10 格，h(x) = x mod 10）

Hᵢ(k) = (h(k) + i) mod 10。

- 89 mod 10 = 9，[9] 空 → 放 [9]。
- 18 mod 10 = 8 → 放 [8]。
- 49 mod 10 = 9，撞了；H₁ = (9 + 1) mod 10 = 0，繞回表頭 → 放 [0]。
- 58：H₀ = 8 撞、H₁ = 9 撞、H₂ = 0 也撞；H₃ = (8 + 3) mod 10 = 1 → 放 [1]。共試 4 次（3 次碰撞＋1 次成功）。
- 9：H₀ = 9、H₁ = 0、H₂ = 1 都撞；H₃ = (9 + 3) mod 10 = 12 mod 10 = 2 → 放 [2]。也是 4 次。

```
index : 0   1   2   3   4   5   6   7   8   9
插89  : .   .   .   .   .   .   .   .   .   89
插18  : .   .   .   .   .   .   .   .   18  89
插49  : 49  .   .   .   .   .   .   .   18  89
插58  : 49  58  .   .   .   .   .   .   18  89
插9   : 49  58  9   .   .   .   .   .   18  89
```

再看一個例子：若最後放的是 69 而不是 9，69 一樣走 9 → 0 → 1 → 2，放 [2]。

### 例題：字母當 key（每個 bucket 放一筆）

h(x) = 第一個字母的順序（A → 0、B → 1、…，共 26 個 bucket），每個 bucket 只放一筆（slot 數 s = 1）。依序放 GA、D、A、G、L、A2、A1：

- GA：G 是第 7 個字母 → bucket 6。
- D → bucket 3；A → bucket 0。
- G 應放 bucket 6，但已被 GA 佔了；往下看 bucket 7 是空的 → G 放 7。
- L → bucket 11。
- A2 應放 bucket 0，已被 A 佔 → 放下一個 bucket 1。
- A1 也要放 bucket 0：滿；bucket 1 也滿；bucket 2 空 → A1 放 2。

```
bucket : 0   1   2   3   4   5   6   7   8   9   10  11  12
內容   : A   A2  A1  D   .   .   GA  G   .   .   .   L   .
```

### 再看一個例子：8、3、13、6、4、10（mod 10）

- 8 → [8]、3 → [3]。
- 13：i = 0 得 3，撞了；i = 1 得 4 → 放 [4]。
- 6 → [6]。
- 4：[4] 被 13 佔了 → 放 [5]。
- 10 → [0]。

```
index : 0   1   2   3   4   5   6   7   8   9
內容  : 10  .   .   3   13  4   6   .   8   .
```

## Find：走同一條路，遇到空格才停

find 跟 insert 走**同一條 probe sequence**，因為資料當初就是沿著這條路放的。停下來的條件只有兩個：**找到了，或遇到空格**。

- 用 89、18、49、58、9 那張表，find 58：[8] 不是、[9] 不是、[0] 不是、[1] 找到，共 4 次 probe。
- find 19（不在表中）：19 mod 10 = 9，走 [9] → [0] → [1] → [2] 都不是，第 5 次看到 [3] 是空格，才確定 19 不在。這是**失敗搜尋（unsuccessful search）**。
- 用 8、3、13、6、4、10 那張表，搜尋 4：[4] 是 13 不是，看下一格 [5] 找到。
- 搜尋 24：[4]、[5]、[6] 都不是，[7] 是空格 → 停，24 不在表中。
- 用字母那張表，search G：h(G) = 6，bucket 6 放的是 GA。

> **陷阱** 算出來的格子放的不是它，千萬別馬上回答「不在表裡」，它可能當初 overflow 被擠到後面去了。search G 要往下多走一步，在 bucket 7 找到 G。一定要走到找到 key 或遇到空 bucket，才能判定不存在。

## Primary clustering：擠成一團

Linear probing 就是繞圈圈找隔壁：0 號沒有就 1 號、2 號、3 號……等價說法是「在離原來位置 i 那麼遠的地方」找。最多把整個 array 繞一遍。只要表沒滿，一定找得到空格，但找的時間會變長。

缺點：某一格碰撞嚴重時，會把相鄰的格子也佔掉。例如（h = x mod 10，示意）3、13、23 都想要第 3 格，結果 13 佔 4 號、23 佔 5 號。更慘的是 14 來了，自己的 4 號被佔，只好去借 6 號；15 也只好去借 7 號。

```
（示意）
index : 0   1   2   3   4   5   6   7   8   9
內容  : .   .   .   3   13  23  14  15  .   .
                    └──── 一整塊 cluster ────┘
```

撞了之後佔用相鄰格子、連成一大塊，叫 **clustering**，課本稱 **primary clustering（主要聚集）**。前面 89、18、49、58 的例子裡，8、9、0、1 也連成一坨。

> **比喻** 像塞車：本來該放 4 號、5 號的反而放不進去，要去借 6 號、7 號，拖慢整個 hash。

為什麼越來越糟：key 只要 hash 進這一塊，就得一路走到 cluster 的尾巴；新資料又接在尾巴，團越滾越大，i 越來越大，要多 probe 好幾次。所以實務上希望 linear probing 的 load factor λ 小於 0.5（經驗值，不是硬性條件）。最壞情況（表快滿、大 cluster）搜尋可到 O(n)。

> **陷阱** 「open addressing 要 λ < 0.5 才能用」是錯的說法。linear probing 只要 λ < 1 就放得下，只是 λ 越大越慢；λ ≤ 0.5（且表大小為質數）是 quadratic probing **保證找得到空位**的條件。

解法很直覺：別只找隔壁，跳遠一點。

## 平均要 probe 幾次

### 例題：表大小 11，h(x) = x mod 11，已放 20、30、2、13、25、24、10、9

```
index : 0   1   2   3   4   5   6   7   8   9   10
內容  : 9   .   2   13  25  24  .   .   30  20  10
```

**成功搜尋**（key 在表裡）：

| key | h(x) | 探測路徑 | probe 次數 |
|---|---|---|---|
| 20 | 9 | [9] | 1 |
| 30 | 8 | [8] | 1 |
| 2 | 2 | [2] | 1 |
| 13 | 2 | [2] → [3] | 2 |
| 25 | 3 | [3] → [4] | 2 |
| 24 | 2 | [2] → [3] → [4] → [5] | 4 |
| 10 | 10 | [10] | 1 |
| 9 | 9 | [9] → [10] → [0] | 3 |

總和 1+1+1+2+2+4+1+3 = 15，平均 15/8 ≈ 1.88 次，不到 2 次。

> **陷阱** 25 mod 11 = 3，不是 4。[3] 已被 13 佔，25 要探到 [4] 才找到，是 2 次。

**失敗搜尋**（key 不在表裡）：

- find 0：[0] 是 9 不是；[1] 是空格 → 停，共 2 次。
- find 4：[4] 是 25、[5] 是 24 都不是；[6] 空 → 停，共 3 次。

把 11 個起點都算一遍：

| 起點 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| probe 次數 | 2 | 1 | 5 | 4 | 3 | 2 | 1 | 1 | 5 | 4 | 3 |

總和 31，失敗搜尋平均 31/11 ≈ 2.82 次。

> **重點** 失敗搜尋一定要走到空格才能停，所以比成功搜尋貴。

## Quadratic probing：跳 1、4、9

f(i) = i²：Hᵢ(k) = (h(k) + i²) mod ts。第 1 次跳 1 格，第 2 次跳 4 格，第 3 次跳 9 格，再來 16 格……i 的指數從 1 變成 2，所以叫 **quadratic probing（二次探測）**；前面也可以乘常數，例如 3i²、4i²。已經走越多格，就往越遠的地方找；先看隔壁，再到 4 格外、9 格外、16 格外。中間留一些空，讓原本該放那裡的放得進去，不會大家擠在一起。

### 例題：同一組 89、18、49、58、69（mod 10）

- 89 → 9、18 → 8。
- 49：9 已滿，i = 1：(9 + 1²) mod 10 = 0 → 放 [0]。到這裡跟 linear 一樣。
- 58：8、9 都滿，i = 2：(8 + 2²) mod 10 = 2 → 直接跳到 [2]。linear 時 58 還得多撞 [0]，quadratic 一次就跳過去。
- 69：9、0 都滿，i = 2：(9 + 4) mod 10 = 3 → 放 [3]。

```
index : 0   1   2   3   4   5   6   7   8   9
內容  : 49  .   58  69  .   .   .   .   18  89
```

### 再看一個例子：8、3、13、23（mod 10）

- 8 → [8]、3 → [3]。
- 13：i = 0 得 3 撞；i = 1：3 + 1 = 4 → 放 [4]。
- 23：i = 0 得 3 撞；i = 1：3 + 1 = 4 也撞；i = 2：3 + 4 = 7 → 放 [7]。

```
index : 0   1   2   3   4   5   6   7   8   9
內容  : .   .   .   3   13  .   .   23  8   .
```

元素落在離衝突處較遠的位置，中間留空（[5]、[6]），避免 clustering、改善搜尋時間。

> **陷阱** Quadratic probing 只消除 **primary clustering**。起點（hash 值）相同的 key 還是走同一條探測序列，這叫 **secondary clustering（次要聚集）**。

> **陷阱** Quadratic probing 不保證走遍整張表；**表大小為質數且 load factor ≤ 0.5** 時，才保證找得到空位。

## Double hashing：每個 key 步伐不同

Linear、quadratic 還是太有規律。**Double hashing（雙重雜湊）** 用另一個 hash function 決定步伐：

```
Hᵢ(k) = (h(k) + i · h₂(k)) mod ts
例：h₂(k) = 7 − (k mod 7)
```

拿 key 再算一次 h₂，不同的 key 算出不同步伐，再乘上 i。「離原位置多遠」不再只是 i 或 i²，而是跟一個較複雜的函數有關。

### 例題：表 11 格，h(k) = k mod 11，h₂(k) = 7 − (k mod 7)

假設 [3] 已經有人：

- 14：h(14) = 14 mod 11 = 3，撞了；步伐 h₂(14) = 7 − (14 mod 7) = 7 − 0 = 7；3 + 7 = 10 → 放 [10]。
- 25：h(25) = 25 mod 11 = 3，同樣撞；步伐 h₂(25) = 7 − (25 mod 7) = 7 − 4 = 3；3 + 3 = 6 → 放 [6]。

同一個起點，走不同的路。

> **觀念** Hash 中文叫「雜湊」，本來就有「切碎、打散」的意思。原本的 hash 把 key 打散到陣列裡；打散後還是擠在一起的話，double hashing 連「下一個位置」也打散開。

> **陷阱** 步伐 h₂(k) 不能是 0（否則原地打轉），最好跟表大小互質，例如表大小取質數、h₂(k) = R − (k mod R)（R 為比表小的質數）。

## Rehash：一串 hash function 輪流試

另一種 overflow 處理叫 **rehash**：準備多個 hash function h₁、h₂、…、hₘ。

1. i = 1，先用 h₁ 算位置。
2. bucket 滿了就 i = 2，改用 h₂。
3. 還是滿就 i = 3，用 h₃……一直試到 hₘ。

這個方法考試、考古題都常出。

> **陷阱** 「rehashing」有兩種意思：這裡是「一串 hash function 輪流試」；另一種是「load factor 太大時，換一張更大的表（例如兩倍大），把所有資料用新的 hash 重算放進去」（見下文表格長大與 rebuild）。題目要看清楚是哪一種。

## 刪除：要留墓碑

Open addressing 刪除時，**不能直接把格子清空**。

### 例題：在 89、18、49、58、9 那張表刪掉 49

```
刪除前 : 49  58  9   .   .   .   .   .   18  89
直接清空: .   58  9   .   .   .   .   .   18  89
```

接著 find 58：[8] 不是、[9] 不是、[0] 是空格 → 停，判定「不在」。可是 58 明明在 [1]：清空的格子切斷了 probe sequence。

正確做法是 **lazy deletion（延遲刪除）**：在格子上放**墓碑（tombstone）**，標記「這裡曾經有人」。

```
放墓碑 : ✝   58  9   .   .   .   .   .   18  89
```

- 搜尋經過墓碑時繼續往下找（墓碑不是空格）。
- insert 時墓碑可以重複使用，當成可放資料的位置。

## 哪一種比較好？

哪一種最好？老實說不知道，要看應用。做 open addressing 的話，很多時候 quadratic probing 就已經有不錯的效果。實務上是先用簡單的 design，發現碰撞太嚴重，才往複雜的移：

- hash code：sum → polynomial → cyclic。
- open addressing：linear → quadratic → double hashing。

回顧 collision 的處理：從「不理他」的容錯，到 secondary storage（另外的資料結構，如 chain），再到 open addressing。概念都很簡單，難的是怎麼測試、怎麼確保真的跑得快；hash function 與 probing 性質的證明屬於進階課程的內容。

> **觀念** 隨機測試：monkey test 是隨機測試的一種，用亂數產生輸入去測程式；怎麼設計隨機測試本身也是學問。

問：猴子排序法（monkey sort，隨機打亂直到排好）有實際用途嗎？
答：當排序法沒有，但背後「隨機模擬」的想法可以用來估計某個結果多容易自然產生；在其他計算模型（例如量子電腦）下，隨機模擬的想法可能有用。

## Load factor：表有多滿

Hash 也叫 hash table，兩種叫法都有，table 指的就是 array。表有 k 格，放了 n 個 key，看 n / k，也就是平均每格放幾個 key：

```
load factor α = n / k        （有些書寫 λ）
```

- n / k 越小越不會撞。例如 5 個 key、10 格（示意）：α = 0.5，不太會撞。
- n = 100、k = 10：每格 10 個，hash 就不 work 了。

> **重點** Open addressing（linear／quadratic probing、double hashing）每格只放一個，所以 n ≤ k、α ≤ 1；chaining 每格是一條 list，α 可以大於 1。

另一種壞情況是 **non-uniform**：hash 沒把資料分散開，例如 100 筆資料只擠在 3 格，每格 30 幾個，碰撞就很多。所以要小心兩件事：**n / k 太大**，或 **hash 不夠均勻**。

實務上要檢查 hash 是不是常塞在同一個地方：

- 常塞同一處 → 改進 hash function，讓它更亂、更分散。
- 東西太多、格子太少，比例不對 → 東西就是那麼多，只能增加格子數量。不可能用十格塞下 100 萬筆資料。

很多時候甚至希望 k 比 n 大：k > n 且 hash 夠分散，幾乎一人一格、沒有 collision，map 就像 integer array 一樣方便。這叫**用空間換時間**。

## 表太滿就長大兩倍

實際系統裡資料越來越多，n 增加，n / k 跟著增加，表就開始不堪負荷，就像 vector 塞滿了要 request 額外記憶體、要長大。Load factor 太大時，乾脆增加 k。

借 vector 的經驗：不要一次只加一點，直接把新的 k 設成舊的 **兩倍**。偶爾搬一次，均攤下來還是便宜。

步驟：

1. **Change range**：k 變兩倍，h(key) 的範圍要從 0～k−1 改成 0～2k−1（例如 mod 4 改成 mod 8）。
2. **Rebuild**：建新表，把舊表的東西一個個拿出來，用新的 hash 塞進去。

### 例題（示意）：6 個 key 放在 4 格

key：3、7、11、2、6、9，h(x) = x mod 4。

```
mod 4（k = 4，α = 6/4 = 1.5，太大）
[0]
[1] → 9
[2] → 2 → 6
[3] → 3 → 7 → 11
```

長成 8 格，改 mod 8，全部重放：

```
mod 8（k = 8，α = 6/8 = 0.75）
[0]          [4]
[1] → 9      [5]
[2] → 2      [6] → 6
[3] → 3 → 11 [7] → 7
```

## Full rebuild：關門整理

Rebuild 有 n 筆資料；hash 夠平均的話，每筆 insert 大約常數時間（時間只花在算 hash code，跟資料量幾乎無關），整個 rebuild 就是 **O(n)**。

通常 load factor 超過某個門檻才長大兩倍，不常做，整體還划算。缺點是整張舊表要搬到新的地方，花 linear 的力氣，使用者那端要 **long waiting**。

> **比喻** 店面說：「等一下，我先關門整理，整理完再開店。」

## Partial rebuild：只拆滿出來的地方

Long waiting 是 full rebuild 造成的。能不能不要整張重建？改做 **partial rebuild**：只 rebuild 有問題的 entry。

前提是**新舊 hash function 要有關係**，不然所有位置都亂掉，還是得全搬。

### 關鍵：mod k 換成 mod 2k

假設 hash 是算完 hash code 後直接 mod k。把 x 寫成 x = q·k + r（r = x mod k）：

- q 是偶數 → x mod 2k = r，跟原來一樣。
- q 是奇數 → x mod 2k = r + k。

也就是說，**x mod 2k 一定是 x mod k，或 x mod k + k**。k 是 2 的冪時，兩者只差 hash code 的一個 bit。新位置落在 0～k−1 的不用動，只有變成「原位置 + k」（落在 k～2k−1）的才要搬。

> **例題**（示意）k = 4 → 8：9 mod 4 = 1，9 mod 8 = 1（不動）；13 mod 4 = 1，13 mod 8 = 5 = 1 + 4（搬到 [5]）。

### 例題：at、eat、egg

4 格的表，hash code = key 的第 0 個字元減 'a'（就是開頭字母排第幾：a 是 0、b 是 1、c 是 2……e 是 4），再 mod 4。每格用 linked list（chain）畫：

- at（a 開頭，0）、eat（e 開頭，4 mod 4 = 0）都在 [0]。
- bird（b，1）放 [1]。
- good（g，6 mod 4 = 2）和 cat（c，2）放 [2]。
- dog（d，3）放 [3]。

insert egg：e 開頭，4 mod 4 = 0，接到 [0]。這條 chain 本來就有 2 個，再放第 3 個覺得太滿，想要 rebuild，把表變大兩倍。

```
mod 4，insert egg 之後
[0] → at → eat → egg      ← 太滿
[1] → bird
[2] → good → cat
[3] → dog
```

**Full rebuild 成 8 格**：多了 4、5、6、7，全部重新看一遍，改成 mod 8。a、b、c、d 開頭（hash code 0～3）留在原位；eat、egg（4）到 [4]，good（6）到 [6]。每一個東西都拜訪過，這就是 full rebuild 的計算量。

```
full rebuild（mod 8）
[0] → at        [4] → eat → egg
[1] → bird      [5]
[2] → cat       [6] → good
[3] → dog       [7]
```

**Partial rebuild**：一樣長成 8 格。

1. good 那條 chain 還沒滿，先不動，good 留在 [2] 的 chain 上。
2. 滿出來的是長度 3 的 [0]：只重建這條，把 eat、egg 拿出來放到 [4]，at 留在 [0]。
3. 可是之後要找 good，會從 [6] 進來（good 的 hash code 是 6，6 mod 8 = 6）。所以把 [6] 的「小紙條」（指標）接到 [2] 原本那條 chain；同理 [7] 接 [3]、[5] 接 [1]。

```
partial rebuild（mod 8）
[0] → at
[1] → bird            [5] → 共用 [1] 的 chain
[2] → good → cat      [6] → 共用 [2] 的 chain
[3] → dog             [7] → 共用 [3] 的 chain
[4] → eat → egg       （從 [0] 分家出來）
```

1、2、3 跟 5、6、7 還沒分家，繼續共用原本連好的資料；只有 overflow 的地方（[0]）才拆成 0 跟 4 兩條分家。這種共用的做法用其他 data structure 也可以。

### Partial rebuild 的成本

- 花 k 的力氣接好那些小紙條；
- 再花大約 n/k 的力氣拆開 overflow 的那條。

總共 k + n/k，n 不少時可能比 full rebuild 的 n 小很多。例如（示意）n = 10000、k = 100：full rebuild 要 10000，partial 大約 100 + 100 = 200。

這樣就做出一個可以長大的 **extendable hash table**。代價是要多寫程式，maintain 誰還沒分家、要分家的東西怎麼搬。

> **觀念** 這裡的 extendable hash table 是 partial rebuild 的版本；教科書的 extendible hashing（用 directory、global/local depth）精神相近，但細節不同。

## Static hashing 與 dynamic hashing

Hash 分兩大類：

- **Static hashing（靜態雜湊）**：hash function 一旦決定就一成不變，不管資料的 distribution 如何，就算全擠在某一格，也照用同一個。前面講的常用 hash function 與 collision／overflow 處理都屬於這一類。
- **Dynamic hashing（動態雜湊）**：依資料的 distribution 自動調整 hash function：bucket 滿了就分裂，hash 的結果跟著變。做法有用 trie 的，也有 directoryless 的。

資料庫（database）的資料一直在變，事先選好一個合適的 static hash function 又很難，所以資料庫常用 dynamic hashing。

## Dynamic hashing：讓資料決定 hash function

前面的做法都是 static hashing：hash function 事先選好、固定不變。可是針對資料庫某個欄位，要事先選一個好的 static hash function 非常困難。Dynamic hashing（動態雜湊）改讓**資料的分佈**決定 hash，同時保留 hash 快速擷取資料的好處，所以在 database 裡更常用。

### Key 的二進位表示

例子的 key：A0、A1、B0、B1、C0、C1、C2、C3、C5。每個 key 寫成二進位：前 3 個 bit 代表字母，後 3 個 bit 代表數字。

| key | 字母 | 數字 | 二進位 |
|---|---|---|---|
| A0 | 100 | 000 | 100 000 |
| A1 | 100 | 001 | 100 001 |
| B0 | 101 | 000 | 101 000 |
| B1 | 101 | 001 | 101 001 |
| C0 | 110 | 000 | 110 000 |
| C1 | 110 | 001 | 110 001 |
| C2 | 110 | 010 | 110 010 |
| C3 | 110 | 011 | 110 011 |
| C5 | 110 | 101 | 110 101 |

> **陷阱** 編碼以課本為準：A = 100、B = 101、C = 110（不是「A 是 16 進位的 10」）。所以 A0 = 100 000、C5 = 110 101。

分 bucket 時看的是**最右邊**的 bit（least significant bit，最低位），再往左看第 2 個、第 3 個 bit。例如 A0、B0 最右兩個 bit 都是 00。依最右邊幾個 bit 決定丟進哪一桶，這跟 bucket sort 看數字最後幾位決定放哪一桶的想法很像。

### Trie：從最右邊的 bit 讀起

這個 hash function 本身就是一棵樹，這種樹叫 **trie**。讀 key 的方式是**從最右邊的 bit 往左讀**；在這個例子裡，讀到 0 往上走、讀到 1 往下走。每個 bucket 最多放 2 筆。

依序 insert A0、B0、C2、A1、B1、C3 六個 identifier：

- A0、B0 右數第 1 個 bit 是 0 → 往上；A1、B1 是 1 → 往下，樹長出上下兩支。
- C2（…010）、C3（…011）進來後 bucket 不夠放，再分一層，用右數第 2 個 bit 區分。

結果 trie 長成兩層，每個 bucket 用最右 2 個 bit 區分：

```
                 ┌─0─ [A0, B0]   …00
       ┌─0───────┤
       │         └─1─ [C2]       …10
root ──┤
       │         ┌─0─ [A1, B1]   …01
       └─1───────┤
                 └─1─ [C3]       …11

（第 1 層看右數第 1 個 bit，第 2 層看右數第 2 個 bit；0 往上、1 往下）
```

> **例題** 找 A0 = 100 000。最右兩個 bit 是 00：從 root 往上、再往上，走到 [A0, B0] 這個 bucket，在裡面找到 A0。B0 = 101 000 最右兩個 bit 也是 00，所以和 A0 在同一個 bucket。

### Overflow 就 split：insert C5

Insert C5 = 110 101：

1. 右數第 1 個 bit 是 1 → 往下。
2. 右數第 2 個 bit 是 0 → 往上，走到 [A1, B1]。
3. 這個 bucket 已有兩筆 → **overflow**。
4. 從這個 bucket 再長出上下兩個分支，叫 **split**（分裂）：往上是 0、往下是 1。
5. A1、B1、C5 依右數第 3 個 bit 重新分配：A1 = …001、B1 = …001 留在 0 那支；C5 = …101 放進新的 bucket。

```
                 ┌─0─ [A0, B0]        …00
       ┌─0───────┤
       │         └─1─ [C2]            …10
root ──┤
       │                   ┌─0─ [A1, B1]   …001
       │         ┌─0───────┤
       └─1───────┤         └─1─ [C5]       …101
                 └─1─ [C3]            …11
```

> **重點** 兩個規則：① overflow 就 split；② split 完要依 bit 重新調整資料。

### 再 insert C1：hash function 隨資料長大

Insert C1 = 110 001：從最右邊讀，1 往下、0 往上、0 往上，走到 [A1, B1]。Bucket 滿了 → overflow → split，改看右數第 4 個 bit：

- A1 = 100 001，最右 4 bit = 0001
- C1 = 110 001，最右 4 bit = 0001
- B1 = 101 001，最右 4 bit = 1001

所以 A1、C1 在一起，B1 分到另一桶：

```
                 ┌─0─ [A0, B0]                 …00
       ┌─0───────┤
       │         └─1─ [C2]                     …10
root ──┤
       │                             ┌─0─ [A1, C1]   0001
       │                   ┌─0───────┤
       │         ┌─0───────┤         └─1─ [B1]       1001
       └─1───────┤         └─1─ [C5]            …101
                 └─1─ [C3]                     …11
```

> **陷阱** A1、C1 放在一起，不是因為上一回合就在一起，而是因為右數 4 個 bit 相同。若把 bit 從右往左「念」，0001 會念成「1000」，意思一樣；照一般寫法，最右 4 bit 是 0001，B1 是 1001。

這整棵 trie 就是 hash function，它會隨著 insert 的資料長大，不是固定的；資料減少時也可以 merge（合併）把樹縮回去。

> **觀念** Trie 的缺點：每次 access 都要 traverse 這棵樹，時間跟樹高有關；資料長得不好時，trie 還會 skew（歪向一邊），access 就要花很長時間。

> **重點** 最基本要會的：給一組 key，能把它畫成 trie。後面的 directory、directoryless 都是從 trie 延伸出來的。

## Extendible hashing：把 trie 換成 directory

每次 traverse trie 太慢，改進的方法叫 **extendible hashing**（可擴充雜湊）：建一個目錄 **directory**，不再走樹。

Trie 末端連到 bucket 的那些線其實都是 pointer。把每條路徑編號，每個編號對應一個指到 bucket 的 pointer，整棵樹就可以換成一張 table。

- 上面的 trie 最多長到 4 層，所以用 4 個 bit 編號，共 2⁴ = 16 個 entry。這個 4 叫 directory 的 **global depth**。
- 每個 bucket 記自己的 **local depth**：這個 bucket 實際用到最右幾個 bit。
- Local depth 小於 global depth 的 bucket，會被好幾個 entry 指到。

| entry（最右 4 bit） | 指到的 bucket | local depth |
|---|---|---|
| 0000、0100、1000、1100 | [A0, B0]（…00） | 2 |
| 0010、0110、1010、1110 | [C2]（…10） | 2 |
| 0011、0111、1011、1111 | [C3]（…11） | 2 |
| 0101、1101 | [C5]（…101） | 3 |
| 0001 | [A1, C1]（0001） | 4 |
| 1001 | [B1]（1001） | 4 |

例如 entry 0000、0100、1000、1100 都指到 A0、B0 那桶，因為那桶只看最右 2 個 bit（00），local depth 是 2。有些 entry 對應的位置暫時沒有資料，但仍指向對應的 bucket。

> **例題** 用 directory 找 C1 = 110 001：取最右 4 bit = 0001，查 entry 0001，直接拿到 pointer → [A1, C1] 這桶。不用走樹，這就是 extendible hashing。

## Directoryless dynamic hashing

Pointer 也很麻煩：還要記錄它指到哪個 memory address。更快的做法連 pointer、連目錄都不要，叫 **directoryless dynamic hashing**：key 對應到的不再是 pointer，而是直接一個 memory address。

- 從右邊數過來的兩個 bit，就是它的 memory address：…00 對應 address 00，…01 對應 01，…10、…11 依此類推。
- 這樣也可能 overflow，overflow 時用 linked list 串起來，也就是用 chaining 解決。

（示意）沿用前面的 key，bucket 大小 2：

```
address 00 : [A0, B0]
address 01 : [A1, B1] → C5 → C1     ← C5（…01）、C1（…01）進來時 01 已滿，掛成 chain
address 10 : [C2]
address 11 : [C3]
```

> **觀念** 課本的 directoryless（又稱 linear hashing）除了把 overflow 掛成 chain，還會依序 split bucket，讓位址空間逐步加倍。

## Hash index：資料庫怎麼找到 Chris

Database 最常見的表示法是 table：每一列（row）是一筆資料，每一欄（column）是一個 attribute。例如帳號資料表有 sid、name、login、age、gpa 五欄，它也是一種 symbol table。

- **Cardinality**＝列數（這個例子 3 列）。
- **Degree**＝attribute 的個數（sid、name、login、age、gpa，共 5）。

資料一多就不簡單：要在一萬筆裡找名字叫 Chris 的那筆，取出他的 sid、login、age、gpa，第一步是先找到 Chris 在哪。其中一種做法是 **hash index**。

> **比喻** Index（索引）就像圖書館的書架分類：要找書名 D 開頭的書，就去 D 那個書架找。那個書架就是一個 bucket，D 開頭的書都在裡面。

對 name 欄位建 hash index，hash function 用 26 個字母的順序（A → 0、B → 1、…）：

| name | 首字母 | bucket |
|---|---|---|
| Chris | C | 2 |
| Jones | J | 9 |
| Smith | S | 18 |

找 Chris：C 開頭 → bucket 2 → 在 bucket 2 的 linked list 裡找到 Chris。找到後通常不是直接拿到全部資料，而是再透過一個 pointer 到檔案裡，抓其他 attribute（login、age、gpa）。

> **重點** Index 對 database 很重要：沒建 index，資料一多查詢可能要好幾分鐘；建了 index 幾乎立即出結果。

檔案在 disk 上的存放方式（參考）：用 fixed-length record（固定長度的紀錄）存放，透過 hash 知道要怎麼 access。這部分屬於資料庫課程的內容。

## 整章比較：各種做法一覽

整章的出發點：像 array 一樣，用 index 放 value、取 value。但 key 不是整數、沒有 order，甚至長度可變（variable length），array 沒辦法直接用，所以：

1. 先把 key 轉成整數，叫 **hash code**；hash code 最重要的目的是**分散**，讓 key 用到 array 的各個位置。
2. 整數範圍太大放不進 array，再 **compress** 到 k 格的範圍。
3. 放進去時那格已經有人 → collision，要有處理方式。
4. 表越來越滿 → 讓表長大（extendable hash table），collision 就少一點；這也可以看成另一種 collision handling。

| 步驟 | 做法 |
|---|---|
| hash code | sum、polynomial evaluation、cyclic shift |
| compress | mod k |
| 課本三種 hash function | mid-square、division、folding |
| collision／overflow：另外裝 | 容錯不理；用 array、linked list 等 secondary 結構裝起來（chaining） |
| collision／overflow：用表內空格 | open addressing：linear probing、quadratic probing、double hashing |
| 表太滿：長大兩倍 | naive：full rebuild；partial：只在 overflow 的地方 rebuild（同 extendable array 的 double the table） |
| static hashing | hash function 固定；以上 hash function、chaining、open addressing 都屬於此 |
| dynamic hashing：trie | hash 到的 bucket 隨資料改變；overflow 就 split；缺點是要 traverse trie |
| dynamic hashing：directory | extendible hashing，查表拿 pointer，不走樹 |
| dynamic hashing：directoryless | 右數幾個 bit 直接當 memory address，overflow 用 chain |

### Collision 與 overflow 的差別

問：collision 和 overflow 一樣嗎？
答：可以把它們想成兩種「現象」。

- **Collision**：兩筆資料經過 hash function 對應到同一個 bucket。Bucket 有限、資料很多，所以 collision 一定會發生，讓它發生沒關係。
- **Overflow**：bucket 已經塞滿了還要再塞。Collision 不代表 overflow：bucket size 夠大，頂多多塞幾個。最怕的是 overflow。

> **陷阱** Bucket size = 1 時，看到 collision 就等於看到 overflow，因為兩筆只能放一筆。

問：bucket size 和 linked list 有什麼不同？
答：bucket 可以是一塊 memory 空間，資料直接存放在裡面；linked list 則是靠 pointer 把資料一筆一筆連起來。

> **觀念** 用 linked list 實作 map（key-value 對應）的另一種方法是 skip list，屬於延伸主題。

## 延伸：另一種索引——binary search tree

Hash 是對資料建索引、快速抓某個欄位資料的一種方法。另一種是對名字建 **binary search tree**（BST，二元搜尋樹），這是一種 search structure。每個 node 仍要有 pointer，指到 disk 或 memory 裡真正存放其他欄位的地方。常見的平衡搜尋樹有 AVL tree，資料庫還常用 B+ tree。

BST 依英文字母比大小：比較小的放左邊、比較大的放右邊。第一個輸入的成為 root，樹從空的照輸入順序慢慢長出來。**BST 長得好不好，要看輸入順序的運氣。**

### 例題：JAN 先進來

輸入順序：JAN、FEB、MAR、APR、MAY、JUNE、JULY、AUG、SEPT、OCT、NOV、DEC。JAN 成為 root；FEB 比 JAN 小放左邊；MAR 比 JAN 大放右邊；其餘依此類推。

```
                JAN
              /     \
           FEB       MAR
           /        /   \
         APR     JUNE    MAY
           \     /          \
           AUG JULY         SEPT
             \              /
             DEC          OCT
                          /
                        NOV
```

一個 node 要比較幾次才找到，就是它在第幾層。找 NOV：跟 JAN 比（較大往右）→ MAR（往右）→ MAY（往右）→ SEPT（往左）→ OCT（往左）→ NOV，共比 **6 次**，它是最深的 node。

| 層 | node | 比較次數小計 |
|---|---|---|
| 1 | JAN | 1 |
| 2 | FEB、MAR | 4 |
| 3 | APR、JUNE、MAY | 9 |
| 4 | AUG、JULY、SEPT | 12 |
| 5 | DEC、OCT | 10 |
| 6 | NOV | 6 |

平均 = 42 ÷ 12 = **3.5 次**。

### 例題：JULY 先進來

輸入順序：JULY、FEB、MAY、AUG、DEC、MAR、OCT、APR、JAN、JUNE、SEPT、NOV。

```
                  JULY
               /        \
            FEB          MAY
           /   \        /   \
         AUG   JAN    MAR   OCT
        /   \         /     /  \
      APR   DEC    JUNE   NOV  SEPT
```

最多比 **4 次**；平均 = (1 + 2×2 + 3×4 + 4×5) ÷ 12 = 37 ÷ 12 ≈ **3.1 次**。這個順序長得蠻 balanced。

### 例題：照字母順序輸入

輸入 APR、AUG、DEC、FEB、JAN、JULY、JUNE、MAR、MAY、NOV、OCT、SEPT：每個都比前一個大，全部往右長，整棵 skew 成一條，等於 linked list。最多比 **12 次**，平均 = (1 + 2 + … + 12) ÷ 12 = 78 ÷ 12 = **6.5 次**。

> **重點** 同樣 12 個 key：平均 3.5（JAN 先）、3.1（JULY 先）、6.5（照字母順序）。BST 的效能受輸入資料順序影響。

## 延伸：AVL tree

BST 長得不好，搜尋就慢。要增進效能，就在輸入資料時對樹做調整，讓樹 balance。**AVL tree** 就是一種 balanced binary search tree（height-balanced）。

一棵非空的 binary tree T，左右子樹為 T_L、T_R，高度為 h_L、h_R。T 是 AVL tree 若且唯若：

1. T_L、T_R 也都是 height-balanced（recursive 定義：每一個 node 都要符合）。
2. |h_L − h_R| ≤ 1。高度就是從該 node 往下最多有幾層。

為了方便檢查和調整，定義 **balance factor**（平衡因子）：

```
BF(node) = 左子樹高度 − 右子樹高度
```

AVL tree 裡每個 node 的 BF 只能是 1、0、−1；BF 大於 1 或小於 −1 就是不 balance。

> **例題** JAN 先進來的那棵：root JAN 左子樹高 4（FEB→APR→AUG→DEC）、右子樹高 5（MAR→MAY→SEPT→OCT→NOV），BF = −1，看似沒事。但 FEB 左子樹高 3、右子樹空，BF = 3；MAY 左子樹空、右子樹高 3，BF = −3。所以它不是 AVL tree。JULY 先進來的那棵，每個 node 的 BF 都在 −1～1 之間，是 AVL tree。

> **陷阱** BF 要**每個 node** 都檢查，不能只看 root。

## 延伸：heap 與 max tree 差在哪

問：heap 和單純的 max tree 差在哪？
答：差在有沒有 complete。

- **Max tree** 只要求每個 node 都比它下面的人大：root 最大，每棵 subtree 的 subroot 也是那棵裡最大的。除此之外什麼都不保證，尤其不保證樹高。最壞從 root 走到 leaf 要 O(n)；每個 node 只有一個小孩時，樹就退化成一條 linked list。
- **Heap** 多一個嚴格限制：一定是 **complete binary tree**（每一層由左到右排滿，只有最後一層可以沒排滿）。同樣 n 個 node，complete binary tree 已是最矮的排法，樹高約 log₂n（1000 個 node 也才 10 層左右）。

Heap 的每個操作都只沿著一條從上到下的路走，步數跟樹高一樣，所以 insert、remove 都是 O(log n)。

### 回顧：priority queue 與 max heap

**Priority queue**（優先佇列）每次拿出來的是最優先的那個，不是先進先出：作業快截止了，就先做作業。Max heap（complete binary tree ＋ max tree）是實作它的一種方法。

- **Insert**：新元素先放在最後一格（保持 complete），再跟 parent 比，比較大就交換往上浮，叫 **sift up**。例如新來的 8 跟 parent 5 比，8 較大、交換；再跟上面的 9 比，比不過就停。最多往上打樹高那麼多層 → O(log n)。
- **removeMax**：拿走 root（最大值），把最後一個元素搬到 root 補位（保持 complete），再跟兩個小孩中較大的比、交換往下沉，叫 **sift down**。例如補位的 5 跟較大的小孩 8 交換。最多沉樹高那麼多層 → O(log n)。

> **陷阱** Max heap 刪除的是**最大值**（removeMax），不是 remove min。

## 延伸：amortized 分析

### 目標：insert 只花 constant

新目標：insert 只花 constant（跟資料量無關，O(1)）的力氣，同時拿出時還要很快找到最大值並移掉。

- 完全不整理最快：隨手一丟，1 步放好。但拿最大值時只能一個個看過，O(n)。
- 資料結構的基本取捨：要找得快，放進去時就得先做一點整理，而整理要花力氣。
- 每一次都只准花 constant 又要很快找到最大，是很難的（但不是說不可能）。

> **比喻** 每天只准整理房間一分鐘，但弄亂的速度更快，房間就永遠整理不好。規定「每次只准整理 10 步」，資料一多就整理不完。

可行的方向是 **amortized constant**：不是每一次都便宜，而是平均下來每次只花固定的力氣。

### Amortized（均攤）：extendable array 一次長兩倍

**Amortized** 就是均攤：偶爾一次花很多，大部分時候花很少，把大花費平均分給每一次操作，平均每次只花固定的力氣，就叫 amortized O(1)。

Extendable array 滿了**不要只加一格，而是直接長成兩倍**：開新空間、把舊的搬過去。搬家很貴，但只是偶爾發生。

| 放第幾個 | 放之前容量 | 動作 | 搬家步數 | 放的步數 |
|---|---|---|---|---|
| 1 | 1 | 直接放 | 0 | 1 |
| 2 | 1（滿） | 開 2 格，搬 1 個 | 1 | 1 |
| 3 | 2（滿） | 開 4 格，搬 2 個 | 2 | 1 |
| 4 | 4 | 直接放 | 0 | 1 |
| 5 | 4（滿） | 開 8 格，搬 4 個 | 4 | 1 |
| 6、7、8 | 8 | 直接放 | 0 | 各 1 |

放 8 個：放東西 8 步 ＋ 搬家 1 + 2 + 4 = 7 步，共 15 步，15 ÷ 8 不到 2，平均每次是固定的力氣 → amortized O(1)。

接下來把同樣的均攤想法用在設計 priority queue 上。

## 延伸：binomial heap

### 想法：大部分時候插進小樹

- 什麼時候 heap 的 insert 很貴？樹很大的時候：一棵 264 個 node 的 complete binary tree 放第 265 個，新元素可能要往上打好幾層（約 log₂265 ≈ 8 層）。
- Heap 很小（例如 5 個 node）時，新元素最多打 2 層就到頂，很便宜。
- 所以設計成 **insertion to small tree usually**：cheap insertion 常常發生（最好每輪都是），expensive insertion 只偶爾發生。
- 把一棵大樹拆成一些小樹和一些大樹，新資料通常放進小樹；小樹都滿了，才併進大一點的樹。
- 一個資料結構裡有很多棵樹，叫**森林（forest）**。

### Binomial tree 的定義

**Binomial tree** 是形狀事先定義好的樹（binomial 是「二項式」，也跟二進位很有關係）：

- B₀：只有一個 node。
- B₁：一個 root，下面接一棵 B₀。
- B₂：一個 root，下面接 B₀ 和 B₁。
- B₃：一個 root，下面接 B₀、B₁、B₂。
- 一般地，B_k 的 root 下面接 B₀、B₁、…、B_{k−1}。

Node 數：B₀ = 1、B₁ = 2、B₂ = 4、B₃ = 8，**B_k 剛好 2ᵏ 個 node**。

另一種看法：**兩棵一樣的 B_k 接起來就是一棵 B_{k+1}**（一棵的 root 掛到另一棵 root 下面）。B₁ 是兩棵 B₀、B₂ 是兩棵 B₁、B₃ 是兩棵 B₂。

> **比喻** 很像玩 2048：兩個一樣的合成一個大一號的（small tree + small tree → big tree）。

> **觀念** 跟 Huffman coding 也有點像（小樹合成大樹），但 Huffman 的樹形由資料決定，binomial tree 的長相是事先定義好的。

B₃ 的長相（用字母代表 node）：

```
            a
         /  |  \
        b   c   d          a 的小孩：b（B₂）、c（B₁）、d（B₀）
       / \  |
      e   f g              b 的小孩：e（B₁）、f（B₀）；c 的小孩：g（B₀）
      |
      h                    e 的小孩：h（B₀）
```

B₃ 的 root 有 3 個小孩，所以 binomial tree **不是 binary tree**，而是 general tree（multi-way tree）。也可以看成兩棵 B₂（a-c-d-g 與 b-e-f-h）合起來。

### 用 left child, right sibling 存

General tree 可以用 binary tree 的方式存，每個 node 只記兩個指標：

- **往左**：指到自己的第一個小孩（left child）。
- **往右**：指到自己的下一個兄弟（right sibling）。

一個 node 的所有小孩就被串成一條 linked list。上面的 B₃：

```
a
└─left→ b ─right→ c ─right→ d
        │         │
        left      left
        ↓         ↓
        e ─right→ f        g
        │
        left
        ↓
        h
```

從 root 往左走到第一個小孩，再一直往右走就找到所有小孩。示意圖好解釋，真正寫程式時，線怎麼接、誰排第一還有細節要注意。

### Binomial forest：二進位決定有哪些樹

問：要存的資料不是剛好 2ᵏ 個，還能用 binomial tree 嗎？

以前 heap 也遇過同樣的問題：full binary tree 只能有 1、3、7、15… 個 node，當時的解法是改用 complete tree。Binomial tree 也只能有 1、2、4、8、16… 個 node，這次的解法是 **forest**：用好幾棵樹湊出想要的數字。用 1、2、4、8… 湊出任意數字，就是**十進位轉二進位**。

**Binomial forest** 規定每一種 B_k 最多一棵（0 棵或 1 棵），正好對應二進位每一位的 0 或 1。整數和二進位表示一對一，所以任何 n 個 node 都能用一座 binomial forest 表示，而且 **forest 裡有哪些樹由 n 決定、是固定的**，會變的只是樹裡放的數字。

| n | 二進位 | forest |
|---|---|---|
| 9 | 1001₂ | B₃ ＋ B₀ |
| 10 | 1010₂ | B₃ ＋ B₁ |
| 17 | 10001₂ | B₄ ＋ B₀ |

> **陷阱** 1 個 node 的樹是 **B₀** 不是 B₁，所以 9 = 8 + 1 是 B₃ ＋ B₀。17 不能拆成 8 + 9，每種 B_k 最多一棵，只能是 16 + 1 = B₄ ＋ B₀。

### Binomial heap：每棵都是 max tree

要把 binomial tree 變成 heap，就在每個 node 放數字，並讓它滿足 max tree 性質（min heap 則改成 min tree 性質）。因為是 multi-way tree，這裡用的是 max 的 multi-way tree：例如 root 30 下面有 3 棵 subtree，30 要比這 3 棵裡所有人都大；進到每棵 subtree，它的 subroot 也要是那棵裡最大的，一層層都成立。

> **重點** Binomial forest ＋ 每棵都是 max tree ＝ **binomial heap**。可以說是「heap 中的 heap」。

### 例題：從空的 max binomial heap 依序 insert 5、7、3、2

```
insert 5（n = 1 = 1₂）     B₀: 5

insert 7（n = 2 = 10₂）    兩棵 B₀ 打一架，7 贏放上面 → B₁
                           7
                           |
                           5

insert 3（n = 3 = 11₂）    2 + 1 沒有進位，3 自己當 B₀
                           B₁: 7      B₀: 3
                               |
                               5

insert 2（n = 4 = 100₂）   3 + 1 連續進位：
  步驟 1：B₀ 3 vs B₀ 2 → 3 贏 → B₁(3─2)
  步驟 2：B₁ 7 vs B₁ 3 → 只比兩個老大，7 贏，3 整棵掛到 7 下面 → B₂
                               7
                              / \
                             3   5
                             |
                             2
```

- Insert 7 也可以看成：新來的 7 自己是一座只有 B₀ 的小 forest，insert 就是把兩座 forest 合併（merge）。
- Insert 2 時不能有兩棵 B₀，必須合成 B₁；又碰上原本的 B₁，再合成 B₂，就像二進位連續進位。
- 合併兩棵樹只要**老大（root）出來單挑**，下面的小嘍囉不用動。檢查結果：每個 node 都比下面的人大，仍是 max tree，是只有一棵 B₂ 的 binomial heap。

### 為什麼 insert 是 amortized O(1)

每輪 insert 都是把一棵 B₀ 塞進 forest；原本已有同 order 的樹就要 merge，有時要連續 merge 兩次以上，就像二進位計數器 +1 時的進位。

| 第幾次 insert | n（二進位） | 這次的 merge 次數 |
|---|---|---|
| 1 | 1 | 0 |
| 2 | 10 | 1 |
| 3 | 11 | 0 |
| 4 | 100 | 2 |
| 5 | 101 | 0 |
| 6 | 110 | 1 |
| 7 | 111 | 0 |
| 8 | 1000 | 3 |

做 N 輪 insert：

- 放 B₀：每輪 1 次，共 N。
- Merge：B₀ + B₀ 每 2 輪一次（偶數輪），B₁ + B₁ 每 4 輪一次，B₂ + B₂ 每 8 輪一次，越高位越少進位。總共 n/2 + n/4 + n/8 + … ≤ n（上表 8 輪共 4 + 2 + 1 = 7 次）。
- N 次 insert 共 O(N)，平均每次 **O(1)**，即 amortized O(1)。

最貴的情況：B₀～B₄ 都有（11111₂），再放一棵 B₀ 會一路連鎖合併 5 次（11111₂ + 1 = 100000₂）。這次很貴，但很少發生。

問：上面假設每次 merge 是 constant，真的做得到嗎？
答：可以。兩棵 max binomial tree 合併只要兩個老大打一架，贏的當新老大，輸的整棵掛到它下面當新小孩，其他結構完全不動。技巧在小孩的排法：**把 order 最高的小孩放最左邊**，依序往右排。輸的那棵剛好是新的最高 order，直接插在小孩串列的最前面，就像 linked list 的 insert at head，O(1)。

> **觀念** 這是第二次用到 amortized analysis（第一次是 extendable array）：有時多花，平均起來只花一點點。

### 合併兩個 binomial heap ＝ 二進位加法

Binomial heap 最重要的性質是 node 總數跟二進位一一對應（例如 5 = 101₂ 就是 B₂ ＋ B₀）。所以一直 insert 就像加法器一直 +1；兩個 binomial heap 也能很容易合起來，就是兩個二進位數相加。

> **比喻** 你有學校的 to-do list 和約會的 to-do list，兩個都是 priority queue，有時要合成一個再決定先做什麼。

> **例題** 101₂（B₂ 的 root 是 9，外加一棵 B₀）＋ 011₂（B₁ 的 root 是 7，外加一棵 B₀），兩棵 B₀ 分別是 8 和 1。從最低位開始加：B₀ 的 8 和 1 打一架，8 贏 → 進位成 B₁；再跟 7 那棵 B₁ 打，8 贏 → 進位成 B₂；最後跟 9 那棵 B₂ 打，9 贏 → 一棵 B₃。101₂ + 011₂ = 1000₂（5 + 3 = 8）。

在「合併兩個 priority queue」這件事上，binomial heap 比用 complete tree 做的 heap 方便得多。

### getMax：老大中的老大

每棵都是 max tree，各有自己的老大（root），最大值一定是某棵的老大。用 sequential search 把每棵的老大問一遍就知道。

要問幾個老大？就是 forest 裡有幾棵樹，等於 n 的二進位裡 1 的個數，最多就是二進位的長度（例如 255 = 11111111₂ 只要 8 bit）。

- 最大那棵是 B⌊log₂n⌋，例如 ⌊log₂15⌋ = 3（log₂15 ≈ 3.9），最大是 B₃。
- 樹的棵數最多 **⌊log₂n⌋ + 1**。
- n = 15 = 1111₂：B₃、B₂、B₁、B₀ 四棵都有，問 4 個老大。n = 14 = 1110₂：B₃、B₂、B₁ 三棵。n 從 15 減到 8，最大的那棵都是 B₃。
- 運氣好（如 n = 8，只有一棵 B₃）問 1 個就好；最糟是 7、15、63 這種二進位全是 1 的數，每棵都要問。

用最糟情況估計，**getMax 是 O(log n)**。

### 例題：removeMax（14 個 node）

14 = 1110₂，forest 是 B₃、B₂、B₁ 三棵。問過三個老大，最大值 50 是 B₂ 的 root。（`·` 代表沒標數字的 node）

```
原本：      B₃            B₂: 50          B₁: 25
          （8 個）        /    \           |
                        40     35          ·
                        |
                        ·
```

1. 只看 50 那棵，拿掉老大很容易：binomial tree 有自我複製性質，老大下面的「派系」早就分好了，B₂ ＝ 老大 ＋ 一棵 B₁ ＋ 一棵 B₀。
2. 拿掉 50，剩下一幫小嘍囉：一棵 B₁（root 40）和一棵 B₀（35），它們本身就是完整的 binomial tree，是一座新的 forest。用二進位看：拿掉 B₂，那一位從 1 變 0（1110₂ → 1010₂）；冒出來的小嘍囉是 0011₂。
3. 把新 forest 跟原 forest merge，做二進位加法，從低位開始：
   - B₀ 位：原本沒有，35 直接放進去。
   - B₁ 位：原本的 25 和新來的 40 兩棵 B₁ 打一架，40 贏，合成一棵 B₂，放進剛空出來的 B₂ 位置。
   - B₃ 位：不動。

```
結果：      B₃            B₂: 40          B₀: 35
          （8 個）        /    \
                        25      ·
                        |
                        ·
```

1010₂ + 0011₂ = 1101₂ = 13，少了一個 node，正確。

> **重點** removeMax ＝ n 先減掉老大所在那棵的 2ᵏ 個，再把剩下的 2ᵏ − 1 個小嘍囉加回來，都是 O(log n) 的二進位加減法。Binomial heap 就是把 heap 操作對應到二進位的加法、減法，再用 max tree 管好誰是老大。

### 問：兩個老大一樣大怎麼合併？

答：如果只需要 max tree 性質（上面的不比下面小），兩個都是 7 時誰在上面都對。實作上決定一種方式就好，例如「併進來的那棵放下面」。也可以老大一樣就再比小弟，但多比一次就多花成本、多出很多 edge case；小弟也一樣大就得再比下去，最後還可能碰到兩棵一模一樣。

> **觀念** 設計資料結構時要問：真的有必要嗎？一般的 priority queue 不需要，就選實作和速度上最簡單的 solution。Priority 一樣的兩筆照常合併，並不浪費空間，因為兩筆不同的資料本來就要存兩筆。

### 小結

| 操作 | complete-tree heap | binomial heap |
|---|---|---|
| insert | O(log n) | amortized O(1) |
| getMax | O(1)（root） | O(log n)（問最多 ⌊log₂n⌋ + 1 個老大） |
| removeMax | O(log n) | O(log n) |
| 合併兩個 heap | 不方便 | 二進位加法，容易 |

Heap 有很多種，各有用途。Binomial heap 比 complete tree 的 heap 複雜，但 insertion 與 merge 的性質更好。

## 補充：decision tree

Decision tree（決策樹）是機器學習裡的一種樹：non-leaf node 放問題，leaf 放最後的決策。一棵 decision tree 對應一長串 if-then-else 程式。

- 建樹像切西瓜：找一刀把資料分成兩半，左右兩半各自遞迴建 subtree，再用 root 連起來（top-down recursive）。
- 遞迴一定要有 terminating condition：切不下去就回傳 leaf。
- 把建好的樹印成程式，是某一種 tree traversal。
- 窮舉切法：100 筆資料、5 個 column，大約有 100 × 5 = 500 種切法可以試。

## 重點整理
- linear search O(n)；binary search O(log n) 但要先排序；hashing 理想上 insert / delete / search 都是 O(1)
- map：key → value 一對一；dictionary：一個 key 對多個 value（value 改放 set / linked list）；hash table 是 unordered map
- 用 list / array 做 map：ordered array 的 get 是 O(log n)，但 insert / remove 仍是 O(n)（要推開後面的元素）
- direct addressing（h(x) = x）：O(1)、one-to-one 不撞，但 key 範圍大時浪費空間
- 同一個 key 每次必須算出同一個 index（deterministic）
- h = hash code（key → 任意整數）＋ compress（通常 mod k，落在 0～k−1）；insert：A[h(key)] = value，get：A[h(key)]
- summation hash code 對位置不敏感（ABC = ACB = 198）；polynomial：c₀ + c₁·a + c₂·a² + …，a = 16 可用左移 4 bit 實作，"ABC" = 18273、"ACB" = 18033；邊算邊 mod 2³² 避免 overflow
- cyclic shift：左移時把移出去的 bit 繞回右邊再加新字元；複雜度 sum < polynomial < cyclic shift
- mid-square：先平方、再取中間 r 個 bit，表需 2ʳ 個 bucket
- division：h(x) = x mod M，最常用；M 選質數（或沒有小質因數），避免 2ⁱ（只看最低 i 個 bit）
- folding：12320324111220 → shift folding 699、folding at the boundaries 897（偶數段反轉）
- collision：h(k₁) = h(k₂) 且 k₁ ≠ k₂；鴿籠原理保證 key 多於格子時一定會撞；成因：hash code 相同，或 compress 後才相同
- 好的 hash function：計算快、uniform（落入每個 bucket 機率 1/b）、目標是分散而不是完全不撞
- identifier density = n / T；loading density α = n / (s·b)
- collision ≠ overflow：overflow 是 bucket 已滿；只有 s = 1 時兩者同時發生
- collision handling：方法 0 不理他（tolerate errors）；1 每格固定小 array（仍會 overflow）；2 chaining；3 secondary data structure（可再 hash，hierarchical）
- hash set（bit array）：查到 0 一定不在、查到 1 可能誤報（來自 collision）；Bloom filter 用多個獨立 hash，全為 1 才說「在」
- chaining 平均搜尋 O(1 + α)，最壞 O(n)；12 個 identifier 例子的平均搜尋長度 = 24 / 12 = 2
- 有 collision 時要把 key 和 value 一起存，才能「對證件」
- Open addressing：所有資料放在表本身；chaining = open hashing，probing = closed hashing = open addressing（名詞別搞混）
- Probe 一般式：Hᵢ(k) = (h(k) + f(i)) mod ts，f(0) = 0；linear f(i) = i，quadratic f(i) = i²，double hashing f(i) = i·h₂(k)
- insert／get 最多試 m 次（h₀～hₘ₋₁），全滿就 declare failure
- Find 走與 insert 相同的 probe sequence；找到或遇到空格才停，算出的格子不是它不代表不在
- Linear probing 的缺點：primary clustering（連續被佔的一大塊越滾越大）；最壞搜尋 O(n)
- 失敗搜尋要走到空格才停，比成功搜尋貴（例：mod 11 表成功平均 15/8、失敗平均 31/11 ≈ 2.82）
- Quadratic probing 消除 primary clustering，但仍有 secondary clustering；表大小為質數且 α ≤ 0.5 才保證找得到空位
- Linear probing 只要 α < 1 就放得下，λ < 0.5 只是讓它夠快的經驗值
- Double hashing：步伐 h₂(k)（如 7 − (k mod 7)）因 key 而異；h₂(k) ≠ 0，最好與表大小互質
- Rehash（一串 h₁…hₘ 輪流試）≠ 表太滿換更大的表重算
- Open addressing 刪除不能清空格子，要放墓碑（lazy deletion）：搜尋經過繼續找，insert 可重用
- Load factor α = n/k；open addressing α ≤ 1，chaining α 可 > 1；另要防 non-uniform 分布
- 表太滿就長成兩倍（像 vector），h 的範圍改成 0～2k−1，再 rebuild
- Full rebuild O(n)，使用者 long waiting（關門整理）
- x mod 2k 必為 x mod k 或 x mod k + k → partial rebuild 只拆 overflow 的那條，其餘新格用指標共用舊 chain
- Partial rebuild 成本約 k + n/k，可遠小於 n → extendable hash table
- Static hashing：hash function 固定不變；dynamic hashing：依資料分布調整（bucket 滿就分裂），資料庫常用
- Dynamic hashing：讓資料分佈決定 hash；trie 從 key 最右邊的 bit 往左讀（例中 0 往上、1 往下），每個 bucket 有容量上限
- Trie 規則：overflow 就 split，split 完依下一個 bit 重新分配資料；資料變少可 merge；缺點是存取要 traverse trie、可能 skew
- 最基本要會：把一組 key 畫成 trie
- Extendible hashing：trie 換成 directory（2^global depth 個 entry，每個存指到 bucket 的 pointer）；bucket 的 local depth < global depth 時被多個 entry 指到
- Directoryless dynamic hashing：右數幾個 bit 直接當 memory address，overflow 用 chaining（課本的 linear hashing 還會逐步 split、位址空間加倍）
- Hash index：對欄位建 hash index 快速找到資料，再經 pointer 取其他 attribute；cardinality = 列數，degree = attribute 數
- Collision 免不了；overflow 才是 bucket 滿了還要塞；bucket size = 1 時 collision 等於 overflow
- BST 效能受輸入順序影響：12 個月份 JAN 先 → 最多 6 次、平均 3.5；JULY 先 → 最多 4、平均 3.1；照字母順序 → skew，最多 12、平均 6.5
- AVL tree：每個 node 的 BF = h_L − h_R ∈ {−1, 0, 1}，要每個 node 都檢查
- Heap = complete binary tree ＋ max tree，樹高約 log₂n，insert（sift up）/ removeMax（sift down）O(log n)；max tree 不保證樹高，最壞 O(n)
- Amortized：extendable array 滿了長成兩倍，放 8 個共 8 + (1+2+4) = 15 步，amortized O(1)
- Binomial tree：B_k 的 root 下接 B₀…B_{k−1}，有 2ᵏ 個 node；兩棵 B_k 合成 B_{k+1}；不是 binary tree，用 left child, right sibling 存
- Binomial forest：每種 B_k 最多一棵，對應 n 的二進位（9 = B₃+B₀、10 = B₃+B₁、17 = B₄+B₀）；加上每棵是 max tree = binomial heap
- 合併兩棵 binomial tree：兩個 root 比大小，輸的整棵掛到贏的下面，小孩依 order 由高到低從左排 → O(1)
- Binomial heap insert：像二進位 +1，總 merge 次數 n/2 + n/4 + … ≤ n → amortized O(1)
- 合併兩個 binomial heap = 二進位加法；getMax O(log n)（最多 ⌊log₂n⌋ + 1 棵）；removeMax O(log n)（拿掉老大那棵 2ᵏ，再把 2ᵏ − 1 個小嘍囉加回去）

## 名詞對照
| 中文 | English |
|---|---|
| 雜湊 | hashing |
| 雜湊表 | hash table |
| 雜湊函數 | hash function |
| 雜湊碼 | hash code |
| 壓縮 | compress / compression |
| 符號表 | symbol table |
| 映射表 | map |
| 字典 | dictionary |
| 關聯陣列 | associative array |
| 有序／無序映射 | ordered / unordered map |
| 直接定址 | direct addressing |
| 桶陣列 | bucket array |
| 桶 | bucket |
| 槽 | slot |
| 識別字 | identifier |
| 識別字密度 | identifier density |
| 負載密度（負載因子） | loading density (loading factor) |
| 碰撞 | collision |
| 溢位 | overflow |
| 完美雜湊 | perfect hashing |
| 鴿籠原理 | pigeonhole principle |
| 均勻雜湊函數 | uniform hash function |
| 加總雜湊碼 | summation hash code |
| 多項式雜湊碼 | polynomial hash code |
| 循環移位 | cyclic shift |
| 單向函數 | one-way function |
| 平方取中法 | mid-square |
| 除法 | division |
| 摺疊法 | folding (shift folding / folding at the boundaries) |
| 碰撞處理 | collision handling |
| 鏈結法 | chaining (open hashing) |
| 開放定址 | open addressing |
| 次級資料結構 | secondary data structure |
| 集合 | set |
| 布隆過濾器 | Bloom filter |
| 開放雜湊（鏈結法） | open hashing (chaining) |
| 封閉雜湊 | closed hashing |
| 探測 | probe |
| 探測序列 | probe sequence |
| 線性探測 | linear probing |
| 二次探測 | quadratic probing |
| 雙重雜湊 | double hashing |
| 再雜湊 | rehash / rehashing |
| 主要聚集 | primary clustering |
| 次要聚集 | secondary clustering |
| 成功搜尋 | successful search |
| 失敗搜尋 | unsuccessful search |
| 延遲刪除 | lazy deletion |
| 墓碑 | tombstone |
| 負載因子 | load factor |
| 非均勻分布 | non-uniform |
| 完全重建 | full rebuild |
| 部分重建 | partial rebuild |
| 可擴充雜湊表 | extendable hash table |
| 靜態雜湊 | static hashing |
| 動態雜湊 | dynamic hashing |
| 隨機測試 | monkey test (random testing) |
| 字典樹 | trie |
| 最低位元 | least significant bit |
| 分裂 | split |
| 可擴充雜湊 | extendible hashing |
| 目錄 | directory |
| 全域深度 | global depth |
| 區域深度 | local depth |
| 無目錄動態雜湊 | directoryless dynamic hashing |
| 線性雜湊 | linear hashing |
| 雜湊索引 | hash index |
| 屬性 | attribute |
| 列數 | cardinality |
| 屬性數 | degree |
| 固定長度紀錄 | fixed-length record |
| 二元搜尋樹 | binary search tree (BST) |
| 歪斜 | skewed |
| 平衡因子 | balance factor |
| AVL 樹 | AVL tree |
| 最大樹 | max tree |
| 完全二元樹 | complete binary tree |
| 優先佇列 | priority queue |
| 上浮／下沉 | sift up / sift down |
| 均攤分析 | amortized analysis |
| 可擴充陣列 | extendable array |
| 森林 | forest |
| 二項樹 | binomial tree |
| 二項森林 | binomial forest |
| 二項堆積 | binomial heap |
| 多路樹 | multi-way tree |
| 左子右兄弟表示法 | left child, right sibling |
| 跳躍串列 | skip list |
| 決策樹 | decision tree |
