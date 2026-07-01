# Design — introduce-durable-record-identity

Foundation change. It introduces one column and threads it end-to-end; it builds
no user-visible feature. The spec states the durable-identity invariant; this file
holds the technical decisions and the reconciliations the grounding surfaced.

## The crux — one lineage key, two scopes

The two dependent features want opposite things from the same key, and the design
must reconcile them or it misleads every implementer.

- **The lifecycle lock WANTS cross-period sharing.** A carried clone "is the same
  позиция continuing," so it must stay delete-locked. It answers "has any instance
  of this lineage ever been published?" → it keys on `stableId` **alone**.
- **A C1 comment anchor must NOT leak across periods.** `review-acknowledgement`
  (design item 4) binds a comment to the period it was made on; carry-over does not
  copy comments. If a comment keyed on `stableId` alone, it would also match the
  carried clone in the next period.

Both hold with **one shared `stableId`** because the per-instance anchor is
`(reportSectionId, stableId)`, not `stableId`:

```
позиция lineage:   stableId = L            (one value, shared down the chain)

period N section    reportSectionId = S_N   ── record row (PK id changes per save)
                                               anchor = (S_N, L)   ← period-scoped
       │ carry-over clone copies stableId=L, mints a fresh PK id
       ▼
period N+1 section  reportSectionId = S_{N+1} ── carried row (fresh PK id)
                                               anchor = (S_{N+1}, L) ← different period
```

- `ReportSection` is `@@unique([reportId, authorId])`, so the same lead's section in
  a different period is a **different `reportSectionId`**. Therefore
  `(reportSectionId, stableId)` is period-scoped.
- `saveSection` recreates children under a **fixed `reportSectionId`**, so
  `(reportSectionId, stableId)` survives a save even though the PK `id` does not.

**Rule for consumers:** period-scoped features (comment anchors, move-in-place,
"published in THIS period") combine `(reportSectionId, stableId)`; lineage-wide
features (the lifecycle lock's "ever published") query `stableId` alone. Get this
wrong and the foundation misleads.

## Durable key vs volatile PK — why not just stop recreating rows

`stableId` is a **separate non-PK token**, not a replacement for the DB-minted `id`:

- `add-section-optimistic-lock` is landed. It deliberately lets the database mint
  child PKs on the delete-recreate (`report-sections.prisma-repository.ts`: "the DB
  mints the id — rows are recreated wholesale") and maps a stray `P2002` to
  `BAD_REQUEST`. We do **not** reintroduce client-PK trust.
- So identity comes from a second column the client round-trips, not from the PK.
  The PK stays volatile and server-minted; `stableId` stays durable and preserved.
- Rewriting `saveSection` into a per-row diff-and-upsert (which would let the PK
  survive) is a far larger change to a hot, concurrency-guarded write path and is
  out of scope. The lineage-key approach is the smaller, additive foundation.

**Trust boundary — `stableId` is client-authoritative, by design (flag for the
lifecycle-lock consumer).** Adversarial review surfaced the asymmetry: the PK `id` is
server-reminted and distrusted, yet `stableId` is round-tripped and written back
verbatim (`mergeSection` sets `items: input.items`; `saveSection` persists
`i.stableId`). The section author could therefore swap two of their own records'
`stableId`s or reset an existing record's key. The server **structurally cannot**
reconcile this: `saveSection` is a delete-recreate that does not match input rows to
prior rows (that positional match is exactly the diff-and-upsert rejected above), so
the client is the only source of "which `stableId` this row has." Within-section
duplicates are still rejected (the `@@unique` → `DUPLICATE_CHILD_ROW` 400); what is
not defended is a well-formed reassignment. For the FOUNDATION this has no observable
effect (no feature consumes the key yet), and it is confined to the author's own
section. The **published-record lifecycle lock** — the consumer that needs
tamper-resistance — MUST enforce immutability itself: load the frozen published
snapshot's `stableId`s and reject a save that drops or reassigns a published record's
key. That belongs to the lock change, not this foundation. Recorded here so the lock
does not naively trust the key.

## Minting and the round-trip — the make-or-break invariant

`stableId String @default(uuid())` gives both halves in one construct:

- **Mint-on-create:** a `createMany` row with no `stableId` gets a database default
  — new records added via the Add dialog need no client cooperation.
- **Preserve-on-pass:** a `createMany` row that DOES carry a `stableId` keeps that
  value — the recreate no longer resets it.

The round-trip is the fragile part: if **any** link drops `stableId`, the record
gets a fresh default on the next save and identity silently resets. All links must
carry it, mirroring how `version` was threaded end-to-end:

```
Prisma row.stableId
  → reportSectionFullInclude (already selects all scalar columns)
  → mapPrismaToReportSection  (map into the read model; the hand-written
       PrismaReportSectionWithRelations row type must also declare stableId)
  → itemReadModelSchema / risk / decision  (stableId OPTIONAL on read model)
  → client holds it in draftSection; merge handlers keep it via `...existing`
  → sectionToDraftPayload (WEB)  (must include stableId in the picked fields)
  → draftSaveSchema item/risk/decision inputs  (stableId OPTIONAL on input)
  → saveSection createMany  (persist i.stableId; undefined omitted → DB default)
  → back to the DB row
```

**Optional read model (grounding correction).** The original plan made the read
model `stableId` _required_. The code disproves that: `mergeSection` does
`reportSectionReadModelSchema.parse({ ...section, items: input.items })`, so a
brand-new item — which legitimately has no `stableId` yet — would fail the parse and
break the very first save. So `stableId` is **optional on both input and read
model**, exactly mirroring how `id` already works. Presence is guaranteed at the
data layer (`NOT NULL` + `@default(uuid())`), not by the Zod type, so a saved row
always carries one and downstream features that query Prisma directly get a non-null
column.

**The web link the Impact list missed.** `sectionToDraftPayload` picks payload fields
one by one, so it silently dropped `stableId` until fixed. The merge handlers
(`handleRisksChange` / `handleDecisionsChange` / `makeItemsChangeHandler`) already
preserve it for edited rows via `{ ...existing }` keyed on `id`; `draftSection`
re-seeds from each refetch through the same `sectionToDraftPayload`, so the minted
key converges into the baseline without a spurious dirty loop — the same mechanism
`id` (client tmp-id → DB id) already relies on.

## Two write paths, not one

Both must persist `stableId`, or carried records reset on their first real save:

1. `saveSection` (`report-sections.prisma-repository.ts`) — the delete-recreate.
2. `saveCarryOver` (`carry-over.prisma-repository.ts`) — a **separate** writer whose
   `createMany` lists explicit fields today and would drop `stableId` unless it is
   added. `cloneCarriedItem` / `cloneUnresolvedDecision` already spread `...item`, so
   the read-model value flows into the clone once the read model carries it — but the
   clone must keep the source `stableId` and mint only a fresh PK `id`.

**Carry-over must not re-carry a lineage the target already holds.** The new
`@@unique([reportSectionId, stableId])` turns a duplicate-lineage carry into a hazard:
the item insert (`skipDuplicates: true`) would silently skip, orphaning the
`CarryOverRecord` already written for it, and the decision insert (no `skipDuplicates`)
would trip `P2002`, which `saveCarryOver`'s catch misreads as a `dedupeKey` race →
wrong `CarryOverConflictError` + rollback. Both are real regressions the constraint
introduces (low-reachability — needs the same lineage carried into one target from two
sources, which the execution-`dedupeKey` guard does not cover). Fixed at the root in
`CarryOverService.executeCarryOver`: skip source items/decisions whose `stableId`
already exists in the matched target section (carry-over becomes idempotent by
lineage, not only by `dedupeKey`, and counts/records stay accurate). `skipDuplicates:
true` was also added to the decision insert for defense-in-depth against a race.

## Uniqueness — index required, composite-unique chosen

- `@@index([stableId])` is **required** for lineage lookups (the lock's "ever
  published?" query).
- `stableId` is **not** globally unique — a carried clone intentionally shares its
  origin's value across two `reportSectionId`s.
- Add `@@unique([reportSectionId, stableId])` as an integrity guard: within one
  section two distinct records must not collide on the lineage key. Safe against the
  recreate because `deleteMany` precedes `createMany` in the same transaction, and a
  stray `P2002` already maps to `BAD_REQUEST` (landed with optimistic-lock). This
  makes `(reportSectionId, stableId)` a real key the consumers can trust.

## Migration — bake NOT NULL into the init CREATE TABLE

MVP disposable DB: hand-edit the single init migration so `stableId` is a
`NOT NULL DEFAULT gen_random_uuid()` (or an app-side `@default(uuid())`) column in
the `CREATE TABLE` for `Item` / `Risk` / `Decision`, then `migrate reset`. A NOT NULL
column is safe on a reset (no pre-existing rows).

**Seed hazard:** any seed that inserts item/risk/decision rows via **raw SQL**
bypasses Prisma's app-side `uuid()` default and would violate NOT NULL. Either route
those inserts through the Prisma client (which applies the default) or give the
column a **DB-level** default (`gen_random_uuid()`) in the migration so raw inserts
also get a value. Prefer the DB-level default for robustness.

## Scope boundaries

- **Item / Risk / Decision only.** `ProjectStatus` / `StageStatus` are recreated too
  but no record-level feature anchors to them (`review-acknowledgement`: comments
  anchor to "an `Item`, `Risk`, or `Decision`").
- **Risks: mint + preserve, no carry.** `carryOver.execute` clones items + decisions
  only; there is no risk carry path today. Risk carry-over stays with whatever change
  adds it (see `unified-activity-entry` design, "risks do not carry today").
- **`fillFrom` mints, does not preserve.** `LeadFormPrismaRepository.fillFrom`
  (`lead-form.prisma-repository.ts`) is a THIRD write path that delete-recreates the
  target section's rows by copying a prior section as a template — it resets
  `carriedOver: false` and turns next-week items into current-week suggestions. It is
  a fresh-template copy, NOT a lineage continuation, so it deliberately MINTS new
  `stableId`s (its `createMany` omits the field → `@default(uuid())`). It does not
  crash on the NOT NULL column (Prisma applies the app-side default). Only
  `saveSection` (preserve) and carry-over (copy) thread the key; a future change can
  revisit fillFrom if a filled row should share its source's lineage.
- **No feature built.** The lifecycle lock, move-in-place, and comment anchors are
  explicitly NOT implemented here; this change only makes the key they need exist.

## Alternatives rejected

- **New id + a pointer column (parent/lineage-root FK).** More moving parts and a
  self-referential FK that carry-over would have to maintain across periods; the
  task and the dependent designs call for a **copied value**, which a shared
  `stableId` gives directly.
- **Match records by content against the published snapshot.** Rejected in
  `unified-activity-entry` design — fragile (edits change content) and cannot tell an
  edit from a delete.
- **Make the PK survive by diffing the save payload.** Rewrites the hot,
  concurrency-guarded `saveSection` write path; disproportionate to a foundation.
