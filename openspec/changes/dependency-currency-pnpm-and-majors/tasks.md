# Tasks

## Phase 1 — pnpm config fix (security; independently revertable)

- [ ] 1.1 Move `overrides` and `patchedDependencies` from the `package.json`
      `pnpm` field into `pnpm-workspace.yaml`, beside `onlyBuiltDependencies`
      (use the map form for the `samlify@2.13.1` patch path).
- [ ] 1.2 Run `pnpm install`; confirm the "pnpm field is no longer read"
      warning is gone.
- [ ] 1.3 Prove the lockfile still carries the `overrides` block, the
      `samlify@2.13.1` `patchedDependencies` entry, and a resolved `vite >=7.3.2`.
- [ ] 1.4 Commit Phase 1 as a standalone commit.

## Phase 2 — three majors

- [ ] 2.1 `nodemailer` 8→9 in `apps/api/package.json`; `pnpm install`. Keep
      `@types/nodemailer@^8.0.1` (no `@types/nodemailer@9`; nodemailer 9 ships
      no types); confirm `pnpm --filter @customreport/api typecheck` passes and
      record the types-major lag.
- [ ] 2.2 Confirm `email.service.ts` builds unchanged; live Mailpit send via
      `sendMailMultipart` arrives with both multipart halves.
- [ ] 2.3 `@bull-board/api` + `@bull-board/express` 7→8 in lockstep. Verify the
      v8 API surface against `bull-board.module.ts` (incl. the
      `@bull-board/api/bullMQAdapter` subpath import); migrate only the import
      paths/call shapes that actually changed.
- [ ] 2.4 Verify `/admin/queues` mounts head-gated and lists `pdf-export` +
      `email-reminder`; `requireHead` and `new Queue(...)` byte-identical.
- [ ] 2.5 `eslint-plugin-unicorn` 65→68; update any renamed/removed allowlist
      rule in `eslint.config.ts`; `pnpm lint` clean.
- [ ] 2.6 Keep each major a separately revertable commit.

## Phase 3 — react-email migration

- [ ] 3.1 Add `react-email@^6.6.3`. Re-confirm `react-email` exports `render`
      and all imported components, THEN remove `@react-email/components` and
      `@react-email/render` from `apps/api/package.json`.
- [ ] 3.2 Repoint imports in `render-template.ts`, `deadline.template.tsx`,
      `escalation.template.tsx`, and `escalation.template.test.tsx` to
      `react-email`.
- [ ] 3.3 `render-template.test.ts` passes; `renderEmail` returns
      `{subject, html, text}` with both halves for `deadline` and `escalation`.
- [ ] 3.4 Live Mailpit render of both templates shows no visual regression.

## Phase 4 — gates + handoff

- [ ] 4.1 Full gate suite green: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- [ ] 4.2 Report resolved versions, breaking changes encountered, and files
      touched to the user for the merge decision.
- [ ] 4.3 (Out of scope, separate) the ~50 patch/minor bumps via
      `pnpm update -r` as the recorded `dependency-upgrades-minor` batch.
