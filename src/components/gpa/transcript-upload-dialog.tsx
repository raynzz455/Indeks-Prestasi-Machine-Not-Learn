"use client";

import { useState } from "react";
import { ClipboardPaste, ScanLine, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { TranscriptRow } from "./transcript-input";

interface TranscriptUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (rows: TranscriptRow[], major?: string) => void;
}

interface ParsedEntry {
  id: string;
  courseName: string;
  sks: string;
  grade: string;
  semester: string;
  major: string;
}

export function TranscriptUploadDialog({ open, onOpenChange, onImport }: TranscriptUploadDialogProps) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewEntries, setPreviewEntries] = useState<ParsedEntry[] | null>(null);
  const [detectedMajor, setDetectedMajor] = useState<string | undefined>(undefined);

  async function handleParse() {
    if (!text.trim()) return;
    setLoading(true);
    setPreviewEntries(null);
    setDetectedMajor(undefined);
    try {
      const res = await fetch("/api/gpa/parse-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      const entries: ParsedEntry[] = (data.entries ?? []).map((e: ParsedEntry, i: number) => ({
        ...e,
        id: `parsed-${Date.now()}-${i}`,
      }));
      setPreviewEntries(entries);
      setDetectedMajor(data.major);
      toast.success(`Berhasil mengekstrak ${entries.length} mata kuliah`, {
        description: data.major ? `Jurusan terdeteksi: ${data.major}` : undefined,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Gagal mengekstrak transkrip", { description: msg });
    } finally {
      setLoading(false);
    }
  }

  function handleImport() {
    if (!previewEntries || previewEntries.length === 0) return;
    onImport(previewEntries, detectedMajor);
    toast.success(`${previewEntries.length} mata kuliah diimpor ke transkrip`);
    handleClose();
  }

  function handleClose() {
    setText("");
    setPreviewEntries(null);
    setDetectedMajor(undefined);
    setLoading(false);
    onOpenChange(false);
  }

  function loadExample() {
    setText(
      [
        "Semester 1",
        "Kalkulus I	3	B+	3.3",
        "Algoritma dan Pemrograman	4	A-	3.7",
        "Pancasila	2	A	4.0",
        "Matematika Diskrit	3	B	3.0",
        "Bahasa Indonesia	2	A	4.0",
        "",
        "Semester 2",
        "Kalkulus II	3	B	3.0",
        "Struktur Data	3	B+	3.3",
        "Fisika Dasar I	3	B-	2.7",
        "Pemrograman Web	3	A-	3.7",
        "Kewarganegaraan	2	A	4.0",
      ].join("\n")
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ClipboardPaste className="size-4 text-emerald-600" />
            Impor Transkrip dari Teks
          </DialogTitle>
          <DialogDescription className="text-xs">
            Tempel teks transkrip dari Excel, PDF, atau format tab/koma. Parser berbasis regex akan mengekstrak mata kuliah otomatis.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 scrollbar-thin">
          {/* Text input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Tempel teks transkrip</Label>
              <Button variant="ghost" size="sm" onClick={loadExample} className="h-6 text-[11px] text-muted-foreground">
                Muat contoh
              </Button>
            </div>
            <Textarea
              placeholder={"Format yang didukung:\n• Tab/CSV: nama, sks, nilai, semester\n• Per baris: Kalkulus I\t3\tB+\t1\n• Atau: Kalkulus I, 3, B+, 1\n\nTempel teks di sini..."}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="min-h-[150px] font-mono text-xs"
              rows={8}
            />
            <div className="text-[11px] text-muted-foreground">
              Parser mendukung format: tab-separated, CSV, teks bebas. Nilai dinormalisasi ke skala 10 kelas (A, A-, B+, ... E).
            </div>
          </div>

          {/* Parse button */}
          {text.trim() && (
            <Button onClick={handleParse} disabled={loading} className="w-full gap-2">
              <ClipboardPaste className="size-4" />
              {loading ? "Mengekstrak..." : "Ekstrak Mata Kuliah"}
            </Button>
          )}

          {/* Preview parsed entries */}
          {previewEntries && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  {previewEntries.length} mata kuliah terdeteksi
                </div>
                {detectedMajor && (
                  <span className="text-[11px] text-muted-foreground">
                    Jurusan: <span className="font-medium text-foreground">{detectedMajor}</span>
                  </span>
                )}
              </div>
              {previewEntries.length === 0 ? (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-3 text-sm text-amber-700 dark:text-amber-300 flex items-start gap-2">
                  <AlertCircle className="size-4 mt-0.5 shrink-0" />
                  <span>Tidak ada mata kuliah yang berhasil diekstrak. Pastikan format teks benar — cth: "Nama MK, SKS, Nilai, Semester".</span>
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto rounded-lg border scrollbar-thin">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted/80 backdrop-blur text-[10px] uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Mata Kuliah</th>
                        <th className="px-2 py-2 text-center font-medium w-12">SKS</th>
                        <th className="px-2 py-2 text-center font-medium w-14">Nilai</th>
                        <th className="px-2 py-2 text-center font-medium w-12">Sem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewEntries.map((e, i) => (
                        <tr key={e.id} className={i % 2 === 0 ? "bg-muted/20" : ""}>
                          <td className="px-3 py-1.5 truncate max-w-[200px]">{e.courseName}</td>
                          <td className="px-2 py-1.5 text-center tabular-nums">{e.sks}</td>
                          <td className="px-2 py-1.5 text-center font-mono font-semibold">{e.grade}</td>
                          <td className="px-2 py-1.5 text-center tabular-nums">{e.semester}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Info note */}
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground flex items-start gap-2">
            <FileText className="size-3.5 mt-0.5 shrink-0" />
            <span>Parser berbasis regex (bukan AI) — instan & transparan. Format terbaik: satu mata kuliah per baris dengan kolom nama, SKS, nilai, semester dipisah tab/koma.</span>
          </div>
        </div>

        <DialogFooter className="px-5 py-3 border-t gap-2">
          <Button variant="outline" size="sm" onClick={handleClose}>Batal</Button>
          <Button
            size="sm"
            onClick={handleImport}
            disabled={!previewEntries || previewEntries.length === 0}
            className="gap-1.5"
          >
            <CheckCircle2 className="size-3.5" />
            Impor {previewEntries?.length ?? 0} Mata Kuliah
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
