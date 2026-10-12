# Tasks

- [x] 1. Spec delta for `api-shutdown-coordination`.
- [x] 2. `reportTerminal` helper in `shutdown-coordinator.ts`; both write sites use it.
- [x] 3. Unit tests in `shutdown-coordinator.test.ts` and `process-error-handlers.test.ts`.
- [ ] 4. Native check WR1: real child, stderr as a full pipe with a stalled reader, exit within the deadline on macOS and in the Linux API image.
- [ ] 5. Native check WR2: nothing touched `process.stderr` before the terminal path; `process.stderr.fd` access makes fd 2 non-blocking.

A green unit run does not prove the stalled-reader bound; tasks 4 and 5 do.
