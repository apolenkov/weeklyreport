## 1. Shared package — type fix

- [ ] 1.1 Add `priorityRank` to the `LeadKanbanItem` type so it declares what
      `mapLeadItems` emits (verify no `@customreport/shared` consumer breaks).

## 2. API — consolidate duplicated derivations

- [ ] 2.1 Export `computeAllowedGroupIds` (the scope-filter implementation) and
      reuse it in `cross-group-signal.ts`, deleting its local
      `getAllowedGroupIds`.
- [ ] 2.2 Read both on-time-ratio consumers (`telemetry.gauges.ts`,
      `telemetry.prisma-repository.ts`); share one `activeLeadsLastPublishedPeriod`
      query and either collapse to one ratio definition or rename the two so their
      differing windows are explicit.
- [ ] 2.3 Make `published-report-snapshot.ts` the single
      `TrafficLightStatus`-typed `computeWorstStatus` (+ `statusSeverity`); import
      it into `weekly-report.prisma-repository.ts` and delete the string-typed
      `?? 0` duplicate.

## 3. Web — consolidate duplicated derivations

- [ ] 3.1 Extract one `reportHasContent` helper and replace the 6-clause inline
      predicate at all sites (publish gate + accordion render in
      `weekly-report-page.tsx`, and the other inlining sites).

## 4. API — remove dead code (prove-unused first)

- [ ] 4.1 Grep-prove `auth.module.ts` + `jwt.strategy.ts` and the module-level
      `admin.router.ts` / `review.router.ts` are imported only by tests, then
      delete them (or wire one as the single path) and point their tests at the
      live `adminProcedure` / `headProcedure` routers.
- [ ] 4.2 Remove the activity `lastEdit` dead null branch in
      `activity.prisma-repository.ts`.

## 5. Web — remove dead code (prove-unused first)

- [ ] 5.1 Grep-prove and prune unimported components (`ToggleAllButton`,
      `ReportArchiveSection`, `AppShell`); if kept, wire them and restore
      `AppShell`'s dropped children.
- [ ] 5.2 Adopt `server/auth/session.ts` (or a shared constant) in the SSR
      helpers so the cookie name is sourced once, not triplicated.
- [ ] 5.3 Remove the dead tRPC `target` URL object in `lib/trpc.ts` and the
      undeclared `reportId` emitted by `lib/mappers/dashboard.ts`.
- [ ] 5.4 Point `/head/slides` and `/reports/history` redirects at bare
      `/reports` (the merged page ignores the `mode`/`tab` query) and fix the
      stale comments.

## 6. Test infrastructure hygiene

- [ ] 6.1 Decide MSW disposition: either repoint `msw-handlers.ts` at the jsdom
      origin, fix `onUnhandledRequest`, correct the POST batch shape, type the
      factories with `satisfies`, and add a test that relies on it — or delete
      `msw-handlers.ts` plus its `vitest.setup.ts` wiring as unused.
- [ ] 6.2 Enable spy restoration: set `restoreMocks: true` in
      `apps/web/vitest.config.ts` (or `afterEach` `restoreAllMocks`), and make
      `silenceStderr` / `silenceNestLogger` restore the spies they install.
- [ ] 6.3 Fix the `mailpit.ts` docstring to drop the non-existent `pollMailpit`
      reference (and any other test-util docstring that overstates what runs).

## 7. Web — shared dialog focus primitive

- [ ] 7.1 Migrate the non-admin modals (risk / decision / reopen edit dialogs,
      `confirmation-dialog.tsx`, `publish-lock-button.tsx`) onto one shared
      focus-managed primitive (Radix Dialog in `@customreport/ui` or a single
      wrapper) with focus trap + restore-to-trigger; add focus-trap/restore tests.
- [ ] 7.2 Migrate the four admin CRUD dialogs (`users-tab`, `products-tab`,
      `groups-tab`, `periods-tab-dialog`) onto the same primitive, preserving
      observable behavior; keep the existing admin focus regression tests green.
- [ ] 7.3 Fix the `confirmation-dialog.tsx` JSDoc so the focus claim is true of
      the wired code.
- [ ] 7.4 Fix `LockBadge` (make focusable or drop the dead `onFocus`/`onBlur`)
      and `ScopeToggle` (arrow-key roving tabindex, or `role="group"` +
      `aria-pressed`).

## 8. Prisma — align FK onDelete

- [ ] 8.1 In `schema.prisma`, set `Decision` and `StageStatus` project FKs to
      `RESTRICT` (matching `Item`/`Risk`/`ProjectStatus`); keep `StageAssignment`
      `CASCADE`; add a comment that hard product deletion is unsupported.
- [ ] 8.2 Hand-edit `prisma/migrations/20260530162224_init/migration.sql` so its
      `ON DELETE` clauses match the schema; `migrate reset` non-prod DBs and
      regenerate the Prisma client (MVP reshape, not an incremental migration).

## 9. Verification

- [ ] 9.1 Run `pnpm typecheck`.
- [ ] 9.2 Run `pnpm lint`.
- [ ] 9.3 Run `pnpm test`.
- [ ] 9.4 Run `pnpm build`.
- [ ] 9.5 Grep-confirm the deleted duplicates/dead code leave zero references
      (`getAllowedGroupIds`, the string-typed worst-status copy, the inline
      `reportHasContent` predicate, pruned components/redirect queries).
