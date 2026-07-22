# Fix Web Product-Code Defects

## Why

The 2026-07-22 mass review (Opus batch review + adversarial verification,
council-ratified — `~/work/customreport-archive/2026-07-22-mass-review/`)
confirmed 5 product-code defects grouped by "user-visible/product behavior"
concern: a security-critical authz check that is hand-duplicated instead of
shared, a Suspense boundary that never fires, a state bug that silently
breaks the "Expand All" command after a full Toggle-All cycle, and two
pieces of dead surface (a no-op prop and a computed-but-discarded field)
that each carry their own tests giving false coverage confidence. All 5 are
Opus-confirmed; the Codex council pass reported zero false positives and
zero misses in this group (its one false positive and five misses both
belong to other backlog groups — see `codex-council.out`).

This is the **UI-behavior / authz-drift / dead-surface** slice of the
2026-07-22 review. The other confirmed groups (period reopen leaks, Fill
From TOCTOU, archive floor inversion, portfolio snapshot miscounts, admin
restore reactivation, test-quality hardening) are filed as separate
sibling changes; see `final-backlog.json`.

- **`pdf-export.download-handler.ts:45`** — `canReadReport` re-implements,
  field-for-field, the same admin/group-scope Prisma query as
  `PdfExportPrismaRepository.canReadReport`
  (`pdf-export.prisma-repository.ts:60-80`). Two copies of a
  security-critical read gate can silently diverge when only one is updated
  (e.g. a future group-scope rule change lands in the repository but not the
  handler, or vice versa).
- **`apps/web/src/app/(app)/layout.tsx:29`** — `NavBar` reads its session via
  a plain (non-suspense) `useQuery` inside `useSession()` and renders its own
  complete internal loading skeleton (brand pill, identity slot, right rail —
  `nav-bar.tsx:270-350`) while `isLoading` is true. It never throws a
  promise, so the `<Suspense fallback={<NavBarSkeleton />}>` boundary
  wrapping it in the layout never falls back — `NavBarSkeleton` is dead code
  whose only usage is this boundary.
- **`apps/web/src/shared/ui/report-shell/accordion-section.tsx:50`** — After
  a full Toggle-All cycle (Expand All → Collapse All → Expand All), a
  section the user individually collapsed under `groupExpanded=true` has
  `override.group === groupExpanded` true again by coincidence (both are
  `true`), so `expanded = override.value` (`false`) wins over the fresh
  group command — the section silently ignores "Expand All" and stays
  collapsed. This regresses the old mirror-on-every-prop-change behavior the
  code comment says it replaced.
- **`apps/web/src/features/slides/ui/lead-slides-client.tsx:23`** — `chrome?:
"full" | "content"` is declared on the props interface and passed by
  `lead-form-loaded.tsx` (`chrome="content"`), but the component's
  destructuring never picks it up and no branch reads it — the prop is a
  contract lie that misleads its one caller into thinking it controls
  something.
- **`apps/web/src/hooks/use-status-risk.ts:73`** — `computeCoupling`
  computes `stagesWithoutRiskCoverage` per product (field decl line 39, loop
  lines 75-90, returned line 97), but the sole production consumer,
  `validateCoupling`, reads only `riskRowsWithoutStages`. No other code
  reads the field. It is fully computed and discarded on every render, with
  its own dedicated test block (`use-status-risk-coupling.test.ts`, the
  "F10" `describe`) giving false coverage confidence, and no
  `ComingSoonBadge`/`TODO` trace marking it as deliberately deferred.

## What Changes

- Extract the duplicated admin/group-scope report-read check into one
  shared function (`apps/api/src/lib/report-read-access.ts`); have
  `PdfExportPrismaRepository.canReadReport` and
  `pdf-export.download-handler.ts` both delegate to it, so there is exactly
  one implementation of this security gate. The handler keeps re-exporting
  `canReadReport` under its existing name so its unit/integration test
  imports do not change.
- Remove the dead `<Suspense fallback={<NavBarSkeleton />}>` boundary from
  `apps/web/src/app/(app)/layout.tsx` — render `<NavBar />` directly, since
  it already owns a complete internal loading skeleton and never suspends.
  Delete `nav-bar-skeleton.tsx` (no other caller) and correct the layout's
  doc comment, which currently attributes FOUC elimination to the now-dead
  boundary.
- Fix `AccordionSection`'s expand/collapse-all interaction:
  `override.group === groupExpanded` is not a reliable "is this override
  still fresh" test because `groupExpanded` is a two-valued boolean that
  revisits the same value across a Toggle-All cycle. Replace the coincidence
  check with the standard "adjust state during render on an actual prop
  change" pattern — track the previously-seen `groupExpanded` value and
  clear/refresh the override whenever it changes, so every real Toggle-All
  press (not just the first one) forces the section back in sync, while
  individual clicks between group commands still override locally.
- Delete the unused `chrome?: "full" | "content"` prop from
  `LeadSlidesClient`'s props interface and drop the `chrome="content"`
  argument from its one call site in `lead-form-loaded.tsx` — no behavior
  depends on it today, so there is nothing to preserve.
- Delete `stagesWithoutRiskCoverage` (the field, its type, the loop that
  computes it, and the "F10" describe block in
  `use-status-risk-coupling.test.ts` that exercises it) from
  `computeCoupling`/`ProductCoupling` in `use-status-risk.ts`, since it has
  no production reader and no deferred-feature trace. `riskRowsWithoutStages`
  and `validateCoupling` are untouched.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `pdf-export-integrity` — the PDF download handler's read-authorization
  check now delegates to the same single implementation the repository
  uses, instead of maintaining a hand-duplicated copy.
- `lead-toolbar-presentation` — the mode-adaptive collapse/expand-all
  control now reliably re-syncs every section on every Toggle-All press,
  including a section a user individually overrode, across an arbitrary
  number of Toggle-All cycles.
- `architecture-refactor-backlog` — records deletion of three more pieces of
  dead `apps/web` surface found by this review: the `NavBar` Suspense
  boundary + `NavBarSkeleton`, `LeadSlidesClient`'s unused `chrome` prop, and
  `use-status-risk.ts`'s `stagesWithoutRiskCoverage` field.

## Impact

- Packages: `@customreport/api`, `@customreport/web`.
- Files:
  - `apps/api/src/lib/report-read-access.ts` (new)
  - `apps/api/src/modules/pdf-export/pdf-export.download-handler.ts`
  - `apps/api/src/modules/pdf-export/pdf-export.prisma-repository.ts`
  - `apps/web/src/app/(app)/layout.tsx`
  - `apps/web/src/shared/ui/navigation/nav-bar-skeleton.tsx` (deleted)
  - `apps/web/src/shared/ui/report-shell/accordion-section.tsx`
  - `apps/web/src/shared/ui/report-shell/accordion-section.test.tsx`
  - `apps/web/src/features/slides/ui/lead-slides-client.tsx`
  - `apps/web/src/features/report-pages/ui/lead-form-loaded.tsx`
  - `apps/web/src/hooks/use-status-risk.ts`
  - `apps/web/src/hooks/use-status-risk-coupling.test.ts`
  - `openspec/specs/pdf-export-integrity/spec.md`
  - `openspec/specs/lead-toolbar-presentation/spec.md`
  - `openspec/specs/architecture-refactor-backlog/spec.md`

## Non-goals

- No change to `canReadReport`'s actual authorization semantics (admin
  god-mode, group-scope-via-sections) — this is a dedup, not a policy
  change.
- Not adding suspense-query support to `useSession()`/`NavBar` — the
  component's existing internal skeleton already solves the FOUC problem
  the outer boundary was meant to solve; making `useSession` a real
  suspense query is a larger, unrelated change.
- Not adding new stage-level risk-coverage UI — `stagesWithoutRiskCoverage`
  is deleted, not wired up, since no caller and no deferred-feature trace
  justify keeping it; a future stage-level warning feature would be scoped
  and specced separately.
- Not touching `riskRowsWithoutStages`/`validateCoupling` — those have a
  live caller (the bridge's conflicting-transition interception) and are
  untouched.
- Not changing `LeadSlidesClient`'s other props (`deckRef`, `isFullscreen`,
  `onToggle`, `visibilityMode`, `visibilityHydrated`) — only `chrome` is
  dead.

## Findings covered

- `apps/api/src/modules/pdf-export/pdf-export.download-handler.ts:45` —
  `canReadReport` re-implements the admin/group-scope authorization
  branches verbatim from `PdfExportPrismaRepository.canReadReport`
  (`pdf-export.prisma-repository.ts:60-80`), so this security-critical read
  gate can silently diverge when one copy is updated. (opus-confirmed)
- `apps/web/src/app/(app)/layout.tsx:29` — `NavBar` reads the session via
  non-suspense `useQuery` through `useSession()` and renders its own
  internal loading skeleton, so it never throws a promise — this Suspense
  boundary's `NavBarSkeleton` fallback (its only usage in the codebase)
  never renders, making the boundary and the skeleton dead surface.
  (opus-confirmed)
- `apps/web/src/shared/ui/report-shell/accordion-section.tsx:50` — After a
  full Toggle-All cycle (true→false→true) a section the user individually
  collapsed under `groupExpanded=true` has `override.group===groupExpanded`
  again, so `expanded=override.value` ignores the "Expand All" command and
  the section stays collapsed — a regression versus the old
  mirror-on-every-change effect. (opus-confirmed)
- `apps/web/src/features/slides/ui/lead-slides-client.tsx:23` — `chrome?:
"full" | "content"` is declared and passed by `lead-form-loaded.tsx`
  (`chrome="content"`) but is never destructured or used in the component,
  so the prop is a no-op misleading its callers. (opus-confirmed)
- `apps/web/src/hooks/use-status-risk.ts:73` — The
  `stagesWithoutRiskCoverage` per-stage computation (field decl line 39,
  loop 75-90, returned line 97) is dead surface: the sole production
  consumer `validateCoupling` reads only `riskRowsWithoutStages`, and no
  other code reads this field, so the whole F10 block is computed and
  discarded with no ComingSoon/TODO trace. (opus-confirmed)
