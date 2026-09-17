/**
 * Model 1 — Course Difficulty Clusterer.
 * Pure-TypeScript K-Means clustering on per-course statistical features.
 * Output: difficulty_cluster (0..4), difficulty_label, difficulty_score (0..1).
 *
 * Mirrors Python `src/models/model1_difficulty_clustering.py`.
 */
import { MODEL1_CONFIG } from "./config";
import type { CourseFeatures, ClassifiedCourse, CanonicalCourse } from "./types";

/** Z-score standardize features (fit on training set, reuse means/stds). */
export interface Scaler {
  means: number[];
  stds: number[];
}

export function fitScaler(matrix: number[][]): Scaler {
  const n = matrix.length;
  const d = matrix[0]?.length ?? 0;
  const means = new Array(d).fill(0);
  for (const row of matrix) {
    for (let i = 0; i < d; i++) means[i] += row[i];
  }
  for (let i = 0; i < d; i++) means[i] /= n;
  const stds = new Array(d).fill(0);
  for (const row of matrix) {
    for (let i = 0; i < d; i++) stds[i] += (row[i] - means[i]) ** 2;
  }
  for (let i = 0; i < d; i++) stds[i] = Math.sqrt(stds[i] / n) || 1e-8;
  return { means, stds };
}

export function applyScaler(scaler: Scaler, row: number[]): number[] {
  return row.map((v, i) => (v - scaler.means[i]) / scaler.stds[i]);
}

/** Simple seeded RNG. */
function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** K-Means clustering. */
export function kmeans(
  data: number[][],
  k: number,
  opts: { maxIter?: number; tol?: number; seed?: number } = {}
): { centroids: number[][]; assignments: number[] } {
  const { maxIter = 100, tol = 1e-4, seed = 42 } = opts;
  const n = data.length;
  const d = data[0]?.length ?? 0;
  if (n === 0 || d === 0) return { centroids: [], assignments: [] };
  if (n <= k) {
    // Not enough data — use the data points themselves as centroids.
    const centroids = data.slice(0, k);
    while (centroids.length < k) centroids.push([...data[0]]);
    return { centroids, assignments: data.map((_, i) => Math.min(i, k - 1)) };
  }

  const rng = makeRng(seed);
  // K-means++ init: pick first centroid randomly, then weighted by distance.
  const centroids: number[][] = [];
  centroids.push(data[Math.floor(rng() * n)]);
  for (let c = 1; c < k; c++) {
    const dists = data.map((p) => {
      let best = Infinity;
      for (const cen of centroids) {
        const dd = sqDist(p, cen);
        if (dd < best) best = dd;
      }
      return best;
    });
    const total = dists.reduce((s, v) => s + v, 0);
    let r = rng() * (total || 1);
    let chosen = 0;
    for (let i = 0; i < n; i++) {
      r -= dists[i];
      if (r <= 0) {
        chosen = i;
        break;
      }
      chosen = i;
    }
    centroids.push([...data[chosen]]);
  }

  let assignments = new Array(n).fill(0);
  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    // Assign
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const dd = sqDist(data[i], centroids[c]);
        if (dd < bestD) {
          bestD = dd;
          best = c;
        }
      }
      if (assignments[i] !== best) {
        assignments[i] = best;
        changed = true;
      }
    }
    // Update
    const sums = Array.from({ length: k }, () => new Array(d).fill(0));
    const counts = new Array(k).fill(0);
    for (let i = 0; i < n; i++) {
      const c = assignments[i];
      counts[c]++;
      for (let j = 0; j < d; j++) sums[c][j] += data[i][j];
    }
    let moveDist = 0;
    for (let c = 0; c < k; c++) {
      if (counts[c] === 0) {
        // Reseed empty cluster to a random point
        centroids[c] = [...data[Math.floor(rng() * n)]];
        continue;
      }
      const newCen = sums[c].map((v) => v / counts[c]);
      moveDist += sqDist(centroids[c], newCen);
      centroids[c] = newCen;
    }
    if (moveDist < tol && !changed) break;
    if (!changed) break;
  }

  return { centroids, assignments };
}

function sqDist(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return s;
}

export interface TrainedModel1 {
  scaler: Scaler;
  centroids: number[][];
  clusterOrder: number[]; // ascending difficulty — cluster indices sorted by mean grade point
  labels: string[]; // ordered cluster labels (sangat_mudah..sangat_sulit)
  trainedAt: number;
  sampleCount: number;
}

/**
 * Train Model 1 on course features.
 * Returns the trained model plus the classified course list.
 */
export function trainDifficultyClusterer(
  courses: CourseFeatures[],
  canonicalLookup: Map<string, CanonicalCourse> = new Map()
): { model: TrainedModel1; classified: ClassifiedCourse[] } {
  const features = MODEL1_CONFIG.features;
  const matrix = courses.map((c) =>
    features.map((f) => {
      switch (f) {
        case "mean_grade_point": return c.meanGradePoint;
        case "std_grade_point": return c.stdGradePoint;
        case "pct_a_or_above": return c.pctAOrAbove;
        case "pct_below_b": return c.pctBelowB;
        case "pct_fail": return c.pctFail;
        case "median_grade_point": return c.medianGradePoint;
        case "iqr_grade_point": return c.iqrGradePoint;
        case "mean_ips_takers": return c.meanIpsTakers;
        default: return 0;
      }
    })
  );

  if (matrix.length === 0) {
    // No data — return an empty model with default centroids.
    const zero = new Array(features.length).fill(0);
    return {
      model: {
        scaler: { means: zero.slice(), stds: new Array(features.length).fill(1) },
        centroids: Array.from({ length: MODEL1_CONFIG.k }, () => zero.slice()),
        clusterOrder: MODEL1_CONFIG.difficultyLabels.map((_, i) => i),
        labels: MODEL1_CONFIG.difficultyLabels.slice() as unknown as string[],
        trainedAt: Date.now(),
        sampleCount: 0,
      },
      classified: [],
    };
  }

  const scaler = fitScaler(matrix);
  const scaled = matrix.map((r) => applyScaler(scaler, r));
  const { centroids, assignments } = kmeans(scaled, MODEL1_CONFIG.k, {
    maxIter: MODEL1_CONFIG.maxIterations,
    tol: MODEL1_CONFIG.tolerance,
    seed: MODEL1_CONFIG.seed,
  });

  // Sort clusters ascending by mean grade point of their members — cluster with
  // the LOWEST mean grade point is the HARDEST course (sangat_sulit).
  const clusterMeanGp: number[] = new Array(MODEL1_CONFIG.k).fill(0).map((_, c) => {
    const members = scaled.filter((_, i) => assignments[i] === c);
    if (members.length === 0) return 0;
    const meanFeature0 = members.reduce((s, m) => s + m[0], 0) / members.length;
    // convert standardized mean back to raw mean_grade_point for ordering
    return scaler.means[0] + meanFeature0 * scaler.stds[0];
  });
  // clusterOrder[0] = cluster with highest mean grade point (easiest) → sangat_mudah
  // clusterOrder[k-1] = cluster with lowest mean grade point (hardest) → sangat_sulit
  const clusterOrder = clusterMeanGp
    .map((v, i) => ({ v, i }))
    .sort((a, b) => b.v - a.v) // descending → easiest first
    .map((x) => x.i);

  const labels = [...MODEL1_CONFIG.difficultyLabels] as string[];

  const classified: ClassifiedCourse[] = courses.map((c, idx) => {
    const clusterIdx = assignments[idx];
    const rank = clusterOrder.indexOf(clusterIdx); // 0=easiest, k-1=hardest
    const label = labels[rank] as ClassifiedCourse["difficultyLabel"];
    // difficulty_score: normalized rank → 0 (easiest) .. 1 (hardest)
    const difficultyScore = MODEL1_CONFIG.k > 1 ? rank / (MODEL1_CONFIG.k - 1) : 0.5;
    const canonical = canonicalLookup.get(c.courseName);
    return {
      courseName: c.courseName,
      major: c.major,
      difficultyCluster: clusterIdx,
      difficultyLabel: label,
      difficultyScore: Math.round(difficultyScore * 100) / 100,
      features: c,
      typicalDifficulty: canonical?.typicalDifficulty ?? 0.5,
    };
  });

  return {
    model: { scaler, centroids, clusterOrder, labels, trainedAt: Date.now(), sampleCount: courses.length },
    classified,
  };
}

/** Predict difficulty for a single course using a trained Model 1. */
export function predictDifficulty(model: TrainedModel1, course: CourseFeatures): {
  cluster: number;
  label: ClassifiedCourse["difficultyLabel"];
  score: number;
} {
  const features = MODEL1_CONFIG.features;
  const row = features.map((f) => {
    switch (f) {
      case "mean_grade_point": return course.meanGradePoint;
      case "std_grade_point": return course.stdGradePoint;
      case "pct_a_or_above": return course.pctAOrAbove;
      case "pct_below_b": return course.pctBelowB;
      case "pct_fail": return course.pctFail;
      case "median_grade_point": return course.medianGradePoint;
      case "iqr_grade_point": return course.iqrGradePoint;
      case "mean_ips_takers": return course.meanIpsTakers;
      default: return 0;
    }
  });
  const scaled = applyScaler(model.scaler, row);
  let best = 0;
  let bestD = Infinity;
  for (let c = 0; c < model.centroids.length; c++) {
    const d = sqDist(scaled, model.centroids[c]);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  const rank = model.clusterOrder.indexOf(best);
  const label = model.labels[rank] as ClassifiedCourse["difficultyLabel"];
  const score = model.centroids.length > 1 ? rank / (model.centroids.length - 1) : 0.5;
  return { cluster: best, label, score: Math.round(score * 100) / 100 };
}
