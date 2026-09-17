"use client";

import { useState } from "react";
import {
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Trophy,
  Target,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Zap,
  Share2,
  Pin,
  Grid3x3,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { GradeBadge, DifficultyBadge, IpkBadge } from "./badges";
import { IpkTrendChart, ScenarioComparisonChart } from "./charts";
import { GradeDistributionChart } from "./grade-distribution-chart";
import { DifficultyHeatmap } from "./difficulty-heatmap";
import { DifficultyRadarChart } from "./difficulty-radar-chart";
import { ScenarioDetailView } from "./scenario-detail-view";
import { AiStrategyCallout } from "./ai-strategy-callout";
import { CumlaudeTracker } from "./cumlaude-tracker";
import { GradeHistoryChart } from "./grade-history-chart";
import { SemesterComparison } from "./semester-comparison";
import { Confetti } from "./confetti";
import { ExportMenu } from "./export-menu";
import { FadeIn, StaggerItem } from "./motion";
import { useComparisonStore } from "@/hooks/use-comparison-store";
import type { OptimizationResult, ScenarioResult, GradeCombination } from "@/lib/gpa/types";

const SCENARIO_ICON: Record<string, React.ElementType> = {
  santai: Layers,
  serius: Target,
  keras: Zap,
  maksimal: Trophy,
};

interface ResultsViewProps {
  result: OptimizationResult;
  transcript: { courseName: string; sks: number; grade: string; semester: number }[];
  planned: { courseName: string; sks: number; userDifficultyOverride?: number }[];
}

export function ResultsView({ result, transcript, planned }: ResultsViewProps) {
  const { summary } = result;
  // Build courses with ids for the heatmap
  const heatmapCourses = planned.map((p, i) => ({
    id: `hm-${i}`,
    courseName: p.courseName,
    sks: p.sks,
    userDifficultyOverride: p.userDifficultyOverride,
  }));
  const [detailScenario, setDetailScenario] = useState<ScenarioResult | null>(null);

  // Confetti triggers when target is achieved. We use the summary's
  // achievable flag + targetIpk presence as the trigger; the Confetti
  // component self-cleans after its duration.
  const showConfetti = Boolean(summary.achievable && summary.targetIpk !== undefined);

  return (
    <div className="space-y-4">
      <Confetti trigger={showConfetti} duration={3000} pieceCount={80} />

      {/* Results header with export */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Share2 className="size-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">Hasil Optimasi</h2>
          <Badge variant="outline" className="text-[10px]">
            {result.scenarios.reduce((s, sc) => s + sc.combinations.length, 0)} kombinasi
          </Badge>
        </div>
        <ExportMenu result={result} transcript={transcript} planned={planned} />
      </div>

      {/* Summary banner */}
      <FadeIn delay={0.05}>
      <Card className={cn(
        "border-2 overflow-hidden relative",
        summary.achievable
          ? "border-emerald-500/40 bg-gradient-to-br from-emerald-500/8 via-transparent to-transparent"
          : "border-amber-500/40 bg-gradient-to-br from-amber-500/8 via-transparent to-transparent"
      )}>
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 opacity-60" />
        <CardContent className="pt-5 pb-5 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {summary.achievable ? (
                  <CheckCircle2 className="size-5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="size-5 text-amber-600" />
                )}
                <h3 className="text-base font-semibold">
                  {summary.achievable ? "Target Tercapai" : "Target Belum Tercapai"}
                </h3>
              </div>
              <p className="text-sm text-muted-foreground max-w-2xl">{summary.message}</p>
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Skenario Terbaik</div>
              <div className="text-lg font-semibold capitalize">{summary.bestScenario}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Metric
              label="IPK Saat Ini"
              value={summary.currentIpk.toFixed(3)}
              icon={TrendingUp}
            />
            <Metric
              label="IPK Proyeksi"
              value={summary.bestOverallNewIpk.toFixed(3)}
              accent={summary.bestOverallDelta > 0 ? "good" : "neutral"}
              delta={summary.bestOverallDelta}
              icon={summary.bestOverallDelta > 0 ? TrendingUp : TrendingDown}
            />
            {summary.targetIpk !== undefined && (
              <Metric
                label="Target IPK"
                value={summary.targetIpk.toFixed(2)}
                accent={summary.achievable ? "good" : "warn"}
                icon={Target}
              />
            )}
            <Metric
              label="SKS Target"
              value={`${summary.plannedSks}`}
              icon={Layers}
            />
          </div>
        </CardContent>
      </Card>
      </FadeIn>

      {/* AI strategy callout */}
      <AiStrategyCallout result={result} />

      {/* Cumlaude progress tracker */}
      <CumlaudeTracker
        currentIpk={summary.currentIpk}
        projectedIpk={summary.bestOverallNewIpk}
        totalSks={summary.totalSks}
        plannedSks={summary.plannedSks}
      />

      {/* Charts */}
      {result.trend && result.trend.semesters.length > 0 && (
        <FadeIn delay={0.15}>
        <div className="grid lg:grid-cols-2 gap-4">
          <IpkTrendChart result={result} />
          <ScenarioComparisonChart result={result} />
        </div>
        </FadeIn>
      )}

      {/* Grade distribution per planned course */}
      {result.distributions && result.distributions.length > 0 && (
        <FadeIn delay={0.2}>
          <GradeDistributionChart result={result} />
        </FadeIn>
      )}

      {/* Difficulty heatmap + radar chart side-by-side */}
      {heatmapCourses.length > 0 && (
        <FadeIn delay={0.22}>
          <div className="grid lg:grid-cols-2 gap-4">
            <DifficultyHeatmap
              currentIpk={summary.currentIpk}
              totalSks={summary.totalSks}
              courses={heatmapCourses}
              bestNewIpk={summary.bestOverallNewIpk}
            />
            <DifficultyRadarChart courses={heatmapCourses} />
          </div>
        </FadeIn>
      )}

      {/* Grade history + semester comparison side-by-side */}
      {transcript.length > 0 && (
        <FadeIn delay={0.25}>
          <div className="grid lg:grid-cols-2 gap-4">
            <GradeHistoryChart transcript={transcript} />
            <SemesterComparison transcript={transcript} />
          </div>
        </FadeIn>
      )}

      {/* Scenario groups */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            4 Kelompok Skenario Usaha
          </h3>
          <span className="text-xs text-muted-foreground">{result.scenarios.reduce((s, sc) => s + sc.combinations.length, 0)} kombinasi</span>
        </div>
        <Accordion type="single" defaultValue={summary.bestScenario} collapsible className="space-y-3">
          {result.scenarios.map((sc) => (
            <ScenarioAccordion key={sc.scenario} scenario={sc} isBest={sc.scenario === summary.bestScenario} targetIpk={summary.targetIpk} onShowDetail={() => setDetailScenario(sc)} />
          ))}
        </Accordion>
      </div>

      {/* Scenario detail dialog */}
      <ScenarioDetailView
        result={result}
        scenario={detailScenario}
        open={detailScenario !== null}
        onOpenChange={(v) => { if (!v) setDetailScenario(null); }}
      />

      {/* Classified courses */}
      {result.classifiedCourses.length > 0 && (
        <FadeIn delay={0.25}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Klasifikasi Kesulitan Mata Kuliah</CardTitle>
            <CardDescription className="text-xs">
              Hasil Model 1 (K-Means clustering) berdasarkan distribusi nilai.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-2">
              {result.classifiedCourses.map((c, i) => (
                <StaggerItem key={i} index={i}>
                <div className="flex items-center justify-between rounded-lg border px-3 py-2 hover:bg-muted/30 transition-colors">
                  <div className="min-w-0">
                    <div className="font-medium truncate text-sm">{c.courseName}</div>
                    <div className="text-[11px] text-muted-foreground">{c.features.major} · n={c.features.sampleCount}</div>
                  </div>
                  <DifficultyBadge score={c.difficultyScore} label={c.difficultyLabel} />
                </div>
                </StaggerItem>
              ))}
            </div>
          </CardContent>
        </Card>
        </FadeIn>
      )}
    </div>
  );
}

function Metric({ label, value, accent, delta, icon: Icon }: { label: string; value: string; accent?: "good" | "warn" | "neutral"; delta?: number; icon: React.ElementType }) {
  const cls = accent === "good" ? "text-emerald-700 dark:text-emerald-300"
    : accent === "warn" ? "text-amber-700 dark:text-amber-300"
    : "text-foreground";
  return (
    <div className="rounded-lg border bg-card/50 px-3 py-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
        <Icon className={cn("size-3.5", cls)} />
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className={cn("font-mono text-lg font-semibold tabular-nums", cls)}>{value}</span>
        {delta !== undefined && delta !== 0 && (
          <span className={cn("text-[11px] font-mono", delta > 0 ? "text-emerald-600" : "text-rose-600")}>
            {delta > 0 ? "+" : ""}{delta.toFixed(3)}
          </span>
        )}
      </div>
    </div>
  );
}

function ScenarioAccordion({ scenario, isBest, targetIpk, onShowDetail }: { scenario: ScenarioResult; isBest: boolean; targetIpk?: number; onShowDetail?: () => void }) {
  const Icon = SCENARIO_ICON[scenario.scenario] ?? Layers;
  const accent = scenario.color;
  const accentClasses: Record<string, string> = {
    emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300",
    sky: "border-sky-500/30 bg-sky-500/5 text-sky-700 dark:text-sky-300",
    amber: "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300",
    rose: "border-rose-500/30 bg-rose-500/5 text-rose-700 dark:text-rose-300",
  };
  return (
    <AccordionItem
      value={scenario.scenario}
      className={cn(
        "rounded-lg border bg-card overflow-hidden",
        isBest && "ring-2 ring-offset-1 ring-offset-background",
        accentClasses[accent]
      )}
    >
      <AccordionTrigger className="px-4 py-3 hover:no-underline [&[data-state=open]]:bg-muted/30">
        <div className="flex items-center gap-3 flex-1 pr-2">
          <div className={cn("rounded-lg p-2", accentClasses[accent])}>
            <Icon className="size-4" />
          </div>
          <div className="text-left flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold capitalize">{scenario.label}</span>
              {isBest && (
                <Badge variant="secondary" className="text-[10px] py-0 h-4 gap-1">
                  <Trophy className="size-2.5" /> Terbaik
                </Badge>
              )}
              <span className="text-[11px] text-muted-foreground">
                · effort ×{scenario.effortMultiplier.toFixed(2)}
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{scenario.description}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground">IPK proyeksi</div>
            <div className="font-mono font-semibold tabular-nums text-sm">
              {scenario.bestNewIpk.toFixed(3)}
            </div>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4 space-y-3">
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <span className="text-muted-foreground">Δ IPK terbaik:</span>
          <span className={cn("font-mono font-semibold", scenario.bestIpkDelta > 0 ? "text-emerald-600" : "text-rose-600")}>
            {scenario.bestIpkDelta > 0 ? "+" : ""}{scenario.bestIpkDelta.toFixed(3)}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">kombinasi:</span>
          <span className="font-mono">{scenario.combinations.length}</span>
          {targetIpk !== undefined && (
            <>
              <span className="text-muted-foreground">·</span>
              {scenario.achievableTarget ? (
                <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="size-2.5 mr-1" /> capai target
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="size-2.5 mr-1" /> di bawah target
                </Badge>
              )}
            </>
          )}
          {onShowDetail && (
            <button
              onClick={onShowDetail}
              className="ml-auto flex items-center gap-1 rounded-md border border-violet-500/30 bg-violet-500/5 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-300 hover:bg-violet-500/10 transition-colors"
            >
              <Grid3x3 className="size-3" />
              Detail & Matriks
            </button>
          )}
        </div>

        {scenario.combinations.length === 0 ? (
          <div className="rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">
            Tidak ada kombinasi yang menghasilkan kenaikan IPK realistis di skenario ini.
          </div>
        ) : (
          <div className="space-y-2">
            {scenario.combinations.map((combo, i) => (
              <CombinationRow key={combo.id} combo={combo} rank={i + 1} targetIpk={targetIpk} scenario={scenario.scenario} scenarioLabel={scenario.label} />
            ))}
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

function CombinationRow({ combo, rank, targetIpk, scenario, scenarioLabel }: { combo: GradeCombination; rank: number; targetIpk?: number; scenario: string; scenarioLabel: string }) {
  const [open, setOpen] = useState(rank <= 1);
  const difficultyPct = Math.round(combo.cumulativeDifficulty * 100);
  const meetsTarget = targetIpk !== undefined && combo.newIpk >= targetIpk;
  const isTop = rank === 1;
  const { pin, pinned } = useComparisonStore();
  const pinKey = `${scenario}-${combo.id}`;
  const isPinned = pinned.some((p) => p.id === pinKey);

  function handlePin(e: React.MouseEvent) {
    e.stopPropagation();
    if (isPinned) return;
    pin(scenario as any, scenarioLabel, combo);
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn(
        "rounded-md border transition-colors",
        isTop
          ? "border-emerald-500/30 bg-emerald-500/5"
          : rank % 2 === 0
          ? "border-border/60 bg-muted/20"
          : "border-border/60 bg-background",
        isPinned && "ring-1 ring-violet-500/40"
      )}
    >
      <div className="flex items-stretch hover:bg-muted/50 transition-colors">
        <CollapsibleTrigger className="flex-1 px-3 py-2.5 flex items-center gap-3 text-left transition-colors min-w-0">
          <span className={cn(
            "text-xs font-mono w-6 tabular-nums shrink-0",
            isTop ? "text-emerald-700 dark:text-emerald-300 font-bold" : "text-muted-foreground"
          )}>
            {isTop ? "★" : `#${rank}`}
          </span>
          <div className="flex items-center gap-1.5 flex-1 min-w-0 flex-wrap">
            {combo.grades.map((g, i) => (
              <div key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-muted-foreground text-[10px]">·</span>}
                <div className="flex flex-col items-center gap-0.5">
                  <GradeBadge grade={g.grade} size="sm" />
                  <span className="text-[9px] text-muted-foreground max-w-[70px] truncate leading-none">{g.normalizedName}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right">
              <IpkBadge ipk={combo.newIpk} delta={combo.ipkDelta} />
            </div>
            <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
          </div>
        </CollapsibleTrigger>
        <div className="flex items-center pr-2.5 border-l border-border/40">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handlePin}
                  disabled={isPinned}
                  className={cn(
                    "rounded p-1.5 transition-colors",
                    isPinned
                      ? "text-violet-600 bg-violet-500/10"
                      : "text-muted-foreground hover:bg-violet-500/10 hover:text-violet-600"
                  )}
                  aria-label={isPinned ? "Sudah dipin" : "Pin untuk perbandingan"}
                >
                  <Pin className={cn("size-3.5", isPinned && "fill-current")} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {isPinned ? "Sudah dipin" : "Pin untuk perbandingan"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      <CollapsibleContent className="border-t border-border/40 px-3 py-3 space-y-3">
        {/* Detail breakdown */}
        <div className="space-y-1.5">
          {combo.grades.map((g, i) => (
            <div key={i} className="flex items-center gap-3 text-xs">
              <GradeBadge grade={g.grade} size="sm" />
              <span className="flex-1 truncate">{g.normalizedName}</span>
              <span className="text-muted-foreground tabular-nums">{g.sks} SKS</span>
              <span className="text-muted-foreground tabular-nums">{g.gradePoint.toFixed(1)}</span>
              <span className="w-20 text-right font-mono tabular-nums">{(g.sks * g.gradePoint).toFixed(1)}</span>
            </div>
          ))}
          <div className="flex items-center gap-3 text-xs pt-1.5 border-t font-medium">
            <span className="w-7"></span>
            <span className="flex-1">IPS Semester</span>
            <span className="tabular-nums">{combo.grades.reduce((s, g) => s + g.sks, 0)} SKS</span>
            <span className="tabular-nums">—</span>
            <span className="w-20 text-right font-mono tabular-nums">{combo.ips.toFixed(3)}</span>
          </div>
        </div>

        {/* Difficulty + probability */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Kesulitan Kumulatif</div>
            <div className="flex items-center gap-2">
              <Progress value={difficultyPct} className="h-2 flex-1" />
              <span className="text-xs font-mono tabular-nums w-10 text-right">{difficultyPct}%</span>
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Probabilitas</div>
            <div className="flex items-center gap-2">
              <Progress value={Math.round(combo.expectedProbability * 100)} className="h-2 flex-1" />
              <span className="text-xs font-mono tabular-nums w-10 text-right">{(combo.expectedProbability * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {meetsTarget && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="size-3.5" />
            Mencapai target IPK {targetIpk?.toFixed(2)}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
