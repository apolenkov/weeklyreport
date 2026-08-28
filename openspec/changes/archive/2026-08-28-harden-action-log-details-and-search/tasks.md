## 1. Shared Action Log Contract

- [x] 1.1 Add strict shared schemas and inferred types for the exact admin
      action-log event allowlist, fixed failure classifications, and cursor page.
- [x] 1.2 Add shared contract tests that accept every nullable/legacy-normalized
      field and reject unknown properties, arbitrary reasons, malformed
      timestamps, and invalid status/role values.
- [x] 1.3 Export the new schemas/types through the existing shared facade and
      prove public-contract immutability without introducing duplicate types.

## 2. API Audit Privacy Boundary

- [x] 2.1 Replace mutation error-message persistence with the fixed tRPC failure
      classification while preserving target extraction, correlation, duration,
      AppLogger emission, and best-effort durable-write metrics.
- [x] 2.2 Add negative mutation-audit tests proving representative report text,
      review comments, user profile values, Telegram content, credentials,
      tokens, cookies, transport bodies, and internal DB metadata do not enter
      the audit event or durable row on success or failure.
- [x] 2.3 Make the Prisma repository select only the durable allowlist and make
      the service map fields explicitly, normalize success/recognized/legacy
      reasons, and parse the strict shared page contract.
- [x] 2.4 Declare the strict output schema on `admin.actionLog.list` and add
      service/router tests for exact output, `LEGACY_FAILURE`, nullable fields,
      admin success, and lead/head/viewer rejection.
- [x] 2.5 Preserve and extend repository integration coverage for equal-timestamp
      composite-keyset traversal, no duplicates/omissions, and pre-budget
      exclusion of manual-proof rows.

## 3. Web Detail, Copy, and Search

- [x] 3.1 Replace the hand-written web row interface with the shared event type,
      add the real `fail -> Error` status label, and implement one pure search
      corpus covering raw/displayed procedure, status, and ISO/displayed time.
- [x] 3.2 Implement a semantic per-row disclosure with `aria-expanded`,
      `aria-controls`, a labelled detail region, full untruncated allowlisted
      values, stable focus, and a deterministic allowlist-only serializer.
- [x] 3.3 Implement Copy feedback through an inline polite live region, including
      clipboard failure, without collapsing the row or moving focus.
- [x] 3.4 Add focused model/component tests for timestamp and humanized searches,
      disclosure keyboard behavior, full safe details, exact clipboard JSON,
      no extra fields, focus retention, and accessible success/failure feedback.
- [x] 3.5 Add pagination-composition coverage proving an active search is
      reapplied when the next loaded page extends the row set.

## 4. Catalog, Fixture, and Evidence Alignment

- [x] 4.1 Extend the disposable full seed profile to at least 21 deterministic,
      profile-owned non-proof events with stable ids/timestamps; update seed
      scope/summary tests without changing production data.
- [x] 4.2 Correct `admin-actions-view` to require whitelisted event details,
      loaded-row timestamp search, and 20-row cursor pagination; remove every
      raw-payload claim.
- [x] 4.3 Add a deterministic catalog regression for the Action Log wording and
      tighten generator/review guidance so unsupported controls, fields,
      retention, and access claims require live-source or accepted-OpenSpec
      evidence.
- [x] 4.4 Add or update the DS24 executable browser oracle to expand one row,
      verify/copy only safe details, search by displayed timestamp, load the
      second page, and repeat the terminal source/product-path guard.
- [x] 4.5 After repository verification on one unchanged patch digest, recapture
      DS24 and update the external desktop README, visual review, requirement
      adjudication, manifest, and archive index with the refined classification.

## 5. Verification and Handoff

- [x] 5.1 Run focused shared/API/web Vitest suites for every changed contract,
      mutation-audit, service/repository, formatter/search, disclosure, and
      clipboard file; record the exact commands and exits.
- [x] 5.2 Run `pnpm catalog:check`,
      `pnpm exec openspec validate harden-action-log-details-and-search --strict`,
      and `pnpm exec openspec validate --all --strict` on the same patch.
- [x] 5.3 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and the
      focused guarded integration/browser evidence command on the same patch;
      record every exit without promoting a narrower green check.
- [x] 5.4 Recompute the full tracked-plus-sorted-untracked patch digest, prove
      product-path status and source identity did not drift during verification,
      and obtain an independent terminal review of security, accessibility,
      catalog, and requirement coverage before declaring the change apply-done.
