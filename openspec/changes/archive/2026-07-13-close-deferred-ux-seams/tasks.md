# Tasks

## 1. Settings dirty-guard for Periods and Reminders sub-tabs

- [x] 1.1 Extract a shared `useServerSeededDraft<T>(server: T)` hook (sited with the existing shared settings helpers) that returns the draft, a dirty-marking setter, and a `markClean` callback; reseed only when the incoming server value is fresh (not the last-seeded reference) and the draft is not dirty — the Identity sub-tab's pattern, generalized.
- [x] 1.2 Use the hook in `settings-periods-sub-tab.tsx` and `settings-reminders-sub-tab.tsx`, calling `markClean` in each save's per-call `onSuccess` so the next server payload reseeds a clean form.
- [x] 1.3 Unit tests: an edited (dirty) Periods/Reminders form keeps its draft across a serverSettings prop change; a clean form reseeds; after a successful save the next server payload reseeds.

## 2. Role-switcher logout honesty

- [x] 2.1 In `role-switcher.tsx`, gate all three redirects (logout item, switch-user, post-reseed) on `response.ok` from `POST /auth/logout`; on a non-OK response or a rejected fetch, stay on the page and clear the pending state.
- [x] 2.2 Unit tests: non-OK logout → no navigation and controls re-enabled; OK logout → navigation proceeds (existing happy-path coverage may already pin this).

## 3. Case-insensitive linked-product id handling

- [x] 3.1 In `project-activity.schema.ts`, lowercase `linkedProductIds` before the uniqueness refine and emit the normalized (lowercased) array from `projectActivityCreateSchema`/`projectActivityUpdateSchema`.
- [x] 3.2 Lowercase ids inside the repository create-path dedupe and update-path reconcile so schema-bypassing callers cannot P2002 on a case variant.
- [x] 3.3 Schema tests: a case-variant duplicate is rejected; an uppercase id parses to its lowercase form. Integration test: repository create with a case-variant repeated id produces one join row and no P2002. Drop the vacuous `newActivityId` assertion in `project-activity.integration.test.ts`.

## 4. Gate

- [x] 4.1 `pnpm --filter @customreport/api db:generate && pnpm typecheck && pnpm lint && pnpm test` green.
- [x] 4.2 `pnpm --filter @customreport/api test:integration` green (postgres container up, single-run).
