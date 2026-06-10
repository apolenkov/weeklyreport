# Tasks — Remove Dead Modules

NOT STARTED — captured 2026-06-10. Evidence anchors: `proposal.md`.

**Execution note (standing):** Sequential single-writer edits only;
parallel agents only for read-only analysis (repo lesson: parallel
mechanical edits pass gates but break behavior).

**Staging discipline:** a parallel session keeps a dirty working tree
in `apps/web`. Stage only the paths listed per task; never
`git add -A`. Re-run `git status` immediately before every commit.

## 1. shared — delete dead `requireRole`

- [ ] 1.1 `packages/shared/src/trpc/middleware/role.ts`: delete the
      `requireRole` function (lines 63-94) and the now-orphaned
      `TRPCMiddlewareBuilder` / `TRPCMiddlewareFunction` type imports
      (lines 1-4); repoint the JSDoc mention of `requireRole` at line
      17 to `buildRoleMiddleware` (api) / `assertRole`. Keep
      `assertRole` byte-identical.
      `packages/shared/src/trpc/index.ts:1`: drop `requireRole` from
      the export, keep `assertRole`.
      `packages/shared/src/trpc/middleware/role.test.ts`: retitle
      `describe("assertRole (requireRole core)")` (line 31) to
      `describe("assertRole")`; rewrite the header comment (line 9)
      that names `requireRole`. All 9 existing assertions stay green
      unchanged.
      `packages/shared/src/schemas/auth.ts`: comment-only — repoint
      the two stale JSDoc mentions of "the requireRole middleware
      factory" (lines 17 and 76) to `buildRoleMiddleware`/`assertRole`.
      Commit: `chore(shared): remove dead requireRole adapter, keep assertRole`.

## 2. ui — delete dead composition components and orphan tokens

- [ ] 2.1 Delete 7 files:
      `packages/ui/src/components/data-table.tsx`,
      `packages/ui/src/components/data-table.test.tsx`,
      `packages/ui/src/components/__snapshots__/data-table.test.tsx.snap`,
      `packages/ui/src/components/crud-sheet.tsx`,
      `packages/ui/src/components/confirm-dialog.tsx`,
      `packages/ui/src/components/traffic-light-badge.tsx`,
      `packages/ui/src/styles/traffic-lights.css`.
      In `packages/ui/src/index.ts` remove exactly the
      `ConfirmDialog` (L4), `CrudSheet` (L5), `type Column` (L6),
      `DataTable` (L8), `TrafficLightBadge` + `TrafficLightStatus`
      (L9-12) export lines and the now-empty
      `// Composition Components` comment (L7); leave `ComingSoonBadge`
      (L3) and everything else byte-identical
      (deferred-feature-pattern mandate).
      In `packages/ui/README.md` drop `ConfirmDialog` from the
      primitives line (L11) and the three composition rows
      `DataTable`/`CrudSheet`/`TrafficLightBadge` (L15-17); remove the
      `### Custom Compositions` heading if it ends up empty.
      Do NOT touch `coming-soon-badge.tsx` or the
      `data-testid="crud-sheet"` strings in admin tabs (app-local,
      decoupled). Commit:
      `refactor(ui): remove dead composition components and orphan traffic tokens`.

## 3. api — manual-publish telemetry + dead pass-through routers

- [ ] 3.1 Test-first: in
      `apps/api/src/modules/period/period.service.test.ts` add unit
      tests pinning that `publishPeriod` increments
      `customreportReportsSubmittedTotal` (`{ state: "published" }`)
      and `customreportPeriodStateTransitionsTotal`
      (`{ from: <prior periodStatus>, to: "published" }`) exactly once
      after `repository.publishPeriod` succeeds, and increments
      NOTHING when the repository write throws. `from`-label decision:
      emit the actual prior `report.periodStatus` (`"open"` or
      `"reopened"`), unlike `publishReport`/`publishAuto` which
      hardcode `from: "open"` — cover both cases. Tests must FAIL
      against the unmodified service. Commit:
      `test(api): pin manual-publish telemetry contract`.
- [ ] 3.2 In `apps/api/src/modules/period/period.service.ts`
      `publishPeriod` (lines 89-121): after
      `await this.repository.publishPeriod(...)` succeeds, increment
      both counters, mirroring the "emit only after the write
      succeeds" discipline documented at
      `apps/api/src/modules/publication/publication.service.ts:205-207`.
      Read `report.periodStatus` (already fetched at the top of the
      method) for the `from` label. Tests from 3.1 turn green. Commit:
      `fix(api): emit publish telemetry on the live manual-publish path`.
- [ ] 3.3 Delete 3 dead router files:
      `apps/api/src/modules/publication/publication.router.ts`,
      `apps/api/src/modules/archive/archive.router.ts`,
      `apps/api/src/modules/report-sections/report-sections.router.ts`
      (zero importers — no test edits for it).
      In `apps/api/src/modules/publication/publication.service.test.ts`
      remove the `publicationRouter` import (L12), the router-based
      test `"rejects non-head access before returning assembled report
data"` (~L208-217 — sits INSIDE the `PublicationService`
      describe; the dossier listed only the dedicated block), and the
      whole `describe("publicationRouter")` block (L323-EOF).
      In `apps/api/src/modules/archive/archive.service.test.ts` remove
      the `archiveRouter` import (L7) and the
      `describe("archiveRouter")` block (L94 up to the
      `describe("AUTH-04 viewer scoping")` at L121, which stays
      intact). Commit:
      `refactor(api): remove dead pass-through routers and their test blocks`.

## 4. Verification

- [ ] 4.1 Gates (exact commands, record results here):
      `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- [ ] 4.2 Grep guards (all from repo root, excluding `dist/` and
      `node_modules/`):
  - `rg -n "DataTable|CrudSheet|ConfirmDialog|TrafficLightBadge|traffic-lights" apps packages e2e -g '*.ts' -g '*.tsx' -g '*.css'`
    → exactly ONE hit:
    `apps/api/src/modules/report-sections/report-sections.service.ts:267`
    (the `// a payload with missing traffic-lights still fails on the
content` comment — unrelated to the deleted components; it stays).
    Zero import/JSX hits. Note the pattern is case-sensitive, so the
    app-local lowercase `data-testid="crud-sheet"` strings in admin
    tabs do NOT match — their decoupling is proven by 4.3 instead.
    (`packages/ui/dist/` artifacts are gitignored; rg skips them by
    default.)
  - `rg -n "requireRole" apps packages` → zero hits.
  - `rg -n "publication.router|archive.router|report-sections.router" apps packages` → zero hits.
- [ ] 4.3 Decoupling guards:
      `apps/web/src/components/admin/groups-tab.test.tsx` and
      `apps/web/src/components/admin/users-tab.test.tsx` pass
      BYTE-UNCHANGED; executed test count drops only by the deleted
      router blocks (`data-table.test.tsx` was never executed).
- [ ] 4.4 Invariant guard: `git diff` shows no edit to
      `packages/ui/src/components/coming-soon-badge.tsx` and
      `ComingSoonBadge` still exported from `packages/ui/src/index.ts`
      (its 6 import sites in `apps/web` compile).
- [ ] 4.5 Telemetry check: new `period.service.test.ts` assertions
      green; optional live check — a head manual publish moves
      `customreport_reports_submitted_total` on `/metrics`.
