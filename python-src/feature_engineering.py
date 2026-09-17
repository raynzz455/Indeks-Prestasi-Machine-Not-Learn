"""
Feature engineering — transform raw records into ML-ready features.

This module builds:
- Course-level features: statistics per (course_name × major)
- Student-level features: per-student context (IPK, IPS, trend)

Status: IMPLEMENTED in TypeScript (src/lib/gpa/feature-engineering.ts)
        and Python (mini-services/ml-service/src/train_models.py)
        This is a stub for the original pipeline structure.
"""

import pandas as pd
import numpy as np


def build_course_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Aggregate per-course statistics for Model 1 (K-Means clustering).

    Features: mean_gp, std_gp, pct_a_or_above, pct_below_b, pct_fail,
              median_gp, iqr_gp, mean_ips_takers, sample_count
    """
    grouped = df.groupby(["course_name", "major"])

    features = grouped["grade_point"].agg(["mean", "std", "median"]).reset_index()
    features.columns = ["course_name", "major", "mean_gp", "std_gp", "median_gp"]

    features["pct_a_or_above"] = grouped.apply(
        lambda g: (g["grade_point"] >= 3.7).mean()
    ).reset_index(drop=True)

    features["pct_below_b"] = grouped.apply(
        lambda g: (g["grade_point"] < 3.0).mean()
    ).reset_index(drop=True)

    features["pct_fail"] = grouped.apply(
        lambda g: (g["grade_point"] < 1.0).mean()
    ).reset_index(drop=True)

    features["iqr_gp"] = grouped["grade_point"].apply(
        lambda x: x.quantile(0.75) - x.quantile(0.25)
    ).reset_index(drop=True)

    features["mean_ips_takers"] = grouped["grade_point"].mean().reset_index(drop=True)
    features["sample_count"] = grouped.size().reset_index(drop=True)
    features = features.fillna(0)

    return features


def build_student_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Build per-student×course feature rows for Model 2 (grade prediction).

    Features: difficulty_score, ipk_before, ips_last_semester, ips_trend,
              total_sks_completed, course_sks, semester_number, etc.
    """
    rows = []

    # Build course features for difficulty lookup
    course_feats = build_course_features(df)
    course_lookup = {}
    for _, row in course_feats.iterrows():
        key = (row["course_name"], row["major"])
        course_lookup[key] = row

    # Group by student
    for student_id, student_df in df.groupby("student_id"):
        student_df = student_df.sort_values("semester_number")
        semesters = sorted(student_df["semester_number"].unique())

        ips_by_sem = {}
        cum_sks = 0
        cum_weighted = 0
        ipk_before_by_sem = {}

        for sem in semesters:
            sem_df = student_df[student_df["semester_number"] == sem]
            sks = sem_df["sks"].sum()
            weighted = (sem_df["sks"] * sem_df["grade_point"]).sum()
            ips = weighted / sks if sks > 0 else 0
            ips_by_sem[sem] = ips
            ipk_before_by_sem[sem] = cum_weighted / cum_sks if cum_sks > 0 else ips
            cum_sks += sks
            cum_weighted += weighted

        ips_list = list(ips_by_sem.values())

        for _, r in student_df.iterrows():
            key = (r["course_name"], r["major"])
            cf = course_lookup.get(key)
            if cf is None:
                continue

            sem = r["semester_number"]
            ips_last = ips_by_sem.get(sem, ips_list[-1] if ips_list else 3.3)
            ips_prev = ips_list[ips_list.index(ips_last) - 1] if len(ips_list) > 1 and sem in ips_list else ips_last
            ips_trend = ips_last - ips_prev
            ipk_before = ipk_before_by_sem.get(sem, ips_last)
            total_sks_before = sum(
                student_df[student_df["semester_number"] < sem]["sks"].sum()
                for _ in [0]
            )

            difficulty_score = max(0, min(1,
                (1 - cf["mean_gp"] / 4) * 0.55 + cf["pct_fail"] * 0.25 + cf["pct_below_b"] * 0.2
            ))

            rows.append({
                "difficulty_score": difficulty_score,
                "ipk_before": round(ipk_before, 3),
                "ips_last_semester": round(ips_last, 3),
                "ips_trend": round(ips_trend, 3),
                "total_sks_completed": total_sks_before,
                "course_sks": r["sks"],
                "semester_number": sem,
                "mean_ips_takers": cf["mean_ips_takers"],
                "pct_a_or_above": cf["pct_a_or_above"],
                "pct_below_b": cf["pct_below_b"],
                "grade_class": r["grade"],
            })

    return pd.DataFrame(rows)
