"""
訓練「複習時是否還記得」的預測模型,只用實際上線後會記錄到的欄位當特徵
(不用模擬時的「真實記憶強度」等只有生成資料時才知道的隱變數,避免資料洩漏)。

Baseline: 目前 app 實際使用的邏輯——固定間隔的 SM-2 規則(不管個人資料,只看複習次數決定間隔是否「該忘了」)
訓練模型: Logistic Regression,只用真實可觀測到的特徵
評估: 依 student_id 切 train/test,確保測試的是模型有沒有辦法「類化到新學生」,不是背答案
"""
import pandas as pd
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import roc_auc_score, accuracy_score, log_loss, brier_score_loss

df = pd.read_csv("../data/synthetic_reviews.csv")

# 只保留「實際系統中觀測得到」的特徵欄位
FEATURES = ["days_since_last_review", "prior_review_count", "prior_success_rate"]
TARGET = "recalled"

students = df["student_id"].unique()
rng = np.random.RandomState(42)
rng.shuffle(students)
n_test_students = max(1, int(len(students) * 0.25))
test_students = set(students[:n_test_students])

train_df = df[~df["student_id"].isin(test_students)]
test_df = df[df["student_id"].isin(test_students)]
print(f"訓練學生數: {len(students) - n_test_students}  測試學生數: {n_test_students}")
print(f"訓練筆數: {len(train_df)}  測試筆數: {len(test_df)}")

X_train, y_train = train_df[FEATURES], train_df[TARGET]
X_test, y_test = test_df[FEATURES], test_df[TARGET]

# --- Baseline: 現行 SM-2 邏輯的等價預測 ---
def sm2_baseline_predict(df_):
    return (df_["prior_review_count"] >= 3).astype(int)

def sm2_baseline_proba(df_):
    return np.clip(0.15 + 0.15 * df_["prior_review_count"], 0.05, 0.95)

baseline_pred = sm2_baseline_predict(test_df)
baseline_proba = sm2_baseline_proba(test_df)
baseline_acc = accuracy_score(y_test, baseline_pred)
baseline_auc = roc_auc_score(y_test, baseline_proba)
baseline_brier = brier_score_loss(y_test, baseline_proba)

print("\n=== Baseline(現行固定規則,依複習次數判斷)===")
print(f"Accuracy: {baseline_acc:.3f}")
print(f"AUC: {baseline_auc:.3f}")
print(f"Brier score(機率校準誤差,越低越好): {baseline_brier:.3f}")

# --- 訓練模型 1: Logistic Regression ---
lr = LogisticRegression(max_iter=1000)
lr.fit(X_train, y_train)
lr_proba = lr.predict_proba(X_test)[:, 1]
lr_pred = (lr_proba >= 0.5).astype(int)

print("\n=== 模型: Logistic Regression ===")
print(f"Accuracy: {accuracy_score(y_test, lr_pred):.3f}")
print(f"AUC: {roc_auc_score(y_test, lr_proba):.3f}")
print(f"Brier score: {brier_score_loss(y_test, lr_proba):.3f}")
print("係數:", dict(zip(FEATURES, lr.coef_[0].round(3))))

# --- 訓練模型 2: Gradient Boosting ---
gb = GradientBoostingClassifier(n_estimators=150, max_depth=3, learning_rate=0.05, random_state=42)
gb.fit(X_train, y_train)
gb_proba = gb.predict_proba(X_test)[:, 1]
gb_pred = (gb_proba >= 0.5).astype(int)

print("\n=== 模型: Gradient Boosting ===")
print(f"Accuracy: {accuracy_score(y_test, gb_pred):.3f}")
print(f"AUC: {roc_auc_score(y_test, gb_proba):.3f}")
print(f"Brier score: {brier_score_loss(y_test, gb_proba):.3f}")
print("Feature importance:", dict(zip(FEATURES, gb.feature_importances_.round(3))))

print("\n=== 結果總表 ===")
print(f"{'方法':<30}{'Accuracy':>10}{'AUC':>10}{'Brier':>10}")
print(f"{'Baseline(固定規則)':<30}{baseline_acc:>10.3f}{baseline_auc:>10.3f}{baseline_brier:>10.3f}")
print(f"{'Logistic Regression':<30}{accuracy_score(y_test, lr_pred):>10.3f}{roc_auc_score(y_test, lr_proba):>10.3f}{brier_score_loss(y_test, lr_proba):>10.3f}")
print(f"{'Gradient Boosting':<30}{accuracy_score(y_test, gb_pred):>10.3f}{roc_auc_score(y_test, gb_proba):>10.3f}{brier_score_loss(y_test, gb_proba):>10.3f}")

import joblib
joblib.dump(gb, "../data/retention_model_gb.joblib")
joblib.dump(lr, "../data/retention_model_lr.joblib")
print("\n已儲存模型")
