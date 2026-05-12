---
phase: 48
plan: 48-A
subsystem: identity
tags: [organization, branding, settings, vocabulary, ufb-047]
requires: [44-A, 48-C]
provides:
  - Organization singleton model (Prisma)
  - org.getPublic + admin.getOrganization + admin.updateOrganization tRPC procedures
  - session.organization hydrated on auth.me
  - Tabbed Settings layout (Identity / Periods / Reminders / Notifications)
  - admin.organization.update audit event
affects:
  - apps/web/src/app/page.tsx (landing hero)
  - apps/web/src/components/navigation/nav-bar.tsx (brand)
  - apps/web/src/components/weekly-report/weekly-report-page.tsx (department label)
  - apps/web/src/components/admin/* (vocabulary sweep)
  - apps/api/src/modules/email/templates/* (brand footers)
tech-stack:
  added:
    - Organization (Prisma model + singleton invariant)
    - organizationSchema / organizationUpdateSchema / organizationPublicSchema (@customreport/shared)
  patterns:
    - per-request hydration cache (5s TTL) for the org singleton in tRPC context
    - optional zod fields on userSessionSchema to keep older JWTs verifiable
key-files:
  created:
    - prisma/migrations/20260510194118_organization_singleton/migration.sql
    - packages/shared/src/schemas/organization.ts
    - apps/api/src/modules/organization/organization.service.ts
    - apps/api/src/modules/organization/organization.prisma-repository.ts
    - apps/api/src/modules/organization/organization.module.ts
    - apps/api/src/modules/organization/organization.service.test.ts
    - apps/api/src/modules/organization/organization.contract.test.ts
    - apps/web/src/components/admin/settings-tab.test.tsx
  modified:
    - prisma/schema.prisma
    - prisma/seed.ts
    - packages/shared/src/index.ts
    - packages/shared/src/schemas/auth.ts
    - apps/api/src/app.module.ts
    - apps/api/src/main.ts
    - apps/api/src/infrastructure/trpc/trpc.router.ts
    - apps/api/src/infrastructure/trpc/trpc.context.ts
    - apps/api/src/infrastructure/trpc/trpc.context.test.ts
    - apps/api/src/infrastructure/trpc/trpc.context.pdf-export.test.ts
    - apps/api/src/infrastructure/trpc/mutation-audit.test.ts
    - apps/api/src/lib/audit-logger.ts
    - apps/api/src/modules/email/templates/deadline.template.tsx
    - apps/api/src/modules/email/templates/escalation.template.tsx
    - apps/api/src/infrastructure/bullmq/email-reminder.processor.ts
    - apps/web/src/app/page.tsx
    - apps/web/src/app/(app)/admin/page.tsx
    - apps/web/src/components/navigation/nav-bar.tsx
    - apps/web/src/components/navigation/nav-bar.test.tsx
    - apps/web/src/components/admin/settings-tab.tsx
    - apps/web/src/components/admin/groups-tab.tsx
    - apps/web/src/components/admin/users-tab.tsx
    - apps/web/src/components/admin/admin-tabs-mobile-select.tsx
    - apps/web/src/components/lead/lead-form-addressable.test.tsx
    - apps/web/src/components/weekly-report/weekly-report-page.tsx
    - apps/web/src/lib/session-provider.tsx
    - apps/web/src/lib/session-provider.test.tsx
    - apps/web/src/lib/cache-keys.ts
    - apps/web/src/lib/cache-keys.test.ts
decisions:
  - "Organization is a singleton (id='singleton') with app-level invariant — no DB CHECK so future multi-tenant evolution stays open"
  - "auth.me carries session.organization hydrated per-request (NOT baked into JWT) — admin renames propagate within 5s, no JWT invalidation on deploy"
  - "Migration seeds PEO / Product Engineering & Operations idempotently (ON CONFLICT DO NOTHING)"
  - "AppSettings.departmentName kept for one release — Identity tab is the new source of truth, follow-up plan will rewire lead-form/weekly-report and drop the column"
  - "Vocabulary sweep: user-facing 'Group/Groups' → 'Department/Departments'; code identifiers (ReportingGroup model, reportingGroupId FK, groups-tab.tsx filename, data-testid) stay unchanged"
metrics:
  duration: ~85min
  completed: 2026-05-10
---

# Phase 48 Plan A: Organization Identity Summary

One-liner: Singleton `Organization { shortName, fullName }` introduced as
the source of truth for brand strings — landing hero, nav-bar, Settings
Identity tab, email footers, and weekly-report department label all
source from it; vocabulary sweep flips user-facing "Group/Groups" to
"Department/Departments" with zero code-identifier churn.

## What landed

- **Schema + migration** — `Organization` model with `id='singleton'`
  default, three string columns, both timestamps. Migration seeds PEO /
  Product Engineering & Operations via idempotent `INSERT ... ON CONFLICT
DO NOTHING`. `AppSettings.departmentName` is intentionally left in place
  (advisor recommendation: avoid migrating downstream consumers in the
  same commit; deferred to a follow-up).
- **Shared schema** — `organizationSchema` (full row, ≤16 char shortName,
  ≤200 char fullName), `organizationUpdateSchema` (write input — id is
  implicit), `organizationPublicSchema` (anonymous projection). Added
  optional `organization?: { shortName, fullName }` to `userSessionSchema`
  so older JWTs verify cleanly.
- **API module** — `OrganizationModule` with service + Prisma repository.
  Service does zod-validation on every read/write so the wire shape can
  never drift.
- **tRPC procedures** —
  - `org.getPublic` (publicProcedure) for the anonymous landing hero.
  - `admin.getOrganization` (adminProcedure) for the Settings → Identity
    tab.
  - `admin.updateOrganization` (adminProcedure) emits the new
    `admin.organization.update` audit event with both previous and next
    short/full names.
- **Context hydration** — `trpc.context.ts` now hydrates
  `session.organization` from the singleton on every authenticated
  request. Cached for 5s in a module-level TTL cache so admin renames
  propagate within ~5s without hammering Postgres on the hot path.
- **Web** —
  - Landing hero `/` reads `org.getPublic`; falls back to seeded PEO on
    query failure (offline / first-boot).
  - Nav-bar reads `session.organization.shortName` (falls back to 'PEO').
  - Settings tab restructured to shadcn `<Tabs>` with **Identity** as the
    first tab, then **Periods** (existing departmentName + flags wrapped
    in a deprecation banner), then **Reminders** + **Notifications**
    placeholders for Phase 48-B.
  - Weekly-report page sources `departmentLabel` from
    `session.organization.fullName` with fallback to the legacy
    `weeklyReport.get.departmentName` for PDF-worker synthetic sessions.
- **Email templates** — `PEO — Weekly status reporting for Product
Engineering & Operations` replaces the hardcoded `CustomReport — …
for CoreDev` footer in both deadline + escalation templates and the
  legacy follow-up plaintext body. Dynamic plumbing of the org row
  through the BullMQ payload is deferred to Phase 48-B.
- **Vocabulary sweep** — user-facing labels in `groups-tab.tsx`,
  `users-tab.tsx`, `admin-tabs-mobile-select.tsx`, `(app)/admin/page.tsx`
  flipped from "Group/Groups" to "Department/Departments". Code
  identifiers (`ReportingGroup`, `reportingGroupId`, file names,
  `data-testid="groups-tab"`, route key `tab=groups`) all unchanged.

## Settings UI — tab layout

```
┌─ Settings ────────────────────────────────────────────┐
│ [Identity*] [Periods] [Reminders] [Notifications]      │
│                                                        │
│ Identity (default):                                    │
│   Short name [PEO_____________]  3/16                  │
│   Full name  [Product Engineering & Operations]  32/200│
│   [ Save Identity ]                                    │
│                                                        │
│ Periods:                                               │
│   ⚠ Department name is being deprecated.               │
│   Report header name (legacy) [Core Development]     │
│   ☐ Auto-create periods                                │
│   Default deadline days [5]                            │
│                                                        │
│ Reminders / Notifications:                             │
│   "Coming in next release" placeholder                 │
└────────────────────────────────────────────────────────┘
```

## Migration

`prisma/migrations/20260510194118_organization_singleton/migration.sql`

```sql
CREATE TABLE "Organization" (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  "shortName" TEXT NOT NULL,
  "fullName"  TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

INSERT INTO "Organization" (id, "shortName", "fullName", "createdAt", "updatedAt")
VALUES ('singleton', 'PEO', 'Product Engineering & Operations', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
```

DB verified after `prisma migrate dev`:

```
    id     | shortName |             fullName
-----------+-----------+----------------------------------
 singleton | PEO       | Product Engineering & Operations
```

## Test counts

| Surface             | Before | After | Delta                                              |
| ------------------- | ------ | ----- | -------------------------------------------------- |
| `@customreport/api` | 714    | 729   | +15 (organization.service + organization.contract) |
| `@customreport/web` | 306    | 311   | +5 (settings-tab + session-provider org hydration) |

All 729 + 311 = 1040 tests green; api and web lint clean (TypeScript strict

- ESLint).

## Manual UAT smoke

1. `docker compose restart api web` after `prisma migrate dev` + `prisma generate`.
2. `curl -s http://localhost:3002/trpc/org.getPublic` →
   `{"result":{"data":{"json":{"shortName":"PEO","fullName":"Product Engineering & Operations"}}}}`
3. `curl -s http://localhost:3000/` → HTML contains `PEO` and `Product Engineering` (no `CustomReport`).
4. DB row verified — single `Organization` row with seeded identity.

## Deviations from plan

### Auto-applied (Rule 3 — fixed blocking issues)

1. **[Rule 3 — Test fixtures] Extended Prisma stubs in trpc.context tests**
   - **Found during:** API test run after adding `hydrateOrganization` to the context.
   - **Issue:** `trpc.context.test.ts` and `trpc.context.pdf-export.test.ts`
     used `makePrismaStub()` that only exposed `reportSection.findFirst`;
     the new hydrator calls `prisma.organization.upsert`.
   - **Fix:** Added `organization: { upsert: vi.fn(...) }` to both stubs
     returning the seeded defaults. Documented why in inline comments.
   - **Commit:** part of this plan.

2. **[Rule 3 — Test fixtures] Updated mutation-audit test for new AuditLogger member**
   - **Found during:** API lint after extending the `AuditLogger` interface.
   - **Issue:** `mutation-audit.test.ts` constructed a hand-rolled
     `AuditLogger` mock; missing the new `organizationUpdate` member.
   - **Fix:** Added `organizationUpdate: vi.fn()`.

3. **[Rule 3 — Test fixtures] SessionState fixture additions**
   - **Found during:** Web lint.
   - **Issue:** `SessionState` gained a required `organization: SessionOrganization | null`
     field; three test fixtures (`nav-bar.test.tsx`,
     `lead-form-addressable.test.tsx`, `session-provider.test.tsx`)
     constructed `SessionState` directly and broke.
   - **Fix:** Added `organization: null` (or realistic PEO value where
     the test benefits from it) to each fixture. Added one new positive
     test asserting org hydration on `auth.me`.

4. **[Rule 3 — Cache invalidation test] Extended cache-keys test stub**
   - **Found during:** Web test run.
   - **Issue:** `invalidateAdmin` now flushes `admin.getOrganization`,
     `org.getPublic`, and `auth.me` caches; the test stub lacked these
     surfaces.
   - **Fix:** Added the missing stubs and asserted the new tags in the
     `invalidateAdmin` test.

### Deferred (not in this plan's scope)

- **Email template org plumbing.** Plan called for PDF/email templates to
  source `org.fullName` dynamically. The email templates are rendered
  inside the BullMQ worker which has no session/org context — threading
  the org row through the job payload + scheduler is a larger refactor
  than this plan's atomic-commit envelope justifies. Templates now carry
  the static seeded identity (`PEO — … for Product Engineering &
Operations`); dynamic plumbing is on Phase 48-B's plate.
- **PDF generation.** The PDF worker loads `/head/report` via Playwright
  and prints. The weekly-report page header now reads
  `session.organization.fullName`, but the PDF synthetic session has no
  org context — it still falls back to `weeklyReport.get.departmentName`
  in that path. A follow-up will plumb the org row into the PDF JWT or
  provide the synthetic session with a hydrated org.
- **`AppSettings.departmentName` column drop.** Plan called this out as
  deferred; explicitly left in place. The Periods sub-tab shows a
  deprecation banner.

### Scope add (Rule 2 — missing critical functionality)

- **`admin.organization.update` audit event** — not strictly required by
  the plan text, but the existing audit pattern (`admin.policy.save`,
  `admin.policy.remove`) treats every brand-tampering surface as
  audit-worthy. Adding the dedicated event lets SIEM rules filter
  brand-rename attempts without parsing the procedure string.

## Known Stubs

- `Reminders` + `Notifications` settings tabs render a "Coming in next
  release" placeholder. Intentional — Phase 48-B will fill them.
- Email templates carry the static seeded identity in the brand footer
  rather than reading from Organization. Documented as a deferred
  follow-up above.

## Self-Check: PASSED

Files verified:

- `prisma/migrations/20260510194118_organization_singleton/migration.sql`: FOUND
- `packages/shared/src/schemas/organization.ts`: FOUND
- `apps/api/src/modules/organization/organization.service.ts`: FOUND
- `apps/api/src/modules/organization/organization.prisma-repository.ts`: FOUND
- `apps/api/src/modules/organization/organization.module.ts`: FOUND
- `apps/api/src/modules/organization/organization.service.test.ts`: FOUND
- `apps/api/src/modules/organization/organization.contract.test.ts`: FOUND
- `apps/web/src/components/admin/settings-tab.test.tsx`: FOUND

DB row verified: `singleton | PEO | Product Engineering & Operations`.
Public endpoint verified: `org.getPublic` returns the seeded pair.
Landing HTML verified: contains `PEO` and `Product Engineering` strings.
