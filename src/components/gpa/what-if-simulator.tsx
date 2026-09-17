"use client";

import { useState, useMemo } from "react";
import { Calculator, RotateCcw, Sparkles, Gauge } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { GRADE_ORDER } from "@/lib/gpa/config";
import { computeIps, computeIpk, gradeToGp } from "@/lib/gpa/grade-utils";
import { GradeBadge, IpkBadge } from "./badges";
import { cn } from "@/lib/utils";

interface WhatIfSimulatorProps {
  currentIpk: number;
  totalSks: number;
  courses: { id: string; name: string; sks: number; normalizedName: string; difficultyScore: number }[];
}

interface GradePick {
  courseId: string;
  grade: string;
}

export function WhatIfSimulator({ currentIpk, totalSks, courses }: WhatIfSimulatorProps) {
  // Default: all A
  const [picks, setPicks] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const c of courses) init[c.id] = "A";
    return init;
  });

  const calc = useMemo(() => {
    const items = courses.map((c) => ({
      courseName: c.name,
      sks: c.sks,
      grade: picks[c.id] ?? "A",
      gradePoint: gradeToGp(picks[c.id] ?? "A"),
      difficultyScore: c.difficultyScore,
    }));
    const ips = computeIps(items.map((i) => ({ sks: i.sks, gradePoint: i.gradePoint })));
    const newSks = items.reduce((s, i) => s + i.sks, 0);
    const newIpk = computeIpk(currentIpk, totalSks, ips, newSks);
    const delta = newIpk - currentIpk;
    const cumDiff = newSks > 0 ? items.reduce((s, i) => s + i.sks * i.difficultyScore, 0) / newSks : 0;
    // Estimated effort: ratio of A grades
    const aCount = items.filter((i) => i.grade === "A").length;
    const effortPct = items.length > 0 ? (aCount / items.length) * 100 : 0;
    return {
      items,
      ips: Math.round(ips * 1000) / 1000,
      newIpk: Math.round(newIpk * 1000) / 1000,
      delta: Math.round(delta * 1000) / 1000,
      cumDiff: Math.round(cumDiff * 100) / 100,
      effortPct,
      newSks,
    };
  }, [picks, courses, currentIpk, totalSks]);

  function setAll(grade: string) {
    const next: Record<string, string> = {};
    for (const c of courses) next[c.id] = grade;
    setPicks(next);
  }

  function reset() {
    setAll("A");
  }

  if (courses.length === 0) {
    return null;
  }

  const cumlaudeDelta = 3.5 - calc.newIpk;

  return (
    <Card className="border-2 border-sky-500/30 bg-gradient-to-br from-sky-500/5 via-transparent to-transparent overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="size-4 text-sky-600" />
              Simulator What-If
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Pilih nilai manual untuk tiap mata kuliah & lihat proyeksi IPK real-time.
            </CardDescription>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setAll("A")} className="h-7 text-xs gap-1">
              <Sparkles className="size-3" /> Semua A
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAll("B")} className="h-7 text-xs">
              Semua B
            </Button>
            <Button variant="ghost" size="sm" onClick={reset} className="h-7 text-xs gap-1 text-muted-foreground">
              <RotateCcw className="size-3" /> Reset
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Course pickers */}
        <div className="grid sm:grid-cols-2 gap-2">
          {calc.items.map((it, i) => {
            const c = courses[i];
            return (
              <div key={c.id} className="rounded-lg border bg-card px-3 py-2 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate text-sm">{c.normalizedName}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {c.sks} SKS · kesulitan {(c.difficultyScore * 100).toFixed(0)}%
                  </div>
                </div>
                <Select
                  value={picks[c.id] ?? "A"}
                  onValueChange={(v) => setPicks((p) => ({ ...p, [c.id]: v }))}
                >
                  <SelectTrigger className="w-16 h-8 justify-center shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GRADE_ORDER.map((g) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="w-12 text-right text-xs font-mono tabular-nums text-muted-foreground shrink-0">
                  {(it.gradePoint * c.sks).toFixed(1)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Live result */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <ResultStat label="IPS Semester" value={calc.ips.toFixed(3)} />
          <ResultStat
            label="IPK Proyeksi"
            value={calc.newIpk.toFixed(3)}
            accent={calc.delta > 0 ? "good" : calc.delta < 0 ? "bad" : "neutral"}
            delta={calc.delta}
          />
          <ResultStat
            label="Kesulitan Kumulatif"
            value={`${(calc.cumDiff * 100).toFixed(0)}%`}
            accent={calc.cumDiff < 0.4 ? "good" : calc.cumDiff < 0.7 ? "neutral" : "bad"}
          />
          <ResultStat
            label="Estimasi Usaha"
            value={`${calc.effortPct.toFixed(0)}%`}
            hint={calc.effortPct >= 80 ? "maksimal" : calc.effortPct >= 50 ? "serius" : "santai"}
          />
        </div>

        {/* Cumlaude tracker */}
        <div className="rounded-lg border bg-muted/30 px-3 py-2.5 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5">
              <Gauge className="size-3.5 text-amber-600" />
              <span className="font-medium">Progress menuju Cumlaude (3.50)</span>
            </span>
            <span className={cn("font-mono tabular-nums font-semibold", cumlaudeDelta <= 0 ? "text-emerald-600" : "text-amber-600")}>
              {cumlaudeDelta <= 0 ? "Tercapai ✓" : `butuh +${cumlaudeDelta.toFixed(3)}`}
            </span>
          </div>
          <Progress value={Math.min(100, (calc.newIpk / 3.5) * 100)} className="h-2" />
        </div>

        {/* Grade legend */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Bobot nilai: <span className="font-mono">SKS × grade point</span></span>
          <span>Total SKS semester: <span className="font-mono font-semibold text-foreground">{calc.newSks}</span></span>
        </div>
      </CardContent>
    </Card>
  );
}

function ResultStat({ label, value, accent, delta, hint }: { label: string; value: string; accent?: "good" | "bad" | "neutral"; delta?: number; hint?: string }) {
  const cls = accent === "good" ? "text-emerald-700 dark:text-emerald-300"
    : accent === "bad" ? "text-rose-700 dark:text-rose-300"
    : "text-foreground";
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex items-baseline gap-1.5 mt-0.5">
        <span className={cn("font-mono text-base font-semibold tabular-nums", cls)}>{value}</span>
        {delta !== undefined && delta !== 0 && (
          <span className={cn("text-[10px] font-mono", delta > 0 ? "text-emerald-600" : "text-rose-600")}>
            {delta > 0 ? "+" : ""}{delta.toFixed(3)}
          </span>
        )}
        {hint && (
          <span className="text-[10px] text-muted-foreground capitalize">· {hint}</span>
        )}
      </div>
    </div>
  );
}
