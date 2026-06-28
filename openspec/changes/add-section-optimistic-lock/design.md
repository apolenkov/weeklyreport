## Context

A report section is owned by exactly one lead, but "single author" does not mean
"single writer in flight". The realistic races are the same person editing in
two browser tabs, autosave firing while a manual save is mid-flight, and a
retried request after a flaky response. Today every save destroys and rebuilds
all section content, so any of these silently drops the loser's write.

Current write path (`report-sections.prisma-repository.ts` `saveSection`,
mirrored in `lead-form.prisma-repository.ts` `fillFromSection`):

```text
$transaction:
  reportSection.update({ where: { id } })          # unconditional
  deleteMany projectStatus / stageStatus / item / risk / decision   # wipe ALL
  createMany from the client read model            # honours i.id / r.id / d.id
                                                    # omits createdAt
```

Two writers each run this whole block; the second wipe-and-recreate erases the
first. The schema flags the gap at `prisma/schema.prisma:241`
(`TODO(v8.5-A-occ)`); the review backlog rates it P0
(`BL-SECTION-OPTIMISTIC-LOCK`).

Target write path:

```text
$transaction:
  updateMany({ where: { id, version: expected }, data: { ..., version: { increment: 1 } } })
  if (count === 0) throw SectionVersionConflictError   # 409, no deletes ran
  deleteMany ... ; createMany ...   # server-minted child ids, no createdAt reset
```

## Goals / Non-Goals

**Goals:**

- Stop lost updates on concurrent section writes via version compare-and-set.
- Map a conflict to a clean tRPC `CONFLICT` (HTTP 409), never a `500`.
- Stop trusting client-supplied child primary keys; map any `P2002` to 400.
- Cover the same shape in `fillFromSection`.
- Round-trip `version` through the read model and save payload.

**Non-Goals:**

- No move away from the delete-then-recreate child write strategy itself; this
  change adds a guard around it, it does not rewrite it into a row-level diff.
- No new "version history" / snapshot feature — `ReportSection.version` here is
  a row-revision counter, distinct from the v8.4 published-snapshot versions and
  from `viewedSnapshotVersion` in the lead form.
- No multi-author section editing or merge UI.
- No change to head/viewer read paths.
- No `createdAt` provenance preservation on the child delete-then-recreate. The
  read model carries no child `createdAt`, so preserving it would mean widening
  the read and input schemas plus the persistence in two repositories — out of
  scope for the optimistic-lock fix; tracked as a follow-up.

## Decisions

### D1 — Row-revision integer, conditional `updateMany`

Add `version Int @default(1)` and increment it inside the same transaction with
`updateMany where { id, version: expected }`. Prisma's `update` (singular) can
only filter by a unique field, so it cannot express the compound
`{ id, version }` predicate; `updateMany` can, and its `count` is the
compare-and-set result. `count === 0` means another writer already advanced the
row — abort before any `deleteMany` runs, so a conflict deletes nothing.

Alternatives considered: a Postgres `xmin` system column (implicit, but
brittle across Prisma versions and invisible in the schema); `SELECT ... FOR
UPDATE` pessimistic locking (serialises the common no-contention case and holds
locks across the wipe/recreate). An explicit integer is the standard, portable
optimistic-lock primitive and matches the existing `make-publish-atomic`
compare-and-set direction in the backlog.

### D2 — Conflict ordering: version check first

The `updateMany` is the first statement in the transaction, before any
`deleteMany`. This guarantees the spec property "no child rows are deleted on
conflict" and keeps the failure cheap.

### D3 — New domain error → `CONFLICT`

Add a `SectionVersionConflictError` (extends `Error`) in the report-sections
module and a branch in `trpc.error-mapper.ts` returning
`new TRPCError({ code: "CONFLICT" })`. This mirrors the existing
`PublicationAccessError → CONFLICT` precedent, so 409 already has a home in the
mapper. Reusing `ReportSectionDomainError` would mis-map to `BAD_REQUEST` and
blur conflict-vs-validation for the client, which must reload on a conflict but
not on a validation error.

### D4 — Server mints child ids; `P2002 → BAD_REQUEST`

Drop the `...(i.id ? { id: i.id } : {})` spreads in the three child
`createMany` calls so the database generates each id. A surviving `P2002` (any
unique violation) maps to `BAD_REQUEST` rather than leaking a 500. Honouring
client PKs gave nothing — the rows are recreated wholesale — and only created
the cross-section collision footgun.

### D5 — `version` on read model and save payload

Add `version: z.number().int().min(1)` to `reportSectionReadModelSchema` and to
`draftSaveSchema` (inherited by `submitSectionSchema`) in
`packages/shared/src/schemas/section.schema.ts`. The service forwards the
payload's `version` as `expected`; the returned read model reports the new
incremented value so the client stays current for its next save.

Critical: `expected` MUST be the client-supplied payload `version`, NOT the
`version` of the row that `getActiveSection` just fetched. `saveDraft` /
`submitSection` fetch the section fresh and call `mergeSection(section,
parsedInput, ...)`; if `expected` were read from that fresh row the
compare-and-set would always match and the lock would be a no-op. The
characterization test (task 1.1) runs through the service to pin this down.

### D6 — Single init migration, hand-synced (MVP)

Per the repo's MVP disposable-DB rule, do not author an incremental
`ALTER TABLE`. Add the `version` column to `prisma/schema.prisma` and the single
init migration's SQL, then `prisma migrate reset` the non-prod databases. State
this explicitly because the change touches the data model.

## Before / After data flow

```text
BEFORE  client save -> service (no version) -> repo.update (unconditional)
                    -> wipe all children -> recreate (client ids, no createdAt)
        second concurrent save overwrites the first; no signal.

AFTER   client save (carries loaded version)
                    -> service forwards expected version
                    -> repo.updateMany { id, version } increment
                    -> count 0 ? throw SectionVersionConflictError (409, nothing deleted)
                            : wipe + recreate (server ids) -> return read model w/ new version
```

## Load-bearing invariants

- **Preserves** the role-coverage gate: the existing draft-save / submit / fill
  procedures keep their canonical middleware chains; only error and payload
  shapes change.
- **Preserves** the destructive-db guard and append-only-after-prod rule — the
  schema edit lands via `migrate reset` during MVP, not a prod migration.
- **Preserves** the lead-report-controls-integrity surface: the save-now busy
  state and snapshot rules are untouched; the form only gains a refetch on 409.
- **Relaxes** nothing in authz; tightens write integrity.

## Risks / Trade-offs

- **A 409 surfaces to a single user who only had one tab open** → the in-flight
  autosave-vs-manual race is the likely trigger. The lead form must handle two
  distinct same-user cases, NOT a blanket refetch:
  - **Queued autosave continuation** — `useLeadFormAutosave`
    (`apps/web/src/hooks/use-lead-form-autosave.ts`) queues a second payload
    while the first save is in flight, then fires that queued snapshot from the
    first save's `onSuccess` (lines 111–128) before the invalidated query has
    refetched. That queued snapshot carries the version loaded BEFORE the first
    save bumped it, so it would self-conflict; and recovering it by refetch would
    discard the user's queued local edits. Fix: `onSuccess(data)` consumes the
    bumped `version` from the mutation result (the read model D5 already returns)
    and rebases the queued payload's `version` onto it before firing — never
    refetch-discard a queued payload that holds unsaved edits.
  - **Genuine cross-writer conflict** (a real second writer) → refetch and let
    the next save proceed silently, so the user sees a brief reload, not an error
    toast.
- **`createdAt` provenance is NOT preserved by this change** → the read model
  carries no child `createdAt` (confirmed:
  `itemReadModelSchema` / `riskReadModelSchema` / `decisionReadModelSchema` in
  `packages/shared/src/schemas/section.schema.ts` and the repo read mapper omit
  it), so the delete-recreate strategy stamps a fresh `createdAt` on every save.
  Preserving it would require widening read + input schemas and persistence in
  two repositories; that is deferred as a follow-up, not a blocker for the
  concurrency fix. The spec carries no provenance requirement.
- **Forgetting to bump `version` on any new section write path** → centralise
  the compare-and-set in `saveSection` / `fillFromSection` and add a
  characterization test so a future writer that bypasses it fails CI.

## Migration Plan

1. Edit `prisma/schema.prisma`: add `version Int @default(1)` to
   `ReportSection`; remove the `TODO(v8.5-A-occ)` comment.
2. Hand-sync the column into the single init migration SQL.
3. `prisma migrate reset` the `_dev` and `_test` databases (MVP; pass the
   Prisma AI-consent env var per repo rule).
4. Ship shared-schema, repository, service, mapper, and web changes together —
   the new required `version` payload field is a contract change across
   apps/web and apps/api, so they must land in one commit.

Rollback: revert the commit and `migrate reset`; no prod data exists (MVP).

## Open Questions

- Does the client always have a fresh `version` to send on the very first
  autosave after load, or does the initial read model need to seed it from the
  section fetch? (Confirm during implementation against the lead-form load.)
- Should the head review/publish paths that touch sections also adopt the same
  compare-and-set, or is `make-publish-atomic` (separate backlog item) the right
  home for that? Leave out of scope here.
