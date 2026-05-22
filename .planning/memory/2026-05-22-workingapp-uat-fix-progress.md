<!-- markdownlint-disable -->

# Working-app UAT+fix — session progress (2026-05-22)

Goal: `goals/working-app-uat-fix/goal.md` (10 done-conditions). Branch
`fix/PRJ-2/shiny-eagle`. Baseline before feature work: `fb7ee87`.

## Done this session (12 commits, all green, frozen-check clean)

- Fresh dev server via new `pnpm dev:fresh` (host `next dev --webpack` + nest;
  NOT docker). Stale `.next` was the prior "broken" cause.
- Fixed 3 dashboard-page loading-guard tests (mock useMutation/useQueryClient +
  leadForm.revokeAllSubmitted). 502/502 web tests green at baseline.
- Logging: 4 coverage gaps (slow-trpc warn, structured prisma slow-query JSON,
  process uncaught/unhandledRejection, HTTP 2xx at info). #330 done.
- Perf: log-evidence pass → NO index/cache change justified on minimal seed
  (tiny tables, cold-start latency). Roadmap for scale. `.planning/audits/perf-*`.
- ArchiveToggle moved next to period selector (shared ReportToolbar). #332.
- Jira linkage deferred to roadmap (`.planning/todos/pending/2026-05-22-jira-*`). #336.
- Priorities: removed redundant standalone Priorities section + dead component;
  unique ranks via <select> in ItemEditDialog (taken ranks disabled). #334/#335.
- Vercel/Next audit `.planning/audits/vercel-audit-2026-05-22.md`. Applied only
  staleTime (#4). PENDING: next/font, Metadata API, lazy-Recharts, next/script.
- **Lead split-view (#323) DONE surgically**: new `LeadSlidesPreview` (query-free
  deck from a ReportSectionReadModel) + a `xl:grid` wrapper in `lead-form.tsx`
  edit branch (form left, preview right, fed `draftSection`). Standalone
  `?mode=slides` (LeadSlidesClient) untouched.

## CRITICAL LESSONS

- **3 agents stalled at idle-timeout (~600-900s) on long lead-form tasks**
  (uat-sweeper, first logging-fixer, lead-splitview). Do BIG lead-form work
  SURGICALLY INLINE in small verified steps — NOT via one long agent. Small
  scoped agents (priorities-builder 632s) can finish; long open-ended ones die.
- **LSP `<new-diagnostics>` for lead-form.tsx are STALE/phantom this session**
  (lagging the failed agent's buffer). ALWAYS verify with `pnpm exec tsc
--noEmit -p tsconfig.json` (real exit) — do NOT trust the inline diagnostics.
- **Don't mask exit codes**: `cmd | tail` makes `$?` = tail's code. Capture
  `pnpm exec tsc ...; echo $?` directly.
- Automated Playwright sweep contends with the user's manual browser (single
  shared MCP browser). User drives manual UAT; agent does code in parallel.
- Stashed broken WIP: `git stash list` has the failed lead-splitview agent's
  half-refactor (lead-form + lead-draft-context.tsx). Can `git stash drop` it —
  the surgical version replaced it; do NOT pop.

## Remaining (do head/viewer SURGICALLY, not long agents)

- #333/#324 Head↔lead parity: Phase A DONE (committed) — `head-report-shell.tsx`
  form-mode now renders WeeklyReportPage (left) + read-only HeadSlidesClient
  preview (right) at xl, shared weeklyReport.get deduped.
  Phase B PENDING (new UI, do surgically with fresh context):
  - Grouping toggle product↔lead. `weekly-report-page.tsx`: render is
    `products.map(report => <ProductAccordion/>)` at ~line 374; data is
    `ProductReport[]` from `mapWeeklyReport(weeklyQ.data)`, each carrying
    `authorIds?: string[]`. "By lead" = group `products` by author (resolve
    author names from `weeklyQ.data.leadSections`), render per-author group
    containers. Add `scope?: "product"|"lead"` prop (default product) + a
    `ScopeToggle` (values product|lead) in `head-report-shell.tsx` local state,
    pass `scope` to BOTH WeeklyReportPage and the slides preview.
  - Action-row parity: head shows Submit→export/log instead of edit Submit
    (head is read-only). Export/PDF path already exists (pdf-export); wire the
    button row in the head shell header to match the lead toolbar shape.
- #337 Viewer: read-only status+history, group-scoped via `viewerGroupAccess`
  (sees all products of its group). No edit/action controls.
- #325 SDLC grey: VERDICT A (by-design). Backend `lead-form.prisma-repository.ts:562`
  returns null when foreign author has no `stageStatuses` row → trafficToStageStatus(null)
  → "empty" grey. ONLY a bug if a stage WITH a saved status shows grey (save-path).
  Awaiting user observation on fresh build. Do NOT fix blind.
- #326 CLS: biggest CWV risk per Vercel audit = no SSR prefetch/HydrationBoundary
  (NEEDS-DESIGN). next/font also helps CLS.
- #328/#329 code-quality: apply remaining Vercel wins; code-simplifier/modernization/
  review; ESLint/Prettier modernization (eslint.config.ts has an IDE-only Plugin
  type warning — gates pass).
- #331 final: re-run all gates + frozen-check (`git diff --name-only fb7ee87..HEAD`
  must have no telegram/ai/rag/theme/i18n/holiday/director) + clean tree.

## Memos (context for resume)

- `/tmp/splitview-arch-memo.md` — lead/head/SDLC architecture, exact files/lines.
- `/tmp/logging-coverage-audit.md`, `/tmp/vercel-audit.md` (committed copies in
  `.planning/audits/`).
