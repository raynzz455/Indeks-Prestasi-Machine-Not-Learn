"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import { GRADE_ORDER } from "@/lib/gpa/config";
import type { OptimizationResult } from "@/lib/gpa/types";

const GRADE_COLORS: Record<string, string> = {
  A: "oklch(0.72 0.17 160)",
  "A-": "oklch(0.7 0.15 170)",
  "B+": "oklch(0.7 0.14 180)",
  B: "oklch(0.65 0.14 230)",
  "B-": "oklch(0.65 0.13 240)",
  "C+": "oklch(0.75 0.15 75)",
  C: "oklch(0.75 0.15 75)",
  "C-": "oklch(0.7 0.16 50)",
  D: "oklch(0.65 0.2 25)",
  E: "oklch(0.55 0.22 20)",
};

export function GradeDistributionChart({ result }: { result: OptimizationResult }) {
  // Show distribution for each planned course as a small bar chart.
  // Only show the "serius" scenario to avoid 4× duplication in the main results.
  const allDistributions = result.distributions ?? [];
  const distributions = allDistributions.filter((d) => d.scenario === "serius");

  if (distributions.length === 0) {
    return null;
  }

  return (
    <Card className="border-border/60 overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="size-4 text-violet-600" />
          Distribusi Probabilitas Nilai (Model 2)
        </CardTitle>
        <CardDescription className="text-xs">
          Probabilitas prediksi per kelas nilai untuk tiap mata kuliah target (skenario serius).
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="grid sm:grid-cols-2 gap-4">
          {distributions.map((d) => {
            const data = GRADE_ORDER.map((g) => ({
              grade: g,
              prob: Math.round((d.distribution[g] ?? 0) * 1000) / 10,
              fill: GRADE_COLORS[g] ?? "oklch(0.6 0 0)",
            }));
            const topGrade = data.reduce((best, x) => (x.prob > best.prob ? x : best), data[0]);
            return (
              <div key={d.courseId} className="rounded-lg border bg-card/40 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{d.normalizedName}</div>
                    <div className="text-[10px] text-muted-foreground">
                      kesulitan {(d.difficultyScore * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] text-muted-foreground">Nilai terprediksi</div>
                    <div className="font-mono font-bold text-sm" style={{ color: GRADE_COLORS[topGrade.grade] }}>
                      {topGrade.grade} · {topGrade.prob.toFixed(0)}%
                    </div>
                  </div>
                </div>
                <div className="h-20 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0 0)" vertical={false} strokeWidth={0.5} />
                      <XAxis
                        dataKey="grade"
                        tick={{ fontSize: 9, fill: "oklch(0.45 0 0)", fontWeight: 600 }}
                        axisLine={{ stroke: "oklch(0.75 0 0)", strokeWidth: 1 }}
                        tickLine={{ stroke: "oklch(0.75 0 0)", strokeWidth: 1 }}
                        interval={0}
                      />
                      <YAxis hide domain={[0, 100]} />
                      <Tooltip
                        cursor={{ fill: "oklch(0.92 0 0)" }}
                        contentStyle={{
                          borderRadius: 6,
                          border: "1px solid oklch(0.8 0 0)",
                          fontSize: 11,
                          padding: "4px 8px",
                          background: "oklch(0.99 0 0)",
                          boxShadow: "0 2px 8px oklch(0 0 0 / 0.1)",
                        }}
                        formatter={(v: number) => `${v.toFixed(1)}%`}
                        labelFormatter={(l) => `Nilai ${l}`}
                      />
                      <Bar dataKey="prob" radius={[2, 2, 0, 0]}>
                        {data.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
