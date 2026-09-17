"use client";

import { useState, useEffect } from "react";
import { Lightbulb, Loader2, Plus, Sparkles, TrendingUp, X } from "lucide-react";
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
import { toast } from "sonner";
import { DifficultyBadge } from "./badges";
import { cn } from "@/lib/utils";

interface CourseRecommendation {
  name: string;
  category: string;
  sks: number;
  difficulty: number;
  estimatedDelta: number;
  expectedDelta: number;
  expectedGp: number;
  reason: string;
  impactScore: number;
}

interface CourseRecommendationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentIpk: number;
  totalSks: number;
  plannedCourseNames: string[];
  targetIpk?: number;
  onAddCourse: (course: { name: string; sks: number; difficulty: number }) => void;
}

export function CourseRecommendationDialog({
  open,
  onOpenChange,
  currentIpk,
  totalSks,
  plannedCourseNames,
  targetIpk,
  onAddCourse,
}: CourseRecommendationDialogProps) {
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<CourseRecommendation[]>([]);
  const [added, setAdded] = useState<Set<string>>(new Set());

  async function fetchRecommendations() {
    setLoading(true);
    try {
      const res = await fetch("/api/gpa/recommend-courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentIpk,
          totalSks,
          plannedCourseNames,
          targetIpk,
          maxResults: 8,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setRecommendations(data.recommendations ?? []);
      setAdded(new Set());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Gagal memuat rekomendasi", { description: msg });
    } finally {
      setLoading(false);
    }
  }

  function handleAdd(rec: CourseRecommendation) {
    onAddCourse({ name: rec.name, sks: rec.sks, difficulty: rec.difficulty });
    setAdded((s) => new Set([...s, rec.name]));
    toast.success(`Ditambahkan: ${rec.name}`, {
      description: `${rec.sks} SKS · dampak +${rec.estimatedDelta.toFixed(3)} IPK`,
    });
  }

  function handleOpenChange(v: boolean) {
    if (v && recommendations.length === 0) {
      fetchRecommendations();
    }
    onOpenChange(v);
  }

  // Auto-fetch when dialog opens (covers cases where onOpenChange isn't called)
  useEffect(() => {
    if (open && recommendations.length === 0 && !loading) {
      fetchRecommendations();
    }
  }, [open]);

  const maxImpact = recommendations.length > 0
    ? Math.max(...recommendations.map((r) => r.impactScore))
    : 1;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <div className="flex items-start justify-between gap-2">
            <div>
              <DialogTitle className="flex items-center gap-2 text-base">
                <div className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-sm">
                  <Lightbulb className="size-4" />
                </div>
                Rekomendasi Mata Kuliah
              </DialogTitle>
              <DialogDescription className="text-xs mt-1">
                Mata kuliah elektif yang dapat memaksimalkan kenaikan IPK (dihitung untuk nilai A).
              </DialogDescription>
            </div>
            {recommendations.length > 0 && (
              <Button variant="ghost" size="sm" onClick={fetchRecommendations} disabled={loading} className="gap-1.5 text-muted-foreground">
                <Sparkles className="size-3.5" />
                Refresh
              </Button>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[55vh]">
          <div className="px-5 py-4 space-y-2 scrollbar-thin">
            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="rounded-lg border p-3 space-y-2">
                    <div className="h-4 w-3/4 rounded bg-amber-500/10 animate-pulse" />
                    <div className="h-3 w-1/2 rounded bg-amber-500/10 animate-pulse" />
                    <div className="h-2 w-full rounded bg-amber-500/10 animate-pulse" />
                  </div>
                ))}
              </div>
            ) : recommendations.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                <Lightbulb className="mx-auto mb-2 size-6 opacity-40" />
                Klik "Refresh" untuk memuat rekomendasi.
              </div>
            ) : (
              recommendations.map((rec, i) => {
                const isAdded = added.has(rec.name);
                const impactPct = Math.round((rec.impactScore / maxImpact) * 100);
                return (
                  <div
                    key={rec.name}
                    className={cn(
                      "rounded-lg border p-3 transition-all hover:shadow-sm",
                      isAdded ? "border-emerald-500/40 bg-emerald-500/5" : "bg-card"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-mono text-muted-foreground">#{i + 1}</span>
                          <span className="font-medium text-sm truncate">{rec.name}</span>
                          <Badge variant="outline" className="text-[9px] py-0 h-4">{rec.category}</Badge>
                        </div>
                        <div className="text-[11px] text-muted-foreground">{rec.reason}</div>
                      </div>
                      <DifficultyBadge score={rec.difficulty} label={rec.difficulty < 0.2 ? "sangat_mudah" : rec.difficulty < 0.4 ? "mudah" : rec.difficulty < 0.6 ? "medium" : rec.difficulty < 0.8 ? "sulit" : "sangat_sulit"} />
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
                          <span>Dampak (A / realistis)</span>
                          <span className="flex items-center gap-1.5">
                            <span className="font-mono font-semibold text-emerald-600">
                              +{rec.estimatedDelta.toFixed(3)}
                            </span>
                            <span className="text-muted-foreground">/</span>
                            <span className="font-mono font-semibold text-amber-600">
                              +{rec.expectedDelta.toFixed(3)}
                            </span>
                          </span>
                        </div>
                        <Progress value={impactPct} className="h-1.5" />
                      </div>
                      <Button
                        variant={isAdded ? "secondary" : "default"}
                        size="sm"
                        onClick={() => handleAdd(rec)}
                        disabled={isAdded}
                        className="gap-1 h-7 text-xs shrink-0"
                      >
                        {isAdded ? (
                          <>
                            <CheckCircle2 className="size-3" />
                            Ditambahkan
                          </>
                        ) : (
                          <>
                            <Plus className="size-3" />
                            Tambah
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="px-5 py-3 border-t">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <TrendingUp className="size-3 text-emerald-600" />
              <span>Dampak dihitung untuk skenario nilai A (4.0)</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Tutup</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CheckCircle2({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
