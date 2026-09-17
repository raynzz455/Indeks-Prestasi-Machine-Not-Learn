"use client";

import { useState, useEffect } from "react";
import {
  Cpu,
  Loader2,
  TrendingUp,
  Target,
  Grid3x3,
  Database,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { FadeIn } from "./motion";
import { cn } from "@/lib/utils";

interface ModelEvaluation {
  model1: {
    name: string;
    silhouette: number;
    inertia: number;
    clusterSizes: number[];
    clusterLabels: string[];
    testSize: number;
    trainSize: number;
    description: string;
  };
  model2: {
    name: string;
    exactAccuracy: number;
    within1StepAccuracy: number;
    within2StepAccuracy: number;
    top3Accuracy: number;
    confusionMatrix: number[][];
    gradeOrder: string[];
    perClassPrecision: number[];
    perClassRecall: number[];
    testSize: number;
    trainSize: number;
    description: string;
  };
  dataset: {
    totalRecords: number;
    students: number;
    majors: number;
    courses: number;
    meanIpk: number;
    splitRatio: string;
  };
  evaluatedAt: number;
}

export function ModelEvaluationDashboard() {
  const [loading, setLoading] = useState(false);
  const [evaluation, setEvaluation] = useState<ModelEvaluation | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fetchEvaluation() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/gpa/evaluate");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setEvaluation(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!evaluation) {
      fetchEvaluation();
    }
  }, []);

  return (
    <FadeIn delay={0.1}>
      <Card className="border-2 border-sky-500/30 bg-gradient-to-br from-sky-500/5 via-cyan-500/5 to-transparent overflow-hidden relative">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 via-cyan-500 to-blue-500 opacity-60" />
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-sky-500 to-cyan-600 text-white shadow-sm">
                  <Cpu className="size-4" />
                </div>
                Evaluasi Model ML
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Metrik akurasi Model 1 (K-Means) & Model 2 (Logistic Regression) pada test set.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchEvaluation}
              disabled={loading}
              className="gap-1.5 border-sky-500/40 text-sky-700 dark:text-sky-300 hover:bg-sky-500/10"
            >
              {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              {loading ? "Mengevaluasi..." : "Evaluasi ulang"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="space-y-3">
              <div className="h-4 w-full rounded bg-sky-500/10 animate-pulse" />
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-16 rounded-lg border bg-muted/20 animate-pulse" />
                ))}
              </div>
              <div className="h-32 rounded-lg border bg-muted/20 animate-pulse" />
            </div>
          ) : error ? (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-sm text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertTriangle className="size-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : evaluation ? (
            <>
              {/* Dataset info */}
              <div className="rounded-lg border bg-card/40 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="size-3.5 text-sky-600" />
                  <span className="text-xs font-semibold">Dataset</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                  <Stat label="Records" value={String(evaluation.dataset.totalRecords)} />
                  <Stat label="Students" value={String(evaluation.dataset.students)} />
                  <Stat label="Majors" value={String(evaluation.dataset.majors)} />
                  <Stat label="Courses" value={String(evaluation.dataset.courses)} />
                  <Stat label="Mean IPK" value={evaluation.dataset.meanIpk.toFixed(3)} />
                  <Stat label="Split" value={evaluation.dataset.splitRatio} />
                </div>
              </div>

              {/* Model 1: K-Means */}
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="grid size-5 place-items-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-mono font-bold">
                      1
                    </span>
                    <span className="text-sm font-semibold">{evaluation.model1.name}</span>
                  </div>
                  <Badge variant="outline" className="text-[9px] border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
                    Unsupervised
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">{evaluation.model1.description}</p>
                <div className="grid grid-cols-2 gap-2">
                  <MetricCard
                    label="Silhouette Score"
                    value={evaluation.model1.silhouette.toFixed(3)}
                    hint={silhouetteLabel(evaluation.model1.silhouette)}
                    accent={evaluation.model1.silhouette > 0.2 ? "good" : evaluation.model1.silhouette > 0 ? "ok" : "warn"}
                  />
                  <MetricCard
                    label="Inertia"
                    value={String(evaluation.model1.inertia)}
                    hint="Sum of squared distances"
                    accent="neutral"
                  />
                </div>
                {/* Cluster distribution */}
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Distribusi Cluster</div>
                  <div className="flex items-center gap-1 flex-wrap">
                    {evaluation.model1.clusterSizes.map((size, i) => {
                      const total = evaluation.model1.clusterSizes.reduce((s, n) => s + n, 0);
                      const pct = total > 0 ? (size / total) * 100 : 0;
                      return (
                        <div key={i} className="rounded-md border px-2 py-1 text-[10px]">
                          <div className="font-medium capitalize">{evaluation.model1.clusterLabels[i] ?? `C${i}`}</div>
                          <div className="font-mono tabular-nums">{size} ({pct.toFixed(0)}%)</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Model 2: Logistic Regression */}
              <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="grid size-5 place-items-center rounded-full bg-violet-500/15 text-violet-700 dark:text-violet-300 text-[10px] font-mono font-bold">
                      2
                    </span>
                    <span className="text-sm font-semibold">{evaluation.model2.name}</span>
                  </div>
                  <Badge variant="outline" className="text-[9px] border-violet-500/40 text-violet-700 dark:text-violet-300">
                    Supervised · 80/20 split
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">{evaluation.model2.description}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <MetricCard
                    label="Exact Accuracy"
                    value={`${(evaluation.model2.exactAccuracy * 100).toFixed(1)}%`}
                    hint={`${evaluation.model2.exactAccuracy.toFixed(3)}`}
                    accent={evaluation.model2.exactAccuracy > 0.2 ? "good" : "ok"}
                  />
                  <MetricCard
                    label="Within-1-Step"
                    value={`${(evaluation.model2.within1StepAccuracy * 100).toFixed(1)}%`}
                    hint="Prediksi ±1 grade"
                    accent={evaluation.model2.within1StepAccuracy > 0.5 ? "good" : "ok"}
                  />
                  <MetricCard
                    label="Within-2-Step"
                    value={`${(evaluation.model2.within2StepAccuracy * 100).toFixed(1)}%`}
                    hint="Prediksi ±2 grade"
                    accent={evaluation.model2.within2StepAccuracy > 0.7 ? "good" : "ok"}
                  />
                  <MetricCard
                    label="Top-3 Accuracy"
                    value={`${(evaluation.model2.top3Accuracy * 100).toFixed(1)}%`}
                    hint="Actual di top-3 prediksi"
                    accent={evaluation.model2.top3Accuracy > 0.7 ? "good" : "ok"}
                  />
                </div>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span>Train: {evaluation.model2.trainSize} rows</span>
                  <span>Test: {evaluation.model2.testSize} rows</span>
                </div>
              </div>

              {/* Confusion matrix */}
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <Grid3x3 className="size-3" />
                  Confusion Matrix (Model 2)
                </div>
                <div className="overflow-x-auto scrollbar-thin">
                  <table className="w-full text-[9px] border-collapse">
                    <thead>
                      <tr>
                        <th className="px-1 py-1 text-right text-muted-foreground">Act \ Pred</th>
                        {evaluation.model2.gradeOrder.map((g) => (
                          <th key={g} className="px-1 py-1 text-center font-mono font-semibold">{g}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {evaluation.model2.confusionMatrix.map((row, i) => {
                        const max = Math.max(...row);
                        return (
                          <tr key={i}>
                            <td className="px-1 py-1 text-right font-mono font-semibold text-muted-foreground">
                              {evaluation.model2.gradeOrder[i]}
                            </td>
                            {row.map((val, j) => {
                              const intensity = max > 0 ? val / max : 0;
                              return (
                                <td
                                  key={j}
                                  className="px-1 py-1 text-center font-mono tabular-nums border border-border/30"
                                  style={{
                                    backgroundColor: intensity > 0
                                      ? `oklch(${0.97 - intensity * 0.55} 0.15 280)`
                                      : "oklch(0.97 0 0)",
                                    color: intensity > 0.5 ? "white" : "oklch(0.3 0 0)",
                                  }}
                                  title={`Actual ${evaluation.model2.gradeOrder[i]} → Pred ${evaluation.model2.gradeOrder[j]}: ${val}`}
                                >
                                  {val > 0 ? val : ""}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Diagonal = prediksi benar. Warna gelap = nilai tinggi.</span>
                  <div className="flex items-center gap-1">
                    <span>0</span>
                    <div className="h-2 w-16 rounded bg-gradient-to-r from-oklch(0.95 0 0) via-oklch(0.6 0.15 280) to-oklch(0.3 0.15 280)" />
                    <span>max</span>
                  </div>
                </div>
              </div>

              {/* Per-class precision/recall */}
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <Target className="size-3" />
                  Per-Class Precision / Recall
                </div>
                <div className="space-y-1">
                  {evaluation.model2.gradeOrder.map((g, i) => (
                    <div key={g} className="flex items-center gap-2 text-[10px]">
                      <span className="font-mono font-semibold w-8 shrink-0">{g}</span>
                      <div className="flex-1 space-y-0.5">
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground w-12">Prec</span>
                          <Progress value={evaluation.model2.perClassPrecision[i] * 100} className="h-1 flex-1" />
                          <span className="font-mono tabular-nums w-8 text-right">{(evaluation.model2.perClassPrecision[i] * 100).toFixed(0)}%</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground w-12">Rec</span>
                          <Progress value={evaluation.model2.perClassRecall[i] * 100} className="h-1 flex-1" />
                          <span className="font-mono tabular-nums w-8 text-right">{(evaluation.model2.perClassRecall[i] * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Interpretation */}
              <div className="rounded-lg border bg-muted/20 p-3 text-[11px] text-muted-foreground space-y-1">
                <div className="flex items-center gap-1.5 font-medium text-foreground mb-1">
                  <TrendingUp className="size-3 text-emerald-600" />
                  Interpretasi
                </div>
                <p>
                  • Model 1 silhouette {evaluation.model1.silhouette.toFixed(3)} — {silhouetteLabel(evaluation.model1.silhouette)}.
                  {" "}Cluster dengan distribusi seimbang menunjukkan model belajar pola kesulitan yang bermakna.
                </p>
                <p>
                  • Model 2 exact accuracy {(evaluation.model2.exactAccuracy * 100).toFixed(1)}% — wajar untuk 10 kelas.
                  {" "}Within-1-step {(evaluation.model2.within1StepAccuracy * 100).toFixed(1)}% menunjukkan prediksi sering dekat dengan nilai aktual.
                </p>
                <p>
                  • Top-3 accuracy {(evaluation.model2.top3Accuracy * 100).toFixed(1)}% — model cukup baik dalam menyempitkan kemungkinan.
                </p>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </FadeIn>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background/60 px-1.5 py-1">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono font-semibold tabular-nums text-xs">{value}</div>
    </div>
  );
}

function MetricCard({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent: "good" | "ok" | "warn" | "neutral" }) {
  const cls = accent === "good" ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300"
    : accent === "ok" ? "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300"
    : accent === "warn" ? "border-rose-500/30 bg-rose-500/5 text-rose-700 dark:text-rose-300"
    : "border-border bg-muted/20 text-foreground";
  return (
    <div className={cn("rounded-lg border p-2", cls)}>
      <div className="text-[9px] uppercase tracking-wide opacity-80">{label}</div>
      <div className="font-mono font-semibold tabular-nums text-lg mt-0.5">{value}</div>
      {hint && <div className="text-[9px] opacity-70 mt-0.5">{hint}</div>}
    </div>
  );
}

function silhouetteLabel(score: number): string {
  if (score > 0.5) return "struktur cluster sangat baik";
  if (score > 0.25) return "struktur cluster baik";
  if (score > 0) return "struktur cluster cukup (mungkin overlap)";
  return "struktur cluster lemah";
}
