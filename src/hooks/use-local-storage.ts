"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Persisted state hook backed by localStorage.
 * Uses useSyncExternalStore (React 18+) to avoid the "setState in effect"
 * anti-pattern and stay SSR-safe.
 *
 * Returns [value, setValue, reset] like useState.
 *
 * Note: `initialValue` should be a stable reference (e.g. a module-level
 * constant or wrapped in useState/useMemo) to avoid extra re-subscriptions.
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (v: T | ((prev: T) => T)) => void, () => void] {
  // Subscribe to window storage events so multiple tabs/components stay in sync.
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (typeof window === "undefined") return () => {};
      const handler = (e: StorageEvent) => {
        if (e.key === key) onStoreChange();
      };
      window.addEventListener("storage", handler);
      return () => window.removeEventListener("storage", handler);
    },
    [key]
  );

  // Read current value from localStorage (client) or empty marker (server).
  const getSnapshot = useCallback((): string => {
    if (typeof window === "undefined") return "";
    try {
      return window.localStorage.getItem(key) ?? "";
    } catch {
      return "";
    }
  }, [key]);

  const getServerSnapshot = useCallback(() => "", []);

  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Decode the raw string into T. Fall back to initialValue.
  const value: T = raw === "" ? initialValue : safeParse(raw, initialValue);

  const setValue = useCallback(
    (v: T | ((prev: T) => T)) => {
      if (typeof window === "undefined") return;
      try {
        const prevRaw = window.localStorage.getItem(key) ?? "";
        const prev: T = prevRaw === "" ? initialValue : safeParse(prevRaw, initialValue);
        const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
        window.localStorage.setItem(key, JSON.stringify(next));
        // Dispatch a synthetic storage event so the same tab also updates.
        window.dispatchEvent(new StorageEvent("storage", { key, newValue: JSON.stringify(next) }));
      } catch {
        // ignore quota / parse errors
      }
    },
    [key, initialValue]
  );

  const reset = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(key);
      window.dispatchEvent(new StorageEvent("storage", { key, newValue: null }));
    } catch {
      // ignore
    }
  }, [key]);

  return [value, setValue, reset];
}

function safeParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
