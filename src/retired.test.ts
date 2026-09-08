// Copyright 2026 SQRS. Licensed under the Apache License, Version 2.0.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { RETIRED_ADJECTIVES, RETIRED_NOUNS, currentWord } from "./retired.js";
import { ADJECTIVES, NOUNS, WORDLIST_VERSION } from "./wordlist.js";

const published = JSON.parse(readFileSync(new URL("../spec/retired-words.json", import.meta.url), "utf8"));

describe("retired words table", () => {
  it("matches the published table, index by index", () => {
    expect(published.wordlist_version).toBe(WORDLIST_VERSION);
    expect(Object.keys(published.adjectives).sort()).toEqual(Object.keys(RETIRED_ADJECTIVES).sort());
    expect(Object.keys(published.nouns).sort()).toEqual(Object.keys(RETIRED_NOUNS).sort());
    for (const [old, e] of Object.entries(published.adjectives) as [string, { current: string; index: number }][]) {
      expect(RETIRED_ADJECTIVES[old]).toBe(e.current);
      expect(ADJECTIVES[e.index]).toBe(e.current);
    }
    for (const [old, e] of Object.entries(published.nouns) as [string, { current: string; index: number }][]) {
      expect(RETIRED_NOUNS[old]).toBe(e.current);
      expect(NOUNS[e.index]).toBe(e.current);
    }
  });

  it("no retired word is in either list, and every current word is", () => {
    const adj = new Set(ADJECTIVES), noun = new Set(NOUNS);
    for (const [old, cur] of Object.entries(RETIRED_ADJECTIVES)) {
      expect(adj.has(old) || noun.has(old), old).toBe(false);
      expect(adj.has(cur), cur).toBe(true);
    }
    for (const [old, cur] of Object.entries(RETIRED_NOUNS)) {
      expect(adj.has(old) || noun.has(old), old).toBe(false);
      expect(noun.has(cur), cur).toBe(true);
    }
  });

  it("is empty at the first published wordlist", () => {
    expect(WORDLIST_VERSION).toBe("1.0.0");
    expect(Object.keys(RETIRED_ADJECTIVES)).toHaveLength(0);
    expect(Object.keys(RETIRED_NOUNS)).toHaveLength(0);
    expect(currentWord("otter")).toBe("otter");
  });
});
