## ADDED Requirements

### Requirement: Successful plan writes refresh the lead Overview projection

The production lead-form write adapter MUST invalidate `leadForm.statusOverview` in its current QueryClient after successful `leadForm.resolvePlan`, `leadForm.restorePlan` and `leadForm.promotePlan` commands. Rejected plan commands MUST NOT trigger success refresh effects. The adapter MUST preserve existing lead-form invalidation, fire-and-forget refresh and invalidation rejection handling.

#### Scenario: Successful plan resolution refreshes a warm active Overview

- **GIVEN** the lead has a fresh active `leadForm.statusOverview` query at `/lead/report/[reportId]` for a report ID that differs from the written report-section ID
- **WHEN** `leadForm.resolvePlan` succeeds through the production write adapter with the selected report ID unchanged
- **THEN** the existing lead-form query families are invalidated
- **AND** the Overview query refetches without waiting for its freshness interval to expire
- **AND** a successful projection response replaces the previously cached section data

#### Scenario: Successful plan restoration refreshes a warm active Overview

- **GIVEN** the lead has a fresh active `leadForm.statusOverview` query at `/lead/report/[reportId]` for a report ID that differs from the written report-section ID
- **WHEN** `leadForm.restorePlan` succeeds through the production write adapter
- **THEN** the existing lead-form query families and the Overview projection are invalidated
- **AND** a successful projection refetch replaces the previously cached section data

#### Scenario: Successful plan promotion refreshes a warm active Overview

- **GIVEN** the lead has a fresh active `leadForm.statusOverview` query at `/lead/report/[reportId]` for a report ID that differs from the written report-section ID
- **WHEN** `leadForm.promotePlan` succeeds through the production write adapter
- **THEN** the existing lead-form query families and the Overview projection are invalidated
- **AND** a successful projection refetch replaces the previously cached section data

#### Scenario: Rejected plan command preserves the warm projection

- **GIVEN** the lead has a fresh active Overview query
- **WHEN** resolve, restore or promote rejects through the production write adapter
- **THEN** the caller receives the normalized write error
- **AND** the adapter does not invalidate lead-form or Overview data as a success effect

#### Scenario: Plan refresh stays within the proven consumer boundary

- **WHEN** resolve, restore or promote succeeds
- **THEN** its new projection refresh does not expand to dashboard or `leadForm.openWork` families
- **AND** the existing cache behavior of request-reopen and other lead-form commands is preserved
