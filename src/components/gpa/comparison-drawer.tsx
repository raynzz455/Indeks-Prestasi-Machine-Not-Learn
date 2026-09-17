"use client";

import { X, Pin, Trash2, GitCompare, TrendingUp, Gauge, Layers } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useComparisonStore } from "@/hooks/use-comparison-store";
import { GradeBadge, IpkBadge } from "./badges";
import { cn } from "@/lib/utils";

const SCENARIO_ACCENT: Record<string, { border: string; bg: string; text: string; dot: string }> = {
  santai: { border: "border-emerald-500/40", bg: "bg-emerald-500/5", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  serius: { border: "border-sky-500/40", bg: "bg-sky-500/5", text: "text-sky-700 dark:text-sky-300", dot: "bg-sky-500" },
  keras: { border: "border-amber-500/40", bg: "bg-amber-500/5", text: "text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  maksimal: { border: "border-rose-500/40", bg: "bg-rose-500/5", text: "text-rose-700 dark:text-rose-300", dot: "bg-rose-500" },
};

export function ComparisonDrawer() {
  const { pinned, isDrawerOpen, closeDrawer, unpin, clear } = useComparisonStore();

  // Find the best IPK among pinned for highlighting
  const bestIpk = pinned.length > 0
    ? Math.max(...pinned.map((p) => p.combination.newIpk))
    : 0;
  const easiestDifficulty = pinned.length > 0
    ? Math.min(...pinned.map((p) => p.combination.cumulativeDifficulty))
    : 0;

  return (
    <Sheet open={isDrawerOpen} onOpenChange={(v) => { if (!v) closeDrawer(); }}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col gap-0 p-0">
        <SheetHeader className="px-5 pt-5 pb-3 border-b">
          <div className="flex items-center justify-between gap-2">
            <div>
              <SheetTitle className="flex items-center gap-2 text-base">
                <GitCompare className="size-4 text-violet-600" />
                Perbandingan Kombinasi
              </SheetTitle>
              <SheetDescription className="text-xs mt-1">
                Bandingkan {pinned.length} kombinasi nilai yang dipin secara side-by-side.
              </SheetDescription>
            </div>
            {pinned.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clear} className="gap-1.5 text-muted-foreground hover:text-rose-600">
                <Trash2 className="size-3.5" />
                Bersihkan
              </Button>
            )}
          </div>
        </SheetHeader>

        {pinned.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-10 text-center">
            <div className="grid size-14 place-items-center rounded-full bg-muted">
              <Pin className="size-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Belum ada kombinasi dipin</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Klik ikon pin (📌) di samping kombinasi nilai mana pun untuk menambahkannya ke perbandingan.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 scrollbar-thin">
            {/* Quick comparison summary */}
            <div className="grid grid-cols-3 gap-2">
              <SummaryCard
                icon={TrendingUp}
                label="IPK Tertinggi"
                value={bestIpk.toFixed(3)}
                accent="good"
              />
              <SummaryCard
                icon={Gauge}
                label="Termudah"
                value={`${(easiestDifficulty * 100).toFixed(0)}%`}
                accent="neutral"
              />
              <SummaryCard
                icon={Layers}
                label="Dipin"
                value={String(pinned.length)}
                accent="neutral"
              />
            </div>

            {/* Pinned combination cards */}
            {pinned.map((p) => {
              const accent = SCENARIO_ACCENT[p.scenario] ?? SCENARIO_ACCENT.serius;
              const isBestIpk = p.combination.newIpk === bestIpk;
              const isEasiest = p.combination.cumulativeDifficulty === easiestDifficulty;
              return (
                <div
                  key={p.id}
                  className={cn("rounded-lg border-2 p-3 space-y-2.5", accent.border, accent.bg)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={cn("size-2 rounded-full", accent.dot)} />
                      <span className={cn("text-xs font-semibold capitalize", accent.text)}>
                        {p.scenarioLabel}
                      </span>
                      {isBestIpk && (
                        <Badge variant="outline" className="text-[9px] py-0 h-4 border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
                          IPK tertinggi
                        </Badge>
                      )}
                      {isEasiest && (
                        <Badge variant="outline" className="text-[9px] py-0 h-4 border-teal-500/40 text-teal-700 dark:text-teal-300">
                          termudah
                        </Badge>
                      )}
                    </div>
                    <button
                      onClick={() => unpin(p.id)}
                      className="rounded p-1 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600"
                      aria-label="Hapus dari perbandingan"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>

                  {/* Grades row */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {p.combination.grades.map((g, i) => (
                      <div key={i} className="flex flex-col items-center gap-0.5">
                        <GradeBadge grade={g.grade} size="sm" />
                        <span className="text-[9px] text-muted-foreground max-w-[70px] truncate leading-none">
                          {g.normalizedName}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <Metric label="IPK" value={
                      <span className="font-mono font-semibold tabular-nums">
                        {p.combination.newIpk.toFixed(3)}
                      </span>
                    } delta={p.combination.ipkDelta} />
                    <Metric label="IPS" value={
                      <span className="font-mono tabular-nums">{p.combination.ips.toFixed(3)}</span>
                    } />
                    <Metric label="Kesulitan" value={
                      <span className="font-mono tabular-nums">{(p.combination.cumulativeDifficulty * 100).toFixed(0)}%</span>
                    } />
                  </div>

                  {/* Difficulty bar */}
                  <div className="flex items-center gap-2">
                    <Progress value={p.combination.cumulativeDifficulty * 100} className="h-1.5 flex-1" />
                    <Progress value={p.combination.expectedProbability * 100} className="h-1.5 flex-1" />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Kesulitan kumulatif</span>
                    <span>Probabilitas {(p.combination.expectedProbability * 100).toFixed(1)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {pinned.length > 0 && (
          <SheetFooter className="px-5 py-3 border-t">
            <p className="text-[11px] text-muted-foreground">
              Maksimal 4 kombinasi dapat dipin secara bersamaan.
            </p>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

function SummaryCard({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: string; accent: "good" | "neutral" }) {
  const cls = accent === "good" ? "text-emerald-700 dark:text-emerald-300" : "text-foreground";
  return (
    <div className="rounded-lg border bg-card px-2.5 py-2">
      <div className="flex items-center gap-1 mb-0.5">
        <Icon className={cn("size-3", cls)} />
        <span className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</span>
      </div>
      <div className={cn("font-mono text-sm font-semibold tabular-nums", cls)}>{value}</div>
    </div>
  );
}

function Metric({ label, value, delta }: { label: string; value: React.ReactNode; delta?: number }) {
  return (
    <div className="rounded-md bg-background/60 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex items-baseline gap-1 mt-0.5">
        {value}
        {delta !== undefined && delta !== 0 && (
          <span className={cn("text-[9px] font-mono", delta > 0 ? "text-emerald-600" : "text-rose-600")}>
            {delta > 0 ? "+" : ""}{delta.toFixed(3)}
          </span>
        )}
      </div>
    </div>
  );
}
