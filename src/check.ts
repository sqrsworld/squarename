// Copyright 2026 SQRS. Licensed under the Apache License, Version 2.0.

// The check token (spec §7): an opt-in checksum over a squarename's local
// triple (sector, patch, spot) that catches what the wordlists' confusability
// rule cannot: a wrong-but-valid word (a mishearing that lands on another
// real word), a wrong spot number (7 vs 17), and errors in more than one part.
//
// check = (7·sectorIdx + 3·patchIdx + 5·spot) mod P, P prime. A single-part
// error of size Δ goes undetected only when Δ ≡ 0 (mod P), so with P = 4099
// (> 3135, the largest possible Δ) every single-part error is detected. The
// one-character form uses P = 31 and catches 30 of 31 single errors; the
// presentation trades coverage for brevity, the formula is the same.
//
// Three presentations of the same value, chosen per surface (spec §7.2):
//   • checkValue — the raw number (P = 4099, full single-error coverage), for
//     URLs, machines, and a two-digit-or-longer written form.
//   • checkChar  — one confusion-safe character (P = 31), typed or printed.
//   • checkWord  — one spoken word (P = 3121), for read-aloud surfaces
//     ("brave otter seven, verify finch"). Reuses the curated noun list, so
//     the check word is itself phonetically distinct from every other noun.
//
// Computed over the local triple only, so the token stays valid whether the
// region is shown as a coordinate code, an alias, or omitted entirely.
import { ADJECTIVES, NOUNS } from "./wordlist.js";
import { RETIRED_ADJECTIVES, RETIRED_NOUNS, currentWord } from "./retired.js";

const ADJ_IX = new Map(ADJECTIVES.map((w, i) => [w, i]));
const NOUN_IX = new Map(NOUNS.map((w, i) => [w, i]));
// A retired word (spec §10.2) checks as the word that replaced it.
const adjIndex = (w: string) => ADJ_IX.get(w) ?? ADJ_IX.get(RETIRED_ADJECTIVES[w] ?? "");
const nounIndex = (w: string) => NOUN_IX.get(w) ?? NOUN_IX.get(RETIRED_NOUNS[w] ?? "");

const WEIGHTS = [7, 3, 5] as const;

/** Full single-error detection (P > max component range 3135). */
export const CHECK_P_FULL = 4099;
/** One-character encoding prime — 30/31 single-error coverage. */
export const CHECK_P_CHAR = 31;
/** Spoken-word encoding prime — the largest prime that fits the noun list
 *  (3136 words). 1 − 1/3121 single-error coverage. */
export const CHECK_P_WORD = 3121;

// Base-31 alphabet: digits then lower-case letters minus i/l/o/u (digit
// look-alikes and the u/v confusion), cut at 31 characters (spec §7.2).
const CHAR_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz".slice(0, 31);
/** The check char alphabet, indexed 0–30. */
export const CHECK_CHAR_ALPHABET = CHAR_ALPHABET;

export interface LocalTriple {
  sector: string;
  patch: string;
  spot: number;
}

/** The raw checksum for a local triple, mod `p`. Null if a word is not in its
 *  list or the spot is out of range (an invalid name has no checksum). */
export function checkValue(id: LocalTriple, p: number = CHECK_P_FULL): number | null {
  const s = adjIndex(id.sector),
    v = nounIndex(id.patch);
  if (s == null || v == null || !Number.isInteger(id.spot) || id.spot < 1 || id.spot > 25) {
    return null;
  }
  return (WEIGHTS[0] * s + WEIGHTS[1] * v + WEIGHTS[2] * id.spot) % p;
}

/** One-character check token (base-31). Null for invalid names. */
export function checkChar(id: LocalTriple): string | null {
  const v = checkValue(id, CHECK_P_CHAR);
  return v == null ? null : CHAR_ALPHABET[v];
}

/** One-word check token for the spoken surface: a single noun from the list.
 *  Null for invalid names. */
export function checkWord(id: LocalTriple): string | null {
  const v = checkValue(id, CHECK_P_WORD);
  return v == null ? null : NOUNS[v];
}

/** Verify a check token against a name (spec §7.3). `token` may be the
 *  one-character form, a spoken check word, or the full numeric value as a
 *  string; the form is inferred: one character → char (the char alphabet
 *  begins 0–9, so a lone digit is a char, never a value); two or more digits
 *  → value; otherwise → word. The value form is therefore written with at
 *  least two digits ("0007"). False on mismatch or on an invalid name/token —
 *  a failure always means "do not trust this name as-is". */
export function verifyCheck(id: LocalTriple, token: string): boolean {
  const t = token.trim().toLowerCase();
  if (!t) return false;
  if (t.length === 1) {
    const want = checkChar(id);
    return want != null && t === want;
  }
  if (/^\d+$/.test(t)) {
    const want = checkValue(id);
    return want != null && Number(t) === want;
  }
  const want = checkWord(id);
  return want != null && currentWord(t) === want;
}
