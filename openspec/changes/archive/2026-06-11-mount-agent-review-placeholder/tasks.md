# Tasks — Mount Agent-Review Placeholder On All Report Surfaces

> Status: COMPLETE — implemented 2026-06-11.

Decisions D1-D3: `design.md`. Evidence anchors: `proposal.md`.

## 1. Web — Add Placeholder To Missing On-Screen Surfaces

- [x] 1.1 Import and mount `AgentReviewComingSoon` in the published-viewer
      header cluster at `apps/web/src/app/(app)/reports/[reportId]/page.tsx:38`,
      next to the Presentation/Print links.
- [x] 1.2 Mount `AgentReviewComingSoon` in the head presentation header at
      `apps/web/src/app/(app)/head/report/[reportId]/present/page.tsx:28`.
- [x] 1.3 Mount `AgentReviewComingSoon` in the published presentation header at
      `apps/web/src/app/(app)/reports/[reportId]/present/page.tsx:21`.
- [x] 1.4 Mount `AgentReviewComingSoon` in the lead self-preview header at
      `apps/web/src/app/(app)/lead/report/[reportId]/preview/page.tsx:46`.
- [x] 1.5 Choose `compact` per row per `ui-control-density`
      (`openspec/specs/ui-control-density/spec.md:43`); match the head-shell
      precedent at `apps/web/src/components/head/head-report-shell.tsx:141`.

## 2. Web — Confirm Excluded Surfaces Stay Clean

- [x] 2.1 Confirm `apps/web/src/app/print/[reportId]/page.tsx` renders no
      `AgentReviewComingSoon` (print/PDF stays a paper artifact).
- [x] 2.2 Confirm the history/archive list pages (`/lead/history`,
      `/head/history`, reports archive tab) render no placeholder.
- [x] 2.3 Confirm no placeholder was added inside the shared `WeeklyReportPage`
      body, so head edit mode keeps exactly one placeholder
      (`apps/web/src/components/head/head-report-shell.tsx:141`).

## 3. Tests

- [x] 3.1 Add a render test per newly mounted surface asserting one
      `data-testid="agent-review-coming-soon"` is present
      (`apps/web/src/components/report-shell/agent-review-coming-soon.tsx:22`).
- [x] 3.2 Add a render test asserting the print page renders zero such controls.
- [x] 3.3 Assert each newly mounted control keeps `aria-disabled="true"` and the
      existing English copy (no new strings).

## 4. Gates And Acceptance

- [x] 4.1 Run `pnpm typecheck && pnpm lint && pnpm test && pnpm build`; all green.
- [x] 4.2 Run `grep -rn "AgentReviewComingSoon" apps/web/src` and confirm one
      mount per intended on-screen surface and none on print/list surfaces.
- [ ] 4.3 Verify in the live app (head, lead, viewer) that every report surface
      shows the placeholder and print/PDF does not.
- [ ] 4.4 User acceptance: head confirms the placeholder reads consistently
      across viewer, present, preview, and slides.
- [x] 4.5 Review fix (2026-06-11): head shell slides mode rendered two
      placeholders (shell toolbar + head slide article in
      `apps/web/src/components/slides/status-slide-deck.tsx`). Gated the
      toolbar mount on `mode === "form"`, added `head-report-shell.test.tsx`
      covering both modes, and made the spec scenario state the
      form-mode-only toolbar mount explicitly.
