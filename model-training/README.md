# cs-exam-prep-ai / model-training

用機器學習模型取代 `cs-exam-prep-ai` 主程式裡「固定間隔複習規則」,預測「複習當下還記不記得」,是Half-Life Regression(Duolingo提出的間隔複習模型設計)概念的簡化實作。

## 資料現況與誠實說明

原本規劃直接用 `data/prep.db` 裡的真實使用紀錄訓練,但實際檢查後發現:
- `quiz_attempts` 只有 2 筆
- `review_schedule`、`mastery_evidence` 都是 0 筆

這樣的資料量無法訓練出任何有意義的模型。改用**基於 Ebbinghaus 遺忘曲線理論生成的模擬資料**(`src/generate_synthetic_data.py`),先把整條「特徵設計→訓練→評估」的管線做完整、驗證方法本身有效,之後 `prep.db` 累積夠多真實使用資料後,直接把資料來源換成真實查詢,不用改動模型或評估程式碼(特徵欄位設計成跟真實quiz_attempts+review_schedule合併後的schema一致)。

## 方法

- **模擬資料**:40個模擬學生 × 60個章節,依 `p_recall = exp(-elapsed/strength)` 的遺忘曲線生成複習紀錄,每次複習後依對錯更新記憶強度,共10,816筆
- **切分方式**:依 `student_id` 切 train/test(而非隨機切),確保驗證的是「模型能否類化到新學生」,不是背答案
- **特徵**(只用真實系統會記錄到的欄位,排除模擬時才知道的隱變數如真實記憶強度):
  - `days_since_last_review`
  - `prior_review_count`
  - `prior_success_rate`

## 實驗結果

| 方法 | Accuracy | AUC | Brier Score(機率校準,越低越好) |
|---|---|---|---|
| Baseline(現行:複習次數≥3視為記牢) | 0.486 | 0.442 | 0.347 |
| Logistic Regression | 0.666 | 0.625 | 0.215 |
| **Gradient Boosting** | **0.702** | **0.727** | **0.193** |

Gradient Boosting 比現行固定規則的 AUC 從 0.442 提升到 0.727(+64.5%相對提升)。特徵重要性顯示 `prior_success_rate`(過去正確率)跟 `days_since_last_review`(距離上次複習天數)是主要預測因子,跟遺忘曲線理論一致。

## 如何重現

```bash
cd src
python generate_synthetic_data.py   # 產生模擬資料
python train_retention_model.py     # 訓練並評估
python load_real_data.py            # 檢查真實資料量、若足夠則輸出可訓練的CSV
```

## 接回真實系統的規劃

1. **`src/load_real_data.py` 已經寫好**:從真實 `prep.db` 的 `quiz_attempts` 轉換成跟 `generate_synthetic_data.py` 完全相同的欄位格式,`train_retention_model.py` 不用改任何程式碼就能直接吃真實資料。真實資料沒有多學生概念,改用 `subject_id`(六科)當分組單位切train/test。目前執行會印出「資料量不足,不產生訓練檔案」——這是誠實的行為,不是bug,quiz_attempts 目前只有2筆,遠不到能訓練的量。之後隨著實際使用 app 累積更多測驗紀錄,直接重跑這支腳本即可。
2. 訓練好的模型可以整合進 `server.js` 的複習排程邏輯,取代現在寫死的 SM-2 固定公式
3. 需要額外設計「冷啟動」機制(新使用者/新章節初期資料不足時,退回目前的固定規則)
