# Tasks — Unify Top Action Toolbars

Direction (user, 2026-06-14 live walk, screenshot): "make button grouping like
lead — move part into the strip/bar, align part, by analogy." The head report
top action row is the priority; audit the rest.

MUST land AFTER `polish-lead-toolbar-and-risk-dialog` so it targets the FINAL
lead control styling. Read archived `head-toolbar-parity` +
`unify-head-toolbar-controls` first; reuse their tokens/components.

## 1. Design — RESOLVED 2026-06-14, see `design.md` (D1–D5)

- [x] 1.1 Head action-row framing: a "actions pill" reusing the ReportToolbar
      container tokens, `flex flex-wrap` (WRAP not clip), grouped
      `[scope · view-mode]` / `[present · print · agent]`. See D1/D3.
- [x] 1.2 Present/Print stay LABELED text+icon pills (primary actions). See D2.
- [x] 1.3 Same idiom in head slides mode; viewer fixed by the head pattern
      (drop dup `<h1>`, actions pill ABOVE the page, `toolbar` slot left unset so
      the period bar stays). See D3/D4.

## 2. Implement

- [x] 2.0 BUG — viewer report header is DOUBLED ("viewer полетел", 2026-06-14
      screenshot). `app/(app)/reports/[reportId]/page.tsx` renders its OWN
      `<h1>Status Report</h1>` + Report-ID + a bare action row (Back to Archive /
      Presentation / Print / Agent review), THEN mounts `WeeklyReportPage`, which
      renders its own "Status Report · Live · N/N" header — two stacked titles.
      Fix by the head pattern (`head-report-shell.tsx`): drop the wrapper's
      duplicate `<h1>`/context, mount the viewer actions in the unified pill bar
      ABOVE `WeeklyReportPage`, and leave the `toolbar` slot unset so the page
      keeps its own period bar (week + date range). Keep all hrefs/aria/behavior.
- [x] 2.1 Apply the unified container + intent grouping to the head report
      action row (form + slides). Keep all hrefs, behavior, aria intact.
      Use the frontend-design skill for the visual pass; named consts, no magic
      numbers; UI strings stay English.
- [x] 2.2 Audit every report-surface top action row (lead form header, head
      dashboard/review, viewer); record which match vs diverge; align the
      divergent ones; note any intentionally-distinct surface. Viewer is 2.0.

## 3. Tests + gates

- [x] 3.1 Render tests for the regrouped head action row (controls present,
      grouped, aria/hrefs preserved). Update snapshots honestly.
- [x] 3.2 `pnpm typecheck && pnpm lint` + vitest for touched web packages.
- [x] 3.3 Live re-check at `:3000` (head report form + slides): before/after
      screenshots to `/tmp/finish-backlog-shots/`.
