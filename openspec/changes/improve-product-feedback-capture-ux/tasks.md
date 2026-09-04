## 1. Shared feedback contract

- [x] 1.1 Characterize zero-annotation page feedback in the shared wire/response schemas; verify tests accept 0 and 1-50 annotations, reject more than 50, and keep normalized pathname bounds.

## 2. API behavior

- [x] 2.1 Verify the authenticated ingress and Prisma adapter persist a valid page comment with zero annotation rows while overwriting client identity/product/status/scope; cover dedupe and role predicates in targeted API tests.
- [x] 2.2 Keep list, status, individual delete, and scoped bulk delete behavior identical for annotated and page-level records; verify repository/handler tests cover both target kinds without schema migration.

## 3. Web capture and inbox

- [x] 3.1 Add a typed application client and accessible `Comment on page` dialog for every active authenticated role; verify type/message validation, generated client identity, normalized page scope, success/error state, and focus return.
- [x] 3.2 Distinguish `Page feedback` from `Annotation` in `/feedback`; reveal captured screenshots with highlighted regions and console/network evidence, retain a secondary live SitePing link, and keep page links free of `siteping` or `sitepingUrl`.
- [x] 3.3 Use the supported locale callback for a short drawing instruction and remove all host positioning shims and private bundle-signature assertions; retain contract tests only for consumed public APIs.

## 4. Acceptance and traceability

- [x] 4.1 Browser-test feedback IDs `cmtluneeg0002fsw0wepch8vp` and `cmtlus8100006fsw0cf4wvokv`: create one page comment and one contextual annotation, verify zero versus one annotation row, captured-region and diagnostic review in the inbox, secondary live navigation, visible top navigation, right-click no-toolbar flow, viewport-contained composer, and zero console/network failures.
- [x] 4.2 Record exact verification by running targeted shared/API/Web tests, then `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm spec:check`; require every command to pass before deleting the four source feedback rows.
