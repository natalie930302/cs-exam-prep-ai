"""
生成模擬的間隔複習資料,用來訓練/驗證記憶保留預測模型。

背景:prep.db 裡目前真實使用資料太少(quiz_attempts僅2筆、review_schedule 0筆),
不足以訓練有意義的模型。這裡改用「已知的遺忘曲線理論」(Ebbinghaus forgetting curve +
Duolingo Half-Life Regression 的特徵設計)產生模擬資料,先把整條訓練/評估管線建好、
驗證方法本身有效。之後 prep.db 累積夠多真實資料後,可以直接把 load_real_data.py
換掉這支腳本,不用改模型/評估程式碼——輸出的 CSV 欄位跟真實 quiz_attempts +
review_schedule 合併後的schema設計成一致。

理論依據:記憶保留機率 p = exp(-t / S),t是距離上次複習的天數,S是「記憶強度」,
每次成功複習會讓S變大(間隔更久才會忘記),每次失敗會讓S變小。
"""
import numpy as np
import pandas as pd
import random

random.seed(42)
np.random.seed(42)

N_STUDENTS = 40
N_ITEMS = 60  # 模擬60個章節/知識點
MAX_REVIEWS_PER_ITEM = 8

rows = []

for student in range(N_STUDENTS):
    # 每個模擬學生有自己的基礎學習能力(memory decay 的個體差異)
    student_ability = np.random.normal(1.0, 0.25)
    student_ability = max(0.4, student_ability)

    for item in range(N_ITEMS):
        item_difficulty = np.random.uniform(0.5, 2.0)  # 難度越高,S成長越慢
        strength = np.random.uniform(0.5, 1.5)  # 初始記憶強度
        last_review_day = 0
        n_reviews = np.random.randint(1, MAX_REVIEWS_PER_ITEM + 1)

        for review_idx in range(n_reviews):
            # 距離上次複習的天數(間隔會隨著複習次數增加而拉長,模擬SM-2排程)
            gap = np.random.exponential(scale=strength * 0.7) + 0.3
            elapsed = gap
            true_p_recall = np.exp(-elapsed / max(strength, 0.1))
            noise = np.random.normal(0, 0.08)
            p_recall = np.clip(true_p_recall + noise, 0.02, 0.98)
            correct = 1 if np.random.random() < p_recall else 0

            rows.append({
                "student_id": student,
                "item_id": item,
                "review_index": review_idx,
                "days_since_last_review": round(elapsed, 2),
                "prior_review_count": review_idx,
                "prior_success_rate": round(min(1.0, strength / 2.0), 3),
                "item_difficulty": round(item_difficulty, 3),
                "student_ability": round(student_ability, 3),
                "memory_strength_true": round(strength, 3),
                "recalled": correct,
            })

            # 更新記憶強度(答對變強、答錯變弱),模擬SM-2的核心邏輯
            if correct:
                strength = strength * (1.3 + 0.3 * student_ability) / item_difficulty
            else:
                strength = max(0.3, strength * 0.5)

df = pd.DataFrame(rows)
print(f"總筆數: {len(df)}")
print(f"recalled 分佈: {df['recalled'].value_counts().to_dict()}")
df.to_csv("../data/synthetic_reviews.csv", index=False, encoding="utf-8")
print("已存至 ../data/synthetic_reviews.csv")
