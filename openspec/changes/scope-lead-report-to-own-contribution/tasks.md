# Tasks: scope-lead-report-to-own-contribution

## 1. Shared / API contract (do first)

- [x] 1.1 Decide the status-only Product context shape (per shared product:
      foreign stages + traffic-light status + author initials). Define it in
      shared types; remove or narrow `CrossAuthorSection` / `ForeignKanbanItem` /
      `ForeignRiskEntry` / `ForeignDecisionEntry`.
- [x] 1.2 Remove `leadForm.crossAuthorSections` (full foreign content) from the
      lead path, or replace it with the status-only procedure. Trim
      `leadForm.crossAuthors` output: drop `itemCount` / `riskCount` and the
      `user.name` select (return initials only).
- [x] 1.3 List downstream consumers (lead form + slides only) and update their
      call sites to the new shape.

## 2. Backend — repository + authorization

- [x] 2.1 In `lead-form.prisma-repository.ts`, replace `getCrossAuthorSections`
      content selection with a status-only projection; `getCrossAuthors` returns
      stage status + initials, no counts, no full name. Derive initials from
      `user.name` server-side; never put the full name in the response.
- [x] 2.2 Add a caller-access check on the Product context read: the caller must
      own a section in / have access to the given `reportId`, else return empty.
      (In `LeadFormService.getCrossAuthors`: own-section OR head/admin, else `[]`.)
- [x] 2.3 Derive foreign stage status from risks (canonical rule), not the
      blocked-item path; keep archived-product exclusion. Empty `stageNames`
      means "covers all assigned stages" (review fix B1).

## 3. Frontend — own records + status-only context

- [x] 3.1 In `lead-form.tsx`, drop the `crossAuthorSectionsQ` merge; `merged*`
      collapse to own arrays only.
- [x] 3.2 In `lead-cross-author.ts`, remove the `mapForeign*` content mappers;
      keep only the status-only product-context projection. `buildCrossAuthorStageMap`
      trusts the server-derived per-stage status directly (review fix B2).
- [x] 3.3 In `sdlc-pipeline.tsx`, render foreign stages as dimmed identity-only
      chips (initials + status); remove count display; keep honest product health
      (`worstForeignSeverity` reads `ca.stages[].status`).
- [x] 3.4 In `stage-chip.tsx`, the "Locked" chip shows initials, not the owner's
      full name.
- [x] 3.5 Apply the same own-records rule to the lead slides path
      (`lead-slides-client.tsx`) AND keep honest product health on slides:
      `applyForeignProductHealth` folds the worst foreign stage into each product
      badge (review fix B3).

## 4. Tests

- [x] 4.1 Repository/integration test: the Product context read returns no
      foreign item/risk/decision text, no counts, no full names — status only.
- [x] 4.2 Negative authz test: an unrelated `reportId` returns no foreign context.
      (Service-level guard test in `lead-form.contract.test.ts`; repo-level
      content-safety in the integration test.)
- [x] 4.3 `sdlc-pipeline` render test: a co-lead's blocked stage colours product
      health but renders as a dimmed identity-only chip (initials) with no counts.
- [x] 4.4 Regression: own items/risks/decisions still render in full; foreign
      records are absent on both form and slides.
- [x] 4.5 Regression pin: foreign stage status is risk-derived, not blocked-item.
      (Incl. covers-all empty-`stageNames` blocked/at-risk cases.)

## 5. Verify + gate

- [ ] 5.1 Live-verify on the `middle` seed (a shared product, e.g. Mobile with a
      tech lead + PM): own records only, honest product colour, initials only,
      no foreign counts/text — on form and slides.
- [x] 5.2 `npx prisma generate && pnpm typecheck && pnpm lint && pnpm test &&
    pnpm build` — all green; `pnpm --filter @customreport/api test:integration`
      green (the integration suite is excluded from `pnpm test`).

## 6. Follow-up (post-merge)

- [ ] 6.1 After the PR merges to main, archive via `opsx:archive`.

## Review findings (adversarial multi-lens, all fixed before commit)

- B1 (blocker): empty `stageNames` = "covers all assigned stages" was not
  honoured in `deriveForeignStageStatus`, so a co-lead's covers-all blocked risk
  coloured no foreign stage and product health read green. Fixed + tested.
- B2 (blocker): `buildCrossAuthorStageMap` re-derived the already-risk-derived
  server status with empty risks/items, collapsing a server `red` back to
  on-track — foreign chip green while health red. Fixed: trust server status.
- B3 (blocker): lead slides never read `crossAuthors`, so a co-owned product's
  health was own-only. Fixed: `applyForeignProductHealth` folds foreign worst.

## Deferred (inert, non-leaking — tracked, not done here)

- Dead foreign-render plumbing now that no foreign record reaches the lead page:
  `displayRisks` / `coveringForeign` / `CROSS_AUTHOR_LOWER_BLOCKED_MESSAGE` in
  `lead-form-sync-bridge.tsx`; the `risk.foreign` / `decision.foreign` /
  `item.foreign` render branches in `risks-section.tsx` / `decisions-section.tsx`
  / `item-card.tsx`. All inert (own-only arrays arrive), no full name can render.
  Removing spans the render layer across 4+ files — its own focused cleanup.
- `getCrossAuthors` still emits the stable foreign `authorId` (unused on the new
  frontend, but a re-identification key). Drop or opaque-key it in that cleanup.
- Head/admin bypass is privacy-correct but inert: the repo scopes to the caller's
  own stage assignments, so a head with none gets `[]`. Confirm whether heads are
  meant to receive Product context on this read; out of scope for own-records.
