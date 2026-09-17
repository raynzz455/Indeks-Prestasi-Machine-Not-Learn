"use client";

import { useState, useEffect } from "react";
import {
  GraduationCap,
  Loader2,
  TrendingUp,
  Target,
  Award,
  Calendar,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { toast } from "sonner";
import { FadeIn } from "./motion";
import { GraduationRoadmap } from "./graduation-roadmap";
import { cn } from "@/lib/utils";

interface GradSemester {
  semester: number;
  assumedIps: number;
  newSks: number;
  cumulativeSks: number;
  projectedIpk: number;
  ipkDelta: number;
}

interface GraduationResult {
  graduationIpk: number;
  currentIpk: number;
  totalDelta: number;
  targetIpk?: number;
  achievable: boolean;
  semesters: GradSemester[];
  finalSks: number;
  graduationSksTarget: number;
  remainingSemesters: number;
  message: string;
}

interface GraduationSimulatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentIpk: number;
  totalSks: number;
  targetIpk?: number;
}

export function GraduationSimulator({ open, onOpenChange, currentIpk, totalSks, targetIpk }: GraduationSimulatorProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GraduationResult | null>(null);
  const [remainingSemesters, setRemainingSemesters] = useState(4);
  const [plannedSksPerSem, setPlannedSksPerSem] = useState(18);
  const [mode, setMode] = useState<"baseline" | "difficulty">("baseline");

  async function simulate() {
    setLoading(true);
    try {
      const res = await fetch("/api/gpa/graduation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentIpk,
          totalSks,
          remainingSemesters,
          plannedSksPerSem,
          targetIpk,
          mode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setResult(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Gagal simulasi kelulusan", { description: msg });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      simulate();
    }
  }, [open, mode, remainingSemesters, plannedSksPerSem]);

  const chartData = result
    ? [
        { name: "Saat Ini", IPK: result.currentIpk, SKS: totalSks },
        ...result.semesters.map((s) => ({
          name: `Sem +${s.semester}`,
          IPK: s.projectedIpk,
          SKS: s.cumulativeSks,
        })),
      ]
    : [];

  const cumlaudeLabel = result
    ? result.graduationIpk >= 3.75
      ? "Summa Cumlaude"
      : result.graduationIpk >= 3.5
      ? "Cumlaude"
      : result.graduationIpk >= 3.0
      ? "Memuaskan"
      : "Cukup"
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
              <GraduationCap className="size-4" />
            </div>
            Simulator Kelulusan
          </DialogTitle>
          <DialogDescription className="text-xs mt-1">
            Proyeksi IPK saat kelulusan berdasarkan performa saat ini.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[65vh]">
          <div className="px-5 py-4 space-y-4 scrollbar-thin">
            {/* Controls */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-muted/20 p-2.5">
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground block">
                  Sisa Semester: <span className="font-mono font-semibold text-foreground">{remainingSemesters}</span>
                </label>
                <Slider
                  value={[remainingSemesters]}
                  onValueChange={(v) => setRemainingSemesters(v[0])}
                  min={1}
                  max={8}
                  step={1}
                  className="mt-1"
                />
              </div>
              <div className="rounded-lg border bg-muted/20 p-2.5">
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground block">
                  SKS/Semester: <span className="font-mono font-semibold text-foreground">{plannedSksPerSem}</span>
                </label>
                <Slider
                  value={[plannedSksPerSem]}
                  onValueChange={(v) => setPlannedSksPerSem(v[0])}
                  min={12}
                  max={24}
                  step={1}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Mode toggle */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Mode:</span>
              <div className="flex gap-1 rounded-lg border bg-muted/20 p-0.5">
                <button
                  onClick={() => { setMode("baseline"); }}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                    mode === "baseline"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Baseline (IPS = IPK saat ini)
                </button>
                <button
                  onClick={() => { setMode("difficulty"); }}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                    mode === "difficulty"
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Difficulty-weighted (realistis)
                </button>
              </div>
            </div>

            {loading ? (
              <div className="rounded-lg border py-10 text-center">
                <Loader2 className="mx-auto mb-2 size-6 animate-spin text-emerald-600" />
                <p className="text-sm text-muted-foreground">Mensimulasikan kelulusan…</p>
              </div>
            ) : result ? (
              <>
                {/* Result summary */}
                <div className={cn(
                  "rounded-lg border-2 p-3 space-y-2 relative overflow-hidden",
                  result.achievable
                    ? "border-emerald-500/40 bg-emerald-500/5"
                    : "border-amber-500/40 bg-amber-500/5"
                )}>
                  <div className={cn(
                    "absolute inset-x-0 top-0 h-1",
                    result.achievable
                      ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                      : "bg-gradient-to-r from-amber-500 to-orange-500"
                  )} />
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">IPK Kelulusan</div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-mono text-2xl font-bold tabular-nums">
                          {result.graduationIpk.toFixed(3)}
                        </span>
                        {result.totalDelta !== 0 && (
                          <span className={cn(
                            "text-xs font-mono",
                            result.totalDelta > 0 ? "text-emerald-600" : "text-rose-600"
                          )}>
                            ({result.totalDelta > 0 ? "+" : ""}{result.totalDelta.toFixed(3)})
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className={cn(
                      "text-[10px]",
                      cumlaudeLabel === "Summa Cumlaude" && "border-fuchsia-500/40 text-fuchsia-700 dark:text-fuchsia-300",
                      cumlaudeLabel === "Cumlaude" && "border-amber-500/40 text-amber-700 dark:text-amber-300",
                      cumlaudeLabel === "Memuaskan" && "border-sky-500/40 text-sky-700 dark:text-sky-300",
                      cumlaudeLabel === "Cukup" && "border-muted-foreground/40 text-muted-foreground"
                    )}>
                      <Award className="size-3 mr-1" />
                      {cumlaudeLabel}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{result.message}</p>
                </div>

                {/* Chart */}
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradIpk" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="oklch(0.6 0.18 160)" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="oklch(0.6 0.18 160)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
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
                        formatter={(v: number) => v.toFixed(3)}
                      />
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
                      <Area
                        type="monotone"
                        dataKey="IPK"
                        stroke="oklch(0.55 0.18 160)"
                        strokeWidth={2.5}
                        fill="url(#gradIpk)"
                        dot={{ r: 4, fill: "oklch(0.99 0 0)", stroke: "oklch(0.55 0.18 160)", strokeWidth: 2 }}
                        activeDot={{ r: 6 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Semester detail */}
                <div className="space-y-1.5">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium flex items-center gap-1.5">
                    <Calendar className="size-3" />
                    Detail per Semester
                  </div>
                  {result.semesters.map((s, i) => (
                    <FadeIn key={i} delay={i * 0.05}>
                      <div className="flex items-center justify-between rounded-md border bg-card px-2.5 py-1.5 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="grid size-5 place-items-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[9px] font-mono font-bold">
                            {s.semester}
                          </span>
                          <span className="text-muted-foreground">IPS {s.assumedIps.toFixed(3)}</span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-muted-foreground">{s.newSks} SKS</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Total: {s.cumulativeSks} SKS</span>
                          <span className="font-mono font-semibold tabular-nums">{s.projectedIpk.toFixed(3)}</span>
                          <span className={cn("font-mono text-[10px]", s.ipkDelta > 0 ? "text-emerald-600" : "text-rose-600")}>
                            {s.ipkDelta > 0 ? "+" : ""}{s.ipkDelta.toFixed(3)}
                          </span>
                        </div>
                      </div>
                    </FadeIn>
                  ))}
                </div>

                {/* Graduation roadmap */}
                <GraduationRoadmap
                  currentIpk={result.currentIpk}
                  totalSks={totalSks}
                  remainingSemesters={result.remainingSemesters}
                  plannedSksPerSem={plannedSksPerSem}
                  targetIpk={result.targetIpk}
                  graduationSks={result.graduationSksTarget}
                />
              </>
            ) : null}
          </div>
        </ScrollArea>

        <DialogFooter className="px-5 py-3 border-t gap-2">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mr-auto">
            <TrendingUp className="size-3 text-emerald-600" />
            <span>Asumsi: IPS konsisten = IPK saat ini ({currentIpk.toFixed(3)})</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
