"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import {
  GraduationCap,
  Sparkles,
  Cpu,
  Wand2,
  Loader2,
  AlertCircle,
  BookOpen,
  Github,
  Calculator,
  Sliders,
  TrendingUp,
  Save,
  RotateCcw,
  CalendarRange,
  GitCompare,
  Keyboard,
  HelpCircle,
  Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { TranscriptInput, type TranscriptRow } from "@/components/gpa/transcript-input";
import { CoursePlanner, type PlannedRow } from "@/components/gpa/course-planner";
import { ResultsView } from "@/components/gpa/results-view";
import { WhatIfSimulator } from "@/components/gpa/what-if-simulator";
import { CourseCatalogDialog } from "@/components/gpa/course-catalog-dialog";
import { CourseRecommendationDialog } from "@/components/gpa/course-recommendation-dialog";
import { StudyPlanDialog } from "@/components/gpa/study-plan-dialog";
import { StudyStreakTracker } from "@/components/gpa/study-streak-tracker";
import { GraduationSimulator } from "@/components/gpa/graduation-simulator";
import { ModelEvaluationDashboard } from "@/components/gpa/model-evaluation-dashboard";
import { MultiSemesterPlanner } from "@/components/gpa/multi-semester-planner";
import { ResultsSkeleton } from "@/components/gpa/results-skeleton";
import { ComparisonDrawer } from "@/components/gpa/comparison-drawer";
import { ShareButton } from "@/components/gpa/share-button";
import { OnboardingTour } from "@/components/gpa/onboarding-tour";
import { ThemeToggle } from "@/components/gpa/theme-toggle";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useComparisonStore } from "@/hooks/use-comparison-store";
import { normalizeGrade } from "@/lib/gpa/grade-utils";
import { normalizeCourseName as normalizeName } from "@/lib/gpa/course-normalizer";
import { decodeStateFromUrl, clearSharedState, hasSharedState } from "@/lib/gpa/share";
import type { OptimizationResult } from "@/lib/gpa/types";
import type { CanonicalCourse } from "@/lib/gpa/config";

let addCounter = 5000;
function nextPlannedId() { return `p-${++addCounter}`; }

// Stable empty-array references so useLocalStorage doesn't re-subscribe every render.
const EMPTY_TRANSCRIPT: TranscriptRow[] = [];
const EMPTY_PLANNED: PlannedRow[] = [];

export default function Home() {
  const [transcript, setTranscript] = useLocalStorage<TranscriptRow[]>("ipk:transcript", EMPTY_TRANSCRIPT);
  const [planned, setPlanned] = useLocalStorage<PlannedRow[]>("ipk:planned", EMPTY_PLANNED);
  const [targetSlider, setTargetSlider] = useLocalStorage<number>("ipk:target", 350);
  const [useTarget, setUseTarget] = useLocalStorage<boolean>("ipk:useTarget", false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [multiSemesterOpen, setMultiSemesterOpen] = useState(false);
  const [recommendationsOpen, setRecommendationsOpen] = useState(false);
  const [studyPlanOpen, setStudyPlanOpen] = useState(false);
  const [graduationOpen, setGraduationOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"optimize" | "simulator">("optimize");
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const { pinned, toggleDrawer, isDrawerOpen } = useComparisonStore();

  // Keyboard shortcuts
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Ignore if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      // Ctrl/Cmd + Enter → optimize
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (!loading && planned.length > 0) {
          handleOptimize();
        }
      }
      // "c" → toggle comparison drawer
      if (e.key === "c" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        toggleDrawer();
      }
      // "?" → shortcuts dialog
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [loading, planned, toggleDrawer]);

  // Load shared state from URL hash on mount
  useEffect(() => {
    if (!hasSharedState()) return;
    const state = decodeStateFromUrl();
    if (!state) return;
    try {
      if (state.t && Array.isArray(state.t)) {
        const loaded: TranscriptRow[] = state.t.map((t, i) => ({
          id: `shared-t-${i}`,
          courseName: t.n,
          sks: String(t.s),
          grade: t.g,
          semester: String(t.sm),
          major: t.m ?? "Umum",
        }));
        setTranscript(loaded);
      }
      if (state.p && Array.isArray(state.p)) {
        const loaded: PlannedRow[] = state.p.map((p, i) => ({
          id: `shared-p-${i}`,
          courseName: p.n,
          sks: String(p.s),
          userDifficultyOverride: p.d,
        }));
        setPlanned(loaded);
      }
      if (typeof state.ti === "number") {
        setTargetSlider(state.ti);
      }
      if (typeof state.ut === "boolean") {
        setUseTarget(state.ut);
      }
      toast.success("Data dibagikan dimuat", {
        description: "Transkrip & mata kuliah target dimuat dari link.",
      });
      // Clear the hash so refresh doesn't re-trigger
      clearSharedState();
    } catch {
      // ignore parse errors
    }
  }, []);

  const transcriptStats = useMemo(() => {
    const valid = transcript
      .map((r) => ({ ...r, sks: Number(r.sks) || 0, gradePoint: normalizeGrade(r.grade).gradePoint }))
      .filter((r) => r.sks > 0 && r.courseName.trim());
    const totalSks = valid.reduce((s, r) => s + r.sks, 0);
    const weighted = valid.reduce((s, r) => s + r.sks * r.gradePoint, 0);
    const ipk = totalSks > 0 ? weighted / totalSks : 0;
    return { count: valid.length, totalSks, ipk };
  }, [transcript]);

  const plannedSks = useMemo(
    () => planned.reduce((s, p) => s + (Number(p.sks) || 0), 0),
    [planned]
  );

  // Planned courses with normalization for the simulator
  const plannedNormalized = useMemo(
    () =>
      planned.map((p) => {
        const norm = normalizeName(p.courseName);
        const diff = p.userDifficultyOverride ?? norm.typicalDifficulty ?? 0.5;
        return {
          id: p.id,
          name: p.courseName,
          normalizedName: norm.normalizedName,
          sks: Number(p.sks) || 3,
          difficultyScore: diff,
        };
      }),
    [planned]
  );

  const handleOptimize = useCallback(async () => {
    if (planned.length === 0) {
      toast.error("Tambahkan minimal 1 mata kuliah target");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const payload = {
        transcript: transcript.map((t) => ({
          courseName: t.courseName,
          sks: Number(t.sks),
          grade: t.grade,
          semester: Number(t.semester),
          major: t.major,
        })),
        plannedCourses: planned.map((p) => ({
          courseName: p.courseName,
          sks: Number(p.sks),
          userDifficultyOverride: p.userDifficultyOverride,
        })),
        targetIpk: useTarget ? targetSlider / 100 : undefined,
      };
      const res = await fetch("/api/gpa/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? `HTTP ${res.status}`);
      }
      const data: OptimizationResult = await res.json();
      setResult(data);
      toast.success("Optimasi selesai", {
        description: `Skenario terbaik: ${data.summary.bestScenario} (+${data.summary.bestOverallDelta.toFixed(3)})`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.error("Gagal menjalankan optimasi", { description: msg });
    } finally {
      setLoading(false);
    }
  }, [transcript, planned, useTarget, targetSlider]);

  function handleAddFromCatalog(c: CanonicalCourse) {
    setPlanned([
      ...planned,
      {
        id: nextPlannedId(),
        courseName: c.name,
        sks: String(c.defaultSks),
        userDifficultyOverride: c.typicalDifficulty,
      },
    ]);
    toast.success(`Ditambahkan: ${c.name}`, {
      description: `${c.defaultSks} SKS · ${c.category}`,
    });
  }

  function resetAll() {
    setTranscript([]);
    setPlanned([]);
    setResult(null);
    setError(null);
    toast.success("Data direset");
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background via-background to-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm shrink-0">
              <GraduationCap className="size-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-semibold leading-tight truncate">
                IPK Optimizer
              </h1>
              <p className="text-[11px] text-muted-foreground leading-tight truncate">
                Indeks Prestasi · Machine Not Learn
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="hidden sm:inline-flex gap-1 text-[10px]">
              <Cpu className="size-3" />
              K-Means + LogReg
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg"
              onClick={() => {
                localStorage.removeItem("ipk:onboarded");
                window.dispatchEvent(new StorageEvent("storage", { key: "ipk:onboarded", newValue: null }));
                setTimeout(() => window.location.reload(), 200);
              }}
              aria-label="Bantuan"
              title="Bantuan / Tour"
            >
              <HelpCircle className="size-4" />
            </Button>
            <ThemeToggle />
            <a
              href="https://github.com/raynzz455/Indeks-Prestasi-Machine-Not-Learn"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground p-1.5"
              aria-label="Repository"
            >
              <Github className="size-4" />
            </a>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 container mx-auto max-w-6xl px-4 py-6 space-y-6">
        {/* Hero */}
        <section className="rounded-2xl border bg-gradient-to-br from-emerald-500/8 via-teal-500/5 to-sky-500/5 p-5 sm:p-6 relative overflow-hidden">
          <div className="absolute -top-12 -right-12 size-48 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 size-48 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />
          <div className="flex items-start gap-3 relative">
            <div className="grid size-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 shrink-0 ring-1 ring-emerald-500/20">
              <Wand2 className="size-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-semibold tracking-tight">
                Rencanakan kombinasi nilai untuk mendongkrak IPK
              </h2>
              <p className="mt-1 text-sm text-muted-foreground max-w-3xl">
                Sistem rekomendasi akademik berbasis ML (K-Means clustering +
                logistic regression). Input transkrip, tentukan mata kuliah semester
                target, lalu dapatkan 4 kelompok kombinasi nilai (santai · serius ·
                keras · maksimal) lengkap dengan proyeksi IPK & tingkat kesulitan
                kumulatif.
              </p>
            </div>
          </div>
        </section>

        {/* Inputs grid */}
        <div className="grid lg:grid-cols-2 gap-4">
          <TranscriptInput rows={transcript} onChange={setTranscript} />
          <CoursePlanner rows={planned} onChange={setPlanned} onOpenCatalog={() => setCatalogOpen(true)} onOpenRecommendations={() => setRecommendationsOpen(true)} />
        </div>

        {/* Target + action */}
        <Card className="border-2 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-amber-500/40 via-amber-500/20 to-transparent" />
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calculator className="size-4 text-amber-600" />
                  Target & Eksekusi Optimasi
                </CardTitle>
                <CardDescription>
                  (Opsional) Tetapkan target IPK lalu jalankan model.
                </CardDescription>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <ShareButton
                  transcript={transcript.map((t) => ({
                    courseName: t.courseName,
                    sks: Number(t.sks),
                    grade: t.grade,
                    semester: Number(t.semester),
                    major: t.major,
                  }))}
                  planned={planned.map((p) => ({
                    courseName: p.courseName,
                    sks: Number(p.sks),
                    userDifficultyOverride: p.userDifficultyOverride,
                  }))}
                  targetIpk={useTarget ? targetSlider / 100 : undefined}
                  useTarget={useTarget}
                />
                <Button variant="ghost" size="sm" onClick={resetAll} className="gap-1.5 text-muted-foreground hover:text-rose-600">
                  <RotateCcw className="size-3.5" />
                  Reset
                </Button>
                <Badge variant="outline" className="gap-1 text-[10px]">
                  <Save className="size-3" />
                  Auto-save
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                variant={useTarget ? "default" : "outline"}
                size="sm"
                onClick={() => setUseTarget((v) => !v)}
                className="gap-1.5"
              >
                <Sparkles className="size-3.5" />
                {useTarget ? "Target aktif" : "Aktifkan target IPK"}
              </Button>
              {useTarget && (
                <span className="text-sm font-mono tabular-nums">
                  Target: <span className="font-semibold text-amber-700 dark:text-amber-300">{(targetSlider / 100).toFixed(2)}</span>
                </span>
              )}
            </div>
            {useTarget && (
              <div className="space-y-2">
                <Slider
                  value={[targetSlider]}
                  onValueChange={(v) => setTargetSlider(v[0])}
                  min={250}
                  max={400}
                  step={1}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                  <span>2.50</span>
                  <span>3.00</span>
                  <span>3.50</span>
                  <span>4.00</span>
                </div>
              </div>
            )}

            {/* Live mini summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <SummaryStat label="IPK Saat Ini" value={transcriptStats.ipk > 0 ? transcriptStats.ipk.toFixed(3) : "—"} />
              <SummaryStat label="SKS Lulus" value={transcriptStats.totalSks > 0 ? String(transcriptStats.totalSks) : "—"} />
              <SummaryStat label="Mata Kuliah Target" value={String(planned.length)} />
              <SummaryStat label="SKS Target" value={String(plannedSks)} />
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button
                onClick={handleOptimize}
                disabled={loading || planned.length === 0}
                className="gap-2"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Menjalankan model...
                  </>
                ) : (
                  <>
                    <Wand2 className="size-4" />
                    Optimasi IPK
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setMultiSemesterOpen(true)}
                disabled={loading}
                className="gap-1.5"
                size="lg"
              >
                <CalendarRange className="size-4 text-violet-600" />
                Rencana Multi-Semester
              </Button>
              <Button
                variant="outline"
                onClick={() => setStudyPlanOpen(true)}
                disabled={loading || planned.length === 0}
                className="gap-1.5"
                size="lg"
              >
                <BookOpen className="size-4 text-indigo-600" />
                Rencana Belajar
              </Button>
              <Button
                variant="outline"
                onClick={() => setGraduationOpen(true)}
                disabled={loading || transcriptStats.totalSks === 0}
                className="gap-1.5"
                size="lg"
              >
                <GraduationCap className="size-4 text-emerald-600" />
                Simulasi Kelulusan
              </Button>
              {planned.length === 0 && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="size-3.5" />
                  Tambah minimal 1 mata kuliah target dulu
                </span>
              )}
              {transcript.length === 0 && planned.length > 0 && (
                <span className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertCircle className="size-3.5" />
                  Tanpa transkrip, model pakai baseline sintetis
                </span>
              )}
            </div>

            {error && (
              <div className="rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-sm text-rose-700 dark:text-rose-300 flex items-start gap-2">
                <AlertCircle className="size-4 mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium">Gagal menjalankan optimasi</div>
                  <div className="text-xs opacity-80">{error}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs: Optimize results vs What-if simulator vs Streak */}
        {(result || planned.length > 0) && (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "optimize" | "simulator" | "streak")} className="w-full">
            <TabsList className="grid w-full max-w-lg grid-cols-3">
              <TabsTrigger value="optimize" className="gap-1.5">
                <TrendingUp className="size-3.5" />
                Hasil Optimasi
              </TabsTrigger>
              <TabsTrigger value="simulator" className="gap-1.5">
                <Sliders className="size-3.5" />
                What-If Simulator
              </TabsTrigger>
              <TabsTrigger value="streak" className="gap-1.5">
                <Flame className="size-3.5" />
                Streak Belajar
              </TabsTrigger>
            </TabsList>
            <TabsContent value="optimize" className="mt-4 space-y-4">
              {loading ? (
                <ResultsSkeleton />
              ) : result ? (
                <ResultsView
                  result={result}
                  transcript={transcript.map((t) => ({
                    courseName: t.courseName,
                    sks: Number(t.sks),
                    grade: t.grade,
                    semester: Number(t.semester),
                  }))}
                  planned={planned.map((p) => ({ courseName: p.courseName, sks: Number(p.sks), userDifficultyOverride: p.userDifficultyOverride }))}
                />
              ) : (
                <Card className="border-dashed">
                  <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    <TrendingUp className="mx-auto mb-2 size-6 opacity-40" />
                    Jalankan optimasi untuk melihat hasil di sini.
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            <TabsContent value="simulator" className="mt-4">
              {planned.length > 0 ? (
                <WhatIfSimulator
                  currentIpk={transcriptStats.ipk}
                  totalSks={transcriptStats.totalSks}
                  courses={plannedNormalized}
                />
              ) : (
                <Card className="border-dashed">
                  <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    <Sliders className="mx-auto mb-2 size-6 opacity-40" />
                    Tambahkan mata kuliah target untuk memakai simulator.
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            <TabsContent value="streak" className="mt-4">
              <StudyStreakTracker />
            </TabsContent>
          </Tabs>
        )}

        {/* How it works */}
        {!result && (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="size-4 text-muted-foreground" />
                Cara Kerja
              </CardTitle>
              <CardDescription>Alur pipeline 2-model hybrid decision system.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                {[
                  { n: 1, t: "Normalisasi", d: "Nama mata kuliah & nilai dinormalisasi (Levenshtein + token match, skala 10 kelas).", c: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
                  { n: 2, t: "Model 1: K-Means", d: "Mata kuliah di-cluster jadi 5 kelompok kesulitan dari distribusi nilai nyata.", c: "bg-teal-500/15 text-teal-700 dark:text-teal-300" },
                  { n: 3, t: "Model 2: LogReg", d: "Regresi softmax memprediksi distribusi probabilitas 10 kelas nilai per MK.", c: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
                  { n: 4, t: "4 Skenario", d: "Kombinasi nilai di-bundle per tingkat usaha: santai, serius, keras, maksimal.", c: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
                ].map((s) => (
                  <li key={s.n} className="rounded-lg border bg-muted/20 p-3 hover:bg-muted/40 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`grid size-6 place-items-center rounded-full text-xs font-mono font-bold ${s.c}`}>
                        {s.n}
                      </span>
                      <span className="font-medium text-sm">{s.t}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{s.d}</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        )}

        {/* Model Evaluation Dashboard */}
        <ModelEvaluationDashboard />
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t bg-background/80 backdrop-blur">
        <div className="container mx-auto max-w-6xl px-4 py-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <BookOpen className="size-3.5" />
            <span>Skala nilai 10 kelas · IPK formula: (IPK·SKS + IPS·SKS) / (SKS total)</span>
          </div>
          <div className="flex items-center gap-3">
            <span>Diadaptasi dari</span>
            <a
              href="https://github.com/raynzz455/Indeks-Prestasi-Machine-Not-Learn"
              className="font-medium hover:text-foreground"
              target="_blank"
              rel="noopener noreferrer"
            >
              Indeks-Prestasi-Machine-Not-Learn
            </a>
          </div>
        </div>
      </footer>

      {/* Course catalog dialog */}
      <CourseCatalogDialog
        open={catalogOpen}
        onOpenChange={setCatalogOpen}
        onSelect={handleAddFromCatalog}
      />

      {/* Multi-semester planner dialog */}
      <MultiSemesterPlanner
        open={multiSemesterOpen}
        onOpenChange={setMultiSemesterOpen}
        transcript={transcript.map((t) => ({
          courseName: t.courseName,
          sks: Number(t.sks),
          grade: t.grade,
          semester: Number(t.semester),
        }))}
        currentIpk={transcriptStats.ipk}
        targetIpk={useTarget ? targetSlider / 100 : undefined}
      />

      {/* Comparison drawer */}
      <ComparisonDrawer />

      {/* Floating comparison button */}
      {pinned.length > 0 && !isDrawerOpen && (
        <button
          onClick={toggleDrawer}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-violet-600 px-4 py-3 text-white shadow-lg shadow-violet-600/30 hover:bg-violet-700 hover:shadow-violet-600/40 transition-all hover:scale-105 group"
          aria-label="Buka perbandingan"
        >
          <GitCompare className="size-5" />
          <span className="text-sm font-medium">Bandingkan</span>
          <span className="grid min-w-5 h-5 place-items-center rounded-full bg-white/20 px-1.5 text-xs font-bold">
            {pinned.length}
          </span>
        </button>
      )}

      {/* Floating keyboard shortcuts button */}
      <button
        onClick={() => setShortcutsOpen(true)}
        className="fixed bottom-6 left-6 z-40 grid size-10 place-items-center rounded-full bg-background border shadow-sm hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        aria-label="Keyboard shortcuts"
        title="Keyboard shortcuts (?)"
      >
        <Keyboard className="size-4" />
      </button>

      {/* Keyboard shortcuts dialog */}
      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Keyboard className="size-4 text-muted-foreground" />
              Keyboard Shortcuts
            </DialogTitle>
            <DialogDescription className="text-xs">
              Pintasan keyboard untuk navigasi cepat.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {[
              { keys: ["Ctrl", "Enter"], desc: "Jalankan optimasi IPK" },
              { keys: ["C"], desc: "Buka/tutup panel perbandingan" },
              { keys: ["?"], desc: "Buka dialog pintasan ini" },
              { keys: ["Esc"], desc: "Tutup dialog yang aktif" },
            ].map((s) => (
              <div key={s.keys.join("+")} className="flex items-center justify-between rounded-md border px-3 py-2">
                <span className="text-sm text-muted-foreground">{s.desc}</span>
                <div className="flex items-center gap-1">
                  {s.keys.map((k, i) => (
                    <kbd key={i} className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono font-semibold">
                      {k}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShortcutsOpen(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Onboarding tour for first-time users */}
      <OnboardingTour />

      {/* Course recommendation dialog */}
      <CourseRecommendationDialog
        open={recommendationsOpen}
        onOpenChange={setRecommendationsOpen}
        currentIpk={transcriptStats.ipk}
        totalSks={transcriptStats.totalSks}
        plannedCourseNames={planned.map((p) => p.courseName)}
        targetIpk={useTarget ? targetSlider / 100 : undefined}
        onAddCourse={(c) => {
          setPlanned([
            ...planned,
            {
              id: `rec-${Date.now()}`,
              courseName: c.name,
              sks: String(c.sks),
              userDifficultyOverride: c.difficulty,
            },
          ]);
        }}
      />

      {/* Study plan dialog */}
      <StudyPlanDialog
        open={studyPlanOpen}
        onOpenChange={setStudyPlanOpen}
        courses={plannedNormalized.map((p) => ({
          name: p.normalizedName,
          sks: p.sks,
          difficulty: p.difficultyScore,
        }))}
      />

      {/* Graduation simulator dialog */}
      <GraduationSimulator
        open={graduationOpen}
        onOpenChange={setGraduationOpen}
        currentIpk={transcriptStats.ipk}
        totalSks={transcriptStats.totalSks}
        targetIpk={useTarget ? targetSlider / 100 : undefined}
      />
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono font-semibold tabular-nums">{value}</div>
    </div>
  );
}
