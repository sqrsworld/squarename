// Copyright 2026 SQRS. Licensed under the Apache License, Version 2.0.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { VARIANT_ADJECTIVES, VARIANT_NOUNS, canonicalSpelling } from "./variants.js";
import { ADJECTIVES, NOUNS, WORDLIST_VERSION } from "./wordlist.js";
import { editDistance, resolveWordDetailed } from "./resolve.js";
import { RETIRED_ADJECTIVES, RETIRED_NOUNS } from "./retired.js";

const published = JSON.parse(readFileSync(new URL("../spec/variant-spellings.json", import.meta.url), "utf8"));

describe("recognised variant spellings", () => {
  it("matches the published table", () => {
    expect(VARIANT_ADJECTIVES).toEqual(published.adjectives);
    expect(VARIANT_NOUNS).toEqual(published.nouns);
    expect(published.wordlist_version).toBe(WORDLIST_VERSION);
  });

  it("is bounded by the lists: every target is a list or retired word, no variant is a list word", () => {
    const adj = new Set(ADJECTIVES);
    const noun = new Set(NOUNS);
    for (const [variant, target] of Object.entries(VARIANT_ADJECTIVES)) {
      expect(adj.has(target) || target in RETIRED_ADJECTIVES, target).toBe(true);
      expect(adj.has(variant) || noun.has(variant), variant).toBe(false);
    }
    for (const [variant, target] of Object.entries(VARIANT_NOUNS)) {
      expect(noun.has(target) || target in RETIRED_NOUNS, target).toBe(true);
      expect(adj.has(variant) || noun.has(variant), variant).toBe(false);
    }
  });

  it("a variant of a retired word resolves in two exact steps (caliber → calibre → diagram)", () => {
    expect(canonicalSpelling("caliber")).toBe("calibre");
    const m = resolveWordDetailed("caliber", NOUNS);
    expect(m?.word).toBe("diagram");
    expect(m?.distance).toBe(0);
    expect(m?.variantOf).toBe("caliber");
    expect(m?.retiredFrom).toBe("calibre");
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
