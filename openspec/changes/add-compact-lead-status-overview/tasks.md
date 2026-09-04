## 1. Shared contracts and projection model

- [x] 1.1 Add the bounded status-overview input/output schemas and public types in `@customreport/shared`; verify schema tests cover published, submitted-fallback, unavailable, and malformed predecessor shapes.
- [x] 1.2 Add the pure reporting-unit timeline projector for Product and Project Activity parents; verify unit tests cover source-count equality, stable ordering, unplanned/continued rows, orphan parents, and zero/one/many Activity links.

## 2. API read path

- [x] 2.1 Extend the lead-form repository/service with one bounded selected-plus-immediate-predecessor read; verify repository tests prove snapshot-first, submitted-only fallback, draft exclusion, and no cross-author disclosure.
- [x] 2.2 Expose the validated read through a canonical protected tRPC procedure; verify router/service tests cover authorization, not-found behavior, output parsing, and absence of writes.

## 3. Web Overview

- [x] 3.1 Add Overview to lead route parsing, canonical redirects, loading states, and the `Overview | Edit | Slides` toggle; verify route and snapshot tests cover no-mode default, explicit modes, and SitePing parameter preservation.
- [x] 3.2 Flatten the tokenized reporting-unit timeline into an aligned desktop matrix with contained responsive layout; verify component tests cover two-item previews, an operable `+N more`, inline disclosure, accessible state, statuses, dates, empty states, and absence of nested item-card chrome.
- [x] 3.3 Reuse the canonical lead editor seam for same-page Current/Next item editing while keeping Previously planned and non-editable records inert; verify draft/autosave/write-path tests and explicit Edit-details navigation.

## 4. Acceptance and traceability

- [x] 4.1 Browser-test feedback IDs `cmtluljni0000fsw049sfjbtu`, `cmtluneeg0002fsw0wepch8vp`, and `cmtlur3010004fsw04g1todbk` at 1280x900 and 1728x962; require aligned columns, no document overflow or console errors, correct source counts, and preserved art direction.
- [x] 4.2 Record exact verification by running targeted shared/API/Web tests, then `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm spec:check`; require every command to pass before deleting the source feedback rows.
