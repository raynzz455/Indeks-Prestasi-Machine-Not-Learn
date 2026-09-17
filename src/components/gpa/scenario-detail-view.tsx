"use client";

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
import { Grid3x3 } from "lucide-react";
import { GRADE_ORDER } from "@/lib/gpa/config";
import { GradeBadge } from "./badges";
import { cn } from "@/lib/utils";
import type { OptimizationResult, ScenarioResult } from "@/lib/gpa/types";

interface ScenarioDetailViewProps {
  result: OptimizationResult;
  scenario: ScenarioResult | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScenarioDetailView({ result, scenario, open, onOpenChange }: ScenarioDetailViewProps) {
  if (!scenario) return null;

  // Build the probability matrix: courses × grades for the SELECTED scenario.
  // Distributions are now captured for all 4 scenarios, so we filter by the
  // current scenario's name.
  const allDistributions = result.distributions ?? [];
  const distributions = allDistributions.filter((d) => d.scenario === scenario.scenario);
  const matrix = distributions.map((d) => {
    const row: Record<string, number> = { course: d.normalizedName };
    for (const g of GRADE_ORDER) {
      row[g] = Math.round((d.distribution[g] ?? 0) * 100);
    }
    return row;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <div className="flex items-start justify-between gap-2">
            <div>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Grid3x3 className="size-4 text-violet-600" />
                Detail Skenario: {scenario.label}
              </DialogTitle>
              <DialogDescription className="text-xs mt-1">
                {scenario.description}
              </DialogDescription>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] capitalize",
                scenario.scenario === "santai" && "border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
                scenario.scenario === "serius" && "border-sky-500/40 text-sky-700 dark:text-sky-300",
                scenario.scenario === "keras" && "border-amber-500/40 text-amber-700 dark:text-amber-300",
                scenario.scenario === "maksimal" && "border-rose-500/40 text-rose-700 dark:text-rose-300"
              )}
            >
              effort ×{scenario.effortMultiplier.toFixed(2)}
            </Badge>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[65vh]">
          <div className="px-5 py-4 space-y-4 scrollbar-thin">
            {/* Summary metrics */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border bg-card px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">IPK Proyeksi</div>
                <div className="font-mono text-lg font-semibold tabular-nums">{scenario.bestNewIpk.toFixed(3)}</div>
              </div>
              <div className="rounded-lg border bg-card px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Δ IPK</div>
                <div className={cn("font-mono text-lg font-semibold tabular-nums", scenario.bestIpkDelta > 0 ? "text-emerald-600" : "text-rose-600")}>
                  {scenario.bestIpkDelta > 0 ? "+" : ""}{scenario.bestIpkDelta.toFixed(3)}
                </div>
              </div>
              <div className="rounded-lg border bg-card px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Kombinasi</div>
                <div className="font-mono text-lg font-semibold tabular-nums">{scenario.combinations.length}</div>
              </div>
            </div>

            {/* Probability matrix heatmap */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Matriks Probabilitas (Model 2)
              </h4>
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left px-2 py-1.5 border-b-2 border-border sticky left-0 bg-card z-10">Mata Kuliah</th>
                      {GRADE_ORDER.map((g) => (
                        <th key={g} className="px-1.5 py-1.5 text-center border-b-2 border-border min-w-[36px]">
                          <span className="font-mono font-semibold text-[10px]">{g}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {distributions.map((d, i) => {
                      // Find top grade
                      let topGrade = "A";
                      let topProb = 0;
                      for (const g of GRADE_ORDER) {
                        const p = d.distribution[g] ?? 0;
                        if (p > topProb) {
                          topProb = p;
                          topGrade = g;
                        }
                      }
                      return (
                        <tr key={i} className={i % 2 === 0 ? "bg-muted/20" : ""}>
                          <td className="px-2 py-1.5 border-r sticky left-0 bg-inherit z-10">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-medium truncate max-w-[120px]">{d.normalizedName}</span>
                            </div>
                          </td>
                          {GRADE_ORDER.map((g) => {
                            const prob = Math.round((d.distribution[g] ?? 0) * 100);
                            const isTop = g === topGrade;
                            return (
                              <td key={g} className="px-1 py-1 text-center">
                                <div
                                  className={cn(
                                    "rounded text-[9px] font-mono tabular-nums py-1",
                                    isTop && "ring-1 ring-violet-500/40"
                                  )}
                                  style={{
                                    backgroundColor: probToColor(prob),
                                    color: prob > 50 ? "white" : "oklch(0.3 0 0)",
                                  }}
                                  title={`${d.normalizedName} ${g}: ${prob}%`}
                                >
                                  {prob}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Cell color = probability (darker = higher)</span>
                <div className="flex items-center gap-1">
                  <span>0%</span>
                  <div className="h-2 w-20 rounded bg-gradient-to-r from-oklch(0.95 0 0) via-oklch(0.6 0.15 230) to-oklch(0.3 0.2 230)" />
                  <span>100%</span>
                </div>
              </div>
            </div>

            {/* All combinations for this scenario */}
            {scenario.combinations.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Semua Kombinasi ({scenario.combinations.length})
                </h4>
                <div className="space-y-1.5">
                  {scenario.combinations.map((combo, i) => (
                    <div key={combo.id} className={cn(
                      "rounded-md border px-2.5 py-1.5 flex items-center gap-2",
                      i === 0 ? "border-emerald-500/30 bg-emerald-500/5" : "bg-muted/20"
                    )}>
                      <span className="text-[10px] font-mono w-5 text-muted-foreground shrink-0">
                        {i === 0 ? "★" : `#${i + 1}`}
                      </span>
                      <div className="flex items-center gap-1 flex-1 min-w-0 flex-wrap">
                        {combo.grades.map((g, j) => (
                          <div key={j} className="flex items-center gap-0.5">
                            {j > 0 && <span className="text-muted-foreground text-[9px]">·</span>}
                            <GradeBadge grade={g.grade} size="sm" />
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 text-[10px]">
                        <span className="text-muted-foreground">IPK:</span>
                        <span className="font-mono font-semibold tabular-nums">{combo.newIpk.toFixed(3)}</span>
                        <span className={cn("font-mono", combo.ipkDelta > 0 ? "text-emerald-600" : "text-rose-600")}>
                          {combo.ipkDelta > 0 ? "+" : ""}{combo.ipkDelta.toFixed(3)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
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

/** Map probability (0-100) to a background color. */
function probToColor(prob: number): string {
  // 0% = light, 100% = dark
  if (prob === 0) return "oklch(0.97 0 0)";
  // Interpolate from light to violet
  const lightness = 0.97 - (prob / 100) * 0.6; // 0.97 → 0.37
  return `oklch(${lightness} 0.15 230)`;
}
