/**
 * Synthetic Indonesian dataset generator.
 * Produces realistic (course, major, grade, semester, ips) records calibrated
 * to national IPK statistics (~3.33 mean). Used to bootstrap the models when
 * the user hasn't uploaded enough transcript history.
 */
import { CANONICAL_COURSES, MAJORS, GRADE_ORDER, GRADE_POINTS } from "./config";
import { gradeToGp, gpToGrade } from "./grade-utils";

export interface SyntheticRecord {
  studentId: string;
  major: string;
  semesterNumber: number;
  courseName: string;
  sks: number;
  grade: string;
  gradePoint: number;
  ips: number;
  ipk: number;
}

// Seeded RNG (mulberry32) for reproducibility.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Sample from a normal distribution via Box-Muller. */
function gauss(rand: () => number, mean: number, std: number): number {
  const u1 = rand() || 1e-9;
  const u2 = rand();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + std * z;
}

/** Sample a discrete grade based on a target mean and difficulty. */
function sampleGrade(rand: () => number, difficulty: number, ability: number): string {
  // Higher difficulty → lower expected grade point; higher ability → higher.
  // Expected grade point = clamp(4.0 - difficulty * 1.5 + ability * 0.8, 0, 4)
  const targetGp = Math.max(0, Math.min(4, 4.0 - difficulty * 1.5 + ability * 0.8));
  const std = 0.4 + difficulty * 0.4;
  let gp = gauss(rand, targetGp, std);
  gp = Math.max(0, Math.min(4, gp));
  // Snap to nearest grade point in GRADE_ORDER
  const g = gpToGrade(gp);
  return g;
}

/**
 * Generate a synthetic dataset.
 * @param nStudents number of synthetic students
 * @param seed RNG seed
 */
export function generateSynthetic(nStudents = 1300, seed = 42): SyntheticRecord[] {
  const rand = mulberry32(seed);
  const records: SyntheticRecord[] = [];

  for (let s = 0; s < nStudents; s++) {
    const major = MAJORS[Math.floor(rand() * MAJORS.length)];
    // Each student has a latent ability 0..1 (bias to middle)
    const ability = Math.max(0, Math.min(1, gauss(rand, 0.55, 0.18)));

    // Decide how many semesters this student has completed (2..8)
    const nSemesters = 2 + Math.floor(rand() * 7);

    // Pick a subset of courses relevant to the major (use category heuristics)
    const majorCategories = majorToCategories(major);
    const eligible = CANONICAL_COURSES.filter((c) => majorCategories.includes(c.category));
    const required = CANONICAL_COURSES.filter((c) => c.category === "Wajib");
    const pool = [...eligible, ...required];

    // Shuffle pool deterministically
    const shuffled = [...pool].sort(() => rand() - 0.5);

    let cumulativeSks = 0;
    let cumulativeWeightedGp = 0;
    let lastIps = 3.3;
    let ipk = 3.3;

    for (let sem = 1; sem <= nSemesters; sem++) {
      // Take 5-7 courses per semester
      const nCourses = 5 + Math.floor(rand() * 3);
      const semCourses = shuffled.slice((sem - 1) * 6, (sem - 1) * 6 + nCourses);
      if (semCourses.length === 0) break;

      let semSks = 0;
      let semWeightedGp = 0;
      const semGrades: { courseName: string; sks: number; grade: string; gradePoint: number }[] = [];

      for (const c of semCourses) {
        const grade = sampleGrade(rand, c.typicalDifficulty, ability);
        const gp = gradeToGp(grade);
        semGrades.push({ courseName: c.name, sks: c.defaultSks, grade, gradePoint: gp });
        semSks += c.defaultSks;
        semWeightedGp += c.defaultSks * gp;
      }

      const ips = semSks > 0 ? semWeightedGp / semSks : 0;
      cumulativeSks += semSks;
      cumulativeWeightedGp += semWeightedGp;
      ipk = cumulativeSks > 0 ? cumulativeWeightedGp / cumulativeSks : ips;
      lastIps = ips;

      for (const g of semGrades) {
        records.push({
          studentId: `S${s + 1}`,
          major,
          semesterNumber: sem,
          courseName: g.courseName,
          sks: g.sks,
          grade: g.grade,
          gradePoint: g.gradePoint,
          ips,
          ipk,
        });
      }
    }

    // store ability hint implicitly via IPK trend
    void lastIps;
  }

  return records;
}

/** Map major → list of course categories that major would typically take. */
function majorToCategories(major: string): string[] {
  const m = major.toLowerCase();
  if (m.includes("informatika") || m.includes("sistem informasi")) {
    return ["Matematika", "Informatika", "Fisika", "Kimia", "Umum"];
  }
  if (m.includes("sipil") || m.includes("mesin") || m.includes("elektro")) {
    return ["Matematika", "Fisika", "Kimia", "Umum"];
  }
  if (m.includes("manajemen") || m.includes("akuntansi")) {
    return ["Ekonomi", "Bisnis", "Akuntansi", "Matematika", "Umum"];
  }
  if (m.includes("komunikasi")) {
    return ["Komunikasi", "Bisnis", "Umum"];
  }
  if (m.includes("hukum")) {
    return ["Hukum", "Umum"];
  }
  if (m.includes("kedokteran") || m.includes("farmasi")) {
    return ["Kedokteran", "Farmasi", "Sains", "Kimia", "Umum"];
  }
  if (m.includes("biologi")) {
    return ["Sains", "Matematika", "Kimia", "Umum"];
  }
  return ["Matematika", "Umum"];
}
