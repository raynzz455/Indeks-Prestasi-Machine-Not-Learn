"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Activity } from "lucide-react";
import { GRADE_ORDER, GRADE_POINTS } from "@/lib/gpa/config";
import { computeIpk, gradeToGp } from "@/lib/gpa/grade-utils";
import { normalizeCourseName } from "@/lib/gpa/course-normalizer";
import { DifficultyBadge } from "./badges";

interface DifficultyHeatmapProps {
  currentIpk: number;
  totalSks: number;
  courses: { id: string; courseName: string; sks: number; userDifficultyOverride?: number }[];
  bestNewIpk: number;
}

/**
 * Visualizes how each planned course's difficulty contributes to the overall
 * IPK projection. For each course, we compute the "IPK impact" — the delta
 * between an A-grade scenario and a baseline (difficulty-weighted) scenario.
 *
 * The heatmap colors each bar by difficulty (green=easy → red=hard) and overlays
 * a line showing the cumulative projected IPK if that course is maximized to A.
 */
export function DifficultyHeatmap({ currentIpk, totalSks, courses, bestNewIpk }: DifficultyHeatmapProps) {
  const data = useMemo(() => {
    return courses.map((c) => {
      const norm = normalizeCourseName(c.courseName);
      const difficulty = c.userDifficultyOverride ?? norm.typicalDifficulty ?? 0.5;
      // Expected grade point given difficulty (lower difficulty → higher expected GP)
      const expectedGp = Math.max(0, Math.min(4, 4 - difficulty * 1.6));
      // IPK if this course gets A vs expected
      const sks = c.sks;
      const ipsA = 4.0;
      const ipsExpected = expectedGp;
      const ipkIfA = computeIpk(currentIpk, totalSks, ipsA, sks) - currentIpk;
      const ipkIfExpected = computeIpk(currentIpk, totalSks, ipsExpected, sks) - currentIpk;
      // Impact = difference (how much an A in this course moves the needle vs expected)
      const impact = ipkIfA - ipkIfExpected;
      return {
        name: norm.normalizedName,
        shortName: norm.normalizedName.length > 16 ? norm.normalizedName.slice(0, 14) + "…" : norm.normalizedName,
        difficulty,
        sks,
        impact: Math.round(impact * 1000) / 1000,
        ipkIfA: Math.round((currentIpk + ipkIfA) * 1000) / 1000,
        ipkIfExpected: Math.round((currentIpk + ipkIfExpected) * 1000) / 1000,
        fill:
          difficulty < 0.2 ? "oklch(0.72 0.17 160)"
          : difficulty < 0.4 ? "oklch(0.7 0.14 180)"
          : difficulty < 0.6 ? "oklch(0.75 0.15 75)"
          : difficulty < 0.8 ? "oklch(0.7 0.16 50)"
          : "oklch(0.65 0.2 25)",
      };
    });
  }, [courses, currentIpk, totalSks]);

  if (courses.length === 0) return null;

  const totalImpact = data.reduce((s, d) => s + d.impact, 0);

  return (
    <Card className="border-border/60 overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="size-4 text-rose-600" />
              Heatmap Dampak Kesulitan
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Dampak tiap mata kuliah terhadap IPK jika dinaikkan dari nilai ekspektasi → A. Warna = tingkat kesulitan.
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Dampak</div>
            <div className="font-mono font-semibold tabular-nums text-sm text-emerald-600">
              +{totalImpact.toFixed(3)}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 40 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="oklch(0.85 0 0)" vertical={false} strokeWidth={1} />
              <XAxis
                dataKey="shortName"
                tick={{ fontSize: 10, fill: "oklch(0.45 0 0)", fontWeight: 500 }}
                axisLine={{ stroke: "oklch(0.75 0 0)", strokeWidth: 1.5 }}
                tickLine={{ stroke: "oklch(0.75 0 0)", strokeWidth: 1 }}
                angle={-35}
                textAnchor="end"
                height={50}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "oklch(0.45 0 0)", fontWeight: 500 }}
                axisLine={{ stroke: "oklch(0.75 0 0)", strokeWidth: 1.5 }}
                tickLine={{ stroke: "oklch(0.75 0 0)", strokeWidth: 1 }}
                tickFormatter={(v) => `+${v.toFixed(2)}`}
              />
              <Tooltip
                cursor={{ fill: "oklch(0.95 0 0)" }}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid oklch(0.8 0 0)",
                  fontSize: 11,
                  background: "oklch(0.99 0 0)",
                  boxShadow: "0 4px 12px oklch(0 0 0 / 0.1)",
                }}
                formatter={(v: number, name: string) => {
                  if (name === "Dampak IPK") return [`+${v.toFixed(3)}`, name];
                  return [v.toFixed(3), name];
                }}
                labelFormatter={(l) => `MK: ${l}`}
              />
              <ReferenceLine y={0} stroke="oklch(0.6 0 0)" strokeWidth={1.5} />
              <Bar dataKey="impact" name="Dampak IPK" radius={[3, 3, 0, 0]} maxBarSize={48}>
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Legend + course detail */}
        <div className="mt-3 grid sm:grid-cols-2 gap-1.5">
          {data.map((d, i) => (
            <div key={i} className="flex items-center gap-2 rounded-md border bg-card/40 px-2 py-1.5 text-xs">
              <span
                className="size-2.5 rounded-full shrink-0"
                style={{ backgroundColor: d.fill }}
              />
              <span className="flex-1 truncate font-medium">{d.name}</span>
              <span className="text-muted-foreground tabular-nums">{d.sks} SKS</span>
              <span className="font-mono tabular-nums text-emerald-600 font-semibold">
                +{d.impact.toFixed(3)}
              </span>
            </div>
          ))}
        </div>

        {/* Difficulty scale legend */}
        <div className="mt-3 flex items-center justify-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="size-2.5 rounded-full bg-emerald-500" /> Sangat Mudah
          </span>
          <span>→</span>
          <span className="flex items-center gap-1">
            <span className="size-2.5 rounded-full bg-amber-500" /> Medium
          </span>
          <span>→</span>
          <span className="flex items-center gap-1">
            <span className="size-2.5 rounded-full bg-rose-600" /> Sangat Sulit
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
