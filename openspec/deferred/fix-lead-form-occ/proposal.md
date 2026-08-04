# Fix lead-form OCC race condition

## Problem

The lead form uses optimistic concurrency control (OCC) via a `version` field
on `DraftSection`. When a lead wipes their section (DELETE) and then recreates
it (POST), a concurrent request from another lead can cause a last-writer-wins
race:

1. Lead A: `DELETE /draft-section/<id>` (version mismatch, fails, but deletes
   the DB row).
2. Lead B: `POST /draft-section` with old version number (succeeds, recreates
   with outdated content).
3. Lead A: retries `DELETE`, now returns 404; inconsistent state.

The OCC risk now lives in the section write transactions
(`save-section.transaction.ts` / `fill-from.transaction.ts`); the old
`lead-form.prisma-repository.ts` marker no longer exists — re-establish a
`TODO(<ref>)` at the current write-lock seam when this is activated.

## Solution

Strengthen OCC handling:

- Use a composite key for version checks: `(draftSectionId, versionNumber)`.
- On DELETE failure, return a meaningful error (410 Gone, not 409 Conflict).
- On POST, check if a section with the same `draftSectionId` already exists
  with a newer version; reject if true.
- Add event-sourced audit log for wipe/recreate cycles.

## Non-goals

- Implement full CRDT-style conflict resolution.
- Add real-time collaboration (two leads editing simultaneously).

## Source

- OCC write-lock seams: `save-section.transaction.ts` and
  `fill-from.transaction.ts` (no `TODO(<ref>)` marker there today).
- Regression identified in Phase 50 concurrency audit.

## Activation trigger

When concurrent-edit scenarios become high-frequency enough to trigger OCC
errors in production UAT. Current ETA: v8.5 or v8.6 if UAT does not expose
race.
