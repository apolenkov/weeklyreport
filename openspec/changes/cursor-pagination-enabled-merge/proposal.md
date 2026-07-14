## Why

BL-30 (P3, `docs/reviews/repo-excellence-review-2026-07-14.md`,
"Orchestrator amendments" section, NORMATIVE): `useCursorPagination`
(`apps/web/src/lib/use-cursor-pagination.ts`) unconditionally spreads
`enabled: options.enabled` into the built query options —
`{ ...built, enabled: options.enabled }` — which overwrites the factory's own
`enabled` value even when the caller passes no `options.enabled` (i.e.
`options.enabled === undefined`), because the spread key is present
regardless of whether the value is `undefined`. Confirmed against source:
read `apps/web/src/lib/use-cursor-pagination.ts` lines ~104-112, the merge is
exactly `{ ...built, enabled: options.enabled }` with no `?? built.enabled`
fallback. Currently unreachable (no caller today sets `enabled` via the
factory), so no live bug, but latent — the next caller that relies on a
factory-set `enabled` will silently get it clobbered to `undefined`.

**Contradiction found and flagged, not improvised past:** this exact
requirement is ALREADY specified and marked implemented.
`openspec/specs/web-polish-lows/spec.md` (archived from
`openspec/changes/archive/2026-07-13-web-polish-lows/`, one day before this
review) carries a requirement titled "Cursor-paginated queries respect a
factory-set `enabled` when the caller supplies none" with the identical
fix description (`options.enabled ?? built.enabled`), and that change's
`tasks.md` task 9 ("`use-cursor-pagination` — don't clobber a factory-set
`enabled`") describes the same fix. The change was archived, but the LIVE
source code still has the unfixed `{ ...built, enabled: options.enabled }`
form — the archived change's task 9 was never actually applied to the file
despite the change being archived as complete. This is spec-vs-implementation
drift, not a new requirement: the correct behavior is already documented;
only the code needs to catch up.

## What Changes

- `apps/web/src/lib/use-cursor-pagination.ts`: change
  `{ ...built, enabled: options.enabled }` to
  `{ ...built, enabled: options.enabled ?? built.enabled }`, so a caller that
  omits `options.enabled` lets the factory's own `enabled` value (if any)
  pass through, and a caller that explicitly supplies `options.enabled`
  still overrides it (unchanged for that path).
- Add a unit test pinning the previously-unverified regression: a factory
  that sets `enabled: false` and a caller that supplies no `options.enabled`
  must still produce a disabled query.

## Claim disposition

| Claim                                                                                                             | Verdict                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Action                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `useCursorPagination` clobbers a factory-set `enabled` with `options.enabled` even when the latter is `undefined` | CONFIRMED — read `use-cursor-pagination.ts`; `{ ...built, enabled: options.enabled }`, no `?? built.enabled` fallback                                                                                                                                                                                                                                                                                                                                                                                                                                              | Fix the merge                                                                                                     |
| Currently unreachable (no live caller affected)                                                                   | CONFIRMED — the only two call sites found in a scan of `apps/web/src` (archive/reminders-adjacent list views) do not pass `enabled` through their factory                                                                                                                                                                                                                                                                                                                                                                                                          | No regression risk in the fix itself                                                                              |
| The fix is already spec'd and "archived" as done                                                                  | CONFIRMED, AND FLAGGED AS DRIFT — `openspec/specs/web-polish-lows/spec.md` already states the exact required behavior (added via `openspec/changes/archive/2026-07-13-web-polish-lows`, whose `tasks.md` task 9 names this identical fix), but the live file still has the bug. The archived change's tasks.md checkboxes are all unchecked (`- [ ]`, not `- [x]`) across its ENTIRE 29-item list — not just this one — so unchecked boxes are not informative about completion in this repo; the only reliable signal is the source file itself, which is unfixed | This change closes the gap between the already-correct spec and the still-broken code; NOT a new spec requirement |

## Non-goals

- Not re-writing `web-polish-lows`'s existing requirement text — it is
  already correct. This change's spec delta (below) is a MODIFIED with the
  SAME requirement text, adding one explicit regression-pinning scenario;
  it does not change the documented contract.
- Not auditing the other 28 items in the archived `2026-07-13-web-polish-lows`
  change for the same implemented-vs-archived drift — that's a broader
  audit outside this change's scope; flagging it here as a process risk
  worth a separate look, not fixing it now.
- Not adding `enabled` support to any specific caller — this only fixes the
  hook's merge semantics; no caller is changed.

## File manifest

- `apps/web/src/lib/use-cursor-pagination.ts` — the `queryOptions` merge
  (currently `{ ...built, enabled: options.enabled }`)
- `apps/web/src/lib/use-cursor-pagination.test.ts` (extend existing coverage
  if present, or create — confirm during implementation)

## Verification

P3 bar: full gate + focused smoke for runtime items. This item has no
current live caller exercising the broken path, so the "smoke" is the unit
test itself (there is no in-app runtime flow to click through that would
observe the difference today) — a fuller manual smoke is not applicable per
`verify` skill guidance (no runtime surface to drive beyond the test).

- `pnpm --filter @customreport/web test`
- `pnpm typecheck && pnpm lint && pnpm test`
- `openspec validate cursor-pagination-enabled-merge --strict`

## Sequencing

Independent of the other five changes — touches only
`apps/web/src/lib/use-cursor-pagination.ts`, which none of the other five
touch.
