/**
 * Model 2 — Grade Outcome Predictor.
 * Multi-class logistic regression (softmax) conditioned on scenario effort.
 * Predicts a probability distribution over the 10 grade classes.
 *
 * Mirrors Python `src/models/model2_grade_predictor.py` (RandomForest in the
 * reference, but logistic regression is lightweight and runs in pure TS).
 */
import { GRADE_ORDER, SCENARIOS, SCENARIO_ENCODING, SCENARIO_META } from "./config";
import type { ScenarioName, GradeDistribution, StudentCourseFeatures } from "./types";
import type { ClassifiedCourse } from "./types";

export interface TrainedModel2 {
  weights: number[][]; // [nClasses][nFeatures]
  bias: number[]; // [nClasses]
  featureMeans: number[];
  featureStds: number[];
  trainedAt: number;
  sampleCount: number;
}

const FEATURES = [
  "difficultyScore",
  "difficultyCluster",
  "ipkBefore",
  "ipsLastSemester",
  "ipsTrend",
  "totalSksCompleted",
  "courseSks",
  "semesterNumber",
  "scenarioEncoded",
  "majorEncoded",
  "meanIpsTakers",
  "pctAOrAbove",
  "pctBelowB",
] as const;

type FeatureRow = Record<typeof FEATURES[number], number>;

/** Standardize a feature matrix. */
function fitScaler(matrix: number[][]) {
  const n = matrix.length;
  const d = matrix[0]?.length ?? 0;
  const means = new Array(d).fill(0);
  for (const r of matrix) for (let i = 0; i < d; i++) means[i] += r[i];
  for (let i = 0; i < d; i++) means[i] /= n;
  const stds = new Array(d).fill(0);
  for (const r of matrix) for (let i = 0; i < d; i++) stds[i] += (r[i] - means[i]) ** 2;
  for (let i = 0; i < d; i++) stds[i] = Math.sqrt(stds[i] / n) || 1e-8;
  return { means, stds };
}

function applyScaler(scaler: { means: number[]; stds: number[] }, row: number[]) {
  return row.map((v, i) => (v - scaler.means[i]) / scaler.stds[i]);
}

/** Softmax. */
function softmax(logits: number[]): number[] {
  const max = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - max));
  const sum = exps.reduce((s, v) => s + v, 0);
  return exps.map((e) => e / sum);
}

/** Train multi-class logistic regression via gradient descent. */
export function trainGradePredictor(rows: StudentCourseFeatures[]): TrainedModel2 {
  const nClasses = GRADE_ORDER.length;
  const X = rows.map((r) => FEATURES.map((f) => r[f] as number));
  const y = rows.map((r) => r.gradeClass);
  const scaler = fitScaler(X);
  const Xs = X.map((r) => applyScaler(scaler, r));
  const n = Xs.length;
  const d = Xs[0]?.length ?? FEATURES.length;

  const weights: number[][] = Array.from({ length: nClasses }, () => new Array(d).fill(0));
  const bias = new Array(nClasses).fill(0);

  const lr = 0.25;
  const epochs = 220;

  for (let epoch = 0; epoch < epochs; epoch++) {
    const gW = Array.from({ length: nClasses }, () => new Array(d).fill(0));
    const gB = new Array(nClasses).fill(0);
    for (let i = 0; i < n; i++) {
      const logits = bias.map((b, c) => b + dot(weights[c], Xs[i]));
      const p = softmax(logits);
      for (let c = 0; c < nClasses; c++) {
        const err = p[c] - (y[i] === c ? 1 : 0);
        for (let j = 0; j < d; j++) gW[c][j] += err * Xs[i][j];
        gB[c] += err;
      }
    }
    for (let c = 0; c < nClasses; c++) {
      for (let j = 0; j < d; j++) weights[c][j] -= lr * gW[c][j] / n;
      bias[c] -= lr * gB[c] / n;
    }
  }

  return {
    weights,
    bias,
    featureMeans: scaler.means,
    featureStds: scaler.stds,
    trainedAt: Date.now(),
    sampleCount: n,
  };
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/** Predict grade distribution for a single feature row. */
export function predictGradeDistribution(
  model: TrainedModel2,
  features: StudentCourseFeatures
): GradeDistribution {
  const x = FEATURES.map((f) => features[f] as number);
  const xs = x.map((v, i) => (v - model.featureMeans[i]) / (model.featureStds[i] || 1e-8));
  const logits = model.bias.map((b, c) => b + dot(model.weights[c], xs));
  const probs = softmax(logits);
  const dist: GradeDistribution = {};
  GRADE_ORDER.forEach((g, i) => (dist[g] = Math.round(probs[i] * 1000) / 1000));
  return dist;
}

/**
 * Build a StudentCourseFeatures row from contextual inputs.
 * Used at inference time to feed Model 2.
 */
export function buildFeatureRow(opts: {
  course: ClassifiedCourse;
  courseSks: number;
  ipkBefore: number;
  ipsLastSemester: number;
  ipsTrend: number;
  totalSksCompleted: number;
  semesterNumber: number;
  scenario: ScenarioName;
  majorEncoded: number;
}): StudentCourseFeatures {
  return {
    difficultyScore: opts.course.difficultyScore,
    difficultyCluster: opts.course.difficultyCluster,
    ipkBefore: opts.ipkBefore,
    ipsLastSemester: opts.ipsLastSemester,
    ipsTrend: opts.ipsTrend,
    totalSksCompleted: opts.totalSksCompleted,
    courseSks: opts.courseSks,
    semesterNumber: opts.semesterNumber,
    scenarioEncoded: SCENARIO_ENCODING[opts.scenario],
    majorEncoded: opts.majorEncoded,
    meanIpsTakers: opts.course.features.meanIpsTakers,
    pctAOrAbove: opts.course.features.pctAOrAbove,
    pctBelowB: opts.course.features.pctBelowB,
    gradeClass: 0, // target, filled by caller
  };
}

/**
 * Generate all realistic grade combinations for a set of planned courses under
 * a given scenario. Filters by IPK delta bounds.
 */
export function generateCombinations(
  courses: { courseId: string; courseName: string; normalizedName: string; sks: number; difficultyScore: number; distributions: GradeDistribution }[],
  scenario: ScenarioName,
  currentIpk: number,
  totalSksBefore: number,
  targetIpk?: number
): {
  combinations: import("./types").GradeCombination[];
} {
  const effort = SCENARIO_META[scenario].effortMultiplier;
  // Per-course candidate grades: pick top-N most likely grades (scenario-modulated)
  const perCourseCandidates = courses.map((c) => {
    const dist = { ...c.distributions };
    // Modulate distribution by scenario effort: shift mass towards higher grades.
    const modulated = modulateDistribution(dist, effort);
    // Pick top 3 grades by probability
    const entries = GRADE_ORDER.map((g) => ({ grade: g, p: modulated[g] ?? 0 }));
    entries.sort((a, b) => b.p - a.p);
    const top = entries.slice(0, 3);
    return { ...c, candidates: top };
  });

  // Cartesian product (bounded to avoid explosion: limit to ~3^6 = 729 max)
  const MAX_COMBOS = 400;
  const combos: import("./types").GradeCombination[] = [];
  let aborted = false;

  function recurse(idx: number, current: { courseId: string; courseName: string; normalizedName: string; sks: number; grade: string; gradePoint: number; p: number; difficultyScore: number }[]) {
    if (aborted) return;
    if (idx === perCourseCandidates.length) {
      // Compute IPS, new IPK, difficulty, probability
      const totalSks = current.reduce((s, g) => s + g.sks, 0);
      const weightedGp = current.reduce((s, g) => s + g.sks * g.gradePoint, 0);
      const ips = totalSks > 0 ? weightedGp / totalSks : 0;
      const newIpk = totalSksBefore > 0
        ? (currentIpk * totalSksBefore + ips * totalSks) / (totalSksBefore + totalSks)
        : ips;
      const ipkDelta = newIpk - currentIpk;
      // cumulative difficulty weighted by SKS
      const diff = totalSks > 0
        ? current.reduce((s, g) => s + g.sks * g.difficultyScore, 0) / totalSks
        : 0;
      const prob = current.reduce((s, g) => s * Math.max(g.p, 1e-6), 0);
      combos.push({
        id: `${scenario}-${combos.length}`,
        grades: current.map((g) => ({
          courseId: g.courseId,
          courseName: g.courseName,
          normalizedName: g.normalizedName,
          sks: g.sks,
          grade: g.grade,
          gradePoint: g.gradePoint,
        })),
        ips: Math.round(ips * 1000) / 1000,
        newIpk: Math.round(newIpk * 1000) / 1000,
        ipkDelta: Math.round(ipkDelta * 1000) / 1000,
        cumulativeDifficulty: Math.round(diff * 100) / 100,
        expectedProbability: Math.round(prob * 10000) / 10000,
      });
      return;
    }
    const course = perCourseCandidates[idx];
    for (const cand of course.candidates) {
      current.push({
        courseId: course.courseId,
        courseName: course.courseName,
        normalizedName: course.normalizedName,
        sks: course.sks,
        grade: cand.grade,
        gradePoint: gradePointOf(cand.grade),
        p: cand.p,
        difficultyScore: course.difficultyScore,
      });
      recurse(idx + 1, current);
      current.pop();
      if (combos.length >= MAX_COMBOS) {
        aborted = true;
        return;
      }
    }
  }
  recurse(0, []);

  // Sort by descending IPK delta
  combos.sort((a, b) => b.ipkDelta - a.ipkDelta);

  return { combinations: combos };
}

function gradePointOf(g: string): number {
  const m: Record<string, number> = {
    A: 4, "A-": 3.7, "B+": 3.3, B: 3, "B-": 2.7, "C+": 2.3, C: 2, "C-": 1.7, D: 1, E: 0,
  };
  return m[g] ?? 0;
}

/** Modulate a grade distribution by scenario effort (shifts mass toward higher grades).
 * GRADE_ORDER is [A, A-, B+, ..., E] so rank 0 = A (best), rank 1 = E (worst).
 * Higher effort → prefer lower rank (closer to A).
 */
function modulateDistribution(dist: GradeDistribution, effort: number): GradeDistribution {
  const out: GradeDistribution = {};
  const n = GRADE_ORDER.length;
  // target rank: effort=1 → 0 (all A), effort=0.55 → ~0.45 (around B), effort=0 → 1 (E)
  const targetRank = Math.max(0, Math.min(1, 1 - effort));
  for (let i = 0; i < n; i++) {
    const g = GRADE_ORDER[i];
    const rank = i / (n - 1); // 0 for A, 1 for E
    const distToTarget = Math.abs(rank - targetRank);
    // Gaussian-like weighting: closer to target rank → higher weight.
    const weight = Math.exp(-(distToTarget * distToTarget) * 8);
    const original = dist[g] ?? 0;
    // Blend: 35% original prediction + 65% effort-driven target shape
    out[g] = original * 0.35 + weight * 0.65;
  }
  // Normalize
  const total = Object.values(out).reduce((s, v) => s + v, 0);
  if (total > 0) {
    for (const k of Object.keys(out)) out[k] = out[k] / total;
  }
  return out;
}

/** Helper for callers. */
export { SCENARIOS };
