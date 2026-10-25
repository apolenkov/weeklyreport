# Tasks

Backlog: TASK-503.31. Report: `task-503/wave7/011-503.31/REPORT.md`.

- [x] 1. Spec deltas: `period-lifecycle-ui` (archive cursor),
      `pdf-export-integrity` and `lead-form-write-actions` (integrity → 500).
- [x] 2. RED C0520: repository and outcome tests expect the masked
      `INTERNAL_SERVER_ERROR` (seven PDF cases and one outcome case got `NOT_FOUND`).
- [x] 3. Fix C0520: `PdfExportIntegrityError` and `LeadFormIntegrityError`
      at the four invariant branches; no mapper row.
- [x] 4. RED C0455: service, procedure and web tests for the cursor page and
      "Load more".
- [x] 5. Fix C0455: procedure cursor schema, keyset query, service, procedure and
      archive section on `useInfiniteQuery`.
- [x] 6. Local gates on the delivery tree through `run-checks`:
      `format:check`, `lint`, `typecheck`, `test`, `build`, `spec:check`
      (`audit:dependencies` is a known repo-wide blocker, not this change).
- [x] 7. Review follow-ups: `createCaller` input-validation tests for
      `listPeriodsByState`, archive infinite-key invalidation, and the
      next-page-error-only banner.
- [ ] 8. Run the DB-backed keyset integration test and the browser check in a
      fresh window.
