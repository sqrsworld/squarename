// Copyright 2026 SQRS. Licensed under the Apache License, Version 2.0.

// The retired-words mechanism (spec §10.2), exercised with a synthetic table
// so it is proven even while the published table is empty.
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";

// The synthetic entries point at the words of a published vector, so the
// name they stand in for is one that a real point encodes to.
const VECTOR = JSON.parse(readFileSync(new URL("../spec/test-vectors.json", import.meta.url), "utf8")).vectors[0];

vi.mock("./retired.js", async () => {
  const { NOUNS } = await import("./wordlist.js");
  const v = JSON.parse(readFileSync(new URL("../spec/test-vectors.json", import.meta.url), "utf8")).vectors[0];
  const RETIRED_ADJECTIVES: Record<string, string> = { zzzold: v.id.sector };
  const RETIRED_NOUNS: Record<string, string> = { zzzgone: v.id.patch, zzzcheck: NOUNS[0] };
  return {
    RETIRED_ADJECTIVES,
    RETIRED_NOUNS,
    currentWord: (w: string) => RETIRED_ADJECTIVES[w] ?? RETIRED_NOUNS[w] ?? w,
  };
});

const { encode, decode, format, parse } = await import("./grid.js");
const { checkWord, verifyCheck } = await import("./check.js");
const { resolveWordDetailed, suggestWords } = await import("./resolve.js");
const { resolve } = await import("./alias.js");
const { ADJECTIVES, NOUNS } = await import("./wordlist.js");

describe("retired words mechanism", () => {
  const cur = { ...VECTOR.id };

  it("a name written with a retired word decodes to the same square", () => {
    const p = decode(cur)!;
    expect(p).not.toBeNull();
    expect(decode({ ...cur, sector: "zzzold" })).toEqual(p);
    expect(decode({ ...cur, patch: "zzzgone" })).toEqual(p);
    expect(decode({ ...cur, sector: "zzzold", patch: "zzzgone" })).toEqual(p);
    expect(resolve(`${cur.region}.zzzold.zzzgone.${cur.spot}`)).toEqual([{ region: cur.region, ...p }]);
  });

  it("encoding the decode point names the current words, never the retired ones", () => {
    const p = decode({ ...cur, sector: "zzzold", patch: "zzzgone" })!;
    expect(encode(p.lat, p.lng)).toEqual(cur);
    expect(format(encode(p.lat, p.lng))).not.toContain("zzz");
  });

  it("a retired check word still verifies", () => {
    // Find a name whose check word is NOUNS[0], the current word for "zzzcheck".
    let id = cur;
    outer: for (let lat = 51; lat < 52; lat += 0.0137) for (let lng = -1; lng < 0; lng += 0.0113) {
      const c = encode(lat, lng);
      if (checkWord(c) === NOUNS[0]) { id = c; break outer; }
    }
    expect(checkWord(id)).toBe(NOUNS[0]);
    expect(verifyCheck(id, "zzzcheck")).toBe(true);
    const parsed = parse(`${format(id)}.zzzcheck`)!;
    expect(verifyCheck(parsed, parsed.check!)).toBe(true);
    // A retired sector word in the name checks as its replacement.
    expect(verifyCheck({ ...cur, sector: "zzzold" }, checkWord(cur)!)).toBe(true);
  });

  it("input resolution reports a retired word as such", () => {
    expect(resolveWordDetailed("zzzold", ADJECTIVES)).toEqual({ word: cur.sector, distance: 0, retiredFrom: "zzzold" });
    expect(suggestWords("zzzgone", NOUNS, 3)[0]).toBe(cur.patch);
  });
});
