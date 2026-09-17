"use client";

import { useState } from "react";
import { Share2, Copy, Check, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { encodeStateToUrl, type ShareableState } from "@/lib/gpa/share";

interface ShareButtonProps {
  transcript: { courseName: string; sks: number; grade: string; semester: number; major?: string }[];
  planned: { courseName: string; sks: number; userDifficultyOverride?: number }[];
  targetIpk?: number;
  useTarget: boolean;
}

export function ShareButton({ transcript, planned, targetIpk, useTarget }: ShareButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);

  function buildState(): ShareableState {
    return {
      t: transcript.map((t) => ({
        n: t.courseName,
        s: t.sks,
        g: t.grade,
        sm: t.semester,
        m: t.major,
      })),
      p: planned.map((p) => ({
        n: p.courseName,
        s: p.sks,
        d: p.userDifficultyOverride,
      })),
      ti: targetIpk,
      ut: useTarget,
    };
  }

  function handleCopyLink() {
    const state = buildState();
    const url = encodeStateToUrl(state);
    setShareUrl(url);
    setDialogOpen(true);
    setCopied(false);
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link berhasil disalin", {
        description: "Bagikan link ini untuk membagikan data transkrip & mata kuliah target.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Gagal menyalin link");
    }
  }

  function handleNativeShare() {
    const state = buildState();
    const url = encodeStateToUrl(state);
    if (navigator.share) {
      navigator
        .share({
          title: "IPK Optimizer — Hasil Optimasi",
          text: "Lihat rencana optimalisasi IPK saya",
          url,
        })
        .catch(() => {});
    } else {
      handleCopyLink();
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Share2 className="size-3.5" />
            Bagikan
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel className="text-xs">Bagikan data</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleNativeShare} className="gap-2 cursor-pointer">
            <Share2 className="size-3.5 text-emerald-600" />
            <div>
              <div className="text-sm font-medium">Bagikan…</div>
              <div className="text-[10px] text-muted-foreground">Native share dialog (jika tersedia)</div>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCopyLink} className="gap-2 cursor-pointer">
            <Link2 className="size-3.5 text-sky-600" />
            <div>
              <div className="text-sm font-medium">Salin Link</div>
              <div className="text-[10px] text-muted-foreground">URL berisi data terkompresi</div>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Link2 className="size-4 text-sky-600" />
              Link Berbagi
            </DialogTitle>
            <DialogDescription className="text-xs">
              URL ini berisi data transkrip & mata kuliah target yang sudah dikompresi. Penerima link akan melihat data yang sama saat membukanya.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              readOnly
              value={shareUrl}
              className="font-mono text-xs"
              onFocus={(e) => e.target.select()}
            />
            <p className="text-[11px] text-muted-foreground">
              Panjang: {shareUrl.length} karakter · Data dikompresi dengan lz-string.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Tutup</Button>
            <Button size="sm" onClick={copyToClipboard} className="gap-1.5">
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Tersalin!" : "Salin"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
