// Copyright 2026 SQRS. Licensed under the Apache License, Version 2.0.

// The Squarenames grid: encode a coordinate to a name, decode a name to a
// point, and the canonical string form. Reference implementation of spec v1
// §2 (grid), §4 (encoding), §5 (decoding) and §6 (canonical form).
//
// A squarename reads  region . sector . patch . spot,  for example
// 51n1w-d3.brave.otter.7:
//   spot    3 m    → 5×5 in a patch           → number 1..25
//   patch   15 m   → 56×56 in a sector        → NOUN       (otter)
//   sector  840 m  → adjective within region  → ADJECTIVE  (brave)
//   region  0.2°   → a lat/lng tile           → coordinate code (51n1w-d3)
//
// spot, patch and sector are true ground-metre squares on a Web-Mercator
// lattice that is fixed within each 1° latitude band and recalibrated from
// band to band (`size = groundMetres / cos(bandReferenceLat)`), so ground
// sizes stay constant worldwide. The region is a 0.2° lat/lng tile: it nests
// exactly five per band, so a region always sits inside one band and decoding
// recovers the band from the region alone, and it spans fewer than 30 sector
// cells, so the sector adjective is unique within it.

import { checkChar, checkWord } from "./check.js";
import { ADJECTIVES, NOUNS } from "./wordlist.js";
import { RETIRED_ADJECTIVES, RETIRED_NOUNS } from "./retired.js";

const MERC_R = 6378137; // Web Mercator sphere radius, metres (spec §2.1)
const RAD = Math.PI / 180;

// Latitude banding (spec §2.2). The lattice is fixed within each band; the
// Mercator cell size is recalibrated band to band.
export const BAND_DEG = 1;
const bandReferenceLat = (lat: number) => (Math.floor(lat / BAND_DEG) + 0.5) * BAND_DEG;
const bandScale = (lat: number) => 1 / Math.cos(bandReferenceLat(lat) * RAD);

// Tier ground sizes in metres at the band reference latitude (spec §2.2).
export const SPOT_M = 3;
export const PATCH_M = 15; // 5 spots per side
export const SECTOR_M = 840; // 56 patches per side
const SPOT_SIDE = 5,
  PATCH_SIDE = 56,
  SECTOR_SIDE = 30;

// The region is a lat/lng tile, not Mercator (spec §2.3): 0.2° nests five per
// band, keeps every region under 30 sector cells across, and decodes to its
// south-west corner with no dependence on the band.
export const REGION_DEG = 0.2;
const REGION_COLS = Math.round(360 / REGION_DEG); // 1800

const ADJ_IX = new Map(ADJECTIVES.map((w, i) => [w, i]));
const NOUN_IX = new Map(NOUNS.map((w, i) => [w, i]));
// Lookups accept a retired word (spec §10.2): it resolves to the index its
// replacement holds. Encoding only ever reads the lists, never the table.
const adjIndex = (w: string) => ADJ_IX.get(w) ?? ADJ_IX.get(RETIRED_ADJECTIVES[w] ?? "");
const nounIndex = (w: string) => NOUN_IX.get(w) ?? NOUN_IX.get(RETIRED_NOUNS[w] ?? "");

const mod = (a: number, n: number) => ((a % n) + n) % n;

// Longitude lives in [-180, 180). +180 and anything beyond wrap (spec §4
// step 0): the region column wraps modulo 1800, and the Mercator x must wrap
// with it, or lng = 180 would encode from the east edge of the plane under a
// region that decodes from the west edge.
const normLng = (lng: number) => mod(lng + 180, 360) - 180;

// De-clustering (spec §4 steps 3–4). Without it the grid index maps to the
// wordlist in order, so neighbouring cells get alphabetically adjacent words.
// A multiplicative permutation (i·M mod N, M coprime to N) is an exactly
// reversible bijection that scatters consecutive indices across the list.
function modInverse(a: number, n: number): number {
  let [r0, r1] = [mod(a, n), n];
  let [s0, s1] = [1, 0];
  while (r1 !== 0) {
    const q = Math.floor(r0 / r1);
    [r0, r1] = [r1, r0 - q * r1];
    [s0, s1] = [s1, s0 - q * s1];
  }
  return mod(s0, n);
}
const ADJ_N = ADJECTIVES.length; // 900
const PATCH_N = NOUNS.length; // 3136
const ADJ_MUL = 389; // prime, coprime to 900 (= 2²·3²·5²)
const PATCH_MUL = 1373; // prime, coprime to 3136 (= 2⁶·7²)
const ADJ_MUL_INV = modInverse(ADJ_MUL, ADJ_N); // 509
const PATCH_MUL_INV = modInverse(PATCH_MUL, PATCH_N); // 2549
const permAdj = (i: number) => (i * ADJ_MUL) % ADJ_N;
const permAdjInv = (j: number) => (j * ADJ_MUL_INV) % ADJ_N;
const permPatch = (i: number) => (i * PATCH_MUL) % PATCH_N;
const permPatchInv = (j: number) => (j * PATCH_MUL_INV) % PATCH_N;

// Spherical Web Mercator (spec §2.1).
const mercX = (lng: number) => MERC_R * lng * RAD;
const mercY = (lat: number) =>
  MERC_R * Math.log(Math.tan(Math.PI / 4 + (Math.max(-85, Math.min(85, lat)) * RAD) / 2));
const invMercX = (x: number) => x / MERC_R / RAD;
const invMercY = (y: number) => (2 * Math.atan(Math.exp(y / MERC_R)) - Math.PI / 2) / RAD;

// The region's coordinate code (spec §2.4): `<lat°><n|s><lng°><e|w>-<file a–e><rank 1–5>`,
// e.g. `51n1w-d3` = the 0.2° tile in degree cell 51°N 1°W, chess-style
// sub-square file d (west→east), rank 3 (south→north). Self-locating from a
// one-sentence rule, with no wordlist. Chess file+rank rather than a single
// a–y letter so there is no i/l/o against 1/0 confusion.
const FILES = "abcde";
const regionName = (idx: number): string => {
  const row = Math.floor(idx / REGION_COLS),
    col = mod(idx, REGION_COLS);
  const latSW = row * REGION_DEG - 90,
    lngSW = col * REGION_DEG - 180;
  // 1e-9: latSW/lngSW come from n×0.2 float arithmetic; nudge before floor so
  // exact degree boundaries land in the cell they open, not the one below.
  const latD = Math.floor(latSW + 1e-9),
    lngD = Math.floor(lngSW + 1e-9);
  const rank = Math.round((latSW - latD) / REGION_DEG) + 1; // 1..5 south→north
  const file = FILES[Math.round((lngSW - lngD) / REGION_DEG)]; // a..e west→east
  return `${Math.abs(latD)}${latD >= 0 ? "n" : "s"}${Math.abs(lngD)}${lngD >= 0 ? "e" : "w"}-${file}${rank}`;
};
const REGION_RE = /^(\d{1,2})([ns])(\d{1,3})([ew])-([a-e])([1-5])$/;
const regionIndex = (s: string): number | null => {
  const m = REGION_RE.exec(s);
  if (!m) return null;
  const latD = (m[2] === "s" ? -1 : 1) * Number(m[1]),
    lngD = (m[4] === "w" ? -1 : 1) * Number(m[3]);
  if (latD < -90 || latD > 89 || lngD < -180 || lngD > 179) return null;
  const latSW = latD + (Number(m[6]) - 1) * REGION_DEG,
    lngSW = lngD + FILES.indexOf(m[5]) * REGION_DEG;
  const row = Math.round((latSW + 90) / REGION_DEG),
    col = Math.round((lngSW + 180) / REGION_DEG);
  return row * REGION_COLS + mod(col, REGION_COLS);
};

/** True if `s` is a well-formed region coordinate code (spec §2.4). */
export const isRegionCode = (s: string): boolean => regionIndex(s) != null;

export interface Squarename {
  /** Region: a coordinate code such as `51n1w-d3`, or an alias (spec §8). */
  region: string;
  /** Sector adjective — the 840 m cell. */
  sector: string;
  /** Patch noun — the 15 m cell. */
  patch: string;
  /** Spot number 1..25 — the 3 m square inside the patch. */
  spot: number;
  /** Optional trailing check token as parsed, not verified (spec §7.3).
   *  Never set by `encode`. */
  check?: string;
}

// The frame everything inside a region is measured in: the tile's south-west
// corner, the band scale taken from that corner, the three cell sizes, and
// the tile's Mercator window. Encode and decode both go through here so they
// can never disagree about which band or which window a region is in.
function regionFrame(row: number, col: number) {
  const latSW = row * REGION_DEG - 90,
    lngSW = col * REGION_DEG - 180;
  // +1e-9: the corner comes from n×0.2 float arithmetic; nudge so an exact
  // integer-degree corner reads its own band, not the one below (spec §4 step 1).
  const k = bandScale(latSW + 1e-9);
  return {
    latSW,
    lngSW,
    k,
    sSpot: SPOT_M * k,
    sPatch: PATCH_M * k,
    sSector: SECTOR_M * k,
    xLo: mercX(lngSW),
    xHi: mercX(lngSW + REGION_DEG),
    yLo: mercY(latSW),
    yHi: mercY(latSW + REGION_DEG),
  };
}
// A micrometre in from both edges of the window (spec §4 step 2, §5 step 6).
// Symmetric on purpose: at the equator mercY(0) evaluates a hair negative
// (tan(π/4) rounds below 1), so a window that began exactly at yLo would let
// the point 0° fall into a cell whose part inside the tile is a nanometre
// thick and unreachable by any decode point. Cells with less than a
// micrometre inside the tile are never named.
const WINDOW_EPS_M = 1e-6;
const clampWindow = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo + WINDOW_EPS_M), hi - WINDOW_EPS_M);

// Latitude stops a hair inside the Mercator clamp (spec §4 step 0). At exactly
// ±85° the region tile [85, 85.2) exists in degrees but has zero height in
// Mercator (both edges project to the clamp), so encode and decode could not
// agree on it. Anything at or beyond the clamp names the last real tile
// below it.
const LAT_LIMIT = 85 - 1e-9;
const clampLat = (lat: number) => Math.min(Math.max(lat, -LAT_LIMIT), LAT_LIMIT);

/** Encode a coordinate to its squarename (the 3 m spot). Spec §4. */
export function encode(latIn: number, lngIn: number): Squarename {
  const lat = clampLat(latIn);
  const lng = normLng(lngIn);
  const row = Math.floor((lat + 90) / REGION_DEG);
  const col = mod(Math.floor((lng + 180) / REGION_DEG), REGION_COLS);
  const f = regionFrame(row, col);
  // The point's Mercator position, held inside its region's window: the
  // lattice is not aligned to the tile, so without this a point on the tile's
  // edge can round to a cell just outside it (spec §4 step 2).
  const x = clampWindow(mercX(lng), f.xLo, f.xHi),
    y = clampWindow(mercY(lat), f.yLo, f.yHi);
  const ax = Math.floor(x / f.sSector),
    ay = Math.floor(y / f.sSector);
  const px = Math.floor(x / f.sPatch),
    py = Math.floor(y / f.sPatch);
  const sx = Math.floor(x / f.sSpot),
    sy = Math.floor(y / f.sSpot);
  return {
    region: regionName(row * REGION_COLS + col),
    sector: ADJECTIVES[permAdj(mod(ay, SECTOR_SIDE) * SECTOR_SIDE + mod(ax, SECTOR_SIDE))],
    patch: NOUNS[permPatch(mod(py, PATCH_SIDE) * PATCH_SIDE + mod(px, PATCH_SIDE))],
    spot: mod(sy, SPOT_SIDE) * SPOT_SIDE + mod(sx, SPOT_SIDE) + 1,
  };
}

/** The coordinate code of the 0.2° region tile containing a coordinate — the
 *  region an alias may overlay (spec §8). Exposed so an alias resolver can
 *  enumerate the tiles a name covers. */
export function regionCodeAt(latIn: number, lngIn: number): string {
  const lat = clampLat(latIn);
  const lng = normLng(lngIn);
  const row = Math.floor((lat + 90) / REGION_DEG);
  const col = mod(Math.floor((lng + 180) / REGION_DEG), REGION_COLS);
  return regionName(row * REGION_COLS + col);
}

/** Canonical string (spec §6.1): `region.sector.patch.spot`, optionally with
 *  a fifth check part. Dots separate the structural parts; dashes only ever
 *  appear inside a part (the region code's `-d3`, a multi-word alias such as
 *  `new-york`). */
export function format(id: Squarename, opts?: { check?: "char" | "word" }): string {
  const base = `${id.region}.${id.sector}.${id.patch}.${id.spot}`;
  if (!opts?.check) return base;
  const c = opts.check === "word" ? checkWord(id) : checkChar(id);
  return c == null ? base : `${base}.${c}`;
}

/** Parse a string to its parts (null if malformed). Spec §6.3. */
export function parse(s: string): Squarename | null {
  // Tolerant of how a human types or pastes it: dots (canonical), middots
  // (display styling), or whitespace between the parts; also the legacy
  // "region sector-patch spot" three-token form. Case-insensitive. A token's
  // internal '-' is never split — it belongs to the name (region `51n1w-d3`,
  // alias `new-york`) — except in the legacy middle "sector-patch" pair.
  const toks = s
    .trim()
    .toLowerCase()
    .split(/\s*·\s*|\s*\.\s*|\s+/)
    .filter(Boolean);
  // Optional trailing check token — a check char, a spoken check word, or the
  // raw check value. Token COUNT decides whether the last token is a check,
  // never its shape: the char alphabet starts 0–9 and the value form is all
  // digits, so a shape rule would mistake a digit check for a spot. Canonical
  // names have four parts, plus one for the check; the legacy form has three,
  // plus one. The token is returned, not verified (spec §7.3).
  const legacy = toks.length >= 3 && toks[1].includes("-");
  let check: string | undefined;
  if (legacy ? toks.length === 4 : toks.length === 5) {
    check = toks.pop();
  }
  let region: string, sector: string, patch: string, spotTok: string;
  if (toks.length === 3) {
    const sp = toks[1].split("-");
    if (sp.length !== 2) return null;
    [region, sector, patch, spotTok] = [toks[0], sp[0], sp[1], toks[2]];
  } else if (toks.length === 4) {
    [region, sector, patch, spotTok] = [toks[0], toks[1], toks[2], toks[3]];
  } else {
    return null;
  }
  const spot = Number(spotTok);
  if (!region || !sector || !patch || !Number.isInteger(spot) || spot < 1 || spot > 25) return null;
  return check ? { region, sector, patch, spot, check } : { region, sector, patch, spot };
}

// The sector-cell index inside a region's Mercator window whose position
// modulo SECTOR_SIDE matches `targetMod`. The window is fewer than
// SECTOR_SIDE cells wide, so at most one qualifies; a region holds only the
// adjectives of the sector cells it intersects, so there may be none (spec
// §5 step 3).
function sectorIndexInWindow(loMerc: number, hiMerc: number, sSector: number, targetMod: number): number | null {
  const iLo = Math.floor(loMerc / sSector),
    iHi = Math.floor(hiMerc / sSector);
  for (let i = iLo; i <= iHi; i++) if (mod(i, SECTOR_SIDE) === targetMod) return i;
  return null;
}

/** Decode a squarename with a coordinate-code region to a point inside its
 *  3 m spot. Null if the region is not a coordinate code (an alias needs the
 *  overlay, see `resolve`), a word or spot is invalid, or no square in that
 *  region carries the name: a region contains only some of the 900 sector
 *  cells, and a cell that straddles the region's edge has patches outside
 *  it. Every name `encode` produces decodes; a name it never produces does
 *  not. Spec §5. */
export function decode(id: Squarename): { lat: number; lng: number } | null {
  const ridx = regionIndex(id.region);
  const aRaw = adjIndex(id.sector),
    pRaw = nounIndex(id.patch);
  if (ridx == null || aRaw == null || pRaw == null || id.spot < 1 || id.spot > 25) return null;
  // Undo the de-cluster permutation to recover the raster indices.
  const aLoc = permAdjInv(aRaw),
    pLoc = permPatchInv(pRaw);

  // Region → its frame (the same one encode used). A 0.2° region sits inside
  // one 1° band, so the band and the cell sizes are fixed by the corner.
  const row = Math.floor(ridx / REGION_COLS),
    col = ridx % REGION_COLS;
  const { sSpot, sSector, xLo, xHi, yLo, yHi } = regionFrame(row, col);

  // Sector cell: the unique one in the region window matching the adjective.
  const ax = sectorIndexInWindow(xLo, xHi, sSector, aLoc % SECTOR_SIDE);
  const ay = sectorIndexInWindow(yLo, yHi, sSector, Math.floor(aLoc / SECTOR_SIDE));
  if (ax == null || ay == null) return null;

  // Patch nests exactly (sSector = PATCH_SIDE·sPatch), spot nests exactly
  // (sPatch = SPOT_SIDE·sSpot) — no search needed.
  const px = ax * PATCH_SIDE + (pLoc % PATCH_SIDE),
    py = ay * PATCH_SIDE + Math.floor(pLoc / PATCH_SIDE);
  const s = id.spot - 1;
  const sx = px * SPOT_SIDE + (s % SPOT_SIDE),
    sy = py * SPOT_SIDE + Math.floor(s / SPOT_SIDE);
  // The spot is the lattice cell intersected with its region tile (and so its
  // band): the Mercator lattice is not aligned to 0.2° tile edges or 1° band
  // seams, so a cell can straddle one, and its raw centre can fall on the far
  // side, where re-encoding names a different square. Return the centre moved
  // to just inside the tile instead. That point is still inside the cell (the
  // tile edge cuts through the cell, so the edge lies between the centre and
  // the cell's far side) and it re-encodes to this name, always (spec §5
  // step 6). Clamped in Mercator with the same window and epsilon encode
  // uses, so the two sides agree to the micrometre.
  const point = {
    lat: invMercY(clampWindow((sy + 0.5) * sSpot, yLo, yHi)),
    lng: invMercX(clampWindow((sx + 0.5) * sSpot, xLo, xHi)),
  };
  // A patch or spot cell that lies wholly outside the region (its sector
  // cell straddles the edge) has no point in the region that names it; the
  // clamp above would hand back a neighbouring cell instead. Verify by
  // re-encoding, so decode answers only for names that exist (spec §5 step 7).
  const back = encode(point.lat, point.lng);
  if (back.region !== id.region || back.sector !== ADJECTIVES[aRaw] || back.patch !== NOUNS[pRaw] || back.spot !== id.spot) {
    return null;
  }
  return point;
}

/** Convenience: coordinate → canonical string. */
export const squarenameAt = (lat: number, lng: number): string => format(encode(lat, lng));

/** The band-calibrated square of ground side `groundM` that a point falls in,
 *  as a closed [lng, lat] ring, snapped to the same lattice the encoder uses,
 *  so each ring is exactly the spot / patch / sector cell of that point's name. */
function squareRing(lat: number, lng: number, groundM: number): [number, number][] {
  const s = groundM * bandScale(lat);
  const x0 = Math.floor(mercX(lng) / s) * s,
    y0 = Math.floor(mercY(lat) / s) * s;
  const corners: [number, number][] = [
    [x0, y0],
    [x0 + s, y0],
    [x0 + s, y0 + s],
    [x0, y0 + s],
    [x0, y0],
  ];
  return corners.map(([cx, cy]) => [invMercX(cx), invMercY(cy)]);
}

/** The 3 m spot square a point falls in, as a closed [lng, lat] ring. */
export const spotRing = (lat: number, lng: number) => squareRing(lat, lng, SPOT_M);

/** The 15 m patch square containing the point — the noun cell. */
export const patchRing = (lat: number, lng: number) => squareRing(lat, lng, PATCH_M);

/** The 840 m sector square containing the point — the adjective cell. A
 *  sector spans 56×56 patches, so a whole neighbourhood shares one adjective. */
export const sectorRing = (lat: number, lng: number) => squareRing(lat, lng, SECTOR_M);

export interface PatchInstance {
  lat: number;
  lng: number;
  sector: string;
}

/** Every instance of a patch noun inside a box — so a bare noun can be
 *  completed into `sector.patch` candidates. Each sector contains every noun
 *  exactly once, so this inverts the word→cell permutation and steps the
 *  lattice in 56-cell strides: exact and O(instances), no scanning. Every
 *  candidate is verified back through the encoder (cells at a band seam can
 *  belong to the neighbouring band's lattice and are dropped). Sorted by
 *  ground distance to `origin` when given. Keep the box under one word-tiling
 *  period (~25 km), as with every region-less surface (spec §4.1). */
export function patchInstancesInBox(
  patch: string,
  box: { minLat: number; minLng: number; maxLat: number; maxLng: number },
  origin?: { lat: number; lng: number }
): PatchInstance[] {
  const j = nounIndex(patch.toLowerCase());
  if (j == null) return [];
  const i = permPatchInv(j);
  const by = Math.floor(i / PATCH_SIDE);
  const bx = i % PATCH_SIDE;
  const out: PatchInstance[] = [];
  const bandLo = Math.floor(box.minLat / BAND_DEG);
  const bandHi = Math.floor(box.maxLat / BAND_DEG);
  for (let band = bandLo; band <= bandHi; band++) {
    // The lattice is fixed within a band and recalibrated across bands, so
    // enumerate per band over the box's slice of it.
    const latLo = Math.max(box.minLat, band * BAND_DEG);
    const latHi = Math.min(box.maxLat, (band + 1) * BAND_DEG);
    if (latHi <= latLo) continue;
    const sP = PATCH_M / Math.cos((band + 0.5) * BAND_DEG * RAD);
    const px0 = Math.floor(mercX(box.minLng) / sP);
    const px1 = Math.floor(mercX(box.maxLng) / sP);
    const py0 = Math.floor(mercY(latLo) / sP);
    const py1 = Math.floor(mercY(latHi) / sP);
    const startX = bx + Math.ceil((px0 - bx) / PATCH_SIDE) * PATCH_SIDE;
    const startY = by + Math.ceil((py0 - by) / PATCH_SIDE) * PATCH_SIDE;
    for (let py = startY; py <= py1; py += PATCH_SIDE) {
      for (let px = startX; px <= px1; px += PATCH_SIDE) {
        const lat = invMercY((py + 0.5) * sP);
        const lng = invMercX((px + 0.5) * sP);
        if (lat < latLo || lat > latHi) continue;
        const id = encode(lat, lng);
        if (id.patch !== NOUNS[j]) continue; // band-seam lattice mismatch
        out.push({ lat, lng, sector: id.sector });
      }
    }
  }
  if (origin) {
    const mLat = 111_320;
    const mLng = 111_320 * Math.cos(origin.lat * RAD);
    const d2 = (p: PatchInstance) =>
      ((p.lat - origin.lat) * mLat) ** 2 + ((p.lng - origin.lng) * mLng) ** 2;
    out.sort((a, b) => d2(a) - d2(b));
  }
  return out;
}
