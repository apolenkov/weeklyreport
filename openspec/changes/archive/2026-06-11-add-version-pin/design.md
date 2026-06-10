# Design — Add Version Pin

## Context

Leads autosave constantly, so `VersionSnapshot` rows accumulate fast and the
time-based retention sweep in
`lead-form.prisma-repository.ts:488-528` thins older ones (all <24 h kept,
hourly 24 h–7 d, daily 7–30 d, drop >30 d). A version a lead deliberately
cares about has no way to be marked or protected. The activation point still
carries the live TODO at `version-history-nav.tsx:23-25`.

This feature shipped once and was reverted twice. Reading both reverts is
load-bearing for re-implementation, so they are summarized here.

**What the reverted implementation contained (`git show a95681f5` and
`6d4726fe`):**

- `prisma/schema.prisma`: a `pinned Boolean @default(false)` column on
  `VersionSnapshot` (removed in `6d4726fe`).
- `packages/shared`: `pinned` field on `versionSnapshotSchema` (removed).
- API: `createVersionSnapshot(sectionId, opts?: { pinned?: boolean })`, a
  service `TODO(PIN-01)` "max 20 pinned per section" anti-abuse note, and the
  retention `DELETE ... AND pinned = false` guard so pinned rows survived
  any age. Integration tests asserted "never deletes pinned" and "pinned in
  the 24h–7d window survives thinning".
- Web: a "Pin version" button next to the v# pill (a filled star SVG, gated
  on `isLatest`), a `★` marker on pinned rows in the modal, and an
  `onSaveVersion` / `canSaveVersion` prop pair.

**Why it was reverted (commit messages):** the Pin control was wired so that
pinning was conflated with _creating_ a snapshot ("Save Version"), and since
autosave already creates a version on every change, the button looked
redundant — "autosave versions are enough". The second revert also removed a
half-built "Draft History" coming-soon widget that never surfaced.

**The lesson that informs this re-capture:** the reverted UI tied _pinning_
to _snapshot creation_ (a "Save Version + pin=true" button only enabled on
the latest version). That made pinning feel like a duplicate of autosave.
This change separates the two concerns: snapshots are still created only by
autosave; pinning is a pure toggle on _any existing_ version, expressed as
its own mutation. Pinning answers "keep this one findable", not "make a
snapshot now".

## Goals / Non-Goals

**Goals:**

- Let a lead mark any existing version of their own section as pinned, and
  unpin it later.
- Guarantee a pinned version is never removed by the retention sweep.
- Make pinned versions visually distinct and surfaced first in the history,
  so meaningful versions stop drowning in autosave churn.

**Non-Goals:**

- No "Save Version" / manual-snapshot button — autosave remains the only
  creator of snapshots. This is the specific mistake of the revert.
- No pin label/note, no pin cap (the reverted `TODO(PIN-01)` "max 20"
  guard stays deferred), no per-section pin analytics.
- No head/viewer/admin surface; no PDF/export change; no content diff.
- No new color tokens; no autosave-wiring change.

## Decisions

### D1 — `kind` enum over a `pinned` boolean

The reverted column was a bare `pinned Boolean`. This change models the
field as a `VersionSnapshotKind` enum with values `autosave` (default) and
`pinned` instead.

Rationale: a snapshot's _kind_ is a closed vocabulary that may later grow
(e.g. a future `restore-point` or `submitted` checkpoint) without a second
boolean column; an enum keeps the states mutually exclusive and named. It
also fits the repo's `enum-state-hygiene` invariant, which governs Prisma
enums + their Zod mirror. Trade-off vs. a boolean: a tiny bit more schema
surface; accepted for the clearer vocabulary.

`enum-state-hygiene` requires every persisted enum value to have a writer or
be removed. Both values get writers: `autosave` is written by
`createVersionSnapshot` (the default on every autosave), `pinned` is written
by the new `setVersionPinned` mutation. A test asserts each writer.

### D2 — Pin is a toggle on an existing version, not a creation flag

New tRPC mutation `leadForm.setVersionPinned({ reportSectionId, version,
pinned })`, on the lead-owned middleware chain (same ownership rule as
`createSnapshot` / `restoreVersion`: author-only, section not submitted).
It flips the `kind` of an already-stored row; it never creates a snapshot.

Repository method `setVersionPinned(sectionId, version, pinned)` updates the
one row by the `@@unique([reportSectionId, version])` key. Service validates
ownership and the not-submitted rule, mirroring `SnapshotService` /
`VersionHistoryService`.

Alternative considered — reuse `createSnapshot` with a `pinned` flag (the
reverted shape) — rejected: that is exactly what made the feature read as a
redundant "Save Version" button.

### D3 — Retention sweep exempts pinned rows

The retention `DELETE` in `lead-form.prisma-repository.ts:490-528` gains a
single guard so a pinned row is never a deletion candidate:

```
DELETE FROM "VersionSnapshot"
WHERE "reportSectionId" = ${sectionId}
  AND "kind" <> 'pinned'
  AND id NOT IN ( ... existing three keep-windows ... )
```

This restores the reverted `AND pinned = false` behavior, now expressed
against the enum. The three keep-windows (24 h / hourly / daily) are
unchanged.

### D4 — Pinned-first ordering in the nav, star control on each row

`listVersions` already returns newest-version-first. The web side groups the
list into a "Pinned" section above the chronological list (stable sort:
pinned rows keep their version order). The history modal renders a star
toggle on every row; the v# pill's own context stays as-is. The star uses an
existing accent token, not a new color — `status-color-semantics` forbids
new hues and reserves the alarm hue. Control heights ride the existing row,
honoring `ui-control-density`.

The reverted UI gated its Pin button on `isLatest`; this design drops that
restriction — any version can be pinned, which is the point (pin an _old_
milestone so retention doesn't drop it).

### D5 — Read-model carry-through

`versionSnapshotSchema` (`stage.schema.ts:26-41`) gains
`kind: versionSnapshotKindSchema` (Zod enum mirror of the Prisma enum), with
a default of `autosave` so legacy rows / pre-existing callers keep parsing
— matching the existing optional-count default pattern in the same schema.
`listVersions` (`lead-form.prisma-repository.ts:210-232`) maps `row.kind`
into the parsed object. The web `LeadVersionSnapshot`
(`lib/mappers/lead-form.ts:174-180`) and the mock `VersionSnapshot`
(`mock-data.ts:116-122`) gain a `pinned: boolean` (derived `kind ===
'pinned'`) — the UI only needs the boolean.

## Data Flow (before → after)

- **Before:** autosave → `createSnapshot` → `createVersionSnapshot` writes a
  row → retention sweep drops by age only. `listVersions` →
  `versionSnapshotSchema` (no kind) → web mapper → nav.
- **After:** same creation path, every row written `kind = 'autosave'`. A
  lead pin click → `leadForm.setVersionPinned` → repository flips one row to
  `kind = 'pinned'`. Retention sweep skips `kind = 'pinned'`. `listVersions`
  carries `kind`; mapper exposes `pinned`; nav groups pinned-first and marks
  rows.

## Invariants (load-bearing check)

- **destructive-db-guard / MVP DB rule** — schema reshaped directly:
  add the `VersionSnapshotKind` enum + `kind` column to
  `prisma/schema.prisma`, hand-sync the single init migration SQL, and
  `migrate reset` the non-prod DB. No incremental alter-table migration.
- **role-coverage-gate** — the new mutation MUST use one of the seven
  canonical lead-scoped middleware-chain builders (CI compares by reference
  identity); reuse the chain `createSnapshot` uses.
- **enum-state-hygiene** — both enum values get a production writer + test
  (D1).
- **period-dual-state** — untouched (no Report/period writes).
- **deferred-feature-pattern** — untouched; the pin control is real, not a
  `ComingSoonBadge`. The deferred "max 20 pins" guard stays a `TODO(PIN-01)`
  comment, the repo's backend-deferral marker.
- **status-color-semantics / ui-control-density** — no new tokens; the star
  uses an existing accent; row heights unchanged.

## Risks / Trade-offs

- **[Retention regression]** A wrong `kind <> 'pinned'` guard could either
  drop pinned rows or stop pruning entirely → restore the reverted
  integration tests ("never deletes pinned", "pinned survives hourly
  thinning") against the enum.
- **[Migration drift]** The single init migration must match the schema
  (enum + column) or `migrate reset` fails → hand-edit the init SQL and run
  `migrate reset` on the `_dev`/`_test` DB during implementation.
- **[Stale read model]** Old snapshot rows have no `kind` until the column
  default backfills → the column `@default(autosave)` + the Zod default keep
  legacy reads valid.
- **[Re-revert risk]** The feature was killed once for feeling redundant →
  D2 (pin is a toggle, not a creation button) is the explicit guard; keep
  the pin UI separate from any "save" affordance.

## Migration Plan

1. Schema: add `enum VersionSnapshotKind { autosave pinned }` and
   `kind VersionSnapshotKind @default(autosave)` on `VersionSnapshot`;
   hand-sync the init migration SQL; `migrate reset` the non-prod DB.
2. Shared: add `versionSnapshotKindSchema` + `kind` on
   `versionSnapshotSchema` (default `autosave`).
3. API: `setVersionPinned` repo method + service + tRPC mutation;
   `listVersions` carries `kind`; retention `WHERE` gains
   `AND "kind" <> 'pinned'`.
4. Web: mapper `pinned`, `mock-data` type, `version-history-nav` star
   control + pinned-first grouping, `lead-form` mutation wiring.
5. Tests: enum-writer tests, retention exemption integration tests,
   mutation contract test, nav unit test (star toggles, pinned-first order).
6. Gates → live screenshots → user acceptance → archive. Rollback:
   `git revert` (and the schema is disposable in MVP, so `migrate reset`
   recovers the DB).

## Open Questions

- Should a pinned version still count against the three retention
  keep-windows, or be fully out-of-band? Current design: out-of-band — a
  pinned row is excluded from the `DELETE` entirely (it neither consumes nor
  competes for a keep-slot). Confirm at implementation against the restored
  integration tests.
