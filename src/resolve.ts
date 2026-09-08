// Copyright 2026 SQRS. Licensed under the Apache License, Version 2.0.

// Word resolution helpers for input surfaces: edit distance, completion of a
// partial word, correction of a complete word, and splitting a partially
// typed name into its finished and unfinished tokens. Pure functions; the
// caller supplies the candidate words (a whole list, or the words present in
// a bounded area).
//
// Under the minimum-distance-2 wordlists (spec §3.3) a distance-1 match is the
// unique correction, which is what makes automatic correction safe. The
// recognised variant spellings (spec §10.1) and retired words (spec §10.2)
// are applied first, as exact substitutions, so that "meter" resolves to
// "metre" and never to "meteor", and a name written under an earlier list
// still resolves.

import { canonicalSpelling } from "./variants.js";
import { currentWord } from "./retired.js";

/** Levenshtein edit distance, early-exiting once it exceeds `max` (returns
 *  `max + 1` then). Small words only, so the DP is cheap. */
export function editDistance(a: string, b: string, max = Infinity): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    let rowBest = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + cost);
      diag = tmp;
      if (prev[j] < rowBest) rowBest = prev[j];
    }
    if (rowBest > max) return max + 1;
  }
  return prev[b.length];
}

// Tolerance scales with length: short words allow 1 edit, longer 2.
const fuzzyTol = (len: number) => (len <= 4 ? 1 : 2);

/** Complete a partial word against candidates: prefix matches first; if there
 *  are none and the partial reads like a full word, fall back to close
 *  (edit-distance) matches, so a mistyped word still surfaces the real one
 *  (e.g. "spongey" → "spongy"). */
export function suggestWords(partial: string, candidates: readonly string[], limit: number): string[] {
  const p = currentWord(canonicalSpelling(partial));
  const prefix = candidates.filter((c) => c.startsWith(p));
  if (prefix.length) return prefix.slice(0, limit);
  if (p.length < 3) return [];
  const tol = fuzzyTol(p.length);
  return candidates
    .map((c) => [c, editDistance(p, c, tol)] as const)
    .filter(([, d]) => d <= tol)
    .sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, limit)
    .map(([c]) => c);
}

export interface WordMatch {
  /** The canonical candidate. */
  word: string;
  /** Edit distance from the typed word: 0 = exact, ≥ 1 = a correction. */
  distance: number;
  /** Set when the typed word was a recognised variant spelling (spec §10.1). */
  variantOf?: string;
  /** Set when the typed word was a retired word (spec §10.2). */
  retiredFrom?: string;
}

/** Resolve a complete typed word to its canonical candidate with the edit
 *  distance (0 = exact). Null if nothing is within tolerance. Exposing the
 *  distance lets a safety-critical surface tell an exact match from a
 *  correction and confirm the latter ("did you mean spongy?") rather than
 *  apply it silently. */
export function resolveWordDetailed(word: string, candidates: readonly string[]): WordMatch | null {
  const typed = word.toLowerCase();
  const spelled = canonicalSpelling(typed);
  const w = currentWord(spelled);
  if (candidates.includes(w)) {
    const m: WordMatch = { word: w, distance: 0 };
    if (spelled !== typed) m.variantOf = typed;
    if (w !== spelled) m.retiredFrom = spelled;
    return m;
  }
  if (w.length < 3) return null;
  const tol = fuzzyTol(w.length);
  let best: string | null = null;
  let bestD = tol + 1;
  for (const c of candidates) {
    const d = editDistance(w, c, tol);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best && bestD <= tol ? { word: best, distance: bestD } : null;
}

/** Resolve a complete typed word to its canonical candidate: exact, else the
 *  single nearest within tolerance, else null. */
export function resolveWord(word: string, candidates: readonly string[]): string | null {
  return resolveWordDetailed(word, candidates)?.word ?? null;
}

export interface PartialSquarename {
  /** Which token is being typed: 0 = sector, 1 = patch, 2 = spot. */
  stage: 0 | 1 | 2;
  sector: string | null; // completed first word
  patch: string | null; // completed second word
  partial: string; // the token being typed (lower-cased)
}

const SEP = /[\s.\-·,]+/;
const ENDS_SEP = /[\s.\-·,]$/;

/** Split a partially typed local triple into its completed words and the
 *  token being typed, so an input can suggest the next token. Pure: the
 *  caller validates the words against its candidates. */
export function parsePartial(query: string): PartialSquarename {
  const q = query.toLowerCase();
  const tokens = q.split(SEP).filter(Boolean);
  const done = ENDS_SEP.test(q) ? tokens : tokens.slice(0, -1);
  const partial = ENDS_SEP.test(q) ? "" : (tokens[tokens.length - 1] ?? "");
  const stage = Math.min(done.length, 2) as 0 | 1 | 2;
  return { stage, sector: done[0] ?? null, patch: done[1] ?? null, partial };
}
