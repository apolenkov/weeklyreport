## 1. Schema

- [ ] 1.1 Add `ProjectActivity` (`name`, `groupId` req FK, `projectId?` FK, `jiraAccounts String[]`, `archived`).
- [ ] 1.2 Add `ProjectActivityLead` M:M join (`activityId`, `leadId`, unique pair).
- [ ] 1.3 Add `ActivityStatus` (`reportSectionId`, `activityId`, `status TrafficLightStatus?`, `note?`; unique `(reportSectionId, activityId)`).
- [ ] 1.4 `migrate reset` with the AI-consent flag (disposable MVP DBs); regenerate the client.

## 2. Admin API

- [ ] 2.1 `projectActivity.create/edit/archive` + attach/detach leads, on `adminProcedure` (NOT the `activity.*` namespace). Group + optional product link + Jira accounts.

## 3. Lead write path

- [ ] 3.1 Seed one `ActivityStatus` (default `green`) per attached activity at section provisioning (mirror `seedProjectStatuses`).
- [ ] 3.2 Fold activity statuses into the lead section-save payload (new slice beside `projectStatuses`); persist under `ReportSection.version`.
- [ ] 3.3 Validate each written `activityId` is attached/seeded for the section author (reject otherwise) — close the client-trust gap.

## 4. Read / head / viewer / snapshot

- [ ] 4.1 Surface group-scoped activities + status in the assembled weekly report beside products (read through the section author).
- [ ] 4.2 Add activities to `publishedSnapshot`; make the read model tolerant of older snapshots (`.default([])` activities field).
- [ ] 4.3 Ensure activities do NOT feed `computePortfolioOverview` totals, escalations, or product health.
- [ ] 4.4 Minimal slide activity status-pill lane.

## 5. Spec follow-ups (MODIFIED deltas — author with exact headers)

- [ ] 5.1 `period-dual-state`: append `activityStatus` to the "lead save writes these child rows only" enumeration.
- [ ] 5.2 `head-report-visibility`: assembled report + snapshot include activities.
- [ ] 5.3 Write the ADRs (own-entity; no-rollup; M:M attachment).

## 6. Tests

- [ ] 6.1 Two leads report independent statuses for one activity; lead form lists only attached activities.
- [ ] 6.2 A lead cannot write a status for an unattached activity (rejected).
- [ ] 6.3 A blocked activity does NOT change linked-product health, portfolio totals, or escalations.
- [ ] 6.4 Save writes child rows only (no period write); old snapshot without activities reads.

## 7. Verification

- [ ] 7.1 `pnpm --filter @customreport/api db:generate`, `pnpm typecheck`, `pnpm lint` until green.
- [ ] 7.2 `pnpm test` until green.
- [ ] 7.3 `openspec validate "project-activity-reporting" --strict` until it exits 0.
