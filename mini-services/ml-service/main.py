"""
FastAPI server for the IPK Optimizer ML service.

Endpoints:
  GET  /health          → health check
  POST /train            → train all models (returns summary)
  GET  /evaluate         → get model evaluation metrics
  POST /predict          → predict grade distribution for planned courses
  POST /optimize         → full optimization (predict + generate combinations)

Runs on port 3030. Accessed from Next.js via XTransformPort=3030.
"""

import json
import os
import math
from pathlib import Path
from itertools import product as cartesian_product
from typing import Any

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Import training module
import sys
sys.path.insert(0, str(Path(__file__).parent / "src"))
from train_models import (
    train_all_models,
    load_dataset,
    build_course_features,
    build_student_features,
    GRADE_ORDER,
    GRADE_POINTS,
    DATA_DIR,
    MODELS_DIR,
)

app = FastAPI(title="IPK ML Service", version="0.1.0")

# CORS — allow the Next.js app to call this service
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

PORT = 3030

# ── Models cache ────────────────────────────────────────────────────────

_models_cache: dict[str, Any] = {}


def load_models():
    """Load trained models from disk (lazy, cached)."""
    if _models_cache:
        return _models_cache

    model1_path = MODELS_DIR / "model1_kmeans.joblib"
    model2_path = MODELS_DIR / "model2_logreg.joblib"
    model3_path = MODELS_DIR / "model3_randomforest.joblib"
    course_feats_path = MODELS_DIR / "course_features_labeled.csv"

    if not model1_path.exists():
        # Train if not yet trained
        print("Models not found — training now...")
        train_all_models()

    _models_cache["model1"] = joblib.load(model1_path)
    _models_cache["model2"] = joblib.load(model2_path)
    _models_cache["model3"] = joblib.load(model3_path)
    _models_cache["course_features"] = pd.read_csv(course_feats_path)

    print("✅ Models loaded into memory")
    return _models_cache


# ── Pydantic models ────────────────────────────────────────────────────

class TranscriptEntry(BaseModel):
    courseName: str
    sks: int
    grade: str
    semester: int
    major: str = "Umum"

class PlannedCourse(BaseModel):
    courseName: str
    sks: int
    userDifficultyOverride: float | None = None

class OptimizeRequest(BaseModel):
    transcript: list[TranscriptEntry] = []
    plannedCourses: list[PlannedCourse] = []
    targetIpk: float | None = None

class PredictRequest(BaseModel):
    courses: list[PlannedCourse] = []
    currentIpk: float = 3.3
    totalSks: int = 0
    ipsLast: float = 3.3
    ipsTrend: float = 0
    semesterNumber: int = 4
    scenario: str = "serius"
    model: str = "logreg"  # "logreg" or "random_forest"


# ── Helper functions ───────────────────────────────────────────────────

SCENARIO_EFFORT = {
    "santai": 0.55,
    "serius": 0.75,
    "keras": 0.90,
    "maksimal": 1.00,
}


def get_difficulty_for_course(course_name: str, models: dict) -> dict:
    """Look up difficulty from Model 1 (K-Means) for a course."""
    cf = models["course_features"]
    # Try exact match
    match = cf[cf["mata_kuliah"] == course_name]
    if match.empty:
        # Try fuzzy match (case-insensitive contains)
        match = cf[cf["mata_kuliah"].str.lower().str.contains(course_name.lower(), na=False)]
    if match.empty:
        return {"difficulty_score": 0.5, "difficulty_label": "medium", "difficulty_cluster": 2}
    row = match.iloc[0]
    return {
        "difficulty_score": float(row["difficulty_score"]),
        "difficulty_label": str(row["difficulty_label"]),
        "difficulty_cluster": int(row["difficulty_cluster"]),
        "mean_gp": float(row["mean_gp"]),
        "pct_a_or_above": float(row["pct_a_or_above"]),
        "pct_below_b": float(row["pct_below_b"]),
        "mean_ips_takers": float(row["mean_ips_takers"]),
    }


def predict_grade_distribution(
    course: PlannedCourse,
    difficulty: dict,
    context: dict,
    models: dict,
    model_key: str = "model2",
) -> dict:
    """Use Model 2 or Model 3 to predict grade distribution for a course."""
    model_data = models[model_key]
    feature_cols = model_data["feature_cols"]
    scaler = model_data["scaler"]
    model = model_data["model"]

    # Build feature vector
    diff_score = course.userDifficultyOverride if course.userDifficultyOverride is not None else difficulty["difficulty_score"]
    features = [[
        diff_score,
        difficulty["difficulty_cluster"],
        context["currentIpk"],
        context["ipsLast"],
        context["ipsTrend"],
        context["totalSks"],
        course.sks,
        context["semesterNumber"],
        1,  # scenario_encoded (neutral)
        0,  # major_encoded
        difficulty.get("mean_ips_takers", 3.3),
        difficulty.get("pct_a_or_above", 0.3),
        difficulty.get("pct_below_b", 0.3),
    ]]

    X_scaled = scaler.transform(np.array(features))
    proba = model.predict_proba(X_scaled)[0]

    # Map probabilities to grade classes
    classes = model.classes_
    dist = {}
    for i, cls in enumerate(classes):
        grade = GRADE_ORDER[int(cls)]
        dist[grade] = round(float(proba[i]), 4)

    # Ensure all grades are present
    for g in GRADE_ORDER:
        if g not in dist:
            dist[g] = 0.0

    return dist


def modulate_distribution(dist: dict, effort: float) -> dict:
    """Modulate grade distribution by scenario effort."""
    n = len(GRADE_ORDER)
    target_rank = max(0, min(1, 1 - effort))
    out = {}
    for i, g in enumerate(GRADE_ORDER):
        rank = i / (n - 1)
        dist_to_target = abs(rank - target_rank)
        weight = math.exp(-(dist_to_target ** 2) * 8)
        original = dist.get(g, 0)
        out[g] = original * 0.35 + weight * 0.65
    # Normalize
    total = sum(out.values())
    if total > 0:
        for k in out:
            out[k] = out[k] / total
    return out


def generate_combinations(courses_data: list[dict], scenario: str, current_ipk: float, total_sks: float, target_ipk: float | None) -> list[dict]:
    """Generate grade combinations for the planned courses."""
    effort = SCENARIO_EFFORT.get(scenario, 0.75)
    no_history = total_sks == 0

    # Per-course: pick top-3 grades by modulated probability
    per_course = []
    for c in courses_data:
        mod_dist = modulate_distribution(c["distribution"], effort)
        entries = [(g, mod_dist.get(g, 0)) for g in GRADE_ORDER]
        entries.sort(key=lambda x: -x[1])
        top = entries[:3]
        per_course.append({
            "courseId": c["courseId"],
            "courseName": c["courseName"],
            "normalizedName": c["normalizedName"],
            "sks": c["sks"],
            "difficultyScore": c["difficultyScore"],
            "candidates": [{"grade": g, "p": p} for g, p in top],
        })

    # Cartesian product (limit to 400)
    MAX_COMBOS = 400
    combos = []
    aborted = [False]

    def recurse(idx, current):
        if aborted[0]:
            return
        if idx == len(per_course):
            total_sks_sem = sum(g["sks"] for g in current)
            weighted_gp = sum(g["sks"] * g["gradePoint"] for g in current)
            ips = weighted_gp / total_sks_sem if total_sks_sem > 0 else 0
            if total_sks > 0:
                new_ipk = (current_ipk * total_sks + ips * total_sks_sem) / (total_sks + total_sks_sem)
            else:
                new_ipk = ips
            ipk_delta = new_ipk - current_ipk
            diff = sum(g["sks"] * g["difficultyScore"] for g in current) / total_sks_sem if total_sks_sem > 0 else 0
            prob = 1.0
            for g in current:
                prob *= max(g["p"], 1e-6)
            combos.append({
                "grades": [{
                    "courseId": g["courseId"],
                    "courseName": g["courseName"],
                    "normalizedName": g["normalizedName"],
                    "sks": g["sks"],
                    "grade": g["grade"],
                    "gradePoint": g["gradePoint"],
                } for g in current],
                "ips": round(ips, 3),
                "newIpk": round(new_ipk, 3),
                "ipkDelta": round(ipk_delta, 3),
                "cumulativeDifficulty": round(diff, 2),
                "expectedProbability": round(prob, 4),
            })
            return
        course = per_course[idx]
        for cand in course["candidates"]:
            current.append({
                "courseId": course["courseId"],
                "courseName": course["courseName"],
                "normalizedName": course["normalizedName"],
                "sks": course["sks"],
                "difficultyScore": course["difficultyScore"],
                "grade": cand["grade"],
                "gradePoint": GRADE_POINTS[cand["grade"]],
                "p": cand["p"],
            })
            recurse(idx + 1, current)
            current.pop()
            if len(combos) >= MAX_COMBOS:
                aborted[0] = True
                return

    recurse(0, [])

    # Sort by delta descending
    combos.sort(key=lambda c: -c["ipkDelta"])

    # Filter
    filtered = []
    for cb in combos:
        if no_history:
            if cb["ipkDelta"] >= 0 and cb["newIpk"] > 0:
                filtered.append(cb)
        else:
            if 0.01 <= cb["ipkDelta"] <= 0.50:
                filtered.append(cb)

    return filtered[:8]


# ── Routes ─────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "ipk-ml-service", "port": PORT}


@app.post("/train")
async def train():
    """Train all models on the dataset."""
    try:
        summary = train_all_models()
        # Clear cache so models reload
        _models_cache.clear()
        return summary
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/evaluate")
async def evaluate():
    """Get model evaluation metrics."""
    try:
        summary_path = MODELS_DIR / "training_summary.json"
        if not summary_path.exists():
            # Train first
            train_all_models()
        with open(summary_path) as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/predict")
async def predict(req: PredictRequest):
    """Predict grade distribution for planned courses."""
    try:
        models = load_models()
        results = []

        context = {
            "currentIpk": req.currentIpk,
            "ipsLast": req.ipsLast,
            "ipsTrend": req.ipsTrend,
            "totalSks": req.totalSks,
            "semesterNumber": req.semesterNumber,
        }

        model_key = "model2" if req.model == "logreg" else "model3"

        for course in req.courses:
            difficulty = get_difficulty_for_course(course.courseName, models)
            dist = predict_grade_distribution(course, difficulty, context, models, model_key)

            # Find top predicted grade
            top_grade = max(dist, key=dist.get)
            top_prob = dist[top_grade]

            results.append({
                "courseName": course.courseName,
                "normalizedName": course.courseName,
                "sks": course.sks,
                "difficultyScore": difficulty["difficulty_score"],
                "difficultyLabel": difficulty["difficulty_label"],
                "distribution": dist,
                "topGrade": top_grade,
                "topProbability": round(top_prob, 4),
            })

        return {"predictions": results, "model": req.model}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/optimize")
async def optimize(req: OptimizeRequest):
    """Full optimization: predict distributions + generate combinations for 4 scenarios."""
    try:
        models = load_models()

        # Summarize transcript
        current_ipk = 0
        total_sks = 0
        ips_last = 0
        ips_trend = 0
        last_semester = 0

        if req.transcript:
            df_trans = pd.DataFrame([
                {"sks": t.sks, "bobot_nilai": GRADE_POINTS.get(t.grade.upper(), 0), "semester_ke": t.semester}
                for t in req.transcript
            ])
            total_sks = int(df_trans["sks"].sum())
            weighted = (df_trans["sks"] * df_trans["bobot_nilai"]).sum()
            current_ipk = weighted / total_sks if total_sks > 0 else 0

            sems = sorted(df_trans["semester_ke"].unique())
            ips_by_sem = {}
            for sem in sems:
                sem_df = df_trans[df_trans["semester_ke"] == sem]
                sks = sem_df["sks"].sum()
                w = (sem_df["sks"] * sem_df["bobot_nilai"]).sum()
                ips_by_sem[sem] = w / sks if sks > 0 else 0
            ips_list = list(ips_by_sem.values())
            ips_last = ips_list[-1] if ips_list else 0
            ips_prev = ips_list[-2] if len(ips_list) > 1 else ips_last
            ips_trend = ips_last - ips_prev
            last_semester = max(sems) if sems else 0

        context = {
            "currentIpk": round(current_ipk, 3),
            "ipsLast": round(ips_last, 3),
            "ipsTrend": round(ips_trend, 3),
            "totalSks": total_sks,
            "semesterNumber": last_semester + 1,
        }

        # Predict distributions for each planned course (using Model 2 - LogReg)
        courses_data = []
        for course in req.plannedCourses:
            difficulty = get_difficulty_for_course(course.courseName, models)
            dist = predict_grade_distribution(course, difficulty, context, models, "model2")
            courses_data.append({
                "courseId": course.courseName,  # use name as ID
                "courseName": course.courseName,
                "normalizedName": course.courseName,
                "sks": course.sks,
                "difficultyScore": difficulty["difficulty_score"],
                "difficultyLabel": difficulty["difficulty_label"],
                "distribution": dist,
            })

        # Generate combinations for 4 scenarios
        scenarios = []
        best_overall_delta = 0
        best_overall_ipk = current_ipk
        best_scenario = "serius"

        for scenario_name, effort in SCENARIO_EFFORT.items():
            combos = generate_combinations(courses_data, scenario_name, current_ipk, total_sks, req.targetIpk)

            best_delta = combos[0]["ipkDelta"] if combos else 0
            best_ipk = combos[0]["newIpk"] if combos else current_ipk
            achievable = req.targetIpk is not None and best_ipk >= req.targetIpk

            if best_delta > best_overall_delta:
                best_overall_delta = best_delta
                best_overall_ipk = best_ipk
                best_scenario = scenario_name

            scenarios.append({
                "scenario": scenario_name,
                "label": scenario_name.capitalize(),
                "description": {
                    "santai": "Usaha normal, target realistis",
                    "serius": "Fokus, di atas rata-rata",
                    "keras": "Standar tinggi, konsisten",
                    "maksimal": "All-out, target A",
                }.get(scenario_name, ""),
                "color": {
                    "santai": "emerald",
                    "serius": "sky",
                    "keras": "amber",
                    "maksimal": "rose",
                }.get(scenario_name, ""),
                "effortMultiplier": effort,
                "combinations": combos,
                "bestIpkDelta": best_delta,
                "bestNewIpk": best_ipk,
                "achievableTarget": achievable,
            })

        # Build classified courses
        classified = []
        for c in courses_data:
            classified.append({
                "courseName": c["courseName"],
                "major": "Umum",
                "difficultyCluster": int(c["difficultyScore"] * 5),
                "difficultyLabel": c["difficultyLabel"],
                "difficultyScore": c["difficultyScore"],
                "features": {
                    "major": "Umum",
                    "sampleCount": 1,
                    "meanIpsTakers": 3.3,
                    "pctAOrAbove": 0.3,
                    "pctBelowB": 0.3,
                },
                "typicalDifficulty": c["difficultyScore"],
            })

        # Trend data
        trend = {"semesters": []}
        if req.transcript:
            df_trans = pd.DataFrame([
                {"sks": t.sks, "bobot_nilai": GRADE_POINTS.get(t.grade.upper(), 0), "semester_ke": t.semester}
                for t in req.transcript
            ])
            sems = sorted(df_trans["semester_ke"].unique())
            cum_sks = 0
            cum_weighted = 0
            for sem in sems:
                sem_df = df_trans[df_trans["semester_ke"] == sem]
                sks = sem_df["sks"].sum()
                w = (sem_df["sks"] * sem_df["bobot_nilai"]).sum()
                ips = w / sks if sks > 0 else 0
                cum_sks += sks
                cum_weighted += w
                ipk_cum = cum_weighted / cum_sks if cum_sks > 0 else ips
                trend["semesters"].append({
                    "semester": int(sem),
                    "ips": round(ips, 3),
                    "ipkCumulative": round(ipk_cum, 3),
                })
            # Add projected
            best_sc = next((s for s in scenarios if s["scenario"] == best_scenario), None)
            if best_sc and best_sc["combinations"]:
                best = best_sc["combinations"][0]
                trend["semesters"].append({
                    "semester": (sems[-1] if sems else 0) + 1,
                    "ips": best["ips"],
                    "ipkCumulative": best_overall_ipk,
                    "isProjected": True,
                })

        message = f'Skenario terbaik "{best_scenario}" memproyeksikan IPK {best_overall_ipk:.3f} (Δ +{best_overall_delta:.3f}).'
        if req.targetIpk:
            achievable_overall = best_overall_ipk >= req.targetIpk
            if achievable_overall:
                message = f'Target IPK {req.targetIpk:.2f} tercapai pada skenario "{best_scenario}" dengan IPK {best_overall_ipk:.3f} (Δ +{best_overall_delta:.3f}).'
            else:
                message = f'Target IPK {req.targetIpk:.2f} belum tercapai. IPK proyeksi tertinggi {best_overall_ipk:.3f} (Δ +{best_overall_delta:.3f}).'

        return {
            "classifiedCourses": classified,
            "scenarios": scenarios,
            "distributions": [{"courseId": c["courseName"], "courseName": c["courseName"], "normalizedName": c["courseName"], "difficultyScore": c["difficultyScore"], "scenario": "serius", "distribution": c["distribution"]} for c in courses_data],
            "trend": trend,
            "summary": {
                "currentIpk": round(current_ipk, 3),
                "totalSks": total_sks,
                "targetIpk": req.targetIpk,
                "plannedSks": sum(c.sks for c in req.plannedCourses),
                "bestOverallDelta": round(best_overall_delta, 3),
                "bestOverallNewIpk": round(best_overall_ipk, 3),
                "bestScenario": best_scenario,
                "achievable": req.targetIpk is None or best_overall_ipk >= req.targetIpk,
                "message": message,
            },
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ── Startup ────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    """Generate dataset + train models on first start."""
    dataset_path = DATA_DIR / "dataset.csv"
    if not dataset_path.exists():
        print("📊 Dataset not found — generating...")
        from generate_dataset import generate_dataset, save_csv
        rows = generate_dataset(5000, 42)
        save_csv(rows, str(dataset_path))

    model1_path = MODELS_DIR / "model1_kmeans.joblib"
    if not model1_path.exists():
        print("🚀 Models not found — training on startup...")
        train_all_models()
    else:
        load_models()

    print(f"✅ ML service ready on port {PORT}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
