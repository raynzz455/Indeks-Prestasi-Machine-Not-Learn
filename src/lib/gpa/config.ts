/**
 * GPA Optimizer — central configuration (single source of truth).
 * Mirrors the Python `configs/config.py` from the reference repo.
 */

// ── Indonesian 10-class grade scale ───────────────────────────────────────────
export const GRADE_POINTS: Record<string, number> = {
  A: 4.0,
  "A-": 3.7,
  "B+": 3.3,
  B: 3.0,
  "B-": 2.7,
  "C+": 2.3,
  C: 2.0,
  "C-": 1.7,
  D: 1.0,
  E: 0.0,
};

// Ordered list — DO NOT change order; used for within-1-step accuracy & ranking.
export const GRADE_ORDER: string[] = [
  "A",
  "A-",
  "B+",
  "B",
  "B-",
  "C+",
  "C",
  "C-",
  "D",
  "E",
];

export const SCENARIOS = ["santai", "serius", "keras", "maksimal"] as const;
export type ScenarioName = (typeof SCENARIOS)[number];

export const SCENARIO_ENCODING: Record<ScenarioName, number> = {
  santai: 0,
  serius: 1,
  keras: 2,
  maksimal: 3,
};

export const SCENARIO_META: Record<
  ScenarioName,
  { label: string; description: string; color: string; effortMultiplier: number }
> = {
  santai: {
    label: "Santai",
    description: "Usaha normal, target realistis. Fokus pada mata kuliah yang mudah.",
    color: "emerald",
    effortMultiplier: 0.55,
  },
  serius: {
    label: "Serius",
    description: "Fokus, di atas rata-rata. Jaga konsistensi belajar.",
    color: "sky",
    effortMultiplier: 0.75,
  },
  keras: {
    label: "Keras",
    description: "Standar tinggi, konsisten, banyak latihan soal.",
    color: "amber",
    effortMultiplier: 0.9,
  },
  maksimal: {
    label: "Maksimal",
    description: "All-out, target A di hampir semua mata kuliah.",
    color: "rose",
    effortMultiplier: 1.0,
  },
};

// ── IPK delta filter — only show combinations with meaningful, realistic gain ──
export const IPK_DELTA = {
  minMeaningful: 0.01,
  maxRealistic: 0.5,
};

// ── Model 1 (K-Means difficulty clustering) config ────────────────────────────
export const MODEL1_CONFIG = {
  k: 5, // sangat_mudah, mudah, medium, sulit, sangat_sulit
  maxIterations: 100,
  tolerance: 1e-4,
  seed: 42,
  difficultyLabels: ["sangat_mudah", "mudah", "medium", "sulit", "sangat_sulit"] as const,
  features: [
    "mean_grade_point",
    "std_grade_point",
    "pct_a_or_above",
    "pct_below_b",
    "pct_fail",
    "median_grade_point",
    "iqr_grade_point",
    "mean_ips_takers",
  ] as const,
};

// ── Model 2 (grade distribution predictor) config ─────────────────────────────
export const MODEL2_CONFIG = {
  features: [
    "difficulty_score",
    "difficulty_cluster",
    "ipk_before",
    "ips_last_semester",
    "ips_trend",
    "total_sks_completed",
    "course_sks",
    "semester_number",
    "scenario_encoded",
    "major_encoded",
    "mean_ips_takers",
    "pct_a_or_above",
    "pct_below_b",
  ] as const,
};

// ── Indonesian majors used for synthetic data + encoding ──────────────────────
export const MAJORS = [
  "Teknik Informatika",
  "Sistem Informasi",
  "Teknik Sipil",
  "Teknik Mesin",
  "Teknik Elektro",
  "Manajemen",
  "Akuntansi",
  "Ilmu Komunikasi",
  "Hukum",
  "Kedokteran",
  "Farmasi",
  "Biologi",
] as const;

export interface CanonicalCourse {
  name: string;
  aliases: string[];
  category: string;
  defaultSks: number;
  typicalDifficulty: number;
}

export const CANONICAL_COURSES: CanonicalCourse[] = [
  // ── Matematika & Dasar ──
  { name: "Kalkulus I", aliases: ["kalkulus 1", "kalkulus i", "calculus 1", "matematika i"], category: "Matematika", defaultSks: 3, typicalDifficulty: 0.65 },
  { name: "Kalkulus II", aliases: ["kalkulus 2", "kalkulus ii", "calculus 2", "matematika ii", "kalkulus lanjut"], category: "Matematika", defaultSks: 3, typicalDifficulty: 0.78 },
  { name: "Kalkulus III", aliases: ["kalkulus 3", "kalkulus iii", "calculus 3", "matematika iii", "kalkulus lanjut 2"], category: "Matematika", defaultSks: 3, typicalDifficulty: 0.88 },
  { name: "Aljabar Linear", aliases: ["aljabar linear elementer", "matriks", "linear algebra"], category: "Matematika", defaultSks: 3, typicalDifficulty: 0.62 },
  { name: "Matematika Diskrit", aliases: ["matdisk", "diskrit", "discrete math", "matematika diskrit 1"], category: "Matematika", defaultSks: 3, typicalDifficulty: 0.58 },
  { name: "Statistika", aliases: ["statistik", "statistika dasar", "probabilitas dan statistika", "probstat"], category: "Matematika", defaultSks: 3, typicalDifficulty: 0.55 },
  { name: "Statistika Inferensial", aliases: ["statistik inferensial", "statistika 2", "statistika lanjut"], category: "Matematika", defaultSks: 3, typicalDifficulty: 0.7 },
  { name: "Pengantar Matematika", aliases: ["matematika dasar", "matematika umum", "pengantar matematika umum"], category: "Matematika", defaultSks: 2, typicalDifficulty: 0.3 },

  // ── Pemrograman & Informatika ──
  { name: "Algoritma dan Pemrograman", aliases: ["alprog", "algoritma pemrograman", "pemrograman dasar", "dasar pemrograman", "introduction to programming"], category: "Informatika", defaultSks: 4, typicalDifficulty: 0.6 },
  { name: "Struktur Data", aliases: ["strukdat", "struktur data dan algoritma", "data structure"], category: "Informatika", defaultSks: 3, typicalDifficulty: 0.72 },
  { name: "Pemrograman Berorientasi Objek", aliases: ["pbo", "oop", "pemrograman objek", "object oriented programming"], category: "Informatika", defaultSks: 3, typicalDifficulty: 0.66 },
  { name: "Basis Data", aliases: ["database", "db", "sistem basis data", "sdb"], category: "Informatika", defaultSks: 3, typicalDifficulty: 0.58 },
  { name: "Sistem Operasi", aliases: ["sos", "os", "sistem operasi komputer", "operating system"], category: "Informatika", defaultSks: 3, typicalDifficulty: 0.74 },
  { name: "Jaringan Komputer", aliases: ["jarkom", "jaringan", "computer network", "data communication"], category: "Informatika", defaultSks: 3, typicalDifficulty: 0.68 },
  { name: "Rekayasa Perangkat Lunak", aliases: ["rpl", "software engineering", "rekayasa perangkat lunak 1"], category: "Informatika", defaultSks: 3, typicalDifficulty: 0.6 },
  { name: "Pemrograman Web", aliases: ["web", "pemweb", "web programming", "pemrograman web 1"], category: "Informatika", defaultSks: 3, typicalDifficulty: 0.5 },
  { name: "Kecerdasan Buatan", aliases: ["ai", "artificial intelligence", "kecerdasan buatan 1", "sistem cerdas"], category: "Informatika", defaultSks: 3, typicalDifficulty: 0.82 },
  { name: "Pembelajaran Mesin", aliases: ["machine learning", "ml", "pembelajaran mesin 1"], category: "Informatika", defaultSks: 3, typicalDifficulty: 0.85 },
  { name: "Pemrograman Mobile", aliases: ["mobile", "pemrograman mobile 1", "android", "mobile programming"], category: "Informatika", defaultSks: 3, typicalDifficulty: 0.55 },
  { name: "Sistem Basis Data Lanjut", aliases: ["sbd lanjut", "database lanjut", "db lanjut"], category: "Informatika", defaultSks: 3, typicalDifficulty: 0.7 },
  { name: "Grafika Komputer", aliases: ["komgraf", "computer graphics", "grafika"], category: "Informatika", defaultSks: 3, typicalDifficulty: 0.68 },

  // ── Fisika ──
  { name: "Fisika Dasar I", aliases: ["fisika 1", "fisika dasar 1", "physics 1", "fisika i"], category: "Fisika", defaultSks: 3, typicalDifficulty: 0.62 },
  { name: "Fisika Dasar II", aliases: ["fisika 2", "fisika dasar 2", "physics 2", "fisika ii", "listrik magnet"], category: "Fisika", defaultSks: 3, typicalDifficulty: 0.72 },
  { name: "Fisika", aliases: ["fisika umum", "pengantar fisika"], category: "Fisika", defaultSks: 3, typicalDifficulty: 0.55 },

  // ── Kimia ──
  { name: "Kimia Dasar", aliases: ["kimia 1", "kimia dasar 1", "chemistry", "kimia umum"], category: "Kimia", defaultSks: 3, typicalDifficulty: 0.55 },
  { name: "Kimia Organik", aliases: ["kimia organik 1", "organic chemistry"], category: "Kimia", defaultSks: 3, typicalDifficulty: 0.78 },

  // ── Bisnis & Sosial ──
  { name: "Pengantar Ekonomi", aliases: ["pengantar ilmu ekonomi", "ekonomi dasar", "pie", "principles of economics"], category: "Ekonomi", defaultSks: 3, typicalDifficulty: 0.45 },
  { name: "Manajemen", aliases: ["manajemen umum", "pengantar manajemen", "management"], category: "Bisnis", defaultSks: 3, typicalDifficulty: 0.42 },
  { name: "Akuntansi Keuangan", aliases: ["akuntansi dasar", "akuntansi 1", "financial accounting", "pengantar akuntansi"], category: "Akuntansi", defaultSks: 3, typicalDifficulty: 0.58 },
  { name: "Akuntansi Manajerial", aliases: ["akuntansi manajemen", "manajerial", "management accounting"], category: "Akuntansi", defaultSks: 3, typicalDifficulty: 0.62 },
  { name: "Pemasaran", aliases: ["marketing", "pemasaran 1", "dasar pemasaran"], category: "Bisnis", defaultSks: 3, typicalDifficulty: 0.4 },
  { name: "Perilaku Organisasi", aliases: ["po", "organizational behavior", "tingkah laku organisasi"], category: "Bisnis", defaultSks: 3, typicalDifficulty: 0.45 },

  // ── Sosial & Humaniora ──
  { name: "Pancasila", aliases: ["pendidikan pancasila", "pancasila dan kewarganegaraan", "pkn"], category: "Wajib", defaultSks: 2, typicalDifficulty: 0.18 },
  { name: "Kewarganegaraan", aliases: ["kwn", "pendidikan kewarganegaraan", "civics"], category: "Wajib", defaultSks: 2, typicalDifficulty: 0.2 },
  { name: "Agama", aliases: ["pendidikan agama", "agama islam", "pendidikan agama islam", "religious education"], category: "Wajib", defaultSks: 2, typicalDifficulty: 0.22 },
  { name: "Bahasa Indonesia", aliases: ["b_indonesia", "bhs indonesia", "bahasa indonesia keilmuan", "indonesian language"], category: "Wajib", defaultSks: 2, typicalDifficulty: 0.25 },
  { name: "Bahasa Inggris", aliases: ["english", "b_inggris", "bhs inggris", "english language"], category: "Wajib", defaultSks: 2, typicalDifficulty: 0.3 },
  { name: "Kewirausahaan", aliases: ["entrepreneurship", "wiraswasta", "kewirausahaan 1"], category: "Wajib", defaultSks: 2, typicalDifficulty: 0.35 },
  { name: "Metodologi Penelitian", aliases: ["metopen", "metode penelitian", "research methodology", "metodologi penelitian 1"], category: "Umum", defaultSks: 2, typicalDifficulty: 0.4 },
  { name: "Etika Profesi", aliases: ["etika", "professional ethics", "etika profesional"], category: "Umum", defaultSks: 2, typicalDifficulty: 0.3 },
  { name: "Seminar", aliases: ["seminar proposal", "seminar penelitian", "seminar 1"], category: "Umum", defaultSks: 1, typicalDifficulty: 0.25 },
  { name: "Kerja Praktik", aliases: ["kp", "magang", "internship", "praktek kerja lapangan"], category: "Umum", defaultSks: 3, typicalDifficulty: 0.25 },
  { name: "Skripsi", aliases: ["tugas akhir", "ta", "thesis", "karya ilmiah"], category: "Umum", defaultSks: 6, typicalDifficulty: 0.6 },

  // ── Kedokteran / Sains ──
  { name: "Anatomi", aliases: ["anatomi manusia", "anatomy", "anatomi 1"], category: "Kedokteran", defaultSks: 4, typicalDifficulty: 0.85 },
  { name: "Fisiologi", aliases: ["fisiologi manusia", "physiology", "fisio"], category: "Kedokteran", defaultSks: 4, typicalDifficulty: 0.82 },
  { name: "Biokimia", aliases: ["biokimia 1", "biochemistry", "biokimia medik"], category: "Kedokteran", defaultSks: 3, typicalDifficulty: 0.88 },
  { name: "Farmakologi", aliases: ["farmakologi 1", "pharmacology", "farmako"], category: "Farmasi", defaultSks: 4, typicalDifficulty: 0.85 },
  { name: "Mikrobiologi", aliases: ["mikrobiologi 1", "microbiology", "mikro"], category: "Sains", defaultSks: 3, typicalDifficulty: 0.78 },
  { name: "Genetika", aliases: ["genetika 1", "genetics"], category: "Sains", defaultSks: 3, typicalDifficulty: 0.75 },
  { name: "Botani", aliases: ["botani 1", "botany"], category: "Sains", defaultSks: 3, typicalDifficulty: 0.6 },
  { name: "Zoologi", aliases: ["zoologi 1", "zoology", "keanekaragaman hewan"], category: "Sains", defaultSks: 3, typicalDifficulty: 0.58 },

  // ── Hukum / Komunikasi ──
  { name: "Pengantar Ilmu Hukum", aliases: ["pih", "introduction to law", "hukum 1", "pengantar hukum"], category: "Hukum", defaultSks: 3, typicalDifficulty: 0.5 },
  { name: "Hukum Perdata", aliases: ["hukum perdata 1", "civil law", "perdata"], category: "Hukum", defaultSks: 3, typicalDifficulty: 0.62 },
  { name: "Hukum Pidana", aliases: ["hukum pidana 1", "criminal law", "pidana"], category: "Hukum", defaultSks: 3, typicalDifficulty: 0.65 },
  { name: "Komunikasi Massa", aliases: ["kom massa", "mass communication", "mass comm"], category: "Komunikasi", defaultSks: 3, typicalDifficulty: 0.4 },
  { name: "Komunikasi Organisasi", aliases: ["kom organisasi", "organizational communication"], category: "Komunikasi", defaultSks: 3, typicalDifficulty: 0.42 },
];
