# Phase 48-A — Organization Identity

**Status:** ready
**Depends on:** 48-C (role consistency must be clean before re-touching admin UI)
**Requirement:** Org-concept on landing + сквозное использование shortName/fullName

## Goal

Introduce an `Organization` singleton: `shortName` (например «Demo»),
`fullName` (например «Example Software Department»). Render the
pair on the landing page hero. Replace the hardcoded «CustomReport»
brand string in nav-bar / page titles / PDF headers with
`organization.shortName`. Migrate `AppSettings.departmentName` →
`Organization.fullName` (one-shot copy; departmentName column dropped
in the next release). Rename the UI vocabulary «Reporting Group» →
«Department» (code path stays `ReportingGroup`; UI labels and column
headers shift). After this plan: a head opens `/`, sees «Demo — Product
Engineering & Operations» in the hero; all nav-bar / PDF / email
shapes inherit the brand from the singleton; admin can edit identity
under Settings → Identity tab.

## Acceptance Criteria

- Prisma model `Organization { id: 'singleton', shortName, fullName,
createdAt, updatedAt }`. Singleton enforced by app-level upsert
  (`where: { id: 'singleton' }`) — not a DB CHECK.
- Migration `<timestamp>_organization_singleton`:
  1. `CREATE TABLE Organization`
  2. `INSERT INTO Organization (id, shortName, fullName)
SELECT 'singleton', COALESCE(/* initials of departmentName */, 'ORG'),
COALESCE(departmentName, 'Organization')
FROM AppSettings WHERE id='singleton'`
  3. (deferred to next release) `ALTER TABLE AppSettings DROP COLUMN
departmentName`.
- New shared zod schema `organizationSchema { id, shortName (≤16 chars),
fullName (≤200), createdAt, updatedAt }`.
- New tRPC procedures under `admin`:
  - `admin.getOrganization` (adminProcedure read)
  - `admin.updateOrganization(input: { shortName, fullName })`
    (adminProcedure write, emits `admin.organization.update` audit event)
- Existing tRPC `auth.me` response gains `organization: { shortName,
fullName }` so every authenticated page has the brand without an
  extra round-trip. `publicProcedure` `org.getPublic()` returns
  `{ shortName, fullName }` so the landing page (anonymous) can fetch
  the brand without authenticating.
- Landing page `/` hero:
  - `org.shortName` rendered with `text-7xl font-bold tracking-tight`
  - `org.fullName` rendered with `text-xl text-muted-foreground` directly
    below, separated by 4-8px
  - Falls back to «CustomReport / Custom Reports» when the public query
    fails (offline / first-boot).
- Nav-bar `apps/web/src/components/navigation/nav-bar.tsx` shows
  `org.shortName` (not the hardcoded «CustomReport»).
- PDF templates (`apps/api/src/modules/pdf-export/*`) and email
  templates use `org.fullName` in the report header / email subject
  prefix.
- Settings tab gains an **Identity** sub-tab as the FIRST tab. Two
  inputs: shortName (16-char counter), fullName (200-char counter).
  Save button calls `admin.updateOrganization`.
- UI vocabulary sweep: «Reporting Group» / «Group» (when referring to
  the org-internal collection of leads) → «Department / Департамент».
  Files: `groups-tab.tsx` label, columns, dialog titles; `users-tab.tsx`
  «Group» column header; `weekly-report-page.tsx` department label
  source (already uses departmentName — rewires to fullName).
  Anywhere a literal «Reporting Group» / «Group» / «Группа» string is
  used as a header / label / button text → «Department / Департамент».
  Code identifiers stay `ReportingGroup` / `reportingGroupId` — NO
  rename of types / columns / variables.

## Steps

1. Schema additions in `prisma/schema.prisma`:

   ```prisma
   model Organization {
     id        String   @id @default("singleton")
     shortName String
     fullName  String
     createdAt DateTime @default(now())
     updatedAt DateTime @updatedAt
   }
   ```

2. Generate migration:

   ```bash
   pnpm exec prisma migrate dev --name organization_singleton --create-only
   ```

3. Hand-edit the migration to append the seed-from-AppSettings INSERT:

   ```sql
   INSERT INTO "Organization" (id, "shortName", "fullName", "createdAt", "updatedAt")
   SELECT
     'singleton',
     -- shortName from initials: split fullName on spaces, take first letter
     -- of each token (up to 5), uppercase; fallback 'ORG'
     COALESCE(
       NULLIF(
         (SELECT string_agg(UPPER(LEFT(word, 1)), '')
          FROM regexp_split_to_table(s."departmentName", '\s+') AS word LIMIT 5),
         ''
       ),
       'ORG'
     ),
     COALESCE(s."departmentName", 'Organization'),
     NOW(),
     NOW()
   FROM "AppSettings" s
   WHERE s.id = 'singleton';
   ```

   (Drop `departmentName` column NOT in this migration — that's a
   follow-up after web is fully migrated to read from Organization.)

4. Apply: `pnpm exec prisma migrate dev` + `pnpm exec prisma generate`.

5. Shared schema (`packages/shared/src/schemas/`):
   - Add `organization.ts` exporting `organizationSchema` + `Organization`
     type.
   - Wire export in `index.ts`.

6. Backend service:
   - New module `apps/api/src/modules/organization/`:
     - `organization.service.ts` with `getOrganization()`,
       `updateOrganization(input)` (emits audit `admin.organization.update`).
     - `organization.prisma-repository.ts` with upsert by `id='singleton'`.
   - Wire into `AppModule`.

7. tRPC router (`apps/api/src/infrastructure/trpc/trpc.router.ts`):
   - Under `admin: router({...})` add `getOrganization` + `updateOrganization`.
   - At top level add `org: router({ getPublic: publicProcedure.query(...) })`
     returning `{ shortName, fullName }`.
   - Extend `auth.me` response (in `auth.controller.ts` /
     `trpc.context.ts`) so the session object's serialised shape includes
     `organization: { shortName, fullName }`. Update
     `packages/shared/src/schemas/auth.ts` userSessionSchema accordingly.

8. Web — landing hero (`apps/web/src/app/page.tsx`):
   - Replace the «CustomReport» hardcoded affordance.
   - Use `useQuery(trpc.org.getPublic.queryOptions())` for the public
     fetch (anonymous-safe).
   - Render shortName + fullName as described.

9. Web — nav-bar (`apps/web/src/components/navigation/nav-bar.tsx`):
   - Brand link's text content: `org.shortName` (from `auth.me`'s
     `organization` field for authenticated routes; fall back to a
     skeleton on first paint).

10. Web — Settings → Identity tab:
    - Restructure `apps/web/src/components/admin/settings-tab.tsx` to
      use tabs (shadcn/ui `<Tabs>`). Tabs:
      - **Identity** (this plan; shortName + fullName)
      - **Periods** (this plan: shows the existing departmentName
        deprecation banner + autoCreatePeriods + defaultDeadlineDays;
        48-B expands this)
      - **Reminders** (48-B)
      - **Notifications** (48-B)
    - Identity form: two inputs + Save → calls
      `admin.updateOrganization.mutation`.

11. Web — PDF / email shape sweep:
    - `apps/api/src/modules/pdf-export/pdf-template-renderer.ts` (or
      wherever the PDF template lives) — read `org.fullName` from the
      data envelope.
    - Email templates: same.

12. UI vocabulary sweep — RU labels:
    - `groups-tab.tsx`: dialog title «Reporting Groups» → «Департаменты»,
      column header «Group name» → «Название департамента», button
      «Add Group» → «Добавить департамент».
    - `users-tab.tsx`: column «Group» → «Департамент».
    - `weekly-report-page.tsx`: «Department: X» label remains but `X`
      is now `org.fullName`, not the old `departmentName`.

13. Tests:
    - `organization.service.test.ts`: get / update / audit emit.
    - `organization.contract.test.ts`: zod parse cases (shortName
      length bounds, fullName length bounds).
    - Web: `settings-tab.test.tsx` extended to cover Identity tab
      form submit.
    - Landing test (if there is one for `/`): assert shortName + fullName
      render from `org.getPublic` query.

14. Manual UAT:
    - Reset dev DB: `pnpm db:reset:hard`. Confirm seed populates
      Organization with shortName='ORG' or initials, fullName='Organization'
      (defaults; admin can override).
    - Optionally override via UI: open `/admin?tab=settings&sub=identity`,
      set shortName='Demo', fullName='Example Software Department',
      Save. Refresh `/` — hero shows Demo / Example Software Department.

## Verification Commands

```bash
docker exec customreport-postgres-1 psql -U customreport -d customreport \
  -c "SELECT id, \"shortName\", \"fullName\" FROM \"Organization\";"
# expected: singleton row

curl -s http://localhost:3002/trpc/org.getPublic | head -3
# expected: JSON with shortName, fullName

pnpm --filter @customreport/api lint && pnpm --filter @customreport/api test
pnpm --filter @customreport/web lint && pnpm --filter @customreport/web test
```

## Commit

`feat(api,web): UFB-047 — Organization identity (singleton) + landing hero + nav rebrand (48-A)`

Body mentions:

- Organization singleton model + migration + seed-from-departmentName
- org.getPublic + admin.updateOrganization tRPC procedures
- Landing page hero rendered with org.shortName + fullName
- Nav-bar brand string sourced from Organization
- Settings → Identity tab introduced; tabbed Settings layout
- UI vocabulary: «Reporting Group» → «Department» (code identifiers untouched)
- AppSettings.departmentName deprecation banner; column drop deferred
- Co-Authored-By: Claude Opus 4.7 (1M context)
