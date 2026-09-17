"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, TrendingUp, TrendingDown } from "lucide-react";
import { GRADE_ORDER, GRADE_POINTS } from "@/lib/gpa/config";
import { normalizeGrade } from "@/lib/gpa/grade-utils";
import { FadeIn } from "./motion";
import { cn } from "@/lib/utils";

interface GradeHistoryChartProps {
  transcript: { courseName: string; sks: number; grade: string; semester: number }[];
}

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

export function GradeHistoryChart({ transcript }: GradeHistoryChartProps) {
  const data = useMemo(() => {
    // Group by semester
    const bySem = new Map<number, { courseName: string; sks: number; grade: string; gradePoint: number }[]>();
    for (const t of transcript) {
      const { grade, gradePoint } = normalizeGrade(t.grade);
      if (!bySem.has(t.semester)) bySem.set(t.semester, []);
      bySem.get(t.semester)!.push({ courseName: t.courseName, sks: t.sks, grade, gradePoint });
    }
    const semesters = [...bySem.keys()].sort((a, b) => a - b);

    // Build scatter data: x=semester, y=gradePoint, z=sks, with course name
    const scatterData: { semester: number; gradePoint: number; sks: number; course: string; grade: string }[] = [];
    for (const sem of semesters) {
      const courses = bySem.get(sem)!;
      // Jitter x slightly to avoid overlapping points
      courses.forEach((c, i) => {
        const jitter = (i - (courses.length - 1) / 2) * 0.15;
        scatterData.push({
          semester: sem + jitter,
          gradePoint: c.gradePoint,
          sks: c.sks,
          course: c.courseName,
          grade: c.grade,
        });
      });
    }

    // Compute IPS per semester
    const ipsData = semesters.map((sem) => {
      const courses = bySem.get(sem)!;
      const totalSks = courses.reduce((s, c) => s + c.sks, 0);
      const weighted = courses.reduce((s, c) => s + c.sks * c.gradePoint, 0);
      return { semester: sem, ips: totalSks > 0 ? weighted / totalSks : 0 };
    });

    // Trend: compare first and last semester IPS
    const firstIps = ipsData[0]?.ips ?? 0;
    const lastIps = ipsData[ipsData.length - 1]?.ips ?? 0;
    const trend = lastIps - firstIps;

    // Grade distribution
    const gradeCounts: Record<string, number> = {};
    for (const d of scatterData) {
      gradeCounts[d.grade] = (gradeCounts[d.grade] ?? 0) + 1;
    }

    return { scatterData, ipsData, semesters, trend, gradeCounts, totalCourses: scatterData.length };
  }, [transcript]);

  if (transcript.length === 0) {
    return null;
  }

  const TrendIcon = data.trend > 0.05 ? TrendingUp : data.trend < -0.05 ? TrendingDown : null;
  const trendColor = data.trend > 0.05 ? "text-emerald-600" : data.trend < -0.05 ? "text-rose-600" : "text-muted-foreground";

  return (
    <FadeIn delay={0.1}>
      <Card className="border-border/60 overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-sm">
                  <History className="size-4" />
                </div>
                Riwayat Nilai per Semester
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Sebaran nilai mata kuliah per semester. Ukuran titik = SKS, warna = grade.
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Tren IPS</div>
              <div className="flex items-center gap-1.5 justify-end">
                {TrendIcon && <TrendIcon className={cn("size-4", trendColor)} />}
                <span className={cn("font-mono font-semibold tabular-nums text-sm", trendColor)}>
                  {data.trend > 0 ? "+" : ""}{data.trend.toFixed(3)}
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground">
                Sem {data.semesters[0]} → {data.semesters[data.semesters.length - 1]}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2 space-y-3">
          {/* Scatter chart */}
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 12, left: -8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="oklch(0.85 0 0)" strokeWidth={1} />
                <XAxis
                  type="number"
                  dataKey="semester"
                  name="Semester"
                  domain={["dataMin - 0.5", "dataMax + 0.5"]}
                  tickFormatter={(v) => `Sem ${Math.round(v)}`}
                  tick={{ fontSize: 10, fill: "oklch(0.45 0 0)", fontWeight: 500 }}
                  axisLine={{ stroke: "oklch(0.75 0 0)", strokeWidth: 1.5 }}
                  tickLine={{ stroke: "oklch(0.75 0 0)", strokeWidth: 1 }}
                />
                <YAxis
                  type="number"
                  dataKey="gradePoint"
                  name="Grade Point"
                  domain={[0, 4]}
                  ticks={[0, 1, 2, 3, 4]}
                  tickFormatter={(v) => v.toFixed(1)}
                  tick={{ fontSize: 10, fill: "oklch(0.45 0 0)", fontWeight: 500 }}
                  axisLine={{ stroke: "oklch(0.75 0 0)", strokeWidth: 1.5 }}
                  tickLine={{ stroke: "oklch(0.75 0 0)", strokeWidth: 1 }}
                />
                <ZAxis type="number" dataKey="sks" range={[40, 200]} name="SKS" />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid oklch(0.8 0 0)",
                    fontSize: 11,
                    background: "oklch(0.99 0 0)",
                    boxShadow: "0 4px 12px oklch(0 0 0 / 0.1)",
                  }}
                  formatter={(v: number, name: string) => {
                    if (name === "Grade Point") return [v.toFixed(1), name];
                    if (name === "Semester") return [`Semester ${Math.round(v)}`, name];
                    if (name === "SKS") return [`${v} SKS`, name];
                    return [v, name];
                  }}
                  labelFormatter={() => ""}
                  content={({ payload }) => {
                    const p = payload?.[0]?.payload;
                    if (!p) return null;
                    return (
                      <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-md">
                        <div className="font-medium">{p.course}</div>
                        <div className="text-muted-foreground mt-0.5">
                          Semester {Math.round(p.semester)} · {p.sks} SKS · Nilai {p.grade} ({p.gradePoint.toFixed(1)})
                        </div>
                      </div>
                    );
                  }}
                />
                <ReferenceLine y={3.5} stroke="oklch(0.7 0.15 160)" strokeDasharray="2 2" strokeWidth={1} label={{ value: "Cumlaude", fontSize: 9, fill: "oklch(0.5 0.12 160)", position: "insideTopLeft" }} />
                <ReferenceLine y={3.0} stroke="oklch(0.65 0.14 230)" strokeDasharray="2 2" strokeWidth={1} label={{ value: "Memuaskan", fontSize: 9, fill: "oklch(0.5 0.12 230)", position: "insideTopLeft" }} />
                <Scatter data={data.scatterData}>
                  {data.scatterData.map((entry, i) => (
                    <Cell key={i} fill={GRADE_COLORS[entry.grade] ?? "oklch(0.6 0 0)"} fillOpacity={0.7} stroke={GRADE_COLORS[entry.grade] ?? "oklch(0.6 0 0)"} strokeWidth={1} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* Grade distribution legend */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Distribusi Nilai</div>
            <div className="flex items-center gap-1 flex-wrap">
              {GRADE_ORDER.map((g) => {
                const count = data.gradeCounts[g] ?? 0;
                if (count === 0) return null;
                return (
                  <div
                    key={g}
                    className="flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px]"
                    style={{ backgroundColor: `oklch(0.97 0 0 / 0.5)`, borderColor: GRADE_COLORS[g] ?? "oklch(0.8 0 0)" }}
                  >
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: GRADE_COLORS[g] }}
                    />
                    <span className="font-mono font-semibold">{g}</span>
                    <span className="text-muted-foreground">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* IPS trend mini */}
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>Total {data.totalCourses} mata kuliah di {data.semesters.length} semester.</span>
            {data.trend > 0.05 && (
              <Badge variant="outline" className="text-[9px] border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
                <TrendingUp className="size-2.5 mr-1" />
                Tren naik
              </Badge>
            )}
            {data.trend < -0.05 && (
              <Badge variant="outline" className="text-[9px] border-rose-500/40 text-rose-700 dark:text-rose-300">
                <TrendingDown className="size-2.5 mr-1" />
                Tren turun
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </FadeIn>
  );
}
