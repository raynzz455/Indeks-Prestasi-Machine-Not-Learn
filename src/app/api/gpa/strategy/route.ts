/**
 * POST /api/gpa/strategy
 * Body: OptimizationResult (from /api/gpa/optimize)
 *
 * Generates a recommended strategy using a RULE-BASED algorithm (no LLM).
 * Analyzes the optimization result to produce:
 * - strategy: a natural-language summary
 * - tips: actionable per-course tips based on difficulty + IPK impact
 *
 * This replaces the previous LLM-based implementation with a deterministic,
 * transparent rule-based approach that runs instantly.
 */
import { NextRequest, NextResponse } from "next/server";
import type { OptimizationResult } from "@/lib/gpa/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const result: OptimizationResult = await req.json();
    if (!result || !result.summary) {
      return NextResponse.json({ error: "Bad request: missing optimization result" }, { status: 400 });
    }

    const { summary, classifiedCourses, scenarios } = result;

    // Build strategy text
    const strategy = buildStrategy(summary, classifiedCourses);

    // Build actionable tips
    const tips = buildTips(summary, classifiedCourses, scenarios);

    return NextResponse.json({ strategy, tips });
  } catch (err) {
    console.error("[/api/gpa/strategy] error:", err);
    return NextResponse.json(
      { error: "Gagal membuat strategi", detail: String(err) },
      { status: 500 }
    );
  }
}

function buildStrategy(
  summary: OptimizationResult["summary"],
  courses: OptimizationResult["classifiedCourses"]
): string {
  const parts: string[] = [];

  // Opening: best scenario + projected IPK
  parts.push(
    `Fokus pada skenario "${summary.bestScenario}" untuk mencapai IPK ${summary.bestOverallNewIpk.toFixed(3)}`
  );

  // Delta context
  if (summary.bestOverallDelta > 0) {
    parts.push(`kenaikan +${summary.bestOverallDelta.toFixed(3)} dari ${summary.currentIpk.toFixed(3)}`);
  }

  // Target context
  if (summary.targetIpk !== undefined) {
    if (summary.achievable) {
      parts.push(`target ${summary.targetIpk.toFixed(2)} tercapai`);
    } else {
      const gap = summary.targetIpk - summary.bestOverallNewIpk;
      parts.push(`masih kurang ${gap.toFixed(3)} dari target ${summary.targetIpk.toFixed(2)}`);
    }
  }

  // Hardest course focus
  const hardest = [...courses].sort((a, b) => b.difficultyScore - a.difficultyScore)[0];
  if (hardest) {
    parts.push(`prioritaskan ${hardest.courseName} karena paling sulit`);
  }

  return parts.join(", ") + ".";
}

function buildTips(
  summary: OptimizationResult["summary"],
  courses: OptimizationResult["classifiedCourses"],
  scenarios: OptimizationResult["scenarios"]
): string[] {
  const tips: string[] = [];

  // Sort courses by difficulty descending (hardest first)
  const sorted = [...courses].sort((a, b) => b.difficultyScore - a.difficultyScore);

  for (const c of sorted.slice(0, 5)) {
    const diffLabel = c.difficultyLabel.replace("_", " ");
    if (c.difficultyScore >= 0.7) {
      tips.push(
        `${c.courseName}: mata kuliah ${diffLabel} — mulai dari konsep dasar, bentuk kelompok belajar, alokasikan 60% waktu untuk latihan soal.`
      );
    } else if (c.difficultyScore >= 0.4) {
      tips.push(
        `${c.courseName}: tingkat ${diffLabel} — fokus pemahaman konsep + latihan soal pilihan, bagi waktu 40% teori 60% latihan.`
      );
    } else {
      tips.push(
        `${c.courseName}: mata kuliah ${diffLabel} — cukup baca materi + kerjakan tugas tepat waktu, manfaatkan sisa waktu untuk MK sulit lain.`
      );
    }
  }

  // Add scenario-specific tip
  const bestScenario = scenarios.find((s) => s.scenario === summary.bestScenario);
  if (bestScenario && bestScenario.combinations.length > 0) {
    const topCombo = bestScenario.combinations[0];
    const aGrades = topCombo.grades.filter((g) => g.grade === "A").length;
    const totalGrades = topCombo.grades.length;
    tips.push(
      `Skenario "${summary.bestScenario}": target ${aGrades} dari ${totalGrades} mata kuliah dapat A untuk IPK ${topCombo.newIpk.toFixed(3)}.`
    );
  }

  // Add target gap tip
  if (summary.targetIpk !== undefined && !summary.achievable) {
    const gap = summary.targetIpk - summary.bestOverallNewIpk;
    tips.push(
      `Target ${summary.targetIpk.toFixed(2)} belum tercapai (kurang ${gap.toFixed(3)}). Pertimbangkan menambah SKS mudah atau menaikkan effort ke "maksimal".`
    );
  }

  return tips.slice(0, 6);
}
