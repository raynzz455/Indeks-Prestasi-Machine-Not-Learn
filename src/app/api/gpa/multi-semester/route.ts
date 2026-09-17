/**
 * POST /api/gpa/multi-semester
 * Body: { transcript, semesterPlans: [{courses: PlannedCourse[]}], targetIpk? }
 * Returns: MultiSemesterPlan
 */
import { NextRequest, NextResponse } from "next/server";
import { planMultiSemester } from "@/lib/gpa/multi-semester";
import { normalizeCourseName } from "@/lib/gpa/course-normalizer";
import { normalizeGrade } from "@/lib/gpa/grade-utils";
import type { TranscriptEntry, PlannedCourse } from "@/lib/gpa/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawTranscript = Array.isArray(body?.transcript) ? body.transcript : [];
    const semesterPlansRaw = Array.isArray(body?.semesterPlans) ? body.semesterPlans : [];
    const targetIpk = typeof body?.targetIpk === "number" ? body.targetIpk : undefined;

    const transcript: TranscriptEntry[] = rawTranscript.map((r: any, i: number) => {
      const norm = normalizeCourseName(r.courseName ?? "");
      const { grade, gradePoint } = normalizeGrade(r.grade ?? "");
      return {
        id: r.id ?? `t-${i}`,
        courseName: r.courseName ?? "",
        normalizedName: norm.normalizedName,
        sks: Math.max(1, Math.min(8, Number(r.sks) || 3)),
        grade,
        gradePoint,
        semester: Math.max(1, Math.min(14, Number(r.semester) || 1)),
        major: r.major?.trim() || "Umum",
      };
    });

    const semesterPlans = semesterPlansRaw.map((sp: any) => ({
      courses: (Array.isArray(sp?.courses) ? sp.courses : []).map((p: any, i: number) => {
        const norm = normalizeCourseName(p.courseName ?? "");
        return {
          id: p.id ?? `p-${i}`,
          courseName: p.courseName ?? "",
          normalizedName: norm.normalizedName,
          sks: Math.max(1, Math.min(8, Number(p.sks) || norm.defaultSks || 3)),
          userDifficultyOverride:
            typeof p.userDifficultyOverride === "number"
              ? Math.max(0, Math.min(1, p.userDifficultyOverride))
              : undefined,
        } as PlannedCourse;
      }),
    }));

    if (semesterPlans.length === 0 || semesterPlans.every((sp) => sp.courses.length === 0)) {
      return NextResponse.json(
        { error: "Minimal 1 semester dengan 1 mata kuliah harus diisi" },
        { status: 400 }
      );
    }

    const plan = await planMultiSemester({ transcript, semesterPlans, targetIpk });
    return NextResponse.json(plan);
  } catch (err) {
    console.error("[/api/gpa/multi-semester] error:", err);
    return NextResponse.json(
      { error: "Gagal menjalankan perencanaan multi-semester", detail: String(err) },
      { status: 500 }
    );
  }
}
