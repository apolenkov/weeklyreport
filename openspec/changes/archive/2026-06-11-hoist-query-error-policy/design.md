# Design — Hoist Query Error Policy

## Context

`apps/web/src/lib/client-error-reporting.ts` already owns the building
blocks: `getClientErrorDetails` (requestId extraction, internal-error
detection), `formatClientErrorMessage` (prefix + "Reference: \<id\>."
suffix + internal-message suppression), `logClientError` (the
`console.error` envelope `[event] message`). That envelope is
load-bearing: `apps/web/src/lib/client-logger.ts` captures
`console.error` and POSTs to `/api/client-logs` →
`apps/api/.logs/app.log` (`pnpm logs:errors`). This change relocates
call sites only; `client-error-reporting.ts` is frozen and
`client-error-reporting.test.ts` pins the envelope.

Inventory correction recorded: at HEAD there are 12 production
`logClientError` sites, not 13 — 10 query effects (migrate) plus 2
non-query dashboard watchdog calls (`load_stalled` ~:142,
`pageshow_missing_data` ~:169 — synthetic Errors, stay direct). The
render-time `formatClientErrorMessage` at `dashboard-page.tsx:210`
also stays.

## D1 — Per-call-site hook, NOT global QueryCache.onError + meta

**Decision: build `useQueryErrorHandler` and reject the global
`QueryCache.onError` + per-query `meta` pattern.**

The rejected alternative is the documented TanStack v5 best practice
(research sources: TanStack v5 QueryCache reference and
migrating-to-v5 guide; TkDodo "Breaking React Query's API on purpose"
and "React Query error handling"; installed
`@tanstack/query-core@5.100.14` `src/query.ts:610` verifying the cache
callback fires once per fetch cycle after retries). Its real
advantages: fires once per failed fetch cycle (not per observer), no
StrictMode double-fire risk, no one-render lag.

Repo-grounded reasons it loses here (live call-site evidence beats
generic best practice):

1. **Per-site context is reactive component state.** The existing
   effects pass `pinnedReportId`, `targetReportId`, `sessionRole`,
   `sectionIdForActions` — values from component state/props that
   cannot live in static query `meta` without re-plumbing every call
   site and losing freshness.
2. **Opt-in is required either way.** `makeQueryClient()`
   (`query-client.ts`) serves ~15 deliberately-silent `useQuery` sites
   (e.g. activity-live-panel, stage-assignment-editor render-path
   handling). A global callback would need per-query `meta` opt-in to
   avoid them — at which point the hook is strictly simpler and
   unit-testable with `renderHook`.
3. **Behavior preservation.** The hook names the exact pattern the 10
   sites already use (effect on `isError`), so the 6 behavior-identical
   migrations are provably no-ops. The cache approach would change
   firing semantics (per-query vs per-observer attribution) on a
   surface with a documented refactor-revert lesson.

The hook's known costs are accepted and pinned: it fires per observer
(today none of the 10 sites share a query key with another hook user;
if that changes, duplicate toasts are the known trade-off), and the
contract test pins exactly-once firing per error transition including
under rerender.

## D2 — Hook interface

```ts
// apps/web/src/lib/use-query-error-handler.ts ("use client")
export function useQueryErrorHandler(
  query: Pick<UseQueryResult<unknown, unknown>, "isError" | "error">,
  opts: {
    event: string; // logClientError event, e.g. "leadForm.byPeriod.load_failed"
    component: string; // e.g. "LeadForm"
    procedure: string; // e.g. "leadForm.byPeriod"
    context?: Record<string, unknown>; // extra log fields (reportId, role, ...)
    toastPrefix?: string; // e.g. "Failed to load form"; omit => log-only
  },
): void;
```

Semantics:

- Effect deps are exactly `[query.isError, query.error]`. `opts` is
  read through a ref so changing context does not re-fire — a deliberate
  micro-behavior change: today a context value change during a
  persistent error re-toasts; the hook will not (strictly less noisy).
  Pinned by hook test case 5.
- On error: `logClientError(event, error, { component, procedure,
...context })` — envelope unchanged.
- Only when `toastPrefix` is set:
  `toast.error(formatClientErrorMessage(toastPrefix, error))`.
- React Compiler is on (`reactCompiler: true`); inline `opts` object
  literals at call sites are safe because the hook reads opts via ref —
  no `"use no memo"` needed.

## D3 — Per-surface policy: before/after of the 10 sites

| Site                         | Today                                         | After                                         | Behavior  |
| ---------------------------- | --------------------------------------------- | --------------------------------------------- | --------- |
| lead-form activeQ (~440)     | inline `Failed to load active report: ${msg}` | `toastPrefix: "Failed to load active report"` | CHANGES   |
| lead-form byPeriodQ (~455)   | inline `Failed to load form: ${msg}`          | `toastPrefix: "Failed to load form"`          | CHANGES   |
| lead-form versionsQ (~471)   | inline `Failed to load versions: ${msg}`      | `toastPrefix: "Failed to load versions"`      | CHANGES   |
| lead-form historyQ (~486)    | inline `Failed to load history: ${msg}`       | `toastPrefix: "Failed to load history"`       | CHANGES   |
| dashboard reviewQ (~87)      | canonical toast                               | `toastPrefix: "Failed to load dashboard"`     | identical |
| dashboard weeklyQ (~99)      | canonical toast                               | `toastPrefix: "Failed to load status report"` | identical |
| weekly-report weeklyQ (~139) | canonical toast                               | `toastPrefix: "Failed to load status report"` | identical |
| lead-slides activeQ (~104)   | log only                                      | no `toastPrefix`                              | identical |
| lead-slides byPeriodQ (~112) | log only                                      | no `toastPrefix`                              | identical |
| head-slides weeklyQ (~66)    | log only                                      | no `toastPrefix`                              | identical |

**The explicit behavior change (the point of the change):** the 4
lead-form toasts gain the "Reference: \<requestId\>." suffix and stop
echoing raw internal-error messages, via `formatClientErrorMessage`.
Grep-verified: no test or e2e asserts the old inline strings.

**Slides toast policy decision:** slides clients stay silent (no
`toastPrefix`). They are a presentation surface; the deck's empty
state remains the user-facing error signal. Flipping slides to toast
requires explicit user sign-off in a future change.

## Invariants and rollout

- No load-bearing repo invariant (period dual-state, role-coverage
  gate, destructive-db guard, deferred-feature pattern) is touched —
  none of `config.yaml`'s `link_specs_when` triggers fire.
  `architecture-refactor-backlog` is linked because `lead-form.tsx` is
  its recorded decomposition target; this change is surgical and NOT
  the decomposition.
- Rollout: web-only, no schema/API change. Lead-form migration is an
  isolated commit (easy revert + screenshot acceptance, matching the
  lead-surface acceptance practice).
- Collision: parallel sessions are active on the lead surface
  (`fix-lead-stripe-and-archived-badges`); start from a clean tree and
  rebase before the lead-form commit. The Wave-3 code-quality agents of
  `defer-uat-codequality-vercel-2026-05-26` must not run on these files
  concurrently.
