# Tasks

## 1. Dedup PDF-export read authorization

- [ ] 1.1 Create `apps/api/src/lib/report-read-access.ts` exporting a
      `canReadReport(session, reportId, prisma)` function containing the
      admin/group-scope logic currently duplicated in
      `apps/api/src/modules/pdf-export/pdf-export.prisma-repository.ts:60-80`
      and `apps/api/src/modules/pdf-export/pdf-export.download-handler.ts:45-66`.
- [ ] 1.2 `pdf-export.prisma-repository.ts`: replace `canReadReport`'s body
      with a delegating call to the new shared function.
- [ ] 1.3 `pdf-export.download-handler.ts`: replace the local `canReadReport`
      implementation with an import + re-export of the shared function, so
      `pdf-export.download-handler.test.ts` and
      `pdf-export.download-handler.integration.test.ts` (which import
      `canReadReport` from `./pdf-export.download-handler`) keep passing
      unchanged.
- [ ] 1.4 Re-run `pdf-export.download-handler.test.ts`,
      `pdf-export.download-handler.integration.test.ts`,
      `pdf-export.prisma-repository.test.ts` (or equivalent) and confirm all
      still pass with identical behavior (admin god-mode, group-scope via
      sections, viewer-with-no-access denial).

## 2. Remove the dead NavBar Suspense boundary

- [ ] 2.1 `apps/web/src/app/(app)/layout.tsx`: remove the
      `<Suspense fallback={<NavBarSkeleton />}>` wrapper around `<NavBar />`;
      render `<NavBar />` directly. Remove the now-unused `Suspense` and
      `NavBarSkeleton` imports.
- [ ] 2.2 Rewrite the `AppGroupLayout` doc comment: it currently attributes
      FOUC elimination to the skeleton fallback that never fires; describe
      instead that `NavBar` owns its own internal loading skeleton.
- [ ] 2.3 Delete `apps/web/src/shared/ui/navigation/nav-bar-skeleton.tsx`
      (confirm via grep it has no other caller before deleting).
- [ ] 2.4 Confirm `NavBar`'s own internal loading skeleton (brand pill,
      identity slot, right-rail placeholders — `nav-bar.tsx:270-350`)
      already covers the cold-reload FOUC case this boundary was meant to
      guard, and add/keep a test asserting the skeleton renders while
      `useSession()` reports `isLoading: true`.

## 3. Fix the Toggle-All / individual-override interaction

- [ ] 3.1 `apps/web/src/shared/ui/report-shell/accordion-section.tsx`:
      replace the `override.group === groupExpanded` staleness check with
      state that tracks the last-seen `groupExpanded` value and clears (or
      refreshes) the override whenever that value actually changes — the
      "adjust state during render on a prop change" pattern — so an
      individual override is discarded on every real Toggle-All press, not
      just the first one after it was set.
- [ ] 3.2 `apps/web/src/shared/ui/report-shell/accordion-section.test.tsx`:
      add a regression test — mount with `groupExpanded=true`, individually
      collapse one section (click its toggle), flip `groupExpanded` to
      `false` then back to `true` (simulating a full Toggle-All cycle), and
      assert the section is expanded again (the "Expand All" command wins).
- [ ] 3.3 Add a test confirming an individual override made _after_ the most
      recent `groupExpanded` change is still honored until the next group
      command (no regression on the existing override-persists-until-next-
      command behavior).

## 4. Delete the dead `chrome` prop on `LeadSlidesClient`

- [ ] 4.1 `apps/web/src/features/slides/ui/lead-slides-client.tsx`: delete
      the `chrome?: "full" | "content"` field from `LeadSlidesClientProps`.
- [ ] 4.2 `apps/web/src/features/report-pages/ui/lead-form-loaded.tsx`:
      remove the `chrome="content"` argument from its `LeadSlidesClient`
      call.
- [ ] 4.3 Grep for any other `LeadSlidesClient` caller passing `chrome` (test
      files included) and remove it there too.

## 5. Delete the dead `stagesWithoutRiskCoverage` field

- [ ] 5.1 `apps/web/src/hooks/use-status-risk.ts`: delete the
      `stagesWithoutRiskCoverage` field from the `ProductCoupling` interface,
      the loop that computes it (lines ~72-90), and its inclusion in the
      pushed result object.
- [ ] 5.2 `apps/web/src/hooks/use-status-risk-coupling.test.ts`: delete the
      `describe("computeCoupling — stagesWithoutRiskCoverage (F10)", ...)`
      block and any other assertion on `stagesWithoutRiskCoverage`; keep all
      `riskRowsWithoutStages`/`validateCoupling` coverage intact.
- [ ] 5.3 Re-grep `stagesWithoutRiskCoverage` across `apps/web/src` to
      confirm no remaining reference.

## 6. Spec deltas

- [ ] 6.1 `pdf-export-integrity`: ADD the requirement that the download
      handler's read-authorization check delegates to one canonical
      implementation shared with the repository.
- [ ] 6.2 `lead-toolbar-presentation`: MODIFY "Lead report controls present
      consistently and without misleading affordances" to add the scenario
      that the collapse/expand-all control re-syncs an individually
      overridden section across an arbitrary number of Toggle-All cycles,
      not just the first one.
- [ ] 6.3 `architecture-refactor-backlog`: ADD the requirement recording
      deletion of the `NavBar` Suspense boundary + `NavBarSkeleton`, the
      `LeadSlidesClient` `chrome` prop, and `use-status-risk.ts`'s
      `stagesWithoutRiskCoverage` field.

## Gates

- [ ] 7.1 `pnpm --filter @customreport/api db:generate`
- [ ] 7.2 `cd apps/api && pnpm exec vitest run src/modules/pdf-export/pdf-export.download-handler.test.ts src/modules/pdf-export/pdf-export.download-handler.integration.test.ts src/modules/pdf-export/pdf-export.prisma-repository.test.ts`
- [ ] 7.3 `cd apps/web && pnpm exec vitest run src/shared/ui/report-shell/accordion-section.test.tsx src/hooks/use-status-risk-coupling.test.ts src/features/slides/ui/lead-slides-client.test.tsx src/shared/ui/navigation/nav-bar.test.tsx`
- [ ] 7.4 `pnpm typecheck`
- [ ] 7.5 `pnpm lint`
- [ ] 7.6 `pnpm test`
- [ ] 7.7 `pnpm build`
- [ ] 7.8 `openspec validate fix-web-product-code-defects --strict`
