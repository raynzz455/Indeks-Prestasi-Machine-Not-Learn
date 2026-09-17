"use client";

import { create } from "zustand";
import type { GradeCombination, ScenarioName } from "@/lib/gpa/types";

interface PinnedCombination {
  id: string;
  scenario: ScenarioName;
  scenarioLabel: string;
  combination: GradeCombination;
  pinnedAt: number;
}

interface ComparisonStore {
  pinned: PinnedCombination[];
  isDrawerOpen: boolean;
  pin: (scenario: ScenarioName, scenarioLabel: string, combination: GradeCombination) => void;
  unpin: (id: string) => void;
  clear: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
}

export const useComparisonStore = create<ComparisonStore>((set) => ({
  pinned: [],
  isDrawerOpen: false,
  pin: (scenario, scenarioLabel, combination) =>
    set((state) => {
      // Avoid duplicates by combination id (scenario-rank)
      const key = `${scenario}-${combination.id}`;
      if (state.pinned.some((p) => p.id === key)) return state;
      const entry: PinnedCombination = {
        id: key,
        scenario,
        scenarioLabel,
        combination,
        pinnedAt: Date.now(),
      };
      // Limit to 4 pinned combinations
      const next = [...state.pinned, entry];
      if (next.length > 4) next.shift();
      return { pinned: next };
    }),
  unpin: (id) => set((state) => ({ pinned: state.pinned.filter((p) => p.id !== id) })),
  clear: () => set({ pinned: [] }),
  openDrawer: () => set({ isDrawerOpen: true }),
  closeDrawer: () => set({ isDrawerOpen: false }),
  toggleDrawer: () => set((state) => ({ isDrawerOpen: !state.isDrawerOpen })),
}));
