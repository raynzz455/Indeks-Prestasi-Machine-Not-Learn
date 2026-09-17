"use client";

import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";

/**
 * Share utilities — encode/decode app state into a URL-safe compressed string.
 * Uses lz-string for compact encoding (the state can be large with many courses).
 *
 * Falls back gracefully if lz-string is not available (returns empty string).
 */

export interface ShareableState {
  t?: { n: string; s: number; g: string; sm: number; m?: string }[];
  p?: { n: string; s: number; d?: number }[];
  ti?: number;
  ut?: boolean;
}

/**
 * Encode state into a URL hash fragment.
 * Returns a full URL string ready to share.
 */
export function encodeStateToUrl(state: ShareableState): string {
  try {
    const json = JSON.stringify(state);
    const compressed = compressToEncodedURIComponent(json);
    const base = window.location.origin + window.location.pathname;
    return `${base}#s=${compressed}`;
  } catch {
    return window.location.href;
  }
}

/**
 * Decode state from the current URL hash.
 * Returns null if no valid state is found.
 */
export function decodeStateFromUrl(hash: string = window.location.hash): ShareableState | null {
  try {
    const match = hash.match(/[#&]s=([^&]+)/);
    if (!match) return null;
    const compressed = match[1];
    const json = decompressFromEncodedURIComponent(compressed);
    if (!json) return null;
    return JSON.parse(json) as ShareableState;
  } catch {
    return null;
  }
}

/**
 * Check if the current URL has a shared state.
 */
export function hasSharedState(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.hash.includes("s=");
}

/**
 * Clear the shared state from the URL (without reloading).
 */
export function clearSharedState() {
  if (typeof window === "undefined") return;
  const url = window.location.pathname + window.location.search;
  window.history.replaceState(null, "", url);
}
