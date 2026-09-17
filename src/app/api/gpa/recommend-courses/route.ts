/**
 * POST /api/gpa/recommend-courses
 * Body: { currentIpk, totalSks, plannedCourseNames: string[], targetIpk?, maxResults? }
 *
 * Recommends additional elective courses from the canonical catalog that
 * would maximize IPK improvement. Each recommendation includes:
 * - course name, SKS, typical difficulty
 * - estimated IPK impact (delta if student gets A)
 * - reason (e.g., "mudah, dampak IPK tinggi")
 *
 * Returns: { recommendations: CourseRecommendation[] }
 */
import { NextRequest, NextResponse } from "next/server";
import { CANONICAL_COURSES, type CanonicalCourse } from "@/lib/gpa/config";
import { computeIpk } from "@/lib/gpa/grade-utils";

export const runtime = "nodejs";

interface CourseRecommendation {
  name: string;
  category: string;
  sks: number;
  difficulty: number;
  estimatedDelta: number; // delta if student gets A
  expectedDelta: number; // difficulty-weighted delta
  expectedGp: number; // expected grade point based on difficulty
  reason: string;
  impactScore: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const currentIpk = Number(body?.currentIpk) || 0;
    const totalSks = Number(body?.totalSks) || 0;
    const plannedNames: string[] = Array.isArray(body?.plannedCourseNames) ? body.plannedCourseNames : [];
    const targetIpk = typeof body?.targetIpk === "number" ? body.targetIpk : undefined;
    const maxResults = Math.min(10, Math.max(3, Number(body?.maxResults) || 6));

    // Exclude already-planned courses
    const plannedSet = new Set(plannedNames.map((n) => n.toLowerCase().trim()));
    const candidates = CANONICAL_COURSES.filter(
      (c) => !plannedSet.has(c.name.toLowerCase()) && c.category !== "Wajib"
    );

    // For each candidate, compute the IPK delta if the student gets A (4.0)
    const recommendations: CourseRecommendation[] = candidates.map((c) => {
      const ipsA = 4.0; // assume A
      const newIpkA = computeIpk(currentIpk, totalSks, ipsA, c.defaultSks);
      const deltaA = newIpkA - currentIpk;

      // Difficulty-weighted expected GP: harder courses → lower expected grade
      const expectedGp = Math.max(0, Math.min(4, 4 - c.typicalDifficulty * 1.6));
      const newIpkExpected = computeIpk(currentIpk, totalSks, expectedGp, c.defaultSks);
      const deltaExpected = newIpkExpected - currentIpk;

      // Impact score blends A-scenario delta (optimistic) with expected delta (realistic)
      // Weight: 40% A-scenario + 60% expected (difficulty-weighted)
      const impactScore = deltaA * 0.4 + deltaExpected * 0.6;
      const reason = buildReason(c, deltaA, deltaExpected, targetIpk);
      return {
        name: c.name,
        category: c.category,
        sks: c.defaultSks,
        difficulty: c.typicalDifficulty,
        estimatedDelta: Math.round(deltaA * 1000) / 1000,
        expectedDelta: Math.round(deltaExpected * 1000) / 1000,
        expectedGp: Math.round(expectedGp * 100) / 100,
        reason,
        impactScore: Math.round(impactScore * 10000) / 10000,
      };
    });

    // Sort by impact score descending (easy + high delta first)
    recommendations.sort((a, b) => b.impactScore - a.impactScore);

    const top = recommendations.slice(0, maxResults);

    return NextResponse.json({
      recommendations: top,
      currentIpk,
      totalSks,
      targetIpk,
      count: top.length,
    });
  } catch (err) {
    console.error("[/api/gpa/recommend-courses] error:", err);
    return NextResponse.json(
      { error: "Gagal membuat rekomendasi mata kuliah", detail: String(err) },
      { status: 500 }
    );
  }
}

function buildReason(c: CanonicalCourse, deltaA: number, deltaExpected: number, targetIpk?: number): string {
  const diffLabel =
    c.typicalDifficulty < 0.3 ? "sangat mudah"
    : c.typicalDifficulty < 0.5 ? "mudah"
    : c.typicalDifficulty < 0.7 ? "menengah"
    : "sulit";
  const expectedGp = Math.max(0, Math.min(4, 4 - c.typicalDifficulty * 1.6));
  let reason = `${c.defaultSks} SKS · ${diffLabel} · +${deltaA.toFixed(3)} IPK jika A, +${deltaExpected.toFixed(3)} realistis (nilai ${expectedGp.toFixed(1)})`;
  if (targetIpk && deltaA > 0) {
    reason += ` · target ${targetIpk.toFixed(2)}`;
  }
  return reason;
}
