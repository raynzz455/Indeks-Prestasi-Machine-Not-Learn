/**
 * POST /api/gpa/study-plan
 * Body: { courses: {name, sks, difficulty}[], weeklyHours?, targetScenario? }
 *
 * Generates a weekly study plan allocating hours per course based on:
 * - Course difficulty (harder → more hours)
 * - SKS weight (more SKS → more hours)
 * - Target scenario effort multiplier
 *
 * Returns: { totalHours, allocations: [...], tips: [...] }
 */
import { NextRequest, NextResponse } from "next/server";
import { normalizeCourseName } from "@/lib/gpa/course-normalizer";

export const runtime = "nodejs";

interface StudyCourse {
  name: string;
  sks: number;
  difficulty?: number;
}

interface Allocation {
  courseName: string;
  normalizedName: string;
  sks: number;
  difficulty: number;
  hoursPerWeek: number;
  sessionsPerWeek: number;
  priority: "tinggi" | "sedang" | "rendah";
  reason: string;
  tips: string[];
}

const SCENARIO_MULTIPLIER: Record<string, number> = {
  santai: 1.0,
  serius: 1.3,
  keras: 1.6,
  maksimal: 2.0,
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const courses: StudyCourse[] = Array.isArray(body?.courses) ? body.courses : [];
    const weeklyHours = Math.max(10, Math.min(60, Number(body?.weeklyHours) || 25));
    const targetScenario = typeof body?.targetScenario === "string" ? body.targetScenario : "serius";

    if (courses.length === 0) {
      return NextResponse.json({ error: "Minimal 1 mata kuliah diperlukan" }, { status: 400 });
    }

    const multiplier = SCENARIO_MULTIPLIER[targetScenario] ?? 1.3;

    // Normalize courses and compute base weight = SKS × (1 + difficulty)
    const normalized = courses.map((c) => {
      const norm = normalizeCourseName(c.name);
      const difficulty = c.difficulty ?? norm.typicalDifficulty ?? 0.5;
      const baseWeight = c.sks * (1 + difficulty);
      return {
        ...c,
        normalizedName: norm.normalizedName,
        difficulty,
        baseWeight,
      };
    });

    const totalBaseWeight = normalized.reduce((s, c) => s + c.baseWeight, 0);

    // Allocate hours proportionally, then scale to weeklyHours
    const allocations: Allocation[] = normalized.map((c) => {
      const proportion = c.baseWeight / totalBaseWeight;
      const rawHours = weeklyHours * proportion * multiplier;
      const hoursPerWeek = Math.max(2, Math.round(rawHours));
      // Sessions: ~1.5h per session
      const sessionsPerWeek = Math.max(1, Math.round(hoursPerWeek / 1.5));
      const priority: Allocation["priority"] =
        c.difficulty >= 0.7 ? "tinggi" : c.difficulty >= 0.4 ? "sedang" : "rendah";
      const reason = buildReason(c, hoursPerWeek, priority);
      const tips = buildTips(c, hoursPerWeek, sessionsPerWeek);
      return {
        courseName: c.name,
        normalizedName: c.normalizedName,
        sks: c.sks,
        difficulty: c.difficulty,
        hoursPerWeek,
        sessionsPerWeek,
        priority,
        reason,
        tips,
      };
    });

    // Sort by hours descending
    allocations.sort((a, b) => b.hoursPerWeek - a.hoursPerWeek);

    const totalAllocated = allocations.reduce((s, a) => s + a.hoursPerWeek, 0);

    const generalTips = [
      `Total ${totalAllocated} jam/minggu untuk ${allocations.length} mata kuliah (target skenario "${targetScenario}").`,
      `Bagi waktu belajar ke sesi ${allocations.reduce((s, a) => s + a.sessionsPerWeek, 0)}x per minggu (~1.5 jam/sesi).`,
      "Gunakan teknik Pomodoro (25 menit fokus + 5 menit istirahat) untuk retensi maksimal.",
      "Latihan soal 2x lebih efektif daripada membaca ulang — alokasikan 60% waktu untuk latihan.",
    ];

    return NextResponse.json({
      totalHours: totalAllocated,
      weeklyHoursTarget: weeklyHours,
      scenario: targetScenario,
      multiplier,
      allocations,
      generalTips,
      count: allocations.length,
    });
  } catch (err) {
    console.error("[/api/gpa/study-plan] error:", err);
    return NextResponse.json(
      { error: "Gagal membuat rencana belajar", detail: String(err) },
      { status: 500 }
    );
  }
}

function buildReason(c: { difficulty: number; sks: number; normalizedName: string }, hours: number, priority: string): string {
  const diffLabel = c.difficulty < 0.3 ? "sangat mudah" : c.difficulty < 0.5 ? "mudah" : c.difficulty < 0.7 ? "menengah" : "sulit";
  return `${c.sks} SKS · ${diffLabel} · prioritas ${priority} · ${hours} jam/minggu`;
}

function buildTips(c: { difficulty: number; normalizedName: string }, hours: number, sessions: number): string[] {
  const tips: string[] = [];
  if (c.difficulty >= 0.7) {
    tips.push("Mata kuliah sulit — mulai dari konsep dasar, jangan langsung ke soal rumit.");
    tips.push("Bentuk kelompok belajar 2-3 orang untuk diskusi mingguan.");
    tips.push(`Alokasikan ${Math.ceil(hours * 0.4)} jam untuk latihan soal.`);
  } else if (c.difficulty >= 0.4) {
    tips.push("Tingkat menengah — fokus pada pemahaman konsep + latihan soal pilihan.");
    tips.push(`Bagi ${sessions} sesi menjadi: 2 teori, ${sessions - 2} latihan.`);
  } else {
    tips.push("Mata kuliah mudah — cukup baca materi + kerjakan tugas tepat waktu.");
    tips.push("Manfaatkan waktu untuk membantu mata kuliah sulit lainnya.");
  }
  if (sessions >= 4) {
    tips.push("Sebarkan sesi ke beberapa hari — jangan belajar semua sekaligus.");
  }
  return tips;
}
