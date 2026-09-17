/**
 * Course name normalizer.
 * Indonesian universities, majors, and faculties use varying names for the same
 * course (e.g., "Algoritma dan Pemrograman" / "Alprog" / "Pemrograman Dasar").
 * This module maps raw user input to a canonical course from CANONICAL_COURSES
 * using tokenization + Levenshtein distance + keyword/alias matching.
 */
import { CANONICAL_COURSES, type CanonicalCourse } from "./config";

/** Levenshtein edit distance (case-insensitive strings). */
export function levenshtein(a: string, b: string): number {
  const s = a.toLowerCase();
  const t = b.toLowerCase();
  const m = s.length;
  const n = t.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

/** Tokenize a course name: lowercase, strip punctuation, convert roman numerals to arabic.
 * Numeric tokens (1, 2, 3) are KEPT because they distinguish course levels
 * (Kalkulus I vs Kalkulus II vs Kalkulus III).
 */
function tokenize(name: string): string[] {
  const cleaned = name
    .toLowerCase()
    .replace(/[.,;:!?()&/\\[\]'"]/g, " ")
    .replace(/\b(i{1,3}|iv|v|vi{0,3})\b/g, (m) => {
      // convert roman to arabic: i→1, ii→2, iii→3, iv→4
      const map: Record<string, string> = { i: "1", ii: "2", iii: "3", iv: "4" };
      return map[m] ?? m;
    })
    .replace(/\s+/g, " ")
    .trim();
  const stop = new Set([
    "dan", "atau", "the", "of", "for", "to", "in", "on", "ke",
  ]);
  return cleaned.split(" ").filter((w) => w.length > 0 && !stop.has(w));
}

/** Compute a similarity score 0..1 between a raw name and a canonical course. */
function similarity(raw: string, course: CanonicalCourse): number {
  const rawLower = raw.toLowerCase().trim();
  const nameLower = course.name.toLowerCase();
  const aliasesLower = course.aliases.map((a) => a.toLowerCase());

  // Exact match
  if (rawLower === nameLower) return 1;
  if (aliasesLower.includes(rawLower)) return 0.98;

  // Token overlap (Jaccard)
  const rawTokens = new Set(tokenize(raw));
  const nameTokens = new Set(tokenize(course.name));
  if (rawTokens.size > 0 && nameTokens.size > 0) {
    let inter = 0;
    rawTokens.forEach((t) => {
      if (nameTokens.has(t)) inter++;
    });
    const union = rawTokens.size + nameTokens.size - inter;
    const jaccard = union > 0 ? inter / union : 0;

    // Alias token sets
    let bestAliasJaccard = 0;
    for (const a of course.aliases) {
      const aTokens = new Set(tokenize(a));
      if (aTokens.size === 0) continue;
      let ai = 0;
      rawTokens.forEach((t) => {
        if (aTokens.has(t)) ai++;
      });
      const au = rawTokens.size + aTokens.size - ai;
      const aj = au > 0 ? ai / au : 0;
      bestAliasJaccard = Math.max(bestAliasJaccard, aj);
    }

    const tokenScore = Math.max(jaccard, bestAliasJaccard);

    // Levenshtein on full strings (normalized by max length)
    const maxLen = Math.max(rawLower.length, nameLower.length);
    const dist = levenshtein(rawLower, nameLower);
    const levScore = maxLen > 0 ? 1 - dist / maxLen : 0;

    // Alias Levenshtein
    let bestAliasLev = 0;
    for (const a of course.aliases) {
      const aLower = a.toLowerCase();
      const ml = Math.max(rawLower.length, aLower.length);
      const d = levenshtein(rawLower, aLower);
      const sc = ml > 0 ? 1 - d / ml : 0;
      bestAliasLev = Math.max(bestAliasLev, sc);
    }

    // Substring bonus
    let subBonus = rawLower.includes(nameLower) || nameLower.includes(rawLower) ? 0.15 : 0;
    for (const a of course.aliases) {
      const aLower = a.toLowerCase();
      if (rawLower.includes(aLower) || aLower.includes(rawLower)) {
        // small alias substring
        if (aLower.length >= 3) subBonus += 0.05;
      }
    }

    // Combine — token score weighted heavily, levenshtein as fallback
    return Math.min(1, tokenScore * 0.7 + Math.max(levScore, bestAliasLev) * 0.3 + subBonus);
  }

  return 0;
}

export interface NormalizationResult {
  rawName: string;
  normalizedName: string;
  category: string;
  defaultSks: number;
  typicalDifficulty: number;
  confidence: number;
  matched: boolean;
}

/** Normalize a raw course name against the canonical catalog. */
export function normalizeCourseName(raw: string): NormalizationResult {
  if (!raw || !raw.trim()) {
    return {
      rawName: raw,
      normalizedName: raw,
      category: "Lainnya",
      defaultSks: 3,
      typicalDifficulty: 0.5,
      confidence: 0,
      matched: false,
    };
  }

  let bestCourse: CanonicalCourse | undefined;
  let bestScore = 0;
  for (const c of CANONICAL_COURSES) {
    const sc = similarity(raw, c);
    if (sc > bestScore) {
      bestScore = sc;
      bestCourse = c;
    }
  }

  if (!bestCourse || bestScore < 0.32) {
    // No good match — keep the raw name (still treated as canonical for that student)
    return {
      rawName: raw,
      normalizedName: raw.trim(),
      category: "Lainnya",
      defaultSks: 3,
      typicalDifficulty: 0.5,
      confidence: bestScore,
      matched: false,
    };
  }

  return {
    rawName: raw,
    normalizedName: bestCourse.name,
    category: bestCourse.category,
    defaultSks: bestCourse.defaultSks,
    typicalDifficulty: bestCourse.typicalDifficulty,
    confidence: bestScore,
    matched: true,
  };
}

/** Batch normalize. */
export function normalizeCourseNames(rawNames: string[]): NormalizationResult[] {
  return rawNames.map(normalizeCourseName);
}
