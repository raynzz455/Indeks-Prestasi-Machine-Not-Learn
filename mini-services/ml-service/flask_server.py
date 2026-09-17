"""
Minimal Flask server for the IPK Optimizer ML service.
Uses synchronous request handling (no async) for maximum stability.

Endpoints:
  GET  /health
  POST /optimize
  GET  /evaluate

Runs on port 3030.
"""

import json
import math
import os
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from flask import Flask, request, jsonify

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))
from train_models import GRADE_ORDER, GRADE_POINTS, MODELS_DIR

app = Flask(__name__)
PORT = 3030

# Global model cache
_models = {}

SCENARIO_EFFORT = {"santai": 0.55, "serius": 0.75, "keras": 0.90, "maksimal": 1.00}


def load_models():
    if _models:
        return _models
    _models["model1"] = joblib.load(MODELS_DIR / "model1_kmeans.joblib")
    _models["model2"] = joblib.load(MODELS_DIR / "model2_logreg.joblib")
    _models["model3"] = joblib.load(MODELS_DIR / "model3_randomforest.joblib")
    _models["course_features"] = pd.read_csv(MODELS_DIR / "course_features_labeled.csv")
    print("✅ Models loaded")
    return _models


def get_difficulty(course_name, models):
    cf = models["course_features"]
    match = cf[cf["mata_kuliah"] == course_name]
    if match.empty:
        match = cf[cf["mata_kuliah"].str.lower().str.contains(course_name.lower(), na=False)]
    if match.empty:
        return {"difficulty_score": 0.5, "difficulty_label": "medium", "difficulty_cluster": 2,
                "mean_ips_takers": 3.3, "pct_a_or_above": 0.3, "pct_below_b": 0.3}
    row = match.iloc[0]
    return {
        "difficulty_score": float(row["difficulty_score"]),
        "difficulty_label": str(row["difficulty_label"]),
        "difficulty_cluster": int(row["difficulty_cluster"]),
        "mean_ips_takers": float(row.get("mean_ips_takers", 3.3)),
        "pct_a_or_above": float(row.get("pct_a_or_above", 0.3)),
        "pct_below_b": float(row.get("pct_below_b", 0.3)),
    }


def predict_distribution(course_name, sks, difficulty, context, models, model_key="model2"):
    md = models[model_key]
    diff_score = difficulty["difficulty_score"]
    features = [[diff_score, difficulty["difficulty_cluster"], context["currentIpk"],
                 context["ipsLast"], context["ipsTrend"], context["totalSks"],
                 sks, context["semesterNumber"], 1, 0,
                 difficulty.get("mean_ips_takers", 3.3),
                 difficulty.get("pct_a_or_above", 0.3),
                 difficulty.get("pct_below_b", 0.3)]]
    X = md["scaler"].transform(np.array(features))
    proba = md["model"].predict_proba(X)[0]
    classes = md["model"].classes_
    dist = {}
    for i, cls in enumerate(classes):
        g = GRADE_ORDER[int(cls)]
        dist[g] = round(float(proba[i]), 4)
    for g in GRADE_ORDER:
        if g not in dist:
            dist[g] = 0.0
    return dist


def modulate(dist, effort):
    n = len(GRADE_ORDER)
    target = max(0, min(1, 1 - effort))
    out = {}
    for i, g in enumerate(GRADE_ORDER):
        rank = i / (n - 1)
        d = abs(rank - target)
        w = math.exp(-(d ** 2) * 8)
        out[g] = dist.get(g, 0) * 0.35 + w * 0.65
    total = sum(out.values())
    if total > 0:
        for k in out:
            out[k] /= total
    return out


def gen_combos(courses, scenario, cur_ipk, total_sks, target_ipk):
    effort = SCENARIO_EFFORT.get(scenario, 0.75)
    no_hist = total_sks == 0
    per_course = []
    for c in courses:
        md = modulate(c["distribution"], effort)
        entries = [(g, md.get(g, 0)) for g in GRADE_ORDER]
        entries.sort(key=lambda x: -x[1])
        per_course.append({"info": c, "top": entries[:3]})

    combos = []
    def rec(idx, current):
        if len(combos) >= 400:
            return
        if idx == len(per_course):
            ts = sum(g["sks"] for g in current)
            wg = sum(g["sks"] * g["gp"] for g in current)
            ips = wg / ts if ts > 0 else 0
            ni = (cur_ipk * total_sks + ips * ts) / (total_sks + ts) if total_sks > 0 else ips
            d = sum(g["sks"] * g["diff"] for g in current) / ts if ts > 0 else 0
            p = 1.0
            for g in current:
                p *= max(g["prob"], 1e-6)
            delta = ni - cur_ipk
            if no_hist:
                if delta < 0 or ni <= 0:
                    return
            else:
                if delta < 0.01 or delta > 0.50:
                    return
            combos.append({
                "grades": [{"courseId": g["id"], "courseName": g["name"],
                            "normalizedName": g["norm"], "sks": g["sks"],
                            "grade": g["grade"], "gradePoint": g["gp"]} for g in current],
                "ips": round(ips, 3), "newIpk": round(ni, 3),
                "ipkDelta": round(delta, 3), "cumulativeDifficulty": round(d, 2),
                "expectedProbability": round(p, 4),
            })
            return
        for cand in per_course[idx]["top"]:
            current.append({
                "id": per_course[idx]["info"]["courseId"],
                "name": per_course[idx]["info"]["courseName"],
                "norm": per_course[idx]["info"]["normalizedName"],
                "sks": per_course[idx]["info"]["sks"],
                "diff": per_course[idx]["info"]["difficultyScore"],
                "grade": cand[0], "gp": GRADE_POINTS[cand[0]], "prob": cand[1],
            })
            rec(idx + 1, current)
            current.pop()
    rec(0, [])
    combos.sort(key=lambda c: -c["ipkDelta"])
    return combos[:8]


@app.route("/health")
def health():
    return jsonify({"status": "ok", "service": "ipk-ml-service", "port": PORT})


@app.route("/evaluate")
def evaluate():
    path = MODELS_DIR / "training_summary.json"
    if not path.exists():
        return jsonify({"error": "Models not trained"}), 500
    with open(path) as f:
        return jsonify(json.load(f))


@app.route("/optimize", methods=["POST"])
def optimize():
    try:
        body = request.get_json(force=True)
        models = load_models()

        # Summarize transcript
        transcript = body.get("transcript", [])
        planned = body.get("plannedCourses", [])
        target_ipk = body.get("targetIpk")

        cur_ipk = 0
        total_sks = 0
        ips_last = 0
        ips_trend = 0
        last_sem = 0

        if transcript:
            total_sks = sum(t.get("sks", 0) for t in transcript)
            wg = sum(t.get("sks", 0) * GRADE_POINTS.get(t.get("grade", "E").upper(), 0) for t in transcript)
            cur_ipk = wg / total_sks if total_sks > 0 else 0
            sems = sorted(set(t.get("semester", 1) for t in transcript))
            ips_by = {}
            for s in sems:
                sd = [t for t in transcript if t.get("semester") == s]
                ss = sum(t.get("sks", 0) for t in sd)
                ww = sum(t.get("sks", 0) * GRADE_POINTS.get(t.get("grade", "E").upper(), 0) for t in sd)
                ips_by[s] = ww / ss if ss > 0 else 0
            ips_list = list(ips_by.values())
            ips_last = ips_list[-1] if ips_list else 0
            ips_prev = ips_list[-2] if len(ips_list) > 1 else ips_last
            ips_trend = ips_last - ips_prev
            last_sem = max(sems) if sems else 0

        context = {"currentIpk": round(cur_ipk, 3), "ipsLast": round(ips_last, 3),
                    "ipsTrend": round(ips_trend, 3), "totalSks": total_sks,
                    "semesterNumber": last_sem + 1}

        # Predict for each planned course
        courses_data = []
        for c in planned:
            diff = get_difficulty(c.get("courseName", ""), models)
            dist = predict_distribution(c.get("courseName", ""), c.get("sks", 3), diff, context, models)
            courses_data.append({
                "courseId": c.get("courseName", ""),
                "courseName": c.get("courseName", ""),
                "normalizedName": c.get("courseName", ""),
                "sks": c.get("sks", 3),
                "difficultyScore": diff["difficulty_score"],
                "difficultyLabel": diff["difficulty_label"],
                "distribution": dist,
            })

        # Generate 4 scenarios
        scenarios = []
        best_delta = 0
        best_ipk = cur_ipk
        best_sc = "serius"

        for sn, eff in SCENARIO_EFFORT.items():
            combos = gen_combos(courses_data, sn, cur_ipk, total_sks, target_ipk)
            bd = combos[0]["ipkDelta"] if combos else 0
            bi = combos[0]["newIpk"] if combos else cur_ipk
            ach = target_ipk is not None and bi >= target_ipk
            if bd > best_delta:
                best_delta = bd
                best_ipk = bi
                best_sc = sn
            scenarios.append({
                "scenario": sn, "label": sn.capitalize(),
                "description": {"santai": "Usaha normal", "serius": "Fokus", "keras": "Standar tinggi", "maksimal": "All-out"}.get(sn, ""),
                "color": {"santai": "emerald", "serius": "sky", "keras": "amber", "maksimal": "rose"}.get(sn, ""),
                "effortMultiplier": eff, "combinations": combos,
                "bestIpkDelta": bd, "bestNewIpk": bi, "achievableTarget": ach,
            })

        # Build classified
        classified = [{"courseName": c["courseName"], "major": "Umum",
                        "difficultyCluster": int(c["difficultyScore"] * 5),
                        "difficultyLabel": c["difficultyLabel"],
                        "difficultyScore": c["difficultyScore"],
                        "features": {"major": "Umum", "sampleCount": 1, "meanIpsTakers": 3.3, "pctAOrAbove": 0.3, "pctBelowB": 0.3},
                        "typicalDifficulty": c["difficultyScore"]} for c in courses_data]

        # Trend
        trend = {"semesters": []}
        if transcript:
            sems = sorted(set(t.get("semester", 1) for t in transcript))
            cs = 0
            cw = 0
            for s in sems:
                sd = [t for t in transcript if t.get("semester") == s]
                ss = sum(t.get("sks", 0) for t in sd)
                ww = sum(t.get("sks", 0) * GRADE_POINTS.get(t.get("grade", "E").upper(), 0) for t in sd)
                ips = ww / ss if ss > 0 else 0
                cs += ss
                cw += ww
                ic = cw / cs if cs > 0 else ips
                trend["semesters"].append({"semester": s, "ips": round(ips, 3), "ipkCumulative": round(ic, 3)})
            best_s_obj = next((s for s in scenarios if s["scenario"] == best_sc), None)
            if best_s_obj and best_s_obj["combinations"]:
                trend["semesters"].append({"semester": (sems[-1] if sems else 0) + 1, "ips": best_s_obj["combinations"][0]["ips"], "ipkCumulative": best_ipk, "isProjected": True})

        msg = f'Skenario terbaik "{best_sc}" memproyeksikan IPK {best_ipk:.3f} (Δ +{best_delta:.3f}).'
        if target_ipk:
            if best_ipk >= target_ipk:
                msg = f'Target IPK {target_ipk:.2f} tercapai pada skenario "{best_sc}" dengan IPK {best_ipk:.3f} (Δ +{best_delta:.3f}).'
            else:
                msg = f'Target IPK {target_ipk:.2f} belum tercapai. IPK proyeksi tertinggi {best_ipk:.3f} (Δ +{best_delta:.3f}).'

        return jsonify({
            "classifiedCourses": classified,
            "scenarios": scenarios,
            "distributions": [{"courseId": c["courseName"], "courseName": c["courseName"], "normalizedName": c["courseName"], "difficultyScore": c["difficultyScore"], "scenario": "serius", "distribution": c["distribution"]} for c in courses_data],
            "trend": trend,
            "summary": {
                "currentIpk": round(cur_ipk, 3), "totalSks": total_sks,
                "targetIpk": target_ipk, "plannedSks": sum(c.get("sks", 3) for c in planned),
                "bestOverallDelta": round(best_delta, 3), "bestOverallNewIpk": round(best_ipk, 3),
                "bestScenario": best_sc,
                "achievable": target_ipk is None or best_ipk >= target_ipk,
                "message": msg,
            },
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    # Load models on start
    load_models()
    print(f"✅ ML service (Flask) ready on port {PORT}")
    app.run(host="0.0.0.0", port=PORT, threaded=True)
