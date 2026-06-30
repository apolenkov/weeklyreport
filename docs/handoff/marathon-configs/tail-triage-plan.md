# Tail-triage wave plan — backlog-2026-06-30 marathon

Branch: `impl/backlog-2026-06-30` · HEAD: `b2f07557` · Date: 2026-07-01

## TL;DR

All 19 triaged changes are **already implemented AND committed** on this branch.
Every record is `stakes: high` and `alreadyImplemented.done: yes`, and I confirmed
a matching commit for each (incl. the two the records called "uncommitted" — they
are in fact committed: `scope-analytics-to-group` → 49f5520c, `guard-autopublish-archived`
→ ee302140).

Consequences for the wave plan:

- **disjointBatches = empty.** Batching is only for LOW-stakes changes. There are
  zero low-stakes changes here, so no `waveb-batch` group is formed.
- **serial (re-implement) = empty.** `waveb-autorun` re-implements; nothing here
  needs implementing. Putting any of these in the implement lane would re-do shipped work.
- **verifyThenArchive = all 19.** The entire tail is a verify-pass + `openspec archive`,
  one change at a time, never a re-implement.

The collision analysis below is therefore advisory for the **verify/archive gate
ordering** (one toolchain gate at a time; schema-reset changes handled serially by
the orchestrator), not for parallel implementation.

---

## 1. Collision matrix (literal modifiedFiles set-intersection, all 19)

Files touched by >1 change. Each row would force serialization **if these were being
implemented**; here it dictates that their verify gates not be interleaved and that
`openspec archive` (which mutates spec files) runs sequentially.

| Shared file                                        | Changes sharing it                                                                                         |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `infrastructure/trpc/trpc.error-mapper.ts`         | scope-period-lifecycle-authz · fix-carryover-persistence · map-domain-errors · add-section-optimistic-lock |
| `infrastructure/trpc/trpc.router.ts`               | scope-period-lifecycle-authz · make-publish-atomic · scope-leadform-revoke-authz · scope-reminder-authz    |
| `report-sections/lead-form.prisma-repository.ts`   | scope-leadform-getbyperiod · map-domain-errors · scope-leadform-revoke-authz · add-section-optimistic-lock |
| `report-sections/lead-form.service.ts`             | scope-leadform-getbyperiod · map-domain-errors · scope-leadform-revoke-authz                               |
| `report-sections/lead-form-shared.ts`              | map-domain-errors · scope-leadform-revoke-authz                                                            |
| `report-sections/lead-form.contract.test.ts`       | scope-leadform-getbyperiod · map-domain-errors                                                             |
| `period/period.service.ts`                         | scope-period-lifecycle-authz · make-publish-atomic                                                         |
| `period/period.prisma-repository.ts`               | period-uniqueness-db-constraint · make-publish-atomic                                                      |
| `weekly-report/weekly-report.prisma-repository.ts` | scope-period-lifecycle-authz · make-publish-atomic                                                         |
| `publication/publication.service.ts`               | map-domain-errors · guard-autopublish-archived                                                             |
| `admin/admin-period.queries.ts`                    | period-uniqueness-db-constraint · map-domain-errors                                                        |
| `admin/admin.prisma-repository.ts`                 | period-uniqueness-db-constraint · transactional-snapshot-restore                                           |
| `admin/admin-shared.ts`                            | map-domain-errors · transactional-snapshot-restore                                                         |
| `admin/period-admin.service.ts`                    | scope-period-lifecycle-authz · transactional-snapshot-restore                                              |
| `prisma/schema.prisma` + init migration SQL        | period-uniqueness-db-constraint · add-section-optimistic-lock (**schema-reset cluster**)                   |
| `auth/auth.routes.ts`                              | period-uniqueness-db-constraint · fix-open-redirect-next-param                                             |
| `web/app/login-page.client.tsx`                    | fix-prod-web-build-args · fix-open-redirect-next-param (+ declared dep)                                    |
| `web/hooks/use-lead-form-autosave.ts`              | serialize-autosave · add-section-optimistic-lock                                                           |
| `apps/api/src/main.ts`                             | route-pdfs-and-authz · set-express-trust-proxy                                                             |

### Clusters (transitively-connected components by shared files)

- **C1 lead-form/authz cluster:** scope-leadform-getbyperiod, map-domain-errors,
  scope-leadform-revoke-authz, add-section-optimistic-lock (chained via
  lead-form.prisma-repository.ts + lead-form.service.ts + lead-form-shared.ts).
- **C2 period/publish cluster:** scope-period-lifecycle-authz, make-publish-atomic,
  period-uniqueness-db-constraint, guard-autopublish-archived, transactional-snapshot-restore
  (chained via period.\*, publication.service.ts, admin-period.queries.ts, admin.prisma-repository.ts,
  admin-shared.ts, period-admin.service.ts, trpc.error-mapper.ts, trpc.router.ts).
- **C3 tRPC router/error-mapper hub:** error-mapper.ts and router.ts are the highest-fan-in
  files; they tie C1 and C2 together (scope-reminder-authz joins on router.ts;
  fix-carryover-persistence + add-section-optimistic-lock join on error-mapper.ts).
- **C4 auth/login edge:** fix-open-redirect-next-param, fix-prod-web-build-args,
  period-uniqueness-db-constraint (login-page.client.tsx + auth.routes.ts).
- **C5 main.ts deploy edge:** route-pdfs-and-authz, set-express-trust-proxy.
- **C6 autosave edge:** serialize-autosave, add-section-optimistic-lock (use-lead-form-autosave.ts).

### True singletons (modifiedFiles disjoint from every other change)

- `enforce-deactivation-pdf-bullboard` (session-deactivation.\*, trpc.context.ts, bull-board.module.ts)
- `escape-org-data-script` (layout.tsx, layout.test.tsx, organization.ts)
- `scope-analytics-to-group` (analytics/\*, lib/group-scope.ts, modules/trpc/trpc.router.ts)

NOTE on `scope-analytics-to-group`: its record lists `apps/api/src/modules/trpc/trpc.router.ts`,
a path that does not exist (the real router is `apps/api/src/infrastructure/trpc/trpc.router.ts`).
The committed change (49f5520c) modifies the analytics repo/service/cache + group-scope.ts;
treat the router path as a record typo. If the verify pass shows it actually touches the
**infrastructure** router, it joins C3 and is no longer a singleton.

### Migration-path discrepancy to flag

`period-uniqueness-db-constraint` lists `prisma/migrations/20260530162224_init/migration.sql`
(correct — the only migration dir on disk). `add-section-optimistic-lock` lists
`prisma/migrations/0_init/migration.sql`, which does **not** exist; the real edit landed
in `20260530162224_init/migration.sql`. So these two collide on **both** `schema.prisma`
**and** the same init migration file — a hard schema-reset serialization point.

---

## 2. Disjoint batches (low-stakes parallel `waveb-batch` groups)

**None.** All 19 changes are high-stakes (authz / concurrency / schema / publish-snapshot /
security). The harness forbids batching high-stakes work; each is verified one-at-a-time
with full individual rigor. No `waveb-batch` run is scheduled for this tail.

(For reference: even the three true singletons above — enforce-deactivation-pdf-bullboard,
escape-org-data-script, scope-analytics-to-group — would have been batch-eligible on the
disjointness test alone, but their high stakes disqualify them.)

---

## 3. Serial (one-at-a-time `waveb-autorun` re-implement lane)

**None.** `waveb-autorun` re-implements changes; every change in this tail is already
implemented and committed (git log confirms a commit per change). Routing any of these
into the implement lane would re-do shipped work and risk regressing a verified fix.

All 19 are routed to **verify-then-archive** (§4) instead.

### Recommended verify/archive ORDER (advisory — one gate at a time)

Even though no re-implementation happens, the verify gate is single-threaded and the
two schema changes are migrate-reset points. Recommended sequence:

1. **Singletons / no-collision first** (cheapest, fully independent gates):
   escape-org-data-script, enforce-deactivation-pdf-bullboard, scope-analytics-to-group,
   serialize-autosave-adjacent web-only ones.
2. **Non-schema clusters** (C1, C2-minus-schema, C3, C4, C5, C6): verify in any order
   internally, but do not interleave their `openspec archive` steps (archive mutates
   spec files; run them strictly sequentially regardless of code disjointness).
3. **Schema-reset cluster LAST:** period-uniqueness-db-constraint, then
   add-section-optimistic-lock — each is a migrate-reset point the orchestrator handles
   serially (concurrent `prisma generate` corrupts the shared client). Run after all
   code-only verifies so a reset doesn't disturb in-flight non-schema gates.

---

## 4. Verify-then-archive set (all 19)

Each gets a verify pass (gate green + integration where `needsIntegration`) then
`openspec archive`. Ordered per §4-recommendation (singletons → clusters → schema last).
Evidence is the landing commit / in-tree proof from each record, re-confirmed against git.

| #   | Change                             | Landed                        | Integration? | Evidence (confirmed)                                                                                                                                                                          |
| --- | ---------------------------------- | ----------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | escape-org-data-script             | df8430a0                      | no           | layout.tsx sink removed; layout.test.tsx asserts `#__org_data` null; organization.ts write-boundary charset guard. Singleton.                                                                 |
| 2   | enforce-deactivation-pdf-bullboard | 89da710d                      | no           | session-deactivation.ts `isUserAccessBarred` + test; wired at trpc.context.ts L105/L213, bull-board.module.ts L64. Singleton.                                                                 |
| 3   | scope-analytics-to-group           | 49f5520c                      | yes          | analytics repo threads session + guardGroupScope + groupScopeFilter; service prepends scopeDiscriminator to cache keys; scope.integration.test added. Verify router path (record typo).       |
| 4   | serialize-autosave                 | 60b6bc26                      | no           | use-lead-form-autosave.ts single in-flight slot + section-scoped baseline + drain via mutateRef. Collides C6 only on use-lead-form-autosave.ts (already co-landed).                           |
| 5   | scope-leadform-getbyperiod         | 4cb591e9                      | no           | filterSectionToSharedProducts + resolveCrossAuthorScope + getSharedNonArchivedProductIds; contract tests for unshared/archived/no-own-section. C1.                                            |
| 6   | map-domain-errors                  | 1553ca93                      | yes          | LeadFormConstraintError + AdminGroupProductConflictError + PublicationNotFoundError; mapper branches; no bare throws remain. C1∩C2∩C3 hub.                                                    |
| 7   | scope-leadform-revoke-authz        | a68d65ee                      | no           | revoke/revokeAllSubmitted take group scope; repo spreads author.reportingGroupId; router builds groupScopeFilter; regression test present. C1∩C3.                                             |
| 8   | add-section-optimistic-lock        | 82f847f7 (+73d9e220)          | yes          | ReportSection `version Int @default(1)`; updateMany compare-and-set → SectionVersionConflictError→CONFLICT; shared schema version field; autosave queue. C1∩C6 + **schema**.                  |
| 9   | scope-reminder-authz               | facead76                      | yes          | execute/listExecutions/dispatchPending scoped via groupScopeFilter; scope unit + 13-case real-DB integration test. C3 (router.ts).                                                            |
| 10  | scope-period-lifecycle-authz       | fb7be80c (+c5627d4e,259f488d) | no           | PeriodScopeError/PeriodNotFoundError; getCurrentEditableId/getLatestPublishedNonArchivedId; archived rejection; admin envelope freeze. C2∩C3.                                                 |
| 11  | make-publish-atomic                | c5627d4e                      | yes          | updateMany WHERE periodStatus≠published compare-and-set; DB-resolved target via getCurrentEditableId; atomicity integration test. C2∩C3.                                                      |
| 12  | guard-autopublish-archived         | ee302140                      | no           | scheduler findMany `archived:false` + skip; AutoPublishResult discriminated skip; compare-and-set updateMany; scheduler tests. C2.                                                            |
| 13  | transactional-snapshot-restore     | 4455edb1                      | yes          | AdminRepository targeted upsert/remove; $transaction wrap + post-commit period applicator; 8 real-DB tests. Minor follow-ups (removeProject parity, tx timeout) non-blocking. C2.             |
| 14  | fix-carryover-persistence          | 6d13c822                      | yes          | saveCarryOver loops all sections; priorityRank+stageNames; P2002→CarryOverConflictError→CONFLICT; period-editability guard; contract+integration tests. C3 (error-mapper).                    |
| 15  | route-pdfs-and-authz               | committed                     | yes          | main.ts mounts createPdfDownloadHandler at /pdfs/:file (replaces express.static); Caddy + next.config rewrites; handler unit+integration tests. C5.                                           |
| 16  | set-express-trust-proxy            | 98758dec                      | no           | main.ts `trust proxy` = 1; rate-limit middleware comment removed; XFF + loopback tests. C5. Dep `fix-deploy-seams` is external to this set — confirm closed before prod-rollout gate.         |
| 17  | fix-open-redirect-next-param       | 4a0b3ef3                      | no           | safe-next.ts sanitizeNext sentinel-origin parser; login-page imports it; dev-login same-origin helper + SAML short-circuit; regression tests. C4.                                             |
| 18  | fix-prod-web-build-args            | committed                     | no           | docker-compose.prod.yml web.build.args (AUTH_STUB/DEV_ROLE_SWITCHER=false, fixed API_URL); login-page NODE_ENV guard; .env.example docs. C4. Acceptance = docker-build smoke, not unit suite. |
| 19  | period-uniqueness-db-constraint    | cc99b037                      | yes          | partial unique index `Report_one_open_per_boundary`; P2002→AdminPeriodOverlapError everywhere; scheduler flip recovery; pg-adapter P2002 shape matcher. C2∩C4 + **schema** (migrate-reset).   |

Schema-reset points (orchestrator-serial, run last): #8 add-section-optimistic-lock, #19 period-uniqueness-db-constraint.

---

## 5. Realistic overnight-throughput note

This tail is not an implementation marathon — it is a verification-and-archive sweep, and
that changes the throughput math. All 19 are already on the branch, so there is no
edit/Codex-review/commit cost per change; the cost is one single-threaded toolchain gate
plus, for the 9 `needsIntegration` changes, a real-`_test`-DB integration run, then an
`openspec archive`. Budget the gate as the bottleneck: a full `prisma generate` + typecheck

- lint + unit suite is the dominant per-change cost, and the two schema changes each force a
  `migrate reset` (with the AI-consent guard) that cannot overlap any other gate. A realistic
  overnight pass clears the three singletons and the code-only clusters comfortably, lands the
  9 integration verifies more slowly (DB spin-up dominates), and finishes with the two
  schema-reset archives serialized at the end; expect the schema pair plus any integration
  flake to be the changes most likely still open at wake-up. Because the verify passes are
  read-only over committed code, a red gate parks a single change for inspection rather than
  stranding a batch — there is no batch to strand.
