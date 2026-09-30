# Proposal

## Why

Leads need a repeatable browser regression that checks their complete report form, including returned review comments and weekly work actions. Existing colocated component tests cover individual mechanisms but do not prove the real dev-login, browser, API and persistence flow together.

## What Changes

- Inventory every Lead-visible capability from `apps/web/src/features/report-pages/ui/lead/**` and its imported controls in `e2e/lead-form/COVERAGE.md`, with a source and a named test or an explicit limitation for each row.
- Add root TypeScript scenarios using `node:test` and the installed `agent-browser` CLI 0.38.1, exposed by a separate `pnpm test:e2e` command. Keep accessible selectors, independent synthetic fixtures and temporary output outside the repository.
- Cover Overview progress and secondary actions, Product/Activity status, every editable section, save/recovery, existing input limits, submit, Lead Request reopen with Head approval/rejection, Head Request changes and immutable Previous content. Historical Plan this work may create active work while preserving Previous. Cover the real item-count rejection shown in the historical plan composer; record only the absent standalone count-limit modal and unreachable zero-owned-stage Product as unavailable.
- Validate runtime configuration and create the owned session base in `before`; prepare each test through guarded `beforeEach` reset and seed, with owned-process cleanup on cancellation.
- Complete the coordinator-authorized live run against the recorded current application revision, reconcile real failures after the runner rebase, and restore the canonical full seed before handoff. Preserve the existing web/API processes.
- Record final-SHA review by a different model including ponytail review, and hand remote CI acceptance to the coordinator without pushing. Local delivery cannot be described as complete acceptance while CI for that same SHA is unverified.
- Cover 123 authored browser cases, including `historical plan item limit retains input without changing saved work`, whose inventory entry preceded implementation. Its explicit guarded demo `section-item-limit` fixture contains exactly 100 own section items. Split Item/Risk/Decision validation and discard into independently inventoried cases, retaining the Item opener-focus assertion and its confirmed failure.
- Correct independently reviewed scenario assumptions through existing scoped waits, explicit dialog readiness, actual citation names and one strict read-only focus helper. Source navigation closes the chat sheet; reopening retains the same question/answer. Keep interrupted and selected runs separate from the pending complete 123-case result.

## Non-goals

- Product behavior, API contracts, migrations and production data changes.
- Automatic server startup, database provisioning or using runtime lane databases.
- Adding browser acceptance to `pnpm test` or `.gitlab-ci.yml`.
- Claiming live acceptance from static checks, command help or a source inventory.
- Publishing or pushing the branch.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `behavioral-ui-regression-gate`: require a source-bound, independently prepared Lead-form browser regression with an explicit guarded execution boundary and honest coverage evidence.

## Impact

Root `e2e/lead-form/*.test.ts` scenarios, a thin CLI wrapper, shared snapshot helpers, fixture/setup modules and the existing `COVERAGE.md`; root `package.json`, TypeScript and Knip entrypoint configuration as needed. Remove the task-added browser test dependency and its runner configuration. Reuse the application's existing `superjson` 2.2.6 catalog dependency as a root development dependency to decode observed complete tRPC inputs before canonical schema assertions. Related contracts are `lead-status-overview`, `unified-report-authoring`, `carry-over-automation`, `lead-form-write-actions`, `report-section-write-gates`, `review-verdict-integrity`, `reopen-requests`, `destructive-db-guard` and `reset-script-redis-flush`. The Lead browser surface and the Head review surface remain unchanged.
