"use client";

import { useState } from "react";
import { Sparkles, Loader2, Lightbulb, RefreshCw, AlertCircle, Cpu } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FadeIn } from "./motion";
import type { OptimizationResult } from "@/lib/gpa/types";

interface AiStrategyCalloutProps {
  result: OptimizationResult;
}

interface StrategyResponse {
  strategy: string;
  tips: string[];
}

export function AiStrategyCallout({ result }: AiStrategyCalloutProps) {
  const [strategy, setStrategy] = useState<StrategyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchStrategy() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/gpa/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setStrategy(data);
      toast.success("Strategi dibuat", {
        description: data.strategy?.slice(0, 60) + "…",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.error("Gagal membuat strategi", { description: msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <FadeIn delay={0.1}>
      <Card className="border-2 border-violet-500/30 bg-gradient-to-br from-violet-500/5 via-fuchsia-500/5 to-transparent overflow-hidden relative">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 opacity-60" />
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-sm">
                  <Lightbulb className="size-4" />
                </div>
                Strategi Rekomendasi
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Strategi & tips actionable dari model berbasis aturan (rule-based) berdasarkan hasil optimasi.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchStrategy}
              disabled={loading}
              className="gap-1.5 border-violet-500/40 text-violet-700 dark:text-violet-300 hover:bg-violet-500/10"
            >
              {loading ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Membuat...
                </>
              ) : strategy ? (
                <>
                  <RefreshCw className="size-3.5" />
                  Buat ulang
                </>
              ) : (
                <>
                  <Lightbulb className="size-3.5" />
                  Buat strategi
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="space-y-2">
              <div className="h-4 w-full rounded bg-violet-500/10 animate-pulse" />
              <div className="h-4 w-4/5 rounded bg-violet-500/10 animate-pulse" />
              <div className="space-y-1.5 pt-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-3 w-3/4 rounded bg-violet-500/10 animate-pulse" />
                ))}
              </div>
            </div>
          ) : error ? (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-sm text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="size-4 mt-0.5 shrink-0" />
              <div>
                <div className="font-medium">Gagal membuat strategi</div>
                <div className="text-xs opacity-80">{error}</div>
              </div>
            </div>
          ) : strategy ? (
            <>
              <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2.5 text-sm leading-relaxed">
                {strategy.strategy}
              </div>
              {strategy.tips.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                    Tips Actionable
                  </div>
                  {strategy.tips.map((tip, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 rounded-md border bg-card/60 px-2.5 py-1.5 text-xs"
                    >
                      <span className="grid size-4 place-items-center rounded-full bg-violet-500/15 text-violet-700 dark:text-violet-300 text-[9px] font-mono font-bold shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-foreground/90 leading-relaxed">{tip}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground pt-1">
                <Badge variant="outline" className="text-[9px] py-0 h-4">
                  <Cpu className="size-2.5 mr-1" />
                  Rule-based
                </Badge>
                <span>Strategi dihasilkan oleh algoritma deterministik — instan & transparan.</span>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-violet-500/30 bg-violet-500/5 px-4 py-6 text-center">
              <Lightbulb className="mx-auto mb-2 size-6 text-violet-500/60" />
              <p className="text-sm text-muted-foreground">
                Klik <b>"Buat strategi"</b> untuk mendapatkan ringkasan + tips actionable per mata kuliah.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </FadeIn>
  );
}
