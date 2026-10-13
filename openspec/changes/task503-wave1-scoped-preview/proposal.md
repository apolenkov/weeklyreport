# Proposal

## Why

The head's assembled review preview exposes sections and portfolio totals from other reporting groups. TASK-503 C0499 reproduced the leak through the authenticated `review.assembledReport` procedure on real PostgreSQL.

## What Changes

- Scope the caller-facing assembled preview to the authenticated session's allowed groups, including its portfolio overview.
- Require an explicit session for preview reads and deny all sections for a groupless non-admin.
- Preserve full internal publication assembly and the publication transaction.
- Coordinator policy confirmed on 2026-10-13: preview is group-scoped; internal publication snapshot remains full.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `repository-scope-guard`: assembled review previews obey the same authenticated group visibility as other group-scoped reads.

## Impact

`review.router.ts`, the publication service/port and Prisma repository, and their existing tests. Reuse `groupScopeFilter` and the existing assembled mapper. Evidence: coordinator's `wave-01/native-core-r2.vitest/log` C0499 RED; current contract `openspec/specs/repository-scope-guard/spec.md`.

## Non-goals

- Publication lifecycle, scheduler, snapshot transaction, migrations or dependency changes.
- New authorization middleware or changes to admin full access.
