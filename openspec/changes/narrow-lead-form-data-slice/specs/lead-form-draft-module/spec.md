## ADDED Requirements

### Requirement: The data hook crosses the component seam as a declared slice

`LeadFormLoaded` and every component below it MUST receive server-loaded data through a purpose-built declared interface (`LeadFormLoadedData`), never as `ReturnType<typeof useLeadFormData>` or any other whole-hook return type; the slice declares exactly the fields its consumers read.

#### Scenario: No hook return type in any props interface

- **WHEN** props interfaces under `features/report-sections/ui/` are inspected
- **THEN** none references `ReturnType<typeof use…>`
- **AND** `LeadFormLoaded`'s data prop is the declared slice
