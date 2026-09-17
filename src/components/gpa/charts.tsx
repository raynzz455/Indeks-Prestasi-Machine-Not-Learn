"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TrendingUp, Target } from "lucide-react";
import type { OptimizationResult } from "@/lib/gpa/types";

interface IpkTrendChartProps {
  result: OptimizationResult;
}

export function IpkTrendChart({ result }: IpkTrendChartProps) {
  const data = result.trend.semesters.map((s) => ({
    name: `Sem ${s.semester}${s.isProjected ? " *" : ""}`,
    IPS: s.ips,
    IPK: s.ipkCumulative,
    projected: s.isProjected,
  }));

  const hasProjected = data.some((d) => d.projected);
  const targetIpk = result.summary.targetIpk;

  return (
    <Card className="border-border/60 overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-4 text-emerald-600" />
              Tren IPK per Semester
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Garis biru = IPK kumulatif · garis hijau = IPS semester · {hasProjected ? "★ proyeksi skenario terbaik" : ""}
            </CardDescription>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-emerald-500" /> IPS
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-sky-500" /> IPK
            </span>
            {targetIpk !== undefined && (
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-amber-500" /> Target
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="ipkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.6 0.18 230)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="oklch(0.6 0.18 230)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="ipsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.7 0.18 160)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="oklch(0.7 0.18 160)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="oklch(0.85 0 0)" vertical={false} strokeWidth={1} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "oklch(0.45 0 0)", fontWeight: 500 }}
                axisLine={{ stroke: "oklch(0.75 0 0)", strokeWidth: 1.5 }}
                tickLine={{ stroke: "oklch(0.75 0 0)", strokeWidth: 1 }}
              />
              <YAxis
                domain={[0, 4]}
                ticks={[0, 1, 2, 3, 4]}
                tick={{ fontSize: 11, fill: "oklch(0.45 0 0)", fontWeight: 500 }}
                axisLine={{ stroke: "oklch(0.75 0 0)", strokeWidth: 1.5 }}
                tickLine={{ stroke: "oklch(0.75 0 0)", strokeWidth: 1 }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid oklch(0.8 0 0)",
                  fontSize: 12,
                  background: "oklch(0.99 0 0)",
                  boxShadow: "0 4px 12px oklch(0 0 0 / 0.1)",
                }}
                formatter={(v: number) => v.toFixed(3)}
              />
              {targetIpk !== undefined && (
                <ReferenceLine
                  y={targetIpk}
                  stroke="oklch(0.75 0.18 75)"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{ value: `Target ${targetIpk.toFixed(2)}`, fontSize: 10, fill: "oklch(0.55 0.15 75)", position: "insideTopRight" }}
                />
              )}
              <ReferenceLine y={3.5} stroke="oklch(0.7 0.15 160)" strokeDasharray="2 2" strokeWidth={1} label={{ value: "Cumlaude", fontSize: 9, fill: "oklch(0.5 0.12 160)", position: "insideTopLeft" }} />
              <Area
                type="monotone"
                dataKey="IPK"
                stroke="oklch(0.55 0.18 230)"
                strokeWidth={2.5}
                fill="url(#ipkGrad)"
                dot={{ r: 4, fill: "oklch(0.99 0 0)", stroke: "oklch(0.55 0.18 230)", strokeWidth: 2 }}
                activeDot={{ r: 6, fill: "oklch(0.55 0.18 230)", stroke: "oklch(0.99 0 0)", strokeWidth: 2 }}
              />
              <Area
                type="monotone"
                dataKey="IPS"
                stroke="oklch(0.65 0.18 160)"
                strokeWidth={2}
                fill="url(#ipsGrad)"
                dot={{ r: 3, fill: "oklch(0.99 0 0)", stroke: "oklch(0.65 0.18 160)", strokeWidth: 1.5 }}
                activeDot={{ r: 5, fill: "oklch(0.65 0.18 160)", stroke: "oklch(0.99 0 0)", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {hasProjected && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Target className="size-3 text-amber-600" />
            <span>
              Sem{" "}
              {(result.trend.semesters.find((s) => s.isProjected)?.semester) ?? "?"}{" "}
              adalah proyeksi skenario <span className="font-semibold capitalize">{result.summary.bestScenario}</span>{" "}
              (IPK {result.summary.bestOverallNewIpk.toFixed(3)}, Δ +{result.summary.bestOverallDelta.toFixed(3)})
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Compact bar chart comparing the 4 scenarios' best projected IPK. */
export function ScenarioComparisonChart({ result }: IpkTrendChartProps) {
  const data = result.scenarios.map((sc) => ({
    name: sc.label,
    "IPK Proyeksi": sc.bestNewIpk,
    "IPK Saat Ini": result.summary.currentIpk,
    delta: sc.bestIpkDelta,
    fill:
      sc.scenario === "santai" ? "oklch(0.72 0.17 160)"
      : sc.scenario === "serius" ? "oklch(0.65 0.16 230)"
      : sc.scenario === "keras" ? "oklch(0.75 0.16 75)"
      : "oklch(0.65 0.2 20)",
  }));

  return (
    <Card className="border-border/60 overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-4 text-sky-600" />
              Perbandingan 4 Skenario
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              IPK proyeksi tertinggi per skenario usaha.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }} layout="vertical">
              <CartesianGrid strokeDasharray="4 4" stroke="oklch(0.85 0 0)" horizontal={false} strokeWidth={1} />
              <XAxis
                type="number"
                domain={[0, 4]}
                ticks={[0, 1, 2, 3, 4]}
                tick={{ fontSize: 11, fill: "oklch(0.45 0 0)", fontWeight: 500 }}
                axisLine={{ stroke: "oklch(0.75 0 0)", strokeWidth: 1.5 }}
                tickLine={{ stroke: "oklch(0.75 0 0)", strokeWidth: 1 }}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 12, fill: "oklch(0.3 0 0)", fontWeight: 600 }}
                axisLine={{ stroke: "oklch(0.75 0 0)", strokeWidth: 1.5 }}
                tickLine={{ stroke: "oklch(0.75 0 0)", strokeWidth: 1 }}
                width={70}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid oklch(0.8 0 0)",
                  fontSize: 12,
                  background: "oklch(0.99 0 0)",
                  boxShadow: "0 4px 12px oklch(0 0 0 / 0.1)",
                }}
                formatter={(v: number, name: string) => [v.toFixed(3), name]}
              />
              {result.summary.targetIpk !== undefined && (
                <ReferenceLine
                  x={result.summary.targetIpk}
                  stroke="oklch(0.75 0.18 75)"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{ value: `Target`, fontSize: 10, fill: "oklch(0.55 0.15 75)", position: "top" }}
                />
              )}
              <Line
                dataKey="IPK Proyeksi"
                stroke="oklch(0.55 0.18 230)"
                strokeWidth={3}
                dot={{ r: 6, fill: "oklch(0.99 0 0)", stroke: "oklch(0.55 0.18 230)", strokeWidth: 2.5 }}
                activeDot={{ r: 8, fill: "oklch(0.55 0.18 230)", stroke: "oklch(0.99 0 0)", strokeWidth: 2 }}
                label={{ position: "right", formatter: (v: number) => v.toFixed(2), fontSize: 11, fontWeight: 600, fill: "oklch(0.35 0 0)" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
