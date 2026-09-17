/**
 * Feature engineering — transforms raw student/course records into the feature
 * matrices consumed by Model 1 and Model 2.
 * Mirrors Python `src/features/feature_engineering.py`.
 */
import { GRADE_ORDER, MAJORS } from "./config";
import type { CourseFeatures, StudentCourseFeatures } from "./types";
import type { SyntheticRecord } from "./training-data";
import { computeStats } from "./grade-utils";

export interface RawRecord {
  studentId?: string;
  major?: string;
  semesterNumber: number;
  courseName: string;
  sks: number;
  grade: string;
  gradePoint: number;
}

/** Build per-course features grouped by (courseName × major). */
export function buildCourseFeatures(records: RawRecord[]): CourseFeatures[] {
  const groups = new Map<string, RawRecord[]>();
  for (const r of records) {
    const major = (r.major || "Umum").trim();
    const key = `${r.courseName}|||${major}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  const out: CourseFeatures[] = [];
  for (const [key, recs] of groups) {
    const [courseName, major] = key.split("|||");
    const gps = recs.map((r) => r.gradePoint);
    const ips = recs.map((r) => r.gradePoint); // proxy: per-student IPS = gradePoint for this course
    const stats = computeStats(gps);
    const meanIps = computeStats(ips).mean;
    out.push({
      courseName,
      major,
      meanGradePoint: Math.round(stats.mean * 100) / 100,
      stdGradePoint: Math.round(stats.std * 100) / 100,
      pctAOrAbove: Math.round(stats.pctAOrAbove * 100) / 100,
      pctBelowB: Math.round(stats.pctBelowB * 100) / 100,
      pctFail: Math.round(stats.pctFail * 100) / 100,
      medianGradePoint: Math.round(stats.median * 100) / 100,
      iqrGradePoint: Math.round(stats.iqr * 100) / 100,
      meanIpsTakers: Math.round(meanIps * 100) / 100,
      sampleCount: recs.length,
    });
  }
  return out;
}

/**
 * Build student×course feature rows for Model 2 training.
 * Each record is expanded with rolling IPS/IPK context prior to that semester.
 */
export function buildStudentFeatures(records: RawRecord[]): StudentCourseFeatures[] {
  // Group by student
  const byStudent = new Map<string, RawRecord[]>();
  for (const r of records) {
    const sid = r.studentId ?? "anon";
    if (!byStudent.has(sid)) byStudent.set(sid, []);
    byStudent.get(sid)!.push(r);
  }

  const majorEncoding = encodeMajors(MAJORS as readonly string[]);
  const rows: StudentCourseFeatures[] = [];

  for (const [sid, recs] of byStudent) {
    // Sort by semester
    recs.sort((a, b) => a.semesterNumber - b.semesterNumber);
    // Per-semester aggregates
    const semesterAgg = new Map<number, { sks: number; weightedGp: number }>();
    for (const r of recs) {
      if (!semesterAgg.has(r.semesterNumber)) {
        semesterAgg.set(r.semesterNumber, { sks: 0, weightedGp: 0 });
      }
      const agg = semesterAgg.get(r.semesterNumber)!;
      agg.sks += r.sks;
      agg.weightedGp += r.sks * r.gradePoint;
    }
    const semesters = [...semesterAgg.keys()].sort((a, b) => a - b);
    const ipsBySem = new Map<number, number>();
    let cumSks = 0;
    let cumWeighted = 0;
    const ipkBeforeSem = new Map<number, number>();
    for (const s of semesters) {
      const agg = semesterAgg.get(s)!;
      const ips = agg.sks > 0 ? agg.weightedGp / agg.sks : 0;
      ipsBySem.set(s, ips);
      ipkBeforeSem.set(s, cumSks > 0 ? cumWeighted / cumSks : ips);
      cumSks += agg.sks;
      cumWeighted += agg.weightedGp;
    }

    // Course features lookup (per-course × major stats) — recompute on the fly
    const courseFeats = buildCourseFeatures(recs);
    const cfLookup = new Map<string, CourseFeatures>();
    for (const cf of courseFeats) cfLookup.set(`${cf.courseName}|||${cf.major}`, cf);

    for (const r of recs) {
      const cf = cfLookup.get(`${r.courseName}|||${r.major ?? "Umum"}`);
      if (!cf) continue;
      const ipsList = semesters.map((s) => ipsBySem.get(s)!);
      const ipsLast = ipsBySem.get(r.semesterNumber) ?? ipsList[ipsList.length - 1] ?? 3.3;
      const ipsPrev = ipsList[ipsList.indexOf(ipsLast) - 1] ?? ipsLast;
      const ipsTrend = Math.round((ipsLast - ipsPrev) * 100) / 100;
      const ipkBefore = ipkBeforeSem.get(r.semesterNumber) ?? ipsLast;
      const totalSksBefore = semesters
        .filter((s) => s < r.semesterNumber)
        .reduce((sum, s) => sum + (semesterAgg.get(s)?.sks ?? 0), 0);
      // Difficulty features: derive a simple difficulty score from course stats
      const difficultyScore = deriveDifficultyScore(cf);
      const difficultyCluster = difficultyClusterOf(difficultyScore);
      const gradeClass = GRADE_ORDER.indexOf(r.grade);

      // Each scenario adds one training row with a different target distribution
      // (shifted). To keep training simple, we just replicate with scenario=serius.
      rows.push({
        difficultyScore,
        difficultyCluster,
        ipkBefore: Math.round(ipkBefore * 100) / 100,
        ipsLastSemester: Math.round(ipsLast * 100) / 100,
        ipsTrend,
        totalSksCompleted: totalSksBefore,
        courseSks: r.sks,
        semesterNumber: r.semesterNumber,
        scenarioEncoded: 1, // serius — neutral scenario for training
        majorEncoded: majorEncoding[r.major ?? "Umum"] ?? 0,
        meanIpsTakers: cf.meanIpsTakers,
        pctAOrAbove: cf.pctAOrAbove,
        pctBelowB: cf.pctBelowB,
        gradeClass,
      });
    }
    void sid;
  }

  return rows;
}

/** Encode majors to integers. */
export function encodeMajors(majors: readonly string[]): Record<string, number> {
  const map: Record<string, number> = {};
  majors.forEach((m, i) => (map[m] = i));
  map["Umum"] = majors.length;
  return map;
}

/** Derive a 0..1 difficulty score from course features (heuristic, used as bootstrap). */
export function deriveDifficultyScore(cf: CourseFeatures): number {
  // Higher mean → easier → lower difficulty.
  const meanFactor = 1 - cf.meanGradePoint / 4; // 0..1
  const failFactor = cf.pctFail; // 0..1
  const belowB = cf.pctBelowB; // 0..1
  const score = meanFactor * 0.55 + failFactor * 0.25 + belowB * 0.2;
  return Math.max(0, Math.min(1, Math.round(score * 100) / 100));
}

export function difficultyClusterOf(score: number): number {
  if (score < 0.2) return 0;
  if (score < 0.4) return 1;
  if (score < 0.6) return 2;
  if (score < 0.8) return 3;
  return 4;
}
