/**
 * GET /api/gpa/courses
 * Returns the canonical course catalog for autocomplete / browse UI.
 */
import { NextResponse } from "next/server";
import { CANONICAL_COURSES, MAJORS } from "@/lib/gpa";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    courses: CANONICAL_COURSES,
    majors: MAJORS,
  });
}
