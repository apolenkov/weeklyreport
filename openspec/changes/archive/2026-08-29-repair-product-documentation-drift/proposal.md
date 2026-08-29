## Why

WeeklyReport's maintained product and durable capability map are ahead of its reader-facing documentation: the root README lacks a concise MVP capability summary, contains stale repository and gate details, five ADRs still claim archived and implemented decisions are pending, and current specs cite source paths removed by the completed slice migration. The evidence comes from `README.md`, `docs/adr/0009-*` through `docs/adr/0015-*`, `openspec/specs/README.md`, the current tracked-file inventory, and the archived 2026-07-02 changes.

## What Changes

- Add a concise role-based MVP capability summary to `README.md`, linked to the canonical capability map.
- Align README repository naming and acceptance commands with the current tree.
- Update ADR statuses and change references only where current source, focused tests, durable specs, and archived changes prove implementation.
- Replace stale current-source pointers in durable specs and ADRs with their tracked owners.
- Classify references that intentionally name generated, runtime, removed, or historical paths instead of rewriting them blindly.

### Non-goals

- No product behavior, API, schema, dependency, UI, runtime, or deployment change.
- No resurrection of E2E/UAT/browser/catalog/campaign harnesses.
- No implementation of deferred features or the six owner-deferred mobile changes.
- No rewrite of archived OpenSpec provenance.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `directory-architecture-standard`: replace obsolete positive ownership paths with the current real-model and feature-slice owners while retaining removed paths only as explicit negative examples.
- `dependency-currency`: remove the active Anthropic consumer-verification scenario because the SDK and AI module are absent from the maintained product and remain in the deferred activation backlog.
- `head-report-visibility`: reconcile the stale immediate-draft wording with the implemented submitted-only default and explicit `Show all` access path.
- `lead-form-loaded-view-model`: restore durable ownership of the unified-view flag default, total bucket mapping, and `carriedOver` behavior.
- `carry-over-automation`: align automatic carry-over eligibility with the implemented exclusion of postponed items and removal of the legacy `completed` field.

## Impact

Affected surfaces are `README.md`, selected files under `docs/adr/`, five durable specs, current durable specs with stale source pointers, and a TypeScript repository-test gate with an explicit exception ledger for intentional non-file paths. Application code, persistent data, runtime configuration, and external systems are unaffected.
