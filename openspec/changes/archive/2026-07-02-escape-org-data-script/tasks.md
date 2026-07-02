## 1. Shared schema (defence in depth)

- [ ] 1.1 In `packages/shared/src/schemas/organization.ts`, add a charset
      constraint rejecting `<` and `>` to `shortName` and `fullName` on
      `organizationUpdateSchema`, keeping the existing length bounds
      (shortName 1–16, fullName 1–200) and a clear validation message.
- [ ] 1.2 Add a unit test asserting `organizationUpdateSchema` rejects a value
      containing `<` / `>` and accepts a normal brand name with punctuation,
      spaces, and the existing length limits.

## 2. Remove the dead inline script (web)

- [ ] 2.1 In `apps/web/src/app/layout.tsx`, delete the `<script id="__org_data">`
      element together with its `react/no-danger` eslint-disable, and remove the
      now-unused `const orgPublic = await getOrgPublic()` from `RootLayout`
      (confirm `generateMetadata` keeps its own `getOrgPublic` call for the title).
- [ ] 2.2 Update `apps/web/src/app/layout.test.tsx`: drop the `__org_data`
      presence and round-trip assertions; assert the rendered layout emits no
      inline `__org_data` script, including when `fullName` is a
      `</script><img ...>` breakout payload — the parsed DOM has no injected
      element and no `</script>` sequence sourced from org data appears.
- [ ] 2.3 Add or confirm a landing render test that the brand `shortName`/`fullName`
      paint from the RSC prop (`page.tsx` `initialData`) with no "ORG" placeholder
      flash and without relying on the removed script.

## 3. Verify

- [ ] 3.1 Run `pnpm typecheck && pnpm lint && pnpm test` and confirm the new
      schema and layout/encoder tests pass.
- [ ] 3.2 Run `pnpm build` to confirm the web layout still compiles, and
      `openspec validate "escape-org-data-script" --strict` exits 0.
