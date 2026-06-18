# Tasks

- [ ] 1. Add an `aria-label="Holiday management is coming soon"` (or matching
     wording) to `HolidaysComingSoonControl` in
     `apps/web/src/components/admin/settings-tab.tsx`, keeping the existing
     `title="Coming Soon"`.
- [ ] 2. Add a regression test asserting the single canonical Coming-Soon style:
     render a surface (or each control) and assert every `[data-state="coming-soon"]`
     badge resolves to the same foreground/background, and that the Agent-review
     placeholder badge matches the nav-bar controls' badge.
- [ ] 3. Add a guard (test or lint/grep check) that no "Coming Soon" text is
     rendered outside the shared `ComingSoonBadge` primitive.
- [ ] 4. Do NOT restyle any existing badge — they are already identical
     (verified live). No color change to Agent review or others.
- [ ] 5. Gates green (typecheck, lint, test).

## Documented follow-up (NOT in this change — needs explicit go-ahead)

- Extract the duplicated Family-1 wrapper (`group relative inline-flex` + inert
  host + positioned badge, copy-pasted across AgentReviewComingSoon,
  PdfExportComingSoonControl, VersionComingSoonControl, Language/Theme/Holidays
  controls) into one shared `ComingSoonControl` primitive so the style cannot
  drift and the aria-label is enforced by construction. This is a refactor of
  working code; leave it as a follow-up unless the user asks for it.
