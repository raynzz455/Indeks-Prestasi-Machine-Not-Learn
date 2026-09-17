/**
 * POST /api/gpa/parse-transcript
 * Body: { text: string } — raw text pasted from a transcript (Excel, PDF copy, etc.)
 *
 * Parses the text using regex + string matching (NO LLM/VLM).
 * Recognizes common Indonesian transcript formats:
 * - Tab/comma separated: name, sks, grade, semester
 * - Lines with mixed text + numbers
 * - Grade variants (A, AB, B+, 3.5, 85, etc.)
 *
 * Returns: { entries: ParsedEntry[], major?, ipk?, count }
 */
import { NextRequest, NextResponse } from "next/server";
import { normalizeGrade } from "@/lib/gpa/grade-utils";

export const runtime = "nodejs";

interface ParsedEntry {
  id: string;
  courseName: string;
  sks: string;
  grade: string;
  gradePoint: number;
  semester: string;
  major: string;
}

const GRADE_PATTERN = /\b(A|A-|B\+|B|B-|C\+|C|C-|D|E|AB|BC|CD)\b/i;
const SKS_PATTERN = /\b([1-8])\b/;
// Detect "Semester X" or "Sem X" or "Semester: X" or standalone number 1-14
const SEMESTER_PATTERN = /(?:semester|sem)\s*:?\s*(\d{1,2})/i;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text: string = typeof body?.text === "string" ? body.text : "";
    const defaultMajor: string = typeof body?.major === "string" ? body.major : "Umum";

    if (!text.trim()) {
      return NextResponse.json(
        { error: "Teks transkrip kosong. Tempel teks dari Excel/PDF transkrip." },
        { status: 400 }
      );
    }

    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const entries: ParsedEntry[] = [];
    let currentSemester = 1;
    let detectedMajor = defaultMajor;

    // Try to detect major from text
    for (const line of lines.slice(0, 5)) {
      const majorMatch = line.match(/(?:jurusan|program studi|prodi|major)\s*:?\s*(.+)/i);
      if (majorMatch) {
        detectedMajor = majorMatch[1].trim().slice(0, 50);
        break;
      }
    }

    // Try to detect semester context from lines like "Semester 1" or "SEMESTER III"
    for (const line of lines) {
      const semMatch = line.match(SEMESTER_PATTERN);
      if (semMatch) {
        const sem = parseInt(semMatch[1], 10);
        if (sem >= 1 && sem <= 14) {
          currentSemester = sem;
        }
      }
    }

    for (const line of lines) {
      // Skip header lines
      if (/^(no\.?|kode|mata kuliah|nama|sks|nilai|bobot|grade|semester|ipk|ips|lulus|total)/i.test(line)) {
        continue;
      }
      // Skip lines that are just numbers or too short
      if (line.length < 3) continue;

      // Try tab/comma separated format first
      const parts = line.split(/\t|,|;|\s{2,}|\|/).map((p) => p.trim()).filter(Boolean);

      let courseName = "";
      let sks = 3;
      let grade = "";
      let semester = currentSemester;

      if (parts.length >= 3) {
        // Format: name, sks, grade [, semester]
        courseName = parts[0];
        const sksMatch = parts.find((p) => /^\d{1,2}$/.test(p) && parseInt(p) >= 1 && parseInt(p) <= 8);
        if (sksMatch) sks = parseInt(sksMatch);
        const gradePart = parts.find((p) => GRADE_PATTERN.test(p) || /^\d{1,3}([.,]\d)?$/.test(p));
        if (gradePart) grade = gradePart;
        const semPart = parts.find((p) => /^\d{1,2}$/.test(p) && parseInt(p) >= 1 && parseInt(p) <= 14 && p !== String(sks));
        if (semPart) semester = parseInt(semPart);
      } else {
        // Try to extract from a single line
        const gradeMatch = line.match(GRADE_PATTERN);
        if (gradeMatch) {
          grade = gradeMatch[0];
        } else {
          // Try numeric grade (0-100 or 0-4)
          const numMatch = line.match(/\b(\d{1,3}(?:[.,]\d)?)\b\s*$/);
          if (numMatch) {
            const num = parseFloat(numMatch[1].replace(",", "."));
            if (num >= 0 && num <= 100) {
              grade = String(num);
            }
          }
        }
        // Extract SKS
        const sksMatch = line.match(/\b([1-8])\b/);
        if (sksMatch) sks = parseInt(sksMatch[1]);
        // Extract semester
        const semMatch = line.match(SEMESTER_PATTERN);
        if (semMatch) {
          const sem = parseInt(semMatch[1], 10);
          if (sem >= 1 && sem <= 14) semester = sem;
        }
        // Course name = line minus grade/sks/numbers
        if (!courseName) {
          courseName = line
            .replace(GRADE_PATTERN, "")
            .replace(/\b\d{1,3}(?:[.,]\d)?\b/g, "")
            .replace(/\s+/g, " ")
            .trim();
        }
      }

      // Clean course name — remove codes like "IF2101" at the start
      courseName = courseName.replace(/^[A-Z]{2,4}\d{3,4}\s*/i, "").trim();

      // Skip if no course name or no grade
      if (!courseName || courseName.length < 3) continue;
      if (!grade) continue;

      const { grade: normalizedGrade, gradePoint } = normalizeGrade(grade);
      if (normalizedGrade === "E" && !/^[Ee]$/.test(grade)) continue; // skip if normalization failed to E from non-E input

      entries.push({
        id: `parsed-${entries.length}`,
        courseName,
        sks: String(sks),
        grade: normalizedGrade,
        gradePoint,
        semester: String(semester),
        major: detectedMajor,
      });
    }

    // Deduplicate by courseName + semester (keep first occurrence)
    const seen = new Set<string>();
    const deduped = entries.filter((e) => {
      const key = `${e.courseName}-${e.semester}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Calculate IPK if enough entries
    let ipk: number | undefined;
    if (deduped.length > 0) {
      const totalSks = deduped.reduce((s, e) => s + Number(e.sks), 0);
      const weighted = deduped.reduce((s, e) => s + Number(e.sks) * e.gradePoint, 0);
      if (totalSks > 0) ipk = Math.round((weighted / totalSks) * 1000) / 1000;
    }

    return NextResponse.json({
      entries: deduped,
      major: detectedMajor !== "Umum" ? detectedMajor : undefined,
      ipk,
      count: deduped.length,
    });
  } catch (err) {
    console.error("[/api/gpa/parse-transcript] error:", err);
    return NextResponse.json(
      { error: "Gagal memproses teks transkrip", detail: String(err) },
      { status: 500 }
    );
  }
}
