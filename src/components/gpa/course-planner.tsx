"use client";

import { useState } from "react";
import { Plus, Trash2, Target, Gauge, BookOpen, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { DifficultyBadge } from "./badges";
import { normalizeCourseName } from "@/lib/gpa/course-normalizer";
import type { CanonicalCourse } from "@/lib/gpa/config";
import { cn } from "@/lib/utils";

export interface PlannedRow {
  id: string;
  courseName: string;
  sks: string;
  userDifficultyOverride?: number; // 0..1
}

interface CoursePlannerProps {
  rows: PlannedRow[];
  onChange: (rows: PlannedRow[]) => void;
  onOpenCatalog?: () => void;
  onOpenRecommendations?: () => void;
}

let pCounter = 2000;
function nextId() { return `p-${++pCounter}`; }

const SAMPLE_PLANNED: PlannedRow[] = [
  { id: nextId(), courseName: "Kalkulus III", sks: "3", userDifficultyOverride: 0.85 },
  { id: nextId(), courseName: "Kecerdasan Buatan", sks: "3", userDifficultyOverride: 0.82 },
  { id: nextId(), courseName: "Jaringan Komputer", sks: "3", userDifficultyOverride: 0.68 },
  { id: nextId(), courseName: "Pemrograman Mobile", sks: "3", userDifficultyOverride: 0.55 },
  { id: nextId(), courseName: "Metodologi Penelitian", sks: "2", userDifficultyOverride: 0.4 },
];

export function CoursePlanner({ rows, onChange, onOpenCatalog, onOpenRecommendations }: CoursePlannerProps) {
  const [draft, setDraft] = useState<PlannedRow>({
    id: nextId(),
    courseName: "",
    sks: "3",
    userDifficultyOverride: undefined,
  });
  const [showOverride, setShowOverride] = useState<Record<string, boolean>>({});

  function addRow() {
    if (!draft.courseName.trim()) return;
    onChange([...rows, { ...draft, id: nextId() }]);
    setDraft({ id: nextId(), courseName: "", sks: "3", userDifficultyOverride: undefined });
  }

  function removeRow(id: string) {
    onChange(rows.filter((r) => r.id !== id));
  }

  function updateRow(id: string, field: keyof PlannedRow, value: string | number) {
    onChange(rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function loadSample() {
    onChange(SAMPLE_PLANNED.map((r) => ({ ...r, id: nextId() })));
  }

  const totalSks = rows.reduce((s, r) => s + (Number(r.sks) || 0), 0);

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="size-5 text-amber-600" />
              Mata Kuliah Semester Target
            </CardTitle>
            <CardDescription className="mt-1">
              Daftar mata kuliah yang akan/ sedang diambil. Nama akan dinormalisasi otomatis.
            </CardDescription>
          </div>
          <div className="flex gap-2 flex-wrap">
            {onOpenRecommendations && (
              <Button variant="default" size="sm" onClick={onOpenRecommendations} className="gap-1.5 bg-amber-600 hover:bg-amber-700">
                <Lightbulb className="size-3.5" />
                Rekomendasi
              </Button>
            )}
            {onOpenCatalog && (
              <Button variant="outline" size="sm" onClick={onOpenCatalog} className="gap-1.5">
                <BookOpen className="size-3.5" />
                Katalog
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={loadSample} className="gap-1.5">
              <Plus className="size-3.5" />
              Contoh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Draft */}
        <div className="rounded-lg border border-dashed bg-muted/30 p-3 space-y-3">
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-12 sm:col-span-6">
              <Label className="sr-only">Nama mata kuliah</Label>
              <Input
                placeholder="cth: Pembelajaran Mesin"
                value={draft.courseName}
                onChange={(e) => setDraft({ ...draft, courseName: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") addRow(); }}
              />
              {draft.courseName.trim() && (
                <NormalizePreview name={draft.courseName} />
              )}
            </div>
            <div className="col-span-4 sm:col-span-2">
              <Input
                type="number"
                min={1}
                max={8}
                placeholder="SKS"
                value={draft.sks}
                onChange={(e) => setDraft({ ...draft, sks: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") addRow(); }}
              />
            </div>
            <div className="col-span-8 sm:col-span-4">
              <div className="flex items-center gap-2">
                <Slider
                  value={draft.userDifficultyOverride === undefined ? [50] : [Math.round((draft.userDifficultyOverride ?? 0.5) * 100)]}
                  onValueChange={(v) => setDraft({ ...draft, userDifficultyOverride: v[0] / 100 })}
                  max={100}
                  step={5}
                  className="flex-1"
                />
                <span className="w-10 text-right text-xs font-mono tabular-nums">
                  {draft.userDifficultyOverride === undefined ? "auto" : `${Math.round(draft.userDifficultyOverride * 100)}%`}
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">Tingkat kesulitan (opsional)</div>
            </div>
            <div className="col-span-12 sm:col-span-1">
              <Button onClick={addRow} className="w-full gap-1.5">
                <Plus className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Rows */}
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
            <Gauge className="mx-auto mb-2 size-6 opacity-40" />
            Belum ada mata kuliah target. Tambahkan minimal 1 mata kuliah.
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => {
              const norm = normalizeCourseName(r.courseName);
              const eff = r.userDifficultyOverride ?? norm.typicalDifficulty;
              return (
                <div key={r.id} className="rounded-lg border bg-card px-3 py-2.5 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{r.courseName}</div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span>→</span>
                        <span className={cn("font-medium", norm.matched ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400")}>
                          {norm.normalizedName}
                        </span>
                        <span className="opacity-60">·</span>
                        <span className="rounded bg-muted px-1.5 py-0.5">{norm.category}</span>
                        {!norm.matched && (
                          <span className="text-[10px] text-amber-600">tidak cocok katalog</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">SKS</span>
                      <Input
                        type="number"
                        value={r.sks}
                        onChange={(e) => updateRow(r.id, "sks", e.target.value)}
                        className="h-8 w-14 text-center"
                      />
                      <DifficultyBadge score={eff} label={eff < 0.2 ? "sangat_mudah" : eff < 0.4 ? "mudah" : eff < 0.6 ? "medium" : eff < 0.8 ? "sulit" : "sangat_sulit"} />
                      <button
                        onClick={() => removeRow(r.id)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600"
                        aria-label="Hapus"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                  {showOverride[r.id] && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center gap-3">
                        <Label className="text-xs whitespace-nowrap">Override kesulitan</Label>
                        <Slider
                          value={[Math.round((r.userDifficultyOverride ?? norm.typicalDifficulty) * 100)]}
                          onValueChange={(v) => updateRow(r.id, "userDifficultyOverride", v[0] / 100)}
                          max={100}
                          step={5}
                          className="flex-1"
                        />
                        <span className="w-10 text-right text-xs font-mono tabular-nums">
                          {Math.round((r.userDifficultyOverride ?? norm.typicalDifficulty) * 100)}%
                        </span>
                      </div>
                    </div>
                  )}
                  <button
                    onClick={() => setShowOverride((s) => ({ ...s, [r.id]: !s[r.id] }))}
                    className="mt-1 text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    {showOverride[r.id] ? "Sembunyikan" : "Sesuaikan"} tingkat kesulitan
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between text-sm border-t pt-3">
          <span className="text-muted-foreground">Total SKS semester target</span>
          <span className="font-mono font-semibold tabular-nums">{totalSks} SKS</span>
        </div>
      </CardContent>
    </Card>
  );
}

function NormalizePreview({ name }: { name: string }) {
  const norm = normalizeCourseName(name);
  if (!name.trim()) return null;
  return (
    <div className="text-[11px] mt-1 flex items-center gap-1.5">
      <span className="text-muted-foreground">Normalisasi →</span>
      <span className={cn("font-medium", norm.matched ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400")}>
        {norm.normalizedName}
      </span>
      <span className="text-muted-foreground opacity-60">· {norm.category}</span>
      {norm.matched && (
        <span className="text-[10px] text-emerald-600">({Math.round(norm.confidence * 100)}%)</span>
      )}
    </div>
  );
}
