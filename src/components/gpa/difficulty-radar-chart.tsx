"use client";

import {
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
  Tooltip,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { RadarIcon } from "lucide-react";
import { normalizeCourseName } from "@/lib/gpa/course-normalizer";

interface DifficultyRadarChartProps {
  courses: { id: string; courseName: string; sks: number; userDifficultyOverride?: number }[];
}

export function DifficultyRadarChart({ courses }: DifficultyRadarChartProps) {
  if (courses.length === 0) return null;

  const data = courses.map((c) => {
    const norm = normalizeCourseName(c.courseName);
    const difficulty = c.userDifficultyOverride ?? norm.typicalDifficulty ?? 0.5;
    const expectedGp = Math.max(0, Math.min(4, 4 - difficulty * 1.6));
    const shortName = c.courseName.length > 16 ? c.courseName.slice(0, 14) + "…" : c.courseName;
    return {
      course: shortName,
      fullName: c.courseName,
      Kesulitan: Math.round(difficulty * 100),
      "Nilai Ekspektasi": Math.round((expectedGp / 4) * 100),
      SKS: Math.round((c.sks / 8) * 100),
    };
  });

  return (
    <Card className="border-border/60 overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <RadarIcon className="size-4 text-teal-600" />
              Radar Kesulitan Mata Kuliah
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Perbandingan kesulitan, nilai ekspektasi, dan bobot SKS per mata kuliah target.
            </CardDescription>
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-rose-500" /> Kesulitan
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-emerald-500" /> Ekspektasi
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-amber-500" /> SKS
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data} margin={{ top: 8, right: 30, left: 30, bottom: 8 }}>
              <PolarGrid stroke="oklch(0.85 0 0)" strokeWidth={1} />
              <PolarAngleAxis
                dataKey="course"
                tick={{ fontSize: 10, fill: "oklch(0.45 0 0)", fontWeight: 500 }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={{ fontSize: 9, fill: "oklch(0.55 0 0)" }}
                axisLine={{ stroke: "oklch(0.75 0 0)", strokeWidth: 1 }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid oklch(0.8 0 0)",
                  fontSize: 11,
                  background: "oklch(0.99 0 0)",
                  boxShadow: "0 4px 12px oklch(0 0 0 / 0.1)",
                }}
                formatter={(v: number, name: string) => [`${v}%`, name]}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""}
              />
              <Radar
                name="Kesulitan"
                dataKey="Kesulitan"
                stroke="oklch(0.65 0.2 25)"
                fill="oklch(0.65 0.2 25)"
                fillOpacity={0.15}
                strokeWidth={2}
              />
              <Radar
                name="Nilai Ekspektasi"
                dataKey="Nilai Ekspektasi"
                stroke="oklch(0.65 0.18 160)"
                fill="oklch(0.65 0.18 160)"
                fillOpacity={0.1}
                strokeWidth={2}
              />
              <Radar
                name="SKS"
                dataKey="SKS"
                stroke="oklch(0.75 0.15 75)"
                fill="oklch(0.75 0.15 75)"
                fillOpacity={0.08}
                strokeWidth={2}
                strokeDasharray="4 2"
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 text-center">
          Semakin besar area merah → semakin sulit. Semakin besar area hijau → ekspektasi nilai lebih tinggi.
        </p>
      </CardContent>
    </Card>
  );
}
