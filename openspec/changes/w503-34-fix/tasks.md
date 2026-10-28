# Tasks

## 1. Contract

- [x] 1.1 Log calls never throw into business code; fallback to the other stream (TASK-503.34, C0595).
- [x] 1.2 Boot failure is captured by Sentry before the bounded drain; exit stays 1 (TASK-503.34, C0620).

## 2. Implementation

- [x] 2.1 RED: logger stdout/stderr/OTel throw tests in `logger-transport.test.ts`; boot-failure capture tests in `boot-failure.test.ts`.
- [x] 2.2 GREEN: guard the logger transport writes; extract `handleBootFailure` and capture before drain.
- [x] 2.3 Six gates on the reviewed SHA.
