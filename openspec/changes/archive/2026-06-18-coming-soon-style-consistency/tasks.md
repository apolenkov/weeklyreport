# Tasks

- [x] 1. NO aria-label change. (Original task reverted: the
     `HolidaysComingSoonControl` aria-label was deliberately removed by the
     archived `2026-06-10` `verify-a11y-recommended-flip` change; the deferred
     state is already in the tab button's accessible name. See proposal
     "Correction to the original premise".)
- [x] 2. Add a regression test asserting the single canonical Coming-Soon style:
     render the deferred controls and assert every `[data-state="coming-soon"]`
     badge carries the canonical amber tokens (`bg-amber-100` / `text-amber-700`)
     and that the Agent-review placeholder badge matches the nav-bar controls'
     badge. Prove teeth: a divergent badge must fail it.
- [x] 3. Add a guard test that no "Coming Soon" _rendered text_ exists outside
     the shared `ComingSoonBadge` primitive (scan source for bespoke pills;
     `title="Coming Soon"` attributes are allowed, rendered label text is not).
     Prove teeth: a temporary bespoke pill must fail it.
- [x] 4. Add a regression test pinning the Holidays announced state: the
     holidays tab's computed accessible name contains "Coming Soon" (badge-in-
     button mechanism), and the inert holidays span carries no `aria-label`.
- [x] 5. Do NOT restyle any existing badge — they are already identical
     (verified live). No color change to Agent review or others.
- [x] 6. Gates green (typecheck, lint, test).

## Documented follow-up (NOT in this change — needs explicit go-ahead)

- Extract the duplicated Family-1 wrapper (`group relative inline-flex` + inert
  host + positioned badge, copy-pasted across AgentReviewComingSoon,
  PdfExportComingSoonControl, VersionComingSoonControl, Language/Theme/Holidays
  controls) into one shared `ComingSoonControl` primitive so the style cannot
  drift and the aria-label is enforced by construction. This is a refactor of
  working code; leave it as a follow-up unless the user asks for it.
