/**
 * Model store — holds trained Model 1 + Model 2 in process memory.
 * The store is bootstrapped once (lazily) from synthetic data so the app works
 * even before the user uploads a transcript. When the user uploads data, the
 * `retrain` endpoint merges user records with the synthetic base and retrains.
 */
import { generateSynthetic, type SyntheticRecord } from "./training-data";
import { buildCourseFeatures, buildStudentFeatures, encodeMajors, deriveDifficultyScore } from "./feature-engineering";
import { trainDifficultyClusterer, predictDifficulty, type TrainedModel1 } from "./kmeans";
import { trainGradePredictor, type TrainedModel2, predictGradeDistribution, buildFeatureRow, generateCombinations } from "./grade-predictor";
import { CANONICAL_COURSES, MAJORS, GRADE_ORDER, SCENARIOS, IPK_DELTA, SCENARIO_META, type ScenarioName } from "./config";
import { normalizeCourseName } from "./course-normalizer";
import { computeIpk } from "./grade-utils";
import type {
  TranscriptEntry,
  PlannedCourse,
  ClassifiedCourse,
  CourseFeatures,
  OptimizationResult,
  ScenarioResult,
  GradeCombination,
  GradeDistribution,
} from "./types";

interface TrainedBundle {
  model1: TrainedModel1;
  model2: TrainedModel2;
  courseFeatures: CourseFeatures[];
  classifiedLookup: Map<string, ClassifiedCourse>; // normalizedName → course
  majorEncoding: Record<string, number>;
  trainedAt: number;
}

let cached: TrainedBundle | null = null;
let bootPromise: Promise<TrainedBundle> | null = null;

/** Build a canonical-course lookup by name (for Model 1 prior lookup). */
function canonicalLookup(): Map<string, (typeof CANONICAL_COURSES)[number]> {
  const m = new Map<string, (typeof CANONICAL_COURSES)[number]>();
  for (const c of CANONICAL_COURSES) m.set(c.name, c);
  return m;
}

/** Convert SyntheticRecord → RawRecord shape used by feature engineering. */
function synthToRaw(records: SyntheticRecord[]) {
  return records.map((r) => ({
    studentId: r.studentId,
    major: r.major,
    semesterNumber: r.semesterNumber,
    courseName: r.courseName,
    sks: r.sks,
    grade: r.grade,
    gradePoint: r.gradePoint,
  }));
}

/** Bootstrap the trained model from synthetic data (runs once). */
export async function ensureModelTrained(): Promise<TrainedBundle> {
  if (cached) return cached;
  if (bootPromise) return bootPromise;
  bootPromise = (async () => {
    const synthetic = generateSynthetic(900, 42);
    const raw = synthToRaw(synthetic);
    const cf = buildCourseFeatures(raw);
    const { model: m1, classified } = trainDifficultyClusterer(cf, canonicalLookup());
    const sf = buildStudentFeatures(raw);
    const m2 = trainGradePredictor(sf);

    const lookup = new Map<string, ClassifiedCourse>();
    for (const c of classified) lookup.set(c.courseName, c);

    const majorEncoding = encodeMajors(MAJORS as readonly string[]);

    cached = {
      model1: m1,
      model2: m2,
      courseFeatures: cf,
      classifiedLookup: lookup,
      majorEncoding,
      trainedAt: Date.now(),
    };
    return cached;
  })();
  return bootPromise;
}

/** Retrain the model, optionally merging user-supplied transcript records. */
export async function retrainWithUserData(transcript: TranscriptEntry[]): Promise<TrainedBundle> {
  // Convert transcript entries to raw records (per-student = "user")
  const userRaw = transcript.map((t) => ({
    studentId: "user",
    major: t.major ?? "Umum",
    semesterNumber: t.semester,
    courseName: t.normalizedName ?? t.courseName,
    sks: t.sks,
    grade: t.grade,
    gradePoint: t.gradePoint,
  }));

  const synthetic = generateSynthetic(700, 7);
  const raw = [...synthToRaw(synthetic), ...userRaw];
  const cf = buildCourseFeatures(raw);
  const { model: m1, classified } = trainDifficultyClusterer(cf, canonicalLookup());
  const sf = buildStudentFeatures(raw);
  const m2 = trainGradePredictor(sf);

  const lookup = new Map<string, ClassifiedCourse>();
  for (const c of classified) lookup.set(c.courseName, c);
  const majorEncoding = encodeMajors(MAJORS as readonly string[]);

  cached = {
    model1: m1,
    model2: m2,
    courseFeatures: cf,
    classifiedLookup: lookup,
    majorEncoding,
    trainedAt: Date.now(),
  };
  bootPromise = null;
  return cached;
}

/** Get current transcript summary (current IPK, total SKS, last IPS, trend). */
export function summarizeTranscript(entries: TranscriptEntry[]): {
  currentIpk: number;
  totalSks: number;
  ipsLast: number;
  ipsTrend: number;
  lastSemester: number;
} {
  if (entries.length === 0) {
    return { currentIpk: 0, totalSks: 0, ipsLast: 0, ipsTrend: 0, lastSemester: 0 };
  }
  // Group by semester
  const bySem = new Map<number, TranscriptEntry[]>();
  for (const e of entries) {
    if (!bySem.has(e.semester)) bySem.set(e.semester, []);
    bySem.get(e.semester)!.push(e);
  }
  const sems = [...bySem.keys()].sort((a, b) => a - b);
  const ipsBySem: number[] = [];
  let cumSks = 0;
  let cumWeighted = 0;
  for (const s of sems) {
    const es = bySem.get(s)!;
    const sks = es.reduce((sum, e) => sum + e.sks, 0);
    const w = es.reduce((sum, e) => sum + e.sks * e.gradePoint, 0);
    const ips = sks > 0 ? w / sks : 0;
    ipsBySem.push(ips);
    cumSks += sks;
    cumWeighted += w;
  }
  const ipsLast = ipsBySem[ipsBySem.length - 1] ?? 0;
  const ipsPrev = ipsBySem[ipsBySem.length - 2] ?? ipsLast;
  const ipsTrend = Math.round((ipsLast - ipsPrev) * 100) / 100;
  const currentIpk = cumSks > 0 ? cumWeighted / cumSks : ipsLast;
  return {
    currentIpk: Math.round(currentIpk * 1000) / 1000,
    totalSks: cumSks,
    ipsLast: Math.round(ipsLast * 1000) / 1000,
    ipsTrend,
    lastSemester: sems[sems.length - 1],
  };
}

/**
 * Main inference: predict 4 scenario groups with grade combinations.
 */
export async function optimize(opts: {
  transcript: TranscriptEntry[];
  plannedCourses: PlannedCourse[];
  targetIpk?: number;
}): Promise<OptimizationResult> {
  const bundle = await ensureModelTrained();
  const summary = summarizeTranscript(opts.transcript);

  // Normalize planned courses
  const plannedNormalized = opts.plannedCourses.map((p) => {
    const norm = normalizeCourseName(p.courseName);
    return {
      ...p,
      normalizedName: norm.normalizedName,
      typicalDifficulty: norm.typicalDifficulty,
    };
  });

  // For each planned course, find its classified difficulty.
  // If the course exists in the trained lookup, use that; else fall back to
  // the canonical typical difficulty and synthesize features.
  const classifiedForPlanned: (ClassifiedCourse & { courseId: string; sks: number; userOverride?: number })[] = [];
  for (const p of plannedNormalized) {
    const looked = bundle.classifiedLookup.get(p.normalizedName);
    let diffScore: number;
    let diffCluster: number;
    let features: CourseFeatures;
    if (looked) {
      // Apply user override if provided
      const score = p.userDifficultyOverride !== undefined
        ? Math.max(0, Math.min(1, p.userDifficultyOverride))
        : looked.difficultyScore;
      diffScore = score;
      diffCluster = looked.difficultyCluster;
      features = looked.features;
    } else {
      // Synthesize a course-features entry from the canonical typicalDifficulty
      const typical = p.typicalDifficulty ?? 0.5;
      diffScore = p.userDifficultyOverride !== undefined
        ? Math.max(0, Math.min(1, p.userDifficultyOverride))
        : typical;
      diffCluster = diffScore < 0.2 ? 0 : diffScore < 0.4 ? 1 : diffScore < 0.6 ? 2 : diffScore < 0.8 ? 3 : 4;
      features = {
        courseName: p.normalizedName,
        major: "Umum",
        meanGradePoint: Math.round((4 - typical * 2) * 100) / 100,
        stdGradePoint: 0.6,
        pctAOrAbove: Math.round((1 - typical) * 100) / 100,
        pctBelowB: Math.round(typical * 100) / 100,
        pctFail: Math.round(Math.max(0, typical - 0.5) * 100) / 100,
        medianGradePoint: Math.round((4 - typical * 2) * 100) / 100,
        iqrGradePoint: 0.6,
        meanIpsTakers: summary.ipsLast || 3.3,
        sampleCount: 1,
      };
    }
    classifiedForPlanned.push({
      courseId: p.id,
      courseName: p.courseName,
      major: "Umum",
      difficultyCluster: diffCluster,
      difficultyLabel: diffScore < 0.2 ? "sangat_mudah" : diffScore < 0.4 ? "mudah" : diffScore < 0.6 ? "medium" : diffScore < 0.8 ? "sulit" : "sangat_sulit",
      difficultyScore: diffScore,
      features,
      typicalDifficulty: p.typicalDifficulty ?? 0.5,
      sks: p.sks,
      userOverride: p.userDifficultyOverride,
    });
  }

  // Build feature rows per planned course per scenario, predict distributions
  const scenarios: ScenarioResult[] = [];
  const distributions: OptimizationResult["distributions"] = [];
  let bestOverallDelta = 0;
  let bestOverallNewIpk = summary.currentIpk;
  let bestScenario: ScenarioName = "serius";

  for (const sc of SCENARIOS) {
    const perCourse = classifiedForPlanned.map((c) => {
      const featureRow = buildFeatureRow({
        course: c,
        courseSks: c.sks,
        ipkBefore: summary.currentIpk,
        ipsLastSemester: summary.ipsLast,
        ipsTrend: summary.ipsTrend,
        totalSksCompleted: summary.totalSks,
        semesterNumber: summary.lastSemester + 1,
        scenario: sc,
        majorEncoded: bundle.majorEncoding["Umum"] ?? 0,
      });
      const dist = predictGradeDistribution(bundle.model2, featureRow);
      // Capture distribution for ALL scenarios so the detail view can show
      // per-scenario probability matrices.
      distributions.push({
        courseId: c.courseId,
        courseName: c.courseName,
        normalizedName: c.features.courseName,
        difficultyScore: c.difficultyScore,
        scenario: sc,
        distribution: dist,
      });
      return {
        courseId: c.courseId,
        courseName: c.courseName,
        normalizedName: c.features.courseName,
        sks: c.sks,
        difficultyScore: c.difficultyScore,
        distributions: dist,
      };
    });

    const { combinations } = generateCombinations(
      perCourse,
      sc,
      summary.currentIpk,
      summary.totalSks,
      opts.targetIpk
    );

    // Filter: meaningful & realistic IPK delta.
    // Edge case: when the student has no transcript history (totalSks = 0),
    // the new IPK equals the projected IPS so the delta equals the IPS itself
    // (typically 2.0–4.0). In that case we skip the upper-bound filter and only
    // require a non-negative delta, otherwise every combination would be rejected.
    const noHistory = summary.totalSks === 0;
    const filtered = combinations.filter((cb) => {
      if (noHistory) {
        return cb.ipkDelta >= 0 && cb.newIpk > 0;
      }
      return cb.ipkDelta >= IPK_DELTA.minMeaningful && cb.ipkDelta <= IPK_DELTA.maxRealistic;
    });

    // Take top combinations per scenario (limit to 8 for UI)
    const top = filtered.slice(0, 8).map((cb, i) => ({ ...cb, id: `${sc}-${i}` }));

    const bestDelta = top.length > 0 ? top[0].ipkDelta : 0;
    const bestNewIpk = top.length > 0 ? top[0].newIpk : summary.currentIpk;
    const achievable = opts.targetIpk ? bestNewIpk >= opts.targetIpk : false;

    if (bestDelta > bestOverallDelta) {
      bestOverallDelta = bestDelta;
      bestOverallNewIpk = bestNewIpk;
      bestScenario = sc;
    }

    scenarios.push({
      scenario: sc,
      label: SCENARIO_META[sc].label,
      description: SCENARIO_META[sc].description,
      color: SCENARIO_META[sc].color,
      effortMultiplier: SCENARIO_META[sc].effortMultiplier,
      combinations: top,
      bestIpkDelta: bestDelta,
      bestNewIpk,
      achievableTarget: achievable,
    });
  }

  // Build classified-courses summary for the planned semester
  const classifiedCourses: ClassifiedCourse[] = classifiedForPlanned.map((c) => ({
    courseName: c.courseName,
    major: c.major,
    difficultyCluster: c.difficultyCluster,
    difficultyLabel: c.difficultyLabel,
    difficultyScore: c.difficultyScore,
    features: c.features,
    typicalDifficulty: c.typicalDifficulty,
  }));

  const achievableOverall = opts.targetIpk ? bestOverallNewIpk >= opts.targetIpk : true;
  const message = buildMessage({
    currentIpk: summary.currentIpk,
    targetIpk: opts.targetIpk,
    bestNewIpk: bestOverallNewIpk,
    bestDelta: bestOverallDelta,
    achievable: achievableOverall,
    bestScenario,
  });

  // Build semester trend (IPS + cumulative IPK per semester, with projected tail)
  const trend = buildTrend(opts.transcript, summary, bestOverallNewIpk, bestScenario, scenarios);

  return {
    classifiedCourses,
    scenarios,
    summary: {
      currentIpk: summary.currentIpk,
      totalSks: summary.totalSks,
      targetIpk: opts.targetIpk,
      plannedSks: plannedNormalized.reduce((s, p) => s + p.sks, 0),
      bestOverallDelta: Math.round(bestOverallDelta * 1000) / 1000,
      bestOverallNewIpk: Math.round(bestOverallNewIpk * 1000) / 1000,
      bestScenario,
      achievable: achievableOverall,
      message,
    },
    trend,
    distributions,
  };
}

/** Build chart-friendly semester trend: past IPS/IPK + projected next semester. */
function buildTrend(
  transcript: TranscriptEntry[],
  summary: ReturnType<typeof summarizeTranscript>,
  projectedIpk: number,
  bestScenario: ScenarioName,
  scenarios: ScenarioResult[]
): OptimizationResult["trend"] {
  // Group transcript by semester
  const bySem = new Map<number, TranscriptEntry[]>();
  for (const e of transcript) {
    if (!bySem.has(e.semester)) bySem.set(e.semester, []);
    bySem.get(e.semester)!.push(e);
  }
  const sems = [...bySem.keys()].sort((a, b) => a - b);
  const out: OptimizationResult["trend"]["semesters"] = [];
  let cumSks = 0;
  let cumWeighted = 0;
  for (const s of sems) {
    const es = bySem.get(s)!;
    const sks = es.reduce((sum, e) => sum + e.sks, 0);
    const w = es.reduce((sum, e) => sum + e.sks * e.gradePoint, 0);
    const ips = sks > 0 ? w / sks : 0;
    cumSks += sks;
    cumWeighted += w;
    const ipkCum = cumSks > 0 ? cumWeighted / cumSks : ips;
    out.push({
      semester: s,
      ips: Math.round(ips * 1000) / 1000,
      ipkCumulative: Math.round(ipkCum * 1000) / 1000,
    });
  }
  // Append projected semester (best scenario's best combination IPS)
  const bestSc = scenarios.find((sc) => sc.scenario === bestScenario);
  if (bestSc && bestSc.combinations.length > 0) {
    const best = bestSc.combinations[0];
    out.push({
      semester: (sems[sems.length - 1] ?? 0) + 1,
      ips: best.ips,
      ipkCumulative: projectedIpk,
      isProjected: true,
    });
  }
  return { semesters: out };
}

function buildMessage(opts: {
  currentIpk: number;
  targetIpk?: number;
  bestNewIpk: number;
  bestDelta: number;
  achievable: boolean;
  bestScenario: ScenarioName;
}): string {
  if (opts.targetIpk) {
    if (opts.achievable) {
      return `Target IPK ${opts.targetIpk.toFixed(2)} tercapai pada skenario "${opts.bestScenario}" dengan IPK proyeksi ${opts.bestNewIpk.toFixed(3)} (Δ +${opts.bestDelta.toFixed(3)}).`;
    }
    return `Target IPK ${opts.targetIpk.toFixed(2)} belum tercapai. IPK proyeksi tertinggi ${opts.bestNewIpk.toFixed(3)} (Δ +${opts.bestDelta.toFixed(3)}) pada skenario "${opts.bestScenario}". Pertimbangkan menurunkan target atau menambah SKS mudah.`;
  }
  return `Skenario terbaik "${opts.bestScenario}" memproyeksikan IPK ${opts.bestNewIpk.toFixed(3)} (Δ +${opts.bestDelta.toFixed(3)}).`;
}
