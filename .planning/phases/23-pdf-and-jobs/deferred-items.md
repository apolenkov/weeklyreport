# Deferred Items — Phase 23

Pre-existing issues encountered during execution that are out of plan scope.

## Pre-existing typecheck errors

### apps/api/src/modules/period/period.contract.test.ts:65
- **Issue:** `'userId' is declared but its value is never read.` (TS6133)
- **Pre-existing:** Yes (verified by `git stash` baseline before any 23-01 changes).
- **Action:** Out of scope for Phase 23 (period module). Suggest a follow-up cleanup PR or fold into a future period-module plan.
