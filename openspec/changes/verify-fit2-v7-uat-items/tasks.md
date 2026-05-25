# Tasks

- [ ] T1: Verify risk-severity persistence — load a risk, edit severity, save,
      reload, confirm enum hasn't drifted
- [ ] T2: Verify lock-badge shows correct author — open a foreign-author lead
      section, inspect the badge, confirm `draftSection.authorName` ≠
      `currentUser.name`, badge shows foreign author name
- [ ] T3: Verify status-pill reset after submission — submit a lead section as
      author, reload as head, confirm status pill shows "Draft" not "Submitted"
- [ ] T4: Test cross-author multi-tab sync — edit a section in Tab A, switch to
      Tab B (same report), confirm lock badge renders; check reload behavior
- [x] T5: Run UAT Playwright spec — `pnpm test:uat` should exit 0 with all 45+
      tests passing (22/22 pass via `cd apps/web && pnpm exec playwright test
    e2e/regression-uat-v7.spec.ts --project=chromium`)
- [x] T-V: Verification — `pnpm typecheck` ✓, `pnpm lint` ✓,
      `pnpm test` ✓ (569 pass); e2e regression 22/22 green
