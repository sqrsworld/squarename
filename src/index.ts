// Copyright 2026 SQRS. Licensed under the Apache License, Version 2.0.

// squarename — reference implementation of the Squarenames v1 specification.
// See spec/squarenames-v1.md. No runtime dependencies.

export {
  encode,
  decode,
  format,
  parse,
  squarenameAt,
  regionCodeAt,
  isRegionCode,
  spotRing,
  patchRing,
  sectorRing,
  patchInstancesInBox,
  BAND_DEG,
  SPOT_M,
  PATCH_M,
  SECTOR_M,
  REGION_DEG,
} from "./grid.js";
export type { Squarename, PatchInstance } from "./grid.js";

export {
  checkValue,
  checkChar,
  checkWord,
  verifyCheck,
  CHECK_P_FULL,
  CHECK_P_CHAR,
  CHECK_P_WORD,
  CHECK_CHAR_ALPHABET,
} from "./check.js";
export type { LocalTriple } from "./check.js";

export { ADJECTIVES, NOUNS, WORDLIST_VERSION } from "./wordlist.js";

export { VARIANT_ADJECTIVES, VARIANT_NOUNS, canonicalSpelling } from "./variants.js";
export { RETIRED_ADJECTIVES, RETIRED_NOUNS, currentWord } from "./retired.js";

export {
  editDistance,
  suggestWords,
  resolveWord,
  resolveWordDetailed,
  parsePartial,
} from "./resolve.js";
export type { WordMatch, PartialSquarename } from "./resolve.js";

export { resolve, displayRegion } from "./alias.js";
export type { AliasResolver, Resolution, ResolveOptions } from "./alias.js";
