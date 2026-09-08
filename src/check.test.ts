// Copyright 2026 SQRS. Licensed under the Apache License, Version 2.0.

import { describe, expect, it } from "vitest";
import {
  CHECK_P_CHAR,
  CHECK_P_FULL,
  CHECK_P_WORD,
  CHECK_CHAR_ALPHABET,
  checkChar,
  checkValue,
  checkWord,
  verifyCheck,
} from "./check.js";
import { encode, format, parse } from "./grid.js";
import { ADJECTIVES, NOUNS } from "./wordlist.js";

const ID = encode(51.5205, -0.21);

describe("checkValue", () => {
  it("is deterministic and in range", () => {
    const v = checkValue(ID)!;
    expect(v).toBe(checkValue(ID));
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(CHECK_P_FULL);
  });

  it("is null for invalid names", () => {
    expect(checkValue({ sector: "notaword", patch: ID.patch, spot: 1 })).toBeNull();
    expect(checkValue({ sector: ID.sector, patch: ID.patch, spot: 0 })).toBeNull();
    expect(checkValue({ sector: ID.sector, patch: ID.patch, spot: 26 })).toBeNull();
  });

  it("detects every single-part spot error at P_FULL", () => {
    const base = checkValue(ID)!;
    for (let s = 1; s <= 25; s++) {
      if (s === ID.spot) continue;
      expect(checkValue({ ...ID, spot: s }), `spot ${s}`).not.toBe(base);
    }
  });

  it("detects wrong-but-valid word swaps at P_FULL (sampled)", () => {
    const base = checkValue(ID)!;
    for (let i = 0; i < ADJECTIVES.length; i += 97) {
      const sector = ADJECTIVES[i];
      if (sector === ID.sector) continue;
      expect(checkValue({ ...ID, sector }), sector).not.toBe(base);
    }
    for (let i = 0; i < NOUNS.length; i += 131) {
      const patch = NOUNS[i];
      if (patch === ID.patch) continue;
      expect(checkValue({ ...ID, patch }), patch).not.toBe(base);
    }
  });
});

describe("checkChar", () => {
  it("is a single char from the confusion-safe alphabet", () => {
    const c = checkChar(ID)!;
    expect(c).toHaveLength(1);
    expect(c).toMatch(/^[0-9abcdefghjkmnpqrstvwxy]$/);
    expect(CHECK_CHAR_ALPHABET).toBe("0123456789abcdefghjkmnpqrstvwxy");
  });

  it("catches every single spot error (Δ ≤ 24 < 31)", () => {
    const base = checkChar(ID)!;
    for (let s = 1; s <= 25; s++) {
      if (s === ID.spot) continue;
      expect(checkChar({ ...ID, spot: s }), `spot ${s}`).not.toBe(base);
    }
  });
});

describe("checkWord", () => {
  it("is a noun from the list, always in range", () => {
    const w = checkWord(ID)!;
    expect(NOUNS.includes(w)).toBe(true);
    expect(NOUNS.indexOf(w)).toBeLessThan(CHECK_P_WORD);
  });

  it("is null for invalid names", () => {
    expect(checkWord({ sector: "notaword", patch: ID.patch, spot: 1 })).toBeNull();
    expect(checkWord({ sector: ID.sector, patch: ID.patch, spot: 0 })).toBeNull();
  });

  it("detects every wrong spot (Δ ≤ 24 < 3121)", () => {
    const base = checkWord(ID)!;
    for (let s = 1; s <= 25; s++) {
      if (s === ID.spot) continue;
      expect(checkWord({ ...ID, spot: s }), `spot ${s}`).not.toBe(base);
    }
  });

  it("detects wrong-but-valid word swaps (sampled)", () => {
    const base = checkWord(ID)!;
    for (let i = 0; i < ADJECTIVES.length; i += 97) {
      const sector = ADJECTIVES[i];
      if (sector !== ID.sector) expect(checkWord({ ...ID, sector }), sector).not.toBe(base);
    }
    for (let i = 0; i < NOUNS.length; i += 131) {
      const patch = NOUNS[i];
      if (patch !== ID.patch) expect(checkWord({ ...ID, patch }), patch).not.toBe(base);
    }
  });
});

describe("verifyCheck", () => {
  it("accepts the correct char, word, and value tokens", () => {
    expect(verifyCheck(ID, checkChar(ID)!)).toBe(true);
    expect(verifyCheck(ID, checkWord(ID)!)).toBe(true);
    expect(verifyCheck(ID, String(checkValue(ID)!).padStart(2, "0"))).toBe(true);
    expect(verifyCheck(ID, ` ${checkChar(ID)!.toUpperCase()} `)).toBe(true);
    expect(verifyCheck(ID, `  ${checkWord(ID)!.toUpperCase()}  `)).toBe(true);
  });

  it("rejects a wrong token, an invalid name, and garbage", () => {
    const other = { ...ID, spot: ID.spot === 1 ? 2 : 1 };
    expect(verifyCheck(ID, checkChar(other)!)).toBe(false);
    expect(verifyCheck(ID, checkWord(other)!)).toBe(false);
    expect(verifyCheck({ sector: "notaword", patch: ID.patch, spot: 3 }, "a")).toBe(false);
    expect(verifyCheck({ sector: "notaword", patch: ID.patch, spot: 3 }, "otter")).toBe(false);
    expect(verifyCheck(ID, "!!")).toBe(false);
    expect(verifyCheck(ID, "")).toBe(false);
  });

  it("reads a lone digit as a check char, never as a value", () => {
    // Walk spots until the check char is a digit (10 of 31 values are).
    const base = { region: "51n1w-d3", sector: "brave", patch: "otter" };
    const spot = [...Array(25).keys()].map((i) => i + 1).find((n) => /\d/.test(checkChar({ ...base, spot: n })!))!;
    const id = { ...base, spot };
    expect(verifyCheck(id, checkChar(id)!)).toBe(true);
    // The same digit as a value would be a different (two-digit) string.
    expect(verifyCheck(id, checkChar(id)!.padStart(2, "0"))).toBe(Number(checkChar(id)) === checkValue(id));
  });
});

describe("format / parse with a check", () => {
  it("format appends the check char only when asked", () => {
    expect(format(ID)).not.toMatch(/\.\w$/);
    expect(format(ID, { check: "char" })).toBe(`${format(ID)}.${checkChar(ID)}`);
  });

  it("format appends a check word when asked", () => {
    expect(format(ID, { check: "word" })).toBe(`${format(ID)}.${checkWord(ID)}`);
  });

  it("parse reads the optional trailing check (char) and round-trips", () => {
    const parsed = parse(format(ID, { check: "char" }))!;
    expect(parsed.check).toBe(checkChar(ID));
    expect(verifyCheck(parsed, parsed.check!)).toBe(true);
    expect({ ...parsed, check: undefined }).toEqual({ ...ID, check: undefined });
  });

  it("parse reads a trailing check word and round-trips", () => {
    const parsed = parse(format(ID, { check: "word" }))!;
    expect(parsed.check).toBe(checkWord(ID));
    expect(verifyCheck(parsed, parsed.check!)).toBe(true);
    expect({ ...parsed, check: undefined }).toEqual({ ...ID, check: undefined });
  });

  it("reads a check word on the legacy three-token form", () => {
    const s = `${ID.region} ${ID.sector}-${ID.patch} ${ID.spot} ${checkWord(ID)}`;
    const parsed = parse(s)!;
    expect(parsed.check).toBe(checkWord(ID));
    expect({ ...parsed, check: undefined }).toEqual({ ...ID, check: undefined });
  });

  it("names without a check still parse identically", () => {
    const parsed = parse(format(ID))!;
    expect(parsed.check).toBeUndefined();
    expect(parsed).toEqual(ID);
  });

  it("a middot-styled string with a check parses too", () => {
    const c = checkChar(ID)!;
    expect(parse(`${ID.region} · ${ID.sector} · ${ID.patch} · ${ID.spot} · ${c}`)?.check).toBe(c);
  });

  it("reads a digit check char as the check, not as the spot", () => {
    expect(parse("51n1w-d3.brave.otter.7.3")).toEqual({
      region: "51n1w-d3",
      sector: "brave",
      patch: "otter",
      spot: 7,
      check: "3",
    });
    expect(parse("51n1w-d3.brave.otter.7.1234")).toEqual({
      region: "51n1w-d3",
      sector: "brave",
      patch: "otter",
      spot: 7,
      check: "1234",
    });
    expect(parse("51n1w-d3 brave-otter 7 3")).toEqual({
      region: "51n1w-d3",
      sector: "brave",
      patch: "otter",
      spot: 7,
      check: "3",
    });
  });

  it("round-trips every check presentation for a name whose char is a digit", () => {
    const base = { region: "51n1w-d3", sector: "brave", patch: "otter" };
    const spot = [...Array(25).keys()].map((i) => i + 1).find((n) => /\d/.test(checkChar({ ...base, spot: n })!))!;
    const id = { ...base, spot };
    for (const form of ["char", "word"] as const) {
      const parsed = parse(format(id, { check: form }))!;
      expect(parsed.check).toBeDefined();
      expect(verifyCheck(parsed, parsed.check!)).toBe(true);
    }
  });

  it("still rejects a fifth token on the legacy form and a sixth on canonical", () => {
    expect(parse("51n1w-d3 brave-otter 7 3 extra")).toBeNull();
    expect(parse("51n1w-d3.brave.otter.7.k.extra")).toBeNull();
  });
});

describe("prime/weight sanity", () => {
  const isPrime = (n: number) => {
    for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
    return n > 1;
  };
  it("P values are prime and weights coprime to them", () => {
    for (const p of [CHECK_P_FULL, CHECK_P_CHAR, CHECK_P_WORD]) {
      expect(isPrime(p), String(p)).toBe(true);
      for (const w of [7, 3, 5]) expect(p % w).not.toBe(0);
    }
  });
  it("P_FULL exceeds the largest single-component delta (3135)", () => {
    expect(CHECK_P_FULL).toBeGreaterThan(3135);
  });
  it("P_WORD is the largest prime that fits the noun list", () => {
    expect(CHECK_P_WORD).toBeLessThanOrEqual(NOUNS.length);
    for (let n = CHECK_P_WORD + 1; n <= NOUNS.length; n++) expect(isPrime(n), String(n)).toBe(false);
  });
});
