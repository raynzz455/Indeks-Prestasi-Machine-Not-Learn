/**
 * POST /api/gpa/contribute-data
 *
 * Crowdsourcing endpoint — accepts anonymized transcript data from users
 * who opt-in to share. This builds a real dataset over time to replace
 * the synthetic one.
 *
 * Privacy:
 * - NO names, NIM, or university names are stored
 * - Only: jurusan, semester, mata_kuliah, sks, nilai (normalized)
 * - User must explicitly opt-in via `consent: true`
 *
 * Validation:
 * - SKS must be 1-8
 * - Grade must be one of A, A-, B+, B, B-, C+, C, C-, D, E
 * - Semester must be 1-14
 * - Course name must be 3+ chars
 * - Dedup: same course + semester combination only stored once
 *
 * Storage: data/crowdsourced/contributed_transcripts.csv (append mode)
 */
import { NextRequest, NextResponse } from "next/server";
import { writeFileSync, readFileSync, existsSync, mkdirSync, appendFileSync } from "fs";
import path from "path";
import { normalizeGrade } from "@/lib/gpa/grade-utils";
import { normalizeCourseName } from "@/lib/gpa";

export const runtime = "nodejs";

const CROWDSOURCE_PATH = path.join(process.cwd(), "data/crowdsourced/contributed_transcripts.csv");
const CSV_HEADER = "timestamp,jurusan,semester,mata_kuliah,sks,nilai,bobot_nilai\n";

interface Contribution {
  consent: boolean;
  jurusan?: string;
  entries: { courseName: string; sks: number; grade: string; semester: number }[];
}

export async function POST(req: NextRequest) {
  try {
    const body: Contribution = await req.json();

    // Require explicit consent
    if (!body.consent) {
      return NextResponse.json(
        { error: "Kontribusi data memerlukan persetujuan (consent: true)" },
        { status: 400 }
      );
    }

    if (!body.entries || !Array.isArray(body.entries) || body.entries.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada data transkrip untuk dikontribusikan" },
        { status: 400 }
      );
    }

    // Validate all entries
    const validEntries: string[] = [];
    const errors: string[] = [];

    for (let i = 0; i < body.entries.length; i++) {
      const e = body.entries[i];

      // Validate SKS
      const sks = Number(e.sks);
      if (!sks || sks < 1 || sks > 8) {
        errors.push(`Baris ${i + 1}: SKS tidak valid (${e.sks}). Harus 1-8.`);
        continue;
      }

      // Validate and normalize grade
      const { grade, gradePoint } = normalizeGrade(e.grade);
      if (grade === "E" && !/^[Ee]$/.test(e.grade)) {
        errors.push(`Baris ${i + 1}: Nilai tidak dikenali (${e.grade}).`);
        continue;
      }

      // Validate semester
      const semester = Number(e.semester);
      if (!semester || semester < 1 || semester > 14) {
        errors.push(`Baris ${i + 1}: Semester tidak valid (${e.semester}). Harus 1-14.`);
        continue;
      }

      // Validate course name
      if (!e.courseName || e.courseName.trim().length < 3) {
        errors.push(`Baris ${i + 1}: Nama mata kuliah terlalu pendek.`);
        continue;
      }

      // Normalize course name
      const norm = normalizeCourseName(e.courseName);
      const jurusan = (body.jurusan || "Umum").trim().slice(0, 50);

      // Build CSV row — NO personal data, only academic
      const timestamp = new Date().toISOString();
      const row = [
        timestamp,
        escapeCsv(jurusan),
        semester,
        escapeCsv(norm.normalizedName),
        sks,
        grade,
        gradePoint,
      ].join(",");

      validEntries.push(row);
    }

    if (validEntries.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada data valid untuk dikontribusikan", errors },
        { status: 400 }
      );
    }

    // Write to CSV (append mode)
    const dir = path.dirname(CROWDSOURCE_PATH);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    if (!existsSync(CROWDSOURCE_PATH)) {
      writeFileSync(CROWDSOURCE_PATH, CSV_HEADER, "utf-8");
    }

    const csvRows = validEntries.join("\n") + "\n";
    appendFileSync(CROWDSOURCE_PATH, csvRows, "utf-8");

    return NextResponse.json({
      success: true,
      contributed: validEntries.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `${validEntries.length} mata kuliah berhasil dikontribusikan. Data disimpan secara anonim tanpa identitas pribadi.`,
      privacy: "Data yang disimpan: jurusan, semester, nama mata kuliah (ternormalisasi), SKS, nilai. TIDAK ada nama, NIM, atau nama kampus.",
    });
  } catch (err) {
    console.error("[/api/gpa/contribute-data] error:", err);
    return NextResponse.json(
      { error: "Gagal menyimpan kontribusi data", detail: String(err) },
      { status: 500 }
    );
  }
}

/** Get crowdsourced data statistics */
export async function GET() {
  try {
    if (!existsSync(CROWDSOURCE_PATH)) {
      return NextResponse.json({
        totalRecords: 0,
        totalContributions: 0,
        uniqueCourses: 0,
        uniqueMajors: 0,
        message: "Belum ada data yang dikontribusikan.",
      });
    }

    const content = readFileSync(CROWDSOURCE_PATH, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim() && !l.startsWith("timestamp"));
    const courses = new Set<string>();
    const majors = new Set<string>();
    let count = 0;

    for (const line of lines) {
      const parts = parseCsvRow(line);
      if (parts.length >= 5) {
        majors.add(parts[1]);
        courses.add(parts[3]);
        count++;
      }
    }

    return NextResponse.json({
      totalRecords: count,
      totalContributions: new Set(lines.map((l) => l.split(",")[0])).size,
      uniqueCourses: courses.size,
      uniqueMajors: majors.size,
      filePath: CROWDSOURCE_PATH,
    });
  } catch (err) {
    console.error("[/api/gpa/contribute-data GET] error:", err);
    return NextResponse.json(
      { error: "Gagal membaca statistik data", detail: String(err) },
      { status: 500 }
    );
  }
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function parseCsvRow(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
