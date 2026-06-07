# Fix the Runtime Defects Surfaced by the Behavioral UI Sweep

> **Coordination (see `docs/openspec-roadmap.md`).** This change is the _fix_
> consumer of `behavioral-ui-regression-gate`'s sweep engine. It does NOT build a
> sweep. The a11y findings here do NOT go under `verify-a11y-recommended-flip` —
> that change is acceptance-only and explicitly defers defect fixes to a
> follow-up (its "fix under a follow-up change" rule); this is that follow-up for
> the sweep-surfaced axe violations.

## Why

The Layer-1 behavioral UI sweep (`pnpm test:uat`, report-only, non-blocking) ran
live across all four roles on 2026-06-07 and recorded **621 anomalies**.
Deterministic clustering (by axe rule-id + console text) collapses them to ~11
distinct findings — most are the same handful of issues repeated across ~49
role×route combinations from shared shell components. Because the sweep never
fails CI, these defects otherwise sit behind a green gate.

Cluster breakdown (all roles):

| Cluster                                                                          | Count | Verdict                              |
| -------------------------------------------------------------------------------- | ----- | ------------------------------------ |
| React duplicate `key` (console) on `/reports`, `/reports/[reportId]`, `/present` | 226   | **real bug**                         |
| Hydration mismatch (pageerror) on `/lead/report/[reportId]/preview`              | 1     | **real bug**                         |
| axe `button-name` (critical)                                                     | 49    | real a11y                            |
| axe `label` (critical)                                                           | 49    | real a11y                            |
| axe `link-name` (serious)                                                        | 49    | real a11y                            |
| axe `nested-interactive` (serious)                                               | 49    | real a11y                            |
| axe `region` (moderate)                                                          | 49    | real a11y                            |
| axe `color-contrast` (serious)                                                   | 41    | real, but **theme-gated** (Non-goal) |
| axe `aria-hidden-focus` (serious)                                                | 4     | real a11y                            |
| axe `page-has-heading-one` (moderate)                                            | 4     | real a11y                            |
| axe `scrollable-region-focusable` (serious)                                      | 2     | real a11y                            |
| console `ERR_CONNECTION_REFUSED`                                                 | 98    | **env/infra noise** (Non-goal)       |

The five ~49-count axe rules appear on essentially every route → they originate
in the shared navigation/report-shell, so one fix per rule clears ~49 findings.

## What Changes

- **React duplicate `key`.** The repeating key values are `1`/`2`/`3`. Prime
  suspects: `components/weekly-report/product-accordion.tsx:356` (`key={p.rank}`
  — rank repeats across products) and
  `components/slides/status-slide-deck.tsx:172` (`key={String(slide.pageIndex ??
0)}`). Confirm against the live DOM, give each list a stable unique key, add a
  regression test, re-run the sweep to confirm the console warning is gone.
- **Hydration mismatch on the lead preview route.** Find the SSR/client
  divergence in `/lead/report/[reportId]/preview` (likely `Date.now()`/locale
  date formatting or a `typeof window` branch — the React message lists these),
  fix the source of non-determinism, add a test, re-run the sweep.
- **Shared-shell a11y (axe).** Fix `button-name`, `label`, `link-name`,
  `nested-interactive`, `region`, `aria-hidden-focus`, `page-has-heading-one`,
  `scrollable-region-focusable` at their shared-component source. Each fix gated
  by `pnpm typecheck && pnpm lint && pnpm test` and a sweep re-run.
- **Harness: pin the `ERR_CONNECTION_REFUSED` source, then filter.** The sweep's
  web server is booted without `NEXT_PUBLIC_SENTRY_DSN` / browser-OTEL, so this
  is NOT telemetry-to-otel. Capture the failed-request URL in the sweep
  (`page.on('requestfailed')`) to identify it, then either fix the source or add
  it to `IGNORED_CONSOLE` with the confirmed reason. Do NOT filter blind.

## Impact

- Affected screens: report list + report view + present + lead preview (React
  bugs); global nav / report-shell (a11y).
- Risk: low–medium. The React fixes are localized; the a11y fixes touch shared
  components (broad blast radius) and are each verified by a sweep re-run.
- The sweep stays report-only; this change does not change its gating posture.

## Acceptance

- `openspec validate fix-sweep-ui-findings --strict` is green.
- The two React findings each have a fix + a regression test; a sweep re-run
  shows zero duplicate-`key` console warnings and zero pageerror on the preview
  route.
- The shared-shell axe findings (excluding color-contrast) drop to zero on a
  sweep re-run.
- `ERR_CONNECTION_REFUSED` is either fixed at source or filtered with a recorded,
  confirmed reason — not filtered blind.
- Per code step: `pnpm typecheck && pnpm lint && pnpm test` green.

## Non-goals

- **`color-contrast` (41).** Fixing it means editing theme/color tokens, which
  the repo gates as research-only ("Visual And Theme Work" in `CLAUDE.md`) until
  the user picks a concrete direction. Deferred with a `TODO` until then.
- **Within-route flow/logic bugs.** The Layer-1 sweep only proves routes load +
  pass axe; it does NOT exercise form submits, mutations, or transitions. Those
  need the 3.1 AI-agent Driver (`behavioral-ui-regression-gate` task 3.1) and are
  out of scope here.
- **Re-running or re-scoping the sweep engine.** Owned by
  `behavioral-ui-regression-gate`.
