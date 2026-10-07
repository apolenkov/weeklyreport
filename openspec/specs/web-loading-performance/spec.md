# web-loading-performance

## Purpose

Keep expensive web work demand-driven so unrelated data, packages, fonts, or
fallbacks do not delay the surface a user is trying to reach.

## Requirements

### Requirement: Admin parent queries run only for consuming tabs

`AdminPanel` MUST enable the admin snapshot and settings queries only when the active tab consumes their data and MUST leave self-contained tabs free of those parent requests.

#### Scenario: A self-contained admin tab opens

- **WHEN** the active tab is Periods, Reopen, Jobs, or Actions
- **THEN** its own surface renders and the parent snapshot/settings query functions are not executed unless that tab is explicitly documented as a consumer

#### Scenario: Reminders opens

- **WHEN** the Reminders tab needs snapshot policy data and the settings timezone
- **THEN** both required queries are enabled
- **AND** the tab shows a local loading/error state until each required input is ready

### Requirement: Dashboard panels become ready independently

The head dashboard MUST render its page shell immediately and MUST let each panel render ready data, a local skeleton, or a local recoverable error based only on the queries that panel requires; one pending or failed root query MUST NOT hide ready sibling panels.

#### Scenario: Weekly report is ready before review dashboard

- **WHEN** `weeklyReport.get` resolves while `review.dashboard` remains pending
- **THEN** the weekly-backed Period Summary, KPI and escalation panels can render
- **AND** pending review-specific information is identified locally without hiding those ready panels

#### Scenario: One dashboard query fails

- **WHEN** one root dashboard query fails and the other succeeds
- **THEN** the failed panels show scoped error/retry UI
- **AND** panels backed by the successful query remain visible

#### Scenario: No active period exists

- **WHEN** `weeklyReport.get` resolves with `no-period`
- **THEN** the dashboard shows the canonical no-active-period state
- **AND** it does not wait indefinitely for unrelated panel data

### Requirement: Application fonts are self-hosted through next font

The root layout MUST load Fraunces and Onest through `next/font`, Onest with both its cyrillic and latin subsets so Russian and English interface text render in one typeface with working tabular figures. It MUST preserve the existing CSS font-token consumers and MUST NOT render a blocking `fonts.googleapis.com` stylesheet or preconnect tags.

#### Scenario: The root document renders

- **WHEN** any application route is loaded
- **THEN** the two font variables are applied through Next-generated font assets
- **AND** no Google Fonts network stylesheet is required for first render

#### Scenario: A screen mixes Russian and English text

- **WHEN** a table row shows a Russian name beside an English label and a number
- **THEN** all of it renders in Onest without a second typeface for the Cyrillic part
- **AND** digits styled as tabular have equal advance widths

### Requirement: Suspense fallbacks correspond to real suspension

Data-heavy route pages that use non-suspending TanStack `useQuery` hooks MUST express loading and errors in their client components and MUST NOT wrap those components in page-level Suspense solely to suggest data streaming. Suspense MAY remain for `next/dynamic`, lazy chunks, `useSearchParams`, or a component that actually suspends.

#### Scenario: A weekly report route waits for client data

- **WHEN** its `useQuery` request is pending
- **THEN** the report client renders its explicit skeleton/readiness state
- **AND** no page-level Suspense fallback claims to be streaming that request

#### Scenario: A dynamic slide or chart chunk loads

- **WHEN** a lazy/dynamic component suspends while its code is fetched
- **THEN** its local Suspense or dynamic loading fallback may render

### Requirement: Dashboard Recovery Replaces Stalled Initial Reads

Manual Retry, the initial-load stall timeout and unsettled history restoration
SHALL start a new attempt when a dashboard query has no data and its request
remains in flight. Recovery SHALL cancel only that exact query before restarting
it. Settled reads SHALL retain their ordinary refetch behavior.

#### Scenario: A dashboard initial read does not settle

- **WHEN** recovery targets an unresolved initial review, weekly-report or activity read
- **THEN** a replacement request starts
- **AND** its successful result replaces the stalled state
- **AND** a late result from the cancelled attempt does not overwrite it

#### Scenario: A sibling dashboard read is already ready

- **WHEN** recovery restarts another stalled read
- **THEN** the ready sibling retains its data and is not restarted

#### Scenario: A settled dashboard read is retried

- **WHEN** a completed or failed read is explicitly retried
- **THEN** it follows ordinary refetch behavior without cancelling unrelated queries

### Requirement: Heavy packages and Trends tables use narrow entry points

The Next.js web build MUST optimize imports for `lucide-react`. Trends MUST import its concrete table modules directly rather than evaluating a UI barrel or requesting client-only chart chunks. Pending Trends queries MUST retain local query-loading skeletons named Loading data without hiding ready sibling sections.

#### Scenario: Trends renders ready and pending sections

- **WHEN** one Trends query is ready while another remains pending
- **THEN** the ready section renders its directly imported table
- **AND** only the pending section shows its local query-loading skeleton
