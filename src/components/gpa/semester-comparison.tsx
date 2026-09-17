"use client";

import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { GitCompare, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { GRADE_ORDER } from "@/lib/gpa/config";
import { normalizeGrade } from "@/lib/gpa/grade-utils";
import { GradeBadge } from "./badges";
import { FadeIn } from "./motion";
import { cn } from "@/lib/utils";

interface SemesterComparisonProps {
  transcript: { courseName: string; sks: number; grade: string; semester: number }[];
}

interface SemStats {
  semester: number;
  courses: { courseName: string; sks: number; grade: string; gradePoint: number }[];
  ips: number;
  totalSks: number;
  gradeCounts: Record<string, number>;
  avgGradePoint: number;
}

export function SemesterComparison({ transcript }: SemesterComparisonProps) {
  const semesters = useMemo(() => {
    const bySem = new Map<number, SemStats>();
    for (const t of transcript) {
      const { grade, gradePoint } = normalizeGrade(t.grade);
      if (!bySem.has(t.semester)) {
        bySem.set(t.semester, {
          semester: t.semester,
          courses: [],
          ips: 0,
          totalSks: 0,
          gradeCounts: {},
          avgGradePoint: 0,
        });
      }
      const s = bySem.get(t.semester)!;
      s.courses.push({ courseName: t.courseName, sks: t.sks, grade, gradePoint });
      s.totalSks += t.sks;
      s.gradeCounts[grade] = (s.gradeCounts[grade] ?? 0) + 1;
    }
    for (const s of bySem.values()) {
      const weighted = s.courses.reduce((sum, c) => sum + c.sks * c.gradePoint, 0);
      s.ips = s.totalSks > 0 ? weighted / s.totalSks : 0;
      s.avgGradePoint = s.courses.reduce((sum, c) => sum + c.gradePoint, 0) / s.courses.length;
    }
    return [...bySem.values()].sort((a, b) => a.semester - b.semester);
  }, [transcript]);

  const [semA, setSemA] = useState<string>(semesters[0]?.semester.toString() ?? "");
  const [semB, setSemB] = useState<string>(semesters[semesters.length - 1]?.semester.toString() ?? "");

  if (semesters.length < 2) {
    return null;
  }

  const statsA = semesters.find((s) => s.semester.toString() === semA);
  const statsB = semesters.find((s) => s.semester.toString() === semB);

  if (!statsA || !statsB) return null;

  const ipsDelta = statsB.ips - statsA.ips;
  const sksDelta = statsB.totalSks - statsA.totalSks;
  const avgDelta = statsB.avgGradePoint - statsA.avgGradePoint;

  const ipsTrend = ipsDelta > 0.05 ? "up" : ipsDelta < -0.05 ? "down" : "flat";

  return (
    <FadeIn delay={0.1}>
      <Card className="border-border/60 overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-sm">
                  <GitCompare className="size-4" />
                </div>
                Perbandingan Semester
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Bandingkan performa 2 semester secara side-by-side.
              </CardDescription>
            </div>
          </div>
          {/* Semester selectors */}
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div>
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground block mb-1">Semester A</label>
              <Select value={semA} onValueChange={setSemA}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {semesters.map((s) => (
                    <SelectItem key={s.semester} value={s.semester.toString()}>
                      Semester {s.semester}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground block mb-1">Semester B</label>
              <Select value={semB} onValueChange={setSemB}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {semesters.map((s) => (
                    <SelectItem key={s.semester} value={s.semester.toString()}>
                      Semester {s.semester}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Delta summary */}
          <div className="grid grid-cols-3 gap-2">
            <DeltaCard
              label="Δ IPS"
              value={ipsDelta}
              icon={ipsTrend === "up" ? TrendingUp : ipsTrend === "down" ? TrendingDown : Minus}
              accent={ipsTrend === "up" ? "good" : ipsTrend === "down" ? "bad" : "neutral"}
              format="3dp"
            />
            <DeltaCard
              label="Δ SKS"
              value={sksDelta}
              icon={sksDelta > 0 ? TrendingUp : sksDelta < 0 ? TrendingDown : Minus}
              accent="neutral"
              format="int"
            />
            <DeltaCard
              label="Δ Rata-rata"
              value={avgDelta}
              icon={avgDelta > 0.05 ? TrendingUp : avgDelta < -0.05 ? TrendingDown : Minus}
              accent={avgDelta > 0.05 ? "good" : avgDelta < -0.05 ? "bad" : "neutral"}
              format="3dp"
            />
          </div>

          {/* Side-by-side comparison */}
          <div className="grid grid-cols-2 gap-3">
            {/* Semester A */}
            <SemesterColumn stats={statsA} label="A" color="sky" />
            {/* Semester B */}
            <SemesterColumn stats={statsB} label="B" color="violet" />
          </div>
        </CardContent>
      </Card>
    </FadeIn>
  );
}

function DeltaCard({ label, value, icon: Icon, accent, format }: {
  label: string;
  value: number;
  icon: React.ElementType;
  accent: "good" | "bad" | "neutral";
  format: "3dp" | "int";
}) {
  const cls = accent === "good" ? "text-emerald-600"
    : accent === "bad" ? "text-rose-600"
    : "text-foreground";
  const bgCls = accent === "good" ? "border-emerald-500/30 bg-emerald-500/5"
    : accent === "bad" ? "border-rose-500/30 bg-rose-500/5"
    : "border-border bg-muted/20";
  return (
    <div className={cn("rounded-lg border p-2 text-center", bgCls)}>
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("flex items-center justify-center gap-1 mt-0.5", cls)}>
        <Icon className="size-3" />
        <span className="font-mono font-semibold tabular-nums text-sm">
          {value > 0 ? "+" : ""}{format === "int" ? value : value.toFixed(3)}
        </span>
      </div>
    </div>
  );
}

function SemesterColumn({ stats, label, color }: { stats: SemStats; label: string; color: string }) {
  const colorClasses: Record<string, string> = {
    sky: "border-sky-500/30 bg-sky-500/5",
    violet: "border-violet-500/30 bg-violet-500/5",
  };
  const textClasses: Record<string, string> = {
    sky: "text-sky-700 dark:text-sky-300",
    violet: "text-violet-700 dark:text-violet-300",
  };
  return (
    <div className={cn("rounded-lg border p-3 space-y-2", colorClasses[color])}>
      <div className="flex items-center justify-between">
        <span className={cn("text-xs font-semibold", textClasses[color])}>
          Semester {stats.semester}
        </span>
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">IPS</span>
          <span className="font-mono font-semibold tabular-nums">{stats.ips.toFixed(3)}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">SKS</span>
          <span className="font-mono tabular-nums">{stats.totalSks}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Rata-rata</span>
          <span className="font-mono tabular-nums">{stats.avgGradePoint.toFixed(2)}</span>
        </div>
      </div>
      {/* Grade distribution */}
      <div className="pt-1.5 border-t border-border/40">
        <div className="text-[9px] uppercase tracking-wide text-muted-foreground mb-1">Distribusi</div>
        <div className="flex items-center gap-1 flex-wrap">
          {GRADE_ORDER.map((g) => {
            const count = stats.gradeCounts[g] ?? 0;
            if (count === 0) return null;
            return (
              <div key={g} className="flex items-center gap-0.5">
                <GradeBadge grade={g} size="sm" />
                <span className="text-[10px] font-mono tabular-nums">×{count}</span>
              </div>
            );
          })}
        </div>
      </div>
      {/* Course list */}
      <div className="pt-1.5 border-t border-border/40">
        <div className="text-[9px] uppercase tracking-wide text-muted-foreground mb-1">
          Mata Kuliah ({stats.courses.length})
        </div>
        <div className="max-h-32 overflow-y-auto scrollbar-thin space-y-0.5">
          {stats.courses.map((c, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[10px]">
              <GradeBadge grade={c.grade} size="sm" />
              <span className="truncate flex-1">{c.courseName}</span>
              <span className="text-muted-foreground tabular-nums shrink-0">{c.sks}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
