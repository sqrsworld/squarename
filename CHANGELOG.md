# Changelog

## 0.2.0

Wordlist 1.1.0: 70 words retired in place (spec §10.2). No index moves, so no
squarename renumbers; a name written with a retired word resolves to the same
square through `spec/retired-words.json`.

- Adjectives (13): hot → large, abloom → natural, titchy → modern, whizzy →
  smart, swishy → classic, ribboned → magic, young → perfect, youthful →
  instant, naive → metallic, petite → regular, tender → true, cheeky → great,
  public → fine.
- Nouns (57): pronoun → fish, swamp → gift, caboose → answer, specimen →
  record, oxeye → design, cobnut → fashion, venturer → message, avocet →
  captain, dugong → author, giblets → surprise, enlarger → machine, ziti →
  horse, drinker → journey, keg → holiday, cocktail → lunch, chaser →
  champion, ashtray → bicycle, playtime → harvest, bathtime → outfit, bedtime
  → reward, anaconda → image, salami → echo, joystick → sprint, lotion →
  comfort, magnum → headline, calibre → diagram, breather → nickel, grabber →
  glimpse, fishnet → update, chatroom → signal, teenager → league, youth →
  quiz, pupil → orbit, brownie → award, mushroom → exercise, pub → frame,
  tavern → voice, barroom → phrase, winery → flight, vineyard → weather,
  cabernet → coin, cask → pattern, tankard → sound, flagon → choice, decanter
  → network, skunk → project, bap → question, crutch → bargain, chimp → board,
  gorilla → trade, casino → material, poker → subject, roulette → research,
  jackpot → cartoon, lotto → effect, hypnosis → sandwich, swallow → shield.
- Variant `caliber` still maps to `calibre`; the retired-words table then takes
  it to `diagram`. Spec §10.1 now allows a variant of a retired word.
- Test vectors regenerated for wordlist 1.1.0.

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
