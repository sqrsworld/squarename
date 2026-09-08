// Copyright 2026 SQRS. Licensed under the Apache License, Version 2.0.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { VARIANT_ADJECTIVES, VARIANT_NOUNS, canonicalSpelling } from "./variants.js";
import { ADJECTIVES, NOUNS, WORDLIST_VERSION } from "./wordlist.js";
import { editDistance } from "./resolve.js";

const published = JSON.parse(readFileSync(new URL("../spec/variant-spellings.json", import.meta.url), "utf8"));

describe("recognised variant spellings", () => {
  it("matches the published table", () => {
    expect(VARIANT_ADJECTIVES).toEqual(published.adjectives);
    expect(VARIANT_NOUNS).toEqual(published.nouns);
    expect(published.wordlist_version).toBe(WORDLIST_VERSION);
  });

  it("is bounded by the lists: every target is a list word, no variant is", () => {
    const adj = new Set(ADJECTIVES);
    const noun = new Set(NOUNS);
    for (const [variant, target] of Object.entries(VARIANT_ADJECTIVES)) {
      expect(adj.has(target), target).toBe(true);
      expect(adj.has(variant) || noun.has(variant), variant).toBe(false);
    }
    for (const [variant, target] of Object.entries(VARIANT_NOUNS)) {
      expect(noun.has(target), target).toBe(true);
      expect(adj.has(variant) || noun.has(variant), variant).toBe(false);
    }
  });

  it("the meter case: the fuzzy path would land on a different list word", () => {
    // Levenshtein (the fuzzy path's metric) puts "meteor" one edit away and
    // "metre" two, so without the table "meter" would correct to "meteor".
    expect(editDistance("meter", "meteor")).toBe(1);
    expect(editDistance("meter", "metre")).toBe(2);
    expect(NOUNS.includes("meteor")).toBe(true);
    expect(canonicalSpelling("meter")).toBe("metre");
  });

  it("leaves non-variants alone and lower-cases", () => {
    expect(canonicalSpelling("otter")).toBe("otter");
    expect(canonicalSpelling("Donut")).toBe("doughnut");
  });
});
