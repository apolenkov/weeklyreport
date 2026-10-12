# Design

## Context

See proposal.md and D37-F11's source checkpoint. The assigned published base already includes F10 section-local stableId validation plus print deadlines, CLS10 admission and the inclusive reportDate message. These sources are not rewritten. The three primary tests failed on unchanged base production for their intended reasons.

## Goals / Non-Goals

**Goals:** Keep wire validation consistent with storage, return existing URL issues predictably, and assemble short labels from present parts. Define each selected existing contract once.

**Non-Goals:** Host/prefix policy, business timing limits, stored-name validation, completed+failed counter semantics, published membership, migration, authorization or runtime configuration changes.

## Decisions

- Reminder input previously allowed safe integers outside its INTEGER column; use Zod's existing int32 validator before the same API and restore consumers. Negative, zero and positive representable offsets remain admitted. A smaller business limit or min0 would change existing policies and is excluded.
- A malformed URL already has a format issue from the nested schema. Recovery refinement now catches URL parsing failure and returns, preserving that issue and its path. Adding host equality or altering suffix matching would change portable snapshot behavior and is excluded.
- `adminUserSchema` admits a whitespace surname; `shortName` trims it and joins present surname/initials. Full-name writes and Unicode code-point initial extraction remain unchanged; a final-output trim would hide assembly rather than own it.
- Derive prompt contents through the existing exhaustive enum-key record, preserving all required slots, strict unknown-key rejection and text validation. Share a private role tuple between two independent schema objects. Share the two existing progress comparisons privately with an issue-path prefix, retaining the reconciliation sentinel. Filter valued portfolio contributions once, then derive the same statuses/ids/names while retaining occurrence stage counts, risk floors, representative names, deduplication and ordering.
- Linked API workspace dependencies resolve shared producers to Root main. The Root-approved H-only wrapper inherits the exact worktree API config and overrides only two source aliases. Tracked configuration, default final-gate resolution and dependency links remain unchanged.

## Risks / Trade-offs

- Schema-only proof is not database/native UI acceptance → Root owns final guarded/native checks and all six gates.
- Refactoring can change issue paths or participation → independent domain controls cover nested/top-level progress and mixed-null/all-null portfolios.
- Existing print abort and CLS10 fixes have no fresh behavior defect → run current owners and preserve native timing/quantile claims as needs-evidence.
- Lifecycle tuple, canonical middleware identity and destructive guard remain unchanged; no DB operations or rollout migration are required. Root can reverse the scoped patch if delivery needs rollback.
