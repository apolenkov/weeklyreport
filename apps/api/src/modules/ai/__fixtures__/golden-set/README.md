# Golden-set Fixtures

**Status:** draft, awaiting head sign-off (CONTEXT.md C-5)

These 8 synthetic fixture reports are the input to `pnpm test:ai-eval`,
the live-API regression harness for AI-01/02/03 (Phase 31).

## Constraints
- All content is SYNTHETIC. No real client names, no real deal sizes,
  no real financials. Placeholders: Acme, Globex, ProjectAlpha, etc.
- Each fixture provides:
  - `report` shaped like an `assembledReport` for AI-01 input
  - `risks` array (with synthetic risk text) for AI-02 inputs
  - `cells` array (sectionId × projectId pairs with pre-computed counts)
    for AI-03 inputs
- `expected.*` fields define the rubric the eval test scores against.

## Pass thresholds (loose, will tighten after head review)
- ≥80% sentiment-classification match across all golden risks
- ≥80% on-track-classification match across all golden cells
- 0 hallucinated counts (no foreign digit-strings in narrative or rationale)
- summary narrative ≤ 3 sentences
