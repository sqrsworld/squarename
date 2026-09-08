// Copyright 2026 SQRS. Licensed under the Apache License, Version 2.0.

import { describe, expect, it } from "vitest";
import { damerau, wordlistConflicts } from "./conflicts.js";
import { ADJECTIVES, NOUNS } from "../src/wordlist.js";

describe("damerau distance", () => {
  it.each([
    ["home", "homes", 1], // insert
    ["low", "slow", 1], // insert
    ["wide", "wise", 1], // substitute
    ["circus", "cirrus", 1], // substitute
    ["night", "knight", 1], // insert
    ["form", "from", 1], // adjacent transpose
    ["bare", "bear", 2],
    ["otter", "otter", 0],
    ["brave", "otter", 5],
  ])("d(%s, %s) = %i", (a, b, want) => {
    expect(damerau(a as string, b as string)).toBe(want);
    expect(damerau(b as string, a as string)).toBe(want);
  });
});

describe("wordlistConflicts", () => {
  it("flags edit-distance-1 pairs", () => {
    expect(wordlistConflicts(["armful", "harmful", "otter", "bridge"])).toEqual([
      { pair: ["armful", "harmful"], reason: "edit1" },
    ]);
  });

  it("flags adjacent transpositions (Damerau, not plain Levenshtein)", () => {
    expect(wordlistConflicts(["form", "from", "table"])).toEqual([{ pair: ["form", "from"], reason: "edit1" }]);
  });

  it("flags homophones that edit distance misses", () => {
    expect(wordlistConflicts(["bare", "bear", "lamp"])).toEqual([{ pair: ["bare", "bear"], reason: "homophone" }]);
  });

  it("does not flag phonetically bucketed but clearly distinct words", () => {
    expect(wordlistConflicts(["accurate", "awkward"])).toEqual([]);
    expect(wordlistConflicts(["afraid", "everyday"])).toEqual([]);
  });

  it("passes a clean list", () => {
    expect(wordlistConflicts(["brave", "otter", "bridge", "market", "lantern"])).toEqual([]);
  });

  it("reports each pair once", () => {
    expect(wordlistConflicts(["home", "homes"])).toHaveLength(1);
  });
});

describe("shipped wordlists are conflict-free (spec §3.3, §12.3)", () => {
  it("ADJECTIVES have zero conflicts", () => {
    expect(wordlistConflicts(ADJECTIVES)).toEqual([]);
  });

  it("NOUNS have zero conflicts", () => {
    expect(wordlistConflicts(NOUNS)).toEqual([]);
  });
});
