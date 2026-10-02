// Copyright 2026 SQRS. Licensed under the Apache License, Version 2.0.

// Retired words (spec §10.2). A word that was replaced in place at its index
// is retired: the replacement takes the index, and this table maps the
// retired word to it, so a name written under the earlier list keeps
// resolving to the same square. Applied as an exact substitution wherever a
// word is looked up (decoding, check tokens, input resolution). Encoders never
// emit a retired word, and a retired word never re-enters a list.
//
// The normative copy is spec/retired-words.json; a test asserts this module
// matches it. Empty at wordlist 1.0.0; wordlist 1.1.0 retired 13 adjectives
// and 57 nouns.

export const RETIRED_ADJECTIVES: Readonly<Record<string, string>> = {
  hot: "large",
  abloom: "natural",
  titchy: "modern",
  whizzy: "smart",
  swishy: "classic",
  ribboned: "magic",
  young: "perfect",
  youthful: "instant",
  naive: "metallic",
  petite: "regular",
  tender: "true",
  cheeky: "great",
  public: "fine",
};

export const RETIRED_NOUNS: Readonly<Record<string, string>> = {
  pronoun: "fish",
  swamp: "gift",
  caboose: "answer",
  specimen: "record",
  oxeye: "design",
  cobnut: "fashion",
  venturer: "message",
  avocet: "captain",
  dugong: "author",
  giblets: "surprise",
  enlarger: "machine",
  ziti: "horse",
  drinker: "journey",
  keg: "holiday",
  cocktail: "lunch",
  chaser: "champion",
  ashtray: "bicycle",
  playtime: "harvest",
  bathtime: "outfit",
  bedtime: "reward",
  anaconda: "image",
  salami: "echo",
  joystick: "sprint",
  lotion: "comfort",
  magnum: "headline",
  calibre: "diagram",
  breather: "nickel",
  grabber: "glimpse",
  fishnet: "update",
  chatroom: "signal",
  teenager: "league",
  youth: "quiz",
  pupil: "orbit",
  brownie: "award",
  mushroom: "exercise",
  pub: "frame",
  tavern: "voice",
  barroom: "phrase",
  winery: "flight",
  vineyard: "weather",
  cabernet: "coin",
  cask: "pattern",
  tankard: "sound",
  flagon: "choice",
  decanter: "network",
  skunk: "project",
  bap: "question",
  crutch: "bargain",
  chimp: "board",
  gorilla: "trade",
  casino: "material",
  poker: "subject",
  roulette: "research",
  jackpot: "cartoon",
  lotto: "effect",
  hypnosis: "sandwich",
  swallow: "shield",
};

/** The current word for `word` if it has been retired; otherwise `word`. */
export function currentWord(word: string): string {
  return RETIRED_ADJECTIVES[word] ?? RETIRED_NOUNS[word] ?? word;
}
