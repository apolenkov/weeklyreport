# Scope product overview activation to its product surface

## Why

Product overview activation persists in the public WeeklyReportPage while the Head URL scope changes. A retained product epoch currently force-opens every co-owner product instance in lead scope, despite no matching lead navigation. This violates the existing scope-adaptive overview and instance-local disclosure contracts.

## What Changes

- Forward a product navigation epoch to ProductAccordion only in product scope.
- Preserve existing React keys, DOM identity, target highlighting, URL state and disclosure behavior.
- Add a public page regression using schema-admitted co-owned report sections and the existing in-memory transport boundary.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `report-card-clarity`: retained product navigation must not expand lead-scope instances after a scope change.

## Impact

Owned weekly-report-page-content.tsx and existing product-accordion.test.tsx. No API, storage, schema or dependency changes. Browser/network/assistive-technology acceptance and aggregate checks remain outside this local proof.
