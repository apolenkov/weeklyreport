## 1. Shared contract and web outcome

- [x] 1.1 Add the `provider_unavailable` outcome to the canonical shared schema and its contract tests.
- [x] 1.2 Render the temporary provider outcome with accurate native Lead chat copy and retry behavior, with component coverage.

## 2. API grounding and provider errors

- [x] 2.1 Add regression tests for compact evidence across candidate kinds and serialized-budget enforcement with metadata-heavy candidates.
- [x] 2.2 Replace complete `SearchCandidate` evidence with a compact discriminated grounding record and budget the serialized grounding payload.
- [x] 2.3 Add a safe application-level provider error contract and adapter tests for transient and non-transient SDK failures.
- [x] 2.4 Convert exhausted transient planner/answer failures to `provider_unavailable` while preserving protocol and non-retryable errors, with service coverage.

## 3. Verification

- [x] 3.1 Run focused shared, API, and web Vitest suites for the changed contracts and request path.
- [x] 3.2 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`; document any failures caused by pre-existing workspace changes.
- [x] 3.3 Re-run the authenticated local API reproduction and confirm the broad report question no longer builds an oversized answer request or returns misleading connection copy.
