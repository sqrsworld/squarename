# Contributing

Thank you for helping with Squarenames.

## What can change

- **The core** (grid, wordlist order and size, permutation constants, check
  token, canonical grammar) is frozen at v1. A change there is a new major
  version and is decided by SQRS as the maintainer of the specification
  (spec §11, §13). Open an issue to propose one; do not open a pull request.
- **Everything else** is open to pull requests: bug fixes in the reference
  implementation, tests, documentation, the retired-words and variant
  spellings tables, and ports to other languages.

## Before you open a pull request

```
pnpm install
pnpm check     # typecheck, lint, tests, build
```

If you touched encoding or decoding, run `pnpm vectors` and commit the
regenerated `spec/test-vectors.json` only if the change is intended; the
vectors are the conformance contract.

## Sign your commits

This project uses the [Developer Certificate of Origin](DCO) (DCO). By
signing off a commit you certify that you wrote the change or otherwise have
the right to submit it under the project's licence. Add the sign-off with

```
git commit -s
```

which appends a line like `Signed-off-by: Your Name <you@example.com>` to
the commit message. Pull requests with unsigned commits cannot be merged.

Contributions are accepted under the same licences as the project: the
Apache License 2.0 for code, and the Creative Commons Attribution 4.0
licence for specification text and wordlists. No separate agreement is
required.

## Commit messages

State what changed and nothing else. One change per commit where practical.
