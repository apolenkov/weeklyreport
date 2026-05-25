# Tasks

## Dependency upgrade + test fix

- **SAML-T1** Check `npm view samlify versions` for a patch or minor release
  that uses current `xmldom` API
- **SAML-T2** If upgrade available: update `package.json` samlify version,
  run `pnpm install`, verify test passes
- **SAML-T3** If no upgrade: add `@xmldom/xmldom` to `devDependencies` and
  update test setup to use the maintained fork
- **SAML-T4** Run SAML auth tests locally:
  `pnpm --filter @customreport/api test -- saml.samlify.test.ts`
- **SAML-T5** Verify no warnings in output; check test output for `onError`
  deprecation messages
- **SAML-T6** Commit: `fix(auth): resolve samlify xmldom onError deprecation`

## Verification

```bash
pnpm --filter @customreport/api test -- src/modules/auth/saml.samlify.test.ts
```
