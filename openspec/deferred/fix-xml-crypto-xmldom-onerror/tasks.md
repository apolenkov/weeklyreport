# Tasks

- [ ] T1: `pnpm patch xml-crypto@6.1.2` and apply the same
      `wrapDOMParserWithDefaultMimeType` wrapper that lives in
      `patches/samlify@2.13.1.patch`. Patch at the module level so all 11
      call sites inherit the default.
- [ ] T2: Run `cd apps/api && pnpm exec vitest run src/modules/auth/saml.samlify.test.ts`
      — must pass without skip.
- [ ] T3: Remove the `**/saml.samlify.test.ts` exclude in
      `apps/api/vitest.config.ts` and the `describe.skip` in the test file.
- [ ] T4: Run the full `pnpm --filter @customreport/api test` suite to
      catch any regression in production SAML paths (@node-saml uses the
      same xml-crypto).
- [ ] T5: Add a Playwright SAML e2e if missing — `apps/web/playwright/`
      currently has no SAML coverage. Without one, we have no proof the
      patch didn't break prod login.
- [ ] T-V: Verification:
      `pnpm --filter @customreport/api test`,
      `pnpm --filter @customreport/web vitest run`,
      `pnpm exec playwright test --grep saml` (if added).
