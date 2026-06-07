# Changelog

## [0.1.1] — 2026-06-07

### Changed
- README: updated tagline to emphasize retrieval, grounding, citation, freshness, and corpus signals
- README: added "Best for / Not for" section after vs. Alternatives comparison
- README: added answer correctness disclaimer (package scores evidence quality, not answer correctness)
- README: added "From Your Retriever to Candidate[]" integration mapping with LangChain and pgvector examples
- README: updated TOC to include new sections
- BUILD-PLAN: added full 0.2.0 implementation spec (breaking renames, configurable score bands, sub-signal breakdown, injectable `now`)

---

## [0.1.0] — 2026-06-07

### Added
- Initial release
- Core dimensions: Answer Grounding, Retrieval Confidence, Evidence Consistency
- Optional extensions: Source Authority, Corpus Completeness, Document Freshness
- Enhanced signals: faithfulnessScore, queryComplexity, citationCount, extractionQuality, source diversity
- Dual ESM + CJS build output via tsup
- TypeScript declarations included
- 179 unit and integration tests
- GitHub Actions CI (Node 20/22/24) and npm publish workflow
