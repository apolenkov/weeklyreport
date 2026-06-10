# Tasks — Unify Head Toolbar Controls

## 1. Shared report-shell components

- [x] 1.1 `scope-toggle.tsx`: shorten labels — `LABELS.product` "By
      product" → "Product", `LABELS.lead` "By lead" → "Leads"; update
      `scope-toggle.test.tsx` assertions.
      Evidence: labels + 6 test assertions updated; snapshot regenerated
      (`vitest -u`, 8/8 pass).
- [x] 1.2 `scope-toggle.tsx`: adopt the ViewModeToggle visual family —
      active fill `bg-[var(--color-primary)]` →
      `bg-[var(--color-starbucks-accent)]`, inactive text →
      `text-[var(--color-starbucks-accent)]`, font `text-xs` →
      `text-sm`; KEEP the neutral `rgba(0,0,0,0.15)` wrapper border
      (sign-off recorded in `memos/toolbar-critique-synthesis.md`).
      Evidence: done; test description updated ("accent background
      class"); lead Own|Product toggle verified live, no regression.

## 2. Head shell composition

- [x] 2.1 `head-report-shell.tsx`: add visible "Present" label next to
      the Presentation icon (drop the sr-only span), `px-2.5` → `px-3`,
      keep the outline muted style.
      Evidence: done; redundant aria-label dropped (visible text is the
      accessible name); `title="Open presentation"` kept.
- [x] 2.2 `head-report-shell.tsx`: add visible "Print" label next to the
      FileDown icon (drop the sr-only span), `px-2.5` → `px-3`, keep the
      solid accent style; aria-label stays honest about the
      browser-print surface.
      Evidence: done; `title="Print report (browser print)"`. BONUS
      (same defect, same spec): the `/reports/[reportId]` page's
      `/print` link was also labeled "Export PDF" while the real async
      Export PDF button rendered below it on the same page — relabeled
      to "Print" (`app/(app)/reports/[reportId]/page.tsx`); e2e catalog
      `head.yaml` entries synced (scope toggle labels, Present, Print).
- [x] 2.3 `head-report-shell.tsx`: render `<AgentReviewComingSoon
compact />` and move it after the Present/Print links (trailing
      edge of the utility group); verify the `compact` prop in
      `agent-review-coming-soon.tsx` still preserves aria-disabled +
      ComingSoonBadge.
      Evidence: done; `compact` prop pre-existed and preserves
      aria-disabled + ComingSoonBadge tooltip; header comment updated to
      document the ui-control-density exception.

## 3. Export button label

- [x] 3.1 `export-pdf-button.tsx`: disabled (`!isExportable`) visible
      label "Publish to export PDF" → "Export PDF"; keep the disabled
      state, `title` "Publish the report first", and the sr-only
      `#disabledReason` hint; update `weekly-report-page.test.tsx`
      assertions that reference the old label.
      Evidence: done; `weekly-report-page.test.tsx` needed no edits —
      its queries use `/export pdf/i` against the published state.

## 4. Verification and acceptance

- [x] 4.1 Gates: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
      — record results here.
      Evidence: all green 2026-06-10 — typecheck 5/5 tasks, ESLint "No
      issues found", tests 100 files / 901 passed (1 pre-existing
      obsolete snapshot in `product-accordion.test.tsx`, untouched),
      build 5/5 tasks.
- [x] 4.2 Live before/after screenshots (head role, servers on :3100):
      default viewport + narrow viewport (Row 1 wrap point), Edit and
      Slides modes; check lead/viewer surfaces that reuse ScopeToggle for
      visual regressions. Present to the user for acceptance before
      archiving (`ui-control-density` research-gate evidence).
      Progress: "after" screenshots taken 2026-06-10 in
      `.playwright-mcp/unify-toolbar/` (head edit 1440 + 768, head
      slides, published report, lead slides); "before" = the user's
      complaint screenshot of the same header. Row 1 stays on one line
      at 768px. ACCEPTED by the user 2026-06-10 («Да, давай») — same
      session as the sign-off; ready to archive.
