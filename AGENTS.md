# AGENTS.md
# Context file untuk OpenAI Codex, ChatGPT Code Interpreter, GitHub Copilot,
# Cursor, Windsurf, dan coding agent lainnya.
# Spec: https://openai.com/docs/codex

## What This Project Does

GPA Optimizer — sistem ML untuk mahasiswa Indonesia.
Input: transkrip nilai (IPK, IPS, mata kuliah) + rencana semester baru.
Output: semua kombinasi nilai yang mungkin per skenario usaha + perkiraan kenaikan IPK.

## Tech Stack

- Python 3.11+
- scikit-learn (K-Means, Random Forest, Logistic Regression)
- pandas, numpy, scipy
- SQLAlchemy + psycopg2 (opsional, untuk koneksi DB)
- python-dotenv (.env config)
- joblib (model serialization)

## Project Layout

```
configs/config.py          ← single source of truth untuk semua konstanta
src/
  data/
    data_loader.py         ← DataLoader class, load CSV atau DB
    indonesia_adapter.py   ← konversi format dataset Indonesia
    synthetic_generator.py ← buat data sintetis untuk testing
  features/
    feature_engineering.py ← build_course_features(), build_student_features()
  models/
    model1_difficulty_clustering.py  ← CourseDifficultyClusterer (KMeans)
    model2_grade_predictor.py        ← GradeOutcomePredictor (RandomForest)
  evaluation/
    metrics.py             ← evaluate_clustering(), within_n_step_accuracy()
  utils/
    grade_utils.py         ← compute_ips(), compute_ipk(), gp_to_grade()
  api/
    inference_pipeline.py  ← GPAOptimizer (main inference class)
    main.py                ← CLI entry point
scripts/
  train_indonesia.py       ← training dengan dataset Indonesia (utama)
  train_pipeline.py        ← training dengan data sintetis
tests/
  test_pipeline.py         ← end-to-end integration test
```

## Critical Rules for Code Generation

### Always import from config
```python
from configs.config import GRADE_POINTS, MODEL1_CONFIG, MODEL2_CONFIG, GRADE_ORDER
# Never hardcode: {"A": 4.0} or ["A", "A-", "B+", ...]
```

### Grade scale (10 classes)
```
A=4.0, A-=3.7, B+=3.3, B=3.0, B-=2.7, C+=2.3, C=2.0, C-=1.7, D=1.0, E=0.0
```

### IPK formula
```python
ipk_new = (ipk_old * sks_old + ips_new * sks_new) / (sks_old + sks_new)
```

### Scenario encoding
```python
{"santai": 0, "serius": 1, "keras": 2, "maksimal": 3}
```

### IPK delta filter
```python
# Only show combinations where delta is in [0.01, 0.50]
IPK_DELTA = {"min_meaningful": 0.01, "max_realistic": 0.50}
```

## Model Classes API

### CourseDifficultyClusterer
```python
m1 = CourseDifficultyClusterer()
labeled_df = m1.fit_predict(course_features_df)
# labeled_df adds: difficulty_cluster, difficulty_label, difficulty_score
m1.save()  # → models/trained/model1_indonesia.joblib
m1 = CourseDifficultyClusterer.load()
```

### GradeOutcomePredictor
```python
m2 = GradeOutcomePredictor()
m2.fit(student_features_df)  # student_features_df must have grade_class column
dist = m2.predict_grade_distribution(course_row_dict, scenario="serius")
combos = m2.generate_combinations(courses, "keras", transcript)
all_scenarios = m2.generate_all_scenarios(courses, transcript)
m2.save()
m2 = GradeOutcomePredictor.load()
```

### GPAOptimizer (end-to-end)
```python
optimizer = GPAOptimizer()  # loads saved models automatically
result = optimizer.predict(
    transcript={"ipk": 3.20, "total_sks": 72, "ips_last": 3.10,
                "ips_trend": 0.05, "semester_number": 5},
    planned_courses=[
        {"name": "Kalkulus III", "major": "Teknik Informatika", "sks": 3},
        {"name": "Seminar",      "major": "Teknik Informatika", "sks": 1,
         "user_difficulty_override": 0.1},
    ]
)
# result keys: classified_courses, scenarios, summary
```

## Environment Variables (.env)

```
DATA_SOURCE=file          # "file" | "db" | "" (auto)
DATA_PATH=data/indonesia/indonesia_course_records.csv
DB_URL=postgresql://user:pass@localhost:5432/gpa_optimizer
MODEL1_PATH=models/trained/model1_indonesia.joblib
MODEL2_PATH=models/trained/model2_indonesia.joblib
```

## Testing

```bash
python tests/test_pipeline.py
# Expected: classified_courses, 4 scenarios, summary — all non-empty
```

## What NOT to Generate

- No hardcoded difficulty scores outside the model
- No manual grade-to-difficulty mappings
- No file paths as string literals — use pathlib + config constants
- No committing .joblib or large .csv files
