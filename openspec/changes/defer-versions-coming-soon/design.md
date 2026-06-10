# Design — Defer Version History, Stabilize Saving

## Context (verified in code, 2026-06-11)

Version data flow today:

- **Write path**: `use-lead-form-autosave.ts` fires
  `onSaveSuccessAction` after every successful `saveDraft`
  (autosave debounce AND `forceSave` from `SaveNowButton` share the
  same mutation success path). `lead-form.tsx:676-681` turns that
  signal into `leadForm.createSnapshot`. Server side,
  `SnapshotService.createSnapshot` applies a 60 s throttle +
  content dedup before `repository.createVersionSnapshot`.
- **Read path**: `lead-form.tsx` `versionsQ`
  (`leadForm.versions`, line 342) **gates the page skeleton**
  (`!versionsQ.data` → `<LeadFormSkeleton />`, line 730) and feeds
  `VersionHistoryNav`, the autosave label prefix
  (`Version N · HH:MM`, line 1442-1446), and `mapLeadFormData`.
  `getVersionQ` + `viewedSnapshotVersion` drive the F3.4 snapshot
  read-only overlay; `restoreMut` drives restore.
- **Internal writers that bypass throttle**:
  `VersionHistoryService.fillFrom` (line 40) and
  `VersionHistoryService.restoreVersion` (line 119) call
  `repository.createVersionSnapshot` directly as pre-overwrite
  safety nets.
- **Passive read elsewhere**: `trpc.router.ts:349/406` counts
  `versionSnapshots` into `versionCount` for the reports listing —
  a read, not a write; untouched by this change.

Fidelity bug anchor:
`lead-form.prisma-repository.ts:296-303` — restore keeps current
`stageStatus` rows when the snapshot predates the `stageStatuses`
field, so a restored page mixes two points in time.

## Decisions

### D1 — Stub at the tRPC procedure level, keep services + tests

The deferred-feature spec allows the loud stub at "any NestJS service
or tRPC procedure" entry point. We stub the 4 procedures
(`versions`, `getVersion`, `restoreVersion`, `createSnapshot`) and
keep `VersionHistoryService`, `SnapshotService`, the repository
methods, retention, and ALL their integration/characterization tests
green and intact
(`version-history.integration.test.ts`,
`version-retention.integration.test.ts`,
`version-snapshot.characterization.integration.test.ts`).

Rationale: those tests are the executable behavioral spec the
re-enable change will start from; deleting or stubbing them would
discard exactly the knowledge the deferral wants to preserve. The
public API surface is still loudly dead — no caller can reach the
services. The raw `Error` maps through `mapDomainError` to
`INTERNAL_SERVER_ERROR`, which is acceptable for a
deliberately-unreachable path (loud beats polished).

A new contract test pins the stub: each of the 4 procedures rejects
with the `Not implemented — see TODO(defer-versions-coming-soon)`
message (em-dash, matching the repo convention in
`telegram.module.ts:43`).

### D2 — Web stops calling version endpoints entirely

The skeleton gate means a stubbed `leadForm.versions` would brick the
lead page; hiding the UI is not enough. So `lead-form.tsx` removes:

- `versionsQ` (+ its skeleton-gate term and load-error toast block),
- `getVersionQ`, `viewedSnapshotVersion`, the snapshot overlay
  banner, the snapshot-mode skeleton branch, and the
  snapshot-derived stage-status lookup (~line 812),
- `restoreMut` + `handleRestoreVersion`,
- `createSnapshotMut` + the `onSaveSuccessAction` wiring,
- the `Version N · ` prefix in `autosaveLabel` (it would freeze at a
  stale number forever) — the label keeps the plain saved time,
- `versions` input of `mapLeadFormData` and downstream `data.versions`.

Each removal site that marks a future activation point gets
`TODO(defer-versions-coming-soon)`. Orphans created by the edit
(unused imports, `VersionSnapshot` type uses, dead mapper params,
stale cache-key invalidations) are removed in the same commit.

### D3 — `fillFrom` keeps its internal pre-overwrite snapshot write

Stated assumption (non-interactive run): the user's "disable writes"
decision named the autosave/manual-save paths. `fillFrom` is a live,
destructive overwrite of the section; its direct
`repository.createVersionSnapshot` call is a data-safety net (an
operator can still recover via DB even though the restore UI is
deferred). Removing it would create a new data-loss window with zero
benefit — the table stays anyway. It is marked
`TODO(defer-versions-coming-soon)` as the single remaining writer.
If the user prefers full write silence, deleting that one line is a
follow-up one-liner.

### D4 — `onSaveSuccessAction` is removed from the hook

After D2 the hook prop has zero callers; the surgical-change rule
says remove the orphan. Hook tests covering the callback are
rewritten to the new contract (no snapshot signal); this is contract
replacement, not test weakening — the behavior itself is deferred and
its server-side spec survives per D1.

### D5 — Inert control replaces the nav, same file

`version-history-nav.tsx` is rewritten as an inert
`VersionHistoryNav` (kept export name, prop-less): disabled button
shell in the toolbar slot, history glyph + "Versions" semantics via
`aria-label="Version history is coming soon"`, `aria-disabled`,
`title="Coming Soon"`, `data-testid="version-history-coming-soon"`,
wrapped with `ComingSoonBadge` exactly like
`LanguageComingSoonControl` (nav-bar.tsx:170-184). The old
interactive component lives in git history; the deferred-feature
spec's activation rule (remove the badge wrapper entirely) applies on
re-enable. Copy stays English (UI-strings rule).

### D6 — Save-stability verification scope

The contract for "saving is maximally stable" after the snapshot
trigger removal:

- autosave: debounce coalesces rapid edits; success transitions
  pending→saving→saved with no snapshot side effect; failure surfaces
  `state: "error"` (toolbar "⚠ Save failed") and keeps `dirty: true`
  so the next edit retries; `beforeunload` guard while dirty.
- manual save: `forceSave` cancels the debounce timer, saves
  immediately, queues when a mutation is in flight;
  `SaveNowButton` shows the pending treatment from
  `save-now-pending-indicator` (this change rebases on its state of
  `save-now-button.tsx` and must not regress its tests).

Existing coverage in `use-lead-form-autosave.test.tsx` and
`save-now-button.test.tsx` is audited against that list; missing
cases are added, none removed.

## Invariants touched

- **deferred-feature-pattern** — applied (delta in this change);
  pattern itself unchanged.
- **destructive-db-guard** — preserved: no migration, no table drop.
- **period-dual-state / role-coverage-gate** — untouched (no new
  procedures; stubs keep the existing `protectedProcedure` builders).

## Rollout

Single change, no migration, no flag. Order inside the change
matters: web stops calling the endpoints (D2) before or together with
the backend stubs (D1) — never stubs first, or the lead page
skeleton-locks. Both land in one branch, so only task order within
this change encodes that.
