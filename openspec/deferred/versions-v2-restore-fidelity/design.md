# Design — versions-v2-restore-fidelity

> Resolves tasks 1.1–1.4 (Design ratification). No feature code is
> authorized by this document; implementation tasks (sections 2–5 of
> `tasks.md`) stay gated until the user reopens versions v2. This design
> is written to survive an adversarial Codex review.

## Context

Version history v1 was removed entirely on commit `7d8ace5d`
(`defer-versions-coming-soon`, archived 2026-06-11) after a fidelity bug:
restoring v3 rendered stage-chip statuses that did not match the captured
state. `TODO(versions-v2)` markers sit at the four re-entry points:

- `apps/web/src/components/lead/version-coming-soon.tsx` — the inert UI
  control that replaced the toolbar slot.
- `apps/web/src/components/lead/lead-form.tsx:593` — the autosave
  save-success path that used to trigger a snapshot.
- `apps/api/src/infrastructure/trpc/trpc.router.ts:1986` — where the five
  version-history procedures lived.
- `apps/api/src/modules/report-sections/lead-form.service.ts:67` — the
  `fillFrom` pre-overwrite safety snapshot.

The v1 root causes are verified in git history (`git show 7d8ace5d~1`):

1. **Parallel hand-written serializer drifted.** `buildSnapshotData`
   (`lead-form.prisma-repository.ts`, removed) captured `items` / `risks`
   / `decisions` / `stageStatuses` and **never captured `projectStatuses`**.
2. **Conditional wipe on restore.** `restoreVersion` deleted stage-status
   rows only `if (data.stageStatuses !== undefined)`. Old payloads kept
   the _current_ stage statuses → a silent merge of old and new state.
3. **No round-trip contract.** Nothing asserted that re-rendering a
   restored section equals the rendered state at capture time.

The pivot of this design: **do not re-introduce a parallel
serializer/restorer.** The canonical section writer
(`ReportSectionsPrismaRepository.saveSection`, lines 327–444) already does
exactly the operation restore needs — an unconditional, single-transaction
delete-all-then-recreate of all five child tables (lines 348–356), then a
post-commit re-read returned as the read model (lines 436–443). Snapshot
the committed read model; restore by feeding the owned slice back through
a guarded writer that **shares `saveSection`'s child-table delete+recreate
logic** (extracted, so it cannot drift) but adds a compare-and-swap
`saveSection` cannot host. Reusing that one writer body is what kills the
v1 drift class.

## Goals / Non-Goals

**Goals:**

- Ratify Option A (full-state snapshot) with restore-creates-a-version
  semantics (task 1.1).
- Fix `schemaVersion` placement and the strict-parse / refuse contract
  (task 1.2).
- Decide pinning scope (task 1.3).
- Produce the renderable-field inventory from the LIVE read model
  (task 1.4).
- Define the round-trip identity contract precisely, including ID
  handling and a master-data boundary.
- Specify the restore-scoped compare-and-swap guard against the autosave
  race.

**Non-Goals:**

- No implementation (sections 2–5 stay gated).
- No pinning (`add-version-pin`), no diff view, no cross-period browsing.
- No event sourcing (Option B), no normalized row versioning (Option D).
- No general `saveDraft` optimistic-concurrency control — the
  `version Int` column at the OCC write-lock seam (`save-section.transaction.ts`)
  (`prisma/schema.prisma:230`) is a separate, out-of-scope item.
- No prod-DB operations.

## Decisions

### 1.1 — Option A + restore-creates-a-version (ratified)

Option A (one full-state JSON snapshot per version) is adopted unchanged
from the proposal's recommendation. Rejection of B/C/D stands as written
in `proposal.md` (event sourcing and row-versioning are disproportionate
for a 6-user internal tool with no audit requirement).

**Restore semantics — full replace, atomic, creates a new version:**

- Restore is implemented by a **new guarded full-replace writer**
  (`restoreSectionContent`, see "autosave / restore race" — finding 3),
  which **shares** `saveSection`'s child-table delete-all + recreate logic
  (extracted, not duplicated) so it cannot drift from the live writer. It
  is gated by a compare-and-swap on `ReportSection.updatedAt` that
  `saveSection` itself cannot carry (its `reportSection.update` is
  unconditional). The shared owned-content writer wipes and recreates
  `projectStatus` / `stageStatus` / `item` / `risk` / `decision` in one
  `$transaction` (timeout 15 s). Atomic full replace comes for free; the
  v1 "conditional wipe" cannot recur because the writer has no
  field-conditional branch. `status` / `submittedAt` / `late` and all
  master/identity fields stay at the section's live values (restore never
  rewrites lifecycle or identity).
- **Pre-restore safety snapshot.** Before applying vN, capture a snapshot
  of the current state (kind `pre-restore`) that is **exempt from the
  60 s throttle and content dedup** — it must always fire. Restoring vN
  then appends a new highest version. The version list only ever grows;
  "undo the restore" is just another restore. (Google-Docs semantics.)

**Status pinning (load-bearing — restore must not change lifecycle).**
Restore is allowed only on an **own, draft, open-period** section (see
lock interactions). The guarded writer never accepts `status` /
`submittedAt` / `late` from the snapshot — those stay at the section's
current live values (the snapshot captures them only for the read-only
version-overlay display). Restore reinstates _content_
(items/risks/decisions/owned statuses), never lifecycle or identity.

### 1.2 — `schemaVersion`: BOTH in-payload (parse source) and a column

Decision: store `schemaVersion` **both** ways, with a single source of
truth for parsing.

- **In-payload envelope is the parse source of truth.** Persist
  `{ schemaVersion: number, data: <payload> }`. Restore parses the whole
  envelope with `z.discriminatedUnion("schemaVersion", [...])`. The
  matched arm's strict schema validates `data`. There is **no
  "field missing → keep current" path, ever** — a payload whose
  `schemaVersion` matches no arm fails the discriminated-union parse.
- **A denormalized `schemaVersion Int` Prisma column** is written in
  lockstep at create time, purely so retention/migration queries
  (e.g. "list sections holding payloads below the current version") are
  indexable SQL, not a JSON scan. The column is never the parse source;
  on any disagreement the in-payload value wins and the row is treated as
  corrupt (refused).
- **`SNAPSHOT_SCHEMA_VERSION`** is a named const in `packages/shared`;
  v2 launches at `schemaVersion = 1` with zero historical payloads
  (v1 data was dropped with the table).

**Unknown / older version handling (strict, no merge):**

- A `schemaVersion` with a **registered migration path** (total function
  `N → N+1`, chained to current) is migrated, then strict-parsed at the
  current arm, then restored. The migration registry contract is task 2.3.
- A `schemaVersion` with **no migration path** → restore is **refused**
  with a clear error; the section's current state is left untouched. No
  partial apply, no field merge.

**Snapshot schemas are STRICTER than the compatibility read schemas
(finding 7).** `reportSectionReadModelSchema` is deliberately _lenient_
(many `.optional()`, `legacy fixtures still parse`) so old DB rows render.
Snapshot payload schemas MUST go the other way:

- Each `vN` payload schema uses Zod **`.strict()`** (no passthrough — an
  unknown key fails the parse, catching a drifted/corrupt payload).
- **No "optional means current"** — every field that is required in the
  owned content at version `N` is **required** in the `vN` snapshot
  schema. There is no "field absent → keep current" fallback (that was
  v1's bug).
- A registered migration `N → N+1` MUST produce a payload that satisfies
  the (strict, fully-required) `N+1` schema — it **fills every required
  field** before restore, or the migration is itself rejected. Migrations
  may not defer a missing field to runtime.

### 1.3 — Pinning: OUT of scope

`add-version-pin` semantics stay **out of scope**. The proposal says
pinning returns only if the user re-asks; the user has **not** re-asked.

Implication for the schema: the v1 retention SQL referenced a `kind` /
`pinned` exemption (`"kind" <> 'pinned'`). v2 keeps a `kind` enum
(`autosave` | `manual` | `pre-restore`) because pre-restore snapshots must
be throttle/dedup-exempt, but adds **no `pinned` kind and no pin control**.
Retention treats all three kinds uniformly under the time-window sweep.

### 1.4 — Renderable-field inventory (from the LIVE read model)

Source of truth read today:
`reportSectionReadModelSchema`
(`packages/shared/src/schemas/section.schema.ts:135`) and
`mapPrismaToReportSection`
(`apps/api/src/modules/report-sections/report-sections.prisma-repository.ts:146`).

**Load-bearing fact (this is the inventory's spine):** the read model has
**no separate `projectStatuses` or `stageStatuses` arrays.** Those raw
child rows are _folded_ by `mapPrismaToReportSection` into:

- `projects[].trafficLight` — derived as
  `aggregateStageTraffic(ownedStages) ?? projectStatusByProjectId ?? null`.
- `projects[].ownedStages[].status` — the per-(project×stage) chip color.

This folding is exactly why a naive "snapshot the read model" looks like
it drops `projectStatuses` — and why v1's parallel serializer that _did_
try to snapshot raw rows drifted. The resolution (see the round-trip
contract) is that `saveSection` writes `projectStatus.status =
trafficLight` and each `stageStatus.status = ownedStages[].status` back —
so the read model, fed through `saveSection`, regenerates the raw rows
faithfully. The snapshot therefore carries the **owned content
projection** (not the whole read model), and the folded raw rows are
reconstructed by the writer.

**Every field the read model emits, classified (finding 5).** Each field
of `reportSectionReadModelSchema` is one of three kinds: **SNAPSHOTTED &
RESTORED** (in `ownedContentProjection`, captured + reinstated + in the
round-trip equality set), **OVERLAY-METADATA** (captured into
`snapshotMetadataProjection` for display only — NEVER restored, NEVER in
the equality set), or **PINNED-FROM-LIVE** (re-derived from the current
section/master data, never snapshotted). The complete classification:

| Read-model field                                                                                                      | Classification                                                                                          |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `reportSectionId` / `reportId` / `authorId`                                                                           | PINNED-FROM-LIVE (identity)                                                                             |
| `authorName` / `authorRole`                                                                                           | PINNED-FROM-LIVE (author master data)                                                                   |
| `status` / `submittedAt` / `late`                                                                                     | **OVERLAY-METADATA** (display-only; pinned-from-live on restore, never in the equality set — finding 1) |
| `projects[]` membership, `projectName`                                                                                | PINNED-FROM-LIVE (master data)                                                                          |
| `projects[].trafficLight`                                                                                             | **SNAPSHOTTED & RESTORED** (folds owned `projectStatus`)                                                |
| `ownedStages[]` membership / `stageName` / `sortOrder`                                                                | PINNED-FROM-LIVE (master data)                                                                          |
| `ownedStages[].status`                                                                                                | **SNAPSHOTTED & RESTORED** (the owned stage chip color)                                                 |
| `items[]` (`id`,`projectId`,`type`,`text`,`tag`,`workflowStatus`,`carriedOver`,`completed`,`priorityRank`,`stageIds`) | **SNAPSHOTTED & RESTORED**                                                                              |
| `risks[]` (`id`,`projectId`,`risk`,`impact`,`mitigation`,`severity`,`stageIds`)                                       | **SNAPSHOTTED & RESTORED**                                                                              |
| `decisions[]` (`id`,`text`,`owner`,`deadline`,`impact`,`resolvedAt`,`stageIds`,`productId`)                           | **SNAPSHOTTED & RESTORED**                                                                              |
| `referencedProjects[]`                                                                                                | PINNED-FROM-LIVE (foreign name resolution)                                                              |

So the SNAPSHOTTED & RESTORED set (= `ownedContentProjection`) = the owned
slice: `items` / `risks` / `decisions` + owned `projects[].trafficLight` +
`ownedStages[].status`, keyed by `projectId` / `stageId` so the writer can
re-fold them. Identity and author identity (`reportSectionId` / `reportId`
/ `authorId` / `authorName` / `authorRole`) are PINNED-FROM-LIVE — they are
master data (finding 4) and pinning them prevents a stale snapshot from
rewriting who owns the section. `status` / `submittedAt` / `late` are
OVERLAY-METADATA: captured into `snapshotMetadataProjection` only so a
read-only version-overlay can display them; the restore writer never
rewrites lifecycle and they are never compared in the round-trip
equality.

**Fields that have grown since the DRAFT inventory** (proposal lines
43–60, which listed only items/risks/decisions/projectStatuses/
stageStatuses/meta):

- `late` (Phase 50-B) — section meta now carries a late flag.
- `referencedProjects` (`fix-lead-surface-name-resolution`) — derived
  name resolution.
- `authorRole` (Phase 35-03) — derived.
- `priorityRank` on items — already in scope but absent from the
  draft's prose.

The drift guard (task 2.2) binds the snapshot schema to the **owned
content projection type** (not the whole read model) so any _future_ owned
renderable field breaks `pnpm typecheck` until the version is bumped — see
"Drift guard" below for the exact compile-time pattern.

### The round-trip contract (the #1 Codex target)

**Naming the invariant honestly (findings 1, 6).** The lead PAGE renders
_richer_ than the server `mapPrismaToReportSection`. After the server map,
`lead-form.tsx` runs `mapLeadFormData` (`lib/mappers/lead-form.ts:591`)
into presentation shapes, then `applyCrossAuthorStageOverrides`
(`lead-form.tsx:665`) overlays **other authors'** stage colors, merges
**foreign** items from `crossAuthorSectionsQ`, and derives presentation
status. A server-only deep-equality test could pass while the page still
differs — v1's failure class, one layer up. So the invariant is NOT "the
version re-renders the whole lead page identically". It is, precisely:

> **A version fully determines the section's OWNED, author-editable
> content as captured.** Live cross-author overlays, merged foreign rows,
> and presentation-status derivation are intentionally LIVE — they are
> never part of a version and re-render from current data.

**`ownedContentProjection(S)` (the contract's subject).** Define it as the
**restorable owned slice** of the read model — exactly the content fields
the guarded writer reinstates for _this_ author's section:

- `items[]`, `risks[]`, `decisions[]` (full content incl. `priorityRank`,
  `stageIds`);
- owned `projectStatus` / `stageStatus`, folded as the read model folds
  them: `projects[].trafficLight` and `projects[].ownedStages[].status`,
  keyed by `projectId` / `stageId`.

It **excludes**:

- **Lifecycle meta** `status` / `submittedAt` / `late` — these are
  **pinned-from-live** and NEVER restored from the snapshot (see finding 1
  below). They are not in the round-trip equality set.
- **Master/foreign data**: `projects[]` membership and `projectName`,
  `ownedStages[]` membership / `stageName` / `sortOrder`,
  `referencedProjects`, `authorName`, `authorRole`, identity ids — all
  re-derived or pinned live (see finding 4 below and the inventory).

**`snapshotMetadataProjection(S)` (overlay-only, NOT in the equality
set).** The snapshot ALSO captures `status` / `submittedAt` / `late` purely
so a read-only version-overlay can _display_ what the lifecycle was at
capture time. This metadata is never fed to the restore writer and is
never compared in the round-trip contract — see finding 1.

**Invariant:**

```
ownedContentProjection(restore(snapshot(S))) === ownedContentProjection(S)
```

where `snapshot(S)` is `ownedContentProjection(S)` captured from the
committed row, and `restore(P)` is the guarded full-replace writer
(below) fed `P` with live master/identity/lifecycle fields pinned. This is
provable by construction: the restore writer reuses the same child-table
delete-and-recreate that `saveSection` runs, so the owned slice round-trips
by the identity the live save path already relies on.

**Finding 1 — lifecycle is NOT in the equality set.** `status` /
`submittedAt` / `late` are deliberately excluded from
`ownedContentProjection`. Restore pins them to the section's _live_ values
and never writes the snapshot's lifecycle (a stale snapshot must not flip a
section's status). If they were inside the equality set, the round-trip
test would _falsely fail_ whenever lifecycle differs between capture and
restore — even though the restore behaved correctly. They live only in
`snapshotMetadataProjection`, an overlay-only display concern. The
contract compares ONLY truly restorable owned content.

**Finding 4 — product scope of the invariant (stated loudly, in BOTH
docs).** Master and foreign data drift (project name/archive, stage
assignments, referenced-project names, `authorName` / `authorRole`, other
authors' overlays) would break a literal "render EXACTLY as captured".
The invariant is therefore narrowed — and this exact wording is added to
`proposal.md`'s invariant statement as well:

> A version fully determines the section's **OWNED** content as captured.
> Master / foreign data (project name/archive, stage assignments, author
> identity, referenced-project names, cross-author overlays) renders
> **LIVE** and is pinned from the CURRENT section at restore, never
> snapshotted.

Justification: v1's actual bug was OWNED stage statuses being silently
merged on restore — not master-data drift. Versioning foreign master data
is out of scope for a 6-user internal tool, and freezing it would be
_wrong_ (a restore should bring back what the lead wrote, not freeze the
department's org chart).

**Identity / IDs.** The only raw row IDs in the owned projection are
`items[].id` / `risks[].id` / `decisions[].id`, which `saveSection`
re-inserts verbatim via `...(i.id ? { id: i.id } : {})` (lines
384/402/420) — so the restore writer preserves them. `projectStatus.id` /
`stageStatus.id` / every `createdAt` / `updatedAt` are regenerated on
wipe+recreate but never appear in `ownedContentProjection`, so their
regeneration is invisible to the contract.

**Round-trip test teeth (task 5.1) — the two folding cases.** Because
`trafficLight = aggregateStageTraffic(ownedStages) ?? projectStatus ??
null`, the test MUST exercise both branches of the fold:

1. A stage-owned project with **colored stage statuses** (aggregate wins;
   `projectStatus` is masked).
2. A stage-owned project with **all-null stage statuses + a non-null
   `projectStatus`** (the fallback wins).

Both, plus items (with `priorityRank`), risks, and decisions, must satisfy
deep-equal `ownedContentProjection`. A separate lifecycle test (finding 1)
captures a snapshot, changes the section's live lifecycle
(e.g. draft → submitted) between capture and restore, restores, and
asserts the section keeps its **current live** `status` / `submittedAt` /
`late` — never the snapshot's — while the owned content matches. This
proves lifecycle is pinned-from-live, not compared.

**Page-layer fold test (findings 1c+6) — cover the layer above the server
map.** A server-map test alone does not prove the _page_ chips match.
Add a presentation-level fixture/test where:

- persisted OWNED stage statuses, plus covering risks that influence the
  rendered chip color, plus a cross-author overlay on a shared product,
  all feed the page render (`mapLeadFormData` →
  `applyCrossAuthorStageOverrides`);
- after restore, assert the **owned** chips render identically (the lead's
  own stage colors and aggregated traffic lights), while
- the cross-author overlay and foreign rows are asserted to track CURRENT
  data, not the snapshot (explicitly LIVE).

This proves the page-layer fold — not just the server map — for the owned
slice, closing the v1-one-layer-up gap.

### The autosave / restore race (restore-only CAS)

Restore and the debounced autosave (`useLeadFormAutosave`) both wipe and
recreate the same child rows. Without a guard, a pending autosave that
lands _after_ restore silently overwrites the restored content
("last writer wins" — the very OCC hazard at `save-section.transaction.ts`, scoped here to
restore only).

**Finding 3 — CAS cannot live in `saveSection`; restore needs a NEW
guarded writer.** `saveSection` opens its transaction with an
_unconditional_ `reportSection.update` (line 334), so a compare-and-swap
cannot be placed inside it. Restore therefore does NOT call `saveSection`.
It calls a **new guarded full-replace repository method**
(`restoreSectionContent(sectionId, ownedProjection, expectedUpdatedAt)`)
that performs, in ONE `$transaction`:

1. `reportSection.updateMany({ where: { id, updatedAt: expectedUpdatedAt },
data: { updatedAt: now } })` — the compare-and-swap. If the returned
   `count === 0`, the section changed under us → **throw to abort the
   whole transaction** (no deletes/creates run); surface "section changed,
   retry".
2. On `count === 1`, the SAME delete-all + recreate of `projectStatus` /
   `stageStatus` / `item` / `risk` / `decision` that `saveSection` uses
   (the owned-content writer logic is shared/extracted, not duplicated, so
   it cannot drift from the live writer).

`status` / `submittedAt` / `late` and all master/identity fields are NOT
taken from the snapshot — they stay at the section's current live values
(restore reinstates _content_, never lifecycle or identity).

**Token: `ReportSection.updatedAt`** — NOT a new `version` column (that
column is the separate, out-of-scope OCC item at the write-lock seam). Every
section write runs `reportSection.update`, so `updatedAt` is a reliable
witness that bumps on each write; the guarded `updateMany` above both
checks and bumps it.

**Finding 2 — HARD autosave pause + full drain before restore.** The
client side must _quiesce_ autosave, not merely narrow the window. The
existing `forceSave()` (`use-lead-form-autosave.ts:226`) returns
immediately when a mutation is already in flight, only stashing
`queuedKeyRef` — that queued save would then run AFTER restore and clobber
it. So the restore flow MUST:

1. Enter a **hard restore-in-progress state** that sets the autosave hook
   `enabled: false`, suspending any NEW autosave from starting.
2. **Await both the in-flight AND the queued save to settle** before
   issuing restore (extend the hook with a `quiesce()` that resolves only
   when neither an in-flight nor a queued mutation remains — drain, don't
   just flush the timer).
3. If autosave **cannot quiesce** (e.g. a save keeps erroring), **abort
   the restore** rather than racing it.

The server CAS (finding 3) is the backstop if the client drain is ever
bypassed.

Scope note: this is **restore-only** CAS. General `saveDraft` OCC stays
out of scope (the OCC write-lock seam); restore does not add a `version`
column or gate ordinary draft saves.

### Snapshot source — committed server read model only

The snapshot payload is captured **server-side from the committed row**,
never from a client success payload:

- `saveSection` already re-reads the section post-commit and returns the
  mapped read model (lines 436–443). The autosave snapshot trigger
  captures **that returned read model** (or an equivalent immediate
  re-read inside the save flow), so the snapshot is byte-for-byte what the
  DB committed.
- This is continuity, not a new rule: v1's `buildSnapshotProjection`
  also re-read the DB rather than trusting the client.
- The client trigger at `lead-form.tsx:593` is therefore **removed** — the
  save-success path no longer creates snapshots client-side. The trigger
  moves into the server `saveDraft` flow (the throttle/dedup/retention
  logic from `SnapshotService`, re-adopted from `7d8ace5d~1`, decides
  whether a given autosave actually writes a snapshot).

### Lock interactions (publish / period / submit / draft)

Per the proposal's recommendation, unchanged:

- **Snapshot writes** follow the existing save gate: no snapshots on a
  `submitted` section or a non-open period (v1 enforced this in
  `SnapshotService.createSnapshot` — keep it). `pre-restore` snapshots are
  throttle/dedup-exempt but still gated to own/draft/open (restore itself
  is gated, so this is implied).
- **Restore** is allowed only where saving is allowed: own section,
  `status = draft`, period `open`. Read-only viewing of old versions is
  allowed even when the section is locked.
- **period-dual-state (`openspec/specs/period-dual-state/spec.md`):** the
  version-snapshot restore writes only section child rows plus the guarded
  `reportSection.updateMany` that bumps `updatedAt` (the CAS); it does not
  change `status` / `submittedAt` / `late` (kept at live values) and
  writes **no `Report` period field**, so it is a non-writer exactly
  like the spec's "Lead section save does NOT write the Report period"
  scenario (lines 13–22). No delta to that spec is expected. Note: the
  spec's lines 155–198 ("Admin Snapshot Restore") govern the _Report-level_
  `getSnapshot` / `applySnapshot` admin feature — a different mechanism
  from this section-level version restore. They are not the same writer;
  this design does not touch them.
- **deferred-feature-pattern (`openspec/specs/deferred-feature-pattern/
spec.md`):** activating v2 deletes `VersionComingSoonControl`
  (`apps/web/src/components/lead/version-coming-soon.tsx`) and removes the
  `TODO(versions-v2)` markers, per the "Activation Removes the Deferred
  Marker Entirely" requirement. That spec's "Version history is deferred
  after full removal" scenario is retired when the real control returns.

### Drift guard — two layers, lead with the test

The proposal's type-level guard (task 2.2) is necessary but not
sufficient, and the doc must not oversell it:

- **Type guard — DEEP exact-keys, not just top-level (findings 8 + 3).**
  A top-level `ExactKeys` catches a missing top-level `items`, but NOT a
  new renderable field added _inside_ an array element
  (`items[]` / `risks[]` / `decisions[]` / `ownedStages[]`) — and most
  renderable fields are nested, so a top-level-only guard would miss the
  common drift. The guard must therefore be **recursive (`ExactDeep`)**:
  exactness on the top-level keys AND on each array element type. Two
  equivalent ways to achieve this; pick one at implementation:

  - **(preferred) Derive, don't duplicate.** Build the snapshot nested
    schemas FROM the owned-projection element schemas
    (`z.object` shapes shared with / `.pick()`ed from the read-model
    element schemas), so the element types are the same type by
    construction and cannot drift. The top-level `ExactKeys` then suffices
    because the nested shapes are not independently authored.
  - **(if independently authored) `ExactDeep` + per-element guards.** A
    recursive exact-key type plus a separate `ExactKeys` check per element
    type, each with its own negative test:

  ```ts
  // Exact on a single object level (missing OR extra key → never).
  type ExactKeys<A, B> = [keyof A] extends [keyof B]
    ? [keyof B] extends [keyof A]
      ? true
      : never
    : never;

  // Recurse into array element types and nested objects.
  type ExactDeep<A, B> = [ExactKeys<A, B>] extends [true]
    ? {
        [K in keyof A & keyof B]: A[K] extends readonly (infer EA)[]
          ? B[K] extends readonly (infer EB)[]
            ? ExactDeep<EA, EB>
            : never
          : A[K] extends object
            ? B[K] extends object
              ? ExactDeep<A[K], B[K]>
              : never
            : true;
      }[keyof A & keyof B] extends true
      ? true
      : never
    : never;

  type CurrentSnapshotData = z.infer<typeof currentSnapshotDataSchema>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type _OwnedExact = ExactDeep<CurrentSnapshotData, OwnedContentProjection>;
  const _ownedCheck: _OwnedExact = true; // fails to compile if false
  ```

  Adding an owned renderable field at ANY level (top-level OR inside an
  array element) without adding it to the snapshot schema makes `_OwnedExact`
  resolve to `never`, failing `pnpm typecheck`. This is the _prompt_ to
  bump `SNAPSHOT_SCHEMA_VERSION` and register a migration. It binds to the
  **owned** projection, not the whole read model, so it does not fire on
  PINNED-FROM-LIVE additions (`authorRole`, `referencedProjects`, …) the
  writer ignores.

- **Negative type tests at EACH level (findings 8 + 3).** A `*.type-test.ts`
  asserts the guard actually fires — not just at the top level but for
  each nested element type:

  - omit a required TOP-LEVEL key → assert (`// @ts-expect-error`) the
    check resolves to `never`;
  - omit a required field inside an `items[]` element → assert `never`;
  - likewise for a `risks[]`, a `decisions[]`, and an `ownedStages[]`
    element.

  This proves the tripwire is wired at every level a renderable owned field
  can hide, not vacuous and not top-level-only.

- **Behavioral guard (the real gate).** The round-trip test (task 5.1) +
  the page-layer fold test prove fidelity end-to-end through the actual
  capture→restore→render path. Lead with these; the type guard is the
  early-warning tripwire that catches a drift _before_ a test would.

Old frozen `vN` payload schemas stay in the discriminated union so
historical payloads keep parsing after a version bump.

## Prisma plan

- **Re-add `VersionSnapshot`** to `prisma/schema.prisma`:
  - `id String @id @default(uuid())`
  - `reportSectionId String`
  - `version Int` — per-section monotonic (max+1 at create)
  - `schemaVersion Int` — denormalized parse-version (decision 1.2)
  - `kind` enum `SnapshotKind { autosave manual pre_restore }`
  - `data Json` — the `{ schemaVersion, data }` envelope
  - `createdAt DateTime @default(now())`
  - `reportSection ReportSection @relation(fields: [reportSectionId],
references: [id], onDelete: Cascade)`
  - `@@unique([reportSectionId, version])`,
    `@@index([reportSectionId, createdAt])`
  - Add `versionSnapshots VersionSnapshot[]` to `ReportSection`.
- **Single init migration, hand-edited (NOT alter-table).** Per the MVP
  "Database Is Disposable" rule: edit `prisma/schema.prisma`, hand-sync
  the one init migration's SQL, then
  `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=… prisma migrate reset` on
  `_dev` and `_test` only. Never prod. (`add-version-pin` is out, so the
  v1 `kind = 'pinned'` retention exemption is **not** re-added.)
- **Retention** (`createVersionSnapshot`, re-adopted from `7d8ace5d~1`):
  keep all `< 24 h`, newest-per-hour `24 h–7 d`, newest-per-day `7–30 d`,
  drop `> 30 d`. The v1 SQL's `"kind" <> 'pinned'` clause is dropped (no
  pinning); all kinds age out uniformly.

## Risks / Trade-offs

1. **Master-data drift changes structural framing on restore.** Mitigated
   by scoping the contract explicitly (boundary above). Restoring _content_
   while re-deriving _framing_ is the intended behavior, not a bug.
2. **Shared writer body couples restore to the live save path.** Restore
   and `saveSection` share the extracted child-table delete+recreate. If
   that shared body ever stops being a full delete+recreate (e.g. a future
   partial-update optimization), restore fidelity breaks too. Mitigated:
   the round-trip + page-layer tests fail loudly if the replace semantics
   change; a code comment at the shared writer names this coupling.
3. **`updatedAt`-based CAS has coarse granularity.** Two writes within the
   same millisecond could share a timestamp. Acceptable for a 6-user tool;
   the dedicated `version Int` OCC column (out of scope here) is the proper
   fix when the OCC write-lock seam ships.
4. **Storage duplication per version.** Negligible: 6 leads × weekly
   sections, payloads a few KB, time-based retention caps growth.

## Migration Plan

No data migration at launch: v1 payloads were dropped with the table; v2
starts at `schemaVersion = 1` with zero historical rows. The migration /
refusal machinery exists from day one (task 2.3) so the FIRST schema
change after launch already has a tested path. Schema rollout is a single
hand-edited init migration + `migrate reset` of `_dev` / `_test`
(see Prisma plan).

## Task-list delta

The decisions above refine `tasks.md` without changing its shape; apply
these clarifications when the change is reopened:

1. **3.4 (restore)** — implement restore via a **new guarded writer**
   `restoreSectionContent(sectionId, ownedProjection, expectedUpdatedAt)`
   that does the `updatedAt` compare-and-swap and the child-table
   delete-all+recreate in ONE transaction (sharing `saveSection`'s
   owned-content writer logic, not duplicating it); abort if the CAS count
   is 0. Restore takes only the owned slice; `status` / `submittedAt` /
   `late` and identity/master fields stay live. Do **not** call
   `saveSection` directly (its `reportSection.update` is unconditional and
   cannot host the CAS).
2. **2.1 / schema** — the payload is an envelope
   `{ schemaVersion, data }`; add both `SNAPSHOT_SCHEMA_VERSION` and the
   denormalized `schemaVersion Int` column (decision 1.2). Snapshot `vN`
   data schemas use `.strict()`, all owned fields **required** (no
   optional-means-current).
3. **3.1 (schema)** — `kind` enum is `autosave | manual | pre_restore`;
   **no `pinned` kind**, no pin control, no `kind <> 'pinned'` retention
   clause (decision 1.3).
4. **4.2 (web)** — the autosave trigger moves **server-side** into the
   `saveDraft` flow; the `lead-form.tsx:593` client trigger is removed,
   not re-wired to a client snapshot call.
5. **4.3 (web)** — the restore flow enters a HARD autosave-paused state
   (`enabled: false`) and **drains both in-flight AND queued saves** (a
   new `quiesce()` on the autosave hook) before issuing restore; abort the
   restore if autosave cannot quiesce. `forceSave()` alone is insufficient
   (it only stashes `queuedKeyRef` when a mutation is in flight).
6. **2.2 (drift guard)** — bind `currentSnapshotDataSchema` to
   `OwnedContentProjection` by **DEEP** key-exact equality (`ExactDeep`,
   recursing into array element types; or derive the nested snapshot
   schemas from the owned-projection element schemas so they cannot drift)
   — NOT top-level-only, plus negative `*.type-test.ts` cases at the top
   level AND inside each `items[]` / `risks[]` / `decisions[]` /
   `ownedStages[]` element.
7. **5.1 (test)** — the round-trip test MUST cover both `trafficLight`
   fold branches (stage-aggregate-wins and projectStatus-fallback-wins);
   add a **page-layer fold test** (`mapLeadFormData` +
   `applyCrossAuthorStageOverrides`) asserting owned chips match after
   restore while cross-author overlays/foreign rows track LIVE data.
8. **New (fillFrom)** — re-add the `fillFrom` pre-overwrite safety
   snapshot at `lead-form.service.ts:67`, using the same throttle-exempt
   `pre-restore`-style capture (it is a pre-overwrite, not a restore, so
   give it a `manual`/`pre-fill` capture that always fires).
