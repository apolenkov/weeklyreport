## Why

BL-26 (P2, `docs/reviews/repo-excellence-review-2026-07-14.md`, "P2/P3 —
сжато"): a grab-bag of six narrow, low-frequency robustness/consistency gaps
across `apps/api` and `apps/web`. None cause data loss or an authz breach on
their own; each is a partial-failure or drift edge case that degrades
silently instead of failing loud or self-healing. Kept as one change (per
task instructions) with one slice per finding, since each fix is independent,
small, and touches its own file.

## What Changes

1. **`ensure-lead-section.ts` create+seed isn't transactional.** If
   `seedProjectStatuses`/`seedActivityStatuses` throws after
   `reportSection.create` commits, the section exists but is permanently
   unseeded (empty form, no self-heal — the fast-path `findUnique` short-
   circuits future calls before reaching the seed step). Wrap create + both
   seeds in one `prisma.$transaction`.
2. **`reports.myHistory` skips `mapDomainError`.** Every other procedure in
   `reports.router.ts` (e.g. `compiledHistory`) wraps its service call in
   `try { ... } catch (error) { throw mapDomainError(error); }`; `myHistory`
   does not, so a domain error surfaces as a generic 500 instead of its typed
   tRPC code.
3. **Admin `dlqCount` / `retryFailed` fail-soft on unwired deps.** `dlqCount`
   returns `0` and (per file comment) `retryFailed`-adjacent paths no-op when
   `emailReminderQueue`/`jobsService` are undefined, unlike the sibling
   `requireActionLogService` helper in the same file, which throws loud on a
   missing dependency. A production wiring regression (queue/service never
   injected) would silently report "0 failed jobs" instead of failing the
   procedure.
4. **`/api/client-logs` forwarder has no body-size cap.** The Next.js proxy
   route (`apps/web/src/app/api/client-logs/route.ts`) reads the full request
   body via `req.text()` before forwarding to the api, with no size limit at
   this hop — the api side already caps it (`public-endpoint-resource-limits`
   spec, `express.json({ limit: "128kb" })`), but the web hop itself is
   unbounded, so a large POST is fully buffered by the Next.js server before
   the api's limit ever gets a chance to reject it.
5. **`useScrollFade` goes stale when content grows without a container
   resize.** The `ResizeObserver` observes the scroll container element
   itself; if the container's own box doesn't change size (fixed height) but
   its content grows (more list items appended), `scrollHeight` changes with
   no observed resize, so the fade affordance doesn't recompute.
6. **`carry-over` `recordType` derived from nullable `sourceItemId`.**
   `recordType: r.sourceItemId ? "item" : "decision"` (line 311) misclassifies
   a row as `"decision"` if `sourceItemId` is ever legitimately null for an
   item record — currently doesn't happen, but the discriminator should use
   `targetItemId`/whichever field is the actual item/decision discriminant,
   not an incidental-null field.
7. **`_destructive-guard.ts` mis-parses a credential-less `DATABASE_URL`.**
   The host-extraction regex (`url.replace(/.*@/, "")`) assumes a `user:pass@`
   segment is always present; a credential-less URL (`postgresql://host/db`)
   has no `@`, so the regex leaves the scheme (`postgresql://host/db`)
   un-stripped and host detection degrades. Currently fail-safe (over-refuses
   rather than under-refuses) but brittle — parse with `new URL(url).hostname`
   instead of hand-rolled regex.

Council/GLM Low addition from the review doc ("Сюда же council/GLM (Low):
`dev.listUsers` без `NODE_ENV`-assert") was checked against source and is
**REFUTED** — see disposition #8 below. Not carried into scope.

## Claim disposition

| #   | Claim                                                  | Verdict                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Action                                 |
| --- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 1   | `ensure-lead-section` create+seed not transactional    | CONFIRMED — read file; `create` then two `await seed*` calls, no `$transaction` wrapper                                                                                                                                                                                                                                                                                                                                                                                                                             | Wrap in `$transaction`                 |
| 2   | `myHistory` skips `mapDomainError`                     | CONFIRMED — read `reports.router.ts`; `myHistory` has no try/catch, `compiledHistory` right below it does                                                                                                                                                                                                                                                                                                                                                                                                           | Add try/catch                          |
| 3   | `dlqCount`/`retryFailed` fail-soft on unwired deps     | CONFIRMED — read `ops.procedures.ts`; `dlqCount` explicitly checks `!deps.emailReminderQueue` and returns early; `requireActionLogService` throws                                                                                                                                                                                                                                                                                                                                                                   | Fail loud, matching sibling            |
| 4   | `/api/client-logs` no size cap at web hop              | CONFIRMED — read route; `req.text()` with no limit option; api-side cap exists per `public-endpoint-resource-limits` but doesn't bound the web hop's own buffering                                                                                                                                                                                                                                                                                                                                                  | Cap at web hop                         |
| 5   | `useScrollFade` stale on content growth                | CONFIRMED — read hook; `ResizeObserver` targets `el` (the container), not its children/content                                                                                                                                                                                                                                                                                                                                                                                                                      | Observe content mutation too           |
| 6   | carry-over `recordType` from nullable `sourceItemId`   | CONFIRMED — read repository line 311; ternary keys off `sourceItemId`                                                                                                                                                                                                                                                                                                                                                                                                                                               | Key off the correct discriminant field |
| 7   | `_destructive-guard` DATABASE_URL parsing brittle      | CONFIRMED — read guard; regex-based host extraction assumes `@` present                                                                                                                                                                                                                                                                                                                                                                                                                                             | Use `new URL()`                        |
| 8   | `dev.listUsers` no `NODE_ENV` assert (council/GLM Low) | REFUTED — read `dev.router.ts:132` (`listUsers` calls `assertDevMode()`, which checks `process.env.AUTH_DEV_MODE !== "true"`) and `env.schema.ts:146` (`"AUTH_DEV_MODE=true is forbidden when NODE_ENV=production"`, enforced by a Zod refine at boot). `AUTH_DEV_MODE=true` and `NODE_ENV=production` can never coexist past boot, so `assertDevMode()` alone already transitively guarantees `NODE_ENV !== "production"` whenever it passes; a redundant call-time `NODE_ENV` assertion adds no additional safety | Not carried into scope                 |

## Non-goals

- Not fixing BL-27's queue-depth/observability gaps — separate P2 item, not
  in this change's scope (tracked as `expand-observability-metrics` per the
  review's recommended order, not authored here).
- Not restructuring `ops.procedures.ts`'s dependency-injection shape — only
  making `dlqCount`/`retryFailed`'s missing-dependency behavior consistent
  with the file's own existing `requireActionLogService` pattern.
- Not adding streaming/chunked forwarding to `/api/client-logs` — a size cap
  via `req.text()`'s length check (or an equivalent early-reject) is
  sufficient; a full streaming rewrite is out of scope.
- Not touching `Prisma` schema or migrations for the carry-over discriminator
  fix — this is a read-side derivation bug in the repository mapper, not a
  stored-column defect.

## File manifest

- `apps/api/src/modules/report-sections/application/ensure-lead-section.ts`
- `apps/api/src/modules/report-sections/application/ensure-lead-section.test.ts`
  (create if absent, or extend)
- `apps/api/src/infrastructure/trpc/routers/reports.router.ts`
- `apps/api/src/infrastructure/trpc/routers/admin/ops.procedures.ts`
- `apps/web/src/app/api/client-logs/route.ts`
- `apps/web/src/hooks/use-scroll-fade.ts`
- `apps/web/src/hooks/use-scroll-fade.test.ts` (extend if present)
- `apps/api/src/modules/carry-over/carry-over.prisma-repository.ts`
- `prisma/_destructive-guard.ts`
- `prisma/_destructive-guard.test.ts` (extend if present)

## Verification

P2 bar: full gate + affected unit/integration suites.

- `pnpm --filter @customreport/api db:generate`
- `pnpm --filter @customreport/api test`
- `pnpm --filter @customreport/web test`
- `pnpm test:integration` (ensure-lead-section's transactional seed touches
  real Postgres concurrency behavior)
- `pnpm typecheck && pnpm lint && pnpm test`
- Focused smoke (runtime item, per P2/P3 bar): first-login provisioning
  flow (seed a lead with a project, log in fresh, confirm `ProjectStatus`
  rows exist) — this is the exact path task 1 changes.
- `openspec validate latent-robustness-gaps --strict`

## Sequencing

Independent of the other five changes — no shared files. Item 1
(`ensure-lead-section.ts`) imports `isUniqueViolation` from
`api-contract-matching-strictness`'s touched file
(`prisma-unique-violation.ts`) but only as an unmodified consumer; no
ordering constraint either way.
