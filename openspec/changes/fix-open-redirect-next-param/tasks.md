## 1. Web landing page guard

- [ ] 1.1 Replace `sanitizeNext` in `apps/web/src/app/login-page.client.tsx` with an SSR-safe same-origin check that does NOT read `window` during render: parse the candidate against a fixed in-code sentinel base (`new URL(value, "https://app.invalid")`), accept only when `resolved.origin` still equals the sentinel, and return `resolved.pathname + resolved.search + resolved.hash` (a relative path, never an absolute href), plus defense-in-depth rejection of leading `//`, `/\`, and second char `/`|`\`; fall back to the role default on failure
- [ ] 1.2 Confirm the auto-redirect (`window.location.replace`) and the SSO `next` query both consume the validated value only
- [ ] 1.3 Verify no hardcoded Russian and no new lint/type errors in the changed file

## 2. API auth-route guards

- [ ] 2.1 Add a shared same-origin validation helper for the auth routes that resolves against `new URL(env.FRONTEND_URL).origin`
- [ ] 2.2 Harden the AUTH_DEV_MODE SAML short-circuit guard (currently `startsWith('/') && !includes('://')`) to use the helper
- [ ] 2.3 In dev-login, validate the `redirect` query param with the helper and construct the final redirect URL with the same parser (`new URL(validatedPath, frontendUrl)`), eliminating the concatenation differential; fall back to the role default on failure

## 3. Regression tests

- [ ] 3.1 Web unit tests for `sanitizeNext`: accept `/lead/report`; reject `/\evil.com`, `//evil.com`, `https://evil.com`; empty → role default
- [ ] 3.2 API route tests for the SAML dev short-circuit: `next=/\evil.com` forwards the role default
- [ ] 3.3 API route tests for dev-login (independently user-controlled — direct `/auth/dev-login?redirect=…` hits, not only via the SAML short-circuit): `redirect=@evil.com` resolves on-origin; `redirect=/\evil.com`, `redirect=//evil.com`, `redirect=https://evil.com` each fall back to the role default; `redirect=/admin` redirects to `/admin`

## 4. Verification

- [ ] 4.1 Run `pnpm typecheck`, `pnpm lint`, and the new tests; all green
- [ ] 4.2 Run `openspec validate "fix-open-redirect-next-param" --strict` and confirm it passes
