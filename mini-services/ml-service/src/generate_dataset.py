"""
Dataset generator for the IPK Optimizer ML models.

Generates a realistic synthetic Indonesian university transcript dataset
calibrated to national IPK statistics (~3.33 mean, benchmark Kemdikbudristek 2022).

Target: ~5000 rows (one row per student×course record).

Columns (Indonesian → pipeline):
  - student_id       : unique student identifier
  - jurusan           : major (12 options)
  - semester_ke       : semester number (1-8)
  - mata_kuliah       : course name (from canonical catalog)
  - sks               : credit hours (1-6)
  - nilai             : letter grade (A, A-, B+, B, B-, C+, C, C-, D, E)
  - bobot_nilai       : grade point (0.0-4.0)
  - kemampuan_laten   : latent ability (0-1, per student)

Usage:
  python src/generate_dataset.py --output data/dataset.csv --rows 5000
"""

import csv
import random
import math
import os
from pathlib import Path

# ── Canonical course catalog (same as TS config) ──────────────────────

MAJORS = [
    "Teknik Informatika", "Sistem Informasi", "Teknik Sipil", "Teknik Mesin",
    "Teknik Elektro", "Manajemen", "Akuntansi", "Ilmu Komunikasi",
    "Hukum", "Kedokteran", "Farmasi", "Biologi",
]

GRADE_POINTS = {
    "A": 4.0, "A-": 3.7, "B+": 3.3, "B": 3.0, "B-": 2.7,
    "C+": 2.3, "C": 2.0, "C-": 1.7, "D": 1.0, "E": 0.0,
}

GRADE_ORDER = ["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D", "E"]

COURSES = [
    # Matematika & Dasar
    ("Kalkulus I", "Matematika", 3, 0.65),
    ("Kalkulus II", "Matematika", 3, 0.78),
    ("Kalkulus III", "Matematika", 3, 0.88),
    ("Aljabar Linear", "Matematika", 3, 0.62),
    ("Matematika Diskrit", "Matematika", 3, 0.58),
    ("Statistika", "Matematika", 3, 0.55),
    ("Statistika Inferensial", "Matematika", 3, 0.70),
    ("Pengantar Matematika", "Matematika", 2, 0.30),
    # Pemrograman & Informatika
    ("Algoritma dan Pemrograman", "Informatika", 4, 0.60),
    ("Struktur Data", "Informatika", 3, 0.72),
    ("Pemrograman Berorientasi Objek", "Informatika", 3, 0.66),
    ("Basis Data", "Informatika", 3, 0.58),
    ("Sistem Operasi", "Informatika", 3, 0.74),
    ("Jaringan Komputer", "Informatika", 3, 0.68),
    ("Rekayasa Perangkat Lunak", "Informatika", 3, 0.60),
    ("Pemrograman Web", "Informatika", 3, 0.50),
    ("Kecerdasan Buatan", "Informatika", 3, 0.82),
    ("Pembelajaran Mesin", "Informatika", 3, 0.85),
    ("Pemrograman Mobile", "Informatika", 3, 0.55),
    ("Grafika Komputer", "Informatika", 3, 0.68),
    # Fisika
    ("Fisika Dasar I", "Fisika", 3, 0.62),
    ("Fisika Dasar II", "Fisika", 3, 0.72),
    ("Fisika", "Fisika", 3, 0.55),
    # Kimia
    ("Kimia Dasar", "Kimia", 3, 0.55),
    ("Kimia Organik", "Kimia", 3, 0.78),
    # Bisnis & Sosial
    ("Pengantar Ekonomi", "Ekonomi", 3, 0.45),
    ("Manajemen", "Bisnis", 3, 0.42),
    ("Akuntansi Keuangan", "Akuntansi", 3, 0.58),
    ("Pemasaran", "Bisnis", 3, 0.40),
    ("Perilaku Organisasi", "Bisnis", 3, 0.45),
    # Wajib
    ("Pancasila", "Wajib", 2, 0.18),
    ("Kewarganegaraan", "Wajib", 2, 0.20),
    ("Agama", "Wajib", 2, 0.22),
    ("Bahasa Indonesia", "Wajib", 2, 0.25),
    ("Bahasa Inggris", "Wajib", 2, 0.30),
    ("Kewirausahaan", "Wajib", 2, 0.35),
    ("Metodologi Penelitian", "Umum", 2, 0.40),
    ("Etika Profesi", "Umum", 2, 0.30),
    ("Seminar", "Umum", 1, 0.25),
    ("Kerja Praktik", "Umum", 3, 0.25),
    ("Skripsi", "Umum", 6, 0.60),
    # Kedokteran / Sains
    ("Anatomi", "Kedokteran", 4, 0.85),
    ("Fisiologi", "Kedokteran", 4, 0.82),
    ("Biokimia", "Kedokteran", 3, 0.88),
    ("Farmakologi", "Farmasi", 4, 0.85),
    ("Mikrobiologi", "Sains", 3, 0.78),
    ("Genetika", "Sains", 3, 0.75),
    # Hukum / Komunikasi
    ("Pengantar Ilmu Hukum", "Hukum", 3, 0.50),
    ("Hukum Perdata", "Hukum", 3, 0.62),
    ("Hukum Pidana", "Hukum", 3, 0.65),
    ("Komunikasi Massa", "Komunikasi", 3, 0.40),
    ("Komunikasi Organisasi", "Komunikasi", 3, 0.42),
]


def major_to_categories(major: str) -> list[str]:
    m = major.lower()
    if "informatika" in m or "sistem informasi" in m:
        return ["Matematika", "Informatika", "Fisika", "Kimia", "Umum"]
    if "sipil" in m or "mesin" in m or "elektro" in m:
        return ["Matematika", "Fisika", "Kimia", "Umum"]
    if "manajemen" in m or "akuntansi" in m:
        return ["Ekonomi", "Bisnis", "Akuntansi", "Matematika", "Umum"]
    if "komunikasi" in m:
        return ["Komunikasi", "Bisnis", "Umum"]
    if "hukum" in m:
        return ["Hukum", "Umum"]
    if "kedokteran" in m or "farmasi" in m:
        return ["Kedokteran", "Farmasi", "Sains", "Kimia", "Umum"]
    if "biologi" in m:
        return ["Sains", "Matematika", "Kimia", "Umum"]
    return ["Matematika", "Umum"]


def gauss(rand: float, mean: float, std: float) -> float:
    u1 = max(rand, 1e-9)
    u2 = random.random()
    z = math.sqrt(-2 * math.log(u1)) * math.cos(2 * math.pi * u2)
    return mean + std * z


def sample_grade(difficulty: float, ability: float) -> str:
    target_gp = max(0, min(4, 4.0 - difficulty * 1.5 + ability * 0.8))
    std = 0.4 + difficulty * 0.4
    gp = gauss(random.random(), target_gp, std)
    gp = max(0, min(4, gp))
    # Snap to nearest grade
    best = "E"
    best_dist = float("inf")
    for g, gp_val in GRADE_POINTS.items():
        d = abs(gp_val - gp)
        if d < best_dist:
            best_dist = d
            best = g
    return best


def generate_dataset(target_rows: int = 5000, seed: int = 42) -> list[dict]:
    random.seed(seed)
    rows = []

    # Estimate students needed: ~6 courses per semester × ~5 semesters = ~30 records/student
    records_per_student = 30
    n_students = target_rows // records_per_student + 50  # extra buffer

    for s in range(n_students):
        major = random.choice(MAJORS)
        ability = max(0, min(1, gauss(random.random(), 0.55, 0.18)))
        n_semesters = random.randint(2, 8)

        major_categories = major_to_categories(major)
        eligible = [c for c in COURSES if c[1] in major_categories or c[1] == "Wajib"]
        required = [c for c in COURSES if c[1] == "Wajib"]
        pool = eligible + required
        random.shuffle(pool)

        for sem in range(1, n_semesters + 1):
            n_courses = random.randint(5, 7)
            start_idx = (sem - 1) * 6
            sem_courses = pool[start_idx:start_idx + n_courses]
            if not sem_courses:
                break

            for course_name, category, sks, difficulty in sem_courses:
                grade = sample_grade(difficulty, ability)
                grade_point = GRADE_POINTS[grade]
                rows.append({
                    "student_id": f"S{s+1}",
                    "jurusan": major,
                    "semester_ke": sem,
                    "mata_kuliah": course_name,
                    "sks": sks,
                    "nilai": grade,
                    "bobot_nilai": grade_point,
                    "kemampuan_laten": round(ability, 3),
                })

                if len(rows) >= target_rows:
                    return rows[:target_rows]

    return rows[:target_rows]


def save_csv(rows: list[dict], path: str):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "student_id", "jurusan", "semester_ke", "mata_kuliah",
            "sks", "nilai", "bobot_nilai", "kemampuan_laten"
        ])
        writer.writeheader()
        writer.writerows(rows)
    print(f"✅ Dataset saved: {path}")
    print(f"   Rows: {len(rows)}")
    students = set(r["student_id"] for r in rows)
    majors = set(r["jurusan"] for r in rows)
    courses = set(r["mata_kuliah"] for r in rows)
    mean_gp = sum(r["bobot_nilai"] for r in rows) / len(rows)
    print(f"   Students: {len(students)}")
    print(f"   Majors: {len(majors)}")
    print(f"   Courses: {len(courses)}")
    print(f"   Mean grade point: {mean_gp:.3f}")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="data/dataset.csv")
    parser.add_argument("--rows", type=int, default=5000)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    rows = generate_dataset(args.rows, args.seed)
    save_csv(rows, args.output)
