# Tasks

- [x] 1. Spec delta for `authenticated-product-feedback`.
- [x] 2. RED integration test `agentation-inbox-thread-order.integration.test.ts`: eight same-millisecond replies through `addThreadMessageForInbox`; inbox and snapshot thread order equal the PG oracle `[timestamp, id]`; control with later-first replies.
- [x] 3. Unit contract test `agentation-inbox-thread-order.test.ts`: every inbox list and write-response query requests the shared `THREAD_MESSAGES_INCLUDE` order.
- [x] 4. Repair: `ANNOTATION_WITH_THREAD` and its four inline copies in `agentation-inbox-actions.ts`, and the `list` include in `agentation-inbox.repository.ts`, use `THREAD_MESSAGES_INCLUDE`.
- [ ] 5. Run the RED integration test on a guarded PostgreSQL lane, then GREEN on the same lane.
- [ ] 6. Six repository gates and independent review.

The fixed clock in the RED stands for two replies within one millisecond; it
does not claim how often that happens in production. The unit contract test
covers the query the inbox sends; only the guarded lane proves that PostgreSQL
returns that order.
