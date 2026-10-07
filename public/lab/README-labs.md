# 章節實驗室撰寫指南

每一章的互動動畫是一個模組：`public/lab/chapters/<科目id>-<章號>.js`（章號從 1 開始，例如資結第 4 章 = `ds-4.js`）。
外殼 `lab-shell.js` 負責分頁、操作列、狀態卡、字幕、跟學習空間的連動；模組只寫「這章要看到什麼」。

範本：`chapters/ds-1.js`（複雜度：曲線、計數、遞迴樹）、`chapters/ds-2.js`（Stack/Queue/List/Postfix/迷宮）。動手前兩個都要讀完。

## 模組格式

```js
export default function (ctx) {
  const { THREE, lab, colorFor, sleep, $, log, clearLog, setState, controls, on, say, beat, block, tile } = ctx;
  // …這章的狀態與函式…
  return {
    kicker: '資料結構・第 4 章',
    title: 'BST、AVL Tree、Red-Black Tree',
    color: 'var(--ds)',                 // 科目色：--ds --alg --os --la --dm --ca
    modes:  [{ id, name, enter }],      // 可以自己操作的 3D 模式，3–6 個
    pages:  [{ id, name, render(el) }], // 文字頁，至少一個「小測驗」（隨機出題、附解析）
    scenes: { id: { title, play: async (tok) => {} } },  // 自動示範，給學習空間用
    sceneOrder: [ ... ],                // 導覽順序
    stop() {},                          // 清掉 setInterval 等計時器
  };
}
```

## ctx 工具

| 名稱 | 用途 |
|---|---|
| `lab.clear()` | 清空場景（每個 mode 的 enter 第一行就呼叫） |
| `lab.frameCamera([x,y,z], [lx,ly,lz])` | 設定鏡頭位置與注視點 |
| `lab.box(color, [w,h,d])` | 方塊 mesh（有陰影） |
| `lab.label(text, cls)` | 3D 標籤；cls：`'ptr'` 深色指標、`'ptr alt'` 金色指標、`'idx'` 灰色小字、`'val'` 方塊上的數字 |
| `lab.addBody(mesh)` → body | 加入有物理的物體 |
| `lab.dropTo(body, Vector3)` | 受重力掉到目標位置（會彈一下） |
| `lab.springTo(body, Vector3)` | 彈簧移動到目標位置 |
| `lab.flyAway(body, Vector3)` | 噴飛並淡出（刪除、pop 用） |
| `lab.removeBody(body)` / `lab.world.add(obj)` | 移除物體／加入靜態物件 |
| `block(v, size, color)` | 方塊＋數字標籤（最常用） |
| `tile(pos, w, d, color)` | 地上的格子（陣列格、記憶體格） |
| `controls(html)` / `on(id, fn)` / `$(id)` | 操作列按鈕與輸入框 |
| `log(text, warn)` / `clearLog()` | 右側「每一步發生什麼」 |
| `setState(title, [[k, v], …], formulaHtml)` | 右側狀態卡；公式可用 `<span class="ok">` `<span class="no">` |
| `say(caption, formula)` | 舞台字幕（一句話）＋公式列 |
| `await beat(tok, ms)` | 場景內等待；學習空間換場景時會自動中止 |
| `sleep(ms)`、`ctx.params`、`ctx.stage` | 一般等待、學習空間傳來的參數、是否在舞台模式 |

## 設計原則（一定要遵守）

1. **畫面是主角，文字是配角。** 字幕一句話（約 20 字內），公式列一行。長篇解釋不要放進動畫。
2. **每個場景演一個概念**，15–40 秒，結尾停 2–3 秒讓人看清楚結果；會自動重播。
3. **動起來要有意義**：插入就是掉進位置、刪除就是飛走、比較就是兩個東西發亮、走訪就是游標移動。數字和指標都要在 3D 裡標出來。
4. **內容要正確**，以考試用課本為準：資結＝洪逸／Horowitz、演算法＝CLRS、OS＝恐龍書、計組＝Patterson & Hennessy（MIPS）、線代＝Strang／Friedberg、離散＝Rosen／Grimaldi。慣例有分歧時，在字幕或 log 註明採用哪一種。
5. **繁體中文**，術語保留英文（例如「AVL 的 LR 旋轉」）。
6. **每個 mode 都要能自己操作**：有按鈕、輸入框，按錯要在 log 用 `warn` 說明為什麼不行。
7. **小測驗**要隨機出題（數字、結構每次不同），選項含常見錯誤，答完附一兩句解析。
8. 鏡頭要讓整個結構都在畫面內（舞台是 16:9 的小視窗）；元素不要超過 ±7 的範圍。
9. 不要引入外部函式庫或網路資源；只能用 three.js 與 ctx。
10. 寫完執行 `node --check public/lab/chapters/<檔名>.js` 確認語法。

## 上線

在 `public/chapter-core.js` 的 `CHAPTER_LABS` 加入章號（例如 `ds:[1,2,4]`），學習空間就會出現舞台。
