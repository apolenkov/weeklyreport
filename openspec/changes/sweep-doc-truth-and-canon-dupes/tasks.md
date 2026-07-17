# Tasks

## 1. Characterization pins (pre-change)

- [ ] 1.1 Add/confirm a test asserting `statusLabel("on-track" | "at-risk" | "blocked" | "empty", "print")` returns `"On Track"`, `"At Risk"`, `"Blocked"`, `"No status"` — the exact strings `printStatusLabel` currently produces (with `"empty"` covering the fallback path `printStatusLabel` reaches via `default: return status`).
- [ ] 1.2 Snapshot or assert the current rendered output of `print-portfolio-table.tsx` and `print-lead-section.tsx` for each status value before rerouting, so a label mismatch after delegation fails the test instead of shipping silently.
- [ ] 1.3 Add/confirm a test rendering the shared `PlusIcon` from `shared/ui/icons.tsx` and assert it matches the markup (`viewBox`, `stroke`, `strokeWidth`, `<line>` coordinates) the local `policy-form.tsx` copy currently renders, so `reminders-tab.tsx` / `reminders-empty-state.tsx` visuals are pinned before the re-export is removed.

## 2. Delegate print status label to the canonical helper

- [ ] 2.1 Remove `printStatusLabel` from `apps/web/src/app/print/[reportId]/print-report-theme.ts`.
- [ ] 2.2 Update `print-portfolio-table.tsx` to import and call `statusLabel(product.status, "print")` from `lib/status-presentation` in place of `printStatusLabel(product.status)`.
- [ ] 2.3 Update `print-lead-section.tsx` to import and call `statusLabel(report.status, "print")` from `lib/status-presentation` in place of `printStatusLabel(report.status)`.
- [ ] 2.4 Confirm `printStatusColor` and `workflowBadge` in `print-report-theme.ts` are untouched and still exported.

## 3. Reroute PlusIcon to the shared icon

- [ ] 3.1 Remove the local `PlusIcon` function from `apps/web/src/features/admin/ui/policy-form.tsx`.
- [ ] 3.2 Update `reminders-tab.tsx` to import `PlusIcon` from `../../../shared/ui/icons` instead of `./policy-form`.
- [ ] 3.3 Update `reminders-empty-state.tsx` to import `PlusIcon` from `../../../shared/ui/icons` (shared) instead of `./policy-form`.
- [ ] 3.4 Search the repo for any other import of `PlusIcon` from `policy-form` and confirm none remain.

## 4. Focused verification

- [ ] 4.1 Run the print-section and status-presentation tests updated in Section 1 and confirm the pinned label strings and rendered output are unchanged.
- [ ] 4.2 Run the reminders-tab and reminders-empty-state tests and confirm the plus icon still renders identically after the import change.

## Gates

- [ ] 5.1 `pnpm typecheck`
- [ ] 5.2 `pnpm lint`
- [ ] 5.3 `pnpm test`
