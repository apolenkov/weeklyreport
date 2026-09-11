## Why

The complete source review found concrete problems in report data preservation, pending edits, query recovery, projections, test accuracy, and delivery checks. This change tracks their correction and final desktop acceptance so that finishing a review cannot be mistaken for delivering the working MVP.

## What Changes

- Carry all 231 accepted in-scope findings into traceable engineering tasks, with no dropped or duplicate IDs.
- Reconcile changed files with current report-authoring and feedback work before editing them.
- Correct confirmed behavior against existing specifications; create focused child changes with spec deltas when a missing or changed requirement needs to become durable.
- Complete architecture and desktop UI/UX verification, then run the full final acceptance against identified sources.

### Non-goals

- Mobile testing or redesign; the current visual direction is preserved.
- Security, access-control, credential, and cryptographic assessment, excluded by the user's scope correction.
- External publication, production readiness claims, or destructive database actions without their separately required authority.
- Copying raw review cards, logs, screenshots, or generated inventories into product documentation.

## Capabilities

### New Capabilities

None in this coordination change.

### Modified Capabilities

None directly. Individual repairs must read their owning existing requirements and carry any necessary deltas in a focused child change before behavior edits. File existence in the ownership map is a navigation aid, not proof that a requirement covers a finding.

## Impact

The work spans shared contracts, API, web, repository gates, seeds, and documentation. The initial review covers 2,466 source files at baseline HEAD `8796570475e7e94af00f0fce38472fccab1f8efc`, with SHA-256 manifest digest `a967de1b4bf21c5555d2ddd78a7cc91ca41de8d69fe4e4ed61c3bac6a979dc74`. That snapshot includes pre-existing worktree content. Final acceptance must also cover subsequent relevant source changes. Detailed evidence remains in the external execution artifact set for this review.
