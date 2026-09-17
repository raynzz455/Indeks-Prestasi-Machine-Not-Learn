"use client";

import { useState, useCallback } from "react";
import {
  Flame,
  Calendar,
  Check,
  Plus,
  TrendingUp,
  Award,
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
import { useLocalStorage } from "@/hooks/use-local-storage";
import { FadeIn } from "./motion";
import { cn } from "@/lib/utils";

interface StudyDay {
  date: string; // YYYY-MM-DD
  minutes: number;
}

interface StreakData {
  days: StudyDay[];
  goalMinutes: number;
  bestStreak: number;
  totalMinutes: number;
}

const EMPTY_STREAK: StreakData = { days: [], goalMinutes: 120, bestStreak: 0, totalMinutes: 0 };

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric" });
}

export function StudyStreakTracker() {
  const [data, setData] = useLocalStorage<StreakData>("ipk:streak", EMPTY_STREAK);
  const [adding, setAdding] = useState(false);
  const [quickMinutes, setQuickMinutes] = useState(30);

  const today = todayStr();
  const todayEntry = data.days.find((d) => d.date === today);
  const todayMinutes = todayEntry?.minutes ?? 0;
  const todayProgress = Math.min(100, (todayMinutes / data.goalMinutes) * 100);

  // Calculate current streak
  const currentStreak = calculateStreak(data.days);
  const last7Days = Array.from({ length: 7 }, (_, i) => dateStr(6 - i));

  const addMinutes = useCallback((mins: number) => {
    setData((prev) => {
      const existing = prev.days.find((d) => d.date === today);
      let days: StudyDay[];
      if (existing) {
        days = prev.days.map((d) =>
          d.date === today ? { ...d, minutes: d.minutes + mins } : d
        );
      } else {
        days = [...prev.days, { date: today, minutes: mins }];
      }
      // Keep only last 30 days
      days = days.filter((d) => {
        const diff = (Date.now() - new Date(d.date + "T00:00:00").getTime()) / 86400000;
        return diff <= 30;
      });
      const newStreak = calculateStreak(days);
      const totalMinutes = days.reduce((s, d) => s + d.minutes, 0);
      return {
        ...prev,
        days,
        bestStreak: Math.max(prev.bestStreak, newStreak),
        totalMinutes,
      };
    });
  }, [setData, today]);

  const resetDay = useCallback(() => {
    setData((prev) => ({
      ...prev,
      days: prev.days.filter((d) => d.date !== today),
    }));
  }, [setData, today]);

  const streakLevel = getStreakLevel(currentStreak);

  return (
    <FadeIn delay={0.1}>
      <Card className="border-2 border-orange-500/30 bg-gradient-to-br from-orange-500/5 via-amber-500/5 to-transparent overflow-hidden relative">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 opacity-60" />
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-sm">
                  <Flame className="size-4" />
                </div>
                Streak Belajar
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Catat sesi belajar harian & jaga streak untuk retensi maksimal.
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Streak Saat Ini</div>
              <div className="flex items-baseline gap-1">
                <span className="font-mono text-2xl font-bold tabular-nums text-orange-600">
                  {currentStreak}
                </span>
                <span className="text-xs text-muted-foreground">hari</span>
              </div>
              {currentStreak > 0 && (
                <Badge variant="outline" className="text-[9px] mt-0.5 border-orange-500/40 text-orange-700 dark:text-orange-300">
                  <Flame className="size-2.5 mr-1" />
                  {streakLevel.label}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Today's progress */}
          <div className="rounded-lg border bg-card/60 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="size-3.5 text-orange-600" />
                <span className="text-sm font-medium">Hari Ini</span>
                <span className="text-[11px] text-muted-foreground">
                  {todayMinutes} / {data.goalMinutes} menit
                </span>
              </div>
              {todayMinutes >= data.goalMinutes && (
                <Badge variant="outline" className="text-[9px] border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
                  <Check className="size-2.5 mr-1" />
                  Target tercapai
                </Badge>
              )}
            </div>
            <Progress value={todayProgress} className="h-2" />
            <div className="flex items-center gap-1.5 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => addMinutes(15)} className="h-7 text-xs gap-1">
                <Plus className="size-3" />15m
              </Button>
              <Button size="sm" variant="outline" onClick={() => addMinutes(30)} className="h-7 text-xs gap-1">
                <Plus className="size-3" />30m
              </Button>
              <Button size="sm" variant="outline" onClick={() => addMinutes(60)} className="h-7 text-xs gap-1">
                <Plus className="size-3" />1h
              </Button>
              <Button size="sm" variant="outline" onClick={() => addMinutes(90)} className="h-7 text-xs gap-1">
                <Plus className="size-3" />1.5h
              </Button>
              {todayMinutes > 0 && (
                <Button size="sm" variant="ghost" onClick={resetDay} className="h-7 text-xs ml-auto text-muted-foreground hover:text-rose-600">
                  Reset
                </Button>
              )}
            </div>
          </div>

          {/* Last 7 days heatmap */}
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">7 Hari Terakhir</div>
            <div className="grid grid-cols-7 gap-1">
              {last7Days.map((date) => {
                const entry = data.days.find((d) => d.date === date);
                const mins = entry?.minutes ?? 0;
                const intensity = Math.min(1, mins / data.goalMinutes);
                const isToday = date === today;
                return (
                  <div
                    key={date}
                    className={cn(
                      "rounded-md p-1.5 text-center border transition-all",
                      isToday && "ring-1 ring-orange-500/40"
                    )}
                    style={{
                      backgroundColor: intensity > 0
                        ? `oklch(${0.95 - intensity * 0.5} 0.15 ${75 - intensity * 20})`
                        : "oklch(0.97 0 0)",
                      borderColor: intensity > 0 ? "oklch(0.8 0.1 75)" : "oklch(0.9 0 0)",
                    }}
                    title={`${dayLabel(date)}: ${mins} menit`}
                  >
                    <div className="text-[9px] text-muted-foreground leading-none mb-0.5">
                      {dayLabel(date).slice(0, 3)}
                    </div>
                    <div className={cn(
                      "text-[10px] font-mono font-semibold tabular-nums leading-none",
                      intensity > 0.5 ? "text-white" : "text-foreground"
                    )}>
                      {mins > 0 ? `${mins}m` : "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border bg-card/40 px-2 py-1.5 text-center">
              <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Best Streak</div>
              <div className="flex items-center justify-center gap-1">
                <Award className="size-3 text-amber-500" />
                <span className="font-mono font-semibold tabular-nums text-sm">{data.bestStreak}</span>
              </div>
            </div>
            <div className="rounded-lg border bg-card/40 px-2 py-1.5 text-center">
              <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Total Belajar</div>
              <div className="flex items-center justify-center gap-1">
                <TrendingUp className="size-3 text-emerald-500" />
                <span className="font-mono font-semibold tabular-nums text-sm">
                  {Math.floor(data.totalMinutes / 60)}h
                </span>
              </div>
            </div>
            <div className="rounded-lg border bg-card/40 px-2 py-1.5 text-center">
              <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Target</div>
              <div className="flex items-center justify-center gap-1">
                <Calendar className="size-3 text-sky-500" />
                <span className="font-mono font-semibold tabular-nums text-sm">{data.goalMinutes}m</span>
              </div>
            </div>
          </div>

          {/* Achievements */}
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <Award className="size-3" />
              Pencapaian
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {ACHIEVEMENTS.map((a) => {
                const unlocked = data.bestStreak >= a.threshold;
                return (
                  <div
                    key={a.threshold}
                    className={cn(
                      "rounded-md border p-1.5 text-center transition-all",
                      unlocked
                        ? "border-amber-500/40 bg-amber-500/10"
                        : "border-border bg-muted/20 opacity-50"
                    )}
                    title={`${a.label} — ${a.description}`}
                  >
                    <div className={cn(
                      "text-base leading-none mb-0.5",
                      unlocked ? "" : "grayscale opacity-40"
                    )}>
                      {a.emoji}
                    </div>
                    <div className={cn(
                      "text-[8px] font-medium leading-tight",
                      unlocked ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"
                    )}>
                      {a.shortLabel}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Motivational message */}
          <div className={cn(
            "rounded-md px-3 py-2 text-xs text-center",
            currentStreak === 0
              ? "bg-muted/40 text-muted-foreground"
              : "bg-orange-500/10 text-orange-700 dark:text-orange-300"
          )}>
            {getMotivationalMessage(currentStreak, todayMinutes, data.goalMinutes)}
          </div>
        </CardContent>
      </Card>
    </FadeIn>
  );
}

function calculateStreak(days: StudyDay[]): number {
  if (days.length === 0) return 0;
  const sorted = [...days].sort((a, b) => b.date.localeCompare(a.date));
  const today = todayStr();
  const yesterday = dateStr(1);

  // Streak must include today or yesterday to be "active"
  if (sorted[0].date !== today && sorted[0].date !== yesterday) return 0;

  let streak = 0;
  let expectedDate = sorted[0].date;
  for (const d of sorted) {
    if (d.date === expectedDate && d.minutes > 0) {
      streak++;
      const prev = new Date(expectedDate + "T00:00:00");
      prev.setDate(prev.getDate() - 1);
      expectedDate = prev.toISOString().slice(0, 10);
    } else if (d.date !== expectedDate) {
      break;
    }
  }
  return streak;
}

function getStreakLevel(streak: number): { label: string; emoji: string } {
  if (streak >= 30) return { label: "Legendaris", emoji: "🏆" };
  if (streak >= 14) return { label: "Konsisten", emoji: "🔥" };
  if (streak >= 7) return { label: "Seminggu", emoji: "⚡" };
  if (streak >= 3) return { label: "Membangun", emoji: "✨" };
  if (streak >= 1) return { label: "Mulai", emoji: "🌱" };
  return { label: "Belum mulai", emoji: "" };
}

function getMotivationalMessage(streak: number, todayMins: number, goal: number): string {
  if (streak === 0) {
    return "🌱 Mulai streak belajar hari ini — catat sesi pertama kamu!";
  }
  if (todayMins >= goal) {
    if (streak >= 7) return `🔥 ${streak} hari beruntun! Pertahankan konsistensi ini.`;
    if (streak >= 3) return `⚡ ${streak} hari! Lanjutkan besok untuk membangun momentum.`;
    return `✨ Target hari ini tercapai! Besok lagi ya.`;
  }
  return `📊 Streak ${streak} hari. Tinggal ${goal - todayMins} menit lagi untuk target hari ini.`;
}

const ACHIEVEMENTS: { threshold: number; label: string; shortLabel: string; emoji: string; description: string }[] = [
  { threshold: 1, label: "Langkah Pertama", shortLabel: "1 Hari", emoji: "🌱", description: "Catat sesi belajar pertama" },
  { threshold: 3, label: "Membangun Momentum", shortLabel: "3 Hari", emoji: "✨", description: "Belajar 3 hari beruntun" },
  { threshold: 7, label: "Seminggu Konsisten", shortLabel: "7 Hari", emoji: "⚡", description: "Belajar 7 hari beruntun" },
  { threshold: 14, label: "Dua Minggu", shortLabel: "14 Hari", emoji: "🔥", description: "Belajar 14 hari beruntun" },
  { threshold: 30, label: "Legendaris", shortLabel: "30 Hari", emoji: "🏆", description: "Belajar 30 hari beruntun" },
];
