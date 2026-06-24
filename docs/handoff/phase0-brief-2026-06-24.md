# Phase-0 Implementation Brief — two approved changes (2026-06-24)

**Status:** plans verified against current code; **NOT implemented**. Demo-safe —
no `migrate reset` was run. Branch: `feat/user-record-and-viewer-parity`.

Produced by a read-only 6-agent verification sweep. This file records ONLY the
**delta** to the two change plans: confirmed anchors, corrections, missed call
sites, unresolved contradictions, and sequencing. Read it **alongside** each
change's `proposal.md` / `design.md` / `tasks.md` — it does not replace them.

- A = `add-structured-user-name` (split `User.name` into ФИО parts + position + SAML create-only)
- B = `viewer-report-surface-parity` (published-scoped viewer search + `/reports/latest` + read-only viewer report shell)

---

## RESOLVED 2026-06-24 — both Change B contradictions (baked into design.md + tasks.md)

### 1. Published column → `Report.periodStatus = 'published'`

- The viewer content-read gate is exactly `weekly-report.service.ts:130`
  (`periodStatus !== 'published'` → NOT_FOUND); the snapshot is also selected on
  `periodStatus === 'published'` (`weekly-report.prisma-repository.ts:147`).
- Publish writes `status`+`periodStatus`+`periodState` atomically
  (`publication.service.ts:250-253`), but on **reopen** `periodStatus → 'reopened'`
  while `status` may stay `'published'`. So `status` is the **list** column
  (`compiledHistory`), not the content gate — using it would leak reopened content.
  `periodState` is the archive lifecycle, never the publish gate.
- Search must match the **read** path → `periodStatus`. Add
  `INNER JOIN "Report" ON rs."reportId"` + `periodStatus='published'` to the
  item/risk/decision chunks (this is the real leak fix — search has no publish
  predicate today).

### 2. Group join → KEEP `author.reportingGroupId` (do NOT switch to GroupProduct)

- The handoff's "highest-risk" GroupProduct instruction was a misread.
- Viewer hits = item/risk/decision (project excluded). All three are gated by
  `sectionGroupFilter` = section `author.reportingGroupId`
  (`search.prisma-repository.ts:142/167/187`).
- The report read gates the **same** content the same way: sections filtered by
  `author.reportingGroupId` (`weekly-report.prisma-repository.ts:94`); items/risks/
  decisions render inside those sections. GroupProduct governs only the **product
  portfolio** axis (repo:86-88), and product hits are excluded for the viewer.
- So the existing author-group join **already** matches report visibility;
  switching to GroupProduct would make search **diverge** (hide items the viewer
  can see). KEEP `sectionGroupFilter` unchanged. Task 1.3 rewritten accordingly.

> Pre-existing, out of scope: on reopen, `/reports` list (`status`) and the
> content read (`periodStatus`) can disagree — flagged in design Open Questions.

---

## Change A — corrections to `tasks.md`

1. **`auth.me (:265)` anchor is MISLABELED.** Real tRPC `auth.me` =
   `trpc.router.ts:157` (returns `ctx.session`, verify-only). The edit site is
   `buildUserSession`'s `UserSession` return (`auth.routes.ts:263-276`) + the
   `UserSession` TYPE.
2. **MISSING PREREQUISITE: extend `userSessionSchema`**
   (`packages/shared/src/schemas/auth.ts:23-83`). `signSession` /
   `verifySessionToken` (`auth.controller.ts:27,37`) run `.parse`, and Zod
   **strips unknown keys** → name parts silently dropped with a green typecheck.
   Make the new fields **optional** so `DEV_SESSION` (`trpc.context.ts:18`) and
   `buildLegacyPdfExportSession` (`trpc.context.ts:112`) don't break.
3. **dev-login is NOT unaffected (contra §5.3).** It shares `buildUserSession`
   (the create-only change reaches it) and passes role via a SamlProfile-shaped
   object. Keep `role` on the local `SamlProfile` interface
   (`auth.routes.ts:21-26`) and `VerifiedSamlProfile`; remove `role` **only** from
   the SAML assertion source (`saml-profile.ts` schema + the prod parse branch).
4. **`verifySamlProfile` has TWO role paths** (`saml.strategy.ts:113-119`
   non-schema + `:122-142` schema) + the `VerifiedSamlProfile` type (`:18`).
   Change all together or a role-less Keycloak assertion still fails closed
   (defeating Decision 5).
5. **Create-only must gate the reportingGroup fallback block**
   (`auth.routes.ts:186-211`), not just the `data:` line — that block is the real
   mutator of an existing user's group.
6. **Initials bug is duplicated in SIX places**; plan touches only 2
   (`nav-bar.tsx:141`, `stage-assignment-editor.tsx:188`). Others keep the bug:
   `lead-form.ts:245`, `dashboard.ts:112`, `weekly-report-groupers.ts:23`,
   `activity-live-panel.tsx:224` (web), `lead-form.prisma-repository.ts:347`
   (API). **Decide** consolidate-all vs scoped, and record it.
7. **Second `MockUser` at `admin-types.ts:19`** (not just `mock-data.ts:10`) —
   update BOTH or the admin table shows no Position.
8. **Seed names are GIVEN-name-first abbreviations** (`'Антон К.'`), NOT
   surname-first full ФИО. §9 is a **hand rebuild/reorder**, not a mechanical
   split. Tests pin these literal strings — grep before reseed.
9. **`department` already exists on `MockUser`** and overlaps the new `position`
   — reconcile coexist-vs-replace before adding.
10. **Shared helpers (§3): NO existing shared helper module.** Create a new file
    under `packages/shared/src` + export via `index.ts`. `format-date.ts` lives in
    `apps/web`, not reusable.
11. **API query paths:** files are under `apps/api/src/modules/admin/`, not
    `infrastructure/persistence/`.

---

## Change B — corrections to `tasks.md`

1. **`search.service.ts` is NOT in B's file list but MUST change:** scope type
   (`:26`), authorize `'published'` for viewer (the if-guard `:92-100`), viewer
   `excludeTypes` +`'project'` (`:129-130`), and the `scopeAccessed` emit.
2. **`scopeAccessed` parity (task 1.6) is under-scoped.**
   `SearchRepository.search` returns `SearchHit[]` with no audit channel; `RawHit`
   lacks the owner's `reportingGroupId`; `computeCrossGroupSignal` needs per-project
   `lead.reportingGroupId`. Either widen the repo return shape or confirm a reduced
   event. Flag before implementing 1.6.
3. **`search-input.tsx` is role-agnostic today** (`targetUrlFor(hit)`, no
   session). Task 4.2 needs `useSession` threaded through both call sites
   (`:170`, `:246`).
4. **Scope widening must hit all 5 sites in lockstep:** shared enum
   (`search.ts:59`), repo sig (`search.prisma-repository.ts:52`), service type
   (`search.service.ts:26`), web `Scope` type (`search-input.tsx:32`), in-memory
   fake (`search.service.test.ts:48`). A 3rd web caller (`products-tab.tsx`,
   `scope='all'`) must stay type-exhaustive.
5. **latest-published resolver: REUSE `compiledHistory`'s exact predicate**
   (`status:'published'` + `sections.some(groupScopeFilter 'reportSection')` +
   non-empty sections, `orderBy periodStart desc`, take first) via
   `leadershipProcedure` / `viewerProcedure`. Don't hand-roll a new where-clause.
6. **Viewer shell is net-new** (no existing component). Mirror `HeadReportShell`
   primitives (`ReportToolbar`/`ScopeToggle`/`ViewModeToggle`/`ExportPdfButton`/
   `SlidesClient`) but OMIT `HeadPublishLockAction`. Preserve the
   `reports/[reportId]` `contextControlsLeading` slot (Back-to-Archive +
   AgentReviewComingSoon).
7. **`?mode=slides` is genuinely inert for viewer** (page never reads `mode`;
   `WeeklyReportPage` has no `mode` prop) — a shell is required, not a flag.
8. **`redirect()` (307)** for `/reports/latest` (dynamic target);
   `permanentRedirect` (308) stays for the static present→slides rewrite.

---

## Sequencing (A then B, serial, on the branch)

- **Only shared production file: `nav-bar.tsx`** (+ `nav-bar.test.tsx`). Edits are
  line-disjoint — A: `initialsFromName` `139-148` + call site `227`; B:
  `NAV_LINKS` `60-65` + `NavIcon` switch `194-212` + `isActiveLink` `107-119`.
  Trivial rebase, but **B must re-read `nav-bar` after A** and include
  `lastName/firstName` in its test mock (use the `setRole` helper A widens), or it
  type-errors against the new required session fields.
- **`packages/shared`:** A → `report.schema.ts` + `saml-profile.ts` + new helper
  module; B → `schemas/search.ts`. No export collision (only a theoretical
  same-line `index.ts` EOF append).
- **Gates:** run `npx prisma generate` before EACH gate run (prisma-client-wipe
  flake). A's gate is heavier (schema + `migrate reset` + reseed); B is additive,
  no schema change. Web tests: `cd apps/web && pnpm exec vitest` (`rtk vitest`
  mis-parses TSX → 0 tests).
- **⚠ `migrate reset` (A, task 1.2) hits the shared Postgres** — do not run it
  while a demo depends on the DB. The branch isolates code, not the database.

---

## Confirmed (plan matches current code) — trust these

- **A:** `User` has no FTS / `searchTsv`; single init migration
  `20260530162224_init`; `adminUserSchema:89` / `AdminUser:378`; admin-snapshot
  write/read sites as cited; a seeded `admin` survives reseed (viewer-default
  cannot lock out admin); dev-login reads role from `req.query` and never imports
  `SamlProfileSchema`.
- **B:** `leadershipProcedure` (`trpc.middleware.ts:518`) + `viewerProcedure`
  (`:510`) exist; `compiledHistory` (`router:436-547`) is the reuse template; the
  search leak path is exactly `search.prisma-repository.ts:91,95`; the
  `/reports/latest` route dir does not exist yet.
