## 1. Schema + accessor seam (apps/web)

- [ ] 1.1 Add `webEnvSchema` (Zod) for the seven in-scope vars, each field
      wrapping its type in a `z.preprocess` that maps `""` → `undefined` so
      empty→unset is shared by both parse sites (build assert + accessor):
      `SENTRY_DSN` = `z.preprocess(emptyToUndefined, z.url().optional())`; the five
      toggles (`AUTH_STUB`, `CLIENT_LOG_FORWARDING`, `DEV_ROLE_SWITCHER`,
      `DISABLE_DEVTOOLS`, `WEB_VITALS`) = `z.enum(["true","false"]).optional()`
      (behind the same empty→undefined preprocess); `APP_VERSION` =
      `z.string().optional()`. No `.default()` on any field.
- [ ] 1.2 Add `apps/web/src/lib/web-env.ts` accessor: build an explicit object
      literal of full `process.env.NEXT_PUBLIC_*` references and parse through
      `webEnvSchema` (empty→unset already handled in the schema, so no separate
      `nonEmpty` at the call site). Never `schema.parse(process.env)`, never
      destructure/index `process.env`. Parse LAZILY inside a helper called by the
      getters — NOT at module scope — so values are not frozen at first import
      (preserves the env-mutating test timing in `role-switcher.test.tsx`,
      `login-page.client.test.tsx`, `page.test.tsx`); memoization optional but must
      not reintroduce an eager module-scope freeze.
- [ ] 1.3 Expose typed derived getters: five booleans (folding each `=== "true"`
      compare once), plus `appVersion` and `sentryDsn`. TWO getters fold the
      `NODE_ENV !== "production"` guard to match current code — `authStub`
      (`login-page.client.tsx`) AND `devRoleSwitcher` (both `nav-bar.tsx` and
      `role-switcher.tsx` fold it today; dropping it would leak the switcher into a
      production build). The other three toggles are bare `=== "true"`, no fold.
- [ ] 1.4 Unit-test the accessor: malformed toggle rejected, empty string →
      unset, auth-stub false under production, dev-role-switcher false under
      production, DSN url validation; confirm the existing env-mutating suite still
      passes under the lazy getters.

## 2. Build-time assert (apps/web)

- [ ] 2.1 In `apps/web/next.config.ts`, call the schema assert at module load
      (beside the existing top-level `requireApiUrl()`); a malformed value throws and
      fails `next build`. Confirm all-absent env still builds clean, AND that an
      empty-string `NEXT_PUBLIC_SENTRY_DSN` (docker dev passes
      `${NEXT_PUBLIC_SENTRY_DSN_DOCKER:-}` = `""` when unset) passes via the schema's
      empty→unset preprocess rather than tripping `z.url()`.
- [ ] 2.2 Complete `turbo.json` `build.env` for all seven in-scope vars —
      `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_WEB_VITALS`, `NEXT_PUBLIC_DISABLE_DEVTOOLS`
      are currently absent (only 4 of 7 listed). Add the three, OR record explicit
      reliance on Turborepo's `NEXT_PUBLIC_*` framework inference and drop the
      partial list to avoid drift.

## 3. Route the seven consumers through the accessor (apps/web)

- [ ] 3.1 `app/login-page.client.tsx` — `NEXT_PUBLIC_AUTH_STUB` (drop the inline
      `NODE_ENV` guard, now folded) and `NEXT_PUBLIC_APP_VERSION` footer suffix.
- [ ] 3.2 `components/navigation/nav-bar.tsx` and
      `components/dev/role-switcher.tsx` — `NEXT_PUBLIC_DEV_ROLE_SWITCHER` via the
      `devRoleSwitcher` getter, which folds the `NODE_ENV !== "production"` guard
      both sites currently apply (do NOT drop the guard — it stays inside the getter).
- [ ] 3.3 `lib/client-logger.ts` — `NEXT_PUBLIC_CLIENT_LOG_FORWARDING`.
- [ ] 3.4 `lib/web-vitals.ts` — `NEXT_PUBLIC_WEB_VITALS`.
- [ ] 3.5 `components/agentation-devtools.tsx` — `NEXT_PUBLIC_DISABLE_DEVTOOLS`.
- [ ] 3.6 `instrumentation-client.ts` — `NEXT_PUBLIC_SENTRY_DSN` via `sentryDsn`.
- [ ] 3.7 Grep `apps/web/src` + web root for `process.env.NEXT_PUBLIC_` outside
      the accessor and the `NEXT_PUBLIC_API_URL` seam (excluding tests); assert zero
      product-code hits. EXCLUDE the two named out-of-scope server-runtime configs
      `apps/web/sentry.server.config.ts` and `apps/web/sentry.edge.config.ts` — they
      read `NEXT_PUBLIC_SENTRY_DSN` at server runtime (not build-inlined) and are
      deferred by the sibling requirement, so they are expected non-zero hits.

## 4. Planning + docs

- [ ] 4.1 Leave `NEXT_PUBLIC_API_URL` / `API_URL` with `requireApiUrl`; confirm
      the accessor names neither (no `web-api-url-config` collision).
- [ ] 4.2 Record the server-runtime `SENTRY_DSN ?? NEXT_PUBLIC_SENTRY_DSN` chain
      (`sentry.server.config.ts`, `sentry.edge.config.ts`) as an out-of-scope
      follow-up; do not touch it here.
- [ ] 4.3 Note in `docs/handoff/EXEMPLARY-PROGRAM-2026-07-02.md` §8 that
      `add-web-env-schema` is authored (finding 3.1 closed).

## 5. Verification

- [ ] 5.1 Run the gate: `pnpm --filter @customreport/web db:generate` if needed,
      then `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- [ ] 5.2 Manually confirm a malformed `NEXT_PUBLIC_SENTRY_DSN` fails
      `pnpm --filter @customreport/web build` and a clean env builds.
- [ ] 5.3 `openspec validate add-web-env-schema --strict` prints "is valid".
