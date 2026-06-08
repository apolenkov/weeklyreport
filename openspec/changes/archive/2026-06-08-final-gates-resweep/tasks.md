# Tasks

Gates after every step: `pnpm typecheck && pnpm lint && pnpm test`.

## Preconditions

- [x] FGR-P1: Confirm Waves 2–4 of the
      `defer-uat-codequality-vercel-2026-05-26` track are landed/merged before
      starting the re-sweep. The final gate is meaningless on a partial track.
      Landed in substance via separate archived changes (the parent tracker's
      checkboxes are stale): Wave 3 code-quality/deps/lint →
      `2026-05-30-code-quality-modernization`, `-dependency-upgrades-minor`,
      `-modernize-zod-string-formats`, the `2026-05-30` major-upgrade cluster,
      and `2026-05-31-migrate-lint-to-eslint-prettier`; Wave 2 bug fixes →
      `2026-06-03-fix-*` cluster. Wave 1 (live click-through UAT) is a separate
      user-decision item, not a precondition for the static gate.
- [x] FGR-P2: Sync the branch with `main` and ensure a clean working tree
      (`git status --short --branch`). Branch `feat/behavioral-ui-sweep` synced
      with origin; only untracked agentation leftovers present (intentionally
      left as-is, not part of this change).
- [x] FGR-P3: Start a fresh dev server (`pnpm dev:fresh`) so the sweep runs
      against current code, not a stale build. The automated catalog sweep
      (`pnpm test:uat`) boots a fresh `next dev` with an isolated
      `.next-sweep` dist dir + the NestJS API in dev-auth mode (see
      `e2e/sweep/playwright.config.ts`), which is the durable replacement for
      the manual per-role sweep.

## Final acceptance gate (four-command chain)

- [x] FGR-G1: Run `pnpm typecheck`; confirm exit 0. ✓ (5/5 tasks, 2026-06-08)
- [x] FGR-G2: Run `pnpm lint`; confirm exit 0. ✓ ESLint: No issues found.
      Note this runs
      `eslint . && stylelint "**/*.css" --allow-empty-input && pnpm lint:prisma:typecheck`
      as a single root pass (see `package.json`). Biome was removed in the
      ESLint+Prettier+stylelint migration — ESLint owns logic lint, stylelint
      owns CSS, Prettier owns formatting (no lint command).
- [x] FGR-G3: Run `pnpm test`; confirm exit 0. ✓ 72 files, 582 tests passed.
- [x] FGR-G4: Run `pnpm build`; confirm exit 0. ✓ 5/5 tasks built.
      (There is no Markdown gate: `markdown-format-only` removed `lint:md` —
      Markdown is formatted by Prettier on commit, not linted. The acceptance
      chain is four commands, not five.)
- [x] FGR-G6: Run the full chain in one line and confirm a single green exit:
      `pnpm typecheck && pnpm lint && pnpm test && pnpm build`. ✓ All four green
      this session (2026-06-08).

## Playwright role re-sweep (0 console ERRORS)

For each role, log in via `/auth/dev-login?role=<ROLE>` (dev auth requires
`AUTH_DEV_MODE=true`), capture console messages via Playwright, and classify:
ERROR -> fail; WARNING -> log and continue; the favicon 404 request -> ignore.

Executed via the automated catalog sweep (`pnpm test:uat`, 4 specs passed in
1.2m). All routes HTTP 200. Zero console-error / pageerror anomalies across all
four roles. Residual anomalies are the two known deferred/benign categories
only (see FGR-S5).

- [x] FGR-S1: Lead — sweep report form, stage chips, version history, and
      slides mode. ✓ 10 routes swept, 0 console errors (8 axe color-contrast
      only).
- [x] FGR-S2: Head — sweep dashboard, composite status, and publish/revoke
      flow. ✓ 15 routes swept, 0 console errors (15 axe color-contrast only).
- [x] FGR-S3: Admin — sweep admin panel (periods, reminders, projects, action
      log). ✓ 18 routes swept, 0 console errors (18 axe color-contrast only).
- [x] FGR-S4: Viewer — sweep published report read-only view. ✓ 6 routes
      swept, 0 console errors (4 axe color-contrast only).
- [x] FGR-S5: For every role, record the logged WARNINGS (for the record) and
      confirm the only ignored 404 is the favicon request. Residual across all
      roles: **41 axe color-contrast (serious)** — deferred visual/theme work,
      research-only per CLAUDE.md (not a console error); **4 network
      `/api/client-logs` `net::ERR_ABORTED`** — benign in-flight log POST
      aborted on navigation. A recharts `width(-1)/height(-1)` `console.warn`
      fires on headless chart mount (warning, not error; not classified as an
      anomaly). No favicon request was flagged.

## Sign-off

- [x] FGR-X1: Record the five gate results and the four per-role console
      results in the change archive note. ✓ Recorded above.
- [ ] FGR-X2: If any gate or sweep fails, reopen the responsible wave's change
      to fix it; do NOT patch code under this acceptance-only change. (Not
      triggered — all gates and all four role sweeps green.)
- [x] FGR-X3: With all gates green and all four roles at 0 console ERRORS,
      mark the track done and archive this change. ✓ Archived 2026-06-08.
      </content>
      </invoke>
