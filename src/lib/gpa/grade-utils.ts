/**
 * Grade & IPK utilities.
 * Mirrors Python `src/utils/grade_utils.py`.
 */
import { GRADE_POINTS, GRADE_ORDER } from "./config";

/** Compute IPS (IPS = Indeks Prestasi Semester) for one semester. */
export function computeIps(
  grades: { sks: number; gradePoint: number }[]
): number {
  const totalSks = grades.reduce((s, g) => s + g.sks, 0);
  if (totalSks === 0) return 0;
  const weighted = grades.reduce((s, g) => s + g.sks * g.gradePoint, 0);
  return weighted / totalSks;
}

/** Compute cumulative IPK after adding a new semester.
 * ipk_new = (ipk_old * sks_old + ips_new * sks_new) / (sks_old + sks_new)
 */
export function computeIpk(
  oldIpk: number,
  oldSks: number,
  newIps: number,
  newSks: number
): number {
  const total = oldSks + newSks;
  if (total === 0) return oldIpk;
  return (oldIpk * oldSks + newIps * newSks) / total;
}

/** Map a numeric grade point to the nearest grade label. */
export function gpToGrade(point: number): string {
  let best = GRADE_ORDER[0];
  let bestDist = Math.abs(GRADE_POINTS[best] - point);
  for (const g of GRADE_ORDER) {
    const d = Math.abs(GRADE_POINTS[g] - point);
    if (d < bestDist) {
      best = g;
      bestDist = d;
    }
  }
  return best;
}

/** Get the numeric grade point for a label. */
export function gradeToGp(grade: string): number {
  return GRADE_POINTS[grade.toUpperCase()] ?? 0;
}

/** Within-N-step accuracy: predicted grade vs actual grade within N steps on GRADE_ORDER. */
export function withinNStep(predicted: string, actual: string, n: number = 1): boolean {
  const pi = GRADE_ORDER.indexOf(predicted);
  const ai = GRADE_ORDER.indexOf(actual);
  if (pi < 0 || ai < 0) return false;
  return Math.abs(pi - ai) <= n;
}

/**
 * Normalize a raw grade string from arbitrary input to one of GRADE_ORDER.
 * Handles common variants: "A", "a", "A+", "A-", "AB", "BC", "3.5", numeric ranges, etc.
 * Indonesian universities use A, AB, B, BC, C, D, E (4-point-letter scale) or
 * the A/A-/B+/B/B-/C+/C/C-/D/E 10-class scale. We map everything to the 10-class scale.
 */
export function normalizeGrade(raw: string): { grade: string; gradePoint: number } {
  if (!raw) return { grade: "E", gradePoint: 0 };
  const s = String(raw).trim().toUpperCase().replace(/\s+/g, "");

  // Direct match against GRADE_ORDER (A, A-, B+, B, B-, C+, C, C-, D, E)
  if (GRADE_POINTS[s] !== undefined) {
    return { grade: s, gradePoint: GRADE_POINTS[s] };
  }

  // Indonesian letter combos: AB, BC, CD (map to intermediate)
  const comboMap: Record<string, string> = {
    AB: "A-",
    BC: "B-",
    CD: "C-",
    "A+": "A",
    "B+": "B+",
    "C+": "C+",
    "D+": "C-",
  };
  if (comboMap[s]) {
    const g = comboMap[s];
    return { grade: g, gradePoint: GRADE_POINTS[g] };
  }

  // Numeric grade (0..4 or 0..100)
  const num = Number(s.replace(",", "."));
  if (!isNaN(num)) {
    // 0..100 scale → 0..4
    let gp = num;
    if (num > 4) {
      gp = num >= 80 ? 4 : num >= 75 ? 3.7 : num >= 70 ? 3.3 : num >= 65 ? 3 : num >= 60 ? 2.7 : num >= 55 ? 2.3 : num >= 50 ? 2 : num >= 45 ? 1.7 : num >= 40 ? 1 : 0;
    }
    const g = gpToGrade(gp);
    return { grade: g, gradePoint: GRADE_POINTS[g] };
  }

  // Fuzzy variants
  const fuzzy: Record<string, string> = {
    LULUS: "A",
    PASS: "A",
    TIDAKLULUS: "E",
    GAGAL: "E",
    FAIL: "E",
    K: "E",
    TL: "E",
  };
  if (fuzzy[s]) {
    const g = fuzzy[s];
    return { grade: g, gradePoint: GRADE_POINTS[g] };
  }

  // Unknown — treat as lowest
  return { grade: "E", gradePoint: 0 };
}

/** Compute statistics for a list of grade points (for Model 1 features). */
export function computeStats(values: number[]) {
  const n = values.length;
  if (n === 0) {
    return {
      mean: 0,
      std: 0,
      median: 0,
      iqr: 0,
      pctAOrAbove: 0,
      pctBelowB: 0,
      pctFail: 0,
    };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  const median = n % 2 === 1 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const iqr = q3 - q1;
  const pctAOrAbove = values.filter((v) => v >= 3.7).length / n;
  const pctBelowB = values.filter((v) => v < 3.0).length / n;
  const pctFail = values.filter((v) => v < 1).length / n;
  return { mean, std, median, iqr, pctAOrAbove, pctBelowB, pctFail };
}

/** Median of an array. */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 === 1 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}
