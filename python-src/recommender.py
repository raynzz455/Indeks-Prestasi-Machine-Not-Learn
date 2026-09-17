"""
Recommendation engine — generate optimal grade combinations.

Status: IMPLEMENTED in mini-services/ml-service/optimize_cli.py
        This is a stub for the original pipeline structure.
"""

from itertools import product as cartesian_product
from simulator import compute_ipk, compute_ips

SCENARIOS = ["santai", "serius", "keras", "maksimal"]
SCENARIO_EFFORT = {"santai": 0.55, "serius": 0.75, "keras": 0.90, "maksimal": 1.00}
IPK_DELTA_MIN = 0.01
IPK_DELTA_MAX = 0.50

GRADE_POINTS = {
    "A": 4.0, "A-": 3.7, "B+": 3.3, "B": 3.0, "B-": 2.7,
    "C+": 2.3, "C": 2.0, "C-": 1.7, "D": 1.0, "E": 0.0,
}


def generate_combinations(courses, scenario, current_ipk, total_sks, target_ipk=None):
    """
    Generate all realistic grade combinations for planned courses.

    Args:
        courses: list of {courseId, courseName, sks, difficultyScore, distribution}
        scenario: one of SCENARIOS
        current_ipk: student's current cumulative IPK
        total_sks: total SKS completed so far
        target_ipk: optional target IPK to check achievability

    Returns:
        list of combination dicts sorted by IPK delta (descending)
    """
    # This is a stub — the actual implementation is in optimize_cli.py
    # which uses the trained scikit-learn models for prediction.
    raise NotImplementedError(
        "Use mini-services/ml-service/optimize_cli.py for the full implementation."
    )


def recommend_strategy(current_ipk, target_ipk, best_combination):
    """
    Generate a natural-language strategy recommendation.

    Args:
        current_ipk: student's current IPK
        target_ipk: student's target IPK
        best_combination: the best grade combination from optimization

    Returns:
        dict with strategy text and tips list
    """
    new_ipk = best_combination["new_ipk"]
    delta = best_combination["delta"]
    achievable = new_ipk >= target_ipk if target_ipk else True

    if achievable and target_ipk:
        strategy = f"Target IPK {target_ipk:.2f} tercapai dengan IPK proyeksi {new_ipk:.3f} (Δ +{delta:.3f})."
    elif target_ipk:
        gap = target_ipk - new_ipk
        strategy = f"Target IPK {target_ipk:.2f} belum tercapai. Kurang {gap:.3f}. Tingkatkan effort atau tambah SKS mudah."
    else:
        strategy = f"IPK proyeksi: {new_ipk:.3f} (Δ +{delta:.3f})."

    tips = [
        "Prioritaskan mata kuliah dengan kesulitan tinggi yang masih bisa dapat A.",
        "Pertahankan minimal B pada mata kuliah sulit.",
        "Hindari nilai C ke bawah untuk menjaga IPK stabil.",
    ]

    return {"strategy": strategy, "tips": tips}
