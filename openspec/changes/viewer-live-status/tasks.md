# Tasks — viewer-live-status

Implements the deltas in `specs/`. Decisions per `design.md` + ADR 0007.

## 0. Backend — `currentEditableId` helper (one source of truth)

- [x] 0.1 Add `getCurrentEditableId()` to `WeeklyReportRepository`: `findFirst({
periodStatus in [open, reopened], periodStart <= now, archived: false }, orderBy
periodStart desc }).id ?? null`. Editable-only (NO published fallback),
      `archived: false`. Surface it through `WeeklyReportService.getCurrentEditableId()`
      (passthrough). The gate calls `this.repository.getCurrentEditableId()`; the
      resolver (router) calls `deps.weeklyReportService.getCurrentEditableId()` — the
      router has no repository handle, so the service passthrough is what enforces the
      single source and prevents a duplicated inline query (design Decision 0). Do NOT
      use `getActiveReportId` (published fallback + no archived filter).
- [x] 0.2 Direct repository integration test for `getCurrentEditableId()` (real
      Prisma): newest editable wins; an archived-open row is EXCLUDED (proves
      `archived: false`); a `periodStart > now` row is excluded; a published-only state
      returns null (proves NO published fallback). Prove teeth by mutation (drop
      `archived: false` → archived-open leaks in).

## 1. Backend — Status-target resolver (`latestForViewer`)

- [x] 1.1 Add `reports.latestForViewer` (`anyRoleProcedure`) replacing
      `reports.latestPublished` (design Decision 2): (a) if `currentEditableId` is
      non-null AND that exact report has a viewer-visible section (`findFirst({ id:
currentEditableId, sections: { some: sectionScope } })`) → target it; (b) else the
      newest viewer-visible published (`findFirst({ periodStatus = published, sections: {
some: sectionScope } }, orderBy periodStart desc)`); else `{ reportId: null }`. Do
      NOT search older editable periods — the gate authorizes only `currentEditableId`.
      Rename `latestPublishedReportSchema` → `latestForViewerReportSchema`.
- [x] 1.2 Remove the old `latestPublished` resolver + its UNIT tests (prove "unused"
      first — its only production consumer is the viewer `/reports/latest` route), but
      ADAPT the existing SQL integration test
      (`reports-latest-published.integration.test.ts` →
      `reports-latest-for-viewer.integration.test.ts`) to the new resolver rather than
      deleting it — it carries the real Prisma section-scope relation coverage.
- [x] 1.3 Unit tests (`reports-latest-for-viewer.test.ts`): current editable visible
      → targeted; current editable NOT visible but an older editable IS → the older
      editable is NOT targeted (falls to published/empty); no current → newest VISIBLE
      published (NOT the globally-newest invisible one); null when no visible section;
      no-access viewer → null. (SQL section-scope visibility lives in the adapted
      integration test from 1.2; the helper's own query in 0.2.) (Maps:
      `viewer-report-navigation` entry requirement.)

## 2. Backend — published-or-current read gate (fail-closed)

- [x] 2.1 In `weekly-report.service.ts`, replace the viewer published-only gate with
      published-or-current: `role === "viewer" && periodStatus !== "published" &&
resolvedId !== currentEditableId → reject`. Compute `currentEditableId` (task 0.1,
      editable-only) no earlier than the report fetch, so an `open → published` race
      rejects (recovered via the one-shot re-resolution in task 4.3) and a mid-request
      new period fails closed (design Decision 1).
- [x] 2.2 Confirm the viewer live read is group-scoped exactly as head/lead
      (`scopeWhere` → `groupScopeFilter`); add NO draft/submitted filter (Decision 6).
      (Maps: `viewer-report-navigation` read-gate requirement; `head-report-visibility`
      REMOVED.)
- [x] 2.3 Tests (`weekly-report.service.test.ts`) — security-sensitive branches:
      viewer + current open draft → visible; viewer + submitted → visible; viewer +
      current reopened → live content; viewer + explicit NON-current open id → rejected;
      viewer + archived-open id → rejected; viewer + scheduled-future id → rejected;
      viewer + past published id → snapshot; viewer + open→published race → rejected
      (then snapshot on re-fetch); viewer + no access → empty; head draft visibility
      unchanged. Prove teeth by mutation (drop the id check → future/stale read leaks).

## 3. Backend — viewer History lists only openable reports (viewer-role-only)

- [x] 3.1 In `compiledHistory`, add a `role === "viewer"` conditional
      `periodStatus = "published"` predicate to BOTH `listWhere` AND `archiveCountWhere`
      (else the list and the archive count disagree for the viewer), so a reopened period
      (legacy `status="published"`, `periodStatus="reopened"`) is not listed to the
      viewer as a gate-rejected broken link. The filter MUST be viewer-only —
      `compiledHistory` is a shared `anyRoleProcedure` (design Decision 5). Tests:
      reopened period absent from VIEWER list AND not counted in the viewer archive
      count; head AND lead History non-regression (reopened still listed + counted).
      (Maps: entry "History lists only openable" scenario; non-goal "head/lead unchanged".)

## 4. Frontend — nav "Status" rename + `/reports/latest`

- [x] 4.1 In `nav-bar.tsx`, relabel the viewer entry "Latest" → "Status"
      (`/reports/latest` href kept). Precise active-state is deferred (Decision 10);
      do NOT amend the durable History-active contract in this change.
- [x] 4.2 Point `reports/latest/page.tsx` at `reports.latestForViewer`; keep the
      client `router.replace` pattern. Loading + empty states per the design states
      table; empty copy reads "no report to show yet" (not "no published report").
- [x] 4.3 One-shot race recovery via a bounded, PROPAGATED marker (design
      Decision 1): `/reports/latest` reads an incoming `recovery` (default `0`) and
      `router.replace`s to `/reports/[id]?source=status&recovery=<value>` (propagate, do
      NOT hard-code `0`). On the report route a `NOT_FOUND` is recovered ONLY when
      `source=status` AND `recovery=0`: redirect once to `/reports/latest?recovery=1`,
      which re-resolves to `…&recovery=1`. A `NOT_FOUND` with `recovery=1` (or without
      `source=status`) shows the terminal notice without redirecting. Integration tests
      cover BOTH redirect hops: (a) open→published flip → report 404 → `/reports/latest?
recovery=1` → published snapshot with `recovery=1`; (b) the now-`recovery=1` page
      404s → terminal notice, no further redirect (loop barred); (c) a direct bad id (no
      `source=status`) → terminal notice, no redirect.

## 5. Frontend — viewer report shell: remove Back-to-Archive only

- [x] 5.1 In `viewer-report-shell.tsx`, remove the **Back to Archive** affordance
      (`backToArchive`, `ARCHIVE_HREF`) and drop now-unused imports. KEEP
      `AgentReviewComingSoon` (deferred-feature-pattern contract; Decision 8). Do NOT
      touch the shared lifecycle pill (Decision 9). Test: Back-to-Archive absent,
      Agent-review still present.

## 6. Docs (done in Act 1 — verify in sync)

- [x] 6.1 Confirm ADR 0007 + the CONTEXT.md "Status observation" / "Status target"
      glossary entries match the shipped behavior (written in Act 1).

## 7. Gates

- [x] 7.1 `npx prisma generate` then `pnpm typecheck`, `pnpm lint`, `pnpm test`,
      the viewer integration tests, and `pnpm build` all green before commit.
- [x] 7.2 Pre-push catalog-drift: `/reports/latest` already has catalog coverage;
      re-run the checker if any route shape changed.
