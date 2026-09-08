// Copyright 2026 SQRS. Licensed under the Apache License, Version 2.0.

// The alias overlay hook (spec §8). The core resolves coordinate-code regions
// by itself. A region written as an alias (`camden.brave.otter.7`) needs
// overlay data that this package does not carry; the implementer supplies it
// through `AliasResolver`, and `resolve` does the rest: enumerate the tiles
// the alias covers, decode the local triple in each, and order the results.

import { decode, isRegionCode, parse, type Squarename } from "./grid.js";

export interface AliasResolver {
  /** The region coordinate codes an alias covers, in any order. Return null
   *  or an empty array for an unknown alias. */
  regionsFor(alias: string): readonly string[] | null;
  /** Optionally, a display alias for a region code (null if none). */
  aliasFor?(region: string): string | null;
}

export interface Resolution {
  /** The region coordinate code the result lies in. */
  region: string;
  lat: number;
  lng: number;
}

export interface ResolveOptions {
  /** Overlay data for alias regions. Without it, an aliased name resolves to
   *  nothing. */
  aliases?: AliasResolver;
  /** When given, results are ordered nearest first. */
  near?: { lat: number; lng: number };
}

const RAD = Math.PI / 180;
const d2 = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const mLat = 111_320;
  const mLng = 111_320 * Math.cos(a.lat * RAD);
  return ((a.lat - b.lat) * mLat) ** 2 + ((a.lng - b.lng) * mLng) ** 2;
};

/** Resolve a squarename (parsed or as a string) to the points it names.
 *
 *  - A coordinate-code region decodes to exactly one point (spec §5).
 *  - An alias region decodes the local triple in every tile the alias covers
 *    (spec §8): one result when the alias spans less than the ~25 km word
 *    period, a short list otherwise, never a wrong answer. Ordered nearest to
 *    `near` when given.
 *  - Unparseable input, an invalid word or spot, or an alias with no overlay
 *    yields an empty array.
 *
 *  A parsed check token is not verified here; see `verifyCheck`. */
export function resolve(name: Squarename | string, opts: ResolveOptions = {}): Resolution[] {
  const id = typeof name === "string" ? parse(name) : name;
  if (!id) return [];
  if (isRegionCode(id.region)) {
    const p = decode(id);
    return p ? [{ region: id.region, ...p }] : [];
  }
  const tiles = opts.aliases?.regionsFor(id.region) ?? [];
  const out: Resolution[] = [];
  const seen = new Set<string>();
  for (const region of tiles) {
    if (seen.has(region)) continue;
    seen.add(region);
    const p = decode({ ...id, region });
    if (p) out.push({ region, ...p });
  }
  if (opts.near) {
    const near = opts.near;
    out.sort((a, b) => d2(near, a) - d2(near, b));
  }
  return out;
}

/** The region to display for a name: the alias the overlay gives its
 *  coordinate code, else the code itself. Display only (spec §6.2); a copied
 *  or shared string keeps whatever region it was given. */
export function displayRegion(region: string, aliases?: AliasResolver): string {
  if (!aliases?.aliasFor || !isRegionCode(region)) return region;
  return aliases.aliasFor(region) ?? region;
}
