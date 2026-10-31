# Tasks

## 1. Specification

- [ ] 1.1 Keep the MODIFIED requirement and its two clarification scenarios aligned with `openspec/specs/lead-report-assistant/spec.md`.
- [ ] 1.2 Run `pnpm exec openspec validate w503-111-clarification-total --strict`.

## 2. Shared contract and API

- [ ] 2.1 RED: catalog test for 21 and 2 distinct candidates asserts `total` and `truncated`; log to `~/work/handoffs/wr-513/s26/b3/wave2/b/red.log`.
- [ ] 2.2 GREEN: add `total` and `truncated` to the shared schema, the resolver outcome types, `resolveReference` and candidate preparation without dropping them.

## 3. Lead UI

- [ ] 3.1 RED then GREEN: the clarification component shows `Showing {options.length} of {total} matches. Refine your question to narrow them down.` only when `truncated` is true.

## 4. Verification

- [ ] 4.1 Focused vitest, `tsc --noEmit` for api, shared and web, eslint and prettier on changed files.
