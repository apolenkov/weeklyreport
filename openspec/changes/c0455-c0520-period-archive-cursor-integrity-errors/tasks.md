# Tasks

Backlog: TASK-503.31. Report: `task-503/wave7/011-503.31/REPORT.md`.

- [x] 1. Spec deltas: `period-lifecycle-ui` (archive cursor),
      `pdf-export-integrity` and `lead-form-write-actions` (integrity → 500).
- [x] 2. RED C0520: repository and outcome tests expect the masked
      `INTERNAL_SERVER_ERROR` (seven PDF cases and one outcome case got `NOT_FOUND`).
- [ ] 3. Fix C0520: `PdfExportIntegrityError` and `LeadFormIntegrityError`
      at the four invariant branches; no mapper row.
- [ ] 4. RED C0455: service, procedure and web tests for the cursor page and
      "Load more".
- [ ] 5. Fix C0455: shared cursor schema, keyset query, service, procedure and
      archive section on `useInfiniteQuery`.
- [ ] 6. DB-backed keyset integration test, browser check and six gates in a
      fresh window; independent review.
