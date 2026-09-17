# DATASET — Tantangan & Strategi Akuisisi Data

## 📌 Situasi Saat Ini

Dataset yang digunakan untuk training model adalah **100% sintetis** — dihasilkan
oleh kode (`mini-services/ml-service/src/generate_dataset.py`) dengan kalibrasi
ke statistik nasional Indonesia.

### Mengapa Tidak Pakai Data Real?

1. **Privasi akademik**: Data transkrip nilai mahasiswa Indonesia tidak tersedia
   publik. Diatur oleh UU Perlindungan Data Pribadi (UU PDP No. 27/2022) dan
   regulasi kampus masing-masing.

2. **Tidak ada open dataset**: Tidak ada repository publik (Kaggle, UCI, dll.)
   yang berisi data transkrip mahasiswa Indonesia dengan format:
   `mata_kuliah × jurusan × nilai × SKS × semester`.

3. **Variasi format**: Setiap kampus punya format transkrip berbeda (SIAKAD,
   SIAK, SIMAK, dll.) — tidak ada standardisasi.

### Karakteristik Dataset Sintetis Saat Ini

| Parameter | Nilai | Sumber Kalibrasi |
|-----------|-------|-----------------|
| Total rows | 5.000 | - |
| Mahasiswa | 211 | - |
| Jurusan | 12 | Daftar jurusan populer Indonesia |
| Mata kuliah | 52 | Katalog kanonik (CANONICAL_COURSES) |
| Mean grade point | 3.604 | Benchmark Kemdikbudristek 2022: ~3.33 |
| Train/test split | 80/20 | By student (3866/1134) |

> ⚠️ Mean GP sintetis (3.604) lebih tinggi dari benchmark nasional (3.33)
> karena generator terlalu optimis. Perlu kalibrasi ulang.

---

## 🔍 Sumber Data Potensial

### 1. Open Academic Datasets (Internasional)

Dataset dari negara lain yang BISA diadaptasi ke skala Indonesia:

| Dataset | Sumber | Format | Adaptasi |
|---------|--------|--------|----------|
| Student Performance (UCI) | UCI ML Repository | Math + Portuguese grades (0-20) | Map 0-20 → 0-4 scale |
| Student Academic Performance | Kaggle | Math, Reading, Science scores | Map percentiles → grades |
| Predict students' dropout | UCI | Academic performance + demographics | Map pass/fail → grade |
| Student Habits & Academic Performance | Kaggle | Study habits + GPA | Use as feature reference |

**Cara adaptasi:**
```python
# Example: UCI Student Performance (Portugal, 0-20 scale)
# Map to Indonesian 10-class scale:
def convert_20_to_indo(score):
    if score >= 18: return "A"      # 4.0
    if score >= 16: return "A-"     # 3.7
    if score >= 14: return "B+"     # 3.3
    if score >= 12: return "B"      # 3.0
    if score >= 10: return "B-"     # 2.7
    if score >= 8:  return "C+"     # 2.3
    if score >= 6:  return "C"      # 2.0
    if score >= 4:  return "C-"    # 1.7
    if score >= 2:  return "D"      # 1.0
    return "E"                      # 0.0
```

### 2. Crowdsourcing (User-Contributed)

**Mekanisme**: Saat user menggunakan aplikasi dan menginput transkrip mereka,
data tersebut (anonimized) dapat disimpan untuk meningkatkan model.

**Yang dikumpulkan** (HANYA data akademik, TANPA identitas):
- `jurusan` (umum, bukan kampus spesifik)
- `semester_ke`
- `mata_kuliah` (setelah normalisasi)
- `sks`
- `nilai` (sudah dinormalisasi ke skala 10 kelas)
- `bobot_nilai`

**Yang TIDAK dikumpulkan**:
- Nama mahasiswa
- NIM
- Nama kampus/universitas
- Data pribadi apapun

**Implementasi**: `POST /api/gpa/contribute-data` (lihat di bawah)

### 3. Statistik Agregat Publik

Sumber yang BISA digunakan untuk kalibrasi (bukan training langsung):

| Sumber | Data | URL |
|--------|------|-----|
| Kemdikbudristek | Statistik IPK rata-rata nasional | https://statistik.kemdikbud.go.id |
| BPS | Data pendidikan tinggi | https://www.bps.go.id |
| Pangkat PT | Akreditasi & statistik kampus | https://pddikti.kemdikbud.go.id |

---

## 🛠️ Strategi Implementasi

### Fase 1: Perbaiki Dataset Sintetis (SAAT INI)

1. ✅ Generator data sintetis dengan 5k rows
2. ⬜ Kalibrasi mean GP ke 3.33 (saat ini 3.604 — terlalu tinggi)
3. ⬜ Tambah korelasi antar mata kuliah (saat ini independen)
4. ⬜ Tambah tren semester (saat ini ability statis)

### Fase 2: Crowdsourcing (IMPLEMENTASI)

1. ✅ Endpoint `POST /api/gpa/contribute-data` untuk menerima data anonim
2. ⬜ Validasi data otomatis (range, konsistensi, deteksi anomali)
3. ⬜ Storage: `data/crowdsourced/contributed_transcripts.csv`
4. ⬜ Privacy: strip semua identitas sebelum simpan
5. ⬜ Opt-in: user harus centang "Saya setuju berbagi data anonim"

### Fase 3: Integrasi Data Real (MASA DEPAN)

1. ⬜ Saat crowdsourced data mencapai 500+ records → retrain model
2. ⬜ Blend: 70% real + 30% synthetic (untuk coverage mata kuliah)
3. ⬜ Evaluasi: bandingkan akurasi model sintetis vs real
4. ⬜ Fine-tuning: retrain saat data baru ditambahkan

---

## 📊 Quality Metrics untuk Data

Setiap record yang dikontribusi akan divalidasi:

```
✅ Valid:
- 1 ≤ SKS ≤ 8
- Grade in {A, A-, B+, B, B-, C+, C, C-, D, E}
- 1 ≤ semester ≤ 14
- jurusan tidak kosong
- mata_kuliah tidak kosong

❌ Ditolak:
- SKS > 8 atau < 1
- Grade tidak dikenali
- Semester > 14
- Data duplikat (course + semester yang sama)
- Pola spam (banyak record identik)
```

---

## 🔒 Privacy & Compliance

- **UU PDP No. 27/2022**: Data yang dikumpulkan adalah data akademik non-identitas
- **Anonimisasi**: Tidak ada nama, NIM, atau nama kampus yang disimpan
- **Opt-in**: User harus secara aktif menyetujui berbagi data
- **Hak hapus**: User dapat meminta data mereka dihapus
- **Transparansi**: User dapat melihat data apa yang dikumpulkan (lihat DATASET.md ini)
