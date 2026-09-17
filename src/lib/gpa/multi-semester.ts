/**
 * Multi-semester planning — chains predictions across 2-4 future semesters.
 *
 * Given the current transcript + a sequence of planned-course lists (one per
 * future semester), this module simulates each semester in turn: it runs the
 * optimizer for semester N+1 assuming the BEST scenario of semester N actually
 * materialized, then feeds that projected transcript back as input for N+2.
 *
 * This gives students a longer-horizon roadmap toward their target IPK.
 */
import { optimize, summarizeTranscript } from "./optimizer";
import { normalizeCourseName } from "./course-normalizer";
import { normalizeGrade, gradeToGp, computeIpk } from "./grade-utils";
import type { TranscriptEntry, PlannedCourse, OptimizationResult, ScenarioName } from "./types";

export interface MultiSemesterPlan {
  semesters: {
    semesterIndex: number;
    courses: { name: string; sks: number; grade: string; scenario: ScenarioName }[];
    projectedIpk: number;
    ipkDelta: number;
    scenarioUsed: ScenarioName;
  }[];
  finalIpk: number;
  totalDelta: number;
  achievesTarget: boolean;
  message: string;
}

/**
 * Plan multiple semesters ahead.
 * @param transcript current transcript
 * @param semesterPlans array of planned-course lists, one per future semester
 * @param targetIpk optional target IPK
 */
export async function planMultiSemester(opts: {
  transcript: TranscriptEntry[];
  semesterPlans: { courses: PlannedCourse[] }[];
  targetIpk?: number;
}): Promise<MultiSemesterPlan> {
  const { transcript: initialTranscript, semesterPlans, targetIpk } = opts;

  if (semesterPlans.length === 0) {
    return {
      semesters: [],
      finalIpk: 0,
      totalDelta: 0,
      achievesTarget: false,
      message: "Tidak ada semester yang direncanakan.",
    };
  }

  let currentTranscript = [...initialTranscript];
  const currentSummary = summarizeTranscript(currentTranscript);
  const startIpk = currentSummary.currentIpk;
  let lastScenario: ScenarioName = "serius";

  const semesterResults: MultiSemesterPlan["semesters"] = [];

  for (let i = 0; i < semesterPlans.length; i++) {
    const plan = semesterPlans[i];
    if (!plan.courses || plan.courses.length === 0) continue;

    // Run optimize for this semester
    const result: OptimizationResult = await optimize({
      transcript: currentTranscript,
      plannedCourses: plan.courses,
      targetIpk,
    });

    // Take the best scenario's best combination
    const bestScenario = result.summary.bestScenario;
    const bestCombo = result.scenarios.find((s) => s.scenario === bestScenario)?.combinations[0];

    if (!bestCombo) {
      // No feasible combination — skip but record
      semesterResults.push({
        semesterIndex: currentSummary.lastSemester + i + 1,
        courses: plan.courses.map((c) => ({
          name: c.courseName,
          sks: c.sks,
          grade: "—",
          scenario: bestScenario,
        })),
        projectedIpk: result.summary.currentIpk,
        ipkDelta: 0,
        scenarioUsed: bestScenario,
      });
      continue;
    }

    lastScenario = bestScenario;

    // Append the best combination as "completed" courses to the transcript
    const newSemester = currentSummary.lastSemester + i + 1;
    const newEntries: TranscriptEntry[] = bestCombo.grades.map((g) => {
      const norm = normalizeCourseName(g.courseName);
      return {
        id: `proj-${i}-${g.courseId}`,
        courseName: g.courseName,
        normalizedName: norm.normalizedName,
        sks: g.sks,
        grade: g.grade,
        gradePoint: g.gradePoint,
        semester: newSemester,
        major: "Umum",
      };
    });

    currentTranscript = [...currentTranscript, ...newEntries];

    semesterResults.push({
      semesterIndex: newSemester,
      courses: bestCombo.grades.map((g) => ({
        name: g.normalizedName,
        sks: g.sks,
        grade: g.grade,
        scenario: bestScenario,
      })),
      projectedIpk: bestCombo.newIpk,
      ipkDelta: bestCombo.ipkDelta,
      scenarioUsed: bestScenario,
    });
  }

  const finalIpk = semesterResults.length > 0
    ? semesterResults[semesterResults.length - 1].projectedIpk
    : startIpk;
  const totalDelta = Math.round((finalIpk - startIpk) * 1000) / 1000;
  const achievesTarget = targetIpk !== undefined ? finalIpk >= targetIpk : true;

  const message = buildMultiMessage({
    startIpk,
    finalIpk,
    totalDelta,
    targetIpk,
    achievesTarget,
    semesterCount: semesterResults.length,
    lastScenario,
  });

  return {
    semesters: semesterResults,
    finalIpk: Math.round(finalIpk * 1000) / 1000,
    totalDelta,
    achievesTarget,
    message,
  };
}

function buildMultiMessage(opts: {
  startIpk: number;
  finalIpk: number;
  totalDelta: number;
  targetIpk?: number;
  achievesTarget: boolean;
  semesterCount: number;
  lastScenario: ScenarioName;
}): string {
  const semWord = opts.semesterCount === 1 ? "1 semester" : `${opts.semesterCount} semester`;
  if (opts.targetIpk !== undefined) {
    if (opts.achievesTarget) {
      return `Target IPK ${opts.targetIpk.toFixed(2)} tercapai dalam ${semWord}. IPK naik dari ${opts.startIpk.toFixed(3)} → ${opts.finalIpk.toFixed(3)} (Δ +${opts.totalDelta.toFixed(3)}).`;
    }
    return `Setelah ${semWord}, IPK ${opts.finalIpk.toFixed(3)} (Δ +${opts.totalDelta.toFixed(3)}) masih di bawah target ${opts.targetIpk.toFixed(2)}. Pertimbangkan menambah semester atau menurunkan target.`;
  }
  return `Dalam ${semWord}, IPK diproyeksikan naik dari ${opts.startIpk.toFixed(3)} → ${opts.finalIpk.toFixed(3)} (Δ +${opts.totalDelta.toFixed(3)}) dengan strategi skenario "${opts.lastScenario}".`;
}
