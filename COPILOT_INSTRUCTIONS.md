# COPILOT_INSTRUCTIONS.md
# GitHub Copilot workspace instructions.
# Letakkan juga di .github/copilot-instructions.md agar otomatis terbaca
# oleh GitHub Copilot di VS Code.

## Project

GPA Optimizer ML — Python project untuk prediksi nilai mahasiswa Indonesia.
Dua model ML: K-Means (kesulitan MK) + Random Forest (prediksi nilai).

## Coding Style

- Python 3.11+ dengan type hints
- Docstring di setiap public method (format Google style)
- Import: stdlib → third-party → local (dipisah baris kosong)
- Semua konstanta dari `configs/config.py`, tidak ada magic number
- Path selalu pakai `pathlib.Path`, bukan string

## Suggest imports from these modules

```python
from configs.config import GRADE_POINTS, GRADE_ORDER, MODEL1_CONFIG, MODEL2_CONFIG
from src.utils.grade_utils import compute_ips, compute_ipk, gp_to_grade
from src.evaluation.metrics import evaluate_clustering, within_n_step_accuracy
```

## Model conventions

```python
# Model 1 output: always a DataFrame with these added columns:
# difficulty_cluster (int), difficulty_label (str), difficulty_score (float 0–1)

# Model 2 input: dict matching MODEL2_CONFIG["features"]
# Model 2 output from predict_grade_distribution():
# {"A": float, "A-": float, "B+": float, ...}  — probabilities sum to ~1.0
```

## Auto-complete hints

When writing grade logic, prefer:
```python
# Good
from configs.config import GRADE_POINTS
gp = GRADE_POINTS["A-"]  # → 3.7

# Avoid
gp = 3.7  # hardcoded
```

When writing IPK calculation:
```python
# Good — use utility
from src.utils.grade_utils import compute_ipk
new_ipk = compute_ipk(old_ipk=3.20, old_sks=72, new_ips=3.50, new_sks=20)

# Avoid — inline formula that duplicates logic
new_ipk = (3.20 * 72 + 3.50 * 20) / (72 + 20)
```
