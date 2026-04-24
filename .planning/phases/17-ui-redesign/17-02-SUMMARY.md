---
phase: 17-ui-redesign
plan: 02
type: summary
status: completed
---

# Summary: 17-02 — Wave 1: Schema Migration + Login Stub + URL Routing

## Result

All Wave 1 deliverables implemented and committed.

## What Was Built

### Schema Migration (SCH-01..07)
- PeriodStatus enum (open, published, reopened)
- Report: periodStatus, weekLabel, reopenedAt fields
- ReportSection: revokedAt, revokedBy fields
- VersionSnapshot model (autosave history, JSON data, version index)
- Stage model (7 SDLC stages) + StageAssignment (unique userId+stageId+projectId)
- AppSettings singleton (departmentName, autoCreatePeriods, defaultDeadlineDays)
- Migration runs clean, seed populates all new models

### Shared Zod Schemas
- periodStatusSchema, stageSchema, stageAssignmentSchema
- versionSnapshotSchema, appSettingsSchema
- periodReadModelSchema, weeklyReportReadModelSchema
- portfolioProductOverviewSchema, escalationSchema

### Login Page (UI-12, API-13)
- Split-screen: PEO brand gradient left, auth right
- SSO button + 4 dev stub role buttons (lead/head/admin/viewer)
- Uses existing /auth/dev-login route

### Design System (UI-17)
- Starbucks theme: cream canvas (#f2f0eb), teal primary (#006241/#00754A)
- Gold accents (#cba258), house green (#1e3932)
- Lexend + Source Sans 3 fonts via Google Fonts
- Skip-link, btn-press animation, focus rings

### URL Routing Skeleton (UI-14)
- All pages accept searchParams (period, tab)
- max-w-6xl layout on all pages
- id="main-content" targets for skip-link

## Key Files

- `prisma/schema.prisma` — 19 models, 13 enums
- `prisma/seed.ts` — stages, assignments, settings, 2 report periods
- `packages/shared/src/schemas/report.ts` — ~10 new schemas
- `packages/ui/src/styles/globals.css` — Starbucks design tokens
- `apps/web/src/app/page.tsx` — login split-screen
- `apps/web/src/app/layout.tsx` — Lexend fonts, skip-link
- All page routes under `apps/web/src/app/(app)/`

## Commits

- `feat(17): Wave 1 — schema migration, login stub, URL routing, design system`

## Self-Check: PASSED

- ✅ Prisma migration runs clean
- ✅ Seed populates all new models
- ✅ Login page renders with stub buttons
- ✅ Design tokens applied globally
- ✅ All pages accept URL params
- ✅ typecheck passes
- ✅ web build succeeds
