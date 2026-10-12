# Tasks

## 1. Ledger lock failures fail closed (C4145)

- [x] 1.1 Reproduce permanent acquisition (ENOTDIR) and stale-removal (EACCES) lock failures in `rate.test.ts` through a deadline-bounded child process; reproduce primary/secondary failure at the module seam.
- [x] 1.2 Retry only `EEXIST` in `locked`, suppress only `ENOENT` in `dropStaleLock`, and keep the action failure primary with the release failure secondary; a standalone release failure still fails.

## 2. Handled fetch rejection evidence (F6921-3)

- [x] 2.1 Reproduce the missing diagnostic against the actual generated batch script in a JSDOM realm in `press.test.ts`.
- [x] 2.2 Add the bounded non-Abort rejection diagnostic, same-error rethrow and single-report dedup in the generated `HOOKS`; add the native candidate in `observations.browser.test.ts` (Root-owned run).

## 3. Contract and delivery

- [x] 3.1 Validate the scoped OpenSpec change and changed-file lint/format/diff checks; preserve exact commands and exits in the D37-F08 handoff.
- [ ] 3.2 Root runs the aggregate gates and native browser acceptance; native stays NE until then.
