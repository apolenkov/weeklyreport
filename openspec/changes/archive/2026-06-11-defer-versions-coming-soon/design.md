# Design — Remove Version History Entirely, Stabilize Saving

Rewritten 2026-06-11 to the user's full-removal decision. The previous
design (keep schema, stub endpoints, preserve services + tests as the
behavioral spec) is superseded; it survives in git history of this file.

## Context — version data flow today (verified in code, 2026-06-11)

- **Write path**: `use-lead-form-autosave.ts` fires `onSaveSuccessAction`
  after every successful `saveDraft` (autosave debounce and `forceSave`
  from `SaveNowButton` share the mutation success path).
  `lead-form.tsx:676-681` turns that signal into
  `leadForm.createSnapshot`. Server side, `SnapshotService` applies a
  60 s throttle + content dedup before
  `repository.createVersionSnapshot`, which also runs the time-based
  retention sweep (`lead-form.prisma-repository.ts:461` and `:489`,
  with the `add-version-pin` `"kind" <> 'pinned'` exemption).
- **Read path**: `lead-form.tsx` `versionsQ` (`leadForm.versions`)
  gates the page skeleton (`!versionsQ.data` → `<LeadFormSkeleton />`)
  and feeds `VersionHistoryNav`, the `Version N · HH:MM` autosave-label
  prefix (`lead-form.tsx:1427-1430`), and `mapLeadFormData`.
  `getVersionQ` + `viewedSnapshotVersion` drive the snapshot read-only
  overlay; `restoreMut` drives restore; `onTogglePin` drives
  `leadForm.setVersionPinned`.
- **History listing**: `trpc.router.ts:349-406` (`myHistory`) includes
  `versionSnapshots` to compute `lastEditAt`, `versionCount`,
  `latestVersion`, `latestVersionAt`; carried by
  `myHistoryEntrySchema` (`report.schema.ts:414-416`) into
  `lib/mappers/lead-history.ts:42-44`.
- **Internal writer**: `VersionHistoryService.fillFrom` calls
  `repository.createVersionSnapshot` directly as a pre-overwrite safety
  net before copying a previous period into the section.

## After this change

```text
edit → autosave debounce (or Save now) → saveDraft → one saved state
```

No snapshot rows, no version queries, no restore. The toolbar slot
shows an inert ComingSoon control. `myHistory` computes `lastEditAt`
from section/item/risk/decision/status timestamps only.

## Decisions

### D1 — Full removal, not stubs (reverses old D1)

The previous design kept `SnapshotService`, `VersionHistoryService`,
repository methods, and all version integration/characterization tests
as the "executable behavioral spec for re-enable". The user's decision
overrides that: versions-v2 starts from a fresh design
(`versions-v2-restore-fidelity` draft), not from this implementation —
the fidelity bug shows the old projection semantics are exactly what
must NOT be preserved. So services, repository methods, retention,
endpoints, and their tests are deleted. Their behavior remains
recoverable via git history and the `add-version-pin` archive.
Per the deferred-feature rule, `TODO(versions-v2)` one-line markers
(comments, not throw-stubs — nothing can call a deleted endpoint) sit
at the natural activation points: the `leadForm` router block, the
autosave success path, and the toolbar control.

### D2 — `fillFrom` survives; its safety snapshot does not

`fillFrom` (copy a previous period into the current section) is a live
feature and stays. It loses its pre-overwrite
`createVersionSnapshot` call — with the table gone there is nowhere to
write. Stated trade-off: a `fillFrom` overwrite becomes unrecoverable
in-app; acceptable in MVP (the DB is disposable, the action is
user-initiated and confirmed). `TODO(versions-v2)` marks the spot.
Mechanically, `fillFrom` moves out of the deleted
`version-history.service.ts` into `lead-form.service.ts` (or a sibling
`fill-from.service.ts` if size argues for it — implementer's call);
`repository.fillFromSection` is untouched.

### D3 — History read model drops the version fields

`myHistory` (`trpc.router.ts:349-406`) loses the `versionSnapshots`
include; `lastEditAt` is computed from the remaining edit dates.
`versionCount` / `latestVersion` / `latestVersionAt` leave
`myHistoryEntrySchema` and `lib/mappers/lead-history.ts` (all current
consumers are tests; no production UI renders them). The
`Version N · ` autosave-label prefix in `lead-form.tsx` goes; the label
keeps the plain saved time.

### D4 — `onSaveSuccessAction` leaves the autosave hook

After the snapshot trigger is deleted the hook prop has zero callers;
the surgical-change rule removes the orphan
(`use-lead-form-autosave.ts:45,101-104,125`). Hook tests covering the
callback are rewritten to the new contract — contract replacement, not
test weakening: the behavior itself no longer exists.

### D5 — Inert ComingSoon control in the toolbar slot

`version-history-nav.tsx`, `version-row.tsx`, their tests and snapshot
are deleted. A new small component (`version-coming-soon.tsx`,
exporting `VersionComingSoonControl`) fills the toolbar slot
(`lead-form.tsx` ~1589-1602): disabled button, `aria-disabled`,
`aria-label="Version history is coming soon"`, `title="Coming Soon"`,
`data-testid="version-coming-soon"`, wrapped in `ComingSoonBadge`
exactly like `LanguageComingSoonControl`
(`apps/web/src/components/navigation/nav-bar.tsx:170-184`; spec:
`openspec/specs/deferred-feature-pattern`). English copy only.
`TODO(versions-v2)` activation marker on the component.

### D6 — Schema reshape per the MVP DB rule

Drop the `VersionSnapshot` model (`schema.prisma:452-461`), the
`VersionSnapshotKind` enum (~line 690), and the
`ReportSection.versionSnapshots` relation (line 247). Hand-sync the
single init migration SQL (delete the table + enum DDL) and
`prisma migrate reset` BOTH the `_dev` and `_test` databases with
`PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` — `add-version-pin`
task 1.3 recorded that `_test` was missed once; do not repeat that.
This is the destructive-freedom path the MVP rule explicitly grants;
production is out of scope and stays gated.

### D7 — Save-stability contract (the user's #1 ask)

After removal, the save path must satisfy and be tested for:

- autosave debounce coalesces rapid edits into one `saveDraft`;
- success transitions pending → saving → saved with NO side effects
  beyond the draft write;
- failure surfaces `state: "error"` (toolbar "Save failed") and keeps
  `dirty: true` so the next edit retries; `beforeunload` guard while
  dirty;
- manual save: `forceSave` cancels the debounce timer, saves
  immediately, queues when a mutation is in flight; `SaveNowButton`
  keeps the pending treatment from `save-now-pending-indicator` (this
  change builds on its `save-now-button.tsx` state and must not
  regress its tests).

Existing coverage in `use-lead-form-autosave.test.tsx` and
`save-now-button.test.tsx` is audited against this list; missing cases
are added; nothing is removed except assertions about snapshot side
effects that no longer exist.

### D8 — Durable specs stay truthful

- `version-pinning` (synced 2026-06-11 by the `add-version-pin`
  archive) is removed via a REMOVED delta in this change; the
  directory must be gone from `openspec/specs/` after archive.
- `deferred-feature-pattern` gains the version-history UI scenario
  (MODIFIED delta).
- `uat-quality-gates` lead re-sweep scenario drops "version history"
  from its surface list (MODIFIED delta).
- `code-quality-modernization`'s extraction scenario mentions
  `VersionHistoryService` as a historical example of the HOT-ZONE
  characterization rule; the rule is not triggered here (this is
  behavior removal, not a behavior-preserving refactor) and the
  example stays as history — no delta.

## Invariants touched

- **destructive-db-guard** — exercised, not weakened: resets hit only
  `_dev`/`_test` suffixed DBs with the consent variable; the guard and
  `ALLOW_PROD_DESTRUCTIVE` gating are untouched.
- **deferred-feature-pattern** — applied (delta); pattern unchanged.
- **role-coverage-gate** — five procedures removed, none added; the
  remaining router uses the same canonical builders.
- **period-dual-state** — untouched (no Report write-path change).
- **enum-state-hygiene** — satisfied by deletion: the
  `VersionSnapshotKind` enum disappears with both its writers.

## Rollout

Single change, one branch, no flag, no prod migration. In-branch task
order: schema + shared first, then api, then web (config grouping);
`pnpm typecheck` is expected red between groups and drives the orphan
sweep — gates are judged at the end. The live dev server on :3000
should be restarted only after the web group lands, otherwise the lead
page skeleton-locks on the deleted `versions` query.
