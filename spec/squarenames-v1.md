# Squarenames — specification, version 1 (draft)

**Status:** draft for publication. Maintained by SQRS. Spec text and wordlist
licensed CC-BY 4.0; the reference implementation Apache-2.0.

A squarename is a short, speakable address for a 3-metre square anywhere on
Earth, computed from a coordinate by formula and decoded back by the same
formula. Nothing is stored, nothing is looked up, no server is involved. An
example:

```
51n1w-e3.salty.rowan.6
```

(King's Cross station, London), read aloud as *"salty rowan six"* by anyone
standing within a few kilometres of it, and as *"fifty-one north one west,
e-three, salty rowan six"* by anyone who is not.

This document defines the *core*: the grid, the wordlists, the encoding and
decoding, the canonical string form, the check token, and the versioning
promise. It also defines the *grammar* of an optional alias layer (a region
may carry a friendlier name such as `london` or `camden`) without defining
the alias data, which is implementation-defined and additive.

---

## 1. Terms

| Term | Meaning |
|---|---|
| **spot** | a 3 m ground square; the smallest unit; numbered 1–25 within its patch |
| **patch** | a 15 m ground square; 5×5 spots; named by a **noun** |
| **sector** | an 840 m ground square; 56×56 patches; named by an **adjective** |
| **region** | a 0.2° × 0.2° latitude/longitude tile; 30×30 sectors at most; named by a **coordinate code** |
| **local triple** | sector, patch, spot — the part that is unique within a ~25 km neighbourhood |
| **squarename** | region, sector, patch, spot — globally unique. One address is *a squarename*, several are *squarenames*, and the system itself is *Squarenames*; the words are written in lower case except the system's name |
| **check token** | an optional trailing checksum over the local triple |
| **alias** | a display name for a region supplied by overlay data (out of core) |

Distances are ground metres at the latitude in question, held constant
worldwide by the band calibration in §2.

---

## 2. The grid

### 2.1 Projection

Squarenames use spherical Web Mercator with sphere radius `R = 6378137` m:

```
x(lng) = R · lng · π/180
y(lat) = R · ln( tan( π/4 + clamp(lat, −85, 85) · π/360 ) )
```

and the inverse

```
lng(x) = x / R · 180/π
lat(y) = ( 2 · atan( exp( y / R ) ) − π/2 ) · 180/π
```

Latitudes beyond ±85° are clamped before projection. The grid is therefore
defined for |lat| < 85°; inputs at or beyond that name the outermost square
inside it (§4 step 0).

### 2.2 Latitude bands and calibration

Mercator distances grow with latitude. To keep every spot 3 ground metres
wide, the lattice is recalibrated per **1° latitude band**:

```
band(lat)       = floor(lat / 1)                      // integer degrees
bandRefLat(lat) = band(lat) + 0.5                     // band centre
k(lat)          = 1 / cos( bandRefLat(lat) · π/180 )  // band scale
```

Within a band the lattice is fixed; the Mercator cell sizes are

```
spotSize   = 3   · k
patchSize  = 15  · k        (= 5  spot sizes)
sectorSize = 840 · k        (= 56 patch sizes)
```

All three lattices share the origin of the Mercator plane (x = 0, y = 0),
and each tier nests exactly in the next because the sizes are exact multiples.
A point's cell indices are floors of its Mercator coordinates:

```
sx = floor(x / spotSize)     sy = floor(y / spotSize)
px = floor(x / patchSize)    py = floor(y / patchSize)
ax = floor(x / sectorSize)   ay = floor(y / sectorSize)
```

Cells on either side of a band seam belong to different lattices. This is a
deliberate, owned trade-off (§9): a seam is a straight line of latitude at
each integer degree. The band is chosen from the point's region (§4), so every
point has exactly one name. A cell within a few metres of a seam may extend
across it; the part of the cell that counts is the part inside its region
(§5), which never crosses a seam because a region never does.

### 2.3 Regions

A region is a 0.2° tile in plain latitude/longitude, **not** Mercator:

```
row = floor( (lat + 90)  / 0.2 )              // 0 … 899
col = floor( (lng + 180) / 0.2 )  mod 1800    // 0 … 1799
```

The modulo wraps longitude so +180 and −180 name the same column. A region
is exactly one fifth of a degree, so it always lies inside a single latitude
band, and its south-west corner alone determines the band and therefore the
cell sizes. A region spans fewer than 30 sectors in each axis at every
latitude, which is what makes the sector adjective unique within it (§4.1).

Region edges are lines of latitude and longitude; the cell lattice is
Mercator and not aligned to them. A cell may therefore straddle a region
edge. The point being encoded decides the region, and the named square is
the cell's part inside that region (§4, §5).

### 2.4 The region's coordinate code

Every region has a self-describing name derived from its south-west corner:

```
<lat°><n|s><lng°><e|w>-<file><rank>
```

- `lat°`, `lng°` are the absolute integer degrees of the 1° cell containing
  the corner; `n`/`s` and `e`/`w` its hemisphere. The degree cell `−1 … 0`
  is written `1s`; the cell `0 … 1` is `0n`. Likewise `1w` and `0e`.
- The 1° cell is divided into a 5×5 grid of regions. **file** is the column
  `a`–`e` west to east; **rank** is the row `1`–`5` south to north, chess
  fashion.

So `51n1w-d3` is the region whose corner is at 51.4°N, 0.4°W: degree cell
51°N/1°W, fourth column from the west, third row from the south. The
alphabet deliberately stops at `e` and the digits at `5`: no `i`, `l`, `o`
against `1`, `0`.

Parsing the code is the inverse: read the degree cell, add `(rank − 1) · 0.2`
to the latitude and `index(file) · 0.2` to the longitude of its corner, and
recover `row`/`col` by rounding.

---

## 3. Wordlists

### 3.1 Contents

Two lists, frozen at **wordlist v1.0.0**:

- **ADJECTIVES**, exactly 900 words, for sectors (30 × 30).
- **NOUNS**, exactly 3136 words, for patches (56 × 56) and for the spoken
  check token (§7.3).

Both are English, 3–8 letters, lower-case ASCII, no digits or punctuation. The
two lists are disjoint. Every word satisfies the confusability rule below, and
the lists were screened for offensive, sensitive, morbid, proper-noun, brand,
and obscure words, and for unfortunate adjective-noun pairings, before
freezing. The screening is documented with the reference implementation; the
lists themselves are normative.

### 3.2 Order is the address

The **index** of a word in its list is what the grid maps to. The lists are
therefore ordered data, not sets: reordering, inserting, or removing a word
renumbers every squarename on Earth, and is a new major version of this
specification. Replacing a word at its index does not renumber anything; it
retires the old word (§10.2) and is a minor wordlist version.

### 3.3 The confusability rule

A list is valid if and only if, for every pair of distinct words `a`, `b`:

1. the Damerau-Levenshtein distance `d(a, b) ≥ 2` — no single insertion,
   deletion, substitution or adjacent transposition turns one into the other;
2. the Double Metaphone primary code of `a` differs from that of `b` — no
   homophones.

Consequences that implementations may rely on:

- Any single-character error in a word yields a string that is **not** in the
  list, so it is detectable.
- A string at distance 1 from the list has **exactly one** word at that
  distance, so a distance-1 correction is unambiguous.

A conforming implementation must ship the validator that checks both
conditions and must fail its own tests if the shipped lists violate them.

---

## 4. Encoding

Given `lat`, `lng`:

0. **Normalise the input.** Longitude to the half-open range `[−180, 180)`:
   `lng = ((lng + 180) mod 360) − 180`, with a non-negative modulo; `+180`
   is the same meridian as `−180` and encodes identically. Latitude to
   `[−85 + 10⁻⁹, 85 − 10⁻⁹]`: the tile that begins exactly at ±85° has no
   height in Mercator (both its edges project to the clamp), so anything at
   or beyond the limit names the last real tile inside it.
1. Compute `row`, `col` as in §2.3 and the region's coordinate code as in
   §2.4. Take the band scale `k` and the three cell sizes **from the region's
   south-west corner** (§2.2, using `latSW + 10⁻⁹` so an exact degree corner
   reads its own band).
2. Project the point to Mercator and **clamp it into the region's window**,
   a micrometre in from each edge:
   `[x(lngSW) + 10⁻⁶ m, x(lngSW + 0.2) − 10⁻⁶ m]` ×
   `[y(latSW) + 10⁻⁶ m, y(latSW + 0.2) − 10⁻⁶ m]`,
   then take the cell indices of the clamped point as in §2.2. The clamp only
   moves points that rounding placed a hair outside their own tile, and it
   guarantees the named cell has at least a micrometre inside the region.
3. **Sector.** Let `ai = (ay mod 30) · 30 + (ax mod 30)`, an index 0–899 into
   the sector raster. Apply the de-clustering permutation
   `pa(i) = (i · 389) mod 900` and take `ADJECTIVES[pa(ai)]`.
4. **Patch.** Let `pi = (py mod 56) · 56 + (px mod 56)`, 0–3135. Apply
   `pp(i) = (i · 1373) mod 3136` and take `NOUNS[pp(pi)]`.
5. **Spot.** `spot = (sy mod 5) · 5 + (sx mod 5) + 1`, 1–25.

Here `mod` is the non-negative modulo. The multipliers 389 and 1373 are primes
coprime to 900 and 3136 respectively, so each permutation is a bijection with
a computable inverse; they exist so that neighbouring cells do not carry
alphabetically neighbouring words. They are part of the frozen core.

### 4.1 Why the local triple repeats

`ax mod 30` means the sector adjective repeats every 30 sectors, i.e. every
25.2 km, and the patch noun every 56 patches, i.e. every 840 m within a
sector. The **local triple is unique within any 25.2 km × 25.2 km window**
and no further. Within a region it is unique outright, because a region is
narrower than 30 sectors. This is the trade discussed in §9.

---

## 5. Decoding

Given a squarename with a coordinate-code region:

1. Parse the region code to `row`, `col`; its south-west corner is
   `latSW = row · 0.2 − 90`, `lngSW = col · 0.2 − 180`. Compute `k` and the
   cell sizes from `latSW` (§2.2). The band is fixed by the corner: no
   circularity.
2. Look up the sector and patch words in their lists to get `ja`, `jp`; undo
   the permutations with the modular inverses: `ai = (ja · 389⁻¹) mod 900`,
   `pi = (jp · 1373⁻¹) mod 3136`, where `389⁻¹ mod 900 = 509` and
   `1373⁻¹ mod 3136 = 2549`.
3. **Sector cell.** The region's Mercator window `[x(lngSW), x(lngSW + 0.2))`
   contains fewer than 30 sector columns, so at most one column index `ax` in
   it satisfies `ax mod 30 = ai mod 30`; likewise at most one row `ay` with
   `ay mod 30 = floor(ai / 30)`. Find them by scanning the window. A region
   intersects only some of the 900 sector cells of the tiling, so an
   adjective may have no cell in the region; then no square in the region
   carries the name and decoding fails.
4. **Patch cell.** `px = ax · 56 + (pi mod 56)`, `py = ay · 56 + floor(pi / 56)`.
5. **Spot cell.** `sx = px · 5 + ((spot − 1) mod 5)`,
   `sy = py · 5 + floor((spot − 1) / 5)`.
6. The result is the spot's centre `( (sx + 0.5) · spotSize, (sy + 0.5) · spotSize )`
   in Mercator, **clamped into the same window as in encoding** (§4 step 2,
   the same micrometre margin), then projected back to latitude and
   longitude. The lattice is not aligned to tile edges, so a cell can
   straddle one and its centre may lie across the edge; the edge cuts through
   the cell, so the clamped point is still inside the cell. The decode point
   is therefore always inside the cell *and* the region, and encoding it
   reproduces the squarename.
7. **Verify.** Encode the point from step 6 and compare. A sector cell that
   straddles the region's edge has patch and spot cells wholly outside the
   region; a name using one of them is not the name of any point in the
   region, and the clamp in step 6 would return a neighbouring cell. If the
   re-encoded name differs, decoding fails.

Decoding fails (returns nothing) if the region code does not parse, a word is
not in its list, the spot is outside 1–25, or no square in the region carries
the name (steps 3 and 7). Every name produced by encoding decodes; a name
encoding never produces does not. A squarename whose region is an
alias rather than a coordinate code is resolved by the overlay (§8), which
enumerates the region tiles the alias covers and decodes the local triple in
each.

The decode point lies within 2.13 m (half a spot diagonal) of any point
that encodes to the squarename, and **encoding the decode point reproduces
the squarename, always** — including at band seams and region edges, which
is what the clamp in step 6 and the matching clamp in encoding (§4 step 2)
are for. The published test vectors include seam and edge cases and assert
the round trip.

---

## 6. Canonical string form

### 6.1 Canonical

```
<region>.<sector>.<patch>.<spot>[.<check>]
```

Lower-case, ASCII, dots between the four structural parts, an optional fifth
part for the check token. Dashes appear **only inside** a part: the region
code's `-d3`, and multi-word aliases such as `new-york`. This is the form for
URLs, storage, QR codes, and interchange:

```
51n1w-d3.brave.otter.7
51n1w-d3.brave.otter.7.6          (one-character check)
51n1w-d3.brave.otter.7.finch      (check word)
camden.brave.otter.7            (aliased region, see §8)
```

Punctuation alone distinguishes a squarename from other dash-separated
identifiers a product might use: **dots mean an address**.

### 6.2 Display

A display may render the same squarename as `51n1w-d3 · brave · otter · 7`
or omit the region where the context supplies it (a map already centred
within 25 km). Display is styling. **Any copied, shared, printed, or exported
string must carry all four parts.**

### 6.3 Parsing

A parser accepts, case-insensitively, the canonical form; middots (`·`) or
runs of whitespace in place of dots; and the legacy three-token form
`region sector-patch spot` in which the middle token is a hyphenated
adjective-noun pair. It splits on dots, middots and whitespace only, so a
dash inside a part is never a separator.

Token **count** decides whether a check token is present, never its shape:
a canonical squarename has four tokens and five with a check; the legacy
form has three and four. This matters because a check token may itself be
all digits (the char alphabet begins `0`–`9`; the value form is a number),
so a shape-based rule would mistake a digit check for a spot. The check
token is returned for verification, not verified. A squarename without one
still parses.

The parser rejects any other token count, a spot outside 1–25, and empty
parts. It does not validate words against the lists; that is decoding's job,
so that an alias region or a recognised variant spelling can still pass
through the parser.

---

## 7. The check token

The confusability rule catches single-character slips. It cannot catch a
mishearing that lands on a different valid word, a wrong spot number, or
errors in more than one part. The check token does.

### 7.1 The value

Over the local triple, with `s` the sector's list index, `p` the patch's,
and `n` the spot:

```
check(P) = (7·s + 3·p + 5·n) mod P
```

with `P` prime. A single-part error of size Δ escapes only if Δ ≡ 0 (mod P);
with `P > 3135` every single-part error is detected. The region is excluded
on purpose so the token stays valid whether the region is written as a code,
an alias, or omitted.

### 7.2 Three presentations

| Form | P | Encoding | Coverage of single-part errors | Use |
|---|---|---|---|---|
| **value** | 4099 | the number, written with at least two digits (`0007`) | 100% | machine, URLs |
| **char** | 31 | one character from the alphabet below | 30/31 | typed, printed |
| **word** | 3121 | `NOUNS[check]` | 3120/3121 | spoken |

The char alphabet, indexed 0–30, is

```
0 1 2 3 4 5 6 7 8 9 a b c d e f g h j k m n p q r s t v w x y
```

digits then lower-case letters omitting `i`, `l`, `o`, `u` and `z`. The word
form reuses the noun list, so a check word is itself phonetically distinct
from every other noun; it is spoken with a frame, *"brave otter seven, verify
finch"*, so it is not heard as a fourth name.

### 7.3 Verification

`verify(id, token)` infers the form from the token: **one character means
char** (the char alphabet begins with the digits, so a lone digit is a char,
never a value), two or more digits mean value, anything else is a word. This
is why the value form is written with at least two digits. It returns true
only on an exact match. A failed check means *do not resolve as-is*; a conforming user
interface asks rather than guesses.

---

## 8. The alias overlay (grammar only)

The region part of a squarename may be an **alias**: a name for one or more
region tiles, supplied by overlay data. `camden.brave.otter.7` and
`london.brave.otter.7` are squarenames whose regions are aliases.

The core defines only the grammar and the guarantees:

- An alias is one or more lower-case tokens joined by dashes, containing no
  dots, and not parseable as a coordinate code.
- Aliases are **additive**. Every region always has its coordinate code, which
  is the canonical, offline-resolvable form. An alias never replaces it and
  its absence never prevents resolution.
- An alias may cover several tiles. Resolution then returns every tile in
  which the local triple decodes, nearest first if a reference point is known.
  Because a local triple is unique within 25 km, an alias that spans less
  than that yields exactly one result, and a larger one yields a short list,
  never a wrong answer.
- Alias data is versioned separately from this specification and may grow
  without renumbering anything.
- Encoders should prefer the smallest confident named area under 25 km.

Which names exist, their polygons, and precedence between overlapping names
are implementation-defined.

---

## 9. Owned trade-offs

Stated plainly so implementers and users are not surprised.

- **Alias strings are not canonical.** Two conforming implementations may
  show the same square under different aliases (`london.…` and `camden.…`).
  Only the coordinate-code form identifies a square unambiguously across
  implementations; aliases are for people, and resolving one requires the
  overlay data that defined it.

- **The local triple repeats every 25.2 km.** *"Brave otter seven"* names one
  square within any 25 km window and another beyond it. For anything
  safety-critical, or any message that may travel, carry the region. The
  period is the product of vocabulary size and cell size, and 3 m cells with
  a curatable 900-word adjective list fix it where it is.
- **The latitude-band seam.** Cell sizes are recalibrated at each integer
  degree of latitude. Two points a hair's breadth apart across a seam are in
  different lattices and may have very different names. Seams are straight
  lines of latitude and fall where they fall.
- **Not equal-area.** Cells are 3 ground metres at the band's reference
  latitude and drift by up to about 1% within a band.
- **Clamped at ±85°.** The poles are not addressable; nobody meets there.
- **English words only in v1.** See §10.

---

## 10. Recognised variant spellings, retired words, and localisation

### 10.1 Recognised variant spellings

There is one wordlist and one edition. To resolve input from writers of
American English, an implementation applies the **recognised variant
spellings** table (published as `variant-spellings.json`) as an exact-match
substitution before any fuzzy correction. The table is bounded by the list:
it contains only variants of words that are in it, and none of the variants
is itself a list word. Encoders never emit a variant.

The table exists for the cases the confusability rule does not cover: variants
two or more edits away (`donut`, `omelet`, `checker`), and one case where the
fuzzy path would be wrong (`meter` is one edit from both `metre` and `meteor`).
The table is data, additive, versioned with the overlay.

### 10.2 Retired words

A word may be **retired**: replaced at its index by a new word that satisfies
§3.1 and §3.3 against the rest of its list. The retired word and its
replacement are recorded in the **retired words** table (published as
`retired-words.json`), keyed by the retired word, with the current word, its
index, and the wordlist version that retired it.

- Resolvers apply the table as an exact substitution wherever a word is
  looked up: decoding (§5), check tokens (§7), and input resolution. A name
  written under an earlier list therefore resolves to the same square, and a
  check word that was later retired still verifies.
- Encoders never emit a retired word.
- A retired word is never reused for any index in either list, so the
  substitution is unambiguous forever.
- Retiring a word is a minor wordlist version (§11). It changes what a
  square is *called*; it never changes which square a name resolves to.

Retirement exists for the words that a later reading finds unsuitable. It is
not a mechanism for reordering, growing, or shrinking a list, which remain
major changes.

### 10.3 Localisation

Translation is out of scope for v1. The design allows a language-tagged word
edition later, in which a squarename carries its edition and the local triple
is mapped through a per-language list of the same shape; the grid and the
region code are language-independent already.

---

## 11. Versioning

- **Core** — §2, §3, §4, §5, §6.1, §7 — is frozen at v1. A v1 squarename
  resolves to the same square forever. Any change to the grid, the order or
  size of the wordlists, the permutation constants, the check weights or
  primes, or the canonical grammar is a new major version, and
  implementations must treat the two as different address systems.
- **Wordlist minor versions** retire words in place (§10.2). Every name
  under the earlier list still resolves through the retired-words table, so
  a minor version is not a new address system; implementations update the
  lists and the table together.
- **Overlay** — alias data and the variant-spellings table — is additive and
  versioned independently.
- The reference implementation and this text are versioned together; the
  test vectors are regenerated from the reference implementation for every
  release.

---

## 12. Conformance

An implementation conforms to Squarenames v1 if it:

1. reproduces every entry of the published test vectors: encode, canonical
   strings, check tokens, a decode centre within 2.13 m, and the re-encoded
   name (or the flagged seam behaviour) as recorded;
2. accepts and rejects the published parse vectors as stated;
3. ships the wordlists byte-identical to v1.0.0, and the retired-words
   table, and passes the confusability validator on the lists;
4. never emits a copied or shared squarename without its region.

Inputs that sit exactly on a cell, band, or region boundary are decided by
floating-point evaluation, which can differ in the last bit between
languages and libraries. Conformance is therefore judged on the vectors that
lie **off** exact boundaries; the boundary vectors (those whose input is an
exact integer degree, an exact multiple of 0.2°, or a value within 1e−6° of
one) are informative. They record what the reference implementation does in
IEEE 754 double precision with the formulae as written, and an implementation
is encouraged, not required, to match them. The clamps in §4 and §5 make the
*round trip* exact regardless: whichever cell an implementation picks at a
boundary, decoding it and re-encoding returns the same name.

Only conforming implementations may describe themselves as implementing
Squarenames. The name is stewarded by SQRS; the specification and the
wordlists are free to use under their licences.

---

## 13. Governance

SQRS maintains the canonical specification, the reference implementation, and
the published test vectors, and decides on major versions. Proposals are made
in the public repository. The intent is the Plus Codes model: a company
stewards the standard, anyone implements it, and the promise that a name
keeps resolving outlives any one product.

---

## Appendix A — Reference constants

| Constant | Value |
|---|---|
| Mercator radius | 6378137 m |
| Latitude clamp | ±85° |
| Band width | 1° |
| Spot / patch / sector ground size | 3 / 15 / 840 m |
| Spots per patch side / patches per sector side / sectors per region window | 5 / 56 / 30 |
| Region tile | 0.2° |
| Adjective count / multiplier / inverse | 900 / 389 / 509 |
| Noun count / multiplier / inverse | 3136 / 1373 / 2549 |
| Check weights | 7, 3, 5 |
| Check primes: value / char / word | 4099 / 31 / 3121 |
| Check char alphabet | `0123456789abcdefghjkmnpqrstvwxy` |

## Appendix B — Files published with this specification

- `spec/test-vectors.json` — coordinate and parse vectors, regenerated per
  release by `scripts/build-vectors.ts`.
- `spec/variant-spellings.json` — the recognised variant spellings table.
- `spec/retired-words.json` — the retired words table (§10.2).
- `src/wordlist.ts` — the wordlists, with `validator/conflicts.ts`, the
  confusability validator, run against them in the test suite.
