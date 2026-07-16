## Why

Web and API disagree on a covering risk whose `severity` is unset (the field is `.optional()` in `section.schema.ts`, so this is a legal live state, not just legacy data): the web floor (`deriveEffectiveStageStatus`) treats any covering risk as at least at-risk, while the API read-model derivation (`deriveEffectiveProductStatus`) filters unset-severity risks out before flooring, so they contribute nothing. `dedupe-severity-floor-ranking` preserved both behaviors byte-identically on purpose; the disagreement itself is the remaining defect — the same report can show a floored stage in the live form and an unfloored product in the published read model.

**Product fork to ratify (recommendation: web semantics).** A risk record is by definition at least "at risk" — flooring on coverage alone matches the risks-are-the-single-source-of-truth requirement in `status-risk-unification`; the API-side filter exists only as byte-identity preservation from the pre-dedup code, not as a decision. The alternative (API semantics: no severity, no floor) would silently ungate red/amber statuses the live form already shows the lead.

## What Changes

- Ratify one semantics for unset-severity covering risks (recommended: floor to at-risk everywhere).
- Delete the API-side eligibility filter in `deriveEffectiveProductStatus` so it feeds every covering risk through the shared `riskSeverityToCanonicalFloor` (which already maps unset → at-risk).
- Extend the shared characterization grids with the unset-severity permutation asserting IDENTICAL output on web and API paths.
- Update any published-snapshot/dashboard expectation that depended on the API filter.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `status-risk-unification`: unset-severity covering risks floor identically on every surface.

## Impact

- API: `report-sections.status-derivation.ts` (filter removal), derivation tests, possibly dashboard/snapshot fixtures.
- Web: no code change (already floors); its characterization grid gains the shared permutation.
- BEHAVIOR CHANGE on the API read model: products covered by an unset-severity risk may turn yellow where they were green — this is the point, and it needs the head's sign-off before implementation.

## Non-goals

- Making `severity` required in the schema (a separate product decision).
- Any change to the severity ladder, adapters, or collapse-down semantics.
