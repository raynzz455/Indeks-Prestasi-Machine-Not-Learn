/**
 * POST /api/gpa/train
 * Body: { transcript: TranscriptEntry[] }
 *
 * Proxies to the Python ML service (port 3030) to retrain all models
 * (K-Means + Logistic Regression + Random Forest) on the dataset.
 *
 * Returns: { trainedAt, message }
 */
import { NextRequest, NextResponse } from "next/server";
import { normalizeCourseName } from "@/lib/gpa";
import { normalizeGrade } from "@/lib/gpa/grade-utils";

export const runtime = "nodejs";

const ML_SERVICE_URL = "http://localhost:3030";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawTranscript = Array.isArray(body?.transcript) ? body.transcript : [];

    const transcript = rawTranscript.map((r: any, i: number) => {
      const norm = normalizeCourseName(r.courseName ?? "");
      const { grade, gradePoint } = normalizeGrade(r.grade ?? "");
      return {
        courseName: r.courseName ?? "",
        sks: Math.max(1, Math.min(8, Number(r.sks) || 3)),
        grade,
        semester: Math.max(1, Math.min(14, Number(r.semester) || 1)),
        major: r.major?.trim() || "Umum",
      };
    });

    // Call the Python service to retrain
    const res = await fetch(`${ML_SERVICE_URL}/train`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      throw new Error(`ML service error: ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json({
      trainedAt: Date.now(),
      message: `Model dilatih ulang di Python service (K-Means + Logistic Regression + Random Forest) pada ${data?.dataset?.total_rows ?? 5000} rows.`,
      summary: data,
    });
  } catch (err) {
    console.error("[/api/gpa/train] error:", err);
    return NextResponse.json(
      { error: "Gagal retrain", detail: String(err) },
      { status: 500 }
    );
  }
}
