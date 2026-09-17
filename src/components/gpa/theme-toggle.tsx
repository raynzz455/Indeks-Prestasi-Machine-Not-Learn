"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useSyncExternalStore } from "react";

function emptySubscribe() {
  return () => {};
}

export function ThemeToggle() {
  const { setTheme } = useTheme();
  // Read the resolved theme from <html class="dark"> to avoid the
  // "setState in effect" pattern. useSyncExternalStore handles hydration.
  const isDark = useSyncExternalStore(
    emptySubscribe,
    () => document.documentElement.classList.contains("dark"),
    () => false
  );

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8 rounded-lg"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Aktifkan mode terang" : "Aktifkan mode gelap"}
      title={isDark ? "Mode terang" : "Mode gelap"}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
