// Copyright 2026 SQRS. Licensed under the Apache License, Version 2.0.

// Wordlist confusability validator (spec §3.3). Not part of the published
// package's runtime: it depends on double-metaphone and runs in the test
// suite against the shipped lists, so a change that introduces a confusable
// pair fails the build. A conforming implementation must ship this check.
//
// A list is valid iff no two words are within Damerau-Levenshtein distance 1
// (one insert/delete/substitute/adjacent transpose — home/homes, low/slow,
// circus/cirrus) and no two words are homophones (Double Metaphone primary
// code, with spellings within distance 2 — bare/bear, isle/aisle, which edit
// distance misses). Minimum distance 2 also makes a distance-1 automatic
// correction provably unambiguous.
import { doubleMetaphone } from "double-metaphone";

export interface WordlistConflict {
  pair: [string, string];
  reason: "edit1" | "homophone";
}

const ALPHABET = "abcdefghijklmnopqrstuvwxyz";

/** Every string within Damerau-Levenshtein distance 1 of `w` (plus `w`
 *  itself, harmless for conflict probing since a list has no duplicates).
 *  About 53·len variants; probing a Set of these beats O(n²) pairwise
 *  distance. */
function distance1Variants(w: string): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < w.length; i++) {
    out.add(w.slice(0, i) + w.slice(i + 1)); // delete
    for (const c of ALPHABET) {
      out.add(w.slice(0, i) + c + w.slice(i + 1)); // substitute
      out.add(w.slice(0, i) + c + w.slice(i)); // insert
    }
    if (i < w.length - 1) {
      out.add(w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2)); // transpose
    }
  }
  for (const c of ALPHABET) out.add(w + c); // append
  return out;
}

/** All confusable pairs in a wordlist. Empty array = the list is valid.
 *  O(n·len·|alphabet|) via variant probing, not O(n²). */
export function wordlistConflicts(words: readonly string[]): WordlistConflict[] {
  const conflicts: WordlistConflict[] = [];
  const seenPair = new Set<string>();
  // One report per pair — edit1 runs first and subsumes homophone (a pair that
  // is both is an edit1 problem for curation purposes).
  const flag = (a: string, b: string, reason: WordlistConflict["reason"]) => {
    const [lo, hi] = a < b ? [a, b] : [b, a];
    const key = `${lo}|${hi}`;
    if (seenPair.has(key)) return;
    seenPair.add(key);
    conflicts.push({ pair: [lo, hi], reason });
  };

  // Edit distance ≤ 1: probe each word's distance-1 variants against the list.
  const all = new Set(words);
  for (const w of words) {
    for (const v of distance1Variants(w)) {
      if (v !== w && all.has(v)) flag(w, v, "edit1");
    }
  }

  // Homophones: bucket by Double Metaphone primary code, then require the
  // spellings to also be close (Damerau ≤ 2). Code equality alone is a broad
  // phonetic-similarity bucket (it pairs accurate/awkward, afraid/everyday,
  // which are not homophones); adding the spelling gate keeps the true
  // bare/bear, isle/aisle class while staying enforceable.
  const buckets = new Map<string, string[]>();
  for (const w of words) {
    const code = doubleMetaphone(w)[0];
    const b = buckets.get(code);
    if (b) b.push(w);
    else buckets.set(code, [w]);
  }
  for (const bucket of buckets.values()) {
    if (bucket.length < 2) continue;
    for (let i = 0; i < bucket.length; i++)
      for (let j = i + 1; j < bucket.length; j++) {
        if (damerau(bucket[i], bucket[j]) <= 2) flag(bucket[i], bucket[j], "homophone");
      }
  }

  return conflicts;
}

/** Damerau-Levenshtein distance (restricted adjacent transposition). Only
 *  used on the small metaphone buckets, so the O(len²) matrix is fine. */
export function damerau(a: string, b: string): number {
  const m = a.length,
    n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}
