# 陣列、Linked List、Stack、Queue

四個最基本的資料結構：array、linked list、stack、queue。每一個都要搞清楚三件事：資料在記憶體裡怎麼放、各種操作怎麼做、要花多少時間。先備好 C/C++ 與指標這些工具，再依序學 array（位址公式、row-/column-major、vector 的 amortized 成長、ordered array 與 binary search、多項式、sparse matrix 與 fast transpose、KMP）、linked list（singly、doubly、circular、iterator、sparse vector、reversal、free pool）、stack（function call、運算式求值、infix → postfix）、queue（circular queue）與迷宮，最後用 container 的角度把它們串起來。考試常考各結構 insert／delete 的時間複雜度比較、circular queue 的 full／empty 判斷、位址計算與 postfix 轉換。

## 學完這章要會
- 指標、call by value／address／reference 的差別；code、stack、heap 三區與 malloc／new
- 用 row-major、column-major 公式算多維陣列元素的位址；三角矩陣的對應
- 解釋 vector 每次長兩倍為什麼 amortized O(1)，每次多一格為什麼 O(m²)
- 寫 ordered array 的 insert、sequential search、binary search，並說明其正確性與成本
- 用 Big-O／Ω／Θ 分析迴圈，排常用函數的成長順序
- 多項式的三種表示法與加法；sparse matrix 的 simple transpose 與 fast transpose（rowSize、rowStart）
- 算 KMP 的 failure function 並追蹤比對過程，知道它為什麼是 O(m + n)
- linked list 的插入、刪除、反轉（p、q、r 三指標）、龜兔賽跑找 cycle 與中點；doubly linked list 與 header node；free pool 的 GetNode／RetNode
- 用 stack 做括號配對、函式呼叫（activation record）、postfix 求值與 infix → postfix（ISP／ICP）
- circular queue 的 front、rear 規則與 full、empty 條件；迷宮的 stack 解法，以及換成 queue 變成 BFS
- 比較各結構 insert／delete／search 的時間複雜度

## 工具準備：從 C 到 C++

這一章要學四個基本資料結構：array、linked list、stack、queue。動手之前先把工具備好：C++ 和指標（pointer）。

這裡不是完整的 C++ 教學，只挑寫資料結構時最好用的五個「C 和 C++ 的不一樣」：

1. reference（參考）
2. class（類別）
3. operator overloading（運算子多載）
4. template（範本）
5. STL（Standard Template Library，標準範本庫）

C++ 是 C 的延伸，if、for 這些 C 裡熟悉的東西 C++ 都有；但兩者**不是百分之百相容**：純 C 寫的程式丟進 C++ 不保證編得過。兩者的交集大約占 C 的九成，很多東西是 C++ 另外加上去的。

為什麼還要學 C？UNIX、Linux 是用 C 寫的；業界很多舊系統仍以 C 開發，要升級總得有理由。C 也很嚴謹，例如 `printf` 必須指定輸出格式（對應 C++ 的 `cout`）。想把 C 打底，最推薦的是 C 語言設計者親自寫的那本很薄的經典教科書。

第一個不一樣是 reference，它對應的是 C 的 pointer，所以先把指標和記憶體弄清楚。

## 指標：存位址的變數

記憶體就像一整排有編號的置物櫃，每一格的號碼叫**位址（address）**。

- 一般變數裝的是資料。
- **指標（pointer）**裝的是位址，所以也叫 **address variable**。

> **比喻** 指標就像手機裡存的朋友地址。地址不是朋友本人，但照著地址找得到他，這叫**間接存取（indirect access）**。

為什麼不直接拿資料，要繞一圈？因為有些資料，程式**只能**間接拿到，這就要從記憶體的分區講起。

## 記憶體三區：code、stack、heap

程式要執行，先 compile 成 machine code，再把 machine code 載入主記憶體（main memory），這叫 **loading**，就像看 DVD 得先放進播放器。

主記憶體分成三區：

| 區域 | 放什麼 | 怎麼存取 | 大小何時決定 |
|---|---|---|---|
| code section | 程式本身（機器指令），CPU 一次取一個指令執行 | — | — |
| stack | 函式裡宣告的變數 | **直接**存取 | compile time |
| heap | 執行中臨時需要的空間 | 只能**間接**存取（透過 pointer） | runtime |

### stack：直接存取、大小固定

程式第一行宣告的變數（例如 a、b、c）配置在 stack 上。函式執行時，stack 上會替它劃出一整塊，裝它所有的變數，這塊叫 **activation record**，也叫 **stack frame**。

stack 可以直接存取：假設 a 在 500、b 在 502，程式執行時變數名字就被換成位址，`a = 10` 就是「把 10 放進 500 號」。（另一個例子是 a 在 1000、b 在 1002、c 在 1004，道理相同。）

stack 的配置發生在 runtime（程式開始執行、函式被呼叫時），但**需要多少記憶體在 compile time 就決定了**，由宣告了哪些變數決定：size static、allocation dynamic。

### heap：只能透過指標間接存取

為什麼需要 heap？程式執行時可能需要比宣告的變數更多的記憶體，而且要多少，要等使用者真的用的時候才知道。

```c
int *p;            /* p 本身是普通變數，和 a、b、c 一樣配置在 stack 上 */
p = malloc(10);    /* 從 heap 借 10 個 byte */
```

```
stack（main 的 activation record）        heap
+------------------+                      +----------------------+
| a                |                      | 5000 5001 ... 5009   |  <- 10 bytes
| b                |                      +----------------------+
| c                |                         ^
| p = 5000  -------+-------------------------+
+------------------+
```

`malloc(10)` 在 heap 配置 10 bytes，起始位址（假設 5000）交回來存進 p，p 就「指向」這塊空間。要用的時候，程式先**直接**讀 stack 上的 p 拿到 5000，再照這個位址去 heap 存取，這就是間接存取。（另一個例子是 heap 起點 1000：activation record 裡只有一個變數 p，p 存 1000。）

> **重點** stack 與 heap 的兩大差異：
> 1. stack 直接存取；heap 間接存取，一定要透過 pointer。
> 2. stack 大小事先由宣告的變數決定；heap 大小在 runtime 才決定。heap 不是靠變數名字，而是 `malloc` 配合 pointer。

> **陷阱** 這裡的 stack／heap 是**記憶體區段**，和本章要教的資料結構 stack 不是同一個東西（雖然 stack 區的 activation record 確實以後進先出 LIFO 的方式疊放），也和 priority queue 用的 heap 資料結構無關。

### malloc、free 與 new

問：用 `malloc` 或 `new` 要一塊記憶體時，記憶體裡發生了什麼事？

答：C 用 `malloc`（memory allocation）向系統要一塊空的記憶體，作業系統把那塊記憶體**登記**給你的程式。用完 `free`，那塊記憶體就還給系統，可以再被別人使用。

> **比喻** 作業系統像管土地的地政單位，記錄每塊地是誰在用。`malloc` 是借地，`free` 是還地；借了忘了還，地就一直被占著，這叫 **memory leak（記憶體洩漏）**。

C++ 的 `new` 除了配置記憶體，還會執行一段初始化程式，正式名稱是 **constructor（建構子）**。這像「整地」：不只把地給你，連你要的初值都放好了。

- `new` = 配置記憶體 + 呼叫 constructor
- `delete` = 呼叫 destructor（解構子）+ 釋放記憶體

> **觀念** 程式在小資料上正確、資料一大就出錯，常常和記憶體問題（沒釋放、越界、配置太多）有關。效率差的程式在大資料上可能從 10 秒變 10 小時，debug 也更困難，所以要在真正會執行的環境上用大資料測試，並學會自己設計測資驗證程式。

## swap：call by value 為什麼換不了

指標的第二個大用途是讓函式能改到呼叫者的變數。經典例子是 swap：main 有 `a = 10`、`b = 20`，想呼叫 swap 把兩個值互換。

### 錯誤版本：call by value

```c
void swap(int x, int y) {
    int t;
    t = x;
    x = y;
    y = t;
}
/* main 裡呼叫 swap(a, b); */
```

呼叫 swap 時，stack 上替 swap 另開一個 activation record，裡面有 x、y、t，a、b 的**值被複製**過去：

```
main 的 activation record      swap 的 activation record
a = 10   (500)                 x = 10 -> 20
b = 20   (502)                 y = 20 -> 10
                               t = 10
```

交換只發生在 swap 自己的 x、y；一個函式不能存取另一個函式的 activation record。swap 一結束整塊收掉，a 還是 10、b 還是 20。

> **比喻** call by value 像影印：x、y 是 a、b 的影印本。swap 換的是影印本，原稿根本沒動。

### 正確版本：傳位址

```c
void swap(int *x, int *y) {
    int t;
    t = *x;     /* 照 500 號拿出 10 */
    *x = *y;    /* 把 502 號的 20 放進 500 號 */
    *y = t;     /* 把 10 放進 502 號 */
}
/* main 裡呼叫 swap(&a, &b); 傳過去的是 500 和 502 */
```

x、y 指向 main 的 a、b，swap 透過指標間接交換，a、b 真的換了：a = 20、b = 10。

再看一個例子，寫法一樣，名字換成 pa、pb：x = 3 在 156 號、y = 7 在 678 號。

```c
void swap(int *pa, int *pb) {
    int temp = *pa;   /* 去 156 號拿出 3 */
    *pa = *pb;        /* 678 號的 7 搬到 156 號，x 變 7 */
    *pb = temp;       /* 3 放進 678 號，y 變 3 */
}
/* 呼叫：swap(&x, &y); */
```

寫的時候要一直想「這是位置還是內容」，腦袋要轉好幾轉，這正是很多人怕 pointer 的原因。

> **陷阱** 嚴格來說 C **只有 call by value**。上面是把「位址」當成值傳過去（call by address）來模擬 call by reference；C++ 才有 `int &x` 這種真正的 reference 參數。

### 指標的四個用途

只有 stack 能直接存取，其他地方的資料都要靠指標間接存取。所以指標的用途有：

1. 存取 heap 記憶體（`malloc`／`new` 配置的空間）。
2. call by reference（如 swap）。
3. 存取檔案：讀寫磁碟上的檔案要用 file pointer（C 的 `FILE *`）。
4. 存取周邊裝置：讀鍵盤、寫螢幕、印表機。C 雖然用 `printf`、`scanf` 這些內建函式，但它們內部也是用指標存取裝置。

## C++ reference：變數的暱稱

C++ 只要在參數前加 `&`（和 C 取位址的符號長得一樣，但在這裡意思不同），函式裡就能寫最普通的交換：

```cpp
void swap(int &a, int &b) {
    int temp = a;
    a = b;
    b = temp;
}
/* 呼叫：swap(x, y);  不必寫 &x、&y */
```

這時 a 不是影印本，而是 x 的**暱稱（nickname）**，b 是 y 的暱稱。同一個東西多了一個名字而已，所以交換 a、b 就是交換 x、y 本身：x = 3、y = 7 變成 x = 7、y = 3。這種帶 `&` 的東西叫 **reference（參考）**，這就是真正的 **call by reference**。

背後的機制是 compiler 偷偷把暱稱換成對應的指標。以前要自己記「x 在第 156 張紙、y 在第 678 張紙」再透過紙的號碼去交換，現在這份麻煩交給 compiler。

> **觀念** reference 可以想成「比較聰明、比較安全的 pointer」：pointer 自由度高但容易寫錯，reference 有型別檢查等機制。差別：
> - pointer 可以是 NULL，也可以改指向別的東西。
> - reference 宣告時就必須綁定一個變數，之後不能改綁。

## 指標的算術運算

指標也能做加減。以一個 int 陣列為例，假設每個 int 佔 2 bytes，起點 100：

```
index :   0     1     2     3     4
addr  :  100   102   104   106   108
value :   5     8    ...
          ^                 ^
          p                 q
```

```c
int *p = &A[0];   /* p 存 100；也可寫成 p = A，陣列名稱就是起始位址 */
int *q = &A[3];   /* q 存 106 */
```

> **陷阱** `&A` 的數值也是 100，但型別是 `int (*)[5]`（指向整個陣列），直接指定給 `int *` 編譯器會警告。嚴格寫法是 `p = A` 或 `p = &A[0]`。

合法的運算只有五種：

| 運算 | 意義 | 例子 |
|---|---|---|
| `p++` | 移到下一個元素 | 100 → 102（int 指標加 2 bytes；float 指標則加 4） |
| `q--` | 移到前一個元素 | 106 → 104 |
| `p + 常數` | 往後移幾個元素 | `p + 2`：100 → 104（4 bytes = 2 個 int） |
| `q − 常數` | 往前移幾個元素 | `q − 2`：106 → 102 |
| `q − p` | 兩指標間相隔幾個元素 | (106 − 100) / 2 = 3 |

`p++` 不是「加 1」，而是「移到下一個元素」，移動量取決於指向的資料型態。`q − p` 的 6 bytes 本身沒有意義，除以 int 的大小 2 得到 3，才是兩者相隔的元素個數。

**不允許**：兩指標相加、兩指標相乘、常數乘指標。這些運算沒有意義；`p++` 之所以合法，是因為它有「移到下／上一個元素」的意義。

> **陷阱** 兩指標相減要指向**同一個陣列**才有定義。指標之間的比較（`<`、`==`）也是合法運算。

### *++p、++*p、*p++、(*p)++

考試很愛考這組。設 p 指向 100，`A[0] = 5`、`A[1] = 8`。一元運算子由右往左結合：

| 寫法 | 怎麼讀 | 式子的值 | 之後 p | 之後 A[0] |
|---|---|---|---|---|
| `*++p` | 先 `++p` 移到 102，再取值 | 8 | 102 | 5 |
| `++*p` | 先取值 5，再把資料加 1 | 6 | 100 | 6 |
| `*p++` | 即 `*(p++)`：後置 ++ 等式子結束才做，先讀到 5，p 再移走 | 5 | 102 | 5 |
| `(*p)++` | 加的是資料，但後置：式子的值是舊值 | 5 | 100 | 6 |

（每一列都從 p = 100、A[0] = 5 重新開始。）

> **陷阱** `*p++` 和 `(*p)++` 只差一個括號：前者移的是**指標**，後者加的是**資料**。後置 `++` 的優先序高於 `*`，所以 `*p++` 是 `*(p++)`。

## struct 與 typedef

structure 讓你自己定義 data type。例如 person 有三個欄位 name、age、salary，用「.」存取欄位：

```c
struct {
    char  name[10];
    int   age;
    float salary;
} person;

strcpy(person.name, "james");   /* 把字串 copy 到 name */
person.age = 10;
person.salary = 35000;
```

也可以用 `typedef struct` 把它宣告成新的型別，之後就像 int 一樣用：

```c
typedef struct human_being {    /* 寫法一：名字寫在 struct 後面 */
    char  name[10];
    int   age;
    float salary;
} humanBeing;

typedef struct {                /* 寫法二：不寫 struct 後的名字 */
    char  name[10];
    int   age;
    float salary;
} humanBeing;

humanBeing person1, person2;
```

- **union**：寫法像 struct，但所有欄位**共用同一塊記憶體**。
- struct 的欄位可以是指向同一種型態的指標，叫 **self-referential structure**，例如 list 節點的 link 欄位，這是後面 linked list 的基礎。

## class：資料和動作綁在一起

### struct 的寫法

用複數當例子：一個複數有實部 real 和虛部 imag，綁成一個 struct。綁在一起，很多本來就要一起做的操作比較完整，不會改了 real 卻忘了 imag。

在 C 裡，複數乘法要另外寫一個函式，放在 struct **外面**：

```c
struct Complex { double real, imag; };

struct Complex multiply(struct Complex a, struct Complex b) {
    struct Complex result;
    result.real = a.real * b.real - a.imag * b.imag;
    result.imag = a.real * b.imag + a.imag * b.real;
    return result;
}
```

> **例題** a = 1 + 2i，b = 3 + 4i，求 multiply(a, b)。
> 實部 = 1×3 − 2×4 = −5，虛部 = 1×4 + 2×3 = 10，所以 a × b = −5 + 10i。

C 的風格是資料的藍圖一份、操作資料的函式另外寫，比較鬆散。

### class 的寫法

class 和 struct 最大的差別：可以把**動作**寫在 class 之內。

```cpp
class Complex {
public:
    double real, imag;
    void multiplyBy(Complex b) {
        double r = real * b.real - imag * b.imag;  /* 先暫存，免得 real 先被改掉影響 imag */
        imag = real * b.imag + imag * b.real;
        real = r;
    }
};

a.multiplyBy(b);   /* a 從 1 + 2i 變成 −5 + 10i */
```

`a.multiplyBy(b)` 的語意是：對 a 這個已經存在的**物件（object）**送一個指令，這個動作改變了物件的**內部狀態**（real、imag）。資料和相關動作綁在一起，語意更清楚，可讀性更好。

> **比喻** 物件導向程式設計（object-oriented programming）裡，每個物件像一塊樂高積木，有自己的資料、自己的動作，再一塊塊拼成大軟體。

C++ 裡仍然可以寫一般函式；只是和物件相關的函式，可以選擇寫進 class 裡。入門時可以把 class 看成「struct 加上相關的 function，再加上權限控制」。

### 權限控制

權限控制決定某些程式能不能看到或改動某些資料：

| 存取層級 | 誰可以存取 |
|---|---|
| `public` | 所有程式（就像 C 的 struct） |
| `private` | 只有這個 class 自己的成員函式（以及 friend） |
| `protected` | 這個 class 自己，**加上它的衍生類別（derived class／子類別）** |

> **陷阱** `protected` 不是含糊的「部分人能拿取」，而是明確的「子類別可以存取、外部程式不行」。

C++ 的 class 和 struct 幾乎一樣，C++ 的 struct 也能寫 function，**只差預設權限**：class 預設 `private`，struct 預設 `public`。

### this

問：成員函式裡常看到的 `this` 是什麼？

答：目前這個物件在記憶體中的位置。系統偷偷把它藏在一個叫 `this` 的指標裡，所以成員函式裡寫 `real`，其實就是 `this->real`。

## Operator overloading

複數要相加，C 只能寫 `c = plus(a, b)`，函式裡實部加實部、虛部加虛部。a = 1 + 2i、b = 3 + 4i 時，c = 4 + 6i。C++ 卻能直接寫 `c = a + b`，怎麼辦到的？

關鍵觀念：**運算符號和函式其實是同一回事**，只是 int 的 `+` 內建好了（可能就是一條機器指令）；複數的加法你不寫，compiler 就不知道怎麼做。

C++ compiler 看到 `c = a + b`，先把它翻譯成函式呼叫，翻譯後的名字叫 `operator+`，你只要把它寫好：

```cpp
Complex operator+(Complex a, Complex b) {   /* 翻譯方式一：c = operator+(a, b) */
    Complex c;
    c.real = a.real + b.real;
    c.imag = a.imag + b.imag;
    return c;
}
```

另一種翻譯方式是 `c = a.operator+(b)`，把 `+` 當成 a 這個物件身上的動作（class 的成員函式）。compiler 依 a、b 的型別判斷要呼叫哪段程式碼。這就是 **operator overloading**：同一個運算子在不同型別上重新定義。

問：用 operator overloading 會不會比較慢？

答：和一般 function 的執行速度幾乎沒差，差在**寫程式**的速度。

問：`operator=` 為什麼常回傳 reference？

答：避免多拷貝一份物件、多用一份記憶體。

### 例子：GCD 從整數改成大數

要寫兩個版本的最大公因數（GCD）：正整數版與大數版。大數比一般整數能存的範圍大很多，做一次加法可能就要跑迴圈處理每一位。

- 選擇一：砍掉重練，把每個加減乘除都換成大數運算重寫。
- 選擇二：把大數需要的運算子（例如 `%`、`!=`）替大數型別定義好，GCD 主程式一行都不用改，只換型別。

選擇二就是 operator overloading 的威力。

## template 與 STL

### 跨型態的程式：copy、paste、replace

資料結構常常要跨型態存在：10 個 int 的 array、10 個 double 的 array、4 個複數的 array，意義相同，只有型態不同。要 sort 時，C 就得寫 `intSort`、`doubleSort`……每種型態一段。

傳統 reuse 的第一個做法是偷懶：寫好 integer sort，copy、paste、replace（把 int 換成 double）。

> **陷阱** replace 時小心不該換的也被換到，例如迴圈 index 的 `int i` 也被換成 `double i`。

### template

C++ 的 **template** 讓你寫一段「型別暫時還沒決定」的程式，未定的型別通常叫 T：

```cpp
template <class T>
void sort(T *arr, int n) {
    for (int i = 0; i < n; i++)
        for (int j = i + 1; j < n; j++)
            if (arr[j] < arr[i]) {      /* 需要 T 的 operator< */
                T tmp = arr[i];
                arr[i] = arr[j];
                arr[j] = tmp;
            }
}
```

> **比喻** template 就是「範本」，像去辦事拿到的空白表格，要用的時候才填上內容。

程式要 sort 一個 int array 時，compiler 找不到 int 版的 sort，就拿範本印一份，把 T 全部換成 int，等於 compiler 替你做了 copy、paste、replace。要 sort Complex array 也一樣，印一份把 T 換成 Complex。

> **陷阱** sort 裡要比較大小（`arr[j] < arr[i]`）。換成 Complex 或自訂的 Student 型別時，必須寫好那個型別的 `operator<`，否則 compile 不過。用 STL 的 sort 排自訂型別也一樣。

### STL

把 template 發揮到極致的成果是 **STL（Standard Template Library）**：vector、list、stack、queue 等資料結構和 sort 等演算法都寫好了，而且能用在任何型別上。教科書裡用 `KeyType` 這類型別參數寫資料結構，也是同一招。寫一段 template 的程式就能用在很多地方，這是比 copy-paste-replace 更聰明的 reuse。

> **觀念** 一種語言結構（例如 `auto`）危不危險，取決於你了不了解它。題目沒規定不能用 STL，就可以用。

## Array：有編號的置物櫃

C 學過 array 的語法，這裡的重點是用**資料結構的眼光**看它。

常見的定義：array 是一群 element 集合起來，關鍵在後半句：**每個 element 都靠一個 index 辨別**（each identified by one array index）。

> **比喻** array 就像系館地下室的置物櫃：一整排櫃子，理想上號碼連續，0 號、1 號、2 號一路下去。靠編號找到 3 號櫃，可以把書放進去，也可以把東西拿出來。有編號的櫃子，就是 array。

較數學的定義：array 是 **`<index, value>` 的集合**。例如 `int list[5]` 有 5 個位置，index 像門牌號碼，從 0 到 4，每格存一個 value。電腦用一塊**連續**的空間存放 array。

> **觀念** 雲端運算裡很熱門的 key-value data store（以及由它衍生的 MapReduce）概念上也是 array：key 就是 index，value 是那個 key 上的值。

### 記憶體是最大的 array

電腦裡最大、也最重要的 array 就是記憶體。宣告變數就是劃出一塊記憶體位置並給它一個名字。記憶體的編號叫 address，其實就是 array 的 index。例如 address 有 4 bytes = 32 bits，編號就有 2³² 個。

那 pointer 呢？櫃子裡放的不是寶物，而是**另一個櫃子的編號**。

> **比喻** 像大地遊戲的小紙條：「下一關去 01 號」。也能玩尋寶：03 號裡寫著 06，06 號裡寫著 01，照著編號一路找，最後在 01 號拿到寶物。

```
address : 00   01    02   03   04   05   06
content :     寶物        06             01
                          |              |
              03 -> 06 -> 01 (寶物)
```

所以 pointer 本質 = 記憶體位置 = array 的編號，沒什麼好怕；只要編號對、別打開別人的櫃子就好。

## 一維陣列的位址公式

反過來看，宣告的 array 就是在大記憶體裡劃出**連續**的一小段，叫 **memory block**。3 號櫃就在 0 號櫃旁邊第 3 格，30 號在 0 號旁邊第 30 格：只要知道 0 號在哪就能算出來。陣列名稱 arr 隱含的就是第 0 格的位置，例如第 5566 號，後面 5567、5568……連續下去。一格多大看型別：int 可能 4 bytes，double 更大，char 更小。

第一格的位址叫 **base address**，記作 L0（另一種寫法記作 α）。宣告 `int A[5]`，執行期拿到 5 格連續空間，C 的索引是 0～4。設 L0 = 100、int 佔 2 bytes：

```
A[0]  A[1]  A[2]  A[3]  A[4]
100   102   104   106   108
```

執行 `A[2] = 15` 時，compiler 需要 A[2] 的位址（104），但它不能把 104 寫死在機器碼裡，因為陣列放在哪要等執行時才知道。所以它寫成相對位址的公式：

```
Addr(A[i]) = L0 + i × w        （w：一個元素佔幾個 byte，word size）
Addr(A[2]) = 100 + 2 × 2 = 104   剛好跳過前面兩格
```

另一種寫法：`list[0]` 在 α，`list[1]` 在 α + sizeof(int)，`list[2]` 在 α + 2·sizeof(int)，一般式 `list[i]` 在 **α + i·sizeof(int)**，用 offset 做 shift。

w 看型別：float 4 bytes、char 1 byte。

> **陷阱** 上面假設 int 佔 2 bytes（舊式編譯器），現今多為 4 bytes。考題通常會給 w，照題目算。

這就是 **Fast Random Access**：random 是「任意（arbitrary）」的意思，任何 index 都一樣快，一次乘法加一次加法就算出位置。RAM（Random Access Memory）的 R 就是這個意思。

看一個資料結構要看兩部分：**取用（get）**和**維護（update）**；另外還有建立（construct），C 用 `malloc` 劃出一塊連續記憶體。

### 索引從 1 開始、任意下界

C 以前有些語言的索引從 1 開始，例如宣告 `A[1…5]`。A[i] 前面只有 i − 1 格：

```
Addr(A[i]) = L0 + (i − 1) × w
Addr(A[2]) = 100 + (2 − 1) × 2 = 102
```

更早的編譯器甚至允許任意上下界，例如 `A[−3…5]`，一般式：

```
Addr(A[i]) = L0 + (i − lb) × w        lb = lower bound（下界）
例：A[−3…5]、L0 = 100、w = 2，A[0] = 100 + (0 − (−3)) × 2 = 106
```

一種常見說法是：從 1 起算每次存取要多算一次減法，所以 C 乾脆規定索引從 0 開始。這要打點折扣：Fortran、MATLAB、R、Lua 至今仍從 1 開始，Pascal 可以自訂上下界；而且 compiler 可以先把 L0 − lb × w 算好，執行時不必多減一次。

> **陷阱** 索引從 1（或其他下界）開始時，一定要先減掉下界；直接套 L0 + i × w 會多算格數。

## Array ADT：get、update、insert、remove

把 array 抽象成 ADT（abstract data type）：

- objects：a set of `<index, value>` pairs，可以是一維，也可以是二維或多維。
- `Retrieve(A, i)`：給 index i，回傳那裡存的 value（get by index）。
- `Store(A, i, x)`：把值 x 存到 index i（update by index）。
- 再加上建立陣列（construct）。

ADT 長得像 C++ 的 class 宣告，但更 general：**只說做什麼，不說怎麼做**。

比較吃力的兩個操作是 **insert by index** 和 **remove by index**：

```
insert X 到 index 3（後面的全部往後推一格，記憶體要大一格）：
before: [a][b][c][d][e][f][g][h][i][j]
after : [a][b][c][X][d][e][f][g][h][i][j]
                     -> 7 個元素各搬一次

remove index 3（後面的往前補位）：
before: [a][b][c][d][e][f][g]
after : [a][b][c][e][f][g]
```

> **比喻** update 是「放進去」，insert 是「塞進去」：像胖子擠進人群，要把別人擠開。

| 操作 | 時間 |
|---|---|
| get、update | O(1) |
| insert、remove by index | 最壞要搬 n 個元素，O(n) |

所以原生 array 真正最需要支援的只有 get、update，頂多再加 construct。

## 陣列名稱與指標寫法

### int list[5] 與 int *plist[5]

```c
int list[5];     /* 5 格，每格存一個 integer */
int *plist[5];   /* 看到 *：5 格，每格存一個指向 int 的 pointer（memory address） */
```

兩個都是 array，但意義完全不同。

### 陣列名稱就是 base address

```c
int A[5];   /* 起點 100，int 2 bytes；設 A[2] = 9 */
int *p = A;
```

陣列名稱 A 本身就是 base address 100。它**不是**指標變數（不能改它的值），但指標的語法都能用在它身上：

| 寫法 | 值 | 說明 |
|---|---|---|
| `A`、`&A`、`&A[0]` | 100 | 印出來都是 100 |
| `A + 2` | 104 | 100 + 2 × 2，往後兩個 int |
| `*(A + 2)` | 9 | 取 104 的值 |
| `A[2]`、`2[A]` | 9 | C 把 `A[i]` 定義成 `*(A + i)`，加法可交換，所以 `i[A]` 也合法 |
| `p`、`p + 2` | 100、104 | |
| `p[2]`、`2[p]`、`*(p + 2)` | 9 | 同一組語法全部成立 |
| `&p` | 500（假設） | p 是變數，`&p` 是它自己住的地方 |

> **陷阱** `&A` 的數值雖然也是 100，型別卻是 `int (*)[5]`（指向整個陣列），所以 `&A + 1` 會跳過整整 5 格（100 + 5 × 2 = 110），不是 102。

### int *list1 與 int list2[5]

```c
int *list1;      /* 只指到一個 integer 的空間 */
int list2[5];    /* 指到一塊連續、5 個 integer 大小的空間 */
```

兩者都可以當 pointer 用，差在指到的空間大小。不寫 index 時，`list2` 就是 `&list2[0]`；`list2 + i` 等同 `&list2[i]`（pointer 加整數就是往後調整位置）；前面加 `*`，`*(list2 + i)` 取出 `list2[i]` 的值。

### 例子：print1 印出位址與內容

```c
void print1(int *ptr, int rows) {
    /* 用 pointer 印出一維陣列每個元素的位址與內容 */
    int i;
    printf("Address Contents\n");
    for (i = 0; i < rows; i++)
        printf("%8u%5d\n", ptr + i, *(ptr + i));   /* %8u 佔 8 格印 address，%5d 印數值 */
    printf("\n");
}
/* int one[] = {0, 1, 2, 3, 4};  print1(&one[0], 5); */
```

可能的輸出（int 佔 2 bytes 時）：

```
Address Contents
    1228    0
    1230    1
    1232    2
    1234    3
    1236    4
```

實際位址每台機器不同；現代機器 int 多為 4 bytes，位址會是 1228、1232、1236……

## 二維陣列：row-major 與 column-major

最熟悉的 2D array 是圖片：1024 × 768 個像素排成表格，index 變成一組 (row, column)，像座標。可是記憶體只有一條（位址只有一維），compiler 必須把 2D 陣列 map 到一維陣列，同時仍讓我們用兩個下標存取。有兩種排法。

以 3 × 4 的陣列為例（m = 3 列、n = 4 行），共 12 格，從 500 起放，w = 2：

```
紙上的樣子：
        col0  col1  col2  col3
row0    a00   a01   a02   a03
row1    a10   a11   a12   a13
row2    a20   a21   a22   a23
```

### Row-major：一列一列放

row 0 放完接 row 1，再接 row 2：

```
addr : 500 502 504 506 | 508 510 512 514 | 516 518 520 522
elem : a00 a01 a02 a03 | a10 a11 a12 a13 | a20 a21 a22 a23
       <---- row 0 --->  <---- row 1 --->  <---- row 2 --->
```

求 A[2][1]：先跳過 row 0、row 1 兩整列，每列 n = 4 格，共 8 格；到 row 2 開頭再往後走 1 格：

```
Addr(A[2][1]) = 500 + (2 × 4 + 1) × 2 = 500 + 9 × 2 = 518
```

m × n 陣列，索引從 0：

```
Row-major：Addr(A[i][j]) = L0 + (i × n + j) × w
```

索引從 1 起算，i、j 都先減 1：

```
Addr(A[i][j]) = L0 + [(i − 1) × n + (j − 1)] × w
例：A[3][2] = 500 + [(3 − 1) × 4 + (2 − 1)] × 2 = 500 + 9 × 2 = 518
（和 0 起算的 A[2][1] 是同一格）
```

再看一個例子：2 × 5 的陣列（2 個 row、5 個 column，共 10 格）要拿 `[1][3]`：前面有 1 個 row、每個 5 格，再走 3 步，是 offset 1 × 5 + 3 = 8 的那格（從 0 數）。一般寫法：每列 C 個元素時，`arr[i][j]` 位在 `arr + (i × C + j) × 元素大小`。

> **陷阱** row-major 乘的是 **n（每列的元素數＝行數）**，不是 m。把 m、n 弄反是最常見的錯誤。

### Column-major：一行一行放

先放 column 0 的 a00、a10、a20，再放 column 1、column 2……

```
addr : 500 502 504 | 506 508 510 | 512 514 516 | 518 520 522
elem : a00 a10 a20 | a01 a11 a21 | a02 a12 a22 | a03 a13 a23
       <- col 0 ->   <- col 1 ->   <- col 2 ->   <- col 3 ->
```

求 A[1][2]：先跳過 2 整行，每行 m = 3 格，再往下走 1 格：

```
Addr(A[1][2]) = 500 + (2 × 3 + 1) × 2 = 500 + 7 × 2 = 514
```

```
Column-major：Addr(A[i][j]) = L0 + (j × m + i) × w
索引從 1：    Addr(A[i][j]) = L0 + [(j − 1) × m + (i − 1)] × w
例：A[1][4] = 500 + [(4 − 1) × 3 + (1 − 1)] × 2 = 500 + 9 × 2 = 518
```

> **陷阱** column-major 是 **j 乘 m（每行元素數＝列數）再加 i**，和 row-major 的 i × n + j 剛好對調。

### 例題：同一格在兩種排法下的位址

> **例題** 3 × 4 陣列、L0 = 500、w = 2、索引從 0。分別求 A[1][2] 和 A[2][1] 在 row-major 與 column-major 下的位址。

| 元素 | Row-major：500 + (i × 4 + j) × 2 | Column-major：500 + (j × 3 + i) × 2 |
|---|---|---|
| A[1][2] | 500 + (4 + 2) × 2 = **512** | 500 + (6 + 1) × 2 = **514** |
| A[2][1] | 500 + (8 + 1) × 2 = **518** | 500 + (3 + 2) × 2 = **510** |

可以對照上面兩張記憶體圖驗證：row-major 圖裡 512 是 a12、518 是 a21；column-major 圖裡 514 是 a12、510 是 a21。

### 推廣到多維

三維以上一樣是「先跳過前面整塊，再往後走」。設 `A[u1][u2][u3][u4]`，索引從 0，row-major 下 A[i][j][k][l] 的位址：

```
Addr(A[i][j][k][l]) = L0 + (i × u2 × u3 × u4 + j × u3 × u4 + k × u4 + l) × w
```

**最後一項是 l（最後一維的索引）本身**，不乘任何東西，也不是 i。

> **例題** `A[2][3][4][5]`，L0 = 1000，w = 4，row-major，求 A[1][2][3][4]。
> 前面整塊數：1 × (3 × 4 × 5) + 2 × (4 × 5) + 3 × 5 + 4 = 60 + 40 + 15 + 4 = 119。
> 位址 = 1000 + 119 × 4 = 1476。

column-major 則反過來，**第一維**的索引不乘東西、最後一維乘得最多：

```
Addr(A[i][j][k][l]) = L0 + (l × u1 × u2 × u3 + k × u1 × u2 + j × u1 + i) × w
```

### 兩種排法的比較

| | Row-major | Column-major |
|---|---|---|
| 放法 | 一列一列 | 一行一行 |
| 公式（0 起算） | L0 + (i × n + j) × w | L0 + (j × m + i) × w |
| 運算量 | 2 次加法、2 次乘法 | 2 次加法、2 次乘法 |
| 使用的語言 | C、C++（C 家族） | Fortran、MATLAB |

兩條公式運算量相同，效率一樣，設計語言時任選一種即可。用哪一種是**語言特性**，要查；算位址前一定先確認是哪一種。考題常要你分別算同一元素在兩種排列下的位址。

## 2D 陣列的另一種實作：array of arrays

前面把整個 2D 陣列放在一大塊連續記憶體，叫 **one block**（C 原生的 `int arr[2][5]` 就是 row-major 的 one block）。construct 時留一大塊 1D 記憶體，get／update 用公式算位置。

這不是唯一做法。每個 row 本身就是一段連續記憶體，何不化整為零，一個 row 一個 row 分開放？假設 row 0 放在 1126、row 1 放在 5566，就得把這兩個起點存起來，這就是**指標陣列**：2D 陣列的入口放兩張小紙條，告訴你去哪找各個 row。

```
入口（指標陣列）        各 row 散在記憶體各處
arr[0]: 1126  ------>  1126 1127 1128 1129 1130   (row 0)
arr[1]: 5566  ------>  5566 5567 5568 5569 5570   (row 1)
```

要拿 `arr[1][3]`：先看 `arr[1]` 那張紙條寫 5566，再走 3 步到 5569（以「格」為單位）。construct 分三段：放紙條的一段，加上每個 row 各一段，位置可以四散。這種做法叫 **array of arrays**。

| | one block | array of arrays |
|---|---|---|
| 空間 | 剛好 | 多一塊放小紙條 |
| construct | 配置一次 | 每個 row 分開配置，可能較花時間 |
| get | 一次公式 | 兩層：先找紙條再算位置，像大地遊戲跑兩關 |
| 好不好寫 | 要自己算公式 | 兩個維度分開處理，比較直覺好寫 |

差距通常不大。要記住的是：**程式設計處處有 trade-off**。

### 用 double pointer 在 heap 建 2D 陣列

不直接宣告 2D 陣列，而是用指標在 heap 動態建立：

```cpp
int **p;
p = new int*[3];      /* 指標陣列：3 個 int*，base 500，存進 double pointer p */
p[0] = new int[4];    /* row 0，base 550 */
p[1] = new int[4];    /* row 1，base 600 */
p[2] = new int[4];    /* row 2 */
```

C 的寫法：

```c
int **p = (int **)malloc(3 * sizeof(int *));
for (int i = 0; i < 3; i++)
    p[i] = (int *)malloc(4 * sizeof(int));
```

double pointer + array of pointers + array of arrays，合起來就是一個 2D 陣列：

```
&p = 700          p = 500
                  +-----+
            500:  | 550 | ---> 550: [10][  ][  ][  ]        (row 0)
            502:  | 600 | ---> 600: [  ][  ][25][  ]        (row 1)
            504:  | ... | ---> ...                          (row 2)
                  +-----+      600 602 604 606
```

（此例假設 int 與指標都佔 2 bytes，p[0][0] = 10，p[1][2] = 25。）

| 寫法 | 值 | 說明 |
|---|---|---|
| `p` | 500 | 指標陣列的起點 |
| `&p` | 700 | p 自己住的地方（假設） |
| `*p` | 550 | 指標陣列第 0 格的內容 = row 0 起點 |
| `p + 1` | 502 | 下一個指標 |
| `*(p + 1)` | 600 | row 1 起點 |
| `*(p + 1) + 2` | 604 | 600 + 2 × 2 |
| `*(*(p + 1) + 2)` | 25 | 604 的值，即 `p[1][2]` |
| `**p` | 10 | `*(*(p + 0) + 0)` = `p[0][0]` |

每加一個 `*` 就往下走一層，所以 `*(*(p + i) + j)` 就是 `p[i][j]`。例如 `p[1][3]` 在 606。

### 靜態 2D 陣列名稱的指標語法

直接宣告 `int A[3][4]`，起點 500。畫成 2D，實際是 12 個連續的 int：500、502、504……（A[0][0] = 10，A[1][2] = 25）

| 寫法 | 值 | 說明 |
|---|---|---|
| `A`、`&A`、`*A` | 500 | `*A` 仍是位址（row 0 的起點） |
| `A + 1` | 508 | 跳到下一列：一次跳 4 × 2 = 8 bytes，不是 502 |
| `A[1]`、`*(A + 1)` | 508 | row 1 起點 |
| `*(A + 1) + 2`、`A[1] + 2` | 512 | |
| `*(*(A + 1) + 2)`、`*(A[1] + 2)` | 25 | 即 `A[1][2]` |
| `**A` | 10 | `A[0][0]` |

可以把 A 想成「前面有一排指標陣列的 array of arrays」，存取規則和 double pointer 一樣。

> **陷阱** 常聽到「二維陣列要用雙重指標、三維要三重指標，幾維就幾層」，這只對「指標陣列＋各列分別配置」的結構成立。真正宣告的 `int A[3][4]`，A 的型別是 `int (*)[4]`（指向 4 個 int 的陣列的指標），**不是** `int **`；記憶體裡也沒有真的那排指標。所以不能把 A 傳給 `int **` 參數，而 `A + 1` 跳 8 bytes 正是這個型別造成的。

## 下三角矩陣與對稱矩陣

**下三角矩陣（lower triangular matrix）**：方陣只有對角線以下（含對角線）有非零值，以上全是 0。0 不必存，只存下三角，一個 row 接一個 row 排：第 1 個 row 1 個、第 2 個 row 2 個……第 n 個 row n 個。

```
n = 6（1-indexed）
row 1: x                       1 個
row 2: x x                     2 個
row 3: x x x                   3 個
row 4: x x x x                 4 個
row 5: x x x x x               5 個
row 6: x x x x x x             6 個
```

用單一 block 只要 1 + 2 + … + n = **n(n + 1)/2** 個位置。n = 6 時是 21 格，比 36 格省。代價是找位置要多花點數學：算出前面已經經過多少 element。

> **例題** n = 6 的下三角矩陣，row-major 存成一維，求第 6 row 第 5 個元素（1-indexed）在第幾格。
> 前面 5 個 row 共 1 + 2 + 3 + 4 + 5 = 15 個，再走 5 步，所以是第 15 + 5 = **20** 格（1 起算）。

一般式（1-indexed、row-major）：第 i row 第 j 個（j ≤ i）在第 **i(i − 1)/2 + j** 格。若索引從 0 起算，則 offset 為 i(i + 1)/2 + j。

> **陷阱** 下三角中 column 不會大於 row。像「第 5 row 第 6 column」那格在上三角，值是 0，根本沒有存，不能套公式。

嫌公式麻煩，也可以改用 array of arrays，每個 row 配剛好的長度，又是一個 trade-off。

**對稱矩陣（symmetric matrix）**：A[i][j] = A[j][i]，左下和右上對稱，也只要存一半（例如下三角），A[i][j] 在 j > i 時改去讀 A[j][i]。

每個選擇都有好處和壞處，懂得取捨才是程式「設計」。

## row sum 與 column sum：cache 的影響

C 原生的 `arr[i][j]` 是 row-major 的 one block。下面兩段雙層迴圈都把每格加進 result，只差迴圈順序，哪個快？

```c
/* row sum：由左到右，再由上到下 */
for (i = 0; i < N; i++)
    for (j = 0; j < N; j++)
        result += arr[i][j];

/* column sum：由上到下，再往右 */
for (j = 0; j < N; j++)
    for (i = 0; i < N; i++)
        result += arr[i][j];
```

實測（兩支程式只差兩行，initialize 都用 row-major 以求公平，各跑 10 次取比較穩定的估計）：

| 版本 | 10 次總時間 |
|---|---|
| row sum | 約 10 秒（一次約 1 秒） |
| column sum | 約 20 秒，慢約一倍 |

看似無害的簡單程式，為什麼差這麼多？程式最終變成機器碼在特定平台上執行，要了解平台才寫得出有效率的程式。以 CPU 的速度來看，記憶體很「遙遠」，每次存取花的時間相對太長。

> **比喻** 以前沒有自來水，每次走到井邊打水太累了，乾脆用大桶一次多打一點，放在家裡水槽。那個水槽就是 **cache（快取記憶體）**：要的東西在裡面叫 **cache hit**，不在就是 **cache miss**。

cache 一次抓附近**連續**的一小段。在 one block 實作下：

- row sum 存取的記憶體是連續的，下一格常常已經在 cache 裡。
- column sum 跳來跳去：每列 1000 個元素時，存取順序是第 1 個 → 第 1001 個 → 第 2001 個 → 第 3001 個……再回到第 2 個，幾乎一直 cache miss。

問：資料小的時候也差這麼多嗎？

答：array 較小時差距不明顯，大規模資料才看得出影響；而且 cache 的內容會被其他程式洗掉，cache 也不是唯一影響時間的因素。這正是要修計算機組織、作業系統等課的原因。

> **重點** C／C++ 是 row-major，所以雙層迴圈要讓**最內層迴圈跑最後一個索引**（`arr[i][j]` 內層跑 j），才能連續存取、善用 cache。

## Vector：會長大的 array

### vector 家族（ADT）

dense array（一般陣列）與 sparse array（只存非零項）的儲存方式不同，但兩者都支援 indexed（random）access；sparse 要先做 binary search，比較迂迴。教科書把**支援 index access 的資料結構**統稱為 **vector**，功能有：

- `at(i)`：get at index
- `set(i, x)`：put to index
- `insert(i, x)`、`erase(i)`：用 index 插入、刪除

只要支援這些功能就叫 vector，快慢、空間多少不拘。用 linked list 硬做也算 vector，只是 index access 很慢。介面一致，就能換著試哪個合用。

| 成員 | 著重 |
|---|---|
| dense array | 快速 index access（fast 版） |
| sparse array | 省空間（storage saving 版） |
| extendable array | 能長大（dynamic 版） |

> **陷阱** 這裡的 vector 是功能上的抽象家族（ADT），**不是** C++ STL 的 `std::vector`。

### STL vector = extendable array

C++ STL 的 `vector` 其實是 **extendable array**：get、update 和原生 array 一樣快，insert、remove 也都實作好了，還多一個本事：**會長大**。原本配 10 格且已滿，再往最後面塞一個，它會自動換一塊 15 或 20 格的空間，把舊的搬過去。去查 vector 提供的操作，能豐富對「array 作為資料結構」的想像。

問：random access 和 fast random access 差在哪？

答：random access 是**功能需求**：給一個編號就能放、拿東西，怎麼實作不管。fast 是一種**實作**：用一塊集中的記憶體，index 和位置有固定對應，馬上算得出位置，也就是 dense array 的做法。

> **比喻** 先要吃飽，再要好吃。需求一層層加上去（能 random access → 要快 → 還要能長大），資料結構就得更複雜，或開始取捨。

### overflow 了怎麼長大

array 最大的麻煩：只畫了 10 個位置，第 11 個就塞不進去，這叫 **overflow**（和 stack overflow 一樣，塞爆了）。爆掉就 grow，分三步：

1. **allocate** 一個新的 array B（地下室櫃子滿了，去買一批新櫃子）。
2. **copy** contents：把 A 的東西一個個搬到 B。
3. **remove A，assign B to A**：丟掉 A，把 B 當成 A 繼續用。

pseudocode 只寫「grow the array」不夠明確，要寫出這三步。花費：allocate 和 assign 大致是常數；copy 有 n 個就花 n 份力氣，是 O(n)，最貴的就是它。

### 兩種長大策略

把 array 當 stack，從 size 1 開始，一個一個 push 共 m 個，比較兩種策略的總花費：

- 策略 A：每次只比舊的多 **1 格**。
- 策略 B：每次漲成 **2 倍**。

策略 A（+1）：

```
放第 k 個   滿了嗎   copy 個數   新 size
   2         滿        1          2
   3         滿        2          3
   4         滿        3          4
  ...       每次都滿   ...        ...
   m         滿       m − 1        m
```

每一輪都會滿，總共 m − 1 次 allocate，copy 總數：

```
1 + 2 + … + (m − 1) = m(m − 1)/2 ≈ m²/2   →   O(m²)
```

策略 B（×2）：

```
放第 k 個   滿了嗎   copy 個數   新 size
   2         滿        1          2
   3         滿        2          4
   4        沒滿       0          4
   5         滿        4          8
  6～8      沒滿       0          8
   9         滿        8          16
 10～16     沒滿       0          16
  17         滿       16          32
```

放到 2ᵏ 之前只 allocate k 次，copy 總數是等比級數：

```
1 + 2 + 4 + … + 2^(k−1) = 2ᵏ − 1
```

> **陷阱** 等比級數的最後一項是 2^(k−1)，總和才是 2ᵏ − 1；別把最後一項寫成 2ᵏ − 1。

### 比較與 amortized analysis

| | +1（勤儉持家） | ×2（貪心一次多要） |
|---|---|---|
| 塞 m 個的 allocate 次數 | 約 m 次 | 約 log m 次 |
| 塞 m 個的 copy 總數 | 約 m²/2 | 約 m（< 2m） |
| 平均每放一個 | 約 m 份力氣，O(m) | 常數，O(1) |
| 最壞單次 | O(m) | O(m)（漲的那一下要等很久） |
| 記憶體 | 用多少拿多少，較省 | 最多浪費約一半 |

×2 的缺點是力氣全集中在漲的那個時間點；+1 的優點是省記憶體。STL 的 vector 用的是倍數成長的混合版。

這種把偶發的大花費攤到每一次操作來看的分析，叫 **amortized analysis（攤銷分析）**：×2 策略每次 push 的 amortized cost 是 O(1)，但最壞單次仍是 O(m)。

> **重點** 倍數成長的 extendable array：push_back amortized O(1)，單次最壞 O(n)；每次只加固定格數則總共 O(n²)、平均 O(n)。

### 把大 array 切成小塊？deque

問：copy 很浪費，能不能把大 array 切成固定大小的小 array，再串起來，省掉 copy？

答：STL 的 **deque** 就是類似的想法：資料分成一塊一塊固定大小的小 array，記憶體集中、cache efficiency 好，又有 linked list 般的彈性，是介於 array 與 linked list 中間的 trade-off。

> **陷阱** 常見的說法是「deque 就是用 linked list 把小 array 串起來，所以跨塊時 random access 會變慢」。實際的 `std::deque` 用一個**指標陣列（map）**記住每一塊的位置：index 先算出在第幾塊、再算塊內位置，random access 仍是 **O(1)**，不必沿著串列一塊一塊走。

## Consecutive array 與 ordered array

Array 像一排編好號的置物櫃：知道號碼就能直接打開任何一格。最自由的用法是「想放哪格就放哪格」，這格放 4、那格放 9，中間空著也無所謂；但資料東一格西一格，空位看起來浪費，要找空位、找資料也麻煩。把 array 當成資料結構來用，就要替它加一點規矩。

- **Consecutive array（連續陣列）**：從最前面開始一格接一格放，中間不留空，例如依序放 5、7、4、6。最後一筆資料的位置叫 **tail**，tail 後面全是空位。
- **Ordered array（有序陣列）**：在連續的基礎上，再要求資料由小到大排好：5、7、4、6 要變成 4、5、6、7。寫成式子是 `arr[0] ≤ arr[1] ≤ … ≤ arr[tail]`，tail 之後當成空的。

所以 ordered array 一定也是 consecutive array。也可以由大到小排（例如成績排行榜從最高分排下來），以下為了簡單都用由小到大。

要排序，放進去的東西就必須有定義好的「小於等於」。數字天生就有；放 struct 或 class 時，要說好比哪個欄位（例如成績單比「成績」這個欄位）。

> **觀念** 平常用 array 只要記住開頭在哪，其他格都能直接算出位址。要維護 consecutive，最好再用一個變數記住 tail。tail 一次告訴你兩件事：資料到哪為止，以及空位從 `tail + 1` 開始。

## Ordered array 的 insert

加上 order 之後，以前的「insert by index」（給號碼就塞進去）行不通了。例如 ordered array 是 3、7、9、10、25、27，要放 13：13 的位置其實早就決定了，一定在 10 和 25 中間，因為 10 ≤ 13 ≤ 25。照 index 硬把它塞進第 0 格，13 排在 3 前面，順序立刻被破壞。所以 ordered array 要有自己的 insert：**先找到正確位置，後面的往後推一格，再放進去**。

> **比喻** 插隊：先找到自己該插在哪，再請後面的人各退一步。

### 例題：在 2、6、7、13 中插入 10 與 4

插入 10：要連續又要由小到大，10 只能放在 7 和 13 之間，也就是 13 目前所在的 [3]。13 先往後擠到 [4]，10 再放進 [3]。

```
index:   0  1  2  3  4
原本:    2  6  7 13  _      tail = 3
13 後移: 2  6  7 13 13
放入 10: 2  6  7 10 13      tail = 4
```

插入 4（同樣從 2、6、7、13 開始）：從 tail 開始一個一個往後搬。

```
index:   0  1  2  3  4
原本:    2  6  7 13  _
13 後移: 2  6  7 13 13
7 後移:  2  6  7  7 13
6 後移:  2  6  6  7 13
放入 4:  2  4  6  7 13      tail = 4
```

插得越前面，要搬的越多。最壞情況（新資料比全部都小）要搬 `tail + 1` 個元素，所以 insert 是 O(n)。

寫成程式的想法：index `i` 從 tail 往前走（不能超出 array 範圍），每格問一句「`arr[i]` 比 data 大嗎？」大就往後搬一格 `arr[i+1] = arr[i]`；一直到遇見不比 data 大的數就停，把 data 放在它後面那格。

### 常見錯誤：看起來對、其實有洞的 insert

下面是一個常見的初版寫法，看似合理，其實有好幾個洞：

```c
/* 初版：有 bug */
void insert(int arr[], int tail, int data) {
    for (int i = tail; i >= 0; i--) {
        if (arr[i] > data)
            arr[i+1] = arr[i];      /* 往後搬 */
    }
}
```

第一個問題：**少了 else**。當 `arr[i] ≤ data` 時，它後面那格已經空出來，應該把 data 放進 `arr[i+1]` 再 break。補上 else 之後，用數字 trace 一遍檢查：data = 10、tail = 3，陣列 2、6、7、13。

| i | arr[i] | arr[i] > 10？ | 動作 | 陣列 [0..4] |
|---|---|---|---|---|
| 3 | 13 | 是 | `arr[4] = arr[3]` | 2 6 7 13 13 |
| 2 | 7 | 否 | else：`arr[3] = 10`，break | 2 6 7 10 13 |

注意 `arr[4] = arr[3]` 是**複製**，[3] 暫時還留著一份舊的 13，等一下才被 10 蓋掉。

看起來完成了？再試一個極端測資：插入 1（比全部都小）。每一格都比 1 大，每一格都往後 copy，迴圈跑到 `i = −1` 就結束，**從沒進過 else**，1 根本沒被放進去，[0] 明明讓出來了，裡面還是舊的 2。所以迴圈結束後要補一句：此時 `i = −1`，把 data 放進 `arr[i+1]`，也就是 `arr[0]`。

第二個問題：array 若已經滿了，`arr[tail+1]` 根本沒有空間，插入前要先檢查。第三：插完 tail 要加一。另外，同一段程式裡 `A` 和 `arr` 混著用這種 typo 也要抓出來。

```c
/* 修正版 */
int insert(int arr[], int *tail, int capacity, int data) {
    if (*tail + 1 >= capacity) return -1;   /* 已滿，沒有空位 */
    int i;
    for (i = *tail; i >= 0; i--) {
        if (arr[i] > data)
            arr[i+1] = arr[i];               /* 比 data 大：往後搬一格 */
        else
            break;                           /* arr[i] <= data：停在這裡 */
    }
    arr[i+1] = data;     /* 一般情況放在 arr[i] 後面；i = -1 時就是 arr[0] */
    (*tail)++;
    return 0;
}
```

> **陷阱** insert 的三個洞：data 比全部都小時（i 跑到 −1）沒被放進去；沒檢查 `tail + 1` 是否超出容量；插完忘了 `tail++`。

> **重點** 寫程式要時時帶著懷疑，用嚴格標準檢查自己；寫錯沒關係，debug 就好。檢查的最好方法是拿實際數字 trace，並且自己想極端測資（最小、最大、已滿、空的）。演算法說起來只是「把東西塞到對的位置」，要寫得邏輯完整並不容易。

> **觀念** 不會證明時，先試幾個 special case，再推廣到 general case。證明沒有標準格式，邏輯合理、能說服人就可以。

## 把散亂的 array 排成 ordered

insert 會寫了，那一開始的 array 怎麼變成排好的？空 array 本來就算排好了。麻煩的是已經有一堆亂的數字，例如 1、3、7、4、6、5、2，就像要整理一間亂掉的房間。

- **Selection sort（選擇排序）**：用 getMinIndex 把最小的找出來，跟開頭那格交換（這個例子 1 剛好就在開頭）；再從剩下的找出最小的（第 2 小）換到第 2 格；接著第 3 小……一路重複。每次「選」出最小的放到前面。
- **Insertion sort（插入排序）**：像玩撲克牌，手上的牌已經排好，每拿一張新牌就插到正確位置。放到 array 上，就是左邊維持一段排好的，每次從右邊抽一個用剛才的 insert 插進去，等於把 ordered array 的 insert 跑很多次。

兩種排序之後的章節都會再細講。

## 加限制的代價：維護（maintenance）

Ordered array 對 array 多加了兩個要求：位置要連續、資料要照順序。要求一多，就得多花力氣：insertion、construction（建出排好的 array）都比普通 array 費工，連 update、remove 都不能隨便做。

- **Update**：例如陣列 2、6、7、13，把 [1] 的 6 直接改成 11，變成 2、11、7、13，順序壞了。改完要檢查：是不是仍比前一格大、比後一格小？11 比後面的 7 大，就往後滾（跟後一格交換），直到位置正確：2、7、11、13。若改完比前一格小，就往前移。
- **Remove**：例如從 2、7、11、13 拿掉 7，中間出現空洞；為了維持連續，後面的要一格一格往前補位（fill in），tail 從 3 變成 2，得到 2、11、13。

> **比喻** 很多資料結構其實就是在「資料的儲存方式」上加限制（例如 ordered、consecutive）。就像規定房間的衣服要照某種方式排，就得花力氣整理。評估一個資料結構的好壞，這些維護代價都要算進去。

## Sequential search：圖書館找書

花這麼多力氣維護順序，到底圖什麼？想像到圖書館找書。每本書有一個編號（索書號），為了簡單，當它是一個可以比大小的數字。書照編號收：不同範圍放不同書架，同一架上再由小到大排，最左邊最小、最右邊最大。**一個書架就像一個 ordered array**，每本書是一格，ID 就是排好的數字。

假設已經找到對的書架，要從架上找 ID 是 56 的書。最直覺的做法：從左邊一本一本看到右邊，看到 56 就停；整排都沒有，就是不在架上。

```c
int sequentialSearch(int arr[], int tail, int toFind) {
    for (int i = 0; i <= tail; i++) {
        if (arr[i] == toFind)
            return i;          /* 找到：在第 i 格 */
    }
    return NOT_FOUND;          /* 全部看完都沒有 */
}
```

這種照順序一個一個看過去的方法叫 **sequential search（循序搜尋）**，寫法跟 getMinIndex 很像。最壞情況是整排看完都找不到（例如找 50），架上的書越多，找得越久。

### Sequential search with cut

上面的做法完全沒用到「排好了」：就算書被小孩弄亂，它也照樣一本一本翻。如果書真的照編號排好，就能找得聰明一點。

> **例題** 書架上依序是 1、3、1234、2046、6000、…，要找 5566。從小往大找：1、3、1234、2046 都比 5566 小，繼續；下一本是 6000，已經比 5566 大。因為排好了，後面只會更大，全都不可能是 5566，直接回報沒找到。

加一個偷吃步（shortcut）：看到的 ID 比要找的大，就直接回報沒找到。這就是偷偷用了 ordered 的性質。要找的編號越小，省得越多：在 1～8 中找 4，看完 1、2、3、4 就有結果，5、6、7、8 都不用看。這個版本叫 **sequential search with cut**。

```c
int sequentialSearchCut(int arr[], int tail, int toFind) {
    for (int i = 0; i <= tail; i++) {
        if (arr[i] == toFind)
            return i;
        if (arr[i] > toFind)
            return NOT_FOUND;  /* 後面只會更大，不必再找；寫成 break 也可以 */
    }
    return NOT_FOUND;          /* 寫在整個 for 外面，前面不需要 else */
}
```

問：最後的 `return NOT_FOUND` 前面要不要加 else？
答：不用。迴圈中碰到比 toFind 大的就中途停下（return 或 break）；最後的 NOT_FOUND 寫在整個 for 外面。如果 for 整個跑完都沒跳出來，代表 toFind 比架上每本都大（例如找 99），根本不在這個架子上。

不過它還是一本一本找，要走到中間某處才能 cut。能不能更早砍掉一大堆？

## Binary search（二分搜尋）

「更早砍」的意思是：**只做一次比較，就排除一大堆不可能的選項**，前提是 array 排好了。做法是不從左邊開始，而是直接跟正中間比。跟中間比完只有三種結果：

- `arr[mid] > toFind`：因為排好了，mid 和它右邊全都比 toFind 大，從 mid 到 tail 一次 cut 掉。
- `arr[mid] < toFind`：mid 和它左邊全都比 toFind 小，從 0 到 mid 一次 cut 掉。
- `arr[mid] == toFind`：找到了。

每跟中間比一次，要嘛直接找到，要嘛砍掉超過一半的候選人，這就是 binary search 的精神。

### 程式

用 begin、end 圍出「還要找的範圍」，一開始是 0 到 tail；每一輪算 `mid = (begin + end) / 2`（整數除法，小數捨去）。

```c
int binarySearch(int arr[], int tail, int toFind) {
    int begin = 0, end = tail;
    while (begin <= end) {                 /* 還有書可找 */
        int mid = (begin + end) / 2;
        if (arr[mid] > toFind)
            end = mid - 1;                 /* cut 掉 mid..end */
        else if (arr[mid] < toFind)
            begin = mid + 1;               /* cut 掉 begin..mid */
        else
            return mid;                    /* 找到 */
    }
    return NOT_FOUND;                      /* begin > end：範圍空了 */
}
```

> **陷阱** 迴圈條件是「還有書可找」才繼續：`while (begin <= end)`。把條件寫反是常見錯誤；`begin > end` 代表範圍已空，回傳 NOT_FOUND。

### 例題：9 格排好的數字中找 8

陣列有 9 格，前五格是 1、4、6、7、9，後四格都比 9 大。

| 輪 | begin | end | mid | arr[mid] | 比較 | 動作 |
|---|---|---|---|---|---|---|
| 1 | 0 | 8 | 4 | 9 | 9 > 8 | end = mid − 1 = 3（一次 cut 掉 [4..8] 共 5 個） |
| 2 | 0 | 3 | 1 | 4 | 4 < 8 | begin = mid + 1 = 2 |
| 3 | 2 | 3 | 2 | 6 | 6 < 8 | begin = 3 |
| 4 | 3 | 3 | 3 | 7 | 7 < 8 | begin = 4 |
| 5 | 4 | 3 | — | — | begin > end | 回傳 NOT_FOUND |

如果改找 11：第一輪 arr[4] = 9 < 11，9 和左邊的 7、6、4、1 都不可能，0 到 mid 整段 cut 掉，begin = 5。

候選數每輪砍一半：9 個 → 4 個 → 2 或 1 個，很快就找到，或確定不在。

> **重點** Binary search 能跳著比，靠的是 array 的 **fast random access（快速隨機存取）**：給任何 index，一步就算出位址、打開那格。很多資料結構做不到。Ordered 的好處是找得快；代價是前面講的 maintenance 要花力氣。

### 為什麼 binary search 是對的

證明有迴圈的演算法，常見做法是找一個每一輪都維持成立的性質，叫 **loop invariant（迴圈不變量）**。

- Binary search 守住的性質：**要找的東西如果在 array 裡，它一定在 begin 到 end 之間**。
- 一開始範圍是 0 到 tail，當然成立。之後範圍變成 begin 到 mid − 1，或 mid + 1 到 end。
- 關鍵是說明丟掉的那段為什麼可以放心丟：例如 arr[4] = 9 > 8。因為排好了，後面每個都 ≥ 9，而 9 > 8，所以後面全都 > 8（遞移律）。丟掉之後，要找的若存在，還是在剩下的 0 到 3 裡。每輪都守住，答案就是對的。

正確性還有另一半：演算法一定要會停，叫 **finiteness**。證法是找一個每輪都變小、又有下限的量：這裡是剩下的 candidate 數，每輪至少少一半，又不可能小於 0，所以迴圈一定會停。Euclid 求 GCD 的演算法也能用同一套想法證明會停：找每輪變小、又有下限的東西。

### 問：把 array 切成三區來找（ternary search），會更快嗎？

答：可以這樣做，但不划算。分三區要跟 1/3、2/3 兩個位置比，等於**兩次比較**才知道答案在哪一區，範圍縮成 1/3。Binary search 做兩次比較（兩輪）範圍縮成 1/4。

```
36 個候選：
binary 兩次比較:  36 → 18 → 9
三分   兩次比較:  36 → 12
```

同樣兩次比較，二分砍得比較多。在離散資料的搜尋裡，三分不會贏二分；除非硬體能一次快速做三方比較，否則拆成兩兩比較就沒有好處。三分搜尋的想法在別處有用，例如數值方法中求函數極值。

### 問：mid = (left + right) / 2 會 overflow 嗎？

答：可能。要 overflow，left 和 right 都得大到超過整數範圍的一半，兩個一加就超過 `INT_MAX`，變成錯的數字，再除以 2 也救不回來。寫程式要 **know your program**：知道程式在什麼環境、什麼假設下跑，不可能每個變數都檢查範圍，在你的假設下它不見得會 overflow。但資料或 index 真的非常大時，改寫成相減的形式，就不會超出範圍：

```c
int mid = left + (right - left) / 2;
```

## Array 單元小結（基本性質）

Array 不只是 malloc 或宣告出來的一塊東西，要懂它和整塊記憶體的關係。最關鍵的性質是 **fast random access**：給 index，一步算出位址、拿到資料。在 array 上再加條件（consecutive、ordered），就能換來更好的演算法，例如圖書館找書的 binary search；代價是維護要花力氣。

## 為什麼只要「大概」：asymptotic behavior

兩種搜尋都寫出來了，誰快、快多少？需要分析工具：分析資料結構與演算法要花的時間與空間。

可以一個 byte、一個指令去算，但很多時候不需要 exact，只要「大概」。一個 int 佔 4 還是 8 bytes、2n 個指令跑 2 秒還是 20 秒，都看平台與計算機架構。我們只關心：大概要 n 個指令，還是 n² 個指令。固定成本（例如不論資料多少都花 1 秒）攤到大量資料就不重要；資料量一大，跟資料量有關的部分就會「浮出來」，常數可以忽略。

> **例題** 要選 n³ 步的演算法，還是 1126n 步的？
> - n = 10：n³ = 1000，1126n = 11260，小資料反而 n³ 省。
> - n = 50：n³ = 125000，已超過 1126n = 56300。
> - 會讓程式跑不完的是大資料，所以要選 1126n：它最終長得沒有 n³ 快。

我們比較的是兩個跟資料量 n 有關的函數 f、g「隨 n 變大長得多快」，只看 n 夠大時的行為，叫 **asymptotic behavior**，所以這套記號叫 **asymptotic notation（漸近符號）**。

> **比喻** Asymptotic notation 是電腦科學的「行話」，就像當兵報無線電，不唸一、二、七，而唸么、兩、拐；機師也有自己的專業用語。圈內人一聽就懂。

## Big-O：上界

`f(n) = O(g(n))`（唸 big O of g）的意思是：f 長得比 g 慢，或差不多，有點像「≤」。

- n 長得比 n² 慢 → `n = O(n²)`。
- 3n 跟 n 同一級 → `3n = O(n)`。1126n / n = 1126，被常數壓住，所以 `1126n = O(n)`。

這個「=」其實比較像「屬於 ∈」：O(n²) 是一群函數的**集合**，n、n²、0.1n²、3n²、√n 都長得比 n² 慢或差不多，都在裡面。Big-O 描述的是一個性質，同一個函數可以屬於很多個集合。另一種看法：Big-O 在函數之間建立了像「≤」的排序（比的是 n 夠大時的大小）。真實步數裡，長得比較慢的次要項都被吃掉、常數丟掉，只留主要項寫進 Big-O。

### 直覺定義：取極限

n → ∞ 時看 f/g，只要沒暴衝出去、被某個常數 c 壓住（`lim f/g ≤ c`），f 就被 g 包住了。例如 f = 1, 2, 3, … 時 g = 10, 20, 30, …，相除一直是 1/10，沒有暴衝，所以 f = O(g)。

### 正式定義：c 與 n₀

為避免除以零等問題，假設 f、g 都是正函數。

> **重點** `f(n) = O(g(n))` ⇔ 存在常數 c > 0 與 n₀，使得所有 n ≥ n₀ 都有 `f(n) ≤ c·g(n)`。

正式書籍幾乎都用這個定義，不用極限。原因：極限版本要求極限存在，比較嚴格。

> **例題** f(n) = |sin n|、g(n) = 1。|sin n| 在 0 和 1 之間一直跳，n 再大也不收斂，極限不存在。但取 c = 1，它永遠壓在 1 下面，照正式定義 `|sin n| = O(1)`。

所以極限是 Big-O 的**充分條件（sufficient condition），不是必要條件（necessary condition）**。正式定義比較廣，把沒有極限的情形也包進來了。

真的會遇到這種跳動的成本嗎？會。例如把 array 化整為零，每 100 筆放一個小區塊，區塊之間用類似 linked list 的方式串起來。區塊內像 array，操作成本跟這塊有多滿有關，在 0 到 100 之間跳、一點也不收斂，但被常數壓住，仍是 O(1)。

### 證明：lim f/g = c ⇒ f = O(g)

前提：f、g 是正函數，f/g 的極限是 c。

1. 極限的定義：給任何 ε > 0，都找得到 n₀，使 n > n₀ 時 `|f/g − c| < ε`。
2. 這裡只需要挑一個 ε 和它對應的 n₀ 就夠了。於是 n > n₀ 時 `f/g < c + ε`。
3. 取 c′ = c + ε、n₀′ = n₀，就得到 n > n₀′ 時 `f ≤ c′·g`（< 與 ≤、> 與 ≥ 的細節不影響），符合正式定義，證完。

反方向不成立（|sin n| 就是反例）。證明 Big-O 有兩條路：證極限存在且 ≤ c；或直接從定義找出 c 與 n₀。直覺（極限）和定義兩個都要懂。

> **觀念** 極限的定義拆開絕對值會同時得到上限和下限，但 Big-O 只需要上限（下限用另一個記號 Ω）。f、g 都是正函數時拆不拆絕對值沒差；麻煩的是負的函數，例如兩個量的差 f₁ − f₂ 可能是負的，用 Big-O 時要講清楚怎麼處理。時間、空間本身不會是負的。

### 例題：3n + 2 = O(n)，而且要寫最緊的上界

一支程式數出來要 3n + 2 個指令，這個 **step count（執行步數）** 就是定義裡的 f(n)。取 c = 4、g(n) = n：

| n | 3n + 2 | 4n | 3n + 2 ≤ 4n？ |
|---|---|---|---|
| 1 | 5 | 4 | 否 |
| 2 | 8 | 8 | 是 |
| 3 | 11 | 12 | 是 |

n ≥ 2 起都成立，所以 n₀ = 2，`3n + 2 = O(n)`。

3n + 2 ≤ n² 也成立，n²、n³ 都是 upper bound。但 g(n) 要取最小的上界，**least upper bound**，所以寫 O(n)。

> **陷阱** 說 `3n + 2 = O(n²)` 數學上不算錯，但不會這樣寫。Big-O 隱含「最緊的上界」：1 ≤ 10、1 ≤ 1126、1 ≤ 5566 都對，可是一個 n² 的演算法不會說成 O(n¹¹²⁶)，這種鬆的上界描述不了演算法的性質。行規是：除了數學正確，還要給想得到、證得出的最緊上界。以上對時間、空間都適用。

> **觀念** 這裡的 upper bound／lower bound 是複雜度理論的意思，跟某些 library 裡 `upper_bound`、`lower_bound` 函式（在排好的序列裡找位置）不是同一件事。

## Big-Ω 與 Big-Θ

**Big-Ω（下界）**：定義跟 Big-O 一樣，只是不等號反過來。

> **重點** `f(n) = Ω(g(n))` ⇔ 存在 c > 0 與 n₀，使所有 n ≥ n₀ 都有 `f(n) ≥ c·g(n)`。

例：3n + 3 ≥ 3n 對所有 n ≥ 1 成立，所以 `3n + 3 = Ω(n)`。g(n) 要取**最大的** lower bound：例如 f(n) = n³ + 2，n²、n 都是 lower bound，但要寫最大的那個（n³）。

**Big-Θ（上下夾住）**：既是 O 又是 Ω，就是「差不多」。

> **重點** `f(n) = Θ(g(n))` ⇔ 存在 c₁, c₂ > 0 與 n₀，使所有 n ≥ n₀ 都有 `c₁·g(n) ≤ f(n) ≤ c₂·g(n)`。此時 g(n) 既是 lower bound 也是 upper bound。

例：n ≥ 2 時 3n ≤ 3n + 2 ≤ 4n，所以 `3n + 2 = Θ(n)`。

用極限看：若 f/g 收斂到 8，n 夠大時 f/g 介於 8 − ε 與 8 + ε 之間，上面符合 O、下面符合 Ω，所以是 Θ。

> **陷阱** 極限要滿足 0 < c < ∞ 才是 Θ。極限是 0 只能說 f = O(g)：例如 n / n² → 0，所以 n = O(n²)，但 n 不是 Θ(n²)。定義裡的常數 c 都要大於 0。

> **觀念** 正式定義是一切真理的來源；直覺（極限）定義幫助我們想像 well-behaved 的函數。實務上 Big-O 大約佔八成，Ω 和 Θ 合起來一成多。Ω 常用來說「一個問題最少需要多少時間」（例如比較式排序至少要 n log n），不是某個 input 下運氣好的最佳時間。另外還有 little-o、little-omega，各有定義（比較接近極限的定義），只在特定地方用到。

## 常用函數的成長順序

常見的 g(n) 由慢到快：

```
1  <  log n  <  log²n  <  n  <  n log n  <  n²  <  n³  <  2ⁿ
```

- **1（constant）**：表示被某個常數 c 壓住，寫 2、5、1126 都可以，習慣寫 1。不論 n 多大都在常數時間算完，最強：100 萬筆跟 1000 萬筆一樣快。
- **log n**：還會長大，但比 n 慢；介於 1 和 n 之間。能做到 log n 就很好。
- **n、n²、n³**（linear、square、cubic）：多項式成長；n³ 在大資料下就不一定跑得動。
- **n log n**：介於 n 和 n² 之間。
- **2ⁿ（exponential）**：最差。n 只到 5、6，2ⁿ 就開始往上飄。

> **重點** log 的底不重要：`log₂ n = log₁₀ n / log₁₀ 2 ≈ 3.32 · log₁₀ n`，換底只差一個常數倍，吸收進 c，所以寫 log n 就好。

> **陷阱** 指數的底**不能**換：`5ⁿ / 2ⁿ = 2.5ⁿ`，沒有任何常數壓得住，所以 5ⁿ ≠ O(2ⁿ)。只有 log 的底是常數倍、可以忽略；指數比 log 更 tricky。

> **例題** 算出 n² log n，表上沒有，落在哪？把 n² 想成 n² × 1，比較 1 和 log n：log n 比 1 大、比 n 小，所以 n² < n² log n < n³。表只是典型的大概區間，考試常問表上沒有的，要自己推。

## 搜尋的成本：Θ(n) 對 O(log n)

**Sequential search**：最佳情況第一格就找到，只花常數時間；但分析看的是最差情況：整個 array 看完才說找不到。例如最差要 5n + 7 步，上下都被 n 夾住，是 **Θ(n)**。這種力氣跟 array 大小 n 成正比的叫 linear complexity algorithm。

**Binary search**：運氣好第一次就中，但世上沒那麼多好運，看最壞情況。每輪只看中間、丟掉至少一半：

```
16 個數找 50（不存在）：
16 → 8 → 4 → 2 → 1        共 4 輪 = log₂ 16
（實際每輪還多丟掉 mid 那一個，所以更快一點）
```

每輪裡幾個 if、比較只是常數，底數 2 也不寫，所以 binary search 是 **O(log n)**。

> **例題** n = 1000：2¹⁰ = 1024，binary search 約 10 輪；sequential search 最差 1000 輪。就算 sequential 每輪只要 10 個指令、binary 每輪要 50 個：1000 × 10 = 10000 遠大於 10 × 50 = 500。Worst-case analysis 告訴我們資料量大時大概要跑多久。

問：除了 binary search，還有別的 O(log n) 嗎？
答：Binary search 屬於 **divide and conquer（分治法）** 家族：把大問題切成小問題再分頭解決。Binary search 切成兩半後，發現其中一半根本不含答案、可以丟掉，只剩一半。這種「切開後只留下少數小問題」的演算法，分析起來常有 O(log n) 的特性。

## 組合多個 Big-O：和的規則、遞移律、bottleneck

Binary search 要 array 已經排好。沒排好怎麼找？

- 方法一：不排序，直接 sequential search，約 n。
- 方法二：先 selection sort 再 binary search。Selection sort 每輪做一次 getMinIndex（本質就是一次 sequential search，約 n），n 輪約 n²；再加 binary search 的 log n。

n² 和 log n 要怎麼合起來？需要從定義證明幾個規則。

### 和的規則

若 f₁ = O(g)、f₂ = O(g)：n ≥ n₁ 時 f₁ ≤ c₁·g，n ≥ n₂ 時 f₂ ≤ c₂·g。

1. n 要同時比 n₁ 和 n₂ 大，取 n₀ = max(n₁, n₂)（例如 n₁ = 1126、n₂ = 5566，取 5566）。
2. 兩式相加：n ≥ n₀ 時 f₁ + f₂ ≤ (c₁ + c₂)·g。
3. 找到了新的 c = c₁ + c₂ 與 n₀，所以 f₁ + f₂ = O(g)。

### 遞移律

若 f = O(g₁)、g₁ = O(g₂)，則 f = O(g₂)。新的 c = c₁·c₂，新的 n₀ = max(n₁, n₂)。

> **觀念** 從定義證明的套路：先把定義寫下來（先賺兩行），再推出需要的 n₀ 與 c。

### 套回「先排再找」

Selection sort f₁ = O(n²)；binary search f₂ = O(log n)，而 log n = O(n²)，所以 f₂ = O(n²)。由和的規則，f₁ + f₂ = O(n²)：先排再找最差要 n²，比直接 sequential search 的 n 還慢。

把程式切成小段各自分析再組合，就看得出拖垮整體的 **bottleneck（瓶頸）**，這裡是 selection sort。

> **比喻** 多項式只留最大項：n³ + n² + n + 1 = O(n³)，其他項都被吞掉，像秦吞六國。

### 更一般的組合規則

設 T₁(n) = O(f(n))、T₂(n) = O(g(n))：

| 結構 | 規則 |
|---|---|
| A 做完再做 B（循序） | T₁ + T₂ = O(max(f(n), g(n))) |
| A 的迴圈裡呼叫 B（巢狀） | T₁ · T₂ = O(f(n) · g(n)) |
| T(n) 是 k 次多項式 | T(n) = O(nᵏ)，例如 n³ + 4 = O(n³) |
| logᵏ n（k 是常數） | logᵏ n = O(n)（可自行用定義找 c 與 n₀ 證明） |

> **陷阱** logᵏ n 指 (log n)ᵏ，結論是 O(n)；別跟 log(nᵏ) 搞混：log(nᵏ) = k·log n = O(log n)。

## 數迴圈：step count

```c
for (i = 0; i < n; i++) {      /* 跑 n 圈 */
    x++; y++; z++;             /* 每圈 3 個指令 */
}
/* step count = 3n → O(n) */
```

```c
for (i = 0; i < n; i++)
    for (j = 0; j < n; j++)
        x++;                   /* n × n 次 → O(n²) */
```

巢狀迴圈是相乘。若內圈改成 `j < i/2`，要自己加總：i = 0, 1, …, n−1 時內圈約跑 i/2 次，總和約 (0 + 1 + … + (n−1)) / 2 ≈ n²/4，仍是 O(n²)。這類變形是常見考法。

**一前一後兩個 block**：看 bottleneck。

```c
for (i = 0; i < n; i++)        /* block 1：n 次 */
    a[i] = 0;
for (i = 0; i < n; i++)        /* block 2：n² 次 */
    for (j = 0; j < n; j++)
        a[i] += i + j;
/* n + n² → 取大的，整支 O(n²) */
```

**if-else**：看較大的分支，因為最壞會走那條。

```c
if (x > 0) {
    x++; y++;                  /* 2 個指令 */
} else {
    for (i = 0; i < n; i++)    /* n 次 */
        y += i;
}
/* O(n) */
```

## 遞迴與 2ⁿ

**n 階乘**：

```c
int f(int n) {
    if (n <= 1) return 1;      /* boundary condition */
    return n * f(n - 1);
}
```

T(n) 是執行 f(n) 的 step count，呼叫 f(n−1) 要花 T(n−1)，加上每次固定的成本 c：`T(n) = T(n − 1) + c`，共 n 層，T(n) = O(n)。（解遞迴式的方法在離散數學、演算法會教。）

**Fibonacci**（常簡寫 FB，不是 Facebook）：FB(n) = FB(n − 1) + FB(n − 2)。每次呼叫兩個自己：`T(n) = T(n − 1) + T(n − 2) + c`，同一個 F(2) 被一算再算，T(n) = Θ(φⁿ)，φ ≈ 1.618，上界寫 O(2ⁿ)。

2ⁿ 的程式其實很多：n 每多 1，時間就翻倍。例如窮舉所有長度 n 的 0/1 字串，共 2ⁿ 種，沒有好方法就只能一個一個試；沒寫好的 recursion（如上面的 Fibonacci）也常出現 2ⁿ。

> **觀念** 電腦通常無法判斷一個 recursion「永遠跑不完」；遞迴程式報錯，多半是真的跑不下去了（原因在之後的 system stack 會解釋）。

## 實際要跑多久：每秒 10⁹ 步

假設 f 就是實際步數，電腦每秒跑 10⁹ 步：

| f(n) | 例子 |
|---|---|
| n | 10 筆 0.01 μs；10⁶ 筆 1 毫秒 |
| n log n | 10⁶ 筆約 2×10⁷ 步 ≈ 20 毫秒，可以接受 |
| n² | 10 筆 0.1 μs；1000 筆 1 毫秒；10⁶ 筆 10¹² 步 ≈ 16.67 分鐘 |
| n³ | 100 筆 1 毫秒；1000 筆 1 秒；10⁵ 筆 ≈ 11.57 天；10⁶ 筆 ≈ 32 年 |
| n⁴ | 10⁴ 筆 ≈ 10⁷ 秒，約三分之一年 |
| n¹⁰ | 40、50 筆都不一定跑得出來 |
| 2ⁿ | 50 筆 ≈ 13 天；100 筆比宇宙年齡還久 |

真寫成 n³ 去處理 10⁵ 筆資料，就得提早好幾天開始跑。

空間也一樣：5 萬 × 5 萬的 double 矩陣，每個 8 bytes，50000 × 50000 × 8 = 2 × 10¹⁰ bytes = 20 GB，一般電腦的記憶體放不下。

## 複雜度是趨勢，running time 是一個點

時間複雜度描述的是「隨資料量增加，程式使用的時間怎麼變化」，是一條曲線的趨勢；實際跑出來的 running time 是這條曲線上的一個點。

- 分析出是平方關係，就先跑 10 筆、再跑 100 筆：資料 10 倍，時間應該約 100 倍；再到 1000 筆又乘約 100 倍，一路推估到大資料。
- 千萬別第一次就丟最大的資料：從小的開始，一邊驗證正確性，一邊估計能不能在時限內跑完。寫程式重要的是邏輯與「有系統的測試」。
- Big-O 只描述成長趨勢，忽略常數與低次項；n 很小時實測時間不一定符合這個比例。

複雜度（time、storage）跟機器無關，只推 step count；實際執行時間才跟機器有關。C 可以用 `time.h` 量：開始和結束各抓一次系統時間，相減就是程式花的時間（不同平台抓 system time 的方式不同）。

```c
#include <time.h>
clock_t start = clock();
/* ... 要量的程式 ... */
clock_t stop = clock();
double seconds = (double)(stop - start) / CLOCKS_PER_SEC;
```

> **觀念** 回顧：algorithm 是解決問題的方法；data structure 是把方法 implement 出來的方式，影響 performance。用 time 與 storage complexity 評估方法好壞。

> **陷阱** C/C++ 配置的 array 一定是一塊連續記憶體，宣告超大的 array（例如好幾 GB）在別台機器上可能配置失敗，要檢查 `malloc` 的回傳值（或 `new` 的結果）。程式跑完沒有偵測到 memory violation，不代表沒有記憶體錯誤，只是這次沒被抓到，就像小偷只是還沒被抓。程式佔很大記憶體時，被排程換出再換回，process switch 也要花較長時間。

> **觀念** 嵌入式系統（embedded system）：裝在機器裡、只做特定任務的小電腦（例如門口偵測有人經過的攝影機），電力、體積都受限制，特別在乎資源用量。輸出格式、檔名、編譯方式等規格（spec）寫清楚了就要照做，follow the spec 是寫程式的人自己的責任。

## Ordered list 與多項式

有了 array 就能做 **ordered list（有序串列）**：一個接一個、有順序，例如一週七天照順序放進 array。可以問它多長、從頭 scan 把值印出來、取出第幾個位置的值。所以 array 其實也可以看成一種 list。

第一個應用是**多項式（polynomial）**：

```
A(x) = 3x²⁰ + 2x⁵ + 4
B(x) = x⁴ + 10x³ + 3x² + 1
A(x) + B(x) = 3x²⁰ + 2x⁵ + x⁴ + 10x³ + 3x² + 5
```

相加就是同次方對齊、係數相加；這兩個只有常數項撞在一起，4 + 1 = 5，其他項照抄。多項式 ADT 還有減法，以及 Eval（代入 x，例如 x = 5，算出值）。第一個問題是：多項式在電腦裡要怎麼存？

### 表示法 1：係數陣列

一個 `int degree`（多項式的次數，最高的指數）加一個係數陣列 `coef`：**index 就是指數，value 就是係數**。

```cpp
class Polynomial {
private:
    int degree;                     // degree <= MaxDegree
    float coef[MaxDegree + 1];      // coef[i] 是 xⁱ 的係數
};
```

B(x) = x⁴ + 10x³ + 3x² + 1：

```
index (指數): 0   1   2   3   4
coef  (係數): 1   0   3  10   1      degree = 4
```

沒有 x¹，那格就放 0。陣列大小是 MaxDegree + 1：MaxDegree 設 100，最多存到 x¹⁰⁰，x¹⁰¹ 就存不下；+1 是給 index 0 的常數項。

### padd：多項式加法的 pseudocode

計算 d = a + b：

```
d = Zero();                               // 初始化：D 的係數全清成 0
while (!IsZero(a) && !IsZero(b)) do {
    switch (COMPARE(LeadExp(a), LeadExp(b))) {
    case 1:   // a 的最高次方較大
        d = Attach(d, Coef(a, LeadExp(a)), LeadExp(a));
        a = Remove(a, LeadExp(a));
        break;
    case 0:   // 次方相同：係數相加
        sum = Coef(a, LeadExp(a)) + Coef(b, LeadExp(b));
        if (sum) d = Attach(d, sum, LeadExp(a));
        a = Remove(a, LeadExp(a));
        b = Remove(b, LeadExp(b));
        break;
    case -1:  // b 的最高次方較大
        d = Attach(d, Coef(b, LeadExp(b)), LeadExp(b));
        b = Remove(b, LeadExp(b));
    }
}
把 a 或 b 剩下的項全部接到 d
```

- `IsZero`：判斷多項式是否已經空了，空了就沒得比。
- `LeadExp`：回傳最高次方（leading exponent）。
- `COMPARE`：回傳 1（A 大）、−1（B 大）、0（一樣大）。
- `Attach`：把一項 copy 到 D；`Remove`：從原多項式刪掉這一項，下一圈才能比「新的」最高項。

### 例題：trace A(x) = 3x²⁰ + 2x⁵ + 4、B(x) = x⁴ + 10x³ + 3x² + 1

| 圈 | LeadExp(A) | LeadExp(B) | COMPARE | 動作 | 加進 D |
|---|---|---|---|---|---|
| 1 | 20 | 4 | 1 | Attach A 的項，Remove | 3x²⁰ |
| 2 | 5 | 4 | 1 | Attach A 的項，Remove | 2x⁵ |
| 3 | 0 | 4 | −1 | Attach B 的項，Remove | x⁴ |
| 4 | 0 | 3 | −1 | Attach B 的項，Remove | 10x³ |
| 5 | 0 | 2 | −1 | Attach B 的項，Remove | 3x² |
| 6 | 0 | 0 | 0 | 係數相加 4 + 1 = 5 | 5 |

兩邊都空了，迴圈結束：D = 3x²⁰ + 2x⁵ + x⁴ + 10x³ + 3x² + 5。（case 0 的道理也可以用 4x⁴ + x⁴ = 5x⁴ 來想。）

整段就是 **while、比大小、三個 case**。

### 表示法 1 的問題：sparse 多項式

A(x) = 2x¹⁰⁰⁰ + 1 用表示法 1 要開 1001 格，只有 index 1000 放 2、index 0 放 1，其他 999 格全是 0，非常浪費。多數多項式都是 **sparse（稀疏）** 的。（還有一種表示法 2，這裡略過，可自行看課本，也可能考。）

### 表示法：只存 (指數, 係數) 的 pair

只存非 0 項，每項存成 (指數, 係數) 的 pair。例如：

```
f(x) = 5 + x − 4x² + 10x⁵ + x¹⁶
     → (0,5) (1,1) (2,−4) (5,10) (16,1)
g(x) = 3 + 6x⁵
     → (0,3) (5,6)
```

依指數順序存，加法時容易對齊同次項，所以用 ordered array（ordered by exponent）。這也是之後 linked list 表示多項式的出發點。

### 表示法 3：所有多項式共用一個 termArray

乾脆用一個很大的 global array 存「所有」多項式。每格存兩個數：係數 coef 與指數 exp，只存非 0 的項。每個多項式記住自己的起點和終點（start、finish）；`free` 指向剩下空間的開頭。

A(x) = 2x¹⁰⁰⁰ + 1、B(x) = x⁴ + 10x³ + 3x² + 1：

| index | 0 | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|---|
| coef | 2 | 1 | 1 | 10 | 3 | 1 | |
| exp | 1000 | 0 | 4 | 3 | 2 | 0 | |
| 標記 | A.start | A.finish | B.start | | | B.finish | free |

A 佔 0～1，B 佔 2～5，free = 6。上面標的 A.start、free 等文字電腦不存，只是方便說明。大家擠同一個 array，每個多項式一定要記住自己的 start 和 finish。

（複習：array 本身是一組 `<index, value>` 的 pair，可以是一維或二維。）

### class Term、friend 與 static

概念不難，難在宣告。表上每一格是一個 `Term`：

```cpp
class Polynomial;          // 先宣告

class Term {
    friend class Polynomial;   // Polynomial 可以直接存取 Term 的 private 資料
private:
    float coef;            // 係數
    int exp;               // 指數
};

class Polynomial {
private:
    static Term termArray[MaxTerms];  // 所有多項式共用
    static int free;                  // 第一個還沒用的 index
    int start, finish;                // 這個多項式在 termArray 的範圍
public:
    Polynomial Add(Polynomial B);
    void NewTerm(float c, int e);
};
```

問：termArray 為什麼要加 `static`？
答：不寫 static，每個 Polynomial 物件各有一份自己的 termArray；寫了 static，這個變數屬於整個 class、只有一份，A、B 才共用同一個 array。`free` 也是 static，大家共用。MaxTerms 是 termArray 最多能放的項數。

> **陷阱** static 是關鍵，不要拿掉；少了它就做不到「一個 global array 存所有多項式」。

### NewTerm

新多項式從 free 開始放。例如要放 C(x) = x¹⁰⁰ + 1：從 free = 6 放起，C.start = 6；兩項，C.finish = 7。每一項呼叫一次 NewTerm：

```cpp
void Polynomial::NewTerm(float c, int e) {
    if (free >= MaxTerms) {
        cerr << "Too many terms in polynomials" << endl;
        return;                       // array 滿了，放不下
    }
    termArray[free].coef = c;
    termArray[free].exp = e;
    free++;                           // 移到下一個空位
}
```

```
第一項：termArray[6] = (coef 1, exp 100)，free → 7
第二項：termArray[7] = (coef 1, exp 0)，  free → 8
```

### 在 termArray 上做加法：A.Add(B)

```cpp
Polynomial Polynomial::Add(Polynomial B) {
    Polynomial C;
    int a = start, b = B.start;
    C.start = free;
    float c;
    while (a <= finish && b <= B.finish) {
        if (termArray[a].exp == termArray[b].exp) {        // 指數相同
            c = termArray[a].coef + termArray[b].coef;
            if (c) NewTerm(c, termArray[a].exp);
            a++; b++;
        } else if (termArray[a].exp < termArray[b].exp) {  // B 較大
            NewTerm(termArray[b].coef, termArray[b].exp);
            b++;
        } else {                                           // A 較大
            NewTerm(termArray[a].coef, termArray[a].exp);
            a++;
        }
    }
    for (; a <= finish; a++)          // A 剩下的項
        NewTerm(termArray[a].coef, termArray[a].exp);
    for (; b <= B.finish; b++)        // B 剩下的項
        NewTerm(termArray[b].coef, termArray[b].exp);
    C.finish = free - 1;
    return C;
}
```

迴圈條件 `a <= A.finish && b <= B.finish`：兩邊都還沒走完才比；一邊先走完，就用 for 把另一邊剩下的項全部 copy 過去。

### 例題：A(x) = 2x¹⁰⁰⁰ + 1 加 B(x) = x⁴ + 10x³ + 3x² + 1

A 佔 0～1、B 佔 2～5，所以 C.start = free = 6。

| 步 | a 指的項 | b 指的項 | 比較 | NewTerm 寫入 | free 之後 |
|---|---|---|---|---|---|
| 1 | 2x¹⁰⁰⁰ | x⁴ | 1000 > 4 | [6] = (2, 1000)，a++ | 7 |
| 2 | 1 | x⁴ | 0 < 4 | [7] = (1, 4)，b++ | 8 |
| 3 | 1 | 10x³ | 0 < 3 | [8] = (10, 3)，b++ | 9 |
| 4 | 1 | 3x² | 0 < 2 | [9] = (3, 2)，b++ | 10 |
| 5 | 1 | 1 | 0 = 0 | 1 + 1 = 2，[10] = (2, 0)，a++、b++ | 11 |

兩邊同時走完，不需要 copy 剩餘項。C 佔 6～10，C(x) = 2x¹⁰⁰⁰ + x⁴ + 10x³ + 3x² + 2。

| index | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| coef | 2 | 1 | 1 | 10 | 3 | 1 | 2 | 1 | 10 | 3 | 2 | |
| exp | 1000 | 0 | 4 | 3 | 2 | 0 | 1000 | 4 | 3 | 2 | 0 | |
| 屬於 | A | A | B | B | B | B | C | C | C | C | C | free |

**時間複雜度**：A 有 n 個非 0 項、B 有 m 個，兩個指標每比一次至少一個往前，兩邊都只 scan 一次，所以 **O(n + m)**。係數為 0 的項根本沒存在 termArray，不算。

> **重點** 換了表示法，加法的**演算法一模一樣**：while、比大小、大於／等於／小於三個 case。變的只有指令細節。

> **觀念** 程式不難，但要花時間一行一行 trace：自己把程式打進去、宣告好，一行一行 debug。

### 表示法 3 的 storage 分析

每個多項式要存 start、finish 兩個數，再加 `finish − start + 1` 個項；每項存 exp 與 coef 兩個數，所以要乘 2：

```
storage = 2 × (finish − start + 1)  （再加上 start、finish）
```

如果多項式不 sparse（幾乎每個次方都有），表示法 3 大約是表示法 1 的**兩倍**，因為表示法 1 的指數就是 index，不用另外存 exp。但大部分多項式都很 sparse，所以表示法 3 還是很好用。

### termArray 滿了怎麼辦：回收空間

問題：free 已經到了 MaxTerms（例如最多 100 個 term），又來一個新的多項式，怎麼辦？

- 最笨的做法：丟一句「滿了」，使用者會覺得程式寫得很懶。
- 較好的做法：**回收**。A、B 加完如果不用了，它們的位置可以再用。回收寫在 **destructor**：多項式不用時，把它佔的空間還給 termArray。

> **陷阱**（可能考）光靠一個 free 指標能回收嗎？不行。free 只會往後配，空出來的洞可能在中間；有些格空、有些被佔用時，NewTerm 也不能只看最後的 free。常見做法有兩種：一是像磁碟重組（compaction），把還在用的項往前搬、集中成一塊，並更新各多項式的 start、finish；二是用 free list 記下所有空洞。

> **比喻** 這跟作業系統的 memory management 很像，也像 Windows 的磁碟重組：把還在用的資料往前 shift、集中成一塊。

## Sparse matrix 與 `<row, col, value>`

第二個應用是**矩陣（matrix）**。矩陣有加、減、乘，也有轉換（transpose）。最直接是 n × m 的二維陣列，但 **sparse matrix（稀疏矩陣）** 大部分是 0，用二維陣列存很浪費。例如下面 6 × 6 有 36 格，只有 8 個不是 0：

```
       col0 col1 col2 col3 col4 col5
row0 [  15    0    0   22    0  -15 ]
row1 [   0   11    3    0    0    0 ]
row2 [   0    0    0   -6    0    0 ]
row3 [   0    0    0    0    0    0 ]
row4 [  91    0    0    0    0    0 ]
row5 [   0    0   28    0    0    0 ]
```

把它想成一個 ADT：constructor 給 row、column 數，能做 Transpose（row 變 column、column 變 row）、Add、Multiply。重點是怎麼存、怎麼轉置。

答案：只記非 0 element 的位置和值，每筆用 row、col、value 三個數，叫 **triple（三元組）**，放進一維陣列。8 個非 0 值就只要 8 格。

**排列規則**：先依 row 由小到大；row 相同再依 column 由左到右。row 0 放完才放 row 1。

```
      row col value
a[0]   0   0   15
a[1]   0   3   22
a[2]   0   5  -15
a[3]   1   1   11
a[4]   1   2    3
a[5]   2   3   -6
a[6]   4   0   91
a[7]   5   2   28
```

```cpp
class SparseMatrix;

class MatrixTerm {
    friend class SparseMatrix;
private:
    int row, col, value;
};

class SparseMatrix {
private:
    int rows, cols, terms;          // 列數、行數、非零項個數
    MatrixTerm smArray[MaxTerms];   // 非零項，最多 MaxTerms 個
public:
    SparseMatrix Transpose();
    SparseMatrix FastTranspose();
};
```

> **陷阱** 另一種寫法（部分課本採用）：a[0] 放表頭 (rows, cols, terms) = (6, 6, 8)，非零項從 a[1] 開始。這裡直接從 index 0 數非零項。

## Transpose 的難處

Transpose 是 row 變 column、column 變 row：(0, 3, 22) 轉過去變 (3, 0, 22)。難的是：轉完的 B **也要照 row、再照 column 排好**。原本在 A[1] 的 22，轉過去是 row 3，前面還有 row 0、1、2 的項，所以要放在 B[5]，index 變了（A1 → B5）。轉置後的 B：

```
      row col value
b[0]   0   0   15
b[1]   0   4   91
b[2]   1   1   11
b[3]   2   1    3
b[4]   2   5   28
b[5]   3   0   22
b[6]   3   2   -6
b[7]   5   0  -15
```

### 最笨的做法：一項一項轉再搬移

照 A 的順序一筆一筆轉，前三筆直接接在後面都沒事：(0,0,15) → (0,0,15)、(0,3,22) → (3,0,22)、(0,5,−15) → (5,0,−15)，放在 B0、B1、B2。

第四筆 (1,1,11) 轉完還是 (1,1,11)，但它是 row 1，應該插在 (0,0,15) 和 (3,0,22) 中間，放最後就錯了，只好往上插、後面整串往下搬。下一筆 (1,2,3) → (2,1,3) 又要移到 row 3 的前面……每轉一個就要調整位置，牽涉大量資料移動。row、col 對調靠人工一眼就會，但電腦很笨，必須告訴它每一項放哪。

### Simple transpose：外圈 column、內圈 terms

轉置後 column 會變成 row，所以外圈以 column 當主要 index：c = 0 時，就是在湊新的第 0 row。內圈把所有非零項檢查一次，挑出 `col == c` 的。

```cpp
SparseMatrix SparseMatrix::Transpose() {
    SparseMatrix b(cols, rows, terms);      // 列數與行數對調
    if (terms > 0) {                        // 有非零項才需要轉
        int currentB = 0;                   // b 下一個要放的位置
        for (int c = 0; c < cols; c++)      // 依 column 掃
            for (int i = 0; i < terms; i++) // 檢查每一個非零項
                if (smArray[i].col == c) {
                    b.smArray[currentB].row = c;
                    b.smArray[currentB].col = smArray[i].row;
                    b.smArray[currentB].value = smArray[i].value;
                    currentB++;
                }
    }
    return b;
}
```

c = 0：a[0] 和 a[6] 的 column 是 0，依序產生 b[0] = (0, 0, 15)、b[1] = (0, 4, 91)，currentB 變 2。c 從 0 跑到 5，B 自然照 row 排好，完全不用搬。

**複雜度**：外圈 cols 次、內圈 terms 次，O(terms · cols)；這個例子 6 × 8 = 48 次檢查。浪費在於已經轉好的 element，下一輪 c 還是要被檢查一次。

> **陷阱** 直接用二維陣列轉置是 O(rows · cols)。若矩陣不 sparse，terms = rows · cols，simple transpose 變成 O(cols² · rows)，**比二維陣列還慢**。

## Fast transpose：先算 rowSize 和 rowStart

問題出在每次都重新 scan 整個 array。解法是先做統計：轉過去以後第 0 row 有幾個、第 1 row 有幾個，先替每個 row 預留位置。另外開兩個 array：

- `rowSize[i]`：轉置後第 i row 有幾個 element。
- `rowStart[i]`：轉置後第 i row 從哪一格開始放。

以下示範方向反過來：把上面的 B 轉回 A。轉過去的 row 就是原本的 column。

### 第一步：算 rowSize

初始化全為 0，再掃一次 B，拿每筆的 column 當 index 加 1：`rowSize[b[i].col]++`。

| i | b[i] | col | rowSize[0..5] 之後 |
|---|---|---|---|
| 0 | (0,0,15) | 0 | 1 0 0 0 0 0 |
| 1 | (0,4,91) | 4 | 1 0 0 0 1 0 |
| 2 | (1,1,11) | 1 | 1 1 0 0 1 0 |
| 3 | (2,1,3) | 1 | 1 2 0 0 1 0 |
| 4 | (2,5,28) | 5 | 1 2 0 0 1 1 |
| 5 | (3,0,22) | 0 | 2 2 0 0 1 1 |
| 6 | (3,2,−6) | 2 | 2 2 1 0 1 1 |
| 7 | (5,0,−15) | 0 | 3 2 1 0 1 1 |

column 0 的有 b[0]、b[5]、b[7] 三個；column 1 的有 b[2]、b[3] 兩個。rowSize = 3, 2, 1, 0, 1, 1。這一步掃過 terms 一次，O(terms)。

### 第二步：算 rowStart

rowStart[0] = 0；之後**這列起點 = 前一列起點 + 前一列的 rowSize**：`rowStart[i] = rowStart[i−1] + rowSize[i−1]`。

| i | 0 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| rowSize[i] | 3 | 2 | 1 | 0 | 1 | 1 |
| rowStart[i] | 0 | 0+3=3 | 3+2=5 | 5+1=6 | 6+0=6 | 6+1=7 |

第 3 row 沒有項，所以 rowStart[3] = rowStart[4] = 6。

> **陷阱** 是加前一列的 **rowSize**，不是加前一列的 rowStart。

### 第三步：一個迴圈直接放到位

```cpp
SparseMatrix SparseMatrix::FastTranspose() {     // 這裡 this 是 b，結果是 a
    SparseMatrix a(cols, rows, terms);
    if (terms > 0) {
        int *rowSize = new int[cols];
        int *rowStart = new int[cols];
        for (int i = 0; i < cols; i++) rowSize[i] = 0;
        for (int i = 0; i < terms; i++) rowSize[smArray[i].col]++;
        rowStart[0] = 0;
        for (int i = 1; i < cols; i++)
            rowStart[i] = rowStart[i-1] + rowSize[i-1];

        for (int i = 0; i < terms; i++) {        // 非零項只掃一次
            int j = rowStart[smArray[i].col];    // 這一項該放的位置
            a.smArray[j].row = smArray[i].col;   // column 變 row
            a.smArray[j].col = smArray[i].row;   // row 變 column
            a.smArray[j].value = smArray[i].value;
            rowStart[smArray[i].col]++;          // 這格被佔了，下一個往後放
        }
        delete [] rowSize;
        delete [] rowStart;
    }
    return a;
}
```

### 例題：fast transpose 完整 trace（B → A）

起始 rowStart = 0, 3, 5, 6, 6, 7。

| i | b[i] | col | j = rowStart[col] | 寫入 a[j] | rowStart 之後 |
|---|---|---|---|---|---|
| 0 | (0,0,15) | 0 | 0 | a[0] = (0,0,15) | 1 3 5 6 6 7 |
| 1 | (0,4,91) | 4 | 6 | a[6] = (4,0,91) | 1 3 5 6 7 7 |
| 2 | (1,1,11) | 1 | 3 | a[3] = (1,1,11) | 1 4 5 6 7 7 |
| 3 | (2,1,3) | 1 | 4 | a[4] = (1,2,3) | 1 5 5 6 7 7 |
| 4 | (2,5,28) | 5 | 7 | a[7] = (5,2,28) | 1 5 5 6 7 8 |
| 5 | (3,0,22) | 0 | 1 | a[1] = (0,3,22) | 2 5 5 6 7 8 |
| 6 | (3,2,−6) | 2 | 5 | a[5] = (2,3,−6) | 2 5 6 6 7 8 |
| 7 | (5,0,−15) | 0 | 2 | a[2] = (0,5,−15) | 3 5 6 6 7 8 |

結果 a[0..7] = (0,0,15)、(0,3,22)、(0,5,−15)、(1,1,11)、(1,2,3)、(2,3,−6)、(4,0,91)、(5,2,28)，正好是原本的 A，而且已照 row、column 排好，完全不用搬移。

問：最後那行 `rowStart[b[i].col]++` 為什麼要加 1？
答：rowStart 記的是轉置後每個 row「下一個空位」。column 0 的有 b[0]、b[5]、b[7] 三個，都要擠進新的第 0 row，也就是 a[0]～a[2]。b[0] 放進 a[0] 後 rowStart[0] 變 1；掃到 b[5] 時就放 a[1]；b[7] 放 a[2]。沒加 1 的話，三筆都塞進同一格，互相蓋掉。

> **陷阱** rowSize 在迴圈中不會變，rowStart 會一直變。程式結束後 rowStart 已不是原本的起點，要再用就得重算。

**複雜度**：算 rowSize、rowStart 是 O(cols + terms)，放置迴圈是 O(terms)，總共 **O(cols + terms)**。最糟（不 sparse，terms = rows · cols）時是 O(rows · cols)，跟二維陣列一樣，不會更慢。

> **觀念** 看不懂這種程式，就把它打進去，開 debug mode 一行一行 trace、watch 變數的值。抓住重點（rowSize、rowStart、只要一個 for 迴圈），再自己 trace 一次。

| 方法 | 時間 | 不 sparse 時 |
|---|---|---|
| 二維陣列直接轉 | O(rows · cols) | O(rows · cols) |
| Simple transpose | O(cols · terms) | O(rows · cols²) |
| Fast transpose | O(cols + terms) | O(rows · cols) |

## 矩陣相乘（自讀）

A 是 m × n、B 是 n × p，相乘的結果 R（Result）是 m × p：

```
R[i][j] = Σ (k = 0 .. n−1) a[i][k] · b[k][j]
```

R 的第 i 列第 j 行，就是 A 第 i 列跟 B 第 j 行對應相乘再加總，用一個 for k 從 0 到 n−1 累加；R 的每一格都這樣算。

```c
for (i = 0; i < m; i++)
    for (j = 0; j < p; j++) {
        r[i][j] = 0;
        for (k = 0; k < n; k++)
            r[i][j] += a[i][k] * b[k][j];
    }
```

共 m · p 格、每格 n 次乘法，所以是 **O(m · n · p)**。

### 補充：二維陣列在記憶體裡的位置

Array 是一塊連續記憶體。一維陣列起始位址是 α，a[1] 在 α + 1，依此類推（以 element 為單位）。二維陣列 a[u1][u2]（u1 個 row、u2 個 column）有兩種存法：

- **Row major**：先存一整個 row，再接下一個 row。第 i 個 row 前面已經有 i · u2 個 element，所以 `a[i][j]` 的位址是 `α + i·u2 + j`。
- **Column major**：先存 column 0、再存 column 1、column 2……，`a[i][j]` 的位址是 `α + j·u1 + i`。

可以推廣到 n 維陣列 a[i1][i2]…[in]，起始位址套類似公式。兩種存法會影響每個 element 的 memory address。

## 字串與 pattern matching

最後一個應用是**字串（string）**。在 C 裡 `"hello world"` 就是一個 char array：第 0 格放 h、第 1 格放 e……最後有一個結束符號 `'\0'`。

英文以單字為單位，中間有空白；中文像「我今天去台北車站」沒有空白，看不出哪幾個字是一個詞，得靠斷字斷詞，這屬於資訊檢索（Information Retrieval, IR）的範圍。

字串常做的運算：比較、串接、copy（`strcpy`）、insert、print，以及 **string matching（字串比對）**：

> **重點** 給兩個字串：T 是原文（像一個檔案），P 是 pattern（像搜尋引擎裡打的 query）。問 P 有沒有出現在 T 裡：有就回報起始位置，沒有就回報 −1。例：T = ABABABCCA、P = ABABC，答案是 index 2。

### 暴力比對：O(mn)

P 從頭跟 T 一個一個比，一樣就往下比；不一樣就把 P shift 一格再從頭比。

```
index : 0 1 2 3 4 5 6 7 8
T     : A B A B A B C C A
try 1 : A B A B C            T[4] = A ≠ C，失敗
try 2 :   A                  T[1] = B ≠ A，後面不用比
try 3 :     A B A B C        全對：出現在 index 2
```

> **觀念** shift 到底是誰在移？P 根本沒動，是用一個變數記著「從 T 的哪個位置開始比」；shift 是透過改變 T 的比對起始位置達成的。

P 長 m、T 長 n，最差要 **O(m · n)**，複雜度蠻高。

## KMP 演算法

**KMP** 是三位發明者名字的縮寫（Knuth、Morris、Pratt）。核心問題：比對失敗時，為什麼一次只能 shift 一格？能不能一次 shift 好幾格？

- 第一種情況：P 在第 4 個字不 match，而中間那些起點根本不可能對上，KMP 直接拿 T 的第 4 個跟 P 的第 1 個比（一次 shift 3 格）。
- 第二種情況：前 6 個都一樣，第 7 個不同；但失敗點前面那個字 A 比過、是相同的，而 P 的開頭也是 A。那就把 P 開頭的 A 對齊 T 的那個 A，這格不用再比，下一個直接比 T 的第 7 個和 P 的第 2 個。
- 第三種情況：第 8 個不同，失敗點前面兩個字 AG 跟 P 開頭的 AG 一樣，就把兩段 AG 對齊，從 P 的第 3 個接著比。

再看一個例子，P = AGCTTAGC，第三種情況：

```
pos : 1 2 3 4 5 6 7 8 9 ...
T   : A G C T T A G x . ...
P   : A G C T T A G C            P[8] = C ≠ x
P'  :           A G C T T A G C  P 開頭的 AG 對齊 T[6..7]
```

失敗點前面的 AG（T 的第 6、7 個）等於 P 開頭的 AG，這兩個不用再比，直接拿 P 的第 3 個 C 跟 T 的第 8 個比。

> **重點** KMP 的精神：充分利用之前比對過的資訊。**比過而且相同的那塊不用再比，直接從那塊的下一個開始**；T 的指標也不用往回走。

KMP 分兩個 phase：

1. **Phase 1**：pattern 自己跟自己比，造出 **fail function（fail array）**，記錄比對失敗時能怎麼快速移動。
2. **Phase 2**：根據 fail function 去 T 裡做字串比對。

### Fail function 的定義

fail array 長度跟 pattern 一樣。以下位置從 1 數：

> **重點** f(j) = 最大的 k，使得 P 從 j 往左看的 k 個字（p_{j−k+1} … p_j）等於 P 開頭的 k 個字（p₁ … p_k），而且 k < j；找不到就是 0。

兩段可以 overlap（重疊），只要 k < j 就可以。f 完全由 pattern 自己產生，跟 T 無關，可以事先算好。

問：為什麼 phase 1 是 pattern 自己跟自己比，不是跟 T 比？
答：目的是先知道 pattern 裡有哪些重複的 substring（每個位置往前看多長會跟開頭一樣），比對失敗時才能直接跳到相同區塊的下一個位置。

### 例題：P = ababaca 的 fail function

| j | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| P[j] | a | b | a | b | a | c | a |
| f(j) | 0 | 0 | 1 | 2 | 3 | 0 | 1 |

逐格說明：

- j = 1（a）：前面沒東西可比（k 必須 < 1），f = 0。
- j = 2（b）：往前看 1 個是 b，開頭是 a，不同，f = 0。
- j = 3（a）：往前 1 個 a = 開頭 a；往前 2 個 ba ≠ 開頭 ab，f = 1。
- j = 4（b）：往前 2 個 ab = 開頭 ab；往前 3 個 bab ≠ aba，f = 2。
- j = 5（a）：往前 3 個 aba = 開頭 aba（第 3 個 a 被兩段共用，overlap 沒關係）；往前 4 個 baba ≠ abab，f = 3。
- j = 6（c）：開頭沒有任何一段以 c 結尾，f = 0。
- j = 7（a）：往前 1 個 a = 開頭 a；往前 2 個 ca ≠ ab，f = 1。

所以 fail function 是 **0 0 1 2 3 0 1**。

> **陷阱** 版本不同：這裡位置從 1 數、沒有相同區塊時記 0。另一種常見寫法從 0 數、沒有時記 −1，ababaca 會是 **−1 −1 0 1 2 −1 0**（每個值都少 1）。考試要看題目用哪一種。

### 比對規則

> **重點** T 的第 i 個跟 P 的第 j 個不一樣時，看前一個位置 j − 1 的 fail：那段長 f(j−1) 的相同區塊不用再比，下一次拿 **P[f(j−1)+1]** 跟 T 的第 i 個比，i 不動。若 j = 1（第一個字就不同），沒有東西可利用，i 往後一格、仍從 P[1] 比。相同時 i、j 都往後一格；j 超過 m 就是找到了。

### 例題：KMP 完整比對 T = bacbabababacaab、P = ababaca

Phase 1 已算好 f = 0 0 1 2 3 0 1。

```
i:  1 2 3 4 5 6 7 8 9 10 11 12 13 14 15
T:  b a c b a b a b a b  a  c  a  a  b
```

| 步 | i | j | T[i] | P[j] | 結果 | 下一步 |
|---|---|---|---|---|---|---|
| 1 | 1 | 1 | b | a | 不同，j = 1 | i = 2，j = 1 |
| 2 | 2 | 1 | a | a | 相同 | i = 3，j = 2 |
| 3 | 3 | 2 | c | b | 不同 | j = f(1) + 1 = 0 + 1 = 1，i 不動 |
| 4 | 3 | 1 | c | a | 不同，j = 1 | i = 4，j = 1 |
| 5 | 4 | 1 | b | a | 不同，j = 1 | i = 5，j = 1 |
| 6～10 | 5～9 | 1～5 | a b a b a | a b a b a | 連續 5 個相同 | i = 10，j = 6 |
| 11 | 10 | 6 | b | c | 不同 | j = f(5) + 1 = 3 + 1 = 4，i 不動 |
| 12～15 | 10～13 | 4～7 | b a c a | b a c a | 全部相同 | j 超過 7：找到 |

步 11 是 KMP 省力的地方：前面比對成功的 ababa 中，結尾的 aba 等於 P 開頭的 aba（f(5) = 3），所以 P 的前三個不用再比，直接拿 P 的第 4 個 b 跟 T 的第 10 個比，T 也不用往回走。對齊情形：

```
i   :  1  2  3  4  5  6  7  8  9 10 11 12 13
T   :  b  a  c  b  a  b  a  b  a  b  a  c  a
P#1 :              a  b  a  b  a  c              T[10] = b ≠ c
P#2 :                    a  b  a  b  a  c  a     P 前 3 個（aba）不必重比
```

P#1 是步 6～11 的對齊（P 從 T 的第 5 個開始）；P#2 是步 12～15（P 從 T 的第 7 個開始，從 P[4] 接著比）。

比對成功的結尾是 T 的第 13 個，起始位置 = 13 − 7 + 1 = **7**：pattern 出現在 T 的第 7 個位置。前面幾次失敗（步 1、3～5）都沒有可利用的相同區塊，只能移一格；有相同區塊時才看得出 KMP 的厲害。

### 複雜度

> **重點** KMP 總共 **O(m + n)**：m 花在 phase 1 算 pattern 的 fail function，n 花在 phase 2 跟 T 比對。比暴力法最差的 O(m · n) 快很多。

兩個最重要的觀念：fail function 怎麼算；比對失敗時從 P[f(j−1)+1] 接著比。

## Array 單元總結

- Array 本身很簡單，就是 index 對 value，重點在應用。
- 多項式：可以一個多項式一個 array，也能多個多項式共用一個 array；表示法不同，空間和 complexity 就不同，這就是 data structure 的學問。
- Sparse matrix：只存非 0 的 `<row, col, value>` triple，並在上面做 transpose（simple 與 fast）。
- 字串：用 array 存字串，做 string matching（暴力法與 KMP）。

## 補充：C++ template

進入後面的資料結構之前，先認識 template：把某些資料型態寫成「待定」的型態，方法本身不管換成 int 或 float 都適用。

```cpp
template <class KeyType>
void sort(KeyType *a, int n) {
    // 簡單的排序，裡面沒寫死是 int 還是 float
}

float farray[100];
int intarray[200];
sort(farray, 100);     // KeyType 在這裡決定為 float
sort(intarray, 200);   // KeyType 在這裡決定為 int
```

`KeyType` 是什麼型態，要等真正使用（宣告、呼叫）時才決定。之後幾個章節的資料型態都用 KeyType 這個 template 參數代表。

## 為什麼需要 linked list：array 的兩個缺點

### 缺點一：大小固定
array 是 **fixed size**：建立時就要給大小，之後不能加大，也不能縮小。

- 宣告 `int A[10]` 就只有 10 格。執行時來了第 11 個元素，放不下；只來 2、3 個，剩下 7 格白白浪費。
- 改開 100 格也一樣：超過 100 個還是放不下，元素少的時候浪費更多。
- 問題的核心：元素有幾個，要到 **runtime** 使用者輸入才知道；array 的大小卻在 coding／**compile time** 就得決定。
- 資料量變化大（有時 10 筆、有時 10000 筆）時，怕不夠只好開大，浪費就多。

array 可以建在 stack 上（例如 `int A[5]` 放在 `main` 的 activation record 裡），也可以用指標 `p` 在 heap 配 5 格。不管放哪，格子都是 **contiguous**（一格挨一格），所以能用 index 0～4 做 **random access**：起點加上 3 × 每格大小，就是第 3 格。

> **比喻** array 像一張 5 人座的長椅，做好時容量就定了。人多於 5 個坐不下，少於 5 個，位子就空著浪費。

### 缺點二：插入、刪除要搬資料（data movement）
stack、queue 背後若用 array 實作，同樣有這兩個問題。用排好序的單字 BAT、CAT、EAT、FAT、HAT 存在 array 裡，要把 GAT 插在 FAT 後面，得先把 HAT 往後搬一格：

```
插入前： [BAT][CAT][EAT][FAT][HAT][   ]
HAT 後移：[BAT][CAT][EAT][FAT][   ][HAT]
放入 GAT：[BAT][CAT][EAT][FAT][GAT][HAT]
```

array 只要做插入、刪除，搬資料幾乎跑不掉。

> **陷阱** 「資料不搬會誤判已滿」說的是**線性 queue 的假溢位**：rear 走到底，前面卻還有空位。stack 只在 top 一端操作，不會有這個問題。

### 再看一個例子：用 ordered array 存多項式
多項式依次方由小到大存成 (次方, 係數) 的 pair，例如 f(x) 裡有 (2, −4)、(5, 10) 等項。

- **f(x) + 6x³**：要把 (3, 6) 擠進 (2, −4) 和 (5, 10) 中間，後面的全部往後擠（插隊，cut in）。
- **f(x) − 4x⁻²**：次方最小，要插在最前面，所有項都得往後搬，非常不 flexible。
- **f(x) − 10x⁵**：那一項變成 0 要拿掉，後面的往前補位。
- **resizing**：例如 f(x)·(x + 1)，項數變多就可能不夠大；而且要一整塊連續記憶體，不一定拿得到。

如果根本用不到 binary search 這類 ordered array 的好處，花這些代價維持排序就不見得值得。

**大小固定 + 要搬資料**，就是 linked list 登場的理由。

## linked list 的想法：小紙條 next 與 head

### 每一項旁邊多一張「下一項在哪」的紙條
把 array 的 index 看成記憶體位址，假設 5 項放在 1001～1005。每一項旁邊多記一張小紙條，寫「下一項在哪」：

```
位址   內容      next
1001  (0, 5)    1002
1002  (…)       1003
1003  (2, −4)   1004
1004  (5, 10)   1005
1005  (…)       NULL
```

現在要加 (3, 6)：不必擠進去，放在記憶體別處，例如 1126。只改兩張紙條：

1. (3, 6) 的紙條寫 1004（原本 1003 的下一項）。
2. (2, −4) 的紙條從 1004 改成 1126。

```
head=1001 → 1001 → 1002 → 1003 (2,−4) → 1126 (3,6) → 1004 (5,10) → 1005 → NULL
```

其他資料一筆都不用搬。

> **比喻** array 規定大家擠在一起排好；linked list 是「坐哪都行，只要留下聯絡方式、不要失聯」。

- 代價：每個「抽屜」要大一點，原本放兩個數字，現在多一張小紙條。有幾項就多幾張紙條的空間。
- 記下一項在哪的紙條叫 **next**（或 link）；一開始告訴你從哪裡進去的那張叫 **head**（或 first）。
- 資料 + 小紙條 = **node（節點）**。
- 整個 linked list 在做的事，就是**維持這些小紙條的正確性**。

> **比喻** 像大地遊戲：照紙條一關一關跑，只要每關寫的下一關位置沒寫錯，就一定跑得到終點。也像小朋友把橡皮筋一個個串起來。

### 自己帶椅子：node 串成一串
我們要的是 **variable size**：使用者一直加、一直刪，結構就跟著變大變小。做法兩步：

1. runtime 需要多少，就跟 **heap** 要多少。
2. 用 link 把這些分散的空間串起來。

先準備一個指標 `first`。存 8 時，配一塊空間放 8，順便多配一個「指向下一個」的指標；後面沒東西就填 NULL。再存 3、12，各建一個 node，讓前一個指向它：

```
first → [8|•] → [3|•] → [12|NULL]
```

> **比喻** 這不是長椅，是一塊空地：誰要來坐就自己帶椅子，前一個人牽著他；要走就把椅子帶走。

### 正式定義與記憶體位址
**linked list 是 node 的集合，每個 node 有 data，以及指向下一個 node 的指標。**

```
first（自己的位址 100，內容 200）
   │
   ▼
 200: [ 8 | 210 ] → 210: [ 3 | 270 ] → 270: [ … | 300 ] → 300: [ … | NULL ]
```

- `first` 也常叫 **head**，指向第一個 node（head node），裡面存 200；`first` 自己也是變數，有自己的位址 100。
- 位址是隨便取的（真實的通常是幾千），重點是 node **不連續**：200、210、270、300。array 的位址一定連續：200、202、204…
- linked list 的順序靠 **link** 維持：每個 node 記住下一個的位址，一個接一個找下去。
- 還要一個指標 `first` 指向頭，不然程式不知道從哪開始。

課本的例子是依字母排序的三字母單字：

```
first → [BAT|•] → [CAT|•] → [EAT|•] → [FAT|•] → [HAT|NULL]
```

每個 node 左邊 data 放三個字元，右邊 link 存下一個 node 的位址；最後的 HAT，link 是 NULL。

> **重點** linked list 到處是 pointer。最好的辦法是**把 pointer 之間的關係畫成圖**，寫 code 時才不會漏掉某個 pointer assignment。

## 在 C/C++ 定義與建立 node

### self-referential structure
node 要兩樣東西：data（int、float、double 或任何型別），以及指向下一個 node 的指標——這個指標的型別就是 node 自己。

```c
struct Node {
    int data;
    struct Node *next;
};
```

structure 裡有指向自己型別的指標，叫 **self-referential structure（自我參考結構）**，linked list 就靠它。C++ 也能用 `struct` 或 `class`，差別在 class 的成員預設 **private**，struct 預設 **public**。

大小：假設 int 2 bytes、pointer 2 bytes，一個 node 佔 4 bytes（例如 200～203）；指標只記第一個 byte 的位址，所以這個 node 的位址就是 200。

> **陷阱** int 與 pointer 的大小依系統而定，兩者不一定相同；現代 64-bit 系統常見 int 4 bytes、pointer 8 bytes。「都是 2 bytes」只是方便計算的假設。

### malloc、new 與箭頭運算子
node 要在執行時動態建在 heap，而 heap 只能透過指標存取，所以先宣告指標：

```c
struct Node *p;
p = (struct Node *)malloc(sizeof(struct Node));   /* C */
```

```cpp
p = new Node;                                      // C++
```

- 大小不要自己算 4，寫 `sizeof(struct Node)`，換台電腦也不會錯。
- `malloc` 回傳 `void *`。C 會自動轉型，可以不寫 `(struct Node *)`；C++ 一定要轉。C++ 直接用 `new` 最簡單。
- 假設新 node 在 500，`p` 就存 500，`p` 指向這個 node。

`p` 是指向 structure 的指標，取成員用箭頭 `->`：

```c
p->data = 10;   /* 10 放進 data */
p->next = 0;    /* 0 就是 NULL：後面沒有 node */
```

```
p=500 → 500: [ 10 | NULL ]
```

### 三行最常見的指標敘述
設 `p` 指向位址 200 的 node（200 的 next 是 210），另有指標 `q`：

| 敘述 | 效果 | 結果 |
|---|---|---|
| `q = p;` | 把 p 裡的 200 抄進 q | p、q 指向同一個 node（200） |
| `q = p->next;` | p 那個 node 的 next 是 210 | q 指向 p 的下一個（210） |
| `p = p->next;` | 把 210 存回 p | p 往下走一格 |

`p = p->next;` 是**走訪（traverse）** linked list 最常用的一行：從頭一路走到尾靠的就是它。

### NULL 的三種寫法
讓 p 不指向任何東西：`p = 0;` 或 `p = NULL;`，兩者完全一樣。C/C++ 裡 0 是 false、非 0 是 true；p 沒指向 node 時值是 0，有指向時是非 0 的有效位址。讀別人的程式時三種寫法都要認得：

| 意思 | 寫法一 | 寫法二 | 寫法三 |
|---|---|---|---|
| p 是 NULL | `if (p == NULL)` | `if (p == 0)` | `if (!p)` |
| p 有指向 node | `if (p != NULL)` | `if (p != 0)` | `if (p)` |

### 誰是最後一個 node
要知道 p 是不是最後一個 node，看的不是 p，是 `p->next`：

- `if (p->next == NULL)` 成立：p 後面沒東西，p 是最後一個。
- `if (p->next != NULL)` 成立：p 後面還有 node（這類條件很常用）。

> **陷阱** `p == NULL` 是「p 沒指向任何 node」；`p->next == NULL` 是「p 是最後一個 node」。

### x = y 與 *x = *y
兩個指標：x 指向 data 為 a 的 node，y 指向 data 為 b 的 node，兩個 node 各有自己的 link。

```
執行前：
x → [a | •] → (a 的下一個 N1)
y → [b | •] → (b 的下一個 N2)

x = y 之後：抄的是位址
x ─┐
y ─┴→ [b | •] → N2        （a 那個 node 沒人指了）

*x = *y 之後：抄的是 node 的所有欄位
x → [b | •] → N2
y → [b | •] → N2
```

- `x = y`：把 y 所指 node 的位址抄給 x，x、y 指到同一個 node b。
- `*x = *y`：把 y 所指 node 的**所有欄位**抄進 x 所指的 node。data 的 b 被抄過去，**link 也一起被抄**，兩個 node 的 link 指向同一個 node；但 x、y 本身仍指著兩塊不同的記憶體。

> **陷阱** `*x = *y` 是「y 的內容複製到 x 所指的 node」，不是 `*y = *x`。而且不只複製 data，連 link 也覆蓋了，這點常被忽略。

## 改 link 就能插入、刪除

### 先看概念
list 是 `first → 8 → 3 → 12 → NULL`。

**刪除 3**：讓 8 不再指 3，改指 12，只改一個 link。3 被跳過，從 first 走永遠碰不到它，等於刪掉，記憶體也能還回去。

```
刪除前：first → 8 → 3 → 12 → NULL
刪除後：first → 8 ──────→ 12 → NULL      （3 已被跳過）
```

**在 3 和 12 中間插 7**：建一個 node 放 7，**先讓 7 指 12，再讓 3 改指 7**。

```
步驟 1：7 → 12            first → 8 → 3 → 12 → NULL
                                        7 ↗
步驟 2：3 → 7             first → 8 → 3 → 7 → 12 → NULL
```

插入、刪除都只改 link，不用像 array 把後面一個個搬。

> **陷阱** 插入時先設新 node 的 next（7→12），再改前一個 node（3→7）。順序反了，3 原本記的 12 被蓋掉，後半串就丟了。

linked list 通常建在 heap，因為長度會變。但 node 也可以是區域變數或靜態陣列的元素（例如用陣列模擬 linked list），只是那樣大小就固定了；需要動態長度時才用 heap。

### 例題：插入 GAT（看圖說故事）
把 GAT 插在 FAT 後面、HAT 前面。

```
插入前：first → BAT → CAT → EAT → FAT → HAT → NULL
```

1. 先 create 一個新 node 存放 GAT。
2. 關鍵問題：「GAT 要指到 HAT」這個資訊在誰手上？在 **FAT 原本的 link** 裡。所以第一行 `GAT.link = FAT.link`，抄一份給 GAT：

```
first → BAT → CAT → EAT → FAT → HAT → NULL
                                 GAT ↗
```

3. 第二行把 FAT 的 link 改成 GAT 的位址：`FAT.link = &GAT`。原本 FAT→HAT 的實線就消失了：

```
插入後：first → BAT → CAT → EAT → FAT → GAT → HAT → NULL
```

兩個 assignment 搞定，別的 node 一個都沒動。

> **重點** 寫 linked list 的口訣：**先畫出結果圖，再寫讓 pointer 符合那張圖的 assignment**（看圖說故事）。考試、寫程式都一樣。

### 另一種寫法：insertAfter
每格放內容，紙條寫下一格的位址；`head` 是特別的紙條，告訴你從 1001 開始。insert after 1003 這個 node：

```c
newNode = make_node(data);          /* 放在 1126 */
newNode->next = node->next;         /* 新 node 的紙條抄 node 原本的 1004 */
node->next = newNode;               /* node 改指 1126 */
```

```
之前：1003 → 1004
之後：1003 → 1126 → 1004
```

> **陷阱** 兩行順序不能反。先做 `node->next = newNode`，1004 就找不到了。

箭頭只有一個方向、一個接一個，這種叫 **singly linked list（單向鏈結串列）**。

### 插在最前面：head 是特別的紙條
node 不必放在一起，插入就不用搬別人；每筆資料很肥大時，差別特別明顯。（另一個選擇：還是用 ordered array，但只存小紙條（指標），資料放別處，要搬時只搬紙條。）

把 (−2, −4) 插到多項式最前面，也是換兩張紙條：

```c
newNode->next = head;   /* 新 node 指向原本第一個 */
head = newNode;         /* head 改指新 node */
```

```
之前：head → 1001 (0,5) → …
之後：head → 新 node (−2,−4) → 1001 (0,5) → …
```

差別是 head 不在任何 node 裡，換的紙條不一樣，常得另寫一個 routine（insertHead）。

> **陷阱** 只寫 insertAfter、沒寫 insertHead，就無法把次方很低的項放到多項式最前面。linked list 難寫，常常就難在這類**邊界情形**。

### 例題：刪除 GAT
把 GAT 刪掉，刪完後 FAT 要直接連到 HAT。誰現在指著 HAT？GAT 的 link。所以一行：

```
FAT.link = GAT.link;
```

```
刪除前：first → BAT → CAT → EAT → FAT → GAT → HAT → NULL
刪除後：first → BAT → CAT → EAT → FAT ──────→ HAT → NULL
```

linked list 的組成：data、link，以及特別重要的指標 first。拿掉的 GAT 不再使用時要 `delete`／`free`（或放進 free list，見後面），否則就是 **memory leak**。

### 刪除前要先搜尋
真要用程式刪 GAT，得先找到它。人一眼就看到，程式沒有眼睛，只有 `first`。所以從 first 開始，每到一個 node 就比對 data 是不是 GAT，不是就沿 link 往下走：

```
BAT(1) → CAT(2) → EAT(3) → FAT(4) → GAT(5) 找到
```

走到第五個才找到，這就是線性搜尋；找到之後才做刪除的 assignment。

> **觀念** 兩種結構的循序搜尋都是 O(n)。array 快一點只是因為記憶體連續、不用追 pointer（常數較小）；若 array 已排序還能 binary search O(log n)。但找到之後，array 刪除要把後面往前搬，O(n)；linked list 只改前一個 node 的 link，O(1)。

### random access 與 sequential access
- array 是 **random access**：給 index 幾乎馬上拿到。
- linked list 是 **sequential access**：要從 head 照紙條走（例如走三步）才拿得到內容，像大地遊戲一關關跑。
- 要排好順序的話，**ordered linked list** 跟 ordered array 一樣麻煩，麻煩都來自「要排好」。
- 不管順序的話很多操作都很 trivial：要 5 個元素就做 5 個 node 串起來；找到 node 後更新內容也簡單。node 本身就是一個記憶體位址，像一個特別長的 index。

### pointer 出錯的風險
- EAT 該指 FAT，一不小心指到 HAT，從 first 走就跳過 FAT、GAT，再也找不到。
- 某個 link 斷了，存的位址一不見，後面的 node 全部 missing。

每個資料結構都有優點，也有缺點；看起來很直覺的 linked list 也一樣。

## C++ 實作 linked list

### 宣告方式一：node 與 list 兩個 class

```cpp
class ThreeLetterList;          // 先宣告

class ThreeLetterNode {
friend class ThreeLetterList;   // 讓 list 讀得到 private 成員
private:
    char data[3];
    ThreeLetterNode *link;
};

class ThreeLetterList {
public:
    // 各種 list operations
private:
    ThreeLetterNode *first;     // 只要一個指向頭端的指標
};
```

list 只維持一個指向頭端的指標，其餘透過 node 的 link 串起來。

### 宣告方式二：nested class

```cpp
class ThreeLetterList {
public:
    // 各種 list operations
private:
    class ThreeLetterNode {     // node 的 class 定義在 list 的 private 裡
    public:
        char data[3];
        ThreeLetterNode *link;
    };
    ThreeLetterNode *first;
};
```

| | node class 寫在外面 | nested class |
|---|---|---|
| 可見性 | 其他 class 都能共用 node | 外面看不到 node |
| 代價 | 要多寫一行 `friend class` | 要第二條同樣 node 的 list，得把 node 定義再 copy 一份嵌進去 |

### 以下範例共用的 ListNode 與 List

```cpp
class List;

class ListNode {
friend class List;
private:
    int data;
    ListNode *link;
public:
    ListNode(int element = 0) { data = element; link = 0; }  // constructor：link 設 0（NULL）
};

class List {
public:
    void Create2();
    void Insert50(ListNode *x);
    void Delete(ListNode *x, ListNode *trail);
private:
    ListNode *first;
};
```

### 例題：Create2 做出兩個 node
目標：`first → 10 → 20 → NULL`。

```cpp
void List::Create2()
{
    first = new ListNode(10);          // 跟系統要一塊記憶體；data = 10、link = 0
    first->link = new ListNode(20);    // 新 node 的位址直接存進 10 的 link
}
```

```
第一行後：first → [10|NULL]
第二行後：first → [10|•] → [20|NULL]
```

`new` 回傳的位址存進 first；link = 0 就把它想成 NULL。兩行就完成。

### 例題：Insert50 插在 x 後面
把 50 插在 node x 後面。x 是 10，原本 10、20，插完要變成 10、50、20。

```cpp
void List::Insert50(ListNode *x)
{
    ListNode *t = new ListNode(50);   // 先做 50 的 node，用 t 指著
    if (!first) {                     // list 是空的：沒有誰的後面
        first = t;                    // 50 直接當第一個
        return;
    }
    t->link = x->link;                // ① 先接後面：50 也指向 20
    x->link = t;                      // ② 再接前面：10 改指 50
}
```

```
開始：  first → 10 → 20 → NULL        t → 50
① 後：  first → 10 → 20 → NULL
                   50 ↗
② 後：  first → 10 → 50 → 20 → NULL
```

> **陷阱** 兩行不能顛倒。先做 `x->link = t`，20 的位址就被蓋掉，再也沒人記得它在哪；接著 `t->link = x->link` 還會讓 t 指向自己。口訣：**先接後面，再接前面**，並且一定要把圖畫出來。

### 例題：刪掉第一個 node
list 是 10、50、20，`ptr`（也叫 first、head）指向頭。刪掉 10 後，指標一定要改指第二個 node，而第二個的位址就在 `ptr->link`：

```cpp
ptr = ptr->link;
```

```
刪除前：ptr → 10 → 50 → 20 → NULL
刪除後：ptr ───────→ 50 → 20 → NULL    （10 可 delete）
```

> **觀念** 很多人覺得怪：自己的欄位怎麼能 assign 給自己？關鍵是 `ptr` 只是指標變數，不是那個 node；`ptr->link` 也是指標，這只是把一個位址抄進另一個指標變數。

### 例題：刪掉中間的 node
刪中間的 50：x 指向 50，**trail 指向前一個 10**，因為要改的是前一個 node 的 link。50 的 link 存著 20 的位址，交給前一個：

```cpp
void List::Delete(ListNode *x, ListNode *trail)
{
    if (x == first) first = first->link;   // 刪第一個
    else trail->link = x->link;            // 刪中間：前一個跳過 x
    delete x;
}
```

```
刪除前：first → 10 → 50 → 20 → NULL
              trail   x
刪除後：first → 10 ──────→ 20 → NULL
```

> **陷阱** singly linked list 刪除一定要知道**前一個 node**（trail），否則得從 first 走過去找。

### 刪掉的 node 去哪裡
pointer 改完，50 離開了 list，它佔的記憶體一定要處理，二選一：

1. **直接 delete／free**，還給系統（對 memory 斤斤計較就這樣做）。
2. **收進另一條 free list**，以後要 new 時直接從那裡拿一個，再做 data assignment，省掉向系統要記憶體（system call）的 overhead，效率可能較好（後面 free pool 一節細講）。

> **陷阱** 這不是「可做可不做」：兩種都不做就是 memory leak。

### 另一種寫法：removeAfter 與 free
`removeAfter(node)`：node 的紙條寫 1126，1126 的紙條寫 1234，要移掉 1126。把 node 的紙條換成 1234 就跳過了（`node.next = node.next.next`）。但直接換掉就再也找不到 1126、沒辦法還給系統，所以先用 tmp 存起來：

```c
tmp = node->next;          /* tmp = 1126 */
node->next = tmp->next;    /* node 改指 1234 */
free(tmp);                 /* 還給系統 */
```

```
之前：node → 1126 → 1234
之後：node ───────→ 1234      （1126 被 free）
```

跟插入一樣，head 和不是 head 的情形可能要分開寫。

### dummy head：不想分開寫 head 的技巧
最前面放一個**不存資料**的 node（dummy head），用它的 next 偷偷存 head：

```
dummy[ 空 | •] → 第一個 → 第二個 → … → NULL
```

- 插到最前面 = `insertAfter(dummy)`；刪第一個 = `removeAfter(dummy)`，同一份 code，不用寫、維護兩份。
- 代價：多一個 node，node 很大就多佔一塊。這是**用空間換 coding 的方便**，值不值得自己判斷。

> **觀念** 想清楚「用什麼換什麼」：singly linked list 也是用每個 node 多放的 next，換來記憶體操作的彈性。

## Doubly linked list（雙向鏈結串列）

### 為什麼需要 prev
singly 只能 **remove after**，因為改的是 node 自己身上的紙條。想直接 **remove here**（刪掉眼前的 node2）呢？node2 自己 free 掉容易，要改的卻是**前一個 node 的紙條**。

> **比喻** 大地遊戲有一關下雨撤掉，卻沒通知前一關；前一關還叫隊員去那裡，就撲空了。

node2 不知道前一個是誰，只能從 head 一路 next、next 找，list 很長就很花力氣。如果刪除很常用，就讓每個 node 放兩張紙條：**next** 記下一關、**prev** 記前一關。這樣也能從 **tail** 順著 prev 走回來，等於兩條方向相反的 list，這就是 **doubly linked list**。再加一個指標 last 指向尾巴，要找的東西在後面時就能從兩頭找。

### remove here：把位址寫出來
搞不清楚就把位址寫出來：

```
         prev   data   next
1111:   [ …  |  A  | 2345 ]
2345:   [1111|  B  | 5566 ]
5566:   [2345|  C  |  …   ]
```

移掉 2345：

1. 5566 的 prev 改接 1111。前一個是誰？看 `node->prev` 就知道，不用從頭找。
2. 1111 的 next 改接 5566。
3. 兩張都改好，再 free 掉中間的 2345。

```c
node->next->prev = node->prev;   /* 5566.prev = 1111 */
node->prev->next = node->next;   /* 1111.next = 5566 */
free(node);
```

```
之後：1111 ⇄ 5566
```

指向前後鄰居的資訊會跟中間 node 一起消失，所以要先把這兩張紙條改好再 free。

- 代價：每個 node 多一張紙條、多幾行 code，比 singly 慢一點。
- 換到：看到哪個 node 就能直接刪；插入也能直接插在某個 node 前面。

### llink、rlink 與 header node
另一種常見寫法：node 左邊 **llink** 指左鄰、右邊 **rlink** 指右鄰，並加一個不存資料的 **header node**，做成環狀。

```
         ┌──────────────────────────────────────┐
         ▼                                      │
 header ⇄ A ⇄ B ⇄ C ⇄（回到 header）
 header.rlink = A（往右那條 list 的第一個）
 header.llink = C（往左那條 list 的第一個）
```

- 沿 rlink 從 header 一路往右串：header → A → B → C → header。
- 中間的 node：llink 指前一個、rlink 指後一個。
- **empty list**：只剩 header，它的 llink、rlink 都指向自己。
- **只有一個 node A**：header 左右都指 A，A 左右也都指回 header，一樣是環狀。

```
empty：     header.llink = header.rlink = header
一個 node： header.rlink = A, header.llink = A, A.llink = header, A.rlink = header
```

```cpp
class DblList;

class DblListNode {
friend class DblList;
private:
    int data;
    DblListNode *llink, *rlink;
};

class DblList {
public:
    void Insert(DblListNode *p, DblListNode *x);   // 把 p 插在 x 右邊
    void Delete(DblListNode *x);
private:
    DblListNode *first;    // 指向 header node
};
```

### 例題：把 p 插在 x 後面
x 右邊的 node（叫它「藍」）就是 `x->rlink`；p 要插在 x 和藍中間。結果是 x、p、藍三個雙向相連，牽涉**四個 link**，要四個 pointer assignment：

```cpp
void DblList::Insert(DblListNode *p, DblListNode *x)
{
    p->llink = x;              // ① p 的左邊指 x
    p->rlink = x->rlink;       // ② p 的右邊指藍
    x->rlink->llink = p;       // ③ 藍的左邊改指 p（藍就在 x->rlink，指標可以串著寫）
    x->rlink = p;              // ④ x 的右邊改指 p
}
```

```
開始： x ⇄ 藍                 p（孤立）
①②後：x ⇄ 藍，且 x ← p → 藍
③ 後： x → 藍，p ⇄ 藍，p.llink = x
④ 後： x ⇄ p ⇄ 藍
```

> **陷阱** ① ② 可以對調；但 ② ③ 都要用「舊的」`x->rlink`，必須排在 ④ 之前。若先做 ④，`x->rlink` 已經是 p，② 變成 `p->rlink = p`、③ 變成 `p->llink = p`，右邊那段就斷了。

### 練習：插在 x 後面第 k 個
能不能寫一個 insert，把 p 插在 x 後面的第 k 個位置？例如 k = 2 時，p 不是緊接在 x 後面，中間還隔一個 node。這種變化題也可能考。一種寫法：沿 rlink 走 k−1 步到 q，再用那四行把 p 插在 q 後面；走到 header 就表示 list 不夠長。

```cpp
void DblList::InsertK(DblListNode *p, DblListNode *x, int k)
{
    DblListNode *q = x;
    for (int i = 1; i < k; i++) {
        q = q->rlink;
        if (q == first) throw "list 不夠長";   // 繞回 header
    }
    Insert(p, q);    // p 插在 q 後面，就是 x 後面第 k 個
}
```

```
k = 2： x ⇄ N1 ⇄ N2   →   q 走 1 步到 N1   →   x ⇄ N1 ⇄ p ⇄ N2
```

### 例題：刪除 x
原本是「紅 ⇄ x ⇄ 綠」，刪完紅和綠要互相指到對方：

```cpp
void DblList::Delete(DblListNode *x)
{
    if (x == first) throw "不能刪除 header node";
    x->llink->rlink = x->rlink;   // 紅（x->llink）的 rlink 改指綠
    x->rlink->llink = x->llink;   // 綠（x->rlink）的 llink 改指紅
    delete x;
}
```

```
刪除前：紅 ⇄ x ⇄ 綠
刪除後：紅 ⇄ 綠          （x 被 delete）
```

就是把 x 手上的兩個位址交給鄰居，再 delete x，不用像 singly 去找前一個。

### doubly 的好處與搜尋
- 好處：可以雙向走訪（往回走）；只拿到某個 node 的指標，就能 **O(1)** 刪掉它，不必找前一個。
- 一個方向的 pointer 不小心斷了，還有另一個方向的 link 可以參考。

> **陷阱** 「link 斷了可以從另一個方向救回來」不是 doubly 的主要理由：指標真的壞掉時，兩個方向往往也對不上。課本講的理由是**能雙向走訪**、**拿到 x 就能 O(1) 刪除**。

> **例題** 在 doubly list 上找 7。沒有其他條件就跟 singly 一樣一個個看。list 由大排到小為 15、12、10、7、…、3 時，從左邊要看 15、12、10、7 共 4 次；若 insert 時就維持排序，7 比較接近最小的 3，就從右邊找，3 次就到。依數字大小決定從哪一頭找比較快。

### 應用：檔案的 disk block
檔案存在 disk 上，disk 最小的組成單位是 **block**。像 101.txt，前段、中段、後段放在不同 block，開檔、搜尋文字時就用 doubly linked list 把這些 block 串起來：

```
header ⇄ [block：前段] ⇄ [block：中段] ⇄ [block：後段]
```

singly 也行，但停電或磁頭壞掉弄壞一個 pointer，就找不到下一個 block，後面全部 missing；多一組 link 比較不容易掉 node。資料結構是資料庫的基礎：list 的 item 不只是數字，也可以是字串、disk block。

## 走訪與 iterator

### 走訪：從 head 到結尾
不管 singly 還是 doubly，最典型的用法是**走訪**：從 head 開始，還沒到結尾就往 next 走。結尾在 C 常用 NULL 表示（但不是唯一方式）。

```c
for (p = head; p != NULL; p = p->next)
    visit(p->data);
```

doubly 還能從 tail 順著 prev 走回來；array 則是 index 從 0 開始，index++ 一格格拜訪。像 sequential search 這種要把資料看一遍的演算法，array 用 index、list 用 next，code 就不一樣。再抽象一層就是 **iterator**，只定義三件事：**開頭 begin、結尾 end、下一個 ++**。這樣不同結構的走訪都一樣，sequential search（含找到就停的版本）就能直接搬到 linked list 上。這也是 C++ STL 對「走訪整個資料結構」的抽象化。

### ListIterator：寫一次到處用
scan list、看有幾個 node、判斷目前是否 NULL（NotNull）、下一個是否 NULL（NextNotNull）、回傳第一個（First）、回傳下一個（Next）——不管哪種 list 都會用到。這些操作不應綁死在某個 list class 裡，否則 List A 寫一次、List B 又寫一次。把它們抽出來成為 class **ListIterator**，配 template 的 List：

```cpp
template <class Type> class List;
template <class Type> class ListIterator;

template <class Type>
class ListNode {
friend class List<Type>;
friend class ListIterator<Type>;     // iterator 要讀 node 的 private 欄位
private:
    Type data;
    ListNode *link;
public:
    ListNode(Type element) { data = element; link = 0; }
};

template <class Type>
class List {
friend class ListIterator<Type>;     // iterator 要讀 first
public:
    List() { first = last = 0; }
    void Attach(Type k);
    void Concatenate(List<Type>& b);
    void Invert();
    ~List();
private:
    ListNode<Type> *first, *last;
};

template <class Type>
class ListIterator {
public:
    ListIterator(const List<Type>& l) : list(l), current(l.first) {}  // 從第一個 element 開始
    bool NotNull()     { return current != 0; }
    bool NextNotNull() { return current != 0 && current->link != 0; }
    Type* First() {                       // 回傳第一個元素
        if (list.first) return &list.first->data;
        return 0;
    }
    Type* Next() {                        // current 往後移一格，回傳該元素
        if (current) {
            current = current->link;
            if (current) return &current->data;
        }
        return 0;
    }
private:
    const List<Type>& list;               // 要處理的那條 list
    ListNode<Type>* current;              // 目前處理到的 node
};
```

list `10 → 50 → 20`：`First()` 回傳 10；`Next()` 讓 current 從 10 移到 50，回傳 50。

用 ListIterator 寫加總，完全不碰 node 的細節：

```cpp
int sum(const List<int>& l)
{
    ListIterator<int> li(l);
    if (!li.NotNull()) return 0;          // 空 list
    int retvalue = *li.First();
    while (li.NextNotNull())
        retvalue += *li.Next();
    return retvalue;
}
```

以後不管宣告什麼 type 的 list，ListIterator 只要寫一次。

### Attach：接到尾巴
把新 node 接到 list 尾巴。如果 list 只知道 first，不知道尾巴在哪，就只好從頭 scan：link 不是 0 就往下走，走到 link 是 0 的那個就是尾端，跟 node 數成正比，**O(n)**：

```cpp
// 只有 first 的版本：O(n)
ListNode<Type> *newnode = new ListNode<Type>(k);
if (first == 0) first = newnode;
else {
    ListNode<Type> *p = first;
    while (p->link != 0) p = p->link;    // 走到尾巴
    p->link = newnode;
}
```

課本另外維護 `last` 指標，一步 **O(1)**：

```cpp
template <class Type>
void List<Type>::Attach(Type k)
{
    ListNode<Type> *newnode = new ListNode<Type>(k);
    if (first == 0) first = last = newnode;   // 空 list：新 node 就是第一個
    else {
        last->link = newnode;
        last = newnode;
    }
}
```

```
Attach(10)：first=last → 10
Attach(50)：first → 10 → 50 ← last
Attach(20)：first → 10 → 50 → 20 ← last
```

### list 家族：positional access
把 singly、doubly 的共同功能叫 **list**，重點是 **positional access（依位置存取）**，也叫 sequential／iterative access：像排隊，看你排在第幾個；**vector** 則是 **indexed（random）access**，用編號。

> **比喻** vector 說的是一號櫃子、二號櫃子；list 說的是排第一個的人、排第二個的人。

list 要提供的功能：

- insert 到某個 position p（以前叫 insert after）。
- 透過 position p 拿 element；在 linked list 裡，p 就是 node 的指標。
- 走完整條：begin（head）、end（是否等於 NULL）、next（順著 next 紙條）。
- remove：singly 要先找前一個，doubly 不用，兩者實作難度差很多。

dense array 也能加入 list 家族：功能都有，只是 insert、remove 要推擠別人比較慢。它的 position 不是紙條而是**位址**，而且連續，不像 linked list 東一個西一個。5 個 int 的 array 從 1000 開始：

| 操作 | dense array | linked list |
|---|---|---|
| begin | 1000（`arr[0]` 的位址） | head |
| end | 1000 + 5×4 = 1020（`arr[5]`，那格不存在） | 走到 NULL |
| next | 位址 + 4（往前一個元素的大小） | 順著 p 的 next |

### iterator：把位置 p 抽象化
iterator 就是在 list 裡把 position p 抽象化。走訪要四樣：begin、end、next，加上取 element。於是只寫一個迴圈：

```
for (p = c.begin(); p != c.end(); p = next(p))
    sum += get(p);
```

不管底下是 singly、doubly 還是 dense array，同一段 code 都能把元素加起來（例如 2、3、5 加起來都是 10）。p 扮演的角色就叫 **iterator**。

> **陷阱** 這裡不該寫 `p++`：抽象的層次只知道有 next 這個動作。C++ 是再用 operator overloading 讓 `p++` 代表 next。

### C++ STL 的 iterator
STL 的 `list` 是 **doubly linked list**；`vector` 是 array（連續記憶體，不用每格多放紙條）。

```cpp
#include <list>
#include <vector>

std::list<int> c = {2, 3, 5};
int sum = 0;
for (std::list<int>::iterator p = c.begin(); p != c.end(); ++p)
    sum += *p;            // 第一輪 *p 拿到 2；最後 sum = 10
```

- 想換 vector：只把型別改成 `std::vector<int>`（iterator 型別跟著改），其他什麼都不用動，一份 code 抽換資料結構。
- `++p`／`p++` 是 operator overloading 換掉的函式「走到下一個」，**不是位址加一**。
- `*p` 是被 overload 的 dereference：取得那個 position 上的 element。在 linked list 裡拿到的是 node 裡的內容（例如 9），不是整個 node。
- iterator 可以想成**更安全、複雜一點的 pointer**（高階指標），從 position 解碼出你要的東西。支援 list 功能的 container 都有對應的 iterator；還可以用 `advance` 一次跳好幾個。
- STL 的 vector、list 不是繼承 iterator；iterator 是各容器的輔助角色。

STL list 的操作對照：

| 概念 | STL list |
|---|---|
| get head | `begin()`，拿到 iterator（對應某個 node 的位址） |
| get next | `++it` |
| get | `*it`（iterator 指的 node 裡的資料，例如 20） |
| insert here | `insert(it, x)`：插在 iterator **前面** |
| remove here | `erase(it)` |
| insert to head | `push_front(x)` |
| remove from head | `pop_front()` |

insert here、remove here 都靠 doubly 才容易。除了考試（研究所、入職考試），自己寫 linked list 的機會不高；但大家會假設你懂每個指令背後發生什麼，這是基本功。

### 問答：iterator 到底是什麼
問：iterator 到底是什麼？
答：array 跑 index、list 跑 next，兩套背後都是指標。array 是位址往上加：1001、1002、1003；list 是到櫃子裡拿下一張紙條：從 1003 跳到 1126。iterator 把兩者合起來：每種結構寫清楚什麼叫開頭、結尾、下一個，同一段 code 就能通用。可以把它想成高階指標，或小紙條的抽象化：array 的紙條是計數器，list 的紙條是一張張換的便條。往前走用 `++`，在不同結構意思不同；doubly 還能用 `--` 往回走；前面加 `*` 就取出資料。STL 把 list、array 這類叫容器，iterator 讓你輕鬆切換容器。

問：iterator 一定是位址嗎？
答：不一定，array 也能用 index 實作；只是取值前要先從 index 算出位址，再 dereference。

問：判斷 end，dense array 要多配一格嗎？
答：不用。走到 1020（最後一格之後）就代表跨出家門口，那格沒配置，位置還是能拿來比較。

> **陷阱** `end()` 是 past-the-end 位置，只能拿來比較，**不能 dereference**。

問：每輪都呼叫 `end()` 不會比較慢嗎？
答：會多一點時間，這是用一點 constant overhead 換 programming 的彈性；而且現代 compiler 看到 `c.end()` 這種簡單 function，會直接 inline 展開。

### list 還是 vector
問：能不能把 linked list 當成更有彈性的 array 來用？
答：可以，但多半是殺雞用牛刀。只需要 array 的功能就用 array（vector）。

- list 最大的特性是**不能 random access**：vector 的 `v[2]` 一步到，list 得從頭走過去。
- 反過來，`pop_front`、`push_front` 在 list 只改幾個指標；vector 卻要把全部往前補或往後搬。
- singly 還是 doubly 很 **application dependent**：空間很緊的小型系統，或不想花兩倍時間更新紙條的即時系統，可能選 singly。

## Sparse vector（稀疏向量）

### 只存不是 0 的項
7 維向量 `0, 3.5, 0, 0, 7, 4.2, 9`，最自然的存法是長度 7 的 array（跟 C++ 的 vector 同名不是巧合）。但 0 乘任何數都是 0、加 0 不變，很多運算裡這些 0 是白算。乾脆不存 0，只記「第幾維、值多少」：

```
dense ：[0, 3.5, 0, 0, 7, 4.2, 9]
sparse：(2, 3.5) (5, 7) (6, 4.2) (7, 9)       維度從 1 數
```

寫法跟多項式一模一樣。這種表示叫 **sparse vector**。

| 表示法 | 成本 |
|---|---|
| dense | 維度數（number of dimensions） |
| sparse | 非零個數 × 每個 pair 的大小 |

> **例題** 上例 4 個 pair 共 8 個數，反而比 dense 的 7 個還多。再看 `0, 0, 6, 0, 4, 0, 0`：sparse 是 (3, 6)、(5, 4)，少存 5 個 0、卻多存 2 個 index，沒省多少。但 1000 維只有 10 個非零時，20 個數字就取代了 1000 個數字，非常划算。

> **重點** 向量非常稀疏時，sparse 表示在儲存上才划算。一般化：一長串資料裡很多是同一個不需要的值（例如 0），就適合用 sparse 表示。

### 用在哪
- 最高 1000 次、只有 3 項的多項式：dense 要開 1001 格，sparse 只要 3 個 pair。
- 科學、工程計算的矩陣與向量常常有很多 0。
- **推薦系統**：網站有十萬首歌，你只替十首打分數，剩下 99,990 個 0 不必存。這些 (歌 ID, 分數) 可以排在 pair 的 array 裡；如果常常新增、刪除，改用 linked list 只要改指標。
- 機器學習裡上千維的向量到處都是：一張 1024 × 768 的圖拉成一條就是 786,432 維。又大又 sparse 的也很常見：線上廣告資料記的是「在哪個網站被點」這種離散選項，模型吃不了網站名稱，就用 **one-hot encoding**：列出所有選項，一萬個網站就一萬維，是哪個就在那維填 1，其他全是 0。

### 多項式就是 sparse vector：ordered linked list
6x³ 是「3 次方係數是 6」，跟「向量第 3 維是 6」是同一回事；沒寫出來的次方係數就是 0。所以用 linked list 表示多項式，其實就是在表示 sparse vector，而且一樣能很有彈性地插入、刪除。

```
dense ：0 0 6 0 4 0 0
linked：H → (3, 6) → (5, 4) → NULL
```

這裡維度照一般描述向量的習慣從 1 數。更精確地說，它是 **ordered linked list**：節點依維度事先由小到大排好，後面的相加就靠這個順序。

> **陷阱** 課本的多項式串列通常依指數「由大到小」排；這裡依維度由小到大。方向不是重點，重點是**要有排序**，合併演算法才成立。

### 例題：兩個 sparse vector 相加
V1 = 6x³ + 4x⁵，V2 = 2x + 9x⁴ − 4x⁵，兩條各有自己的開頭 H1、H2：

```
H1 → (3, 6) → (5, 4) → NULL
H2 → (1, 2) → (4, 9) → (5, −4) → NULL
```

先想答案：依維度排，先 V2 的 (1, 2)，再 V1 的 (3, 6)，再 V2 的 (4, 9)；第 5 維 4 + (−4) = 0，0 不存，所以 (4, 9) 是尾巴：

```
result → (1, 2) → (3, 6) → (4, 9) → NULL      即 2x + 6x³ + 9x⁴
```

### Merge 演算法：running cursors
兩條都是 singly linked list，只能從頭走。用兩個**游標（cursor）**：c1 從 H1 出發、c2 從 H2 出發。每次比較 c1 和 c2 的 order（第幾維），只有三種情形：

1. c1 比較小：把 c1 那項串到 result 最後面，c1 前進。
2. c1 比較大：把 c2 那項串到 result 最後面，c2 前進。
3. 一樣大：相加後串到最後面（**和是 0 就不插入**），兩邊都前進。

比較小的先串到 result 最後面，result 才會由小到大。概念上寫 `c1++`，真正的程式是 `c1 = c1->next`；借用 `++` 是因為 C++ STL 的 iterator 就是把 `++` overload 成「走到下一個」。

核心那一步不難想，難的是用迴圈包起來：c1、c2 **都還沒走到尾**，才有兩個東西可以比；迴圈停下時可能有一條還沒走完，最後要把剩下那段整個接上去。

```cpp
struct SNode {
    int dim;          // 第幾維
    double val;       // 值
    SNode *next;
};

SNode* append(SNode *tail, int d, double v)    // 串到 result 最後面，回傳新的尾巴
{
    SNode *n = new SNode;
    n->dim = d; n->val = v; n->next = NULL;
    tail->next = n;
    return n;
}

SNode* add(SNode *h1, SNode *h2)
{
    SNode dummy;  dummy.next = NULL;            // dummy head，省得特別處理空的 result
    SNode *tail = &dummy;
    SNode *c1 = h1, *c2 = h2;
    while (c1 != NULL && c2 != NULL) {
        if (c1->dim < c2->dim) {
            tail = append(tail, c1->dim, c1->val);  c1 = c1->next;
        } else if (c1->dim > c2->dim) {
            tail = append(tail, c2->dim, c2->val);  c2 = c2->next;
        } else {
            double s = c1->val + c2->val;
            if (s != 0) tail = append(tail, c1->dim, s);   // 和為 0 不插入
            c1 = c1->next;  c2 = c2->next;
        }
    }
    for (; c1 != NULL; c1 = c1->next) tail = append(tail, c1->dim, c1->val);  // 剩下的接上
    for (; c2 != NULL; c2 = c2->next) tail = append(tail, c2->dim, c2->val);
    return dummy.next;
}
```

逐步追蹤：

| 輪 | c1 | c2 | 比較 | 動作 | result |
|---|---|---|---|---|---|
| 1 | (3,6) | (1,2) | 3 > 1 | 串 (1,2)，c2 前進 | (1,2) |
| 2 | (3,6) | (4,9) | 3 < 4 | 串 (3,6)，c1 前進 | (1,2)→(3,6) |
| 3 | (5,4) | (4,9) | 5 > 4 | 串 (4,9)，c2 前進 | (1,2)→(3,6)→(4,9) |
| 4 | (5,4) | (5,−4) | 相等 | 4 + (−4) = 0 不串，兩邊前進 | 不變 |
| 結束 | NULL | NULL | | 沒有剩餘 | (1,2)→(3,6)→(4,9) |

兩個游標像在輪流前進，這種演算法叫 **running cursors**。每個節點只看一次，長度 m、n 的兩條合併是 **O(m + n)**。

> **陷阱** 一樣大且和為 0 時（如第 5 維 4 + (−4)）不能插入，否則 result 會留下值為 0 的節點，失去 sparse 的意義。

問：回傳一條新的 linked list，不會很浪費記憶體嗎？
答：上面是概念上的演算法。真正的 merge 可以直接把 node 從原串列移到 result，不必重新 copy 一份。

### 內積：同一個架構
內積是同一維相乘再加總。架構完全不變，只改 if 裡做的事：維度不同代表一邊是 0，乘了也是 0，只讓小的那邊前進；維度相同才相乘、累加。

```cpp
double dot(SNode *h1, SNode *h2)
{
    double sum = 0;
    SNode *c1 = h1, *c2 = h2;
    while (c1 != NULL && c2 != NULL) {
        if (c1->dim < c2->dim)      c1 = c1->next;    // 只前進，不乘
        else if (c1->dim > c2->dim) c2 = c2->next;
        else {
            sum += c1->val * c2->val;
            c1 = c1->next;  c2 = c2->next;
        }
    }
    return sum;
}
```

> **例題** V1 · V2：c1=3、c2=1 → c2 前進；3 < 4 → c1 前進；5 > 4 → c2 前進；5 = 5 → sum += 4 × (−4) = −16，兩邊前進結束。只有第 5 維對上，內積 = −16。

真實例子：廣泛使用的開源機器學習軟體 **LibSVM**，內積程式就是這個演算法（index 相同就把 value 相乘加起來，index 小的往前走），這段計算是它效率的核心。不過 LibSVM 把 (index, value) 排在 array 裡，而不是用 linked list，因為 linked list 在記憶體上不連續。

## 面試裡的 linked list

### 缺點與基本功
- linked list 其實不是特別好用：節點東佔一塊、西佔一塊，散在記憶體各處。現代電腦有 **cache**，array 連在一起很吃香；linked list 卻像「東市買駿馬，西市買鞍韉」，到處跑，使用記憶體的效率不好。
- 概念簡單，要寫成完全沒 bug 卻蠻難。實務上要嘛為極致效能自己刻，要嘛用 STL，要嘛乾脆不用。
- 但它非常適合考程式設計師的**基本功**。

> **比喻** 考五星級主廚不考煎牛排，考煎荷包蛋：三分鐘就看得出很多功力。

面試的 linked list 題通常看兩件事：**基本功**（如 reversal）和**把巧思用對地方**（如找中間項）。

### Reversal：把每個箭頭反過來
- doubly 版太簡單：交換 head、tail，再把每個節點的 prev、next 對調。
- 所以通常考 **singly**。它 tricky 在常常太早或太晚改某個 link，串列就斷了。實務上幾乎找不到一定要做 reversal 的理由（signal processing 的 convolution 也有更好的做法），就是考基本功。

難處是改箭頭時還要拿得到「還沒改的下一串」。用 prev、cur、next 三個指標：先存 `next = cur->next`，再改 `cur->next = prev`；然後 `prev = cur`、`cur = next` 往前走。

```cpp
Node* reverse(Node *head)
{
    Node *prev = NULL, *cur = head;
    while (cur != NULL) {
        Node *next = cur->next;   // 先存原本的下一個
        cur->next = prev;         // 箭頭反過來
        prev = cur;               // 往前走
        cur = next;
    }
    return prev;                  // 新的 head
}
```

```
開始：    head → 1 → 2 → 3 → 4 → 5 → NULL         prev=NULL, cur=1
第 1 輪： NULL ← 1    2 → 3 → 4 → 5 → NULL        prev=1, cur=2
第 2 輪： NULL ← 1 ← 2    3 → 4 → 5 → NULL        prev=2, cur=3
第 3 輪： NULL ← 1 ← 2 ← 3    4 → 5 → NULL        prev=3, cur=4
第 4 輪： NULL ← 1 ← 2 ← 3 ← 4    5 → NULL        prev=4, cur=5
第 5 輪： NULL ← 1 ← 2 ← 3 ← 4 ← 5                prev=5, cur=NULL
結束：head = prev = 5：  5 → 4 → 3 → 2 → 1 → NULL
```

> **陷阱** 不先存 next 的話，1 的箭頭一改成 NULL，2 和後面整串就再也找不到了。

### 另一種寫法：Invert 用 p、q、r
把 `first → a → b → c → d → 0` 的每個 link 轉 180 度，變成 `first → d → c → b → a → 0`。三個指標排隊走：p 是先鋒，q 跟著 p，r 跟著 q。一開始 `p = first`、`q = 0`，因為 a 會變成尾巴、要指向 0。

```cpp
template <class Type>
void List<Type>::Invert()
{
    ListNode<Type> *p = first, *q = 0;
    while (p) {
        ListNode<Type> *r = q;   // r 跟著 q
        q = p;                   // q 跟著 p
        p = p->link;             // p 先往前走
        q->link = r;             // q 那個 node 指回前一個
    }
    first = q;                   // 千萬不能忘
}
```

| 輪 | r | q | p（走完後） | 改的 link | 已反轉部分 |
|---|---|---|---|---|---|
| 1 | 0 | a | b | a → 0 | a → 0 |
| 2 | a | b | c | b → a | b → a → 0 |
| 3 | b | c | d | c → b | c → b → a → 0 |
| 4 | c | d | 0 | d → c | d → c → b → a → 0 |
| 跳出 | | q = d | p = 0 | first = q | first → d → c → b → a → 0 |

p 變成 0 就跳出，這時 q 停在原本的 d，所以最後 `first = q` 不能忘。對照 reversal：r 就是 prev、q 是 cur、p 是 next，同一個概念。考試可能把 code 挖空要你填。

> **陷阱** 順序不能亂：若在 `p = p->link` 之前先做 `q->link = r`，p 就跟著 q 的新 link 走回前一個 node，後半段遺失。看不懂程式時，把每一輪（第一個 run、第二個 run…）的圖畫出來。

### 反轉的其他做法
- 最笨的做法：new 一條新 list，從 first 依序讀，每讀一個就插在新 list 的**最前面**。讀完就是 d → c → b → a。
- 用 stack：全部 push 再 pop，順序就反了。
- 代價：要多花記憶體產生新 node。p、q、r 版本是 **in-place**：O(n) 時間、O(1) 額外空間。

### 白板寫程式的能力
很多人太依賴電腦：寫完就 compile、丟測資、開 debugger，改兩行再試。可是面試白板上沒有 compiler，要靠腦中清楚的邏輯。建議從現在就練：作業先在紙上寫出 code 或 pseudo code，想清楚了再上機。reversal 才十行左右，面試官想看你是想清楚才下筆，還是先打二十行、祈禱它對。

測試自己的程式：把程式切成小塊，各自用測試資料確認行為；想清楚哪些是一般情形、哪些是邊界情形，並確認邊界也跑得對。

### Cycle detection：龜兔賽跑
正常的 linked list 從 head 走會走到 NULL；但某次更新 link 沒寫對，例如 6 指回 3，就繞成一圈走不完（錯誤的 linked list）。怎麼判斷有沒有 cycle？

- 硬算：從每個節點出發試試繞不繞得回來，或記下走過的節點。會 work，但不巧妙。
- 巧妙的做法：**龜兔賽跑（tortoise and hare）**。兩個指標都從 head 出發，兔子一輪走兩步，烏龜一輪走一步。有 cycle 的話兔子先進圈繞，最後從後面追上烏龜；沒有 cycle，兔子會先走到 NULL。

```cpp
bool hasCycle(Node *head)
{
    Node *slow = head, *fast = head;           // 烏龜、兔子
    while (fast != NULL && fast->next != NULL) {
        slow = slow->next;                     // 走一步
        fast = fast->next->next;               // 走兩步
        if (slow == fast) return true;         // 追上了：有 cycle
    }
    return false;                              // 兔子走到尾：沒有 cycle
}
```

> **例題** list 為 `1 → 2 → 3 → 4 → 5 → 6`，6 指回 3。

```
           ┌───────────────┐
           ▼               │
 1 → 2 → 3 → 4 → 5 → 6 ────┘

輪   烏龜   兔子
0     1      1
1     2      3
2     3      5
3     4      3   （5 → 6 → 3）
4     5      5   追上 → 有 cycle
```

這跟 merge 一樣是兩個游標的演算法：兔子走的是「兩步算一格」的虛擬 linked list。

### 找中間項：龜兔賽跑的變化
5 項的 list，中間是第 3 項。

- **two-pass**：先掃一次數出 5 項，再從頭走到第 3 項，大約 n + n/2 步。
- **one-pass**：龜兔賽跑。兔子走 1、3、5 到尾巴時，烏龜走 1、2、3，剛好停在中間。

```cpp
Node* middle(Node *head)          // head 不是 NULL
{
    Node *slow = head, *fast = head;
    while (fast->next != NULL && fast->next->next != NULL) {
        slow = slow->next;
        fast = fast->next->next;
    }
    return slow;
}
```

```
1 → 2 → 3 → 4 → 5 → NULL
開始： 烏龜 1  兔子 1
第 1 輪：烏龜 2  兔子 3
第 2 輪：烏龜 3  兔子 5（兔子到尾，停）→ 中間是 3
```

要找 1/3、3/4 處，就調整兩個游標的速度比，是 two cursor algorithm 的變形。

問：one-pass 和 two-pass 實際移動的總步數不是一樣嗎？
答：沒錯，差在少一個迴圈、寫法比較漂亮。

> **陷阱** 「中間」的定義要先問清楚：5 項從 0 數是 0、1、2、3、4，中間是第 2 項。面試時要先跟主考官把問題講清楚，再寫 pseudo code。

## 其他 list 操作

### Concatenate：把兩條串起來
把 A、B 串成一條：A 的尾巴原本指向 0，改指向 `b.first`。所以得先找到 A 的尾巴：

```cpp
template <class Type>
void List<Type>::Concatenate(List<Type>& b)
{
    if (!first) { first = b.first; return; }   // 防呆：A 是空的
    if (b.first) {
        ListNode<Type> *p;
        for (p = first; p->link; p = p->link);  // 迴圈本體是空的：走到尾巴
        p->link = b.first;
    }
}
```

```
A：first → a1 → a2 → a3 → 0        B：b.first → b1 → b2 → 0
for 跳出時 p = a3（p->link 是 0）
p->link = b.first 之後：first → a1 → a2 → a3 → b1 → b2 → 0
```

### List destructor
list 不要了，destructor 要把每個 node 都 delete，把記憶體還回去。每一輪先記住下一個，再刪自己，然後往下走：

```cpp
template <class Type>
List<Type>::~List()
{
    ListNode<Type> *next;
    for (; first; first = next) {   // first 不是 0 就繼續
        next = first->link;         // 先記住下一個
        delete first;               // 刪掉自己
    }
}
```

```
first → 10 → 50 → 20 → 0
第 1 輪：next = 50，delete 10，first = 50
第 2 輪：next = 20，delete 50，first = 20
第 3 輪：next = 0， delete 20，first = 0 → 結束，list 清空
```

> **陷阱** 一定要先記 next；先 delete 就找不到下一個了。

### Circular linked list（環狀鏈結串列）
最後一個 node 不指向 NULL，而是**指回頭**。除了 first，最後一個 node 也有指標叫 **last**。

```
first → a → b → c ─┐
        ▲          │
        └──────────┘      last = c
```

尾巴的 link 永遠不是 NULL，不能再用「是不是 NULL」找尾巴；判斷尾巴要看 last，或檢查 link 等不等於 first：

```cpp
ListNode *p = first;
if (p) {
    do {
        visit(p->data);
        p = p->link;
    } while (p != first);    // 繞回 first 就結束
}
```

> **重點** 很多課本的 circular list 只保留 last：first 就是 `last->link`，在頭或尾插入都是 O(1)。

```cpp
// 只有 last 的環狀 list：插在最前面
void InsertFront(ListNode *x)
{
    if (!last) { last = x; x->link = x; }    // 空 list：自己指自己
    else { x->link = last->link; last->link = x; }
}
// 插在最後面：先插在最前面，再把 last 移到 x
void InsertRear(ListNode *x)
{
    InsertFront(x);
    last = x;
}
```

### 用 linked list 實作 stack 與 queue
stack 和 queue 不是只能用 array 做。它們是規定「怎麼放、怎麼拿」的資料結構，可以用 array，也可以用 linked list 實作，別把它們跟 array 畫上等號（細節後面再教）。

- **stack**：top 就是 list 的 first，push、pop 都在頭端。
- **queue**：從尾巴 rear 加入、從頭 front 拿出。

```cpp
// linked stack：top 等於 first
void Push(int e) { ListNode *t = new ListNode(e); t->link = top; top = t; }
int  Pop()       { ListNode *t = top; int e = t->data; top = top->link; delete t; return e; }

// linked queue：rear 加入、front 刪除
void Add(int e) {
    ListNode *t = new ListNode(e);
    if (!front) front = rear = t;
    else { rear->link = t; rear = t; }
}
int Delete() { ListNode *t = front; int e = t->data; front = front->link; delete t; return e; }
```

（Pop、Delete 前要先檢查 list 不是空的。）

> **陷阱** linked queue 要從 front（頭）刪除、從 rear（尾）加入。反過來從尾端刪，singly linked list 找不到尾巴的前一個 node，會變成 O(n)。

## 用 linked list 表示多項式

### 一項一個 node
`a = 3x¹⁴ + 2x⁸ + 1`，每個 node 有係數 coef、指數 exp 和 link：

```
a.first → [3 | 14 | •] → [2 | 8 | •] → [1 | 0 | 0]
```

最後一項 1 其實是 1·x⁰，是尾巴。`2x¹⁰⁰⁰ + 1` 只要兩個 node，不用開 1001 格的 array：linked list 解決了 sparse 的問題。

缺點：每個 node 多花一個 link 的空間；要找某一項只能從頭走，不能用索引直接取第 i 項。

### Term、Polynomial 與 operator+

```cpp
struct Term {               // list node 的 element 就是一個 Term
    int coef;               // 係數
    int exp;                // 指數
    Term Set(int c, int e) { coef = c; exp = e; return *this; }
};

class Polynomial {
friend Polynomial operator+(const Polynomial&, const Polynomial&);
private:
    List<Term> poly;        // 一條裝 Term 的 linked list
};
```

`friend Polynomial operator+` 是 **operator overloading**：宣告 `Polynomial a, b;` 之後寫 `a + b`，就會跑你定義的多項式加法。

### 例題：多項式加法
`a = 3x¹⁴ + 2x⁸ + 1`，`b = 8x¹⁴ − 3x¹⁰ + 10x⁶`，指數由大排到小。準則：p、q 指向兩邊第一項；**指數一樣就係數相加；不一樣就先 copy 指數大的那項，被 copy 的往下走**，直到 p、q 都到 0。比 array 版還簡單，而且跟 sparse vector 的 merge 是同一招。

```cpp
Polynomial operator+(const Polynomial& a, const Polynomial& b)
{
    ListIterator<Term> Aiter(a.poly), Biter(b.poly);
    Term *p = Aiter.First(), *q = Biter.First();
    Polynomial c;
    Term temp;
    while (p && q) {
        if (p->exp == q->exp) {
            int sum = p->coef + q->coef;
            if (sum) c.poly.Attach(temp.Set(sum, q->exp));
            p = Aiter.Next();  q = Biter.Next();
        }
        else if (p->exp < q->exp) {
            c.poly.Attach(temp.Set(q->coef, q->exp));
            q = Biter.Next();
        }
        else {
            c.poly.Attach(temp.Set(p->coef, p->exp));
            p = Aiter.Next();
        }
    }
    while (p) { c.poly.Attach(temp.Set(p->coef, p->exp)); p = Aiter.Next(); }  // a 剩下的
    while (q) { c.poly.Attach(temp.Set(q->coef, q->exp)); q = Biter.Next(); }  // b 剩下的
    return c;
}
```

| 步 | p | q | 比較 | 動作 | c |
|---|---|---|---|---|---|
| 1 | 3x¹⁴ | 8x¹⁴ | 14 = 14 | 3 + 8 = 11，new node；p、q 都走 | 11x¹⁴ |
| 2 | 2x⁸ | −3x¹⁰ | 8 < 10 | copy −3x¹⁰，q 走 | 11x¹⁴ − 3x¹⁰ |
| 3 | 2x⁸ | 10x⁶ | 8 > 6 | copy 2x⁸，p 走 | … + 2x⁸ |
| 4 | 1 | 10x⁶ | 0 < 6 | copy 10x⁶，q 走（q 到 0） | … + 10x⁶ |
| 5 | 1 | 0 | | 迴圈結束，接上 a 剩下的 1 | … + 1 |

```
c.first → [11|14] → [−3|10] → [2|8] → [10|6] → [1|0] → 0
c = 11x¹⁴ − 3x¹⁰ + 2x⁸ + 10x⁶ + 1
```

## Free pool：用完的 node 再利用

### 加完之後 a、b 的 node 怎麼辦
做 a + b = c 的過程中要隨時 new 出 c 的 node；做完後 a、b 不用了，它們的 6 個 node 可以 release。

- 一種做法：用 list destructor 把它們真的 delete 掉。
- 如果程式是專門做多項式加減乘除的 **service**，會有很多 user 一直建多項式、做運算。那不用的 node 先別還給系統，丟進資源回收場 **free pool**；新 user 要多項式時從回收場叫出 node，只要改掉係數和指數。好處是不浪費資源，也省下每次 new 都要跟系統要記憶體的 overhead（那很花時間）。

### GetNode：從 av 拿 node
回收場本身也是一條 linked list，指標 **av**（available list）指向它的第一個 node。

```cpp
ListNode* GetNode()
{
    ListNode *x;
    if (av) {             // 回收場有貨
        x = av;           // 拿走第一個
        av = av->link;    // av 往下一格
    }
    else x = new ListNode;   // 回收場沒貨，只好跟系統要
    return x;                // 之後再填係數和指數
}
```

```
之前：av → n1 → n2 → n3 → 0
GetNode 之後：x → n1（拿走）   av → n2 → n3 → 0
```

### RetNode：把 node 還回 av
node 不要了就 RetNode。注意是 **return 回回收場，不是 delete**：就是把 x 插到 av 這條 list 的最前面，一樣看圖說故事。

```cpp
void RetNode(ListNode*& x)
{
    x->link = av;   // 先：x 接上回收場原本的開頭
    av = x;         // 再：av 指向 x
    x = 0;
}
```

```
之前：av → n2 → n3 → 0        x → n1
x->link = av： x → n1 → n2 → n3 → 0
av = x：       av → n1 → n2 → n3 → 0
```

> **陷阱** 是 `av = x`，不是 `x = av`；而且要先 `x->link = av` 再改 av。

### 例題：環狀 list 一次歸還整個多項式（O(1)）
能不能一次還一整個多項式，而不是一個個 node？可以，前提是寫成環狀：最後一項指回頭，檢查 link 是否等於 `a.first` 就知道到尾。

```cpp
void CircList::ReturnAll()      // 環狀多項式整個還給 av
{
    if (first) {
        ListNode *second = first->link;   // ① 記住第二項
        first->link = av;                 // ② 頭接上回收場的開頭
        av = second;                      // ③ 回收場從第二項開始
        first = 0;                        // ④ a 清空
    }
}
```

```
開始：
  a.first → [3x¹⁴] → [2x⁸] → [1] ─┐        av → f1 → f2 → 0
               ▲                  │
               └──────────────────┘
① second = 2x⁸
② 3x¹⁴ 的 link 改成 av：
  [2x⁸] → [1] → [3x¹⁴] → f1 → f2 → 0
③ av = second：
  av → [2x⁸] → [1] → [3x¹⁴] → f1 → f2 → 0
④ a.first = 0
```

中間 node 的 link 一條都不用改，四個指定就搞定，跟有幾項無關，是 **O(1)**。這是充分利用環狀的關係。

### 不是環狀時怎麼歸還
- 先走到尾巴，把原本指向 0 的 link 改成 av，再 `av = a.first`。只動兩個指標，原本的 list 沒被破壞；但找尾巴要 **O(n)**。
- 最笨的做法：一個 node 一個 node 呼叫 RetNode 歸還，比較繁瑣但也能解決。

```
a.first → 3x¹⁴ → 2x⁸ → 1 → 0          av → f1 → f2 → 0
尾巴 1 的 link 改成 av：  3x¹⁴ → 2x⁸ → 1 → f1 → f2 → 0
av = a.first：         av → 3x¹⁴ → 2x⁸ → 1 → f1 → f2 → 0
```

### Header node
環狀的多項式還可以多放一個 **header node** 當頭，它不存真正的項。header 的指數放 **−1**：真正的指數不會是負的，看到 −1 就知道繞回頭了；最後一項指回 header。

```
header[ − | −1 ] → [3 | 14] → [2 | 8] → [1 | 0] ─┐
   ▲                                             │
   └─────────────────────────────────────────────┘

零多項式： header[ − | −1 ] ─┐
              ▲              │
              └──────────────┘   （自己指自己）
```

好處是零多項式只剩 header 自己指自己，不用特別處理空 list。用 linked list 實作的完整多項式加減法程式，課本都有。

## Equivalence relation 與 equivalence class

### 三個性質
一個 relation 要叫 **equivalence relation（等價關係）**，必須同時滿足三個性質：

- **Reflexive（自反）**：每個數字都跟自己有關係，x ≡ x。
- **Symmetric（對稱）**：x ≡ y，就一定有 y ≡ x。
- **Transitive（遞移）**：x ≡ y 且 y ≡ z，就推得出 x ≡ z。

這裡的「≡」是一種 relation，意思是「有關係」，**不是數值相等**：0 ≡ 4 不代表 0 等於 4。

輸入資料會省略可以推出來的部分：

- 0 ≡ 0 這種自己跟自己的 pair 太直覺，輸入裡不寫。
- 輸入 0 ≡ 4，因為 symmetric，其實也隱含了 4 ≡ 0。
- 輸入 0 ≡ 4 和 7 ≡ 4（也就是 4 ≡ 7），依 transitive 得到 0 ≡ 7。

### 問題：輸入 pair，輸出 equivalence class
課本例子：n = 12，數字 0～11，輸入 9 個 pair：

```
0≡4   3≡1   6≡10   8≡9   7≡4   6≡8   3≡5   2≡11   11≡0
```

輸出是若干個 set，每個 set 叫一個 **equivalence class（等價類）**，同一個 set 裡任兩個數字都能透過三個性質找到關係：

```
{0, 2, 4, 7, 11}    {1, 3, 5}    {6, 8, 9, 10}
```

例如 1、3、5：先讀到 3 ≡ 1，後來讀到 3 ≡ 5，靠 transitive 知道 1 ≡ 5，三個同一組。6 和 9 也一樣：6 ≡ 8、8 ≡ 9，所以 6 ≡ 9。每個數字只屬於一個 class，不會在兩個 set 重複出現。

> **陷阱** 考題可能把 symmetric 拿掉：若 x 和 y 有關不代表 y 和 x 有關，就不是 equivalence relation，不能用這套方法分 class。用詞上要分清楚：「不一定對稱」叫 not symmetric；**asymmetric** 是更強的條件，x R y 就一定沒有 y R x。

### 直覺做法為什麼麻煩
直覺是邊讀邊分群：讀到 0≡4 放一群；3≡1 跟前面無關，自己開一群；6≡10、8≡9 也各開一群；讀到 7≡4，4 已在 0 那群，把 7 加進去。麻煩在讀到 6≡8：6 和 8 在不同群，兩群得**合併**。

人腦這樣做沒問題，寫成程式卻一下新增、一下合併，很複雜。而且不能「讀一個 pair 就輸出一群」，因為後面的 pair 隨時可能讓兩群合併。

## 兩個 phase 的演算法

### 從 rough 到詳細
粗略版只有兩句：

1. **Phase 1**：讀完所有 pair，把數字兩兩之間的關係記下來。
2. **Phase 2**：根據 Phase 1 建好的結構，把每個 equivalence class 找出來印出。

只寫一句「process the pair」太 pseudo code，看了還是不知道怎麼處理。詳細一點的版本講明要兩個 data structure——一個 array，加上掛在 array 上的 linked list：

- **seq**：array，index 就代表那個數字，n 個數字開 n 格。seq[i] 存一個 pointer，指向一條 linked list，串著「跟 i 直接有關的數字」。
- **out**：boolean array，記錄每個數字在 Phase 2 印過沒；印過就設 true，之後不再輸出。

> **觀念** 寫程式的步驟：先想清楚方法（rough 演算法），再想怎麼變成 data structure（更明確的 pseudo code），最後才 implement。不要急著寫 code。

### Phase 1：每個 pair 兩邊都記
讀到 pair (i, j)：把 j 放進 seq[i] 的 list，也把 i 放進 seq[j] 的 list——因為 i ≡ j 代表兩者互相有關（symmetric），兩邊都要記。新 node 一律**插在 list 最前面**，每次插入 O(1)。

```cpp
class ListNode {
    friend void Equivalence();
private:
    int data;          // 數字
    ListNode *link;    // 下一個 node
    ListNode(int d) { data = d; link = 0; }
};

// 初始化
ListNode **seq = new ListNode*[n];   // ListNode pointer 的 array
bool *out = new bool[n];
for (int i = 0; i < n; i++) { seq[i] = 0; out[i] = false; }  // 0 表示還沒有 list

// Phase 1：讀 pair，建 list
while (讀得到 i, j) {
    ListNode *x = new ListNode(j);
    x->link = seq[i];  seq[i] = x;   // j 插在 seq[i] 最前面
    ListNode *y = new ListNode(i);
    y->link = seq[j];  seq[j] = y;   // i 插在 seq[j] 最前面
}
```

> **陷阱** 順序不能弄反：先 `x->link = seq[i]`（讓 x 接住原本的頭），再 `seq[i] = x`。反過來寫，舊的 list 就接不回來了。

逐步建 list（新 node 放最前面）：

| 讀到的 pair | 變動 |
|---|---|
| 0≡4 | seq[0]: 4　seq[4]: 0 |
| 3≡1 | seq[3]: 1　seq[1]: 3 |
| 6≡10 | seq[6]: 10　seq[10]: 6 |
| 8≡9 | seq[8]: 9　seq[9]: 8 |
| 7≡4 | seq[7]: 4　seq[4]: 7→0 |
| 6≡8 | seq[6]: 8→10　seq[8]: 6→9 |
| 3≡5 | seq[3]: 5→1　seq[5]: 3 |
| 2≡11 | seq[2]: 11　seq[11]: 2 |
| 11≡0 | seq[11]: 0→2　seq[0]: 11→4 |

Phase 1 結束後的結構：

```
seq[0]  → 11 → 4
seq[1]  → 3
seq[2]  → 11
seq[3]  → 5 → 1
seq[4]  → 7 → 0
seq[5]  → 3
seq[6]  → 8 → 10
seq[7]  → 4
seq[8]  → 6 → 9
seq[9]  → 8
seq[10] → 6
seq[11] → 0 → 2
```

seq[0] 是 11 → 4：11≡0 比 0≡4 晚讀到，所以排在前面。

### Phase 2 的想法：直接相關＋transitive
Phase 2 是 for 迴圈，i 從 0 跑到 n−1。out[0]～out[11] 一開始全是 false。

- i = 0：out[0] 是 false，印出 0，out[0] 設 true。
- 第一件事：seq[0] 上的 11、4 跟 0 **直接**有關（direct equivalence），印出，out 設 true。
- 第二件事靠 transitive：0 ≡ 11，那跟 11 有關的數字也跟 0 有關。看 11 的 list：0 印過跳過；2 沒印過，0 ≡ 11、11 ≡ 2，所以印出 2。這種要再去查別人的 list 才找得到的，叫 **indirect equivalence（間接相關）**。
- 同理，4 的 list 裡還有 7，也要印。
- for 再往 i = 1, 2, … 走，out 已是 true 的跳過；沒印過的就從它開始找下一個 class。

out 的作用是防止同一個數字印兩次。

> **陷阱** out 的 true／false 有兩種用法：這裡是「初值 false，印過設 true」；課本 C 版是「初值 TRUE 代表還沒印，印完設 FALSE」。語意相反、做法相同，作答時看清楚題目用哪一種。

### Phase 2 程式：用 stack 一層層追
想法簡單，程式卻寫了一大段，因為同時用到 linked list 和 **stack**。做法：先把跟目前數字直接相關的都印出來，**暫時不去看它們自己的 list**，而是 push 進 stack，記住「待會要回來看誰」；目前的 list 走到 null，就 pop 一個出來，掃它的 list。

```cpp
// Phase 2：輸出 equivalence class
for (int i = 0; i < n; i++) {
    if (!out[i]) {                 // i 還沒印過：開始一個新 class
        cout << endl << "A new class: " << i;
        out[i] = true;
        ListNode *x = seq[i];
        Stack s;                   // 存「待會要檢查 list 的數字」
        while (1) {
            while (x) {            // 掃目前這條 list
                int j = x->data;
                if (!out[j]) {     // 沒印過：印出並 push
                    cout << ", " << j;
                    out[j] = true;
                    s.push(j);
                }
                x = x->link;
            }
            if (s.isEmpty()) break;   // stack 空了，這個 class 結束
            x = seq[s.pop()];         // pop 一個數字，改掃它的 list
        }
    }
}
```

（課本版本不另外開 stack，而是把 list 的 node 本身串成 linked stack，push、pop 的順序與上面相同。）

### 例題：完整 trace 三個 class
第一個 class（i = 0）。stack 由左到右是底→頂：

| 步驟 | 動作 | 輸出累積 | stack |
|---|---|---|---|
| 1 | 印 0，開始掃 seq[0] | 0 | 空 |
| 2 | 看到 11：沒印過 → 印出、push | 0 11 | 11 |
| 3 | 看到 4：沒印過 → 印出、push | 0 11 4 | 11 4 |
| 4 | seq[0] 走到 null，pop 出 4，掃 seq[4] | 0 11 4 | 11 |
| 5 | 看到 7：沒印過 → 印出、push | 0 11 4 7 | 11 7 |
| 6 | 看到 0：印過，不印也不 push | 0 11 4 7 | 11 7 |
| 7 | seq[4] 走完，pop 出 7，掃 seq[7] | 0 11 4 7 | 11 |
| 8 | 看到 4：印過 | 0 11 4 7 | 11 |
| 9 | pop 出 11，掃 seq[11] | 0 11 4 7 | 空 |
| 10 | 看到 0：印過 | 0 11 4 7 | 空 |
| 11 | 看到 2：沒印過 → 印出、push | 0 11 4 7 2 | 2 |
| 12 | pop 出 2，掃 seq[2]：只有 11，印過 | 0 11 4 7 2 | 空 |
| 13 | stack 空，class 結束 | 0 11 4 7 2 | 空 |

i = 1、2 時：out[1] 是 false → 第二個 class；out[2] 已是 true，跳過。

| 步驟 | 動作 | 輸出累積 | stack |
|---|---|---|---|
| 1 | 印 1，掃 seq[1] | 1 | 空 |
| 2 | 看到 3：印出、push | 1 3 | 3 |
| 3 | pop 3，掃 seq[3] | 1 3 | 空 |
| 4 | 看到 5：印出、push | 1 3 5 | 5 |
| 5 | 看到 1：印過 | 1 3 5 | 5 |
| 6 | pop 5，掃 seq[5]：只有 3，印過 | 1 3 5 | 空 |

i = 3、4、5 都已印過；i = 6 開始第三個 class：

| 步驟 | 動作 | 輸出累積 | stack |
|---|---|---|---|
| 1 | 印 6，掃 seq[6] | 6 | 空 |
| 2 | 看到 8：印出、push | 6 8 | 8 |
| 3 | 看到 10：印出、push | 6 8 10 | 8 10 |
| 4 | pop 10，掃 seq[10]：只有 6，印過 | 6 8 10 | 8 |
| 5 | pop 8，掃 seq[8]；看到 6：印過 | 6 8 10 | 空 |
| 6 | 看到 9：印出、push | 6 8 10 9 | 9 |
| 7 | pop 9，掃 seq[9]：只有 8，印過 | 6 8 10 9 | 空 |

i = 7～11 都已印過。最後輸出：

```
A new class: 0, 11, 4, 7, 2
A new class: 1, 3, 5
A new class: 6, 8, 10, 9
```

push、pop 的目的，就是把 indirect 的數字一層一層追出來，這是整題的重點。

> **陷阱** 輸出順序要真的 trace code。寫成 0 2 4 7 11 這種排好的順序是錯的——順序錯就代表沒有 trace。這個輸出順序有意義，由 list 的樣子和 stack 一起決定。

### 輸入順序一換，輸出順序就變
問：把 input pair 的順序調換，輸出的 set 一樣嗎？
答：set 一定還是那三個，但 set 裡數字的順序不一定一樣。輸入順序決定 linked list 的樣子：新 node 插在最前面，先讀到的會被擠到後面。

> **例題** 把 9 個 pair 整個倒過來輸入：11≡0、2≡11、3≡5、6≡8、7≡4、8≡9、6≡10、3≡1、0≡4。輸出是什麼？

Phase 1 建出的 list：

```
seq[0]  → 4 → 11        seq[6]  → 10 → 8
seq[1]  → 3             seq[7]  → 4
seq[2]  → 11            seq[8]  → 9 → 6
seq[3]  → 1 → 5         seq[9]  → 8
seq[4]  → 0 → 7         seq[10] → 6
seq[5]  → 3             seq[11] → 2 → 0
```

第一個 class 的 trace：

| 步驟 | 動作 | 輸出累積 | stack |
|---|---|---|---|
| 1 | 印 0，掃 seq[0] | 0 | 空 |
| 2 | 看到 4：印出、push | 0 4 | 4 |
| 3 | 看到 11：印出、push | 0 4 11 | 4 11 |
| 4 | pop 11，掃 seq[11]；看到 2：印出、push | 0 4 11 2 | 4 2 |
| 5 | 看到 0：印過 | 0 4 11 2 | 4 2 |
| 6 | pop 2，掃 seq[2]：只有 11，印過 | 0 4 11 2 | 4 |
| 7 | pop 4，掃 seq[4]；看到 0：印過 | 0 4 11 2 | 空 |
| 8 | 看到 7：印出、push | 0 4 11 2 7 | 7 |
| 9 | pop 7，掃 seq[7]：只有 4，印過 | 0 4 11 2 7 | 空 |

第二個 class：印 1 → 3（push）→ pop 3，seq[3] 是 1、5 → 印 5，得 1 3 5。
第三個 class：印 6 → 10、8 依序印出並 push（stack：10 8）→ pop 8，seq[8] 是 9、6 → 印 9 並 push → pop 9、pop 10 都沒有新數字，得 6 10 8 9。

```
0 4 11 2 7    1 3 5    6 10 8 9
```

課本最後一頁程式只是把所有 linked list 釋放（清掉），重點在前面兩個 phase。

這是唯一解嗎？不是，可以想別的寫法；到 tree 那章，還會用 tree 解 equivalence，更簡單。

## Sparse matrix 的 linked list 表示法

### 為什麼改用 circular linked list
**Sparse matrix（稀疏矩陣）**是大部分元素都是 0 的矩陣。前面用一維 array 存，只記非 0 元素的 row、column、value，三個一組叫 **triple**。現在改用 **circular linked list（環狀串列）**：每個 row、每個 column 各有一條環狀 list，一個非 0 元素同時掛在它的 row list 和 column list 上。

課本例子是 4×4，只有 4 個非 0：

```
         col0  col1  col2  col3
row 0  [   0     0    11     0 ]
row 1  [  12     0     0     0 ]
row 2  [   0    -4     0     0 ]
row 3  [   0     0     0   -15 ]
```

### Head node 與 entry node
圖上有兩種 node：

- **整個 matrix 的 head node**（圖中藍色）：記錄 matrix 是幾乘幾（這裡 4×4）。
- **Row／column 的 head node** H0～H3（黃色）：每個 row 和 column 的頭端。
- **Entry node**（黑框）：放真正的非 0 數字。

圖上的上面一排 H0～H3 和左邊一排 H0～H3 **是同一組 node**，只是畫兩次比較像 matrix：黃色看起來有 8 個，實際只有 4 個。H0 同時當 row 0 和 column 0 的頭，H1 同時當 row 1 和 column 1 的頭，以此類推。

以 12 為例，它的 entry 寫著 `1 0 12`：第 1 個 row、第 0 個 column，值 12。

- **Row list**：H1 往右看，第一個非 0 就是 12，其他 0 不用記；12 後面沒東西，它的 right 指回 H1，繞回頭，所以是環狀。
- **Column list**：從 H0 往下；column 0 也只有 12，12 的 down 再指回 H0。

```
row 1 :  H1 ──right──▶ [1 0 12] ──right──▶ 回到 H1
col 0 :  H0 ──down───▶ [1 0 12] ──down───▶ 回到 H0
```

各 row／column 的 list：

| list | 內容（環狀，最後回到 head） |
|---|---|
| row 0 | H0 → (0,2,11) → H0 |
| row 1 | H1 → (1,0,12) → H1 |
| row 2 | H2 → (2,1,−4) → H2 |
| row 3 | H3 → (3,3,−15) → H3 |
| col 0 | H0 → (1,0,12) → H0 |
| col 1 | H1 → (2,1,−4) → H1 |
| col 2 | H2 → (0,2,11) → H2 |
| col 3 | H3 → (3,3,−15) → H3 |

### Node 的欄位
Head node 最下面還有一個 **next**，把 H0 → H1 → H2 → H3 自己也串成一條 list，叫 **header list**。所以 head node 嚴格說有三個 pointer：

| Head node 欄位 | 用途 |
|---|---|
| head | boolean，表示是不是 head node |
| right | 指向同一 row 的第一個 entry |
| down | 指向同一 column 的第一個 entry |
| next | 指向下一個 head node（header list） |

| Entry node 欄位 | 用途 |
|---|---|
| head | false |
| down | 同一 column 的下一個非 0 |
| right | 同一 row 的下一個非 0 |
| row、col | 位置 |
| value | 值 a_ij |

Entry node 記的 row、col、value 跟 array 表示法的 triple 很像。圖上沒畫 head 欄位，為了省空間用顏色代替：黃色是 head = true，黑色是 head = false。

### 需要幾個 node
> **重點** n×m 的 sparse matrix 有 r 個非 0 項，共需 **max{n, m} + r + 1** 個 node。
> - row 和 column 共用 head node，所以只要 max{n, m} 個。
> - 每個非 0 項一個 entry node：r 個。
> - +1 是整個 matrix 的 head node。

> **例題** 課本的 4×4、4 個非 0：max{4, 4} + 4 + 1 = 4 + 4 + 1 = 9 個 node。若是 4×3，head node 仍是 max{4, 3} = 4 個。

練習：自己畫一個 4×3 的 sparse matrix 用這種表示法長什麼樣子。

### 好處：transpose 只改 pointer
問：這種表示法有什麼好處？以 **transpose（轉置）** 為例：row 變 column、column 變 row。Head node 不用動，還是同一組；每個 entry 的 row、col 對調，要改的是 right、down 這些 pointer。程式得重寫，但額外的工作（overhead）只是把 pointer 指到對的位置。

### 一個 MatrixNode class 加 union
Head node 和 entry node 看似該是兩種 data type，課本卻只用**一個 class**：

```cpp
struct Triple { int row, col, value; };

class Matrix;   // 前置宣告

class MatrixNode {
    friend class Matrix;
    friend istream& operator>>(istream&, Matrix&);
private:
    MatrixNode *down, *right;   // 兩種 node 共用
    bool head;                  // true：head node；false：entry node
    union {                     // 不同的部分共用同一塊記憶體，一次只用一個
        MatrixNode *next;       // head node 用：串 header list
        Triple triple;          // entry node 用：row、col、value
    };
    MatrixNode(bool, Triple*);
};

class Matrix {
    friend istream& operator>>(istream&, Matrix&);
public:
    ~Matrix();                  // destructor
private:
    MatrixNode *headnode;       // 整個 matrix 的 head node（藍色那個）
};
```

- 共用欄位：down、right、head。
- head 是 true → union 用 next。
- head 是 false → union 用 triple。

自己寫可能會開兩個 class；共用欄位加 bool head 再加 union，一個 class 就搞定，更精簡也省空間。

### 輸入格式與 operator>>
Matrix 的 `operator>>` 有 overloading，寫 `cin >> m` 就能讀進一整個 matrix。課本的輸入檔：

```
4 4 4
0 2 11
1 0 12
2 1 -4
3 3 -15
```

第一行是 rows、cols、非 0 項數，先照它建出 head node；之後每行一組 (row, col, value)，讀一行就串進對應的 row list 和 column list。

在這種結構上怎麼做 transpose、加法等運算，見課本 4.8.2、4.8.3。

## Stack 是什麼

### 一疊東西與 top
**Stack（堆疊）**就是把資料一筆筆往上疊：新資料疊在舊資料上面。辦公桌上一張張疊上去的紙、公文、作業就是 stack。既然是疊，就有「頂端」**top**，代表最上面那一個。

> **比喻** 自助餐廳放空餐盤的地方：盤子一盤一盤往上疊，top 跟著往上移。洗好的盤子只能放在最上面（insert top），不能塞到中間——真的一疊盤子要從中間塞也很難。

所以 stack 是 **restricted（受限制）** 的結構：只准在 top 放東西、從 top 拿東西。

### push、pop、peek
對照基本操作：get 是看但不拿走、remove 是拿走、insert 是放進去。

| 操作 | 意思 | 對應 |
|---|---|---|
| **push** | 放到最上面 | insert |
| **pop** | 從最上面拿走（真的移掉） | remove |
| **peek**（get top） | 只看最上面是誰，不拿走 | get |

push、pop 是最基本的兩個操作。有些實作會多給「偷看頂端」的 peek，甚至讓你偷看頂端好幾個；不過大致上，允許的運算都在頂端發生，壓在下面的不太管——像待辦事項一件件壓上來，上面的先處理，最底下的搞不好早就忘了。

### LIFO
Stack 的特性是 **Last In, First Out（LIFO，後進先出）**：最後進去的第一個出來。

> **例題** 先 push 3，再 push 5，然後 pop。

| 操作 | stack（底→頂） | top | 取出 |
|---|---|---|---|
| 開始 | 空 | — | |
| push 3 | 3 | 3 | |
| push 5 | 3 5 | 5 | |
| pop | 3 | 3 | 5 |

5 比較晚進去，卻比 3 先出來。

> **例題** A、B、C、D、E 依序進來，再 pop 一次。

| 操作 | stack（底→頂） | top 指向 |
|---|---|---|
| 開始 | 空 | — |
| push A | A | A |
| push B | A B | B |
| push C | A B C | C |
| push D | A B C D | D |
| push E | A B C D E | E |
| pop → 取出 E | A B C D | D |

top 這個指標永遠指著最上面的 element；pop 拿的是 top 所指的那個，拿完 top 減一，指到下一個（D）。E 最後丟進去卻第一個被取出。

> **比喻** 擠電梯：A、B、C 依序進去，先進的被擠到最裡面，C 站門口。大家到同一層，C 先出來，再來 B，最後 A——順序剛好相反。小孩子都能自己發現「最後進去的會先出來」。餐盤也一樣：最後放上去的盤子最先被拿去用。

Stack 是個有限制、不難的結構，但在電腦科學裡非常有用，不管概念上還是實作上：很多看似複雜的問題，靠它就能轉成記憶體裡很簡單的操作。

### Stack 的 ADT
Stack 的 ADT：**a finite ordered list with zero or more elements**——有順序、有限的 list，可以有 0 個或很多個元素。

- **finite** 不是亂寫的：stack 大小有上限，反映在 constructor 的 `MaxStackSize = DefaultSize`，就是最多能裝多少。
- 既然有限就會滿，所以要有 `Boolean IsFull()`。
- `Add(item)` 就是 push；item 的型態是 KeyType，用 template 寫，float、integer 都能放。
- `Boolean IsEmpty()`：一直 pop 下去，空了再怎麼抓也抓不到，所以 pop 前要先檢查。
- `Delete()` 就是 pop。

> **陷阱** 有的書叫 Add／Delete，有的叫 push／pop，意思一樣，看到別慌。

## 括號配對（parenthesis matching）
C 語言裡小括號、中括號、大括號（還有引號）都要成雙成對。**Compiler（編譯器）**也是人寫的程式，任務之一就是檢查括號有沒有 **balanced（平衡）**。例如左邊一個小括號卻對到右邊的大括號，就不對；若那個大括號其實是配更前面的大括號，這個小括號就落單了。

像 Lisp 這種括號特別多的語言（每組括號代表一件要做的事），以前要靠肉眼對括號，後來才有人寫程式提示哪個配哪個。

### 想法：最近看到的左括號先配
簡單版問題：給一段文字，回答括號平不平衡。關鍵是**最裡面那個左括號**，也就是最後看到、還沒配對的左括號，要先幫它找到右括號；配掉之後，下一個右括號就去配外面那層還在等的。「最後看到的先處理」就是 LIFO，所以用 stack。

演算法：

1. 一個一個字元讀，其他字元不管、只看括號。
2. 讀到左括號 → push。
3. 讀到右括號 → 跟 top 的左括號配對：stack 是空的 → 不平衡；pop 出來的種類不同 → 不平衡；相同 → 配對成功，pop 掉。
4. 讀完後 stack 要剛好是空的才平衡；還剩左括號 → 不平衡。

這樣做下去，最近看到的左括號永遠在頂端，一下就配到。

> **例題** 檢查 `{ ( a [ i ] ) }`。

| 讀到 | 動作 | stack（底→頂） |
|---|---|---|
| { | push | { |
| ( | push | { ( |
| a | 略過 | { ( |
| [ | push | { ( [ |
| i | 略過 | { ( [ |
| ] | top 是 [，同種 → pop | { ( |
| ) | top 是 (，同種 → pop | { |
| } | top 是 {，同種 → pop | 空 |
| 結束 | stack 空 → balanced | 空 |

> **例題** 檢查 `{ ( }`：讀到 } 時 pop 出來的是 (，種類不同 → 配錯，不平衡。

三種不平衡：右括號種類對不上、讀到右括號時 stack 已空、讀完後 stack 還剩左括號。

引號左右長得一樣，比較複雜，不在這個簡單版裡；但左右不同的括號光靠 push、pop 就解決了。

> **觀念** stack 演算法的精神：資訊先留著，最近的先處理，外面的等一下再說。後面的運算式轉換、求值都是這個精神。

## Stack 的應用：迷宮與函式呼叫
- **迷宮老鼠**：把機器人丟進有很多障礙的迷宮，它 try and error，走到死路就退回上一步換路；要記得來時路，就用 stack。（迷宮的完整做法在 queue 之後講。）
- **Function call**：procedure A 呼叫 procedure B 時，系統得先把 A 正在用的東西（pointer、local variable、return address）存起來，做完才回得來。例如 main 呼叫 A1，就把這一層的資料疊在 stack 上。最後被呼叫的函式最先結束，剛好 LIFO。

### System stack：函式呼叫的草稿紙
回想 **recursive call（遞迴呼叫）**：函式呼叫自己。遞迴會多耗記憶體：f(3) 還沒算完就呼叫 f(2)，它得在某個地方等 f(2) 回來。

> **比喻** 每呼叫一個新函式，就像拿一張新的草稿紙來算：f(2) 一張、f(1) 再一張。還在等的舊函式，狀態寫在舊草稿紙上、壓在下面。一疊草稿紙就是 stack，叫 **system stack**，系統靠它記得現在在哪個函式、做完要回哪裡。

每張草稿紙上記著：

- 這個函式的區域變數（local variable）。
- 傳進來的參數（parameter）。
- 算完的 return value 要放在哪裡。
- 做完要回到哪一張：previous pointer，有點像 linked list 的指標。其實更簡單——最上面那張撕掉（pop），自然就回到上一張；f(0) 到 f(3) 一張張撕完。

遞迴太多層（像 f(100000)）就要非常多張草稿紙；草稿紙用完、堆不下，系統負荷不了，這就是 **stack overflow**。

另外，這些草稿紙在記憶體裡真的疊在一起，系統若沒保護好，惡意程式就可能從一張偷看另一張不該看的資料，形成安全漏洞——這是系統安全在研究的問題。

### Activation record
程式裡的敘述分兩類：`int x = 10` 這種變數是 **data**；`x++` 這種是 **instructions**。Main memory 一部分給 OS，其餘分成 **Code、Stack、Heap** 三區執行程式：

| 區域 | 放什麼 |
|---|---|
| Code | 指令（machine code） |
| Stack | 函式的變數（data） |
| Heap | 動態配置的記憶體 |

另有一小塊放 global／static 變數（一般稱 data segment）。

執行時機器碼載入 Code 區，main 的變數 x 在 Stack 上配置空間。Stack 上屬於 main 的這一塊，叫 main 的 **activation record**；main 的指令要用 x 時，就到自己那塊 record 去拿。

> **重點** activation record 在函式**被呼叫、開始執行**時建立，函式**結束**時刪除。正在執行的函式只用 stack 最上面那一層。

### 例題：函式呼叫
main 把 x 加 1 變 11，傳給 A，A 印出 11。

```c
void A(int a) {
    printf("%d ", a);
}
int main() {
    int x = 10;
    x++;
    A(x);
}
```

| 事件 | stack（底→頂） | 輸出 |
|---|---|---|
| main 開始 | main(x=10) | |
| x++ | main(x=11) | |
| main 呼叫 A | main(x=11)、A(a=11) | |
| A 印出 | main、A | 11 |
| A 結束，刪 record | main | 11 |
| main 結束 | 空 | 11 |

main 呼叫 A 時還沒結束，只是停下來等，所以它的 record 還在。

### 例題：巢狀呼叫 main → A → B
main 呼叫 A 並傳 11，A 再呼叫 B 並傳 22，B 印出 22。

| 事件 | stack（底→頂） | 輸出 |
|---|---|---|
| main 開始 | main | |
| main 呼叫 A(11) | main、A | |
| A 呼叫 B(22) | main、A、B | |
| B 印出 | main、A、B | 22 |
| B 結束 | main、A | 22 |
| A 結束 | main | 22 |
| main 結束 | 空 | 22 |

後呼叫的先結束，就是 LIFO。

### 遞迴例一：先印再呼叫（tail recursion）
函式呼叫自己叫 **recursive function**，一定要有**終止條件**，否則會無限呼叫下去。

```c
void A(int n) {
    if (n > 0) {
        printf("%d ", n);
        A(n - 1);
    }
}
int main() { A(3); }
```

呼叫自己是函式的最後一個敘述，這種叫 **tail recursion（尾遞迴）**。

| 事件 | stack（底→頂） | 輸出 |
|---|---|---|
| main 開始 | main | |
| 呼叫 A(3) | main、A(3) | |
| 3 > 0，印 3 | main、A(3) | 3 |
| 呼叫 A(2) | main、A(3)、A(2) | 3 |
| 2 > 0，印 2 | 同上 | 3 2 |
| 呼叫 A(1) | main、A(3)、A(2)、A(1) | 3 2 |
| 1 > 0，印 1 | 同上 | 3 2 1 |
| 呼叫 A(0) | main、A(3)、A(2)、A(1)、A(0) | 3 2 1 |
| 0 > 0 不成立，A(0) 結束 | main、A(3)、A(2)、A(1) | 3 2 1 |
| A(1) 沒事做，結束 | main、A(3)、A(2) | 3 2 1 |
| A(2) 結束 | main、A(3) | 3 2 1 |
| A(3) 結束 | main | 3 2 1 |
| main 結束 | 空 | 3 2 1 |

每次呼叫自己都建立新的 record，同一個函式從頭跑、但用新 record；舊的仍留在 stack 上，因為那次呼叫還沒結束。輸出 **3 2 1**：每層在「呼叫的時候」就印。Stack 最多同時 5 層（main + A(3)～A(0)）。

### 遞迴例二：先呼叫再印
只改一個地方：先遞迴呼叫，再 printf。

```c
void A(int n) {
    if (n > 0) {
        A(n - 1);
        printf("%d ", n);
    }
}
```

| 事件 | stack（底→頂） | 輸出 |
|---|---|---|
| main 呼叫 A(3) | main、A(3) | |
| 3 > 0，先呼叫 A(2)（printf 還沒執行） | main、A(3)、A(2) | |
| 2 > 0，呼叫 A(1) | main、A(3)、A(2)、A(1) | |
| 1 > 0，呼叫 A(0) | main、A(3)、A(2)、A(1)、A(0) | |
| 0 > 0 不成立，A(0) 結束 | main、A(3)、A(2)、A(1) | |
| 回到 n=1，接著做 printf | main、A(3)、A(2)、A(1) | 1 |
| A(1) 結束 | main、A(3)、A(2) | 1 |
| 回到 n=2，印 2，結束 | main、A(3) | 1 2 |
| 回到 n=3，印 3，結束 | main | 1 2 3 |
| main 結束 | 空 | 1 2 3 |

輸出 **1 2 3**：數字是「返回的時候」才印。Stack 最多一樣 5 層。

> **陷阱** 遞迴呼叫之後還有事要做，就不是 tail recursion（常稱 head recursion）。看到遞迴題，先看 printf 在呼叫前還是後：前 → 呼叫時印，順序 3 2 1；後 → 返回時印，順序 1 2 3。

## Stack 的實作

### 用 array：top 放尾端
Stack 只要求能輕鬆在 top 放、從 top 拿。用一個連續的 array 實作，**top 放在 array 尾端**。

> **例題** array 裡已有 3、5，push 4 再 pop。

```
初始：  index  0  1  2  3
        值     3  5  .  .     top = 1
push 4：stack[++top] = 4
        值     3  5  4  .     top = 2
pop：   return stack[top--]   → 取出 4
        值     3  5  .  .     top = 1
```

push、pop 都在尾巴做，其他元素完全不用動，都是 O(1)：連續 array 的尾端維護成本最小。若 top 放在頭，push 時頭沒空間，得先把所有資料往後搬一格；pop 又要整排往前搬，每次動 n 筆，變 O(n)。

### Stack class：top 從 −1 開始
邏輯上 stack 是容器，實際上用 stack[0]～stack[n−1]。

```cpp
template <class KeyType>
class Stack {
public:
    Stack(int MaxStackSize = DefaultSize);
    Boolean IsFull();
    void Add(const KeyType& x);       // push
    Boolean IsEmpty();
    KeyType* Delete(KeyType& x);      // pop
private:
    int top;
    KeyType *stack;
    int MaxSize;
};

template <class KeyType>
Stack<KeyType>::Stack(int MaxStackSize) : MaxSize(MaxStackSize)
{
    stack = new KeyType[MaxSize];
    top = -1;                         // 還沒有資料
}

template <class KeyType>
Boolean Stack<KeyType>::IsFull()  { return top == MaxSize - 1; }

template <class KeyType>
Boolean Stack<KeyType>::IsEmpty() { return top == -1; }

template <class KeyType>
void Stack<KeyType>::Add(const KeyType& x)
{
    if (IsFull()) StackFull();
    else stack[++top] = x;            // 先加再放
}

template <class KeyType>
KeyType* Stack<KeyType>::Delete(KeyType& x)
{
    if (IsEmpty()) { StackEmpty(); return 0; }   // 印出 empty 訊息
    x = stack[top--];                 // 先拿再減
    return &x;
}
```

- `Stack::Stack` 兩個冒號表示它是 class Stack 的 member function（這裡是 constructor）；後面一個冒號是初始化，把 MaxSize 設成 MaxStackSize。
- top 一開始是 −1，所以 IsEmpty 就看 top 是不是 −1；IsFull 是 `top == MaxSize − 1`。
- 第一次 Add(A)：top 從 −1 加到 0，A 放進 stack[0]。

> **陷阱** 注意 ++、−− 的位置：push 是 `stack[++top] = x`（先加再放），pop 是 `x = stack[top--]`（先拿再減）。寫反就會差一格。

### 用 linked list：top 放 head
用 singly linked list 時，push 的東西放哪一端？

- 放頭（head 當 top）：新節點指向原本的 head，再把 head 改成它，O(1)；pop 時 head 改指下一個，也 O(1)。
- 放尾：insert 在尾巴還行（要有 tail 指標）；但 remove 尾巴要改「尾巴前一個」node 的 pointer，單向只能往後走，得從 head 一路走過去，O(n)。

| 位置 | insert | remove |
|---|---|---|
| head | 容易 | 容易 |
| tail | 容易（需 tail 指標） | 難，要走訪整串 |

所以 singly linked list 的 top 放 **head** 最自然。Doubly linked list 是對稱的，頭尾都能 O(1)，放哪邊都沒差。

```c
typedef struct node {
    int data;
    struct node *link;
} Node;
Node *top = NULL;

void push(int x) {
    Node *p = malloc(sizeof(Node));
    p->data = x;
    p->link = top;     // 新節點接在最前面
    top = p;
}
int pop(void) {        // 呼叫前先確認 top != NULL
    Node *p = top;
    int x = p->data;
    top = p->link;     // head 改指下一個
    free(p);
    return x;
}
```

> **陷阱** linked list 實作時 top 放錯端（放在 singly list 的 tail），pop 就要走訪整串，失去 O(1)。

### STL stack：container adapter
C++ STL 已經寫好 stack，只要指定裝什麼型別；還能指定底層用 vector（array）或 list，不指定時預設底層是 **deque**（兩頭都能進出的容器）。

```cpp
#include <stack>
#include <vector>
#include <list>
std::stack<int> s1;                       // 底層預設 deque
std::stack<int, std::vector<int>> s2;     // 底層用 vector
std::stack<int, std::list<int>> s3;       // 底層用 list
s1.push(3);  s1.push(5);
int t = s1.top();   // peek：5
s1.pop();           // 移除 5
```

STL 把 stack 叫 **container adapter**。

> **比喻** Adapter 就是轉接器、變壓器、轉接頭：把一種插座轉成你需要的樣子。Array、linked list 是 general container，什麼都能做、哪一格都能碰；stack 只需要也只能在 top push、pop。所以 stack 就是在包山包海的 array 外面加個保護套，只留 top 一個開口；繞過去直接改中間那格，就違反 stack 的特性了。

轉接器的概念：**reuse** 基本資料結構，再加一層限制，做出新的資料結構。

### 問答
問：瀏覽器的「上一頁」算 stack 嗎？
答：是好例子。依序開 A、B、C，就像一頁頁 push；按上一頁，C 被拿掉回到 B，最後進來的先出去，正是 LIFO。不過也可以看成一條隱含的 linked list（每頁記著上一頁是誰），所以實作不一定是 stack。

問：Container 是什麼？
答：能裝東西的容器。Array、list 是 general container，哪裡都能放能拿；stack 是 restricted container，只能照規定從一個開口進出。可以想成底下有個 array 或 linked list，stack 在上面加了一個限定的開口。

問：電腦把十進位轉成二進位，需要 stack 嗎？以 13 為例。
答：看計算順序和輸出順序一不一樣。

- 做法一：先找數字範圍，從最大的 2 的次方往下比（8、4、2、1）：13 有 8 → 寫 1 剩 5；有 4 → 寫 1 剩 1；沒有 2 → 寫 0；有 1 → 寫 1，得 1101。高位先算、高位先輸出，for 迴圈直接跑完，不用額外儲存，**不需要 stack**。
- 做法二：一直除以 2 取餘數，先算出的是最低位，但輸出要從高位寫起，就要先暫存再反過來——用 stack：

| 計算 | 餘數 | push 後 stack（底→頂） |
|---|---|---|
| 13 ÷ 2 = 6 | 1 | 1 |
| 6 ÷ 2 = 3 | 0 | 1 0 |
| 3 ÷ 2 = 1 | 1 | 1 0 1 |
| 1 ÷ 2 = 0 | 1 | 1 0 1 1 |

依序 pop：1、1、0、1 → **1101**。

> **重點** 結果要先暫存、輸出順序又跟計算順序相反時才需要 stack；能用 for 迴圈照順序跑完的，不一定要 stack。

### Multiple stacks 與 Stack ≠ Array
一個 array 裡可以放好幾個 stack，叫 **multiple stacks**。

- **兩個 stack**：例如 10 格的 array，stack 1 從頭往後長（top1 往右走），stack 2 從尾巴往前長（top2 往左走）。兩個 top 碰頭才真的滿，空間可以互相借。

```
index:  0  1  2  3  4  5  6  7  8  9
        a  b  c  .  .  .  .  z  y  x
              ↑top1          ↑top2
        stack1 →            ← stack2
```

- **n 個 stack**：先決定每個 stack 的 size，把 array 切成 n 等份，各管一段（例如 n = 3 切三段）。這個知道就好，實際寫程式不一定這樣做。

> **觀念** 一個 array 不只能放一個 stack，一個 stack 也不只能用 array 做。所以 **Stack ≠ Array**：array 是 (index, value) pair 的集合，一個編號配一個值；stack 是有限的集合再加上 LIFO 規則，是一個 ADT，只規定能做什麼，array 只是實作它的方法之一。

## 運算式求值（expression evaluation）

### 先乘除後加減與 infix 的歧義
**Expression evaluation** 是 compiler 每天在做的事。程式裡寫

```
X = A / B − C + D * E − A * C
```

照「先乘除、後加減」：先 A / B，再減 C；看到加號時不能直接把前面的結果跟 D 加，因為 D 要先跟後面的乘號算——先 D * E 再加，再算 A * C，最後相減。電腦需要的就是這樣一路的計算過程，中間的暫存值要先存起來。

設 A = 4、B = C = 2、D = E = 3，X 是多少？說不準，要看括號怎麼加：

- 照先乘除後加減：`((((4/2) − 2) + (3*3)) − (4*2))` = 2 − 2 + 9 − 8 = **1**。
- 另一種括法：`((4/(2−2+3)) * (3−4)) * 2` = (4/3) × (−1) × 2 = **−2.666…**。

只給電腦這串符號，可能是 1 也可能是 −2.666…（it depends），這就會 misleading。要消除不確定，就要有規則（先乘除後加減）；為了做到這條規則，改用 postfix。流程是：

```
infix ──(轉換)──▶ postfix ──(求值)──▶ 值
```

### Postfix notation
我們平常把 operator 夾在運算元中間的寫法叫 **infix（中序）**；**postfix（後序）**是把 operator 放在運算元**後面**。例如 2 + 3 * 4 寫成 `2 3 4 * +`。

A、B、C、D、E 這些要被算的東西位置通通不動，只把加減乘除搬到後面：

- A / B 寫成 `A B /`：對電腦就是「讀 A、讀 B、做除法」。
- 結果要跟 C 相減：接著寫 `C −`。
- 再準備加號的另一側 `D E *`，兩邊都好了才寫 `+`。
- 最後 `A C *`、再 `−`。

```
A / B − C + D * E − A * C   →   A B / C − D E * + A C * −
```

post 就是「後面」：先把要算的東西準備好，再下指令，一直重複。運算元出現的順序跟原式一模一樣，只是移動 operator，讓電腦知道那個時間點要做什麼。

> **重點** Postfix 裡完全沒有括號，也沒有優先序的問題。Infix 轉成 postfix 後，電腦就能很快 evaluate 出答案。

（Operator 放在前面的叫 **prefix（前序）**；infix 轉 prefix 是課本習題，考古題也考過，做法類比。）

## 手動把 infix 轉成 postfix

### 方法一：加括號，在括號內換位置
> **例題** 把 `3 / 4 − 5 + 6 * 7 − 8 * 9` 轉成 postfix。

1. 先把要先做的乘除括起來；其他沒有優先順序的，從左到右一層層加括號：

```
((( (3 / 4) − 5 ) + (6 * 7) ) − (8 * 9))
```

2. 這時每個括號裡剛好三樣東西：前面的運算元、後面的運算元、動作。在每個括號裡把順序換成 postfix：

```
(3 / 4) → 3 4 /      (6 * 7) → 6 7 *      (8 * 9) → 8 9 *
外層：  3 4 / 5 −  →  3 4 / 5 − 6 7 * +  →  3 4 / 5 − 6 7 * + 8 9 * −
```

3. 括號只是圍籬，幫你圈出要換位置的範圍，轉完脫掉：

```
3 4 / 5 − 6 7 * + 8 9 * −
```

考試手算短式子用這招就好，不必跑複雜的演算法：運算元順序永遠不變，只有運算子換位置。式子短，人可以跳著看、把括號掛對地方；但要電腦把括號插到正確位置就沒那麼容易。

### 方法二：operator 取代右括號
另一種手動法也是先依先乘除後加減把整個式子**完全加上括號**，然後：

1. 左括號先不理，每個 operator 往右找它對應的右括號，取代掉。
2. 刪掉剩下的左括號。

```
完全加括號： ((((A / B) − C) + (D * E)) − (A * C))
operator 取代右括號：((((A B / C − (D E * + (A C * −
刪左括號：   A B / C − D E * + A C * −
```

結果與方法一相同。缺點是要**兩個 pass**：第一遍 scan 加括號，第二遍做取代、再刪括號。用 stack 可以只 scan 一次（後面講）。

## Postfix 求值

### 想法：抓最近的兩個數字
已經拿到 `3 4 / 5 − 6 7 * + 8 9 * −`，從左讀到右：讀資料、下動作。

- 3、4，看到 / → 0.75；0.75 和 5，看到 − → −4.25。
- 讀 6、7，看到 * → 42。這時 −4.25 還不知道要跟 42 做加減乘除哪一個，只能先存著、等候發落。
- 看到 + 才加起來 → 37.75；算 8 * 9 時，37.75 又只能在旁邊等。
- 最後 37.75 − 72 = **−34.25**。

這些先存起來的數字不能亂存，要保持順序。Postfix 的特點是：看到運算符號，抓的一定是**最近**算好、或最近讀到的兩個數字。「最近」在括號配對看過——找最近的左括號出來配對。最近的先處理、遠一點的先存著，總有一天輪到它：這正是 stack 的行為。

放數字的 stack 叫 **operand stack**。

### 例題：3 4 / 5 − 6 7 * + 8 9 * −

| 讀到 | 動作 | stack（底→頂） |
|---|---|---|
| 3 | push | 3 |
| 4 | push | 3 4 |
| / | pop 4、pop 3，3 / 4 = 0.75，push | 0.75 |
| 5 | push | 0.75 5 |
| − | pop 5、pop 0.75，0.75 − 5 = −4.25，push | −4.25 |
| 6 | push | −4.25 6 |
| 7 | push | −4.25 6 7 |
| * | pop 7、pop 6，6 * 7 = 42，push | −4.25 42 |
| + | pop 42、pop −4.25，−4.25 + 42 = 37.75，push | 37.75 |
| 8 | push | 37.75 8 |
| 9 | push | 37.75 8 9 |
| * | pop 9、pop 8，8 * 9 = 72，push | 37.75 72 |
| − | pop 72、pop 37.75，37.75 − 72 = −34.25，push | −34.25 |
| 結束 | stack 只剩一個 → 答案 | −34.25 |

在 + 之後，37.75 是 stack 裡唯一的 element，既是最底端也是最頂端。

> **陷阱** pop 出兩個數時，**先 pop 出來的是右運算元**、後 pop 的是左運算元。減法和除法順序弄反就算錯（`3 4 /` 是 3/4，不是 4/3）。

### 例題：6 2 / 3 − 4 2 * +
對應的 infix 是 6 / 2 − 3 + 4 * 2。

| 讀到 | 動作 | stack（底→頂） |
|---|---|---|
| 6 | push | 6 |
| 2 | push | 6 2 |
| / | pop 2、pop 6，6 / 2 = 3，push | 3 |
| 3 | push | 3 3 |
| − | pop 3、pop 3，3 − 3 = 0，push | 0 |
| 4 | push | 0 4 |
| 2 | push | 0 4 2 |
| * | pop 2、pop 4，4 * 2 = 8，push | 0 8 |
| + | pop 8、pop 0，0 + 8 = 8，push | 8 |
| # | 結尾，輸出 stack 裡的值 | 8 |

答案 **8**。這題 stack 最多只用到三格。

### Eval 函式：用 # 標記結尾
這個過程 input 是 postfix、output 是值，寫成函式 `Eval(e)`。為了知道式子在哪裡結束，最後加一個 **#** 當結尾記號。字串裡每個元素叫一個 **token**（例如 2 就是一個 token），用 `NextToken` 一個個抓：

```cpp
void Eval(Expression e)
{   // e 是 postfix，最後一個 token 是 '#'
    Stack<Token> stack;
    for (Token x = NextToken(e); x != '#'; x = NextToken(e))
        if (x is an operand) stack.Add(x);      // 數字：push
        else {                                  // operator
            從 stack 取出 x 需要的運算元個數;
            做運算 x，結果存回 stack;
        }
    // 讀到 '#'：stack 裡剩下的值就是答案
}
```

### 需要幾個就 pop 幾個
Postfix evaluation 非常單調簡單，樸實無華：從左掃到右，完全不用回頭；讀到 number 丟進 stack；讀到 operator，就拿出**它需要的數量**，算完再塞回去——數字推進 stack，看到動作就拿出來揉一揉、捏一捏，再塞回去。

不一定都是兩個：

- **Unary operator（一元運算子）**：5 × (−3) 的負號只吃一個數字。Postfix 寫成 `5 3 neg *`（neg 代表負號）。

| 讀到 | 動作 | stack |
|---|---|---|
| 5 | push | 5 |
| 3 | push | 5 3 |
| neg | pop 一個 3，變 −3，push | 5 −3 |
| * | pop 兩個，5 × (−3) = −15，push | −15 |

- **Ternary operator（三元運算子）**：C 語言的 `?:` 吃三個（條件、成立時的結果、不成立時的結果）。`1 ? 7 : 9` 的 postfix 是 `1 7 9 ?:`：

| 讀到 | 動作 | stack |
|---|---|---|
| 1 | push | 1 |
| 7 | push | 1 7 |
| 9 | push | 1 7 9 |
| ?: | pop 三個；條件 1 成立 → 結果 7，push | 7 |

順利跑完的話，stack 上只剩一個 element，它的值就是整個 postfix 的結果。

## 用 stack 把 infix 轉成 postfix

### 想要 one-pass
做計算機時要假設使用者只會按 2 + 3 * 4，不會自己寫 postfix，所以程式要幫忙把 infix 轉成 postfix，這叫 **expression parsing**。手動法要加括號、轉換、拆括號，得把式子掃很多次；我們希望從左到右**只掃一次**，叫 **one-pass algorithm**，比掃很多次省時間。

### 觀察：operator 什麼時候能輸出
以 `A / B − C + D * E − A * C` 觀察。只掃一次，代表有時得先看看後面，才能決定前面的能不能處理。數字順序不變，只要決定符號放哪：

- A 直接輸出。讀到 /，還不知道要做什麼——後面可能有更優先的事（例如括號）要先做；就算知道 / 一定先做，也要等看到 B 才能輸出。所以看到 / 無論如何先存起來。
- B 輸出，看到 −：它比 / 低，A / B 的意念已完整，`A B /` 可以輸出；− 自己要等右邊，先存著。
- C 輸出，看到 +：加減同優先，規定從左做到右，所以 `C −` 出來；+ 存著。
- D 輸出，看到 *：+ 不能出來（* 比較大，要等 * 那邊做完），* 自己也還不能做，兩個都先放著。
- E 輸出，看到後面的 −：它比 * 低，確定 * 可以做，`D E *` 出來；再回頭看 +：跟 − 同優先、又比較早出現，也出來。新的 − 存起來。

到這裡是 `A B / C − D E * +`。存在哪裡？**stack**——後面要處理的，跟最近塞進去的最接近：看到後面的 −，要先處理最近的 *，把最接近、還沒完成的那個做完，才回頭處理 +。

> **比喻** 這種從後面一路往回追的感覺，像追查一個人到底是被誰感染的：只看式子一次，不確定的先存下來，要輸出時從後往回追，最後存的最先處理。

### 演算法
一個迴圈從左掃到右：

1. 看到運算元 → 直接輸出。
2. 看到 operator → 看 stack 頂端（最近還沒處理的 operator）：只要頂端的**比較優先或一樣優先**，就 pop 出去當輸出（這是 while，可能 pop 很多次）；最後把新來的 push。
3. 掃完，把 stack 裡剩下的全部 pop 出來。

核心就三行：新來的很優先，就直接壓在所有人上面；不太優先，就先把前面比較急的債還了，通通 pop 出去，最後再把自己壓上去。新來的若比頂端優先（像 * 遇到頂端是 +），就像要插隊的快車，直接壓上去。

> **例題** `A / B − C + D * E − A * C`

| 讀到 | 動作 | stack（底→頂） | 輸出累積 |
|---|---|---|---|
| A | 輸出 | 空 | A |
| / | stack 空，push | / | A |
| B | 輸出 | / | A B |
| − | 頂端 / 較優先 → pop；push − | − | A B / |
| C | 輸出 | − | A B / C |
| + | 頂端 − 同優先 → pop；push + | + | A B / C − |
| D | 輸出 | + | A B / C − D |
| * | 頂端 + 較不優先 → 直接 push | + * | A B / C − D |
| E | 輸出 | + * | A B / C − D E |
| − | pop *；頂端 + 同優先 → pop；push − | − | A B / C − D E * + |
| A | 輸出 | − | A B / C − D E * + A |
| * | 頂端 − 較不優先 → push | − * | A B / C − D E * + A |
| C | 輸出 | − * | A B / C − D E * + A C |
| 結束 | pop *、pop − | 空 | A B / C − D E * + A C * − |

結果與手動法一樣。

> **陷阱** 常見錯誤：把同優先的 operator 留在 stack 不 pop，就變成右邊先算（右結合），答案會錯。

### ISP 與 ICP
寫成程式時，每個 operator 有兩個 priority：

- **ISP（in-stack priority）**：在 stack 裡時的 priority。
- **ICP（incoming priority）**：剛讀進來時的 priority。

設 stack 頂端的 operator 為 y，新讀到的為 x：

> **重點** 只要 **ISP(y) ≤ ICP(x)**，就把 y pop 出來輸出；一直檢查到不成立，再把 x push 進去。（這張表**數字越小越優先**。）

Priority table：

| Operator | ISP | ICP |
|---|---|---|
| *、/、%（mod） | 2 | 2 |
| +、− | 3 | 3 |
| (（左括號） | 8（最低） | 0（最高） |
| #（stack 底） | 8 | — |

乘、除、mod 是 2，加減是 3，所以先乘除後加減。

> **陷阱** 「higher priority」是比較重要，對應表裡比較**小**的數字；數字大（larger）反而是 low priority，不要搞混。另外有些課本（如 C 版）的表是數字越大越優先，規則就反過來寫成 isp ≥ icp 才 pop，考試要看清楚用哪一種表。

課本 Program 3.19 的邏輯：

```cpp
void Postfix(Expression e)
{   // 輸出 infix 式子 e 的 postfix；e 的最後一個 token 是 '#'
    Stack<Token> stack;
    stack.Add('#');                         // '#' 墊在 stack 最底下
    for (Token x = NextToken(e); x != '#'; x = NextToken(e))
        if (x is an operand) cout << x;
        else if (x == ')') {                // pop 到左括號為止
            for (; stack.Top() != '('; stack.Pop())
                cout << stack.Top();
            stack.Pop();                    // 丟掉 '('
        }
        else {                              // x 是 operator
            for (; isp(stack.Top()) <= icp(x); stack.Pop())
                cout << stack.Top();
            stack.Add(x);
        }
    // 讀到結尾：把 '#' 以上的 operator 全部輸出
    for (; stack.Top() != '#'; stack.Pop())
        cout << stack.Top();
    cout << endl;
}
```

ISP(#) = 8 比任何 operator 的 ICP 都大，所以 # 永遠不會被 pop 出去，剛好當底。

### 例題：A + B * C

| 讀到 | 判斷 | stack（底→頂） | 輸出累積 |
|---|---|---|---|
| A | 運算元，輸出 | 空 | A |
| + | stack 空，push | + | A |
| B | 輸出 | + | A B |
| * | ISP(+) = 3 ≤ ICP(*) = 2？不成立 → push | + * | A B |
| C | 輸出 | + * | A B C |
| # | pop 全部：先 * 再 + | 空 | A B C * + |

結果 **A B C * +**。

### 例題：A * B + C

| 讀到 | 判斷 | stack（底→頂） | 輸出累積 |
|---|---|---|---|
| A | 輸出 | 空 | A |
| * | stack 空，push | * | A |
| B | 輸出 | * | A B |
| + | ISP(*) = 2 ≤ ICP(+) = 3 成立 → pop *；再 push + | + | A B * |
| C | 輸出 | + | A B * C |
| # | pop + | 空 | A B * C + |

結果 **A B * C +**。+ 的數字比較大，代表比較不優先，所以乘要先出來；若直接把 + 壓上去就違反先乘除後加減。

> **觀念** 兩種 stack 要分清：轉換用的 stack 放 **operator**；Eval 求值用的 stack 放**數字（運算元）**。

### 括號：左括號的兩種優先序
括號是最高優先序：左括號右邊的要先通通算完，stack 裡的才能出來。

> **例題** `3 * (5 + 7)`

| 讀到 | 動作 | stack（底→頂） | 輸出累積 |
|---|---|---|---|
| 3 | 輸出 | 空 | 3 |
| * | push | * | 3 |
| ( | 一律 push，壓住下面的 * | * ( | 3 |
| 5 | 輸出 | * ( | 3 5 |
| + | 頂端是 (，不擋人 → push | * ( + | 3 5 |
| 7 | 輸出 | * ( + | 3 5 7 |
| ) | pop 到 ( 為止：輸出 +，丟掉 ( | * | 3 5 7 + |
| 結束 | pop * | 空 | 3 5 7 + * |

左括號很特殊：在 stack 裡一夫當關，下面的通通不准出來；可是還沒進 stack 的運算子都比它優先，可以一直壓上去。也就是說它**比 stack 外的都大**（一定 push），**進了 stack 後比誰都小**（任何運算子都能壓在它上面）。能救它出來的只有右括號——這正是 stack 的第一個演算法：括號配對。括號不會出現在 postfix 裡。

對應到 priority table：左括號 ICP = 0（最高，讀到一定 push），ISP = 8（最低，進去後不擋人）。

> **陷阱** 左括號有兩種優先序：在 stack 外最高、在 stack 內最低；只有右括號能把它 pop 出來。

### 例題：A * (B + C) * D
兩個乘號分別叫 *₁、*₂。

| 讀到 | 判斷 | stack（底→頂） | 輸出累積 |
|---|---|---|---|
| A | 輸出 | 空 | A |
| *₁ | stack 空，push | *₁ | A |
| ( | ICP = 0，一律 push | *₁ ( | A |
| B | 輸出 | *₁ ( | A B |
| + | ISP(() = 8 ≤ ICP(+) = 3？不成立 → push | *₁ ( + | A B |
| C | 輸出 | *₁ ( + | A B C |
| ) | pop 到 ( 為止：輸出 +，丟掉 ( | *₁ | A B C + |
| *₂ | ISP(*₁) = 2 ≤ ICP(*₂) = 2 成立 → pop *₁；push *₂ | *₂ | A B C + *₁ |
| D | 輸出 | *₂ | A B C + * D |
| # | pop *₂ | 空 | A B C + * D * |

結果 **A B C + * D ***。同級先來先算（先 pop *₁ 再 push *₂），就是左結合。

### 延伸：結合性、unary、ternary
上面的基本款適用於：

- **Binary operator**：兩個運算元，運算子在中間。
- **Left associative（左結合）**：一樣重要時左邊先算，所以相等時 stack 裡的可以出來。`A − B − C` → `A B − C −`。

有些 operator 是 **right associative（右結合）**：一樣優先時右邊先算，像次方 `A ^ B ^ C` 要先算 B ^ C。這時新來的跟頂端一樣大，頂端的**不能**出來，新的要壓上去等後面再說（規則變成頂端優先序「嚴格較高」才 pop）。

> **例題** `A ^ B ^ C`（^ 右結合）

| 讀到 | 動作 | stack（底→頂） | 輸出累積 |
|---|---|---|---|
| A | 輸出 | 空 | A |
| ^ | push | ^ | A |
| B | 輸出 | ^ | A B |
| ^ | 同優先、右結合 → 不 pop，push | ^ ^ | A B |
| C | 輸出 | ^ ^ | A B C |
| 結束 | pop、pop | 空 | A B C ^ ^ |

對照 `A − B − C`：

| 讀到 | 動作 | stack（底→頂） | 輸出累積 |
|---|---|---|---|
| A | 輸出 | 空 | A |
| − | push | − | A |
| B | 輸出 | − | A B |
| − | 同優先、左結合 → pop，再 push | − | A B − |
| C | 輸出 | − | A B − C |
| 結束 | pop | 空 | A B − C − |

Unary（接一個數字）與 ternary（接三個）概念類似：數字先出，operator 等意念完整、比過優先序再出。比較麻煩的是 C 語言裡打一個減號，到底是「減」還是「負」？像 `5 * −3`，這個架構沒辦法乾淨處理，需要特殊處理。

## 兩個 stack 合起來就是計算機
- 轉換時用 **operator stack**：放將要處理、但還沒處理的動作，頂端是最接近、最快要處理的那個，等該處理時再拿出來（像牛在反芻）。
- 求值時用 **operand stack**：計算暫存區，像計算機的 memory，只是一層層疊起來。

兩個 stack 結合起來，基本上就是一台計算機。在搜尋框打 `3 × 5 + 5566 − 126` 也會算給你：

1. 把 infix 翻成 postfix：

| 讀到 | 動作 | operator stack | 輸出累積 |
|---|---|---|---|
| 3 | 輸出 | 空 | 3 |
| × | push | × | 3 |
| 5 | 輸出 | × | 3 5 |
| + | × 較優先 → pop；push + | + | 3 5 × |
| 5566 | 輸出 | + | 3 5 × 5566 |
| − | + 同優先 → pop；push − | − | 3 5 × 5566 + |
| 126 | 輸出 | − | 3 5 × 5566 + 126 |
| 結束 | pop − | 空 | 3 5 × 5566 + 126 − |

2. 用 postfix evaluator 算：

| 讀到 | 動作 | operand stack |
|---|---|---|
| 3 | push | 3 |
| 5 | push | 3 5 |
| × | 3 × 5 = 15 | 15 |
| 5566 | push | 15 5566 |
| + | 15 + 5566 = 5581 | 5581 |
| 126 | push | 5581 126 |
| − | 5581 − 126 = 5455 | 5455 |

答案 **5455**。

### 整合三件事：一個簡單計算機
1. **Parentheses matching**：右括號救出左括號。
2. **運算優先權**：operator 進 stack 前，看看裡面有沒有比較優先的，有就叫它先出來；左括號的優先權最特殊（比 stack 外的都優先、比 stack 裡的都不優先）。
3. **Operand stack 求值**：暫存已讀到或算完、但還沒用到的數字。

> **例題** `3 * (5 + 7)` 先轉成 `3 5 7 + *`，再求值：

| 讀到 | 動作 | operand stack |
|---|---|---|
| 3 | push | 3 |
| 5 | push | 3 5 |
| 7 | push | 3 5 7 |
| + | 5 + 7 = 12 | 3 12 |
| * | 3 × 12 = 36 | 36 |

得到 36，這就是具體而微的四則運算計算機。真正的 compiler 不會只為運算式寫這種方法，但從程式碼建立語意時也用到這類 stack 做法，學 compiler 會看到這些概念被擴充成更複雜的 routine。

### 問答：為什麼要學 stack 版的轉換
問：infix to postfix 的 stack 方法比較好嗎？
答：先問跟什麼比。跟 human algorithm（加括號、轉換、拔括號）比，人好懂；但要電腦把括號插對地方、還可能 multiple pass，寫起來相當困難。教 stack 版有兩個原因：

- Stack 讓我們設計出有巧思的演算法，自然處理 one-pass 的情況：輸入只讀一次時，常要把東西暫存，而且先處理最接近的那筆，stack 就非常有用。
- Compiler 裡很多概念也用 stack：有時自己弄一個，有時透過 recursive call，等於用了 system stack。

老實說，infix to postfix 現在比較是教育性質的演算法，很少要自己寫計算機，但很適合用來認識 stack 能做什麼。

### 補充：寫程式作業時的實際考量
- 演算法有一個 criterion 叫 **effectiveness**：要能說服人它在一般電腦上執行得了，所以要考慮實體電腦的限制（整數範圍、記憶體大小）。
- 每次查詢都重讀一次檔案會很慢；大量資料不見得全部需要，合理讀進來、用基本資料結構存、適度排序。
- Compiler 只檢查文法，不會告訴你執行時間；要用不同大小的資料實際測試來估算（以 wall time 計）。
- 還沒學到的更快排序，可以直接呼叫 C/C++ library；只用 binary search 配 selection sort 處理大量資料會太慢。

## Queue：排隊

Queue（佇列）就是「排隊」：排隊買口罩、去郵局、買可麗餅，先來的站前面，後來的排後面。搶票系統、選課系統背後都需要這個排隊的概念。和 stack 相比，queue 的概念更直覺。

### FIFO 與 front、rear

Queue 的特性是 **First In First Out（FIFO，先進先出）**：第一個來的，第一個出去。對照 stack 的 Last In First Out（LIFO）。

為了做到 FIFO，queue 需要兩個變數：

- **front**：指著隊伍最前面（排第一的人）。
- **rear**：指著隊伍的尾巴。

> **例題** 依序加進 A、B、C、D，再拿出一個。

```
加入 A、B、C、D：   A  B  C  D
                   ↑        ↑
                 front     rear

拿一個出來 → 拿到 front 指的 A（最早進來的）
                   B  C  D
                   ↑     ↑
                 front  rear      （人數少一個；新來的一律從 rear 那頭加入）
```

> **陷阱** 這裡 front 直接指第一個元素；但課本環狀 queue 的慣例是 front 指「第一個元素的前一格」。做題前先看題目怎麼定義 front。

### Enqueue 與 dequeue

想像一個售票口：靠售票口那端是 front，隊伍另一頭是 rear。排前面的先買到票；印表機也一樣，先送進去的先印出來。

| 操作 | 意義 | 位置 |
|---|---|---|
| enqueue | 放進去（insert） | 只能 insert at rear（從後面放） |
| dequeue | 拿出來（remove） | 只能 remove from front（從前面拿，後面的人往前遞補） |
| front / peek | 只看排頭是誰，不拿走 | front |

Queue 最大的用途是「相對公平」：電腦裡要依照時間先後決定處理順序時，就用 queue。

### 應用：job scheduling 與 priority queue

作業系統常用 queue 做 **job scheduling（工作排程）**：電腦同時有一堆 job（J1、J2、J3…）等著 CPU。最簡單（也最笨）的方法是誰先進來誰先做：先開 Word、再開 PowerPoint、再開 PDF，進 queue 的順序就是執行順序。

但 FIFO 不一定好。排第一的人一口氣買 50 個可麗餅，後面的人可能站一小時都等不到。解法是設定 **priority（優先權）**：後面那位十分鐘後要上課，priority 高，先服務；第一個人沒急事，可以等。依 priority 而不是到達順序決定誰先出來，就是之後會學的 **priority queue（優先佇列）**。

### Queue 的 ADT

Queue 的 ADT 和 stack 很像，看起來都是一個容器。差別在 stack 只要記一個 top，queue 要記 **front 和 rear** 兩個位置。Member function 也幾乎一樣：`IsFull`、`IsEmpty`、加一個元素（Add / enqueue）、刪一個元素（Delete / dequeue），頂多參數有些調整。真正要動腦的是實作。

## 用 array 實作 queue

用 array 做的 stack 和 queue，容量都固定為 `MaxSize`，所以 **add 前要檢查 full，delete 前要檢查 empty**。

### 線性 queue 的「假滿」

最直接的線性 queue，`IsFull` 這樣判斷：

```cpp
bool IsFull() { return rear == MaxSize - 1; }   // rear 走到最後一格就說滿了
```

> **例題** MaxSize = 4，依序加入 A、B、C、D，刪掉 A，再加 E。（這裡用課本線性 queue 的慣例：front 指第一個元素的前一格，一開始 front = rear = −1。）

```
index:        0   1   2   3
加入 A~D:   [ A | B | C | D ]   front = -1, rear = 3 = MaxSize-1 → 滿（正確）
刪除 A:     [   | B | C | D ]   front = 0,  rear = 3
加入 E?     IsFull 只看 rear：rear 仍是 3 = MaxSize-1 → 回報「滿了」
```

第 0 格明明空著，卻被判成滿，這就是誤判，常叫做 **「假滿」**。

> **陷阱** 4 格的陣列 index 是 0～3，滿的時候 rear = MaxSize − 1 = 3，不是 4。

**解法一：data movement（資料搬移）**。把 B、C、D 各往前搬一格，front、rear 跟著調整：

```
搬移前:     [   | B | C | D ]   front = 0,  rear = 3
搬移後:     [ B | C | D |   ]   front = -1, rear = 2
加入 E:     [ B | C | D | E ]   front = -1, rear = 3
```

這樣 `IsFull` 不用改，但要另外寫一個搬資料的 procedure，而且每搬一次要花和元素個數成正比的時間。

**解法二（思考題）**：不搬資料，直接改寫 `IsFull` 的判斷方式（例如另外記錄元素個數）。解法不只一種，值得多想幾種。課本採用的則是另一種實作：**circular queue（環狀佇列）**。

### Circular array：首尾相接

Circular array 就是把 array 頭尾接起來用。例如一個 array 有 0 號到 9 號共 10 格：它有一個抽象的開頭（例如 2 號），抽象的結尾就是開頭的前一格（1 號）。從 2 號開始放，放到 9 號再繞回 0 號、1 號，10 格可以循環著一直用。

```
抽象開頭 = 2，抽象結尾 = 1
index:  0  1 | 2  3  4  5  6  7  8  9
        ←──┘   放的順序：2→3→…→9→0→1
```

環狀只是示意圖，實際上它還是一個連續的 array；讓 index 繞圈的工具是 `%`（取餘數）：5 的下一格是 `(5 + 1) % 6 = 0`。

另外，queue 也可以用 linked list 或 circular list 實作，就沒有容量上限的問題。

### Circular queue 的 front、rear 規則

課本慣例：

- **front 指向第一個元素的「前一格」**（那一格永遠空著）。
- **rear 指向最後一個元素**。
- 一開始 `front = rear = 0`，全空。

> **例題** MaxSize = 6（index 0～5），依序 add J1～J5，接著 delete J1～J4，再 add J6～J9。逐步畫出 array 與 front、rear。（`_` 表示邏輯上是空的格子。）

```
步驟            index:  0    1    2    3    4    5     front rear
初始                   [ _ |  _ |  _ |  _ |  _ |  _ ]    0     0   front==rear → empty
add J1                 [ _ | J1 |  _ |  _ |  _ |  _ ]    0     1
add J2                 [ _ | J1 | J2 |  _ |  _ |  _ ]    0     2
add J3                 [ _ | J1 | J2 | J3 |  _ |  _ ]    0     3   J1 在 [1]，front 停在 [0]
add J4                 [ _ | J1 | J2 | J3 | J4 |  _ ]    0     4
add J5                 [ _ | J1 | J2 | J3 | J4 | J5 ]    0     5   (5+1)%6 = 0 == front → full
```

這時就算 full 了，可是第 0 格明明空著，為什麼不塞？假設硬把 J6 塞進去：

```
硬塞 J6（錯誤示範）     [J6 | J1 | J2 | J3 | J4 | J5 ]    0     0   front==rear
```

front = 0、rear = 0，和一開始全空的狀態一模一樣，光看這兩個變數分不出是空還是滿。所以**故意留一格不用**，目的就是區分 empty 和 full：6 格的 queue 最多只放 5 個。

接著從「J1～J5、front = 0、rear = 5」繼續：

```
步驟            index:  0    1    2    3    4    5     front rear
delete J1              [ _ |  _ | J2 | J3 | J4 | J5 ]    1     5
delete J2              [ _ |  _ |  _ | J3 | J4 | J5 ]    2     5
delete J3              [ _ |  _ |  _ |  _ | J4 | J5 ]    3     5
delete J4              [ _ |  _ |  _ |  _ |  _ | J5 ]    4     5
add J6  rear=(5+1)%6=0 [J6 |  _ |  _ |  _ |  _ | J5 ]    4     0   rear 繞回 0
add J7                 [J6 | J7 |  _ |  _ |  _ | J5 ]    4     1
add J8                 [J6 | J7 | J8 |  _ |  _ | J5 ]    4     2
add J9                 [J6 | J7 | J8 | J9 |  _ | J5 ]    4     3   (3+1)%6 = 4 == front → full
```

front = 4、rear = 3，中間隔著一個空格（[4]），這也是 full。佇列裡由前到後是 J5、J6、J7、J8、J9，共 5 個。

> **重點** Circular queue 的兩個條件一定要背：
> - **Full**：`(rear + 1) % MaxSize == front`（rear 再往前一格就撞到 front）
> - **Empty**：`front == rear`
> - 為了分辨空和滿，犧牲一格：大小 MaxSize 的陣列最多放 **MaxSize − 1** 個元素。
> - 元素個數：`(rear - front + MaxSize) % MaxSize`。

### Circular queue 的 Add 與 Delete

```cpp
template <class KeyType>
void Queue<KeyType>::Add(const KeyType& x)   // 參數 x 是要加入的元素
{
    int newRear = (rear + 1) % MaxSize;      // rear 順時針移一格，就是新元素的位置
    if (front == newRear) { QueueFull(); return; }
    rear = newRear;                          // 不滿才真的移動 rear
    queue[rear] = x;                         // 再把 x 放進去
    // 也可以合成一行：queue[rear = newRear] = x;
}

template <class KeyType>
KeyType* Queue<KeyType>::Delete(KeyType& x)
{
    if (front == rear) { QueueEmpty(); return 0; }   // empty：什麼都不做，直接 return
    front = (front + 1) % MaxSize;                   // 先把 front 往前移一格
    x = queue[front];                                // 再取出 queue[front]
    return &x;
}
```

> **陷阱** Add 一定要帶參數：要加入的元素 x（型別 KeyType）。漏寫這個參數是常見錯誤。

> **例題** MaxSize = 6，目前 queue 裡有 J1（[1]）、J2（[2]），front = 0、rear = 2。依序執行 Add(J3)、Delete、Add(J4)、Add(J5)、Add(J6)、Add(J7)。

```
操作       計算                                   index: 0    1    2    3    4    5     front rear
起始                                                    [ _ | J1 | J2 |  _ |  _ |  _ ]    0     2
Add(J3)    newRear=(2+1)%6=3，front=0≠3 → 放          [ _ | J1 | J2 | J3 |  _ |  _ ]    0     3
Delete     front≠rear；front=(0+1)%6=1；回傳 J1        [ _ |  _ | J2 | J3 |  _ |  _ ]    1     3
Add(J4)    newRear=4≠1 → 放                            [ _ |  _ | J2 | J3 | J4 |  _ ]    1     4
Add(J5)    newRear=5≠1 → 放                            [ _ |  _ | J2 | J3 | J4 | J5 ]    1     5
Add(J6)    newRear=(5+1)%6=0≠1 → 放，rear 繞回 0       [J6 |  _ | J2 | J3 | J4 | J5 ]    1     0
Add(J7)    newRear=(0+1)%6=1 == front → full，不放
```

最後 queue 裡是 J2～J6 共 5 個，空間用得滿，也不會像線性 queue 那樣誤判。

> **陷阱** Delete 時 front 指的是**空格**，不是第一個元素，所以一定是「先移、再取」：先 `front = (front + 1) % MaxSize`，再取 `queue[front]`。順序反了（先取再移）會取到空格。

## 迷宮問題（一）：有沒有解

Stack 和 queue 都能上場的經典題：走迷宮。把二維迷宮簡化成格子點，每格只記錄上下左右能不能走（哪邊通、哪邊有牆）。問題是：能不能找一個演算法，從迷宮的入口走到出口？

先把問題再縮小：不問路線，只問**到底有沒有路出得來**，也就是迷宮有沒有解（例如某處被封死就沒有解）。

### Recursion 版：一路長下去

想像你站在 (i, j)，迷宮裡有些格子走過了，有些還沒。

```
maze(i, j):
    把 (i, j) 標成「走過」          // 不標的話會在走過的地方一直繞圈
    for 每個還沒走過、走得到的鄰居 (k, l):
        if (k, l) 是出口:
            有解！衝出去
        maze(k, l)                  // 假裝從 (k, l) 出發，遞迴看能不能到出口
    return                          // 所有鄰居都試過：這裡是死路，退回上一層
```

每呼叫一次 `maze(i, j)`，system stack 就多一層。迴圈會把每一條路都試過；全部都是死路，就能確定這個迷宮沒有解。Recursion 一路長下去；找到出口時，system stack 上一層一層連起來剛好是一條路。某條路走不通，recursion 自然把你帶回原來的地方，再試第二條、第三條路。

### 自己的 stack 當記事本

Recursion 其實偷偷多花了空間：系統給你的 **system stack**。

> **比喻** 每次 function 呼叫，就是多拿一張計算紙，壓在 system stack 最上面。

與其讓系統拿計算紙，不如用自己的 stack，存「**還沒探索過的點**」，一開始只有起點。

```
stack ← { 起點 }，把起點標成 to-do
while stack 不空:
    (i, j) ← pop                     // 從記事本拿一筆，想像走過去拜訪它（visit）
    for 每個走得到、還不是 to-do 的鄰居 (k, l):
        if (k, l) 是出口: 有解！
        把 (k, l) 標成 to-do         // 等一下會看，也不希望別處再把它放進來
        push (k, l)                  // 寫進記事本
回報：沒有解
```

> **比喻** 這像一本計畫本：我在 (i, j)，看到一堆可能能走的 (k, l)，先記在記事本上；下一輪從記事本拿一個出來，走過去拜訪它，再把它的新鄰居記上去。

兩個版本比一下：

| | recursion 版 | 自己的 stack 版 |
|---|---|---|
| stack 裡存什麼 | 一條正在從起點探索的**路徑** | 一堆計畫要看的**位置**（待探索的點） |
| 誰管理 | 系統（system stack） | 自己 |
| 行為 | 一路往深處走，走不通才退回 | 每次拿最新寫上去的那筆，所以也是一路往深處走 |

結論：寫 recursion 本來就偷偷在用 stack；想自己比較好控制，就自己寫一個 stack，一樣回答得出有沒有出口。

> **陷阱** Recursive 版的 system stack 存的是「一條路徑」，自訂 stack 存的是「待探索的點」，兩者內容不同。

### 為什麼要標 to-do：重複的 entry

問：stack 版為什麼要把 (k, l) 標成 to-do，只標 visited 不行嗎？

答：有些迷宮裡，同一格可以用兩種方式走到，例如可以從下面走上來，也可以從右邊走過來。

- **visit**：真正走到那格上面、開始派出它的鄰居。
- **to-do**：已經寫進記事本，但還沒被 visit。

如果只記 visited、不標 to-do：從一條路過來時把這格寫進記事本；它還沒被 visit，等一下從另一條路過來，又覺得它是鄰居，就把同一格**再寫一次**。記事本裡出現重複的位置，重複的那筆 pop 出來時必須檢查是否已 visited，是的話直接跳過，等於白拿一次。萬一沒檢查好，同一格走第二次又把鄰居堆上去，多一堆無謂的計算；有環的迷宮甚至會一直繞圈。

有標 to-do 的話，一寫進記事本就做記號，同一格只會進來一次，push 次數少，也沒有重複。

> **陷阱** visited（真的走到並展開鄰居）和 to-do（已寫進記事本但還沒拜訪）是不同狀態；漏了 to-do 標記會產生重複 entry。

## 迷宮問題（二）：程式碼等級的實作

同一個問題寫到程式碼等級。

### 迷宮的表示與 backtrack

- 迷宮左上角是入口，右下角是出口。
- 用一個 **2D array** 表示：`0` 代表可以走，`1` 代表牆或障礙物。
- 除了上下左右，斜著也能走，共**八個方向**：北 N、東北 NE、東 E、東南 SE、南 S、西南 SW、西 W、西北 NW。
- 找到的 path 不一定最短，路也可能不只一條，結果取決於程式怎麼設計。
- 走進死路怎麼辦？往回走一步，這叫 **backtrack（回溯）**。

要記得走過哪些路、走不通還能退回去，用的資料結構就是 **stack**：往回走，就是把最後記下的那一步 pop 出來回到上一格，正是 last in first out。

### move 陣列（offset）

往某方向走一步，只是對目前的 row、col 做 ±1：往北是上一列、同一行 `(row − 1, col)`；往東北是上一列、往右一行 `(row − 1, col + 1)`。

這種位移叫 **offset**。定義一個型別記垂直位移 `vert` 和水平位移 `horiz`，八個方向存成大小 8 的 array `move`。index 就是方向 `dir`（0～7），從北開始依**順時針**編號：

| dir | 方向 | move[dir] = (vert, horiz) |
|---|---|---|
| 0 | N 北 | (−1, 0) |
| 1 | NE 東北 | (−1, 1) |
| 2 | E 東 | (0, 1) |
| 3 | SE 東南 | (1, 1) |
| 4 | S 南 | (1, 0) |
| 5 | SW 西南 | (1, −1) |
| 6 | W 西 | (0, −1) |
| 7 | NW 西北 | (−1, −1) |

```cpp
struct offsets { int vert, horiz; };
offsets move[8] = { {-1,0}, {-1,1}, {0,1}, {1,1}, {1,0}, {1,-1}, {0,-1}, {-1,-1} };

// 從 (i, j) 往方向 d 走到的下一格 (g, h)
int g = i + move[d].vert;
int h = j + move[d].horiz;
```

### Stack 裡存 (row, col, dir)

Stack 裡除了位置的 row、col，還要記方向。原因：假設某格先試北，不通；再試東北，走下去發現是死路，又退回這格。退回來時北和東北都試過了，不必再試，直接從東（dir = 2）開始。所以 stack 每格存 **(row, col, dir)**：位置加上「下一個要試的方向」。

### 外圍包一圈 1

從入口往北試，北邊根本在迷宮外面。實作時把 array 開大一點，外面多一圈 boundary，這一圈**全部是 1**（牆）。

- 整個 array 從 m × p 變成 **(m + 2) × (p + 2)**。
- 原本入口在 (0, 0)，加了外圈後 index 全部加 1，**入口變成 (1, 1)**，出口是 **(m, p)**。
- 走到邊上照樣試北、東北、東……碰到外圍的 1 就是不通，換下一個方向。

> **重點** 外圍包一圈 1，就不用另外判斷現在是在上、下、左、右哪個邊界，八個方向的程式完全共用。為邊界特別寫判斷，程式會又臭又長。

### maze 與 mark 兩個 array

移動到 (g, h) 前要查兩個 array：

- `maze[g][h]`：固定的地圖，1 不能走、0 可以走。
- `mark[g][h]`：這格走過沒有，走過就設成 1。大小和 maze 一樣，但會隨著走動一直變。

能走過去的唯一條件：**`maze[g][h] == 0` 而且 `mark[g][h] == 0`**。條件成立時：

1. `mark[g][h] = 1`（記得這格走過了）。
2. 把 (i, j) 和「下一個要試的方向 d + 1」push 進 stack（之後退回來就從那個方向接著試）。
3. 真的移過去：`i = g; j = h; d = 0`（從北重新開始試）。

> **陷阱** maze 存牆／路，mark 存「是否走過」，是兩個不同的 array。只檢查 maze 不檢查 mark，老鼠會在迷宮裡一直繞圈。

整理：**stack** 記走過的 path，**maze** 記地圖，**mark** 記有沒有走過，**move** 只在算下一步時用到。

### Pseudocode

```
輸入：maze（含外圍一圈 1）、入口 (1, 1)、出口 (m, p)
初始化：mark[1][1] = 1；stack 清空後 push (1, 1, N)    // 這步很重要：第一次進 while 時 stack 不是空的
while stack 不是 empty:
    pop 出 (i, j, d)
    while d < 8:                                         // 還有方向沒試過
        (g, h) = (i + move[d].vert, j + move[d].horiz)
        if (g, h) == (m, p): 成功，輸出路徑
        if maze[g][h] == 0 且 mark[g][h] == 0:
            mark[g][h] = 1
            push (i, j, d + 1)
            (i, j, d) = (g, h, N)                        // 移過去，從北開始
        else:
            d = d + 1                                    // 換下一個方向
輸出：沒有路
```

### 程式

```cpp
void Path(const int m, const int p)
// 迷宮 maze[0..m+1][0..p+1]，外圍一圈都是 1；入口 (1,1)，出口 (m,p)
{
    mark[1][1] = 1;
    Stack<Items> stack(m * p);          // 有 mark，每格最多進 stack 一次，大小約 m×p 就夠
    Items temp(1, 1, N);                // 入口與起始方向 N（= 0）
    stack.Push(temp);

    while (!stack.IsEmpty()) {
        temp = stack.Top();  stack.Pop();
        int i = temp.x, j = temp.y, d = temp.dir;
        while (d < 8) {                 // 0~7 一個方向一個方向試
            int g = i + move[d].vert;
            int h = j + move[d].horiz;
            if (g == m && h == p) {     // 到出口：輸出路徑
                cout << stack;          // stack 裡是走過的路徑
                cout << i << " " << j << endl;
                cout << m << " " << p << endl;
                return;
            }
            if (!maze[g][h] && !mark[g][h]) {   // 可以走而且沒走過
                mark[g][h] = 1;
                temp.x = i;  temp.y = j;  temp.dir = d + 1;
                stack.Push(temp);       // 記下 (i, j) 與下一個要試的方向
                i = g;  j = h;  d = N;  // 移過去，從北開始
            }
            else d++;                   // 換方向：d = 0 北試過了 → 1 東北
        }
    }
    cout << "No path in maze." << endl;
}
```

程式和 pseudocode 幾乎一樣。寫作業的建議：除非已經很熟練，先寫 pseudocode 確認方法可行，就成功一半了，剩下是改寫成詳細的程式。

> **觀念** 寫 pseudocode 訓練高層邏輯的完整性，寫 code 訓練細心；code 像在算數學，pseudocode 像在想演算法。練習時可以在白紙、白板上寫程式並自己模擬，比只上機、仰賴 compiler 更能理清邏輯。

### 例題：追蹤一個小迷宮

> **例題** 內部 3 × 4 的迷宮（m = 3，p = 4），入口 (1, 1)，出口 (3, 4)。方向順序 N、NE、E、SE、S、SW、W、NW（0～7）。逐步追蹤 stack。

加上外圍一圈 1 之後是 5 × 6 的 array：

```
        col: 0  1  2  3  4  5
row 0:       1  1  1  1  1  1
row 1:       1  0  0  0  0  1      入口 (1,1)
row 2:       1  0  1  1  1  1
row 3:       1  1  0  0  0  1      出口 (3,4)
row 4:       1  1  1  1  1  1
```

| 步驟 | 目前 (i, j, d) | 試方向的過程 | 動作 | stack（底 → 頂） |
|---|---|---|---|---|
| 0 | — | — | mark(1,1)，push (1,1,0) | (1,1,0) |
| 1 | pop (1,1,0) | N (0,1)=1、NE (0,2)=1、E (1,2)=0 可走 | push (1,1,3)，移到 (1,2) | (1,1,3) |
| 2 | (1,2,0) | N、NE 是外圍 1；E (1,3)=0 可走 | push (1,2,3)，移到 (1,3) | (1,1,3) (1,2,3) |
| 3 | (1,3,0) | N、NE 外圍；E (1,4)=0 可走 | push (1,3,3)，移到 (1,4) | (1,1,3) (1,2,3) (1,3,3) |
| 4 | (1,4,0) | N、NE、E、SE 外圍；S (2,4)=1；SW (2,3)=1；W (1,3) 已 mark；NW 外圍 | d = 8，死路 | (1,1,3) (1,2,3) (1,3,3) |
| 5 | pop (1,3,3) | SE (2,4)=1；S (2,3)=1；SW (2,2)=1；W (1,2) 已 mark；NW 外圍 | d = 8，死路 | (1,1,3) (1,2,3) |
| 6 | pop (1,2,3) | SE (2,3)=1；S (2,2)=1；SW (2,1)=0 可走 | push (1,2,6)，移到 (2,1) | (1,1,3) (1,2,6) |
| 7 | (2,1,0) | N (1,1) 已 mark；NE (1,2) 已 mark；E (2,2)=1；SE (3,2)=0 可走 | push (2,1,4)，移到 (3,2) | (1,1,3) (1,2,6) (2,1,4) |
| 8 | (3,2,0) | N (2,2)=1；NE (2,3)=1；E (3,3)=0 可走 | push (3,2,3)，移到 (3,3) | (1,1,3) (1,2,6) (2,1,4) (3,2,3) |
| 9 | (3,3,0) | N (2,3)=1；NE (2,4)=1；E (3,4) 是出口 | 成功 | |

輸出的路徑：stack 裡的 (1,1)、(1,2)、(2,1)、(3,2)，再加目前的 (3,3) 和出口 (3,4)：

```
(1,1) → (1,2) → (2,1) → (3,2) → (3,3) → (3,4)
```

注意步驟 4、5：(1,4) 和 (1,3) 是死路，pop 出來的 (1,3,3) 讓程式回到 (1,3) 並從 SE 接著試，不重試 N、NE、E，這就是 stack 存 dir 的用處；(1,3) 也試完後再 pop 回 (1,2)，(1,3) 從路徑上消失，這就是 backtrack。

### 試方向的順序與延伸考題

問：出口在右下角，為什麼每次都先往北試？

答：確實浪費，比較希望先往東、東南、南。試的順序可以自己定，**重點是規則要固定，而且要記得這格試過哪些方向**。程式不用改，只要把 move 重新編號（讓 move[0] 變成東）或直接改 offset 即可。逆時針也可以，只是出口在右下時會先試北、西北，離目的地越來越遠，多走很多冤枉路。

延伸考題：

1. 只有一個出口，怎麼走出**最短路徑**？
2. 更難：出口不一定在右下角，而且不只一個，怎麼找到**最近**的那個？要注意看起來近的出口路可能是堵住的。用 stack 也做得出來，但要乾淨地保證最近，答案是後面的 BFS。

> **陷阱** 用 stack 回溯（DFS）不管試方向的順序怎麼排，都**不保證最短**。要最短路徑，得改用 queue 一層一層往外擴（BFS），第一次走到出口時就是最短（每一步代價相同的前提下）。

## Container：換容器就換行為

把視角拉高：走迷宮其實只需要一本「記事本」，stack 只是其中一種。Stack 當記事本的特性是：**最後寫進去的，最先被探索下去**。

能當記事本、能裝東西的都叫 **container（容器）**。Array、linked list 都是容器，放進去、拿出來的方法不一樣，但整個演算法長得差不多。

> **比喻** 拿一個袋子當記事本：東西丟進去，每次隨便抽一格出來，看從那裡能不能走，鄰居再丟回袋子。這樣走迷宮像喝醉酒，這邊跌一下、那邊撞一下，叫 **random walk**，但最後也找得到路出去。

> **重點** 只要能「拿出一個、塞進一個」，放任何 container 演算法都能動：有解一定找到一個解，沒解一定回報沒解。但 container 不同，演算法的 behavior 就不同；有很多條路時，找到的那條也可能不一樣。

### 把記事本換成 queue

做法就是把 container 換成 queue，其他不動：

| | stack 版 | queue 版 |
|---|---|---|
| 拿出來 | pop | dequeue |
| 塞進去 | push | enqueue |
| 搜尋方式 | DFS | BFS |

差別就這樣。這像一個演算法範本：把裡面的細節換成不同的 restricted data structure，就變成不同的演算法。

> **例題** 一個迷宮抽象成下面的鄰居關係，比較 stack 版和 queue 版找到的路。

```
入口 的鄰居：A、B、C
A 的鄰居：AA、AB
AA 的鄰居：AAA
AAA 的鄰居：出口₁
B 的鄰居：出口₂
（C、AB 沒有新的鄰居）
```

### Stack 版：Depth First Search

```
記事本（stack，右邊是頂端）
放入口                      [入口]
pop 入口，push C、B、A       [C, B, A]
pop A，push AB、AA          [C, B, AB, AA]
pop AA，push AAA            [C, B, AB, AAA]
pop AAA → 鄰居是出口₁       找到！路徑：入口 → A → AA → AAA → 出口₁（4 步）
```

入口的鄰居 B、C 都還沒看，就已經深入到鄰居的鄰居的鄰居了。越深的鄰居一直被堆在最上面，所以總是先把深的地方看完，走到不能再走才退回淺的。這種搜尋叫 **Depth First Search（DFS，深度優先搜尋）**。有很多條路時，DFS 找到的是依某種順序（像字典順序）的第一條，不一定最短：這裡走了 4 步，出口₂ 其實只要 2 步。

### Queue 版：Breadth First Search

```
記事本（queue，左邊是 front）
放入口                      [入口]
dequeue 入口，enqueue A、B、C [A, B, C]
dequeue A，enqueue AA、AB    [B, C, AA, AB]
dequeue B → 鄰居是出口₂      找到！路徑：入口 → B → 出口₂（2 步）
```

Queue 版先處理完和入口距離 0 的，再處理距離 1、2、3、4 的，所以最先碰到的出口一定最近。這叫 **Breadth First Search（BFS，廣度優先搜尋）**：DFS 注重深度，BFS 注重廣度。

> **比喻** BFS 像同心圓，一層一層往外展開；也像疫調：先把第一層接觸者全部查完，才查第二層、第三層。DFS 則是追著一個人一路往下查。

> **陷阱** 「BFS 找到的是最短路徑」只在每一步代價都一樣（無權重）時成立；這也是前面「單一出口怎麼走最短路徑」那題的正解。DFS 找到的路不一定最短。

### Recursive 版也是 DFS

問：recursive 版是 DFS 嗎？自己寫 stack 的版本是 BFS 嗎？

答：recursive 版有 DFS 的行為：一路走到底，走不通才退回。用自己 stack 的版本**也是 DFS**；BFS 是 queue 版。但兩者記的東西不一樣：system stack 記的是一條正在走的路，自己的 stack 記的是一堆待探索的點。不過可以寫出某個 stack 版本，和 recursive 版做 exactly 一樣的 DFS。

### DFS 和 BFS 哪個快

先 define 目標：

- 目標是**最短的路**：queue（BFS）會給你最短的路。
- 目標是**比較快找到一條路**：和問題的特性很有關。

| 情況 | 誰快 |
|---|---|
| Stack 試的第一條路就通，但很深（例如 20 層） | Stack 直直衝到底就到；queue 要一層層轉到第 20 層 → **DFS 快** |
| 出口只要 3 步，卻在 stack 嘗試順序的最尾巴 | Queue 轉三層就出去；stack 還在深入、碰壁、退回 → **BFS 快** |

最壞情況兩者可能差不多：每格最多進記事本一次，都可能看遍整個迷宮。

如果每條路有不同長度，要找真正最短的路，就再換一種 container，例如 priority queue，這就是之後會學的 **Dijkstra** 演算法。

## 所有資料結構都是容器

最後把這一章的零件串成一張大圖。Data structure 本來就是拿來裝資料的，所以每一種都是 container。一般講 container 比較 general：同一個箱子能裝 integer、double，也能裝自訂的 structure（複數、甚至 polynomial）。Array、linked list、stack、queue 各有特別的性質，是因為需求不同，才設計出不一樣的容器。

接下來做兩件事：先從需求把這些容器串起來，再把共同的功能抽出來（抽象化）。

### Dense array

最熟悉的 C++ integer array，稱為 **dense array**（每格都排滿，相對於後面的 sparse array）。五個特性：

1. **Storage**：放 n 個就配 n 格，Θ(n)；除了資料本身幾乎沒有 overhead。
2. **Indexed access（random access）**：用編號直接讀或寫，如 `A[6]`。很快，因為 index 直接換成 address：開頭位址 + 6 × 每格大小，算一次就到，O(1)。
3. **Iterative access（sequential access）**：用 for 迴圈從頭跑到尾，用 pointer 或 index 都行。
4. **Max length 固定**：`int A[10]` 就只有 10 個櫃子，第 11 個放不下；要變大得另想辦法（如 extendable array）。
5. **Insertion／removal 要推擠**：要維持 dense（前面排滿不留空），已有 10 個要插到第 0 格，10 個都往後推，O(n)；刪掉第 1 個，後面 9 個要往前補。

> **比喻** Sequential access 像把冰箱每一格都打開看一次：不知道東西放哪格，就每格都看，看冰了什麼、冰多久。

Array 的著眼點是特性 2（fast random access）；為了插入刪除一直搬記憶體，又慢又容易寫錯。新目標因此出現：能不能讓 insertion 和 removal 快一點？

### Doubly linked list

新需求有兩個：知道位置時 constant time 放進、拿出，其他元素不動；還要 **dynamic max length**（記憶體夠就一直裝）。答案是 **doubly linked list**：每個 node 帶兩張「小紙條」，`prev` 記前一個、`next` 記下一個。

- 插入只要跟前後接起來，改 4 個指標，O(1)；前提是知道前面、後面是誰。
- 要用才配一個 node，不必先訂櫃子，dynamic max length 就有了。

| 特性 | dense array | doubly linked list |
|---|---|---|
| 1. storage | Θ(n)，幾乎無 overhead | Θ(n)，每個 node 多兩個指標的 overhead |
| 2. indexed access | O(1) | 硬要也行：給 index 100 就得從頭走 100 步，很少這樣用 |
| 3. iterative access | for 迴圈 | 順著 next 走：`p = p->next` |
| 4. max length | 固定 | dynamic |
| 5. insertion／removal | O(n)，要推擠 | O(1)（已知位置） |

兩者差在需求：linked list 在意 4 和 5，乾脆放棄 array 的強項 2。

> **陷阱** O(1) 插入刪除的前提是**手上已經有那個位置的指標**；只給 index 的話要先走過去，是 O(k)。

### Singly linked list

如果不在乎 removal、只在乎 insertion，就得到 **singly linked list**：node 只剩 data 和 next。

- 插入照樣 O(1)：新 node 先指向後面那個，再讓前一個的 next 指向它。
- 刪除麻煩了：要改前一個 node 的 next，但沒有 prev，只好從 head 再走一次找它，不是 O(1)。
- 好處是 **less overhead**：每個 node 少一張紙條、少幾個 byte，storage 仍是 Θ(n)。

Trade-off 就這一點：「插入、刪除都 constant」變成「只有插入 constant」，其他差不多。

> **觀念** 這次的講法和當初學各個結構的順序不同，像織布：先一個故事一個故事織，再換個方向織一遍，理解才完整。

### 延伸 1：any type → template

容器不一定要裝 integer，可以是 any type。C++ 用 **template**，型別先寫成 T，同一份 code 就能變成 `Array<int>`、`Array<double>` 或裝自訂 structure 的 `Array<Complex>`。機制是 compiler 幫你把 code 複製一份、把 T 換成真正的型別；你只要寫一次。

### 延伸 2：array + restricted access → stack

Array 本來任何編號都能存取。加一個限制：只准碰固定的地方（例如最尾巴），叫 **restricted access**。只在尾巴放（push 6、push 5），也只在尾巴拿（pop 拿走最後放進去的 5），就是 **stack**：first in last out，也就是 LIFO（後進先出），兩種說法同義。這也是 stack 最常見的實作：array 明明有 index，只讓你用最後一個號碼，等於把 array 退化成 stack。

### 延伸 3：circular list + restricted access → queue

Circular list（尾巴接回第一個）讓 iterative access 變成 **circular access**，像播放器的循環播放。再加 restricted access：一直繞，但只能在游標處動作，front 就是 rear 的下一個。從前面拿走最早來的 1，從後面放進新的 6（接在 rear 後面），就得到 **queue**：first in first out。

嚴格說 circular access 是從 iterative access 變來的；array 也能走訪，所以 array 也能做成 circular queue（就是前面的環狀佇列）。

### 延伸 4：sparse array

從 dense array 拉一條長線：像 `1 + 5x³ + 2x⁷` 很多格是 0，不想全存，就是 **sparse array**。它改的是特性 1：只存 non-zero，storage 從 Θ(n) 變成 **Θ(nnz)**（nnz = number of non-zero，非零項的個數）。

**實作一：ordered array**。按 index 排好（像 polynomial 依次方排，每項存成次方和係數）：

```
1 + 5x³ + 2x⁷  →  [(0,1), (3,5), (7,2)]     （次方, 係數），依次方排序
```

- Index access：有沒有 x³？係數多少？排好序可以 binary search，O(log nnz)。
- Iterative access：把所有 non-zero 項走一遍。
- Insertion／removal：底下是 array，長度某種程度固定；插入 `4x⁵` 為了保持排序，後面要往後搬，O(nnz)。

```
插入 4x⁵：[(0,1), (3,5), (7,2)] → [(0,1), (3,5), (5,4), (7,2)]   (7,2) 要往後搬
```

**實作二：ordered linked list**。一個 node 存一項，一樣 Θ(nnz) storage。

- Linked list 跳不到中間，不能 binary search，只能 sequential search，O(nnz)。
- 插入刪除不用搬資料，已知位置時改兩個指標，O(1)。

| sparse array 的實作 | 找某一項 | 插入／刪除 | storage |
|---|---|---|---|
| ordered array | O(log nnz)（binary search） | O(nnz)（搬資料） | Θ(nnz) |
| ordered linked list | O(nnz)（sequential search） | O(1)（已知位置） | Θ(nnz) |

> **重點** 這就是 **implementation trade-off**：要做的事一樣是 sparse array，實作不同，擅長的事就不同。要能自己整合：同一件事改用另一種實作，多了哪些好處、哪些壞處。

### Deque：兩頭都能進出

底下是一條 doubly linked list，head 在左、tail 在右：

```
head                     tail
 3  ⇄  1  ⇄  4  ⇄  2
尾巴放進 9、頭拿出 3     → 一端進另一端出：queue
頭放進 5、頭拿出 5       → 同一端進出：stack
頭尾都能放、都能拿       → deque
```

頭尾都能 push／pop 的叫 **deque**（念 deck，double-ended queue）。它也是 doubly linked list 的一種 restricted access，天生需要兩端，所以最常用 doubly linked list 來做。課本也常用頭尾都能動的 circular array 實作；C++ STL 的 deque 又是另一種做法：用一張指標表指向一塊塊固定大小的陣列，所以 random access 也是 O(1)，不是 linked list。以目前來說 deque 不算太重要，會了 stack 和 queue，它幾乎只是多一個名詞。

> **觀念** 問：Git 的 branch 是 linked list 嗎？答：單看一條 branch 是；整個 log 比較像 tree，合併（merge）之後更像 graph。

## 抽象化（abstraction）

有了完整的 picture，下一個觀念是對資料結構的功能做一定程度的 **abstraction（抽象化）**。程式寫多了會發現，重點不是最後裝哪種資料型態，而是資料結構怎麼運作；學抽象，是為了一招用到更多地方。

> **比喻** 從數字走到代數：小孩先數 1 到 10，後來數百元鈔票，其實一樣，只是單位變 100；會了 3 + 5 = 8，就比較容易答出 300 + 500 = 800；再進一步 3x + 5x = 8x，不管 x 是什麼規則都一樣。資料結構也要能說出它的精神（essence）：它到底在做什麼。

### 理由一：節省實作力氣（type abstraction）

寫 integer array、double array、complex number array 是同一件事：都是根據 index 很快算出 address，一格幾個 byte 不重要。所以 template 做的是 **type abstraction**：把能裝的型別放寬。抽象化其實就是一種放鬆。站高一點看似虛無縹緲，目的很實際：**寫一次、想一次，就能用在很多地方**（節省 implementation efforts）。

### 理由二：容易抽換資料結構（functionality abstraction）

第二個理由是 **easy change of data structure**，前提是注重功能而不是細節。

- 例：要把 user id 排好存起來，array 做得到，linked list 也做得到。
- 沒有通通都好的資料結構，總是這邊好一點、那邊差一點，這就是 **trade-off**。
- 很清楚問題時好選：insertion 多就用 linked list，index access 多就用 array。
- 但實務上常不知道哪個好，只能先寫一版、再換一版交叉測試；外面做的事一樣，每換一次就重寫，很麻煩。

所以把共同功能抽出來：大家都能 search、sequential access、index access、insertion，只是做法和花的力氣不同。重點放在「**能做什麼**」而不是「**怎麼做到**」，誰滿足需求就套上去試，抽換就很容易。在用到真正的實作前，先不管花多少時間，只管功能支不支援，這叫 **functionality abstraction**。

## 回顧：資料結構搭配演算法

這一章把資料結構和演算法搭配著學：

| 資料結構 | 搭配的演算法 |
|---|---|
| array、linked list | sequential search；變形「找最小的在哪裡」，外面再套一個 for 迴圈就是 selection sort |
| linked list | 插入方便 → insertion sort |
| ordered array | binary search |
| linked list 表示 sparse vector、polynomial | polynomial merge（相加）、inner product |
| linked list | 龜兔賽跑偵測 cycle、找出串列的中點（面試常考） |
| stack | parentheses matching、postfix evaluation、infix to postfix、走迷宮（DFS） |
| queue | job scheduling、走迷宮（BFS） |

> **重點** 主線是：先問需求，再挑容器，容器配上對的演算法，才變成解法。看到一個資料結構，先問它在乎什麼、放棄了什麼，就知道該在哪裡用它。

## 重點整理
- C++ 不是 C 的百分之百超集；寫資料結構好用的五個差異：reference、class、operator overloading、template、STL
- 記憶體三區：code（指令）、stack（變數，直接存取，大小 compile time 決定）、heap（只能經 pointer 間接存取，大小 runtime 決定）
- 函式在 stack 上的那塊叫 activation record／stack frame；函式不能存取別的函式的 activation record
- malloc 借、free 還，忘了 free = memory leak；new = 配置 + constructor，delete = destructor + 釋放
- C 只有 call by value；swap 要傳位址 swap(&a, &b)；C++ reference（int &a）是變數的暱稱，宣告時就綁定、不能改綁、不能是 NULL
- 指標用途：存取 heap、call by reference、存取檔案（FILE *）、存取周邊裝置
- 指標算術只有 p++、p--、p ± 常數、兩指標相減（同一陣列，結果是相隔元素數）；不能相加、相乘
- *++p 先移再取；++*p 資料加 1；*p++ = *(p++) 先取再移指標；(*p)++ 加資料、式子值為舊值
- class 與 struct 在 C++ 只差預設權限：class 預設 private、struct 預設 public；protected = 本類別與子類別（derived class）可存取
- this 是指向目前物件的指標；operator overloading：a + b 被翻成 operator+(a, b) 或 a.operator+(b)
- template 讓 compiler 代做 copy-paste-replace；sort 自訂型別必須有 operator<
- Array = <index, value> 的集合；一塊連續記憶體；Fast Random Access
- 一維：Addr(A[i]) = L0 + i × w；下界 lb：L0 + (i − lb) × w
- Array ADT：get／update O(1)；insert／remove by index 最壞 O(n)
- A[i] ≡ *(A + i)，所以 i[A] 合法；&A 型別 int (*)[n]，&A + 1 跳過整個陣列
- m × n 陣列 row-major：L0 + (i × n + j) × w；column-major：L0 + (j × m + i) × w（1 起算時 i、j 各減 1）
- 例：3 × 4、L0 = 500、w = 2：row-major A[2][1] = 518、column-major A[1][2] = 514
- 多維 row-major A[i][j][k][l] = L0 + (i·u2u3u4 + j·u3u4 + k·u4 + l) × w，最後一項是 l
- C／C++ row-major；Fortran、MATLAB column-major；兩種公式都是 2 加 2 乘，效率相同
- 2D 實作：one block vs array of arrays（多一排指標、配置多次、get 兩層，但好寫）
- *(*(p + i) + j) = p[i][j]；靜態 int A[3][4] 的 A 型別是 int (*)[4] 不是 int **，A + 1 跳一整列
- 下三角矩陣存 n(n + 1)/2 格；1-indexed 第 i row 第 j 個在 i(i − 1)/2 + j；對稱矩陣只存一半
- row-major 陣列內層迴圈跑最後一個索引（row sum）較快：連續存取 cache hit 多；column sum 約慢一倍
- vector（ADT）= 支援 index access 的家族：at、set、insert、erase；不等於 STL vector
- STL vector = extendable array；grow：allocate、copy（O(n)）、assign
- 每次 +1：copy 總數 m(m − 1)/2 = O(m²)；每次 ×2：copy 1 + 2 + … + 2^(k−1) = 2ᵏ − 1 ≈ m，allocate 約 log m 次
- ×2 策略 push amortized O(1)，最壞單次 O(m)（amortized analysis）
- std::deque 分塊存、用指標陣列（map）找塊，random access 仍 O(1)
- Consecutive array：從頭連續放、不留空，用 tail 記最後一筆；ordered array = consecutive + 由小到大排好（需定義好的 ≤）
- Ordered array 的 insert：從 tail 往前，比 data 大就 `arr[i+1] = arr[i]`，停下後放 `arr[i+1] = data`；最壞搬 tail + 1 個，O(n)
- insert 常見 bug：data 比全部小時 i 跑到 −1 沒放進去（迴圈後補 `arr[i+1] = data`）、沒檢查已滿、忘了 tail++
- 加限制的代價：ordered array 的 insert、建構、update、remove 都要維護順序與連續
- Sequential search 最差 Θ(n)；with cut：看到比 toFind 大就停（利用 ordered）
- Binary search：`mid = (begin + end) / 2`，大於則 end = mid − 1，小於則 begin = mid + 1，`while (begin <= end)`；O(log n)，靠 fast random access
- 正確性：loop invariant「目標若存在必在 [begin, end]」+ finiteness（候選數每輪減半、有下限）
- 三分搜尋兩次比較只縮成 1/3，二分兩次縮成 1/4，二分較好
- mid 防 overflow：`left + (right − left) / 2`
- f = O(g)：存在 c > 0、n₀，n ≥ n₀ 時 f(n) ≤ c·g(n)；要寫最緊的上界（3n + 2 = O(n)，c = 4、n₀ = 2）
- lim f/g 存在且 ≤ c 是 Big-O 的充分條件、非必要條件（反例 |sin n| = O(1)）
- f = Ω(g)：f(n) ≥ c·g(n)，取最大的下界；f = Θ(g)：c₁g ≤ f ≤ c₂g；lim f/g = c 且 0 < c < ∞ 才是 Θ
- 成長順序：1 < log n < log²n < n < n log n < n² < n³ < 2ⁿ；n² log n 介於 n² 與 n³
- log 的底可忽略（常數倍）；指數的底不可換（5ⁿ ≠ O(2ⁿ)）
- 和的規則：f₁ + f₂ = O(max)，取 c = c₁ + c₂、n₀ = max(n₁, n₂)；遞移律 c = c₁·c₂；巢狀相乘 O(f·g)
- k 次多項式 = O(nᵏ)；(log n)ᵏ = O(n)；log(nᵏ) = O(log n)
- 迴圈：循序相加取大（bottleneck）、巢狀相乘、if-else 取大分支；內圈 j < i/2 總和約 n²/4 仍 O(n²)
- 階乘遞迴 T(n) = T(n−1) + c → O(n)；Fibonacci T(n) = T(n−1) + T(n−2) + c → Θ(φⁿ)，φ ≈ 1.618，上界 O(2ⁿ)
- 每秒 10⁹ 步：n² 跑 10⁶ 筆約 16.67 分鐘；n³ 跑 10⁵ 筆約 11.57 天；2ⁿ 跑 50 筆約 13 天
- 複雜度是趨勢、running time 是一點；平方演算法資料 10 倍時間約 100 倍，從小資料開始測
- 多項式表示法 1：coef[i] 為 xⁱ 係數，大小 MaxDegree + 1；sparse 時浪費
- padd：while + COMPARE(LeadExp) 三個 case（1 / 0 / −1）+ Attach / Remove
- 表示法 3：static termArray 共用，每個多項式記 start、finish，free 指下一個空位；NewTerm 檢查 free < MaxTerms 後寫入並 free++
- 多項式加法 O(n + m)（n、m 為非 0 項數）；表示法 3 空間 2 × (finish − start + 1)，不 sparse 時約為表示法 1 的 2 倍
- termArray 滿了：單一 free 指標無法回收中間的洞，要 compaction（往前搬並更新 start、finish）或 free list
- Sparse matrix 用 `<row, col, value>` triple，先依 row 再依 col 排序
- Simple transpose：外圈 cols、內圈 terms，O(cols·terms)，不 sparse 時 O(rows·cols²) 比二維陣列慢
- Fast transpose：rowSize[col]++；rowStart[i] = rowStart[i−1] + rowSize[i−1]；放置後 rowStart[col]++；O(cols + terms)
- 範例 rowSize = 3 2 1 0 1 1，rowStart = 0 3 5 6 6 7
- 矩陣相乘 m×n 乘 n×p：O(m·n·p)
- Row major：a[i][j] 位址 α + i·u2 + j；column major：α + j·u1 + i
- 暴力字串比對 O(m·n)；KMP O(m + n)
- Fail function（1-based）：f(j) = 最大 k < j 使 P 開頭 k 個 = P 結尾於 j 的 k 個；ababaca = 0 0 1 2 3 0 1（0-based 版本為 −1 −1 0 1 2 −1 0）
- KMP 失敗時下一個比 P[f(j−1)+1]，T 的指標不回頭；j = 1 失敗則 i 前進
- array 的兩個缺點：大小在 compile time 固定（runtime 才知道元素數）；插入／刪除要 data movement，O(n)。
- linked list = node 的集合；node = data + next（link）；first／head 指向第一個 node；node 不連續，順序靠 link 維持。
- self-referential structure：`struct Node { int data; struct Node *next; };`；node 用 malloc(sizeof(struct Node)) 或 new 建在 heap，成員用 `->`。
- `p = p->next` 是走訪的關鍵敘述；`p == NULL`（p 沒指向 node）≠ `p->next == NULL`（p 是最後一個）；NULL 判斷可寫 `!p`。
- `x = y` 抄位址（指到同一個 node）；`*x = *y` 抄 node 所有欄位（連 link 也抄）。
- 插在 x 後面：`t->link = x->link; x->link = t;`（先接後面再接前面，順序不能反）。
- 刪第一個：`first = first->link`；刪中間：`trail->link = x->link`（singly 必須知道前一個）；刪掉的 node 要 delete 或放進 free list，否則 memory leak。
- 插在最前面要另寫 insertHead（head 不在任何 node 裡）；dummy head 用一個空 node 統一處理，空間換 coding 方便。
- 搜尋：array 與 linked list 循序搜尋都 O(n)；找到後刪除 array O(n)、linked list O(1)。array 是 random access，list 是 sequential access。
- doubly：每個 node 有 llink／rlink（prev／next），可雙向走訪，拿到 x 就能 O(1) 刪除。
- doubly 把 p 插在 x 右邊：`p->llink = x; p->rlink = x->rlink; x->rlink->llink = p; x->rlink = p;`（②③ 必在 ④ 前）。
- doubly 刪 x：`x->llink->rlink = x->rlink; x->rlink->llink = x->llink; delete x;`（不可刪 header）。
- 環狀 doubly + header node：empty 時 header 的 llink、rlink 都指自己。
- iterator 把 position 抽象化：begin、end、next（++）、取值（*）；end() 是 past-the-end，只能比較不能 dereference。STL list 是 doubly linked list，vector 是連續 array。
- Attach 只用 first 要 O(n)；另外維護 last 則 O(1)。
- sparse vector：只存 (維度, 值)；成本 = 非零數 × pair 大小，dense = 維度數；很稀疏才划算。
- 兩條 ordered list 合併（加法／內積）用 running cursors：比 order，小的前進、相等兩邊前進；和為 0 不插入；O(m + n)。
- reversal：先存 next 再改 `cur->next = prev`；Invert 用 p、q、r，最後 `first = q`；in-place O(n) 時間 O(1) 空間。
- cycle detection：龜兔賽跑，兔子一次兩步、烏龜一步，相遇即有 cycle，兔子走到 NULL 即無。
- 找中間項：兔子到尾時烏龜在中間（one-pass）；「中間」定義要先問清楚。
- Concatenate 要先走到 A 的尾巴；destructor 每輪先記 next 再 delete。
- circular list 尾巴不是 NULL，用 last 或 `link == first` 判斷；只留 last 時 first = last->link，頭尾插入 O(1)。
- linked stack：top = first；linked queue：rear 加入、front 刪除（反過來 singly 刪尾 O(n)）。
- 多項式 node = (coef, exp, link)；加法：指數相同係數相加（和為 0 不存），不同先 copy 指數大的。
- free pool（av list）：GetNode `x = av; av = av->link;`（空則 new）；RetNode `x->link = av; av = x;`。
- 環狀多項式整個歸還 O(1)：`second = first->link; first->link = av; av = second; first = 0;`；非環狀要先走到尾 O(n)。
- header node 的 exp 設 −1，零多項式只剩 header 自己指自己。
- Equivalence relation = reflexive + symmetric + transitive；「≡」是有關係，不是數值相等；拿掉 symmetric 就不是 equivalence relation（asymmetric 比 not symmetric 更強）
- Equivalence class 演算法分兩個 phase：Phase 1 讀完所有 pair 建 seq[] 的 linked list（i、j 兩邊都插在 list 最前面）；Phase 2 用 out[] 防重複，用 stack 追 indirect equivalence
- 課本 9 個 pair 的輸出順序：0 11 4 7 2｜1 3 5｜6 8 10 9（要真的 trace，不是排序後的順序）；輸入整個倒過來則為 0 4 11 2 7｜1 3 5｜6 10 8 9
- Sparse matrix 的 linked 表示：每個 row／column 一條 circular list，row i 與 column i 共用 head node Hi；n×m、r 個非 0 需 max{n, m} + r + 1 個 node（課本 4×4、4 項 = 9）
- MatrixNode：共用 down、right、bool head；union { next（head node 用）, triple（entry node 用） }
- Stack：LIFO，所有操作在 top；push、pop、peek；Add = push、Delete = pop
- Stack ADT 是 finite ordered list → 需要 IsFull、IsEmpty
- Array stack：top 初值 −1；IsEmpty: top == −1；IsFull: top == MaxSize − 1；push `stack[++top] = x`、pop `x = stack[top--]`；top 放尾端才 O(1)
- Singly linked list stack：top 放 head，push／pop 都 O(1)；放 tail 則 pop 要 O(n)
- STL stack 是 container adapter，預設底層 deque，可指定 vector 或 list
- 括號配對：左括號 push、右括號 pop 並比對種類；讀完 stack 要空；右括號遇空 stack 也不平衡
- Activation record：函式被呼叫時建立、結束時刪除；執行中的函式只用最上層；遞迴太深 → stack overflow
- A(n){ if(n>0){ print n; A(n−1);} } 輸出 3 2 1（tail recursion）；先呼叫再印輸出 1 2 3；兩者 stack 最多 5 層（main + A(3)…A(0)）
- 兩個 stack 可共用一個 array（頭尾相向生長）；Stack ≠ Array，stack 是 ADT
- Postfix 求值：運算元 push，operator pop 所需個數（unary 1、binary 2、ternary 3）；先 pop 的是右運算元
- 3 4 / 5 − 6 7 * + 8 9 * − = −34.25；6 2 / 3 − 4 2 * + = 8
- A/B−C+D*E−A*C → A B / C − D E * + A C * −
- Infix→postfix（數字越小越優先的表）：ISP(y) ≤ ICP(x) 就 pop y，最後 push x；* / % = 2、+ − = 3、左括號 ISP 8／ICP 0
- A+B*C → ABC*+；A*B+C → AB*C+；A*(B+C)*D → ABC+*D*；3*(5+7) → 357+*
- 左結合同優先要 pop（A−B−C → AB−C−）；右結合同優先不 pop（A^B^C → ABC^^）
- 手動轉換：完全加括號，operator 移到對應右括號（2 pass）；stack 法只需 one pass
- 轉換用 operator stack，求值用 operand stack；兩者合起來就是計算機
- Queue = FIFO（先進先出）：enqueue 只能 insert at rear，dequeue 只能 remove from front；stack 是 LIFO，只記 top，queue 要記 front、rear。
- Job scheduling 用 queue（先到先做）；依 priority 決定順序的是 priority queue。
- 線性 queue 用 rear == MaxSize−1 判斷 full，刪除後前面空出的格子用不到 →「假滿」；解法：data movement（O(元素個數)）、改寫 IsFull，或改用 circular queue。
- Circular queue（課本慣例）：front 指第一個元素的前一格（永遠空著），rear 指最後一個元素，初始 front = rear = 0。
- Full：(rear + 1) % MaxSize == front；Empty：front == rear；MaxSize 格最多放 MaxSize − 1 個（犧牲一格以分辨空與滿）。
- Add：newRear = (rear+1) % MaxSize，front == newRear 則 full，否則 rear = newRear、queue[rear] = x。
- Delete：front == rear 則 empty；否則先 front = (front+1) % MaxSize 再取 queue[front]（先移再取）。
- 迷宮 recursion 版：system stack 存一條正在走的路徑；自訂 stack 版存待探索的點（記事本）。
- 標 to-do（已寫進記事本、還沒 visit）可避免同一格重複進 stack；visited 與 to-do 是不同狀態。
- 迷宮實作：2D array 0 可走 1 是牆；外圍包一圈 1 → (m+2)×(p+2)，入口 (1,1)、出口 (m,p)，不必判斷邊界。
- 八方向 move[8] 從北順時針：N(−1,0) NE(−1,1) E(0,1) SE(1,1) S(1,0) SW(1,−1) W(0,−1) NW(−1,−1)；g = i + move[d].vert，h = j + move[d].horiz。
- Stack 存 (row, col, dir)：dir 是下一個要試的方向，退回時不重試失敗的方向。
- 能走的條件：maze[g][h] == 0 且 mark[g][h] == 0；只看 maze 不看 mark 會繞圈。stack 大小約 m×p。
- 試方向的順序可自訂（改 move 的編號即可），但 stack 回溯（DFS）不管怎麼排都不保證最短路徑。
- 同一個範本換 container：stack → DFS（一路往深處），queue → BFS（一層層同心圓），袋子隨機抽 → random walk；任何 container 都能正確判斷有沒有解。
- BFS 第一次碰到的出口最近（每步代價相同時才保證最短）；路有不同長度要用 priority queue（Dijkstra）。
- Recursive 版也是 DFS；誰比較快找到「一條路」看問題特性，最壞情況兩者差不多。
- Dense array：storage Θ(n)、index access O(1)、sequential access、長度固定、插入刪除 O(n)。
- Doubly linked list：storage Θ(n)＋兩個指標 overhead、長度動態、已知位置插入刪除 O(1)、index access 要從頭走。
- Singly linked list：overhead 較少，插入 O(1)，刪除要找前一個 node，不是 O(1)。
- O(1) 插入刪除的前提是手上已有該位置的指標；只給 index 是 O(k)。
- Array + restricted access（只用尾巴）→ stack；circular list + restricted access → queue；兩頭都能進出 → deque（常用 doubly linked list 實作）。
- Sparse array 只存 non-zero，storage Θ(nnz)：ordered array 找項 O(log nnz)、插入刪除 O(nnz)；ordered linked list 找項 O(nnz)、已知位置插入刪除 O(1)（implementation trade-off）。
- 抽象化兩個理由：節省實作力氣（type abstraction，template）、容易抽換資料結構（functionality abstraction：注重能做什麼而非怎麼做）。

## 名詞對照
| 中文 | English |
|---|---|
| 指標 | pointer |
| 位址 | address |
| 位址變數 | address variable |
| 間接存取 | indirect access |
| 堆疊區 | stack |
| 堆積區 | heap |
| 程式碼區 | code section |
| 活動紀錄 | activation record / stack frame |
| 載入 | loading |
| 記憶體洩漏 | memory leak |
| 建構子 | constructor |
| 解構子 | destructor |
| 傳值呼叫 | call by value |
| 傳位址呼叫 | call by address |
| 傳參考呼叫 | call by reference |
| 參考 | reference |
| 檔案指標 | file pointer |
| 結構 | structure (struct) |
| 自我參考結構 | self-referential structure |
| 聯合 | union |
| 類別 | class |
| 物件 | object |
| 物件導向程式設計 | object-oriented programming |
| 衍生類別（子類別） | derived class (subclass) |
| 運算子多載 | operator overloading |
| 範本 | template |
| 標準範本庫 | Standard Template Library (STL) |
| 陣列 | array |
| 索引 | index |
| 基底位址 | base address |
| 下界 | lower bound |
| 快速隨機存取 | fast random access |
| 抽象資料型態 | abstract data type (ADT) |
| 列優先 | row-major |
| 行優先 | column-major |
| 指標陣列 | array of pointers |
| 雙重指標 | double pointer |
| 下三角矩陣 | lower triangular matrix |
| 對稱矩陣 | symmetric matrix |
| 快取 | cache |
| 快取命中／未命中 | cache hit / cache miss |
| 可延伸陣列 | extendable array |
| 溢位 | overflow |
| 攤銷分析 | amortized analysis |
| 雙端佇列 | deque |
| 稠密陣列 | dense array |
| 稀疏陣列 | sparse array |
| 鍵值儲存 | key-value data store |
| 連續陣列 | consecutive array |
| 有序陣列 | ordered array |
| 尾端 | tail |
| 循序搜尋 | sequential search |
| 二分搜尋 | binary search |
| 三分搜尋 | ternary search |
| 迴圈不變量 | loop invariant |
| 有限性 | finiteness |
| 選擇排序 | selection sort |
| 插入排序 | insertion sort |
| 維護 | maintenance |
| 漸近符號 | asymptotic notation |
| 漸近行為 | asymptotic behavior |
| 上界 | upper bound |
| 最小上界 | least upper bound |
| 執行步數 | step count |
| 充分條件 | sufficient condition |
| 必要條件 | necessary condition |
| 瓶頸 | bottleneck |
| 分治法 | divide and conquer |
| 線性複雜度 | linear complexity |
| 指數成長 | exponential |
| 嵌入式系統 | embedded system |
| 有序串列 | ordered list |
| 多項式 | polynomial |
| 係數 | coefficient (coef) |
| 指數 | exponent (exp) |
| 最高次方 | leading exponent (LeadExp) |
| 稀疏 | sparse |
| 記憶體重整 | compaction |
| 稀疏矩陣 | sparse matrix |
| 三元組 | triple |
| 轉置 | transpose |
| 快速轉置 | fast transpose |
| 列優先 | row major |
| 行優先 | column major |
| 字串比對 | string matching / pattern matching |
| 樣式 | pattern |
| 失敗函數 | failure function (fail array) |
| 資訊檢索 | information retrieval (IR) |
| 樣板 | template |
| 鏈結串列 | linked list |
| 節點 | node |
| 鏈結 | link／next pointer |
| 頭指標 | head／first |
| 固定大小 | fixed size |
| 可變大小 | variable size |
| 資料搬移 | data movement |
| 連續的 | contiguous |
| 隨機存取 | random access |
| 循序存取 | sequential access |
| 依位置存取 | positional access |
| 單向鏈結串列 | singly linked list |
| 雙向鏈結串列 | doubly linked list |
| 環狀鏈結串列 | circular linked list |
| 虛擬頭節點 | dummy head |
| 標頭節點 | header node |
| 有序鏈結串列 | ordered linked list |
| 走訪 | traverse |
| 迭代器 | iterator |
| 巢狀類別 | nested class |
| 稀疏向量 | sparse vector |
| 獨熱編碼 | one-hot encoding |
| 游標 | cursor |
| 兩游標輪流前進 | running cursors |
| 內積 | inner product |
| 反轉 | reversal／invert |
| 環偵測 | cycle detection |
| 龜兔賽跑演算法 | tortoise and hare |
| 串接 | concatenate |
| 可用空間串列 | available list（av）／free list |
| 資源回收池 | free pool |
| 磁碟區塊 | disk block |
| 容器 | container |
| 等價關係 | equivalence relation |
| 等價類 | equivalence class |
| 自反 | reflexive |
| 對稱 | symmetric |
| 遞移 | transitive |
| 直接相關 | direct equivalence |
| 間接相關 | indirect equivalence |
| 環狀串列 | circular linked list |
| 頭節點 | head node |
| 項目節點 | entry node |
| 雙向串列 | doubly linked list |
| 堆疊 | stack |
| 頂端 | top |
| 推入 | push |
| 彈出 | pop |
| 偷看頂端 | peek |
| 後進先出 | Last In, First Out (LIFO) |
| 括號配對 | parenthesis matching |
| 系統堆疊 | system stack |
| 活動紀錄 | activation record |
| 堆疊溢位 | stack overflow |
| 遞迴 | recursion |
| 尾遞迴 | tail recursion |
| 頭遞迴 | head recursion |
| 容器轉接器 | container adapter |
| 多重堆疊 | multiple stacks |
| 運算式求值 | expression evaluation |
| 中序 | infix |
| 後序 | postfix |
| 前序 | prefix |
| 運算元 | operand |
| 運算子 | operator |
| 一元運算子 | unary operator |
| 三元運算子 | ternary operator |
| 堆疊內優先序 | in-stack priority (ISP) |
| 進入時優先序 | incoming priority (ICP) |
| 左結合 | left associative |
| 右結合 | right associative |
| 單趟演算法 | one-pass algorithm |
| 佇列 | queue |
| 先進先出 | First In First Out (FIFO) |
| 後進先出 | Last In First Out (LIFO) |
| 前端／後端 | front / rear |
| 加入佇列／移出佇列 | enqueue / dequeue |
| 工作排程 | job scheduling |
| 優先佇列 | priority queue |
| 假滿 | false full（線性 queue 的誤判） |
| 環狀佇列 | circular queue |
| 環狀陣列 | circular array |
| 環狀串列 | circular list |
| 回溯 | backtrack |
| 位移量 | offset |
| 虛擬碼 | pseudocode |
| 深度優先搜尋 | Depth First Search (DFS) |
| 廣度優先搜尋 | Breadth First Search (BFS) |
| 隨機漫步 | random walk |
| 密集陣列 | dense array |
| 非零項個數 | number of non-zero (nnz) |
| 隨機存取 | random access / indexed access |
| 循序存取 | sequential access / iterative access |
| 環狀存取 | circular access |
| 受限存取 | restricted access |
| 額外負擔 | overhead |
| 雙端佇列 | deque (double-ended queue) |
| 抽象化 | abstraction |
| 型別抽象化 | type abstraction |
| 功能抽象化 | functionality abstraction |
| 權衡取捨 | trade-off |
| 實作上的取捨 | implementation trade-off |
