// ── Subject data with per-chapter materials ──
// NOTE (2026/8/20): each chapter's `n` field ("主題1", "主題2"...) is this
// app's OWN topic grouping for browsing/reference — it does NOT correspond
// 1:1 to the real textbook's chapter numbers (was previously labeled "Ch1",
// "Ch2" etc., which falsely implied it did). The `mats` book citations
// inside each chapter still cite real book chapter numbers directly (e.g.
// "資結七版 Ch6-4") and those ARE accurate — only the outer 主題N label is
// app-internal. The authoritative real chapter-by-chapter mapping used for
// the actual weekly task queue lives in FOUNDATION_CONTENT (public/app.js),
// cross-checked against book-toc.md.
const SUBJECTS=[
{id:"ds",name:"資料結構",color:"#2FC092",hours:134.1,weeks:4,coverage:"全11校",
tip:"主題1–9按順序打基礎（約4週），圖論演算法與字串處理可和演算法科交叉練習。每個主題讀完立刻做3–5題練習題。同一主題有多位老師時，完成任一版本即可。",
 recommended_books:[
   {name:"資料結構（含精選試題）— 洪逸編著，七版（大碩）",note:"✅ 你有這本。全書9章含精選試題"},
   {name:"資料結構春季講義 Q1–Q6 含詳解（HY老師／大碩）",note:"✅ 你有這份。Q1–Q6依序對應遞迴、Array／Stack／Queue、Linked List、Tree、Graph、Sort／Search／Hashing／進階樹"},
   {name:"資料結構春季講義 Y1–Y8（HY老師／大碩）",note:"✅ 你有這份。Y2–Y8為各校歷屆試題分類練習"}],
 recommended_videos:[
   {name:"交大OCW 彭文志《資料結構》Ch1 Introduction",url:"https://www.youtube.com/watch?v=3503j2L6qNA",note:"整科的入門總覽，開始讀章節前先看這支建立架構"},
   {name:"MIT 6.006：AVL Trees, AVL Sort",url:"https://www.youtube.com/watch?v=FNeL18KsWPc",note:"平衡樹旋轉是這科最常考卡關的地方，這支講得最清楚"},
   {name:"Abdul Bari：Heap",url:"https://www.youtube.com/watch?v=HqPJF2L5h9U",note:"Heap建構與調整的手算流程，配合Priority Queue章節看"}],
 chapters:[
  {n:"主題1",t:"複雜度分析",sub:"Big-O / Θ / Ω、遞迴分析",pri:"must",hrs:"7.5hr",wk:1,
   key:"Big-O／Ω／Θ 的定義與用 c 和 n₀ 證明",
   mats:[
    {type:"vidgroup",text:"複雜度分析 Big-O/Θ/Ω",options:[
      {label:"Time Complexity of a Computer Program",url:"https://www.youtube.com/watch?v=V42FBiohc6c",dur:"9:42"},
      {label:"台大林軒田 DSA Analysis Tools",url:"https://www.youtube.com/watch?v=d-PDYIqg_Kc",dur:"36:06"}
    ]},
    {type:"vidgroup",text:"課程導論（背景，非必要）",options:[
      {label:"台大林軒田 DSA Class Introduction",url:"https://www.youtube.com/watch?v=G3H-L-K9kM4",dur:"37:23"},
      {label:"台大林軒田 DSA Introduction to Data Structures and Algorithms",url:"https://www.youtube.com/watch?v=8IOv2fnc01E",dur:"1:45:17"},
      {label:"交大彭文志 Lec01 Introduction (1/2)",url:"https://www.youtube.com/watch?v=3503j2L6qNA",dur:"1:10:42"},
      {label:"交大彭文志 Lec02 Introduction (2/2)",url:"https://www.youtube.com/watch?v=0J2eLvkuF8k",dur:"52:57"}
    ]}
   ]},
  {n:"主題2",t:"陣列、Linked List、Stack、Queue",sub:"Array、Singly/Doubly/Circular LL、Stack、Queue",pri:"must",hrs:"28.5hr",wk:2,
   key:"各結構insert/delete時間複雜度比較、Circular Queue環狀操作、Stack用陣列vs鏈結實作差異、常見函數成長率比較（log n < n < n log n < n² < 2ⁿ）",
   peerNote:"同儕筆記校正：有份筆記的列主序（row-major）範例最後一項誤植為i（應為l），Protected存取層級也只寫「部分人能拿取」，實際上是子類別可存取，讀到這段時以課本為準。",
   mats:[
    {type:"book",text:"資結七版（洪逸）Ch2 Arrays & Structures + Ch3 Stack & Queue + Ch4 Linked List：重點標記各操作時間複雜度"},
    {type:"vidgroup",text:"陣列 Array",options:[
      {label:"台大林軒田 DSA C++ / Array",url:"https://www.youtube.com/watch?v=1yyu70Vy9Zc",dur:"2:44:10"},
      {label:"交大彭文志 Lec03 Arrays (1/4)",url:"https://www.youtube.com/watch?v=hPIBv0kO-Zc",dur:"1:25:14"},
      {label:"交大彭文志 Lec04 Arrays (2/4)",url:"https://www.youtube.com/watch?v=x72xBomc-XE",dur:"49:18"},
      {label:"交大彭文志 Lec05 Arrays (3/4)",url:"https://www.youtube.com/watch?v=cgaPEsMJkSc",dur:"1:26:16"},
      {label:"交大彭文志 Lec06 Arrays (4/4)",url:"https://www.youtube.com/watch?v=5HBMYNYYGZU",dur:"24:00"},
      {label:"Abdul Bari：Row-Major and Column-Major Mapping",url:"https://www.youtube.com/watch?v=MJZd6uPi88E",dur:"19:16"},
      {label:"Abdul Bari：Pointer to Array",url:"https://www.youtube.com/watch?v=868qXWoGS9E",dur:"14:36"},
      {label:"Abdul Bari：Pointer Arithmetic",url:"https://www.youtube.com/watch?v=uMGwjNuidZU",dur:"10:25"},
      {label:"Abdul Bari：Why Pointers?",url:"https://www.youtube.com/watch?v=OqLt2GfX6jg",dur:"9:13"}
    ]},
    {type:"vidgroup",text:"Linked List",options:[
      {label:"Linked List Introduction & Concepts",url:"https://www.youtube.com/watch?v=akErwS16DUg",dur:"27:07"},
      {label:"台大林軒田 DSA Linked List",url:"https://www.youtube.com/watch?v=pAs8Swu1Y3Y",dur:"1:28:49"},
      {label:"台大林軒田 DSA Array / Linked List",url:"https://www.youtube.com/watch?v=B0ywTK-Lklw",dur:"2:55:10"},
      {label:"交大彭文志 Lec08 Lists (1/4)",url:"https://www.youtube.com/watch?v=lhXHk8IuFeQ",dur:"50:05"},
      {label:"交大彭文志 Lec09 Lists (2/4)",url:"https://www.youtube.com/watch?v=U_tNDdEooJU",dur:"1:34:47"},
      {label:"交大彭文志 Lec10 Lists (3/4)",url:"https://www.youtube.com/watch?v=zLuuRC56uvI",dur:"50:15"},
      {label:"交大彭文志 Lec11 Lists (4/4)",url:"https://www.youtube.com/watch?v=yn0ZAifhyNM",dur:"31:43"}
    ]},
    {type:"vidgroup",text:"Stack / Queue",options:[
      {label:"台大林軒田 DSA Analysis Tools / Stack",url:"https://www.youtube.com/watch?v=-1FYYVpgyUo",dur:"2:48:05"},
      {label:"台大林軒田 DSA Stack / Queue",url:"https://www.youtube.com/watch?v=R0MpXbuqfZM",dur:"2:58:50"},
      {label:"台大林軒田 DSA Container",url:"https://www.youtube.com/watch?v=USLvdBuxTno",dur:"2:39:27"},
      {label:"交大彭文志 Lec07 Stacks & Queues (2/2)",url:"https://www.youtube.com/watch?v=xqM9NVKUWmg",dur:"1:25:45"},
      {label:"Abdul Bari：Stack vs Heap",url:"https://www.youtube.com/watch?v=PdvGEI-P3-M",dur:"11:08"},
      {label:"Abdul Bari：Recursion and Stack",url:"https://www.youtube.com/watch?v=ygK0YON10sQ",dur:"13:09"}
    ]},
    {type:"ex",text:"手寫Circular Queue的enqueue/dequeue操作過程（畫格子模擬），各10次"}]},
  {n:"主題3",t:"樹（基礎）",sub:"Binary Tree、走訪、完全二元樹",pri:"must",hrs:"11.6hr",wk:2,
   key:"Inorder/Preorder/Postorder三種走訪用途與程式碼、BFS（Level-order）用Queue實作、完全vs完滿二元樹定義",
   mats:[
    {type:"book",text:"資結七版（洪逸）Ch5 Tree & Binary Tree：5-5走訪（非常重要），把走訪程式碼抄一遍 + Q講義Q4"},
    {type:"vidgroup",text:"二元樹與走訪（挑一個老師的版本，彭文志是6堂系列）",options:[
      {label:"Binary Tree Traversals（Inorder, Preorder, Postorder）",url:"https://www.youtube.com/watch?v=-b2lciNd2L4",dur:"11:07"},
      {label:"Abdul Bari：Tree Traversal",url:"https://www.youtube.com/watch?v=xo41NfT8218",dur:"6:15"},
      {label:"台大林軒田 DSA Tree",url:"https://www.youtube.com/watch?v=XkNIHYd9Ruc",dur:"2:56:05"},
      {label:"交大彭文志 Lec12 Trees (1/6)",url:"https://www.youtube.com/watch?v=VwQeypxlevE",dur:"1:26:22"},
      {label:"交大彭文志 Lec13 Trees (2/6)",url:"https://www.youtube.com/watch?v=UO0B1SQOAgk",dur:"41:41"},
      {label:"交大彭文志 Lec14 Trees (3/6)",url:"https://www.youtube.com/watch?v=pPMMUa8guTE",dur:"1:22:49"},
      {label:"交大彭文志 Lec15 Trees (4/6) / Huffman (1/2)",url:"https://www.youtube.com/watch?v=ubLbvuWFDqM",dur:"49:42"},
      {label:"交大彭文志 Lec16 Trees (5/6) / Huffman (2/2)",url:"https://www.youtube.com/watch?v=Rk3aap_HZHU",dur:"1:13:50"},
      {label:"交大彭文志 Lec17 Trees (6/6)",url:"https://www.youtube.com/watch?v=4HDjWNV09QY",dur:"45:15"}
    ]},
    {type:"ex",text:"給定一棵樹，手寫三種走訪結果 × 5題（資結七版（洪逸）書後習題）"}]},
  {n:"主題4",t:"BST、AVL Tree、Red-Black Tree",sub:"二元搜尋樹、高度平衡樹",pri:"must",hrs:"20hr",wk:3,
   key:"BST插入/刪除/搜尋、AVL四種旋轉（LL/RR/LR/RL）、平衡因子計算、紅黑樹性質（不要求手推旋轉，要知道特性）",
   peerNote:"同儕筆記地雷：BST不平衡會退化成linked list、O(log N)優勢消失；紅黑樹插入/刪除後務必把root塗黑，是常被漏掉的細節。讀過的資料結構同儕筆記完全沒提到AVL/Red-Black Tree的實作，這塊要靠課本/影片，不能只找同儕筆記。",
   mats:[
    {type:"book",text:"資結七版（洪逸）Ch9-6 AVL樹：AVL旋轉部分至少讀3遍，每種旋轉手畫5次 + Q講義Q6"},
    {type:"vidgroup",text:"BST基礎",options:[
      {label:"Binary Search Tree | BST | Design & Algorithms",url:"https://www.youtube.com/watch?v=cvooTtquDlQ",dur:"10:49"},
      {label:"MIT 6.006 L5：Binary Search Trees, BST Sort",url:"https://www.youtube.com/watch?v=9Jry5-82I68",dur:"52:39"},
      {label:"交大彭文志 Lec24 Search Structures (1/3)：AVL Tree",url:"https://www.youtube.com/watch?v=nfDvFjXU2VI",dur:"45:30"}
    ]},
    {type:"vidgroup",text:"AVL Tree 旋轉",options:[
      {label:"MIT 6.006：AVL Trees, AVL Sort",url:"https://www.youtube.com/watch?v=FNeL18KsWPc",dur:"51:59"},
      {label:"MIT 6.006 Rec6：AVL Trees",url:"https://www.youtube.com/watch?v=IWzYoXKaRIc",dur:"53:27"},
      {label:"Abdul Bari：10.1 AVL Tree - Insertion and Rotations",url:"https://www.youtube.com/watch?v=jDM6_TnYIqE",dur:"43:08"},
      {label:"台大林軒田 DSA Skip List / BST / AVL Tree",url:"https://www.youtube.com/watch?v=Lzr5-m7ap-8",dur:"2:52:45"}
    ]},
    {type:"vidgroup",text:"紅黑樹 / 2-3-4樹",options:[
      {label:"台大林軒田 DSA AVL Tree / 2-3-4 Tree / Red-Black Tree",url:"https://www.youtube.com/watch?v=cH8nH0Enjhw",dur:"2:53:00"},
      {label:"台大林軒田 DSA 2-3-4 Tree / Red-Black Tree",url:"https://www.youtube.com/watch?v=gqphGLSGyQ4",dur:"2:58:50"},
      {label:"交大彭文志 Lec25 Search Structures (2/3)：Optimal BST、B-Tree、2-3／2-3-4 Tree",url:"https://www.youtube.com/watch?v=63Dp2MjLlUo",dur:"1:30:29"}
    ]},
    {type:"ex",text:"手畫AVL旋轉過程：給定插入序列，畫出每步旋轉 × 5組（課本習題）"},
    {type:"rec",text:"補充：搜尋「AVL Tree 題目 研究所」找練習題"}]},
  {n:"主題5",t:"Heap 與 Priority Queue",sub:"Min/Max Heap、Priority Queue",pri:"must",hrs:"8hr",wk:3,
   key:"建堆複雜度O(n)為何（bottom-up heapify）、Heap Sort複雜度O(n log n)、Priority Queue用途（Dijkstra等）",
   mats:[
    {type:"book",text:"資結七版（洪逸）Ch9-1 Min-Max Heap：建堆O(n)的推導是重點，搭配Q講義Q6"},
    {type:"vidgroup",text:"Heap 建堆與 Priority Queue",options:[
      {label:"Abdul Bari：Heap",url:"https://www.youtube.com/watch?v=HqPJF2L5h9U",dur:"51:08"},
      {label:"Priority Queue, Binary Heap",url:"https://www.youtube.com/watch?v=4tSdhWBVv6A",dur:"1:05:29"},
      {label:"台大林軒田 DSA Tree / Heap",url:"https://www.youtube.com/watch?v=RjvhXL0WTrY",dur:"2:46:39"},
      {label:"MIT 6.006 L4：Heaps and Heap Sort",url:"https://www.youtube.com/watch?v=B7hVxCmfPtM",dur:"52:32"}
    ]},
    {type:"ex",text:"給定陣列，手動建Max Heap並做Heap Sort，畫出每步 × 3題"}]},
  {n:"主題6",t:"雜湊表 Hash Table",sub:"Hash Function、衝突處理",pri:"must",hrs:"11.5hr",wk:3,
   key:"Chaining vs Open Addressing（Linear/Quadratic Probing、Double Hashing）、Load Factor對效率的影響、各方法worst case",
   peerNote:"同儕筆記地雷：linear probing在load factor過高時效率會劇烈下降；讀過的同儕筆記也沒提到hash table動態resize，這塊需另外靠課本補。",
   mats:[
    {type:"book",text:"資結七版（洪逸）Ch8 Hashing：8-3雜湊函數 + 8-4溢位處理（各解法比較） + Q講義Q6"},
    {type:"vidgroup",text:"雜湊表 Hash Table",options:[
      {label:"What is a HashTable Data Structure",url:"https://www.youtube.com/watch?v=MfhjkfocRR0",dur:"7:37"},
      {label:"Hashing - Collision Resolution with Linear Probing",url:"https://www.youtube.com/watch?v=CwM-Cxilk4g",dur:"16:41"},
      {label:"Abdul Bari：Hashing Technique - Simplified",url:"https://www.youtube.com/watch?v=mFY0J5W8Udk",dur:"17:04"},
      {label:"台大林軒田 DSA Heap / Hash Table",url:"https://www.youtube.com/watch?v=SBQLkYIDAZI",dur:"2:48:01"},
      {label:"台大林軒田 DSA Hash Table",url:"https://www.youtube.com/watch?v=WX-z52QweUs",dur:"2:50:15"},
      {label:"交大彭文志 Lec23 Hashing",url:"https://www.youtube.com/watch?v=bULIs7AVDNk",dur:"1:35:18"}
    ]},
    {type:"ex",text:"給定hash function和鍵值，手算Chaining和Linear Probing的表格 × 3題"}]},
  {n:"主題7",t:"圖（基礎）",sub:"有向/無向圖、表示法、DFS/BFS",pri:"must",hrs:"6.5hr",wk:4,
   key:"Adjacency Matrix vs List的空間/時間複雜度、DFS/BFS的時間複雜度（O(V+E)）、有向圖vs無向圖的矩陣對稱性",
   mats:[
    {type:"vidgroup",text:"圖的表示法與 DFS/BFS",options:[
      {label:"Graph Data Structure Intro（表示法）",url:"https://www.youtube.com/watch?v=DBRW8nwZV-g",dur:"4:53"},
      {label:"Abdul Bari：Graph Traversals - BFS & DFS",url:"https://www.youtube.com/watch?v=pcKY4hjDrxk",dur:"18:30"},
      {label:"交大彭文志 Lec18 Graph (1/4)",url:"https://www.youtube.com/watch?v=0fVJsIC1QXs",dur:"43:18"},
      {label:"交大彭文志 Lec19 Graph (2/4)",url:"https://www.youtube.com/watch?v=Ax1OL2mikJo",dur:"42:04"}
    ]},
    {type:"ex",text:"給定圖，手寫 Adjacency Matrix/List，並寫出 DFS/BFS 走訪順序 × 3 題"}
   ]},
  {n:"主題8",t:"排序演算法",sub:"Merge/Quick/Heap/Counting/Radix Sort",pri:"must",hrs:"12.5hr",wk:4,
   key:"所有排序的最佳/平均/最差複雜度表、穩定性比較（Merge/Insertion穩定、Quick/Heap不穩定）、Quick Sort的pivot選擇、Master Theorem三種情況、遞迴樹畫法",
   peerNote:"同儕筆記缺口：讀過的三份資料結構同儕筆記沒有一份完整涵蓋排序演算法比較，這章不能靠同儕筆記補，建議直接練課本習題與考古題。",
   mats:[
    {type:"vid",text:"Abdul Bari：Merge Sort",url:"https://www.youtube.com/watch?v=mB5HXBb_HY8",dur:"20:23"},
    {type:"vid",text:"Abdul Bari：Quick Sort",url:"https://www.youtube.com/watch?v=7h1s2SojIRw",dur:"13:42"},
    {type:"vid",text:"Abdul Bari：Heap Sort",url:"https://www.youtube.com/watch?v=HqPJF2L5h9U",dur:"51:08"},
    {type:"vidgroup",text:"Counting Sort / Radix Sort",options:[
      {label:"MIT 6.006 L7：Counting Sort, Radix Sort",url:"https://www.youtube.com/watch?v=Nz1KZXbghj8",dur:"52:08"},
      {label:"MIT 6.006 Rec7：Comparison/Counting/Radix Sort",url:"https://www.youtube.com/watch?v=9bkvws_vqLU",dur:"51:08"}
    ]},
    {type:"vidgroup",text:"排序總覽（完整課程角度）",options:[
      {label:"台大林軒田 DSA Sorting / Summary",url:"https://www.youtube.com/watch?v=cxbabnqtWsk",dur:"2:59:45"},
      {label:"交大彭文志 Lec22 Sorting",url:"https://www.youtube.com/watch?v=hXwxLgEOp-U",dur:"2:07:06"}
    ]},
    {type:"ex",text:"製作一張排序比較表（穩定性、最佳/平均/最差複雜度），貼在桌前"}
   ]},
  {n:"主題9",t:"進階樹：B-Tree、B+ Tree、Trie",sub:"B-Tree／B+ Tree（磁碟存取最佳化）、Trie（前綴搜尋）",pri:"hi",hrs:"5.5hr",wk:4,
   key:"B+Tree vs B-Tree差異（所有資料在葉節點）、B-Tree分裂/合併操作、Trie用途（字典、前綴搜尋）",
   mats:[
    {type:"book",text:"資結七版（洪逸）Ch9 Advanced Tree Structure：9-11 B樹 + 9-6 AVL樹 + 9-10紅黑樹"},
    {type:"vidgroup",text:"B-Tree / B+ Tree",options:[
      {label:"B-Tree Insertion",url:"https://www.youtube.com/watch?v=IilVRpUsAiQ",dur:"7:18"},
      {label:"Abdul Bari：B Trees and B+ Trees",url:"https://www.youtube.com/watch?v=aZjYr87r1b8",dur:"39:41"},
      {label:"交大彭文志 Lec26 Search Structures (3/3)",url:"https://www.youtube.com/watch?v=ucL0BLz2OGk",dur:"36:17"}
    ]},
    {type:"vid",text:"HackerRank：Data Structures — Tries",url:"https://www.youtube.com/watch?v=zIjfhVPRZCg",dur:"4:54"},
    {type:"ex",text:"給定插入序列，手動建B-Tree並模擬分裂 × 2題"}]},
  {n:"主題10",t:"圖演算法",sub:"Dijkstra、Kruskal、Prim、Bellman-Ford",pri:"must",hrs:"10hr",wk:4,
   key:"Dijkstra限制（無負邊）vs Bellman-Ford（可處理負邊）、MST兩種演算法複雜度比較、Greedy正確性",
   peerNote:"同儕筆記缺口：讀過的三份資料結構同儕筆記沒有一份完整涵蓋圖論最短路徑，這章不能靠同儕筆記補，建議直接練課本習題與考古題。Kruskal／Prim／MST本質是同一組安全邊（safe edge）與cut-and-paste正確性證明，不是三種互斥知識。",
   mats:[
    {type:"book",text:"資結七版（洪逸）Ch6-4 最小成本展開樹（Kruskal/Prim）+ Ch6-5 最短路徑（Dijkstra）+ Q講義Q5"},
    {type:"vidgroup",text:"Dijkstra 最短路徑",options:[
      {label:"Dijkstra Algorithm（圖解最清楚）",url:"https://www.youtube.com/watch?v=HlFsexTpM4Q",dur:"13:44"},
      {label:"交大彭文志 Lec20 Graph (3/4)",url:"https://www.youtube.com/watch?v=Wnpsh1O1OMo",dur:"2:03:31"}
    ]},
    {type:"vidgroup",text:"最小生成樹 MST（Kruskal / Prim）",options:[
      {label:"Minimum Cost Spanning Tree | Kruskal's & Prim's",url:"https://www.youtube.com/watch?v=JR2fneVevbg",dur:"10:35"},
      {label:"Abdul Bari：Prims and Kruskals Algorithms",url:"https://www.youtube.com/watch?v=4ZlRH0eK-qQ",dur:"20:12"},
      {label:"交大彭文志 Lec21 Graph (4/4)：AOV／AOE、Topological Order、Critical Path",url:"https://www.youtube.com/watch?v=Yx0dJFe1VdM",dur:"42:45"}
    ]},
    {type:"vid",text:"Abdul Bari：Disjoint Sets Data Structure（Kruskal的前置知識：Union-Find）",url:"https://www.youtube.com/watch?v=wU6udHRIkcc",dur:"26:04"},
    {type:"ex",text:"給定加權圖，手算Dijkstra和Kruskal的執行過程 × 3題"}]},
  {n:"主題11",t:"字串處理：KMP",sub:"字串比對：KMP、Rabin-Karp",pri:"hi",hrs:"5.5hr",wk:6,
   key:"KMP的Failure Function建構步驟、KMP為何O(n+m)",
   peerNote:"同儕筆記提醒：KMP演算法通常需要額外花時間才能真正搞懂，不要輕估這章，多演練Failure Function手算題。",
   mats:[
    {type:"book",text:"資結七版（洪逸）Ch7-1搜尋（含KMP相關）+ 演算法~1~（林立宇）Ch3-7 KMP Algorithm"},
    {type:"vid",text:"Knuth-Morris-Pratt（KMP）String Matching Algorithm",url:"https://www.youtube.com/watch?v=V5-7GzOfADQ",dur:"18:55",note:"這集講得非常清楚"},
    {type:"vid",text:"MIT 6.006 Rec9b：DNA Sequence Matching",url:"https://www.youtube.com/watch?v=-DwGrJ8JxDc",dur:"57:27"},
    {type:"vid",text:"Abdul Bari：9.2 Rabin-Karp String Matching Algorithm",url:"https://www.youtube.com/watch?v=qQ8vS2btsxI",dur:"23:50"},
    {type:"ex",text:"給定pattern，手建Failure Function × 3題"}]}]},
{id:"alg",name:"演算法",color:"#9B7EF4",hours:127.5,weeks:3,coverage:"全11校",
tip:"DP是最常出大題的考點，主題3、4要花最多時間，務必手推LCS、Knapsack狀態轉移表。NP理論以理解概念與歸約思路為主。同一主題有多位老師時，完成任一版本即可。",
 recommended_books:[
   {name:"演算法～1～（林立宇老師／TKB）",note:"✅ 你有這本。共7章含習題，作為主要教材"},
   {name:"The Design and Analysis of Computer Algorithms — Aho, Hopcroft & Ullman",note:"林立宇教材列出的參考書"},
   {name:"Introduction to Algorithms — Cormen, Leiserson, Rivest & Stein（CLRS）",note:"林立宇教材列出的參考書"},
   {name:"Fundamentals of Data Structures in C++ — Horowitz",note:"林立宇教材列出的參考書"},
   {name:"Algorithm Design — Kleinberg & Tardos",note:"林立宇教材列出的參考書"},
   {name:"Introduction to the Design and Analysis of Algorithms — Lee, Tseng, Chang & Tsai",note:"林立宇教材列出的參考書"},
   {name:"Introduction to the Design and Analysis of Algorithms — Levitin",note:"林立宇教材列出的參考書"},
   {name:"Introduction to Algorithms: A Creative Approach — Manber",note:"林立宇教材列出的參考書"}],
 recommended_videos:[
   {name:"Abdul Bari：Merge Sort",url:"https://www.youtube.com/watch?v=mB5HXBb_HY8",note:"分治法的標準範例，之後講DP、Master Theorem都會回頭參照這支"},
   {name:"MIT 6.006 L19：DP I",url:"https://www.youtube.com/watch?v=OQ5jsbhAv_M",note:"DP入門講得最完整，先看這支再進各章節的DP例題"},
   {name:"Master's Theorem Explained",url:"https://www.youtube.com/watch?v=SLsHKh_OUEM",note:"7分鐘講完三種情況怎麼判斷，複雜度分析章節前先看"}],
 chapters:[
  {n:"主題1",t:"複雜度與遞迴",sub:"Recurrence Relation、Master Theorem",pri:"must",hrs:"25.5hr",wk:5,
   key:"Master Theorem三種情況的判斷、遞迴樹展開法、Substitution Method基本操作",
   peerNote:"同儕筆記提醒：依考古頻率統計，Time Complexity在清大／交大／台大都被列五星必考範圍；Master定理與遞迴樹法要能手算，不能只會套公式。",
   mats:[
    {type:"book",text:"演算法~1~（林立宇）Ch1 Analyzing Algorithms：1.1 Asymptotic notation + 1.2 Recurrence relation"},
    {type:"vidgroup",text:"演算法導論／課程介紹",options:[
      {label:"Abdul Bari：1.2 Characteristics of Algorithm",url:"https://www.youtube.com/watch?v=FbYzBWdhMb0",dur:"5:37"},
      {label:"Abdul Bari：1.3 How to Write and Analyze Algorithm",url:"https://www.youtube.com/watch?v=xGYsEqe9Vl0",dur:"10:37"},
      {label:"Abdul Bari：1. Introduction to Algorithms",url:"https://www.youtube.com/watch?v=0IAPZzGSbME",dur:"11:49"},
      {label:"交大江蕙如 Lec01 課程介紹",url:"https://www.youtube.com/watch?v=7a28lIQIHJQ",dur:"26:24"},
      {label:"交大江蕙如 Lec02 Chapter 1 Introduction (1/2)",url:"https://www.youtube.com/watch?v=kxIQ86qMtfk",dur:"1:38:25"},
      {label:"交大江蕙如 Lec03 Chapter 1 Introduction (2/2)",url:"https://www.youtube.com/watch?v=OVhJHBYJLSE",dur:"1:06:37"},
      {label:"MIT 6.006 L1：Algorithmic Thinking, Peak Finding",url:"https://www.youtube.com/watch?v=HtSuA80QTyo",dur:"53:21"},
      {label:"MIT 6.006 L2：Models of Computation, Document Distance",url:"https://www.youtube.com/watch?v=Zc54gFhdpLA",dur:"48:51"},
      {label:"MIT 6.006 Rec1：Asymptotic Complexity, Peak Finding",url:"https://www.youtube.com/watch?v=P7frcB_-g4w",dur:"53:49"},
      {label:"MIT 6.006 Rec2：Python Cost Model, Document Distance",url:"https://www.youtube.com/watch?v=QFcyt8fgQMU",dur:"52:21"}
    ]},
    {type:"vidgroup",text:"複雜度分析 Asymptotic Notation（Big-O/Θ/Ω）",options:[
      {label:"Abdul Bari：1.1 Priori Analysis and Posteriori Testing",url:"https://www.youtube.com/watch?v=-JTq1BFBwmo",dur:"1:48"},
      {label:"Abdul Bari：1.4 Frequency Count Method",url:"https://www.youtube.com/watch?v=1U3Uwct45IY",dur:"12:22"},
      {label:"Abdul Bari：1.5.1 Time Complexity #1",url:"https://www.youtube.com/watch?v=9TlHvipP5yA",dur:"9:44"},
      {label:"Abdul Bari：1.5.2 Time Complexity Example #2",url:"https://www.youtube.com/watch?v=9SgLBjXqwd4",dur:"14:13"},
      {label:"Abdul Bari：1.5.3 Time Complexity of While and if #3",url:"https://www.youtube.com/watch?v=p1EnSvS3urU",dur:"21:54"},
      {label:"Abdul Bari：1.6 Classes of Functions",url:"https://www.youtube.com/watch?v=w7t4_JUUTeg",dur:"3:10"},
      {label:"Abdul Bari：1.7 Compare Class of Functions",url:"https://www.youtube.com/watch?v=5v-tKX2uRAk",dur:"5:11"},
      {label:"Abdul Bari：1.8.1 Asymptotic Notations #1",url:"https://www.youtube.com/watch?v=A03oI0znAoc",dur:"15:46"},
      {label:"Abdul Bari：1.8.2 Asymptotic Notations #2",url:"https://www.youtube.com/watch?v=Nd0XDY-jVHs",dur:"10:07"},
      {label:"Abdul Bari：1.9 Properties of Asymptotic Notations",url:"https://www.youtube.com/watch?v=NI4OKSvGAgM",dur:"11:58"},
      {label:"Abdul Bari：1.10.1 Comparison of Functions #1",url:"https://www.youtube.com/watch?v=mwN18xfwNhk",dur:"9:28"},
      {label:"Abdul Bari：1.10.2 Comparison of Functions #2",url:"https://www.youtube.com/watch?v=WlBBTSL0ZRc",dur:"10:26"},
      {label:"Abdul Bari：1.11 Best Worst and Average Case Analysis",url:"https://www.youtube.com/watch?v=lj3E24nnPjI",dur:"18:56"},
      {label:"Abdul Bari：Asymptotic Notations - Simplified",url:"https://www.youtube.com/watch?v=ddsP7NecEBk",dur:"22:44"},
      {label:"交大江蕙如 Lec04 Chapter 2 Algorithm Analysis (1/2)",url:"https://www.youtube.com/watch?v=rP2wm4bEfXo",dur:"1:19:00"},
      {label:"交大江蕙如 Lec05 Chapter 2 Algorithm Analysis (2/2)",url:"https://www.youtube.com/watch?v=tTFolqL1TX4",dur:"1:05:09"}
    ]},
    {type:"vidgroup",text:"遞迴關係式與 Master Theorem",options:[
      {label:"Master's Theorem Explained",url:"https://www.youtube.com/watch?v=SLsHKh_OUEM",dur:"7:19"},
      {label:"Abdul Bari：Recurrence Relation Dividing [T(n)=T(n/2)+n]",url:"https://www.youtube.com/watch?v=XcZw01FuH18",dur:"7:26"},
      {label:"Abdul Bari：2.1.1 Recurrence Relation #1",url:"https://www.youtube.com/watch?v=4V30R3I1vLI",dur:"13:43"},
      {label:"Abdul Bari：2.1.2 Recurrence Relation #2",url:"https://www.youtube.com/watch?v=IawM82BQ4II",dur:"16:00"},
      {label:"Abdul Bari：2.1.3 Recurrence Relation #3",url:"https://www.youtube.com/watch?v=MhT7XmxhaCE",dur:"12:25"},
      {label:"Abdul Bari：2.1.4 Recurrence Relation #4",url:"https://www.youtube.com/watch?v=JvcqtZk2mng",dur:"10:42"},
      {label:"Abdul Bari：2.2 Masters Theorem Decreasing Function",url:"https://www.youtube.com/watch?v=CyknhZbfMqc",dur:"8:10"},
      {label:"Abdul Bari：2.3.1 Recurrence Dividing Function #1",url:"https://www.youtube.com/watch?v=8gt0D0IqU5w",dur:"8:41"},
      {label:"Abdul Bari：2.3.3 Recurrence [T(n)=2T(n/2)+n] #3",url:"https://www.youtube.com/watch?v=1K9ebQJosvo",dur:"11:20"},
      {label:"Abdul Bari：2.4.1 Masters Theorem Dividing #1",url:"https://www.youtube.com/watch?v=OynWkEj0S-s",dur:"16:50"},
      {label:"Abdul Bari：2.4.2 Examples for Master Theorem #2",url:"https://www.youtube.com/watch?v=kGcO-nAm9Vc",dur:"5:41"},
      {label:"Abdul Bari：2.5 Root Function",url:"https://www.youtube.com/watch?v=9rVuyjxzwgM",dur:"5:37"},
      {label:"Abdul Bari：Tower of Hanoi Problem",url:"https://www.youtube.com/watch?v=q6RicK1FCUs",dur:"9:32"},
      {label:"MIT 6.006 Rec5：Recursion Trees, Binary Search Trees",url:"https://www.youtube.com/watch?v=r5pXu1PAUkI",dur:"59:15"}
    ]},
    {type:"vidgroup",text:"雜湊 Hashing（MIT課程順序提前教，補充用）",options:[
      {label:"MIT 6.006 L8：Hashing with Chaining",url:"https://www.youtube.com/watch?v=0M_kIqhwbFo",dur:"51:15"},
      {label:"MIT 6.006 L9：Table Doubling, Karp-Rabin",url:"https://www.youtube.com/watch?v=BRO7mVIFt08",dur:"52:46"},
      {label:"MIT 6.006 L10：Open Addressing, Cryptographic Hashing",url:"https://www.youtube.com/watch?v=rvdJDijO2Ro",dur:"50:54"},
      {label:"MIT 6.006 Rec9：Rolling Hashes, Amortized Analysis",url:"https://www.youtube.com/watch?v=w6nuXg0BISo",dur:"1:01:00"}
    ]},
    {type:"vidgroup",text:"Quiz複習／演算法設計原則（補充，非必要）",options:[
      {label:"MIT 6.006 Rec10：Quiz 1 Review",url:"https://www.youtube.com/watch?v=-FElVPKykgw",dur:"54:48"},
      {label:"MIT 6.006 Rec11：Principles of Algorithm Design",url:"https://www.youtube.com/watch?v=a_otxyu0mSQ",dur:"58:26"}
    ]},
    {type:"ex",text:"給定遞迴式，用Master Theorem判斷複雜度 × 10題（課本習題）"}]},
  {n:"主題2",t:"分治法 Divide and Conquer",sub:"Merge Sort推導、Binary Search、Strassen／Karatsuba、Maximum Subarray",pri:"must",hrs:"14hr",wk:5,
   key:"分治法三步驟（Divide/Conquer/Combine）、Merge Sort複雜度推導、Matrix Multiplication（Strassen）",
   mats:[
    {type:"book",text:"演算法~1~（林立宇）Ch2 Divide-and-Conquer：2.1–2.5全部（含matrix multiplication、selection problem）"},
    {type:"vidgroup",text:"分治法總覽 / 介紹",options:[
      {label:"Abdul Bari：2 Divide And Conquer（介紹）",url:"https://www.youtube.com/watch?v=2Rr2tW9zvRg",dur:"7:04"},
      {label:"交大江蕙如 Lec15 Divide and Conquer (1/2)",url:"https://www.youtube.com/watch?v=62uS-MOv0bY",dur:"57:36"},
      {label:"交大江蕙如 Lec16 Divide and Conquer (2/2)",url:"https://www.youtube.com/watch?v=sweW4TVFpbQ",dur:"1:37:20"}
    ]},
    {type:"vidgroup",text:"Merge Sort",options:[
      {label:"Abdul Bari：Merge Sort",url:"https://www.youtube.com/watch?v=mB5HXBb_HY8",dur:"20:23"},
      {label:"Abdul Bari：Merge Sort - Hindi",url:"https://www.youtube.com/watch?v=zXhWPrMLXGo",dur:"16:38"},
      {label:"MIT 6.006 L3：Insertion Sort, Merge Sort",url:"https://www.youtube.com/watch?v=Kg4bqzAqRBM",dur:"51:19"},
      {label:"Abdul Bari：2.7.1 Two Way MergeSort - Iterative",url:"https://www.youtube.com/watch?v=6pV2IF0fgKY",dur:"20:19"},
      {label:"Abdul Bari：2.7.3 MergeSort In-Depth Analysis",url:"https://www.youtube.com/watch?v=ak-pz7tS5DE",dur:"13:28"},
      {label:"MIT 6.006 Rec3：Document Distance, Insertion and Merge Sort",url:"https://www.youtube.com/watch?v=4iXLnF3hExw",dur:"54:10"}
    ]},
    {type:"vidgroup",text:"Binary Search",options:[
      {label:"Abdul Bari：2.6.1 Binary Search Iterative Method",url:"https://www.youtube.com/watch?v=C2apEw9pgtw",dur:"19:36"},
      {label:"Abdul Bari：2.6.2 Binary Search Recursive Method",url:"https://www.youtube.com/watch?v=uEUXGcc2VXM",dur:"7:11"}
    ]},
    {type:"vidgroup",text:"快速乘法 / 開根號（Karatsuba, Strassen, Newton's Method）",options:[
      {label:"MIT 6.006 L11：Integer Arithmetic, Karatsuba Multiplication",url:"https://www.youtube.com/watch?v=eCaXlAaN2uE",dur:"47:23"},
      {label:"MIT 6.006 L12：Square Roots, Newton's Method",url:"https://www.youtube.com/watch?v=2YeJ-5UAke8",dur:"51:16"},
      {label:"MIT 6.006 Rec12：Karatsuba Multiplication, Newton's Method",url:"https://www.youtube.com/watch?v=JRgIXyEPnbA",dur:"53:08"},
      {label:"Abdul Bari：2.9 Strassens Matrix Multiplication",url:"https://www.youtube.com/watch?v=0oJyNmEbS4w",dur:"23:40"}
    ]},
    {type:"vid",text:"Maximum Subarray solution using Divide & Conquer | Kadane",url:"https://www.youtube.com/watch?v=u7YMFRUFqe0",dur:"10:11"},
    {type:"vid",text:"Abdul Bari：2.8.2 QuickSort Analysis",url:"https://www.youtube.com/watch?v=-qOVVRIZzao",dur:"11:37"},
    {type:"ex",text:"手推Merge Sort遞迴樹並推導T(n)=2T(n/2)+n的解 × 3遍"}]},
  {n:"主題3",t:"動態規劃（基礎）",sub:"Memoization、Bottom-up DP、LCS、LIS、Knapsack",pri:"must",hrs:"13.5hr",wk:5,
   key:"DP兩要素：最優子結構＋重疊子問題；LCS的狀態轉移表手推；0/1 Knapsack的dp[i][w]定義；LIS的O(n²)和O(n log n)解法",
   peerNote:"同儕筆記提醒：DP章節多數只是把遞迴關係式化簡，真正需要額外花時間搞懂的是字串處理科（見資料結構主題11）的KMP演算法。DP程式碼最好背到能上機驗證，不是只會紙上寫轉移式。",
   mats:[
    {type:"book",text:"演算法~1~（林立宇）Ch3 Dynamic Programming：3.2 rod cutting → 3.3 knapsack → 3.4 matrix chain → 3.6 LCS，每題手推"},{type:"book",text:"注意：Ch3也含3.7 KMP Algorithm，資結和演算法都有考"},
    {type:"vidgroup",text:"DP 入門總覽（LCS等基礎範例）",options:[
      {label:"MIT 6.006 L19：DP I: Fibonacci, Shortest Paths",url:"https://www.youtube.com/watch?v=OQ5jsbhAv_M",dur:"51:47"},
      {label:"MIT 6.006 L20：DP II: Text Justification, Blackjack",url:"https://www.youtube.com/watch?v=ENyox7kNKeY",dur:"52:11"},
      {label:"交大江蕙如 Lec17 Dynamic Programming (1/3)",url:"https://www.youtube.com/watch?v=359YMyqbEG4",dur:"1:33:44"},
      {label:"交大江蕙如 Lec18 Dynamic Programming (2/3)",url:"https://www.youtube.com/watch?v=dkmxHij2pfU",dur:"1:41:52"},
      {label:"交大江蕙如 Lec19 Dynamic Programming (3/3)",url:"https://www.youtube.com/watch?v=S5vS9YEvnFU",dur:"56:33"},
      {label:"Abdul Bari：4 Principle of Optimality",url:"https://www.youtube.com/watch?v=5dRGRueKU3M",dur:"14:52"}
    ]},
    {type:"vidgroup",text:"MultiStage Graph DP",options:[
      {label:"Abdul Bari：4.1 MultiStage Graph",url:"https://www.youtube.com/watch?v=9iE9Mj4m8jk",dur:"21:07"},
      {label:"Abdul Bari：4.1.1 MultiStage Graph (Program)",url:"https://www.youtube.com/watch?v=FcScLYJI42E",dur:"14:26"}
    ]},
    {type:"vidgroup",text:"0/1 Knapsack DP",options:[
      {label:"Abdul Bari：4.5 0/1 Knapsack - Two Methods",url:"https://www.youtube.com/watch?v=nLmhmB6NzcM",dur:"28:24"},
      {label:"Abdul Bari：4.5.1 0/1 Knapsack Problem (Program)",url:"https://www.youtube.com/watch?v=zRza99HPvkQ",dur:"17:00"},
      {label:"MIT 6.006 Rec21：DP Knapsack Problem",url:"https://www.youtube.com/watch?v=wFP5VHGHFdk",dur:"1:09:11"}
    ]},
    {type:"vidgroup",text:"旅行推銷員 TSP（DP解法）",options:[
      {label:"Abdul Bari：4.7 TSP - DP",url:"https://www.youtube.com/watch?v=XaXsJJh-Q5Y",dur:"15:25"},
      {label:"Abdul Bari：4.7 [New] TSP - DP using Formula",url:"https://www.youtube.com/watch?v=Q4zHb-Swzro",dur:"17:18"}
    ]},
    {type:"vidgroup",text:"DP 練習範例（Crazy Eights / Blackjack，補充）",options:[
      {label:"MIT 6.006 Rec19：DP Crazy Eights, Shortest Path",url:"https://www.youtube.com/watch?v=IFrvgSvZA0I",dur:"52:47"},
      {label:"MIT 6.006 Rec20：DP Blackjack",url:"https://www.youtube.com/watch?v=jZbkToeNK2g",dur:"52:58"}
    ]},
    {type:"vid",text:"Abdul Bari：4.9 Longest Common Subsequence (LCS)",url:"https://www.youtube.com/watch?v=sSno9rV8Rhg",dur:"23:35"},
    {type:"ex",text:"LCS：手推兩個字串的狀態表並回溯答案 × 5題"},
    {type:"ex",text:"0/1 Knapsack：手推dp table × 3題"},
    {type:"ex",text:"各校歷屆DP題（從成大、中央開始，難度適中）"}]},
  {n:"主題4",t:"動態規劃（進階）",sub:"Matrix Chain、Optimal BST、Edit Distance",pri:"hi",hrs:"9hr",wk:6,
   key:"Matrix Chain Multiplication的狀態轉移m[i][j]定義、Optimal BST期望搜尋次數計算",
   mats:[
    {type:"book",text:"演算法~1~（林立宇）Ch3-4 Matrix-chain multiplication + Ch3-5 Optimal binary search trees"},
    {type:"vidgroup",text:"Matrix Chain Multiplication",options:[
      {label:"Abdul Bari：Matrix Chain Multiplication",url:"https://www.youtube.com/watch?v=_WncuhSJZyA",dur:"52:01"},
      {label:"Abdul Bari：4.3 Matrix Chain Multiplication - DP",url:"https://www.youtube.com/watch?v=prx1psByp7U",dur:"23:00"},
      {label:"Abdul Bari：4.3.1 Matrix Chain Multiplication (Program)",url:"https://www.youtube.com/watch?v=eKkXU3uu2zk",dur:"18:40"}
    ]},
    {type:"vidgroup",text:"Optimal Binary Search Tree",options:[
      {label:"Abdul Bari：Optimal BST (Successful Search Only)",url:"https://www.youtube.com/watch?v=vLS-zRCHo-Y",dur:"30:19"},
      {label:"Abdul Bari：4.6.2 Optimal BST Successful and Unsuccessful",url:"https://www.youtube.com/watch?v=wAy6nDMPYAE",dur:"57:00"}
    ]},
    {type:"vid",text:"MIT 6.006 L21：DP III: Parenthesization, Edit Distance, Knapsack",url:"https://www.youtube.com/watch?v=ocZMDMZwhCY",dur:"52:41"},
    {type:"vid",text:"MIT 6.006 L22：DP IV: Guitar Fingering, Tetris, Super Mario Bros.（進階DP範例，補充）",url:"https://www.youtube.com/watch?v=tp4_UXaVyx8",dur:"49:19"},
    {type:"vid",text:"MIT 6.006 Rec22：DP: Dance Dance Revolution（進階DP範例，補充）",url:"https://www.youtube.com/watch?v=PptQgy89cN8",dur:"53:15"},
    {type:"vid",text:"Abdul Bari：4.8 Reliability Design - DP",url:"https://www.youtube.com/watch?v=uJOmqBwENB8",dur:"26:32"},
    {type:"ex",text:"Matrix Chain：給定矩陣維度，手填m[i][j]表格 × 3題"}]},
  {n:"主題5",t:"貪婪演算法 Greedy",sub:"Activity Selection、Huffman Code、Fractional Knapsack",pri:"must",hrs:"11.5hr",wk:6,
   key:"Greedy vs DP的選擇判斷、Activity Selection的正確性證明思路、Huffman Tree建構步驟",
   mats:[
    {type:"book",text:"演算法~1~（林立宇）Ch1 Amortized analysis（1.3）+ 貪婪相關融入各章習題"},
    {type:"vidgroup",text:"Greedy 總覽 / 介紹",options:[
      {label:"Abdul Bari：Greedy Method - Introduction",url:"https://www.youtube.com/watch?v=ARvQcqJ_-NY",dur:"12:02"},
      {label:"交大江蕙如 Lec10 Greedy Algorithms (1/5)",url:"https://www.youtube.com/watch?v=hZjp35QI-40",dur:"1:15:23"},
      {label:"交大江蕙如 Lec11 Greedy Algorithms (2/5)",url:"https://www.youtube.com/watch?v=0UGaXukC4b0",dur:"1:33:33"},
      {label:"交大江蕙如 Lec12 Greedy Algorithms (3/5)",url:"https://www.youtube.com/watch?v=yWZHGsd06dA",dur:"56:20"},
      {label:"交大江蕙如 Lec13 Greedy Algorithms (4/5)",url:"https://www.youtube.com/watch?v=trkaH2uLxHw",dur:"1:15:47"},
      {label:"交大江蕙如 Lec14 Greedy Algorithms (5/5)",url:"https://www.youtube.com/watch?v=iKhB0YbBRDI",dur:"1:10:06"}
    ]},
    {type:"vid",text:"Abdul Bari：Huffman Coding - Greedy Method",url:"https://www.youtube.com/watch?v=co4_ahEDCho",dur:"17:32"},
    {type:"vid",text:"Abdul Bari：3.1 Knapsack Problem - Greedy Method",url:"https://www.youtube.com/watch?v=oTTzNMHM05I",dur:"15:30"},
    {type:"vid",text:"Abdul Bari：3.2 Job Sequencing with Deadlines - Greedy Method",url:"https://www.youtube.com/watch?v=zPtI8q9gvX8",dur:"13:29"},
    {type:"vid",text:"Abdul Bari：3.3 Optimal Merge Pattern - Greedy Method",url:"https://www.youtube.com/watch?v=HHIc5JZyenI",dur:"9:33"},
    {type:"ex",text:"給定字元頻率，手建Huffman Tree並計算平均編碼長度 × 3題"}]},
  {n:"主題6",t:"圖論演算法",sub:"BFS、DFS、Topological Sort、SCC",pri:"must",hrs:"16.5hr",wk:7,
   key:"Topological Sort兩種方法（DFS後序逆序 vs Kahn's BFS）、Strongly Connected Component（Kosaraju/Tarjan演算法概念）",
   peerNote:"同儕筆記提醒：Graph Algorithm整體在清大／交大／台大都被列五星必考範圍。Kruskal／Prim／MST（見資料結構主題10）本質是同一組安全邊（safe edge）與cut-and-paste正確性證明，交叉看能一次理解三種寫法。",
   mats:[
    {type:"vidgroup",text:"BFS / DFS 基礎",options:[
      {label:"Abdul Bari：BFS",url:"https://www.youtube.com/watch?v=pcKY4hjDrxk",dur:"18:30"},
      {label:"WilliamFiset：DFS",url:"https://www.youtube.com/watch?v=7fujbpJ0LB4",dur:"10:20"},
      {label:"Abdul Bari：BFS DFS - Simplified",url:"https://www.youtube.com/watch?v=kyUpc_5705s",dur:"19:13"},
      {label:"MIT 6.006 L13：BFS",url:"https://www.youtube.com/watch?v=s-CYnVz-uh4",dur:"50:47"},
      {label:"MIT 6.006 L14：DFS, Topological Sort",url:"https://www.youtube.com/watch?v=AfSk24UTFS8",dur:"50:30"},
      {label:"MIT 6.006 Rec13：BFS",url:"https://www.youtube.com/watch?v=5JxShDZ_ylo",dur:"54:52"},
      {label:"MIT 6.006 Rec14：DFS",url:"https://www.youtube.com/watch?v=C5SPsY72_CM",dur:"53:38"}
    ]},
    {type:"vidgroup",text:"圖論總覽（完整課程角度）",options:[
      {label:"交大江蕙如 Lec06 Graphs (1/4)",url:"https://www.youtube.com/watch?v=24akv3pVt28",dur:"1:30:24"},
      {label:"交大江蕙如 Lec07 Graphs (2/4)",url:"https://www.youtube.com/watch?v=FvUs-OlAy18",dur:"1:31:10"},
      {label:"交大江蕙如 Lec08 Graphs (3/4)",url:"https://www.youtube.com/watch?v=r5CTlHdo9Oo",dur:"51:18"},
      {label:"交大江蕙如 Lec09 Graphs (4/4)",url:"https://www.youtube.com/watch?v=OQDaruIDCjY",dur:"1:34:03"}
    ]},
    {type:"vid",text:"Tushar Roy：Topological Sort",url:"https://www.youtube.com/watch?v=ddTC4Zovtbc",dur:"10:31"},
    {type:"vid",text:"Tushar Roy：Strongly Connected Components",url:"https://www.youtube.com/watch?v=RpgcYiky7uw",dur:"24:29"},
    {type:"vid",text:"Abdul Bari：5.2 Articulation Point and Biconnected Components",url:"https://www.youtube.com/watch?v=jFZsDDB0-vo",dur:"8:37"},
    {type:"vid",text:"MIT 6.006 Rec16：Rubik's Cube, StarCraft Zero（圖搜尋應用，補充）",url:"https://www.youtube.com/watch?v=oRpERQA4Vik",dur:"54:35"},
    {type:"ex",text:"給定有向圖，找出 Topological Order + SCC × 3 題"}
   ]},
  {n:"主題7",t:"最短路徑",sub:"Dijkstra、Bellman-Ford、Floyd-Warshall",pri:"must",hrs:"12hr",wk:7,
   key:"三種演算法的適用場景（無負邊/有負邊/All-Pairs）、複雜度比較、Negative Cycle偵測",
   peerNote:"同儕筆記提醒：最短路徑屬於Graph Algorithm大類，在清大／交大／台大都被列五星必考範圍，優先度不能放低。",
   mats:[
    {type:"book",text:"演算法~1~（林立宇）Ch4 Graph Algorithms：4.3 Single-source + 4.4 All-pairs shortest paths"},
    {type:"vidgroup",text:"Dijkstra 最短路徑",options:[
      {label:"Dijkstra Algorithm",url:"https://www.youtube.com/watch?v=HlFsexTpM4Q",dur:"13:44"},
      {label:"MIT 6.006 L15：Single-Source Shortest Paths Problem",url:"https://www.youtube.com/watch?v=Aa2sqUhIn-E",dur:"53:15"},
      {label:"MIT 6.006 L16：Dijkstra",url:"https://www.youtube.com/watch?v=2E7MmKv0Y24",dur:"51:25"},
      {label:"MIT 6.006 L18：Speeding up Dijkstra",url:"https://www.youtube.com/watch?v=CHvQ3q_gJ7E",dur:"53:15"},
      {label:"Abdul Bari：3.6 Dijkstra Algorithm",url:"https://www.youtube.com/watch?v=XB4MIexjvY0",dur:"18:35"}
    ]},
    {type:"vidgroup",text:"Bellman-Ford",options:[
      {label:"Bellman Ford Algorithm",url:"https://www.youtube.com/watch?v=FrLWd1tJ_Wc",dur:"17:51"},
      {label:"MIT 6.006 L17：Bellman-Ford",url:"https://www.youtube.com/watch?v=ozsuci5pIso",dur:"48:50"},
      {label:"Abdul Bari：4.4 Bellman Ford Algorithm - DP",url:"https://www.youtube.com/watch?v=FtN3BYH2Zes",dur:"17:12"}
    ]},
    {type:"vid",text:"Abdul Bari：4.2 All Pairs Shortest Path (Floyd-Warshall)",url:"https://www.youtube.com/watch?v=oNI0rf2P9gE",dur:"14:13"},
    {type:"vid",text:"Abdul Bari：Shortest Path Algorithms (Dijkstra/Bellman-Ford) - Simplified",url:"https://www.youtube.com/watch?v=2raV0H9KqY8",dur:"26:13"},
    {type:"vidgroup",text:"補充練習 / Quiz複習",options:[
      {label:"MIT 6.006 Rec15：Shortest Paths",url:"https://www.youtube.com/watch?v=mQSp6VmfakA",dur:"56:30"},
      {label:"MIT 6.006 Rec18：Quiz 2 Review",url:"https://www.youtube.com/watch?v=sPuazUPiV1k",dur:"1:05:30"}
    ]},
    {type:"ex",text:"給定加權圖，手算Bellman-Ford每輪鬆弛結果 × 2題"}]},
  {n:"主題8",t:"最大流 / 二分圖匹配",sub:"Ford-Fulkerson、Bipartite Matching",pri:"hi",hrs:"7hr",wk:7,
   key:"Min-Cut Max-Flow定理（概念）、Residual Graph、Augmenting Path、二分圖匹配與最大流的關係",
   peerNote:"同儕筆記提醒：讀過的「演算法期末考筆記」對最大流／二分圖匹配整理得完整（對應CLRS Ch12–26整體架構），可交叉參考核對手算流程。",
   mats:[
    {type:"book",text:"演算法~1~（林立宇）Ch4-6 Maximum flow：Ford-Fulkerson完整章節"},
    {type:"vidgroup",text:"最大流 Max Flow（Ford-Fulkerson）",options:[
      {label:"Ford Fulkerson Algorithm for Maximum Flow Problem",url:"https://www.youtube.com/watch?v=Iwc3Uj4aaF4",dur:"9:05"},
      {label:"交大江蕙如 Lec20 Network Flow (1/2)",url:"https://www.youtube.com/watch?v=lY1SKWSR3pk",dur:"1:31:24"},
      {label:"交大江蕙如 Lec21 Network Flow (2/2)",url:"https://www.youtube.com/watch?v=NOYNTuhXDGU",dur:"1:17:06"}
    ]},
    {type:"ex",text:"給定網路圖，手算最大流（標記每步Augmenting Path）× 2題"}]},
  {n:"主題9",t:"NP理論",sub:"P、NP、NP-Hard、NP-Complete、Reduction",pri:"must",hrs:"9.5hr",wk:7,
   key:"P⊆NP、Cook-Levin定理（概念）、常見NP-Complete問題清單（SAT/3-SAT、Vertex Cover、Clique、TSP、Subset Sum）、Reduction方向——有讀書筆記提到不同學校深淺不一：清大偏好要求寫出完整的Reduction證明過程，交大則常考Hamiltonian Cycle等具體問題的應用題，兩種都要練習，不能只準備其中一種",
   peerNote:"同儕筆記提醒：NP-Complete在清大／交大／台大都被列五星必考範圍，跟本章key欄位提到的校系差異一起準備；同一份筆記把Computational Geometry列為三校幾乎不考，這也是六科規劃沒有另闢章節教它的原因，不用另外找教材。",
   mats:[
    {type:"book",text:"演算法~1~（林立宇）Ch6 NP-completeness：6.1 Complexity class + 6.2 NP-complete problems + 6.3 Approximation"},
    {type:"vidgroup",text:"P / NP / NP-Complete / NP-Hard 概念",options:[
      {label:"Theory of Computation：P, NP, NP-Complete and NP-Hard",url:"https://www.youtube.com/watch?v=tIE2lkJv20c",dur:"5:06"},
      {label:"交大江蕙如 Lec22 Beyond Polynomial Running Times (1/2)",url:"https://www.youtube.com/watch?v=PqN0aJeYtuA",dur:"1:00:20"},
      {label:"交大江蕙如 Lec23 Beyond Polynomial Running Times (2/2)",url:"https://www.youtube.com/watch?v=6n8vyWKGsIo",dur:"51:24"},
      {label:"MIT 6.006 L23：Computational Complexity",url:"https://www.youtube.com/watch?v=moPtwq_cVH8",dur:"51:12"},
      {label:"MIT 6.006 Rec23：Computational Complexity",url:"https://www.youtube.com/watch?v=t5Wxk96QjUk",dur:"47:13"},
      {label:"Abdul Bari：8. NP-Hard and NP-Complete Problems",url:"https://www.youtube.com/watch?v=e2cF8a5aAhE",dur:"31:53"}
    ]},
    {type:"vid",text:"How to prove NP-Completeness - The Steps",url:"https://www.youtube.com/watch?v=a_IRpiyBIm0",dur:"17:29",note:"補充Reduction證明的具體步驟"},
    {type:"vid",text:"Abdul Bari：8.1 NP-Hard Graph Problem - Clique Decision Problem",url:"https://www.youtube.com/watch?v=qZs767KQcvE",dur:"17:14"},
    {type:"ex",text:"練習題：「請說明XX問題為NP-Complete」觀念題 × 5題（各校歷屆）"}]},
  {n:"主題10",t:"近似演算法 / 隨機演算法",sub:"Approximation、Randomized；附Backtracking、Branch and Bound",pri:"lo",hrs:"9hr",wk:7,
   key:"近似比定義、Vertex Cover 2-approximation、Las Vegas vs Monte Carlo區別",
   mats:[
    {type:"vid",text:"Approximation Algorithms 1 - Introduction and Vertex Cover Problem",url:"https://www.youtube.com/watch?v=xyqIXdUXeU0",dur:"23:31"},
    {type:"vid",text:"交大OCW 江蕙如《演算法》Lec24 Chapter 9 Linear Programming",url:"https://www.youtube.com/watch?v=cmQQL_hBBIM",dur:"1:23:58"},
    {type:"vid",text:"MIT 6.006 L24：Topics in Algorithms Research",url:"https://www.youtube.com/watch?v=dU40AvBURDQ",dur:"46:46"},
    {type:"vid",text:"MIT 6.006 Rec8：Simulation Algorithms（Sweep Line 與 Range Index，補充）",url:"https://www.youtube.com/watch?v=eGSXsaJ-BlY",dur:"55:39"},
    {type:"vid",text:"MIT 6.006 Rec24：Final Exam Review",url:"https://www.youtube.com/watch?v=hkAONP0aC9w",dur:"51:44"},
    {type:"vid",text:"Abdul Bari：6 Introduction to Backtracking - Brute Force Approach",url:"https://www.youtube.com/watch?v=DKCbsiDBN6c",dur:"8:15"},
    {type:"vid",text:"Abdul Bari：6.1 N Queens Problem using Backtracking",url:"https://www.youtube.com/watch?v=xFv_Hl4B83A",dur:"13:41"},
    {type:"vid",text:"Abdul Bari：6.2 Sum Of Subsets Problem - Backtracking",url:"https://www.youtube.com/watch?v=kyLxTdsT8ws",dur:"12:19"},
    {type:"vid",text:"Abdul Bari：6.3 Graph Coloring Problem - Backtracking",url:"https://www.youtube.com/watch?v=052VkKhIaQ4",dur:"15:52"},
    {type:"vid",text:"Abdul Bari：6.4 Hamiltonian Cycle - Backtracking",url:"https://www.youtube.com/watch?v=dQr4wZCiJJ4",dur:"18:35"},
    {type:"vid",text:"Abdul Bari：7 Branch and Bound Introduction",url:"https://www.youtube.com/watch?v=3RBNPc0_Q6g",dur:"9:40"},
    {type:"vid",text:"Abdul Bari：7.1 Job Sequencing with Deadline - Branch and Bound",url:"https://www.youtube.com/watch?v=M7Fl_z7_J2k",dur:"10:56"},
    {type:"vid",text:"Abdul Bari：7.2 0/1 Knapsack using Branch and Bound",url:"https://www.youtube.com/watch?v=yV1d-b_NeK8",dur:"10:48"},
    {type:"vid",text:"Abdul Bari：7.3 Traveling Salesman Problem - Branch and Bound",url:"https://www.youtube.com/watch?v=1FEP_sNb62k",dur:"24:42"},
    {type:"vid",text:"The Academician：Las Vegas vs Monte Carlo 隨機演算法",url:"https://www.youtube.com/watch?v=Nn_Eq7--Rk4",dur:"5:15"},
    {type:"ex",text:"此章考試比重低，輕讀了解近似比定義即可，不需深入"}
   ]}]},
{id:"os",name:"作業系統",color:"#DD8238",hours:50,weeks:3,coverage:"9/11校",
tip:"CPU排程、同步／互斥、死鎖、記憶體與虛擬記憶體是五大必考重點，務必熟練計算題。同一主題有多位老師時，完成任一版本即可。",
 recommended_books:[
   {name:"作業系統金寶典（含系統程式）— 洪逸編著，四版（大碩）",note:"✅ 你有這本。全書10章"},
   {name:"作業系統暑期講義 Q1–Q6（HY老師／大碩）",note:"✅ 你有這份。Q1對應Ch1–3，Q2→Ch4，Q3→Ch5，Q4→Ch6，Q5→Ch7–8，Q6→Ch9–10"},
   {name:"作業系統暑期講義 Y1–Y8（HY老師／大碩）",note:"✅ 你有這份。Y2–Y8為各校歷屆試題分類練習"}],
 recommended_videos:[
   {name:"清大OCW 周志遠《作業系統》第1A講",url:"https://www.youtube.com/watch?v=3PfL2WIS22o",note:"台灣最完整的繁中OS課程，整科入門先看這支建立架構"},
   {name:"Gate Smashers：Banker Algorithm",url:"https://www.youtube.com/watch?v=7gMLNiEz3nw",note:"死鎖章節最容易算錯的地方，這支的手算示範很清楚"},
   {name:"Page Replacement Algorithms（LRU and Optimal）",url:"https://www.youtube.com/watch?v=DXU7SqsYDvg",note:"虛擬記憶體章節的LRU/Optimal手算比較，考試常出"}],
 chapters:[
  {n:"主題1",t:"OS概論",sub:"OS結構、System Call、服務類型",pri:"hi",hrs:"8.5hr",wk:8,
   key:"Monolithic vs Microkernel vs Layered結構比較、System Call的執行流程（user mode → kernel mode）、OS提供的服務類型",
   mats:[
    {type:"book",text:"作業系統金寶典四版（洪逸）Ch3系統作業結構：3-3 System Call、3-5系統結構、3-10微核心"},{type:"book",text:"Q講義 Q1（Ch1–Ch3）：做例題1–3"},
    {type:"vidgroup",text:"OS概論／課程導論（挑周志遠完整系列，或Neso Academy精簡版）",options:[
      {label:"Neso Academy：System Calls（精簡版）",url:"https://www.youtube.com/watch?v=lhToWeuWWfw",dur:"12:38"},
      {label:"清大周志遠 第1A講",url:"https://www.youtube.com/watch?v=3PfL2WIS22o",dur:"15:57"},
      {label:"清大周志遠 第1B講",url:"https://www.youtube.com/watch?v=QK63Mw9hPec",dur:"16:13"},
      {label:"清大周志遠 第1C講",url:"https://www.youtube.com/watch?v=wzRwuRrUzNQ",dur:"24:14"},
      {label:"清大周志遠 第2A講 Historical Prospective(Mainframe)",url:"https://www.youtube.com/watch?v=2nTqrHZhVQ0",dur:"26:53"},
      {label:"清大周志遠 第2B講 Computer-System Architecture",url:"https://www.youtube.com/watch?v=ku1XgA2bZTE",dur:"24:02"},
      {label:"清大周志遠 第2C講 Computer-System Architecture(續)",url:"https://www.youtube.com/watch?v=veTbz_7sDtM",dur:"29:21"},
      {label:"清大周志遠 第2D講 Special-purpose Systems",url:"https://www.youtube.com/watch?v=1gIwNYCcwAk",dur:"13:49"},
      {label:"清大周志遠 第3A講 What is an OS?",url:"https://www.youtube.com/watch?v=bzE9oX8bKqY",dur:"35:48"},
      {label:"清大周志遠 第3B講 Computer-System Organization",url:"https://www.youtube.com/watch?v=dFXJM1ZTxdA",dur:"8:15"},
      {label:"清大周志遠 第4A講 Computer-System Organization(續)",url:"https://www.youtube.com/watch?v=BtHlptO34wM",dur:"36:08"},
      {label:"清大周志遠 第4B講 Computer-System Organization(續)",url:"https://www.youtube.com/watch?v=7z3hoaide-4",dur:"12:16"},
      {label:"清大周志遠 第4C講 Computer-System Organization(續)",url:"https://www.youtube.com/watch?v=ZsiNkiwki5Q",dur:"14:30"},
      {label:"清大周志遠 第4D講 Hardware Protection",url:"https://www.youtube.com/watch?v=OApn18tz9EU",dur:"27:35"},
      {label:"清大周志遠 第5A講 Nachos解說/OS Structure",url:"https://www.youtube.com/watch?v=9vrPlp_f5A0",dur:"28:28"},
      {label:"清大周志遠 第5B講 OS Services",url:"https://www.youtube.com/watch?v=HA96JKO9znE",dur:"22:30"},
      {label:"清大周志遠 第5C講 OS Application Interface",url:"https://www.youtube.com/watch?v=lpOMe56f1Nw",dur:"28:54"},
      {label:"清大周志遠 第5D講 OS Structure",url:"https://www.youtube.com/watch?v=_RxbSP6hjqU",dur:"19:22"},
      {label:"清大周志遠 第6A講 OS Structure/Processes Concept",url:"https://www.youtube.com/watch?v=qbUTlZ05VYk",dur:"35:41"}
    ]},
    {type:"ex",text:"背誦System Call流程（trap→kernel→return），能手寫說明"}]},
  {n:"主題2",t:"Process管理",sub:"PCB、Process State、Context Switch、fork()",pri:"must",hrs:"7hr",wk:8,
   key:"五狀態圖（New/Ready/Running/Waiting/Terminated）默寫、Context Switch的代價與內容、fork()後parent/child的關係",
   mats:[
    {type:"book",text:"金寶典四版（洪逸）Ch4：4-1處理程序 + 4-3內文轉換 + 4-2排班程式種類 — 五狀態圖重點在4-1"},
    {type:"vidgroup",text:"Process Concept（周志遠完整系列）",options:[
      {label:"清大周志遠 第9A講 Processes Concept",url:"https://www.youtube.com/watch?v=dDghjse91lE",dur:"35:59"},
      {label:"清大周志遠 第9B講 Processes Concept",url:"https://www.youtube.com/watch?v=iFRv7y8i7Sw",dur:"11:01"},
      {label:"清大周志遠 第6B講 Processes Concept",url:"https://www.youtube.com/watch?v=FiRH2TYB1Mw",dur:"9:29"},
      {label:"清大周志遠 第7A講 Processes Concept",url:"https://www.youtube.com/watch?v=f-mBLtGY6Ig",dur:"33:46"},
      {label:"清大周志遠 第7B講 Processes Concept",url:"https://www.youtube.com/watch?v=aKiUuuKXfKY",dur:"8:38"},
      {label:"清大周志遠 第8A講 Processes Concept",url:"https://www.youtube.com/watch?v=AztAXONxs7M",dur:"22:36"},
      {label:"清大周志遠 第8B講 Processes Concept",url:"https://www.youtube.com/watch?v=ETPHC9DffdU",dur:"22:14"},
      {label:"清大周志遠 第8C講 Processes Concept",url:"https://www.youtube.com/watch?v=RrjOXZ-XzkM",dur:"23:14"},
      {label:"清大周志遠 第8D講 Processes Concept",url:"https://www.youtube.com/watch?v=oiB5Oalb8A8",dur:"24:09"}
    ]},
    {type:"vid",text:"Neso Academy：fork() and exec() System Calls",url:"https://www.youtube.com/watch?v=IFEFVXvjiHY",dur:"20:34"},
    {type:"ex",text:"默寫五狀態圖並說明每個轉換條件 × 5次直到流暢"}]},
  {n:"主題3",t:"Thread與並行",sub:"User/Kernel Thread、多對多模型",pri:"must",hrs:"4.5hr",wk:8,
   key:"Thread vs Process的共享資源差異、三種模型（Many-to-One/One-to-One/Many-to-Many）、多執行緒的優缺點",
   mats:[
    {type:"book",text:"金寶典四版（洪逸）Ch4-10 Thread Management + Q講義Q2（Ch4 Thread部分）"},
    {type:"vidgroup",text:"Thread 介紹（周志遠完整系列）",options:[
      {label:"清大周志遠 第15A講 Thread Introduction",url:"https://www.youtube.com/watch?v=iEipIUjbQxk",dur:"29:35"},
      {label:"清大周志遠 第15B講 Thread Introduction(續)",url:"https://www.youtube.com/watch?v=GO4Lbeh8M_0",dur:"14:56"},
      {label:"清大周志遠 第16A講 Multithreaded Programming",url:"https://www.youtube.com/watch?v=8x6-r-maTZA",dur:"26:50"},
      {label:"清大周志遠 第16B講 Threading Issues",url:"https://www.youtube.com/watch?v=Z9OPaNpNwXk",dur:"14:50"}
    ]},
    {type:"vid",text:"Multithreading Models in Operating Systems（Many-to-One/One-to-One/Many-to-Many）",url:"https://www.youtube.com/watch?v=LsgJDGJIrJI",dur:"5:23"},
    {type:"ex",text:"比較表：Process vs Thread（共享資源、建立成本、通訊方式）手寫一遍"}]},
  {n:"主題4",t:"CPU排程",sub:"FCFS、SJF、RR、Priority、多層佇列",pri:"must",hrs:"7.5hr",wk:8,
   key:"每個排程演算法的Gantt Chart手畫、計算Waiting Time/Turnaround Time/Response Time、Preemptive vs Non-preemptive差異、Aging解決Starvation",
   peerNote:"同儕筆記重點（三份完整筆記說法一致）：FCFS有Convoy effect（短工被長工卡住）、Priority Scheduling會Starvation要靠Aging解、Round Robin的time quantum太小會讓context switch overhead吃掉效能。",
   mats:[
    {type:"vidgroup",text:"CPU排程（周志遠完整系列）",options:[
      {label:"清大周志遠 第16C講 Basic Concepts",url:"https://www.youtube.com/watch?v=EpZgvKBf5eo",dur:"23:33"},
      {label:"清大周志遠 第16D講 Scheduling Algorithms",url:"https://www.youtube.com/watch?v=n2o_WL62D4Q",dur:"31:56"},
      {label:"清大周志遠 第17A講 Process Scheduling",url:"https://www.youtube.com/watch?v=8RlCb74uFp0",dur:"36:02"},
      {label:"清大周志遠 第17B講 Special Scheduling Issues",url:"https://www.youtube.com/watch?v=G4v9HUllv-Q",dur:"7:06"},
      {label:"清大周志遠 第18A講 Special Scheduling Issues",url:"https://www.youtube.com/watch?v=0NRkuhnupzs",dur:"29:57"},
      {label:"清大周志遠 第18B講 Operating System Examples",url:"https://www.youtube.com/watch?v=XYreyOCoBuk",dur:"16:30"}
    ]},
    {type:"vid",text:"Gate Smashers：Shortest Job First (SJF) Scheduling Algorithm",url:"https://www.youtube.com/watch?v=VCIVXPoiLpU",dur:"9:13"},
    {type:"ex",text:"Gantt Chart 排程計算 × 5 題（Q講義 Q2），算出 Waiting Time / Turnaround Time"}
   ]},
  {n:"主題5",t:"同步與互斥",sub:"Race Condition、Critical Section、Mutex、Semaphore",pri:"must",hrs:"10hr",wk:9,
   key:"Critical Section的三個條件（Mutual Exclusion/Progress/Bounded Waiting）、Binary vs Counting Semaphore差異、用Semaphore解Producer-Consumer/Readers-Writers/Dining Philosophers",
   peerNote:"同儕筆記地雷：Priority Inversion與Priority Inheritance常被搞混——低優先權任務占用資源導致高優先權任務被中優先權任務插隊延遲，解法是暫時把低優先權任務的優先權拉高，不能只背名詞。",
   mats:[
    {type:"book",text:"金寶典 Ch6：6-2臨界區間、6-6號誌（Semaphore）、6-7利用Semaphore解同步問題"},{type:"book",text:"Q講義 Q4（Ch6 Process Synchronization、Semaphore）：所有例題必做"},
    {type:"vidgroup",text:"Critical Section / Semaphore / Monitor（周志遠完整系列）",options:[
      {label:"清大周志遠 第18C講 Background & Critical Section",url:"https://www.youtube.com/watch?v=CNO_I8jhX3I",dur:"24:11"},
      {label:"清大周志遠 第18D講 Critical Section(續)",url:"https://www.youtube.com/watch?v=IOx8vtDzGO0",dur:"27:16"},
      {label:"清大周志遠 第19A講 Critical Section(續)",url:"https://www.youtube.com/watch?v=6LWj3CuOCPs",dur:"21:21"},
      {label:"清大周志遠 第19B講 Critical Section(續) & Hardware Support",url:"https://www.youtube.com/watch?v=nNcqTc-00WA",dur:"27:09"},
      {label:"清大周志遠 第20A講 期中考檢討 & Critical Section補充",url:"https://www.youtube.com/watch?v=jJZ8egWNiWo",dur:"27:52"},
      {label:"清大周志遠 第20B講 Hardware Support(續) & Semaphore",url:"https://www.youtube.com/watch?v=k0XaqQzTW_I",dur:"27:26"},
      {label:"清大周志遠 第20C講 Semaphore(續)",url:"https://www.youtube.com/watch?v=r0h26ioGeG0",dur:"21:30"},
      {label:"清大周志遠 第20D講 Classical Synchronization Problems & Monitors",url:"https://www.youtube.com/watch?v=48K3qS2531o",dur:"22:18"},
      {label:"清大周志遠 第21A講 Monitors(續)",url:"https://www.youtube.com/watch?v=akXZHPecIh4",dur:"26:17"},
      {label:"清大周志遠 第21B講 Monitors(續) & Atomic Transaction",url:"https://www.youtube.com/watch?v=SNwNax1Wz7k",dur:"19:14"}
    ]},
    {type:"vid",text:"Process Synchronisation | Critical Section Problem",url:"https://www.youtube.com/watch?v=sEVfeXqWY-s",dur:"13:32"},
    {type:"vid",text:"Semaphores in Operating Systems",url:"https://www.youtube.com/watch?v=HUA_cVBdLw0",dur:"12:48"},
    {type:"ex",text:"練習：用Semaphore寫出Producer-Consumer虛擬碼並說明每個變數用途 × 3次"}]},
  {n:"主題6",t:"死鎖 Deadlock",sub:"四條件、Resource Allocation Graph、Banker Algorithm",pri:"must",hrs:"6.5hr",wk:9,
   key:"死鎖四必要條件（Mutual Exclusion/Hold and Wait/No Preemption/Circular Wait）、RAG看有無死鎖、Banker Algorithm安全狀態判斷（手算）",
   peerNote:"同儕筆記提醒：四條件必須同時成立才可能發生死鎖，缺一不可（但四條件都成立不保證一定死鎖，RAG有cycle時只有每類資源都只有一個instance才確定死鎖）；Banker's Algorithm的safety algorithm手算題是各校常考題型，務必練到熟。",
   mats:[
    {type:"vidgroup",text:"死鎖特徵與預防（周志遠完整系列）",options:[
      {label:"清大周志遠 第22A講 System Model & Deadlock Characterization",url:"https://www.youtube.com/watch?v=efH4nuwUalA",dur:"31:27"},
      {label:"清大周志遠 第22B講 Deadlock Prevention & Avoidance",url:"https://www.youtube.com/watch?v=n6YiasR-3uc",dur:"15:11"},
      {label:"清大周志遠 第22C講 Deadlock Prevention & Avoidance(續)",url:"https://www.youtube.com/watch?v=HvXHTgLys1g",dur:"33:31"},
      {label:"清大周志遠 第22D講 Ch7:Deadlocks",url:"https://www.youtube.com/watch?v=b2lHjRiLeFE",dur:"9:18"}
    ]},
    {type:"vid",text:"Gate Smashers：Banker Algorithm",url:"https://www.youtube.com/watch?v=7gMLNiEz3nw",dur:"24:04"},
    {type:"vid",text:"Deadlock | Necessary Condition for Deadlock | Resource Allocation Graph",url:"https://www.youtube.com/watch?v=XpKrBUZqfGI",dur:"17:30"},
    {type:"ex",text:"Banker Algorithm 安全狀態判斷 × 5 題（Q講義 Q3）"}
   ]},
  {n:"主題7",t:"記憶體管理",sub:"Paging、Segmentation、碎裂",pri:"must",hrs:"8.5hr",wk:10,
   key:"Paging的位址轉換（logical→physical：page number用來查Page Table取frame number，加offset）、TLB命中率計算、Page Table大小計算、Internal vs External Fragmentation",
   mats:[
    {type:"vidgroup",text:"Paging 記憶體管理（周志遠完整系列）",options:[
      {label:"清大周志遠 第10A講 Memory Management",url:"https://www.youtube.com/watch?v=xxwRs_2XjjY",dur:"31:19"},
      {label:"清大周志遠 第10B講 Memory Management",url:"https://www.youtube.com/watch?v=Q2-sJ3eYGYE",dur:"13:54"},
      {label:"清大周志遠 第10C講 Memory Management",url:"https://www.youtube.com/watch?v=YwPv-XEWDSU",dur:"14:49"},
      {label:"清大周志遠 第10D講 Memory Management",url:"https://www.youtube.com/watch?v=bFHb-eTM7oU",dur:"32:36"},
      {label:"清大周志遠 第11A講 Non-Contiguous Memory Allocation - Paging(續)",url:"https://www.youtube.com/watch?v=p7C-ObHrCP8",dur:"28:15"},
      {label:"清大周志遠 第11B講 Non-Contiguous Memory Allocation - Paging(續)",url:"https://www.youtube.com/watch?v=8RyRHYruy-8",dur:"15:47"},
      {label:"清大周志遠 第12A講 Non-Contiguous Memory Allocation - Paging(續)",url:"https://www.youtube.com/watch?v=u4zElpAChLM",dur:"48:27"},
      {label:"清大周志遠 第12B講 Non-Contiguous Memory Allocation - Paging(續)",url:"https://www.youtube.com/watch?v=PTXHd17_NlU",dur:"45:43"}
    ]},
    {type:"vid",text:"Paging in Operating Systems with Example & Working",url:"https://www.youtube.com/watch?v=pJ6qrCB8pDw",dur:"17:26"},
    {type:"ex",text:"Page Table 位址轉換計算 × 5 題（Q講義 Q5）"}
   ]},
  {n:"主題8",t:"虛擬記憶體",sub:"Demand Paging、Page Fault、Page Replacement",pri:"must",hrs:"7.5hr",wk:10,
   key:"Page Fault的處理流程（trap→swap in→restart）、三種置換演算法比較（FIFO/LRU/Optimal）、Thrashing的成因與解決、Working Set模型",
   peerNote:"同儕筆記地雷：FIFO有Belady's Anomaly（frame數變多、page fault反而變多），LRU和Optimal屬於stack algorithm、不會有此異常；同儕筆記附的EMAT、TLB命中率計算範例可以直接拿來對答案。",
   mats:[
    {type:"book",text:"金寶典 Ch8：8-4頁面替換、8-5 Page Replacement Algorithms（重點）"},{type:"book",text:"Q講義 Q5：Page Replacement例題（FIFO/LRU/Optimal各演算法）全做"},
    {type:"vidgroup",text:"Demand Paging / Page Replacement（周志遠完整系列）",options:[
      {label:"清大周志遠 第13A講 Background",url:"https://www.youtube.com/watch?v=TnmN_KNIbc4",dur:"18:59"},
      {label:"清大周志遠 第13B講 Demand Paging & Process Creation",url:"https://www.youtube.com/watch?v=VAaunFe_lRs",dur:"24:23"},
      {label:"清大周志遠 第14A講 Demand Paging(Review)",url:"https://www.youtube.com/watch?v=ngdrizxxvPY",dur:"28:19"},
      {label:"清大周志遠 第14B講 Page Replacement",url:"https://www.youtube.com/watch?v=P1MlFqr5VMw",dur:"20:33"},
      {label:"清大周志遠 第14C講 Page Replacement(續)",url:"https://www.youtube.com/watch?v=TXcPJuccafA",dur:"23:30"},
      {label:"清大周志遠 第14D講 Allocation of Frames",url:"https://www.youtube.com/watch?v=cfPNAeAatGs",dur:"28:32"}
    ]},
    {type:"vid",text:"Page Replacement Algorithms（LRU and Optimal）",url:"https://www.youtube.com/watch?v=DXU7SqsYDvg",dur:"16:18"},
    {type:"vid",text:"Page Faults & Page Fault Handling（含Thrashing）",url:"https://www.youtube.com/watch?v=Nif2TZ5Cohw",dur:"14:17"},
    {type:"ex",text:"給定reference string和frame數，用FIFO/LRU/Optimal計算page fault次數 × 5題"}]},
  {n:"主題9",t:"檔案系統",sub:"inode、Directory、File Allocation",pri:"hi",hrs:"5.5hr",wk:10,
   key:"三種分配方式（Contiguous/Linked/Indexed）的比較、inode的direct/indirect block存取次數計算、FAT結構",
   peerNote:"同儕筆記缺口：四份讀過的作業系統同儕筆記裡，有兩份到同步機制或更早就沒繼續寫，只有一份真正涵蓋File System，這章不能只靠同儕筆記，優先回歸課本與影片。",
   mats:[
    {type:"vidgroup",text:"檔案系統（周志遠完整系列）",options:[
      {label:"清大周志遠 第23A講 File Concept & Access Methods",url:"https://www.youtube.com/watch?v=xzjOe7-m6qc",dur:"31:21"},
      {label:"清大周志遠 第23B講 Directory Structure",url:"https://www.youtube.com/watch?v=NDBhHLzz4p8",dur:"20:54"},
      {label:"清大周志遠 第23C講 Directory Structure & File System",url:"https://www.youtube.com/watch?v=0vYydtG1Xi4",dur:"29:09"},
      {label:"清大周志遠 第23D講 File System Implementation",url:"https://www.youtube.com/watch?v=TA7728hp_IA",dur:"21:14"},
      {label:"清大周志遠 第24A講 File System Implementation",url:"https://www.youtube.com/watch?v=ZYgU9wrZaZo",dur:"26:12"},
      {label:"清大周志遠 第24B講 File System Implementation",url:"https://www.youtube.com/watch?v=UpPyxA0THzU",dur:"22:51"},
      {label:"清大周志遠 第25A講 File System / Mass Storage System",url:"https://www.youtube.com/watch?v=C42WzJATHg0",dur:"27:31"},
      {label:"清大周志遠 第25B講 File System / Mass Storage System",url:"https://www.youtube.com/watch?v=pb0dALUBDm8",dur:"18:49"}
    ]},
    {type:"ex",text:"inode direct/indirect block 存取次數計算 × 3 題（Q講義 Q6）"}
   ]},
  {n:"主題10",t:"I/O系統",sub:"DMA、Interrupt、Disk Scheduling",pri:"hi",hrs:"6hr",wk:10,
   key:"Polling vs Interrupt vs DMA比較、三種磁頭排程（SSTF/SCAN/C-SCAN）的磁頭移動距離計算",
   peerNote:"同儕筆記重點：磁碟排程與RAID只有一份筆記寫得完整，附了FCFS/SSTF/SCAN/C-SCAN/C-LOOK磁頭移動量的實際計算例題與RAID 0–6效能比較，這塊優先靠這份加課本補，其他筆記幾乎空白。",
   mats:[
    {type:"vidgroup",text:"Mass Storage / I/O Systems（周志遠完整系列）",options:[
      {label:"清大周志遠 第26A講 Mass Storage System",url:"https://www.youtube.com/watch?v=Ui3Pei65U80",dur:"21:18"},
      {label:"清大周志遠 第26B講 Mass Storage / I/O Systems",url:"https://www.youtube.com/watch?v=1Hl-S_eFbhE",dur:"23:26"},
      {label:"清大周志遠 第26C講 RAID",url:"https://www.youtube.com/watch?v=TiyQuiVq0Zs",dur:"27:16"},
      {label:"清大周志遠 第26D講 I/O Systems",url:"https://www.youtube.com/watch?v=Ypxv0k322n8",dur:"40:33"}
    ]},
    {type:"vid",text:"SCAN Disk Scheduling Algorithm",url:"https://www.youtube.com/watch?v=lQAYseBJPuA",dur:"4:24"},
    {type:"ex",text:"SSTF/SCAN/C-SCAN 磁頭移動距離計算 × 3 題（Q講義 Q6）"}
   ]},
  {n:"主題11",t:"虛擬化與安全",sub:"Hypervisor、VM、Protection",pri:"lo",hrs:"3hr",wk:10,
   key:"Type 1（Bare-metal）vs Type 2（Hosted）Hypervisor、OS安全機制概念",
   mats:[
    {type:"vid",text:"What is a Hypervisor? Type 1 vs Type 2 Hypervisors Explained",url:"https://www.youtube.com/watch?v=pS-QM22YXmU",dur:"3:19"},
    {type:"ex",text:"此章考試比重低，了解 Type 1 vs Type 2 Hypervisor 概念即可"}
   ]}]},
{id:"la",name:"線性代數",color:"#4B9EE2",hours:75,weeks:2,coverage:"8/11校",
tip:"線性代數適合每天少量持續練習；特徵值、特徵向量與向量空間是高頻考點。同一主題有多位老師時，完成任一版本即可。",
 recommended_books:[
   {name:"線性代數（上）含歷屆經典試題解析一版（林緯）大碩",note:"✅ 你有這本。ISBN 9786267004005，Ch1矩陣→Ch2線性方程組→Ch3向量空間→Ch4線性映射"},
   {name:"線性代數（下）含歷屆經典試題解析一版（林緯）大碩",note:"✅ 你有這本。Ch5對角化→Ch6 Jordan Form→Ch7內積空間→Ch8各內積算子含SVD"}],
 recommended_videos:[
   {name:"MIT 18.06 L1：Geometry of Linear Equations",url:"https://www.youtube.com/watch?v=ZK3O402wf1c",note:"Strang的第一堂課，開繁中字幕，整科的起點"},
   {name:"MIT 18.06 L10：Four Fundamental Subspaces",url:"https://www.youtube.com/watch?v=nHlE7EgJFds",note:"線代最重要的一支影片，向量空間章節的核心觀念都在這"},
   {name:"3Blue1Brown：Eigenvectors and eigenvalues | Ch14",url:"https://www.youtube.com/watch?v=PFDu9oVAE-g",note:"特徵值特徵向量的幾何直覺，公式背不熟時回來看這支"}],
 chapters:[
  {n:"主題1",t:"矩陣與線性方程組",sub:"Gaussian Elimination、Row Reduction、RREF",pri:"must",hrs:"9.5hr",wk:16,
   key:"高斯消去法手算、解的三種情況（unique/no/infinite）",
   mats:[
    {type:"book",text:"線性代數上冊（林緯）Ch2 線性方程組與求解：2-1線性方程組 + 2-3行列式 — 搭配Ch2-5進階試題"},
    {type:"vid",text:"MIT OCW 18.06 L1：Geometry of Linear Equations",url:"https://www.youtube.com/watch?v=ZK3O402wf1c",dur:"39:49",note:"Strang的課，免費，開繁中字幕"},
    {type:"vid",text:"MIT OCW 18.06 L2：Elimination with Matrices",url:"https://www.youtube.com/watch?v=QVKj3LADCnA",dur:"47:41"},
    {type:"vid",text:"3Blue1Brown：Essence of linear algebra preview | Ch0",url:"https://www.youtube.com/watch?v=kjBOesZCoqc",dur:"5:09"},
    {type:"ex",text:"給定方程組，用高斯消去法求解 × 8題（課本習題）"}]},
  {n:"主題2",t:"矩陣運算",sub:"乘法、轉置、逆矩陣、Elementary Matrix",pri:"must",hrs:"5hr",wk:16,
   key:"矩陣乘法的條件與複雜度、逆矩陣存在⟺det≠0、逆矩陣求法（augmented matrix method）",
   peerNote:"同儕筆記地雷：AB=AC且A≠O不能消去成B=C、AB=O不代表A或B有一個是零矩陣、A²=A不代表A=I或A=O——這些是選擇題常見誤答點。也要分清「古典伴隨矩陣」（adjugate，求逆矩陣用）跟內積空間的「伴隨算子」（主題7會遇到，概念不同）。",
   mats:[
    {type:"book",text:"線性代數上冊（林緯）Ch1 矩陣：1-1矩陣的定義與運算 + 1-2列運算與行運算"},
    {type:"vidgroup",text:"矩陣乘法 Matrix Multiplication",options:[
      {label:"MIT 18.06 L3：Multiplication and Inverse Matrices",url:"https://www.youtube.com/watch?v=FX4C-JpTFgY",dur:"46:48"},
      {label:"3Blue1Brown：Matrix multiplication as composition | Ch4",url:"https://www.youtube.com/watch?v=XkY2DOUCWMU",dur:"10:04"}
    ]},
    {type:"vid",text:"MIT OCW 18.06 L4：Factorization into A = LU",url:"https://www.youtube.com/watch?v=5hO3MrzPa0A",dur:"50:21"},
    {type:"vid",text:"MIT OCW 18.06 L5：Transposes, Permutations, Spaces R^n",url:"https://www.youtube.com/watch?v=JibVXBElKL0",dur:"47:41"},
    {type:"ex",text:"3×3矩陣求逆矩陣手算 × 5題"}]},
  {n:"主題3",t:"行列式 Determinant",sub:"Cofactor Expansion、性質、幾何意義",pri:"must",hrs:"6.5hr",wk:16,
   key:"Cofactor Expansion沿任一行/列展開、行列式的性質（row swap改符號、row multiply乘常數）、Cramer's Rule",
   mats:[
    {type:"book",text:"線性代數上冊（林緯）Ch2-3行列式 + Ch2-4行列式的應用"},
    {type:"vidgroup",text:"行列式的性質與公式 Determinant",options:[
      {label:"MIT 18.06 L18：Properties of Determinants",url:"https://www.youtube.com/watch?v=srxexLishgY",dur:"49:12"},
      {label:"MIT 18.06 L19：Determinant Formulas and Cofactors",url:"https://www.youtube.com/watch?v=23LLB9mNJvc",dur:"53:17"},
      {label:"3Blue1Brown：The determinant | Ch6",url:"https://www.youtube.com/watch?v=Ip3X9LOh2dk",dur:"10:03"}
    ]},
    {type:"vid",text:"3Blue1Brown：Cross products | Essence of linear algebra Ch10",url:"https://www.youtube.com/watch?v=eu6i7WJeinw",dur:"8:54"},
    {type:"vid",text:"MIT OCW 18.06 L20：Cramer's Rule, Inverse Matrix, and Volume",url:"https://www.youtube.com/watch?v=QNpj-gOXW9M",dur:"51:01"},
    {type:"vid",text:"3Blue1Brown：Cramer's rule, explained geometrically | Ch12",url:"https://www.youtube.com/watch?v=jBsC34PxzoM",dur:"12:12"},
    {type:"ex",text:"3×3和4×4矩陣計算行列式 × 8題"}]},
  {n:"主題4",t:"向量空間",sub:"Subspace、Span、Basis、Dimension、Rank-Nullity",pri:"must",hrs:"12.5hr",wk:16,
   key:"四個基本子空間（Column Space/Null Space/Row Space/Left Null Space）、Rank-Nullity Theorem（rank+nullity=n）、線性獨立的判斷、REF/RREF的定義、自由變數的判斷",
   peerNote:"同儕筆記地雷：列運算不改變列空間（row space），化簡後的非零列可直接當列空間的基底；但列運算會改變行空間（column space），行空間的基底要取「原矩陣」中pivot所在的行（或改用行運算化簡）。直接拿化簡後矩陣的行當行空間基底是最常見的錯誤。",
   mats:[
    {type:"book",text:"線性代數上冊（林緯）Ch3 向量空間：3-1到3-7（含空間直和），概念抽象，每節讀完做3-7進階試題"},
    {type:"vidgroup",text:"【強烈推薦】四個基本子空間 Four Fundamental Subspaces",options:[
      {label:"MIT 18.06 L10：Four Fundamental Subspaces",url:"https://www.youtube.com/watch?v=nHlE7EgJFds",dur:"49:20"},
      {label:"MIT 18.06 L6：Column Space and Nullspace",url:"https://www.youtube.com/watch?v=8o5Cmfpeo6g",dur:"46:01"},
      {label:"3Blue1Brown：Inverse matrices, column space and null space | Ch7",url:"https://www.youtube.com/watch?v=uQhTuRlWMxw",dur:"12:09"}
    ]},
    {type:"vidgroup",text:"Independence、Basis、Dimension",options:[
      {label:"MIT 18.06：Independence, Basis, and Dimension",url:"https://www.youtube.com/watch?v=eeMJg4uI7o0",dur:"13:19"},
      {label:"MIT 18.06 L9：Independence, Basis, and Dimension（完整版）",url:"https://www.youtube.com/watch?v=yjBerM5jWsc",dur:"50:14"},
      {label:"3Blue1Brown：Vectors | Ch1",url:"https://www.youtube.com/watch?v=fNk_zzaMoSs",dur:"9:52"},
      {label:"3Blue1Brown：Linear combinations, span, and basis vectors | Ch2",url:"https://www.youtube.com/watch?v=k7RM-ot2NWY",dur:"9:59"}
    ]},
    {type:"vid",text:"MIT OCW 18.06 L7：Solving Ax = 0: Pivot Variables, Special Solutions",url:"https://www.youtube.com/watch?v=VqP2tREMvt0",dur:"43:19"},
    {type:"vid",text:"MIT OCW 18.06 L8：Solving Ax = b: Row Reduced Form R",url:"https://www.youtube.com/watch?v=9Q1q7s1jTzU",dur:"47:19"},
    {type:"vid",text:"MIT OCW 18.06 L11：Matrix Spaces; Rank 1; Small World Graphs",url:"https://www.youtube.com/watch?v=2IdtqGM6KWU",dur:"45:55"},
    {type:"vid",text:"MIT OCW 18.06 L12：Graphs, Networks, Incidence Matrices",url:"https://www.youtube.com/watch?v=6-wh6yvk6uc",dur:"47:57"},
    {type:"vid",text:"MIT OCW 18.06 L13：Quiz 1 Review",url:"https://www.youtube.com/watch?v=l88D4r74gtM",dur:"47:40"},
    {type:"vid",text:"3Blue1Brown：Abstract vector spaces | Ch16",url:"https://www.youtube.com/watch?v=TgKwz5Ikpc8",dur:"16:46"},
    {type:"ex",text:"給定矩陣，找出Column Space的basis和Null Space的basis × 5題"}]},
  {n:"主題5",t:"線性變換",sub:"Linear Map、Matrix Representation、Kernel/Image",pri:"hi",hrs:"6hr",wk:16,
   key:"線性變換的定義（加法和純量乘法保持）、核（Kernel）和像（Image）的維度關係（等於Nullity和Rank）",
   mats:[
    {type:"book",text:"線性代數上冊（林緯）Ch4 線性映射：4-1到4-4（含一對一與映成）"},
    {type:"vidgroup",text:"線性變換與矩陣表示",options:[
      {label:"MIT 18.06 L30：Linear Transformations and Their Matrices",url:"https://www.youtube.com/watch?v=Ts3o2I8_Mxc",dur:"49:27"},
      {label:"3Blue1Brown：Linear transformations and matrices | Ch3",url:"https://www.youtube.com/watch?v=kYB8IZa5AuE",dur:"10:59"},
      {label:"3Blue1Brown：Three-dimensional linear transformations | Ch5",url:"https://www.youtube.com/watch?v=rHLEWRxRGiM",dur:"4:46"},
      {label:"3Blue1Brown：Nonsquare matrices as transformations | Ch8",url:"https://www.youtube.com/watch?v=v8VSDg_WQlA",dur:"4:27"},
      {label:"3Blue1Brown：Cross products as linear transformations | Ch11",url:"https://www.youtube.com/watch?v=BaM7OCEm3G0",dur:"13:10"}
    ]},
    {type:"vidgroup",text:"Change of Basis",options:[
      {label:"MIT 18.06 L31：Change of Basis; Image Compression",url:"https://www.youtube.com/watch?v=vGkn-3NFGck",dur:"50:13"},
      {label:"3Blue1Brown：Change of basis | Ch13",url:"https://www.youtube.com/watch?v=P2LTAUO1TdA",dur:"12:51"}
    ]},
    {type:"ex",text:"給定線性變換，找出其Kernel × 3題"}]},
  {n:"主題6",t:"特徵值與特徵向量",sub:"Eigenvalue、Eigenvector、對角化",pri:"must",hrs:"12hr",wk:17,
   key:"特徵多項式det(A-λI)=0、幾何重數與代數重數、對角化條件、複數特徵值的處理；Jordan Form掌握定義與基本求法，深入題型列為選讀",
   peerNote:"同儕筆記地雷：不可先把矩陣列運算成上三角再算特徵值，列運算會改變特徵值，是常見誤區。唯一附完整推導的同儕筆記把Cayley-Hamilton定理跟Jordan Form的證明過程都寫出來，可交叉核對，但另兩份筆記只條列公式，不能單獨依賴。",
   mats:[
    {type:"book",text:"線性代數下冊（林緯）Ch5 對角化理論：5-2特徵根與特徵向量 + 5-3對角化 — 搭配Ch5-7進階試題全做"},
    {type:"book",text:"線性代數下冊（林緯）Ch6 Jordan Form：基礎定義與求法讀過即可，不用深入練習"},
    {type:"vidgroup",text:"Eigenvalues and Eigenvectors",options:[
      {label:"MIT 18.06 L21：Eigenvalues and Eigenvectors",url:"https://www.youtube.com/watch?v=cdZnhQjJu4I",dur:"51:22"},
      {label:"3Blue1Brown：Eigenvectors and eigenvalues | Ch14",url:"https://www.youtube.com/watch?v=PFDu9oVAE-g",dur:"17:15"}
    ]},
    {type:"vid",text:"MIT OCW 18.06 L22：Diagonalization and Powers of A",url:"https://www.youtube.com/watch?v=13r9QY6cmjc",dur:"51:50"},
    {type:"vid",text:"MIT OCW 18.06 L23：Differential Equations and exp(At)",url:"https://www.youtube.com/watch?v=IZqwi0wJovM",dur:"51:03"},
    {type:"vid",text:"MIT OCW 18.06 L24：Markov Matrices; Fourier Series",url:"https://www.youtube.com/watch?v=8MF3pz-oYHo",dur:"51:11"},
    {type:"vid",text:"MIT OCW 18.06 L24b：Quiz 2 Review",url:"https://www.youtube.com/watch?v=sFxA8eIS6tA",dur:"48:20"},
    {type:"vid",text:"MIT OCW 18.06 L28：Similar Matrices and Jordan Form",url:"https://www.youtube.com/watch?v=z_zYQHmrh08",dur:"45:56"},
    {type:"vid",text:"3Blue1Brown：A quick trick for computing eigenvalues | Essence of linear algebra Ch15",url:"https://www.youtube.com/watch?v=e50Bj7jn9IQ",dur:"13:13"},
    {type:"ex",text:"給定矩陣，求特徵值/特徵向量並判斷是否可對角化 × 8題"}]},
  {n:"主題7",t:"正交性",sub:"Inner Product、Gram-Schmidt、QR分解",pri:"must",hrs:"8.5hr",wk:17,
   key:"正交投影公式（proj_v u = (u·v/v·v)v）、Gram-Schmidt步驟、QR分解的用途",
   peerNote:"同儕筆記重點：QR分解在其中一份筆記有完整步驟推導可交叉核對；內積空間的「伴隨算子」（adjoint operator）跟主題2提過的古典伴隨矩陣是不同概念，合看時容易搞混，要用課本定義釐清。",
   mats:[
    {type:"book",text:"線性代數下冊（林緯）Ch7 內積空間：7-2 Gram-Schmidt正交化 + 7-3正交投影"},
    {type:"vidgroup",text:"Orthogonal Matrices and Gram-Schmidt",options:[
      {label:"MIT 18.06 L17：Orthogonal Matrices and Gram-Schmidt",url:"https://www.youtube.com/watch?v=0MtwqhIwdrI",dur:"49:09"},
      {label:"Gram-Schmidt Orthogonalization（換個角度講解）",url:"https://www.youtube.com/watch?v=HEQuN0QELSQ",dur:"10:00"}
    ]},
    {type:"vid",text:"MIT OCW 18.06 L14：Orthogonal Vectors and Subspaces",url:"https://www.youtube.com/watch?v=YzZUIYRCE38",dur:"49:47"},
    {type:"vid",text:"MIT OCW 18.06 L15：Projections onto Subspaces",url:"https://www.youtube.com/watch?v=Y_Ac6KiQ1t0",dur:"48:51"},
    {type:"vid",text:"MIT OCW 18.06 L16：Projection Matrices and Least Squares",url:"https://www.youtube.com/watch?v=osh80YCg_GM",dur:"48:05"},
    {type:"vid",text:"3Blue1Brown：Dot products and duality | Essence of linear algebra Ch9",url:"https://www.youtube.com/watch?v=LyGKycYT2v0",dur:"14:12"},
    {type:"ex",text:"給定一組向量，用Gram-Schmidt正交化 × 3題"}]},
  {n:"主題8",t:"對稱矩陣與二次型",sub:"Symmetric、Spectral Theorem、正定矩陣",pri:"hi",hrs:"7hr",wk:17,
   key:"對稱矩陣一定可以正交對角化（Spectral Theorem）、正定矩陣的判斷方法（所有特徵值>0 / 所有Leading Principal Minor>0）",
   peerNote:"同儕筆記重點：「用正交矩陣P使D=PᵀAP」（對稱矩陣正交對角化）是同儕觀察中出現機率最高的單一題型（十題有八題），這章優先確保這個流程能一次做對。正規矩陣不等於對稱矩陣（對稱矩陣一定正規，但正規不一定對稱），筆記對這條界線交代模糊，以課本為準。",
   mats:[
    {type:"book",text:"線性代數下冊（林緯）Ch8：8-3正定與正半定 + 8-4二次式的應用"},
    {type:"vidgroup",text:"Symmetric Matrices and Positive Definiteness",options:[
      {label:"MIT 18.06 L25：Symmetric Matrices and Positive Definiteness",url:"https://www.youtube.com/watch?v=UCc9q_cAhho",dur:"43:52"}
    ]},
    {type:"vid",text:"MIT OCW 18.06 L26：Complex Matrices; Fast Fourier Transform",url:"https://www.youtube.com/watch?v=M0Sa8fLOajA",dur:"47:52"},
    {type:"vid",text:"MIT OCW 18.06 L27：Positive Definite Matrices and Minima",url:"https://www.youtube.com/watch?v=vF7eyJ2g3kU",dur:"50:40"},
    {type:"ex",text:"判斷矩陣是否正定 × 5題"}]},
  {n:"主題9",t:"SVD與應用",sub:"Singular Value Decomposition、Pseudo-inverse",pri:"hi",hrs:"8hr",wk:17,
   key:"SVD分解步驟（求AᵀA的特徵值→σᵢ→求uᵢ）、低秩近似的意義、Moore-Penrose Pseudo-inverse",
   mats:[
    {type:"book",text:"線性代數下冊（林緯）Ch8-6奇異值分解（SVD）：這是林緯課本最後一章的重點"},
    {type:"vidgroup",text:"Singular Value Decomposition (SVD)",options:[
      {label:"MIT 18.06 L29：Singular Value Decomposition",url:"https://www.youtube.com/watch?v=TX_vooSnhm8",dur:"40:28"},
      {label:"SVD | Step-By-Step Example and Explanation",url:"https://www.youtube.com/watch?v=f8DVtPvqtwc",dur:"19:00"}
    ]},
    {type:"vid",text:"MIT OCW 18.06 L32：Quiz 3 Review",url:"https://www.youtube.com/watch?v=HgC1l_6ySkc",dur:"47:05"},
    {type:"vid",text:"MIT OCW 18.06 L33：Left and Right Inverses; Pseudoinverse",url:"https://www.youtube.com/watch?v=Go2aLo7ZOlU",dur:"41:52"},
    {type:"vid",text:"MIT OCW 18.06 L34：Final Course Review",url:"https://www.youtube.com/watch?v=RWvi4Vx4CDc",dur:"43:26"},
    {type:"vid",text:"Steve Brunton：SVD — Matrix Approximation（低秩近似）",url:"https://www.youtube.com/watch?v=xy3QyyhiuY4",dur:"14:54"},
    {type:"ex",text:"給定2×2矩陣，手算完整SVD × 2題"}]}]},
{id:"dm",name:"離散數學",color:"#E55A9B",hours:52,weeks:5,coverage:"8/11校",
tip:"計數題需要大量練習；圖論可與資料結構的圖演算法一起讀。同一主題有多位老師時，完成任一版本即可。",
 recommended_books:[
   {name:"離散數學（上）含歷屆經典試題解析二版（林緯）大碩",note:"✅ 你有這本（書號AE6038）。Ch1邏輯→Ch2集合→Ch3函數→Ch4歸納法→Ch5組合計數→Ch6生成函數→Ch7遞迴"},
   {name:"離散數學（下）含歷屆經典試題解析二版（林緯）大碩",note:"✅ 你有這本（書號AE6039）。Ch8–9圖論→Ch10樹→Ch11二元關係→Ch12代數結構→Ch13有限狀態機→Ch14玻里亞計數"}],
 recommended_videos:[
   {name:"交大OCW 易志偉《離散數學》Lec01 Logic and Proofs (1/5)",url:"https://www.youtube.com/watch?v=klWl-t7V5qY",note:"整科第一堂課，先看這支再進邏輯與命題章節"},
   {name:"TrevTutor：Pigeonhole Principle",url:"https://www.youtube.com/watch?v=2-mxYrCNX60",note:"鴿巢原理的應用題型示範，計數原理章節前先看"},
   {name:"Generating Functions | Part 1",url:"https://www.youtube.com/watch?v=tA2cqfNh5EM",note:"生成函數最容易卡關，這支從頭建立觀念，配合遞迴關係章節看"}],
 chapters:[
  {n:"主題1",t:"邏輯與命題",sub:"Propositional Logic、Predicate Logic、量詞",pri:"must",hrs:"5hr",wk:11,
   key:"真值表、邏輯等價（De Morgan定律背熟）、量詞∀和∃的否定",
   mats:[
    {type:"vid",text:"交大OCW 易志偉《離散數學》Lec01 Logic and Proofs (1/5)",url:"https://www.youtube.com/watch?v=klWl-t7V5qY",dur:"1:21:01"},
    {type:"vid",text:"交大OCW 易志偉《離散數學》Lec02 Logic and Proofs (2/5)",url:"https://www.youtube.com/watch?v=ih43BS7GsNY",dur:"36:23"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第1A講 Logic and Set Theory",url:"https://www.youtube.com/watch?v=A_NNGOqui7s",dur:"11:23",note:"換個老師講法用"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第1B講 Logic and Set Theory",url:"https://www.youtube.com/watch?v=QCh-aVmXANA",dur:"28:17"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第1C講 Logic and Set Theory",url:"https://www.youtube.com/watch?v=jBoa60H5XVU",dur:"29:34"},
    {type:"ex",text:"真值表與邏輯等價練習 × 5 題（離散上冊 Ch1 習題）"}
   ]},
  {n:"主題2",t:"證明方法",sub:"Direct Proof、Proof by Contradiction、Mathematical Induction；附整除、同餘與進位（數論基礎）",pri:"must",hrs:"11.5hr",wk:12,
   key:"三種證明方法的結構、強歸納法（Strong Induction）、Well-Ordering Principle、謂詞邏輯的推導",
   mats:[
    {type:"vid",text:"交大OCW 易志偉《離散數學》Lec03 Logic and Proofs (3/5)",url:"https://www.youtube.com/watch?v=_WXIdyyHfqk",dur:"1:07:01"},
    {type:"vid",text:"交大OCW 易志偉《離散數學》Lec04 Logic and Proofs (4/5)",url:"https://www.youtube.com/watch?v=qilMh8Uoabk",dur:"1:38:07"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第3A講 Mathematical Induction and Functions",url:"https://www.youtube.com/watch?v=lW6rnG95fEs",dur:"18:59"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第3B講 Mathematical Induction and Functions",url:"https://www.youtube.com/watch?v=MbqDHNAMoZ8",dur:"17:11"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第3C講 Mathematical Induction and Functions",url:"https://www.youtube.com/watch?v=z9KwEh9GBes",dur:"12:50"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第3D講 Mathematical Induction and Functions",url:"https://www.youtube.com/watch?v=4myFFRFCMXw",dur:"13:24",note:"換個老師講法用"},
    {type:"vid",text:"交大OCW 易志偉《離散數學》Lec08 Algorithms and the Integers (1/4)",url:"https://www.youtube.com/watch?v=wiVH6goGrWQ",dur:"28:55"},
    {type:"vid",text:"交大OCW 易志偉《離散數學》Lec09 Algorithms and the Integers (2/4)",url:"https://www.youtube.com/watch?v=a_iekTDu1xQ",dur:"34:00"},
    {type:"vid",text:"交大OCW 易志偉《離散數學》Lec10 Algorithms and the Integers (3/4)",url:"https://www.youtube.com/watch?v=ddMlBS2RYp4",dur:"1:27:28"},
    {type:"vid",text:"交大OCW 易志偉《離散數學》Lec11 Algorithms and the Integers (4/4) / Induction and Recur (1/4)",url:"https://www.youtube.com/watch?v=IlMZbpJW1ek",dur:"45:10"},
    {type:"vid",text:"交大OCW 易志偉《離散數學》Lec12 Induction and Recur (2/4)",url:"https://www.youtube.com/watch?v=R29RKSmZCnM",dur:"1:14:15"},
    {type:"vid",text:"交大OCW 易志偉《離散數學》Lec13 Induction and Recur (3/4)",url:"https://www.youtube.com/watch?v=5QtHzN4SRZc",dur:"59:03"},
    {type:"vid",text:"MIT OCW 6.042J：Well Ordering Principle（良序原理）",url:"https://www.youtube.com/watch?v=fV3v6qQ3w4A",dur:"5:38"},
    {type:"ex",text:"數學歸納法完整證明 × 3 題（寫出 Base Case + Inductive Step）"}
   ]},
  {n:"主題3",t:"集合與函數",sub:"Set Operations、Functions、Bijection、Cardinality",pri:"hi",hrs:"7.5hr",wk:12,
   key:"集合運算（聯集/交集/差集/補集）的性質、函數的單射/滿射/雙射定義、Cantor對角線論證（可數vs不可數）",
   mats:[
    {type:"vid",text:"交大OCW 易志偉《離散數學》Lec05 Sets, Functions, Sequences, and Sums (1/3)",url:"https://www.youtube.com/watch?v=8_bLOJfZW6g",dur:"35:28"},
    {type:"vid",text:"交大OCW 易志偉《離散數學》Lec06 Sets, Functions, Sequences, and Sums (2/3)",url:"https://www.youtube.com/watch?v=6U8lGu2pZyM",dur:"1:13:55"},
    {type:"vid",text:"交大OCW 易志偉《離散數學》Lec07 Sets, Functions, Sequences, and Sums (3/3)",url:"https://www.youtube.com/watch?v=yR-nZxFS8Hk",dur:"1:21:01"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第2A講 Set Theory",url:"https://www.youtube.com/watch?v=f_Vw45CmKXs",dur:"20:13"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第2B講 Set Theory",url:"https://www.youtube.com/watch?v=r8HEDHCKhR4",dur:"23:47"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第4A講 Functions",url:"https://www.youtube.com/watch?v=zsQ-r279BbA",dur:"19:42"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第4B講 Functions",url:"https://www.youtube.com/watch?v=5QvVXhrnTHQ",dur:"22:33"},
    {type:"ex",text:"集合運算與函數 one-to-one/onto 判斷 × 5 題"}
   ]},
  {n:"主題4",t:"遞迴關係",sub:"Recurrence Relation、特徵方程、生成函數入門",pri:"must",hrs:"7hr",wk:13,
   key:"線性遞迴關係的特徵方程解法（homogeneous和particular solution）、Fibonacci通項公式推導——生成函數這塊有讀書筆記提醒最常見的算錯原因是一開始沒把初始項（initial term）定義清楚，導致後面級數展開整組錯，練習時養成先把初始條件寫下來的習慣",
   mats:[
    {type:"vid",text:"Solving Recurrences Using Substitution Method",url:"https://www.youtube.com/watch?v=dVPDdHE3RJU",dur:"13:12"},
    {type:"vid",text:"Generating Functions | Part 1",url:"https://www.youtube.com/watch?v=tA2cqfNh5EM",dur:"31:07"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第12A講 Recurrence Relations",url:"https://www.youtube.com/watch?v=SIJSKBFIMhI",dur:"21:21"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第12B講 Recurrence Relations",url:"https://www.youtube.com/watch?v=hbOYxWE_Qks",dur:"16:56"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第12C講 Recurrence Relations",url:"https://www.youtube.com/watch?v=n_mt9ym4MAk",dur:"16:39"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第12D講 Recurrence Relations",url:"https://www.youtube.com/watch?v=Hfc676iknHY",dur:"20:01"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第13A講 Recurrence Relations",url:"https://www.youtube.com/watch?v=eWIlWXtnDzY",dur:"15:48"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第13B講 Recurrence Relations",url:"https://www.youtube.com/watch?v=oUULN2JwYbw",dur:"21:05"},
    {type:"ex",text:"線性遞迴關係特徵方程求通解 × 5 題（離散上冊 Ch7 習題）"}
   ]},
  {n:"主題5",t:"計數原理",sub:"Permutation、Combination、Pigeonhole Principle",pri:"must",hrs:"8.5hr",wk:13,
   key:"加法/乘法原理、排列P(n,r)和組合C(n,r)公式與應用、鴿巢原理的應用（generalized pigeonhole）",
   mats:[
    {type:"vid",text:"TrevTutor：Pigeonhole Principle",url:"https://www.youtube.com/watch?v=2-mxYrCNX60",dur:"16:46"},
    {type:"vid",text:"PERMUTATIONS and COMBINATIONS Review",url:"https://www.youtube.com/watch?v=DBugSTeX1zw",dur:"24:15"},
    {type:"vid",text:"交大OCW 易志偉《離散數學》Lec14 Induction and Recur (4/4) / Counting (1/2)",url:"https://www.youtube.com/watch?v=aLDHXK2M2yk",dur:"31:37"},
    {type:"vid",text:"交大OCW 易志偉《離散數學》Lec15 Counting (2/2)",url:"https://www.youtube.com/watch?v=--gFe7gbFIQ",dur:"1:02:19"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第5A講 Pigeonhole Principle",url:"https://www.youtube.com/watch?v=EznkkFQJ5TM",dur:"18:37"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第5B講 Pigeonhole Principle",url:"https://www.youtube.com/watch?v=tz_miTx3owE",dur:"13:17"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第5C講 Pigeonhole Principle",url:"https://www.youtube.com/watch?v=cB9unFFDJOE",dur:"10:42"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第5D講 Pigeonhole Principle",url:"https://www.youtube.com/watch?v=Cg-9z4Epzq4",dur:"11:45"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第9A講 Principles of Counting",url:"https://www.youtube.com/watch?v=jz8pyl6zXbY",dur:"14:41"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第9B講 Principles of Counting",url:"https://www.youtube.com/watch?v=dzc9FMJua_g",dur:"21:02"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第9C講 Principles of Counting",url:"https://www.youtube.com/watch?v=jGwwJ6boXns",dur:"19:00"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第9D講 Principles of Counting",url:"https://www.youtube.com/watch?v=xCEpXWbSGuM",dur:"22:49"},
    {type:"ex",text:"排列組合應用題 × 10 題（課本 Ch5 全做）"}
   ]},
  {n:"主題6",t:"進階計數",sub:"容斥原理、Generating Function、Burnside引理／玻里亞計數",pri:"hi",hrs:"14hr",wk:13,
   key:"容斥原理公式與應用、常用生成函數、Burnside引理與玻里亞計數——掌握基礎公式即可，深入題型列為選讀",
   peerNote:"同儕筆記地雷：H_r^n（相同物放相異箱）、S(m,n)（相異物放相同箱不允許空）、onto(m,n)（相異物放相異箱不允許空）三種計數公式最常被搞混，要先分清題型再套公式；第二類史特林數的求和上界公式在某份筆記裡疑似不夠精確，跟課本對不上時以課本為準。",
   mats:[
    {type:"vid",text:"The Principle of Inclusion-Exclusion",url:"https://www.youtube.com/watch?v=YlKDp03Kg68",dur:"17:35"},
    {type:"vid",text:"交大OCW 易志偉《離散數學》Lec16 Advanced Counting Techniques (1/4)",url:"https://www.youtube.com/watch?v=filS0k_GTvY",dur:"31:02"},
    {type:"vid",text:"交大OCW 易志偉《離散數學》Lec17 Advanced Counting Techniques (2/4)",url:"https://www.youtube.com/watch?v=XjTuFEQMxE0",dur:"39:02"},
    {type:"vid",text:"交大OCW 易志偉《離散數學》Lec18 Advanced Counting Techniques (3/4)",url:"https://www.youtube.com/watch?v=Tcc9mQDAX_4",dur:"1:13:44"},
    {type:"vid",text:"交大OCW 易志偉《離散數學》Lec19 Advanced Counting Techniques (4/4)",url:"https://www.youtube.com/watch?v=DGYCglldsAY",dur:"1:22:37"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第10A講 Principles of Counting and Principle of Inclusion and Exclusion",url:"https://www.youtube.com/watch?v=MQfb_LrlWl0",dur:"21:26"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第10B講 Principles of Counting and Principle of Inclusion and Exclusion",url:"https://www.youtube.com/watch?v=NarGsMWpqc8",dur:"15:50"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第11A講 Principle of Inclusion and Exclusion",url:"https://www.youtube.com/watch?v=oWrW8vI5Bas",dur:"19:56"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第11B講 Principle of Inclusion and Exclusion",url:"https://www.youtube.com/watch?v=Mez5poBYLcc",dur:"20:12"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第11C+D講 Principle of Inclusion and Exclusion",url:"https://www.youtube.com/watch?v=ZZqiVUT8EWI",dur:"29:28"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第14A講 Generating Functions",url:"https://www.youtube.com/watch?v=TTSM0M9qlfA",dur:"17:20"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第14B講 Generating Functions",url:"https://www.youtube.com/watch?v=zyiBuJs8gm4",dur:"21:14"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第14C講 Generating Functions",url:"https://www.youtube.com/watch?v=Al6ODllhdnc",dur:"26:15"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第14D講 Generating Functions",url:"https://www.youtube.com/watch?v=q-T1GS0zeM4",dur:"24:20"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第15A講 Generating Functions",url:"https://www.youtube.com/watch?v=LO5yHmkp5c4",dur:"22:30"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第15B講 Generating Functions",url:"https://www.youtube.com/watch?v=8zfYKqZaSi8",dur:"25:54"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第15C講 Generating Functions",url:"https://www.youtube.com/watch?v=zjsDjXEa6Zc",dur:"20:35"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第15D講 Generating Functions",url:"https://www.youtube.com/watch?v=ghXHy5y3EuE",dur:"14:36"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第16A講 Generating Functions",url:"https://www.youtube.com/watch?v=0aAQE0u0Dq0",dur:"28:42"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第16B講 Generating Functions",url:"https://www.youtube.com/watch?v=I9tMLP4KeEY",dur:"25:19"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第17A講 Generating Functions and Complexity of Algorithms",url:"https://www.youtube.com/watch?v=VAn-mpZAbM4",dur:"25:01"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第17B講 Generating Functions and Complexity of Algorithms",url:"https://www.youtube.com/watch?v=p7fXiuokfWs",dur:"13:00"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第17C講 Generating Functions and Complexity of Algorithms",url:"https://www.youtube.com/watch?v=XVt8JJgj8JE",dur:"23:14"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第17D講 Generating Functions and Complexity of Algorithms",url:"https://www.youtube.com/watch?v=cM8ymJ355fc",dur:"21:48"},
    {type:"vid",text:"Mathemaniac：Burnside's Lemma（Burnside 引理）",url:"https://www.youtube.com/watch?v=6kfbotHL0fs",dur:"13:45"},
    {type:"ex",text:"容斥原理應用題 × 5 題（離散上冊 Ch6 習題）"}
   ]},
  {n:"主題7",t:"圖論（基礎）",sub:"圖的定義、Walk/Path/Cycle、Euler/Hamilton路徑",pri:"must",hrs:"6.5hr",wk:14,
   key:"握手定理（Σdeg=2|E|）",
   mats:[
    {type:"vid",text:"交大OCW 易志偉《離散數學》Lec22 Graphs (1/3)",url:"https://www.youtube.com/watch?v=q0Vy0gQCB_g",dur:"1:23:28"},
    {type:"vid",text:"交大OCW 易志偉《離散數學》Lec23 Graphs (2/3)",url:"https://www.youtube.com/watch?v=y4sLC9zeEvU",dur:"40:14"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第18A講 Introduction to Graph Theory",url:"https://www.youtube.com/watch?v=xDNyQRMyLCM",dur:"22:24"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第18B講 Introduction to Graph Theory",url:"https://www.youtube.com/watch?v=vNXSZd63tuw",dur:"15:08"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第19A講 Introduction to Graph Theory",url:"https://www.youtube.com/watch?v=ue8V8aOKveE",dur:"22:43"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第19B講 Introduction to Graph Theory",url:"https://www.youtube.com/watch?v=2aH0dlnEhZ0",dur:"24:58"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第19C講 Introduction to Graph Theory",url:"https://www.youtube.com/watch?v=lyVL6rqj7gU",dur:"15:38"},
    {type:"ex",text:"Euler 路徑判斷 + 握手定理計算 × 5 題（離散下冊 Ch8 習題）"}
   ]},
  {n:"主題8",t:"圖論（進階）",sub:"Euler迴路、Planar Graph、Graph Coloring、Spanning Tree；附Matching、Max Flow",pri:"hi",hrs:"20.5hr",wk:14,
   key:"Euler公式（v-e+f=2，平面圖）、四色定理（概念，不需證明）、Chromatic Number定義、生成樹計數、Euler路徑/迴路的條件（奇數度節點數）、Hamilton路徑（無簡單判斷條件，考概念）",
   mats:[
    {type:"vid",text:"Spanning Tree：Discrete Mathematics",url:"https://www.youtube.com/watch?v=6WZvVJ0Q1FA",dur:"43:05"},
    {type:"vid",text:"Discrete Math II - 10.8.1 Graph Coloring",url:"https://www.youtube.com/watch?v=Erea1QASjXY",dur:"14:33"},
    {type:"vid",text:"交大OCW 易志偉《離散數學》Lec24 Graphs (3/3)",url:"https://www.youtube.com/watch?v=P2FRYshQ57s",dur:"1:27:09"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第20A講 Euler Trails and Circuits",url:"https://www.youtube.com/watch?v=ZYtvLbCdn1s",dur:"25:28"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第20B講 Euler Trails and Circuits",url:"https://www.youtube.com/watch?v=0kzn9J950-I",dur:"27:04"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第21A講 Euler Trails and Circuits and Planar Graphs",url:"https://www.youtube.com/watch?v=ATY_gkJbfNQ",dur:"21:46"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第21B講 Euler Trails and Circuits and Planar Graphs",url:"https://www.youtube.com/watch?v=UteTnjk0BAk",dur:"28:34"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第21C講 Euler Trails and Circuits and Planar Graphs",url:"https://www.youtube.com/watch?v=otP5yRAYc9w",dur:"23:09"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第21D講 Euler Trails and Circuits and Planar Graphs",url:"https://www.youtube.com/watch?v=ogk1m2TvR0I",dur:"18:05"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第22A講 Planar Graphs",url:"https://www.youtube.com/watch?v=B0UDSm9Jiqs",dur:"25:17"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第22B講 Planar Graphs",url:"https://www.youtube.com/watch?v=yewOwasU9Hk",dur:"29:53"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第23A講 Trees",url:"https://www.youtube.com/watch?v=I0AdyRXvHY4",dur:"21:55"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第23B講 Trees",url:"https://www.youtube.com/watch?v=VHsNFDXGV-0",dur:"18:06"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第23C講 Trees",url:"https://www.youtube.com/watch?v=BlAe2OrCgTw",dur:"32:06"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第23D講 Trees",url:"https://www.youtube.com/watch?v=m7RjwmS8c7U",dur:"21:48"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第24A講 Trees",url:"https://www.youtube.com/watch?v=FxZGkU0MvfY",dur:"28:03"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第24B講 Trees",url:"https://www.youtube.com/watch?v=gF8PA6FVLp0",dur:"26:39"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第25A講 Trees",url:"https://www.youtube.com/watch?v=ppLCIhAnxfI",dur:"18:55"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第25B講 Trees",url:"https://www.youtube.com/watch?v=HxJ9nxLsGM8",dur:"21:30"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第25C講 Trees",url:"https://www.youtube.com/watch?v=OOQOvGDi_0w",dur:"30:00"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第25D講 Trees",url:"https://www.youtube.com/watch?v=AzCFmDjYLXM",dur:"14:18"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第26A講 Trees",url:"https://www.youtube.com/watch?v=-1gpdgE3Tig",dur:"16:09"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第26B講 Trees",url:"https://www.youtube.com/watch?v=_ArgZzfH7aw",dur:"31:15"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第27A講 Shortest-Path Problem and Minimal Spanning Trees",url:"https://www.youtube.com/watch?v=Kj2w3kDGWBc",dur:"20:31"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第27B講 Shortest-Path Problem and Minimal Spanning Trees",url:"https://www.youtube.com/watch?v=9r_YXw7i_mY",dur:"34:41"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第27C講 Shortest-Path Problem and Minimal Spanning Trees",url:"https://www.youtube.com/watch?v=Greva74E0ZU",dur:"29:01"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第27D講 Shortest-Path Problem and Minimal Spanning Trees",url:"https://www.youtube.com/watch?v=crMqlrIH4Ds",dur:"26:16"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第28A講 Minimal Spanning Trees",url:"https://www.youtube.com/watch?v=XAW_4UvQGWg",dur:"27:40"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第28B講 Minimal Spanning Trees",url:"https://www.youtube.com/watch?v=LIKCqbxc-sI",dur:"22:47"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第29A講 Matching Problem",url:"https://www.youtube.com/watch?v=EIEm2TDxzGE",dur:"27:50"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第29B講 Matching Problem",url:"https://www.youtube.com/watch?v=Xl7Giuc-Adk",dur:"14:41"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第29C講 Matching Problem",url:"https://www.youtube.com/watch?v=PfQKS71fBus",dur:"25:19"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第29D講 Matching Problem",url:"https://www.youtube.com/watch?v=PLpMBf9Nbyg",dur:"34:41"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第30A講 Matching Problem",url:"https://www.youtube.com/watch?v=fOgt4u5Hjs0",dur:"28:25"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第30B講 Matching Problem",url:"https://www.youtube.com/watch?v=JGqB5cUX6cE",dur:"22:26"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第31A講 Maximum Flow Problem",url:"https://www.youtube.com/watch?v=O2cUhuqSQJ8",dur:"21:59"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第31B講 Maximum Flow Problem",url:"https://www.youtube.com/watch?v=ePI-vLEM01Q",dur:"24:20"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第31C講 Maximum Flow Problem",url:"https://www.youtube.com/watch?v=ju-qSc1_rwQ",dur:"25:34"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第31D講 Maximum Flow Problem",url:"https://www.youtube.com/watch?v=YnPS5TFJiFE",dur:"21:22"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第32A講 Maximum Flow Problem",url:"https://www.youtube.com/watch?v=ZCOlf1NFPA4",dur:"24:30"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第32B講 Maximum Flow Problem",url:"https://www.youtube.com/watch?v=oFStjKYt8b4",dur:"22:57"},
    {type:"vid",text:"Math at Andrews：Cayley's Tree Theorem（生成樹計數）",url:"https://www.youtube.com/watch?v=Wi8IvnlMNxs",dur:"11:17"},
    {type:"vid",text:"Numberphile：The Four Color Map Theorem（四色定理）",url:"https://www.youtube.com/watch?v=NgbK43jB4rQ",dur:"14:18"},
    {type:"ex",text:"Euler 公式（v-e+f=2）判斷平面圖 × 3 題"}
   ]},
  {n:"主題9",t:"二元關係",sub:"Equivalence Relation、Partial Order、Poset、Hasse Diagram",pri:"must",hrs:"6.5hr",wk:15,
   key:"等價關係三性質（Reflexive/Symmetric/Transitive）判斷、等價類與集合分割的對應、偏序集（Poset）與Hasse圖繪製、全序vs偏序——台大近年考古題常單題出到10分，不要輕忽",
   mats:[
    {type:"book",text:"離散下冊（林緯）Ch11 二元關係及其應用"},
    {type:"vid",text:"Equivalence Relation",url:"https://www.youtube.com/watch?v=RexPywlCmV8",dur:"6:29"},
    {type:"vid",text:"交大OCW 易志偉《離散數學》Lec20 Relations (2/4)",url:"https://www.youtube.com/watch?v=CtxWiSNrxvI",dur:"43:59"},
    {type:"vid",text:"交大OCW 易志偉《離散數學》Lec21 Relations (3/4)",url:"https://www.youtube.com/watch?v=ouXIBZTTtuk",dur:"1:08:03"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第6A講 Relations",url:"https://www.youtube.com/watch?v=PedAKD8Ybkk",dur:"20:56"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第6B講 Relations",url:"https://www.youtube.com/watch?v=EAvNAZUNDnw",dur:"24:01"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第7A講 Relations",url:"https://www.youtube.com/watch?v=MvNiJbIxfu0",dur:"22:20"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第7B講 Relations",url:"https://www.youtube.com/watch?v=gK9BvMo2uCY",dur:"13:30"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第7C講 Relations",url:"https://www.youtube.com/watch?v=lmgRzAA4ZbY",dur:"15:29"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第7D講 Relations",url:"https://www.youtube.com/watch?v=zuoCvi9f56Y",dur:"18:17"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第8A講 Relations",url:"https://www.youtube.com/watch?v=ayTx5zNqsms",dur:"20:27"},
    {type:"vid",text:"清大OCW 趙啟超《離散數學》第8B講 Relations",url:"https://www.youtube.com/watch?v=AqETkP2lPY4",dur:"20:38"},
    {type:"ex",text:"給定關係，判斷是否為等價關係並找出等價類 × 5題 + 手畫Hasse圖 × 3題"}
   ]},
  {n:"主題10",t:"代數結構",sub:"Group、Ring、Boolean Algebra",pri:"lo",hrs:"4hr",wk:15,
   key:"群的四條性質（封閉性/結合律/單位元/反元素）、布林代數的化簡規則",
   peerNote:"同儕筆記提醒：這章被同儕筆記作者評為「CP值很低，全部章節中最難，又很少考」，時間不夠時可以放到最後讀，符合這章pri標為lo（補充）的定位。",
   mats:[
    {type:"vid",text:"Algebraic Structures: Groups, Rings, and Fields",url:"https://www.youtube.com/watch?v=vfyUU_prh9s",dur:"23:42"},
    {type:"ex",text:"此章輕讀，確認群的四條性質即可"}
   ]}]},
{id:"ca",name:"計算機組織",color:"#31AAB0",hours:35,weeks:2,coverage:"7/11校",
tip:"Pipeline與Cache是核心章節。Pipeline要能手算Hazard與CPI，Cache要能計算命中率與AMAT。同一主題有多位老師時，完成任一版本即可。",
 recommended_books:[
   {name:"計算機組織與結構重點直擊（上）— 張凡編著，三版（大碩）",note:"✅ 你有這本。Ch1指令集→Ch2計算機算術→Ch3效能→Ch4處理器→Ch5管線"},
   {name:"計算機組織與結構重點直擊（下）— 張凡編著，三版（大碩）",note:"✅ 你有這本。Ch6記憶體階層／Cache→Ch7儲存裝置／I/O→Ch8多重處理器→Ch9基本概念"},
   {name:"計組與計結：數位邏輯（張凡老師／TKB）",note:"✅ 你有這份講義。Ch1二進位→Ch2布林代數→Ch3組合邏輯→Ch4序向邏輯→Ch5暫存器與計數器→Ch6記憶體與可程式邏輯→Ch7非同步序向電路"}],
 recommended_videos:[
   {name:"黃婷婷教授計算機結構_第1A講 Course Outline",url:"https://www.youtube.com/watch?v=YY1wOUdIwWU",note:"整科課程總覽，開始讀章節前先看這支"},
   {name:"Pipeline Hazards（Structural, Data and Control Hazards）",url:"https://www.youtube.com/watch?v=t27kbXWP5GY",note:"Pipeline是全科最重要的計算題型，這支把三種Hazard講得最清楚"},
   {name:"Average Memory Access Time（AMAT）— Computer Organization",url:"https://www.youtube.com/watch?v=Y1esjWBTf7Q",note:"Cache章節的AMAT計算範例，考試幾乎必出"}],
 chapters:[
  {n:"主題1",t:"數字系統與運算",sub:"二進位、補數、浮點數IEEE 754；附課程導論",pri:"must",hrs:"11hr",wk:18,
   key:"二進位/十六進位互轉、2's Complement加減法、IEEE 754 single precision格式（1+8+23位元）、denormalized number",
   peerNote:"同儕筆記地雷：浮點數加法不具結合律（(A+B)+C ≠ A+(B+C)），這是常見考題陷阱，同儕筆記中只有一份特別獨立列出這個警語，容易被忽略。",
   mats:[
    {type:"vid",text:"IEEE 754 Floating Point Representation（Single & Double Precision）",url:"https://www.youtube.com/watch?v=sKxdXfH5qko",dur:"12:42"},
    {type:"vid",text:"黃婷婷教授計算機結構_第10A講 Computer Arithmetic",url:"https://www.youtube.com/watch?v=kWCUI2x7iSQ",dur:"44:12"},
    {type:"vid",text:"黃婷婷教授計算機結構_第1A講 Course Outline",url:"https://www.youtube.com/watch?v=YY1wOUdIwWU",dur:"35:56"},
    {type:"vid",text:"黃婷婷教授計算機結構_第2A講 Computer's History",url:"https://www.youtube.com/watch?v=y76BZn5u-b4",dur:"44:41"},
    {type:"vid",text:"黃婷婷教授計算機結構_第3A講 Computer Abstractions and Technology",url:"https://www.youtube.com/watch?v=2ICqPUCycWQ",dur:"52:55"},
    {type:"vid",text:"黃婷婷教授計算機結構_第9A講 Instruction Set Architecture / Computer Arithmetic",url:"https://www.youtube.com/watch?v=-iVii4A6cQg",dur:"50:46"},
    {type:"vid",text:"黃婷婷教授計算機結構_第9B講 Instruction Set Architecture / Computer Arithmetic",url:"https://www.youtube.com/watch?v=2srq4qFEhu8",dur:"45:33"},
    {type:"vid",text:"黃婷婷教授計算機結構_第11A講 Computer Arithmetic",url:"https://www.youtube.com/watch?v=cWRbSpzu3DE",dur:"47:51"},
    {type:"vid",text:"黃婷婷教授計算機結構_第12A講 Computer Arithmetic",url:"https://www.youtube.com/watch?v=GZ8L2afnZFU",dur:"47:12"},
    {type:"vid",text:"黃婷婷教授計算機結構_第12B講 Computer Arithmetic",url:"https://www.youtube.com/watch?v=gBaVGirWTlU",dur:"42:36"},
    {type:"vid",text:"黃婷婷教授計算機結構_第13A講 Computer Arithmetic",url:"https://www.youtube.com/watch?v=gnPwCZLD04c",dur:"49:46"},
    {type:"ex",text:"IEEE 754 浮點數轉換手算 × 10 題（計組上冊張凡 Ch2 考古題）"}
   ]},
  {n:"主題2",t:"指令集架構 ISA",sub:"RISC vs CISC、定址模式、MIPS指令",pri:"must",hrs:"9.5hr",wk:18,
   key:"六種定址模式（Immediate/Register/Direct/Indirect/Base/PC-relative）比較、RISC vs CISC核心差異、MIPS R-type/I-type/J-type格式",
   peerNote:"同儕筆記提醒：讀過的同儕筆記（含標題掛RISC-V的資料統整篇）內文其實幾乎全用MIPS舉例，真正的RISC-V教材只在連結清單當外部資源列出，沒有一份自己整理過RISC-V內容，如果目標校系考RISC-V，這塊得另外找教材。",
   mats:[
    {type:"vid",text:"1.5 Addressing Modes | MIPS | Computer Architecture",url:"https://www.youtube.com/watch?v=fy7H3jWfBnY",dur:"20:17"},
    {type:"vid",text:"黃婷婷教授計算機結構_第8A講 Instruction set architecture",url:"https://www.youtube.com/watch?v=4FhTREqO4xE",dur:"48:28"},
    {type:"vid",text:"黃婷婷教授計算機結構_第4A講 Computer Abstractions and Technology / Instruction Set Architecture",url:"https://www.youtube.com/watch?v=A6sbcPRLkmg",dur:"49:50"},
    {type:"vid",text:"黃婷婷教授計算機結構_第4B講 Computer Abstractions and Technology / Instruction Set Architecture",url:"https://www.youtube.com/watch?v=SbLPeJMK_d8",dur:"48:15"},
    {type:"vid",text:"黃婷婷教授計算機結構_第5A講 Instruction Set Architecture",url:"https://www.youtube.com/watch?v=Ri-K2287x2U",dur:"48:48"},
    {type:"vid",text:"黃婷婷教授計算機結構_第6A講 Instruction Set Architecture",url:"https://www.youtube.com/watch?v=jhMWFZV6hy8",dur:"49:35"},
    {type:"vid",text:"黃婷婷教授計算機結構_第6B講 Instruction Set Architecture",url:"https://www.youtube.com/watch?v=PlbXyb-UymI",dur:"46:44"},
    {type:"vid",text:"黃婷婷教授計算機結構_第7A講 Instruction Set Architecture",url:"https://www.youtube.com/watch?v=H6wkyzXzX6g",dur:"48:35"},
    {type:"vid",text:"黃婷婷教授計算機結構_第7B講 Instruction Set Architecture",url:"https://www.youtube.com/watch?v=CqVPl7fIlAo",dur:"49:43"},
    {type:"ex",text:"MIPS 指令格式分析（R/I/J-type）× 5 題"}
   ]},
  {n:"主題3",t:"CPU設計",sub:"ALU、Datapath、Control Unit、單週期vs多週期",pri:"hi",hrs:"7hr",wk:19,
   key:"單週期CPU的datapath設計、各指令（lw/sw/beq/add）的控制訊號設定、多週期CPU的優缺點",
   mats:[
    {type:"vid",text:"黃婷婷教授計算機結構_第15A講 Single-Cycle Processor",url:"https://www.youtube.com/watch?v=iblxfbOsp_g",dur:"45:40"},
    {type:"vid",text:"黃婷婷教授計算機結構_第14A講 Computer Arithmetic / Single-Cycle Processor",url:"https://www.youtube.com/watch?v=Ml6xpYl_tns",dur:"49:03"},
    {type:"vid",text:"黃婷婷教授計算機結構_第14B講 Computer Arithmetic / Single-Cycle Processor",url:"https://www.youtube.com/watch?v=YvSSt6kQbuk",dur:"48:15"},
    {type:"vid",text:"黃婷婷教授計算機結構_第16A講 Single-Cycle Processor",url:"https://www.youtube.com/watch?v=3Ig6EcOGV3s",dur:"51:02"},
    {type:"vid",text:"黃婷婷教授計算機結構_第17A講 Single-Cycle Processor / Pipelining",url:"https://www.youtube.com/watch?v=4vRk10j9MC8",dur:"41:39"},
    {type:"vid",text:"Enzo 獨自升級：單週期 vs FSM（多週期）vs Pipeline【計算機架構 EP2】",url:"https://www.youtube.com/watch?v=QQG_zv-moMs",dur:"16:15"},
    {type:"ex",text:"控制訊號真值表填寫 × 3 題（計組上冊張凡 Ch4 考古題）"}
   ]},
  {n:"主題4",t:"Pipeline",sub:"五階段Pipeline、Hazard偵測與處理",pri:"must",hrs:"11hr",wk:19,
   key:"三種Hazard（Data/Control/Structural）的成因、Data Forwarding如何減少stall、計算Pipeline的CPI（CPI=1+stalls per instruction）、Branch Prediction的效益計算——有考生心得提到台大考過直接給一段組合語言（如含lw、branch的指令序列）要求手算實際stall週期數，不是只考公式代入，練習時要準備看得懂組合語言指令再算Hazard的題型",
   peerNote:"同儕筆記地雷：lw後面緊接sw把剛載入的值存回記憶體（如lw $t0；sw $t0），雖然是資料相依，有MEM階段的forwarding就不必stall；真正即使有forwarding也一定要stall一個週期的是load-use（lw的結果被下一條指令在EX階段使用），這是常被混淆的地方，同儕筆記中只有一份特別點出來。",
   mats:[
    {type:"vid",text:"Pipeline Hazards（Structural, Data and Control Hazards）",url:"https://www.youtube.com/watch?v=t27kbXWP5GY",dur:"15:37"},
    {type:"vid",text:"黃婷婷教授計算機結構_第21A講 Pipelining",url:"https://www.youtube.com/watch?v=WpJZIFEtgg4",dur:"51:10"},
    {type:"vid",text:"黃婷婷教授計算機結構_第21B講 Pipelining",url:"https://www.youtube.com/watch?v=Bu-L3BvML5E",dur:"53:55"},
    {type:"vid",text:"黃婷婷教授計算機結構_第17B講 Single-Cycle Processor / Pipelining",url:"https://www.youtube.com/watch?v=_GDfZbzFVs0",dur:"47:37"},
    {type:"vid",text:"黃婷婷教授計算機結構_第18A講 Pipelining",url:"https://www.youtube.com/watch?v=IO5zhg0flDI",dur:"36:53"},
    {type:"vid",text:"黃婷婷教授計算機結構_第19A講 Pipelining",url:"https://www.youtube.com/watch?v=XtcJtp7n4o8",dur:"49:53"},
    {type:"vid",text:"黃婷婷教授計算機結構_第19B講 Pipelining",url:"https://www.youtube.com/watch?v=p_GUphUjmvI",dur:"49:10"},
    {type:"vid",text:"黃婷婷教授計算機結構_第20A講 Pipelining",url:"https://www.youtube.com/watch?v=II7Eh-Q8hdI",dur:"51:36"},
    {type:"vid",text:"Udacity：Pipeline CPI（Georgia Tech HPCA）",url:"https://www.youtube.com/watch?v=GAUppsLpjvg",dur:"3:36"},
    {type:"ex",text:"Pipeline CPI 和 Stall 手算 × 5 題（計組上冊 Ch5 所有考古題）"}
   ]},
  {n:"主題5",t:"記憶體層次與Cache",sub:"Cache設計、命中率、AMAT計算",pri:"must",hrs:"10hr",wk:19,
   key:"三種Cache映射（Direct-mapped/Set-Associative/Fully-Associative）的比較、AMAT公式（AMAT=Hit time+Miss rate×Miss penalty）、寫策略（Write-back vs Write-through）、替換演算法（LRU/FIFO）",
   peerNote:"同儕筆記重點：AMAT、Cache miss三分類、write policy在同儕筆記中整理得最完整，但其中一份有Spatial Locality的筆誤，讀到時對照課本確認，不要照單全收。",
   mats:[
    {type:"vid",text:"Average Memory Access Time（AMAT）— Computer Organization",url:"https://www.youtube.com/watch?v=Y1esjWBTf7Q",dur:"6:54"},
    {type:"vid",text:"黃婷婷教授計算機結構_第23A講 Memory（Cache/Block Size/Write-Through）",url:"https://www.youtube.com/watch?v=-83W2w16UYI",dur:"48:24"},
    {type:"vid",text:"黃婷婷教授計算機結構_第23B講 Memory",url:"https://www.youtube.com/watch?v=QWGIvh-k7go",dur:"50:18"},
    {type:"vid",text:"黃婷婷教授計算機結構_第22A講 Memory",url:"https://www.youtube.com/watch?v=p16QNdRJqMk",dur:"48:12"},
    {type:"vid",text:"黃婷婷教授計算機結構_第22B講 Memory",url:"https://www.youtube.com/watch?v=4q1UMEuDvpM",dur:"44:49"},
    {type:"vid",text:"黃婷婷教授計算機結構_第24A講 Memory",url:"https://www.youtube.com/watch?v=1fhK7KF8hgE",dur:"48:04"},
    {type:"vid",text:"黃婷婷教授計算機結構_第24B講 Memory",url:"https://www.youtube.com/watch?v=nPiZueMU4fQ",dur:"41:42"},
    {type:"ex",text:"Cache AMAT 計算 × 5 題 + Direct-mapped vs Set-Associative 比較（計組下冊 Ch6 考古題）"}
   ]},
  {n:"主題6",t:"記憶體系統",sub:"Main Memory、DRAM、Memory Interleaving",pri:"hi",hrs:"6hr",wk:19,
   key:"DRAM存取流程（RAS/CAS）、Memory Interleaving如何降低存取延遲、記憶體頻寬計算",
   mats:[
    {type:"vid",text:"Computer Science Lessons：DRAM Part 6 Burst Mode and Bank Interleaving",url:"https://www.youtube.com/watch?v=9BjVUmaXaCQ",dur:"12:09"},
    {type:"vid",text:"Memory Interleaving concept",url:"https://www.youtube.com/watch?v=0dTWcYk1rts",dur:"9:49"},
    {type:"vid",text:"黃婷婷教授計算機結構_第25A講 Memory",url:"https://www.youtube.com/watch?v=JqxIZlm23R8",dur:"49:19"},
    {type:"vid",text:"黃婷婷教授計算機結構_第25B講 Memory",url:"https://www.youtube.com/watch?v=CDpUW5B9EbA",dur:"47:46"},
    {type:"vid",text:"黃婷婷教授計算機結構_第26A講 Memory",url:"https://www.youtube.com/watch?v=Jtulk55Q1Ls",dur:"46:15"},
    {type:"vid",text:"黃婷婷教授計算機結構_第26B講 Memory",url:"https://www.youtube.com/watch?v=m6HNCwqazNE",dur:"36:44"},
    {type:"ex",text:"Memory Interleaving 存取時間計算 × 2 題"}
   ]},
  {n:"主題7",t:"I/O與中斷",sub:"DMA、Polling、Interrupt、Bus仲裁",pri:"hi",hrs:"3hr",wk:19,
   key:"三種I/O方式比較（Polling耗CPU/Interrupt效率高/DMA最高效）、Interrupt的處理流程、Bus仲裁方式",
   peerNote:"同儕筆記地雷：有筆記把Exception（CPU內部由執行中的指令引起，如overflow、未定義指令）跟Interrupt（CPU外部事件，如I/O裝置發出）處理流程混著講、沒有分開列，讀這段時自己對照課本把兩種異常處理流程拆開記，不要照單全收。",
   mats:[
    {type:"vid",text:"Modes of Transfer | Programmed, Interrupt-initiated I/O & DMA",url:"https://www.youtube.com/watch?v=E82x-cug9YE",dur:"10:48"},
    {type:"vid",text:"Bus Arbitration in Computer Organization | Centralized & Distributed",url:"https://www.youtube.com/watch?v=Yp_3OrDhUkQ",dur:"16:09"},
    {type:"ex",text:"DMA vs Polling vs Interrupt 比較題 × 3 題"}
   ]},
  {n:"主題8",t:"平行與多核",sub:"Multiprocessor、Cache Coherence、Amdahl's Law",pri:"lo",hrs:"3hr",wk:19,
   key:"MESI協定的四個狀態（Modified/Exclusive/Shared/Invalid）、Amdahl's Law計算最大加速比",
   peerNote:"同儕筆記提醒：只有一份筆記（大碩張凡）真正系統講到多處理器（SMP/MPP、cache coherence、Flynn分類、GPU），其他同儕筆記都在Cache／虛擬記憶體就結束，這章要靠這份加課本補。",
   mats:[
    {type:"vid",text:"Cache Coherence Problem & Cache Coherency Protocols",url:"https://www.youtube.com/watch?v=r_ZE1XVT8Ao",dur:"11:58"},
    {type:"vid",text:"Amdahl's Law in COA: Basics, Proof, and CPU Performance",url:"https://www.youtube.com/watch?v=2dYV_lADfFI",dur:"9:27"},
    {type:"ex",text:"Amdahl's Law 加速比計算 × 3 題（計組下冊 Ch8 考古題）"}
   ]}]}];
