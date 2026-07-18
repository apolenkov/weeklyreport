## ADDED Requirements

### Requirement: Print and admin surfaces reuse canonical presentation helpers instead of reimplementing them

Print status labels MUST be produced by calling the canonical `statusLabel(status, "print")` helper in `lib/status-presentation`, and any admin surface rendering a plus icon MUST render the canonical `PlusIcon` from `shared/ui/icons` rather than a locally reimplemented copy.

#### Scenario: A print surface renders a status label

- **WHEN** `print-portfolio-table.tsx` or `print-lead-section.tsx` renders a report or product status
- **THEN** it calls `statusLabel(status, "print")` from `lib/status-presentation`
- **AND** no local `printStatusLabel` function exists in `print-report-theme.ts`

#### Scenario: An admin tab renders the add/create icon

- **WHEN** `reminders-tab.tsx` or `reminders-empty-state.tsx` renders the plus icon next to a create action
- **THEN** it imports `PlusIcon` from `shared/ui/icons`
- **AND** no local `PlusIcon` definition remains in `policy-form.tsx`

#### Scenario: Rendered label and icon output is unchanged

- **WHEN** the on-track, at-risk, blocked, and empty print labels are rendered, and the reminders plus icon is rendered
- **THEN** the rendered text and markup match the pre-change output byte-for-byte
