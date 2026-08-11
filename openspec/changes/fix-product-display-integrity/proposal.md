## Why

The source-bound 38-screen product atlas found two user-visible integrity failures: the `full` seed leaves Finance leads with populated edit forms but an empty Section Preview, and a multi-group viewer receives multiple indistinguishable `Acknowledge` controls. The evidence is recorded in `~/work/customreport-archive/2026-08-11-product-form-atlas/ATLAS.json`, `STATUS.md`, and `UI-GUIDELINES-CODE-REVIEW.md`.

## What Changes

- Derive every seeded product's explicit reporting-group edge from the user's effective seeded group, including the Finance reassignment, and fail seed validation when those identities drift.
- Keep the lead's populated draft visible in Section Preview under the same group-scoped weekly-report read used by the product.
- Give every per-group acknowledgement control a stable human-readable group label so two actions never render as identical unlabeled buttons.
- Add focused seed, API/read-model, component, and browser regression evidence for the repaired desktop and representative mobile states.

### Non-goals

- No deep security review or authorization-model redesign.
- No exhaustive Cartesian product of every viewport, theme, locale, state, and control.
- No i18n rollout, Storybook introduction, external visual-testing service, or new UI framework.
- No unrelated cleanup of all static design-audit findings.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `demo-seed-datasets`: require effective user-group and explicit product-group assignments to agree, with a non-empty Finance lead walkthrough.
- `review-acknowledge-placement`: require each per-group acknowledgement control to identify its target group visibly and accessibly.

## Impact

Affected areas are deterministic Prisma seed composition and validation, the weekly-report live read model and shared schema if needed for group labels, report-page review presentation, focused Vitest/Prisma tests, and targeted Playwright evidence. The disposable `customreport_e2e` database may be reset under its existing destructive guard; no migration history or production data is involved.
