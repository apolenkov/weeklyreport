# Tasks — Driver Findings, All Roles (2026-06-11)

Captured from the ai-ui-driver run across lead / head / viewer. Re-verify each
finding in the live browser (`:3000`, dev-login as the named role) BEFORE
committing its fix — the driver skeptic is fallible in both directions.

Before starting, re-run `git status --short` and `openspec list`. The 5 lead
findings overlap the committed change `driver-findings-lead-2026-06-12`; check
it first so the two changes do not implement the same fix twice.

## Low-risk (fix tonight)

- [ ] 1.1 Finding 5 (plural "1 items"): reproduce at a single-item period —
      `/reports/<id>`, expand a product whose Current Week has exactly one item;
      header reads "Current Week · 1 items".
- [ ] 1.2 Lift `pluralize(value, singular, plural)` from
      `components/admin/reminders-tab-format.ts:70` to a shared web util and use
      it at `product-accordion.tsx:269`. Note: line 313 (Next Week) already
      pluralizes correctly — do not regress it. Label-only; shared component
      (head/admin/viewer render it). Add/extend a unit test for the 1 vs N case.
- [ ] 1.3 Finding 6 (dead search anchor): first reproduce a section-bearing
      search hit (item/risk/decision scope) that emits `#section-<id>`. If leads
      cannot trigger one, prefer stripping the fragment in `targetUrlFor`
      (`search/search-input.tsx:66`); else render `id="section-<id>"` on each
      lead-form section. Add a test asserting the chosen behavior.
- [ ] 1.4 Finding 7 (Recharts `width(-1)/height(-1)`): reproduce on
      `/head/dashboard` and `/reports/trends` with the console open; confirm the
      chart still renders. Give the `ResponsiveContainer` wrapper an explicit
      `minHeight` / defined aspect (named const, no magic number) so it never
      reads -1 on first paint.
- [ ] 1.5 Gates: `pnpm typecheck && pnpm lint` + `pnpm test` for the touched web
      package. Commit (own files only; conventional message naming this change).

## Risky (morning confirmation — do NOT start without a decision)

- [ ] 2.1 Finding 1 (systemic Zod leak + 4xx retry): re-confirm the raw-JSON
      toast on `/lead/report/not-a-uuid` (`leadForm.byPeriod`) AND
      `/reports/not-a-uuid` (`weeklyReport.get`), plus the 4-attempt 4xx retry
      on the `byPeriod` batch. Proposed fix = map BAD_REQUEST / Zod / NOT_FOUND
      to a friendly message in `formatClientErrorMessage` (never echo raw
      `error.message` for validation errors) + a `retry` predicate in
      `query-client.ts` that skips 4xx. Also fix the misleading "No active
      reporting period" head empty-state on a malformed id. Cross-role seam —
      needs sign-off that no route relies on the current retry; add tests for
      both the formatter and the retry predicate.
- [ ] 2.2 Finding 2 (lead preview shows the whole portfolio): BLOCKED on the
      open question — is the preview the unified report (intended) or the lead's
      slice (the finding's assumption)? No code change until answered; the fix
      touches the shared `weekly-report-page.tsx`.
- [ ] 2.3 Finding 3 (export-PDF catalog vs gated button): decide whether
      leads/viewers should have Export-PDF. If no → fix the oracle catalogs
      (`e2e/catalog/viewer.yaml` + lead intents) around the `/print` path, NOT
      the app. If yes → separate feature change. Catalog edits validate with
      `npx playwright test --list` (e2e is not tsc-gated).
- [ ] 2.4 Finding 4 (PeriodNavigator wrong period on `/head/report/[id]`):
      re-confirm the combobox shows only the latest published period while the
      body shows the active week. Fix must (1) include the displayed/active
      period in `periods` with `isCurrent=true` on the head route
      (`head-report-shell.tsx:58-73`) AND (2) resolve `currentIndex` from the
      head pathname (`period-navigator.tsx:92-96`) — the regex fix alone is
      insufficient. Add a head-report-shell / period-navigator test asserting the
      trigger shows the displayed period (not `periods[0]`) on
      `/head/report/<activeId>`.

- [ ] 2.5 After landing 2.1, run `npx openspec validate driver-findings-2026-06-11`
      then gates `pnpm typecheck && pnpm lint && pnpm test` for the touched
      packages. The `client-error-policy` delta (validation-error suppression +
      4xx no-retry) MUST be covered by the formatter and retry-predicate tests
      from 2.1 before this change can archive.

## Open questions (block the risky set)

- 2.2: lead preview — unified report or lead's section?
- 2.3: should leads / viewers have Export-PDF at all?

## Notes

- Findings 5 and 6 also appear in `driver-findings-lead-2026-06-12`
  (lead-only hand-rescue). Implement once; do not double-land.
- admin-role driver run was not executed this pass.
