# Per-file audit — apps/web/src/app/(app)/admin (2026-07-02)

Read-only audit, wave 2 web.
5 files scanned: 5 kept, 2 killed by verification.
No code changes made.

## layout.tsx (2 findings)

| Lines | Dimension   | Severity | Finding                                                                                                                                                                                                                                                                                                                                                                | Suggestion                                                                                                                                                                                                                                                                                                                                                           | Your verdict |
| ----- | ----------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 6-17  | comments    | medium   | 12-line JSDoc block full of ticket/phase archaeology (AUTH-07, Phase 29-03, UFB-038, Phase 27/29-01 references) — far over the 3-line WHY budget and exactly the narration the tighten-comment-policy forbids. The same boilerplate JSDoc (same AUTH-07/Phase-29-03 refs, same shape) is copy-pasted into head/layout.tsx, lead/layout.tsx and reports/layout.tsx too. | Trim to <=3 lines capturing only the durable WHY that code can't express ("UX gate only — api role middleware is the real boundary"); delete AUTH-07/Phase-29-03/UFB-038 refs (git history has them). If the rationale is load-bearing across all 4 layouts, relocate it once to openspec/specs and link from each file instead of repeating a JSDoc essay per file. |              |
| 1-24  | duplication | low      | admin/layout.tsx, head/layout.tsx, lead/layout.tsx and reports/layout.tsx are four near-identical files: same imports, same Props type, same `<RoleGate allowedRoles={REQUIRED}>{children}</RoleGate>` body — only the REQUIRED role array and function name differ.                                                                                                   | Extract a shared factory in components/role-gate.tsx, e.g. `createRoleGateLayout(roles: readonly Role[])`, and have each route's layout.tsx be a one-line `export default createRoleGateLayout(["admin"])`-style call instead of restating the wrapper boilerplate four times.                                                                                       |              |

Already good: correctly separates the SSR UX-gate from the real security boundary (api role middleware) instead of pretending the client layout is authoritative.

## page.tsx (3 findings)

| Lines          | Dimension   | Severity | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Suggestion                                                                                                                                                                                                                                                                                                              | Your verdict |
| -------------- | ----------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 10-17,47,50-52 | comments    | medium   | Multiple comment blocks carry phase/ticket archaeology ("Phase 35-06", "UFB-052 (Phase 51-B)", "MOB-04 (Phase 30-05)", "ADM-1 (Phase 33-04)") describing tab-ordering rationale and mockup refs — narration the comment policy explicitly bans, and several exceed the 3-line budget.                                                                                                                                                                                | Delete the ticket/phase prefixes; keep at most a 1-2 line WHY for genuinely non-obvious ordering decisions (e.g. "products → periods → reminders mirrors the data flow"), drop mockup/ticket citations.                                                                                                                 |              |
| 64             | constants   | low      | `style={{ minHeight: "44px" }}` is an inline magic touch-target size with no name/doc, sitting next to an otherwise all-Tailwind className.                                                                                                                                                                                                                                                                                                                          | Replace with a Tailwind `min-h-11` (or the project's existing touch-target token) or a named, documented constant (e.g. `MIN_TOUCH_TARGET_PX = 44 // WCAG 2.5.5 target size`) instead of an ad hoc inline style.                                                                                                        |              |
| 53-77          | duplication | low      | The desktop tab pill-row hand-rolls a rounded-pill track + active/inactive segment classes as a 5-line inline template literal in JSX, even though the repo already owns a shared idiom for exactly this shape: `SegmentedToggle`/`segmentClassName` in components/report-shell/segmented-toggle.tsx (track, pill radius, active/inactive fill, toolbar height). The admin nav re-implements it with its own literal instead of reusing or extending that primitive. | If the brand-accent look must differ from `segmentClassName`'s toggle-active look, still pull the class logic out into a small named helper (e.g. `adminTabClassName(active)`) colocated near AdminTabsNav, rather than an inline ternary literal embedded in the JSX map — keeps the component scannable and testable. |              |

Already good: clean TabId narrowing with a safe fallback (`tabs.includes(tab as TabId) ? ... : "users"`) guards against an arbitrary ?tab= query value reaching AdminPanel.

## products/page.tsx (1 finding)

| Lines | Dimension | Severity | Finding                                                                                                                                      | Suggestion                                                                                                                                                          | Your verdict |
| ----- | --------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 3-9   | comments  | low      | 5 content lines of JSDoc rationale for a 12-line file, over the 3-line WHY budget (though content is legitimate rationale, not archaeology). | Trim to a single sentence: "Thin alias — canonical rendering lives in ../page.tsx (AdminPanel tabs); this route just makes /admin/products a stable, testable URL." |              |

Already good: exemplary thin-alias pattern — single responsibility (redirect), tiny, correctly typed `never` return, no logic duplication with the canonical /admin?tab=products route.

## settings/page.tsx — clean

Already good: same clean thin-alias pattern as products/page.tsx, explicitly points to the sibling instead of re-explaining.

## Rollup

**By dimension:**

- comments: 3 (2 medium, 1 low)
- duplication: 2 (both low)
- constants: 1 (low)

**By severity:**

- medium: 2
- low: 4

**Top 3:**

1. layout.tsx 6-17 — ticket/phase archaeology JSDoc, duplicated verbatim across 4 route layouts (medium).
2. page.tsx 10-17,47,50-52 — same archaeology pattern (Phase/UFB/MOB/ADM refs) across tab-ordering comments (medium).
3. layout.tsx 1-24 — 4 near-identical RoleGate layout files begging for a shared factory (low, but highest duplication payoff).

**Overlap with pending OpenSpec changes:**

- The two comment-archaeology findings (layout.tsx 6-17, page.tsx 10-17/47/50-52) fall squarely under **tighten-comment-policy** — handle there, not as an ad hoc cleanup here.
- No other finding overlaps a pending change (duplication and constants findings are plain style-sweep territory, not covered by any listed pending change).

## Killed by verification

- **admin/page.tsx lines 31-87, size-complexity**: claimed AdminPage body was 53 non-blank/non-comment lines (over the <=50 cap). Recounted from source: the function spans 57 physical lines (31-87) with 4 blank lines (36, 46, 49, 78) and 5 comment lines (47, 50-52, 79), leaving 48 code lines — under the cap. The claimed 53 appears to have counted comment lines as code. Killed: not actually a threshold violation.
- **admin/settings/page.tsx lines 3-6, comments**: claimed "4-line comment, one line over the 3-line budget." The 4 physical lines include the `/**` and `*/` delimiters; actual rationale content is 2 lines (thin-alias WHY + pointer to the sibling). A <=3-line WHY is explicitly allowed, and this is the exact compact cross-reference form the products/page.tsx finding recommends as the target state. Killed: false positive.
