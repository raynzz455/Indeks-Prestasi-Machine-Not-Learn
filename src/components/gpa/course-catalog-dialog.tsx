"use client";

import { useState, useMemo } from "react";
import { Search, BookOpen, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CANONICAL_COURSES, MAJORS, type CanonicalCourse } from "@/lib/gpa/config";
import { DifficultyBadge } from "./badges";
import { cn } from "@/lib/utils";

interface CourseCatalogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (course: CanonicalCourse) => void;
}

const CATEGORIES = Array.from(new Set(CANONICAL_COURSES.map((c) => c.category))).sort();

export function CourseCatalogDialog({ open, onOpenChange, onSelect }: CourseCatalogDialogProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return CANONICAL_COURSES.filter((c) => {
      if (category !== "all" && c.category !== category) return false;
      if (!q) return true;
      const haystack = [c.name, c.category, ...c.aliases].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [query, category]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">
            <BookOpen className="size-4 text-emerald-600" />
            Katalog Mata Kuliah
          </DialogTitle>
          <DialogDescription className="text-xs">
            {CANONICAL_COURSES.length} mata kuliah kanonik · pilih untuk menambah ke semester target.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-3 border-b space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama atau alias mata kuliah…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            <CategoryChip active={category === "all"} onClick={() => setCategory("all")}>Semua</CategoryChip>
            {CATEGORIES.map((cat) => (
              <CategoryChip key={cat} active={category === cat} onClick={() => setCategory(cat)}>{cat}</CategoryChip>
            ))}
          </div>
        </div>

        <ScrollArea className="flex-1 max-h-[50vh]">
          <div className="px-5 py-3 space-y-1.5">
            {filtered.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                Tidak ada mata kuliah yang cocok.
              </div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.name}
                  onClick={() => {
                    onSelect(c);
                    onOpenChange(false);
                  }}
                  className="w-full text-left rounded-lg border bg-card px-3 py-2 hover:bg-muted/40 hover:border-emerald-500/40 transition-colors flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{c.name}</div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap mt-0.5">
                      <Badge variant="outline" className="text-[9px] py-0 h-3.5">{c.category}</Badge>
                      <span>{c.defaultSks} SKS</span>
                      {c.aliases.length > 0 && (
                        <span className="opacity-60">· alias: {c.aliases.slice(0, 2).join(", ")}{c.aliases.length > 2 ? "…" : ""}</span>
                      )}
                    </div>
                  </div>
                  <DifficultyBadge score={c.typicalDifficulty} label={c.typicalDifficulty < 0.2 ? "sangat_mudah" : c.typicalDifficulty < 0.4 ? "mudah" : c.typicalDifficulty < 0.6 ? "medium" : c.typicalDifficulty < 0.8 ? "sulit" : "sangat_sulit"} />
                </button>
              ))
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="px-5 py-3 border-t">
          <span className="text-[11px] text-muted-foreground mr-auto">{filtered.length} dari {CANONICAL_COURSES.length} mata kuliah</span>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategoryChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-2.5 py-0.5 text-[11px] font-medium border transition-colors",
        active
          ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
          : "bg-muted/40 border-border text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
