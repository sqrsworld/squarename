// Copyright 2026 SQRS. Licensed under the Apache License, Version 2.0.

import { describe, it, expect } from "vitest";
import {
  encode,
  decode,
  format,
  parse,
  squarenameAt,
  regionCodeAt,
  isRegionCode,
  spotRing,
  patchRing,
  sectorRing,
  patchInstancesInBox,
} from "./grid.js";
import { ADJECTIVES, NOUNS } from "./wordlist.js";

const LONDON = { lat: 51.5205, lng: -0.21 };
const CHICAGO = { lat: 41.8781, lng: -87.6298 };

describe("square rings", () => {
  const ringHeightM = (ring: [number, number][]) => {
    const lats = ring.map((p) => p[1]);
    return (Math.max(...lats) - Math.min(...lats)) * 111320;
  };

  it("is a closed ~3 m square containing the point", () => {
    const ring = spotRing(LONDON.lat, LONDON.lng);
    expect(ring).toHaveLength(5);
    expect(ring[0]).toEqual(ring[4]); // closed
    const hM = ringHeightM(ring);
    expect(hM).toBeGreaterThan(2.5);
    expect(hM).toBeLessThan(3.5);
    // same 3 m cell for the input and the ring's centre
    const lats = ring.map((p) => p[1]);
    const cLat = (Math.max(...lats) + Math.min(...lats)) / 2;
    const cLng = (Math.max(...ring.map((p) => p[0])) + Math.min(...ring.map((p) => p[0]))) / 2;
    expect(encode(cLat, cLng)).toEqual(encode(LONDON.lat, LONDON.lng));
  });

  it.each([
    ["patch", patchRing, 15],
    ["sector", sectorRing, 840],
  ] as const)("%s ring is a closed ~%d m ground square", (_label, ringFn, groundM) => {
    const ring = ringFn(LONDON.lat, LONDON.lng);
    expect(ring).toHaveLength(5);
    expect(ring[0]).toEqual(ring[4]);
    expect(ringHeightM(ring)).toBeGreaterThan(groundM * 0.85);
    expect(ringHeightM(ring)).toBeLessThan(groundM * 1.15);
  });

  it("nests: the patch ring sits inside the sector ring; the spot inside the patch", () => {
    const bbox = (r: [number, number][]) => ({
      w: Math.min(...r.map((c) => c[0])),
      e: Math.max(...r.map((c) => c[0])),
      s: Math.min(...r.map((c) => c[1])),
      n: Math.max(...r.map((c) => c[1])),
    });
    const spot = bbox(spotRing(LONDON.lat, LONDON.lng));
    const patch = bbox(patchRing(LONDON.lat, LONDON.lng));
    const sector = bbox(sectorRing(LONDON.lat, LONDON.lng));
    expect(spot.w).toBeGreaterThanOrEqual(patch.w - 1e-9);
    expect(spot.e).toBeLessThanOrEqual(patch.e + 1e-9);
    expect(patch.w).toBeGreaterThanOrEqual(sector.w - 1e-9);
    expect(patch.e).toBeLessThanOrEqual(sector.e + 1e-9);
  });
});

describe("wordlists (frozen)", () => {
  it("adjectives: 900 (30²) unique 3-8 letter words", () => {
    expect(ADJECTIVES).toHaveLength(900);
    expect(new Set(ADJECTIVES).size).toBe(900);
    expect(ADJECTIVES.every((w) => /^[a-z]{3,8}$/.test(w))).toBe(true);
  });
  it("nouns: 3136 (56²) unique 3-8 letter words", () => {
    expect(NOUNS).toHaveLength(3136);
    expect(new Set(NOUNS).size).toBe(3136);
    expect(NOUNS.every((w) => /^[a-z]{3,8}$/.test(w))).toBe(true);
  });
  it("the two lists are disjoint", () => {
    const adj = new Set(ADJECTIVES);
    expect(NOUNS.filter((n) => adj.has(n))).toEqual([]);
  });
  it("has stable anchors (index 0 defines addresses)", () => {
    expect(ADJECTIVES[0]).toBe("new");
    expect(NOUNS[0]).toBe("business");
  });
});

describe("encode / decode", () => {
  it("is deterministic", () => {
    expect(encode(LONDON.lat, LONDON.lng)).toEqual(encode(LONDON.lat, LONDON.lng));
  });

  it("has a well-formed structure", () => {
    const id = encode(LONDON.lat, LONDON.lng);
    expect(id.region).toMatch(/^\d{1,2}[ns]\d{1,3}[ew]-[a-e][1-5]$/);
    expect(id.sector).toMatch(/^[a-z]+$/);
    expect(id.patch).toMatch(/^[a-z]+$/);
    expect(id.spot).toBeGreaterThanOrEqual(1);
    expect(id.spot).toBeLessThanOrEqual(25);
    expect(id.check).toBeUndefined();
  });

  it("region code is the human-readable coordinate", () => {
    // 51.5205, −0.21 sits in the 0.2° tile whose SW corner is 51.4, −0.4:
    // degree cell 51n1w, file d (4th 0.2° column east), rank 3 (3rd row north).
    expect(encode(51.5205, -0.21).region).toBe("51n1w-d3");
    expect(regionCodeAt(51.5205, -0.21)).toBe("51n1w-d3");
    expect(isRegionCode("51n1w-d3")).toBe(true);
    expect(isRegionCode("london")).toBe(false);
  });

  it.each([
    ["equator/prime meridian", 0.1, 0.1, /^0n0e-[a-e][1-5]$/],
    ["southern hemisphere (Sydney)", -33.87, 151.21, /^34s151e-[a-e][1-5]$/],
    ["south-west quadrant (Rio)", -22.9, -43.2, /^23s44w-[a-e][1-5]$/],
    ["just south of the equator", -0.1, -0.1, /^1s1w-[a-e][1-5]$/],
  ])("region code hemispheres: %s", (_l, lat, lng, re) => {
    expect(encode(lat as number, lng as number).region).toMatch(re as RegExp);
  });

  it("decode round-trips across hemispheres and the equator seam", () => {
    for (const [lat, lng] of [
      [0.1, 0.1],
      [-0.1, -0.1],
      [-33.87, 151.21],
      [-22.9, -43.2],
      [68.23, 101.5],
    ] as [number, number][]) {
      const id = encode(lat, lng);
      const c = decode(id)!;
      expect(c, id.region).not.toBeNull();
      expect(encode(c.lat, c.lng)).toEqual(id);
    }
  });

  it("rejects region codes outside the valid range", () => {
    const local = encode(51.5205, -0.21);
    for (const region of ["90n0e-a1", "0n180e-a1", "51n1w-f1", "51n1w-a6", "51x1w-a1"]) {
      expect(decode({ ...local, region }), region).toBeNull();
    }
  });

  it("returns null for a name no square in the region carries", () => {
    // A region intersects only some of the 900 sector cells, so about half
    // the adjectives name nothing in a given region; and a sector cell that
    // straddles the edge has patches wholly outside it. Neither combination
    // is produced by encode, and decode must not invent a point for it.
    let unreachable = 0, total = 0;
    for (let a = 0; a < 900; a += 37) {
      for (let b = 0; b < 3136; b += 131) {
        const id = { region: "51n1w-d3", sector: ADJECTIVES[a], patch: NOUNS[b], spot: 7 };
        const p = decode(id);
        total++;
        if (p === null) unreachable++;
        else expect(encode(p.lat, p.lng), format(id)).toEqual(id);
      }
    }
    expect(unreachable).toBeGreaterThan(0);
    expect(unreachable).toBeLessThan(total);
  });

  it("rejects words not in the lists and spots out of range", () => {
    const id = encode(LONDON.lat, LONDON.lng);
    expect(decode({ ...id, sector: "notaword" })).toBeNull();
    expect(decode({ ...id, patch: "notaword" })).toBeNull();
    expect(decode({ ...id, spot: 0 })).toBeNull();
    expect(decode({ ...id, spot: 26 })).toBeNull();
  });

  it("round-trips: decode lands in the same 3 m spot", () => {
    const id = encode(LONDON.lat, LONDON.lng);
    const c = decode(id)!;
    expect(c).not.toBeNull();
    expect(encode(c.lat, c.lng)).toEqual(id);
  });

  it("decoded centre is within a few metres of the input", () => {
    const c = decode(encode(LONDON.lat, LONDON.lng))!;
    expect(Math.abs(c.lat - LONDON.lat) * 111320).toBeLessThan(4);
    expect(Math.abs(c.lng - LONDON.lng) * 111320).toBeLessThan(6);
  });

  it("de-clusters: neighbouring cells get non-adjacent words", () => {
    const a = encode(LONDON.lat, LONDON.lng);
    const b = encode(LONDON.lat, LONDON.lng + 16 / 111320); // ~16 m east
    if (a.patch !== b.patch) {
      const gap = Math.abs(NOUNS.indexOf(a.patch) - NOUNS.indexOf(b.patch));
      expect(gap).toBeGreaterThan(1);
    }
    const c = encode(LONDON.lat, LONDON.lng + 900 / 111320); // ~900 m east
    if (a.sector !== c.sector) {
      const gap = Math.abs(ADJECTIVES.indexOf(a.sector) - ADJECTIVES.indexOf(c.sector));
      expect(gap).toBeGreaterThan(1);
    }
  });

  it("neighbouring spots differ", () => {
    const a = encode(LONDON.lat, LONDON.lng);
    const b = encode(LONDON.lat + 4 / 111320, LONDON.lng); // ~4 m north
    expect(format(a)).not.toBe(format(b));
  });

  it("different cities get different regions", () => {
    expect(encode(LONDON.lat, LONDON.lng).region).not.toBe(encode(CHICAGO.lat, CHICAGO.lng).region);
  });

  it("nearby points share the same region", () => {
    expect(encode(51.5172, -0.2113).region).toBe(encode(LONDON.lat, LONDON.lng).region);
  });
});

describe("format / parse", () => {
  it("format ↔ parse round-trips", () => {
    const id = encode(LONDON.lat, LONDON.lng);
    expect(parse(format(id))).toEqual(id);
  });

  it("parses typeable forms (dots canonical, middots/spaces tolerated)", () => {
    const expected = { region: "51n1w-d3", sector: "brave", patch: "otter", spot: 7 };
    for (const s of [
      "51n1w-d3.brave.otter.7", // canonical (dots)
      "51n1w-d3 · brave · otter · 7", // display styling (middots)
      "51n1w-d3 brave otter 7", // spaces
      "51n1w-d3   brave   otter   7", // extra whitespace
      "51n1w-d3 brave-otter 7", // legacy three-token sector-patch pair
      "51N1W-D3.Brave.Otter.7", // case-insensitive
      "  51n1w-d3.brave.otter.7  ", // padded
    ]) {
      expect(parse(s), s).toEqual(expected);
    }
    // an alias region passes through the parser
    expect(parse("london brave-otter 7")).toEqual({ region: "london", sector: "brave", patch: "otter", spot: 7 });
    expect(parse("london.brave.otter.7")).toEqual({ region: "london", sector: "brave", patch: "otter", spot: 7 });
  });

  it("full string round-trips through decode", () => {
    const s = squarenameAt(CHICAGO.lat, CHICAGO.lng);
    const c = decode(parse(s)!)!;
    expect(squarenameAt(c.lat, c.lng)).toBe(s);
  });

  it.each([
    [""],
    ["a · b · 3"], // three tokens without a hyphenated middle pair
    ["one-two · a-b · 99"], // spot out of range
    ["one-two · ab · 3"], // middle token missing the '-'
    ["51n1w-d3.brave.otter"], // missing spot
    ["51n1w-d3.brave.otter.0"], // spot below 1
    ["51n1w-d3.brave.otter.7.k.extra"], // too many tokens
  ])("rejects malformed strings (%j)", (s) => {
    expect(parse(s)).toBeNull();
  });

  it("works across the hemispheres / date line", () => {
    for (const [lat, lng] of [
      [-33.86, 151.207],
      [35.68, 139.69],
      [-1.29, 36.82],
      [64.13, -21.9],
    ]) {
      const id = encode(lat, lng);
      const c = decode(id)!;
      expect(encode(c.lat, c.lng)).toEqual(id);
    }
  });
});

describe("patchInstancesInBox", () => {
  // A ~5 km box in west London.
  const box = { minLat: 51.497, minLng: -0.24, maxLat: 51.541, maxLng: -0.167 };

  it("finds the patch instance containing a known point", () => {
    const p = { lat: 51.5205, lng: -0.21 };
    const id = encode(p.lat, p.lng);
    const hits = patchInstancesInBox(id.patch, box, p);
    expect(hits.length).toBeGreaterThan(0);
    const first = hits[0];
    expect(first.sector).toBe(id.sector);
    expect(Math.abs(first.lat - p.lat) * 111_320).toBeLessThan(16);
  });

  it("returns one instance per sector, all encoding back to the word", () => {
    const noun = encode(51.51, -0.2).patch;
    const hits = patchInstancesInBox(noun, box);
    const sectors = hits.map((h) => h.sector);
    expect(new Set(sectors).size).toBe(sectors.length);
    for (const h of hits) {
      const id = encode(h.lat, h.lng);
      expect(id.patch).toBe(noun);
      expect(id.sector).toBe(h.sector);
    }
    expect(hits.length).toBeGreaterThan(15);
    expect(hits.length).toBeLessThan(60);
  });

  it("sorts by distance to the origin", () => {
    const origin = { lat: 51.518, lng: -0.205 };
    const noun = encode(51.518, -0.205).patch;
    const hits = patchInstancesInBox(noun, box, origin);
    const d = (h: { lat: number; lng: number }) =>
      ((h.lat - origin.lat) * 111_320) ** 2 +
      ((h.lng - origin.lng) * 111_320 * Math.cos((origin.lat * Math.PI) / 180)) ** 2;
    for (let k = 1; k < hits.length; k++) {
      expect(d(hits[k])).toBeGreaterThanOrEqual(d(hits[k - 1]));
    }
  });

  it("survives a band seam — every hit verifies through the encoder", () => {
    const bandBox = { minLat: 50.99, minLng: -0.22, maxLat: 51.01, maxLng: -0.18 };
    const noun = encode(50.995, -0.2).patch;
    const hits = patchInstancesInBox(noun, bandBox);
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) expect(encode(h.lat, h.lng).patch).toBe(noun);
  });

  it("unknown word returns empty", () => {
    expect(patchInstancesInBox("notaword", box)).toEqual([]);
  });
});

describe("longitude normalisation at the antimeridian", () => {
  it("encodes +180 exactly as -180", () => {
    expect(encode(51.5, 180)).toEqual(encode(51.5, -180));
    expect(encode(-33.9, 540.5)).toEqual(encode(-33.9, -179.5));
  });
  it("round-trips through decode within the spot at +180", () => {
    const id = encode(51.5, 180);
    const c = decode(id)!;
    expect(Math.abs(c.lat - 51.5)).toBeLessThan(0.00003);
    expect(Math.abs((((c.lng + 180) % 360) + 360) % 360)).toBeLessThan(0.00005);
  });
});

describe("latitude clamp at ±85°", () => {
  it.each([85, 85.5, 90, -85, -89.9])("lat %d encodes and round-trips", (lat) => {
    const id = encode(lat, 10);
    expect(decode(id)).not.toBeNull();
    const c = decode(id)!;
    expect(encode(c.lat, c.lng)).toEqual(id);
  });
});

describe("decode returns a point inside the cell ∩ region tile (round-trip at seams and edges)", () => {
  it.each([
    ["band seam exactly", 51.0, -0.2],
    ["band seam just below", 50.9999999, -0.2],
    ["band seam just above", 51.0000001, -0.2],
    ["region lat edge exactly", 51.2, -0.2],
    ["region lat edge just below", 51.1999999, -0.2],
    ["region lng edge exactly", 51.5, -0.2],
    ["region lng edge just west", 51.5, -0.2000001],
    ["equator exactly", 0, 36.8219],
    ["equator just south", -0.0000001, 36.8219],
    ["degree corner", 52, 1],
    ["antimeridian", 51.5, 180],
  ])("%s", (_name, lat, lng) => {
    const id = encode(lat, lng);
    const c = decode(id)!;
    expect(encode(c.lat, c.lng)).toEqual(id);
  });
});
