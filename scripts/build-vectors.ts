// Copyright 2026 SQRS. Licensed under the Apache License, Version 2.0.

/**
 * Generates spec/test-vectors.json from the reference implementation, so a
 * second implementation can prove itself against numbers rather than prose.
 * Every vector is a coordinate chosen to sit on an edge the maths has to get
 * right: the 1° latitude-band seams, the 0.2° region-tile edges, the equator,
 * the prime meridian, the antimeridian, both hemispheres, the Mercator clamp
 * at ±85°, and ordinary places.
 *
 * Each vector carries the encode result, every canonical string form, the
 * three check-token presentations, and the decode point with its ground
 * distance from the input, asserted here to be inside the 3 m spot (< 2.13 m,
 * half the spot diagonal), so the file is self-checking at generation time.
 *
 *   pnpm vectors
 */
import { writeFileSync } from "node:fs";
import { encode, decode, format, parse, regionCodeAt } from "../src/grid.js";
import { checkValue, checkChar, checkWord, verifyCheck } from "../src/check.js";
import { WORDLIST_VERSION } from "../src/wordlist.js";

const RAD = Math.PI / 180;
const groundM = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * RAD;
  const dLng = (b.lng - a.lng) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const cases: { name: string; lat: number; lng: number; why: string }[] = [
  { name: "london-notting-hill", lat: 51.5152, lng: -0.205, why: "an ordinary northern-hemisphere, western-longitude point" },
  { name: "london-greenwich-meridian", lat: 51.4779, lng: 0.0, why: "exactly on the prime meridian — lng 0 is the first column of an east region" },
  { name: "london-just-west-of-meridian", lat: 51.4779, lng: -0.0000001, why: "one step west of lng 0 — must land in a west region, not wrap" },
  { name: "band-seam-below-51n", lat: 50.9999999, lng: -0.2, why: "just under a 1° band seam — the lattice is the 50° band's" },
  { name: "band-seam-at-51n", lat: 51.0, lng: -0.2, why: "exactly on the seam — belongs to the 51° band (floor)" },
  { name: "band-seam-above-51n", lat: 51.0000001, lng: -0.2, why: "just over the seam — the 51° band's lattice, recalibrated size" },
  { name: "region-edge-lat-51.2-below", lat: 51.1999999, lng: -0.2, why: "just under a 0.2° region-tile edge (rank boundary)" },
  { name: "region-edge-lat-51.2-exact", lat: 51.2, lng: -0.2, why: "exactly on the tile edge — belongs to the tile it opens" },
  { name: "region-edge-lng-0.2-exact", lat: 51.5, lng: -0.2, why: "exactly on a 0.2° longitude tile edge (file boundary)" },
  { name: "region-edge-lng-0.2-west", lat: 51.5, lng: -0.2000001, why: "just west of that edge — previous file" },
  { name: "equator-north", lat: 0.0000001, lng: 36.8219, why: "just north of the equator (Nairobi longitude) — the 0° band" },
  { name: "equator-exact", lat: 0.0, lng: 36.8219, why: "exactly on the equator — floor puts it in the 0° band, region 0n36e" },
  { name: "equator-south", lat: -0.0000001, lng: 36.8219, why: "just south — the -1° band, region 1s (degree cell -1, rank 5)" },
  { name: "sydney", lat: -33.8688, lng: 151.2093, why: "southern hemisphere, eastern longitude" },
  { name: "new-york", lat: 40.7128, lng: -74.006, why: "western hemisphere, mid latitude" },
  { name: "sao-paulo", lat: -23.5505, lng: -46.6333, why: "south and west" },
  { name: "antimeridian-east-side", lat: 51.5, lng: 179.9999999, why: "just west of the antimeridian — the last east column (179e-e5)" },
  { name: "antimeridian-west-side", lat: 51.5, lng: -179.9999999, why: "just east of the antimeridian — the first west column (180w-a?)" },
  { name: "antimeridian-exact-plus", lat: 51.5, lng: 180.0, why: "lng +180 exactly — wraps to the column of -180 (mod 1800)" },
  { name: "tromso", lat: 69.6496, lng: 18.956, why: "high northern latitude — large band scale" },
  { name: "mcmurdo", lat: -77.8419, lng: 166.6863, why: "high southern latitude" },
  { name: "mercator-clamp-north", lat: 85.0, lng: 10.0, why: "the Mercator clamp at +85° — the last encodable band" },
  { name: "mercator-clamp-south", lat: -85.0, lng: 10.0, why: "the Mercator clamp at -85°" },
  { name: "degree-corner-52n1e", lat: 52.0, lng: 1.0, why: "an exact integer degree corner — region 52n1e-a1" },
  { name: "degree-corner-52n1w-side", lat: 52.0, lng: -1.0, why: "an exact integer degree corner on the west side — region 52n1w-a1" },
];

const vectors = cases.map((c) => {
  const id = encode(c.lat, c.lng);
  const canonical = format(id);
  const withChar = format(id, { check: "char" });
  const withWord = format(id, { check: "word" });
  const decoded = decode(id);
  if (!decoded) throw new Error(`${c.name}: decode failed`);
  const err = groundM({ lat: c.lat, lng: c.lng }, decoded);
  // Half the diagonal of a 3 m spot is 2.12 m; the decode point must be
  // inside the spot the input fell in.
  if (err > 2.13) throw new Error(`${c.name}: decode point ${err.toFixed(3)} m from input`);
  // Re-encoding the decode point reproduces the name, always: decode returns
  // a point inside the cell ∩ region tile, so a cell that straddles a band
  // seam or a tile edge still hands back a point on the right side (spec §5).
  const reencoded = format(encode(decoded.lat, decoded.lng));
  if (reencoded !== canonical) throw new Error(`${c.name}: re-encode of the decode point differs`);
  const parsedChar = parse(withChar);
  const parsedWord = parse(withWord);
  if (!parsedChar?.check || !verifyCheck(parsedChar, parsedChar.check)) throw new Error(`${c.name}: char check`);
  if (!parsedWord?.check || !verifyCheck(parsedWord, parsedWord.check)) throw new Error(`${c.name}: word check`);
  if (regionCodeAt(c.lat, c.lng) !== id.region) throw new Error(`${c.name}: region mismatch`);
  return {
    name: c.name,
    why: c.why,
    input: { lat: c.lat, lng: c.lng },
    id: { region: id.region, sector: id.sector, patch: id.patch, spot: id.spot },
    canonical,
    canonical_with_check_char: withChar,
    canonical_with_check_word: withWord,
    check: { value: checkValue(id), char: checkChar(id), word: checkWord(id) },
    decode_point: { lat: Number(decoded.lat.toFixed(9)), lng: Number(decoded.lng.toFixed(9)) },
    decode_error_m: Number(err.toFixed(3)),
    reencoded,
  };
});

// Parse tolerance and rejection — the grammar (spec §6.3), as vectors.
const parseVectors = [
  { input: "51n1w-d3.brave.otter.7", expect: "accept", note: "canonical dots" },
  { input: "51n1w-d3 · brave · otter · 7", expect: "accept", note: "display middots" },
  { input: "51n1w-d3 brave otter 7", expect: "accept", note: "whitespace" },
  { input: "51N1W-D3.Brave.OTTER.7", expect: "accept", note: "case-insensitive" },
  { input: "51n1w-d3.brave.otter.7.6", expect: "accept", note: "trailing one-char check token (parsed, not verified)" },
  { input: "51n1w-d3.brave.otter.7.finch", expect: "accept", note: "trailing check word (parsed, not verified)" },
  { input: "51n1w-d3 · brave-otter · 7", expect: "accept", note: "legacy three-token form with a hyphenated middle pair" },
  { input: "camden.brave.otter.7", expect: "accept", note: "an alias region parses; resolution of the alias is overlay data, not spec" },
  { input: "brave.otter.7", expect: "reject", note: "three tokens without a hyphenated pair — not a squarename" },
  { input: "51n1w-d3.brave.otter.0", expect: "reject", note: "spot below 1" },
  { input: "51n1w-d3.brave.otter.26", expect: "reject", note: "spot above 25" },
  { input: "51n1w-d3.brave.otter", expect: "reject", note: "missing spot" },
  { input: "51n1w-d3.brave.otter.7.k.extra", expect: "reject", note: "too many tokens" },
].map((p) => ({ ...p, parsed: parse(p.input) }));
for (const p of parseVectors) {
  const ok = p.expect === "accept" ? p.parsed !== null : p.parsed === null;
  if (!ok) throw new Error(`parse vector "${p.input}" expected ${p.expect}`);
}

const out = {
  spec: "Squarenames v1",
  generated_at: new Date().toISOString(),
  generator: "scripts/build-vectors.ts against the reference implementation (src/)",
  wordlist_version: WORDLIST_VERSION,
  tolerance:
    "the decode point must lie within 2.13 m (half a spot diagonal) of the input, and encoding it must reproduce the name exactly (spec §5)",
  vectors,
  parse: parseVectors,
};
const file = new URL("../spec/test-vectors.json", import.meta.url);
writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
console.log(`${vectors.length} coordinate vectors + ${parseVectors.length} parse vectors → ${file.pathname}`);
for (const v of vectors) console.log(`  ${v.name.padEnd(34)} ${v.canonical_with_check_word}  (${v.decode_error_m} m)`);
