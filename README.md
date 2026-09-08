# Squarenames

A squarename is a short, speakable address for a 3-metre square anywhere on
Earth, computed from a coordinate by formula and decoded back by the same
formula. Nothing is stored, nothing is looked up, no server is involved.

```
51n1w-e3.salty.rowan.6
```

- `51n1w-e3` is the **region**: a 0.2° tile, named by a self-describing
  coordinate code (51°N 1°W, sub-square e3).
- `salty` is the **sector**: an 840 m square, named by an adjective.
- `rowan` is the **patch**: a 15 m square, named by a noun.
- `6` is the **spot**: one of 25 three-metre squares in the patch.

The last three parts, *salty rowan six*, are unique within any 25 km window,
so people in the same town can say them alone. The region makes the name
unique worldwide.

This repository holds the specification and its reference implementation, an
npm package with no runtime dependencies. Developed and maintained by
[SQRS](https://sqrs.world).

## Install

```
npm install squarename
```

ES module, TypeScript types included, Node 18 or later and any modern bundler.

## Use

```ts
import { encode, decode, format, parse, verifyCheck } from "squarename";

const name = encode(51.5308, -0.1238); // King's Cross station, London
// { region: "51n1w-e3", sector: "salty", patch: "rowan", spot: 6 }

format(name); // "51n1w-e3.salty.rowan.6"
format(name, { check: "word" }); // "51n1w-e3.salty.rowan.6.shamrock"

const parsed = parse("51n1w-e3 · salty · rowan · 6 · shamrock");
if (parsed?.check && !verifyCheck(parsed, parsed.check)) {
  // ask, do not guess
}

decode(parsed!); // { lat: 51.5308…, lng: -0.1237… }, inside the same 3 m square
```

### Alias regions

A region may be written as an alias, `camden.salty.rowan.6`, supplied by
overlay data that this package does not carry. Provide the overlay through an
`AliasResolver` and use `resolve`:

```ts
import { resolve, type AliasResolver } from "squarename";

const aliases: AliasResolver = {
  regionsFor: (alias) => (alias === "camden" ? ["51n1w-d3"] : null),
  aliasFor: (region) => (region === "51n1w-d3" ? "camden" : null),
};

resolve("camden.salty.rowan.6", { aliases });
// [{ region: "51n1w-d3", lat: …, lng: … }]
```

An alias that covers several tiles returns one result per tile in which the
local triple decodes, nearest first when `near` is given.

### Retired words

A word can be replaced at its index in a later wordlist version. The old word
is *retired* and recorded in `spec/retired-words.json`; decoding, check tokens
and the input helpers all accept it, so a name written under an earlier list
still resolves to the same square. Encoders never emit a retired word.

### Input helpers

`suggestWords`, `resolveWord`, `resolveWordDetailed` and `parsePartial`
complete and correct typed words against a candidate list. The wordlists have
a minimum edit distance of 2, so a distance-1 correction is unique; recognised
American variant spellings (`meter` → `metre`) are applied first.

### Everything exported

| Group | Exports |
|---|---|
| Grid | `encode`, `decode`, `format`, `parse`, `squarenameAt`, `regionCodeAt`, `isRegionCode`, `spotRing`, `patchRing`, `sectorRing`, `patchInstancesInBox`, `SPOT_M`, `PATCH_M`, `SECTOR_M`, `REGION_DEG`, `BAND_DEG` |
| Check token | `checkValue`, `checkChar`, `checkWord`, `verifyCheck`, `CHECK_P_FULL`, `CHECK_P_CHAR`, `CHECK_P_WORD`, `CHECK_CHAR_ALPHABET` |
| Wordlists | `ADJECTIVES`, `NOUNS`, `WORDLIST_VERSION` |
| Variants | `VARIANT_ADJECTIVES`, `VARIANT_NOUNS`, `canonicalSpelling` |
| Retired words | `RETIRED_ADJECTIVES`, `RETIRED_NOUNS`, `currentWord` |
| Input | `editDistance`, `suggestWords`, `resolveWord`, `resolveWordDetailed`, `parsePartial` |
| Aliases | `resolve`, `displayRegion`, `AliasResolver` |

## The specification

[`spec/squarenames-v1.md`](spec/squarenames-v1.md) defines the grid, the
wordlists and their confusability rule, encoding, decoding, the canonical
string form, the check token, the alias grammar, versioning and conformance.

Published with it:

- [`spec/test-vectors.json`](spec/test-vectors.json): 25 coordinate vectors on
  band seams, region edges, the equator, the prime meridian, the antimeridian,
  both hemispheres and the ±85° clamp, plus 13 parse vectors. An implementation
  conforms if it reproduces them (spec §12).
- [`spec/variant-spellings.json`](spec/variant-spellings.json): the recognised
  variant spellings table.
- [`spec/retired-words.json`](spec/retired-words.json): the retired words
  table.
- [`validator/conflicts.ts`](validator/conflicts.ts): the wordlist
  confusability validator, run against the shipped lists in the test suite.

## Develop

```
pnpm install
pnpm test        # unit tests, validator, published vectors
pnpm typecheck
pnpm lint
pnpm build       # dist/
pnpm vectors     # regenerate spec/test-vectors.json from src/
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Commits are signed off under the
[Developer Certificate of Origin](DCO).

## Versioning

The core (grid, wordlists, permutation constants, check token, canonical
grammar) is frozen at v1: a v1 squarename resolves to the same square forever.
Reordering or resizing a list is a new major version and a different address
system. Replacing a word at its index is a minor wordlist version: the old
word is retired and keeps resolving. Alias data and the variant spellings
table are additive and versioned separately.

## Licence

- Code: [Apache License 2.0](LICENSE).
- Specification text and wordlists: [Creative Commons Attribution 4.0](LICENSE-SPEC).

"Squarenames" and "SQRS" are names stewarded by SQRS. Only conforming
implementations may describe themselves as implementing Squarenames.
