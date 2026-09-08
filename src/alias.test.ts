// Copyright 2026 SQRS. Licensed under the Apache License, Version 2.0.

import { describe, it, expect } from "vitest";
import { resolve, displayRegion, type AliasResolver } from "./alias.js";
import { encode, decode, format, regionCodeAt } from "./grid.js";

// A four-tile alias around west London, and a single-tile one inside it.
const WEST_LONDON = ["51n1w-c3", "51n1w-d3", "51n1w-c4", "51n1w-d4"];
const aliases: AliasResolver = {
  regionsFor: (alias) => (alias === "westlondon" ? WEST_LONDON : alias === "camden" ? ["51n1w-d3"] : null),
  aliasFor: (region) => (region === "51n1w-d3" ? "camden" : null),
};

describe("resolve", () => {
  const id = encode(51.5205, -0.21);

  it("decodes a coordinate-code region to exactly one point", () => {
    const r = resolve(id);
    expect(r).toHaveLength(1);
    expect(r[0].region).toBe("51n1w-d3");
    expect(encode(r[0].lat, r[0].lng)).toEqual(id);
    expect(resolve(format(id))).toEqual(r);
  });

  it("decodes an alias through the supplied overlay", () => {
    const r = resolve({ ...id, region: "camden" }, { aliases });
    expect(r).toHaveLength(1);
    expect(r[0].region).toBe("51n1w-d3");
    expect(r[0]).toMatchObject(decode(id)!);
  });

  it("returns every tile a wide alias covers, nearest first", () => {
    const near = { lat: 51.5205, lng: -0.21 };
    const r = resolve(`westlondon.${id.sector}.${id.patch}.${id.spot}`, { aliases, near });
    expect(r).toHaveLength(WEST_LONDON.length);
    expect(r[0].region).toBe("51n1w-d3");
    const d = (p: { lat: number; lng: number }) => (p.lat - near.lat) ** 2 + (p.lng - near.lng) ** 2;
    for (let k = 1; k < r.length; k++) expect(d(r[k])).toBeGreaterThanOrEqual(d(r[k - 1]));
    for (const p of r) expect(regionCodeAt(p.lat, p.lng)).toBe(p.region);
  });

  it("returns nothing for an alias without an overlay, an unknown alias, or bad input", () => {
    expect(resolve({ ...id, region: "camden" })).toEqual([]);
    expect(resolve({ ...id, region: "nowhere" }, { aliases })).toEqual([]);
    expect(resolve("not a squarename")).toEqual([]);
    expect(resolve({ ...id, sector: "notaword" })).toEqual([]);
  });

  it("does not resolve the same tile twice", () => {
    const dup: AliasResolver = { regionsFor: () => ["51n1w-d3", "51n1w-d3"] };
    expect(resolve({ ...id, region: "x" }, { aliases: dup })).toHaveLength(1);
  });
});

describe("displayRegion", () => {
  it("shows the alias when the overlay has one, else the code", () => {
    expect(displayRegion("51n1w-d3", aliases)).toBe("camden");
    expect(displayRegion("51n1w-c3", aliases)).toBe("51n1w-c3");
    expect(displayRegion("51n1w-d3")).toBe("51n1w-d3");
    expect(displayRegion("camden", aliases)).toBe("camden");
  });
});
