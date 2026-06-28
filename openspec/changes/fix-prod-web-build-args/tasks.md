## 1. Production compose — add web build args

- [ ] 1.1 In `docker-compose.prod.yml`, add a `build.args` block under
      `web.build` with `NEXT_PUBLIC_AUTH_STUB: "false"`,
      `NEXT_PUBLIC_DEV_ROLE_SWITCHER: "false"`,
      `API_URL: http://api:3001` (a fixed literal — the internal service origin
      for the build-time-baked `next.config.ts` rewrites; NOT interpolated from
      `${API_URL}`, because a stray operator/shell `API_URL` such as
      `http://localhost:3002` would otherwise be baked permanently and preserve
      the rewrite failure this change eliminates), and
      `NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:?NEXT_PUBLIC_API_URL must be set}`
      (required-error interpolation so an unset value fails the build hard,
      rather than the bare `${NEXT_PUBLIC_API_URL}` form which Compose
      substitutes as empty with only a warning).
- [ ] 1.2 Keep the existing runtime `environment:` block on the `web` service
      (`API_URL`, `NEXT_PUBLIC_API_URL`) — the new `build.args` are additive.
      The runtime values still serve the server-side consumers
      (`resolveApiUrl` in `get-server-session.ts` reads `API_URL` at runtime);
      the build args additionally bake the rewrites and the client-inlined
      `NEXT_PUBLIC_API_URL`.
- [ ] 1.3 Confirm that `docker-compose.yml` and `docker-compose.dev.yml` retain
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

- [ ] 3.1 In `.env.example`, add a comment block for the production web build
      args: `NEXT_PUBLIC_AUTH_STUB` and `NEXT_PUBLIC_DEV_ROLE_SWITCHER` (set to
      `false` in prod), `NEXT_PUBLIC_API_URL` (required public origin, no
      default). Note that these are consumed by `docker-compose.prod.yml`
      `build.args` at build time. `API_URL` is documented as a runtime-only env
      knob (it feeds the runtime `environment:` block, defaulting to
      `http://api:3001`); it is NOT a build input — the build arg for the baked
      rewrites is a fixed literal `http://api:3001`, not driven by this var.
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
- [ ] 4.4 In the browser Network tab, confirm tRPC requests go to the
      same-origin `/trpc` path (the client uses a relative URL) and that the
      Next.js rewrite proxies them to the internal API — not a 502/404 from a
      stale `http://api:3002` rewrite destination.
- [ ] 4.5 Confirm the build fails fast when `NEXT_PUBLIC_API_URL` is unset:
      running the prod build with no `NEXT_PUBLIC_API_URL` in the environment
      must error out (the `:?` required-error interpolation), not warn and
      proceed with an empty value.
- [ ] 4.6 Confirm that `docker compose up` (base dev) still shows the dev-login
      picker — dev auth stub must be unaffected.
