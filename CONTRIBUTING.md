# Contributing to transparent-confidence

Thanks for your interest. This is a small, focused library with strict constraints — reading this page first will save you time.

## Ways to contribute

- **Report a bug** — open an issue with the scoring inputs, the scorecard you got, and the scorecard you expected. Deterministic scoring means every bug is reproducible from inputs alone.
- **Pick up a `good first issue`** — [filtered list](https://github.com/emtcmca/transparent-confidence/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22). These are scoped to be completable without deep knowledge of the codebase.
- **Improve docs or examples** — recipes for wiring real retrievers/evaluators into `ScoringInputs` are especially welcome.
- **Discuss v1.0 API** — the next milestone freezes the public API. If a signature or type name reads wrong to you, now is the time to say so.

For non-trivial changes, open an issue first so we can agree on approach before you write code.

## Development setup

```bash
git clone https://github.com/emtcmca/transparent-confidence.git
cd transparent-confidence
npm install
npm test          # 412 tests, all must pass
npm run verify    # typecheck + lint + tests + build — run before every PR
```

Node ≥ 20 required.

## Hard constraints

These are architectural rules, not preferences. PRs that violate them will not be merged, however good the code:

1. **Zero runtime dependencies.** `dependencies` in `package.json` stays empty. If a feature needs a library, the feature is out of scope.
2. **Deterministic and synchronous.** Same inputs → same scorecard, every time. No network calls, no LLM calls, no randomness, no clocks read at score time (freshness comparisons take timestamps as inputs).
3. **Explainability travels with the score.** Every dimension change must produce or update the `explanation` field. A point that can't explain itself doesn't ship.
4. **Versioned algorithm.** Any change to scoring behavior bumps `algorithmVersion` and gets a migration note. Additive, non-behavioral changes don't.

## Testing

- Tests are written against the public API (`computeConfidence` and exported helpers), never against internals.
- Every behavioral change needs a test that fails before the change and passes after.
- Coverage targets: ≥ 90% line, ≥ 95% function, ≥ 85% branch (`npm run coverage`).

## Pull request checklist

- [ ] Issue exists and approach was discussed (for non-trivial changes)
- [ ] `npm run verify` passes locally
- [ ] New behavior has tests; changed behavior has updated tests
- [ ] `CHANGELOG.md` entry added under an `Unreleased` heading
- [ ] No new runtime dependencies

## Code style

Biome enforces formatting and lint rules (`npm run lint:fix`). Match the existing naming — the terms in the README (dimension, extension, signal, scorecard, action policy, preset) are canonical; don't introduce synonyms.

## License

By contributing, you agree your contributions are licensed under [Apache-2.0](LICENSE).
