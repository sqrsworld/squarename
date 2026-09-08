// Copyright 2026 SQRS. Licensed under the Apache License, Version 2.0.

// Retired words (spec §10.2). A word that was replaced in place at its index
// is retired: the replacement takes the index, and this table maps the
// retired word to it, so a name written under the earlier list keeps
// resolving to the same square. Applied as an exact substitution wherever a
// word is looked up (decoding, check tokens, input resolution). Encoders never
// emit a retired word, and a retired word never re-enters a list.
//
// The normative copy is spec/retired-words.json; a test asserts this module
// matches it. Empty at wordlist 1.0.0, the first published list.

export const RETIRED_ADJECTIVES: Readonly<Record<string, string>> = {};

export const RETIRED_NOUNS: Readonly<Record<string, string>> = {};

/** The current word for `word` if it has been retired; otherwise `word`. */
export function currentWord(word: string): string {
  return RETIRED_ADJECTIVES[word] ?? RETIRED_NOUNS[word] ?? word;
}
