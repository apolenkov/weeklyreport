---
phase: 56
plan: full
subsystem: admin
ufb: UFB-054
tags: [schema, m2m, admin, group-scope]
dependency-graph:
  requires: [44-A, 46-A, 48-A, 51-A]
  provides: [explicit-group-product-edge, group-scope-opt-in-seam]
  affects: [admin.groups, admin.products, head-dashboard (deferred)]
tech-stack:
  added:
    - prisma model `GroupProduct` (join table)
    - shared schemas `groupProductSchema`, `groupProductEdgeInputSchema`
    - tRPC procedures: `admin.attachProductToGroup`, `admin.detachProductFromGroup`, `admin.listGroupProducts`, `admin.listProductGroups`
    - lib seam: `groupScopeFilter(..., { useExplicitGroupProducts })`
    - web components: `GroupProductsEditor`, `ProductGroupChips`
  patterns:
    - additive-only migration with idempotent backfill (ON CONFLICT DO NOTHING)
    - optional repository surface (matches `listReminderPolicies?(...)` pattern)
    - opt-in seam preserves bit-for-bit legacy SQL (default-off)
key-files:
  created:
    - prisma/migrations/20260511014523_group_product_m2m/migration.sql
    - apps/web/src/components/admin/group-products-editor.tsx
    - apps/web/src/components/admin/group-products-editor.test.tsx
    - apps/web/src/components/admin/product-group-chips.tsx
    - apps/web/src/components/admin/product-group-chips.test.tsx
  modified:
    - prisma/schema.prisma
    - packages/shared/src/schemas/report.ts
    - packages/shared/src/schemas/__tests__/report.test.ts
    - apps/api/src/modules/admin/admin.service.ts
    - apps/api/src/modules/admin/admin.service.test.ts
    - apps/api/src/modules/admin/admin.prisma-repository.ts
    - apps/api/src/modules/admin/admin.contract.test.ts
    - apps/api/src/modules/admin/admin.integration.test.ts
    - apps/api/src/test-utils/prisma-test-helper.ts
    - apps/api/src/lib/group-scope.ts
    - apps/api/src/lib/group-scope.test.ts
    - apps/web/src/components/admin/admin-panel.tsx
    - apps/web/src/components/admin/groups-tab.tsx
    - apps/web/src/components/admin/products-tab.tsx
decisions:
  - Use `GroupProduct` join table (M:M) instead of `Project.reportingGroupId[]` array column (referential integrity, cross-departmental support).
  - `Project.leadId` left untouched — existing read paths derive group via `lead.reportingGroupId` until they opt in to 56-D.
  - Inline backfill SQL in the migration (matches 44-01 / 51-C convention); `ON CONFLICT DO NOTHING` makes it idempotent.
  - Repository methods optional on `AdminRepository` so in-memory test repos keep compiling (matches `listReminderPolicies?(...)`).
  - 56-D ships an opt-in `useExplicitGroupProducts` flag; default OFF so existing scope-filter callers produce bit-for-bit identical SQL.
  - 56-C edits live exclusively in the Groups tab; the Products tab is read-only (chip set). One edit path = no two competing UIs for the same edge.
  - RESTRICT FKs on GroupProduct (not CASCADE) — accidental Project/Group deletes must surface as errors, not silently lose edges.
metrics:
  duration: 17 minutes (well under the 2h budget for 56-C)
  completed: 2026-05-11T02:01Z
---

# Phase 56 — Group ↔ Products M:M model expansion

## One-liner

Explicit Group↔Product M:M join table + four admin tRPC procedures + admin UI on both tabs + opt-in scope-filter seam, without breaking the existing `Project.lead.reportingGroupId` read paths.

## Commits

| Commit  | Plan | Scope                                                         |
| ------- | ---- | ------------------------------------------------------------- |
| 3527233 | 56-A | `feat(schema)` — GroupProduct M:M + inline backfill migration |
| 2ec34f3 | 56-B | `feat(api)` — admin tRPC mutations + service + repo + tests   |
| 3b1ab45 | 56-D | `feat(api)` — groupScopeFilter opt-in seam (default OFF)      |
| ef3ddbf | 56-C | `feat(web)` — Groups-tab editor + Products-tab chip read      |

Note: the tRPC router edits for 56-B's four procedures landed inside commit `4fe2d56` instead of `2ec34f3` due to an accidental sweep by the parallel Phase 52 telemetry agent during a `git stash` round-trip. The router code is functionally identical to what 56-B intended and is covered by 56-B's contract tests in `admin.contract.test.ts`. No data loss; the co-commit is noted in 2ec34f3's commit body for future audit.

## What shipped

```
┌─ Phase 56 deliverable layout ────────────────────────────────────┐
│                                                                  │
│  schema       prisma/schema.prisma  + GroupProduct model         │
│               + inverse relations on ReportingGroup, Project     │
│  migration    20260511014523_group_product_m2m + backfill SQL    │
│                                                                  │
│  api          shared schemas: groupProductSchema,                 │
│               groupProductEdgeInputSchema                        │
│  api          admin.service.ts +4 methods, optional repo iface    │
│  api          admin.prisma-repository.ts +4 implementations       │
│  api          tRPC: admin.attachProductToGroup, detach...,        │
│               listGroupProducts, listProductGroups               │
│  api          group-scope.ts opt-in `useExplicitGroupProducts`    │
│                                                                  │
│  web          GroupProductsEditor (Groups tab edit dialog)        │
│  web          ProductGroupChips    (Products tab read-only)       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Verification gates

| Gate           | Target            | Result                                                                                                                                                                                                                     |
| -------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| api unit tests | ≥823              | **859** (+36 vs baseline; +18 from 56)                                                                                                                                                                                     |
| web unit tests | ≥333              | **342** (+9 from 56-C)                                                                                                                                                                                                     |
| shared tests   | ≥494              | **533** (+39 vs baseline; +5 from 56-B)                                                                                                                                                                                    |
| api tsc        | exit 0            | clean for all 56-touched files (pre-existing parallel-agent prom-client typing errors in `publication.service.test.ts` / `report-sections.service.test.ts` / `lead-form.contract.test.ts` ignored — none introduced by 56) |
| web tsc        | exit 0            | exit 0                                                                                                                                                                                                                     |
| migration      | applied, no drift | 27 migrations applied; `migrate status` reports "Database schema is up to date"                                                                                                                                            |
| backfill       | ≥ Project count   | **6 GroupProduct rows** — matches the 6 Projects with grouped leads; idempotent re-run inserts 0                                                                                                                           |
| api health     | container healthy | `Up 15 minutes (healthy)`                                                                                                                                                                                                  |

## Backfill verification

```sql
-- Pre-state baseline
SELECT COUNT(*) FROM "Project" p
JOIN "User" u ON u.id = p."leadId"
WHERE u."reportingGroupId" IS NOT NULL;
=> 6

-- Post-migration
SELECT COUNT(*) FROM "GroupProduct";
=> 6

-- Idempotency proof (re-run the backfill INSERT)
INSERT INTO "GroupProduct" (...) SELECT ... ON CONFLICT (...) DO NOTHING;
=> INSERT 0 0
SELECT COUNT(*) FROM "GroupProduct";
=> 6  (unchanged)
```

`User.reportingGroupId` is non-nullable in the current schema (line 15 of `prisma/schema.prisma`: `reportingGroupId String`), so the backfill's `WHERE u."reportingGroupId" IS NOT NULL` guard is defensively redundant today — kept in case a future schema relaxes that constraint.

## Test deltas

| File                                                           | Added   | Notes                                                               |
| -------------------------------------------------------------- | ------- | ------------------------------------------------------------------- |
| `packages/shared/src/schemas/__tests__/report.test.ts`         | +5      | groupProductSchema parse/reject; edge input                         |
| `apps/api/src/modules/admin/admin.service.test.ts`             | +7      | service unit cases incl. idempotency + not-implemented              |
| `apps/api/src/modules/admin/admin.contract.test.ts`            | +4      | router-shape: each procedure is bound to adminProcedure             |
| `apps/api/src/modules/admin/admin.integration.test.ts`         | +1      | end-to-end attach/detach against real Prisma                        |
| `apps/api/src/lib/group-scope.test.ts`                         | +9      | flag ON/OFF parity, multi-target, admin god-mode wins               |
| `apps/web/src/components/admin/group-products-editor.test.tsx` | +6      | RTL: loading, checked-mirrors-attached, toggle attach/detach, empty |
| `apps/web/src/components/admin/product-group-chips.test.tsx`   | +3      | RTL: loading, empty, multi-pill render in server order              |
| **Total**                                                      | **+35** |                                                                     |

## Authorization (head-only, like every other admin mutation)

All four new procedures use `adminProcedure` — identical role coverage to `admin.saveProject` and `admin.saveReportingGroup`. Lead and viewer sessions are rejected by the auth middleware before the handler runs. The four contract tests in `admin.contract.test.ts` assert this structurally (procedure node carries the `adminProcedure` middleware chain).

## Deviations from plan

### Auto-fixed issues

1. **[Rule 3 — Blocking] Test helper missing `groupProduct.deleteMany()`**
   - **Found during:** 56-B integration test (`P2021 TableDoesNotExist` initially, then FK RESTRICT race after migration was applied to the test DB).
   - **Issue:** `cleanDatabase()` in `prisma-test-helper.ts` did not wipe `GroupProduct` rows. With RESTRICT FKs on the new table, deleting `Project` and `ReportingGroup` failed for any seeded rows that the new join table referenced.
   - **Fix:** Added `await prisma.groupProduct.deleteMany();` between `stage.deleteMany()` and `project.deleteMany()` in the FK-safe order.
   - **Files modified:** `apps/api/src/test-utils/prisma-test-helper.ts`.
   - **Commit:** Included in 56-B (`2ec34f3`).

2. **[Rule 3 — Blocking] Test/e2e DBs needed the new migration applied**
   - **Found during:** 56-B integration test (`relation "public.GroupProduct" does not exist`).
   - **Issue:** `prisma migrate dev --create-only` against the dev DB initially failed with checksum-drift on an unrelated older migration (`20260510215245_period_model_expansion` had been hand-edited after apply in a previous session). Even after I hand-wrote the migration folder and applied via `migrate deploy` to the dev DB, the `customreport_test` and `customreport_e2e` DBs lacked the new table.
   - **Fix:** Hand-wrote `prisma/migrations/20260511014523_group_product_m2m/migration.sql` matching the 44-01 inline-SQL convention; applied to all three DBs via `DATABASE_URL=… pnpm exec prisma migrate deploy` (deploy skips checksum-drift detection vs `migrate dev`).
   - **Note:** A separate pre-existing checksum drift in `_prisma_migrations` for the period-model migration was NOT touched (refused permission to silently rewrite the audit table; flagged for follow-on cleanup).
   - **Files modified:** none in app code — migration folder + apply commands only.
   - **Commit:** 56-A (`3527233`).

3. **[Rule 1 — Race avoidance] UFB tag collision with parallel agent**
   - **Found during:** mid-execution `git log` after 56-A commit.
   - **Issue:** Phase 52 telemetry agent was tagging all of its commits `UFB-054`, the same tag this phase claimed. Not a code-level collision — both phases share the same UFB tag in commit subjects.
   - **Fix:** None applied. Plan label (`(56-A)`, `(56-B)`, etc.) disambiguates in commit subjects; no audit-log conflict. Flagged here so retro can pick a unique tag for the next phase if needed.

4. **[Process — Cross-agent commit sweep] Router edits absorbed into 4fe2d56**
   - **Found during:** 56-B staging review.
   - **Issue:** After a `git stash`/`git stash pop` to do a baseline tsc run, the parallel agent's next commit (`4fe2d56`, telemetry router edits) swept up my staged-but-uncommitted router additions for `admin.attachProductToGroup`/`detachProductFromGroup`/`listGroupProducts`/`listProductGroups`. Functionally identical to what 56-B intended; covered by 56-B's contract tests.
   - **Fix:** Documented in 2ec34f3's commit body. No revert/re-commit needed.

### None expected — out of scope (deferred)

- **Scope-filter consumer migration to opt-in mode.** The `useExplicitGroupProducts` flag is wired (56-D) but no call site uses it yet. Head-dashboard product list is the obvious first opt-in candidate; deferred behind a feature flag until product / UX signs off on the visibility semantics shift (today: lead's group; tomorrow: any group the product is attached to).
- **Cascade semantics for archived groups.** Today `GroupProduct.group.archived=true` does not cascade or auto-detach; the join row stays. Documented in PLAN as an Open Question; no action.
- **Audit event split.** All four mutations go through `mutationAuditMiddleware` for the generic envelope. No dedicated `admin.group-product.attach` / `.detach` event yet; consistent with `saveProject` (added later only if SIEM needs the split).
- **Vocabulary sweep on copy.** «Group» is used in the new components per UFB-049 (2026-05-11). No retroactive sweep of older «Department» copy in legacy admin pages — out of scope.

## Auth gates

None — fully autonomous flow. All migrations applied non-interactively; no SAML / Keycloak / IdP credentials needed.

## Open questions (forwarded from PLAN, still open)

1. **Authority semantics** — can a non-leader of a product see / edit its data because their group has it attached via GroupProduct? Today scope-filter governs visibility; the opt-in flag in 56-D is the seam to evolve this later behind a feature flag.
2. **Archive-group cascade** — block, cascade, or detach? No answer applied; current behaviour is "orphan-by-design" (archived flag is a UI hint, not a DB constraint).
3. **UI ordering canonical list** — by group or by product? Both surfaces shipped; no canonical chosen.

## What 56-D delivered vs deferred

| Aspect                         | Delivered   | Notes                                                                                                                                                                                                   |
| ------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Optional `options` param       | ✅          | Default OFF preserves bit-for-bit legacy SQL                                                                                                                                                            |
| Project target opt-in path     | ✅          | Returns `{ groupProducts: { some: { groupId: { in } } } }`                                                                                                                                              |
| Other targets (user, section)  | ✅          | Flag intentionally ignored (M:M doesn't apply)                                                                                                                                                          |
| Admin god-mode preserved       | ✅          | Still returns `{}` regardless of flag                                                                                                                                                                   |
| Viewer empty-access guard      | ✅          | Still returns zero-row filter regardless of flag                                                                                                                                                        |
| Unit-test parity OFF vs legacy | ✅          | 9 unit tests cover all role/target combos                                                                                                                                                               |
| **Consumer call-site swap**    | ❌ DEFERRED | No `review` / `archive` / `weekly-report` repository updated. Flag exists as a typed seam; consumers opt in individually behind a feature flag once admin-edited GroupProduct rows exist in production. |

## Threat surface scan

Phase 56 introduces a new admin write surface (attach/detach Group↔Product) but:

- All four procedures gated by `adminProcedure` (head/admin only) — same RBAC envelope as `saveProject` / `saveReportingGroup`.
- Inputs Zod-validated (`groupProductEdgeInputSchema` enforces UUID shape).
- Mutations idempotent — no destructive side effects.
- No new file-access, network egress, or schema constraints relaxed.

No threat flags added.

## Self-Check: PASSED

Verified each created file exists on disk and each commit exists in git:

```
FOUND: prisma/migrations/20260511014523_group_product_m2m/migration.sql
FOUND: apps/web/src/components/admin/group-products-editor.tsx
FOUND: apps/web/src/components/admin/group-products-editor.test.tsx
FOUND: apps/web/src/components/admin/product-group-chips.tsx
FOUND: apps/web/src/components/admin/product-group-chips.test.tsx

FOUND: commit 3527233 (56-A)
FOUND: commit 2ec34f3 (56-B)
FOUND: commit 3b1ab45 (56-D)
FOUND: commit ef3ddbf (56-C)
```
