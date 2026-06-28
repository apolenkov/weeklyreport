## 1. Shared schema (defence in depth)

- [ ] 1.1 In `packages/shared/src/schemas/organization.ts`, add a charset
      constraint rejecting `<` and `>` to `shortName` and `fullName` on
      `organizationUpdateSchema`, keeping the existing length bounds
      (shortName 1–16, fullName 1–200) and a clear validation message.
- [ ] 1.2 Add a unit test asserting `organizationUpdateSchema` rejects a value
      containing `<` / `>` and accepts a normal brand name with punctuation,
      spaces, and the existing length limits.

## 2. Inline-script encoding (web)

- [ ] 2.1 Add a small server-side helper (e.g.
      `apps/web/src/lib/server/serialize-inline-json.ts`) that runs
      `JSON.stringify` then escapes `<`, `>`, `/`, U+2028, U+2029 to their
      `\uXXXX` JSON escapes; unit-test that the output contains no literal
      `</script>` and round-trips through `JSON.parse` unchanged.
- [ ] 2.2 In `apps/web/src/app/layout.tsx`, replace the raw
      `JSON.stringify(orgPublic)` in the `<script id="__org_data">`
      `dangerouslySetInnerHTML` with the new encoder; update the
      `eslint-disable react/no-danger` comment to state the value is
      breakout-encoded.
- [ ] 2.3 Extend `apps/web/src/app/layout.test.tsx` with a breakout-attempt
      case: render with a malicious `fullName` and assert the emitted script
      body contains no literal `</script>` and the parsed DOM has no injected
      element, while the benign case still parses back to the original values.

## 3. Verify

- [ ] 3.1 Run `pnpm typecheck && pnpm lint && pnpm test` and confirm the new
      schema and layout/encoder tests pass.
- [ ] 3.2 Run `pnpm build` to confirm the web layout still compiles, and
      `openspec validate "escape-org-data-script" --strict` exits 0.
