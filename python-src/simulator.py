"""
IPK Simulator — compute future IPK based on grade combinations.

Formula: ipk_new = (ipk_old * sks_old + ips_new * sks_new) / (sks_old + sks_new)
"""

GRADE_POINTS = {
    "A": 4.0, "A-": 3.7, "B+": 3.3, "B": 3.0, "B-": 2.7,
    "C+": 2.3, "C": 2.0, "C-": 1.7, "D": 1.0, "E": 0.0,
}


def compute_ips(grades):
    """Compute IPS (semester GPA) from a list of {sks, grade_point} dicts."""
    total_sks = sum(g["sks"] for g in grades)
    if total_sks == 0:
        return 0
    weighted = sum(g["sks"] * g["grade_point"] for g in grades)
    return weighted / total_sks


def compute_ipk(old_ipk, old_sks, new_ips, new_sks):
    """Compute cumulative IPK after adding a new semester."""
    total = old_sks + new_sks
    if total == 0:
        return old_ipk
    return (old_ipk * old_sks + new_ips * new_sks) / total


def simulate_combination(old_ipk, old_sks, grades):
    """
    Simulate the effect of a grade combination on IPK.

    Args:
        old_ipk: current cumulative IPK
        old_sks: total SKS completed so far
        grades: list of {"sks": int, "grade_point": float}

    Returns:
        dict with ips, new_ipk, delta
    """
    ips = compute_ips(grades)
    new_ipk = compute_ipk(old_ipk, old_sks, ips, sum(g["sks"] for g in grades))
    return {
        "ips": round(ips, 3),
        "new_ipk": round(new_ipk, 3),
        "delta": round(new_ipk - old_ipk, 3),
    }
