# Per-file audit — apps/web/src/components/search (2026-07-02)

Read-only audit, wave 2 web.
1 file scanned.
Kept 5 findings, killed 1.

## search-input.tsx (5 findings)

| Lines       | Dimension       | Severity | Finding                                                                                                                                                                                                                                                                                                                                | Suggestion                                                                                                                                                                                                                    | Your verdict |
| ----------- | --------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 116-304     | size-complexity | high     | `SearchInput` component body is ~188 lines, ~4x the 50-line function cap; mixes debounce state, query fetching, keyboard nav, outside-click handling, and dropdown/result-row markup in one function. File itself is 230 effective lines (excl. blanks/comments), so the 250-line file cap is NOT breached — only the function cap is. | Split into `useSearchQuery`/`useDebouncedValue` hook, a `SearchResultsList` component, and a `SearchResultRow` component (owns the badge/date/snippet row markup at 260-299). `SearchInput` keeps only input + orchestration. |              |
| 11-34       | comments        | medium   | 24-line JSDoc header narrating mount points, spec floor, keyboard behavior, routing — 8x the 3-line budget; reads as archived spec/decision narration ("39-05 (PERF-05)", "matches the spec floor") rather than non-obvious WHY.                                                                                                       | Relocate durable rationale into an openspec spec/doc; leave at most a 1-3 line WHY comment in the file.                                                                                                                       |              |
| 56-67       | comments        | low      | 12-line JSDoc above `targetUrlFor`, a non-exported app-internal helper — over the 3-line budget, narrates decision history ("No `#section-<id>` fragment is emitted...").                                                                                                                                                              | Trim to a single WHY line (why the anchor is stripped); drop the rest or move to spec.                                                                                                                                        |              |
| 137,139,228 | constants       | medium   | Magic values `limit: 20`, `staleTime: 30_000`, and `max-h-[420px]` are inlined with no named constant, unlike `DEBOUNCE_MS`/`MIN_LEN`/`MAX_LEN` extracted just above.                                                                                                                                                                  | Add `RESULT_LIMIT`, `STALE_TIME_MS`, and `MAX_DROPDOWN_HEIGHT_PX` (or CSS var) constants alongside the existing ones.                                                                                                         |              |
| 156-165     | duplication     | medium   | Outside-click-to-close mousedown listener is reimplemented nearly identically here and in `apps/web/src/components/lead/period-navigator.tsx`, `fill-from-button.tsx`, `quick-add-button.tsx`, and `stage-chip.tsx` — five independent copies of the same ref-contains/addEventListener idiom.                                         | Extract a shared `useOnClickOutside(ref, onOutside, enabled)` hook (e.g. `apps/web/src/lib/hooks`) and reuse it from all five call sites.                                                                                     |              |

Already good: solid a11y wiring (combobox/listbox roles, aria-expanded/aria-controls/aria-activedescendant synced with activeIndex, aria-live status regions for loading/error/empty, sr-only input label); snippet rendering avoids `dangerouslySetInnerHTML` by splitting server markers into `<mark>`/`<span>` with a comment explaining why regex-splitting server-controlled literal markers is safe; functional/immutable throughout — no let/reassignment, derived state (`enabled`, `showResults`, `showError`, `showEmpty`, `activeOptionId`) computed inline rather than stashed in extra state/effects.

## Rollup

**By dimension**

- comments: 2 (1 medium, 1 low)
- size-complexity: 1 (high)
- constants: 1 (medium)
- duplication: 1 (medium)

**By severity**

- high: 1
- medium: 3
- low: 1

**Top 3**

1. `SearchInput` function ~188 lines vs 50-line cap (size-complexity, high) — split into hook + list + row components.
2. Outside-click listener duplicated across 5 components (duplication, medium) — extract shared `useOnClickOutside` hook.
3. 24-line archived-spec-style JSDoc header (comments, medium) — relocate rationale to openspec, trim to 1-3 lines.

**Overlap with pending OpenSpec changes**
None. All 5 findings are local style/structure issues in `search-input.tsx` (size, comments, constants, duplication) and don't touch any of the 18 pending change areas (activity feed, publish/archive race, head surface, responsive layout, project reporting, review-acknowledgement, input/error hardening, code-health cleanup, dashboard NaN, chart keys, analytics date matching, web-vitals endpoint, prod build args, open-redirect, quality ratchet, comment policy, domain errors, org-data escaping).

## Killed by verification

- Sub-claim of finding 1: "File is 304 lines, well past the 250-line hard threshold." Killed — the hard threshold excludes blanks and comments; the file has 230 effective lines (74 of 304 are blanks/JSDoc), under the 250 cap. The finding survives only on its function-cap claim (188-line component vs 50-line cap), kept above with corrected wording.
