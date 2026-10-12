# Proposal

## Why

Admin list counts and empty messages can contradict visible records. Reminder editing can lose its input error and keyboard focus; short accessible record labels can contain split Unicode characters. The deterministic publication example names a route the product does not use. Genuine public-owner baseline regressions confirm these failures.

## What Changes

- Show Jobs matches separately from loaded rows; preserve cursor loading and queue behavior.
- Select Products empty copy from the existing search/deep-link filter.
- Preserve invalid offset input during normalization and describe its whole-number rule. Restore the existing inline editor focus contract through the search field when its edit trigger is hidden.
- Keep short accessible labels on complete grapheme boundaries within their existing 60 UTF-16-unit budget.
- Identify the successful synthetic publication fixture as `period.publish`.
- Derive Settings triggers from the existing section list; remove unused user-dialog groups wiring; make four dependency imports type-only.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This implements existing requirements and repairs existing behavior; `skip_specs: true` avoids inventing a new policy or delta. Owning contracts: `list-empty-state-fidelity`, `admin-reminders-ui`, `admin-settings-ui`, `admin-action-log-details`, `demo-seed-datasets`, and the exemplary code standard.

## Impact

Only the D37-F12 declared source/test owners. Handoff: D37-day1/D37-leaf-briefs/D37-F12/BRIEF.json and SCOPE-AND-RED-PLAN.md, covering twelve normalized draft cards and fourteen original comments. Backlog state remains coordinator-owned.

## Non-goals

- No new routes, authorization builders, data model, date policy, parsing grammar, runtime configuration or dependencies.
- No unmeasured optimization or unsupported-platform fallback.
- No seed execution, provider requests, native/AT acceptance or aggregate-gate claim in author checks.
