/**
 * Shared TypeScript types for the GPA Optimizer.
 */
import type { ScenarioName } from "./config";

/** A single past course record from the transcript. */
export interface TranscriptEntry {
  id: string;
  courseName: string; // raw name as typed by user
  normalizedName?: string; // canonical name after normalization
  sks: number;
  grade: string; // one of GRADE_ORDER (after normalization)
  gradePoint: number; // 0..4
  semester: number; // semester index (1..N)
  major?: string;
}

/** A course the student plans to take in the target semester. */
export interface PlannedCourse {
  id: string;
  courseName: string; // raw name
  normalizedName?: string;
  sks: number;
  userDifficultyOverride?: number; // 0..1, optional
}

/** Aggregated statistics for a (courseName × major) group — Model 1 input. */
export interface CourseFeatures {
  courseName: string;
  major: string;
  meanGradePoint: number;
  stdGradePoint: number;
  pctAOrAbove: number;
  pctBelowB: number;
  pctFail: number;
  medianGradePoint: number;
  iqrGradePoint: number;
  meanIpsTakers: number;
  sampleCount: number;
}

/** Output of Model 1: course tagged with difficulty. */
export interface ClassifiedCourse {
  courseName: string;
  major: string;
  difficultyCluster: number;
  difficultyLabel: "sangat_mudah" | "mudah" | "medium" | "sulit" | "sangat_sulit";
  difficultyScore: number; // 0..1
  features: CourseFeatures;
  typicalDifficulty: number; // from canonical catalog (prior)
}

/** A feature row used by Model 2 (grade predictor). */
export interface StudentCourseFeatures {
  difficultyScore: number;
  difficultyCluster: number;
  ipkBefore: number;
  ipsLastSemester: number;
  ipsTrend: number;
  totalSksCompleted: number;
  courseSks: number;
  semesterNumber: number;
  scenarioEncoded: number;
  majorEncoded: number;
  meanIpsTakers: number;
  pctAOrAbove: number;
  pctBelowB: number;
  gradeClass: number; // target: index into GRADE_ORDER
}

/** A probability distribution over the 10 grade classes. */
export type GradeDistribution = Record<string, number>;

/** One combination of grades for the target-semester courses. */
export interface GradeCombination {
  id: string;
  grades: { courseId: string; courseName: string; normalizedName: string; sks: number; grade: string; gradePoint: number }[];
  ips: number; // IPS for this semester
  newIpk: number; // projected cumulative IPK
  ipkDelta: number; // newIpk - currentIpk
  cumulativeDifficulty: number; // weighted by SKS, 0..1
  expectedProbability: number; // product of per-grade probs (likelihood)
}

/** A scenario group with its grade combinations. */
export interface ScenarioResult {
  scenario: ScenarioName;
  label: string;
  description: string;
  color: string;
  effortMultiplier: number;
  combinations: GradeCombination[];
  bestIpkDelta: number;
  bestNewIpk: number;
  achievableTarget: boolean;
}

/** Full output of GPAOptimizer.predict(). */
export interface OptimizationResult {
  classifiedCourses: ClassifiedCourse[];
  scenarios: ScenarioResult[];
  summary: {
    currentIpk: number;
    totalSks: number;
    targetIpk?: number;
    plannedSks: number;
    bestOverallDelta: number;
    bestOverallNewIpk: number;
    bestScenario: ScenarioName;
    achievable: boolean;
    message: string;
  };
  /** Chart-friendly semester trend (IPS per semester + projected). */
  trend: {
    semesters: { semester: number; ips: number; ipkCumulative: number; isProjected?: boolean }[];
  };
  /** Per-planned-course grade distribution (for radar/bar charts). */
  distributions: {
    courseId: string;
    courseName: string;
    normalizedName: string;
    difficultyScore: number;
    scenario: ScenarioName;
    distribution: GradeDistribution;
  }[];
}

/** Normalized course lookup result. */
export interface NormalizedCourse {
  rawName: string;
  normalizedName: string;
  category: string;
  defaultSks: number;
  typicalDifficulty: number;
  confidence: number; // 0..1
  matched: boolean;
}

/** Trained model bundle stored in memory. */
export interface TrainedModel {
  clusterCentroids: number[][]; // [k][features]
  clusterLabels: string[]; // ordered by difficulty (sangat_mudah..sangat_sulit)
  clusterScoreBounds: number[]; // thresholds on difficulty_score
  predictorWeights: number[][]; // logistic weights [nClasses][nFeatures]
  predictorBias: number[];
  majorEncoding: Record<string, number>;
  trainedAt: number;
  sampleCount: number;
}
