---
phase: 56
plan: full
type: full-phase
name: group-products-model
ufb: UFB-054
requirements: []
objective: Make Group ↔ Products an explicit many-to-many edge with admin UI, without breaking existing read paths that derive group from `Project.lead.reportingGroupId`.
autonomous: true
---

# Phase 56 — Group ↔ Products M:M model

## Context

@.planning/phases/56-group-products-model/56-CONTEXT.md

Today products belong to a group implicitly through `Project.lead.reportingGroupId`.
This breaks when leads rotate and is unrepresentable for cross-departmental products.
The user picked **Option A** (2026-05-11): explicit M:M join + admin UI.

## Constraints (HARD)

- **Additive schema only.** Never drop columns. `Project.leadId` stays untouched.
- **Backfill idempotent** via `ON CONFLICT DO NOTHING`.
- **Existing scope-filter read sites stay as-is.** Phase 46's
  `groupScopeFilter(session, 'project')` keeps deriving from `Project.lead.reportingGroupId`
  by default. Plan 56-D adds an OPT-IN flag — default OFF.
- **Vocabulary:** «Group» (UFB-049 / 2026-05-11).
- Migration lock owned by this phase tonight (Phase 52 telemetry agent does not touch schema).

## Plans

### 56-A — Schema + backfill migration

Add `GroupProduct` model with inverse relations on `ReportingGroup` and `Project`.

```prisma
model GroupProduct {
  id        String         @id @default(uuid())
  groupId   String
  productId String
  createdAt DateTime       @default(now())
  group     ReportingGroup @relation(fields: [groupId], references: [id])
  product   Project        @relation(fields: [productId], references: [id])
  @@unique([groupId, productId])
  @@index([groupId])
  @@index([productId])
}
```

Inverse relations:

- `ReportingGroup.groupProducts GroupProduct[]`
- `Project.groupProducts GroupProduct[]`

Migration flow (matches the 44-01 / 51-C convention — single inline migration.sql with CreateTable + backfill SQL appended):

1. Edit `prisma/schema.prisma` with the three additions.
2. `docker exec customreport-api-1 sh -c "cd /app && pnpm exec prisma migrate dev --create-only --name group_product_m2m"` — generates the timestamped folder.
3. Append backfill SQL to the generated migration.sql:

   ```sql
   INSERT INTO "GroupProduct" (id, "groupId", "productId", "createdAt")
   SELECT gen_random_uuid(), u."reportingGroupId", p.id, NOW()
   FROM "Project" p
   JOIN "User" u ON u.id = p."leadId"
   WHERE u."reportingGroupId" IS NOT NULL
   ON CONFLICT ("groupId", "productId") DO NOTHING;
   ```

4. `docker exec customreport-api-1 sh -c "cd /app && pnpm exec prisma migrate dev"` — applies. Then `pnpm exec prisma generate` and `docker compose restart api`.
5. Verify backfill row count.

**Acceptance:**

- Migration applied; `GroupProduct` table exists.
- Backfill count == count of Projects whose lead has a reportingGroupId (User.reportingGroupId is non-nullable in schema, so this equals total Project count).
- `prisma generate` succeeds; api container healthy.
- Integration test: re-running backfill is idempotent (count stays equal).

### 56-B — tRPC admin mutations

Add four procedures under the existing `admin` namespace in `trpc.router.ts`:

- `admin.attachProductToGroup({ groupId, productId })` — creates GroupProduct row idempotently (upsert on the unique tuple).
- `admin.detachProductFromGroup({ groupId, productId })` — deletes the row; no-op when absent.
- `admin.listGroupProducts({ groupId })` — returns Projects attached to the group.
- `admin.listProductGroups({ productId })` — returns ReportingGroups owning the product.

Authz: reuse `adminProcedure` (head-only access guard, same as existing admin mutations).

Service & repository:

- Extend `AdminRepository` interface with the four methods (optional? **non-optional** for the prisma repo, optional on the in-memory test repos to keep them compiling — match the existing `listReminderPolicies?(): Promise<...>` pattern).
- New repo methods in `admin.prisma-repository.ts`.
- New service methods in `admin.service.ts` with Zod parsing.
- Shared schemas in `packages/shared/src/schemas/report.ts`:
  - `groupProductSchema = { id, groupId, productId, createdAt }`
  - input schemas for attach/detach: `{ groupId: uuid, productId: uuid }`.

**Acceptance:**

- Contract tests for the 4 procedures (round-trip + authz negative — lead/viewer rejected).
- Integration test attaches & detaches idempotently against real Prisma.
- All baseline api tests still pass.

### 56-C — Admin UI extensions

Two surfaces (parallel — independent files):

**Groups tab (`groups-tab.tsx`):** when editing a group, show «Products attached» section with checkboxed list of all (non-archived) products. Toggle calls attach/detach mutations and invalidates `admin.listGroupProducts` query.

**Products tab (`products-tab.tsx`):** new «Groups» column rendering a compact chip list per product (read-only display from `admin.listProductGroups` aggregated). For edit, defer — chip removal goes through Groups tab.

Vocabulary: «Group» throughout, not «Department».

**Acceptance:**

- RTL test: render Groups tab edit dialog → assert «Products attached» section appears with the product list.
- RTL test: render Products tab → assert «Groups» column renders chips for a project with attached groups.
- Web baseline ≥333 → +2 tests minimum.

**Escape hatch:** If 56-C balloons past 2h, ship only the Products-tab read-only column (cheaper) and defer the Groups-tab editing UI to a follow-on plan. Document deferral in SUMMARY.

### 56-D — Scope-filter consumer migration (opt-in seam)

Extend `apps/api/src/lib/group-scope.ts`:

```ts
export function groupScopeFilter(
  session: UserSession,
  target: ScopeTarget,
  options?: { useExplicitGroupProducts?: boolean },
): Record<string, unknown>;
```

When `target === 'project'` AND `options.useExplicitGroupProducts === true`:
return `{ groupProducts: { some: { groupId: { in: groupIds } } } }` instead of
`{ lead: { reportingGroupId: { in: groupIds } } }`.

Default OFF (`options` omitted or flag false) — current behaviour preserved bit-for-bit.

**Acceptance:**

- Existing scope-filter unit tests continue to pass unchanged.
- New unit tests: with flag ON, returns the `groupProducts.some.groupId.in` fragment; with flag OFF, returns the legacy `lead.reportingGroupId.in` fragment.
- No call sites updated yet — the seam is documented in SUMMARY so consumers can opt in later (e.g. head dashboard product list via feature flag).

## Verification (end of phase)

| Gate       | Command                                                                                                              | Target                                 |
| ---------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| api tests  | `pnpm --filter @customreport/api test --run`                                                                         | ≥823 (baseline) + new tests            |
| web tests  | `pnpm --filter @customreport/web test --run`                                                                         | ≥333 (baseline) + new tests            |
| api tsc    | `pnpm --filter @customreport/api exec tsc --noEmit`                                                                  | exit 0                                 |
| web tsc    | `pnpm --filter @customreport/web exec tsc --noEmit`                                                                  | exit 0                                 |
| migration  | `docker exec customreport-api-1 sh -c "cd /app && pnpm exec prisma migrate status"`                                  | applied, no drift                      |
| backfill   | `docker exec customreport-postgres-1 psql -U customreport -d customreport -c 'SELECT COUNT(*) FROM "GroupProduct";'` | ≥ Project count where lead has a group |
| api health | `curl -sf http://localhost:3001/health` (or equivalent)                                                              | ok                                     |

## Commit style

`feat(schema|api|web): UFB-054 — short summary (56-X)`. Husky active. Atomic per plan
where possible; complex plans can have 2–3 commits (e.g. schema vs. backfill verification).

## Open questions (documented, not blocking)

- Authority: can a non-leader of a product see/edit data because their group has it attached?
  → Out of scope for 56. Today scope-filter applies; opt-in flag in 56-D is the seam to
  evolve this later behind a feature flag.
- Cascade on group archive: today nothing cascades. GroupProduct rows orphan-by-design
  (group's `archived=true` flag is purely a UI hint). Documented; no cascade FK added.
