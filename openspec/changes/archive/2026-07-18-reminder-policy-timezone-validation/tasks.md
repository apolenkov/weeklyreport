## 1. Add the IANA timezone refine

- [x] 1.1 In `reminder-policy.schema.ts`, add a refine (or chained
      `.refine`) on `timezone` rejecting any value not present in
      `Intl.supportedValuesOf('timeZone')`, with a clear error message
      (e.g. "timezone must be a valid IANA time zone identifier"), placed
      alongside the existing `validUntil >= validFrom` refine.
      DEVIATION: implemented as an `Intl.DateTimeFormat` resolvability probe
      instead — the `supportedValuesOf` allowlist omits `"UTC"`/`"GMT"`/
      `"Etc/*"` aliases, which the admin form offers and defaults to; the
      probe accepts every zone the runtime resolves and still rejects
      offset-style/garbage strings.
- [x] 1.2 Confirm the refine runs on both create and update payloads (the
      schema is presumably shared for both — check `reminder-admin.service.ts`
      usage to confirm there is no separate partial/update schema that
      bypasses it).

## 2. Test coverage

- [x] 2.1 Add/create `reminder-policy.schema.test.ts`: a valid IANA zone
      (e.g. `"Europe/Moscow"`, `"UTC"`) parses successfully.
- [x] 2.2 Test: an invalid zone string (e.g. `"Not/AZone"`, `"UTC+3"`,
      `""`-adjacent garbage) is rejected, with the error path pointing at
      `timezone`.
- [x] 2.3 Test: the existing `validUntil >= validFrom` refine still fires
      correctly for a payload that also has a valid timezone — preservation
      test confirming the new refine does not short-circuit or interfere
      with the existing one.
- [x] 2.4 In `policy-applicator.test.ts`, add/confirm a preservation test:
      a genuinely unexpected non-`P2002` Prisma error inside `applyToPeriod`
      still aborts the loop via re-throw (this change must not accidentally
      make that path swallow errors while fixing the timezone input path).

## 3. Confirm the admin write surface propagates the rejection

- [x] 3.1 Read `reminder-admin.service.ts`'s policy-save path; confirm a
      schema parse failure surfaces as a client-visible validation error
      (not a generic 500) — if it does not already, this is in scope to fix
      as part of making the refine actually useful to the admin UI.

## 4. Spec delta

- [x] 4.1 `reminder-policy-timezone-validation`: ADD a requirement that
      `timezone` MUST be a valid IANA identifier at the schema boundary (new
      spec capability; see
      `specs/reminder-policy-timezone-validation/spec.md` in this change).

## 5. Gates and verification

- [ ] 5.1 `pnpm --filter @customreport/api db:generate`
- [ ] 5.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 5.3 cd apps/api && pnpm test:integration
- [ ] 5.4 `openspec validate reminder-policy-timezone-validation --strict`
