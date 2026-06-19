# Tasks

## Phase 1 — pnpm config fix (security; independently revertable)

- [x] 1.1 Move `overrides` and `patchedDependencies` from the `package.json`
      `pnpm` field into `pnpm-workspace.yaml`, beside `onlyBuiltDependencies`
      (use the map form for the `samlify@2.13.1` patch path).
- [x] 1.2 Run `pnpm install`; confirm the "pnpm field is no longer read"
      warning is gone.
- [x] 1.3 Prove the lockfile still carries the `overrides` block, the
      `samlify@2.13.1` `patchedDependencies` entry, and a resolved `vite >=7.3.2`.
      (lockfile byte-unchanged after install — strongest possible proof)
- [x] 1.4 Commit Phase 1 as a standalone commit. (17af95ca)

## Phase 2 — three majors

- [x] 2.1 `nodemailer` 8→9 in `apps/api/package.json`; `pnpm install`. Keep
      `@types/nodemailer@^8.0.1` (no `@types/nodemailer@9`; nodemailer 9 ships
      no types); confirm `pnpm --filter @customreport/api typecheck` passes and
      record the types-major lag. (a94ac81d)
- [x] 2.2 Confirm `email.service.ts` builds unchanged (typecheck pass; only
      `secure:false` SMTP + `jsonTransport`, none of the 9.0 TLS-validated paths).
      DEFERRED runtime: live Mailpit `sendMailMultipart` send (needs running
      SMTP+Mailpit; ports held by parallel session).
- [x] 2.3 `@bull-board/api` + `@bull-board/express` 7→8 in lockstep. v8 API
      surface verified against `bull-board.module.ts` (createBullBoard, the
      `@bull-board/api/bullMQAdapter` subpath export present in v8, ExpressAdapter
      setBasePath/getRouter) — typechecks with no code change. No v7 residual. (35835696)
- [~] 2.4 `/admin/queues` wiring byte-identical and typecheck-proven on v8.
  DEFERRED runtime: live head-gated mount + queue listing (needs running API).
- [x] 2.5 `eslint-plugin-unicorn` 65→68; allowlist migrated: v68 renamed
      `prefer-dom-node-dataset` to `dom-node-dataset` (old name is a no-op stub
      ESLint loads silently — adversarial review caught it, the initial lint pass
      did not). Renamed the entry; the now-active rule surfaced 21 pre-existing
      `getAttribute('data-*')` violations across 7 test files, all migrated to
      `.dataset` (with `HTMLElement` typing where the element was `Element`).
      `pnpm lint` clean, no rule silenced. (0f27eac6 + review-fix commit)
- [x] 2.6 Keep each major a separately revertable commit. (3 commits above)

## Phase 3 — react-email migration

- [x] 3.1 Add `react-email@^6.6.3`. Re-confirmed (via dist/index.mjs) it exports
      `render` and all 10 imported components, THEN removed `@react-email/components`
      and `@react-email/render` from `apps/api/package.json` + lockfile.
- [x] 3.2 Repoint imports in `render-template.ts`, `deadline.template.tsx`,
      `escalation.template.tsx`, and `escalation.template.test.tsx` to `react-email`.
- [x] 3.3 `render-template.test.ts` passes; `renderEmail` returns
      `{subject, html, text}` with both halves for `deadline` and `escalation`.
      Escalation snapshot updated: react-email 6 emits improved-but-equivalent
      HTML (adds <title>, dir/lang, relocates Container padding table→td);
      content byte-identical.
- [x] 3.4 Visual no-regression confirmed: both templates rendered to standalone
      HTML and screenshotted in Chrome — card layout, branding, button, list all
      correct. (Standalone render in lieu of Mailpit to avoid port contention.)

## Phase 4 — gates + handoff

- [x] 4.1 Full gate suite green: `pnpm typecheck` (5/5), `pnpm lint`
      (No issues found), `pnpm test` (1208 web + api/shared/ui), `pnpm build` (5/5).
- [x] 4.2 Report resolved versions, breaking changes, files touched to the user
      for the merge decision.
- [ ] 4.3 (Out of scope, separate) the ~50 patch/minor bumps via
      `pnpm update -r` as the recorded `dependency-upgrades-minor` batch.
