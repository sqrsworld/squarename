// Copyright 2026 SQRS. Licensed under the Apache License, Version 2.0.

import { describe, it, expect } from "vitest";
import { editDistance, suggestWords, resolveWord, resolveWordDetailed, parsePartial } from "./resolve.js";
import { NOUNS } from "./wordlist.js";

describe("fuzzy matching", () => {
  const words = ["spongy", "gorgeous", "grand", "unmixed", "flyable"];
  it.each([
    ["spongy", "spongey", 1],
    ["dragon", "dragoon", 1],
    ["cat", "cat", 0],
    ["ab", "abcd", 2],
  ])("editDistance(%s,%s) = %i", (a, b, d) => {
    expect(editDistance(a, b)).toBe(d);
  });
  it("editDistance early-exits past max", () => {
    expect(editDistance("abcdef", "uvwxyz", 2)).toBeGreaterThan(2);
  });
  it("suggestWords prefers prefix matches", () => {
    expect(suggestWords("gor", words, 6)).toEqual(["gorgeous"]);
  });
  it("suggestWords falls back to fuzzy when no prefix (autocorrect case)", () => {
    expect(suggestWords("spongey", words, 6)).toEqual(["spongy"]);
  });
  it("suggestWords ignores tiny non-prefix fragments", () => {
    expect(suggestWords("zz", words, 6)).toEqual([]);
  });
  it("resolveWord maps a near-miss to the canonical word", () => {
    expect(resolveWord("spongey", words)).toBe("spongy");
    expect(resolveWord("grand", words)).toBe("grand");
    expect(resolveWord("banana", words)).toBeNull();
  });
  it("resolveWordDetailed reports the edit distance (0 = exact, ≥1 = corrected)", () => {
    expect(resolveWordDetailed("grand", words)).toEqual({ word: "grand", distance: 0 });
    expect(resolveWordDetailed("spongey", words)).toEqual({ word: "spongy", distance: 1 });
    expect(resolveWordDetailed("banana", words)).toBeNull();
    expect(resolveWordDetailed("GRAND", words)).toEqual({ word: "grand", distance: 0 });
  });
});

describe("recognised variant spellings come before fuzzy correction", () => {
  it("resolves a variant as exact, flagged, not as a correction", () => {
    expect(resolveWordDetailed("meter", NOUNS)).toEqual({ word: "metre", distance: 0, variantOf: "meter" });
    expect(resolveWord("meter", NOUNS)).toBe("metre");
    // Without the table the fuzzy path would pick "meteor" (one edit) over
    // "metre" (two, under Levenshtein).
    expect(editDistance("meter", "meteor")).toBe(1);
    expect(editDistance("meter", "metre")).toBe(2);
  });
  it("resolves variants beyond fuzzy reach", () => {
    expect(resolveWord("donut", NOUNS)).toBe("doughnut");
    expect(resolveWord("omelet", NOUNS)).toBe("omelette");
  });
  it("suggests from the canonical spelling of a variant", () => {
    expect(suggestWords("donut", NOUNS, 3)).toEqual(["doughnut"]);
  });
});

describe("parsePartial", () => {
  it.each([
    ["", 0, null, null, ""],
    ["fl", 0, null, null, "fl"],
    ["flyable", 0, null, null, "flyable"],
    ["flyable ", 1, "flyable", null, ""],
    ["flyable dr", 1, "flyable", null, "dr"],
    ["flyable dragon", 1, "flyable", null, "dragon"],
    ["flyable dragon ", 2, "flyable", "dragon", ""],
    ["flyable dragon 1", 2, "flyable", "dragon", "1"],
    ["flyable-dragon-11", 2, "flyable", "dragon", "11"],
  ])("parses %j", (q, stage, sector, patch, partial) => {
    const p = parsePartial(q as string);
    expect(p.stage).toBe(stage);
    expect(p.sector).toBe(sector);
    expect(p.patch).toBe(patch);
    expect(p.partial).toBe(partial);
  });
});
