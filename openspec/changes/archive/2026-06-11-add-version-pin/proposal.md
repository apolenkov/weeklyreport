# Add Version Pin

## Why

A lead's section autosaves a new `VersionSnapshot` on every change, so the
version list fills with churn and the few snapshots a lead actually cares
about (a milestone draft, a pre-rewrite checkpoint) drown in the noise and
are eventually thinned by time-based retention. Leads need to mark a
meaningful version so it stays findable and survives cleanup.

The feature was built once and reverted in two commits — `a95681f5`
("drop Pin button — autosave versions are enough") and `6d4726fe`
("remove pinned feature + strip coming-soon widget"). The activation point
still carries a live TODO at `version-history-nav.tsx:23-25`. This change
re-captures the feature with the lessons from the revert baked in (see
`design.md`).

## What Changes

- Add a snapshot "kind" to the data model so a snapshot is either a routine
  autosave or a lead-pinned checkpoint. Reshape `prisma/schema.prisma`
  directly and keep the single init migration in sync (MVP DB rule).
- Add a tRPC mutation for a lead to pin/unpin an existing version of their
  own section.
- Exempt pinned snapshots from the time-based retention sweep so a pinned
  version is never auto-pruned.
- Surface a star (pin/unpin) control in `VersionHistoryNav` and mark pinned
  rows in the history modal; sort pinned versions to a "Pinned" group above
  the chronological list.
- Carry the pin state through the read model (`versionSnapshotSchema`,
  the API repository `listVersions`, and the web mapper) so the UI can
  render it.

**Non-goals:** no per-pin label/note; no pin cap or anti-abuse limit (the
reverted `TODO(PIN-01)` "max 20 pinned" guard stays deferred); no head /
viewer / admin surfaces; no new color tokens; no change to how snapshots
are created (autosave wiring untouched); no content-level diff.

## Capabilities

### New Capabilities

- `version-pinning`: a lead can mark a meaningful version of their own
  section as pinned; pinned versions are retention-exempt, distinctly
  marked, and surfaced first in the version history.

### Modified Capabilities

<!-- none: schema-conventions, enum-state-hygiene, status-color-semantics,
     ui-control-density, role-coverage-gate, deferred-feature-pattern,
     destructive-db-guard are respected, not changed. -->

## Impact

- `prisma/schema.prisma` (`VersionSnapshot` model) + the single init
  migration SQL.
- `packages/shared/src/schemas/stage.schema.ts` (`versionSnapshotSchema`).
- `apps/api`: `trpc.router.ts` (new pin mutation), `snapshot.service.ts` /
  `lead-form.service.ts` (or `version-history.service.ts`),
  `lead-form.prisma-repository.ts` (`listVersions` projection,
  `createVersionSnapshot` default kind, retention `WHERE` guard, new
  `setVersionPinned`).
- `apps/web`: `version-history-nav.tsx` (star control + pinned-first
  ordering), `lead-form.tsx` (mutation wiring), `lib/mappers/lead-form.ts`
  (`LeadVersionSnapshot`), `mock-data.ts` (`VersionSnapshot` type).
- Status: CAPTURED 2026-06-10 (capture-only; implementation deferred).
