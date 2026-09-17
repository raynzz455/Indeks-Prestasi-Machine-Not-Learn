/**
 * POST /api/gpa/simulate
 * Body: { currentIpk, totalSks, plannedCourses: {name, sks, grade}[] }
 * Returns: { ips, newIpk, ipkDelta }
 * Lightweight what-if endpoint (no ML — just IPK math).
 */
import { NextRequest, NextResponse } from "next/server";
import { computeIpk, computeIps, normalizeGrade } from "@/lib/gpa";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const currentIpk = Number(body?.currentIpk) || 0;
    const totalSks = Number(body?.totalSks) || 0;
    const planned: { name?: string; sks?: number; grade?: string }[] = Array.isArray(body?.plannedCourses) ? body.plannedCourses : [];

    const items = planned.map((p) => {
      const { gradePoint } = normalizeGrade(p.grade ?? "");
      return { sks: Math.max(1, Number(p.sks) || 3), gradePoint };
    });

    const ips = computeIps(items);
    const newIpk = computeIpk(currentIpk, totalSks, ips, items.reduce((s, i) => s + i.sks, 0));
    return NextResponse.json({
      ips: Math.round(ips * 1000) / 1000,
      newIpk: Math.round(newIpk * 1000) / 1000,
      ipkDelta: Math.round((newIpk - currentIpk) * 1000) / 1000,
    });
  } catch (err) {
    console.error("[/api/gpa/simulate] error:", err);
    return NextResponse.json({ error: "gagal simuasi", detail: String(err) }, { status: 500 });
  }
}
