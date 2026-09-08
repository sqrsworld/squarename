// Copyright 2026 SQRS. Licensed under the Apache License, Version 2.0.

// Conformance (spec §12): every published test vector reproduced by this
// implementation, exactly as recorded.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { encode, decode, format, parse, regionCodeAt } from "../src/grid.js";
import { checkValue, checkChar, checkWord, verifyCheck } from "../src/check.js";
import { WORDLIST_VERSION } from "../src/wordlist.js";

interface Vector {
  name: string;
  input: { lat: number; lng: number };
  id: { region: string; sector: string; patch: string; spot: number };
  canonical: string;
  canonical_with_check_char: string;
  canonical_with_check_word: string;
  check: { value: number; char: string; word: string };
  decode_point: { lat: number; lng: number };
  decode_error_m: number;
  reencoded: string;
}
interface ParseVector {
  input: string;
  expect: "accept" | "reject";
}

const file = JSON.parse(readFileSync(new URL("./test-vectors.json", import.meta.url), "utf8")) as {
  wordlist_version: string;
  vectors: Vector[];
  parse: ParseVector[];
};

const RAD = Math.PI / 180;
const groundM = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * RAD;
  const dLng = (b.lng - a.lng) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

describe("published test vectors", () => {
  it("were generated for the shipped wordlist version", () => {
    expect(file.wordlist_version).toBe(WORDLIST_VERSION);
  });

  it.each(file.vectors.map((v) => [v.name, v] as const))("%s", (_name, v) => {
    const id = encode(v.input.lat, v.input.lng);
    expect(id).toEqual(v.id);
    expect(format(id)).toBe(v.canonical);
    expect(format(id, { check: "char" })).toBe(v.canonical_with_check_char);
    expect(format(id, { check: "word" })).toBe(v.canonical_with_check_word);
    expect(checkValue(id)).toBe(v.check.value);
    expect(checkChar(id)).toBe(v.check.char);
    expect(checkWord(id)).toBe(v.check.word);
    expect(verifyCheck(id, v.check.char)).toBe(true);
    expect(verifyCheck(id, v.check.word)).toBe(true);
    expect(regionCodeAt(v.input.lat, v.input.lng)).toBe(v.id.region);

    const p = decode(id)!;
    expect(p).not.toBeNull();
    expect(p.lat).toBeCloseTo(v.decode_point.lat, 8);
    expect(p.lng).toBeCloseTo(v.decode_point.lng, 8);
    expect(groundM(v.input, p)).toBeLessThan(2.13);
    expect(format(encode(p.lat, p.lng))).toBe(v.reencoded);
    expect(v.reencoded).toBe(v.canonical);
  });

  it.each(file.parse.map((p) => [p.input, p.expect] as const))("parse %j → %s", (input, expected) => {
    const parsed = parse(input);
    if (expected === "accept") expect(parsed).not.toBeNull();
    else expect(parsed).toBeNull();
  });
});
