"use client";

import { useState, useMemo } from "react";
import { Plus, Trash2, Upload, FileText, Sparkles, ClipboardPaste } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GRADE_ORDER, MAJORS } from "@/lib/gpa/config";
import { normalizeGrade, computeIps } from "@/lib/gpa/grade-utils";
import { GradeBadge } from "./badges";
import { TranscriptUploadDialog } from "./transcript-upload-dialog";
import { cn } from "@/lib/utils";

export interface TranscriptRow {
  id: string;
  courseName: string;
  sks: string;
  grade: string;
  semester: string;
  major: string;
}

interface TranscriptInputProps {
  rows: TranscriptRow[];
  onChange: (rows: TranscriptRow[]) => void;
}

const SAMPLE_TRANSCRIPT: TranscriptRow[] = [
  { id: "s1", courseName: "Kalkulus I", sks: "3", grade: "B+", semester: "1", major: "Teknik Informatika" },
  { id: "s2", courseName: "Algoritma dan Pemrograman", sks: "4", grade: "A-", semester: "1", major: "Teknik Informatika" },
  { id: "s3", courseName: "Pancasila", sks: "2", grade: "A", semester: "1", major: "Teknik Informatika" },
  { id: "s4", courseName: "Matematika Diskrit", sks: "3", grade: "B", semester: "1", major: "Teknik Informatika" },
  { id: "s5", courseName: "Bahasa Indonesia", sks: "2", grade: "A", semester: "1", major: "Teknik Informatika" },
  { id: "s6", courseName: "Kalkulus II", sks: "3", grade: "B", semester: "2", major: "Teknik Informatika" },
  { id: "s7", courseName: "Struktur Data", sks: "3", grade: "B+", semester: "2", major: "Teknik Informatika" },
  { id: "s8", courseName: "Fisika Dasar I", sks: "3", grade: "B-", semester: "2", major: "Teknik Informatika" },
  { id: "s9", courseName: "Pemrograman Web", sks: "3", grade: "A-", semester: "2", major: "Teknik Informatika" },
  { id: "s10", courseName: "Kewarganegaraan", sks: "2", grade: "A", semester: "2", major: "Teknik Informatika" },
  { id: "s11", courseName: "Basis Data", sks: "3", grade: "A-", semester: "3", major: "Teknik Informatika" },
  { id: "s12", courseName: "Sistem Operasi", sks: "3", grade: "B", semester: "3", major: "Teknik Informatika" },
  { id: "s13", courseName: "Pemrograman Berorientasi Objek", sks: "3", grade: "B+", semester: "3", major: "Teknik Informatika" },
  { id: "s14", courseName: "Aljabar Linear", sks: "3", grade: "B-", semester: "3", major: "Teknik Informatika" },
  { id: "s15", courseName: "Agama", sks: "2", grade: "A", semester: "3", major: "Teknik Informatika" },
];

let idCounter = 1000;
function nextId() { return `r-${++idCounter}`; }

export function TranscriptInput({ rows, onChange }: TranscriptInputProps) {
  const [draft, setDraft] = useState<TranscriptRow>({
    id: nextId(),
    courseName: "",
    sks: "3",
    grade: "A",
    semester: "4",
    major: "Teknik Informatika",
  });
  const [uploadOpen, setUploadOpen] = useState(false);

  const summary = useMemo(() => {
    const valid = rows
      .map((r) => ({ ...r, sks: Number(r.sks) || 0, grade: normalizeGrade(r.grade).grade, gradePoint: normalizeGrade(r.grade).gradePoint }))
      .filter((r) => r.sks > 0 && r.courseName.trim());
    const totalSks = valid.reduce((s, r) => s + r.sks, 0);
    const weightedGp = valid.reduce((s, r) => s + r.sks * r.gradePoint, 0);
    const ipk = totalSks > 0 ? weightedGp / totalSks : 0;
    const bySem = new Map<number, { sks: number; wg: number }>();
    for (const r of valid) {
      const s = Number(r.semester);
      if (!bySem.has(s)) bySem.set(s, { sks: 0, wg: 0 });
      const a = bySem.get(s)!;
      a.sks += r.sks;
      a.wg += r.sks * r.gradePoint;
    }
    const sems = [...bySem.keys()].sort((a, b) => a - b);
    const ipsList = sems.map((s) => {
      const a = bySem.get(s)!;
      return a.sks > 0 ? a.wg / a.sks : 0;
    });
    const lastIps = ipsList[ipsList.length - 1] ?? 0;
    return { count: valid.length, totalSks, ipk, lastIps, sems, ipsList };
  }, [rows]);

  function addRow() {
    if (!draft.courseName.trim()) return;
    onChange([...rows, { ...draft, id: nextId() }]);
    setDraft({ ...draft, id: nextId(), courseName: "" });
  }

  function removeRow(id: string) {
    onChange(rows.filter((r) => r.id !== id));
  }

  function updateRow(id: string, field: keyof TranscriptRow, value: string) {
    onChange(rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function loadSample() {
    onChange(SAMPLE_TRANSCRIPT.map((r) => ({ ...r, id: nextId() })));
  }

  function importParsed(parsed: TranscriptRow[], major?: string) {
    // Merge with existing rows (avoid duplicates by courseName + semester)
    const existing = new Set(rows.map((r) => `${r.courseName}-${r.semester}`));
    const newRows = parsed.filter((p) => !existing.has(`${p.courseName}-${p.semester}`));
    onChange([...rows, ...newRows]);
  }

  function clearAll() {
    onChange([]);
  }

  function handlePaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData("text");
    // Detect tab/newline separated rows: name \t sks \t grade \t semester
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length > 1) {
      e.preventDefault();
      const parsed: TranscriptRow[] = [];
      for (const line of lines) {
        const parts = line.split(/\t|,/).map((p) => p.trim());
        if (parts.length >= 3) {
          parsed.push({
            id: nextId(),
            courseName: parts[0],
            sks: parts[1] || "3",
            grade: parts[2] || "A",
            semester: parts[3] || draft.semester,
            major: parts[4] || draft.major,
          });
        }
      }
      if (parsed.length > 0) {
        onChange([...rows, ...parsed]);
      }
    }
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="size-5 text-emerald-600" />
              Transkrip Nilai
            </CardTitle>
            <CardDescription className="mt-1">
              Masukkan riwayat mata kuliah yang sudah ditempuh. Nilai akan dinormalisasi ke skala 10 kelas.
            </CardDescription>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="default" size="sm" onClick={() => setUploadOpen(true)} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
              <ClipboardPaste className="size-3.5" />
              Impor Teks
            </Button>
            <Button variant="outline" size="sm" onClick={loadSample} className="gap-1.5">
              <Sparkles className="size-3.5" />
              Contoh
            </Button>
            <Button variant="ghost" size="sm" onClick={clearAll} className="gap-1.5 text-muted-foreground">
              <Trash2 className="size-3.5" />
              Kosongkan
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="Mata Kuliah" value={String(summary.count)} />
          <Stat label="Total SKS" value={String(summary.totalSks)} />
          <Stat label="IPK Kumulatif" value={summary.ipk.toFixed(3)} accent={summary.ipk >= 3.5 ? "good" : summary.ipk >= 3.0 ? "ok" : "warn"} />
          <Stat label="IPS Terakhir" value={summary.lastIps.toFixed(3)} accent={summary.lastIps >= 3.5 ? "good" : summary.lastIps >= 3.0 ? "ok" : "warn"} />
        </div>

        {/* Draft row */}
        <div className="rounded-lg border border-dashed bg-muted/30 p-3 space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Tambah mata kuliah</div>
          <div className="grid grid-cols-2 sm:grid-cols-12 gap-2">
            <div className="col-span-2 sm:col-span-4">
              <Label className="sr-only">Nama mata kuliah</Label>
              <Input
                placeholder="cth: Kalkulus I"
                value={draft.courseName}
                onChange={(e) => setDraft({ ...draft, courseName: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") addRow(); }}
              />
            </div>
            <div className="sm:col-span-2">
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
            <div className="sm:col-span-2">
              <Select value={draft.grade} onValueChange={(v) => setDraft({ ...draft, grade: v })}>
                <SelectTrigger><SelectValue placeholder="Nilai" /></SelectTrigger>
                <SelectContent>
                  {GRADE_ORDER.map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Input
                type="number"
                min={1}
                max={14}
                placeholder="Sem"
                value={draft.semester}
                onChange={(e) => setDraft({ ...draft, semester: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") addRow(); }}
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <Button onClick={addRow} className="w-full gap-1.5">
                <Plus className="size-4" />
              </Button>
            </div>
          </div>
          <div className="text-[11px] text-muted-foreground">
            Tip: kamu bisa menempel (paste) banyak baris dari Excel — format: <code>nama, sks, nilai, semester</code>.
          </div>
        </div>

        {/* Rows */}
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
            <Upload className="mx-auto mb-2 size-6 opacity-40" />
            Belum ada transkrip. Klik <b>Contoh</b> untuk memuat data sampel.
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto rounded-lg border scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Mata Kuliah</th>
                  <th className="px-2 py-2 text-center font-medium w-14">SKS</th>
                  <th className="px-2 py-2 text-center font-medium w-16">Nilai</th>
                  <th className="px-2 py-2 text-center font-medium w-16">Sem</th>
                  <th className="px-2 py-2 text-center font-medium w-10"></th>
                </tr>
              </thead>
              <tbody onPaste={handlePaste}>
                {rows.map((r) => {
                  const gp = normalizeGrade(r.grade).gradePoint;
                  return (
                    <tr key={r.id} className="border-t hover:bg-muted/40">
                      <td className="px-3 py-1.5">
                        <Input
                          value={r.courseName}
                          onChange={(e) => updateRow(r.id, "courseName", e.target.value)}
                          className="h-8 border-0 bg-transparent px-0 focus-visible:bg-background focus-visible:ring-1"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <Input
                          type="number"
                          value={r.sks}
                          onChange={(e) => updateRow(r.id, "sks", e.target.value)}
                          className="h-8 w-12 text-center"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <Select value={r.grade} onValueChange={(v) => updateRow(r.id, "grade", v)}>
                          <SelectTrigger className="h-8 w-14 justify-center"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {GRADE_ORDER.map((g) => (
                              <SelectItem key={g} value={g}>{g}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <Input
                          type="number"
                          value={r.semester}
                          onChange={(e) => updateRow(r.id, "semester", e.target.value)}
                          className="h-8 w-12 text-center"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <GradeBadge grade={r.grade} size="sm" />
                          <span className="text-[10px] text-muted-foreground tabular-nums w-8">{gp.toFixed(1)}</span>
                          <button
                            onClick={() => removeRow(r.id)}
                            className="rounded p-1 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600"
                            aria-label="Hapus"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {summary.sems.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {summary.sems.map((s, i) => (
              <Badge key={s} variant="outline" className={cn("font-mono tabular-nums", summary.ipsList[i] >= 3.5 ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300" : "")}>
                Sem {s}: {summary.ipsList[i].toFixed(2)}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>

      {/* Upload dialog */}
      <TranscriptUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onImport={importParsed}
      />
    </Card>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "good" | "ok" | "warn" }) {
  const cls = accent === "good" ? "text-emerald-700 dark:text-emerald-300"
    : accent === "warn" ? "text-rose-700 dark:text-rose-300"
    : accent === "ok" ? "text-amber-700 dark:text-amber-300"
    : "text-foreground";
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("font-mono text-lg font-semibold tabular-nums", cls)}>{value}</div>
    </div>
  );
}
