## 1. Durable deletion

- [x] 1.1 Emit a content-free terminal tombstone after deleting the annotation,
      children, and prior evidence events in one transaction.
- [x] 1.2 Reject a stale create request whose client identifier matches a
      deletion tombstone in the authorized session.

## 2. Verification

- [x] 2.1 Add focused API tests for tombstone emission, ordering, and stale
      recreation suppression.
- [x] 2.2 Run focused API tests, typecheck, lint, and strict OpenSpec validation.
- [x] 2.3 Browser-verify Safari admin deletion against a Chrome lead session
      with retained Agentation Local Storage.
- [x] 2.4 Reproduce server-ID resurrection, duplicate creation, and author
      collision against the guarded test database; verify all three after fixing.
- [x] 2.5 Verify concurrent POST/DELETE in both lock orders with both IDs.
- [x] 2.6 Run repository gates, distinguish unrelated worktree failures, and
      repeat the correctness review of this change without open P1/P2 findings.
- [x] 2.7 Prevent proxy compression buffering and replay all scoped deletion
      pages across the initial snapshot-to-stream gap.
- [x] 2.8 Avoid starting polling timers after a disconnect during initial reads.

## Verification scope

The full unit/safety suite, full typecheck, production build, stylelint, runtime
sync, and strict OpenSpec validation passed. The final API changes also passed
API typecheck/build and the feedback suites, including 10 guarded database
integration scenarios. Scoped ESLint and formatting passed.

Full-worktree ESLint, formatting, and cleanliness are not green: concurrent
report-authoring changes contain unrelated lint/format findings and untracked
files. They were preserved, not edited or staged by this change.

Live Safari Admin → Chrome Lead checks confirmed immediate marker removal and
reconnection with retained local annotations while Chrome was away from the
page. Only disposable verification annotations were deleted; the two existing
feedback items remained intact. Independent independent review closed its ID,
locking, event-delivery, initial-replay, and connection-lifecycle findings.
