# Versions v2 — Restore Fidelity (DRAFT, research capture)

> Status: DRAFT — capture-only research, 2026-06-11 overnight run.
> No implementation is authorized by this document. It records the
> design options and a recommendation for re-introducing version
> history after `defer-versions-coming-soon` (archived 2026-06-11)
> removed v1 entirely. Re-entry points are marked `TODO(versions-v2)`
> in code.

## Why

The 2026-06-11 fidelity bug killed versions v1: restoring v3 showed
stage chip statuses that did not match the saved state. The invariant
versions v2 must satisfy is:

**A version fully determines the section's OWNED content as captured.**
Restoring version N reinstates every author-editable owned field exactly
as it was at capture — no owned field excepted, no silent merge with
current state. Master / foreign data (project name/archive, stage
assignments, author identity, referenced-project names, cross-author
overlays) renders **LIVE** and is pinned from the CURRENT section at
restore, never snapshotted. The narrowing is deliberate: v1's actual bug
was OWNED stage statuses being merged on restore, not master-data drift;
versioning foreign master data is out of scope for a 6-user internal tool
and would wrongly freeze the department's org chart. See `design.md` for
the precise `ownedContentProjection` contract.

### Root causes in v1 (verified in git history, pre-`7d8ace5d`)

1. **Partial capture.** `buildSnapshotData`
   (`lead-form.prisma-repository.ts`, removed) serialized `items`,
   `risks`, `decisions`, `stageStatuses` — and nothing else. It never
   captured `projectStatuses` (the per-product traffic lights), so no
   snapshot could restore them, and restore never touched them either.
   The snapshot shape was hand-maintained and silently drifted from the
   render surface (`reportSectionFullInclude`).
2. **Lenient, field-conditional restore.** `restoreVersion` wiped
   `stageStatus` rows only `if (data.stageStatuses !== undefined)` —
   snapshots that predated the field kept the CURRENT stage statuses.
   Restore therefore produced a merge of old and new state, which is
   exactly the bug the user saw. "Optional field → keep current" is a
   forward-compatibility hack standing in for real snapshot schema
   versioning.
3. **No round-trip contract.** Nothing tested
   `render(restore(snapshot(S))) === render(S)`, and nothing failed
   when a new renderable field (e.g. `stageStatuses`, added in F3.3)
   was introduced without extending the snapshot shape. Each new lead
   surface field was a latent fidelity bug.

### The OWNED, restorable surface (what a snapshot carries)

The contract is over the section's OWNED, author-editable content — the
`ownedContentProjection` in `design.md`, the slice the lead's own writer
reinstates. From the read model (`reportSectionFullInclude` +
`mapPrismaToReportSection`), the SNAPSHOTTED & RESTORED fields are:

- `items` (current/next week, incl. `priorityRank`, `stageNames`,
  `workflowStatus`, `carriedOver`, `completed`, tag, project link);
- `risks` (severity, impact, mitigation, `stageNames`, project link);
- `decisions` (owner, deadline, impact, `resolvedAt`, `stageNames`,
  product link);
- owned `projectStatuses` (per-product traffic lights) — MISSED by v1 —
  folded into `projects[].trafficLight`;
- owned `stageStatuses` (per product×stage chip colors) — partially
  handled by v1 — folded into `projects[].ownedStages[].status`.

These are the OWNED fields; anything here a snapshot does not carry
violates the invariant. The drift guard must make owned-field growth fail
loudly (see Option A, drift guard).

**NOT in the round-trip equality set:**

- Section lifecycle meta `status` / `submittedAt` / `late` is
  **OVERLAY-METADATA**: captured for display in the version overlay, but
  **pinned-from-live** on restore (a stale snapshot must never flip a
  section's status) and never compared in the round-trip.
- Master / foreign data (project name/archive, stage assignments,
  `authorName` / `authorRole`, `referencedProjects`, cross-author
  overlays) renders LIVE and is pinned from the CURRENT section, never
  snapshotted.

## Options

### Option A — Full-state snapshot v2 (recommended)

One JSON snapshot per version, as in v1, but with three structural
fixes:

1. **Capture = the owned content projection.** The snapshot payload is
   the `ownedContentProjection` — the OWNED slice of the same read model
   that renders the page (one shared projection function in the
   repository/service layer), not a parallel hand-written serializer.
   A type-level drift guard in `packages/shared` binds the snapshot Zod
   schema to the owned-projection type by **deep exact-key** equality
   (`ExactDeep`, recursing into `items[]` / `risks[]` / `decisions[]` /
   `ownedStages[]` elements — NOT top-level-only), so `pnpm typecheck`
   fails when an owned renderable field is added at any level but not
   snapshotted. Lifecycle meta and master/foreign data are deliberately
   outside this set (pinned-from-live; see the OWNED surface above).
2. **`schemaVersion` in every snapshot.** A named const
   (`SNAPSHOT_SCHEMA_VERSION`) is stored inside the payload. Restore
   parses the payload with the strict Zod schema for that
   `schemaVersion`. An older `schemaVersion` is either migrated by an
   explicit registered migration (old shape → current shape, total,
   tested) or the restore is refused with a clear error. There is no
   "field missing → keep current" path, ever.
3. **Atomic full replace.** Restore wipes and recreates the ENTIRE
   ownership scope of the section (items, risks, decisions,
   projectStatuses, stageStatuses) in one transaction,
   unconditionally. Partial/conditional wipes are banned by spec.

Pros: simplest model that satisfies the invariant; restore is O(1)
reads; matches v1 operational experience (throttle/dedup/retention
logic is recoverable from git history); standard practice for
document-style version history (snapshot-per-version with a
`schemaVersion` and on-read migration is the common industry pattern).
Cons: storage duplication per version (negligible: 6 leads × weekly
sections, payloads are a few KB); no per-field change attribution.

### Option B — Event log (event sourcing)

Persist every mutation (`ItemEdited`, `RiskAdded`,
`StageStatusChanged`, …) and rebuild any version by replay; "versions"
become labeled positions in the log.

Pros: perfect audit trail (who/when/what), per-change granularity,
diffs for free. Cons: an order of magnitude more machinery — event
schema per mutation type, replay engine, upcasting old events on every
schema change (the same fidelity problem multiplied per event type,
not solved), snapshotting needed anyway as a replay optimization. The
v1 post-mortem reason for removal was complexity; this is more
complexity for a 6-user internal tool with no audit requirement.
Rejected.

### Option C — Hybrid (snapshot + small event metadata)

Full-state snapshots as in A, plus a lightweight `origin` / change
summary stored per snapshot (e.g. "autosave", "manual", "pre-restore",
"pre-fillFrom", counts diff vs previous). This is Option A plus richer
listing UX, not a different storage model. Viable as an A follow-up;
not a separate architecture.

### Option D — Normalized row versioning (copy-on-write child rows)

Keep versioned copies of the child tables themselves (a
`sectionVersionId` on `Item`/`Risk`/… or shadow history tables /
Postgres temporal triggers).

Pros: no JSON, schema migrations apply to history automatically.
Cons: every child table grows version dimensions; every existing query
must filter to the live version; FK/uniqueness constraints get
version-qualified; the blast radius touches the whole report domain
for a feature one page uses. Disproportionate. Rejected.

## Recommendation

**Option A**, with these decided semantics:

1. **Restore creates a new version, never rewrites history.**
   Restoring vN first captures a safety snapshot of the current state
   (kind `pre-restore`, exempt from throttle/dedup), then applies vN's
   payload as the new current state. The version list only ever grows;
   "undo the restore" is just another restore. This is the
   Google-Docs-style semantics users already expect.
2. **Round-trip fidelity is the gating contract.** An integration test
   asserts deep equality of the `ownedContentProjection` before snapshot
   and after restore, for a section exercising EVERY owned renderable
   field (items with priorities, risks, decisions, owned project +
   stage statuses, both `trafficLight` fold branches). A page-layer test
   also covers the owned chips through `mapLeadFormData` +
   `applyCrossAuthorStageOverrides`, asserting cross-author overlays and
   foreign rows stay LIVE. A separate lifecycle test asserts
   `status` / `submittedAt` / `late` are pinned-from-live (never the
   snapshot's). The deep exact-key (`ExactDeep`) type guard fails when the
   owned projection gains a renderable field — at any nesting level — that
   the snapshot schema lacks.
3. **Lock interactions (publish/period/submit):**
   - Snapshot writes follow the existing save gate: no snapshots on
     submitted sections or non-open periods (v1 already did this —
     keep it).
   - Restore is allowed only where saving is allowed: own section,
     `status = draft`, period `open`. Viewing old versions (read-only
     overlay) is allowed even when locked.
   - Restore writes only section child rows; it is NOT a
     Report-period writer, so the `period-dual-state` invariant is
     untouched (mirrors the existing "lead section save" exemption in
     that spec).
4. **Snapshot trigger, throttle (60 s), content dedup, and time-based
   retention** are re-adopted from v1 as-is (git history of
   `snapshot.service.ts`, commit `7d8ace5d~1`) — they worked; only
   capture/restore semantics were broken. Pinning
   (`add-version-pin`) returns only if the user re-asks; it is out of
   scope here.
5. **No legacy-payload migration burden at launch.** v1 data was
   dropped with the table; v2 starts at `schemaVersion = 1` with zero
   historical payloads. The migration/refusal machinery exists from
   day one so the FIRST schema change after launch already has a
   tested path.

## Non-goals

- No implementation in this change (capture-only draft).
- No pinning, no diff view, no cross-period version browsing.
- No event-sourcing infrastructure.
- No prod-DB operations.

## Capabilities (anticipated, to be confirmed at implementation time)

- New capability `version-restore-fidelity`: the invariant, the
  round-trip contract, strict `schemaVersion` handling, full-replace
  restore, restore-creates-a-version semantics.
- Modified `deferred-feature-pattern`: the version-history ComingSoon
  scenario is retired when the real control returns.
- `period-dual-state`: no delta expected (restore stays a non-writer),
  but verify against the "snapshot restore" writer note in that spec.

## Impact (anticipated)

- `prisma/schema.prisma`: re-add a `VersionSnapshot` model with a
  denormalized `schemaVersion Int` column AND the `{schemaVersion, data}`
  in-payload envelope (design decided BOTH — column aids
  retention/migration queries, envelope is the discriminated-parse source
  of truth) and the `ReportSection.versionSnapshots` relation; hand-sync
  the init migration; `migrate reset` `_dev`/`_test`.
- `packages/shared`: snapshot payload Zod schema with `schemaVersion`,
  drift-guard type, restored history fields if `myHistory` re-adopts
  them.
- `apps/api/.../report-sections/`: snapshot service (re-derived from
  git history), repository capture/restore (NEW semantics), tRPC
  procedures at the `TODO(versions-v2)` marker in `trpc.router.ts`.
- `apps/web/src/components/lead/`: replace `VersionComingSoonControl`
  with the real history nav; wire the autosave success path marker in
  `lead-form.tsx`.
