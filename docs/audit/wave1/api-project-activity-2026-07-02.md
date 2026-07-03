# Per-file audit — apps/api/src/modules/project-activity (2026-07-02)

Read-only audit, wave 1.
3 files scanned: `project-activity.module.ts`, `project-activity.prisma-repository.ts`, `project-activity.service.ts`.
8 findings kept, 0 killed by verification.

## project-activity.module.ts — clean

Already good: Minimal, single-purpose wiring module; factory + inject is the correct pattern for DI-token indirection, nothing to trim.

## project-activity.prisma-repository.ts (5 findings)

| Lines                                  | Dimension   | Severity | Finding                                                                                                                                                                                                                                                                                                                                                         | Suggestion                                                                                                                                                                                                                                                               | Your verdict |
| -------------------------------------- | ----------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| 26-27                                  | comments    | low      | Comment cites a ticket reference `(REPO-09)` — change-log/ticket archaeology the comment-hygiene policy explicitly bans (git history already holds it). Same pattern is copy-pasted into report-sections/admin/carry-over prisma repos (verified: report-sections.prisma-repository.ts:387, admin.prisma-repository.ts:40, carry-over.prisma-repository.ts:26). | Drop the `(REPO-09)` tag; keep just "Zod-parse on the way out so the wire contract is enforced at the repository boundary."                                                                                                                                              |              |
| 116-121                                | comments    | medium   | 6-line comment ahead of detachLead's transaction — well over the 3-line budget. It is load-bearing rationale (why ActivityStatus rows must be cascade-deleted only on open/reopened periods, and why published/archived history is exempt) — a real coordination invariant, not narration.                                                                      | RELOCATE: move the full rationale into an openspec spec/ADR for project-activity detach semantics, leave a <=2-line pointer comment here (e.g. "deleteMany is idempotent; ActivityStatus is cascaded on open/reopened only — see <spec link>").                          |              |
| 16-24,64-69,77-83 (+ service.ts 28-40) | duplication | medium   | The 4-field write shape (name, groupId, projectId, jiraAccounts) is retyped independently 4 times across this file and its interface in project-activity.service.ts (create signature, update signature x2, plus ActivityRow's own overlapping fields) instead of deriving from a single type.                                                                  | Extract one local type, e.g. `type ProjectActivityWriteFields = { name: string; groupId: string; projectId: string \| null; jiraAccounts: string[] }`, and reuse it for both create() and update()'s Omit<..,'id'> shape in the repository interface and implementation. |              |
| 129                                    | constants   | medium   | `report: { periodStatus: { in: ["open", "reopened"] } }` is a magic array duplicated verbatim in apps/api/src/modules/weekly-report/weekly-report.prisma-repository.ts (lines 45, 91) and also apps/api/src/modules/activity/activity.prisma-repository.ts (line 37) with no shared named constant — it encodes the cross-module "editable period" contract.    | Define an `EDITABLE_PERIOD_STATUSES = ["open", "reopened"] as const` in packages/shared (near the period-status schema) and import it in the weekly-report, activity, and project-activity repositories instead of re-literal-ing the array.                             |              |
| 93-96                                  | parameters  | low      | `setArchived(activityId: string, archived: boolean)` is a boolean-flag positional parameter, which the parameter-count policy calls out as an options-object trigger regardless of arity (a bare `true`/`false` at a call site is unreadable).                                                                                                                  | Change the interface/impl/call site to `setArchived(input: { activityId: string; archived: boolean })`.                                                                                                                                                                  |              |

Already good: toReadModel centralizes row->schema mapping and the leadIds sort is a nice, deterministic detail; every repo method stays under 15 lines and single-purpose. detachLead's deleteMany-based idempotency (avoiding P2025 on double-detach) is a good, non-obvious correctness choice, appropriately called out.

## project-activity.service.ts (3 findings)

| Lines   | Dimension | Severity | Finding                                                                                                                                                                                                                                                                                  | Suggestion                                                                                                                                                                                                               | Your verdict |
| ------- | --------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| 51-58   | comments  | medium   | 8-line JSDoc header on the exported ProjectActivityService class — narrates namespace-collision avoidance ('activity._' vs 'projectActivity._') and the group-scoping design decision, well past the 3-line budget.                                                                      | RELOCATE: the namespace-collision warning and group-scoping rationale belong in an openspec spec/ADR; leave a 1-2 line pointer comment on the class.                                                                     |              |
| 78-82   | comments  | low      | 5-line comment inside update() explaining the group-move business rule, over the 3-line budget.                                                                                                                                                                                          | RELOCATE: trim to a 1-2 line pointer ("moving groups while leads are attached would strand the attach-time group constraint — reject") and put the full explanation in the spec/ADR alongside the attach-lead invariant. |              |
| 131-136 | comments  | low      | 6-line comment inside detachLead() re-explains the same ActivityStatus-cascade + fail-closed-reload rationale already commented at length in the repository file — duplicated narration across two files, both over budget (service lines 131-132 literally restate repo lines 117-119). | RELOCATE both copies into one spec/ADR section; leave a single short pointer in each file instead of two independent long explanations.                                                                                  |              |

Already good: Clean domain-error split (NotFound vs Domain) mapped cleanly to tRPC error codes elsewhere; getExisting/assertReferencesExist are well-factored small private helpers avoiding duplication inside the class itself.

## Rollup

**By dimension:** comments — 5 (2 medium, 3 low); duplication — 1 (medium); constants — 1 (medium); parameters — 1 (low).

**By severity:** medium — 4, low — 4, high/critical — 0.

**Top-3 highest-impact:**

1. `EDITABLE_PERIOD_STATUSES` magic array duplicated across 3 modules (repo:129) — a real cross-module contract with no single source of truth; a future status-name change (e.g. adding a status) has to be caught in 3 places by memory alone.
2. Duplicated ActivityStatus-cascade rationale sprawled across repo (116-121) and service (131-136) as two independent 5-8 line comments — both over the 3-line budget and drifting out of sync risk.
3. 4x retyped write-shape (repo 16-24/64-69/77-83 + service 28-40) — duplication that will silently desync on the next field addition (a new activity field added to one signature and missed in another).

**Overlaps with a PENDING openspec change — handle there, not as a style sweep:**

- The `EDITABLE_PERIOD_STATUSES` finding (repo:129, and its siblings in weekly-report/activity repos) touches period-status semantics directly — overlaps `scope-period-lifecycle-authz`. Consolidate the constant as part of that change rather than a standalone lint pass.
- The `project-activity` module itself is the subject of the `project-activity-reporting` change — any relocate-to-ADR comment work (116-121, 51-58, 78-82, 131-136) should land alongside that change's design.md rather than as a drive-by comment trim, to avoid two sessions editing the same files concurrently.

No other finding here maps to a pending change; the remaining items (duplication, parameters, the REPO-09 comment tag) are local style/hygiene, safe for a standalone cleanup pass.

## Killed by verification

None — all 8 findings from the initial pass were confirmed against the source and kept.
