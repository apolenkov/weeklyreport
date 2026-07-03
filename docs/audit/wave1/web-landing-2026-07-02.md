# Per-file audit — apps/web/src/components/landing (2026-07-02)

Read-only audit, wave 2 web.
4 files, 6 findings kept, 0 killed.

## pulse-background.tsx (1 finding)

| Lines | Dimension | Severity | Finding                                                                                                                                                                                                                                                                                                | Suggestion                                                                                                                                                                                                  | Your verdict |
| ----- | --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 1-14  | comments  | medium   | 14-line JSDoc header narrates removal history ("a third layer used to render an animated ECG/heartbeat SVG trace (Phase 58)... removed 2026-06-23") — pure changelog archaeology, far over the 3-line WHY budget, and CLAUDE.md explicitly says delete phase/ticket refs since git history holds them. | Cut to at most a 1-2 line WHY comment on the still-true fact ("static, no motion — two GPU layers") or drop entirely; the component name/JSX is self-explanatory. Remove the Phase 58/2026-06-23 narrative. |              |

Already good: nothing else flagged in this file.

## pulse-mark.tsx (1 finding)

| Lines | Dimension | Severity | Finding                                                                                                                                                                                                                                       | Suggestion                                                                                                                                                                | Your verdict |
| ----- | --------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 1-14  | comments  | medium   | 13-line JSDoc header repeats the same removed-motif history ("Your PULSE», breathing wordmark, ECG trace, Phase 58 / UFB-058, dropped 2026-06-23") as pulse-background.tsx — duplicated archaeology across two files, over the 3-line budget. | Trim to the one non-obvious fact that still matters (why the file/class names keep the `pulse-` prefix despite showing "Weekly Report" text) in <=3 lines; drop the rest. |              |

Already good: clean a11y pattern — `role="img"` + `aria-label` on the wrapper with `aria-hidden` on the decorative text spans, single-purpose ~13-line component.

## tagline-cycler.tsx (3 findings)

| Lines | Dimension | Severity | Finding                                                                                                                                                                                                                                 | Suggestion                                                                                                                                                                                                                                                           | Your verdict |
| ----- | --------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 1-11  | comments  | medium   | 11-line header mixes a UFB-062 ticket reference, a "History" pointer to another ticket (UFB-058), a TODO(i18n-future), and behavior narration — all things git history / an issue tracker should own, well over the 3-line WHY budget.  | Keep only the load-bearing non-obvious rationale (why setTimeout-chain instead of setInterval) in <=3 lines; move the i18n TODO to a tracked backlog item instead of an inline TODO, drop the ticket IDs.                                                            |              |
| 18-19 | constants | low      | FADE_MS = 250 is duplicated as a raw magic number in apps/web/src/styles/pulse.css line 83 (`transition: opacity 250ms ease-in-out;`). The two values must be kept in sync by hand across a .tsx and a .css file with no shared source. | Either drive the CSS transition duration from a CSS custom property set inline from FADE_MS (e.g. `style={{ '--pulse-fade-ms': `${FADE_MS}ms` }}`), or add a one-line comment in pulse.css pointing at FADE_MS so a future edit to one side isn't silently orphaned. |              |
| 53-59 | a11y      | low      | The tagline text changes every ~3s but the `<p>` has no aria-live region, so screen-reader users get no announcement of the changing copy (and no way to know it's dynamic).                                                            | If the rotation is meant to be perceivable by AT, add `aria-live="polite"`; if it's purely decorative marketing flourish, mark the container `aria-hidden` and ensure a static equivalent tagline exists for AT users instead.                                       |              |

Already good: named VISIBLE_MS/FADE_MS constants instead of inline magic numbers, deterministic setTimeout-chain with cleanup (no leaked timers), and a documented lint-disable for the intentionally non-crypto random start index.

## landing-page.constants.ts (1 finding)

| Lines | Dimension | Severity | Finding                                                                                                                                     | Suggestion                                                                                                                                                           | Your verdict |
| ----- | --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 1-2   | comments  | low      | Header comment carries a ticket reference (UFB-062) — comment-hygiene policy says delete ticket/phase refs, git history already holds that. | Reword as a plain WHY (e.g. "Tagline phrases must stay cadence-neutral — no 'weekly' — since the wordmark above already reads WEEKLY REPORT") without the ticket ID. |              |

Already good: tight, single-purpose constants file with a typed readonly export — correct place for the tagline data.

## Rollup

By dimension: comments 4 (2 medium, 2 low), constants 1 (low), a11y 1 (low).
By severity: medium 2, low 4.

Top-3:

1. pulse-background.tsx 1-14 — 14-line removal-history JSDoc, worst comment-archaeology offender.
2. pulse-mark.tsx 1-14 — duplicate of the same archaeology across a second file.
3. tagline-cycler.tsx 1-11 — ticket refs + inline TODO mixed into a behavior-narration header.

Pending openspec overlap: none of the 18 pending changes touch landing-page comment hygiene, the FADE_MS/pulse.css sync, or the tagline aria-live gap — all 6 findings are a standalone style/hygiene sweep, not covered by any listed change.

## Killed by verification

None — all 6 findings survived verification unchanged.
