# Tasks

Gates after every step: `pnpm typecheck && pnpm lint && pnpm test`.

## Pre-flight

- [ ] Read the v7 migration notes for `@bull-board/api` and
      `@bull-board/express` (release notes / CHANGELOG for the 6.x -> 7.x jump);
      record the exact changes to `createBullBoard`, `BullMQAdapter`, the
      `@bull-board/api/bullMQAdapter` subpath, and `ExpressAdapter`
      construction / `setBasePath` / `getRouter`.
- [ ] Confirm `@bull-board/*` is declared in no workspace other than
      `apps/api/package.json` (grep the repo) so this stays isolated.

## Bump (lockstep)

- [ ] Set `@bull-board/api` to `^7.1.5` in `apps/api/package.json`.
- [ ] Set `@bull-board/express` to `^7.1.5` in `apps/api/package.json`
      (same major as `@bull-board/api` — they must not diverge).
- [ ] `pnpm install` to refresh `pnpm-lock.yaml`; confirm both packages resolve
      to a single 7.x line and no v6 copy of `@bull-board/*` remains in the tree.

## Migrate the consumer

- [ ] Update `apps/api/src/infrastructure/bullmq/bull-board.module.ts` to the v7
      API: fix the `createBullBoard`, `BullMQAdapter`
      (`@bull-board/api/bullMQAdapter` subpath), and `ExpressAdapter` imports and
      call shapes per the migration notes. Keep the `serverAdapter.setBasePath`,
      `serverAdapter.getRouter()`, and `expressApp.use("/admin/queues", ...)`
      wiring behaviorally identical.
- [ ] Leave the head-role `requireHead` middleware and the direct
      `new Queue(...)` construction unchanged (out of scope for this bump).

## Verify

- [ ] `pnpm typecheck` — no type errors from the new adapter/registration types.
- [ ] `pnpm lint` (api lint also runs `tsc --noEmit`).
- [ ] `pnpm test`.
- [ ] `pnpm build`.
- [ ] Smoke-check the board mounts: start the API and confirm `/admin/queues`
      returns 401/403 without a head session and renders the v7 UI with one,
      listing the `pdf-export` and `email-reminder` queues.
- [ ] Run `pnpm lint:md` for the planning docs.
- [ ] `openspec validate upgrade-bull-board-api-major --strict` passes.
