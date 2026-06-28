## 1. Production compose — add web build args

- [ ] 1.1 In `docker-compose.prod.yml`, add a `build.args` block under
      `web.build` with `NEXT_PUBLIC_AUTH_STUB: "false"`,
      `NEXT_PUBLIC_DEV_ROLE_SWITCHER: "false"`, and
      `NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL}` (no fallback default).
- [ ] 1.2 Confirm that `docker-compose.yml` and `docker-compose.dev.yml` retain
      their existing explicit `NEXT_PUBLIC_AUTH_STUB: "true"` build args (no
      change needed — verify by inspection).

## 2. Login page — NODE_ENV guard on AUTH_STUB

- [ ] 2.1 In `apps/web/src/app/login-page.client.tsx`, update line 18 from
      `const AUTH_STUB = process.env.NEXT_PUBLIC_AUTH_STUB === "true";` to
      `const AUTH_STUB = process.env.NEXT_PUBLIC_AUTH_STUB === "true" && process.env.NODE_ENV !== "production";`
- [ ] 2.2 Coordinate with the `fix-open-redirect-next-param` implementer: apply
      this change first (or merge both `login-page.client.tsx` edits in one
      commit) to avoid a merge conflict.

## 3. Documentation

- [ ] 3.1 In `.env.example`, add a comment block for the three required
      production web build args (`NEXT_PUBLIC_AUTH_STUB`, `NEXT_PUBLIC_DEV_ROLE_SWITCHER`,
      `NEXT_PUBLIC_API_URL`) with a note that these must be supplied in
      `docker-compose.prod.yml` `build.args` at deploy time.
- [ ] 3.2 Add a comment in `docker-compose.prod.yml` above the new `build.args`
      block explaining that `NEXT_PUBLIC_*` values are inlined at build time and
      cannot be overridden at runtime.

## 4. Verification

- [ ] 4.1 Run `pnpm typecheck && pnpm lint && pnpm test` — all gates must pass.
- [ ] 4.2 Build the production web image locally:
      `NEXT_PUBLIC_API_URL=https://api.example.com docker compose -f docker-compose.prod.yml build web`
      and confirm the build completes without error.
- [ ] 4.3 Start the production web container and open `/` in a browser; confirm
      the login page shows "Sign in with SSO" and does not show the dev-login
      picker or "Enter Application" CTA.
- [ ] 4.4 In the browser Network tab, confirm tRPC requests target the supplied
      `NEXT_PUBLIC_API_URL` origin, not `localhost`.
- [ ] 4.5 Confirm that `docker compose up` (base dev) still shows the dev-login
      picker — dev auth stub must be unaffected.
