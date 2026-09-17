/**
 * POST /api/gpa/normalize
 * Body: { names: string[] }
 * Returns: { results: NormalizationResult[] }
 */
import { NextRequest, NextResponse } from "next/server";
import { normalizeCourseNames } from "@/lib/gpa/course-normalizer";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const names: string[] = Array.isArray(body?.names) ? body.names : [];
    const results = normalizeCourseNames(names.map(String));
    return NextResponse.json({ results });
  } catch (err) {
    console.error("[/api/gpa/normalize] error:", err);
    return NextResponse.json({ error: "gagal normalisasi", detail: String(err) }, { status: 500 });
  }
}
