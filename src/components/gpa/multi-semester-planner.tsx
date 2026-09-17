"use client";

import { useState } from "react";
import {
  CalendarRange,
  Plus,
  Trash2,
  Loader2,
  TrendingUp,
  ChevronRight,
  Map,
  Target,
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import { GRADE_ORDER } from "@/lib/gpa/config";
import { normalizeCourseName } from "@/lib/gpa/course-normalizer";
import { DifficultyBadge, GradeBadge, IpkBadge } from "./badges";
import { FadeIn } from "./motion";
import { cn } from "@/lib/utils";

interface MultiSemesterPlannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transcript: { courseName: string; sks: number; grade: string; semester: number }[];
  currentIpk: number;
  targetIpk?: number;
}

interface PlannedCourse {
  id: string;
  courseName: string;
  sks: string;
  userDifficultyOverride?: number;
}

interface SemesterPlan {
  id: string;
  courses: PlannedCourse[];
}

interface MultiSemesterResult {
  semesters: {
    semesterIndex: number;
    courses: { name: string; sks: number; grade: string; scenario: string }[];
    projectedIpk: number;
    ipkDelta: number;
    scenarioUsed: string;
  }[];
  finalIpk: number;
  totalDelta: number;
  achievesTarget: boolean;
  message: string;
}

let msCounter = 7000;
function nextId() { return `ms-${++msCounter}`; }

const SCENARIO_BADGE_CLASSES: Record<string, string> = {
  santai: "border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
  serius: "border-sky-500/40 text-sky-700 dark:text-sky-300",
  keras: "border-amber-500/40 text-amber-700 dark:text-amber-300",
  maksimal: "border-rose-500/40 text-rose-700 dark:text-rose-300",
};

export function MultiSemesterPlanner({ open, onOpenChange, transcript, currentIpk, targetIpk }: MultiSemesterPlannerProps) {
  const [plans, setPlans] = useState<SemesterPlan[]>([
    { id: nextId(), courses: [{ id: nextId(), courseName: "", sks: "3" }] },
  ]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MultiSemesterResult | null>(null);

  function addSemester() {
    if (plans.length >= 4) {
      toast.warning("Maksimal 4 semester ke depan");
      return;
    }
    setPlans([...plans, { id: nextId(), courses: [{ id: nextId(), courseName: "", sks: "3" }] }]);
  }

  function removeSemester(id: string) {
    setPlans(plans.filter((p) => p.id !== id));
  }

  function addCourse(semId: string) {
    setPlans(plans.map((p) =>
      p.id === semId ? { ...p, courses: [...p.courses, { id: nextId(), courseName: "", sks: "3" }] } : p
    ));
  }

  function removeCourse(semId: string, courseId: string) {
    setPlans(plans.map((p) =>
      p.id === semId ? { ...p, courses: p.courses.filter((c) => c.id !== courseId) } : p
    ));
  }

  function updateCourse(semId: string, courseId: string, field: keyof PlannedCourse, value: string) {
    setPlans(plans.map((p) =>
      p.id === semId
        ? { ...p, courses: p.courses.map((c) => (c.id === courseId ? { ...c, [field]: value } : c)) }
        : p
    ));
  }

  async function handlePlan() {
    const validPlans = plans
      .map((p) => ({ ...p, courses: p.courses.filter((c) => c.courseName.trim()) }))
      .filter((p) => p.courses.length > 0);

    if (validPlans.length === 0) {
      toast.error("Isi minimal 1 mata kuliah di minimal 1 semester");
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/gpa/multi-semester", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          semesterPlans: validPlans.map((p) => ({
            courses: p.courses.map((c) => ({
              courseName: c.courseName,
              sks: Number(c.sks),
              userDifficultyOverride: c.userDifficultyOverride,
            })),
          })),
          targetIpk,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setResult(data);
      toast.success("Rencana multi-semester selesai", {
        description: `IPK proyeksi: ${data.finalIpk.toFixed(3)} (Δ +${data.totalDelta.toFixed(3)})`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Gagal merencanakan multi-semester", { description: msg });
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setPlans([{ id: nextId(), courses: [{ id: nextId(), courseName: "", sks: "3" }] }]);
    setResult(null);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">
            <CalendarRange className="size-4 text-violet-600" />
            Perencanaan Multi-Semester
          </DialogTitle>
          <DialogDescription className="text-xs">
            Rencanakan 1-4 semester ke depan. Sistem akan mensimulasikan tiap semester dengan skenario terbaik dari semester sebelumnya.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[60vh]">
          <div className="px-5 py-4 space-y-4">
            {/* Current IPK summary */}
            <div className="rounded-lg border bg-muted/30 px-3 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="size-4 text-emerald-600" />
                <span className="text-muted-foreground">IPK awal:</span>
                <span className="font-mono font-semibold tabular-nums">{currentIpk.toFixed(3)}</span>
              </div>
              {targetIpk !== undefined && (
                <div className="flex items-center gap-2 text-sm">
                  <Target className="size-4 text-amber-600" />
                  <span className="text-muted-foreground">Target:</span>
                  <span className="font-mono font-semibold text-amber-700 dark:text-amber-300">{targetIpk.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Semester plans */}
            <Accordion type="multiple" defaultValue={plans.map((p) => p.id)} className="space-y-3">
              {plans.map((plan, idx) => (
                <AccordionItem key={plan.id} value={plan.id} className="rounded-lg border bg-card overflow-hidden">
                  <AccordionTrigger className="px-3 py-2.5 hover:no-underline hover:bg-muted/30">
                    <div className="flex items-center gap-2 flex-1 pr-2">
                      <span className="grid size-6 place-items-center rounded-full bg-violet-500/15 text-violet-700 dark:text-violet-300 text-xs font-mono font-bold shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-medium text-sm">Semester ke-{idx + 1}</span>
                      <Badge variant="outline" className="text-[10px] ml-1">
                        {plan.courses.filter((c) => c.courseName.trim()).length} MK
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-3 pb-3 space-y-2">
                    {plan.courses.map((c) => {
                      const norm = normalizeCourseName(c.courseName);
                      const diff = c.userDifficultyOverride ?? norm.typicalDifficulty ?? 0.5;
                      return (
                        <div key={c.id} className="flex items-center gap-2">
                          <Input
                            placeholder="Nama mata kuliah"
                            value={c.courseName}
                            onChange={(e) => updateCourse(plan.id, c.id, "courseName", e.target.value)}
                            className="flex-1 h-8"
                          />
                          <Input
                            type="number"
                            min={1}
                            max={8}
                            value={c.sks}
                            onChange={(e) => updateCourse(plan.id, c.id, "sks", e.target.value)}
                            className="w-16 h-8 text-center"
                          />
                          {c.courseName.trim() && (
                            <div className="hidden sm:flex items-center gap-1">
                              <ChevronRight className="size-3 text-muted-foreground" />
                              <span className="text-[11px] font-medium truncate max-w-[120px]">{norm.normalizedName}</span>
                              <DifficultyBadge score={diff} label={diff < 0.4 ? "mudah" : diff < 0.7 ? "medium" : "sulit"} />
                            </div>
                          )}
                          <button
                            onClick={() => removeCourse(plan.id, c.id)}
                            className="rounded p-1 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600"
                            aria-label="Hapus"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      );
                    })}
                    <div className="flex items-center gap-2 pt-1">
                      <Button variant="ghost" size="sm" onClick={() => addCourse(plan.id)} className="gap-1.5 text-xs h-7">
                        <Plus className="size-3" />
                        Tambah MK
                      </Button>
                      {plans.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => removeSemester(plan.id)} className="gap-1.5 text-xs h-7 text-rose-600 hover:text-rose-700 ml-auto">
                          <Trash2 className="size-3" />
                          Hapus Semester
                        </Button>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            {plans.length < 4 && (
              <Button variant="outline" size="sm" onClick={addSemester} className="gap-1.5 w-full border-dashed">
                <Plus className="size-3.5" />
                Tambah Semester
              </Button>
            )}

            {/* Results */}
            {loading && (
              <div className="rounded-lg border bg-muted/20 py-10 text-center">
                <Loader2 className="mx-auto mb-2 size-6 animate-spin text-violet-600" />
                <p className="text-sm text-muted-foreground">Mensimulasikan {plans.length} semester…</p>
              </div>
            )}

            {result && !loading && (
              <FadeIn>
                <div className="space-y-3">
                  {/* Summary */}
                  <div className={cn(
                    "rounded-lg border-2 p-3 relative overflow-hidden",
                    result.achievesTarget
                      ? "border-emerald-500/40 bg-emerald-500/5"
                      : "border-amber-500/40 bg-amber-500/5"
                  )}>
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 via-violet-400 to-violet-500 opacity-50" />
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">{result.achievesTarget ? "Target Tercapai" : "Belum Mencapai Target"}</div>
                        <p className="text-xs text-muted-foreground mt-0.5 max-w-md">{result.message}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[10px] text-muted-foreground">IPK Final</div>
                        <IpkBadge ipk={result.finalIpk} delta={result.totalDelta} />
                      </div>
                    </div>
                  </div>

                  {/* Semester roadmap */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Map className="size-3.5" />
                      Peta Jalan Semester
                    </div>
                    {result.semesters.map((sem, i) => (
                      <FadeIn key={i} delay={i * 0.1}>
                        <div className="rounded-lg border bg-card px-3 py-2.5">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span className="grid size-6 place-items-center rounded-full bg-violet-500/15 text-violet-700 dark:text-violet-300 text-xs font-mono font-bold">
                                {i + 1}
                              </span>
                              <span className="text-sm font-medium">Semester {sem.semesterIndex}</span>
                              <Badge variant="outline" className={cn("text-[10px] capitalize", SCENARIO_BADGE_CLASSES[sem.scenarioUsed] ?? "border-border text-muted-foreground")}>
                                {sem.scenarioUsed}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground">IPK:</span>
                              <span className="font-mono font-semibold tabular-nums text-sm">{sem.projectedIpk.toFixed(3)}</span>
                              <span className={cn("text-[10px] font-mono", sem.ipkDelta > 0 ? "text-emerald-600" : "text-rose-600")}>
                                {sem.ipkDelta > 0 ? "+" : ""}{sem.ipkDelta.toFixed(3)}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {sem.courses.map((c, j) => (
                              <div key={j} className="flex items-center gap-1">
                                {j > 0 && <span className="text-muted-foreground text-[10px]">·</span>}
                                <GradeBadge grade={c.grade} size="sm" />
                                <span className="text-[11px] text-muted-foreground max-w-[100px] truncate">{c.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </FadeIn>
                    ))}
                  </div>
                </div>
              </FadeIn>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="px-5 py-3 border-t gap-2">
          <Button variant="outline" size="sm" onClick={reset}>Reset</Button>
          <Button
            size="sm"
            onClick={handlePlan}
            disabled={loading}
            className="gap-1.5 bg-violet-600 hover:bg-violet-700"
          >
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <CalendarRange className="size-3.5" />}
            Simulasikan {plans.length} Semester
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
