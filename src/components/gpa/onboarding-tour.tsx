"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  GraduationCap,
  ScanLine,
  Target,
  TrendingUp,
  Sliders,
  GitCompare,
  CalendarRange,
  ChevronRight,
  X,
  Sparkles,
} from "lucide-react";
import { useLocalStorage } from "@/hooks/use-local-storage";

const STEPS = [
  {
    icon: GraduationCap,
    title: "Selamat datang di IPK Optimizer",
    description: "Sistem rekomendasi akademik berbasis ML (K-Means + Logistic Regression) untuk optimalisasi IPK mahasiswa Indonesia.",
    color: "from-emerald-500 to-teal-600",
  },
  {
    icon: ScanLine,
    title: "1. Input Transkrip",
    description: "Masukkan riwayat mata kuliah manual atau scan foto/PDF transkrip dengan AI Vision. Nilai dinormalisasi ke skala 10 kelas (A, A-, B+, ... E).",
    color: "from-emerald-500 to-emerald-600",
  },
  {
    icon: Target,
    title: "2. Mata Kuliah Target",
    description: "Tambahkan mata kuliah semester target. Atur tingkat kesulitan tiap mata kuliah (opsional) sesuai pengalaman di jurusanmu.",
    color: "from-amber-500 to-orange-600",
  },
  {
    icon: TrendingUp,
    title: "3. Jalankan Optimasi",
    description: "Dapatkan 4 kelompok kombinasi nilai (santai · serius · keras · maksimal) dengan proyeksi IPK, ΔIPK, dan tingkat kesulitan kumulatif.",
    color: "from-sky-500 to-blue-600",
  },
  {
    icon: Sliders,
    title: "4. What-If Simulator",
    description: "Pilih nilai manual per mata kuliah dan lihat proyeksi IPK real-time. Termasuk progress tracker menuju Cumlaude (3.50).",
    color: "from-violet-500 to-purple-600",
  },
  {
    icon: GitCompare,
    title: "5. Comparison Mode",
    description: "Pin kombinasi nilai (📌) dari skenario berbeda untuk membandingkan side-by-side. Buka panel perbandingan dengan tombol floating atau tekan 'C'.",
    color: "from-rose-500 to-pink-600",
  },
  {
    icon: CalendarRange,
    title: "6. Multi-Semester Planning",
    description: "Rencanakan 1-4 semester ke depan sekaligus. Sistem mensimulasikan tiap semester berurutan dengan skenario terbaik.",
    color: "from-violet-500 to-indigo-600",
  },
];

export function OnboardingTour() {
  const [seen, setSeen] = useLocalStorage<boolean>("ipk:onboarded", false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!seen) {
      const timer = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, [seen]);

  function handleClose() {
    setOpen(false);
    setSeen(true);
  }

  function handleNext() {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleClose();
    }
  }

  function handleSkip() {
    handleClose();
  }

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md p-0 overflow-hidden gap-0">
        {/* Gradient header */}
        <div className={`relative bg-gradient-to-br ${current.color} p-6 text-white overflow-hidden`}>
          <div className="absolute -top-8 -right-8 size-32 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-8 -left-8 size-32 rounded-full bg-white/10 blur-2xl" />
          <button
            onClick={handleSkip}
            className="absolute top-3 right-3 rounded-full p-1.5 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Lewati"
          >
            <X className="size-4" />
          </button>
          <div className="relative flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-xl bg-white/20 backdrop-blur ring-1 ring-white/30">
              <Icon className="size-6" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/70 font-medium">
                Tour · Langkah {step + 1} dari {STEPS.length}
              </div>
              <DialogTitle className="text-lg font-bold mt-0.5">
                {current.title}
              </DialogTitle>
            </div>
          </div>
        </div>

        <DialogHeader className="px-6 pt-4 pb-2">
          <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
            {current.description}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="px-6 py-2 flex items-center gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step
                  ? "flex-1 bg-emerald-500"
                  : i < step
                  ? "flex-1 bg-emerald-500/40"
                  : "w-1.5 bg-muted"
              }`}
            />
          ))}
        </div>

        <DialogFooter className="px-6 pb-4 pt-2 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground">
            Lewati tour
          </Button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={() => setStep(step - 1)}>
                Kembali
              </Button>
            )}
            <Button size="sm" onClick={handleNext} className="gap-1.5">
              {isLast ? (
                <>
                  <Sparkles className="size-3.5" />
                  Mulai
                </>
              ) : (
                <>
                  Lanjut
                  <ChevronRight className="size-3.5" />
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
