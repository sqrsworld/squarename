// Copyright 2026 SQRS. Licensed under the Apache License, Version 2.0.

// Recognised variant spellings (spec §10.1). An exact-match substitution from an
// accepted input spelling to the canonical word in the frozen list, applied
// before any fuzzy correction. The table is bounded by the list: it contains
// only variants of words that are in it, and none of the variants is itself a
// list word. Encoders never emit a variant.
//
// The normative copy is spec/variant-spellings.json; a test asserts this
// module matches it.

export const VARIANT_ADJECTIVES: Readonly<Record<string, string>> = {
  labeled: "labelled",
  honored: "honoured",
  armored: "armoured",
  jeweled: "jewelled",
};

export const VARIANT_NOUNS: Readonly<Record<string, string>> = {
  liter: "litre",
  meter: "metre",
  yogurt: "yoghurt",
  caliber: "calibre",
  artifact: "artefact",
  laborer: "labourer",
  parlor: "parlour",
  vapor: "vapour",
  pajamas: "pyjamas",
  donut: "doughnut",
  omelet: "omelette",
  harbor: "harbour",
  checker: "chequer",
  drafts: "draughts",
  ameba: "amoeba",
  prolog: "prologue",
  epilog: "epilogue",
  plimsol: "plimsoll",
};

/** The canonical spelling of `word` if it is a recognised variant of a word
 *  in either list; otherwise `word` unchanged. Lower-cases the input. */
export function canonicalSpelling(word: string): string {
  const w = word.toLowerCase();
  return VARIANT_ADJECTIVES[w] ?? VARIANT_NOUNS[w] ?? w;
}
