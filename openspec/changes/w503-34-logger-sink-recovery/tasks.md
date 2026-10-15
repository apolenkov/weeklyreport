# Tasks

- [x] 1. Spec delta for `operational-logger-wiring`.
- [x] 2. RED tests in `logger.test.ts` (same-logger, child and sibling reopen; reopen failure does not throw) and `nest-app-logger.adapter.test.ts` (real static `Logger.error(err, err.stack)`).
- [x] 3. Sink registry reopens a destroyed stream; loggers resolve the sink per write (`logger.ts`).
- [x] 4. Adapter omits `nestContext` for an Error's own stack (`nest-app-logger.adapter.ts`).
- [ ] 5. Six gates on the frozen SHA (Air) and independent review.

Unit tests do not prove a real disk fault or a real Nest shutdown; both stay
native observations for Root.
