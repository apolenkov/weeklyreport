# Tasks — Agent-Review Human-Confirmed Gate

> **SCOPE 2026-07-04.** Implement **§1 only** (`report-review-mode` — HF9+HF3,
> LIVE). **§2–§6 are PARKED** (the `agent-review` inert-proposal contract:
> shared schema, Prisma table/migration, backend gate, web bar, deferred
> bookkeeping) until agent-review is on the roadmap — see the proposal SCOPE
> banner. Do not build §2–§6 tonight. §7 verification applies to the §1 slice.

## 1. report-review-mode — LIVE (HF3 + HF9)

- [ ] 1.1 Add a review-mode/normal-mode toggle to the live report body shell
      (`apps/web/src/components/weekly-report/weekly-report-page.tsx`); default
      normal mode; render the toggle only when the session can review at least
      one section (designated reviewer / head / admin).
- [ ] 1.2 Gate the in-body review affordances on the mode: mount
      `record-comments.tsx` composer and `section-verdict-control.tsx` only in
      review mode; keep read-only report content in normal mode.
- [ ] 1.3 Keep the `AgentReviewComingSoon` header placeholder rendered in BOTH
      modes; add a test asserting it is present in normal and review mode (guards
      the `deferred-feature-pattern` coverage requirement).
- [ ] 1.4 Move `SectionReviewStrip` out of `weekly-report-page.tsx` (currently
      rendered at ~line 486) and mount it in
      `apps/web/src/components/dashboard/dashboard-page.tsx`, merged into the
      dashboard review area; remove the in-body render.
- [ ] 1.5 Ensure a designated viewer-reviewer keeps a verdict home: the in-body
      review-mode verdict control renders for any `canReview` section
      (viewer-reviewer not stranded by the head-only strip).
- [ ] 1.6 Update / add web unit tests: normal-mode hides affordances, review-mode
      shows them, non-reviewer sees no toggle, strip renders on the dashboard and
      not in the report body, viewer-reviewer verdict path.

## 2. agent-review shared schema — additive, deferred-safe

- [ ] 2.1 In `packages/shared/src/schemas/review.schema.ts` add
      `agentReviewProposalViewSchema` (id, reportSectionId, verdict,
      judgedVersion, agentModel, rationale?, status, confirmedByName?, createdAt)
      and the confirm/dismiss input schemas (`{ proposalId: uuid }`).
- [ ] 2.2 Extend `sectionReviewViewSchema` with optional `source`
      (`"human" | "agent"`) and `confirmedByName` — optional so existing
      consumers stay valid.
- [ ] 2.3 Export the new types; run `pnpm --filter @customreport/shared test`.

## 3. agent-review schema / migration

- [ ] 3.1 Add `enum AgentReviewProposalStatus { proposed confirmed dismissed }`
      and `model AgentReviewProposal` to `prisma/schema.prisma` (shape in
      design.md D3); relation to `ReportSection` (cascade) and optional
      `confirmedBy` User.
- [ ] 3.2 Hand-write the partial unique index
      `AgentReviewProposal_one_proposed_per_section ON ("reportSectionId") WHERE
"status" = 'proposed'` in the init migration (ReopenRequest precedent).
- [ ] 3.3 `pnpm --filter @customreport/api db:generate`, then
      `prisma migrate reset` with the consent env var; confirm the partial index
      lands (per DB).

## 4. agent-review backend — gate + deferred stub

- [ ] 4.1 Add an `AgentReviewProposal` repository + service (proposal read,
      confirm, dismiss) in `apps/api/src/modules/review/`.
- [ ] 4.2 Confirm handler: enforce `isDesignatedReviewer` + `isEditablePeriod`,
      reject when `judgedVersion !== section.version` (stale), apply the verdict
      effect by REUSING the existing `postVerdict` transition, and flip the
      proposal to `confirmed` with `confirmedById`/`confirmedAt` — one
      transaction.
- [ ] 4.3 Register `review.confirmAgentProposal` / `review.dismissAgentProposal`
      on `leadershipProcedure` in
      `apps/api/src/infrastructure/trpc/trpc.router.ts` (canonical builder —
      `role-coverage-gate`).
- [ ] 4.4 Add the deferred agent-invocation entry point throwing
      `new Error('Not implemented — see TODO(AGENT-REVIEW-01)')` with a matching
      `TODO(AGENT-REVIEW-01)` marker at the activation point.
- [ ] 4.5 Union CONFIRMED proposals only into `toReviewViews`
      (`apps/api/src/modules/report-sections/report-sections.prisma-repository.ts`)
      as agent-authored `SectionReviewView` entries; unconfirmed proposals are
      never read here or in `review.service.ts:getSubmissionDashboard`.
- [ ] 4.6 Tests: unconfirmed proposal is inert across `toReviewViews`,
      `resolveBadge`, and dashboard counts; confirm applies the un-submit; stale
      confirm rejected; non-reviewer forbidden; confirmed verdict carries agent +
      confirmer attribution.

## 5. agent-review web — affordance + confirm bar (deferred)

- [ ] 5.1 Add the Agent-review affordance to `section-review-strip.tsx` rendered
      as `AgentReviewComingSoon` (inert ComingSoon; no runtime flag) — HF7.
- [ ] 5.2 Add a confirm/dismiss bar for a pending agent proposal (review-mode
      surface) wired to the new procedures; while the agent invocation is
      deferred there are no live proposals, so it stays inert/ComingSoon until
      activation.
- [ ] 5.3 Web tests for the Agent-review ComingSoon control on the strip and the
      confirm-bar affordance.

## 6. Deferred-feature bookkeeping

- [ ] 6.1 Keep `TODO(AGENT-REVIEW-01)` consistent across the placeholder
      component, the loud backend stub, and the activation point.
- [ ] 6.2 Confirm no route/catalog drift (adding a route trips the catalog gate);
      add an `e2e/catalog` scenario or `EXCLUDED_ROUTES` entry if a new route
      lands, then re-run `pnpm catalog:check`.

## 7. Verification

- [ ] 7.1 `pnpm --filter @customreport/api db:generate` (pnpm ops wipe the
      `.prisma` client).
- [ ] 7.2 `pnpm typecheck` — green.
- [ ] 7.3 `pnpm lint` — green with `--max-warnings 0`, no new
      `eslint.config.ts` exempt entry.
- [ ] 7.4 `pnpm test` (unit) — green, including the new inert-proposal,
      stale-confirm, authz, and review-mode tests.
- [ ] 7.5 `pnpm test:integration` (single-thread) for the review module DB
      paths, if backend confirm/dismiss is implemented in this slice.
- [ ] 7.6 `openspec validate agent-review-human-confirmed-gate --strict` — passes.
