"use client";

import { useState, useEffect } from "react";
import {
  BookOpen,
  Loader2,
  Clock,
  Calendar,
  Lightbulb,
  Sparkles,
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
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { DifficultyBadge } from "./badges";
import { cn } from "@/lib/utils";

interface Allocation {
  courseName: string;
  normalizedName: string;
  sks: number;
  difficulty: number;
  hoursPerWeek: number;
  sessionsPerWeek: number;
  priority: "tinggi" | "sedang" | "rendah";
  reason: string;
  tips: string[];
}

interface StudyPlanResponse {
  totalHours: number;
  weeklyHoursTarget: number;
  scenario: string;
  multiplier: number;
  allocations: Allocation[];
  generalTips: string[];
  count: number;
}

interface StudyPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courses: { name: string; sks: number; difficulty?: number }[];
}

const PRIORITY_STYLES: Record<string, string> = {
  tinggi: "border-rose-500/40 text-rose-700 dark:text-rose-300 bg-rose-500/5",
  sedang: "border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/5",
  rendah: "border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/5",
};

export function StudyPlanDialog({ open, onOpenChange, courses }: StudyPlanDialogProps) {
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<StudyPlanResponse | null>(null);
  const [weeklyHours, setWeeklyHours] = useState(25);
  const [scenario, setScenario] = useState("serius");

  async function fetchPlan() {
    if (courses.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/gpa/study-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courses, weeklyHours, targetScenario: scenario }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setPlan(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Gagal membuat rencana belajar", { description: msg });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open && courses.length > 0) {
      fetchPlan();
    }
  }, [open]);

  function regenerate() {
    fetchPlan();
  }

  const maxHours = plan ? Math.max(...plan.allocations.map((a) => a.hoursPerWeek)) : 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <div className="flex items-start justify-between gap-2">
            <div>
              <DialogTitle className="flex items-center gap-2 text-base">
                <div className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm">
                  <BookOpen className="size-4" />
                </div>
                Rencana Belajar Mingguan
              </DialogTitle>
              <DialogDescription className="text-xs mt-1">
                Alokasi jam belajar per mata kuliah berdasarkan kesulitan & SKS.
              </DialogDescription>
            </div>
            {plan && (
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</div>
                <div className="font-mono font-semibold tabular-nums text-indigo-600">
                  {plan.totalHours} jam
                </div>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Controls */}
        <div className="px-5 py-3 border-b space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 block">
                Jam/Minggu: <span className="font-mono font-semibold text-foreground">{weeklyHours} jam</span>
              </label>
              <Slider
                value={[weeklyHours]}
                onValueChange={(v) => setWeeklyHours(v[0])}
                min={10}
                max={50}
                step={1}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 block">
                Skenario Target
              </label>
              <Select value={scenario} onValueChange={setScenario}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="santai">Santai (×1.0)</SelectItem>
                  <SelectItem value="serius">Serius (×1.3)</SelectItem>
                  <SelectItem value="keras">Keras (×1.6)</SelectItem>
                  <SelectItem value="maksimal">Maksimal (×2.0)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button size="sm" onClick={regenerate} disabled={loading} className="gap-1.5 w-full">
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            {loading ? "Membuat..." : "Buat Ulang Rencana"}
          </Button>
        </div>

        <ScrollArea className="flex-1 max-h-[50vh]">
          <div className="px-5 py-4 space-y-3 scrollbar-thin">
            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="rounded-lg border p-3 space-y-2">
                    <div className="h-4 w-3/4 rounded bg-indigo-500/10 animate-pulse" />
                    <div className="h-3 w-1/2 rounded bg-indigo-500/10 animate-pulse" />
                    <div className="h-2 w-full rounded bg-indigo-500/10 animate-pulse" />
                  </div>
                ))}
              </div>
            ) : plan ? (
              <>
                {/* Allocations */}
                <div className="space-y-2">
                  {plan.allocations.map((a, i) => (
                    <div key={i} className="rounded-lg border bg-card p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="text-[10px] font-mono text-muted-foreground">#{i + 1}</span>
                            <span className="font-medium text-sm truncate">{a.normalizedName}</span>
                            <Badge variant="outline" className={cn("text-[9px] capitalize", PRIORITY_STYLES[a.priority])}>
                              {a.priority}
                            </Badge>
                          </div>
                          <div className="text-[11px] text-muted-foreground">{a.reason}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="flex items-baseline gap-1">
                            <Clock className="size-3 text-indigo-600" />
                            <span className="font-mono font-semibold tabular-nums text-sm">{a.hoursPerWeek}h</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground">{a.sessionsPerWeek} sesi</div>
                        </div>
                      </div>
                      {/* Hours bar */}
                      <div>
                        <Progress value={(a.hoursPerWeek / maxHours) * 100} className="h-1.5" />
                      </div>
                      {/* Tips */}
                      <div className="space-y-1 pt-1">
                        {a.tips.map((tip, j) => (
                          <div key={j} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                            <Lightbulb className="size-3 text-amber-500 mt-0.5 shrink-0" />
                            <span className="leading-relaxed">{tip}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* General tips */}
                <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-1">
                    <Calendar className="size-3.5" />
                    Tips Umum
                  </div>
                  {plan.generalTips.map((tip, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[11px] text-foreground/80">
                      <span className="grid size-4 place-items-center rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 text-[9px] font-mono font-bold shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed">{tip}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-10 text-sm text-muted-foreground">
                <BookOpen className="mx-auto mb-2 size-6 opacity-40" />
                Klik "Buat Ulang Rencana" untuk membuat rencana belajar.
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="px-5 py-3 border-t">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
