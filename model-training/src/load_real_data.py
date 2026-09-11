"""
從真實 prep.db 讀取複習紀錄,輸出跟 generate_synthetic_data.py 完全相同欄位的 CSV,
讓 train_retention_model.py 不用改任何程式碼就能直接吃真實資料。

真實資料目前(README記錄的當時)只有 quiz_attempts 2筆、review_schedule 0筆,
遠不足以訓練,這支腳本現在執行會印出資料量不足的提醒並提早結束——
這是誠實的行為,不是bug。之後隨著實際使用 cs-exam-prep-ai app 累積更多
quiz_attempts,重跑這支腳本就會產生真正的訓練資料。

真實資料沒有「多個學生」的概念(這是你自己一個人在用的app),所以拿掉了模擬資料
裡的 student_id 分組欄位,改用 subject_id(六科)當分組單位——train/test 依科目切分,
驗證的是「模型能不能類化到沒看過複習模式的科目」,概念上對應模擬資料原本依
student_id分組驗證「類化到新學生」的精神。

「recalled」的定義:quiz_attempts 記錄的是 correct/total(該次測驗答對比例),
不是單純二元對錯,這裡取 correct/total >= 0.6 當作「這次複習算是記住了」的門檻
(可依實際情況調整)。
"""
import sqlite3
import pandas as pd
from datetime import datetime

DB_PATH = "../../data/prep.db"
MIN_ROWS_TO_PROCEED = 30  # 少於這個量,切train/test跟訓練都沒有意義

RECALL_THRESHOLD = 0.6


def load_attempts(conn):
    query = """
        SELECT subject_id, chapter_key, correct, total, created_at
        FROM quiz_attempts
        WHERE subject_id IS NOT NULL AND chapter_key IS NOT NULL AND created_at IS NOT NULL
        ORDER BY subject_id, chapter_key, created_at
    """
    return pd.read_sql_query(query, conn)


def build_features(attempts: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for (subject_id, chapter_key), group in attempts.groupby(["subject_id", "chapter_key"]):
        group = group.sort_values("created_at").reset_index(drop=True)
        prior_results = []  # 該subject_id+chapter_key之前每次是否recalled(1/0)
        last_time = None

        for _, r in group.iterrows():
            try:
                created_at = datetime.fromisoformat(r["created_at"].replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                continue

            total = r["total"] or 0
            correct = r["correct"] or 0
            recalled = 1 if total > 0 and (correct / total) >= RECALL_THRESHOLD else 0

            if last_time is not None:
                days_since_last_review = max((created_at - last_time).total_seconds() / 86400, 0.01)
                prior_review_count = len(prior_results)
                prior_success_rate = (sum(prior_results) / len(prior_results)) if prior_results else 0.0

                rows.append({
                    "student_id": subject_id,  # 真實資料沒有多學生,借用欄位名記錄科目分組
                    "item_id": chapter_key,
                    "review_index": prior_review_count,
                    "days_since_last_review": round(days_since_last_review, 2),
                    "prior_review_count": prior_review_count,
                    "prior_success_rate": round(prior_success_rate, 3),
                    "recalled": recalled,
                })

            prior_results.append(recalled)
            last_time = created_at

    return pd.DataFrame(rows)


def main():
    conn = sqlite3.connect(DB_PATH)
    attempts = load_attempts(conn)
    conn.close()

    print(f"quiz_attempts 原始筆數: {len(attempts)}")

    df = build_features(attempts)
    print(f"轉換後可用於訓練的複習事件筆數: {len(df)}")

    if len(df) < MIN_ROWS_TO_PROCEED:
        print(
            f"\n資料量不足(< {MIN_ROWS_TO_PROCEED} 筆),不產生訓練檔案。"
            f"\n請繼續實際使用 cs-exam-prep-ai 累積更多 quiz_attempts 紀錄後再重跑這支腳本。"
            f"\n目前仍建議用 generate_synthetic_data.py 的模擬資料做開發/驗證。"
        )
        return

    df.to_csv("../data/real_reviews.csv", index=False, encoding="utf-8")
    print(f"recalled 分佈: {df['recalled'].value_counts().to_dict()}")
    print("已存至 ../data/real_reviews.csv")
    print("要用真實資料訓練,把 train_retention_model.py 裡讀取的檔名從")
    print("synthetic_reviews.csv 改成 real_reviews.csv 即可,不用改其他程式碼。")


if __name__ == "__main__":
    main()
