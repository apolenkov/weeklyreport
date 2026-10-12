# Proposal

## Why

Current feedback filters classify malformed input as a server fault, report date inputs accept values their read models reject, pending queries show false emptiness, and a draft co-owner loses its red-only content. Existing public/parser RED controls in the external D37-F10 BRIEF handoff also show frozen name disagreement, repeated-row key collisions and weaker notification email admission.

## What Changes

- Align manual/history period dates and notification email admission with current shared owners.
- Classify malformed feedback URL at its request boundary; keep unexpected errors as server faults.
- Preserve owned frozen product metadata when referenced labels disagree.
- Keep no-data pending loading and own draft red eligibility while retaining global escalation dedup.
- Preserve repeated risk rows and reuse canonical product avatars. Reuse existing region/totals/scope/singleton owners without changing values.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `period-scheduler-wiring`: manual date input agrees with persisted Report date guard.
- `lead-history-summary`: personal period date format agrees with current Report date owner.
- `authenticated-product-feedback`: malformed list URL receives the existing invalid-request response.
- `published-portfolio-snapshot`: owned metadata wins over referenced labels in recovered frozen sections.
- `admin-snapshot-restore`: per-section Item lineage identity follows the current unconditional Item composite key.
- `head-report-visibility`: own red-only draft content remains revealable independently of the global representative.
- `report-routing`: pending no-data reads are loading, and no-period requires actual data.
- `admin-settings-ui`: notification email form uses current shared settings admission.
- `head-dashboard-clarity`: distinct risk occurrences and canonical product avatars remain renderable.

## Impact

Only D37-F10 owned shared/API/Web/seed sources and granted existing tests; no migrations, dependencies, middleware builders, lifecycle writers or main specs. External task reference: D37-F10/BRIEF.json and exact original ticket records.

## Non-goals

- No new auth, defaults, numeric/brand charset policy, risk/decision lineage rule, UTC policy or compatible fallback.
- No source change for rejected diagnostic enrichment, unavailable native overflow precondition.
- Native API/PG/browser/AT, whole gates and aggregate review remain Root-owned evidence.
