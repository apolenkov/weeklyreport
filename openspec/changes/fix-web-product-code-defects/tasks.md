# Tasks

## 1. Dedup PDF-export read authorization

- [x] 1.1 Create `apps/api/src/lib/report-read-access.ts` exporting a
      `canReadReport(session, reportId, prisma)` function containing the
      admin/group-scope logic currently duplicated in
      `apps/api/src/modules/pdf-export/pdf-export.prisma-repository.ts:60-80`
      and `apps/api/src/modules/pdf-export/pdf-export.download-handler.ts:45-66`.
- [x] 1.2 `pdf-export.prisma-repository.ts`: replace `canReadReport`'s body
      with a delegating call to the new shared function.
- [x] 1.3 `pdf-export.download-handler.ts`: replace the local `canReadReport`
      implementation with an import + re-export of the shared function, so
      `pdf-export.download-handler.test.ts` and
      `pdf-export.download-handler.integration.test.ts` (which import
      `canReadReport` from `./pdf-export.download-handler`) keep passing
      unchanged.
- [x] 1.4 Re-run `pdf-export.download-handler.test.ts`,
      `pdf-export.download-handler.integration.test.ts`,
      `pdf-export.prisma-repository.test.ts` (or equivalent) and confirm all
      still pass with identical behavior (admin god-mode, group-scope via
      sections, viewer-with-no-access denial).

## 2. Remove the dead NavBar Suspense boundary

- [x] 2.1 `apps/web/src/app/(app)/layout.tsx`: remove the
      `<Suspense fallback={<NavBarSkeleton />}>` wrapper around `<NavBar />`;
      render `<NavBar />` directly. Remove the now-unused `Suspense` and
      `NavBarSkeleton` imports.
- [x] 2.2 Rewrite the `AppGroupLayout` doc comment: it currently attributes
      FOUC elimination to the skeleton fallback that never fires; describe
      instead that `NavBar` owns its own internal loading skeleton.
- [x] 2.3 Delete `apps/web/src/shared/ui/navigation/nav-bar-skeleton.tsx`
      (confirm via grep it has no other caller before deleting).
- [x] 2.4 Confirm `NavBar`'s own internal loading skeleton (brand pill,
      identity slot, right-rail placeholders — `nav-bar.tsx:270-350`)
      already covers the cold-reload FOUC case this boundary was meant to
      guard, and add/keep a test asserting the skeleton renders while
      `useSession()` reports `isLoading: true`.

## 3. Fix the Toggle-All / individual-override interaction

- [x] 3.1 `apps/web/src/shared/ui/report-shell/accordion-section.tsx`:
      replace the `override.group === groupExpanded` staleness check with
      state that tracks the last-seen `groupExpanded` value and clears (or
      refreshes) the override whenever that value actually changes — the
      "adjust state during render on a prop change" pattern — so an
      individual override is discarded on every real Toggle-All press, not
      just the first one after it was set.
- [x] 3.2 `apps/web/src/shared/ui/report-shell/accordion-section.test.tsx`:
      add a regression test — mount with `groupExpanded=true`, individually
      collapse one section (click its toggle), flip `groupExpanded` to
      `false` then back to `true` (simulating a full Toggle-All cycle), and
      assert the section is expanded again (the "Expand All" command wins).
- [x] 3.3 Add a test confirming an individual override made _after_ the most
      recent `groupExpanded` change is still honored until the next group
      command (no regression on the existing override-persists-until-next-
      command behavior).
- [x] 3.4 `accordion-section.tsx:16` (orphan minor, same file as the major):
      the props-interface comment still claims the section "mirrors
      `groupExpanded` into its local state on every change", which no longer
      matches the implementation (there is no mirror). Rewrite the comment to
      describe the actual override-tracking behavior established by 3.1, then
      re-grade the file with its major fixed — this change owns the file's
      only two findings, so the file must land at **good**/**exemplary** with
      no residual review finding.

## 4. Delete the dead `chrome` prop on `LeadSlidesClient`

- [x] 4.1 `apps/web/src/features/slides/ui/lead-slides-client.tsx`: delete
      the `chrome?: "full" | "content"` field from `LeadSlidesClientProps`.
- [x] 4.2 `apps/web/src/features/report-pages/ui/lead-form-loaded.tsx`:
      remove the `chrome="content"` argument from its `LeadSlidesClient`
      call.
- [x] 4.3 Grep for any other `LeadSlidesClient` caller passing `chrome` (test
      files included) and remove it there too.

## 5. Delete the dead `stagesWithoutRiskCoverage` field

- [x] 5.1 `apps/web/src/hooks/use-status-risk.ts`: delete the
      `stagesWithoutRiskCoverage` field from the `ProductCoupling` interface,
      the loop that computes it (lines ~72-90), and its inclusion in the
      pushed result object.
- [x] 5.2 `apps/web/src/hooks/use-status-risk-coupling.test.ts`: delete the
      `describe("computeCoupling — stagesWithoutRiskCoverage (F10)", ...)`
      block and any other assertion on `stagesWithoutRiskCoverage`; keep all
      `riskRowsWithoutStages`/`validateCoupling` coverage intact.
- [x] 5.3 Re-grep `stagesWithoutRiskCoverage` across `apps/web/src` to
      confirm no remaining reference.

## 6. Spec deltas

- [x] 6.1 `pdf-export-integrity`: ADD the requirement that the download
      handler's read-authorization check delegates to one canonical
      implementation shared with the repository.
- [x] 6.2 `lead-toolbar-presentation`: MODIFY "Lead report controls present
      consistently and without misleading affordances" to add the scenario
      that the collapse/expand-all control re-syncs an individually
      overridden section across an arbitrary number of Toggle-All cycles,
      not just the first one.
- [x] 6.3 `architecture-refactor-backlog`: ADD the requirement recording
      deletion of the `NavBar` Suspense boundary + `NavBarSkeleton`, the
      `LeadSlidesClient` `chrome` prop, and `use-status-risk.ts`'s
      `stagesWithoutRiskCoverage` field.

## Gates

- [x] 7.1 `pnpm --filter @customreport/api db:generate` — not required because
      neither package typecheck reported a Prisma-client model error.
- [x] 7.2 `cd apps/api && pnpm exec vitest run src/modules/pdf-export/pdf-export.download-handler.test.ts src/modules/pdf-export/pdf-export.download-handler.integration.test.ts src/modules/pdf-export/pdf-export.prisma-repository.test.ts`
- [x] 7.3 `cd apps/web && pnpm exec vitest run src/shared/ui/report-shell/accordion-section.test.tsx src/hooks/use-status-risk-coupling.test.ts src/features/slides/ui/lead-slides-client.test.tsx src/shared/ui/navigation/nav-bar.test.tsx`
- [x] 7.4 `pnpm typecheck`
- [x] 7.5 `pnpm lint`
- [x] 7.6 `pnpm test`
- [x] 7.7 `pnpm build`
- [x] 7.8 `openspec validate fix-web-product-code-defects --strict`
