"use client";

import { Download, Printer, FileJson } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import type { OptimizationResult } from "@/lib/gpa/types";

interface ExportMenuProps {
  result: OptimizationResult;
  transcript: { courseName: string; sks: number; grade: string; semester: number }[];
  planned: { courseName: string; sks: number }[];
}

export function ExportMenu({ result, transcript, planned }: ExportMenuProps) {
  function downloadJson() {
    const payload = {
      exportedAt: new Date().toISOString(),
      summary: result.summary,
      classifiedCourses: result.classifiedCourses,
      scenarios: result.scenarios,
      trend: result.trend,
      distributions: result.distributions,
      input: { transcript, planned },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    triggerDownload(blob, `ipk-optimization-${Date.now()}.json`);
  }

  function downloadCsv() {
    const rows: string[] = [];
    rows.push("Skenario,Rank,Kombinasi,IPS,IPK Proyeksi,Delta IPK,Kesulitan Kumulatif,Probabilitas");
    for (const sc of result.scenarios) {
      sc.combinations.forEach((c, i) => {
        const combo = c.grades.map((g) => `${g.normalizedName}:${g.grade}`).join(" | ");
        rows.push(`${sc.label},${i + 1},"${combo}",${c.ips},${c.newIpk},${c.ipkDelta},${c.cumulativeDifficulty},${c.expectedProbability}`);
      });
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    triggerDownload(blob, `ipk-combinations-${Date.now()}.csv`);
  }

  function printReport() {
    window.print();
  }

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Download className="size-3.5" />
          Ekspor
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-xs">Format ekspor</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={downloadJson} className="gap-2 cursor-pointer">
          <FileJson className="size-3.5 text-emerald-600" />
          <div>
            <div className="text-sm font-medium">JSON (lengkap)</div>
            <div className="text-[10px] text-muted-foreground">Semua data optimasi + input</div>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={downloadCsv} className="gap-2 cursor-pointer">
          <Download className="size-3.5 text-sky-600" />
          <div>
            <div className="text-sm font-medium">CSV (kombinasi)</div>
            <div className="text-[10px] text-muted-foreground">Tabel kombinasi nilai per skenario</div>
          </div>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={printReport} className="gap-2 cursor-pointer">
          <Printer className="size-3.5 text-amber-600" />
          <div>
            <div className="text-sm font-medium">Cetak / PDF</div>
            <div className="text-[10px] text-muted-foreground">Buka dialog print browser</div>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
