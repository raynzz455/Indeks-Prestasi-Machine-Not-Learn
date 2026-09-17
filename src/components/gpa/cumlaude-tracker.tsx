"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Star, Crown, Award, TrendingUp, CheckCircle2 } from "lucide-react";
import { FadeIn } from "./motion";
import { cn } from "@/lib/utils";

interface CumlaudeTrackerProps {
  currentIpk: number;
  projectedIpk: number;
  totalSks: number;
  plannedSks: number;
}

interface Milestone {
  threshold: number;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
}

const MILESTONES: Milestone[] = [
  {
    threshold: 3.00,
    label: "Memuaskan",
    shortLabel: "3.00",
    icon: Award,
    color: "text-sky-600",
    bgColor: "bg-sky-500/10",
    borderColor: "border-sky-500/30",
    description: "Lulus dengan standar baik",
  },
  {
    threshold: 3.50,
    label: "Cumlaude",
    shortLabel: "3.50",
    icon: Star,
    color: "text-amber-600",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    description: "Lulus dengan pujian",
  },
  {
    threshold: 3.75,
    label: "Summa Cumlaude",
    shortLabel: "3.75",
    icon: Crown,
    color: "text-fuchsia-600",
    bgColor: "bg-fuchsia-500/10",
    borderColor: "border-fuchsia-500/30",
    description: "Lulus dengan pujian tertinggi",
  },
  {
    threshold: 4.00,
    label: "Sempurna",
    shortLabel: "4.00",
    icon: Trophy,
    color: "text-emerald-600",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    description: "IPK sempurna 4.0",
  },
];

export function CumlaudeTracker({ currentIpk, projectedIpk, totalSks, plannedSks }: CumlaudeTrackerProps) {
  const delta = projectedIpk - currentIpk;
  const nextMilestone = MILESTONES.find((m) => projectedIpk < m.threshold);
  const nextGap = nextMilestone ? nextMilestone.threshold - projectedIpk : 0;

  return (
    <FadeIn delay={0.12}>
      <Card className="border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-yellow-500/5 to-transparent overflow-hidden relative">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-500 opacity-60" />
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-sm">
                  <Trophy className="size-4" />
                </div>
                Progress Cumlaude
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Jarak menuju milestone IPK — saat ini {currentIpk.toFixed(3)} → proyeksi {projectedIpk.toFixed(3)}
              </CardDescription>
            </div>
            {nextMilestone ? (
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Milestone Berikutnya</div>
                <div className="flex items-center gap-1.5">
                  <nextMilestone.icon className={cn("size-4", nextMilestone.color)} />
                  <span className="font-semibold text-sm">{nextMilestone.label}</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  butuh <span className={cn("font-mono font-semibold", nextMilestone.color)}>+{nextGap.toFixed(3)}</span>
                </div>
              </div>
            ) : (
              <div className="text-right">
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="size-3 mr-1" />
                  Sempurna tercapai!
                </Badge>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Milestone timeline */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {MILESTONES.map((m) => {
              const achieved = projectedIpk >= m.threshold;
              const currentAchieved = currentIpk >= m.threshold;
              const progress = Math.min(100, (projectedIpk / m.threshold) * 100);
              const Icon = m.icon;
              return (
                <div
                  key={m.threshold}
                  className={cn(
                    "rounded-lg border p-2.5 transition-all relative overflow-hidden",
                    achieved
                      ? `${m.borderColor} ${m.bgColor}`
                      : "border-border bg-muted/20 opacity-70"
                  )}
                >
                  {achieved && (
                    <div className="absolute top-1 right-1">
                      <Icon className={cn("size-3", m.color)} />
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className={cn("size-3.5", achieved ? m.color : "text-muted-foreground")} />
                    <span className={cn("text-[10px] font-semibold", achieved ? m.color : "text-muted-foreground")}>
                      {m.shortLabel}
                    </span>
                  </div>
                  <div className={cn("text-[11px] font-medium leading-tight", achieved ? "text-foreground" : "text-muted-foreground")}>
                    {m.label}
                  </div>
                  <div className="mt-1.5">
                    <Progress
                      value={progress}
                      className={cn("h-1", achieved && "[&>div]:bg-emerald-500")}
                    />
                  </div>
                  {achieved && !currentAchieved && (
                    <div className="text-[9px] text-emerald-600 mt-1 font-medium">
                      ★ baru tercapai
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>IPK Saat Ini</span>
              <span>Proyeksi</span>
            </div>
            <div className="relative h-3 rounded-full bg-muted overflow-hidden">
              {/* Current IPK position */}
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-sky-500/60 to-sky-500/40 transition-all"
                style={{ width: `${(currentIpk / 4) * 100}%` }}
              />
              {/* Projected IPK position (additional) */}
              <div
                className="absolute inset-y-0 bg-gradient-to-r from-amber-500/40 to-amber-500/60 transition-all"
                style={{
                  left: `${(currentIpk / 4) * 100}%`,
                  width: `${(delta / 4) * 100}%`,
                }}
              />
              {/* Milestone markers */}
              {MILESTONES.map((m) => (
                <div
                  key={m.threshold}
                  className="absolute inset-y-0 w-0.5 bg-foreground/40"
                  style={{ left: `${(m.threshold / 4) * 100}%` }}
                  title={m.label}
                />
              ))}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono font-semibold tabular-nums">{currentIpk.toFixed(3)}</span>
              <span className="font-mono font-semibold tabular-nums text-amber-600">
                {projectedIpk.toFixed(3)} (+{delta.toFixed(3)})
              </span>
            </div>
          </div>

          {/* Summary text */}
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <TrendingUp className="size-3 text-emerald-600" />
            <span>
              {delta > 0 ? (
                <>
                  Kenaikan <span className="font-semibold text-emerald-600">+{delta.toFixed(3)}</span> IPK
                  dengan <span className="font-semibold">{plannedSks} SKS</span> semester target
                  {totalSks > 0 && <> (total <span className="font-semibold">{totalSks + plannedSks} SKS</span>)</>}
                </>
              ) : (
                <>Pertahankan IPK saat ini dengan belajar konsisten.</>
              )}
            </span>
          </div>
        </CardContent>
      </Card>
    </FadeIn>
  );
}
