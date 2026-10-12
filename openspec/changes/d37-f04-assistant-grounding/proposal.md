# Proposal

## Why

The Lead assistant cannot resolve an authorized live Activity by its visible weekly title, and complete aggregate groups can exceed the configured grounding budget before an answer request. Public service regressions reproduce both boundaries in D37-F04.

## What Changes

- Resolve authorized Activity references by effective weekly title and catalogue name.
- Check the final serialized grounding estimate against the existing configured budget; return the existing `result_set_too_large` outcome before answering when complete aggregates do not fit.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `authorized-report-retrieval`: clarify authorized weekly Activity references and complete-grounding budget overflow.

## Impact

Search catalog, ContextBuilder and ReportAssistantService, with colocated public service tests. Existing contracts: `openspec/specs/authorized-report-retrieval/spec.md` and `openspec/specs/weekly-activity-presentation/spec.md`. Evidence: external D37-F04 public-roots-red-public-schema receipt.

## Non-goals

- No new limit, aggregate truncation, provider token guarantee or history policy.
- No permission expansion, mutable lookup for published snapshots or external provider calls.
