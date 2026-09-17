# CLAUDE.md
# Context file untuk Claude (Anthropic) — dibaca otomatis oleh Claude Code
# Jangan hapus file ini. Update jika ada perubahan arsitektur besar.

## Identitas Proyek

**Nama**: Indeks Prestasi — GPA Optimizer ML
**Bahasa utama**: Python 3.11+
**Tujuan**: Sistem ML yang memprediksi kombinasi nilai mata kuliah dan probabilitas
kenaikan IPK mahasiswa Indonesia berdasarkan histori transkrip + rencana semester baru.

---

## Dua Model Inti — Wajib Dipahami Sebelum Menyentuh Kode

### Model 1 — `src/models/model1_difficulty_clustering.py`
- **Jenis**: Unsupervised clustering (K-Means / GMM)
- **Input**: Agregasi statistik nilai per mata kuliah × jurusan
  (mean_grade_point, std, pct_A_or_above, pct_below_B, pct_fail, median, iqr, mean_ips_takers)
- **Output**: difficulty_label (sangat_mudah / mudah / medium / sulit / sangat_sulit)
  + difficulty_score (0.0–1.0)
- **PENTING**: Difficulty **TIDAK** di-hardcode. Model belajar sendiri dari distribusi
  nilai nyata — Kalkulus masuk "sangat_sulit" karena nilai mahasiswanya memang rendah,
  bukan karena kita label manual.
- **Class**: `CourseDifficultyClusterer`

### Model 2 — `src/models/model2_grade_predictor.py`
- **Jenis**: Supervised multi-class classification (Random Forest)
- **Input features** (lihat `MODEL2_CONFIG["features"]` di `configs/config.py`):
  difficulty_score, difficulty_cluster, ipk_before, ips_last_semester, ips_trend,
  total_sks_completed, course_sks, semester_number, scenario_encoded, major_encoded,
  mean_ips_takers, pct_A_or_above, pct_below_B
- **Output**: probabilitas P(A), P(A-), P(B+), P(B), P(B-), P(C+), P(C), P(C-), P(D), P(E)
- **Class**: `GradeOutcomePredictor`
- **Catatan akurasi**: Exact accuracy ~24% untuk 10 kelas (wajar). Within-1-step = 55%.
  Jangan coba "perbaiki" dengan hardcode — tambah data nyata dari transkrip user.

---

## Alur Data (Pipeline)

```
1. DataLoader (src/data/data_loader.py)
        ↓ CSV / DB
2. IndonesiaAdapter (src/data/indonesia_adapter.py)
   — rename kolom Bahasa Indonesia → format pipeline
   — hitung IPS per semester, IPK kumulatif, ips_trend, total_sks
        ↓
3. build_course_features() → src/features/feature_engineering.py
   — agregasi per (course_name × major)
        ↓
4. CourseDifficultyClusterer.fit_predict()  ← Model 1
        ↓
5. build_student_features() + encode_grade_to_class()
        ↓
6. GradeOutcomePredictor.fit()              ← Model 2
        ↓
7. GPAOptimizer.predict()  ← src/api/inference_pipeline.py
   — input: transcript + planned_courses
   — output: 4 skenario × kombinasi nilai × Δ IPK
```

---

## Konvensi Kode

### Kolom dataset Indonesia (sebelum adapter)
| Kolom Indonesia | Kolom Pipeline |
|-----------------|----------------|
| `jurusan`       | `major`        |
| `semester_ke`   | `semester_number` |
| `mata_kuliah`   | `course_name`  |
| `nilai`         | `grade`        |
| `bobot_nilai`   | `grade_point`  |
| `kemampuan_laten` | `latent_ability` |

### Skala nilai
Selalu gunakan `GRADE_POINTS` dari `configs/config.py`. Jangan hardcode nilai angka
di luar file config. Urutan: A(4.0) → A-(3.7) → B+(3.3) → B(3.0) → ... → E(0.0)

### Skenario usaha
```python
SCENARIOS = ["santai", "serius", "keras", "maksimal"]  # index 0–3
# scenario_encoded: santai=0, serius=1, keras=2, maksimal=3
```

### IPK delta bounds
```python
IPK_DELTA = {"min_meaningful": 0.01, "max_realistic": 0.50}
```
Kombinasi nilai yang menghasilkan Δ IPK di luar range ini difilter dan tidak ditampilkan.

---

## Struktur Folder

```
configs/config.py                 ← SEMUA konstanta, hyperparameter, path. Edit di sini.
data/indonesia/                   ← Dataset generator Indonesia
data/processed/                   ← Output feature engineering (di-gitignore)
models/trained/*.joblib           ← Trained models (di-gitignore)
src/data/data_loader.py           ← Load CSV/DB, auto-detect format Indonesia
src/data/indonesia_adapter.py     ← Konversi kolom + hitung IPS/IPK kumulatif
src/data/synthetic_generator.py   ← Generator data sintetis untuk dev/testing
src/features/feature_engineering.py
src/models/model1_difficulty_clustering.py
src/models/model2_grade_predictor.py
src/evaluation/metrics.py         ← silhouette, within_n_step_accuracy
src/utils/grade_utils.py          ← compute_ips(), compute_ipk(), gp_to_grade()
src/api/inference_pipeline.py     ← GPAOptimizer — hubungkan semua komponen
src/api/main.py                   ← Entry point
scripts/train_indonesia.py        ← Training utama (gunakan ini)
scripts/train_pipeline.py         ← Training dengan data sintetis
tests/test_pipeline.py
```

---

## Cara Menjalankan

```bash
# Setup
pip install -r requirements.txt
cp .env.example .env

# Generate dataset + training
python scripts/train_indonesia.py

# Prediksi
python src/api/main.py

# Test
python tests/test_pipeline.py
```

---

## Yang TIDAK Boleh Dilakukan

- **Jangan hardcode difficulty label** di luar model (misal: "Kalkulus = hard"). Model
  yang menentukan dari data.
- **Jangan ubah urutan GRADE_ORDER** di config — urutan ini dipakai untuk within-1-step
  accuracy dan probability ranking.
- **Jangan commit file .joblib** ke Git — ukurannya besar (50–80 MB). Sudah di-gitignore.
- **Jangan commit file CSV** di data/indonesia/ atau data/processed/ — sudah di-gitignore.
- **Jangan hardcode path** — selalu pakai konstanta dari `configs/config.py`.

---

## Roadmap Berikutnya

1. **PDF Transcript Parser** — `src/data/pdf_parser.py`
   Upload foto/scan transkrip → extract IPK, IPS, nama MK, nilai otomatis
2. **Multi-semester planning** — chain prediksi 2–4 semester sekaligus
3. **Fine-tuning pipeline** — saat user upload transkrip, simpan anonim sebagai data
   training baru → model makin akurat seiring waktu
4. **REST API** — FastAPI endpoint di `src/api/server.py`
5. **Frontend UI** — React / Vue untuk tampilan kombinasi nilai

---

## Catatan Dataset

Dataset saat ini adalah **data sintetis** yang dikalibrasi ke statistik nasional Indonesia:
- 12 jurusan, 139 mata kuliah, ~1.300 mahasiswa
- IPK rata-rata: **3.325** (benchmark Kemdikbudristek 2022: 3.33, error = 0.005)
- Data nilai per MK per mahasiswa dari universitas Indonesia **tidak tersedia publik**
  (privasi akademik). Solusi jangka panjang: crowdsource dari transkrip user.
