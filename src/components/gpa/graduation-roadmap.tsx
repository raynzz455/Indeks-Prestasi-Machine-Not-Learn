"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Map, GraduationCap, Flag, TrendingUp } from "lucide-react";
import { computeIpk } from "@/lib/gpa/grade-utils";
import { FadeIn } from "./motion";
import { cn } from "@/lib/utils";

interface GraduationRoadmapProps {
  currentIpk: number;
  totalSks: number;
  remainingSemesters: number;
  plannedSksPerSem: number;
  targetIpk?: number;
  graduationSks?: number;
}

interface RoadmapMilestone {
  semester: number;
  cumulativeSks: number;
  projectedIpk: number;
  ipkDelta: number;
  isCurrent?: boolean;
  isGraduation?: boolean;
  label: string;
}

export function GraduationRoadmap({
  currentIpk,
  totalSks,
  remainingSemesters,
  plannedSksPerSem,
  targetIpk,
  graduationSks = 144,
}: GraduationRoadmapProps) {
  const milestones = useMemo<RoadmapMilestone[]>(() => {
    const result: RoadmapMilestone[] = [];
    let runningIpk = currentIpk;
    let runningSks = totalSks;

    // Current position
    result.push({
      semester: 0,
      cumulativeSks: totalSks,
      projectedIpk: currentIpk,
      ipkDelta: 0,
      isCurrent: true,
      label: "Saat Ini",
    });

    // Project each remaining semester assuming IPS = current IPK (baseline)
    for (let i = 1; i <= remainingSemesters; i++) {
      const newSks = Math.min(plannedSksPerSem, Math.max(0, graduationSks - runningSks));
      if (newSks <= 0) break;
      const newIpk = computeIpk(runningIpk, runningSks, currentIpk, newSks);
      const delta = newIpk - runningIpk;
      const isGraduation = runningSks + newSks >= graduationSks;
      result.push({
        semester: i,
        cumulativeSks: runningSks + newSks,
        projectedIpk: Math.round(newIpk * 1000) / 1000,
        ipkDelta: Math.round(delta * 1000) / 1000,
        isGraduation,
        label: isGraduation ? "Wisuda" : `Sem +${i}`,
      });
      runningIpk = newIpk;
      runningSks += newSks;
    }

    return result;
  }, [currentIpk, totalSks, remainingSemesters, plannedSksPerSem, graduationSks]);

  const finalMilestone = milestones[milestones.length - 1];
  const finalIpk = finalMilestone?.projectedIpk ?? currentIpk;
  const totalDelta = Math.round((finalIpk - currentIpk) * 1000) / 1000;
  const achievesTarget = targetIpk !== undefined ? finalIpk >= targetIpk : true;

  const cumlaudeLabel =
    finalIpk >= 3.75 ? "Summa Cumlaude"
    : finalIpk >= 3.5 ? "Cumlaude"
    : finalIpk >= 3.0 ? "Memuaskan"
    : "Cukup";

  const chartData = milestones.map((m) => ({
    name: m.label,
    IPK: m.projectedIpk,
    SKS: m.cumulativeSks,
  }));

  return (
    <FadeIn delay={0.1}>
      <Card className="border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 via-teal-500/5 to-transparent overflow-hidden relative">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 opacity-60" />
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
                  <Map className="size-4" />
                </div>
                Peta Jalan Kelulusan
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Timeline visual menuju kelulusan — proyeksi IPK & SKS per semester.
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">IPK Kelulusan</div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-xl font-bold tabular-nums">
                  {finalIpk.toFixed(3)}
                </span>
                {totalDelta !== 0 && (
                  <span className={cn(
                    "text-xs font-mono",
                    totalDelta > 0 ? "text-emerald-600" : "text-rose-600"
                  )}>
                    ({totalDelta > 0 ? "+" : ""}{totalDelta.toFixed(3)})
                  </span>
                )}
              </div>
              <Badge variant="outline" className={cn(
                "text-[9px] mt-0.5",
                cumlaudeLabel === "Summa Cumlaude" && "border-fuchsia-500/40 text-fuchsia-700 dark:text-fuchsia-300",
                cumlaudeLabel === "Cumlaude" && "border-amber-500/40 text-amber-700 dark:text-amber-300",
                cumlaudeLabel === "Memuaskan" && "border-sky-500/40 text-sky-700 dark:text-sky-300",
                cumlaudeLabel === "Cukup" && "border-muted-foreground/40 text-muted-foreground"
              )}>
                {cumlaudeLabel}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Chart */}
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="oklch(0.85 0 0)" vertical={false} strokeWidth={1} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "oklch(0.45 0 0)", fontWeight: 500 }}
                  axisLine={{ stroke: "oklch(0.75 0 0)", strokeWidth: 1.5 }}
                  tickLine={{ stroke: "oklch(0.75 0 0)", strokeWidth: 1 }}
                />
                <YAxis
                  domain={[0, 4]}
                  ticks={[0, 1, 2, 3, 4]}
                  tick={{ fontSize: 10, fill: "oklch(0.45 0 0)", fontWeight: 500 }}
                  axisLine={{ stroke: "oklch(0.75 0 0)", strokeWidth: 1.5 }}
                  tickLine={{ stroke: "oklch(0.75 0 0)", strokeWidth: 1 }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid oklch(0.8 0 0)",
                    fontSize: 11,
                    background: "oklch(0.99 0 0)",
                    boxShadow: "0 4px 12px oklch(0 0 0 / 0.1)",
                  }}
                  formatter={(v: number, name: string) => {
                    if (name === "IPK") return [v.toFixed(3), name];
                    return [`${v} SKS`, name];
                  }}
                />
                {/* Cumlaude band */}
                <ReferenceArea y1={3.5} y2={4} fill="oklch(0.72 0.17 160)" fillOpacity={0.08} />
                {targetIpk !== undefined && (
                  <ReferenceLine
                    y={targetIpk}
                    stroke="oklch(0.75 0.18 75)"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{ value: `Target ${targetIpk.toFixed(2)}`, fontSize: 9, fill: "oklch(0.55 0.15 75)", position: "insideTopRight" }}
                  />
                )}
                <ReferenceLine y={3.5} stroke="oklch(0.7 0.15 160)" strokeDasharray="2 2" strokeWidth={1} label={{ value: "Cumlaude", fontSize: 9, fill: "oklch(0.5 0.12 160)", position: "insideTopLeft" }} />
                <Line
                  type="monotone"
                  dataKey="IPK"
                  stroke="oklch(0.55 0.18 160)"
                  strokeWidth={3}
                  dot={{ r: 5, fill: "oklch(0.99 0 0)", stroke: "oklch(0.55 0.18 160)", strokeWidth: 2.5 }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Milestone timeline */}
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium flex items-center gap-1.5">
              <Flag className="size-3" />
              Milestone per Semester
            </div>
            <div className="flex items-stretch gap-1 overflow-x-auto scrollbar-thin pb-1">
              {milestones.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex-1 min-w-[80px] rounded-md border p-2 text-center transition-all",
                    m.isCurrent
                      ? "border-sky-500/40 bg-sky-500/5"
                      : m.isGraduation
                      ? "border-emerald-500/40 bg-emerald-500/5"
                      : "border-border bg-card/40"
                  )}
                >
                  <div className={cn(
                    "text-[9px] font-semibold uppercase tracking-wide mb-0.5",
                    m.isCurrent ? "text-sky-600" : m.isGraduation ? "text-emerald-600" : "text-muted-foreground"
                  )}>
                    {m.label}
                  </div>
                  <div className="font-mono font-semibold tabular-nums text-sm">
                    {m.projectedIpk.toFixed(3)}
                  </div>
                  {m.ipkDelta !== 0 && (
                    <div className={cn(
                      "text-[9px] font-mono",
                      m.ipkDelta > 0 ? "text-emerald-600" : "text-rose-600"
                    )}>
                      {m.ipkDelta > 0 ? "+" : ""}{m.ipkDelta.toFixed(3)}
                    </div>
                  )}
                  <div className="text-[9px] text-muted-foreground mt-0.5">
                    {m.cumulativeSks} SKS
                  </div>
                  {m.isGraduation && (
                    <GraduationCap className="size-3 text-emerald-600 mx-auto mt-0.5" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <TrendingUp className="size-3 text-emerald-600" />
            <span>
              {remainingSemesters} semester tersisa · {plannedSksPerSem} SKS/semester ·
              total {finalMilestone?.cumulativeSks ?? totalSks}/{graduationSks} SKS saat lulus
              {targetIpk !== undefined && (
                <> · target {achievesTarget ? "✓ tercapai" : "✗ belum tercapai"}</>
              )}
            </span>
          </div>
        </CardContent>
      </Card>
    </FadeIn>
  );
}
