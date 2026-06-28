## Context

The 2026-06-28 repo-excellence review flagged four P2 code-health concerns that
share a theme: duplicated or dead constructs that pass the gates today but let a
future edit introduce an undetected defect. This change bundles them into one
behavior-preserving cleanup. None changes a tRPC procedure surface, a production
UI string, or observable runtime behavior; each removes a divergence trap.

Source findings (and their review backlog ids):

- `consolidate-duplicated-derivations` — BL-DUPLICATED-DERIVATIONS,
  BL-STATUS-WORST-SSOT.
- `cleanup-dead-code-and-test-infra` — BL-DEAD-ROUTERS-AUTH, BL-TEST-INFRA,
  BL-DEAD-CODE.
- `shared-dialog-focus-management` — BL-DIALOG-A11Y.
- `align-fk-ondelete` — BL-FK-ONDELETE-ASYMMETRY.

## Goals / Non-Goals

**Goals:**

- One implementation per duplicated derivation, reused at every call site.
- A test layer that is honest: dead mocks fire-or-go; spies are restored.
- One shared focus-managed dialog primitive for all modals.
- A uniform FK `onDelete` policy for report content referencing `Project`.

**Non-Goals:**

- The full traffic-light enum re-typing across ~33 files (the recorded
  `architecture-refactor-backlog` SSOT target). This change closes one slice
  (the duplicated `computeWorstStatus`) and leaves the broader enum unification
  to its own grilled change.
- Changing any dialog's content, actions, or the admin dialogs' observable focus
  behavior.
- Adding a hard product-delete feature; the FK alignment documents that hard
  delete stays unsupported (archive via the `archived` flag).

## Decisions

1. **Capability split.** Four new capabilities (`shared-derivation-ssot`,
   `dead-code-elimination`, `test-mock-hygiene`, `shared-dialog-focus-management`)
   plus three ADDED deltas to existing capabilities. The deltas dedup into the
   review's named targets rather than spawning near-duplicate specs:

   - MSW fire-or-delete → `web-trpc-test-harness` (it already mandates
     `createMockTRPC` as the sanctioned stub path; a dead parallel mock layer is
     the same contract's concern).
   - Admin dialogs onto the shared primitive → `admin-dialog-focus-management`
     (ADDED, structural, mirroring how `lead-dialog-lifecycle` mandates the
     shared hook; the two existing behavioral requirements are untouched).
   - FK `onDelete` policy → `schema-conventions` (FK policy is a sibling schema
     convention to the existing Zod string-format convention).

2. **`web-test-timer-discipline` is evaluated and excluded.** Its body governs
   timer advancement (`advanceTimersByTimeAsync`, fake-vs-real timers); finding
   2c is mock/spy lifecycle (`restoreMocks`, leaked spies) — a different
   mechanic, and the api-side spies do not fit a web-only spec. `test-mock-hygiene`
   is the right home for the whole 2c concern (web + api in one place).

3. **MSW requirement framed as the invariant, not a mandate to keep MSW.** "No
   dead parallel HTTP-mock layer" is satisfied by either disposition — wire it
   with a real test, or delete it — matching the finding's both-ways recommendation.

4. **Dead-code requirement kept at invariant altitude.** BL-DEAD-CODE enumerates
   ~9 specific items; those live in tasks.md. The requirement says only "code
   proven unused is removed or wired, per grep evidence", so it does not rot as
   the file list shifts.

5. **`priorityRank` added to `LeadKanbanItem` (not removed from the mapper).**
   The review notes a naive "remove the unused field" cleanup would re-break the
   prior F1 fix; the correct direction is to make the type declare what the
   mapper emits.

6. **Worst-status canonical copy is the `TrafficLightStatus`-typed snapshot one.**
   The repository's loose string-typed `?? 0` copy is the one deleted; the typed
   copy is the source of truth, consistent with the `architecture-refactor-backlog`
   traffic-light SSOT direction.

## Risks / Trade-offs

- [Deleting "dead" code that is actually referenced] → Prove unused with grep
  over all references + imports + build config (and tests that may import the
  dead routers) before deleting; if unprovable, wire instead or leave a note.
  Repo MVP posture pre-authorizes pruning, but only with evidence.
- [Behavior drift while "preserving behavior"] → Each derivation extraction is
  guarded by the existing tests at the call sites; the worst-status and
  reportHasContent consolidations keep the canonical implementation's exact
  semantics. The dialog migration keeps the admin focus regression tests green.
- [FK `onDelete` change via init-migration hand-edit] → MVP disposable-DB
  posture applies: edit `schema.prisma`, hand-edit the single init migration SQL
  to match, then `migrate reset` on non-prod DBs. No incremental alter-table
  migration. Verify schema and migration `ON DELETE` clauses agree.
- [`restoreMocks: true` exposing previously-masked leaks] → If enabling global
  restoration surfaces a test that depended on a leaked spy, fix that test; do
  not weaken the setting.

## Invariants

- **Period dual-state**: untouched (no period writers change).
- **Role-coverage gate**: preserved — dead routers are removed/rewired, the live
  inline `adminProcedure`/`headProcedure` routers remain the only production path.
- **Destructive-db guard**: respected — the FK reshape runs through `migrate
reset` on suffixed non-prod DBs; prod stays gated by `ALLOW_PROD_DESTRUCTIVE`.
- **Deferred-feature pattern**: unaffected (no ComingSoon surfaces touched).

## Migration Plan

1. Land the shared-derivation extractions and type fix (api + shared + web) with
   existing tests green.
2. Land the dead-code removals (prove-unused first) and the test-infra fixes.
3. Land the shared dialog primitive migration; keep admin focus tests green.
4. Reshape the FK policy in `schema.prisma`, hand-edit the init migration SQL,
   `migrate reset` non-prod DBs, regenerate the Prisma client.
5. Run all gates: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.

Rollback: each step is an isolated commit; revert the offending commit. No data
migration is irreversible (non-prod DBs are disposable and reseeded).

## Open Questions

- On-time-ratio: confirm whether the pooled 4-period gauge and the latest-period
  card are intentionally different windows (rename both) or the same metric
  computed twice (collapse to one). Resolve during implementation by reading both
  consumers; default to renaming if the windows genuinely differ.
