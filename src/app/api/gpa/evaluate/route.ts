/**
 * GET /api/gpa/evaluate
 *
 * Reads the model training summary from the Python ML service's output
 * (models/training_summary.json). This contains metrics for all 3 models
 * trained on the ~5k row dataset.
 *
 * Returns metrics for:
 * - Model 1 (K-Means): silhouette score, inertia, cluster distribution
 * - Model 2 (Logistic Regression): accuracy, within-1-step, top-3, confusion matrix
 * - Model 3 (Random Forest): accuracy, within-1-step, top-3, feature importances
 */
import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";

export const runtime = "nodejs";

const SUMMARY_PATH = path.join(process.cwd(), "mini-services/ml-service/models/training_summary.json");

export async function GET() {
  try {
    const raw = readFileSync(SUMMARY_PATH, "utf-8");
    const data = JSON.parse(raw);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[/api/gpa/evaluate] error:", err);
    return NextResponse.json(
      { error: "Gagal membaca metrik model. Pastikan model sudah dilatih (jalankan train_models.py).", detail: String(err) },
      { status: 500 }
    );
  }
}
