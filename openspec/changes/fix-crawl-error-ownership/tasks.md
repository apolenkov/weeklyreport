## Error ownership

- [x] Add and run original failing regressions for secret read, CLI bounds/output, login/backoff/page recovery and log drain.
- [x] Preserve errors and source ownership; verify regressions and successful boundaries.
- [x] Sync ui-crawl contract and pass six mandatory checks; publish a separate MR.

Original error-ownership regressions: 8 failures exit 1; failed auth-command entry regression exit 1. Final 17 focused and adjacent tests exit 0, focused ESLint and scripts typecheck exit 0. Evidence: ~/work/handoffs/287-crawl/failures/.

Final mandatory gates all exit 0. Timeout-with-complete-output regression first exits 1; four final CLI regressions exit 0, with startup headroom in the synthetic fixture. Full suite includes 18 diagnostic and adjacent regressions. Logs: ~/work/handoffs/287-crawl/failures/ready-*.log. No shared database phase ran.
