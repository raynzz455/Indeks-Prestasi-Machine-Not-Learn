"use client";

import { cn } from "@/lib/utils";
import { GRADE_POINTS } from "@/lib/gpa/config";

const GRADE_STYLES: Record<string, string> = {
  A: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  "A-": "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25",
  "B+": "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
  B: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  "B-": "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/25",
  "C+": "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  C: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  "C-": "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  D: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  E: "bg-rose-600/20 text-rose-800 dark:text-rose-200 border-rose-600/40",
};

const SCENARIO_STYLES: Record<string, string> = {
  santai: "from-emerald-500/10 to-emerald-500/5 border-emerald-500/30 text-emerald-700 dark:text-emerald-300",
  serius: "from-sky-500/10 to-sky-500/5 border-sky-500/30 text-sky-700 dark:text-sky-300",
  keras: "from-amber-500/10 to-amber-500/5 border-amber-500/30 text-amber-700 dark:text-amber-300",
  maksimal: "from-rose-500/10 to-rose-500/5 border-rose-500/30 text-rose-700 dark:text-rose-300",
};

export function GradeBadge({ grade, size = "default" }: { grade: string; size?: "sm" | "default" | "lg" }) {
  const cls = GRADE_STYLES[grade] ?? GRADE_STYLES.E;
  const sz = size === "sm" ? "text-[10px] px-1.5 py-0.5 min-w-[28px]" : size === "lg" ? "text-sm px-3 py-1 min-w-[44px]" : "text-xs px-2 py-0.5 min-w-[36px]";
  return (
    <span className={cn("inline-flex items-center justify-center rounded-md border font-mono font-semibold", cls, sz)}>
      {grade}
    </span>
  );
}

export function ScenarioBadge({ scenario, label }: { scenario: string; label: string }) {
  const cls = SCENARIO_STYLES[scenario] ?? SCENARIO_STYLES.serius;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border bg-gradient-to-r px-3 py-1 text-xs font-semibold", cls)}>
      {label}
    </span>
  );
}

export function DifficultyBadge({ score, label }: { score: number; label: string }) {
  const cls = score < 0.2 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
    : score < 0.4 ? "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30"
    : score < 0.6 ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
    : score < 0.8 ? "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30"
    : "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium", cls)}>
      <span className="font-mono">{(score * 100).toFixed(0)}%</span>
      <span className="opacity-70">·</span>
      <span className="capitalize">{label.replace("_", " ")}</span>
    </span>
  );
}

export function IpkBadge({ ipk, delta }: { ipk: number; delta?: number }) {
  const cls = delta === undefined ? "bg-muted text-muted-foreground border-border"
    : delta > 0.1 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
    : delta > 0 ? "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30"
    : delta < 0 ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
    : "bg-muted text-muted-foreground border-border";
  return (
    <span className={cn("inline-flex items-baseline gap-1 rounded-md border px-2 py-0.5 font-mono text-sm font-semibold tabular-nums", cls)}>
      {ipk.toFixed(3)}
      {delta !== undefined && delta !== 0 && (
        <span className="text-[10px] opacity-80">
          {delta > 0 ? "+" : ""}{delta.toFixed(3)}
        </span>
      )}
    </span>
  );
}

export function gradePoint(grade: string): number {
  return GRADE_POINTS[grade] ?? 0;
}
