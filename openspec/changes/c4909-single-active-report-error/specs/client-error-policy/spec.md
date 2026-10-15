# Spec Delta

## ADDED Requirements

### Requirement: A composed page reports one query failure once

When several components on one page surface read the same query, exactly
one of them MUST register the error-policy handler for it, so a single
failure of that query emits one `logClientError` entry and at most one toast
on that page.

#### Scenario: the active report fails to load on the lead status overview

- **WHEN** `reports.getActive` fails while the lead status overview and its
  lead-form editor are mounted
- **THEN** exactly one log entry for `reports.getActive` is emitted
- **AND** at most one "Failed to load active report" toast is shown
