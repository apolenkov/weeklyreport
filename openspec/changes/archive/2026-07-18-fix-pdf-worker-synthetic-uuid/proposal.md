## Why

`apps/api/src/infrastructure/trpc/trpc.context.ts:39` defines:

```ts
const PDF_EXPORT_SYNTHETIC_USER_ID = "a0000000-0000-4000-8000-0000000pdfwk";
```

The trailing segment `0000000pdfwk` contains the non-hex characters `p`, `w`,
`k`. `userSessionSchema.userId` is `z.uuid()` (`packages/shared/src/schemas/auth.ts:74`),
which requires every character outside the dashes to be a hex digit. This
string fails that check.

The docblock directly above it (lines 31-38) states the synthetic session
"must satisfy `userSessionSchema` (uuid userId, email, etc.) so existing
middlewares keep their shape contract." That claim is false for the legacy
PDF-export session built by `buildLegacyPdfExportSession` — it is a latent
contract lie. Nothing currently re-parses this session through
`userSessionSchema` at runtime, so the break is dormant, but any future
middleware or serialization boundary that does parse it (e.g. a session
round-trip through a queue, cache, or cross-process boundary) would reject
every in-flight legacy PDF-export request without warning.

An existing test fixture
(`apps/api/src/infrastructure/trpc/trpc.context.pdf-export.test.ts:456`)
hardcodes the same invalid string independently of the constant, so the
drift is already duplicated in test data.

## What Changes

- Replace `PDF_EXPORT_SYNTHETIC_USER_ID` with a valid fixed UUID (all-hex,
  version/variant nibbles preserved per the file's existing `a0000000-...`
  synthetic-id convention), so it actually satisfies `userSessionSchema`.
- Update the hardcoded duplicate in
  `trpc.context.pdf-export.test.ts` to the same new value.
- Add a schema-parse regression test asserting
  `userSessionSchema.safeParse(buildLegacyPdfExportSession(...))` (or the
  equivalent constructed session) succeeds, so this contract cannot silently
  regress again.
- No behavior change to routing, middleware, or PDF-export authorization —
  only the literal synthetic user-id value changes.

## Capabilities

### Modified Capabilities

- `pdf-export-integrity` — the legacy PDF-export synthetic session's
  `userId` is now a schema-valid UUID, so `userSessionSchema` actually
  accepts it as documented.

## Impact

- `apps/api/src/infrastructure/trpc/trpc.context.ts` — synthetic UUID
  constant.
- `apps/api/src/infrastructure/trpc/trpc.context.pdf-export.test.ts` —
  duplicated literal + new schema-parse regression test.
- No API surface, DB schema, or client contract changes.

## Non-goals

- Not touching PDF-export token verification, JWT claims, or the
  `requestedBy`-based session path (only the legacy no-`requestedBy`
  fallback session is affected).
- Not changing `pdfExportGuardMiddleware` or role/access restrictions.
- Not renaming or restructuring `buildLegacyPdfExportSession`.
