/**
 * POST /api/gpa/graduation
 * Body: { currentIpk, totalSks, remainingSemesters, plannedSksPerSem, targetIpk? }
 *
 * Simulates IPK progression until graduation by assuming a consistent
 * performance level (derived from current trend). Returns projected IPK
 * at graduation and whether the target is achievable.
 *
 * Returns: { graduationIpk, achievable, semesters: [...], message }
 */
import { NextRequest, NextResponse } from "next/server";
import { computeIpk } from "@/lib/gpa/grade-utils";

export const runtime = "nodejs";

interface GradSemester {
  semester: number;
  assumedIps: number;
  newSks: number;
  cumulativeSks: number;
  projectedIpk: number;
  ipkDelta: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const currentIpk = Number(body?.currentIpk) || 0;
    const totalSks = Number(body?.totalSks) || 0;
    const remainingSemesters = Math.min(8, Math.max(1, Number(body?.remainingSemesters) || 4));
    const plannedSksPerSem = Math.max(12, Math.min(24, Number(body?.plannedSksPerSem) || 18));
    const targetIpk = typeof body?.targetIpk === "number" ? body.targetIpk : undefined;
    const graduationSksTarget = Math.max(120, Math.min(160, Number(body?.graduationSks) || 144));
    const mode = body?.mode === "difficulty" ? "difficulty" : "baseline";

    // Difficulty-weighted mode: assume the student takes a mix of courses with
    // average difficulty = 0.5 (medium). Expected GP = 4 - difficulty * 1.6.
    // This gives a more realistic projection than assuming IPS = current IPK.
    const avgDifficulty = mode === "difficulty" ? 0.5 : 0;
    const expectedGp = Math.max(0, Math.min(4, 4 - avgDifficulty * 1.6));
    // Blend: 70% current performance + 30% difficulty-adjusted expectation
    const assumedIps = mode === "difficulty"
      ? currentIpk * 0.7 + expectedGp * 0.3
      : currentIpk;

    const semesters: GradSemester[] = [];
    let runningIpk = currentIpk;
    let runningSks = totalSks;

    for (let i = 1; i <= remainingSemesters; i++) {
      const newSks = Math.min(plannedSksPerSem, Math.max(0, graduationSksTarget - runningSks));
      if (newSks <= 0) break; // already graduated
      const newIpk = computeIpk(runningIpk, runningSks, assumedIps, newSks);
      const delta = newIpk - runningIpk;
      semesters.push({
        semester: i,
        assumedIps: Math.round(assumedIps * 1000) / 1000,
        newSks,
        cumulativeSks: runningSks + newSks,
        projectedIpk: Math.round(newIpk * 1000) / 1000,
        ipkDelta: Math.round(delta * 1000) / 1000,
      });
      runningIpk = newIpk;
      runningSks += newSks;
    }

    const graduationIpk = semesters.length > 0
      ? semesters[semesters.length - 1].projectedIpk
      : currentIpk;
    const achievable = targetIpk !== undefined ? graduationIpk >= targetIpk : true;
    const totalDelta = Math.round((graduationIpk - currentIpk) * 1000) / 1000;

    const message = buildMessage({
      currentIpk,
      graduationIpk,
      totalDelta,
      targetIpk,
      achievable,
      remainingSemesters: semesters.length,
      runningSks,
      graduationSksTarget,
    });

    return NextResponse.json({
      graduationIpk: Math.round(graduationIpk * 1000) / 1000,
      currentIpk,
      totalDelta,
      targetIpk,
      achievable,
      semesters,
      finalSks: runningSks,
      graduationSksTarget,
      remainingSemesters: semesters.length,
      message,
    });
  } catch (err) {
    console.error("[/api/gpa/graduation] error:", err);
    return NextResponse.json(
      { error: "Gagal simulasi kelulusan", detail: String(err) },
      { status: 500 }
    );
  }
}

function buildMessage(opts: {
  currentIpk: number;
  graduationIpk: number;
  totalDelta: number;
  targetIpk?: number;
  achievable: boolean;
  remainingSemesters: number;
  runningSks: number;
  graduationSksTarget: number;
}): string {
  const { currentIpk, graduationIpk, totalDelta, targetIpk, achievable, remainingSemesters, runningSks, graduationSksTarget } = opts;
  if (targetIpk !== undefined) {
    if (achievable) {
      return `Target IPK ${targetIpk.toFixed(2)} tercapai saat kelulusan dengan proyeksi ${graduationIpk.toFixed(3)} (Δ +${totalDelta.toFixed(3)} dalam ${remainingSemesters} semester).`;
    }
    const gap = targetIpk - graduationIpk;
    return `Target IPK ${targetIpk.toFixed(2)} belum tercapai. Proyeksi kelulusan ${graduationIpk.toFixed(3)} masih kurang ${gap.toFixed(3)}. Tingkatkan IPS rata-rata ke ${(currentIpk + gap * 2).toFixed(2)}+ untuk mencapai target.`;
  }
  const cumlaudeLabel = graduationIpk >= 3.75 ? "Summa Cumlaude" : graduationIpk >= 3.5 ? "Cumlaude" : graduationIpk >= 3.0 ? "Memuaskan" : "Cukup";
  return `Proyeksi IPK kelulusan: ${graduationIpk.toFixed(3)} (${cumlaudeLabel}) dalam ${remainingSemesters} semester, total ${runningSks}/${graduationSksTarget} SKS.`;
}
