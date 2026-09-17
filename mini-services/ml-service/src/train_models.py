"""
Model training for the IPK Optimizer ML service.

Trains 3 models on the same dataset:
  1. K-Means Clustering (unsupervised) — course difficulty clustering
  2. Logistic Regression (supervised) — grade prediction
  3. Random Forest (supervised) — grade prediction (bonus, more powerful)

All models are trained on the same ~5k row dataset, evaluated with 80/20
train/test split, and serialized with joblib.
"""

import os
import json
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.cluster import KMeans
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    classification_report,
    silhouette_score,
)
import joblib

# ── Config ─────────────────────────────────────────────────────────────

GRADE_POINTS = {
    "A": 4.0, "A-": 3.7, "B+": 3.3, "B": 3.0, "B-": 2.7,
    "C+": 2.3, "C": 2.0, "C-": 1.7, "D": 1.0, "E": 0.0,
}
GRADE_ORDER = ["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D", "E"]

DATA_DIR = Path(__file__).parent.parent / "data"
MODELS_DIR = Path(__file__).parent.parent / "models"


def load_dataset():
    """Load the dataset CSV."""
    path = DATA_DIR / "dataset.csv"
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found at {path}. Run generate_dataset.py first.")
    df = pd.read_csv(path)
    print(f"📊 Loaded dataset: {len(df)} rows, {df['student_id'].nunique()} students")
    return df


def build_course_features(df: pd.DataFrame) -> pd.DataFrame:
    """Build per-course statistical features (same as TS feature_engineering)."""
    grouped = df.groupby(["mata_kuliah", "jurusan"])
    features = grouped["bobot_nilai"].agg(["mean", "std", "median"]).reset_index()
    features.columns = ["mata_kuliah", "jurusan", "mean_gp", "std_gp", "median_gp"]

    # Additional stats
    features["pct_a_or_above"] = grouped.apply(lambda g: (g["bobot_nilai"] >= 3.7).mean()).reset_index(drop=True)
    features["pct_below_b"] = grouped.apply(lambda g: (g["bobot_nilai"] < 3.0).mean()).reset_index(drop=True)
    features["pct_fail"] = grouped.apply(lambda g: (g["bobot_nilai"] < 1.0).mean()).reset_index(drop=True)
    features["iqr_gp"] = grouped["bobot_nilai"].apply(lambda x: x.quantile(0.75) - x.quantile(0.25)).reset_index(drop=True)
    features["mean_ips_takers"] = grouped["bobot_nilai"].mean().reset_index(drop=True)
    features["sample_count"] = grouped.size().reset_index(drop=True)

    # Fill NaN
    features = features.fillna(0)
    return features


def build_student_features(df: pd.DataFrame) -> pd.DataFrame:
    """Build per-student×course feature rows for supervised training."""
    rows = []

    # Group by student
    for student_id, student_df in df.groupby("student_id"):
        student_df = student_df.sort_values("semester_ke")
        semesters = sorted(student_df["semester_ke"].unique())

        # Per-semester IPS
        ips_by_sem = {}
        cum_sks = 0
        cum_weighted = 0
        ipk_before_by_sem = {}
        for sem in semesters:
            sem_df = student_df[student_df["semester_ke"] == sem]
            sks = sem_df["sks"].sum()
            weighted = (sem_df["sks"] * sem_df["bobot_nilai"]).sum()
            ips = sks / sks if sks > 0 else 0
            ips = weighted / sks if sks > 0 else 0
            ips_by_sem[sem] = ips
            ipk_before_by_sem[sem] = cum_weighted / cum_sks if cum_sks > 0 else ips
            cum_sks += sks
            cum_weighted += weighted

        ips_list = [ips_by_sem[s] for s in semesters]

        # Course features lookup
        course_feats = build_course_features(df)
        course_lookup = {}
        for _, row in course_feats.iterrows():
            key = (row["mata_kuliah"], row["jurusan"])
            course_lookup[key] = row

        for _, r in student_df.iterrows():
            key = (r["mata_kuliah"], r["jurusan"])
            cf = course_lookup.get(key)
            if cf is None:
                continue

            sem = r["semester_ke"]
            ips_last = ips_by_sem.get(sem, ips_list[-1] if ips_list else 3.3)
            ips_prev = ips_list[ips_list.index(ips_last) - 1] if len(ips_list) > 1 and sem in ips_list else ips_last
            ips_trend = ips_last - ips_prev
            ipk_before = ipk_before_by_sem.get(sem, ips_last)
            total_sks_before = sum(
                student_df[student_df["semester_ke"] < sem]["sks"].sum()
                for _ in [0]
            )

            # Difficulty score (heuristic)
            difficulty_score = max(0, min(1, (1 - cf["mean_gp"] / 4) * 0.55 + cf["pct_fail"] * 0.25 + cf["pct_below_b"] * 0.2))
            difficulty_cluster = int(difficulty_score * 5) if difficulty_score < 1 else 4

            # Encode major
            major_encoded = hash(r["jurusan"]) % 100

            # Encode grade
            grade_class = GRADE_ORDER.index(r["nilai"]) if r["nilai"] in GRADE_ORDER else 9

            rows.append({
                "difficulty_score": difficulty_score,
                "difficulty_cluster": difficulty_cluster,
                "ipk_before": round(ipk_before, 3),
                "ips_last_semester": round(ips_last, 3),
                "ips_trend": round(ips_trend, 3),
                "total_sks_completed": total_sks_before,
                "course_sks": r["sks"],
                "semester_number": sem,
                "scenario_encoded": 1,  # neutral
                "major_encoded": major_encoded,
                "mean_ips_takers": cf["mean_ips_takers"],
                "pct_a_or_above": cf["pct_a_or_above"],
                "pct_below_b": cf["pct_below_b"],
                "grade_class": grade_class,
                "student_id": student_id,
                "course_name": r["mata_kuliah"],
                "jurusan": r["jurusan"],
            })

    return pd.DataFrame(rows)


# ── Model 1: K-Means ───────────────────────────────────────────────────

def train_model1_kmeans(course_features: pd.DataFrame):
    """Train K-Means clustering on course features."""
    feature_cols = ["mean_gp", "std_gp", "pct_a_or_above", "pct_below_b", "pct_fail", "median_gp", "iqr_gp", "mean_ips_takers"]
    X = course_features[feature_cols].values

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    kmeans = KMeans(n_clusters=5, random_state=42, n_init=10, max_iter=300)
    clusters = kmeans.fit_predict(X_scaled)

    # Sort clusters by mean grade point (easiest → hardest)
    cluster_mean_gp = []
    for c in range(5):
        mask = clusters == c
        if mask.sum() > 0:
            cluster_mean_gp.append((c, course_features.loc[mask, "mean_gp"].mean()))
        else:
            cluster_mean_gp.append((c, 0))
    cluster_order = sorted(cluster_mean_gp, key=lambda x: -x[1])  # descending = easiest first
    order_map = {orig: rank for rank, (orig, _) in enumerate(cluster_order)}

    labels = ["sangat_mudah", "mudah", "medium", "sulit", "sangat_sulit"]
    course_features = course_features.copy()
    course_features["difficulty_cluster"] = clusters
    course_features["difficulty_rank"] = [order_map[c] for c in clusters]
    course_features["difficulty_label"] = [labels[order_map[c]] for c in clusters]
    course_features["difficulty_score"] = [round(order_map[c] / 4, 2) for c in clusters]

    # Evaluate
    sil_score = silhouette_score(X_scaled, clusters) if len(X_scaled) > 5 else 0
    inertia = kmeans.inertia_

    model = {
        "type": "kmeans",
        "model": kmeans,
        "scaler": scaler,
        "feature_cols": feature_cols,
        "cluster_order": order_map,
        "labels": labels,
        "metrics": {
            "silhouette": round(sil_score, 4),
            "inertia": round(inertia, 2),
            "cluster_sizes": [int((clusters == c).sum()) for c in range(5)],
        },
    }
    return model, course_features


# ── Model 2: Logistic Regression ────────────────────────────────────────

def train_model2_logreg(train_df: pd.DataFrame, test_df: pd.DataFrame):
    """Train Logistic Regression (softmax) for grade prediction."""
    feature_cols = [
        "difficulty_score", "difficulty_cluster", "ipk_before", "ips_last_semester",
        "ips_trend", "total_sks_completed", "course_sks", "semester_number",
        "scenario_encoded", "major_encoded", "mean_ips_takers", "pct_a_or_above", "pct_below_b",
    ]

    X_train = train_df[feature_cols].values
    y_train = train_df["grade_class"].values
    X_test = test_df[feature_cols].values
    y_test = test_df["grade_class"].values

    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s = scaler.transform(X_test)

    logreg = LogisticRegression(
        max_iter=1000,
        solver="lbfgs",
        C=1.0,
        random_state=42,
    )
    logreg.fit(X_train_s, y_train)

    # Evaluate
    y_pred = logreg.predict(X_test_s)
    y_proba = logreg.predict_proba(X_test_s)

    exact_acc = accuracy_score(y_test, y_pred)
    # Within-1-step accuracy
    within1 = np.mean(np.abs(y_test - y_pred) <= 1)
    within2 = np.mean(np.abs(y_test - y_pred) <= 2)
    # Top-3 accuracy
    top3_acc = np.mean([y_test[i] in np.argsort(-y_proba[i])[:3] for i in range(len(y_test))])

    cm = confusion_matrix(y_test, y_pred, labels=list(range(10)))

    model = {
        "type": "logreg",
        "model": logreg,
        "scaler": scaler,
        "feature_cols": feature_cols,
        "metrics": {
            "exact_accuracy": round(float(exact_acc), 4),
            "within1_step_accuracy": round(float(within1), 4),
            "within2_step_accuracy": round(float(within2), 4),
            "top3_accuracy": round(float(top3_acc), 4),
            "confusion_matrix": cm.tolist(),
            "grade_order": GRADE_ORDER,
            "train_size": len(X_train),
            "test_size": len(X_test),
        },
    }
    return model


# ── Model 3: Random Forest ─────────────────────────────────────────────

def train_model3_randomforest(train_df: pd.DataFrame, test_df: pd.DataFrame):
    """Train Random Forest for grade prediction (bonus, more powerful)."""
    feature_cols = [
        "difficulty_score", "difficulty_cluster", "ipk_before", "ips_last_semester",
        "ips_trend", "total_sks_completed", "course_sks", "semester_number",
        "scenario_encoded", "major_encoded", "mean_ips_takers", "pct_a_or_above", "pct_below_b",
    ]

    X_train = train_df[feature_cols].values
    y_train = train_df["grade_class"].values
    X_test = test_df[feature_cols].values
    y_test = test_df["grade_class"].values

    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s = scaler.transform(X_test)

    rf = RandomForestClassifier(
        n_estimators=100,
        max_depth=15,
        random_state=42,
        n_jobs=-1,
    )
    rf.fit(X_train_s, y_train)

    # Evaluate
    y_pred = rf.predict(X_test_s)
    y_proba = rf.predict_proba(X_test_s)

    exact_acc = accuracy_score(y_test, y_pred)
    within1 = np.mean(np.abs(y_test - y_pred) <= 1)
    within2 = np.mean(np.abs(y_test - y_pred) <= 2)
    top3_acc = np.mean([y_test[i] in np.argsort(-y_proba[i])[:3] for i in range(len(y_test))])

    cm = confusion_matrix(y_test, y_pred, labels=list(range(10)))

    # Feature importance
    importances = rf.feature_importances_

    model = {
        "type": "random_forest",
        "model": rf,
        "scaler": scaler,
        "feature_cols": feature_cols,
        "metrics": {
            "exact_accuracy": round(float(exact_acc), 4),
            "within1_step_accuracy": round(float(within1), 4),
            "within2_step_accuracy": round(float(within2), 4),
            "top3_accuracy": round(float(top3_acc), 4),
            "confusion_matrix": cm.tolist(),
            "grade_order": GRADE_ORDER,
            "train_size": len(X_train),
            "test_size": len(X_test),
            "feature_importances": [
                {"feature": feature_cols[i], "importance": round(float(importances[i]), 4)}
                for i in range(len(feature_cols))
            ],
        },
    }
    return model


# ── Train all models ───────────────────────────────────────────────────

def train_all_models():
    """Train all 3 models on the same dataset and save to disk."""
    print("\n" + "=" * 60)
    print("🚀 Training all models on the same dataset")
    print("=" * 60)

    # Load dataset
    df = load_dataset()

    # Build course features
    print("\n📊 Building course features...")
    course_features = build_course_features(df)
    print(f"   Course features: {len(course_features)} courses")

    # Build student features
    print("📊 Building student features...")
    student_features = build_student_features(df)
    print(f"   Student×course rows: {len(student_features)}")

    # Train/test split (by student)
    student_ids = student_features["student_id"].unique()
    train_students, test_students = train_test_split(student_ids, test_size=0.2, random_state=42)

    train_df = student_features[student_features["student_id"].isin(train_students)].copy()
    test_df = student_features[student_features["student_id"].isin(test_students)].copy()
    print(f"   Train: {len(train_df)} rows ({len(train_students)} students)")
    print(f"   Test:  {len(test_df)} rows ({len(test_students)} students)")

    # ── Model 1: K-Means ──
    print("\n🔵 Training Model 1: K-Means Clustering...")
    model1, course_features_labeled = train_model1_kmeans(course_features)
    print(f"   ✅ Silhouette: {model1['metrics']['silhouette']}")
    print(f"   ✅ Inertia: {model1['metrics']['inertia']}")
    print(f"   ✅ Cluster sizes: {model1['metrics']['cluster_sizes']}")

    # ── Model 2: Logistic Regression ──
    print("\n🟣 Training Model 2: Logistic Regression...")
    model2 = train_model2_logreg(train_df, test_df)
    print(f"   ✅ Exact accuracy: {model2['metrics']['exact_accuracy']:.1%}")
    print(f"   ✅ Within-1-step: {model2['metrics']['within1_step_accuracy']:.1%}")
    print(f"   ✅ Top-3 accuracy: {model2['metrics']['top3_accuracy']:.1%}")

    # ── Model 3: Random Forest ──
    print("\n🟢 Training Model 3: Random Forest...")
    model3 = train_model3_randomforest(train_df, test_df)
    print(f"   ✅ Exact accuracy: {model3['metrics']['exact_accuracy']:.1%}")
    print(f"   ✅ Within-1-step: {model3['metrics']['within1_step_accuracy']:.1%}")
    print(f"   ✅ Top-3 accuracy: {model3['metrics']['top3_accuracy']:.1%}")

    # Save models
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    # Save Model 1
    joblib.dump(model1, MODELS_DIR / "model1_kmeans.joblib")
    # Save course features (with difficulty labels) for lookup
    course_features_labeled.to_csv(MODELS_DIR / "course_features_labeled.csv", index=False)

    # Save Model 2
    joblib.dump(model2, MODELS_DIR / "model2_logreg.joblib")

    # Save Model 3
    joblib.dump(model3, MODELS_DIR / "model3_randomforest.joblib")

    # Save summary
    summary = {
        "dataset": {
            "total_rows": len(df),
            "students": int(df["student_id"].nunique()),
            "majors": int(df["jurusan"].nunique()),
            "courses": int(df["mata_kuliah"].nunique()),
            "mean_gp": round(float(df["bobot_nilai"].mean()), 4),
            "split_ratio": "80/20 (by student)",
        },
        "model1_kmeans": {
            "name": "K-Means Clustering",
            "metrics": model1["metrics"],
            "description": "Unsupervised clustering pada statistik per mata kuliah",
        },
        "model2_logreg": {
            "name": "Logistic Regression (Softmax)",
            "metrics": {k: v for k, v in model2["metrics"].items() if k != "confusion_matrix"},
            "description": "Multi-class softmax regression, 13 fitur, 10 kelas",
        },
        "model3_random_forest": {
            "name": "Random Forest",
            "metrics": {k: v for k, v in model3["metrics"].items() if k != "confusion_matrix" and k != "feature_importances"},
            "description": "Random Forest, 100 trees, 13 fitur, 10 kelas",
        },
    }

    with open(MODELS_DIR / "training_summary.json", "w") as f:
        json.dump(summary, f, indent=2)

    print("\n" + "=" * 60)
    print("✅ All models trained and saved!")
    print(f"   Models dir: {MODELS_DIR}")
    print("=" * 60)

    return summary


if __name__ == "__main__":
    summary = train_all_models()
    print(json.dumps(summary, indent=2))
