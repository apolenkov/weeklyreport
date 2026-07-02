## 1. Schema

- [x] 1.1 Add `ProjectActivity` (`name`, `groupId` req FK, `projectId?` FK, `jiraAccounts String[]`, `archived`).
- [x] 1.2 Add `ProjectActivityLead` M:M join (`activityId`, `leadId`, unique pair).
- [x] 1.3 Add `ActivityStatus` (`reportSectionId`, `activityId`, `status TrafficLightStatus?`, `note?`; unique `(reportSectionId, activityId)`).
- [x] 1.4 `migrate reset` with the AI-consent flag (disposable MVP DBs); regenerate the client.

## 2. Admin API

- [x] 2.1 `projectActivity.create/edit/archive` + attach/detach leads, on `adminProcedure` (NOT the `activity.*` namespace). Group + optional product link + Jira accounts.

## 3. Lead write path

- [x] 3.1 Seed one `ActivityStatus` (default `green`) per attached activity at section provisioning (mirror `seedProjectStatuses`).
- [x] 3.2 Fold activity statuses into the lead section-save payload (new slice beside `projectStatuses`); persist under `ReportSection.version`.
- [x] 3.3 Validate each written `activityId` is attached/seeded for the section author (reject otherwise) — close the client-trust gap.

## 4. Read / head / viewer / snapshot

- [x] 4.1 Surface group-scoped activities + status in the assembled weekly report beside products (read through the section author).
- [x] 4.2 Add activities to `publishedSnapshot`; make the read model tolerant of older snapshots (`.default([])` activities field).
- [x] 4.3 Ensure activities do NOT feed `computePortfolioOverview` totals, escalations, or product health.
- [x] 4.4 Minimal slide activity status-pill lane.

## 5. Spec follow-ups (MODIFIED deltas — author with exact headers)

- [x] 5.1 `period-dual-state`: append `activityStatus` to the "lead save writes these child rows only" enumeration.
- [x] 5.2 `head-report-visibility`: delta SKIPPED per design.md (subsumed — this change's own requirement owns head/viewer visibility); assembled report + snapshot include activities via the change's own spec.
- [x] 5.3 Write the ADRs (own-entity; no-rollup; M:M attachment).

## 6. Tests

- [x] 6.1 Two leads report independent statuses for one activity; lead form lists only attached activities.
- [x] 6.2 A lead cannot write a status for an unattached activity (rejected).
- [x] 6.3 A blocked activity does NOT change linked-product health, portfolio totals, or escalations.
- [x] 6.4 Save writes child rows only (no period write); old snapshot without activities reads.

## 7. Verification

- [x] 7.1 `pnpm --filter @customreport/api db:generate`, `pnpm typecheck`, `pnpm lint` until green.
- [x] 7.2 `pnpm test` until green.
- [x] 7.3 `openspec validate "project-activity-reporting" --strict` until it exits 0.
