# Changelog

## 0.1.1

First release of the reference implementation and the v1 specification.

- Grid: `encode`, `decode`, `format`, `parse`, `regionCodeAt`, `isRegionCode`,
  the spot/patch/sector rings, `patchInstancesInBox`.
- Check token: `checkValue`, `checkChar`, `checkWord`, `verifyCheck`.
- Wordlists v1.0.0 (900 adjectives, 3136 nouns) with `WORDLIST_VERSION`.
- Recognised variant spellings table and `canonicalSpelling`.
- Retired words table (empty at wordlist 1.0.0) and `currentWord`; a retired
  word resolves in decoding, check tokens and input helpers.
- Input helpers: `editDistance`, `suggestWords`, `resolveWord`,
  `resolveWordDetailed`, `parsePartial`.
- Alias overlay hook: `AliasResolver`, `resolve`, `displayRegion`.
- Specification `spec/squarenames-v1.md`, 25 coordinate and 13 parse test
  vectors, the wordlist confusability validator.
