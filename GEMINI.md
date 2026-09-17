# GEMINI.md
# Context file untuk Google Gemini (Gemini CLI / Gemini Code Assist)
# Dibaca otomatis oleh Gemini CLI saat bekerja di direktori ini.

## Project Summary

**Indeks Prestasi — GPA Optimizer ML**
Python ML project untuk prediksi nilai mata kuliah dan kenaikan IPK mahasiswa Indonesia.
Dua model inti: K-Means clustering (difficulty) + Random Forest classifier (grade prediction).

## Key Files to Understand First

1. `configs/config.py` — semua konstanta, hyperparameter, path
2. `src/models/model1_difficulty_clustering.py` — Model 1
3. `src/models/model2_grade_predictor.py` — Model 2
4. `src/api/inference_pipeline.py` — GPAOptimizer (hubungkan kedua model)
5. `src/features/feature_engineering.py` — transformasi data mentah → fitur ML

## Core Concepts

### Model 1: Course Difficulty Clustering
Tidak ada label manual. Model belajar dari distribusi nilai:
```python
clusterer = CourseDifficultyClusterer()
course_with_labels = clusterer.fit_predict(course_features_df)
# course_features_df harus berisi: mean_grade_point, std_grade_point,
# pct_A_or_above, pct_below_B, pct_fail, median_grade_point,
# iqr_grade_point, mean_ips_takers
```
Output label: `sangat_mudah | mudah | medium | sulit | sangat_sulit`

### Model 2: Grade Outcome Predictor
```python
predictor = GradeOutcomePredictor()
predictor.fit(student_features_df)  # butuh kolom grade_class sebagai target
dist = predictor.predict_grade_distribution(course_row, scenario="serius")
# Returns: {"A": 0.32, "A-": 0.28, "B+": 0.21, ...}
```

### Skenario Usaha (0–3)
```
0 = santai   → usaha normal, target realistis
1 = serius   → fokus, di atas rata-rata
2 = keras    → standar tinggi, konsisten
3 = maksimal → all-out
```

### Grade Scale Indonesia
```python
GRADE_POINTS = {
    "A": 4.0, "A-": 3.7, "B+": 3.3, "B": 3.0, "B-": 2.7,
    "C+": 2.3, "C": 2.0, "C-": 1.7, "D": 1.0, "E": 0.0
}
```

## Data Pipeline

```
CSV/DB → DataLoader → IndonesiaAdapter → build_course_features()
→ Model1.fit_predict() → build_student_features() → Model2.fit()
→ GPAOptimizer.predict(transcript, planned_courses) → 4 skenario output
```

## Indonesia Dataset Columns

Dataset Indonesia pakai kolom Bahasa Indonesia.
`indonesia_adapter.py` mengkonversi otomatis:
- `jurusan` → `major`
- `mata_kuliah` → `course_name`
- `nilai` → `grade`
- `bobot_nilai` → `grade_point`
- `semester_ke` → `semester_number`

IPS/IPK kumulatif dihitung ulang dari data per-course (lebih akurat).

## Running the Project

```bash
pip install -r requirements.txt
cp .env.example .env
python scripts/train_indonesia.py   # training utama
python src/api/main.py              # jalankan prediksi
python tests/test_pipeline.py       # test end-to-end
```

## Do NOT

- Hardcode difficulty label di luar model
- Commit *.joblib atau *.csv besar (sudah di .gitignore)
- Ubah urutan GRADE_ORDER di config
- Hardcode path — pakai konstanta dari configs/config.py
