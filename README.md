# Indeks-Prestasi-Machine-Not-Learn
# 🎓 IPK Optimizer — GPA Planning & Recommendation Engine

## 📌 Overview

IPK Optimizer adalah sistem berbasis Python yang dirancang untuk membantu mahasiswa merencanakan strategi akademik guna mencapai target IPK (misalnya ≥ 3.6 / cumlaude).

Berbeda dengan model machine learning tradisional yang hanya melakukan prediksi, sistem ini menggabungkan:

* 📊 **Data-driven prediction** (estimasi nilai)
* 🧮 **GPA simulation engine** (perhitungan IPK masa depan)
* 🧠 **Decision-based recommendation** (kombinasi nilai optimal)

Pendekatan ini memungkinkan sistem memberikan saran yang **realistis, terukur, dan dapat dieksekusi**.

---

## 🎯 Objectives

* Menghitung IPK berdasarkan histori akademik
* Memprediksi performa nilai di mata kuliah mendatang
* Mensimulasikan berbagai skenario nilai
* Memberikan rekomendasi strategis untuk mencapai target IPK

---

## 🧠 Core Concept

Sistem dibangun sebagai **Hybrid Decision System**, terdiri dari:

1. **Regression Model**

   * Memprediksi nilai berdasarkan:

     * tingkat kesulitan mata kuliah
     * SKS
     * histori mahasiswa

2. **Simulation Engine**

   * Menghitung IPK masa depan berdasarkan kombinasi nilai

3. **Constraint System**

   * Membatasi nilai berdasarkan difficulty (realistic modeling)

4. **Recommendation Engine**

   * Menghasilkan strategi akademik optimal

---

## 🏗️ Project Structure

```
./
│
├── data/
│   ├── raw/
│   └── processed/
│
├── src/
│   ├── data_loader.py
│   ├── preprocessing.py
│   ├── feature_engineering.py
│   ├── model.py
│   ├── simulator.py
│   ├── recommender.py
│   └── main.py
│
├── notebooks/
├── requirements.txt
└── README.md
```

---

## ⚙️ Tech Stack

* Python 3.10+
* pandas
* numpy
* scikit-learn
* pydantic (data validation)
* rich (CLI visualization)

---

## 🚀 How It Works

1. Load dataset mahasiswa & mata kuliah
2. Preprocess data (encoding difficulty, feature engineering)
3. Train regression model untuk estimasi nilai
4. Jalankan simulator IPK
5. Generate rekomendasi berdasarkan constraint & hasil simulasi

---

## 📊 Example Output

```
🎯 Target IPK: 3.6
📊 Current IPK: 3.2

📌 Predicted Performance:
- Kalkulus II → 2.8
- Fisika → 2.9
- Pancasila → 3.7

📌 Recommendation:
- Maksimalkan nilai pada mata kuliah easy (target A)
- Pertahankan minimal B pada mata kuliah hard
- Hindari nilai C untuk menjaga IPK stabil
```

---

## ⚠️ Limitations

* Model awal masih menggunakan regresi linear sederhana
* Belum sepenuhnya personalized (akan dikembangkan)
* Dataset awal masih bersifat sintetis

---

## 🧩 Roadmap

* [x] Tambah model yang lebih advanced (XGBoost / ensemble)
* [x] Implementasi kombinasi nilai otomatis (optimization engine)
* [x] Integrasi API menggunakan FastAPI
* [x] Integrasi frontend (React)
* [ ] Personalisasi berbasis histori mahasiswa

---

## 🛠️ Installation

### Python ML Service (uv)

```bash
cd mini-services/ml-service
uv sync
uv run python src/generate_dataset.py
uv run python src/train_models.py
```

### Next.js Frontend

```bash
npm install
npm run dev
```

---

## ▶️ Run Project

### Web App (Next.js)

```bash
npm run dev
```

Buka http://localhost:3000

### Python ML Models (standalone)

```bash
cd mini-services/ml-service
uv run python src/train_models.py
```

---

## 📁 Current Architecture

```
./
├── mini-services/
│   └── ml-service/           # Python ML service (scikit-learn + uv)
│       ├── src/
│       │   ├── generate_dataset.py   # 5k row dataset generator
│       │   └── train_models.py       # Train K-Means + LogReg + RandomForest
│       ├── optimize_cli.py           # CLI for inference (subprocess)
│       ├── data/dataset.csv          # 5000 rows, 211 students
│       └── models/                   # Trained .joblib models
│
├── src/
│   ├── lib/gpa/              # TypeScript ML library (normalization, IPK math)
│   ├── app/
│   │   ├── page.tsx          # Main page (3 tabs: Optimasi / Simulator / Streak)
│   │   └── api/gpa/          # API routes (proxy to Python subprocess)
│   ├── components/gpa/       # 30+ UI components (charts, dialogs, trackers)
│   └── hooks/                # useLocalStorage, useComparisonStore
│
├── prisma/
├── worklog.md
└── package.json
```

---

## 🤖 ML Models

3 models trained on the same 5000-row dataset (80/20 train/test split):

| Model | Type | Exact Acc | Within-1-Step | Top-3 |
|-------|------|-----------|---------------|-------|
| K-Means | Unsupervised | N/A | N/A | N/A |
| Logistic Regression | Supervised | 48.3% | 75.0% | 87.1% |
| Random Forest | Supervised | 43.5% | 72.0% | 83.7% |

---

## 📌 Future Vision

Mengembangkan sistem ini menjadi:

> **Academic Decision Support System berbasis AI**

yang dapat membantu mahasiswa mengambil keputusan akademik secara strategis dan berbasis data.
