# Tasks — Driver Findings, Lead Role (2026-06-12)

NOT STARTED — captured by hand from run `wf_d2d739f7-3a7` after the weekly
limit killed the driver's own consolidation step. Re-verify every finding in
the live browser (:3000, dev-login as lead) BEFORE committing its fix — the
driver skeptic is fallible in both directions.

Before starting, re-run `git status --short` and `openspec list`.

## Low-risk (fix tonight)

- [ ] 1.1 Reproduce finding 1 in the browser: search on `/reports`, click a
      result, confirm the `#section-<id>` anchor does not scroll to the section.
- [ ] 1.2 Either render an `id="section-<id>"` target on each lead-form section
      or strip the dead `#section-<id>` fragment from the search result link —
      pick the cheaper truthful fix. Add a test.
- [ ] 1.3 Reproduce finding 2: confirm "Current Week · 1 items" in the product
      accordion at a single-item period.
- [ ] 1.4 Pluralize the noun (1 item / N items) via the existing i18n/plural
      helper if one exists, else a local guard. Add/extend a unit test.
- [ ] 1.5 Gates: `pnpm typecheck && pnpm lint` + vitest for the touched web
      package. Commit (own files only, conventional message naming this change).

## Risky (morning confirmation — do NOT start without a decision)

- [ ] 2.1 Finding 3 (raw Zod JSON on bad reportId): confirm the leak and the
      3× retry on 400. Proposed fix = friendly error surface + disable retry on
      4xx. Needs sign-off that no other route relies on that retry.
- [ ] 2.2 Finding 4 (lead preview shows all 11 products): BLOCKED on the open
      question — is the preview the unified report or the lead's section? No
      code change until answered.
- [ ] 2.3 Finding 5 (export-PDF catalog intents vs hidden button): decide
      whether leads should have Export-PDF. If no → fix the driver oracle
      catalog, not the app. If yes → separate feature change.

## Notes

- This change is lead-role only. head / admin / viewer driver runs are pending
  the weekly-limit reset (2026-06-13 12:00 Europe/Moscow) and may add findings.
- Capture-only until 1.x lands; the 2.x section stays open for the morning.
