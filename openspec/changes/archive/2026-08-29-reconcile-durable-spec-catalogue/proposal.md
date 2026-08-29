## Why

The durable capability catalogue contains five stale governance/audit contracts and nine contracts whose current wording must be reconciled with the accepted implementation history. A focused catalogue change is needed now so the durable index reflects one authoritative final set while archived changes remain available as provenance.

## What Changes

- **RETIRE** exactly five stale durable specs: `critical-integrity-repair-gate`, `exemplary-finding-adjudication`, `exhaustive-quality-remediation`, `frontend-audit-memo`, and `review-finding-triage`.
- **UPDATE** exactly nine durable specs: `demo-seed-datasets`, `dependency-currency`, `destructive-db-guard`, `lint-max-strictness-standard`, `public-endpoint-resource-limits`, `ui-role-route-access`, `exemplary-repo-floor`, `cleanup-tail`, and `report-record-ordering`.
- Reconcile `openspec/specs/README.md` so it indexes the final durable set exactly once and preserves canonical capability homes.
- Record removal reasons and migration paths in each retirement delta; preserve archived change history as provenance.
- Remove stale dynamic counts in docs only as a later implementation task; this planning change does not edit durable specs, code, or docs.

### Non-goals

- No implementation of the retirements or updates in this planning change.
- No archive deletion, archive rewrite, code change, or direct durable-spec/index edit.
- No new capability or runtime behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `critical-integrity-repair-gate`: retire stale audit-gate contract.
- `exemplary-finding-adjudication`: retire stale campaign adjudication contract.
- `exhaustive-quality-remediation`: retire stale exhaustive-campaign contract.
- `frontend-audit-memo`: retire stale planning memo contract.
- `review-finding-triage`: retire stale recurring-finding triage contract.
- `demo-seed-datasets`: reconcile the canonical seed-profile contract.
- `dependency-currency`: reconcile the dependency/runtime currency contract.
- `destructive-db-guard`: reconcile the disposable-target safety contract.
- `lint-max-strictness-standard`: reconcile the current lint/rachet contract.
- `public-endpoint-resource-limits`: reconcile public ingress limits.
- `ui-role-route-access`: reconcile role-denial and route-home behavior.
- `exemplary-repo-floor`: reconcile the repository quality-floor contract.
- `cleanup-tail`: reconcile the cleanup-tail contract.
- `report-record-ordering`: reconcile durable record ordering and identity.

## Impact

Implementation will later touch only the durable-spec files, the durable-spec index, and selected documentation counts. Archived changes remain read-only provenance. Inventory basis: the current `openspec/specs/README.md` and the 14 named durable capability files.
