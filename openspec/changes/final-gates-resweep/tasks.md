# Tasks

Gates after every step: `pnpm typecheck && pnpm lint && pnpm test`.

## Preconditions

- [ ] FGR-P1: Confirm Waves 2–4 of the
      `defer-uat-codequality-vercel-2026-05-26` track are landed/merged before
      starting the re-sweep. The final gate is meaningless on a partial track.
- [ ] FGR-P2: Sync the branch with `main` and ensure a clean working tree
      (`git status --short --branch`).
- [ ] FGR-P3: Start a fresh dev server (`pnpm dev:fresh`) so the sweep runs
      against current code, not a stale build.

## Final acceptance gate (five-command chain)

- [ ] FGR-G1: Run `pnpm typecheck`; confirm exit 0.
- [ ] FGR-G2: Run `pnpm lint`; confirm exit 0. Note this runs
      `biome check . && eslint . && pnpm lint:prisma:typecheck` as a single root
      pass (see `package.json`) — Biome owns lint+format, residual ESLint keeps
      only the rules Biome cannot replace.
- [ ] FGR-G3: Run `pnpm test`; confirm exit 0.
- [ ] FGR-G4: Run `pnpm build`; confirm exit 0.
      (There is no Markdown gate: `markdown-format-only` removed `lint:md` —
      Markdown is formatted by Prettier on commit, not linted. The acceptance
      chain is four commands, not five.)
- [ ] FGR-G6: Run the full chain in one line and confirm a single green exit:
      `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.

## Playwright role re-sweep (0 console ERRORS)

For each role, log in via `/auth/dev-login?role=<ROLE>` (dev auth requires
`AUTH_DEV_MODE=true`), capture console messages via Playwright, and classify:
ERROR -> fail; WARNING -> log and continue; the favicon 404 request -> ignore.

- [ ] FGR-S1: Lead — sweep report form, stage chips, version history, and
      slides mode. Capture console; assert 0 ERRORS.
- [ ] FGR-S2: Head — sweep dashboard, composite status, and publish/revoke
      flow. Capture console; assert 0 ERRORS.
- [ ] FGR-S3: Admin — sweep admin panel (periods, reminders, projects, action
      log). Capture console; assert 0 ERRORS.
- [ ] FGR-S4: Viewer — sweep published report read-only view. Capture console;
      assert 0 ERRORS.
- [ ] FGR-S5: For every role, record the logged WARNINGS (for the record) and
      confirm the only ignored 404 is the favicon request.

## Sign-off

- [ ] FGR-X1: Record the five gate results and the four per-role console
      results in the change archive note.
- [ ] FGR-X2: If any gate or sweep fails, reopen the responsible wave's change
      to fix it; do NOT patch code under this acceptance-only change.
- [ ] FGR-X3: With all gates green and all four roles at 0 console ERRORS,
      mark the track done and archive this change.
