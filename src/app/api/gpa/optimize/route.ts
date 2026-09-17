/**
 * POST /api/gpa/optimize
 * Body: { transcript: TranscriptEntry[], plannedCourses: PlannedCourse[], targetIpk?: number }
 *
 * Spawns a Python subprocess that uses scikit-learn models
 * (K-Means + Logistic Regression + Random Forest) trained on a ~5k row dataset.
 *
 * Uses child_process.spawn() for reliable stdin/stdout pipe handling.
 *
 * Returns: OptimizationResult
 */
import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { normalizeCourseName } from "@/lib/gpa";
import { normalizeGrade } from "@/lib/gpa/grade-utils";
import path from "path";

export const runtime = "nodejs";
export const maxDuration = 60;

const PYTHON_BIN = path.join(process.cwd(), "mini-services/ml-service/.venv/bin/python");
const SCRIPT_PATH = path.join(process.cwd(), "mini-services/ml-service/optimize_cli.py");
const CWD = path.join(process.cwd(), "mini-services/ml-service");

interface RawTranscriptEntry {
  id?: string;
  courseName?: string;
  sks?: number;
  grade?: string;
  semester?: number;
  major?: string;
}

interface RawPlannedCourse {
  id?: string;
  courseName?: string;
  sks?: number;
  userDifficultyOverride?: number;
}

function runPython(input: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON_BIN, [SCRIPT_PATH], {
      cwd: CWD,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, 30000);

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error("Python script timed out after 30s"));
      } else if (code !== 0) {
        reject(new Error(`Python script exited with code ${code}. stderr: ${stderr.slice(0, 500)}`));
      } else {
        resolve({ stdout, stderr });
      }
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    // Write input to stdin
    child.stdin.write(input);
    child.stdin.end();
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawTranscript: RawTranscriptEntry[] = Array.isArray(body?.transcript) ? body.transcript : [];
    const rawPlanned: RawPlannedCourse[] = Array.isArray(body?.plannedCourses) ? body.plannedCourses : [];
    const targetIpk: number | undefined =
      typeof body?.targetIpk === "number" ? body.targetIpk : undefined;

    // Normalize transcript
    const transcript = rawTranscript.map((r) => {
      const { grade } = normalizeGrade(r.grade ?? "");
      return {
        courseName: r.courseName ?? "",
        sks: Math.max(1, Math.min(8, Number(r.sks) || 3)),
        grade,
        semester: Math.max(1, Math.min(14, Number(r.semester) || 1)),
        major: r.major?.trim() || "Umum",
      };
    });

    const plannedCourses = rawPlanned.map((r) => ({
      courseName: r.courseName ?? "",
      sks: Math.max(1, Math.min(8, Number(r.sks) || 3)),
      userDifficultyOverride:
        typeof r.userDifficultyOverride === "number"
          ? Math.max(0, Math.min(1, r.userDifficultyOverride))
          : undefined,
    }));

    if (plannedCourses.length === 0) {
      return NextResponse.json(
        { error: "minimal 1 mata kuliah target harus diisi" },
        { status: 400 }
      );
    }

    // Call Python script via subprocess
    const inputJson = JSON.stringify({ transcript, plannedCourses, targetIpk });
    const { stdout, stderr } = await runPython(inputJson);

    if (stderr) {
      console.error("[/api/gpa/optimize] Python stderr:", stderr.slice(0, 500));
    }

    const result = JSON.parse(stdout.trim());
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[/api/gpa/optimize] error:", err);
    return NextResponse.json(
      { error: "gagal menjalankan optimasi (Python ML)", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
