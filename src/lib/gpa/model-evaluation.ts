/**
 * Model evaluation metrics for the GPA Optimizer ML models.
 *
 * Model 1 (K-Means): silhouette score, cluster distribution, inertia.
 * Model 2 (Logistic Regression): accuracy, within-1-step accuracy, top-3 accuracy,
 *   confusion matrix, per-class precision/recall.
 *
 * All metrics are computed on a held-out test set (train/test split).
 */
import { GRADE_ORDER, GRADE_POINTS } from "./config";
import { generateSynthetic, type SyntheticRecord } from "./training-data";
import { buildCourseFeatures, buildStudentFeatures, encodeMajors } from "./feature-engineering";
import { trainDifficultyClusterer, predictDifficulty, type TrainedModel1 } from "./kmeans";
import { trainGradePredictor, predictGradeDistribution, type TrainedModel2, buildFeatureRow } from "./grade-predictor";
import { computeIps, normalizeGrade } from "./grade-utils";
import type { StudentCourseFeatures, CourseFeatures, ClassifiedCourse } from "./types";

export interface ModelEvaluation {
  model1: {
    name: string;
    silhouette: number;
    inertia: number;
    clusterSizes: number[];
    clusterLabels: string[];
    testSize: number;
    trainSize: number;
    description: string;
  };
  model2: {
    name: string;
    exactAccuracy: number;
    within1StepAccuracy: number;
    within2StepAccuracy: number;
    top3Accuracy: number;
    confusionMatrix: number[][];
    gradeOrder: string[];
    perClassPrecision: number[];
    perClassRecall: number[];
    testSize: number;
    trainSize: number;
    description: string;
  };
  dataset: {
    totalRecords: number;
    students: number;
    majors: number;
    courses: number;
    meanIpk: number;
    splitRatio: string;
  };
  evaluatedAt: number;
}

/**
 * Run full model evaluation with train/test split.
 * Returns metrics for both Model 1 and Model 2.
 */
export function evaluateModels(): ModelEvaluation {
  // Generate full dataset
  const synthetic = generateSynthetic(1000, 42);
  const totalRecords = synthetic.length;
  const studentSet = new Set(synthetic.map((r) => r.studentId));
  const studentCount = studentSet.size;
  const majorSet = new Set(synthetic.map((r) => r.major));
  const majorCount = majorSet.size;
  const courses = new Set(synthetic.map((r) => r.courseName)).size;
  const allGps = synthetic.map((r) => r.gradePoint);
  const meanIpk = allGps.reduce((s, g) => s + g, 0) / allGps.length;

  // Convert to raw records
  const raw = synthetic.map((r) => ({
    studentId: r.studentId,
    major: r.major,
    semesterNumber: r.semesterNumber,
    courseName: r.courseName,
    sks: r.sks,
    grade: r.grade,
    gradePoint: r.gradePoint,
  }));

  // ── Model 1: K-Means ──────────────────────────────────────────────
  // Train on all course features (unsupervised, so no train/test split for clustering)
  const courseFeatures = buildCourseFeatures(raw);
  const { model: m1, classified } = trainDifficultyClusterer(courseFeatures);

  // Evaluate: silhouette score + inertia
  const silhouette = computeSilhouette(courseFeatures, classified, m1);
  const inertia = computeInertia(courseFeatures, m1);
  const clusterSizes = classified.reduce((acc, c) => {
    acc[c.difficultyCluster] = (acc[c.difficultyCluster] ?? 0) + 1;
    return acc;
  }, [] as number[]);

  // ── Model 2: Logistic Regression ─────────────────────────────────
  // Train/test split: 80/20 by student
  const studentIds = [...studentSet];
  const shuffled = shuffle(studentIds, 123);
  const splitIdx = Math.floor(shuffled.length * 0.8);
  const trainStudents = new Set(shuffled.slice(0, splitIdx));
  const testStudents = new Set(shuffled.slice(splitIdx));

  const trainRaw = raw.filter((r) => trainStudents.has(r.studentId));
  const testRaw = raw.filter((r) => testStudents.has(r.studentId));

  // Build features
  const trainFeatures = buildCourseFeatures(trainRaw);
  const { classified: trainClassified } = trainDifficultyClusterer(trainFeatures);
  const trainLookup = new Map<string, ClassifiedCourse>();
  for (const c of trainClassified) trainLookup.set(c.courseName, c);
  const majorEncoding = encodeMajors([...majorSet]);

  // Build student course features for training
  const trainRows = buildStudentFeatures(trainRaw);
  const testRows = buildStudentFeatures(testRaw);

  // Train Model 2 on train set
  const m2 = trainGradePredictor(trainRows);

  // Evaluate on test set
  const predictions = testRows.map((row) => {
    const dist = predictGradeDistribution(m2, row);
    // Pick the grade with highest probability
    let bestGrade = 0;
    let bestProb = 0;
    for (let i = 0; i < GRADE_ORDER.length; i++) {
      const p = dist[GRADE_ORDER[i]] ?? 0;
      if (p > bestProb) {
        bestProb = p;
        bestGrade = i;
      }
    }
    return { actual: row.gradeClass, predicted: bestGrade, distribution: dist };
  });

  // Exact accuracy
  const exactCorrect = predictions.filter((p) => p.actual === p.predicted).length;
  const exactAccuracy = exactCorrect / predictions.length;

  // Within-1-step accuracy (±1 grade step)
  const within1 = predictions.filter((p) => Math.abs(p.actual - p.predicted) <= 1).length;
  const within1StepAccuracy = within1 / predictions.length;

  // Within-2-step accuracy
  const within2 = predictions.filter((p) => Math.abs(p.actual - p.predicted) <= 2).length;
  const within2StepAccuracy = within2 / predictions.length;

  // Top-3 accuracy (is the actual grade in the top-3 predicted?)
  const top3Correct = predictions.filter((p) => {
    const sorted = GRADE_ORDER.map((g, i) => ({ g, i, p: p.distribution[g] ?? 0 }))
      .sort((a, b) => b.p - a.p)
      .slice(0, 3)
      .map((x) => x.i);
    return sorted.includes(p.actual);
  }).length;
  const top3Accuracy = top3Correct / predictions.length;

  // Confusion matrix (10×10)
  const nClasses = GRADE_ORDER.length;
  const confusionMatrix: number[][] = Array.from({ length: nClasses }, () => new Array(nClasses).fill(0));
  for (const p of predictions) {
    confusionMatrix[p.actual][p.predicted]++;
  }

  // Per-class precision/recall
  const perClassPrecision: number[] = [];
  const perClassRecall: number[] = [];
  for (let i = 0; i < nClasses; i++) {
    // Precision = TP / (TP + FP) = confusionMatrix[i][i] / sum(col i)
    const tp = confusionMatrix[i][i];
    const colSum = confusionMatrix.reduce((s, row) => s + row[i], 0);
    perClassPrecision.push(colSum > 0 ? tp / colSum : 0);
    // Recall = TP / (TP + FN) = confusionMatrix[i][i] / sum(row i)
    const rowSum = confusionMatrix[i].reduce((s, v) => s + v, 0);
    perClassRecall.push(rowSum > 0 ? tp / rowSum : 0);
  }

  return {
    model1: {
      name: "K-Means Clustering (Model 1)",
      silhouette: Math.round(silhouette * 1000) / 1000,
      inertia: Math.round(inertia),
      clusterSizes,
      clusterLabels: ["sangat_mudah", "mudah", "medium", "sulit", "sangat_sulit"],
      testSize: courseFeatures.length,
      trainSize: courseFeatures.length,
      description: "Unsupervised clustering pada statistik per mata kuliah. Menentukan tingkat kesulitan dari distribusi nilai nyata (bukan label manual).",
    },
    model2: {
      name: "Logistic Regression (Softmax, Model 2)",
      exactAccuracy: Math.round(exactAccuracy * 1000) / 1000,
      within1StepAccuracy: Math.round(within1StepAccuracy * 1000) / 1000,
      within2StepAccuracy: Math.round(within2StepAccuracy * 1000) / 1000,
      top3Accuracy: Math.round(top3Accuracy * 1000) / 1000,
      confusionMatrix,
      gradeOrder: GRADE_ORDER,
      perClassPrecision: perClassPrecision.map((v) => Math.round(v * 1000) / 1000),
      perClassRecall: perClassRecall.map((v) => Math.round(v * 1000) / 1000),
      testSize: testRows.length,
      trainSize: trainRows.length,
      description: "Multi-class softmax regression (13 fitur, 10 kelas). Trained on 80% students, evaluated on 20% hold-out test set.",
    },
    dataset: {
      totalRecords,
      students: studentCount,
      majors: majorCount,
      courses,
      meanIpk: Math.round(meanIpk * 1000) / 1000,
      splitRatio: "80/20 (by student)",
    },
    evaluatedAt: Date.now(),
  };
}

// ── Helper functions ─────────────────────────────────────────────────

/** Seeded shuffle (Fisher-Yates) */
function shuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let rng = mulberry32(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Silhouette score: measures how well-separated clusters are. Range: [-1, 1]. */
function computeSilhouette(
  features: CourseFeatures[],
  classified: ClassifiedCourse[],
  model: TrainedModel1
): number {
  if (features.length < 2) return 0;
  // For each point, compute a (mean dist to same cluster) and b (mean dist to nearest other cluster)
  const matrix = features.map((f) => {
    const row = [
      f.meanGradePoint, f.stdGradePoint, f.pctAOrAbove, f.pctBelowB,
      f.pctFail, f.medianGradePoint, f.iqrGradePoint, f.meanIpsTakers,
    ];
    return applyScalerSafe(model.scaler, row);
  });

  const assignments = classified.map((c) => c.difficultyCluster);
  let totalScore = 0;
  let count = 0;

  for (let i = 0; i < matrix.length; i++) {
    const ownCluster = assignments[i];
    let aSum = 0, aCount = 0;
    const bSums: Record<number, number> = {};
    const bCounts: Record<number, number> = {};

    for (let j = 0; j < matrix.length; j++) {
      if (i === j) continue;
      const d = euclidean(matrix[i], matrix[j]);
      if (assignments[j] === ownCluster) {
        aSum += d;
        aCount++;
      } else {
        bSums[assignments[j]] = (bSums[assignments[j]] ?? 0) + d;
        bCounts[assignments[j]] = (bCounts[assignments[j]] ?? 0) + 1;
      }
    }

    const a = aCount > 0 ? aSum / aCount : 0;
    let bMin = Infinity;
    for (const k of Object.keys(bSums)) {
      const meanB = bSums[Number(k)] / bCounts[Number(k)];
      if (meanB < bMin) bMin = meanB;
    }
    if (bMin === Infinity) bMin = a;

    const s = Math.max(a, bMin) > 0 ? (bMin - a) / Math.max(a, bMin) : 0;
    totalScore += s;
    count++;
  }

  return count > 0 ? totalScore / count : 0;
}

/** Inertia: sum of squared distances to nearest centroid. */
function computeInertia(features: CourseFeatures[], model: TrainedModel1): number {
  const matrix = features.map((f) => {
    const row = [
      f.meanGradePoint, f.stdGradePoint, f.pctAOrAbove, f.pctBelowB,
      f.pctFail, f.medianGradePoint, f.iqrGradePoint, f.meanIpsTakers,
    ];
    return applyScalerSafe(model.scaler, row);
  });

  let total = 0;
  for (const point of matrix) {
    let minDist = Infinity;
    for (const centroid of model.centroids) {
      const d = euclidean(point, centroid);
      if (d < minDist) minDist = d;
    }
    total += minDist * minDist;
  }
  return total;
}

function applyScalerSafe(scaler: { means: number[]; stds: number[] }, row: number[]): number[] {
  return row.map((v, i) => (v - scaler.means[i]) / (scaler.stds[i] || 1e-8));
}

function euclidean(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}
